const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Starting LendingPool-only redeployment...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const network = await ethers.provider.getNetwork();
  console.log("Connected to network:", network.name, "chainId:", network.chainId);

  // ── Existing contracts (do NOT redeploy) ──
  const AGENT_SCORE_ATTESTATION = "0x71DA928CbCF09515112eE792123b1F32A2229458";
  const PYUSD_ADDRESS = "0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9";
  const X402_PROCESSOR = "0xd414b8c0c4FF3F3a1befc2a13293EE4BCF39F337";
  const OLD_LENDING_POOL = "0x16c110a07640831b98EF82dFFa3D2eBF8c8067dE";

  console.log("\nExisting contracts (unchanged):");
  console.log("  AgentScoreAttestation:", AGENT_SCORE_ATTESTATION);
  console.log("  PYUSD Token:          ", PYUSD_ADDRESS);
  console.log("  X402Processor:        ", X402_PROCESSOR);

  // ── 1. Deploy new LendingPool ──
  console.log("\nDeploying new LendingPool...");
  const LendingPool = await ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(PYUSD_ADDRESS, AGENT_SCORE_ATTESTATION);
  await lendingPool.deployed();
  console.log("New LendingPool deployed to:", lendingPool.address);
  console.log("Old LendingPool was at:     ", OLD_LENDING_POOL);

  // ── 2. Point new LendingPool to existing X402Processor ──
  console.log("\nSetting X402Processor on new LendingPool...");
  const setProcTx = await lendingPool.setX402Processor(X402_PROCESSOR);
  await setProcTx.wait();
  console.log("  LendingPool.setX402Processor tx:", setProcTx.hash);

  // ── 3. Repoint existing X402Processor to new LendingPool ──
  console.log("\nRepointing existing X402Processor to new LendingPool...");
  const X402Abi = ["function setLendingPool(address) external", "function owner() view returns (address)"];
  const x402 = new ethers.Contract(X402_PROCESSOR, X402Abi, deployer);

  const currentOwner = await x402.owner();
  console.log("  X402Processor owner:", currentOwner);
  console.log("  Deployer:          ", deployer.address);
  if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error("Deployer is not the X402Processor owner — cannot call setLendingPool");
  }

  const repointTx = await x402.setLendingPool(lendingPool.address);
  const repointReceipt = await repointTx.wait();
  console.log("  setLendingPool tx:", repointTx.hash);
  console.log("  Confirmed in block:", repointReceipt.blockNumber);

  // ── 4. Summary ──
  console.log("\n==============================");
  console.log("Deployment Summary");
  console.log("==============================");
  console.log("Old LendingPool: ", OLD_LENDING_POOL);
  console.log("New LendingPool: ", lendingPool.address);
  console.log("X402Processor:   ", X402_PROCESSOR, "(repointed)");
  console.log("AgentScoreAttest:", AGENT_SCORE_ATTESTATION, "(unchanged)");
  console.log("PYUSD:           ", PYUSD_ADDRESS, "(unchanged)");
  console.log("setLendingPool tx:", repointTx.hash);

  // ── 5. Save addresses ──
  const addresses = {
    agentScoreAttestation: AGENT_SCORE_ATTESTATION,
    lendingPool: lendingPool.address,
    x402Processor: X402_PROCESSOR,
    pyusd: PYUSD_ADDRESS,
    deployer: deployer.address,
    network: network.chainId === 2368 ? "kite-testnet" : "local-hardhat",
    chainId: network.chainId,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
  console.log("\nAddresses saved to deployed-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
