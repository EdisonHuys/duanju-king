-- ============================================================================
-- 漫剧大导演 - 用户登录系统与剧本集数进度档期表增量补丁
-- 模块名称：漫剧大导演 (ruoyi-duanju)
-- 功能说明：增加用户账号登录字段，增加用户剧本拍摄进度档期表 (dj_user_progress)
-- 作者：Antigravity
-- 日期：2026-11-20
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. 扩展玩家导演表 (dj_user)，支持多端账号登录与安全凭证
ALTER TABLE `dj_user` 
  ADD COLUMN `user_name` varchar(64) DEFAULT NULL COMMENT '登录账号' AFTER `wx_openid`,
  ADD COLUMN `password` varchar(128) DEFAULT NULL COMMENT '登录密码密文' AFTER `user_name`,
  ADD COLUMN `phone` varchar(32) DEFAULT '' COMMENT '绑定手机号' AFTER `password`,
  ADD COLUMN `last_login_time` datetime DEFAULT NULL COMMENT '最后登录时间' AFTER `shoot_count`,
  ADD COLUMN `last_login_ip` varchar(64) DEFAULT '' COMMENT '最后登录IP' AFTER `last_login_time`;

-- 2. 新建用户剧本拍摄进度档期表 (dj_user_progress)
CREATE TABLE IF NOT EXISTS `dj_user_progress` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` bigint(20) NOT NULL COMMENT '关联玩家用户ID',
  `wx_openid` varchar(128) NOT NULL COMMENT '微信OpenID或唯一用户标识',
  `script_id` varchar(64) NOT NULL COMMENT '剧本业务编码(如script_01_zhuixu)',
  `script_title` varchar(128) NOT NULL DEFAULT '' COMMENT '剧本标题',
  `current_episode` int(4) NOT NULL DEFAULT 1 COMMENT '当前拍摄集数(1-6)',
  `current_panel` int(4) NOT NULL DEFAULT 0 COMMENT '当前集分镜幕数(0-3)',
  `history_choices_json` longtext COMMENT '已完成各集选项轨迹与剧情流水JSON',
  `current_stats_json` varchar(500) DEFAULT '' COMMENT '当前五维数值JSON(爽点值/戏剧浓度/反派怒气/已备材料/拆套路)',
  `is_finished` char(1) NOT NULL DEFAULT '0' COMMENT '是否已杀青(0拍摄中 1已完播杀青)',
  `finish_score` decimal(5,2) DEFAULT NULL COMMENT '杀青评分(如已完结)',
  `finish_box_office` bigint(20) DEFAULT NULL COMMENT '杀青票房(如已完结)',
  `last_shoot_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近拍摄存档时间',
  `del_flag` char(1) NOT NULL DEFAULT '0' COMMENT '删除标志(0代表存在 2代表删除)',
  `create_by` varchar(64) DEFAULT 'user' COMMENT '创建者',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_by` varchar(64) DEFAULT '' COMMENT '更新者',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注说明',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_script` (`user_id`, `script_id`, `del_flag`),
  KEY `idx_openid_script` (`wx_openid`, `script_id`),
  KEY `idx_user_progress` (`user_id`, `is_finished`, `last_shoot_time` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='漫剧大导演-用户剧本拍摄进度档期表';

SET FOREIGN_KEY_CHECKS = 1;
