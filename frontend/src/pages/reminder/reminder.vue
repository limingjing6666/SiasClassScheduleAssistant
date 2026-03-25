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
import { scheduleTodayReminders, clearAllNotifications } from '@/utils/reminder';

const scheduleStore = useScheduleStore();
const settings = computed(() => scheduleStore.reminderSettings);

const currentAdvanceLabel = computed(() => {
  const opt = ADVANCE_OPTIONS.find(o => o.value === settings.value.advanceMinutes);
  return opt ? opt.label : `${settings.value.advanceMinutes}分钟`;
});

function goBack() {
  uni.navigateBack();
}

function updateSettings(partial: Record<string, boolean | number>) {
  const newSettings = { ...settings.value, ...partial };
  scheduleStore.setReminderSettings(newSettings);
  reschedule(newSettings.enabled);
}

function reschedule(enabled: boolean) {
  if (!enabled) {
    clearAllNotifications();
    return;
  }
  const cachedCourses = uni.getStorageSync('courses');
  if (cachedCourses) {
    try {
      const courses = JSON.parse(cachedCourses);
      scheduleTodayReminders(courses, scheduleStore.currentWeek);
    } catch { /* ignore */ }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- uni-app switch event
function onToggleEnabled(e: any) {
  updateSettings({ enabled: e.detail.value });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onToggleSound(e: any) {
  updateSettings({ sound: e.detail.value });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onToggleVibration(e: any) {
  updateSettings({ vibration: e.detail.value });
}

function showAdvancePicker() {
  const items = ADVANCE_OPTIONS.map(o => o.label);
  uni.showActionSheet({
    itemList: items,
    success: (res) => {
      updateSettings({ advanceMinutes: ADVANCE_OPTIONS[res.tapIndex].value });
    }
  });
}
</script>

<style scoped>
.reminder-page {
  min-height: 100vh;
  background: #F5F5F5;
}

.page-header {
  background: #FFFFFF;
  padding: 32rpx;
}

.status-bar {
  height: var(--status-bar-height, 44rpx);
}

.header-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 16rpx;
}

.back-btn {
  font-size: 56rpx;
  color: #000000;
  line-height: 1;
  padding-right: 8rpx;
}

.page-title {
  font-size: 40rpx;
  font-weight: 800;
  color: #000000;
}

.settings-list {
  margin: 24rpx;
  background: #FFFFFF;
  border-radius: 12rpx;
  overflow: hidden;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx;
  border-bottom: 1rpx solid #F0F0F0;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item:active {
  background: #FAFAFA;
}

.setting-left {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.setting-label {
  font-size: 30rpx;
  color: #333333;
}

.setting-desc {
  font-size: 24rpx;
  color: #999999;
}

.setting-right {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.setting-value {
  font-size: 28rpx;
  color: #999999;
}

.setting-arrow {
  font-size: 36rpx;
  color: #CCCCCC;
}

.tip-section {
  margin: 0 36rpx;
  padding: 24rpx 0;
}

.tip-text {
  font-size: 24rpx;
  color: #999999;
  line-height: 1.6;
}
</style>
