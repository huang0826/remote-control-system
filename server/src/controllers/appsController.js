/**
 * 应用管理控制器
 */

const { query, queryOne, insert, update, deleteRecord } = require('../database/connection');
const redis = require('../utils/redis');
const logger = require('../utils/logger');
const { getSocketIO } = require('../socket/socketManager');
const Device = require('../models/Device');

/**
 * 获取设备应用列表
 */
const getDeviceApps = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { category = 'all', status = 'all', keyword, page = 1, limit = 20 } = req.query;
    
    // 检查设备是否存在
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }
    
    // 构建查询条件
    let whereClause = 'WHERE device_id = ?';
    const params = [deviceId];
    
    if (category !== 'all') {
      whereClause += ' AND app_type = ?';
      params.push(category);
    }
    
    if (status !== 'all') {
      whereClause += ' AND enabled = ?';
      params.push(status === 'enabled');
    }
    
    if (keyword) {
      whereClause += ' AND (app_name LIKE ? OR package_name LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    // 获取总数
    const countResult = await queryOne(`
      SELECT COUNT(*) as total 
      FROM device_apps 
      ${whereClause}
    `, params);
    const total = countResult.total;
    
    // 获取分页数据
    const offset = (page - 1) * limit;
    const apps = await query(`
      SELECT *
      FROM device_apps
      ${whereClause}
      ORDER BY app_name ASC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
    
    res.json({
      success: true,
      data: {
        apps: apps.map(app => ({
          ...app,
          permissions: app.permissions ? JSON.parse(app.permissions) : [],
          app_info: app.app_info ? JSON.parse(app.app_info) : {}
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
    logger.error('获取设备应用列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取应用列表失败'
    });
  }
};

/**
 * 获取应用详情
 */
const getAppDetails = async (req, res) => {
  try {
    const { deviceId, packageName } = req.params;
    
    const app = await queryOne(`
      SELECT *
      FROM device_apps
      WHERE device_id = ? AND package_name = ?
    `, [deviceId, packageName]);
    
    if (!app) {
      return res.status(404).json({
        success: false,
        message: '应用不存在'
      });
    }
    
    // 获取应用使用统计
    const usageStats = await queryOne(`
      SELECT 
        SUM(usage_time) as total_usage_time,
        COUNT(*) as launch_count,
        MAX(last_used) as last_used
      FROM app_usage_records
      WHERE device_id = ? AND package_name = ?
        AND DATE(created_time) >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `, [deviceId, packageName]);
    
    res.json({
      success: true,
      data: {
        app: {
          ...app,
          permissions: app.permissions ? JSON.parse(app.permissions) : [],
          app_info: app.app_info ? JSON.parse(app.app_info) : {},
          usage_stats: usageStats
        }
      }
    });
  } catch (error) {
    logger.error('获取应用详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取应用详情失败'
    });
  }
};

/**
 * 启动应用
 */
const launchApp = async (req, res) => {
  try {
    const { deviceId, packageName } = req.params;
    
    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }
    
    // 生成任务ID
    const taskId = `launch_app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 发送启动应用指令
    const command = {
      type: 'launch_app',
      task_id: taskId,
      package_name: packageName,
      timestamp: new Date().toISOString()
    };
    
    const io = getSocketIO();
    io.to(`device:${deviceId}`).emit('app_command', command);
    
    // 记录操作日志
    await insert('device_operation_logs', {
      device_id: deviceId,
      user_id: req.user.id,
      operation_type: 'launch_app',
      operation_data: JSON.stringify({ package_name: packageName }),
      task_id: taskId,
      created_time: new Date()
    });
    
    // 缓存任务信息
    await redis.setex(`task:${taskId}`, 300, JSON.stringify({
      type: 'launch_app',
      device_id: deviceId,
      user_id: req.user.id,
      package_name: packageName,
      status: 'pending',
      created_time: new Date()
    }));
    
    logger.info(`用户 ${req.user.id} 启动设备 ${deviceId} 应用 ${packageName}`, { task_id: taskId });
    
    res.json({
      success: true,
      message: '应用启动指令已发送',
      data: {
        task_id: taskId
      }
    });
  } catch (error) {
    logger.error('启动应用失败:', error);
    res.status(500).json({
      success: false,
      message: '启动应用失败'
    });
  }
};

/**
 * 停止应用
 */
