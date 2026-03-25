/**
 * 平均成绩排名 — 解析、获取、缓存
 */

import type { GradeAverage, GradeAvgCache } from '@/types/grade';
import { getCrawler } from './session';

const CACHE_KEY = 'grade_avg';

/**
 * 解析平均成绩 HTML 表格
 * 表格列顺序：统计时间范围 | 学号 | 姓名 | 院系 | 专业 | 班级 | 平均成绩 | 专业排名 | 班级排名 | 统计时间
 */
export function parseGradeAvg(html: string): GradeAverage[] {
  const results: GradeAverage[] = [];

  // 匹配所有数据行（跳过表头行）
  const rows = html.match(/<tr[^>]*style="font-Weight:bold;height:25px"[^>]*>([\s\S]*?)<\/tr>/g);
  if (!rows) {
    console.log('[parseGradeAvg] No data rows found');
    return results;
  }

  for (const row of rows) {
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g);
    if (!cells || cells.length < 10) {
      console.log('[parseGradeAvg] Invalid row, cells:', cells?.length);
      continue;
    }

    // 提取纯文本
    const values = cells.map(c => c.replace(/<[^>]*>/g, '').trim());

    results.push({
      period: values[0],
      studentId: values[1],
      name: values[2],
      department: values[3],
      major: values[4],
      className: values[5],
      avgScore: parseFloat(values[6]) || 0,
      majorRank: parseInt(values[7], 10) || 0,
      classRank: parseInt(values[8], 10) || 0,
      statTime: values[9]
    });
  }

  return results;
}

/**
 * 获取平均成绩
 */
export async function fetchGradeAvg(username: string, password: string): Promise<GradeAverage[]> {

  try {
    const crawler = await getCrawler(username, password);
    const html = await crawler.fetchGradeAvgHtml();
    return parseGradeAvg(html);
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'SESSION_EXPIRED') {
      console.log('[fetchGradeAvg] Session expired, retrying...');
      const crawler = await getCrawler(username, password);
      const html = await crawler.fetchGradeAvgHtml();
      return parseGradeAvg(html);
    }
    throw e;
  }
}

/**
 * 获取缓存的平均成绩（24h 过期）
 */
export function getCachedGradeAvg(): GradeAverage[] | null {
  const cached = uni.getStorageSync(CACHE_KEY);
  if (!cached) return null;

  try {
    const data: GradeAvgCache = JSON.parse(cached);
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
export function cacheGradeAvg(data: GradeAverage[]): void {
  const cache: GradeAvgCache = { data, lastFetchTime: Date.now() };
  uni.setStorageSync(CACHE_KEY, JSON.stringify(cache));
}
