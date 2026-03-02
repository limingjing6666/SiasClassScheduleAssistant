<template>
  <view class="app">
    <slot />
  </view>
</template>

<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app';

onLaunch(() => {
  console.log('App Launch');

  // 检查登录状态
  const token = uni.getStorageSync('userInfo');
  if (!token) {
    // 未登录，跳转到登录页
    uni.reLaunch({
      url: '/pages/login/login'
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
/* 全局样式 —— 暖色深色主题 */
page {
  background-color: #1C1410;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  color: #F0E6D8;
  color-scheme: dark;
}

/* 强制浏览器原生控件（日历、下拉等）使用深色模式 */
:root {
  color-scheme: dark;
  accent-color: #C87A3C;
}

/* 覆盖浏览器 input 自动填充的白色背景 */
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  -webkit-text-fill-color: #ffffff !important;
  -webkit-box-shadow: 0 0 0 1000px #2A1E16 inset !important;
  box-shadow: 0 0 0 1000px #2A1E16 inset !important;
  transition: background-color 5000s ease-in-out 0s;
}

/* 强制所有 input 元素使用透明背景 */
input, uni-input input {
  background: transparent !important;
  color: #ffffff !important;
  color-scheme: dark;
}

/* 日期选择器图标颜色 */
::-webkit-calendar-picker-indicator {
  filter: invert(0.7) sepia(1) saturate(3) hue-rotate(350deg);
}

/* uni-app H5 picker 容器样式覆盖 */
.uni-picker-container .uni-picker-header {
  background: #2A1E16 !important;
  border-bottom: 1px solid rgba(200, 122, 60, 0.2) !important;
}

.uni-picker-container .uni-picker-action {
  color: #C87A3C !important;
}

.uni-picker-container .uni-picker-content {
  background: #1C1410 !important;
  color: #F0E6D8 !important;
}

.uni-picker-container .uni-picker-text {
  color: #F0E6D8 !important;
}

.uni-picker-container {
  background: rgba(0, 0, 0, 0.75) !important;
}

.uni-picker-container .uni-picker-bottom {
  background: #2A1E16 !important;
}

.app {
  min-height: 100vh;
  background-color: #1C1410;
}
</style>
