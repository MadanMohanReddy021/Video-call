const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

// React build
const buildPath = path.join(__dirname, "../client/build");
app.use(express.static(buildPath));
app.use((req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

io.on("connection", (socket) => {
  socket.on("join-room", (room) => {
    const roomClients = Array.from(
      io.sockets.adapter.rooms.get(room) || []
    );

    socket.join(room);

    // 🔑 Tell new user who already exists
    socket.emit("existing-users", roomClients);

    // Tell others someone joined
    socket.to(room).emit("new-user", socket.id);
  });

  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", {
      from: socket.id,
      data,
    });
  });

  socket.on("disconnect", () => {
    socket.broadcast.emit("user-left", socket.id);
  });
});

server.listen(3000, () =>
  console.log("Server running http://localhost:3000")
);
