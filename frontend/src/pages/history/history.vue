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
    <scroll-view v-else-if="courses.length > 0" class="schedule-container" scroll-y>
      <!-- 星期标题 -->
      <view class="schedule-header">
        <view class="time-column header-cell"></view>
        <view
          v-for="day in 7"
          :key="day"
          class="day-column header-cell"
        >
          <text class="day-name">{{ getDayName(day) }}</text>
        </view>
      </view>

      <!-- 课表网格 -->
      <view class="schedule-body">
        <view class="schedule-grid">
          <!-- 时间列 -->
          <view class="time-column">
            <view
              v-for="node in 13"
              :key="node"
              class="time-cell"
            >
              <text class="node-num">{{ node }}</text>
              <text class="node-time">{{ getNodeTimeRange(node, node) }}</text>
            </view>
          </view>

          <!-- 课程区域 -->
          <view class="courses-area">
            <!-- 网格背景 -->
            <view class="grid-background">
              <view
                v-for="day in 7"
                :key="day"
                class="grid-column"
              >
                <view
                  v-for="node in 13"
                  :key="node"
                  class="grid-cell"
                ></view>
              </view>
            </view>

            <!-- 课程块 -->
            <view
              v-for="(course, index) in displayCourses"
              :key="index"
              class="course-block"
              :style="getCourseStyle(course)"
              @click="showCourseDetail(course)"
            >
              <text class="course-name">{{ course.name }}</text>
              <text class="course-room">{{ course.room }}</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

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
import { getDayName, getNodeTimeRange, toRenderCourses } from '@/utils/schedule';
import { SiasCrawler } from '@/utils/crawler';
import { useScheduleStore } from '@/stores/schedule';
import CourseDetailModal from '@/components/CourseDetailModal.vue';

interface Semester {
  id: number;
  schoolYear: string;
  name: string;
  label: string;
}

const scheduleStore = useScheduleStore();

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

// 当前学期标签
const currentSemesterLabel = computed(() => {
  if (semesters.value.length === 0) return '';
  const current = semesters.value[semesterIndex.value];
  return current ? `${current.schoolYear} 学期${current.name}` : '';
});

const emptyMessage = computed(() => {
  if (semesters.value.length === 0) return '正在加载学期列表...';
  return '暂无课程数据';
});

const displayCourses = computed(() => {
  console.log('[History] Computing displayCourses, courses count:', courses.value.length);
  return toRenderCourses(courses.value);
});

