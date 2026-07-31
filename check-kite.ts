import { ethers } from "ethers";
const RPC = "https://rpc-testnet.gokite.ai/";
const POOL = "0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE";
async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const bal = await provider.getBalance(POOL);
  console.log("Pool Native (KITE) balance:", ethers.formatUnits(bal, 18));
}
main();
