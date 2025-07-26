const { app, server } = require('./app');
const config = require('./src/config/config');
const { connectDB } = require('./src/config/database');
const { connectRedis } = require('./src/config/redis');

// 未捕获异常处理
process.on('uncaughtException', (error) => {
  console.error('未捕获异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  process.exit(1);
});

// 启动服务器
async function startServer() {
  try {
    // 连接数据库
    await connectDB();
    console.info('数据库连接成功');
    
    // 根据配置决定是否连接Redis
    if (config.redis.enabled) {
      await connectRedis();
      console.info('Redis连接成功');
    } else {
      console.info('Redis功能已禁用');
    }
    
    // 启动HTTP服务器
    const PORT = config.server.port || 3000;
    const HOST = config.server.host || '0.0.0.0';
    
    server.listen(PORT, HOST, () => {
      console.info(`服务器启动成功: ${config.server.url}`);
      console.info(`环境: ${config.server.env}`);
      console.info(`系统名称: ${config.system.name}`);
      console.info(`系统版本: ${config.system.version}`);
    });
    
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer();