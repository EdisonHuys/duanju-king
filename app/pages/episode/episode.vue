<template>
  <view class="paper-grid-page ep-container">
    <!-- 1. 顶部片场导航与集数标题 -->
    <view class="ep-nav-bar">
      <view class="nav-btn" @click="handleGoHome">&lt; 首页</view>
      <view class="ep-badge-group">
        <text class="badge-genre">《{{ currentGenre.name }}》</text>
        <text class="badge-ep">第 {{ currentEpIndex + 1 }} 集 / 6</text>
      </view>
      <view style="display:flex; gap:10rpx;">
        <view class="nav-btn" style="background:#FEF9C3; border-color:#D97706; color:#78350F;" @click="showCluesModal = true">[线索本]</view>
        <view class="nav-btn" @click="toggleMute">[音效]</view>
      </view>
    </view>

    <view class="ep-title-heading">
      第 {{ currentEpIndex + 1 }} 集：{{ currentEpisode.title }}
    </view>

    <!-- 2. 五维拍摄指标胶囊指示条 -->
    <view class="stats-panel">
      <view class="progress-track">
        <view class="progress-fill" :style="{ width: ((currentEpIndex + 1) / 6 * 100) + '%' }"></view>
      </view>
      <view class="stats-row">
        <view class="stat-cell">爽点值 <text class="stat-num">{{ stats.pleasure }}</text></view>
        <view class="stat-cell">戏剧浓度 <text class="stat-num">{{ stats.drama }}</text></view>
        <view class="stat-cell">反派怒气 <text class="stat-num">{{ stats.anger }}</text></view>
        <view class="stat-cell" style="background:#FEF9C3; border-color:#D97706;" @click="showCluesModal = true">已备材料 <text class="stat-num" style="color:#B45309;">{{ stats.evidence }}</text></view>
        <view class="stat-cell">拆套路 <text class="stat-num">{{ stats.subversion }}</text></view>
      </view>
    </view>

    <!-- 3. 漫画场景立绘大图 + 飘动弹幕层（仅在抉择阶段展示弹幕） -->
    <view class="comic-stage">
      <image
        class="comic-img"
        :src="currentSceneImage"
        mode="aspectFill"
      />
      <view v-if="currentPhase === 'choices'" class="danmaku-wall">
        <view
          v-for="(dm, idx) in activeDanmakus"
          :key="idx"
          class="danmaku-chip"
          :style="{ top: dm.top, animationDuration: dm.duration }"
        >
          {{ dm.text }}
        </view>
      </view>
    </view>

    <!-- 4. 剧情旁白逐步推进卡片 (Panels 逐句呈现，人名智能高亮) -->
    <view v-if="currentPhase === 'narration'" class="narration-card">
      <view class="phase-chip">{{ lastChoiceNote || '剧情开场' }}</view>
      <view class="dialogue-box" v-html="highlightedDialogue"></view>
    </view>

    <!-- 5. 选项抉择阶段 (30秒倒计时) -->
    <view v-if="currentPhase === 'choices'" class="choices-container">
      <view class="timer-bar">
        <text>请拍板本集离谱拍摄方向：</text>
        <text class="timer-badge">{{ countdownSec }}s</text>
      </view>
      <view
        v-for="ch in currentEpisode.choices"
        :key="ch.id"
        class="choice-item"
        @click="onSelectChoice(ch, false)"
      >
        <view class="choice-title-row">
          <text class="choice-key">{{ ch.id }}</text>
          <text class="choice-label">{{ ch.label }}</text>
        </view>
        <view class="choice-snippet">{{ filterParens(ch.outcome).slice(0, 48) }}...</view>
      </view>
    </view>

    <!-- 6. 抉择演化反馈卡片 (对齐原版) -->
    <view v-if="currentPhase === 'outcome'" class="outcome-card">
      <view class="feedback-tags">
        <text v-if="isTimeoutChoice" class="tag-timeout">超时自动选择：{{ selectedChoice?.label }}</text>
        <text v-else class="tag-manual">导演拍板：{{ selectedChoice?.label }}</text>
        <text v-if="isTimeoutChoice" class="tag-director-alert">30 秒没选，导演替你拍了这一条</text>
      </view>
      <view class="outcome-dialogue" v-html="highlightedOutcome"></view>
      <view class="peer-ratio">
        <text>弹幕里</text>
        <text class="peer-percent">{{ peerChoiceRatio }}%</text>
        <text>也选了这个</text>
      </view>
      <view class="delta-box">
        <text class="delta-badge">本次 {{ formatDelta(selectedChoice?.effects) }}</text>
      </view>
    </view>

    <!-- 7. 底部操作栏 -->
    <view class="bottom-actions">
      <button class="btn-review" @click="showReviewModal = true">回顾</button>
      <button class="btn-main-next" @click="handleNextAction">
        {{ footerButtonText }}
      </button>
    </view>

    <!-- 8. 台词历史回顾弹窗 -->
    <view v-if="showReviewModal" class="review-mask" @click="showReviewModal = false">
      <view class="review-dialog" @click.stop>
        <view class="dialog-header">
          <text>本集已拍台词回顾</text>
          <text class="close-x" @click="showReviewModal = false">×</text>
        </view>
        <scroll-view scroll-y class="dialog-content">
          <view
            v-for="(p, pIdx) in reviewedPanels"
            :key="pIdx"
            class="review-item"
          >
            <text class="review-idx">第 {{ pIdx + 1 }} 幕：</text>
            <view v-html="highlightText(p.text)"></view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 9. 已备材料与关键线索案卷袋弹窗 -->
    <view v-if="showCluesModal" class="review-mask" @click="showCluesModal = false">
      <view class="review-dialog" @click.stop>
        <view class="dialog-header" style="background:#D97706;">
          <text>已备材料 · 线索案卷档案袋</text>
          <text class="close-x" @click="showCluesModal = false">×</text>
        </view>
        <scroll-view scroll-y class="dialog-content">
          <view style="background:#FEF3C7; border:2rpx solid #F59E0B; border-radius:14rpx; padding:12rpx; font-size:22rpx; font-weight:800; color:#92400E; margin-bottom:16rpx;">
            每一处搜集到的实锤物证，都将在关键分集（第3集、收官第6集）触发【线索回收】打脸隐藏幕！
          </view>
          <view
            v-for="(clue, cIdx) in currentGenreClues"
            :key="cIdx"
            class="review-item"
            :style="{ background: clue.unlocked ? '#fff' : '#F1F5F9', borderColor: clue.unlocked ? '#1E2246' : '#CBD5E1' }"
          >
            <view style="display:flex; justify-content:space-between; margin-bottom:8rpx;">
              <text style="background:#FEF08A; color:#713F12; font-size:20rpx; font-weight:900; padding:2rpx 12rpx; border-radius:99rpx;">{{ clue.tag }}</text>
              <text :style="{ color: clue.unlocked ? '#059669' : '#64748B', fontSize: '20rpx', fontWeight: '900' }">{{ clue.unlocked ? '已掌握物证' : '第 ' + clue.epNum + ' 集待发现' }}</text>
            </view>
            <view style="font-size:26rpx; font-weight:900; color:#0F172A; margin-bottom:6rpx;">{{ clue.title }}</view>
            <view style="font-size:22rpx; line-height:1.5; color:#475569;">{{ clue.unlocked ? clue.desc : '该关键物证线索尚未在片场触发，请跟随剧情抉择推进至该集收集。' }}</view>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

