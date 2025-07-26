/**
 * 设备控制器
 */

const Device = require('../models/Device');
const { query, queryOne, insert, update } = require('../database/connection');
const config = require('../config');
const socketManager = require('../socket/socketManager');
const logger = require('../utils/logger');

// 检查Redis是否启用
const useCache = config.redis.enabled;
let cache = null;
if (useCache) {
  cache = require('../database/redis').cache;
}

/**
 * 注册设备
 */
const registerDevice = async (req, res) => {
  try {
    const userId = req.user.id;
    const deviceData = {
      ...req.body,
      user_id: userId,
      ip_address: req.ip
    };

    // 验证必填字段
    if (!deviceData.device_id) {
      return res.status(400).json({
        success: false,
        message: '设备ID不能为空'
      });
    }

    const device = await Device.register(deviceData);

    res.status(201).json({
      success: true,
      message: '设备注册成功',
      data: {
        id: device.id,
        device_id: device.device_id,
        device_name: device.device_name,
        status: device.status
      }
    });
  } catch (error) {
    console.error('设备注册失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '设备注册失败'
    });
  }
};

/**
 * 获取设备详情
 */
const getDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findById(deviceId);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 检查权限
    if (device.user_id !== req.user.id) {
      // 检查是否有控制权限
      const controlSql = `
        SELECT * FROM device_controls 
        WHERE controller_id = ? AND controlled_device_id = ? 
        AND status = 'active' AND deleted_time IS NULL
      `;
      const control = await queryOne(controlSql, [req.user.id, deviceId]);
      
      if (!control) {
        return res.status(403).json({
          success: false,
          message: '没有设备访问权限'
        });
      }
    }

    res.json({
      success: true,
      data: {
        id: device.id,
        device_id: device.device_id,
        device_name: device.device_name,
        device_model: device.device_model,
        device_brand: device.device_brand,
        system_version: device.system_version,
        app_version: device.app_version,
        screen_width: device.screen_width,
        screen_height: device.screen_height,
        status: device.status,
        location_lat: device.location_lat,
        location_lng: device.location_lng,
        location_address: device.location_address,
        permissions: device.permissions,
        settings: device.settings,
        last_online_time: device.last_online_time,
        created_time: device.created_time
      }
    });
  } catch (error) {
    console.error('获取设备详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取设备信息失败'
    });
  }
};

/**
 * 更新设备信息
 */
const updateDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const updateData = req.body;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 只有设备所有者可以更新设备信息
    if (device.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '没有设备修改权限'
      });
    }

    const updatedDevice = await Device.updateDevice(deviceId, updateData);

    res.json({
      success: true,
      message: '设备信息更新成功',
      data: {
        id: updatedDevice.id,
        device_name: updatedDevice.device_name,
        status: updatedDevice.status,
        permissions: updatedDevice.permissions,
        settings: updatedDevice.settings
      }
    });
  } catch (error) {
    console.error('更新设备信息失败:', error);
    res.status(500).json({
      success: false,
      message: '更新设备信息失败'
    });
  }
};

/**
 * 设备心跳
 */
const heartbeat = async (req, res) => {
  try {
    const { device_id } = req.body;

    if (!device_id) {
      return res.status(400).json({
        success: false,
        message: '设备ID不能为空'
      });
    }

    const success = await Device.heartbeat(device_id);

    if (success) {
      res.json({
        success: true,
        message: '心跳成功'
      });
    } else {
      res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }
  } catch (error) {
    console.error('设备心跳失败:', error);
    res.status(500).json({
      success: false,
      message: '心跳失败'
    });
  }
};

/**
 * 更新设备位置
 */
