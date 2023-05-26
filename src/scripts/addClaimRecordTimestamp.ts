import { web3Fullnode } from "../web3/web3";
import { ClaimRecord } from "../models";

(async () => {
  const instances = await ClaimRecord.findAll({
    where: {
      timestamp: null,
    },
  });
  console.log(instances.length, "instances find Success");
  for (let i = 0; i < instances.length; i++) {
    const instance = instances[i];
    const block = await web3Fullnode.eth.getBlock(instance.startClaimBlock);
    instance.timestamp = Number(block.timestamp);
    await instance.save();
    console.log("update success", instance.unstakeId);
  }
})();
