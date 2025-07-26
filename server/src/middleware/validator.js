/**
 * 请求验证中间件
 */

const { validationResult } = require('express-validator');

/**
 * 验证请求参数
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '请求参数验证失败',
      errors: errors.array()
    });
  }
  next();
};

module.exports = {
  validateRequest
};