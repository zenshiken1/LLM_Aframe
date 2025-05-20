// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
// 引入 node-fetch，用于调用本地大模型的 HTTP 接口

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 提供 public 目录下静态文件
app.use(express.static(path.join(__dirname, 'public')));

// JSON 解析中间件，支持大体积 Base64 图片
app.use(express.json({ limit: '100mb' }));

// 接口：保存截图并调用本地大模型处理
app.post('/save-screenshot', (req, res) => {
  const { image } = req.body || {};
  if (!image) {
    return res.status(400).send('❌ body.image 为空，确认客户端是否发送了 JSON');
  }
  const matches = image.match(/^data:image\/png;base64,(.+)$/);
  if (!matches) {
    return res.status(400).send('❌ 无效的 Base64 图片数据');
  }

  // 将 Base64 解码并保存为文件
  const buffer = Buffer.from(matches[1], 'base64');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `screenshot-${timestamp}.png`;
  const dir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  fs.writeFile(path.join(dir, filename), buffer, async (err) => {
    if (err) {
      console.error('写入失败：', err);
      return res.status(500).send('❌ 保存失败');
    }
    console.log('✔ 已保存：', filename);

    // 调用本地大模型 API 进行图片处理
    try {
      const llmResp = await fetch('http://192.168.0.40:1234/v1/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 如果 LM Studio 配置了 API Key 验证，则需要在这里加上：
          // 'Authorization': 'Bearer YOUR_API_KEY'
        },
        body: JSON.stringify({
          model: 'gemma-3-4b-it-qat',  // 替换成你的图像处理模型名称
          image,                       // 原始 Base64 字符串
          prompt: '描述这张俯瞰图中的虚拟社交场景情况，包括有多少用户，他们在做什么，他们的位置分布如何。请用日语简洁地回答。',
          max_tokens: 200,
          temperature: 0.7
        })
      });

      if (!llmResp.ok) {
        const text = await llmResp.text();
        throw new Error(`LLM 服务返回非 OK 状态: ${llmResp.status} ${text}`);
      }

      const llmData = await llmResp.json();
      // console.log('LLM 处理结果：', llmData);
      // 将文件名和模型返回内容一并返回给前端
      res.send({ status: 'ok', filename, llmResult: llmData });
      io.emit('llm_broadcast', { filename, llmResult: llmData });
    } catch (e) {
      console.error('调用 LLM 失败：', e);
      // 即便模型调用失败，也先告知客户端截图已保存
      res.send({ status: 'ok', filename, llmError: e.message });
    }
  });
});

// Socket.IO：VR 实时位置广播
io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);

  socket.on('send_my_pos', (data) => {
    console.log(`Received position from ${socket.id}:`, data.position);
    socket.broadcast.emit('update_your_pos', [socket.id, data.position]);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    socket.broadcast.emit('remove_user', socket.id);
  });
});

// 启动服务
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
