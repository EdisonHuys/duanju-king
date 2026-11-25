/**
 * 《漫剧大导演》若依 (RuoYi-Vue3 + RuoYi-App) 同构后端 API 服务 (Port 8080)
 * 严格遵循若依 AjaxResult ({ code: 200, msg, data }) 与 TableDataInfo ({ code: 200, msg, rows, total }) 规范
 * 同时提供：
 * 1. 若依后台管理端接口 (/dev-api/login, /dev-api/getInfo, /dev-api/getRouters, /dev-api/duanju/**)
 * 2. 若依小程序客户端接口 (/app-api/duanju/**)
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || 'change-me-in-production';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const WX_APPID = process.env.WX_APPID || '';
const WX_APP_SECRET = process.env.WX_APP_SECRET || '';
const SEED_PATH = path.resolve(__dirname, '../docs/SCRIPTS_DATABASE.json');
const DB_PATH = path.resolve(__dirname, './data/runtime_db.json');
const APP_ROOT = [path.resolve(__dirname, '../../app'), path.resolve(__dirname, '../ruoyi-app')].find((p) => fs.existsSync(p)) || path.resolve(__dirname, '../../app');

// 调用微信官方 code2Session 接口换取真实 openid（配置 WX_APP_SECRET 时启用）
function fetchWechatSession(code) {
  return new Promise((resolve) => {
    if (!code || !WX_APP_SECRET) return resolve(null);
    const reqUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(WX_APPID)}&secret=${encodeURIComponent(WX_APP_SECRET)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
    https.get(reqUrl, (resp) => {
      let raw = '';
      resp.on('data', (chunk) => { raw += chunk; });
      resp.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.openid) return resolve(parsed);
        } catch (e) {}
        resolve(null);
      });
    }).on('error', () => resolve(null));
  });
}

// 连接生产 MySQL 数据库（通过环境变量配置）
let pool = null;
try {
  const mysql = require('mysql2/promise');
  const mysqlHost = process.env.MYSQL_HOST || '127.0.0.1';
  const mysqlPort = Number(process.env.MYSQL_PORT) || 3306;
  const mysqlDatabase = process.env.MYSQL_DATABASE || 'ry_duanju';
  pool = mysql.createPool({
    host: mysqlHost,
    port: mysqlPort,
    user: process.env.MYSQL_USER || 'ry_duanju',
    password: process.env.MYSQL_PASSWORD || '',
    database: mysqlDatabase,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 5,
    idleTimeout: 30000,
    queueLimit: 0,
    connectTimeout: 15000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
  });
  pool.query('SELECT COUNT(*) as cnt FROM dj_script').then(([rows]) => {
    console.log(`[MySQL] 成功连接 MySQL 数据库 (${mysqlHost}:${mysqlPort}/${mysqlDatabase})，当前已载入剧本数: ${rows[0].cnt}`);
  }).catch((err) => {
    console.warn('[MySQL] 数据库连接提示:', err.message);
  });
} catch (e) {
  console.warn('[MySQL] 初始化连接池提示:', e.message);
}

// 确保 data 目录存在
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// 初始化或加载持久化数据库
function initDatabase() {
  if (fs.existsSync(DB_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    } catch (e) {
      console.error('读取 runtime_db.json 失败，重新初始化:', e);
    }
  }

  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));

  // 为每个剧本附加若依管理端字段（初始统计全部归零，不含任何测试假数据）
  const scripts = seed.scripts.map((s, idx) => {
    const choiceStats = {};
    s.episodes.forEach((ep) => {
      ep.choices.forEach((ch) => {
        const cid = ch.choiceId || ch.id;
        if (cid) choiceStats[cid] = 0;
      });
    });
    return {
      ...s,
      id: idx + 1,
      version: 1,
      sortOrder: idx + 1,
      status: '0', // 0=正常上架, 1=停用下架
      playCount: 0,
      finishCount: 0,
      choiceStats,
      updateTime: nowStr()
    };
  });

  const collections = seed.collections.map((c, idx) => ({
    ...c,
    id: idx + 1,
    unlockCount: 0,
    createTime: nowStr()
  }));

  const db = {
    config: {
      auditMode: false,          // 微信提审纯净模式开关 (F-ADM-05)
      adEnabled: true,           // 流量主激励视频广告开关 (F-ADM-05)
      emergencyCleanName: false, // 排行榜紧急净网开关：隐藏自定义主演名 (F-ADM-03)
      sensitiveWords: ['管理员', '习近平', '涉政', '赌博', '色情', '毒品', '代孕', '反动', '法轮', '草泥马', '傻逼', '尼玛', '违规测试']
    },
    scripts,
    collections,
    leaderboards: [],
    records: [],
    users: {},
    progress: []
  };

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  return db;
}

let db = initDatabase();
if (!Array.isArray(db.progress)) db.progress = [];
if (!Array.isArray(db.leaderboards)) db.leaderboards = [];
if (!Array.isArray(db.records)) db.records = [];
if (!db.users || typeof db.users !== 'object' || Array.isArray(db.users)) db.users = {};
if (!db.shareMovies || typeof db.shareMovies !== 'object' || Array.isArray(db.shareMovies)) db.shareMovies = {};

// 管理员密码加盐哈希与签名令牌工具
function hashAdminPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(plain), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyAdminPassword(plain, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  try {
    const expected = Buffer.from(parts[2], 'hex');
    const actual = crypto.scryptSync(String(plain), parts[1], 64);
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch (e) {
    return false;
  }
}

function getPwdVersion(passwordHash) {
  return crypto.createHash('sha256').update(String(passwordHash || '')).digest('hex').slice(0, 12);
}

function signAdminToken(adminRow) {
  const payload = {
    uid: Number(adminRow.userId),
    un: String(adminRow.userName),
    pv: getPwdVersion(adminRow.passwordHash),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${sig}`;
}

function verifyAdminTokenPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const encodedPayload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!encodedPayload || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(encodedPayload).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload || !payload.uid || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function buildDefaultAdminSeeds() {
  const defaultHash = hashAdminPassword(ADMIN_PASSWORD);
  return [
    { userId: 1, userName: ADMIN_USERNAME, passwordHash: defaultHash, nickName: '超级管理员', deptName: '研发中心', phonenumber: '15888888888', roleName: '超级管理员', status: '0', createTime: '2026-01-01 12:00:00' },
    { userId: 2, userName: 'duanju_ops', passwordHash: hashAdminPassword(ADMIN_PASSWORD), nickName: '短剧内容运营', deptName: '运营部', phonenumber: '13912345678', roleName: '短剧运营专员', status: '0', createTime: '2026-03-15 10:20:00' },
    { userId: 3, userName: 'auditor', passwordHash: hashAdminPassword(ADMIN_PASSWORD), nickName: '风控安全审核', deptName: '风控部', phonenumber: '13798765432', roleName: '风控安全员', status: '0', createTime: '2026-05-20 14:30:00' }
  ];
}

if (!Array.isArray(db.adminUsers) || db.adminUsers.length === 0) {
  db.adminUsers = buildDefaultAdminSeeds();
}

let adminTableReadyPromise = null;
async function ensureAdminUserTable() {
  if (!pool) return false;
  if (!adminTableReadyPromise) {
    adminTableReadyPromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS dj_admin_user (
          user_id bigint(20) NOT NULL AUTO_INCREMENT COMMENT '管理员ID',
          user_name varchar(64) NOT NULL COMMENT '登录账号',
          password_hash varchar(255) NOT NULL COMMENT '登录密码密文(scrypt加盐哈希)',
          nick_name varchar(64) NOT NULL DEFAULT '' COMMENT '用户昵称',
          dept_name varchar(64) NOT NULL DEFAULT '业务运营部' COMMENT '归属部门',
          phonenumber varchar(32) NOT NULL DEFAULT '' COMMENT '手机号码',
          role_name varchar(64) NOT NULL DEFAULT '短剧运营专员' COMMENT '分配角色',
          status char(1) NOT NULL DEFAULT '0' COMMENT '账号状态(0正常 1停用)',
          last_login_time datetime DEFAULT NULL COMMENT '最后登录时间',
          del_flag char(1) NOT NULL DEFAULT '0' COMMENT '删除标志(0代表存在 2代表删除)',
          create_by varchar(64) DEFAULT 'system' COMMENT '创建者',
          create_time datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          update_by varchar(64) DEFAULT '' COMMENT '更新者',
          update_time datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
          remark varchar(500) DEFAULT NULL COMMENT '备注说明',
          PRIMARY KEY (user_id),
          UNIQUE KEY uk_admin_username (user_name, del_flag),
          KEY idx_admin_status (status, del_flag)
        ) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COMMENT='漫剧大导演-后台系统管理员账号表'
      `);
      const [[cntRow]] = await pool.query("SELECT COUNT(*) AS cnt FROM dj_admin_user WHERE del_flag = '0'");
      if (!cntRow || Number(cntRow.cnt) === 0) {
        const seeds = buildDefaultAdminSeeds();
        for (const s of seeds) {
          await pool.execute(
            `INSERT INTO dj_admin_user (user_name, password_hash, nick_name, dept_name, phonenumber, role_name, status, create_by)
             VALUES (?, ?, ?, ?, ?, ?, '0', 'system')`,
            [s.userName, s.passwordHash, s.nickName, s.deptName, s.phonenumber, s.roleName]
          );
        }
      }
      return true;
    })().catch((err) => {
      adminTableReadyPromise = null;
      console.warn('[MySQL dj_admin_user init error]:', err.message);
      return false;
    });
  }
  return adminTableReadyPromise;
}

async function findAdminUserByUsername(userName) {
  const ready = await ensureAdminUserTable();
  if (ready && pool) {
    const [rows] = await pool.query(
      `SELECT user_id AS userId, user_name AS userName, password_hash AS passwordHash, nick_name AS nickName,
              dept_name AS deptName, phonenumber, role_name AS roleName, status,
              DATE_FORMAT(create_time, '%Y-%m-%d %H:%i:%s') AS createTime
       FROM dj_admin_user
       WHERE user_name = ? AND del_flag = '0'
       LIMIT 1`,
      [userName]
    );
    return rows && rows[0] ? rows[0] : null;
  }
  return db.adminUsers.find((u) => u.userName === userName) || null;
}

async function findAdminUserById(userId) {
  const ready = await ensureAdminUserTable();
  if (ready && pool) {
    const [rows] = await pool.query(
      `SELECT user_id AS userId, user_name AS userName, password_hash AS passwordHash, nick_name AS nickName,
              dept_name AS deptName, phonenumber, role_name AS roleName, status,
              DATE_FORMAT(create_time, '%Y-%m-%d %H:%i:%s') AS createTime
       FROM dj_admin_user
       WHERE user_id = ? AND del_flag = '0'
       LIMIT 1`,
      [Number(userId)]
    );
    return rows && rows[0] ? rows[0] : null;
  }
  return db.adminUsers.find((u) => Number(u.userId) === Number(userId)) || null;
}

function saveDb() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

function nowStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 统一解析当前游玩路线命中的剧本结局（与后台脑图推演完全一致）
 */
function resolveScriptEnding(script, chosenChoices, choicePath, stats) {
  const rawEndings = Array.isArray(script && script.endings) && script.endings.length ? script.endings : [
    { id: `${(script && script.scriptId) || 'script'}.end1`, title: '高能收官', type: 'triumph', priority: 70, condition: { always: true } }
  ];

  // 1. 优先匹配最终选择链中显式指定的 targetEndingId（从后往前以最后一次分支定调为准）
  if (Array.isArray(chosenChoices)) {
    for (let i = chosenChoices.length - 1; i >= 0; i--) {
      const ch = chosenChoices[i];
      if (ch && ch.targetEndingId) {
        const directMatch = rawEndings.find((e) => (e.id || e.endingId) === ch.targetEndingId);
        if (directMatch) return directMatch;
      }
    }
  }

  // 2. 按 priority 降序评估条件结局（跳过 always/default 兜底项）
  const sortedEndings = [...rawEndings].sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));
  for (const end of sortedEndings) {
    const cond = end.condition || {};
    if (cond.default || cond.always) continue;
    const hasStatRule = Boolean((cond.minStats && Object.keys(cond.minStats).length) || (cond.maxStats && Object.keys(cond.maxStats).length) || cond.minAbsurd || cond.minThrill || cond.specialChoice);
    const passSpecial = !cond.specialChoice || (Array.isArray(choicePath) && choicePath.includes(cond.specialChoice));
    const passFlags = (!Array.isArray(cond.allFlags) || cond.allFlags.length === 0 || hasStatRule) ? true : ((stats.evidence || 0) >= 3);
    const passAbsurd = !cond.minAbsurd || (stats.absurd || 0) >= cond.minAbsurd;
    const passThrill = !cond.minThrill || (stats.thrill || 0) >= cond.minThrill;
    const passMinStats = !cond.minStats || Object.entries(cond.minStats).every(([k, v]) => (stats[k] || 0) >= Number(v || 0));
    const passMaxStats = !cond.maxStats || Object.entries(cond.maxStats).every(([k, v]) => (stats[k] || 0) <= Number(v || 0));
    if (passSpecial && passFlags && passAbsurd && passThrill && passMinStats && passMaxStats) {
      return end;
    }
  }

  // 3. 回退保底结局
  return sortedEndings.find((e) => e.condition && (e.condition.always || e.condition.default))
    || rawEndings.find((e) => e.type === 'triumph')
    || sortedEndings[sortedEndings.length - 1];
}

/**
 * 服务端核心算分与防作弊校验算法 (AC-ADM-02 & AC-MP-03.1)
 */
