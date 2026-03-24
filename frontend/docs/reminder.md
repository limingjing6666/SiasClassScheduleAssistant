# 课前提醒功能文档

> 西亚斯课表助手的课前提醒功能，在课程开始前20分钟自动发送通知提醒

## 📋 目录

- [功能概述](#功能概述)
- [技术实现](#技术实现)
- [文件结构](#文件结构)
- [配置说明](#配置说明)
- [使用流程](#使用流程)
- [权限管理](#权限管理)
- [注意事项](#注意事项)

## 功能概述

### 核心特性

- **自动提醒**：在课程开始前20分钟自动发送通知
- **系统级通知**：使用系统定时通知，应用关闭后仍能触发
- **智能配置**：使用默认设置，无需用户手动配置
- **权限引导**：首次打开应用时引导用户开启权限

### 提醒内容

通知内容包含：
- 课程名称
- 上课时间
- 教室位置
- 授课教师

示例通知：
```
📚 即将上课：高等数学
⏰ 8:00-9:40
📍 教学楼A101
👨‍🏫 张三老师
```

## 技术实现

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    应用启动 (App.vue)                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              处理首次权限请求 (permission.ts)            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                 设置今日提醒 (reminder.ts)               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              系统定时通知自动触发                         │
└─────────────────────────────────────────────────────────┘
```

### 核心流程

1. **应用启动时**
   - 检查是否首次打开应用
   - 首次打开：显示权限请求弹窗
   - 非首次打开：静默检查权限

2. **权限检查**
   - 检查通知权限
   - 有权限：设置今日提醒
   - 无权限：跳过提醒功能

3. **设置提醒**
   - 获取今日课程列表
   - 计算每个课程的提醒时间（课程开始时间 - 20分钟）
   - 创建系统定时通知

4. **通知触发**
   - 系统在提醒时间自动弹出通知
   - 即使应用关闭也能正常触发

### 时间计算

```typescript
// 获取课程开始时间
const startTime = NODE_TIMES[startNode].start;  // 例如 "8:00"

// 计算提醒时间
const remindAt = new Date(courseStartTime.getTime() - 20 * 60 * 1000);
// 例如：8:00 - 20分钟 = 7:40
```

### 节次时间表

| 节次 | 开始时间 | 结束时间 |
|------|---------|---------|
| 1 | 8:00 | 8:45 |
| 2 | 8:55 | 9:40 |
| 3 | 10:00 | 10:45 |
| 4 | 10:55 | 11:40 |
| 5 | 13:00 | 13:45 |
| 6 | 13:55 | 14:40 |
| 7 | 15:00 | 15:45 |
| 8 | 15:55 | 16:40 |
| 9 | 16:55 | 17:40 |
| 10 | 17:50 | 18:35 |
| 11 | 19:10 | 19:55 |
| 12 | 20:00 | 20:45 |
| 13 | 20:50 | 21:35 |

## 文件结构

### 新增文件

| 文件路径 | 说明 |
|---------|------|
| `src/types/reminder.ts` | 提醒相关类型定义 |
| `src/config/reminder.ts` | 提醒配置文件 |
| `src/utils/reminder.ts` | 提醒核心逻辑 |
| `src/utils/permission.ts` | 权限管理工具 |

### 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `src/App.vue` | 添加首次权限请求逻辑 |
| `src/stores/schedule.ts` | 添加提醒设置状态 |

## 配置说明

### 默认设置

```typescript
// src/config/reminder.ts
export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,           // 启用提醒
  advanceMinutes: 20,      // 提前提醒时间（分钟）
  sound: true,             // 播放声音
  vibration: true          // 震动
};
```

### 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| enabled | boolean | true | 是否启用提醒 |
| advanceMinutes | number | 20 | 提前提醒时间（分钟） |
| sound | boolean | true | 是否播放声音 |
| vibration | boolean | true | 是否震动 |

### 节次时间配置

```typescript
// src/utils/schedule.ts
export const NODE_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: '8:00', end: '8:45' },
  2: { start: '8:55', end: '9:40' },
  // ... 共13节
};
```

## 使用流程

### 用户首次打开应用

```
应用首次打开
    ↓
显示首次权限请求弹窗
    ↓
用户选择
    ↓
    ├─ 去开启 → 显示详细权限引导弹窗
    │           ↓
    │           引导用户开启通知权限
    │           ↓
    │           引导用户开启自启动权限（Android）
    │           ↓
    │           保存标记，设置今日提醒
    │
    └─ 暂不开启 → 保存标记，跳过提醒功能
```

### 用户非首次打开应用

```
应用打开
    ↓
检查通知权限
    ↓
    ├─ 有权限 → 设置今日提醒
    │
    └─ 无权限 → 静默跳过
```

### 权限请求弹窗

**首次权限请求弹窗：**
```
┌─────────────────────────────────────┐
│                                     │
│           开启课前提醒               │
│                                     │
│  为了在课程开始前20分钟提醒您上课，   │
│  请开启通知权限。                    │
│                                     │
│  应用关闭后仍能正常提醒。            │
│                                     │
│  ┌───────────┐    ┌───────────┐    │
│  │ 暂不开启  │    │  去开启   │    │
│  └───────────┘    └───────────┘    │
│                                     │
└─────────────────────────────────────┘
```

**详细权限引导弹窗（Android）：**
```
┌─────────────────────────────────────┐
│                                     │
│           权限设置                   │
│                                     │
│  请按照以下步骤开启权限：            │
│                                     │
│  步骤1：开启通知权限                 │
│  在应用设置页面，找到"通知"选项，    │
│  开启通知权限。                      │
│                                     │
│  步骤2：开启自启动权限               │
│  在应用设置页面，找到"自启动"选项，  │
│  开启自启动权限。（部分设备可能在    │
│  "电池优化"或"后台运行"中设置）     │
│                                     │
│  ┌───────────┐    ┌───────────┐    │
│  │ 稍后设置  │    │  去设置   │    │
│  └───────────┘    └───────────┘    │
│                                     │
└─────────────────────────────────────┘
```

## 权限管理

### 通知权限

**Android：**
- 需要用户手动开启通知权限
- 在应用设置页面，找到"通知"选项，开启通知权限

**iOS：**
- 应用会自动请求通知权限
- 用户需要在弹窗中点击"允许"

### 自启动权限（Android）

**为什么需要自启动权限：**
- 确保应用关闭后仍能接收通知
- 部分Android系统会限制后台应用

**如何开启：**
- 在应用设置页面，找到"自启动"选项，开启自启动权限
- 部分设备可能在"电池优化"或"后台运行"中设置

### 权限检查

```typescript
// src/utils/permission.ts
export async function checkNotificationPermission(): Promise<boolean> {
  // 检查通知权限
  // Android: 使用 NotificationManagerCompat
  // iOS: 返回 true（系统会自动处理）
}
```

## 注意事项

### 1. 平台限制

| 平台 | 支持情况 | 说明 |
|------|---------|------|
| Android | 完全支持 | 需要通知权限和自启动权限 |
| iOS | 完全支持 | 需要通知权限 |
| H5 | 不支持 | 不支持推送通知 |

### 2. 电池优化

- 部分Android设备可能需要关闭电池优化
- 在应用设置页面，找到"电池优化"选项，关闭电池优化

### 3. 通知权限

- 如果用户拒绝通知权限，提醒功能将无法使用
- 用户需要手动在系统设置中开启权限

### 4. 提醒时间

- 默认提前提醒20分钟
- 如果课程开始时间已过，将不会设置提醒

### 5. 今日课程

- 只设置今日课程的提醒
- 每天打开应用时会重新设置提醒

### 6. 周次过滤

- 只提醒本周有课的课程
- 根据周次二进制字符串过滤课程

## API 文档

### reminder.ts

#### getReminderSettings()

获取提醒设置。

```typescript
function getReminderSettings(): ReminderSettings
```

**返回值：**
- `ReminderSettings` - 提醒设置对象

#### saveReminderSettings()

保存提醒设置。

```typescript
function saveReminderSettings(settings: ReminderSettings): void
```

**参数：**
- `settings` - 提醒设置对象

#### getTodayCourses()

获取今日课程。

```typescript
function getTodayCourses(courses: Course[], currentWeek: number): Course[]
```

**参数：**
- `courses` - 所有课程列表
- `currentWeek` - 当前周次

**返回值：**
- `Course[]` - 今日课程列表

#### createReminderTask()

创建提醒任务。

```typescript
function createReminderTask(course: Course, advanceMinutes: number): ReminderTask | null
```

**参数：**
- `course` - 课程对象
- `advanceMinutes` - 提前提醒分钟数

**返回值：**
- `ReminderTask | null` - 提醒任务对象

#### scheduleNotification()

创建系统定时通知。

```typescript
function scheduleNotification(task: ReminderTask): boolean
```

**参数：**
- `task` - 提醒任务对象

**返回值：**
- `boolean` - 是否成功创建通知

#### scheduleTodayReminders()

设置今日课程提醒。

```typescript
function scheduleTodayReminders(courses: Course[], currentWeek: number): number
```

**参数：**
- `courses` - 所有课程列表
- `currentWeek` - 当前周次

**返回值：**
- `number` - 成功设置的提醒数量

### permission.ts

#### checkNotificationPermission()

检查通知权限。

```typescript
function checkNotificationPermission(): Promise<boolean>
```

**返回值：**
- `Promise<boolean>` - 是否有通知权限

#### openAppSettings()

跳转到应用设置页面。

```typescript
function openAppSettings(): void
```

#### isFirstTimeRequest()

检查是否首次请求权限。

```typescript
function isFirstTimeRequest(): boolean
```

**返回值：**
- `boolean` - 是否首次请求

#### savePermissionRequested()

保存权限请求标记。

```typescript
function savePermissionRequested(): void
```

#### showFirstTimePermissionRequest()

显示首次权限请求弹窗。

```typescript
function showFirstTimePermissionRequest(): Promise<boolean>
```

**返回值：**
- `Promise<boolean>` - 用户是否同意开启权限

#### handleFirstTimePermission()

处理首次权限请求。

```typescript
function handleFirstTimePermission(): Promise<boolean>
```

**返回值：**
- `Promise<boolean>` - 是否有通知权限

## 类型定义

### ReminderSettings

```typescript
interface ReminderSettings {
  /** 是否启用提醒 */
  enabled: boolean;
  /** 提前提醒时间（分钟） */
  advanceMinutes: number;
  /** 是否播放声音 */
  sound: boolean;
  /** 是否震动 */
  vibration: boolean;
}
```

### ReminderTask

```typescript
interface ReminderTask {
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
```

### AdvanceOption

```typescript
interface AdvanceOption {
  /** 分钟数 */
  value: number;
  /** 显示标签 */
  label: string;
}
```
