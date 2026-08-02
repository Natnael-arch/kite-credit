const { ethers } = require("ethers");
const RPC_URL = "https://rpc-testnet.gokite.ai/";
const provider = new ethers.JsonRpcProvider(RPC_URL);
const agentAddress = "0x392Cf972263701695Cb21745D43541272DEC3ceA";

async function findTxBlocks() {
  const latestBlock = await provider.getBlockNumber();
  const txCount = await provider.getTransactionCount(agentAddress);
  console.log(`Target txCount: ${txCount}, Latest Block: ${latestBlock}`);
  
  if (txCount === 0) {
    console.log("No transactions found.");
    return;
  }

  // We want to find the exact block for each transaction nonce 0 to txCount-1
  // getTransactionCount(address, blockNumber) returns the number of txs up to that block.
  // We can binary search the block number where getTransactionCount(address, block) > nonce.
  
  const txBlocks = [];
  
  for (let nonce = 0; nonce < txCount; nonce++) {
    let low = 0;
    // For efficiency, set low to previous tx block if it exists
    if (txBlocks.length > 0) low = txBlocks[txBlocks.length - 1];
    
    let high = latestBlock;
    let blockFound = -1;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const countAtMid = await provider.getTransactionCount(agentAddress, mid);
      
      if (countAtMid > nonce) {
        blockFound = mid;
        high = mid - 1; // Look for earlier block
      } else {
        low = mid + 1; // Look for later block
      }
    }
    
    if (blockFound !== -1) {
      console.log(`Tx with nonce ${nonce} found in block ${blockFound}`);
      txBlocks.push(blockFound);
    }
  }
  
  console.log("All tx blocks:");
  console.log(txBlocks);
}

findTxBlocks().catch(console.error);
