# 西亚斯课表助手 - API参考文档

> **极致极简 · 隐私至上 · 原生体验**

本目录包含西亚斯课表助手项目的完整API参考文档，采用独立docs目录结构，提供详细的API说明、组件文档和架构设计。

## 📚 文档导航

### 核心架构
- [架构设计和数据流图](./architecture.md) - 整体架构、数据流、平台适配说明

### 类型定义
- [类型定义文档](./types.md) - Course、SyncRequest、UserInfo、RenderCourse等接口定义

### API层
- [API层文档](./api.md) - syncSchedule()函数、错误处理、使用示例

### 状态管理
- [Store文档](./store.md) - Pinia状态管理、状态、计算属性、方法

### 工具函数
- [工具函数文档](./utils.md) - 爬虫引擎、渲染工具、更新检测

### 组件
- [组件文档](./components.md) - CourseDetailModal、CustomCalendar、WeekSelector

### 配置
- [配置文档](./config.md) - 课表配置、主题配置、环境变量

### 功能模块
- [课前提醒功能](./reminder.md) - 自动提醒、权限管理、系统通知

## 🚀 快速开始

### 安装依赖
```bash
cd frontend
npm install
```

### 开发模式
```bash
npm run dev:h5          # H5开发模式，端口5173
```

### 构建
```bash
npm run build:h5        # H5生产构建
npm run build:app       # Android APK构建
```

## 📖 使用示例

### 1. 同步课表数据
```typescript
import { syncSchedule } from '@/api/schedule';

const courses = await syncSchedule({
  username: '20240001',
  password: 'password123'
});
```

### 2. 使用Store
```typescript
import { useScheduleStore } from '@/stores/schedule';

const store = useScheduleStore();
store.setCourses(courses);
store.setCurrentWeek(1);
```

### 3. 渲染课程
```typescript
import { toRenderCourses } from '@/utils/schedule';

const renderCourses = toRenderCourses(courses);
```

### 4. 设置课前提醒
```typescript
import { scheduleTodayReminders } from '@/utils/reminder';

// 设置今日提醒
const count = scheduleTodayReminders(courses, currentWeek);
console.log(`已设置 ${count} 个提醒`);
```

## 🔗 相关链接

- [项目主README](../README.md)
- [GitHub仓库](https://github.com/limingjing6666/SiasClassScheduleAssistant)
- [问题反馈](https://github.com/limingjing6666/SiasClassScheduleAssistant/issues)

## 📝 文档规范

本文档采用以下格式规范：
- **代码示例**：使用TypeScript代码块，包含完整导入语句
- **API表格**：使用Markdown表格，包含参数名、类型、必需性、默认值、说明
- **架构图**：使用Mermaid语法，支持流程图、序列图等
- **注意事项**：使用blockquote或列表形式

## 🛠️ 技术栈

- **前端框架**：Vue 3 (Composition API)
- **跨平台底座**：Uni-app (Vite 5驱动)
- **状态管理**：Pinia
- **核心引擎**：自研SiasCrawler (基于uni.request + CookieJar)
- **类型系统**：TypeScript (strict模式)

## 📄 许可证

本项目采用 [MIT License](../LICENSE) 开源协议。
