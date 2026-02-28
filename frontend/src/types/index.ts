/**
 * 课程数据接口
 */
export interface Course {
  /** 课程名称 */
  name: string;
  /** 教师姓名 */
  teacher: string;
  /** 教室 */
  room: string;
  /** 星期几 (1-7) */
  day: string;
  /** 节次 (如 "1-2") */
  nodes: string;
  /** 周次二进制字符串 (如 "010101...") */
  weeks: string;
}

/**
 * API响应接口
 */
export interface ApiResponse<T> {
  /** 状态码 */
  code: number;
  /** 消息 */
  msg: string;
  /** 数据 */
  data: T;
}

/**
 * 同步请求接口
 */
export interface SyncRequest {
  /** 学号 */
  username: string;
  /** 密码 */
  password: string;
}

/**
 * 用户信息接口
 */
export interface UserInfo {
  /** 学号 */
  studentId: string;
  /** 姓名 */
  name?: string;
  /** 最后同步时间 */
  lastSyncAt?: string;
}

/**
 * 渲染用课程数据 (带样式信息)
 */
export interface RenderCourse extends Course {
  /** 开始节次 */
  startNode: number;
  /** 持续节数 */
  step: number;
  /** 背景颜色 */
  color: string;
}
