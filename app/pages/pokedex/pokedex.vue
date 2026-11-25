<template>
  <view class="paper-grid-page pokedex-wrap">
    <!-- 顶部栏 -->
    <view class="nav-row">
      <view class="circle-pill" @click="goBack">[返回]</view>
      <view class="page-title">[图鉴] 我的短剧图鉴册</view>
      <view style="width: 110rpx"></view>
    </view>

    <!-- 总进度卡 -->
    <view class="pop-card progress-card">
      <view class="p-top">
        <view class="p-count">已收集 {{ unlockedIds.length }} / 28</view>
        <view class="p-title-badge">头衔：{{ directorRankTitle }}</view>
      </view>
      <view class="p-track">
        <view
          class="p-fill"
          :style="{ width: Math.round((unlockedIds.length / 28) * 100) + '%' }"
        ></view>
      </view>
    </view>

    <!-- 剧本筛选栏 -->
    <view class="filter-row">
      <view
        class="f-chip"
        :class="{ active: filterScriptId === 'ALL' }"
        @click="setFilter('ALL')"
      >
        全部 (28)
      </view>
      <view
        v-for="s in scripts"
        :key="s.scriptId"
        class="f-chip"
        :class="{ active: filterScriptId === s.scriptId }"
        @click="setFilter(s.scriptId)"
      >
        {{ s.title.split('：')[0] }} (7)
      </view>
    </view>

    <!-- 28图鉴双列网格 -->
    <view class="cards-grid">
      <view
        v-for="item in filteredCollections"
        :key="item.cardId"
        class="pop-card card-item"
        :class="{ locked: !isUnlocked(item.cardId) }"
        @click="inspectCard(item)"
      >
        <view class="card-top-tags">
          <view class="rarity-tag" :class="item.rarity">{{ item.rarity }}</view>
          <view class="type-tag">{{ item.type === 'ending' ? '[结局]' : '[彩蛋]' }}</view>
        </view>

        <view class="card-icon">
          {{ isUnlocked(item.cardId) ? (item.type === 'ending' ? '成片' : '典藏') : '待解锁' }}
        </view>

        <view class="card-title">
          {{ isUnlocked(item.cardId) ? item.title : '未解锁图鉴' }}
        </view>

        <view class="card-hint">
          {{ item.hint }}
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import audioManager from '@/utils/audioManager';
import localScriptsDb from '@/static/scripts/SCRIPTS_DATABASE.json';

const scripts = ref(localScriptsDb.scripts);
const collections = ref(localScriptsDb.collections);
const unlockedIds = ref(uni.getStorageSync('Duanju-Unlocked-Cards') || []);
const filterScriptId = ref('ALL');

const filteredCollections = computed(() => {
  if (filterScriptId.value === 'ALL') return collections.value;
  return collections.value.filter((c) => c.scriptId === filterScriptId.value);
});

const directorRankTitle = computed(() => {
  const n = unlockedIds.value.length;
  if (n >= 28) return '荒诞短剧之神';
  if (n >= 16) return '横店短剧教父';
  if (n >= 6) return '黄金狗血编剧';
  return '见习片场场记';
});

function isUnlocked(cardId) {
  return unlockedIds.value.includes(cardId);
}

function setFilter(sid) {
  audioManager.playPop();
  filterScriptId.value = sid;
}

function inspectCard(item) {
  audioManager.playPop();
  const s = scripts.value.find((sc) => sc.scriptId === item.scriptId);
  const sName = s ? s.title : '短剧';
  if (isUnlocked(item.cardId)) {
    uni.showModal({
      title: `【${item.rarity}】${item.title}`,
      content: `所属剧本：《${sName}》\n解锁成就：${item.hint}`,
      showCancel: false,
      confirmText: '太酷了'
    });
  } else {
    uni.showModal({
      title: '未解锁图鉴线索',
      content: `线索提示：${item.hint}\n是否立即前往开拍《${sName}》？`,
      confirmText: '立即去拍',
      cancelText: '再看看',
      success: (res) => {
        if (res.confirm && s) {
          uni.setStorageSync('Duanju-Current-Script', s);
          uni.navigateTo({ url: `/pages/episode/episode?scriptId=${s.scriptId}` });
        }
      }
    });
  }
}

function goBack() {
  audioManager.playPop();
  uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/index/index' }) });
}
</script>

<style lang="scss" scoped>
@import '@/uni.scss';

.pokedex-wrap {
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

.progress-card {
  margin-bottom: 22rpx;
}

.p-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14rpx;
}

.p-count {
  font-size: 32rpx;
  font-weight: 900;
}

.p-title-badge {
  background: $pop-yellow;
  border: 3rpx solid $ink-navy;
  border-radius: 999rpx;
  padding: 4rpx 20rpx;
  font-size: 22rpx;
  font-weight: 900;
}

.p-track {
  height: 24rpx;
  background: #F1F5F9;
  border: 4rpx solid $ink-navy;
  border-radius: 999rpx;
  overflow: hidden;
}

.p-fill {
  height: 100%;
  background: $pop-pink;
}

.filter-row {
  display: flex;
  gap: 12rpx;
  overflow-x: auto;
  margin-bottom: 22rpx;
  padding-bottom: 6rpx;
}

.f-chip {
  flex: 0 0 auto;
  background: #FFFFFF;
  border: 4rpx solid $ink-navy;
  border-radius: 999rpx;
  padding: 10rpx 22rpx;
  font-size: 24rpx;
  font-weight: 800;

  &.active {
    background: #4ADE80;
  }
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.card-item {
  padding: 22rpx;
  text-align: center;

  &.locked {
    background: #F8FAFC;
    opacity: 0.85;
  }
}

.card-top-tags {
  display: flex;
  justify-content: space-between;
  margin-bottom: 14rpx;
}

.rarity-tag {
  border: 3rpx solid $ink-navy;
  border-radius: 999rpx;
  padding: 2rpx 14rpx;
  font-size: 20rpx;
  font-weight: 900;
  background: #E2E8F0;

  &.UR { background: #F43F5E; color: #FFFFFF; }
  &.SSR { background: #FFE66D; }
  &.SR { background: #A78BFA; color: #FFFFFF; }
}

.type-tag {
  font-size: 20rpx;
  font-weight: 800;
  color: #64748B;
}

.card-icon {
  font-size: 56rpx;
  margin-bottom: 12rpx;
}

.card-title {
  font-size: 26rpx;
  font-weight: 900;
  margin-bottom: 10rpx;
  line-height: 1.35;
}

.card-hint {
  font-size: 22rpx;
  color: #64748B;
  line-height: 1.4;
}
</style>
