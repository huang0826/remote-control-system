/**
 * 支付路由
 */

const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

/**
 * 获取支付配置
 */
router.get('/config',
  paymentController.getPaymentConfig
);

/**
 * 创建支付订单
 */
router.post('/create-order',
  authenticateToken,
  [
    body('membership_type')
      .isIn(['monthly', 'quarterly', 'semi_annual', 'annual', 'lifetime'])
      .withMessage('会员类型无效'),
    body('payment_method')
      .isIn(['alipay', 'wechat', 'third_party'])
      .withMessage('支付方式无效'),
    body('agent_code')
      .optional()
      .isString()
      .isLength({ min: 4, max: 4 })
      .withMessage('代理码必须是4位字符')
  ],
  paymentController.createPaymentOrder
);

/**
 * 查询订单状态
 */
router.get('/order-status/:orderId',
  authenticateToken,
  paymentController.queryOrderStatus
);

/**
 * 支付回调处理
 */
router.post('/callback',
  [
    body('order_id')
      .notEmpty()
      .withMessage('订单ID不能为空'),
    body('payment_status')
      .isIn(['success', 'failed', 'pending'])
      .withMessage('支付状态无效'),
    body('transaction_id')
      .optional()
      .isString()
      .withMessage('交易ID必须是字符串'),
    body('amount')
      .isFloat({ min: 0 })
      .withMessage('支付金额必须是正数'),
    body('signature')
      .notEmpty()
      .withMessage('签名不能为空')
  ],
  paymentController.handlePaymentCallback
);

/**
 * 手动确认支付
 */
router.post('/manual-confirm',
  authenticateToken,
  [
    body('order_id')
      .notEmpty()
      .withMessage('订单ID不能为空'),
    body('payment_proof')
      .optional()
      .isString()
      .withMessage('支付凭证必须是字符串'),
    body('note')
      .optional()
      .isString()
      .withMessage('备注必须是字符串')
  ],
  paymentController.manualConfirmPayment
);

/**
 * 获取用户订单列表
 */
router.get('/orders',
  authenticateToken,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('每页数量必须在1-50之间'),
    query('status')
      .optional()
      .isIn(['pending', 'paid', 'failed', 'cancelled', 'refunded'])
      .withMessage('订单状态无效')
  ],
  paymentController.getUserOrderList
);

/**
 * 取消订单
 */
router.post('/cancel-order',
  authenticateToken,
  [
    body('order_id')
      .notEmpty()
      .withMessage('订单ID不能为空')
  ],
  paymentController.cancelOrder
);

/**
 * 获取订单详情
 */
router.get('/orders/:orderId',
  authenticateToken,
  async (req, res) => {
    try {
      const { orderId } = req.params;
      const { queryOne } = require('../database/connection');
      
      // 获取订单信息
      const order = await queryOne(`
        SELECT 
          o.*,
          u.phone,
          u.nickname
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.order_id = ?
      `, [orderId]);
      
      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }
      
      // 检查权限
      if (order.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: '无权限查看此订单'
        });
      }
      
      res.json({
        success: true,
        data: {
          ...order,
          payment_info: order.payment_info ? JSON.parse(order.payment_info) : null
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取订单详情失败'
      });
    }
  }
);

/**
 * 重新支付订单
 */
router.post('/repay',
  authenticateToken,
  [
    body('order_id')
      .notEmpty()
      .withMessage('订单ID不能为空'),
    body('payment_method')
      .isIn(['alipay', 'wechat', 'third_party'])
      .withMessage('支付方式无效')
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
      
      const { order_id, payment_method } = req.body;
      const { queryOne, update } = require('../database/connection');
      
      // 获取订单信息
      const order = await queryOne('SELECT * FROM orders WHERE order_id = ?', [order_id]);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }
      
      // 检查权限
      if (order.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: '无权限操作此订单'
        });
      }
      
      // 检查订单状态
      if (order.status !== 'pending' && order.status !== 'failed') {
        return res.status(400).json({
          success: false,
          message: '订单状态不允许重新支付'
        });
      }
      
      // 生成新的支付信息
      const paymentInfo = await paymentController.generatePaymentInfo(
        order.amount,
        payment_method,
        order_id
      );
      
      // 更新订单支付方式
      await update('orders', {
        payment_method,
        payment_info: JSON.stringify(paymentInfo),
        updated_time: new Date()
      }, { order_id });
      
      res.json({
        success: true,
        message: '支付信息已更新',
        data: paymentInfo
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '重新支付失败'
      });
    }
  }
);

/**
 * 获取支付统计
 */
