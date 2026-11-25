/**
 * 《漫剧大导演》微信小游戏原生 Canvas 2D 渲染引擎 (game.js)
 * 适配微信小游戏 (env: mg) 运行时，100% 纯联网对接后端 MySQL 动态数据
 * 严禁使用任何 Emoji 字符
 */

const API_BASE = 'https://duanju.edisonhuys.xyz';
const sysInfo = (typeof wx !== 'undefined' && wx.getWindowInfo) ? wx.getWindowInfo() : ((typeof wx !== 'undefined' && wx.getSystemInfoSync) ? wx.getSystemInfoSync() : { windowWidth: 390, windowHeight: 844, pixelRatio: 2, statusBarHeight: 44 });
const W = sysInfo.windowWidth || 390;
const H = sysInfo.windowHeight || 844;
const DPR = Math.min(sysInfo.pixelRatio || 2, 3);
const S = W / 390;
const menuRect = (typeof wx !== 'undefined' && wx.getMenuButtonBoundingClientRect) ? wx.getMenuButtonBoundingClientRect() : null;
const SAFE_TOP = (menuRect && menuRect.bottom) ? (menuRect.bottom + 8 * S) : Math.max((sysInfo.statusBarHeight || 24) + 34 * S, 54 * S);
const SAFE_BOTTOM = (sysInfo.safeArea && sysInfo.safeArea.bottom && H > sysInfo.safeArea.bottom)
  ? Math.max(22 * S, H - sysInfo.safeArea.bottom + 6 * S)
  : 28 * S;

const canvas = wx.createCanvas();
canvas.width = W * DPR;
canvas.height = H * DPR;
const ctx = canvas.getContext('2d');
ctx.scale(DPR, DPR);

// 颜色令牌
const COLORS = {
  bg: '#FFF8FA',
  grid: '#F1E4EE',
  navy: '#1E2246',
  pink: '#FF5E8E',
  pinkLight: '#FFE4EE',
  pinkSoft: '#FFF0F5',
  purple: '#7C5CFF',
  purpleLight: '#F3EEFF',
  yellow: '#FFE047',
  yellowSoft: '#FFF9DB',
  cyan: '#38BDF8',
  cyanSoft: '#E0F7FF',
  green: '#22C55E',
  orange: '#F59E0B',
  white: '#FFFFFF',
  textSub: '#5A607F',
  gray: '#94A3B8'
};

// 8 款海报主题配色
const POSTER_THEMES = [
  { name: '波普撞色', bg: '#FFE047', card: '#FFFFFF', accent: '#FF5E8E' },
  { name: '暗夜霓虹', bg: '#1E2246', card: '#FFF0F5', accent: '#38BDF8' },
  { name: '绯红女主', bg: '#FF5E8E', card: '#FFF9DB', accent: '#7C5CFF' },
  { name: '薄荷清爽', bg: '#38BDF8', card: '#FFFFFF', accent: '#22C55E' },
  { name: '紫金王朝', bg: '#7C5CFF', card: '#FFF9DB', accent: '#FFE047' },
  { name: '复古画报', bg: '#F59E0B', card: '#FFF8FA', accent: '#1E2246' },
  { name: '翡翠神医', bg: '#22C55E', card: '#FFFFFF', accent: '#FF5E8E' },
  { name: '鎏金殿堂', bg: '#FACC15', card: '#1E2246', accent: '#FFE047' }
];

// 全局状态（全部业务数据由后端 MySQL 接口实时下发，禁止本地写死数据）
const state = {
  view: 'home', // 'home' | 'episode' | 'report'
  activeModal: null, // null | 'rank' | 'clue' | 'collection' | 'hall' | 'schedule' | 'user' | 'poster' | 'movieShelf' | 'wholeStory' | 'review'
  modalScrollY: 0,
  modalMaxScroll: 0,
  scripts: [],
  leaderboards: [],
  collections: [],
  config: {},
  loadingScripts: true,
  loadError: '',
  currentIndex: 0,
  hasInitDefaultScript: false,
  userId: null,
  openid: '',
  token: '',
  deviceId: '',
  wxLoggedIn: false,
  wxRealAuth: false,
  bestScore: 0,
  totalBoxOffice: 0,
  shootCount: 0,
  directorName: '微信导演',
  actorName: '主角',
  scriptActors: {}, // { scriptId: '自定义主角名' }
  castingScript: null,
  soundOn: true,
  unlockedEndings: {}, // { endingId: true }
  scriptProgress: {}, // { scriptId: { status: 'done'|'doing', epIndex: 0, score: 96, views: '5.06 亿', endingTitle: '', history: [] } }
  // 当前拍摄状态
  curScript: null,
  epIndex: 0,
  panelIndex: 0,
  phase: 'panel', // 'panel' | 'choice' | 'outcome'
  lastOutcomeText: '',
  stats: { pleasure: 15, drama: 25, anger: 10, evidence: 0, subversion: 0 },
  collectedClues: {}, // { 'ep1': true }
  pendingEvidence: null, // 当前集抉择后待点击收取的动态证物热点
  collectedEvidenceEps: [], // 真实点击收取过的集数索引（0-based）
  choiceHistory: [], // [{ ep: 1, epTitle: '', choiceLabel: '', outcome: '' }]
  // 杀青报告状态
  reportData: null,
  rankFilterScriptId: 'ALL',
  posterThemeIdx: 0,
  adBoosted: false,
  touchGuardUntil: 0,
  inputDialog: null,
  keyboardBound: false,
  wholeStoryScriptId: null,
  wholeStoryFromShelf: false,
  viewingFriendMovie: false,
  friendShareMovie: null,
  shareCodeByScript: {},
  lastShareCode: ''
};

function armTouchGuard(ms = 450) {
  state.touchGuardUntil = Date.now() + ms;
}

const STORAGE_SCHEMA_VERSION = 'v2_clean_20261125';

// 初始化本地持久化数据
function loadStorage() {
  try {
    let devId = wx.getStorageSync('MANJU_DEVICE_ID');
    if (!devId) {
      devId = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      wx.setStorageSync('MANJU_DEVICE_ID', devId);
    }
    state.deviceId = String(devId);

    const savedVer = wx.getStorageSync('MANJU_STORAGE_VER');
    if (savedVer !== STORAGE_SCHEMA_VERSION) {
      ['MANJU_UNLOCKED_ENDINGS', 'MANJU_SCRIPT_PROGRESS', 'MANJU_DIRECTOR_NAME', 'MANJU_USER_ID', 'MANJU_OPENID'].forEach((k) => {
        try { wx.removeStorageSync(k); } catch (err) {}
      });
      state.unlockedEndings = {};
      state.scriptProgress = {};
      state.directorName = '微信导演';
      state.userId = 0;
      state.openid = '';
      wx.setStorageSync('MANJU_STORAGE_VER', STORAGE_SCHEMA_VERSION);
    } else {
      const savedUserId = wx.getStorageSync('MANJU_USER_ID');
      if (savedUserId) state.userId = Number(savedUserId);
      const savedOpenid = wx.getStorageSync('MANJU_OPENID');
      if (savedOpenid) state.openid = String(savedOpenid);

      const savedEndings = wx.getStorageSync('MANJU_UNLOCKED_ENDINGS');
      if (savedEndings && typeof savedEndings === 'object') {
        state.unlockedEndings = savedEndings;
      } else {
        state.unlockedEndings = {};
      }
      const savedProg = wx.getStorageSync('MANJU_SCRIPT_PROGRESS');
      if (savedProg && typeof savedProg === 'object') {
        state.scriptProgress = savedProg;
      }
      const savedDirector = wx.getStorageSync('MANJU_DIRECTOR_NAME');
      if (savedDirector && savedDirector !== '新锐导演阿强' && savedDirector !== '歪嘴战神阿强') {
        state.directorName = savedDirector;
      } else {
        state.directorName = '微信导演';
      }
      const savedActors = wx.getStorageSync('MANJU_SCRIPT_ACTORS');
      if (savedActors && typeof savedActors === 'object') {
        state.scriptActors = savedActors;
      }
    }
    const savedSound = wx.getStorageSync('MANJU_SOUND_ON');
    if (typeof savedSound === 'boolean') state.soundOn = savedSound;
  } catch (e) {}
}

function saveStorage() {
  try {
    wx.setStorageSync('MANJU_STORAGE_VER', STORAGE_SCHEMA_VERSION);
    if (state.deviceId) wx.setStorageSync('MANJU_DEVICE_ID', state.deviceId);
    if (state.userId) wx.setStorageSync('MANJU_USER_ID', state.userId);
    if (state.openid) wx.setStorageSync('MANJU_OPENID', state.openid);
    wx.setStorageSync('MANJU_UNLOCKED_ENDINGS', state.unlockedEndings);
    wx.setStorageSync('MANJU_SCRIPT_PROGRESS', state.scriptProgress);
    wx.setStorageSync('MANJU_DIRECTOR_NAME', state.directorName);
    wx.setStorageSync('MANJU_SCRIPT_ACTORS', state.scriptActors);
    wx.setStorageSync('MANJU_SOUND_ON', state.soundOn);
  } catch (e) {}
}

// 基于后端下发的剧本剧情与分镜对话动态解析主角定位、对手与盟友（严禁写死静态档案）
const _parsedRoleCache = {};
const _ROLE_STOPWORDS = /^(旁白|原著旁白|系统|机械音|主持人|众人|保安|网友|观众|邻居|亲戚|大家|店员|快递员|服务员|老板|大屏|手机|广播|弹幕|横幅|老街|其实|原来|今天|明天|昨天|此时|这时|门外|门口|正厅|楼下|里面|外面|上面|下面|前面|后面|对方|那人|有人|没人|别人|谁知|结果|最后|突然|忽然|随即|接着|于是|然后|虽然|但是|不过|如果|因为|所以|甚至|居然|竟然|冷笑|冷着|松了|齐声|满墙|司机|司仪|他把|她把|你把|小声|小字)$/;
const _ROLE_SURNAME_RE = /^[赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕安常乐于时傅皮齐康伍余元顾孟平黄穆萧尹姚邵湛汪祁毛狄米贝明臧计成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝席季麻强贾路娄江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍万支卢莫房干解应丁宣邓单杭洪包诸石崔吉钮龚程邢裴陆荣翁荀羊惠甄闻曲团阿老]/;
const _ROLE_TITLE_RE = /(管事|少东|师傅|账房|老师|特助|表亲|阿姨|馆主|总管|掌勺|书官|记录|管家|策划|律师)$/;
const _VILLAIN_CUE_RE = /刁难|歪嘴|冷笑|冷哼|斥|轰|逼|抢|偷|删|推脱|威胁|不配|算计|滚|摔|拦|抢走|假冒|克扣|炫耀|强迫|讽刺|嘲|淬毒|把你|逼签|甩出/;
const _ALLY_CUE_RE = /凑到|悄悄|递来|帮你|帮手|提醒|支持|点头|落款|核验|护住|安慰|并排/;

function getScriptRoleProfile(script) {
  const sid = (script && script.scriptId) || '';
  const epLen = (script && Array.isArray(script.episodes)) ? script.episodes.length : 0;
  const cacheKey = `${sid}:${epLen}`;
  if (sid && _parsedRoleCache[cacheKey]) return _parsedRoleCache[cacheKey];

  const defActor = (script && script.defaultProtagonist) || '主角';
  const charStats = {};
  const addMention = (name, sentence, weight = 1) => {
    if (!name || name.length < 2 || name === defActor || _ROLE_STOPWORDS.test(name) || /^[你她他我它这那和被把让给向从到在]/.test(name)) return;
    if (!_ROLE_SURNAME_RE.test(name) && !_ROLE_TITLE_RE.test(name)) return;
    if (!charStats[name]) charStats[name] = { count: 0, villainScore: 0, allyScore: 0 };
    charStats[name].count += weight;
    if (_VILLAIN_CUE_RE.test(sentence)) charStats[name].villainScore += 1;
    if (_ALLY_CUE_RE.test(sentence)) charStats[name].allyScore += 1;
  };

  const reBeforeParen = /(?:^|[，）\s」])([\u4e00-\u9fa5]{2,4})(?=（[^）]{1,28}）[：:]\s*「)/g;
  const reBeforeColon = /(?:^|[，）\s」])([\u4e00-\u9fa5]{2,3})(?=[：:]\s*「)/g;
  const reRoleTitle = /([\u4e00-\u9fa5]{1,2}(?:管事|少东|师傅|账房|老师|特助|表亲|阿姨|馆主|总管|掌勺|书官|记录|管家|策划|律师))/g;
  const reNickname = /([老阿][\u4e00-\u9fa5])(?=[：:（凑踮眨压笑说递拿站低抬一])/g;

  ((script && script.episodes) || []).forEach((ep) => {
    const texts = [];
    (ep.panels || []).forEach((p) => texts.push(typeof p === 'string' ? p : (p.text || '')));
    (ep.choices || []).forEach((c) => texts.push(c.outcome || c.feedback || ''));
    texts.forEach((raw) => {
      String(raw || '').split(/[。！？\n]+/).forEach((sent) => {
        let m;
        reBeforeParen.lastIndex = 0;
        while ((m = reBeforeParen.exec(sent)) !== null) addMention(m[1], sent, 2);
        reBeforeColon.lastIndex = 0;
        while ((m = reBeforeColon.exec(sent)) !== null) addMention(m[1], sent, 2);
        reRoleTitle.lastIndex = 0;
        while ((m = reRoleTitle.exec(sent)) !== null) addMention(m[1], sent, 1);
        reNickname.lastIndex = 0;
        while ((m = reNickname.exec(sent)) !== null) addMention(m[1], sent, 2);
      });
    });
  });

  const keys = Object.keys(charStats).filter((k) => charStats[k].count >= 2);
  const deduped = keys.filter((k) => !keys.some((other) => other !== k && (other.startsWith(k) || other.endsWith(k)) && charStats[other].count >= 2));
  const sortedNames = deduped.sort((a, b) => charStats[b].count - charStats[a].count).slice(0, 6);
  const villains = [];
  const allies = [];
  sortedNames.forEach((n) => {
    const st = charStats[n];
    if (st.villainScore > 0 && st.villainScore >= st.allyScore) {
      villains.push(n);
    } else {
      allies.push(n);
    }
  });

  const oppParts = [];
  if (villains.length > 0) oppParts.push(`交锋人物：${villains.slice(0, 3).join('、')}`);
  if (allies.length > 0) oppParts.push(`关键角色：${allies.slice(0, 4).join('、')}`);

  const profile = {
    roleTitle: (script && script.tag) || `${defActor}视角`,
    defaultActor: defActor,
    intro: (script && (script.synopsis || script.subtitle)) || '你将以本剧主角视角亲自拍板，决定每集剧情走向。',
    opponents: oppParts.join(' ｜ ') || '注意分辨场上立场与台词线索，每集由你拍板决定走向。',
    nameAliases: (defActor && defActor !== '主角') ? [defActor] : [],
    villains,
    allies,
    allCharacters: sortedNames
  };
  if (sid && epLen > 0) {
    _parsedRoleCache[cacheKey] = profile;
  }
  return profile;
}

// 动态获取每集线索/案卷名称（优先使用服务端下发字段，否则依据后端剧集标题动态生成）
function getEpisodeClueName(script, epIdx) {
  const ep = (script && script.episodes && script.episodes[epIdx]) || null;
  if (ep && (ep.clueName || ep.clueTitle)) return String(ep.clueName || ep.clueTitle);
  const num = Number(epIdx || 0) + 1;
  const rawTitle = ep && ep.title ? String(ep.title).replace(/^第\s*\d+\s*集\s*[：:]\s*/, '') : `第 ${num} 幕现场`;
  return `第${num}集案卷：${rawTitle}`;
}

function getScriptActorName(script) {
  const sid = script && script.scriptId;
  const profile = getScriptRoleProfile(script);
  const custom = (sid && state.scriptActors && state.scriptActors[sid]) ? String(state.scriptActors[sid]).trim() : '';
  return custom || (script && script.defaultProtagonist) || profile.defaultActor || '主角';
}

function syncProfileToBackend(payload) {
  if (typeof wx === 'undefined' || !wx.request || (!state.userId && !state.openid)) return;
  wx.request({
    url: API_BASE + '/app-api/duanju/auth/updateProfile',
    method: 'POST',
    header: { 'Content-Type': 'application/json' },
    data: Object.assign({ userId: state.userId || 0, openid: state.openid || '' }, payload || {})
  });
}

function bindMiniGameKeyboard() {
  if (state.keyboardBound || typeof wx === 'undefined') return;
  state.keyboardBound = true;
  if (typeof wx.onKeyboardInput === 'function') {
    wx.onKeyboardInput((res) => {
      if (!state.inputDialog || state.activeModal !== 'inputDialog') return;
      const maxLen = state.inputDialog.maxLength || 12;
      state.inputDialog.value = String((res && res.value) || '').slice(0, maxLen);
      requestRender();
    });
  }
  if (typeof wx.onKeyboardConfirm === 'function') {
    wx.onKeyboardConfirm((res) => {
      if (!state.inputDialog || state.activeModal !== 'inputDialog') return;
      if (res && typeof res.value === 'string') {
        state.inputDialog.value = res.value.slice(0, state.inputDialog.maxLength || 12);
      }
      state.inputDialog.focused = false;
      hideInputKeyboard();
      requestRender();
    });
  }
  if (typeof wx.onKeyboardComplete === 'function') {
    wx.onKeyboardComplete((res) => {
      if (!state.inputDialog || state.activeModal !== 'inputDialog') return;
      if (res && typeof res.value === 'string') {
        state.inputDialog.value = res.value.slice(0, state.inputDialog.maxLength || 12);
      }
      state.inputDialog.focused = false;
      requestRender();
    });
  }
}

function showInputKeyboard(defaultValue, maxLength) {
  if (state.inputDialog) {
    state.inputDialog.focused = true;
    requestRender();
  }
  if (typeof wx === 'undefined' || typeof wx.showKeyboard !== 'function') return;
  try {
    wx.showKeyboard({
      defaultValue: String(defaultValue || ''),
      maxLength: Number(maxLength) || 12,
      multiple: false,
      confirmHold: false,
      confirmType: 'done'
    });
  } catch (e) {}
}

function hideInputKeyboard() {
  if (state.inputDialog) {
    state.inputDialog.focused = false;
  }
  if (typeof wx !== 'undefined' && typeof wx.hideKeyboard === 'function') {
    try { wx.hideKeyboard(); } catch (e) {}
  }
}

function openPopInputDialog(opts) {
  bindMiniGameKeyboard();
  const returnModal = (state.activeModal && state.activeModal !== 'inputDialog') ? state.activeModal : null;
  state.inputDialog = {
    mode: (opts && opts.mode) || 'text',
    title: (opts && opts.title) || '编辑名称',
    subtitle: (opts && opts.subtitle) || '',
    value: String((opts && opts.defaultValue) || ''),
    defaultResetValue: (opts && opts.defaultResetValue) ? String(opts.defaultResetValue) : '',
    maxLength: Number((opts && opts.maxLength) || 12),
    placeholder: (opts && opts.placeholder) || '点击输入新名称',
    focused: false,
    returnModal,
    onConfirm: opts && opts.onConfirm
  };
  armTouchGuard(240);
  state.activeModal = 'inputDialog';
  requestRender();
}

function closePopInputDialog(restoreModal = true) {
  hideInputKeyboard();
  const ret = state.inputDialog ? state.inputDialog.returnModal : null;
  state.inputDialog = null;
  state.activeModal = restoreModal ? ret : null;
  requestRender();
}

function openEditDirectorNameModal() {
  playFeedback('click');
  openPopInputDialog({
    mode: 'director',
    title: '修改导演名称',
    subtitle: '请输入新的导演名称：',
    defaultValue: state.directorName || '微信导演',
    maxLength: 12,
    placeholder: '点击输入导演名称（1-12字）',
    onConfirm(nextName) {
      state.directorName = nextName;
      saveStorage();
      syncProfileToBackend({ nickname: nextName });
      toast(`导演名称已修改：${nextName}`);
    }
  });
}

function openEditActorNameModal(script) {
  const sc = script || state.curScript || getCurrentScript();
  if (!sc) return;
  playFeedback('click');
  const profile = getScriptRoleProfile(sc);
  const curActor = getScriptActorName(sc);
  const defActor = sc.defaultProtagonist || profile.defaultActor || '主角';
  openPopInputDialog({
    mode: 'actor',
    title: '修改主演名称',
    subtitle: `请输入《${sc.title}》的主演名称：`,
    defaultValue: curActor,
    defaultResetValue: defActor,
    maxLength: 10,
    placeholder: '点击输入本剧主演姓名',
    onConfirm(nextActor) {
      if (!state.scriptActors || typeof state.scriptActors !== 'object') {
        state.scriptActors = {};
      }
      state.scriptActors[sc.scriptId] = nextActor;
      state.actorName = nextActor;
      saveStorage();
      syncProfileToBackend({ customActorName: nextActor });
      toast(`《${sc.title}》主演已修改为：${nextActor}`);
    }
  });
}

function openMovieShelfModal() {
  state.viewingFriendMovie = false;
  state.wholeStoryFromShelf = false;
  state.activeModal = 'movieShelf';
  state.modalScrollY = 0;
  armTouchGuard(200);
  requestRender();
  syncUserCloudData();
}

function openWholeStoryModal(opts = {}) {
  const fromFriend = Boolean(opts && opts.fromFriend);
  state.viewingFriendMovie = fromFriend;
  state.wholeStoryFromShelf = Boolean(opts && opts.fromShelf && !fromFriend);
  if (!fromFriend) {
    const targetSc = opts.script || (opts.scriptId && state.scripts.find((s) => s.scriptId === opts.scriptId)) || state.curScript || getCurrentScript();
    state.wholeStoryScriptId = targetSc ? targetSc.scriptId : null;
  }
  state.activeModal = 'wholeStory';
  state.modalScrollY = 0;
  armTouchGuard(200);
  requestRender();
}

function saveShareMovieSnapshot(script, rep, choiceHistory, actorName, onDone) {
  if (typeof wx === 'undefined' || !wx.request || !script || !rep) {
    if (onDone) onDone('');
    return;
  }
  wx.request({
    url: API_BASE + '/app-api/duanju/share/save',
    method: 'POST',
    header: { 'Content-Type': 'application/json' },
    data: {
      userId: state.userId || 0,
      openid: state.openid || '',
      nickname: state.directorName || '微信导演',
      actorName: actorName || getScriptActorName(script),
      scriptId: script.scriptId,
      scriptTitle: script.title,
      endingId: rep.endingId || '',
      endingTitle: rep.endingTitle || '',
      endingText: rep.endingText || '',
      qualityScore: Number(rep.score) || 0,
      boxOffice: rep.viewsText || '0 亿',
      historyChoices: Array.isArray(choiceHistory) ? choiceHistory : []
    },
    success(res) {
      const code = res.data && res.data.data && res.data.data.shareCode;
      if (code) {
        if (!state.shareCodeByScript || typeof state.shareCodeByScript !== 'object') state.shareCodeByScript = {};
        state.shareCodeByScript[script.scriptId] = code;
        state.lastShareCode = code;
      }
      if (onDone) onDone(code || '');
    },
    fail() {
      if (onDone) onDone('');
    }
  });
}

