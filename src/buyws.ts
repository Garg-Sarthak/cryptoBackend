import WebSocket from "ws";
import { streamClient } from ".";
import updateDB from "./dbUpdate";

export async function executeOrder(symbol : string,client:any){
    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@ticker`;
    const buyWs = new WebSocket(wsUrl);
    const sellWs = new WebSocket(wsUrl);
    buyWs.on('message', async (data: string) => {
        try {
            const binanObj = JSON.parse(data);
            const bestPrice = parseFloat(binanObj['b']);
            let bestQty = parseFloat(binanObj['B']);
    
            // Fetch buy orders with price >= bestPrice
            const buy_orders = await client.zRangeByScoreWithScores(`${symbol}_buy`, bestPrice, Infinity); //sorted set
    
            for (const buy_order of buy_orders) {
                const val = JSON.parse(buy_order.value);
                const qtyOrder = parseFloat(val.qty);
                const oid = parseInt(val.oid);

                let time,quantity, totalAmount, status;
    
                if (bestQty >= qtyOrder) {
                    bestQty -= qtyOrder;
    
                    // Remove completed order from Redis
                    await client.zRem(`${symbol}_buy`, buy_order.value);
                    
                    time = new Date().toISOString();
                    quantity = qtyOrder;
                    status = "COMPLETED";
                    totalAmount = bestPrice*quantity
                

                    const orderDetails = { time, side: "BUY", price: bestPrice, quantity, status, totalAmount, orderId: oid, symbol };
                    try{
                        await streamClient.lPush("db", JSON.stringify(orderDetails)); // db job to redis queue 
                        updateDB();
                    }catch(e){
                        console.log("error while adding to redis stream")
                    }
                    
                } else {
                    const remainingQty = qtyOrder - bestQty;
                    time = new Date().toISOString();
                    quantity = bestQty;
                    status = "PARTIALLY_FILLED";
                    bestQty = 0;
    
                    await client.zRem(`${symbol}_buy`, buy_order.value);
                    if (remainingQty) await client.zAdd(`${symbol}_buy`, {
                        score: buy_order.score,
                        value: JSON.stringify({ oid, qty: remainingQty }),
                    });

                    totalAmount = bestPrice*quantity
                    const orderDetails = { time, side: "BUY", price: bestPrice, quantity, status, totalAmount, orderId: oid, symbol };
                    try{
                        await streamClient.lPush("db", JSON.stringify(orderDetails));
                        updateDB();
                    }catch(e){
                        console.log("error while adding to redis stream")
                    }
                }
                if (bestQty <= 0) break;
            }
        } 
        catch (error) {
            console.error("Error processing WebSocket message:", error);
        }
    })
    sellWs.on('message', async (data: string) => {
        try {
            const binanObj = JSON.parse(data);
            const bestPrice = parseFloat(binanObj['a']);
            let bestQty = parseFloat(binanObj['A']);
    
            // Fetch buy orders with price <= bestPrice
            const sell_orders = await client.zRangeByScoreWithScores(`${symbol}_sell`, -Infinity,bestPrice);
    
            for (const sell_order of sell_orders) {


                const val = JSON.parse(sell_order.value);
                
                const oid = parseInt(val.oid);
                const qtyOrder = parseFloat(val.qty);

                let time,quantity, totalAmount, status;
    
                if (bestQty > qtyOrder) {
                    bestQty -= qtyOrder;
    
                    // Remove completed order from Redis
                    await client.zRem(`${symbol}_sell`, sell_order.value);
                    
                    time = new Date().toISOString();
                    quantity = qtyOrder;
                    status = "COMPLETED";

                    totalAmount = bestPrice*quantity
                    const orderDetails = { time, side: "SELL", price: bestPrice, quantity, status, totalAmount, orderId: oid, symbol };
                    try{
                        streamClient.lPush("db",JSON.stringify(orderDetails));
                        updateDB();
                    }catch(e){
                        console.log("error while adding to redis stream")
                    }
                    
                    
                } else {
                    const remainingQty = qtyOrder - bestQty;
                    time = new Date().toISOString();
                    quantity = bestQty;
                    status = "PARTIALLY_FILLED";
                    bestQty = 0;
    
                    await client.zRem(`${symbol}_sell`, sell_order.value);
                    if (remainingQty) await client.zAdd(`${symbol}_sell`, {
                        score: sell_order.score,
                        value: JSON.stringify({ oid, qty: remainingQty }),
                    });

                    totalAmount = bestPrice*quantity
                    const orderDetails = { time, side: "SELL", price: bestPrice, quantity, status, totalAmount, orderId: oid, symbol };
                    try{
                        streamClient.lPush("db",JSON.stringify(orderDetails));
                        updateDB();
                    }catch(e){
                        console.log("error while adding to redis stream")
                    }
                }
                if (bestQty <= 0) break;
            }
        } 
        catch (error) {
            console.error("Error processing WebSocket message:", error);
        }
    })
}

