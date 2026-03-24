<template>
  <view class="more-page">
    <view class="page-header">
      <view class="status-bar"></view>
      <text class="page-title">更多</text>
    </view>

    <view class="menu-list">
      <view class="menu-item" @click="goToHistory">
        <view class="menu-left">
          <text class="menu-icon">📚</text>
          <text class="menu-text">历史课表</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>

      <view class="menu-item logout" @click="handleLogout">
        <view class="menu-left">
          <text class="menu-icon">🚪</text>
          <text class="menu-text">退出登录</text>
        </view>
      </view>
    </view>

    <!-- 版本信息 -->
    <view class="version-info">
      <text class="version-text">西亚斯课表 v1.0.16</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useScheduleStore } from '@/stores/schedule';

const scheduleStore = useScheduleStore();

function goToHistory() {
  uni.navigateTo({
    url: '/pages/history/history'
  });
}

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出吗？',
    success: (res) => {
      if (res.confirm) {
        scheduleStore.clearData();
        setTimeout(() => {
          uni.reLaunch({
            url: '/pages/login/login'
          });
        }, 100);
      }
    }
  });
}
</script>

<style scoped>
.more-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #F5F5F5;
}

.page-header {
  background: #FFFFFF;
  padding: 32rpx;
}

.status-bar {
  height: var(--status-bar-height, 44rpx);
}

.page-title {
  font-size: 40rpx;
  font-weight: 800;
  color: #000000;
  margin-top: 16rpx;
}

.menu-list {
  margin: 24rpx;
  background: #FFFFFF;
  border-radius: 12rpx;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx;
  border-bottom: 1rpx solid #F0F0F0;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:active {
  background: #FAFAFA;
}

.menu-left {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.menu-icon {
  font-size: 36rpx;
}

.menu-text {
  font-size: 30rpx;
  color: #333333;
}

.menu-arrow {
  font-size: 36rpx;
  color: #CCCCCC;
}

.menu-item.logout .menu-text {
  color: #FF4444;
}

.version-info {
  text-align: center;
  padding: 48rpx;
}

.version-text {
  font-size: 24rpx;
  color: #888888;
}
</style>