function calculateAndVerifyShoot(script, choicePath, collectedEvidenceEps) {
  if (!Array.isArray(choicePath) || choicePath.length !== script.episodes.length) {
    throw new Error(`非法选项轨迹：集数不匹配（需满 ${script.episodes.length} 集）`);
  }

  const hasCollectedTrack = Array.isArray(collectedEvidenceEps);
  const collectedSet = hasCollectedTrack ? new Set(collectedEvidenceEps.map(Number)) : null;

  const stats = {
    thrill: 0,
    absurd: 0,
    persona: 0,
    budget: 0,
    pleasure: (script.initialStats && script.initialStats.pleasure) || 15,
    drama: (script.initialStats && script.initialStats.drama) || 25,
    anger: (script.initialStats && script.initialStats.anger) || 10,
    evidence: (script.initialStats && script.initialStats.evidence) || 0,
    subversion: (script.initialStats && script.initialStats.subversion) || 0,
    ...(script.initialStats || {})
  };
  let sumQualityBonus = 0;
  let highAbsurdCount = 0;
  let highThrillCount = 0;
  const newlyUnlockedEasterEggs = [];
  const chosenChoices = [];

  script.episodes.forEach((ep, idx) => {
    const pickedId = choicePath[idx];
    const choice = (ep.choices || []).find((c) => c.choiceId === pickedId || c.id === pickedId || c.label === pickedId);
    if (!choice) {
      throw new Error(`第 ${idx + 1} 集存在非法选项 ID: ${pickedId}（防作弊拦截）`);
    }
    chosenChoices.push(choice);
    const eff = choice.effects || {};
    stats.thrill += eff.thrill || eff.pleasure || 0;
    stats.absurd += eff.absurd || eff.drama || 0;
    stats.persona += eff.persona || eff.anger || 0;
    stats.budget += eff.budget || 0;
    stats.pleasure += eff.pleasure || 0;
    stats.drama += eff.drama || 0;
    stats.anger += eff.anger || 0;
    const epEvidence = Number(eff.evidence || 0);
    if (epEvidence > 0 && (!hasCollectedTrack || collectedSet.has(idx))) {
      stats.evidence += epEvidence;
    }
    stats.subversion += eff.subversion || 0;

    sumQualityBonus += choice.qualityBonus || 15;
    if ((eff.absurd || eff.drama || 0) >= 15) highAbsurdCount++;
    if ((eff.thrill || eff.pleasure || 0) >= 12) highThrillCount++;
    if (choice.unlockedCardId) {
      newlyUnlockedEasterEggs.push(choice.unlockedCardId);
    }
  });

  // 统一解析命中结局（支持 targetEndingId 显式直达 + 优先级降序条件判定）
  const matchedEnding = resolveScriptEnding(script, chosenChoices, choicePath, stats);
  const normalizedEnding = {
    ...matchedEnding,
    endingId: matchedEnding.endingId || matchedEnding.id || `${script.scriptId}_end1`,
    title: matchedEnding.title || '高能收官',
    badge: matchedEnding.badge || matchedEnding.type || '传奇结局'
  };

  // 风格连击加成与动态称号
  let styleComboBonus = 0;
  let styleBadge = '稳健叙事导演 (+0.0分)';
  if (highAbsurdCount >= 4) {
    styleComboBonus = 8.0;
    styleBadge = '离谱反套路大师 (+8.0分)';
  } else if (highThrillCount >= 4) {
    styleComboBonus = 6.5;
    styleBadge = '爽片正统大师 (+6.5分)';
  } else if (highAbsurdCount >= 3 || highThrillCount >= 3) {
    styleComboBonus = 3.5;
    styleBadge = '节奏掌控导演 (+3.5分)';
  }

  // 理论基础分计算 (映射至 78 ~ 99.5 区间，与小游戏端公式保持一致)
  const rawScore = 44 + (sumQualityBonus * 0.38) + styleComboBonus + (normalizedEnding.baseScoreBonus || 8) + Math.min(6, (stats.evidence || 0) * 1.2);
  const recommendedScore = Math.min(99.5, Number(rawScore.toFixed(2)));
  const maxAllowedScore = Math.min(99.95, Number((recommendedScore + 3.0).toFixed(2)));
  const minAllowedScore = Math.max(60.0, Number((recommendedScore - 3.0).toFixed(2)));

  let comment = `观众反馈：本剧以 ${recommendedScore.toFixed(2)} 分收官，「${normalizedEnding.title}」引发弹幕热议！`;
  if (recommendedScore >= 92) {
    comment = `爆款热评：「${recommendedScore.toFixed(2)} 分封神收官！【${normalizedEnding.title}】后劲太足了！」`;
  } else if (recommendedScore >= 82) {
    comment = `热评精选：「节奏在线，${normalizedEnding.title}这一幕直接看爽了！」`;
  }

  return {
    stats,
    matchedEnding: normalizedEnding,
    newlyUnlockedEasterEggs,
    styleComboBonus,
    styleBadge,
    comment,
    recommendedScore,
    maxAllowedScore,
    minAllowedScore
  };
}

/**
 * 主演名字内容安全检测（本地黑名单 + 模拟微信 security.msgSecCheck 2.0）
 */
function verifyActorName(actorName) {
  if (!actorName || !actorName.trim()) {
    return { pass: false, reason: '主演名字不能为空哦~' };
  }
  const clean = actorName.trim();
  if (clean.length > 8) {
    return { pass: false, reason: '主演名字最多不超过8个字~' };
  }
  const hit = db.config.sensitiveWords.find((w) => w && clean.toLowerCase().includes(w.toLowerCase()));
  if (hit) {
    return {
      pass: false,
      hitWord: hit,
      reason: `导演，主演名包含违规敏感词「${hit}」，微信 msgSecCheck 审核未通过！`
    };
  }
  return { pass: true, cleanName: clean };
}

// 解析 JSON 请求体
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
  });
}

