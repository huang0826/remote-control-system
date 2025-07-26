module.exports = {
  // 测试环境
  testEnvironment: 'node',
  
  // 测试文件匹配模式
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js',
    '**/__tests__/**/*.js'
  ],
  
  // 忽略的文件和目录
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/'
  ],
  
  // 覆盖率收集
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/**',
    '!src/scripts/**',
    '!src/migrations/**',
    '!src/seeders/**',
    '!**/node_modules/**',
    '!**/vendor/**'
  ],
  
  // 覆盖率报告
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json'
  ],
  
  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // 设置文件
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],
  
  // 模块路径映射
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1'
  },
  
  // 全局变量
  globals: {
    'NODE_ENV': 'test'
  },
  
  // 测试超时时间（毫秒）
  testTimeout: 30000,
  
  // 详细输出
  verbose: true,
  
  // 清除模拟
  clearMocks: true,
  restoreMocks: true,
  
  // 错误时停止
  bail: false,
  
  // 最大工作进程数
  maxWorkers: '50%',
  
  // 缓存目录
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // 转换忽略模式
  transformIgnorePatterns: [
    'node_modules/(?!(.*\.mjs$))'
  ],
  
  // 模块文件扩展名
  moduleFileExtensions: [
    'js',
    'json',
    'node'
  ],
  
  // 运行前脚本
  globalSetup: '<rootDir>/tests/globalSetup.js',
  
  // 运行后脚本
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  
  // 每个测试文件的设置
  setupFiles: [
    '<rootDir>/tests/env.js'
  ],
  
  // 报告器
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/html-report',
        filename: 'report.html',
        expand: true
      }
    ]
  ],
  
  // 监听插件
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // 错误处理
  errorOnDeprecated: true,
  
  // 强制退出
  forceExit: true,
  
  // 检测打开的句柄
  detectOpenHandles: true,
  
  // 检测泄漏
  detectLeaks: false
};