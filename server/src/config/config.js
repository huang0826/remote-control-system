require('dotenv').config();

module.exports = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.SERVER_HOST || '114.215.211.109',
    url: process.env.SERVER_URL || 'http://114.215.211.109:3000',
    env: process.env.NODE_ENV || 'production'
  },
  database: {
    host: process.env.DB_HOST || '114.215.211.109',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'remote_control_db',
    user: process.env.DB_USER || 'remote_user',
    password: process.env.DB_PASSWORD || 'Huang266134',
    charset: process.env.DB_CHARSET || 'utf8mb4',
    timezone: process.env.DB_TIMEZONE || '+08:00'
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB || 0
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'Huang266134_jwt_secret_key_2025',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },
  encrypt: {
    key: process.env.ENCRYPT_KEY || 'Huang266134_encrypt_key_2025_remote_control',
    iv: process.env.ENCRYPT_IV || 'remote_control_iv'
  },
  upload: {
    path: process.env.UPLOAD_PATH || 'uploads',
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 104857600,
    allowedTypes: (process.env.UPLOAD_ALLOWED_TYPES || 'jpg,jpeg,png,gif,mp3,wav,mp4,avi,mov,txt,log').split(',')
  },
  log: {
    level: process.env.LOG_LEVEL || 'info',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD'
  },
  security: {
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 15,
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    sessionSecret: process.env.SESSION_SECRET || 'Huang266134_session_secret_2025',
    sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000
  },
  socket: {
    corsOrigin: process.env.SOCKET_CORS_ORIGIN || '*',
    pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000,
    pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000
  },
  system: {
    name: process.env.SYSTEM_NAME || '我帮防盗',
    version: process.env.SYSTEM_VERSION || '1.0.0',
    description: process.env.SYSTEM_DESCRIPTION || '远程手机控制系统',
    keywords: process.env.SYSTEM_KEYWORDS || '远程控制,手机监控,防盗,定位'
  },
  agent: {
    minCommission: parseFloat(process.env.AGENT_MIN_COMMISSION) || 5.00,
    defaultCommission: parseFloat(process.env.AGENT_DEFAULT_COMMISSION) || 10.00,
    maxCommission: parseFloat(process.env.AGENT_MAX_COMMISSION) || 50.00
  },
  membership: {
    freeLimits: process.env.MEMBERSHIP_FREE_LIMITS ? JSON.parse(process.env.MEMBERSHIP_FREE_LIMITS) : {photo: 5, location: 10},
    trialDays: parseInt(process.env.MEMBERSHIP_TRIAL_DAYS) || 7
  }
};