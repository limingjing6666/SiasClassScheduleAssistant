<template>
  <view v-if="show" class="toast-wrap">
    <view class="toast-pill">
      <view class="toast-check">
        <view class="check-mark"></view>
      </view>
      <text class="toast-text">{{ message }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  visible: boolean;
  message?: string;
  duration?: number;
}>();

const emit = defineEmits<{
  (e: 'hide'): void;
}>();

const show = ref(false);

watch(() => props.visible, (val) => {
  if (val) {
    show.value = true;
    setTimeout(() => {
      show.value = false;
      emit('hide');
    }, props.duration || 2000);
  } else {
    show.value = false;
  }
});
</script>

<style scoped>
.toast-wrap {
  position: fixed;
  top: 120rpx;
  left: 0;
  right: 0;
  z-index: 3000;
  display: flex;
  justify-content: center;
  animation: toast-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-pill {
  display: inline-flex;
  align-items: center;
  gap: 16rpx;
  background: #55EFC4;
  border: 6rpx solid #000000;
  border-radius: 60rpx;
  padding: 16rpx 36rpx;
  box-shadow: 6rpx 6rpx 0 #000000;
}

.toast-check {
  width: 36rpx;
  height: 36rpx;
  background: #000000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.check-mark {
  width: 12rpx;
  height: 20rpx;
  border-right: 4rpx solid #55EFC4;
  border-bottom: 4rpx solid #55EFC4;
  transform: rotate(45deg);
  margin-top: -4rpx;
}

.toast-text {
  font-size: 26rpx;
  font-weight: 900;
  color: #000000;
  letter-spacing: 4rpx;
}

@keyframes toast-in {
  0% { opacity: 0; transform: translateY(-40rpx); }
  100% { opacity: 1; transform: translateY(0); }
}
</style>
