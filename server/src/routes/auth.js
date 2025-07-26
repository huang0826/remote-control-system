/**
 * 认证路由
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const { cache } = require('../database/redis');
const { validateAgentCode } = require('../controllers/agentController');

// 登录限流
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 最多5次尝试
  message: {
    success: false,
    message: '登录尝试次数过多，请15分钟后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 注册限流
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 3, // 最多3次注册
  message: {
    success: false,
    message: '注册次数过多，请1小时后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * 用户注册
 */
router.post('/register', 
  registerLimiter,
  [
    body('phone')
      .isMobilePhone('zh-CN')
      .withMessage('请输入有效的手机号'),
    body('password')
      .isLength({ min: 6, max: 20 })
      .withMessage('密码长度必须在6-20位之间')
      .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
      .withMessage('密码必须包含字母和数字'),
    body('nickname')
      .optional()
      .isLength({ min: 1, max: 20 })
      .withMessage('昵称长度必须在1-20位之间'),
    body('agent_code')
      .optional()
      .isLength({ min: 4, max: 4 })
      .withMessage('代理码必须是4位数字')
  ],
  async (req, res) => {
    try {
      // 验证输入
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '输入验证失败',
          errors: errors.array()
        });
      }

      const { phone, password, nickname, agent_code } = req.body;

      // 检查手机号是否已注册
      const existingUser = await User.findByPhone(phone);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: '该手机号已注册'
        });
      }

      // 验证代理码（如果提供）
      let agentId = null;
      if (agent_code) {
        const agent = await validateAgentCode({ body: { agent_code } }, { json: () => {} });
        // 这里需要重新实现验证逻辑
        const { query, queryOne } = require('../database/connection');
        const agentInfo = await queryOne(`
          SELECT id FROM agents 
          WHERE agent_code = ? AND status = 'active'
        `, [agent_code]);
        
        if (agentInfo) {
          agentId = agentInfo.id;
        }
      }

      // 创建用户
      const userData = {
        phone,
        password,
        nickname: nickname || `用户${phone.substr(-4)}`,
        agent_id: agentId
      };

      const user = await User.create(userData);

      // 生成JWT令牌
      const token = User.generateToken(user.id);

      // 记录登录日志
      logger.logUserAction(user.id, 'register', {
        ip: req.ip,
        user_agent: req.get('User-Agent'),
        agent_code
      });

      res.status(201).json({
        success: true,
        message: '注册成功',
        data: {
          user: {
            id: user.id,
            phone: user.phone,
            nickname: user.nickname,
            membership_type: user.membership_type,
            membership_expires: user.membership_expires,
            invite_code: user.invite_code
          },
          token
        }
      });
    } catch (error) {
      logger.error('用户注册失败:', error);
      res.status(500).json({
        success: false,
        message: '注册失败，请稍后重试'
      });
    }
  }
);

/**
 * 用户登录
 */
router.post('/login',
  loginLimiter,
  [
    body('phone')
      .isMobilePhone('zh-CN')
      .withMessage('请输入有效的手机号'),
    body('password')
      .notEmpty()
      .withMessage('密码不能为空')
  ],
  async (req, res) => {
    try {
      // 验证输入
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '输入验证失败',
          errors: errors.array()
        });
      }

      const { phone, password } = req.body;

      // 验证用户凭据
      const user = await User.login(phone, password);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: '手机号或密码错误'
        });
      }

      // 检查用户状态
      if (user.status === 'disabled') {
        return res.status(403).json({
          success: false,
          message: '账户已被禁用，请联系客服'
        });
      }

      // 生成JWT令牌
      const token = User.generateToken(user.id);

      // 更新最后登录时间
      const { update } = require('../database/connection');
      await update('users', {
        last_login_time: new Date(),
        last_login_ip: req.ip
      }, { id: user.id });

      // 清除用户缓存
      await cache.del(`user:${user.id}`);

      // 记录登录日志
      logger.logUserAction(user.id, 'login', {
        ip: req.ip,
        user_agent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: '登录成功',
        data: {
          user: {
            id: user.id,
            phone: user.phone,
            nickname: user.nickname,
            membership_type: user.membership_type,
            membership_expires: user.membership_expires,
            invite_code: user.invite_code,
            is_admin: user.is_admin
          },
          token
        }
      });
    } catch (error) {
      logger.error('用户登录失败:', error);
      res.status(500).json({
        success: false,
        message: '登录失败，请稍后重试'
      });
    }
  }
);

