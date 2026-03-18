import { NODE_TIMES, parseNodes } from './schedule';
import type { Course } from '@/types';

// 声明 plus API 避免 TS 报错
declare const plus: any;

/**
 * 提前 20 分钟唤醒 (毫秒)
 */
const REMINDER_OFFSET = 20 * 60 * 1000;

/**
 * 预埋未来 7 天的本地课表推送通知
 * @param courses 课程列表
 * @param semesterStart 开学日期 (YYYY-MM-DD)
 */
export function setupClassReminders(courses: Course[], semesterStart: string) {
  // #ifndef APP-PLUS
  console.log('[Notification] 非 App 环境，跳过本地推送设置');
  return;
  // #endif

  try {
    if (typeof plus === 'undefined') return;
    
    // 清空现有的所有本地定时推送，避免重复
    plus.push.clear();

    const now = new Date();
    // 只预埋未来 7 天的课，防止定时器队列过多或被系统强杀
    const maxTime = now.getTime() + 7 * 24 * 60 * 60 * 1000;
    
    // 将 '2026-03-02' 转换为具体日期
    const startParts = semesterStart.split('-');
    const startObj = new Date(
      parseInt(startParts[0], 10),
      parseInt(startParts[1], 10) - 1,
      parseInt(startParts[2], 10)
    );
    startObj.setHours(0, 0, 0, 0);

    let addedCount = 0;

    for (const course of courses) {
      if (!course.weeks) continue;
      
      // weeks 是如 '00000000001010111' 这样的二进制字符串
      for (let w = 1; w < course.weeks.length; w++) {
        if (course.weeks.charAt(w) === '1') {
          const dayOffset = parseInt(course.day, 10) - 1; // 0-6 (周一...周日)
          const totalDaysOffset = (w - 1) * 7 + dayOffset;
          
          const classDate = new Date(startObj.getTime() + totalDaysOffset * 24 * 60 * 60 * 1000);
          
          const { start } = parseNodes(course.nodes);
          const timeStr = NODE_TIMES[start]?.start; // e.g. "08:00"
          if (!timeStr) continue;
          
          const [hr, min] = timeStr.split(':').map(Number);
          classDate.setHours(hr, min, 0, 0);
          
          const classTime = classDate.getTime();
          const triggerTime = classTime - REMINDER_OFFSET;
          
          // 如果触发时间在当前之后且在 7 天之内，则注册
          if (triggerTime > now.getTime() && triggerTime <= maxTime) {
            const delaySeconds = Math.floor((triggerTime - now.getTime()) / 1000);
            if (delaySeconds > 0) {
              plus.push.createMessage(
                `你的【${course.name}】将在 20 分钟后开始`,
                JSON.stringify({ type: 'class_reminder', action: 'open_schedule' }),
                {
                  title: `${course.room} 上课提醒`,
                  delay: delaySeconds // 核心修复：H5+ 原生推送必须使用 delay 才能真正延时弹出
                }
              );
              addedCount++;
            }
          }
        }
      }
    }
    
    console.log(`[Notification] 成功预埋了 ${addedCount} 条未来 7 天的上课提醒`);
  } catch (err) {
    console.error('[Notification] 预埋提醒失败:', err);
  }
}

/**
 * 清除所有推送提醒
 */
export function clearReminders() {
  // #ifndef APP-PLUS
  return;
  // #endif
  try {
    if (typeof plus !== 'undefined') {
      plus.push.clear();
      console.log('[Notification] 已清除所有本地推送提醒');
    }
  } catch (err) {
    console.error('[Notification] 清除提醒失败:', err);
  }
}
