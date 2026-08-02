const { ethers } = require("ethers");
const RPC_URL = "https://rpc-testnet.gokite.ai/";
const provider = new ethers.JsonRpcProvider(RPC_URL);
const contractAddr = "0x71DA928CbCF09515112eE792123b1F32A2229458";
const agentAddr = "0x392Cf972263701695Cb21745D43541272DEC3ceA";

async function main() {
  // Let's try to fetch score from a public mapping if it exists
  const abi = [
    "function scores(address) view returns (uint16 score, uint8 paymentRate, uint8 diversity, uint32 txCount, uint16 agentAgeDays)",
    "function getScore(address) view returns (uint16)",
    "event Attested(address indexed agent, uint16 score)"
  ];
  const contract = new ethers.Contract(contractAddr, abi, provider);
  
  try {
    const scoreData = await contract.scores(agentAddr);
    console.log("Score Data from Mapping:");
    console.log(scoreData);
  } catch (e) {
    console.log("Failed to get score from mapping", e.message);
  }
  
  // Let's fetch the Attested events for this agent
  try {
    const filter = contract.filters.Attested(agentAddr);
    const logs = await contract.queryFilter(filter, 0, "latest");
    console.log(`Found ${logs.length} Attested events for this agent.`);
    for (const log of logs) {
      console.log(`Block: ${log.blockNumber}, TxHash: ${log.transactionHash}, Args: ${log.args}`);
    }
  } catch (e) {
    console.log("Failed to get events", e.message);
  }
}
main().catch(console.error);
