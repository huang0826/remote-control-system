const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

/**
 * 获取通知列表
 * GET /api/notifications
 * 查询参数:
 * - page: 页码 (默认1)
 * - limit: 每页数量 (默认20)
 * - type: 通知类型 (可选)
 * - status: 状态 (可选: unread, read, all)
 * - start_date: 开始日期 (可选)
 * - end_date: 结束日期 (可选)
 */
router.get('/', auth, notificationController.getNotifications);

/**
 * 获取通知详情
 * GET /api/notifications/:id
 */
router.get('/:id', auth, notificationController.getNotificationDetails);

/**
 * 标记通知为已读
 * PUT /api/notifications/:id/read
 */
router.put('/:id/read', auth, notificationController.markAsRead);

/**
 * 标记通知为未读
 * PUT /api/notifications/:id/unread
 */
router.put('/:id/unread', auth, notificationController.markAsUnread);

/**
 * 批量标记通知为已读
 * PUT /api/notifications/batch/read
 * 请求体:
 * {
 *   "notification_ids": [1, 2, 3]
 * }
 */
router.put('/batch/read', auth, notificationController.batchMarkAsRead);

/**
 * 批量标记通知为未读
 * PUT /api/notifications/batch/unread
 * 请求体:
 * {
 *   "notification_ids": [1, 2, 3]
 * }
 */
router.put('/batch/unread', auth, notificationController.batchMarkAsUnread);

/**
 * 删除通知
 * DELETE /api/notifications/:id
 */
router.delete('/:id', auth, notificationController.deleteNotification);

/**
 * 批量删除通知
 * DELETE /api/notifications/batch
 * 请求体:
 * {
 *   "notification_ids": [1, 2, 3]
 * }
 */
router.delete('/batch', auth, notificationController.batchDeleteNotifications);

/**
 * 清空所有通知
 * DELETE /api/notifications/all
 */
router.delete('/all', auth, notificationController.clearAllNotifications);

/**
 * 获取未读通知数量
 * GET /api/notifications/unread/count
 */
router.get('/unread/count', auth, notificationController.getUnreadCount);

/**
 * 标记所有通知为已读
 * PUT /api/notifications/all/read
 */
router.put('/all/read', auth, notificationController.markAllAsRead);

/**
 * 获取通知设置
 * GET /api/notifications/settings
 */
router.get('/settings', auth, notificationController.getNotificationSettings);

/**
 * 更新通知设置
 * PUT /api/notifications/settings
 * 请求体:
 * {
 *   "email_notifications": true,
 *   "push_notifications": true,
 *   "sms_notifications": false,
 *   "notification_types": {
 *     "device_offline": true,
 *     "device_online": true,
 *     "location_alert": true,
 *     "app_install": false,
 *     "system_update": true
 *   }
 * }
 */
router.put('/settings', auth, notificationController.updateNotificationSettings);

/**
 * 发送测试通知
 * POST /api/notifications/test
 * 请求体:
 * {
 *   "type": "email", // email, push, sms
 *   "message": "测试消息"
 * }
 */
router.post('/test', auth, notificationController.sendTestNotification);

/**
 * 获取通知统计
 * GET /api/notifications/stats
 * 查询参数:
 * - period: 统计周期 (today, week, month, year)
 */
router.get('/stats', auth, notificationController.getNotificationStats);

/**
 * 订阅推送通知
 * POST /api/notifications/subscribe
 * 请求体:
 * {
 *   "endpoint": "https://fcm.googleapis.com/fcm/send/...",
 *   "keys": {
 *     "p256dh": "...",
 *     "auth": "..."
 *   }
 * }
 */
router.post('/subscribe', auth, notificationController.subscribePushNotification);

/**
 * 取消订阅推送通知
 * DELETE /api/notifications/subscribe
 */
router.delete('/subscribe', auth, notificationController.unsubscribePushNotification);

/**
 * 获取通知模板
 * GET /api/notifications/templates
 */
router.get('/templates', auth, notificationController.getNotificationTemplates);

/**
 * 创建自定义通知
 * POST /api/notifications/custom
 * 请求体:
 * {
 *   "title": "自定义通知标题",
 *   "content": "通知内容",
 *   "type": "custom",
 *   "priority": "normal", // low, normal, high
 *   "action_url": "https://example.com" // 可选
 * }
 */
router.post('/custom', auth, notificationController.createCustomNotification);

module.exports = router;