const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider("https://rpc-testnet.gokite.ai");

async function check() {
  const PYUSD = "0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9";
  const abi = ["event Transfer(address indexed from, address indexed to, uint256 value)"];
  const contract = new ethers.Contract(PYUSD, abi, provider);
  
  const latest = await provider.getBlockNumber();
  const filter = contract.filters.Transfer(null, "0x1111111111111111111111111111111111111111");
  const events = await contract.queryFilter(filter, latest - 500, latest);
  
  if (events.length > 0) {
    const txHash = events[events.length - 1].transactionHash;
    const from = events[events.length - 1].args[0];
    console.log("Found recent transfer to 0x1111... from:", from);
    
    // Check all transfers from this address in recent blocks
    const filterFrom = contract.filters.Transfer(from, null);
    const allEvents = await contract.queryFilter(filterFrom, latest - 500, latest);
    
    console.log("Recent transfers by this wallet:");
    for (const e of allEvents) {
      console.log(`Hash: ${e.transactionHash}, Block: ${e.blockNumber}, To: ${e.args[1]}, Amount: ${e.args[2]}`);
    }
  } else {
    console.log("No recent transfers found.");
  }
}
check();
