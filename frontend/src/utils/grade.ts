/**
 * 成绩查询爬虫
 * 从教务系统获取成绩数据
 */

import type { Grade, GradeCache } from '@/types/grade';
import { getCrawler } from './session';

// 缓存键前缀
const CACHE_KEY_PREFIX = 'grades_';

/**
 * 清理单元格内容
 * 去除HTML标签，处理空值
 */
function cleanCell(value: string): string | null {
  // 去除HTML标签
  const cleaned = value.replace(/<[^>]*>/g, '').trim();
  // 处理空值
  if (cleaned === '' || cleaned === '&nbsp;') {
    return null;
  }
  return cleaned;
}

/**
 * 解析HTML成绩数据
 * @param html HTML字符串
 * @returns 成绩列表
 */
export function parseGrades(html: string): Grade[] {
  const grades: Grade[] = [];
  
  // 定位表格
  const tableMatch = html.match(/<table[^>]*id="grid[^"]*"[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) {
    console.log('[parseGrades] No table found');
    return grades;
  }
  
  // 解析表头
  const theadMatch = tableMatch[1].match(/<thead[^>]*>([\s\S]*?)<\/thead>/);
  if (!theadMatch) {
    console.log('[parseGrades] No thead found');
    return grades;
  }
  
  // 提取表头文本
  const headers = theadMatch[1].match(/<th[^>]*>([\s\S]*?)<\/th>/g);
  const headerTexts = headers ? headers.map(h => h.replace(/<[^>]*>/g, '').trim()) : [];
  
  
  // 字段映射
  const fieldMap: { [key: string]: string } = {
    '学年学期': 'semester',
    '课程代码': 'courseCode',
    '课程序号': 'courseSeq',
    '课程名称': 'courseName',
    '课程类别': 'category',
    '学分': 'credit',
    '平时成绩': 'dailyScore',
    '期中成绩': 'midtermScore',
    '期末成绩': 'finalScore',
    '实验成绩': 'labScore',
    '总评成绩': 'totalScore',
    '最终': 'finalGrade',
    '绩点': 'gpa',
    '状态': 'status'
  };
  
  // 构建字段索引映射
  const fieldIndices: { [key: string]: number } = {};
  for (let i = 0; i < headerTexts.length; i++) {
    const fieldName = fieldMap[headerTexts[i]];
    if (fieldName) {
      fieldIndices[fieldName] = i;
    }
  }
  
  
  // 定位表格体
  const tbodyMatch = tableMatch[1].match(/<tbody[^>]*id="grid[^"]*_data"[^>]*>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) {
    console.log('[parseGrades] No tbody found');
    return grades;
  }
  
  // 分割每一行
  const rows = tbodyMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
  if (!rows) {
    console.log('[parseGrades] No rows found');
    return grades;
  }
  
  // 解析数字
  const parseFloatOrNull = (v: string | null) => {
    if (v === null) return null;
    const num = parseFloat(v);
    return isNaN(num) ? null : num;
  };
  
  for (const row of rows) {
    // 提取单元格
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g);
    
    // 检查单元格数量
    if (!cells || cells.length < 10) {
      console.log('[parseGrades] Invalid row, cells count:', cells?.length);
      continue;
    }
    
    // 清理单元格内容，允许空单元格
    const values = cells.map(cell => cleanCell(cell) || '');
    
    
    // 根据字段索引动态构建成绩对象
    const grade: Grade = {
      semester: '',
      courseCode: '',
      courseSeq: '',
      courseName: '',
      category: '',
      credit: 0,
      dailyScore: null,
      midtermScore: null,
      finalScore: null,
      labScore: null,
      totalScore: null,
      finalGrade: '',
      gpa: null,
      status: ''
    };
    
    // 根据字段索引填充数据
    const gradeRecord = grade as unknown as Record<string, string | number | null>;
    for (const fieldName in fieldIndices) {
      const index = fieldIndices[fieldName];
      if (index < values.length) {
        const value = values[index];
        if (value) {
          if (fieldName === 'credit') {
            gradeRecord[fieldName] = parseFloatOrNull(value) || 0;
          } else if (['dailyScore', 'midtermScore', 'finalScore', 'labScore', 'totalScore', 'gpa'].includes(fieldName)) {
            gradeRecord[fieldName] = parseFloatOrNull(value);
          } else {
            gradeRecord[fieldName] = value;
          }
        }
      }
    }
    
    grades.push(grade);
  }
  
  console.log('[parseGrades] Parsed:', grades.length);
  return grades;
}

/**
 * 获取成绩
 * @param username 学号
 * @param password 密码
 * @param semesterId 学期ID
 * @returns 成绩列表
 */
export async function fetchGrades(username: string, password: string, semesterId: number): Promise<Grade[]> {

  try {
    const crawler = await getCrawler(username, password);
    const html = await crawler.fetchGradeHtml(semesterId);
    return parseGrades(html);
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'SESSION_EXPIRED') {
      console.log('[fetchGrades] Session expired, retrying...');
      const crawler = await getCrawler(username, password);
      const html = await crawler.fetchGradeHtml(semesterId);
      return parseGrades(html);
    }
    throw e;
  }
}

/**
 * 获取缓存的成绩
 * @param semesterId 学期ID
 * @returns 缓存的成绩列表或null
 */
export function getCachedGrades(semesterId: number): Grade[] | null {
  const cacheKey = `${CACHE_KEY_PREFIX}${semesterId}`;
  const cached = uni.getStorageSync(cacheKey);
  
  if (!cached) {
    return null;
  }
  
  try {
    const data: GradeCache = JSON.parse(cached);
    const cacheAge = Date.now() - data.lastFetchTime;
    const cacheExpiry = 24 * 60 * 60 * 1000; // 24小时过期
    
    if (cacheAge < cacheExpiry) {
      return data.grades;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 缓存成绩
 * @param semesterId 学期ID
 * @param grades 成绩列表
 */
export function cacheGrades(semesterId: number, grades: Grade[]): void {
  const cacheKey = `${CACHE_KEY_PREFIX}${semesterId}`;
  const data: GradeCache = {
    grades: grades,
    lastFetchTime: Date.now()
  };
  
  uni.setStorageSync(cacheKey, JSON.stringify(data));
}

/**
 * 清除所有成绩缓存
 */
export function clearAllGradesCache(): void {
  try {
    const info = uni.getStorageInfoSync();
    const keys = info.keys || [];
    
    for (const key of keys) {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        uni.removeStorageSync(key);
      }
    }
    
  } catch {
    // 忽略错误
  }
}
