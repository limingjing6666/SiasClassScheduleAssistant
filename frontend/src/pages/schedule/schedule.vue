<template>
  <view class="schedule-page">
    <view class="header">
      <view class="status-bar"></view>
      <view class="header-row">
        <text class="header-title">我的课表</text>
        <view class="header-controls">
          <view class="this-week-btn" @click="goToCurrentWeek">
            <text class="this-week-text">本周</text>
          </view>
          <view class="week-capsule">
            <view class="capsule-arrow" @click="prevWeek">
              <text class="arrow-text">‹</text>
            </view>
            <text class="capsule-week">第{{ currentWeek }}周</text>
            <view class="capsule-arrow" @click="nextWeek">
              <text class="arrow-text">›</text>
            </view>
          </view>
        </view>
      </view>
      <view class="sync-row" v-if="userInfo?.lastSyncAt" @click="handlePullDownRefresh">
        <view class="sync-dot"></view>
        <text class="sync-text">更新于 {{ formatSyncTime(userInfo.lastSyncAt) }}  点击刷新</text>
      </view>
    </view>

    <!-- 骨架屏加载状态 -->
    <view v-if="scheduleStore.loading" class="skeleton-container">
      <view class="schedule-grid skeleton-grid">
        <view class="time-column">
          <view v-for="n in 12" :key="n" class="time-cell skeleton-item" style="margin: 4rpx; height: 92rpx;"></view>
        </view>
        <view class="courses-area" style="display: flex;">
          <view v-for="day in 7" :key="day" class="grid-column" style="padding: 4rpx;">
            <view v-for="node in 6" :key="node" class="skeleton-item" 
              :style="{ height: (node % 3 === 0 ? '200rpx' : '100rpx'), marginBottom: '8rpx', width: '90%' }">
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 课表网格 -->
    <view v-else class="grid-wrapper">
      <ScheduleGrid
        :courses="displayCourses"
        highlight-today
        show-dates
        :semester-start="semesterStart"
        :current-week="currentWeek"
        @course-click="showCourseDetail"
      />
    </view>

    <CourseDetailModal
      v-if="showDetail && selectedCourse"
      :course="selectedCourse"
      @close="closeDetail"
    />
    <CustomCalendar
      v-if="showCalendar"
      :initial-date="semesterStart"
      @close="showCalendar = false"
      @select-date="onSelectDate"
    />

    <MangaToast :visible="showRefreshToast" message="刷新成功" @hide="showRefreshToast = false" />

    <TabBar current="schedule" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { onPullDownRefresh } from '@dcloudio/uni-app';
import { useScheduleStore } from '@/stores/schedule';
import { syncSchedule } from '@/api/schedule';
import { readPassword, encryptPassword } from '@/utils/crypto';
import type { RenderCourse } from '@/types';

import CourseDetailModal from '@/components/CourseDetailModal.vue';
import CustomCalendar from '@/components/CustomCalendar.vue';
import ScheduleGrid from '@/components/ScheduleGrid.vue';
import TabBar from '@/components/TabBar.vue';
import MangaToast from '@/components/MangaToast.vue';

const scheduleStore = useScheduleStore();

function selectWeek(week: number) {
  scheduleStore.setCurrentWeek(week);
}

const showDetail = ref(false);
const showRefreshToast = ref(false);
const selectedCourse = ref<RenderCourse | null>(null);

const currentWeek = computed(() => scheduleStore.currentWeek);
const totalWeeks = computed(() => scheduleStore.totalWeeks);
const displayCourses = computed(() => {
  console.log('[Schedule] Computing displayCourses, courses count:', scheduleStore.courses.length);
  return scheduleStore.displayCourses;
});
const semesterStart = computed(() => scheduleStore.semesterStart);
const userInfo = computed(() => scheduleStore.userInfo);

