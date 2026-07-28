const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");

async function main() {
  const [owner, depositor, borrower] = await ethers.getSigners();
  const DECIMALS = 18;
  const parse = (v) => ethers.utils.parseUnits(v, DECIMALS);
  const ONE_HUNDRED = parse("100");

  const ERC20 = await ethers.getContractFactory("TestERC20");
  const tok = await ERC20.deploy("PYUSD", "PYUSD", DECIMALS);
  await tok.deployed();

  const Oracle = await ethers.getContractFactory("TestScoreOracle");
  const ora = await Oracle.deploy();
  await ora.deployed();

  const LP = await ethers.getContractFactory("LendingPool");
  const pool = await LP.deploy(tok.address, ora.address);
  await pool.deployed();

  await tok.transfer(depositor.address, parse("1000"));
  await tok.connect(depositor).approve(pool.address, ethers.constants.MaxUint256);
  await pool.connect(depositor).deposit(ONE_HUNDRED);

  await ora.setScore(borrower.address, 800);

  const borrowAmount = parse("50");
  const tx = await pool.connect(borrower).borrow(borrowAmount);
  const receipt = await tx.wait();

  console.log("TX_HASH:", tx.hash);
  console.log("POOL_ADDRESS:", pool.address);
  console.log("BORROWER:", borrower.address);
  console.log("AMOUNT:", "50000000000000000000");

  fs.writeFileSync("/home/nate/AgentScore-main/backend/local-test-data.json", JSON.stringify({
    txHash: tx.hash,
    poolAddress: pool.address,
    borrower: borrower.address,
    amount: "50000000000000000000"
  }));
}

main().catch(console.error);
