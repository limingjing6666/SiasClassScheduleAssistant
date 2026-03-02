import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Course, UserInfo } from '@/types';
import { filterByWeek, toRenderCourses } from '@/utils/schedule';

export const useScheduleStore = defineStore('schedule', () => {
  // 状态
  const courses = ref<Course[]>([]);
  const currentWeek = ref(1);
  const totalWeeks = ref(20);
  const userInfo = ref<UserInfo | null>(null);
  const loading = ref(false);
  // 学期开始日期（第一周周一），格式：YYYY-MM-DD
  const semesterStart = ref('2026-02-23');

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
    } catch (e) {
      console.error('加载缓存失败', e);
    }
  }

  function clearData() {
    courses.value = [];
    userInfo.value = null;
    semesterStart.value = '2026-02-23';
    uni.removeStorageSync('courses');
    uni.removeStorageSync('userInfo');
    uni.removeStorageSync('semesterStart');
  }

  return {
    courses,
    currentWeek,
    totalWeeks,
    userInfo,
    loading,
    semesterStart,
    displayCourses,
    setCourses,
    setCurrentWeek,
    setUserInfo,
    setSemesterStart,
    loadFromCache,
    clearData
  };
});