// 接口定义
interface CastMember {
  id: string;
  name: string;
  role: string;
}

interface Panel {
  speaker: string;
  text: string;
}

interface ChoiceEffects {
  pleasure?: number;
  drama?: number;
  anger?: number;
  evidence?: number;
  subversion?: number;
}

interface Choice {
  id: string;
  label: string;
  outcome: string;
  effects: ChoiceEffects;
}

interface Episode {
  id: string;
  number: number;
  title: string;
  panels: Panel[];
  choices: Choice[];
}

interface Genre {
  id: string;
  name: string;
  cast: CastMember[];
  episodes: Episode[];
  endings?: any[];
}

// 响应式状态
const currentGenre = ref<Genre>({
  id: 'heiress',
  name: '真假千金',
  cast: [
    { id: 'heiress.c0', name: '假千金', role: '主要反派' },
    { id: 'heiress.c1', name: '管事', role: '偏心反派' },
    { id: 'heiress.c2', name: '主角', role: '真千金' }
  ],
  episodes: [
    {
      id: 'heiress.ep1',
      number: 1,
      title: '进门先考餐具',
      panels: [
        {
          speaker: '旁白',
          text: '进门第一餐，管事在长桌上摆出七副不同朝代的铜镀银餐具：「林家认亲，最看重用餐仪态。」假千金掩嘴轻笑：「姐姐刚从乡下回来，怕是连汤勺都认不全吧？」'
        },
        {
          speaker: '旁白',
          text: '你扫了一眼桌角，最右侧那柄刻着防伪小印的，分明是你在老街旧货摊随手修好的样品。假千金挑衅地敲了敲盘沿：「姐姐，请吧。」'
        }
      ],
      choices: [
        {
          id: 'A',
          label: '都用普通汤勺',
          outcome: '你把七把餐具推到一边：「都用汤勺吧，馄饨要坨了。」管事看着你俩，伸手把墙上那张全家福扶正了。假千金咬碎后槽牙。',
          effects: { pleasure: 7, drama: 7, anger: -5, evidence: 0, subversion: 1 }
        },
        {
          id: 'B',
          label: '指出餐具是老街旧货',
          outcome: '你随手拎起一把：「手艺不错，但这柄是我去年焊的，焊点还在。」管事脸色煞白。假千金愣在当场。',
          effects: { pleasure: 12, drama: 8, anger: 15, evidence: 1, subversion: 1 }
        }
      ]
    }
  ]
});

