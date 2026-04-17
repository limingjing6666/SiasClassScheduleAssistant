<template>
  <view class="more-page">
    <view class="page-header">
      <view class="status-bar"></view>
      <text class="page-title">我的</text>
    </view>

    <scroll-view scroll-y class="page-body" :show-scrollbar="false">
      <!-- 漫画风头像 + 个人信息 -->
      <view class="user-section">
        <view class="avatar-group">
          <!-- 偏移彩色底板 -->
          <view class="avatar-shadow-plate"></view>
          <!-- 头像主体 -->
          <view class="avatar-frame">
            <view class="avatar-inner">
              <image
                v-if="avatarUrl"
                class="avatar-img"
                :src="avatarUrl"
                mode="aspectFill"
                @error="avatarUrl = ''"
              />
              <text v-else class="avatar-text">{{ avatarText }}</text>
            </view>
          </view>
          <!-- 装饰：STUDENT 标签 -->
          <view class="avatar-tag">
            <text class="avatar-tag-text">STUDENT</text>
          </view>
          <!-- 装饰：浮动圆点 -->
          <view class="avatar-dot dot-pink"></view>
          <view class="avatar-dot dot-blue"></view>
        </view>

        <text class="user-name">{{ profileName }}</text>
        <view class="id-pill">
          <text class="id-text">ID: {{ studentId }}</text>
        </view>
      </view>

      <!-- 学业服务 -->
      <view class="section">
        <view class="section-tag tag-blue">
          <text class="section-tag-text">学业服务</text>
        </view>
        <view class="menu-card">
          <view class="menu-item" @click="goToHistory">
            <view class="menu-left">
              <view class="icon-box icon-yellow"><image class="icon-svg" src="/static/icons/history.svg" mode="aspectFit" /></view>
              <text class="menu-text">历史课表</text>
            </view>
            <view class="menu-chevron"></view>
          </view>
          <view class="menu-item" @click="goToGradeAvg">
            <view class="menu-left">
              <view class="icon-box icon-green"><image class="icon-svg" src="/static/icons/chart.svg" mode="aspectFit" /></view>
              <text class="menu-text">平均成绩</text>
            </view>
            <view class="menu-chevron"></view>
          </view>
          <view class="menu-item" @click="goToCalendar">
            <view class="menu-left">
              <view class="icon-box icon-cyan"><image class="icon-svg" src="/static/icons/calendar.svg" mode="aspectFit" /></view>
              <text class="menu-text">校历</text>
            </view>
            <view class="menu-chevron"></view>
          </view>
          <view class="menu-item menu-item-last" @click="goToExam">
            <view class="menu-left">
              <view class="icon-box icon-purple"><image class="icon-svg" src="/static/icons/exam.svg" mode="aspectFit" /></view>
              <text class="menu-text">我的考试</text>
            </view>
            <view class="menu-chevron"></view>
          </view>
        </view>
      </view>

      <!-- 偏好设置 -->
      <view class="section">
        <view class="section-tag tag-green">
          <text class="section-tag-text">偏好设置</text>
        </view>
        <view class="menu-card">
          <view class="menu-item menu-item-last" @click="goToReminder">
            <view class="menu-left">
              <view class="icon-box icon-peach"><image class="icon-svg" src="/static/icons/bell.svg" mode="aspectFit" /></view>
              <text class="menu-text">课前提醒</text>
            </view>
            <view class="menu-chevron"></view>
          </view>
        </view>
      </view>

      <!-- 退出登录 -->
      <view class="section">
        <view class="logout-btn" @click="showLogoutModal = true">
          <image class="logout-icon" src="/static/icons/alert.svg" mode="aspectFit" />
          <text class="logout-text">退出登录</text>
        </view>
      </view>

      <!-- 版本信息 -->
      <view class="version-info">
        <text class="version-text">西亚斯课表 v{{ appVersion }}</text>
      </view>
    </scroll-view>

    <!-- 退出登录漫画风弹窗 -->
    <MangaModal
      :visible="showLogoutModal"
      tag="WARNING"
      tag-class="tag-red"
      title="退出登录"
      content="确定要退出当前账号吗？"
      icon="/static/icons/alert.svg"
      icon-bg-class="icon-bg-gray"
      :show-cancel="true"
      cancel-text="取 消"
      confirm-text="确 定"
      confirm-btn-class="btn-red"
      @confirm="doLogout"
      @cancel="showLogoutModal = false"
    />

    <TabBar current="more" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import manifest from '@/manifest.json';
import { useScheduleStore } from '@/stores/schedule';
import { clearSession } from '@/utils/session';
import { fetchProfile, getCachedProfile } from '@/utils/profile';
import { readPassword } from '@/utils/crypto';
import TabBar from '@/components/TabBar.vue';
import MangaModal from '@/components/MangaModal.vue';

