#!/usr/bin/env node

/**
 * Docker健康检查脚本
 */

const http = require('http');
const config = require('./src/config/config');

const options = {
  host: 'localhost',
  port: config.port || 3000,
  path: '/api/health',
  method: 'GET',
  timeout: 3000
};

const request = http.request(options, (res) => {
  console.log(`健康检查状态码: ${res.statusCode}`);
  
  if (res.statusCode === 200) {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.success) {
          console.log('✓ 健康检查通过');
          process.exit(0);
        } else {
          console.log('✗ 健康检查失败: 服务状态异常');
          process.exit(1);
        }
      } catch (error) {
        console.log('✗ 健康检查失败: 响应格式错误');
        process.exit(1);
      }
    });
  } else {
    console.log(`✗ 健康检查失败: HTTP ${res.statusCode}`);
    process.exit(1);
  }
});

request.on('error', (error) => {
  console.log(`✗ 健康检查失败: ${error.message}`);
  process.exit(1);
});

request.on('timeout', () => {
  console.log('✗ 健康检查失败: 请求超时');
  request.destroy();
  process.exit(1);
});

request.setTimeout(options.timeout);
request.end();

// 设置总体超时
setTimeout(() => {
  console.log('✗ 健康检查失败: 总体超时');
  process.exit(1);
}, 5000);