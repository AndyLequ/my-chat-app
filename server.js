const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({port: 8080});
const clients = new Set();

wss.on('connection', (socket) => {
    clients.add(socket);
    console.log('Client connected. Total:',clients.size);

    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true;});

    setInterval(() => {
        for(const socket of wss.clients) {
            if(!socket.isAlive) {socket.terminate(); return;}
            socket.isAlive = false;
            socket.ping();
        }
    }, 30000);

    socket.on('message', (raw) => {
        const message = JSON.parse(raw);
        for(const client of clients) {
            if(client.readyState === client.OPEN){
                client.send(JSON.stringify(message));
            }
        }
    })

    socket.on('message', (raw) => {
        let msg;
        try{
            msg = JSON.parse(raw);
        } catch {
            return; // NEW: ignore malformed messages
        }

        switch (msg.type) {
            case 'chat':
                broadcast(msg);
                break;
            case 'typing': // NEW: only send to others, not the sender
                broadcastToOthers(socket, msg);
                break;
            case 'join': // NEW: announce when someone joins
                broadcast({type: 'join', name: msg.name});
                break;
            default:
                break;
        }
    });

    socket.on('close',() => {
        clients.delete(socket);
        console.log('Client left. Total:', clients.size);
    });
});

console.log('Websocket server running on ws://localhost:8080');