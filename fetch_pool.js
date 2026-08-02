const { ethers } = require("ethers");
const RPC_URL = "https://rpc-testnet.gokite.ai/";
const provider = new ethers.JsonRpcProvider(RPC_URL);
const agentAddress = "0x392Cf972263701695Cb21745D43541272DEC3ceA";
const lendingPoolAddress = "0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE";

async function main() {
  const latest = await provider.getBlockNumber();
  console.log("Latest block:", latest);
  
  const lendingPoolAbi = ["event Repaid(address indexed borrower, uint256 amount)", "event Borrowed(address indexed borrower, uint256 amount)"];
  const pool = new ethers.Contract(lendingPoolAddress, lendingPoolAbi, provider);
  
  // Try to get logs from block 21000000 to latest (approx last 2 weeks if 2s blocks)
  try {
    const filter = pool.filters.Repaid(agentAddress);
    const logs = await pool.queryFilter(filter, latest - 100000, latest);
    console.log(`Found ${logs.length} Repaid events.`);
    for (const log of logs) {
      console.log(`Repaid in block: ${log.blockNumber}, amount: ${log.args.amount.toString()}`);
    }
  } catch (e) {
    console.log("Error querying Repaid:", e.message);
  }
  
  try {
    const filter2 = pool.filters.Borrowed(agentAddress);
    const logs2 = await pool.queryFilter(filter2, latest - 100000, latest);
    console.log(`Found ${logs2.length} Borrowed events.`);
    for (const log of logs2) {
      console.log(`Borrowed in block: ${log.blockNumber}, amount: ${log.args.amount.toString()}`);
    }
  } catch (e) {
    console.log("Error querying Borrowed:", e.message);
  }

  // Also query Repayment History directly!
  const poolAbi2 = ["function repaymentHistory(address, uint256) view returns (uint256 loanId, uint256 amount, bool fullyRepaid, uint256 timestamp)"];
  const pool2 = new ethers.Contract(lendingPoolAddress, poolAbi2, provider);
  for (let i = 0; i < 10; i++) {
    try {
      const record = await pool2.repaymentHistory(agentAddress, i);
      console.log(`Repayment Record ${i}: fullyRepaid=${record.fullyRepaid}, amount=${record.amount}, time=${record.timestamp}`);
    } catch (e) {
      break;
    }
  }
}
main().catch(console.error);
