/**
 * 课前提醒核心逻辑
 * 使用系统级定时通知，即使应用关闭也能触发
 */

import type { Course } from '@/types';
import type { ReminderSettings, ReminderTask } from '@/types/reminder';
import { NODE_TIMES } from '@/utils/schedule';
import { DEFAULT_REMINDER_SETTINGS, REMINDER_CACHE_KEY, NOTIFICATION_IDS_KEY } from '@/config/reminder';
import { checkNotificationPermission } from '@/utils/permission';

export type ReminderScheduleStatus =
  | 'scheduled'
  | 'disabled'
  | 'no_courses'
  | 'no_cache'
  | 'parse_error'
  | 'no_permission'
  | 'unsupported';

export interface ReminderScheduleResult {
  status: ReminderScheduleStatus;
  count: number;
}

/** 简单字符串哈希 → 数值 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * 获取提醒设置
 */
export function getReminderSettings(): ReminderSettings {
  const cached = uni.getStorageSync(REMINDER_CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      return DEFAULT_REMINDER_SETTINGS;
    }
  }
  return DEFAULT_REMINDER_SETTINGS;
}

/**
 * 保存提醒设置
 */
export function saveReminderSettings(settings: ReminderSettings): void {
  uni.setStorageSync(REMINDER_CACHE_KEY, JSON.stringify(settings));
}

export async function scheduleCachedTodayReminders(currentWeek: number): Promise<ReminderScheduleResult> {
  const settings = getReminderSettings();
  if (!settings.enabled) {
    return { status: 'disabled', count: 0 };
  }

  // #ifndef APP-PLUS
  return { status: 'unsupported', count: 0 };
  // #endif

  // #ifdef APP-PLUS
  const hasPermission = await checkNotificationPermission();
  if (!hasPermission) {
    return { status: 'no_permission', count: 0 };
  }

  const cachedCourses = uni.getStorageSync('courses');
  if (!cachedCourses) {
    return { status: 'no_cache', count: 0 };
  }

  try {
    const courses = JSON.parse(cachedCourses);
    const todayCourses = getTodayCourses(courses, currentWeek);

    if (todayCourses.length === 0) {
      clearAllNotifications();
      return { status: 'no_courses', count: 0 };
    }

    const count = scheduleTodayReminders(courses, currentWeek);
    return { status: count > 0 ? 'scheduled' : 'no_courses', count };
  } catch (e) {
    console.error('[Reminder] 解析课程缓存失败:', e);
    return { status: 'parse_error', count: 0 };
  }
  // #endif
}

/**
 * 获取今天的课程
 * @param courses 所有课程
 * @param currentWeek 当前周次
 */
export function getTodayCourses(courses: Course[], currentWeek: number): Course[] {
  const today = new Date().getDay();
  // 转换为1-7格式（周一=1，周日=7）
  const adjustedToday = today === 0 ? 7 : today;

  return courses.filter(course => {
    // 检查是否是今天的课程
    if (parseInt(course.day) !== adjustedToday) {
      return false;
    }
    // 检查本周是否有课
    if (!course.weeks || currentWeek <= 0 || currentWeek >= course.weeks.length) {
      return false;
    }
    return course.weeks.charAt(currentWeek) === '1';
  });
}

/**
 * 获取课程开始时间
 */
function getCourseStartTime(startNode: number): string {
  return NODE_TIMES[startNode]?.start || '';
}

/**
 * 获取课程结束时间
 */
function getCourseEndTime(endNode: number): string {
  return NODE_TIMES[endNode]?.end || '';
}

/**
 * 解析时间字符串为Date对象
 * @param timeStr 时间字符串，如 "8:00"
 * @param date 基准日期
 */
