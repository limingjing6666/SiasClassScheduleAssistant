/**
 * 学期列表统一管理模块（Single Source of Truth）
 *
 * 职责：
 * 1. 按学年与学期语义（而非接口返回顺序或数组下标）进行排序与比较
 * 2. 统一管理 history_semesters 缓存（含离线过期缓存降级）
 * 3. 按页面场景（all / upToCurrent / history）提供筛选后的学期列表与默认下标
 */

import { readPassword } from '@/utils/crypto';
import { getCrawler } from '@/utils/session';
import { useScheduleStore } from '@/stores/schedule';

export interface SemesterInfo {
  id: number;
  schoolYear: string;
  name: string;
}

export interface SemesterOption extends SemesterInfo {
  label: string;
  isRegular: boolean;
}

/**
 * 学期筛选范围：
 * - all: 全部学期（校历页，允许预览下学期，默认定位当前学期）
 * - upToCurrent: 截止到当前学期（成绩/考试页，过滤未开学的未来学期）
 * - history: 严格早于当前学期（历史课表页，默认跳过小学期定位最近常规学期）
 */
export type SemesterScope = 'all' | 'upToCurrent' | 'history';

export interface SemesterOptionsResult {
  options: SemesterOption[];
  defaultIndex: number;
  currentSemesterId: string | null;
}

const SEMESTERS_CACHE_KEY = 'history_semesters';
const SEMESTERS_CACHE_TTL = 24 * 60 * 60 * 1000;

interface CachedSemestersPayload {
  semesters: SemesterInfo[];
  lastFetchTime: number;
}

/**
 * 解析学年起始年份，如 "2026-2027" → 2026
 */
export function parseSchoolYearStart(schoolYear: string): number {
  const year = parseInt(String(schoolYear || ''), 10);
  return Number.isFinite(year) ? year : 0;
}

/**
 * 将学期名称映射为学年内的先后顺序：
 * 第1学期（秋）= 1，冬季学期 = 1.5，第2学期（春）= 2，夏季/小学期 = 3
 */
export function getTermRank(name: string): number {
  const trimmed = String(name || '').trim();
  if (trimmed === '1' || /第一|秋/.test(trimmed)) return 1;
  if (/冬/.test(trimmed)) return 1.5;
  if (trimmed === '2' || /第二|春/.test(trimmed)) return 2;
  if (trimmed === '3' || /夏|暑|小/.test(trimmed)) return 3;
  const num = parseInt(trimmed, 10);
  return Number.isFinite(num) ? num : 9;
}

/**
 * 是否为常规教学学期（第1/第2学期，排除夏季小学期）
 */
export function isRegularSemester(name: string): boolean {
  const rank = getTermRank(name);
  return rank === 1 || rank === 2;
}

/**
 * 按真实时间先后比较两个学期（< 0 表示 a 早于 b）
 */
export function compareSemesters(a: SemesterInfo, b: SemesterInfo): number {
  const yearDiff = parseSchoolYearStart(a.schoolYear) - parseSchoolYearStart(b.schoolYear);
  if (yearDiff !== 0) return yearDiff;

  const rankDiff = getTermRank(a.name) - getTermRank(b.name);
  if (rankDiff !== 0) return rankDiff;

  return a.id - b.id;
}

/**
 * 统一格式化下拉展示标签
 * - "2026-2027" + "1" → "2026-2027 第1学期"
 * - "2025-2026" + "夏季" → "2025-2026 夏季学期"
 */
export function formatSemesterLabel(semester: SemesterInfo): string {
  const name = String(semester.name || '').trim();
  if (/^\d+$/.test(name)) {
    return `${semester.schoolYear} 第${name}学期`;
  }
  if (name.includes('学期')) {
    return `${semester.schoolYear} ${name}`;
  }
  return name ? `${semester.schoolYear} ${name}学期` : semester.schoolYear;
}

/**
 * 仅在未同步到 currentSemesterId 时作为降级估算当前学期
 */
function estimateCurrentSemester(sortedDesc: SemesterInfo[], now: Date = new Date()): SemesterInfo | null {
  if (sortedDesc.length === 0) return null;

  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  let targetStartYear: number;
  let targetRank: number;
  if (month >= 9 || (month === 8 && day >= 20)) {
    targetStartYear = year;
    targetRank = 1;
  } else if (month >= 2) {
    targetStartYear = year - 1;
    targetRank = 2;
  } else {
    targetStartYear = year - 1;
    targetRank = 1;
  }

  const exact = sortedDesc.find(
    s => parseSchoolYearStart(s.schoolYear) === targetStartYear && getTermRank(s.name) === targetRank
  );
  if (exact) return exact;

  const targetKey = targetStartYear * 10 + targetRank;
  const latestNotAfter = sortedDesc.find(
    s => parseSchoolYearStart(s.schoolYear) * 10 + getTermRank(s.name) <= targetKey
  );
  return latestNotAfter || sortedDesc[0];
}

/**
 * 纯函数：根据学期列表、当前学期 ID 与场景范围计算展示列表和默认下标
 */
