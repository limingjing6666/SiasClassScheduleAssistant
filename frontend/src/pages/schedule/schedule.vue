<template>
  <view class="schedule-page">
    <!-- 顶部导航 -->
    <view class="header">
      <view class="status-bar"></view>
      <view class="header-main">
        <text class="header-title">我的课表</text>
        <view class="week-nav">
          <view class="nav-arrow" @click="prevWeek">
            <text class="arrow">❮</text>
          </view>
          <view class="week-num-btn" @click="showWeekPopup = !showWeekPopup">
            <text class="week-num">第{{ currentWeek }}周</text>
            <text class="week-num-arrow">▼</text>
          </view>
          
          <!-- 周数选择弹窗（独立遮罩层） -->
          <view v-if="showWeekPopup" class="week-popup-mask" @click="showWeekPopup = false"></view>
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
      <!-- 骨架屏状态 -->
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
        <!-- 节次列 -->
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
            <text class="course-room">📍 {{ course.room }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 课程详情弹窗 -->
    <view v-if="showDetail" class="detail-overlay" @click="closeDetail">
      <view class="detail-card" @click.stop>
        <!-- 顶部彩色区域 -->
        <view class="detail-banner" :style="{ background: `linear-gradient(135deg, ${selectedCourse?.color}, ${selectedCourse?.glowColor})` }">
          <text class="detail-banner-title">{{ selectedCourse?.name }}</text>
          <text class="detail-banner-sub">{{ getDayName(parseInt(selectedCourse?.day || '1')) }} · 第{{ selectedCourse?.nodes }}节</text>
        </view>
        <!-- 信息列表 -->
        <view class="detail-body">
          <view class="detail-item">
            <view class="detail-icon-badge" style="background: rgba(200, 122, 60, 0.15);">
              <text class="detail-item-icon">👨‍🏫</text>
            </view>
            <view class="detail-item-content">
              <text class="detail-item-label">授课教师</text>
              <text class="detail-item-value">{{ selectedCourse?.teacher || '未知' }}</text>
            </view>
          </view>
          <view class="detail-item">
            <view class="detail-icon-badge" style="background: rgba(139, 74, 26, 0.15);">
              <text class="detail-item-icon">📍</text>
            </view>
            <view class="detail-item-content">
              <text class="detail-item-label">上课教室</text>
              <text class="detail-item-value">{{ selectedCourse?.room || '未知' }}</text>
            </view>
          </view>
          <view class="detail-item">
            <view class="detail-icon-badge" style="background: rgba(90, 74, 16, 0.2);">
              <text class="detail-item-icon">📅</text>
            </view>
            <view class="detail-item-content">
              <text class="detail-item-label">上课时间</text>
              <text class="detail-item-value">{{ getDayName(parseInt(selectedCourse?.day || '1')) }} 第{{ selectedCourse?.nodes }}节</text>
            </view>
          </view>
          <view class="detail-item">
            <view class="detail-icon-badge" style="background: rgba(160, 82, 45, 0.15);">
              <text class="detail-item-icon">⏰</text>
            </view>
            <view class="detail-item-content">
              <text class="detail-item-label">具体时段</text>
              <text class="detail-item-value">{{ getDetailTimeRange() }}</text>
            </view>
          </view>
        </view>
        <!-- 底部按钮 -->
        <view class="detail-footer">
          <button class="detail-close-btn" @click="closeDetail">关 闭</button>
        </view>
      </view>
    </view>
    <!-- 自定义日历弹窗 -->
    <view v-if="showCalendar" class="cal-overlay" @click="showCalendar = false">
      <view class="cal-card" @click.stop>
        <!-- 月份导航 -->
        <view class="cal-header">
          <view class="cal-nav-btn" @click="calPrevMonth">
            <text class="cal-nav-arrow">❮</text>
          </view>
          <text class="cal-month-text">{{ calYear }}年{{ String(calMonth).padStart(2, '0') }}月</text>
          <view class="cal-nav-btn" @click="calNextMonth">
            <text class="cal-nav-arrow">❯</text>
          </view>
        </view>
        <!-- 星期标题 -->
        <view class="cal-weekdays">
          <text class="cal-weekday" v-for="w in ['日','一','二','三','四','五','六']" :key="w">{{ w }}</text>
        </view>
        <!-- 日期网格 -->
        <view class="cal-grid">
          <view
            v-for="(cell, idx) in calendarCells"
            :key="idx"
            class="cal-cell"
            :class="{
              'cal-cell-empty': !cell.day,
              'cal-cell-today': cell.isToday,
              'cal-cell-selected': cell.isSelected,
              'cal-cell-other': cell.otherMonth
            }"
            @click="cell.day && selectCalDate(cell)"
          >
            <text class="cal-cell-text" v-if="cell.day">{{ cell.day }}</text>
          </view>
        </view>
        <!-- 底部操作 -->
        <view class="cal-footer">
          <view class="cal-footer-btn" @click="calSelectToday">
            <text class="cal-footer-btn-text">今天</text>
          </view>
          <view class="cal-footer-btn cal-footer-btn-primary" @click="showCalendar = false">
            <text class="cal-footer-btn-text cal-footer-primary-text">关闭</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useScheduleStore } from '@/stores/schedule';
