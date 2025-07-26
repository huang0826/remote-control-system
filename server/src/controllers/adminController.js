/**
 * 管理员控制器
 */

const User = require('../models/User');
const Device = require('../models/Device');
const { query, queryOne, insert, update, remove, transaction } = require('../database/connection');
const { cache } = require('../database/redis');
const logger = require('../utils/logger');
const config = require('../config');
const crypto = require('crypto');
const { generateUniqueAgentCode } = require('./agentController');

/**
 * 获取系统统计信息
 */
const getSystemStats = async (req, res) => {
  try {
    // 获取用户统计
    const userStats = await queryOne(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_time >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as monthly_new_users,
        COUNT(CASE WHEN last_login_time >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) as daily_active_users,
        COUNT(CASE WHEN membership_type != 'free' AND membership_expires > NOW() THEN 1 END) as premium_users
      FROM users
    `);

    // 获取设备统计
    const deviceStats = await queryOne(`
      SELECT 
        COUNT(*) as total_devices,
        COUNT(CASE WHEN status = 'online' THEN 1 END) as online_devices,
        COUNT(CASE WHEN created_time >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as monthly_new_devices
      FROM devices
    `);

    // 获取订单统计
    const orderStats = await queryOne(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN status = 'completed' AND paid_time >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN amount ELSE 0 END), 0) as monthly_revenue
      FROM orders
    `);

    // 获取代理统计
    const agentStats = await queryOne(`
      SELECT 
        COUNT(*) as total_agents,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_agents,
        COALESCE(SUM(total_commission), 0) as total_commission_paid
      FROM agents
    `);

    // 获取文件统计
    const fileStats = await queryOne(`
      SELECT 
        COUNT(*) as total_files,
        COALESCE(SUM(file_size), 0) as total_storage_used,
        COUNT(CASE WHEN created_time >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) as daily_new_files
      FROM files
    `);

    res.json({
      success: true,
      data: {
        users: userStats,
        devices: deviceStats,
        orders: orderStats,
        agents: agentStats,
        files: fileStats,
        system: {
          server_uptime: process.uptime(),
          memory_usage: process.memoryUsage(),
          node_version: process.version
        }
      }
    });
  } catch (error) {
    logger.error('获取系统统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统统计失败'
    });
  }
};

/**
 * 获取用户列表
 */
const getUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      keyword, 
      membership_type, 
      status,
      start_date,
      end_date
    } = req.query;

    // 构建查询条件
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (keyword) {
      whereClause += ' AND (phone LIKE ? OR nickname LIKE ? OR invite_code LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (membership_type) {
      whereClause += ' AND membership_type = ?';
      params.push(membership_type);
    }

    if (status === 'active') {
      whereClause += ' AND last_login_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    } else if (status === 'inactive') {
      whereClause += ' AND (last_login_time < DATE_SUB(NOW(), INTERVAL 30 DAY) OR last_login_time IS NULL)';
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
    const countSql = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const countResult = await queryOne(countSql, params);
    const total = countResult.total;

    // 获取分页数据
    const offset = (page - 1) * limit;
    const sql = `
      SELECT 
        u.*,
        a.agent_code,
        (SELECT COUNT(*) FROM devices WHERE user_id = u.id) as device_count,
        (SELECT COUNT(*) FROM orders WHERE user_id = u.id AND status = 'completed') as order_count,
        (SELECT COALESCE(SUM(amount), 0) FROM orders WHERE user_id = u.id AND status = 'completed') as total_spent
      FROM users u
      LEFT JOIN agents a ON u.agent_id = a.id
      ${whereClause}
      ORDER BY u.created_time DESC
      LIMIT ? OFFSET ?
    `;
    
    const users = await query(sql, [...params, parseInt(limit), offset]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('获取用户列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户列表失败'
    });
  }
};

