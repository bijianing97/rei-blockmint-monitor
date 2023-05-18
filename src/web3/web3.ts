import Web3 from "web3";
import { config } from "../config/config";
import { logger } from "../logger/logger";

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

const wsProvider = new Web3.providers.WebsocketProvider(
  config.provider,
  options
);

wsProvider.on("connect", async () => {
  logger.info("Connected to websocket provider", config.provider);
});

wsProvider.on("end", () => {
  logger.info("Disconnected from websocket provider", config.provider);
});

export const web3 = new Web3(wsProvider);
web3.eth.handleRevert = true;

const wsProviderFullnode = new Web3.providers.WebsocketProvider(
  config.fullnodeProvider,
  options
);

wsProviderFullnode.on("connect", async () => {
  logger.info("Connected to websocket provider", config.fullnodeProvider);
});

wsProviderFullnode.on("end", () => {
  logger.info("Disconnected from websocket provider", config.fullnodeProvider);
});

export const web3Fullnode = new Web3(wsProviderFullnode);
web3Fullnode.eth.handleRevert = true;
