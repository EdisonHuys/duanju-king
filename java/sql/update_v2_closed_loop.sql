-- ============================================================================
-- 模块名称：《漫剧大导演》全链路闭环升级补丁 SQL (v2.0)
-- 变更说明：新增玩家云端图鉴表(dj_user_collection)、系统风控与广告配置表(dj_sys_config)、
--           好友分享成片与裂变追踪表(dj_share_movie)
-- 作者：Antigravity
-- 修改日期：2026-11-23
-- ============================================================================

CREATE TABLE IF NOT EXISTS `dj_user_collection` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` BIGINT NOT NULL COMMENT '导演用户ID',
  `wx_openid` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '微信OpenID',
  `script_id` VARCHAR(64) NOT NULL COMMENT '剧本编码',
  `ending_id` VARCHAR(64) NOT NULL COMMENT '结局图鉴编码',
  `ending_title` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '结局称号',
  `ending_type` VARCHAR(32) NOT NULL DEFAULT 'triumph' COMMENT '结局类型(hidden/subversive/unfinished/triumph)',
  `choices_json` TEXT COMMENT '首次达成时的1-6集选择记录JSON',
  `unlock_count` INT NOT NULL DEFAULT 1 COMMENT '累计达成次数',
  `first_unlock_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '首次解锁时间',
  `create_by` VARCHAR(64) DEFAULT 'system' COMMENT '创建者',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_by` VARCHAR(64) DEFAULT 'system' COMMENT '更新者',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `del_flag` CHAR(1) NOT NULL DEFAULT '0' COMMENT '删除标志(0代表存在 2代表删除)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_ending` (`user_id`, `ending_id`),
  KEY `idx_openid_script` (`wx_openid`, `script_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='漫剧大导演-玩家云端结局图鉴解锁表';

CREATE TABLE IF NOT EXISTS `dj_sys_config` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `config_key` VARCHAR(64) NOT NULL COMMENT '配置键名',
  `config_value` TEXT COMMENT '配置值(JSON或字符串)',
  `remark` VARCHAR(255) DEFAULT '' COMMENT '配置说明',
  `create_by` VARCHAR(64) DEFAULT 'admin' COMMENT '创建者',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_by` VARCHAR(64) DEFAULT 'admin' COMMENT '更新者',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `del_flag` CHAR(1) NOT NULL DEFAULT '0' COMMENT '删除标志(0代表存在 2代表删除)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='漫剧大导演-风控与提审广告配置表';

CREATE TABLE IF NOT EXISTS `dj_share_movie` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `share_code` VARCHAR(64) NOT NULL COMMENT '分享唯一口令码',
  `user_id` BIGINT NOT NULL DEFAULT 1002 COMMENT '分享导演用户ID',
  `wx_openid` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '分享导演OpenID',
  `nickname` VARCHAR(64) NOT NULL DEFAULT '新锐导演' COMMENT '分享导演昵称',
  `script_id` VARCHAR(64) NOT NULL COMMENT '剧本编码',
  `script_title` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '剧本名称',
  `ending_title` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '达成结局名称',
  `quality_score` DECIMAL(6,2) NOT NULL DEFAULT 88.50 COMMENT '杀青质量评分',
  `box_office` VARCHAR(64) NOT NULL DEFAULT '4.18 亿' COMMENT '首日播放量展示',
  `history_choices_json` LONGTEXT COMMENT '完整6集抉择与结果JSON',
  `view_count` INT NOT NULL DEFAULT 0 COMMENT '好友围观次数',
  `challenge_count` INT NOT NULL DEFAULT 0 COMMENT '好友点击开拍挑战次数',
  `create_by` VARCHAR(64) DEFAULT 'system' COMMENT '创建者',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_by` VARCHAR(64) DEFAULT 'system' COMMENT '更新者',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `del_flag` CHAR(1) NOT NULL DEFAULT '0' COMMENT '删除标志(0代表存在 2代表删除)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_share_code` (`share_code`),
  KEY `idx_share_user` (`user_id`, `create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='漫剧大导演-好友分享成片与裂变追踪表';