function sendJson(res, payload, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, isToken'
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, { code: 200, msg: 'ok' });
  }

  const parsedUrl = url.parse(req.url, true);
  // 兼容 /dev-api, /prod-api, /app-api 前缀
  const rawPath = parsedUrl.pathname;

  // 静态图片/资源代理 (/static/**) —— 支持微信小游戏真机及后台兜底拉取
  if ((req.method === 'GET' || req.method === 'HEAD') && rawPath.startsWith('/static/')) {
    const appStaticRoot = APP_ROOT;
    const safeRelPath = path.normalize(rawPath).replace(/^(\.\.[\/\\])+/, '').replace(/^[\/\\]+/, '');
    const targetFile = path.resolve(appStaticRoot, safeRelPath);
    if (targetFile.startsWith(appStaticRoot + path.sep) && fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
      const ext = path.extname(targetFile).toLowerCase();
      const mimeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.mp3': 'audio/mpeg',
        '.json': 'application/json; charset=utf-8'
      };
      const stat = fs.statSync(targetFile);
      res.writeHead(200, {
        'Content-Type': mimeMap[ext] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        fs.createReadStream(targetFile).pipe(res);
      }
      return;
    }
  }

  const isAdminApi = rawPath.startsWith('/dev-api/') || rawPath.startsWith('/prod-api/');
  let pathname = rawPath.replace(/^\/(dev-api|prod-api|api)/, '');
  if (pathname.startsWith('/duanju/game/submit')) {
    pathname = '/app-api/duanju/shoot/submit';
  }
  const query = parsedUrl.query || {};

  // 管理端 /dev-api/** Token 鉴权中间件（登录与注销放行）
  let currentAdminUser = null;
  if (isAdminApi && pathname !== '/login' && pathname !== '/logout') {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const payload = verifyAdminTokenPayload(token);
    if (!payload) {
      return sendJson(res, { code: 401, msg: '认证失败，请先登录管理后台' }, 401);
    }
    const adminRow = await findAdminUserById(payload.uid);
    if (!adminRow || adminRow.status !== '0' || getPwdVersion(adminRow.passwordHash) !== payload.pv) {
      return sendJson(res, { code: 401, msg: '认证失败，请先登录管理后台' }, 401);
    }
    currentAdminUser = {
      userId: Number(adminRow.userId),
      userName: adminRow.userName,
      nickName: adminRow.nickName,
      deptName: adminRow.deptName,
      roleName: adminRow.roleName
    };
  }

  // =========================================================================
  // 一、 管理后台基础认证与菜单路由接口
  // =========================================================================
  if (pathname === '/login' && req.method === 'POST') {
    const body = await parseBody(req);
    const userName = String(body.userName || body.username || '').trim();
    const password = String(body.password || '');
    if (!userName || !password) {
      return sendJson(res, { code: 500, msg: '请输入账号和密码' });
    }
    const adminRow = await findAdminUserByUsername(userName);
    if (!adminRow || !verifyAdminPassword(password, adminRow.passwordHash)) {
      return sendJson(res, { code: 500, msg: '账号或密码错误' });
    }
    if (adminRow.status !== '0') {
      return sendJson(res, { code: 500, msg: '该账号已被停用，请联系超级管理员' });
    }
    const ready = await ensureAdminUserTable();
    if (ready && pool) {
      try {
        await pool.execute('UPDATE dj_admin_user SET last_login_time = NOW() WHERE user_id = ?', [adminRow.userId]);
      } catch (e) {}
    }
    const token = signAdminToken(adminRow);
    return sendJson(res, {
      code: 200,
      msg: '登录成功',
      token,
      user: {
        userId: Number(adminRow.userId),
        userName: adminRow.userName,
        nickName: adminRow.nickName,
        roleName: adminRow.roleName
      }
    });
  }

  if (pathname === '/logout' && req.method === 'POST') {
    return sendJson(res, { code: 200, msg: '退出成功' });
  }

  if (pathname === '/system/user/list' && req.method === 'GET') {
    const ready = await ensureAdminUserTable();
    let rows = [];
    if (ready && pool) {
      let sql = `SELECT user_id AS userId, user_name AS userName, nick_name AS nickName,
                        dept_name AS deptName, phonenumber, role_name AS roleName, status,
                        DATE_FORMAT(last_login_time, '%Y-%m-%d %H:%i:%s') AS lastLoginTime,
                        DATE_FORMAT(create_time, '%Y-%m-%d %H:%i:%s') AS createTime
                 FROM dj_admin_user
                 WHERE del_flag = '0'`;
      const params = [];
      if (query.userName) {
        sql += ' AND (user_name LIKE ? OR nick_name LIKE ?)';
        const kw = `%${String(query.userName).trim()}%`;
        params.push(kw, kw);
      }
      if (query.status) {
        sql += ' AND status = ?';
        params.push(String(query.status));
      }
      sql += ' ORDER BY user_id ASC';
      const [dbRows] = await pool.query(sql, params);
      rows = dbRows || [];
    } else {
      rows = db.adminUsers.map(({ passwordHash, ...rest }) => rest);
      if (query.userName) rows = rows.filter(u => u.userName.includes(query.userName) || u.nickName.includes(query.userName));
      if (query.status) rows = rows.filter(u => u.status === query.status);
    }
    return sendJson(res, { code: 200, msg: '查询成功', rows, total: rows.length });
  }

  if (pathname === '/system/user' && req.method === 'POST') {
    const body = await parseBody(req);
    const userName = String(body.userName || '').trim();
    const nickName = String(body.nickName || '').trim();
    const rawPassword = String(body.password || '');
    const deptName = String(body.deptName || '业务运营部').trim() || '业务运营部';
    const phonenumber = String(body.phonenumber || '').trim();
    const roleName = String(body.roleName || '短剧运营专员').trim() || '短剧运营专员';

    if (!/^[a-zA-Z0-9_]{3,32}$/.test(userName)) {
      return sendJson(res, { code: 500, msg: '登录账号需为3-32位字母、数字或下划线' });
    }
    if (!nickName) {
      return sendJson(res, { code: 500, msg: '用户昵称不能为空' });
    }
    if (rawPassword.length < 6 || rawPassword.length > 32) {
      return sendJson(res, { code: 500, msg: '登录密码长度需为6-32位' });
    }

    const existing = await findAdminUserByUsername(userName);
    if (existing) {
      return sendJson(res, { code: 500, msg: `账号 ${userName} 已存在，请勿重复创建` });
    }

    const passwordHash = hashAdminPassword(rawPassword);
    const ready = await ensureAdminUserTable();
    if (ready && pool) {
      await pool.execute(
        `INSERT INTO dj_admin_user (user_name, password_hash, nick_name, dept_name, phonenumber, role_name, status, create_by)
         VALUES (?, ?, ?, ?, ?, ?, '0', ?)`,
        [userName, passwordHash, nickName, deptName, phonenumber, roleName, currentAdminUser ? currentAdminUser.userName : 'admin']
      );
    } else {
      const maxId = db.adminUsers.reduce((m, u) => Math.max(m, Number(u.userId) || 0), 0);
      db.adminUsers.push({
        userId: maxId + 1,
        userName,
        passwordHash,
        nickName,
        deptName,
        phonenumber,
        roleName,
        status: '0',
        createTime: nowStr()
      });
      saveDb();
    }
    return sendJson(res, { code: 200, msg: '新增系统管理员成功' });
  }

  if (pathname === '/system/user/changeStatus' && req.method === 'PUT') {
    const body = await parseBody(req);
    const targetId = Number(body.userId);
    const nextStatus = String(body.status) === '1' ? '1' : '0';
    if (!targetId) {
      return sendJson(res, { code: 500, msg: '缺少目标用户ID' });
    }
    if (nextStatus === '1' && (targetId === 1 || (currentAdminUser && targetId === currentAdminUser.userId))) {
      return sendJson(res, { code: 500, msg: '不能停用超级管理员或当前登录账号' });
    }
    const ready = await ensureAdminUserTable();
    if (ready && pool) {
      await pool.execute(
        `UPDATE dj_admin_user SET status = ?, update_by = ?, update_time = NOW() WHERE user_id = ? AND del_flag = '0'`,
        [nextStatus, currentAdminUser ? currentAdminUser.userName : 'admin', targetId]
      );
    } else {
      const target = db.adminUsers.find(u => Number(u.userId) === targetId);
      if (target) {
        target.status = nextStatus;
        saveDb();
      }
    }
    return sendJson(res, { code: 200, msg: nextStatus === '0' ? '账号已启用' : '账号已停用' });
  }

  if (pathname === '/system/user/resetPwd' && req.method === 'PUT') {
    const body = await parseBody(req);
    const targetId = Number(body.userId);
    const newPassword = String(body.newPassword || '');
    if (!targetId) {
      return sendJson(res, { code: 500, msg: '缺少目标管理员ID' });
    }
    if (newPassword.length < 6 || newPassword.length > 32) {
      return sendJson(res, { code: 500, msg: '新密码长度需为6-32位' });
    }
    const target = await findAdminUserById(targetId);
    if (!target) {
      return sendJson(res, { code: 500, msg: '目标管理员不存在' });
    }
    const nextHash = hashAdminPassword(newPassword);
    const ready = await ensureAdminUserTable();
    if (ready && pool) {
      await pool.execute(
        `UPDATE dj_admin_user SET password_hash = ?, update_by = ?, update_time = NOW() WHERE user_id = ? AND del_flag = '0'`,
        [nextHash, currentAdminUser ? currentAdminUser.userName : 'admin', targetId]
      );
    } else {
      const memTarget = db.adminUsers.find(u => Number(u.userId) === targetId);
      if (memTarget) {
        memTarget.passwordHash = nextHash;
        saveDb();
      }
    }
    const needRelogin = Boolean(currentAdminUser && targetId === currentAdminUser.userId);
    return sendJson(res, {
      code: 200,
      msg: needRelogin ? '密码修改成功，请使用新密码重新登录' : '管理员密码修改成功',
      needRelogin
    });
  }

  if (pathname === '/system/user/profile/updatePwd' && req.method === 'PUT') {
    const body = await parseBody(req);
    const oldPassword = String(body.oldPassword || '');
    const newPassword = String(body.newPassword || '');
    if (!oldPassword || !newPassword) {
      return sendJson(res, { code: 500, msg: '请输入原密码和新密码' });
    }
    if (newPassword.length < 6 || newPassword.length > 32) {
      return sendJson(res, { code: 500, msg: '新密码长度需为6-32位' });
    }
    if (oldPassword === newPassword) {
      return sendJson(res, { code: 500, msg: '新密码不能与原密码相同' });
    }
    const adminRow = currentAdminUser ? await findAdminUserById(currentAdminUser.userId) : null;
    if (!adminRow || !verifyAdminPassword(oldPassword, adminRow.passwordHash)) {
      return sendJson(res, { code: 500, msg: '原密码不正确' });
    }
    const nextHash = hashAdminPassword(newPassword);
    const ready = await ensureAdminUserTable();
    if (ready && pool) {
      await pool.execute(
        `UPDATE dj_admin_user SET password_hash = ?, update_by = ?, update_time = NOW() WHERE user_id = ? AND del_flag = '0'`,
        [nextHash, adminRow.userName, adminRow.userId]
      );
    } else {
      const memTarget = db.adminUsers.find(u => Number(u.userId) === Number(adminRow.userId));
      if (memTarget) {
        memTarget.passwordHash = nextHash;
        saveDb();
      }
    }
    return sendJson(res, { code: 200, msg: '密码修改成功，请使用新密码重新登录', needRelogin: true });
  }

  // 漫剧大导演 - 玩家/导演用户管理接口（直连远程宝塔 MySQL dj_user 表）
  if (pathname === '/duanju/user/list' && req.method === 'GET') {
    if (pool) {
      try {
        const [rows] = await pool.query(
          'SELECT user_id as userId, wx_openid as openid, user_name as userName, nickname, avatar_url as avatarUrl, phone, custom_actor_name as customActorName, total_box_office as totalBoxOffice, best_score as bestScore, shoot_count as shootCount, last_login_time as lastLoginTime, status, create_time as createTime FROM dj_user WHERE del_flag = "0" ORDER BY user_id ASC'
        );
        if (rows && rows.length > 0) {
          let filtered = rows;
          if (query.nickname) {
            filtered = filtered.filter(u => (u.nickname && u.nickname.includes(query.nickname)) || (u.userName && u.userName.includes(query.nickname)));
          }
          if (query.status) {
            filtered = filtered.filter(u => u.status === query.status);
          }
          return sendJson(res, { code: 200, msg: '查询成功', rows: filtered, total: filtered.length });
        }
      } catch (e) {
        console.warn('[MySQL dj_user query error]:', e.message);
      }
    }
    const memUsers = Object.values(db.users).map((u, i) => ({
      userId: 1001 + i,
      userName: u.openid,
      openid: u.openid,
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      customActorName: u.customActorName || '匿名主角',
      totalBoxOffice: u.totalBoxOffice || 0,
      bestScore: u.bestScore || 0,
      shootCount: u.shootCount || 0,
      status: u.status || '0',
      createTime: '2026-11-20 10:00:00'
    }));
    return sendJson(res, { code: 200, msg: '查询成功', rows: memUsers, total: memUsers.length });
  }

  if (pathname === '/duanju/user/status' && req.method === 'PUT') {
    const body = await parseBody(req);
    if (pool) {
      try {
        await pool.execute('UPDATE dj_user SET status = ?, update_time = NOW() WHERE user_id = ?', [String(body.status), body.userId]);
      } catch (e) {
        console.warn('[MySQL update user status error]:', e.message);
      }
    }
    return sendJson(res, { code: 200, msg: body.status === '0' ? '账号已正常解封' : '账号已被冻结禁言' });
  }

  if (pathname === '/duanju/user/resetActor' && req.method === 'PUT') {
    const body = await parseBody(req);
    if (pool) {
      try {
        await pool.execute('UPDATE dj_user SET custom_actor_name = "默认主角", update_time = NOW() WHERE user_id = ?', [body.userId]);
      } catch (e) {
        console.warn('[MySQL reset custom actor error]:', e.message);
      }
    }
    return sendJson(res, { code: 200, msg: '违规主演名已重置为默认名' });
  }

  if (pathname === '/getInfo' && req.method === 'GET') {
    return sendJson(res, {
      code: 200,
      msg: '操作成功',
      user: {
        userId: currentAdminUser ? currentAdminUser.userId : 1,
        userName: currentAdminUser ? currentAdminUser.userName : ADMIN_USERNAME,
        nickName: currentAdminUser ? currentAdminUser.nickName : '超级管理员',
        roleName: currentAdminUser ? currentAdminUser.roleName : '超级管理员',
        avatar: ''
      },
      roles: [currentAdminUser && currentAdminUser.roleName === '超级管理员' ? 'admin' : 'operator'],
      permissions: ['*:*:*']
    });
  }

  if (pathname === '/getRouters' && req.method === 'GET') {
    return sendJson(res, {
      code: 200,
      msg: '操作成功',
      data: [
        {
          name: 'Duanju',
          path: '/duanju',
          hidden: false,
          redirect: 'noRedirect',
          component: 'Layout',
          alwaysShow: true,
          meta: { title: '漫剧大导演管理', icon: 'video-camera', noCache: false },
          children: [
            { name: 'Dashboard', path: 'dashboard', component: 'duanju/dashboard/index', meta: { title: '运营数据看板', icon: 'chart' } },
            { name: 'Script', path: 'script', component: 'duanju/script/index', meta: { title: '剧本可视化工厂', icon: 'documentation' } },
            { name: 'Collection', path: 'collection', component: 'duanju/collection/index', meta: { title: '28图鉴与彩蛋', icon: 'star' } },
            { name: 'Leaderboard', path: 'leaderboard', component: 'duanju/leaderboard/index', meta: { title: '封神排行榜风控', icon: 'peoples' } },
            { name: 'Record', path: 'record', component: 'duanju/record/index', meta: { title: '拍摄杀青流水', icon: 'list' } },
            { name: 'Config', path: 'config', component: 'duanju/config/index', meta: { title: '风控与提审配置', icon: 'lock' } }
          ]
        }
      ]
    });
  }

  // =========================================================================
  // 二、 若依管理后台业务接口 (/duanju/**)
  // =========================================================================

  // 1. 运营数据看板与选项点击率漏斗 (F-ADM-04)
  if (pathname === '/duanju/dashboard/stats' && req.method === 'GET') {
    const activeScripts = await getScriptsFromDbOrMemory();
    const targetScriptId = query.scriptId || (activeScripts[0] && activeScripts[0].scriptId) || db.scripts[0].scriptId;
    const targetScript = activeScripts.find((s) => s.scriptId === targetScriptId) || activeScripts[0] || db.scripts[0];

    const totalPlays = db.scripts.reduce((acc, s) => acc + (s.playCount || 0), 0);
    const totalFinishes = db.scripts.reduce((acc, s) => acc + (s.finishCount || 0), 0);
    const avgScore = db.leaderboards.length
      ? (db.leaderboards.reduce((acc, r) => acc + Number(r.qualityScore), 0) / db.leaderboards.length).toFixed(2)
      : '0.00';

    let mysqlUserCnt = 0;
    let mysqlRecordCnt = 0;
    let mysqlAvgScore = db.leaderboards.length ? Number(avgScore) : 0;
    let mysqlColUnlocked = db.collections.reduce((a, c) => a + (c.unlockCount || 0), 0);
    let mysqlShareCnt = 0;
    let mysqlChallengeCnt = 0;
    let mysqlCompletionRate = totalPlays > 0 ? Number(((totalFinishes / totalPlays) * 100).toFixed(1)) : 0;
    const choiceCountsMap = {};
    const endingCountsMap = {};
    let hasMysqlFunnelData = false;

    if (pool) {
      try {
        const [[uRow]] = await pool.query('SELECT COUNT(*) as cnt FROM dj_user WHERE del_flag = "0"');
        const [[rRow]] = await pool.query('SELECT COUNT(*) as cnt, AVG(quality_score) as avgScore FROM dj_shoot_record WHERE verify_status = "1"');
        const [[cRow]] = await pool.query('SELECT COUNT(*) as cnt FROM dj_user_collection WHERE del_flag = "0"');
        const [[sRow]] = await pool.query('SELECT COUNT(*) as cnt, IFNULL(SUM(challenge_count), 0) as chCnt FROM dj_share_movie WHERE del_flag = "0"');
        const [[pRow]] = await pool.query('SELECT COUNT(*) as totalProg, SUM(CASE WHEN is_finished = "1" THEN 1 ELSE 0 END) as doneProg FROM dj_user_progress WHERE del_flag = "0"');
        const [recRows] = await pool.query('SELECT choice_path, ending_id FROM dj_shoot_record WHERE script_id = ? AND verify_status = "1"', [targetScript.scriptId]);
        hasMysqlFunnelData = true;
        (recRows || []).forEach((rec) => {
          let pathArr = [];
          try {
            pathArr = Array.isArray(rec.choice_path) ? rec.choice_path : JSON.parse(rec.choice_path || '[]');
          } catch (e) {}
          if (Array.isArray(pathArr)) {
            pathArr.forEach((cid) => {
              if (cid) choiceCountsMap[cid] = (choiceCountsMap[cid] || 0) + 1;
            });
          }
          if (rec.ending_id) {
            endingCountsMap[rec.ending_id] = (endingCountsMap[rec.ending_id] || 0) + 1;
          }
        });
        mysqlUserCnt = Number(uRow.cnt || 0);
        mysqlRecordCnt = Number(rRow.cnt || 0);
        mysqlAvgScore = rRow.avgScore ? Number(Number(rRow.avgScore).toFixed(2)) : 0;
        mysqlColUnlocked = Number(cRow.cnt || 0);
        mysqlShareCnt = Number(sRow.cnt || 0);
        mysqlChallengeCnt = Number(sRow.chCnt || 0);
        const totalProg = Number((pRow && pRow.totalProg) || 0);
        const doneProg = Number((pRow && pRow.doneProg) || 0);
        if (totalProg > 0) {
          mysqlCompletionRate = Number(Math.min(100, (doneProg / totalProg) * 100).toFixed(1));
        } else if (mysqlRecordCnt > 0) {
          mysqlCompletionRate = 100.0;
        } else {
          mysqlCompletionRate = 0;
        }
      } catch (e) {
        console.warn('[MySQL Dashboard Stats Warn]:', e.message);
      }
    }

    // 构建该剧本 6 集 A/B/C 选项点击占比漏斗（优先使用 MySQL dj_shoot_record 实时聚合）
    const targetEpisodes = Array.isArray(targetScript.episodes) ? targetScript.episodes : [];
    const episodeFunnels = targetEpisodes.map((ep) => {
      const counts = (ep.choices || []).map((ch) => {
        const cid = ch.choiceId || ch.id;
        const cnt = hasMysqlFunnelData
          ? (choiceCountsMap[cid] || 0)
          : ((targetScript.choiceStats && targetScript.choiceStats[cid]) || 0);
        return {
          choiceId: cid,
          label: ch.label,
          styleTag: ch.styleTag || '',
          text: ch.text || ch.label,
          count: cnt
        };
      });
      const sum = counts.reduce((a, b) => a + b.count, 0);
      return {
        ep: ep.ep,
        title: ep.title,
        totalClicks: sum,
        choices: counts.map((c) => ({
          ...c,
          percent: sum > 0 ? Number(((c.count / sum) * 100).toFixed(1)) : 0
        }))
      };
    });

    // 构建 4 大结局达成分布
    const targetEndings = Array.isArray(targetScript.endings) ? targetScript.endings : [];
    const endingDist = targetEndings.map((end) => {
      const eid = end.endingId || end.id;
      const hitCount = hasMysqlFunnelData
        ? (endingCountsMap[eid] || 0)
        : db.records.filter((r) => r.scriptId === targetScript.scriptId && r.endingId === eid).length;
      return {
        endingId: eid,
        title: end.title,
        badge: end.badge || end.type || '',
        count: hitCount
      };
    });

    return sendJson(res, {
      code: 200,
      msg: '操作成功',
      data: {
        summary: {
          dau: pool ? mysqlUserCnt : Object.keys(db.users).length,
          totalPlays: pool ? mysqlRecordCnt : totalPlays,
          completionRate: pool ? mysqlCompletionRate : (totalPlays > 0 ? Number(((totalFinishes / totalPlays) * 100).toFixed(1)) : 0),
          avgQualityScore: mysqlAvgScore,
          shareRate: mysqlRecordCnt > 0 ? Number(Math.min(100, (mysqlShareCnt / mysqlRecordCnt) * 100).toFixed(1)) : 0,
          totalCollectionsUnlocked: mysqlColUnlocked,
          totalShares: mysqlShareCnt,
          totalChallenges: mysqlChallengeCnt
        },
        scriptTitle: targetScript.title,
        scriptId: targetScript.scriptId,
        episodeFunnels,
        endingDist
      }
    });
  }

  // 辅助函数：从宝塔 MySQL 或内存获取全部剧本
  async function getScriptsFromDbOrMemory() {
    if (pool) {
      try {
        const [rows] = await pool.query(`
          SELECT
            script_id as scriptId,
            title,
            subtitle,
            tag,
            recommend,
            difficulty,
            total_episodes as totalEpisodes,
            ending_count as endingCount,
            cover_theme as coverTheme,
            cover_image as coverImage,
            default_protagonist as defaultProtagonist,
            synopsis,
            initial_stats_json as initialStatsJson,
            episodes_json as episodesJson,
            endings_json as endingsJson,
            version,
            sort_order as sortOrder,
            status,
            play_count as playCount,
            finish_count as finishCount,
            update_time as updateTime
          FROM dj_script
          WHERE del_flag = '0'
          ORDER BY recommend DESC, sort_order ASC
        `);
        if (rows && rows.length > 0) {
          return rows.map((r) => {
            let episodes = [];
            let endings = [];
            let initialStats = {};
            try { episodes = JSON.parse(r.episodesJson || '[]'); } catch (e) {}
            try { endings = JSON.parse(r.endingsJson || '[]'); } catch (e) {}
            try { initialStats = JSON.parse(r.initialStatsJson || '{}'); } catch (e) {}
            return {
              ...r,
              recommend: r.recommend === '1' || r.recommend === 1,
              episodes,
              endings,
              initialStats
            };
          });
        }
      } catch (err) {
        console.warn('[MySQL Fetch Scripts Error]:', err.message);
      }
    }
    return db.scripts;
  }

  // 2. 剧本列表查询 (F-ADM-01)
  if (pathname === '/duanju/script/list' && req.method === 'GET') {
    let rows = await getScriptsFromDbOrMemory();
    if (query.title) {
      rows = rows.filter((s) => s.title && s.title.includes(query.title));
    }
    if (query.status !== undefined && query.status !== '') {
      rows = rows.filter((s) => String(s.status) === String(query.status));
    }
    return sendJson(res, {
      code: 200,
      msg: '查询成功',
      rows,
      total: rows.length
    });
  }

  // 3. 新增或保存剧本（含封面、配色、6集独白描述与分镜插画，版本号自动 +1）
  if (pathname === '/duanju/script/save' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body.title) {
      return sendJson(res, { code: 500, msg: '剧本标题不能为空' });
    }
    let scriptId = body.scriptId;
    const isNew = !scriptId || scriptId.startsWith('new_') || scriptId === 'new';
    if (isNew) {
      scriptId = `script_${Date.now()}_${Math.floor(Math.random() * 900 + 100)}`;
    }

    const coverImage = body.coverImage || '/static/art/covers/cover-dragon.jpg';
    const coverTheme = body.coverTheme || '#FFE600';
    const defaultProtagonist = body.defaultProtagonist || '新锐主演';
    const subtitle = body.subtitle || '';
    const tag = body.tag || '爆款短剧';
    const recommendFlag = (body.recommend === true || body.recommend === '1' || body.recommend === 1) ? '1' : '0';
    const synopsis = body.synopsis || '';
    const totalEpisodes = (body.episodes && body.episodes.length) || 6;
    const endingCount = (body.endings && body.endings.length) || 4;
    const episodesJson = typeof body.episodes === 'string' ? body.episodes : JSON.stringify(body.episodes || []);
    const endingsJson = typeof body.endings === 'string' ? body.endings : JSON.stringify(body.endings || []);

    if (pool) {
      try {
        const [existing] = await pool.query('SELECT id, version FROM dj_script WHERE script_id = ?', [scriptId]);
        if (existing.length > 0) {
          await pool.execute(
            `UPDATE dj_script SET
              title = ?, subtitle = ?, tag = ?, recommend = ?, cover_theme = ?, cover_image = ?,
              default_protagonist = ?, synopsis = ?, episodes_json = ?, endings_json = ?,
              total_episodes = ?, ending_count = ?, version = version + 1, update_time = NOW()
             WHERE script_id = ?`,
            [body.title, subtitle, tag, recommendFlag, coverTheme, coverImage, defaultProtagonist, synopsis, episodesJson, endingsJson, totalEpisodes, endingCount, scriptId]
          );
        } else {
          const [cntRows] = await pool.query('SELECT COUNT(*) as cnt FROM dj_script');
          const nextSort = (cntRows[0].cnt || 0) + 1;
          await pool.execute(
            `INSERT INTO dj_script (
              script_id, title, subtitle, tag, recommend, difficulty,
              total_episodes, ending_count, cover_theme, cover_image,
              default_protagonist, synopsis, episodes_json, endings_json,
              version, sort_order, status, play_count, finish_count, del_flag,
              create_by, create_time, update_by, update_time
            ) VALUES (
              ?, ?, ?, ?, ?, 1,
              ?, ?, ?, ?,
              ?, ?, ?, ?,
              1, ?, '0', 0, 0, '0',
              'admin', NOW(), 'admin', NOW()
            )`,
            [scriptId, body.title, subtitle, tag, recommendFlag, totalEpisodes, endingCount, coverTheme, coverImage, defaultProtagonist, synopsis, episodesJson, endingsJson, nextSort]
          );
        }
      } catch (err) {
        console.error('[MySQL Save Script Error]:', err);
        return sendJson(res, { code: 500, msg: `数据库保存失败: ${err.message}` });
      }
    }

    // 内存数据同步
    const memIdx = db.scripts.findIndex((s) => s.scriptId === scriptId);
    const updatedObj = {
      scriptId,
      title: body.title,
      subtitle,
      tag,
      recommend: recommendFlag === '1',
      coverTheme,
      coverImage,
      defaultProtagonist,
      synopsis,
      episodes: typeof body.episodes === 'string' ? JSON.parse(body.episodes) : (body.episodes || []),
      endings: typeof body.endings === 'string' ? JSON.parse(body.endings) : (body.endings || []),
      totalEpisodes,
      endingCount,
      status: '0',
      updateTime: nowStr()
    };
    if (memIdx >= 0) {
      db.scripts[memIdx] = {
        ...db.scripts[memIdx],
        ...updatedObj,
        version: (db.scripts[memIdx].version || 1) + 1
      };
    } else {
      db.scripts.push({
        id: db.scripts.length + 1,
        version: 1,
        sortOrder: db.scripts.length + 1,
        playCount: 0,
        finishCount: 0,
        ...updatedObj
      });
    }
    saveDb();

    return sendJson(res, {
      code: 200,
      msg: isNew ? '新剧本创建成功！已持久化至远程数据库！' : '剧本保存并发布成功，版本号已递增热更！',
      data: { scriptId }
    });
  }

  // 4.6 剧本逻辑删除（del_flag = '2'）
  if (pathname === '/duanju/script' && req.method === 'DELETE') {
    const scriptId = query.scriptId || (await parseBody(req)).scriptId;
    if (!scriptId) return sendJson(res, { code: 400, msg: '缺少 scriptId' });
    if (pool) {
      await pool.execute('UPDATE dj_script SET del_flag = "2", update_time = NOW() WHERE script_id = ?', [scriptId]).catch(() => {});
    }
    db.scripts = db.scripts.filter((s) => s.scriptId !== scriptId);
    saveDb();
    return sendJson(res, { code: 200, msg: '剧本已逻辑删除' });
  }

  // 4.5 剧本主推状态一键切换
  if (pathname === '/duanju/script/recommend' && req.method === 'PUT') {
    const body = await parseBody(req);
    const recVal = (body.recommend === true || body.recommend === '1' || body.recommend === 1) ? '1' : '0';
    if (pool) {
      try {
        await pool.execute('UPDATE dj_script SET recommend = ?, version = version + 1, update_time = NOW() WHERE script_id = ?', [recVal, body.scriptId]);
      } catch (e) {
        console.warn('[MySQL Update Script Recommend Error]:', e.message);
      }
    }
    const target = db.scripts.find((s) => s.scriptId === body.scriptId);
    if (target) {
      target.recommend = recVal === '1';
      target.version = (target.version || 1) + 1;
      target.updateTime = nowStr();
      saveDb();
    }
    return sendJson(res, { code: 200, msg: recVal === '1' ? '已设为首页主推剧本' : '已取消主推状态' });
  }

  // 4. 剧本上下架切换
  if (pathname === '/duanju/script/status' && req.method === 'PUT') {
    const body = await parseBody(req);
    const statusVal = String(body.status);
    if (pool) {
      try {
        await pool.execute('UPDATE dj_script SET status = ?, version = version + 1, update_time = NOW() WHERE script_id = ?', [statusVal, body.scriptId]);
      } catch (e) {
        console.warn('[MySQL Update Script Status Error]:', e.message);
      }
    }
    const target = db.scripts.find((s) => s.scriptId === body.scriptId);
    if (target) {
      target.status = statusVal;
      target.version = (target.version || 1) + 1;
      target.updateTime = nowStr();
      saveDb();
    }
    return sendJson(res, { code: 200, msg: statusVal === '0' ? '剧本已上架' : '剧本已下架' });
  }

  // 5. 一键导入 SCRIPTS_DATABASE.json
  if (pathname === '/duanju/script/importJson' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!Array.isArray(body.scripts)) {
      return sendJson(res, { code: 400, msg: 'JSON 格式错误：缺少 scripts 数组' });
    }
    body.scripts.forEach((incoming) => {
      const existingIdx = db.scripts.findIndex((s) => s.scriptId === incoming.scriptId);
      if (existingIdx >= 0) {
        db.scripts[existingIdx] = {
          ...db.scripts[existingIdx],
          ...incoming,
          version: (db.scripts[existingIdx].version || 1) + 1,
          updateTime: nowStr()
        };
      } else {
        db.scripts.push({
          ...incoming,
          id: db.scripts.length + 1,
          version: 1,
          status: '0',
          playCount: 100,
          finishCount: 95,
          updateTime: nowStr()
        });
      }
    });
    if (Array.isArray(body.collections)) {
      body.collections.forEach((col) => {
        const cIdx = db.collections.findIndex((c) => c.cardId === col.cardId);
        if (cIdx >= 0) {
          db.collections[cIdx] = { ...db.collections[cIdx], ...col };
        } else {
          db.collections.push({ ...col, id: db.collections.length + 1, unlockCount: 0 });
        }
      });
    }
    saveDb();
    return sendJson(res, { code: 200, msg: `成功导入/更新 ${body.scripts.length} 部剧本！` });
  }

  // 5.5 通用图片上传接口（支持管理端上传封面、分镜、图鉴插画并持久化到本地静态资源目录）
  if (pathname === '/duanju/upload' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body.base64) {
      return sendJson(res, { code: 400, msg: '缺少图片 base64 数据' });
    }
    try {
      const uploadDir = path.resolve(APP_ROOT, 'static/art/uploads');
      fs.mkdirSync(uploadDir, { recursive: true });
      const match = String(body.base64).match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      const ext = match ? match[1].replace('jpeg', 'jpg') : 'png';
      const rawData = match ? match[2] : body.base64;
      const safeBase = (body.fileName || 'img').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'img';
      const filename = `${safeBase}_${Date.now()}.${ext}`;
      fs.writeFileSync(path.join(uploadDir, filename), Buffer.from(rawData, 'base64'));
      return sendJson(res, {
        code: 200,
        msg: '图片上传成功',
        url: `/static/art/uploads/${filename}`
      });
    } catch (err) {
      return sendJson(res, { code: 500, msg: '图片保存失败: ' + err.message });
    }
  }

  // 6. 全量图鉴管理列表与编辑/新增（直连 MySQL dj_script.endings_json）
  const DEFAULT_ENDING_HINTS = {
    hidden: '留意第二集的小物件，别忘第五集的准备。',
    subversive: '多拆几次套路，看看这部剧还能不能按原样演。',
    unfinished: '排场拉满、材料留空，收官会发生什么？',
    triumph: '照着自己的节奏好好演完，就能看到。'
  };

  function resolveDefaultEndingArt(endingId, coverImage) {
    if (endingId) {
      const fileName = `ending-${String(endingId).replace('.', '_')}.jpg`;
      const absPath = path.resolve(APP_ROOT, 'static/art/endings', fileName);
      if (fs.existsSync(absPath)) {
        return `/static/art/endings/${fileName}`;
      }
    }
    return coverImage || '/static/art/covers/cover-dragon.jpg';
  }

  if (pathname === '/duanju/collection/list' && req.method === 'GET') {
    const scripts = await getScriptsFromDbOrMemory();
    const scriptTabs = scripts.map((s) => ({
      scriptId: s.scriptId,
      title: s.title,
      count: Array.isArray(s.endings) ? s.endings.length : 0
    }));
    let rows = [];
    scripts.forEach((s) => {
      const endings = Array.isArray(s.endings) ? s.endings : [];
      endings.forEach((e) => {
        const typeKey = e.type || 'triumph';
        rows.push({
          cardId: e.id,
          scriptId: s.scriptId,
          scriptTitle: s.title,
          coverImage: s.coverImage || '/static/art/covers/cover-dragon.jpg',
          endingType: typeKey,
          title: e.title || '未命名结局',
          text: e.text || e.description || '',
          hint: e.hint || DEFAULT_ENDING_HINTS[typeKey] || '完成对应路线即可解锁',
          imageUrl: e.imageUrl || resolveDefaultEndingArt(e.id, s.coverImage),
          unlockCount: e.unlockCount || 0
        });
      });
    });
    if (query.scriptId) rows = rows.filter((c) => c.scriptId === query.scriptId);
    if (query.endingType) rows = rows.filter((c) => c.endingType === query.endingType);
    return sendJson(res, { code: 200, msg: '查询成功', rows, total: rows.length, scripts: scriptTabs });
  }

  if (pathname === '/duanju/collection' && (req.method === 'PUT' || req.method === 'POST')) {
    const body = await parseBody(req);
    if (!body.scriptId) {
      return sendJson(res, { code: 400, msg: '缺少所属剧本编码 scriptId' });
    }
    let endings = [];
    if (pool) {
      try {
        const [sRows] = await pool.query('SELECT endings_json as endingsJson FROM dj_script WHERE script_id = ? AND del_flag = "0"', [body.scriptId]);
        if (!sRows || sRows.length === 0) {
          return sendJson(res, { code: 404, msg: '所属剧本不存在' });
        }
        try { endings = JSON.parse(sRows[0].endingsJson || '[]'); } catch (e) { endings = []; }
        if (!Array.isArray(endings)) endings = [];

        if (req.method === 'PUT') {
          const idx = endings.findIndex((e) => e.id === body.cardId);
          if (idx < 0) return sendJson(res, { code: 404, msg: '图鉴记录不存在' });
          endings[idx] = {
            ...endings[idx],
            title: body.title !== undefined ? body.title : endings[idx].title,
            type: body.endingType || endings[idx].type || 'triumph',
            text: body.text !== undefined ? body.text : (endings[idx].text || endings[idx].description || ''),
            hint: body.hint !== undefined ? body.hint : endings[idx].hint,
            imageUrl: body.imageUrl !== undefined ? body.imageUrl : endings[idx].imageUrl
          };
        } else {
          const newCardId = (body.cardId || '').trim() || `${body.scriptId.split('_').pop()}.end${endings.length + 1}`;
          endings.push({
            id: newCardId,
            type: body.endingType || 'triumph',
            title: body.title || '新解锁结局',
            text: body.text || '本局高能收官，全网观众起立鼓掌！',
            hint: body.hint || DEFAULT_ENDING_HINTS[body.endingType || 'triumph'],
            imageUrl: body.imageUrl || ''
          });
        }

        await pool.execute(
          'UPDATE dj_script SET endings_json = ?, version = version + 1, update_time = NOW() WHERE script_id = ?',
          [JSON.stringify(endings), body.scriptId]
        );
      } catch (err) {
        console.warn('[MySQL Update Collection Error]:', err.message);
        return sendJson(res, { code: 500, msg: '数据库保存图鉴失败: ' + err.message });
      }
    }

    const memTarget = db.scripts.find((s) => s.scriptId === body.scriptId);
    if (memTarget) {
      if (pool && endings.length > 0) {
        memTarget.endings = endings;
      } else {
        memTarget.endings = memTarget.endings || [];
        const idx = memTarget.endings.findIndex((e) => e.id === body.cardId);
        if (idx >= 0) {
          memTarget.endings[idx] = { ...memTarget.endings[idx], title: body.title, type: body.endingType, text: body.text, hint: body.hint, imageUrl: body.imageUrl };
        } else if (req.method === 'POST') {
          memTarget.endings.push({ id: body.cardId || `end_${Date.now()}`, type: body.endingType || 'triumph', title: body.title, text: body.text, hint: body.hint, imageUrl: body.imageUrl });
        }
      }
      saveDb();
    }
    return sendJson(res, { code: 200, msg: req.method === 'POST' ? '图鉴新增成功，已同步至数据库与小程序' : '图鉴信息已更新并同步至数据库与小程序' });
  }

  // 6.5 图鉴删除接口（从所属剧本 endings_json 移除指定 cardId）
  if (pathname === '/duanju/collection' && req.method === 'DELETE') {
    const body = await parseBody(req);
    const scriptId = query.scriptId || body.scriptId;
    const cardId = query.cardId || body.cardId;
    if (!scriptId || !cardId) return sendJson(res, { code: 400, msg: '缺少 scriptId 或 cardId' });
    if (pool) {
      try {
        const [sRows] = await pool.query('SELECT endings_json as endingsJson FROM dj_script WHERE script_id = ? AND del_flag = "0"', [scriptId]);
        if (sRows && sRows.length > 0) {
          let endings = [];
          try { endings = JSON.parse(sRows[0].endingsJson || '[]'); } catch (e) {}
          endings = endings.filter((e) => e.id !== cardId);
          await pool.execute('UPDATE dj_script SET endings_json = ?, version = version + 1, update_time = NOW() WHERE script_id = ?', [JSON.stringify(endings), scriptId]);
        }
      } catch (err) {
        return sendJson(res, { code: 500, msg: '删除图鉴失败: ' + err.message });
      }
    }
    const memScript = db.scripts.find((s) => s.scriptId === scriptId);
    if (memScript && Array.isArray(memScript.endings)) {
      memScript.endings = memScript.endings.filter((e) => e.id !== cardId);
      saveDb();
    }
    return sendJson(res, { code: 200, msg: '图鉴已删除并同步数据库' });
  }

  // 7. 封神排行榜管理与风控操作 (F-ADM-02)
  if (pathname === '/duanju/leaderboard/list' && req.method === 'GET') {
    if (pool) {
      try {
        let sql = 'SELECT rank_id as rankId, script_id as scriptId, user_id as userId, wx_openid as openid, nickname, avatar_url as avatarUrl, actor_name as actorName, ending_id as endingId, ending_title as endingTitle, ending_badge as endingBadge, quality_score as qualityScore, box_office as boxOffice, choice_path as choicePath, status, update_time as updateTime FROM dj_leaderboard WHERE del_flag = "0"';
        const params = [];
        if (query.scriptId) {
          sql += ' AND script_id = ?';
          params.push(query.scriptId);
        }
        if (query.status !== undefined && query.status !== '') {
          sql += ' AND status = ?';
          params.push(query.status);
        }
        sql += ' ORDER BY box_office DESC, quality_score DESC LIMIT 50';
        const [mysqlRows] = await pool.query(sql, params);
        return sendJson(res, { code: 200, msg: '查询成功', rows: mysqlRows || [], total: (mysqlRows || []).length });
      } catch (err) {
        console.warn('[MySQL Query Error]:', err.message);
      }
    }
    let rows = [...db.leaderboards];
    if (query.scriptId) rows = rows.filter((r) => r.scriptId === query.scriptId);
    if (query.status !== undefined && query.status !== '') rows = rows.filter((r) => r.status === query.status);
    rows.sort((a, b) => (Number(b.boxOffice || 0) - Number(a.boxOffice || 0)) || (Number(b.qualityScore || 0) - Number(a.qualityScore || 0)));
    return sendJson(res, { code: 200, msg: '查询成功', rows, total: rows.length });
  }

  if ((pathname === '/duanju/leaderboard/moderate' && req.method === 'POST') || (pathname === '/duanju/leaderboard/status' && req.method === 'PUT')) {
    const body = await parseBody(req);
    const rankId = Number(body.rankId);
    const action = body.action || (String(body.status) === '1' ? 'remove' : 'restore');

    if (pool && rankId) {
      try {
        if (action === 'remove') {
          await pool.execute('UPDATE dj_leaderboard SET status = "1", update_time = NOW() WHERE rank_id = ?', [rankId]);
        } else if (action === 'restore') {
          await pool.execute('UPDATE dj_leaderboard SET status = "0", update_time = NOW() WHERE rank_id = ?', [rankId]);
        } else if (action === 'resetName') {
          await pool.execute('UPDATE dj_leaderboard SET actor_name = "匿名主角", update_time = NOW() WHERE rank_id = ?', [rankId]);
        } else if (action === 'banUser') {
          await pool.execute('UPDATE dj_leaderboard SET status = "1", update_time = NOW() WHERE rank_id = ?', [rankId]);
          const [lbRows] = await pool.query('SELECT wx_openid as openid FROM dj_leaderboard WHERE rank_id = ?', [rankId]);
          if (lbRows && lbRows[0] && lbRows[0].openid) {
            await pool.execute('UPDATE dj_user SET status = "1", update_time = NOW() WHERE wx_openid = ?', [lbRows[0].openid]);
          }
        }
      } catch (err) {
        console.warn('[MySQL Leaderboard Moderate Error]:', err.message);
      }
    }

    const target = db.leaderboards.find((r) => r.rankId === rankId);
    if (target) {
      if (action === 'remove') target.status = '1';
      else if (action === 'restore') target.status = '0';
      else if (action === 'resetName') target.actorName = '匿名主角';
      else if (action === 'banUser') {
        target.status = '1';
        if (db.users[target.openid]) db.users[target.openid].status = '1';
      }
      target.updateTime = nowStr();
      saveDb();
    }
    return sendJson(res, { code: 200, msg: '排行榜风控操作已生效并同步数据库' });
  }

  // 8. 拍摄杀青流水记录查询（直连 MySQL dj_shoot_record）
  if (pathname === '/duanju/record/list' && req.method === 'GET') {
    if (pool) {
      try {
        let sql = `SELECT record_id as recordId, user_id as userId, wx_openid as openid, nickname, script_id as scriptId, script_title as scriptTitle, actor_name as actorName, ending_id as endingId, ending_title as endingTitle, ending_badge as endingBadge, quality_score as qualityScore, box_office as boxOffice, verify_status as verifyStatus, create_time as createTime FROM dj_shoot_record WHERE 1=1`;
        const params = [];
        if (query.scriptId) { sql += ' AND script_id = ?'; params.push(query.scriptId); }
        if (query.verifyStatus) { sql += ' AND verify_status = ?'; params.push(query.verifyStatus); }
        sql += ' ORDER BY create_time DESC LIMIT 100';
        const [rows] = await pool.query(sql, params);
        return sendJson(res, { code: 200, msg: '查询成功', rows, total: rows.length });
      } catch (err) {
        console.warn('[MySQL Record List Error]:', err.message);
      }
    }
    let rows = [...db.records].sort((a, b) => b.recordId - a.recordId);
    if (query.scriptId) rows = rows.filter((r) => r.scriptId === query.scriptId);
    if (query.verifyStatus) rows = rows.filter((r) => r.verifyStatus === query.verifyStatus);
    return sendJson(res, { code: 200, msg: '查询成功', rows, total: rows.length });
  }

  // 9. 全局风控与提审配置读写（持久化至 MySQL dj_sys_config）
  if (pathname === '/duanju/config' && req.method === 'GET') {
    if (pool) {
      try {
        const [rows] = await pool.query('SELECT config_value as val FROM dj_sys_config WHERE config_key = "global_risk_config" AND del_flag = "0" LIMIT 1');
        if (rows && rows[0] && rows[0].val) {
          db.config = { ...db.config, ...JSON.parse(rows[0].val) };
        }
      } catch (e) {}
    }
    return sendJson(res, { code: 200, msg: '操作成功', data: db.config });
  }

  if (pathname === '/duanju/config' && req.method === 'PUT') {
    const body = await parseBody(req);
    db.config = { ...db.config, ...body };
    if (pool) {
      try {
        await pool.execute(
          `INSERT INTO dj_sys_config (config_key, config_value, remark, create_by, update_by, del_flag)
           VALUES ('global_risk_config', ?, '全局风控与广告提审开关配置', 'admin', 'admin', '0')
           ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), update_time = NOW()`,
          [JSON.stringify(db.config)]
        );
      } catch (err) {
        console.warn('[MySQL Save Config Error]:', err.message);
      }
    }
    saveDb();
    return sendJson(res, { code: 200, msg: '风控与提审配置已持久化至数据库，小程序端实时生效', data: db.config });
  }

  // =========================================================================
  // 三、 若依小程序端 API (/app-api/duanju/**)
  // =========================================================================

  // 1. 小程序启动初始化数据 (Bootstrap)
  if (pathname === '/app-api/duanju/bootstrap' && req.method === 'GET') {
    const openid = (query.openid || '').trim();
    const userProfile = (openid && db.users[openid]) || {
      openid,
      nickname: '微信导演',
      avatarUrl: '[电影]',
      customActorName: '主角',
      unlockedCards: [],
      totalBoxOffice: 0,
      bestScore: 0,
      shootCount: 0,
      status: '0'
    };

    const allScripts = await getScriptsFromDbOrMemory();
    const activeScripts = allScripts
      .filter((s) => s.status === '0')
      .sort((a, b) => {
        const recDiff = (b.recommend ? 1 : 0) - (a.recommend ? 1 : 0);
        if (recDiff !== 0) return recDiff;
        return (Number(a.sortOrder) || 999) - (Number(b.sortOrder) || 999);
      })
      .map((s) => {
        const coverImage = s.coverImage || '/static/art/covers/cover-dragon.jpg';
        const coverMatch = String(coverImage).match(/cover-([a-z0-9_-]+)\./i);
        const genreKey = coverMatch ? coverMatch[1] : '';
        const episodes = Array.isArray(s.episodes)
          ? s.episodes.map((ep, epIdx) => {
              let sceneImg = ep.sceneImage || '';
              if ((!sceneImg || sceneImg === coverImage) && genreKey) {
                const candidate = `/static/art/scenes/scene-${genreKey}-ep${epIdx + 1}.jpg`;
                const absScene = path.resolve(APP_ROOT, 'static/art/scenes', `scene-${genreKey}-ep${epIdx + 1}.jpg`);
                if (fs.existsSync(absScene)) sceneImg = candidate;
              }
              return { ...ep, sceneImage: sceneImg || coverImage };
            })
          : [];
        const endings = Array.isArray(s.endings)
          ? s.endings.map((e) => ({
              ...e,
              imageUrl: e.imageUrl || e.art || resolveDefaultEndingArt(e.id || e.endingId, coverImage)
            }))
          : [];
        return { ...s, coverImage, episodes, endings };
      });

    // 基于线上真实启用的剧本结局动态构建图鉴目录（零静态兜底）
    const dynamicCollections = [];
    activeScripts.forEach((s) => {
      (s.endings || []).forEach((e) => {
        const typeKey = e.type || 'triumph';
        dynamicCollections.push({
          cardId: e.id || e.endingId,
          scriptId: s.scriptId,
          scriptTitle: s.title,
          coverImage: s.coverImage,
          endingType: typeKey,
          title: e.title || '未命名结局',
          text: e.text || e.description || '',
          hint: e.hint || DEFAULT_ENDING_HINTS[typeKey] || '完成对应路线即可解锁',
          imageUrl: e.imageUrl,
          unlockCount: e.unlockCount || 0
        });
      });
    });

    // 生成全服神剧跑马灯喜报（从真实排行榜读取，提审模式下返回空数组）
    let marqueeSource = db.leaderboards;
    if (pool && !db.config.auditMode) {
      try {
        const [lbRows] = await pool.query('SELECT script_id as scriptId, nickname, actor_name as actorName, ending_title as endingTitle, quality_score as qualityScore, status FROM dj_leaderboard WHERE del_flag = "0" AND status = "0" AND quality_score >= 90 ORDER BY quality_score DESC LIMIT 6');
        marqueeSource = lbRows || [];
      } catch (e) {}
    }
    const marqueeList = db.config.auditMode
      ? []
      : marqueeSource
          .filter((r) => r.status === '0' && Number(r.qualityScore) >= 90)
          .sort((a, b) => Number(b.qualityScore) - Number(a.qualityScore))
          .slice(0, 6)
          .map((r) => {
            const sTitle = (activeScripts.find((s) => s.scriptId === r.scriptId) || {}).title || '爆款短剧';
            const displayActor = db.config.emergencyCleanName ? '主角' : r.actorName;
            return `[热门] 恭喜导演 [${r.nickname}] 携主演「${displayActor}」拍出 ${r.qualityScore} 分《${sTitle}》，达成【${r.endingTitle}】！`;
          });

    return sendJson(res, {
      code: 200,
      msg: '操作成功',
      data: {
        config: {
          auditMode: db.config.auditMode,
          adEnabled: db.config.adEnabled,
          emergencyCleanName: db.config.emergencyCleanName
        },
        scripts: activeScripts,
        collections: dynamicCollections,
        userProfile,
        marqueeList
      }
    });
  }

  // 2. 主演改名安全校验接口 (AC-MP-01.3 & AC-ADM-03)
  if (pathname === '/app-api/duanju/checkName' && req.method === 'POST') {
    const body = await parseBody(req);
    const result = verifyActorName(body.actorName);
    if (!result.pass) {
      return sendJson(res, { code: 400, msg: result.reason, data: result });
    }
    const openid = body.openid || 'wx_player_local';
    if (db.users[openid]) {
      db.users[openid].customActorName = result.cleanName;
      saveDb();
    }
    return sendJson(res, { code: 200, msg: '主演改名通过微信 msgSecCheck 安全校验', data: result });
  }

  // 3. 杀青战绩上报与服务端防作弊复算接口 (AC-MP-03.2 & AC-ADM-02)
  if (pathname === '/app-api/duanju/shoot/submit' && req.method === 'POST') {
    const body = await parseBody(req);
    const {
      openid = '',
      nickname = '微信导演',
      avatarUrl = '[电影]',
      scriptId,
      actorName = '主角',
      choicePath: rawChoicePath = [],
      historyChoices = [],
      collectedEvidenceEps,
      clientScore = 0,
      adBoosted = false
    } = body;
    const choicePath = (Array.isArray(rawChoicePath) && rawChoicePath.length)
      ? rawChoicePath
      : (Array.isArray(historyChoices) ? historyChoices.map((h) => h && (h.choiceId || h.id || h.label)).filter(Boolean) : []);

    const allScripts = await getScriptsFromDbOrMemory();
    const script = allScripts.find((s) => s.scriptId === scriptId) || db.scripts.find((s) => s.scriptId === scriptId);
    if (!script) {
      return sendJson(res, { code: 404, msg: '未找到对应剧本' });
    }

    // 校验主演名是否合规，若违规自动降级为默认主角名
    const nameCheck = verifyActorName(actorName);
    const safeActorName = nameCheck.pass ? nameCheck.cleanName : (script.defaultProtagonist || '主角');

    let verifyResult;
    try {
      verifyResult = calculateAndVerifyShoot(
        script,
        choicePath,
        Array.isArray(collectedEvidenceEps) ? collectedEvidenceEps : undefined
      );
    } catch (err) {
      // 记录异常防作弊流水
      db.records.push({
        recordId: Date.now(),
        openid,
        nickname,
        scriptId,
        scriptTitle: script.title,
        actorName: safeActorName,
        choicePath,
        endingId: 'CHEAT_BLOCKED',
        endingTitle: err.message,
        qualityScore: Number(clientScore) || 0,
        boxOffice: 0,
        verifyStatus: '0',
        createTime: nowStr()
      });
      saveDb();
      return sendJson(res, { code: 400, msg: `防作弊系统拦截：${err.message}` }, 400);
    }

    // 检查客户端上报分数是否超出该路径理论最高分上限 (AC-ADM-02)
    const numericClientScore = Number(clientScore);
    if (numericClientScore > verifyResult.maxAllowedScore + 0.5) {
      db.records.push({
        recordId: Date.now(),
        openid,
        nickname,
        scriptId,
        scriptTitle: script.title,
        actorName: safeActorName,
        choicePath,
        endingId: verifyResult.matchedEnding.endingId,
        endingTitle: `分数篡改拦截(上报:${numericClientScore} > 理论上限:${verifyResult.maxAllowedScore})`,
        qualityScore: numericClientScore,
        boxOffice: 0,
        verifyStatus: '0',
        createTime: nowStr()
      });
      saveDb();
      return sendJson(
        res,
        {
          code: 400,
          msg: `防作弊拦截：上报分数(${numericClientScore})超出当前选项路径理论上限(${verifyResult.maxAllowedScore})！`
        },
        400
      );
    }

    // 采用合法的最终得分
    const finalScore =
      numericClientScore >= verifyResult.minAllowedScore && numericClientScore <= verifyResult.maxAllowedScore
        ? Number(numericClientScore.toFixed(2))
        : verifyResult.recommendedScore;

    // 换算模拟播放量 (票房)
    let boxOffice = Math.round(Math.pow(Math.max(50, finalScore - 40), 3.35) * 850);
    if (adBoosted) {
      boxOffice = Math.round(boxOffice * 1.25); // 激励广告宣发暴击 +25%
    }

    // 更新剧本统计与选项点击漏斗
    const memScript = db.scripts.find((s) => s.scriptId === scriptId) || script;
    memScript.playCount = (memScript.playCount || 0) + 1;
    memScript.finishCount = (memScript.finishCount || 0) + 1;
    if (!memScript.choiceStats) memScript.choiceStats = {};
    choicePath.forEach((cid) => {
      memScript.choiceStats[cid] = (memScript.choiceStats[cid] || 0) + 1;
    });

    const resolvedOpenid = openid || ('wx_guest_' + Date.now());
    let realUserId = Number(body.userId) || 0;
    if (pool && !realUserId) {
      try {
        const [uRows] = await pool.query('SELECT user_id FROM dj_user WHERE wx_openid = ? AND del_flag = "0" LIMIT 1', [resolvedOpenid]);
        if (uRows && uRows[0]) {
          realUserId = Number(uRows[0].user_id);
        } else {
          const [insRes] = await pool.execute(
            'INSERT INTO dj_user (wx_openid, user_name, nickname, avatar_url, unlocked_cards_json, unlocked_count, total_box_office, best_score, shoot_count, last_login_time, status, del_flag, create_time) VALUES (?, ?, ?, ?, "[]", 0, 0, 0, 0, NOW(), "0", "0", NOW())',
            [resolvedOpenid, resolvedOpenid, nickname || '微信导演', avatarUrl || '[电影]']
          );
          realUserId = Number(insRes.insertId);
        }
      } catch (e) {
        console.warn('[MySQL Resolve Submit User Warn]:', e.message);
      }
    }

    // 更新玩家档案与已解锁图鉴
    if (!db.users[resolvedOpenid]) {
      db.users[resolvedOpenid] = {
        userId: realUserId || Date.now(),
        openid: resolvedOpenid,
        nickname,
        avatarUrl,
        customActorName: safeActorName,
        unlockedCards: [],
        totalBoxOffice: 0,
        bestScore: 0,
        shootCount: 0,
        status: '0'
      };
    }
    const user = db.users[resolvedOpenid];
    if (realUserId) user.userId = realUserId;
    user.nickname = nickname || user.nickname;
    user.shootCount = (user.shootCount || 0) + 1;
    if (finalScore > (user.bestScore || 0)) {
      user.bestScore = finalScore;
    }

    const cardsToUnlock = [verifyResult.matchedEnding.endingId, ...verifyResult.newlyUnlockedEasterEggs].filter(Boolean);
    cardsToUnlock.forEach((cid) => {
      if (!user.unlockedCards.includes(cid)) {
        user.unlockedCards.push(cid);
        const colItem = db.collections.find((c) => c.cardId === cid);
        if (colItem) colItem.unlockCount = (colItem.unlockCount || 0) + 1;
      }
    });

    // 记录正常杀青流水
    const recordEntry = {
      recordId: Date.now(),
      userId: realUserId || resolvedOpenid,
      openid: resolvedOpenid,
      nickname: user.nickname,
      scriptId,
      scriptTitle: script.title,
      actorName: safeActorName,
      choicePath,
      finalStats: verifyResult.stats,
      endingId: verifyResult.matchedEnding.endingId,
      endingTitle: verifyResult.matchedEnding.title,
      endingBadge: verifyResult.matchedEnding.badge,
      qualityScore: finalScore,
      boxOffice,
      verifyStatus: '1',
      createTime: nowStr()
    };
    db.records.push(recordEntry);

    // 更新单剧封神排行榜（同一玩家同一剧本仅保留最高分记录 AC-MP-03.4）
    let isNewRecord = false;
    if (user.status !== '1') {
      const existingRank = db.leaderboards.find((r) => r.scriptId === scriptId && r.openid === resolvedOpenid);
      if (!existingRank) {
        isNewRecord = true;
        db.leaderboards.push({
          rankId: Date.now() + Math.floor(Math.random() * 100),
          scriptId,
          userId: realUserId || resolvedOpenid,
          openid: resolvedOpenid,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl || '[电影]',
          actorName: safeActorName,
          endingId: verifyResult.matchedEnding.endingId,
          endingTitle: verifyResult.matchedEnding.title,
          endingBadge: verifyResult.matchedEnding.badge,
          qualityScore: finalScore,
          boxOffice,
          choicePath,
          status: '0',
          updateTime: nowStr()
        });
      } else if (finalScore >= existingRank.qualityScore || boxOffice > (existingRank.boxOffice || 0)) {
        isNewRecord = true;
        existingRank.nickname = user.nickname;
        existingRank.actorName = safeActorName;
        existingRank.endingId = verifyResult.matchedEnding.endingId;
        existingRank.endingTitle = verifyResult.matchedEnding.title;
        existingRank.endingBadge = verifyResult.matchedEnding.badge;
        existingRank.qualityScore = Math.max(existingRank.qualityScore, finalScore);
        existingRank.boxOffice = Math.max(existingRank.boxOffice, boxOffice);
        existingRank.choicePath = choicePath;
        existingRank.updateTime = nowStr();
      }
    }

    // 重新汇总该玩家在所有剧本下的最高播放量总和
    user.totalBoxOffice = db.leaderboards
      .filter((r) => r.openid === resolvedOpenid && r.status === '0')
      .reduce((acc, r) => acc + (r.boxOffice || 0), 0);

    // 同步到远程服务器宝塔 MySQL 数据库 (ry_duanju)
    if (pool && realUserId) {
      await pool.execute(
        `INSERT INTO dj_shoot_record (user_id, wx_openid, nickname, script_id, script_title, actor_name, choice_path, final_stats_json, ending_id, ending_title, ending_badge, quality_score, box_office, verify_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [realUserId, resolvedOpenid, user.nickname || '微信导演', scriptId, script.title, safeActorName, JSON.stringify(choicePath), JSON.stringify(verifyResult.stats), verifyResult.matchedEnding.endingId, verifyResult.matchedEnding.title, verifyResult.matchedEnding.badge, finalScore, boxOffice, '1']
      ).catch(e => console.warn('[MySQL Save Record Warn]:', e.message));

      await pool.execute(
        `INSERT INTO dj_user_progress (user_id, wx_openid, script_id, script_title, current_episode, current_panel, history_choices_json, current_stats_json, is_finished, finish_score, finish_box_office, last_shoot_time, create_time, del_flag)
         VALUES (?, ?, ?, ?, 6, 3, ?, ?, '1', ?, ?, NOW(), NOW(), '0')
         ON DUPLICATE KEY UPDATE current_episode = 6, current_panel = 3, history_choices_json = VALUES(history_choices_json), current_stats_json = VALUES(current_stats_json), is_finished = '1', finish_score = VALUES(finish_score), finish_box_office = VALUES(finish_box_office), last_shoot_time = NOW()`,
        [realUserId, resolvedOpenid, scriptId, script.title, JSON.stringify(choicePath), JSON.stringify(verifyResult.stats), finalScore, boxOffice]
      ).catch(e => console.warn('[MySQL Save Progress Checkpoint Warn]:', e.message));

      await pool.execute(
        `UPDATE dj_user SET total_box_office = IFNULL(total_box_office, 0) + ?, shoot_count = IFNULL(shoot_count, 0) + 1, best_score = GREATEST(IFNULL(best_score, 0), ?), nickname = ? WHERE user_id = ?`,
        [boxOffice, finalScore, user.nickname || '微信导演', realUserId]
      ).catch(e => console.warn('[MySQL Update User Stats Warn]:', e.message));

      await pool.execute(
        `UPDATE dj_script SET play_count = play_count + 1, finish_count = finish_count + 1 WHERE script_id = ?`,
        [scriptId]
      ).catch(() => {});

      if (isNewRecord) {
        await pool.execute(
          `INSERT INTO dj_leaderboard (script_id, user_id, wx_openid, nickname, actor_name, ending_id, ending_title, ending_badge, quality_score, box_office, choice_path)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE nickname=VALUES(nickname), actor_name=VALUES(actor_name), ending_id=VALUES(ending_id), ending_title=VALUES(ending_title), ending_badge=VALUES(ending_badge), quality_score=GREATEST(quality_score, VALUES(quality_score)), box_office=GREATEST(box_office, VALUES(box_office)), choice_path=VALUES(choice_path)`,
          [scriptId, realUserId, resolvedOpenid, user.nickname || '微信导演', safeActorName, verifyResult.matchedEnding.endingId, verifyResult.matchedEnding.title, verifyResult.matchedEnding.badge, finalScore, boxOffice, JSON.stringify(choicePath)]
        ).catch(e => console.warn('[MySQL Save Leaderboard Warn]:', e.message));
      }
    }

    // 计算当前玩家在该剧本排行榜的名次与击败百分比（按播放量由高到低）
    let scriptBoard = db.leaderboards
      .filter((r) => r.scriptId === scriptId && r.status === '0')
      .sort((a, b) => (Number(b.boxOffice || 0) - Number(a.boxOffice || 0)) || (Number(b.qualityScore || 0) - Number(a.qualityScore || 0)));
    if (pool) {
      try {
        const [lbRows] = await pool.query(
          'SELECT wx_openid as openid FROM dj_leaderboard WHERE script_id = ? AND status = "0" AND del_flag = "0" ORDER BY box_office DESC, quality_score DESC',
          [scriptId]
        );
        if (lbRows) scriptBoard = lbRows;
      } catch (e) {}
    }
    const myRankIndex = scriptBoard.findIndex((r) => r.openid === resolvedOpenid);
    const myRank = myRankIndex >= 0 ? myRankIndex + 1 : 1;
    const beatPercent = Math.min(99.9, Math.max(55.0, Number(((finalScore - 50) * 1.02).toFixed(1))));

    saveDb();

    return sendJson(res, {
      code: 200,
      msg: '杀青战绩已通过防作弊核验并同步至封神榜',
      data: {
        finalScore,
        boxOffice,
        myRank,
        beatPercent,
        isNewRecord,
        styleBadge: verifyResult.styleBadge,
        comment: verifyResult.comment,
        endingId: verifyResult.matchedEnding.endingId,
        endingTitle: verifyResult.matchedEnding.title,
        endingType: verifyResult.matchedEnding.type,
        verifiedStats: verifyResult.stats,
        unlockedCards: user.unlockedCards,
        ending: verifyResult.matchedEnding
      }
    });
  }

  // 3.5 好友分享成片接口：直连 MySQL dj_share_movie（支持完整分集回放与裂变挑战统计）
  if (pathname === '/app-api/duanju/share/detail' && req.method === 'GET') {
    const shareCode = query.shareCode || query.recordId;
    let record = null;
    if (pool && shareCode) {
      try {
        const [rows] = await pool.query(
          'SELECT share_code as recordId, user_id as userId, wx_openid as openid, nickname, script_id as scriptId, script_title as scriptTitle, ending_title as endingTitle, quality_score as qualityScore, box_office as boxOffice, history_choices_json as historyChoicesJson, view_count as viewCount, challenge_count as challengeCount, create_time as createTime FROM dj_share_movie WHERE share_code = ? AND del_flag = "0" LIMIT 1',
          [shareCode]
        );
        if (rows && rows[0]) {
          record = rows[0];
          try { record.historyChoices = JSON.parse(record.historyChoicesJson || '[]'); } catch (e) { record.historyChoices = []; }
          if (Array.isArray(record.historyChoices) && record.historyChoices[0] && record.historyChoices[0]._shareMeta) {
            const meta = record.historyChoices[0]._shareMeta;
            if (meta.actorName) record.actorName = meta.actorName;
            if (meta.endingId) record.endingId = meta.endingId;
            if (meta.endingText) record.endingText = meta.endingText;
          }
          pool.execute('UPDATE dj_share_movie SET view_count = view_count + 1 WHERE share_code = ?', [shareCode]).catch(() => {});
        }
      } catch (e) {}
    }
    if (!record && shareCode && db.shareMovies && db.shareMovies[shareCode]) {
      record = { ...db.shareMovies[shareCode] };
    }
    if (!record) {
      record = db.records.find((r) => String(r.recordId) === String(shareCode)) || null;
    }
    if (!record) {
      return sendJson(res, { code: 404, msg: '未找到该分享成片记录' }, 404);
    }
    return sendJson(res, { code: 200, msg: '获取好友分享成片详情成功', data: record });
  }

  if (pathname === '/app-api/duanju/share/challenge' && req.method === 'POST') {
    const body = await parseBody(req);
    if (pool && body.shareCode) {
      await pool.execute('UPDATE dj_share_movie SET challenge_count = challenge_count + 1 WHERE share_code = ?', [body.shareCode]).catch(() => {});
    }
    return sendJson(res, { code: 200, msg: '已记录好友挑战裂变' });
  }

  // 3.6 玩家云端结局图鉴同步接口（直连 MySQL dj_user_collection）
  if (pathname === '/app-api/duanju/collection/my' && req.method === 'GET') {
    const userId = Number(query.userId) || 0;
    const openid = (query.openid || '').trim();
    if (pool && (userId || openid)) {
      try {
        const [rows] = await pool.query(
          'SELECT script_id as scriptId, ending_id as id, ending_title as title, ending_type as type, choices_json as choicesJson, unlock_count as count, first_unlock_time as firstAt FROM dj_user_collection WHERE ((? > 0 AND user_id = ?) OR (wx_openid <> "" AND wx_openid = ?)) AND del_flag = "0"',
          [userId, userId, openid]
        );
        const endingsMap = {};
        rows.forEach((r) => {
          let choices = [];
          try { choices = JSON.parse(r.choicesJson || '[]'); } catch (e) {}
          endingsMap[r.id] = {
            id: r.id,
            genreId: r.scriptId,
            title: r.title,
            type: r.type || 'triumph',
            count: Number(r.count || 1),
            firstAt: r.firstAt,
            choices
          };
        });
        return sendJson(res, { code: 200, msg: '查询云端图鉴成功', data: { endings: endingsMap, total: rows.length } });
      } catch (err) {
        console.warn('[MySQL My Collection Error]:', err.message);
      }
    }
    return sendJson(res, { code: 200, msg: '查询成功', data: { endings: {}, total: 0 } });
  }

  if (pathname === '/app-api/duanju/collection/unlock' && req.method === 'POST') {
    const body = await parseBody(req);
    const userId = Number(body.userId) || 0;
    const openid = (body.openid || '').trim();
    const scriptId = body.scriptId || '';
    const endingId = body.endingId || '';
    if (!endingId) return sendJson(res, { code: 400, msg: '缺少 endingId' });
    if (pool && (userId || openid)) {
      try {
        await pool.execute(
          `INSERT INTO dj_user_collection (user_id, wx_openid, script_id, ending_id, ending_title, ending_type, choices_json, unlock_count, first_unlock_time, del_flag)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), '0')
           ON DUPLICATE KEY UPDATE unlock_count = unlock_count + 1, ending_title = VALUES(ending_title), choices_json = VALUES(choices_json), update_time = NOW()`,
          [userId, openid, scriptId, endingId, body.endingTitle || '', body.endingType || 'triumph', JSON.stringify(body.choices || [])]
        );
      } catch (err) {
        console.warn('[MySQL Unlock Collection Error]:', err.message);
      }
    }
    return sendJson(res, { code: 200, msg: '图鉴解锁已同步至云端数据库' });
  }

  if (pathname === '/app-api/duanju/game/boost' && req.method === 'POST') {
    const body = await parseBody(req);
    const openid = (body.openid || '').trim();
    const userId = Number(body.userId) || 0;
    const scriptId = body.scriptId || 'script_01_zhuixu';
    const boostedBoxOffice = Number(body.boxOffice) || 0;

    if (pool && boostedBoxOffice > 0 && (userId || openid)) {
      await pool.execute(
        'UPDATE dj_leaderboard SET box_office = GREATEST(IFNULL(box_office, 0), ?), update_time = NOW() WHERE ((? > 0 AND user_id = ?) OR (wx_openid <> "" AND wx_openid = ?)) AND script_id = ?',
        [boostedBoxOffice, userId, userId, openid, scriptId]
      ).catch(() => {});
      await pool.execute(
        'UPDATE dj_user SET total_box_office = IFNULL(total_box_office, 0) + ? WHERE (? > 0 AND user_id = ?) OR (wx_openid <> "" AND wx_openid = ?)',
        [Math.round(boostedBoxOffice * 0.2), userId, userId, openid]
      ).catch(() => {});
    }
    const targetRank = openid ? db.leaderboards.find((r) => r.openid === openid && r.scriptId === scriptId) : null;
    if (targetRank && boostedBoxOffice > (targetRank.boxOffice || 0)) {
      targetRank.boxOffice = boostedBoxOffice;
      targetRank.updateTime = nowStr();
      saveDb();
    }
    return sendJson(res, { code: 200, msg: '激励宣发播放量已同步冲榜', data: { boxOffice: boostedBoxOffice } });
  }

  if (pathname === '/app-api/duanju/share/save' && req.method === 'POST') {
    const body = await parseBody(req);
    const shareId = 'share_' + Date.now();
    const rawChoices = Array.isArray(body.historyChoices) ? body.historyChoices.map((c) => (typeof c === 'object' && c ? { ...c } : { choiceId: c })) : [];
    const shareMeta = {
      actorName: (body.actorName || '').trim(),
      endingId: (body.endingId || '').trim(),
      endingText: (body.endingText || '').trim()
    };
    if (rawChoices.length > 0) {
      rawChoices[0]._shareMeta = shareMeta;
    }

    if (pool) {
      try {
        await pool.execute(
          `INSERT INTO dj_share_movie (share_code, user_id, wx_openid, nickname, script_id, script_title, ending_title, quality_score, box_office, history_choices_json, view_count, challenge_count, del_flag)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, '0')`,
          [
            shareId,
            Number(body.userId) || 0,
            body.openid || '',
            body.nickname || '微信导演',
            body.scriptId || 'script_01_zhuixu',
            body.scriptTitle || '',
            body.endingTitle || '',
            Number(body.qualityScore) || 0,
            String(body.boxOffice || '0 亿'),
            JSON.stringify(rawChoices)
          ]
        );
      } catch (err) {
        console.warn('[MySQL Save Share Error]:', err.message);
      }
    }
    if (!db.shareMovies || typeof db.shareMovies !== 'object') db.shareMovies = {};
    db.shareMovies[shareId] = {
      recordId: shareId,
      userId: Number(body.userId) || 0,
      openid: body.openid || '',
      nickname: body.nickname || '微信导演',
      actorName: shareMeta.actorName,
      scriptId: body.scriptId || 'script_01_zhuixu',
      scriptTitle: body.scriptTitle || '',
      endingId: shareMeta.endingId,
      endingTitle: body.endingTitle || '',
      endingText: shareMeta.endingText,
      qualityScore: Number(body.qualityScore) || 0,
      boxOffice: String(body.boxOffice || '0 亿'),
      historyChoices: rawChoices,
      createTime: nowStr()
    };
    saveDb();
    return sendJson(res, {
      code: 200,
      msg: '成片分享码已生成',
      data: {
        shareCode: shareId,
        shareUrl: `/?shareCode=${shareId}`
      }
    });
  }

  // 4. 小程序获取封神排行榜（直连 MySQL dj_leaderboard，无数据时返回空数组）
  if (pathname === '/app-api/duanju/leaderboard' && req.method === 'GET') {
    const boardType = query.boardType || 'script'; // 'script' | 'total'
    const scriptId = query.scriptId || 'script_01_zhuixu';
    const openid = (query.openid || '').trim();
    const defaultActor = (db.scripts.find((s) => s.scriptId === scriptId) || {}).defaultProtagonist || '主角';

    let sourceRows = db.leaderboards;
    if (pool) {
      try {
        const [mysqlRows] = await pool.query(
          'SELECT rank_id as rankId, script_id as scriptId, user_id as userId, wx_openid as openid, nickname, avatar_url as avatarUrl, actor_name as actorName, ending_id as endingId, ending_title as endingTitle, ending_badge as endingBadge, quality_score as qualityScore, box_office as boxOffice, update_time as updateTime, status FROM dj_leaderboard WHERE del_flag = "0" AND status = "0"'
        );
        sourceRows = mysqlRows || [];
      } catch (e) {}
    }

    if (boardType === 'script') {
      const list = sourceRows
        .filter((r) => r.scriptId === scriptId && r.status === '0')
        .sort((a, b) => (Number(b.boxOffice || 0) - Number(a.boxOffice || 0)) || (Number(b.qualityScore) - Number(a.qualityScore)))
        .slice(0, 100)
        .map((r, idx) => ({
          rank: idx + 1,
          rankId: r.rankId,
          openid: r.openid,
          nickname: r.nickname,
          avatarUrl: r.avatarUrl || '[电影]',
          actorName: db.config.emergencyCleanName ? defaultActor : r.actorName,
          endingTitle: r.endingTitle,
          endingBadge: r.endingBadge,
          qualityScore: Number(r.qualityScore).toFixed(2),
          boxOffice: r.boxOffice,
          updateTime: r.updateTime
        }));

      const myEntry = openid ? (list.find((item) => item.openid === openid) || null) : null;
      return sendJson(res, {
        code: 200,
        msg: '查询成功',
        data: {
          boardType: 'script',
          scriptId,
          emergencyCleanName: db.config.emergencyCleanName,
          list,
          myEntry
        }
      });
    } else {
      const userMap = new Map();
      sourceRows
        .filter((r) => r.status === '0')
        .forEach((r) => {
          const prev = userMap.get(r.openid) || {
            openid: r.openid,
            nickname: r.nickname,
            avatarUrl: r.avatarUrl || '[电影]',
            totalBoxOffice: 0,
            bestScore: 0,
            scriptCount: 0,
            unlockedCount: (db.users[r.openid] && db.users[r.openid].unlockedCards.length) || 0
          };
          prev.totalBoxOffice += Number(r.boxOffice || 0);
          prev.bestScore = Math.max(prev.bestScore, Number(r.qualityScore));
          prev.scriptCount += 1;
          userMap.set(r.openid, prev);
        });

      const list = Array.from(userMap.values())
        .sort((a, b) => b.totalBoxOffice - a.totalBoxOffice)
        .slice(0, 100)
        .map((u, idx) => ({
          rank: idx + 1,
          ...u,
          bestScore: u.bestScore.toFixed(2)
        }));

      const myEntry = openid ? (list.find((item) => item.openid === openid) || null) : null;
      return sendJson(res, {
        code: 200,
        msg: '查询成功',
        data: {
          boardType: 'total',
          list,
          myEntry
        }
      });
    }
  }

  // =========================================================================
  // 四、 用户认证与多端登录系统 (/app-api/duanju/auth/**)
  // =========================================================================

  // 1. 导演登录/微信小游戏真实登录/自动注册
  if ((pathname === '/app-api/duanju/auth/login' || pathname === '/duanju/auth/login' || pathname === '/app-api/duanju/auth/wxLogin') && req.method === 'POST') {
    const body = await parseBody(req);
    const loginType = body.loginType || (body.code ? 'wechat' : 'guest'); // 'wechat' | 'guest' | 'account'
    let user = null;
    let wxRealAuth = false;

    if (loginType === 'account') {
      const userName = (body.userName || body.username || '').trim();
      const password = (body.password || '').trim();
      if (!userName) {
        return sendJson(res, { code: 400, msg: '登录用户名不能为空' });
      }

      if (pool) {
        try {
          const [rows] = await pool.query('SELECT * FROM dj_user WHERE user_name = ? AND del_flag = "0" LIMIT 1', [userName]);
          if (rows && rows.length > 0) {
            user = rows[0];
            if (password && user.password && user.password !== password) {
              return sendJson(res, { code: 400, msg: '密码错误，请核对后再试' });
            }
            await pool.query('UPDATE dj_user SET last_login_time = NOW(), last_login_ip = ? WHERE user_id = ?', [req.socket.remoteAddress || '', user.user_id]);
          } else {
            // 自动注册新导演
            const newOpenid = 'wx_user_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            const nick = body.nickname || ('导演_' + userName);
            const [insertRes] = await pool.query(
              'INSERT INTO dj_user (user_name, password, wx_openid, nickname, phone, avatar_url, unlocked_cards_json, unlocked_count, total_box_office, best_score, shoot_count, last_login_time, last_login_ip, status, del_flag, create_time) VALUES (?, ?, ?, ?, ?, ?, "[]", 0, 0, 0, 0, NOW(), ?, "0", "0", NOW())',
              [userName, password || '123456', newOpenid, nick, body.phone || '', body.avatarUrl || '[导演]', req.socket.remoteAddress || '']
            );
            const [newRows] = await pool.query('SELECT * FROM dj_user WHERE user_id = ?', [insertRes.insertId]);
            user = newRows[0];
          }
        } catch (e) {
          console.warn('[MySQL Auth Error]:', e.message);
        }
      }

      if (!user) {
        const uid = 'usr_' + userName;
        if (!db.users[uid]) {
          db.users[uid] = {
            userId: 2000 + Math.floor(Math.random() * 1000),
            userName,
            openid: uid,
            nickname: body.nickname || ('导演_' + userName),
            avatarUrl: body.avatarUrl || '[导演]',
            unlockedCards: [],
            totalBoxOffice: 0,
            bestScore: 0,
            shootCount: 0,
            status: '0'
          };
          saveDb();
        }
        user = db.users[uid];
      }
    } else if (loginType === 'wechat') {
      const code = (body.code || '').trim();
      const cleanDeviceId = (body.deviceId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
      const wxSession = await fetchWechatSession(code);
      let openid = '';
      if (wxSession && wxSession.openid) {
        openid = wxSession.openid;
        wxRealAuth = true;
      } else if (body.openid && String(body.openid).trim()) {
        openid = String(body.openid).trim();
      } else if (cleanDeviceId) {
        openid = 'wx_dev_' + cleanDeviceId;
      } else if (code) {
        openid = 'wx_code_' + crypto.createHash('md5').update(code).digest('hex').slice(0, 12);
      } else {
        openid = 'wx_dev_' + Date.now();
      }
      const nickname = (body.nickname || '').trim() || ('微信导演_' + openid.slice(-4).toUpperCase());

      if (pool) {
        try {
          const [rows] = await pool.query('SELECT * FROM dj_user WHERE wx_openid = ? AND del_flag = "0" LIMIT 1', [openid]);
          if (rows && rows.length > 0) {
            user = rows[0];
            await pool.query('UPDATE dj_user SET last_login_time = NOW(), last_login_ip = ? WHERE user_id = ?', [req.socket.remoteAddress || '', user.user_id]);
          } else {
            const [insertRes] = await pool.query(
              'INSERT INTO dj_user (wx_openid, user_name, nickname, avatar_url, unlocked_cards_json, unlocked_count, total_box_office, best_score, shoot_count, last_login_time, last_login_ip, status, del_flag, create_time) VALUES (?, ?, ?, ?, "[]", 0, 0, 0, 0, NOW(), ?, "0", "0", NOW())',
              [openid, openid, nickname, body.avatarUrl || '[电影]', req.socket.remoteAddress || '']
            );
            const [newRows] = await pool.query('SELECT * FROM dj_user WHERE user_id = ?', [insertRes.insertId]);
            user = newRows[0];
          }
        } catch (e) {
          console.warn('[MySQL WeChat Login Error]:', e.message);
        }
      }

      if (!user) {
        if (!db.users[openid]) {
          db.users[openid] = {
            userId: 1000 + Object.keys(db.users).length + 1,
            openid,
            userName: openid,
            nickname,
            avatarUrl: body.avatarUrl || '[电影]',
            unlockedCards: [],
            totalBoxOffice: 0,
            bestScore: 0,
            shootCount: 0,
            status: '0'
          };
          saveDb();
        }
        user = db.users[openid];
      }
    } else {
      // 游客一键体验登录
      const cleanDeviceId = (body.deviceId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
      const openid = body.openid || (cleanDeviceId ? 'wx_guest_' + cleanDeviceId : 'wx_guest_' + Date.now());
      const nickname = (body.nickname || '').trim() || ('新锐导演_' + openid.slice(-4).toUpperCase());

      if (pool) {
        try {
          const [rows] = await pool.query('SELECT * FROM dj_user WHERE wx_openid = ? AND del_flag = "0" LIMIT 1', [openid]);
          if (rows && rows.length > 0) {
            user = rows[0];
            await pool.query('UPDATE dj_user SET last_login_time = NOW(), last_login_ip = ? WHERE user_id = ?', [req.socket.remoteAddress || '', user.user_id]);
          } else {
            const [insertRes] = await pool.query(
              'INSERT INTO dj_user (wx_openid, user_name, nickname, avatar_url, unlocked_cards_json, unlocked_count, total_box_office, best_score, shoot_count, last_login_time, last_login_ip, status, del_flag, create_time) VALUES (?, ?, ?, ?, "[]", 0, 0, 0, 0, NOW(), ?, "0", "0", NOW())',
              [openid, openid, nickname, body.avatarUrl || '[电影]', req.socket.remoteAddress || '']
            );
            const [newRows] = await pool.query('SELECT * FROM dj_user WHERE user_id = ?', [insertRes.insertId]);
            user = newRows[0];
          }
        } catch (e) {
          console.warn('[MySQL Quick Login Error]:', e.message);
        }
      }

      if (!user) {
        if (!db.users[openid]) {
          db.users[openid] = {
            userId: 1000 + Object.keys(db.users).length + 1,
            openid,
            userName: openid,
            nickname,
            avatarUrl: body.avatarUrl || '[电影]',
            unlockedCards: [],
            totalBoxOffice: 0,
            bestScore: 0,
            shootCount: 0,
            status: '0'
          };
          saveDb();
        }
        user = db.users[openid];
      }
    }

    const token = 'token_duanju_' + (user.user_id || user.userId || Date.now());
    return sendJson(res, {
      code: 200,
      msg: '导演登录成功',
      token,
      wxRealAuth,
      data: {
        userId: user.user_id || user.userId,
        userName: user.user_name || user.userName || '',
        openid: user.wx_openid || user.openid,
        nickname: user.nickname || '微信导演',
        avatarUrl: user.avatar_url || user.avatarUrl || '[电影]',
        phone: user.phone || '',
        totalBoxOffice: user.total_box_office !== undefined ? user.total_box_office : (user.totalBoxOffice || 0),
        bestScore: user.best_score !== undefined ? Number(user.best_score) : (user.bestScore || 0),
        shootCount: user.shoot_count !== undefined ? user.shoot_count : (user.shootCount || 0)
      }
    });
  }

  // 2. 获取当前登录导演信息
  if ((pathname === '/app-api/duanju/auth/info' || pathname === '/duanju/auth/info') && req.method === 'GET') {
    const userId = Number(query.userId) || 0;
    const openid = (query.openid || '').trim();

    if (pool && (userId || openid)) {
      try {
        const sql = userId ? 'SELECT * FROM dj_user WHERE user_id = ? AND del_flag = "0"' : 'SELECT * FROM dj_user WHERE wx_openid = ? AND del_flag = "0"';
        const [rows] = await pool.query(sql, [userId || openid]);
        if (rows && rows.length > 0) {
          const u = rows[0];
          return sendJson(res, {
            code: 200,
            msg: '获取导演信息成功',
            data: {
              userId: u.user_id,
              userName: u.user_name,
              openid: u.wx_openid,
              nickname: u.nickname,
              avatarUrl: u.avatar_url,
              phone: u.phone,
              totalBoxOffice: u.total_box_office || 0,
              bestScore: Number(u.best_score) || 0,
              shootCount: u.shoot_count || 0
            }
          });
        }
      } catch (e) {
        console.warn('[MySQL User Info Error]:', e.message);
      }
    }

    const targetUser = (openid && db.users[openid]) || null;
    if (!targetUser) {
      return sendJson(res, { code: 404, msg: '未找到该导演档案，请先登录', data: null }, 404);
    }

    return sendJson(res, {
      code: 200,
      msg: '获取导演信息成功',
      data: targetUser
    });
  }

  // 3. 预设/已有导演列表（便于一键切换体验多用户档期）
  if ((pathname === '/app-api/duanju/auth/userList' || pathname === '/duanju/auth/userList') && req.method === 'GET') {
    if (pool) {
      try {
        const [rows] = await pool.query(
          'SELECT user_id as userId, user_name as userName, wx_openid as openid, nickname, avatar_url as avatarUrl, phone, total_box_office as totalBoxOffice, best_score as bestScore, shoot_count as shootCount, last_login_time as lastLoginTime FROM dj_user WHERE del_flag = "0" ORDER BY user_id ASC LIMIT 20'
        );
        if (rows && rows.length > 0) {
          return sendJson(res, { code: 200, msg: '查询成功', rows });
        }
      } catch (e) {
        console.warn('[MySQL UserList Error]:', e.message);
      }
    }
    const rows = Object.values(db.users).map((u, i) => ({
      userId: 1001 + i,
      userName: u.openid,
      openid: u.openid,
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      totalBoxOffice: u.totalBoxOffice,
      bestScore: u.bestScore,
      shootCount: u.shootCount
    }));
    return sendJson(res, { code: 200, msg: '查询成功', rows });
  }

  // 4. 修改导演昵称与主演定制名
  if ((pathname === '/app-api/duanju/auth/updateProfile' || pathname === '/duanju/auth/updateProfile') && req.method === 'POST') {
    const body = await parseBody(req);
    const userId = Number(body.userId) || 0;
    const openid = (body.openid || '').trim();
    const nickname = (body.nickname || '').trim();
    const customActorName = (body.customActorName || '').trim();
    if (!nickname && !customActorName) {
      return sendJson(res, { code: 400, msg: '请输入要修改的导演名称或主角名称' });
    }

    if (pool && (userId || openid)) {
      try {
        const setParts = [];
        const params = [];
        if (nickname) {
          setParts.push('nickname = ?');
          params.push(nickname.slice(0, 32));
        }
        if (customActorName) {
          setParts.push('custom_actor_name = ?');
          params.push(customActorName.slice(0, 32));
        }
        setParts.push('update_time = NOW()');
        params.push(userId, openid);
        await pool.query(`UPDATE dj_user SET ${setParts.join(', ')} WHERE user_id = ? OR wx_openid = ?`, params);
      } catch (e) {
        console.warn('[MySQL Update Profile Error]:', e.message);
      }
    }
    if (openid && db.users[openid]) {
      if (nickname) db.users[openid].nickname = nickname.slice(0, 32);
      if (customActorName) db.users[openid].customActorName = customActorName.slice(0, 32);
      saveDb();
    }
    return sendJson(res, { code: 200, msg: '资料更新成功', data: { nickname, customActorName } });
  }

  // =========================================================================
  // 五、 用户剧本拍摄进度与断点续拍系统 (/app-api/duanju/progress/**)
  // =========================================================================

  // 1. 获取当前用户所有剧本拍摄进度档期列表
  if ((pathname === '/app-api/duanju/progress/list' || pathname === '/duanju/progress/list') && req.method === 'GET') {
    const userId = Number(query.userId) || 0;
    const openid = (query.openid || '').trim();

    if (pool && (userId || openid)) {
      try {
        const [rows] = await pool.query(
          `SELECT id, user_id as userId, wx_openid as openid, script_id as scriptId, script_title as scriptTitle,
                  current_episode as currentEpisode, current_panel as currentPanel, history_choices_json as historyChoicesJson,
                  current_stats_json as currentStatsJson, is_finished as isFinished, finish_score as finishScore,
                  finish_box_office as finishBoxOffice, last_shoot_time as lastShootTime
           FROM dj_user_progress
           WHERE ((? > 0 AND user_id = ?) OR (wx_openid <> "" AND wx_openid = ?)) AND del_flag = "0"
           ORDER BY last_shoot_time DESC`,
          [userId, userId, openid]
        );
        const parsedRows = rows.map((r) => {
          let historyChoices = [];
          let currentStats = { pleasure: 10, drama: 25, anger: 10, evidence: 0, subversion: 0 };
          try { if (r.historyChoicesJson) historyChoices = JSON.parse(r.historyChoicesJson); } catch (e) {}
          try { if (r.currentStatsJson) currentStats = JSON.parse(r.currentStatsJson); } catch (e) {}
          return {
            ...r,
            historyChoices,
            currentStats
          };
        });
        return sendJson(res, { code: 200, msg: '查询成功', rows: parsedRows, total: parsedRows.length });
      } catch (e) {
        console.warn('[MySQL Progress List Error]:', e.message);
      }
    }

    const rows = (userId || openid)
      ? (db.progress || []).filter((p) => (userId > 0 && String(p.userId) === String(userId)) || (openid && p.openid === openid))
      : [];
    return sendJson(res, { code: 200, msg: '查询成功', rows, total: rows.length });
  }

  // 2. 获取指定剧本的当前拍摄存档点
  if ((pathname === '/app-api/duanju/progress/get' || pathname === '/duanju/progress/get') && req.method === 'GET') {
    const userId = Number(query.userId) || 0;
    const openid = (query.openid || '').trim();
    const scriptId = query.scriptId || 'script_02_qianjin';

    if (pool && (userId || openid)) {
      try {
        const [rows] = await pool.query(
          `SELECT id, user_id as userId, wx_openid as openid, script_id as scriptId, script_title as scriptTitle,
                  current_episode as currentEpisode, current_panel as currentPanel, history_choices_json as historyChoicesJson,
                  current_stats_json as currentStatsJson, is_finished as isFinished, finish_score as finishScore,
                  finish_box_office as finishBoxOffice, last_shoot_time as lastShootTime
           FROM dj_user_progress
           WHERE ((? > 0 AND user_id = ?) OR (wx_openid <> "" AND wx_openid = ?)) AND (script_id = ? OR script_id LIKE ?) AND del_flag = "0"
           ORDER BY last_shoot_time DESC LIMIT 1`,
          [userId, userId, openid, scriptId, `%${scriptId}%`]
        );
        if (rows && rows.length > 0) {
          const r = rows[0];
          let historyChoices = [];
          let currentStats = { pleasure: 10, drama: 25, anger: 10, evidence: 0, subversion: 0 };
          try { if (r.historyChoicesJson) historyChoices = JSON.parse(r.historyChoicesJson); } catch (e) {}
          try { if (r.currentStatsJson) currentStats = JSON.parse(r.currentStatsJson); } catch (e) {}
          return sendJson(res, {
            code: 200,
            msg: '获取拍摄进度成功',
            data: {
              ...r,
              historyChoices,
              currentStats
            }
          });
        }
      } catch (e) {
        console.warn('[MySQL Progress Get Error]:', e.message);
      }
    }

    const item = (userId || openid)
      ? (db.progress || []).find((p) => ((userId > 0 && String(p.userId) === String(userId)) || (openid && p.openid === openid)) && (p.scriptId === scriptId || p.scriptId.includes(scriptId)))
      : null;
    return sendJson(res, { code: 200, msg: '获取拍摄进度成功', data: item || null });
  }

  // 3. 实时自动保存/更新拍摄进度存档点 (断点续拍)
  if ((pathname === '/app-api/duanju/progress/save' || pathname === '/duanju/progress/save') && req.method === 'POST') {
    const body = await parseBody(req);
    const userId = Number(body.userId) || 0;
    const openid = (body.openid || '').trim();
    if (!userId && !openid) {
      return sendJson(res, { code: 400, msg: '缺少用户标识，请先登录' }, 400);
    }
    const scriptId = body.scriptId || 'script_02_qianjin';
    const scriptTitle = body.scriptTitle || '';
    const currentEpisode = Number(body.currentEpisode) || 1;
    const currentPanel = Number(body.currentPanel) || 0;
    const historyChoices = Array.isArray(body.historyChoices) ? body.historyChoices : [];
    const currentStats = body.currentStats || { pleasure: 10, drama: 25, anger: 10, evidence: 0, subversion: 0 };
    const isFinished = body.isFinished === '1' || body.isFinished === true ? '1' : '0';
    const finishScore = body.finishScore !== undefined ? Number(body.finishScore) : null;
    const finishBoxOffice = body.finishBoxOffice !== undefined ? Number(body.finishBoxOffice) : null;

    if (pool) {
      try {
        await pool.query(
          `INSERT INTO dj_user_progress (user_id, wx_openid, script_id, script_title, current_episode, current_panel, history_choices_json, current_stats_json, is_finished, finish_score, finish_box_office, last_shoot_time, create_time, del_flag)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), "0")
           ON DUPLICATE KEY UPDATE 
             script_title = VALUES(script_title),
             current_episode = VALUES(current_episode),
             current_panel = VALUES(current_panel),
             history_choices_json = VALUES(history_choices_json),
             current_stats_json = VALUES(current_stats_json),
             is_finished = VALUES(is_finished),
             finish_score = VALUES(finish_score),
             finish_box_office = VALUES(finish_box_office),
             last_shoot_time = NOW(),
             update_time = NOW()`,
          [userId, openid, scriptId, scriptTitle, currentEpisode, currentPanel, JSON.stringify(historyChoices), JSON.stringify(currentStats), isFinished, finishScore, finishBoxOffice]
        );
      } catch (e) {
        console.warn('[MySQL Save Progress Error]:', e.message);
      }
    }

    // 内存同步
    if (!Array.isArray(db.progress)) db.progress = [];
    const pIdx = db.progress.findIndex((p) => ((userId > 0 && String(p.userId) === String(userId)) || (openid && p.openid === openid)) && p.scriptId === scriptId);
    const progressEntry = {
      id: pIdx >= 0 ? db.progress[pIdx].id : Date.now(),
      userId,
      openid,
      scriptId,
      scriptTitle,
      currentEpisode,
      currentPanel,
      historyChoices,
      currentStats,
      isFinished,
      finishScore,
      finishBoxOffice,
      lastShootTime: nowStr()
    };
    if (pIdx >= 0) {
      db.progress[pIdx] = progressEntry;
    } else {
      db.progress.push(progressEntry);
    }
    saveDb();

    return sendJson(res, {
      code: 200,
      msg: '拍摄进度已保存',
      data: progressEntry
    });
  }

  // 4. 重置/重开剧本拍摄进度
  if ((pathname === '/app-api/duanju/progress/reset' || pathname === '/duanju/progress/reset') && req.method === 'POST') {
    const body = await parseBody(req);
    const userId = Number(body.userId) || 0;
    const openid = (body.openid || '').trim();
    const scriptId = body.scriptId || 'script_02_qianjin';

    if (pool && (userId || openid)) {
      try {
        await pool.query(
          `UPDATE dj_user_progress 
           SET current_episode = 1, current_panel = 0, history_choices_json = "[]",
               current_stats_json = '{"pleasure":10,"drama":25,"anger":10,"evidence":0,"subversion":0}',
               is_finished = "0", finish_score = NULL, finish_box_office = NULL, last_shoot_time = NOW(), update_time = NOW()
           WHERE ((? > 0 AND user_id = ?) OR (wx_openid <> "" AND wx_openid = ?)) AND script_id = ?`,
          [userId, userId, openid, scriptId]
        );
      } catch (e) {
        console.warn('[MySQL Reset Progress Error]:', e.message);
      }
    }

    if (Array.isArray(db.progress)) {
      const target = db.progress.find((p) => ((userId > 0 && String(p.userId) === String(userId)) || (openid && p.openid === openid)) && p.scriptId === scriptId);
      if (target) {
        target.currentEpisode = 1;
        target.currentPanel = 0;
        target.historyChoices = [];
        target.currentStats = { pleasure: 10, drama: 25, anger: 10, evidence: 0, subversion: 0 };
        target.isFinished = '0';
        target.finishScore = null;
        target.finishBoxOffice = null;
        target.lastShootTime = nowStr();
        saveDb();
      }
    }

    return sendJson(res, { code: 200, msg: '剧本进度已重置，可从第 1 集重新开拍！' });
  }

  // 5. 若依管理后台：全服玩家剧本拍摄进度档期监控 (F-ADM-06)
  if ((pathname === '/duanju/progress/admin/list' || pathname === '/dev-api/duanju/progress/admin/list') && req.method === 'GET') {
    if (pool) {
      try {
        let sql = `
          SELECT p.id, p.user_id as userId, p.wx_openid as openid, u.nickname as nickname, u.user_name as userName,
                 p.script_id as scriptId, p.script_title as scriptTitle, p.current_episode as currentEpisode,
                 p.current_panel as currentPanel, p.is_finished as isFinished, p.finish_score as finishScore,
                 p.finish_box_office as finishBoxOffice, p.last_shoot_time as lastShootTime, p.create_time as createTime
          FROM dj_user_progress p
          LEFT JOIN dj_user u ON p.user_id = u.user_id
          WHERE p.del_flag = "0"
        `;
        const params = [];
        if (query.scriptId) {
          sql += ' AND p.script_id = ?';
          params.push(query.scriptId);
        }
        if (query.isFinished !== undefined && query.isFinished !== '') {
          sql += ' AND p.is_finished = ?';
          params.push(query.isFinished);
        }
        if (query.userName) {
          sql += ' AND (u.user_name LIKE ? OR u.nickname LIKE ?)';
          params.push(`%${query.userName}%`, `%${query.userName}%`);
        }
        sql += ' ORDER BY p.last_shoot_time DESC LIMIT 100';

        const [rows] = await pool.query(sql, params);
        return sendJson(res, { code: 200, msg: '查询成功', rows, total: rows.length });
      } catch (e) {
        console.warn('[MySQL Admin Progress List Error]:', e.message);
      }
    }

    const rows = (db.progress || []).map((p) => ({
      ...p,
      nickname: (db.users[p.openid] && db.users[p.openid].nickname) || '新锐导演',
      userName: (db.users[p.openid] && db.users[p.openid].userName) || p.openid
    }));
    return sendJson(res, { code: 200, msg: '查询成功', rows, total: rows.length });
  }

  return sendJson(res, { code: 404, msg: `接口路径不存在: ${rawPath}` }, 404);
});

server.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`《漫剧大导演》后端 API 服务已启动: http://localhost:${PORT}`);
  console.log(`   - 管理后台接口: http://localhost:${PORT}/dev-api/duanju/...`);
  console.log(`   - 小程序端接口: http://localhost:${PORT}/app-api/duanju/...`);
  console.log(`================================================================`);
});
