const { expect } = require("chai");
const { ethers } = require("hardhat");

const DECIMALS = 18;
const parse = (v) => ethers.utils.parseUnits(v, DECIMALS);
const ONE_HUNDRED = parse("100");
const DAY = 86400;
const INTEREST_RATE_BPS = 500;

function computeInterest(principal, rateBps, elapsedSeconds) {
  return principal.mul(rateBps).mul(elapsedSeconds).div(10000 * 365 * DAY);
}

describe("LendingPool (ERC-4626 Share Accounting)", function () {
  let pyusd, scoreOracle, lendingPool;
  let owner, depositorA, depositorB, borrower;

  async function deployFresh() {
    const ERC20 = await ethers.getContractFactory("TestERC20");
    const tok = await ERC20.deploy("PYUSD", "PYUSD", DECIMALS);
    await tok.deployed();

    const Oracle = await ethers.getContractFactory("TestScoreOracle");
    const ora = await Oracle.deploy();
    await ora.deployed();

    const LP = await ethers.getContractFactory("LendingPool");
    const pool = await LP.deploy(tok.address, ora.address);
    await pool.deployed();

    const signers = await ethers.getSigners();
    for (const s of [signers[1], signers[2], signers[3]]) {
      await tok.transfer(s.address, parse("1000"));
      await tok.connect(s).approve(pool.address, ethers.constants.MaxUint256);
    }

    return { tok, ora, pool };
  }

  before(async function () {
    [owner, depositorA, depositorB, borrower] = await ethers.getSigners();
    const deployed = await deployFresh();
    pyusd = deployed.tok;
    scoreOracle = deployed.ora;
    lendingPool = deployed.pool;

    await scoreOracle.setScore(borrower.address, 800);
  });

  describe("Deposits & Share Accounting", function () {
    it("should accept first deposit and mint equal shares", async function () {
      await lendingPool.connect(depositorA).deposit(ONE_HUNDRED);

      expect(await lendingPool.totalShares()).to.equal(ONE_HUNDRED);
      expect(await lendingPool.totalAssets()).to.equal(ONE_HUNDRED);
      expect(await lendingPool.shares(depositorA.address)).to.equal(ONE_HUNDRED);

      const [assets] = await lendingPool.getLenderPosition(depositorA.address);
      expect(assets).to.equal(ONE_HUNDRED);
    });

    it("should mint proportional shares for second depositor", async function () {
      await lendingPool.connect(depositorB).deposit(ONE_HUNDRED);

      expect(await lendingPool.totalShares()).to.equal(ONE_HUNDRED.mul(2));
      expect(await lendingPool.totalAssets()).to.equal(ONE_HUNDRED.mul(2));
      expect(await lendingPool.shares(depositorB.address)).to.equal(ONE_HUNDRED);
    });
  });

  describe("Borrow & Repay — yield flows to depositors", function () {
    it("should increase share value when borrower repays interest", async function () {
      const borrowAmount = parse("50");

      await lendingPool.connect(borrower).borrow(borrowAmount);

      // Advance time so interest accrues: ~180 days at 5% on 50
      await ethers.provider.send("evm_increaseTime", [180 * DAY]);
      await ethers.provider.send("evm_mine");

      // Refresh score (it went stale during the time advance)
      await scoreOracle.setScore(borrower.address, 800);

      // Repay the full amount due (principal + accrued interest)
      // accrueInterest is now public so we can trigger on-chain accrual before reading
      await lendingPool.accrueInterest(borrower.address);
      const bData = await lendingPool.borrowers(borrower.address);
      await lendingPool.connect(borrower).repay(borrower.address, bData.borrowedAmount.add(bData.accruedInterest));

      // totalAssets grew from 200 to >200
      const totalAssets = await lendingPool.totalAssets();
      expect(totalAssets).to.be.gt(ONE_HUNDRED.mul(2));

      const [posA] = await lendingPool.getLenderPosition(depositorA.address);
      const [posB] = await lendingPool.getLenderPosition(depositorB.address);

      // Equal shares → equal value
      expect(posA).to.equal(posB);
      expect(posA).to.be.gt(ONE_HUNDRED);
    });
  });

  describe("Two depositors at different times — no dilution", function () {
    it("should not dilute earlier depositor when later one joins after yield accrued", async function () {
      const { tok, ora, pool } = await deployFresh();

      const [alice, bob, charlie] = [depositorA, depositorB, borrower];
      for (const u of [alice, bob, charlie]) {
        await tok.transfer(u.address, parse("1000"));
        await tok.connect(u).approve(pool.address, ethers.constants.MaxUint256);
      }
      await ora.setScore(charlie.address, 800);

      // 1. Alice deposits 100
      await pool.connect(alice).deposit(ONE_HUNDRED);
      expect(await pool.shares(alice.address)).to.equal(ONE_HUNDRED);

      // 2. Borrower borrows 50, repays with interest BEFORE Bob joins
      const borrowAmt = parse("50");
      await pool.connect(charlie).borrow(borrowAmt);
      await ethers.provider.send("evm_increaseTime", [180 * DAY]);
      await ethers.provider.send("evm_mine");

      await ora.setScore(charlie.address, 800); // refresh stale score

      // Accrue on-chain, then read and repay full amount
      await pool.accrueInterest(charlie.address);
      const bData = await pool.borrowers(charlie.address);
      await pool.connect(charlie).repay(charlie.address, bData.borrowedAmount.add(bData.accruedInterest));

      // totalAssets = 100 + interest (> 100), totalShares unchanged at 100
      const assetsAfterYield = await pool.totalAssets();
      expect(assetsAfterYield).to.be.gt(ONE_HUNDRED);

      // 3. Bob deposits 50 AFTER yield — gets fewer shares
      const bobDeposit = parse("50");
      await pool.connect(bob).deposit(bobDeposit);

      const bobShares = await pool.shares(bob.address);
      // Bob's shares = 50 * 100 / assetsAfterYield < 50
      expect(bobShares).to.be.lt(parse("50"));

      // 4. More yield — both gain proportionally
      await pool.connect(charlie).borrow(borrowAmt);
      await ethers.provider.send("evm_increaseTime", [180 * DAY]);
      await ethers.provider.send("evm_mine");

      await ora.setScore(charlie.address, 800); // refresh stale score
      await pool.accrueInterest(charlie.address);
      const bData2 = await pool.borrowers(charlie.address);
      await pool.connect(charlie).repay(charlie.address, bData2.borrowedAmount.add(bData2.accruedInterest));

      const totalShares = await pool.totalShares();
      const totalAssets = await pool.totalAssets();

      const [aliceValue] = await pool.getLenderPosition(alice.address);
      const [bobValue] = await pool.getLenderPosition(bob.address);

      // Alice has more value than Bob
      expect(aliceValue).to.be.gt(bobValue);
      expect(aliceValue).to.be.gt(ONE_HUNDRED);

      // Alice's proportional share of pool
      const aliceExpected = parse("100").mul(totalAssets).div(totalShares);
      expect(aliceValue).to.equal(aliceExpected);
    });
  });

  describe("Insufficient liquidity withdrawal", function () {
    it("should revert with descriptive message when pool cash can't cover withdrawal", async function () {
      const { tok, ora, pool } = await deployFresh();

      await tok.transfer(depositorA.address, parse("1000"));
      await tok.connect(depositorA).approve(pool.address, ethers.constants.MaxUint256);
      await tok.transfer(borrower.address, parse("1000"));
      await tok.connect(borrower).approve(pool.address, ethers.constants.MaxUint256);
      await ora.setScore(borrower.address, 800);

      await pool.connect(depositorA).deposit(ONE_HUNDRED);
      await pool.connect(borrower).borrow(ONE_HUNDRED);

      await expect(
        pool.connect(depositorA).withdraw(ONE_HUNDRED)
      ).to.be.revertedWith("Insufficient pool liquidity, funds currently lent out");
    });
  });

  describe("Withdraw after partial repay", function () {
    it("should allow withdrawal once cash returns", async function () {
      const { tok, ora, pool } = await deployFresh();

      await tok.transfer(depositorA.address, parse("1000"));
      await tok.connect(depositorA).approve(pool.address, ethers.constants.MaxUint256);
      await tok.transfer(borrower.address, parse("1000"));
      await tok.connect(borrower).approve(pool.address, ethers.constants.MaxUint256);
      await ora.setScore(borrower.address, 800);

      await pool.connect(depositorA).deposit(ONE_HUNDRED);
      await pool.connect(borrower).borrow(parse("80"));

      // Full withdrawal should fail
      await expect(
        pool.connect(depositorA).withdraw(ONE_HUNDRED)
      ).to.be.revertedWith("Insufficient pool liquidity, funds currently lent out");

      // Accrue on-chain, then read and repay full amount
      await pool.accrueInterest(borrower.address);
      const bData = await pool.borrowers(borrower.address);
      await pool.connect(borrower).repay(borrower.address, bData.borrowedAmount.add(bData.accruedInterest));

      // Now full cash is back
      const cash = await tok.balanceOf(pool.address);
      expect(cash).to.be.gte(ONE_HUNDRED);

      // Withdraw the full withdrawable amount
      const maxW = await pool.maxWithdraw(depositorA.address);
      await pool.connect(depositorA).withdraw(maxW);

      // After withdrawing max, lender should have negligible shares left (micro-dust)
      const finalShares = await pool.shares(depositorA.address);
      expect(finalShares).to.be.lte(parse("0.01"));
    });
  });

  describe("Redeem by shares", function () {
    it("should allow redeeming shares for underlying assets", async function () {
      const { tok, ora, pool } = await deployFresh();

      await tok.transfer(depositorA.address, parse("1000"));
      await tok.connect(depositorA).approve(pool.address, ethers.constants.MaxUint256);
      await pool.connect(depositorA).deposit(ONE_HUNDRED);

      const halfShares = ONE_HUNDRED.div(2);
      await pool.connect(depositorA).redeem(halfShares);

      expect(await pool.shares(depositorA.address)).to.equal(halfShares);
      expect(await pool.totalShares()).to.equal(halfShares);
      expect(await pool.totalAssets()).to.equal(ONE_HUNDRED.div(2));
    });

    it("should reject redeeming more shares than owned", async function () {
      const { tok, ora, pool } = await deployFresh();

      await tok.transfer(depositorA.address, parse("1000"));
      await tok.connect(depositorA).approve(pool.address, ethers.constants.MaxUint256);
      await pool.connect(depositorA).deposit(ONE_HUNDRED);

      await expect(
        pool.connect(depositorA).redeem(ONE_HUNDRED.mul(2))
      ).to.be.revertedWith("Insufficient shares");
    });
  });

  describe("Full end-to-end cycle", function () {
    it("should complete: deposit → borrow → repay → withdraw", async function () {
      const { tok, ora, pool } = await deployFresh();

      await tok.transfer(depositorA.address, parse("1000"));
      await tok.connect(depositorA).approve(pool.address, ethers.constants.MaxUint256);
      await tok.transfer(borrower.address, parse("1000"));
      await tok.connect(borrower).approve(pool.address, ethers.constants.MaxUint256);
      await ora.setScore(borrower.address, 800);

      // Deposit
      await pool.connect(depositorA).deposit(ONE_HUNDRED);
      expect(await pool.totalAssets()).to.equal(ONE_HUNDRED);

      // Borrow
      await pool.connect(borrower).borrow(parse("60"));
      expect(await pool.totalBorrowed()).to.equal(parse("60"));

      // Advance time
      await ethers.provider.send("evm_increaseTime", [180 * DAY]);
      await ethers.provider.send("evm_mine");

      // Refresh score
      await ora.setScore(borrower.address, 800);

      // Accrue on-chain, then read and repay full amount due
      await pool.accrueInterest(borrower.address);
      const bData = await pool.borrowers(borrower.address);
      await pool.connect(borrower).repay(borrower.address, bData.borrowedAmount.add(bData.accruedInterest));

      expect(await pool.totalAssets()).to.be.gt(ONE_HUNDRED);
      // totalBorrowed may have micro-dust (1-2 s of interest · block-timestamp drift)
      expect(await pool.totalBorrowed()).to.be.lte(parse("0.01"));

      // Withdraw all
      const maxW = await pool.maxWithdraw(depositorA.address);
      await pool.connect(depositorA).withdraw(maxW);

      // Micro-dust from rounding (≤ 0.01 PYUSD) is acceptable
      const [final] = await pool.getLenderPosition(depositorA.address);
      expect(final).to.be.lte(parse("0.01"));
      expect(await pool.totalShares()).to.be.lte(parse("0.01"));
      expect(await pool.totalAssets()).to.be.lte(parse("0.01"));
    });
  });
});
