import { Router } from "express";
import { supabase } from "../config.js";

export const agentsRouter = Router();

// ── REQUIRE_PASSPORT gate ──────────────────────────────────────────
// Default: true (fail-closed). Set to "false" in .env to allow
// unverified agents for testing. This is intentionally verbose so
// the flag is impossible to miss during code review.
const REQUIRE_PASSPORT: boolean = process.env.REQUIRE_PASSPORT !== "false";
if (!REQUIRE_PASSPORT) {
  console.warn("⚠️  REQUIRE_PASSPORT=false — unverified agents will be allowed to register. DO NOT ship this to production.");
}

type VerificationStatus = "verified" | "unverified" | "unknown";

type PassportResult =
  | { status: "verified"; passportId: string | null }
  | { status: "not_verified" }
  | { status: "unknown"; error: string };

function passportResultToVerificationStatus(r: PassportResult): VerificationStatus {
  if (r.status === "verified") return "verified";
  if (r.status === "not_verified") return "unverified";
  return "unknown"; // API unreachable
}

async function verifyPassport(agentAddress: string): Promise<PassportResult> {
  try {
    const response = await fetch(
      "https://passport.prod.gokite.ai/v1/agents/verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_address: agentAddress }),
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!response.ok) {
      return { status: "unknown", error: `Passport API returned HTTP ${response.status}` };
    }

    const data = await response.json();

    if (data.verified === true) {
      return { status: "verified", passportId: data.passport_id ?? data.id ?? null };
    }

    return { status: "not_verified" };
  } catch (err: any) {
    console.error(`Passport API error for ${agentAddress}:`, err?.message ?? err);
    return { status: "unknown", error: err?.message ?? "Network error" };
  }
}

agentsRouter.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("agents")
      .select("address, name, score, agent_type, verification_status")
      .order("registered_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: "Failed to fetch agents" });
    }
    res.json(data || []);
  } catch (err) {
    console.error("GET /agents error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

agentsRouter.get("/:address", async (req, res) => {
  try {
    const { address } = req.params;

    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .eq("address", address)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const accountAgeDays = Math.floor(
      (Date.now() - new Date(data.registered_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    const reliability =
      data.total_payments > 0
        ? Math.round(((data.total_payments - data.failed_payments) / data.total_payments) * 1000) / 10
        : 0;

    res.json({
      name: data.name,
      address: data.address,
      score: data.score,
      transactionVolume: parseFloat(data.transaction_volume),
      accountAgeDays,
      x402Reliability: reliability,
      failedPayments: data.failed_payments,
      totalPayments: data.total_payments,
      passportVerified: data.passport_verified || false,
      passportId: data.passport_id || null,
      verificationStatus: data.verification_status || "unverified",
      passport: {
        agentType: data.agent_type,
        modelHash: data.model_hash || "0x0000...0000",
        kiteIdentityStatus: data.identity_status,
        registeredOn: "Kite AI Testnet",
      },
    });
  } catch (err) {
    console.error("GET /agents/:address error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

agentsRouter.post("/", async (req, res) => {
  try {
    const { address, name, agent_type, model_hash } = req.body;

    if (!address) {
      return res.status(400).json({ error: "address is required" });
    }

    const passportResult = await verifyPassport(address);
    const verificationStatus = passportResultToVerificationStatus(passportResult);

    // ── REQUIRE_PASSPORT gate ──
    if (REQUIRE_PASSPORT) {
      // Original fail-closed behaviour — unchanged
      if (passportResult.status === "unknown") {
        return res.status(503).json({
          error: "Passport verification unavailable",
          message: "Could not reach Kite Passport API to verify this agent. Please retry shortly.",
          registerAt: "https://agentpassport.ai"
        });
      }
      if (passportResult.status === "not_verified") {
        return res.status(403).json({
          error: "Kite Passport required",
          message: "Agent must have a registered Kite Passport to use KiteCredit",
          registerAt: "https://agentpassport.ai"
        });
      }
    } else if (passportResult.status !== "verified") {
      // Permissive mode — log clearly but allow registration
      console.warn(
        `⚠️  REQUIRE_PASSPORT=false: allowing registration of ${address} with verification_status="${verificationStatus}"`
      );
    }

    const passportVerified = passportResult.status === "verified";

    const { data: existing } = await supabase
      .from("agents")
      .select("address")
      .eq("address", address)
      .single();

    if (existing) {
      return res.status(409).json({ error: "Agent already registered" });
    }

    const { data, error } = await supabase
      .from("agents")
      .insert({
        address,
        name: name || "Unknown Agent",
        agent_type: agent_type || "General Purpose",
        model_hash: model_hash || null,
        passport_verified: passportVerified,
        passport_id: passportResult.status === "verified" ? passportResult.passportId : null,
        verification_status: verificationStatus,
      })
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      return res.status(500).json({ error: "Failed to register agent" });
    }

    res.status(201).json(data);
  } catch (err) {
    console.error("POST /agents error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

agentsRouter.get("/:address/transactions", async (req, res) => {
  try {
    const { address } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("from_address", address)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(500).json({ error: "Failed to fetch transactions" });
    }

    res.json(data || []);
  } catch (err) {
    console.error("GET /agents/:address/transactions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

agentsRouter.post("/sync-score", async (req, res) => {
  const { agentAddress } = req.body;

  if (!agentAddress) {
    return res.status(400).json({ error: "agentAddress required" });
  }

  try {
    // Read the real score from oracle (which reads AgentScoreAttestation.sol)
    const oracleUrl = process.env.ORACLE_API_URL || "http://localhost:3005";
    
    const scoreRes = await fetch(`${oracleUrl}/score/${agentAddress}/raw`);
    if (!scoreRes.ok) throw new Error(`Oracle returned ${scoreRes.status}`);
    const scoreData: any = await scoreRes.json();

    // Check Passport
    const passportResult = await verifyPassport(agentAddress);

    // Update Supabase cache with the real on-chain score
    try {
      const updateFields: Record<string, any> = {
        address:        agentAddress.toLowerCase(),
        score:          scoreData.score,
        payment_rate:   scoreData.paymentRate,
        diversity:      scoreData.diversity,
        tx_count:       scoreData.txCount,
        age_days:       scoreData.agentAgeDays,
        last_synced_at: new Date().toISOString()
      };

      if (passportResult.status === "verified") {
        updateFields.passport_verified = true;
        updateFields.passport_id = passportResult.passportId;
        updateFields.verification_status = "verified";
      } else if (passportResult.status === "not_verified") {
        updateFields.passport_verified = false;
        updateFields.passport_id = null;
        updateFields.verification_status = "unverified";
      } else {
        // "unknown" — API unreachable, preserve nothing about passport, mark unknown
        updateFields.verification_status = "unknown";
      }

      const { error } = await supabase
        .from("agents")
        .upsert(updateFields, { onConflict: "address" });
      if (error) console.error("Supabase error:", error);
    } catch (e: any) {
      console.error("Supabase offline, skipping write:", e);
    }

    res.json({
      success:    true,
      address:    agentAddress,
      score:      scoreData.score,
      source:     "AgentScoreAttestation on Kite chain",
      contract:   "0x71DA928CbCF09515112eE792123b1F32A2229458",
      explorerUrl: `https://testnet.kitescan.ai/address/0x71DA928CbCF09515112eE792123b1F32A2229458`
    });

  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