const currentEpIndex = ref<number>(0);
const currentPanelIndex = ref<number>(0);
const currentPhase = ref<'narration' | 'choices' | 'outcome'>('narration');
const selectedChoice = ref<Choice | null>(null);
const isTimeoutChoice = ref<boolean>(false);
const lastChoiceNote = ref<string>('');
const peerChoiceRatio = ref<number>(31);
const showReviewModal = ref<boolean>(false);
const showCluesModal = ref<boolean>(false);

const currentGenreClues = computed(() => {
  return [
    {
      epNum: 1,
      tag: '物证 · 破绽',
      title: '老街地摊焊点餐具',
      desc: '第七把镀银餐具上的微小焊点，证明其为老街地摊货，当场粉碎许管事的门第下马威。',
      unlocked: (currentEpIndex.value + 1) >= 1 || stats.value.evidence >= 1
    },
    {
      epNum: 2,
      tag: '物证 · 关键',
      title: '全家福相片底角与针线盒相册',
      desc: '正厅全家福右下角被许管事裁掉的原始拍摄日期底片，以及阿棉从针线盒翻出的重缝旧相册。',
      unlocked: (currentEpIndex.value + 1) >= 2 || stats.value.evidence >= 2
    },
    {
      epNum: 3,
      tag: '档案 · 揭穿',
      title: '老街少儿兴趣班曲谱印章',
      desc: '许管事声称的「继承人专属烫金高雅曲谱」，版权页上印着「老街少儿兴趣班十五元教材」。',
      unlocked: (currentEpIndex.value + 1) >= 3 || stats.value.evidence >= 3
    },
    {
      epNum: 4,
      tag: '文书 · 实锤',
      title: '档案室借阅单与篡改笔迹',
      desc: '许管事私自去档案室单独借调学籍档案的出库单据，借出日期与发出错误假通知的日子分秒不差。',
      unlocked: (currentEpIndex.value + 1) >= 4 || stats.value.evidence >= 4
    },
    {
      epNum: 5,
      tag: '遗嘱 · 终局',
      title: '老太爷共同继承遗嘱原件',
      desc: '白纸黑字写明两位千金共同继承宅邸与家业、互相扶持，通篇翻完根本没有赶人条款。',
      unlocked: (currentEpIndex.value + 1) >= 5 || stats.value.evidence >= 5
    }
  ];
});

// 五维指标
const stats = ref({
  pleasure: 10,
  drama: 25,
  anger: 10,
  evidence: 0,
  subversion: 0
});

