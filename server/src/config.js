/**
 * 系统配置
 */

require('dotenv').config();

module.exports = {
  // 服务器配置
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  host: process.env.SERVER_HOST || '0.0.0.0',
  url: process.env.SERVER_URL || 'http://localhost:3000',

  // 数据库配置
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'remote_control_db',
    user: process.env.DB_USER || 'remote_user',
    password: process.env.DB_PASSWORD || 'huang2266134',
    charset: process.env.DB_CHARSET || 'utf8mb4',
    timezone: process.env.DB_TIMEZONE || '+08:00',
    connectionLimit: 10,
    connectTimeout: 10000
  },

  // Redis配置
  redis: {
    enabled: false, // 暂时禁用Redis
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: parseInt(process.env.REDIS_DB) || 0
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your-jwt-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },

  // 加密配置
  encrypt: {
    key: process.env.ENCRYPT_KEY || 'your-encrypt-key',
    iv: process.env.ENCRYPT_IV || 'your-encrypt-iv'
  },

  // 文件上传配置
  upload: {
    path: process.env.UPLOAD_PATH || './uploads',
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 104857600,
    allowedTypes: (process.env.UPLOAD_ALLOWED_TYPES || '').split(',') || []
  },

  // Socket.IO配置
  socket: {
    corsOrigin: process.env.SOCKET_CORS_ORIGIN || '*',
    pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000,
    pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000
  },

  // 系统配置
  system: {
    name: process.env.SYSTEM_NAME || '远程控制系统',
    version: process.env.SYSTEM_VERSION || '1.0.0',
    description: process.env.SYSTEM_DESCRIPTION || '远程手机控制系统',
    keywords: (process.env.SYSTEM_KEYWORDS || '').split(',') || []
  },

  // 日志配置
  log: {
    level: process.env.LOG_LEVEL || 'info',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD'
  },

  // 安全配置
  security: {
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 900000,
      max: parseInt(process.env.RATE_LIMIT_MAX) || 100
    },
    session: {
      secret: process.env.SESSION_SECRET || 'your-session-secret',
      maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000
    }
  },

  // 调试配置
  debug: {
    sql: process.env.NODE_ENV === 'development'
  }
};