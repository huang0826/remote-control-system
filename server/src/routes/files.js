/**
 * 文件管理路由
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { body, query, validationResult } = require('express-validator');
const { authenticateToken, checkDevicePermission } = require('../middleware/auth');
const fileController = require('../controllers/fileController');

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 10 // 最多10个文件
  },
  fileFilter: (req, file, cb) => {
    // 允许的文件类型
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/wmv',
      'audio/mp3',
      'audio/wav',
      'audio/aac',
      'audio/m4a',
      'application/pdf',
      'text/plain',
      'application/json'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'), false);
    }
  }
});

/**
 * 获取文件列表
 */
router.get('/',
  authenticateToken,
  [
    query('device_id')
      .optional()
      .isString()
      .withMessage('设备ID必须是字符串'),
    query('file_type')
      .optional()
      .isIn(['image', 'video', 'audio', 'document', 'other'])
      .withMessage('文件类型无效'),
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
  fileController.getFileList
);

/**
 * 文件上传
 */
router.post('/upload',
  authenticateToken,
  upload.array('files', 10),
  [
    body('device_id')
      .notEmpty()
      .withMessage('设备ID不能为空'),
    body('task_id')
      .optional()
      .isString()
      .withMessage('任务ID必须是字符串'),
    body('file_type')
      .isIn(['photo', 'video', 'audio', 'screenshot', 'screen_record', 'document', 'other'])
      .withMessage('文件类型无效'),
    body('description')
      .optional()
      .isString()
      .withMessage('文件描述必须是字符串')
  ],
  fileController.uploadFile
);

/**
 * 文件下载
 */
router.get('/download/:fileId',
  authenticateToken,
  fileController.downloadFile
);

/**
 * 获取缩略图
 */
router.get('/thumbnail/:fileId',
  authenticateToken,
  fileController.getThumbnail
);

/**
 * 删除文件
 */
router.delete('/:fileId',
  authenticateToken,
  fileController.deleteFile
);

/**
 * 批量删除文件
 */
router.delete('/',
  authenticateToken,
  [
    body('file_ids')
      .isArray({ min: 1, max: 50 })
      .withMessage('文件ID列表必须是1-50个文件的数组'),
    body('file_ids.*')
      .isInt({ min: 1 })
      .withMessage('文件ID必须是正整数')
  ],
  fileController.batchDeleteFiles
);

/**
 * 获取文件统计信息
 */
router.get('/stats/overview',
  authenticateToken,
  [
    query('device_id')
      .optional()
      .isString()
      .withMessage('设备ID必须是字符串'),
    query('start_date')
      .optional()
      .isISO8601()
      .withMessage('开始日期格式无效'),
    query('end_date')
      .optional()
      .isISO8601()
      .withMessage('结束日期格式无效')
  ],
  fileController.getFileStats
);

/**
 * 获取文件详情
 */
router.get('/:fileId',
  authenticateToken,
  async (req, res) => {
    try {
      const { fileId } = req.params;
      const { queryOne } = require('../database/connection');
      
      // 获取文件信息
      const file = await queryOne(`
        SELECT 
          f.*,
          d.device_name,
          u.nickname as uploader_name
        FROM files f
        LEFT JOIN devices d ON f.device_id = d.device_id
        LEFT JOIN users u ON f.user_id = u.id
        WHERE f.id = ?
      `, [fileId]);
      
      if (!file) {
        return res.status(404).json({
          success: false,
          message: '文件不存在'
        });
      }
      
      // 检查权限
      if (file.user_id !== req.user.id) {
        // 检查是否有设备控制权限
        const Device = require('../models/Device');
        const hasPermission = await Device.checkControlPermission(file.device_id, req.user.id);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: '无权限访问此文件'
          });
        }
      }
      
      res.json({
        success: true,
        data: {
          ...file,
          metadata: file.metadata ? JSON.parse(file.metadata) : null
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取文件详情失败'
      });
    }
  }
);

/**
 * 更新文件信息
 */
router.put('/:fileId',
  authenticateToken,
  [
    body('description')
      .optional()
      .isString()
      .withMessage('文件描述必须是字符串'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('标签必须是数组'),
    body('is_favorite')
      .optional()
      .isBoolean()
      .withMessage('收藏状态必须是布尔值')
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
      
      const { fileId } = req.params;
      const { description, tags, is_favorite } = req.body;
      const { queryOne, update } = require('../database/connection');
      
      // 检查文件是否存在
      const file = await queryOne('SELECT * FROM files WHERE id = ?', [fileId]);
      if (!file) {
        return res.status(404).json({
          success: false,
          message: '文件不存在'
        });
      }
      
      // 检查权限
      if (file.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: '无权限修改此文件'
        });
      }
      
      // 更新文件信息
      const updateData = {
        updated_time: new Date()
      };
      
      if (description !== undefined) {
        updateData.description = description;
      }
      
      if (tags !== undefined) {
        updateData.tags = JSON.stringify(tags);
      }
      
      if (is_favorite !== undefined) {
        updateData.is_favorite = is_favorite;
      }
      
      await update('files', updateData, { id: fileId });
      
      res.json({
        success: true,
        message: '文件信息已更新'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '更新文件信息失败'
      });
    }
  }
);

