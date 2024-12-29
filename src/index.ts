import {createServer} from 'http';
import { config } from 'dotenv';
import { createClient } from 'redis';
import { PrismaClient } from '@prisma/client';
import streamsSubscriber from './streams';
import { executeOrder } from './buyws';
import updateDB from './dbUpdate';


config()

export const client = createClient({url : process.env.REDIS_URL});
export const streamClient = createClient({url : process.env.REDIS_STREAM_URL})

const prisma = new PrismaClient();
prisma.$connect().then(() => console.log("connected to prisma"));  
// prisma.transaction.findMany()
// .then((data) => console.log(data));



const httpServer = createServer((req, res) => {
        res.end("request sent to websocket server");
    }); 
httpServer.listen(8080);

async function connectRedis() {
    try{
        await client.connect();
        await streamClient.connect();
        
        console.log("Connected to redis");
    }catch(e){
        console.log("error : : ", e)
    }
}

connectRedis();
executeOrder("btcusdt",client);
executeOrder("ethusdt",client);
executeOrder("solusdt",client);
executeOrder("dogeusdt",client);


// setInterval(() => {
//     if (streamClient.isReady) updateDB();
// },100)


streamsSubscriber("btcusdt",httpServer,"/btcusdt",client);
streamsSubscriber("ethusdt",httpServer,"/ethusdt",client);
streamsSubscriber("solusdt",httpServer,"/solusdt",client);
streamsSubscriber("dogeusdt",httpServer,"/dogeusdt",client);

export default prisma
