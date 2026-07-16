const fetch = require('node-fetch'); // If it's node 18+, fetch is built-in.
async function run() {
  const agentAddress = "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A";
  const passportToken = "your_passport_user_jwt_here"; // What's in .env
  
  try {
    const response = await fetch(
      `https://passport.prod.gokite.ai/v1/agents/${agentAddress}/history`,
      {
        headers: {
          "Authorization": `Bearer ${passportToken}`,
          "Content-Type": "application/json"
        }
      }
    );
    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Body:", text);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
run();
