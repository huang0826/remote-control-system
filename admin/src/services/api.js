const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://114.215.211.109:3000/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // 获取认证头
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // 通用请求方法
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getAuthHeaders(),
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '请求失败');
      }
      
      return data;
    } catch (error) {
      console.error('API请求错误:', error);
      throw error;
    }
  }

  // GET请求
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  // POST请求
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // PUT请求
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // DELETE请求
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // 用户相关API
  async login(credentials) {
    return this.post('/auth/login', credentials);
  }

  async logout() {
    return this.post('/auth/logout');
  }

  // 设备相关API
  async getDevices() {
    return this.get('/devices');
  }

  async getDevice(deviceId) {
    return this.get(`/devices/${deviceId}`);
  }

  async updateDevice(deviceId, data) {
    return this.put(`/devices/${deviceId}`, data);
  }

  async deleteDevice(deviceId) {
    return this.delete(`/devices/${deviceId}`);
  }

  // 文件管理API
  async getFiles(deviceId, path = '') {
    return this.get(`/fileManager/${deviceId}/files?path=${encodeURIComponent(path)}`);
  }

  async downloadFile(deviceId, filePath) {
    const token = localStorage.getItem('token');
    const url = `${this.baseURL}/fileManager/${deviceId}/download?path=${encodeURIComponent(filePath)}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('文件下载失败');
    }
    
    return response.blob();
  }

  async deleteFile(deviceId, filePath) {
    return this.delete(`/fileManager/${deviceId}/files?path=${encodeURIComponent(filePath)}`);
  }

  // 控制相关API
  async startLiveVideo(deviceId) {
    return this.post(`/control/live-video/${deviceId}`);
  }

  async stopLiveVideo(deviceId) {
    return this.post(`/control/stop-video/${deviceId}`);
  }

  async sendControlCommand(deviceId, command) {
    return this.post(`/control/command/${deviceId}`, command);
  }
}

export default new ApiService();