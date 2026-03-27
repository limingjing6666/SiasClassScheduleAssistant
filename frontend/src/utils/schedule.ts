import type { Course, RenderCourse } from '@/types';
import { COURSE_THEMES } from '@/config/themes';

/**
 * 根据课程名称生成固定颜色
 * 相同课程名始终显示相同颜色
 */
export function getCourseThemeIndex(courseName: string): number {
  let hash = 0;
  for (let i = 0; i < courseName.length; i++) {
    hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % COURSE_THEMES.length;
}

export function getCourseColor(courseName: string): string {
  return COURSE_THEMES[getCourseThemeIndex(courseName)].bg;
}

/**
 * 解析节次字符串
 * 如 "1-2" -> { start: 1, step: 2 }
 * 如 "3-4" -> { start: 3, step: 2 }
 */
export function parseNodes(nodes: string): { start: number; step: number } {
  const parts = nodes.split('-');
  if (parts.length === 2) {
    const start = parseInt(parts[0], 10);
    const end = parseInt(parts[1], 10);
    return {
      start: Number.isFinite(start) ? start : 1,
      step: Number.isFinite(start) && Number.isFinite(end) ? end - start + 1 : 1
    };
  }
  // 单节课
  const single = parseInt(nodes, 10);
  return {
    start: Number.isFinite(single) ? single : 1,
    step: 1
  };
}

/**
 * 将 weeks 二进制字符串转为可读周次描述
 * 如 "0111111111111111100" → "1-16"
 * 如 "0101010101010101000" → "单1-15"
 * 如 "0010101010101010100" → "双2-16"
 */
export function weeksToLabel(weeks: string): string {
  if (!weeks) return '';

  // 提取有课的周次列表 (1-based)
  const activeWeeks: number[] = [];
  for (let i = 1; i < weeks.length; i++) {
    if (weeks.charAt(i) === '1') {
      activeWeeks.push(i);
    }
  }

  if (activeWeeks.length === 0) return '';

  const first = activeWeeks[0];
  const last = activeWeeks[activeWeeks.length - 1];

  // 判断是否全连续
  const total = last - first + 1;
  if (activeWeeks.length === total) {
    return `${first}-${last}`;
  }

  // 判断是否纯单周 (全是奇数)
  const allOdd = activeWeeks.every(w => w % 2 === 1);
  if (allOdd) {
    return `单${first}-${last}`;
  }

  // 判断是否纯双周 (全是偶数)
  const allEven = activeWeeks.every(w => w % 2 === 0);
  if (allEven) {
    return `双${first}-${last}`;
  }

  // 其他复杂情况：列出连续区间
  return `${first}-${last}`;
}

/**
 * 获取星期几的中文名
 */
export function getDayLabel(day: string): string {
  const names: Record<string, string> = {
    '1': '周一', '2': '周二', '3': '周三', '4': '周四',
    '5': '周五', '6': '周六', '7': '周日'
  };
  return names[day] || '';
}

/**
 * 根据周次过滤课程
 * @param courses 课程列表
 * @param currentWeek 当前周次 (1-based)
 */
export function filterByWeek(courses: Course[], currentWeek: number): Course[] {
  return courses.filter(course => {
    // weeks 是二进制字符串，第n位表示第n周是否有课
    // 假设第0位忽略，所以取第currentWeek位
    if (!course.weeks || currentWeek <= 0 || currentWeek >= course.weeks.length) {
      return false;
    }
    return course.weeks.charAt(currentWeek) === '1';
  });
}

/**
 * 将课程转换为渲染用数据
 * 确保同一天相邻的课程颜色不同
 */
export function toRenderCourses(courses: Course[]): RenderCourse[] {
  // 先按天和节次排序
  const sorted = [...courses].sort((a, b) => {
    if (a.day !== b.day) return parseInt(a.day) - parseInt(b.day);
    const aStart = parseNodes(a.nodes).start;
    const bStart = parseNodes(b.nodes).start;
    return aStart - bStart;
  });

  // 记录每天上一节课使用的主题索引，避免相邻同色
  const lastThemeByDay: Record<string, number> = {};

  return sorted.map(course => {
    const { start, step } = parseNodes(course.nodes);
    let idx = getCourseThemeIndex(course.name);

    // 如果和同一天上一节课主题相同，换一个
    const lastIdx = lastThemeByDay[course.day];
    if (lastIdx === idx) {
      for (let i = 1; i < COURSE_THEMES.length; i++) {
        const newIdx = (idx + i) % COURSE_THEMES.length;
        if (newIdx !== lastIdx) {
          idx = newIdx;
          break;
        }
      }
    }

    lastThemeByDay[course.day] = idx;
    const theme = COURSE_THEMES[idx];

    return {
      ...course,
      startNode: start,
      step: step,
      color: theme.bg,
      glowColor: theme.border,
      themeIndex: idx
    };
  });
}

/**
 * 获取星期名称
 */
export function getDayName(day: number): string {
  const days = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return days[day] || '';
}

/**
 * 节次时间表
 */
export const NODE_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: '8:00', end: '8:45' },
  2: { start: '8:55', end: '9:40' },
  3: { start: '10:00', end: '10:45' },
  4: { start: '10:55', end: '11:40' },
  5: { start: '13:00', end: '13:45' },
  6: { start: '13:55', end: '14:40' },
  7: { start: '15:00', end: '15:45' },
  8: { start: '15:55', end: '16:40' },
  9: { start: '16:55', end: '17:40' },
  10: { start: '17:50', end: '18:35' },
  11: { start: '19:10', end: '19:55' },
  12: { start: '20:00', end: '20:45' },
  13: { start: '20:50', end: '21:35' }
};

/**
 * 获取节次时间范围字符串（如 "08:00-09:40"）
 */
export function getNodeTimeRange(startNode: number, endNode: number): string {
  const start = NODE_TIMES[startNode]?.start || '';
  const end = NODE_TIMES[endNode]?.end || '';
  return start && end ? `${start}-${end}` : '';
}


