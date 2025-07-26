/**
 * Jest全局设置
 * 在所有测试开始前运行
 */

const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('\n🚀 开始设置测试环境...');
  
  try {
    // 创建测试所需的目录
    const testDirs = [
      './tests/uploads',
      './tests/backups',
      './tests/logs',
      './tests/temp'
    ];
    
    for (const dir of testDirs) {
      const fullPath = path.resolve(dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`✓ 创建测试目录: ${dir}`);
      }
    }
    
    // 设置测试环境变量
    process.env.NODE_ENV = 'test';
    process.env.SUPPRESS_NO_CONFIG_WARNING = 'true';
    
    // 创建测试配置文件
    const testConfigPath = path.resolve('./tests/test.config.json');
    const testConfig = {
      testStartTime: new Date().toISOString(),
      testEnvironment: 'jest',
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        name: process.env.DB_NAME || 'device_management_test',
        user: process.env.DB_USER || 'root'
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        db: process.env.REDIS_DB || 15
      }
    };
    
    fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));
    console.log('✓ 创建测试配置文件');
    
    // 等待一下确保所有设置完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ 测试环境设置完成\n');
    
  } catch (error) {
    console.error('❌ 测试环境设置失败:', error);
    process.exit(1);
  }
};