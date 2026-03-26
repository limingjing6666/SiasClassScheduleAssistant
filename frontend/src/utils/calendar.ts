/**
 * 校历 — 解析、获取、缓存
 * ★ 统一使用共享 session（getCrawler）
 */

import type { CalendarDay, CalendarWeek, SchoolCalendarData, CalendarCache } from '@/types/calendar';
import { getCrawler } from './session';

const CACHE_KEY = 'school_calendar';

/**
 * 英文月份名 → 数字
 */
const MONTH_MAP: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04',
  May: '05', Jun: '06', Jul: '07', Aug: '08',
  Sep: '09', Oct: '10', Nov: '11', Dec: '12'
};

/**
 * 解析日期字符串 "Mar 2, 2026" → "2026-03-02"
 */
function parseEnglishDate(dateStr: string): string {
  const m = dateStr.trim().match(/(\w{3})\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return '';
  const month = MONTH_MAP[m[1]] || '01';
  const day = m[2].padStart(2, '0');
  return `${m[3]}-${month}-${day}`;
}

/**
 * 从校历 HTML 的头部信息中提取开学日期
 * 匹配格式: "Mar 2, 2026~Jul 5, 2026 (18)"
 */
export function extractStartDate(html: string): string | null {
  const m = html.match(/(\w{3}\s+\d{1,2},\s*\d{4})\s*~\s*(\w{3}\s+\d{1,2},\s*\d{4})/);
  if (!m) return null;
  return parseEnglishDate(m[1]);
}

/**
 * 从校历 HTML 提取头部信息
 */
function parseHeader(html: string): { semester: string; startDate: string; endDate: string; totalWeeks: number } {
  // 学年学期: "2025-2026 2"
  const semMatch = html.match(/学年度\/学期：<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/);
  const semester = semMatch ? semMatch[1].replace(/<[^>]*>/g, '').replace(/&nbsp;?/g, ' ').trim() : '';

  // 日期范围: "Mar 2, 2026~Jul 5, 2026 (18)"
  const dateMatch = html.match(/开始\/结束日期：<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/);
  let dateContent = dateMatch ? dateMatch[1].replace(/<[^>]*>/g, '').replace(/&nbsp;?/g, ' ').trim() : '';
  // 清理多余空白（换行、多空格）
  dateContent = dateContent.replace(/\s+/g, ' ').trim();

  let startDate = '';
  let endDate = '';
  let totalWeeks = 0;

  // 尝试匹配带括号的格式: "Mar 2, 2026~Jul 5, 2026 (18)"
  let rangeMatch = dateContent.match(/(\w{3}\s+\d{1,2},\s*\d{4})\s*~\s*(\w{3}\s+\d{1,2},\s*\d{4})\s*\((\d+)\)/);
  if (!rangeMatch) {
    // 降级：不带括号的格式: "Mar 2, 2026~Jul 5, 2026"
    rangeMatch = dateContent.match(/(\w{3}\s+\d{1,2},\s*\d{4})\s*~\s*(\w{3}\s+\d{1,2},\s*\d{4})/);
  }

  if (rangeMatch) {
    startDate = parseEnglishDate(rangeMatch[1]);
    endDate = parseEnglishDate(rangeMatch[2]);
    if (rangeMatch[3]) {
      totalWeeks = parseInt(rangeMatch[3], 10);
    } else if (startDate && endDate) {
      // 自动计算周数
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      totalWeeks = Math.ceil(diffDays / 7);
    }
  }

  // 如果上面都没匹配到，尝试从整个 HTML 中直接搜索日期模式
  if (!startDate) {
    const fallback = html.match(/(\w{3}\s+\d{1,2},\s*\d{4})\s*~\s*(\w{3}\s+\d{1,2},\s*\d{4})/);
    if (fallback) {
      startDate = parseEnglishDate(fallback[1]);
      endDate = parseEnglishDate(fallback[2]);
      const weeksFallback = html.match(/\((\d+)\)/);
      if (weeksFallback) totalWeeks = parseInt(weeksFallback[1], 10);
    }
  }

  return { semester, startDate, endDate, totalWeeks };
}

/**
 * 解析校历表格中的周数据
 */
function parseCalendarWeeks(html: string): CalendarWeek[] {
  const weeks: CalendarWeek[] = [];

  // 找到第二个 table（日历表格）
  const tables = html.match(/<table[^>]*class="infoTable"[^>]*>([\s\S]*?)<\/table>/g);
  if (!tables || tables.length < 2) return weeks;

  const calendarTable = tables[1];

  // 按 <tr> 分割行（跳过表头行）
  const rows = calendarTable.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
  if (!rows) return weeks;

  let currentMonth = '';

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const week: CalendarWeek = { weekLabel: '', monthLabel: '', days: [] };

    // 提取月份标签（rowspan 首行才有）
    const monthMatch = row.match(/<td[^>]*class="title"[^>]*rowspan[^>]*>([\s\S]*?)<\/td>/);
    if (monthMatch) {
      currentMonth = monthMatch[1].replace(/<[^>]*>/g, '').trim();
    }
    week.monthLabel = currentMonth;

    // 提取周次标签（最后一列，如 "第1周"）
    const weekMatch = row.match(/第(\d+)周/);
    if (weekMatch) {
      week.weekLabel = `第${weekMatch[1]}周`;
    }

    // 提取7个日期单元格（注意：空单元格 <td></td> 也要匹配）
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g);
    if (!cells) {
      weeks.push(week);
      continue;
    }

    for (const cell of cells) {
      // 跳过月份标题列和周次列
      if (cell.includes('class="title"') || cell.includes('color:#444398')) continue;

      const dayNum = cell.replace(/<[^>]*>/g, '').trim();
      if (!dayNum || !/^\d+$/.test(dayNum)) {
        week.days.push(null);
        continue;
      }

      const day: CalendarDay = {
        dayOfMonth: parseInt(dayNum, 10),
        isToday: cell.includes('#FFD460'),
        isHoliday: cell.includes('#FEF1C5'),
        isWeekend: cell.includes('color:red') && cell.includes('font-weight:bold')
      };
      week.days.push(day);
    }

    // 补齐到7天（如果不足）
    while (week.days.length < 7) {
      week.days.push(null);
    }
    // 截取前7天（去掉多余的）
    week.days = week.days.slice(0, 7);

    weeks.push(week);
  }

  return weeks;
}

