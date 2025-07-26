/**
 * 文件管理控制器
 */

const Device = require('../models/Device');
const { query, queryOne, insert, update, remove } = require('../database/connection');
const { cache } = require('../database/redis');
const logger = require('../utils/logger');
const config = require('../config');
const socketManager = require('../socket/socketManager');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * 获取文件列表
 */
const getFiles = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { 
      file_type,
      start_date,
      end_date,
      page = 1,
      limit = 20
    } = req.query;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 构建查询条件
    let whereClause = 'WHERE device_id = ?';
    const params = [deviceId];

    if (file_type) {
      whereClause += ' AND file_type = ?';
      params.push(file_type);
    }

    if (start_date) {
      whereClause += ' AND created_time >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND created_time <= ?';
      params.push(end_date);
    }

    // 获取总数
    const countSql = `
      SELECT COUNT(*) as total 
      FROM files 
      ${whereClause}
    `;
    const countResult = await queryOne(countSql, params);
    const total = countResult.total;

    // 获取分页数据
    const offset = (page - 1) * limit;
    const sql = `
      SELECT 
        id,
        file_name,
        file_type,
        file_size,
        file_path,
        thumbnail_path,
        duration,
        metadata,
        upload_status,
        created_time
      FROM files 
      ${whereClause}
      ORDER BY created_time DESC
      LIMIT ? OFFSET ?
    `;
    
    const files = await query(sql, [...params, parseInt(limit), offset]);

    // 处理文件元数据
    const processedFiles = files.map(file => {
      let metadata = {};
      try {
        metadata = file.metadata ? JSON.parse(file.metadata) : {};
      } catch (e) {
        metadata = {};
      }

      return {
        ...file,
        metadata,
        download_url: file.file_path ? `/api/files/download/${file.id}` : null,
        thumbnail_url: file.thumbnail_path ? `/api/files/thumbnail/${file.id}` : null
      };
    });

    // 记录操作日志
    logger.logUserAction(req.user.id, 'get_files', {
      device_id: deviceId,
      file_type,
      page,
      limit
    });

    res.json({
      success: true,
      data: {
        files: processedFiles,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('获取文件列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取文件列表失败'
    });
  }
};

/**
 * 上传文件
 */
