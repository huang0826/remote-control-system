/**
 * 代理管理控制器
 */

const User = require('../models/User');
const { query, queryOne, insert, update, remove } = require('../database/connection');
const { cache } = require('../database/redis');
const logger = require('../utils/logger');
const config = require('../config');
const crypto = require('crypto');

/**
 * 获取代理信息
 */
const getAgentInfo = async (req, res) => {
  try {
    const userId = req.user.id;

    // 检查用户是否为代理
    const agent = await queryOne(`
      SELECT *
      FROM agents
      WHERE user_id = ?
    `, [userId]);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: '您不是代理用户'
      });
    }

    // 获取代理统计信息
    const stats = await getAgentStats(agent.id);

    res.json({
      success: true,
      data: {
        agent_info: {
          id: agent.id,
          agent_code: agent.agent_code,
          commission_rate: agent.commission_rate,
          total_commission: agent.total_commission,
          pending_commission: agent.pending_commission,
          withdrawn_commission: agent.withdrawn_commission,
          status: agent.status,
          created_time: agent.created_time
        },
        stats,
        invite_link: `${config.app.base_url}/register?agent=${agent.agent_code}`,
        qr_code_url: `${config.app.base_url}/api/agents/qr/${agent.agent_code}`
      }
    });
  } catch (error) {
    logger.error('获取代理信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取代理信息失败'
    });
  }
};

/**
 * 获取代理下级用户列表
 */
const getAgentUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, keyword } = req.query;

    // 检查用户是否为代理
    const agent = await queryOne(`
      SELECT id
      FROM agents
      WHERE user_id = ? AND status = 'active'
    `, [userId]);

    if (!agent) {
      return res.status(403).json({
        success: false,
        message: '您不是有效的代理用户'
      });
    }

    // 构建查询条件
    let whereClause = 'WHERE agent_id = ?';
    const params = [agent.id];

    if (keyword) {
      whereClause += ' AND (phone LIKE ? OR nickname LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    // 获取总数
    const countSql = `
      SELECT COUNT(*) as total 
      FROM users 
      ${whereClause}
    `;
    const countResult = await queryOne(countSql, params);
    const total = countResult.total;

    // 获取分页数据
    const offset = (page - 1) * limit;
    const sql = `
      SELECT 
        id,
        phone,
        nickname,
        membership_type,
        membership_expires,
        created_time,
        last_login_time
      FROM users 
      ${whereClause}
      ORDER BY created_time DESC
      LIMIT ? OFFSET ?
    `;
    
    const users = await query(sql, [...params, parseInt(limit), offset]);

    // 获取用户充值统计
    const userIds = users.map(u => u.id);
    let rechargeStats = {};
    
    if (userIds.length > 0) {
      const placeholders = userIds.map(() => '?').join(',');
      const rechargeData = await query(`
        SELECT 
          user_id,
          COUNT(*) as order_count,
          SUM(amount) as total_amount
        FROM orders
        WHERE user_id IN (${placeholders}) AND status = 'completed'
        GROUP BY user_id
      `, userIds);
      
      rechargeStats = rechargeData.reduce((acc, item) => {
        acc[item.user_id] = {
          order_count: item.order_count,
          total_amount: item.total_amount
        };
        return acc;
      }, {});
    }

    // 合并数据
    const processedUsers = users.map(user => ({
      ...user,
      recharge_stats: rechargeStats[user.id] || { order_count: 0, total_amount: 0 }
    }));

    res.json({
      success: true,
      data: {
        users: processedUsers,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('获取代理用户列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户列表失败'
    });
  }
};

/**
 * 获取代理收益记录
 */
const getAgentCommissions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, start_date, end_date } = req.query;

    // 检查用户是否为代理
    const agent = await queryOne(`
      SELECT id
      FROM agents
      WHERE user_id = ? AND status = 'active'
    `, [userId]);

    if (!agent) {
      return res.status(403).json({
        success: false,
        message: '您不是有效的代理用户'
      });
    }

    // 构建查询条件
    let whereClause = 'WHERE o.user_id IN (SELECT id FROM users WHERE agent_id = ?)';
    const params = [agent.id];

    if (start_date) {
      whereClause += ' AND DATE(o.paid_time) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND DATE(o.paid_time) <= ?';
      params.push(end_date);
    }

    // 获取总数
    const countSql = `
      SELECT COUNT(*) as total 
      FROM orders o
      ${whereClause} AND o.status = 'completed'
    `;
    const countResult = await queryOne(countSql, params);
    const total = countResult.total;

    // 获取分页数据
    const offset = (page - 1) * limit;
    const sql = `
      SELECT 
        o.order_id,
        o.amount,
        o.membership_type,
        o.paid_time,
        u.phone as user_phone,
        u.nickname as user_nickname,
        a.commission_rate,
        (o.amount * a.commission_rate) as commission
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN agents a ON u.agent_id = a.id
      ${whereClause} AND o.status = 'completed'
      ORDER BY o.paid_time DESC
      LIMIT ? OFFSET ?
    `;
    
    const commissions = await query(sql, [...params, parseInt(limit), offset]);

    res.json({
      success: true,
      data: {
        commissions,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('获取代理收益记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取收益记录失败'
    });
  }
};