/**
 * 解析校历 HTML
 */
export function parseSchoolCalendar(html: string): SchoolCalendarData {
  const header = parseHeader(html);
  const weeks = parseCalendarWeeks(html);

  return {
    ...header,
    weeks
  };
}

/**
 * 获取校历数据
 */
export async function fetchSchoolCalendar(username: string, password: string, semesterId?: number): Promise<SchoolCalendarData> {
  try {
    const crawler = await getCrawler(username, password);
    const html = await crawler.fetchSchoolCalendarHtml(semesterId);
    return parseSchoolCalendar(html);
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'SESSION_EXPIRED') {
      const { invalidateSession } = await import('./session');
      invalidateSession();
      const crawler = await getCrawler(username, password);
      const html = await crawler.fetchSchoolCalendarHtml(semesterId);
      return parseSchoolCalendar(html);
    }
    throw e;
  }
}

/**
 * 仅获取开学日期（轻量调用，用于自动同步）
 */
export async function fetchStartDate(username: string, password: string, semesterId?: number): Promise<string | null> {
  try {
    const crawler = await getCrawler(username, password);
    const html = await crawler.fetchSchoolCalendarHtml(semesterId);
    return extractStartDate(html);
  } catch (e: unknown) {
    console.error('[calendar] fetchStartDate failed:', e);
    return null;
  }
}

/**
 * 获取缓存（24h 过期）
 */
export function getCachedCalendar(): SchoolCalendarData | null {
  const cached = uni.getStorageSync(CACHE_KEY);
  if (!cached) return null;

  try {
    const data: CalendarCache = JSON.parse(cached);
    const age = Date.now() - data.lastFetchTime;
    if (age < 24 * 60 * 60 * 1000) {
      return data.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 写入缓存
 */
export function cacheCalendar(data: SchoolCalendarData): void {
  const cache: CalendarCache = { data, lastFetchTime: Date.now() };
  uni.setStorageSync(CACHE_KEY, JSON.stringify(cache));
}
