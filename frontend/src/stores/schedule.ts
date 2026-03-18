import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Course, UserInfo } from '@/types';
import { filterByWeek, toRenderCourses } from '@/utils/schedule';
import { setupClassReminders, clearReminders } from '@/utils/notification';
import { SCHEDULE_CONFIG } from '@/config/schedule';

export const useScheduleStore = defineStore('schedule', () => {
  // 状态
  const courses = ref<Course[]>([]);
  const currentWeek = ref(1);
  const totalWeeks = ref(20);
  const userInfo = ref<UserInfo | null>(null);
  const loading = ref(false);
  // 学期开始日期（第一周周一），格式：YYYY-MM-DD
  // ★ 立即从缓存读取，避免延迟加载导致用户设定的日期被默认值覆盖
  const semesterStart = ref(uni.getStorageSync('semesterStart') || SCHEDULE_CONFIG.DEFAULT_SEMESTER_START);
  
  // 课前提醒开关设置
  const enableReminders = ref(uni.getStorageSync('enableReminders') === true);

  // 计算属性 - 根据当前周过滤课程
  const displayCourses = computed(() => {
    const filtered = filterByWeek(courses.value, currentWeek.value);
    return toRenderCourses(filtered);
  });

  // 方法
  function setCourses(newCourses: Course[]) {
    courses.value = newCourses;
    // 缓存到本地存储
    uni.setStorageSync('courses', JSON.stringify(newCourses));
    if (enableReminders.value) {
      setupClassReminders(newCourses, semesterStart.value);
    }
  }

  function setCurrentWeek(week: number) {
    if (week >= 1 && week <= totalWeeks.value) {
      currentWeek.value = week;
    }
  }

  function setUserInfo(info: UserInfo) {
    userInfo.value = info;
    uni.setStorageSync('userInfo', JSON.stringify(info));
  }

  function setSemesterStart(date: string) {
    semesterStart.value = date;
    uni.setStorageSync('semesterStart', date);
    if (enableReminders.value && courses.value.length > 0) {
      setupClassReminders(courses.value, date);
    }
  }

  function setReminders(enabled: boolean) {
    enableReminders.value = enabled;
    uni.setStorageSync('enableReminders', enabled);
    if (enabled) {
      setupClassReminders(courses.value, semesterStart.value);
    } else {
      clearReminders();
    }
  }

  function initCurrentWeek() {
    const start = new Date(semesterStart.value);
    const today = new Date();
    // 计算今天距离开学的天数
    const diffTime = today.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    // 计算当前是第几周
    let week = Math.floor(diffDays / 7) + 1;

    if (week < 1) week = 1;
    if (week > totalWeeks.value) week = totalWeeks.value;

    currentWeek.value = week;
  }

  function loadFromCache() {
    try {
      const cachedCourses = uni.getStorageSync('courses');
      if (cachedCourses) {
        courses.value = JSON.parse(cachedCourses);
      }
      const cachedUser = uni.getStorageSync('userInfo');
      if (cachedUser) {
        userInfo.value = JSON.parse(cachedUser);
      }
      const cachedSemesterStart = uni.getStorageSync('semesterStart');
      if (cachedSemesterStart) {
        semesterStart.value = cachedSemesterStart;
      }
      // 加载完缓存（尤其是开学日期）后，自动初始化当前周数
      initCurrentWeek();
      
      // 如果启用了本地推送体验，则在每次 App 重启时计算未来 7 天的推送并加载
      if (enableReminders.value && courses.value.length > 0) {
        setupClassReminders(courses.value, semesterStart.value);
      }
    } catch (e) {
      console.error('加载缓存失败', e);
    }
  }

  // 清除所有数据（含学期设置），用于退出登录
  function clearData() {
    courses.value = [];
    userInfo.value = null;
    semesterStart.value = SCHEDULE_CONFIG.DEFAULT_SEMESTER_START;
    enableReminders.value = false;
    uni.removeStorageSync('courses');
    uni.removeStorageSync('userInfo');
    uni.removeStorageSync('semesterStart');
    uni.removeStorageSync('enableReminders');
    clearReminders();
  }

  // 仅清除账号相关数据，保留用户设定的学期开始日期（切换账号/重新登录时用）
  function clearUserData() {
    courses.value = [];
    userInfo.value = null;
    uni.removeStorageSync('courses');
    uni.removeStorageSync('userInfo');
    clearReminders();
  }

  return {
    courses,
    currentWeek,
    totalWeeks,
    userInfo,
    loading,
    semesterStart,
    displayCourses,
    enableReminders,
    setCourses,
    setCurrentWeek,
    setUserInfo,
    setSemesterStart,
    setReminders,
    loadFromCache,
    clearData,
    clearUserData
  };
});
