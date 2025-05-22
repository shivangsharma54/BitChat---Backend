"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const port = Number(process.env.PORT) || 8080;
const wss = new ws_1.WebSocketServer({ port });
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
                    peer.send(parsedMessage.payload.message);
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
