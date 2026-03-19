<template>
  <view class="login-page">
    <!-- 移动端：固定布局 -->
    <view class="mobile-container">
      <view class="login-card">
        <!-- 装饰图片区域 (移动端显示在顶部) -->
        <view class="card-banner">
          <image
            class="banner-img"
            src="/static/login-banner.png"
            mode="aspectFill"
          />
        </view>

        <!-- 欢迎语 -->
        <view class="welcome-section" v-if="!loading">
          <text class="welcome-title">欢迎回来</text>
          <text class="welcome-desc">苦逼的一天，从课表开始。</text>
          <text class="welcome-desc">登录以同步你的课程安排。</text>
        </view>

        <!-- 登录表单 -->
        <view class="form-section" v-if="!loading">
          <view class="field">
            <text class="field-label">学号</text>
            <view class="field-input-wrap">
              <input
                v-model="username"
                type="text"
                placeholder="请输入学号"
                placeholder-class="placeholder-style"
                class="field-input"
              />
            </view>
          </view>

          <view class="field">
            <text class="field-label">密码</text>
            <view class="field-input-wrap">
              <input
                v-model="password"
                type="password"
                placeholder="请输入密码"
                placeholder-class="placeholder-style"
                class="field-input"
              />
            </view>
          </view>

          <button
            class="login-btn"
            :disabled="loading"
            @click="handleLogin"
          >
            {{ loading ? '登录中...' : '登 录' }}
          </button>

          <!-- 错误提示横幅 -->
          <view v-if="errorMessage" class="error-banner">
            <text class="error-icon">⚠️</text>
            <text class="error-text">{{ errorMessage }}</text>
          </view>
        </view>

        <!-- 骨架屏同步状态 -->
        <view class="sync-skeleton" v-else>
          <view class="sync-header">
            <view class="skeleton-item title-sk"></view>
            <view class="skeleton-item desc-sk"></view>
          </view>
          <view class="sync-grid-sk">
            <view v-for="i in 4" :key="i" class="sk-col">
              <view v-for="j in 4" :key="j" class="skeleton-item sk-block" 
                :style="{ height: (j % 3 === 0 ? '120rpx' : '80rpx'), opacity: 1 - (i * 0.1) }">
              </view>
            </view>
          </view>
          <text class="sync-tip">正在同步教务系统数据...</text>
        </view>

        <!-- 底部说明 -->
        <view class="footer">
          <text class="footer-text">本应用仅用于课表查询，不存储您的密码</text>
        </view>
      </view>
    </view>

    <!-- Web端左侧装饰图 -->
    <view class="side-banner">
      <image
        class="side-banner-img"
        src="/static/login-banner.png"
        mode="aspectFill"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { syncSchedule } from '@/api/schedule';
import { useScheduleStore } from '@/stores/schedule';

const username = ref('');
const password = ref('');
const loading = ref(false);
const errorMessage = ref('');

const scheduleStore = useScheduleStore();

