import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect(url) {
    if (this.socket) {
      this.disconnect();
    }

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    // 设置基本事件监听
    this.socket.on('connect', () => {
      console.log('Socket连接成功');
      this.emit('connect');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket连接断开:', reason);
      this.emit('disconnect', reason);
    });

    this.socket.on('error', (error) => {
      console.error('Socket错误:', error);
      this.emit('error', error);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Socket重连成功:', attemptNumber);
      this.emit('reconnect', attemptNumber);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('Socket重连失败:', error);
      this.emit('reconnect_error', error);
    });

    // WebRTC信令相关事件
    this.socket.on('offer', (data) => {
      this.emit('offer', data);
    });

    this.socket.on('answer', (data) => {
      this.emit('answer', data);
    });

    this.socket.on('ice-candidate', (data) => {
      this.emit('ice-candidate', data);
    });

    // 设备控制相关事件
    this.socket.on('device-status', (data) => {
      this.emit('device-status', data);
    });

    this.socket.on('control-response', (data) => {
      this.emit('control-response', data);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Socket事件监听器错误 (${event}):`, error);
        }
      });
    }
  }

  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  removeListener(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // 发送WebRTC信令
  sendOffer(deviceId, offer) {
    if (this.socket) {
      this.socket.emit('offer', { deviceId, offer });
    }
  }

  sendAnswer(deviceId, answer) {
    if (this.socket) {
      this.socket.emit('answer', { deviceId, answer });
    }
  }

  sendIceCandidate(deviceId, candidate) {
    if (this.socket) {
      this.socket.emit('ice-candidate', { deviceId, candidate });
    }
  }

  // 发送设备控制命令
  sendControlCommand(deviceId, command) {
    if (this.socket) {
      this.socket.emit('device-control', { deviceId, command });
    }
  }

  // 加入设备房间
  joinDeviceRoom(deviceId) {
    if (this.socket) {
      this.socket.emit('join-device', { deviceId });
    }
  }

  // 离开设备房间
  leaveDeviceRoom(deviceId) {
    if (this.socket) {
      this.socket.emit('leave-device', { deviceId });
    }
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }
}

export default new SocketService();