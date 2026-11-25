<template>
  <view class="paper-grid-page home-wrap">
    <!-- 好友挑战顶栏 -->
    <view v-if="challengeInfo && !globalConfig.auditMode" class="challenge-banner">
      <view class="flag-icon"></view>
      <text class="banner-text">正在挑战好友 [{{ challengeInfo.challenger }}] 的 {{ challengeInfo.score }} 分纪录</text>
    </view>

    <!-- 顶部导航栏 (无Emoji，规范排版) -->
    <view class="top-nav-bar">
      <view class="circle-pill" @click="goPage('/pages/rank/rank')">
        <text class="lbl">封神榜</text>
      </view>
      <view class="circle-pill" @click="handleToggleMute">
        <text class="lbl">{{ isMuted ? '静音' : '音效' }}</text>
      </view>
      <view class="circle-pill" @click="showSettingModal = true">
        <text class="lbl">设置</text>
      </view>
    </view>

    <!-- 全服神剧跑马灯 (提审模式自动隐藏) -->
    <view v-if="marqueeList.length && !globalConfig.auditMode" class="marquee-box">
      <text class="marquee-text">{{ marqueeList[marqueeIndex] }}</text>
    </view>

    <!-- 放映厅主卡片 (1:1 像素封面与四色字块 Logo) -->
    <view class="pop-card stage-card">
      <view class="hall-tag">放映厅 · 互动短剧</view>

      <!-- 四色字块 Logo: [短][剧][人][生] -->
      <view class="logo-tiles">
        <view class="tile tile-pink">漫</view>
        <view class="tile tile-purple">剧</view>
        <view class="tile tile-yellow">大</view>
        <view class="tile tile-cyan">导</view>
        <view class="tile tile-green">演</view>
      </view>
      <view class="slogan">你来决定这集怎么离谱。</view>

      <!-- 剧本横向像素卡片选择区 -->
      <view class="script-cards-row">
        <view
          v-for="(item, idx) in scripts"
          :key="item.scriptId"
          class="script-mini-card"
          :class="{ active: idx === currentIndex }"
          @click="selectScript(idx)"
        >
          <view v-if="item.recommend" class="rec-badge">推荐</view>
          <view class="cover-art" :style="{ backgroundColor: item.coverTheme }">
            <image
              v-if="item.coverImage"
              :src="item.coverImage"
              mode="aspectFill"
              class="pixel-cover-img"
            />
            <view v-else class="cover-fallback">{{ item.title.slice(0, 2) }}</view>
          </view>
          <view class="script-name-pill">{{ item.title.split('：')[0] }}</view>
        </view>
      </view>

      <!-- 规格标签 -->
      <view class="meta-pills-row">
        <view class="meta-pill">{{ currentScript.tag || '高能选择' }}</view>
        <view class="meta-pill">共 {{ currentScript.totalEpisodes || 6 }} 集</view>
        <view class="meta-pill">{{ currentScript.endingCount || 4 }} 种结局</view>
      </view>
    </view>

    <!-- 剧情简介卡片 -->
    <view class="pop-card synopsis-card">
      <view class="synopsis-title">《{{ currentScript.title }}》剧情提要</view>
      <view class="synopsis-body">{{ currentScript.synopsis }}</view>
    </view>

    <!-- 底部操作按钮区 -->
    <view class="action-zone">
      <view class="pop-btn-primary btn-shoot" @click="startShooting">
        开拍 · 《{{ currentScript.title.split('：')[0] }}》
      </view>

      <view class="sub-btns-row">
        <view class="pop-btn-secondary sub-btn" @click="nextScript">
          换剧本 ({{ currentIndex + 1 }}/{{ scripts.length }})
        </view>
        <view class="pop-btn-secondary sub-btn" @click="goPage('/pages/pokedex/pokedex')">
          我的图鉴 {{ unlockedCards.length }}/28
        </view>
      </view>

      <!-- 主演改名 -->
      <view class="actor-rename-line" @click="openRenameModal">
        <text>主演：{{ actorName }}</text>
        <text class="rename-link"> [改名]</text>
      </view>

      <view class="footer-note">
        文字互动短剧，不生成真人影片。每局约 3~5 分钟 · 杀青评定导演质量分
      </view>
    </view>

    <!-- 主演改名弹窗 -->
    <view v-if="showRenameModal" class="modal-mask">
      <view class="pop-card modal-box">
        <view class="modal-title">定制本剧领衔主演姓名</view>
        <view class="modal-desc">名字将写入台词与杀青排行榜战报（接入敏感词风控校验）</view>
        <input
          v-model="tempActorName"
          class="pop-input"
          maxlength="8"
          placeholder="请输入1~8字主演姓名"
        />
        <view class="random-name-btn" @click="rollRandomName">[随机生成主演名]</view>
        <view class="modal-actions">
          <view class="pop-btn-secondary m-btn" @click="showRenameModal = false">取消</view>
          <view class="pop-btn-primary m-btn" @click="confirmRename">确认改名</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { fetchBootstrapData, checkActorNameApi } from '@/api/duanju';
