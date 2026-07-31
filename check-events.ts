import { ethers } from "ethers";

const POOL_ADDRESS = "0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE";
const RPC = "https://rpc-testnet.gokite.ai/";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const abi = ["event Deposited(address indexed lender, uint256 assets, uint256 sharesMinted)"];
  const pool = new ethers.Contract(POOL_ADDRESS, abi, provider);
  
  const currentBlock = await provider.getBlockNumber();
  const startBlock = Math.max(0, currentBlock - 500); 
  
  const depEvents = await pool.queryFilter("Deposited", startBlock);
  console.log(`Found ${depEvents.length} deposit events in the last 500 blocks`);
  for (const e of depEvents) {
    console.log(`- Deposited ${ethers.formatUnits((e as any).args.assets, 18)} by ${(e as any).args.lender}`);
  }
}
main();
