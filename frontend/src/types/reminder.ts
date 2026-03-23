/**
 * 提醒相关类型定义
 */

// 提醒设置
export interface ReminderSettings {
  /** 是否启用提醒 */
  enabled: boolean;
  /** 提前提醒时间（分钟） */
  advanceMinutes: number;
  /** 是否播放声音 */
  sound: boolean;
  /** 是否震动 */
  vibration: boolean;
}

// 提醒任务
export interface ReminderTask {
  /** 课程ID */
  courseId: string;
  /** 课程名称 */
  courseName: string;
  /** 教师姓名 */
  teacher: string;
  /** 教室 */
  room: string;
  /** 开始时间 */
  startTime: string;
  /** 结束时间 */
  endTime: string;
  /** 提醒时间 */
  remindAt: Date;
}

// 提前提醒时间选项
export interface AdvanceOption {
  /** 分钟数 */
  value: number;
  /** 显示标签 */
  label: string;
}