// 倒计时与弹幕
const countdownSec = ref<number>(30);
let timerId: any = null;
let danmakuInterval: any = null;
const activeDanmakus = ref<{ text: string; top: string; duration: string }[]>([]);

const danmakuPool = [
  '先别跪 饭要凉了',
  '不是，这文件怎么还有第二页？？',
  '全场都在等管事的表情管理失控',
  '好家伙，上来就玩这么大！',
  '这一声归来，我练了八十次转身',
  '附件文学 启动',
  '弹幕护体，反派演技真在线',
  '这神反转我给满分！'
];

// 计算属性
const currentEpisode = computed<Episode>(() => {
  return currentGenre.value.episodes[currentEpIndex.value] || currentGenre.value.episodes[0];
});

const currentSceneImage = computed<string>(() => {
  const gId = currentGenre.value.id;
  const epNum = currentEpIndex.value + 1;
  const pNum = currentPanelIndex.value + 1;

  // 1. 若当前剧本为真假千金且有原创独立分镜，优先使用
  if (gId === 'heiress') {
    if (epNum === 1 && pNum === 1) return '/static/generated_scenes/heiress/heiress_ep1_p1.jpg';
    if (epNum === 1 && pNum === 2) return '/static/generated_scenes/heiress/heiress_ep1_p2.jpg';
    if (epNum === 2 && pNum === 1) return '/static/generated_scenes/heiress/heiress_ep2_p1.jpg';
  }

  // 2. 严格按当前剧本题材和集数匹配（绝不跨剧本混用）
  return `/static/art/scenes/scene-${gId}-ep${epNum}.jpg`;
});

const currentPanel = computed<Panel>(() => {
  return currentEpisode.value.panels[currentPanelIndex.value] || { speaker: '旁白', text: '' };
});

const reviewedPanels = computed<Panel[]>(() => {
  return currentEpisode.value.panels.slice(0, currentPanelIndex.value + 1);
});

// 底部按钮文案
const footerButtonText = computed<string>(() => {
  if (currentPhase.value === 'narration') {
    return `继续 (${currentPanelIndex.value + 1}/${currentEpisode.value.panels.length})`;
  } else if (currentPhase.value === 'choices') {
    return `请在上方拍板选择 (${countdownSec.value}s)`;
  } else {
    return currentEpIndex.value < 5 ? `下一集 · 第 ${currentEpIndex.value + 2} 集` : '杀青大吉 · 剧集检验报告';
  }
});

// 格式化文本
function filterParens(t: string): string {
  if (!t) return '';
  return t.replace(/（.*?）/g, '').replace(/\(.*?\)/g, '');
}

function highlightText(text: string): string {
  if (!text) return '';
  let res = text;
  currentGenre.value.cast.forEach(c => {
    const isVillain = c.role.includes('反派') || c.role.includes('挑衅') || c.role.includes('敌');
    const spanClass = isVillain ? 'cast-villain' : 'cast-ally';
    const reg = new RegExp(c.name, 'g');
    res = res.replace(reg, `<span class="${spanClass}">${c.name}</span>`);
  });
  return res;
}

const highlightedDialogue = computed(() => highlightText(currentPanel.value.text));
const highlightedOutcome = computed(() => highlightText(selectedChoice.value?.outcome || ''));

function formatDelta(effects?: ChoiceEffects): string {
  if (!effects) return '属性平衡';
  const parts: string[] = [];
  if (effects.pleasure) parts.push(`爽点值 ${effects.pleasure > 0 ? '+' : ''}${effects.pleasure}`);
  if (effects.drama) parts.push(`戏剧浓度 ${effects.drama > 0 ? '+' : ''}${effects.drama}`);
  if (effects.anger) parts.push(`反派怒气 ${effects.anger > 0 ? '+' : ''}${effects.anger}`);
  if (effects.subversion) parts.push(`拆套路 ${effects.subversion > 0 ? '+' : ''}${effects.subversion}`);
  return parts.join('，') || '属性保持平稳';
}

