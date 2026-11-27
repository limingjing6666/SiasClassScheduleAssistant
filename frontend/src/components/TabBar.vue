<template>
  <view class="tabbar-wrapper">
    <view class="tabbar-dock">
      <!-- 课表 -->
      <view
        class="tab-item"
        :class="current === 'schedule' ? 'tab-item-active tab-bg-blue' : ''"
        @click="switchTo('schedule')"
      >
        <image class="tab-svg" src="/static/icons/grid.svg" mode="aspectFit" />
        <text class="tab-label" :class="{ 'label-active': current === 'schedule' }">课表</text>
      </view>

      <!-- 成绩 -->
      <view
        class="tab-item"
        :class="current === 'score' ? 'tab-item-active tab-bg-pink' : ''"
        @click="switchTo('score')"
      >
        <image class="tab-svg" src="/static/icons/lines.svg" mode="aspectFit" />
        <text class="tab-label" :class="{ 'label-active': current === 'score' }">成绩</text>
      </view>

      <!-- 我的 -->
      <view
        class="tab-item"
        :class="current === 'more' ? 'tab-item-active tab-bg-yellow' : ''"
        @click="switchTo('more')"
      >
        <image class="tab-svg" src="/static/icons/user.svg" mode="aspectFit" />
        <text class="tab-label" :class="{ 'label-active': current === 'more' }">我的</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
const props = defineProps<{
  current: 'schedule' | 'score' | 'more';
}>();

const PAGE_MAP: Record<string, string> = {
  schedule: '/pages/schedule/schedule',
  score: '/pages/score/score',
  more: '/pages/more/more'
};

function switchTo(tab: string) {
  if (tab === props.current) return;
  const url = PAGE_MAP[tab];
  if (!url) return;
  uni.redirectTo({ url });
}
</script>

<style scoped>
.tabbar-wrapper {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 999;
  padding: 0 36rpx 22rpx;
  padding-bottom: calc(22rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  pointer-events: none;
}

.tabbar-dock {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10rpx;
  background: #FFFFFF;
  border: 4rpx solid #000000;
  border-radius: 999rpx;
  padding: 10rpx 12rpx;
  box-shadow: 0 12rpx 28rpx rgba(0, 0, 0, 0.1), 5rpx 5rpx 0 #000000;
  box-sizing: border-box;
}

.tab-item {
  flex: 1;
  height: 76rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  border-radius: 999rpx;
  border: 3rpx solid transparent;
  box-sizing: border-box;
  transition: transform 0.15s ease, background-color 0.2s ease;
}

.tab-item:active {
  transform: scale(0.95);
}

.tab-item-active {
  flex: 1.2;
  border-color: #000000;
  box-shadow: 3rpx 3rpx 0 #000000;
}

.tab-bg-blue { background: #74B9FF; }
.tab-bg-pink { background: #FF7675; }
.tab-bg-yellow { background: #FFEAA7; }

.tab-svg {
  width: 32rpx;
  height: 32rpx;
  opacity: 0.42;
  flex-shrink: 0;
  transition: opacity 0.2s ease;
}

.tab-item-active .tab-svg {
  opacity: 1;
}

.tab-label {
  font-size: 24rpx;
  font-weight: 700;
  color: #71717A;
  letter-spacing: 1rpx;
  transition: color 0.2s ease;
}

.label-active {
  font-size: 26rpx;
  font-weight: 900;
  color: #000000;
}
</style>
