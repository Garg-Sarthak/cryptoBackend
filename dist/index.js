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
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const dotenv_1 = require("dotenv");
const ws_1 = __importStar(require("ws"));
(0, dotenv_1.config)();
var price = NaN;
var bids = [[]];
var asks = [[]];
const wsUrl = "wss://stream.binance.com:9443/ws/btcusdt@depth@100ms";
const wsUrl2 = "wss://stream.binance.com:9443/ws/btcusdt@trade";
const ws = new ws_1.default(wsUrl);
const ws2 = new ws_1.default(wsUrl2);
ws.on('message', (data) => {
    try {
        const message = JSON.parse(data);
        const bid = (message["b"]);
        const ask = (message["a"]);
        bids = bid;
        asks = ask;
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
    }
    catch (error) {
        console.error("Error : ", error);
    }
});
ws2.on("error", error => {
    console.log(error);
});
const httpServer = (0, http_1.createServer)((req, res) => {
    res.end("request sent to websocket server");
});
httpServer.listen(9433);
const wsServer = new ws_1.WebSocketServer({ server: httpServer });
wsServer.on("connection", (ws) => {
    ws.on('error', console.error);
    setInterval(() => {
        wsServer.clients.forEach(function each(client) {
            if (client.readyState === ws_1.default.OPEN) {
                var data = JSON.stringify({ "price": price, "bids": bids, "asks": asks });
                client.send(data);
            }
        });
    }, 500);
    ws.send("Connected to server");
});