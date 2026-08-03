const { ethers } = require("ethers");
const RPC_URL = "https://rpc-testnet.gokite.ai";
const PYUSD_ADDRESS = "0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9";
const AGENT_PRIVATE_KEY = "32db4730c6d7c7fe0d2bb3ef23602fb28c97b5b6420d1d342a4241316e3a95c8";
const DEST_ADDRESS = "0xA4F3018A0eF2021c191795Dd4eEcC5D744E0D8Ee";
const ABI = ["function transfer(address to, uint256 amount) returns (bool)"];

async function run() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(PYUSD_ADDRESS, ABI, wallet);
  console.log(`Sending 0 wei PYUSD to ${DEST_ADDRESS}...`);
  const tx = await contract.transfer(DEST_ADDRESS, 0);
  console.log("Tx hash:", tx.hash);
  await tx.wait();
  console.log("Confirmed!");
}
run().catch(console.error);
