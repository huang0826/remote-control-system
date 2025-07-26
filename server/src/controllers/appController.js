/**
 * 应用使用记录控制器
 */

const Device = require('../models/Device');
const { query, queryOne, insert, update, remove } = require('../database/connection');
const { cache } = require('../database/redis');
const logger = require('../utils/logger');
const config = require('../config');
const socketManager = require('../socket/socketManager');

/**
 * 获取应用使用记录
 */
const getAppUsageRecords = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { 
      start_date,
      end_date,
      app_name,
      page = 1,
      limit = 50
    } = req.query;

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

    if (start_date) {
      whereClause += ' AND DATE(start_time) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND DATE(start_time) <= ?';
      params.push(end_date);
    }

    if (app_name) {
      whereClause += ' AND app_name LIKE ?';
      params.push(`%${app_name}%`);
    }

    // 获取总数
    const countSql = `
      SELECT COUNT(*) as total 
      FROM app_usage_records 
      ${whereClause}
    `;
    const countResult = await queryOne(countSql, params);
    const total = countResult.total;

    // 获取分页数据
    const offset = (page - 1) * limit;
    const sql = `
      SELECT 
        id,
        app_name,
        package_name,
        start_time,
        end_time,
        duration,
        is_sensitive,
        created_time
      FROM app_usage_records 
      ${whereClause}
      ORDER BY start_time DESC
      LIMIT ? OFFSET ?
    `;
    
    const records = await query(sql, [...params, parseInt(limit), offset]);

    // 记录操作日志
    logger.logUserAction(req.user.id, 'get_app_usage_records', {
      device_id: deviceId,
      start_date,
      end_date,
      app_name,
      page,
      limit
    });

    res.json({
      success: true,
      data: {
        records,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('获取应用使用记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取记录失败'
    });
  }
};

/**
 * 开始/停止应用使用记录
 */