const stopApp = async (req, res) => {
  try {
    const { deviceId, packageName } = req.params;
    
    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }
    
    // 生成任务ID
    const taskId = `stop_app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 发送停止应用指令
    const command = {
      type: 'stop_app',
      task_id: taskId,
      package_name: packageName,
      timestamp: new Date().toISOString()
    };
    
    const io = getSocketIO();
    io.to(`device:${deviceId}`).emit('app_command', command);
    
    // 记录操作日志
    await insert('device_operation_logs', {
      device_id: deviceId,
      user_id: req.user.id,
      operation_type: 'stop_app',
      operation_data: JSON.stringify({ package_name: packageName }),
      task_id: taskId,
      created_time: new Date()
    });
    
    // 缓存任务信息
    await redis.setex(`task:${taskId}`, 300, JSON.stringify({
      type: 'stop_app',
      device_id: deviceId,
      user_id: req.user.id,
      package_name: packageName,
      status: 'pending',
      created_time: new Date()
    }));
    
    logger.info(`用户 ${req.user.id} 停止设备 ${deviceId} 应用 ${packageName}`, { task_id: taskId });
    
    res.json({
      success: true,
      message: '应用停止指令已发送',
      data: {
        task_id: taskId
      }
    });
  } catch (error) {
    logger.error('停止应用失败:', error);
    res.status(500).json({
      success: false,
      message: '停止应用失败'
    });
  }
};

/**
 * 卸载应用
 */
const uninstallApp = async (req, res) => {
  try {
    const { deviceId, packageName } = req.params;
    
    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }
    
    // 检查是否为系统应用
    const app = await queryOne(`
      SELECT app_type
      FROM device_apps
      WHERE device_id = ? AND package_name = ?
    `, [deviceId, packageName]);
    
    if (app && app.app_type === 'system') {
      return res.status(400).json({
        success: false,
        message: '系统应用无法卸载'
      });
    }
    
    // 生成任务ID
    const taskId = `uninstall_app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 发送卸载应用指令
    const command = {
      type: 'uninstall_app',
      task_id: taskId,
      package_name: packageName,
      timestamp: new Date().toISOString()
    };
    
    const io = getSocketIO();
    io.to(`device:${deviceId}`).emit('app_command', command);
    
    // 记录操作日志
    await insert('device_operation_logs', {
      device_id: deviceId,
      user_id: req.user.id,
      operation_type: 'uninstall_app',
      operation_data: JSON.stringify({ package_name: packageName }),
      task_id: taskId,
      created_time: new Date()
    });
    
    // 缓存任务信息
    await redis.setex(`task:${taskId}`, 300, JSON.stringify({
      type: 'uninstall_app',
      device_id: deviceId,
      user_id: req.user.id,
      package_name: packageName,
      status: 'pending',
      created_time: new Date()
    }));
    
    logger.info(`用户 ${req.user.id} 卸载设备 ${deviceId} 应用 ${packageName}`, { task_id: taskId });
    
    res.json({
      success: true,
      message: '应用卸载指令已发送',
      data: {
        task_id: taskId
      }
    });
  } catch (error) {
    logger.error('卸载应用失败:', error);
    res.status(500).json({
      success: false,
      message: '卸载应用失败'
    });
  }
};

/**
 * 安装应用
 */
const installApp = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { app_url, package_name, install_type } = req.body;
    
    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }
    
    // 生成任务ID
    const taskId = `install_app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 发送安装应用指令
    const command = {
      type: 'install_app',
      task_id: taskId,
      install_type,
      app_url,
      package_name,
      timestamp: new Date().toISOString()
    };
    
    const io = getSocketIO();
    io.to(`device:${deviceId}`).emit('app_command', command);
    
    // 记录操作日志
    await insert('device_operation_logs', {
      device_id: deviceId,
      user_id: req.user.id,
      operation_type: 'install_app',
      operation_data: JSON.stringify({ install_type, app_url, package_name }),
      task_id: taskId,
      created_time: new Date()
    });
    
    // 缓存任务信息
    await redis.setex(`task:${taskId}`, 600, JSON.stringify({
      type: 'install_app',
      device_id: deviceId,
      user_id: req.user.id,
      install_type,
      app_url,
      package_name,
      status: 'pending',
      created_time: new Date()
    }));
    
    logger.info(`用户 ${req.user.id} 安装设备 ${deviceId} 应用`, { task_id: taskId, install_type, package_name });
    
    res.json({
      success: true,
      message: '应用安装指令已发送',
      data: {
        task_id: taskId
      }
    });
  } catch (error) {
    logger.error('安装应用失败:', error);
    res.status(500).json({
      success: false,
      message: '安装应用失败'
    });
  }
};

/**
 * 禁用应用
 */
const disableApp = async (req, res) => {
  try {
    const { deviceId, packageName } = req.params;
    
    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }
    
    // 生成任务ID
    const taskId = `disable_app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 发送禁用应用指令
    const command = {
      type: 'disable_app',
      task_id: taskId,
      package_name: packageName,
      timestamp: new Date().toISOString()
    };
    
    const io = getSocketIO();
    io.to(`device:${deviceId}`).emit('app_command', command);
    
    // 更新本地记录
    await update('device_apps', {
      enabled: false,
      updated_time: new Date()
    }, {
      device_id: deviceId,
      package_name: packageName
    });
    
    // 记录操作日志
    await insert('device_operation_logs', {
      device_id: deviceId,
      user_id: req.user.id,
      operation_type: 'disable_app',
      operation_data: JSON.stringify({ package_name: packageName }),
      task_id: taskId,
      created_time: new Date()
    });
    
    logger.info(`用户 ${req.user.id} 禁用设备 ${deviceId} 应用 ${packageName}`, { task_id: taskId });
    
    res.json({
      success: true,
      message: '应用已禁用',
      data: {
        task_id: taskId
      }
    });
  } catch (error) {
    logger.error('禁用应用失败:', error);
    res.status(500).json({
      success: false,
      message: '禁用应用失败'
    });
  }
};

/**
 * 启用应用
 */
