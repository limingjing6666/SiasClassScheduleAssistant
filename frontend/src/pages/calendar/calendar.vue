<template>
  <view class="page">
    <view class="page-header">
      <view class="status-bar"></view>
      <view class="header-row">
        <text class="back-btn" @click="goBack">&#8249;</text>
        <text class="page-title">校历</text>
      </view>
    </view>

    <!-- 学期选择器 -->
    <view class="filter-bar">
      <view class="filter-item">
        <text class="filter-label">学期</text>
        <picker @change="onSemesterChange" :value="semesterIndex" :range="semesterList" range-key="label">
          <view class="filter-picker">
            <text class="filter-value">{{ currentSemesterLabel || '选择学期' }}</text>
            <text class="filter-arrow">&#9660;</text>
          </view>
        </picker>
      </view>
    </view>

    <!-- 加载态 -->
    <view v-if="loading" class="loading-container">
      <view class="loading-spinner"></view>
      <text class="loading-text">正在加载校历...</text>
    </view>

    <!-- 校历内容 -->
    <scroll-view v-else-if="calendarData" class="content" scroll-y :show-scrollbar="false">
      <!-- 学期信息卡片 -->
      <view class="info-card">
        <view class="info-row">
          <text class="info-label">学年学期</text>
          <text class="info-value">{{ calendarData.semester }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">起止日期</text>
          <text class="info-value">{{ calendarData.startDate }} ~ {{ calendarData.endDate }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">教学周数</text>
          <text class="info-value">{{ calendarData.totalWeeks }} 周</text>
        </view>
      </view>

      <!-- 图例 -->
      <view class="legend">
        <view class="legend-item">
          <view class="legend-dot legend-dot-today"></view>
          <text class="legend-text">今日</text>
        </view>
        <view class="legend-item">
          <view class="legend-dot legend-dot-holiday"></view>
          <text class="legend-text">节假日</text>
        </view>
        <view class="legend-item">
          <view class="legend-dot legend-dot-weekend"></view>
          <text class="legend-text">周末</text>
        </view>
      </view>

      <!-- 校历表格 -->
      <view class="calendar-table">
        <!-- 表头 -->
        <view class="cal-row cal-header">
          <view class="cal-cell cal-cell-month">月</view>
          <view class="cal-cell">一</view>
          <view class="cal-cell">二</view>
          <view class="cal-cell">三</view>
          <view class="cal-cell">四</view>
          <view class="cal-cell">五</view>
          <view class="cal-cell">六</view>
          <view class="cal-cell">日</view>
          <view class="cal-cell cal-cell-week">周</view>
        </view>

        <!-- 数据行 -->
        <view v-for="(week, idx) in calendarData.weeks" :key="idx" class="cal-row">
          <!-- 月份列 -->
          <view class="cal-cell cal-cell-month">
            <text v-if="isFirstRowOfMonth(idx)" class="month-text">{{ week.monthLabel }}</text>
          </view>

          <!-- 7天 -->
          <view
            v-for="(day, dIdx) in week.days"
            :key="dIdx"
            :class="['cal-cell', {
              'cal-cell-today': day && day.isToday,
              'cal-cell-holiday': day && day.isHoliday,
              'cal-cell-weekend': day && day.isWeekend && !day.isToday && !day.isHoliday
            }]"
          >
            <text v-if="day" :class="['day-text', {
              'day-text-today': day.isToday,
              'day-text-weekend': day.isWeekend && !day.isToday
            }]">{{ day.dayOfMonth }}</text>
          </view>

          <!-- 周次列 -->
          <view class="cal-cell cal-cell-week">
            <text v-if="week.weekLabel" class="week-text">{{ week.weekLabel }}</text>
          </view>
        </view>
      </view>

      <view class="bottom-spacer"></view>
    </scroll-view>

    <!-- 空状态 -->
    <view v-else class="empty-state">
      <text class="empty-text-large">—</text>
      <text class="empty-text">{{ errorMsg || '暂无校历数据' }}</text>
      <view class="retry-btn" @click="retryLoad" v-if="errorMsg">
        <text class="retry-text">重试</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { SchoolCalendarData } from '@/types/calendar';
import { fetchSchoolCalendar, getCachedCalendar, cacheCalendar } from '@/utils/calendar';
import { getCrawler } from '@/utils/session';
import { readPassword } from '@/utils/crypto';

