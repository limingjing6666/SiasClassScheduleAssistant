# 配置文档

> 西亚斯课表助手的配置文件，包括课表配置、主题配置、环境变量和构建配置

## 📋 目录

- [课表配置](#课表配置)
- [主题配置](#主题配置)
- [环境变量](#环境变量)
- [构建配置](#构建配置)
- [平台配置](#平台配置)

## 课表配置

配置文件位置：`src/config/schedule.ts`

### SCHEDULE_CONFIG

课表基础配置对象。

```typescript
export const SCHEDULE_CONFIG = {
  // 默认学期开始日期（第一周的周一）
  // 格式：YYYY-MM-DD
  DEFAULT_SEMESTER_START: '2026-03-02',
};
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| DEFAULT_SEMESTER_START | string | '2026-03-02' | 默认学期开始日期 (YYYY-MM-DD) |

### 使用示例

```typescript
import { SCHEDULE_CONFIG } from '@/config/schedule';

// 获取默认学期开始日期
const defaultStart = SCHEDULE_CONFIG.DEFAULT_SEMESTER_START;
```

## 主题配置

配置文件位置：`src/config/themes.ts`

### THEME_PALETTES

主题颜色配置中心，定义多种调色板。

```typescript
export const THEME_PALETTES: Record<string, { colors: string[], glowColors: string[] }> = {
  // 经典深色 (暖大地色)
  dark: {
    colors: [
      '#8B4A1A', '#C8B89A', '#7A2A1E', '#5A4A10',
      '#A0522D', '#8B6914', '#6B3A2A', '#4A6A2A',
      '#9B5A3A', '#7A6A3A', '#5A3A2A', '#8B7A4A',
    ],
    glowColors: [
      '#B06A3A', '#D8CDB0', '#9A4A3E', '#7A6A30',
      '#C07240', '#AB8934', '#8B5A4A', '#6A8A4A',
      '#BB7A5A', '#9A8A5A', '#7A5A4A', '#AB9A6A',
    ]
  },
  // 极简纯净色块 (极浅色调)
  minimalist: {
    colors: [
      '#F4F6F8', '#F9F5F0', '#F0F7F4', '#FCF2F2',
      '#F4F1F8', '#F2FBF9', '#FDF6EB', '#F5F5FA',
      '#FDF4EC', '#EEF6F8', '#F8EFF2', '#F1F4F9',
    ],
    glowColors: [
      '#F4F6F8', '#F9F5F0', '#F0F7F4', '#FCF2F2',
      '#F4F1F8', '#F2FBF9', '#FDF6EB', '#F5F5FA',
      '#FDF4EC', '#EEF6F8', '#F8EFF2', '#F1F4F9',
    ]
  },
};
```

### 主题列表

| 主题名 | 说明 | colors数量 | glowColors数量 |
|--------|------|-----------|---------------|
| dark | 经典深色（暖大地色） | 12 | 12 |
| minimalist | 极简纯净色块（浅色调） | 12 | 12 |

### 使用示例

```typescript
import { THEME_PALETTES } from '@/config/themes';

// 获取极简主题的调色板
const palette = THEME_PALETTES.minimalist;

// 获取第一个颜色
const firstColor = palette.colors[0];  // '#F4F6F8'

// 获取对应的发光色
const firstGlow = palette.glowColors[0];  // '#F4F6F8'
```

### 颜色选择逻辑

在 `utils/schedule.ts` 中，`getCourseColor()` 函数根据课程名称生成固定颜色：

```typescript
export function getCourseColor(courseName: string): string {
  let hash = 0;
  for (let i = 0; i < courseName.length; i++) {
    hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE.colors[Math.abs(hash) % PALETTE.colors.length];
}
```

## 环境变量

配置文件位置：`.env`

### UNI_H5_PORT

H5开发服务器端口。

```env
# Vite 开发服务器端口配置
# uni-app H5 开发服务器端口
UNI_H5_PORT=5173
```

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| UNI_H5_PORT | number | 5173 | H5开发服务器端口 |

## 构建配置

配置文件位置：`vite.config.ts`

### 服务器配置

```typescript
server: {
  port: 5173,       // 修改此处更改端口
  host: true,       // 允许局域网访问
  strictPort: true, // 强制使用指定端口，不自动切换
  // H5 开发代理 —— 将 /eams 请求转发到教务系统，解决浏览器 CORS 拦截
  proxy: {
    '/eams': {
      target: 'https://jwxt.sias.edu.cn',
      changeOrigin: true,
      secure: false,
      // 重写 302 Location 头，确保重定向始终走代理而不是跳到外部域名
      autoRewrite: true,
      protocolRewrite: 'http',
      // 移除 Set-Cookie 的 Domain 属性，让浏览器将 cookie 存储在 localhost 下
      cookieDomainRewrite: '',
    }
  }
}
```

### 代理配置说明

| 配置项 | 说明 |
|--------|------|
| target | 教务系统地址 |
| changeOrigin | 修改请求头中的host为目标URL |
| secure | 不验证SSL证书 |
| autoRewrite | 自动重写重定向URL |
| protocolRewrite | 协议重写 |
| cookieDomainRewrite | Cookie域名重写 |

### 别名配置

```typescript
resolve: {
  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url))
  }
}
```

## 平台配置

配置文件位置：`src/pages.json`

### 页面路由

```json
{
  "pages": [
    {
      "path": "pages/login/login",
      "style": {
        "navigationBarTitleText": "",
        "navigationStyle": "custom",
        "navigationBarBackgroundColor": "#1C1410",
        "disableScroll": true
      }
    },
    {
      "path": "pages/schedule/schedule",
      "style": {
        "navigationBarTitleText": "",
        "navigationStyle": "custom",
        "navigationBarTextStyle": "white",
        "navigationBarBackgroundColor": "#1C1410"
      }
    }
  ],
  "globalStyle": {
    "navigationBarTextStyle": "white",
    "navigationBarTitleText": "西亚斯课表",
    "navigationBarBackgroundColor": "#1C1410",
    "backgroundColor": "#1C1410"
  }
}
```

### 应用配置

配置文件位置：`src/manifest.json`

```json
{
  "name": "西亚斯课表",
  "appid": "__UNI__4A0FB40",
  "description": "西亚斯课表助手 - 便捷查看课表",
  "versionName": "1.0.16",
  "versionCode": 10016,
  "transformPx": false,
  "app-plus": {
    "usingComponents": true,
    "modules": {
      "push": {}
    },
    "statusbar": {
      "immersive": true,
      "style": "light",
      "background": "#1C1410"
    }
  }
}
```

| 配置项 | 说明 |
|--------|------|
| name | 应用名称 |
| appid | 应用ID |
| description | 应用描述 |
| versionName | 版本名称 |
| versionCode | 版本代码 |
| modules.push | 推送模块 |
| statusbar.immersive | 沉浸式状态栏 |

## 全局样式

配置文件位置：`src/uni.scss`

### SCSS变量

```scss
/* 主题色 */
$primary-color: #C87A3C;
$primary-light: #D4975A;
$primary-dark: #8B4A1A;

/* 辅助色 */
$success-color: #6B8A4A;
$warning-color: #C8A030;
$error-color: #9A4A3E;

/* 文字色 */
$text-color: #F0E6D8;
$text-secondary: rgba(240, 230, 216, 0.6);
$text-placeholder: rgba(240, 230, 216, 0.25);

/* 背景色 */
$bg-color: #1C1410;
$bg-card: #2A1E16;
$bg-surface: #211912;

/* 间距 */
$spacing-xs: 8rpx;
$spacing-sm: 16rpx;
$spacing-md: 24rpx;
$spacing-lg: 32rpx;
$spacing-xl: 48rpx;

/* 字体大小 */
$font-size-xs: 20rpx;
$font-size-sm: 24rpx;
$font-size-md: 28rpx;
$font-size-lg: 32rpx;
$font-size-xl: 36rpx;

/* 圆角 */
$border-radius-sm: 8rpx;
$border-radius-md: 12rpx;
$border-radius-lg: 20rpx;
$border-radius-full: 9999rpx;
```

## 配置优先级

1. **环境变量** > **配置文件** > **默认值**
2. **页面配置** > **全局配置**
3. **用户设置** > **默认配置**

## 配置修改建议

### 修改默认学期开始日期

编辑 `src/config/schedule.ts`：

```typescript
export const SCHEDULE_CONFIG = {
  DEFAULT_SEMESTER_START: '2026-09-01',  // 修改为新日期
};
```

### 添加新主题

编辑 `src/config/themes.ts`：

```typescript
export const THEME_PALETTES = {
  // 现有主题...
  
  // 新增主题
  myTheme: {
    colors: [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
      '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
    ],
    glowColors: [
      '#FF8A8A', '#6EDDD6', '#65D7E1', '#B6DEC4',
      '#FFFAC7', '#EDB0ED', '#B8E8D8', '#F7EC8F',
      '#DBAFE0', '#A5D1F9', '#F8C520', '#20DEE1',
    ]
  }
};
```

### 修改开发端口

编辑 `.env`：

```env
UNI_H5_PORT=3000  # 修改为新端口
```
