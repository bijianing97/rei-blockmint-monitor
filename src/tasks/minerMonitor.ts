import axios from "axios";
import { web3, web3Fullnode } from "../web3/web3";
import { logger } from "../logger/logger";
import {
  config,
  genesisValidators,
  hardforkBlock1,
  initBlock1,
} from "../config/config";
import { BlockHeader } from "web3-eth";
import {
  Block,
  Miner,
  MissRecord,
  SlashRecord,
  voteJson,
  BlockTempRecord,
  ClaimRecord,
  BlockProcessing,
} from "../models";
import { stakeManager, decodeLog } from "../abis/stakeManager";
import { validatorRewardPool } from "../abis/validatorRewardPool";
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
import { Limited } from "@samlior/utils";

const initBlock = initBlock1;

let startBlock = initBlock;
let startBlockForClaim = initBlock;
const startUnstakeTopic =
  "0x020b3ba91672f551cfd1f7abf4794b3fb292f61fd70ffd5a34a60cdd04078e50";
const doUnstakeTopic =
  "0xee024e97ab82d1d6d3f25a83eac80c06c0c9dd121d6c256814510292ed4e6871";
const startClaim = "0xb5924100";
const unstake = "0x2e17de78";

let indexedValidatorsLengthLastAlarm = 0;

const stakeManagerContract = new web3.eth.Contract(
  stakeManager as any,
  config.config_address
);

