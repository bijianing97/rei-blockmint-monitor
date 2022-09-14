import express from "express";
import { logger } from "../logger/logger";
import * as dotenv from "dotenv";

dotenv.config();

export const start = () => {
  const app = express();
  const port = parseInt(process.env.port || "3000");
  const localhost = "127.0.0.1";

  app.all("*", function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
    res.header("X-Powered-By", " 3.2.1");
    res.header("Content-Type", "application/json;charset=utf-8");
    next();
  });

  app.use("/api", require("./api"));

  app.listen(port, localhost, () => {
    logger.detail(`💡 Api Server running at http://${localhost}:${port}/`);
  });
};