const enableApp = async (req, res) => {
  try {
    const { deviceId, packageName } = req.params;
    
    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }
    
    // 生成任务ID
    const taskId = `enable_app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 发送启用应用指令
    const command = {
      type: 'enable_app',
      task_id: taskId,
      package_name: packageName,
      timestamp: new Date().toISOString()
    };
    
    const io = getSocketIO();
    io.to(`device:${deviceId}`).emit('app_command', command);
    
    // 更新本地记录
    await update('device_apps', {
      enabled: true,
      updated_time: new Date()
    }, {
      device_id: deviceId,
      package_name: packageName
    });
    
    // 记录操作日志
    await insert('device_operation_logs', {
      device_id: deviceId,
      user_id: req.user.id,
      operation_type: 'enable_app',
      operation_data: JSON.stringify({ package_name: packageName }),
      task_id: taskId,
      created_time: new Date()
    });
    
    logger.info(`用户 ${req.user.id} 启用设备 ${deviceId} 应用 ${packageName}`, { task_id: taskId });
    
    res.json({
      success: true,
      message: '应用已启用',
      data: {
        task_id: taskId
      }
    });
  } catch (error) {
    logger.error('启用应用失败:', error);
    res.status(500).json({
      success: false,
      message: '启用应用失败'
    });
  }
};

/**
 * 清除应用数据
 */
const clearAppData = async (req, res) => {
  try {
    const { deviceId, packageName } = req.params;
    
    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }
    
    // 生成任务ID
    const taskId = `clear_app_data_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 发送清除数据指令
    const command = {
      type: 'clear_app_data',
      task_id: taskId,
      package_name: packageName,
      timestamp: new Date().toISOString()
    };
    
    const io = getSocketIO();
    io.to(`device:${deviceId}`).emit('app_command', command);
    
    // 记录操作日志
    await insert('device_operation_logs', {
      device_id: deviceId,
      user_id: req.user.id,
      operation_type: 'clear_app_data',
      operation_data: JSON.stringify({ package_name: packageName }),
      task_id: taskId,
      created_time: new Date()
    });
    
    logger.info(`用户 ${req.user.id} 清除设备 ${deviceId} 应用 ${packageName} 数据`, { task_id: taskId });
    
    res.json({
      success: true,
      message: '应用数据清除指令已发送',
      data: {
        task_id: taskId
      }
    });
  } catch (error) {
    logger.error('清除应用数据失败:', error);
    res.status(500).json({
      success: false,
      message: '清除应用数据失败'
    });
  }
};

/**
 * 清除应用缓存
 */
const clearAppCache = async (req, res) => {
  try {
    const { deviceId, packageName } = req.params;
    
    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }
    
    // 生成任务ID
    const taskId = `clear_app_cache_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 发送清除缓存指令
    const command = {
      type: 'clear_app_cache',
      task_id: taskId,
      package_name: packageName,
      timestamp: new Date().toISOString()
    };
    
    const io = getSocketIO();
    io.to(`device:${deviceId}`).emit('app_command', command);
    
    // 记录操作日志
    await insert('device_operation_logs', {
      device_id: deviceId,
      user_id: req.user.id,
      operation_type: 'clear_app_cache',
      operation_data: JSON.stringify({ package_name: packageName }),
      task_id: taskId,
      created_time: new Date()
    });
    
    logger.info(`用户 ${req.user.id} 清除设备 ${deviceId} 应用 ${packageName} 缓存`, { task_id: taskId });
    
    res.json({
      success: true,
      message: '应用缓存清除指令已发送',
      data: {
        task_id: taskId
      }
    });
  } catch (error) {
    logger.error('清除应用缓存失败:', error);
    res.status(500).json({
      success: false,
      message: '清除应用缓存失败'
    });
  }
};

/**
 * 获取应用权限
 */
const getAppPermissions = async (req, res) => {
  try {
    const { deviceId, packageName } = req.params;
    
    const app = await queryOne(`
      SELECT permissions
      FROM device_apps
      WHERE device_id = ? AND package_name = ?
    `, [deviceId, packageName]);
    
    if (!app) {
      return res.status(404).json({
        success: false,
        message: '应用不存在'
      });
    }
    
    const permissions = app.permissions ? JSON.parse(app.permissions) : [];
    
    res.json({
      success: true,
      data: {
        permissions
      }
    });
  } catch (error) {
    logger.error('获取应用权限失败:', error);
    res.status(500).json({
      success: false,
      message: '获取应用权限失败'
    });
  }
};

/**
 * 设置应用权限
 */
const setAppPermissions = async (req, res) => {
  try {
    const { deviceId, packageName } = req.params;
    const { permissions } = req.body;
    
    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }
    
    // 生成任务ID
    const taskId = `set_app_permissions_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 发送设置权限指令
    const command = {
      type: 'set_app_permissions',
      task_id: taskId,
      package_name: packageName,
      permissions,
      timestamp: new Date().toISOString()
    };
    
    const io = getSocketIO();
    io.to(`device:${deviceId}`).emit('app_command', command);
    
    // 更新本地记录
    await update('device_apps', {
      permissions: JSON.stringify(permissions),
      updated_time: new Date()
    }, {
      device_id: deviceId,
      package_name: packageName
    });
    
    // 记录操作日志
    await insert('device_operation_logs', {
      device_id: deviceId,
      user_id: req.user.id,
      operation_type: 'set_app_permissions',
      operation_data: JSON.stringify({ package_name: packageName, permissions }),
      task_id: taskId,
      created_time: new Date()
    });
    
    logger.info(`用户 ${req.user.id} 设置设备 ${deviceId} 应用 ${packageName} 权限`, { task_id: taskId });
    
    res.json({
      success: true,
      message: '应用权限设置指令已发送',
      data: {
        task_id: taskId
      }
    });
  } catch (error) {
    logger.error('设置应用权限失败:', error);
    res.status(500).json({
      success: false,
      message: '设置应用权限失败'
    });
  }
};

/**
 * 获取应用使用统计
 */
