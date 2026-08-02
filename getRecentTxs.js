const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider("https://rpc-testnet.gokite.ai");

async function check() {
  const address = "0x392Cf972263701695Cb21745D43541272DEC3ceA";
  const count = await provider.getTransactionCount(address);
  console.log("Tx count:", count);
  const latestBlock = await provider.getBlockNumber();
  console.log("Latest block:", latestBlock);
}
check();
