const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const systemController = require('../controllers/systemController');

/**
 * 获取系统信息
 * GET /api/system/info
 */
router.get('/info', systemController.getSystemInfo);

/**
 * 获取系统状态
 * GET /api/system/status
 */
router.get('/status', systemController.getSystemStatus);

/**
 * 获取系统配置
 * GET /api/system/config
 */
router.get('/config', auth, systemController.getSystemConfig);

/**
 * 更新系统配置
 * PUT /api/system/config
 * 请求体:
 * {
 *   "app_name": "应用名称",
 *   "app_version": "1.0.0",
 *   "maintenance_mode": false,
 *   "registration_enabled": true,
 *   "max_devices_per_user": 10,
 *   "file_upload_limit": 104857600,
 *   "session_timeout": 3600
 * }
 */
router.put('/config', auth, systemController.updateSystemConfig);

/**
 * 获取系统统计
 * GET /api/system/stats
 * 查询参数:
 * - period: 统计周期 (today, week, month, year)
 */
router.get('/stats', auth, systemController.getSystemStats);

/**
 * 获取系统日志
 * GET /api/system/logs
 * 查询参数:
 * - page: 页码 (默认1)
 * - limit: 每页数量 (默认50)
 * - level: 日志级别 (error, warn, info, debug)
 * - start_date: 开始日期
 * - end_date: 结束日期
 * - keyword: 关键词搜索
 */
router.get('/logs', auth, systemController.getSystemLogs);

/**
 * 清理系统日志
 * DELETE /api/system/logs
 * 请求体:
 * {
 *   "days": 30 // 保留最近30天的日志
 * }
 */
router.delete('/logs', auth, systemController.cleanupLogs);

/**
 * 获取系统健康检查
 * GET /api/system/health
 */
router.get('/health', systemController.healthCheck);

/**
 * 获取数据库状态
 * GET /api/system/database
 */
router.get('/database', auth, systemController.getDatabaseStatus);

/**
 * 获取Redis状态
 * GET /api/system/redis
 */
router.get('/redis', auth, systemController.getRedisStatus);

/**
 * 获取服务器资源使用情况
 * GET /api/system/resources
 */
router.get('/resources', auth, systemController.getServerResources);

/**
 * 获取API使用统计
 * GET /api/system/api-stats
 * 查询参数:
 * - period: 统计周期 (hour, day, week, month)
 * - endpoint: 特定端点 (可选)
 */
router.get('/api-stats', auth, systemController.getApiStats);

/**
 * 获取错误统计
 * GET /api/system/error-stats
 * 查询参数:
 * - period: 统计周期 (today, week, month)
 */
router.get('/error-stats', auth, systemController.getErrorStats);

/**
 * 系统备份
 * POST /api/system/backup
 * 请求体:
 * {
 *   "type": "full", // full, database, files
 *   "description": "备份描述"
 * }
 */
router.post('/backup', auth, systemController.createBackup);

/**
 * 获取备份列表
 * GET /api/system/backups
 * 查询参数:
 * - page: 页码 (默认1)
 * - limit: 每页数量 (默认20)
 */
router.get('/backups', auth, systemController.getBackups);

/**
 * 恢复备份
 * POST /api/system/restore/:backupId
 */
router.post('/restore/:backupId', auth, systemController.restoreBackup);

/**
 * 删除备份
 * DELETE /api/system/backups/:backupId
 */
router.delete('/backups/:backupId', auth, systemController.deleteBackup);

/**
 * 获取系统更新信息
 * GET /api/system/updates
 */
router.get('/updates', auth, systemController.getSystemUpdates);

/**
 * 执行系统更新
 * POST /api/system/update
 * 请求体:
 * {
 *   "version": "1.1.0",
 *   "force": false
 * }
 */
router.post('/update', auth, systemController.performSystemUpdate);

/**
 * 重启系统服务
 * POST /api/system/restart
 * 请求体:
 * {
 *   "service": "all" // all, api, socket, scheduler
 * }
 */
router.post('/restart', auth, systemController.restartService);

/**
 * 获取系统通知
 * GET /api/system/announcements
 */
router.get('/announcements', systemController.getSystemAnnouncements);

/**
 * 创建系统通知
 * POST /api/system/announcements
 * 请求体:
 * {
 *   "title": "通知标题",
 *   "content": "通知内容",
 *   "type": "info", // info, warning, error, success
 *   "target_users": "all", // all, premium, specific
 *   "user_ids": [1, 2, 3], // 当target_users为specific时
 *   "start_time": "2024-01-01T00:00:00Z",
 *   "end_time": "2024-01-31T23:59:59Z"
 * }
 */
router.post('/announcements', auth, systemController.createSystemAnnouncement);

/**
 * 更新系统通知
 * PUT /api/system/announcements/:id
 */
router.put('/announcements/:id', auth, systemController.updateSystemAnnouncement);

/**
 * 删除系统通知
 * DELETE /api/system/announcements/:id
 */
router.delete('/announcements/:id', auth, systemController.deleteSystemAnnouncement);

/**
 * 获取系统维护状态
 * GET /api/system/maintenance
 */
router.get('/maintenance', systemController.getMaintenanceStatus);

/**
 * 设置系统维护模式
 * POST /api/system/maintenance
 * 请求体:
 * {
 *   "enabled": true,
 *   "message": "系统维护中，预计1小时后恢复",
 *   "start_time": "2024-01-01T02:00:00Z",
 *   "end_time": "2024-01-01T03:00:00Z"
 * }
 */
router.post('/maintenance', auth, systemController.setMaintenanceMode);

/**
 * 获取系统缓存状态
 * GET /api/system/cache
 */
router.get('/cache', auth, systemController.getCacheStatus);

/**
 * 清理系统缓存
 * DELETE /api/system/cache
 * 请求体:
 * {
 *   "type": "all" // all, redis, memory, files
 * }
 */
router.delete('/cache', auth, systemController.clearCache);

/**
 * 获取系统队列状态
 * GET /api/system/queues
 */
router.get('/queues', auth, systemController.getQueueStatus);

/**
 * 清理系统队列
 * DELETE /api/system/queues/:queueName
 */
router.delete('/queues/:queueName', auth, systemController.clearQueue);

/**
 * 获取系统许可证信息
 * GET /api/system/license
 */
router.get('/license', auth, systemController.getLicenseInfo);

/**
 * 更新系统许可证
 * PUT /api/system/license
 * 请求体:
 * {
 *   "license_key": "XXXX-XXXX-XXXX-XXXX"
 * }
 */
router.put('/license', auth, systemController.updateLicense);

module.exports = router;