import { getDayName, getNodeTimeRange } from '@/utils/schedule';
import type { RenderCourse } from '@/types';

const scheduleStore = useScheduleStore();

const showWeekPopup = ref(false);

function selectWeek(week: number) {
  scheduleStore.setCurrentWeek(week);
  showWeekPopup.value = false;
}

// 状态
const showDetail = ref(false);
const selectedCourse = ref<RenderCourse | null>(null);

// 计算属性
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
  // 保护：如果没有用户信息或课程数据，回到登录页
  if (!scheduleStore.userInfo || scheduleStore.courses.length === 0) {
    uni.reLaunch({
      url: '/pages/login/login'
    });
  }
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

// ====== 自定义日历 ======
const showCalendar = ref(false);
const calYear = ref(new Date().getFullYear());
const calMonth = ref(new Date().getMonth() + 1); // 1-based

function openCalendar() {
  // 初始化为当前选中的学期开始日期月份
  const d = new Date(semesterStart.value);
  if (!Number.isNaN(d.getTime())) {
    calYear.value = d.getFullYear();
    calMonth.value = d.getMonth() + 1;
  }
  showCalendar.value = true;
}

function calPrevMonth() {
  if (calMonth.value === 1) {
    calMonth.value = 12;
    calYear.value--;
  } else {
    calMonth.value--;
  }
}

function calNextMonth() {
  if (calMonth.value === 12) {
    calMonth.value = 1;
    calYear.value++;
  } else {
    calMonth.value++;
  }
}

interface CalCell {
  day: number | null;
  year: number;
  month: number;
  isToday: boolean;
  isSelected: boolean;
  otherMonth: boolean;
}

const calendarCells = computed((): CalCell[] => {
  const y = calYear.value;
  const m = calMonth.value;
  const firstDay = new Date(y, m - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const selectedStr = semesterStart.value;

  const cells: CalCell[] = [];

  // 上月填充
  const prevDays = new Date(y, m - 1, 0).getDate();
  for (let i = 0; i < firstDay; i++) {
    const d = prevDays - firstDay + 1 + i;
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    cells.push({ day: d, year: py, month: pm, isToday: false, isSelected: false, otherMonth: true });
  }

  // 当月
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({
      day: d,
      year: y,
      month: m,
      isToday: dateStr === todayStr,
      isSelected: dateStr === selectedStr,
      otherMonth: false
    });
  }

  // 下月填充（补满6行=42格）
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? y + 1 : y;
    cells.push({ day: i, year: ny, month: nm, isToday: false, isSelected: false, otherMonth: true });
  }

  return cells;
});

