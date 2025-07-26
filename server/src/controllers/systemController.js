const { query, queryOne, insert, update, deleteRecord } = require('../utils/database');
const logger = require('../utils/logger');
const redis = require('../utils/redis');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const config = require('../config');

// 检查Redis是否启用
const useCache = config.redis.enabled;

/**
 * 获取系统信息
 */
const getSystemInfo = async (req, res) => {
  try {
    const systemInfo = {
      app_name: process.env.APP_NAME || 'Device Management System',
      app_version: process.env.APP_VERSION || '1.0.0',
      node_version: process.version,
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      total_memory: os.totalmem(),
      free_memory: os.freemem(),
      cpu_count: os.cpus().length,
      load_average: os.loadavg(),
      network_interfaces: os.networkInterfaces()
    };
    
    res.json({
      success: true,
      data: systemInfo
    });
  } catch (error) {
    logger.error('获取系统信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统信息失败'
    });
  }
};

/**
 * 获取系统状态
 */
const getSystemStatus = async (req, res) => {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      services: {
        api: 'running',
        database: 'unknown',
        redis: 'unknown',
        socket: 'running'
      },
      memory_usage: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
        rss: process.memoryUsage().rss
      },
      process_uptime: process.uptime()
    };
    
    // 检查数据库连接
    try {
      await queryOne('SELECT 1');
      status.services.database = 'running';
    } catch (dbError) {
      status.services.database = 'error';
      status.status = 'degraded';
    }
    
    // 检查Redis连接
    if (useCache) {
      try {
        await redis.ping();
        status.services.redis = 'running';
      } catch (redisError) {
        status.services.redis = 'error';
        status.status = 'degraded';
      }
    } else {
      status.services.redis = 'disabled';
    }
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('获取系统状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统状态失败'
    });
  }
};

/**
 * 获取系统配置
 */
const getSystemConfig = async (req, res) => {
  try {
    const configs = await query(`
      SELECT name, value, description, type
      FROM system_configs
      WHERE is_public = 1 OR ? = 1
      ORDER BY category, name
    `, [req.user.is_admin]);
    
    const configMap = {};
    configs.forEach(config => {
      let value = config.value;
      
      // 根据类型转换值
      switch (config.type) {
        case 'boolean':
          value = value === '1' || value === 'true';
          break;
        case 'number':
          value = parseFloat(value);
          break;
        case 'json':
          try {
            value = JSON.parse(value);
          } catch (e) {
            value = null;
          }
          break;
      }
      
      configMap[config.name] = {
        value,
        description: config.description,
        type: config.type
      };
    });
    
    res.json({
      success: true,
      data: {
        configs: configMap
      }
    });
  } catch (error) {
    logger.error('获取系统配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统配置失败'
    });
  }
};

/**
 * 更新系统配置
 */
const updateSystemConfig = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const updates = req.body;
    const updatedConfigs = [];
    
    for (const [name, value] of Object.entries(updates)) {
      // 检查配置是否存在
      const existingConfig = await queryOne(`
        SELECT id, type
        FROM system_configs
        WHERE name = ?
      `, [name]);
      
      if (!existingConfig) {
        continue;
      }
      
      let stringValue = value;
      
      // 根据类型转换值
      switch (existingConfig.type) {
        case 'boolean':
          stringValue = value ? '1' : '0';
          break;
        case 'number':
          stringValue = value.toString();
          break;
        case 'json':
          stringValue = JSON.stringify(value);
          break;
        default:
          stringValue = value.toString();
      }
      
      await update('system_configs', {
        value: stringValue,
        updated_time: new Date()
      }, { id: existingConfig.id });
      
      updatedConfigs.push(name);
      
      // 记录配置更改日志
      logger.info(`管理员 ${req.user.id} 更新系统配置 ${name}: ${stringValue}`);
    }
    
    res.json({
      success: true,
      message: `已更新 ${updatedConfigs.length} 项配置`,
      data: {
        updated_configs: updatedConfigs
      }
    });
  } catch (error) {
    logger.error('更新系统配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新系统配置失败'
    });
  }
};

