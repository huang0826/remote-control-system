/**
 * 位置追踪控制器
 */

const Device = require('../models/Device');
const { query, queryOne, insert, update } = require('../database/connection');
const { cache } = require('../database/redis');
const logger = require('../utils/logger');
const config = require('../config');
const socketManager = require('../socket/socketManager');

/**
 * 获取设备当前位置
 */
const getCurrentLocation = async (req, res) => {
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

    // 检查权限
    if (!device.permissions.location) {
      return res.status(403).json({
        success: false,
        message: '设备未授权位置权限'
      });
    }

    // 生成任务ID
    const taskId = `location_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 发送获取位置指令
    const command = {
      type: 'get_location',
      task_id: taskId,
      accuracy: 'high',
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
    logger.logDeviceAction(deviceId, 'get_location', {
      task_id: taskId
    }, req.user.id);

    // 缓存任务信息
    await cache.set(`task:${taskId}`, {
      type: 'get_location',
      device_id: deviceId,
      user_id: req.user.id,
      status: 'pending',
      created_time: new Date()
    }, 300); // 5分钟过期

    res.json({
      success: true,
      message: '获取位置指令已发送',
      data: {
        task_id: taskId,
        status: 'pending'
      }
    });
  } catch (error) {
    logger.error('获取当前位置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取位置失败'
    });
  }
};

/**
 * 开始/停止位置追踪
 */
const toggleLocationTracking = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { action = 'start', interval = 3600 } = req.body; // 默认1小时间隔

    // 验证追踪间隔
    const allowedIntervals = [300, 600, 1800, 3600]; // 5分钟、10分钟、30分钟、1小时
    if (!allowedIntervals.includes(interval)) {
      return res.status(400).json({
        success: false,
        message: '追踪间隔只能是5分钟、10分钟、30分钟或1小时'
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
    if (!device.permissions.location) {
      return res.status(403).json({
        success: false,
        message: '设备未授权位置权限'
      });
    }

    // 生成会话ID
    const sessionId = `location_track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 发送位置追踪指令
    const command = {
      type: 'location_tracking',
      session_id: sessionId,
      action,
      interval,
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
    logger.logDeviceAction(deviceId, 'location_tracking', {
      action,
      interval,
      session_id: sessionId
    }, req.user.id);

    if (action === 'start') {
      // 缓存会话信息
      await cache.set(`session:${sessionId}`, {
        type: 'location_tracking',
        device_id: deviceId,
        user_id: req.user.id,
        status: 'active',
        interval,
        created_time: new Date()
      }, 86400); // 24小时过期

      // 更新设备追踪状态
      await Device.updateInfo(deviceId, {
        location_tracking: true,
        tracking_interval: interval
      });
    } else {
      // 停止追踪时清除会话
      await cache.del(`session:${sessionId}`);
      
      // 更新设备追踪状态
      await Device.updateInfo(deviceId, {
        location_tracking: false,
        tracking_interval: null
      });
    }

    res.json({
      success: true,
      message: action === 'start' ? '位置追踪已开启' : '位置追踪已关闭',
      data: {
        session_id: sessionId,
        action,
        interval: action === 'start' ? interval : null
      }
    });
  } catch (error) {
    logger.error('位置追踪操作失败:', error);
    res.status(500).json({
      success: false,
      message: '操作失败'
    });
  }
};

/**
 * 获取位置历史记录
 */
const getLocationHistory = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { 
      start_date,
      end_date,
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
      whereClause += ' AND recorded_time >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND recorded_time <= ?';
      params.push(end_date);
    }

    // 获取总数
    const countSql = `
      SELECT COUNT(*) as total 
      FROM location_records 
      ${whereClause}
    `;
    const countResult = await queryOne(countSql, params);
    const total = countResult.total;

    // 获取分页数据
    const offset = (page - 1) * limit;
    const sql = `
      SELECT 
        id,
        latitude,
        longitude,
        accuracy,
        altitude,
        speed,
        bearing,
        address,
        recorded_time,
        created_time
      FROM location_records 
      ${whereClause}
      ORDER BY recorded_time DESC
      LIMIT ? OFFSET ?
    `;
    
    const records = await query(sql, [...params, parseInt(limit), offset]);

    // 记录操作日志
    logger.logUserAction(req.user.id, 'get_location_history', {
      device_id: deviceId,
      start_date,
      end_date,
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
    logger.error('获取位置历史记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取历史记录失败'
    });
  }
};

/**
 * 保存位置记录
 */
