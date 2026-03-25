<template>
  <view class="schedule-page">
    <view class="header">
      <view class="status-bar"></view>
      <view class="header-main">
        <text class="header-title">我的课表 🚀</text>
        <view class="week-nav">
          <view class="nav-arrow" @click="prevWeek">
            <text class="arrow">❮</text>
          </view>
          <WeekSelector 
            :current-week="currentWeek" 
            :total-weeks="totalWeeks" 
            @select-week="selectWeek" 
          />
          <view class="nav-arrow" @click="nextWeek">
            <text class="arrow">❯</text>
          </view>
        </view>
      </view>
      <view class="week-bar">
        <view class="sync-info" v-if="userInfo?.lastSyncAt">
          <text class="sync-text">上次同步: {{ formatSyncTime(userInfo.lastSyncAt) }}</text>
        </view>
        <view class="week-actions">
          <view class="action-tag" @click="goToCurrentWeek">
            <text class="action-tag-text">本周</text>
          </view>
        </view>
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
    <ScheduleGrid
      v-else
      :courses="displayCourses"
      highlight-today
      show-dates
      :semester-start="semesterStart"
      :current-week="currentWeek"
      @course-click="showCourseDetail"
    />

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
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { onPullDownRefresh } from '@dcloudio/uni-app';
import { useScheduleStore } from '@/stores/schedule';
import { syncSchedule } from '@/api/schedule';
import { readPassword, encryptPassword } from '@/utils/crypto';
import type { RenderCourse } from '@/types';

import WeekSelector from '@/components/WeekSelector.vue';
import CourseDetailModal from '@/components/CourseDetailModal.vue';
import CustomCalendar from '@/components/CustomCalendar.vue';
import ScheduleGrid from '@/components/ScheduleGrid.vue';

const scheduleStore = useScheduleStore();

function selectWeek(week: number) {
  scheduleStore.setCurrentWeek(week);
}

const showDetail = ref(false);
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
    
    uni.showToast({ title: '刷新成功', icon: 'success' });
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
  height: 100%;
  background: #FFFFFF;
  color: #000000;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.header {
  background: #FFFFFF;
  padding-bottom: 24rpx;
  position: relative;
  z-index: 10;
}

.status-bar {
  height: var(--status-bar-height, 44rpx);
}

.header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 32rpx 16rpx;
}

.header-title {
  font-size: 40rpx;
  font-weight: 800;
  color: #000000;
  letter-spacing: -1rpx;
}

.week-nav {
  display: flex;
  align-items: center;
}

.nav-arrow {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
  background: #F5F5F5;
}

.arrow {
  font-size: 24rpx;
  color: #000000;
  font-weight: 700;
}

.week-bar {
  padding: 12rpx 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sync-info {
  display: flex;
  align-items: center;
}

.sync-text {
  font-size: 22rpx;
  color: #888888;
}

.week-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.action-tag {
  height: 52rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F5F5F5;
  border-radius: 8rpx;
}

.action-tag-text {
  font-size: 24rpx;
  color: #000000;
  font-weight: 600;
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
