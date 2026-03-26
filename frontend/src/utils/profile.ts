/**
 * 个人资料解析与获取工具
 * 从 homeExt!main.action 页面中提取姓名、头像等信息
 */

export interface UserProfile {
  name: string;           // 姓名
  studentId: string;      // 学号
  avatarUrl: string;      // 头像 URL（远程）
  avatarLocalPath: string; // 头像本地路径
  visitCount: string;     // 访问次数
}

const PROFILE_CACHE_KEY = 'user_profile';
const PROFILE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 小时

/**
 * 从首页 HTML 中解析个人资料
 */
export function parseProfileHtml(html: string, baseUrl: string): UserProfile | null {
  try {
    // 解析姓名: <h3>您好,&nbsp;&nbsp;<span>李明景</span>&nbsp;&nbsp;</h3>
    const nameMatch = html.match(/您好[,，]?\s*(?:&nbsp;)*\s*<span>([^<]+)<\/span>/);
    const name = nameMatch ? nameMatch[1].trim() : '';

    // 解析学号: showSelfAvatar.action?user.name=2023105190218
    const idMatch = html.match(/showSelfAvatar\.action\?user\.name=(\d+)/);
    const studentId = idMatch ? idMatch[1] : '';

    // 拼接头像 URL
    const avatarUrl = studentId ? `${baseUrl}/showSelfAvatar.action?user.name=${studentId}` : '';

    // 解析访问次数: <span>886</span> 次/访问
    const visitMatch = html.match(/<span>(\d+)<\/span>\s*次\/访问/);
    const visitCount = visitMatch ? visitMatch[1] : '';

    if (!name && !studentId) {
      return null;
    }

    return { name, studentId, avatarUrl, avatarLocalPath: '', visitCount };
  } catch (e) {
    console.error('[Profile] Parse failed:', e);
    return null;
  }
}

/**
 * 获取缓存的个人资料
 */
export function getCachedProfile(): UserProfile | null {
  try {
    const raw = uni.getStorageSync(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - (cached.timestamp || 0) > PROFILE_CACHE_TTL) {
      return null;
    }
    return cached.profile || null;
  } catch {
    return null;
  }
}

/**
 * 缓存个人资料
 */
export function cacheProfile(profile: UserProfile): void {
  try {
    uni.setStorageSync(PROFILE_CACHE_KEY, JSON.stringify({
      profile,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.error('[Profile] Cache failed:', e);
  }
}

/**
 * 获取个人资料（优先缓存，否则从服务器获取）
 */
export async function fetchProfile(username: string, password: string): Promise<UserProfile | null> {
  // 先尝试缓存
  const cached = getCachedProfile();
  if (cached && cached.avatarLocalPath) return cached;

  try {
    const { getCrawler } = await import('@/utils/session');
    const crawler = await getCrawler(username, password);
    const html = await crawler.fetchProfileHtml();
    
    let baseUrl = 'http://jwxt.sias.edu.cn/eams';
    // #ifdef H5
    baseUrl = '/eams';
    // #endif

    const profile = parseProfileHtml(html, baseUrl);
    if (!profile) return null;

    // 下载头像到本地临时文件
    try {
      const localPath = await crawler.downloadAvatar(profile.studentId || username);
      if (localPath) {
        // 保存到持久目录
        const savedPath = await saveAvatarToLocal(localPath);
        profile.avatarLocalPath = savedPath || localPath;
      }
    } catch (e) {
      console.warn('[Profile] Avatar download failed, using fallback:', e);
    }

    cacheProfile(profile);
    return profile;
  } catch (e) {
    console.error('[Profile] Fetch failed:', e);
    return null;
  }
}

/**
 * 将临时头像文件保存到持久本地目录
 * APP-PLUS 使用 uni.saveFile，其他平台直接用临时路径
 */
function saveAvatarToLocal(tempPath: string): Promise<string> {
  return new Promise((resolve) => {
    uni.saveFile({
      tempFilePath: tempPath,
      success: (res) => {
        resolve(res.savedFilePath);
      },
      fail: () => {
        resolve(tempPath);
      }
    });
  });
}
