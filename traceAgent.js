const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider("https://rpc-testnet.gokite.ai");

async function check() {
  const SCORE_CONTRACT = "0x71DA928CbCF09515112eE792123b1F32A2229458";
  const SCORE_ABI = [
    "function getFullRecord(address) view returns (tuple(uint16 score, uint32 timestamp, uint8 paymentRate, uint8 diversity, uint32 txCount, uint16 agentAgeDays))"
  ];
  const scoreContract = new ethers.Contract(SCORE_CONTRACT, SCORE_ABI, provider);
  const agent = "0x392Cf972263701695Cb21745D43541272DEC3ceA";
  
  try {
    const record = await scoreContract.getFullRecord(agent);
    console.log("Score Record:", record);
  } catch (err) {
    console.error("Error fetching score:", err.message);
  }
}
check();
