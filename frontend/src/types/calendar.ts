/**
 * 校历相关类型定义
 */

// 校历中的一天
export interface CalendarDay {
  /** 日期数字（1-31） */
  dayOfMonth: number;
  /** 是否是今天 */
  isToday: boolean;
  /** 是否是节假日 */
  isHoliday: boolean;
  /** 是否是周末（周六/周日） */
  isWeekend: boolean;
}

// 校历中的一周（表格中的一行）
export interface CalendarWeek {
  /** 教学周次（如 "第1周"），跨行时可能为空 */
  weekLabel: string;
  /** 月份标签（如 "3月"），rowspan 首行才有 */
  monthLabel: string;
  /** 周一~周日共7天，空单元格为 null */
  days: (CalendarDay | null)[];
}

// 校历数据汇总
export interface SchoolCalendarData {
  /** 学年学期描述，如 "2025-2026 2" */
  semester: string;
  /** 开学日期（第一周周一），格式 YYYY-MM-DD */
  startDate: string;
  /** 结束日期，格式 YYYY-MM-DD */
  endDate: string;
  /** 总教学周数 */
  totalWeeks: number;
  /** 校历周数据 */
  weeks: CalendarWeek[];
}

// 校历缓存
export interface CalendarCache {
  data: SchoolCalendarData;
  lastFetchTime: number;
}
