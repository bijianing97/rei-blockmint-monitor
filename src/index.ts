import { logger } from "./logger/logger";
import fs from "fs";
import { init } from "./db/db";
import * as minerMonitor from "./tasks/minerMonitor";
import * as api from "./api";

const outputDir = "./output";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}
startTask();

function startTask() {
  logger.info("Starting rei block miner monitor");
  init().then(() => {
    minerMonitor.start();
    api.start();
    startProcessListener();
  });
}

function stopTask() {
  logger.info("Saving relay status");
  // stake_task.saveState();
}

function exitHandler(options: any, exitCode: any) {
  if (options.cleanup) {
    stopTask();
  }
  if (exitCode || exitCode === 0) {
    logger.warn("exit with code", exitCode);
  }
  if (options.exit) {
    logger.warn("exiting...");
    process.exit();
  }
}

function startProcessListener() {
  process.stdin.resume();
  //do something when app is closing
  process.on("exit", exitHandler.bind(null, { cleanup: true }));

  //catches ctrl+c event
  process.on("SIGINT", exitHandler.bind(null, { exit: true }));

  // catches "kill pid" (for example: nodemon restart)
  process.on("SIGUSR1", exitHandler.bind(null, { exit: true }));
  process.on("SIGUSR2", exitHandler.bind(null, { exit: true }));

  //catches uncaught exceptions
  process.on("uncaughtException", exitHandler.bind(null, { exit: true }));
}
