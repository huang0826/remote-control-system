/**
 * Jest测试环境设置
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters';
process.env.DB_NAME = 'device_management_test';
process.env.REDIS_DB = '15'; // 使用不同的Redis数据库

// 设置测试超时
jest.setTimeout(30000);

// 全局测试工具
global.testUtils = {
  // 生成测试用户数据
  generateUserData: () => ({
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'Test123456!',
    phone: '+86 138 0013 8000'
  }),
  
  // 生成测试设备数据
  generateDeviceData: () => ({
    deviceId: `device_${Date.now()}`,
    name: `测试设备_${Date.now()}`,
    model: 'Test Device Model',
    os: 'Test OS 1.0',
    manufacturer: 'Test Manufacturer'
  }),
  
  // 生成JWT令牌
  generateToken: (payload = { userId: 1 }) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
  },
  
  // 等待函数
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // 清理数据库
  cleanDatabase: async () => {
    // 这里可以添加清理测试数据的逻辑
    console.log('清理测试数据库...');
  },
  
  // 创建测试用户
  createTestUser: async (userData = {}) => {
    const defaultData = global.testUtils.generateUserData();
    return { ...defaultData, ...userData, id: Math.floor(Math.random() * 1000) };
  },
  
  // 创建测试设备
  createTestDevice: async (deviceData = {}, userId = 1) => {
    const defaultData = global.testUtils.generateDeviceData();
    return { 
      ...defaultData, 
      ...deviceData, 
      id: Math.floor(Math.random() * 1000),
      userId,
      status: 'offline',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
};

// 模拟外部服务
jest.mock('../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/services/smsService', () => ({
  sendSMS: jest.fn().mockResolvedValue(true),
  sendVerificationCode: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/services/pushService', () => ({
  sendPushNotification: jest.fn().mockResolvedValue(true),
  sendToDevice: jest.fn().mockResolvedValue(true),
  sendToUser: jest.fn().mockResolvedValue(true)
}));

// 模拟支付服务
jest.mock('../src/services/paymentService', () => ({
  createAlipayOrder: jest.fn().mockResolvedValue({ orderId: 'test_order_123' }),
  createWechatOrder: jest.fn().mockResolvedValue({ orderId: 'test_order_456' }),
  verifyPayment: jest.fn().mockResolvedValue(true)
}));

// 模拟文件上传服务
jest.mock('../src/services/uploadService', () => ({
  uploadFile: jest.fn().mockResolvedValue({
    filename: 'test-file.jpg',
    path: '/uploads/test-file.jpg',
    size: 1024
  }),
  deleteFile: jest.fn().mockResolvedValue(true)
}));

// 控制台输出控制
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// 在测试期间抑制某些控制台输出
console.error = (...args) => {
  // 只在非测试相关的错误时输出
  if (!args[0]?.toString().includes('Warning:')) {
    originalConsoleError.apply(console, args);
  }
};

console.warn = (...args) => {
  // 抑制某些警告
  if (!args[0]?.toString().includes('deprecated')) {
    originalConsoleWarn.apply(console, args);
  }
};

// 测试前清理
beforeEach(async () => {
  // 清理模拟函数调用记录
  jest.clearAllMocks();
});

// 测试后清理
afterEach(async () => {
  // 可以在这里添加每个测试后的清理逻辑
});

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('测试中发生未处理的Promise拒绝:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('测试中发生未捕获异常:', error);
});