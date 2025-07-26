/**
 * 文件管理控制器 - 用于远程访问设备文件系统
 */

const Device = require('../models/Device');
const { query, queryOne } = require('../database/connection');
const logger = require('../utils/logger');
const socketManager = require('../socket/socketManager');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const config = require('../config');

/**
 * 获取设备文件列表
 */
const getFileList = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { path: directoryPath } = req.query;
    
    // 验证设备存在
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }
    
    // 检查设备是否在线
    const isOnline = socketManager.isDeviceOnline(device.device_id);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备不在线'
      });
    }
    
    // 检查权限
    const hasPermission = await Device.checkControlPermission(req.user.id, deviceId);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: '无权访问该设备'
      });
    }
    
    // 生成任务ID
    const taskId = crypto.randomUUID();
    
    // 构建指令
    const command = {
      task_id: taskId,
      type: 'get_file_list'
    };
    
    // 如果指定了目录路径，添加到指令中
    if (directoryPath) {
      command.path = directoryPath;
    }
    
    // 发送指令到设备
    socketManager.sendCommandToDevice(device.device_id, 'get_file_list', command);
    
    // 等待设备响应
    const result = await socketManager.waitForDeviceResponse(device.device_id, 'file_list_result', taskId, 30000);
    
    if (!result) {
      return res.status(408).json({
        success: false,
        message: '设备响应超时'
      });
    }
    
    // 记录操作日志
    logger.logUserAction(req.user.id, 'get_file_list', {
      device_id: deviceId,
      directory_path: directoryPath
    });
    
    res.json({
      success: true,
      data: result
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
 * 获取文件信息
 */
const getFileInfo = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: '文件路径不能为空'
      });
    }
    
    // 验证设备存在
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }
    
    // 检查设备是否在线
    const isOnline = socketManager.isDeviceOnline(device.device_id);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备不在线'
      });
    }
    
    // 检查权限
    const hasPermission = await Device.checkControlPermission(req.user.id, deviceId);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: '无权访问该设备'
      });
    }
    
    // 生成任务ID
    const taskId = crypto.randomUUID();
    
    // 构建指令
    const command = {
      task_id: taskId,
      type: 'get_file_info',
      path: filePath
    };
    
    // 发送指令到设备
    socketManager.sendCommandToDevice(device.device_id, 'get_file_info', command);
    
    // 等待设备响应
    const result = await socketManager.waitForDeviceResponse(device.device_id, 'file_info_result', taskId, 30000);
    
    if (!result) {
      return res.status(408).json({
        success: false,
        message: '设备响应超时'
      });
    }
    
    // 记录操作日志
    logger.logUserAction(req.user.id, 'get_file_info', {
      device_id: deviceId,
      file_path: filePath
    });
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('获取文件信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取文件信息失败'
    });
  }
};

/**
 * 下载文件
 */
const downloadFile = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: '文件路径不能为空'
      });
    }
    
    // 验证设备存在
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }
    
    // 检查设备是否在线
    const isOnline = socketManager.isDeviceOnline(device.device_id);
    if (!isOnline) {
      return res.status(400).json({
        success: false,
        message: '设备不在线'
      });
    }
    
    // 检查权限
    const hasPermission = await Device.checkControlPermission(req.user.id, deviceId);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: '无权访问该设备'
      });
    }
    
    // 生成任务ID
    const taskId = crypto.randomUUID();
    
    // 构建指令
    const command = {
      task_id: taskId,
      type: 'download_file',
      path: filePath
    };
    
    // 发送指令到设备
    socketManager.sendCommandToDevice(device.device_id, 'download_file', command);
    
    // 等待设备响应准备信息
    const prepareResult = await socketManager.waitForDeviceResponse(device.device_id, 'download_file_prepare', taskId, 30000);
    
    if (!prepareResult || !prepareResult.success) {
      return res.status(400).json({
        success: false,
        message: prepareResult?.message || '文件准备失败'
      });
    }
    
    // 设置响应头
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(prepareResult.file_name)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', prepareResult.file_size);
    
    // 通知设备开始传输文件
    socketManager.sendCommandToDevice(device.device_id, 'start_file_transfer', {
      task_id: taskId,
      file_path: filePath
    });
    
    // 记录操作日志
    logger.logUserAction(req.user.id, 'download_file', {
      device_id: deviceId,
      file_path: filePath,
      file_name: prepareResult.file_name,
      file_size: prepareResult.file_size
    });
    
    // 文件传输逻辑将通过WebSocket或WebRTC数据通道处理
    // 这里只是设置了响应头，实际传输需要在Socket服务中实现
    
  } catch (error) {
    logger.error('下载文件失败:', error);
    res.status(500).json({
      success: false,
      message: '下载文件失败'
    });
  }
};

module.exports = {
  getFileList,
  getFileInfo,
  downloadFile
};