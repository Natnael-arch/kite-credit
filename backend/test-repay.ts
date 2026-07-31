import { ethers } from "ethers";

const RPC_URL = "https://rpc-testnet.gokite.ai";
const LENDING_POOL_ADDRESS = "0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE";
const PYUSD_ADDRESS = "0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9";
const AGENT_PRIVATE_KEY = "32db4730c6d7c7fe0d2bb3ef23602fb28c97b5b6420d1d342a4241316e3a95c8";

const PYUSD_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

const LENDING_POOL_ABI = [
  "function repay(address _borrower, uint256 amount) external",
  "function getBorrowerPosition(address borrower) view returns (uint256 borrowedAmount, uint256 collateralAmount)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY, provider);
  console.log("Wallet Address:", wallet.address);

  const pyusd = new ethers.Contract(PYUSD_ADDRESS, PYUSD_ABI, wallet);
  const pool = new ethers.Contract(LENDING_POOL_ADDRESS, LENDING_POOL_ABI, wallet);

  // 1. Get before liquidity
  const beforeLiquidity = await pyusd.balanceOf(LENDING_POOL_ADDRESS);
  console.log("Before Liquidity:", ethers.formatUnits(beforeLiquidity, 18), "PYUSD");

  // 2. Get borrower position
  const pos = await pool.getBorrowerPosition(wallet.address);
  console.log("Borrowed Amount:", ethers.formatUnits(pos[0], 18), "PYUSD");

  if (pos[0] === BigInt(0)) {
    console.log("Nothing to repay!");
    return;
  }

  // We'll repay 1 PYUSD or whatever is owed if less than 1
  const amountToRepay = pos[0] > ethers.parseUnits("1", 18) ? ethers.parseUnits("1", 18) : pos[0];
  console.log(`Repaying ${ethers.formatUnits(amountToRepay, 18)} PYUSD...`);

  // 3. Approve
  console.log("Approving...");
  const tx1 = await pyusd.approve(LENDING_POOL_ADDRESS, amountToRepay);
  await tx1.wait();
  console.log("Approved! txHash:", tx1.hash);

  // 4. Repay
  console.log("Repaying...");
  const tx2 = await pool.repay(wallet.address, amountToRepay);
  const receipt = await tx2.wait();
  console.log("Repaid! txHash:", tx2.hash);

  // 5. Get after liquidity
  const afterLiquidity = await pyusd.balanceOf(LENDING_POOL_ADDRESS);
  console.log("After Liquidity:", ethers.formatUnits(afterLiquidity, 18), "PYUSD");

  // 6. Call backend
  const message = "auth_request";
  const signature = await wallet.signMessage(message);

  console.log("Calling backend...");
  // Use the railway URL if localhost is down, but let's try local first
  let res;
  try {
    res = await fetch("http://127.0.0.1:3002/api/loans/repay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-agent-signature": signature,
        "x-agent-message": message,
        "x-agent-address": wallet.address
      },
      body: JSON.stringify({
        borrower_address: wallet.address,
        amount: ethers.formatUnits(amountToRepay, 18),
        txHash: tx2.hash
      })
    });
  } catch (e) {
    console.log("Local backend failed, trying production backend on Railway...");
    res = await fetch("https://agent-score-backend.up.railway.app/api/loans/repay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-agent-signature": signature,
        "x-agent-message": message,
        "x-agent-address": wallet.address
      },
      body: JSON.stringify({
        borrower_address: wallet.address,
        amount: ethers.formatUnits(amountToRepay, 18),
        txHash: tx2.hash
      })
    });
  }

  const text = await res.text();
  console.log("Backend response:", res.status, text);
}

main().catch(console.error);
