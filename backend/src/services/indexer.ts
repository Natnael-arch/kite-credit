import { ethers } from "ethers";
import { config, supabase } from "../config.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const abisDir = path.resolve(__dirname, "../../src/abis");

const AgentScoreAttestationABI: any[] = JSON.parse(fs.readFileSync(path.join(abisDir, "AgentScoreAttestation.json"), "utf8"));
const X402ProcessorABI: any[] = JSON.parse(fs.readFileSync(path.join(abisDir, "X402Processor.json"), "utf8"));
const LendingPoolABI: any[] = JSON.parse(fs.readFileSync(path.join(abisDir, "LendingPool.json"), "utf8"));
const addressesPath = path.join(abisDir, "deployed-addresses.json");

const PYUSD_ADDRESS = "0x4200000000000000000000000000000000000006";
const erc20Iface = new ethers.Interface(["function transfer(address to, uint256 amount)"]);

export async function startIndexer() {
  console.log("🚀 Starting Resilient Blockchain Indexer (Polling Mode)...");
  const provider = new ethers.JsonRpcProvider(config.kiteRpcUrl);

  if (!fs.existsSync(addressesPath)) {
    console.warn("⚠️ No deployed-addresses.json found in backend/src/abis/. Indexer will wait.");
    return;
  }
  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));

  const agentScoreAttestation = new ethers.Contract(addresses.agentScoreAttestation, AgentScoreAttestationABI, provider);
  const x402Processor = new ethers.Contract(addresses.x402Processor, X402ProcessorABI, provider);
  const lendingPool = new ethers.Contract(addresses.lendingPool, LendingPoolABI, provider);

  // Read checkpoint from DB
  let lastProcessedBlock: number;
  const { data: stateData } = await supabase.from("indexer_state").select("last_processed_block").eq("id", "main").single();
  if (stateData && stateData.last_processed_block) {
    lastProcessedBlock = stateData.last_processed_block;
  } else {
    lastProcessedBlock = 22030829; // AgentScoreAttestation deployment block
    console.log(`⚠️ No checkpoint found. Defaulting to deployment block ${lastProcessedBlock}...`);
    await supabase.from("indexer_state").upsert({ id: "main", last_processed_block: lastProcessedBlock }, { onConflict: "id" });
  }

  console.log(`📡 Starting scan from block ${lastProcessedBlock}...`);

  let consecutiveFailures = 0;

  async function poll() {
    let delay = 5000;

    try {
      const currentBlock = await provider.getBlockNumber();
      const safeLatestBlock = currentBlock > 0 ? currentBlock - 1 : currentBlock;
      if (safeLatestBlock <= lastProcessedBlock) {
        consecutiveFailures = 0;
        console.log(`[Indexer] Caught up to block ${lastProcessedBlock}. Sleeping for ${delay}ms...`);
        return;
      }

      const fromBlock = lastProcessedBlock + 1;
      const toBlock = Math.min(safeLatestBlock, fromBlock + 99); // process in chunks of 100 blocks
      if (toBlock < safeLatestBlock) {
        delay = 100; // fast-poll to catch up quickly
      }

      // 1. Scan for ScoreAttested
      const scoreLogs = await agentScoreAttestation.queryFilter("ScoreAttested", fromBlock, toBlock);
      for (const log of scoreLogs) {
        const [agentAddress, newScore, timestamp] = (log as any).args;
        console.log(`🔗 Indexer: ScoreAttested [${agentAddress}] -> ${newScore}`);
        await supabase.from("agents").upsert({
          address: agentAddress,
          score: Number(newScore),
          name: "Autonomous Agent",
          identity_status: "Verified",
          verification_status: "unknown",
          updated_at: new Date(Number(timestamp) * 1000).toISOString()
        }, { onConflict: 'address' });
      }

      // 2. Scan for Borrowed
      const borrowLogs = await lendingPool.queryFilter("Borrowed", fromBlock, toBlock);
      for (const log of borrowLogs) {
        const [borrowerAddress, amount] = (log as any).args;
        const amountUi = parseFloat(ethers.formatUnits(amount, 18));
        console.log(`🔗 Indexer: Borrowed [${borrowerAddress}] -> ${amountUi} PYUSD`);
        const interestRate = 5.0;
        const totalOwed = amountUi * (1 + interestRate / 100);
        await supabase.from("loans").insert({
          borrower_address: borrowerAddress,
          amount: amountUi,
          interest_rate: interestRate,
          total_owed: totalOwed,
          total_repaid: 0,
          status: "active",
          tx_hash: log.transactionHash
        });
        const { data: pool } = await supabase.from("lending_pool").select("*").single();
        if (pool) {
          await supabase.from("lending_pool").update({
            total_borrowed: parseFloat(pool.total_borrowed) + amountUi
          }).eq("id", pool.id);
        }
      }

      // 3. Scan for PaymentSplit
      const payLogs = await x402Processor.queryFilter("PaymentSplit", fromBlock, toBlock);
      for (const log of payLogs) {
        const [from, to, token, totalAmount, agentPortion, poolPortion] = (log as any).args;
        console.log(`🔗 Indexer: PaymentSplit [${from} -> ${to}] Total: ${ethers.formatUnits(totalAmount, 18)}`);
        
        const { data: existingTx } = await supabase.from("transactions").select("id").eq("tx_hash", log.transactionHash).single();
        if (!existingTx) {
          await supabase.from("transactions").insert({
            from_address: from,
            to_address: to,
            amount: parseFloat(ethers.formatUnits(totalAmount, 18)),
            repayment_portion: parseFloat(ethers.formatUnits(poolPortion, 18)),
            agent_portion: parseFloat(ethers.formatUnits(agentPortion, 18)),
            tx_hash: log.transactionHash,
            status: "success",
            service_name: "x402 On-Chain Split"
          });
        }

        const { data: activeLoan } = await supabase.from("loans").select("id, total_repaid, total_owed").eq("borrower_address", to).eq("status", "active").single();
        if (activeLoan) {
          const repaymentAmount = parseFloat(ethers.formatUnits(poolPortion, 18));
          const newTotalRepaid = parseFloat(activeLoan.total_repaid) + repaymentAmount;
          await supabase.from("loan_repayments").insert({
            loan_id: activeLoan.id,
            amount: repaymentAmount,
            source: "x402_onchain_split",
            tx_hash: log.transactionHash
          });
          const updateData: any = { total_repaid: newTotalRepaid };
          if (newTotalRepaid >= parseFloat(activeLoan.total_owed)) {
            updateData.status = "repaid";
            updateData.repaid_at = new Date().toISOString();
          }
          await supabase.from("loans").update(updateData).eq("id", activeLoan.id);
          fetch(`http://localhost:${config.port}/api/agents/sync-score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentAddress: to })
          }).catch(e => console.error("Failed to trigger sync-score:", e));
        }
      }

      // 4. Scan all blocks for agent general transactions
      const { data: agents } = await supabase.from("agents").select("address");
      const agentAddresses = new Set((agents || []).map((a: any) => a.address.toLowerCase()));

      for (let b = fromBlock; b <= toBlock; b++) {
        const block = await provider.getBlock(b, true);
        if (!block) continue;

        for (const tx of block.prefetchedTransactions) {
          const fullTx = tx as ethers.TransactionResponse;
          if (fullTx.from && agentAddresses.has(fullTx.from.toLowerCase())) {
            
            // Avoid duplicate with PaymentSplit
            const { data: existingTx } = await supabase.from("transactions").select("id").eq("tx_hash", fullTx.hash).single();
            if (existingTx) continue;

            const receipt = await provider.getTransactionReceipt(fullTx.hash);
            const status = receipt?.status === 1 ? "success" : "failed";
            
            let realToAddress = fullTx.to || "Contract Creation";
            let amount = 0;
            let serviceName = "On-Chain Activity";

            // Decode PYUSD transfers
            if (fullTx.to?.toLowerCase() === PYUSD_ADDRESS.toLowerCase() && fullTx.data) {
              try {
                const parsed = erc20Iface.parseTransaction({ data: fullTx.data });
                if (parsed && parsed.name === "transfer") {
                  realToAddress = parsed.args[0]; // The actual recipient of PYUSD
                  amount = parseFloat(ethers.formatUnits(parsed.args[1], 18));
                  serviceName = "PYUSD Transfer";
                }
              } catch(e) {}
            }

            await supabase.from("transactions").insert({
              tx_hash: fullTx.hash,
              from_address: fullTx.from,
              to_address: realToAddress,
              amount: amount, 
              service_name: serviceName,
              status: status
            });
          }
        }
      }

      lastProcessedBlock = toBlock;
      await supabase.from("indexer_state").update({ last_processed_block: lastProcessedBlock }).eq("id", "main");
      consecutiveFailures = 0;
    } catch (err) {
      console.error("Indexer Polling Error:", err);
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        delay = 30000;
        console.log(`⚠️ Multiple RPC failures (${consecutiveFailures}), backing off for 30s...`);
      }
    } finally {
      setTimeout(poll, delay);
    }
  }

  poll();
}
