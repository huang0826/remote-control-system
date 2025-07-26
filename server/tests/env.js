/**
 * 测试环境变量配置
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.HOST = 'localhost';

// 数据库配置
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '3306';
process.env.DB_NAME = 'device_management_test';
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = 'password';
process.env.DB_DIALECT = 'mysql';
process.env.DB_LOGGING = 'false';

// Redis配置
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = '';
process.env.REDIS_DB = '15'; // 使用专门的测试数据库
process.env.REDIS_KEY_PREFIX = 'test_dms:';

// JWT配置
process.env.JWT_SECRET = 'test-super-secret-jwt-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_SECRET = 'test-super-secret-refresh-key-for-testing-only';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

// 加密配置
process.env.ENCRYPTION_KEY = 'test-32-character-encryption-key';
process.env.HASH_SALT_ROUNDS = '10'; // 降低以加快测试速度

// CORS配置
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.CORS_CREDENTIALS = 'true';

// 文件上传配置
process.env.UPLOAD_MAX_FILE_SIZE = '5242880'; // 5MB
process.env.UPLOAD_ALLOWED_TYPES = 'image/jpeg,image/png,image/gif';
process.env.UPLOAD_PATH = './tests/uploads';

// 邮件配置（测试用）
process.env.MAIL_HOST = 'smtp.ethereal.email';
process.env.MAIL_PORT = '587';
process.env.MAIL_SECURE = 'false';
process.env.MAIL_USER = 'test@ethereal.email';
process.env.MAIL_PASS = 'test-password';
process.env.MAIL_FROM_NAME = 'Test Device Management System';
process.env.MAIL_FROM_EMAIL = 'noreply@test.com';

// 短信配置（测试用）
process.env.SMS_PROVIDER = 'mock';
process.env.SMS_ACCESS_KEY_ID = 'test-access-key';
process.env.SMS_ACCESS_KEY_SECRET = 'test-access-secret';
process.env.SMS_SIGN_NAME = '测试系统';
process.env.SMS_TEMPLATE_CODE = 'TEST_123456';

// 支付配置（测试用）
process.env.ALIPAY_APP_ID = 'test-alipay-app-id';
process.env.ALIPAY_PRIVATE_KEY = 'test-alipay-private-key';
process.env.ALIPAY_PUBLIC_KEY = 'test-alipay-public-key';
process.env.ALIPAY_GATEWAY = 'https://openapi.alipaydev.com/gateway.do';
process.env.ALIPAY_NOTIFY_URL = 'http://localhost:3001/api/payment/alipay/notify';
process.env.ALIPAY_RETURN_URL = 'http://localhost:3001/payment/success';

process.env.WECHAT_APP_ID = 'test-wechat-app-id';
process.env.WECHAT_MCH_ID = 'test-wechat-mch-id';
process.env.WECHAT_API_KEY = 'test-wechat-api-key';
process.env.WECHAT_NOTIFY_URL = 'http://localhost:3001/api/payment/wechat/notify';

// 推送通知配置（测试用）
process.env.FIREBASE_PROJECT_ID = 'test-firebase-project';
process.env.FIREBASE_PRIVATE_KEY_ID = 'test-private-key-id';
process.env.FIREBASE_PRIVATE_KEY = 'test-private-key';
process.env.FIREBASE_CLIENT_EMAIL = 'test@test-firebase-project.iam.gserviceaccount.com';
process.env.FIREBASE_CLIENT_ID = 'test-client-id';

process.env.JPUSH_APP_KEY = 'test-jpush-app-key';
process.env.JPUSH_MASTER_SECRET = 'test-jpush-master-secret';

// 日志配置
process.env.LOG_LEVEL = 'error'; // 测试时只记录错误
process.env.LOG_MAX_SIZE = '10m';
process.env.LOG_MAX_FILES = '3d';
process.env.LOG_DATE_PATTERN = 'YYYY-MM-DD';

// 速率限制配置（测试时放宽）
process.env.RATE_LIMIT_WINDOW_MS = '60000'; // 1分钟
process.env.RATE_LIMIT_MAX = '1000'; // 更高的限制

// 会话配置
process.env.SESSION_SECRET = 'test-session-secret-key';
process.env.SESSION_MAX_AGE = '3600000'; // 1小时

// 地图服务配置（测试用）
process.env.MAP_API_KEY = 'test-map-api-key';
process.env.MAP_PROVIDER = 'mock';

// 云存储配置（测试用）
process.env.OSS_ACCESS_KEY_ID = 'test-oss-access-key';
process.env.OSS_ACCESS_KEY_SECRET = 'test-oss-secret';
process.env.OSS_BUCKET = 'test-bucket';
process.env.OSS_REGION = 'oss-cn-hangzhou';
process.env.OSS_ENDPOINT = 'https://oss-cn-hangzhou.aliyuncs.com';

// 监控配置
process.env.MONITOR_ENABLED = 'false';
process.env.MONITOR_INTERVAL = '60000';
process.env.MONITOR_ALERT_EMAIL = 'test@example.com';

// 备份配置
process.env.BACKUP_ENABLED = 'false';
process.env.BACKUP_INTERVAL = '0 2 * * *';
process.env.BACKUP_RETENTION_DAYS = '7';
process.env.BACKUP_PATH = './tests/backups';

// API文档配置
process.env.API_DOCS_ENABLED = 'true';
process.env.API_DOCS_PATH = '/api-docs';

// 安全配置
process.env.SECURITY_BCRYPT_ROUNDS = '10';
process.env.SECURITY_MAX_LOGIN_ATTEMPTS = '10'; // 测试时放宽
process.env.SECURITY_LOCKOUT_TIME = '60000'; // 1分钟
process.env.SECURITY_PASSWORD_MIN_LENGTH = '6'; // 测试时降低要求

// 缓存配置
process.env.CACHE_TTL = '300'; // 5分钟
process.env.CACHE_MAX_KEYS = '100';

// 队列配置
process.env.QUEUE_REDIS_URL = 'redis://localhost:6379/14';
process.env.QUEUE_CONCURRENCY = '2';

// 设备管理配置
process.env.DEVICE_MAX_PER_USER = '20'; // 测试时允许更多设备
process.env.DEVICE_OFFLINE_TIMEOUT = '30000'; // 30秒
process.env.DEVICE_HEARTBEAT_INTERVAL = '10000'; // 10秒

// 文件管理配置
process.env.FILE_CLEANUP_INTERVAL = '0 */6 * * *'; // 每6小时
process.env.FILE_MAX_AGE_DAYS = '1'; // 测试文件保留1天
process.env.FILE_COMPRESSION_ENABLED = 'false';

