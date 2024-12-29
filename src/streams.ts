import WebSocket from "ws";

const streamsSubscriber = (symbol : string,httpServer : any, path : string,client:any) => {
    const dbSymbol = symbol[0]=='b'?"BTC":symbol[0]=='e'?"ETH":symbol[0]=='s'?"SOL":"DOGE";
    const wsServer = new WebSocket.Server({ noServer: true });

    httpServer.on('upgrade', (req : any, socket : any, head : any) => {
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

    const ws = new WebSocket(wsUrl);
    const ws2 = new WebSocket(wsUrl2);


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
    
    setInterval(() => {
        try{
            client.set(`${symbol}price`,price.toString());  
        }catch(e){
            console.log(e);
        }

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

export default streamsSubscriber;