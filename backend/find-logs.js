import { ethers } from "ethers";

const abi = [
  "event Deposited(address indexed user, uint256 amount)",
  "event Withdrawn(address indexed user, uint256 amount)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc-testnet.gokite.ai");
  const contractAddress = "0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE";
  const contract = new ethers.Contract(contractAddress, abi, provider);

  console.log("Fetching logs...");
  try {
    // Try a very wide range first.
    const logs = await contract.queryFilter("Deposited", 0, "latest");
    console.log("Deposited events:", logs.length);
    if (logs.length > 0) {
      console.log("First deposit at block:", logs[0].blockNumber);
    }
  } catch(e) {
    console.error("Error with wide range:", e.message);
  }
}
main();
