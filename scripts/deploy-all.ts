/**
 * Full redeployment script — deploys all 3 contracts with separated roles.
 *
 * Deployer / tx signer: NEW_ORACLE_ADDRESS (0xC201...)
 * Oracle (immutable):   NEW_ORACLE_ADDRESS
 * Pool owner/admin:     NEW_ADMIN_ADDRESS (0x8eEd...)
 *
 * Run from repo root:
 *   node --loader ts-node/esm scripts/deploy-all.ts
 *   — or —
 *   npx tsx scripts/deploy-all.ts
 */
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

// ── Configuration ──────────────────────────────────────────
const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY!;
const NEW_ORACLE_ADDRESS = "0xC201B98d96d09f2B15Cb7fe8E8c40Da6D664B15c";
const NEW_ADMIN_ADDRESS = "0x8eEd066a9f2A3931d833C7792D98BBFedf3275A2";
const PYUSD_ADDRESS      = "0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9";
const RPC_URL            = "https://rpc-testnet.gokite.ai";

// ── Load compiled artifacts ────────────────────────────────
const AgentScoreArtifact = JSON.parse(
  fs.readFileSync(path.resolve("contracts/artifacts/contracts/AgentScoreAttestation.sol/AgentScoreAttestation.json"), "utf8")
);
const LendingPoolArtifact = JSON.parse(
  fs.readFileSync(path.resolve("frontend/contracts/artifacts/contracts/LendingPool.sol/LendingPool.json"), "utf8")
);
const X402Artifact = JSON.parse(
  fs.readFileSync(path.resolve("frontend/contracts/artifacts/contracts/X402Processor.sol/X402Processor.json"), "utf8")
);

async function main() {
  if (!ORACLE_PRIVATE_KEY) {
    throw new Error("Set ORACLE_PRIVATE_KEY env var before running");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(ORACLE_PRIVATE_KEY, provider);

  console.log("Deployer:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance: ", ethers.formatEther(balance), "KITE\n");

  if (wallet.address.toLowerCase() !== NEW_ORACLE_ADDRESS.toLowerCase()) {
    throw new Error(`Deployer ${wallet.address} does not match NEW_ORACLE_ADDRESS ${NEW_ORACLE_ADDRESS}`);
  }

  // ── 1. Deploy AgentScoreAttestation ──────────────────────
  console.log("1/5  Deploying AgentScoreAttestation ...");
  const AgentScoreFactory = new ethers.ContractFactory(
    AgentScoreArtifact.abi,
    AgentScoreArtifact.bytecode,
    wallet
  );
  const agentScore = await AgentScoreFactory.deploy(NEW_ORACLE_ADDRESS);
  await agentScore.waitForDeployment();
  const agentScoreAddress = await agentScore.getAddress();
  console.log("     ✅ AgentScoreAttestation:", agentScoreAddress);

  // ── 2. Deploy LendingPool ────────────────────────────────
  console.log("2/5  Deploying LendingPool ...");
  const LendingPoolFactory = new ethers.ContractFactory(
    LendingPoolArtifact.abi,
    LendingPoolArtifact.bytecode,
    wallet
  );
  const lendingPool = await LendingPoolFactory.deploy(PYUSD_ADDRESS, agentScoreAddress);
  await lendingPool.waitForDeployment();
  const lendingPoolAddress = await lendingPool.getAddress();
  console.log("     ✅ LendingPool:", lendingPoolAddress);

  // ── 3. Deploy X402Processor ──────────────────────────────
  console.log("3/5  Deploying X402Processor ...");
  const X402Factory = new ethers.ContractFactory(
    X402Artifact.abi,
    X402Artifact.bytecode,
    wallet
  );
  const x402 = await X402Factory.deploy(lendingPoolAddress);
  await x402.waitForDeployment();
  const x402Address = await x402.getAddress();
  console.log("     ✅ X402Processor:", x402Address);

  // ── 4. Wire contracts ────────────────────────────────────
  console.log("4/5  Wiring contracts ...");
  const setProcTx = await lendingPool.setX402Processor(x402Address);
  await setProcTx.wait();
  console.log("     ✅ LendingPool.setX402Processor(", x402Address, ")");

  // ── 5. Transfer ownership to NEW_ADMIN_ADDRESS ───────────
  console.log("5/5  Transferring ownership ...");
  const txPoolOwn = await lendingPool.transferOwnership(NEW_ADMIN_ADDRESS);
  await txPoolOwn.wait();
  console.log("     ✅ LendingPool.transferOwnership →", NEW_ADMIN_ADDRESS);

  const txX402Own = await x402.transferOwnership(NEW_ADMIN_ADDRESS);
  await txX402Own.wait();
  console.log("     ✅ X402Processor.transferOwnership →", NEW_ADMIN_ADDRESS);

  // ── Summary ──────────────────────────────────────────────
  const result = {
    agentScoreAttestation: agentScoreAddress,
    lendingPool:           lendingPoolAddress,
    x402Processor:         x402Address,
    pyusd:                 PYUSD_ADDRESS,
    oracle:                NEW_ORACLE_ADDRESS,
    poolOwner:             NEW_ADMIN_ADDRESS,
    deployer:              wallet.address,
    network:               "kite-testnet",
    chainId:               2368,
    deployedAt:            new Date().toISOString(),
  };

  console.log("\n==============================");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("==============================");
  console.log(JSON.stringify(result, null, 2));

  // Save to both deployed-addresses.json locations
  const oraclePath  = path.resolve("oracle-backend/deployed-addresses.json");
  const frontendPath = path.resolve("frontend/contracts/deployed-addresses.json");
  const json = JSON.stringify(result, null, 2) + "\n";
  fs.writeFileSync(oraclePath, json);
  fs.writeFileSync(frontendPath, json);
  console.log("\nAddresses saved to:");
  console.log("  ", oraclePath);
  console.log("  ", frontendPath);
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