const updateLocation = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { lat, lng, address } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: '经纬度不能为空'
      });
    }

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 只有设备所有者可以更新位置
    if (device.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '没有设备修改权限'
      });
    }

    const location = { lat, lng, address };
    const success = await Device.updateLocation(deviceId, location);

    if (success) {
      // 记录位置历史
      await insert('location_records', {
        device_id: deviceId,
        latitude: lat,
        longitude: lng,
        address: address || '',
        accuracy: req.body.accuracy || 0,
        altitude: req.body.altitude || 0,
        speed: req.body.speed || 0,
        bearing: req.body.bearing || 0,
        created_time: new Date()
      });

      res.json({
        success: true,
        message: '位置更新成功'
      });
    } else {
      res.status(400).json({
        success: false,
        message: '位置更新失败'
      });
    }
  } catch (error) {
    logger.error('更新设备位置失败:', error);
    res.status(500).json({
      success: false,
      message: '位置更新失败'
    });
  }
};

/**
 * 获取设备位置历史
 */
const getLocationHistory = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { start_date, end_date, limit = 100 } = req.query;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 检查权限
    if (device.user_id !== req.user.id) {
      const controlSql = `
        SELECT * FROM device_controls 
        WHERE controller_id = ? AND controlled_device_id = ? 
        AND status = 'active' AND deleted_time IS NULL
      `;
      const control = await queryOne(controlSql, [req.user.id, deviceId]);
      
      if (!control) {
        return res.status(403).json({
          success: false,
          message: '没有设备访问权限'
        });
      }
    }

    let sql = `
      SELECT latitude, longitude, address, accuracy, altitude, speed, bearing, created_time
      FROM location_records 
      WHERE device_id = ?
    `;
    const params = [deviceId];

    if (start_date) {
      sql += ' AND created_time >= ?';
      params.push(start_date);
    }

    if (end_date) {
      sql += ' AND created_time <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY created_time DESC LIMIT ?';
    params.push(parseInt(limit));

    const records = await query(sql, params);

    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    logger.error('获取位置历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取位置历史失败'
    });
  }
};

/**
 * 添加设备控制关系
 */
const addDeviceControl = async (req, res) => {
  try {
    const { target_user_id, device_id, permissions = [] } = req.body;
    const controllerId = req.user.id;

    // 验证目标用户
    const User = require('../models/User');
    const targetUser = await User.findById(target_user_id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: '目标用户不存在'
      });
    }

    // 验证设备
    const device = await Device.findByDeviceId(device_id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 只有设备所有者可以添加控制关系
    if (device.user_id !== controllerId) {
      return res.status(403).json({
        success: false,
        message: '只有设备所有者可以添加控制关系'
      });
    }

    // 检查是否已存在控制关系
    const existingSql = `
      SELECT * FROM device_controls 
      WHERE controller_id = ? AND controlled_device_id = ? 
      AND deleted_time IS NULL
    `;
    const existing = await queryOne(existingSql, [target_user_id, device.id]);
    
    if (existing) {
      return res.status(400).json({
        success: false,
        message: '控制关系已存在'
      });
    }

    // 创建控制关系
    const controlData = {
      controller_id: target_user_id,
      controlled_device_id: device.id,
      owner_id: controllerId,
      permissions: JSON.stringify(permissions),
      status: 'active',
      created_time: new Date(),
      updated_time: new Date()
    };

    const result = await insert('device_controls', controlData);

    // 记录操作日志
    logger.logDeviceAction(device.id, 'add_control', {
      controller_id: target_user_id,
      permissions
    }, controllerId);

    res.status(201).json({
      success: true,
      message: '控制关系添加成功',
      data: {
        id: result.insertId,
        controller_id: target_user_id,
        device_id: device.id,
        permissions
      }
    });
  } catch (error) {
    logger.error('添加设备控制关系失败:', error);
    res.status(500).json({
      success: false,
      message: '添加控制关系失败'
    });
  }
};

/**
 * 获取可控制的设备列表
 */