export function resolveSemesterOptions(
  rawSemesters: SemesterInfo[],
  currentSemesterId: string | number | null | undefined,
  scope: SemesterScope,
  now: Date = new Date()
): SemesterOptionsResult {
  // 按 id 去重
  const dedupedMap = new Map<number, SemesterInfo>();
  for (const item of rawSemesters) {
    if (item && typeof item.id === 'number') {
      dedupedMap.set(item.id, {
        id: item.id,
        schoolYear: String(item.schoolYear || '').trim(),
        name: String(item.name || '').trim()
      });
    }
  }

  // 按时间从新到旧排序（不依赖接口返回顺序）
  const sortedDesc = Array.from(dedupedMap.values()).sort((a, b) => compareSemesters(b, a));

  const currentIdStr = currentSemesterId ? String(currentSemesterId) : '';
  const current =
    (currentIdStr ? sortedDesc.find(s => String(s.id) === currentIdStr) : undefined) ||
    estimateCurrentSemester(sortedDesc, now);

  let filtered = sortedDesc;
  if (current) {
    if (scope === 'upToCurrent') {
      filtered = sortedDesc.filter(s => compareSemesters(s, current) <= 0);
    } else if (scope === 'history') {
      filtered = sortedDesc.filter(s => compareSemesters(s, current) < 0);
    }
  }

  const options: SemesterOption[] = filtered.map(s => ({
    ...s,
    label: formatSemesterLabel(s),
    isRegular: isRegularSemester(s.name)
  }));

  let defaultIndex = 0;
  if (options.length > 0) {
    if (scope === 'history') {
      // 历史课表优先落在最近一个常规学期（跳过通常为空的夏季小学期）
      const regularIdx = options.findIndex(o => o.isRegular);
      defaultIndex = regularIdx >= 0 ? regularIdx : 0;
    } else if (current) {
      const currIdx = options.findIndex(o => o.id === current.id);
      defaultIndex = currIdx >= 0 ? currIdx : 0;
    }
  }

  return {
    options,
    defaultIndex,
    currentSemesterId: current ? String(current.id) : null
  };
}

function readCachedSemesters(allowExpired: boolean): SemesterInfo[] | null {
  const raw = uni.getStorageSync(SEMESTERS_CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed: CachedSemestersPayload = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || !Array.isArray(parsed.semesters) || parsed.semesters.length === 0) {
      return null;
    }
    const age = Date.now() - (parsed.lastFetchTime || 0);
    if (allowExpired || age < SEMESTERS_CACHE_TTL) {
      return parsed.semesters;
    }
    return null;
  } catch {
    return null;
  }
}

function readStoredCredentials(): { username: string; password: string } | null {
  const cachedUser = uni.getStorageSync('userInfo');
  if (!cachedUser) return null;
  try {
    const { username, password: storedPwd } = JSON.parse(cachedUser);
    const password = readPassword(storedPwd, username);
    if (!username || !password) return null;
    return { username, password };
  } catch {
    return null;
  }
}

/**
 * 统一加载学期选项（自动复用缓存、按需拉取、离线降级）
 */
export async function loadSemesterOptions(scope: SemesterScope): Promise<SemesterOptionsResult> {
  const store = useScheduleStore();
  let currentSemesterId: string | null = store.currentSemesterId || null;

  // 1. 优先使用 24h 内有效缓存
  const freshCached = readCachedSemesters(false);
  if (freshCached) {
    return resolveSemesterOptions(freshCached, currentSemesterId, scope);
  }

  // 2. 缓存缺失或已过期，尝试从教务系统拉取
  try {
    const creds = readStoredCredentials();
    if (!creds) {
      const stale = readCachedSemesters(true);
      if (stale) {
        return resolveSemesterOptions(stale, currentSemesterId, scope);
      }
      throw new Error('NOT_LOGGED_IN');
    }

    const crawler = await getCrawler(creds.username, creds.password);
    if (!currentSemesterId) {
      const detected = crawler.getCurrentSemesterId();
      if (detected) {
        currentSemesterId = detected;
        store.currentSemesterId = detected;
        uni.setStorageSync('currentSemesterId', detected);
      }
    }

    const fetchOk = await crawler.fetchSemesters();
    const rawSemesters = fetchOk ? crawler.getSemesters() : [];

    if (rawSemesters.length > 0) {
      uni.setStorageSync(SEMESTERS_CACHE_KEY, {
        semesters: rawSemesters,
        lastFetchTime: Date.now()
      });
      return resolveSemesterOptions(rawSemesters, currentSemesterId, scope);
    }

    throw new Error('FETCH_SEMESTERS_FAILED');
  } catch (e: unknown) {
    // 3. 离线/非校园网降级：允许回退使用过期缓存
    const stale = readCachedSemesters(true);
    if (stale) {
      console.warn('[semester] Fetch failed, using stale cached semesters:', e);
      return resolveSemesterOptions(stale, currentSemesterId, scope);
    }
    throw e;
  }
}
