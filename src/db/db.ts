import { logger } from "../logger/logger";
import { Sequelize } from "sequelize";
import * as dotenv from "dotenv";
import { migrate } from "../migrations/index";

dotenv.config();

const sequelize = new Sequelize(process.env.data_connection!, {
  logging: false,
  // logging: (msg) => logger.info(msg),
});

export default sequelize;

export async function init() {
  await sequelize.authenticate();
  await sequelize.sync();
  // await migrate();
}
