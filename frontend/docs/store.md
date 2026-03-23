# Store文档

> 西亚斯课表助手的Pinia状态管理，包括状态、计算属性、方法和缓存策略

## 📋 目录

- [Store概述](#store概述)
- [状态](#状态)
- [计算属性](#计算属性)
- [方法](#方法)
- [缓存策略](#缓存策略)
- [使用示例](#使用示例)
- [最佳实践](#最佳实践)

## Store概述

`useScheduleStore` 是应用的核心状态管理，使用Pinia实现，负责管理课程数据、用户信息、周次等状态，并提供本地缓存功能。

### 基本信息

- **Store名称**: `schedule`
- **类型**: Composition API (setup store)
- **依赖**: `utils/schedule.ts`, `config/schedule.ts`
- **导出**: `useScheduleStore`

### 初始化

```typescript
import { useScheduleStore } from '@/stores/schedule';

const store = useScheduleStore();
```

## 状态

### courses

课程列表，包含所有从教务系统抓取的课程数据。

| 属性 | 说明 |
|------|------|
| 类型 | `Ref<Course[]>` |
| 初始值 | `[]` |
| 缓存键 | `courses` |

```typescript
const courses = ref<Course[]>([]);
```

### currentWeek

当前选中的周次，用于过滤和显示课程。

| 属性 | 说明 |
|------|------|
| 类型 | `Ref<number>` |
| 初始值 | `1` |
| 范围 | `1` - `totalWeeks` |

```typescript
const currentWeek = ref(1);
```

### totalWeeks

学期总周数，用于限制周次选择范围。

| 属性 | 说明 |
|------|------|
| 类型 | `Ref<number>` |
| 初始值 | `20` |

```typescript
const totalWeeks = ref(20);
```

### userInfo

当前登录用户的信息。

| 属性 | 说明 |
|------|------|
| 类型 | `Ref<UserInfo \| null>` |
| 初始值 | `null` |
| 缓存键 | `userInfo` |

```typescript
const userInfo = ref<UserInfo | null>(null);
```

### loading

数据加载状态，用于显示加载指示器。

| 属性 | 说明 |
|------|------|
| 类型 | `Ref<boolean>` |
| 初始值 | `false` |

```typescript
const loading = ref(false);
```

### semesterStart

学期开始日期（第一周的周一），用于计算当前周次。

| 属性 | 说明 |
|------|------|
| 类型 | `Ref<string>` |
| 初始值 | 从缓存读取或使用默认值 |
| 缓存键 | `semesterStart` |
| 格式 | `YYYY-MM-DD` |

```typescript
const semesterStart = ref(uni.getStorageSync('semesterStart') || SCHEDULE_CONFIG.DEFAULT_SEMESTER_START);
```

## 计算属性

### displayCourses

根据当前周过滤并渲染的课程列表，用于UI显示。

| 属性 | 说明 |
|------|------|
| 类型 | `ComputedRef<RenderCourse[]>` |
| 依赖 | `courses`, `currentWeek` |
| 说明 | 自动根据周次过滤课程，并添加渲染所需的样式信息 |

```typescript
const displayCourses = computed(() => {
  const filtered = filterByWeek(courses.value, currentWeek.value);
  return toRenderCourses(filtered);
});
```

## 方法

### setCourses

设置课程列表并缓存到本地存储。

**签名：**
```typescript
function setCourses(newCourses: Course[]): void
```

**参数：**
| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| newCourses | Course[] | 是 | 课程列表 |

### setCurrentWeek

设置当前周次。

**签名：**
```typescript
function setCurrentWeek(week: number): void
```

**参数：**
| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| week | number | 是 | 周次 (1-总周数) |

### setUserInfo

设置用户信息并缓存到本地存储。

**签名：**
```typescript
function setUserInfo(info: UserInfo): void
```

### setSemesterStart

设置学期开始日期并缓存。

**签名：**
```typescript
function setSemesterStart(date: string): void
```

### initCurrentWeek

根据学期开始日期自动计算当前周数。

**签名：**
```typescript
function initCurrentWeek(): void
```

### loadFromCache

从本地缓存加载所有数据。

**签名：**
```typescript
function loadFromCache(): void
```

### clearData

清除所有数据（含学期设置），用于退出登录。

**签名：**
```typescript
function clearData(): void
```

### clearUserData

仅清除账号相关数据，保留用户设定的学期开始日期。

**签名：**
```typescript
function clearUserData(): void
```

## 缓存策略

### 缓存键

| 缓存键 | 数据类型 | 说明 |
|--------|----------|------|
| courses | string (JSON) | 课程列表 |
| userInfo | string (JSON) | 用户信息 |
| semesterStart | string | 学期开始日期 |
