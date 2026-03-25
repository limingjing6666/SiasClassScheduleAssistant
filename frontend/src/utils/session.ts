/**
 * SiasCrawler 单例 session 管理
 *
 * 核心思路：
 * - 同账号 + session 未过期 → 直接复用（省去 login + autoDetect 约 3s）
 * - 账号切换或过期 → 自动重新 login + autoDetect
 * - 响应检测兜底：即使 TTL 内 session 被服务端踢掉，也能自动恢复
 */

import { SiasCrawler } from './crawler';

/** 模块级单例 */
let _crawler: SiasCrawler | null = null;
let _username: string = '';
let _password: string = '';
/** session 创建时间戳 */
let _loginTime: number = 0;
/** session 有效期：5 分钟（实测教务系统 6~9 分钟失效） */
const SESSION_TTL = 5 * 60 * 1000;
/** login 锁：防止并发重复登录 */
let _loginPromise: Promise<SiasCrawler> | null = null;

/**
 * 获取已登录的 crawler 实例
 * - 同账号 + session 未过期 → 直接复用
 * - 否则 → 重新 login + autoDetect
 *
 * 自带并发锁：多个页面同时调用时只会登录一次
 */
export async function getCrawler(username: string, password: string): Promise<SiasCrawler> {
  const now = Date.now();
  const isSameUser = _crawler && _username === username && _password === password;
  const isAlive = isSameUser && (now - _loginTime < SESSION_TTL);

  if (isAlive) {
    console.log('[session] Reusing existing crawler, age:', Math.round((now - _loginTime) / 1000), 's');
    return _crawler!;
  }

  // 需要重新登录 — 用锁防止并发
  if (_loginPromise) {
    console.log('[session] Login already in progress, waiting...');
    return _loginPromise;
  }

  _loginPromise = doLogin(username, password);
  try {
    return await _loginPromise;
  } finally {
    _loginPromise = null;
  }
}

/**
 * 执行登录流程
 */
async function doLogin(username: string, password: string): Promise<SiasCrawler> {
  console.log('[session] Creating new crawler session');
  const crawler = new SiasCrawler(username, password);

  const loginOk = await crawler.login();
  if (!loginOk) throw new Error('LOGIN_FAILED');

  const detectOk = await crawler.autoDetect();
  if (!detectOk) throw new Error('DETECT_FAILED');

  // 缓存
  _crawler = crawler;
  _username = username;
  _password = password;
  _loginTime = Date.now();

  console.log('[session] Session created, userId:', crawler.getUserId(), 'semId:', crawler.getCurrentSemesterId());
  return crawler;
}

/**
 * 检测响应是否为登录页（session 已失效）
 * 各调用方在请求后可用此函数检测，失效则 invalidateSession 并重试
 */
export function isSessionExpiredResponse(html: string): boolean {
  return html.includes('CryptoJS.SHA1');
}

/**
 * 标记 session 失效（遇到登录态丢失时调用）
 * 下次 getCrawler 会重新登录
 */
export function invalidateSession(): void {
  console.log('[session] Session invalidated');
  _loginTime = 0;
}

/**
 * 清除 session（退出登录时调用）
 */
export function clearSession(): void {
  console.log('[session] Session cleared');
  _crawler?.reset();
  _crawler = null;
  _username = '';
  _password = '';
  _loginTime = 0;
  _loginPromise = null;
}
