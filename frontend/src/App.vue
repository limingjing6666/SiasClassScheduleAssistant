<template>
  <view class="app">
    <slot />
  </view>
</template>

<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app';
import { checkUpdate } from '@/utils/update';
import { useScheduleStore } from '@/stores/schedule';
import { scheduleTodayReminders } from '@/utils/reminder';
import { handleFirstTimePermission } from '@/utils/permission';

const scheduleStore = useScheduleStore();

onLaunch(async () => {
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

  // #ifdef APP-PLUS
  // 处理权限请求（首次弹窗或静默检查）
  const hasPermission = await handleFirstTimePermission();

  // 设置今日提醒（仅在有权限时）
  if (hasPermission && cachedCourses) {
    try {
      const courses = JSON.parse(cachedCourses);
      const currentWeek = scheduleStore.currentWeek;
      scheduleTodayReminders(courses, currentWeek);
    } catch (e) {
      console.error('[App] 设置提醒失败:', e);
    }
  }
  // #endif
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
   1. 核心主题变量定义 (极简单色)
   ======================================== */
:root {
  /* 纯平极简亮色 (Minimalist Light) */
  --bg-primary: #FFFFFF;
  --bg-secondary: #FFFFFF;
  --bg-header: #FFFFFF;
  --text-primary: #000000;
  --text-secondary: #888888;
  --accent: #000000;
  --border: rgba(0, 0, 0, 0.06);
  --grid-line: rgba(0, 0, 0, 0.03);
  --card-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.04);
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
