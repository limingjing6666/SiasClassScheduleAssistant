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
  background: #F4F4F5;
  background-image: radial-gradient(#D4D4D8 1.5px, transparent 1.5px);
  background-size: 20px 20px;
  display: flex;
  flex-direction: column;
}

.page-header {
  background: #FFFFFF;
  padding: 0 24rpx 16rpx;
  border-bottom: 3rpx solid #000000;
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
  font-size: 48rpx;
  color: #000000;
  font-weight: 900;
  line-height: 1;
  padding-right: 8rpx;
}

.page-title {
  font-size: 40rpx;
  font-weight: 900;
  color: #000000;
}

/* 筛选栏 */
.filter-bar {
  padding: 20rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.filter-label {
  font-size: 22rpx;
  font-weight: 900;
  color: #999999;
  letter-spacing: 2rpx;
  padding-left: 4rpx;
}

.filter-picker {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  background: #000000;
  padding: 14rpx 28rpx;
  border-radius: 14rpx;
  border: 3rpx solid #000000;
  box-shadow: 3rpx 3rpx 0 #000000;
}

.filter-value {
  font-size: 24rpx;
  color: #FFFFFF;
  font-weight: 900;
  letter-spacing: 1rpx;
}

.filter-arrow {
  font-size: 18rpx;
  color: #FFFFFF;
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
  border: 5rpx solid #F0F0F0;
  border-top-color: #55EFC4;
  border-right-color: #55EFC4;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 26rpx;
  color: #999999;
  font-weight: 700;
}

/* 内容区 */
.content {
  flex: 1;
  height: 0;
}

.section {
  padding: 28rpx 24rpx 0;
}

.section-title {
  display: inline-block;
  font-size: 22rpx;
  font-weight: 900;
  color: #000000;
  letter-spacing: 4rpx;
  background: #74B9FF;
  border: 3rpx solid #000000;
  padding: 6rpx 20rpx;
  box-shadow: 3rpx 3rpx 0 #000000;
  transform: rotate(-2deg);
  margin-bottom: 20rpx;
}

/* 考试卡片 */
.exam-card {
  background: #FFFFFF;
  border: 3rpx solid #000000;
  border-radius: 24rpx;
  box-shadow: 4rpx 4rpx 0 #000000;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-sizing: border-box;
  margin-right: 6rpx;
}

.exam-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.exam-name {
  font-size: 30rpx;
  font-weight: 900;
  color: #000000;
  flex: 1;
  margin-right: 16rpx;
}

.exam-type-tag {
  font-size: 20rpx;
  font-weight: 900;
  color: #000000;
  background: #FFEAA7;
  border: 2rpx solid #000000;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
}

.exam-details {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.exam-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.exam-label {
  font-size: 22rpx;
  color: #999999;
  font-weight: 700;
  width: 80rpx;
  flex-shrink: 0;
}

.exam-value {
  font-size: 26rpx;
  font-weight: 700;
  color: #000000;
}

.exam-seat {
  font-size: 30rpx;
  font-weight: 900;
  color: #000000;
}

.exam-pending {
  padding: 16rpx 0;
}

.exam-pending-text {
  font-size: 26rpx;
  color: #BBBBBB;
  font-weight: 700;
}

.exam-footer {
  margin-top: 16rpx;
  padding-top: 12rpx;
  border-top: 2rpx dashed #E5E7EB;
}

.exam-status {
  font-size: 22rpx;
  color: #999999;
  font-weight: 700;
}

/* 不排考考试 */
.unscheduled-list {
  background: #FFFFFF;
  border: 3rpx solid #000000;
  border-radius: 24rpx;
  box-shadow: 4rpx 4rpx 0 #000000;
  overflow: hidden;
  margin-right: 6rpx;
}

.unscheduled-item {
  padding: 24rpx 28rpx;
  border-bottom: 2rpx solid #000000;
}

.unscheduled-item:last-child {
  border-bottom: none;
}

.unscheduled-name {
  font-size: 28rpx;
  color: #000000;
  font-weight: 700;
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
  font-weight: 900;
}

.empty-text {
  font-size: 28rpx;
  color: #999999;
  font-weight: 700;
}

.retry-btn {
  margin-top: 24rpx;
  padding: 16rpx 48rpx;
  background: #000000;
  border: 3rpx solid #000000;
  border-radius: 14rpx;
  box-shadow: 3rpx 3rpx 0 #000000;
}

.retry-btn:active {
  transform: translate(2rpx, 2rpx);
  box-shadow: 1rpx 1rpx 0 #000000;
}

.retry-text {
  font-size: 28rpx;
  color: #FFFFFF;
  font-weight: 900;
}
</style>
