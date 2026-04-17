<template>
  <view class="login-page">

    <!-- ========== 登录表单 ========== -->
    <view class="form-layer" :class="{ 'form-hidden': loading }">
      <!-- 装饰浮动元素 -->
      <view class="deco deco-circle"></view>
      <view class="deco deco-square"></view>

      <!-- 漫画卡片 -->
      <view class="manga-card">
        <!-- Welcome 标签 -->
        <view class="welcome-tag">
          <text class="welcome-tag-text">Welcome</text>
        </view>

        <view class="card-body">
          <view class="title-group">
            <text class="main-title">教务助手</text>
            <text class="sub-title">登录以同步教务系统课程安排</text>
          </view>

          <!-- 学号 -->
          <view class="field">
            <text class="field-label">学号</text>
            <view class="field-box" :class="{ 'field-focus': focusedField === 'username' }">
              <input
                v-model="username"
                type="text"
                placeholder="请输入学号"
                placeholder-class="ph"
                class="field-input"
                @focus="focusedField = 'username'"
                @blur="focusedField = ''"
              />
            </view>
          </view>

          <!-- 密码 -->
          <view class="field">
            <text class="field-label">密码</text>
            <view class="field-box" :class="{ 'field-focus': focusedField === 'password' }">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码"
                placeholder-class="ph"
                class="field-input"
                @focus="focusedField = 'password'"
                @blur="focusedField = ''"
                @confirm="handleLogin"
              />
              <text class="eye-btn" @click="showPassword = !showPassword">{{ showPassword ? '隐藏' : '显示' }}</text>
            </view>
          </view>

          <!-- 登录按钮 -->
          <button
            class="submit-btn"
            :class="{ 'submit-disabled': !isFormValid }"
            :disabled="loading || !isFormValid"
            @click="handleLogin"
          >
            <text class="submit-text">{{ isFormValid ? '登 录' : '请完善信息' }}</text>
          </button>

          <!-- 错误提示 -->
          <view v-if="errorMessage" class="error-row">
            <text class="error-msg">{{ errorMessage }}</text>
          </view>
        </view>
      </view>

      <text class="disclaimer">本应用仅用于课表查询，数据均保存在本地。</text>
    </view>

    <!-- ========== SIAS Splash 过渡 ========== -->
    <view class="splash-layer" v-if="loading">
      <!-- 装饰 -->
      <view class="splash-deco sd-1"></view>
      <view class="splash-deco sd-2"></view>
      <view class="splash-deco sd-3"></view>

      <!-- SIAS 字母 -->
      <view class="sias-row">
        <text class="sias-letter sl-1">S</text>
        <text class="sias-letter sl-2">I</text>
        <text class="sias-letter sl-3">A</text>
        <text class="sias-letter sl-4">S</text>
      </view>

      <!-- 同步进度 -->
      <view class="sync-badge">
        <text class="sync-text">Syncing... {{ progress }}%</text>
      </view>

      <view class="splash-bar-track">
        <view class="splash-bar-fill" :style="{ width: progress + '%' }"></view>
      </view>

    </view>

  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { syncSchedule } from '@/api/schedule';
import { useScheduleStore } from '@/stores/schedule';
import { encryptPassword } from '@/utils/crypto';
import { scheduleCachedTodayReminders } from '@/utils/reminder';

const username = ref('');
const password = ref('');
const showPassword = ref(false);
const loading = ref(false);
const errorMessage = ref('');
const focusedField = ref('');
const progress = ref(0);
const statusText = ref('');

const isFormValid = computed(() => username.value.trim().length > 0 && password.value.length > 0);

const scheduleStore = useScheduleStore();

function onProgress(percent: number, text: string) {
  progress.value = percent;
  statusText.value = text;
}

async function handleLogin() {
  errorMessage.value = '';

  if (!username.value.trim() || !password.value) {
    errorMessage.value = '请完整输入学号和密码';
    return;
  }

  loading.value = true;
  progress.value = 0;
  statusText.value = '初始化请求...';

  try {
    scheduleStore.clearUserData();

    const courses = await syncSchedule({
      username: username.value.trim(),
      password: password.value
    }, onProgress);

    scheduleStore.setCourses(courses);
    scheduleStore.setUserInfo({
      studentId: username.value.trim(),
      username: username.value.trim(),
      password: encryptPassword(password.value, username.value.trim()),
      lastSyncAt: new Date().toISOString()
    });

    await scheduleCachedTodayReminders(scheduleStore.currentWeek);

    // 保持 loading 状态直到跳转，避免表单闪现
    setTimeout(() => {
      uni.reLaunch({
        url: '/pages/schedule/schedule',
        complete: () => {
          loading.value = false;
          progress.value = 0;
        }
      });
    }, 600);
    return;

  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '同步失败，请检查网络或密码';
    loading.value = false;
    progress.value = 0;
  }
}
</script>

