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
import type { ProgressCallback } from '@/types/progress';
import type { ExamBatch } from '@/types/exam';

// ============================================================
// Cookie 管理工具 —— 模拟 requests.Session 的自动 Cookie 保持
// ============================================================

class CookieJar {
  private cookies: Record<string, string> = {};
  private _disabled = false;

  /** 从 Set-Cookie 响应头解析并存储 cookie */
  update(setCookieHeaders: string | string[] | undefined): void {
    if (this._disabled || !setCookieHeaders) return;
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
    if (this._disabled) return '';
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  clear(): void {
    this.cookies = {};
  }

  /** 永久禁用：清空所有 cookie，且后续 update/toString 均为空操作 */
  disable(): void {
    this.cookies = {};
    this._disabled = true;
  }

  /** 是否已禁用 */
  isDisabled(): boolean {
    return this._disabled;
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

/**
 * App 原生模式 —— 使用 uni.request + 手动 CookieJar 管理
 *
 * ★ 原生平台的自动 Cookie 管理在部分运行时版本/设备上不可靠，
 *   实测 GET /login.action 设置的 JSESSIONID 未被自动带入 POST，
 *   导致服务器返回 "验证码不正确"（即 session 校验失败）。
 *
 *   因此改为完全手动管理 Cookie（等同 Python requests.Session）：
 *   - 每次响应：解析 Set-Cookie 并写入 CookieJar
 *   - 每次请求：从 CookieJar 读取 Cookie 并注入请求头
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
    const { method = 'GET', header = {}, data, cookieJar, timeout = 15000 } = options;

    // ★ App 原生模式不手动注入 Cookie 头 —— 完全交给原生 HTTP 客户端（OkHttp / NSURLSession）自动管理。
    // 登录前通过 GET /logout.action 清除旧 session，确保原生客户端 cookie 干净。
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
        // ★ 从响应中解析 Set-Cookie → 更新 CookieJar
        // uni.request 返回头的 key 大小写不一致（Set-Cookie / set-cookie / SET-COOKIE...），
        // 必须做大小写无关匹配
        let rawSetCookie: string | string[] | undefined;
        for (const key of Object.keys(res.header || {})) {
          if (key.toLowerCase() === 'set-cookie') {
            rawSetCookie = (res.header as Record<string, string | string[]>)[key];
            break;
          }
        }
        if (rawSetCookie) {
          // 有些运行时用逗号拼接多条，有些用数组，有些只返回一条
          let cookies: string[];
          if (Array.isArray(rawSetCookie)) {
            cookies = rawSetCookie;
          } else if (typeof rawSetCookie === 'string') {
            // 按逗号分割，但避免拆开 "expires=Thu, 01 Jan 2099..."
            cookies = rawSetCookie.split(/,\s*(?=[A-Za-z_][A-Za-z0-9_]*=)/)
          } else {
            cookies = [String(rawSetCookie)];
          }
          cookieJar.update(cookies);
        }

        const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);

        resolve({
          text,
          url,  // uni.request 不暴露最终 redirect URL
          header: res.header || {}
        });
      },
      fail: (err) => {
        console.error(`[App request] FAIL ${method} ${url}:`, err.errMsg);
        reject(new Error('NETWORK_ERROR'));
      }
    });
  });
}

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
  return `${ORIGIN_URL}/eams`;
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
  /** 所有学期列表 */
  private allSemesters: Array<{id: number, schoolYear: string, name: string}> = [];

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
    this.cookieJar = new CookieJar();
    this.baseUrl = getBaseUrl();
    // H5 模式下 User-Agent 和 Referer 是浏览器禁止修改的 unsafe header，
    // 强行设置会被浏览器忽略并在 Console 报 "Refused to set unsafe header"。
    // App 原生模式下可以正常设置。
    this.headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': `${this.baseUrl}/login.action`
    };
  }

