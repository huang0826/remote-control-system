/**
 * 用户路由
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken, checkMembership } = require('../middleware/auth');
const userController = require('../controllers/userController');

/**
 * 获取当前用户信息
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { queryOne } = require('../database/connection');
    
    const user = await queryOne(`
      SELECT id, username, nickname, avatar, email, phone, role, status, created_time
      FROM users
      WHERE id = ?
    `, [req.user.id]);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
});

/**
 * 更新用户信息
 */
router.put('/profile', 
  authenticateToken,
  [
    body('nickname')
      .optional()
      .isLength({ min: 1, max: 20 })
      .withMessage('昵称长度必须在1-20位之间'),
    body('avatar')
      .optional()
      .isURL()
      .withMessage('头像必须是有效的URL')
  ],
  userController.updateProfile
);

/**
 * 修改密码
 */
router.put('/password',
  authenticateToken,
  [
    body('old_password')
      .notEmpty()
      .withMessage('原密码不能为空'),
    body('new_password')
      .isLength({ min: 6, max: 20 })
      .withMessage('新密码长度必须在6-20位之间')
      .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
      .withMessage('新密码必须包含字母和数字')
  ],
  userController.changePassword
);

/**
 * 获取用户设备列表
 */
router.get('/devices', authenticateToken, userController.getUserDevices);

/**
 * 搜索其他用户
 */
router.post('/search',
  authenticateToken,
  [
    body('keyword')
      .notEmpty()
      .withMessage('搜索关键词不能为空')
      .isLength({ min: 1, max: 20 })
      .withMessage('搜索关键词长度必须在1-20位之间')
  ],
  userController.searchUsers
);

/**
 * 获取功能使用统计
 */
router.get('/usage-stats', authenticateToken, userController.getUsageStats);

/**
 * 删除账户
 */
router.delete('/account',
  authenticateToken,
  [
    body('password')
      .notEmpty()
      .withMessage('密码不能为空'),
    body('confirm')
      .equals('DELETE')
      .withMessage('请输入DELETE确认删除')
  ],
  userController.deleteAccount
);

/**
 * 获取用户邀请信息
 */
router.get('/invite-info', authenticateToken, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: {
        invite_code: user.invite_code,
        invite_link: `${req.protocol}://${req.get('host')}/register?invite=${user.invite_code}`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取邀请信息失败'
    });
  }
});

/**
 * 获取用户通知列表
 */
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const { query, queryOne } = require('../database/connection');
    
    // 构建查询条件
    let whereClause = 'WHERE (target_users = "all" OR JSON_CONTAINS(target_users, ?)) AND created_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    const params = [JSON.stringify([req.user.id])];
    
    if (type) {
      whereClause += ' AND type = ?';
      params.push(type);
    }
    
    // 获取总数
    const countResult = await queryOne(`
      SELECT COUNT(*) as total 
      FROM system_notifications 
      ${whereClause}
    `, params);
    const total = countResult.total;
    
    // 获取分页数据
    const offset = (page - 1) * limit;
    const notifications = await query(`
      SELECT id, title, content, type, created_time
      FROM system_notifications
      ${whereClause}
      ORDER BY created_time DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
    
    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取通知列表失败'
    });
  }
});

/**
 * 标记通知为已读
 */
router.put('/notifications/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { insert } = require('../database/connection');
    
    // 记录已读状态
    await insert('user_notification_reads', {
      user_id: req.user.id,
      notification_id: notificationId,
      read_time: new Date()
    });
    
    res.json({
      success: true,
      message: '标记已读成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '标记已读失败'
    });
  }
});

/**
 * 获取用户设置
 */
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const { queryOne } = require('../database/connection');
    
    const settings = await queryOne(`
      SELECT settings FROM user_settings WHERE user_id = ?
    `, [req.user.id]);
    
    const defaultSettings = {
      notifications: {
        push_enabled: true,
        email_enabled: false,
        sms_enabled: false
      },
      privacy: {
        allow_search: true,
        show_online_status: true
      },
      security: {
        two_factor_enabled: false,
        login_alerts: true
      }
    };
    
    const userSettings = settings ? JSON.parse(settings.settings) : defaultSettings;
    
    res.json({
      success: true,
      data: userSettings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取用户设置失败'
    });
  }
});

/**
 * 更新用户设置
 */
router.put('/settings', 
  authenticateToken,
  [
    body('settings')
      .isObject()
      .withMessage('设置必须是对象格式')
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
      
      const { settings } = req.body;
      const { query, insert } = require('../database/connection');
      
      // 更新或插入用户设置
      await query(`
        INSERT INTO user_settings (user_id, settings, updated_time)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
        settings = VALUES(settings),
        updated_time = VALUES(updated_time)
      `, [req.user.id, JSON.stringify(settings)]);
      
      res.json({
        success: true,
        message: '设置更新成功'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '更新设置失败'
      });
    }
  }
);

/**
 * 获取用户活动日志
 */
router.get('/activity-logs', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, action_type } = req.query;
    const { query, queryOne } = require('../database/connection');
    
    // 构建查询条件
    let whereClause = 'WHERE user_id = ?';
    const params = [req.user.id];
    
    if (action_type) {
      whereClause += ' AND action_type = ?';
      params.push(action_type);
    }
    
    // 获取总数
    const countResult = await queryOne(`
      SELECT COUNT(*) as total 
      FROM user_activity_logs 
      ${whereClause}
    `, params);
    const total = countResult.total;
    
    // 获取分页数据
    const offset = (page - 1) * limit;
    const logs = await query(`
      SELECT action_type, action_data, ip_address, user_agent, created_time
      FROM user_activity_logs
      ${whereClause}
      ORDER BY created_time DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
    
    res.json({
      success: true,
      data: {
        logs: logs.map(log => ({
          ...log,
          action_data: log.action_data ? JSON.parse(log.action_data) : null
        })),
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取活动日志失败'
    });
  }
});

/**
 * 绑定设备到用户
 */
router.post('/bind-device',
  authenticateToken,
  [
    body('device_id')
      .notEmpty()
      .withMessage('设备ID不能为空'),
    body('device_name')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('设备名称长度必须在1-50位之间')
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
      
      const { device_id, device_name } = req.body;
      const Device = require('../models/Device');
      
      // 检查设备是否已存在
      const existingDevice = await Device.findByDeviceId(device_id);
      if (existingDevice) {
        return res.status(400).json({
          success: false,
          message: '设备已被绑定'
        });
      }
      
      // 注册设备
      const deviceData = {
        device_id,
        user_id: req.user.id,
        device_name: device_name || `设备${device_id.substr(-4)}`,
        device_type: 'mobile',
        status: 'offline'
      };
      
      const device = await Device.register(deviceData);
      
      res.json({
        success: true,
        message: '设备绑定成功',
        data: device
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '绑定设备失败'
      });
    }
  }
);

module.exports = router;