-- 杩滅▼鎺у埗绯荤粺鏁版嵁搴撹璁?-- 鍒涘缓鏃堕棿: 2025-01-17
-- 鏁版嵁搴? remote_control

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- 鐢ㄦ埛琛?-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '鐢ㄦ埛ID',
  `phone` varchar(20) NOT NULL COMMENT '鎵嬫満鍙?,
  `password` varchar(255) NOT NULL COMMENT '瀵嗙爜(鍔犲瘑)',
  `nickname` varchar(50) DEFAULT NULL COMMENT '鏄电О',
  `avatar` varchar(255) DEFAULT NULL COMMENT '澶村儚URL',
  `membership_type` tinyint(4) DEFAULT '0' COMMENT '浼氬憳绫诲瀷: 0鍏嶈垂 1鏈堣垂 2瀛ｈ垂 3鍗婂勾 4骞磋垂 5姘镐箙',
  `membership_expire` datetime DEFAULT NULL COMMENT '浼氬憳鍒版湡鏃堕棿',
  `invite_code` varchar(10) DEFAULT NULL COMMENT '閭€璇风爜',
  `inviter_id` bigint(20) DEFAULT NULL COMMENT '閭€璇蜂汉ID',
  `agent_id` bigint(20) DEFAULT NULL COMMENT '浠ｇ悊ID',
  `status` tinyint(4) DEFAULT '1' COMMENT '鐘舵€? 0绂佺敤 1姝ｅ父',
  `last_login` datetime DEFAULT NULL COMMENT '鏈€鍚庣櫥褰曟椂闂?,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '鏇存柊鏃堕棿',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_phone` (`phone`),
  UNIQUE KEY `uk_invite_code` (`invite_code`),
  KEY `idx_inviter_id` (`inviter_id`),
  KEY `idx_agent_id` (`agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='鐢ㄦ埛琛?;

-- ----------------------------
-- 璁惧琛?-- ----------------------------
DROP TABLE IF EXISTS `devices`;
CREATE TABLE `devices` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '璁惧ID',
  `user_id` bigint(20) NOT NULL COMMENT '鐢ㄦ埛ID',
  `device_id` varchar(100) NOT NULL COMMENT '璁惧鍞竴鏍囪瘑',
  `device_name` varchar(100) DEFAULT NULL COMMENT '璁惧鍚嶇О',
  `device_model` varchar(100) DEFAULT NULL COMMENT '璁惧鍨嬪彿',
  `android_version` varchar(20) DEFAULT NULL COMMENT 'Android鐗堟湰',
  `app_version` varchar(20) DEFAULT NULL COMMENT 'APP鐗堟湰',
  `screen_width` int(11) DEFAULT NULL COMMENT '灞忓箷瀹藉害',
  `screen_height` int(11) DEFAULT NULL COMMENT '灞忓箷楂樺害',
  `screen_density` float DEFAULT NULL COMMENT '灞忓箷瀵嗗害',
  `sim_card` varchar(50) DEFAULT NULL COMMENT 'SIM鍗″彿',
  `imei` varchar(50) DEFAULT NULL COMMENT 'IMEI鍙?,
  `location_lat` decimal(10,7) DEFAULT NULL COMMENT '绾害',
  `location_lng` decimal(10,7) DEFAULT NULL COMMENT '缁忓害',
  `location_address` varchar(255) DEFAULT NULL COMMENT '鍦板潃',
  `location_time` datetime DEFAULT NULL COMMENT '瀹氫綅鏃堕棿',
  `online_status` tinyint(4) DEFAULT '0' COMMENT '鍦ㄧ嚎鐘舵€? 0绂荤嚎 1鍦ㄧ嚎',
  `last_online` datetime DEFAULT NULL COMMENT '鏈€鍚庡湪绾挎椂闂?,
  `permissions` text COMMENT '鏉冮檺鍒楄〃(JSON)',
  `settings` text COMMENT '璁惧璁剧疆(JSON)',
  `status` tinyint(4) DEFAULT '1' COMMENT '鐘舵€? 0绂佺敤 1姝ｅ父',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '鏇存柊鏃堕棿',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_id` (`device_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_online_status` (`online_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='璁惧琛?;

-- ----------------------------
-- 璁惧鎺у埗鍏崇郴琛?-- ----------------------------
DROP TABLE IF EXISTS `device_controls`;
CREATE TABLE `device_controls` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `controller_id` bigint(20) NOT NULL COMMENT '鎺у埗鑰呯敤鎴稩D',
  `target_device_id` bigint(20) NOT NULL COMMENT '鐩爣璁惧ID',
  `control_type` tinyint(4) DEFAULT '1' COMMENT '鎺у埗绫诲瀷: 1涓存椂 2姘镐箙',
  `permissions` text COMMENT '鎺у埗鏉冮檺(JSON)',
  `expire_time` datetime DEFAULT NULL COMMENT '杩囨湡鏃堕棿',
  `status` tinyint(4) DEFAULT '1' COMMENT '鐘舵€? 0绂佺敤 1姝ｅ父',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '鏇存柊鏃堕棿',
  PRIMARY KEY (`id`),
  KEY `idx_controller_id` (`controller_id`),
  KEY `idx_target_device_id` (`target_device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='璁惧鎺у埗鍏崇郴琛?;

-- ----------------------------
-- 鏂囦欢璁板綍琛?-- ----------------------------
DROP TABLE IF EXISTS `files`;
CREATE TABLE `files` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '鏂囦欢ID',
  `user_id` bigint(20) NOT NULL COMMENT '鐢ㄦ埛ID',
  `device_id` bigint(20) NOT NULL COMMENT '璁惧ID',
  `file_type` varchar(20) NOT NULL COMMENT '鏂囦欢绫诲瀷: photo,audio,video,screen,call_log,sms,contacts',
  `file_name` varchar(255) NOT NULL COMMENT '鏂囦欢鍚?,
  `file_path` varchar(500) NOT NULL COMMENT '鏂囦欢璺緞',
  `file_size` bigint(20) DEFAULT NULL COMMENT '鏂囦欢澶у皬(瀛楄妭)',
  `duration` int(11) DEFAULT NULL COMMENT '鏃堕暱(绉?',
  `camera_type` tinyint(4) DEFAULT NULL COMMENT '鎽勫儚澶寸被鍨? 1鍓嶇疆 2鍚庣疆',
  `metadata` text COMMENT '鍏冩暟鎹?JSON)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_file_type` (`file_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='鏂囦欢璁板綍琛?;

-- ----------------------------
-- 浣嶇疆璁板綍琛?-- ----------------------------
DROP TABLE IF EXISTS `location_records`;
CREATE TABLE `location_records` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `device_id` bigint(20) NOT NULL COMMENT '璁惧ID',
  `latitude` decimal(10,7) NOT NULL COMMENT '绾害',
  `longitude` decimal(10,7) NOT NULL COMMENT '缁忓害',
  `address` varchar(255) DEFAULT NULL COMMENT '鍦板潃',
  `accuracy` float DEFAULT NULL COMMENT '绮惧害(绫?',
  `speed` float DEFAULT NULL COMMENT '閫熷害(m/s)',
  `bearing` float DEFAULT NULL COMMENT '鏂瑰悜瑙?,
  `altitude` float DEFAULT NULL COMMENT '娴锋嫈',
  `provider` varchar(20) DEFAULT NULL COMMENT '瀹氫綅鎻愪緵鑰?,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  PRIMARY KEY (`id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='浣嶇疆璁板綍琛?;

-- ----------------------------
-- 搴旂敤浣跨敤璁板綍琛?-- ----------------------------
DROP TABLE IF EXISTS `app_usage_records`;
CREATE TABLE `app_usage_records` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `device_id` bigint(20) NOT NULL COMMENT '璁惧ID',
  `package_name` varchar(100) NOT NULL COMMENT '鍖呭悕',
  `app_name` varchar(100) DEFAULT NULL COMMENT '搴旂敤鍚嶇О',
  `start_time` datetime NOT NULL COMMENT '寮€濮嬫椂闂?,
  `end_time` datetime DEFAULT NULL COMMENT '缁撴潫鏃堕棿',
  `duration` int(11) DEFAULT NULL COMMENT '浣跨敤鏃堕暱(绉?',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  PRIMARY KEY (`id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_package_name` (`package_name`),
  KEY `idx_start_time` (`start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='搴旂敤浣跨敤璁板綍琛?;

-- ----------------------------
-- 鏁忔劅搴旂敤閰嶇疆琛?-- ----------------------------
DROP TABLE IF EXISTS `sensitive_apps`;
CREATE TABLE `sensitive_apps` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `device_id` bigint(20) NOT NULL COMMENT '璁惧ID',
  `package_name` varchar(100) NOT NULL COMMENT '鍖呭悕',
  `app_name` varchar(100) DEFAULT NULL COMMENT '搴旂敤鍚嶇О',
  `alert_enabled` tinyint(4) DEFAULT '1' COMMENT '鏄惁鍚敤鎻愰啋',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '鏇存柊鏃堕棿',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_package` (`device_id`,`package_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='鏁忔劅搴旂敤閰嶇疆琛?;

-- ----------------------------
-- 閫氳瘽璁板綍琛?-- ----------------------------
DROP TABLE IF EXISTS `call_logs`;
CREATE TABLE `call_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `device_id` bigint(20) NOT NULL COMMENT '璁惧ID',
  `phone_number` varchar(20) NOT NULL COMMENT '鐢佃瘽鍙风爜',
  `contact_name` varchar(100) DEFAULT NULL COMMENT '鑱旂郴浜哄鍚?,
  `call_type` tinyint(4) NOT NULL COMMENT '閫氳瘽绫诲瀷: 1鍛煎叆 2鍛煎嚭 3鏈帴',
  `call_time` datetime NOT NULL COMMENT '閫氳瘽鏃堕棿',
  `duration` int(11) DEFAULT NULL COMMENT '閫氳瘽鏃堕暱(绉?',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  PRIMARY KEY (`id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_call_time` (`call_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='閫氳瘽璁板綍琛?;

-- ----------------------------
-- 鐭俊璁板綍琛?-- ----------------------------
DROP TABLE IF EXISTS `sms_logs`;
CREATE TABLE `sms_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `device_id` bigint(20) NOT NULL COMMENT '璁惧ID',
  `phone_number` varchar(20) NOT NULL COMMENT '鐢佃瘽鍙风爜',
  `contact_name` varchar(100) DEFAULT NULL COMMENT '鑱旂郴浜哄鍚?,
  `message_type` tinyint(4) NOT NULL COMMENT '娑堟伅绫诲瀷: 1鎺ユ敹 2鍙戦€?,
  `content` text NOT NULL COMMENT '鐭俊鍐呭',
  `message_time` datetime NOT NULL COMMENT '鐭俊鏃堕棿',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  PRIMARY KEY (`id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_message_time` (`message_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='鐭俊璁板綍琛?;

-- ----------------------------
-- 鑱旂郴浜鸿〃
-- ----------------------------
DROP TABLE IF EXISTS `contacts`;
CREATE TABLE `contacts` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `device_id` bigint(20) NOT NULL COMMENT '璁惧ID',
  `contact_id` varchar(50) NOT NULL COMMENT '鑱旂郴浜篒D',
  `display_name` varchar(100) DEFAULT NULL COMMENT '鏄剧ず鍚嶇О',
  `phone_numbers` text COMMENT '鐢佃瘽鍙风爜(JSON鏁扮粍)',
  `emails` text COMMENT '閭鍦板潃(JSON鏁扮粍)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '鏇存柊鏃堕棿',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_contact` (`device_id`,`contact_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='鑱旂郴浜鸿〃';

-- ----------------------------
-- 浼氬憳閰嶇疆琛?-- ----------------------------
DROP TABLE IF EXISTS `membership_configs`;
CREATE TABLE `membership_configs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `membership_type` tinyint(4) NOT NULL COMMENT '浼氬憳绫诲瀷: 0鍏嶈垂 1鏈堣垂 2瀛ｈ垂 3鍗婂勾 4骞磋垂 5姘镐箙',
  `name` varchar(50) NOT NULL COMMENT '浼氬憳鍚嶇О',
  `price` decimal(10,2) DEFAULT NULL COMMENT '浠锋牸',
  `duration_days` int(11) DEFAULT NULL COMMENT '鏈夋晥鏈?澶?',
  `features` text COMMENT '鍔熻兘鏉冮檺(JSON)',
  `limits` text COMMENT '浣跨敤闄愬埗(JSON)',
  `status` tinyint(4) DEFAULT '1' COMMENT '鐘舵€? 0绂佺敤 1鍚敤',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '鏇存柊鏃堕棿',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_membership_type` (`membership_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='浼氬憳閰嶇疆琛?;

-- ----------------------------
-- 浠ｇ悊琛?-- ----------------------------
DROP TABLE IF EXISTS `agents`;
CREATE TABLE `agents` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '浠ｇ悊ID',
  `user_id` bigint(20) NOT NULL COMMENT '鐢ㄦ埛ID',
  `agent_code` varchar(20) NOT NULL COMMENT '浠ｇ悊缂栫爜',
  `agent_name` varchar(100) NOT NULL COMMENT '浠ｇ悊鍚嶇О',
  `invite_link` varchar(255) DEFAULT NULL COMMENT '閭€璇烽摼鎺?,
  `commission_rate` decimal(5,2) DEFAULT '10.00' COMMENT '浣ｉ噾姣斾緥(%)',
  `min_price` decimal(10,2) DEFAULT '0.00' COMMENT '鏈€浣庝环鏍?,
  `total_users` int(11) DEFAULT '0' COMMENT '鎬荤敤鎴锋暟',
  `total_revenue` decimal(15,2) DEFAULT '0.00' COMMENT '鎬绘敹鐩?,
  `status` tinyint(4) DEFAULT '1' COMMENT '鐘舵€? 0绂佺敤 1姝ｅ父',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '鏇存柊鏃堕棿',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id` (`user_id`),
  UNIQUE KEY `uk_agent_code` (`agent_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='浠ｇ悊琛?;

-- ----------------------------
-- 璁㈠崟琛?-- ----------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '璁㈠崟ID',
  `order_no` varchar(32) NOT NULL COMMENT '璁㈠崟鍙?,
  `user_id` bigint(20) NOT NULL COMMENT '鐢ㄦ埛ID',
  `agent_id` bigint(20) DEFAULT NULL COMMENT '浠ｇ悊ID',
  `membership_type` tinyint(4) NOT NULL COMMENT '浼氬憳绫诲瀷',
  `amount` decimal(10,2) NOT NULL COMMENT '璁㈠崟閲戦',
  `commission` decimal(10,2) DEFAULT '0.00' COMMENT '浠ｇ悊浣ｉ噾',
  `payment_method` varchar(20) DEFAULT NULL COMMENT '鏀粯鏂瑰紡',
  `payment_status` tinyint(4) DEFAULT '0' COMMENT '鏀粯鐘舵€? 0寰呮敮浠?1宸叉敮浠?2宸插彇娑?,
  `paid_at` datetime DEFAULT NULL COMMENT '鏀粯鏃堕棿',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '鏇存柊鏃堕棿',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_agent_id` (`agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='璁㈠崟琛?;

-- ----------------------------
-- 骞垮憡琛?-- ----------------------------
DROP TABLE IF EXISTS `advertisements`;
CREATE TABLE `advertisements` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '骞垮憡ID',
  `title` varchar(100) NOT NULL COMMENT '骞垮憡鏍囬',
  `content` text COMMENT '骞垮憡鍐呭',
  `image_url` varchar(255) DEFAULT NULL COMMENT '鍥剧墖URL',
  `link_url` varchar(255) DEFAULT NULL COMMENT '閾炬帴URL',
  `target_type` tinyint(4) DEFAULT '0' COMMENT '鐩爣绫诲瀷: 0鍏ㄩ儴 1鎸囧畾浼氬憳绫诲瀷',
  `target_membership` varchar(20) DEFAULT NULL COMMENT '鐩爣浼氬憳绫诲瀷',
  `start_time` datetime DEFAULT NULL COMMENT '寮€濮嬫椂闂?,
  `end_time` datetime DEFAULT NULL COMMENT '缁撴潫鏃堕棿',
  `status` tinyint(4) DEFAULT '1' COMMENT '鐘舵€? 0绂佺敤 1鍚敤',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '鏇存柊鏃堕棿',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='骞垮憡琛?;

-- ----------------------------
-- 绯荤粺閰嶇疆琛?-- ----------------------------
DROP TABLE IF EXISTS `system_configs`;
CREATE TABLE `system_configs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `config_key` varchar(100) NOT NULL COMMENT '閰嶇疆閿?,
  `config_value` text COMMENT '閰嶇疆鍊?,
  `description` varchar(255) DEFAULT NULL COMMENT '鎻忚堪',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '鏇存柊鏃堕棿',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='绯荤粺閰嶇疆琛?;

-- ----------------------------
-- 鎿嶄綔鏃ュ織琛?-- ----------------------------
DROP TABLE IF EXISTS `operation_logs`;
CREATE TABLE `operation_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `user_id` bigint(20) DEFAULT NULL COMMENT '鐢ㄦ埛ID',
  `device_id` bigint(20) DEFAULT NULL COMMENT '璁惧ID',
  `operation_type` varchar(50) NOT NULL COMMENT '鎿嶄綔绫诲瀷',
  `operation_desc` varchar(255) DEFAULT NULL COMMENT '鎿嶄綔鎻忚堪',
  `request_data` text COMMENT '璇锋眰鏁版嵁',
  `response_data` text COMMENT '鍝嶅簲鏁版嵁',
  `ip_address` varchar(50) DEFAULT NULL COMMENT 'IP鍦板潃',
  `user_agent` varchar(500) DEFAULT NULL COMMENT '鐢ㄦ埛浠ｇ悊',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_operation_type` (`operation_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='鎿嶄綔鏃ュ織琛?;

-- ----------------------------
-- 鍒濆鍖栨暟鎹?-- ----------------------------

-- 鎻掑叆浼氬憳閰嶇疆
INSERT INTO `membership_configs` (`membership_type`, `name`, `price`, `duration_days`, `features`, `limits`) VALUES
(0, '鍏嶈垂鐗?, 0.00, NULL, '{"photo":true,"audio":false,"video":false,"location":true,"screen":false}', '{"photo":5,"location":10}'),
(1, '鏈堣垂鐗?, 29.90, 30, '{"photo":true,"audio":true,"video":false,"location":true,"screen":true}', '{"photo":100,"audio":50,"location":1000}'),
(2, '瀛ｈ垂鐗?, 79.90, 90, '{"photo":true,"audio":true,"video":true,"location":true,"screen":true}', '{"photo":500,"audio":200,"video":50,"location":5000}'),
(3, '鍗婂勾鐗?, 149.90, 180, '{"photo":true,"audio":true,"video":true,"location":true,"screen":true,"realtime":true}', '{"photo":1000,"audio":500,"video":200,"location":10000}'),
(4, '骞磋垂鐗?, 269.90, 365, '{"photo":true,"audio":true,"video":true,"location":true,"screen":true,"realtime":true,"advanced":true}', '{"photo":-1,"audio":-1,"video":-1,"location":-1}'),
(5, '姘镐箙鐗?, 999.90, NULL, '{"photo":true,"audio":true,"video":true,"location":true,"screen":true,"realtime":true,"advanced":true,"premium":true}', '{"photo":-1,"audio":-1,"video":-1,"location":-1}');

-- 鎻掑叆绯荤粺閰嶇疆
INSERT INTO `system_configs` (`config_key`, `config_value`, `description`) VALUES
('app_version', '1.0.0', '褰撳墠APP鐗堟湰'),
('min_app_version', '1.0.0', '鏈€浣庢敮鎸丄PP鐗堟湰'),
('server_url', 'http://120.26.27.92:3000', '鏈嶅姟鍣ㄥ湴鍧€'),
('file_upload_url', 'http://120.26.27.92:3000/upload', '鏂囦欢涓婁紶鍦板潃'),
('max_file_size', '104857600', '鏈€澶ф枃浠跺ぇ灏?100MB)'),
('location_interval', '3600', '榛樿瀹氫綅闂撮殧(绉?'),
('realtime_duration', '1200', '瀹炴椂鍔熻兘鏈€澶ф椂闀?绉?'),
('agent_min_commission', '5.00', '浠ｇ悊鏈€浣庝剑閲戞瘮渚?%)'),
('payment_methods', '["alipay","wechat","bank"]', '鏀粯鏂瑰紡');

SET FOREIGN_KEY_CHECKS = 1;