  // ----------------------------------------------------------
  // login()  —— 对应 Python crawler.login()
  // 对应 Python 原版的 try/except: return False
  // ----------------------------------------------------------
  async login(): Promise<boolean> {
    try {
      // 0. ★ 先注销旧 session，确保原生 HTTP 客户端的 cookie 是干净的
      //    解决切换账号时 OkHttp 残留旧 JSESSIONID 导致登录失败的问题
      try {
        await uniRequest(`${this.baseUrl}/logout.action`, {
          method: 'GET',
          header: { ...this.headers },
          cookieJar: this.cookieJar,
          timeout: 5000
        });
        console.log('[login] Pre-logout completed');
      } catch (e: unknown) {
        // 如果是网络连接超时/不可达，不仅是登出会失败，后续也必败。应该尽早抛出并交由外层处理为 NETWORK_ERROR
        if (e instanceof Error && e.message === 'NETWORK_ERROR') throw e;
        // 忽略其他报错（可能本来就没有 session 等软错误）
        console.log('[login] Pre-logout failed (ignored)');
      }
      await sleep(500);

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

      // ★ 防限流：GET 取盐后等一下再 POST（requestWithRetry 兜底）
      await sleep(300);

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
      if (e instanceof Error && e.message === 'NETWORK_ERROR') throw e;
      console.error('[login] Exception:', e instanceof Error ? e.message : e);
      return false;
    }
  }

