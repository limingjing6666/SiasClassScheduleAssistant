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
            <view class="capsule-week-btn" @click="showWeekPicker = true">
              <text class="capsule-week">第{{ currentWeek }}周</text>
            </view>
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

    <!-- 课表网格（支持左右滑切周 + 无课周提示） -->
    <view
      v-else
      class="grid-wrapper"
      @touchstart="onGridTouchStart"
      @touchend="onGridTouchEnd"
    >
      <ScheduleGrid
        :courses="displayCourses"
        highlight-today
        show-dates
        :semester-start="semesterStart"
        :current-week="currentWeek"
        @course-click="showCourseDetail"
      />

      <!-- 本周无课轻量引导卡片 -->
      <view v-if="isCurrentWeekEmpty" class="empty-week-overlay">
        <view class="empty-week-card">
          <view class="empty-week-tag">
            <text class="empty-week-tag-text">FREE WEEK</text>
          </view>
          <text class="empty-week-title">第 {{ currentWeek }} 周暂无排课</text>
          <text class="empty-week-desc">左右滑动网格，或点击下方快速切换周次</text>
          <view class="empty-week-actions">
            <view v-if="nearestActiveWeek" class="empty-week-btn btn-primary" @click="selectWeek(nearestActiveWeek)">
              <text class="empty-week-btn-text">去第{{ nearestActiveWeek }}周</text>
            </view>
            <view class="empty-week-btn btn-secondary" @click="showWeekPicker = true">
              <text class="empty-week-btn-text-dark">选择周次</text>
            </view>
          </view>
        </view>
      </view>
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
    <MangaPicker
      :visible="showWeekPicker"
      title="切换周次"
      :options="weekPickerOptions"
      :selected-index="currentWeek - 1"
      @select="onSelectWeekIndex"
      @close="showWeekPicker = false"
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
import { scheduleCachedTodayReminders } from '@/utils/reminder';
import { calculateWeekNumber, filterByWeek } from '@/utils/schedule';
import type { RenderCourse } from '@/types';

import CourseDetailModal from '@/components/CourseDetailModal.vue';
import CustomCalendar from '@/components/CustomCalendar.vue';
import MangaPicker, { type PickerOptionItem } from '@/components/MangaPicker.vue';
import ScheduleGrid from '@/components/ScheduleGrid.vue';
import TabBar from '@/components/TabBar.vue';
import MangaToast from '@/components/MangaToast.vue';

const scheduleStore = useScheduleStore();

function selectWeek(week: number) {
  scheduleStore.setCurrentWeek(week);
}

const showDetail = ref(false);
const showRefreshToast = ref(false);
const showWeekPicker = ref(false);
const selectedCourse = ref<RenderCourse | null>(null);

const currentWeek = computed(() => scheduleStore.currentWeek);
const totalWeeks = computed(() => scheduleStore.totalWeeks);
const displayCourses = computed(() => {
  console.log('[Schedule] Computing displayCourses, courses count:', scheduleStore.courses.length);
  return scheduleStore.displayCourses;
});
const semesterStart = computed(() => scheduleStore.semesterStart);
const userInfo = computed(() => scheduleStore.userInfo);

const realCurrentWeek = computed(() => calculateWeekNumber(semesterStart.value));

const isCurrentWeekEmpty = computed(() => {
  return scheduleStore.courses.length > 0 && displayCourses.value.length === 0;
});

// 距离当前查看周次最近的有课周（方便无课周一键跳转）
const nearestActiveWeek = computed<number | null>(() => {
  if (scheduleStore.courses.length === 0) return null;
  let bestWeek: number | null = null;
  let bestDist = Infinity;
  for (let w = 1; w <= totalWeeks.value; w++) {
    if (filterByWeek(scheduleStore.courses, w).length > 0) {
      const dist = Math.abs(w - currentWeek.value);
      if (dist > 0 && dist < bestDist) {
        bestDist = dist;
        bestWeek = w;
      }
    }
  }
  return bestWeek;
});

const weekPickerOptions = computed<PickerOptionItem[]>(() => {
  const list: PickerOptionItem[] = [];
  for (let w = 1; w <= totalWeeks.value; w++) {
    const hasCourses = filterByWeek(scheduleStore.courses, w).length > 0;
    const isNow = w === realCurrentWeek.value;
    list.push({
      id: w,
      label: `第 ${w} 周`,
      badge: isNow ? '本周' : hasCourses ? '有课' : '无课',
      badgeClass: isNow ? 'badge-today' : hasCourses ? '' : 'badge-muted'
    });
  }
  return list;
});

function onSelectWeekIndex(index: number) {
  selectWeek(index + 1);
}

// 左右轻扫切周手势
let touchStartX = 0;
let touchStartY = 0;

function onGridTouchStart(e: { touches?: Array<{ clientX: number; clientY: number }> }) {
  const touch = e.touches?.[0];
  if (!touch) return;
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}

