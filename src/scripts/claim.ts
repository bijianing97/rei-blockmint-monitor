import { web3Fullnode } from "../web3/web3";
import { initBlock1 } from "../config/config";
import { validatorRewardPool } from "../abis/validatorRewardPool";
import { config } from "../config/config";
import { Limited } from "@samlior/utils";

let startBlock = initBlock1;
const endBlock = initBlock1 + 100000;

async function test(blockNumber: number) {
  startBlock++;
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log(blockNumber);
}

(async () => {
  // const address = "0xf06313d8B2aCc5C5090dDD9B2F0D7bf66Ea4Fa85";
  // const bigOne = "0x82a7cDE29f421aB6fD6557450f0659a24BAc81aF";
  // const validatorRewardPoolContract = new web3Fullnode.eth.Contract(
  //   validatorRewardPool as any,
  //   config.rewardPool_address
  // );
  // const balance = await validatorRewardPoolContract.methods
  //   .balanceOf(bigOne)
  //   .call({});
  // console.log(typeof balance);
  // console.log(BigInt(balance));
  // console.log("0xf06313d8B2aCc5C5090dDD9B2F0D7bf66Ea4Fa85".toLowerCase());

  const limited = new Limited(5, 10000);
  while (startBlock < endBlock) {
    const { getToken, request } = await limited.get();
    const token = await getToken;
    // (1 as any).on("close", () => {
    //   limited.cancel(request);
    // }); // client 则不再等待
    // const token = await getToken.catch((e) => {
    //   if (e === "abort") {
    //     return false;
    //   }
    // });
    test(startBlock)
      .catch((e) => console.log("error:", e))
      .finally(() => limited.put(token));
  }
})();
