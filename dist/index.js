"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
// uptime api call to keep server alive
app.get('/ping', (req, res) => {
    res.send('pong');
});
const server = http_1.default.createServer(app);
const wss = new ws_1.WebSocketServer({ noServer: true });
// in-memory storage
const rooms = new Map();
const socketToRoom = new Map();
const socketToUsername = new Map();
const roomToMessages = new Map();
const roomToUsers = new Map();
wss.on("connection", (socket) => {
    socket.on("message", (message) => {
        const parsed = JSON.parse(message);
        // joining shit
        if (parsed.type === "join") {
            const { roomId, username } = parsed.payload;
            // set username and roomId to socket
            let room = rooms.get(roomId);
            if (!room) {
                room = new Set();
                rooms.set(roomId, room);
            }
            room.add(socket);
            socketToRoom.set(socket, roomId);
            socketToUsername.set(socket, username);
            // username set
            const users = roomToUsers.get(roomId) || new Set();
            users.add(username);
            roomToUsers.set(roomId, users);
            for (const peer of room) {
                if (peer.readyState !== ws_1.WebSocket.OPEN)
                    continue;
                if (peer !== socket) {
                    peer.send(JSON.stringify({ type: 'joined', payload: { roomId, username } }));
                }
                else {
                    peer.send(JSON.stringify({ type: 'self-joined', payload: { roomId, username } }));
                }
            }
            const usersArray = Array.from(roomToUsers.get(roomId));
            for (const peer of room) {
                if (peer.readyState === ws_1.WebSocket.OPEN) {
                    peer.send(JSON.stringify({ type: 'users', payload: { users: usersArray } }));
                }
            }
            const messages = roomToMessages.get(roomId) || [];
            socket.send(JSON.stringify({ type: 'chat-history', payload: { messages } }));
        }
        // exit request
        if (parsed.type === "exit") {
            const roomId = socketToRoom.get(socket);
            const username = socketToUsername.get(socket);
            if (!roomId || !username)
                return;
            const room = rooms.get(roomId);
            if (!room)
                return;
            // remove socket and mappings
            room.delete(socket);
            socketToRoom.delete(socket);
            socketToUsername.delete(socket);
            // remove from user set
            const users = roomToUsers.get(roomId);
            if (users) {
                users.delete(username);
                roomToUsers.set(roomId, users);
                for (const peer of room) {
                    if (peer.readyState !== ws_1.WebSocket.OPEN)
                        continue;
                    peer.send(JSON.stringify({ type: 'left', payload: { roomId, username } }));
                }
                const usersArray = Array.from(users);
                for (const peer of room) {
                    if (peer.readyState === ws_1.WebSocket.OPEN) {
                        peer.send(JSON.stringify({ type: 'users', payload: { users: usersArray } }));
                    }
                }
            }
            // cleanup empty rooms
            if (room.size === 0) {
                rooms.delete(roomId);
                roomToMessages.delete(roomId);
                roomToUsers.delete(roomId);
            }
        }
        // chat message
        if (parsed.type === "chat") {
            const roomId = socketToRoom.get(socket);
            const username = socketToUsername.get(socket);
            if (!roomId || !username)
                return;
            const room = rooms.get(roomId);
            if (!room)
                return;
            // append to history
            const history = roomToMessages.get(roomId) || [];
            const newMsg = { from: username, message: parsed.payload.message };
            history.push(newMsg);
            roomToMessages.set(roomId, history);
            // broadcast new chat
            for (const peer of room) {
                if (peer !== socket && peer.readyState === ws_1.WebSocket.OPEN) {
                    peer.send(JSON.stringify({ type: 'chat-new', payload: { from: username, message: parsed.payload.message } }));
                }
            }
        }
    });
    // on close event
    socket.on("close", () => {
        const roomId = socketToRoom.get(socket);
        const username = socketToUsername.get(socket);
        if (roomId && username) {
            const room = rooms.get(roomId);
            // remove socket
            room === null || room === void 0 ? void 0 : room.delete(socket);
            socketToRoom.delete(socket);
            socketToUsername.delete(socket);
            // remove user and broadcast updated list
            const users = roomToUsers.get(roomId);
            if (users) {
                users.delete(username);
                roomToUsers.set(roomId, users);
                if (room) {
                    const updated = Array.from(users);
                    for (const peer of room) {
                        if (peer.readyState === ws_1.WebSocket.OPEN) {
                            peer.send(JSON.stringify({ type: 'users', payload: { users: updated } }));
                        }
                    }
                }
            }
            // cleanup empty rooms
            if ((room === null || room === void 0 ? void 0 : room.size) === 0) {
                rooms.delete(roomId);
                roomToMessages.delete(roomId);
                roomToUsers.delete(roomId);
            }
        }
    });
});
// upgrade HTTP to WS
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});
const PORT = Number(process.env.PORT) || 8080;
server.listen(PORT, () => {
    console.log(`HTTP+WS server listening on port ${PORT}`);
});
