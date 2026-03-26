<template>
  <view class="score-page">
    <!-- 顶部标题栏 -->
    <view class="page-header">
      <view class="status-bar"></view>
      <view class="header-row">
        <text class="page-title">成绩</text>
      </view>
      <!-- 学期选择器 (黑色胶囊) -->
      <view class="semester-row">
        <picker @change="onSemesterChange" :value="semesterIndex" :range="semesterList" range-key="label">
          <view class="semester-pill">
            <text class="semester-pill-text">{{ currentSemesterLabel || '选择学期' }}</text>
            <view class="pill-chevron"></view>
          </view>
        </picker>
      </view>
    </view>

    <!-- 可滚动的主体内容区域 -->
    <scroll-view class="content-area" scroll-y :show-scrollbar="false">

      <!-- 加载状态 -->
      <view v-if="loading" class="loading-container">
        <view class="loading-spinner"></view>
        <text class="loading-text">加载中...</text>
      </view>

      <template v-else-if="grades.length > 0">
        <!-- 统计面板 -->
        <view class="stats-row">
          <view class="stat-card">
            <text class="stat-sup">Total Credits</text>
            <text class="stat-sub">总学分</text>
            <text class="stat-num">{{ totalCredits }}</text>
          </view>
          <view class="stat-card">
            <text class="stat-sup">Average GPA</text>
            <text class="stat-sub">平均绩点</text>
            <text class="stat-num">{{ averageGpa }}</text>
          </view>
        </view>

        <!-- 成绩列表 -->
        <view class="grade-list">
          <view
            v-for="(grade, index) in grades"
            :key="index"
            class="grade-card"
            :class="{ 'grade-card-expanded': expandedCard === index }"
            @click="toggleExpand(index)"
          >
            <!-- 顶部区域: 课名 + 分数 -->
            <view class="card-top">
              <view class="card-left">
                <text class="course-name">{{ grade.courseName }}</text>
                <view class="tag-row">
                  <text class="course-tag">{{ grade.category }}</text>
                </view>
              </view>
              <view class="card-right">
                <text class="big-score" :class="getScoreColor(grade.totalScore)">
                  {{ grade.totalScore || grade.finalGrade || '-' }}
                </text>
                <text class="score-sup">Score</text>
              </view>
            </view>

            <!-- 底部区域: 学分 / 绩点 + 展开按钮 -->
            <view class="card-bottom">
              <view class="meta-group">
                <view class="meta-item">
                  <text class="meta-label">Credits</text>
                  <text class="meta-value">{{ grade.credit }}</text>
                </view>
                <view class="meta-divider"></view>
                <view class="meta-item">
                  <text class="meta-label">GPA</text>
                  <text class="meta-value">{{ grade.gpa ? grade.gpa.toFixed(1) : '-' }}</text>
                </view>
              </view>
              <view class="expand-btn" :class="{ 'expand-btn-active': expandedCard === index }">
                <view class="chevron-icon"></view>
              </view>
            </view>

            <!-- 折叠详情 -->
            <view v-if="expandedCard === index" class="detail-panel" @click.stop>
              <view class="detail-inner">
                <!-- 课程状态 -->
                <view class="detail-status-row">
                  <text class="detail-status-label">课程状态</text>
                  <text class="detail-status-badge">{{ grade.status || '-' }}</text>
                </view>
                <!-- 分数明细 -->
                <view class="detail-grid">
                  <view class="detail-cell">
                    <text class="cell-label">平时成绩</text>
                    <text class="cell-value">{{ grade.dailyScore || '-' }}</text>
                  </view>
                  <view class="detail-cell">
                    <text class="cell-label">期中成绩</text>
                    <text class="cell-value">{{ grade.midtermScore || '-' }}</text>
                  </view>
                  <view class="detail-cell">
                    <text class="cell-label">实验成绩</text>
                    <text class="cell-value">{{ grade.labScore || '-' }}</text>
                  </view>
                  <view class="detail-cell">
                    <text class="cell-label">期末成绩</text>
                    <text class="cell-value">{{ grade.finalScore || '-' }}</text>
                  </view>
                </view>
                <!-- 课程编码 -->
                <view class="detail-codes">
                  <view class="code-row">
                    <text class="code-label">Course Code</text>
                    <text class="code-value">{{ grade.courseCode || '-' }}</text>
                  </view>
                  <view class="code-row">
                    <text class="code-label">Sequence</text>
                    <text class="code-value">{{ grade.courseSeq || '-' }}</text>
                  </view>
                </view>
              </view>
            </view>
          </view>

          <view class="list-footer">
            <text class="footer-text">没有更多数据了</text>
          </view>
        </view>
      </template>

      <!-- 空状态 -->
      <view v-if="!loading && grades.length === 0" class="empty-state">
        <text class="empty-text">{{ emptyMessage }}</text>
      </view>
    </scroll-view>

    <TabBar current="score" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { Grade } from '@/types/grade';