/**
 * 更新用户信息
 */
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      nickname, 
      membership_type, 
      membership_expires, 
      status,
      is_admin,
      notes
    } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const updateData = {};
    if (nickname !== undefined) updateData.nickname = nickname;
    if (membership_type !== undefined) updateData.membership_type = membership_type;
    if (membership_expires !== undefined) updateData.membership_expires = membership_expires;
    if (status !== undefined) updateData.status = status;
    if (is_admin !== undefined) updateData.is_admin = is_admin;
    if (notes !== undefined) updateData.admin_notes = notes;

    updateData.updated_time = new Date();

    await update('users', updateData, { id: userId });

    // 清除用户缓存
    await cache.del(`user:${userId}`);
    await cache.del(`user:phone:${user.phone}`);

    logger.logUserAction(userId, 'admin_updated', {
      admin_id: req.user.id,
      changes: updateData
    });

    res.json({
      success: true,
      message: '用户信息更新成功'
    });
  } catch (error) {
    logger.error('更新用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '更新用户信息失败'
    });
  }
};

/**
 * 删除用户
 */
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 使用事务删除用户及相关数据
    await transaction(async (connection) => {
      // 删除用户设备
      await connection.query('DELETE FROM devices WHERE user_id = ?', [userId]);
      
      // 删除用户文件
      await connection.query('DELETE FROM files WHERE user_id = ?', [userId]);
      
      // 删除用户订单
      await connection.query('DELETE FROM orders WHERE user_id = ?', [userId]);
      
      // 删除用户位置记录
      await connection.query('DELETE FROM location_records WHERE device_id IN (SELECT id FROM devices WHERE user_id = ?)', [userId]);
      
      // 删除用户应用记录
      await connection.query('DELETE FROM app_usage_records WHERE device_id IN (SELECT id FROM devices WHERE user_id = ?)', [userId]);
      
      // 删除用户
      await connection.query('DELETE FROM users WHERE id = ?', [userId]);
    });

    // 清除缓存
    await cache.del(`user:${userId}`);
    await cache.del(`user:phone:${user.phone}`);

    logger.logUserAction(userId, 'admin_deleted', {
      admin_id: req.user.id
    });

    res.json({
      success: true,
      message: '用户删除成功'
    });
  } catch (error) {
    logger.error('删除用户失败:', error);
    res.status(500).json({
      success: false,
      message: '删除用户失败'
    });
  }
};

/**
 * 获取设备列表
 */
const getDevices = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      keyword, 
      status,
      user_id,
      start_date,
      end_date
    } = req.query;

    // 构建查询条件
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (keyword) {
      whereClause += ' AND (d.device_id LIKE ? OR d.device_name LIKE ? OR u.phone LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (status) {
      whereClause += ' AND d.status = ?';
      params.push(status);
    }

    if (user_id) {
      whereClause += ' AND d.user_id = ?';
      params.push(user_id);
    }

    if (start_date) {
      whereClause += ' AND DATE(d.created_time) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND DATE(d.created_time) <= ?';
      params.push(end_date);
    }

    // 获取总数
    const countSql = `
      SELECT COUNT(*) as total 
      FROM devices d
      LEFT JOIN users u ON d.user_id = u.id
      ${whereClause}
    `;
    const countResult = await queryOne(countSql, params);
    const total = countResult.total;

    // 获取分页数据
    const offset = (page - 1) * limit;
    const sql = `
      SELECT 
        d.*,
        u.phone as user_phone,
        u.nickname as user_nickname,
        (SELECT COUNT(*) FROM files WHERE device_id = d.id) as file_count
      FROM devices d
      LEFT JOIN users u ON d.user_id = u.id
      ${whereClause}
      ORDER BY d.created_time DESC
      LIMIT ? OFFSET ?
    `;
    
    const devices = await query(sql, [...params, parseInt(limit), offset]);

    res.json({
      success: true,
      data: {
        devices,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('获取设备列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取设备列表失败'
    });
  }
};

/**
 * 远程控制设备
 */
const controlDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { action, params: actionParams } = req.body;

    const device = await Device.findByDeviceId(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备不在线'
      });
    }

    // 生成任务ID
    const taskId = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 发送控制指令
    const command = {
      task_id: taskId,
      action,
      params: actionParams,
      admin_id: req.user.id,
      timestamp: new Date().toISOString(),
      // 添加直接上传到服务器的标志
      direct_upload: true
    };

    const sent = await socketManager.sendToDevice(device.device_id, command);
    if (!sent) {
      return res.status(400).json({
        success: false,
        message: '设备连接异常，指令发送失败'
      });
    }

    // 记录任务
    await cache.set(`admin_task:${taskId}`, {
      device_id: deviceId,
      action,
      params: actionParams,
      admin_id: req.user.id,
      status: 'pending',
      created_time: new Date()
    }, 3600);

    logger.logDeviceAction(deviceId, 'admin_control', {
      admin_id: req.user.id,
      action,
      task_id: taskId
    });

    res.json({
      success: true,
      message: '控制指令已发送',
      data: {
        task_id: taskId
      }
    });
  } catch (error) {
    logger.error('远程控制设备失败:', error);
    res.status(500).json({
      success: false,
      message: '远程控制设备失败'
    });
  }
};