const scheduleStore = useScheduleStore();

const FALLBACK_APP_VERSION = manifest.versionName;
const appVersion = ref('');
const profileName = ref('');
const studentId = ref('');
const avatarUrl = ref('');

const showLogoutModal = ref(false);

const avatarText = computed(() => {
  if (profileName.value) return profileName.value.slice(-2);
  if (studentId.value) return studentId.value.slice(-2);
  return '?';
});

onMounted(async () => {
  // 加载个人资料
  loadProfile();

  // #ifdef APP-PLUS
  try {
    const appid = plus.runtime.appid || '';
    plus.runtime.getProperty(appid, (info) => {
      appVersion.value = (info as Record<string, string>).versionName || FALLBACK_APP_VERSION;
    });
  } catch {
    appVersion.value = FALLBACK_APP_VERSION;
  }
  // #endif
  // #ifndef APP-PLUS
  appVersion.value = FALLBACK_APP_VERSION;
  // #endif
});

async function loadProfile() {
  // 先用缓存快速显示
  const cached = getCachedProfile();
  if (cached) {
    profileName.value = cached.name;
    studentId.value = cached.studentId;
    avatarUrl.value = cached.avatarLocalPath || '';
  }

  // 从 store 拿学号
  const cachedUser = uni.getStorageSync('userInfo');
  if (!cachedUser) return;

  try {
    const { username, password: storedPwd } = JSON.parse(cachedUser);
    const password = readPassword(storedPwd, username);
    if (!username || !password) return;

    if (!studentId.value) studentId.value = username;

    // 有缓存且有本地头像则不再请求
    if (cached?.avatarLocalPath) return;

    const profile = await fetchProfile(username, password);
    if (profile) {
      profileName.value = profile.name;
      studentId.value = profile.studentId || username;
      avatarUrl.value = profile.avatarLocalPath || '';
    }
  } catch (e) {
    console.error('[More] loadProfile failed:', e);
  }
}

function goToHistory() {
  uni.navigateTo({
    url: '/pages/history/history'
  });
}

function goToGradeAvg() {
  uni.navigateTo({
    url: '/pages/gradeAvg/gradeAvg'
  });
}

function goToCalendar() {
  uni.navigateTo({
    url: '/pages/calendar/calendar'
  });
}

function goToExam() {
  uni.navigateTo({
    url: '/pages/exam/exam'
  });
}

function goToReminder() {
  uni.navigateTo({
    url: '/pages/reminder/reminder'
  });
}

function handleLogout() {
  showLogoutModal.value = true;
}

async function doLogout() {
  showLogoutModal.value = false;
  await clearSession();
  scheduleStore.clearData();
  setTimeout(() => {
    uni.reLaunch({
      url: '/pages/login/login'
    });
  }, 100);
}
</script>

<style scoped>
.more-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #F4F4F5;
  background-image: radial-gradient(#D4D4D8 1.5px, transparent 1.5px);
  background-size: 20px 20px;
  box-sizing: border-box;
}

.page-header {
  padding: 0 40rpx 8rpx;
}

.status-bar {
  height: var(--status-bar-height, 44rpx);
}

.page-title {
  font-size: 52rpx;
  font-weight: 900;
  color: #000000;
  letter-spacing: -2rpx;
  padding: 16rpx 0 8rpx;
}

.page-body {
  flex: 1;
  height: 0;
  padding: 0 16rpx 180rpx 16rpx;
  box-sizing: border-box;
}

/* ===== 头像区域 ===== */
.user-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32rpx 0 48rpx;
}

.avatar-group {
  position: relative;
  margin-bottom: 24rpx;
}

/* 偏移彩色底板 */
.avatar-shadow-plate {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #55EFC4;
  border: 6rpx solid #000000;
  border-radius: 50%;
  transform: translate(10rpx, 10rpx);
  z-index: 0;
}

.avatar-frame {
  width: 180rpx;
  height: 180rpx;
  padding: 6rpx;
  background: #FFEAA7;
  border: 6rpx solid #000000;
  border-radius: 50%;
  position: relative;
  z-index: 1;
}

.avatar-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 3rpx solid #000000;
  overflow: hidden;
  background: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.avatar-text {
  font-size: 48rpx;
  font-weight: 900;
  color: #000000;
}

/* STUDENT 标签 */
.avatar-tag {
  position: absolute;
  bottom: -16rpx;
  left: 50%;
  transform: translateX(-50%) rotate(-3deg);
  background: #000000;
  padding: 8rpx 24rpx;
  border: 4rpx solid #FFFFFF;
  box-shadow: 3rpx 3rpx 0 #000000;
  z-index: 3;
}

