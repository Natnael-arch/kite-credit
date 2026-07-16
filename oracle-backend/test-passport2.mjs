async function run() {
  const agentAddress = "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A";
  
  try {
    const response = await fetch(
      `https://passport.prod.gokite.ai/v1/agents/${agentAddress}/history`
    );
    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Body:", text);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
run();
