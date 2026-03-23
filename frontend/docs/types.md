# 类型定义文档

> 西亚斯课表助手的TypeScript类型定义，包括Course、SyncRequest、UserInfo、RenderCourse等接口

## 📋 目录

- [Course](#course)
- [SyncRequest](#syncrequest)
- [UserInfo](#userinfo)
- [RenderCourse](#rendercourse)
- [类型约束说明](#类型约束说明)
- [使用示例](#使用示例)

## Course

课程数据接口，表示从教务系统抓取的原始课程信息。

### 接口定义

```typescript
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
```

### 属性说明

| 属性名 | 类型 | 必需 | 说明 | 示例 |
|--------|------|------|------|------|
| name | string | 是 | 课程名称 | "高等数学" |
| teacher | string | 是 | 教师姓名 | "张三" |
| room | string | 是 | 教室 | "教学楼A101" |
| day | string | 是 | 星期几 (1-7) | "1" (周一) |
| nodes | string | 是 | 节次 | "1-2" (第1-2节) |
| weeks | string | 是 | 周次二进制字符串 | "01010101010101010101" |

### 周次二进制字符串说明

`weeks` 字段是一个二进制字符串，每一位代表一个周次：
- 位置0：忽略（不使用）
- 位置1：第1周
- 位置2：第2周
- 以此类推...

**示例：**
```
"01010101010101010101"
  ^  ^  ^  ^  ^  ^  ^
  |  |  |  |  |  |  |
  |  |  |  |  |  |  第20周
  |  |  |  |  |  第18周
  |  |  |  |  第16周
  |  |  |  第14周
  |  |  第12周
  |  第10周
  第8周
```

### 使用示例

```typescript
import type { Course } from '@/types';

const course: Course = {
  name: '高等数学',
  teacher: '张三',
  room: '教学楼A101',
  day: '1',
  nodes: '1-2',
  weeks: '01010101010101010101'
};
```

## SyncRequest

同步请求接口，用于登录教务系统。

### 接口定义

```typescript
export interface SyncRequest {
  /** 学号 */
  username: string;
  /** 密码 */
  password: string;
}
```

### 属性说明

| 属性名 | 类型 | 必需 | 说明 | 示例 |
|--------|------|------|------|------|
| username | string | 是 | 学号 | "20240001" |
| password | string | 是 | 密码 | "password123" |

### 使用示例

```typescript
import type { SyncRequest } from '@/types';

const request: SyncRequest = {
  username: '20240001',
  password: 'password123'
};
```

## UserInfo

用户信息接口，表示登录用户的基本信息。

### 接口定义

```typescript
export interface UserInfo {
  /** 学号 */
  studentId: string;
  /** 姓名 */
  name?: string;
  /** 最后同步时间 */
  lastSyncAt?: string;
}
```

### 属性说明

| 属性名 | 类型 | 必需 | 说明 | 示例 |
|--------|------|------|------|------|
| studentId | string | 是 | 学号 | "20240001" |
| name | string | 否 | 姓名 | "李四" |
| lastSyncAt | string | 否 | 最后同步时间 (ISO 8601格式) | "2024-03-01T10:30:00.000Z" |

### 使用示例

```typescript
import type { UserInfo } from '@/types';

const user: UserInfo = {
  studentId: '20240001',
  name: '李四',
  lastSyncAt: new Date().toISOString()
};
```

## RenderCourse

渲染用课程数据接口，扩展自Course，包含样式信息。

### 接口定义

```typescript
export interface RenderCourse extends Course {
  /** 开始节次 */
  startNode: number;
  /** 持续节数 */
  step: number;
  /** 背景颜色 */
  color: string;
  /** 暖色边框色 */
  glowColor: string;
}
```

### 属性说明

| 属性名 | 类型 | 必需 | 说明 | 示例 |
|--------|------|------|------|------|
| startNode | number | 是 | 开始节次 | 1 |
| step | number | 是 | 持续节数 | 2 |
| color | string | 是 | 背景颜色 | "#F4F6F8" |
| glowColor | string | 是 | 暖色边框色 | "#F4F6F8" |

### 继承关系

RenderCourse 继承自 Course，因此包含所有Course的属性：
- name
- teacher
- room
- day
- nodes
- weeks

### 使用示例

```typescript
import type { RenderCourse } from '@/types';

const renderCourse: RenderCourse = {
  // Course属性
  name: '高等数学',
  teacher: '张三',
  room: '教学楼A101',
  day: '1',
  nodes: '1-2',
  weeks: '01010101010101010101',
  // RenderCourse特有属性
  startNode: 1,
  step: 2,
  color: '#F4F6F8',
  glowColor: '#F4F6F8'
};
```

## 类型约束说明

### day字段约束
- 类型：string
- 范围：1-7
- 含义：
  - 1: 周一
  - 2: 周二
  - 3: 周三
  - 4: 周四
  - 5: 周五
  - 6: 周六
  - 7: 周日

### nodes字段约束
- 类型：string
- 格式："{start}-{end}" 或 "{single}"
- 示例：
  - "1-2": 第1-2节
  - "3-4": 第3-4节
  - "5": 第5节

### weeks字段约束
- 类型：string
- 格式：二进制字符串
- 长度：通常20位（对应20周）
- 示例：`"01010101010101010101"` 表示第2、4、6、8、10、12、14、16、18、20周有课

### color字段约束
- 类型：string
- 格式：CSS颜色值
- 示例：
  - 十六进制：`"#F4F6F8"`
  - RGB：`"rgb(244, 246, 248)"`
  - RGBA：`"rgba(244, 246, 248, 0.8)"`

## 使用示例

### 完整示例

```typescript
import type { Course, SyncRequest, UserInfo, RenderCourse } from '@/types';
import { syncSchedule } from '@/api/schedule';
import { useScheduleStore } from '@/stores/schedule';
import { toRenderCourses } from '@/utils/schedule';

// 1. 准备同步请求
const request: SyncRequest = {
  username: '20240001',
  password: 'password123'
};

// 2. 同步课程数据
const courses: Course[] = await syncSchedule(request);

// 3. 设置用户信息
const user: UserInfo = {
  studentId: request.username,
  lastSyncAt: new Date().toISOString()
};

// 4. 使用Store
const store = useScheduleStore();
store.setCourses(courses);
store.setUserInfo(user);

// 5. 转换为渲染数据
const renderCourses: RenderCourse[] = toRenderCourses(courses);

// 6. 渲染课程
renderCourses.forEach(course => {
  console.log(`${course.name} - ${course.teacher} - ${course.room}`);
  console.log(`星期${course.day} 第${course.startNode}-${course.startNode + course.step - 1}节`);
  console.log(`颜色: ${course.color}`);
});
```

### 类型检查示例

```typescript
import type { Course } from '@/types';

// ❌ 错误示例：缺少必需属性
const invalidCourse: Course = {
  name: '高等数学',
  teacher: '张三',
  // 缺少 room, day, nodes, weeks
};

// ❌ 错误示例：类型不匹配
const invalidCourse2: Course = {
  name: '高等数学',
  teacher: '张三',
  room: '教学楼A101',
  day: 1,  // 应该是string，不是number
  nodes: '1-2',
  weeks: '01010101010101010101'
};

// ✅ 正确示例
const validCourse: Course = {
  name: '高等数学',
  teacher: '张三',
  room: '教学楼A101',
  day: '1',
  nodes: '1-2',
  weeks: '01010101010101010101'
};
```