import audioManager from '@/utils/audioManager';
import localScriptsDb from '@/static/scripts/SCRIPTS_DATABASE.json';

interface ScriptItem {
  scriptId: string;
  title: string;
  tag: string;
  recommend?: boolean;
  totalEpisodes: number;
  endingCount: number;
  coverTheme: string;
  coverImage?: string;
  defaultProtagonist: string;
  synopsis: string;
}

const scripts = ref<ScriptItem[]>(localScriptsDb.scripts as ScriptItem[]);
const currentIndex = ref<number>(0);
const actorName = ref<string>(uni.getStorageSync('Duanju-Actor-Name') || '匿名主角');
const unlockedCards = ref<string[]>(uni.getStorageSync('Duanju-Unlocked-Cards') || []);
const globalConfig = ref({ auditMode: false, adEnabled: true, emergencyCleanName: false });
const marqueeList = ref<string[]>([]);
const marqueeIndex = ref<number>(0);
const isMuted = ref<boolean>(audioManager.isMuted());

const showRenameModal = ref<boolean>(false);
const showSettingModal = ref<boolean>(false);
const tempActorName = ref<string>('');
const challengeInfo = ref<{ challenger: string; score: number } | null>(null);

const currentScript = computed(() => scripts.value[currentIndex.value] || scripts.value[0]);

const FUNNY_NAMES = ['歪嘴战神阿强', '螺蛳粉仙人', '养猪女皇翠花', '五三模拟卷之神', '广场舞领舞王妈', '拼夕夕砍王', '东北张狂徒'];

function selectScript(idx: number) {
  audioManager.playPop();
  currentIndex.value = idx;
}

function nextScript() {
  audioManager.playPop();
  currentIndex.value = (currentIndex.value + 1) % scripts.value.length;
}

function handleToggleMute() {
  isMuted.value = audioManager.toggleMute();
}

function openRenameModal() {
  audioManager.playPop();
  tempActorName.value = actorName.value;
  showRenameModal.value = true;
}

function rollRandomName() {
  audioManager.playPop();
  tempActorName.value = FUNNY_NAMES[Math.floor(Math.random() * FUNNY_NAMES.length)];
}

async function confirmRename() {
  const check = await checkActorNameApi(tempActorName.value);
  if (!check.pass) {
    uni.showToast({ title: check.reason, icon: 'none', duration: 2500 });
    return;
  }
  actorName.value = check.cleanName;
  uni.setStorageSync('Duanju-Actor-Name', check.cleanName);
  showRenameModal.value = false;
  audioManager.playFanfare();
  uni.showToast({ title: `主演已署名：${check.cleanName}`, icon: 'none' });
}

function startShooting() {
  audioManager.playClap();
  const s = currentScript.value;
  uni.setStorageSync('Duanju-Current-Script', s);
  uni.setStorageSync('Duanju-Actor-Name', actorName.value);
  uni.navigateTo({
    url: `/pages/episode/episode?scriptId=${s.scriptId}`
  });
}

function goPage(url: string) {
  audioManager.playPop();
  uni.navigateTo({ url });
}

onMounted(async () => {
  const data = await fetchBootstrapData();
  if (data) {
    if (Array.isArray(data.scripts) && data.scripts.length) {
      scripts.value = data.scripts as ScriptItem[];
    }
    if (data.config) {
      globalConfig.value = data.config;
    }
    if (Array.isArray(data.marqueeList)) {
      marqueeList.value = data.marqueeList;
    }
    if (data.userProfile && Array.isArray(data.userProfile.unlockedCards)) {
      const merged = Array.from(new Set([...unlockedCards.value, ...data.userProfile.unlockedCards]));
      unlockedCards.value = merged;
      uni.setStorageSync('Duanju-Unlocked-Cards', merged);
    }
  }

  setInterval(() => {
    if (marqueeList.value.length > 1) {
      marqueeIndex.value = (marqueeIndex.value + 1) % marqueeList.value.length;
    }
  }, 4000);
});
</script>

<style lang="scss" scoped>
@import '@/uni.scss';

.home-wrap {
  padding: 28rpx;
}

