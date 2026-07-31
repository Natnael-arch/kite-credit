import { ethers } from "ethers";
const RPC = "https://rpc-testnet.gokite.ai/";
const POOL = "0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE";
async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const abi = ["function totalAssets() view returns (uint256)", "function totalBorrowed() view returns (uint256)"];
  const pool = new ethers.Contract(POOL, abi, provider);
  const total = await pool.totalAssets();
  const borrowed = await pool.totalBorrowed();
  console.log("Pool totalAssets:", ethers.formatUnits(total, 18));
  console.log("Pool totalBorrowed:", ethers.formatUnits(borrowed, 18));
}
main();
