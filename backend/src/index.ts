import dns from "node:dns";
dns.setDefaultResultOrder('ipv4first');

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔴 UNHANDLED REJECTION:', reason);
  console.error('🔴 Promise:', promise);
});

process.on('uncaughtException', (err) => {
  console.error('🔴 UNCAUGHT EXCEPTION:', err);
});
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { agentsRouter } from "./routes/agents.js";
import { loansRouter } from "./routes/loans.js";
import { lendingRouter } from "./routes/lending.js";
import { transactionsRouter } from "./routes/transactions.js";
import { poolRouter } from "./routes/pool.js";
import { startIndexer } from "./services/indexer.js";

const app = express();

// Start the blockchain event indexer
startIndexer().catch(err => console.error("Indexer startup failed:", err));


app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/", (_req, res) => {
  res.send("KiteCredit Backend is running");
});

app.use("/api/agents", agentsRouter);
app.use("/api/loans", loansRouter);
app.use("/api/lending", lendingRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/pool", poolRouter);

// Export for potential serverless use
export default app;

// Only Vercel's serverless runtime skips calling listen() itself.
// Railway (and any normal long-running host) needs this to always run.
if (!process.env.VERCEL) {
  app.listen(config.port, "0.0.0.0", () => {
    console.log(`KiteCredit API running on port ${config.port}`);
  });
}

