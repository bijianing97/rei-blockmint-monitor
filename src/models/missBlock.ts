import sequelize from "../db/db";
import { Model, DataTypes } from "sequelize";

export class MissRecord extends Model {}

export declare interface MissRecord {
  id: string;
  blockNumber: number;
  missMiner: string;
  round: number;
  timestamp: number;
}

MissRecord.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      unique: true,
    },
    blockNumber: {
      type: DataTypes.INTEGER,
    },
    missMiner: {
      type: DataTypes.STRING,
    },
    round: {
      type: DataTypes.INTEGER,
    },
    timestamp: {
      type: DataTypes.INTEGER,
    },
  },
  {
    sequelize,
    tableName: "missrecord",
  }
);

export default MissRecord;
