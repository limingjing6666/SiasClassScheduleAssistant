/**
 * 课表颜色配置中心
 */

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
    glowColors: [ // 在极简下不使用发光，这里保留纯色防报错
      '#F4F6F8', '#F9F5F0', '#F0F7F4', '#FCF2F2',
      '#F4F1F8', '#F2FBF9', '#FDF6EB', '#F5F5FA',
      '#FDF4EC', '#EEF6F8', '#F8EFF2', '#F1F4F9',
    ]
  },
};
