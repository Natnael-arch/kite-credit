import { ethers } from "ethers";

// 1. Setup Wallet & Network
const KITE_RPC = "https://rpc-testnet.gokite.ai/";
const provider = new ethers.JsonRpcProvider(KITE_RPC);

const privateKey = process.env.AGENT_PRIVATE_KEY;
if (!privateKey) throw new Error("Set AGENT_PRIVATE_KEY env var before running");

const wallet = new ethers.Wallet(privateKey, provider);

// 2. Oracle & Token Details
const PYUSD_ADDRESS = "0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9";
const ORACLE_WALLET = "0xC201B98d96d09f2B15Cb7fe8E8c40Da6D664B15c";
const AMOUNT = "10000000000000000"; // 0.01 PYUSD

// Minimal ERC-20 ABI for transfer
const ERC20_ABI = ["function transfer(address to, uint256 amount) returns (bool)"];
const pyusdContract = new ethers.Contract(PYUSD_ADDRESS, ERC20_ABI, wallet);

async function triggerAttestation() {
  console.log(`Sending 0.01 PYUSD from ${wallet.address} to Oracle...`);
  
  // 1. Send the payment transaction on-chain
  const tx = await pyusdContract.transfer(ORACLE_WALLET, AMOUNT);
  console.log(`Transaction sent! Waiting for confirmation... Hash: ${tx.hash}`);
  
  await tx.wait();
  console.log("Transaction confirmed on Kite Testnet.");

  // 2. Construct the x-payment header
  const paymentPayload = JSON.stringify({ txHash: tx.hash });
  const xPaymentHeader = Buffer.from(paymentPayload).toString('base64');
  console.log(`x-payment header generated: ${xPaymentHeader}`);

  // 3. Hit the Oracle endpoint to compute and attest the score
  const ORACLE_URL = `https://illustrious-cat-production.up.railway.app/score/${wallet.address}`;
  console.log(`Calling Oracle to attest score at ${ORACLE_URL}...`);

  const response = await fetch(ORACLE_URL, {
    method: "GET",
    headers: {
      "x-payment": xPaymentHeader
    }
  });

  const data = await response.json();
  if (response.ok) {
    console.log("✅ Attestation Successful!");
    console.log(`Score: ${data.score} (${data.grade})`);
    console.log(`Attestation Tx: ${data.explorerUrl}`);
  } else {
    console.error("❌ Attestation Failed:", data);
  }
}

triggerAttestation().catch(console.error);
