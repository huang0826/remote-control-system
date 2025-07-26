const socketIO = require('socket.io');
const logger = require('../utils/logger');
const config = require('../config');

let io;

let pubClient;
let subClient;

function initialize(server) {
  const socketConfig = {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    },
    pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 30000,
    pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 15000
  };

  // 如果Redis启用，添加适配器配置
  if (config.redis.enabled) {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const Redis = require('ioredis');
    pubClient = new Redis(config.redis);
    subClient = pubClient.duplicate();
    socketConfig.adapter = createAdapter(pubClient, subClient);
  }

  io = socketIO(server, socketConfig);

  io.on('connection', (socket) => {
    logger.info('新的Socket连接', { socketId: socket.id });

    // 设备认证处理
    socket.on('authenticate', (data) => {
      // 处理设备认证逻辑
      // ...
      
      // 保存设备ID到socket对象
      if (data.device_id) {
        socket.deviceId = data.device_id;
        socket.join(data.device_id);
        logger.info(`设备 ${data.device_id} 已认证并加入房间`);
      } else if (data.user_id) {
        // 控制端认证
        socket.userId = data.user_id;
        socket.join(`user_${data.user_id}`);
        logger.info(`用户 ${data.user_id} 已认证并加入房间`);
      }
    });
    
    // 添加控制端连接设备的事件处理
    socket.on('connect_to_device', (data) => {
      const { device_id } = data;
      if (socket.userId && device_id) {
        socket.join(`control_${device_id}`);
        logger.info(`用户 ${socket.userId} 已连接到设备 ${device_id} 的控制房间`);
      }
    });

    // WebRTC信令处理
    socket.on('webrtc_offer', (data) => {
      const { task_id } = data;
      // 将offer转发给控制端
      io.to(`control_${socket.deviceId}`).emit('webrtc_offer', data);
      logger.info(`WebRTC offer from device ${socket.deviceId} forwarded to control`);
    });

    socket.on('webrtc_answer', (data) => {
      const { device_id } = data;
      // 将answer转发给设备端
      io.to(device_id).emit('webrtc_answer', data);
      logger.info(`WebRTC answer forwarded to device ${device_id}`);
    });

    socket.on('webrtc_ice_candidate', (data) => {
      const { device_id } = data;
      // 将ICE候选转发给对方
      if (device_id) {
        io.to(device_id).emit('webrtc_ice_candidate', data);
      } else {
        io.to(`control_${socket.deviceId}`).emit('webrtc_ice_candidate', data);
      }
      logger.info('WebRTC ICE candidate forwarded');
    });

    // 设备控制命令处理
    socket.on('device_control', (data) => {
      const { device_id, command } = data;
      if (device_id && command) {
        io.to(device_id).emit('control_command', command);
        logger.info(`控制命令已发送到设备 ${device_id}`, { command: command.type });
      }
    });

    // 设备状态更新
    socket.on('device_status', (data) => {
      if (socket.deviceId) {
        // 转发设备状态到控制端
        io.to(`control_${socket.deviceId}`).emit('device_status_update', {
          device_id: socket.deviceId,
          ...data
        });
        logger.info(`设备 ${socket.deviceId} 状态已更新`);
      }
    });

    // 控制响应处理
    socket.on('control_response', (data) => {
      if (socket.deviceId) {
        io.to(`control_${socket.deviceId}`).emit('control_response', {
          device_id: socket.deviceId,
          ...data
        });
        logger.info(`设备 ${socket.deviceId} 控制响应已转发`);
      }
    });

    socket.on('disconnect', () => {
      logger.info('Socket断开连接', { 
        socketId: socket.id, 
        deviceId: socket.deviceId, 
        userId: socket.userId 
      });
    });

    socket.on('error', (error) => {
      logger.error('Socket错误', { 
        socketId: socket.id, 
        deviceId: socket.deviceId, 
        userId: socket.userId, 
        error 
      });
    });
  });
  
  // 返回io实例，以便在app.js中使用
  return io;
}

function getSocketIO() {
  if (!io) {
    throw new Error('Socket.IO未初始化');
  }
  return io;
}

/**
 * 向指定设备发送命令
 * @param {string} deviceId 设备ID
 * @param {object} command 命令对象
 * @returns {boolean} 是否发送成功
 */
async function sendToDevice(deviceId, command) {
  try {
    if (!io) {
      throw new Error('Socket.IO未初始化');
    }
    
    // 获取设备的socket连接
    const sockets = await io.in(deviceId).fetchSockets();
    if (!sockets || sockets.length === 0) {
      logger.warn('设备不在线', { deviceId });
      return false;
    }
    
    // 发送命令到设备
    io.to(deviceId).emit('command', command);
    
    logger.info('命令已发送到设备', { deviceId, commandType: command.type });
    return true;
  } catch (error) {
    logger.error('发送命令到设备失败', { deviceId, error: error.message });
    return false;
  }
}

/**
 * 向指定用户发送消息
 * @param {string} userId 用户ID
 * @param {string} event 事件名称
 * @param {object} data 数据
 * @returns {boolean} 是否发送成功
 */
async function sendToUser(userId, event, data) {
  try {
    if (!io) {
      throw new Error('Socket.IO未初始化');
    }
    
    // 发送消息到用户
    io.to(`user_${userId}`).emit(event, data);
    
    logger.info('消息已发送到用户', { userId, event });
    return true;
  } catch (error) {
    logger.error('发送消息到用户失败', { userId, event, error: error.message });
    return false;
  }
}

/**
 * 获取在线设备列表
 * @returns {Array} 在线设备ID列表
 */
async function getOnlineDevices() {
  try {
    if (!io) {
      return [];
    }
    
    const sockets = await io.fetchSockets();
    const devices = sockets
      .filter(socket => socket.deviceId)
      .map(socket => socket.deviceId);
    
    return [...new Set(devices)]; // 去重
  } catch (error) {
    logger.error('获取在线设备列表失败', { error: error.message });
    return [];
  }
}

function cleanup() {
  if (config.redis.enabled) {
    if (pubClient) {
      pubClient.quit();
      pubClient = null;
    }
    if (subClient) {
      subClient.quit();
      subClient = null;
    }
  }
  if (io) {
    io.close();
    io = null;
  }
}

module.exports = {
  initialize,
  getSocketIO,
  sendToDevice,
  sendToUser,
  getOnlineDevices,
  cleanup
};