import TabBar from '@/components/TabBar.vue';
import { fetchGrades, getCachedGrades, cacheGrades } from '@/utils/grade';
import { readPassword } from '@/utils/crypto';

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
      semesters.value = cachedSemesters.semesters.map((s: { id: number; schoolYear: string; name: string }) => ({
        id: s.id,
        schoolYear: s.schoolYear,
        name: s.name
      })).reverse();
      
      if (semesters.value.length > 1) {
        semesterIndex.value = 1;
        await loadGrades(semesters.value[1].id);
      } else if (semesters.value.length > 0) {
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
      
      const { username, password: storedPwd } = JSON.parse(cachedUser);
      const password = readPassword(storedPwd, username);
      if (!username || !password) {
        uni.showToast({ title: '请先登录', icon: 'none' });
        loading.value = false;
        return;
      }
      
      const { getCrawler } = await import('@/utils/session');
      const crawler = await getCrawler(username, password);
      
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
      
      if (semesters.value.length > 1) {
        semesterIndex.value = 1;
        await loadGrades(semesters.value[1].id);
      } else if (semesters.value.length > 0) {
        semesterIndex.value = 0;
        await loadGrades(semesters.value[0].id);
      }
    }
  } catch (e: unknown) {
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
    
    const { username, password: storedPwd } = JSON.parse(cachedUser);
    const password = readPassword(storedPwd, username);
    if (!username || !password) {
      uni.showToast({ title: '请先登录', icon: 'none' });
      loading.value = false;
      return;
    }
    
    const gradeList = await fetchGrades(username, password, semesterId);
    grades.value = gradeList;
    
    cacheGrades(semesterId, gradeList);
  } catch (e: unknown) {
    console.error('[Score] Load grades failed:', e);
    uni.showToast({ title: e instanceof Error ? e.message : '获取成绩失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function onSemesterChange(e: { detail: { value: number } }) {
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
  background: #FFFFFF;
  box-sizing: border-box;
  overflow: hidden;
}

/* ===== Header ===== */
.page-header {
  background: #FFFFFF;
  padding: 0 40rpx 24rpx;
}

.status-bar {
  height: var(--status-bar-height, 44rpx);
}

.header-row {
  margin-bottom: 20rpx;
}

.page-title {
  font-size: 52rpx;
  font-weight: 900;
  color: #000000;
  letter-spacing: -2rpx;
}

/* ===== Semester pill ===== */
.semester-row {
  margin-bottom: 4rpx;
}

.semester-pill {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  background: #0A0A0A;
  padding: 16rpx 32rpx;
  border-radius: 60rpx;
}

.semester-pill-text {
  font-size: 24rpx;
  font-weight: 700;
  color: #FFFFFF;
  letter-spacing: 1rpx;
}

.pill-chevron {
  width: 12rpx;
  height: 12rpx;
  border-right: 3rpx solid #FFFFFF;
  border-bottom: 3rpx solid #FFFFFF;
  transform: rotate(45deg);
  margin-top: -4rpx;
}

/* ===== Scrollable content ===== */
.content-area {
  flex: 1;
  height: 0;
  padding-bottom: 160rpx;
}

/* ===== Loading ===== */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;
  gap: 16rpx;
}

.loading-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid #EAEAEA;
  border-top-color: #0A0A0A;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 26rpx;
  color: #999999;
}

/* ===== Stats row ===== */
.stats-row {
  display: flex;
  gap: 20rpx;
  padding: 24rpx 32rpx 8rpx;
}

.stat-card {
  flex: 1;
  background: #F9FAFB;
  border-radius: 28rpx;
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  border: 2rpx solid #F3F4F6;
}

.stat-sup {
  font-size: 18rpx;
  font-weight: 700;
  color: #9CA3AF;
  letter-spacing: 2rpx;
  text-transform: uppercase;
  margin-bottom: 4rpx;
}

.stat-sub {
  font-size: 24rpx;
  font-weight: 600;
  color: #6B7280;
  margin-bottom: 12rpx;
}

.stat-num {
  font-size: 72rpx;
  font-weight: 900;
  color: #0A0A0A;
  letter-spacing: -4rpx;
  line-height: 1;
}

