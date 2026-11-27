<template>
  <!-- 日期表头 -->
  <view class="schedule-header">
    <view class="time-column header-cell"></view>
    <view
      v-for="day in 7"
      :key="day"
      class="day-column header-cell"
    >
      <text class="day-name" :class="{ 'day-name-today': highlightToday && isToday(day) }">{{ getShortDayName(day) }}</text>
      <view v-if="showDates" class="day-date-wrap" :class="{ 'day-date-today': highlightToday && isToday(day) }">
        <text class="day-date">{{ getDateOfDay(day) }}</text>
      </view>
    </view>
  </view>

  <!-- 课表主体（可滚动） -->
  <scroll-view class="schedule-body" scroll-y enhanced :show-scrollbar="false">
    <view class="schedule-grid">
      <!-- 时间侧栏 -->
      <view class="time-column">
        <view v-for="node in 13" :key="node" class="time-cell">
          <text class="node-num">{{ node }}</text>
          <text class="node-start">{{ getNodeStart(node) }}</text>
          <text class="node-end">{{ getNodeEnd(node) }}</text>
        </view>
      </view>

      <!-- 课程区域 -->
      <view class="courses-area">
        <view class="grid-background">
          <view
            v-for="day in 7"
            :key="day"
            class="grid-column"
            :class="{ 'today-column': highlightToday && isToday(day) }"
          >
            <view v-for="node in 13" :key="node" class="grid-cell"></view>
          </view>
        </view>

        <view
          v-for="(course, index) in courses"
          :key="index"
          class="course-block"
          :style="getCourseStyle(course)"
          @click="onCourseClick(course)"
        >
          <view class="course-inner" :class="{ 'course-inner-compact': course.step <= 1 }">
            <template v-if="detailMode">
              <text class="course-name-detail" :class="{ 'course-name-single': course.step <= 1 }">{{ course.name }}</text>
              <view class="course-detail-meta">
                <text v-if="detailWeeksMap[index]" class="course-detail-weeks">{{ detailWeeksMap[index] }}</text>
                <text v-if="roomShortMap[index] && course.step > 1" class="course-detail-room">{{ roomShortMap[index] }}</text>
              </view>
            </template>
            <template v-else>
              <text class="course-name" :class="{ 'course-name-single': course.step <= 1 }">{{ course.name }}</text>
              <view v-if="roomShortMap[index]" class="course-tag">
                <text class="course-tag-text">{{ roomShortMap[index] }}</text>
              </view>
            </template>
          </view>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RenderCourse } from '@/types';
import { COURSE_THEMES } from '@/config/themes';
import { NODE_TIMES, weeksToLabel, parseLocalDate } from '@/utils/schedule';

const props = withDefaults(defineProps<{
  courses: RenderCourse[];
  highlightToday?: boolean;
  showDates?: boolean;
  detailMode?: boolean;
  semesterStart?: string;
  currentWeek?: number;
}>(), {
  highlightToday: false,
  showDates: false,
  detailMode: false,
  currentWeek: 1
});

const emit = defineEmits<{
  (e: 'course-click', course: RenderCourse): void;
}>();

const detailWeeksMap = computed(() => {
  return props.courses.map(c => {
    const wl = weeksToLabel(c.weeks);
    return wl ? `${wl}周` : '';
  });
});

