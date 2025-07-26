/**
 * 远程手机控制系统 - 服务器主入口文件
 * @author Remote Control System
 * @version 1.0.0
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const path = require('path');

// 导入配置和工具
const config = require('./config');
const logger = require('./utils/logger');
const database = require('./database/connection');
const redisClient = require('./utils/redis');
// 修改第25行
// 原代码: const socketHandler = require('./socket/handler');
// 修改为:
const socketHandler = require('./socket/socketManager');

// 导入路由
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const deviceRoutes = require('./routes/device');
const fileRoutes = require('./routes/file');
const controlRoutes = require('./routes/control');
const membershipRoutes = require('./routes/membership');
const agentRoutes = require('./routes/agent');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payment');
const locationRoutes = require('./routes/location');
const appRoutes = require('./routes/app');
const fileManagerRoutes = require('./routes/fileManager');

// 导入中间件
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

// 创建Express应用
const app = express();
const server = http.createServer(app);

// 删除这部分代码，改为使用socketManager初始化
// const io = socketIo(server, {
//   cors: {
//     origin: process.env.SOCKET_CORS_ORIGIN || "*",
//     methods: ["GET", "POST"]
//   },
//   pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000,
//   pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000
// });

// 初始化Socket.IO
const io = socketHandler.initialize(server);

// 全局变量
global.io = io;

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS配置
app.use(cors({
  origin: function (origin, callback) {
    // 允许所有来源（生产环境中应该限制）
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 压缩中间件
app.use(compression());

// 请求体解析
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/public', express.static(path.join(__dirname, '../public')));

// 速率限制
const limiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: {
    error: '请求过于频繁，请稍后再试',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Session配置
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'Huang266134_session_secret_2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000 // 24小时
  }
};

// 如果Redis启用，使用Redis存储会话
if (config.redis.enabled) {
  sessionConfig.store = new RedisStore({ client: redisClient });
}

app.use(session(sessionConfig));

// 请求日志中间件
app.use(requestLogger);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.SYSTEM_VERSION || '1.0.0',
    uptime: process.uptime()
  });
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/user', authMiddleware, userRoutes);
app.use('/api/device', authMiddleware, deviceRoutes);
app.use('/api/file', authMiddleware, fileRoutes);
app.use('/api/control', authMiddleware, controlRoutes);
app.use('/api/membership', authMiddleware, membershipRoutes);
app.use('/api/agent', authMiddleware, agentRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/payment', authMiddleware, paymentRoutes);
app.use('/api/location', authMiddleware, locationRoutes);
app.use('/api/app', appRoutes);
app.use('/api/file-manager', authMiddleware, fileManagerRoutes);

// 根路径
app.get('/', (req, res) => {
  res.json({
    name: process.env.SYSTEM_NAME || '我帮防盗',
    version: process.env.SYSTEM_VERSION || '1.0.0',
    description: process.env.SYSTEM_DESCRIPTION || '远程手机控制系统',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      api: '/api',
      admin: '/admin',
      agent: '/agent'
    }
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: '接口不存在',
    code: 'NOT_FOUND',
    path: req.originalUrl
  });
});

// 错误处理中间件
app.use(errorHandler);

// 删除这行代码，因为我们已经在初始化时设置了事件处理
// socketHandler(io);

// 优雅关闭
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown(signal) {
  logger.info(`收到 ${signal} 信号，开始优雅关闭...`);
  
  server.close(() => {
    logger.info('HTTP服务器已关闭');
    
    // 关闭Socket.IO连接
    const socketHandler = require('./socket/socketManager');
    socketHandler.cleanup();
    logger.info('Socket.IO连接已关闭');
    
    // 关闭数据库连接
    database.end(() => {
      logger.info('数据库连接已关闭');
      
      // 关闭Redis连接
      if (config.redis.enabled) {
        redisClient.quit(() => {
          logger.info('Redis连接已关闭');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    });
  });
  
  // 强制退出
  setTimeout(() => {
    logger.error('强制退出');
    process.exit(1);
  }, 10000);
}

// 未捕获异常处理
process.on('uncaughtException', (err) => {
  logger.error('未捕获异常:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝:', reason);
  process.exit(1);
});

// 启动服务器
const PORT = process.env.PORT || 3000;
const HOST = process.env.SERVER_HOST || '0.0.0.0';

// 导出app用于测试
module.exports = app;

// 删除以下所有重复的路由配置（从第240行到文件末尾）
// app.use('/api/file-manager', authMiddleware, fileManagerRoutes);
// app.use('/api/file-manager', authMiddleware, fileManagerRoutes);
// ... 数百行重复代码 ...