/**
 * 刷新令牌
 */
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 验证用户是否存在且状态正常
    const user = await User.findById(userId);
    if (!user || user.status === 'disabled') {
      return res.status(401).json({
        success: false,
        message: '用户不存在或已被禁用'
      });
    }

    // 生成新的JWT令牌
    const token = User.generateToken(userId);

    res.json({
      success: true,
      message: '令牌刷新成功',
      data: {
        token
      }
    });
  } catch (error) {
    logger.error('刷新令牌失败:', error);
    res.status(500).json({
      success: false,
      message: '刷新令牌失败'
    });
  }
});

/**
 * 用户登出
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const token = req.headers.authorization?.split(' ')[1];

    // 将令牌加入黑名单
    if (token) {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await cache.setex(`blacklist:${token}`, ttl, '1');
        }
      }
    }

    // 记录登出日志
    logger.logUserAction(userId, 'logout', {
      ip: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error) {
    logger.error('用户登出失败:', error);
    res.status(500).json({
      success: false,
      message: '登出失败'
    });
  }
});

/**
 * 验证令牌
 */
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      message: '令牌有效',
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          nickname: user.nickname,
          membership_type: user.membership_type,
          membership_expires: user.membership_expires,
          invite_code: user.invite_code,
          is_admin: user.is_admin
        }
      }
    });
  } catch (error) {
    logger.error('验证令牌失败:', error);
    res.status(500).json({
      success: false,
      message: '验证失败'
    });
  }
});

/**
 * 忘记密码 - 发送验证码
 */
router.post('/forgot-password',
  rateLimit({
    windowMs: 60 * 1000, // 1分钟
    max: 1, // 1分钟内最多1次
    message: {
      success: false,
      message: '发送验证码过于频繁，请稍后再试'
    }
  }),
  [
    body('phone')
      .isMobilePhone('zh-CN')
      .withMessage('请输入有效的手机号')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '输入验证失败',
          errors: errors.array()
        });
      }

      const { phone } = req.body;

      // 检查用户是否存在
      const user = await User.findByPhone(phone);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '该手机号未注册'
        });
      }

      // 生成6位数验证码
      const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // 存储验证码（5分钟有效）
      await cache.setex(`reset_code:${phone}`, 300, verifyCode);

      // 这里应该发送短信验证码
      // 暂时返回验证码（生产环境中应该删除）
      logger.logUserAction(user.id, 'forgot_password_request', {
        ip: req.ip,
        verify_code: verifyCode
      });

      res.json({
        success: true,
        message: '验证码已发送',
        // 生产环境中应该删除这行
        debug_code: verifyCode
      });
    } catch (error) {
      logger.error('发送重置密码验证码失败:', error);
      res.status(500).json({
        success: false,
        message: '发送验证码失败'
      });
    }
  }
);

/**
 * 重置密码
 */
router.post('/reset-password',
  [
    body('phone')
      .isMobilePhone('zh-CN')
      .withMessage('请输入有效的手机号'),
    body('verify_code')
      .isLength({ min: 6, max: 6 })
      .withMessage('验证码必须是6位数字'),
    body('new_password')
      .isLength({ min: 6, max: 20 })
      .withMessage('密码长度必须在6-20位之间')
      .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
      .withMessage('密码必须包含字母和数字')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '输入验证失败',
          errors: errors.array()
        });
      }

      const { phone, verify_code, new_password } = req.body;

      // 验证验证码
      const storedCode = await cache.get(`reset_code:${phone}`);
      if (!storedCode || storedCode !== verify_code) {
        return res.status(400).json({
          success: false,
          message: '验证码错误或已过期'
        });
      }

      // 检查用户是否存在
      const user = await User.findByPhone(phone);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      // 重置密码
      await User.resetPassword(user.id, new_password);

      // 删除验证码
      await cache.del(`reset_code:${phone}`);

      // 清除用户缓存
      await cache.del(`user:${user.id}`);
      await cache.del(`user:phone:${phone}`);

      logger.logUserAction(user.id, 'password_reset', {
        ip: req.ip
      });

      res.json({
        success: true,
        message: '密码重置成功'
      });
    } catch (error) {
      logger.error('重置密码失败:', error);
      res.status(500).json({
        success: false,
        message: '重置密码失败'
      });
    }
  }
);

module.exports = router;