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
          <view class="action-tag logout-tag" @click="handleLogout">
            <text class="logout-tag-text">退出</text>
          </view>
        </view>
      </view>
    </view>

    <view class="schedule-header">
      <view class="time-column header-cell">
        <text class="header-time-text"></text>
      </view>
      <view
        v-for="day in 7"
        :key="day"
        class="day-column header-cell"
        :class="{ 'today-header': isToday(day) }"
      >
        <text class="day-name" :class="{ 'today-text': isToday(day) }">{{ getDayName(day) }}</text>
        <text class="day-date" :class="{ 'today-text': isToday(day) }">{{ getDateOfDay(day) }}</text>
      </view>
    </view>

    <scroll-view class="schedule-body" scroll-y :show-scrollbar="false">
      <view v-if="scheduleStore.loading" class="schedule-grid skeleton-grid">
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

      <view v-else class="schedule-grid">
        <view class="time-column">
          <view
            v-for="node in 13"
            :key="node"
            class="time-cell"
          >
            <text class="node-num">{{ node }}</text>
            <text class="node-time">{{ getNodeTimeRange(node, node) }}</text>
          </view>
        </view>

        <view class="courses-area">
          <view class="grid-background">
            <view
              v-for="day in 7"
              :key="day"
              class="grid-column"
              :class="{ 'today-column': isToday(day) }"
            >
              <view
                v-for="node in 13"
                :key="node"
                class="grid-cell"
              ></view>
            </view>
          </view>

          <view
            v-for="(course, index) in displayCourses"
            :key="index"
            class="course-block"
            :style="getCourseStyle(course)"
            @click="showCourseDetail(course)"
          >
            <text class="course-name">{{ course.name }}</text>
            <text class="course-room">{{ course.room }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

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
import { useScheduleStore } from '@/stores/schedule';
import { getDayName, getNodeTimeRange } from '@/utils/schedule';
import type { RenderCourse } from '@/types';

import WeekSelector from '@/components/WeekSelector.vue';
import CourseDetailModal from '@/components/CourseDetailModal.vue';
import CustomCalendar from '@/components/CustomCalendar.vue';

const scheduleStore = useScheduleStore();

function selectWeek(week: number) {
  scheduleStore.setCurrentWeek(week);
}

const showDetail = ref(false);
const selectedCourse = ref<RenderCourse | null>(null);

const currentWeek = computed(() => scheduleStore.currentWeek);
const totalWeeks = computed(() => scheduleStore.totalWeeks);
const displayCourses = computed(() => scheduleStore.displayCourses);
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

const NODE_HEIGHT = 100;
const DAY_WIDTH = 100 / 7;

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

function isToday(day: number): boolean {
  const today = new Date().getDay();
  const adjustedToday = today === 0 ? 7 : today;
  return adjustedToday === day;
}

function getDateOfDay(day: number): string {
  const start = new Date(semesterStart.value);
  const daysFromStart = (currentWeek.value - 1) * 7 + (day - 1);
  const targetDate = new Date(start);
  targetDate.setDate(start.getDate() + daysFromStart);
  
  const month = targetDate.getMonth() + 1;
  const date = targetDate.getDate();
  return `${month}/${date}`;
}

function getCourseStyle(course: RenderCourse) {
  const day = parseInt(course.day);
  const left = (day - 1) * DAY_WIDTH;
  const top = (course.startNode - 1) * NODE_HEIGHT;
  const height = course.step * NODE_HEIGHT;

  return {
    left: `${left}%`,
    top: `${top}rpx`,
    width: `${DAY_WIDTH}%`,
    height: `${height}rpx`,
    backgroundColor: course.color,
    borderRadius: '8rpx',
    border: '1rpx solid rgba(0,0,0,0.02)'
  };
}

function showCourseDetail(course: RenderCourse) {
  selectedCourse.value = course;
  showDetail.value = true;
}

function closeDetail() {
  showDetail.value = false;
  selectedCourse.value = null;
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

.logout-tag {
  background: transparent;
}

.logout-tag-text {
  font-size: 24rpx;
  color: #888888;
  font-weight: 500;
}

.action-tag-text {
  font-size: 24rpx;
  color: #000000;
  font-weight: 600;
}

.schedule-header {
  display: flex;
  background: #FFFFFF;
  border-bottom: 1rpx solid #EAEAEA;
  padding: 12rpx 0;
}

.header-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 76rpx;
}

.today-header {
  position: relative;
}

.today-header::after {
  content: '';
  position: absolute;
  bottom: -12rpx;
  left: 25%;
  right: 25%;
  height: 6rpx;
  background: #000000;
  border-radius: 4rpx;
}

.time-column {
  width: 100rpx;
  flex-shrink: 0;
}

.day-column {
  flex: 1;
}

.day-name {
  font-size: 24rpx;
  color: #888888;
  font-weight: 500;
}

.day-name.today-text {
  color: #000000;
  font-weight: 700;
}

.day-date {
  font-size: 18rpx;
  color: #BBBBBB;
  margin-top: 4rpx;
}

.day-date.today-text {
  color: #000000;
}

.schedule-body {
  flex: 1;
  overflow: hidden;
}

.schedule-grid {
  display: flex;
  position: relative;
}

.time-column .time-cell {
  height: 100rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-bottom: 1rpx solid #F5F5F5;
  background: #FFFFFF;
}

.node-num {
  font-size: 22rpx;
  color: #888888;
  font-weight: 600;
}

.node-time {
  font-size: 16rpx;
  color: #BBBBBB;
  margin-top: 4rpx;
}

.courses-area {
  flex: 1;
  position: relative;
  height: 1300rpx;
}

.grid-background {
  display: flex;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.grid-column {
  flex: 1;
  border-left: 1rpx solid #F5F5F5;
  background: #FFFFFF;
}

.grid-column.today-column {
  background: #FAFAFA;
}

.grid-cell {
  height: 100rpx;
  border-bottom: 1rpx solid #F5F5F5;
}

.course-block {
  position: absolute;
  padding: 8rpx;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 2rpx;
  text-align: center;
}

.course-name {
  font-size: 22rpx;
  font-weight: 600;
  color: #000000;
  line-height: 1.25;
  word-break: break-all;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.course-room {
  font-size: 18rpx;
  color: rgba(0, 0, 0, 0.6);
  margin-top: 6rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90%;
}
</style>
