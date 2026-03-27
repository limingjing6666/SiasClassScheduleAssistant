<template>
  <view class="history-page">
    <!-- 头部 -->
    <view class="page-header">
      <view class="status-bar"></view>
      <view class="header-main">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">‹</text>
        </view>
        <text class="page-title">历史课表</text>
        <view class="placeholder"></view>
      </view>
    </view>

    <!-- 学期选择器 -->
    <view class="semester-bar">
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

    <!-- 课表内容 -->
    <ScheduleGrid
      v-else-if="courses.length > 0"
      :courses="displayCourses"
      detail-mode
      @course-click="showCourseDetail"
    />

    <!-- 空状态 -->
    <view v-else class="empty-state">
      <text class="empty-icon">📚</text>
      <text class="empty-text">{{ emptyMessage }}</text>
    </view>

    <!-- 课程详情弹窗 -->
    <CourseDetailModal
      v-if="showDetail && selectedCourse"
      :course="selectedCourse"
      @close="closeDetail"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { Course, RenderCourse } from '@/types';
import { toRenderCourses } from '@/utils/schedule';
import { readPassword } from '@/utils/crypto';
import { getCrawler } from '@/utils/session';
import CourseDetailModal from '@/components/CourseDetailModal.vue';
import ScheduleGrid from '@/components/ScheduleGrid.vue';

interface Semester {
  id: number;
  schoolYear: string;
  name: string;
  label: string;
}

const loading = ref(false);
const semesters = ref<Semester[]>([]);
const semesterIndex = ref(0);
const courses = ref<Course[]>([]);
const showDetail = ref(false);
const selectedCourse = ref<RenderCourse | null>(null);
const isLoadingSemesters = ref(false);  // 防止重复加载
const currentSemesterId = ref<string | null>(null);  // 当前学期ID

onMounted(async () => {
  // 防止重复加载
  if (isLoadingSemesters.value) {
    console.log('[History] Already loading semesters, skipping');
    return;
  }
  isLoadingSemesters.value = true;
  try {
    await loadSemesters();
  } finally {
    isLoadingSemesters.value = false;
  }
});

// 学期列表（用于picker选择器，过滤掉当前学期）
const semesterList = computed(() => {
  let filteredSemesters = semesters.value;
  
  console.log('[History] currentSemesterId:', currentSemesterId.value);
  console.log('[History] semesters count before filter:', semesters.value.length);
  
  // 如果有当前学期ID，过滤掉当前学期
  if (currentSemesterId.value) {
    filteredSemesters = semesters.value.filter(s => s.id !== Number(currentSemesterId.value));
    console.log('[History] semesters count after filter:', filteredSemesters.length);
  }
  
  return filteredSemesters.map(s => ({
    id: s.id,
    label: `${s.schoolYear} 学期${s.name}`
  }));
});

// 当前学期标签（必须从 semesterList 取，与 picker 的 range 一致）
const currentSemesterLabel = computed(() => {
  const list = semesterList.value;
  if (list.length === 0) return '';
  const current = list[semesterIndex.value];
  return current ? current.label : '';
});

const emptyMessage = computed(() => {
  if (semesters.value.length === 0) return '正在加载学期列表...';
  return '暂无课程数据';
});

const displayCourses = computed(() => {
  console.log('[History] Computing displayCourses, courses count:', courses.value.length);
  return toRenderCourses(courses.value);
});

