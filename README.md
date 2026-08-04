# KiteCredit Protocol

**On-chain credit infrastructure for AI agents on [Kite AI](https://gokite.ai).**

KiteCredit lets autonomous AI agents build verifiable credit scores through real on-chain behavior, borrow undercollateralized PYUSD loans based on that reputation, and repay automatically through trading profits — all governed by smart contracts on the Kite AI testnet.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Repository Structure](#repository-structure)
- [Smart Contracts](#smart-contracts)
- [Oracle Backend](#oracle-backend)
- [Backend API](#backend-api)
- [Frontend](#frontend)
- [Autonomous Agent](#autonomous-agent)
- [Trading Agent](#trading-agent)
- [Deployed Addresses](#deployed-addresses)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Development Scripts](#development-scripts)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          KiteCredit Protocol                                 │
│                                                                              │
│  ┌─────────────┐     ┌──────────────┐     ┌────────────────────────────┐    │
│  │   Frontend   │────▶│  Backend API  │────▶│       Kite AI Chain        │    │
│  │  (React/Vite)│     │  (Express)    │     │  ┌────────────────────┐   │    │
│  │              │     │              │     │  │ AgentScoreAttestation│   │    │
│  │  Dashboard   │     │  Routes:     │     │  │ LendingPool         │   │    │
│  │  Lend/Borrow │     │  /agents     │     │  │ X402Processor       │   │    │
│  │  Register    │     │  /loans      │     │  │ TradeVault          │   │    │
│  └──────┬───────┘     │  /lending    │     │  └────────────────────┘   │    │
│         │             │  /pool       │     └────────────┬───────────────┘    │
│         │             │  /transactions│                  │                    │
│         │             └──────┬───────┘                  │                    │
│         │                    │                          │                    │
│         ▼                    ▼                          ▼                    │
│  ┌─────────────┐     ┌──────────────┐     ┌────────────────────────────┐    │
│  │ Wallet       │     │ Oracle Backend│────▶│     Scoring Engine         │    │
│  │ (MetaMask/   │     │ (x402 Gated) │     │  ┌───────────────────┐    │    │
│  │  WalletConnect│    │              │     │  │ Repayment History  │    │    │
│  │  Coinbase)   │     │  /score/:addr │     │  │ Payment Reliability│    │    │
│  └──────────────┘     └──────────────┘     │  │ Counterparty Div.  │    │    │
│                                            │  │ Account Age        │    │    │
│  ┌─────────────────────────────────────┐   │  │ Session Discipline │    │    │
│  │        Autonomous Agents            │   │  └───────────────────┘    │    │
│  │  ┌────────────┐  ┌──────────────┐  │   └────────────────────────────┘    │
│  │  │ Summariser │  │Trading Agent │  │                                     │
│  │  │ Agent      │  │(ETH Signals) │  │                                     │
│  │  └────────────┘  └──────────────┘  │                                     │
│  └─────────────────────────────────────┘                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Core Flow:**

1. An AI agent registers on-chain and builds transaction history through real usage.
2. The Oracle scores the agent (300–850) using on-chain repayment history, payment reliability, counterparty diversity, and account age.
3. The score is attested on-chain to the `AgentScoreAttestation` contract.
4. The `LendingPool` reads the attested score to determine loan eligibility and terms.
5. The agent borrows undercollateralized PYUSD and uses it (e.g., for trading).
6. Trading profits are routed through the `X402Processor`, which splits payments: 30% to the lending pool (loan repayment), 70% to the agent.

---

## Repository Structure

```
AgentScore-main/
├── contracts/                  # Solidity smart contracts (Hardhat)
│   └── contracts/
│       ├── AgentScoreAttestation.sol   # On-chain credit score attestation
│       └── TradeVault.sol             # On-chain position tracker for trading agent
│
├── backend/                    # Express API server (port 3002)
│   └── src/
│       ├── index.ts            # Server entry point
│       ├── config.ts           # Config + Supabase/local-DB abstraction
│       ├── routes/
│       │   ├── agents.ts       # Agent registration, lookup, Passport verification
│       │   ├── loans.ts        # Borrow/repay with on-chain tx verification
│       │   ├── lending.ts      # Lender deposit/withdraw tracking
│       │   ├── pool.ts         # Pool stats + real TVL history from chain events
│       │   └── transactions.ts # Transaction recording with auto loan repayment splits
│       ├── middleware/
│       │   └── auth.ts         # EIP-191 signature verification middleware
│       └── services/
│           ├── indexer.ts      # Polling blockchain indexer for events
│           ├── loanEngine.ts   # Credit tier logic (score → max loan, interest rate)
│           └── gasless.ts      # EIP-3009 gasless PYUSD transfers via Kite API
│
├── oracle-backend/             # Oracle scoring service (port 3005)
│   ├── server.ts               # Express server with x402 payment gating
│   ├── scorer.ts               # Multi-factor scoring engine (300–850)
│   ├── attester.ts             # On-chain score attestation via contract call
│   └── deployed-addresses.json # Current contract addresses
│
├── frontend/                   # React + Vite + TailwindCSS dashboard
│   └── src/
│       ├── App.tsx             # Router and provider setup
│       ├── pages/
│       │   ├── Dashboard.tsx   # Main dashboard with TVL, agents, stats
│       │   ├── Lend.tsx        # Deposit/withdraw PYUSD into lending pool
│       │   ├── Borrow.tsx      # Borrow against credit score
│       │   └── RegisterAgent.tsx # Register agent with Kite Passport check
│       ├── components/
│       │   ├── TVLChart.tsx     # Real-time TVL chart from on-chain deposit history
│       │   ├── Layout.tsx      # App shell with navigation
│       │   ├── WalletButton.tsx # Multi-wallet connector (MetaMask, WalletConnect, etc.)
│       │   └── ...             # StatCard, GlassCard, CreditScoreGauge, etc.
│       ├── lib/
│       │   ├── contracts.ts    # Wagmi hooks for all contract interactions
│       │   ├── web3-config.ts  # Kite testnet chain definition + contract addresses
│       │   └── api.ts          # Backend API client
│       └── contexts/
│           └── WalletContext.tsx # Wallet connection state management
│
├── agent/                      # x402-compatible summariser agent
│   └── agent.ts                # Express server serving /summarise with on-chain payment
│
├── trading-agent/              # Autonomous ETH trading agent with live dashboard
│   ├── agent.ts                # Main trading loop with WebSocket state broadcasting
│   ├── scorer.ts               # Agent score fetching + Kite Passport MCP integration
│   └── vault.ts                # TradeVault contract interaction helpers
│
└── scripts/
    └── deploy-all.ts           # Full contract redeployment script
```

---

## Smart Contracts

All contracts are deployed on **Kite AI Testnet** (Chain ID: `2368`). Compiled with Solidity `0.8.20` using Hardhat.

### AgentScoreAttestation

On-chain registry of AI agent credit scores. Only the designated oracle can write scores; anyone can read them.

| Function | Description |
|---|---|
| `attest(agent, score, paymentRate, diversity, txCount, agentAgeDays)` | Oracle-only. Records a new score (300–850) for an agent. Stores both current state and full history. |
| `getScore(agent)` | Returns `(score, timestamp)`. Called by LendingPool to gate borrowing. |
| `isScoreFresh(agent, maxAgeSeconds)` | Check whether the attestation is recent enough to trust. |
| `getFullRecord(agent)` | Returns the full `ScoreRecord` struct with all scoring factors. |
| `getHistory(agent)` | Returns the complete attestation history array for an agent. |

### LendingPool

Handles PYUSD deposits (lenders earn yield), score-gated borrowing (agents borrow against reputation), and repayments. Reads scores from `AgentScoreAttestation` on-chain — no off-chain trust needed.

Key mechanics:
- **Deposits**: Lenders deposit PYUSD, receive shares proportional to total pool assets.
- **Borrowing**: Score must be ≥ 500 and attested within 7 days. Max loan amount is tiered by score.
- **Repayment**: The `X402Processor` routes 30% of agent income back to the pool automatically.

### X402Processor

Implements the [x402 payment protocol](https://www.x402.org/) for automated income splitting. When an agent earns revenue, the processor enforces a 30/70 split: 30% goes to the lending pool (repaying the loan), 70% stays with the agent.

### TradeVault

On-chain position tracker for the autonomous trading agent. Records leveraged positions with entry/exit prices, P&L, and trade statistics. Enforces stop-loss (3%), take-profit (5%), and max hold time (5 minutes) parameters.

---

## Oracle Backend

**Location:** `oracle-backend/`  
**Port:** `3005` (configurable via `PORT` env)

The oracle is the scoring authority. It computes credit scores using a multi-factor model and attests them on-chain.

### Scoring Engine (`scorer.ts`)

The score ranges from **300 to 850** and is composed of weighted factors:

| Factor | Weight | Max Points | Source |
|---|---|---|---|
| Loan Repayment History | ~40% | 340 | On-chain `LendingPool.repaymentHistory()` |
| Payment Reliability | ~25% | 137 | Kite Passport API (success rate + volume) |
| Counterparty Diversity | ~15% | 82 | Kite Passport API (unique payees) |
| Account Age | ~10% | 55 | Kite Passport API (first payment timestamp) |
| Session Discipline | ~5% | 27 | Kite Passport API (budget limit compliance) |

The scorer has two modes:
- **Primary (Passport):** Uses the [Kite Passport](https://agentpassport.ai) API for complete, verified agent history.
- **Fallback (Legacy):** Falls back to indexed on-chain data if Passport is unavailable.

### x402 Payment Gating (`server.ts`)

The `/score/:addr` endpoint is gated by the x402 protocol:

1. **No payment header** → Returns HTTP `402` with payment requirements (0.01 PYUSD to the oracle wallet).
2. **With `x-payment` header** → Verifies the PYUSD transfer on-chain by decoding ERC20 `Transfer` event logs from the transaction receipt. If valid, computes the score and attests it.

A free `/score/:addr/raw` endpoint exists for UI display without attestation.

### On-Chain Attestation (`attester.ts`)

After scoring, the oracle signs and submits a transaction calling `AgentScoreAttestation.attest()`, permanently recording the score on Kite chain.

---

## Backend API

**Location:** `backend/`  
**Port:** `3002` (configurable via `PORT` env)

The backend is the application layer serving the frontend and managing off-chain state (Supabase or local `db.json` fallback).

### Key Routes

| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/agents` | GET | — | List all registered agents |
| `/api/agents/:address` | GET | — | Get agent details (score, passport status, etc.) |
| `/api/agents` | POST | — | Register a new agent (with Kite Passport verification) |
| `/api/agents/sync-score` | POST | — | Trigger oracle score refresh and cache update |
| `/api/loans/terms/:address` | GET | — | Get on-chain score → loan eligibility and terms |
| `/api/loans/borrow` | POST | Signature | Record a borrow (verifies `Borrowed` event on-chain) |
| `/api/loans/repay` | POST | Signature | Record a repayment (verifies `Repaid`/`LoanRepayment` events) |
| `/api/lending/deposit` | POST | Signature | Record a lender deposit |
| `/api/lending/withdraw` | POST | Signature | Record a lender withdrawal |
| `/api/pool` | GET | — | Pool statistics (from DB) |
| `/api/pool/history` | GET | — | Real TVL history from on-chain `Deposited`/`Withdrawn` events |
| `/api/transactions` | POST | Signature | Record transaction with automatic loan repayment splitting |
| `/api/transactions/recent` | GET | — | Last 20 transactions |

### Authentication (`middleware/auth.ts`)

Mutating endpoints require **EIP-191 message signing**:
- The agent signs `JSON.stringify(body) + timestamp` with their private key.
- Headers: `x-agent-signature` (signature) + `x-timestamp` (Unix ms).
- The middleware recovers the signer address and verifies it matches the request body's agent address.
- Timestamps expire after 5 minutes to prevent replay attacks.

### Blockchain Indexer (`services/indexer.ts`)

A polling-based indexer that scans new blocks for on-chain events:
- `ScoreAttested` → Updates agent score in DB.
- `Borrowed` → Records new loans.
- `PaymentSplit` → Records x402 transactions and processes loan repayments.
- PYUSD transfers by registered agents → Records as transaction history.

Processes blocks in chunks of 100, with checkpoint persistence and exponential backoff on RPC failures.

### Local DB Fallback (`config.ts`)

When Supabase is unreachable, the backend automatically falls back to a local `db.json` file. The `LocalSupabase` class implements a Supabase-compatible API (`from().select().eq().single()`, etc.) against the JSON file, enabling fully offline development.

---

## Frontend

**Location:** `frontend/`  
**Stack:** React 18, Vite, TypeScript, TailwindCSS, Wagmi v3, Viem, Recharts, Framer Motion

### Pages

| Page | Route | Description |
|---|---|---|
| Dashboard | `/` | Protocol overview: TVL chart (real on-chain events), pool stats (read directly from contracts), agent table, credit score gauge, testnet utilities |
| Lend | `/lend` | Deposit/withdraw PYUSD into the lending pool. Shows lender position, pool utilization, and on-chain stats |
| Borrow | `/borrow` | View on-chain credit score, check loan eligibility, execute borrows and repayments |
| Register Agent | `/register` | Register an agent wallet with optional Kite Passport verification |

### On-Chain Reads (`lib/contracts.ts`)

All pool statistics (TVL, total borrowed, interest collected, available liquidity) are read **directly from the smart contracts** via Wagmi's `useReadContracts` hook — no backend intermediary. Key hooks:

- `usePoolOnChainStats()` — Multicall reading `totalAssets`, `totalBorrowed`, `totalInterestAccrued`, `totalInterestCollected`, and PYUSD `balanceOf(pool)`.
- `useDepositToLendingPool()` — Approve + deposit in a single flow.
- `useBorrowFromLendingPool()` — Execute borrow and wait for confirmation.
- `usePayAndAttestScore()` — Full x402 flow: pay oracle → get score → attest on-chain.
- `useSimulateActivity()` — Testnet utility: send 10 PYUSD micro-transfers to build transaction history.

### Wallet Support (`lib/web3-config.ts`)

Configured via Wagmi with connectors for:
- MetaMask
- WalletConnect (v2)
- Coinbase Wallet
- Generic injected providers

### TVL Chart (`components/TVLChart.tsx`)

Fetches real on-chain `Deposited` and `Withdrawn` events from the backend's `/api/pool/history` endpoint. Displays honest, sparse data points for young contracts rather than fabricated smooth curves. The final chart point is always anchored to the live `totalAssets` value from the contract.

---

## Autonomous Agent

**Location:** `agent/`  
**Port:** `4000`

A standalone Express service that acts as an AI agent providing URL summarization via a Gaia LLM node.

### x402 Flow
1. Client calls `POST /summarise` without payment → gets HTTP 402 with terms (0.05 PYUSD).
2. Client pays on-chain and retries with `x-payment` header.
3. Agent verifies the PYUSD transfer on-chain (checks `Transfer` event logs).
4. Agent summarizes the URL using Gaia AI and returns the result.

### Auto-Repayment
After each paid request, the agent checks if it has an outstanding loan on the `LendingPool`. If so, it automatically routes a portion of income toward repayment.

### Self-Scoring
Every 5th request, the agent triggers its own score update by paying the oracle and getting a fresh attestation.

---

## Trading Agent

**Location:** `trading-agent/`  
**Ports:** `4000` (HTTP status) + `4001` (WebSocket dashboard)

A fully autonomous ETH trading agent that borrows capital from the lending pool, trades based on technical indicators, and repays profits through the x402 split mechanism.

### Trading Strategy
- **RSI-based mean reversion:** Opens LONG when RSI < 35 (oversold bounce).
- **Trend momentum:** Opens LONG when trend is UP and RSI < 60.
- **Risk management:** 3% stop-loss, 5% take-profit, 5-minute max hold time (enforced on-chain by `TradeVault`).

### Trading Loop (every 60s)
1. Fetch ETH OHLC data from CoinGecko and compute RSI + trend.
2. Check and close any open positions that hit stop-loss/take-profit/timeout.
3. Route closed profitable positions through `X402Processor` (30% pool / 70% agent split).
4. Evaluate entry signal and open new position if criteria met.
5. Every 5 loops: refresh credit score via Kite Passport.

### Live Dashboard
The agent broadcasts its full state (positions, P&L, score, market data, recent transactions) over WebSocket. The `trading-agent/dashboard/` directory contains a browser UI that connects to this feed.

### Kite Passport Integration (`scorer.ts`)
Integrates with Kite Passport MCP (Model Context Protocol) for session-based x402 payment signing and agent identity verification. Falls back to raw oracle API if no active session.

---

## Deployed Addresses

All contracts are on **Kite AI Testnet** (Chain ID: `2368`):

| Contract | Address |
|---|---|
| AgentScoreAttestation | [`0x71DA928CbCF09515112eE792123b1F32A2229458`](https://testnet.kitescan.ai/address/0x71DA928CbCF09515112eE792123b1F32A2229458) |
| LendingPool | [`0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE`](https://testnet.kitescan.ai/address/0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE) |
| X402Processor | [`0xd414b8c0c4FF3F3a1befc2a13293EE4BCF39F337`](https://testnet.kitescan.ai/address/0xd414b8c0c4FF3F3a1befc2a13293EE4BCF39F337) |
| PYUSD (Testnet) | [`0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9`](https://testnet.kitescan.ai/address/0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9) |
| Oracle Wallet | `0xC201B98d96d09f2B15Cb7fe8E8c40Da6D664B15c` |
| Pool Owner/Admin | `0x8eEd066a9f2A3931d833C7792D98BBFedf3275A2` |

**Deployed:** 2026-07-16

---

## Environment Variables

### Backend (`backend/.env`)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key
KITE_RPC_URL=https://rpc-testnet.gokite.ai
KITE_CHAIN_ID=2368
PORT=3002
LENDING_POOL_ADDRESS=0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE
SCORE_CONTRACT_ADDRESS=0x71DA928CbCF09515112eE792123b1F32A2229458
ORACLE_API_URL=http://localhost:3005
POOL_PRIVATE_KEY=           # Pool admin wallet private key (for gasless transfers)
AGENT_PRIVATE_KEY=          # Agent wallet private key (for autonomous operations)
REQUIRE_PASSPORT=false      # Set to "true" for production (fail-closed)
ALLOW_OFFCHAIN_SCORING=true # Allow non-Passport scoring (testnet only)
```

### Oracle Backend (`oracle-backend/.env`)

```env
KITE_RPC_URL=https://rpc-testnet.gokite.ai/
ORACLE_PRIVATE_KEY=your_oracle_private_key
ORACLE_WALLET_ADDRESS=0xC201B98d96d09f2B15Cb7fe8E8c40Da6D664B15c
SCORE_CONTRACT_ADDRESS=0x71DA928CbCF09515112eE792123b1F32A2229458
LENDING_POOL_ADDRESS=0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE
PASSPORT_USER_JWT=your_kite_passport_jwt
PORT=3005
```

### Trading Agent (`trading-agent/.env`)

```env
KITE_RPC_URL=https://rpc-testnet.gokite.ai/
AGENT_PRIVATE_KEY=your_agent_wallet_key
PYUSD_ADDRESS=0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9
TRADE_VAULT_ADDRESS=your_vault_address
X402_PROCESSOR_ADDRESS=0xd414b8c0c4FF3F3a1befc2a13293EE4BCF39F337
LENDING_POOL_ADDRESS=0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE
PASSPORT_ADDRESS=your_passport_contract
PORT=4000
WS_PORT=4001
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:3002        # Backend API (omit for production relative paths)
VITE_ORACLE_API_URL=http://localhost:3005  # Oracle API
VITE_WALLETCONNECT_PROJECT_ID=your_id     # WalletConnect Cloud project ID
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** or **pnpm**
- A browser wallet (MetaMask, Coinbase Wallet, etc.) configured for [Kite AI Testnet](https://rpc-testnet.gokite.ai)
- Testnet KITE (gas) and PYUSD tokens — [Kite Faucet](https://faucet.gokite.ai)

### 1. Install Dependencies

```bash
# Root (utility scripts)
npm install

# Smart contracts
cd contracts && npm install && cd ..

# Backend
cd backend && npm install && cd ..

# Oracle
cd oracle-backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..

# Agent (optional)
cd agent && npm install && cd ..

# Trading Agent (optional)
cd trading-agent && npm install && cd ..
```

### 2. Configure Environment

Copy the example `.env` files and fill in your keys:

```bash
cp oracle-backend/.env.example oracle-backend/.env
cp trading-agent/.env.example trading-agent/.env
# Backend and Frontend: create .env files with the variables listed above
```

### 3. Compile Contracts (if redeploying)

```bash
cd contracts
npx hardhat compile
```

### 4. Start Services

```bash
# Terminal 1: Backend API
cd backend && npm run dev

# Terminal 2: Oracle
cd oracle-backend && npx tsx server.ts

# Terminal 3: Frontend
cd frontend && npm run dev
```

The frontend will be available at `http://localhost:5173`.

### 5. (Optional) Run the Trading Agent

```bash
cd trading-agent && npx tsx agent.ts
```

---

## Development Scripts

### Backend

| Command | Description |
|---|---|
| `npm run dev` | Start with hot-reload (`tsx watch`) |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled output |
| `npm run seed` | Seed the local database |
| `npm run demo:agent` | Run the autonomous agent demo |

### Frontend

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm test` | Run tests (Vitest) |

### Contracts

| Command | Description |
|---|---|
| `npx hardhat compile` | Compile Solidity contracts |
| `npx tsx scripts/deploy-all.ts` | Deploy all contracts to Kite testnet |

### Utility Scripts (root)

Various diagnostic scripts in the repo root for checking on-chain state:

- `fetch_score.js` / `fetch_score2.js` — Query agent scores from oracle
- `fetch_pool.js` — Read lending pool state
- `check_balances.js` — Check PYUSD balances
- `trigger-attestation.js` — Manually trigger score attestation

---

## License

This project was built for the Kite AI ecosystem. See individual package files for dependency licenses.
