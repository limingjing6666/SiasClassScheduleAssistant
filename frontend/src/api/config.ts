/*
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-01-26 20:01:08
 * @LastEditors: limingjing6666 limingjing6868@gmail.com
 * @LastEditTime: 2026-02-28 23:16:15
 * @FilePath: \frontend\src\api\config.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/**
 * API配置
 */

// 后端服务器地址
export const BASE_URL = 'http://192.168.0.168:8080';

// API端点
export const API = {
  // 同步课表
  SYNC_SCHEDULE: `${BASE_URL}/api/schedule/sync`,
  // 获取缓存课表
  GET_SCHEDULE: (studentId: string) => `${BASE_URL}/api/schedule/${studentId}`,
  // 健康检查
  HEALTH: `${BASE_URL}/api/schedule/health`
};
