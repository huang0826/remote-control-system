const request = require('supertest');
const { app } = require('../app');

describe('设备管理系统 API 测试', () => {
  // 健康检查测试
  describe('GET /api/health', () => {
    it('应该返回健康状态', async () => {
      const res = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('status', 'healthy');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
    });
  });

  // API版本信息测试
  describe('GET /api', () => {
    it('应该返回API版本信息', async () => {
      const res = await request(app)
        .get('/api')
        .expect(200);
      
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('endpoints');
    });
  });

  // 根路径测试
  describe('GET /', () => {
    it('应该返回服务器信息', async () => {
      const res = await request(app)
        .get('/')
        .expect(200);
      
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('version');
    });
  });

  // 404错误测试
  describe('GET /nonexistent', () => {
    it('应该返回404错误', async () => {
      const res = await request(app)
        .get('/nonexistent')
        .expect(404);
      
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('message');
    });
  });

  // API文档测试
  describe('GET /api-docs.json', () => {
    it('应该返回Swagger规范', async () => {
      const res = await request(app)
        .get('/api-docs.json')
        .expect(200);
      
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('openapi');
      expect(res.body).toHaveProperty('info');
      expect(res.body).toHaveProperty('paths');
    });
  });

  // 认证相关测试
  describe('认证接口', () => {
    describe('POST /api/auth/login', () => {
      it('缺少参数时应该返回400错误', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({})
          .expect(400);
        
        expect(res.body).toHaveProperty('success', false);
      });

      it('用户名格式错误时应该返回400错误', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            username: '',
            password: 'password123'
          })
          .expect(400);
        
        expect(res.body).toHaveProperty('success', false);
      });
    });

    describe('POST /api/auth/register', () => {
      it('缺少参数时应该返回400错误', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({})
          .expect(400);
        
        expect(res.body).toHaveProperty('success', false);
      });
    });
  });

  // 用户管理测试
  describe('用户管理接口', () => {
    describe('GET /api/users/profile', () => {
      it('未认证时应该返回401错误', async () => {
        const res = await request(app)
          .get('/api/users/profile')
          .expect(401);
        
        expect(res.body).toHaveProperty('success', false);
      });
    });

    describe('GET /api/users', () => {
      it('未认证时应该返回401错误', async () => {
        const res = await request(app)
          .get('/api/users')
          .expect(401);
        
        expect(res.body).toHaveProperty('success', false);
      });
    });
  });

  // 设备管理测试
  describe('设备管理接口', () => {
    describe('GET /api/devices', () => {
      it('未认证时应该返回401错误', async () => {
        const res = await request(app)
          .get('/api/devices')
          .expect(401);
        
        expect(res.body).toHaveProperty('success', false);
      });
    });

    describe('POST /api/devices', () => {
      it('未认证时应该返回401错误', async () => {
        const res = await request(app)
          .post('/api/devices')
          .send({})
          .expect(401);
        
        expect(res.body).toHaveProperty('success', false);
      });
    });
  });

  // 系统管理测试
  describe('系统管理接口', () => {
    describe('GET /api/system/info', () => {
      it('未认证时应该返回401错误', async () => {
        const res = await request(app)
          .get('/api/system/info')
          .expect(401);
        
        expect(res.body).toHaveProperty('success', false);
      });
    });
  });

  // 错误处理测试
  describe('错误处理', () => {
    it('应该正确处理JSON解析错误', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
      
      expect(res.body).toHaveProperty('success', false);
    });
  });

  // 安全性测试
  describe('安全性', () => {
    it('应该设置安全头', async () => {
      const res = await request(app)
        .get('/')
        .expect(200);
      
      expect(res.headers).toHaveProperty('x-content-type-options');
      expect(res.headers).toHaveProperty('x-frame-options');
      expect(res.headers).toHaveProperty('x-xss-protection');
    });

    it('应该启用CORS', async () => {
      const res = await request(app)
        .options('/api/health')
        .expect(204);
      
      expect(res.headers).toHaveProperty('access-control-allow-origin');
      expect(res.headers).toHaveProperty('access-control-allow-methods');
    });
  });
});