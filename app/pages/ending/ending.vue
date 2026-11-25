<template>
  <view class="paper-grid-page ending-wrap">
    <!-- 顶部杀青祝贺条 -->
    <view class="top-badge-row">
      <view class="finish-pill">杀青大吉 · 剧集质量检验报告</view>
    </view>

    <!-- 刷新个人最佳纪录横幅 -->
    <view v-if="serverSyncInfo && serverSyncInfo.isNewRecord" class="record-toast">
      [战报] 刷新个人最佳导演纪录！当前位列本剧全服第 {{ serverSyncInfo.myRank }} 名！
    </view>

    <!-- 主战报卡片 (参照原版右侧视频封面设计) -->
    <view class="pop-card report-card">
      <view class="script-header">
        《{{ script.title }}》 · 领衔主演：{{ actorName }}
      </view>

      <!-- 结局称号与稀有度印章 -->
      <view class="ending-banner" :style="{ backgroundColor: script.coverTheme || '#FF6B9E' }">
        <view class="rarity-stamp">{{ result.ending.badge }}</view>
        <view class="ending-main-title">{{ result.ending.title }}</view>
      </view>

      <!-- 拍摄质量大字评分与进度条 (核心攀比区) -->
      <view class="score-section">
        <view class="score-left">
          <view class="score-label">综合拍摄质量评分</view>
          <view class="score-big">{{ result.qualityScore }}</view>
          <view class="style-sub">{{ result.styleTitle }}</view>
        </view>
        <view class="score-right">
          <view class="box-office-title">预估首日全网播放量</view>
          <view class="box-office-val">{{ formattedBoxOffice }}</view>
          <view class="beat-tag">击败全国 {{ result.beatPercent }}% 的短剧导演</view>
        </view>
      </view>

      <!-- 进度条 -->
      <view class="progress-track">
        <view class="progress-fill" :style="{ width: Math.min(100, result.qualityScore) + '%' }"></view>
      </view>

      <!-- 结局剧情总结与网友神评 -->
      <view class="summary-box">
        <view class="sum-text">{{ result.ending.summary }}</view>
        <view class="comment-box">{{ result.ending.audienceComment }}</view>
      </view>
    </view>

    <!-- 商业化激励广告加成按钮 (F-MP-08) -->
    <view v-if="!adBoosted" class="pop-card boost-bar" @click="handleAdBoost">
      <text>[追加宣发] 看激励视频/分享追加宣发经费：首日播放量立即 +25% 冲榜！</text>
    </view>

    <!-- 底部操作区 -->
    <view class="actions-col">
      <view class="pop-btn-primary btn-main" @click="goPage('/pages/rank/rank?scriptId=' + script.scriptId)">
        查看全服封神排行榜 (我的排名: #{{ (serverSyncInfo && serverSyncInfo.myRank) || 1 }})
      </view>

      <view class="row-2">
        <view class="pop-btn-secondary btn-half" @click="handleRetry">
          换个套路重拍
        </view>
        <view class="pop-btn-secondary btn-half" @click="goHome">
          返回放映厅
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { evaluateShootResult, formatBoxOffice } from '@/utils/scoreCalculator';
import { submitShootRecordApi } from '@/api/duanju';
import audioManager from '@/utils/audioManager';
import localScriptsDb from '@/static/scripts/SCRIPTS_DATABASE.json';

const script = ref(uni.getStorageSync('Duanju-Current-Script') || localScriptsDb.scripts[0]);
const actorName = ref(uni.getStorageSync('Duanju-Actor-Name') || script.value.defaultProtagonist || '匿名主角');
const choicePath = ref(
  uni.getStorageSync('Duanju-Last-ChoicePath') ||
  script.value.episodes.map((ep) => ep.choices[1].choiceId)
);

const adBoosted = ref(false);
const result = ref(evaluateShootResult(script.value, choicePath.value, false));
const serverSyncInfo = ref(null);

const formattedBoxOffice = computed(() => formatBoxOffice(result.value.boxOffice));

async function syncToLeaderboard() {
  // 保存本地解锁图鉴
  const localUnlocked = uni.getStorageSync('Duanju-Unlocked-Cards') || [];
  const merged = Array.from(new Set([...localUnlocked, ...result.value.unlockedCards]));
  uni.setStorageSync('Duanju-Unlocked-Cards', merged);

  const res = await submitShootRecordApi({
    scriptId: script.value.scriptId,
    actorName: actorName.value,
    choicePath: choicePath.value,
    clientScore: result.value.qualityScore,
    adBoosted: adBoosted.value
  });
  if (res) {
    serverSyncInfo.value = res;
  }
}

async function handleAdBoost() {
  audioManager.playFanfare();
  adBoosted.value = true;
  result.value.boxOffice = Math.round(result.value.boxOffice * 1.25);
  uni.showToast({ title: '宣发暴击生效！播放量 +25%！', icon: 'none' });
  await syncToLeaderboard();
}

function handleRetry() {
  audioManager.playClap();
  uni.redirectTo({ url: `/pages/episode/episode?scriptId=${script.value.scriptId}` });
}

function goHome() {
  audioManager.playPop();
  uni.reLaunch({ url: '/pages/index/index' });
}

function goPage(url) {
  audioManager.playPop();
  uni.navigateTo({ url });
}

onMounted(() => {
  audioManager.playFanfare();
  syncToLeaderboard();
});
</script>

<style lang="scss" scoped>
@import '@/uni.scss';

.ending-wrap {
  padding: 26rpx;
}

.top-badge-row {
  text-align: center;
  margin-bottom: 20rpx;
}

.finish-pill {
  display: inline-block;
  background: $pop-yellow;
  border: 5rpx solid $ink-navy;
  border-radius: 999rpx;
  padding: 10rpx 36rpx;
  font-size: 28rpx;
  font-weight: 900;
  box-shadow: 0 6rpx 0 $ink-navy;
}

.record-toast {
  background: #4ADE80;
  border: 4rpx solid $ink-navy;
  border-radius: 20rpx;
  padding: 14rpx 20rpx;
  font-size: 24rpx;
  font-weight: 900;
  text-align: center;
  margin-bottom: 20rpx;
}

.report-card {
  margin-bottom: 24rpx;
}

.script-header {
  font-size: 26rpx;
  font-weight: 900;
  color: #64748B;
  margin-bottom: 16rpx;
  text-align: center;
}

.ending-banner {
  border: 5rpx solid $ink-navy;
  border-radius: 26rpx;
  padding: 28rpx 20rpx;
  text-align: center;
  margin-bottom: 24rpx;
  position: relative;
}

.rarity-stamp {
  display: inline-block;
  background: $pop-yellow;
  border: 4rpx solid $ink-navy;
  border-radius: 999rpx;
  padding: 4rpx 22rpx;
  font-size: 22rpx;
  font-weight: 900;
  margin-bottom: 12rpx;
}

.ending-main-title {
  font-size: 36rpx;
  font-weight: 900;
  color: #1E2246;
}

.score-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #FFF9FB;
  border: 4rpx solid $ink-navy;
  border-radius: 24rpx;
  padding: 22rpx;
  margin-bottom: 18rpx;
}