const uploadFile = async (req, res) => {
  try {
    const {
      device_id,
      file_name,
      file_type,
      file_size,
      duration,
      metadata,
      task_id
    } = req.body;

    // 验证必需字段
    if (!device_id || !file_name || !file_type || !req.file) {
      return res.status(400).json({
        success: false,
        message: '设备ID、文件名、文件类型和文件内容不能为空'
      });
    }

    // 验证设备存在
    const device = await Device.findByDeviceId(device_id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 生成文件路径
    const fileExtension = path.extname(file_name);
    const fileName = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${fileExtension}`;
    const relativePath = `${file_type}/${device_id}/${fileName}`;
    const fullPath = path.join(config.upload.path, relativePath);

    // 确保目录存在
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // 移动文件到目标位置
    await fs.rename(req.file.path, fullPath);

    // 生成缩略图（如果是图片或视频）
    let thumbnailPath = null;
    if (file_type === 'photo' || file_type === 'video') {
      thumbnailPath = await generateThumbnail(fullPath, file_type);
    }

    // 保存文件记录
    const fileId = await insert('files', {
      device_id: device.id,
      file_name,
      file_type,
      file_size: file_size || req.file.size,
      file_path: relativePath,
      thumbnail_path: thumbnailPath,
      duration: duration || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      upload_status: 'completed',
      task_id: task_id || null,
      created_time: new Date()
    });

    // 更新任务状态
    if (task_id) {
      const task = await cache.get(`task:${task_id}`);
      if (task) {
        task.status = 'completed';
        task.file_id = fileId;
        task.file_path = relativePath;
        await cache.set(`task:${task_id}`, task, 3600); // 延长1小时
      }
    }

    logger.logFileAction(fileId, 'file_uploaded', {
      device_id: device.id,
      file_name,
      file_type,
      file_size: file_size || req.file.size
    });

    res.json({
      success: true,
      message: '文件上传成功',
      data: {
        file_id: fileId,
        file_name,
        file_type,
        file_size: file_size || req.file.size,
        download_url: `/api/files/download/${fileId}`,
        thumbnail_url: thumbnailPath ? `/api/files/thumbnail/${fileId}` : null
      }
    });
  } catch (error) {
    logger.error('文件上传失败:', error);
    res.status(500).json({
      success: false,
      message: '文件上传失败'
    });
  }
};

/**
 * 下载文件
 */
const downloadFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    const file = await queryOne(`
      SELECT f.*, d.device_id, d.user_id
      FROM files f
      JOIN devices d ON f.device_id = d.id
      WHERE f.id = ?
    `, [fileId]);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    // 检查权限
    if (file.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '没有权限下载此文件'
      });
    }

    const fullPath = path.join(config.upload.path, file.file_path);

    // 检查文件是否存在
    try {
      await fs.access(fullPath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    // 记录下载日志
    logger.logFileAction(fileId, 'file_downloaded', {
      user_id: req.user.id,
      file_name: file.file_name
    });

    // 设置响应头
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.file_name)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // 发送文件
    res.sendFile(path.resolve(fullPath));
  } catch (error) {
    logger.error('文件下载失败:', error);
    res.status(500).json({
      success: false,
      message: '文件下载失败'
    });
  }
};

/**
 * 获取缩略图
 */
const getThumbnail = async (req, res) => {
  try {
    const { fileId } = req.params;

    const file = await queryOne(`
      SELECT f.*, d.device_id, d.user_id
      FROM files f
      JOIN devices d ON f.device_id = d.id
      WHERE f.id = ?
    `, [fileId]);

    if (!file || !file.thumbnail_path) {
      return res.status(404).json({
        success: false,
        message: '缩略图不存在'
      });
    }

    // 检查权限
    if (file.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '没有权限访问此缩略图'
      });
    }

    const fullPath = path.join(config.upload.path, file.thumbnail_path);

    // 检查文件是否存在
    try {
      await fs.access(fullPath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: '缩略图文件不存在'
      });
    }

    // 设置响应头
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存1天

    // 发送文件
    res.sendFile(path.resolve(fullPath));
  } catch (error) {
    logger.error('获取缩略图失败:', error);
    res.status(500).json({
      success: false,
      message: '获取缩略图失败'
    });
  }
};

/**
 * 删除文件
 */
const deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    const file = await queryOne(`
      SELECT f.*, d.device_id, d.user_id
      FROM files f
      JOIN devices d ON f.device_id = d.id
      WHERE f.id = ?
    `, [fileId]);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    // 检查权限
    if (file.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '没有权限删除此文件'
      });
    }

    // 删除物理文件
    const fullPath = path.join(config.upload.path, file.file_path);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      logger.warn('删除物理文件失败:', error);
    }

    // 删除缩略图
    if (file.thumbnail_path) {
      const thumbnailPath = path.join(config.upload.path, file.thumbnail_path);
      try {
        await fs.unlink(thumbnailPath);
      } catch (error) {
        logger.warn('删除缩略图失败:', error);
      }
    }

    // 删除数据库记录
    await remove('files', { id: fileId });

    logger.logFileAction(fileId, 'file_deleted', {
      user_id: req.user.id,
      file_name: file.file_name
    });

    res.json({
      success: true,
      message: '文件删除成功'
    });
  } catch (error) {
    logger.error('删除文件失败:', error);
    res.status(500).json({
      success: false,
      message: '删除文件失败'
    });
  }
};

/**
 * 批量删除文件
 */
const deleteFiles = async (req, res) => {
  try {
    const { file_ids } = req.body;

    if (!Array.isArray(file_ids) || file_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '文件ID列表不能为空'
      });
    }

    const placeholders = file_ids.map(() => '?').join(',');
    const files = await query(`
      SELECT f.*, d.device_id, d.user_id
      FROM files f
      JOIN devices d ON f.device_id = d.id
      WHERE f.id IN (${placeholders})
    `, file_ids);

    let deletedCount = 0;
    const errors = [];

    for (const file of files) {
      // 检查权限
      if (file.user_id !== req.user.id && req.user.role !== 'admin') {
        errors.push(`文件 ${file.file_name} 权限不足`);
        continue;
      }

      try {
        // 删除物理文件
        const fullPath = path.join(config.upload.path, file.file_path);
        try {
          await fs.unlink(fullPath);
        } catch (error) {
          logger.warn('删除物理文件失败:', error);
        }

        // 删除缩略图
        if (file.thumbnail_path) {
          const thumbnailPath = path.join(config.upload.path, file.thumbnail_path);
          try {
            await fs.unlink(thumbnailPath);
          } catch (error) {
            logger.warn('删除缩略图失败:', error);
          }
        }

        // 删除数据库记录
        await remove('files', { id: file.id });
        deletedCount++;

        logger.logFileAction(file.id, 'file_deleted', {
          user_id: req.user.id,
          file_name: file.file_name
        });
      } catch (error) {
        errors.push(`删除文件 ${file.file_name} 失败: ${error.message}`);
      }
    }

    res.json({
      success: true,
      message: `成功删除 ${deletedCount} 个文件`,
      data: {
        deleted_count: deletedCount,
        errors
      }
    });
  } catch (error) {
    logger.error('批量删除文件失败:', error);
    res.status(500).json({
      success: false,
      message: '批量删除文件失败'
    });
  }
};

/**
 * 获取文件统计
 */
const getFileStats = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { days = 7 } = req.query;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // 获取文件类型统计
    const typeStats = await query(`
      SELECT 
        file_type,
        COUNT(*) as count,
        SUM(file_size) as total_size,
        AVG(file_size) as avg_size
      FROM files
      WHERE device_id = ? AND created_time >= ?
      GROUP BY file_type
      ORDER BY count DESC
    `, [deviceId, startDate]);

    // 获取每日文件统计
    const dailyStats = await query(`
      SELECT 
        DATE(created_time) as date,
        COUNT(*) as count,
        SUM(file_size) as total_size
      FROM files
      WHERE device_id = ? AND created_time >= ?
      GROUP BY DATE(created_time)
      ORDER BY date DESC
    `, [deviceId, startDate]);

    // 获取总体统计
    const totalStats = await queryOne(`
      SELECT 
        COUNT(*) as total_files,
        SUM(file_size) as total_size,
        AVG(file_size) as avg_size,
        MIN(created_time) as first_file,
        MAX(created_time) as last_file
      FROM files
      WHERE device_id = ? AND created_time >= ?
    `, [deviceId, startDate]);

    res.json({
      success: true,
      data: {
        total_stats: totalStats,
        type_stats: typeStats,
        daily_stats: dailyStats
      }
    });
  } catch (error) {
    logger.error('获取文件统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计失败'
    });
  }
};

/**
 * 生成缩略图
 */
const generateThumbnail = async (filePath, fileType) => {
  try {
    const ffmpeg = require('fluent-ffmpeg');
    const sharp = require('sharp');
    
    const thumbnailDir = path.join(config.upload.path, 'thumbnails');
    await fs.mkdir(thumbnailDir, { recursive: true });
    
    const fileName = path.basename(filePath, path.extname(filePath));
    const thumbnailPath = path.join(thumbnailDir, `${fileName}_thumb.jpg`);
    const relativePath = `thumbnails/${fileName}_thumb.jpg`;

    if (fileType === 'photo') {
      // 图片缩略图
      await sharp(filePath)
        .resize(200, 200, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);
    } else if (fileType === 'video') {
      // 视频缩略图
      return new Promise((resolve, reject) => {
        ffmpeg(filePath)
          .screenshots({
            timestamps: ['00:00:01'],
            filename: `${fileName}_thumb.jpg`,
            folder: thumbnailDir,
            size: '200x200'
          })
          .on('end', () => resolve(relativePath))
          .on('error', reject);
      });
    }

    return relativePath;
  } catch (error) {
    logger.error('生成缩略图失败:', error);
    return null;
  }
};

/**
 * 配置文件上传中间件
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(config.upload.path, 'temp');
    fs.mkdir(uploadDir, { recursive: true })
      .then(() => cb(null, uploadDir))
      .catch(cb);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  // 检查文件类型
  const allowedTypes = config.upload.allowed_types || [
    'image/jpeg', 'image/png', 'image/gif',
    'video/mp4', 'video/avi', 'video/mov',
    'audio/mp3', 'audio/wav', 'audio/aac',
    'application/pdf', 'text/plain'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.max_size || 100 * 1024 * 1024 // 默认100MB
  }
});

module.exports = {
  getFiles,
  uploadFile,
  downloadFile,
  getThumbnail,
  deleteFile,
  deleteFiles,
  getFileStats,
  upload
};