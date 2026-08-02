const { ethers } = require("ethers");
const RPC_URL = "https://rpc-testnet.gokite.ai/";
const provider = new ethers.JsonRpcProvider(RPC_URL);
const agentAddress = "0x392Cf972263701695Cb21745D43541272DEC3ceA";

async function main() {
  const txCount = await provider.getTransactionCount(agentAddress);
  console.log("Total txCount:", txCount);
  
  const latestBlock = await provider.getBlockNumber();
  console.log("Latest block:", latestBlock);
}

main().catch(console.error);
