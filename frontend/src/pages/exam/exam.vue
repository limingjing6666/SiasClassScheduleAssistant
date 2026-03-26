<template>
  <view class="page">
    <view class="page-header">
      <view class="status-bar"></view>
      <view class="header-row">
        <text class="back-btn" @click="goBack">&#8249;</text>
        <text class="page-title">我的考试</text>
      </view>
    </view>

    <!-- 筛选栏 -->
    <view class="filter-bar">
      <view class="filter-item">
        <text class="filter-label">学期</text>
        <picker @change="onSemesterChange" :value="semesterIndex" :range="semesterList" range-key="label">
          <view class="filter-picker">
            <text class="filter-value">{{ currentSemesterLabel || '选择学期' }}</text>
            <text class="filter-arrow">&#9660;</text>
          </view>
        </picker>
      </view>
      <view v-if="batches.length > 0" class="filter-item">
        <text class="filter-label">考试批次</text>
        <picker @change="onBatchPickerChange" :value="batchIndex" :range="batchPickerList" range-key="label">
          <view class="filter-picker">
            <text class="filter-value">{{ currentBatchLabel || '选择考试批次' }}</text>
            <text class="filter-arrow">&#9660;</text>
          </view>
        </picker>
      </view>
    </view>

    <!-- 加载态 -->
    <view v-if="loading" class="loading-container">
      <view class="loading-spinner"></view>
      <text class="loading-text">正在查询...</text>
    </view>

    <!-- 数据内容 -->
    <scroll-view v-else-if="hasData" class="content" scroll-y :show-scrollbar="false">
      <!-- 已排考考试 -->
      <view v-if="examData.scheduled.length > 0" class="section">
        <text class="section-title">已排考考试</text>
        <view v-for="(exam, idx) in examData.scheduled" :key="'s'+idx" class="exam-card">
          <view class="exam-header">
            <text class="exam-name">{{ exam.courseName }}</text>
            <text class="exam-type-tag">{{ exam.examType }}</text>
          </view>

          <view class="exam-details">
            <view class="exam-row" v-if="exam.date && !exam.date.includes('未安排')">
              <text class="exam-label">日期</text>
              <text class="exam-value">{{ exam.date }}</text>
            </view>
            <view class="exam-row" v-if="exam.time && !exam.time.includes('未安排')">
              <text class="exam-label">时间</text>
              <text class="exam-value">{{ exam.time }}</text>
            </view>
            <view class="exam-row" v-if="exam.room && !exam.room.includes('未安排')">
              <text class="exam-label">地点</text>
              <text class="exam-value">{{ exam.room }}</text>
            </view>
            <view class="exam-row" v-if="exam.seatNo && !exam.seatNo.includes('未安排')">
              <text class="exam-label">座位</text>
              <text class="exam-value exam-seat">{{ exam.seatNo }}</text>
            </view>
          </view>

          <!-- 未安排提示 -->
          <view v-if="exam.date && exam.date.includes('未安排')" class="exam-pending">
            <text class="exam-pending-text">考试时间和地点尚未安排</text>
          </view>

          <view class="exam-footer">
            <text class="exam-status">{{ exam.status }}</text>
          </view>
        </view>
      </view>

      <!-- 不排考考试 -->
      <view v-if="examData.unscheduled.length > 0" class="section">
        <text class="section-title">不排考考试</text>
        <view class="unscheduled-list">
          <view v-for="(exam, idx) in examData.unscheduled" :key="'u'+idx" class="unscheduled-item">
            <text class="unscheduled-name">{{ exam.courseName }}</text>
          </view>
        </view>
      </view>

      <view class="bottom-spacer"></view>
    </scroll-view>

    <!-- 空状态 -->
    <view v-else class="empty-state">
      <text class="empty-text-large">—</text>
      <text class="empty-text">{{ errorMsg || '当前批次暂无考试安排' }}</text>
      <view class="retry-btn" @click="retryLoad" v-if="errorMsg">
        <text class="retry-text">重试</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { ExamData, ExamBatch } from '@/types/exam';
