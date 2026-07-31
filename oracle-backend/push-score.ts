import { attestOnChain } from "./attester.js";
import { computeScoreLegacy } from "./scorer.js";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const agentAddr = process.argv[2];
  const targetScore = process.argv[3];
  
  if (!agentAddr) {
    console.error("Usage: npx tsx push-score.ts <agentAddress> [optionalTargetScore]");
    process.exit(1);
  }

  console.log(`Getting base score for ${agentAddr}...`);
  const scoreData = await computeScoreLegacy(agentAddr);
  
  if (targetScore) {
     console.log(`Overriding score to: ${targetScore}`);
     scoreData.score = parseInt(targetScore);
  }

  await attestOnChain(agentAddr, scoreData);
  console.log(`Successfully attested score ${scoreData.score} for ${agentAddr}`);
}

main().catch(console.error);
