/**
 * 西亚斯课表爬虫 (TypeScript 版 — 从 crawler.py 逐行平移)
 *
 * 逻辑：
 * 1. 强制自动探测用户 ID
 * 2. 强制自动探测学期 ID
 *
 * 使用 uni.request + 手动 Cookie 管理 替代 Python requests.Session
 * 使用 crypto-js SHA1 替代 Python hashlib.sha1
 */

import CryptoJS from 'crypto-js';
import type { Course } from '@/types';

// ============================================================
// Cookie 管理工具 —— 模拟 requests.Session 的自动 Cookie 保持
// ============================================================

class CookieJar {
  private cookies: Record<string, string> = {};

  /** 从 Set-Cookie 响应头解析并存储 cookie */
  update(setCookieHeaders: string | string[] | undefined): void {
    if (!setCookieHeaders) return;
    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (const header of headers) {
      // 每条 Set-Cookie 形如: "JSESSIONID=abc123; Path=/; HttpOnly"
      const parts = header.split(';');
      if (parts.length > 0) {
        const kv = parts[0].trim();
        const eqIdx = kv.indexOf('=');
        if (eqIdx > 0) {
          const key = kv.substring(0, eqIdx).trim();
          const val = kv.substring(eqIdx + 1).trim();
          this.cookies[key] = val;
        }
      }
    }
  }

  /** 生成 Cookie 请求头字符串 */
  toString(): string {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  clear(): void {
    this.cookies = {};
  }
}

// ============================================================
// 封装 uni.request 为 Promise
// ============================================================

interface RequestResult {
  /** 响应文本 */
  text: string;
  /** 最终 URL（跟随 302 后的落地页 URL） */
  url: string;
  /** 原始响应头 */
  header: Record<string, string>;
}

// #ifdef H5
/**
 * H5 模式 —— 使用原生 fetch() API
 *
 * 为什么不用 uni.request？
 * 1. uni.request 底层用 XMLHttpRequest，浏览器禁止手动设置 Cookie / Referer / User-Agent
 * 2. XMLHttpRequest.getResponseHeader('Set-Cookie') 被规范禁止，拿不到服务端 cookie
 * 3. XMLHttpRequest 没有 response.url，无法获取 302 跳转后的最终 URL
 *
 * fetch() 解决了以上所有问题：
 * - credentials: 'include' 让浏览器自动管理 cookie（通过 Vite proxy 互通）
 * - response.url 返回最终落地 URL（等同 Python requests 的 res.url）
 * - response.text() 获取完整响应文本
 */
function uniRequest(
  url: string,
  options: {
    method?: 'GET' | 'POST';
    header?: Record<string, string>;
    data?: string | Record<string, string>;
    cookieJar: CookieJar;
    timeout?: number;
  }
): Promise<RequestResult> {
  const { method = 'GET', header = {}, data, timeout = 15000 } = options;

  // H5 模式下不设置禁止头（User-Agent / Referer / Cookie），由浏览器 + proxy 处理
  const cleanHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(header)) {
    const lower = k.toLowerCase();
    if (lower === 'cookie' || lower === 'user-agent' || lower === 'referer') continue;
    cleanHeaders[k] = v;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const fetchOptions: RequestInit = {
    method,
    headers: cleanHeaders,
    credentials: 'include',    // ★ 让浏览器自动携带/保存 cookie
    signal: controller.signal,
    redirect: 'follow',        // 自动跟随 302，response.url 为最终 URL
  };

  if (data) {
    fetchOptions.body = typeof data === 'string' ? data : JSON.stringify(data);
  }

  return fetch(url, fetchOptions)
    .then(async (response) => {
      clearTimeout(timer);
      const text = await response.text();
      return {
        text,
        url: response.url,     // ★ 最终 URL（等同 Python res.url）
        header: Object.fromEntries(response.headers.entries())
      };
    })
    .catch((err) => {
      clearTimeout(timer);
      throw new Error(err?.message || '网络请求失败');
    });
}
// #endif

// #ifndef H5
/**
 * App 原生模式 —— 使用 uni.request，依赖原生 Cookie 管理
 *
 * ★ 重要：HBuilderX 3.6.7+ 的 uni.request 会自动在请求间保持 Cookie。
 *   登录 POST → 302 重定向时，服务器在 302 响应中设置新 JSESSIONID，
 *   原生 HTTP 客户端（Android OkHttp / iOS NSURLSession）会自动保存并在后续请求中携带。
 *
 *   如果我们手动注入 Cookie 头，会**覆盖**原生客户端保存的正确 Cookie，
 *   导致后续请求使用失效的旧 session → 服务器认为未登录。
 *
 *   因此 App 模式下 **不手动管理 Cookie**，完全交给原生平台处理。
 */
function uniRequest(
  url: string,
  options: {
    method?: 'GET' | 'POST';
    header?: Record<string, string>;
    data?: string | Record<string, string>;
    cookieJar: CookieJar;
    timeout?: number;
  }
): Promise<RequestResult> {
  return new Promise((resolve, reject) => {
    const { method = 'GET', header = {}, data, timeout = 15000 } = options;

    // ★ 不设置 Cookie 头 —— 让原生平台自动管理 Cookie
    // 移除 header 中可能残留的 Cookie 字段，避免覆盖原生 Cookie
    const cleanHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(header)) {
      if (k.toLowerCase() !== 'cookie') {
        cleanHeaders[k] = v;
      }
    }

    uni.request({
      url,
      method,
      header: cleanHeaders,
      data,
      timeout,
      dataType: 'text',
      sslVerify: false,
      success: (res) => {
        const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        console.log(`[App request] ${method} ${url.split('/eams')[1] || url} → ${text.length} bytes, status: ${res.statusCode}`);

        resolve({
          text,
          url,  // uni.request 不暴露最终 redirect URL
          header: res.header || {}
        });
      },
      fail: (err) => {
        console.error(`[App request] FAIL ${method} ${url}:`, err.errMsg);
        reject(new Error(err.errMsg || '网络请求失败'));
      }
    });
  });
}
// #endif

