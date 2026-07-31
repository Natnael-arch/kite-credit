import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const API_URL = "https://kite-credit-production.up.railway.app/api";

const LENDING_POOL_ABI = [
  "function borrow(uint256 amount) external",
  "function borrowers(address) external view returns (uint256 borrowedAmount, uint256 lastBorrowTime, uint256 collateralAmount, bool isCollateralLocked, uint256 interestRateBps, uint256 accruedInterest, uint256 lastInterestUpdate)"
];

async function runAutonomousAgent() {
  console.log("🤖 Booting Up Autonomous Agent Demo (On-Chain Mode)...");

  // 1. Generate identity or load from env
  if (!process.env.AGENT_PRIVATE_KEY) {
    console.error("❌ Missing AGENT_PRIVATE_KEY in .env file. Real on-chain interactions require a funded wallet.");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(process.env.KITE_RPC_URL || "https://rpc-testnet.gokite.ai");
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);
  const address = wallet.address;
  const name = `Auto-Trader Bot ${Math.floor(Math.random() * 9000) + 1000}`;
  
  console.log(`\n🔑 Agent Identity Loaded:
  Name: ${name}
  Address: ${address}
  `);

  // 2. Register Agent
  try {
    const regRes = await fetch(`${API_URL}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        name,
        agent_type: "Algorithmic Trader",
        model_hash: "0x" + ethers.hexlify(ethers.randomBytes(32)).slice(2),
      }),
    });

    if (!regRes.ok) throw new Error("Failed to register");
    console.log("✅ Agent successfully registered on KiteCredit Protocol.");
  } catch (err) {
    console.error("Failed to register:", err);
    process.exit(1);
  }

  // Helper to sign payloads
  const signPayload = async (payload: any) => {
    const timestamp = Date.now().toString();
    const message = JSON.stringify(payload) + timestamp;
    const signature = await wallet.signMessage(message);
    return { signature, timestamp };
  };

  let loopCount = 0;
  let isProcessing = false;

  // 3. The Autonomous Loop
  setInterval(async () => {
    if (isProcessing) return;
    isProcessing = true;

    try {
      loopCount++;
      console.log(`\n--- Tick ${loopCount} ---`);

      // A. Perform a fake job to earn revenue
      const amountEarned = Math.floor(Math.random() * 50) + 10;
      console.log(`💼 Agent executed a trade and earned $${amountEarned}. Recording transaction...`);

      const txPayload = {
        from_address: address,
        to_address: "0xKiteGasStationPool",
        amount: amountEarned,
        service_name: "DeFi Arbitrage",
        status: "success",
      };

      const { signature: txSig, timestamp: txTime } = await signPayload(txPayload);

      const txRes = await fetch(`${API_URL}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-agent-signature": txSig,
          "x-timestamp": txTime,
        },
        body: JSON.stringify(txPayload),
      });

      if (txRes.ok) {
        const txData = await txRes.json() as any;
        if (txData.repayment) {
          console.log(`💸 WATERFALL: $${txData.repayment.repaymentPortion} routed to loan repayment! Agent kept $${txData.repayment.agentPortion}.`);
        } else {
          console.log(`✅ Revenue secured. Score building...`);
        }
      }

      // B. Check for loan
      // Every 5 ticks, check if we need a loan
      if (loopCount % 5 === 0) {
        console.log("🧠 Agent analyzing credit position and evaluating borrowing options...");
        
        const checkActiveRes = await fetch(`${API_URL}/loans/active/${address}`);
        const activeLoan = await checkActiveRes.json();

        if (activeLoan && !activeLoan.error) {
          console.log(`📊 Agent currently holds a loan. Outstanding debt: $${activeLoan.total_owed - activeLoan.total_repaid}. Continuing to work to repay.`);
        } else {
          const termsRes = await fetch(`${API_URL}/loans/terms/${address}`);
          const termsData = await termsRes.json() as any;

          if (termsData.eligible) {
            // Limit borrow to 5 PYUSD max for testing with real liquidity
            const amountToBorrow = Math.min(termsData.maxLoan, 5);
            console.log(`🎯 Agent is eligible for up to $${termsData.maxLoan}! Requesting $${amountToBorrow} on-chain...`);

            try {
              // Connect to LendingPool contract
              const poolAddress = process.env.LENDING_POOL_ADDRESS;
              if (!poolAddress) throw new Error("Missing LENDING_POOL_ADDRESS in env");
              
              const lendingPool = new ethers.Contract(poolAddress, LENDING_POOL_ABI, wallet);
              
              console.log(`  ⛓️ Broadcasting borrow transaction to Kite testnet...`);
              const amountWei = ethers.parseUnits(amountToBorrow.toString(), 18);
              const tx = await lendingPool.borrow(amountWei);
              
              console.log(`  ⏳ Waiting for confirmation (tx: ${tx.hash})...`);
              await tx.wait();
              console.log(`  ✅ Transaction confirmed! Recording borrow with backend...`);

              const borrowPayload = {
                borrower_address: address,
                amount: amountToBorrow,
                txHash: tx.hash
              };

              const { signature: borrowSig, timestamp: borrowTime } = await signPayload(borrowPayload);

              const borrowRes = await fetch(`${API_URL}/loans/borrow`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-agent-signature": borrowSig,
                  "x-timestamp": borrowTime,
                },
                body: JSON.stringify(borrowPayload),
              });

              if (borrowRes.ok) {
                const loanData = await borrowRes.json() as any;
                console.log(`\n🎉 LOAN SECURED 🎉
            Amount: $${amountToBorrow}
            Interest: ${termsData.interestRate}%
            Waterfall Split: ${termsData.repaymentSplit}%
            TxHash: ${loanData.txHash}
            `);
              } else {
                console.log(`❌ Backend rejected loan registration: ${await borrowRes.text()}`);
              }
            } catch (contractErr: any) {
               console.log(`❌ On-chain borrow failed: ${contractErr.message}`);
               console.log(`   (Did you attest the score using push-score.ts?)`);
            }
          } else {
            console.log("📉 Agent still building reputation. Score is too low to borrow.");
          }
        }
      }
    } finally {
      isProcessing = false;
    }
  }, 4000);
}

runAutonomousAgent();
