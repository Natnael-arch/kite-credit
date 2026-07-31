import { ethers } from "ethers";

const API_URL = "https://kite-credit-production.up.railway.app/api";

async function testBorrow() {
  const wallet = ethers.Wallet.createRandom();
  const address = wallet.address;

  console.log("1. Registering agent:", address);

  // Register
  const regRes = await fetch(`${API_URL}/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address,
      name: `Test Bot ${Date.now()}`,
      agent_type: "Tester",
      model_hash: "0x" + ethers.hexlify(ethers.randomBytes(32)).slice(2),
    }),
  });
  console.log("Register:", regRes.status, await regRes.text());

  // Do 25 transactions to build score to 500+
  console.log("\n2. Building score with 25 transactions...");
  for (let i = 0; i < 25; i++) {
    const txPayload = {
      from_address: address,
      to_address: "0xKiteGasStationPool",
      amount: 50,
      service_name: "Test Trade",
      status: "success",
    };
    const timestamp = Date.now().toString();
    const message = JSON.stringify(txPayload) + timestamp;
    const signature = await wallet.signMessage(message);

    const txRes = await fetch(`${API_URL}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-agent-signature": signature,
        "x-timestamp": timestamp,
      },
      body: JSON.stringify(txPayload),
    });
    if (!txRes.ok) {
      console.log(`  tx ${i} FAILED:`, await txRes.text());
    }
  }

  // Check score
  console.log("\n3. Checking terms...");
  const termsRes = await fetch(`${API_URL}/loans/terms/${address}`);
  const terms = await termsRes.json();
  console.log("Terms:", JSON.stringify(terms, null, 2));

  if (!(terms as any).eligible) {
    console.log("Not eligible, stopping.");
    return;
  }

  // Try to borrow
  console.log("\n4. Attempting borrow...");
  const borrowPayload = {
    borrower_address: address,
    amount: (terms as any).maxLoan,
  };
  const timestamp = Date.now().toString();
  const message = JSON.stringify(borrowPayload) + timestamp;
  const signature = await wallet.signMessage(message);

  const borrowRes = await fetch(`${API_URL}/loans/borrow`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-signature": signature,
      "x-timestamp": timestamp,
    },
    body: JSON.stringify(borrowPayload),
  });
  console.log("Borrow status:", borrowRes.status);
  console.log("Borrow response:", await borrowRes.text());

  // Check active loan
  console.log("\n5. Checking active loan...");
  const activeRes = await fetch(`${API_URL}/loans/active/${address}`);
  console.log("Active loan:", await activeRes.text());

  // Do one more transaction to see if waterfall triggers
  console.log("\n6. Doing a trade to test waterfall...");
  const txPayload2 = {
    from_address: address,
    to_address: "0xKiteGasStationPool",
    amount: 100,
    service_name: "Waterfall Test",
    status: "success",
  };
  const ts2 = Date.now().toString();
  const msg2 = JSON.stringify(txPayload2) + ts2;
  const sig2 = await wallet.signMessage(msg2);

  const txRes2 = await fetch(`${API_URL}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-signature": sig2,
      "x-timestamp": ts2,
    },
    body: JSON.stringify(txPayload2),
  });
  console.log("Transaction status:", txRes2.status);
  const txData = await txRes2.json();
  console.log("Transaction response:", JSON.stringify(txData, null, 2));

  if ((txData as any).repayment) {
    console.log("\n✅ WATERFALL WORKS! Repayment portion:", (txData as any).repayment.repaymentPortion);
  } else {
    console.log("\n❌ No waterfall triggered.");
  }
}

testBorrow().catch(console.error);