const getAppUsage = async (req, res) => {
  try {
    const { deviceId, packageName } = req.params;
    const { start_date, end_date } = req.query;
    
    // 构建查询条件
    let whereClause = 'WHERE device_id = ? AND package_name = ?';
    const params = [deviceId, packageName];
    
    if (start_date) {
      whereClause += ' AND DATE(created_time) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      whereClause += ' AND DATE(created_time) <= ?';
      params.push(end_date);
    }
    
    // 获取使用统计
    const usageStats = await query(`
      SELECT 
        DATE(created_time) as date,
        SUM(usage_time) as total_usage_time,
        COUNT(*) as launch_count,
        AVG(usage_time) as avg_usage_time
      FROM app_usage_records
      ${whereClause}
      GROUP BY DATE(created_time)
      ORDER BY date DESC
      LIMIT 30
    `, params);
    
    // 获取总体统计
    const overallStats = await queryOne(`
      SELECT 
        SUM(usage_time) as total_usage_time,
        COUNT(*) as total_launches,
        AVG(usage_time) as avg_usage_time,
        MAX(last_used) as last_used
      FROM app_usage_records
      ${whereClause}
    `, params);
    
    res.json({
      success: true,
      data: {
        overall_stats: overallStats,
        daily_stats: usageStats
      }
    });
  } catch (error) {
    logger.error('获取应用使用统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取应用使用统计失败'
    });
  }
};

/**
 * 获取设备应用使用统计
 */
const getDeviceAppUsageStats = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { period = 'today', limit = 10 } = req.query;
    
    let dateCondition = '';
    switch (period) {
      case 'today':
        dateCondition = 'AND DATE(created_time) = CURDATE()';
        break;
      case 'week':
        dateCondition = 'AND created_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        break;
      case 'month':
        dateCondition = 'AND created_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        break;
    }
    
    // 获取应用使用排行
    const appUsageRanking = await query(`
      SELECT 
        aur.package_name,
        da.app_name,
        da.app_icon,
        SUM(aur.usage_time) as total_usage_time,
        COUNT(*) as launch_count,
        MAX(aur.last_used) as last_used
      FROM app_usage_records aur
      LEFT JOIN device_apps da ON aur.device_id = da.device_id AND aur.package_name = da.package_name
      WHERE aur.device_id = ? ${dateCondition}
      GROUP BY aur.package_name
      ORDER BY total_usage_time DESC
      LIMIT ?
    `, [deviceId, parseInt(limit)]);
    
    // 获取总体统计
    const totalStats = await queryOne(`
      SELECT 
        SUM(usage_time) as total_usage_time,
        COUNT(DISTINCT package_name) as active_apps,
        COUNT(*) as total_launches
      FROM app_usage_records
      WHERE device_id = ? ${dateCondition}
    `, [deviceId]);
    
    res.json({
      success: true,
      data: {
        period,
        total_stats: totalStats,
        app_ranking: appUsageRanking
      }
    });
  } catch (error) {
    logger.error('获取设备应用使用统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取设备应用使用统计失败'
    });
  }
};

/**
 * 设置应用限制
 */
const setAppRestrictions = async (req, res) => {
  try {
    const { deviceId, packageName } = req.params;
    const { time_limit, blocked_times, allowed_days, password_required } = req.body;
    
    // 检查是否已有限制记录
    const existingRestriction = await queryOne(`
      SELECT id
      FROM app_restrictions
      WHERE device_id = ? AND package_name = ?
    `, [deviceId, packageName]);
    
    const restrictionData = {
      device_id: deviceId,
      package_name: packageName,
      time_limit,
      blocked_times: blocked_times ? JSON.stringify(blocked_times) : null,
      allowed_days: allowed_days ? JSON.stringify(allowed_days) : null,
      password_required: password_required || false,
      enabled: true,
      updated_time: new Date()
    };
    
    if (existingRestriction) {
      // 更新现有限制
      await update('app_restrictions', restrictionData, { id: existingRestriction.id });
    } else {
      // 创建新限制
      restrictionData.created_time = new Date();
      await insert('app_restrictions', restrictionData);
    }
    
    // 发送限制设置指令到设备
    const command = {
      type: 'set_app_restrictions',
      package_name: packageName,
      restrictions: restrictionData,
      timestamp: new Date().toISOString()
    };
    
    const io = getSocketIO();
    io.to(`device:${deviceId}`).emit('app_command', command);
    
    logger.info(`用户 ${req.user.id} 设置设备 ${deviceId} 应用 ${packageName} 限制`);
    
    res.json({
      success: true,
      message: '应用限制已设置'
    });
  } catch (error) {
    logger.error('设置应用限制失败:', error);
    res.status(500).json({
      success: false,
      message: '设置应用限制失败'
    });
  }
};

/**
 * 获取应用限制
 */
