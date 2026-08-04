const { ethers } = require("ethers");
async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc-testnet.gokite.ai");
  const contractAddress = "0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE";
  let latest = await provider.getBlockNumber();
  console.log("Latest block:", latest);
  
  // Try to find the deployment transaction or use binary search
  // Instead of full binary search, let's just query some logs if possible.
  // We can just use an early block.
}
main();
