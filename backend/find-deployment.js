import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc-testnet.gokite.ai");
  const contractAddress = "0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE";
  let latest = await provider.getBlockNumber();
  console.log("Latest block:", latest);
  
  // just check an early block vs a recent block
}
main();
