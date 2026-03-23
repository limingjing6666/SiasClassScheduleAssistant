<!--
 * @Author: limingjing6666 limingjing6868@gmail.com
 * @Date: 2026-03-23 14:10:05
 * @LastEditors: limingjing6666 limingjing6868@gmail.com
 * @LastEditTime: 2026-03-23 14:16:17
 * @FilePath: \SiasClassScheduleAssistant\README.md
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->
# 🎓 西亚斯课表 (Sias Schedule)

> **极致极简 · 隐私至上 · 原生体验**

[![Release](https://img.shields.io/github/v/release/limingjing6666/SiasClassScheduleAssistant?color=black&style=flat-square)](https://github.com/limingjing6666/SiasClassScheduleAssistant/releases)

---

## ✨ 核心特性

- **🧊 极致极简设计 (Minimalist UI)**：遵循"少即是多"的原则，采用纯净的白/黑主题与精致的排版驱动界面，摒弃一切视觉干扰。
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

---

## 📚 API参考文档

完整的API参考文档位于 [`frontend/docs/`](./frontend/docs/) 目录，包含：

- **[架构设计和数据流图](./frontend/docs/architecture.md)** - 整体架构、数据流、平台适配说明
- **[类型定义文档](./frontend/docs/types.md)** - Course、SyncRequest、UserInfo、RenderCourse等接口定义
- **[API层文档](./frontend/docs/api.md)** - syncSchedule()函数、错误处理、使用示例
- **[Store文档](./frontend/docs/store.md)** - Pinia状态管理、状态、计算属性、方法
- **[工具函数文档](./frontend/docs/utils.md)** - 爬虫引擎、渲染工具、更新检测
- **[组件文档](./frontend/docs/components.md)** - CourseDetailModal、CustomCalendar、WeekSelector
- **[配置文档](./frontend/docs/config.md)** - 课表配置、主题配置、环境变量

---

## 📄 许可证

本项目采用 [MIT License](./LICENSE) 开源协议。
