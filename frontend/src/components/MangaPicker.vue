<template>
  <view v-if="visible" class="picker-overlay" @click="onClose">
    <view class="picker-backdrop"></view>
    <view class="picker-sheet" @click.stop>
      <view class="sheet-handle"></view>

      <view class="sheet-header">
        <view class="sheet-tag">
          <text class="sheet-tag-text">{{ title }}</text>
        </view>
        <view class="close-btn" @click="onClose">
          <text class="close-text">✕</text>
        </view>
      </view>

      <scroll-view class="option-list" scroll-y :show-scrollbar="false">
        <view class="option-list-inner">
          <view
            v-for="(item, idx) in options"
            :key="item.id ?? idx"
            class="option-item"
            :class="{ 'option-item-active': idx === selectedIndex }"
            @click="onSelect(idx)"
          >
            <view class="option-left">
              <text class="option-label">{{ item.label }}</text>
              <text v-if="item.badge" class="option-badge" :class="item.badgeClass">{{ item.badge }}</text>
            </view>
            <view v-if="idx === selectedIndex" class="check-dot">
              <text class="check-mark">✓</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
export interface PickerOptionItem {
  id?: string | number;
  label: string;
  badge?: string;
  badgeClass?: string;
}

defineProps<{
  visible: boolean;
  title: string;
  options: PickerOptionItem[];
  selectedIndex: number;
}>();

const emit = defineEmits<{
  (e: 'select', index: number): void;
  (e: 'close'): void;
}>();

function onSelect(index: number) {
  emit('select', index);
  emit('close');
}

function onClose() {
  emit('close');
}
</script>

<style scoped>
.picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2100;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.picker-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.48);
  backdrop-filter: blur(4rpx);
  -webkit-backdrop-filter: blur(4rpx);
}

.picker-sheet {
  position: relative;
  z-index: 1;
  background: #FFFFFF;
  border-top: 6rpx solid #000000;
  border-radius: 40rpx 40rpx 0 0;
  padding: 20rpx 36rpx 48rpx;
  box-sizing: border-box;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.sheet-handle {
  width: 76rpx;
  height: 10rpx;
  border-radius: 6rpx;
  background: #D4D4D8;
  align-self: center;
  margin-bottom: 24rpx;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.sheet-tag {
  padding: 8rpx 22rpx;
  background: #FFEAA7;
  border: 4rpx solid #000000;
  box-shadow: 4rpx 4rpx 0 #000000;
  transform: rotate(-1.5deg);
}

.sheet-tag-text {
  font-size: 26rpx;
  font-weight: 900;
  color: #000000;
  letter-spacing: 2rpx;
}

.close-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #F4F4F5;
  border: 3rpx solid #000000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:active {
  background: #E4E4E7;
}

.close-text {
  font-size: 24rpx;
  font-weight: 900;
  color: #000000;
  line-height: 1;
}

.option-list {
  flex: 1;
  min-height: 0;
  max-height: 52vh;
}

.option-list-inner {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 4rpx 8rpx 16rpx 2rpx;
}

.option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 28rpx;
  background: #FFFFFF;
  border: 3rpx solid #E4E4E7;
  border-radius: 20rpx;
  transition: transform 0.1s ease;
}

.option-item:active {
  transform: translate(2rpx, 2rpx);
}

.option-item-active {
  background: #FFEAA7;
  border-color: #000000;
  box-shadow: 4rpx 4rpx 0 #000000;
}

.option-left {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.option-label {
  font-size: 28rpx;
  font-weight: 900;
  color: #000000;
  letter-spacing: 1rpx;
}

.option-badge {
  font-size: 20rpx;
  font-weight: 900;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  border: 2rpx solid #000000;
  background: #FFFFFF;
  color: #000000;
}

.option-badge.badge-today {
  background: #55EFC4;
}

.option-badge.badge-muted {
  background: #F4F4F5;
  color: #71717A;
  border-color: #D4D4D8;
}

.check-dot {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.check-mark {
  font-size: 24rpx;
  font-weight: 900;
  color: #FFFFFF;
  line-height: 1;
}
</style>