import { fetchExamBatches, fetchExams, cacheExams } from '@/utils/exam';
import { getCrawler } from '@/utils/session';
import { readPassword } from '@/utils/crypto';

interface Semester {
  id: number;
  schoolYear: string;
  name: string;
}

const loading = ref(false);
const examData = ref<ExamData>({ scheduled: [], unscheduled: [] });
const errorMsg = ref('');
const semesters = ref<Semester[]>([]);
const semesterIndex = ref(0);
const batches = ref<ExamBatch[]>([]);
const batchIndex = ref(0);

const semesterList = computed(() => semesters.value.map(s => ({
  id: s.id,
  label: `${s.schoolYear} 学期${s.name}`
})));

const currentSemesterLabel = computed(() => {
  if (semesterList.value.length === 0) return '';
  return semesterList.value[semesterIndex.value]?.label || '';
});

const batchPickerList = computed(() => batches.value.map(b => ({
  id: b.id,
  label: b.name
})));

const currentBatchLabel = computed(() => {
  if (batches.value.length === 0) return '';
  return batches.value[batchIndex.value]?.name || '';
});

const hasData = computed(() =>
  examData.value.scheduled.length > 0 || examData.value.unscheduled.length > 0
);

function goBack() {
  uni.navigateBack();
}

function getUserInfo(): { username: string; password: string } | null {
  const cachedUser = uni.getStorageSync('userInfo');
  if (!cachedUser) return null;
  const { username, password: storedPwd } = JSON.parse(cachedUser);
  const password = readPassword(storedPwd, username);
  if (!username || !password) return null;
  return { username, password };
}

onMounted(async () => {
  await loadSemesters();
});

async function loadSemesters() {
  try {
    const cachedSemesters = uni.getStorageSync('history_semesters');
    if (cachedSemesters && cachedSemesters.semesters) {
      semesters.value = cachedSemesters.semesters.map((s: { id: number; schoolYear: string; name: string }) => ({
        id: s.id, schoolYear: s.schoolYear, name: s.name
      })).reverse();
    } else {
      const user = getUserInfo();
      if (!user) return;
      const crawler = await getCrawler(user.username, user.password);
      await crawler.fetchSemesters();
      const rawSemesters = crawler.getSemesters();
      semesters.value = rawSemesters.map(s => ({ id: s.id, schoolYear: s.schoolYear, name: s.name })).reverse();
      uni.setStorageSync('history_semesters', { semesters: rawSemesters, lastFetchTime: Date.now() });
    }
    if (semesters.value.length > 0) {
      semesterIndex.value = 0;
      await loadBatches(semesters.value[0].id);
    }
  } catch (e: unknown) {
    console.error('[Exam] Load semesters failed:', e);
    errorMsg.value = '加载学期列表失败';
  }
}

async function onSemesterChange(e: { detail: { value: number } }) {
  const index = e.detail.value;
  semesterIndex.value = index;
  const semester = semesterList.value[index];
  if (semester) {
    await loadBatches(semester.id);
  }
}

async function loadBatches(semesterId: number) {
  loading.value = true;
  errorMsg.value = '';
  batches.value = [];
  batchIndex.value = 0;
  examData.value = { scheduled: [], unscheduled: [] };

  try {
    const user = getUserInfo();
    if (!user) {
      errorMsg.value = '请先登录';
      loading.value = false;
      return;
    }

    const batchList = await fetchExamBatches(user.username, user.password, semesterId);
    batches.value = batchList;

    if (batchList.length === 0) {
      errorMsg.value = '当前学期暂无考试批次';
      loading.value = false;
      return;
    }

    // 默认选非缓考批次（优先选不含"缓考"关键词的）
    let defaultIdx = batchList.findIndex(b => !b.name.includes('缓考'));
    if (defaultIdx < 0) defaultIdx = 0;
    batchIndex.value = defaultIdx;

    await loadExamData(batchList[defaultIdx].id);
  } catch (e: unknown) {
    console.error('[Exam] Load batches failed:', e);
    errorMsg.value = e instanceof Error ? e.message : '获取考试批次失败';
    loading.value = false;
  }
}

