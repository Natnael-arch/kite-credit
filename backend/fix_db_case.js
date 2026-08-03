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
var supabase_js_1 = require("@supabase/supabase-js");
var supabase = (0, supabase_js_1.createClient)("https://msbesgjrsuymiwyvdsgm.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYmVzZ2pyc3V5bWl3eXZkc2dtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI1NjYwNSwiZXhwIjoyMDk4ODMyNjA1fQ.JHFFPMV74lcP-87q86eErS_xm1Pik58tte6Ui1BPdco");
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var data, _i, data_1, row, agents, _a, agents_1, row;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase.from("transactions").select("id, from_address, to_address")];
                case 1:
                    data = (_b.sent()).data;
                    _i = 0, data_1 = data;
                    _b.label = 2;
                case 2:
                    if (!(_i < data_1.length)) return [3 /*break*/, 5];
                    row = data_1[_i];
                    if (!(row.from_address !== row.from_address.toLowerCase() || row.to_address !== row.to_address.toLowerCase())) return [3 /*break*/, 4];
                    return [4 /*yield*/, supabase.from("transactions").update({
                            from_address: row.from_address.toLowerCase(),
                            to_address: row.to_address.toLowerCase()
                        }).eq("id", row.id)];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    console.log("Done updating transactions");
                    return [4 /*yield*/, supabase.from("agents").select("id, address")];
                case 6:
                    agents = (_b.sent()).data;
                    _a = 0, agents_1 = agents;
                    _b.label = 7;
                case 7:
                    if (!(_a < agents_1.length)) return [3 /*break*/, 10];
                    row = agents_1[_a];
                    if (!(row.address !== row.address.toLowerCase())) return [3 /*break*/, 9];
                    return [4 /*yield*/, supabase.from("agents").update({ address: row.address.toLowerCase() }).eq("id", row.id)];
                case 8:
                    _b.sent();
                    _b.label = 9;
                case 9:
                    _a++;
                    return [3 /*break*/, 7];
                case 10:
                    console.log("Done updating agents");
                    return [2 /*return*/];
            }
        });
    });
}
run();