const getAppRestrictions = async (req, res) => {
  try {
    const { deviceId, packageName } = req.params;
    
    const restriction = await queryOne(`
      SELECT *
      FROM app_restrictions
      WHERE device_id = ? AND package_name = ?
    `, [deviceId, packageName]);
    
    if (!restriction) {
      return res.json({
        success: true,
        data: {
          restrictions: null
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        restrictions: {
          ...restriction,
          blocked_times: restriction.blocked_times ? JSON.parse(restriction.blocked_times) : [],
          allowed_days: restriction.allowed_days ? JSON.parse(restriction.allowed_days) : []
        }
      }
    });
  } catch (error) {
    logger.error('获取应用限制失败:', error);
    res.status(500).json({
      success: false,
      message: '获取应用限制失败'
    });
  }
};

/**
 * 移除应用限制
 */
const removeAppRestrictions = async (req, res) => {
  try {
    const { deviceId, packageName } = req.params;
    
    // 删除限制记录
    await deleteRecord('app_restrictions', {
      device_id: deviceId,
      package_name: packageName
    });
    
    // 发送移除限制指令到设备
    const command = {
      type: 'remove_app_restrictions',
      package_name: packageName,
      timestamp: new Date().toISOString()
    };
    
    const io = getSocketIO();
    io.to(`device:${deviceId}`).emit('app_command', command);
    
    logger.info(`用户 ${req.user.id} 移除设备 ${deviceId} 应用 ${packageName} 限制`);
    
    res.json({
      success: true,
      message: '应用限制已移除'
    });
  } catch (error) {
    logger.error('移除应用限制失败:', error);
    res.status(500).json({
      success: false,
      message: '移除应用限制失败'
    });
  }
};

/**
 * 批量操作应用
 */
const batchAppOperation = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { action, package_names } = req.body;
    
    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }
    
    // 生成任务ID
    const taskId = `batch_app_${action}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 发送批量操作指令
    const command = {
      type: 'batch_app_operation',
      task_id: taskId,
      action,
      package_names,
      timestamp: new Date().toISOString()
    };
    
    const io = getSocketIO();
    io.to(`device:${deviceId}`).emit('app_command', command);
    
    // 记录操作日志
    await insert('device_operation_logs', {
      device_id: deviceId,
      user_id: req.user.id,
      operation_type: `batch_app_${action}`,
      operation_data: JSON.stringify({ package_names }),
      task_id: taskId,
      created_time: new Date()
    });
    
    logger.info(`用户 ${req.user.id} 批量${action}设备 ${deviceId} 应用`, { task_id: taskId, count: package_names.length });
    
    res.json({
      success: true,
      message: `批量${action}指令已发送`,
      data: {
        task_id: taskId,
        affected_count: package_names.length
      }
    });
  } catch (error) {
    logger.error('批量操作应用失败:', error);
    res.status(500).json({
      success: false,
      message: '批量操作应用失败'
    });
  }
};

/**
 * 搜索应用商店应用
 */
const searchStoreApps = async (req, res) => {
  try {
    const { keyword, category, page = 1, limit = 20 } = req.query;
    
    // 构建查询条件
    let whereClause = 'WHERE status = "active"';
    const params = [];
    
    if (keyword) {
      whereClause += ' AND (app_name LIKE ? OR description LIKE ? OR tags LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    
    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }
    
    // 获取总数
    const countResult = await queryOne(`
      SELECT COUNT(*) as total 
      FROM app_store 
      ${whereClause}
    `, params);
    const total = countResult.total;
    
    // 获取分页数据
    const offset = (page - 1) * limit;
    const apps = await query(`
      SELECT *
      FROM app_store
      ${whereClause}
      ORDER BY download_count DESC, rating DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
    
    res.json({
      success: true,
      data: {
        apps: apps.map(app => ({
          ...app,
          screenshots: app.screenshots ? JSON.parse(app.screenshots) : [],
          features: app.features ? JSON.parse(app.features) : []
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
    logger.error('搜索应用商店应用失败:', error);
    res.status(500).json({
      success: false,
      message: '搜索应用失败'
    });
  }
};

/**
 * 获取应用商店分类
 */
const getStoreCategories = async (req, res) => {
  try {
    const categories = await query(`
      SELECT 
        category,
        COUNT(*) as app_count
      FROM app_store
      WHERE status = 'active'
      GROUP BY category
      ORDER BY app_count DESC
    `);
    
    res.json({
      success: true,
      data: {
        categories
      }
    });
  } catch (error) {
    logger.error('获取应用商店分类失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分类失败'
    });
  }
};

/**
 * 获取推荐应用
 */
const getFeaturedApps = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const apps = await query(`
      SELECT *
      FROM app_store
      WHERE status = 'active' AND featured = true
      ORDER BY rating DESC, download_count DESC
      LIMIT ?
    `, [parseInt(limit)]);
    
    res.json({
      success: true,
      data: {
        apps: apps.map(app => ({
          ...app,
          screenshots: app.screenshots ? JSON.parse(app.screenshots) : [],
          features: app.features ? JSON.parse(app.features) : []
        }))
      }
    });
  } catch (error) {
    logger.error('获取推荐应用失败:', error);
    res.status(500).json({
      success: false,
      message: '获取推荐应用失败'
    });
  }
};

/**
 * 获取应用更新列表
 */
const getAppUpdates = async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    // 获取设备上有更新的应用
    const updates = await query(`
      SELECT 
        da.package_name,
        da.app_name,
        da.version_name as current_version,
        da.version_code as current_version_code,
        asu.latest_version,
        asu.latest_version_code,
        asu.update_size,
        asu.update_description,
        asu.release_date
      FROM device_apps da
      INNER JOIN app_store_updates asu ON da.package_name = asu.package_name
      WHERE da.device_id = ? 
        AND da.version_code < asu.latest_version_code
        AND da.enabled = true
      ORDER BY asu.release_date DESC
    `, [deviceId]);
    
    res.json({
      success: true,
      data: {
        updates,
        total_updates: updates.length
      }
    });
  } catch (error) {
    logger.error('获取应用更新列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取应用更新列表失败'
    });
  }
};

/**
 * 更新应用
 */