/**
 * 生成代理邀请二维码
 */
const generateAgentQR = async (req, res) => {
  try {
    const { agentCode } = req.params;

    // 验证代理码
    const agent = await queryOne(`
      SELECT id
      FROM agents
      WHERE agent_code = ? AND status = 'active'
    `, [agentCode]);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: '无效的代理码'
      });
    }

    // 生成二维码内容
    const qrContent = `${config.app.base_url}/register?agent=${agentCode}`;
    
    // 这里应该使用二维码生成库，比如 qrcode
    const QRCode = require('qrcode');
    
    try {
      const qrCodeDataURL = await QRCode.toDataURL(qrContent, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // 返回二维码图片
      const base64Data = qrCodeDataURL.replace(/^data:image\/png;base64,/, '');
      const imgBuffer = Buffer.from(base64Data, 'base64');
      
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存1天
      res.send(imgBuffer);
    } catch (qrError) {
      logger.error('生成二维码失败:', qrError);
      res.status(500).json({
        success: false,
        message: '生成二维码失败'
      });
    }
  } catch (error) {
    logger.error('生成代理二维码失败:', error);
    res.status(500).json({
      success: false,
      message: '生成二维码失败'
    });
  }
};

/**
 * 申请提现
 */
const requestWithdrawal = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, payment_method, payment_account } = req.body;

    // 验证参数
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: '提现金额必须大于0'
      });
    }

    if (!payment_method || !payment_account) {
      return res.status(400).json({
        success: false,
        message: '支付方式和账户信息不能为空'
      });
    }

    // 检查用户是否为代理
    const agent = await queryOne(`
      SELECT *
      FROM agents
      WHERE user_id = ? AND status = 'active'
    `, [userId]);

    if (!agent) {
      return res.status(403).json({
        success: false,
        message: '您不是有效的代理用户'
      });
    }

    // 检查可提现金额
    if (amount > agent.pending_commission) {
      return res.status(400).json({
        success: false,
        message: '提现金额超过可提现余额'
      });
    }

    // 检查最低提现金额
    const minWithdrawal = config.agent.min_withdrawal || 100;
    if (amount < minWithdrawal) {
      return res.status(400).json({
        success: false,
        message: `最低提现金额为${minWithdrawal}元`
      });
    }

    // 创建提现申请
    const withdrawalId = `WD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await insert('agent_withdrawals', {
      withdrawal_id: withdrawalId,
      agent_id: agent.id,
      amount,
      payment_method,
      payment_account,
      status: 'pending',
      created_time: new Date()
    });

    // 更新代理余额
    await update('agents', {
      pending_commission: agent.pending_commission - amount
    }, { id: agent.id });

    logger.logAgentAction(agent.id, 'withdrawal_requested', {
      withdrawal_id: withdrawalId,
      amount,
      payment_method
    });

    res.json({
      success: true,
      message: '提现申请提交成功',
      data: {
        withdrawal_id: withdrawalId,
        amount,
        status: 'pending'
      }
    });
  } catch (error) {
    logger.error('申请提现失败:', error);
    res.status(500).json({
      success: false,
      message: '申请提现失败'
    });
  }
};

/**
 * 获取提现记录
 */
const getWithdrawals = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    // 检查用户是否为代理
    const agent = await queryOne(`
      SELECT id
      FROM agents
      WHERE user_id = ? AND status = 'active'
    `, [userId]);

    if (!agent) {
      return res.status(403).json({
        success: false,
        message: '您不是有效的代理用户'
      });
    }

    // 获取总数
    const countResult = await queryOne(`
      SELECT COUNT(*) as total 
      FROM agent_withdrawals 
      WHERE agent_id = ?
    `, [agent.id]);
    const total = countResult.total;

    // 获取分页数据
    const offset = (page - 1) * limit;
    const withdrawals = await query(`
      SELECT 
        withdrawal_id,
        amount,
        payment_method,
        payment_account,
        status,
        processed_time,
        reject_reason,
        created_time
      FROM agent_withdrawals
      WHERE agent_id = ?
      ORDER BY created_time DESC
      LIMIT ? OFFSET ?
    `, [agent.id, parseInt(limit), offset]);

    res.json({
      success: true,
      data: {
        withdrawals,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('获取提现记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取提现记录失败'
    });
  }
};

/**
 * 获取代理统计信息
 */
const getAgentStats = async (agentId) => {
  try {
    // 获取下级用户数量
    const userCount = await queryOne(`
      SELECT COUNT(*) as count
      FROM users
      WHERE agent_id = ?
    `, [agentId]);

    // 获取本月新增用户
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const monthlyUsers = await queryOne(`
      SELECT COUNT(*) as count
      FROM users
      WHERE agent_id = ? AND created_time >= ?
    `, [agentId, thisMonth]);

    // 获取总充值金额
    const totalRecharge = await queryOne(`
      SELECT 
        COUNT(*) as order_count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE u.agent_id = ? AND o.status = 'completed'
    `, [agentId]);

    // 获取本月充值金额
    const monthlyRecharge = await queryOne(`
      SELECT 
        COUNT(*) as order_count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE u.agent_id = ? AND o.status = 'completed' AND o.paid_time >= ?
    `, [agentId, thisMonth]);

    return {
      total_users: userCount.count,
      monthly_new_users: monthlyUsers.count,
      total_orders: totalRecharge.order_count,
      total_recharge: totalRecharge.total_amount,
      monthly_orders: monthlyRecharge.order_count,
      monthly_recharge: monthlyRecharge.total_amount
    };
  } catch (error) {
    logger.error('获取代理统计失败:', error);
    return {
      total_users: 0,
      monthly_new_users: 0,
      total_orders: 0,
      total_recharge: 0,
      monthly_orders: 0,
      monthly_recharge: 0
    };
  }
};

/**
 * 验证代理码
 */
const validateAgentCode = async (req, res) => {
  try {
    const { agent_code } = req.body;

    if (!agent_code) {
      return res.status(400).json({
        success: false,
        message: '代理码不能为空'
      });
    }

    const agent = await queryOne(`
      SELECT a.*, u.nickname as agent_name
      FROM agents a
      JOIN users u ON a.user_id = u.id
      WHERE a.agent_code = ? AND a.status = 'active'
    `, [agent_code]);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: '无效的代理码'
      });
    }

    res.json({
      success: true,
      message: '代理码有效',
      data: {
        agent_id: agent.id,
        agent_name: agent.agent_name,
        commission_rate: agent.commission_rate
      }
    });
  } catch (error) {
    logger.error('验证代理码失败:', error);
    res.status(500).json({
      success: false,
      message: '验证代理码失败'
    });
  }
};

/**
 * 生成唯一代理码
 */
const generateUniqueAgentCode = async () => {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    // 生成4位数字代理码
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    
    // 检查是否已存在
    const existing = await queryOne(`
      SELECT id FROM agents WHERE agent_code = ?
    `, [code]);

    if (!existing) {
      return code;
    }

    attempts++;
  }

  throw new Error('无法生成唯一代理码');
};

module.exports = {
  getAgentInfo,
  getAgentUsers,
  getAgentCommissions,
  generateAgentQR,
  requestWithdrawal,
  getWithdrawals,
  validateAgentCode,
  generateUniqueAgentCode
};