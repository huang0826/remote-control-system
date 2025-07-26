/**
 * 代理管理路由
 */

const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const agentController = require('../controllers/agentController');

/**
 * 获取代理信息
 */
router.get('/info',
  authenticateToken,
  agentController.getAgentInfo
);

/**
 * 获取代理下级用户列表
 */
router.get('/users',
  authenticateToken,
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
  agentController.getAgentUsers
);

/**
 * 获取代理收益记录
 */
router.get('/earnings',
  authenticateToken,
  [
    query('start_date')
      .optional()
      .isISO8601()
      .withMessage('开始日期格式无效'),
    query('end_date')
      .optional()
      .isISO8601()
      .withMessage('结束日期格式无效'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须在1-100之间')
  ],
  agentController.getEarningsRecord
);

/**
 * 生成代理邀请二维码
 */
router.get('/qrcode',
  authenticateToken,
  agentController.generateInviteQRCode
);

/**
 * 申请提现
 */
router.post('/withdraw',
  authenticateToken,
  [
    body('amount')
      .isFloat({ min: 1 })
      .withMessage('提现金额必须大于1元'),
    body('withdraw_method')
      .isIn(['alipay', 'wechat', 'bank'])
      .withMessage('提现方式无效'),
    body('account_info')
      .isObject()
      .withMessage('账户信息必须是对象格式'),
    body('account_info.account')
      .notEmpty()
      .withMessage('账户号码不能为空'),
    body('account_info.name')
      .notEmpty()
      .withMessage('账户姓名不能为空')
  ],
  agentController.applyWithdraw
);

/**
 * 获取提现记录
 */
router.get('/withdrawals',
  authenticateToken,
  [
    query('status')
      .optional()
      .isIn(['pending', 'approved', 'rejected', 'completed'])
      .withMessage('提现状态无效'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须在1-100之间')
  ],
  agentController.getWithdrawRecord
);

/**
 * 验证代理码
 */
router.post('/verify',
  [
    body('agent_code')
      .isString()
      .isLength({ min: 4, max: 4 })
      .withMessage('代理码必须是4位字符')
  ],
  agentController.verifyAgentCode
);

/**
 * 获取代理统计信息
 */
router.get('/stats',
  authenticateToken,
  async (req, res) => {
    try {
      const { query } = require('../database/connection');
      const agentId = req.user.id;
      
      // 获取今日统计
      const todayStats = await query(`
        SELECT 
          COUNT(DISTINCT u.id) as today_new_users,
          COALESCE(SUM(o.amount), 0) as today_earnings
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id AND o.status = 'paid' AND DATE(o.created_time) = CURDATE()
        WHERE u.agent_id = ? AND DATE(u.created_time) = CURDATE()
      `, [agentId]);
      
      // 获取本月统计
      const monthStats = await query(`
        SELECT 
          COUNT(DISTINCT u.id) as month_new_users,
          COALESCE(SUM(o.amount), 0) as month_earnings
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id AND o.status = 'paid' AND YEAR(o.created_time) = YEAR(NOW()) AND MONTH(o.created_time) = MONTH(NOW())
        WHERE u.agent_id = ? AND YEAR(u.created_time) = YEAR(NOW()) AND MONTH(u.created_time) = MONTH(NOW())
      `, [agentId]);
      
      // 获取总统计
      const totalStats = await query(`
        SELECT 
          COUNT(DISTINCT u.id) as total_users,
          COALESCE(SUM(ae.amount), 0) as total_earnings,
          COALESCE(SUM(CASE WHEN ae.status = 'pending' THEN ae.amount ELSE 0 END), 0) as pending_earnings
        FROM users u
        LEFT JOIN agent_earnings ae ON u.agent_id = ae.agent_id
        WHERE u.agent_id = ?
      `, [agentId]);
      
      // 获取最近7天的数据
      const weeklyData = await query(`
        SELECT 
          DATE(u.created_time) as date,
          COUNT(u.id) as new_users,
          COALESCE(SUM(o.amount), 0) as earnings
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id AND o.status = 'paid' AND DATE(o.created_time) = DATE(u.created_time)
        WHERE u.agent_id = ? AND u.created_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(u.created_time)
        ORDER BY date DESC
      `, [agentId]);
      
      res.json({
        success: true,
        data: {
          today: todayStats[0] || { today_new_users: 0, today_earnings: 0 },
          month: monthStats[0] || { month_new_users: 0, month_earnings: 0 },
          total: totalStats[0] || { total_users: 0, total_earnings: 0, pending_earnings: 0 },
          weekly_data: weeklyData
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取代理统计失败'
      });
    }
  }
);

/**
 * 获取代理推广链接
 */
router.get('/invite-link',
  authenticateToken,
  async (req, res) => {
    try {
      const User = require('../models/User');
      const user = await User.findById(req.user.id);
      
      if (!user || !user.agent_code) {
        return res.status(400).json({
          success: false,
          message: '您还不是代理用户'
        });
      }
      
      const baseUrl = process.env.APP_URL || 'https://your-domain.com';
      const inviteLink = `${baseUrl}/register?agent_code=${user.agent_code}`;
      
      res.json({
        success: true,
        data: {
          invite_link: inviteLink,
          agent_code: user.agent_code,
          qr_code_url: `/api/agents/qrcode`
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取推广链接失败'
      });
    }
  }
);

/**
 * 更新代理信息
 */
router.put('/info',
  authenticateToken,
  [
    body('bank_account')
      .optional()
      .isString()
      .withMessage('银行账户必须是字符串'),
    body('alipay_account')
      .optional()
      .isString()
      .withMessage('支付宝账户必须是字符串'),
    body('wechat_account')
      .optional()
      .isString()
      .withMessage('微信账户必须是字符串'),
    body('real_name')
      .optional()
      .isString()
      .withMessage('真实姓名必须是字符串')
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
      
      const { bank_account, alipay_account, wechat_account, real_name } = req.body;
      const { update } = require('../database/connection');
      
      // 更新代理信息
      const updateData = {
        updated_time: new Date()
      };
      
      if (bank_account !== undefined) updateData.bank_account = bank_account;
      if (alipay_account !== undefined) updateData.alipay_account = alipay_account;
      if (wechat_account !== undefined) updateData.wechat_account = wechat_account;
      if (real_name !== undefined) updateData.real_name = real_name;
      
      await update('users', updateData, { id: req.user.id });
      
      res.json({
        success: true,
        message: '代理信息已更新'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '更新代理信息失败'
      });
    }
  }
);

/**
 * 获取代理佣金配置
 */
router.get('/commission-config',
  authenticateToken,
  async (req, res) => {
    try {
      const config = require('../config/config');
      
      res.json({
        success: true,
        data: {
          commission_rates: config.agent.commission_rates,
          min_withdraw_amount: config.agent.min_withdraw_amount,
          withdraw_fee_rate: config.agent.withdraw_fee_rate
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取佣金配置失败'
      });
    }
  }
);

/**
 * 获取代理排行榜
 */
router.get('/ranking',
  [
    query('type')
      .optional()
      .isIn(['users', 'earnings'])
      .withMessage('排行榜类型无效'),
    query('period')
      .optional()
      .isIn(['today', 'week', 'month', 'total'])
      .withMessage('统计周期无效'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('排行榜数量必须在1-100之间')
  ],
  async (req, res) => {
    try {
      const { type = 'earnings', period = 'month', limit = 20 } = req.query;
      const { query } = require('../database/connection');
      
      let dateCondition = '';
      switch (period) {
        case 'today':
          dateCondition = 'AND DATE(u.created_time) = CURDATE()';
          break;
        case 'week':
          dateCondition = 'AND u.created_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
          break;
        case 'month':
          dateCondition = 'AND YEAR(u.created_time) = YEAR(NOW()) AND MONTH(u.created_time) = MONTH(NOW())';
          break;
        default:
          dateCondition = '';
      }
      
      let orderBy = '';
      let selectField = '';
      
      if (type === 'users') {
        selectField = 'COUNT(DISTINCT u.id) as count';
        orderBy = 'count DESC';
      } else {
        selectField = 'COALESCE(SUM(ae.amount), 0) as earnings';
        orderBy = 'earnings DESC';
      }
      
      const ranking = await query(`
        SELECT 
          agent.id,
          agent.nickname,
          agent.phone,
          agent.agent_code,
          ${selectField}
        FROM users agent
        LEFT JOIN users u ON agent.id = u.agent_id ${dateCondition}
        LEFT JOIN agent_earnings ae ON agent.id = ae.agent_id
        WHERE agent.agent_code IS NOT NULL
        GROUP BY agent.id
        ORDER BY ${orderBy}
        LIMIT ?
      `, [parseInt(limit)]);
      
      res.json({
        success: true,
        data: {
          ranking: ranking.map((item, index) => ({
            rank: index + 1,
            ...item,
            phone: item.phone ? item.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null
          })),
          type,
          period
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取代理排行榜失败'
      });
    }
  }
);

/**
 * 申请成为代理
 */
router.post('/apply',
  authenticateToken,
  [
    body('real_name')
      .notEmpty()
      .withMessage('真实姓名不能为空'),
    body('id_card')
      .optional()
      .isString()
      .withMessage('身份证号必须是字符串'),
    body('contact_info')
      .isObject()
      .withMessage('联系信息必须是对象格式'),
    body('reason')
      .optional()
      .isString()
      .withMessage('申请理由必须是字符串')
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
      
      const { real_name, id_card, contact_info, reason } = req.body;
      const { queryOne, insert, update } = require('../database/connection');
      
      // 检查是否已经是代理
      const user = await queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
      if (user.agent_code) {
        return res.status(400).json({
          success: false,
          message: '您已经是代理用户'
        });
      }
      
      // 检查是否已有申请记录
      const existingApplication = await queryOne(
        'SELECT * FROM agent_applications WHERE user_id = ? AND status = "pending"',
        [req.user.id]
      );
      
      if (existingApplication) {
        return res.status(400).json({
          success: false,
          message: '您已有待审核的代理申请'
        });
      }
      
      // 创建申请记录
      await insert('agent_applications', {
        user_id: req.user.id,
        real_name,
        id_card,
        contact_info: JSON.stringify(contact_info),
        reason,
        status: 'pending',
        created_time: new Date()
      });
      
      res.json({
        success: true,
        message: '代理申请已提交，请等待审核'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '提交代理申请失败'
      });
    }
  }
);

/**
 * 获取代理申请状态
 */
router.get('/application-status',
  authenticateToken,
  async (req, res) => {
    try {
      const { queryOne } = require('../database/connection');
      
      const application = await queryOne(
        'SELECT * FROM agent_applications WHERE user_id = ? ORDER BY created_time DESC LIMIT 1',
        [req.user.id]
      );
      
      if (!application) {
        return res.json({
          success: true,
          data: {
            has_application: false,
            status: null
          }
        });
      }
      
      res.json({
        success: true,
        data: {
          has_application: true,
          status: application.status,
          created_time: application.created_time,
          reviewed_time: application.reviewed_time,
          review_note: application.review_note
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取申请状态失败'
      });
    }
  }
);

module.exports = router;