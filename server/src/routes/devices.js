/**
 * 设备路由
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { validateRequest } = require('../middleware/validator');
const { checkDevicePermission } = require('../middleware/permission');
const {
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
} = require('../controllers/deviceController');

// 注册设备
router.post('/register', [
  body('device_id').notEmpty().withMessage('设备ID不能为空'),
  body('device_name').optional(),
  body('device_model').optional(),
  body('device_brand').optional(),
  body('system_version').optional(),
  body('app_version').optional(),
  body('screen_width').optional().isInt(),
  body('screen_height').optional().isInt(),
  validateRequest
], registerDevice);

// 获取设备详情
router.get('/:deviceId', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  validateRequest,
  checkDevicePermission
], getDevice);

// 更新设备信息
router.put('/:deviceId', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  body('device_name').optional(),
  body('status').optional().isIn(['online', 'offline']),
  body('permissions').optional().isArray(),
  body('settings').optional().isObject(),
  validateRequest,
  checkDevicePermission
], updateDevice);

// 设备心跳
router.post('/heartbeat', [
  body('device_id').notEmpty().withMessage('设备ID不能为空'),
  validateRequest
], heartbeat);

// 更新设备位置
router.post('/:deviceId/location', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  body('lat').isFloat().withMessage('纬度必须是数字'),
  body('lng').isFloat().withMessage('经度必须是数字'),
  body('address').optional(),
  body('accuracy').optional().isFloat(),
  body('altitude').optional().isFloat(),
  body('speed').optional().isFloat(),
  body('bearing').optional().isFloat(),
  validateRequest,
  checkDevicePermission
], updateLocation);

// 获取设备位置历史
router.get('/:deviceId/location/history', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  query('start_date').optional().isISO8601(),
  query('end_date').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  validateRequest,
  checkDevicePermission
], getLocationHistory);

// 添加设备控制关系
router.post('/control', [
  body('target_user_id').isInt().withMessage('目标用户ID必须是数字'),
  body('device_id').notEmpty().withMessage('设备ID不能为空'),
  body('permissions').optional().isArray(),
  validateRequest
], addDeviceControl);

// 获取可控制的设备列表
router.get('/control/list', getDeviceControllers);

// 移除设备控制关系
router.delete('/control/:controlId', [
  param('controlId').isInt().withMessage('控制关系ID必须是数字'),
  validateRequest
], removeDeviceController);

// 删除设备
router.delete('/:deviceId', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  validateRequest,
  checkDevicePermission
], remove);

// 获取设备统计信息
router.get('/stats/overview', getStats);

// 获取设备权限列表
router.get('/:deviceId/permissions', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  validateRequest,
  checkDevicePermission
], getDevicePermissions);

// 更新设备权限
router.put('/:deviceId/permissions', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  body('permissions').isArray().withMessage('权限必须是数组'),
  validateRequest,
  checkDevicePermission
], updateDevicePermissions);

// 获取设备应用列表
router.get('/:deviceId/apps', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  validateRequest,
  checkDevicePermission
], getDeviceApps);

// 更新设备应用列表
router.put('/:deviceId/apps', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  body('apps').isArray().withMessage('应用列表必须是数组'),
  validateRequest,
  checkDevicePermission
], updateDeviceApps);

// 设备远程锁定
router.post('/:deviceId/lock', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  validateRequest,
  checkDevicePermission
], lockDevice);

// 设备远程解锁
router.post('/:deviceId/unlock', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  validateRequest,
  checkDevicePermission
], unlockDevice);

// 设备远程擦除
router.post('/:deviceId/wipe', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  validateRequest,
  checkDevicePermission
], wipeDevice);

module.exports = router;