# 🎓 西亚斯课表 (Sias Schedule)

> **极致极简 · 隐私至上 · 原生体验**

[![Release](https://img.shields.io/github/v/release/limingjing6666/SiasClassScheduleAssistant?color=black&style=flat-square)](https://github.com/limingjing6666/SiasClassScheduleAssistant/releases)

---

## ✨ 核心特性

- **🧊 极致极简设计 (Minimalist UI)**：遵循“少即是多”的原则，采用纯净的白/黑主题与精致的排版驱动界面，摒弃一切视觉干扰。
- **🔒 零服务器架构 (Privacy First)**：内置 TypeScript 深度爬虫引擎，直接在本地完成教务系统登录与数据抓取，隐私数据永远留在本地。
- **🚀 毫秒级热更新系统 (Smart Update)**：支持定制安装引擎。无论是跨版本 APK 还是热补丁 WGT，均可实现强制自动覆盖与热重启。
- **🎨 智能色彩排布**：基于低饱和度 `minimalist` 调色盘，自动为每一门课程分配柔和且清爽的视觉标识。

---

## 🛠️ 技术栈

- **前端框架**: Vue 3 (Composition API)
- **跨平台底座**: Uni-app (Vite 5 驱动)
- **状态管理**: Pinia
- **核心引擎**: 自研 `SiasCrawler` (基于 `uni.request` + `CookieJar`)
- **自动化流**: PowerShell Release Workflow
