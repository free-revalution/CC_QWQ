import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import type { ConnectionConfig } from '../types'
import { Colors } from '../theme/colors'
import { Spacing, BorderRadius, FontSize, FontWeight } from '../theme/spacing'
import { GlassCardStyles, GlassButtonStyles, GlassInputStyles, TextStyles } from '../theme/styles'
import QRScannerScreen from './QRScannerScreen'

interface LoginScreenProps {
  onConnect: (config: ConnectionConfig) => void
}

export default function LoginScreen({ onConnect }: LoginScreenProps) {
  const [ipAddress, setIpAddress] = useState('192.168.1.100')
  const [port, setPort] = useState('3000')
  const [password, setPassword] = useState('')
  const [showQRScanner, setShowQRScanner] = useState(false)

  const handleConnect = () => {
    if (!ipAddress || !port) {
      Alert.alert('错误', '请输入 IP 地址和端口')
      return
    }

    const config: ConnectionConfig = {
      url: `ws://${ipAddress}:${port}`,
      password: password || undefined,
    }

    onConnect(config)
  }

  const handleScanQR = () => {
    setShowQRScanner(true)
  }

  const handleQRScan = (config: ConnectionConfig) => {
    // 从 URL 中解析 IP 和端口，填充到输入框
    const urlMatch = config.url.match(/ws:\/\/([^:]+):(\d+)/)
    if (urlMatch) {
      setIpAddress(urlMatch[1])
      setPort(urlMatch[2])
    }

    // 如果有密码，也填充
    if (config.password) {
      setPassword(config.password)
    }

    // 自动连接
    onConnect(config)
  }

  return (
    <View style={styles.container}>
      {/* 背景装饰 - 渐变光晕 */}
      <View style={styles.backgroundDecoration} />
      <View style={styles.backgroundDecoration2} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 顶部标题区域 */}
          <View style={styles.header}>
            {/* 渐变装饰图标 */}
            <View style={styles.iconContainer}>
              <View style={[styles.iconInner, { backgroundColor: Colors.gradientBlue + '20' }]}>
                <Text style={styles.icon}>✨</Text>
              </View>
            </View>

            {/* 大号标题 */}
            <Text style={styles.title}>
              <Text style={styles.titleGradient}>CC</Text>{' '}
              <Text style={styles.titleNormal}>QwQ</Text>
            </Text>

            {/* 副标题 */}
            <Text style={styles.subtitle}>连接到桌面端</Text>
          </View>

          {/* 连接卡片 */}
          <View style={styles.cardContainer}>
            {/* 二维码扫描按钮 */}
            <TouchableOpacity
              style={[styles.qrButton, GlassCardStyles.card]}
              onPress={handleScanQR}
            >
              <Text style={styles.qrButtonText}>📷 扫描二维码连接</Text>
            </TouchableOpacity>

            {/* 分隔线 */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>或手动输入</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* 输入框组 */}
            <View style={styles.inputGroup}>
              {/* IP 地址输入 */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>IP 地址</Text>
                <TextInput
                  style={[styles.input, GlassInputStyles.inputLarge]}
                  value={ipAddress}
                  onChangeText={setIpAddress}
                  placeholder="192.168.1.100"
                  placeholderTextColor={Colors.text.tertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                />
              </View>

              {/* 端口输入 */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>端口</Text>
                <TextInput
                  style={[styles.input, GlassInputStyles.inputLarge]}
                  value={port}
                  onChangeText={setPort}
                  placeholder="3000"
                  placeholderTextColor={Colors.text.tertiary}
                  keyboardType="number-pad"
                />
              </View>

              {/* 密码输入 */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>密码（可选）</Text>
                <TextInput
                  style={[styles.input, GlassInputStyles.inputLarge]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="输入连接密码"
                  placeholderTextColor={Colors.text.tertiary}
                  secureTextEntry
                />
              </View>
            </View>

            {/* 连接按钮 */}
            <TouchableOpacity
              style={styles.connectButton}
              onPress={handleConnect}
            >
              <View style={styles.connectButtonGradient}>
                <Text style={styles.connectButtonText}>连接</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 底部提示 */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              确保手机和电脑在同一局域网
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 二维码扫描 */}
      <QRScannerScreen
        visible={showQRScanner}
        onScan={handleQRScan}
        onClose={() => setShowQRScanner(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // 背景装饰
  backgroundDecoration: {
    position: 'absolute',
    top: -100,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.gradientBlue + '10',
    filter: 'blur(60px)',
  },
  backgroundDecoration2: {
    position: 'absolute',
    bottom: -80,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.gradientPink + '08',
    filter: 'blur(80px)',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl4,
  },
  // 头部
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xl3,
    paddingBottom: Spacing.xl2,
  },
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  iconInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: FontSize.xl6,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  titleGradient: {
    color: Colors.gradientBlue,
  },
  titleNormal: {
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: FontSize.lg,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  // 卡片容器
  cardContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl3,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  // 二维码按钮
  qrButton: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  qrButtonText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.text.primary,
  },
  // 分隔线
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    paddingHorizontal: Spacing.md,
  },
  // 输入框
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputContainer: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    // 样式已由 GlassInputStyles.inputLarge 提供
  },
  // 连接按钮
  connectButton: {
    overflow: 'hidden',
    borderRadius: BorderRadius.xl3,
  },
  connectButtonGradient: {
    backgroundColor: Colors.gradientBlue,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    borderRadius: BorderRadius.xl3,
  },
  connectButtonText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text.inverse,
  },
  // 底部
  footer: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  footerText: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
})
