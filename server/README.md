# 设备管理系统

一个功能完整的设备管理系统，支持远程控制、实时监控、文件管理、位置追踪等功能。

## 🚀 功能特性

### 核心功能
- 🔐 **用户认证与授权** - JWT认证、角色权限管理
- 📱 **设备管理** - 设备注册、状态监控、远程控制
- 🎮 **远程控制** - 屏幕截图、应用控制、系统操作
- 📁 **文件管理** - 文件上传下载、目录浏览、批量操作
- 📍 **位置追踪** - 实时定位、历史轨迹、地理围栏
- 📱 **应用管理** - 应用列表、安装卸载、权限控制

### 业务功能
- 💳 **会员系统** - 多级会员、权限控制、使用限制
- 🤝 **代理系统** - 代理申请、佣金管理、层级分销
- 💰 **支付系统** - 支付宝、微信支付、订单管理
- 🔔 **通知系统** - 实时通知、消息推送、邮件短信
- ⚙️ **系统管理** - 系统监控、日志管理、配置管理

### 技术特性
- 🔄 **实时通信** - Socket.IO双向通信
- 📊 **API文档** - Swagger自动生成文档
- 🐳 **容器化** - Docker + Docker Compose
- 🧪 **测试覆盖** - Jest单元测试
- 📈 **监控告警** - 系统监控、性能分析

## 🛠 技术栈

### 后端技术
- **运行时**: Node.js 18+
- **框架**: Express.js
- **数据库**: MySQL 8.0
- **缓存**: Redis 7.0
- **认证**: JWT + bcryptjs
- **实时通信**: Socket.IO
- **文档**: Swagger UI
- **测试**: Jest + Supertest

### 开发工具
- **进程管理**: PM2
- **容器化**: Docker + Docker Compose
- **代码质量**: ESLint + Prettier
- **版本控制**: Git

## 📋 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- MySQL >= 8.0
- Redis >= 6.0
- Docker >= 20.0 (可选)

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd device-management-system/server
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境

复制环境配置文件：
```bash
cp .env.example .env
```

编辑 `.env` 文件，配置数据库和Redis连接信息。

### 4. 数据库初始化

```bash
# 运行数据库迁移
npm run db:migrate

# 填充初始数据
npm run db:seed
```

### 5. 启动服务

```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

### 6. 访问服务

- **API服务**: http://localhost:3000
- **API文档**: http://localhost:3000/api-docs
- **健康检查**: http://localhost:3000/api/health

## 📁 项目结构

```
server/
├── src/
│   ├── config/          # 配置文件
│   │   ├── config.js    # 主配置
│   │   ├── database.js  # 数据库配置
│   │   ├── redis.js     # Redis配置
│   │   └── swagger.js   # API文档配置
│   ├── controllers/     # 控制器层
│   ├── middleware/      # 中间件
│   ├── models/          # 数据模型
│   ├── routes/          # 路由定义
│   ├── services/        # 业务服务层
│   └── utils/           # 工具函数
├── tests/               # 测试文件
├── logs/                # 日志文件
├── uploads/             # 上传文件
├── backups/             # 备份文件
├── app.js               # 应用主文件
├── server.js            # 服务器启动文件
├── package.json         # 项目配置
├── Dockerfile           # Docker配置
├── docker-compose.yml   # Docker Compose配置
└── ecosystem.config.js  # PM2配置
```

## 🔧 开发指南

### 可用脚本

```bash
# 开发
npm run dev              # 启动开发服务器
npm run test             # 运行测试
npm run test:watch       # 监听模式运行测试
npm run test:coverage    # 生成测试覆盖率报告

# 代码质量
npm run lint             # 代码检查
npm run lint:fix         # 自动修复代码问题
npm run format           # 代码格式化

# 数据库
npm run db:migrate       # 运行数据库迁移
npm run db:seed          # 填充测试数据
npm run db:reset         # 重置数据库

# 生产部署
npm run build            # 构建项目
npm run pm2:start        # PM2启动
npm run pm2:stop         # PM2停止
npm run pm2:restart      # PM2重启
```

### API接口

主要API端点：

- `/api/auth` - 认证相关
- `/api/users` - 用户管理
- `/api/devices` - 设备管理
- `/api/control` - 设备控制
- `/api/files` - 文件管理
- `/api/location` - 位置追踪
- `/api/apps` - 应用管理
- `/api/membership` - 会员管理
- `/api/agents` - 代理管理
- `/api/admin` - 管理员功能
- `/api/payment` - 支付管理
- `/api/notifications` - 通知管理
- `/api/system` - 系统管理

详细API文档请访问：http://localhost:3000/api-docs

## 🐳 Docker部署

### 使用Docker Compose（推荐）

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f app

# 停止服务
docker-compose down
```

### 单独构建Docker镜像

```bash
# 构建镜像
docker build -t device-management-system .

# 运行容器
docker run -d -p 3000:3000 --name dms-app device-management-system
```

## 🚀 生产部署

### PM2部署

```bash
# 安装PM2
npm install -g pm2

# 启动应用
npm run pm2:start

# 监控应用
pm2 monit

# 查看日志
pm2 logs device-management-system
```

### 环境配置

生产环境需要配置以下环境变量：

```bash
NODE_ENV=production
DB_HOST=your-mysql-host
DB_PASSWORD=your-mysql-password
REDIS_HOST=your-redis-host
JWT_SECRET=your-jwt-secret
# ... 其他配置
```

## 🧪 测试

### 运行测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

### 测试结构

```
tests/
├── app.test.js          # 应用主要功能测试
├── setup.js             # 测试环境设置
├── env.js               # 测试环境变量
├── globalSetup.js       # 全局测试设置
└── globalTeardown.js    # 全局测试清理
```

## 📊 监控和日志

### 日志管理

- 应用日志：`logs/app.log`
- 错误日志：`logs/error.log`
- 访问日志：`logs/access.log`

### 监控指标

- 系统健康状态：`/api/health`
- 系统信息：`/api/system/info`
- 性能指标：`/api/system/metrics`

## 🔒 安全性

### 安全特性

- JWT认证和授权
- 密码加密存储
- 请求速率限制
- CORS跨域保护
- XSS和CSRF防护
- SQL注入防护
- 文件上传安全检查

### 安全配置

```javascript
// 安全中间件配置
app.use(helmet());
app.use(cors(corsOptions));
app.use(rateLimit(rateLimitOptions));
```

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 📞 支持

如有问题或建议，请：

- 提交 [Issue](https://github.com/your-org/device-management-system/issues)
- 发送邮件至：support@devicemanagement.com
- 查看 [Wiki](https://github.com/your-org/device-management-system/wiki) 文档

---

**设备管理系统** - 让设备管理更简单、更智能！