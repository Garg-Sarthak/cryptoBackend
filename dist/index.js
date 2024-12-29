"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamClient = exports.client = void 0;
const http_1 = require("http");
const dotenv_1 = require("dotenv");
const redis_1 = require("redis");
const client_1 = require("@prisma/client");
const streams_1 = __importDefault(require("./streams"));
const buyws_1 = require("./buyws");
const dbUpdate_1 = __importDefault(require("./dbUpdate"));
(0, dotenv_1.config)();
exports.client = (0, redis_1.createClient)({ url: process.env.REDIS_URL });
exports.streamClient = (0, redis_1.createClient)({ url: process.env.REDIS_STREAM_URL });
const prisma = new client_1.PrismaClient();
prisma.$connect().then(() => console.log("connected to prisma"));
// prisma.transaction.findMany()
// .then((data) => console.log(data));
const httpServer = (0, http_1.createServer)((req, res) => {
    res.end("request sent to websocket server");
});
httpServer.listen(8080);
function connectRedis() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield exports.client.connect();
            yield exports.streamClient.connect();
            setInterval(() => {
                if (exports.streamClient.isReady)
                    (0, dbUpdate_1.default)();
            }, 100);
            console.log("Connected to redis");
        }
        catch (e) {
            console.log("error : : ", e);
        }
    });
}
connectRedis();
(0, buyws_1.executeOrder)("btcusdt", exports.client);
(0, buyws_1.executeOrder)("ethusdt", exports.client);
(0, buyws_1.executeOrder)("solusdt", exports.client);
(0, buyws_1.executeOrder)("dogeusdt", exports.client);
(0, streams_1.default)("btcusdt", httpServer, "/btcusdt", exports.client);
(0, streams_1.default)("ethusdt", httpServer, "/ethusdt", exports.client);
(0, streams_1.default)("solusdt", httpServer, "/solusdt", exports.client);
(0, streams_1.default)("dogeusdt", httpServer, "/dogeusdt", exports.client);
exports.default = prisma;
