/**
 * 课表 API 层 —— 纯本地版
 *
 * 不再请求 Java 后端，直接调用本地 crawler.ts 爬虫工具。
 * 缓存数据通过 Pinia store + uni.setStorageSync 管理。
 */

import type { Course, SyncRequest } from '@/types';
import type { ProgressCallback } from '@/types/progress';
import { fetchSchedule as crawlerFetch, translateError } from '@/utils/crawler';
import { fetchSemesterCalendarMeta } from '@/utils/calendar';
import { getCrawler } from '@/utils/session';
import { useScheduleStore } from '@/stores/schedule';

/**
 * 同步课表
 * 直接调用爬虫登录教务系统并抓取课表数据，同时直接拉取当前学期的官方校历开学日期与总周数
 */
export async function syncSchedule(params: SyncRequest, onProgress?: ProgressCallback): Promise<Course[]> {
  try {
    const wrappedProgress: ProgressCallback | undefined = onProgress
      ? (percent, status) => {
          // 为随后的校历同步保留 90%~100% 进度区间
          const mapped = percent >= 100 ? 90 : Math.min(percent, 88);
          onProgress(mapped, mapped >= 90 ? '同步学期校历...' : status);
        }
      : undefined;

    const courses = await crawlerFetch(params.username, params.password, wrappedProgress);

    // ★ 直接从当前学期校历同步开学日期与总周数（失败不影响课表返回）
    onProgress?.(94, '同步开学日期...');
    await syncSemesterCalendar(params.username, params.password);
    onProgress?.(100, '同步完成');

    return courses;
  } catch (err: unknown) {
    // 将爬虫错误码翻译为友好消息后抛出
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(translateError(msg));
  }
}

/**
 * 同步当前学期的官方开学日期与总周数
 * 复用已登录的 crawler session，在进入课表页和注册提醒前完成状态更新
 */
async function syncSemesterCalendar(username: string, password: string): Promise<void> {
  try {
    const meta = await fetchSemesterCalendarMeta(username, password);
    const store = useScheduleStore();

    if (meta && meta.startDate) {
      store.applySemesterCalendar(meta);
      console.log('[schedule] Auto-synced semester calendar:', meta);
      return;
    }

    // 校历接口未能解析时，尝试回退到该学期历史已保存的开学日期
    const crawler = await getCrawler(username, password);
    const semId = crawler.getCurrentSemesterId();
    if (semId) {
      const saved = store.getSavedSemesterMeta(semId);
      if (saved?.startDate) {
        store.applySemesterCalendar({
          semesterId: semId,
          ...saved
        });
        console.log('[schedule] Applied saved semester calendar fallback:', semId, saved.startDate);
      }
    }
  } catch (e) {
    console.warn('[schedule] Auto-sync semester calendar failed:', e);
  }
}

