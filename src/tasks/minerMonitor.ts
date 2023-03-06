import axios from "axios";
import * as dotenv from "dotenv";
import { web3 } from "../web3/web3";
import { logger } from "../logger/logger";
import {
  config,
  genesisValidators,
  hardforkBlock1,
  initBlock1,
} from "../config/config";
import { BlockHeader } from "web3-eth";
import { Block, Miner, MissRecord, SlashRecord, voteJson } from "../models";
import { stakeManager } from "../abis/stakeManager";
import { ActiveValidatorSet } from "@rei-network/core/dist/consensus/reimint/validatorSet";
import { Vote } from "@rei-network/core/dist/consensus/reimint/vote";
import { validatorsDecode } from "@rei-network/core/dist/consensus/reimint/contracts/utils";
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
import { Op } from "sequelize";

const initBlock = initBlock1;

let startBlock = initBlock;

let indexedValidatorsLengthLastAlarm = 0;

const stakeManagerContract = new web3.eth.Contract(
  stakeManager as any,
  config.config_address
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
const messageInterval = 30 * 60;
const messageMap = new Map<string, number>();
const validatorsMap = new Map<string, string>();
const validatorsUrl =
  "https://dao.rei.network/data/validator/validator-list.json";

async function _sendMessage(
  miner: string,
  missBlockNumber: number,
  lastBlockMinted: number,
  missCountLast24h: number,
  missCountLast1h: number
) {
  const nodename = validatorsMap.get(miner) ?? "unknown name";
  const message = `## MissBlock : \n > * Address : ${miner} \n > * Nodename : ${nodename} \n > * MissBlockNumber : ${missBlockNumber} \n > * MissCountLast24h : ${missCountLast24h} \n> * missCountLast1h : ${missCountLast1h} \n > * LastBlockMinted : ${lastBlockMinted} \n > * [View in ReiDAO](https://dao.rei.network/#/stake/validator?id=${miner}) \n
  This node missed 100 blocks last 24 hours, please check it.`;

  const result = await axios.post(process.env.url, {
    msgtype: "markdown",
    markdown: {
      title: "BlockMonitor",
      text: message,
    },
  });
}

async function sendIndexValidatorsLengthAlarm(
  validatorsLength: number,
  blockNumber: number,
  timestamp: number
) {
  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > 60 * 60 * 2) {
    return;
  }
  if (timestamp - indexedValidatorsLengthLastAlarm <= messageInterval) {
    return;
  }
  indexedValidatorsLengthLastAlarm = timestamp;
  const message = `## IndexValidatorsLength Alarm : \n > * ValidatorsLength : ${validatorsLength} \n > * BlockNumber : ${blockNumber} \n > * Timestamp : ${timestamp} \n The alarm has been triggered, please check it ❗❗❗`;
  const result = await axios.post(process.env.url, {
    msgtype: "markdown",
    markdown: {
      title: "❗❗❗IndexValidatorsLength Alarm",
      text: message,
    },
  });
}