function onGridTouchEnd(e: { changedTouches?: Array<{ clientX: number; clientY: number }> }) {
  const touch = e.changedTouches?.[0];
  if (!touch) return;
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    if (dx < 0) {
      nextWeek();
    } else {
      prevWeek();
    }
  }
}

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
  const week = calculateWeekNumber(semesterStart.value);
  
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
      console.log('[Schedule] No cached user found, skipping refresh');
      return;
    }
    
    const { username, password: storedPwd } = JSON.parse(cachedUser);
    const password = readPassword(storedPwd, username);
    
    if (!username || !password) {
      console.log('[Schedule] Missing username or password, skipping refresh');
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
    await scheduleCachedTodayReminders(scheduleStore.currentWeek);
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
/* 漫画风课表 */
.schedule-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #FFFFFF;
  color: #000000;
}

.header {
  background: #FFFFFF;
  padding: 0 24rpx 12rpx;
  position: relative;
  z-index: 10;
  border-bottom: 3rpx solid #000000;
}

.status-bar {
  height: var(--status-bar-height, 44rpx);
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 0 8rpx;
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
  gap: 12rpx;
}

/* 本周按钮 - 漫画风 */
.this-week-btn {
  height: 52rpx;
  padding: 0 24rpx;
  background: #000000;
  border: 3rpx solid #000000;
  border-radius: 14rpx;
  box-shadow: 3rpx 3rpx 0 #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.this-week-btn:active {
  transform: translate(2rpx, 2rpx);
  box-shadow: 1rpx 1rpx 0 #000000;
}

.this-week-text {
  font-size: 22rpx;
  color: #FFFFFF;
  font-weight: 900;
  letter-spacing: 3rpx;
}

/* 周切换器 - 漫画风 */
.week-capsule {
  display: flex;
  align-items: center;
  background: #FFFFFF;
  border: 3rpx solid #000000;
  border-radius: 14rpx;
  box-shadow: 3rpx 3rpx 0 #000000;
  padding: 2rpx;
}

.capsule-arrow {
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10rpx;
}

.capsule-arrow:active {
  background: #F3F4F6;
}

.arrow-text {
  font-size: 32rpx;
  color: #000000;
  font-weight: 900;
  line-height: 1;
}

.capsule-week-btn {
  display: flex;
  align-items: center;
  padding: 0 6rpx;
}

.capsule-week {
  font-size: 24rpx;
  font-weight: 900;
  color: #000000;
  white-space: nowrap;
}

/* 同步行 */
.sync-row {
  display: flex;
  align-items: center;
  padding: 6rpx 0 2rpx;
}

.sync-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #55EFC4;
  border: 2rpx solid #000000;
  margin-right: 10rpx;
}

.sync-text {
  font-size: 20rpx;
  color: #999999;
  font-weight: 700;
}

.grid-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* 本周无课浮动提示卡（避让左侧 100rpx 时间栏） */
.empty-week-overlay {
  position: absolute;
  top: 220rpx;
  left: 100rpx;
  right: 0;
  display: flex;
  justify-content: center;
  padding: 0 28rpx;
  pointer-events: none;
  z-index: 5;
}

.empty-week-card {
  pointer-events: auto;
  width: 100%;
  max-width: 560rpx;
  background: #FFFFFF;
  border: 4rpx solid #000000;
  border-radius: 28rpx;
  box-shadow: 8rpx 8rpx 0 #000000;
  padding: 36rpx 32rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.empty-week-tag {
  position: absolute;
  top: -22rpx;
  left: 28rpx;
  padding: 4rpx 16rpx;
  background: #55EFC4;
  border: 3rpx solid #000000;
  box-shadow: 3rpx 3rpx 0 #000000;
  transform: rotate(-2deg);
}

.empty-week-tag-text {
  font-size: 18rpx;
  font-weight: 900;
  color: #000000;
  letter-spacing: 2rpx;
}

.empty-week-title {
  font-size: 32rpx;
  font-weight: 900;
  color: #000000;
  margin-top: 8rpx;
  margin-bottom: 10rpx;
}

.empty-week-desc {
  font-size: 22rpx;
  font-weight: 700;
  color: #71717A;
  text-align: center;
  margin-bottom: 24rpx;
}

.empty-week-actions {
  display: flex;
  gap: 16rpx;
  width: 100%;
}

.empty-week-btn {
  flex: 1;
  height: 72rpx;
  border-radius: 16rpx;
  border: 3rpx solid #000000;
  box-shadow: 4rpx 4rpx 0 #000000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-week-btn:active {
  transform: translate(3rpx, 3rpx);
  box-shadow: 0 0 0 #000000;
}

.btn-primary {
  background: #FFEAA7;
}

.btn-secondary {
  background: #FFFFFF;
}

.empty-week-btn-text {
  font-size: 24rpx;
  font-weight: 900;
  color: #000000;
}

.empty-week-btn-text-dark {
  font-size: 24rpx;
  font-weight: 900;
  color: #000000;
}

/* 骨架屏 */
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
