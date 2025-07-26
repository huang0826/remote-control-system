const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  charset: config.database.charset,
  timezone: config.database.timezone,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

const connectDB = async () => {
  try {
    const connection = await pool.getConnection();
    console.info('数据库连接成功');
    connection.release();
    return pool;
  } catch (error) {
    console.error('数据库连接失败:', error);
    throw error;
  }
};

module.exports = {
  pool,
  connectDB
};