const getDeviceControllers = async (req, res) => {
  try {
    const userId = req.user.id;

    const sql = `
      SELECT 
        d.id, d.device_id, d.device_name, d.device_model, d.device_brand,
        d.system_version, d.status, d.last_online_time, d.location_address,
        dc.permissions, dc.created_time as control_created_time,
        u.phone as owner_phone, u.nickname as owner_nickname
      FROM device_controls dc
      JOIN devices d ON dc.controlled_device_id = d.id
      JOIN users u ON dc.owner_id = u.id
      WHERE dc.controller_id = ? AND dc.status = 'active' 
      AND dc.deleted_time IS NULL AND d.deleted_time IS NULL
      ORDER BY d.last_online_time DESC
    `;

    const devices = await query(sql, [userId]);

    // 解析权限JSON
    devices.forEach(device => {
      device.permissions = JSON.parse(device.permissions || '[]');
      // 隐藏所有者手机号
      device.owner_phone = device.owner_phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    });

    res.json({
      success: true,
      data: devices
    });
  } catch (error) {
    logger.error('获取可控制设备列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取设备列表失败'
    });
  }
};

/**
 * 移除设备控制关系
 */
const removeDeviceController = async (req, res) => {
  try {
    const { controlId } = req.params;
    const userId = req.user.id;

    // 获取控制关系
    const controlSql = 'SELECT * FROM device_controls WHERE id = ? AND deleted_time IS NULL';
    const control = await queryOne(controlSql, [controlId]);
    
    if (!control) {
      return res.status(404).json({
        success: false,
        message: '控制关系不存在'
      });
    }

    // 只有设备所有者或控制者可以移除关系
    if (control.owner_id !== userId && control.controller_id !== userId) {
      return res.status(403).json({
        success: false,
        message: '没有权限移除此控制关系'
      });
    }

    // 软删除控制关系
    const result = await update('device_controls', {
      deleted_time: new Date(),
      updated_time: new Date()
    }, { id: controlId });

    if (result.affectedRows > 0) {
      // 记录操作日志
      logger.logDeviceAction(control.controlled_device_id, 'remove_control', {
        controller_id: control.controller_id
      }, userId);

      res.json({
        success: true,
        message: '控制关系移除成功'
      });
    } else {
      res.status(400).json({
        success: false,
        message: '移除失败'
      });
    }
  } catch (error) {
    logger.error('移除设备控制关系失败:', error);
    res.status(500).json({
      success: false,
      message: '移除控制关系失败'
    });
  }
};

/**
 * 删除设备
 */
const remove = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.id;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 只有设备所有者可以删除设备
    if (device.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: '只有设备所有者可以删除设备'
      });
    }

    const success = await Device.deleteById(deviceId);

    if (success) {
      // 同时删除相关的控制关系
      await update('device_controls', {
        deleted_time: new Date(),
        updated_time: new Date()
      }, { controlled_device_id: deviceId });

      res.json({
        success: true,
        message: '设备删除成功'
      });
    } else {
      res.status(400).json({
        success: false,
        message: '设备删除失败'
      });
    }
  } catch (error) {
    logger.error('删除设备失败:', error);
    res.status(500).json({
      success: false,
      message: '删除设备失败'
    });
  }
};

/**
 * 获取设备统计信息
 */
const getStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // 获取用户拥有的设备统计
    const ownedDevices = await Device.findByUserId(userId);
    const ownedStats = {
      total: ownedDevices.length,
      online: ownedDevices.filter(d => d.status === 'online').length,
      offline: ownedDevices.filter(d => d.status === 'offline').length
    };

    // 获取可控制的设备统计
    const controlledSql = `
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN d.status = 'online' THEN 1 END) as online,
             COUNT(CASE WHEN d.status = 'offline' THEN 1 END) as offline
      FROM device_controls dc
      JOIN devices d ON dc.controlled_device_id = d.id
      WHERE dc.controller_id = ? AND dc.status = 'active' 
      AND dc.deleted_time IS NULL AND d.deleted_time IS NULL
    `;

    const [controlledStats] = await query(controlledSql, [userId]);

    res.json({
      success: true,
      data: {
        owned: ownedStats,
        controlled: controlledStats
      }
    });
  } catch (error) {
    logger.error('获取设备统计信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计信息失败'
    });
  }
};

