import { web3 } from "../web3/web3";
import { logger } from "../logger/logger";
import { config } from "../config/config";
import { MissRecord } from "../models";

(async () => {
  const instances = await MissRecord.findAll({
    where: {
      timestamp: null,
    },
  });
  console.log(instances.length, "instances find Success");
  for (let i = 0; i < instances.length; i++) {
    const instance = instances[i];
    const block = await web3.eth.getBlock(instance.blockNumber);
    instance.timestamp = Number(block.timestamp);
    await instance.save();
    console.log("update success", instance.id);
  }
})();
