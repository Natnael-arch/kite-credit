const { ethers } = require('ethers');
const provider = new ethers.JsonRpcProvider("https://rpc-testnet.gokite.ai/");

const ORACLE = "0x71DA928CbCF09515112eE792123b1F32A2229458";
const X402 = "0xd414b8c0c4FF3F3a1befc2a13293EE4BCF39F337";

async function checkLogs() {
  const scoreAttestedTopic = ethers.id("ScoreAttested(address,uint16,uint32)");
  const splitPaymentTopic = ethers.id("PaymentSplit(address,address,address,uint256,uint256,uint256)");

  const filterAttest = { address: ORACLE, topics: [scoreAttestedTopic], fromBlock: 0, toBlock: 'latest' };
  const filterSplit = { address: X402, topics: [splitPaymentTopic], fromBlock: 0, toBlock: 'latest' };

  try {
    const logsAttest = await provider.getLogs(filterAttest);
    console.log(`ScoreAttested: ${logsAttest.length > 0 ? logsAttest[logsAttest.length-1].transactionHash : 'None'}`);

    const logsSplit = await provider.getLogs(filterSplit);
    console.log(`PaymentSplit: ${logsSplit.length > 0 ? logsSplit[logsSplit.length-1].transactionHash : 'None'}`);
  } catch(e) {
    console.log("Error:", e.message);
  }
}
checkLogs();
