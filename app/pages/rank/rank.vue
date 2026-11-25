<template>
  <view class="paper-grid-page rank-wrap">
    <!-- 顶部栏 -->
    <view class="nav-row">
      <view class="circle-pill" @click="goBack">[返回]</view>
      <view class="page-title">[封神榜] 短剧导演排行榜</view>
      <view style="width: 110rpx"></view>
    </view>

    <!-- 一级 Tab：单剧最高分榜 vs 全服百亿导演总榜 -->
    <view class="board-tabs">
      <view
        class="tab-pill"
        :class="{ active: boardType === 'script' }"
        @click="switchBoardType('script')"
      >
        单剧最高分榜
      </view>
      <view
        class="tab-pill"
        :class="{ active: boardType === 'total' }"
        @click="switchBoardType('total')"
      >
        全服百亿导演总榜
      </view>
    </view>

    <!-- 二级胶囊：4 部剧本切换 -->
    <view v-if="boardType === 'script'" class="script-filter-row">
      <view
        v-for="s in scripts"
        :key="s.scriptId"
        class="s-chip"
        :class="{ active: currentScriptId === s.scriptId }"
        @click="switchScript(s.scriptId)"
      >
        {{ s.title.split('：')[0] }}
      </view>
    </view>

    <!-- 榜单列表 -->
    <view class="pop-card rank-list-card">
      <view v-if="!rankList.length" class="empty-tip">
        暂无上榜数据，快去开拍抢占全服第一名！
      </view>

      <view
        v-for="(item, idx) in rankList"
        :key="idx"
        class="rank-row"
        :class="{ top3: idx < 3 }"
      >
        <view class="rank-num">
          <text v-if="idx === 0" class="top-rank top-1">1</text>
          <text v-else-if="idx === 1" class="top-rank top-2">2</text>
          <text v-else-if="idx === 2" class="top-rank top-3">3</text>
          <text v-else>#{{ idx + 1 }}</text>
        </view>

        <view class="avatar-box">{{ item.avatarUrl ? '' : '导演' }}</view>

        <view class="info-col">
          <view class="dir-name">{{ item.nickname }}</view>
          <view v-if="boardType === 'script'" class="sub-line">
            主演：【{{ item.actorName }}】 · {{ item.endingTitle }}
          </view>
          <view v-else class="sub-line">
            已拍 {{ item.scriptCount }} 部神剧 · 图鉴 {{ item.unlockedCount }}/28
          </view>
        </view>

        <view class="score-col">
          <view class="score-num">
            {{ boardType === 'script' ? item.qualityScore + '分' : item.bestScore + '分' }}
          </view>
          <view class="bo-num">
            {{ formatBoxOffice(boardType === 'script' ? item.boxOffice : item.totalBoxOffice) }}
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { fetchLeaderboardApi } from '@/api/duanju';
import { formatBoxOffice } from '@/utils/scoreCalculator';
import audioManager from '@/utils/audioManager';
import localScriptsDb from '@/static/scripts/SCRIPTS_DATABASE.json';

const scripts = ref(localScriptsDb.scripts);
const boardType = ref('script');
const currentScriptId = ref('script_01_zhuixu');
const rankList = ref([]);

async function loadRankData() {
  const data = await fetchLeaderboardApi(boardType.value, currentScriptId.value);
  if (data && Array.isArray(data.list)) {
    rankList.value = data.list;
  }
}

function switchBoardType(type) {
  audioManager.playPop();
  boardType.value = type;
  loadRankData();
}

function switchScript(sid) {
  audioManager.playPop();
  currentScriptId.value = sid;
  loadRankData();
}

function goBack() {
  audioManager.playPop();
  uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/index/index' }) });
}

onMounted(() => {
  loadRankData();
});
</script>

<style lang="scss" scoped>
@import '@/uni.scss';

.rank-wrap {
  padding: 24rpx;
}

.nav-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.circle-pill {
  background: #FFFFFF;
  border: 4rpx solid $ink-navy;
  border-radius: 999rpx;
  padding: 10rpx 24rpx;
  font-weight: 900;
  font-size: 24rpx;
  box-shadow: 0 4rpx 0 $ink-navy;
}

.page-title {
  font-size: 32rpx;
  font-weight: 900;
}

.board-tabs {
  display: flex;
  gap: 18rpx;
  margin-bottom: 20rpx;
}

.tab-pill {
  flex: 1;
  background: #FFFFFF;
  border: 5rpx solid $ink-navy;
  border-radius: 999rpx;
  padding: 18rpx 0;
  text-align: center;
  font-weight: 900;
  font-size: 26rpx;
  box-shadow: 0 6rpx 0 $ink-navy;

  &.active {
    background: $pop-yellow;
  }
}

.script-filter-row {
  display: flex;
  gap: 12rpx;
  overflow-x: auto;
  margin-bottom: 20rpx;
  padding-bottom: 6rpx;
}

.s-chip {
  flex: 0 0 auto;
  background: #FFFFFF;
  border: 4rpx solid $ink-navy;
  border-radius: 999rpx;
  padding: 10rpx 24rpx;
  font-size: 24rpx;
  font-weight: 800;

  &.active {
    background: $pop-pink;
  }
}

.rank-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 12rpx;
  border-bottom: 3rpx dashed #E2E8F0;

  &.top3 {
    background: #FFFDF0;
    border-radius: 20rpx;
  }
}

.rank-num {
  width: 64rpx;
  text-align: center;
  font-size: 32rpx;
  font-weight: 900;
}

.avatar-box {
  width: 72rpx;
  height: 72rpx;
  line-height: 68rpx;
  text-align: center;
  background: #F3E8FF;
  border: 4rpx solid $ink-navy;
  border-radius: 50%;
  font-size: 36rpx;
}

.info-col {
  flex: 1;
  min-width: 0;
}

.dir-name {
  font-size: 28rpx;
  font-weight: 900;
  margin-bottom: 4rpx;
}

.sub-line {
  font-size: 22rpx;
  color: #64748B;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.score-col {
  text-align: right;
}

.score-num {
  font-size: 32rpx;
  font-weight: 900;
  color: #FF2E7E;
}

.bo-num {
  font-size: 22rpx;
  font-weight: 800;
  color: #1E2246;
}
</style>
