<template>
  <view class="schedule-page">
    <!-- 顶部导航 -->
    <view class="header">
      <view class="status-bar"></view>
      <view class="header-main">
        <text class="header-title">我的课表</text>
        <view class="header-actions">
          <text class="student-id" v-if="userInfo">{{ userInfo.studentId }}</text>
          <view class="logout-btn" @click="handleLogout">
            <text class="logout-text">退出</text>
          </view>
        </view>
      </view>
      <view class="week-bar">
        <view class="week-nav">
          <view class="nav-arrow" @click="prevWeek">
            <text class="arrow">❮</text>
          </view>
          <view class="week-num-btn" @click="showWeekPopup = true">
            <text class="week-num">第{{ currentWeek }}周</text>
            <text class="week-num-arrow">▼</text>
            <!-- 自定义周数选择弹窗 -->
            <view v-if="showWeekPopup" class="week-popup-dropdown" @click.stop>
              <view class="week-popup-title">选择周数</view>
              <scroll-view class="week-popup-list" scroll-y>
                <view
                  v-for="(item, idx) in weekOptions"
                  :key="idx"
                  class="week-popup-item"
                  :class="{ 'active': idx + 1 === currentWeek }"
                  @click="selectWeek(idx + 1)"
                >
                  {{ item }}
                </view>
              </scroll-view>
            </view>
          </view>
          <view class="nav-arrow" @click="nextWeek">
            <text class="arrow">❯</text>
          </view>
        </view>
        <view class="week-actions">
          <view class="action-tag" @click="goToCurrentWeek">
            <text class="action-tag-text">本周</text>
          </view>
          <picker
            mode="date"
            :value="semesterStart"
            @change="onSemesterStartChange"
          >
            <view class="action-tag">
              <text class="action-tag-text">📅</text>
            </view>
          </picker>
        </view>
      </view>
    </view>

    <!-- 课表头部 - 星期 -->
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

    <!-- 课表主体 -->
    <scroll-view class="schedule-body" scroll-y :show-scrollbar="false">
      <view class="schedule-grid">
        <!-- 节次列 -->
        <view class="time-column">
          <view
            v-for="node in 13"
            :key="node"
            class="time-cell"
          >
            <text class="node-num">{{ node }}</text>
          </view>
        </view>

        <!-- 课程区域 -->
        <view class="courses-area">
          <!-- 网格背景 -->
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

          <!-- 课程块 -->
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

    <!-- 课程详情弹窗 -->
    <view v-if="showDetail" class="detail-overlay" @click="closeDetail">
      <view class="detail-card" @click.stop>
        <view class="detail-color-bar" :style="{ background: selectedCourse?.color }"></view>
        <view class="detail-header">
          <text class="detail-title">{{ selectedCourse?.name }}</text>
        </view>
        <view class="detail-body">
          <view class="detail-item">
            <text class="detail-item-icon">👨‍🏫</text>
            <view class="detail-item-content">
              <text class="detail-item-label">教师</text>
              <text class="detail-item-value">{{ selectedCourse?.teacher }}</text>
            </view>
          </view>
          <view class="detail-item">
            <text class="detail-item-icon">📍</text>
            <view class="detail-item-content">
              <text class="detail-item-label">教室</text>
              <text class="detail-item-value">{{ selectedCourse?.room }}</text>
            </view>
          </view>
          <view class="detail-item">
            <text class="detail-item-icon">📅</text>
            <view class="detail-item-content">
              <text class="detail-item-label">时间</text>
              <text class="detail-item-value">{{ getDayName(parseInt(selectedCourse?.day || '1')) }} 第{{ selectedCourse?.nodes }}节</text>
            </view>
          </view>
          <view class="detail-item">
            <text class="detail-item-icon">⏰</text>
            <view class="detail-item-content">
              <text class="detail-item-label">时段</text>
              <text class="detail-item-value">{{ getDetailTimeRange() }}</text>
            </view>
          </view>
        </view>
        <view class="detail-footer">
          <button class="detail-close-btn" @click="closeDetail">关闭</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
const showWeekPopup = ref(false);

function selectWeek(week: number) {
  scheduleStore.setCurrentWeek(week);
  showWeekPopup.value = false;
}
import { ref, computed, onMounted } from 'vue';
import { useScheduleStore } from '@/stores/schedule';
import { getDayName, getNodeStartTime, getNodeTimeRange } from '@/utils/schedule';
import type { RenderCourse } from '@/types';

