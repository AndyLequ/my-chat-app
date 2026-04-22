const { WebSocketServer } = require("ws");

const wss = new WebSocketServer({ port: 8080 });
const clients = new Set();
const rooms = new Map(); // new: stores room -> set of sockets

wss.on("connection", (socket) => {
  clients.add(socket);
  console.log("Client connected. Total:", clients.size);

  socket.isAlive = true;
  socket.on("pong", () => {
    socket.isAlive = true;
  });

  socket.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return; // NEW: ignore malformed messages
    }

    //new switch that works for app having multiple rooms
    switch (msg.type) {
      case "join-room":
        //leave current room if already in one
        if (socket.currentRoom) {
          const prevRoom = rooms.get(socket.currentRoom);
          if (prevRoom) prevRoom.delete(socket);
        }

        //create room if it doesn't exist
        if (!rooms.has(msg.room)) rooms.set(msg.room, new Set());
        // add socket to new room
        rooms.get(msg.room).add(socket);
        socket.currentRoom = msg.room;
        socket.userName = msg.name;
        //announce to everyone in the room
        broadcastToRoom(msg.room, {
          type: "join",
          name: msg.name,
          room: msg.room,
        });
        break;

      case "chat":
        if (!socket.currentRoom) return;
        broadcastToRoom(socket.currentRoom, {
          type: "chat",
          name: msg.name,
          text: msg.text,
          timestamp: msg.timestamp,
          room: socket.currentRoom,
        });
        break;

      case "typing":
        if (!socket.currentRoom) return;
        broadcastToRoomExcludingSender(socket, socket.currentRoom, {
          type: "typing",
          name: msg.name,
          room: socket.currentRoom,
        });
        break;
    }
  });

  socket.on("close", () => {
    // remove from room on disconnect
    if (socket.currentRoom) {
      const room = rooms.get(socket.currentRoom);
      if (room) {
        room.delete(socket);
        //announce they left
        broadcastToRoom(socket.currentRoom, {
          type: "leave",
          name: socket.userName,
          room: socket.currentRoom,
        });
      }
    }
    clients.delete(socket);
    console.log("Client left. Total:", clients.size);
  });
});

function broadcast(message) {
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
}

function broadcastToOthers(sender, message) {
  for (const client of clients) {
    if (client !== sender && client.readyState === client.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
}

setInterval(() => {
  for (const socket of wss.clients) {
    if (!socket.isAlive) {
      socket.terminate();
      return;
    }
    socket.isAlive = false;
    socket.ping();
  }
}, 30000);

console.log("Websocket server running on ws://localhost:8080");