router.get('/stats',
  authenticateToken,
  [
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
      const { start_date, end_date } = req.query;
      const { query } = require('../database/connection');
      
      // 构建日期条件
      let dateCondition = '';
      const params = [req.user.id];
      
      if (start_date) {
        dateCondition += ' AND DATE(created_time) >= ?';
        params.push(start_date);
      }
      
      if (end_date) {
        dateCondition += ' AND DATE(created_time) <= ?';
        params.push(end_date);
      }
      
      // 获取支付统计
      const stats = await query(`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_orders,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_orders,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_amount,
          COALESCE(AVG(CASE WHEN status = 'paid' THEN amount ELSE NULL END), 0) as avg_amount
        FROM orders 
        WHERE user_id = ? ${dateCondition}
      `, params);
      
      // 获取按会员类型统计
      const membershipStats = await query(`
        SELECT 
          membership_type,
          COUNT(*) as count,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as amount
        FROM orders 
        WHERE user_id = ? ${dateCondition}
        GROUP BY membership_type
      `, params);
      
      // 获取按支付方式统计
      const paymentMethodStats = await query(`
        SELECT 
          payment_method,
          COUNT(*) as count,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as amount
        FROM orders 
        WHERE user_id = ? AND status = 'paid' ${dateCondition}
        GROUP BY payment_method
      `, params);
      
      res.json({
        success: true,
        data: {
          overview: stats[0],
          membership_stats: membershipStats,
          payment_method_stats: paymentMethodStats
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取支付统计失败'
      });
    }
  }
);

/**
 * 验证支付签名
 */
router.post('/verify-signature',
  [
    body('data')
      .isObject()
      .withMessage('数据必须是对象格式'),
    body('signature')
      .notEmpty()
      .withMessage('签名不能为空')
  ],
  async (req, res) => {
    try {
      const { data, signature } = req.body;
      const isValid = await paymentController.verifyPaymentSignature(data, signature);
      
      res.json({
        success: true,
        data: {
          is_valid: isValid
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '验证签名失败'
      });
    }
  }
);

/**
 * 获取支付二维码
 */
router.get('/qrcode/:orderId',
  authenticateToken,
  async (req, res) => {
    try {
      const { orderId } = req.params;
      const { queryOne } = require('../database/connection');
      
      // 获取订单信息
      const order = await queryOne('SELECT * FROM orders WHERE order_id = ?', [orderId]);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }
      
      // 检查权限
      if (order.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: '无权限访问此订单'
        });
      }
      
      // 检查订单状态
      if (order.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: '订单状态不允许支付'
        });
      }
      
      const paymentInfo = order.payment_info ? JSON.parse(order.payment_info) : null;
      if (!paymentInfo || !paymentInfo.qr_code) {
        return res.status(400).json({
          success: false,
          message: '订单支付信息不完整'
        });
      }
      
      res.json({
        success: true,
        data: {
          qr_code: paymentInfo.qr_code,
          amount: order.amount,
          expire_time: paymentInfo.expire_time
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取支付二维码失败'
      });
    }
  }
);

/**
 * 申请退款
 */
router.post('/refund',
  authenticateToken,
  [
    body('order_id')
      .notEmpty()
      .withMessage('订单ID不能为空'),
    body('reason')
      .notEmpty()
      .withMessage('退款原因不能为空'),
    body('amount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('退款金额必须是正数')
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
      
      const { order_id, reason, amount } = req.body;
      const { queryOne, insert, update } = require('../database/connection');
      
      // 获取订单信息
      const order = await queryOne('SELECT * FROM orders WHERE order_id = ?', [order_id]);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }
      
      // 检查权限
      if (order.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: '无权限操作此订单'
        });
      }
      
      // 检查订单状态
      if (order.status !== 'paid') {
        return res.status(400).json({
          success: false,
          message: '只能对已支付订单申请退款'
        });
      }
      
      // 检查是否已申请退款
      const existingRefund = await queryOne(
        'SELECT * FROM refunds WHERE order_id = ? AND status IN ("pending", "approved")',
        [order_id]
      );
      
      if (existingRefund) {
        return res.status(400).json({
          success: false,
          message: '该订单已有退款申请'
        });
      }
      
      const refundAmount = amount || order.amount;
      
      // 创建退款申请
      await insert('refunds', {
        order_id,
        user_id: req.user.id,
        amount: refundAmount,
        reason,
        status: 'pending',
        created_time: new Date()
      });
      
      res.json({
        success: true,
        message: '退款申请已提交'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '申请退款失败'
      });
    }
  }
);

/**
 * 获取退款记录
 */
router.get('/refunds',
  authenticateToken,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('每页数量必须在1-50之间'),
    query('status')
      .optional()
      .isIn(['pending', 'approved', 'rejected', 'completed'])
      .withMessage('退款状态无效')
  ],
  async (req, res) => {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const { query, queryOne } = require('../database/connection');
      
      // 构建查询条件
      let whereClause = 'WHERE r.user_id = ?';
      const params = [req.user.id];
      
      if (status) {
        whereClause += ' AND r.status = ?';
        params.push(status);
      }
      
      // 获取总数
      const countResult = await queryOne(`
        SELECT COUNT(*) as total 
        FROM refunds r
        ${whereClause}
      `, params);
      const total = countResult.total;
      
      // 获取分页数据
      const offset = (page - 1) * limit;
      const refunds = await query(`
        SELECT 
          r.*,
          o.membership_type,
          o.payment_method
        FROM refunds r
        LEFT JOIN orders o ON r.order_id = o.order_id
        ${whereClause}
        ORDER BY r.created_time DESC
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), offset]);
      
      res.json({
        success: true,
        data: {
          refunds,
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
        message: '获取退款记录失败'
      });
    }
  }
);

module.exports = router;