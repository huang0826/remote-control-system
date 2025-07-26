/**
 * 日志工具
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// 确保日志目录存在
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// 创建日志传输器
const transports = [];

// 控制台输出
if (config.server.env === 'development') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  );
}

// 错误日志
transports.push(
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: logFormat,
    maxsize: 20 * 1024 * 1024, // 20MB
    maxFiles: 14
  })
);

// 组合日志
transports.push(
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    format: logFormat,
    maxsize: 20 * 1024 * 1024, // 20MB
    maxFiles: 14
  })
);

// 创建日志器
const logger = winston.createLogger({
  level: config.log.level || 'info',
  format: logFormat,
  transports,
  exitOnError: false
});

// 处理未捕获的异常
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logDir, 'exceptions.log'),
    format: logFormat
  })
);

// 处理未处理的Promise拒绝
logger.rejections.handle(
  new winston.transports.File({
    filename: path.join(logDir, 'rejections.log'),
    format: logFormat
  })
);

// 导出日志器和日志函数
module.exports = {
  ...logger,
  logRequest,
  logDatabase,
  logUserAction,
  logSecurity,
  logSystem,
  logDeviceAction
};

/**
 * 记录API请求
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @param {number} duration 请求耗时
 */
function logRequest(req, res, duration) {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    userId: req.user ? req.user.id : null
  };
  
  if (res.statusCode >= 400) {
    logger.warn('API请求异常', logData);
  } else {
    logger.info('API请求', logData);
  }
}

/**
 * 记录数据库操作
 * @param {string} operation 操作类型
 * @param {string} table 表名
 * @param {Object} data 操作数据
 * @param {number} duration 操作耗时
 */
function logDatabase(operation, table, data = {}, duration = 0) {
  logger.debug('数据库操作', {
    operation,
    table,
    data: config.debug.sql ? data : '[隐藏]',
    duration: `${duration}ms`
  });
}

/**
 * 记录用户操作
 * @param {number} userId 用户ID
 * @param {string} action 操作类型
 * @param {Object} details 操作详情
 * @param {string} ip IP地址
 */
function logUserAction(userId, action, details = {}, ip = '') {
  logger.info('用户操作', {
    userId,
    action,
    details,
    ip,
    timestamp: new Date().toISOString()
  });
}

/**
 * 记录安全事件
 * @param {string} event 事件类型
 * @param {Object} details 事件详情
 * @param {string} level 日志级别
 */
function logSecurity(event, details = {}, level = 'warn') {
  logger[level]('安全事件', {
    event,
    details,
    timestamp: new Date().toISOString()
  });
}

/**
 * 记录系统事件
 * @param {string} event 事件类型
 * @param {Object} details 事件详情
 * @param {string} level 日志级别
 */
function logSystem(event, details = {}, level = 'info') {
  logger[level]('系统事件', {
    event,
    details,
    timestamp: new Date().toISOString()
  });
}

/**
 * 记录设备操作
 * @param {number} deviceId 设备ID
 * @param {string} action 操作类型
 * @param {Object} details 操作详情
 * @param {number} operatorId 操作者ID
 */
function logDeviceAction(deviceId, action, details = {}, operatorId = null) {
  logger.info('设备操作', {
    deviceId,
    action,
    details,
    operatorId,
    timestamp: new Date().toISOString()
  });
}

/**
 * 记录文件操作
 * @param {string} operation 操作类型
 * @param {string} filePath 文件路径
 * @param {Object} details 操作详情
 * @param {number} userId 用户ID
 */
function logFileOperation(operation, filePath, details = {}, userId = null) {
  logger.info('文件操作', {
    operation,
    filePath,
    details,
    userId,
    timestamp: new Date().toISOString()
  });
}

/**
 * 记录支付事件
 * @param {string} event 事件类型
 * @param {Object} details 事件详情
 * @param {number} userId 用户ID
 */
function logPayment(event, details = {}, userId = null) {
  logger.info('支付事件', {
    event,
    details,
    userId,
    timestamp: new Date().toISOString()
  });
}

/**
 * 记录代理操作
 * @param {number} agentId 代理ID
 * @param {string} action 操作类型
 * @param {Object} details 操作详情
 */
function logAgentAction(agentId, action, details = {}) {
  logger.info('代理操作', {
    agentId,
    action,
    details,
    timestamp: new Date().toISOString()
  });
}

/**
 * 记录Socket.IO事件
 * @param {string} event 事件类型
 * @param {string} socketId Socket ID
 * @param {Object} data 事件数据
 * @param {number} userId 用户ID
 */
function logSocketEvent(event, socketId, data = {}, userId = null) {
  logger.debug('Socket事件', {
    event,
    socketId,
    data: config.debug.socket ? data : '[隐藏]',
    userId,
    timestamp: new Date().toISOString()
  });
}

/**
 * 记录性能指标
 * @param {string} metric 指标名称
 * @param {number} value 指标值
 * @param {Object} tags 标签
 */
function logMetric(metric, value, tags = {}) {
  logger.debug('性能指标', {
    metric,
    value,
    tags,
    timestamp: new Date().toISOString()
  });
}

/**
 * 创建子日志器
 * @param {string} module 模块名称
 * @returns {Object} 子日志器
 */
function createChildLogger(module) {
  return logger.child({ module });
}

// 导出日志器和辅助函数
module.exports = {
  ...logger,
  logRequest,
  logDatabase,
  logUserAction,
  logSecurity,
  logSystem,
  logDeviceAction,
  logFileOperation,
  logPayment,
  logAgentAction,
  logSocketEvent,
  logMetric,
  createChildLogger
};