/**
 * 获取订单列表
 */
const getOrders = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      keyword, 
      status,
      membership_type,
      start_date,
      end_date
    } = req.query;

    // 构建查询条件
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (keyword) {
      whereClause += ' AND (o.order_id LIKE ? OR u.phone LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (status) {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }

    if (membership_type) {
      whereClause += ' AND o.membership_type = ?';
      params.push(membership_type);
    }

    if (start_date) {
      whereClause += ' AND DATE(o.created_time) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND DATE(o.created_time) <= ?';
      params.push(end_date);
    }

    // 获取总数
    const countSql = `
      SELECT COUNT(*) as total 
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${whereClause}
    `;
    const countResult = await queryOne(countSql, params);
    const total = countResult.total;

    // 获取分页数据
    const offset = (page - 1) * limit;
    const sql = `
      SELECT 
        o.*,
        u.phone as user_phone,
        u.nickname as user_nickname,
        a.agent_code
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN agents a ON u.agent_id = a.id
      ${whereClause}
      ORDER BY o.created_time DESC
      LIMIT ? OFFSET ?
    `;
    
    const orders = await query(sql, [...params, parseInt(limit), offset]);

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
 * 获取代理列表
 */
const getAgents = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      keyword, 
      status
    } = req.query;

    // 构建查询条件
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (keyword) {
      whereClause += ' AND (a.agent_code LIKE ? OR u.phone LIKE ? OR u.nickname LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (status) {
      whereClause += ' AND a.status = ?';
      params.push(status);
    }

    // 获取总数
    const countSql = `
      SELECT COUNT(*) as total 
      FROM agents a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereClause}
    `;
    const countResult = await queryOne(countSql, params);
    const total = countResult.total;

    // 获取分页数据
    const offset = (page - 1) * limit;
    const sql = `
      SELECT 
        a.*,
        u.phone as user_phone,
        u.nickname as user_nickname,
        (SELECT COUNT(*) FROM users WHERE agent_id = a.id) as user_count,
        (SELECT COALESCE(SUM(amount), 0) FROM orders o JOIN users u2 ON o.user_id = u2.id WHERE u2.agent_id = a.id AND o.status = 'completed') as total_sales
      FROM agents a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereClause}
      ORDER BY a.created_time DESC
      LIMIT ? OFFSET ?
    `;
    
    const agents = await query(sql, [...params, parseInt(limit), offset]);

    res.json({
      success: true,
      data: {
        agents,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('获取代理列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取代理列表失败'
    });
  }
};

/**
 * 创建代理
 */
const createAgent = async (req, res) => {
  try {
    const { user_id, commission_rate } = req.body;

    // 验证参数
    if (!user_id || !commission_rate) {
      return res.status(400).json({
        success: false,
        message: '用户ID和佣金比例不能为空'
      });
    }

    if (commission_rate < 0 || commission_rate > 1) {
      return res.status(400).json({
        success: false,
        message: '佣金比例必须在0-1之间'
      });
    }

    // 检查用户是否存在
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查用户是否已经是代理
    const existingAgent = await queryOne(`
      SELECT id FROM agents WHERE user_id = ?
    `, [user_id]);

    if (existingAgent) {
      return res.status(400).json({
        success: false,
        message: '该用户已经是代理'
      });
    }

    // 生成代理码
    const agentCode = await generateUniqueAgentCode();

    // 创建代理
    const agentId = await insert('agents', {
      user_id,
      agent_code: agentCode,
      commission_rate,
      total_commission: 0,
      pending_commission: 0,
      withdrawn_commission: 0,
      status: 'active',
      created_time: new Date()
    });

    logger.logAgentAction(agentId, 'created', {
      admin_id: req.user.id,
      user_id,
      commission_rate
    });

    res.json({
      success: true,
      message: '代理创建成功',
      data: {
        agent_id: agentId,
        agent_code: agentCode
      }
    });
  } catch (error) {
    logger.error('创建代理失败:', error);
    res.status(500).json({
      success: false,
      message: '创建代理失败'
    });
  }
};