const updateApp = async (req, res) => {
  try {
    const { deviceId, packageName } = req.params;
    
    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }
    
    // 获取更新信息
    const updateInfo = await queryOne(`
      SELECT *
      FROM app_store_updates
      WHERE package_name = ?
    `, [packageName]);
    
    if (!updateInfo) {
      return res.status(404).json({
        success: false,
        message: '未找到应用更新信息'
      });
    }
    
    // 生成任务ID
    const taskId = `update_app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 发送更新应用指令
    const command = {
      type: 'update_app',
      task_id: taskId,
      package_name: packageName,
      update_url: updateInfo.download_url,
      target_version: updateInfo.latest_version,
      timestamp: new Date().toISOString()
    };
    
    const io = getSocketIO();
    io.to(`device:${deviceId}`).emit('app_command', command);
    
    // 记录操作日志
    await insert('device_operation_logs', {
      device_id: deviceId,
      user_id: req.user.id,
      operation_type: 'update_app',
      operation_data: JSON.stringify({ package_name: packageName, target_version: updateInfo.latest_version }),
      task_id: taskId,
      created_time: new Date()
    });
    
    logger.info(`用户 ${req.user.id} 更新设备 ${deviceId} 应用 ${packageName}`, { task_id: taskId });
    
    res.json({
      success: true,
      message: '应用更新指令已发送',
      data: {
        task_id: taskId,
        target_version: updateInfo.latest_version
      }
    });
  } catch (error) {
    logger.error('更新应用失败:', error);
    res.status(500).json({
      success: false,
      message: '更新应用失败'
    });
  }
};

/**
 * 批量更新应用
 */
const batchUpdateApps = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { package_names, auto_update = false } = req.body;
    
    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }
    
    let targetPackages = package_names;
    
    // 如果没有指定包名，获取所有有更新的应用
    if (!targetPackages || targetPackages.length === 0) {
      const updates = await query(`
        SELECT da.package_name
        FROM device_apps da
        INNER JOIN app_store_updates asu ON da.package_name = asu.package_name
        WHERE da.device_id = ? 
          AND da.version_code < asu.latest_version_code
          AND da.enabled = true
      `, [deviceId]);
      
      targetPackages = updates.map(update => update.package_name);
    }
    
    if (targetPackages.length === 0) {
      return res.json({
        success: true,
        message: '没有需要更新的应用',
        data: {
          updated_count: 0
        }
      });
    }
    
    // 生成任务ID
    const taskId = `batch_update_apps_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 发送批量更新指令
    const command = {
      type: 'batch_update_apps',
      task_id: taskId,
      package_names: targetPackages,
      auto_update,
      timestamp: new Date().toISOString()
    };
    
    const io = getSocketIO();
    io.to(`device:${deviceId}`).emit('app_command', command);
    
    // 记录操作日志
    await insert('device_operation_logs', {
      device_id: deviceId,
      user_id: req.user.id,
      operation_type: 'batch_update_apps',
      operation_data: JSON.stringify({ package_names: targetPackages, auto_update }),
      task_id: taskId,
      created_time: new Date()
    });
    
    logger.info(`用户 ${req.user.id} 批量更新设备 ${deviceId} 应用`, { task_id: taskId, count: targetPackages.length });
    
    res.json({
      success: true,
      message: '批量更新指令已发送',
      data: {
        task_id: taskId,
        updated_count: targetPackages.length
      }
    });
  } catch (error) {
    logger.error('批量更新应用失败:', error);
    res.status(500).json({
      success: false,
      message: '批量更新应用失败'
    });
  }
};

/**
 * 获取应用安装历史
 */
const getInstallHistory = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { start_date, end_date, action, page = 1, limit = 20 } = req.query;
    
    // 构建查询条件
    let whereClause = 'WHERE device_id = ?';
    const params = [deviceId];
    
    if (start_date) {
      whereClause += ' AND DATE(created_time) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      whereClause += ' AND DATE(created_time) <= ?';
      params.push(end_date);
    }
    
    if (action) {
      whereClause += ' AND action = ?';
      params.push(action);
    }
    
    // 获取总数
    const countResult = await queryOne(`
      SELECT COUNT(*) as total 
      FROM app_install_history 
      ${whereClause}
    `, params);
    const total = countResult.total;
    
    // 获取分页数据
    const offset = (page - 1) * limit;
    const history = await query(`
      SELECT *
      FROM app_install_history
      ${whereClause}
      ORDER BY created_time DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
    
    res.json({
      success: true,
      data: {
        history: history.map(record => ({
          ...record,
          app_info: record.app_info ? JSON.parse(record.app_info) : {}
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
    logger.error('获取应用安装历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取应用安装历史失败'
    });
  }
};

/**
 * 创建应用快捷方式
 */
const createAppShortcut = async (req, res) => {
  try {
    const { deviceId, packageName } = req.params;
    const { shortcut_name, icon_url, target_activity } = req.body;
    
    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }
    
    // 创建快捷方式记录
    const shortcutId = await insert('app_shortcuts', {
      device_id: deviceId,
      package_name: packageName,
      shortcut_name,
      icon_url,
      target_activity,
      created_by: req.user.id,
      created_time: new Date()
    });
    
    // 生成任务ID
    const taskId = `create_shortcut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 发送创建快捷方式指令
    const command = {
      type: 'create_app_shortcut',
      task_id: taskId,
      shortcut_id: shortcutId,
      package_name: packageName,
      shortcut_name,
      icon_url,
      target_activity,
      timestamp: new Date().toISOString()
    };
    
    const io = getSocketIO();
    io.to(`device:${deviceId}`).emit('app_command', command);
    
    logger.info(`用户 ${req.user.id} 为设备 ${deviceId} 应用 ${packageName} 创建快捷方式`, { shortcut_id: shortcutId });
    
    res.json({
      success: true,
      message: '快捷方式创建指令已发送',
      data: {
        shortcut_id: shortcutId,
        task_id: taskId
      }
    });
  } catch (error) {
    logger.error('创建应用快捷方式失败:', error);
    res.status(500).json({
      success: false,
      message: '创建应用快捷方式失败'
    });
  }
};

