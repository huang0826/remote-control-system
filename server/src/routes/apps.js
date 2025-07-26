/**
 * 应用管理路由
 */

const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { authenticateToken, checkDevicePermission, checkUsageLimit } = require('../middleware/auth');
const appsController = require('../controllers/appsController');

/**
 * 获取设备应用列表
 */
router.get('/:deviceId',
  authenticateToken,
  checkDevicePermission,
  [
    query('category')
      .optional()
      .isIn(['system', 'user', 'all'])
      .withMessage('应用类别无效'),
    query('status')
      .optional()
      .isIn(['enabled', 'disabled', 'all'])
      .withMessage('应用状态无效'),
    query('keyword')
      .optional()
      .isString()
      .withMessage('关键词必须是字符串'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须在1-100之间')
  ],
  appsController.getDeviceApps
);

/**
 * 获取应用详情
 */
router.get('/:deviceId/:packageName',
  authenticateToken,
  checkDevicePermission,
  appsController.getAppDetails
);

/**
 * 启动应用
 */
router.post('/:deviceId/:packageName/launch',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  appsController.launchApp
);

/**
 * 停止应用
 */
router.post('/:deviceId/:packageName/stop',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  appsController.stopApp
);

/**
 * 卸载应用
 */
router.delete('/:deviceId/:packageName',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  appsController.uninstallApp
);

/**
 * 安装应用
 */
router.post('/:deviceId/install',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  [
    body('app_url')
      .optional()
      .isURL()
      .withMessage('应用下载链接格式无效'),
    body('package_name')
      .optional()
      .isString()
      .withMessage('包名必须是字符串'),
    body('install_type')
      .isIn(['url', 'upload', 'store'])
      .withMessage('安装类型无效')
  ],
  appsController.installApp
);

/**
 * 禁用应用
 */
router.post('/:deviceId/:packageName/disable',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  appsController.disableApp
);

/**
 * 启用应用
 */
router.post('/:deviceId/:packageName/enable',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  appsController.enableApp
);

/**
 * 清除应用数据
 */
router.post('/:deviceId/:packageName/clear-data',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  appsController.clearAppData
);

/**
 * 清除应用缓存
 */
router.post('/:deviceId/:packageName/clear-cache',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  appsController.clearAppCache
);

/**
 * 获取应用权限
 */
router.get('/:deviceId/:packageName/permissions',
  authenticateToken,
  checkDevicePermission,
  appsController.getAppPermissions
);

/**
 * 设置应用权限
 */
router.post('/:deviceId/:packageName/permissions',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  [
    body('permissions')
      .isArray()
      .withMessage('权限列表必须是数组'),
    body('permissions.*.permission')
      .isString()
      .withMessage('权限名称必须是字符串'),
    body('permissions.*.granted')
      .isBoolean()
      .withMessage('权限状态必须是布尔值')
  ],
  appsController.setAppPermissions
);

/**
 * 获取应用使用统计
 */
router.get('/:deviceId/:packageName/usage',
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
  appsController.getAppUsage
);

/**
 * 获取设备应用使用统计
 */
router.get('/:deviceId/usage/stats',
  authenticateToken,
  checkDevicePermission,
  [
    query('period')
      .optional()
      .isIn(['today', 'week', 'month'])
      .withMessage('统计周期无效'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('限制数量必须在1-50之间')
  ],
  appsController.getDeviceAppUsageStats
);

/**
 * 设置应用限制
 */
router.post('/:deviceId/:packageName/restrictions',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  [
    body('time_limit')
      .optional()
      .isInt({ min: 0 })
      .withMessage('时间限制必须是非负整数'),
    body('blocked_times')
      .optional()
      .isArray()
      .withMessage('禁用时间段必须是数组'),
    body('blocked_times.*.start')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('开始时间格式无效'),
    body('blocked_times.*.end')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('结束时间格式无效'),
    body('allowed_days')
      .optional()
      .isArray()
      .withMessage('允许天数必须是数组'),
    body('password_required')
      .optional()
      .isBoolean()
      .withMessage('密码要求必须是布尔值')
  ],
  appsController.setAppRestrictions
);

/**
 * 获取应用限制
 */
router.get('/:deviceId/:packageName/restrictions',
  authenticateToken,
  checkDevicePermission,
  appsController.getAppRestrictions
);

/**
 * 移除应用限制
 */
router.delete('/:deviceId/:packageName/restrictions',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  appsController.removeAppRestrictions
);

/**
 * 批量操作应用
 */
router.post('/:deviceId/batch',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  [
    body('action')
      .isIn(['enable', 'disable', 'uninstall', 'clear_cache', 'clear_data'])
      .withMessage('批量操作类型无效'),
    body('package_names')
      .isArray({ min: 1 })
      .withMessage('包名列表不能为空'),
    body('package_names.*')
      .isString()
      .withMessage('包名必须是字符串')
  ],
  appsController.batchAppOperation
);

/**
 * 获取应用商店应用
 */
router.get('/store/search',
  authenticateToken,
  [
    query('keyword')
      .optional()
      .isString()
      .withMessage('关键词必须是字符串'),
    query('category')
      .optional()
      .isString()
      .withMessage('分类必须是字符串'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('每页数量必须在1-50之间')
  ],
  appsController.searchStoreApps
);

/**
 * 获取应用商店分类
 */
router.get('/store/categories',
  authenticateToken,
  appsController.getStoreCategories
);

/**
 * 获取推荐应用
 */
router.get('/store/featured',
  authenticateToken,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('限制数量必须在1-20之间')
  ],
  appsController.getFeaturedApps
);

/**
 * 获取应用更新列表
 */
router.get('/:deviceId/updates',
  authenticateToken,
  checkDevicePermission,
  appsController.getAppUpdates
);

/**
 * 更新应用
 */
router.post('/:deviceId/:packageName/update',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  appsController.updateApp
);

/**
 * 批量更新应用
 */
router.post('/:deviceId/update-all',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  [
    body('package_names')
      .optional()
      .isArray()
      .withMessage('包名列表必须是数组'),
    body('auto_update')
      .optional()
      .isBoolean()
      .withMessage('自动更新必须是布尔值')
  ],
  appsController.batchUpdateApps
);

/**
 * 获取应用安装历史
 */
router.get('/:deviceId/install-history',
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
    query('action')
      .optional()
      .isIn(['install', 'uninstall', 'update'])
      .withMessage('操作类型无效'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须在1-100之间')
  ],
  appsController.getInstallHistory
);

/**
 * 创建应用快捷方式
 */
router.post('/:deviceId/:packageName/shortcut',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  [
    body('shortcut_name')
      .notEmpty()
      .withMessage('快捷方式名称不能为空'),
    body('icon_url')
      .optional()
      .isURL()
      .withMessage('图标链接格式无效'),
    body('target_activity')
      .optional()
      .isString()
      .withMessage('目标活动必须是字符串')
  ],
  appsController.createAppShortcut
);

/**
 * 获取应用快捷方式
 */
router.get('/:deviceId/shortcuts',
  authenticateToken,
  checkDevicePermission,
  appsController.getAppShortcuts
);

/**
 * 删除应用快捷方式
 */
router.delete('/:deviceId/shortcuts/:shortcutId',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  appsController.deleteAppShortcut
);

/**
 * 设置默认应用
 */
router.post('/:deviceId/default-apps',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  [
    body('category')
      .isIn(['browser', 'launcher', 'dialer', 'sms', 'camera', 'gallery', 'music', 'video'])
      .withMessage('应用类别无效'),
    body('package_name')
      .notEmpty()
      .withMessage('包名不能为空')
  ],
  appsController.setDefaultApp
);

/**
 * 获取默认应用
 */
router.get('/:deviceId/default-apps',
  authenticateToken,
  checkDevicePermission,
  appsController.getDefaultApps
);

/**
 * 重置默认应用
 */
router.delete('/:deviceId/default-apps/:category',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  appsController.resetDefaultApp
);

/**
 * 获取应用网络使用情况
 */
router.get('/:deviceId/:packageName/network-usage',
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
  appsController.getAppNetworkUsage
);

/**
 * 设置应用网络限制
 */
router.post('/:deviceId/:packageName/network-restrictions',
  authenticateToken,
  checkDevicePermission,
  checkUsageLimit('app_control'),
  [
    body('wifi_allowed')
      .optional()
      .isBoolean()
      .withMessage('WiFi权限必须是布尔值'),
    body('mobile_data_allowed')
      .optional()
      .isBoolean()
      .withMessage('移动数据权限必须是布尔值'),
    body('background_data_allowed')
      .optional()
      .isBoolean()
      .withMessage('后台数据权限必须是布尔值'),
    body('data_limit')
      .optional()
      .isInt({ min: 0 })
      .withMessage('数据限制必须是非负整数')
  ],
  appsController.setAppNetworkRestrictions
);

/**
 * 获取应用网络限制
 */
router.get('/:deviceId/:packageName/network-restrictions',
  authenticateToken,
  checkDevicePermission,
  appsController.getAppNetworkRestrictions
);

module.exports = router;