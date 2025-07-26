/**
 * 位置追踪路由
 */

const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { authenticateToken, checkDevicePermission, checkUsageLimit } = require('../middleware/auth');
const locationController = require('../controllers/locationController');

/**
 * 获取设备当前位置
 */
router.get('/current/:deviceId',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('location_tracking'),
  locationController.getCurrentLocation
);

/**
 * 开始位置追踪
 */
router.post('/start/:deviceId',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('location_tracking'),
  [
    body('interval')
      .optional()
      .isInt({ min: 30, max: 3600 })
      .withMessage('追踪间隔必须在30-3600秒之间'),
    body('duration')
      .optional()
      .isInt({ min: 300, max: 86400 })
      .withMessage('追踪时长必须在5分钟-24小时之间'),
    body('high_accuracy')
      .optional()
      .isBoolean()
      .withMessage('高精度模式必须是布尔值')
  ],
  locationController.startLocationTracking
);

/**
 * 停止位置追踪
 */
router.post('/stop/:deviceId',
  authenticateToken,
  checkDevicePermission,
  locationController.stopLocationTracking
);

/**
 * 获取位置历史记录
 */
router.get('/history/:deviceId',
  authenticateToken,
  checkDevicePermission,
  [
    query('start_date')
      .optional()
      .isISO8601()
      .withMessage('开始日期格式无效'),
    query('end_date')
      .optional()
      .isISO8601()
      .withMessage('结束日期格式无效'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('每页数量必须在1-1000之间')
  ],
  locationController.getLocationHistory
);

/**
 * 保存位置记录
 */
router.post('/save/:deviceId',
  authenticateToken,
  checkDevicePermission,
  [
    body('latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('纬度必须在-90到90之间'),
    body('longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('经度必须在-180到180之间'),
    body('accuracy')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('精度必须是正数'),
    body('altitude')
      .optional()
      .isFloat()
      .withMessage('海拔必须是数字'),
    body('speed')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('速度必须是正数'),
    body('bearing')
      .optional()
      .isFloat({ min: 0, max: 360 })
      .withMessage('方向必须在0-360度之间'),
    body('address')
      .optional()
      .isString()
      .withMessage('地址必须是字符串')
  ],
  locationController.saveLocationRecord
);

/**
 * 获取设备足迹统计
 */
router.get('/stats/:deviceId',
  authenticateToken,
  checkDevicePermission,
  [
    query('start_date')
      .optional()
      .isISO8601()
      .withMessage('开始日期格式无效'),
    query('end_date')
      .optional()
      .isISO8601()
      .withMessage('结束日期格式无效')
  ],
  locationController.getLocationStats
);

/**
 * 删除位置记录
 */
router.delete('/:deviceId',
  authenticateToken,
  checkDevicePermission,
  [
    body('record_ids')
      .optional()
      .isArray()
      .withMessage('记录ID列表必须是数组'),
    body('start_date')
      .optional()
      .isISO8601()
      .withMessage('开始日期格式无效'),
    body('end_date')
      .optional()
      .isISO8601()
      .withMessage('结束日期格式无效')
  ],
  locationController.deleteLocationRecords
);

/**
 * 设置地理围栏
 */
router.post('/geofence/:deviceId',
  authenticateToken,
  checkDevicePermission,
  [
    body('name')
      .notEmpty()
      .withMessage('围栏名称不能为空'),
    body('center_latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('中心纬度必须在-90到90之间'),
    body('center_longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('中心经度必须在-180到180之间'),
    body('radius')
      .isFloat({ min: 10, max: 10000 })
      .withMessage('半径必须在10-10000米之间'),
    body('alert_type')
      .isIn(['enter', 'exit', 'both'])
      .withMessage('警报类型无效'),
    body('enabled')
      .optional()
      .isBoolean()
      .withMessage('启用状态必须是布尔值')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '输入验证失败',
          errors: errors.array()
        });
      }
      
      const { deviceId } = req.params;
      const { name, center_latitude, center_longitude, radius, alert_type, enabled = true } = req.body;
      const { insert } = require('../database/connection');
      
      // 创建地理围栏
      const geofenceId = await insert('geofences', {
        device_id: deviceId,
        user_id: req.user.id,
        name,
        center_latitude,
        center_longitude,
        radius,
        alert_type,
        enabled,
        created_time: new Date()
      });
      
      res.json({
        success: true,
        message: '地理围栏已创建',
        data: {
          geofence_id: geofenceId
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '创建地理围栏失败'
      });
    }
  }
);

/**
 * 获取地理围栏列表
 */
router.get('/geofences/:deviceId',
  authenticateToken,
  checkDevicePermission,
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { query } = require('../database/connection');
      
      const geofences = await query(`
        SELECT *
        FROM geofences
        WHERE device_id = ? AND user_id = ?
        ORDER BY created_time DESC
      `, [deviceId, req.user.id]);
      
      res.json({
        success: true,
        data: {
          geofences
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取地理围栏列表失败'
      });
    }
  }
);

/**
 * 更新地理围栏
 */
router.put('/geofence/:geofenceId',
  authenticateToken,
  [
    body('name')
      .optional()
      .isString()
      .withMessage('围栏名称必须是字符串'),
    body('center_latitude')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('中心纬度必须在-90到90之间'),
    body('center_longitude')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('中心经度必须在-180到180之间'),
    body('radius')
      .optional()
      .isFloat({ min: 10, max: 10000 })
      .withMessage('半径必须在10-10000米之间'),
    body('alert_type')
      .optional()
      .isIn(['enter', 'exit', 'both'])
      .withMessage('警报类型无效'),
    body('enabled')
      .optional()
      .isBoolean()
      .withMessage('启用状态必须是布尔值')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '输入验证失败',
          errors: errors.array()
        });
      }
      
      const { geofenceId } = req.params;
      const { queryOne, update } = require('../database/connection');
      
      // 检查围栏是否存在
      const geofence = await queryOne(
        'SELECT * FROM geofences WHERE id = ? AND user_id = ?',
        [geofenceId, req.user.id]
      );
      
      if (!geofence) {
        return res.status(404).json({
          success: false,
          message: '地理围栏不存在'
        });
      }
      
      // 更新围栏信息
      const updateData = {
        updated_time: new Date()
      };
      
      const allowedFields = ['name', 'center_latitude', 'center_longitude', 'radius', 'alert_type', 'enabled'];
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });
      
      await update('geofences', updateData, { id: geofenceId });
      
      res.json({
        success: true,
        message: '地理围栏已更新'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '更新地理围栏失败'
      });
    }
  }
);

