/**
 * 成绩类型定义
 */

// 成绩接口
export interface Grade {
  /** 学年学期 */
  semester: string;
  /** 课程代码 */
  courseCode: string;
  /** 课程序号 */
  courseSeq: string;
  /** 课程名称 */
  courseName: string;
  /** 课程类别 */
  category: string;
  /** 学分 */
  credit: number;
  /** 平时成绩 */
  dailyScore: number | null;
  /** 期中成绩 */
  midtermScore: number | null;
  /** 期末成绩 */
  finalScore: number | null;
  /** 实验成绩 */
  labScore: number | null;
  /** 总评成绩 */
  totalScore: number | null;
  /** 最终成绩（可能为字母或数字） */
  finalGrade: string;
  /** 绩点 */
  gpa: number | null;
  /** 状态 */
  status: string;
}

// 平均成绩排名
export interface GradeAverage {
  /** 统计时间范围（如 "2025-2026学年"、"历年"） */
  period: string;
  /** 学号 */
  studentId: string;
  /** 姓名 */
  name: string;
  /** 院系 */
  department: string;
  /** 专业 */
  major: string;
  /** 班级 */
  className: string;
  /** 平均成绩 */
  avgScore: number;
  /** 专业排名 */
  majorRank: number;
  /** 班级排名 */
  classRank: number;
  /** 统计时间 */
  statTime: string;
}

// 成绩缓存数据
export interface GradeCache {
  grades: Grade[];
  lastFetchTime: number;
}

// 平均成绩缓存数据
export interface GradeAvgCache {
  data: GradeAverage[];
  lastFetchTime: number;
}
