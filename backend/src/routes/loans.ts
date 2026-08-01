import { Router } from "express";
import { supabase } from "../config.js";
import { ethers } from "ethers";
import { requireAgentSignature } from "../middleware/auth.js";

export const loansRouter = Router();

const LENDING_POOL_ABI = [
  "function borrow(uint256 amount) external",
  "function borrowers(address) external view returns (uint256 borrowedAmount, uint256 lastBorrowTime, uint256 collateralAmount, bool isCollateralLocked, uint256 interestRateBps, uint256 accruedInterest, uint256 lastInterestUpdate)",
  "function getScore(address) external view returns (uint16 score, uint32 timestamp)",
  "event Borrowed(address indexed borrower, uint256 amount)",
  "event Repaid(address indexed borrower, uint256 amount)",
  "event LoanRepayment(address indexed borrower, uint256 principalPayment, uint256 loanId, bool fullyRepaid, uint256 timestamp)"
];

function assessEligibility(score: number) {
  if (score < 500) {
    return { eligible: false, maxLoan: 0, interestRate: 0, repaymentSplit: 30, message: "Score too low" };
  }
  let maxLoan = 0;
  let interestRate = 20.0;
  if (score >= 800) { maxLoan = 500; interestRate = 5.0; }
  else if (score >= 700) { maxLoan = 200; interestRate = 10.0; }
  else if (score >= 600) { maxLoan = 50; interestRate = 15.0; }
  else { maxLoan = 10; interestRate = 20.0; }
  return { eligible: true, maxLoan, interestRate, repaymentSplit: 30 };
}

const SCORE_ATTESTATION_ABI = [
  "function getScore(address) external view returns (uint16 score, uint32 timestamp)"
];

