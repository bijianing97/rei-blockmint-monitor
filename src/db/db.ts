import { logger } from "../logger/logger";
import { Sequelize } from "sequelize";
import * as dotenv from "dotenv";

dotenv.config();

const sequelize = new Sequelize(process.env.data_connection!, {
  logging: (msg) => logger.info(msg),
});

export default sequelize;

export async function init() {
  await sequelize.authenticate();
  await sequelize.sync();
}