<style scoped>
/* ============================================
   漫画风登录页 + SIAS Splash
   ============================================ */
.login-page {
  height: 100vh;
  background-color: #F4F4F5;
  background-image: radial-gradient(#D4D4D8 1.5px, transparent 1.5px);
  background-size: 20px 20px;
  position: relative;
  overflow: hidden;
}

/* ========== 表单层 ========== */
.form-layer {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 48rpx;
  transition: opacity 0.4s ease, transform 0.4s ease;
  z-index: 2;
}

.form-layer.form-hidden {
  opacity: 0;
  transform: scale(0.95);
  pointer-events: none;
}

/* 装饰元素 */
.deco {
  position: absolute;
  z-index: 0;
}

.deco-circle {
  top: 120rpx;
  right: 60rpx;
  width: 100rpx;
  height: 100rpx;
  background: #FFFFFF;
  border: 6rpx solid #000000;
  border-radius: 50%;
  box-shadow: 6rpx 6rpx 0 #000000;
  animation: deco-float 3s ease-in-out infinite alternate;
}

.deco-square {
  bottom: 180rpx;
  left: 48rpx;
  width: 80rpx;
  height: 80rpx;
  background: #000000;
  border: 6rpx solid #000000;
  border-radius: 16rpx;
  box-shadow: 6rpx 6rpx 0 #FFFFFF, 8rpx 8rpx 0 #000000;
  transform: rotate(12deg);
  animation: deco-float-rev 2.5s ease-in-out infinite alternate;
}

@keyframes deco-float {
  0% { transform: translateY(0); }
  100% { transform: translateY(-20rpx); }
}

@keyframes deco-float-rev {
  0% { transform: rotate(12deg) translateY(0); }
  100% { transform: rotate(12deg) translateY(20rpx); }
}

/* ========== 漫画卡片 ========== */
.manga-card {
  width: 100%;
  background: #FFFFFF;
  border: 6rpx solid #000000;
  border-radius: 40rpx;
  box-shadow: 12rpx 12rpx 0 #000000;
  position: relative;
  z-index: 1;
}

.welcome-tag {
  position: absolute;
  top: -32rpx;
  left: -16rpx;
  background: #000000;
  padding: 10rpx 28rpx;
  border: 4rpx solid #FFFFFF;
  box-shadow: 4rpx 4rpx 0 #000000;
  transform: rotate(-6deg);
  z-index: 2;
}

.welcome-tag-text {
  font-size: 22rpx;
  font-weight: 900;
  color: #FFFFFF;
  letter-spacing: 4rpx;
  text-transform: uppercase;
}

.card-body {
  padding: 64rpx 48rpx 48rpx;
}

.title-group {
  margin-bottom: 56rpx;
  margin-top: 8rpx;
}

.main-title {
  font-size: 64rpx;
  font-weight: 900;
  color: #000000;
  letter-spacing: -2rpx;
  display: block;
  margin-bottom: 12rpx;
}

.sub-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #999999;
}

/* ========== 输入框 ========== */
.field {
  margin-bottom: 36rpx;
}

.field-label {
  display: block;
  font-size: 22rpx;
  font-weight: 900;
  color: #000000;
  letter-spacing: 3rpx;
  margin-bottom: 12rpx;
}

.field-box {
  display: flex;
  align-items: center;
  background: #F9FAFB;
  border: 4rpx solid #000000;
  border-radius: 20rpx;
  padding: 0 24rpx;
  height: 88rpx;
  transition: box-shadow 0.2s ease, background 0.2s ease;
}

.field-box.field-focus {
  background: #FFFFFF;
  box-shadow: 6rpx 6rpx 0 #000000;
}

.field-input {
  flex: 1;
  height: 88rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #000000 !important;
  background: transparent !important;
}

.ph {
  color: #CCCCCC;
  font-size: 30rpx;
  font-weight: 400;
}

.eye-btn {
  font-size: 24rpx;
  font-weight: 600;
  color: #999999;
  flex-shrink: 0;
  padding-left: 16rpx;
}

/* ========== 提交按钮 ========== */
.submit-btn {
  width: 100%;
  height: 96rpx;
  margin-top: 16rpx;
  background: #000000;
  border: none;
  border-radius: 20rpx;
  box-shadow: 6rpx 6rpx 0 #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.submit-btn::after {
  border: none;
}

