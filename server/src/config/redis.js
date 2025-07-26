const Redis = require('redis');
const config = require('./config');

const redis = Redis.createClient({
  socket: {
    host: config.redis.host,
    port: config.redis.port
  },
  password: config.redis.password || undefined,
  database: config.redis.db
});

redis.on('connect', () => {
  console.info('Redis连接成功');
});

redis.on('error', (error) => {
  console.error('Redis连接错误:', error);
});

const connectRedis = async () => {
  try {
    await redis.connect();
    return redis;
  } catch (error) {
    console.error('Redis连接失败:', error);
    throw error;
  }
};

module.exports = {
  redis,
  connectRedis
};