  // ----------------------------------------------------------
  // autoDetect()  —— 直达 innerIndex，精确正则提取 ids + semester.id
  // ----------------------------------------------------------
  async autoDetect(): Promise<boolean> {
    try {
      // ★ 防限流：login 完成后等一下再开始探测（requestWithRetry 兜底）
      await sleep(500);

      // ★ 一步到位：直接请求 innerIndex（跳过外壳页）
      // 实测验证：直接请求与先走外壳页结果完全一致
      const html = await this.fetchInnerIndex(1);
      this.extractIds(html);
      this.extractSemesterId(html);

      // ★ 降级路径：projectId=1 失败时尝试 projectId=62（实验班等特殊项目）
      if (!this.userId) {
        console.log('[autoDetect] projectId=1 failed, trying projectId=62');
        await sleep(1000);
        const html62 = await this.fetchInnerIndex(62);
        this.extractIds(html62);
        if (!this.currentSemesterId) {
          this.extractSemesterId(html62);
        }
      }

      // ★ 校正：服务端会按学号记住最后查看的学期（数据库级），
      //   历史查询后再登录会拿到旧学期。通过日期推算覆盖。
      await this.correctCurrentSemester();

      console.log('[autoDetect] Final → userId:', this.userId, 'semesterId:', this.currentSemesterId);
      return this.userId !== null && this.currentSemesterId !== null;
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'NETWORK_ERROR') throw e;
      console.error('[autoDetect] Exception:', e instanceof Error ? e.message : e);
      return false;
    }
  }

  /**
   * 通过学期列表 + 当前日期 校正 currentSemesterId
   *
   * 规则：
   *   9月 ~ 次年1月  → 第1学期（学年起始年 = 当年/去年）
   *   2月 ~ 8月      → 第2学期（学年起始年 = 去年）
   *
   * 例：2026-03-25 → 2025-2026 学期2
   */
  private async correctCurrentSemester(): Promise<void> {
    try {
      await sleep(500);
      const ok = await this.fetchSemesters();
      if (!ok || this.allSemesters.length === 0) return;

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1; // 1-12

      let startYear: number;
      let termName: string;

      if (month >= 9) {
        // 9-12月：本学年第1学期
        startYear = year;
        termName = '1';
      } else if (month >= 2) {
        // 2-8月：上学年第2学期
        startYear = year - 1;
        termName = '2';
      } else {
        // 1月：上学年第1学期（考试/寒假尾声）
        startYear = year - 1;
        termName = '1';
      }

      // schoolYear 格式如 "2025-2026"，parseInt 取首段年份
      const match = this.allSemesters.find(s => {
        const syYear = parseInt(s.schoolYear, 10);
        return syYear === startYear && String(s.name) === termName;
      });

      if (match) {
        if (String(match.id) !== this.currentSemesterId) {
          console.log('[autoDetect] Correcting semester:', this.currentSemesterId, '→', match.id,
            `(${match.schoolYear} 学期${match.name})`);
          this.currentSemesterId = String(match.id);
        }
      } else {
        console.warn('[autoDetect] No semester match for', startYear, 'term', termName);
      }
    } catch {
      console.warn('[autoDetect] Could not correct semester, using detected value');
    }
  }

  /**
   * 请求 innerIndex 页面
   * @param projectId 项目ID（默认1，实验班可能为62）
   */
  private async fetchInnerIndex(projectId: number): Promise<string> {
    const url = `${this.baseUrl}/courseTableForStd!innerIndex.action?projectId=${projectId}`;
    const res = await requestWithRetry(url, {
      method: 'GET',
      header: {
        ...this.headers,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `${this.baseUrl}/courseTableForStd.action`
      },
      cookieJar: this.cookieJar,
      timeout: 10000
    });

    return res.text;
  }

  /**
   * 从 innerIndex HTML 中提取用户 ids
   * 精确匹配 bg.form.addInput，备选宽松正则兜底
   */
  private extractIds(html: string): void {
    if (this.userId) return;

    // ★ 精确匹配：bg.form.addInput(form, "ids", "188831")
    const precise = html.match(/bg\.form\.addInput\(form,\s*"ids",\s*"(\d+)"\)/);
    if (precise) {
      this.userId = precise[1];
      console.log('[autoDetect] ✓ ids (precise):', this.userId);
      return;
    }

    // ★ 备选：宽松匹配，应对教务系统改版
    const fallback = html.match(/["']ids["'][,\s]*["'](\d+)["']/);
    if (fallback) {
      this.userId = fallback[1];
      console.log('[autoDetect] ✓ ids (fallback):', this.userId);
      return;
    }

    console.error('[autoDetect] ✗ ids not found');
  }

  /**
   * 从 innerIndex HTML 中提取 semester.id
   * 锚定 semesterCalendar 上下文，避免误匹配
   */
  private extractSemesterId(html: string): void {
    if (this.currentSemesterId) return;

    // ★ 精确匹配：semesterCalendar({...value:"282"...})
    const precise = html.match(/semesterCalendar\(\{[^}]*value:"(\d+)"/);
    if (precise) {
      this.currentSemesterId = precise[1];
      console.log('[autoDetect] ✓ semester.id (precise):', this.currentSemesterId);
      return;
    }

    // ★ 备选：semester.id=xxx 形式
    const fallback = html.match(/semester\.id=(\d{2,})/);
    if (fallback) {
      this.currentSemesterId = fallback[1];
      console.log('[autoDetect] ✓ semester.id (fallback):', this.currentSemesterId);
      return;
    }

    console.error('[autoDetect] ✗ semester.id not found');
  }

  // ----------------------------------------------------------
  // getData()  —— 对应 Python crawler.get_data()
  // ----------------------------------------------------------
  async getData(semesterId?: string): Promise<Course[]> {
    if (!this.userId) throw new Error('ID_NOT_FOUND');
    const semId = semesterId || this.currentSemesterId;
    if (!semId) throw new Error('SEMESTER_NOT_FOUND');

    // ★ 防限流（requestWithRetry 兜底）
    await sleep(500);

    const postData: Record<string, string> = {
      'ignoreHead': '1',
      'setting.kind': 'std',
      'startWeek': '',
      'project.id': '1',
      'semester.id': semId,
      'ids': this.userId
    };

    const head = {
      ...this.headers,
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded'
    };

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

    // ★ session 失效检测
    this.checkSessionAlive(res.text);

    const parsed = this.parse(res.text);
    console.log('[getData] Parsed courses:', parsed.length);
    return parsed;
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

  /**
   * 获取成绩页面 HTML
   * @param semesterId 学期ID
   * @returns HTML 响应文本（由 grade.ts 的 parseGrades 解析）
   */
  async fetchGradeHtml(semesterId: number): Promise<string> {
    await sleep(500);

    const postData: Record<string, string> = {
      semesterId: String(semesterId),
      projectType: '',
      _: String(Date.now())
    };

    const res = await requestWithRetry(
      `${this.baseUrl}/teach/grade/course/person!search.action`,
      {
        method: 'POST',
        header: {
          ...this.headers,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: encodeFormData(postData),
        cookieJar: this.cookieJar,
        timeout: 15000
      }
    );

    if (isRateLimited(res.text)) {
      throw new Error('RATE_LIMITED');
    }

    // ★ session 失效检测
    this.checkSessionAlive(res.text);

    return res.text;
  }

  /**
   * 获取平均成绩排名页面 HTML
   * 先访问 innerIndex 触发页面初始化，再请求 search 获取数据表格
   */
  async fetchGradeAvgHtml(): Promise<string> {
    await sleep(500);

    // 1) 触发 innerIndex（必需，否则 search 可能返回空）
    await requestWithRetry(
      `${this.baseUrl}/teach/grade/course/student-find-ga!innerIndex.action?projectId=1`,
      {
        method: 'GET',
        header: {
          ...this.headers,
          'X-Requested-With': 'XMLHttpRequest'
        },
        cookieJar: this.cookieJar,
        timeout: 15000
      }
    );

    await sleep(300);

    // 2) 请求 search 获取实际数据
    const res = await requestWithRetry(
      `${this.baseUrl}/teach/grade/course/student-find-ga!search.action`,
      {
        method: 'POST',
        header: {
          ...this.headers,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        cookieJar: this.cookieJar,
        timeout: 15000
      }
    );

    if (isRateLimited(res.text)) {
      throw new Error('RATE_LIMITED');
    }

    this.checkSessionAlive(res.text);

    return res.text;
  }

  /**
   * 获取指定学期的所有考试批次列表
   * POST innerIndex，解析 <select name="examBatch.id"> 中所有 <option>
   * @param semesterId 可选学期ID，不传则查当前学期
   */
  async fetchExamBatches(semesterId?: number): Promise<ExamBatch[]> {
    await sleep(500);

    const postData: Record<string, string> = { 'project.id': '1' };
    if (semesterId) {
      postData['semester.id'] = String(semesterId);
    }

    const indexRes = await requestWithRetry(
      `${this.baseUrl}/stdExamTable!innerIndex.action`,
      {
        method: 'POST',
        header: {
          ...this.headers,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: encodeFormData(postData),
        cookieJar: this.cookieJar,
        timeout: 15000
      }
    );

    if (isRateLimited(indexRes.text)) {
      throw new Error('RATE_LIMITED');
    }
    this.checkSessionAlive(indexRes.text);

    // 解析所有 <option value="xxx">yyy</option>
    const batches: ExamBatch[] = [];
    const optionRegex = /<option\s+value="(\d+)"[^>]*>([^<]+)<\/option>/g;
    for (let m = optionRegex.exec(indexRes.text); m !== null; m = optionRegex.exec(indexRes.text)) {
      batches.push({ id: Number(m[1]), name: m[2].trim() });
    }

    console.log('[fetchExamBatches] Found', batches.length, 'batches:', batches.map(b => `${b.id}(${b.name})`).join(', '));
    return batches;
  }

  /**
   * 获取指定考试批次的考试安排 HTML
   * @param batchId 考试批次ID（从 fetchExamBatches 获取）
   */
  async fetchExamTableHtml(batchId: number): Promise<string> {
    await sleep(300);

    const res = await requestWithRetry(
      `${this.baseUrl}/stdExamTable!examTable.action`,
      {
        method: 'POST',
        header: {
          ...this.headers,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: encodeFormData({ 'examBatch.id': String(batchId), '_': String(Date.now()) }),
        cookieJar: this.cookieJar,
        timeout: 15000
      }
    );

    if (isRateLimited(res.text)) {
      throw new Error('RATE_LIMITED');
    }
    this.checkSessionAlive(res.text);

    return res.text;
  }

  /**
   * 获取校历页面 HTML
   * POST schoolCalendar!search.action 获取指定学期的校历数据
   * @param semesterId 可选学期ID，不传则用当前学期
   */
  async fetchSchoolCalendarHtml(semesterId?: number): Promise<string> {
    await sleep(500);

    const semId = semesterId ? String(semesterId) : (this.currentSemesterId || '');
    const res = await requestWithRetry(
      `${this.baseUrl}/schoolCalendar!search.action`,
      {
        method: 'POST',
        header: {
          ...this.headers,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: encodeFormData({ 'semester.id': semId }),
        cookieJar: this.cookieJar,
        timeout: 15000
      }
    );

    if (isRateLimited(res.text)) {
      throw new Error('RATE_LIMITED');
    }
    this.checkSessionAlive(res.text);

    return res.text;
  }

  /**
   * 获取个人资料页面 HTML
   * GET homeExt!main.action 获取包含姓名、头像等信息的首页
   */
  async fetchProfileHtml(): Promise<string> {
    await sleep(300);

    const res = await requestWithRetry(
      `${this.baseUrl}/homeExt!main.action`,
      {
        method: 'GET',
        header: {
          ...this.headers,
          'X-Requested-With': 'XMLHttpRequest'
        },
        cookieJar: this.cookieJar,
        timeout: 15000
      }
    );

    if (isRateLimited(res.text)) {
      throw new Error('RATE_LIMITED');
    }
    this.checkSessionAlive(res.text);

    return res.text;
  }

  /**
   * 下载头像图片到本地临时文件
   * GET showSelfAvatar.action?user.name=学号
   * 返回本地临时文件路径，可直接用于 <image :src="">
   */
  async downloadAvatar(studentId: string): Promise<string> {
    const url = `${this.baseUrl}/showSelfAvatar.action?user.name=${studentId}`;

    return new Promise((resolve, reject) => {
      uni.downloadFile({
        url,
        header: {
          ...this.headers,
          'Referer': `${this.baseUrl}/homeExt!main.action`
        },
        timeout: 10000,
        success: (res) => {
          if (res.statusCode === 200 && res.tempFilePath) {
            resolve(res.tempFilePath);
          } else {
            reject(new Error('AVATAR_DOWNLOAD_FAILED'));
          }
        },
        fail: (err) => {
          console.error('[Crawler] downloadAvatar failed:', err);
          reject(new Error('AVATAR_DOWNLOAD_FAILED'));
        }
      });
    });
  }

  /**
   * 调用教务系统 logout.action 注销服务端 session
   */
  async serverLogout(): Promise<void> {
    try {
      await uniRequest(`${this.baseUrl}/logout.action`, {
        method: 'GET',
        header: { ...this.headers },
        cookieJar: this.cookieJar,
        timeout: 5000
      });
    } catch {
      // 忽略网络错误
    }
  }

  /** 清理 Cookie（可供外部调用重置会话） */
  reset(): void {
    this.cookieJar.clear();
    this.userId = null;
    this.currentSemesterId = null;
    this.allSemesters = [];
  }

  /**
   * 获取所有学期列表（用于查看历史学期功能）
   * @returns 是否获取成功
   */
  async fetchSemesters(): Promise<boolean> {
    try {
      // 构建请求数据
      const formData: Record<string, string> = {
        dataType: 'semesterCalendar'
      };
      
      const semesterRes = await requestWithRetry(`${this.baseUrl}/dataQuery.action`, {
        method: 'POST',
        header: {
          ...this.headers,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: encodeFormData(formData),
        cookieJar: this.cookieJar,
        timeout: 10000
      });

      // 检查是否是HTML页面（可能是登录页面）
      if (semesterRes.text.includes('DOCTYPE') || semesterRes.text.includes('html')) {
        console.error('[fetchSemesters] Response is HTML, not JSON');
        return false;
      }

      // 检查响应是否为空
      if (!semesterRes.text || semesterRes.text.trim() === '') {
        console.error('[fetchSemesters] Response is empty');
        return false;
      }

      // 尝试解析JSON
      let semesterData: { semesters?: Record<string, Array<{id: number, schoolYear: string, name: string}>> };
      try {
        const cleanedText = semesterRes.text.trim();
        // 将JavaScript对象字面量转换为JSON格式
        // {yearDom:"..."} → {"yearDom":"..."}
        const jsonText = cleanedText.replace(/([{,])\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
        semesterData = JSON.parse(jsonText);
      } catch (parseError: unknown) {
        console.error('[fetchSemesters] JSON parse error:', parseError instanceof Error ? parseError.message : parseError);
        return false;
      }

      // 检查semesters是否存在
      if (!semesterData.semesters) {
        console.error('[fetchSemesters] No semesters in response');
        return false;
      }

      // 检查semesters是否为空
      if (Object.keys(semesterData.semesters).length === 0) {
        console.error('[fetchSemesters] semesters is empty');
        return false;
      }

      // 保存所有学期列表
      this.allSemesters = [];
      for (const yearKey in semesterData.semesters) {
        this.allSemesters.push(...semesterData.semesters[yearKey]);
      }

      console.log('[fetchSemesters] Loaded semesters:', this.allSemesters.length);
      return true;
    } catch (e: unknown) {
      console.error('[fetchSemesters] Failed:', e instanceof Error ? e.message : e);
      return false;
    }
  }

  /**
   * 获取所有学期列表
   * @returns 学期列表
   */
  getSemesters(): Array<{id: number, schoolYear: string, name: string}> {
    return this.allSemesters;
  }

  /**
   * 切换到指定学期
   * @param semesterId 学期ID
   */
  setSemester(semesterId: string): void {
    this.currentSemesterId = semesterId;
    console.log('[setSemester] Switched to semester:', semesterId);
  }

  /**
   * 获取用户ID
   * @returns 用户ID
   */
  getUserId(): string | null {
    return this.userId;
  }

  /**
   * 设置用户ID
   * @param userId 用户ID
   */
  setUserId(userId: string): void {
    this.userId = userId;
    console.log('[setUserId] Set user ID:', userId);
  }

  /**
   * 获取当前学期ID
   * @returns 当前学期ID
   */
  getCurrentSemesterId(): string | null {
    return this.currentSemesterId;
  }

  /**
   * 检测响应是否为登录页（session 已失效）
   * 如果是，标记 session 失效并抛出 SESSION_EXPIRED
   */
  private checkSessionAlive(html: string): void {
    if (html.includes('CryptoJS.SHA1')) {
      import('./session').then(({ invalidateSession }) => invalidateSession());
      throw new Error('SESSION_EXPIRED');
    }
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
export async function fetchSchedule(username: string, password: string, onProgress?: ProgressCallback): Promise<Course[]> {
  const { getCrawler } = await import('./session');
  try {
    const crawler = await getCrawler(username, password, onProgress);
    onProgress?.(85, '同步课程信息...');
    const courses = await crawler.getData();
    onProgress?.(100, '同步完成');
    return courses;
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'SESSION_EXPIRED') {
      console.log('[fetchSchedule] Session expired, retrying...');
      onProgress?.(10, '重新建立连接...');
      const crawler = await getCrawler(username, password, onProgress);
      onProgress?.(85, '同步课程信息...');
      const courses = await crawler.getData();
      onProgress?.(100, '同步完成');
      return courses;
    }
    throw e;
  }
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
    case 'SESSION_EXPIRED':
      return '登录已过期，请重试';
    case 'NETWORK_ERROR':
      return '教务系统连接失败。请确认当前是否在校园网内，或教务系统已暂时关闭公网访问（建议使用校园网）。';
    default:
      return `未知错误: ${error}`;
  }
}
