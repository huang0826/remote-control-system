/**
 * 应用管理路由
 */

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { authenticateToken, checkDevicePermission, checkUsageLimit } = require('../middleware/auth');
const appController = require('../controllers/appController');

/**
 * 获取应用使用记录
 */
router.get('/usage/:deviceId',
  authenticateToken,
  checkDevicePermission,
  appController.getAppUsageRecords
);

/**
 * 开始/停止应用使用记录
 */
router.post('/usage/:deviceId',
  authenticateToken,
  checkDevicePermission,
  [
    body('action')
      .isIn(['start', 'stop'])
      .withMessage('操作类型必须是start或stop')
  ],
  appController.toggleAppUsageTracking
);

/**
 * 获取已安装应用
 */
router.get('/installed/:deviceId',
  authenticateToken,
  checkDevicePermission,
  appController.getInstalledApps
);

/**
 * 隐藏/显示应用
 */
router.post('/visibility/:deviceId',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  [
    body('package_name')
      .notEmpty()
      .withMessage('应用包名不能为空'),
    body('action')
      .isIn(['hide', 'show'])
      .withMessage('操作类型必须是hide或show')
  ],
  appController.toggleAppVisibility
);

/**
 * 获取应用使用统计
 */
router.get('/stats/:deviceId',
  authenticateToken,
  checkDevicePermission,
  appController.getAppUsageStats
);

module.exports = router;