import { ethers } from "ethers";

const DEPLOYMENT_BLOCK = 22030830;
const LENDING_POOL_ABI = [
  "event Deposited(address indexed lender, uint256 assets, uint256 sharesMinted)",
  "event Withdrawn(address indexed lender, uint256 assets, uint256 sharesBurned)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc-testnet.gokite.ai");
  const contractAddress = "0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE";
  const contract = new ethers.Contract(contractAddress, LENDING_POOL_ABI, provider);

  const [deposits, withdrawals, deploymentBlockData] = await Promise.all([
    contract.queryFilter("Deposited", DEPLOYMENT_BLOCK, "latest"),
    contract.queryFilter("Withdrawn", DEPLOYMENT_BLOCK, "latest"),
    provider.getBlock(DEPLOYMENT_BLOCK)
  ]);

  console.log(`Found ${deposits.length} deposits, ${withdrawals.length} withdrawals`);

  const mappedDeposits = deposits.map(e => ({ type: 'deposit', event: e }));
  const mappedWithdrawals = withdrawals.map(e => ({ type: 'withdraw', event: e }));
  
  const allEvents = [...mappedDeposits, ...mappedWithdrawals].sort((a, b) => {
    if (a.event.blockNumber === b.event.blockNumber) {
      return a.event.transactionIndex - b.event.transactionIndex;
    }
    return a.event.blockNumber - b.event.blockNumber;
  });

  const blockTimestamps: Record<number, number> = {};
  const blocksToFetch = [...new Set(allEvents.map(e => e.event.blockNumber))];
  
  await Promise.all(
    blocksToFetch.map(async (blockNum) => {
      const b = await provider.getBlock(blockNum);
      if (b) blockTimestamps[blockNum] = b.timestamp;
    })
  );

  let currentTvl = 0n;
  const historyData: { timestamp: number, tvl: number }[] = [];

  if (deploymentBlockData) {
    historyData.push({
      timestamp: deploymentBlockData.timestamp * 1000,
      tvl: 0
    });
  }

  for (const { type, event } of allEvents) {
    const parsed = contract.interface.parseLog({ topics: event.topics as string[], data: event.data });
    if (!parsed) continue;
    
    const amountWei = parsed.args[1];
    if (type === 'deposit') {
      currentTvl += amountWei;
    } else {
      currentTvl -= amountWei;
    }

    const ts = blockTimestamps[event.blockNumber] * 1000;
    historyData.push({
      timestamp: ts,
      tvl: Number(ethers.formatUnits(currentTvl, 18))
    });
  }

  console.log(historyData);
}

main().catch(console.error);
