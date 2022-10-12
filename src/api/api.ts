import express from "express";
import { Op } from "sequelize";
import { Miner, MissRecord, Block } from "../models";

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
      result.push({ minerMessage, minerMissRecordNumber });
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

module.exports = router;