loansRouter.get("/terms/:address", async (req, res) => {
  try {
    const { address } = req.params;

    const { data: agent } = await supabase
      .from("agents")
      .select("verification_status, score")
      .eq("address", address)
      .single();

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    let onChainScore: number = 0;
    let onChainTimestamp: number = 0;
    let blockTimestamp: number = 0;

    try {
      const provider = new ethers.JsonRpcProvider(process.env.KITE_RPC_URL!);
      const scoreContract = new ethers.Contract(
        process.env.SCORE_CONTRACT_ADDRESS!,
        SCORE_ATTESTATION_ABI,
        provider
      );

      const [scoreRes, latestBlock] = await Promise.all([
        scoreContract.getScore(address),
        provider.getBlock("latest")
      ]);

      onChainScore = Number(scoreRes[0]);
      onChainTimestamp = Number(scoreRes[1]);
      blockTimestamp = latestBlock!.timestamp;
    } catch (rpcErr) {
      console.error("RPC Error fetching on-chain score:", rpcErr);
      return res.status(503).json({
        error: "Could not verify on-chain score right now, please retry",
        message: "RPC temporarily unavailable"
      });
    }



    if (onChainScore === 0) {
      return res.json({
        eligible: false,
        maxLoan: 0,
        interestRate: 0,
        repaymentSplit: 30,
        message: "No on-chain score attestation exists yet",
        verificationStatus: agent.verification_status || "unverified"
      });
    }

    const STALE_WINDOW = 7 * 24 * 60 * 60; // 7 days in seconds
    if (blockTimestamp - onChainTimestamp > STALE_WINDOW) {
      return res.json({
        eligible: false,
        maxLoan: 0,
        interestRate: 0,
        repaymentSplit: 30,
        message: "On-chain score is stale",
        verificationStatus: agent.verification_status || "unverified"
      });
    }

    const terms = assessEligibility(onChainScore);
    res.json({
      ...terms,
      verificationStatus: agent.verification_status || "unverified"
    });
  } catch (err) {
    console.error("GET /loans/terms/:address error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

loansRouter.post("/borrow", requireAgentSignature("borrower_address"), async (req, res) => {
  try {
    const { borrower_address, amount, txHash } = req.body;



    if (!borrower_address || !amount || !txHash) {
      return res.status(400).json({
        error: "borrower_address, amount, and txHash are required"
      });
    }

    const provider = new ethers.JsonRpcProvider(process.env.KITE_RPC_URL!);

    // Verify transaction
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return res.status(400).json({ error: "Transaction not found on-chain" });
    }
    
    if (receipt.status !== 1) {
      return res.status(400).json({ error: "Transaction reverted on-chain" });
    }

    if (receipt.to?.toLowerCase() !== process.env.LENDING_POOL_ADDRESS?.toLowerCase()) {
      return res.status(400).json({ error: "Transaction was not sent to the Lending Pool" });
    }

    // Decode and verify the Borrowed event
    const iface = new ethers.Interface(LENDING_POOL_ABI);
    let borrowerFound = "";
    let amountFoundWei = 0n;

    for (const log of receipt.logs) {
      try {
        const parsedLog = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsedLog && parsedLog.name === "Borrowed") {
          borrowerFound = parsedLog.args[0]; // borrower
          amountFoundWei = parsedLog.args[1]; // amount
          break;
        }
      } catch (e) {
        // ignore logs that don't match our ABI
      }
    }

    if (!borrowerFound) {
      return res.status(400).json({ error: "No Borrowed event found in this transaction" });
    }

    if (borrowerFound.toLowerCase() !== borrower_address.toLowerCase()) {
      return res.status(400).json({ error: "Transaction borrower address does not match requested agent address" });
    }

    const amountWei = ethers.parseUnits(amount.toString(), 18);
    if (amountFoundWei !== amountWei) {
      return res.status(400).json({ error: "Transaction amount does not match requested amount" });
    }

    // Update Supabase cache
    const { data: agent } = await supabase.from("agents").select("score").eq("address", borrower_address).single();
    const terms = assessEligibility(agent?.score || 850);

    const { error: insertError } = await supabase
      .from("loans")
      .insert({
        borrower_address: borrower_address,
        amount: amount,
        principal: amount,
        tx_hash: txHash,
        status: "active",
        interest_rate: terms.interestRate,
        repayment_split: terms.repaymentSplit,
        total_owed: parseFloat(amount.toString()) * (1 + terms.interestRate / 100),
        total_repaid: 0,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error("Prod borrow insert error:", insertError);
      return res.status(500).json({ error: "Failed to record prod loan in DB", details: insertError.message });
    }

    return res.json({
      success: true,
      txHash: txHash,
      explorerUrl: `https://testnet.kitescan.ai/tx/${txHash}`,
      borrowed: amount,
      message: `Successfully recorded borrow of ${amount} PYUSD`
    });

  } catch (err: any) {
    console.error("[BORROW RECORD] Failed:", err.message);
    return res.status(500).json({
      error: "Recording borrow failed",
      details: err.message
    });
  }
});

loansRouter.post("/repay", requireAgentSignature(), async (req, res) => {
  try {
    const { borrower_address, amount, txHash } = req.body;

    if (!borrower_address || !amount || !txHash) {
      return res.status(400).json({ error: "borrower_address, amount, and txHash are required" });
    }

    const provider = new ethers.JsonRpcProvider(process.env.KITE_RPC_URL!);

    // Verify transaction
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return res.status(400).json({ error: "Transaction not found on-chain" });
    }
    
    if (receipt.status !== 1) {
      return res.status(400).json({ error: "Transaction reverted on-chain" });
    }

    if (receipt.to?.toLowerCase() !== process.env.LENDING_POOL_ADDRESS?.toLowerCase()) {
      return res.status(400).json({ error: "Transaction was not sent to the Lending Pool" });
    }

    // Decode and verify the LoanRepayment event
    const iface = new ethers.Interface(LENDING_POOL_ABI);
    let borrowerFound = "";
    let amountFoundWei = 0n;
    let fullyRepaidFound = false;

    for (const log of receipt.logs) {
      try {
        const parsedLog = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsedLog) {
          if (parsedLog.name === "Repaid") {
            borrowerFound = parsedLog.args[0];
            amountFoundWei = parsedLog.args[1];
          } else if (parsedLog.name === "LoanRepayment") {
            fullyRepaidFound = parsedLog.args[3]; // fullyRepaid
          }
        }
      } catch (e) {
        // ignore logs that don't match our ABI
      }
    }

    if (!borrowerFound) {
      return res.status(400).json({ error: "No LoanRepayment event found in this transaction" });
    }

    if (borrowerFound.toLowerCase() !== borrower_address.toLowerCase()) {
      return res.status(400).json({ error: "Transaction borrower address does not match requested agent address" });
    }

    const amountWei = ethers.parseUnits(amount.toString(), 18);
    if (amountFoundWei !== amountWei) {
      return res.status(400).json({ error: "Transaction amount does not match requested amount" });
    }

    // Get active loan to update
    const { data: activeLoan, error: loanError } = await supabase
      .from("loans")
      .select("*")
      .eq("borrower_address", borrower_address)
      .eq("status", "active")
      .single();

    if (loanError || !activeLoan) {
      return res.status(400).json({ error: "No active loan found for this borrower" });
    }

    const newTotalRepaid = parseFloat(activeLoan.total_repaid || "0") + parseFloat(amount.toString());
    const newStatus = fullyRepaidFound ? "repaid" : "active";

    const { error: updateError } = await supabase
      .from("loans")
      .update({
        total_repaid: newTotalRepaid,
        status: newStatus
      })
      .eq("id", activeLoan.id);

    if (updateError) {
      console.error("Prod repay update error:", updateError);
      return res.status(500).json({ error: "Failed to update prod loan in DB", details: updateError.message });
    }

    await supabase
      .from("loan_repayments")
      .insert({
        loan_id: activeLoan.id,
        amount: amount,
        source: "manual",
      });

    // Insert into transactions table for history
    await supabase.from("transactions").insert({
      from_address: borrower_address,
      to_address: process.env.LENDING_POOL_ADDRESS,
      amount: amount,
      service_name: "Manual Repayment",
      status: "success",
      repayment_portion: amount,
      agent_portion: 0
    });

    return res.json({
      success: true,
      txHash: txHash,
      explorerUrl: `https://testnet.kitescan.ai/tx/${txHash}`,
      repaid: amount,
      message: `Successfully recorded repayment of ${amount} PYUSD`
    });

  } catch (err: any) {
    console.error("[REPAY RECORD] Failed:", err.message);
    return res.status(500).json({
      error: "Recording repayment failed",
      details: err.message
    });
  }
});

loansRouter.get("/:address", async (req, res) => {
  try {
    const { address } = req.params;

    const { data, error } = await supabase
      .from("loans")
      .select("*, loan_repayments(*)")
      .eq("borrower_address", address)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: "Failed to fetch loans" });
    }

    res.json(data || []);
  } catch (err) {
    console.error("GET /loans/:address error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

loansRouter.get("/active/:address", async (req, res) => {
  try {
    const { address } = req.params;

    const { data, error } = await supabase
      .from("loans")
      .select("*, loan_repayments(*)")
      .eq("borrower_address", address)
      .eq("status", "active")
      .single();

    if (error || !data) {
      return res.json(null);
    }

    res.json(data);
  } catch (err) {
    console.error("GET /loans/active/:address error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