const validatorRewardPoolContract = new web3Fullnode.eth.Contract(
  validatorRewardPool as any,
  config.rewardPool_address
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
const headerQueueForClaim = new Queue<BlockHeader>();
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
  const message = `## IndexValidatorsLength Alarm : \n > * ValidatorsLength : ${
    validatorsLength - 5
  } \n > * BlockNumber : ${blockNumber} \n > * Timestamp : ${timestamp} \n The alarm has been triggered, please check it ❗❗❗`;
  const result = await axios.post(process.env.url, {
    msgtype: "markdown",
    markdown: {
      title: "BlockMonitor",
      text: "❗❗❗IndexValidatorsLength Alarm " + message,
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

async function recoverForClaim() {
  const unTouched = 2000000000000000;
  logger.detail("🧵 Start read state and Recover for claim");
  const blockNow = await web3.eth.getBlock("latest");
  headerQueueForClaim.push(blockNow);
  const blockTempRecord = await BlockTempRecord.findOne();
  if (!blockTempRecord) {
    const transaction = await sequelize.transaction();
    await BlockTempRecord.create(
      {
        id: 1,
        blockNumber: initBlock,
      },
      { transaction }
    );
    await transaction.commit();
  }
  const blockProcessing = await BlockProcessing.findOne({
    order: [["blockNumber", "ASC"]],
  });

  const recordNumber = blockTempRecord
    ? blockTempRecord.blockNumber
    : unTouched;
  const processingNumber = blockProcessing
    ? blockProcessing.blockNumber
    : unTouched;
  let minNumber = Math.min(recordNumber, processingNumber);
  if (minNumber === unTouched) {
    minNumber = initBlock - 1;
  }
  startBlockForClaim = minNumber + 1;
  logger.detail(`🧵 Push ${blockNow.number}into claim queue, Recover done`);
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

async function doClaim(blockNumberNow: number) {
  const transaction = await sequelize.transaction();
  try {
    const [processingRecord, _] = await BlockProcessing.findOrCreate({
      where: {
        blockNumber: blockNumberNow,
      },
      defaults: {
        blockNumber: blockNumberNow,
      },
    });
    logger.detail(`🪫 claim Handle block number is : ${blockNumberNow}`);
    const blockNow = await web3Fullnode.eth.getBlock(blockNumberNow);
    const [miner, roundNumber, evidence] = recoverMinerAddress(
      intToHex(blockNow.number),
      blockNow.hash,
      blockNow.extraData
    );

    const transactions = blockNow.transactions;
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
        `for cliamed 💫 miner ${miner as string} not find in record, create`
      );
    }

    const unClaimedReward = await validatorRewardPoolContract.methods
      .balanceOf(miner as string)
      .call({}, blockNumberNow);
    minerInstance.unClaimedReward = BigInt(unClaimedReward);
    await minerInstance.save({ transaction });

    for (let i = 0; i < transactions.length; i++) {
      const tx = await web3Fullnode.eth.getTransaction(transactions[i]);
      if (
        tx.to === config.config_address &&
        tx.input.slice(0, 10) === startClaim
      ) {
        logger.detail(`🪶 Handle claim tx hash is : ${tx.hash}`);
        const receipt = await web3Fullnode.eth.getTransactionReceipt(tx.hash);
        const logs = receipt.logs;
        const startUnstakeLog = logs.filter(
          (log) => log.topics[0] === startUnstakeTopic
        );
        for (let j = 0; j < startUnstakeLog.length; j++) {
          const params = decodeLog(
            "StartUnstake",
            startUnstakeLog[j].data,
            startUnstakeLog[j].topics.slice(1)
          );

          let oped = false;
          const instance = await ClaimRecord.findByPk(Number(params.id), {
            transaction,
          });
          if (!instance) {
            const claimed = await ClaimRecord.create(
              {
                unstakeId: Number(params.id),
                validator: params.validator,
                to: params.to,
                claimValue: BigInt(params.value),
                startClaimBlock: blockNumberNow,
                ifUnstaked: false,
                ifClaimed: true,
              },
              { transaction }
            );
          } else {
            if (instance.ifClaimed == true) {
              oped = true;
            } else {
              instance.ifClaimed = true;
              instance.startClaimBlock = blockNumberNow;
              instance.claimValue = BigInt(params.value);
            }
            await instance.save({ transaction });
          }
          if (!oped) {
            const minerInstance = await Miner.findOne({
              where: {
                miner: (params.validator as string).toLowerCase(),
              },
              transaction,
            });
            if (minerInstance) {
              minerInstance.claimedReward =
                BigInt(minerInstance.claimedReward) + BigInt(params.value);
              const unClaimedReward = await validatorRewardPoolContract.methods
                .balanceOf(params.validator as string)
                .call({}, blockNumberNow);
              minerInstance.unClaimedReward = BigInt(unClaimedReward);
              await minerInstance.save({ transaction });
            } else {
              logger.error("minerInstance not exist");
            }
          }
        }
      }
      if (
        tx.to === config.config_address &&
        tx.input.slice(0, 10) === unstake
      ) {
        logger.detail(`🦭 Handle unstake tx hash is : ${tx.hash}`);
        const receipt = await web3Fullnode.eth.getTransactionReceipt(tx.hash);
        const logs = receipt.logs;
        const startUnstakeLog = logs.filter(
          (log) => log.topics[0] === doUnstakeTopic
        );
        for (let k = 0; k < startUnstakeLog.length; k++) {
          const params = decodeLog(
            "DoUnstake",
            startUnstakeLog[k].data,
            startUnstakeLog[k].topics.slice(1)
          );

          const [instance, created] = await ClaimRecord.findOrCreate({
            where: {
              unstakeId: Number(params.id),
            },
            defaults: {
              unstakeId: Number(params.id),
            },
            transaction,
          });

          instance.ifUnstaked = true;
          instance.to = params.to;
          instance.validator = params.validator.toLowerCase();
          instance.unstakeBlock = blockNumberNow;
          instance.unstakeValue = BigInt(params.value);
          await instance.save({ transaction });
        }
      }
    }
    await BlockTempRecord.update(
      { blockNumber: blockNumberNow },
      {
        where: {
          id: 1,
          blockNumber: {
            [Op.lt]: blockNumberNow,
          },
        },
        transaction,
      }
    );
    await processingRecord.destroy({ transaction });
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    logger.error(err);
  }
  logger.detail(`🪫 block number  : ${blockNumberNow} Finished claim Handle`);
}

async function claimHeadesLoop1() {
  const limited = new Limited(20, 10000);
  await recoverForClaim();
  logger.detail(" start claimHeadesLoop");
  while (true) {
    let header = headerQueueForClaim.pop();
    if (!header) {
      header = await new Promise<BlockHeader>((resolve) => {
        headerQueueForClaim.queueResolve = resolve;
      });
    }
    while (startBlockForClaim <= header.number) {
      const { getToken, request } = await limited.get();
      const token = await getToken;
      doClaim(startBlockForClaim++)
        .catch((e) => console.log("error:", e))
        .finally(() => limited.put(token));
    }
  }
}

async function claimHeadesLoop() {
  await recoverForClaim();
  logger.detail(" start claimHeadesLoop");

  while (true) {
    let header = headerQueueForClaim.pop();
    if (!header) {
      header = await new Promise<BlockHeader>((resolve) => {
        headerQueueForClaim.queueResolve = resolve;
      });
    }
    for (
      startBlockForClaim;
      startBlockForClaim <= header.number;
      startBlockForClaim++
    ) {
      logger.detail(`🪫 claim Handle block number is : ${startBlockForClaim}`);
      const blockNow = await web3Fullnode.eth.getBlock(startBlockForClaim);
      const [miner, roundNumber, evidence] = recoverMinerAddress(
        intToHex(blockNow.number),
        blockNow.hash,
        blockNow.extraData
      );
      const transaction = await sequelize.transaction();

      try {
        const transactions = blockNow.transactions;
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
            `for cliamed 💫 miner ${miner as string} not find in record, create`
          );
        }

        const unClaimedReward = await validatorRewardPoolContract.methods
          .balanceOf(miner as string)
          .call({}, startBlockForClaim);
        minerInstance.unClaimedReward = BigInt(unClaimedReward);
        await minerInstance.save({ transaction });

        for (let i = 0; i < transactions.length; i++) {
          const tx = await web3Fullnode.eth.getTransaction(transactions[i]);
          if (
            tx.to === config.config_address &&
            tx.input.slice(0, 10) === startClaim
          ) {
            logger.detail(`🪶 Handle claim tx hash is : ${tx.hash}`);
            const receipt = await web3Fullnode.eth.getTransactionReceipt(
              tx.hash
            );
            const logs = receipt.logs;
            const startUnstakeLog = logs.filter(
              (log) => log.topics[0] === startUnstakeTopic
            );
            for (let j = 0; j < startUnstakeLog.length; j++) {
              const params = decodeLog(
                "StartUnstake",
                startUnstakeLog[j].data,
                startUnstakeLog[j].topics.slice(1)
              );
              const instance = await ClaimRecord.findByPk(Number(params.id), {
                transaction,
              });
              if (!instance) {
                const claimed = await ClaimRecord.create(
                  {
                    unstakeId: Number(params.id),
                    validator: params.validator,
                    to: params.to,
                    claimValue: params.value,
                    startClaimBlock: startBlockForClaim,
                    ifUnstaked: false,
                  },
                  { transaction }
                );

                const minerInstance = await Miner.findOne({
                  where: {
                    miner: (params.validator as string).toLowerCase(),
                  },
                  transaction,
                });

                if (minerInstance) {
                  minerInstance.claimedReward =
                    BigInt(minerInstance.claimedReward) + BigInt(params.value);
                  const unClaimedReward =
                    await validatorRewardPoolContract.methods
                      .balanceOf(params.validator as string)
                      .call({}, startBlockForClaim);
                  minerInstance.unClaimedReward = BigInt(unClaimedReward);
                  await minerInstance.save({ transaction });
                } else {
                  logger.error("minerInstance not exist");
                }
              } else {
                logger.error("the claimRecord exist in record, skip");
              }
            }
          }
          if (
            tx.to === config.config_address &&
            tx.input.slice(0, 10) === unstake
          ) {
            logger.detail(`🦭 Handle unstake tx hash is : ${tx.hash}`);
            const receipt = await web3Fullnode.eth.getTransactionReceipt(
              tx.hash
            );
            const logs = receipt.logs;
            const startUnstakeLog = logs.filter(
              (log) => log.topics[0] === doUnstakeTopic
            );
            for (let k = 0; k < startUnstakeLog.length; k++) {
              const params = decodeLog(
                "DoUnstake",
                startUnstakeLog[k].data,
                startUnstakeLog[k].topics.slice(1)
              );
              const instance = await ClaimRecord.findByPk(Number(params.id), {
                transaction,
              });
              if (instance) {
                instance.ifUnstaked = true;
                instance.unstakeBlock = startBlockForClaim;
                instance.unstakeValue = BigInt(params.value);
                await instance.save({ transaction });
              } else {
                logger.error("the claimRecord not exist in record, skip");
              }
            }
          }
        }
        const [blockTempRecord, blockTempRecordCreated] =
          await BlockTempRecord.findOrCreate({
            where: {
              id: 1,
            },
            defaults: {
              id: 1,
            },
            transaction,
          });
        blockTempRecord.blockNumber = startBlockForClaim;
        await blockTempRecord.save({ transaction });
        await transaction.commit();
      } catch (err) {
        await transaction.rollback();
        logger.error(err);
      }
    }
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

        // let reward = Number(minerInstance.reward);
        // minerInstance.reward = BigInt(
        //   reward +
        //     Number(await calculateMinerReward(miner as string, startBlock))
        // );
        minerInstance.minedNumber = minerInstance.minedNumber + 1;
        minerInstance.lastBlock = blockNow.number;
        minerInstance.lastTimeStamp = Number(blockNow.timestamp);

        await minerInstance.save({ transaction });

        if ((roundNumber as number) > 0) {
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

          for (let i = 0; i < (roundNumber as number); i++) {
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
        validator.nodeName as string
      );
    }
  } catch (err) {
    logger.error(`setValidators error ${err}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await setValidators();
  }
}

export const start = async () => {
  logger.info("🚀 Try to get Validatars");
  await setValidators();
  _startAfterSync(async () => {
    web3.eth
      .subscribe("newBlockHeaders", async (error, result) => {})
      .on("connected", (subscriptionId) => {
        logger.detail("New block header subscribed", subscriptionId);
      })
      .on("data", async (blockHeader) => {
        headerQueue.push(blockHeader);
        headerQueueForClaim.push(blockHeader);
      })
      .on("error", function (err) {
        logger.error("Error: logs", JSON.stringify(err, null, "  "));
      });
  });
  headersLoop();
  claimHeadesLoop1();
};

// async function calculateMinerReward(miner: string, blockNumber: number) {
//   const data = await stakeManagerContract.methods
//     .validators(miner)
//     .call({}, blockNumber);
//   return (
//     ((BigInt(100) - BigInt(data.commissionRate)) *
//       BigInt(config.rewardPerBlock)) /
//     BigInt(100)
//   );
// }

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
