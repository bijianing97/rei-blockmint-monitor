import sequelize from "../db/db";
import { Model, DataTypes } from "sequelize";

export class Block extends Model {}

export declare interface Block {
  blockNumber: number;
  hash: string;
  miner: string;
  timestamp: number;
}

Block.init(
  {
    blockNumber: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      unique: true,
    },
    hash: {
      type: DataTypes.STRING,
    },
    miner: {
      type: DataTypes.STRING,
    },
    timestamp: {
      type: DataTypes.INTEGER,
    },
  },
  {
    sequelize,
    tableName: "block",
  }
);

export default Block;
