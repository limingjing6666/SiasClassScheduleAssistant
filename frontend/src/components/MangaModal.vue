<template>
  <view v-if="visible" class="manga-overlay" @click="onCancel">
    <view class="manga-backdrop"></view>
    <view class="manga-dialog" @click.stop>
      <!-- 顶部标签 -->
      <view class="manga-tag" :class="tagClass">
        <text class="manga-tag-text">{{ tag }}</text>
      </view>

      <!-- 内容区 -->
      <view class="manga-body">
        <!-- 图标 -->
        <view v-if="icon" class="manga-icon-wrap">
          <view class="manga-icon-circle" :class="iconBgClass">
            <image class="manga-icon-svg" :src="icon" mode="aspectFit" />
          </view>
        </view>

        <text class="manga-title">{{ title }}</text>
        <text v-if="content" class="manga-content">{{ content }}</text>

        <!-- 自定义内容插槽 -->
        <slot></slot>
      </view>

      <!-- 按钮区 -->
      <view class="manga-btns">
        <button v-if="showCancel" class="manga-btn manga-btn-cancel" @click="onCancel">
          <text class="manga-btn-text">{{ cancelText }}</text>
        </button>
        <button class="manga-btn manga-btn-confirm" :class="confirmBtnClass" @click="onConfirm">
          <text class="manga-btn-text-confirm">{{ confirmText }}</text>
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean;
  tag?: string;
  tagClass?: string;
  title: string;
  content?: string;
  icon?: string;
  iconBgClass?: string;
  showCancel?: boolean;
  cancelText?: string;
  confirmText?: string;
  confirmBtnClass?: string;
}>();

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

function onConfirm() {
  emit('confirm');
}

function onCancel() {
  emit('cancel');
}
</script>

<style scoped>
.manga-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
  animation: manga-fade 0.2s ease;
}

.manga-backdrop {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4rpx);
  -webkit-backdrop-filter: blur(4rpx);
}

.manga-dialog {
  position: relative;
  width: 100%;
  max-width: 600rpx;
  background: #FFFFFF;
  border: 6rpx solid #000000;
  border-radius: 40rpx;
  box-shadow: 12rpx 12rpx 0 #000000;
  padding: 56rpx 40rpx 40rpx;
  box-sizing: border-box;
  animation: manga-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

/* 标签 */
.manga-tag {
  position: absolute;
  top: -28rpx;
  left: 36rpx;
  padding: 8rpx 20rpx;
  border: 4rpx solid #000000;
  box-shadow: 3rpx 3rpx 0 #000000;
  transform: rotate(-3deg);
  z-index: 1;
}

.manga-tag-text {
  font-size: 20rpx;
  font-weight: 900;
  letter-spacing: 4rpx;
  text-transform: uppercase;
}

.tag-red {
  background: #FF7675;
  color: #FFFFFF;
}

.tag-yellow {
  background: #FFEAA7;
  color: #000000;
}

.tag-blue {
  background: #74B9FF;
  color: #000000;
}

/* 内容 */
.manga-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 40rpx;
}

.manga-icon-wrap {
  margin-bottom: 20rpx;
}

.manga-icon-circle {
  width: 100rpx;
  height: 100rpx;
  border: 6rpx solid #000000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 6rpx 6rpx 0 #000000;
}

.manga-icon-svg {
  width: 44rpx;
  height: 44rpx;
}

.icon-bg-gray { background: #F3F4F6; }
.icon-bg-blue { background: #74B9FF; }
.icon-bg-red { background: #FF7675; }
.icon-bg-yellow { background: #FFEAA7; }

.manga-title {
  font-size: 40rpx;
  font-weight: 900;
  color: #000000;
  margin-bottom: 12rpx;
}

.manga-content {
  font-size: 26rpx;
  font-weight: 600;
  color: #999999;
  line-height: 1.6;
}

/* 按钮 */
.manga-btns {
  display: flex;
  gap: 20rpx;
}

.manga-btn {
  flex: 1;
  height: 88rpx;
  border: 6rpx solid #000000;
  border-radius: 20rpx;
  box-shadow: 4rpx 4rpx 0 #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.manga-btn::after {
  border: none;
}

.manga-btn:active {
  transform: translate(3rpx, 3rpx);
  box-shadow: 1rpx 1rpx 0 #000000;
}

.manga-btn-cancel {
  background: #FFFFFF;
}

.manga-btn-text {
  font-size: 28rpx;
  font-weight: 900;
  color: #000000;
}

.manga-btn-confirm {
  background: #000000;
}

.btn-red { background: #FF7675; }
.btn-blue { background: #74B9FF; }
.btn-yellow { background: #FFEAA7; }

.manga-btn-text-confirm {
  font-size: 28rpx;
  font-weight: 900;
  color: #FFFFFF;
}

.btn-yellow .manga-btn-text-confirm {
  color: #000000;
}

/* 动画 */
@keyframes manga-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes manga-pop {
  0% { opacity: 0; transform: scale(0.8) translateY(30rpx); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
