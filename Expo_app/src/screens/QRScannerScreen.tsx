import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  Platform,
  Modal,
} from 'react-native'
import { CameraView, Camera } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import type { ConnectionConfig } from '../types'
import { Colors } from '../theme/colors'
import { Spacing, BorderRadius, FontSize, FontWeight } from '../theme/spacing'

interface QRScannerScreenProps {
  visible: boolean
  onScan: (config: ConnectionConfig) => void
  onClose: () => void
}

export default function QRScannerScreen({
  visible,
  onScan,
  onClose,
}: QRScannerScreenProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [scanned, setScanned] = useState(false)
  const [confirmData, setConfirmData] = useState<ConnectionConfig | null>(null)

  // 请求相机权限
  useEffect(() => {
    if (!visible) return

    const requestCameraPermission = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync()
      setHasPermission(status === 'granted')
    }

    requestCameraPermission()
  }, [visible])

  // 重置扫描状态
  useEffect(() => {
    if (visible) {
      setScanned(false)
      setConfirmData(null)
    }
  }, [visible])

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return

    setScanned(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      // 解析 JSON 格式的 QR 码
      const parsed = JSON.parse(data)

      if (parsed.url && parsed.password !== undefined) {
        // 显示确认对话框
        setConfirmData({
          url: parsed.url,
          password: parsed.password || undefined,
        })
      } else {
        throw new Error('Invalid format')
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert(
        '扫描失败',
        '无效的二维码格式，请确保扫描的是 CC QwQ 桌面端的连接码',
        [
          { text: '重试', onPress: () => setScanned(false) },
          { text: '取消', onPress: onClose, style: 'cancel' },
        ]
      )
    }
  }

  const handleConfirmConnect = () => {
    if (confirmData) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      onScan(confirmData)
      onClose()
    }
  }

  const handleCancelConfirm = () => {
    setConfirmData(null)
    setScanned(false)
  }

  if (!visible) return null

  if (hasPermission === null) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <StatusBar barStyle="light-content" />
        <View style={styles.container}>
          <View style={styles.centerContent}>
            <Text style={styles.loadingText}>请求相机权限中...</Text>
          </View>
        </View>
      </Modal>
    )
  }

  if (hasPermission === false) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <StatusBar barStyle="light-content" />
        <View style={styles.container}>
          <View style={styles.centerContent}>
            <Text style={styles.errorIcon}>📷</Text>
            <Text style={styles.errorTitle}>需要相机权限</Text>
            <Text style={styles.errorText}>
              请在设置中允许 CC QwQ 访问相机以扫描二维码
            </Text>
            <TouchableOpacity style={styles.errorButton} onPress={onClose}>
              <Text style={styles.errorButtonText}>返回</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />

      {/* 相机扫描界面 */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />

        {/* 顶部覆盖层 */}
        <View style={styles.topOverlay}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>扫描二维码</Text>
          <View style={styles.closeButtonPlaceholder} />
        </View>

        {/* 扫描框 */}
        <View style={styles.scanContainer}>
          <View style={styles.scanCorner} />
          <View style={[styles.scanCorner, styles.scanCornerTopRight]} />
          <View style={[styles.scanCorner, styles.scanCornerBottomLeft]} />
          <View style={[styles.scanCorner, styles.scanCornerBottomRight]} />

          {/* 扫描线动画 */}
          {!scanned && (
            <View style={styles.scanLineContainer}>
              <View style={styles.scanLine} />
            </View>
          )}

          <Text style={styles.scanHint}>
            将二维码放入框内{'\n'}自动扫描
          </Text>
        </View>

        {/* 底部覆盖层 */}
        <View style={styles.bottomOverlay} />
      </View>

      {/* 确认对话框 */}
      <Modal visible={confirmData !== null} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmIcon}>📱</Text>
            <Text style={styles.confirmTitle}>确认连接</Text>

            <View style={styles.confirmInfo}>
              <Text style={styles.confirmLabel}>服务器地址</Text>
              <Text style={styles.confirmValue}>{confirmData?.url}</Text>
            </View>

            <View style={styles.confirmInfo}>
              <Text style={styles.confirmLabel}>密码</Text>
              <Text style={styles.confirmValue}>
                {confirmData?.password ? '•••••••• (已包含)' : '无密码'}
              </Text>
            </View>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmButtonSecondary}
                onPress={handleCancelConfirm}
              >
                <Text style={styles.confirmButtonTextSecondary}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButtonPrimary}
                onPress={handleConfirmConnect}
              >
                <Text style={styles.confirmButtonTextPrimary}>连接</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    fontSize: FontSize.lg,
    color: Colors.text.primary,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
  errorTitle: {
    fontSize: FontSize.xl2,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: FontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  errorButton: {
    backgroundColor: Colors.gradientBlue,
    paddingHorizontal: Spacing.xl3,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl2,
  },
  errorButtonText: {
    color: Colors.text.inverse,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  // 相机容器
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  // 顶部覆盖层
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: FontSize.xl2,
    fontWeight: FontWeight.medium,
  },
  closeButtonPlaceholder: {
    width: 36,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: '#fff',
  },
  // 扫描框
  scanContainer: {
    position: 'absolute',
    top: '35%',
    left: '15%',
    width: '70%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanCorner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#fff',
    top: 0,
    left: 0,
  },
  scanCornerTopRight: {
    left: undefined,
    right: 0,
    borderTopWidth: 3,
    borderLeftWidth: 0,
    borderRightWidth: 3,
  },
  scanCornerBottomLeft: {
    top: undefined,
    bottom: 0,
    borderTopWidth: 0,
    borderBottomWidth: 3,
  },
  scanCornerBottomRight: {
    top: undefined,
    left: undefined,
    right: 0,
    bottom: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scanLineContainer: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    height: '100%',
    overflow: 'hidden',
  },
  scanLine: {
    width: '100%',
    height: 2,
    backgroundColor: Colors.gradientBlue,
    shadowColor: Colors.gradientBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  scanHint: {
    position: 'absolute',
    bottom: -40,
    fontSize: FontSize.sm,
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  // 确认对话框
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl3,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.xl,
  },
  confirmIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  confirmTitle: {
    fontSize: FontSize.xl2,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  confirmInfo: {
    marginBottom: Spacing.md,
  },
  confirmLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  confirmValue: {
    fontSize: FontSize.md,
    color: Colors.text.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  confirmButtonSecondary: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl2,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  confirmButtonTextSecondary: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
  },
  confirmButtonPrimary: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl2,
    backgroundColor: Colors.gradientBlue,
    alignItems: 'center',
  },
  confirmButtonTextPrimary: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text.inverse,
  },
})
