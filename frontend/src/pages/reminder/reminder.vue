<template>
  <view class="reminder-page">
    <view class="page-header">
      <view class="status-bar"></view>
      <view class="header-row">
        <text class="back-btn" @click="goBack">‹</text>
        <text class="page-title">课前提醒</text>
      </view>
    </view>

    <view class="settings-list">
      <view class="setting-item">
        <view class="setting-left">
          <text class="setting-label">启用提醒</text>
          <text class="setting-desc">课前自动推送通知提醒</text>
        </view>
        <switch :checked="settings.enabled" @change="onToggleEnabled" color="#000000" />
      </view>

      <view class="setting-item" v-if="settings.enabled" @click="showAdvancePicker">
        <view class="setting-left">
          <text class="setting-label">提前时间</text>
          <text class="setting-desc">上课前多久提醒</text>
        </view>
        <view class="setting-right">
          <text class="setting-value">{{ currentAdvanceLabel }}</text>
          <text class="setting-arrow">›</text>
        </view>
      </view>

      <view class="setting-item" v-if="settings.enabled">
        <view class="setting-left">
          <text class="setting-label">提醒声音</text>
          <text class="setting-desc">播放系统提示音</text>
        </view>
        <switch :checked="settings.sound" @change="onToggleSound" color="#000000" />
      </view>

      <view class="setting-item" v-if="settings.enabled">
        <view class="setting-left">
          <text class="setting-label">震动</text>
          <text class="setting-desc">收到提醒时震动</text>
        </view>
        <switch :checked="settings.vibration" @change="onToggleVibration" color="#000000" />
      </view>
    </view>

    <view class="tip-section" v-if="settings.enabled">
      <text class="tip-text">提示：请确保已开启通知权限和自启动权限，否则提醒可能无法正常触发。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useScheduleStore } from '@/stores/schedule';
import { ADVANCE_OPTIONS } from '@/config/reminder';
import { scheduleCachedTodayReminders, clearAllNotifications } from '@/utils/reminder';
import { openAppSettings } from '@/utils/permission';

const scheduleStore = useScheduleStore();
const settings = computed(() => scheduleStore.reminderSettings);

const currentAdvanceLabel = computed(() => {
  const opt = ADVANCE_OPTIONS.find(o => o.value === settings.value.advanceMinutes);
  return opt ? opt.label : `${settings.value.advanceMinutes}分钟`;
});

function goBack() {
  uni.navigateBack();
}

async function updateSettings(partial: Record<string, boolean | number>, showFeedback = false) {
  const newSettings = { ...settings.value, ...partial };
  scheduleStore.setReminderSettings(newSettings);
  await reschedule(newSettings.enabled, showFeedback);
}

async function reschedule(enabled: boolean, showFeedback = false) {
  if (!enabled) {
    clearAllNotifications();
    if (showFeedback) {
      uni.showToast({ title: '已关闭提醒', icon: 'none' });
    }
    return;
  }

  const result = await scheduleCachedTodayReminders(scheduleStore.currentWeek);
  if (!showFeedback) {
    return;
  }

  if (result.status === 'scheduled') {
    uni.showToast({ title: `已设置${result.count}个提醒`, icon: 'none' });
    return;
  }

  if (result.status === 'no_courses') {
    uni.showToast({ title: '今日暂无可提醒课程', icon: 'none' });
    return;
  }

  if (result.status === 'unsupported') {
    uni.showToast({ title: '仅 App 支持课前提醒', icon: 'none' });
    return;
  }

  if (result.status === 'no_permission') {
    uni.showModal({
      title: '通知权限未开启',
      content: '请先在系统设置中开启通知权限，否则课前提醒无法触发。',
      confirmText: '去开启',
      success: (modalRes) => {
        if (modalRes.confirm) {
          openAppSettings();
        }
      }
    });
    return;
  }

  if (result.status === 'no_cache') {
    uni.showToast({ title: '请先同步课表', icon: 'none' });
    return;
  }

  uni.showToast({ title: '提醒设置失败', icon: 'none' });
}

async function onToggleEnabled(e: any) {
  await updateSettings({ enabled: e.detail.value }, true);
}

async function onToggleSound(e: any) {
  await updateSettings({ sound: e.detail.value });
}

async function onToggleVibration(e: any) {
  await updateSettings({ vibration: e.detail.value });
}

function showAdvancePicker() {
  const items = ADVANCE_OPTIONS.map(o => o.label);
  uni.showActionSheet({
    itemList: items,
    success: (res) => {
      void updateSettings({ advanceMinutes: ADVANCE_OPTIONS[res.tapIndex].value }, true);
    }
  });
}
</script>

<style scoped>
.reminder-page {
  min-height: 100vh;
  background: #F4F4F5;
  background-image: radial-gradient(#D4D4D8 1.5px, transparent 1.5px);
  background-size: 20px 20px;
}

.page-header {
  background: #FFFFFF;
  padding: 0 24rpx 16rpx;
  border-bottom: 3rpx solid #000000;
}

.status-bar {
  height: var(--status-bar-height, 44rpx);
}

.header-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 0 8rpx;
}

.back-btn {
  font-size: 48rpx;
  color: #000000;
  font-weight: 900;
  line-height: 1;
  padding-right: 8rpx;
}

.page-title {
  font-size: 40rpx;
  font-weight: 900;
  color: #000000;
}

.settings-list {
  margin: 24rpx;
  margin-right: 30rpx;
  background: #FFFFFF;
  border: 3rpx solid #000000;
  border-radius: 20rpx;
  box-shadow: 4rpx 4rpx 0 #000000;
  overflow: hidden;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 28rpx;
  border-bottom: 2rpx solid #000000;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item:active {
  background: #F9FAFB;
}

.setting-left {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.setting-label {
  font-size: 30rpx;
  color: #000000;
  font-weight: 900;
}

.setting-desc {
  font-size: 22rpx;
  color: #999999;
  font-weight: 700;
}

.setting-right {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.setting-value {
  font-size: 26rpx;
  color: #000000;
  font-weight: 900;
}

.setting-arrow {
  font-size: 32rpx;
  color: #000000;
  font-weight: 900;
}

.tip-section {
  margin: 0 32rpx;
  padding: 20rpx 0;
}

.tip-text {
  font-size: 22rpx;
  color: #999999;
  font-weight: 700;
  line-height: 1.6;
}
</style>
