-- ============================================================================
-- 漫剧大导演微信小程序 - 若依全量数据库初始化脚本
-- 模块名称：漫剧大导演 (ruoyi-duanju)
-- 规范标准：对齐《阿里巴巴 Java 开发手册》与若依规范
-- 1. 字符集统一 utf8mb4，InnoDB 引擎
-- 2. 严禁物理外键，统一使用逻辑外键
-- 3. 全量包含审计字段五件套：create_by, create_time, update_by, update_time, del_flag
-- 4. 表与所有字段具备完整中文 COMMENT 注释
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- 1. 剧本配置表 (dj_script)
-- ----------------------------
DROP TABLE IF EXISTS `dj_script`;
CREATE TABLE IF NOT EXISTS `dj_script` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `script_id` varchar(64) NOT NULL COMMENT '剧本唯一业务编码',
  `title` varchar(128) NOT NULL COMMENT '剧本主标题',
  `subtitle` varchar(255) DEFAULT '' COMMENT '剧本副标题',
  `tag` varchar(64) DEFAULT '爽文短剧' COMMENT '题材分类标签',
  `recommend` char(1) DEFAULT '0' COMMENT '是否推荐(1是 0否)',
  `difficulty` int(2) DEFAULT 1 COMMENT '难度星级(1-3)',
  `total_episodes` int(4) DEFAULT 6 COMMENT '总集数',
  `ending_count` int(4) DEFAULT 4 COMMENT '结局总数',
  `cover_theme` varchar(32) DEFAULT '#FF6B9E' COMMENT '波普主题色',
  `cover_image` varchar(255) DEFAULT '' COMMENT '剧本封面插画路径',
  `default_protagonist` varchar(64) DEFAULT '匿名主角' COMMENT '默认主角姓名',
  `synopsis` varchar(1000) DEFAULT '' COMMENT '首屏剧情梗概',
  `initial_stats_json` text COMMENT '初始四维属性JSON',
  `episodes_json` longtext COMMENT '分集分镜与选项配置JSON',
  `endings_json` longtext COMMENT '结局判定与评价规则JSON',
  `version` int(11) DEFAULT 1 COMMENT '剧本版本号(用于客户端增量热更)',
  `sort_order` int(4) DEFAULT 0 COMMENT '排序权重',
  `status` char(1) DEFAULT '0' COMMENT '上架状态(0正常 1下架)',
  `play_count` bigint(20) DEFAULT 0 COMMENT '累计开拍次数',
  `finish_count` bigint(20) DEFAULT 0 COMMENT '累计完播杀青次数',
  `del_flag` char(1) DEFAULT '0' COMMENT '删除标志(0代表存在 2代表删除)',
  `create_by` varchar(64) DEFAULT 'admin' COMMENT '创建者',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_by` varchar(64) DEFAULT '' COMMENT '更新者',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注说明',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_script_id` (`script_id`),
  KEY `idx_status_sort` (`del_flag`, `status`, `sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COMMENT='漫剧大导演-剧本配置表';

-- ----------------------------
-- 2. 28图鉴配置表 (dj_collection)
-- ----------------------------
DROP TABLE IF EXISTS `dj_collection`;
CREATE TABLE IF NOT EXISTS `dj_collection` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `card_id` varchar(64) NOT NULL COMMENT '图鉴唯一业务编码',
  `script_id` varchar(64) NOT NULL COMMENT '所属剧本业务编码',
  `type` varchar(32) NOT NULL DEFAULT 'ending' COMMENT '图鉴类型(ending结局图鉴 easter_egg名场面彩蛋)',
  `rarity` varchar(16) NOT NULL DEFAULT 'SR' COMMENT '稀有度(UR/SSR/SR/R)',
  `title` varchar(128) NOT NULL COMMENT '图鉴标题',
  `hint` varchar(500) DEFAULT '' COMMENT '未解锁线索提示',
  `icon_image` varchar(255) DEFAULT '' COMMENT '图鉴插画图片地址',
  `unlock_count` bigint(20) DEFAULT 0 COMMENT '全服累计解锁人数',
  `del_flag` char(1) DEFAULT '0' COMMENT '删除标志(0代表存在 2代表删除)',
  `create_by` varchar(64) DEFAULT 'admin' COMMENT '创建者',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_by` varchar(64) DEFAULT '' COMMENT '更新者',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注说明',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_card_id` (`card_id`),
  KEY `idx_script_del` (`script_id`, `del_flag`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COMMENT='漫剧大导演-图鉴配置表';

-- ----------------------------
-- 3. 玩家导演档案表 (dj_user)
-- ----------------------------
DROP TABLE IF EXISTS `dj_user`;
CREATE TABLE IF NOT EXISTS `dj_user` (
  `user_id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '玩家ID',
  `wx_openid` varchar(128) NOT NULL COMMENT '微信小程序OpenID',
  `user_name` varchar(64) DEFAULT NULL COMMENT '登录账号',
  `password` varchar(128) DEFAULT NULL COMMENT '登录密码密文',
  `phone` varchar(32) DEFAULT '' COMMENT '绑定手机号',
  `nickname` varchar(64) DEFAULT '新锐短剧导演' COMMENT '导演昵称',
  `avatar_url` varchar(500) DEFAULT '' COMMENT '头像地址',
  `custom_actor_name` varchar(64) DEFAULT '匿名主角' COMMENT '最近自定义主演名',
  `unlocked_cards_json` text COMMENT '已解锁图鉴编码数组JSON',
  `unlocked_count` int(4) DEFAULT 0 COMMENT '已解锁图鉴数量',
  `total_box_office` bigint(20) DEFAULT 0 COMMENT '各剧最高播放量累计总和',
  `best_score` decimal(5,2) DEFAULT 0.00 COMMENT '历史最高拍摄质量分',
  `shoot_count` int(11) DEFAULT 0 COMMENT '累计开拍局数',
  `last_login_time` datetime DEFAULT NULL COMMENT '最后登录时间',
  `last_login_ip` varchar(64) DEFAULT '' COMMENT '最后登录IP',
  `status` char(1) DEFAULT '0' COMMENT '账号状态(0正常 1封禁)',
  `del_flag` char(1) DEFAULT '0' COMMENT '删除标志(0代表存在 2代表删除)',
  `create_by` varchar(64) DEFAULT 'system' COMMENT '创建者',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_by` varchar(64) DEFAULT '' COMMENT '更新者',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注说明',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uk_wx_openid` (`wx_openid`),
  KEY `idx_box_office` (`del_flag`, `status`, `total_box_office` DESC)
) ENGINE=InnoDB AUTO_INCREMENT=1000 DEFAULT CHARSET=utf8mb4 COMMENT='漫剧大导演-玩家导演档案表';

-- ----------------------------
-- 4. 拍摄杀青流水日志表 (dj_shoot_record)
-- ----------------------------
DROP TABLE IF EXISTS `dj_shoot_record`;
CREATE TABLE IF NOT EXISTS `dj_shoot_record` (
  `record_id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '流水ID',
  `user_id` bigint(20) NOT NULL COMMENT '关联玩家ID',
  `wx_openid` varchar(128) NOT NULL COMMENT '玩家OpenID',
  `nickname` varchar(64) DEFAULT '' COMMENT '导演昵称',
  `script_id` varchar(64) NOT NULL COMMENT '剧本编码',
  `script_title` varchar(128) DEFAULT '' COMMENT '剧本标题',
  `actor_name` varchar(64) NOT NULL DEFAULT '匿名主角' COMMENT '领衔主演姓名',
  `choice_path` varchar(500) NOT NULL COMMENT '6集选项轨迹JSON',
  `final_stats_json` varchar(500) DEFAULT '' COMMENT '杀青四维属性JSON',
  `ending_id` varchar(64) NOT NULL COMMENT '达成结局编码',
  `ending_title` varchar(128) DEFAULT '' COMMENT '达成结局标题',
  `ending_badge` varchar(64) DEFAULT '' COMMENT '结局品质标签',
  `quality_score` decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT '拍摄质量评分',
  `box_office` bigint(20) NOT NULL DEFAULT 0 COMMENT '模拟首日播放量',
  `verify_status` char(1) DEFAULT '1' COMMENT '防作弊核验状态(1通过 0拦截)',
  `client_ip` varchar(64) DEFAULT '' COMMENT '客户端IP',
  `del_flag` char(1) DEFAULT '0' COMMENT '删除标志(0代表存在 2代表删除)',
  `create_by` varchar(64) DEFAULT 'client' COMMENT '创建者',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '杀青时间',
  `update_by` varchar(64) DEFAULT '' COMMENT '更新者',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注说明',
  PRIMARY KEY (`record_id`),
  KEY `idx_user_script` (`user_id`, `script_id`),
  KEY `idx_time_verify` (`create_time` DESC, `verify_status`)
) ENGINE=InnoDB AUTO_INCREMENT=10000 DEFAULT CHARSET=utf8mb4 COMMENT='漫剧大导演-拍摄杀青流水日志表';

-- ----------------------------
-- 5. 单剧最佳战绩排行榜表 (dj_leaderboard)
-- ----------------------------
DROP TABLE IF EXISTS `dj_leaderboard`;
CREATE TABLE IF NOT EXISTS `dj_leaderboard` (
  `rank_id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `script_id` varchar(64) NOT NULL COMMENT '剧本编码',
  `user_id` bigint(20) NOT NULL COMMENT '玩家ID',
  `wx_openid` varchar(128) NOT NULL COMMENT '玩家OpenID',
  `nickname` varchar(64) NOT NULL COMMENT '导演昵称',
  `avatar_url` varchar(500) DEFAULT '' COMMENT '导演头像',
  `actor_name` varchar(64) NOT NULL DEFAULT '匿名主角' COMMENT '领衔主演姓名',
  `ending_id` varchar(64) NOT NULL COMMENT '达成结局编码',
  `ending_title` varchar(128) NOT NULL COMMENT '达成结局标题',
  `ending_badge` varchar(64) DEFAULT 'SSR' COMMENT '结局品质标签',
  `quality_score` decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT '历史最高拍摄质量分',
  `box_office` bigint(20) NOT NULL DEFAULT 0 COMMENT '对应首日播放量',
  `choice_path` varchar(500) DEFAULT '' COMMENT '选项轨迹JSON',
  `status` char(1) DEFAULT '0' COMMENT '展示状态(0正常 1违规下榜)',
  `del_flag` char(1) DEFAULT '0' COMMENT '删除标志(0代表存在 2代表删除)',
  `create_by` varchar(64) DEFAULT 'system' COMMENT '创建者',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '首次上榜时间',
  `update_by` varchar(64) DEFAULT '' COMMENT '更新者',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '刷新纪录时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注说明',
  PRIMARY KEY (`rank_id`),
  UNIQUE KEY `uk_script_user` (`script_id`, `user_id`),
  KEY `idx_script_rank` (`script_id`, `del_flag`, `status`, `quality_score` DESC)
) ENGINE=InnoDB AUTO_INCREMENT=1000 DEFAULT CHARSET=utf8mb4 COMMENT='漫剧大导演-单剧最佳战绩排行榜';

-- ----------------------------
-- 6. 用户剧本拍摄进度档期表 (dj_user_progress)
-- ----------------------------
DROP TABLE IF EXISTS `dj_user_progress`;
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
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COMMENT='漫剧大导演-用户剧本拍摄进度档期表';

-- ----------------------------
-- 7. 后台系统管理员账号表 (dj_admin_user)
-- 索引说明：
--   uk_admin_username：用于后台登录与新增账号唯一性校验
--   idx_admin_status：用于后台用户列表按状态筛选
-- ----------------------------
DROP TABLE IF EXISTS `dj_admin_user`;
CREATE TABLE IF NOT EXISTS `dj_admin_user` (
  `user_id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '管理员ID',
  `user_name` varchar(64) NOT NULL COMMENT '登录账号',
  `password_hash` varchar(255) NOT NULL COMMENT '登录密码密文(scrypt加盐哈希)',
  `nick_name` varchar(64) NOT NULL DEFAULT '' COMMENT '用户昵称',
  `dept_name` varchar(64) NOT NULL DEFAULT '业务运营部' COMMENT '归属部门',
  `phonenumber` varchar(32) NOT NULL DEFAULT '' COMMENT '手机号码',
  `role_name` varchar(64) NOT NULL DEFAULT '短剧运营专员' COMMENT '分配角色',
  `status` char(1) NOT NULL DEFAULT '0' COMMENT '账号状态(0正常 1停用)',
  `last_login_time` datetime DEFAULT NULL COMMENT '最后登录时间',
  `del_flag` char(1) NOT NULL DEFAULT '0' COMMENT '删除标志(0代表存在 2代表删除)',
  `create_by` varchar(64) DEFAULT 'system' COMMENT '创建者',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_by` varchar(64) DEFAULT '' COMMENT '更新者',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注说明',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uk_admin_username` (`user_name`, `del_flag`),
  KEY `idx_admin_status` (`status`, `del_flag`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COMMENT='漫剧大导演-后台系统管理员账号表';

SET FOREIGN_KEY_CHECKS = 1;
