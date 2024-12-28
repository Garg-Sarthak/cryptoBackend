"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const dotenv_1 = require("dotenv");
const ws_1 = __importStar(require("ws"));
const redis_1 = require("redis");
const client_1 = require("@prisma/client");
const client_2 = require("@prisma/client");
(0, dotenv_1.config)();
const client = (0, redis_1.createClient)({ url: process.env.REDIS_URL });
const prisma = new client_1.PrismaClient();
prisma.$connect().then(() => console.log("connected to prisma"));
const streamSubscriber = (symbol, port) => {
    const dbSymbol = symbol[0] == 'b' ? "BTC" : symbol[0] == 'e' ? "ETH" : symbol[0] == 's' ? "SOL" : "DOGE";
    const httpServer = (0, http_1.createServer)((req, res) => {
        res.end("request sent to websocket server");
    });
    httpServer.listen(port);
    const wsServer = new ws_1.WebSocketServer({ server: httpServer });
    wsServer.on("connection", (ws) => {
        ws.on('error', console.error);
        ws.send("Connected to server");
    });
    var price = NaN;
    var bids = [[]];
    var asks = [[]];
    var bestBid = { bidPrice: 0, bidQty: 0 };
    var bestAsk = { askPrice: 0, askQty: 0 };
    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@depth`;
    const wsUrl2 = `wss://stream.binance.com:9443/ws/${symbol}@trade`;
    const wsUrl3 = `wss://stream.binance.com:9443/ws/${symbol}@bookTicker`;
    const ws = new ws_1.default(wsUrl);
    const ws2 = new ws_1.default(wsUrl2);
    const buyWs = new ws_1.default(wsUrl3);
    const sellWs = new ws_1.default(wsUrl3);
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            const bid = (message["b"]);
            const ask = (message["a"]);
            bids = bid;
            asks = ask;
        }
        catch (error) {
            console.error('Error parsing message:', error);
        }
    });
    ws.on('error', (error) => {
        console.error('WebSocket Error:', error);
    });
    ws2.on('message', (data) => {
        try {
            const element = JSON.parse(data);
            const currPrice = element['p'];
            price = currPrice;
        }
        catch (error) {
            console.error("Error : ", error);
        }
    });
    ws2.on("error", error => {
        console.log(error);
    });
    buyWs.on('message', (data) => __awaiter(void 0, void 0, void 0, function* () {
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
                if (bestQty > qtyOrder) {
                    bestQty -= qtyOrder;
                    // Remove completed order from Redis
                    yield client.zRem(`${symbol}_buy`, buy_order.value);
                    // Create transaction and update order
                    yield prisma.$transaction([
                        prisma.transaction.create({
                            data: {
                                userId: "null",
                                time: new Date(),
                                side: "BUY",
                                price: new client_2.Prisma.Decimal(bestPrice),
                                quantity: new client_2.Prisma.Decimal(qtyOrder),
                                totalAmount: new client_2.Prisma.Decimal(bestPrice * qtyOrder),
                                symbol: dbSymbol,
                                orderId: oid,
                            },
                        }),
                        prisma.order.update({
                            where: { id: oid },
                            data: {
                                filledQuantity: qtyOrder,
                                status: "COMPLETED",
                            },
                        }),
                    ]);
                }
                else {
                    const remainingQty = qtyOrder - bestQty;
                    bestQty = 0;
                    yield client.zRem(`${symbol}_buy`, buy_order.value);
                    yield client.zAdd(`${symbol}_buy`, {
                        score: buy_order.score,
                        value: JSON.stringify({ oid, qty: remainingQty }),
                    });
                    yield prisma.$transaction([
                        prisma.transaction.create({
                            data: {
                                userId: "null",
                                time: new Date(),
                                side: "BUY",
                                price: new client_2.Prisma.Decimal(bestPrice),
                                quantity: new client_2.Prisma.Decimal(bestQty),
                                totalAmount: new client_2.Prisma.Decimal(bestPrice * bestQty),
                                symbol: dbSymbol,
                                orderId: oid,
                            },
                        }),
                        prisma.order.update({
                            where: { id: oid },
                            data: {
                                filledQuantity: bestQty,
                                status: "PARTIALLY_FILLED",
                            },
                        }),
                    ]);
                    break;
                }
            }
        }
        catch (error) {
            console.error("Error processing WebSocket message:", error);
        }
    }));
    sellWs.on('message', (data) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const binanObj = JSON.parse(data);
            const bestPrice = parseFloat(binanObj['a']);
            let bestQty = parseFloat(binanObj['A']);
            // Fetch buy orders with price >= bestPrice
            const sell_orders = yield client.zRangeByScoreWithScores(`${symbol}_sell`, 0, bestPrice);
            for (const sell_order of sell_orders) {
                const val = JSON.parse(sell_order.value);
                const qtyOrder = parseFloat(val.qty);
                const oid = parseInt(val.oid);
                if (bestQty > qtyOrder) {
                    bestQty -= qtyOrder;
                    // Remove completed order from Redis
                    yield client.zRem(`${symbol}_sell`, sell_order.value);
                    // Create transaction and update order
                    yield prisma.$transaction([
                        prisma.transaction.create({
                            data: {
                                userId: "null",
                                time: new Date(),
                                side: "SELL",
                                price: new client_2.Prisma.Decimal(bestPrice),
                                quantity: new client_2.Prisma.Decimal(qtyOrder),
                                totalAmount: new client_2.Prisma.Decimal(bestPrice * qtyOrder),
                                symbol: dbSymbol,
                                orderId: oid,
                            },
                        }),
                        prisma.order.update({
                            where: { id: oid },
                            data: {
                                filledQuantity: qtyOrder,
                                status: "COMPLETED",
                            },
                        }),
                    ]);
                }
                else {
                    const remainingQty = qtyOrder - bestQty;
                    yield client.zRem(`${symbol}_sell`, sell_order.value);
                    yield client.zAdd(`${symbol}_sell`, {
                        score: sell_order.score,
                        value: JSON.stringify({ oid, qty: remainingQty }),
                    });
                    yield prisma.$transaction([
                        prisma.transaction.create({
                            data: {
                                userId: "null",
                                time: new Date(),
                                side: "SELL",
                                price: new client_2.Prisma.Decimal(bestPrice),
                                quantity: new client_2.Prisma.Decimal(bestQty),
                                totalAmount: new client_2.Prisma.Decimal(bestPrice * bestQty),
                                symbol: dbSymbol,
                                orderId: oid,
                            },
                        }),
                        prisma.order.update({
                            where: { id: oid },
                            data: {
                                filledQuantity: bestQty,
                                status: "PARTIALLY_FILLED",
                            },
                        }),
                    ]);
                    break;
                }
            }
        }
        catch (error) {
            console.error("Error processing WebSocket message:", error);
        }
    }));
    setInterval(() => {
        client.set(`${symbol}price`, price.toString());
    }, 10000);
    setInterval(() => {
        wsServer.clients.forEach(function each(client) {
            if (client.readyState === ws_1.default.OPEN) {
                var data = JSON.stringify({ "price": price, "bids": bids, "asks": asks });
                client.send(data);
            }
        });
    }, 500);
};
function connectRedis() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield client.connect();
            console.log("Connected to redis");
        }
        catch (e) {
            console.log("error : : ", e);
            setTimeout(connectRedis, 10000);
        }
    });
}
connectRedis();
streamSubscriber("btcusdt", 9433);
streamSubscriber("ethusdt", 9434);
streamSubscriber("solusdt", 9435);
streamSubscriber("dogeusdt", 9436);