/**
 * 删除地理围栏
 */
router.delete('/geofence/:geofenceId',
  authenticateToken,
  async (req, res) => {
    try {
      const { geofenceId } = req.params;
      const { queryOne, deleteRecord } = require('../database/connection');
      
      // 检查围栏是否存在
      const geofence = await queryOne(
        'SELECT * FROM geofences WHERE id = ? AND user_id = ?',
        [geofenceId, req.user.id]
      );
      
      if (!geofence) {
        return res.status(404).json({
          success: false,
          message: '地理围栏不存在'
        });
      }
      
      // 删除围栏
      await deleteRecord('geofences', { id: geofenceId });
      
      res.json({
        success: true,
        message: '地理围栏已删除'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '删除地理围栏失败'
      });
    }
  }
);

/**
 * 获取位置警报记录
 */
router.get('/alerts/:deviceId',
  authenticateToken,
  checkDevicePermission,
  [
    query('alert_type')
      .optional()
      .isIn(['movement', 'geofence_enter', 'geofence_exit', 'speed_limit'])
      .withMessage('警报类型无效'),
    query('start_date')
      .optional()
      .isISO8601()
      .withMessage('开始日期格式无效'),
    query('end_date')
      .optional()
      .isISO8601()
      .withMessage('结束日期格式无效'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须在1-100之间')
  ],
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { alert_type, start_date, end_date, page = 1, limit = 20 } = req.query;
      const { query, queryOne } = require('../database/connection');
      
      // 构建查询条件
      let whereClause = 'WHERE device_id = ? AND user_id = ?';
      const params = [deviceId, req.user.id];
      
      if (alert_type) {
        whereClause += ' AND alert_type = ?';
        params.push(alert_type);
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
      const countResult = await queryOne(`
        SELECT COUNT(*) as total 
        FROM location_alerts 
        ${whereClause}
      `, params);
      const total = countResult.total;
      
      // 获取分页数据
      const offset = (page - 1) * limit;
      const alerts = await query(`
        SELECT 
          la.*,
          g.name as geofence_name
        FROM location_alerts la
        LEFT JOIN geofences g ON la.geofence_id = g.id
        ${whereClause}
        ORDER BY la.created_time DESC
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), offset]);
      
      res.json({
        success: true,
        data: {
          alerts: alerts.map(alert => ({
            ...alert,
            alert_data: alert.alert_data ? JSON.parse(alert.alert_data) : null
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
      res.status(500).json({
        success: false,
        message: '获取位置警报记录失败'
      });
    }
  }
);

/**
 * 标记警报为已读
 */
router.post('/alerts/:alertId/read',
  authenticateToken,
  async (req, res) => {
    try {
      const { alertId } = req.params;
      const { queryOne, update } = require('../database/connection');
      
      // 检查警报是否存在
      const alert = await queryOne(
        'SELECT * FROM location_alerts WHERE id = ? AND user_id = ?',
        [alertId, req.user.id]
      );
      
      if (!alert) {
        return res.status(404).json({
          success: false,
          message: '警报记录不存在'
        });
      }
      
      // 标记为已读
      await update('location_alerts', {
        is_read: true,
        read_time: new Date()
      }, { id: alertId });
      
      res.json({
        success: true,
        message: '警报已标记为已读'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '标记警报失败'
      });
    }
  }
);

/**
 * 批量标记警报为已读
 */
router.post('/alerts/batch-read',
  authenticateToken,
  [
    body('alert_ids')
      .isArray({ min: 1 })
      .withMessage('警报ID列表不能为空'),
    body('alert_ids.*')
      .isInt({ min: 1 })
      .withMessage('警报ID必须是正整数')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '输入验证失败',
          errors: errors.array()
        });
      }
      
      const { alert_ids } = req.body;
      const { query } = require('../database/connection');
      
      // 批量更新
      const placeholders = alert_ids.map(() => '?').join(',');
      await query(`
        UPDATE location_alerts 
        SET is_read = true, read_time = NOW()
        WHERE id IN (${placeholders}) AND user_id = ?
      `, [...alert_ids, req.user.id]);
      
      res.json({
        success: true,
        message: '警报已批量标记为已读'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '批量标记警报失败'
      });
    }
  }
);

module.exports = router;