function parseTimeToDate(timeStr: string, date: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * 创建提醒任务
 * @param course 课程
 * @param advanceMinutes 提前提醒分钟数
 */
export function createReminderTask(course: Course, advanceMinutes: number): ReminderTask | null {
  const nodes = course.nodes.split('-');
  const startNode = parseInt(nodes[0]);
  const endNode = parseInt(nodes[nodes.length - 1]);

  const startTime = getCourseStartTime(startNode);
  const endTime = getCourseEndTime(endNode);

  if (!startTime) return null;

  const now = new Date();
  const courseStartTime = parseTimeToDate(startTime, now);
  const remindAt = new Date(courseStartTime.getTime() - advanceMinutes * 60 * 1000);

  return {
    courseId: `${course.name}_${course.day}_${course.nodes}`,
    courseName: course.name,
    teacher: course.teacher,
    room: course.room,
    startTime: startTime,
    endTime: endTime,
    remindAt: remindAt
  };
}

/**
 * 检查提醒任务是否已过期
 */
export function isTaskPassed(task: ReminderTask): boolean {
  return task.remindAt.getTime() < Date.now();
}

/**
 * 清除所有已保存的通知
 */
export function clearAllNotifications(): void {
  // #ifdef APP-PLUS
  try {
    // plus.push.clear() 清除所有本地推送通知（5+ API 无按 ID 取消的方法）
    plus.push.clear();
    uni.removeStorageSync(NOTIFICATION_IDS_KEY);
    console.log('[Reminder] 已清除所有通知');
  } catch {
    // 忽略错误
  }
  // #endif
}

/**
 * 保存通知ID
 */
function saveNotificationId(id: string): void {
  try {
    const idsStr = uni.getStorageSync(NOTIFICATION_IDS_KEY) || '[]';
    const ids: string[] = JSON.parse(idsStr);
    ids.push(id);
    uni.setStorageSync(NOTIFICATION_IDS_KEY, JSON.stringify(ids));
  } catch {
    // 忽略错误
  }
}

/**
 * 创建系统定时通知
 * @param task 提醒任务
 */
export function scheduleNotification(task: ReminderTask): boolean {
  // #ifdef APP-PLUS
  const delay = task.remindAt.getTime() - Date.now();

  if (delay <= 0) {
    console.log('[Reminder] 跳过已过期任务:', task.courseName);
    return false;
  }

  const settings = getReminderSettings();

  const title = '课前提醒';
  const content = `即将上课：${task.courseName}\n${task.startTime}-${task.endTime}  ${task.room || ''}\n${task.teacher || ''}`;

  // 生成数值型通知 ID（plus.push 需要 number 类型 id）
  const notifyId = Math.abs(hashCode(task.courseId)) % 100000;

  const delaySec = Math.floor(delay / 1000);

  console.log(`[Reminder] 创建定时通知: ${task.courseName}，${Math.floor(delay / 60000)}分钟后触发, delay=${delaySec}s, id=${notifyId}`);

  try {
    plus.push.createMessage(
      content,
      JSON.stringify({ courseId: task.courseId }),
      {
        title: title,
        delay: delaySec,
        sound: settings.sound ? 'system' : 'none',
        cover: false
      }
    );
    saveNotificationId(String(notifyId));
  } catch (e) {
    console.error('[Reminder] createMessage failed:', e);
    return false;
  }
  return true;
  // #endif

  // #ifndef APP-PLUS
  return false;
  // #endif
}

/**
 * 设置今日课程提醒
 * @param courses 所有课程
 * @param currentWeek 当前周次
 */
export function scheduleTodayReminders(courses: Course[], currentWeek: number): number {
  const settings = getReminderSettings();

  if (!settings.enabled) {
    console.log('[Reminder] 提醒功能未启用');
    return 0;
  }

  // 清除旧通知
  clearAllNotifications();

  // 获取今日课程
  const todayCourses = getTodayCourses(courses, currentWeek);

  if (todayCourses.length === 0) {
    console.log('[Reminder] 今日无课程');
    return 0;
  }

  // 创建提醒任务
  let successCount = 0;

  for (const course of todayCourses) {
    const task = createReminderTask(course, settings.advanceMinutes);

    if (task && !isTaskPassed(task)) {
      if (scheduleNotification(task)) {
        successCount++;
      }
    }
  }

  console.log(`[Reminder] 设置今日提醒完成，成功: ${successCount}/${todayCourses.length}`);
  return successCount;
}
