import type { Course, RenderCourse } from '@/types';

/**
 * 预设颜色数组 - 暖色大地色系
 */
const COLORS = [
  '#8B4A1A', // 铁锈棕
  '#C8B89A', // 驼色/卡其
  '#7A2A1E', // 酒红/暗红
  '#5A4A10', // 橄榄绿
  '#A0522D', // 赭石/黄褐
  '#8B6914', // 暗金
  '#6B3A2A', // 深棕
  '#4A6A2A', // 苔绿
  '#9B5A3A', // 铜色
  '#7A6A3A', // 暗卡其
  '#5A3A2A', // 巧克力
  '#8B7A4A', // 暗驼
];

/** 暖色边框色 —— 与 COLORS 一一对应（略浅的同系色） */
export const GLOW_COLORS = [
  '#B06A3A', '#D8CDB0', '#9A4A3E', '#7A6A30',
  '#C07240', '#AB8934', '#8B5A4A', '#6A8A4A',
  '#BB7A5A', '#9A8A5A', '#7A5A4A', '#AB9A6A',
];

/**
 * 根据课程名称生成固定颜色
 * 相同课程名始终显示相同颜色
 */
export function getCourseColor(courseName: string): string {
  let hash = 0;
  for (let i = 0; i < courseName.length; i++) {
    hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
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
      start: start,
      step: end - start + 1
    };
  }
  // 单节课
  return {
    start: parseInt(nodes, 10) || 1,
    step: 1
  };
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
    if (!course.weeks || course.weeks.length <= currentWeek) {
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

  // 记录每天上一节课使用的颜色
  const lastColorByDay: Record<string, string> = {};

  return sorted.map(course => {
    const { start, step } = parseNodes(course.nodes);
    let color = getCourseColor(course.name);
    
    // 如果和同一天上一节课颜色相同，换一个颜色
    const lastColor = lastColorByDay[course.day];
    if (lastColor === color) {
      // 找下一个不同的颜色
      let hash = 0;
      for (let i = 0; i < course.name.length; i++) {
        hash = course.name.charCodeAt(i) + ((hash << 5) - hash);
      }
      const baseIndex = Math.abs(hash) % COLORS.length;
      // 尝试下一个颜色
      for (let i = 1; i < COLORS.length; i++) {
        const newColor = COLORS[(baseIndex + i) % COLORS.length];
        if (newColor !== lastColor) {
          color = newColor;
          break;
        }
      }
    }
    
    lastColorByDay[course.day] = color;

    // 获取对应的发光色
    const colorIndex = COLORS.indexOf(color);
    const glowColor = colorIndex >= 0 ? GLOW_COLORS[colorIndex] : GLOW_COLORS[0];

    return {
      ...course,
      startNode: start,
      step: step,
      color: color,
      glowColor: glowColor
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


