<template>
  <view class="score-page">
    <!-- 顶部标题栏 -->
    <view class="page-header">
      <view class="status-bar"></view>
      <text class="page-title">成绩查询</text>
    </view>

    <!-- 可滚动的主体内容区域 -->
    <scroll-view class="content-area" scroll-y :show-scrollbar="false">
      <!-- 学期选择器 -->
      <view class="semester-selector">
        <picker @change="onSemesterChange" :value="semesterIndex" :range="semesterList" range-key="label">
          <view class="semester-picker">
            <text class="semester-text">{{ currentSemesterLabel || '选择学期' }}</text>
            <text class="semester-arrow">▼</text>
          </view>
        </picker>
      </view>

      <!-- 加载状态 -->
      <view v-if="loading" class="loading-container">
        <view class="loading-spinner"></view>
        <text class="loading-text">加载中...</text>
      </view>

      <!-- 统计卡片区 -->
      <view v-else-if="grades.length > 0" class="stats-container">
        <view class="stat-card">
          <view class="stat-icon-bg stat-icon-blue">
            <text class="stat-icon">📚</text>
          </view>
          <text class="stat-label">总学分</text>
          <text class="stat-value">{{ totalCredits }}</text>
        </view>
        <view class="stat-card">
          <view class="stat-icon-bg stat-icon-green">
            <text class="stat-icon">🏆</text>
          </view>
          <text class="stat-label">平均绩点</text>
          <text class="stat-value">{{ averageGpa }}</text>
        </view>
      </view>

      <!-- 成绩列表 -->
      <view v-if="!loading && grades.length > 0" class="grade-list">
        <view 
          v-for="(grade, index) in grades" 
          :key="index" 
          class="grade-card"
        >
          <!-- 卡片常驻显示区域 -->
          <view class="grade-card-header" @click="toggleExpand(index)">
            <view class="grade-info">
              <text class="grade-name">{{ grade.courseName }}</text>
              <view class="grade-tags">
                <text class="grade-tag tag-category">{{ grade.category }}</text>
                <text v-if="grade.status && grade.status !== '已发布'" class="grade-tag tag-status">{{ grade.status }}</text>
              </view>
            </view>
            <view class="grade-credits">
              <text class="credits-value">{{ grade.credit }}</text>
              <text class="credits-unit">学分</text>
            </view>
          </view>

          <view class="grade-scores" @click="toggleExpand(index)">
            <view class="score-item">
              <text class="score-label">总评</text>
              <text class="score-value" :class="getScoreColor(grade.totalScore)">
                {{ grade.totalScore || grade.finalGrade || '-' }}
              </text>
            </view>
            <view class="score-item">
              <text class="score-label">绩点</text>
              <text class="score-value score-normal">{{ grade.gpa ? grade.gpa.toFixed(1) : '-' }}</text>
            </view>
            <view class="expand-btn">
              <text class="expand-icon">{{ expandedCard === index ? '▲' : '▼' }}</text>
            </view>
          </view>

          <!-- 卡片折叠详情区域 -->
          <view v-if="expandedCard === index" class="grade-details">
            <view class="detail-item">
              <text class="detail-label">平时成绩</text>
              <text class="detail-value">{{ grade.dailyScore || '-' }}</text>
            </view>
            <view class="detail-item">
              <text class="detail-label">期中成绩</text>
              <text class="detail-value">{{ grade.midtermScore || '-' }}</text>
            </view>
            <view class="detail-item">
              <text class="detail-label">期末成绩</text>
              <text class="detail-value">{{ grade.finalScore || '-' }}</text>
            </view>
            <view class="detail-item">
              <text class="detail-label">实验成绩</text>
              <text class="detail-value">{{ grade.labScore || '-' }}</text>
            </view>
            <view class="detail-item">
              <text class="detail-label">最终成绩</text>
              <text class="detail-value">{{ grade.finalGrade || '-' }}</text>
            </view>
            <view class="detail-item">
              <text class="detail-label">课程状态</text>
              <text class="detail-value">{{ grade.status || '-' }}</text>
            </view>
            <view class="detail-item">
              <text class="detail-label">课程代码</text>
              <text class="detail-value">{{ grade.courseCode || '-' }}</text>
            </view>
            <view class="detail-item">
              <text class="detail-label">课程序号</text>
              <text class="detail-value">{{ grade.courseSeq || '-' }}</text>
            </view>
          </view>
        </view>

        <view class="list-footer">
          <text class="footer-text">没有更多数据了</text>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="!loading && grades.length === 0" class="empty-state">
        <text class="empty-icon">📊</text>
        <text class="empty-text">{{ emptyMessage }}</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { Grade } from '@/types/grade';
import { fetchGrades, getCachedGrades, cacheGrades } from '@/utils/grade';

