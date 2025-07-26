/**
 * Jest全局清理
 * 在所有测试结束后运行
 */

const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('\n🧹 开始清理测试环境...');
  
  try {
    // 清理测试文件
    const testDirs = [
      './tests/uploads',
      './tests/backups',
      './tests/logs',
      './tests/temp'
    ];
    
    for (const dir of testDirs) {
      const fullPath = path.resolve(dir);
      if (fs.existsSync(fullPath)) {
        // 递归删除目录内容但保留目录
        const files = fs.readdirSync(fullPath);
        for (const file of files) {
          const filePath = path.join(fullPath, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
        }
        console.log(`✓ 清理测试目录: ${dir}`);
      }
    }
    
    // 删除测试配置文件
    const testConfigPath = path.resolve('./tests/test.config.json');
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
      console.log('✓ 删除测试配置文件');
    }
    
    // 清理临时文件
    const tempFiles = [
      './tests/test-results.json',
      './tests/coverage-summary.json'
    ];
    
    for (const file of tempFiles) {
      const fullPath = path.resolve(file);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`✓ 删除临时文件: ${file}`);
      }
    }
    
    // 生成测试报告摘要
    const testSummary = {
      testEndTime: new Date().toISOString(),
      environment: 'test',
      cleanup: 'completed'
    };
    
    const summaryPath = path.resolve('./tests/test-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(testSummary, null, 2));
    console.log('✓ 生成测试摘要');
    
    console.log('✅ 测试环境清理完成\n');
    
  } catch (error) {
    console.error('❌ 测试环境清理失败:', error);
    // 不要因为清理失败而导致测试失败
  }
};