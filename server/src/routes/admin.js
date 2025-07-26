/**
 * 管理员路由
 */

const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// 所有管理员路由都需要管理员权限
router.use(authenticateToken, requireAdmin);

/**
 * 获取系统统计信息
 */
router.get('/stats',
  adminController.getSystemStats
);

/**
 * 获取用户列表
 */
router.get('/users',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须在1-100之间'),
    query('keyword')
      .optional()
      .isString()
      .withMessage('搜索关键词必须是字符串'),
    query('status')
      .optional()
      .isIn(['active', 'banned', 'deleted'])
      .withMessage('用户状态无效'),
    query('membership_type')
      .optional()
      .isIn(['free', 'monthly', 'quarterly', 'semi_annual', 'annual', 'lifetime'])
      .withMessage('会员类型无效')
  ],
  adminController.getUserList
);

/**
 * 获取用户详情
 */
router.get('/users/:userId',
  adminController.getUserDetails
);

/**
 * 更新用户信息
 */
router.put('/users/:userId',
  [
    body('nickname')
      .optional()
      .isString()
      .withMessage('昵称必须是字符串'),
    body('status')
      .optional()
      .isIn(['active', 'banned', 'deleted'])
      .withMessage('用户状态无效'),
    body('membership_type')
      .optional()
      .isIn(['free', 'monthly', 'quarterly', 'semi_annual', 'annual', 'lifetime'])
      .withMessage('会员类型无效'),
    body('membership_expire_time')
      .optional()
      .isISO8601()
      .withMessage('会员过期时间格式无效')
  ],
  adminController.updateUser
);

/**
 * 删除用户
 */
router.delete('/users/:userId',
  adminController.deleteUser
);

/**
 * 获取设备列表
 */
router.get('/devices',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须在1-100之间'),
    query('keyword')
      .optional()
      .isString()
      .withMessage('搜索关键词必须是字符串'),
    query('status')
      .optional()
      .isIn(['online', 'offline', 'locked', 'deleted'])
      .withMessage('设备状态无效')
  ],
  adminController.getDeviceList
);

/**
 * 远程控制设备
 */
router.post('/devices/:deviceId/control',
  [
    body('action')
      .isIn(['screenshot', 'location', 'lock', 'unlock', 'wipe', 'restart'])
      .withMessage('控制动作无效'),
    body('params')
      .optional()
      .isObject()
      .withMessage('控制参数必须是对象格式')
  ],
  adminController.controlDevice
);

/**
 * 获取订单列表
 */
router.get('/orders',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须在1-100之间'),
    query('status')
      .optional()
      .isIn(['pending', 'paid', 'failed', 'cancelled', 'refunded'])
      .withMessage('订单状态无效'),
    query('start_date')
      .optional()
      .isISO8601()
      .withMessage('开始日期格式无效'),
    query('end_date')
      .optional()
      .isISO8601()
      .withMessage('结束日期格式无效')
  ],
  adminController.getOrderList
);

/**
 * 手动确认订单支付
 */
router.post('/orders/:orderId/confirm',
  async (req, res) => {
    try {
      const { orderId } = req.params;
      const { queryOne, update } = require('../database/connection');
      const membershipController = require('../controllers/membershipController');
      
      // 获取订单信息
      const order = await queryOne('SELECT * FROM orders WHERE order_id = ?', [orderId]);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }
      
      if (order.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: '订单状态不允许确认支付'
        });
      }
      
      // 更新订单状态
      await update('orders', {
        status: 'paid',
        paid_time: new Date(),
        updated_time: new Date()
      }, { order_id: orderId });
      
      // 激活会员
      await membershipController.activateMembership(
        order.user_id,
        order.membership_type
      );
      
      // 计算代理佣金
      await membershipController.calculateAgentCommission(order.user_id, order.amount);
      
      res.json({
        success: true,
        message: '订单支付已确认'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '确认订单支付失败'
      });
    }
  }
);

/**
 * 获取代理列表
 */
router.get('/agents',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须在1-100之间'),
    query('keyword')
      .optional()
      .isString()
      .withMessage('搜索关键词必须是字符串')
  ],
  adminController.getAgentList
);

/**
 * 创建代理
 */
router.post('/agents',
  [
    body('user_id')
      .isInt({ min: 1 })
      .withMessage('用户ID必须是正整数'),
    body('commission_rate')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('佣金比例必须在0-1之间')
  ],
  adminController.createAgent
);

/**
 * 更新代理信息
 */
