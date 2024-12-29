import prisma from ".";
import { streamClient } from ".";

export default async function updateDB() {
    try{
        const listLen = await streamClient.lLen("db");
        if (!listLen) return;
        const jobData = await streamClient.lPop("db");
        if (!jobData) return;
        try{
            
            const jobObj = JSON.parse(jobData);
            const status = jobObj.status == "PARTIALLY_FILLED"?"PARTIALLY_FILLED":"COMPLETED";
            const symbol = jobObj.symbol[0]=='b'?"BTC":jobObj.symbol[0]=='e'?"ETH":jobObj.symbol[0]=='s'?"SOL":"DOGE";
            const side = jobObj.side=="SELL"?"SELL":"BUY";

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
                        side,
                        price : jobObj.price,
                        quantity : jobObj.quantity,
                        totalAmount : jobObj.totalAmount,
                        orderId : jobObj.orderId,
                        symbol
                    }
                })
            ])
        }catch(e){
            console.log("e")
            await streamClient.lPush("db",jobData)
        }
    }
    catch(e){
        console.log("error while updating getting data from redis stream",e)
    }
}