/**
 * 针对 POST 表单提交，将对象编码为 application/x-www-form-urlencoded
 */
function encodeFormData(data: Record<string, string>): string {
  return Object.entries(data)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/** 等待指定毫秒数 —— 防触发教务系统 "请不要过快点击" 频率限制 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 检测响应是否为"请不要过快点击"限流页面 */
function isRateLimited(text: string): boolean {
  return text.includes('请不要过快点击');
}

/**
 * 带限流重试的请求 —— 遇到 "请不要过快点击" 自动等待后重试
 */
async function requestWithRetry(
  url: string,
  options: {
    method?: 'GET' | 'POST';
    header?: Record<string, string>;
    data?: string | Record<string, string>;
    cookieJar: CookieJar;
    timeout?: number;
  },
  maxRetries = 3,
  retryDelay = 2000
): Promise<RequestResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await uniRequest(url, options);
    if (!isRateLimited(res.text)) return res;
    console.log(`[request] Rate limited (attempt ${attempt}/${maxRetries}), waiting ${retryDelay}ms...`);
    if (attempt < maxRetries) await sleep(retryDelay);
  }
  // 最后一次也被限流，仍然返回（由调用者处理）
  return uniRequest(url, options);
}

// ============================================================
// SiasCrawler 主类
// ============================================================

// 教务系统真实地址（拼接内部跳转链接时使用）
const ORIGIN_URL = 'https://jwxt.sias.edu.cn';

/**
 * 获取 baseUrl：
 * - H5 开发模式走 Vite 代理 (/eams)，避免浏览器 CORS 拦截
 * - 原生 App 直连教务系统
 */
function getBaseUrl(): string {
  // #ifdef H5
  return '/eams';
  // #endif
  // #ifndef H5
  return `${ORIGIN_URL}/eams`;
  // #endif
}

