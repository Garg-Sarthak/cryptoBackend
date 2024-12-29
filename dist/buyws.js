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
exports.executeOrder = executeOrder;
const ws_1 = __importDefault(require("ws"));
const _1 = require(".");
function executeOrder(symbol, client) {
    return __awaiter(this, void 0, void 0, function* () {
        const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@ticker`;
        const buyWs = new ws_1.default(wsUrl);
        const sellWs = new ws_1.default(wsUrl);
        buyWs.on('message', (data) => __awaiter(this, void 0, void 0, function* () {
            try {
                const binanObj = JSON.parse(data);
                const bestPrice = parseFloat(binanObj['b']);
                let bestQty = parseFloat(binanObj['B']);
                // Fetch buy orders with price >= bestPrice
                const buy_orders = yield client.zRangeByScoreWithScores(`${symbol}_buy`, bestPrice, Infinity);
                for (const buy_order of buy_orders) {
                    const val = JSON.parse(buy_order.value);
                    const qtyOrder = parseFloat(val.qty);
                    const oid = parseInt(val.oid);
                    let time, quantity, totalAmount, status;
                    if (bestQty >= qtyOrder) {
                        bestQty -= qtyOrder;
                        // Remove completed order from Redis
                        yield client.zRem(`${symbol}_buy`, buy_order.value);
                        time = new Date().toISOString();
                        quantity = qtyOrder;
                        status = "COMPLETED";
                        totalAmount = bestPrice * quantity;
                        const orderDetails = { time, side: "BUY", price: bestPrice, quantity, status, totalAmount, orderId: oid, symbol };
                        try {
                            yield _1.streamClient.lPush("db", JSON.stringify(orderDetails));
                        }
                        catch (e) {
                            console.log("error while adding to redis stream");
                        }
                    }
                    else {
                        const remainingQty = qtyOrder - bestQty;
                        time = new Date().toISOString();
                        quantity = bestQty;
                        status = "PARTIALLY_FILLED";
                        bestQty = 0;
                        yield client.zRem(`${symbol}_buy`, buy_order.value);
                        if (remainingQty)
                            yield client.zAdd(`${symbol}_buy`, {
                                score: buy_order.score,
                                value: JSON.stringify({ oid, qty: remainingQty }),
                            });
                        totalAmount = bestPrice * quantity;
                        const orderDetails = { time, side: "BUY", price: bestPrice, quantity, status, totalAmount, orderId: oid, symbol };
                        try {
                            yield _1.streamClient.lPush("db", JSON.stringify(orderDetails));
                        }
                        catch (e) {
                            console.log("error while adding to redis stream");
                        }
                    }
                    if (bestQty <= 0)
                        break;
                }
            }
            catch (error) {
                console.error("Error processing WebSocket message:", error);
            }
        }));
        sellWs.on('message', (data) => __awaiter(this, void 0, void 0, function* () {
            try {
                const binanObj = JSON.parse(data);
                const bestPrice = parseFloat(binanObj['a']);
                let bestQty = parseFloat(binanObj['A']);
                // Fetch buy orders with price <= bestPrice
                const sell_orders = yield client.zRangeByScoreWithScores(`${symbol}_sell`, -Infinity, bestPrice);
                for (const sell_order of sell_orders) {
                    const val = JSON.parse(sell_order.value);
                    const oid = parseInt(val.oid);
                    const qtyOrder = parseFloat(val.qty);
                    let time, quantity, totalAmount, status;
                    if (bestQty > qtyOrder) {
                        bestQty -= qtyOrder;
                        // Remove completed order from Redis
                        yield client.zRem(`${symbol}_sell`, sell_order.value);
                        time = new Date().toISOString();
                        quantity = qtyOrder;
                        status = "COMPLETED";
                        totalAmount = bestPrice * quantity;
                        const orderDetails = { time, side: "SELL", price: bestPrice, quantity, status, totalAmount, orderId: oid, symbol };
                        try {
                            _1.streamClient.lPush("db", JSON.stringify(orderDetails));
                        }
                        catch (e) {
                            console.log("error while adding to redis stream");
                        }
                    }
                    else {
                        const remainingQty = qtyOrder - bestQty;
                        time = new Date().toISOString();
                        quantity = bestQty;
                        status = "PARTIALLY_FILLED";
                        bestQty = 0;
                        yield client.zRem(`${symbol}_sell`, sell_order.value);
                        if (remainingQty)
                            yield client.zAdd(`${symbol}_sell`, {
                                score: sell_order.score,
                                value: JSON.stringify({ oid, qty: remainingQty }),
                            });
                        totalAmount = bestPrice * quantity;
                        const orderDetails = { time, side: "SELL", price: bestPrice, quantity, status, totalAmount, orderId: oid, symbol };
                        try {
                            _1.streamClient.lPush("db", JSON.stringify(orderDetails));
                        }
                        catch (e) {
                            console.log("error while adding to redis stream");
                        }
                    }
                    if (bestQty <= 0)
                        break;
                }
            }
            catch (error) {
                console.error("Error processing WebSocket message:", error);
            }
        }));
    });
}
