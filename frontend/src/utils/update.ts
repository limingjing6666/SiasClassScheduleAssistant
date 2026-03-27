/**
 * App 自动更新检测逻辑
 */

const UPDATE_URL = 'http://limingjing.codes/app/update.json';

interface UpdateData {
  versionCode: string | number;
  versionName: string;
  updateLog?: string;
  url?: string;
}

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
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          const data = res.data as UpdateData;
          const serverCode = parseInt(String(data.versionCode || '0'), 10);
          console.log(`[Update] 本地版本: ${currentCode}, 云端版本: ${serverCode}`);
          if (serverCode > currentCode) {
            promptUpdate(data);
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

function promptUpdate(updateData: UpdateData) {
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

/** 全局下载进度（供外部 UI 读取） */
let _progressCallback: ((percent: number, status: string) => void) | null = null;

/**
 * 注册下载进度回调（App.vue 调用）
 */
export function onDownloadProgress(cb: (percent: number, status: string) => void) {
  _progressCallback = cb;
}

function doDownload(url: string) {
  // #ifdef APP-PLUS
  const isApk = url.toLowerCase().includes('.apk');
  const extension = isApk ? '.apk' : '.wgt';
  const savePath = '_doc/update/sias_update_' + new Date().getTime() + extension;

  // 通知 UI 开始下载
  _progressCallback?.(0, '准备下载...');

  const dtask = plus.downloader.createDownload(
    url,
    { filename: savePath },
    (downloadResult, status) => {
      if (status === 200 && downloadResult.filename) {
        _progressCallback?.(100, '安装中...');
        plus.runtime.install(
          downloadResult.filename,
          { force: true },
          () => {
            if (isApk) {
              _progressCallback?.(-1, ''); // 关闭进度
              console.log('[Update] APK 安装程序已由系统调起');
            } else {
              _progressCallback?.(100, '即将重启...');
              setTimeout(() => { plus.runtime.restart(); }, 1500);
            }
          },
          (e) => {
            _progressCallback?.(-1, '');
            console.error('[Update] 安装包覆盖失败', e);
            uni.showToast({ title: '安装失败', icon: 'none' });
          }
        );
      } else {
        _progressCallback?.(-1, '');
        console.error('[Update] 下载失败, status:', status);
        uni.showToast({ title: '下载失败', icon: 'none' });
      }
    }
  );

  // 监听下载进度
  dtask.addEventListener('statechanged', (task) => {
    if (task.totalSize && task.totalSize > 0 && task.downloadedSize) {
      const percent = Math.round((task.downloadedSize / task.totalSize) * 100);
      const downloadedMB = (task.downloadedSize / 1024 / 1024).toFixed(1);
      const totalMB = (task.totalSize / 1024 / 1024).toFixed(1);
      _progressCallback?.(percent, `${downloadedMB}MB / ${totalMB}MB`);
    }
  });

  dtask.start();
  // #endif
}
