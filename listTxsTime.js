const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider("https://rpc-testnet.gokite.ai");

async function check() {
  const address = "0x392Cf972263701695Cb21745D43541272DEC3ceA".toLowerCase();
  const res = await fetch("https://testnet.kitescan.ai/api?module=account&action=txlist&address=" + address + "&startblock=0&endblock=99999999&page=1&offset=100&sort=asc");
  const data = await res.json();
  if (data.status === "1") {
    const sent = data.result.filter(tx => tx.from.toLowerCase() === address);
    console.log(`Found ${sent.length} sent transactions.`);
    for (const tx of sent) {
      console.log(`Block: ${tx.blockNumber}, Hash: ${tx.hash}, To: ${tx.to}, Time: ${new Date(parseInt(tx.timeStamp) * 1000).toISOString()}`);
    }
  } else {
    console.log("Error or no txs:", data.message);
  }
}
check();
