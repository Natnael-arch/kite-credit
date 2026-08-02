const { ethers } = require("ethers");
const RPC_URL = "https://rpc-testnet.gokite.ai/";
const provider = new ethers.JsonRpcProvider(RPC_URL);
const contractAddr = "0x71DA928CbCF09515112eE792123b1F32A2229458";
const agentAddr = "0x392Cf972263701695Cb21745D43541272DEC3ceA";

async function main() {
  const abi = [
    "function getFullRecord(address agent) external view returns (tuple(uint16 score, uint32 timestamp, uint8 paymentRate, uint8 diversity, uint32 txCount, uint16 agentAgeDays))",
    "event ScoreAttested(address indexed agent, uint16 score, uint32 timestamp)"
  ];
  const contract = new ethers.Contract(contractAddr, abi, provider);
  
  try {
    const record = await contract.getFullRecord(agentAddr);
    console.log("Full Record:");
    console.log(`Score: ${record.score}`);
    console.log(`Timestamp: ${record.timestamp}`);
    console.log(`PaymentRate: ${record.paymentRate}`);
    console.log(`Diversity: ${record.diversity}`);
    console.log(`TxCount: ${record.txCount}`);
    console.log(`AgentAgeDays: ${record.agentAgeDays}`);
  } catch (e) {
    console.log("Failed to get full record", e.message);
  }
  
  try {
    const filter = contract.filters.ScoreAttested(agentAddr);
    const logs = await contract.queryFilter(filter, -100000, "latest");
    console.log(`Found ${logs.length} Attested events for this agent.`);
    for (const log of logs) {
      console.log(`Block: ${log.blockNumber}, TxHash: ${log.transactionHash}, Score: ${log.args.score}, Timestamp: ${log.args.timestamp}`);
    }
  } catch (e) {
    console.log("Failed to get events", e.message);
  }
}
main().catch(console.error);