const toggleAppUsageTracking = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { action = 'start' } = req.body;

    const device = await Device.findById(deviceId);
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
        message: '设备离线'
      });
    }

    // 检查权限
    if (!device.permissions.usage_stats) {
      return res.status(403).json({
        success: false,
        message: '设备未授权使用统计权限'
      });
    }

    // 生成会话ID
    const sessionId = `app_usage_track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 发送应用使用记录指令
    const command = {
      type: 'app_usage_tracking',
      session_id: sessionId,
      action,
      timestamp: new Date().toISOString()
    };

    const sent = await socketManager.sendToDevice(device.device_id, command);
    if (!sent) {
      return res.status(400).json({
        success: false,
        message: '设备连接异常，指令发送失败'
      });
    }

    // 记录操作日志
    logger.logDeviceAction(deviceId, 'app_usage_tracking', {
      action,
      session_id: sessionId
    }, req.user.id);

    if (action === 'start') {
      // 缓存会话信息
      await cache.set(`session:${sessionId}`, {
        type: 'app_usage_tracking',
        device_id: deviceId,
        user_id: req.user.id,
        status: 'active',
        created_time: new Date()
      }, 86400); // 24小时过期

      // 更新设备追踪状态
      await Device.updateInfo(deviceId, {
        app_usage_tracking: true
      });
    } else {
      // 停止追踪时清除会话
      await cache.del(`session:${sessionId}`);
      
      // 更新设备追踪状态
      await Device.updateInfo(deviceId, {
        app_usage_tracking: false
      });
    }

    res.json({
      success: true,
      message: action === 'start' ? '应用使用记录已开启' : '应用使用记录已关闭',
      data: {
        session_id: sessionId,
        action
      }
    });
  } catch (error) {
    logger.error('应用使用记录操作失败:', error);
    res.status(500).json({
      success: false,
      message: '操作失败'
    });
  }
};

/**
 * 保存应用使用记录
 */
const saveAppUsageRecord = async (req, res) => {
  try {
    const {
      device_id,
      app_name,
      package_name,
      start_time,
      end_time,
      duration
    } = req.body;

    // 验证必需字段
    if (!device_id || !app_name || !package_name || !start_time) {
      return res.status(400).json({
        success: false,
        message: '设备ID、应用名称、包名和开始时间不能为空'
      });
    }

    // 验证设备存在
    const device = await Device.findByDeviceId(device_id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 检查是否为敏感应用
    const sensitiveApp = await queryOne(`
      SELECT id FROM sensitive_apps
      WHERE device_id = ? AND (package_name = ? OR app_name = ?)
    `, [device.id, package_name, app_name]);

    const isSensitive = !!sensitiveApp;

    // 计算使用时长
    let calculatedDuration = duration;
    if (!calculatedDuration && end_time) {
      calculatedDuration = Math.floor((new Date(end_time) - new Date(start_time)) / 1000);
    }

    // 保存应用使用记录
    const recordId = await insert('app_usage_records', {
      device_id: device.id,
      app_name,
      package_name,
      start_time: new Date(start_time),
      end_time: end_time ? new Date(end_time) : null,
      duration: calculatedDuration || 0,
      is_sensitive: isSensitive,
      created_time: new Date()
    });

    // 如果是敏感应用，发送特别提醒
    if (isSensitive) {
      await sendSensitiveAppAlert(device, app_name, package_name, start_time);
    }

    logger.logDeviceAction(device.id, 'app_usage_record_saved', {
      record_id: recordId,
      app_name,
      package_name,
      is_sensitive: isSensitive
    });

    res.json({
      success: true,
      message: '应用使用记录保存成功',
      data: {
        record_id: recordId,
        is_sensitive: isSensitive
      }
    });
  } catch (error) {
    logger.error('保存应用使用记录失败:', error);
    res.status(500).json({
      success: false,
      message: '保存记录失败'
    });
  }
};

/**
 * 获取敏感应用配置
 */
const getSensitiveApps = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    const sensitiveApps = await query(`
      SELECT 
        id,
        app_name,
        package_name,
        alert_enabled,
        created_time
      FROM sensitive_apps
      WHERE device_id = ?
      ORDER BY created_time DESC
    `, [deviceId]);

    res.json({
      success: true,
      data: {
        sensitive_apps: sensitiveApps
      }
    });
  } catch (error) {
    logger.error('获取敏感应用配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取配置失败'
    });
  }
};

/**
 * 设置敏感应用
 */
const setSensitiveApps = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { apps } = req.body; // 应用列表，最多5个

    if (!Array.isArray(apps) || apps.length > 5) {
      return res.status(400).json({
        success: false,
        message: '敏感应用列表格式错误或超过5个'
      });
    }

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 删除现有的敏感应用配置
    await remove('sensitive_apps', { device_id: deviceId });

    // 添加新的敏感应用配置
    for (const app of apps) {
      if (!app.app_name || !app.package_name) {
        continue;
      }

      await insert('sensitive_apps', {
        device_id: deviceId,
        app_name: app.app_name,
        package_name: app.package_name,
        alert_enabled: app.alert_enabled !== false, // 默认启用
        created_time: new Date()
      });
    }

    // 记录操作日志
    logger.logUserAction(req.user.id, 'set_sensitive_apps', {
      device_id: deviceId,
      apps_count: apps.length
    });

    res.json({
      success: true,
      message: '敏感应用配置成功',
      data: {
        apps_count: apps.length
      }
    });
  } catch (error) {
    logger.error('设置敏感应用失败:', error);
    res.status(500).json({
      success: false,
      message: '设置失败'
    });
  }
};

/**
 * 获取设备已安装应用列表
 */
const getInstalledApps = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await Device.findById(deviceId);
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
        message: '设备离线'
      });
    }

    // 生成任务ID
    const taskId = `installed_apps_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 发送获取应用列表指令
    const command = {
      type: 'get_installed_apps',
      task_id: taskId,
      timestamp: new Date().toISOString()
    };

    const sent = await socketManager.sendToDevice(device.device_id, command);
    if (!sent) {
      return res.status(400).json({
        success: false,
        message: '设备连接异常，指令发送失败'
      });
    }

    // 记录操作日志
    logger.logDeviceAction(deviceId, 'get_installed_apps', {
      task_id: taskId
    }, req.user.id);

    // 缓存任务信息
    await cache.set(`task:${taskId}`, {
      type: 'get_installed_apps',
      device_id: deviceId,
      user_id: req.user.id,
      status: 'pending',
      created_time: new Date()
    }, 300); // 5分钟过期

    res.json({
      success: true,
      message: '获取应用列表指令已发送',
      data: {
        task_id: taskId,
        status: 'pending'
      }
    });
  } catch (error) {
    logger.error('获取已安装应用失败:', error);
    res.status(500).json({
      success: false,
      message: '获取应用列表失败'
    });
  }
};

