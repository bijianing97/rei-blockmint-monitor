import Web3 from "web3";
import { logger } from "@rei-network/utils";
import { stakeManager } from "./abis/stakeManager";
import axios from "axios";
import { toBuffer } from "ethereumjs-util";
import {
  decodeBytes,
  validatorsDecode,
} from "@rei-network/core/dist/consensus/reimint/contracts/utils";

const provider = "wss://rpc-testnet.rei.network";

const options = {
  timeout: 30000, // ms
  clientConfig: {
    keepalive: true,
    keepaliveInterval: 60000, // ms
  },
  // Enable auto reconnection
  reconnect: {
    auto: true,
    delay: 5000, // ms
    maxAttempts: 500,
    onTimeout: false,
  },
};

const wsProvider = new Web3.providers.WebsocketProvider(provider, options);

wsProvider.on("connect", async () => {
  logger.info("Connected to websocket provider", provider);
});

wsProvider.on("end", () => {
  logger.info("Disconnected from websocket provider", provider);
});

const web3 = new Web3(wsProvider);
web3.eth.handleRevert = true;

const stakeManagerContract = new web3.eth.Contract(
  stakeManager as any,
  "0x0000000000000000000000000000000000001001"
);

(async () => {
  // const validatorInfo = await stakeManagerContract.methods
  //   .getActiveValidatorInfos()
  //   .call({}, 7216473);
  // console.log(validatorInfo);
  // const { ids, priorities } = validatorsDecode(toBuffer(validatorInfo));
  // const genesisLength = 3;
  // const validators = [];
  // for (let i = 0; i < ids.length; i++) {
  //   const validatorAddress = await stakeManagerContract.methods
  //     .indexedValidatorsById(ids[i].toString())
  //     .call({}, 7216473);
  //   validators.push(validatorAddress);
  // }
  // console.log(validators);
  const url = "https://dao.rei.network/data/validator/validator-list.json";
  axios
    .get(url, {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
      },
    })
    .then((response) => {
      const data = response.data;
      console.log(data);
    })
    .catch((error) => {
      console.log(error);
    });
})();