export class SiasCrawler {
  private username: string;
  private password: string;
  private cookieJar: CookieJar;
  private baseUrl: string;
  private headers: Record<string, string>;
  private userId: string | null = null;
  /** 【关键】初始为 null，强制从网页抓取 */
  private currentSemesterId: string | null = null;

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
    this.cookieJar = new CookieJar();
    this.baseUrl = getBaseUrl();
    // H5 模式下 User-Agent 和 Referer 是浏览器禁止修改的 unsafe header，
    // 强行设置会被浏览器忽略并在 Console 报 "Refused to set unsafe header"。
    // App 原生模式下可以正常设置。
    // #ifdef H5
    this.headers = {};
    // #endif
    // #ifndef H5
    this.headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': `${this.baseUrl}/login.action`
    };
    // #endif
  }

  // ----------------------------------------------------------
  // login()  —— 对应 Python crawler.login()
  // 对应 Python 原版的 try/except: return False
  // ----------------------------------------------------------
  async login(): Promise<boolean> {
    try {
      // 1. GET /login.action，获取 salt 并建立会话 Cookie
      const resp = await requestWithRetry(`${this.baseUrl}/login.action`, {
        method: 'GET',
        header: { ...this.headers },
        cookieJar: this.cookieJar,
        timeout: 10000
      });

      const saltMatch = resp.text.match(/CryptoJS\.SHA1\('([^']+)'/);
      if (!saltMatch) {
        console.log('[login] No salt found, checking if already logged in...');
        return !isRateLimited(resp.text) && !resp.text.includes('CryptoJS.SHA1');
      }

      const salt = saltMatch[1];
      const encPwd = CryptoJS.SHA1(salt + this.password).toString();

      // ★ 防限流：GET 取盐后等一下再 POST
      await sleep(1500);

      // 2. POST /loginExt.action
      const formData: Record<string, string> = {
        username: this.username,
        password: encPwd,
        session_locale: 'zh_CN'
      };

      const loginRes = await requestWithRetry(`${this.baseUrl}/loginExt.action`, {
        method: 'POST',
        header: {
          ...this.headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: encodeFormData(formData),
        cookieJar: this.cookieJar,
        timeout: 10000
      });

      // 3. 验证登录状态
      const text = loginRes.text;
      const hasSalt = !!text.match(/CryptoJS\.SHA1\('/);
      console.log('[login] POST len:', text.length, 'hasSalt:', hasSalt);

      if (isRateLimited(text)) {
        console.log('[login] ✗ Rate limited even after retries');
        return false;
      }
      if (hasSalt) {
        console.log('[login] ✗ Still on login page → wrong credentials');
        return false;
      }
      console.log('[login] ✓ Login success');
      return true;
    } catch (e: unknown) {
      console.error('[login] Exception:', e instanceof Error ? e.message : e);
      return false;
    }
  }

  // ----------------------------------------------------------
  // autoDetect()  —— 对应 Python crawler.auto_detect()
  // ----------------------------------------------------------
  async autoDetect(): Promise<boolean> {
    try {
      // ★ 防限流：login 完成后等一下再开始探测
      await sleep(1500);

      // 1. 访问课表外壳页
      const urlShell = `${this.baseUrl}/courseTableForStd.action`;
      const headersShell = {
        ...this.headers,
        'Referer': `${this.baseUrl}/homeExt.action`
      };

      console.log('[autoDetect] Step1: GET courseTableForStd');
      const resShell = await requestWithRetry(urlShell, {
        method: 'GET',
        header: headersShell,
        cookieJar: this.cookieJar,
        timeout: 10000
      });
      console.log('[autoDetect] Shell len:', resShell.text.length, 'rateLimited:', isRateLimited(resShell.text));

      // 2. 提取跳转链接 bg.Go(...)
      const match = resShell.text.match(/bg\.Go\('([^']+)'/);
      console.log('[autoDetect] bg.Go match:', match ? match[1] : 'NOT FOUND');

      if (match) {
        let innerUrl = match[1];
        if (innerUrl.startsWith('/eams')) {
          // #ifndef H5
          innerUrl = ORIGIN_URL + innerUrl;
          // #endif
        } else {
          innerUrl = `${this.baseUrl}/${innerUrl}`;
        }

        await sleep(1000);

        // 3. 访问内部页
        console.log('[autoDetect] Step2: GET inner page', innerUrl);
        const headInner = {
          ...this.headers,
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': urlShell
        };
        const resInner = await requestWithRetry(innerUrl, {
          method: 'GET',
          header: headInner,
          cookieJar: this.cookieJar,
          timeout: 10000
        });
        console.log('[autoDetect] Inner len:', resInner.text.length);

        // 4. 提取信息 (ID 和 学期)
        this.scanHtmlForInfo(resInner.text);
        console.log('[autoDetect] After scan → userId:', this.userId, 'semesterId:', this.currentSemesterId);
      }

      // 5. 如果未找到，尝试学籍页
      if (!this.userId) {
        await sleep(1500);

        const urlDetail = `${this.baseUrl}/stdDetail.action`;
        console.log('[autoDetect] Step3: fallback GET stdDetail');
        const resDetail = await requestWithRetry(urlDetail, {
          method: 'GET',
          header: { ...this.headers },
          cookieJar: this.cookieJar,
          timeout: 10000
        });
        console.log('[autoDetect] Detail len:', resDetail.text.length);

        const matchDetail = resDetail.text.match(/bg\.Go\('([^']+)'/);
        console.log('[autoDetect] Detail bg.Go match:', matchDetail ? matchDetail[1] : 'NOT FOUND');

        if (matchDetail) {
          let innerDetail = matchDetail[1];
          if (innerDetail.startsWith('/eams')) {
            // #ifndef H5
            innerDetail = ORIGIN_URL + innerDetail;
            // #endif
          } else {
            innerDetail = `${this.baseUrl}/${innerDetail}`;
          }

          await sleep(1000);

          console.log('[autoDetect] Step4: GET detail inner', innerDetail);
          const headInner = {
            ...this.headers,
            'X-Requested-With': 'XMLHttpRequest'
          };
          const resInnerDetail = await requestWithRetry(innerDetail, {
            method: 'GET',
            header: headInner,
            cookieJar: this.cookieJar,
            timeout: 10000
          });

          this.scanHtmlForInfo(resInnerDetail.text);
          console.log('[autoDetect] After detail scan → userId:', this.userId, 'semesterId:', this.currentSemesterId);
        }
      }

      console.log('[autoDetect] Final → userId:', this.userId, 'semesterId:', this.currentSemesterId);
      return this.userId !== null;
    } catch (e: unknown) {
      console.error('[autoDetect] Exception:', e instanceof Error ? e.message : e);
      return false;
    }
  }

  // ----------------------------------------------------------
  // scanHtmlForInfo()  —— 对应 Python crawler.scan_html_for_info()
  // ----------------------------------------------------------
  private scanHtmlForInfo(html: string): void {
    // 1. 扫描用户 ID
    // 对应 Python 完全相同的 5 个正则 pattern
    if (!this.userId) {
      const patterns: RegExp[] = [
        /name="ids"\s+value="(\d+)"/,
        /ids=(\d+)/,
        /bg\.form\.addInput\(form,\s*"ids",\s*"(\d+)"\)/,
        /value="(\d+)"\s+name="ids"/,
        /name="student\.id"\s+value="(\d+)"/
      ];
      for (const p of patterns) {
        const m = html.match(p);
        if (m) {
          this.userId = m[1];
          break;
        }
      }
    }

    // 2. 扫描学期 ID (务必抓取!)
    // 对应 Python 完全相同的 4 个正则 pattern
    if (!this.currentSemesterId) {
      const semPatterns: RegExp[] = [
        /semester\.id=(\d+)/,
        /name="semester\.id"\s+value="(\d+)"/,
        /bg\.form\.addInput\(form,\s*"semester\.id",\s*"(\d+)"\)/,
        /value:"(\d+)"/  // 匹配 JS 对象写法，如 value:"262"
      ];
      for (const p of semPatterns) {
        const m = html.match(p);
        if (m) {
          // 对应 Python: 简单过滤：学期ID通常是2-3位数字
          const val = m[1];
          if (val.length >= 2) {
            this.currentSemesterId = val;
            break;
          }
        }
      }
    }
  }

  // ----------------------------------------------------------
  // getData()  —— 对应 Python crawler.get_data()
  // ----------------------------------------------------------
  async getData(): Promise<Course[]> {
    if (!this.userId) throw new Error('ID_NOT_FOUND');
    if (!this.currentSemesterId) throw new Error('SEMESTER_NOT_FOUND');

    // ★ 防限流
    await sleep(1500);

    const postData: Record<string, string> = {
      'ignoreHead': '1',
      'setting.kind': 'std',
      'startWeek': '',
      'project.id': '1',
      'semester.id': this.currentSemesterId,
      'ids': this.userId
    };

    const head = {
      ...this.headers,
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    console.log('[getData] POST courseTable, userId:', this.userId, 'semesterId:', this.currentSemesterId);
    const res = await requestWithRetry(
      `${this.baseUrl}/courseTableForStd!courseTable.action`,
      {
        method: 'POST',
        header: head,
        data: encodeFormData(postData),
        cookieJar: this.cookieJar,
        timeout: 15000
      }
    );

    if (isRateLimited(res.text)) {
      throw new Error('RATE_LIMITED');
    }

    return this.parse(res.text);
  }

  // ----------------------------------------------------------
  // parse()  —— 对应 Python crawler.parse()
  // ----------------------------------------------------------
  private parse(html: string): Course[] {
    const courses: Course[] = [];
    // 对应 Python: chunks = html.split("var teachers =")
    const chunks = html.split('var teachers =');

    for (let i = 0; i < chunks.length; i++) {
      // 对应 Python: if i == 0: continue
      if (i === 0) continue;

      const chunk = chunks[i];

      // --- 提取教师名 ---
      // 对应 Python: t_name = "未知"
      let tName = '未知';
      // 对应 Python: re.findall(r'name\s*:\s*["\']([^"\']+)["\']', chunk)
      const namesFound = [...chunk.matchAll(/name\s*:\s*["']([^"']+)["']/g)];
      if (namesFound.length > 0) {
        for (const nameMatch of namesFound) {
          // 对应 Python: if name.strip():
          if (nameMatch[1].trim()) {
            tName = nameMatch[1];
            break;
          }
        }
      }

      // --- 提取 TaskActivity ---
      // 对应 Python: re.search(r'new TaskActivity\((.*?)\);', chunk, re.DOTALL)
      const task = chunk.match(/new TaskActivity\(([\s\S]*?)\);/);
      if (!task) continue;

      // 对应 Python: re.findall(r'"([^"]*)"', task.group(1))
      const args = [...task[1].matchAll(/"([^"]*)"/g)].map(m => m[1]);

      // 对应 Python: if len(args) >= 8:
      if (args.length >= 8) {
        courses.push({
          name: args[2],    // 课程名称
          teacher: tName,   // 教师姓名
          room: args[6],    // 教室
          day: args[1],     // 星期几
          nodes: args[0],   // 节次
          weeks: args[7]    // 周次二进制字符串
        });
      }
    }

    return courses;
  }

  /** 清理 Cookie（可供外部调用重置会话） */
  reset(): void {
    this.cookieJar.clear();
    this.userId = null;
    this.currentSemesterId = null;
  }
}

// ============================================================
// 对外暴露的高层 API —— 对应 Python main() 的流程
// ============================================================

/**
 * 执行完整的课表抓取流程
 * @param username 学号
 * @param password 密码
 * @returns 课程列表
 * @throws Error 登录失败 / 探测失败 / 获取数据失败
 */
export async function fetchSchedule(username: string, password: string): Promise<Course[]> {
  const crawler = new SiasCrawler(username, password);

  // 对应 Python main(): crawler.login()
  const loginOk = await crawler.login();
  if (!loginOk) {
    throw new Error('LOGIN_FAILED');
  }

  // 对应 Python main(): crawler.auto_detect()
  const detectOk = await crawler.autoDetect();
  if (!detectOk) {
    throw new Error('DETECT_FAILED');
  }

  // 对应 Python main(): crawler.get_data()
  return await crawler.getData();
}

/**
 * 翻译爬虫错误码为用户友好消息
 */
export function translateError(error: string): string {
  switch (error) {
    case 'LOGIN_FAILED':
      return '登录失败，请检查学号和密码';
    case 'DETECT_FAILED':
      return '获取用户信息失败，请稍后重试';
    case 'ID_NOT_FOUND':
      return '未找到用户ID，请稍后重试';
    case 'SEMESTER_NOT_FOUND':
      return '未找到学期信息，请稍后重试';
    case 'RATE_LIMITED':
      return '教务系统请求过于频繁，请稍后再试';
    default:
      return `未知错误: ${error}`;
  }
}
