-- ============================================================================
-- 模块名称：《漫剧大导演》清理测试流水与测试账号脚本
-- 变更说明：保留 9 部正式剧本、28 条图鉴定义与系统配置，清空所有测试玩家、
--           排行榜种子、拍摄流水、进度档期、云端解锁与分享记录，并将统计归零
-- 作者：Antigravity
-- 修改日期：2026-11-25
-- ============================================================================

-- 1. 清理废弃测试剧本，重置 9 部正式剧本的统计计数
DELETE FROM `dj_script` WHERE `script_id` = 'script_1795187780228_684' OR `del_flag` = '2';
UPDATE `dj_script` SET `play_count` = 0, `finish_count` = 0, `update_time` = NOW();

-- 2. 保留 28 条图鉴元数据配置，重置解锁次数统计
UPDATE `dj_collection` SET `unlock_count` = 0, `update_time` = NOW();

-- 3. 清空测试玩家与所有业务测试流水表
TRUNCATE TABLE `dj_user`;
TRUNCATE TABLE `dj_leaderboard`;
TRUNCATE TABLE `dj_shoot_record`;
TRUNCATE TABLE `dj_user_progress`;
TRUNCATE TABLE `dj_user_collection`;
TRUNCATE TABLE `dj_share_movie`;
