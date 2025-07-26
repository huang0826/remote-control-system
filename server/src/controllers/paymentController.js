/**
 * 支付控制器
 */

const User = require('../models/User');
const { query, queryOne, insert, update, remove } = require('../database/connection');
const { cache } = require('../database/redis');
const logger = require('../utils/logger');
const config = require('../config');
const crypto = require('crypto');

/**
 * 获取支付配置
 */
const getPaymentConfig = async (req, res) => {
  try {
    // 获取会员价格配置
    const membershipPrices = await query(`
      SELECT membership_type, price, original_price, description, features
      FROM membership_configs
      WHERE status = 'active'
      ORDER BY 
        CASE membership_type
          WHEN 'monthly' THEN 1
          WHEN 'quarterly' THEN 2
          WHEN 'semi_annual' THEN 3
          WHEN 'annual' THEN 4
          WHEN 'lifetime' THEN 5
          ELSE 6
        END
    `);

    // 获取支付方式配置
    const paymentMethods = await query(`
      SELECT method_type, method_name, qr_code_url, payment_url, status
      FROM payment_methods
      WHERE status = 'active'
      ORDER BY sort_order
    `);

    res.json({
      success: true,
      data: {
        membership_prices: membershipPrices.map(item => ({
          ...item,
          features: item.features ? JSON.parse(item.features) : []
        })),
        payment_methods
      }
    });
  } catch (error) {
    logger.error('获取支付配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取支付配置失败'
    });
  }
};

/**
 * 创建支付订单
 */
const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { membership_type, payment_method } = req.body;

    // 验证会员类型
    const membershipConfig = await queryOne(`
      SELECT * FROM membership_configs
      WHERE membership_type = ? AND status = 'active'
    `, [membership_type]);

    if (!membershipConfig) {
      return res.status(400).json({
        success: false,
        message: '无效的会员类型'
      });
    }

    // 验证支付方式
    const paymentMethodConfig = await queryOne(`
      SELECT * FROM payment_methods
      WHERE method_type = ? AND status = 'active'
    `, [payment_method]);

    if (!paymentMethodConfig) {
      return res.status(400).json({
        success: false,
        message: '无效的支付方式'
      });
    }

    // 检查用户是否有未完成的订单
    const pendingOrder = await queryOne(`
      SELECT order_id FROM orders
      WHERE user_id = ? AND status IN ('pending', 'processing')
      AND created_time > DATE_SUB(NOW(), INTERVAL 30 MINUTE)
    `, [userId]);

    if (pendingOrder) {
      return res.status(400).json({
        success: false,
        message: '您有未完成的订单，请稍后再试'
      });
    }

    // 获取用户信息（用于代理佣金计算）
    const user = await User.findById(userId);
    
    // 生成订单号
    const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 计算价格
    const amount = membershipConfig.price;
    const originalAmount = membershipConfig.original_price || amount;
    
    // 创建订单
    await insert('orders', {
      order_id: orderId,
      user_id: userId,
      membership_type,
      amount,
      original_amount,
      payment_method,
      status: 'pending',
      created_time: new Date(),
      expires_time: new Date(Date.now() + 30 * 60 * 1000) // 30分钟过期
    });

    // 生成支付信息
    const paymentInfo = await generatePaymentInfo(orderId, amount, paymentMethodConfig);

    logger.logPaymentEvent(userId, 'order_created', {
      order_id: orderId,
      membership_type,
      amount,
      payment_method
    });

    res.json({
      success: true,
      message: '订单创建成功',
      data: {
        order_id: orderId,
        amount,
        membership_type,
        payment_method,
        payment_info: paymentInfo,
        expires_time: new Date(Date.now() + 30 * 60 * 1000)
      }
    });
  } catch (error) {
    logger.error('创建支付订单失败:', error);
    res.status(500).json({
      success: false,
      message: '创建订单失败'
    });
  }
};

/**
 * 查询订单状态
 */
const getOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await queryOne(`
      SELECT * FROM orders
      WHERE order_id = ? AND user_id = ?
    `, [orderId, userId]);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }

    res.json({
      success: true,
      data: {
        order_id: order.order_id,
        status: order.status,
        amount: order.amount,
        membership_type: order.membership_type,
        payment_method: order.payment_method,
        created_time: order.created_time,
        paid_time: order.paid_time,
        expires_time: order.expires_time
      }
    });
  } catch (error) {
    logger.error('查询订单状态失败:', error);
    res.status(500).json({
      success: false,
      message: '查询订单状态失败'
    });
  }
};

/**
 * 支付回调处理
 */
const handlePaymentCallback = async (req, res) => {
  try {
    const { order_id, status, transaction_id, payment_method } = req.body;

    // 验证回调签名（这里简化处理）
    const signature = req.headers['x-payment-signature'];
    if (!verifyPaymentSignature(req.body, signature)) {
      return res.status(400).json({
        success: false,
        message: '签名验证失败'
      });
    }

    // 查询订单
    const order = await queryOne(`
      SELECT * FROM orders WHERE order_id = ?
    `, [order_id]);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }

    if (order.status !== 'pending') {
      return res.json({
        success: true,
        message: '订单已处理'
      });
    }

    if (status === 'success') {
      // 支付成功，激活会员
      await processSuccessfulPayment(order, transaction_id);
    } else {
      // 支付失败
      await update('orders', {
        status: 'failed',
        updated_time: new Date()
      }, { order_id });

      logger.logPaymentEvent(order.user_id, 'payment_failed', {
        order_id,
        reason: 'payment_callback_failed'
      });
    }

    res.json({
      success: true,
      message: '回调处理成功'
    });
  } catch (error) {
    logger.error('支付回调处理失败:', error);
    res.status(500).json({
      success: false,
      message: '回调处理失败'
    });
  }
};

/**
 * 手动确认支付
 */
const confirmPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { transaction_id, payment_proof } = req.body;
    const userId = req.user.id;

    const order = await queryOne(`
      SELECT * FROM orders
      WHERE order_id = ? AND user_id = ?
    `, [orderId, userId]);

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

    // 更新订单状态为处理中
    await update('orders', {
      status: 'processing',
      transaction_id,
      payment_proof,
      updated_time: new Date()
    }, { order_id: orderId });

    logger.logPaymentEvent(userId, 'payment_confirmation_submitted', {
      order_id: orderId,
      transaction_id
    });

    res.json({
      success: true,
      message: '支付确认已提交，请等待审核'
    });
  } catch (error) {
    logger.error('确认支付失败:', error);
    res.status(500).json({
      success: false,
      message: '确认支付失败'
    });
  }
};

