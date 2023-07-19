import sequelize from "../db/db";
import { Model, DataTypes } from "sequelize";

export class UnfreezeRecord extends Model {}

export declare interface UnfreezeRecord {
  unfreezeId: string;
  unfreezeBlock: number;
  unfreezeBlockTimestamp: number;
  validator: string;
  decreasedAmount: bigint;
}

UnfreezeRecord.init(
  {
    unfreezeId: {
      type: DataTypes.STRING,
    },
    unfreezeBlock: {
      type: DataTypes.INTEGER,
    },
    unfreezeBlockTimestamp: {
      type: DataTypes.INTEGER,
    },
    validator: {
      type: DataTypes.STRING,
    },
    decreasedAmount: {
      type: DataTypes.DECIMAL(65, 0),
    },
  },
  {
    sequelize,
    tableName: "unfreezeRecord",
    indexes: [
      {
        fields: ["validator"],
      },
    ],
  }
);

export default UnfreezeRecord;
