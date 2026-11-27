/**
 * 校历 — 解析、获取、缓存
 * ★ 统一使用共享 session（getCrawler）
 */

import type { CalendarDay, CalendarWeek, SchoolCalendarData, CalendarCache } from '@/types/calendar';
import { parseLocalDate } from './schedule';
import { getCrawler } from './session';

const CACHE_KEY = 'school_calendar';
const CACHE_TTL = 24 * 60 * 60 * 1000;

export interface SemesterCalendarMeta {
  semesterId: string | null;
  semester: string;
  startDate: string;
  endDate: string;
  totalWeeks: number;
}

/**
 * 英文月份名（缩写/全称）→ 数字
 */
const MONTH_MAP: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12'
};

/**
 * 统一解析校历日期字符串 → "YYYY-MM-DD"
 * 支持格式：
 * - 英文："Mar 2, 2026" / "August 31, 2026" / "Sept 1, 2026"
 * - 数字："2026-08-31" / "2026-8-31" / "2026/08/31" / "2026.08.31"
 * - 中文："2026年8月31日"
 */
export function parseCalendarDate(dateStr: string): string {
  const cleaned = dateStr.trim();

  // 1. ISO / 斜杠 / 点号格式: 2026-08-31, 2026/8/31, 2026.08.31
  const numericMatch = cleaned.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (numericMatch) {
    const year = numericMatch[1];
    const month = numericMatch[2].padStart(2, '0');
    const day = numericMatch[3].padStart(2, '0');
    const normalized = `${year}-${month}-${day}`;
    return parseLocalDate(normalized) ? normalized : '';
  }

  // 2. 中文日期格式: 2026年8月31日
  const cnMatch = cleaned.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?$/);
  if (cnMatch) {
    const year = cnMatch[1];
    const month = cnMatch[2].padStart(2, '0');
    const day = cnMatch[3].padStart(2, '0');
    const normalized = `${year}-${month}-${day}`;
    return parseLocalDate(normalized) ? normalized : '';
  }

  // 3. 英文月份格式: "Mar 2, 2026" / "August 31, 2026"
  const enMatch = cleaned.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s*(\d{4})$/);
  if (enMatch) {
    const month = MONTH_MAP[enMatch[1].toLowerCase()];
    if (!month) return '';
    const day = enMatch[2].padStart(2, '0');
    const normalized = `${enMatch[3]}-${month}-${day}`;
    return parseLocalDate(normalized) ? normalized : '';
  }

  return '';
}

const SINGLE_DATE_PATTERN =
  '(?:[A-Za-z]{3,9}\\.?\\s+\\d{1,2},?\\s*\\d{4}|\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}|\\d{4}\\s*年\\s*\\d{1,2}\\s*月\\s*\\d{1,2}\\s*日?)';
const DATE_RANGE_REGEX = new RegExp(
  `(${SINGLE_DATE_PATTERN})\\s*(?:~|～|至|—|–|\\s-\\s)\\s*(${SINGLE_DATE_PATTERN})(?:\\s*[（(]\\s*(?:共\\s*)?(\\d+)\\s*(?:周)?\\s*[）)])?`
);

/**
 * 从文本中提取开学日期、结束日期与总周数
 */
function extractDateRange(text: string): { startDate: string; endDate: string; totalWeeks: number } {
  const rangeMatch = text.match(DATE_RANGE_REGEX);
  if (!rangeMatch) {
    return { startDate: '', endDate: '', totalWeeks: 0 };
  }

  const startDate = parseCalendarDate(rangeMatch[1]);
  const endDate = parseCalendarDate(rangeMatch[2]);
  let totalWeeks = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : 0;

  if (!totalWeeks && startDate && endDate) {
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    if (start && end && end.getTime() >= start.getTime()) {
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      totalWeeks = Math.ceil(diffDays / 7);
    }
  }

  return { startDate, endDate, totalWeeks };
}

/**
 * 从校历 HTML 的头部信息中提取开学日期
 * 兼容英文 ("Mar 2, 2026~Jul 5, 2026 (18)")、ISO ("2026-08-31~2027-01-17") 与中文日期格式
 */
export function extractStartDate(html: string): string | null {
  const header = parseHeader(html);
  return header.startDate || null;
}