const scheduleStore = useScheduleStore();

// 状态
const showDetail = ref(false);
const selectedCourse = ref<RenderCourse | null>(null);

// 计算属性
const currentWeek = computed(() => scheduleStore.currentWeek);
const totalWeeks = computed(() => scheduleStore.totalWeeks);
const displayCourses = computed(() => scheduleStore.displayCourses);
const semesterStart = computed(() => scheduleStore.semesterStart);

// 周次选项
const weekOptions = computed(() => {
  return Array.from({ length: totalWeeks.value }, (_, i) => `第 ${i + 1} 周`);
});

// 节次高度 (rpx)
const NODE_HEIGHT = 100;
// 列宽百分比
const DAY_WIDTH = 100 / 7;

// 生命周期
onMounted(() => {
  scheduleStore.loadFromCache();
});

// 方法
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

function onWeekChange(e: any) {
  const index = parseInt(e.detail.value);
  scheduleStore.setCurrentWeek(index + 1);
}

// 设置学期开始日期
function onSemesterStartChange(e: any) {
  const date = e.detail.value;
  scheduleStore.setSemesterStart(date);
  uni.showToast({ title: '开学日期已设置', icon: 'success' });
}

// 跳转到当前周
function goToCurrentWeek() {
  const start = new Date(semesterStart.value);
  const today = new Date();
  // 计算今天距离开学的天数
  const diffTime = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  // 计算当前是第几周
  const week = Math.floor(diffDays / 7) + 1;
  
  if (week < 1) {
    uni.showToast({ title: '学期尚未开始', icon: 'none' });
    scheduleStore.setCurrentWeek(1);
  } else if (week > totalWeeks.value) {
    uni.showToast({ title: '已超出学期范围', icon: 'none' });
    scheduleStore.setCurrentWeek(totalWeeks.value);
  } else {
    scheduleStore.setCurrentWeek(week);
    uni.showToast({ title: `已跳转到第${week}周`, icon: 'success' });
  }
}

function isToday(day: number): boolean {
  const today = new Date().getDay();
  // JavaScript中周日是0，需要转换
  const adjustedToday = today === 0 ? 7 : today;
  return adjustedToday === day;
}

// 根据学期开始日期和当前周数，计算某一天的日期
function getDateOfDay(day: number): string {
  const start = new Date(semesterStart.value);
  // 计算距离学期开始的天数: (周数-1)*7 + (星期几-1)
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
    backgroundColor: course.color
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

// 获取详情时间范围
function getDetailTimeRange(): string {
  if (!selectedCourse.value) return '';
  const nodes = selectedCourse.value.nodes.split('-');
  const startNode = parseInt(nodes[0]);
  const endNode = parseInt(nodes[nodes.length - 1]);
  return getNodeTimeRange(startNode, endNode);
}

// 用户信息
const userInfo = computed(() => scheduleStore.userInfo);

// 退出登录
function handleLogout() {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        // 清除数据
        scheduleStore.clearData();
        uni.showToast({ title: '已退出登录', icon: 'success' });
        // 跳转到登录页
        setTimeout(() => {
          uni.reLaunch({
            url: '/pages/login/login'
          });
        }, 1000);
      }
    }
  });
}
</script>

<style scoped>
.schedule-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f2f3f7;
}

/* ========== 顶部导航 ========== */
.header {
  background: #ffffff;
  padding-bottom: 16rpx;
  box-shadow: 0 2rpx 16rpx rgba(0, 0, 0, 0.06);
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
  padding: 16rpx 28rpx 12rpx;
}

.header-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #1a1a2e;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.student-id {
  font-size: 24rpx;
  color: #999;
}

.logout-btn {
  padding: 6rpx 20rpx;
  background: #f5f5f5;
  border-radius: 20rpx;
}

.logout-text {
  font-size: 24rpx;
  color: #888;
}

/* 周选择栏 */
.week-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 28rpx;
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
  border-radius: 28rpx;
  background: #f5f5f8;
}

.arrow {
  font-size: 24rpx;
  color: #555;
  font-weight: 600;
}

.week-num-btn {
  display: flex;
  align-items: center;
  background: #eef3ff;
  border-radius: 24rpx;
  padding: 0 28rpx;
  height: 56rpx;
  margin: 0 12rpx;
  position: relative;
}