function selectCalDate(cell: CalCell) {
  if (!cell.day) return;
  const dateStr = `${cell.year}-${String(cell.month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
  scheduleStore.setSemesterStart(dateStr);
  // 如果点了其他月份的日期，跳转到那个月
  if (cell.otherMonth) {
    calYear.value = cell.year;
    calMonth.value = cell.month;
  }
  uni.showToast({ title: '开学日期已设置', icon: 'none' });
}

function calSelectToday() {
  const today = new Date();
  calYear.value = today.getFullYear();
  calMonth.value = today.getMonth() + 1;
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  scheduleStore.setSemesterStart(dateStr);
  uni.showToast({ title: '已设置为今天', icon: 'none' });
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
    uni.showToast({ title: `已跳转到第${week}周`, icon: 'none' });
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
    backgroundColor: course.color,
    // 添加阴影和边框增加质感
    boxShadow: `0 2rpx 8rpx ${course.glowColor}40`,
    border: `1rpx solid ${course.glowColor}60`
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

// 退出登录
function handleLogout() {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        // 清除数据
        scheduleStore.clearData();
        uni.showToast({ title: '已退出登录', icon: 'none' });
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
/* ========================================
   深色主题 —— 暖色大地色系
   ======================================== */
.schedule-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* ========== 顶部导航 ========== */
.header {
  background: var(--bg-header);
  padding-bottom: 12rpx;
  position: relative;
  z-index: 10;
  border-bottom: 1rpx solid var(--border);
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
  font-size: 38rpx;
  font-weight: 700;
  color: #ffffff;
}

/* 周次导航 */
.week-nav {
  display: flex;
  align-items: center;
  position: relative;
}

.nav-arrow {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 28rpx;
  background: rgba(200, 122, 60, 0.12);
}

.arrow {
  font-size: 24rpx;
  color: #C87A3C;
  font-weight: 600;
}

.week-num-btn {
  display: flex;
  align-items: center;
  background: rgba(200, 122, 60, 0.15);
  border: 1rpx solid rgba(200, 122, 60, 0.3);
  border-radius: 24rpx;
  padding: 0 28rpx;
  height: 56rpx;
  margin: 0 12rpx;
  position: relative;
}

.week-num {
  font-size: 30rpx;
  font-weight: 700;
  color: #C87A3C;
}

.week-num-arrow {
  font-size: 20rpx;
  color: var(--accent);
  margin-left: 8rpx;
}

/* 操作按钮栏 */
.week-bar {
  padding: 8rpx 28rpx;
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
  color: rgba(240, 230, 216, 0.4);
}

.week-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.action-tag {
  height: 52rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(200, 122, 60, 0.08);
  border: 1rpx solid rgba(200, 122, 60, 0.3);
  border-radius: 24rpx;
}

.action-tag-right {
  margin-left: auto;
}

.logout-tag {
  background: transparent;
  border-color: rgba(240, 230, 216, 0.15);
}

.logout-tag-text {
  font-size: 24rpx;
  color: rgba(240, 230, 216, 0.4);
  font-weight: 500;
}

.calendar-tag {
  border-color: rgba(200, 122, 60, 0.5);
  background: rgba(200, 122, 60, 0.12);
}

.action-tag-text {
  font-size: 24rpx;
  color: #C87A3C;
  font-weight: 600;
}

/* 周数弹窗遮罩 */
.week-popup-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 199;
}

/* 周数弹窗 */
.week-popup-dropdown {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: 64rpx;
  width: 240rpx;
  background: var(--bg-secondary);
  border: 1rpx solid var(--border);
  border-radius: 16rpx;
  box-shadow: var(--card-shadow);
  z-index: 200;
  overflow: hidden;
  animation: popup-slide-down 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.week-popup-title {
  font-size: 24rpx;
  color: var(--accent);
  font-weight: 600;
  padding: 16rpx 0;
  text-align: center;
  border-bottom: 1rpx solid var(--border);
}

.week-popup-list {
  max-height: 400rpx;
  width: 100%;
}

/* 自定义滚动条 */
.week-popup-list::-webkit-scrollbar {
  width: 6rpx;
}

.week-popup-list::-webkit-scrollbar-track {
  background: transparent;
}

.week-popup-list::-webkit-scrollbar-thumb {
  background: rgba(200, 122, 60, 0.3);
  border-radius: 3rpx;
}

.week-popup-list::-webkit-scrollbar-thumb:hover {
  background: rgba(200, 122, 60, 0.5);
}

.week-popup-item {
  text-align: center;
  font-size: 26rpx;
  color: rgba(240, 230, 216, 0.6);
  padding: 18rpx 0;
}

.week-popup-item.active {
  color: #C87A3C;
  font-weight: 700;
  background: rgba(200, 122, 60, 0.15);
}

/* ========== 课表头部 ========== */
.schedule-header {
  display: flex;
  background: var(--bg-secondary);
  border-bottom: 1rpx solid var(--border);
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
  left: 15%;
  right: 15%;
  height: 6rpx;
  background: #C87A3C;
  border-radius: 3rpx;
}

.header-time-text {
  font-size: 20rpx;
  color: rgba(240, 230, 216, 0.3);
}

.time-column {
  width: 120rpx;
  flex-shrink: 0;
}

.day-column {
  flex: 1;
}

.day-name {
  font-size: 24rpx;
  color: rgba(240, 230, 216, 0.55);
  font-weight: 500;
}

.day-name.today-text {
  color: #C87A3C;
  font-weight: 700;
}

.day-date {
  font-size: 18rpx;
  color: rgba(240, 230, 216, 0.3);
  margin-top: 2rpx;
}

.day-date.today-text {
  color: #C87A3C;
  position: relative;
}

.day-date.today-text::after {
  content: '';
  position: absolute;
  bottom: -8rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: #C87A3C;
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
  border-bottom: 1rpx solid var(--grid-line);
  background: var(--bg-primary);
}

.node-num {
  font-size: 22rpx;
  color: rgba(240, 230, 216, 0.5);
  font-weight: 500;
}

.node-time {
  font-size: 14rpx;
  color: rgba(240, 230, 216, 0.25);
  margin-top: 2rpx;
  white-space: nowrap;
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
  border-left: 1rpx solid var(--grid-line);
  background: var(--bg-primary);
}

.grid-column.today-column {
  background: rgba(200, 122, 60, 0.1);
}

.grid-cell {
  height: 100rpx;
  border-bottom: 1rpx solid rgba(240, 230, 216, 0.04);
}

/* ========== 课程块 ========== */
.course-block {
  position: absolute;
  border-radius: 16rpx;
  padding: 8rpx 6rpx 8rpx 12rpx;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 3rpx;
  text-align: center;
  border: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.course-block::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8rpx;
  bottom: 8rpx;
  width: 6rpx;
  border-radius: 0 3rpx 3rpx 0;
  background: rgba(255, 255, 255, 0.45);
}

.course-block:active {
  transform: scale(0.96);
  box-shadow: none !important;
}

.course-name {
  font-size: 20rpx;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.25;
  word-break: break-all;
  text-align: center;
  overflow: hidden;
  width: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  text-shadow: 0 1rpx 3rpx rgba(0, 0, 0, 0.4);
}

.course-room {
  font-size: 16rpx;
  color: rgba(255, 255, 255, 0.75);
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
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(8rpx);
  animation: overlay-fade-in 0.25s ease;
}

.detail-card {
  width: 88%;
  max-width: 680rpx;
  background: var(--bg-secondary);
  border: 1rpx solid var(--border);
  border-radius: 32rpx;
  overflow: hidden;
  box-shadow: var(--card-shadow);
  animation: detail-pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 顶部彩色横幅 */
.detail-banner {
  padding: 48rpx 44rpx 40rpx;
  position: relative;
}

.detail-banner::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40rpx;
  background: linear-gradient(to bottom, transparent, var(--bg-secondary));
}

.detail-banner-title {
  font-size: 40rpx;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.35;
  display: block;
  text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.35);
}

.detail-banner-sub {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 12rpx;
  display: block;
  font-weight: 500;
  letter-spacing: 2rpx;
}

/* 信息列表 */
.detail-body {
  padding: 12rpx 44rpx 8rpx;
}

.detail-item {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid var(--border);
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-icon-badge {
  width: 72rpx;
  height: 72rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.detail-item-icon {
  font-size: 34rpx;
}

.detail-item-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-left: 24rpx;
}

.detail-item-label {
  font-size: 22rpx;
  color: rgba(240, 230, 216, 0.4);
  letter-spacing: 1rpx;
}

.detail-item-value {
  font-size: 30rpx;
  color: rgba(240, 230, 216, 0.92);
  font-weight: 600;
  margin-top: 6rpx;
  line-height: 1.3;
}

/* 底部按钮 */
.detail-footer {
  padding: 20rpx 44rpx 44rpx;
}

.detail-close-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: var(--bg-primary);
  border: 1rpx solid var(--border);
  color: var(--accent);
  font-size: 30rpx;
  font-weight: 700;
  border-radius: 20rpx;
  letter-spacing: 8rpx;
}

.detail-close-btn::after {
  border: none;
}

/* ========== 自定义日历弹窗 ========== */
.cal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
  backdrop-filter: blur(6rpx);
}

.cal-card {
  width: 88%;
  max-width: 640rpx;
  background: var(--bg-secondary);
  border: 1rpx solid var(--border);
  border-radius: 28rpx;
  overflow: hidden;
  box-shadow: var(--card-shadow);
  padding: 32rpx 28rpx;
}

/* 月份导航 */
.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8rpx 24rpx;
}

.cal-nav-btn {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  background: rgba(200, 122, 60, 0.1);
}

.cal-nav-arrow {
  font-size: 28rpx;
  color: #C87A3C;
  font-weight: 700;
}

.cal-month-text {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 2rpx;
}

/* 星期标题 */
.cal-weekdays {
  display: flex;
  padding: 16rpx 0 12rpx;
  border-bottom: 1rpx solid rgba(200, 122, 60, 0.1);
}

.cal-weekday {
  flex: 1;
  text-align: center;
  font-size: 24rpx;
  color: rgba(200, 122, 60, 0.7);
  font-weight: 600;
}

/* 日期网格 */
.cal-grid {
  display: flex;
  flex-wrap: wrap;
  padding-top: 8rpx;
}

.cal-cell {
  width: 14.2857%;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 76rpx;
}

.cal-cell-text {
  width: 60rpx;
  height: 60rpx;
  line-height: 60rpx;
  text-align: center;
  font-size: 28rpx;
  color: #F0E6D8;
  font-weight: 500;
  border-radius: 14rpx;
}

.cal-cell-other .cal-cell-text {
  color: rgba(240, 230, 216, 0.2);
}

.cal-cell-today .cal-cell-text {
  background: rgba(200, 122, 60, 0.2);
  color: #C87A3C;
  font-weight: 700;
}

.cal-cell-selected .cal-cell-text {
  background: #C87A3C;
  color: #ffffff;
  font-weight: 700;
}

/* 同时是今天和选中 */
.cal-cell-today.cal-cell-selected .cal-cell-text {
  background: #C87A3C;
  color: #ffffff;
}

/* 底部操作 */
.cal-footer {
  display: flex;
  gap: 20rpx;
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid rgba(200, 122, 60, 0.1);
}

.cal-footer-btn {
  flex: 1;
  height: 76rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  border: 1rpx solid rgba(200, 122, 60, 0.3);
  background: rgba(200, 122, 60, 0.08);
}

.cal-footer-btn-primary {
  background: rgba(200, 122, 60, 0.2);
  border-color: rgba(200, 122, 60, 0.45);
}

.cal-footer-btn-text {
  font-size: 28rpx;
  color: var(--accent);
  font-weight: 600;
}

.cal-footer-primary-text {
  color: #C87A3C;
}

/* ========== 动画 ========== */
@keyframes overlay-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes detail-pop-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes popup-slide-down {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-16rpx);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
