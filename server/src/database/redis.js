/**
 * Redis连接配置
 */

const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

// 根据配置决定是否创建Redis客户端
let redis = null;
if (config.redis.enabled) {
  redis = new Redis({
    host: config.redis.host || 'localhost',
    port: config.redis.port || 6379,
    password: config.redis.password || undefined,
    db: config.redis.db || 0,
    retryStrategy: function(times) {
      const delay = Math.min(times * 100, 2000);
      logger.warn(`Redis重试连接，第${times}次尝试，延迟${delay}ms`);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
    connectTimeout: 5000,
    commandTimeout: 3000
  });
}

// 连接事件监听
if (redis) {
  redis.on('connect', () => {
    logger.info('Redis连接成功');
  });

  redis.on('ready', () => {
    logger.info('Redis准备就绪');
  });

  redis.on('error', (err) => {
    logger.error('Redis连接错误:', err.message);
  });

  redis.on('close', () => {
    logger.warn('Redis连接关闭');
  });

  redis.on('reconnecting', () => {
    logger.info('Redis重新连接中...');
  });
}

/**
 * 检查Redis连接
 * @returns {Promise<boolean>}
 */
async function ping() {
  if (!redis) {
    logger.warn('Redis功能已禁用，跳过连接检查');
    return false;
  }
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error('Redis连接检查失败:', error.message);
    return false;
  }
}

/**
 * 缓存操作类
 */
class CacheManager {
  /**
   * 设置缓存
   * @param {string} key 键
   * @param {*} value 值
   * @param {number} ttl 过期时间(秒)
   * @returns {Promise}
   */
  async set(key, value, ttl = 3600) {
    if (!redis) {
      logger.warn('Redis功能已禁用，跳过设置缓存');
      return null;
    }
    try {
      const serializedValue = JSON.stringify(value);
      if (ttl > 0) {
        return await redis.setex(key, ttl, serializedValue);
      } else {
        return await redis.set(key, serializedValue);
      }
    } catch (error) {
      logger.error('Redis设置缓存失败:', { key, error: error.message });
      throw error;
    }
  }

