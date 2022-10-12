import { web3 } from "../web3/web3";
import { logger } from "../logger/logger";
import { config } from "../config/config";
import { BlockHeader } from "web3-eth";
import { Block, Miner, MissRecord } from "../models";
import { stakeMannager } from "../abis/stakeManager";
import { ActiveValidatorSet } from "@rei-network/core/dist/consensus/reimint/validatorSet";
import {
  rlp,
  rlphash,
  ecrecover,
  toBuffer,
  BN,
  Address,
  intToBuffer,
  bufferToInt,
  intToHex,
} from "ethereumjs-util";
import sequelize from "../db/db";

const initBlock = 7011452;

let startBlock = initBlock;

const stakeManager = new web3.eth.Contract(
  stakeMannager as any,
  "0x0000000000000000000000000000000000001001"
);

class Queue<T> {
  queueResolve: undefined | ((value: T) => void) = undefined;
  request: T[] = [];

  push(instance: T) {
    if (this.queueResolve) {
      this.queueResolve(instance);
      this.queueResolve = undefined;
    } else {
      this.request.push(instance);
    }
  }

  pop() {
    return this.request.shift();
  }
}

const headerQueue = new Queue<BlockHeader>();

export async function recover() {
  logger.detail("🧵 Start read state and Recover");
  const blockNow = await web3.eth.getBlock("latest");
  headerQueue.push(blockNow);
  const block = await Block.findOne({
    order: [["blockNumber", "DESC"]],
  });
  startBlock = block ? block.blockNumber + 1 : initBlock;
  logger.detail(`🧵 Push ${blockNow.number}into queue, Recover done`);
}

async function _startAfterSync(callback) {
  try {
    let isSyncing = await web3.eth.isSyncing();
    if (isSyncing) {
      logger.detail(
        `Syncing netword ${await web3.eth.net.getId()}, current block : ${await web3.eth.getBlock(
          "latest"
        )}`
      );
      setTimeout(() => {
        _startAfterSync(callback);
      }, 60000);
    } else {
      callback();
    }
  } catch (err) {
    logger.error("ERROR: Get rei network status failed", err);
    setTimeout(() => {
      _startAfterSync(callback);
    }, 60000);
  }
}

