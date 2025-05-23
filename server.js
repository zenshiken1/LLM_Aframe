// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 本地 Ollama 服务地址及模型名称
const OLLAMA_API = 'http://localhost:11434/api/chat';
const MODEL = 'gemma3:27b';

// 提供 public 目录下静态文件
app.use(express.static(path.join(__dirname, 'public')));

// JSON 解析中间件，支持大体积 Base64 图片
app.use(express.json({ limit: '100mb' }));

// 接口：保存截图并分析（只在终端打印结果）
app.post('/save-screenshot', async (req, res) => {
  try {
    const { image } = req.body || {};
    if (!image) {
      console.error('❌ body.image 为空，确认客户端是否发送了 JSON');
      return res.sendStatus(400);
    }

    const matches = image.match(/^data:image\/png;base64,(.+)$/);
    if (!matches) {
      console.error('❌ 无效的 Base64 图片数据');
      return res.sendStatus(400);
    }

    // 确保目录存在
    const dir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // 保存为固定文件名
    const filename = 'screenshot.png';
    const filePath = path.join(dir, filename);
    const buffer = Buffer.from(matches[1], 'base64');
    await fs.promises.writeFile(filePath, buffer);
    console.log('✔ 已保存截图：', filePath);

    // 调用 Ollama 分析
    const payload = {
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: '描述这张俯瞰图中的虚拟社交场景情况，包括有多少用户，他们在做什么，他们的位置分布如何。请用日语简洁地回答。不要回复给我多余的内容，不要markdown形式。：',
          images: [ buffer.toString('base64') ]
        }
      ],
      stream: false
    };
    const response = await axios.post(OLLAMA_API, payload);
    const assistantMessage = response.data.message?.content || response.data.response;

    // 仅在终端打印分析结果
    console.log('📝 分析结果：', assistantMessage);

    // 不返回内容给前端
    res.sendStatus(204);

  } catch (err) {
    console.error('处理失败：', err);
    res.sendStatus(500);
  }
});

// Socket.IO：VR 实时位置广播
io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);

  socket.on('send_my_pos', (data) => {
    // console.log(`Received position from ${socket.id}:`, data.position);
    socket.broadcast.emit('update_your_pos', [socket.id, data.position]);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    socket.broadcast.emit('remove_user', socket.id);
  });
});

app.post('/analyze', async (req, res) => {
  try {
    // 固定路径：项目根目录下的 screenshots/screenshot.png
    const screenshotPath = path.resolve(__dirname, 'screenshots', 'screenshot.png');

    // 检查文件是否存在
    if (!fs.existsSync(screenshotPath)) {
      return res.status(404).json({ error: '截图文件不存在：' + screenshotPath });
    }

    // 读取并转换为 Base64
    const imageData = fs.readFileSync(screenshotPath, { encoding: 'base64' });

    // 构造 Ollama 请求负载
    const payload = {
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: '请分析以下图片内容：',
          images: [ imageData ]
        }
      ],
      stream: false
    };

    // 调用 Ollama Chat 接口进行多模态分析
    const response = await axios.post(OLLAMA_API, payload);
    const assistantMessage = response.data.message?.content || response.data.response;

    // 返回分析结果
    res.json({ result: assistantMessage });
  } catch (err) {
    console.error('分析失败：', err);
    res.status(500).json({ error: err.message });
  }
});

// 启动服务
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
