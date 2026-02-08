/**
 * 液态玻璃主题 - 颜色配置
 * 苹果风格渐变和色彩系统
 */

// 苹果风格渐变色彩
export const Colors = {
  // 主色调
  primary: '#1D1D1F',
  secondary: '#86868B',

  // 背景色
  background: '#F5F5F7',
  surface: 'rgba(255, 255, 255, 0.7)',
  surfaceSolid: '#FFFFFF',

  // 苹果渐变色
  gradientBlue: '#007AFF',
  gradientPurple: '#5856D6',
  gradientPink: '#FF2D55',
  gradientOrange: '#FF9500',
  gradientGreen: '#34C759',

  // 边框和阴影
  border: 'rgba(0, 0, 0, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.5)',

  // 状态色
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#007AFF',

  // 文字颜色
  text: {
    primary: '#1D1D1F',
    secondary: '#86868B',
    tertiary: '#C7C7CC',
    inverse: '#FFFFFF',
  },

  // 玻璃效果颜色
  glass: {
    tint: 'rgba(255, 255, 255, 0.25)',
    shine: 'rgba(255, 255, 255, 0.5)',
    shadow: 'rgba(0, 0, 0, 0.1)',
  },
} as const

// 渐变色配置
export const Gradients = {
  // 主渐变 - 蓝紫粉
  primary: ['#007AFF', '#5856D6', '#FF2D55'],

  // 蓝色渐变
  blue: ['#007AFF', '#00C7BE'],

  // 暖色渐变
  warm: ['#FF9500', '#FF2D55'],

  // 冷色渐变
  cool: ['#5856D6', '#007AFF'],

  // 玻璃渐变
  glass: ['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)'],
} as const
