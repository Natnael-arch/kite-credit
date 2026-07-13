// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IAgentScoreAttestation {
    function getScore(address agent) external view returns (uint16 score, uint32 timestamp);
}

contract LendingPool is Ownable, ReentrancyGuard {
    IERC20 public pyusdToken;
    IAgentScoreAttestation public scoreOracle;
    address public x402Processor;

    // ── ERC-4626 style share accounting ──
    uint256 public totalShares;
    uint256 public totalAssets;

    mapping(address => uint256) public shares;

    address[] public lenderList;

    // ── Borrower tracking ──
    struct Borrower {
        uint256 borrowedAmount;
        uint256 lastBorrowTime;
        uint256 collateralAmount;
        bool isCollateralLocked;
        uint256 interestRateBps;
        uint256 accruedInterest;
        uint256 lastInterestUpdate;
    }

    mapping(address => Borrower) public borrowers;
    address[] public borrowerList;

    uint256 public totalBorrowed;
    uint256 public interestRate = 500;
    uint256 public baseCollateralRatio = 150;

    uint256 public totalInterestAccrued;
    uint256 public totalInterestCollected;

    // ── Loan repayment tracking ──
    struct RepaymentRecord {
        uint256 loanId;
        uint256 amount;
        bool    fullyRepaid;
        uint256 timestamp;
    }

    mapping(address => RepaymentRecord[]) public repaymentHistory;
    uint256 public nextLoanId = 1;

    event Deposited(address indexed lender, uint256 assets, uint256 sharesMinted);
    event Withdrawn(address indexed lender, uint256 assets, uint256 sharesBurned);
    event Borrowed(address indexed borrower, uint256 amount);
    event Repaid(address indexed borrower, uint256 amount);
    event CollateralAdded(address indexed borrower, uint256 amount);
    event InterestPaid(address indexed borrower, uint256 amount);
    event LoanRepayment(
        address indexed agent,
        uint256 amount,
        uint256 loanId,
        bool    fullyRepaid,
        uint256 timestamp
    );

    constructor(address _pyusdToken, address _scoreOracle) {
        pyusdToken = IERC20(_pyusdToken);
        scoreOracle = IAgentScoreAttestation(_scoreOracle);
    }

    function setX402Processor(address _processor) external onlyOwner {
        x402Processor = _processor;
    }

    // ── Share conversion math ──

    function convertToShares(uint256 _assets) public view returns (uint256) {
        if (totalShares == 0) return _assets;
        return (_assets * totalShares) / totalAssets;
    }

    function convertToAssets(uint256 _shares) public view returns (uint256) {
        if (totalShares == 0) return 0;
        return (_shares * totalAssets) / totalShares;
    }

    function maxWithdraw(address _lender) public view returns (uint256) {
        uint256 userShares = shares[_lender];
        if (userShares == 0) return 0;
        uint256 assets = convertToAssets(userShares);
        uint256 cash = pyusdToken.balanceOf(address(this));
        return assets < cash ? assets : cash;
    }

    // ── Deposit ──

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");

        require(pyusdToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        if (shares[msg.sender] == 0) {
            lenderList.push(msg.sender);
        }

        uint256 mintedShares = convertToShares(amount);
        shares[msg.sender] += mintedShares;
        totalShares += mintedShares;
        totalAssets += amount;

        emit Deposited(msg.sender, amount, mintedShares);
    }

    // ── Withdraw ──

    function withdraw(uint256 assets) external nonReentrant {
        require(assets > 0, "Amount must be greater than 0");

        uint256 userShares = shares[msg.sender];
        uint256 maxAssets = convertToAssets(userShares);
        require(assets <= maxAssets, "Insufficient balance");

        uint256 cash = pyusdToken.balanceOf(address(this));
        require(cash >= assets, "Insufficient pool liquidity, funds currently lent out");

        uint256 sharesToBurn = (assets * totalShares) / totalAssets;
        if (sharesToBurn > userShares) sharesToBurn = userShares;

        shares[msg.sender] = userShares - sharesToBurn;
        totalShares -= sharesToBurn;
        totalAssets -= assets;

        require(pyusdToken.transfer(msg.sender, assets), "Transfer failed");

        emit Withdrawn(msg.sender, assets, sharesToBurn);
    }

    // ── Redeem (withdraw by shares) ──

    function redeem(uint256 shareAmount) external nonReentrant {
        require(shareAmount > 0, "Amount must be greater than 0");
        require(shares[msg.sender] >= shareAmount, "Insufficient shares");

        uint256 assets = convertToAssets(shareAmount);

        uint256 cash = pyusdToken.balanceOf(address(this));
        require(cash >= assets, "Insufficient pool liquidity, funds currently lent out");

        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;
        totalAssets -= assets;

        require(pyusdToken.transfer(msg.sender, assets), "Transfer failed");

        emit Withdrawn(msg.sender, assets, shareAmount);
    }

    // ── Interest rate by score ──

    function getInterestRateBps(uint16 score) internal pure returns (uint256) {
        if (score >= 750) return 500;
        if (score >= 700) return 1000;
        if (score >= 600) return 1500;
        return 2000;
    }

    function accrueInterest(address borrowerAddr) public {
        Borrower storage b = borrowers[borrowerAddr];
        if (b.borrowedAmount == 0) return;

        uint256 elapsed = block.timestamp - b.lastInterestUpdate;
        uint256 interest = (b.borrowedAmount * b.interestRateBps * elapsed) / (10000 * 365 days);

        b.accruedInterest += interest;
        b.lastInterestUpdate = block.timestamp;
        totalInterestAccrued += interest;
    }

    // ── Borrow ──

    function borrow(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");

        (uint16 rawScore, uint32 timestamp) = scoreOracle.getScore(msg.sender);
        uint256 score = uint256(rawScore);

        require(block.timestamp - timestamp <= 7 days, "Score stale");
        require(score >= 500, "Score too low");

        uint256 maxBorrowable = 0;
        if (score >= 800) {
            maxBorrowable = 500 * (10**18);
        } else if (score >= 700) {
            maxBorrowable = 200 * (10**18);
        } else if (score >= 600) {
            maxBorrowable = 50 * (10**18);
        } else if (score >= 500) {
            maxBorrowable = 10 * (10**18);
        }

        require(maxBorrowable > 0, "Credit score too low to borrow");

        Borrower storage borrower = borrowers[msg.sender];
        require(borrower.borrowedAmount + amount <= maxBorrowable, "Exceeds score-based credit limit");

        // totalAssets includes both cash and outstanding loans; use cash directly
        uint256 cash = pyusdToken.balanceOf(address(this));
        require(cash >= amount, "Insufficient liquidity in pool");

        if (borrower.borrowedAmount == 0) {
            borrowerList.push(msg.sender);
        }

        borrower.interestRateBps = getInterestRateBps(rawScore);
        borrower.lastInterestUpdate = block.timestamp;
        borrower.borrowedAmount += amount;
        borrower.lastBorrowTime = block.timestamp;
        totalBorrowed += amount;

        // totalAssets unchanged: cash decreases but loan receivable increases
        require(pyusdToken.transfer(msg.sender, amount), "Transfer failed");

        emit Borrowed(msg.sender, amount);
    }

    // ── Repay ──

    function repay(address _borrower, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");

        accrueInterest(_borrower);
        Borrower storage b = borrowers[_borrower];

        require(amount <= b.borrowedAmount + b.accruedInterest, "Amount exceeds total owed");

        uint256 remaining = amount;

        require(pyusdToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        // Pay interest first — this increases totalAssets (yield for depositors)
        if (b.accruedInterest > 0 && remaining > 0) {
            uint256 interestPayment = remaining >= b.accruedInterest ? b.accruedInterest : remaining;

            b.accruedInterest -= interestPayment;
            totalInterestCollected += interestPayment;
            remaining -= interestPayment;

            // Interest increases the value of every share proportionally
            totalAssets += interestPayment;

            emit InterestPaid(_borrower, interestPayment);
        }

        // Then pay principal
        uint256 principalPayment = 0;
        if (remaining > 0) {
            principalPayment = remaining >= b.borrowedAmount ? b.borrowedAmount : remaining;
            b.borrowedAmount -= principalPayment;
            totalBorrowed -= principalPayment;
        }

        if (b.borrowedAmount == 0) {
            b.isCollateralLocked = false;
        }

        emit Repaid(_borrower, amount);

        bool fullyRepaid = (b.borrowedAmount == 0);
        uint256 loanId = nextLoanId++;

        emit LoanRepayment(
            _borrower,
            principalPayment,
            loanId,
            fullyRepaid,
            block.timestamp
        );

        repaymentHistory[_borrower].push(RepaymentRecord({
            loanId: loanId,
            amount: principalPayment,
            fullyRepaid: fullyRepaid,
            timestamp: block.timestamp
        }));
    }

    // ── Collateral ──

    function addCollateral(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");

        require(pyusdToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        Borrower storage borrower = borrowers[msg.sender];
        borrower.collateralAmount += amount;

        emit CollateralAdded(msg.sender, amount);
    }

    // ── View functions ──

    function getLenderPosition(address lender) external view returns (uint256 depositedAssets, uint256 earnedInterest) {
        uint256 userShares = shares[lender];
        if (userShares == 0) return (0, 0);
        uint256 assetValue = convertToAssets(userShares);
        if (totalShares == 0) return (0, 0);
        return (assetValue, 0);
    }

    function getBorrowerPosition(address borrower) external view returns (uint256 borrowedAmount, uint256 collateralAmount) {
        return (borrowers[borrower].borrowedAmount, borrowers[borrower].collateralAmount);
    }

    function getPoolStats() external view returns (
        uint256 _totalDeposits,
        uint256 _totalBorrowed,
        uint256 _availableLiquidity,
        uint256 _interestRate
    ) {
        uint256 cash = pyusdToken.balanceOf(address(this));
        return (totalAssets, totalBorrowed, cash, interestRate);
    }

    function setInterestRate(uint256 newRate) external onlyOwner {
        require(newRate <= 2000, "Interest rate too high");
        interestRate = newRate;
    }

    function setCollateralRatio(uint256 newRatio) external onlyOwner {
        require(newRatio >= 100 && newRatio <= 300, "Invalid collateral ratio");
        baseCollateralRatio = newRatio;
    }

    function emergencyWithdraw() external onlyOwner {
        uint256 balance = pyusdToken.balanceOf(address(this));
        require(pyusdToken.transfer(owner(), balance), "Transfer failed");
    }
}
