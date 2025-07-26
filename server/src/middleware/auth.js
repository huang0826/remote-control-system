/**
 * 认证中间件
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const logger = require('../utils/logger');
const { cache } = require('../database/redis');

/**
 * JWT认证中间件
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '访问令牌缺失'
      });
    }

    // 验证JWT令牌
    const decoded = User.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: '访问令牌无效'
      });
    }

    // 获取用户信息
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查用户状态
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: '用户已被禁用'
      });
    }

    // 将用户信息添加到请求对象
    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    logger.error('JWT认证失败:', error);
    return res.status(401).json({
      success: false,
      message: '认证失败'
    });
  }
};

/**
 * 可选认证中间件（不强制要求登录）
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = User.verifyToken(token);
      if (decoded) {
        const user = await User.findById(decoded.id);
        if (user && user.status === 'active') {
          req.user = user;
          req.token = token;
        }
      }
    }

    next();
  } catch (error) {
    logger.error('可选认证失败:', error);
    next();
  }
};

/**
 * 管理员认证中间件
 */
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '需要登录'
      });
    }

    // 检查是否为管理员（这里可以根据实际需求调整判断逻辑）
    if (req.user.role !== 'admin' && req.user.id !== 1) {
      return res.status(403).json({
        success: false,
        message: '需要管理员权限'
      });
    }

    next();
  } catch (error) {
    logger.error('管理员认证失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

/**
 * 代理认证中间件
 */
const requireAgent = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '需要登录'
      });
    }

    // 检查是否为代理
    const agentSql = 'SELECT * FROM agents WHERE user_id = ? AND status = "active" AND deleted_time IS NULL';
    const agent = await queryOne(agentSql, [req.user.id]);
    
    if (!agent) {
      return res.status(403).json({
        success: false,
        message: '需要代理权限'
      });
    }

    req.agent = agent;
    next();
  } catch (error) {
    logger.error('代理认证失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

/**
 * 会员权限检查中间件
 */
const checkMembership = (requiredMembership = 'free') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: '需要登录'
        });
      }

      // 检查会员等级
      const membershipLevels = {
        'free': 0,
        'monthly': 1,
        'quarterly': 2,
        'semi_annual': 3,
        'annual': 4,
        'permanent': 5
      };

      const userLevel = membershipLevels[req.user.membership_type] || 0;
      const requiredLevel = membershipLevels[requiredMembership] || 0;

      if (userLevel < requiredLevel) {
        return res.status(403).json({
          success: false,
          message: '需要更高级别的会员权限',
          required_membership: requiredMembership,
          current_membership: req.user.membership_type
        });
      }

      // 检查会员是否过期
      if (!User.isMembershipValid(req.user)) {
        return res.status(403).json({
          success: false,
          message: '会员已过期',
          membership_expired: true
        });
      }

      next();
    } catch (error) {
      logger.error('会员权限检查失败:', error);
      return res.status(500).json({
        success: false,
        message: '服务器错误'
      });
    }
  };
};

/**
 * 功能使用次数限制中间件
 */
const checkUsageLimit = (feature, limit = null) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: '需要登录'
        });
      }

      // 如果是付费会员，跳过限制检查
      if (req.user.membership_type !== 'free' && User.isMembershipValid(req.user)) {
        return next();
      }

      // 获取功能配置
      const featureConfig = config.features[feature];
      if (!featureConfig) {
        return next();
      }

      const dailyLimit = limit || featureConfig.free_daily_limit || 0;
      if (dailyLimit <= 0) {
        return next();
      }

      // 检查今日使用次数
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `usage:${req.user.id}:${feature}:${today}`;
      
      let usageCount = await cache.get(cacheKey) || 0;
      
      if (usageCount >= dailyLimit) {
        return res.status(403).json({
          success: false,
          message: `今日${featureConfig.name || feature}使用次数已达上限`,
          daily_limit: dailyLimit,
          used_count: usageCount,
          feature: feature
        });
      }

      // 增加使用次数
      await cache.incr(cacheKey);
      await cache.expire(cacheKey, 86400); // 24小时过期

      req.usageCount = usageCount + 1;
      next();
    } catch (error) {
      logger.error('功能使用次数检查失败:', error);
      return res.status(500).json({
        success: false,
        message: '服务器错误'
      });
    }
  };
};

/**
 * 设备权限检查中间件
 */
const checkDevicePermission = (permission) => {
  return async (req, res, next) => {
    try {
      const deviceId = req.params.deviceId || req.body.device_id;
      if (!deviceId) {
        return res.status(400).json({
          success: false,
          message: '设备ID缺失'
        });
      }

      // 获取设备信息
      const Device = require('../models/Device');
      const device = await Device.findById(deviceId);
      
      if (!device) {
        return res.status(404).json({
          success: false,
          message: '设备不存在'
        });
      }

      // 检查设备控制权限
      const controlSql = `
        SELECT * FROM device_controls 
        WHERE controller_id = ? AND controlled_device_id = ? 
        AND status = 'active' AND deleted_time IS NULL
      `;
      const control = await queryOne(controlSql, [req.user.id, deviceId]);
      
      if (!control && device.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: '没有设备控制权限'
        });
      }

      // 检查具体权限
      if (permission && device.permissions && !device.permissions[permission]) {
        return res.status(403).json({
          success: false,
          message: `设备未授权${permission}权限`
        });
      }

      req.device = device;
      req.deviceControl = control;
      next();
    } catch (error) {
      logger.error('设备权限检查失败:', error);
      return res.status(500).json({
        success: false,
        message: '服务器错误'
      });
    }
  };
};

/**
 * IP白名单检查中间件
 */
const checkIPWhitelist = (req, res, next) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress;
    const whitelist = config.security.ip_whitelist || [];
    
    if (whitelist.length > 0 && !whitelist.includes(clientIP)) {
      logger.logSecurity('ip_blocked', { ip: clientIP }, 'warn');
      return res.status(403).json({
        success: false,
        message: 'IP地址不在白名单中'
      });
    }
    
    next();
  } catch (error) {
    logger.error('IP白名单检查失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

/**
 * API密钥认证中间件
 */
const authenticateAPIKey = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API密钥缺失'
      });
    }
    
    if (apiKey !== config.security.api_key) {
      logger.logSecurity('invalid_api_key', { api_key: apiKey, ip: req.ip }, 'warn');
      return res.status(401).json({
        success: false,
        message: 'API密钥无效'
      });
    }
    
    next();
  } catch (error) {
    logger.error('API密钥认证失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

/**
 * 请求频率限制中间件
 */
const rateLimit = (maxRequests = 100, windowMs = 60000) => {
  return async (req, res, next) => {
    try {
      const key = `rate_limit:${req.ip}:${Math.floor(Date.now() / windowMs)}`;
      
      const currentRequests = await cache.incr(key);
      await cache.expire(key, Math.ceil(windowMs / 1000));
      
      if (currentRequests > maxRequests) {
        logger.logSecurity('rate_limit_exceeded', {
          ip: req.ip,
          requests: currentRequests,
          limit: maxRequests
        }, 'warn');
        
        return res.status(429).json({
          success: false,
          message: '请求过于频繁，请稍后再试'
        });
      }
      
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - currentRequests));
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs));
      
      next();
    } catch (error) {
      logger.error('请求频率限制失败:', error);
      next();
    }
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  requireAgent,
  checkMembership,
  checkUsageLimit,
  checkDevicePermission,
  checkIPWhitelist,
  authenticateAPIKey,
  rateLimit
};