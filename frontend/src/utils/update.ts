/**
 * App 自动更新检测逻辑
 */

const UPDATE_URL = 'http://limingjing.codes/app/update.json';

export function checkUpdate() {
  // #ifndef APP-PLUS
  console.log('[Update] H5 模式跳过自动更新检测');
  return;
  // #endif

  // #ifdef APP-PLUS
  if (typeof plus === 'undefined') return;
  plus.runtime.getProperty(plus.runtime.appid!, (widgetInfo) => {
    // 例如获取到 101
    const currentCode = parseInt(widgetInfo.versionCode || '0', 10);

    uni.request({
      url: UPDATE_URL + '?t=' + new Date().getTime(), // 避免浏览器或 CDN 缓存
      method: 'GET',
      success: (res: any) => {
        if (res.statusCode === 200 && res.data) {
          const serverCode = parseInt(String(res.data.versionCode || '0'), 10);
          console.log(`[Update] 本地版本: ${currentCode}, 云端版本: ${serverCode}`);
          if (serverCode > currentCode) {
            promptUpdate(res.data);
          }
        }
      },
      fail: (err) => {
        console.error('[Update] 检查更新失败', err);
      }
    });
  });
  // #endif
}

function promptUpdate(updateData: any) {
  // #ifdef APP-PLUS
  uni.showModal({
    title: `发现新版本 v${updateData.versionName}`,
    content: updateData.updateLog || '修复了一些已知问题，提升了用户体验。',
    confirmText: '立即更新',
    cancelText: '稍后',
    success: (res) => {
      if (res.confirm && updateData.url) {
        doDownload(updateData.url);
      }
    }
  });
  // #endif
}

function doDownload(url: string) {
  // #ifdef APP-PLUS
  uni.showLoading({ title: '正在下载更新包...', mask: true });

  uni.downloadFile({
    url: url,
    success: (downloadResult) => {
      uni.hideLoading();
      if (downloadResult.statusCode === 200) {
        const filePath = downloadResult.tempFilePath;
        const isApk = url.toLowerCase().endsWith('.apk');

        if (isApk) {
          // APK 文件：调起系统安装器
          plus.runtime.openFile(filePath, {}, (e) => {
            console.error('[Update] 打开 APK 失败', e);
            uni.showToast({ title: '打开安装包失败', icon: 'none' });
          });
        } else {
          // WGT 热更新资源包：静默安装并重启
          plus.runtime.install(
            filePath,
            { force: false },
            () => { plus.runtime.restart(); },
            (e) => {
              console.error('[Update] WGT 安装失败', e);
              uni.showToast({ title: '安装更新失败', icon: 'none' });
            }
          );
        }
      } else {
        console.error('[Update] 下载失败, statusCode:', downloadResult.statusCode);
        uni.showToast({ title: '下载失败，请稍后重试', icon: 'none' });
      }
    },
    fail: (err) => {
      uni.hideLoading();
      console.error('[Update] 下载请求失败', err);
      uni.showToast({ title: '网络连接失败，无法下载更新', icon: 'none' });
    }
  });
  // #endif
}