interface Semester {
  id: number;
  schoolYear: string;
  name: string;
}

const loading = ref(false);
const semesters = ref<Semester[]>([]);
const semesterIndex = ref(0);
const grades = ref<Grade[]>([]);
const expandedCard = ref<number | null>(null);
const isLoadingSemesters = ref(false);

// 学期列表（用于picker选择器）
const semesterList = computed(() => semesters.value.map(s => ({
  id: s.id,
  label: `${s.schoolYear} 学期${s.name}`
})));

// 当前学期标签
const currentSemesterLabel = computed(() => {
  if (semesters.value.length === 0) return '';
  const current = semesters.value[semesterIndex.value];
  return current ? `${current.schoolYear} 学期${current.name}` : '';
});

// 空状态消息
const emptyMessage = computed(() => {
  if (semesters.value.length === 0) return '正在加载学期列表...';
  return '暂无成绩数据';
});

// 总学分
const totalCredits = computed(() => {
  return grades.value.reduce((sum, g) => sum + g.credit, 0).toFixed(1);
});

// 平均绩点
const averageGpa = computed(() => {
  const validGrades = grades.value.filter(g => g.gpa !== null && g.credit > 0);
  if (validGrades.length === 0) return '-';
  
  let totalPoints = 0;
  let totalCredits = 0;
  
  for (const g of validGrades) {
    totalPoints += (g.gpa || 0) * g.credit;
    totalCredits += g.credit;
  }
  
  return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '-';
});

onMounted(async () => {
  if (isLoadingSemesters.value) {
    console.log('[Score] Already loading semesters, skipping');
    return;
  }
  isLoadingSemesters.value = true;
  try {
    await loadSemesters();
  } finally {
    isLoadingSemesters.value = false;
  }
});

async function loadSemesters() {
  loading.value = true;
  try {
    const cachedSemesters = uni.getStorageSync('history_semesters');
    
    if (cachedSemesters && cachedSemesters.semesters) {
      semesters.value = cachedSemesters.semesters.map(s => ({
        id: s.id,
        schoolYear: s.schoolYear,
        name: s.name
      })).reverse();
      
      if (semesters.value.length > 0) {
        semesterIndex.value = 0;
        await loadGrades(semesters.value[0].id);
      }
    } else {
      const cachedUser = uni.getStorageSync('userInfo');
      if (!cachedUser) {
        uni.showToast({ title: '请先登录', icon: 'none' });
        loading.value = false;
        return;
      }
      
      const { username, password } = JSON.parse(cachedUser);
      if (!username || !password) {
        uni.showToast({ title: '请先登录', icon: 'none' });
        loading.value = false;
        return;
      }
      
      const { SiasCrawler } = await import('@/utils/crawler');
      const crawler = new SiasCrawler(username, password);
      
      const loginOk = await crawler.login();
      if (!loginOk) {
        uni.showToast({ title: '登录失败', icon: 'none' });
        loading.value = false;
        return;
      }
      
      await crawler.autoDetect();
      
      const fetchOk = await crawler.fetchSemesters();
      if (!fetchOk) {
        uni.showToast({ title: '获取学期列表失败', icon: 'none' });
        loading.value = false;
        return;
      }
      
      const rawSemesters = crawler.getSemesters();
      semesters.value = rawSemesters.map(s => ({
        id: s.id,
        schoolYear: s.schoolYear,
        name: s.name
      })).reverse();
      
      uni.setStorageSync('history_semesters', {
        semesters: rawSemesters,
        lastFetchTime: Date.now()
      });
      
      if (semesters.value.length > 0) {
        semesterIndex.value = 0;
        await loadGrades(semesters.value[0].id);
      }
    }
  } catch (e: any) {
    console.error('[Score] Load semesters failed:', e);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function loadGrades(semesterId: number) {
  loading.value = true;
  grades.value = [];
  
  try {
    const cachedGrades = getCachedGrades(semesterId);
    if (cachedGrades) {
      grades.value = cachedGrades;
      loading.value = false;
      return;
    }
    
    const cachedUser = uni.getStorageSync('userInfo');
    if (!cachedUser) {
      uni.showToast({ title: '请先登录', icon: 'none' });
      loading.value = false;
      return;
    }
    
    const { username, password } = JSON.parse(cachedUser);
    if (!username || !password) {
      uni.showToast({ title: '请先登录', icon: 'none' });
      loading.value = false;
      return;
    }
    
    const gradeList = await fetchGrades(username, password, semesterId);
    grades.value = gradeList;
    
    cacheGrades(semesterId, gradeList);
  } catch (e: any) {
    console.error('[Score] Load grades failed:', e);
    uni.showToast({ title: e.message || '获取成绩失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function onSemesterChange(e: any) {
  const index = e.detail.value;
  semesterIndex.value = index;
  const semester = semesters.value[index];
  if (semester) {
    loadGrades(semester.id);
  }
}

function toggleExpand(index: number) {
  expandedCard.value = expandedCard.value === index ? null : index;
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'score-normal';
  if (score < 60) return 'score-low';
  if (score >= 90) return 'score-high';
  return 'score-normal';
}
</script>

<style scoped>
.score-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #F5F7FA;
  box-sizing: border-box;
  overflow: hidden;
}

.page-header {
  background: #FFFFFF;
  padding: 32rpx 40rpx;
  box-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.05);
  box-sizing: border-box;
}

.status-bar {
  height: var(--status-bar-height, 44rpx);
}

.page-title {
  font-size: 48rpx;
  font-weight: 700;
  color: #1a1a1a;
  margin-top: 16rpx;
}

.content-area {
  flex: 1;
  padding: 32rpx;
  box-sizing: border-box;
  overflow-x: hidden;
}

/* 学期选择器 */
.semester-selector {
  margin-bottom: 40rpx;
}

.semester-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #FFFFFF;
  padding: 24rpx 32rpx;
  border-radius: 24rpx;
  box-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.05);
  border: 2rpx solid rgba(255, 255, 255, 0.5);
  box-sizing: border-box;
}

.semester-text {
  font-size: 28rpx;
  color: #333333;
  font-weight: 500;
}

.semester-arrow {
  font-size: 24rpx;
  color: #888888;
}

/* 加载状态 */
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

/* 统计卡片 */
.stats-container {
  display: flex;
  gap: 32rpx;
  margin-bottom: 48rpx;
}

.stat-card {
  flex: 1;
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.05);
  border: 2rpx solid rgba(255, 255, 255, 0.5);
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}

