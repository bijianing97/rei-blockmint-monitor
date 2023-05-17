import sequelize from "../db/db";
import { Model, DataTypes } from "sequelize";

export class ClaimRecord extends Model {}

export declare interface ClaimRecord {
  unstakeId: number;
  vilidator: string;
  to: string;
  claimValue: bigint;
  startClaimBlock: number;
  ifUnstaked: boolean;
  unstakeBlock: number;
  unstakeValue: bigint;
}

ClaimRecord.init(
  {
    unstakeId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      unique: true,
    },
    vilidator: {
      type: DataTypes.STRING,
    },
    to: {
      type: DataTypes.STRING,
    },
    claimValue: {
      type: DataTypes.DECIMAL(65, 0),
    },
    startClaimBlock: {
      type: DataTypes.INTEGER,
    },
    ifUnstaked: {
      type: DataTypes.BOOLEAN,
    },
    unstakeBlock: {
      type: DataTypes.INTEGER,
    },
    unstakeValue: {
      type: DataTypes.DECIMAL(65, 0),
    },
  },
  {
    sequelize,
    tableName: "claimRecord",
  }
);

export default ClaimRecord;