async function loadSemesters() {
  loading.value = true;
  try {
    // 步骤1: 检查本地缓存的学期列表
    const cachedSemesters = uni.getStorageSync('history_semesters');
    
    // 如果有缓存且未过期（24小时），直接使用
    if (cachedSemesters && cachedSemesters.lastFetchTime) {
      const cacheAge = Date.now() - cachedSemesters.lastFetchTime;
      const cacheExpiry = 24 * 60 * 60 * 1000; // 24小时过期
      
      if (cacheAge < cacheExpiry) {
        console.log('[History] Using cached semesters, age:', Math.round(cacheAge / 1000 / 60), 'minutes');
        semesters.value = cachedSemesters.semesters.map((s: { id: number; schoolYear: string; name: string }) => ({
          id: s.id,
          schoolYear: s.schoolYear,
          name: s.name,
          label: `${s.schoolYear} 学期${s.name}`
        })).reverse();
        
        if (semesters.value.length > 0) {
          semesterIndex.value = 0;
          // 从过滤后的列表取第一个学期
          const firstItem = semesterList.value[0];
          if (firstItem) {
            await loadCourses(firstItem.id);
          }
        }
        loading.value = false;
        return;
      }
    }
    
    // 步骤2: 没有缓存或缓存过期，重新获取
    const cachedUser = uni.getStorageSync('userInfo');
    console.log('[History] cachedUser:', cachedUser);
    
    if (!cachedUser) {
      console.log('[History] No cached user found');
      uni.showToast({ title: '请先登录', icon: 'none' });
      loading.value = false;
      return;
    }
    
    const { username, password: storedPwd } = JSON.parse(cachedUser);
    const password = readPassword(storedPwd, username);
    
    if (!username || !password) {
      console.log('[History] Missing username or password');
      uni.showToast({ title: '请先登录', icon: 'none' });
      loading.value = false;
      return;
    }

    const crawler = await getCrawler(username, password);

    // 获取当前学期ID
    currentSemesterId.value = crawler.getCurrentSemesterId();
    console.log('[History] Current semester ID:', currentSemesterId.value);

    // 获取学期列表
    const fetchOk = await crawler.fetchSemesters();
    if (!fetchOk) {
      uni.showToast({ title: '获取学期列表失败', icon: 'none' });
      return;
    }

    // 转换学期列表格式
    const rawSemesters = crawler.getSemesters();
    semesters.value = rawSemesters.map(s => ({
      id: s.id,
      schoolYear: s.schoolYear,
      name: s.name,
      label: `${s.schoolYear} 学期${s.name}`
    })).reverse();

    // 保存到本地缓存
    uni.setStorageSync('history_semesters', {
      semesters: rawSemesters,
      lastFetchTime: Date.now()
    });

    // 默认选择第一个（过滤后的最新学期）
    if (semesterList.value.length > 0) {
      semesterIndex.value = 0;
      await loadCourses(semesterList.value[0].id);
    }
  } catch (e: unknown) {
    console.error('[History] Load semesters failed:', e);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function loadCourses(semesterId: number) {
  loading.value = true;
  courses.value = [];

  try {
    // 步骤1: 检查课表缓存
    const courseCacheKey = `history_courses_${semesterId}`;
    const cachedCourses = uni.getStorageSync(courseCacheKey);
    
    // 如果有缓存且未过期（24小时），直接使用
    if (cachedCourses && cachedCourses.lastFetchTime) {
      const cacheAge = Date.now() - cachedCourses.lastFetchTime;
      const cacheExpiry = 24 * 60 * 60 * 1000; // 24小时过期
      
      if (cacheAge < cacheExpiry) {
        console.log('[History] Using cached courses for semester:', semesterId, 'age:', Math.round(cacheAge / 1000 / 60), 'minutes');
        courses.value = cachedCourses.courses;
        loading.value = false;
        return;
      }
    }
    
    // 步骤2: 通过 session 复用获取课表（无需重复 login）
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

    const crawler = await getCrawler(username, password);
    const courseList = await crawler.getData(String(semesterId));
    courses.value = courseList;

    // 保存课表到缓存
    uni.setStorageSync(courseCacheKey, {
      courses: courseList,
      lastFetchTime: Date.now()
    });
  } catch (e: unknown) {
    console.error('[History] Load courses failed:', e);
    uni.showToast({ title: '获取课表失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- uni-app picker event
function onSemesterChange(e: { detail: { value: number } }) {
  const index = e.detail.value;
  semesterIndex.value = index;
  // 必须从 semesterList（过滤后）取 id，与 picker 的 range 一致
  const item = semesterList.value[index];
  if (item) {
    loadCourses(item.id);
  }
}

function goBack() {
  uni.navigateBack();
}

function showCourseDetail(course: RenderCourse) {
  selectedCourse.value = course;
  showDetail.value = true;
}

function closeDetail() {
  showDetail.value = false;
  selectedCourse.value = null;
}
</script>

<style scoped>
.history-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #F4F4F5;
  background-image: radial-gradient(#D4D4D8 1.5px, transparent 1.5px);
  background-size: 20px 20px;
}

.page-header {
  background: #FFFFFF;
  border-bottom: 3rpx solid #000000;
}

.status-bar {
  height: var(--status-bar-height, 44rpx);
}

.header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 32rpx;
}

.back-btn {
  width: 52rpx;
  height: 52rpx;
  background: #000000;
  border: 3rpx solid #000000;
  border-radius: 14rpx;
  box-shadow: 3rpx 3rpx 0 #000000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-btn:active {
  transform: translate(2rpx, 2rpx);
  box-shadow: 1rpx 1rpx 0 #000000;
}

.back-icon {
  font-size: 36rpx;
  color: #FFFFFF;
  font-weight: 900;
}

.page-title {
  font-size: 36rpx;
  font-weight: 900;
  color: #000000;
}

.placeholder {
  width: 52rpx;
}

/* 学期选择器 */
.semester-bar {
  padding: 16rpx 24rpx;
}

.semester-picker {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  background: #000000;
  padding: 14rpx 28rpx;
  border-radius: 14rpx;
  border: 3rpx solid #000000;
  box-shadow: 3rpx 3rpx 0 #000000;
}

.semester-text {
  font-size: 24rpx;
  color: #FFFFFF;
  font-weight: 900;
  letter-spacing: 1rpx;
}

.semester-arrow {
  font-size: 18rpx;
  color: #FFFFFF;
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
  color: #999999;
  font-weight: 700;
}
</style>
