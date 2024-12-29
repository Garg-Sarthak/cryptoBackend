"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const streamsSubscriber = (symbol, httpServer, path, client) => {
    const dbSymbol = symbol[0] == 'b' ? "BTC" : symbol[0] == 'e' ? "ETH" : symbol[0] == 's' ? "SOL" : "DOGE";
    const wsServer = new ws_1.default.Server({ noServer: true });
    httpServer.on('upgrade', (req, socket, head) => {
        if (req.url === path) {
            wsServer.handleUpgrade(req, socket, head, (ws) => {
                wsServer.emit('connection', ws, req);
            });
        }
    });
    var price = NaN;
    var bids = [[]];
    var asks = [[]];
    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@depth`;
    const wsUrl2 = `wss://stream.binance.com:9443/ws/${symbol}@trade`;
    const ws = new ws_1.default(wsUrl);
    const ws2 = new ws_1.default(wsUrl2);
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
    setInterval(() => {
        try {
            client.set(`${symbol}price`, price.toString());
        }
        catch (e) {
            console.log(e);
        }
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
exports.default = streamsSubscriber;
