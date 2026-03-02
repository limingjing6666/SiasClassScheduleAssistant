/**
 * 课表 API 层 —— 纯本地版
 *
 * 不再请求 Java 后端，直接调用本地 crawler.ts 爬虫工具。
 * 缓存数据通过 Pinia store + uni.setStorageSync 管理。
 */

import type { Course, SyncRequest } from '@/types';
import { fetchSchedule as crawlerFetch, translateError } from '@/utils/crawler';

/**
 * 同步课表
 * 直接调用爬虫登录教务系统并抓取课表数据
 */
export async function syncSchedule(params: SyncRequest): Promise<Course[]> {
  try {
    const courses = await crawlerFetch(params.username, params.password);
    return courses;
  } catch (err: unknown) {
    // 将爬虫错误码翻译为友好消息后抛出
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(translateError(msg));
  }
}

