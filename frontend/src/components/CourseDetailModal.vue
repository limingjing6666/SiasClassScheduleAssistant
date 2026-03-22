<template>
  <view class="detail-overlay" @click="close">
    <view class="detail-card" @click.stop>
      
      <view class="detail-banner" :style="{ backgroundColor: course.color || '#F0F0F0' }">
        <text class="detail-banner-title">{{ course.name }}</text>
        <text class="detail-banner-sub">{{ getDayName(parseInt(course.day || '1')) }} · 第{{ course.nodes }}节</text>
      </view>
      
      <view class="detail-body">
        <view class="detail-item">
          <text class="detail-item-label">授课教师</text>
          <text class="detail-item-value">{{ course.teacher || '未知' }}</text>
        </view>
        <view class="detail-item">
          <text class="detail-item-label">上课教室</text>
          <text class="detail-item-value">{{ course.room || '未知' }}</text>
        </view>
        <view class="detail-item">
          <text class="detail-item-label">具体时段</text>
          <text class="detail-item-value">{{ getDetailTimeRange() }}</text>
        </view>
      </view>
      
      <view class="detail-footer">
        <button class="detail-close-btn" @click="close">关 闭</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { RenderCourse } from '@/types';
import { getDayName, getNodeTimeRange } from '@/utils/schedule';

const props = defineProps<{
  course: RenderCourse;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

function close() {
  emit('close');
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
/* 极简模态框样式 */
.detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fade-in 0.2s ease;
}

.detail-card {
  width: 85%;
  max-width: 600rpx;
  background: #FFFFFF;
  border-radius: 12rpx;
  overflow: hidden;
  box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.1);
  animation: slide-up 0.2s ease;
}

.detail-banner {
  padding: 48rpx 40rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.05);
}

.detail-banner-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #000000;
  line-height: 1.3;
  display: block;
}

.detail-banner-sub {
  font-size: 26rpx;
  color: rgba(0, 0, 0, 0.6);
  margin-top: 12rpx;
  display: block;
}

.detail-body {
  padding: 24rpx 40rpx;
}

.detail-item {
  padding: 24rpx 0;
  border-bottom: 1rpx solid #F0F0F0;
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-item-label {
  font-size: 22rpx;
  color: #888888;
  margin-bottom: 8rpx;
  display: block;
  text-transform: uppercase;
  letter-spacing: 1rpx;
}

.detail-item-value {
  font-size: 32rpx;
  color: #000000;
  font-weight: 500;
  display: block;
}

.detail-footer {
  padding: 32rpx 40rpx 48rpx;
}

.detail-close-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  background: #000000;
  color: #FFFFFF;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 8rpx;
  text-align: center;
}

.detail-close-btn::after {
  border: none;
}

.detail-close-btn:active {
  opacity: 0.8;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(20rpx); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
