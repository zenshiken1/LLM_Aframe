// server.js
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(express.static('public'));   // 把 /public 当静态目录

// 记录所有在线用户的最新位姿
const avatars = {};   // { socketId: poseData }

io.on('connection', socket => {
  console.log('🟢', socket.id, '上线');

  // 把现有用户的位姿发给新用户
  socket.emit('init', avatars);

  // 监听并转发位姿更新
  socket.on('update', pose => {
    avatars[socket.id] = pose;
    socket.broadcast.emit('update', { id: socket.id, pose });
  });

  // 下线清理
  socket.on('disconnect', () => {
    console.log('🔴', socket.id, '离线');
    delete avatars[socket.id];
    io.emit('remove', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`🚀 服务器已启动： http://localhost:${PORT}`)
);
