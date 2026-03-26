/**
 * 权限管理工具
 * 处理通知权限和自启动权限
 */

/**
 * 检查通知权限
 */
export function checkNotificationPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    // #ifdef APP-PLUS
    if (plus.os.name === 'Android') {
      try {
        const main = plus.android.runtimeMainActivity();
        const NotificationManagerCompat = plus.android.importClass(
          'androidx.core.app.NotificationManagerCompat'
        );
        const manager = NotificationManagerCompat.from(main);
        resolve(manager.areNotificationsEnabled());
      } catch {
        resolve(false);
      }
    } else {
      // iOS
      resolve(true);
    }
    // #endif

    // #ifndef APP-PLUS
    resolve(false);
    // #endif
  });
}

/**
 * 跳转到应用设置页面
 * 用于开启通知权限和自启动权限
 */
export function openAppSettings(): void {
  // #ifdef APP-PLUS
  if (plus.os.name === 'Android') {
    try {
      const main = plus.android.runtimeMainActivity();
      const Intent = plus.android.importClass('android.content.Intent');
      const Settings = plus.android.importClass('android.provider.Settings');
      const Uri = plus.android.importClass('android.net.Uri');

      const intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
      const uri = Uri.fromParts('package', main.getPackageName(), null);
      intent.setData(uri);
      main.startActivity(intent);
    } catch {
      uni.showToast({ title: '无法打开设置', icon: 'none' });
    }
  } else {
    // iOS 跳转到设置
    try {
      const UIApplication = plus.ios.importClass('UIApplication');
      const app = UIApplication.sharedApplication();
      const NSURL = plus.ios.importClass('NSURL');
      const url = NSURL.URLWithString('app-settings:');
      app.openURL(url);
      plus.ios.deleteObject(url);
      plus.ios.deleteObject(app);
    } catch {
      uni.showToast({ title: '无法打开设置', icon: 'none' });
    }
  }
  // #endif
}

/**
 * 检查是否首次请求权限
 */
export function isFirstTimeRequest(): boolean {
  const key = 'permission_requested';
  return !uni.getStorageSync(key);
}

/**
 * 保存权限请求标记
 */
export function savePermissionRequested(): void {
  uni.setStorageSync('permission_requested', true);
}

/**
 * 判断是否需要显示权限弹窗（供 App.vue 调用）
 */
export async function shouldShowPermissionModal(): Promise<boolean> {
  if (!isFirstTimeRequest()) return false;
  const hasPermission = await checkNotificationPermission();
  return !hasPermission;
}

/**
 * 用户确认开启权限后的处理
 */
export function onPermissionConfirm(): void {
  openAppSettings();
  setTimeout(() => {
    savePermissionRequested();
  }, 2000);
}

/**
 * 用户拒绝开启权限后的处理
 */
export function onPermissionCancel(): void {
  savePermissionRequested();
}

/**
 * 检查并处理首次权限请求（非弹窗模式，仅返回权限状态）
 */
export async function handleFirstTimePermission(): Promise<boolean> {
  if (!isFirstTimeRequest()) {
    return await checkNotificationPermission();
  }
  // 首次时由 App.vue 的 MangaModal 处理弹窗
  return false;
}
