/**
 * 考试相关类型定义
 */

// 已排考考试
export interface Exam {
  /** 课程序号 */
  courseCode: string;
  /** 课程名称 */
  courseName: string;
  /** 修读类别 */
  type: string;
  /** 考试类别 */
  examType: string;
  /** 考试日期 */
  date: string;
  /** 考试时间 */
  time: string;
  /** 考试地点 */
  room: string;
  /** 座位号 */
  seatNo: string;
  /** 考试情况 */
  status: string;
  /** 其它说明 */
  remark: string;
}

// 不排考考试
export interface ExamUnscheduled {
  /** 课程序号 */
  courseCode: string;
  /** 课程名称 */
  courseName: string;
}

// 考试批次
export interface ExamBatch {
  /** 批次ID */
  id: number;
  /** 批次名称，如 "2025-2026学年秋季学期期末考试" */
  name: string;
}

// 考试数据汇总
export interface ExamData {
  /** 已排考考试 */
  scheduled: Exam[];
  /** 不排考考试 */
  unscheduled: ExamUnscheduled[];
}

// 考试缓存
export interface ExamCache {
  data: ExamData;
  lastFetchTime: number;
}