/**
 * 获取系统统计
 */
const getSystemStats = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
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
    
    // 用户统计
    const userStats = await queryOne(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN membership_type != 'free' THEN 1 ELSE 0 END) as premium_users
      FROM users
      WHERE 1=1 ${dateCondition.replace('created_time', 'users.created_time')}
    `);
    
    // 设备统计
    const deviceStats = await queryOne(`
      SELECT 
        COUNT(*) as total_devices,
        SUM(CASE WHEN is_online = 1 THEN 1 ELSE 0 END) as online_devices
      FROM devices
      WHERE 1=1 ${dateCondition.replace('created_time', 'devices.created_time')}
    `);
    
    // 文件统计
    const fileStats = await queryOne(`
      SELECT 
        COUNT(*) as total_files,
        SUM(file_size) as total_size
      FROM files
      WHERE 1=1 ${dateCondition.replace('created_time', 'files.created_time')}
    `);
    
    // API调用统计
    const apiStats = await queryOne(`
      SELECT 
        COUNT(*) as total_requests,
        SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successful_requests,
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_requests
      FROM api_logs
      WHERE 1=1 ${dateCondition.replace('created_time', 'api_logs.created_time')}
    `);
    
    res.json({
      success: true,
      data: {
        period,
        user_stats: userStats,
        device_stats: deviceStats,
        file_stats: fileStats,
        api_stats: apiStats
      }
    });
  } catch (error) {
    logger.error('获取系统统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统统计失败'
    });
  }
};

/**
 * 获取系统日志
 */
const getSystemLogs = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const { page = 1, limit = 50, level, start_date, end_date, keyword } = req.query;
    const offset = (page - 1) * limit;
    
    // 构建查询条件
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (level) {
      whereClause += ' AND level = ?';
      params.push(level);
    }
    
    if (start_date) {
      whereClause += ' AND DATE(created_time) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      whereClause += ' AND DATE(created_time) <= ?';
      params.push(end_date);
    }
    
    if (keyword) {
      whereClause += ' AND (message LIKE ? OR meta LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    // 获取日志列表
    const logs = await query(`
      SELECT 
        id,
        level,
        message,
        meta,
        created_time
      FROM system_logs
      ${whereClause}
      ORDER BY created_time DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
    
    // 获取总数
    const totalResult = await queryOne(`
      SELECT COUNT(*) as total
      FROM system_logs
      ${whereClause}
    `, params);
    
    const total = totalResult.total;
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_items: total,
          items_per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('获取系统日志失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统日志失败'
    });
  }
};

/**
 * 清理系统日志
 */
