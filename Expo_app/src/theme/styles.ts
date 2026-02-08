/**
 * 液态玻璃样式 - 共享样式
 * 适用于 React Native
 */
import { StyleSheet } from 'react-native'
import { Colors, Gradients } from './colors'
import { Spacing, BorderRadius, FontSize, FontWeight, Shadows } from './spacing'

/**
 * 基础样式
 */
export const BaseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
})

/**
 * 液态玻璃卡片样式
 */
export const GlassCardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.glass,
  },
  cardSmall: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  cardLarge: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl3,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.lg,
    ...Shadows.lg,
  },
})

/**
 * 液态玻璃按钮样式
 */
export const GlassButtonStyles = StyleSheet.create({
  button: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  buttonPrimary: {
    backgroundColor: Colors.gradientBlue,
    borderRadius: BorderRadius.xl2,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  buttonLarge: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl3,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xl2,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  buttonLargePrimary: {
    backgroundColor: Colors.gradientBlue,
    borderRadius: BorderRadius.xl3,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xl2,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },
})

/**
 * 液态玻璃输入框样式
 */
export const GlassInputStyles = StyleSheet.create({
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  inputLarge: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text.primary,
  },
})

/**
 * 文字样式
 */
export const TextStyles = StyleSheet.create({
  // 标题
  title: {
    fontSize: FontSize.xl5,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  titleLarge: {
    fontSize: FontSize.xl7,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  body: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
  },
  caption: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
})

/**
 * 分隔线样式
 */
export const DividerStyles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.lg,
  },
})

/**
 * 状态指示器样式
 */
export const StatusStyles = StyleSheet.create({
  indicator: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
  },
  indicatorActive: {
    backgroundColor: Colors.success,
  },
  indicatorInactive: {
    backgroundColor: Colors.text.tertiary,
  },
  indicatorError: {
    backgroundColor: Colors.error,
  },
})
