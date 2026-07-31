import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.KITE_RPC_URL);
const SCORE_CONTRACT = process.env.SCORE_CONTRACT_ADDRESS;
const SCORE_ABI = ["function getScore(address) view returns (uint16, uint32)"];
const scoreContract = new ethers.Contract(SCORE_CONTRACT!, SCORE_ABI, provider);

async function check() {
  const addrs = [
    "0xC201B98d96d09f2B15Cb7fe8E8c40Da6D664B15c", // test agent
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // common hardhat 1
    new ethers.Wallet(process.env.POOL_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001").address,
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" // deployer
  ];

  for (const a of addrs) {
    try {
      const [score, ts] = await scoreContract.getScore(a);
      console.log(`${a}: Score=${score}, TS=${ts}`);
    } catch (e) {
      console.log(`${a}: Error`);
    }
  }
}

check();
