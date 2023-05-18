import sequelize from "../db/db";
import { Model, DataTypes } from "sequelize";

export class BlockTempRecord extends Model {}

export declare interface BlockTempRecord {
  blockNumber: number;
}

BlockTempRecord.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      unique: true,
    },
    blockNumber: {
      type: DataTypes.INTEGER,
    },
  },
  {
    sequelize,
    tableName: "blockTempRecord",
  }
);

export default BlockTempRecord;