.avatar-tag-text {
  font-size: 18rpx;
  font-weight: 900;
  color: #FFFFFF;
  letter-spacing: 4rpx;
}

/* 浮动装饰 */
.avatar-dot {
  position: absolute;
  border-radius: 50%;
  z-index: 2;
}

.dot-pink {
  top: 4rpx;
  right: -8rpx;
  width: 28rpx;
  height: 28rpx;
  background: #FD79A8;
  border: 4rpx solid #000000;
  box-shadow: 3rpx 3rpx 0 #000000;
  animation: dot-float 3s ease-in-out infinite alternate;
}

.dot-blue {
  bottom: 24rpx;
  right: -4rpx;
  width: 20rpx;
  height: 20rpx;
  background: #74B9FF;
  border: 3rpx solid #000000;
  animation: dot-float 3s 1.5s ease-in-out infinite alternate;
}

@keyframes dot-float {
  0% { transform: translateY(0) rotate(0deg); }
  100% { transform: translateY(-12rpx) rotate(5deg); }
}

/* 姓名 */
.user-name {
  font-size: 48rpx;
  font-weight: 900;
  color: #000000;
  letter-spacing: -2rpx;
  margin-bottom: 16rpx;
}

/* 学号胶囊 */
.id-pill {
  display: inline-flex;
  background: #74B9FF;
  border: 4rpx solid #000000;
  padding: 10rpx 28rpx;
  border-radius: 40rpx;
  box-shadow: 4rpx 4rpx 0 #000000;
}

.id-text {
  font-size: 20rpx;
  font-weight: 900;
  color: #000000;
  letter-spacing: 3rpx;
  text-transform: uppercase;
}

/* ===== 分组 ===== */
.section {
  margin-top: 40rpx;
  padding: 0 8rpx;
}

/* 漫画贴签标题 */
.section-tag {
  display: inline-block;
  border: 3rpx solid #000000;
  padding: 6rpx 20rpx;
  margin-bottom: 16rpx;
  margin-left: 4rpx;
  box-shadow: 3rpx 3rpx 0 #000000;
}

.tag-blue {
  background: #74B9FF;
  transform: rotate(-2deg);
}

.tag-green {
  background: #55EFC4;
  transform: rotate(1deg);
}

.section-tag-text {
  font-size: 22rpx;
  font-weight: 900;
  color: #000000;
  letter-spacing: 4rpx;
  text-transform: uppercase;
}

/* ===== 菜单卡片 ===== */
.menu-card {
  background: #FFFFFF;
  border: 3rpx solid #000000;
  border-radius: 24rpx;
  box-shadow: 4rpx 4rpx 0 #000000;
  overflow: hidden;
  box-sizing: border-box;
  margin-right: 6rpx;
  margin-bottom: 6rpx;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 24rpx;
  border-bottom: 3rpx solid #000000;
}

.menu-item-last {
  border-bottom: none;
}

.menu-item:active {
  background: #F9FAFB;
}

.menu-left {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.icon-box {
  width: 68rpx;
  height: 68rpx;
  border: 3rpx solid #000000;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 3rpx 3rpx 0 #000000;
}

.icon-svg {
  width: 36rpx;
  height: 36rpx;
}

.icon-yellow { background: #FFEAA7; }
.icon-green { background: #55EFC4; }
.icon-cyan { background: #81ECEC; }
.icon-purple { background: #A29BFE; }
.icon-peach { background: #FAB1A0; }

.menu-text {
  font-size: 30rpx;
  color: #000000;
  font-weight: 900;
  letter-spacing: 1rpx;
}

/* CSS chevron 箭头 */
.menu-chevron {
  width: 14rpx;
  height: 14rpx;
  border-right: 4rpx solid #000000;
  border-bottom: 4rpx solid #000000;
  transform: rotate(-45deg);
  opacity: 0.3;
  flex-shrink: 0;
}

/* ===== 退出登录 ===== */
.logout-btn {
  margin-top: 40rpx;
  margin-right: 6rpx;
  margin-left: 8rpx;
  background: #FF7675;
  border: 3rpx solid #000000;
  border-radius: 24rpx;
  padding: 24rpx;
  box-shadow: 4rpx 4rpx 0 #000000;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.logout-btn:active {
  transform: translate(4rpx, 4rpx);
  box-shadow: 4rpx 4rpx 0 #000000;
}

.logout-icon {
  width: 36rpx;
  height: 36rpx;
}

.logout-text {
  font-size: 30rpx;
  font-weight: 900;
  color: #000000;
  letter-spacing: 6rpx;
}

/* ===== 版本 ===== */
.version-info {
  text-align: center;
  padding: 40rpx 0 24rpx;
}

.version-text {
  font-size: 22rpx;
  font-weight: 900;
  color: #BBBBBB;
}
</style>
