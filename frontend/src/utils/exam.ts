/**
 * 考试安排 — 解析、获取、缓存
 * ★ 统一使用共享 session（getCrawler），不再创建独立 crawler
 */

import type { Exam, ExamUnscheduled, ExamData, ExamBatch, ExamCache } from '@/types/exam';
import { getCrawler } from './session';

const CACHE_KEY = 'exam_data';

/**
 * 清理单元格内容
 */
function cleanCell(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')  // 去HTML标签
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * 解析已排考考试表格
 */
function parseScheduledExams(html: string): Exam[] {
  const exams: Exam[] = [];

  // 匹配已排考考试表格（toolbar 标题为"已排考考试"）
  const scheduledMatch = html.match(/已排考考试[\s\S]*?<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!scheduledMatch) return exams;

  const rows = scheduledMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
  if (!rows) return exams;

  for (const row of rows) {
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g);
    if (!cells || cells.length < 10) continue;

    const values = cells.map(c => cleanCell(c));

    exams.push({
      courseCode: values[0],
      courseName: values[1],
      type: values[2],
      examType: values[3],
      date: values[4],
      time: values[5],
      room: values[6],
      seatNo: values[7],
      status: values[8],
      remark: values[9]
    });
  }

  return exams;
}

/**
 * 解析不排考考试表格
 */
function parseUnscheduledExams(html: string): ExamUnscheduled[] {
  const exams: ExamUnscheduled[] = [];

  // 匹配不排考考试表格（toolbar 标题为"不排考考试"）
  const unscheduledMatch = html.match(/不排考考试[\s\S]*?<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!unscheduledMatch) return exams;

  const rows = unscheduledMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
  if (!rows) return exams;

  for (const row of rows) {
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g);
    if (!cells || cells.length < 2) continue;

    const values = cells.map(c => cleanCell(c));

    exams.push({
      courseCode: values[0],
      courseName: values[1]
    });
  }

  return exams;
}

/**
 * 解析考试 HTML
 */
export function parseExams(html: string): ExamData {
  return {
    scheduled: parseScheduledExams(html),
    unscheduled: parseUnscheduledExams(html)
  };
}

/**
 * 获取指定学期的考试批次列表
 * ★ 统一使用共享 session
 */
export async function fetchExamBatches(username: string, password: string, semesterId?: number): Promise<ExamBatch[]> {
  try {
    const crawler = await getCrawler(username, password);
    return await crawler.fetchExamBatches(semesterId);
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'SESSION_EXPIRED') {
      const { invalidateSession } = await import('./session');
      invalidateSession();
      const crawler = await getCrawler(username, password);
      return await crawler.fetchExamBatches(semesterId);
    }
    throw e;
  }
}

/**
 * 获取指定考试批次的考试数据
 * @param batchId 考试批次ID（从 fetchExamBatches 获取）
 */
export async function fetchExams(username: string, password: string, batchId: number): Promise<ExamData> {
  try {
    const crawler = await getCrawler(username, password);
    const html = await crawler.fetchExamTableHtml(batchId);
    return parseExams(html);
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'SESSION_EXPIRED') {
      const { invalidateSession } = await import('./session');
      invalidateSession();
      const crawler = await getCrawler(username, password);
      const html = await crawler.fetchExamTableHtml(batchId);
      return parseExams(html);
    }
    throw e;
  }
}

/**
 * 获取缓存（24h 过期）
 */
export function getCachedExams(): ExamData | null {
  const cached = uni.getStorageSync(CACHE_KEY);
  if (!cached) return null;

  try {
    const data: ExamCache = JSON.parse(cached);
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
export function cacheExams(data: ExamData): void {
  const cache: ExamCache = { data, lastFetchTime: Date.now() };
  uni.setStorageSync(CACHE_KEY, JSON.stringify(cache));
}
