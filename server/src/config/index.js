/**
 * 系统配置文件
 */

module.exports = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    host: process.env.SERVER_HOST || '114.215.211.109',
    url: process.env.SERVER_URL || 'http://114.215.211.109:3000',
    env: process.env.NODE_ENV || 'production'
  },

  // 数据库配置
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'remote_control',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Huang266134',
    charset: process.env.DB_CHARSET || 'utf8mb4',
    timezone: process.env.DB_TIMEZONE || '+08:00',
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
  },

  // Redis配置
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB) || 0,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'Huang266134_jwt_secret_key_2025',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    algorithm: 'HS256'
  },

  // 加密配置
  encryption: {
    key: process.env.ENCRYPT_KEY || 'Huang266134_encrypt_key_2025_remote_control',
    iv: process.env.ENCRYPT_IV || 'remote_control_iv',
    algorithm: 'aes-256-cbc'
  },

  // 文件上传配置
  upload: {
    path: process.env.UPLOAD_PATH || './uploads',
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 104857600,
    allowedTypes: (process.env.UPLOAD_ALLOWED_TYPES || 'jpg,jpeg,png,gif,mp3,wav,mp4,txt,log').split(','),
    imageQuality: 80,
    videoQuality: 'medium'
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
      windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_MAX) || 100
    },
    session: {
      secret: process.env.SESSION_SECRET || 'Huang266134_session_secret_2025',
      maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000
    }
  },

  // Socket.IO配置
  socket: {
    corsOrigin: process.env.SOCKET_CORS_ORIGIN || '*',
    pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000,
    pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000
  },

  // 系统配置
  system: {
    name: process.env.SYSTEM_NAME || '设备管理系统',
    version: process.env.SYSTEM_VERSION || '1.0.0',
    description: process.env.SYSTEM_DESCRIPTION || '远程设备管理系统',
    keywords: process.env.SYSTEM_KEYWORDS || '远程控制,设备管理,监控'
  },

  // 代理配置
  agent: {
    minCommission: parseFloat(process.env.AGENT_MIN_COMMISSION) || 5.00,
    defaultCommission: parseFloat(process.env.AGENT_DEFAULT_COMMISSION) || 10.00,
    maxCommission: parseFloat(process.env.AGENT_MAX_COMMISSION) || 30.00
  },

  // 会员配置
  membership: {
    freeLimits: JSON.parse(process.env.MEMBERSHIP_FREE_LIMITS || '{"photo":10,"location":20}'),
    trialDays: parseInt(process.env.MEMBERSHIP_TRIAL_DAYS) || 3
  },

  // 调试配置
  debug: {
    enabled: process.env.DEBUG_ENABLED === 'true',
    sql: process.env.DEBUG_SQL === 'true',
    socket: process.env.DEBUG_SOCKET === 'true'
  }
};