/**
 * 隐藏/显示应用
 */
const toggleAppVisibility = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { package_name, action = 'hide' } = req.body; // hide/show

    if (!package_name) {
      return res.status(400).json({
        success: false,
        message: '应用包名不能为空'
      });
    }

    const device = await Device.findById(deviceId);
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
        message: '设备离线'
      });
    }

    // 检查权限
    if (!device.permissions.device_admin) {
      return res.status(403).json({
        success: false,
        message: '设备未授权设备管理员权限'
      });
    }

    // 生成任务ID
    const taskId = `app_visibility_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 发送隐藏/显示应用指令
    const command = {
      type: 'toggle_app_visibility',
      task_id: taskId,
      package_name,
      action,
      timestamp: new Date().toISOString()
    };

    const sent = await socketManager.sendToDevice(device.device_id, command);
    if (!sent) {
      return res.status(400).json({
        success: false,
        message: '设备连接异常，指令发送失败'
      });
    }

    // 记录操作日志
    logger.logDeviceAction(deviceId, 'toggle_app_visibility', {
      task_id: taskId,
      package_name,
      action
    }, req.user.id);

    res.json({
      success: true,
      message: `${action === 'hide' ? '隐藏' : '显示'}应用指令已发送`,
      data: {
        task_id: taskId,
        package_name,
        action
      }
    });
  } catch (error) {
    logger.error('切换应用可见性失败:', error);
    res.status(500).json({
      success: false,
      message: '操作失败'
    });
  }
};

/**
 * 获取应用使用统计
 */
const getAppUsageStats = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { days = 7 } = req.query;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // 获取应用使用时长统计
    const appStats = await query(`
      SELECT 
        app_name,
        package_name,
        COUNT(*) as usage_count,
        SUM(duration) as total_duration,
        AVG(duration) as avg_duration,
        MAX(start_time) as last_used
      FROM app_usage_records
      WHERE device_id = ? AND start_time >= ?
      GROUP BY app_name, package_name
      ORDER BY total_duration DESC
      LIMIT 20
    `, [deviceId, startDate]);

    // 获取每日使用统计
    const dailyStats = await query(`
      SELECT 
        DATE(start_time) as date,
        COUNT(DISTINCT app_name) as unique_apps,
        COUNT(*) as total_usage,
        SUM(duration) as total_duration
      FROM app_usage_records
      WHERE device_id = ? AND start_time >= ?
      GROUP BY DATE(start_time)
      ORDER BY date DESC
    `, [deviceId, startDate]);

    // 获取敏感应用使用记录
    const sensitiveStats = await query(`
      SELECT 
        app_name,
        package_name,
        COUNT(*) as usage_count,
        SUM(duration) as total_duration,
        MAX(start_time) as last_used
      FROM app_usage_records
      WHERE device_id = ? AND start_time >= ? AND is_sensitive = 1
      GROUP BY app_name, package_name
      ORDER BY usage_count DESC
    `, [deviceId, startDate]);

    res.json({
      success: true,
      data: {
        app_stats: appStats,
        daily_stats: dailyStats,
        sensitive_stats: sensitiveStats
      }
    });
  } catch (error) {
    logger.error('获取应用使用统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计失败'
    });
  }
};

/**
 * 发送敏感应用警报
 */
const sendSensitiveAppAlert = async (device, appName, packageName, startTime) => {
  try {
    // 发送实时通知给用户
    await socketManager.sendToUser(device.user_id, {
      type: 'sensitive_app_alert',
      device_id: device.device_id,
      device_name: device.device_name,
      app_name: appName,
      package_name: packageName,
      start_time: startTime,
      timestamp: new Date().toISOString()
    });

    logger.logSystemEvent('sensitive_app_alert', {
      device_id: device.id,
      app_name: appName,
      package_name: packageName
    });
  } catch (error) {
    logger.error('发送敏感应用警报失败:', error);
  }
};

module.exports = {
  getAppUsageRecords,
  toggleAppUsageTracking,
  saveAppUsageRecord,
  getSensitiveApps,
  setSensitiveApps,
  getInstalledApps,
  toggleAppVisibility,
  getAppUsageStats
};