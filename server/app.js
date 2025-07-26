const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { createServer } = require('http');
const { Server } = require('socket.io');

// 导入配置
const config = require('./src/config/config.js');
const { connectDB } = require('./src/config/database');
const { connectRedis } = require('./src/config/redis');

// 创建Express应用
const app = express();
const server = createServer(app);

// 创建Socket.IO实例
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// 将io实例添加到app中，供其他模块使用
app.set('io', io);

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS配置
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 压缩中间件
app.use(compression());

// 请求日志
if (config.server.env === 'development') {
  app.use(morgan('dev'));
} else {
  // 创建日志目录
  const logDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  // 创建访问日志流
  const accessLogStream = fs.createWriteStream(
    path.join(logDir, 'access.log'),
    { flags: 'a' }
  );
  
  app.use(morgan('combined', { stream: accessLogStream }));
}

// 速率限制
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindow * 60 * 1000,
  max: config.security.rateLimitMax,
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

// 解析请求体
app.use(express.json({ 
  limit: config.upload.maxSize,
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: config.upload.maxSize 
}));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, config.upload.path)));
app.use('/public', express.static(path.join(__dirname, 'public')));

// API路由
app.use('/api', require('./src/routes'));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Service is healthy',
    timestamp: new Date().toISOString()
  });
});

// 根路径
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: config.system.name,
    version: config.system.version,
    description: config.system.description,
    timestamp: new Date().toISOString()
  });
});

// Socket.IO连接处理
io.on('connection', (socket) => {
  console.info(`Socket连接建立: ${socket.id}`);
  
  // 用户认证
  socket.on('authenticate', async (data) => {
    try {
      const { token, deviceId } = data;
      // 这里应该验证token和设备权限
      // 简化处理，实际应该调用认证服务
      socket.userId = data.userId;
      socket.deviceId = deviceId;
      
      // 加入设备房间
      if (deviceId) {
        socket.join(`device_${deviceId}`);
      }
      
      socket.emit('authenticated', { success: true });
      console.info(`Socket认证成功: ${socket.id}, 用户: ${socket.userId}`);
    } catch (error) {
      socket.emit('authentication_error', { message: '认证失败' });
      console.error('Socket认证失败:', error);
    }
  });
  
  // 设备控制指令
  socket.on('device_command', (data) => {
    const { deviceId, command, params } = data;
    
    // 转发指令到目标设备
    socket.to(`device_${deviceId}`).emit('command', {
      command,
      params,
      timestamp: new Date().toISOString(),
      requestId: data.requestId
    });
    
    console.info(`设备指令发送: ${deviceId}, 指令: ${command}`);
  });
  
  // 设备响应
  socket.on('device_response', (data) => {
    const { requestId, result, error } = data;
    
    // 转发响应到控制端
    socket.broadcast.emit('command_response', {
      requestId,
      result,
      error,
      timestamp: new Date().toISOString()
    });
  });
  
  // 位置更新
  socket.on('location_update', (data) => {
    const { deviceId, location } = data;
    
    // 广播位置更新
    socket.broadcast.emit('location_updated', {
      deviceId,
      location,
      timestamp: new Date().toISOString()
    });
  });
  
  // 断开连接
  socket.on('disconnect', () => {
    console.info(`Socket连接断开: ${socket.id}`);
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '请求的资源不存在',
    code: 'NOT_FOUND'
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    code: 'INTERNAL_SERVER_ERROR'
  });
});

module.exports = { app, server };