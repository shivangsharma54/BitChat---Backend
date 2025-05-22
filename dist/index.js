"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
app.get('/ping', (req, res) => {
    res.send('pong');
});
const server = http_1.default.createServer(app);
const wss = new ws_1.WebSocketServer({ noServer: true });
const rooms = new Map();
const socketToRoom = new Map();
wss.on("connection", (socket) => {
    socket.on("message", (message) => {
        // message is an object :
        /*
            {
                "type": "join",
                "payload": {
                    "roomId": "123"
                }
            }
        */
        /*
            {
                "type": "chat",
                "payload": {
                    "message: "hi there"
                }
            }
        */
        const parsedMessage = JSON.parse(message);
        if (parsedMessage.type === "join") {
            const roomId = parsedMessage.payload.roomId;
            let room = rooms.get(roomId); // get the set of WebSockets for the given room
            if (!room) { // if there is no room for the given roomId , create a new one
                room = new Set();
                rooms.set(roomId, room);
            }
            room.add(socket);
            socketToRoom.set(socket, roomId);
            socket.send(JSON.stringify({ type: 'joined', payload: { roomId } }));
        }
        if (parsedMessage.type === "chat") {
            // i got the socket but i need to get the roomId
            const roomId = socketToRoom.get(socket);
            if (!roomId) {
                return;
            }
            const room = rooms.get(roomId);
            for (const peer of room) {
                if (peer != socket && peer.readyState === ws_1.WebSocket.OPEN) {
                    peer.send(JSON.stringify({
                        type: 'chat',
                        payload: { message: parsedMessage.payload.message }
                    }));
                }
            }
        }
    });
    socket.on("close", () => {
        const roomId = socketToRoom.get(socket);
        if (roomId) {
            const room = rooms.get(roomId);
            room === null || room === void 0 ? void 0 : room.delete(socket);
            if ((room === null || room === void 0 ? void 0 : room.size) === 0) {
                rooms.delete(roomId);
            }
            socketToRoom.delete(socket);
        }
    });
});
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});
const PORT = Number(process.env.PORT) || 8080;
server.listen(PORT, () => {
    console.log(`HTTP+WS server listening on port ${PORT}`);
});
