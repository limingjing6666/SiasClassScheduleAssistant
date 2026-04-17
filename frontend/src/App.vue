<template>
  <view class="app">
    <slot />

    <!-- 漫画风下载进度弹窗 -->
    <view v-if="downloadPercent >= 0" class="download-overlay">
      <view class="download-card">
        <text class="download-title">正在更新</text>
        <view class="download-bar-track">
          <view class="download-bar-fill" :style="{ width: downloadPercent + '%' }"></view>
        </view>
        <text class="download-status">{{ downloadStatus }}</text>
        <text class="download-percent">{{ downloadPercent }}%</text>
      </view>
    </view>

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
import { checkUpdate, onDownloadProgress } from '@/utils/update';
import { useScheduleStore } from '@/stores/schedule';
import { scheduleCachedTodayReminders } from '@/utils/reminder';
import {
  shouldShowPermissionModal,
  onPermissionConfirm,
  onPermissionCancel,
  checkNotificationPermission
} from '@/utils/permission';
import MangaModal from '@/components/MangaModal.vue';

const scheduleStore = useScheduleStore();
const showPermissionModal = ref(false);
const downloadPercent = ref(-1);
const downloadStatus = ref('');

// 注册下载进度回调
onDownloadProgress((percent, status) => {
  downloadPercent.value = percent;
  downloadStatus.value = status;
});

function onPermConfirm() {
  showPermissionModal.value = false;
  onPermissionConfirm();
  // 用户从设置页返回后，尝试设置提醒
  setTimeout(async () => {
    const hasPermission = await checkNotificationPermission();
    if (hasPermission) {
      await tryScheduleReminders();
    }
  }, 3000);
}

function onPermCancel() {
  showPermissionModal.value = false;
  onPermissionCancel();
}

async function tryScheduleReminders() {
  const result = await scheduleCachedTodayReminders(scheduleStore.currentWeek);
  console.log('[App] Reminder schedule result:', result.status, result.count);
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
    uni.reLaunch({
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
      await tryScheduleReminders();
    }
  }
  // #endif
});

onShow(() => {
  console.log('App Show');
  void tryScheduleReminders();
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

/* 彻底隐藏原生 tabBar 及其占位容器 */
uni-tabbar,
.uni-tabbar,
.uni-tabbar-bottom,
uni-tabbar .uni-tabbar,
uni-tabbar .uni-tabbar-border {
  display: none !important;
  height: 0 !important;
  min-height: 0 !important;
  max-height: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
  border: none !important;
  overflow: hidden !important;
  visibility: hidden !important;
}

/* 确保页面内容不为原生 tabBar 预留底部空间 */
uni-page-wrapper,
uni-page-body {
  padding-bottom: 0 !important;
}

/* ========================================
   下载更新进度弹窗 (漫画风)
   ======================================== */
.download-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
}

.download-card {
  width: 100%;
  max-width: 560rpx;
  background: #FFFFFF;
  border: 6rpx solid #000000;
  border-radius: 36rpx;
  box-shadow: 10rpx 10rpx 0 #000000;
  padding: 48rpx 40rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.download-title {
  font-size: 36rpx;
  font-weight: 900;
  color: #000000;
  margin-bottom: 32rpx;
  letter-spacing: 4rpx;
}

.download-bar-track {
  width: 100%;
  height: 20rpx;
  background: #F3F4F6;
  border: 3rpx solid #000000;
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 20rpx;
}

.download-bar-fill {
  height: 100%;
  background: #55EFC4;
  border-radius: 20rpx;
  transition: width 0.3s ease;
}

.download-status {
  font-size: 24rpx;
  font-weight: 700;
  color: #666666;
  margin-bottom: 8rpx;
}

.download-percent {
  font-size: 48rpx;
  font-weight: 900;
  color: #000000;
  letter-spacing: -2rpx;
}
</style>