/* ===== Grade list ===== */
.grade-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 28rpx 32rpx 0;
}

.grade-card {
  border-radius: 28rpx;
  border: 2rpx solid #E5E7EB;
  overflow: hidden;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

.grade-card-expanded {
  border-color: #0A0A0A;
  box-shadow: 0 8rpx 32rpx -12rpx rgba(0, 0, 0, 0.12);
}

/* ===== Card top ===== */
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 32rpx 32rpx 0;
}

.card-left {
  flex: 1;
  min-width: 0;
  padding-right: 24rpx;
}

.course-name {
  font-size: 34rpx;
  font-weight: 700;
  color: #0A0A0A;
  letter-spacing: -1rpx;
  margin-bottom: 12rpx;
  display: block;
  word-break: break-all;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.course-tag {
  display: inline-block;
  font-size: 18rpx;
  font-weight: 700;
  color: #6B7280;
  background: #F3F4F6;
  padding: 6rpx 16rpx;
  border-radius: 10rpx;
}

.card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.big-score {
  font-size: 56rpx;
  font-weight: 900;
  letter-spacing: -3rpx;
  line-height: 1;
}

.score-sup {
  font-size: 18rpx;
  font-weight: 700;
  color: #9CA3AF;
  letter-spacing: 2rpx;
  text-transform: uppercase;
  margin-top: 4rpx;
}

.score-normal { color: #0A0A0A; }
.score-low { color: #EF4444; }
.score-high { color: #10B981; }

/* ===== Card bottom ===== */
.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx 28rpx;
}

.meta-group {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.meta-item {
  display: flex;
  flex-direction: column;
}

.meta-label {
  font-size: 18rpx;
  font-weight: 700;
  color: #9CA3AF;
  letter-spacing: 2rpx;
  text-transform: uppercase;
}

.meta-value {
  font-size: 26rpx;
  font-weight: 700;
  color: #0A0A0A;
  margin-top: 2rpx;
}

.meta-divider {
  width: 2rpx;
  height: 44rpx;
  background: #E5E7EB;
}

/* ===== Expand button ===== */
.expand-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F3F4F6;
  border-radius: 50%;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.expand-btn-active {
  background: #0A0A0A;
}

.chevron-icon {
  width: 16rpx;
  height: 16rpx;
  border-right: 3rpx solid #6B7280;
  border-bottom: 3rpx solid #6B7280;
  transform: rotate(45deg);
  margin-top: -6rpx;
  transition: border-color 0.3s ease;
}

.expand-btn-active .chevron-icon {
  border-color: #FFFFFF;
  transform: rotate(-135deg);
  margin-top: 4rpx;
}

/* ===== Detail panel ===== */
.detail-panel {
  padding: 0 32rpx 32rpx;
}

.detail-inner {
  background: #F9FAFB;
  border-radius: 20rpx;
  padding: 28rpx;
  border: 2rpx solid #F3F4F6;
}

/* Status row */
.detail-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20rpx;
  border-bottom: 2rpx solid #E5E7EB;
  margin-bottom: 20rpx;
}

.detail-status-label {
  font-size: 22rpx;
  font-weight: 600;
  color: #6B7280;
}

.detail-status-badge {
  font-size: 22rpx;
  font-weight: 700;
  color: #0A0A0A;
  background: #FFFFFF;
  border: 2rpx solid #E5E7EB;
  padding: 6rpx 16rpx;
  border-radius: 10rpx;
}

/* Score grid */
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx 40rpx;
}

.detail-cell {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-bottom: 2rpx dashed #E5E7EB;
  padding-bottom: 8rpx;
}

.cell-label {
  font-size: 22rpx;
  font-weight: 500;
  color: #6B7280;
}

.cell-value {
  font-size: 26rpx;
  font-weight: 700;
  color: #0A0A0A;
}

/* Code section */
.detail-codes {
  margin-top: 24rpx;
  padding-top: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.code-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.code-label {
  font-size: 18rpx;
  font-weight: 700;
  color: #9CA3AF;
  letter-spacing: 1rpx;
  text-transform: uppercase;
}

.code-value {
  font-size: 20rpx;
  font-weight: 500;
  color: #6B7280;
  font-family: monospace;
  background: #FFFFFF;
  border: 2rpx solid #E5E7EB;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

/* ===== Empty state ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #9CA3AF;
}

/* ===== Footer ===== */
.list-footer {
  text-align: center;
  padding: 40rpx 0 24rpx;
}

.footer-text {
  font-size: 22rpx;
  color: #D1D5DB;
}
</style>
