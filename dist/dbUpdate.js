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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = updateDB;
const _1 = __importDefault(require("."));
const _2 = require(".");
function updateDB() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const listLen = yield _2.streamClient.lLen("db");
            if (!listLen)
                return;
            const jobData = yield _2.streamClient.lPop("db");
            if (!jobData)
                return;
            try {
                const jobObj = JSON.parse(jobData);
                const status = jobObj.status == "PARTIALLY_FILLED" ? "PARTIALLY_FILLED" : "COMPLETED";
                const symbol = jobObj.symbol[0] == 'b' ? "BTC" : jobObj.symbol[0] == 'e' ? "ETH" : jobObj.symbol[0] == 's' ? "SOL" : "DOGE";
                const side = jobObj.side == "SELL" ? "SELL" : "BUY";
                yield _1.default.$transaction([
                    // update order
                    _1.default.order.update({
                        where: {
                            id: jobObj.orderId
                        },
                        data: {
                            status,
                            filledQuantity: { increment: jobObj.quantity }
                        }
                    }),
                    // make transaction
                    _1.default.transaction.create({
                        data: {
                            time: jobObj.time,
                            side,
                            price: jobObj.price,
                            quantity: jobObj.quantity,
                            totalAmount: jobObj.totalAmount,
                            orderId: jobObj.orderId,
                            symbol
                        }
                    })
                ]);
            }
            catch (e) {
                console.log("e");
                yield _2.streamClient.lPush("db", jobData);
            }
        }
        catch (e) {
            console.log("error while updating getting data from redis stream", e);
        }
    });
}
