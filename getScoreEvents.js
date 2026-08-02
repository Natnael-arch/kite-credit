const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider("https://rpc-testnet.gokite.ai");

async function check() {
  const SCORE_CONTRACT = "0x71DA928CbCF09515112eE792123b1F32A2229458";
  const SCORE_ABI = [
    "event ScoreAttested(address indexed agent, uint16 score, uint32 timestamp)"
  ];
  const contract = new ethers.Contract(SCORE_CONTRACT, SCORE_ABI, provider);
  const agent = "0x392Cf972263701695Cb21745D43541272DEC3ceA";
  
  const filter = contract.filters.ScoreAttested(agent);
  const latest = await provider.getBlockNumber();
  const events = await contract.queryFilter(filter, 0, latest);
  
  for (const event of events) {
    const block = await event.getBlock();
    console.log(`Block: ${event.blockNumber}, Hash: ${event.transactionHash}, Date: ${new Date(block.timestamp * 1000).toISOString()}`);
    console.log(`Score: ${event.args.score}`);
  }
}
check();
