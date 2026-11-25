-- ============================================================================
-- 漫剧大导演 - 后台系统管理员持久化表增量补丁 (v2.2)
-- 模块名称：漫剧大导演 - 后台权限认证 (ruoyi-duanju)
-- 变更说明：新增后台管理员账号表 dj_admin_user，支持多管理员持久化、密码加盐哈希存储与密码修改
-- 作者：Antigravity
-- 日期：2026-11-26
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- 后台系统管理员表 (dj_admin_user)
-- 索引说明：
--   uk_admin_username：用于后台登录与新增账号唯一性校验
--   idx_admin_status：用于后台用户列表按状态筛选
-- ----------------------------
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
