SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `phone` varchar(20) NOT NULL,
  `password` varchar(255) NOT NULL,
  `nickname` varchar(50) DEFAULT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `membership_type` tinyint(4) DEFAULT '0',
  `membership_expire` datetime DEFAULT NULL,
  `invite_code` varchar(10) DEFAULT NULL,
  `inviter_id` bigint(20) DEFAULT NULL,
  `agent_id` bigint(20) DEFAULT NULL,
  `status` tinyint(4) DEFAULT '1',
  `last_login` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_phone` (`phone`),
  UNIQUE KEY `uk_invite_code` (`invite_code`),
  KEY `idx_inviter_id` (`inviter_id`),
  KEY `idx_agent_id` (`agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `devices` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) NOT NULL,
  `device_id` varchar(100) NOT NULL,
  `device_name` varchar(100) DEFAULT NULL,
  `device_model` varchar(100) DEFAULT NULL,
  `android_version` varchar(20) DEFAULT NULL,
  `app_version` varchar(20) DEFAULT NULL,
  `screen_width` int(11) DEFAULT NULL,
  `screen_height` int(11) DEFAULT NULL,
  `screen_density` float DEFAULT NULL,
  `sim_card` varchar(50) DEFAULT NULL,
  `imei` varchar(50) DEFAULT NULL,
  `location_lat` decimal(10,7) DEFAULT NULL,
  `location_lng` decimal(10,7) DEFAULT NULL,
  `location_address` varchar(255) DEFAULT NULL,
  `location_time` datetime DEFAULT NULL,
  `online_status` tinyint(4) DEFAULT '0',
  `last_online` datetime DEFAULT NULL,
  `permissions` text,
  `settings` text,
  `status` tinyint(4) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_id` (`device_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_online_status` (`online_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `device_controls` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `controller_id` bigint(20) NOT NULL,
  `target_device_id` bigint(20) NOT NULL,
  `control_type` tinyint(4) DEFAULT '1',
  `permissions` text,
  `expire_time` datetime DEFAULT NULL,
  `status` tinyint(4) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_controller_id` (`controller_id`),
  KEY `idx_target_device_id` (`target_device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `files` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) NOT NULL,
  `device_id` bigint(20) NOT NULL,
  `file_type` varchar(20) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size` bigint(20) DEFAULT NULL,
  `duration` int(11) DEFAULT NULL,
  `camera_type` tinyint(4) DEFAULT NULL,
  `metadata` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_file_type` (`file_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `location_records` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `device_id` bigint(20) NOT NULL,
  `latitude` decimal(10,7) NOT NULL,
  `longitude` decimal(10,7) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `accuracy` float DEFAULT NULL,
  `speed` float DEFAULT NULL,
  `bearing` float DEFAULT NULL,
  `altitude` float DEFAULT NULL,
  `provider` varchar(20) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `app_usage_records` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `device_id` bigint(20) NOT NULL,
  `package_name` varchar(100) NOT NULL,
  `app_name` varchar(100) DEFAULT NULL,
  `start_time` datetime NOT NULL,
  `end_time` datetime DEFAULT NULL,
  `duration` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_package_name` (`package_name`),
  KEY `idx_start_time` (`start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sensitive_apps` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `device_id` bigint(20) NOT NULL,
  `package_name` varchar(100) NOT NULL,
  `app_name` varchar(100) DEFAULT NULL,
  `alert_enabled` tinyint(4) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_package` (`device_id`,`package_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `call_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `device_id` bigint(20) NOT NULL,
  `phone_number` varchar(20) NOT NULL,
  `contact_name` varchar(100) DEFAULT NULL,
  `call_type` tinyint(4) NOT NULL,
  `call_time` datetime NOT NULL,
  `duration` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_call_time` (`call_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sms_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `device_id` bigint(20) NOT NULL,
  `phone_number` varchar(20) NOT NULL,
  `contact_name` varchar(100) DEFAULT NULL,
  `message_type` tinyint(4) NOT NULL,
  `content` text NOT NULL,
  `message_time` datetime NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_message_time` (`message_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `contacts` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `device_id` bigint(20) NOT NULL,
  `contact_id` varchar(50) NOT NULL,
  `display_name` varchar(100) DEFAULT NULL,
  `phone_numbers` text,
  `emails` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_contact` (`device_id`,`contact_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `membership_configs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `membership_type` tinyint(4) NOT NULL,
  `name` varchar(50) NOT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `duration_days` int(11) DEFAULT NULL,
  `features` text,
  `limits` text,
  `status` tinyint(4) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_membership_type` (`membership_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `agents` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) NOT NULL,
  `agent_code` varchar(20) NOT NULL,
  `agent_name` varchar(100) NOT NULL,
  `invite_link` varchar(255) DEFAULT NULL,
  `commission_rate` decimal(5,2) DEFAULT '10.00',
  `min_price` decimal(10,2) DEFAULT '0.00',
  `total_users` int(11) DEFAULT '0',
  `total_income` decimal(10,2) DEFAULT '0.00',
  `status` tinyint(4) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_agent_code` (`agent_code`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;