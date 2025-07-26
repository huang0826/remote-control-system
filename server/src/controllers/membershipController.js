/**
 * 会员管理控制器
 */

const User = require('../models/User');
const { query, queryOne, insert, update, remove } = require('../database/connection');
const { cache } = require('../database/redis');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * 获取会员配置
 */
const getMembershipConfigs = async (req, res) => {
  try {
    const configs = await query(`
      SELECT 
        id,
        type,
        name,
        duration_days,
        price,
        features,
        is_active,
        sort_order,
        created_time
      FROM membership_configs
      WHERE is_active = 1
      ORDER BY sort_order ASC
    `);

    // 处理功能列表
    const processedConfigs = configs.map(config => {
      let features = [];
      try {
        features = config.features ? JSON.parse(config.features) : [];
      } catch (e) {
        features = [];
      }

      return {
        ...config,
        features
      };
    });

    res.json({
      success: true,
      data: {
        configs: processedConfigs
      }
    });
  } catch (error) {
    logger.error('获取会员配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取会员配置失败'
    });
  }
};

/**
 * 获取用户会员信息
 */
const getUserMembership = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 获取会员配置
    const membershipConfig = await queryOne(`
      SELECT 
        type,
        name,
        features
      FROM membership_configs
      WHERE type = ? AND is_active = 1
    `, [user.membership_type]);

    let features = [];
    if (membershipConfig && membershipConfig.features) {
      try {
        features = JSON.parse(membershipConfig.features);
      } catch (e) {
        features = [];
      }
    }

    // 获取功能使用统计
    const usageStats = await getUserUsageStats(userId);

    res.json({
      success: true,
      data: {
        membership_type: user.membership_type,
        membership_name: membershipConfig ? membershipConfig.name : '免费用户',
        membership_expires: user.membership_expires,
        is_valid: User.isMembershipValid(user),
        features,
        usage_stats: usageStats
      }
    });
  } catch (error) {
    logger.error('获取用户会员信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取会员信息失败'
    });
  }
};

/**
 * 购买会员
 */
const purchaseMembership = async (req, res) => {
  try {
    const { membership_type, payment_method } = req.body;
    const userId = req.user.id;

    // 验证会员类型
    const membershipConfig = await queryOne(`
      SELECT *
      FROM membership_configs
      WHERE type = ? AND is_active = 1
    `, [membership_type]);

    if (!membershipConfig) {
      return res.status(400).json({
        success: false,
        message: '无效的会员类型'
      });
    }

    // 验证支付方式
    const allowedPaymentMethods = ['alipay', 'wechat', 'third_party'];
    if (!allowedPaymentMethods.includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: '不支持的支付方式'
      });
    }

    // 生成订单
    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const orderData = {
      order_id: orderId,
      user_id: userId,
      membership_type,
      amount: membershipConfig.price,
      payment_method,
      status: 'pending',
      created_time: new Date()
    };

    await insert('orders', orderData);

    // 生成支付信息
    const paymentInfo = await generatePaymentInfo(orderId, membershipConfig, payment_method);

    logger.logUserAction(userId, 'purchase_membership', {
      order_id: orderId,
      membership_type,
      amount: membershipConfig.price,
      payment_method
    });

    res.json({
      success: true,
      message: '订单创建成功',
      data: {
        order_id: orderId,
        membership_type,
        amount: membershipConfig.price,
        payment_method,
        payment_info: paymentInfo
      }
    });
  } catch (error) {
    logger.error('购买会员失败:', error);
    res.status(500).json({
      success: false,
      message: '购买会员失败'
    });
  }
};

/**
 * 支付回调处理
 */
