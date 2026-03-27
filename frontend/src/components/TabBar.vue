<template>
  <view class="tabbar-wrapper">
    <view class="tabbar-dock">
      <!-- 课表 -->
      <view class="tab-item" @click="switchTo('schedule')">
        <view class="tab-icon-box" :class="current === 'schedule' ? 'tab-icon-active icon-bg-blue' : ''">
          <image class="tab-svg" src="/static/icons/grid.svg" mode="aspectFit" />
        </view>
        <text class="tab-label" :class="{ 'label-active': current === 'schedule' }">课表</text>
      </view>

      <!-- 成绩 -->
      <view class="tab-item" @click="switchTo('score')">
        <view class="tab-icon-box" :class="current === 'score' ? 'tab-icon-active icon-bg-pink' : ''">
          <image class="tab-svg" src="/static/icons/lines.svg" mode="aspectFit" />
        </view>
        <text class="tab-label" :class="{ 'label-active': current === 'score' }">成绩</text>
      </view>

      <!-- 更多 -->
      <view class="tab-item" @click="switchTo('more')">
        <view class="tab-icon-box" :class="current === 'more' ? 'tab-icon-active icon-bg-yellow' : ''">
          <image class="tab-svg" src="/static/icons/dots.svg" mode="aspectFit" />
        </view>
        <text class="tab-label" :class="{ 'label-active': current === 'more' }">更多</text>
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
  uni.reLaunch({ url });
}
</script>

<style scoped>
.tabbar-wrapper {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 999;
  background: #FFFFFF;
  border-top: 2rpx solid #000000;
  padding: 6rpx 48rpx 0;
  /* safe-area 仅留最小值，避免底部大量留白 */
  box-sizing: border-box;
}

.tabbar-dock {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  width: 120rpx;
}

/* 图标容器 */
.tab-icon-box {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  border: 3rpx solid transparent;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.tab-svg {
  width: 32rpx;
  height: 32rpx;
  opacity: 0.35;
  transition: opacity 0.2s ease;
}

/* 激活态 */
.tab-icon-active {
  border-color: #000000;
  box-shadow: 3rpx 3rpx 0 #000000;
  transform: translateY(-6rpx) scale(1.05);
}

.tab-icon-active .tab-svg {
  opacity: 1;
}

.icon-bg-blue { background: #74B9FF; }
.icon-bg-pink { background: #FF7675; }
.icon-bg-yellow { background: #FFEAA7; }

/* 标签 */
.tab-label {
  font-size: 18rpx;
  font-weight: 600;
  color: #BBBBBB;
  transition: all 0.2s ease;
  margin-bottom: 2rpx;
}

.label-active {
  font-weight: 900;
  color: #000000;
}
</style>
