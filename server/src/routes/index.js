/**
 * 主路由文件
 */

const express = require('express');
const router = express.Router();

// 导入子路由
const authRoutes = require('./auth');
const userRoutes = require('./users');
const deviceRoutes = require('./devices');
const controlRoutes = require('./control');
const fileRoutes = require('./files');
const membershipRoutes = require('./membership');
const agentRoutes = require('./agents');
const adminRoutes = require('./admin');
const paymentRoutes = require('./payment');
const locationRoutes = require('./location');
const appRoutes = require('./apps');
const notificationRoutes = require('./notifications');
const systemRoutes = require('./system');

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API版本信息
router.get('/version', (req, res) => {
  res.json({
    success: true,
    data: {
      version: '1.0.0',
      api_version: 'v1',
      build_time: new Date().toISOString()
    }
  });
});

// 注册子路由
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/devices', deviceRoutes);
router.use('/control', controlRoutes);
router.use('/files', fileRoutes);
router.use('/membership', membershipRoutes);
router.use('/agents', agentRoutes);
router.use('/admin', adminRoutes);
router.use('/payment', paymentRoutes);
router.use('/location', locationRoutes);
router.use('/apps', appRoutes);
router.use('/notifications', notificationRoutes);
router.use('/system', systemRoutes);

module.exports = router;