function formatSyncTime(isoString: string): string {
  if (!isoString) return '未知';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '未知';
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${h}:${min}`;
}

onMounted(() => {
  if (!scheduleStore.userInfo || scheduleStore.courses.length === 0) {
    uni.reLaunch({
      url: '/pages/login/login'
    });
  }
});

function prevWeek() {
  if (currentWeek.value > 1) {
    scheduleStore.setCurrentWeek(currentWeek.value - 1);
  }
}

function nextWeek() {
  if (currentWeek.value < totalWeeks.value) {
    scheduleStore.setCurrentWeek(currentWeek.value + 1);
  }
}

const showCalendar = ref(false);

function openCalendar() {
  showCalendar.value = true;
}

function onSelectDate(dateStr: string) {
  scheduleStore.setSemesterStart(dateStr);
  showCalendar.value = false;
  uni.showToast({ title: '开学日期已设置', icon: 'none' });
}

function goToCurrentWeek() {
  const start = new Date(semesterStart.value);
  const today = new Date();
  const diffTime = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  
  if (week < 1) {
    uni.showToast({ title: '学期尚未开始', icon: 'none' });
    scheduleStore.setCurrentWeek(1);
  } else if (week > totalWeeks.value) {
    uni.showToast({ title: '已超出学期', icon: 'none' });
    scheduleStore.setCurrentWeek(totalWeeks.value);
  } else {
    scheduleStore.setCurrentWeek(week);
  }
}

function showCourseDetail(course: RenderCourse) {
  selectedCourse.value = course;
  showDetail.value = true;
}

function closeDetail() {
  showDetail.value = false;
  selectedCourse.value = null;
}

// 下拉刷新
async function handlePullDownRefresh() {
  console.log('[Schedule] Pull down refresh started');
  
  try {
    // 1. 获取本地存储的账号密码
    const cachedUser = uni.getStorageSync('userInfo');
    console.log('[Schedule] cachedUser:', cachedUser);
    
    if (!cachedUser) {
      console.log('[Schedule] No cached user found');
      uni.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    
    const { username, password: storedPwd } = JSON.parse(cachedUser);
    const password = readPassword(storedPwd, username);
    
    if (!username || !password) {
      console.log('[Schedule] Missing username or password');
      uni.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    // 2. 重新登录获取新cookie并获取课表
    console.log('[Schedule] Starting syncSchedule');
    const courses = await syncSchedule({ username, password });
    console.log('[Schedule] syncSchedule completed, courses count:', courses?.length);
    
    // 3. 更新缓存
    console.log('[Schedule] Updating courses cache');
    scheduleStore.setCourses(courses);
    
    console.log('[Schedule] Updating userInfo cache');
    const newUserInfo = {
      studentId: username,
      username: username,
      password: encryptPassword(password, username),
      lastSyncAt: new Date().toISOString()
    };
    scheduleStore.setUserInfo(newUserInfo);
    console.log('[Schedule] userInfo updated:', newUserInfo);
    
    showRefreshToast.value = true;
    console.log('[Schedule] Pull down refresh completed successfully');
  } catch (error: unknown) {
    console.error('[Schedule] Pull down refresh failed:', error);
    uni.showToast({ title: error instanceof Error ? error.message : '刷新失败', icon: 'none' });
  } finally {
    console.log('[Schedule] Stopping pull down refresh');
    uni.stopPullDownRefresh();
  }
}

// 页面生命周期：下拉刷新触发
onPullDownRefresh(() => {
  console.log('[Schedule] onPullDownRefresh triggered');
  handlePullDownRefresh();
});

</script>

<style scoped>
/* 极简网格课表样式 (Minimalist UI) */
.schedule-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #FFFFFF;
  color: #000000;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.header {
  background: #FFFFFF;
  padding: 0 24rpx 16rpx;
  position: relative;
  z-index: 10;
  border-bottom: 1rpx solid #F0F0F0;
}

.status-bar {
  height: var(--status-bar-height, 44rpx);
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0 8rpx;
}

.header-title {
  font-size: 52rpx;
  font-weight: 900;
  color: #000000;
  letter-spacing: -2rpx;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.this-week-btn {
  height: 56rpx;
  padding: 0 28rpx;
  background: #000000;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.this-week-text {
  font-size: 22rpx;
  color: #FFFFFF;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.week-capsule {
  display: flex;
  align-items: center;
  background: #F5F5F5;
  border-radius: 999rpx;
  padding: 4rpx;
  border: 1rpx solid rgba(0, 0, 0, 0.04);
}

.capsule-arrow {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
}

.capsule-arrow:active {
  background: #FFFFFF;
}

.arrow-text {
  font-size: 32rpx;
  color: #999999;
  font-weight: 600;
  line-height: 1;
}

.capsule-week {
  font-size: 26rpx;
  font-weight: 700;
  color: #000000;
  padding: 0 8rpx;
  white-space: nowrap;
}

.sync-row {
  display: flex;
  align-items: center;
  padding: 4rpx 0;
}

.sync-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 999rpx;
  background: #34D399;
  margin-right: 12rpx;
  box-shadow: 0 0 16rpx rgba(52, 211, 153, 0.5);
}

.sync-text {
  font-size: 20rpx;
  color: #999999;
  font-weight: 600;
}

.grid-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 骨架屏（仅 schedule 页使用） */
.skeleton-container {
  flex: 1;
  overflow: hidden;
}

.schedule-grid {
  display: flex;
  position: relative;
}

.time-column {
  width: 100rpx;
  flex-shrink: 0;
}

.courses-area {
  flex: 1;
  position: relative;
}

.grid-column {
  flex: 1;
}

</style>
