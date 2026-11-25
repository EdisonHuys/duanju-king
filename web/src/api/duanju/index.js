import request from '@/utils/request';

/**
 * 《漫剧大导演》若依管理后台 API 模块 (RuoYi-Vue3 标准规范)
 * 将本文件放入您服务器上 RuoYi-Vue3 工程的 src/api/duanju/index.js 即可直接使用
 */

// 1. 获取运营数据看板与每集 A/B/C 选项点击率漏斗 (F-ADM-04)
export function getDashboardStats(scriptId) {
  return request({
    url: '/duanju/dashboard/stats',
    method: 'get',
    params: { scriptId }
  });
}

// 2. 查询剧本列表 (F-ADM-01)
export function listScripts(query) {
  return request({
    url: '/duanju/script/list',
    method: 'get',
    params: query
  });
}

// 3. 新增或修改剧本（含 6 集分镜与 4 大结局规则，保存后自动递增 version 热更）
export function saveScript(data) {
  return request({
    url: '/duanju/script/save',
    method: 'post',
    data
  });
}

// 4. 剧本上下架状态切换
export function changeScriptStatus(scriptId, status) {
  return request({
    url: '/duanju/script/status',
    method: 'put',
    data: { scriptId, status }
  });
}

// 5. 一键导入 SCRIPTS_DATABASE.json
export function importScriptJson(data) {
  return request({
    url: '/duanju/script/importJson',
    method: 'post',
    data
  });
}

// 6. 查询 28 图鉴列表 (F-ADM-02)
export function listCollections(query) {
  return request({
    url: '/duanju/collection/list',
    method: 'get',
    params: query
  });
}

// 7. 修改图鉴配置
export function updateCollection(data) {
  return request({
    url: '/duanju/collection',
    method: 'put',
    data
  });
}

// 8. 查询封神排行榜列表 (F-ADM-02)
export function listLeaderboard(query) {
  return request({
    url: '/duanju/leaderboard/list',
    method: 'get',
    params: query
  });
}

// 9. 排行榜风控操作 (remove下榜 / restore恢复 / resetName重置主演名 / banUser封禁)
export function moderateLeaderboard(data) {
  return request({
    url: '/duanju/leaderboard/moderate',
    method: 'post',
    data
  });
}

// 10. 查询玩家拍摄杀青流水日志
export function listShootRecords(query) {
  return request({
    url: '/duanju/record/list',
    method: 'get',
    params: query
  });
}

// 11. 获取与保存全局风控、敏感词、广告及微信提审开关 (F-ADM-03 & F-ADM-05)
export function getDuanjuConfig() {
  return request({
    url: '/duanju/config',
    method: 'get'
  });
}

export function updateDuanjuConfig(data) {
  return request({
    url: '/duanju/config',
    method: 'put',
    data
  });
}
