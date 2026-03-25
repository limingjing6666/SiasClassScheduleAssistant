<template>
  <view class="page">
    <view class="page-header">
      <view class="status-bar"></view>
      <view class="header-row">
        <text class="back-btn" @click="goBack">‹</text>
        <text class="page-title">平均成绩</text>
      </view>
    </view>

    <!-- 加载态 -->
    <view v-if="loading" class="loading-container">
      <view class="loading-spinner"></view>
      <text class="loading-text">正在查询...</text>
    </view>

    <!-- 数据卡片 -->
    <scroll-view v-else-if="list.length > 0" class="content" scroll-y :show-scrollbar="false">
      <view v-for="(item, idx) in list" :key="idx" class="avg-card">
        <view class="card-badge">
          <text class="badge-text">{{ item.period }}</text>
        </view>

        <view class="card-score-row">
          <view class="score-block">
            <text class="score-number">{{ item.avgScore.toFixed(2) }}</text>
            <text class="score-label">平均成绩</text>
          </view>
        </view>

        <view class="rank-row">
          <view class="rank-item">
            <text class="rank-value">{{ item.majorRank }}</text>
            <text class="rank-label">专业排名</text>
          </view>
          <view class="rank-divider"></view>
          <view class="rank-item">
            <text class="rank-value">{{ item.classRank }}</text>
            <text class="rank-label">班级排名</text>
          </view>
        </view>

        <view class="card-info">
          <view class="info-row">
            <text class="info-label">院系</text>
            <text class="info-value">{{ item.department }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">专业</text>
            <text class="info-value">{{ item.major }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">班级</text>
            <text class="info-value">{{ item.className }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">统计时间</text>
            <text class="info-value">{{ item.statTime }}</text>
          </view>
        </view>
      </view>

      <view class="tip-section">
        <text class="tip-text">备注：此排名只包含统计时间以前课程的首考获得成绩，且通识选修课、辅修课程成绩不参与统计排名。</text>
      </view>
    </scroll-view>

    <!-- 空状态 -->
    <view v-else class="empty-state">
      <text class="empty-icon">📊</text>
      <text class="empty-text">{{ errorMsg || '暂无平均成绩数据' }}</text>
      <view class="retry-btn" @click="loadData" v-if="errorMsg">
        <text class="retry-text">重试</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { GradeAverage } from '@/types/grade';
import { fetchGradeAvg, getCachedGradeAvg, cacheGradeAvg } from '@/utils/gradeAvg';
import { readPassword } from '@/utils/crypto';

const loading = ref(false);
const list = ref<GradeAverage[]>([]);
const errorMsg = ref('');

function goBack() {
  uni.navigateBack();
}

onMounted(() => {
  loadData();
});

async function loadData() {
  loading.value = true;
  errorMsg.value = '';

  try {
    // 先查缓存
    const cached = getCachedGradeAvg();
    if (cached && cached.length > 0) {
      list.value = cached;
      loading.value = false;
      return;
    }

    // 获取用户信息
    const cachedUser = uni.getStorageSync('userInfo');
    if (!cachedUser) {
      errorMsg.value = '请先登录';
      loading.value = false;
      return;
    }

    const { username, password: storedPwd } = JSON.parse(cachedUser);
    const password = readPassword(storedPwd, username);
    if (!username || !password) {
      errorMsg.value = '请先登录';
      loading.value = false;
      return;
    }

    const data = await fetchGradeAvg(username, password);
    list.value = data;

    if (data.length > 0) {
      cacheGradeAvg(data);
    }
  } catch (e: unknown) {
    console.error('[GradeAvg] Load failed:', e);
    errorMsg.value = e instanceof Error ? e.message : '获取失败，请重试';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #F5F7FA;
  display: flex;
  flex-direction: column;
}

.page-header {
  background: #FFFFFF;
  padding: 32rpx;
  box-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.05);
}

.status-bar {
  height: var(--status-bar-height, 44rpx);
}

.header-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 16rpx;
}

.back-btn {
  font-size: 56rpx;
  color: #000000;
  line-height: 1;
  padding-right: 8rpx;
}

.page-title {
  font-size: 40rpx;
  font-weight: 800;
  color: #000000;
}

/* 加载态 */
.loading-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
}

.loading-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid #EAEAEA;
  border-top-color: #000000;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 26rpx;
  color: #888888;
}

/* 内容区 */
.content {
  flex: 1;
  padding: 32rpx;
  box-sizing: border-box;
}

/* 卡片 */
.avg-card {
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 40rpx 32rpx;
  margin-bottom: 32rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
  box-sizing: border-box;
  overflow: hidden;
}

.card-badge {
  display: inline-flex;
  background: #F0F0F0;
  border-radius: 8rpx;
  padding: 6rpx 20rpx;
  margin-bottom: 32rpx;
}

.badge-text {
  font-size: 24rpx;
  color: #666666;
  font-weight: 500;
}

/* 分数区 */
.card-score-row {
  display: flex;
  justify-content: center;
  margin-bottom: 40rpx;
}

.score-block {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.score-number {
  font-size: 80rpx;
  font-weight: 800;
  color: #1a1a1a;
  line-height: 1.1;
}

.score-label {
  font-size: 24rpx;
  color: #888888;
  margin-top: 8rpx;
}

/* 排名行 */
.rank-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 48rpx;
  margin-bottom: 40rpx;
  padding: 28rpx 0;
  background: #FAFAFB;
  border-radius: 16rpx;
}

.rank-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 120rpx;
}

.rank-value {
  font-size: 48rpx;
  font-weight: 700;
  color: #1a1a1a;
}

.rank-label {
  font-size: 22rpx;
  color: #888888;
  margin-top: 4rpx;
}

.rank-divider {
  width: 2rpx;
  height: 64rpx;
  background: #E0E0E0;
}

/* 信息区 */
.card-info {
  border-top: 2rpx solid #F0F0F0;
  padding-top: 24rpx;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
}

.info-label {
  font-size: 26rpx;
  color: #888888;
  flex-shrink: 0;
}

.info-value {
  font-size: 26rpx;
  color: #333333;
  text-align: right;
  flex: 1;
  margin-left: 24rpx;
  word-break: break-all;
}

/* 备注 */
.tip-section {
  padding: 16rpx 8rpx 48rpx;
}

.tip-text {
  font-size: 22rpx;
  color: #999999;
  line-height: 1.6;
}

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
}

.empty-icon {
  font-size: 80rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #888888;
}

.retry-btn {
  margin-top: 24rpx;
  padding: 16rpx 48rpx;
  background: #000000;
  border-radius: 32rpx;
}

.retry-text {
  font-size: 28rpx;
  color: #FFFFFF;
}
</style>