/**
 * 更新代理信息
 */
const updateAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { commission_rate, status } = req.body;

    const agent = await queryOne(`
      SELECT * FROM agents WHERE id = ?
    `, [agentId]);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: '代理不存在'
      });
    }

    const updateData = {};
    if (commission_rate !== undefined) {
      if (commission_rate < 0 || commission_rate > 1) {
        return res.status(400).json({
          success: false,
          message: '佣金比例必须在0-1之间'
        });
      }
      updateData.commission_rate = commission_rate;
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    updateData.updated_time = new Date();

    await update('agents', updateData, { id: agentId });

    logger.logAgentAction(agentId, 'updated', {
      admin_id: req.user.id,
      changes: updateData
    });

    res.json({
      success: true,
      message: '代理信息更新成功'
    });
  } catch (error) {
    logger.error('更新代理信息失败:', error);
    res.status(500).json({
      success: false,
      message: '更新代理信息失败'
    });
  }
};

/**
 * 获取系统配置
 */
const getSystemConfig = async (req, res) => {
  try {
    const configs = await query(`
      SELECT config_key, config_value, description
      FROM system_configs
      ORDER BY config_key
    `);

    const configMap = configs.reduce((acc, config) => {
      acc[config.config_key] = {
        value: config.config_value,
        description: config.description
      };
      return acc;
    }, {});

    res.json({
      success: true,
      data: configMap
    });
  } catch (error) {
    logger.error('获取系统配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统配置失败'
    });
  }
};

/**
 * 更新系统配置
 */
const updateSystemConfig = async (req, res) => {
  try {
    const { configs } = req.body;

    if (!configs || typeof configs !== 'object') {
      return res.status(400).json({
        success: false,
        message: '配置数据格式错误'
      });
    }

    // 更新配置
    for (const [key, value] of Object.entries(configs)) {
      await query(`
        INSERT INTO system_configs (config_key, config_value, updated_time)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
        config_value = VALUES(config_value),
        updated_time = VALUES(updated_time)
      `, [key, value]);
    }

    // 清除配置缓存
    await cache.del('system_configs');

    logger.logSystemEvent('config_updated', {
      admin_id: req.user.id,
      configs: Object.keys(configs)
    });

    res.json({
      success: true,
      message: '系统配置更新成功'
    });
  } catch (error) {
    logger.error('更新系统配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新系统配置失败'
    });
  }
};

/**
 * 发送系统通知
 */
const sendSystemNotification = async (req, res) => {
  try {
    const { title, content, type = 'info', target_users = 'all' } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: '标题和内容不能为空'
      });
    }

    // 创建通知记录
    const notificationId = await insert('system_notifications', {
      title,
      content,
      type,
      target_users,
      admin_id: req.user.id,
      created_time: new Date()
    });

    // 发送实时通知
    const io = req.app.get('io');
    
    if (target_users === 'all') {
      io.emit('system_notification', {
        id: notificationId,
        title,
        content,
        type,
        created_time: new Date()
      });
    } else if (Array.isArray(target_users)) {
      // 发送给指定用户
      for (const userId of target_users) {
        io.to(`user_${userId}`).emit('system_notification', {
          id: notificationId,
          title,
          content,
          type,
          created_time: new Date()
        });
      }
    }

    logger.logSystemEvent('notification_sent', {
      admin_id: req.user.id,
      notification_id: notificationId,
      target_users
    });

    res.json({
      success: true,
      message: '系统通知发送成功',
      data: {
        notification_id: notificationId
      }
    });
  } catch (error) {
    logger.error('发送系统通知失败:', error);
    res.status(500).json({
      success: false,
      message: '发送系统通知失败'
    });
  }
};

module.exports = {
  getSystemStats,
  getUsers,
  updateUser,
  deleteUser,
  getDevices,
  controlDevice,
  getOrders,
  getAgents,
  createAgent,
  updateAgent,
  getSystemConfig,
  updateSystemConfig,
  sendSystemNotification
};