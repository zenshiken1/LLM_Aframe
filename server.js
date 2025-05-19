// server.js
const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

// 静的ファイル
app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('[+] client', socket.id);

  // 位置+回転 を受信して他クライアントへブロードキャスト
  socket.on('send_my_state', (data) => {
    socket.broadcast.emit('update_avatar', {
      id: socket.id,
      position: data.position,
      rotation: data.rotation,
    });
  });

  // 切断通知
  socket.on('disconnect', () => {
    console.log('[-] client', socket.id);
    socket.broadcast.emit('remove_avatar', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`Server running → http://localhost:${PORT}`)
);
