/**
 * 数据库连接配置
 */

const mysql = require('mysql2/promise');
const config = require('../config');
const logger = require('../utils/logger');

// 创建连接池
const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  charset: config.database.charset,
  timezone: config.database.timezone,
  connectionLimit: config.database.connectionLimit || 10,
  connectTimeout: config.database.connectTimeout || 10000,
  multipleStatements: true,
  dateStrings: true
});

// 测试数据库连接
pool.getConnection()
  .then(connection => {
    console.info('数据库连接成功');
    connection.release();
  })
  .catch(err => {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  });

// 监听连接池事件
pool.on('connection', (connection) => {
  console.debug(`新建数据库连接: ${connection.threadId}`);
});

pool.on('error', (err) => {
  console.error('数据库连接池错误:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.info('重新连接数据库...');
  } else {
    throw err;
  }
});

/**
 * 执行SQL查询
 * @param {string} sql SQL语句
 * @param {Array} params 参数
 * @returns {Promise} 查询结果
 */
async function query(sql, params = []) {
  const start = Date.now();
  
  try {
    const [rows, fields] = await pool.execute(sql, params);
    
    const duration = Date.now() - start;
    if (config.debug.sql) {
      console.debug(`SQL执行时间: ${duration}ms, SQL: ${sql}, 参数: ${JSON.stringify(params)}`);
    }
    
    return rows;
  } catch (error) {
    console.error('SQL执行错误:', {
      sql,
      params,
      error: error.message
    });
    throw error;
  }
}

/**
 * 执行事务
 * @param {Function} callback 事务回调函数
 * @returns {Promise} 事务结果
 */
async function transaction(callback) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const result = await callback(connection);
    
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    console.error('事务执行失败:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 获取单条记录
 * @param {string} sql SQL语句
 * @param {Array} params 参数
 * @returns {Promise} 查询结果
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * 插入记录
 * @param {string} table 表名
 * @param {Object} data 数据对象
 * @returns {Promise} 插入结果
 */
async function insert(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  const result = await query(sql, values);
  
  return {
    insertId: result.insertId,
    affectedRows: result.affectedRows
  };
}

/**
 * 更新记录
 * @param {string} table 表名
 * @param {Object} data 数据对象
 * @param {Object} where 条件对象
 * @returns {Promise} 更新结果
 */
async function update(table, data, where) {
  const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
  const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
  
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
  const params = [...Object.values(data), ...Object.values(where)];
  
  const result = await query(sql, params);
  return {
    affectedRows: result.affectedRows,
    changedRows: result.changedRows
  };
}

/**
 * 删除记录
 * @param {string} table 表名
 * @param {Object} where 条件对象
 * @returns {Promise} 删除结果
 */
async function remove(table, where) {
  const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
  const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
  const params = Object.values(where);
  
  const result = await query(sql, params);
  return {
    affectedRows: result.affectedRows
  };
}

/**
 * 查询记录数量
 * @param {string} table 表名
 * @param {Object} where 条件对象
 * @returns {Promise} 记录数量
 */
async function count(table, where = {}) {
  let sql = `SELECT COUNT(*) as count FROM ${table}`;
  const params = [];
  
  if (Object.keys(where).length > 0) {
    const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
    sql += ` WHERE ${whereClause}`;
    params.push(...Object.values(where));
  }
  
  const result = await queryOne(sql, params);
  return result ? result.count : 0;
}

/**
 * 分页查询
 * @param {string} sql SQL语句
 * @param {Array} params 参数
 * @param {number} page 页码
 * @param {number} pageSize 每页大小
 * @returns {Promise} 分页结果
 */
async function paginate(sql, params = [], page = 1, pageSize = 10) {
  // 计算总记录数
  const countSql = sql.replace(/SELECT\s+[\s\S]+?FROM/i, 'SELECT COUNT(*) as count FROM');
  const countResult = await queryOne(countSql, params);
  const total = countResult.count;
  
  // 计算分页参数
  const offset = (page - 1) * pageSize;
  const limit = pageSize;
  
  // 执行分页查询
  const pageSql = `${sql} LIMIT ?, ?`;
  const pageParams = [...params, offset, limit];
  const rows = await query(pageSql, pageParams);
  
  return {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    rows
  };
}

module.exports = {
  pool,
  query,
  queryOne,
  transaction,
  insert,
  update,
  remove,
  count,
  paginate
};