import express from "express";
import { Op } from "sequelize";
import { Miner, MissRecord, Block, SlashRecord, ClaimRecord } from "../models";
import { validatorRewardPoolContract } from "../tasks/minerMonitor";

const router = express.Router();

router.get("/miner", async (req, res) => {
  try {
    const message = (req.query.miner as string).toLocaleLowerCase();
    const miner = message.split(",");
    const result = [];
    const starttimestamp = req.query.starttimestamp ?? 1661945518;
    const endtimestamp =
      req.query.endtimestamp ?? Math.round(Date.now() / 1000);
    for (let i = 0; i < miner.length; i++) {
      const minerMessage = await Miner.findOne({
        where: {
          miner: miner[i],
        },
      });
      const minerMissRecordNumber = await MissRecord.count({
        where: {
          missMiner: miner[i],
          timestamp: {
            [Op.between]: [starttimestamp, endtimestamp],
          },
        },
      });
      const minerMintedBlockNumber = await Block.count({
        where: {
          miner: miner[i],
          timestamp: {
            [Op.between]: [starttimestamp, endtimestamp],
          },
        },
      });
      result.push({
        minerMessage,
        minerMissRecordNumber,
        minerMintedBlockNumber,
      });
    }

    res.send(result);
  } catch (err) {
    res.send(err);
  }
});

router.get("/minedblocks", async (req, res) => {
  try {
    const miner = (req.query.miner as string).toLocaleLowerCase();
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const minedBlocks = await Block.findAll({
      order: [["blockNumber", "ASC"]],
      offset,
      limit,
      where: {
        miner: miner,
      },
    });
    res.json(minedBlocks);
  } catch (err) {
    res.send(err);
  }
});

router.get("/missrecords", async (req, res) => {
  try {
    const miner = (req.query.miner as string).toLocaleLowerCase();
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const missRecords = await MissRecord.findAll({
      order: [["blockNumber", "ASC"]],
      offset,
      limit,
      where: {
        missMiner: miner,
      },
    });
    res.json(missRecords);
  } catch (err) {
    res.send(err);
  }
});

router.get("/slashRecords", async (req, res) => {
  try {
    const miner = (req.query.miner as string).toLocaleLowerCase();
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const slashRecords = await SlashRecord.findAll({
      order: [["duplicateVoteHeight", "ASC"]],
      offset,
      limit,
      where: {
        validator: miner,
      },
    });
    res.json(slashRecords);
  } catch (err) {
    res.send(err);
  }
});

router.get("/minersReward", async (req, res) => {
  try {
    const miners = await Miner.findAll();
    const result = [];
    for (let i = 0; i < miners.length; i++) {
      const unclaimedReward = BigInt(
        await validatorRewardPoolContract.methods
          .balanceOf(miners[i].miner)
          .call()
      );
      const claimedReward = BigInt(miners[i].claimedReward);
      const claimedRecords = ClaimRecord.findAll({
        where: {
          validator: miners[i].miner,
        },
      });
      result.push({
        miner: miners[i].miner,
        unclaimedReward: unclaimedReward,
        claimedReward: claimedReward,
        claimedRecords: claimedRecords,
      });
    }
    res.json(result);
  } catch (err) {
    res.send(err);
  }
});

module.exports = router;
