import { ethers } from "ethers";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../backend/.env") }); // Fallback for Supabase vars

const RPC_URL = process.env.KITE_RPC_URL || "https://rpc-testnet.gokite.ai/";
const provider = new ethers.JsonRpcProvider(RPC_URL);

interface PassportHistory {
  totalPayments:     number;
  successfulPayments: number;
  uniquePayees:      string[];
  firstPaymentAt:    number;  // unix timestamp
  totalAmountSpent:  bigint;
  sessions: {
    id: string;
    maxPerTx: bigint;
    totalSpent: bigint;
    respected: boolean; // never exceeded limit
  }[];
}

async function getPassportHistory(
  agentAddress: string,
  passportToken: string
): Promise<PassportHistory | null> {
  try {
    const response = await fetch(
      `https://passport.prod.gokite.ai/v1/agents/${agentAddress}/history`,
      {
        headers: {
          "Authorization": `Bearer ${passportToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!response.ok) {
      console.warn(`[SCORER] Passport API failed for ${agentAddress}. Status: ${response.status} ${response.statusText}`);
      return null;
    }
    return await response.json();
  } catch (error: any) {
    console.error(`[SCORER] Passport API request error for ${agentAddress}:`, error.message);
    return null;
  }
}

// Factor 1 — Payment success rate
function scorePaymentSuccess(history: PassportHistory): number {
  if (history.totalPayments === 0) return 0;
  const rate = history.successfulPayments / history.totalPayments;
  return Math.round(rate * 137); // max 137 pts (25% weight)
}

// Factor 2 — Transaction volume
function scoreVolume(history: PassportHistory): number {
  return Math.min(history.totalPayments, 50) * 2.2;
}

// Factor 3 — Service diversity
function scoreDiversity(history: PassportHistory): number {
  const unique = new Set(history.uniquePayees).size;
  return Math.min(unique, 10) * 8.2; // max 82 pts
}

// Factor 4 — Account age
function scoreAge(history: PassportHistory): number {
  const now = Math.floor(Date.now() / 1000);
  const ageSeconds = now - history.firstPaymentAt;
  const ageDays = ageSeconds / 86400;
  return Math.min(ageDays, 30) * 1.83; // max 55 pts
}

// Factor 5 — Session discipline
function scoreSessionDiscipline(history: PassportHistory): number {
  if (history.sessions.length === 0) return 0;
  const respected = history.sessions.filter(s => s.respected).length;
  const rate = respected / history.sessions.length;
  return Math.round(rate * 27); // max 27 pts
}

/**
 * Result from the scoring engine
 */
export interface ScoreResult {
  score: number;
  grade: string;
  paymentRate: number;
  diversity: number;
  txCount: number;
  agentAgeDays: number;
  factors?: {
    repayment: number;
    payment: number;
    diversity: number;
    age: number;
    trading: number;
    discipline: number;
  };
  sources?: {
    passport: boolean;
    chainScan: boolean;
  };
  breakdown?: {
    paymentRate: number;
    txVolume: number;
    age: number;
    diversity: number;
    sessions: number;
    repayment: number;
    trading: number;
  };
}

async function scoreRepaymentHistory(
  agentAddress: string,
  provider: ethers.JsonRpcProvider
): Promise<number> {
  const LENDING_POOL_ADDRESS = process.env.LENDING_POOL_ADDRESS;
  if (!LENDING_POOL_ADDRESS) {
    console.error("[SCORER] ⚠️ LENDING_POOL_ADDRESS env var is not set — repayment factor (35% weight) will be 0!");
    return 0;
  }
  
  try {
    // The contract exposes: mapping(address => RepaymentRecord[]) public repaymentHistory
    // The auto-generated accessor is: repaymentHistory(address, uint256 index)
    // It reverts on out-of-bounds, so we iterate until that happens.
    const abi = [
      "function repaymentHistory(address, uint256) view returns (uint256 loanId, uint256 amount, bool fullyRepaid, uint256 timestamp)"
    ];

    const contract = new ethers.Contract(
      LENDING_POOL_ADDRESS, abi, provider
    );

    const records: { loanId: bigint; amount: bigint; fullyRepaid: boolean; timestamp: bigint }[] = [];
    const MAX_RECORDS = 50; // safety cap to avoid infinite loop

    for (let i = 0; i < MAX_RECORDS; i++) {
      try {
        const record = await contract.repaymentHistory(agentAddress, i);
        records.push({
          loanId:     record.loanId,
          amount:     record.amount,
          fullyRepaid: record.fullyRepaid,
          timestamp:  record.timestamp
        });
      } catch {
        // Out-of-bounds revert = end of array, stop iterating
        break;
      }
    }

    console.log(`[SCORER] Repayment history for ${agentAddress}: ${records.length} record(s) found`);

    let points = 0;
    let fullRepayments = 0;

    for (const record of records) {
      if (record.fullyRepaid) {
        fullRepayments++;
        points += 40; // fully repaid loan
      } else {
        points += 10; // partial repayment — still positive
      }
    }

    // Cap at 3 full repayments = 120 pts max
    // Bonus for consistent repayer
    if (fullRepayments >= 2) points += 30;
    if (fullRepayments >= 3) points += 42;

    const finalPoints = Math.min(192, points);
    console.log(`[SCORER] Repayment score for ${agentAddress}: ${finalPoints} pts (${fullRepayments} full repayments, ${records.length} total records)`);
    return finalPoints;
  } catch (error) {
    // Loud failure — this is 35% of the score, never let it fail silently
    console.error("[SCORER] ❌ REPAYMENT HISTORY READ FAILED — 35% weight factor returning 0. This needs investigation!", error);
    return 0;
  }
}



function scoreToGrade(score: number): string {
  const percentage = (score / 850) * 100;
  if (percentage >= 75) return "Excellent";
  if (percentage >= 50) return "Good";
  if (percentage >= 25) return "Fair";
  return "Poor";
}

async function getTransactions(agentAddress: string) {
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (sbUrl?.includes("ydzvybbwjkvglmtegtlw.supabase.co")) {
    const dbPath = path.resolve(process.cwd(), "../backend/db.json");
    if (fs.existsSync(dbPath)) {
      const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
      return db.transactions?.filter((t: any) => 
        t.from_address?.toLowerCase() === agentAddress.toLowerCase() || 
        t.to_address?.toLowerCase() === agentAddress.toLowerCase()
      ) || [];
    }
    return [];
  } else {
    const addr = agentAddress.toLowerCase();
    const url = `${sbUrl}/rest/v1/transactions?or=(from_address.eq.${addr},to_address.eq.${addr})`;
    console.log(`[SCORER] Fetching transactions from Supabase: ${url}`);
    
    try {
      const res = await fetch(url, {
        headers: { "apikey": sbKey!, "Authorization": `Bearer ${sbKey}` }
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`[SCORER] Success: found ${data.length} transactions for ${agentAddress}`);
        return data;
      } else {
        const errText = await res.text();
        console.error(`[SCORER] ❌ Supabase REST API Error (Status ${res.status}):`, errText);
      }
    } catch(e) {
      console.error("[SCORER] Failed to fetch transactions from Supabase:", e);
    }
    return [];
  }
}

async function computeSimulateBonus(agentAddress: string, txs: any[]): Promise<number> {
  const plainTransfers = txs.filter((tx: any) => tx.service_name === "PYUSD Transfer" && tx.status === "success");
  return Math.min(plainTransfers.length, 10) * 25;
}

/**
 * Legacy scorer using indexer persisted data
 */
export async function computeScoreLegacy(agentAddress: string): Promise<ScoreResult> {
  console.log(`\n🔍 Scoring agent (using indexer DB): ${agentAddress}`);

  // Fetch transactions from DB
  const txs = await getTransactions(agentAddress);
  const txCount = txs.length;
  
  if (txCount === 0) {
    console.log("  ⚠️ Agent has zero transactions in DB. Base score assigned.");
    return emptyScore();
  }

  // 1. Repayment history (40%, max 340 pts)
  const rawRepaymentPoints = await scoreRepaymentHistory(agentAddress, provider);
  const repaymentPoints = rawRepaymentPoints * (340 / 192); // Rescale from max 192 to max 340

  // Filter for Payment Reliability and Counterparty Diversity
  const x402Txs = txs.filter((tx: any) => 
    tx.service_name === "x402 On-Chain Split" && 
    tx.to_address?.toLowerCase() === agentAddress.toLowerCase()
  );

  // 2. Payment reliability (35%, max 297.5 pts)
  const successfulX402 = x402Txs.filter((tx: any) => tx.status === "success");
  const successRate = x402Txs.length > 0 ? (successfulX402.length / x402Txs.length) : 0;
  const totalVolume = successfulX402.reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
  
  const p_reliability_success = successRate * (297.5 * 0.5);
  // Log scale volume: e.g. log10(volume + 1) * 50, capped at 148.75
  const p_reliability_volume = Math.min(Math.log10(totalVolume + 1) * 50, 297.5 * 0.5);
  const p_reliability = p_reliability_success + p_reliability_volume;

  // 3. Counterparty diversity (15%, max 127.5 pts)
  const uniquePayers = new Set<string>();
  successfulX402.forEach((tx: any) => {
    if (tx.from_address) uniquePayers.add(tx.from_address.toLowerCase());
  });
  const diversity = uniquePayers.size;
  const p_diversity = Math.min(diversity, 10) * 12.75;

  // 4. Account age / tenure (10%, max 85 pts)
  let firstSeenTime = Infinity;
  for (const tx of txs) {
    const txTime = new Date(tx.created_at).getTime();
    if (txTime < firstSeenTime) {
      firstSeenTime = txTime;
    }
  }
  const now = Date.now();
  const agentAgeDays = firstSeenTime === Infinity ? 0 : Math.floor((now - firstSeenTime) / 86400000);
  const p_age = Math.min(agentAgeDays, 30) * (85 / 30);

  let totalPoints = repaymentPoints + p_reliability + p_diversity + p_age;

  // ⚠️ TESTING ONLY — remove this entire block and the ALLOW_SIMULATE_SCORING env var
  // once real external testers no longer need a shortcut to reach eligibility.
  // Tracked removal trigger: after 3 real external testers complete the full loop.
  if (process.env.ALLOW_SIMULATE_SCORING === "true") {
    totalPoints += await computeSimulateBonus(agentAddress, txs);
  }

  const score = Math.min(850, Math.max(300, Math.round(300 + totalPoints)));

  const result = {
    score,
    grade: scoreToGrade(score),
    paymentRate: Math.round(successRate * 100),
    diversity,
    txCount,
    agentAgeDays,
    breakdown: {
      paymentRate: Math.round(p_reliability),
      txVolume: Math.round(p_reliability_volume),
      age: Math.round(p_age),
      diversity: Math.round(p_diversity),
      sessions: 0,
      repayment: Math.round(repaymentPoints),
      trading: 0
    }
  };
  
  return result;
}

function emptyScore(): ScoreResult {
  return {
    score: 300,
    grade: scoreToGrade(300),
    paymentRate: 0,
    diversity: 0,
    txCount: 0,
    agentAgeDays: 0,
    breakdown: {
      paymentRate: 0,
      txVolume: 0,
      age: 0,
      diversity: 0,
      sessions: 0,
      repayment: 0,
      trading: 0
    }
  };
}

/**
 * Computes an agent's credit score using Passport history as primary
 */
export async function computeScore(
  agentAddress: string,
  passportToken: string = process.env.PASSPORT_USER_JWT || ""
): Promise<ScoreResult> {

  // PRIMARY: Passport history (fast, complete, verified)
  const passportHistory = await getPassportHistory(
    agentAddress, passportToken
  );

  // FALLBACK: blockchain scan if Passport unavailable
  if (!passportHistory) {
    console.warn("Passport history unavailable — falling back to chain scan");
    return computeScoreLegacy(agentAddress);
  }

  // SUPPLEMENTARY: on-chain data Passport doesn't have
  const repaymentPoints = await scoreRepaymentHistory(agentAddress, provider);

  // COMPUTE
  const paymentPoints   = scorePaymentSuccess(passportHistory);
  const volumePoints    = scoreVolume(passportHistory);
  const diversityPoints = scoreDiversity(passportHistory);
  const agePoints       = scoreAge(passportHistory);
  const disciplinePoints = scoreSessionDiscipline(passportHistory);

  const finalScore = Math.min(850, Math.max(300,
    300 +
    repaymentPoints   +  // 40% — loan repayment (from chain) - adjusted scale
    paymentPoints     +  // 25% — payment success (from Passport)
    diversityPoints   +  // 15% — service diversity (from Passport)
    agePoints         +  // 10% — account age (from Passport)
    disciplinePoints     //  5% — session discipline (from Passport)
  ));

  const paymentRate = passportHistory.totalPayments > 0 
    ? Math.round((passportHistory.successfulPayments / passportHistory.totalPayments) * 100) 
    : 0;
  const uniquePayeesCount = new Set(passportHistory.uniquePayees).size;
  const now = Math.floor(Date.now() / 1000);
  const ageDays = Math.floor((now - passportHistory.firstPaymentAt) / 86400);

  return {
    score: Math.round(finalScore),
    grade: scoreToGrade(Math.round(finalScore)),
    paymentRate,
    diversity: uniquePayeesCount,
    txCount: passportHistory.totalPayments,
    agentAgeDays: ageDays,
    factors: {
      repayment:   Math.round(repaymentPoints),
      payment:     Math.round(paymentPoints),
      diversity:   Math.round(diversityPoints),
      age:         Math.round(agePoints),
      trading:     0,
      discipline:  Math.round(disciplinePoints)
    },
    sources: {
      passport: true,
      chainScan: false  // no longer needed as primary source
    }
  };
}
