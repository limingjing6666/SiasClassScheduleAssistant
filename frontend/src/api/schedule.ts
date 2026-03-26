/**
 * 课表 API 层 —— 纯本地版
 *
 * 不再请求 Java 后端，直接调用本地 crawler.ts 爬虫工具。
 * 缓存数据通过 Pinia store + uni.setStorageSync 管理。
 */

import type { Course, SyncRequest } from '@/types';
import type { ProgressCallback } from '@/types/progress';
import { fetchSchedule as crawlerFetch, translateError } from '@/utils/crawler';
import { fetchStartDate } from '@/utils/calendar';
import { useScheduleStore } from '@/stores/schedule';

/**
 * 同步课表
 * 直接调用爬虫登录教务系统并抓取课表数据
 */
export async function syncSchedule(params: SyncRequest, onProgress?: ProgressCallback): Promise<Course[]> {
  try {
    const courses = await crawlerFetch(params.username, params.password, onProgress);

    // ★ 自动从校历同步开学日期（异步，不阻塞课表返回）
    syncStartDateInBackground(params.username, params.password);

    return courses;
  } catch (err: unknown) {
    // 将爬虫错误码翻译为友好消息后抛出
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(translateError(msg));
  }
}

/**
 * 后台同步开学日期（不阻塞主流程）
 */
function syncStartDateInBackground(username: string, password: string): void {
  fetchStartDate(username, password)
    .then((startDate) => {
      if (startDate) {
        const cached = uni.getStorageSync('semesterStart');
        if (cached !== startDate) {
          uni.setStorageSync('semesterStart', startDate);
          // 同步更新 Pinia store 内存（避免需要重启才生效）
          try {
            const store = useScheduleStore();
            store.setSemesterStart(startDate);
          } catch { /* store 未初始化时忽略 */ }
          console.log('[schedule] Auto-synced semester start date:', startDate);
        }
      }
    })
    .catch((e) => {
      console.warn('[schedule] Auto-sync start date failed:', e);
    });
}

