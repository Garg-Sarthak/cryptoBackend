import {createServer, setMaxIdleHTTPParsers} from 'http';
import { config } from 'dotenv';
import WebSocket, { WebSocketServer } from 'ws';
import { createClient } from 'redis';
import { PrismaClient } from '@prisma/client';
import {Prisma} from '@prisma/client'
config();





const client = createClient({url : process.env.REDIS_URL});

const prisma = new PrismaClient();
prisma.$connect().then(() => console.log("connected to prisma"));  


const streamSubscriber = (symbol : string,port : number) => {
    const dbSymbol = symbol[0]=='b'?"BTC":symbol[0]=='e'?"ETH":symbol[0]=='s'?"SOL":"DOGE";
    const httpServer = createServer((req, res) => {
        res.end("request sent to websocket server");
    }); 
    httpServer.listen(port);
    const wsServer = new WebSocketServer({server : httpServer});
    
    
    wsServer.on("connection", (ws) => {
        ws.on('error', console.error);
        ws.send("Connected to server");
    })
    var price = NaN;
    var bids = [[]];
    var asks = [[]];
    var bestBid = {bidPrice : 0, bidQty : 0}
    var bestAsk = {askPrice : 0, askQty : 0}

    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@depth`;
    const wsUrl2 = `wss://stream.binance.com:9443/ws/${symbol}@trade`;
    const wsUrl3 = `wss://stream.binance.com:9443/ws/${symbol}@bookTicker`;
    const ws = new WebSocket(wsUrl);
    const ws2 = new WebSocket(wsUrl2);
    const buyWs = new WebSocket(wsUrl3);
    const sellWs = new WebSocket(wsUrl3);

    ws.on('message', (data : string) => {
        try {
            const message = JSON.parse(data);
            
            const bid = (message["b"]); 
            const ask = (message["a"]); 
            bids = bid; asks = ask;
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
    
    buyWs.on('message', async (data: string) => {
        try {
            const binanObj = JSON.parse(data);
            const bestPrice = parseFloat(binanObj['b']);
            let bestQty = parseFloat(binanObj['B']);
    
            // Fetch buy orders with price >= bestPrice
            const buy_orders = await client.zRangeByScoreWithScores(`${symbol}_buy`, bestPrice, Infinity);
    
            for (const buy_order of buy_orders) {
                const val = JSON.parse(buy_order.value);
                const qtyOrder = parseFloat(val.qty);
                const oid = parseInt(val.oid);
    
                if (bestQty > qtyOrder) {
                    bestQty -= qtyOrder;
    
                    // Remove completed order from Redis
                    await client.zRem(`${symbol}_buy`, buy_order.value);
    
                    // Create transaction and update order
                    await prisma.$transaction([
                        prisma.transaction.create({
                            data: {
                                userId: "null",
                                time: new Date(),
                                side: "BUY",
                                price: new Prisma.Decimal(bestPrice),
                                quantity: new Prisma.Decimal(qtyOrder),
                                totalAmount: new Prisma.Decimal(bestPrice * qtyOrder),
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
                } else {
                    const remainingQty = qtyOrder - bestQty;
                    bestQty = 0;
    
                    await client.zRem(`${symbol}_buy`, buy_order.value);
                    await client.zAdd(`${symbol}_buy`, {
                        score: buy_order.score,
                        value: JSON.stringify({ oid, qty: remainingQty }),
                    });
                    await prisma.$transaction([
                        prisma.transaction.create({
                            data: {
                                userId: "null",
                                time: new Date(),
                                side: "BUY",
                                price: new Prisma.Decimal(bestPrice),
                                quantity: new Prisma.Decimal(bestQty),
                                totalAmount: new Prisma.Decimal(bestPrice * bestQty),
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
    
        } catch (error) {
            console.error("Error processing WebSocket message:", error);
        }
    });

    sellWs.on('message', async (data: string) => {
        try {
            const binanObj = JSON.parse(data);
            const bestPrice = parseFloat(binanObj['a']);
            let bestQty = parseFloat(binanObj['A']);
    
            // Fetch buy orders with price >= bestPrice
            const sell_orders = await client.zRangeByScoreWithScores(`${symbol}_sell`, 0,bestPrice);
    
            for (const sell_order of sell_orders) {
                const val = JSON.parse(sell_order.value);
                const qtyOrder = parseFloat(val.qty);
                const oid = parseInt(val.oid);
    
                if (bestQty > qtyOrder) {
                    bestQty -= qtyOrder;
    
                    // Remove completed order from Redis
                    await client.zRem(`${symbol}_sell`, sell_order.value);
    
                    // Create transaction and update order
                    await prisma.$transaction([
                        prisma.transaction.create({
                            data: {
                                userId: "null",
                                time: new Date(),
                                side: "SELL",
                                price: new Prisma.Decimal(bestPrice),
                                quantity: new Prisma.Decimal(qtyOrder),
                                totalAmount: new Prisma.Decimal(bestPrice * qtyOrder),
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
                } else {
                    const remainingQty = qtyOrder - bestQty;
    
                    await client.zRem(`${symbol}_sell`, sell_order.value);
                    await client.zAdd(`${symbol}_sell`, {
                        score: sell_order.score,
                        value: JSON.stringify({ oid, qty: remainingQty }),
                    });
                    await prisma.$transaction([
                        prisma.transaction.create({
                            data: {
                                userId: "null",
                                time: new Date(),
                                side: "SELL",
                                price: new Prisma.Decimal(bestPrice),
                                quantity: new Prisma.Decimal(bestQty),
                                totalAmount: new Prisma.Decimal(bestPrice * bestQty),
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
    
        } catch (error) {
            console.error("Error processing WebSocket message:", error);
        }
    });
    
    
    
    
    setInterval(() => {
        client.set(`${symbol}price`,price.toString());  

    },10000);
    
    setInterval(() => {
        wsServer.clients.forEach(function each(client) {
          if (client.readyState === WebSocket.OPEN) {
            var data = JSON.stringify({"price": price, "bids": bids, "asks": asks});
            client.send(data);
          }
        });
    },500)

}

async function connectRedis() {
    try{
        await client.connect();
        console.log("Connected to redis");
    }catch(e){
        console.log("error : : ", e)
        setTimeout(connectRedis,10000);
    }
}

connectRedis();
streamSubscriber("btcusdt",9433);
streamSubscriber("ethusdt",9434);
streamSubscriber("solusdt",9435);
streamSubscriber("dogeusdt",9436);

