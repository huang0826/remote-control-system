const { query, queryOne, insert, update, deleteRecord } = require('../utils/database');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/email');
const { sendSMS } = require('../utils/sms');
const { sendPushNotification } = require('../utils/push');
const redis = require('../utils/redis');

/**
 * 获取通知列表
 */
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status, start_date, end_date } = req.query;
    const userId = req.user.id;
    const offset = (page - 1) * limit;
    
    // 构建查询条件
    let whereClause = 'WHERE user_id = ?';
    const params = [userId];
    
    if (type) {
      whereClause += ' AND type = ?';
      params.push(type);
    }
    
    if (status && status !== 'all') {
      if (status === 'unread') {
        whereClause += ' AND is_read = 0';
      } else if (status === 'read') {
        whereClause += ' AND is_read = 1';
      }
    }
    
    if (start_date) {
      whereClause += ' AND DATE(created_time) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      whereClause += ' AND DATE(created_time) <= ?';
      params.push(end_date);
    }
    
    // 获取通知列表
    const notifications = await query(`
      SELECT 
        id,
        title,
        content,
        type,
        priority,
        is_read,
        action_url,
        created_time
      FROM notifications
      ${whereClause}
      ORDER BY created_time DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
    
    // 获取总数
    const totalResult = await queryOne(`
      SELECT COUNT(*) as total
      FROM notifications
      ${whereClause}
    `, params);
    
    const total = totalResult.total;
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_items: total,
          items_per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('获取通知列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取通知列表失败'
    });
  }
};

/**
 * 获取通知详情
 */
const getNotificationDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const notification = await queryOne(`
      SELECT *
      FROM notifications
      WHERE id = ? AND user_id = ?
    `, [id, userId]);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: '通知不存在'
      });
    }
    
    // 如果通知未读，标记为已读
    if (!notification.is_read) {
      await update('notifications', {
        is_read: 1,
        read_time: new Date()
      }, { id, user_id: userId });
      
      notification.is_read = 1;
      notification.read_time = new Date();
    }
    
    res.json({
      success: true,
      data: {
        notification
      }
    });
  } catch (error) {
    logger.error('获取通知详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取通知详情失败'
    });
  }
};

/**
 * 标记通知为已读
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const notification = await queryOne(`
      SELECT id
      FROM notifications
      WHERE id = ? AND user_id = ?
    `, [id, userId]);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: '通知不存在'
      });
    }
    
    await update('notifications', {
      is_read: 1,
      read_time: new Date()
    }, { id, user_id: userId });
    
    res.json({
      success: true,
      message: '通知已标记为已读'
    });
  } catch (error) {
    logger.error('标记通知为已读失败:', error);
    res.status(500).json({
      success: false,
      message: '标记通知为已读失败'
    });
  }
};

/**
 * 标记通知为未读
 */
const markAsUnread = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const notification = await queryOne(`
      SELECT id
      FROM notifications
      WHERE id = ? AND user_id = ?
    `, [id, userId]);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: '通知不存在'
      });
    }
    
    await update('notifications', {
      is_read: 0,
      read_time: null
    }, { id, user_id: userId });
    
    res.json({
      success: true,
      message: '通知已标记为未读'
    });
  } catch (error) {
    logger.error('标记通知为未读失败:', error);
    res.status(500).json({
      success: false,
      message: '标记通知为未读失败'
    });
  }
};

/**
 * 批量标记通知为已读
 */
const batchMarkAsRead = async (req, res) => {
  try {
    const { notification_ids } = req.body;
    const userId = req.user.id;
    
    if (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的通知ID列表'
      });
    }
    
    // 验证通知是否属于当前用户
    const placeholders = notification_ids.map(() => '?').join(',');
    const notifications = await query(`
      SELECT id
      FROM notifications
      WHERE id IN (${placeholders}) AND user_id = ?
    `, [...notification_ids, userId]);
    
    if (notifications.length !== notification_ids.length) {
      return res.status(400).json({
        success: false,
        message: '部分通知不存在或无权限访问'
      });
    }
    
    // 批量更新
    await query(`
      UPDATE notifications
      SET is_read = 1, read_time = ?
      WHERE id IN (${placeholders}) AND user_id = ?
    `, [new Date(), ...notification_ids, userId]);
    
    res.json({
      success: true,
      message: `已标记 ${notification_ids.length} 条通知为已读`
    });
  } catch (error) {
    logger.error('批量标记通知为已读失败:', error);
    res.status(500).json({
      success: false,
      message: '批量标记通知为已读失败'
    });
  }
};

/**
 * 批量标记通知为未读
 */
const batchMarkAsUnread = async (req, res) => {
  try {
    const { notification_ids } = req.body;
    const userId = req.user.id;
    
    if (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的通知ID列表'
      });
    }
    
    // 验证通知是否属于当前用户
    const placeholders = notification_ids.map(() => '?').join(',');
    const notifications = await query(`
      SELECT id
      FROM notifications
      WHERE id IN (${placeholders}) AND user_id = ?
    `, [...notification_ids, userId]);
    
    if (notifications.length !== notification_ids.length) {
      return res.status(400).json({
        success: false,
        message: '部分通知不存在或无权限访问'
      });
    }
    
    // 批量更新
    await query(`
      UPDATE notifications
      SET is_read = 0, read_time = NULL
      WHERE id IN (${placeholders}) AND user_id = ?
    `, [...notification_ids, userId]);
    
    res.json({
      success: true,
      message: `已标记 ${notification_ids.length} 条通知为未读`
    });
  } catch (error) {
    logger.error('批量标记通知为未读失败:', error);
    res.status(500).json({
      success: false,
      message: '批量标记通知为未读失败'
    });
  }
};

/**
 * 删除通知
 */
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const notification = await queryOne(`
      SELECT id
      FROM notifications
      WHERE id = ? AND user_id = ?
    `, [id, userId]);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: '通知不存在'
      });
    }
    
    await deleteRecord('notifications', { id, user_id: userId });
    
    res.json({
      success: true,
      message: '通知已删除'
    });
  } catch (error) {
    logger.error('删除通知失败:', error);
    res.status(500).json({
      success: false,
      message: '删除通知失败'
    });
  }
};

/**
 * 批量删除通知
 */
const batchDeleteNotifications = async (req, res) => {
  try {
    const { notification_ids } = req.body;
    const userId = req.user.id;
    
    if (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的通知ID列表'
      });
    }
    
    // 验证通知是否属于当前用户
    const placeholders = notification_ids.map(() => '?').join(',');
    const notifications = await query(`
      SELECT id
      FROM notifications
      WHERE id IN (${placeholders}) AND user_id = ?
    `, [...notification_ids, userId]);
    
    if (notifications.length !== notification_ids.length) {
      return res.status(400).json({
        success: false,
        message: '部分通知不存在或无权限访问'
      });
    }
    
    // 批量删除
    await query(`
      DELETE FROM notifications
      WHERE id IN (${placeholders}) AND user_id = ?
    `, [...notification_ids, userId]);
    
    res.json({
      success: true,
      message: `已删除 ${notification_ids.length} 条通知`
    });
  } catch (error) {
    logger.error('批量删除通知失败:', error);
    res.status(500).json({
      success: false,
      message: '批量删除通知失败'
    });
  }
};

/**
 * 清空所有通知
 */
const clearAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await query(`
      DELETE FROM notifications
      WHERE user_id = ?
    `, [userId]);
    
    res.json({
      success: true,
      message: `已清空所有通知，共删除 ${result.affectedRows} 条`
    });
  } catch (error) {
    logger.error('清空所有通知失败:', error);
    res.status(500).json({
      success: false,
      message: '清空所有通知失败'
    });
  }
};

/**
 * 获取未读通知数量
 */
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await queryOne(`
      SELECT COUNT(*) as unread_count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
    `, [userId]);
    
    res.json({
      success: true,
      data: {
        unread_count: result.unread_count
      }
    });
  } catch (error) {
    logger.error('获取未读通知数量失败:', error);
    res.status(500).json({
      success: false,
      message: '获取未读通知数量失败'
    });
  }
};

/**
 * 标记所有通知为已读
 */
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await query(`
      UPDATE notifications
      SET is_read = 1, read_time = ?
      WHERE user_id = ? AND is_read = 0
    `, [new Date(), userId]);
    
    res.json({
      success: true,
      message: `已标记 ${result.affectedRows} 条通知为已读`
    });
  } catch (error) {
    logger.error('标记所有通知为已读失败:', error);
    res.status(500).json({
      success: false,
      message: '标记所有通知为已读失败'
    });
  }
};

/**
 * 获取通知设置
 */
const getNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    
    let settings = await queryOne(`
      SELECT *
      FROM notification_settings
      WHERE user_id = ?
    `, [userId]);
    
    // 如果没有设置记录，创建默认设置
    if (!settings) {
      const defaultSettings = {
        user_id: userId,
        email_notifications: 1,
        push_notifications: 1,
        sms_notifications: 0,
        notification_types: JSON.stringify({
          device_offline: true,
          device_online: true,
          location_alert: true,
          app_install: false,
          system_update: true
        }),
        created_time: new Date()
      };
      
      await insert('notification_settings', defaultSettings);
      settings = defaultSettings;
    }
    
    // 解析JSON字段
    if (settings.notification_types) {
      settings.notification_types = JSON.parse(settings.notification_types);
    }
    
    res.json({
      success: true,
      data: {
        settings
      }
    });
  } catch (error) {
    logger.error('获取通知设置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取通知设置失败'
    });
  }
};

/**
 * 更新通知设置
 */
const updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email_notifications, push_notifications, sms_notifications, notification_types } = req.body;
    
    // 检查是否已有设置记录
    const existingSettings = await queryOne(`
      SELECT id
      FROM notification_settings
      WHERE user_id = ?
    `, [userId]);
    
    const settingsData = {
      email_notifications: email_notifications !== undefined ? email_notifications : 1,
      push_notifications: push_notifications !== undefined ? push_notifications : 1,
      sms_notifications: sms_notifications !== undefined ? sms_notifications : 0,
      notification_types: notification_types ? JSON.stringify(notification_types) : null,
      updated_time: new Date()
    };
    
    if (existingSettings) {
      await update('notification_settings', settingsData, { user_id: userId });
    } else {
      settingsData.user_id = userId;
      settingsData.created_time = new Date();
      await insert('notification_settings', settingsData);
    }
    
    res.json({
      success: true,
      message: '通知设置已更新'
    });
  } catch (error) {
    logger.error('更新通知设置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新通知设置失败'
    });
  }
};

/**
 * 发送测试通知
 */
const sendTestNotification = async (req, res) => {
  try {
    const { type, message } = req.body;
    const userId = req.user.id;
    
    // 获取用户信息
    const user = await queryOne(`
      SELECT email, phone
      FROM users
      WHERE id = ?
    `, [userId]);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    const testMessage = message || '这是一条测试通知';
    
    try {
      switch (type) {
        case 'email':
          if (!user.email) {
            return res.status(400).json({
              success: false,
              message: '用户未设置邮箱'
            });
          }
          await sendEmail(user.email, '测试通知', testMessage);
          break;
          
        case 'sms':
          if (!user.phone) {
            return res.status(400).json({
              success: false,
              message: '用户未设置手机号'
            });
          }
          await sendSMS(user.phone, testMessage);
          break;
          
        case 'push':
          await sendPushNotification(userId, {
            title: '测试通知',
            body: testMessage
          });
          break;
          
        default:
          return res.status(400).json({
            success: false,
            message: '不支持的通知类型'
          });
      }
      
      res.json({
        success: true,
        message: `${type}测试通知发送成功`
      });
    } catch (sendError) {
      logger.error(`发送${type}测试通知失败:`, sendError);
      res.status(500).json({
        success: false,
        message: `发送${type}测试通知失败`
      });
    }
  } catch (error) {
    logger.error('发送测试通知失败:', error);
    res.status(500).json({
      success: false,
      message: '发送测试通知失败'
    });
  }
};

/**
 * 获取通知统计
 */
const getNotificationStats = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const userId = req.user.id;
    
    let dateCondition = '';
    switch (period) {
      case 'today':
        dateCondition = 'AND DATE(created_time) = CURDATE()';
        break;
      case 'week':
        dateCondition = 'AND created_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        break;
      case 'month':
        dateCondition = 'AND created_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        break;
      case 'year':
        dateCondition = 'AND created_time >= DATE_SUB(NOW(), INTERVAL 365 DAY)';
        break;
    }
    
    // 获取总体统计
    const totalStats = await queryOne(`
      SELECT 
        COUNT(*) as total_notifications,
        SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) as read_notifications,
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread_notifications
      FROM notifications
      WHERE user_id = ? ${dateCondition}
    `, [userId]);
    
    // 按类型统计
    const typeStats = await query(`
      SELECT 
        type,
        COUNT(*) as count
      FROM notifications
      WHERE user_id = ? ${dateCondition}
      GROUP BY type
      ORDER BY count DESC
    `, [userId]);
    
    // 按优先级统计
    const priorityStats = await query(`
      SELECT 
        priority,
        COUNT(*) as count
      FROM notifications
      WHERE user_id = ? ${dateCondition}
      GROUP BY priority
      ORDER BY 
        CASE priority
          WHEN 'high' THEN 1
          WHEN 'normal' THEN 2
          WHEN 'low' THEN 3
        END
    `, [userId]);
    
    res.json({
      success: true,
      data: {
        period,
        total_stats: totalStats,
        type_stats: typeStats,
        priority_stats: priorityStats
      }
    });
  } catch (error) {
    logger.error('获取通知统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取通知统计失败'
    });
  }
};

/**
 * 订阅推送通知
 */
const subscribePushNotification = async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    const userId = req.user.id;
    
    if (!endpoint || !keys) {
      return res.status(400).json({
        success: false,
        message: '缺少必要的订阅信息'
      });
    }
    
    // 检查是否已存在订阅
    const existingSubscription = await queryOne(`
      SELECT id
      FROM push_subscriptions
      WHERE user_id = ? AND endpoint = ?
    `, [userId, endpoint]);
    
    if (existingSubscription) {
      // 更新现有订阅
      await update('push_subscriptions', {
        p256dh_key: keys.p256dh,
        auth_key: keys.auth,
        updated_time: new Date()
      }, { id: existingSubscription.id });
    } else {
      // 创建新订阅
      await insert('push_subscriptions', {
        user_id: userId,
        endpoint,
        p256dh_key: keys.p256dh,
        auth_key: keys.auth,
        created_time: new Date()
      });
    }
    
    res.json({
      success: true,
      message: '推送通知订阅成功'
    });
  } catch (error) {
    logger.error('订阅推送通知失败:', error);
    res.status(500).json({
      success: false,
      message: '订阅推送通知失败'
    });
  }
};

/**
 * 取消订阅推送通知
 */
const unsubscribePushNotification = async (req, res) => {
  try {
    const { endpoint } = req.body;
    const userId = req.user.id;
    
    if (endpoint) {
      // 删除特定端点的订阅
      await deleteRecord('push_subscriptions', {
        user_id: userId,
        endpoint
      });
    } else {
      // 删除用户的所有订阅
      await deleteRecord('push_subscriptions', {
        user_id: userId
      });
    }
    
    res.json({
      success: true,
      message: '推送通知订阅已取消'
    });
  } catch (error) {
    logger.error('取消订阅推送通知失败:', error);
    res.status(500).json({
      success: false,
      message: '取消订阅推送通知失败'
    });
  }
};

/**
 * 获取通知模板
 */
const getNotificationTemplates = async (req, res) => {
  try {
    const templates = await query(`
      SELECT 
        id,
        name,
        type,
        title_template,
        content_template,
        description
      FROM notification_templates
      WHERE is_active = 1
      ORDER BY type, name
    `);
    
    res.json({
      success: true,
      data: {
        templates
      }
    });
  } catch (error) {
    logger.error('获取通知模板失败:', error);
    res.status(500).json({
      success: false,
      message: '获取通知模板失败'
    });
  }
};

/**
 * 创建自定义通知
 */
const createCustomNotification = async (req, res) => {
  try {
    const { title, content, type = 'custom', priority = 'normal', action_url } = req.body;
    const userId = req.user.id;
    
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: '标题和内容不能为空'
      });
    }
    
    // 创建通知记录
    const notificationId = await insert('notifications', {
      user_id: userId,
      title,
      content,
      type,
      priority,
      action_url,
      is_read: 0,
      created_time: new Date()
    });
    
    logger.info(`用户 ${userId} 创建自定义通知: ${title}`);
    
    res.json({
      success: true,
      message: '自定义通知创建成功',
      data: {
        notification_id: notificationId
      }
    });
  } catch (error) {
    logger.error('创建自定义通知失败:', error);
    res.status(500).json({
      success: false,
      message: '创建自定义通知失败'
    });
  }
};

module.exports = {
  getNotifications,
  getNotificationDetails,
  markAsRead,
  markAsUnread,
  batchMarkAsRead,
  batchMarkAsUnread,
  deleteNotification,
  batchDeleteNotifications,
  clearAllNotifications,
  getUnreadCount,
  markAllAsRead,
  getNotificationSettings,
  updateNotificationSettings,
  sendTestNotification,
  getNotificationStats,
  subscribePushNotification,
  unsubscribePushNotification,
  getNotificationTemplates,
  createCustomNotification
};