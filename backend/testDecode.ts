import { ethers } from "ethers";
import fs from "fs";

const LENDING_POOL_ABI = [
  "function borrow(uint256 amount) external",
  "function borrowers(address) external view returns (uint256 borrowedAmount, uint256 lastBorrowTime, uint256 collateralAmount, bool isCollateralLocked, uint256 interestRateBps, uint256 accruedInterest, uint256 lastInterestUpdate)",
  "function getScore(address) external view returns (uint16 score, uint32 timestamp)",
  "event Borrowed(address indexed borrower, uint256 amount)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const data = JSON.parse(fs.readFileSync("./local-test-data.json", "utf8"));
  
  const receipt = await provider.getTransactionReceipt(data.txHash);
  if (!receipt) {
    console.log("Receipt not found!");
    return;
  }

  const iface = new ethers.Interface(LENDING_POOL_ABI);
  let borrowerFound = "";
  let amountFoundWei = 0n;

  for (const log of receipt.logs) {
    try {
      const parsedLog = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsedLog && parsedLog.name === "Borrowed") {
        borrowerFound = parsedLog.args[0];
        amountFoundWei = parsedLog.args[1];
        break;
      }
    } catch (e) {
      // ignore
    }
  }

  console.log("--- Backend Decoding Logic Result ---");
  console.log("Expected Borrower:", data.borrower);
  console.log("Extracted Borrower:", borrowerFound);
  console.log("Expected Amount:", data.amount);
  console.log("Extracted Amount:", amountFoundWei.toString());
  console.log("Match Borrower:", data.borrower.toLowerCase() === borrowerFound.toLowerCase());
  console.log("Match Amount:", data.amount === amountFoundWei.toString());
}

main().catch(console.error);
