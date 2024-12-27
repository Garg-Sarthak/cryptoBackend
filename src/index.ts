import {createServer} from 'http';
import { config } from 'dotenv';
import WebSocket, { WebSocketServer } from 'ws';
import { createClient } from 'redis';
config();


var price = NaN;
var bids = [[]];
var asks = [[]];
var bestBid = {bidPrice : 0, bidQty : 0}
var bestAsk = {askPrice : 0, askQty : 0}

const client = createClient({url : process.env.REDIS_URL});


const wsUrl = "wss://stream.binance.com:9443/ws/btcusdt@depth";
const wsUrl2 = "wss://stream.binance.com:9443/ws/btcusdt@trade";
const wsUrl3 = "wss://stream.binance.com:9443/ws/btcusdt@bookTicker";

const ws = new WebSocket(wsUrl);
const ws2 = new WebSocket(wsUrl2);
const ws3 = new WebSocket(wsUrl3);

async function connectRedis() {
    await client.connect();
    console.log("Connected to redis");
}
connectRedis();

ws.on('message', (data : string) => {
    try {
        const message = JSON.parse(data);
        
        const bid = (message["b"]); 
        const ask = (message["a"]); 
        bids = bid; asks = ask;
        client.set("bids", JSON.stringify(bids.slice(0, 10)));
        client.set("asks", JSON.stringify(asks.slice(0, 10)));
        
        /*
        ask/bid => [[price, quantity], [price, quantity], ...]
        */
       
       
    } catch (error) {
        console.error('Error parsing message:', error);
    }
});
ws.on('error', (error) => {
    console.error('WebSocket Error:', error);
});


ws2.on('message',(data : string) => {
    try{
        const element = JSON.parse(data);
        const currPrice = element['p'];
        price = currPrice;
        client.set("price",JSON.stringify(price));  
    }
    catch(error){
        console.error("Error : ",error);
    }
})
ws2.on ("error",error => {
    console.log(error)
})

ws3.on('message', (data : string) => {
    const element = JSON.parse(data);
    bestBid = {bidPrice : element['b'], bidQty : element['B']};
    bestAsk = {askPrice : element['a'], askQty : element['A']};
})

const httpServer = createServer((req, res) => {
    res.end("request sent to websocket server");
}); 
httpServer.listen(9433);


const wsServer = new WebSocketServer({server : httpServer});


wsServer.on("connection", (ws) => {
    ws.on('error', console.error);

    
    ws.send("Connected to server");
})


setInterval(() => {
    wsServer.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        var data = JSON.stringify({"price": price, "bids": bids, "asks": asks, "bestBid" : bestBid, "bestAsk" : bestAsk});
        client.send(data);
      }
    });
},500)


