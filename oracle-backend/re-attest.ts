import { computeScoreLegacy } from "./scorer.js";
import { attestOnChain } from "./attester.js";

async function main() {
  const agentAddress = "0x392Cf972263701695Cb21745D43541272DEC3ceA";
  console.log("Computing score...");
  const scoreData = await computeScoreLegacy(agentAddress);
  console.log("Computed Score:", scoreData);
  console.log("Attesting on-chain...");
  const txHash = await attestOnChain(agentAddress, scoreData);
  console.log("Attestation TX:", txHash);
}

main().catch(console.error);