async function sendMessage(
  miner: string,
  timestamp: number,
  missBlockNumber: number,
  lastBlockMinted: number,
  missCountLast24h: number,
  missCountLast1h: number
) {
  const now = Math.floor(Date.now() / 1000);
  // history message, not emit
  if (now - timestamp > 60 * 60 * 2) {
    return;
  }
  if (!messageMap.has(miner)) {
    messageMap.set(miner, timestamp);
    _sendMessage(
      miner,
      missBlockNumber,
      lastBlockMinted,
      missCountLast24h,
      missCountLast1h
    );
  } else {
    const lastMessage = messageMap.get(miner);
    if (lastMessage && timestamp - lastMessage > messageInterval) {
      messageMap.set(miner, timestamp);
      _sendMessage(
        miner,
        missBlockNumber,
        lastBlockMinted,
        missCountLast24h,
        missCountLast1h
      );
    }
  }
}

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
      const [miner, roundNumber, evidence] = recoverMinerAddress(
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
          let activeValidators = [];
          if (startBlock > hardforkBlock1) {
            const validatorInfo = await stakeManagerContract.methods
              .getActiveValidatorInfos()
              .call({}, prevBlockNumber);
            const { ids, priorities } = validatorsDecode(
              toBuffer(validatorInfo)
            );
            const validators = ids.map(async (id, index) => {
              const validator = id.ltn(genesisValidators.length)
                ? genesisValidators[id.toNumber()]
                : await stakeManagerContract.methods
                    .indexedValidatorsById(id.toString())
                    .call({}, prevBlockNumber);
              return {
                validator: Address.fromString(validator),
                priority: priorities[index],
                votingPower: new BN(
                  await stakeManagerContract.methods
                    .getVotingPowerByAddress(validator)
                    .call({}, prevBlockNumber)
                ),
              };
            });
            activeValidators = await Promise.all(validators);
          } else {
            const activeLength = await stakeManagerContract.methods
              .activeValidatorsLength()
              .call({}, prevBlockNumber);
            const array = [...Array(parseInt(activeLength)).keys()];
            let validators = array.map((item) => {
              return stakeManagerContract.methods
                .activeValidators(item)
                .call({}, prevBlockNumber);
            });
            validators = await Promise.all(validators);
            validators = validators.map(async (item) => {
              return {
                validator: Address.fromString(item.validator),
                priority: new BN(item.priority),
                votingPower: new BN(
                  await stakeManagerContract.methods
                    .getVotingPowerByAddress(item.validator)
                    .call({}, prevBlockNumber)
                ),
              };
            });
            activeValidators = await Promise.all(validators);
          }
          const proposer = Address.fromString(
            await stakeManagerContract.methods
              .proposer()
              .call({}, prevBlockNumber)
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
            // check if need send message
            const missblocksLast24h = await MissRecord.count({
              where: {
                missMiner: missMiner,
                timestamp: {
                  [Op.between]: [
                    Number(prevBlock.timestamp) - 24 * 60 * 60,
                    prevBlock.timestamp,
                  ],
                },
              },
            });
            if (missblocksLast24h >= 100) {
              const lastMintedBlock = await Block.findOne({
                where: {
                  miner: missMiner,
                },
                order: [["blockNumber", "DESC"]],
              });
              const missblocksLast1h = await MissRecord.count({
                where: {
                  missMiner: missMiner,
                  timestamp: {
                    [Op.between]: [
                      Number(prevBlock.timestamp) - 60 * 60,
                      prevBlock.timestamp,
                    ],
                  },
                },
              });
              logger.info(
                "📣 node lose block more than 100 in 24h, send message"
              );
              sendMessage(
                missMiner,
                Number(prevBlock.timestamp),
                prevBlock.number,
                lastMintedBlock ? lastMintedBlock.blockNumber : -1,
                missblocksLast24h,
                missblocksLast1h
              );
            }
            activeValidatorSet.incrementProposerPriority(1);
          }
        }
        if ((evidence as Buffer[]).length > 0) {
          const evidenceBufferArray = evidence as Buffer[];
          logger.detail(
            "🔍 Evidence find, handle it, BlockNumber is:",
            blockNow.number
          );
          for (let i = 0; i < evidenceBufferArray.length; i++) {
            const code = bufferToInt(
              evidenceBufferArray[i][0] as unknown as Buffer
            );
            const reason = code == 0 ? "DuplicateVote" : "unKnown";
            const voteA = Vote.fromValuesArray(evidenceBufferArray[i][1][0]);
            const voteB = Vote.fromValuesArray(evidenceBufferArray[i][1][1]);
            const validatorAddress = voteA.validator().toString();
            const votingPowerBeforeSlash = await stakeManagerContract.methods
              .getVotingPowerByAddress(validatorAddress)
              .call({}, blockNow.number - 1);
            const votingPowerAfterSlash = await stakeManagerContract.methods
              .getVotingPowerByAddress(validatorAddress)
              .call({}, blockNow.number);
            const slashAmount =
              BigInt(votingPowerBeforeSlash) - BigInt(votingPowerAfterSlash);
            const jsonA: voteJson = {
              chainId: voteA.chainId,
              type: voteA.type,
              height: voteA.height.toNumber(),
              round: voteA.round,
              hash: "0x" + voteA.hash.toString("hex"),
              index: voteA.index,
              signature: "0x" + voteA.signature.toString("hex"),
            };
            const jsonB: voteJson = {
              chainId: voteB.chainId,
              type: voteB.type,
              height: voteB.height.toNumber(),
              round: voteB.round,
              hash: "0x" + voteB.hash.toString("hex"),
              index: voteB.index,
              signature: "0x" + voteB.signature.toString("hex"),
            };
            const slashRecord = await SlashRecord.create({
              slashBlockHeight: blockNow.number,
              duplicateVoteHeight: voteA.height.toNumber(),
              slashBlockTimestamp: blockNow.timestamp,
              reason: reason,
              validator: validatorAddress,
              slashAmount: slashAmount,
              voteAJson: jsonA,
              voteBJson: jsonB,
            });
            slashRecord.save({ transaction });
          }
        }
        const indexValidatorLength = Number(
          await stakeManagerContract.methods
            .indexedValidatorsLength()
            .call({}, blockNow.number)
        );
        if (indexValidatorLength - 5 <= 22) {
          logger.info("🛎️ IndexValidatorsLength is low, send alarm message!");
          sendIndexValidatorsLengthAlarm(
            indexValidatorLength,
            blockNow.number,
            Number(blockNow.timestamp)
          );
        }
        await transaction.commit();
      } catch (err) {
        await transaction.rollback();
        logger.error(err);
      }
    }
  }
}

async function setValidators() {
  try {
    const validators = (await axios.get(validatorsUrl)).data.data;
    for (const validator of validators) {
      validatorsMap.set(
        (validator.nodeAddress as string).toLowerCase(),
        validator.nodeName
      );
    }
  } catch (err) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setValidators();
  }
}

export const start = async () => {
  await setValidators();
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
  const data = await stakeManagerContract.methods
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
  const evidence = decoded[0] as unknown as Buffer[];
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
    evidence,
  ];
}
