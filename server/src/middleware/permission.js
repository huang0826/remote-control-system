/**
 * 权限中间件
 */
const Device = require('../models/Device');
const { queryOne } = require('../database/connection');

/**
 * 检查设备权限
 */
const checkDevicePermission = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.id;

    // 查找设备
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 如果是设备所有者，直接通过
    if (device.user_id === userId) {
      req.device = device;
      return next();
    }

    // 检查是否有控制权限
    const controlSql = `
      SELECT * FROM device_controls 
      WHERE controller_id = ? AND controlled_device_id = ? 
      AND status = 'active' AND deleted_time IS NULL
    `;
    const control = await queryOne(controlSql, [userId, deviceId]);
    
    if (!control) {
      return res.status(403).json({
        success: false,
        message: '没有设备访问权限'
      });
    }

    // 将设备信息和控制权限信息添加到请求对象
    req.device = device;
    req.deviceControl = control;
    next();
  } catch (error) {
    console.error('检查设备权限失败:', error);
    res.status(500).json({
      success: false,
      message: '检查设备权限失败'
    });
  }
};

module.exports = {
  checkDevicePermission
};