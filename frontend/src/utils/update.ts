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

  const isApk = url.toLowerCase().includes('.apk');
  const extension = isApk ? '.apk' : '.wgt';
  const savePath = '_doc/update/sias_update_' + new Date().getTime() + extension;

  const dtask = plus.downloader.createDownload(
    url,
    { filename: savePath },
    (downloadResult, status) => {
      uni.hideLoading();
      if (status === 200 && downloadResult.filename) {
        // 确保使用带正确后缀的本地文件路径
        plus.runtime.install(
          downloadResult.filename,
          { force: true },
          () => {
            if (isApk) {
              console.log('[Update] APK 安装程序已由系统调起');
            } else {
              uni.showToast({ title: '热更新安装完毕，即将重启', icon: 'none' });
              setTimeout(() => { plus.runtime.restart(); }, 1500);
            }
          },
          (e) => {
            console.error('[Update] 安装包覆盖失败', e);
            uni.showToast({ title: '安装失败，请检查包结构', icon: 'none' });
          }
        );
      } else {
        console.error('[Update] 下载失败, status:', status);
        uni.showToast({ title: '下载失败，请确认网络连接', icon: 'none' });
      }
    }
  );

  dtask.start();
  // #endif
}