router.put('/agents/:agentId',
  [
    body('commission_rate')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('佣金比例必须在0-1之间'),
    body('status')
      .optional()
      .isIn(['active', 'suspended'])
      .withMessage('代理状态无效')
  ],
  adminController.updateAgent
);

/**
 * 获取代理申请列表
 */
router.get('/agent-applications',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须在1-100之间'),
    query('status')
      .optional()
      .isIn(['pending', 'approved', 'rejected'])
      .withMessage('申请状态无效')
  ],
  async (req, res) => {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const { query, queryOne } = require('../database/connection');
      
      // 构建查询条件
      let whereClause = 'WHERE 1=1';
      const params = [];
      
      if (status) {
        whereClause += ' AND aa.status = ?';
        params.push(status);
      }
      
      // 获取总数
      const countResult = await queryOne(`
        SELECT COUNT(*) as total 
        FROM agent_applications aa
        ${whereClause}
      `, params);
      const total = countResult.total;
      
      // 获取分页数据
      const offset = (page - 1) * limit;
      const applications = await query(`
        SELECT 
          aa.*,
          u.phone,
          u.nickname
        FROM agent_applications aa
        LEFT JOIN users u ON aa.user_id = u.id
        ${whereClause}
        ORDER BY aa.created_time DESC
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), offset]);
      
      res.json({
        success: true,
        data: {
          applications: applications.map(app => ({
            ...app,
            contact_info: app.contact_info ? JSON.parse(app.contact_info) : null
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
        message: '获取代理申请列表失败'
      });
    }
  }
);

/**
 * 审核代理申请
 */
router.post('/agent-applications/:applicationId/review',
  [
    body('action')
      .isIn(['approve', 'reject'])
      .withMessage('审核动作无效'),
    body('note')
      .optional()
      .isString()
      .withMessage('审核备注必须是字符串'),
    body('commission_rate')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('佣金比例必须在0-1之间')
  ],
  async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { action, note, commission_rate = 0.1 } = req.body;
      const { queryOne, update } = require('../database/connection');
      const agentController = require('../controllers/agentController');
      
      // 获取申请信息
      const application = await queryOne(
        'SELECT * FROM agent_applications WHERE id = ?',
        [applicationId]
      );
      
      if (!application) {
        return res.status(404).json({
          success: false,
          message: '申请记录不存在'
        });
      }
      
      if (application.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: '申请已被审核'
        });
      }
      
      // 更新申请状态
      await update('agent_applications', {
        status: action === 'approve' ? 'approved' : 'rejected',
        review_note: note,
        reviewed_time: new Date(),
        reviewed_by: req.user.id
      }, { id: applicationId });
      
      // 如果批准，生成代理码
      if (action === 'approve') {
        const agentCode = await agentController.generateUniqueAgentCode();
        await update('users', {
          agent_code: agentCode,
          commission_rate,
          updated_time: new Date()
        }, { id: application.user_id });
      }
      
      res.json({
        success: true,
        message: action === 'approve' ? '代理申请已批准' : '代理申请已拒绝'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '审核代理申请失败'
      });
    }
  }
);

/**
 * 获取提现申请列表
 */
router.get('/withdrawals',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须在1-100之间'),
    query('status')
      .optional()
      .isIn(['pending', 'approved', 'rejected', 'completed'])
      .withMessage('提现状态无效')
  ],
  async (req, res) => {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const { query, queryOne } = require('../database/connection');
      
      // 构建查询条件
      let whereClause = 'WHERE 1=1';
      const params = [];
      
      if (status) {
        whereClause += ' AND w.status = ?';
        params.push(status);
      }
      
      // 获取总数
      const countResult = await queryOne(`
        SELECT COUNT(*) as total 
        FROM withdrawals w
        ${whereClause}
      `, params);
      const total = countResult.total;
      
      // 获取分页数据
      const offset = (page - 1) * limit;
      const withdrawals = await query(`
        SELECT 
          w.*,
          u.phone,
          u.nickname,
          u.agent_code
        FROM withdrawals w
        LEFT JOIN users u ON w.user_id = u.id
        ${whereClause}
        ORDER BY w.created_time DESC
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), offset]);
      
      res.json({
        success: true,
        data: {
          withdrawals: withdrawals.map(w => ({
            ...w,
            account_info: w.account_info ? JSON.parse(w.account_info) : null
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
        message: '获取提现申请列表失败'
      });
    }
  }
);

/**
 * 审核提现申请
 */
router.post('/withdrawals/:withdrawalId/review',
  [
    body('action')
      .isIn(['approve', 'reject', 'complete'])
      .withMessage('审核动作无效'),
    body('note')
      .optional()
      .isString()
      .withMessage('审核备注必须是字符串')
  ],
  async (req, res) => {
    try {
      const { withdrawalId } = req.params;
      const { action, note } = req.body;
      const { queryOne, update } = require('../database/connection');
      
      // 获取提现申请
      const withdrawal = await queryOne(
        'SELECT * FROM withdrawals WHERE id = ?',
        [withdrawalId]
      );
      
      if (!withdrawal) {
        return res.status(404).json({
          success: false,
          message: '提现申请不存在'
        });
      }
      
      let newStatus;
      switch (action) {
        case 'approve':
          if (withdrawal.status !== 'pending') {
            return res.status(400).json({
              success: false,
              message: '只能审核待处理的申请'
            });
          }
          newStatus = 'approved';
          break;
        case 'reject':
          if (withdrawal.status !== 'pending') {
            return res.status(400).json({
              success: false,
              message: '只能审核待处理的申请'
            });
          }
          newStatus = 'rejected';
          break;
        case 'complete':
          if (withdrawal.status !== 'approved') {
            return res.status(400).json({
              success: false,
              message: '只能完成已批准的申请'
            });
          }
          newStatus = 'completed';
          break;
      }
      
      // 更新提现状态
      await update('withdrawals', {
        status: newStatus,
        review_note: note,
        reviewed_time: new Date(),
        reviewed_by: req.user.id
      }, { id: withdrawalId });
      
      res.json({
        success: true,
        message: `提现申请已${action === 'approve' ? '批准' : action === 'reject' ? '拒绝' : '完成'}`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '审核提现申请失败'
      });
    }
  }
);

/**
 * 获取系统配置
 */
router.get('/config',
  adminController.getSystemConfig
);

/**
 * 更新系统配置
 */
router.put('/config',
  [
    body('membership_prices')
      .optional()
      .isObject()
      .withMessage('会员价格配置必须是对象格式'),
    body('agent_commission_rates')
      .optional()
      .isObject()
      .withMessage('代理佣金配置必须是对象格式'),
    body('payment_methods')
      .optional()
      .isArray()
      .withMessage('支付方式配置必须是数组格式'),
    body('feature_limits')
      .optional()
      .isObject()
      .withMessage('功能限制配置必须是对象格式')
  ],
  adminController.updateSystemConfig
);

/**
 * 发送系统通知
 */
router.post('/notifications',
  [
    body('title')
      .notEmpty()
      .withMessage('通知标题不能为空'),
    body('content')
      .notEmpty()
      .withMessage('通知内容不能为空'),
    body('type')
      .isIn(['system', 'promotion', 'maintenance', 'warning'])
      .withMessage('通知类型无效'),
    body('target_users')
      .optional()
      .isArray()
      .withMessage('目标用户必须是数组格式'),
    body('target_type')
      .isIn(['all', 'specific', 'membership', 'agent'])
      .withMessage('目标类型无效')
  ],
  adminController.sendSystemNotification
);

/**
 * 获取系统日志
 */
router.get('/logs',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须在1-100之间'),
    query('level')
      .optional()
      .isIn(['error', 'warn', 'info', 'debug'])
      .withMessage('日志级别无效'),
    query('start_date')
      .optional()
      .isISO8601()
      .withMessage('开始日期格式无效'),
    query('end_date')
      .optional()
      .isISO8601()
      .withMessage('结束日期格式无效')
  ],
  async (req, res) => {
    try {
      const { page = 1, limit = 50, level, start_date, end_date } = req.query;
      const { query, queryOne } = require('../database/connection');
      
      // 构建查询条件
      let whereClause = 'WHERE 1=1';
      const params = [];
      
      if (level) {
        whereClause += ' AND level = ?';
        params.push(level);
      }
      
      if (start_date) {
        whereClause += ' AND DATE(created_time) >= ?';
        params.push(start_date);
      }
      
      if (end_date) {
        whereClause += ' AND DATE(created_time) <= ?';
        params.push(end_date);
      }
      
      // 获取总数
      const countResult = await queryOne(`
        SELECT COUNT(*) as total 
        FROM system_logs 
        ${whereClause}
      `, params);
      const total = countResult.total;
      
      // 获取分页数据
      const offset = (page - 1) * limit;
      const logs = await query(`
        SELECT *
        FROM system_logs
        ${whereClause}
        ORDER BY created_time DESC
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), offset]);
      
      res.json({
        success: true,
        data: {
          logs: logs.map(log => ({
            ...log,
            metadata: log.metadata ? JSON.parse(log.metadata) : null
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
        message: '获取系统日志失败'
      });
    }
  }
);

module.exports = router;