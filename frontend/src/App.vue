<template>
  <view class="app" :class="['theme-' + scheduleStore.theme]">
    <slot />
  </view>
</template>

<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app';
import { checkUpdate } from '@/utils/update';
import { useScheduleStore } from '@/stores/schedule';

const scheduleStore = useScheduleStore();

onLaunch(() => {
  console.log('App Launch');
  
  // 加载缓存
  scheduleStore.loadFromCache();

  // 后台静默检查版本更新
  setTimeout(() => {
    checkUpdate();
  }, 3000);

  // 检查登录状态
  const cachedUser = uni.getStorageSync('userInfo');
  const cachedCourses = uni.getStorageSync('courses');
  if (cachedUser && cachedCourses) {
    uni.reLaunch({
      url: '/pages/schedule/schedule'
    });
  }
});

onShow(() => {
  console.log('App Show');
});

onHide(() => {
  console.log('App Hide');
});
</script>

<style>
/* ========================================
   1. 核心主题变量定义
   ======================================== */
:root {
  /* 默认深色 (Classic Dark) */
  --bg-primary: #1C1410;
  --bg-secondary: #2A1E16;
  --bg-header: #1C1410;
  --text-primary: #F0E6D8;
  --text-secondary: rgba(240, 230, 216, 0.4);
  --accent: #C87A3C;
  --border: rgba(200, 122, 60, 0.15);
  --grid-line: rgba(200, 122, 60, 0.08);
  --card-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.3);
}

.theme-morandi {
  --bg-primary: #f4f4f2;
  --bg-secondary: #e8e8e8;
  --bg-header: #e8e8e8;
  --text-primary: #5f5f5f;
  --text-secondary: rgba(95, 95, 95, 0.6);
  --accent: #8e9775;
  --border: rgba(142, 151, 117, 0.3);
  --grid-line: rgba(0, 0, 0, 0.05);
  --card-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.theme-light {
  --bg-primary: #FBF8F1;
  --bg-secondary: #F7F2E7;
  --bg-header: #FBF8F1;
  --text-primary: #4A4A4A;
  --text-secondary: rgba(74, 74, 74, 0.5);
  --accent: #7A9D8C;
  --border: rgba(122, 157, 140, 0.15);
  --grid-line: rgba(0, 0, 0, 0.04);
  --card-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
}

/* ========================================
   2. 全局基础样式
   ======================================== */
page {
  background-color: var(--bg-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  color: var(--text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.app {
  min-height: 100vh;
  background-color: var(--bg-primary);
}

/* 骨架屏动画 */
@keyframes skeleton-pulse {
  0% { opacity: 0.6; }
  50% { opacity: 0.3; }
  100% { opacity: 0.6; }
}

.skeleton-item {
  background: var(--bg-secondary);
  border-radius: 8rpx;
  animation: skeleton-pulse 1.5s infinite ease-in-out;
}

/* 覆盖原有样式... */
input:-webkit-autofill {
  -webkit-text-fill-color: var(--text-primary) !important;
  -webkit-box-shadow: 0 0 0 1000px var(--bg-secondary) inset !important;
}

input {
  background: transparent !important;
  color: var(--text-primary) !important;
}
</style>