/**
 * 获取用户订单列表
 */
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    // 构建查询条件
    let whereClause = 'WHERE user_id = ?';
    const params = [userId];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    // 获取总数
    const countResult = await queryOne(`
      SELECT COUNT(*) as total FROM orders ${whereClause}
    `, params);
    const total = countResult.total;

    // 获取分页数据
    const offset = (page - 1) * limit;
    const orders = await query(`
      SELECT 
        order_id,
        membership_type,
        amount,
        original_amount,
        payment_method,
        status,
        created_time,
        paid_time,
        expires_time
      FROM orders
      ${whereClause}
      ORDER BY created_time DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('获取用户订单列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取订单列表失败'
    });
  }
};

/**
 * 取消订单
 */
const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await queryOne(`
      SELECT * FROM orders
      WHERE order_id = ? AND user_id = ?
    `, [orderId, userId]);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: '只能取消待支付的订单'
      });
    }

    // 取消订单
    await update('orders', {
      status: 'cancelled',
      updated_time: new Date()
    }, { order_id: orderId });

    logger.logPaymentEvent(userId, 'order_cancelled', {
      order_id: orderId
    });

    res.json({
      success: true,
      message: '订单已取消'
    });
  } catch (error) {
    logger.error('取消订单失败:', error);
    res.status(500).json({
      success: false,
      message: '取消订单失败'
    });
  }
};

/**
 * 处理成功支付
 */
const processSuccessfulPayment = async (order, transactionId) => {
  try {
    // 更新订单状态
    await update('orders', {
      status: 'completed',
      transaction_id: transactionId,
      paid_time: new Date(),
      updated_time: new Date()
    }, { order_id: order.order_id });

    // 激活用户会员
    const user = await User.findById(order.user_id);
    const membershipDuration = getMembershipDuration(order.membership_type);
    
    let membershipExpires;
    if (order.membership_type === 'lifetime') {
      membershipExpires = new Date('2099-12-31');
    } else {
      const currentExpires = user.membership_expires && new Date(user.membership_expires) > new Date() 
        ? new Date(user.membership_expires) 
        : new Date();
      membershipExpires = new Date(currentExpires.getTime() + membershipDuration);
    }

    await update('users', {
      membership_type: order.membership_type,
      membership_expires: membershipExpires,
      updated_time: new Date()
    }, { id: order.user_id });

    // 清除用户缓存
    await cache.del(`user:${order.user_id}`);

    // 计算代理佣金
    if (user.agent_id) {
      await calculateAgentCommission(user.agent_id, order.amount);
    }

    logger.logPaymentEvent(order.user_id, 'payment_success', {
      order_id: order.order_id,
      membership_type: order.membership_type,
      amount: order.amount,
      membership_expires
    });

    // 发送成功通知
    const io = require('../app').get('io');
    if (io) {
      io.to(`user_${order.user_id}`).emit('payment_success', {
        order_id: order.order_id,
        membership_type: order.membership_type,
        membership_expires
      });
    }
  } catch (error) {
    logger.error('处理成功支付失败:', error);
    throw error;
  }
};

/**
 * 计算代理佣金
 */
const calculateAgentCommission = async (agentId, orderAmount) => {
  try {
    const agent = await queryOne(`
      SELECT * FROM agents WHERE id = ? AND status = 'active'
    `, [agentId]);

    if (!agent) {
      return;
    }

    const commission = orderAmount * agent.commission_rate;

    // 更新代理佣金
    await update('agents', {
      total_commission: agent.total_commission + commission,
      pending_commission: agent.pending_commission + commission,
      updated_time: new Date()
    }, { id: agentId });

    logger.logAgentAction(agentId, 'commission_earned', {
      amount: commission,
      order_amount: orderAmount,
      commission_rate: agent.commission_rate
    });
  } catch (error) {
    logger.error('计算代理佣金失败:', error);
  }
};

/**
 * 生成支付信息
 */
const generatePaymentInfo = async (orderId, amount, paymentMethodConfig) => {
  const paymentInfo = {
    order_id: orderId,
    amount,
    payment_method: paymentMethodConfig.method_type,
    method_name: paymentMethodConfig.method_name
  };

  if (paymentMethodConfig.qr_code_url) {
    paymentInfo.qr_code_url = paymentMethodConfig.qr_code_url;
  }

  if (paymentMethodConfig.payment_url) {
    paymentInfo.payment_url = paymentMethodConfig.payment_url.replace('{amount}', amount).replace('{order_id}', orderId);
  }

  return paymentInfo;
};

/**
 * 获取会员时长（毫秒）
 */
const getMembershipDuration = (membershipType) => {
  const durations = {
    monthly: 30 * 24 * 60 * 60 * 1000,      // 30天
    quarterly: 90 * 24 * 60 * 60 * 1000,    // 90天
    semi_annual: 180 * 24 * 60 * 60 * 1000, // 180天
    annual: 365 * 24 * 60 * 60 * 1000,      // 365天
    lifetime: 0 // 永久
  };
  
  return durations[membershipType] || 0;
};

/**
 * 验证支付签名
 */
const verifyPaymentSignature = (data, signature) => {
  // 这里应该根据具体的支付平台实现签名验证
  // 简化处理，实际应用中需要严格验证
  const secret = config.payment.webhook_secret || 'default_secret';
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(data))
    .digest('hex');
  
  return signature === expectedSignature;
};

module.exports = {
  getPaymentConfig,
  createOrder,
  getOrderStatus,
  handlePaymentCallback,
  confirmPayment,
  getUserOrders,
  cancelOrder,
  processSuccessfulPayment
};