const saveLocationRecord = async (req, res) => {
  try {
    const {
      device_id,
      latitude,
      longitude,
      accuracy,
      altitude,
      speed,
      bearing,
      address,
      recorded_time
    } = req.body;

    // 验证必需字段
    if (!device_id || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: '设备ID、纬度和经度不能为空'
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

    // 保存位置记录
    const recordId = await insert('location_records', {
      device_id: device.id,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      accuracy: accuracy ? parseFloat(accuracy) : null,
      altitude: altitude ? parseFloat(altitude) : null,
      speed: speed ? parseFloat(speed) : null,
      bearing: bearing ? parseFloat(bearing) : null,
      address: address || null,
      recorded_time: recorded_time || new Date(),
      created_time: new Date()
    });

    // 更新设备最后位置
    await Device.updateLocation(device.id, {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address: address || null,
      location_updated_time: recorded_time || new Date()
    });

    // 检查位置异常移动警报
    await checkLocationAlert(device.id, latitude, longitude);

    logger.logDeviceAction(device.id, 'location_record_saved', {
      record_id: recordId,
      latitude,
      longitude
    });

    res.json({
      success: true,
      message: '位置记录保存成功',
      data: {
        record_id: recordId
      }
    });
  } catch (error) {
    logger.error('保存位置记录失败:', error);
    res.status(500).json({
      success: false,
      message: '保存位置记录失败'
    });
  }
};

/**
 * 检查位置异常移动警报
 */
const checkLocationAlert = async (deviceId, latitude, longitude) => {
  try {
    // 获取设备最近的位置记录
    const lastRecord = await queryOne(`
      SELECT latitude, longitude, recorded_time
      FROM location_records
      WHERE device_id = ?
      ORDER BY recorded_time DESC
      LIMIT 1 OFFSET 1
    `, [deviceId]);

    if (!lastRecord) {
      return;
    }

    // 计算距离（简单的直线距离）
    const distance = calculateDistance(
      lastRecord.latitude,
      lastRecord.longitude,
      parseFloat(latitude),
      parseFloat(longitude)
    );

    // 计算时间差（分钟）
    const timeDiff = (new Date() - new Date(lastRecord.recorded_time)) / (1000 * 60);

    // 如果在短时间内移动距离过大，触发警报
    const maxDistance = config.location.alert_distance || 50; // 默认50公里
    const minTime = config.location.alert_time || 30; // 默认30分钟

    if (distance > maxDistance && timeDiff < minTime) {
      // 获取设备信息
      const device = await Device.findById(deviceId);
      if (device) {
        // 发送警报通知
        await socketManager.sendToUser(device.user_id, {
          type: 'location_alert',
          device_id: device.device_id,
          device_name: device.device_name,
          distance,
          time_diff: timeDiff,
          current_location: { latitude, longitude },
          last_location: {
            latitude: lastRecord.latitude,
            longitude: lastRecord.longitude
          },
          timestamp: new Date().toISOString()
        });

        logger.logSystemEvent('location_alert', {
          device_id: deviceId,
          distance,
          time_diff: timeDiff
        });
      }
    }
  } catch (error) {
    logger.error('检查位置警报失败:', error);
  }
};

/**
 * 计算两点间距离（公里）
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // 地球半径（公里）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * 获取设备足迹统计
 */
const getLocationStats = async (req, res) => {
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

    // 获取统计数据
    const stats = await queryOne(`
      SELECT 
        COUNT(*) as total_records,
        MIN(recorded_time) as first_record,
        MAX(recorded_time) as last_record,
        COUNT(DISTINCT DATE(recorded_time)) as active_days
      FROM location_records
      WHERE device_id = ? AND recorded_time >= ?
    `, [deviceId, startDate]);

    // 获取每日记录数
    const dailyStats = await query(`
      SELECT 
        DATE(recorded_time) as date,
        COUNT(*) as count,
        MIN(recorded_time) as first_time,
        MAX(recorded_time) as last_time
      FROM location_records
      WHERE device_id = ? AND recorded_time >= ?
      GROUP BY DATE(recorded_time)
      ORDER BY date DESC
    `, [deviceId, startDate]);

    // 获取最常出现的位置
    const frequentLocations = await query(`
      SELECT 
        ROUND(latitude, 4) as lat,
        ROUND(longitude, 4) as lng,
        COUNT(*) as count,
        address
      FROM location_records
      WHERE device_id = ? AND recorded_time >= ?
      GROUP BY ROUND(latitude, 4), ROUND(longitude, 4)
      ORDER BY count DESC
      LIMIT 10
    `, [deviceId, startDate]);

    res.json({
      success: true,
      data: {
        summary: stats,
        daily_stats: dailyStats,
        frequent_locations: frequentLocations
      }
    });
  } catch (error) {
    logger.error('获取位置统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计失败'
    });
  }
};

/**
 * 删除位置记录
 */
const deleteLocationRecords = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { before_date } = req.body;

    if (!before_date) {
      return res.status(400).json({
        success: false,
        message: '请指定删除日期'
      });
    }

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 删除指定日期之前的记录
    const result = await query(`
      DELETE FROM location_records
      WHERE device_id = ? AND recorded_time < ?
    `, [deviceId, before_date]);

    logger.logUserAction(req.user.id, 'delete_location_records', {
      device_id: deviceId,
      before_date,
      deleted_count: result.affectedRows
    });

    res.json({
      success: true,
      message: '位置记录删除成功',
      data: {
        deleted_count: result.affectedRows
      }
    });
  } catch (error) {
    logger.error('删除位置记录失败:', error);
    res.status(500).json({
      success: false,
      message: '删除失败'
    });
  }
};

module.exports = {
  getCurrentLocation,
  toggleLocationTracking,
  getLocationHistory,
  saveLocationRecord,
  getLocationStats,
  deleteLocationRecords
};