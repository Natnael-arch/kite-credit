async function main() {
  const url = "https://testnet.kitescan.ai/api?module=account&action=txlist&address=0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE&startblock=0&endblock=99999999&page=1&offset=10&sort=asc";
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === "1" && data.result.length > 0) {
    console.log("First tx block:", data.result[0].blockNumber);
  } else {
    console.log("API response:", data);
  }
}
main();
