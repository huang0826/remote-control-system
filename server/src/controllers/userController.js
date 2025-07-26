/**
 * 用户控制器
 */

const User = require('../models/User');
const Device = require('../models/Device');
const { cache } = require('../database/redis');
const logger = require('../config/logger');
const config = require('../config');
const { query, queryOne } = require('../database/connection');

/**
 * 用户注册
 */
const register = async (req, res) => {
  try {
    const { phone, password, nickname, agent_code } = req.body;

    // 验证必填字段
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: '手机号和密码不能为空'
      });
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: '手机号格式不正确'
      });
    }

    // 验证密码长度
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: '密码长度不能少于6位'
      });
    }

    // 处理代理邀请码
    let agentId = null;
    if (agent_code) {
      const agentUser = await User.findByInviteCode(agent_code);
      if (agentUser) {
        // 检查是否为代理
        const agentSql = 'SELECT id FROM agents WHERE user_id = ? AND status = "active" AND deleted_time IS NULL';
        const agent = await queryOne(agentSql, [agentUser.id]);
        if (agent) {
          agentId = agent.id;
        }
      }
    }

    // 创建用户
    const userData = {
      phone,
      password,
      nickname,
      agent_id: agentId,
      ip: req.ip
    };

    const user = await User.create(userData);

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          nickname: user.nickname,
          membership_type: user.membership_type,
          invite_code: user.invite_code
        }
      }
    });
  } catch (error) {
    logger.error('用户注册失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '注册失败'
    });
  }
};

/**
 * 用户登录
 */
const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // 验证必填字段
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: '手机号和密码不能为空'
      });
    }

    // 用户登录
    const result = await User.login(phone, password, req.ip);

    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: {
          id: result.user.id,
          phone: result.user.phone,
          nickname: result.user.nickname,
          avatar: result.user.avatar,
          membership_type: result.user.membership_type,
          membership_expire_time: result.user.membership_expire_time,
          invite_code: result.user.invite_code
        },
        token: result.token
      }
    });
  } catch (error) {
    logger.error('用户登录失败:', error);
    res.status(401).json({
      success: false,
      message: error.message || '登录失败'
    });
  }
};

/**
 * 获取用户信息
 */
const getProfile = async (req, res) => {
  try {
    const user = req.user;

    // 获取用户设备数量
    const devices = await Device.findByUserId(user.id);
    const deviceCount = devices.length;
    const onlineDeviceCount = devices.filter(d => d.status === 'online').length;

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          nickname: user.nickname,
          avatar: user.avatar,
          membership_type: user.membership_type,
          membership_expire_time: user.membership_expire_time,
          invite_code: user.invite_code,
          status: user.status,
          created_time: user.created_time
        },
        statistics: {
          device_count: deviceCount,
          online_device_count: onlineDeviceCount
        }
      }
    });
  } catch (error) {
    logger.error('获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
};

/**
 * 更新用户信息
 */
const updateProfile = async (req, res) => {
  try {
    const { nickname, avatar } = req.body;
    const userId = req.user.id;

    const updateData = {};
    if (nickname !== undefined) updateData.nickname = nickname;
    if (avatar !== undefined) updateData.avatar = avatar;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有需要更新的字段'
      });
    }

    const success = await User.updateById(userId, updateData);
    
    if (success) {
      res.json({
        success: true,
        message: '更新成功'
      });
    } else {
      res.status(500).json({
        success: false,
        message: '更新失败'
      });
    }
  } catch (error) {
    logger.error('更新用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '更新用户信息失败'
    });
  }
};

/**
 * 修改密码
 */
const changePassword = async (req, res) => {
  try {
    const { old_password, new_password } = req.body;
    const userId = req.user.id;

    const success = await User.changePassword(userId, old_password, new_password);

    if (success) {
      res.json({
        success: true,
        message: '密码修改成功'
      });
    } else {
      res.status(400).json({
        success: false,
        message: '原密码不正确'
      });
    }
  } catch (error) {
    logger.error('修改密码失败:', error);
    res.status(500).json({
      success: false,
      message: '修改密码失败'
    });
  }
};

/**
 * 获取用户设备列表
 */
const getUserDevices = async (req, res) => {
  try {
    const devices = await Device.findByUserId(req.user.id);
    res.json({
      success: true,
      data: devices
    });
  } catch (error) {
    logger.error('获取用户设备列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取设备列表失败'
    });
  }
};

/**
 * 搜索其他用户
 */
const searchUsers = async (req, res) => {
  try {
    const { keyword } = req.body;
    const users = await User.search(keyword);
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    logger.error('搜索用户失败:', error);
    res.status(500).json({
      success: false,
      message: '搜索用户失败'
    });
  }
};

/**
 * 获取功能使用统计
 */
const getUsageStats = async (req, res) => {
  try {
    const stats = await User.getUsageStats(req.user.id);
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('获取使用统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取使用统计失败'
    });
  }
};

/**
 * 删除账户
 */
const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    const success = await User.deleteAccount(req.user.id, password);

    if (success) {
      res.json({
        success: true,
        message: '账户已删除'
      });
    } else {
      res.status(400).json({
        success: false,
        message: '密码不正确'
      });
    }
  } catch (error) {
    logger.error('删除账户失败:', error);
    res.status(500).json({
      success: false,
      message: '删除账户失败'
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  getUserDevices,
  searchUsers,
  getUsageStats,
  deleteAccount
};