/**
 * 文件管理路由 - 用于远程访问设备文件系统
 */

const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const { authenticateToken, checkDevicePermission } = require('../middleware/auth');
const fileManagerController = require('../controllers/fileManagerController');

/**
 * 获取文件列表
 */
router.get('/:deviceId/list',
  authenticateToken,
  [
    query('path')
      .optional()
      .isString()
      .withMessage('路径必须是字符串')
  ],
  fileManagerController.getFileList
);

/**
 * 获取文件信息
 */
router.get('/:deviceId/info',
  authenticateToken,
  [
    query('filePath')
      .notEmpty()
      .withMessage('文件路径不能为空')
      .isString()
      .withMessage('文件路径必须是字符串')
  ],
  fileManagerController.getFileInfo
);

/**
 * 下载文件
 */
router.get('/:deviceId/download',
  authenticateToken,
  [
    query('filePath')
      .notEmpty()
      .withMessage('文件路径不能为空')
      .isString()
      .withMessage('文件路径必须是字符串')
  ],
  fileManagerController.downloadFile
);

module.exports = router;