.submit-btn:active:not([disabled]) {
  transform: translate(4rpx, 4rpx);
  box-shadow: 2rpx 2rpx 0 #000000;
}

.submit-text {
  font-size: 30rpx;
  font-weight: 900;
  color: #FFFFFF;
  letter-spacing: 8rpx;
}

.submit-disabled {
  background: #F3F4F6;
  border: 4rpx solid transparent;
  box-shadow: none;
}

.submit-disabled .submit-text {
  color: #CCCCCC;
  letter-spacing: 2rpx;
}

.error-row {
  margin-top: 24rpx;
  text-align: center;
}

.error-msg {
  font-size: 26rpx;
  font-weight: 600;
  color: #EF4444;
}

.disclaimer {
  margin-top: 56rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: #BBBBBB;
  text-align: center;
  position: relative;
  z-index: 1;
}

/* ========== SIAS Splash 过渡层 ========== */
.splash-layer {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

/* 装饰元素 */
.splash-deco {
  position: absolute;
}

.sd-1 {
  top: 160rpx;
  left: 80rpx;
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #FFFFFF;
  border: 6rpx solid #000000;
  box-shadow: 6rpx 6rpx 0 #000000;
  animation: deco-float 3s ease-in-out infinite alternate;
}

.sd-2 {
  bottom: 200rpx;
  right: 80rpx;
  width: 80rpx;
  height: 80rpx;
  background: #000000;
  border: 6rpx solid #000000;
  border-radius: 16rpx;
  box-shadow: 6rpx 6rpx 0 #FFFFFF, 8rpx 8rpx 0 #000000;
  animation: splash-spin 12s linear infinite;
}

.sd-3 {
  top: 280rpx;
  right: 140rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #A1A1AA;
  border: 5rpx solid #000000;
  box-shadow: 4rpx 4rpx 0 #000000;
  animation: deco-float-rev 2.5s ease-in-out infinite alternate;
}

@keyframes splash-spin {
  0% { transform: rotate(12deg); }
  100% { transform: rotate(372deg); }
}

/* SIAS 字母 */
.sias-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 48rpx;
}

.sias-letter {
  font-size: 120rpx;
  font-weight: 900;
  color: #FFFFFF;
  text-shadow:
    -4rpx -4rpx 0 #000, 4rpx -4rpx 0 #000,
    -4rpx 4rpx 0 #000, 4rpx 4rpx 0 #000,
    0 12rpx 0 #000;
  animation: letter-bounce 0.9s cubic-bezier(0.28, 0.84, 0.42, 1) forwards;
  opacity: 0;
}

.sl-1 { animation-delay: 0.1s; transform: rotate(-3deg); }
.sl-2 { animation-delay: 0.25s; }
.sl-3 { animation-delay: 0.4s; transform: rotate(-2deg); }
.sl-4 { animation-delay: 0.55s; transform: rotate(3deg); }

@keyframes letter-bounce {
  0% { opacity: 0; transform: translateY(-300rpx) scaleY(1.2) scaleX(0.8); }
  45% { opacity: 1; transform: translateY(30rpx) scaleY(0.7) scaleX(1.3); }
  65% { transform: translateY(-40rpx) scaleY(1.1) scaleX(0.9); }
  85% { transform: translateY(15rpx) scaleY(0.95) scaleX(1.05); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

/* 同步进度 */
.sync-badge {
  background: #000000;
  border: 6rpx solid #000000;
  border-radius: 60rpx;
  padding: 16rpx 40rpx;
  box-shadow: 8rpx 8rpx 0 #FFFFFF, 10rpx 10rpx 0 #000000;
  margin-bottom: 40rpx;
  animation: badge-pop 0.5s 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  opacity: 0;
  transform: scale(0.5) rotate(-5deg);
}

.sync-text {
  font-size: 24rpx;
  font-weight: 900;
  color: #FFFFFF;
  letter-spacing: 4rpx;
  text-transform: uppercase;
}

@keyframes badge-pop {
  to { opacity: 1; transform: scale(1) rotate(0deg); }
}

.splash-bar-track {
  width: 400rpx;
  height: 6rpx;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 6rpx;
  overflow: hidden;
  animation: badge-pop 0.4s 1.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  opacity: 0;
  transform: scale(0.5);
}

.splash-bar-fill {
  height: 100%;
  background: #000000;
  border-radius: 6rpx;
  transition: width 0.4s ease-out;
}
</style>
