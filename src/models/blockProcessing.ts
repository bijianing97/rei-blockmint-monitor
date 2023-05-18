import sequelize from "../db/db";
import { Model, DataTypes } from "sequelize";

export class BlockProcessing extends Model {}

export declare interface BlockProcessing {
  blockNumber: number;
}

BlockProcessing.init(
  {
    blockNumber: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      unique: true,
    },
  },
  {
    sequelize,
    tableName: "blockProcessing",
  }
);

export default BlockProcessing;
