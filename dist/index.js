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
(0, dotenv_1.config)();
var price = NaN;
var bids = [[]];
var asks = [[]];
var bestBid = { bidPrice: 0, bidQty: 0 };
var bestAsk = { askPrice: 0, askQty: 0 };
const client = (0, redis_1.createClient)({ url: process.env.REDIS_URL });
const wsUrl = "wss://stream.binance.com:9443/ws/btcusdt@depth";
const wsUrl2 = "wss://stream.binance.com:9443/ws/btcusdt@trade";
const wsUrl3 = "wss://stream.binance.com:9443/ws/btcusdt@bookTicker";
const ws = new ws_1.default(wsUrl);
const ws2 = new ws_1.default(wsUrl2);
const ws3 = new ws_1.default(wsUrl3);
function connectRedis() {
    return __awaiter(this, void 0, void 0, function* () {
        yield client.connect();
        console.log("Connected to redis");
    });
}
connectRedis();
ws.on('message', (data) => {
    try {
        const message = JSON.parse(data);
        const bid = (message["b"]);
        const ask = (message["a"]);
        bids = bid;
        asks = ask;
        client.set("bids", JSON.stringify(bids.slice(0, 10)));
        client.set("asks", JSON.stringify(asks.slice(0, 10)));
        /*
        ask/bid => [[price, quantity], [price, quantity], ...]
        */
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
        client.set("price", JSON.stringify(price));
    }
    catch (error) {
        console.error("Error : ", error);
    }
});
ws2.on("error", error => {
    console.log(error);
});
ws3.on('message', (data) => {
    const element = JSON.parse(data);
    bestBid = { bidPrice: element['b'], bidQty: element['B'] };
    bestAsk = { askPrice: element['a'], askQty: element['A'] };
});
const httpServer = (0, http_1.createServer)((req, res) => {
    res.end("request sent to websocket server");
});
httpServer.listen(9433);
const wsServer = new ws_1.WebSocketServer({ server: httpServer });
wsServer.on("connection", (ws) => {
    ws.on('error', console.error);
    ws.send("Connected to server");
});
setInterval(() => {
    wsServer.clients.forEach(function each(client) {
        if (client.readyState === ws_1.default.OPEN) {
            var data = JSON.stringify({ "price": price, "bids": bids, "asks": asks, "bestBid": bestBid, "bestAsk": bestAsk });
            client.send(data);
        }
    });
}, 500);