// 核心流程
function handleNextAction() {
  if (currentPhase.value === 'narration') {
    if (currentPanelIndex.value < currentEpisode.value.panels.length - 1) {
      currentPanelIndex.value++;
    } else {
      // 旁白走完，进入选项
      currentPhase.value = 'choices';
      startChoiceCountdown();
    }
  } else if (currentPhase.value === 'choices') {
    uni.showToast({ title: '请在上方直接点击选择拍摄方向', icon: 'none' });
  } else if (currentPhase.value === 'outcome') {
    if (currentEpIndex.value < 5) {
      currentEpIndex.value++;
      currentPanelIndex.value = 0;
      currentPhase.value = 'narration';
    } else {
      // 杀青跳结算
      uni.navigateTo({
        url: `/pages/report/report?genreId=${currentGenre.value.id}&score=88.5&views=4.2&thrill=${stats.value.pleasure}`
      });
    }
  }
}

function startChoiceCountdown() {
  countdownSec.value = 30;
  clearInterval(timerId);
  timerId = setInterval(() => {
    countdownSec.value--;
    if (countdownSec.value <= 0) {
      clearInterval(timerId);
      // 超时默认选择 A
      if (currentEpisode.value.choices[0]) {
        onSelectChoice(currentEpisode.value.choices[0], true);
      }
    }
  }, 1000);
}

function onSelectChoice(ch: Choice, isTimeout: boolean) {
  clearInterval(timerId);
  selectedChoice.value = ch;
  isTimeoutChoice.value = isTimeout;
  lastChoiceNote.value = `上集选择：${ch.label}`;
  peerChoiceRatio.value = Math.floor(Math.random() * 15 + 28);

  // 累加五维属性
  if (ch.effects) {
    stats.value.pleasure += ch.effects.pleasure || 0;
    stats.value.drama += ch.effects.drama || 0;
    stats.value.anger += ch.effects.anger || 0;
    stats.value.evidence += ch.effects.evidence || 0;
    stats.value.subversion += ch.effects.subversion || 0;
  }

  currentPhase.value = 'outcome';
}

function startDanmaku() {
  clearInterval(danmakuInterval);
  danmakuInterval = setInterval(() => {
    const text = danmakuPool[Math.floor(Math.random() * danmakuPool.length)];
    const top = `${Math.floor(Math.random() * 60 + 15)}%`;
    const duration = `${(Math.random() * 2 + 4.5).toFixed(1)}s`;
    activeDanmakus.value.push({ text, top, duration });

    if (activeDanmakus.value.length > 8) {
      activeDanmakus.value.shift();
    }
  }, 1500);
}

function handleGoHome() {
  uni.navigateBack();
}

function toggleMute() {
  uni.showToast({ title: '已切换片场音效与 BGM', icon: 'none' });
}

onMounted(async () => {
  // 加载全量剧本数据
  try {
    const res = await uni.request({ url: '/static/scripts/FULL_GAME_DATA.json' });
    if (res.data && (res.data as any).genres) {
      const g = (res.data as any).genres.find((item: any) => item.id === 'heiress');
      if (g) currentGenre.value = g;
    }
  } catch (e) {
    console.warn('加载本地剧本数据', e);
  }
  startDanmaku();
});

onUnmounted(() => {
  clearInterval(timerId);
  clearInterval(danmakuInterval);
});
</script>

