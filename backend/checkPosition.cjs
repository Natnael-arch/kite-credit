const { ethers } = require("ethers");
const LENDING_POOL_ABI = [
  "function getBorrowerPosition(address) view returns (uint256, uint256)"
];
const provider = new ethers.JsonRpcProvider("https://rpc-testnet.gokite.ai");
const contract = new ethers.Contract("0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE", LENDING_POOL_ABI, provider);
contract.getBorrowerPosition("0x392Cf972263701695Cb21745D43541272DEC3ceA")
  .then(res => console.log("Borrower position:", res[0].toString(), res[1].toString()))
  .catch(err => console.error("RPC Error:", err.message));
