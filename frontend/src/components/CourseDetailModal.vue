<template>
  <view class="modal-overlay" @click="close">
    <!-- 半透明模糊背景 -->
    <view class="modal-backdrop"></view>

    <!-- 底部弹出面板 (漫画风) -->
    <view class="modal-sheet" @click.stop>
      <!-- 顶部把手 -->
      <view class="sheet-handle"></view>

      <!-- 时间标签 (漫画倾斜贴纸) -->
      <view class="time-sticker">
        <text class="time-sticker-text">{{ getDayName(parseInt(course.day || '1')) }} · {{ getStartTime() }}</text>
      </view>

      <!-- 课程标题 -->
      <text class="sheet-title">{{ course.name }}</text>

      <!-- 详情列表 -->
      <view class="sheet-details">
        <!-- 上课时间 -->
        <view class="info-row">
          <view class="info-icon icon-blue">
            <image class="info-icon-svg" src="/static/icons/clock.svg" mode="aspectFit" />
          </view>
          <view class="info-body">
            <text class="info-label">上课时间</text>
            <text class="info-value">第 {{ course.nodes }} 节  {{ getDetailTimeRange() }}</text>
          </view>
        </view>

        <!-- 上课地点 -->
        <view class="info-row">
          <view class="info-icon icon-yellow">
            <image class="info-icon-svg" src="/static/icons/mappin.svg" mode="aspectFit" />
          </view>
          <view class="info-body">
            <text class="info-label">上课地点</text>
            <text class="info-value">{{ course.room || '未知' }}</text>
          </view>
        </view>

        <!-- 授课教师 -->
        <view class="info-row">
          <view class="info-icon icon-red">
            <image class="info-icon-svg" src="/static/icons/user.svg" mode="aspectFit" />
          </view>
          <view class="info-body">
            <text class="info-label">授课教师</text>
            <text class="info-value">{{ course.teacher || '未知' }}</text>
          </view>
        </view>
      </view>

      <!-- 确认按钮 (漫画风) -->
      <button class="confirm-btn" @click="close">
        <text class="confirm-text">确 认</text>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { RenderCourse } from '@/types';
import { getDayName, getNodeTimeRange, NODE_TIMES } from '@/utils/schedule';

const props = defineProps<{
  course: RenderCourse;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

function close() {
  emit('close');
}

function getStartTime(): string {
  const nodes = props.course.nodes.split('-');
  const startNode = parseInt(nodes[0]);
  return NODE_TIMES[startNode]?.start || '';
}

function getDetailTimeRange(): string {
  if (!props.course) return '';
  const nodes = props.course.nodes.split('-');
  const startNode = parseInt(nodes[0]);
  const endNode = parseInt(nodes[nodes.length - 1]);
  return getNodeTimeRange(startNode, endNode);
}
</script>

<style scoped>
/* ===== Overlay ===== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  z-index: 1000;
  animation: fade-in 0.3s ease;
}

.modal-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4rpx);
  -webkit-backdrop-filter: blur(4rpx);
}

/* ===== Bottom Sheet ===== */
.modal-sheet {
  position: relative;
  width: 100%;
  background: #FFFFFF;
  border-top: 4rpx solid #000000;
  border-radius: 48rpx 48rpx 0 0;
  padding: 32rpx 40rpx calc(48rpx + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  z-index: 1;
  animation: slide-up-comic 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.2) forwards;
}

.sheet-handle {
  width: 80rpx;
  height: 10rpx;
  background: #0A0A0A;
  border-radius: 10rpx;
  margin: 0 auto 40rpx;
  opacity: 0.8;
}

/* ===== Time sticker ===== */
.time-sticker {
  display: inline-block;
  background: #FFEAA7;
  border: 4rpx solid #000000;
  padding: 10rpx 24rpx;
  box-shadow: 4rpx 4rpx 0 #000000;
  transform: rotate(-2deg);
  margin-bottom: 20rpx;
}

.time-sticker-text {
  font-size: 24rpx;
  font-weight: 900;
  color: #000000;
}

/* ===== Title ===== */
.sheet-title {
  display: block;
  font-size: 48rpx;
  font-weight: 900;
  color: #000000;
  line-height: 1.2;
  letter-spacing: -2rpx;
  margin-bottom: 48rpx;
}

/* ===== Detail rows ===== */
.sheet-details {
  display: flex;
  flex-direction: column;
  gap: 36rpx;
  margin-bottom: 48rpx;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.info-icon {
  width: 80rpx;
  height: 80rpx;
  border: 4rpx solid #000000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 4rpx 4rpx 0 #000000;
}

.info-icon-svg {
  width: 36rpx;
  height: 36rpx;
}

.icon-blue { background: #74B9FF; }
.icon-yellow { background: #FFEAA7; }
.icon-red { background: #FF7675; }

.info-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.info-label {
  font-size: 18rpx;
  font-weight: 700;
  color: #999999;
  letter-spacing: 3rpx;
  margin-bottom: 4rpx;
}

.info-value {
  font-size: 28rpx;
  font-weight: 900;
  color: #0A0A0A;
  line-height: 1.4;
}

/* ===== Confirm button ===== */
.confirm-btn {
  width: 100%;
  height: 96rpx;
  background: #FF9F43;
  border: 4rpx solid #000000;
  border-radius: 24rpx;
  box-shadow: 4rpx 4rpx 0 #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.confirm-btn::after {
  border: none;
}

.confirm-btn:active {
  transform: translate(4rpx, 4rpx);
  box-shadow: 2rpx 2rpx 0 #000000;
}

.confirm-text {
  font-size: 32rpx;
  font-weight: 900;
  color: #FFFFFF;
  letter-spacing: 8rpx;
}

/* ===== Animations ===== */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up-comic {
  0% { transform: translateY(100%); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