<style scoped>
.paper-grid-page {
  background-color: #F6F8FC;
  background-image:
    linear-gradient(#E2E8F0 1px, transparent 1px),
    linear-gradient(90deg, #E2E8F0 1px, transparent 1px);
  background-size: 18rpx 18rpx;
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
}

/* 顶部导航 */
.ep-nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}
.nav-btn {
  background: #fff;
  border: 4rpx solid #1E2246;
  border-radius: 99rpx;
  padding: 8rpx 20rpx;
  font-size: 24rpx;
  font-weight: 900;
  box-shadow: 0 4rpx 0 #1E2246;
}
.ep-badge-group {
  display: flex;
  gap: 12rpx;
}
.badge-genre {
  background: #FFE3ED;
  color: #D63384;
  border: 3rpx solid #1E2246;
  border-radius: 99rpx;
  font-size: 22rpx;
  font-weight: 900;
  padding: 4rpx 16rpx;
}
.badge-ep {
  background: #FFD43B;
  color: #1E2246;
  border: 3rpx solid #1E2246;
  border-radius: 99rpx;
  font-size: 22rpx;
  font-weight: 900;
  padding: 4rpx 16rpx;
}
.ep-title-heading {
  font-size: 28rpx;
  font-weight: 900;
  color: #1E2246;
  margin-bottom: 12rpx;
}

/* 五维属性 */
.stats-panel {
  background: #fff;
  border: 4rpx solid #1E2246;
  border-radius: 20rpx;
  padding: 12rpx 16rpx;
  box-shadow: 0 5rpx 0 #1E2246;
  margin-bottom: 16rpx;
}
.progress-track {
  width: 100%;
  height: 8rpx;
  background: #E2E8F0;
  border-radius: 99rpx;
  margin-bottom: 10rpx;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #FF6292, #7C5CFF);
  border-radius: 99rpx;
  transition: width 0.3s;
}
.stats-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6rpx;
}
.stat-cell {
  background: #F8FAFC;
  border: 2rpx solid #1E2246;
  border-radius: 12rpx;
  padding: 4rpx 2rpx;
  text-align: center;
  font-size: 18rpx;
  font-weight: 800;
  color: #475569;
}
.stat-num {
  display: block;
  font-size: 22rpx;
  font-weight: 900;
  color: #0F172A;
}

/* 漫画大图与弹幕 */
.comic-stage {
  width: 100%;
  height: 480rpx;
  border: 5rpx solid #1E2246;
  border-radius: 28rpx;
  overflow: hidden;
  position: relative;
  box-shadow: 0 8rpx 0 #1E2246;
  background: #CBD5E1;
  margin-bottom: 18rpx;
}
.comic-img {
  width: 100%;
  height: 100%;
  display: block;
}
.danmaku-wall {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
}
.danmaku-chip {
  position: absolute;
  white-space: nowrap;
  font-size: 24rpx;
  font-weight: 900;
  color: #fff;
  text-shadow: 2rpx 2rpx 2rpx #000;
  background: rgba(0, 0, 0, 0.45);
  padding: 6rpx 18rpx;
  border-radius: 99rpx;
  animation: danmuMove 5.5s linear infinite;
}
@keyframes danmuMove {
  from { transform: translateX(750rpx); }
  to { transform: translateX(-800rpx); }
}

/* 剧情旁白卡片 */
.narration-card {
  background: #fff;
  border: 4rpx dashed #1E2246;
  border-radius: 24rpx;
  padding: 20rpx;
  box-shadow: 0 6rpx 0 #1E2246;
  margin-bottom: 20rpx;
}
.phase-chip {
  display: inline-block;
  background: #FFD43B;
  color: #1E2246;
  border: 2rpx solid #1E2246;
  font-size: 22rpx;
  font-weight: 900;
  padding: 4rpx 16rpx;
  border-radius: 99rpx;
  margin-bottom: 12rpx;
}
.dialogue-box {
  font-size: 28rpx;
  line-height: 1.7;
  font-weight: 700;
  color: #1E293B;
  min-height: 120rpx;
}

/* 人名高亮样式 */
:deep(.cast-ally) {
  background: #D1FAE5;
  color: #065F46;
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
  border-bottom: 3rpx solid #10B981;
  font-weight: 900;
}
:deep(.cast-villain) {
  background: #FFE4E6;
  color: #9F1239;
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
  border-bottom: 3rpx solid #F43F5E;
  font-weight: 900;
}

/* 抉择列表 */
.choices-container {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-bottom: 20rpx;
}
.timer-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #FEF3C7;
  border: 3rpx solid #D97706;
  border-radius: 16rpx;
  padding: 8rpx 18rpx;
  font-size: 24rpx;
  font-weight: 900;
  color: #B45309;
}
.timer-badge {
  background: #DC2626;
  color: #fff;
  border-radius: 99rpx;
  padding: 2rpx 14rpx;
  font-size: 22rpx;
}
.choice-item {
  background: #fff;
  border: 4rpx solid #1E2246;
  border-radius: 20rpx;
  padding: 18rpx;
  box-shadow: 0 5rpx 0 #1E2246;
}
.choice-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 6rpx;
}
.choice-key {
  width: 36rpx;
  height: 36rpx;
  background: #FF5A8D;
  color: #fff;
  border: 2rpx solid #1E2246;
  border-radius: 10rpx;
  font-size: 22rpx;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
}
.choice-label {
  background: #F1F5F9;
  border: 2rpx solid #1E2246;
  border-radius: 10rpx;
  padding: 2rpx 12rpx;
  font-size: 22rpx;
  font-weight: 900;
}
.choice-snippet {
  font-size: 26rpx;
  font-weight: 800;
  color: #334155;
  line-height: 1.4;
}