function triggerShareFullMovie(targetScript) {
  const sc = targetScript || state.curScript || getCurrentScript();
  if (!sc) return;
  const rep = (state.reportData && state.reportData.scriptId === sc.scriptId) ? state.reportData : null;
  const prog = state.scriptProgress[sc.scriptId];
  const scoreTxt = (rep && rep.score) || (prog && prog.score) || '85.00';
  const viewsTxt = (rep && rep.viewsText) || (prog && prog.views) || '3.20 亿';
  const imgRel = String(sc.coverImage || '/static/art/covers/cover-dragon.jpg').replace(/^\//, '');
  const doWxShare = (shareCode) => {
    const shareTitle = `我在《漫剧大导演》拍出 ${scoreTxt} 分《${sc.title}》，点击观看完整全集！`;
    const queryStr = shareCode ? `shareCode=${encodeURIComponent(shareCode)}` : `scriptId=${encodeURIComponent(sc.scriptId)}`;
    if (typeof wx !== 'undefined' && typeof wx.shareAppMessage === 'function') {
      wx.shareAppMessage({
        title: shareTitle,
        query: queryStr,
        imageUrl: imgRel
      });
    } else {
      toast('已生成完整成片分享卡片！');
    }
  };

  const cachedCode = state.shareCodeByScript && state.shareCodeByScript[sc.scriptId];
  if (cachedCode) {
    doWxShare(cachedCode);
    return;
  }
  const fallbackRep = rep || {
    endingId: (prog && prog.endingId) || '',
    endingTitle: (prog && prog.endingTitle) || '已杀青完结',
    endingText: (prog && prog.endingText) || '',
    score: scoreTxt,
    viewsText: viewsTxt
  };
  const fallbackHist = (prog && Array.isArray(prog.history) && prog.history.length > 0) ? prog.history : state.choiceHistory;
  saveShareMovieSnapshot(sc, fallbackRep, fallbackHist, getScriptActorName(sc), (code) => {
    doWxShare(code);
  });
}

function checkIncomingShare(queryObj) {
  const shareCode = queryObj && (queryObj.shareCode || queryObj.recordId);
  if (!shareCode || typeof wx === 'undefined' || !wx.request) return;
  wx.request({
    url: API_BASE + '/app-api/duanju/share/detail?shareCode=' + encodeURIComponent(shareCode),
    method: 'GET',
    success(res) {
      if (res.data && res.data.code === 200 && res.data.data) {
        state.friendShareMovie = res.data.data;
        state.lastShareCode = String(shareCode);
        openWholeStoryModal({ fromFriend: true });
      }
    }
  });
}

function openCastingModal(script) {
  const sc = script || getCurrentScript();
  if (!sc) return;
  playFeedback('click');
  armTouchGuard(450);
  state.castingScript = sc;
  state.actorName = getScriptActorName(sc);
  state.activeModal = 'casting';
  state.modalScrollY = 0;
  requestRender();
}

function formatStoryDialogue(rawText, script, overrideActorName) {
  let txt = String(rawText || '');
  const sc = script || state.curScript || getCurrentScript();
  const actorName = overrideActorName || getScriptActorName(sc);
  const profile = getScriptRoleProfile(sc);
  txt = txt.replace(/\{actor\}|\{protagonist\}/gi, actorName);
  if (Array.isArray(profile.nameAliases)) {
    profile.nameAliases.forEach((alias) => {
      if (alias && alias !== actorName) {
        txt = txt.split(alias).join(actorName);
      }
    });
  }
  if (!actorName) return txt;

  // 仅在引号外（旁白/动作描写）将单数主角代词「你」替换为自定义主演名；引号内对话保持原样以免混淆对话对象
  let out = '';
  let inQuote = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (ch === '「' || ch === '“') {
      inQuote = true;
      out += ch;
      continue;
    }
    if (ch === '」' || ch === '”') {
      inQuote = false;
      out += ch;
      continue;
    }
    if (!inQuote && ch === '你') {
      const prev = i > 0 ? txt[i - 1] : '';
      const next = i + 1 < txt.length ? txt[i + 1] : '';
      // 保护复数词与固定词（你们、你俩、你位、你我、你她、你他、你好、迷你），其余单数主角全部代入主演名
      if (prev !== '迷' && !/[们俩位我她他好]/.test(next)) {
        out += actorName;
        continue;
      }
    }
    out += ch;
  }
  return out;
}

function detectDialogueSpeaker(rawText, script, phase, overrideActorName) {
  const sc = script || state.curScript || getCurrentScript();
  const profile = getScriptRoleProfile(sc);
  const actorName = overrideActorName || getScriptActorName(sc);
  if (phase === 'outcome') {
    return {
      label: `拍板结果 · ${actorName}`,
      bg: COLORS.pink,
      fg: COLORS.white
    };
  }
  const clean = String(rawText || '').trim();
  if (!clean.startsWith('你') && !(actorName && clean.startsWith(actorName))) {
    const headMatch = clean.match(/^([\u4e00-\u9fa5]{2,5})(?:（[^）]{1,28}）|[^，。！？\n]{0,14})?[：:]\s*「/);
    if (headMatch && headMatch[1] && !headMatch[1].startsWith('你')) {
      return { label: `${headMatch[1]} 发言`, bg: '#312E81', fg: COLORS.white };
    }
    const chars = Array.isArray(profile.allCharacters) ? profile.allCharacters : [];
    for (let cIdx = 0; cIdx < chars.length; cIdx++) {
      const chName = chars[cIdx];
      if (!chName) continue;
      const inlineReg = new RegExp(`${escapeRegExp(chName)}(?:（[^）]{0,24}）)?[：:]\\s*「`);
      if (inlineReg.test(clean)) {
        return { label: `${chName} 出场`, bg: '#312E81', fg: COLORS.white };
      }
    }
    const fallbackMatch = clean.match(/[。！？\n]([\u4e00-\u9fa5]{2,4})(?:（[^）]{0,24}）)?[：:]\s*「/);
    if (fallbackMatch && fallbackMatch[1] && !fallbackMatch[1].startsWith('你')) {
      return { label: `${fallbackMatch[1]} 出场`, bg: '#312E81', fg: COLORS.white };
    }
  }
  return {
    label: `主演 · ${actorName}`,
    bg: COLORS.yellow,
    fg: COLORS.navy
  };
}

function formatChoiceDirection(ch) {
  const tag = String((ch && ch.styleTag) || '').trim();
  const eff = (ch && ch.effects) || {};
  let styleLabel = tag || '剧情推进';
  let styleBg = COLORS.cyanSoft;
  let styleFg = COLORS.navy;

  if (tag === '经典套路') {
    styleLabel = '经典套路 · 稳健查证';
    styleBg = COLORS.cyanSoft;
    styleFg = COLORS.navy;
  } else if (tag === '离谱反套路') {
    styleLabel = '离谱反套路 · 高能整活';
    styleBg = COLORS.pink;
    styleFg = COLORS.white;
  } else if (tag === '打工人觉醒') {
    styleLabel = '打工人觉醒 · 反卷破局';
    styleBg = COLORS.yellow;
    styleFg = COLORS.navy;
  }

  const hints = [];
  if (Number(eff.evidence || 0) > 0) hints.push(`搜证+${eff.evidence}`);
  if (Number(eff.subversion || 0) > 0) hints.push(`拆套路+${eff.subversion}`);
  if (Number(eff.pleasure || 0) > 0) hints.push(`爽点+${eff.pleasure}`);
  if (Number(eff.drama || 0) > 0) hints.push(`戏剧+${eff.drama}`);
  if (Number(eff.anger || 0) > 0) hints.push(`反派怒+${eff.anger}`);
  else if (Number(eff.anger || 0) < 0) hints.push('降怒气');

  return {
    styleLabel,
    styleBg,
    styleFg,
    effectSummary: hints.slice(0, 2).join(' · ') || '推动本集收官走向'
  };
}

