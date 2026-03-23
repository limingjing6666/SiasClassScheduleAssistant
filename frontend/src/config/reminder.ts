/**
 * 提醒配置文件
 */

import type { ReminderSettings, AdvanceOption } from '@/types/reminder';

/**
 * 默认提醒设置
 */
export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,           // 默认开启提醒
  advanceMinutes: 20,      // 默认提前提醒20分钟
  sound: true,             // 默认播放声音
  vibration: true          // 默认震动
};

/**
 * 提前提醒时间选项
 */
export const ADVANCE_OPTIONS: AdvanceOption[] = [
  { value: 5, label: '5分钟' },
  { value: 10, label: '10分钟' },
  { value: 15, label: '15分钟' },
  { value: 20, label: '20分钟' },
  { value: 30, label: '30分钟' }
];

/**
 * 缓存键：提醒设置
 */
export const REMINDER_CACHE_KEY = 'reminder_settings';

/**
 * 缓存键：通知ID列表
 */
export const NOTIFICATION_IDS_KEY = 'notification_ids';