/**
 * 获取设备权限列表
 */
const getDevicePermissions = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findById(deviceId);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    const permissions = device.permissions ? JSON.parse(device.permissions) : [];

    res.json({
      success: true,
      data: permissions
    });
  } catch (error) {
    logger.error('获取设备权限列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取权限列表失败'
    });
  }
};

/**
 * 更新设备权限
 */
const updateDevicePermissions = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { permissions } = req.body;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 只有设备所有者可以更新权限
    if (device.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '没有权限更新设备权限'
      });
    }

    const success = await Device.updatePermissions(deviceId, permissions);

    if (success) {
      res.json({
        success: true,
        message: '权限更新成功',
        data: permissions
      });
    } else {
      res.status(400).json({
        success: false,
        message: '权限更新失败'
      });
    }
  } catch (error) {
    logger.error('更新设备权限失败:', error);
    res.status(500).json({
        success: false,
        message: '更新权限失败'
    });
  }
};

/**
 * 获取设备应用列表
 */
const getDeviceApps = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findById(deviceId);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    const apps = device.apps ? JSON.parse(device.apps) : [];

    res.json({
      success: true,
      data: apps
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
 * 更新设备应用列表
 */
const updateDeviceApps = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { apps } = req.body;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 只有设备所有者可以更新应用列表
    if (device.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '没有权限更新设备应用'
      });
    }

    const success = await Device.updateApps(deviceId, apps);

    if (success) {
      res.json({
        success: true,
        message: '应用列表更新成功',
        data: apps
      });
    } else {
      res.status(400).json({
        success: false,
        message: '应用列表更新失败'
      });
    }
  } catch (error) {
    logger.error('更新设备应用列表失败:', error);
    res.status(500).json({
      success: false,
      message: '更新应用列表失败'
    });
  }
};

/**
 * 设备远程锁定
 */
const lockDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findById(deviceId);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 发送锁定指令
    const success = await socketManager.sendCommand(device.device_id, 'lock', {});

    if (success) {
      res.json({
        success: true,
        message: '锁定指令已发送'
      });
    } else {
      res.status(400).json({
        success: false,
        message: '设备离线或发送指令失败'
      });
    }
  } catch (error) {
    logger.error('设备锁定失败:', error);
    res.status(500).json({
      success: false,
      message: '设备锁定失败'
    });
  }
};

/**
 * 设备远程解锁
 */
const unlockDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findById(deviceId);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 发送解锁指令
    const success = await socketManager.sendCommand(device.device_id, 'unlock', {});

    if (success) {
      res.json({
        success: true,
        message: '解锁指令已发送'
      });
    } else {
      res.status(400).json({
        success: false,
        message: '设备离线或发送指令失败'
      });
    }
  } catch (error) {
    logger.error('设备解锁失败:', error);
    res.status(500).json({
      success: false,
      message: '设备解锁失败'
    });
  }
};

/**
 * 设备远程擦除
 */
const wipeDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findById(deviceId);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 只有设备所有者可以执行擦除操作
    if (device.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '只有设备所有者可以执行擦除操作'
      });
    }

    // 发送擦除指令
    const success = await socketManager.sendCommand(device.device_id, 'wipe', {});

    if (success) {
      res.json({
        success: true,
        message: '擦除指令已发送'
      });
    } else {
      res.status(400).json({
        success: false,
        message: '设备离线或发送指令失败'
      });
    }
  } catch (error) {
    logger.error('设备擦除失败:', error);
    res.status(500).json({
      success: false,
      message: '设备擦除失败'
    });
  }
};

module.exports = {
  registerDevice,
  getDevice,
  updateDevice,
  heartbeat,
  updateLocation,
  getLocationHistory,
  addDeviceControl,
  getDeviceControllers,
  removeDeviceController,
  remove,
  getStats,
  getDevicePermissions,
  updateDevicePermissions,
  getDeviceApps,
  updateDeviceApps,
  lockDevice,
  unlockDevice,
  wipeDevice
};