/**
 * 获取应用快捷方式
 */
const getAppShortcuts = async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const shortcuts = await query(`
      SELECT 
        ash.*,
        da.app_name,
        da.app_icon
      FROM app_shortcuts ash
      LEFT JOIN device_apps da ON ash.device_id = da.device_id AND ash.package_name = da.package_name
      WHERE ash.device_id = ?
      ORDER BY ash.created_time DESC
    `, [deviceId]);
    
    res.json({
      success: true,
      data: {
        shortcuts
      }
    });
  } catch (error) {
    logger.error('获取应用快捷方式失败:', error);
    res.status(500).json({
      success: false,
      message: '获取应用快捷方式失败'
    });
  }
};

/**
 * 删除应用快捷方式
 */
const deleteAppShortcut = async (req, res) => {
  try {
    const { deviceId, shortcutId } = req.params;
    
    // 检查快捷方式是否存在
    const shortcut = await queryOne(`
      SELECT *
      FROM app_shortcuts
      WHERE id = ? AND device_id = ?
    `, [shortcutId, deviceId]);
    
    if (!shortcut) {
      return res.status(404).json({
        success: false,
        message: '快捷方式不存在'
      });
    }
    
    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }
    
    // 删除快捷方式记录
    await deleteRecord('app_shortcuts', { id: shortcutId });
    
    // 生成任务ID
    const taskId = `delete_shortcut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 发送删除快捷方式指令
    const command = {
      type: 'delete_app_shortcut',
      task_id: taskId,
      shortcut_id: shortcutId,
      timestamp: new Date().toISOString()
    };
    
    const io = getSocketIO();
    io.to(`device:${deviceId}`).emit('app_command', command);
    
    logger.info(`用户 ${req.user.id} 删除设备 ${deviceId} 快捷方式 ${shortcutId}`);
    
    res.json({
      success: true,
      message: '快捷方式删除指令已发送',
      data: {
        task_id: taskId
      }
    });
  } catch (error) {
    logger.error('删除应用快捷方式失败:', error);
    res.status(500).json({
      success: false,
      message: '删除应用快捷方式失败'
    });
  }
};

/**
 * 设置默认应用
 */
const setDefaultApp = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { category, package_name } = req.body;
    
    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }
    
    // 检查应用是否存在
    const app = await queryOne(`
      SELECT *
      FROM device_apps
      WHERE device_id = ? AND package_name = ?
    `, [deviceId, package_name]);
    
    if (!app) {
      return res.status(404).json({
        success: false,
        message: '应用不存在'
      });
    }
    
    // 更新或创建默认应用记录
    const existingDefault = await queryOne(`
      SELECT id
      FROM default_apps
      WHERE device_id = ? AND category = ?
    `, [deviceId, category]);
    
    if (existingDefault) {
      await update('default_apps', {
        package_name,
        updated_time: new Date()
      }, { id: existingDefault.id });
    } else {
      await insert('default_apps', {
        device_id: deviceId,
        category,
        package_name,
        created_time: new Date()
      });
    }
    
    // 生成任务ID
    const taskId = `set_default_app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 发送设置默认应用指令
    const command = {
      type: 'set_default_app',
      task_id: taskId,
      category,
      package_name,
      timestamp: new Date().toISOString()
    };
    
    const io = getSocketIO();
    io.to(`device:${deviceId}`).emit('app_command', command);
    
    logger.info(`用户 ${req.user.id} 设置设备 ${deviceId} 默认${category}应用为 ${package_name}`);
    
    res.json({
      success: true,
      message: '默认应用设置指令已发送',
      data: {
        task_id: taskId
      }
    });
  } catch (error) {
    logger.error('设置默认应用失败:', error);
    res.status(500).json({
      success: false,
      message: '设置默认应用失败'
    });
  }
};

/**
 * 获取默认应用
 */
const getDefaultApps = async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const defaultApps = await query(`
      SELECT 
        da.*,
        dapp.app_name,
        dapp.app_icon
      FROM default_apps da
      LEFT JOIN device_apps dapp ON da.device_id = dapp.device_id AND da.package_name = dapp.package_name
      WHERE da.device_id = ?
      ORDER BY da.category
    `, [deviceId]);
    
    res.json({
      success: true,
      data: {
        default_apps: defaultApps
      }
    });
  } catch (error) {
    logger.error('获取默认应用失败:', error);
    res.status(500).json({
      success: false,
      message: '获取默认应用失败'
    });
  }
};

/**
 * 重置默认应用
 */
