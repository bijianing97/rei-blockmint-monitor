import fs from "fs";
import path from "path";
import { logger } from "../logger/logger";

function travel(dir: string) {
  let files = [];
  fs.readdirSync(dir).forEach((file) => {
    const pathname = path.join(dir, file);
    if (fs.statSync(pathname).isDirectory()) {
      files = files.concat(travel(pathname));
    } else {
      files.push(pathname);
    }
  });
  return files;
}

export const migrate = async () => {
  const models = travel(path.resolve(__dirname, "../models"));
  for (const m of models) {
    const model = require(m).default;
    logger.detail("Syncing model: " + m);
    const result = await model.sync({ alter: true });
    logger.detail("syncing finished: " + result);
  }
};

(async () => {
  await migrate();
})();
