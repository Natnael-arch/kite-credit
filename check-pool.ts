import { ethers } from "ethers";

const PYUSD_ADDRESS = "0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9";
const POOL_ADDRESS = "0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE";
const RPC = "https://rpc-testnet.gokite.ai/";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const abi = ["function balanceOf(address) view returns (uint256)"];
  const token = new ethers.Contract(PYUSD_ADDRESS, abi, provider);
  const bal = await token.balanceOf(POOL_ADDRESS);
  console.log("Pool balance:", ethers.formatUnits(bal, 18), "PYUSD");
}
main();
