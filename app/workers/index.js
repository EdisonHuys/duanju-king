// 微信小游戏 Worker 占位入口，消除开发者工具未配置 workers 目录导致的 worker path empty 报错
if (typeof worker !== 'undefined' && worker && typeof worker.onMessage === 'function') {
  worker.onMessage(function () {});
}
