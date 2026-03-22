<template>
  <view class="week-selector-container">
    <view class="week-num-btn" @click="togglePopup">
      <text class="week-num">第{{ currentWeek }}周</text>
      <text class="week-num-arrow">▼</text>
    </view>
    
    <view v-if="showPopup" class="week-popup-mask" @click="showPopup = false"></view>
    <view v-if="showPopup" class="week-popup-dropdown" @click.stop>
      <view class="week-popup-title">选择周次</view>
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
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  currentWeek: number;
  totalWeeks: number;
}>();

const emit = defineEmits<{
  (e: 'select-week', week: number): void;
}>();

const showPopup = ref(false);

const weekOptions = computed(() => {
  return Array.from({ length: props.totalWeeks }, (_, i) => `第 ${i + 1} 周`);
});

function togglePopup() {
  showPopup.value = !showPopup.value;
}

function selectWeek(week: number) {
  emit('select-week', week);
  showPopup.value = false;
}
</script>

<style scoped>
/* 极简样式 */
.week-selector-container {
  display: flex;
  position: relative;
}

.week-num-btn {
  display: flex;
  align-items: center;
  background: #F5F5F5;
  border-radius: 8rpx;
  padding: 0 24rpx;
  height: 56rpx;
  margin: 0 12rpx;
}

.week-num {
  font-size: 28rpx;
  font-weight: 600;
  color: #000000;
}

.week-num-arrow {
  font-size: 18rpx;
  color: #000000;
  margin-left: 8rpx;
}

.week-popup-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 199;
}

.week-popup-dropdown {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: 64rpx;
  width: 240rpx;
  background: #FFFFFF;
  border: 1rpx solid #EAEAEA;
  border-radius: 8rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.08);
  z-index: 200;
  overflow: hidden;
  animation: popup-slide-down 0.2s ease;
}

.week-popup-title {
  font-size: 24rpx;
  color: #888888;
  font-weight: 500;
  padding: 16rpx 0;
  text-align: center;
  border-bottom: 1rpx solid #F0F0F0;
  letter-spacing: 2rpx;
}

.week-popup-list {
  max-height: 480rpx;
  width: 100%;
}

.week-popup-list::-webkit-scrollbar {
  width: 4rpx;
}

.week-popup-list::-webkit-scrollbar-thumb {
  background: #DDDDDD;
  border-radius: 2rpx;
}

.week-popup-item {
  text-align: center;
  font-size: 26rpx;
  color: #333333;
  padding: 20rpx 0;
}

.week-popup-item.active {
  color: #FFFFFF;
  font-weight: 600;
  background: #000000;
}

@keyframes popup-slide-down {
  from { opacity: 0; transform: translateX(-50%) translateY(-10rpx); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>
