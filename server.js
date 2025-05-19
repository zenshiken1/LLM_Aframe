const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 提供 public 目录下静态文件
app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);

  // 接收并广播位置与朝向
  socket.on('send_my_state', (data) => {
    socket.broadcast.emit('update_user_state', [socket.id, data]);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    socket.broadcast.emit('remove_user', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
