/**
 * 设备模型
 */

const { query, queryOne, insert, update, remove, count } = require('../database/connection');
const config = require('../config');
const logger = require('../utils/logger');

// 检查Redis是否启用
const useCache = config.redis.enabled;
let cache = null;
if (useCache) {
  cache = require('../database/redis').cache;
}

class Device {
  /**
   * 注册设备
   * @param {Object} deviceData 设备数据
   * @returns {Promise<Object>}
   */
  static async register(deviceData) {
    try {
      // 检查设备是否已存在
      const existingDevice = await this.findByDeviceId(deviceData.device_id);
      if (existingDevice) {
        // 更新设备信息
        return await this.updateDevice(existingDevice.id, deviceData);
      }

      // 创建新设备
      const device = {
        user_id: deviceData.user_id,
        device_id: deviceData.device_id,
        device_name: deviceData.device_name || '未知设备',
        device_model: deviceData.device_model || '',
        device_brand: deviceData.device_brand || '',
        system_version: deviceData.system_version || '',
        app_version: deviceData.app_version || '',
        screen_width: deviceData.screen_width || 0,
        screen_height: deviceData.screen_height || 0,
        screen_density: deviceData.screen_density || 0,
        imei: deviceData.imei || '',
        sim_serial: deviceData.sim_serial || '',
        mac_address: deviceData.mac_address || '',
        ip_address: deviceData.ip_address || '',
        location_lat: deviceData.location_lat || null,
        location_lng: deviceData.location_lng || null,
        location_address: deviceData.location_address || '',
        status: 'online',
        permissions: JSON.stringify(deviceData.permissions || {}),
        settings: JSON.stringify(deviceData.settings || {}),
        last_online_time: new Date(),
        created_time: new Date(),
        updated_time: new Date()
      };

      const result = await insert('devices', device);
      device.id = result.insertId;

      // 缓存设备信息
      if (useCache && cache) {
        await cache.set(`device:${device.id}`, device, 3600);
        await cache.set(`device_id:${device.device_id}`, device, 3600);
      }

      // 记录设备注册
      logger.logDeviceAction(device.id, 'register', {
        device_id: device.device_id,
        device_name: device.device_name
      }, device.user_id);

      return device;
    } catch (error) {
      logger.error('注册设备失败:', error);
      throw error;
    }
  }

