import prisma from ".";
import { streamClient } from ".";

export default async function updateDB() {
    try{
        const listLen = await streamClient.lLen("db"); // queue mein order to be executed
        // console.log("len",listLen);
        if (!listLen) return;
        const jobData = await streamClient.lPop("db");
        // console.log("len",jobData);
        if (!jobData) return;
        try{
            // console.log("entered try")
            const jobObj = JSON.parse(jobData);
            const status = jobObj.status == "PARTIALLY_FILLED"?"PARTIALLY_FILLED":"COMPLETED";
            const symbol = jobObj.symbol[0]=='b'?"BTC":jobObj.symbol[0]=='e'?"ETH":jobObj.symbol[0]=='s'?"SOL":"DOGE";
            const side = jobObj.side=="SELL"?"SELL":"BUY";
            
            const ord = await prisma.order.findUnique({
                where : {
                    id : jobObj.orderId
                }
            })
            const userId = ord?ord.userId:"test";

            await prisma.$transaction([
                // update order
                prisma.order.update({
                    where : {
                        id : jobObj.orderId
                    },
                    data : {
                        status,
                        filledQuantity : {increment : jobObj.quantity}
                    }
                }),

                // make transaction
                prisma.transaction.create({
                    data : {
                        time : jobObj.time,
                        userId : ord?ord.userId : "",
                        side,
                        price : jobObj.price,
                        quantity : jobObj.quantity,
                        totalAmount : jobObj.totalAmount,
                        orderId : jobObj.orderId,
                        symbol
                    }
                })
            ])
            // console.log("transcion done")
        }catch(e){
            console.log("e")
            await streamClient.lPush("db",jobData)
        }
    }
    catch(e){
        console.log("error while updating getting data from redis stream",e)
    }
}