.challenge-banner {
  background: $pop-yellow;
  border: 4rpx solid $ink-navy;
  border-radius: 20rpx;
  padding: 14rpx 22rpx;
  font-weight: 900;
  font-size: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 0 $ink-navy;
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.top-nav-bar {
  display: flex;
  justify-content: flex-end;
  gap: 20rpx;
  margin-bottom: 24rpx;
}

.circle-pill {
  background: #FFFFFF;
  border: 5rpx solid $ink-navy;
  border-radius: 999rpx;
  padding: 12rpx 28rpx;
  font-weight: 800;
  font-size: 26rpx;
  box-shadow: 0 6rpx 0 $ink-navy;
}

.marquee-box {
  background: #1E2246;
  color: #FFE66D;
  border-radius: 999rpx;
  padding: 12rpx 28rpx;
  font-size: 24rpx;
  font-weight: 700;
  margin-bottom: 24rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stage-card {
  text-align: center;
  margin-bottom: 26rpx;
}

.hall-tag {
  display: inline-block;
  background: $pop-pink;
  border: 4rpx solid $ink-navy;
  border-radius: 999rpx;
  padding: 8rpx 28rpx;
  font-size: 24rpx;
  font-weight: 900;
  margin-bottom: 24rpx;
}

.logo-tiles {
  display: flex;
  justify-content: center;
  gap: 16rpx;
  margin-bottom: 18rpx;
}

.tile {
  width: 92rpx;
  height: 92rpx;
  line-height: 84rpx;
  border: 6rpx solid $ink-navy;
  border-radius: 24rpx;
  font-size: 52rpx;
  font-weight: 900;
  box-shadow: 0 6rpx 0 $ink-navy;
}
.tile-pink { background: #FF6B9E; }
.tile-purple { background: #A78BFA; }
.tile-cyan { background: #38BDF8; }
.tile-green { background: #4ADE80; }

.slogan {
  font-size: 28rpx;
  font-weight: 800;
  margin-bottom: 28rpx;
}

.script-cards-row {
  display: flex;
  gap: 18rpx;
  overflow-x: auto;
  padding: 14rpx 6rpx 22rpx;
}

.script-mini-card {
  position: relative;
  flex: 0 0 210rpx;
  background: #FFF9FB;
  border: 5rpx solid $ink-navy;
  border-radius: 28rpx;
  padding: 16rpx;
  transition: transform 0.15s ease;

  &.active {
    background: #FFE4EE;
    transform: translateY(-8rpx) scale(1.03);
    box-shadow: 0 10rpx 0 $ink-navy;
  }
}

.rec-badge {
  position: absolute;
  top: -16rpx;
  right: 12rpx;
  background: $pop-pink;
  border: 4rpx solid $ink-navy;
  border-radius: 999rpx;
  padding: 4rpx 18rpx;
  font-size: 20rpx;
  font-weight: 900;
  z-index: 2;
}

.cover-art {
  height: 190rpx;
  border: 4rpx solid $ink-navy;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14rpx;
  overflow: hidden;
  background: #fff;
}

.pixel-cover-img {
  width: 100%;
  height: 100%;
}

.cover-fallback {
  font-weight: 900;
  font-size: 36rpx;
  color: $ink-navy;
}

.script-name-pill {
  background: $pop-pink;
  border: 4rpx solid $ink-navy;
  border-radius: 999rpx;
  padding: 6rpx 12rpx;
  font-size: 24rpx;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta-pills-row {
  display: flex;
  justify-content: center;
  gap: 16rpx;
  margin-top: 12rpx;
}

.meta-pill {
  background: #F4F0FF;
  border: 4rpx solid $ink-navy;
  border-radius: 999rpx;
  padding: 8rpx 24rpx;
  font-size: 24rpx;
  font-weight: 800;
}

.synopsis-card {
  margin-bottom: 28rpx;
  line-height: 1.65;
  font-size: 28rpx;
  font-weight: 700;
}

.synopsis-title {
  font-weight: 900;
  margin-bottom: 8rpx;
  color: #845EC2;
}

.btn-shoot {
  padding: 28rpx 0;
  font-size: 34rpx;
  margin-bottom: 24rpx;
}

.sub-btns-row {
  display: flex;
  gap: 22rpx;
  margin-bottom: 28rpx;
}

.sub-btn {
  flex: 1;
  padding: 22rpx 0;
  font-size: 28rpx;
}

.actor-rename-line {
  text-align: center;
  font-size: 28rpx;
  font-weight: 800;
  margin-bottom: 18rpx;
}

.rename-link {
  color: #0EA5E9;
  font-weight: 900;
}

.footer-note {
  text-align: center;
  font-size: 24rpx;
  color: #64748B;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(30, 34, 70, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  z-index: 999;
}

.modal-box {
  width: 100%;
}

.modal-title {
  font-size: 34rpx;
  font-weight: 900;
  margin-bottom: 12rpx;
}

.modal-desc {
  font-size: 24rpx;
  color: #64748B;
  margin-bottom: 24rpx;
}

.pop-input {
  border: 5rpx solid $ink-navy;
  border-radius: 20rpx;
  padding: 20rpx 24rpx;
  font-size: 30rpx;
  font-weight: 800;
  margin-bottom: 20rpx;
  background: #FFF9FB;
}

.random-name-btn {
  text-align: center;
  font-size: 26rpx;
  font-weight: 800;
  color: #845EC2;
  margin-bottom: 28rpx;
}

.modal-actions {
  display: flex;
  gap: 20rpx;
}

.m-btn {
  flex: 1;
  padding: 20rpx 0;
}
</style>
