<template>
  <view class="schedule-header">
    <view class="time-column header-cell">
      <text class="header-time-text"></text>
    </view>
    <view
      v-for="day in 7"
      :key="day"
      class="day-column header-cell"
      :class="{ 'today-header': highlightToday && isToday(day) }"
    >
      <text class="day-name" :class="{ 'today-text': highlightToday && isToday(day) }">{{ getDayName(day) }}</text>
      <text v-if="showDates" class="day-date" :class="{ 'today-text': highlightToday && isToday(day) }">{{ getDateOfDay(day) }}</text>
    </view>
  </view>

  <scroll-view class="schedule-body" scroll-y :show-scrollbar="false">
    <view class="schedule-grid">
      <!-- 时间列 -->
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
        <view class="grid-background">
          <view
            v-for="day in 7"
            :key="day"
            class="grid-column"
            :class="{ 'today-column': highlightToday && isToday(day) }"
          >
            <view
              v-for="node in 13"
              :key="node"
              class="grid-cell"
            ></view>
          </view>
        </view>

        <view
          v-for="(course, index) in courses"
          :key="index"
          class="course-block"
          :style="getCourseStyle(course)"
          @click="onCourseClick(course)"
        >
          <text class="course-name">{{ course.name }}</text>
          <text class="course-room">{{ course.room }}</text>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<script setup lang="ts">
import type { RenderCourse } from '@/types';
import { getDayName, getNodeTimeRange } from '@/utils/schedule';

const props = withDefaults(defineProps<{
  courses: RenderCourse[];
  highlightToday?: boolean;
  showDates?: boolean;
  semesterStart?: string;
  currentWeek?: number;
}>(), {
  highlightToday: false,
  showDates: false,
  currentWeek: 1
});

const emit = defineEmits<{
  (e: 'course-click', course: RenderCourse): void;
}>();

const NODE_HEIGHT = 100;
const DAY_WIDTH = 100 / 7;

function isToday(day: number): boolean {
  const today = new Date().getDay();
  const adjustedToday = today === 0 ? 7 : today;
  return adjustedToday === day;
}

function getDateOfDay(day: number): string {
  if (!props.semesterStart) return '';
  const start = new Date(props.semesterStart);
  const daysFromStart = (props.currentWeek - 1) * 7 + (day - 1);
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

function onCourseClick(course: RenderCourse) {
  emit('course-click', course);
}
</script>

<style scoped>
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
