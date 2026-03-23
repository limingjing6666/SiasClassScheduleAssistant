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
 * 显示首次权限请求弹窗
 */
export function showFirstTimePermissionRequest(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: '开启课前提醒',
      content: '为了在课程开始前20分钟提醒您上课，请开启通知权限。\n\n应用关闭后仍能正常提醒。',
      confirmText: '去开启',
      cancelText: '暂不开启',
      success: (res) => {
        if (res.confirm) {
          // 用户同意，显示详细权限引导
          showDetailedPermissionGuide();
        } else {
          // 用户拒绝，保存标记
          savePermissionRequested();
        }
        resolve(res.confirm);
      }
    });
  });
}

/**
 * 显示详细权限引导弹窗
 */
export function showDetailedPermissionGuide(): void {
  // #ifdef APP-PLUS
  const isAndroid = plus.os.name === 'Android';

  const content = isAndroid
    ? '请按照以下步骤开启权限：\n\n步骤1：开启通知权限\n在应用设置页面，找到"通知"选项，开启通知权限。\n\n步骤2：开启自启动权限\n在应用设置页面，找到"自启动"选项，开启自启动权限。（部分设备可能在"电池优化"或"后台运行"中设置）'
    : '请按照以下步骤开启权限：\n\n步骤1：开启通知权限\n在应用设置页面，找到"通知"选项，开启通知权限。';

  uni.showModal({
    title: '权限设置',
    content: content,
    confirmText: '去设置',
    cancelText: '稍后设置',
    success: (res) => {
      if (res.confirm) {
        // 跳转到应用设置页面
        openAppSettings();

        // 延迟保存标记，给用户时间设置
        setTimeout(() => {
          savePermissionRequested();
        }, 2000);
      } else {
        // 用户选择稍后，保存标记
        savePermissionRequested();
      }
    }
  });
  // #endif
}

/**
 * 检查并处理首次权限请求
 */
export async function handleFirstTimePermission(): Promise<boolean> {
  // 检查是否首次
  if (!isFirstTimeRequest()) {
    // 非首次，检查权限
    return await checkNotificationPermission();
  }

  // 首次，显示弹窗
  const userAgreed = await showFirstTimePermissionRequest();

  if (userAgreed) {
    // 用户同意，延迟检查权限（等待用户从设置页面返回）
    return new Promise((resolve) => {
      setTimeout(async () => {
        const hasPermission = await checkNotificationPermission();
        resolve(hasPermission);
      }, 3000);
    });
  }

  return false;
}
