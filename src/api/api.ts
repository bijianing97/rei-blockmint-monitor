import express from "express";
import { Miner, MissRecord, Block } from "../models";

const router = express.Router();

router.get("/miner", async (req, res) => {
  try {
    const miner = req.query.miner;
    const minerMessage = await Miner.findOne({
      where: {
        miner: miner,
      },
    });
    const minerMissRecordNumber = await MissRecord.count({
      where: {
        missMiner: miner,
      },
    });
    res.json({ minerMessage, minerMissRecordNumber });
  } catch (err) {
    res.send(err);
  }
});

router.get("/minedblocks", async (req, res) => {
  try {
    const miner = req.query.miner;
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
    const miner = req.query.miner;
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
    res.send({ missRecords });
  } catch (err) {
    res.send(err);
  }
});

module.exports = router;
