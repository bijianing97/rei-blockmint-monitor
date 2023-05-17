import sequelize from "../db/db";
import { Model, DataTypes } from "sequelize";

export class Miner extends Model {}

export declare interface Miner {
  miner: string;
  minedNumber: number;
  lastBlock: number;
  lastTimeStamp: number;
  allReward: bigint;
  claimedReward: bigint;
}

Miner.init(
  {
    miner: {
      type: DataTypes.STRING,
      primaryKey: true,
      unique: true,
    },
    minedNumber: {
      type: DataTypes.INTEGER,
    },
    lastBlock: {
      type: DataTypes.INTEGER,
    },
    lastTimeStamp: {
      type: DataTypes.INTEGER,
    },
    allReward: {
      type: DataTypes.DECIMAL(65, 0),
    },
    claimedReward: {
      type: DataTypes.DECIMAL(65, 0),
    },
  },
  {
    sequelize,
    tableName: "miner",
  }
);

export default Miner;
