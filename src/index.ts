import {createServer} from 'http';
import { config } from 'dotenv';
import WebSocket, { WebSocketServer } from 'ws';
config();


var price = NaN;
var bids = [[]];
var asks = [[]];

const wsUrl = "wss://stream.binance.com:9443/ws/btcusdt@depth@100ms";
const wsUrl2 = "wss://stream.binance.com:9443/ws/btcusdt@trade";

const ws = new WebSocket(wsUrl);
const ws2 = new WebSocket(wsUrl2);

ws.on('message', (data : string) => {
    try {
        const message = JSON.parse(data);
        
        const bid = (message["b"]); 
        const ask = (message["a"]); 
        bids = bid; asks = ask;

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
    }
    catch(error){
        console.error("Error : ",error);
    }
})
ws2.on ("error",error => {
    console.log(error)
})

const httpServer = createServer((req, res) => {
    res.end("request sent to websocket server");
}); 
httpServer.listen(9433);

const wsServer = new WebSocketServer({server : httpServer});

wsServer.on("connection", (ws) => {
    ws.on('error', console.error);

    setInterval(() => {
        wsServer.clients.forEach(function each(client) {
          if (client.readyState === WebSocket.OPEN) {
            var data = JSON.stringify({"price": price, "bids": bids, "asks": asks});
            client.send(data);
          }
        });
    },500)
    
    ws.send("Connected to server");
})



