<template>
  <view class="app">
    <slot />

    <!-- 漫画风权限提醒弹窗 -->
    <MangaModal
      :visible="showPermissionModal"
      tag="NOTICE"
      tag-class="tag-yellow"
      title="开启课前提醒"
      content="为了在课程开始前 20 分钟提醒您上课，请开启通知权限。应用关闭后仍能正常提醒。"
      icon="/static/icons/bell.svg"
      icon-bg-class="icon-bg-blue"
      :show-cancel="true"
      cancel-text="暂不开启"
      confirm-text="去 开 启"
      confirm-btn-class="btn-blue"
      @confirm="onPermConfirm"
      @cancel="onPermCancel"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app';
import { checkUpdate } from '@/utils/update';
import { useScheduleStore } from '@/stores/schedule';
import { scheduleTodayReminders } from '@/utils/reminder';
import {
  shouldShowPermissionModal,
  onPermissionConfirm,
  onPermissionCancel,
  checkNotificationPermission
} from '@/utils/permission';
import MangaModal from '@/components/MangaModal.vue';

const scheduleStore = useScheduleStore();
const showPermissionModal = ref(false);

function onPermConfirm() {
  showPermissionModal.value = false;
  onPermissionConfirm();
  // 用户从设置页返回后，尝试设置提醒
  setTimeout(async () => {
    const hasPermission = await checkNotificationPermission();
    if (hasPermission) {
      tryScheduleReminders();
    }
  }, 3000);
}

function onPermCancel() {
  showPermissionModal.value = false;
  onPermissionCancel();
}

function tryScheduleReminders() {
  const cachedCourses = uni.getStorageSync('courses');
  if (!cachedCourses) return;
  try {
    const courses = JSON.parse(cachedCourses);
    const currentWeek = scheduleStore.currentWeek;
    const count = scheduleTodayReminders(courses, currentWeek);
    console.log('[App] Scheduled', count, 'reminders');
  } catch (e) {
    console.error('[App] 设置提醒失败:', e);
  }
}

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
    uni.switchTab({
      url: '/pages/schedule/schedule'
    });
  }

  // #ifdef APP-PLUS
  // 检查是否需要显示权限弹窗
  const needModal = await shouldShowPermissionModal();
  if (needModal) {
    // 延迟显示，等页面渲染完
    setTimeout(() => {
      showPermissionModal.value = true;
    }, 1500);
  } else {
    // 已有权限，设置今日提醒
    const hasPermission = await checkNotificationPermission();
    if (hasPermission && cachedCourses) {
      try {
        const courses = JSON.parse(cachedCourses);
        const currentWeek = scheduleStore.currentWeek;
        scheduleTodayReminders(courses, currentWeek);
      } catch (e) {
        console.error('[App] 设置提醒失败:', e);
      }
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

/* 隐藏原生 tabBar（使用自定义 TabBar 组件替代） */
uni-tabbar,
.uni-tabbar {
  display: none !important;
  height: 0 !important;
  overflow: hidden !important;
}

</style>
