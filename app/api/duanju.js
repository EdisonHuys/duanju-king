import request from '@/utils/request';
import { getOpenId } from '@/utils/auth';
import localScriptsDb from '@/static/scripts/SCRIPTS_DATABASE.json';

const LOCAL_SENSITIVE_WORDS = ['管理员', '涉政', '赌博', '色情', '毒品', '代孕', '反动', '草泥马', '傻逼', '违规测试'];

/**
 * 1. 获取小程序初始化数据（含上架剧本、28图鉴、提审/广告配置、跑马灯）
 * 若处于离线飞行模式则自动无缝降级至本地 SCRIPTS_DATABASE.json (NFR-02)
 */
export async function fetchBootstrapData() {
  const openid = getOpenId();
  try {
    const res = await request({
      url: `/app-api/duanju/bootstrap?openid=${encodeURIComponent(openid)}`,
      method: 'GET',
      silentError: true
    });
    // 尝试补传之前离线时积压的杀青战绩队列
    flushPendingShootUploads();
    return res.data;
  } catch (e) {
    return {
      config: { auditMode: false, adEnabled: true, emergencyCleanName: false },
      scripts: localScriptsDb.scripts,
      collections: localScriptsDb.collections,
      userProfile: {
        openid,
        nickname: '天才短剧导演',
        customActorName: uni.getStorageSync('Duanju-Actor-Name') || '匿名主角',
        unlockedCards: uni.getStorageSync('Duanju-Unlocked-Cards') || []
      },
      marqueeList: [
        '[热播喜报] 恭喜导演 [横店王家卫] 拍出 98.85 分《赘婿龙王》，斩获 8.9 亿播放！',
        '[热播喜报] 恭喜导演 [广场舞王妈] 拍出 99.15 分《豪门当保姆》，达成【广场舞称霸】！'
      ]
    };
  }
}

/**
 * 2. 主演改名内容安全检测（本地敏感词 + 服务端微信 msgSecCheck 2.0）
 */
export async function checkActorNameApi(actorName) {
  const clean = (actorName || '').trim();
  if (!clean) {
    return { pass: false, reason: '主演名字不能为空哦~' };
  }
  const hitLocal = LOCAL_SENSITIVE_WORDS.find((w) => clean.toLowerCase().includes(w.toLowerCase()));
  if (hitLocal) {
    return { pass: false, reason: `导演，这名字含违规词「${hitLocal}」，过不了审哦~` };
  }

  try {
    const res = await request({
      url: '/app-api/duanju/checkName',
      method: 'POST',
      data: { openid: getOpenId(), actorName: clean },
      silentError: true
    });
    return { pass: true, cleanName: (res.data && res.data.cleanName) || clean };
  } catch (err) {
    if (err && err.code === 400) {
      return { pass: false, reason: err.msg || '导演，这名字过不了审哦~' };
    }
    // 离线模式下本地校验通过即可放行
    return { pass: true, cleanName: clean };
  }
}

/**
 * 3. 上报杀青战绩至云端排行榜（离线时自动入队 pendingUploads AC-MP-03.2）
 */
export async function submitShootRecordApi(payload) {
  const fullPayload = {
    openid: getOpenId(),
    nickname: uni.getStorageSync('Duanju-Director-Nick') || '新锐短剧导演',
    ...payload
  };
  try {
    const res = await request({
      url: '/app-api/duanju/shoot/submit',
      method: 'POST',
      data: fullPayload,
      silentError: true
    });
    return res.data;
  } catch (err) {
    if (err && err.offline) {
      const queue = uni.getStorageSync('Duanju-Pending-Uploads') || [];
      queue.push(fullPayload);
      uni.setStorageSync('Duanju-Pending-Uploads', queue.slice(-20));
    }
    return null;
  }
}

/**
 * 补传离线积压战绩
 */
export async function flushPendingShootUploads() {
  const queue = uni.getStorageSync('Duanju-Pending-Uploads') || [];
  if (!queue.length) return;
  const remaining = [];
  for (const item of queue) {
    try {
      await request({
        url: '/app-api/duanju/shoot/submit',
        method: 'POST',
        data: item,
        silentError: true
      });
    } catch (e) {
      if (e && e.offline) remaining.push(item);
    }
  }
  uni.setStorageSync('Duanju-Pending-Uploads', remaining);
}

/**
 * 4. 查询封神排行榜（单剧最高分榜 / 全服百亿导演总榜）
 */
export async function fetchLeaderboardApi(boardType = 'script', scriptId = 'script_01_zhuixu') {
  const openid = getOpenId();
  try {
    const res = await request({
      url: `/app-api/duanju/leaderboard?boardType=${boardType}&scriptId=${scriptId}&openid=${encodeURIComponent(openid)}`,
      method: 'GET',
      silentError: true
    });
    return res.data;
  } catch (e) {
    return {
      boardType,
      scriptId,
      list: [],
      myEntry: null
    };
  }
}

/**
 * 5. 导演登录系统 (微信一键/游客/账号密码登录)
 */
export async function loginDirectorApi(data) {
  return request({
    url: '/app-api/duanju/auth/login',
    method: 'POST',
    data,
    silentError: false
  });
}

/**
 * 6. 获取导演个人资料与数据总览
 */
export async function getDirectorInfoApi(params) {
  return request({
    url: '/app-api/duanju/auth/info',
    method: 'GET',
    params,
    silentError: true
  });
}

/**
 * 7. 获取当前导演所有剧本的拍摄进度档期列表
 */
export async function fetchUserProgressListApi(params) {
  return request({
    url: '/app-api/duanju/progress/list',
    method: 'GET',
    params,
    silentError: true
  });
}

/**
 * 8. 获取指定剧本当前拍摄进度存档
 */
export async function fetchUserProgressApi(params) {
  return request({
    url: '/app-api/duanju/progress/get',
    method: 'GET',
    params,
    silentError: true
  });
}

/**
 * 9. 保存当前拍摄进度存档点 (断点续拍)
 */
export async function saveUserProgressApi(data) {
  return request({
    url: '/app-api/duanju/progress/save',
    method: 'POST',
    data,
    silentError: true
  });
}

/**
 * 10. 重置剧本拍摄进度
 */
export async function resetUserProgressApi(data) {
  return request({
    url: '/app-api/duanju/progress/reset',
    method: 'POST',
    data,
    silentError: true
  });
}
