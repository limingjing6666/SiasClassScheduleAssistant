import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Course, UserInfo } from '@/types';
import type { ReminderSettings } from '@/types/reminder';
import { filterByWeek, toRenderCourses, calculateWeekNumber } from '@/utils/schedule';
import { SCHEDULE_CONFIG } from '@/config/schedule';
import { DEFAULT_REMINDER_SETTINGS, REMINDER_CACHE_KEY } from '@/config/reminder';

interface CachedSemesterMeta {
  semester?: string;
  startDate: string;
  endDate?: string;
  totalWeeks?: number;
}

const SEMESTER_META_MAP_KEY = 'semesterCalendarMetaMap';

function readStoredTotalWeeks(): number {
  const raw = uni.getStorageSync('totalWeeks');
  const parsed = Number(raw);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 30) {
    return parsed;
  }
  return SCHEDULE_CONFIG.DEFAULT_TOTAL_WEEKS;
}

function readStoredSemesterMetaMap(): Record<string, CachedSemesterMeta> {
  const raw = uni.getStorageSync(SEMESTER_META_MAP_KEY);
  if (!raw) return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export const useScheduleStore = defineStore('schedule', () => {
  // 状态
  const courses = ref<Course[]>([]);
  const currentWeek = ref(1);
  const totalWeeks = ref(readStoredTotalWeeks());
  const userInfo = ref<UserInfo | null>(null);
  const loading = ref(false);
  const currentSemesterId = ref<string>(String(uni.getStorageSync('currentSemesterId') || ''));
  // 会话级记忆：切换 Tab 时保留成绩页已选学期，避免切回重置
  const selectedScoreSemesterId = ref<number | null>(null);
  // 学期开始日期（第一周周一），格式：YYYY-MM-DD
  // ★ 立即从缓存读取，避免延迟加载导致已同步的日期被默认值覆盖
  const semesterStart = ref(uni.getStorageSync('semesterStart') || SCHEDULE_CONFIG.DEFAULT_SEMESTER_START);

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

  function initCurrentWeek() {
    let week = calculateWeekNumber(semesterStart.value);

    if (week < 1) week = 1;
    if (week > totalWeeks.value) week = totalWeeks.value;

    currentWeek.value = week;
  }

  function setSemesterStart(date: string) {
    if (!date) return;
    semesterStart.value = date;
    uni.setStorageSync('semesterStart', date);
    // 开学日期更新后立即重算当前周，避免界面停留在旧周次
    initCurrentWeek();
  }

  function setTotalWeeks(weeks: number) {
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 30) return;
    totalWeeks.value = weeks;
    uni.setStorageSync('totalWeeks', weeks);
    initCurrentWeek();
  }

  function applySemesterCalendar(meta: {
    semesterId?: string | null;
    semester?: string;
    startDate: string;
    endDate?: string;
    totalWeeks?: number;
  }) {
    if (meta.semesterId) {
      currentSemesterId.value = meta.semesterId;
      uni.setStorageSync('currentSemesterId', meta.semesterId);
    }

    if (meta.totalWeeks && Number.isInteger(meta.totalWeeks) && meta.totalWeeks >= 1 && meta.totalWeeks <= 30) {
      totalWeeks.value = meta.totalWeeks;
      uni.setStorageSync('totalWeeks', meta.totalWeeks);
    }

    if (meta.startDate) {
      semesterStart.value = meta.startDate;
      uni.setStorageSync('semesterStart', meta.startDate);

      if (meta.semesterId) {
        const metaMap = readStoredSemesterMetaMap();
        metaMap[meta.semesterId] = {
          semester: meta.semester,
          startDate: meta.startDate,
          endDate: meta.endDate,
          totalWeeks: meta.totalWeeks
        };
        uni.setStorageSync(SEMESTER_META_MAP_KEY, JSON.stringify(metaMap));
      }
    }

    initCurrentWeek();
  }

  function getSavedSemesterMeta(semesterId: string): CachedSemesterMeta | null {
    if (!semesterId) return null;
    const metaMap = readStoredSemesterMetaMap();
    return metaMap[semesterId] || null;
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
      const cachedSemesterId = uni.getStorageSync('currentSemesterId');
      if (cachedSemesterId) {
        currentSemesterId.value = String(cachedSemesterId);
      }
      totalWeeks.value = readStoredTotalWeeks();
      const cachedSemesterStart = uni.getStorageSync('semesterStart');
      if (cachedSemesterStart) {
        semesterStart.value = cachedSemesterStart;
      }
      // 加载完缓存（尤其是开学日期与总周数）后，自动初始化当前周数
      initCurrentWeek();
      // 加载提醒设置
      loadReminderSettings();
    } catch (e) {
      console.error('加载缓存失败', e);
    }
  }

  // 清除所有数据（含学期设置），用于退出登录
  function clearData() {
    // 重置内存状态
    courses.value = [];
    userInfo.value = null;
    currentSemesterId.value = '';
    selectedScoreSemesterId.value = null;
    totalWeeks.value = SCHEDULE_CONFIG.DEFAULT_TOTAL_WEEKS;
    semesterStart.value = SCHEDULE_CONFIG.DEFAULT_SEMESTER_START;
    currentWeek.value = 1;
    reminderSettings.value = DEFAULT_REMINDER_SETTINGS;
    // 清除所有本地存储（包括动态 key 如 grades_xxx、history_courses_xxx 等）
    uni.clearStorageSync();
  }

  // 仅清除账号相关数据，保留用户设定的学期开始日期（切换账号/重新登录时用）
  function clearUserData() {
    courses.value = [];
    userInfo.value = null;
    uni.removeStorageSync('courses');
    uni.removeStorageSync('userInfo');
  }

  // 提醒设置
  const reminderSettings = ref<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);

  function loadReminderSettings() {
    const cached = uni.getStorageSync(REMINDER_CACHE_KEY);
    if (cached) {
      try {
        reminderSettings.value = JSON.parse(cached);
      } catch {
        reminderSettings.value = DEFAULT_REMINDER_SETTINGS;
      }
    }
  }

  function setReminderSettings(settings: ReminderSettings) {
    reminderSettings.value = settings;
    uni.setStorageSync(REMINDER_CACHE_KEY, JSON.stringify(settings));
  }

  return {
    courses,
    currentWeek,
    totalWeeks,
    userInfo,
    loading,
    currentSemesterId,
    selectedScoreSemesterId,
    semesterStart,
    displayCourses,
    reminderSettings,
    setCourses,
    setCurrentWeek,
    setUserInfo,
    initCurrentWeek,
    setSemesterStart,
    setTotalWeeks,
    applySemesterCalendar,
    getSavedSemesterMeta,
    loadFromCache,
    clearData,
    clearUserData,
    loadReminderSettings,
    setReminderSettings
  };
});
