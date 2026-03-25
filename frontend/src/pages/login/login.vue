<template>
  <view class="login-page">
    <view class="mobile-container">
      <view class="login-card">
        
        <!-- 大号标题 -->
        <view class="welcome-section" v-if="!loading">
          <text class="welcome-title">你的课表</text>
          <text class="welcome-desc">登录以同步教务系统课程安排</text>
        </view>

        <!-- 登录表单 -->
        <view class="form-section" v-if="!loading">
          <view class="field">
            <text class="field-label">学号</text>
            <view class="field-input-wrap" :class="{'is-focused': focusedField === 'username'}">
              <input
                v-model="username"
                type="text"
                placeholder="请输入学号"
                placeholder-class="placeholder-style"
                class="field-input"
                @focus="focusedField = 'username'"
                @blur="focusedField = ''"
              />
            </view>
          </view>

          <view class="field">
            <text class="field-label">密码</text>
            <view class="field-input-wrap" :class="{'is-focused': focusedField === 'password'}">
              <input
                v-model="password"
                type="password"
                placeholder="请输入密码"
                placeholder-class="placeholder-style"
                class="field-input"
                @focus="focusedField = 'password'"
                @blur="focusedField = ''"
                @confirm="handleLogin"
              />
            </view>
          </view>

          <button
            class="login-btn"
            :disabled="loading"
            @click="handleLogin"
          >
            <text>{{ loading ? '登录中...' : '登 录' }}</text>
          </button>

          <!-- 简单错误提示 -->
          <view v-if="errorMessage" class="error-banner">
            <text class="error-text">{{ errorMessage }}</text>
          </view>
        </view>

        <!-- 骨架屏同步状态 (极简版) -->
        <view class="sync-skeleton" v-else>
          <view class="sk-title"></view>
          <view class="sk-subtitle"></view>
          <view class="sk-grid">
            <view class="sk-item"></view>
            <view class="sk-item"></view>
            <view class="sk-item"></view>
          </view>
          <text class="sync-tip">正在同步教务系统数据...</text>
        </view>

        <!-- 极简底部说明 -->
        <view class="footer">
          <text class="footer-text">本应用仅用于课表查询，数据均保存在本地。</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { syncSchedule } from '@/api/schedule';
import { useScheduleStore } from '@/stores/schedule';
import { encryptPassword } from '@/utils/crypto';

const username = ref('');
const password = ref('');
const loading = ref(false);
const errorMessage = ref('');
const focusedField = ref('');

const scheduleStore = useScheduleStore();

async function handleLogin() {
  errorMessage.value = '';

  if (!username.value.trim() || !password.value) {
    errorMessage.value = '请完整输入学号和密码';
    return;
  }

  loading.value = true;

  try {
    scheduleStore.clearUserData();

    const courses = await syncSchedule({
      username: username.value.trim(),
      password: password.value
    });

    scheduleStore.setCourses(courses);
    scheduleStore.setUserInfo({
      studentId: username.value.trim(),
      username: username.value.trim(),
      password: encryptPassword(password.value, username.value.trim()),
      lastSyncAt: new Date().toISOString()
    });

    setTimeout(() => {
      uni.switchTab({
        url: '/pages/schedule/schedule'
      });
    }, 500);

  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '同步失败，请检查网络或密码';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
/* ============================================
   极致纯白极简风 (Pure Minimalist UI)
   ============================================ */
.login-page {
  height: 100vh;
  background: #FFFFFF;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.mobile-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-card {
  width: 100%;
  max-width: 600rpx;
  padding: 80rpx 40rpx;
  background: #FFFFFF;
  display: flex;
  flex-direction: column;
}

/* 欢迎区大排版 */
.welcome-section {
  display: flex;
  flex-direction: column;
  margin-bottom: 80rpx;
}

.welcome-title {
  font-size: 68rpx;
  font-weight: 800;
  color: #000000;
  margin-bottom: 16rpx;
  letter-spacing: -2rpx;
  line-height: 1.1;
}

.welcome-desc {
  font-size: 28rpx;
  color: #888888;
  font-weight: 400;
}

/* 表单区域 */
.form-section {
  display: flex;
  flex-direction: column;
}

.field {
  margin-bottom: 48rpx;
}

.field-label {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #000000;
  margin-bottom: 16rpx;
  text-transform: uppercase;
  letter-spacing: 2rpx;
}

.field-input-wrap {
  border-bottom: 2rpx solid #EAEAEA;
  height: 80rpx;
  display: flex;
  align-items: center;
  transition: border-color 0.2s ease;
}

.field-input-wrap.is-focused {
  border-bottom: 2rpx solid #000000;
}

.field-input {
  flex: 1;
  height: 80rpx;
  font-size: 32rpx;
  color: #000000 !important;
  background: transparent !important;
}

::-webkit-input-placeholder {
  color: #CCCCCC !important;
}
.placeholder-style {
  color: #CCCCCC;
  font-size: 32rpx;
  font-weight: 400;
}

/* 极简按钮 */
.login-btn {
  width: 100%;
  height: 100rpx;
  background: #000000;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
  border-radius: 8rpx;
  margin-top: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s ease;
}

.login-btn::after {
  border: none;
}

.login-btn:active:not([disabled]) {
  opacity: 0.7;
}

.login-btn[disabled] {
  opacity: 0.3;
}

/* 极简错误提示 */
.error-banner {
  margin-top: 32rpx;
  text-align: center;
}

.error-text {
  font-size: 26rpx;
  color: #000000;
  font-weight: 500;
}

/* 极简骨架屏 */
.sync-skeleton {
  display: flex;
  flex-direction: column;
  padding: 40rpx 0;
}

.sk-title {
  width: 60%;
  height: 60rpx;
  background: #F5F5F5;
  margin-bottom: 20rpx;
}
.sk-subtitle {
  width: 40%;
  height: 30rpx;
  background: #F5F5F5;
  margin-bottom: 60rpx;
}
.sk-grid {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-bottom: 60rpx;
}
.sk-item {
  width: 100%;
  height: 80rpx;
  background: #F5F5F5;
}

.sync-tip {
  font-size: 26rpx;
  color: #000000;
  font-weight: 500;
}

/* 底部 */
.footer {
  margin-top: 80rpx;
  text-align: left;
}

.footer-text {
  font-size: 22rpx;
  color: #BBBBBB;
}
</style>
