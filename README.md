# 🎓 西亚斯课表助手

> 纯本地课表 App —— 无需后端服务器，直接在设备上抓取教务系统课表

## 📖 项目简介

为郑州西亚斯学院学生打造的课表查询工具。App 内置 TypeScript 爬虫，直接登录教务系统 (`jwxt.sias.edu.cn`) 抓取课表数据，所有数据仅存储在本地设备，不经过任何第三方服务器。

## 🛠️ 技术栈

- **框架**: Uni-app (Vue 3 + TypeScript)
- **状态管理**: Pinia
- **构建工具**: Vite 5
- **加密**: crypto-js (SHA1)
- **目标平台**: H5 / Android / iOS

## ✨ 功能特性

- 登录教务系统自动抓取完整课表
- 按周次查看课程安排
- 自定义学期开始日期
- 课程详情弹窗（教师、教室、时间段）
- 自定义日历选择器
- 暖色大地色系深色主题
- 数据本地缓存，离线可查

## 🚀 快速开始

### 环境要求

- Node.js 18+
- HBuilderX（打包 Android / iOS 时需要）

### H5 开发

```bash
cd frontend
npm install
npm run dev:h5
```

浏览器访问 `http://localhost:5173`

### 构建 H5

```bash
npm run build:h5
```

### 打包 App

使用 HBuilderX 打开 `frontend` 目录，选择 **发行 → 原生App-云打包**。

## 📁 项目结构

```
frontend/
├── src/
│   ├── api/            # API 层（调用本地爬虫）
│   ├── pages/
│   │   ├── login/      # 登录页
│   │   └── schedule/   # 课表页
│   ├── stores/         # Pinia 状态管理
│   ├── types/          # TypeScript 类型定义
│   └── utils/
│       ├── crawler.ts  # 教务系统爬虫（核心）
│       └── schedule.ts # 课程颜色、时间表、过滤工具
├── vite.config.ts      # Vite 配置 + H5 反向代理
└── package.json
```

## ⚠️ 注意事项

- 本应用不存储用户密码，仅在登录时使用
- H5 模式通过 Vite 代理解决 CORS，生产部署需配置反向代理
- App 原生模式直连教务系统，无需代理
- 教务系统结构变化可能需要更新爬虫逻辑

## 📄 License

MIT License


