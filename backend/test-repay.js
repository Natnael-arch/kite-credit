"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var ethers_1 = require("ethers");
var node_fetch_1 = require("node-fetch");
var RPC_URL = "https://rpc-testnet.gokite.ai";
var LENDING_POOL_ADDRESS = "0xC84c34835BEB8A4fb180979E1A4b567A6fC9F9dE";
var PYUSD_ADDRESS = "0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9";
var AGENT_PRIVATE_KEY = "32db4730c6d7c7fe0d2bb3ef23602fb28c97b5b6420d1d342a4241316e3a95c8";
var PYUSD_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)"
];
var LENDING_POOL_ABI = [
    "function repay(address _borrower, uint256 amount) external",
    "function getBorrowerPosition(address borrower) view returns (uint256 borrowedAmount, uint256 collateralAmount)"
];
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var provider, wallet, pyusd, pool, beforeLiquidity, pos, amountToRepay, tx1, tx2, receipt, afterLiquidity, message, signature, res, e_1, text;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    provider = new ethers_1.ethers.JsonRpcProvider(RPC_URL);
                    wallet = new ethers_1.ethers.Wallet(AGENT_PRIVATE_KEY, provider);
                    console.log("Wallet Address:", wallet.address);
                    pyusd = new ethers_1.ethers.Contract(PYUSD_ADDRESS, PYUSD_ABI, wallet);
                    pool = new ethers_1.ethers.Contract(LENDING_POOL_ADDRESS, LENDING_POOL_ABI, wallet);
                    return [4 /*yield*/, pyusd.balanceOf(LENDING_POOL_ADDRESS)];
                case 1:
                    beforeLiquidity = _a.sent();
                    console.log("Before Liquidity:", ethers_1.ethers.formatUnits(beforeLiquidity, 18), "PYUSD");
                    return [4 /*yield*/, pool.getBorrowerPosition(wallet.address)];
                case 2:
                    pos = _a.sent();
                    console.log("Borrowed Amount:", ethers_1.ethers.formatUnits(pos[0], 18), "PYUSD");
                    if (pos[0] === 0n) {
                        console.log("Nothing to repay!");
                        return [2 /*return*/];
                    }
                    amountToRepay = pos[0] > ethers_1.ethers.parseUnits("1", 18) ? ethers_1.ethers.parseUnits("1", 18) : pos[0];
                    console.log("Repaying ".concat(ethers_1.ethers.formatUnits(amountToRepay, 18), " PYUSD..."));
                    // 3. Approve
                    console.log("Approving...");
                    return [4 /*yield*/, pyusd.approve(LENDING_POOL_ADDRESS, amountToRepay)];
                case 3:
                    tx1 = _a.sent();
                    return [4 /*yield*/, tx1.wait()];
                case 4:
                    _a.sent();
                    console.log("Approved! txHash:", tx1.hash);
                    // 4. Repay
                    console.log("Repaying...");
                    return [4 /*yield*/, pool.repay(wallet.address, amountToRepay)];
                case 5:
                    tx2 = _a.sent();
                    return [4 /*yield*/, tx2.wait()];
                case 6:
                    receipt = _a.sent();
                    console.log("Repaid! txHash:", tx2.hash);
                    return [4 /*yield*/, pyusd.balanceOf(LENDING_POOL_ADDRESS)];
                case 7:
                    afterLiquidity = _a.sent();
                    console.log("After Liquidity:", ethers_1.ethers.formatUnits(afterLiquidity, 18), "PYUSD");
                    message = "auth_request";
                    return [4 /*yield*/, wallet.signMessage(message)];
                case 8:
                    signature = _a.sent();
                    console.log("Calling backend...");
                    _a.label = 9;
                case 9:
                    _a.trys.push([9, 11, , 13]);
                    return [4 /*yield*/, (0, node_fetch_1.default)("http://localhost:3002/api/loans/repay", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "x-agent-signature": signature,
                                "x-agent-message": message,
                                "x-agent-address": wallet.address
                            },
                            body: JSON.stringify({
                                borrower_address: wallet.address,
                                amount: ethers_1.ethers.formatUnits(amountToRepay, 18),
                                txHash: tx2.hash
                            })
                        })];
                case 10:
                    res = _a.sent();
                    return [3 /*break*/, 13];
                case 11:
                    e_1 = _a.sent();
                    console.log("Local backend failed, trying production backend on Railway...");
                    return [4 /*yield*/, (0, node_fetch_1.default)("https://agent-score-backend.up.railway.app/api/loans/repay", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "x-agent-signature": signature,
                                "x-agent-message": message,
                                "x-agent-address": wallet.address
                            },
                            body: JSON.stringify({
                                borrower_address: wallet.address,
                                amount: ethers_1.ethers.formatUnits(amountToRepay, 18),
                                txHash: tx2.hash
                            })
                        })];
                case 12:
                    res = _a.sent();
                    return [3 /*break*/, 13];
                case 13: return [4 /*yield*/, res.text()];
                case 14:
                    text = _a.sent();
                    console.log("Backend response:", res.status, text);
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(console.error);