  /**
   * 根据设备ID查找设备
   * @param {string} deviceId 设备ID
   * @returns {Promise<Object|null>}
   */
  static async findByDeviceId(deviceId) {
    try {
      // 先从缓存获取
      let device = null;
      if (useCache && cache) {
        device = await cache.get(`device_id:${deviceId}`);
        if (device) {
          return device;
        }
      }

      // 从数据库获取
      const sql = 'SELECT * FROM devices WHERE device_id = ? AND deleted_time IS NULL';
      device = await queryOne(sql, [deviceId]);
      
      if (device) {
        // 解析JSON字段
        device.permissions = JSON.parse(device.permissions || '{}');
        device.settings = JSON.parse(device.settings || '{}');
        
        // 缓存设备信息
        if (useCache && cache) {
          await cache.set(`device:${device.id}`, device, 3600);
          await cache.set(`device_id:${deviceId}`, device, 3600);
        }
      }

      return device;
    } catch (error) {
      logger.error('根据设备ID查找设备失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID查找设备
   * @param {number} id 设备ID
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    try {
      // 先从缓存获取
      let device = null;
      if (useCache && cache) {
        device = await cache.get(`device:${id}`);
        if (device) {
          return device;
        }
      }

      // 从数据库获取
      const sql = 'SELECT * FROM devices WHERE id = ? AND deleted_time IS NULL';
      device = await queryOne(sql, [id]);
      
      if (device) {
        // 解析JSON字段
        device.permissions = JSON.parse(device.permissions || '{}');
        device.settings = JSON.parse(device.settings || '{}');
        
        // 缓存设备信息
        if (useCache && cache) {
          await cache.set(`device:${id}`, device, 3600);
        }
      }

      return device;
    } catch (error) {
      logger.error('根据ID查找设备失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户设备列表
   * @param {number} userId 用户ID
   * @returns {Promise<Array>}
   */
  static async findByUserId(userId) {
    try {
      const sql = `
        SELECT * FROM devices 
        WHERE user_id = ? AND deleted_time IS NULL 
        ORDER BY last_online_time DESC
      `;
      const devices = await query(sql, [userId]);
      
      // 解析JSON字段
      devices.forEach(device => {
        device.permissions = JSON.parse(device.permissions || '{}');
        device.settings = JSON.parse(device.settings || '{}');
      });
      
      return devices;
    } catch (error) {
      logger.error('获取用户设备列表失败:', error);
      throw error;
    }
  }

  /**
   * 更新设备信息
   * @param {number} id 设备ID
   * @param {Object} updateData 更新数据
   * @returns {Promise<Object>}
   */
  static async updateDevice(id, updateData) {
    try {
      const device = await this.findById(id);
      if (!device) {
        throw new Error('设备不存在');
      }

      // 准备更新数据
      const allowedFields = [
        'device_name', 'device_model', 'device_brand', 'system_version', 'app_version',
        'screen_width', 'screen_height', 'screen_density', 'imei', 'sim_serial',
        'mac_address', 'ip_address', 'location_lat', 'location_lng', 'location_address',
        'status', 'permissions', 'settings'
      ];
      
      const filteredData = {};
      for (const field of allowedFields) {
        if (updateData.hasOwnProperty(field)) {
          if (field === 'permissions' || field === 'settings') {
            filteredData[field] = JSON.stringify(updateData[field]);
          } else {
            filteredData[field] = updateData[field];
          }
        }
      }

      if (Object.keys(filteredData).length === 0) {
        return device;
      }

      filteredData.updated_time = new Date();
      if (updateData.status === 'online') {
        filteredData.last_online_time = new Date();
      }

      const result = await update('devices', filteredData, { id });
      
      if (result.affectedRows > 0) {
        // 清除缓存
        if (useCache && cache) {
          await cache.del(`device:${id}`);
          await cache.del(`device_id:${device.device_id}`);
        }
        
        // 获取更新后的设备信息
        const updatedDevice = await this.findById(id);
        
        // 记录设备更新
        logger.logDeviceAction(id, 'update', filteredData, device.user_id);
        
        return updatedDevice;
      }
      
      return device;
    } catch (error) {
      logger.error('更新设备信息失败:', error);
      throw error;
    }
  }

  /**
   * 更新设备状态
   * @param {number} id 设备ID
   * @param {string} status 状态
   * @returns {Promise<boolean>}
   */
  static async updateStatus(id, status) {
    try {
      const updateData = {
        status,
        updated_time: new Date()
      };
      
      if (status === 'online') {
        updateData.last_online_time = new Date();
      }

      const result = await update('devices', updateData, { id });
      
      if (result.affectedRows > 0) {
        // 清除缓存
        const device = await this.findById(id);
        if (device) {
          await cache.del(`device:${id}`);
          await cache.del(`device_id:${device.device_id}`);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('更新设备状态失败:', error);
      throw error;
    }
  }

  /**
   * 更新设备位置
   * @param {number} id 设备ID
   * @param {Object} location 位置信息
   * @returns {Promise<boolean>}
   */
  static async updateLocation(id, location) {
    try {
      const updateData = {
        location_lat: location.lat,
        location_lng: location.lng,
        location_address: location.address || '',
        updated_time: new Date()
      };

      const result = await update('devices', updateData, { id });
      
      if (result.affectedRows > 0) {
        // 清除缓存
        const device = await this.findById(id);
        if (device) {
          await cache.del(`device:${id}`);
          await cache.del(`device_id:${device.device_id}`);
        }
        
        // 记录位置更新
        logger.logDeviceAction(id, 'location_update', location);
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('更新设备位置失败:', error);
      throw error;
    }
  }

  /**
   * 更新设备权限
   * @param {number} id 设备ID
   * @param {Object} permissions 权限信息
   * @returns {Promise<boolean>}
   */
  static async updatePermissions(id, permissions) {
    try {
      const result = await update('devices', {
        permissions: JSON.stringify(permissions),
        updated_time: new Date()
      }, { id });
      
      if (result.affectedRows > 0) {
        // 清除缓存
        const device = await this.findById(id);
        if (device) {
          await cache.del(`device:${id}`);
          await cache.del(`device_id:${device.device_id}`);
        }
        
        // 记录权限更新
        logger.logDeviceAction(id, 'permissions_update', permissions);
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('更新设备权限失败:', error);
      throw error;
    }
  }

  /**
   * 删除设备
   * @param {number} id 设备ID
   * @returns {Promise<boolean>}
   */
  static async deleteById(id) {
    try {
      const device = await this.findById(id);
      if (!device) {
        return false;
      }

      const result = await update('devices', {
        deleted_time: new Date(),
        updated_time: new Date()
      }, { id });

      if (result.affectedRows > 0) {
        // 清除缓存
        await cache.del(`device:${id}`);
        await cache.del(`device_id:${device.device_id}`);
        
        // 记录设备删除
        logger.logDeviceAction(id, 'delete', {}, device.user_id);
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('删除设备失败:', error);
      throw error;
    }
  }

  /**
   * 获取设备列表
   * @param {Object} options 查询选项
   * @returns {Promise<Object>}
   */
  static async getList(options = {}) {
    try {
      const {
        page = 1,
        pageSize = 20,
        keyword = '',
        status = '',
        userId = null
      } = options;

      let sql = `
        SELECT 
          d.*, u.phone, u.nickname
        FROM devices d
        LEFT JOIN users u ON d.user_id = u.id
        WHERE d.deleted_time IS NULL
      `;
      const params = [];

      // 关键词搜索
      if (keyword) {
        sql += ' AND (d.device_name LIKE ? OR d.device_id LIKE ? OR u.phone LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      }

      // 状态筛选
      if (status) {
        sql += ' AND d.status = ?';
        params.push(status);
      }

      // 用户筛选
      if (userId) {
        sql += ' AND d.user_id = ?';
        params.push(userId);
      }

      sql += ' ORDER BY d.last_online_time DESC';

      // 分页
      const offset = (page - 1) * pageSize;
      sql += ` LIMIT ${offset}, ${pageSize}`;

      const devices = await query(sql, params);
      
      // 解析JSON字段
      devices.forEach(device => {
        device.permissions = JSON.parse(device.permissions || '{}');
        device.settings = JSON.parse(device.settings || '{}');
      });

      // 获取总数
      let countSql = `
        SELECT COUNT(*) as total 
        FROM devices d
        LEFT JOIN users u ON d.user_id = u.id
        WHERE d.deleted_time IS NULL
      `;
      const countParams = [];
      
      if (keyword) {
        countSql += ' AND (d.device_name LIKE ? OR d.device_id LIKE ? OR u.phone LIKE ?)';
        countParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      }
      if (status) {
        countSql += ' AND d.status = ?';
        countParams.push(status);
      }
      if (userId) {
        countSql += ' AND d.user_id = ?';
        countParams.push(userId);
      }

      const countResult = await queryOne(countSql, countParams);
      const total = countResult ? countResult.total : 0;

      return {
        data: devices,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: parseInt(total),
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      logger.error('获取设备列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取在线设备数量
   * @returns {Promise<number>}
   */
  static async getOnlineCount() {
    try {
      const sql = 'SELECT COUNT(*) as count FROM devices WHERE status = "online" AND deleted_time IS NULL';
      const result = await queryOne(sql);
      return result ? result.count : 0;
    } catch (error) {
      logger.error('获取在线设备数量失败:', error);
      throw error;
    }
  }

  /**
   * 获取设备统计信息
   * @returns {Promise<Object>}
   */
  static async getStatistics() {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total_devices,
          COUNT(CASE WHEN status = 'online' THEN 1 END) as online_devices,
          COUNT(CASE WHEN status = 'offline' THEN 1 END) as offline_devices,
          COUNT(CASE WHEN DATE(created_time) = CURDATE() THEN 1 END) as today_new_devices,
          COUNT(CASE WHEN DATE(last_online_time) = CURDATE() THEN 1 END) as today_active_devices
        FROM devices 
        WHERE deleted_time IS NULL
      `;
      
      return await queryOne(sql);
    } catch (error) {
      logger.error('获取设备统计信息失败:', error);
      throw error;
    }
  }

  /**
   * 检查设备是否在线
   * @param {number} id 设备ID
   * @returns {Promise<boolean>}
   */
  static async isOnline(id) {
    try {
      const device = await this.findById(id);
      if (!device) {
        return false;
      }
      
      // 检查设备状态和最后在线时间
      if (device.status !== 'online') {
        return false;
      }
      
      const lastOnlineTime = new Date(device.last_online_time);
      const now = new Date();
      const diffMinutes = (now - lastOnlineTime) / (1000 * 60);
      
      // 如果超过5分钟没有心跳，认为离线
      if (diffMinutes > 5) {
        await this.updateStatus(id, 'offline');
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('检查设备在线状态失败:', error);
      return false;
    }
  }

  /**
   * 设备心跳
   * @param {string} deviceId 设备ID
   * @returns {Promise<boolean>}
   */
  static async heartbeat(deviceId) {
    try {
      const device = await this.findByDeviceId(deviceId);
      if (!device) {
        return false;
      }
      
      return await this.updateStatus(device.id, 'online');
    } catch (error) {
      logger.error('设备心跳失败:', error);
      return false;
    }
  }
}

module.exports = Device;