-- ============================================================================
-- 模块名称：《漫剧大导演》图片格式兼容升级补丁 SQL (v2.1)
-- 变更说明：将全库业务表中的 .webp 图片路径统一替换为 .jpg，以全面兼容 iOS/Android
--           微信小游戏原生图片解码器及全端浏览器展示，并递增 dj_script 版本号
-- 作者：Antigravity
-- 修改日期：2026-11-24
-- ============================================================================

-- 1. 更新剧本主表封面、分集分镜及结局图鉴 JSON 中的 .webp 为 .jpg
UPDATE `dj_script`
SET
  `cover_image` = REPLACE(`cover_image`, '.webp', '.jpg'),
  `episodes_json` = REPLACE(`episodes_json`, '.webp', '.jpg'),
  `endings_json` = REPLACE(`endings_json`, '.webp', '.jpg'),
  `version` = `version` + 1,
  `update_time` = NOW()
WHERE `cover_image` LIKE '%.webp%'
   OR `episodes_json` LIKE '%.webp%'
   OR `endings_json` LIKE '%.webp%';

-- 2. 更新玩家拍摄进度表历史选择 JSON 中的 .webp 为 .jpg
UPDATE `dj_user_progress`
SET
  `history_choices_json` = REPLACE(`history_choices_json`, '.webp', '.jpg'),
  `update_time` = NOW()
WHERE `history_choices_json` LIKE '%.webp%';

-- 3. 兜底清理图鉴表、分享表、系统配置表及用户/排行榜表中的 .webp 路径
UPDATE `dj_collection`
SET
  `icon_image` = REPLACE(`icon_image`, '.webp', '.jpg'),
  `update_time` = NOW()
WHERE `icon_image` LIKE '%.webp%';

UPDATE `dj_share_movie`
SET
  `history_choices_json` = REPLACE(`history_choices_json`, '.webp', '.jpg'),
  `update_time` = NOW()
WHERE `history_choices_json` LIKE '%.webp%';

UPDATE `dj_sys_config`
SET
  `config_value` = REPLACE(`config_value`, '.webp', '.jpg'),
  `update_time` = NOW()
WHERE `config_value` LIKE '%.webp%';

UPDATE `dj_leaderboard`
SET
  `avatar_url` = REPLACE(`avatar_url`, '.webp', '.jpg'),
  `update_time` = NOW()
WHERE `avatar_url` LIKE '%.webp%';

UPDATE `dj_user`
SET
  `avatar_url` = REPLACE(`avatar_url`, '.webp', '.jpg'),
  `update_time` = NOW()
WHERE `avatar_url` LIKE '%.webp%';
