<template>
  <view class="history-page">
    <!-- 头部（与其他二级页统一左对齐漫画顶栏） -->
    <view class="page-header">
      <view class="status-bar"></view>
      <view class="header-row">
        <text class="back-btn" @click="goBack">&#8249;</text>
        <text class="page-title">历史课表</text>
      </view>
    </view>

    <!-- 学期选择器 -->
    <view class="semester-bar">
      <view class="semester-picker" @click="showSemesterPicker = true">
        <text class="semester-text">{{ currentSemesterLabel || '选择学期' }}</text>
        <text class="semester-arrow">▼</text>
      </view>
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

    <!-- 漫画风学期选择弹窗 -->
    <MangaPicker
      :visible="showSemesterPicker"
      title="选择历史学期"
      :options="semesterList"
      :selected-index="semesterIndex"
      @select="onSemesterSelect"
      @close="showSemesterPicker = false"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { Course, RenderCourse } from '@/types';
import { toRenderCourses } from '@/utils/schedule';
import { readPassword } from '@/utils/crypto';
import { getCrawler } from '@/utils/session';
import { loadSemesterOptions, type SemesterOption } from '@/utils/semester';
import CourseDetailModal from '@/components/CourseDetailModal.vue';
import MangaPicker from '@/components/MangaPicker.vue';
import ScheduleGrid from '@/components/ScheduleGrid.vue';

const loading = ref(false);
const semesterList = ref<SemesterOption[]>([]);
const semesterIndex = ref(0);
const showSemesterPicker = ref(false);
const courses = ref<Course[]>([]);
const showDetail = ref(false);
const selectedCourse = ref<RenderCourse | null>(null);
const isLoadingSemesters = ref(false);  // 防止重复加载

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

// 当前选中历史学期标签
const currentSemesterLabel = computed(() => {
  const current = semesterList.value[semesterIndex.value];
  return current ? current.label : '';
});

const emptyMessage = computed(() => {
  if (semesterList.value.length === 0) return '暂无历史学期';
  return '暂无课程数据';
});

const displayCourses = computed(() => {
  console.log('[History] Computing displayCourses, courses count:', courses.value.length);
  return toRenderCourses(courses.value);
});

async function loadSemesters() {
  loading.value = true;
  try {
    const { options, defaultIndex } = await loadSemesterOptions('history');
    semesterList.value = options;
    semesterIndex.value = defaultIndex;

    const target = options[defaultIndex];
    if (target) {
      await loadCourses(target.id);
    }
  } catch (e: unknown) {
    console.error('[History] Load semesters failed:', e);
    const msg = e instanceof Error && e.message === 'NOT_LOGGED_IN' ? '请先登录' : '获取学期列表失败';
    uni.showToast({ title: msg, icon: 'none' });
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
function onSemesterSelect(index: number) {
  if (index === semesterIndex.value) return;
  semesterIndex.value = index;
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
  padding: 0 32rpx 20rpx;
  border-bottom: 3rpx solid #000000;
}

.status-bar {
  height: var(--status-bar-height, 44rpx);
}

.header-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding-top: 12rpx;
}

.back-btn {
  font-size: 56rpx;
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