async function headersLoop() {
  await recover();
  logger.detail(" start headersLoop");
  while (true) {
    let header = headerQueue.pop();
    if (!header) {
      header = await new Promise<BlockHeader>((resolve) => {
        headerQueue.queueResolve = resolve;
      });
    }
    for (startBlock; startBlock <= header.number; startBlock++) {
      logger.detail(`🔋 Handle block number is : ${startBlock}`);
      const blockNow = await web3.eth.getBlock(startBlock);
      const [miner, roundNumber] = recoverMinerAddress(
        intToHex(blockNow.number),
        blockNow.hash,
        blockNow.extraData
      );

      const transaction = await sequelize.transaction();

      try {
        const instance = await Block.findByPk(blockNow.number, {
          transaction,
        });
        if (!instance) {
          const block = await Block.create(
            {
              blockNumber: blockNow.number,
              hash: blockNow.hash,
              miner,
              timestamp: blockNow.timestamp,
            },
            { transaction }
          );
        } else {
          logger.error("the block exist in record, skip");
        }

        const [minerInstance, created] = await Miner.findOrCreate({
          where: {
            miner: miner as string,
          },
          defaults: {
            miner: miner as string,
          },
          transaction,
        });

        if (created) {
          logger.detail(
            `💫 miner ${miner as string} not find in record, create`
          );
        }

        let reward = Number(minerInstance.reward);
        minerInstance.reward = BigInt(
          reward +
            Number(await calculateMinerReward(miner as string, startBlock))
        );
        minerInstance.minedNumber = minerInstance.minedNumber + 1;
        minerInstance.lastBlock = blockNow.number;
        minerInstance.lastTimeStamp = Number(blockNow.timestamp);

        await minerInstance.save({ transaction });

        if (roundNumber > 0) {
          logger.detail("🌟 Miss block find, handle it");
          const prevBlockNumber = startBlock - 1;
          const prevBlock = await web3.eth.getBlock(prevBlockNumber);
          const activeLength = await stakeManager.methods
            .activeValidatorsLength()
            .call({}, prevBlockNumber);
          const array = [...Array(parseInt(activeLength)).keys()];
          let validators = array.map((item) => {
            return stakeManager.methods
              .activeValidators(item)
              .call({}, prevBlockNumber);
          });
          validators = await Promise.all(validators);
          validators = validators.map(async (item) => {
            return {
              validator: Address.fromString(item.validator),
              priority: new BN(item.priority),
              votingPower: new BN(
                await stakeManager.methods
                  .getVotingPowerByAddress(item.validator)
                  .call({}, prevBlockNumber)
              ),
            };
          });
          const activeValidators = await Promise.all(validators);
          const proposer = Address.fromString(
            await stakeManager.methods.proposer().call({}, prevBlockNumber)
          );
          const activeValidatorSet = new ActiveValidatorSet(
            activeValidators,
            proposer
          );

          for (let i = 0; i < roundNumber; i++) {
            const missMiner = activeValidatorSet.proposer.toString();
            const id = `${prevBlockNumber}-${missMiner}-${i}`;
            const missRecordInstance = await MissRecord.findByPk(id, {
              transaction,
            });
            if (!missRecordInstance) {
              const missrecord = await MissRecord.create(
                {
                  id: id,
                  blockNumber: prevBlockNumber,
                  missMiner: missMiner,
                  round: i,
                  timestamp: prevBlock.timestamp,
                },
                { transaction }
              );
            } else {
              logger.error("the missblock exist in record, skip");
            }
            activeValidatorSet.incrementProposerPriority(1);
          }
        }
        await transaction.commit();
      } catch (err) {
        await transaction.rollback();
        logger.error(err);
      }
    }
  }
}

export const start = async () => {
  _startAfterSync(async () => {
    web3.eth
      .subscribe("newBlockHeaders", async (error, result) => {})
      .on("connected", (subscriptionId) => {
        logger.detail("New block header subscribed", subscriptionId);
      })
      .on("data", async (blockHeader) => {
        headerQueue.push(blockHeader);
      })
      .on("error", function (err) {
        logger.error("Error: logs", JSON.stringify(err, null, "  "));
      });
  });
  headersLoop();
};

async function calculateMinerReward(miner: string, blockNumber: number) {
  const data = await stakeManager.methods
    .validators(miner)
    .call({}, blockNumber);
  return (
    ((BigInt(100) - BigInt(data.commissionRate)) *
      BigInt(config.rewardPerBlock)) /
    BigInt(100)
  );
}

function recoverMinerAddress(number: string, hash: string, extraData: string) {
  const decoded = rlp.decode(
    toBuffer(extraData).slice(32)
  ) as unknown as Buffer[];
  if (decoded.length < 3) {
    throw new Error("invalid rei header");
  }

  const roundAndPOLRound = decoded[1] as unknown as Buffer[];
  if (roundAndPOLRound.length < 2) {
    throw new Error("invalid round");
  }
  const round = roundAndPOLRound[0];
  const roundNumber = bufferToInt(round);
  const POLRound = roundAndPOLRound[1];

  const signature = decoded[2];
  if (signature.length !== 65) {
    throw new Error("invalid signature");
  }
  const r = signature!.slice(0, 32);
  const s = signature!.slice(32, 64);
  const v = new BN(signature!.slice(64, 65)).addn(27);

  const msgHash = rlphash([
    intToBuffer(0),
    toBuffer(number),
    round,
    POLRound,
    toBuffer(hash),
  ]);

  return [
    Address.fromPublicKey(ecrecover(msgHash, v, r, s)).toString(),
    roundNumber,
  ];
}