interface Semester {
  id: number;
  schoolYear: string;
  name: string;
}

const loading = ref(false);
const calendarData = ref<SchoolCalendarData | null>(null);
const errorMsg = ref('');
const semesters = ref<Semester[]>([]);
const semesterIndex = ref(0);

const semesterList = computed(() => semesters.value.map(s => ({
  id: s.id,
  label: `${s.schoolYear} 学期${s.name}`
})));

const currentSemesterLabel = computed(() => {
  if (semesterList.value.length === 0) return '';
  return semesterList.value[semesterIndex.value]?.label || '';
});

function goBack() {
  uni.navigateBack();
}

function getUserInfo(): { username: string; password: string } | null {
  const cachedUser = uni.getStorageSync('userInfo');
  if (!cachedUser) return null;
  const { username, password: storedPwd } = JSON.parse(cachedUser);
  const password = readPassword(storedPwd, username);
  if (!username || !password) return null;
  return { username, password };
}

function isFirstRowOfMonth(idx: number): boolean {
  if (!calendarData.value) return false;
  const weeks = calendarData.value.weeks;
  if (idx === 0) return !!weeks[0].monthLabel;
  return weeks[idx].monthLabel !== '' && weeks[idx].monthLabel !== weeks[idx - 1].monthLabel;
}

onMounted(async () => {
  await loadSemesters();
});

async function loadSemesters() {
  try {
    const cachedSemesters = uni.getStorageSync('history_semesters');
    if (cachedSemesters && cachedSemesters.semesters) {
      semesters.value = cachedSemesters.semesters.map((s: { id: number; schoolYear: string; name: string }) => ({
        id: s.id, schoolYear: s.schoolYear, name: s.name
      })).reverse();
    } else {
      const user = getUserInfo();
      if (!user) return;
      const crawler = await getCrawler(user.username, user.password);
      await crawler.fetchSemesters();
      const rawSemesters = crawler.getSemesters();
      semesters.value = rawSemesters.map(s => ({ id: s.id, schoolYear: s.schoolYear, name: s.name })).reverse();
      uni.setStorageSync('history_semesters', { semesters: rawSemesters, lastFetchTime: Date.now() });
    }
    if (semesters.value.length > 0) {
      semesterIndex.value = 0;
      await loadCalendar(semesters.value[0].id);
    }
  } catch (e: unknown) {
    console.error('[Calendar] Load semesters failed:', e);
    errorMsg.value = '加载学期列表失败';
  }
}

async function onSemesterChange(e: { detail: { value: number } }) {
  const index = e.detail.value;
  semesterIndex.value = index;
  const semester = semesterList.value[index];
  if (semester) {
    await loadCalendar(semester.id);
  }
}

async function loadCalendar(semesterId: number) {
  loading.value = true;
  errorMsg.value = '';
  calendarData.value = null;

  // 优先展示缓存（离线或网络慢时用户不必等待）
  const cached = getCachedCalendar();
  if (cached && cached.startDate) {
    calendarData.value = cached;
    loading.value = false;
  }

  try {
    const user = getUserInfo();
    if (!user) {
      if (!calendarData.value) errorMsg.value = '请先登录';
      loading.value = false;
      return;
    }

    const data = await fetchSchoolCalendar(user.username, user.password, semesterId);
    calendarData.value = data;

    if (data.startDate) {
      cacheCalendar(data);
    }
  } catch (e: unknown) {
    console.error('[Calendar] Load failed:', e);
    if (!calendarData.value) {
      errorMsg.value = e instanceof Error ? e.message : '获取校历失败';
    }
  } finally {
    loading.value = false;
  }
}