const resetDefaultApp = async (req, res) => {
  try {
    const { deviceId, category } = req.params;
    
    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }
    
    // 删除默认应用记录
    await deleteRecord('default_apps', {
      device_id: deviceId,
      category
    });
    
    // 生成任务ID
    const taskId = `reset_default_app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 发送重置默认应用指令
    const command = {
      type: 'reset_default_app',
      task_id: taskId,
      category,
      timestamp: new Date().toISOString()
    };
    
    const io = getSocketIO();
    io.to(`device:${deviceId}`).emit('app_command', command);
    
    logger.info(`用户 ${req.user.id} 重置设备 ${deviceId} 默认${category}应用`);
    
    res.json({
      success: true,
      message: '默认应用重置指令已发送',
      data: {
        task_id: taskId
      }
    });
  } catch (error) {
    logger.error('重置默认应用失败:', error);
    res.status(500).json({
      success: false,
      message: '重置默认应用失败'
    });
  }
};

/**
 * 获取应用网络使用情况
 */
const getAppNetworkUsage = async (req, res) => {
  try {
    const { deviceId, packageName } = req.params;
    const { start_date, end_date } = req.query;
    
    // 构建查询条件
    let whereClause = 'WHERE device_id = ? AND package_name = ?';
    const params = [deviceId, packageName];
    
    if (start_date) {
      whereClause += ' AND DATE(created_time) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      whereClause += ' AND DATE(created_time) <= ?';
      params.push(end_date);
    }
    
    // 获取网络使用统计
    const networkUsage = await query(`
      SELECT 
        DATE(created_time) as date,
        SUM(wifi_rx_bytes) as wifi_download,
        SUM(wifi_tx_bytes) as wifi_upload,
        SUM(mobile_rx_bytes) as mobile_download,
        SUM(mobile_tx_bytes) as mobile_upload
      FROM app_network_usage
      ${whereClause}
      GROUP BY DATE(created_time)
      ORDER BY date DESC
      LIMIT 30
    `, params);
    
    // 获取总体统计
    const totalUsage = await queryOne(`
      SELECT 
        SUM(wifi_rx_bytes + mobile_rx_bytes) as total_download,
        SUM(wifi_tx_bytes + mobile_tx_bytes) as total_upload,
        SUM(wifi_rx_bytes + wifi_tx_bytes) as wifi_total,
        SUM(mobile_rx_bytes + mobile_tx_bytes) as mobile_total
      FROM app_network_usage
      ${whereClause}
    `, params);
    
    res.json({
      success: true,
      data: {
        total_usage: totalUsage,
        daily_usage: networkUsage
      }
    });
  } catch (error) {
    logger.error('获取应用网络使用情况失败:', error);
    res.status(500).json({
      success: false,
      message: '获取应用网络使用情况失败'
    });
  }
};

/**
 * 设置应用网络限制
 */
const setAppNetworkRestrictions = async (req, res) => {
  try {
    const { deviceId, packageName } = req.params;
    const { wifi_allowed, mobile_data_allowed, background_data_allowed, data_limit } = req.body;
    
    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }
    
    // 更新或创建网络限制记录
    const existingRestriction = await queryOne(`
      SELECT id
      FROM app_network_restrictions
      WHERE device_id = ? AND package_name = ?
    `, [deviceId, packageName]);
    
    const restrictionData = {
      device_id: deviceId,
      package_name: packageName,
      wifi_allowed: wifi_allowed !== undefined ? wifi_allowed : true,
      mobile_data_allowed: mobile_data_allowed !== undefined ? mobile_data_allowed : true,
      background_data_allowed: background_data_allowed !== undefined ? background_data_allowed : true,
      data_limit: data_limit || null,
      updated_time: new Date()
    };
    
    if (existingRestriction) {
      await update('app_network_restrictions', restrictionData, { id: existingRestriction.id });
    } else {
      restrictionData.created_time = new Date();
      await insert('app_network_restrictions', restrictionData);
    }
    
    // 生成任务ID
    const taskId = `set_network_restrictions_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 发送网络限制设置指令
    const command = {
      type: 'set_app_network_restrictions',
      task_id: taskId,
      package_name: packageName,
      restrictions: restrictionData,
      timestamp: new Date().toISOString()
    };
    
    const io = getSocketIO();
    io.to(`device:${deviceId}`).emit('app_command', command);
    
    logger.info(`用户 ${req.user.id} 设置设备 ${deviceId} 应用 ${packageName} 网络限制`);
    
    res.json({
      success: true,
      message: '应用网络限制设置指令已发送',
      data: {
        task_id: taskId
      }
    });
  } catch (error) {
    logger.error('设置应用网络限制失败:', error);
    res.status(500).json({
      success: false,
      message: '设置应用网络限制失败'
    });
  }
};

/**
 * 获取应用网络限制
 */
const getAppNetworkRestrictions = async (req, res) => {
  try {
    const { deviceId, packageName } = req.params;
    
    const restrictions = await queryOne(`
      SELECT *
      FROM app_network_restrictions
      WHERE device_id = ? AND package_name = ?
    `, [deviceId, packageName]);
    
    res.json({
      success: true,
      data: {
        restrictions: restrictions || {
          wifi_allowed: true,
          mobile_data_allowed: true,
          background_data_allowed: true,
          data_limit: null
        }
      }
    });
  } catch (error) {
    logger.error('获取应用网络限制失败:', error);
    res.status(500).json({
      success: false,
      message: '获取应用网络限制失败'
    });
  }
};

module.exports = {
  getDeviceApps,
  getAppDetails,
  launchApp,
  stopApp,
  uninstallApp,
  installApp,
  disableApp,
  enableApp,
  clearAppData,
  clearAppCache,
  getAppPermissions,
  setAppPermissions,
  getAppUsage,
  getDeviceAppUsageStats,
  setAppRestrictions,
  getAppRestrictions,
  removeAppRestrictions,
  batchAppOperation,
  searchStoreApps,
  getStoreCategories,
  getFeaturedApps,
  getAppUpdates,
  updateApp,
  batchUpdateApps,
  getInstallHistory,
  createAppShortcut,
  getAppShortcuts,
  deleteAppShortcut,
  setDefaultApp,
  getDefaultApps,
  resetDefaultApp,
  getAppNetworkUsage,
  setAppNetworkRestrictions,
  getAppNetworkRestrictions
};