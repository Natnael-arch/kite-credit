import { Router } from "express";
import { supabase } from "../config.js";
import { ethers } from "ethers";

export const poolRouter = Router();

// DEPRECATED: This endpoint is superseded by direct on-chain reads in the frontend 
// (usePoolOnChainStats hook) to provide genuine ground truth for TVL and liquidity.
// Scheduled for removal once confirmed nothing else relies on it.
poolRouter.get("/", async (_req, res) => {
  try {
    const { data: pool } = await supabase.from("lending_pool").select("*").single();

    if (!pool) {
      return res.json({
        tvl: 0,
        totalBorrowed: 0,
        totalRepaid: 0,
        totalInterestEarned: 0,
        defaultRate: 0,
        averageApy: 8.2,
        activeLoans: 0,
      });
    }

    const { count: activeLoans } = await supabase
      .from("loans")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    const { count: totalLoans } = await supabase
      .from("loans")
      .select("*", { count: "exact", head: true });

    const { count: defaultedLoans } = await supabase
      .from("loans")
      .select("*", { count: "exact", head: true })
      .eq("status", "defaulted");

    const defaultRate = totalLoans && totalLoans > 0
      ? Math.round(((defaultedLoans || 0) / totalLoans) * 1000) / 10
      : 0;

    const tvl = parseFloat(pool.total_deposited);
    const totalInterest = parseFloat(pool.total_interest_earned);
    const averageApy = tvl > 0 ? Math.round((totalInterest / tvl) * 100 * 10) / 10 : 8.2;

    res.json({
      tvl,
      totalBorrowed: parseFloat(pool.total_borrowed),
      totalRepaid: parseFloat(pool.total_repaid),
      totalInterestEarned: totalInterest,
      defaultRate,
      averageApy: Math.max(averageApy, 0),
      activeLoans: activeLoans || 0,
    });
  } catch (err) {
    console.error("GET /pool error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const DEPLOYMENT_BLOCK = 22030830;
const LENDING_POOL_ABI = [
  "event Deposited(address indexed lender, uint256 assets, uint256 sharesMinted)",
  "event Withdrawn(address indexed lender, uint256 assets, uint256 sharesBurned)"
];

let historyCache: { data: any[], deploymentDate: Date | null, timestamp: number } | null = null;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

poolRouter.get("/history", async (_req, res) => {
  try {
    const now = Date.now();
    if (historyCache && now - historyCache.timestamp < CACHE_TTL) {
      return res.json({
        data: historyCache.data,
        deploymentDate: historyCache.deploymentDate
      });
    }

    const provider = new ethers.JsonRpcProvider(process.env.KITE_RPC_URL!);
    const poolAddress = process.env.LENDING_POOL_ADDRESS!;
    const contract = new ethers.Contract(poolAddress, LENDING_POOL_ABI, provider);

    const [deposits, withdrawals, deploymentBlockData] = await Promise.all([
      contract.queryFilter("Deposited", DEPLOYMENT_BLOCK, "latest"),
      contract.queryFilter("Withdrawn", DEPLOYMENT_BLOCK, "latest"),
      provider.getBlock(DEPLOYMENT_BLOCK)
    ]);

    const deploymentDate = deploymentBlockData ? new Date(deploymentBlockData.timestamp * 1000) : null;

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

    historyCache = {
      data: historyData,
      deploymentDate,
      timestamp: now
    };

    res.json({
      data: historyData,
      deploymentDate
    });
  } catch (err) {
    console.error("GET /pool/history error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