const handlePaymentCallback = async (req, res) => {
  try {
    const { order_id, status, transaction_id } = req.body;

    // 验证订单
    const order = await queryOne(`
      SELECT *
      FROM orders
      WHERE order_id = ? AND status = 'pending'
    `, [order_id]);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在或已处理'
      });
    }

    if (status === 'success') {
      // 支付成功，激活会员
      await activateMembership(order.user_id, order.membership_type);
      
      // 更新订单状态
      await update('orders', {
        status: 'completed',
        transaction_id,
        paid_time: new Date()
      }, { id: order.id });

      // 如果有代理，计算佣金
      await calculateAgentCommission(order.user_id, order.amount);

      logger.logPaymentEvent('payment_success', {
        order_id,
        user_id: order.user_id,
        amount: order.amount,
        membership_type: order.membership_type
      });
    } else {
      // 支付失败
      await update('orders', {
        status: 'failed',
        transaction_id
      }, { id: order.id });

      logger.logPaymentEvent('payment_failed', {
        order_id,
        user_id: order.user_id,
        amount: order.amount
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
 * 获取订单列表
 */
const getOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    // 获取总数
    const countResult = await queryOne(`
      SELECT COUNT(*) as total 
      FROM orders 
      WHERE user_id = ?
    `, [userId]);
    const total = countResult.total;

    // 获取分页数据
    const offset = (page - 1) * limit;
    const orders = await query(`
      SELECT 
        o.*,
        mc.name as membership_name
      FROM orders o
      LEFT JOIN membership_configs mc ON o.membership_type = mc.type
      WHERE o.user_id = ?
      ORDER BY o.created_time DESC
      LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), offset]);

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
    logger.error('获取订单列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取订单列表失败'
    });
  }
};

/**
 * 获取功能使用限制
 */
const getFeatureLimits = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 获取会员配置
    const membershipConfig = await queryOne(`
      SELECT features
      FROM membership_configs
      WHERE type = ? AND is_active = 1
    `, [user.membership_type]);

    let features = {};
    if (membershipConfig && membershipConfig.features) {
      try {
        features = JSON.parse(membershipConfig.features);
      } catch (e) {
        features = {};
      }
    }

    // 获取今日使用统计
    const today = new Date().toISOString().split('T')[0];
    const usageStats = await getUserDailyUsage(userId, today);

    // 计算剩余次数
    const limits = {};
    for (const [feature, config] of Object.entries(features)) {
      if (config.daily_limit) {
        const used = usageStats[feature] || 0;
        limits[feature] = {
          daily_limit: config.daily_limit,
          used_today: used,
          remaining: Math.max(0, config.daily_limit - used),
          unlimited: config.daily_limit === -1
        };
      }
    }

    res.json({
      success: true,
      data: {
        membership_type: user.membership_type,
        is_valid: User.isMembershipValid(user),
        limits
      }
    });
  } catch (error) {
    logger.error('获取功能使用限制失败:', error);
    res.status(500).json({
      success: false,
      message: '获取功能限制失败'
    });
  }
};

/**
 * 激活会员
 */
const activateMembership = async (userId, membershipType) => {
  try {
    const membershipConfig = await queryOne(`
      SELECT duration_days
      FROM membership_configs
      WHERE type = ? AND is_active = 1
    `, [membershipType]);

    if (!membershipConfig) {
      throw new Error('无效的会员类型');
    }

    const user = await User.findById(userId);
    let expiresAt;

    if (membershipType === 'permanent') {
      // 永久会员
      expiresAt = new Date('2099-12-31');
    } else {
      // 计算到期时间
      const currentExpires = user.membership_expires && new Date(user.membership_expires) > new Date() 
        ? new Date(user.membership_expires) 
        : new Date();
      
      expiresAt = new Date(currentExpires);
      expiresAt.setDate(expiresAt.getDate() + membershipConfig.duration_days);
    }

    // 更新用户会员信息
    await User.updateInfo(userId, {
      membership_type: membershipType,
      membership_expires: expiresAt
    });

    // 清除缓存
    await cache.del(`user:${userId}`);

    logger.logUserAction(userId, 'membership_activated', {
      membership_type: membershipType,
      expires_at: expiresAt
    });
  } catch (error) {
    logger.error('激活会员失败:', error);
    throw error;
  }
};

/**
 * 计算代理佣金
 */
const calculateAgentCommission = async (userId, amount) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.agent_id) {
      return;
    }

    // 获取代理信息
    const agent = await queryOne(`
      SELECT *
      FROM agents
      WHERE id = ? AND status = 'active'
    `, [user.agent_id]);

    if (!agent) {
      return;
    }

    // 计算佣金
    const commissionRate = agent.commission_rate || config.agent.default_commission_rate || 0.1;
    const commission = amount * commissionRate;

    // 更新代理佣金
    await query(`
      UPDATE agents 
      SET total_commission = total_commission + ?,
          pending_commission = pending_commission + ?
      WHERE id = ?
    `, [commission, commission, agent.id]);

    logger.logAgentAction(agent.id, 'commission_earned', {
      user_id: userId,
      order_amount: amount,
      commission_rate: commissionRate,
      commission
    });
  } catch (error) {
    logger.error('计算代理佣金失败:', error);
  }
};

/**
 * 生成支付信息
 */
const generatePaymentInfo = async (orderId, membershipConfig, paymentMethod) => {
  try {
    const paymentInfo = {
      order_id: orderId,
      amount: membershipConfig.price,
      title: `购买${membershipConfig.name}`,
      description: `${membershipConfig.name} - ${membershipConfig.duration_days}天`
    };

    if (paymentMethod === 'alipay') {
      // 支付宝支付
      paymentInfo.qr_code = config.payment.alipay_qr_code;
      paymentInfo.account = config.payment.alipay_account;
    } else if (paymentMethod === 'wechat') {
      // 微信支付
      paymentInfo.qr_code = config.payment.wechat_qr_code;
      paymentInfo.account = config.payment.wechat_account;
    } else if (paymentMethod === 'third_party') {
      // 第三方链接
      paymentInfo.payment_url = config.payment.third_party_url;
    }

    return paymentInfo;
  } catch (error) {
    logger.error('生成支付信息失败:', error);
    return {};
  }
};

/**
 * 获取用户使用统计
 */
const getUserUsageStats = async (userId) => {
  try {
    // 获取用户设备
    const devices = await query(`
      SELECT id FROM devices WHERE user_id = ?
    `, [userId]);

    const deviceIds = devices.map(d => d.id);
    if (deviceIds.length === 0) {
      return {};
    }

    const placeholders = deviceIds.map(() => '?').join(',');
    
    // 获取各功能使用统计
    const stats = {};
    
    // 文件统计
    const fileStats = await query(`
      SELECT file_type, COUNT(*) as count
      FROM files
      WHERE device_id IN (${placeholders})
      GROUP BY file_type
    `, deviceIds);
    
    stats.files = {};
    fileStats.forEach(stat => {
      stats.files[stat.file_type] = stat.count;
    });

    // 位置记录统计
    const locationCount = await queryOne(`
      SELECT COUNT(*) as count
      FROM location_records
      WHERE device_id IN (${placeholders})
    `, deviceIds);
    
    stats.location_records = locationCount.count;

    // 应用使用记录统计
    const appUsageCount = await queryOne(`
      SELECT COUNT(*) as count
      FROM app_usage_records
      WHERE device_id IN (${placeholders})
    `, deviceIds);
    
    stats.app_usage_records = appUsageCount.count;

    return stats;
  } catch (error) {
    logger.error('获取用户使用统计失败:', error);
    return {};
  }
};

/**
 * 获取用户每日使用统计
 */
const getUserDailyUsage = async (userId, date) => {
  try {
    // 从缓存获取
    const cacheKey = `daily_usage:${userId}:${date}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 获取用户设备
    const devices = await query(`
      SELECT id FROM devices WHERE user_id = ?
    `, [userId]);

    const deviceIds = devices.map(d => d.id);
    if (deviceIds.length === 0) {
      return {};
    }

    const placeholders = deviceIds.map(() => '?').join(',');
    const startDate = `${date} 00:00:00`;
    const endDate = `${date} 23:59:59`;
    
    const usage = {};
    
    // 远程拍照
    const photoCount = await queryOne(`
      SELECT COUNT(*) as count
      FROM files
      WHERE device_id IN (${placeholders}) 
        AND file_type = 'photo' 
        AND created_time BETWEEN ? AND ?
    `, [...deviceIds, startDate, endDate]);
    usage.remote_photo = photoCount.count;

    // 环境录音
    const audioCount = await queryOne(`
      SELECT COUNT(*) as count
      FROM files
      WHERE device_id IN (${placeholders}) 
        AND file_type = 'audio' 
        AND created_time BETWEEN ? AND ?
    `, [...deviceIds, startDate, endDate]);
    usage.remote_record = audioCount.count;

    // 录像
    const videoCount = await queryOne(`
      SELECT COUNT(*) as count
      FROM files
      WHERE device_id IN (${placeholders}) 
        AND file_type = 'video' 
        AND created_time BETWEEN ? AND ?
    `, [...deviceIds, startDate, endDate]);
    usage.remote_video = videoCount.count;

    // 截屏
    const screenshotCount = await queryOne(`
      SELECT COUNT(*) as count
      FROM files
      WHERE device_id IN (${placeholders}) 
        AND file_type = 'screenshot' 
        AND created_time BETWEEN ? AND ?
    `, [...deviceIds, startDate, endDate]);
    usage.screenshot = screenshotCount.count;

    // 缓存结果
    await cache.set(cacheKey, usage, 3600); // 缓存1小时

    return usage;
  } catch (error) {
    logger.error('获取用户每日使用统计失败:', error);
    return {};
  }
};

module.exports = {
  getMembershipConfigs,
  getUserMembership,
  purchaseMembership,
  handlePaymentCallback,
  getOrders,
  getFeatureLimits,
  activateMembership
};