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
        <view class="welcome-section">
          <text class="welcome-title">欢迎回来 👋</text>
          <text class="welcome-desc">新的一天，从课表开始。</text>
          <text class="welcome-desc">登录以同步你的课程安排。</text>
        </view>

        <!-- 登录表单 -->
        <view class="form-section">
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
            :loading="loading"
            :disabled="loading"
            @click="handleLogin"
          >
            {{ loading ? '同步中...' : '登 录' }}
          </button>
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

const scheduleStore = useScheduleStore();

async function handleLogin() {
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

    uni.showToast({ title: '同步成功', icon: 'success' });

    // 跳转到课表页面
    setTimeout(() => {
      uni.reLaunch({
        url: '/pages/schedule/schedule'
      });
    }, 1000);

  } catch (error: any) {
    uni.showToast({
      title: error.message || '同步失败',
      icon: 'none',
      duration: 3000
    });
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
/* ============================================
   基础 / 移动端样式 (默认)
   ============================================ */
.login-page {
  height: 100vh;
  background: #f0f2f7;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

/* 移动端固定容器 */
.mobile-container {
  flex: 1;
  height: 100vh;
  overflow: hidden;
}

/* 登录卡片 - 移动端浮动居中 */
.login-card {
  width: 90%;
  max-width: 700rpx;
  margin: 0 auto;
  margin-top: calc((100vh - 1100rpx) / 2);
  background: #ffffff;
  border-radius: 36rpx;
  box-shadow: 0 12rpx 60rpx rgba(0, 0, 0, 0.10);
  display: flex;
  flex-direction: column;
  overflow: hidden;
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

/* Web端侧边栏装饰图（移动端隐藏） */
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
  color: #1a1a2e;
  margin-bottom: 12rpx;
  letter-spacing: 2rpx;
}

.welcome-desc {
  font-size: 26rpx;
  color: #8e8e9a;
  line-height: 1.6;
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
  color: #1a1a2e;
  margin-bottom: 12rpx;
}

.field-input-wrap {
  border: 2rpx solid #e4e4ec;
  border-radius: 16rpx;
  padding: 0 28rpx;
  height: 92rpx;
  display: flex;
  align-items: center;
  transition: border-color 0.25s;
  background: #ffffff;
}

.field-input-wrap:focus-within {
  border-color: #2d3a4a;
}

.field-input {
  flex: 1;
  height: 92rpx;
  font-size: 30rpx;
  color: #1a1a2e;
  background: transparent;
}

.placeholder-style {
  color: #b5b5c3;
  font-size: 28rpx;
}

/* 登录按钮 */
.login-btn {
  width: 100%;
  height: 92rpx;
  line-height: 92rpx;
  background: #1a2332;
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
  background: #1a2332;
}

/* 底部 */
.footer {
  padding: 40rpx 48rpx 36rpx;
  text-align: center;
}

.footer-text {
  font-size: 22rpx;
  color: #b5b5c3;
  letter-spacing: 1rpx;
}

/* ============================================
   Web端 / 大屏适配  (≥ 768px)
   ============================================ */
@media screen and (min-width: 768px) {
  .login-page {
    flex-direction: row;
    background: #eef0f5;
    padding: 0;
    overflow: hidden;
  }

  /* Web端隐藏移动端横幅和scroll容器 */
  .mobile-scroll {
    flex: none;
    height: 100vh;
    width: auto;
    overflow-y: auto;
  }

  .card-banner {
    display: none;
  }

  /* Web端显示侧边装饰图 */
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

  /* 卡片调整 - Web端恢复全高面板 */
  .login-card {
    width: 480px;
    min-width: 420px;
    max-width: 520px;
    min-height: 100vh;
    margin: 0;
    border-radius: 0;
    box-shadow: -8px 0 40px rgba(0, 0, 0, 0.06);
    padding: 0 0 40px 0;
    flex-shrink: 0;
  }

  .welcome-section {
    padding: 80px 48px 0;
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

  .footer {
    margin-top: auto;
    padding: 40px 48px 24px;
  }

  .footer-text {
    font-size: 12px;
  }
}
</style>