.week-num {
  font-size: 30rpx;
  font-weight: 700;
  color: #4A6CF7;
}

.week-num-arrow {
  font-size: 20rpx;
  color: #4A6CF7;
  margin-left: 8rpx;
}

.week-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.action-tag {
  height: 52rpx;
  padding: 0 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f8;
  border-radius: 24rpx;
}

.action-tag-text {
  font-size: 24rpx;
  color: #4A6CF7;
  font-weight: 600;
}

/* 周数弹窗 */
.week-popup-dropdown {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: 64rpx;
  width: 240rpx;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.12);
  z-index: 200;
  overflow: hidden;
}

.week-popup-title {
  font-size: 24rpx;
  color: #4A6CF7;
  font-weight: 600;
  padding: 16rpx 0;
  text-align: center;
  border-bottom: 1rpx solid #f0f0f0;
}

.week-popup-list {
  max-height: 400rpx;
  width: 100%;
}

.week-popup-item {
  text-align: center;
  font-size: 26rpx;
  color: #333;
  padding: 18rpx 0;
}

.week-popup-item.active {
  color: #4A6CF7;
  font-weight: 700;
  background: #eef3ff;
}

/* ========== 课表头部 ========== */
.schedule-header {
  display: flex;
  background: #ffffff;
  border-bottom: 1rpx solid #eef0f3;
  padding: 8rpx 0;
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
  bottom: 0;
  left: 20%;
  right: 20%;
  height: 4rpx;
  background: #4A6CF7;
  border-radius: 2rpx;
}

.header-time-text {
  font-size: 20rpx;
  color: #bbb;
}

.time-column {
  width: 72rpx;
  flex-shrink: 0;
}

.day-column {
  flex: 1;
}

.day-name {
  font-size: 24rpx;
  color: #444;
  font-weight: 500;
}

.day-name.today-text {
  color: #4A6CF7;
  font-weight: 700;
}

.day-date {
  font-size: 18rpx;
  color: #aaa;
  margin-top: 2rpx;
}

.day-date.today-text {
  color: #4A6CF7;
}

/* ========== 课表主体 ========== */
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
  border-bottom: 1rpx solid #f0f0f3;
  background: #fafbfd;
}

.node-num {
  font-size: 22rpx;
  color: #999;
  font-weight: 500;
}

/* 课程区域 */
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
  border-left: 1rpx solid #f0f0f3;
  background: #ffffff;
}

.grid-column.today-column {
  background: #f7f9ff;
}

.grid-cell {
  height: 100rpx;
  border-bottom: 1rpx solid #f0f0f3;
}

/* ========== 课程块 ========== */
.course-block {
  position: absolute;
  border-radius: 12rpx;
  padding: 8rpx 6rpx;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 3rpx;
  text-align: center;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
  border: 1rpx solid rgba(255, 255, 255, 0.3);
}

.course-name {
  font-size: 20rpx;
  font-weight: 700;
  color: #333;
  line-height: 1.25;
  word-break: break-all;
  text-align: center;
  overflow: hidden;
  width: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.course-room {
  font-size: 16rpx;
  color: #555;
  margin-top: 4rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  text-align: center;
}

/* ========== 课程详情弹窗 ========== */
.detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.detail-card {
  width: 85%;
  max-width: 640rpx;
  background: #ffffff;
  border-radius: 28rpx;
  overflow: hidden;
  box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.18);
}

.detail-color-bar {
  height: 10rpx;
  width: 100%;
}

.detail-header {
  padding: 36rpx 40rpx 16rpx;
}

.detail-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #1a1a2e;
  line-height: 1.4;
}

.detail-body {
  padding: 8rpx 40rpx 16rpx;
}

.detail-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f5f8;
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-item-icon {
  font-size: 32rpx;
  width: 52rpx;
  text-align: center;
  flex-shrink: 0;
}

.detail-item-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-left: 12rpx;
}

.detail-item-label {
  font-size: 22rpx;
  color: #aaa;
}

.detail-item-value {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  margin-top: 4rpx;
}

.detail-footer {
  padding: 16rpx 40rpx 36rpx;
}

.detail-close-btn {
  width: 100%;
  height: 84rpx;
  line-height: 84rpx;
  background: #1a2332;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
  border: none;
  border-radius: 16rpx;
  letter-spacing: 4rpx;
}

.detail-close-btn::after {
  border: none;
}
</style>
