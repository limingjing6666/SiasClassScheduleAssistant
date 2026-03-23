# 工具函数文档

> 西亚斯课表助手的工具函数，包括爬虫引擎、渲染工具和更新检测

## 📋 目录

- [crawler.ts - 爬虫引擎](#crawlers---爬虫引擎)
- [schedule.ts - 渲染工具](#schedulets---渲染工具)
- [update.ts - 更新检测](#updatets---更新检测)

## crawler.ts - 爬虫引擎

从Python版本平移而来的核心爬虫引擎，负责登录教务系统和抓取课表数据。

### 导出函数

#### fetchSchedule

执行完整的课表抓取流程。

**签名：**
```typescript
export async function fetchSchedule(username: string, password: string): Promise<Course[]>
```

**参数：**
| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| username | string | 是 | 学号 |
| password | string | 是 | 密码 |

**返回值：**
- `Promise<Course[]>` - 课程列表

**异常：**
- `Error('LOGIN_FAILED')` - 登录失败
- `Error('DETECT_FAILED')` - 探测失败
- `Error('NETWORK_ERROR')` - 网络错误

**示例：**
```typescript
import { fetchSchedule } from '@/utils/crawler';

const courses = await fetchSchedule('20240001', 'password123');
console.log(`获取 ${courses.length} 门课程`);
```

#### translateError

将爬虫错误码翻译为用户友好的错误消息。

**签名：**
```typescript
export function translateError(error: string): string
```

**参数：**
| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| error | string | 是 | 错误码 |

**返回值：**
- `string` - 用户友好的错误消息

**错误码列表：**
| 错误码 | 翻译后消息 |
|--------|-----------|
| LOGIN_FAILED | 登录失败，请检查学号和密码 |
| DETECT_FAILED | 获取用户信息失败，请稍后重试 |
| ID_NOT_FOUND | 未找到用户ID，请稍后重试 |
| SEMESTER_NOT_FOUND | 未找到学期信息，请稍后重试 |
| RATE_LIMITED | 教务系统请求过于频繁，请稍后再试 |
| NETWORK_ERROR | 教务系统连接失败... |

### 导出类

#### SiasCrawler

爬虫主类，实现完整登录和数据抓取流程。

**构造函数：**
```typescript
constructor(username: string, password: string)
```

**方法：**

| 方法 | 签名 | 说明 |
|------|------|------|
| login() | `async login(): Promise<boolean>` | 登录教务系统 |
| autoDetect() | `async autoDetect(): Promise<boolean>` | 自动探测用户ID和学期ID |
| getData() | `async getData(): Promise<Course[]>` | 获取课表数据 |
| reset() | `reset(): void` | 清理Cookie，重置会话 |

**示例：**
```typescript
import { SiasCrawler } from '@/utils/crawler';

const crawler = new SiasCrawler('20240001', 'password123');

// 登录
const loginOk = await crawler.login();
if (!loginOk) throw new Error('登录失败');

// 探测
const detectOk = await crawler.autoDetect();
if (!detectOk) throw new Error('探测失败');

// 获取数据
const courses = await crawler.getData();
```

## schedule.ts - 渲染工具

课表渲染工具集，负责课程过滤、颜色分配和时间解析。

### 导出函数

#### getCourseColor

根据课程名称生成固定颜色，相同课程名始终显示相同颜色。

**签名：**
```typescript
export function getCourseColor(courseName: string): string
```

**参数：**
| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| courseName | string | 是 | 课程名称 |

**返回值：**
- `string` - CSS颜色值

**示例：**
```typescript
import { getCourseColor } from '@/utils/schedule';

const color = getCourseColor('高等数学');
console.log(color); // "#F4F6F8"
```

#### parseNodes

解析节次字符串。

**签名：**
```typescript
export function parseNodes(nodes: string): { start: number; step: number }
```

**参数：**
| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| nodes | string | 是 | 节次字符串 |

**返回值：**
- `{ start: number; step: number }` - 开始节次和持续节数

**示例：**
```typescript
import { parseNodes } from '@/utils/schedule';

const result1 = parseNodes('1-2');
// { start: 1, step: 2 }

const result2 = parseNodes('3');
// { start: 3, step: 1 }
```

#### filterByWeek

根据周次过滤课程。

**签名：**
```typescript
export function filterByWeek(courses: Course[], currentWeek: number): Course[]
```

**参数：**
| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| courses | Course[] | 是 | 课程列表 |
| currentWeek | number | 是 | 当前周次 (1-based) |

**返回值：**
- `Course[]` - 过滤后的课程列表

**示例：**
```typescript
import { filterByWeek } from '@/utils/schedule';

const thisWeekCourses = filterByWeek(courses, 5);
```

#### toRenderCourses

将课程转换为渲染用数据，确保同一天相邻课程颜色不同。

**签名：**
```typescript
export function toRenderCourses(courses: Course[]): RenderCourse[]
```

**参数：**
| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| courses | Course[] | 是 | 课程列表 |

**返回值：**
- `RenderCourse[]` - 渲染用课程数据

**示例：**
```typescript
import { toRenderCourses } from '@/utils/schedule';

const renderCourses = toRenderCourses(courses);
renderCourses.forEach(course => {
  console.log(`${course.name} - ${course.color}`);
});
```

#### getDayName

获取星期名称。

**签名：**
```typescript
export function getDayName(day: number): string
```

**参数：**
| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| day | number | 是 | 星期几 (1-7) |

**返回值：**
- `string` - 星期名称（如"周一"）

**示例：**
```typescript
import { getDayName } from '@/utils/schedule';

console.log(getDayName(1)); // "周一"
console.log(getDayName(7)); // "周日"
```

#### getNodeTimeRange

获取节次时间范围字符串。

**签名：**
```typescript
export function getNodeTimeRange(startNode: number, endNode: number): string
```

**参数：**
| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| startNode | number | 是 | 开始节次 |
| endNode | number | 是 | 结束节次 |

**返回值：**
- `string` - 时间范围字符串（如"08:00-09:40"）

**示例：**
```typescript
import { getNodeTimeRange } from '@/utils/schedule';

console.log(getNodeTimeRange(1, 2)); // "8:00-9:40"
console.log(getNodeTimeRange(3, 4)); // "10:00-11:40"
```

### 导出常量

#### NODE_TIMES

节次时间表，定义每节课的开始和结束时间。

```typescript
export const NODE_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: '8:00', end: '8:45' },
  2: { start: '8:55', end: '9:40' },
  3: { start: '10:00', end: '10:45' },
  4: { start: '10:55', end: '11:40' },
  5: { start: '13:00', end: '13:45' },
  6: { start: '13:55', end: '14:40' },
  7: { start: '15:00', end: '15:45' },
  8: { start: '15:55', end: '16:40' },
  9: { start: '16:55', end: '17:40' },
  10: { start: '17:50', end: '18:35' },
  11: { start: '19:10', end: '19:55' },
  12: { start: '20:00', end: '20:45' },
  13: { start: '20:50', end: '21:35' }
};
```

## update.ts - 更新检测

App自动更新检测逻辑，支持APK和WGT热更新包。

### 导出函数

#### checkUpdate

App自动更新检测，H5模式跳过。

**签名：**
```typescript
export function checkUpdate(): void
```

**说明：**
- H5模式：跳过检测
- App模式：从远程`update.json`检查新版本

**示例：**
```typescript
import { checkUpdate } from '@/utils/update';

// 应用启动时检测更新
setTimeout(() => {
  checkUpdate();
}, 3000);
```
