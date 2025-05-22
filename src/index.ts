import { WebSocketServer , WebSocket } from "ws";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({noServer: true});

const rooms = new Map<string,Set<WebSocket>>();
const socketToRoom = new Map<WebSocket,string>();

wss.on("connection", (socket : WebSocket) => {

    socket.on("message",(message : string) => {  // message is of STRING type always
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

        if(parsedMessage.type === "join"){
            const roomId = parsedMessage.payload.roomId;

            let room = rooms.get(roomId);   // get the set of WebSockets for the given room

            if(!room){  // if there is no room for the given roomId , create a new one
                room = new Set();
                rooms.set(roomId,room);
            }

            room.add(socket);
            socketToRoom.set(socket,roomId);
            socket.send(JSON.stringify({ type: 'joined', payload: { roomId } }));
        }

        if(parsedMessage.type === "chat"){
            // i got the socket but i need to get the roomId
            const roomId = socketToRoom.get(socket);

            if(!roomId){
                return;
            }

            const room = rooms.get(roomId);
            
            for(const peer of room!){
                if(peer != socket && peer.readyState === WebSocket.OPEN){
                    peer.send(JSON.stringify({
                        type: 'chat',
                        payload: { message: parsedMessage.payload.message }
                    }));
                }
            }
        }
    })

    socket.on("close",() => {
        const roomId = socketToRoom.get(socket);
        if(roomId){
            const room = rooms.get(roomId);
            room?.delete(socket);
            if(room?.size === 0){
                rooms.delete(roomId);
            }
            socketToRoom.delete(socket);
        }
    })
})

 
server.on('upgrade', (request, socket, head) => { 
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

const PORT = Number(process.env.PORT) || 8080;
server.listen(PORT, () => {
  console.log(`HTTP+WS server listening on port ${PORT}`);
});