.stat-icon-bg {
  position: absolute;
  right: -16rpx;
  top: -16rpx;
  width: 128rpx;
  height: 128rpx;
  border-radius: 50%;
  opacity: 0.1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon-blue {
  background: #3B82F6;
}

.stat-icon-green {
  background: #10B981;
}

.stat-icon {
  font-size: 64rpx;
  position: relative;
  z-index: 1;
}

.stat-label {
  font-size: 24rpx;
  color: #666666;
  margin-bottom: 8rpx;
  position: relative;
  z-index: 1;
}

.stat-value {
  font-size: 48rpx;
  font-weight: 700;
  color: #1a1a1a;
  position: relative;
  z-index: 1;
}

/* 成绩列表 */
.grade-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.grade-card {
  background: #FFFFFF;
  border-radius: 32rpx;
  box-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.05);
  border: 2rpx solid #f0f0f0;
  overflow: hidden;
  transition: all 0.3s ease;
  box-sizing: border-box;
}

.grade-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 32rpx;
  box-sizing: border-box;
}

.grade-info {
  flex: 1;
  margin-right: 24rpx;
  min-width: 0;
}

.grade-name {
  font-size: 32rpx;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 12rpx;
  display: block;
  word-break: break-all;
}

.grade-tags {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.grade-tag {
  font-size: 20rpx;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
}

.tag-category {
  background: #EFF6FF;
  color: #2563EB;
}

.tag-status {
  background: #FFF7ED;
  color: #EA580C;
}

.grade-credits {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.credits-value {
  font-size: 28rpx;
  font-weight: 600;
  color: #333333;
}

.credits-unit {
  font-size: 20rpx;
  color: #888888;
}

.grade-scores {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 0 32rpx 32rpx;
  box-sizing: border-box;
}

.score-item {
  display: flex;
  flex-direction: column;
  margin-right: 32rpx;
}

.score-label {
  font-size: 22rpx;
  color: #888888;
  margin-bottom: 4rpx;
}

.score-value {
  font-size: 48rpx;
  font-weight: 700;
}

.score-normal {
  color: #1a1a1a;
}

.score-low {
  color: #EF4444;
}

.score-high {
  color: #10B981;
}

.expand-btn {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F5F5F5;
  border-radius: 50%;
  flex-shrink: 0;
}

.expand-icon {
  font-size: 28rpx;
  color: #888888;
}

/* 成绩详情 */
.grade-details {
  background: #FAFAFB;
  border-top: 2rpx solid #f0f0f0;
  padding: 32rpx;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24rpx;
  box-sizing: border-box;
}

.detail-item {
  display: flex;
  flex-direction: column;
}

.detail-label {
  font-size: 22rpx;
  color: #888888;
  margin-bottom: 4rpx;
}

.detail-value {
  font-size: 28rpx;
  color: #333333;
  font-weight: 500;
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

/* 列表底部 */
.list-footer {
  text-align: center;
  padding: 32rpx 0;
}

.footer-text {
  font-size: 24rpx;
  color: #888888;
}
</style>