async function onBatchPickerChange(e: { detail: { value: number } }) {
  const idx = e.detail.value;
  if (idx === batchIndex.value) return;
  batchIndex.value = idx;
  const batch = batches.value[idx];
  if (batch) {
    loading.value = true;
    examData.value = { scheduled: [], unscheduled: [] };
    await loadExamData(batch.id);
  }
}

async function loadExamData(batchId: number) {
  loading.value = true;
  errorMsg.value = '';

  try {
    const user = getUserInfo();
    if (!user) {
      errorMsg.value = '请先登录';
      loading.value = false;
      return;
    }

    const data = await fetchExams(user.username, user.password, batchId);
    examData.value = data;

    // 缓存当前学期第一个批次的数据
    if (data.scheduled.length > 0 || data.unscheduled.length > 0) {
      cacheExams(data);
    }
  } catch (e: unknown) {
    console.error('[Exam] Load exam data failed:', e);
    errorMsg.value = e instanceof Error ? e.message : '获取考试数据失败';
  } finally {
    loading.value = false;
  }
}

function retryLoad() {
  const semester = semesterList.value[semesterIndex.value];
  if (semester) {
    loadBatches(semester.id);
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #FFFFFF;
  display: flex;
  flex-direction: column;
}

.page-header {
  background: #FFFFFF;
  padding: 0 24rpx 16rpx;
  border-bottom: 1rpx solid #F0F0F0;
}

/* 筛选栏 */
.filter-bar {
  padding: 20rpx 24rpx;
  background: #FFFFFF;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.filter-label {
  font-size: 22rpx;
  font-weight: 600;
  color: #999999;
  letter-spacing: 1rpx;
  padding-left: 4rpx;
}

.filter-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #F8F8F8;
  padding: 20rpx 28rpx;
  border-radius: 16rpx;
}

.filter-value {
  font-size: 28rpx;
  color: #333333;
  font-weight: 600;
}

.filter-arrow {
  font-size: 22rpx;
  color: #999999;
}

.status-bar {
  height: var(--status-bar-height, 44rpx);
}

.header-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 0 8rpx;
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
  height: 0;
}

.section {
  padding: 32rpx 24rpx 0;
}

.section-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #999999;
  letter-spacing: 2rpx;
  text-transform: uppercase;
  margin-bottom: 24rpx;
  display: block;
}

/* 已排考考试卡片 */
.exam-card {
  background: #F8F8F8;
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
}

.exam-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.exam-name {
  font-size: 32rpx;
  font-weight: 800;
  color: #000000;
  flex: 1;
  margin-right: 16rpx;
}

.exam-type-tag {
  font-size: 22rpx;
  font-weight: 600;
  color: #666666;
  background: #EEEEEE;
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
}

.exam-details {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.exam-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.exam-label {
  font-size: 24rpx;
  color: #999999;
  font-weight: 600;
  width: 80rpx;
  flex-shrink: 0;
}

.exam-value {
  font-size: 28rpx;
  font-weight: 600;
  color: #333333;
}

.exam-seat {
  font-size: 32rpx;
  font-weight: 800;
  color: #000000;
}

.exam-pending {
  padding: 20rpx 0;
}

.exam-pending-text {
  font-size: 26rpx;
  color: #BBBBBB;
  font-weight: 500;
}

.exam-footer {
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #EEEEEE;
}

.exam-status {
  font-size: 24rpx;
  color: #999999;
  font-weight: 500;
}

/* 不排考考试 */
.unscheduled-list {
  background: #F8F8F8;
  border-radius: 24rpx;
  overflow: hidden;
}

.unscheduled-item {
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid #F0F0F0;
}

.unscheduled-item:last-child {
  border-bottom: none;
}

.unscheduled-name {
  font-size: 28rpx;
  color: #333333;
  font-weight: 500;
}

.bottom-spacer {
  height: 120rpx;
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

.empty-text-large {
  font-size: 56rpx;
  color: #CCCCCC;
  font-weight: 300;
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