// 位置追踪配置
process.env.LOCATION_UPDATE_INTERVAL = '30000'; // 30秒
process.env.LOCATION_HISTORY_RETENTION_DAYS = '7'; // 7天
process.env.LOCATION_ACCURACY_THRESHOLD = '200'; // 200米

// 应用管理配置
process.env.APP_STORE_CACHE_TTL = '300'; // 5分钟
process.env.APP_UPDATE_CHECK_INTERVAL = '3600000'; // 1小时
process.env.APP_INSTALL_TIMEOUT = '60000'; // 1分钟

// 通知配置
process.env.NOTIFICATION_BATCH_SIZE = '10';
process.env.NOTIFICATION_RETRY_ATTEMPTS = '2';
process.env.NOTIFICATION_RETRY_DELAY = '1000'; // 1秒

// 系统配置
process.env.SYSTEM_MAINTENANCE_MODE = 'false';
process.env.SYSTEM_BACKUP_ENABLED = 'false';
process.env.SYSTEM_METRICS_ENABLED = 'false';
process.env.SYSTEM_HEALTH_CHECK_INTERVAL = '10000'; // 10秒

// 禁用某些功能以加快测试
process.env.DISABLE_RATE_LIMITING = 'true';
process.env.DISABLE_LOGGING = 'true';
process.env.DISABLE_MONITORING = 'true';
process.env.DISABLE_BACKUP = 'true';

console.log('✓ 测试环境变量已加载');