function retryLoad() {
  const semester = semesterList.value[semesterIndex.value];
  if (semester) {
    loadCalendar(semester.id);
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #F4F4F5;
  background-image: radial-gradient(#D4D4D8 1.5px, transparent 1.5px);
  background-size: 20px 20px;
  display: flex;
  flex-direction: column;
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

/* 筛选栏 */
.filter-bar {
  padding: 20rpx 24rpx;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.filter-label {
  font-size: 22rpx;
  font-weight: 900;
  color: #999999;
  letter-spacing: 2rpx;
  padding-left: 4rpx;
}

.filter-picker {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  background: #000000;
  padding: 14rpx 28rpx;
  border-radius: 14rpx;
  border: 3rpx solid #000000;
  box-shadow: 3rpx 3rpx 0 #000000;
}

.filter-value {
  font-size: 24rpx;
  color: #FFFFFF;
  font-weight: 900;
  letter-spacing: 1rpx;
}

.filter-arrow {
  font-size: 18rpx;
  color: #FFFFFF;
}

/* 加载态 */
.loading-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
}

.loading-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 5rpx solid #F0F0F0;
  border-top-color: #55EFC4;
  border-right-color: #55EFC4;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 26rpx;
  color: #999999;
  font-weight: 700;
}

/* 内容区 */
.content {
  flex: 1;
  height: 0;
}

/* 信息卡片 */
.info-card {
  margin: 0 24rpx;
  background: #FFFFFF;
  border: 3rpx solid #000000;
  border-radius: 20rpx;
  box-shadow: 4rpx 4rpx 0 #000000;
  padding: 24rpx 28rpx;
  margin-right: 30rpx;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.info-label {
  font-size: 24rpx;
  color: #999999;
  font-weight: 700;
}

.info-value {
  font-size: 26rpx;
  color: #000000;
  font-weight: 900;
}

/* 图例 */
.legend {
  display: flex;
  gap: 28rpx;
  padding: 16rpx 28rpx;
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.legend-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 4rpx;
  border: 2rpx solid #000000;
}

.legend-dot-today {
  background: #FFD460;
}

.legend-dot-holiday {
  background: #FEF1C5;
}

.legend-dot-weekend {
  background: #FFE5E5;
}

.legend-text {
  font-size: 22rpx;
  color: #000000;
  font-weight: 700;
}

/* 校历表格 */
.calendar-table {
  margin: 0 16rpx 24rpx;
  border: 2rpx solid #000000;
  border-radius: 12rpx;
  overflow: hidden;
  margin-right: 22rpx;
}

.cal-row {
  display: flex;
  border-bottom: 2rpx solid #000000;
}

.cal-row:last-child {
  border-bottom: none;
}

.cal-header {
  background: #F3F4F6;
  border-bottom: 3rpx solid #000000;
}

.cal-header .cal-cell {
  font-size: 20rpx;
  font-weight: 900;
  color: #000000;
}

.cal-cell {
  flex: 1;
  min-height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #000000;
  border-right: 1rpx solid #E5E7EB;
}

.cal-cell:last-child {
  border-right: none;
}

.cal-cell-month {
  flex: 0 0 68rpx;
  font-size: 18rpx;
  color: #000000;
  font-weight: 900;
  background: #F9FAFB;
  border-right: 2rpx solid #000000;
}

.cal-cell-week {
  flex: 0 0 84rpx;
  font-size: 18rpx;
  color: #444398;
  font-weight: 900;
  background: #F9FAFB;
  border-left: 2rpx solid #000000;
}

.cal-cell-today {
  background: #FFD460;
}

.cal-cell-holiday {
  background: #FEF1C5;
}

.cal-cell-weekend {
  background: #FFF5F5;
}

.day-text {
  font-size: 22rpx;
  font-weight: 700;
  color: #000000;
}

.day-text-today {
  font-weight: 900;
  color: #000000;
}

.day-text-weekend {
  color: #EE4444;
  font-weight: 900;
}

.month-text {
  font-size: 18rpx;
  color: #000000;
  font-weight: 900;
}

.week-text {
  font-size: 18rpx;
  color: #444398;
  font-weight: 900;
}

.bottom-spacer {
  height: 60rpx;
}

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
}

.empty-text-large {
  font-size: 56rpx;
  color: #CCCCCC;
  font-weight: 900;
}

.empty-text {
  font-size: 28rpx;
  color: #999999;
  font-weight: 700;
}

.retry-btn {
  margin-top: 24rpx;
  padding: 16rpx 48rpx;
  background: #000000;
  border: 3rpx solid #000000;
  border-radius: 14rpx;
  box-shadow: 3rpx 3rpx 0 #000000;
}

.retry-btn:active {
  transform: translate(2rpx, 2rpx);
  box-shadow: 1rpx 1rpx 0 #000000;
}

.retry-text {
  font-size: 28rpx;
  color: #FFFFFF;
  font-weight: 900;
}
</style>
