<template>
  <view class="schedule-grid">
    <!-- 课表网格组件 -->
    <view class="grid-container">
      <!-- 顶部星期行 -->
      <view class="header-row">
        <view class="corner-cell"></view>
        <view
          v-for="day in 7"
          :key="day"
          class="header-cell"
          :class="{ 'is-today': isTodayColumn(day) }"
        >
          <text class="day-text">{{ dayNames[day - 1] }}</text>
        </view>
      </view>

      <!-- 课表主体区域 -->
      <view class="body-container">
        <!-- 左侧节次列 -->
        <view class="time-column">
          <view
            v-for="node in totalNodes"
            :key="node"
            class="time-cell"
            :style="{ height: nodeHeight + 'rpx' }"
          >
            <text class="node-text">{{ node }}</text>
          </view>
        </view>

        <!-- 右侧课程区域 -->
        <view class="content-area" :style="{ height: totalNodes * nodeHeight + 'rpx' }">
          <!-- 背景网格线 -->
          <view class="grid-lines">
            <view
              v-for="day in 7"
              :key="'col-' + day"
              class="grid-column"
              :style="{ left: (day - 1) * (100 / 7) + '%', width: (100 / 7) + '%' }"
            >
              <view
                v-for="node in totalNodes"
                :key="'row-' + node"
                class="grid-row"
                :style="{ height: nodeHeight + 'rpx' }"
              ></view>
            </view>
          </view>

          <!-- 课程卡片 -->
          <view
            v-for="(course, index) in courses"
            :key="index"
            class="course-card"
            :style="getCardStyle(course)"
            @click="$emit('course-click', course)"
          >
            <view class="card-content">
              <text class="course-name">{{ course.name }}</text>
              <text class="course-info">{{ course.room }}</text>
              <text class="course-info">{{ course.teacher }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RenderCourse } from '@/types';

// Props
interface Props {
  courses: RenderCourse[];
  nodeHeight?: number;
  totalNodes?: number;
}

const props = withDefaults(defineProps<Props>(), {
  nodeHeight: 60,
  totalNodes: 12
});

// Emits
defineEmits<{
  (e: 'course-click', course: RenderCourse): void;
}>();

// 星期名称
const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// 判断是否是今天
function isTodayColumn(day: number): boolean {
  const today = new Date().getDay();
  const adjustedToday = today === 0 ? 7 : today;
  return adjustedToday === day;
}

// 计算课程卡片样式
function getCardStyle(course: RenderCourse) {
  const day = parseInt(course.day);
  const dayWidth = 100 / 7;

  return {
    left: `${(day - 1) * dayWidth}%`,
    width: `${dayWidth}%`,
    top: `${(course.startNode - 1) * props.nodeHeight}rpx`,
    height: `${course.step * props.nodeHeight}rpx`,
    backgroundColor: course.color
  };
}
</script>

<style scoped>
.schedule-grid {
  width: 100%;
  overflow: hidden;
}

.grid-container {
  display: flex;
  flex-direction: column;
}

/* 头部行 */
.header-row {
  display: flex;
  background: #f8f8f8;
  border-bottom: 1rpx solid #e8e8e8;
}

.corner-cell {
  width: 60rpx;
  height: 50rpx;
  flex-shrink: 0;
}

.header-cell {
  flex: 1;
  height: 50rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-cell.is-today {
  background: rgba(74, 144, 217, 0.15);
}

.day-text {
  font-size: 24rpx;
  color: #666;
}

.header-cell.is-today .day-text {
  color: #4A90D9;
  font-weight: bold;
}

/* 主体区域 */
.body-container {
  display: flex;
  flex: 1;
}

/* 时间列 */
.time-column {
  width: 60rpx;
  flex-shrink: 0;
  background: #fafafa;
}

.time-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1rpx solid #f0f0f0;
}

.node-text {
  font-size: 20rpx;
  color: #999;
}

/* 内容区域 */
.content-area {
  flex: 1;
  position: relative;
}

/* 网格线 */
.grid-lines {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
}

.grid-column {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1rpx solid #f0f0f0;
}

.grid-row {
  border-bottom: 1rpx solid #f0f0f0;
}

/* 课程卡片 */
.course-card {
  position: absolute;
  border-radius: 8rpx;
  overflow: hidden;
  margin: 2rpx;
  box-sizing: border-box;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

.card-content {
  padding: 6rpx 8rpx;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.course-name {
  font-size: 20rpx;
  font-weight: bold;
  color: #333;
  line-height: 1.2;
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.course-info {
  font-size: 16rpx;
  color: #555;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