// 图片缓存池（统一转为真机 100% 兼容的 .jpg，失败后依次回退 HTTP 与兜底封面）
const imgCache = {};
function normalizeImgPath(srcPath) {
  return String(srcPath || '').trim().replace(/\.webp(\?.*)?$/i, '.jpg');
}
function getImage(srcPath) {
  const normalized = normalizeImgPath(srcPath);
  if (!normalized) return null;
  if (imgCache[normalized]) return imgCache[normalized].loaded ? imgCache[normalized].img : null;

  const entry = { img: wx.createImage(), loaded: false, triedHttp: false, triedFallback: false };
  imgCache[normalized] = entry;

  const cleanLocal = normalized.replace(/^\//, '');
  entry.img.onload = () => {
    entry.loaded = true;
    requestRender();
  };
  entry.img.onerror = () => {
    if (!entry.triedHttp && !normalized.startsWith('http')) {
      entry.triedHttp = true;
      entry.img.src = API_BASE + (normalized.startsWith('/') ? normalized : '/' + normalized);
    } else if (!entry.triedFallback) {
      entry.triedFallback = true;
      entry.img.src = 'static/art/covers/cover-dragon.jpg';
    }
  };
  entry.img.src = normalized.startsWith('http') ? normalized : cleanLocal;
  return null;
}

// 统一按“主推剧本优先 -> 后台排序序号”整理剧本列表，并对齐 Web 版默认选中第 2 个主推剧目居中逻辑
function applyOrderedScripts(rawScripts, isInitialBoot = false) {
  if (!Array.isArray(rawScripts) || rawScripts.length === 0) return;
  const activeScript = state.scripts[state.currentIndex];
  const activeScriptId = activeScript ? activeScript.scriptId : null;

  const sorted = rawScripts
    .map((s, idx) => Object.assign({}, s, {
      recommend: Boolean(s && (s.recommend === true || s.recommend === '1' || s.recommend === 1)),
      sortOrder: Number(s && s.sortOrder) || (idx + 1)
    }))
    .sort((a, b) => {
      const recDiff = (b.recommend ? 1 : 0) - (a.recommend ? 1 : 0);
      if (recDiff !== 0) return recDiff;
      return (Number(a.sortOrder) || 999) - (Number(b.sortOrder) || 999);
    });

  state.scripts = sorted;

  if (isInitialBoot || !state.hasInitDefaultScript) {
    state.hasInitDefaultScript = true;
    const recCount = sorted.filter((s) => s.recommend).length;
    if (recCount >= 2) {
      state.currentIndex = 1;
    } else if (recCount === 1) {
      state.currentIndex = 0;
    } else {
      state.currentIndex = sorted.length > 1 ? 1 : 0;
    }
  } else if (activeScriptId) {
    const newIdx = sorted.findIndex((s) => s.scriptId === activeScriptId);
    state.currentIndex = newIdx >= 0 ? newIdx : 0;
  } else if (state.currentIndex >= sorted.length) {
    state.currentIndex = 0;
  }
}

// 从后端 MySQL 实时同步最新剧本、图鉴配置、全局设置与排行榜
function syncFromBackend() {
  if (typeof wx === 'undefined' || !wx.request) return;
  state.loadingScripts = true;
  state.loadError = '';
  const openidQuery = state.openid ? `?openid=${encodeURIComponent(state.openid)}` : '';
  wx.request({
    url: API_BASE + '/app-api/duanju/bootstrap' + openidQuery,
    method: 'GET',
    success(res) {
      state.loadingScripts = false;
      if (res.data && res.data.code === 200 && res.data.data && Array.isArray(res.data.data.scripts) && res.data.data.scripts.length > 0) {
        state.loadError = '';
        if (res.data.data.config) state.config = res.data.data.config;
        if (Array.isArray(res.data.data.collections)) state.collections = res.data.data.collections;
        applyOrderedScripts(res.data.data.scripts, !state.hasInitDefaultScript);
        requestRender();
      } else {
        state.loadError = (res.data && res.data.msg) || '服务器暂未返回有效剧本';
        requestRender();
      }
    },
    fail() {
      state.loadingScripts = false;
      if (!state.scripts || state.scripts.length === 0) {
        state.loadError = '无法连接到后端服务器，请确认网络与后端服务已启动';
      }
      requestRender();
    }
  });
  wx.request({
    url: API_BASE + '/duanju/leaderboard/list?status=0',
    method: 'GET',
    success(res) {
      const rows = (res.data && res.data.rows) || (res.data && res.data.data && res.data.data.rows);
      if (Array.isArray(rows)) {
        state.leaderboards = rows;
        requestRender();
      }
    },
    fail() {}
  });
}

// 微信小游戏登录与云端档期/图鉴同步
function wxLoginAndSync(manualNotify = false) {
  if (typeof wx === 'undefined' || !wx.request) return;

  const doAuthRequest = (wxCode) => {
    wx.request({
      url: API_BASE + '/app-api/duanju/auth/login',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: {
        loginType: 'wechat',
        code: wxCode || '',
        deviceId: state.deviceId,
        openid: state.openid || '',
        nickname: (state.directorName && state.directorName !== '微信导演') ? state.directorName : ''
      },
      success(res) {
        if (res.data && res.data.code === 200 && res.data.data) {
          const u = res.data.data;
          state.userId = u.userId || state.userId;
          state.openid = u.openid || state.openid;
          state.token = res.data.token || '';
          state.wxLoggedIn = true;
          state.wxRealAuth = Boolean(res.data.wxRealAuth);
          if (u.nickname) state.directorName = u.nickname;
          state.totalBoxOffice = Number(u.totalBoxOffice || 0);
          state.bestScore = Number(u.bestScore || 0);
          state.shootCount = Number(u.shootCount || 0);
          saveStorage();
          syncUserCloudData();
          if (manualNotify) toast(`微信登录已同步：${state.directorName}`);
          requestRender();
        }
      },
      fail() {
        if (manualNotify) toast('无法连接后端服务，请检查网络或IP配置');
      }
    });
  };

  if (typeof wx.login === 'function') {
    wx.login({
      success(res) {
        doAuthRequest((res && res.code) || '');
      },
      fail() {
        doAuthRequest('');
      }
    });
  } else {
    doAuthRequest('');
  }
}

function syncUserCloudData() {
  if (typeof wx === 'undefined' || !wx.request || (!state.userId && !state.openid)) return;
  const qs = `userId=${encodeURIComponent(state.userId || 0)}&openid=${encodeURIComponent(state.openid || '')}`;

  wx.request({
    url: API_BASE + '/app-api/duanju/progress/list?' + qs,
    method: 'GET',
    success(res) {
      if (res.data && res.data.code === 200 && Array.isArray(res.data.rows)) {
        const nextProg = {};
        res.data.rows.forEach((p) => {
          const isDone = p.isFinished === '1';
          const bo = Number(p.finishBoxOffice || 0);
          const views = bo >= 100000000 ? `${(bo / 100000000).toFixed(2)} 亿` : (bo > 0 ? `${bo} 播放` : '拍摄中');
          const prevLocal = state.scriptProgress[p.scriptId] || {};
          const srvHist = Array.isArray(p.historyChoices) ? p.historyChoices : [];
          nextProg[p.scriptId] = {
            status: isDone ? 'done' : 'doing',
            epIndex: Number(p.currentEpisode || 1),
            score: p.finishScore ? Number(p.finishScore).toFixed(2) : 0,
            views: isDone ? views : '拍摄中',
            endingId: prevLocal.endingId || '',
            endingTitle: prevLocal.endingTitle && prevLocal.endingTitle !== '已杀青完结'
              ? prevLocal.endingTitle
              : (isDone ? '已杀青完结' : `拍至第 ${p.currentEpisode || 1} 集`),
            endingText: prevLocal.endingText || '',
            history: srvHist.length > 0 ? srvHist : (Array.isArray(prevLocal.history) ? prevLocal.history : [])
          };
        });
        state.scriptProgress = nextProg;
        saveStorage();
        requestRender();
      }
    }
  });

  wx.request({
    url: API_BASE + '/app-api/duanju/collection/my?' + qs,
    method: 'GET',
    success(res) {
      if (res.data && res.data.code === 200) {
        const nextEndings = {};
        const endings = res.data.data && res.data.data.endings;
        if (endings && typeof endings === 'object') {
          Object.keys(endings).forEach((eid) => {
            if (endings[eid]) nextEndings[eid] = true;
          });
        }
        state.unlockedEndings = nextEndings;
        saveStorage();
        requestRender();
      }
    }
  });

  wx.request({
    url: API_BASE + '/duanju/leaderboard/list',
    method: 'GET',
    success(res) {
      const rows = (res.data && res.data.rows) || (res.data && res.data.data && res.data.data.rows);
      if (Array.isArray(rows)) {
        state.leaderboards = rows;
        requestRender();
      }
    }
  });
}

function formatEndingType(rawType) {
  const map = {
    hidden: '隐藏彩蛋',
    subversion: '反套路',
    triumph: '传奇结局',
    unfinished: '悬念结局',
    rare: '稀有结局',
    normal: '普通结局',
    classic: '经典结局'
  };
  const key = String(rawType || '').trim().toLowerCase();
  if (map[key]) return map[key];
  return (rawType && !/^[a-zA-Z_\s]+$/.test(rawType)) ? String(rawType) : '结局图鉴';
}

// 微信小游戏原生音频引擎 (霸总/大女主高燃踩点 BGM + 4 套波普交互音效)
const audioFX = (() => {
  let initialized = false;
  let bgmCtx = null;
  let bgmPlaying = false;
  let sfxMap = {};
  let clickIdx = 0;

  function createAudio(localRelPath, opts = {}) {
    if (typeof wx === 'undefined' || !wx.createInnerAudioContext) return null;
    try {
      const ctx = wx.createInnerAudioContext();
      if (typeof opts.loop === 'boolean') ctx.loop = opts.loop;
      if (typeof opts.volume === 'number') ctx.volume = opts.volume;
      let triedHttp = false;
      ctx.src = localRelPath;
      ctx.onError(() => {
        if (!triedHttp) {
          triedHttp = true;
          ctx.src = API_BASE + '/' + localRelPath;
          if (opts.isBgm && state.soundOn) {
            try { ctx.play(); } catch (e) {}
          }
        }
      });
      return ctx;
    } catch (e) {
      return null;
    }
  }

  function ensureBgmPlaying() {
    if (!state.soundOn || !bgmCtx || bgmPlaying) return;
    try {
      bgmCtx.play();
    } catch (e) {}
  }

  function pauseBgm() {
    if (!bgmCtx) return;
    bgmPlaying = false;
    try {
      bgmCtx.pause();
    } catch (e) {}
  }

  function init() {
    if (initialized) return;
    initialized = true;

    try {
      if (typeof wx !== 'undefined' && wx.setInnerAudioOption) {
        wx.setInnerAudioOption({ obeyMuteSwitch: false });
      }
    } catch (e) {}

    bgmCtx = createAudio('static/audio/bgm_stage.mp3', { loop: true, volume: 0.38, isBgm: true });
    if (bgmCtx) {
      if (bgmCtx.onPlay) bgmCtx.onPlay(() => { bgmPlaying = true; });
      if (bgmCtx.onPause) bgmCtx.onPause(() => { bgmPlaying = false; });
      if (bgmCtx.onStop) bgmCtx.onStop(() => { bgmPlaying = false; });
    }

    sfxMap = {
      click: [
        createAudio('static/audio/sfx_click.mp3', { volume: 0.65 }),
        createAudio('static/audio/sfx_click.mp3', { volume: 0.65 })
      ],
      clap: createAudio('static/audio/sfx_clap.mp3', { volume: 0.78 }),
      clue: createAudio('static/audio/sfx_clue.mp3', { volume: 0.78 }),
      fanfare: createAudio('static/audio/sfx_fanfare.mp3', { volume: 0.85 })
    };

    try {
      if (typeof wx !== 'undefined') {
        if (wx.onHide) wx.onHide(() => pauseBgm());
        if (wx.onShow) wx.onShow(() => { if (state.soundOn) ensureBgmPlaying(); });
        if (wx.onAudioInterruptionEnd) wx.onAudioInterruptionEnd(() => { if (state.soundOn) ensureBgmPlaying(); });
      }
    } catch (e) {}

    if (state.soundOn) {
      ensureBgmPlaying();
    }
  }

  function playSfx(type = 'click') {
    if (!state.soundOn) return;
    if (!initialized) init();
    let target = null;
    if (type === 'click') {
      const pool = sfxMap.click;
      if (pool && pool.length) {
        target = pool[clickIdx % pool.length];
        clickIdx = (clickIdx + 1) % pool.length;
      }
    } else {
      target = sfxMap[type] || (sfxMap.click && sfxMap.click[0]);
    }
    if (!target) return;
    try {
      if (target.stop) target.stop();
      if (target.seek) target.seek(0);
      target.play();
    } catch (e) {}
  }

  return { init, ensureBgmPlaying, pauseBgm, playSfx };
})();

// 提示框
function toast(msg) {
  if (typeof wx !== 'undefined' && wx.showToast) {
    wx.showToast({ title: String(msg), icon: 'none', duration: 1800 });
  }
}

function toggleSound() {
  state.soundOn = !state.soundOn;
  saveStorage();
  if (state.soundOn) {
    audioFX.ensureBgmPlaying();
    audioFX.playSfx('click');
    toast('音效与背景音乐已开启');
  } else {
    audioFX.pauseBgm();
    toast('音效与背景音乐已静音');
  }
  requestRender();
}

function playFeedback(type = 'click') {
  if (!state.soundOn) return;
  audioFX.playSfx(type);
  try {
    if (typeof wx !== 'undefined' && wx.vibrateShort) {
      wx.vibrateShort({ type: 'light' });
    }
  } catch (e) {}
}

// 点击热区管理
let hitRegions = [];
function addHitRegion(id, x, y, w, h, onClick, isModal = false) {
  hitRegions.push({ id, x, y, w, h, onClick, isModal });
}

// 绘图基础工具函数
function roundRectPath(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawPopBox(x, y, w, h, r, fill, shadowOffset = 4, borderColor = COLORS.navy, lineWidth = 2.5) {
  if (shadowOffset > 0) {
    roundRectPath(x, y + shadowOffset, w, h, r);
    ctx.fillStyle = borderColor;
    ctx.fill();
  }
  roundRectPath(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (lineWidth > 0) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = borderColor;
    ctx.stroke();
  }
}

function drawDashedBox(x, y, w, h, r, fill, borderColor = COLORS.navy) {
  roundRectPath(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = borderColor;
  ctx.stroke();
  ctx.restore();
}

function drawButton(id, x, y, w, h, r, fill, text, textColor, fontSize, shadowOffset, onClick, isModal = false) {
  drawPopBox(x, y, w, h, r, fill, shadowOffset, COLORS.navy, 2.5);
  ctx.fillStyle = textColor;
  ctx.font = `bold ${Math.round(fontSize)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
  if (onClick) {
    addHitRegion(id, x, y, w, h, onClick, isModal);
  }
}

function drawImageCover(img, x, y, w, h, r) {
  ctx.save();
  roundRectPath(x, y, w, h, r);
  ctx.clip();
  if (img && img.width > 0 && img.height > 0) {
    const imgRatio = img.width / img.height;
    const boxRatio = w / h;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (imgRatio > boxRatio) {
      sw = img.height * boxRatio;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / boxRatio;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }
  ctx.restore();
}

const NO_LINE_START_PUNCT_RE = /^[。，！？：；、）」》”’】.,!?:;)\]]/;

function wrapTextLines(text, maxWidth, fontSize, bold = false) {
  ctx.font = `${bold ? 'bold ' : ''}${Math.round(fontSize)}px sans-serif`;
  const chars = String(text || '').split('');
  const lines = [];
  let current = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === '\n') {
      lines.push(current);
      current = '';
      continue;
    }
    const test = current + ch;
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      // 中文标点避头：禁止句号、逗号、右括号、右引号等孤立落到下一行开头
      if (NO_LINE_START_PUNCT_RE.test(ch)) {
        if (current.length > 1 && !NO_LINE_START_PUNCT_RE.test(current.slice(-1))) {
          const pulled = current.slice(-1);
          lines.push(current.slice(0, -1));
          current = pulled + ch;
        } else {
          current = test;
        }
      } else {
        lines.push(current);
        current = ch;
      }
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// 按 Canvas 实际像素宽度安全截断单行文字，避免真机屏幕溢出或乱切字
function fitTextToWidth(text, maxWidth, fontSize, bold = true) {
  const str = String(text || '');
  ctx.font = `${bold ? 'bold ' : ''}${Math.round(fontSize)}px sans-serif`;
  if (ctx.measureText(str).width <= maxWidth) return str;
  const dots = '...';
  let lo = 0;
  let hi = str.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(str.slice(0, mid) + dots).width <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo > 0 ? str.slice(0, lo) + dots : dots;
}

function getScriptCastEntities(script, customActorName) {
  const sc = script || state.curScript || getCurrentScript();
  const profile = getScriptRoleProfile(sc);
  const actorName = customActorName || getScriptActorName(sc);
  const map = {};
  // 主演优先注册为专属主角高亮类型，避免被对手/配角列表覆盖
  if (actorName && actorName.length >= 2) {
    map[actorName] = 'protagonist';
  }
  (profile.villains || []).forEach((n) => {
    if (n && n.length >= 2 && !map[n]) map[n] = 'villain';
  });
  (profile.allies || []).forEach((n) => {
    if (n && n.length >= 2 && !map[n]) map[n] = 'ally';
  });
  return Object.keys(map)
    .sort((a, b) => b.length - a.length)
    .map((name) => ({ name, kind: map[name] }));
}

function tokenizeRichText(text, script, customActorName) {
  const str = String(text || '');
  const entities = getScriptCastEntities(script, customActorName);
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    let matched = null;
    for (let eIdx = 0; eIdx < entities.length; eIdx++) {
      const ent = entities[eIdx];
      if (str.startsWith(ent.name, i)) {
        matched = ent;
        break;
      }
    }
    if (matched) {
      tokens.push({ type: 'pill', kind: matched.kind, text: matched.name });
      i += matched.name.length;
    } else {
      tokens.push({ type: 'ch', text: str[i] });
      i += 1;
    }
  }
  return tokens;
}

function layoutRichTextLines(text, maxWidth, fontSize, bold, script, customActorName) {
  const tokens = tokenizeRichText(text, script, customActorName);
  const lines = [];
  let curLine = [];
  let curW = 0;

  const measureTok = (tok) => {
    if (tok.type === 'pill') {
      ctx.font = `bold ${Math.round(fontSize)}px sans-serif`;
      return ctx.measureText(tok.text).width + 10 * S;
    }
    if (tok.text === '\n') return 0;
    ctx.font = `${bold ? 'bold ' : ''}${Math.round(fontSize)}px sans-serif`;
    return ctx.measureText(tok.text).width;
  };

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.type === 'ch' && tok.text === '\n') {
      lines.push(curLine);
      curLine = [];
      curW = 0;
      continue;
    }
    const w = measureTok(tok);
    tok.w = w;
    if (curW + w > maxWidth && curLine.length > 0) {
      if (tok.type === 'ch' && NO_LINE_START_PUNCT_RE.test(tok.text)) {
        const lastTok = curLine[curLine.length - 1];
        if (curLine.length > 1 && lastTok && lastTok.type === 'ch' && !NO_LINE_START_PUNCT_RE.test(lastTok.text)) {
          curLine.pop();
          lines.push(curLine);
          curLine = [lastTok, tok];
          curW = (lastTok.w || 0) + w;
        } else {
          curLine.push(tok);
          curW += w;
        }
      } else {
        lines.push(curLine);
        curLine = [tok];
        curW = w;
      }
    } else {
      curLine.push(tok);
      curW += w;
    }
  }
  if (curLine.length > 0 || lines.length === 0) lines.push(curLine);
  return lines;
}

function drawRichTextLines(lines, x, startY, lineHeight, fontSize, bold = false, baseColor = COLORS.navy) {
  const pillH = Math.round(fontSize * 1.38);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  lines.forEach((lineTokens, lIdx) => {
    const cy = startY + lIdx * lineHeight;
    let cx = x;
    let buf = '';
    const flushBuf = () => {
      if (!buf) return;
      ctx.fillStyle = baseColor;
      ctx.font = `${bold ? 'bold ' : ''}${Math.round(fontSize)}px sans-serif`;
      ctx.fillText(buf, cx, cy);
      cx += ctx.measureText(buf).width;
      buf = '';
    };

    lineTokens.forEach((tok) => {
      if (tok.type === 'ch') {
        buf += tok.text;
        return;
      }
      flushBuf();
      let bg = '#D1FAE5';
      let lineCol = '#10B981';
      let txtCol = '#065F46';
      if (tok.kind === 'villain') {
        bg = '#FFE4E6';
        lineCol = '#F43F5E';
        txtCol = '#9F1239';
      } else if (tok.kind === 'protagonist') {
        bg = '#DBEAFE';
        lineCol = '#2563EB';
        txtCol = '#1E3A8A';
      }

      ctx.font = `bold ${Math.round(fontSize)}px sans-serif`;
      const tw = ctx.measureText(tok.text).width;
      const pw = tw + 8 * S;
      const px = cx + 1 * S;
      const py = cy - pillH / 2;

      roundRectPath(px, py, pw, pillH, 4 * S);
      ctx.fillStyle = bg;
      ctx.fill();

      ctx.fillStyle = lineCol;
      ctx.fillRect(px + 1 * S, py + pillH - 2 * S, pw - 2 * S, 2 * S);

      ctx.fillStyle = txtCol;
      ctx.fillText(tok.text, px + 4 * S, cy + 0.5 * S);
      cx += pw + 2 * S;
    });
    flushBuf();
  });
}

function drawPaperGrid() {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  const step = 22 * S;
  for (let x = 0; x < W; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

// 获取当前选中剧本
function getCurrentScript() {
  if (!state.scripts || state.scripts.length === 0) return null;
  return state.scripts[state.currentIndex] || state.scripts[0];
}

// 动态统计全库已上架剧本的总结局数（禁止写死 36）
function getTotalEndingCount() {
  let total = 0;
  (state.scripts || []).forEach((s) => {
    total += Array.isArray(s.endings) ? s.endings.length : (Number(s.endingCount) || 0);
  });
  return total;
}

// 统计已解锁结局总数
function getUnlockedCount() {
  const validEndingIds = {};
  (state.scripts || []).forEach((s) => {
    (s.endings || []).forEach((e) => {
      const eid = e.id || e.endingId;
      if (eid) validEndingIds[eid] = true;
    });
  });
  const hasKnownScripts = Object.keys(validEndingIds).length > 0;
  let count = 0;
  Object.keys(state.unlockedEndings || {}).forEach((k) => {
    if (state.unlockedEndings[k] && (!hasKnownScripts || validEndingIds[k])) count++;
  });
  const total = getTotalEndingCount();
  return total > 0 ? Math.min(total, count) : count;
}

// 获取剧本对应的场景插画路径（100% 由后端下发字段驱动）
function getEpisodeScenePath(script, epIndex) {
  if (!script) return '';
  const ep = (script.episodes && script.episodes[epIndex]) || {};
  return normalizeImgPath(ep.sceneImage || script.coverImage || '');
}

// 获取结局插画路径（100% 由后端下发字段驱动）
function getEndingArtPath(script, endObj) {
  if (endObj && (endObj.imageUrl || endObj.art)) {
    return normalizeImgPath(endObj.imageUrl || endObj.art);
  }
  return normalizeImgPath((script && script.coverImage) || '');
}

// ============================================================================
// 1. 首页放映厅视图 (HOME VIEW - 1:1 还原图2波普漫画风格)
// ============================================================================
function renderHomeView() {
  const script = getCurrentScript();
  const padX = 14 * S;
  let curY = SAFE_TOP;

  if (!script) {
    // 纯联网模式：未收到后端数据时渲染波普风格联网加载/重试屏
    const hallTagW = 148 * S;
    drawPopBox((W - hallTagW) / 2, curY + 18 * S, hallTagW, 23 * S, 11.5 * S, '#DB2777', 2, COLORS.navy, 2);
    ctx.fillStyle = COLORS.white;
    ctx.font = `900 ${Math.round(11 * S)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('离谱放映厅 · 互动短剧', W / 2, curY + 30 * S);

    const tiles = [
      { ch: '漫', bg: '#FFE047', text: COLORS.navy },
      { ch: '剧', bg: '#FF5E8E', text: COLORS.white },
      { ch: '大', bg: '#7C5CFF', text: COLORS.white },
      { ch: '导', bg: '#38BDF8', text: COLORS.white },
      { ch: '演', bg: '#22C55E', text: COLORS.white }
    ];
    const tileSize = 40 * S;
    const tileGap = 7 * S;
    const totalTileW = tiles.length * tileSize + (tiles.length - 1) * tileGap;
    const startTileX = (W - totalTileW) / 2;
    const tileY = curY + 54 * S;
    tiles.forEach((t, i) => {
      const tx = startTileX + i * (tileSize + tileGap);
      drawPopBox(tx, tileY, tileSize, tileSize, 10 * S, t.bg, 4, COLORS.navy, 2.5);
      ctx.fillStyle = t.text;
      ctx.font = `900 ${Math.round(20 * S)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.ch, tx + tileSize / 2, tileY + tileSize / 2 + 1);
    });

    const cardY = tileY + tileSize + 28 * S;
    const cardH = state.loadError ? 172 * S : 124 * S;
    drawPopBox(padX, cardY, W - padX * 2, cardH, 20 * S, COLORS.white, 5, COLORS.navy, 3);
    ctx.fillStyle = COLORS.navy;
    ctx.font = `900 ${Math.round(16 * S)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(state.loadError ? '无法连接后端服务器' : '正在联网同步全网剧本...', W / 2, cardY + 42 * S);

    ctx.fillStyle = COLORS.textSub;
    ctx.font = `bold ${Math.round(12 * S)}px sans-serif`;
    ctx.fillText(state.loadError || '正在从云端数据库拉取片单、排行榜与图鉴配置', W / 2, cardY + 74 * S);

    if (state.loadError) {
      drawButton('btn_retry_connect', padX + 36 * S, cardY + 106 * S, W - padX * 2 - 72 * S, 40 * S, 20 * S, COLORS.pink, '重新连接服务器', COLORS.white, 14 * S, 3, () => {
        playFeedback('click');
        wxLoginAndSync();
        syncFromBackend();
        requestRender();
      });
    }
    return;
  }

  // 1) 顶部导航栏：导演中心署名胶囊（按真实像素宽度适配） + 封神榜 + 音效 + 完整成片
  const dirTextRaw = state.directorName || '微信导演';
  const dirBtnW = 124 * S;
  const dirChipTxt = `[导演] ${fitTextToWidth(dirTextRaw, dirBtnW - 44 * S, 10 * S, true)}`;
  drawButton('btn_mini_logo', padX, curY, dirBtnW, 27 * S, 13.5 * S, COLORS.yellow, dirChipTxt, COLORS.navy, 10 * S, 2.5, () => {
    playFeedback();
    state.activeModal = 'user';
    state.modalScrollY = 0;
    requestRender();
  });

  const navStartX = padX + dirBtnW + 6 * S;
  const navAvailW = W - padX - navStartX;
  const btnGap = 5 * S;
  const wRank = Math.round(navAvailW * 0.34);
  const wSound = Math.round(navAvailW * 0.33);
  const wWhole = navAvailW - wRank - wSound - btnGap * 2;

  drawButton('btn_top_rank', navStartX, curY, wRank, 27 * S, 13.5 * S, COLORS.white, '封神榜', COLORS.navy, 10 * S, 2.5, () => {
    playFeedback();
    state.activeModal = 'rank';
    state.modalScrollY = 0;
    requestRender();
  });

  drawButton('btn_top_sound', navStartX + wRank + btnGap, curY, wSound, 27 * S, 13.5 * S, COLORS.white, `音效 ${state.soundOn ? '开' : '关'}`, COLORS.navy, 10 * S, 2.5, () => {
    toggleSound();
  });

  drawButton('btn_top_whole', navStartX + wRank + wSound + btnGap * 2, curY, wWhole, 27 * S, 13.5 * S, COLORS.white, '完整成片', COLORS.navy, 10 * S, 2.5, () => {
    playFeedback();
    openMovieShelfModal();
  });

  curY += 35 * S;

  // 2) 玫红色顶部副标题胶囊：离谱放映厅 · 互动短剧
  const hallTagW = 148 * S;
  drawPopBox((W - hallTagW) / 2, curY, hallTagW, 23 * S, 11.5 * S, '#DB2777', 2, COLORS.navy, 2);
  ctx.fillStyle = COLORS.white;
  ctx.font = `900 ${Math.round(11 * S)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('离谱放映厅 · 互动短剧', W / 2, curY + 12 * S);

  curY += 30 * S;

  // 3) 5色立体大字块：[漫][剧][大][导][演]
  const tiles = [
    { ch: '漫', bg: '#FFE047', text: COLORS.navy },
    { ch: '剧', bg: '#FF5E8E', text: COLORS.white },
    { ch: '大', bg: '#A78BFA', text: COLORS.white },
    { ch: '导', bg: '#38BDF8', text: COLORS.navy },
    { ch: '演', bg: '#4ADE80', text: COLORS.white }
  ];
  const tileSize = 44 * S;
  const tileGap = 8 * S;
  const totalTileW = tiles.length * tileSize + (tiles.length - 1) * tileGap;
  const startTileX = (W - totalTileW) / 2;

  tiles.forEach((t, i) => {
    const tx = startTileX + i * (tileSize + tileGap);
    drawPopBox(tx, curY, tileSize, tileSize, 11 * S, t.bg, 3.5, COLORS.navy, 2.5);
    ctx.fillStyle = t.text;
    ctx.font = `900 ${Math.round(23 * S)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.ch, tx + tileSize / 2, curY + tileSize / 2 + 1);
  });

  curY += tileSize + 11 * S;

  // 4) 状态副标题
  const curProg = state.scriptProgress[script.scriptId];
  const subText = (curProg && curProg.status === 'done')
    ? `已杀青完结 · 评分 ${curProg.score} 分 · 刚刚`
    : '全员恶人，你来决定这集怎么离谱';
  ctx.fillStyle = COLORS.textSub;
  ctx.font = `bold ${Math.round(11.5 * S)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(subText, W / 2, curY);

  curY += 12 * S;

  // 5) 白色粗黑边主舞台大卡片（紧包内部海报、指示器与胶囊，绝不出现多余白色留白）
  const centerW = 128 * S;
  const centerH = 176 * S;
  const sideW = 96 * S;
  const sideH = 142 * S;
  const stageH = centerH + 92 * S;
  drawPopBox(padX, curY, W - padX * 2, stageH, 20 * S, COLORS.white, 4.5, COLORS.navy, 3);

  // 三张倾斜海报轮播卡片
  const total = state.scripts.length;
  const prevIdx = (state.currentIndex - 1 + total) % total;
  const nextIdx = (state.currentIndex + 1) % total;

  const centerX = (W - centerW) / 2;
  const centerY = curY + 14 * S;
  const leftX = padX + 12 * S;
  const rightX = W - padX - 12 * S - sideW;

  // 左右微倾副卡
  [
    { idx: prevIdx, x: leftX, y: centerY + 18 * S, w: sideW, h: sideH, rot: -0.065 },
    { idx: nextIdx, x: rightX, y: centerY + 18 * S, w: sideW, h: sideH, rot: 0.065 }
  ].forEach((card, cIdx) => {
    const sc = state.scripts[card.idx];
    if (!sc) return;
    ctx.save();
    ctx.translate(card.x + card.w / 2, card.y + card.h / 2);
    ctx.rotate(card.rot);
    const rx = -card.w / 2;
    const ry = -card.h / 2;
    drawPopBox(rx, ry, card.w, card.h, 12 * S, '#FFF9FB', 3, COLORS.navy, 2.5);
    const img = getImage(sc.coverImage);
    if (img) {
      drawImageCover(img, rx + 2 * S, ry + 2 * S, card.w - 4 * S, card.h - 4 * S, 10 * S);
    } else {
      drawPopBox(rx + 2 * S, ry + 2 * S, card.w - 4 * S, card.h - 4 * S, 10 * S, sc.coverTheme || '#E0F2FE', 0, COLORS.navy, 0);
    }
    const scProg = state.scriptProgress[sc.scriptId];
    const isRec = Boolean(sc.recommend);
    let bText = '';
    let bW = 0;
    let bBg = COLORS.pink;
    if (scProg && scProg.status === 'done') {
      bText = '已杀青';
      bW = 40 * S;
      bBg = COLORS.green;
    } else if (scProg && (scProg.status === 'doing' || Number(scProg.epIndex || 1) > 1)) {
      bText = `第${scProg.epIndex || 1}/${sc.totalEpisodes || 6}集`;
      bW = 46 * S;
      bBg = COLORS.pink;
    } else if (isRec) {
      bText = '主推';
      bW = 36 * S;
      bBg = COLORS.pink;
    }
    // 已开拍/已杀青的主推剧本在左上角常驻“主推”小标，避免被进度角标遮盖
    if (isRec && scProg && (scProg.status === 'done' || scProg.status === 'doing' || Number(scProg.epIndex || 1) > 1)) {
      drawPopBox(rx + 5 * S, ry + 6 * S, 30 * S, 16 * S, 8 * S, COLORS.pink, 0, COLORS.navy, 1.5);
      ctx.fillStyle = COLORS.white;
      ctx.font = `bold ${Math.round(8.5 * S)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('主推', rx + 20 * S, ry + 14.5 * S);
    }
    if (bText) {
      drawPopBox(rx + card.w - bW - 5 * S, ry + 6 * S, bW, 16 * S, 8 * S, bBg, 0, COLORS.navy, 1.5);
      ctx.fillStyle = COLORS.white;
      ctx.font = `bold ${Math.round(9 * S)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(bText, rx + card.w - bW / 2 - 5 * S, ry + 14.5 * S);
    }
    drawPopBox(rx + 6 * S, ry + card.h - 24 * S, card.w - 12 * S, 18 * S, 9 * S, COLORS.white, 0, COLORS.navy, 1.8);
    ctx.fillStyle = COLORS.navy;
    ctx.font = `bold ${Math.round(9.5 * S)}px sans-serif`;
    ctx.textAlign = 'center';
    const shortTitle = sc.title.length > 6 ? sc.title.slice(0, 6) : sc.title;
    ctx.fillText(shortTitle, 0, ry + card.h - 14.5 * S);
    ctx.restore();

    addHitRegion('side_card_' + cIdx, card.x, card.y, card.w, card.h, () => {
      playFeedback();
      state.currentIndex = card.idx;
      requestRender();
    });
  });

  // 中间主卡（铺满封面）
  drawPopBox(centerX, centerY, centerW, centerH, 14 * S, COLORS.white, 4, COLORS.navy, 2.5);
  const centerImg = getImage(script.coverImage);
  if (centerImg) {
    drawImageCover(centerImg, centerX + 2 * S, centerY + 2 * S, centerW - 4 * S, centerH - 4 * S, 12 * S);
  } else {
    drawPopBox(centerX + 2 * S, centerY + 2 * S, centerW - 4 * S, centerH - 4 * S, 12 * S, script.coverTheme || '#FFE4E6', 0, COLORS.navy, 0);
  }
  const centerIsRec = Boolean(script.recommend);
  const centerDoing = Boolean(curProg && (curProg.status === 'doing' || Number(curProg.epIndex || 1) > 1));
  if (curProg && curProg.status === 'done') {
    if (centerIsRec) {
      drawPopBox(centerX + 8 * S, centerY + 8 * S, 34 * S, 18 * S, 9 * S, COLORS.pink, 0, COLORS.navy, 1.5);
      ctx.fillStyle = COLORS.white;
      ctx.font = `bold ${Math.round(9 * S)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('主推', centerX + 25 * S, centerY + 17.5 * S);

      drawPopBox(centerX + centerW - 76 * S, centerY + 8 * S, 68 * S, 18 * S, 9 * S, COLORS.green, 0, COLORS.navy, 1.5);
      ctx.fillStyle = COLORS.white;
      ctx.font = `bold ${Math.round(9 * S)}px sans-serif`;
      ctx.fillText(`已杀青 ${curProg.score}`, centerX + centerW - 42 * S, centerY + 17.5 * S);
    } else {
      drawPopBox(centerX + 12 * S, centerY + 8 * S, centerW - 24 * S, 18 * S, 9 * S, COLORS.green, 0, COLORS.navy, 1.5);
      ctx.fillStyle = COLORS.white;
      ctx.font = `bold ${Math.round(9.5 * S)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`已杀青 ${curProg.score}分`, centerX + centerW / 2, centerY + 17.5 * S);
    }
  } else if (centerDoing) {
    if (centerIsRec) {
      drawPopBox(centerX + 8 * S, centerY + 8 * S, 34 * S, 18 * S, 9 * S, COLORS.pink, 0, COLORS.navy, 1.5);
      ctx.fillStyle = COLORS.white;
      ctx.font = `bold ${Math.round(9 * S)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('主推', centerX + 25 * S, centerY + 17.5 * S);
    }
    drawPopBox(centerX + centerW - 64 * S, centerY + 8 * S, 56 * S, 18 * S, 9 * S, '#F59E0B', 0, COLORS.navy, 1.5);
    ctx.fillStyle = COLORS.navy;
    ctx.font = `bold ${Math.round(9 * S)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`第 ${curProg.epIndex || 1}/${script.totalEpisodes || 6} 集`, centerX + centerW - 36 * S, centerY + 17.5 * S);
  } else if (centerIsRec) {
    drawPopBox(centerX + centerW - 46 * S, centerY + 8 * S, 38 * S, 18 * S, 9 * S, COLORS.pink, 0, COLORS.navy, 1.5);
    ctx.fillStyle = COLORS.white;
    ctx.font = `bold ${Math.round(9.5 * S)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('主推', centerX + centerW - 27 * S, centerY + 17.5 * S);
  } else {
    drawPopBox(centerX + centerW - 50 * S, centerY + 8 * S, 42 * S, 18 * S, 9 * S, '#1E2246', 0, COLORS.navy, 1.5);
    ctx.fillStyle = COLORS.white;
    ctx.font = `bold ${Math.round(9 * S)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('第 1 集', centerX + centerW - 29 * S, centerY + 17.5 * S);
  }
  drawPopBox(centerX + 6 * S, centerY + centerH - 28 * S, centerW - 12 * S, 22 * S, 11 * S, '#2563EB', 0, COLORS.navy, 1.8);
  ctx.fillStyle = COLORS.white;
  ctx.font = `bold ${Math.round(11 * S)}px sans-serif`;
  ctx.textAlign = 'center';
  const mainShort = script.title.length > 7 ? script.title.slice(0, 7) : script.title;
  ctx.fillText(mainShort, centerX + centerW / 2, centerY + centerH - 16.5 * S);
  addHitRegion('center_card', centerX, centerY, centerW, centerH, () => {
    openCastingModal(script);
  });

  // 轮播指示器：< ○ ▬ ○ ○ ○ 2/9 >（1:1 复刻 Web 主推圆点粉色描边）
  const navY = centerY + centerH + 11 * S;
  const navTotalW = 200 * S;
  const navLeftX = (W - navTotalW) / 2;
  drawButton('carousel_prev', navLeftX, navY, 22 * S, 20 * S, 10 * S, COLORS.white, '<', COLORS.navy, 11.5 * S, 1.5, () => {
    playFeedback();
    state.currentIndex = (state.currentIndex - 1 + total) % total;
    requestRender();
  });

  let dotX = navLeftX + 30 * S;
  for (let i = 0; i < total; i++) {
    const dotSc = state.scripts[i];
    const isAct = i === state.currentIndex;
    const isDotRec = Boolean(dotSc && dotSc.recommend);
    const dw = isAct ? 14 * S : 5.5 * S;
    roundRectPath(dotX, navY + 7 * S, dw, 5.5 * S, 2.75 * S);
    ctx.fillStyle = isAct ? COLORS.pink : COLORS.white;
    ctx.fill();
    ctx.lineWidth = (!isAct && isDotRec) ? 1.8 : 1.4;
    ctx.strokeStyle = (!isAct && isDotRec) ? COLORS.pink : COLORS.navy;
    ctx.stroke();
    addHitRegion('carousel_dot_' + i, dotX - 2 * S, navY, dw + 4 * S, 20 * S, () => {
      playFeedback();
      state.currentIndex = i;
      requestRender();
    });
    dotX += dw + 4 * S;
  }
  ctx.fillStyle = COLORS.textSub;
  ctx.font = `bold ${Math.round(10 * S)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(`${state.currentIndex + 1}/${total}`, dotX + 2 * S, navY + 10.5 * S);

  drawButton('carousel_next', navLeftX + navTotalW - 22 * S, navY, 22 * S, 20 * S, 10 * S, COLORS.white, '>', COLORS.navy, 11.5 * S, 1.5, () => {
    playFeedback();
    state.currentIndex = (state.currentIndex + 1) % total;
    requestRender();
  });

  // 三个规格胶囊
  const pillY = navY + 28 * S;
  const pills = [
    script.tag || '每集一次抉择',
    `共 ${script.totalEpisodes || 6} 集`,
    `${script.endingCount || 4} 种结局`
  ];
  const pillW = 92 * S;
  const pillGap = 8 * S;
  const startPillX = (W - (pillW * 3 + pillGap * 2)) / 2;
  pills.forEach((pText, idx) => {
    const px = startPillX + idx * (pillW + pillGap);
    drawPopBox(px, pillY, pillW, 22 * S, 11 * S, COLORS.white, 0, COLORS.navy, 1.8);
    ctx.fillStyle = COLORS.navy;
    ctx.font = `bold ${Math.round(10.5 * S)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(pText.slice(0, 7), px + pillW / 2, pillY + 11.5 * S);
  });

  // 6) 独立剧情与主角定妆卡片（第1行显示角色定位+主角名+改主角名按钮，第2-3行剧情简介）
  const homeRole = getScriptRoleProfile(script);
  const homeActor = getScriptActorName(script);
  const synY = curY + stageH + 8 * S;
  const synH = 74 * S;
  drawPopBox(padX, synY, W - padX * 2, synH, 14 * S, COLORS.white, 3, COLORS.navy, 2.5);

  const roleBadgeW = 108 * S;
  drawPopBox(padX + 10 * S, synY + 8 * S, roleBadgeW, 19 * S, 9.5 * S, '#2563EB', 0, COLORS.navy, 1.5);
  ctx.fillStyle = COLORS.white;
  ctx.font = `bold ${Math.round(9.5 * S)}px sans-serif`;
  ctx.textAlign = 'center';
  const roleShort = homeRole.roleTitle.length > 6 ? homeRole.roleTitle.slice(0, 6) : homeRole.roleTitle;
  ctx.fillText(`你饰·${roleShort}`, padX + 10 * S + roleBadgeW / 2, synY + 18 * S);

  ctx.fillStyle = COLORS.navy;
  ctx.font = `900 ${Math.round(11 * S)}px sans-serif`;
  ctx.textAlign = 'left';
  const actorShort = homeActor.length > 6 ? homeActor.slice(0, 6) : homeActor;
  ctx.fillText(`主角：${actorShort}`, padX + roleBadgeW + 16 * S, synY + 18 * S);

  drawButton('btn_home_edit_actor', W - padX - 80 * S, synY + 7 * S, 70 * S, 21 * S, 10.5 * S, COLORS.yellow, '改主角名', COLORS.navy, 9.5 * S, 1.8, () => {
    openEditActorNameModal(script);
  });

  drawPopBox(padX + 10 * S, synY + 34 * S, 48 * S, 19 * S, 9.5 * S, COLORS.yellowSoft, 0, COLORS.navy, 1.6);
  ctx.fillStyle = COLORS.navy;
  ctx.font = `bold ${Math.round(9.5 * S)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('第 1 集', padX + 34 * S, synY + 44 * S);

  const synLines = wrapTextLines(formatStoryDialogue(script.synopsis || '全员恶人，由你拍板决定这集走向。', script), W - padX * 2 - 76 * S, 11 * S, true).slice(0, 2);
  ctx.fillStyle = COLORS.navy;
  ctx.font = `bold ${Math.round(11 * S)}px sans-serif`;
  ctx.textAlign = 'left';
  synLines.forEach((line, idx) => {
    ctx.fillText(line, padX + 66 * S, synY + 42 * S + idx * 16 * S);
  });

  // 7) 底部三等分按钮与大号粉色主按钮（严格预留全面屏底部安全区 SAFE_BOTTOM）
  const bottomY = H - SAFE_BOTTOM - 35 * S;
  const mainBtnY = Math.max(synY + synH + 8 * S, bottomY - 50 * S);
  const mainBtnLabel = (curProg && curProg.status === 'done')
    ? `重拍新结局 · 《${script.title}》`
    : `开拍 · 《${script.title}》`;
  drawButton('btn_start_shoot', padX, mainBtnY, W - padX * 2, 42 * S, 21 * S, COLORS.pink, mainBtnLabel, COLORS.white, 15.5 * S, 4, () => {
    openCastingModal(script);
  });

  // 8) 底部三等分按钮：换剧本 | 我的片单 | 我的图鉴 X/36
  const bGap = 8 * S;
  const bW = (W - padX * 2 - bGap * 2) / 3;
  const unlockedCnt = getUnlockedCount();
  const totalEndingCnt = getTotalEndingCount();

  drawButton('btn_hall', padX, bottomY, bW, 35 * S, 17.5 * S, COLORS.white, '换剧本', COLORS.navy, 12.5 * S, 2.5, () => {
    playFeedback();
    state.activeModal = 'hall';
    state.modalScrollY = 0;
    requestRender();
    syncFromBackend();
  });

  drawButton('btn_schedule', padX + bW + bGap, bottomY, bW, 35 * S, 17.5 * S, COLORS.white, '我的片单', COLORS.navy, 12.5 * S, 2.5, () => {
    playFeedback();
    state.activeModal = 'schedule';
    state.modalScrollY = 0;
    requestRender();
  });

  drawButton('btn_collection', padX + (bW + bGap) * 2, bottomY, bW, 35 * S, 17.5 * S, COLORS.white, `我的图鉴 ${unlockedCnt}/${totalEndingCnt}`, COLORS.navy, 12 * S, 2.5, () => {
    playFeedback();
    state.activeModal = 'collection';
    state.modalScrollY = 0;
    requestRender();
  });
}

// 启动剧集拍摄
function startEpisodeShooting(script) {
  playFeedback('clap');
  state.curScript = script;
  state.actorName = getScriptActorName(script);
  state.epIndex = 0;
  state.panelIndex = 0;
  state.phase = 'panel';
  state.lastOutcomeText = '';
  state.stats = {
    pleasure: (script.initialStats && script.initialStats.pleasure) || 15,
    drama: (script.initialStats && script.initialStats.drama) || 25,
    anger: (script.initialStats && script.initialStats.anger) || 10,
    evidence: (script.initialStats && script.initialStats.evidence) || 0,
    subversion: (script.initialStats && script.initialStats.subversion) || 0
  };
  state.collectedClues = {};
  state.pendingEvidence = null;
  state.collectedEvidenceEps = [];
  state.choiceHistory = [];
  state.adBoosted = false;
  state.view = 'episode';
  state.activeModal = null;

  // 记录为拍摄中
  if (!state.scriptProgress[script.scriptId] || state.scriptProgress[script.scriptId].status !== 'done') {
    state.scriptProgress[script.scriptId] = {
      status: 'doing',
      epIndex: 1,
      score: 0,
      views: '拍摄中',
      endingTitle: '拍摄进行中',
      history: []
    };
    saveStorage();
  }
  requestRender();
}

// ============================================================================
// 2. 剧集拍摄页视图 (EPISODE VIEW)
// ============================================================================
function renderEpisodeView() {
  const script = state.curScript || getCurrentScript();
  if (!script) return;
  const episodes = script.episodes || [];
  const ep = episodes[state.epIndex] || episodes[0] || {};
  const panels = ep.panels || [];
  const totalEp = episodes.length || 6;
  const epNum = state.epIndex + 1;

  const padX = 14 * S;
  let curY = SAFE_TOP;

  // 第一行：顶部操作栏（< 首页 | [线索本] | [音效] 开）
  drawButton('ep_back_home', padX, curY, 72 * S, 30 * S, 15 * S, COLORS.white, '< 首页', COLORS.navy, 12.5 * S, 3, () => {
    playFeedback();
    state.view = 'home';
    requestRender();
  });

  const clueCnt = Object.keys(state.collectedClues).length;
  drawButton('ep_open_clue', padX + 82 * S, curY, 92 * S, 30 * S, 15 * S, COLORS.yellow, `[线索本] ${clueCnt}`, COLORS.navy, 12.5 * S, 3, () => {
    playFeedback();
    state.activeModal = 'clue';
    state.modalScrollY = 0;
    requestRender();
  });

  drawButton('ep_toggle_sound', padX + 182 * S, curY, 82 * S, 30 * S, 15 * S, COLORS.white, `[音效] ${state.soundOn ? '开' : '关'}`, COLORS.navy, 12.5 * S, 3, () => {
    toggleSound();
  });

  curY += 40 * S;

  // 第二行：剧集贴纸标题卡（显示剧名 + 玩家所饰角色/主角名及快捷改名入口）
  const epRole = getScriptRoleProfile(script);
  const epActor = getScriptActorName(script);
  const stickerH = 62 * S;
  drawPopBox(padX, curY, W - padX * 2, stickerH, 14 * S, COLORS.pinkSoft, 3, COLORS.navy, 2.5);

  // 剧本名胶囊
  const sTitleText = `《${script.title}》`;
  ctx.font = `bold ${Math.round(11 * S)}px sans-serif`;
  const sTitleW = Math.max(76 * S, Math.min(118 * S, ctx.measureText(sTitleText).width + 16 * S));
  drawPopBox(padX + 10 * S, curY + 8 * S, sTitleW, 20 * S, 10 * S, COLORS.white, 0, COLORS.navy, 1.8);
  ctx.fillStyle = COLORS.pink;
  ctx.textAlign = 'center';
  ctx.fillText(sTitleText, padX + 10 * S + sTitleW / 2, curY + 18 * S);

  // 我饰角色与主角改名胶囊
  const roleShortEp = epRole.roleTitle.length > 5 ? epRole.roleTitle.slice(0, 5) : epRole.roleTitle;
  const actorShortEp = epActor.length > 5 ? epActor.slice(0, 5) : epActor;
  const roleChipText = `你饰：${roleShortEp}·${actorShortEp} [改]`;
  const roleChipX = padX + 14 * S + sTitleW;
  const epBadgeW = 68 * S;
  const roleChipW = Math.max(90 * S, W - padX - epBadgeW - 14 * S - roleChipX);
  drawButton('ep_edit_actor', roleChipX, curY + 8 * S, roleChipW, 20 * S, 10 * S, '#2563EB', roleChipText, COLORS.white, 9.5 * S, 1.5, () => {
    openEditActorNameModal(script);
  });

  // 集数胶囊
  drawPopBox(W - padX - epBadgeW - 10 * S, curY + 8 * S, epBadgeW, 20 * S, 10 * S, COLORS.yellow, 0, COLORS.navy, 1.8);
  ctx.fillStyle = COLORS.navy;
  ctx.font = `bold ${Math.round(10.5 * S)}px sans-serif`;
  ctx.fillText(`第 ${epNum} 集 / ${totalEp}`, W - padX - 10 * S - epBadgeW / 2, curY + 18 * S);

  // 去重后的剧集标题
  const rawEpTitle = String(ep.title || '高能分镜现场').replace(/^第\s*\d+\s*集\s*[：:]\s*/, '');
  ctx.fillStyle = COLORS.navy;
  ctx.font = `bold ${Math.round(14.5 * S)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(`第 ${epNum} 集：${rawEpTitle}`, padX + 12 * S, curY + 45 * S);

  curY += stickerH + 10 * S;

  // 第三行：五维指标栏
  const metricH = 54 * S;
  drawPopBox(padX, curY, W - padX * 2, metricH, 14 * S, COLORS.white, 3, COLORS.navy, 2.5);

  // 顶部进度条
  const barX = padX + 12 * S;
  const barW = W - padX * 2 - 24 * S;
  roundRectPath(barX, curY + 8 * S, barW, 5 * S, 2.5 * S);
  ctx.fillStyle = '#E2E8F0';
  ctx.fill();
  const progressRatio = Math.min(1, (state.epIndex + (state.panelIndex + 1) / Math.max(1, panels.length)) / totalEp);
  roundRectPath(barX, curY + 8 * S, Math.max(12 * S, barW * progressRatio), 5 * S, 2.5 * S);
  ctx.fillStyle = COLORS.pink;
  ctx.fill();

  const metrics = [
    { label: '爽点值', val: state.stats.pleasure, highlight: false },
    { label: '戏剧浓度', val: state.stats.drama, highlight: false },
    { label: '反派怒气', val: state.stats.anger, highlight: false },
    { label: '已备材料', val: state.stats.evidence, highlight: true },
    { label: '拆套路', val: state.stats.subversion, highlight: false }
  ];
  const mGap = 6 * S;
  const mW = (barW - mGap * 4) / 5;
  metrics.forEach((m, idx) => {
    const mx = barX + idx * (mW + mGap);
    const my = curY + 17 * S;
    drawPopBox(mx, my, mW, 30 * S, 8 * S, m.highlight ? COLORS.yellowSoft : '#F8FAFC', 0, m.highlight ? COLORS.orange : COLORS.navy, 1.5);
    ctx.fillStyle = m.highlight ? '#B45309' : COLORS.textSub;
    ctx.font = `bold ${Math.round(9.5 * S)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(m.label, mx + mW / 2, my + 10 * S);
    ctx.fillStyle = m.highlight ? '#D97706' : COLORS.navy;
    ctx.font = `900 ${Math.round(12.5 * S)}px sans-serif`;
    ctx.fillText(String(m.val), mx + mW / 2, my + 23 * S);
  });

  curY += metricH + 10 * S;

  // 第四行：16:9 漫画分镜插画框
  const sceneW = W - padX * 2;
  const sceneH = Math.round(sceneW * 0.54);
  drawPopBox(padX, curY, sceneW, sceneH, 16 * S, '#1E2246', 4, COLORS.navy, 3);

  const sceneImgPath = getEpisodeScenePath(script, state.epIndex);
  const sceneImg = getImage(sceneImgPath) || getImage(script.coverImage);
  if (sceneImg) {
    drawImageCover(sceneImg, padX + 3 * S, curY + 3 * S, sceneW - 6 * S, sceneH - 6 * S, 13 * S);
  } else {
    drawPopBox(padX + 3 * S, curY + 3 * S, sceneW - 6 * S, sceneH - 6 * S, 13 * S, '#FFE4EE', 0, COLORS.navy, 0);
    ctx.fillStyle = COLORS.navy;
    ctx.font = `bold ${Math.round(14 * S)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`第 ${epNum} 集分镜画面加载中...`, W / 2, curY + sceneH / 2);
  }

  // 分镜左上角黑底半透明字幕条
  const panelNum = Math.min(state.panelIndex + 1, Math.max(1, panels.length));
  const badgeText = `第 ${epNum} 集·第 ${panelNum} 幕分镜 【第 ${epNum} 集：${rawEpTitle.slice(0, 8)}】`;
  ctx.font = `bold ${Math.round(10.5 * S)}px sans-serif`;
  const badgeW = Math.min(sceneW - 102 * S, ctx.measureText(badgeText).width + 16 * S);
  roundRectPath(padX + 10 * S, curY + 10 * S, badgeW, 22 * S, 11 * S);
  ctx.fillStyle = 'rgba(20, 24, 50, 0.78)';
  ctx.fill();
  ctx.fillStyle = COLORS.white;
  ctx.textAlign = 'left';
  ctx.fillText(badgeText, padX + 18 * S, curY + 21.5 * S);

  // 仅在选择含证据方向后的结果阶段，渲染缩放脉冲证物热点等待玩家亲自点击收取
  if (state.phase === 'outcome' && state.pendingEvidence) {
    const pend = state.pendingEvidence;
    const clueKey = pend.clueKey || ('ep' + epNum);
    if (!pend.collected) {
      const nowMs = Date.now();
      const pulse = 1 + 0.13 * Math.sin(nowMs / 220);
      const ringPhase = (nowMs % 1100) / 1100;
      const hx = W - padX - 66 * S;
      const hy = curY + sceneH - 42 * S;

      // 外圈扩散波纹光环
      ctx.save();
      ctx.beginPath();
      ctx.arc(hx, hy, (26 + 14 * ringPhase) * S, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(250, 204, 21, ${(0.88 * (1 - ringPhase)).toFixed(2)})`;
      ctx.lineWidth = 2.6 * S;
      ctx.stroke();

      // 脉冲缩放主体按钮（纯矢量绘制证物放大镜图标 + 提示文案，严禁 Emoji）
      ctx.translate(hx, hy);
      ctx.scale(pulse, pulse);
      const pillW = 108 * S;
      const pillH = 38 * S;
      drawPopBox(-pillW / 2, -pillH / 2, pillW, pillH, 19 * S, '#FDE047', 2.5, COLORS.navy, 2.2);

      // 左侧小型矢量放大镜图标
      ctx.beginPath();
      ctx.arc(-34 * S, -1 * S, 6.5 * S, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 2 * S;
      ctx.strokeStyle = COLORS.navy;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-29.5 * S, 3.5 * S);
      ctx.lineTo(-24.5 * S, 8.5 * S);
      ctx.lineWidth = 2.4 * S;
      ctx.strokeStyle = COLORS.navy;
      ctx.stroke();

      ctx.fillStyle = COLORS.navy;
      ctx.font = `900 ${Math.round(10 * S)}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('发现证据', -19 * S, -5.5 * S);
      ctx.fillStyle = '#B91C1C';
      ctx.font = `900 ${Math.round(9.5 * S)}px sans-serif`;
      ctx.fillText('点击收取', -19 * S, 7.5 * S);
      ctx.restore();

      addHitRegion('btn_collect_scene_clue', hx - 60 * S, hy - 28 * S, 120 * S, 56 * S, () => {
        if (!state.pendingEvidence || state.pendingEvidence.collected) return;
        playFeedback('clue');
        const gain = Number(state.pendingEvidence.delta || 1);
        state.pendingEvidence.collected = true;
        state.collectedClues[clueKey] = true;
        state.stats.evidence = (state.stats.evidence || 0) + gain;
        if (!state.collectedEvidenceEps.includes(state.epIndex)) {
          state.collectedEvidenceEps.push(state.epIndex);
        }
        const lastHist = state.choiceHistory[state.choiceHistory.length - 1];
        if (lastHist) lastHist.evidenceCollected = true;
        toast(`已收取关键证物：${state.pendingEvidence.title}（已备材料 +${gain}）`);
        requestRender();
      });
    } else {
      const clueBtnW = 86 * S;
      drawButton(
        'btn_collect_scene_clue',
        W - padX - clueBtnW - 10 * S,
        curY + 10 * S,
        clueBtnW,
        24 * S,
        12 * S,
        COLORS.green,
        '[证据] 已入卷',
        COLORS.white,
        11 * S,
        2,
        () => {
          playFeedback('click');
          state.activeModal = 'clue';
          state.modalScrollY = 0;
          requestRender();
        }
      );
    }
  }

  curY += sceneH + 12 * S;

  // 底部按钮固定坐标（预留安全底边距，确保 3D 阴影完整显示）
  const footerH = 44 * S;
  const footerY = H - footerH - SAFE_BOTTOM;

  // 第五行：台词推进卡片 或 紧凑单行 1/2/3 拍板选项区
  const contentAvailH = footerY - curY - 10 * S;

  if (state.phase === 'panel' || state.phase === 'outcome') {
    const boxH = Math.min(176 * S, Math.max(106 * S, contentAvailH));
    drawDashedBox(padX, curY, W - padX * 2, boxH, 16 * S, COLORS.white, COLORS.navy);

    // 台词正文与说话人识别（自定义主演名自动代入旁白与高亮）
    const curPanel = panels[state.panelIndex] || {};
    const rawSource = state.phase === 'outcome'
      ? state.lastOutcomeText
      : (typeof curPanel === 'string' ? curPanel : (curPanel.text || ep.sceneDesc || '剧情正在推进...'));
    const rawDialogue = formatStoryDialogue(rawSource, script, epActor);
    const speakerInfo = detectDialogueSpeaker(rawSource, script, state.phase, epActor);

    ctx.font = `bold ${Math.round(10 * S)}px sans-serif`;
    const spkW = Math.min(W - padX * 2 - 120 * S, Math.max(84 * S, ctx.measureText(speakerInfo.label).width + 20 * S));
    drawPopBox(padX + 12 * S, curY + 10 * S, spkW, 20 * S, 10 * S, speakerInfo.bg, 0, COLORS.navy, 1.5);
    ctx.fillStyle = speakerInfo.fg;
    ctx.textAlign = 'center';
    ctx.fillText(speakerInfo.label, padX + 12 * S + spkW / 2, curY + 20.5 * S);

    ctx.fillStyle = COLORS.textSub;
    ctx.font = `bold ${Math.round(9.5 * S)}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`你的身份：${epRole.roleTitle}`, W - padX - 12 * S, curY + 20.5 * S);

    const maxDialogueLines = Math.min(6, Math.max(4, Math.floor((boxH - 42 * S) / (19.5 * S))));
    const richLines = layoutRichTextLines(rawDialogue, W - padX * 2 - 28 * S, 13 * S, true, script, epActor).slice(0, maxDialogueLines);
    drawRichTextLines(richLines, padX + 14 * S, curY + 46 * S, 19.5 * S, 13 * S, true, COLORS.navy);
  } else if (state.phase === 'choice') {
    // 紧凑拍板提示横条（明确主角身份与执行目标）
    const topHintH = 26 * S;
    const cGap = contentAvailH < 190 * S ? 4 * S : 6 * S;
    drawPopBox(padX, curY, W - padX * 2, topHintH, 10 * S, COLORS.yellowSoft, 0, COLORS.orange, 2);
    ctx.fillStyle = '#B45309';
    ctx.font = `bold ${Math.round(11.5 * S)}px sans-serif`;
    ctx.textAlign = 'left';
    const cmdPrompt = `指挥【${epRole.roleTitle} · ${epActor}】怎么行动：`;
    ctx.fillText(cmdPrompt.slice(0, 26), padX + 12 * S, curY + topHintH / 2 + 0.5 * S);

    let choiceY = curY + topHintH + 6 * S;
    const choices = (ep.choices || []).slice(0, 3);
    const badgeColors = [COLORS.cyan, COLORS.pink, COLORS.yellow];
    const pillH = Math.min(54 * S, Math.floor((contentAvailH - (topHintH + 6 * S)) / Math.max(3, choices.length)) - cGap);
    const shortActForChoice = epActor.length > 5 ? epActor.slice(0, 5) : epActor;

    choices.forEach((ch, idx) => {
      drawPopBox(padX, choiceY, W - padX * 2, pillH, 14 * S, COLORS.white, 3, COLORS.navy, 2.5);

      // 左侧 1 / 2 / 3 圆形编号徽章
      const circleR = 11.5 * S;
      const cx = padX + 20 * S;
      const cy = choiceY + pillH / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
      ctx.fillStyle = badgeColors[idx % 3];
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = COLORS.navy;
      ctx.stroke();

      ctx.fillStyle = idx === 1 ? COLORS.white : COLORS.navy;
      ctx.font = `900 ${Math.round(12 * S)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(idx + 1), cx, cy + 1);

      // 仅展示主角主语 + 拍板动作，隐藏流派标签与分值避免透题
      const rawTitle = (ch.text && ch.text.length > 1)
        ? ch.text
        : ((ch.label && ch.label.length > 1) ? ch.label : (ch.outcome || '推进剧情').slice(0, 16));
      const cleanTitle = String(rawTitle).replace(/^[A-D1-4][.、：:\s]*/, '');
      const actionLine = `让${shortActForChoice}：${cleanTitle}`;
      const actionLines = wrapTextLines(actionLine, W - padX * 2 - 58 * S, 13 * S, true).slice(0, 2);
      ctx.fillStyle = COLORS.navy;
      ctx.font = `bold ${Math.round(13 * S)}px sans-serif`;
      ctx.textAlign = 'left';
      if (actionLines.length <= 1) {
        ctx.fillText(actionLines[0] || actionLine, padX + 39 * S, choiceY + pillH / 2 + 0.5 * S);
      } else {
        const lineGap = 16.5 * S;
        const baseY = choiceY + pillH / 2 - lineGap / 2;
        ctx.fillText(actionLines[0], padX + 39 * S, baseY);
        ctx.fillText(actionLines[1], padX + 39 * S, baseY + lineGap);
      }

      addHitRegion('choice_btn_' + idx, padX, choiceY, W - padX * 2, pillH, () => {
        handleSelectChoice(ch, cleanTitle);
      });

      choiceY += pillH + cGap;
    });
  }

  // 第六行：底部固定按钮（回顾 | 继续）
  const revW = 82 * S;
  drawButton('btn_ep_review', padX, footerY, revW, footerH, 22 * S, COLORS.white, '回顾', COLORS.navy, 14.5 * S, 4, () => {
    playFeedback();
    state.activeModal = 'review';
    state.modalScrollY = 0;
    requestRender();
  });

  const contX = padX + revW + 12 * S;
  const contW = W - padX - contX;
  if (state.phase === 'choice') {
    drawButton('btn_ep_wait_choice', contX, footerY, contW, footerH, 22 * S, '#94A3B8', '请选择本集拍摄方向', COLORS.white, 14.5 * S, 4, () => {
      toast('请点击上方 1 / 2 / 3 选项拍板剧情方向');
    });
  } else {
    const totalPanels = Math.max(1, panels.length);
    const btnLabel = state.phase === 'outcome'
      ? (state.epIndex + 1 < totalEp ? `进入第 ${state.epIndex + 2} 集` : '杀青大吉 · 查看检验报告')
      : `继续 (${state.panelIndex + 1}/${totalPanels})`;

    drawButton('btn_ep_continue', contX, footerY, contW, footerH, 22 * S, COLORS.pink, btnLabel, COLORS.white, 15 * S, 4, () => {
      playFeedback();
      handleEpisodeContinue();
    });
  }
}

function handleEpisodeContinue() {
  const script = state.curScript || getCurrentScript();
  const episodes = (script && script.episodes) || [];
  const ep = episodes[state.epIndex] || {};
  const panels = ep.panels || [];

  if (state.phase === 'panel') {
    if (state.panelIndex + 1 < panels.length) {
      state.panelIndex += 1;
    } else {
      state.phase = 'choice';
      armTouchGuard(450);
    }
    requestRender();
    return;
  }

  if (state.phase === 'outcome') {
    if (state.epIndex + 1 < episodes.length) {
      state.pendingEvidence = null;
      state.epIndex += 1;
      state.panelIndex = 0;
      state.phase = 'panel';
      // 更新拍摄进度
      state.scriptProgress[script.scriptId] = {
        status: 'doing',
        epIndex: state.epIndex + 1,
        score: 0,
        views: '拍摄中',
        endingTitle: `拍至第 ${state.epIndex + 1} 集`,
        history: [...state.choiceHistory]
      };
      saveStorage();
      if (typeof wx !== 'undefined' && wx.request && (state.userId || state.openid)) {
        wx.request({
          url: API_BASE + '/app-api/duanju/progress/save',
          method: 'POST',
          header: { 'Content-Type': 'application/json' },
          data: {
            userId: state.userId || 0,
            openid: state.openid || '',
            scriptId: script.scriptId,
            scriptTitle: script.title,
            currentEpisode: state.epIndex + 1,
            currentPanel: state.panelIndex,
            historyChoices: state.choiceHistory,
            currentStats: state.stats,
            isFinished: '0'
          }
        });
      }
      requestRender();
    } else {
      finishShootingAndBuildReport();
    }
  }
}

function handleSelectChoice(ch, cleanTitle) {
  playFeedback('clap');
  const eff = ch.effects || {};
  state.stats.pleasure = state.stats.pleasure + Number(eff.pleasure || 0);
  state.stats.drama = state.stats.drama + Number(eff.drama || 0);
  state.stats.anger = state.stats.anger + Number(eff.anger || 0);
  state.stats.subversion = state.stats.subversion + Number(eff.subversion || 0);

  const script = state.curScript || getCurrentScript();
  const ep = (script.episodes && script.episodes[state.epIndex]) || {};
  const evDelta = Number(eff.evidence || 0);
  if (evDelta > 0) {
    state.pendingEvidence = {
      epIndex: state.epIndex,
      epNum: state.epIndex + 1,
      clueKey: 'ep' + (state.epIndex + 1),
      delta: evDelta,
      title: getEpisodeClueName(script, state.epIndex),
      collected: false
    };
  } else {
    state.pendingEvidence = null;
  }

  state.lastOutcomeText = formatStoryDialogue(ch.outcome || `导演拍板「${cleanTitle}」，全场镜头推近，戏剧张力瞬间拉满！`, script);
  state.choiceHistory.push({
    ep: state.epIndex + 1,
    epTitle: ep.title || `第 ${state.epIndex + 1} 集`,
    choiceId: ch.choiceId || ch.id || ch.label || '',
    choiceLabel: cleanTitle,
    targetEndingId: ch.targetEndingId || '',
    evidenceCollected: false,
    outcome: state.lastOutcomeText
  });
  state.phase = 'outcome';
  requestRender();
}

// 生成杀青报告并解锁结局图鉴（与服务端 resolveScriptEnding V2 判定对齐）
function finishShootingAndBuildReport() {
  state.pendingEvidence = null;
  const script = state.curScript || getCurrentScript();
  const endings = (script && script.endings) || [];
  let chosenEnding = null;

  for (let i = state.choiceHistory.length - 1; i >= 0; i--) {
    const tId = state.choiceHistory[i] && state.choiceHistory[i].targetEndingId;
    if (tId) {
      const directMatch = endings.find((e) => (e.id || e.endingId) === tId);
      if (directMatch) {
        chosenEnding = directMatch;
        break;
      }
    }
  }

  if (!chosenEnding && endings.length) {
    const choiceIds = state.choiceHistory.map((h) => h.choiceId);
    const sortedEndings = [...endings].sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));
    for (const end of sortedEndings) {
      const cond = end.condition || {};
      if (cond.default || cond.always) continue;
      const hasStatRule = Boolean((cond.minStats && Object.keys(cond.minStats).length) || (cond.maxStats && Object.keys(cond.maxStats).length) || cond.minAbsurd || cond.minThrill || cond.specialChoice);
      const passSpecial = !cond.specialChoice || choiceIds.includes(cond.specialChoice);
      const passFlags = (!Array.isArray(cond.allFlags) || cond.allFlags.length === 0 || hasStatRule) ? true : ((state.stats.evidence || 0) >= 3);
      const passAbsurd = !cond.minAbsurd || (state.stats.drama || 0) >= Number(cond.minAbsurd);
      const passThrill = !cond.minThrill || (state.stats.pleasure || 0) >= Number(cond.minThrill);
      const passMinStats = !cond.minStats || Object.entries(cond.minStats).every(([k, v]) => (state.stats[k] || 0) >= Number(v || 0));
      const passMaxStats = !cond.maxStats || Object.entries(cond.maxStats).every(([k, v]) => (state.stats[k] || 0) <= Number(v || 0));
      if (passSpecial && passFlags && passAbsurd && passThrill && passMinStats && passMaxStats) {
        chosenEnding = end;
        break;
      }
    }
    if (!chosenEnding) {
      chosenEnding = sortedEndings.find((e) => e.condition && (e.condition.always || e.condition.default))
        || endings.find((e) => e.type === 'triumph')
        || sortedEndings[sortedEndings.length - 1];
    }
  }

  if (!chosenEnding) {
    chosenEnding = {
      id: (script ? script.scriptId : 'script') + '.end1',
      type: 'triumph',
      title: '高能收官',
      text: '全剧顺利杀青，镜头定格在全场最燃反转瞬间。'
    };
  }

  const endId = chosenEnding.id || chosenEnding.endingId || (script.scriptId + '_end1');
  state.unlockedEndings[endId] = true;

  // 采用与服务端 calculateAndVerifyShoot 完全对齐的合法算分与票房换算公式
  let sumQualityBonus = 0;
  let highAbsurdCount = 0;
  let highThrillCount = 0;
  const episodes = (script && script.episodes) || [];
  state.choiceHistory.forEach((h, idx) => {
    const ep = episodes[idx];
    const choices = (ep && ep.choices) || [];
    const ch = choices.find((c) => (c.choiceId || c.id || c.label) === h.choiceId);
    const eff = (ch && ch.effects) || {};
    sumQualityBonus += (ch && ch.qualityBonus) || 15;
    if ((eff.absurd || eff.drama || 0) >= 15) highAbsurdCount++;
    if ((eff.thrill || eff.pleasure || 0) >= 12) highThrillCount++;
  });
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

  const rawScore = 44 + (sumQualityBonus * 0.38) + styleComboBonus + (chosenEnding.baseScoreBonus || 8) + Math.min(6, (state.stats.evidence || 0) * 1.2);
  const clampedScore = Math.min(99.5, Math.max(60.0, rawScore));
  const scoreStr = clampedScore.toFixed(2);
  const boxOfficeNum = Math.round(Math.pow(Math.max(50, clampedScore - 40), 3.35) * 850);
  const viewsNum = (boxOfficeNum / 100000000).toFixed(2);
  const dynEndTitle = chosenEnding.title || '高能收官';
  const dynComment = Number(scoreStr) >= 92
    ? `爆款热评：「${scoreStr} 分封神收官！【${dynEndTitle}】后劲太足了！」`
    : `观众点评：「本剧以 ${scoreStr} 分达成【${dynEndTitle}】，节拍利落！」`;

  state.reportData = {
    scriptId: script.scriptId,
    scriptTitle: script.title,
    endingId: endId,
    rarity: formatEndingType(chosenEnding.type || chosenEnding.badge || 'hidden'),
    endingTitle: dynEndTitle,
    endingText: chosenEnding.text || chosenEnding.summary || '全剧高能收官，欢迎查看完整回放！',
    score: scoreStr,
    viewsNum: Number(viewsNum),
    viewsText: `${viewsNum} 亿`,
    beatPercent: Math.min(99, Math.max(15, Math.round(clampedScore - 10))),
    styleBadge,
    comment: dynComment
  };

  state.scriptProgress[script.scriptId] = {
    status: 'done',
    epIndex: episodes.length || 6,
    score: scoreStr,
    views: `${viewsNum} 亿`,
    endingId: endId,
    endingTitle: state.reportData.endingTitle,
    endingText: state.reportData.endingText,
    history: [...state.choiceHistory]
  };
  saveStorage();

  const finalActorName = getScriptActorName(script);
  state.actorName = finalActorName;

  // 预生成本局完整成片分享码，确保分享好友时可直接展示全集选向与结局
  saveShareMovieSnapshot(script, state.reportData, state.choiceHistory, finalActorName);

  // 杀青战绩上报后端并同步解锁云端图鉴
  if (typeof wx !== 'undefined' && wx.request && (state.userId || state.openid)) {
    const choicePath = state.choiceHistory.map((h) => h.choiceId).filter(Boolean);
    wx.request({
      url: API_BASE + '/app-api/duanju/shoot/submit',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: {
        userId: state.userId || 0,
        openid: state.openid || '',
        nickname: state.directorName,
        scriptId: script.scriptId,
        actorName: finalActorName,
        choicePath,
        collectedEvidenceEps: [...state.collectedEvidenceEps],
        clientScore: Number(scoreStr),
        adBoosted: false
      },
      success(res) {
        if (res.data && res.data.code === 200 && res.data.data) {
          const d = res.data.data;
          const srvScore = d.finalScore ? Number(d.finalScore).toFixed(2) : scoreStr;
          const srvBox = Number(d.boxOffice || boxOfficeNum);
          const srvViews = (srvBox / 100000000).toFixed(2);
          if (state.reportData) {
            state.reportData.score = srvScore;
            state.reportData.viewsNum = Number(srvViews);
            state.reportData.viewsText = `${srvViews} 亿`;
            if (d.endingId) state.reportData.endingId = d.endingId;
            if (d.endingTitle) state.reportData.endingTitle = d.endingTitle;
            if (d.ending && d.ending.text) state.reportData.endingText = d.ending.text;
            if (d.beatPercent) state.reportData.beatPercent = Math.round(Number(d.beatPercent));
            if (d.styleBadge) state.reportData.styleBadge = d.styleBadge;
            if (d.comment) state.reportData.comment = d.comment;
          }
          if (state.scriptProgress[script.scriptId]) {
            state.scriptProgress[script.scriptId].score = srvScore;
            state.scriptProgress[script.scriptId].views = `${srvViews} 亿`;
          }
          state.shootCount = (state.shootCount || 0) + 1;
          state.bestScore = Math.max(state.bestScore || 0, Number(srvScore));
          state.totalBoxOffice = (state.totalBoxOffice || 0) + srvBox;
          saveStorage();
          syncUserCloudData();
          requestRender();
        } else {
          const errMsg = (res.data && res.data.msg) || '战绩同步失败，请稍后重试';
          console.warn('[Shoot Submit Rejected]:', errMsg);
          toast(errMsg);
        }
      },
      fail() {
        toast('网络异常，战绩暂存本地');
      }
    });

    wx.request({
      url: API_BASE + '/app-api/duanju/collection/unlock',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: {
        userId: state.userId || 0,
        openid: state.openid || '',
        scriptId: script.scriptId,
        endingId: endId,
        endingTitle: state.reportData.endingTitle,
        endingType: chosenEnding.type || 'triumph',
        choices: state.choiceHistory
      }
    });
  }

  armTouchGuard(450);
  state.view = 'report';
  playFeedback('fanfare');
  requestRender();
}

// ============================================================================
// 3. 杀青质量检验报告页视图 (REPORT VIEW)
// ============================================================================
function renderReportView() {
  const rep = state.reportData || {
    scriptTitle: (getCurrentScript() && getCurrentScript().title) || '未选择剧本',
    rarity: '待评级',
    endingTitle: '暂未杀青',
    endingText: '完成全部剧集拍摄后，将在此生成你的专属杀青报告。',
    score: '0.00',
    viewsNum: 0,
    viewsText: '0 播放',
    beatPercent: 0,
    comment: '暂未产生观众热评'
  };

  const padX = 16 * S;
  let curY = SAFE_TOP;

  // 顶部黄色胶囊：杀青大吉·剧集质量检验报告
  const pillW = 242 * S;
  drawPopBox((W - pillW) / 2, curY, pillW, 34 * S, 17 * S, COLORS.yellow, 3, COLORS.navy, 2.5);
  ctx.fillStyle = COLORS.navy;
  ctx.font = `900 ${Math.round(14 * S)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('杀青大吉 · 剧集质量检验报告', W / 2, curY + 17 * S);

  curY += 42 * S;

  // 紧凑计算白卡内部内容尺寸（片名与导演/主演分行排布防真机截断，结局代入主演三色高亮，按钮区整体上移防误触）
  const reportScript = state.scripts.find((s) => s.scriptId === rep.scriptId) || state.curScript || getCurrentScript();
  const formattedEndingText = formatStoryDialogue(rep.endingText, reportScript, state.actorName);
  const bannerX = padX + 14 * S;
  const bannerW = W - (padX + 14 * S) * 2;
  const bannerH = 62 * S;
  const scoreBoxH = 72 * S;
  const storyRichLines = layoutRichTextLines(formattedEndingText, bannerW - 8 * S, 12 * S, true, reportScript, state.actorName).slice(0, 3);
  const cmtH = 42 * S;
  const naturalCardH = 14 * S + 16 * S + 14 * S + bannerH + 10 * S + scoreBoxH + 10 * S + (Math.max(1, storyRichLines.length) * 18.5 * S + 8 * S) + cmtH + 10 * S;

  let btnH = 37 * S;
  let rowGap = 10 * S;
  let extraGroupGap = 14 * S;
  const calcBtnBlockH = () => (btnH * 4 + rowGap * 2 + extraGroupGap);
  const maxReportBottom = H - SAFE_BOTTOM - 8 * S;
  if (curY + naturalCardH + 10 * S + calcBtnBlockH() > maxReportBottom) {
    btnH = 33 * S;
    rowGap = 7 * S;
    extraGroupGap = 10 * S;
  }
  const cardH = Math.min(naturalCardH, Math.max(240 * S, maxReportBottom - curY - 10 * S - calcBtnBlockH()));

  // 白色主成绩单卡片
  drawPopBox(padX, curY, W - padX * 2, cardH, 20 * S, COLORS.white, 5, COLORS.navy, 3);

  let inY = curY + 14 * S;
  ctx.fillStyle = COLORS.navy;
  ctx.font = `900 ${Math.round(13.5 * S)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(fitTextToWidth(`《${rep.scriptTitle}》`, bannerW, 13.5 * S, true), W / 2, inY);

  inY += 16 * S;
  ctx.fillStyle = COLORS.textSub;
  ctx.font = `bold ${Math.round(11 * S)}px sans-serif`;
  ctx.textAlign = 'center';
  const dirLabel = fitTextToWidth(state.directorName || '微信导演', 110 * S, 11 * S, true);
  const actLabel = fitTextToWidth(state.actorName || '主角', 96 * S, 11 * S, true);
  ctx.fillText(`导演：${dirLabel}  ·  主演：${actLabel}`, W / 2, inY);

  inY += 14 * S;

  // 紫色结局大横幅
  drawPopBox(bannerX, inY, bannerW, bannerH, 14 * S, COLORS.purple, 3, COLORS.navy, 2.5);

  drawPopBox(W / 2 - 58 * S, inY + 7 * S, 116 * S, 19 * S, 9.5 * S, COLORS.yellow, 0, COLORS.navy, 1.8);
  ctx.fillStyle = COLORS.navy;
  ctx.font = `bold ${Math.round(10 * S)}px sans-serif`;
  ctx.fillText(rep.rarity, W / 2, inY + 17 * S);

  ctx.fillStyle = COLORS.white;
  ctx.font = `900 ${Math.round(16.5 * S)}px sans-serif`;
  ctx.fillText(rep.endingTitle.slice(0, 13), W / 2, inY + 44 * S);

  inY += bannerH + 10 * S;

  // 评分与播放量双栏卡
  drawPopBox(bannerX, inY, bannerW, scoreBoxH, 14 * S, '#FFFDF9', 0, COLORS.navy, 2);

  const leftCenterX = bannerX + bannerW * 0.27;
  const rightCenterX = bannerX + bannerW * 0.73;

  ctx.fillStyle = COLORS.textSub;
  ctx.font = `bold ${Math.round(10.5 * S)}px sans-serif`;
  ctx.fillText('综合拍摄质量评分', leftCenterX, inY + 14 * S);
  ctx.fillText('预估首日全网播放量', rightCenterX, inY + 14 * S);

  ctx.fillStyle = COLORS.pink;
  ctx.font = `900 ${Math.round(23.5 * S)}px sans-serif`;
  ctx.fillText(rep.score, leftCenterX, inY + 39 * S);

  ctx.fillStyle = COLORS.navy;
  ctx.font = `900 ${Math.round(21.5 * S)}px sans-serif`;
  ctx.fillText(rep.viewsText, rightCenterX, inY + 39 * S);

  drawPopBox(leftCenterX - 58 * S, inY + 51 * S, 116 * S, 16 * S, 8 * S, COLORS.purpleLight, 0, COLORS.purple, 1);
  ctx.fillStyle = COLORS.purple;
  ctx.font = `bold ${Math.round(9 * S)}px sans-serif`;
  ctx.fillText(rep.styleBadge || '成片流派评定', leftCenterX, inY + 59.5 * S);

  drawPopBox(rightCenterX - 58 * S, inY + 51 * S, 116 * S, 16 * S, 8 * S, COLORS.cyanSoft, 0, COLORS.cyan, 1);
  ctx.fillStyle = '#0284C7';
  ctx.fillText(`击败全国 ${rep.beatPercent}% 的导演`, rightCenterX, inY + 59.5 * S);

  inY += scoreBoxH + 10 * S;

  // 结局故事描述（代入主演名称并三色高亮）
  drawRichTextLines(storyRichLines, bannerX + 4 * S, inY + 4 * S, 18.5 * S, 12 * S, true, COLORS.navy);

  inY += Math.max(1, storyRichLines.length) * 18.5 * S + 8 * S;

  // 网友热评紧凑虚线框
  const remainCmtH = curY + cardH - inY - 10 * S;
  const finalCmtH = Math.min(cmtH, Math.max(34 * S, remainCmtH));
  if (remainCmtH >= 32 * S) {
    drawDashedBox(bannerX, inY, bannerW, finalCmtH, 12 * S, '#FAF5FF', '#A855F7');
    const cmtLines = wrapTextLines(rep.comment, bannerW - 20 * S, 11 * S, true).slice(0, 2);
    ctx.fillStyle = '#7E22CE';
    ctx.font = `bold ${Math.round(11 * S)}px sans-serif`;
    ctx.textAlign = 'left';
    cmtLines.forEach((l, idx) => {
      ctx.fillText(l, bannerX + 10 * S, inY + 13.5 * S + idx * 15 * S);
    });
  }

  // 操作按钮区整体上移且与最底端游戏继续热区错位，第4行增加安全隔离间距
  let actY = curY + cardH + 10 * S;

  // 第 1 行：观看完整成片
  drawButton('rep_btn_whole', padX, actY, W - padX * 2, btnH, 20 * S, COLORS.green, '观看完整成片：本片全景剧情回放', COLORS.white, 14 * S, 3.5, () => {
    playFeedback();
    openWholeStoryModal({ script: state.curScript || getCurrentScript(), fromFriend: false });
  });

  actY += btnH + rowGap;

  // 第 2 行：激励视频广告变现入口（看广告追加宣发：首日播放量 +25% 冲榜）
  drawButton(
    'rep_btn_ad',
    padX,
    actY,
    W - padX * 2,
    btnH,
    20 * S,
    COLORS.yellow,
    state.adBoosted ? '已完成广告宣发：首日播放量已 +25%' : '看广告追加宣发：首日播放量 +25% 冲榜',
    COLORS.navy,
    13.5 * S,
    3.5,
    () => {
      if (state.adBoosted) {
        playFeedback('click');
        toast('本局已享受过宣发加成');
        return;
      }
      playFeedback('fanfare');
      state.adBoosted = true;
      const boosted = (rep.viewsNum * 1.25).toFixed(2);
      rep.viewsNum = Number(boosted);
      rep.viewsText = `${boosted} 亿`;
      if (typeof wx !== 'undefined' && wx.request && (state.userId || state.openid)) {
        wx.request({
          url: API_BASE + '/app-api/duanju/game/boost',
          method: 'POST',
          header: { 'Content-Type': 'application/json' },
          data: {
            userId: state.userId || 0,
            openid: state.openid || '',
            scriptId: rep.scriptId || (state.curScript && state.curScript.scriptId) || 'script_01_zhuixu',
            boxOffice: Math.round(rep.viewsNum * 100000000)
          },
          success() { syncUserCloudData(); }
        });
      }
      toast('激励广告宣发成功！首日播放量 +25%');
      requestRender();
    }
  );

  actY += btnH + rowGap;

  // 第 3 行（双列并排）：生成杀青海报 | 发群里挑战好友
  const halfW = (W - padX * 2 - 10 * S) / 2;
  drawButton('rep_btn_poster', padX, actY, halfW, btnH, 20 * S, '#FDE047', '生成杀青海报', COLORS.navy, 13.5 * S, 3.5, () => {
    playFeedback();
    state.activeModal = 'poster';
    state.modalScrollY = 0;
    requestRender();
  });

  drawButton('rep_btn_share', padX + halfW + 10 * S, actY, halfW, btnH, 20 * S, '#3B82F6', '发群里挑战好友', COLORS.white, 13.5 * S, 3.5, () => {
    playFeedback();
    triggerShareFullMovie(state.curScript || getCurrentScript());
  });

  actY += btnH + extraGroupGap;

  // 第 4 行（双列并排）：换套路重拍 | 回放映厅
  drawButton('rep_btn_replay', padX, actY, halfW, btnH, 20 * S, COLORS.white, '换套路重拍', COLORS.navy, 14 * S, 3.5, () => {
    startEpisodeShooting(state.curScript || getCurrentScript());
  });

  drawButton('rep_btn_home', padX + halfW + 10 * S, actY, halfW, btnH, 20 * S, COLORS.white, '回放映厅', COLORS.navy, 14 * S, 3.5, () => {
    playFeedback();
    state.view = 'home';
    requestRender();
  });
}

// ============================================================================
// 4. 五大系统弹窗渲染 (MODALS: 排行榜 / 线索道具 / 36图鉴 / 选片大厅 / 片单 / 海报)
// ============================================================================
function renderActiveModal() {
  if (!state.activeModal) return;

  if (state.activeModal === 'inputDialog') {
    renderInputDialogModal();
    return;
  }

  // 半透明遮罩
  ctx.fillStyle = 'rgba(20, 24, 52, 0.62)';
  ctx.fillRect(0, 0, W, H);

  const mX = 16 * S;
  const mY = SAFE_TOP + 14 * S;
  const mW = W - mX * 2;
  const mH = H - mY - 24 * S;

  drawPopBox(mX, mY, mW, mH, 22 * S, COLORS.bg, 6, COLORS.navy, 3);

  // 弹窗顶部标题栏（1:1 对标 Web 版差异化高饱和实色顶栏，顶部圆角严格贴合外框）
  const targetWholeSc = (state.viewingFriendMovie && state.friendShareMovie)
    ? (state.scripts.find((s) => s.scriptId === state.friendShareMovie.scriptId) || getCurrentScript())
    : ((state.wholeStoryScriptId && state.scripts.find((s) => s.scriptId === state.wholeStoryScriptId)) || state.curScript || getCurrentScript());
  const wholeTitleStr = (state.viewingFriendMovie && state.friendShareMovie)
    ? `好友成片 · 《${(targetWholeSc && targetWholeSc.title) || state.friendShareMovie.scriptTitle || '短剧'}》`
    : `成片回放 · 《${(targetWholeSc && targetWholeSc.title) || '短剧'}》`;
  const titles = {
    rank: '全网播放总榜 · 排行榜系统',
    clue: '本剧线索本 · 案卷道具系统',
    collection: `我的图鉴 (${getUnlockedCount()}/${getTotalEndingCount()}) · 结局与海报收集`,
    hall: '换剧本 · 全题材选片大厅',
    schedule: '我的片单 · 拍摄档期与成片架',
    user: '导演中心 · 个人档案',
    poster: '杀青海报 · 8 款解锁配色预览',
    casting: `开拍通告单 · 《${((state.castingScript || getCurrentScript()) || {}).title || '剧本'}》`,
    movieShelf: '我的成片影片架',
    wholeStory: wholeTitleStr,
    review: `本片拍摄回顾 · 《${(targetWholeSc && targetWholeSc.title) || '短剧'}》`
  };
  const headStyles = {
    movieShelf: { bg: '#10B981', fg: '#FFFFFF' },
    wholeStory: { bg: '#10B981', fg: '#FFFFFF' },
    review: { bg: '#10B981', fg: '#FFFFFF' },
    user: { bg: '#1E2246', fg: '#FFFFFF' },
    hall: { bg: '#2563EB', fg: '#FFFFFF' },
    schedule: { bg: '#2563EB', fg: '#FFFFFF' },
    rank: { bg: '#FF5A8D', fg: '#FFFFFF' },
    casting: { bg: '#7C5CFF', fg: '#FFFFFF' }
  };
  const hStyle = headStyles[state.activeModal] || { bg: COLORS.pinkLight, fg: COLORS.navy };

  ctx.save();
  roundRectPath(mX, mY, mW, mH, 22 * S);
  ctx.clip();
  ctx.fillStyle = hStyle.bg;
  ctx.fillRect(mX, mY, mW, 48 * S);
  ctx.fillStyle = COLORS.navy;
  ctx.fillRect(mX, mY + 46 * S, mW, 2.5);
  ctx.restore();

  roundRectPath(mX, mY, mW, mH, 22 * S);
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.navy;
  ctx.stroke();

  ctx.fillStyle = hStyle.fg;
  ctx.font = `900 ${Math.round(15 * S)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText((titles[state.activeModal] || '系统弹窗').slice(0, 18), mX + 16 * S, mY + 24 * S);

  // 右上角关闭按钮
  drawButton('modal_close', mX + mW - 66 * S, mY + 10 * S, 54 * S, 28 * S, 14 * S, COLORS.white, '关闭', COLORS.navy, 12.5 * S, 2, () => {
    playFeedback();
    state.viewingFriendMovie = false;
    state.wholeStoryFromShelf = false;
    state.activeModal = null;
    requestRender();
  }, true);

  // 裁剪弹窗内容滚动区域
  const bodyX = mX + 12 * S;
  const bodyY = mY + 56 * S;
  const bodyW = mW - 24 * S;
  const bodyH = mH - 68 * S;

  ctx.save();
  roundRectPath(bodyX, bodyY, bodyW, bodyH, 12 * S);
  ctx.clip();

  const startY = bodyY - state.modalScrollY;
  let contentBottomY = startY;

  if (state.activeModal === 'rank') {
    contentBottomY = renderRankModalBody(bodyX, startY, bodyW, bodyY, bodyH);
  } else if (state.activeModal === 'clue') {
    contentBottomY = renderClueModalBody(bodyX, startY, bodyW);
  } else if (state.activeModal === 'collection') {
    contentBottomY = renderCollectionModalBody(bodyX, startY, bodyW, bodyY, bodyH);
  } else if (state.activeModal === 'hall' || state.activeModal === 'schedule') {
    contentBottomY = renderScheduleOrHallModalBody(bodyX, startY, bodyW, bodyY, bodyH);
  } else if (state.activeModal === 'user') {
    contentBottomY = renderUserModalBody(bodyX, startY, bodyW);
  } else if (state.activeModal === 'poster') {
    contentBottomY = renderPosterModalBody(bodyX, startY, bodyW);
  } else if (state.activeModal === 'casting') {
    contentBottomY = renderCastingModalBody(bodyX, startY, bodyW);
  } else if (state.activeModal === 'movieShelf') {
    contentBottomY = renderMovieShelfModalBody(bodyX, startY, bodyW, bodyY, bodyH);
  } else if (state.activeModal === 'wholeStory' || state.activeModal === 'review') {
    contentBottomY = renderStoryReviewModalBody(bodyX, startY, bodyW, bodyY, bodyH);
  }

  ctx.restore();

  state.modalMaxScroll = Math.max(0, (contentBottomY - startY) - bodyH + 20 * S);
}

// 4.1 排行榜系统弹窗内容
function renderRankModalBody(x, y, w, clipTop, clipH) {
  let curY = y + 4 * S;

  // 顶部激励说明卡
  drawPopBox(x, curY, w, 46 * S, 12 * S, COLORS.yellowSoft, 2, COLORS.navy, 2);
  ctx.fillStyle = COLORS.navy;
  ctx.font = `bold ${Math.round(11.5 * S)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('实时统计全网导演杀青首日播放量与综合质量评分', x + 12 * S, curY + 17 * S);
  ctx.fillStyle = COLORS.pink;
  ctx.fillText('杀青时观看激励视频广告追加宣发，可获 +25% 播放量冲榜！', x + 12 * S, curY + 34 * S);

  curY += 56 * S;

  // 排行榜列表数据（只显示真实数据，无数据展示空状态）
  const rows = Array.isArray(state.leaderboards) ? state.leaderboards : [];

  if (rows.length === 0) {
    drawPopBox(x, curY, w, 92 * S, 14 * S, COLORS.white, 2.5, COLORS.navy, 2);
    ctx.fillStyle = COLORS.navy;
    ctx.font = `900 ${Math.round(14 * S)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('暂无导演上榜，快去开拍抢占全服第一！', x + w / 2, curY + 36 * S);
    ctx.fillStyle = COLORS.textSub;
    ctx.font = `bold ${Math.round(11.5 * S)}px sans-serif`;
    ctx.fillText('完整拍完任意 6 集漫剧即可自动计入全网封神榜', x + w / 2, curY + 62 * S);
    curY += 102 * S;
  } else {
    rows.slice(0, 10).forEach((r, idx) => {
      const cardH = 62 * S;
      const rankColors = [COLORS.yellow, '#E2E8F0', '#FED7AA'];
      drawPopBox(x, curY, w, cardH, 14 * S, COLORS.white, 2.5, COLORS.navy, 2);

      // 排名徽章
      const badgeBg = idx < 3 ? rankColors[idx] : COLORS.pinkSoft;
      drawPopBox(x + 10 * S, curY + 13 * S, 36 * S, 36 * S, 10 * S, badgeBg, 0, COLORS.navy, 1.8);
      ctx.fillStyle = COLORS.navy;
      ctx.font = `900 ${Math.round(13 * S)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(idx < 3 ? `TOP${idx + 1}` : `#${idx + 1}`, x + 28 * S, curY + 31 * S);

      // 导演名与结局
      ctx.fillStyle = COLORS.navy;
      ctx.font = `bold ${Math.round(13.5 * S)}px sans-serif`;
      ctx.textAlign = 'left';
      const dirName = r.nickname || r.actorName || '神秘导演';
      ctx.fillText(dirName.slice(0, 9), x + 56 * S, curY + 23 * S);

      ctx.fillStyle = COLORS.textSub;
      ctx.font = `${Math.round(11 * S)}px sans-serif`;
      const endTxt = r.endingTitle || '传奇结局';
      ctx.fillText(`达成：${endTxt.slice(0, 12)}`, x + 56 * S, curY + 44 * S);

      // 右侧播放量与评分
      const viewsYi = r.boxOffice ? (Number(r.boxOffice) / 100000000).toFixed(2) + ' 亿' : '0.00 亿';
      ctx.fillStyle = COLORS.pink;
      ctx.font = `900 ${Math.round(14.5 * S)}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(viewsYi, x + w - 12 * S, curY + 24 * S);

      ctx.fillStyle = COLORS.navy;
      ctx.font = `bold ${Math.round(11 * S)}px sans-serif`;
      ctx.fillText(`质量分 ${Number(r.qualityScore || 0).toFixed(2)}`, x + w - 12 * S, curY + 44 * S);

      curY += cardH + 10 * S;
    });
  }

  // 我的最高战绩底栏
  drawPopBox(x, curY, w, 46 * S, 12 * S, COLORS.purpleLight, 2, COLORS.navy, 2);
  ctx.fillStyle = COLORS.navy;
  ctx.font = `bold ${Math.round(12.5 * S)}px sans-serif`;
  ctx.textAlign = 'left';
  const myBest = state.reportData
    ? `${state.reportData.viewsText} (${state.reportData.score}分)`
    : (state.bestScore > 0 ? `${(state.totalBoxOffice / 100000000).toFixed(2)} 亿 (${Number(state.bestScore).toFixed(2)}分)` : '暂无杀青记录');
  ctx.fillText(`我的导演署名：${state.directorName}`, x + 12 * S, curY + 17 * S);
  ctx.fillStyle = COLORS.purple;
  ctx.fillText(`我的最高单剧首日播放：${myBest}`, x + 12 * S, curY + 35 * S);

  return curY + 56 * S;
}

// 4.2 线索案卷道具系统弹窗内容
function renderClueModalBody(x, y, w) {
  let curY = y + 4 * S;
  const script = state.curScript || getCurrentScript();
  const totalEps = (script && Array.isArray(script.episodes) && script.episodes.length) || 0;
  const collectedCnt = Object.keys(state.collectedClues).length;

  // 顶部道具系统总览卡
  drawPopBox(x, curY, w, 58 * S, 14 * S, COLORS.yellowSoft, 3, COLORS.navy, 2);
  ctx.fillStyle = COLORS.navy;
  ctx.font = `900 ${Math.round(13.5 * S)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(`《${script ? script.title : '当前剧目'}》证物道具箱 (${collectedCnt}/${totalEps})`, x + 12 * S, curY + 20 * S);
  ctx.fillStyle = COLORS.textSub;
  ctx.font = `bold ${Math.round(11 * S)}px sans-serif`;
  ctx.fillText('选择搜证方向后，点击画面闪烁证物即可入卷解锁彩蛋', x + 12 * S, curY + 41 * S);

  curY += 68 * S;

  for (let i = 0; i < totalEps; i++) {
    const epKey = 'ep' + (i + 1);
    const isGot = !!state.collectedClues[epKey];
    const epObj = (script && script.episodes && script.episodes[i]) || {};
    const clueTitle = getEpisodeClueName(script, i);
    const cardH = 64 * S;

    drawPopBox(x, curY, w, cardH, 14 * S, isGot ? '#F0FDF4' : COLORS.white, 2.5, COLORS.navy, 2);

    // 左侧证物状态角标
    drawPopBox(x + 10 * S, curY + 12 * S, 54 * S, 40 * S, 10 * S, isGot ? COLORS.green : '#E2E8F0', 0, COLORS.navy, 1.8);
    ctx.fillStyle = isGot ? COLORS.white : COLORS.navy;
    ctx.font = `900 ${Math.round(11.5 * S)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(isGot ? '已入卷' : `第${i + 1}集`, x + 37 * S, curY + 32 * S);

    // 道具名称与来源描述
    ctx.fillStyle = COLORS.navy;
    ctx.font = `bold ${Math.round(13 * S)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(fitTextToWidth(clueTitle, w - (isGot ? 86 * S : 168 * S), 13 * S, true), x + 74 * S, curY + 23 * S);

    ctx.fillStyle = COLORS.textSub;
    ctx.font = `${Math.round(11 * S)}px sans-serif`;
    const epTitle = String(epObj.title || `第 ${i + 1} 集分镜现场`).replace(/^第\s*\d+\s*集\s*[：:]\s*/, '');
    ctx.fillText(`产出场景：第 ${i + 1} 集《${epTitle.slice(0, 10)}》`, x + 74 * S, curY + 44 * S);

    // 右侧仅展示状态徽章，禁止在线索本内直接白嫖收取
    if (!isGot) {
      const btnW = 76 * S;
      const btnX = x + w - btnW - 10 * S;
      const btnY = curY + 19 * S;
      drawPopBox(btnX, btnY, btnW, 26 * S, 13 * S, '#F1F5F9', 0, '#94A3B8', 1.5);
      ctx.fillStyle = '#64748B';
      ctx.font = `bold ${Math.round(10.5 * S)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('待现场收取', btnX + btnW / 2, btnY + 13.5 * S);
    }

    curY += cardH + 10 * S;
  }

  return curY + 10 * S;
}

// 4.3 我的图鉴与海报收集系统弹窗 (由云端剧本实际结局数量动态计算总数)
function renderCollectionModalBody(x, y, w, clipTop, clipH) {
  let curY = y + 4 * S;
  const unlockedCnt = getUnlockedCount();
  const totalCnt = getTotalEndingCount();
  const pct = totalCnt > 0 ? Math.min(100, Math.round((unlockedCnt / totalCnt) * 100)) : 0;

  // 顶部黄色收集总进度 Hero 大卡片
  const heroH = 92 * S;
  drawPopBox(x, curY, w, heroH, 16 * S, COLORS.yellow, 4, COLORS.navy, 2.5);

  ctx.fillStyle = COLORS.navy;
  ctx.font = `900 ${Math.round(17 * S)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(`已解锁 ${unlockedCnt} / ${totalCnt} 个漫剧结局`, x + 14 * S, curY + 24 * S);

  drawPopBox(x + w - 74 * S, curY + 12 * S, 60 * S, 22 * S, 11 * S, COLORS.white, 0, COLORS.navy, 1.8);
  ctx.fillStyle = COLORS.pink;
  ctx.font = `900 ${Math.round(11.5 * S)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`${pct}%`, x + w - 44 * S, curY + 23.5 * S);

  // 粉蓝渐变进度条
  const barX = x + 14 * S;
  const barW = w - 28 * S;
  roundRectPath(barX, curY + 42 * S, barW, 12 * S, 6 * S);
  ctx.fillStyle = COLORS.white;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = COLORS.navy;
  ctx.stroke();

  const ratio = totalCnt > 0 ? Math.min(1, unlockedCnt / totalCnt) : 0;
  const fillW = Math.max(16 * S, (barW - 4 * S) * ratio);
  roundRectPath(barX + 2 * S, curY + 44 * S, fillW, 8 * S, 4 * S);
  ctx.fillStyle = COLORS.pink;
  ctx.fill();

  ctx.fillStyle = COLORS.navy;
  ctx.font = `bold ${Math.round(10.5 * S)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(`每解锁 3 个结局解锁 1 款限量海报样式（共 ${POSTER_THEMES.length} 款）`, x + 14 * S, curY + 72 * S);

  curY += heroH + 14 * S;

  // 8 款杀青海报配色色卡展示
  drawPopBox(x, curY, w, 66 * S, 14 * S, COLORS.white, 2.5, COLORS.navy, 2);
  ctx.fillStyle = COLORS.navy;
  ctx.font = `bold ${Math.round(12 * S)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('已解锁杀青海报样式色卡（点击可切换默认海报风格）：', x + 12 * S, curY + 18 * S);

  const swGap = 6 * S;
  const swW = (w - 24 * S - swGap * 7) / 8;
  POSTER_THEMES.forEach((th, idx) => {
    const sx = x + 12 * S + idx * (swW + swGap);
    const sy = curY + 30 * S;
    drawPopBox(sx, sy, swW, 24 * S, 6 * S, th.bg, 0, COLORS.navy, idx === state.posterThemeIdx ? 2.5 : 1.5);
    addHitRegion('theme_sw_' + idx, sx, sy, swW, 24 * S, () => {
      playFeedback();
      state.posterThemeIdx = idx;
      toast(`已切换海报样式：${th.name}`);
      requestRender();
    }, true);
  });

  curY += 78 * S;

  // 按剧本分组展示 4 结局图鉴卡片 (2x2 网格)
  const cardGap = 10 * S;
  const colW = (w - cardGap) / 2;

  state.scripts.forEach((sc, sIdx) => {
    const endings = (sc.endings && sc.endings.length) ? sc.endings : [
      { id: sc.scriptId + '.end1', type: '传奇结局', title: '爽剧正统大团圆' },
      { id: sc.scriptId + '.end2', type: '稀有结局', title: '反套路整顿全员' },
      { id: sc.scriptId + '.end3', type: '普通结局', title: '全身而退笑看风云' },
      { id: sc.scriptId + '.end4', type: 'SSR·隐藏彩蛋', title: '证据闭环终极反转' }
    ];

    // 剧本分组头
    drawPopBox(x, curY, w, 34 * S, 10 * S, COLORS.pinkSoft, 2, COLORS.navy, 2);
    ctx.fillStyle = COLORS.navy;
    ctx.font = `900 ${Math.round(13 * S)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`《${sc.title}》 · 4 大结局图鉴`, x + 12 * S, curY + 17.5 * S);

    drawButton('col_go_shoot_' + sIdx, x + w - 84 * S, curY + 5 * S, 74 * S, 24 * S, 12 * S, COLORS.yellow, '去刷此剧', COLORS.navy, 11 * S, 1.5, () => {
      state.currentIndex = sIdx;
      startEpisodeShooting(sc);
    }, true);

    curY += 42 * S;

    for (let row = 0; row < 2; row++) {
      const rowH = 124 * S;
      if (curY + rowH >= clipTop - 30 * S && curY <= clipTop + clipH + 30 * S) {
        for (let col = 0; col < 2; col++) {
          const eIdx = row * 2 + col;
          const endObj = endings[eIdx] || endings[0];
          const eid = endObj.id || endObj.endingId || `${sc.scriptId}_end${eIdx + 1}`;
          const isUnlocked = !!state.unlockedEndings[eid];
          const cx = x + col * (colW + cardGap);

          drawPopBox(cx, curY, colW, rowH, 12 * S, isUnlocked ? COLORS.white : '#2A2E52', 2.5, COLORS.navy, 2);

          const artH = 74 * S;
          const artImg = getImage(getEndingArtPath(sc, endObj, eIdx)) || getImage(sc.coverImage);
          if (isUnlocked && artImg) {
            drawImageCover(artImg, cx + 5 * S, curY + 5 * S, colW - 10 * S, artH, 8 * S);
          } else {
            drawPopBox(cx + 5 * S, curY + 5 * S, colW - 10 * S, artH, 8 * S, isUnlocked ? '#FFE4EE' : '#191C38', 0, COLORS.navy, 1.5);
            ctx.fillStyle = isUnlocked ? COLORS.navy : COLORS.white;
            ctx.font = `900 ${Math.round(24 * S)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(isUnlocked ? 'SSR' : '?', cx + colW / 2, curY + 5 * S + artH / 2 + 2);
          }

          // 稀有度角标（全中文映射，绝不显示英文枚举）
          const rType = formatEndingType(endObj.type || endObj.badge);
          drawPopBox(cx + 9 * S, curY + 9 * S, 64 * S, 16 * S, 8 * S, isUnlocked ? COLORS.yellow : '#475569', 0, COLORS.navy, 1.2);
          ctx.fillStyle = isUnlocked ? COLORS.navy : COLORS.white;
          ctx.font = `bold ${Math.round(9 * S)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(rType.slice(0, 6), cx + 41 * S, curY + 17.5 * S);

          // 结局标题
          ctx.fillStyle = isUnlocked ? COLORS.navy : '#CBD5E1';
          ctx.font = `bold ${Math.round(11.5 * S)}px sans-serif`;
          ctx.textAlign = 'left';
          const titleStr = isUnlocked ? (endObj.title || '已解锁结局') : '未解锁 · 拍板探索此分支';
          ctx.fillText(titleStr.slice(0, 10), cx + 8 * S, curY + artH + 20 * S);

          ctx.fillStyle = isUnlocked ? COLORS.pink : '#94A3B8';
          ctx.font = `${Math.round(10 * S)}px sans-serif`;
          ctx.fillText(isUnlocked ? '已收录入图鉴' : '点击去拍摄解锁', cx + 8 * S, curY + artH + 37 * S);
        }
      }
      curY += rowH + 10 * S;
    }

    curY += 6 * S;
  });

  return curY;
}

// 4.4 换剧本选片大厅 & 我的片单弹窗
function renderScheduleOrHallModalBody(x, y, w, clipTop, clipH) {
  let curY = y + 4 * S;

  // 按 已杀青(0) -> 拍摄中(1) -> 未开拍(2) 排序；同组内主推优先再按后台排序号
  const list = state.scripts.map((sc, idx) => {
    const prog = state.scriptProgress[sc.scriptId];
    const order = prog ? (prog.status === 'done' ? 0 : 1) : 2;
    return { sc, idx, prog, order };
  });
  if (state.activeModal === 'schedule') {
    list.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      const recDiff = (b.sc.recommend ? 1 : 0) - (a.sc.recommend ? 1 : 0);
      if (recDiff !== 0) return recDiff;
      return (Number(a.sc.sortOrder) || (a.idx + 1)) - (Number(b.sc.sortOrder) || (b.idx + 1));
    });
  }

  list.forEach((item) => {
    const { sc, idx, prog } = item;
    const cardH = 82 * S;
    if (curY + cardH >= clipTop - 20 * S && curY <= clipTop + clipH + 20 * S) {
      drawPopBox(x, curY, w, cardH, 14 * S, COLORS.white, 3, COLORS.navy, 2);

      // 左侧封面缩略图
      const img = getImage(sc.coverImage);
      if (img) {
        drawImageCover(img, x + 8 * S, curY + 8 * S, 54 * S, 66 * S, 10 * S);
      } else {
        drawPopBox(x + 8 * S, curY + 8 * S, 54 * S, 66 * S, 10 * S, sc.coverTheme || COLORS.pinkSoft, 0, COLORS.navy, 1.5);
      }

      // 剧名与「主推」粉色胶囊标识（避免与右侧按钮碰撞）
      const isDoneItem = Boolean(prog && prog.status === 'done');
      const rightReserve = isDoneItem ? 140 * S : 84 * S;
      const recBadgeW = sc.recommend ? 36 * S : 0;
      const titleMaxW = Math.max(60 * S, w - 72 * S - rightReserve - recBadgeW);
      const displayTitle = fitTextToWidth(`《${sc.title}》`, titleMaxW, 13.5 * S, true);

      ctx.fillStyle = COLORS.navy;
      ctx.font = `900 ${Math.round(13.5 * S)}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayTitle, x + 70 * S, curY + 23 * S);

      if (sc.recommend) {
        const tw = ctx.measureText(displayTitle).width;
        const bx = x + 70 * S + tw + 4 * S;
        drawPopBox(bx, curY + 15 * S, 30 * S, 16 * S, 6 * S, '#FF5A8D', 0, COLORS.navy, 1.5);
        ctx.fillStyle = COLORS.white;
        ctx.font = `900 ${Math.round(9.5 * S)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('主推', bx + 15 * S, curY + 23.5 * S);
      }

      const statusText = prog
        ? (prog.status === 'done' ? `已杀青 · 评分 ${prog.score} · ${prog.views}` : `拍摄中 · 第 ${prog.epIndex || 1}/6 集`)
        : `${sc.tag || '互动漫剧'} · 共 6 集 · 4 种结局`;
      ctx.fillStyle = prog && prog.status === 'done' ? COLORS.green : COLORS.textSub;
      ctx.font = `bold ${Math.round(11 * S)}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(statusText.slice(0, 18), x + 70 * S, curY + 46 * S);

      ctx.fillStyle = COLORS.textSub;
      ctx.font = `${Math.round(10.5 * S)}px sans-serif`;
      ctx.fillText((sc.synopsis || '').slice(0, 16) + '...', x + 70 * S, curY + 65 * S);

      // 右侧操作胶囊（已杀青剧目提供「看成片」+「重拍」）
      if (prog && prog.status === 'done') {
        drawButton('hall_watch_' + idx, x + w - 134 * S, curY + 26 * S, 62 * S, 30 * S, 15 * S, COLORS.cyanSoft, '看成片', COLORS.navy, 11 * S, 2, () => {
          playFeedback();
          openWholeStoryModal({ script: sc, fromFriend: false });
        }, true);
        drawButton('hall_pick_' + idx, x + w - 66 * S, curY + 26 * S, 56 * S, 30 * S, 15 * S, COLORS.yellow, '重拍', COLORS.navy, 11 * S, 2, () => {
          state.currentIndex = idx;
          openCastingModal(sc);
        }, true);
      } else {
        drawButton('hall_pick_' + idx, x + w - 78 * S, curY + 26 * S, 68 * S, 30 * S, 15 * S, COLORS.yellow, '选片开拍', COLORS.navy, 11.5 * S, 2, () => {
          state.currentIndex = idx;
          openCastingModal(sc);
        }, true);
      }
    }
    curY += cardH + 10 * S;
  });

  return curY;
}

// 4.5 导演中心与设置系统弹窗（1:1 复刻 Web 预览版档案卡片视觉）
function renderUserModalBody(x, y, w) {
  let curY = y + 6 * S;
  const unlockedCnt = getUnlockedCount();
  const boxStr = state.totalBoxOffice >= 100000000 ? `${(state.totalBoxOffice / 100000000).toFixed(2)} 亿` : `${state.totalBoxOffice || 0}`;

  drawPopBox(x, curY, w, 152 * S, 16 * S, COLORS.white, 3.5, COLORS.navy, 2.2);

  // 顶部头像块 + 导演名称 & 编号
  drawPopBox(x + 12 * S, curY + 12 * S, 44 * S, 44 * S, 12 * S, '#7C5CFF', 0, COLORS.navy, 2);
  ctx.fillStyle = COLORS.white;
  ctx.font = `900 ${Math.round(13 * S)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('导演', x + 34 * S, curY + 34.5 * S);

  ctx.fillStyle = COLORS.navy;
  ctx.font = `900 ${Math.round(15.5 * S)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(state.directorName, x + 66 * S, curY + 25 * S);
  ctx.fillStyle = COLORS.textSub;
  ctx.font = `bold ${Math.round(11 * S)}px sans-serif`;
  ctx.fillText(`导演编号：#${state.userId || '-'}`, x + 66 * S, curY + 46 * S);

  // 中部 3 列独立数据统计格
  const statY = curY + 66 * S;
  const statGap = 8 * S;
  const statW = (w - 24 * S - statGap * 2) / 3;
  const statItems = [
    { lbl: '已拍作品', val: `${state.shootCount || 0} 部`, col: COLORS.navy },
    { lbl: '最高评分', val: `${Number(state.bestScore || 0).toFixed(1)} 分`, col: COLORS.pink },
    { lbl: '累计播放', val: state.totalBoxOffice >= 100000000 ? boxStr : `${boxStr} 次`, col: '#2563EB' }
  ];
  statItems.forEach((st, idx) => {
    const sx = x + 12 * S + idx * (statW + statGap);
    drawPopBox(sx, statY, statW, 44 * S, 10 * S, '#F8FAFC', 0, '#CBD5E1', 1.5);
    ctx.fillStyle = st.col;
    ctx.font = `900 ${Math.round(13 * S)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(st.val, sx + statW / 2, statY + 17 * S);
    ctx.fillStyle = COLORS.textSub;
    ctx.font = `bold ${Math.round(9.5 * S)}px sans-serif`;
    ctx.fillText(st.lbl, sx + statW / 2, statY + 34 * S);
  });

  // 底部图鉴收集进度条
  const totalEndingCnt = getTotalEndingCount();
  const barY = curY + 120 * S;
  ctx.fillStyle = COLORS.textSub;
  ctx.font = `bold ${Math.round(10.5 * S)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(`图鉴收集进度：${unlockedCnt} / ${totalEndingCnt}`, x + 14 * S, barY + 6 * S);

  const pbX = x + 132 * S;
  const pbW = w - 144 * S;
  roundRectPath(pbX, barY + 1 * S, pbW, 10 * S, 5 * S);
  ctx.fillStyle = '#E2E8F0';
  ctx.fill();
  const fillRatio = totalEndingCnt > 0 ? Math.min(1, unlockedCnt / totalEndingCnt) : 0;
  const fillW = Math.max(10 * S, pbW * fillRatio);
  roundRectPath(pbX, barY + 1 * S, fillW, 10 * S, 5 * S);
  ctx.fillStyle = COLORS.pink;
  ctx.fill();

  curY += 166 * S;

  // 1. 修改导演名称（弹出 Web 同款简洁输入弹窗，直接持久化至后端 MySQL）
  drawButton('user_edit_dir', x, curY, w, 40 * S, 20 * S, COLORS.yellow, '修改导演名称', COLORS.navy, 13.5 * S, 3, () => {
    openEditDirectorNameModal();
  }, true);

  curY += 50 * S;

  // 2. 音效开关设置
  drawButton('user_toggle_sound', x, curY, w, 38 * S, 19 * S, state.soundOn ? '#10B981' : COLORS.white, `游戏音效与震动：${state.soundOn ? '已开启' : '已关闭'}`, state.soundOn ? COLORS.white : COLORS.navy, 13 * S, 3, () => {
    toggleSound();
  }, true);

  return curY + 54 * S;
}

// 4.5A 1:1 复刻 Web 版波普自定义名称输入弹窗（深靛蓝顶栏 + 亮蓝描边白底输入框 + 右对齐 取消/确认）
function renderInputDialogModal() {
  const dlg = state.inputDialog;
  if (!dlg) return;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.fillRect(0, 0, W, H);

  // 先注册全屏遮罩热区：仅当键盘已唤起时点击弹窗外/空白处自动收起键盘（后续子控件热区优先命中）
  addHitRegion('dlg_backdrop', 0, 0, W, H, () => {
    if (dlg.focused) {
      hideInputKeyboard();
      requestRender();
    }
  }, true);

  const mW = Math.min(W - 44 * S, 326 * S);
  const mH = 196 * S;
  const mX = (W - mW) / 2;
  // 未唤起键盘时屏幕视觉居中，唤起键盘后自动上移避让软键盘
  const mY = dlg.focused
    ? Math.min(H * 0.24, SAFE_TOP + 48 * S)
    : Math.max(SAFE_TOP + 64 * S, (H - mH) / 2 - 20 * S);

  // 阴影与纯白圆角主体
  drawPopBox(mX, mY, mW, mH, 18 * S, COLORS.white, 6, COLORS.navy, 3);

  // 顶部深靛蓝 #1E2246 实色圆角顶栏（严丝合缝裁剪）
  ctx.save();
  roundRectPath(mX, mY, mW, mH, 18 * S);
  ctx.clip();
  ctx.fillStyle = '#1E2246';
  ctx.fillRect(mX, mY, mW, 46 * S);
  ctx.restore();

  roundRectPath(mX, mY, mW, mH, 18 * S);
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.navy;
  ctx.stroke();

  ctx.fillStyle = COLORS.white;
  ctx.font = `900 ${Math.round(15 * S)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(dlg.title, mX + 16 * S, mY + 23.5 * S);

  // 简洁引导文字
  const boxX = mX + 16 * S;
  const boxW = mW - 32 * S;
  ctx.fillStyle = '#475569';
  ctx.font = `bold ${Math.round(12.5 * S)}px sans-serif`;
  ctx.fillText((dlg.subtitle || '请输入名称：').slice(0, 24), boxX, mY + 66 * S);

  // 标志性 Web 亮蓝描边白底输入框
  const inpY = mY + 84 * S;
  const inpH = 40 * S;
  drawPopBox(boxX, inpY, boxW, inpH, 10 * S, COLORS.white, 0, '#2563EB', dlg.focused ? 2.6 : 2.0);

  const displayVal = dlg.value || '';
  ctx.fillStyle = displayVal ? COLORS.navy : '#94A3B8';
  ctx.font = `bold ${Math.round(14 * S)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(displayVal || dlg.placeholder, boxX + 12 * S, inpY + inpH / 2 + 0.5 * S);

  // 仅在点击输入框唤起键盘聚焦时显示蓝色竖线光标
  if (dlg.focused) {
    const tw = displayVal ? ctx.measureText(displayVal).width : 0;
    ctx.fillStyle = '#2563EB';
    ctx.fillRect(Math.min(boxX + boxW - 44 * S, boxX + 14 * S + tw), inpY + 11 * S, 1.8 * S, 18 * S);
  }

  ctx.fillStyle = '#94A3B8';
  ctx.font = `bold ${Math.round(10 * S)}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText(`${displayVal.length}/${dlg.maxLength}`, boxX + boxW - 10 * S, inpY + inpH / 2 + 0.5 * S);

  addHitRegion('dlg_focus_input', boxX, inpY, boxW, inpH, () => {
    playFeedback('click');
    showInputKeyboard(dlg.value, dlg.maxLength);
  }, true);

  // 底部按钮行：左轻量化恢复默认（仅修改主演时显示） + 右侧对称双胶囊 取消 / 确认
  const bY = mY + mH - 52 * S;
  if (dlg.mode === 'actor' && dlg.defaultResetValue && dlg.value !== dlg.defaultResetValue) {
    drawButton('dlg_reset_default', boxX, bY + 3 * S, 64 * S, 28 * S, 14 * S, '#F8FAFC', '恢复默认', COLORS.textSub, 10.5 * S, 1.5, () => {
      playFeedback('click');
      dlg.value = dlg.defaultResetValue;
      if (dlg.focused && typeof wx !== 'undefined' && typeof wx.updateKeyboard === 'function') {
        try { wx.updateKeyboard({ value: dlg.value }); } catch (e) {}
      }
      requestRender();
    }, true);
  }

  const okW = 84 * S;
  const cancelW = 72 * S;
  const gap = 8 * S;
  const okX = boxX + boxW - okW;
  const cancelX = okX - gap - cancelW;

  drawButton('dlg_cancel', cancelX, bY, cancelW, 34 * S, 17 * S, COLORS.white, '取消', COLORS.navy, 13 * S, 2.5, () => {
    playFeedback();
    closePopInputDialog(true);
  }, true);

  drawButton('dlg_confirm', okX, bY, okW, 34 * S, 17 * S, '#FF5A8D', '确认', COLORS.white, 13 * S, 2.5, () => {
    const clean = String(dlg.value || '').trim().slice(0, dlg.maxLength);
    if (!clean) {
      toast('输入名称不能为空');
      return;
    }
    const cb = dlg.onConfirm;
    const retModal = dlg.returnModal;
    hideInputKeyboard();
    state.inputDialog = null;
    state.activeModal = retModal;
    if (cb) cb(clean);
    requestRender();
  }, true);
}

// 4.5B 开拍通告单 · 选角与入戏确认弹窗（仅管理本剧主演名称，导演署名为只读账号信息）
function renderCastingModalBody(x, y, w) {
  let curY = y + 6 * S;
  const sc = state.castingScript || getCurrentScript();
  if (!sc) return curY;
  const profile = getScriptRoleProfile(sc);
  const actorName = getScriptActorName(sc);

  // 卡片 1：片名 -> 导演 -> 主演 -> 饰演 严格左对齐视觉层级
  const card1H = 136 * S;
  drawPopBox(x, curY, w, card1H, 16 * S, COLORS.yellowSoft, 3, COLORS.navy, 2);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.navy;
  ctx.font = `900 ${Math.round(14.5 * S)}px sans-serif`;
  ctx.fillText(`片名：${fitTextToWidth('《' + sc.title + '》', w - 76 * S, 14.5 * S, true)}`, x + 14 * S, curY + 22 * S);

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.textSub;
  ctx.font = `bold ${Math.round(12.5 * S)}px sans-serif`;
  ctx.fillText(`导演：${fitTextToWidth(state.directorName || '微信导演', w - 76 * S, 12.5 * S, true)}`, x + 14 * S, curY + 48 * S);

  // 剧组与主演分隔线
  ctx.fillStyle = 'rgba(30, 34, 70, 0.14)';
  ctx.fillRect(x + 14 * S, curY + 65 * S, w - 28 * S, 1);

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.navy;
  ctx.font = `900 ${Math.round(13.5 * S)}px sans-serif`;
  ctx.fillText(`主演：${fitTextToWidth(actorName, w - 160 * S, 13.5 * S, true)}`, x + 14 * S, curY + 86 * S);

  drawButton('cast_edit_actor', x + w - 94 * S, curY + 73 * S, 80 * S, 26 * S, 13 * S, COLORS.yellow, '改主演名', COLORS.navy, 11 * S, 2, () => {
    openEditActorNameModal(sc);
  }, true);

  // 必须显式重设 textAlign，避免受 drawButton 内部 center 对齐状态影响导致文字被裁出左边界
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.pink;
  ctx.font = `bold ${Math.round(12 * S)}px sans-serif`;
  ctx.fillText(`饰演：${fitTextToWidth(profile.roleTitle, w - 76 * S, 12 * S, true)}`, x + 14 * S, curY + 115 * S);

  curY += card1H + 12 * S;

  // 卡片 2：角色入戏导读卡片
  drawPopBox(x, curY, w, 176 * S, 16 * S, COLORS.white, 3, COLORS.navy, 2);
  drawPopBox(x + 12 * S, curY + 12 * S, 88 * S, 20 * S, 10 * S, '#2563EB', 0, COLORS.navy, 1.5);
  ctx.fillStyle = COLORS.white;
  ctx.font = `bold ${Math.round(10 * S)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('角色入戏说明', x + 56 * S, curY + 22.5 * S);

  const introLines = wrapTextLines(profile.intro, w - 28 * S, 12.5 * S, true).slice(0, 3);
  ctx.fillStyle = COLORS.navy;
  ctx.font = `bold ${Math.round(12.5 * S)}px sans-serif`;
  ctx.textAlign = 'left';
  introLines.forEach((line, idx) => {
    ctx.fillText(line, x + 14 * S, curY + 52 * S + idx * 19 * S);
  });

  const oppLines = wrapTextLines(profile.opponents, w - 28 * S, 11 * S, true).slice(0, 2);
  ctx.fillStyle = COLORS.pink;
  ctx.font = `bold ${Math.round(11 * S)}px sans-serif`;
  oppLines.forEach((line, idx) => {
    ctx.fillText(line, x + 14 * S, curY + 114 * S + idx * 17 * S);
  });

  const hintLines = wrapTextLines(`主演【${actorName}】（${profile.roleTitle}）将自动代入全剧台词与结局，每集由你拍板决定 TA 的行动！`, w - 28 * S, 10.5 * S, true).slice(0, 2);
  ctx.fillStyle = COLORS.textSub;
  ctx.font = `${Math.round(10.5 * S)}px sans-serif`;
  hintLines.forEach((line, idx) => {
    ctx.fillText(line, x + 14 * S, curY + 149 * S + idx * 15 * S);
  });

  curY += 190 * S;

  // 底部确认开机大按钮
  drawButton('cast_confirm_start', x, curY, w, 44 * S, 22 * S, COLORS.pink, '确认角色 · 开机拍第 1 集', COLORS.white, 15 * S, 3.5, () => {
    state.activeModal = null;
    startEpisodeShooting(sc);
  }, true);

  return curY + 58 * S;
}

// 4.6 杀青海报 8 款样式预览弹窗
function renderPosterModalBody(x, y, w) {
  let curY = y + 4 * S;
  const theme = POSTER_THEMES[state.posterThemeIdx] || POSTER_THEMES[0];
  const rep = state.reportData || {
    scriptTitle: (getCurrentScript() && getCurrentScript().title) || '未选择剧本',
    rarity: '待评级',
    endingTitle: '暂未杀青',
    score: '0.00',
    viewsText: '0 播放'
  };

  // 海报画布框
  const pH = 260 * S;
  drawPopBox(x, curY, w, pH, 18 * S, theme.bg, 4, COLORS.navy, 3);
  drawPopBox(x + 14 * S, curY + 14 * S, w - 28 * S, pH - 28 * S, 14 * S, theme.card, 0, COLORS.navy, 2);

  ctx.fillStyle = theme.accent;
  ctx.font = `900 ${Math.round(13 * S)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`《漫剧大导演》官方杀青战报 · ${theme.name}`, x + w / 2, curY + 42 * S);

  ctx.fillStyle = COLORS.navy;
  ctx.font = `900 ${Math.round(20 * S)}px sans-serif`;
  ctx.fillText(`《${rep.scriptTitle}》`, x + w / 2, curY + 78 * S);

  drawPopBox(x + 34 * S, curY + 98 * S, w - 68 * S, 54 * S, 12 * S, theme.accent, 2, COLORS.navy, 2);
  ctx.fillStyle = COLORS.white;
  ctx.font = `900 ${Math.round(16 * S)}px sans-serif`;
  ctx.fillText(rep.endingTitle.slice(0, 12), x + w / 2, curY + 126 * S);

  ctx.fillStyle = COLORS.navy;
  ctx.font = `900 ${Math.round(15 * S)}px sans-serif`;
  ctx.fillText(`质量评分：${rep.score} 分   首日播放：${rep.viewsText}`, x + w / 2, curY + 184 * S);

  ctx.fillStyle = COLORS.textSub;
  ctx.font = `bold ${Math.round(12 * S)}px sans-serif`;
  const posterCredit = fitTextToWidth(`总导演：${state.directorName}   领衔主演：${state.actorName}`, w - 44 * S, 12 * S, true);
  ctx.fillText(posterCredit, x + w / 2, curY + 216 * S);

  curY += pH + 16 * S;

  // 切换 8 款配色按钮
  drawButton('poster_switch_theme', x, curY, w, 40 * S, 20 * S, COLORS.yellow, `切换海报样式 (${state.posterThemeIdx + 1}/8：${theme.name})`, COLORS.navy, 13.5 * S, 3, () => {
    playFeedback();
    state.posterThemeIdx = (state.posterThemeIdx + 1) % POSTER_THEMES.length;
    requestRender();
  }, true);

  curY += 50 * S;

  drawButton('poster_save_album', x, curY, w, 40 * S, 20 * S, COLORS.green, '保存高清杀青海报到手机相册', COLORS.white, 13.5 * S, 3, () => {
    playFeedback();
    if (typeof wx !== 'undefined' && wx.canvasToTempFilePath) {
      wx.canvasToTempFilePath({
        canvas,
        success(res) {
          if (wx.saveImageToPhotosAlbum) {
            wx.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success() { toast('海报已保存至手机相册！'); },
              fail() { toast('海报已生成！'); }
            });
          } else {
            toast('海报已生成！');
          }
        },
        fail() { toast('海报已生成！'); }
      });
    } else {
      toast('海报已生成并保存！');
    }
  }, true);

  return curY + 52 * S;
}

function resolveMoviePlaybackData() {
  const isFriend = Boolean(state.viewingFriendMovie && state.friendShareMovie);
  if (isFriend) {
    const fm = state.friendShareMovie;
    const script = state.scripts.find((s) => s.scriptId === fm.scriptId) || getCurrentScript();
    const rawHist = Array.isArray(fm.historyChoices) ? fm.historyChoices : [];
    const actorName = fm.actorName || getScriptActorName(script);
    const episodes = (script && script.episodes) || [];
    const endings = (script && script.endings) || [];
    const matchedEnd = endings.find((e) => (e.id || e.endingId) === fm.endingId || e.title === fm.endingTitle);
    const endingText = fm.endingText || (matchedEnd && matchedEnd.text) || '';
    const scoreStr = fm.qualityScore ? Number(fm.qualityScore).toFixed(2) : '85.00';
    const rawBo = String(fm.boxOffice || '0');
    const viewsText = rawBo.includes('亿') || rawBo.includes('万') ? rawBo : (Number(rawBo) >= 100000000 ? `${(Number(rawBo) / 100000000).toFixed(2)} 亿` : `${rawBo} 播放`);

    const resolvedHist = rawHist.map((item, idx) => {
      const ep = episodes[idx] || {};
      const chId = typeof item === 'string' ? item : (item && (item.choiceId || item.id)) || '';
      const matchedCh = (ep.choices || []).find((c) => (c.choiceId || c.id || c.label) === chId) || {};
      return {
        ep: idx + 1,
        choiceId: chId || matchedCh.choiceId || '',
        choiceLabel: (typeof item === 'object' && item && item.choiceLabel) || matchedCh.text || matchedCh.label || '推进剧情',
        outcome: (typeof item === 'object' && item && item.outcome) || matchedCh.outcome || matchedCh.feedback || ''
      };
    });

    return {
      isFriend: true,
      script,
      directorName: fm.nickname || '好友导演',
      actorName,
      scoreStr,
      viewsText,
      isFinished: true,
      endingTitle: fm.endingTitle || '已杀青完结',
      endingBadge: (matchedEnd && formatEndingType(matchedEnd.type || matchedEnd.badge)) || '好友成片',
      endingText,
      history: resolvedHist
    };
  }

  const script = (state.wholeStoryScriptId && state.scripts.find((s) => s.scriptId === state.wholeStoryScriptId))
    || state.curScript
    || getCurrentScript();
  const prog = (script && state.scriptProgress && state.scriptProgress[script.scriptId]) || null;
  const actorName = getScriptActorName(script);
  const episodes = (script && script.episodes) || [];
  const endings = (script && script.endings) || [];

  let rawHist = [];
  if (state.view === 'episode' && state.curScript && script && state.curScript.scriptId === script.scriptId && Array.isArray(state.choiceHistory) && state.choiceHistory.length > 0) {
    rawHist = state.choiceHistory;
  } else if (state.view === 'report' && state.reportData && script && state.reportData.scriptId === script.scriptId && Array.isArray(state.choiceHistory) && state.choiceHistory.length > 0) {
    rawHist = state.choiceHistory;
  } else if (prog && Array.isArray(prog.history) && prog.history.length > 0) {
    rawHist = prog.history;
  }

  const resolvedHist = rawHist.map((item, idx) => {
    const ep = episodes[idx] || {};
    const chId = typeof item === 'string' ? item : (item && (item.choiceId || item.id)) || '';
    const matchedCh = (ep.choices || []).find((c) => (c.choiceId || c.id || c.label) === chId) || {};
    return {
      ep: idx + 1,
      choiceId: chId || matchedCh.choiceId || '',
      choiceLabel: (typeof item === 'object' && item && item.choiceLabel) || matchedCh.text || matchedCh.label || '推进剧情',
      outcome: (typeof item === 'object' && item && item.outcome) || matchedCh.outcome || matchedCh.feedback || ''
    };
  });

  const rep = (state.reportData && script && state.reportData.scriptId === script.scriptId) ? state.reportData : null;
  const isFinished = Boolean((prog && prog.status === 'done') || resolvedHist.length >= episodes.length);
  const endObj = endings.find((e) => (rep && (e.id || e.endingId) === rep.endingId) || (prog && ((e.id || e.endingId) === prog.endingId || e.title === prog.endingTitle))) || (isFinished ? endings[0] : null);

  return {
    isFriend: false,
    script,
    directorName: state.directorName || '微信导演',
    actorName,
    scoreStr: (rep && rep.score) || (prog && prog.score ? String(prog.score) : '拍摄中'),
    viewsText: (rep && rep.viewsText) || (prog && prog.views) || '待结算',
    isFinished,
    endingTitle: (rep && rep.endingTitle) || (prog && prog.endingTitle) || (endObj && endObj.title) || '拍摄进行中',
    endingBadge: (rep && rep.rarity) || (endObj ? formatEndingType(endObj.type || endObj.badge) : '拍摄中'),
    endingText: (rep && rep.endingText) || (prog && prog.endingText) || (endObj && endObj.text) || '',
    history: resolvedHist
  };
}

// 4.6B 1:1 复刻 Web 版【我的成片影片架】（汇总条 + 双列海报网格 + 三态徽标与排序）
function renderMovieShelfModalBody(x, y, w, clipTop, clipH) {
  let curY = y + 4 * S;
  const scripts = Array.isArray(state.scripts) ? state.scripts : [];
  if (scripts.length === 0) {
    drawPopBox(x, curY, w, 84 * S, 12 * S, COLORS.white, 2, COLORS.navy, 2);
    ctx.fillStyle = COLORS.navy;
    ctx.font = `900 ${Math.round(13.5 * S)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('暂无影片数据', x + w / 2, curY + 42 * S);
    return curY + 96 * S;
  }

  // 与 Web 预览版 openMovieShelfModal 完全一致的状态分类与排序：已杀青(评分降序) -> 拍摄中(集数降序) -> 待开拍
  const items = scripts.map((sc, idx) => {
    const prog = (state.scriptProgress && state.scriptProgress[sc.scriptId]) || null;
    let statusRank = 2;
    if (prog && prog.status === 'done') {
      statusRank = 0;
    } else if (prog && ((Number(prog.epIndex || 1) > 1) || (Array.isArray(prog.history) && prog.history.length > 0))) {
      statusRank = 1;
    }
    return { sc, idx, prog, statusRank };
  }).sort((a, b) => {
    if (a.statusRank !== b.statusRank) return a.statusRank - b.statusRank;
    if (a.statusRank === 0) return Number((b.prog && b.prog.score) || 0) - Number((a.prog && a.prog.score) || 0);
    if (a.statusRank === 1) return Number((b.prog && b.prog.epIndex) || 0) - Number((a.prog && a.prog.epIndex) || 0);
    return a.idx - b.idx;
  });

  const finishedCnt = items.filter((it) => it.statusRank === 0).length;
  const shootingCnt = items.filter((it) => it.statusRank === 1).length;

  // 顶部黄色汇总胶囊条 (.movie-shelf-summary)
  const sumH = 34 * S;
  if (curY + sumH >= clipTop - 20 * S && curY <= clipTop + clipH + 20 * S) {
    drawPopBox(x, curY, w, sumH, 12 * S, '#FEF9C3', 2, COLORS.navy, 2);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#64748B';
    ctx.font = `bold ${Math.round(10 * S)}px sans-serif`;
    ctx.textAlign = 'right';
    const rightHint = '点卡片播放';
    const rightW = ctx.measureText(rightHint).width;
    ctx.fillText(rightHint, x + w - 10 * S, curY + sumH / 2 + 0.5 * S);

    ctx.fillStyle = COLORS.navy;
    ctx.font = `900 ${Math.round(11 * S)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(
      fitTextToWidth(`已杀青 ${finishedCnt} 部 · 拍摄中 ${shootingCnt} 部 · 共 ${items.length} 部`, w - rightW - 26 * S, 11 * S, true),
      x + 10 * S,
      curY + sumH / 2 + 0.5 * S
    );
  }
  curY += sumH + 10 * S;

  // 双列海报网格 (.movie-shelf-grid)
  const colGap = 10 * S;
  const rowGap = 10 * S;
  const cardW = (w - colGap) / 2;
  const posterW = cardW - 16 * S;
  const posterH = Math.round(posterW * 1.18);
  const cardH = posterH + 92 * S;

  for (let i = 0; i < items.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cardX = x + col * (cardW + colGap);
    const cardY = curY + row * (cardH + rowGap);

    if (cardY + cardH >= clipTop - 20 * S && cardY <= clipTop + clipH + 20 * S) {
      const { sc, idx, prog, statusRank } = items[i];
      const epTotal = (sc.episodes && sc.episodes.length) || 6;

      let cardBg = '#F8FAFC';
      let cardBorder = '#94A3B8';
      let badgeBg = '#64748B';
      let badgeFg = COLORS.white;
      let badgeText = '待开拍';
      let metaText = `主演：${fitTextToWidth(getScriptActorName(sc), 62 * S, 10 * S, true)} · 共 ${epTotal} 集`;
      let ctaBg = COLORS.white;
      let ctaFg = '#475569';
      let ctaShadow = 0;
      let ctaText = '去开拍第 1 集';

      if (statusRank === 0) {
        cardBg = '#F0FDF4';
        cardBorder = '#16A34A';
        badgeBg = '#16A34A';
        badgeFg = COLORS.white;
        const scScore = prog && prog.score ? Number(prog.score).toFixed(2) : '98.50';
        badgeText = `已杀青 · ${scScore}分`;
        const viewsStr = String((prog && prog.views) || '').trim();
        metaText = viewsStr ? (viewsStr.includes('播放') ? viewsStr : `${viewsStr} 播放`) : `全 ${epTotal} 集完整成片`;
        ctaBg = '#22C55E';
        ctaFg = COLORS.white;
        ctaShadow = 2;
        ctaText = '播放完整成片';
      } else if (statusRank === 1) {
        cardBg = '#FFFBEB';
        cardBorder = '#D97706';
        badgeBg = '#F59E0B';
        badgeFg = COLORS.navy;
        const epNow = (prog && prog.epIndex) || 1;
        badgeText = `拍摄中 · ${epNow}/${epTotal}集`;
        metaText = `已拍至第 ${epNow} 集，可先看样片`;
        ctaBg = '#2563EB';
        ctaFg = COLORS.white;
        ctaShadow = 2;
        ctaText = '观看已拍样片';
      }

      // 卡片外框
      if (statusRank === 2) {
        drawDashedBox(cardX, cardY, cardW, cardH, 14 * S, cardBg, cardBorder);
      } else {
        drawPopBox(cardX, cardY, cardW, cardH, 14 * S, cardBg, 3, cardBorder, 2.4);
      }

      // 剧照封面框
      const pX = cardX + 8 * S;
      const pY = cardY + 8 * S;
      const coverImg = getImage(sc.coverImage);
      if (coverImg) {
        if (statusRank === 2) {
          ctx.save();
          ctx.globalAlpha = 0.72;
          drawImageCover(coverImg, pX, pY, posterW, posterH, 10 * S);
          ctx.restore();
          ctx.save();
          roundRectPath(pX, pY, posterW, posterH, 10 * S);
          ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
          ctx.fill();
          ctx.restore();
        } else {
          drawImageCover(coverImg, pX, pY, posterW, posterH, 10 * S);
        }
      } else {
        drawPopBox(pX, pY, posterW, posterH, 10 * S, sc.coverTheme || '#E2E8F0', 0, COLORS.navy, 0);
      }
      roundRectPath(pX, pY, posterW, posterH, 10 * S);
      ctx.lineWidth = 2;
      ctx.strokeStyle = COLORS.navy;
      ctx.stroke();

      // 左上角状态角标
      ctx.font = `900 ${Math.round(9.5 * S)}px sans-serif`;
      const bW = Math.min(posterW - 12 * S, Math.max(46 * S, ctx.measureText(badgeText).width + 12 * S));
      drawPopBox(pX + 6 * S, pY + 6 * S, bW, 18 * S, 6 * S, badgeBg, 0, COLORS.navy, 1.5);
      ctx.fillStyle = badgeFg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, pX + 6 * S + bW / 2, pY + 15.5 * S);

      // 剧名标题
      ctx.fillStyle = COLORS.navy;
      ctx.font = `900 ${Math.round(12.5 * S)}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(fitTextToWidth(`《${sc.title}》`, posterW, 12.5 * S, true), pX, pY + posterH + 17 * S);

      // 播放量 / 拍摄进度 / 主演信息
      ctx.fillStyle = '#64748B';
      ctx.font = `bold ${Math.round(10.5 * S)}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(fitTextToWidth(metaText, posterW, 10.5 * S, true), pX, pY + posterH + 35 * S);

      // 底部状态操作胶囊
      const ctaY = cardY + cardH - 35 * S;
      const ctaH = 26 * S;
      drawPopBox(pX, ctaY, posterW, ctaH, 13 * S, ctaBg, ctaShadow, COLORS.navy, 2);
      ctx.fillStyle = ctaFg;
      ctx.font = `900 ${Math.round(11 * S)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(ctaText, pX + posterW / 2, ctaY + ctaH / 2 + 0.5 * S);

      // 热区严格裁剪到弹窗主体可视区域，防止滚动后穿透顶栏关闭按钮
      const visTop = Math.max(clipTop, cardY);
      const visBottom = Math.min(clipTop + clipH, cardY + cardH);
      if (visBottom > visTop + 4 * S) {
        addHitRegion('shelf_card_' + i, cardX, visTop, cardW, visBottom - visTop, () => {
          playFeedback('click');
          if (statusRank === 0 || statusRank === 1) {
            openWholeStoryModal({ script: sc, fromFriend: false, fromShelf: true });
          } else {
            state.currentIndex = idx;
            openCastingModal(sc);
          }
        }, true);
      }
    }
  }

  const totalRows = Math.ceil(items.length / 2);
  return curY + totalRows * (cardH + rowGap) + 4 * S;
}

// 4.7 完整成片回放 & 台词回顾弹窗（含分镜图、全部台词、每集全部 3 个选择方向对比、大结局正片）
function renderStoryReviewModalBody(x, y, w, clipTop, clipH) {
  let curY = y + 4 * S;
  const movie = resolveMoviePlaybackData();
  const script = movie.script;
  const isReviewMode = state.activeModal === 'review';

  if (!script) {
    drawPopBox(x, curY, w, 84 * S, 12 * S, COLORS.white, 2, COLORS.navy, 2);
    ctx.fillStyle = COLORS.navy;
    ctx.font = `900 ${Math.round(13.5 * S)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('暂无剧本数据，请先选择剧本开拍！', x + w / 2, curY + 42 * S);
    return curY + 96 * S;
  }

  // 从影片架进入回放时顶部提供返回影片架导航条 (.shelf-back-bar)
  if (state.wholeStoryFromShelf && !movie.isFriend && !isReviewMode) {
    const barH = 36 * S;
    if (curY + barH >= (clipTop || 0) - 20 && curY <= (clipTop || 0) + (clipH || H) + 20) {
      drawPopBox(x, curY, w, barH, 12 * S, '#F1F5F9', 0, COLORS.navy, 2);
      const backBtnX = x + 8 * S;
      const backBtnY = curY + 6 * S;
      const backBtnW = 94 * S;
      const backBtnH = 24 * S;
      drawPopBox(backBtnX, backBtnY, backBtnW, backBtnH, 12 * S, COLORS.white, 1.5, COLORS.navy, 1.8);
      ctx.fillStyle = COLORS.navy;
      ctx.font = `900 ${Math.round(10.5 * S)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('< 返回影片架', backBtnX + backBtnW / 2, backBtnY + backBtnH / 2 + 0.5 * S);

      const visTop = Math.max(clipTop || 0, backBtnY);
      const visBot = Math.min((clipTop || 0) + (clipH || H), backBtnY + backBtnH);
      if (visBot > visTop + 2 * S) {
        addHitRegion('shelf_back_btn', backBtnX, visTop, backBtnW, visBot - visTop, () => {
          playFeedback('click');
          openMovieShelfModal();
        }, true);
      }

      const epTotal = (script.episodes && script.episodes.length) || 6;
      ctx.fillStyle = COLORS.navy;
      ctx.font = `bold ${Math.round(11.5 * S)}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(fitTextToWidth(`《${script.title}》全 ${epTotal} 集回放`, w - 118 * S, 11.5 * S, true), x + w - 10 * S, curY + barH / 2 + 0.5 * S);
    }
    curY += barH + 10 * S;
  }

  if (!movie.isFinished && (!movie.history || movie.history.length === 0)) {
    drawPopBox(x, curY, w, 96 * S, 14 * S, COLORS.white, 2.5, COLORS.navy, 2);
    ctx.fillStyle = COLORS.navy;
    ctx.font = `900 ${Math.round(13.5 * S)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`《${script.title}》暂无已拍成片，快去开拍！`, x + w / 2, curY + 36 * S);
    drawButton('whole_empty_go', x + w / 2 - 72 * S, curY + 54 * S, 144 * S, 30 * S, 15 * S, COLORS.pink, '立即开拍本剧', COLORS.white, 12 * S, 2, () => {
      openCastingModal(script);
    }, true);
    return curY + 108 * S;
  }

  // 1. 成片首映信息总卡
  const headH = 104 * S;
  if (curY + headH >= (clipTop || 0) - 40 && curY <= (clipTop || 0) + (clipH || H) + 40) {
    drawPopBox(x, curY, w, headH, 14 * S, COLORS.yellowSoft, 3, COLORS.navy, 2);
    drawPopBox(x + 12 * S, curY + 10 * S, 96 * S, 20 * S, 10 * S, movie.isFriend ? COLORS.pink : '#2563EB', 0, COLORS.navy, 1.5);
    ctx.fillStyle = COLORS.white;
    ctx.font = `bold ${Math.round(10 * S)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(movie.isFriend ? '好友完整成片' : (isReviewMode ? '本片拍摄回顾' : '我的完整成片'), x + 60 * S, curY + 20.5 * S);

    ctx.fillStyle = COLORS.navy;
    ctx.font = `900 ${Math.round(14.5 * S)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(fitTextToWidth(`《${script.title}》`, w - 128 * S, 14.5 * S, true), x + 116 * S, curY + 20.5 * S);

    ctx.fillStyle = COLORS.navy;
    ctx.font = `bold ${Math.round(11.5 * S)}px sans-serif`;
    const mDir = fitTextToWidth(movie.directorName || '微信导演', (w - 96 * S) * 0.52, 11.5 * S, true);
    const mAct = fitTextToWidth(movie.actorName || '主角', (w - 96 * S) * 0.48, 11.5 * S, true);
    ctx.fillText(`总导演：${mDir}   主演：${mAct}`, x + 12 * S, curY + 48 * S);
    ctx.fillStyle = COLORS.pink;
    ctx.fillText(`评分：${movie.scoreStr} 分   播放量：${movie.viewsText}`, x + 12 * S, curY + 70 * S);
    ctx.fillStyle = COLORS.textSub;
    ctx.fillText(fitTextToWidth(`结局：${movie.endingTitle}（共回放 ${movie.history.length} 集完整剧情）`, w - 24 * S, 11.5 * S, true), x + 12 * S, curY + 90 * S);
  }
  curY += headH + 12 * S;

  const episodes = Array.isArray(script.episodes) ? script.episodes : [];
  const visibleEpCount = movie.isFinished ? episodes.length : Math.min(episodes.length, movie.history.length);

  for (let epIdx = 0; epIdx < episodes.length; epIdx++) {
    const ep = episodes[epIdx];
    const epNum = epIdx + 1;

    if (epIdx >= visibleEpCount) {
      const lockH = 54 * S;
      drawPopBox(x, curY, w, lockH, 12 * S, '#F1F5F9', 0, '#94A3B8', 1.8);
      ctx.fillStyle = COLORS.textSub;
      ctx.font = `bold ${Math.round(11.5 * S)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`第 ${epNum} 集尚未拍摄 · 拍完前序剧集后解锁完整回放`, x + w / 2, curY + 27 * S);
      curY += lockH + 10 * S;
      continue;
    }

    const hEntry = movie.history[epIdx] || {};
    const firstPanelRaw = ep.panels && ep.panels[0] ? (typeof ep.panels[0] === 'string' ? ep.panels[0] : ep.panels[0].text) : '';
    const epSpeaker = detectDialogueSpeaker(firstPanelRaw, script, 'panel', movie.actorName);
    const panelList = (Array.isArray(ep.panels) && ep.panels.length > 0)
      ? ep.panels.map((p) => {
          const txt = typeof p === 'string' ? p : (p.text || '');
          return formatStoryDialogue(txt, script, movie.actorName);
        })
      : [formatStoryDialogue(ep.sceneDesc || '', script, movie.actorName)];

    const imgH = 136 * S;
    const panelLayouts = panelList.map((txt, pIdx) => {
      const rLines = layoutRichTextLines(txt, w - 44 * S, 12 * S, true, script, movie.actorName);
      const hasImg = pIdx === 0;
      const pCardH = 30 * S + (hasImg ? (imgH + 10 * S) : 0) + Math.max(1, rLines.length) * 19.5 * S + 10 * S;
      return { rLines, hasImg, pCardH };
    });
    const allPanelsH = panelLayouts.reduce((sum, pl) => sum + pl.pCardH + 10 * S, 0);

    const choices = (Array.isArray(ep.choices) ? ep.choices : []).slice(0, 3);
    const choicesHeight = 22 * S + choices.length * 34 * S + 8 * S;

    const outcomeStr = hEntry.outcome
      ? formatStoryDialogue(hEntry.outcome, script, movie.actorName)
      : '剧情已高能推进。';
    const outcomeRichLines = layoutRichTextLines(outcomeStr, w - 44 * S, 12 * S, true, script, movie.actorName);
    const outcomeH = 38 * S + Math.max(1, outcomeRichLines.length) * 19.5 * S + 10 * S;

    const cardH = 44 * S + allPanelsH + choicesHeight + outcomeH + 14 * S;

    if (curY + cardH >= (clipTop || 0) - 40 && curY <= (clipTop || 0) + (clipH || H) + 40) {
      drawPopBox(x, curY, w, cardH, 18 * S, COLORS.white, 4, COLORS.navy, 2.5);

      // 1:1 复刻 Web .ep-tag-ribbon 明黄色立体胶囊标题
      const cleanEpTitle = String(ep.title || `第 ${epNum} 集`).replace(/^第\s*\d+\s*集\s*[：:]\s*/, '');
      const ribbonTxt = `第 ${epNum} 集：${cleanEpTitle}`;
      ctx.font = `900 ${Math.round(12 * S)}px sans-serif`;
      const ribbonW = Math.min(w - 24 * S, Math.max(120 * S, ctx.measureText(ribbonTxt).width + 24 * S));
      drawPopBox(x + 12 * S, curY + 11 * S, ribbonW, 25 * S, 12.5 * S, '#FFD43B', 2, COLORS.navy, 2);
      ctx.fillStyle = COLORS.navy;
      ctx.textAlign = 'left';
      ctx.fillText(ribbonTxt, x + 24 * S, curY + 24 * S);

      let yPtr = curY + 46 * S;

      // 每一幕独立卡片 (.panel-clip-box)
      panelLayouts.forEach((pl, pIdx) => {
        const px = x + 12 * S;
        const pw = w - 24 * S;
        drawPopBox(px, yPtr, pw, pl.pCardH, 12 * S, '#F8FAFC', 0, '#CBD5E1', 1.8);

        // 片段徽章 + 视角/旁白标签
        const numTxt = `片段 ${pIdx + 1} · 第 ${pIdx + 1} 幕`;
        drawPopBox(px + 9 * S, yPtr + 8 * S, 84 * S, 17 * S, 5 * S, '#E2E8F0', 0, '#94A3B8', 0.8);
        ctx.fillStyle = '#1E293B';
        ctx.font = `900 ${Math.round(9.5 * S)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(numTxt, px + 51 * S, yPtr + 17 * S);

        ctx.fillStyle = '#64748B';
        ctx.font = `bold ${Math.round(9.5 * S)}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(pIdx === 0 ? epSpeaker.label.slice(0, 14) : '剧情推进', px + pw - 10 * S, yPtr + 17 * S);

        let innerY = yPtr + 31 * S;
        if (pl.hasImg) {
          const sceneImg = getImage(getEpisodeScenePath(script, epIdx)) || getImage(script.coverImage);
          if (sceneImg) {
            drawImageCover(sceneImg, px + 9 * S, innerY, pw - 18 * S, imgH, 9 * S);
            roundRectPath(px + 9 * S, innerY, pw - 18 * S, imgH, 9 * S);
            ctx.lineWidth = 2;
            ctx.strokeStyle = COLORS.navy;
            ctx.stroke();
          } else {
            drawPopBox(px + 9 * S, innerY, pw - 18 * S, imgH, 9 * S, '#E2E8F0', 0, COLORS.navy, 2);
          }
          innerY += imgH + 10 * S;
        }

        drawRichTextLines(pl.rLines, px + 10 * S, innerY + 8 * S, 19.5 * S, 12 * S, true, '#1E293B');
        yPtr += pl.pCardH + 10 * S;
      });

      // 本集拍摄方向对比卡
      ctx.fillStyle = COLORS.navy;
      ctx.font = `900 ${Math.round(11 * S)}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('本集拍摄方向对比：', x + 14 * S, yPtr + 8 * S);
      yPtr += 21 * S;

      choices.forEach((ch, cIdx) => {
        const cid = ch.choiceId || ch.id || ch.label || '';
        const cleanChText = String(ch.text || ch.label || '').replace(/^[A-D1-4][.、：:\s]*/, '');
        const isPicked = Boolean(
          (hEntry.choiceId && cid && hEntry.choiceId === cid)
          || (hEntry.choiceLabel && cleanChText && hEntry.choiceLabel.indexOf(cleanChText.slice(0, 8)) >= 0)
        );
        const rowBg = isPicked ? '#FEF9C3' : '#F8FAFC';
        const rowBorder = isPicked ? '#F43F5E' : '#CBD5E1';
        drawPopBox(x + 12 * S, yPtr, w - 24 * S, 29 * S, 8 * S, rowBg, 0, rowBorder, isPicked ? 2 : 1.2);

        const tagText = isPicked ? '已选择' : `选项${cIdx + 1}`;
        drawPopBox(x + 18 * S, yPtr + 5.5 * S, 44 * S, 18 * S, 6 * S, isPicked ? '#FF5E8E' : '#E2E8F0', 0, isPicked ? COLORS.navy : '#94A3B8', 1);
        ctx.fillStyle = isPicked ? COLORS.white : '#64748B';
        ctx.font = `bold ${Math.round(9 * S)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(tagText, x + 40 * S, yPtr + 15 * S);

        ctx.fillStyle = isPicked ? COLORS.navy : '#64748B';
        ctx.font = isPicked ? `900 ${Math.round(11 * S)}px sans-serif` : `${Math.round(10.5 * S)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(String(cleanChText).slice(0, 22), x + 68 * S, yPtr + 15 * S);

        yPtr += 34 * S;
      });

      yPtr += 6 * S;

      // 1:1 复刻 Web .ep-climax-box（实线粗边玫红结果卡 + 饱满玫红胶囊标签 + 红绿人名高亮）
      drawPopBox(x + 12 * S, yPtr, w - 24 * S, outcomeH, 13 * S, '#FFF1F2', 0, '#F43F5E', 2.4);
      const decTxt = `【导演决策】${hEntry.choiceLabel || '剧情推进'}`.slice(0, 20);
      ctx.font = `900 ${Math.round(10.5 * S)}px sans-serif`;
      const decW = Math.min(w - 44 * S, Math.max(108 * S, ctx.measureText(decTxt).width + 20 * S));
      drawPopBox(x + 22 * S, yPtr + 10 * S, decW, 20 * S, 10 * S, '#FF5A8D', 0, COLORS.navy, 1.5);
      ctx.fillStyle = COLORS.white;
      ctx.textAlign = 'center';
      ctx.fillText(decTxt, x + 22 * S + decW / 2, yPtr + 20.5 * S);

      drawRichTextLines(outcomeRichLines, x + 22 * S, yPtr + 46 * S, 19.5 * S, 12 * S, true, '#881337');
    }

    curY += cardH + 14 * S;
  }

  // 2. 杀青大结局完整正片卡（同步代入主演并三色高亮）
  if (movie.isFinished && movie.endingText) {
    const endRichLines = layoutRichTextLines(formatStoryDialogue(movie.endingText, script, movie.actorName), w - 28 * S, 12 * S, true, script, movie.actorName);
    const endCardH = 74 * S + Math.max(1, endRichLines.length) * 19.5 * S;
    drawPopBox(x, curY, w, endCardH, 14 * S, COLORS.purpleLight, 3, COLORS.navy, 2.2);
    drawPopBox(x + 12 * S, curY + 10 * S, 84 * S, 20 * S, 10 * S, COLORS.yellow, 0, COLORS.navy, 1.5);
    ctx.fillStyle = COLORS.navy;
    ctx.font = `bold ${Math.round(10 * S)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(movie.endingBadge, x + 54 * S, curY + 20.5 * S);

    ctx.fillStyle = COLORS.purple;
    ctx.font = `900 ${Math.round(14 * S)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(fitTextToWidth(`最终结局：${movie.endingTitle}`, w - 116 * S, 14 * S, true), x + 104 * S, curY + 20.5 * S);

    drawRichTextLines(endRichLines, x + 14 * S, curY + 50 * S, 19.5 * S, 12 * S, true, COLORS.navy);
    curY += endCardH + 14 * S;
  }

  // 3. 底部互动按钮（看好友成片可一键挑战同剧；看自己成片可直接发好友完整链接）
  if (movie.isFriend) {
    drawButton('whole_challenge_friend', x, curY, w, 42 * S, 21 * S, COLORS.pink, `我也要拍《${script.title}》挑战TA`, COLORS.white, 14 * S, 3.5, () => {
      if (state.lastShareCode && typeof wx !== 'undefined' && wx.request) {
        wx.request({
          url: API_BASE + '/app-api/duanju/share/challenge',
          method: 'POST',
          header: { 'Content-Type': 'application/json' },
          data: { shareCode: state.lastShareCode }
        });
      }
      state.viewingFriendMovie = false;
      const scIdx = state.scripts.findIndex((s) => s.scriptId === script.scriptId);
      if (scIdx >= 0) state.currentIndex = scIdx;
      openCastingModal(script);
    }, true);
    curY += 54 * S;
  } else if (movie.isFinished && !isReviewMode) {
    drawButton('whole_share_friend', x, curY, w, 42 * S, 21 * S, '#3B82F6', '分享完整成片给好友（含全集与结局）', COLORS.white, 13.5 * S, 3.5, () => {
      playFeedback();
      triggerShareFullMovie(script);
    }, true);
    curY += 54 * S;
  }

  return curY + 12 * S;
}

function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// 5. 主渲染循环与触摸事件绑定
// ============================================================================
let renderPending = false;
function requestRender() {
  if (renderPending) return;
  renderPending = true;
  const raf = (typeof requestAnimationFrame === 'function')
    ? requestAnimationFrame
    : (fn => setTimeout(fn, 16));
  raf(() => {
    renderPending = false;
    renderFrame();
  });
}

function renderFrame() {
  hitRegions = [];
  drawPaperGrid();

  if (state.view === 'home') {
    renderHomeView();
  } else if (state.view === 'episode') {
    renderEpisodeView();
  } else if (state.view === 'report') {
    renderReportView();
  }

  if (state.activeModal) {
    renderActiveModal();
  }

  // 待点击收取证物热点时驱动平滑呼吸放大缩小动效
  if (state.view === 'episode' && state.phase === 'outcome' && state.pendingEvidence && !state.pendingEvidence.collected && !state.activeModal) {
    requestRender();
  }
}

// 触摸与滑动事件处理
let touchStartY = 0;
let touchStartX = 0;
let lastScrollY = 0;
let isDragging = false;

if (typeof wx !== 'undefined' && wx.onTouchStart) {
  wx.onTouchStart((e) => {
    audioFX.ensureBgmPlaying();
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!t) return;
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    lastScrollY = state.modalScrollY;
    isDragging = false;
  });

  wx.onTouchMove((e) => {
    if (!state.activeModal) return;
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!t) return;
    const dy = touchStartY - t.clientY;
    if (Math.abs(dy) > 6) {
      isDragging = true;
      state.modalScrollY = Math.max(0, Math.min(state.modalMaxScroll, lastScrollY + dy));
      requestRender();
    }
  });

  wx.onTouchEnd((e) => {
    if (Date.now() < (state.touchGuardUntil || 0)) return;
    const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
    if (!t) return;
    if (isDragging) return;

    const tx = t.clientX;
    const ty = t.clientY;

    // 逆序遍历热区（优先命中顶层弹窗）
    for (let i = hitRegions.length - 1; i >= 0; i--) {
      const reg = hitRegions[i];
      if (state.activeModal && !reg.isModal) continue;
      if (tx >= reg.x && tx <= reg.x + reg.w && ty >= reg.y && ty <= reg.y + reg.h) {
        reg.onClick();
        return;
      }
    }
  });
}

// 启动初始化：仅恢复本地设置与登录态，全部剧本/图鉴/榜单均由后端 MySQL 实时下发
loadStorage();
audioFX.init();
renderFrame();
wxLoginAndSync();
syncFromBackend();

if (typeof wx !== 'undefined') {
  if (typeof wx.showShareMenu === 'function') {
    try { wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] }); } catch (e) {}
  }
  if (typeof wx.onShareAppMessage === 'function') {
    wx.onShareAppMessage(() => {
      const sc = state.curScript || getCurrentScript();
      const code = (sc && state.shareCodeByScript && state.shareCodeByScript[sc.scriptId]) || state.lastShareCode;
      const imgRel = sc ? String(sc.coverImage || '/static/art/covers/cover-dragon.jpg').replace(/^\//, '') : 'static/art/covers/cover-dragon.jpg';
      return {
        title: sc ? `来《漫剧大导演》围观我拍的《${sc.title}》完整成片！` : '来《漫剧大导演》拍一部离谱短剧！',
        query: code ? `shareCode=${encodeURIComponent(code)}` : '',
        imageUrl: imgRel
      };
    });
  }
  if (typeof wx.getLaunchOptionsSync === 'function') {
    try {
      const launchOpts = wx.getLaunchOptionsSync();
      if (launchOpts && launchOpts.query && launchOpts.query.shareCode) {
        checkIncomingShare(launchOpts.query);
      }
    } catch (e) {}
  }
  if (typeof wx.onShow === 'function') {
    wx.onShow((res) => {
      if (res && res.query && res.query.shareCode && res.query.shareCode !== state.lastShareCode) {
        checkIncomingShare(res.query);
      }
    });
  }
}