const roomShortMap = computed(() => {
  return props.courses.map(c => {
    if (!c.room) return '';
    return c.room
      .replace(/[([\[\]()（）]/g, '')  // 去掉所有括号
      .replace(/[\u4e00-\u9fa5]+/g, '') // 去掉中文
      .replace(/\s+/g, '')              // 去掉空格
      .trim();
  });
});

const NODE_HEIGHT = 100;
const DAY_WIDTH = 100 / 7;

function isToday(day: number): boolean {
  const now = new Date();
  // 有开学日期时按真实日历日期判断，避免切换历史/未来周时同星期仍误高亮为“今天”
  if (props.semesterStart) {
    const start = parseLocalDate(props.semesterStart);
    if (start) {
      const target = new Date(start);
      target.setDate(start.getDate() + (props.currentWeek - 1) * 7 + (day - 1));
      return (
        target.getFullYear() === now.getFullYear() &&
        target.getMonth() === now.getMonth() &&
        target.getDate() === now.getDate()
      );
    }
  }
  const today = now.getDay();
  const adjustedToday = today === 0 ? 7 : today;
  return adjustedToday === day;
}

function getShortDayName(day: number): string {
  const names = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return names[day] || '';
}

function getDateOfDay(day: number): string {
  if (!props.semesterStart) return '';
  const start = parseLocalDate(props.semesterStart);
  if (!start) return '';
  const daysFromStart = (props.currentWeek - 1) * 7 + (day - 1);
  const targetDate = new Date(start);
  targetDate.setDate(start.getDate() + daysFromStart);
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const date = String(targetDate.getDate()).padStart(2, '0');
  return `${month}/${date}`;
}

function getNodeStart(node: number): string {
  return NODE_TIMES[node]?.start || '';
}

function getNodeEnd(node: number): string {
  return NODE_TIMES[node]?.end || '';
}

function getCourseStyle(course: RenderCourse) {
  const day = parseInt(course.day);
  const left = (day - 1) * DAY_WIDTH;
  const top = (course.startNode - 1) * NODE_HEIGHT;
  const height = course.step * NODE_HEIGHT;
  const theme = COURSE_THEMES[course.themeIndex] || COURSE_THEMES[0];

  return {
    left: `${left}%`,
    top: `${top}rpx`,
    width: `${DAY_WIDTH}%`,
    height: `${height}rpx`,
    backgroundColor: theme.bg,
    borderColor: theme.border,
    color: theme.text
  };
}

function onCourseClick(course: RenderCourse) {
  emit('course-click', course);
}
</script>

<style scoped>
/* 日期表头 */
.schedule-header {
  display: flex;
  background: #FFFFFF;
  border-bottom: 1rpx solid #F0F0F0;
  padding: 12rpx 0 16rpx;
}

.header-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.time-column {
  width: 100rpx;
  flex-shrink: 0;
}

.day-column {
  flex: 1;
}

.day-name {
  font-size: 22rpx;
  color: #999999;
  font-weight: 600;
}

.day-name-today {
  color: #000000;
  font-weight: 700;
}

.day-date-wrap {
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
  background: transparent;
}

.day-date-today {
  background: #000000;
}

.day-date {
  font-size: 20rpx;
  color: #666666;
  font-weight: 700;
  letter-spacing: -1rpx;
}

.day-date-today .day-date {
  color: #FFFFFF;
}

/* 课表主体（可滚动） */
.schedule-body {
  flex: 1;
  height: 0;
}

.schedule-grid {
  display: flex;
  position: relative;
  padding-bottom: 200rpx;
}

/* 时间侧栏 */
.time-column .time-cell {
  height: 100rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-bottom: 1rpx solid #F5F5F5;
  border-right: 1rpx solid #F0F0F0;
  background: rgba(245, 245, 245, 0.3);
}

.node-num {
  font-size: 24rpx;
  color: #1a1a1a;
  font-weight: 800;
  margin-bottom: 2rpx;
}

.node-start {
  font-size: 18rpx;
  color: #666666;
  font-weight: 600;
  font-family: monospace;
  letter-spacing: -1rpx;
  line-height: 1;
  margin-bottom: 2rpx;
}

.node-end {
  font-size: 16rpx;
  color: #AAAAAA;
  font-weight: 500;
  font-family: monospace;
  letter-spacing: -1rpx;
  line-height: 1;
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
  border-left: 1rpx solid #F5F5F5;
  background: #FFFFFF;
}

.grid-column.today-column {
  background: #FAFAFA;
}

.grid-cell {
  height: 100rpx;
  border-bottom: 1rpx solid #F8F8F8;
}

/* 课程卡片 */
.course-block {
  position: absolute;
  padding: 2rpx;
  box-sizing: border-box;
}

.course-inner {
  width: 100%;
  height: 100%;
  border-radius: 20rpx;
  border: 2rpx solid;
  border-color: inherit;
  background-color: inherit;
  color: inherit;
  padding: 12rpx 8rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
}

.course-name {
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.3;
  word-break: break-all;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.course-tag {
  margin-top: 8rpx;
}

.course-tag-text {
  font-size: 18rpx;
  font-weight: 700;
  font-family: monospace;
  letter-spacing: -1rpx;
  opacity: 0.7;
  word-break: break-all;
  line-height: 1.2;
}

.course-inner-compact {
  padding: 6rpx 6rpx;
}

.course-name-single {
  -webkit-line-clamp: 2 !important;
  font-size: 18rpx !important;
  line-height: 1.2 !important;
}

/* 历史课表详细模式：固定标题不收缩，防止中文被腰斩 */
.course-name-detail {
  flex-shrink: 0;
  font-size: 20rpx;
  font-weight: 800;
  line-height: 1.28;
  word-break: break-all;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.course-detail-meta {
  display: flex;
  flex-direction: column;
  gap: 2rpx;
  margin-top: 6rpx;
  flex-shrink: 0;
}

.course-detail-weeks {
  font-size: 16rpx;
  font-weight: 800;
  font-family: monospace;
  letter-spacing: -0.5rpx;
  line-height: 1.15;
  opacity: 0.78;
}

.course-detail-room {
  font-size: 16rpx;
  font-weight: 700;
  font-family: monospace;
  letter-spacing: -0.5rpx;
  line-height: 1.15;
  opacity: 0.65;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