/**
 * 从校历 HTML 提取头部信息
 */
function parseHeader(html: string): { semester: string; startDate: string; endDate: string; totalWeeks: number } {
  // 学年学期: "2025-2026 2"
  const semMatch = html.match(/学年度\/学期：<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/);
  const semester = semMatch ? semMatch[1].replace(/<[^>]*>/g, '').replace(/&nbsp;?/g, ' ').trim() : '';

  // 日期范围: "Mar 2, 2026~Jul 5, 2026 (18)" 或 "2026-08-31~2027-01-17 (20)"
  const dateMatch = html.match(/开始\/结束日期：<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/);
  const dateContent = dateMatch
    ? dateMatch[1].replace(/<[^>]*>/g, '').replace(/&nbsp;?/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

  let { startDate, endDate, totalWeeks } = dateContent
    ? extractDateRange(dateContent)
    : { startDate: '', endDate: '', totalWeeks: 0 };

  // 降级：从整个 HTML 中直接搜索日期范围模式
  if (!startDate) {
    const plainHtml = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;?/g, ' ').replace(/\s+/g, ' ');
    const fallback = extractDateRange(plainHtml);
    startDate = fallback.startDate;
    endDate = fallback.endDate;
    totalWeeks = fallback.totalWeeks;
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

function getCalendarCacheKey(semesterId?: number | string | null): string {
  return semesterId ? `${CACHE_KEY}_${semesterId}` : CACHE_KEY;
}

/**
 * 获取校历数据（含 SESSION_EXPIRED 自动重登重试）
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
 * 获取当前/指定学期的官方校历元数据（开学日期、结束日期、总周数）
 * 直接从 schoolCalendar!search.action 提取，不依赖反推；同时写入按学期隔离的校历缓存
 */
export async function fetchSemesterCalendarMeta(
  username: string,
  password: string,
  semesterId?: number
): Promise<SemesterCalendarMeta | null> {
  try {
    let crawler = await getCrawler(username, password);
    let html: string;
    try {
      html = await crawler.fetchSchoolCalendarHtml(semesterId);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'SESSION_EXPIRED') {
        const { invalidateSession } = await import('./session');
        invalidateSession();
        crawler = await getCrawler(username, password);
        html = await crawler.fetchSchoolCalendarHtml(semesterId);
      } else {
        throw e;
      }
    }

    const parsed = parseSchoolCalendar(html);
    const resolvedSemesterId = semesterId ? String(semesterId) : crawler.getCurrentSemesterId();

    if (parsed.startDate) {
      cacheCalendar(parsed, resolvedSemesterId);
      return {
        semesterId: resolvedSemesterId,
        semester: parsed.semester,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        totalWeeks: parsed.totalWeeks
      };
    }

    return null;
  } catch (e: unknown) {
    console.error('[calendar] fetchSemesterCalendarMeta failed:', e);
    return null;
  }
}

/**
 * 仅获取开学日期（轻量调用，保留向后兼容）
 */
export async function fetchStartDate(username: string, password: string, semesterId?: number): Promise<string | null> {
  const meta = await fetchSemesterCalendarMeta(username, password, semesterId);
  return meta?.startDate || null;
}

/**
 * 获取缓存（支持按学期隔离；allowExpired=true 时允许离线降级读取过期缓存）
 */
export function getCachedCalendar(
  semesterId?: number | string | null,
  allowExpired: boolean = false
): SchoolCalendarData | null {
  const key = getCalendarCacheKey(semesterId);
  const cached = uni.getStorageSync(key);
  if (!cached) return null;

  try {
    const data: CalendarCache = JSON.parse(cached);
    const age = Date.now() - data.lastFetchTime;
    if (allowExpired || age < CACHE_TTL) {
      return data.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 写入缓存（按学期隔离，同时写入默认 key 兼容旧读取）
 */
export function cacheCalendar(data: SchoolCalendarData, semesterId?: number | string | null): void {
  const cache: CalendarCache = { data, lastFetchTime: Date.now() };
  const serialized = JSON.stringify(cache);
  if (semesterId) {
    uni.setStorageSync(getCalendarCacheKey(semesterId), serialized);
  }
  uni.setStorageSync(CACHE_KEY, serialized);
}