/**
 * 获取文件分享链接
 */
router.post('/:fileId/share',
  authenticateToken,
  [
    body('expire_hours')
      .optional()
      .isInt({ min: 1, max: 168 })
      .withMessage('过期时间必须在1-168小时之间'),
    body('password')
      .optional()
      .isString()
      .isLength({ min: 4, max: 20 })
      .withMessage('分享密码长度必须在4-20字符之间')
  ],
  async (req, res) => {
    try {
      const { fileId } = req.params;
      const { expire_hours = 24, password } = req.body;
      const { queryOne, insert } = require('../database/connection');
      const crypto = require('crypto');
      
      // 检查文件是否存在
      const file = await queryOne('SELECT * FROM files WHERE id = ?', [fileId]);
      if (!file) {
        return res.status(404).json({
          success: false,
          message: '文件不存在'
        });
      }
      
      // 检查权限
      if (file.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: '无权限分享此文件'
        });
      }
      
      // 生成分享码
      const shareCode = crypto.randomBytes(16).toString('hex');
      const expireTime = new Date(Date.now() + expire_hours * 60 * 60 * 1000);
      
      // 保存分享记录
      await insert('file_shares', {
        file_id: fileId,
        share_code: shareCode,
        password: password || null,
        expire_time: expireTime,
        created_by: req.user.id,
        created_time: new Date()
      });
      
      res.json({
        success: true,
        data: {
          share_code: shareCode,
          share_url: `${req.protocol}://${req.get('host')}/api/files/shared/${shareCode}`,
          expire_time: expireTime,
          password: password || null
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '生成分享链接失败'
      });
    }
  }
);

/**
 * 访问分享文件
 */
router.get('/shared/:shareCode',
  [
    query('password')
      .optional()
      .isString()
      .withMessage('分享密码必须是字符串')
  ],
  async (req, res) => {
    try {
      const { shareCode } = req.params;
      const { password } = req.query;
      const { queryOne } = require('../database/connection');
      
      // 获取分享信息
      const share = await queryOne(`
        SELECT 
          fs.*,
          f.filename,
          f.original_name,
          f.file_size,
          f.file_type,
          f.mime_type
        FROM file_shares fs
        JOIN files f ON fs.file_id = f.id
        WHERE fs.share_code = ? AND fs.expire_time > NOW()
      `, [shareCode]);
      
      if (!share) {
        return res.status(404).json({
          success: false,
          message: '分享链接不存在或已过期'
        });
      }
      
      // 检查密码
      if (share.password && share.password !== password) {
        return res.status(401).json({
          success: false,
          message: '分享密码错误'
        });
      }
      
      // 返回文件下载链接
      res.json({
        success: true,
        data: {
          filename: share.original_name,
          file_size: share.file_size,
          file_type: share.file_type,
          mime_type: share.mime_type,
          download_url: `/api/files/shared/${shareCode}/download${password ? `?password=${password}` : ''}`
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '访问分享文件失败'
      });
    }
  }
);

/**
 * 下载分享文件
 */
router.get('/shared/:shareCode/download',
  async (req, res) => {
    try {
      const { shareCode } = req.params;
      const { password } = req.query;
      const { queryOne } = require('../database/connection');
      const fs = require('fs');
      const path = require('path');
      
      // 获取分享信息
      const share = await queryOne(`
        SELECT 
          fs.*,
          f.filename,
          f.original_name,
          f.file_path,
          f.mime_type
        FROM file_shares fs
        JOIN files f ON fs.file_id = f.id
        WHERE fs.share_code = ? AND fs.expire_time > NOW()
      `, [shareCode]);
      
      if (!share) {
        return res.status(404).json({
          success: false,
          message: '分享链接不存在或已过期'
        });
      }
      
      // 检查密码
      if (share.password && share.password !== password) {
        return res.status(401).json({
          success: false,
          message: '分享密码错误'
        });
      }
      
      // 检查文件是否存在
      const filePath = path.join(__dirname, '../../uploads', share.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: '文件不存在'
        });
      }
      
      // 设置响应头
      res.setHeader('Content-Type', share.mime_type);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(share.original_name)}"`);
      
      // 发送文件
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '下载分享文件失败'
      });
    }
  }
);

module.exports = router;