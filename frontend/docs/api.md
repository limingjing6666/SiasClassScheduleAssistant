# API层文档

> 西亚斯课表助手的API层封装，提供统一的课表同步接口

## 📋 目录

- [syncSchedule](#synschedule)
- [错误处理](#错误处理)
- [使用示例](#使用示例)
- [错误码列表](#错误码列表)
- [注意事项](#注意事项)

## syncSchedule

同步课表数据，直接调用本地爬虫登录教务系统并抓取课表数据。

### 函数签名

```typescript
export async function syncSchedule(params: SyncRequest): Promise<Course[]>
```

### 参数说明

| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| params | SyncRequest | 是 | 同步请求参数 |
| params.username | string | 是 | 学号 |
| params.password | string | 是 | 密码 |

### 返回值

| 类型 | 说明 |
|------|------|
| Promise<Course[]> | 课程列表 |

### 异常

| 异常类型 | 说明 |
|----------|------|
| Error | 登录失败、探测失败、获取数据失败等，错误消息已翻译为用户友好格式 |

### 错误处理

函数内部会捕获爬虫抛出的错误，并调用 `translateError()` 将错误码翻译为用户友好的错误消息。

```typescript
try {
  const courses = await crawlerFetch(params.username, params.password);
  return courses;
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  throw new Error(translateError(msg));
}
```

### 使用示例

#### 基础用法

```typescript
import { syncSchedule } from '@/api/schedule';

try {
  const courses = await syncSchedule({
    username: '20240001',
    password: 'password123'
  });
  
  console.log(`成功获取 ${courses.length} 门课程`);
  courses.forEach(course => {
    console.log(`${course.name} - ${course.teacher}`);
  });
} catch (error) {
  console.error('同步失败:', error.message);
}
```

#### 在Vue组件中使用

```vue
<template>
  <view>
    <button @click="handleSync">同步课表</button>
    <view v-if="loading">同步中...</view>
    <view v-if="error">{{ error }}</view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { syncSchedule } from '@/api/schedule';
import { useScheduleStore } from '@/stores/schedule';

const loading = ref(false);
const error = ref('');

async function handleSync() {
  loading.value = true;
  error.value = '';
  
  try {
    const courses = await syncSchedule({
      username: '20240001',
      password: 'password123'
    });
    
    const store = useScheduleStore();
    store.setCourses(courses);
    
    uni.showToast({ title: '同步成功', icon: 'success' });
  } catch (err: any) {
    error.value = err.message || '同步失败';
    uni.showToast({ title: error.value, icon: 'none' });
  } finally {
    loading.value = false;
  }
}
</script>
```

#### 在Pinia Action中使用

```typescript
import { defineStore } from 'pinia';
import { syncSchedule } from '@/api/schedule';

export const useScheduleStore = defineStore('schedule', () => {
  const courses = ref([]);
  const loading = ref(false);
  
  async function sync(username: string, password: string) {
    loading.value = true;
    
    try {
      const result = await syncSchedule({ username, password });
      courses.value = result;
      return true;
    } catch (error) {
      throw error;
    } finally {
      loading.value = false;
    }
  }
  
  return { courses, loading, sync };
});
```

## 错误码列表

| 错误码 | 翻译后消息 | 说明 |
|--------|-----------|------|
| LOGIN_FAILED | 登录失败，请检查学号和密码 | 登录教务系统失败，可能是学号或密码错误 |
| DETECT_FAILED | 获取用户信息失败，请稍后重试 | 自动探测用户ID或学期ID失败 |
| ID_NOT_FOUND | 未找到用户ID，请稍后重试 | 无法从页面中提取用户ID |
| SEMESTER_NOT_FOUND | 未找到学期信息，请稍后重试 | 无法从页面中提取学期ID |
| RATE_LIMITED | 教务系统请求过于频繁，请稍后再试 | 触发教务系统限流 |
| NETWORK_ERROR | 教务系统连接失败。请确认当前是否在校园网内，或教务系统已暂时关闭公网访问（建议使用校园网）。 | 网络连接失败 |
| (其他) | 未知错误: {error} | 未知错误 |

### 错误处理示例

```typescript
import { syncSchedule } from '@/api/schedule';

try {
  const courses = await syncSchedule({ username, password });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  
  switch (message) {
    case '登录失败，请检查学号和密码':
      // 提示用户检查学号密码
      break;
    case '教务系统请求过于频繁，请稍后再试':
      // 提示用户稍后重试
      break;
    case '教务系统连接失败。请确认当前是否在校园网内，或教务系统已暂时关闭公网访问（建议使用校园网）。':
      // 提示用户检查网络
      break;
    default:
      // 其他错误
      break;
  }
}
```

## 使用示例

### 完整登录流程示例

```vue
<template>
  <view class="login-page">
    <input v-model="username" placeholder="学号" />
    <input v-model="password" placeholder="密码" type="password" />
    <button @click="handleLogin" :disabled="loading">
      {{ loading ? '登录中...' : '登录' }}
    </button>
    <view v-if="errorMessage" class="error">{{ errorMessage }}</view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { syncSchedule } from '@/api/schedule';
import { useScheduleStore } from '@/stores/schedule';

const username = ref('');
const password = ref('');
const loading = ref(false);
const errorMessage = ref('');

const scheduleStore = useScheduleStore();

async function handleLogin() {
  errorMessage.value = '';
  
  if (!username.value.trim() || !password.value) {
    errorMessage.value = '请完整输入学号和密码';
    return;
  }
  
  loading.value = true;
  
  try {
    scheduleStore.clearUserData();
    
    const courses = await syncSchedule({
      username: username.value.trim(),
      password: password.value
    });
    
    scheduleStore.setCourses(courses);
    scheduleStore.setUserInfo({
      studentId: username.value.trim(),
      lastSyncAt: new Date().toISOString()
    });
    
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/schedule/schedule' });
    }, 500);
  } catch (error: any) {
    errorMessage.value = error.message || '同步失败，请检查网络或密码';
  } finally {
    loading.value = false;
  }
}
</script>
```

### 错误重试示例

```typescript
import { syncSchedule } from '@/api/schedule';

async function syncWithRetry(
  username: string,
  password: string,
  maxRetries = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const courses = await syncSchedule({ username, password });
      console.log(`第${attempt}次尝试成功，获取${courses.length}门课程`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`第${attempt}次尝试失败:`, message);
      
      // 如果是限流错误，等待后重试
      if (message.includes('过于频繁')) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        continue;
      }
      
      // 其他错误不重试
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }
  
  return false;
}
```

## 注意事项

### 1. 网络环境
- 教务系统可能仅在校园网内可访问
- 公网访问可能被限制

### 2. 请求频率
- 避免频繁调用，可能触发限流
- 建议添加适当的延迟

### 3. 数据缓存
- 同步成功后建议缓存数据
- 使用 `useScheduleStore` 的 `setCourses()` 方法

### 4. 错误处理
- 始终使用 try-catch 捕获错误
- 显示友好的错误消息给用户

### 5. 安全性
- 密码在内存中明文存储
- 建议使用后及时清理敏感数据
