import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc-testnet.gokite.ai");
  const contractAddress = "0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE";
  let low = 0;
  let high = await provider.getBlockNumber();
  let deployedBlock = high;

  console.log("Starting binary search for deployment block...");
  while (low <= high) {
    let mid = Math.floor((low + high) / 2);
    try {
      const code = await provider.getCode(contractAddress, mid);
      if (code && code !== "0x") {
        deployedBlock = mid;
        high = mid - 1; // Look for earlier blocks
      } else {
        low = mid + 1; // Need a later block
      }
    } catch(e) {
      console.error("Error at block", mid, e.message);
      break;
    }
  }
  console.log("Deployed block is:", deployedBlock);
}
main();