async function handleLogin() {
  errorMessage.value = '';

  // 验证输入
  if (!username.value.trim()) {
    uni.showToast({ title: '请输入学号', icon: 'none' });
    return;
  }
  if (!password.value) {
    uni.showToast({ title: '请输入密码', icon: 'none' });
    return;
  }

  loading.value = true;

  try {
    // ★ 切换账号时清除旧账号数据，但保留用户设定的学期开始日期
    scheduleStore.clearUserData();

    // 调用API同步课表
    const courses = await syncSchedule({
      username: username.value.trim(),
      password: password.value
    });

    // 保存课表数据
    scheduleStore.setCourses(courses);

    // 保存用户信息
    scheduleStore.setUserInfo({
      studentId: username.value.trim(),
      lastSyncAt: new Date().toISOString()
    });

    uni.showToast({ title: '同步成功', icon: 'none', duration: 1000 });

    // 跳转到课表页面（等待 toast 结束后再跳转）
    setTimeout(() => {
      uni.reLaunch({
        url: '/pages/schedule/schedule'
      });
    }, 1000);

  } catch (error: any) {
    // 将普通 toast 提示改为持久化的页面级提示
    errorMessage.value = error.message || '同步失败';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
/* ============================================
   深色主题 —— 暖色大地色系 (登录页)
   ============================================ */
.login-page {
  height: 100vh;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  transition: background 0.3s ease;
}

/* 移动端固定容器 */
.mobile-container {
  flex: 1;
  height: 100vh;
  overflow: hidden;
}

/* 登录卡片 */
.login-card {
  width: 90%;
  max-width: 700rpx;
  margin: 0 auto;
  margin-top: calc((100vh - 1100rpx) / 2);
  background: var(--bg-secondary);
  border: 1rpx solid var(--border);
  border-radius: 36rpx;
  box-shadow: var(--card-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: background 0.3s ease;
}

/* 移动端顶部装饰横幅 */
.card-banner {
  width: 100%;
  height: 400rpx;
  overflow: hidden;
  border-radius: 36rpx 36rpx 0 0;
}

.banner-img {
  width: 100%;
  height: 100%;
  border-radius: 36rpx 36rpx 0 0;
}

/* Web端侧边栏装饰图 */
.side-banner {
  display: none;
}

/* 欢迎区 */
.welcome-section {
  padding: 40rpx 48rpx 0;
  display: flex;
  flex-direction: column;
}

.welcome-title {
  font-size: 48rpx;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 12rpx;
  letter-spacing: 2rpx;
}

.welcome-desc {
  font-size: 26rpx;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* 同步骨架屏样式 */
.sync-skeleton {
  padding: 20rpx 48rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sync-header {
  width: 100%;
  margin-bottom: 40rpx;
}

.title-sk {
  width: 200rpx;
  height: 40rpx;
  margin-bottom: 20rpx;
}

.desc-sk {
  width: 100%;
  height: 30rpx;
}

.sync-grid-sk {
  display: flex;
  width: 100%;
  gap: 20rpx;
  margin-bottom: 40rpx;
}

.sk-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.sk-block {
  width: 100%;
}

.sync-tip {
  font-size: 26rpx;
  color: var(--accent);
  font-weight: 600;
  animation: skeleton-pulse 1.5s infinite;
}

/* 表单区域 */
.form-section {
  padding: 36rpx 48rpx 0;
}

.field {
  margin-bottom: 32rpx;
}

.field-label {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 12rpx;
}

.field-input-wrap {
  border: 2rpx solid var(--border);
  border-radius: 16rpx;
  padding: 0 28rpx;
  height: 92rpx;
  display: flex;
  align-items: center;
  transition: border-color 0.25s, box-shadow 0.25s;
  background: var(--bg-primary);
}

.field-input-wrap:focus-within {
  border-color: #C87A3C;
  box-shadow: 0 0 12rpx rgba(200, 122, 60, 0.25);
}

.field-input {
  flex: 1;
  height: 92rpx;
  font-size: 30rpx;
  color: #ffffff !important;
  background: transparent !important;
  -webkit-appearance: none;
  appearance: none;
  border: none;
  outline: none;
}

/* 强制覆盖浏览器原生 input 白色背景 */
:deep(input),
:deep(uni-input input) {
  background: transparent !important;
  color: #ffffff !important;
  caret-color: #C87A3C;
}

.placeholder-style {
  color: var(--text-secondary);
  font-size: 28rpx;
}

/* 登录按钮 */
.login-btn {
  width: 100%;
  height: 92rpx;
  line-height: 92rpx;
  background: var(--accent);
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 600;
  border: none;
  border-radius: 16rpx;
  margin-top: 12rpx;
  letter-spacing: 8rpx;
  transition: all 0.3s ease;
}

.login-btn::after {
  border: none;
}

.login-btn[disabled] {
  opacity: 0.65;
  background: linear-gradient(135deg, #8B4A1A 0%, #C87A3C 100%);
}

/* 错误提示横幅 */
.error-banner {
  margin-top: 24rpx;
  padding: 20rpx 24rpx;
  background: rgba(220, 53, 69, 0.1);
  border: 1rpx solid rgba(220, 53, 69, 0.3);
  border-radius: 12rpx;
  display: flex;
  align-items: flex-start;
}

.error-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
  line-height: 1.4;
}

.error-text {
  font-size: 24rpx;
  color: #ff8c8c;
  line-height: 1.5;
  flex: 1;
}

/* 底部 */
.footer {
  padding: 40rpx 48rpx 36rpx;
  text-align: center;
}

.footer-text {
  font-size: 22rpx;
  color: rgba(240, 230, 216, 0.25);
  letter-spacing: 1rpx;
}

/* ============================================
   Web端 / 大屏适配  (≥ 768px)
   ============================================ */
@media screen and (min-width: 768px) {
  .login-page {
    flex-direction: row;
    background: #1C1410;
    padding: 0;
    overflow: hidden;
  }

  .mobile-scroll {
    flex: none;
    height: 100vh;
    width: auto;
    overflow-y: auto;
  }

  .card-banner {
    display: none;
  }

  .side-banner {
    display: block;
    flex: 1;
    height: 100vh;
    min-height: 100vh;
    max-height: 100vh;
    overflow: hidden;
    order: -1;
    position: relative;
  }

  .side-banner-img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .mobile-container {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .login-card {
    width: 480px;
    min-width: 420px;
    max-width: 520px;
    min-height: 100vh;
    margin: 0;
    border-radius: 0;
    border: none;
    border-left: 1px solid rgba(200, 122, 60, 0.15);
    box-shadow: -8px 0 40px rgba(0, 0, 0, 0.4);
    padding: 0;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .welcome-section {
    padding: 0 48px 0;
  }

  .welcome-title {
    font-size: 32px;
  }

  .welcome-desc {
    font-size: 14px;
  }

  .form-section {
    padding: 40px 48px 0;
  }

  .field {
    margin-bottom: 24px;
  }

  .field-label {
    font-size: 14px;
    margin-bottom: 8px;
  }

  .field-input-wrap {
    height: 48px;
    border-radius: 10px;
    padding: 0 16px;
    background: rgba(255, 255, 255, 0.06) !important;
    border: 2px solid rgba(200, 122, 60, 0.25);
  }

  .field-input-wrap:focus-within {
    border-color: #C87A3C;
  }

  .field-input {
    height: 48px;
    font-size: 15px;
  }

  .login-btn {
    height: 50px;
    line-height: 50px;
    border-radius: 10px;
    font-size: 16px;
    margin-top: 8px;
    letter-spacing: 6px;
  }

  .error-banner {
    margin-top: 16px;
    padding: 12px 16px;
    border-radius: 8px;
  }

  .error-icon {
    font-size: 16px;
  }

  .error-text {
    font-size: 13px;
  }

  .footer {
    padding: 40px 48px 24px;
  }

  .footer-text {
    font-size: 12px;
  }
}
</style>
