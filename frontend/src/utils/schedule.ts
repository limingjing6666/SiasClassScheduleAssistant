import type { Course, RenderCourse } from '@/types';

/**
 * 预设颜色数组 - 更鲜艳的渐变色系
 */
const COLORS = [
  '#74b9ff', '#81ecec', '#a29bfe', '#fd79a8',
  '#ffeaa7', '#55efc4', '#fab1a0', '#dfe6e9',
  '#00cec9', '#e17055', '#fdcb6e', '#b2bec3'
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

    return {
      ...course,
      startNode: start,
      step: step,
      color: color
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
  9: { start: '16:50', end: '17:35' },
  10: { start: '17:45', end: '18:30' },
  11: { start: '19:10', end: '19:55' },
  12: { start: '20:00', end: '20:45' },
  13: { start: '20:50', end: '21:35' }
};

/**
 * 获取节次名称
 */
export function getNodeName(node: number): string {
  return `第${node}节`;
}

/**
 * 获取节次开始时间
 */
export function getNodeStartTime(node: number): string {
  return NODE_TIMES[node]?.start || '';
}

/**
 * 获取节次结束时间
 */
export function getNodeEndTime(node: number): string {
  return NODE_TIMES[node]?.end || '';
}

/**
 * 获取节次时间范围字符串（如 "08:00-09:40"）
 */
export function getNodeTimeRange(startNode: number, endNode: number): string {
  const start = NODE_TIMES[startNode]?.start || '';
  const end = NODE_TIMES[endNode]?.end || '';
  return start && end ? `${start}-${end}` : '';
}

/**
 * 格式化日期
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 计算当前是学期第几周
 * @param semesterStart 学期开始日期
 */
export function calculateCurrentWeek(semesterStart: Date): number {
  const now = new Date();
  const diff = now.getTime() - semesterStart.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return Math.floor(days / 7) + 1;
}