const cleanupLogs = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const { days = 30 } = req.body;
    
    const result = await query(`
      DELETE FROM system_logs
      WHERE created_time < DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [days]);
    
    logger.info(`管理员 ${req.user.id} 清理了 ${result.affectedRows} 条系统日志`);
    
    res.json({
      success: true,
      message: `已清理 ${result.affectedRows} 条日志记录`
    });
  } catch (error) {
    logger.error('清理系统日志失败:', error);
    res.status(500).json({
      success: false,
      message: '清理系统日志失败'
    });
  }
};

/**
 * 系统健康检查
 */
const healthCheck = async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: 'unknown', response_time: 0 },
        redis: { status: 'unknown', response_time: 0 },
        disk_space: { status: 'unknown', usage: 0 },
        memory: { status: 'unknown', usage: 0 }
      }
    };
    
    // 数据库检查
    try {
      const dbStart = Date.now();
      await queryOne('SELECT 1');
      health.checks.database = {
        status: 'healthy',
        response_time: Date.now() - dbStart
      };
    } catch (dbError) {
      health.checks.database = {
        status: 'unhealthy',
        error: dbError.message
      };
      health.status = 'unhealthy';
    }
    
    // Redis检查
    try {
      const redisStart = Date.now();
      await redis.ping();
      health.checks.redis = {
        status: 'healthy',
        response_time: Date.now() - redisStart
      };
    } catch (redisError) {
      health.checks.redis = {
        status: 'unhealthy',
        error: redisError.message
      };
      health.status = 'unhealthy';
    }
    
    // 内存使用检查
    const memUsage = process.memoryUsage();
    const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    health.checks.memory = {
      status: memUsagePercent > 90 ? 'warning' : 'healthy',
      usage: memUsagePercent,
      heap_used: memUsage.heapUsed,
      heap_total: memUsage.heapTotal
    };
    
    if (memUsagePercent > 95) {
      health.status = 'unhealthy';
    } else if (memUsagePercent > 90) {
      health.status = 'warning';
    }
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('健康检查失败:', error);
    res.status(500).json({
      success: false,
      message: '健康检查失败',
      data: {
        status: 'unhealthy',
        error: error.message
      }
    });
  }
};

/**
 * 获取数据库状态
 */
const getDatabaseStatus = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    // 获取数据库基本信息
    const dbInfo = await queryOne('SELECT VERSION() as version');
    
    // 获取表统计信息
    const tableStats = await query(`
      SELECT 
        table_name,
        table_rows,
        data_length,
        index_length
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      ORDER BY data_length DESC
    `);
    
    // 获取连接信息
    const connectionInfo = await queryOne(`
      SHOW STATUS LIKE 'Threads_connected'
    `);
    
    res.json({
      success: true,
      data: {
        version: dbInfo.version,
        connections: connectionInfo.Value,
        tables: tableStats
      }
    });
  } catch (error) {
    logger.error('获取数据库状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取数据库状态失败'
    });
  }
};

/**
 * 获取Redis状态
 */
const getRedisStatus = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const redisInfo = await redis.info();
    const redisMemory = await redis.info('memory');
    const redisStats = await redis.info('stats');
    
    res.json({
      success: true,
      data: {
        info: redisInfo,
        memory: redisMemory,
        stats: redisStats
      }
    });
  } catch (error) {
    logger.error('获取Redis状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Redis状态失败'
    });
  }
};

/**
 * 获取服务器资源使用情况
 */
const getServerResources = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const resources = {
      cpu: {
        count: os.cpus().length,
        load_average: os.loadavg(),
        usage: 0 // 需要计算
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        usage_percent: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
      },
      process: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid
      },
      system: {
        uptime: os.uptime(),
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname()
      }
    };
    
    res.json({
      success: true,
      data: resources
    });
  } catch (error) {
    logger.error('获取服务器资源使用情况失败:', error);
    res.status(500).json({
      success: false,
      message: '获取服务器资源使用情况失败'
    });
  }
};

/**
 * 获取API使用统计
 */
const getApiStats = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const { period = 'day', endpoint } = req.query;
    
    let dateFormat = '';
    let dateCondition = '';
    
    switch (period) {
      case 'hour':
        dateFormat = '%Y-%m-%d %H:00:00';
        dateCondition = 'AND created_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)';
        break;
      case 'day':
        dateFormat = '%Y-%m-%d';
        dateCondition = 'AND created_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        break;
      case 'week':
        dateFormat = '%Y-%u';
        dateCondition = 'AND created_time >= DATE_SUB(NOW(), INTERVAL 8 WEEK)';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        dateCondition = 'AND created_time >= DATE_SUB(NOW(), INTERVAL 12 MONTH)';
        break;
    }
    
    let whereClause = `WHERE 1=1 ${dateCondition}`;
    const params = [];
    
    if (endpoint) {
      whereClause += ' AND endpoint = ?';
      params.push(endpoint);
    }
    
    // 按时间统计
    const timeStats = await query(`
      SELECT 
        DATE_FORMAT(created_time, ?) as time_period,
        COUNT(*) as total_requests,
        SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as success_requests,
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_requests,
        AVG(response_time) as avg_response_time
      FROM api_logs
      ${whereClause}
      GROUP BY time_period
      ORDER BY time_period DESC
      LIMIT 50
    `, [dateFormat, ...params]);
    
    // 按端点统计
    const endpointStats = await query(`
      SELECT 
        endpoint,
        method,
        COUNT(*) as total_requests,
        SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as success_requests,
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_requests,
        AVG(response_time) as avg_response_time
      FROM api_logs
      ${whereClause}
      GROUP BY endpoint, method
      ORDER BY total_requests DESC
      LIMIT 20
    `, params);
    
    res.json({
      success: true,
      data: {
        period,
        time_stats: timeStats,
        endpoint_stats: endpointStats
      }
    });
  } catch (error) {
    logger.error('获取API使用统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取API使用统计失败'
    });
  }
};

/**
 * 获取错误统计
 */
const getErrorStats = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const { period = 'week' } = req.query;
    
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
    }
    
    // API错误统计
    const apiErrors = await query(`
      SELECT 
        endpoint,
        status_code,
        COUNT(*) as error_count
      FROM api_logs
      WHERE status_code >= 400 ${dateCondition}
      GROUP BY endpoint, status_code
      ORDER BY error_count DESC
      LIMIT 20
    `);
    
    // 系统错误统计
    const systemErrors = await query(`
      SELECT 
        level,
        COUNT(*) as error_count
      FROM system_logs
      WHERE level IN ('error', 'warn') ${dateCondition.replace('created_time', 'system_logs.created_time')}
      GROUP BY level
    `);
    
    res.json({
      success: true,
      data: {
        period,
        api_errors: apiErrors,
        system_errors: systemErrors
      }
    });
  } catch (error) {
    logger.error('获取错误统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取错误统计失败'
    });
  }
};

/**
 * 创建系统备份
 */
const createBackup = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const { type = 'full', description } = req.body;
    
    // 创建备份记录
    const backupId = await insert('system_backups', {
      type,
      description,
      status: 'in_progress',
      created_by: req.user.id,
      created_time: new Date()
    });
    
    // 异步执行备份
    setImmediate(async () => {
      try {
        const backupPath = path.join(process.cwd(), 'backups', `backup_${backupId}_${Date.now()}`);
        await fs.mkdir(backupPath, { recursive: true });
        
        let backupSize = 0;
        
        if (type === 'full' || type === 'database') {
          // 数据库备份逻辑
          const dbBackupPath = path.join(backupPath, 'database.sql');
          // 这里应该实现实际的数据库备份逻辑
          await fs.writeFile(dbBackupPath, '-- Database backup placeholder');
          const dbStats = await fs.stat(dbBackupPath);
          backupSize += dbStats.size;
        }
        
        if (type === 'full' || type === 'files') {
          // 文件备份逻辑
          const filesBackupPath = path.join(backupPath, 'files');
          await fs.mkdir(filesBackupPath, { recursive: true });
          // 这里应该实现实际的文件备份逻辑
        }
        
        // 更新备份状态
        await update('system_backups', {
          status: 'completed',
          file_path: backupPath,
          file_size: backupSize,
          completed_time: new Date()
        }, { id: backupId });
        
        logger.info(`系统备份完成: ${backupId}`);
      } catch (backupError) {
        logger.error('备份失败:', backupError);
        await update('system_backups', {
          status: 'failed',
          error_message: backupError.message,
          completed_time: new Date()
        }, { id: backupId });
      }
    });
    
    res.json({
      success: true,
      message: '备份任务已启动',
      data: {
        backup_id: backupId
      }
    });
  } catch (error) {
    logger.error('创建系统备份失败:', error);
    res.status(500).json({
      success: false,
      message: '创建系统备份失败'
    });
  }
};

/**
 * 获取备份列表
 */
const getBackups = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const backups = await query(`
      SELECT 
        sb.*,
        u.username as created_by_name
      FROM system_backups sb
      LEFT JOIN users u ON sb.created_by = u.id
      ORDER BY sb.created_time DESC
      LIMIT ? OFFSET ?
    `, [parseInt(limit), offset]);
    
    const totalResult = await queryOne(`
      SELECT COUNT(*) as total
      FROM system_backups
    `);
    
    const total = totalResult.total;
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      data: {
        backups,
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_items: total,
          items_per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('获取备份列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取备份列表失败'
    });
  }
};

/**
 * 恢复备份
 */
const restoreBackup = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const { backupId } = req.params;
    
    const backup = await queryOne(`
      SELECT *
      FROM system_backups
      WHERE id = ? AND status = 'completed'
    `, [backupId]);
    
    if (!backup) {
      return res.status(404).json({
        success: false,
        message: '备份不存在或未完成'
      });
    }
    
    // 创建恢复记录
    const restoreId = await insert('system_restores', {
      backup_id: backupId,
      status: 'in_progress',
      created_by: req.user.id,
      created_time: new Date()
    });
    
    // 异步执行恢复
    setImmediate(async () => {
      try {
        // 这里应该实现实际的恢复逻辑
        logger.info(`开始恢复备份: ${backupId}`);
        
        // 模拟恢复过程
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        await update('system_restores', {
          status: 'completed',
          completed_time: new Date()
        }, { id: restoreId });
        
        logger.info(`备份恢复完成: ${backupId}`);
      } catch (restoreError) {
        logger.error('恢复失败:', restoreError);
        await update('system_restores', {
          status: 'failed',
          error_message: restoreError.message,
          completed_time: new Date()
        }, { id: restoreId });
      }
    });
    
    res.json({
      success: true,
      message: '恢复任务已启动',
      data: {
        restore_id: restoreId
      }
    });
  } catch (error) {
    logger.error('恢复备份失败:', error);
    res.status(500).json({
      success: false,
      message: '恢复备份失败'
    });
  }
};

/**
 * 删除备份
 */
const deleteBackup = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const { backupId } = req.params;
    
    const backup = await queryOne(`
      SELECT *
      FROM system_backups
      WHERE id = ?
    `, [backupId]);
    
    if (!backup) {
      return res.status(404).json({
        success: false,
        message: '备份不存在'
      });
    }
    
    // 删除备份文件
    if (backup.file_path) {
      try {
        await fs.rmdir(backup.file_path, { recursive: true });
      } catch (fileError) {
        logger.warn('删除备份文件失败:', fileError);
      }
    }
    
    // 删除备份记录
    await deleteRecord('system_backups', { id: backupId });
    
    logger.info(`管理员 ${req.user.id} 删除备份: ${backupId}`);
    
    res.json({
      success: true,
      message: '备份已删除'
    });
  } catch (error) {
    logger.error('删除备份失败:', error);
    res.status(500).json({
      success: false,
      message: '删除备份失败'
    });
  }
};

/**
 * 获取系统更新信息
 */
const getSystemUpdates = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    // 这里应该实现检查更新的逻辑
    const currentVersion = process.env.APP_VERSION || '1.0.0';
    
    res.json({
      success: true,
      data: {
        current_version: currentVersion,
        latest_version: '1.0.0',
        has_update: false,
        update_notes: [],
        last_check: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('获取系统更新信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统更新信息失败'
    });
  }
};

/**
 * 执行系统更新
 */
const performSystemUpdate = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const { version, force = false } = req.body;
    
    // 这里应该实现实际的更新逻辑
    logger.info(`管理员 ${req.user.id} 执行系统更新到版本: ${version}`);
    
    res.json({
      success: true,
      message: '系统更新已启动'
    });
  } catch (error) {
    logger.error('执行系统更新失败:', error);
    res.status(500).json({
      success: false,
      message: '执行系统更新失败'
    });
  }
};

/**
 * 重启系统服务
 */
const restartService = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const { service = 'all' } = req.body;
    
    logger.info(`管理员 ${req.user.id} 重启服务: ${service}`);
    
    // 这里应该实现实际的服务重启逻辑
    switch (service) {
      case 'all':
        // 重启所有服务
        break;
      case 'api':
        // 重启API服务
        break;
      case 'socket':
        // 重启Socket服务
        break;
      case 'scheduler':
        // 重启调度服务
        break;
      default:
        return res.status(400).json({
          success: false,
          message: '不支持的服务类型'
        });
    }
    
    res.json({
      success: true,
      message: `${service}服务重启指令已发送`
    });
  } catch (error) {
    logger.error('重启系统服务失败:', error);
    res.status(500).json({
      success: false,
      message: '重启系统服务失败'
    });
  }
};

/**
 * 获取系统通知
 */
const getSystemAnnouncements = async (req, res) => {
  try {
    const now = new Date();
    
    const announcements = await query(`
      SELECT 
        id,
        title,
        content,
        type,
        start_time,
        end_time,
        created_time
      FROM system_announcements
      WHERE is_active = 1
        AND (start_time IS NULL OR start_time <= ?)
        AND (end_time IS NULL OR end_time >= ?)
        AND (target_users = 'all' OR 
             (target_users = 'premium' AND ? != 'free') OR
             (target_users = 'specific' AND FIND_IN_SET(?, user_ids)))
      ORDER BY created_time DESC
    `, [now, now, req.user?.membership_type || 'free', req.user?.id || 0]);
    
    res.json({
      success: true,
      data: {
        announcements
      }
    });
  } catch (error) {
    logger.error('获取系统通知失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统通知失败'
    });
  }
};

/**
 * 创建系统通知
 */
const createSystemAnnouncement = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const { title, content, type = 'info', target_users = 'all', user_ids, start_time, end_time } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: '标题和内容不能为空'
      });
    }
    
    const announcementId = await insert('system_announcements', {
      title,
      content,
      type,
      target_users,
      user_ids: target_users === 'specific' ? JSON.stringify(user_ids) : null,
      start_time: start_time ? new Date(start_time) : null,
      end_time: end_time ? new Date(end_time) : null,
      is_active: 1,
      created_by: req.user.id,
      created_time: new Date()
    });
    
    logger.info(`管理员 ${req.user.id} 创建系统通知: ${title}`);
    
    res.json({
      success: true,
      message: '系统通知创建成功',
      data: {
        announcement_id: announcementId
      }
    });
  } catch (error) {
    logger.error('创建系统通知失败:', error);
    res.status(500).json({
      success: false,
      message: '创建系统通知失败'
    });
  }
};

/**
 * 更新系统通知
 */
const updateSystemAnnouncement = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const { id } = req.params;
    const { title, content, type, target_users, user_ids, start_time, end_time, is_active } = req.body;
    
    const announcement = await queryOne(`
      SELECT id
      FROM system_announcements
      WHERE id = ?
    `, [id]);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '系统通知不存在'
      });
    }
    
    const updateData = {
      updated_time: new Date()
    };
    
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (type !== undefined) updateData.type = type;
    if (target_users !== undefined) updateData.target_users = target_users;
    if (user_ids !== undefined) updateData.user_ids = target_users === 'specific' ? JSON.stringify(user_ids) : null;
    if (start_time !== undefined) updateData.start_time = start_time ? new Date(start_time) : null;
    if (end_time !== undefined) updateData.end_time = end_time ? new Date(end_time) : null;
    if (is_active !== undefined) updateData.is_active = is_active ? 1 : 0;
    
    await update('system_announcements', updateData, { id });
    
    logger.info(`管理员 ${req.user.id} 更新系统通知: ${id}`);
    
    res.json({
      success: true,
      message: '系统通知更新成功'
    });
  } catch (error) {
    logger.error('更新系统通知失败:', error);
    res.status(500).json({
      success: false,
      message: '更新系统通知失败'
    });
  }
};

/**
 * 删除系统通知
 */
const deleteSystemAnnouncement = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const { id } = req.params;
    
    const announcement = await queryOne(`
      SELECT id
      FROM system_announcements
      WHERE id = ?
    `, [id]);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '系统通知不存在'
      });
    }
    
    await deleteRecord('system_announcements', { id });
    
    logger.info(`管理员 ${req.user.id} 删除系统通知: ${id}`);
    
    res.json({
      success: true,
      message: '系统通知已删除'
    });
  } catch (error) {
    logger.error('删除系统通知失败:', error);
    res.status(500).json({
      success: false,
      message: '删除系统通知失败'
    });
  }
};

/**
 * 获取系统维护状态
 */
const getMaintenanceStatus = async (req, res) => {
  try {
    const maintenance = await queryOne(`
      SELECT *
      FROM system_maintenance
      WHERE is_active = 1
      ORDER BY created_time DESC
      LIMIT 1
    `);
    
    const isInMaintenance = maintenance && 
      (!maintenance.start_time || new Date(maintenance.start_time) <= new Date()) &&
      (!maintenance.end_time || new Date(maintenance.end_time) >= new Date());
    
    res.json({
      success: true,
      data: {
        is_maintenance: isInMaintenance,
        maintenance: maintenance || null
      }
    });
  } catch (error) {
    logger.error('获取系统维护状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统维护状态失败'
    });
  }
};

/**
 * 设置系统维护模式
 */
const setMaintenanceMode = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const { enabled, message, start_time, end_time } = req.body;
    
    if (enabled) {
      // 启用维护模式
      await insert('system_maintenance', {
        message: message || '系统维护中，请稍后再试',
        start_time: start_time ? new Date(start_time) : new Date(),
        end_time: end_time ? new Date(end_time) : null,
        is_active: 1,
        created_by: req.user.id,
        created_time: new Date()
      });
      
      logger.info(`管理员 ${req.user.id} 启用系统维护模式`);
    } else {
      // 禁用维护模式
      await query(`
        UPDATE system_maintenance
        SET is_active = 0, updated_time = ?
        WHERE is_active = 1
      `, [new Date()]);
      
      logger.info(`管理员 ${req.user.id} 禁用系统维护模式`);
    }
    
    res.json({
      success: true,
      message: enabled ? '维护模式已启用' : '维护模式已禁用'
    });
  } catch (error) {
    logger.error('设置系统维护模式失败:', error);
    res.status(500).json({
      success: false,
      message: '设置系统维护模式失败'
    });
  }
};

/**
 * 获取系统缓存状态
 */
const getCacheStatus = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const cacheStatus = {
      redis: {
        status: 'unknown',
        memory_usage: 0,
        keys_count: 0
      },
      memory: {
        heap_used: process.memoryUsage().heapUsed,
        heap_total: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external
      }
    };
    
    try {
      const redisInfo = await redis.info('memory');
      const keysCount = await redis.dbsize();
      
      cacheStatus.redis = {
        status: 'healthy',
        memory_usage: redisInfo.used_memory || 0,
        keys_count: keysCount
      };
    } catch (redisError) {
      cacheStatus.redis.status = 'error';
    }
    
    res.json({
      success: true,
      data: cacheStatus
    });
  } catch (error) {
    logger.error('获取系统缓存状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统缓存状态失败'
    });
  }
};

/**
 * 清理系统缓存
 */
const clearCache = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const { type = 'all' } = req.body;
    
    let clearedItems = [];
    
    if (type === 'all' || type === 'redis') {
      try {
        await redis.flushdb();
        clearedItems.push('Redis缓存');
      } catch (redisError) {
        logger.error('清理Redis缓存失败:', redisError);
      }
    }
    
    if (type === 'all' || type === 'memory') {
      // 触发垃圾回收
      if (global.gc) {
        global.gc();
        clearedItems.push('内存缓存');
      }
    }
    
    logger.info(`管理员 ${req.user.id} 清理系统缓存: ${type}`);
    
    res.json({
      success: true,
      message: `已清理: ${clearedItems.join(', ')}`
    });
  } catch (error) {
    logger.error('清理系统缓存失败:', error);
    res.status(500).json({
      success: false,
      message: '清理系统缓存失败'
    });
  }
};

/**
 * 获取系统队列状态
 */
const getQueueStatus = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    // 这里应该实现实际的队列状态检查逻辑
    const queueStatus = {
      email_queue: {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0
      },
      notification_queue: {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0
      },
      backup_queue: {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0
      }
    };
    
    res.json({
      success: true,
      data: queueStatus
    });
  } catch (error) {
    logger.error('获取系统队列状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统队列状态失败'
    });
  }
};

/**
 * 清理系统队列
 */
const clearQueue = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const { queueName } = req.params;
    
    // 这里应该实现实际的队列清理逻辑
    logger.info(`管理员 ${req.user.id} 清理队列: ${queueName}`);
    
    res.json({
      success: true,
      message: `队列 ${queueName} 已清理`
    });
  } catch (error) {
    logger.error('清理系统队列失败:', error);
    res.status(500).json({
      success: false,
      message: '清理系统队列失败'
    });
  }
};

/**
 * 获取系统许可证信息
 */
const getLicenseInfo = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const license = await queryOne(`
      SELECT *
      FROM system_license
      ORDER BY created_time DESC
      LIMIT 1
    `);
    
    res.json({
      success: true,
      data: {
        license: license || null
      }
    });
  } catch (error) {
    logger.error('获取系统许可证信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统许可证信息失败'
    });
  }
};

/**
 * 更新系统许可证
 */
const updateLicense = async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const { license_key } = req.body;
    
    if (!license_key) {
      return res.status(400).json({
        success: false,
        message: '许可证密钥不能为空'
      });
    }
    
    // 这里应该实现许可证验证逻辑
    const licenseInfo = {
      license_key,
      status: 'valid',
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1年后过期
      max_users: 1000,
      max_devices: 10000,
      features: JSON.stringify(['all']),
      updated_by: req.user.id,
      updated_time: new Date()
    };
    
    // 检查是否已有许可证记录
    const existingLicense = await queryOne(`
      SELECT id
      FROM system_license
      ORDER BY created_time DESC
      LIMIT 1
    `);
    
    if (existingLicense) {
      await update('system_license', licenseInfo, { id: existingLicense.id });
    } else {
      licenseInfo.created_time = new Date();
      await insert('system_license', licenseInfo);
    }
    
    logger.info(`管理员 ${req.user.id} 更新系统许可证`);
    
    res.json({
      success: true,
      message: '许可证更新成功'
    });
  } catch (error) {
    logger.error('更新系统许可证失败:', error);
    res.status(500).json({
      success: false,
      message: '更新系统许可证失败'
    });
  }
};

module.exports = {
  getSystemInfo,
  getSystemStatus,
  getSystemConfig,
  updateSystemConfig,
  getSystemStats,
  getSystemLogs,
  cleanupLogs,
  healthCheck,
  getDatabaseStatus,
  getRedisStatus,
  getServerResources,
  getApiStats,
  getErrorStats,
  createBackup,
  getBackups,
  restoreBackup,
  deleteBackup,
  getSystemUpdates,
  performSystemUpdate,
  restartService,
  getSystemAnnouncements,
  createSystemAnnouncement,
  updateSystemAnnouncement,
  deleteSystemAnnouncement,
  getMaintenanceStatus,
  setMaintenanceMode,
  getCacheStatus,
  clearCache,
  getQueueStatus,
  clearQueue,
  getLicenseInfo,
  updateLicense
};