const NODE_HEIGHT = 100;
const DAY_WIDTH = 100 / 7;

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
        semesters.value = cachedSemesters.semesters.map(s => ({
          id: s.id,
          schoolYear: s.schoolYear,
          name: s.name,
          label: `${s.schoolYear} 学期${s.name}`
        })).reverse();
        
        if (semesters.value.length > 0) {
          semesterIndex.value = 0;
          // 从缓存中获取当前学期ID
          const cachedHistoryUser = uni.getStorageSync('history_user_info');
          if (cachedHistoryUser && cachedHistoryUser.semesterId) {
            currentSemesterId.value = cachedHistoryUser.semesterId;
          }
          await loadCourses(semesters.value[0].id);
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
    
    const { username, password } = JSON.parse(cachedUser);
    console.log('[History] username:', username, 'password length:', password?.length);
    
    if (!username || !password) {
      console.log('[History] Missing username or password');
      uni.showToast({ title: '请先登录', icon: 'none' });
      loading.value = false;
      return;
    }

    const crawler = new SiasCrawler(username, password);

    // 登录
    const loginOk = await crawler.login();
    if (!loginOk) {
      uni.showToast({ title: '登录失败', icon: 'none' });
      return;
    }

    // 调用autoDetect，确保Cookie中有JSESSIONID
    console.log('[History] Calling autoDetect');
    const detectOk = await crawler.autoDetect();
    console.log('[History] autoDetect result:', detectOk);
    
    // 获取当前学期ID
    if (detectOk) {
      currentSemesterId.value = crawler.getCurrentSemesterId();
      console.log('[History] Current semester ID:', currentSemesterId.value);
    }

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

    // 保存用户ID和学期ID到本地缓存
    uni.setStorageSync('history_user_info', {
      username: username,
      password: password,
      userId: crawler.getUserId(),
      semesterId: crawler.getCurrentSemesterId(),
      lastLoginTime: Date.now()
    });

    // 默认选择第一个（最新学期）
    if (semesters.value.length > 0) {
      semesterIndex.value = 0;
      await loadCourses(semesters.value[0].id);
    }
  } catch (e: any) {
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
    
    // 步骤2: 缓存过期或不存在，检查本地缓存的用户ID
    const cachedHistoryUser = uni.getStorageSync('history_user_info');
    
    // 如果有缓存且未过期（1小时），直接使用
    if (cachedHistoryUser && cachedHistoryUser.userId && cachedHistoryUser.lastLoginTime) {
      const cacheAge = Date.now() - cachedHistoryUser.lastLoginTime;
      const cacheExpiry = 60 * 60 * 1000; // 1小时过期
      
      if (cacheAge < cacheExpiry) {
        console.log('[History] Using cached user ID:', cachedHistoryUser.userId, 'age:', Math.round(cacheAge / 1000 / 60), 'minutes');
        
        // 创建爬虫实例
        const crawler = new SiasCrawler(cachedHistoryUser.username, cachedHistoryUser.password);
        
        // 登录获取cookie
        const loginOk = await crawler.login();
        if (!loginOk) {
          uni.showToast({ title: '登录失败', icon: 'none' });
          loading.value = false;
          return;
        }
        
        // 直接设置用户ID和学期ID
        crawler.setUserId(cachedHistoryUser.userId);
        crawler.setSemester(String(semesterId));
        
        // 获取课表
        const courseList = await crawler.getData();
        courses.value = courseList;
        
        // 保存课表到缓存
        uni.setStorageSync(courseCacheKey, {
          courses: courseList,
          lastFetchTime: Date.now()
        });
        
        loading.value = false;
        return;
      }
    }
    
    // 步骤3: 没有缓存或缓存过期，重新登录和探测
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

    const crawler = new SiasCrawler(username, password);

    // 登录
    const loginOk = await crawler.login();
    if (!loginOk) {
      uni.showToast({ title: '登录失败', icon: 'none' });
      return;
    }

    // 探测用户ID
    const detectOk = await crawler.autoDetect();
    if (!detectOk) {
      uni.showToast({ title: '获取用户信息失败', icon: 'none' });
      return;
    }

    // 切换到指定学期
    crawler.setSemester(String(semesterId));

    // 获取课表
    const courseList = await crawler.getData();
    courses.value = courseList;
    
    // 保存课表到缓存
    uni.setStorageSync(courseCacheKey, {
      courses: courseList,
      lastFetchTime: Date.now()
    });
    
    // 更新用户信息缓存
    uni.setStorageSync('history_user_info', {
      username: username,
      password: password,
      userId: crawler.getUserId(),
      semesterId: crawler.getCurrentSemesterId(),
      lastLoginTime: Date.now()
    });
  } catch (e: any) {
    console.error('[History] Load courses failed:', e);
    uni.showToast({ title: '获取课表失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function onSemesterChange(e: any) {
  const index = e.detail.value;
  semesterIndex.value = index;
  const semester = semesters.value[index];
  if (semester) {
    loadCourses(semester.id);
  }
}

function goBack() {
  uni.navigateBack();
}

function getCourseStyle(course: RenderCourse) {
  const day = parseInt(course.day);
  const left = (day - 1) * DAY_WIDTH;
  const top = (course.startNode - 1) * NODE_HEIGHT;
  const height = course.step * NODE_HEIGHT;

  return {
    left: `${left}%`,
    top: `${top}rpx`,
    width: `${DAY_WIDTH}%`,
    height: `${height}rpx`,
    backgroundColor: course.color,
    borderRadius: '8rpx',
    border: '1rpx solid rgba(0,0,0,0.02)'
  };
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
  background: #FFFFFF;
}

/* 头部 */
.page-header {
  background: #FFFFFF;
  border-bottom: 1rpx solid #EAEAEA;
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
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 48rpx;
  color: #000000;
  font-weight: 300;
}

.page-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #000000;
}

.placeholder {
  width: 56rpx;
}

/* 学期选择器 */
.semester-bar {
  padding: 16rpx 32rpx;
  background: #F5F5F5;
}

.semester-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #FFFFFF;
  padding: 20rpx 24rpx;
  border-radius: 8rpx;
}

.semester-text {
  font-size: 28rpx;
  color: #333333;
  font-weight: 500;
}

.semester-arrow {
  font-size: 20rpx;
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

/* 课表内容 */
.schedule-container {
  flex: 1;
  overflow: hidden;
}

.schedule-header {
  display: flex;
  background: #FFFFFF;
  border-bottom: 1rpx solid #EAEAEA;
  padding: 12rpx 0;
}

.header-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 76rpx;
}

.time-column {
  width: 100rpx;
  flex-shrink: 0;
}

.day-column {
  flex: 1;
}

.day-name {
  font-size: 24rpx;
  color: #888888;
  font-weight: 500;
}

.schedule-body {
  flex: 1;
}

.schedule-grid {
  display: flex;
  position: relative;
}

.time-column .time-cell {
  height: 100rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-bottom: 1rpx solid #F5F5F5;
  background: #FFFFFF;
}

.node-num {
  font-size: 22rpx;
  color: #888888;
  font-weight: 600;
}

.node-time {
  font-size: 16rpx;
  color: #BBBBBB;
  margin-top: 4rpx;
}

.courses-area {
  flex: 1;
  position: relative;
  height: 1300rpx;
}

.grid-background {
  display: flex;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.grid-column {
  flex: 1;
  border-left: 1rpx solid #F5F5F5;
  background: #FFFFFF;
}

.grid-cell {
  height: 100rpx;
  border-bottom: 1rpx solid #F5F5F5;
}

.course-block {
  position: absolute;
  padding: 8rpx;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 2rpx;
  text-align: center;
}

.course-name {
  font-size: 22rpx;
  font-weight: 600;
  color: #000000;
  line-height: 1.25;
  word-break: break-all;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.course-room {
  font-size: 18rpx;
  color: rgba(0, 0, 0, 0.6);
  margin-top: 6rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90%;
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
</style>
