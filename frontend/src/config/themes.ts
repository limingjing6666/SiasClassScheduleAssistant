/**
 * 课表颜色配置中心
 *
 * 每种颜色包含：
 * - bg: 卡片背景色
 * - border: 卡片边框色
 * - text: 卡片文字色
 * - tag: 教室标签背景色
 * - tagText: 教室标签文字色
 * - icon: 弹窗图标背景色
 * - iconText: 弹窗图标文字色
 * - btn: 弹窗按钮背景色
 */

export interface CourseTheme {
  bg: string;
  border: string;
  text: string;
  tag: string;
  tagText: string;
  icon: string;
  iconText: string;
  btn: string;
}

export const COURSE_THEMES: CourseTheme[] = [
  { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E3A5F', tag: '#DBEAFE', tagText: '#1D4ED8', icon: '#DBEAFE', iconText: '#2563EB', btn: '#3B82F6' },
  { bg: '#ECFDF5', border: '#A7F3D0', text: '#064E3B', tag: '#D1FAE5', tagText: '#047857', icon: '#D1FAE5', iconText: '#059669', btn: '#10B981' },
  { bg: '#F5F3FF', border: '#DDD6FE', text: '#3B0764', tag: '#EDE9FE', tagText: '#6D28D9', icon: '#EDE9FE', iconText: '#7C3AED', btn: '#8B5CF6' },
  { bg: '#FFFBEB', border: '#FDE68A', text: '#78350F', tag: '#FEF3C7', tagText: '#B45309', icon: '#FEF3C7', iconText: '#D97706', btn: '#F59E0B' },
  { bg: '#FFF1F2', border: '#FECDD3', text: '#881337', tag: '#FFE4E6', tagText: '#BE123C', icon: '#FFE4E6', iconText: '#E11D48', btn: '#F43F5E' },
  { bg: '#EEF2FF', border: '#C7D2FE', text: '#312E81', tag: '#E0E7FF', tagText: '#4338CA', icon: '#E0E7FF', iconText: '#4F46E5', btn: '#6366F1' },
  { bg: '#F0FDFA', border: '#99F6E4', text: '#134E4A', tag: '#CCFBF1', tagText: '#0F766E', icon: '#CCFBF1', iconText: '#0D9488', btn: '#14B8A6' },
  { bg: '#FFF7ED', border: '#FED7AA', text: '#7C2D12', tag: '#FFEDD5', tagText: '#C2410C', icon: '#FFEDD5', iconText: '#EA580C', btn: '#F97316' },
  { bg: '#FDF2F8', border: '#FBCFE8', text: '#831843', tag: '#FCE7F3', tagText: '#BE185D', icon: '#FCE7F3', iconText: '#DB2777', btn: '#EC4899' },
  { bg: '#F0F9FF', border: '#BAE6FD', text: '#0C4A6E', tag: '#E0F2FE', tagText: '#0369A1', icon: '#E0F2FE', iconText: '#0284C7', btn: '#0EA5E9' },
  { bg: '#FEFCE8', border: '#FDE047', text: '#713F12', tag: '#FEF9C3', tagText: '#A16207', icon: '#FEF9C3', iconText: '#CA8A04', btn: '#EAB308' },
  { bg: '#F8FAFC', border: '#CBD5E1', text: '#1E293B', tag: '#E2E8F0', tagText: '#475569', icon: '#E2E8F0', iconText: '#64748B', btn: '#64748B' },
];

// 兼容旧接口（ScheduleGrid 等仍可用 colors/glowColors）
export const THEME_PALETTES: Record<string, { colors: string[], glowColors: string[] }> = {
  minimalist: {
    colors: COURSE_THEMES.map(t => t.bg),
    glowColors: COURSE_THEMES.map(t => t.border),
  },
};
