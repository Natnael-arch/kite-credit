const { ethers } = require('ethers');
const provider = new ethers.JsonRpcProvider("https://rpc-testnet.gokite.ai/");
const pyusdAddress = "0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9";
const abi = ["function balanceOf(address) external view returns (uint256)"];
const contract = new ethers.Contract(pyusdAddress, abi, provider);

const addresses = {
  Agent: "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A",
  Oracle: "0xC201B98d96d09f2B15Cb7fe8E8c40Da6D664B15c",
  Passport: "0x162b595597E9106FD04509AE9487b3ba02454B6a",
  LendingPool: "0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE",
  X402Processor: "0xd414b8c0c4FF3F3a1befc2a13293EE4BCF39F337"
};

async function main() {
  for (const [name, address] of Object.entries(addresses)) {
    try {
      const balance = await contract.balanceOf(address);
      console.log(`${name}: ${ethers.formatUnits(balance, 18)} PYUSD`);
    } catch (e) {
      console.log(`${name}: Error ${e.message}`);
    }
  }
}
main();
