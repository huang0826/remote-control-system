/**
 * 用户模型
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, queryOne, insert, update, remove, count } = require('../database/connection');
const { cache } = require('../database/redis');
const config = require('../config');
const logger = require('../utils/logger');

class User {
  /**
   * 创建用户
   * @param {Object} userData 用户数据
   * @returns {Promise<Object>}
   */
  static async create(userData) {
    try {
      // 检查手机号是否已存在
      const existingUser = await this.findByPhone(userData.phone);
      if (existingUser) {
        throw new Error('手机号已被注册');
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(userData.password, 12);

      // 准备用户数据
      const user = {
        phone: userData.phone,
        password: hashedPassword,
        nickname: userData.nickname || `用户${userData.phone.slice(-4)}`,
        avatar: userData.avatar || '',
        membership_type: 'free',
        membership_expire_time: null,
        agent_id: userData.agent_id || null,
        invite_code: this.generateInviteCode(),
        status: 'active',
        last_login_time: new Date(),
        last_login_ip: userData.ip || '',
        created_time: new Date(),
        updated_time: new Date()
      };

      const result = await insert('users', user);
      user.id = result.insertId;

      // 记录用户注册
      logger.logUserAction(user.id, 'register', {
        phone: userData.phone,
        agent_id: userData.agent_id
      }, userData.ip);

      // 清除敏感信息
      delete user.password;
      return user;
    } catch (error) {
      logger.error('创建用户失败:', error);
      throw error;
    }
  }

  /**
   * 用户登录
   * @param {string} phone 手机号
   * @param {string} password 密码
   * @param {string} ip IP地址
   * @returns {Promise<Object>}
   */
  static async login(phone, password, ip = '') {
    try {
      // 查找用户
      const user = await this.findByPhone(phone);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 检查用户状态
      if (user.status !== 'active') {
        throw new Error('用户已被禁用');
      }

      // 验证密码
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw new Error('密码错误');
      }

      // 更新登录信息
      await update('users', {
        last_login_time: new Date(),
        last_login_ip: ip,
        updated_time: new Date()
      }, { id: user.id });

      // 生成JWT令牌
      const token = this.generateToken(user);

      // 缓存用户信息
      await cache.set(`user:${user.id}`, user, config.jwt.expiresIn);

      // 记录登录日志
      logger.logUserAction(user.id, 'login', { phone }, ip);

      // 清除敏感信息
      delete user.password;

      return {
        user,
        token
      };
    } catch (error) {
      logger.error('用户登录失败:', error);
      throw error;
    }
  }

  /**
   * 根据手机号查找用户
   * @param {string} phone 手机号
   * @returns {Promise<Object|null>}
   */
  static async findByPhone(phone) {
    try {
      const sql = 'SELECT * FROM users WHERE phone = ? AND deleted_time IS NULL';
      return await queryOne(sql, [phone]);
    } catch (error) {
      logger.error('根据手机号查找用户失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID查找用户
   * @param {number} id 用户ID
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    try {
      // 先从缓存获取
      let user = await cache.get(`user:${id}`);
      if (user) {
        return user;
      }

      // 从数据库获取
      const sql = 'SELECT * FROM users WHERE id = ? AND deleted_time IS NULL';
      user = await queryOne(sql, [id]);
      
      if (user) {
        // 缓存用户信息
        await cache.set(`user:${id}`, user, 3600);
      }

      return user;
    } catch (error) {
      logger.error('根据ID查找用户失败:', error);
      throw error;
    }
  }

  /**
   * 根据邀请码查找用户
   * @param {string} inviteCode 邀请码
   * @returns {Promise<Object|null>}
   */
  static async findByInviteCode(inviteCode) {
    try {
      const sql = 'SELECT * FROM users WHERE invite_code = ? AND deleted_time IS NULL';
      return await queryOne(sql, [inviteCode]);
    } catch (error) {
      logger.error('根据邀请码查找用户失败:', error);
      throw error;
    }
  }

  /**
   * 更新用户信息
   * @param {number} id 用户ID
   * @param {Object} updateData 更新数据
   * @returns {Promise<boolean>}
   */
  static async updateById(id, updateData) {
    try {
      // 过滤不允许更新的字段
      const allowedFields = ['nickname', 'avatar', 'membership_type', 'membership_expire_time', 'status'];
      const filteredData = {};
      
      for (const field of allowedFields) {
        if (updateData.hasOwnProperty(field)) {
          filteredData[field] = updateData[field];
        }
      }

      if (Object.keys(filteredData).length === 0) {
        return false;
      }

      filteredData.updated_time = new Date();

      const result = await update('users', filteredData, { id });
      
      if (result.affectedRows > 0) {
        // 清除缓存
        await cache.del(`user:${id}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('更新用户信息失败:', error);
      throw error;
    }
  }

  /**
   * 修改密码
   * @param {number} id 用户ID
   * @param {string} oldPassword 旧密码
   * @param {string} newPassword 新密码
   * @returns {Promise<boolean>}
   */
  static async changePassword(id, oldPassword, newPassword) {
    try {
      const user = await this.findById(id);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 验证旧密码
      const isValidPassword = await bcrypt.compare(oldPassword, user.password);
      if (!isValidPassword) {
        throw new Error('旧密码错误');
      }

      // 加密新密码
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      const result = await update('users', {
        password: hashedPassword,
        updated_time: new Date()
      }, { id });

      if (result.affectedRows > 0) {
        // 清除缓存
        await cache.del(`user:${id}`);
        
        // 记录密码修改
        logger.logUserAction(id, 'change_password', {});
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('修改密码失败:', error);
      throw error;
    }
  }

  /**
   * 重置密码
   * @param {string} phone 手机号
   * @param {string} newPassword 新密码
   * @returns {Promise<boolean>}
   */
  static async resetPassword(phone, newPassword) {
    try {
      const user = await this.findByPhone(phone);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 加密新密码
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      const result = await update('users', {
        password: hashedPassword,
        updated_time: new Date()
      }, { id: user.id });

      if (result.affectedRows > 0) {
        // 清除缓存
        await cache.del(`user:${user.id}`);
        
        // 记录密码重置
        logger.logUserAction(user.id, 'reset_password', {});
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('重置密码失败:', error);
      throw error;
    }
  }

  /**
   * 删除用户
   * @param {number} id 用户ID
   * @returns {Promise<boolean>}
   */
  static async deleteById(id) {
    try {
      const result = await update('users', {
        deleted_time: new Date(),
        updated_time: new Date()
      }, { id });

      if (result.affectedRows > 0) {
        // 清除缓存
        await cache.del(`user:${id}`);
        
        // 记录用户删除
        logger.logUserAction(id, 'delete', {});
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('删除用户失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户列表
   * @param {Object} options 查询选项
   * @returns {Promise<Object>}
   */
  static async getList(options = {}) {
    try {
      const {
        page = 1,
        pageSize = 20,
        keyword = '',
        membershipType = '',
        status = '',
        agentId = null
      } = options;

      let sql = `
        SELECT 
          id, phone, nickname, avatar, membership_type, membership_expire_time,
          agent_id, invite_code, status, last_login_time, last_login_ip,
          created_time, updated_time
        FROM users 
        WHERE deleted_time IS NULL
      `;
      const params = [];

      // 关键词搜索
      if (keyword) {
        sql += ' AND (phone LIKE ? OR nickname LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`);
      }

      // 会员类型筛选
      if (membershipType) {
        sql += ' AND membership_type = ?';
        params.push(membershipType);
      }

      // 状态筛选
      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }

      // 代理筛选
      if (agentId) {
        sql += ' AND agent_id = ?';
        params.push(agentId);
      }

      sql += ' ORDER BY created_time DESC';

      // 分页
      const offset = (page - 1) * pageSize;
      sql += ` LIMIT ${offset}, ${pageSize}`;

      const users = await query(sql, params);

      // 获取总数
      let countSql = 'SELECT COUNT(*) as total FROM users WHERE deleted_time IS NULL';
      const countParams = [];
      
      if (keyword) {
        countSql += ' AND (phone LIKE ? OR nickname LIKE ?)';
        countParams.push(`%${keyword}%`, `%${keyword}%`);
      }
      if (membershipType) {
        countSql += ' AND membership_type = ?';
        countParams.push(membershipType);
      }
      if (status) {
        countSql += ' AND status = ?';
        countParams.push(status);
      }
      if (agentId) {
        countSql += ' AND agent_id = ?';
        countParams.push(agentId);
      }

      const countResult = await queryOne(countSql, countParams);
      const total = countResult ? countResult.total : 0;

      return {
        data: users,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: parseInt(total),
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      logger.error('获取用户列表失败:', error);
      throw error;
    }
  }

  /**
   * 生成JWT令牌
   * @param {Object} user 用户对象
   * @returns {string}
   */
  static generateToken(user) {
    const payload = {
      id: user.id,
      phone: user.phone,
      membershipType: user.membership_type
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn
    });
  }

  /**
   * 验证JWT令牌
   * @param {string} token JWT令牌
   * @returns {Object|null}
   */
  static verifyToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      logger.error('JWT令牌验证失败:', error);
      return null;
    }
  }

  /**
   * 生成邀请码
   * @returns {string}
   */
  static generateInviteCode() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 检查会员是否有效
   * @param {Object} user 用户对象
   * @returns {boolean}
   */
  static isMembershipValid(user) {
    if (user.membership_type === 'free') {
      return true;
    }
    
    if (user.membership_type === 'permanent') {
      return true;
    }
    
    if (user.membership_expire_time && new Date(user.membership_expire_time) > new Date()) {
      return true;
    }
    
    return false;
  }

  /**
   * 获取用户统计信息
   * @returns {Promise<Object>}
   */
  static async getStatistics() {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
          COUNT(CASE WHEN membership_type != 'free' THEN 1 END) as paid_users,
          COUNT(CASE WHEN DATE(created_time) = CURDATE() THEN 1 END) as today_new_users,
          COUNT(CASE WHEN DATE(last_login_time) = CURDATE() THEN 1 END) as today_active_users
        FROM users 
        WHERE deleted_time IS NULL
      `;
      
      return await queryOne(sql);
    } catch (error) {
      logger.error('获取用户统计信息失败:', error);
      throw error;
    }
  }
}

module.exports = User;