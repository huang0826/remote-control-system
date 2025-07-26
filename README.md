# 远程手机控制系统 - 我帮防盗

## 项目概述
这是一个完整的远程手机控制系统，实现手机间的远程控制功能。控制端和被控端使用同一个Android应用。

## 功能特性

### 核心控制功能
- 远程拍照 (前置/后置摄像头)
- 环境录音 (2/5/20分钟可选)
- 录像功能 (前置/后置，1/3/10分钟可选)
- 实况追踪 (语音/视频，20分钟自动关闭)
- 手机位置定位和足迹追踪
- 截屏/录屏/实时同屏
- 通话记录获取
- 短信记录获取
- 通讯录获取

### 监控功能
- 手机行为记录 (应用使用情况)
- 敏感应用提醒 (可选择5个应用特别监控)
- 区域防护 (地理围栏)
- SIM卡更换警报
- 设备异常移动警报

### 安全功能
- 设备锁定
- 远程数据擦除
- 应用隐藏
- 麦克风冲突处理
- 语音炸弹
- 手机呼叫
- 回拨电话
- 短信转发
- 销毁隐私

### 系统功能
- 用户注册登录 (手机号+密码)
- 多设备管理
- 权限检测和引导
- 会员系统 (免费/月/季/半年/年/永久)
- 代理推广系统
- 广告推送
- 自适应界面 (根据屏幕尺寸调整)

## 技术架构

### Android客户端
- **开发语言**: Java
- **最低版本**: Android 6.0 (API 23)
- **核心技术**: 
  - WebRTC (实时音视频)
  - Socket.IO (实时通信)
  - Retrofit (网络请求)
  - Room (本地数据库)
  - CameraX (相机功能)
  - MediaRecorder (录音录像)
  - LocationManager (定位)
  - AccessibilityService (无障碍服务)
  - DeviceAdminReceiver (设备管理)

### 后端服务器
- **开发语言**: Node.js + Express
- **数据库**: MySQL 8.0
- **缓存**: Redis 6.0
- **实时通信**: Socket.IO
- **文件存储**: 阿里云OSS
- **音视频处理**: FFmpeg

### 管理后台
- **前端框架**: Vue.js 3 + Element Plus
- **功能**: 用户管理、设备监控、会员配置、代理管理、广告推送

### 代理系统
- **独立后台**: 代理用户管理、收益统计、推广链接

## 部署环境

### 服务器配置
- **服务器**: 阿里云 ECS
- **IP地址**: 120.26.27.92
- **操作系统**: Ubuntu 20.04 LTS
- **默认密码**: Huang266134

### 所需软件
1. Node.js 16+
2. MySQL 8.0
3. Redis 6.0
4. Nginx
5. PM2 (进程管理)
6. SSL证书

## 项目结构
```
远程控制系统/
├── android/                 # Android应用源码
│   ├── app/
│   ├── build.gradle
│   └── ...
├── server/                  # 后端服务器
│   ├── src/
│   ├── package.json
│   └── ...
├── admin/                   # 管理后台
│   ├── src/
│   ├── package.json
│   └── ...
├── agent/                   # 代理后台
│   ├── src/
│   ├── package.json
│   └── ...
├── database/                # 数据库脚本
├── deploy/                  # 部署脚本
└── docs/                    # 文档
```

## 安装部署步骤

### 1. 服务器环境准备
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装MySQL
sudo apt install mysql-server -y

# 安装Redis
sudo apt install redis-server -y

# 安装Nginx
sudo apt install nginx -y

# 安装PM2
sudo npm install -g pm2
```

### 2. 数据库配置
```bash
# 登录MySQL
sudo mysql -u root -p

# 创建数据库和用户
CREATE DATABASE remote_control;
CREATE USER 'remote_user'@'localhost' IDENTIFIED BY 'Huang266134';
GRANT ALL PRIVILEGES ON remote_control.* TO 'remote_user'@'localhost';
FLUSH PRIVILEGES;
```

### 3. 项目部署
```bash
# 克隆项目
git clone <项目地址>
cd 远程控制系统

# 安装后端依赖
cd server
npm install

# 配置环境变量
cp .env.example .env
# 编辑.env文件，填入数据库配置

# 运行数据库迁移
npm run migrate

# 启动后端服务
pm2 start ecosystem.config.js

# 安装管理后台依赖
cd ../admin
npm install
npm run build

# 安装代理后台依赖
cd ../agent
npm install
npm run build
```

### 4. Nginx配置
```nginx
server {
    listen 80;
    server_name 120.26.27.92;
    
    # API代理
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 管理后台
    location /admin/ {
        alias /path/to/admin/dist/;
        try_files $uri $uri/ /admin/index.html;
    }
    
    # 代理后台
    location /agent/ {
        alias /path/to/agent/dist/;
        try_files $uri $uri/ /agent/index.html;
    }
}
```

## 开发说明

### Android应用开发要点
1. **权限管理**: 应用启动时检测所有必需权限，引导用户逐一授权
2. **无障碍服务**: 用于应用监控和控制功能
3. **设备管理器**: 实现设备锁定和数据擦除
4. **后台服务**: 保持长连接，接收远程控制指令
5. **界面适配**: 根据屏幕密度和尺寸自动调整UI

### 安全考虑
1. **数据加密**: 所有敏感数据传输使用AES加密
2. **权限验证**: 每个API调用都需要验证用户权限
3. **文件安全**: 生成的文件不在本地保存，直接上传服务器
4. **隐私保护**: 隐藏应用后不显示通知

### 会员系统
- **免费版**: 基础功能，有使用次数限制
- **月费版**: 解锁部分高级功能
- **季费版**: 更多功能和更高使用频率
- **半年版**: 几乎全部功能
- **年费版**: 全部功能无限制
- **永久版**: 终身使用全部功能

### 代理系统
- 代理可生成专属推广链接
- 用户注册时可填写4位邀请码
- 代理可查看下级用户数量和充值金额
- 代理可自定义价格(不低于最低价格)
- 代理后台独立，功能受限

## 注意事项

1. **法律合规**: 此系统仅供合法用途，如家长监护、企业设备管理等
2. **隐私保护**: 严格遵守相关隐私法规
3. **性能优化**: 实时功能20分钟自动关闭，防止设备过热
4. **用户体验**: 提供详细的使用教程和权限引导
5. **数据安全**: 所有数据加密传输和存储

## 联系信息
- 服务器IP: 120.26.27.92
- 默认密码: Huang266134
- 数据库: remote_control
- 用户名: remote_user