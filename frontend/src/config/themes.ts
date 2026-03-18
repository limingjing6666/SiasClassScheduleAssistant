/**
 * 课表颜色配置中心
 */

export const THEME_PALETTES: Record<string, { colors: string[], glowColors: string[] }> = {
  // 1. 经典深色 (暖大地色)
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
  
  // 2. 莫兰迪灰 (低饱和度、高级灰)
  morandi: {
    colors: [
      '#9A8194', '#A39391', '#8B9A93', '#918D7E',
      '#7D8B9A', '#9A918B', '#878E86', '#8B8282',
      '#939A86', '#868B93', '#8E868E', '#939086',
    ],
    glowColors: [
      '#B59FB0', '#C0B1AF', '#A9B8B1', '#B0AC9C',
      '#9BA9B8', '#B8ADA9', '#A5ACA4', '#A9A0A0',
      '#B1B8A4', '#A4A9B8', '#ACA4AC', '#B1AEA4',
    ]
  },

  // 3. 浅色纸质 (高亮、护眼)
  light: {
    colors: [
      '#D4A373', '#CCD5AE', '#E9EDC9', '#FEFAE0',
      '#FAEDCD', '#DDBEA9', '#A3B18A', '#588157',
      '#3A5A40', '#344E41', '#B5838D', '#E5989B',
    ],
    glowColors: [
      '#E1B382', '#DAE2BF', '#F2F6DB', '#FFFCEB',
      '#FDF3DB', '#EDCFBB', '#B4C29B', '#699268',
      '#4B6B51', '#455F52', '#C6949E', '#F6A9AC',
    ]
  }
};