  /**
   * 获取缓存
   * @param {string} key 键
   * @returns {Promise}
   */
  async get(key) {
    if (!redis) {
      logger.warn('Redis功能已禁用，跳过获取缓存');
      return null;
    }
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis获取缓存失败:', { key, error: error.message });
      return null;
    }
  }

  /**
   * 删除缓存
   * @param {string} key 键
   * @returns {Promise}
   */
  async del(key) {
    if (!redis) {
      logger.warn('Redis功能已禁用，跳过删除缓存');
      return null;
    }
    try {
      return await redis.del(key);
    } catch (error) {
      logger.error('Redis删除缓存失败:', { key, error: error.message });
      throw error;
    }
  }

  /**
   * 检查键是否存在
   * @param {string} key 键
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    if (!redis) {
      logger.warn('Redis功能已禁用，跳过检查键存在');
      return false;
    }
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis检查键存在失败:', { key, error: error.message });
      return false;
    }
  }

  /**
   * 设置过期时间
   * @param {string} key 键
   * @param {number} ttl 过期时间(秒)
   * @returns {Promise}
   */
  async expire(key, ttl) {
    if (!redis) {
      logger.warn('Redis功能已禁用，跳过设置过期时间');
      return null;
    }
    try {
      return await redis.expire(key, ttl);
    } catch (error) {
      logger.error('Redis设置过期时间失败:', { key, ttl, error: error.message });
      throw error;
    }
  }

  /**
   * 获取剩余过期时间
   * @param {string} key 键
   * @returns {Promise<number>}
   */
  async ttl(key) {
    if (!redis) {
      logger.warn('Redis功能已禁用，跳过获取过期时间');
      return -1;
    }
    try {
      return await redis.ttl(key);
    } catch (error) {
      logger.error('Redis获取过期时间失败:', { key, error: error.message });
      return -1;
    }
  }

  /**
   * 原子递增
   * @param {string} key 键
   * @param {number} increment 递增值
   * @returns {Promise<number>}
   */
  async incr(key, increment = 1) {
    if (!redis) {
      logger.warn('Redis功能已禁用，跳过递增操作');
      return null;
    }
    try {
      if (increment === 1) {
        return await redis.incr(key);
      } else {
        return await redis.incrby(key, increment);
      }
    } catch (error) {
      logger.error('Redis递增失败:', { key, increment, error: error.message });
      throw error;
    }
  }

  /**
   * 原子递减
   * @param {string} key 键
   * @param {number} decrement 递减值
   * @returns {Promise<number>}
   */
  async decr(key, decrement = 1) {
    if (!redis) {
      logger.warn('Redis功能已禁用，跳过递减操作');
      return null;
    }
    try {
      if (decrement === 1) {
        return await redis.decr(key);
      } else {
        return await redis.decrby(key, decrement);
      }
    } catch (error) {
      logger.error('Redis递减失败:', { key, decrement, error: error.message });
      throw error;
    }
  }

  /**
   * 列表左推
   * @param {string} key 键
   * @param {*} value 值
   * @returns {Promise<number>}
   */
  async lpush(key, value) {
    if (!redis) {
      logger.warn('Redis功能已禁用，跳过列表左推操作');
      return null;
    }
    try {
      const serializedValue = JSON.stringify(value);
      return await redis.lpush(key, serializedValue);
    } catch (error) {
      logger.error('Redis列表左推失败:', { key, error: error.message });
      throw error;
    }
  }

  /**
   * 列表右推
   * @param {string} key 键
   * @param {*} value 值
   * @returns {Promise<number>}
   */
  async rpush(key, value) {
    if (!redis) {
      logger.warn('Redis功能已禁用，跳过列表右推操作');
      return null;
    }
    try {
      const serializedValue = JSON.stringify(value);
      return await redis.rpush(key, serializedValue);
    } catch (error) {
      logger.error('Redis列表右推失败:', { key, error: error.message });
      throw error;
    }
  }

  /**
   * 列表左弹
   * @param {string} key 键
   * @returns {Promise}
   */
  async lpop(key) {
    if (!redis) {
      logger.warn('Redis功能已禁用，跳过列表左弹操作');
      return null;
    }
    try {
      const value = await redis.lpop(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis列表左弹失败:', { key, error: error.message });
      return null;
    }
  }

  /**
   * 列表右弹
   * @param {string} key 键
   * @returns {Promise}
   */
  async rpop(key) {
    if (!redis) {
      logger.warn('Redis功能已禁用，跳过列表右弹操作');
      return null;
    }
    try {
      const value = await redis.rpop(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis列表右弹失败:', { key, error: error.message });
      return null;
    }
  }

  /**
   * 获取列表长度
   * @param {string} key 键
   * @returns {Promise<number>}
   */
  async llen(key) {
    try {
      return await redis.llen(key);
    } catch (error) {
      logger.error('Redis获取列表长度失败:', { key, error: error.message });
      return 0;
    }
  }

  /**
   * 获取列表范围
   * @param {string} key 键
   * @param {number} start 开始索引
   * @param {number} stop 结束索引
   * @returns {Promise<Array>}
   */
  async lrange(key, start = 0, stop = -1) {
    try {
      const values = await redis.lrange(key, start, stop);
      return values.map(value => JSON.parse(value));
    } catch (error) {
      logger.error('Redis获取列表范围失败:', { key, start, stop, error: error.message });
      return [];
    }
  }

  /**
   * 集合添加
   * @param {string} key 键
   * @param {*} member 成员
   * @returns {Promise<number>}
   */
  async sadd(key, member) {
    try {
      const serializedMember = JSON.stringify(member);
      return await redis.sadd(key, serializedMember);
    } catch (error) {
      logger.error('Redis集合添加失败:', { key, error: error.message });
      throw error;
    }
  }

  /**
   * 集合移除
   * @param {string} key 键
   * @param {*} member 成员
   * @returns {Promise<number>}
   */
  async srem(key, member) {
    try {
      const serializedMember = JSON.stringify(member);
      return await redis.srem(key, serializedMember);
    } catch (error) {
      logger.error('Redis集合移除失败:', { key, error: error.message });
      throw error;
    }
  }

  /**
   * 检查集合成员
   * @param {string} key 键
   * @param {*} member 成员
   * @returns {Promise<boolean>}
   */
  async sismember(key, member) {
    try {
      const serializedMember = JSON.stringify(member);
      const result = await redis.sismember(key, serializedMember);
      return result === 1;
    } catch (error) {
      logger.error('Redis检查集合成员失败:', { key, error: error.message });
      return false;
    }
  }

  /**
   * 获取集合所有成员
   * @param {string} key 键
   * @returns {Promise<Array>}
   */
  async smembers(key) {
    try {
      const members = await redis.smembers(key);
      return members.map(member => JSON.parse(member));
    } catch (error) {
      logger.error('Redis获取集合成员失败:', { key, error: error.message });
      return [];
    }
  }

  /**
   * 哈希设置
   * @param {string} key 键
   * @param {string} field 字段
   * @param {*} value 值
   * @returns {Promise}
   */
  async hset(key, field, value) {
    try {
      const serializedValue = JSON.stringify(value);
      return await redis.hset(key, field, serializedValue);
    } catch (error) {
      logger.error('Redis哈希设置失败:', { key, field, error: error.message });
      throw error;
    }
  }

  /**
   * 哈希获取
   * @param {string} key 键
   * @param {string} field 字段
   * @returns {Promise}
   */
  async hget(key, field) {
    try {
      const value = await redis.hget(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis哈希获取失败:', { key, field, error: error.message });
      return null;
    }
  }

  /**
   * 哈希删除
   * @param {string} key 键
   * @param {string} field 字段
   * @returns {Promise}
   */
  async hdel(key, field) {
    try {
      return await redis.hdel(key, field);
    } catch (error) {
      logger.error('Redis哈希删除失败:', { key, field, error: error.message });
      throw error;
    }
  }

  /**
   * 获取所有哈希
   * @param {string} key 键
   * @returns {Promise<Object>}
   */
  async hgetall(key) {
    try {
      const hash = await redis.hgetall(key);
      const result = {};
      for (const [field, value] of Object.entries(hash)) {
        result[field] = JSON.parse(value);
      }
      return result;
    } catch (error) {
      logger.error('Redis获取所有哈希失败:', { key, error: error.message });
      return {};
    }
  }

  /**
   * 模糊匹配键
   * @param {string} pattern 模式
   * @returns {Promise<Array>}
   */
  async keys(pattern) {
    try {
      return await redis.keys(pattern);
    } catch (error) {
      logger.error('Redis模糊匹配键失败:', { pattern, error: error.message });
      return [];
    }
  }

  /**
   * 清空数据库
   * @returns {Promise}
   */
  async flushdb() {
    try {
      return await redis.flushdb();
    } catch (error) {
      logger.error('Redis清空数据库失败:', error.message);
      throw error;
    }
  }
}

// 创建缓存管理器实例
const cache = new CacheManager();

// 连接Redis
async function connectRedis() {
  if (!config.redis.enabled) {
    logger.info('Redis功能已禁用，跳过连接');
    return;
  }
  try {
    await redis.connect();
  } catch (error) {
    logger.error('Redis连接失败:', error.message);
    throw error;
  }
}


/**
 * 会话存储
 */
class SessionStore {
  constructor(prefix = 'session:') {
    this.prefix = prefix;
  }

  async get(sid) {
    const key = this.prefix + sid;
    return await cache.get(key);
  }

  async set(sid, session, ttl = 86400) {
    const key = this.prefix + sid;
    return await cache.set(key, session, ttl);
  }

  async destroy(sid) {
    const key = this.prefix + sid;
    return await cache.del(key);
  }

  async touch(sid, ttl = 86400) {
    const key = this.prefix + sid;
    return await cache.expire(key, ttl);
  }
}

// 创建会话存储实例
const sessionStore = new SessionStore();

/**
 * 关闭Redis连接
 */
function close() {
  return redis.disconnect();
}

module.exports = {
  redis,
  cache,
  sessionStore,
  SessionStore,
  close,
  ping,
  connectRedis
};