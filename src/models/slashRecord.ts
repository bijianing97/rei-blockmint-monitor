import sequelize from "../db/db";
import { Model, DataTypes } from "sequelize";

export class SlashRecord extends Model {}

export type voteJson = {
  chainId: number;
  type: number;
  height: number;
  round: number;
  hash: string;
  index: number;
  signature: string;
};

export declare interface SlashRecord {
  slashBlockHeight: number;
  duplicateVoteHeight: number;
  slashBlockTimestamp: number;
  reason: string;
  validator: string;
  slashAmount: bigint;
  voteAJson: voteJson;
  voteBJson: voteJson;
}

SlashRecord.init(
  {
    slashBlockHeight: {
      type: DataTypes.INTEGER,
    },
    duplicateVoteHeight: {
      type: DataTypes.INTEGER,
    },
    reason: {
      type: DataTypes.STRING,
    },
    validator: {
      type: DataTypes.STRING,
    },
    slashBlockTimestamp: {
      type: DataTypes.INTEGER,
    },
    slashAmount: {
      type: DataTypes.DECIMAL(65, 0),
    },
    voteAJson: {
      type: DataTypes.JSONB,
    },
    voteBJson: {
      type: DataTypes.JSONB,
    },
  },
  {
    sequelize,
    tableName: "slashRecord",
    indexes: [
      {
        fields: ["validator"],
      },
    ],
  }
);

export default SlashRecord;
