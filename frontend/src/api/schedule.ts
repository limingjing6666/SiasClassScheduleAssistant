import type { ApiResponse, Course, SyncRequest } from '@/types';
import { API } from './config';

/**
 * 封装的请求方法
 */
function request<T>(options: UniApp.RequestOptions): Promise<ApiResponse<T>> {
  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      success: (res) => {
        const data = res.data as ApiResponse<T>;
        if (data.code === 200) {
          resolve(data);
        } else {
          reject(new Error(data.msg || '请求失败'));
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '网络错误'));
      }
    });
  });
}

/**
 * 同步课表
 */
export async function syncSchedule(params: SyncRequest): Promise<Course[]> {
  const res = await request<Course[]>({
    url: API.SYNC_SCHEDULE,
    method: 'POST',
    header: {
      'Content-Type': 'application/json'
    },
    data: params
  });
  return res.data;
}

/**
 * 获取缓存的课表
 */
export async function getSchedule(studentId: string): Promise<Course[]> {
  const res = await request<Course[]>({
    url: API.GET_SCHEDULE(studentId),
    method: 'GET'
  });
  return res.data;
}

/**
 * 健康检查
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await request<string>({
      url: API.HEALTH,
      method: 'GET'
    });
    return true;
  } catch {
    return false;
  }
}
