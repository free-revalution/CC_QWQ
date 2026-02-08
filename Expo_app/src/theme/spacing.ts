/**
 * 间距系统 - 8点网格
 * 遵循苹果设计规范的间距系统
 */

// 间距值（基于 8px）
export const Spacing = {
  // 基础间距
  xs: 4,    // 4px
  sm: 8,    // 8px
  md: 16,   // 16px
  lg: 24,   // 24px
  xl: 32,   // 32px
  xl2: 40,  // 40px
  xl3: 48,  // 48px
  xl4: 64,  // 64px
  xl5: 80,  // 80px
  xl6: 96,  // 96px
} as const

// 圆角系统
export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xl2: 24,
  xl3: 32,
  xl4: 40,
  full: 9999,
} as const

// 字体大小
export const FontSize = {
  xs: 12,
  sm: 14,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  xl2: 24,
  xl3: 28,
  xl4: 32,
  xl5: 36,
  xl6: 48,
  xl7: 64,
} as const

// 字体粗细
export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
} as const

// 阴影
export const Shadows = {
  sm: {
    shadowColor: 'rgba(0, 0, 0, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
  },
  lg: {
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 8,
  },
  xl: {
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 48,
    elevation: 12,
  },
  // 玻璃卡片阴影
  glass: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 8,
  },
} as const

// 动画时长
export const AnimationDuration = {
  fast: 150,
  base: 300,
  slow: 500,
} as const

// 动画缓动函数
export const AnimationEasing = {
  ease: 'ease-in-out' as const,
  spring: {
    damping: 15,
    stiffness: 150,
    mass: 0.5,
  },
} as const