.score-label {
  font-size: 22rpx;
  font-weight: 800;
  color: #64748B;
}

.score-big {
  font-size: 68rpx;
  font-weight: 900;
  color: #FF2E7E;
  line-height: 1.1;
}

.style-sub {
  font-size: 20rpx;
  font-weight: 800;
  color: #845EC2;
}

.score-right {
  text-align: right;
}

.box-office-title {
  font-size: 22rpx;
  font-weight: 800;
  color: #64748B;
}

.box-office-val {
  font-size: 42rpx;
  font-weight: 900;
  color: #1E2246;
  margin: 6rpx 0;
}

.beat-tag {
  background: #FEF9C3;
  border: 3rpx solid $ink-navy;
  border-radius: 999rpx;
  padding: 4rpx 14rpx;
  font-size: 20rpx;
  font-weight: 900;
}

.progress-track {
  height: 26rpx;
  background: #F1F5F9;
  border: 4rpx solid $ink-navy;
  border-radius: 999rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4ADE80, #FF6B9E);
}

.summary-box {
  font-size: 28rpx;
  line-height: 1.65;
  font-weight: 700;
}

.sum-text {
  margin-bottom: 18rpx;
}

.comment-box {
  background: #F3E8FF;
  border: 3rpx dashed $ink-navy;
  border-radius: 18rpx;
  padding: 16rpx;
  font-size: 24rpx;
  font-weight: 800;
  color: #5B21B6;
}

.boost-bar {
  background: #FEF08A;
  text-align: center;
  font-size: 26rpx;
  font-weight: 900;
  padding: 20rpx;
  margin-bottom: 24rpx;
}

.btn-main {
  padding: 26rpx 0;
  font-size: 30rpx;
  margin-bottom: 20rpx;
}

.row-2 {
  display: flex;
  gap: 20rpx;
}

.btn-half {
  flex: 1;
  padding: 22rpx 0;
  font-size: 28rpx;
}
</style>