/* 结果卡片 */
.outcome-card {
  background: #fff;
  border: 4rpx solid #1E2246;
  border-radius: 24rpx;
  padding: 20rpx;
  box-shadow: 0 6rpx 0 #1E2246;
  margin-bottom: 20rpx;
}
.feedback-tags {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  margin-bottom: 10rpx;
}
.tag-timeout {
  background: #FFE3ED;
  color: #D63384;
  border: 2rpx solid #F43F5E;
  font-size: 22rpx;
  font-weight: 900;
  padding: 4rpx 16rpx;
  border-radius: 99rpx;
  display: inline-block;
}
.tag-director-alert {
  background: #FEE2E2;
  color: #991B1B;
  border: 2rpx solid #EF4444;
  font-size: 22rpx;
  font-weight: 900;
  padding: 4rpx 16rpx;
  border-radius: 99rpx;
  display: inline-block;
}
.tag-manual {
  background: #D1FAE5;
  color: #065F46;
  border: 2rpx solid #10B981;
  font-size: 22rpx;
  font-weight: 900;
  padding: 4rpx 16rpx;
  border-radius: 99rpx;
  display: inline-block;
}
.outcome-dialogue {
  font-size: 28rpx;
  line-height: 1.6;
  font-weight: 700;
  color: #1E293B;
  margin-bottom: 12rpx;
}
.peer-ratio {
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: 24rpx;
  font-weight: 800;
  color: #64748B;
  margin-bottom: 12rpx;
}
.peer-percent {
  background: #0284C7;
  color: #fff;
  font-size: 22rpx;
  font-weight: 900;
  padding: 2rpx 14rpx;
  border-radius: 99rpx;
}
.delta-badge {
  background: #20C997;
  color: #fff;
  font-size: 22rpx;
  font-weight: 900;
  padding: 6rpx 18rpx;
  border-radius: 99rpx;
  border: 2rpx solid #1E2246;
  display: inline-block;
}

/* 底部操作 */
.bottom-actions {
  display: flex;
  gap: 16rpx;
  margin-top: auto;
}
.btn-review {
  background: #fff;
  border: 4rpx solid #1E2246;
  border-radius: 99rpx;
  padding: 20rpx 36rpx;
  font-size: 28rpx;
  font-weight: 900;
  box-shadow: 0 5rpx 0 #1E2246;
}
.btn-main-next {
  flex: 1;
  background: #FF5A8D;
  color: #fff;
  border: 4rpx solid #1E2246;
  border-radius: 99rpx;
  padding: 20rpx 32rpx;
  font-size: 30rpx;
  font-weight: 900;
  text-align: center;
  box-shadow: 0 6rpx 0 #1E2246;
}

/* 回顾弹窗 */
.review-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30rpx;
  z-index: 999;
}
.review-dialog {
  background: #F6F8FC;
  border: 5rpx solid #1E2246;
  border-radius: 30rpx;
  width: 100%;
  max-height: 80vh;
  box-shadow: 0 12rpx 0 #1E2246;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.dialog-header {
  background: #FF6292;
  color: #fff;
  padding: 18rpx 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 900;
  font-size: 28rpx;
  border-bottom: 4rpx solid #1E2246;
}
.close-x {
  font-size: 32rpx;
  font-weight: 900;
}
.dialog-content {
  padding: 20rpx;
  max-height: 60vh;
}
.review-item {
  background: #fff;
  border: 2rpx solid #CBD5E1;
  border-radius: 16rpx;
  padding: 16rpx;
  margin-bottom: 16rpx;
  font-size: 26rpx;
  line-height: 1.6;
}
.review-idx {
  font-weight: 900;
  color: #1E2246;
}
</style>
