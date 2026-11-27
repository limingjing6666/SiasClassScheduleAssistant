/**
 * 西亚斯课表助手 — Cloudflare Worker 更新、下载分发与轻量统计服务
 *
 * 路由：
 * - GET /app/update.json       → 动态拉取 GitHub Latest Release（5 分钟边缘缓存）生成更新元数据
 * - GET /app/<file>.apk        → 流式代理 GitHub Release APK 资产（支持 Range / HEAD，不缓存进 Worker 内存）
 * - GET / 或 /app/             → 漫画风最新版下载引导页（含微信/QQ 内置浏览器引导条）
 * - GET /app/stats(.json)?key= → 口令保护的下载与访问统计看板（基于 Cloudflare D1）
 * - GET /favicon.ico           → 内联漫画风 SVG 图标
 */

const REPO_OWNER = 'limingjing6666';
const REPO_NAME = 'SiasClassScheduleAssistant';
const RELEASE_CACHE_KEY = 'https://limingjing.codes/__internal/latest-release-v2.json';
const RELEASE_CACHE_TTL_SECONDS = 300;
const FALLBACK_CACHE_TTL_SECONDS = 30;
const USER_AGENT = 'SiasSchedule-Update-Worker/1.2';

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="6" y="6" width="52" height="52" rx="14" fill="#FFEAA7" stroke="#000" stroke-width="5"/>
  <rect x="15" y="18" width="14" height="14" rx="4" fill="#74B9FF" stroke="#000" stroke-width="3.5"/>
  <rect x="35" y="18" width="14" height="14" rx="4" fill="#55EFC4" stroke="#000" stroke-width="3.5"/>
  <rect x="15" y="36" width="14" height="12" rx="4" fill="#FF7675" stroke="#000" stroke-width="3.5"/>
  <rect x="35" y="36" width="14" height="12" rx="4" fill="#FFF" stroke="#000" stroke-width="3.5"/>
</svg>`;

function parseVersionCode(versionName) {
  const m = String(versionName || '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 10000 + parseInt(m[2], 10) * 100 + parseInt(m[3], 10);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(text) {
  const codeSpans = [];
  const withPlaceholders = String(text || '').replace(/`([^`]+)`/g, (_, code) => {
    const idx = codeSpans.length;
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000CODE${idx}\u0000`;
  });

  let html = escapeHtml(withPlaceholders)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');

  html = html.replace(/\u0000CODE(\d+)\u0000/g, (_, idx) => codeSpans[Number(idx)] || '');
  return html;
}

/**
 * 轻量 XSS 安全 Markdown 渲染（支持标题、无序/有序列表、加粗、斜体、行内代码、链接、分隔线）
 */
function renderMarkdown(md) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let listType = null; // 'ul' | 'ol'
  let listItems = [];
  let paraLines = [];

  const flushPara = () => {
    if (paraLines.length > 0) {
      blocks.push(`<p>${paraLines.map(renderInlineMarkdown).join('<br>')}</p>`);
      paraLines = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      blocks.push(`<${listType}>${listItems.map(item => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</${listType}>`);
      listItems = [];
      listType = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushPara();
      flushList();
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(line)) {
      flushPara();
      flushList();
      blocks.push('<hr>');
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushPara();
      flushList();
      const tag = headingMatch[1].length <= 2 ? 'h2' : 'h3';
      blocks.push(`<${tag}>${renderInlineMarkdown(headingMatch[2])}</${tag}>`);
      continue;
    }

    const ulMatch = line.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      flushPara();
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(ulMatch[1]);
      continue;
    }

    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      flushPara();
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(olMatch[1]);
      continue;
    }

    flushList();
    paraLines.push(line);
  }

  flushPara();
  flushList();

  return blocks.join('\n');
}

function decodeXmlEntities(str) {
  return String(str || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function sanitizeReleaseHtml(html) {
  return String(html || '')
    .replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/href\s*=\s*(["'])\s*javascript:[^"']*\1/gi, 'href="#"');
}

function htmlToPlainText(html) {
  return decodeXmlEntities(
    String(html || '')
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n【$1】\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 降级数据源：解析 GitHub releases.atom 与 expanded_assets（不占用 api.github.com 匿名配额）
 */
async function fetchFromGithubAtom() {
  const atomRes = await fetch(
    `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases.atom`,
    { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/atom+xml, application/xml, text/xml' } }
  );
  if (!atomRes.ok) return null;

  const xml = await atomRes.text();
  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/i);
  if (!entryMatch) return null;
  const entry = entryMatch[1];

  const linkMatch = entry.match(/\/releases\/tag\/(v?\d+\.\d+\.\d+)/);
  if (!linkMatch) return null;

  const tagName = linkMatch[1];
  const versionName = tagName.replace(/^v/i, '');
  const updatedMatch = entry.match(/<updated>([^<]+)<\/updated>/i);
  const contentMatch = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
  const rawHtml = contentMatch ? decodeXmlEntities(contentMatch[1]).trim() : '';
  const safeHtml = rawHtml ? sanitizeReleaseHtml(rawHtml) : '';
  const plainLog = safeHtml ? htmlToPlainText(safeHtml) : `西亚斯课表 v${versionName} 更新发布`;

  let apkName = `SiasSchedule_v${versionName}.apk`;
  let apkSizeLabel = '';
  try {
    const assetsRes = await fetch(
      `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/expanded_assets/${encodeURIComponent(tagName)}`,
      { headers: { 'User-Agent': USER_AGENT } }
    );
    if (assetsRes.ok) {
      const assetsHtml = await assetsRes.text();
      const apkHrefMatch = assetsHtml.match(
        new RegExp(`/${REPO_OWNER}/${REPO_NAME}/releases/download/[^"']+/([^/"']+\\.apk)`, 'i')
      );
      if (apkHrefMatch) {
        apkName = decodeURIComponent(apkHrefMatch[1]);
        const afterHref = assetsHtml.slice(apkHrefMatch.index);
        const sizeMatch = afterHref.match(/>(\d+(?:\.\d+)?\s*(?:MB|KB|GB|Bytes))</i);
        if (sizeMatch) apkSizeLabel = sizeMatch[1].trim();
      }
    }
  } catch (err) {
    console.error(JSON.stringify({ event: 'github_assets_html_error', error: String(err) }));
  }

  return {
    tagName,
    versionName,
    versionCode: parseVersionCode(versionName),
    updateLog: plainLog,
    updateLogHtml: safeHtml,
    apkName,
    apkSize: 0,
    apkSizeLabel,
    apkDownloadUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${tagName}/${encodeURIComponent(apkName)}`,
    publishedAt: updatedMatch ? updatedMatch[1].trim() : '',
    source: 'atom'
  };
}

/**
 * 获取最新 GitHub Release 元数据（5 分钟边缘缓存；API → Atom Feed → 302 跳转三级容灾）
 */
async function getLatestReleaseMeta(ctx) {
  const cache = caches.default;
  const cacheReq = new Request(RELEASE_CACHE_KEY, { method: 'GET' });
  const cachedRes = await cache.match(cacheReq);
  if (cachedRes) {
    return await cachedRes.json();
  }

  let meta = null;

  // 1. 主路径：GitHub REST API
  try {
    const apiRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
      {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/vnd.github+json'
        }
      }
    );

    if (apiRes.ok) {
      const data = await apiRes.json();
      const tagName = String(data.tag_name || '').trim();
      const versionName = tagName.replace(/^v/i, '');
      const assets = Array.isArray(data.assets) ? data.assets : [];
      const apkAsset = assets.find(a => typeof a.name === 'string' && a.name.toLowerCase().endsWith('.apk'));

      if (versionName && apkAsset) {
        meta = {
          tagName,
          versionName,
          versionCode: parseVersionCode(versionName),
          updateLog: String(data.body || '修复已知问题，提升使用体验。').trim(),
          updateLogHtml: '',
          apkName: apkAsset.name,
          apkSize: Number(apkAsset.size) || 0,
          apkSizeLabel: '',
          apkDownloadCount: Number(apkAsset.download_count) || 0,
          apkDownloadUrl: apkAsset.browser_download_url,
          publishedAt: data.published_at || '',
          source: 'api'
        };
      }
    }
  } catch (err) {
    console.error(JSON.stringify({ event: 'github_api_error', error: String(err) }));
  }

  // 2. 二级路径：GitHub releases.atom + expanded_assets（无 api.github.com 匿名限流，含完整更新日志）
  if (!meta) {
    try {
      meta = await fetchFromGithubAtom();
    } catch (err) {
      console.error(JSON.stringify({ event: 'github_atom_error', error: String(err) }));
    }
  }

  // 3. 兜底路径：直接通过 /releases/latest 302 跳转获取最新版本号（短 TTL）
  if (!meta) {
    const redirectRes = await fetch(
      `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
      {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': USER_AGENT }
      }
    );
    const location = redirectRes.headers.get('location') || '';
    const tagMatch = location.match(/\/releases\/tag\/(v?\d+\.\d+\.\d+)/);
    if (tagMatch) {
      const tagName = tagMatch[1];
      const versionName = tagName.replace(/^v/i, '');
      const apkName = `SiasSchedule_v${versionName}.apk`;
      meta = {
        tagName,
        versionName,
        versionCode: parseVersionCode(versionName),
        updateLog: `西亚斯课表 v${versionName} 更新发布`,
        updateLogHtml: '',
        apkName,
        apkSize: 0,
        apkSizeLabel: '',
        apkDownloadUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${tagName}/${apkName}`,
        publishedAt: '',
        source: 'redirect'
      };
    }
  }

  if (meta) {
    const ttl = meta.source === 'redirect' ? FALLBACK_CACHE_TTL_SECONDS : RELEASE_CACHE_TTL_SECONDS;
    const cacheResp = new Response(JSON.stringify(meta), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=${ttl}`
      }
    });
    ctx.waitUntil(cache.put(cacheReq, cacheResp));
  }

  return meta;
}

/**
 * 北京时间日期 YYYY-MM-DD 与格式化时间
 */
function getBeijingDay(date = new Date()) {
  const bj = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return bj.toISOString().slice(0, 10);
}

function formatBeijingTime(isoStr) {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return String(isoStr || '');
  const bj = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return bj.toISOString().slice(5, 19).replace('T', ' ');
}

function timingSafeEqualStr(a, b) {
  const enc = new TextEncoder();
  const ba = enc.encode(String(a || ''));
  const bb = enc.encode(String(b || ''));
  if (ba.length === 0 || ba.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

function detectClientInfo(request) {
  const ua = request.headers.get('user-agent') || '';
  const isWechat = /MicroMessenger|\bQQ\/\d/i.test(ua);
  const isBot = !ua || /\b(curl|wget|python-requests|go-http-client|bot|spider|crawler|headless|lighthouse|monitor|uptime|scanner|check)\b/i.test(ua);

  let device = 'other';
  if (/Android/i.test(ua)) device = 'android';
  else if (/iPhone|iPad|iPod/i.test(ua)) device = 'ios';
  else if (/Windows NT|Macintosh|X11;\s*Linux/i.test(ua)) device = 'desktop';

  const cf = request.cf || {};
  return {
    device,
    isWechat,
    isBot,
    country: String(cf.country || ''),
    city: String(cf.city || '')
  };
}

function recordLandingStat(request, env, ctx) {
  if (!env?.STATS_DB || request.method !== 'GET') return;
  const info = detectClientInfo(request);
  if (info.isBot) return;

  const day = getBeijingDay();
  const metrics = ['landing_views', `landing_${info.device}`];
  if (info.isWechat) metrics.push('landing_wechat');

  const stmt = env.STATS_DB.prepare(
    'INSERT INTO daily_stats(day, metric, count) VALUES (?, ?, 1) ON CONFLICT(day, metric) DO UPDATE SET count = count + 1'
  );
  ctx.waitUntil(
    env.STATS_DB.batch(metrics.map(m => stmt.bind(day, m))).catch(err => {
      console.error(JSON.stringify({ event: 'stats_landing_error', error: String(err) }));
    })
  );
}

function recordUpdateCheckStat(request, env, ctx) {
  if (!env?.STATS_DB || request.method !== 'GET') return;
  const day = getBeijingDay();
  const stmt = env.STATS_DB.prepare(
    'INSERT INTO daily_stats(day, metric, count) VALUES (?, ?, 1) ON CONFLICT(day, metric) DO UPDATE SET count = count + 1'
  );
  ctx.waitUntil(
    stmt.bind(day, 'update_checks').run().catch(err => {
      console.error(JSON.stringify({ event: 'stats_update_error', error: String(err) }));
    })
  );
}

function recordApkDownloadStat(request, env, ctx, filename, status) {
  if (!env?.STATS_DB || request.method !== 'GET') return;

  // 仅统计完整下载或从 0 字节开始的整包/大段拉取（排除断点续传中间分片与小范围探测）
  const rangeHeader = request.headers.get('range') || '';
  const isFullOrInitialDownload =
    status === 200 ||
    (status === 206 && /^bytes=0-(?:$|\d{6,})/i.test(rangeHeader.trim()));
  if (!isFullOrInitialDownload) return;

  const info = detectClientInfo(request);
  if (info.isBot) return;

  const now = new Date();
  const day = getBeijingDay(now);
  const ts = now.toISOString();
  const incStmt = env.STATS_DB.prepare(
    'INSERT INTO daily_stats(day, metric, count) VALUES (?, ?, 1) ON CONFLICT(day, metric) DO UPDATE SET count = count + 1'
  );
  const logStmt = env.STATS_DB.prepare(
    'INSERT INTO download_events(ts, day, filename, device, is_wechat, country, city, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const ops = [
    incStmt.bind(day, 'apk_downloads'),
    incStmt.bind(day, `apk_${info.device}`),
    logStmt.bind(ts, day, filename, info.device, info.isWechat ? 1 : 0, info.country, info.city, status)
  ];
  if (info.isWechat) {
    ops.push(incStmt.bind(day, 'apk_wechat'));
  }

  ctx.waitUntil(
    env.STATS_DB.batch(ops).catch(err => {
      console.error(JSON.stringify({ event: 'stats_apk_error', error: String(err) }));
    })
  );
}

/**
 * 响应 /app/update.json
 */
async function handleUpdateJson(request, env, ctx) {
  const meta = await getLatestReleaseMeta(ctx);
  if (!meta) {
    return new Response(
      JSON.stringify({ error: 'Unable to fetch latest release metadata' }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  recordUpdateCheckStat(request, env, ctx);

  const origin = new URL(request.url).origin;
  const payload = {
    versionCode: meta.versionCode,
    versionName: meta.versionName,
    updateLog: meta.updateLog,
    url: `${origin}/app/${encodeURIComponent(meta.apkName)}`
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

/**
 * 流式代理 /app/<filename>.apk（支持 Range 与 HEAD）
 */
async function handleApkDownload(request, rawFilename, env, ctx) {
  let filename;
  try {
    filename = decodeURIComponent(rawFilename);
  } catch {
    return new Response('Bad filename', { status: 400 });
  }

  // 防路径穿越，仅允许合法 APK 文件名
  if (!filename || filename.includes('/') || filename.includes('\\') || !/\.apk$/i.test(filename)) {
    return new Response('Invalid APK filename', { status: 400 });
  }

  const meta = await getLatestReleaseMeta(ctx);
  let upstreamUrl = '';

  if (meta && meta.apkName === filename && meta.apkDownloadUrl) {
    upstreamUrl = meta.apkDownloadUrl;
  } else {
    // 兼容历史版本号文件名或 latest.apk 别名
    const verMatch = filename.match(/v(\d+\.\d+\.\d+)\.apk$/i);
    if (verMatch) {
      upstreamUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${verMatch[1]}/${encodeURIComponent(filename)}`;
    } else if (filename.toLowerCase() === 'latest.apk' && meta?.apkDownloadUrl) {
      upstreamUrl = meta.apkDownloadUrl;
      filename = meta.apkName;
    } else if (meta?.tagName) {
      upstreamUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${meta.tagName}/${encodeURIComponent(filename)}`;
    }
  }

  if (!upstreamUrl) {
    return new Response('APK not found', { status: 404 });
  }

  const upstreamHeaders = new Headers({ 'User-Agent': USER_AGENT });
  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    upstreamHeaders.set('Range', rangeHeader);
  }

  const upstreamRes = await fetch(upstreamUrl, {
    method: request.method === 'HEAD' ? 'HEAD' : 'GET',
    headers: upstreamHeaders,
    redirect: 'follow'
  });

  if (!upstreamRes.ok && upstreamRes.status !== 206) {
    return new Response('Upstream APK unavailable', { status: upstreamRes.status });
  }

  recordApkDownloadStat(request, env, ctx, filename, upstreamRes.status);

  const respHeaders = new Headers();
  respHeaders.set('Content-Type', 'application/vnd.android.package-archive');
  respHeaders.set('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`);
  respHeaders.set('Accept-Ranges', 'bytes');
  respHeaders.set('Cache-Control', 'public, max-age=86400');
  respHeaders.set('Access-Control-Allow-Origin', '*');

  const contentLength = upstreamRes.headers.get('content-length');
  if (contentLength) respHeaders.set('Content-Length', contentLength);
  const contentRange = upstreamRes.headers.get('content-range');
  if (contentRange) respHeaders.set('Content-Range', contentRange);
  const etag = upstreamRes.headers.get('etag');
  if (etag) respHeaders.set('ETag', etag);

  return new Response(request.method === 'HEAD' ? null : upstreamRes.body, {
    status: upstreamRes.status,
    headers: respHeaders
  });
}

/**
 * 简洁漫画风下载引导页（访问 / 或 /app/ 时展示，含微信/QQ 内置浏览器引导条）
 */
async function handleLandingPage(request, env, ctx) {
  recordLandingStat(request, env, ctx);

  const meta = await getLatestReleaseMeta(ctx);
  const versionText = meta ? `v${meta.versionName}` : '最新版';
  const sizeText = meta?.apkSize
    ? `${(meta.apkSize / 1024 / 1024).toFixed(1)} MB`
    : (meta?.apkSizeLabel || '');
  const downloadHref = meta ? `/app/${encodeURIComponent(meta.apkName)}` : `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
  const notesHtml = meta?.updateLogHtml
    ? meta.updateLogHtml
    : renderMarkdown(meta?.updateLog || '极简漫画风西亚斯教务课表助手，本地直连教务系统，保护账号隐私。');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>西亚斯课表助手 ${escapeHtml(versionText)}</title>
  <link rel="icon" href="/favicon.ico" type="image/svg+xml" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      gap: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #F4F4F5;
      background-image: radial-gradient(#D4D4D8 1.5px, transparent 1.5px);
      background-size: 20px 20px;
      color: #000;
    }
    .inapp-tip {
      display: none;
      width: 100%;
      max-width: 480px;
      background: #FFEAA7;
      border: 3px solid #000;
      border-radius: 18px;
      box-shadow: 5px 5px 0 #000;
      padding: 14px 16px;
      font-size: 13.5px;
      line-height: 1.55;
      color: #18181B;
    }
    .inapp-tip.show { display: block; }
    .inapp-tip.pulse {
      animation: tipPulse 0.35s ease 2;
    }
    @keyframes tipPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }
    .inapp-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 900;
      font-size: 14.5px;
      margin-bottom: 4px;
    }
    .inapp-arrow {
      font-size: 18px;
      font-weight: 900;
    }
    .card {
      position: relative;
      width: 100%;
      max-width: 480px;
      background: #FFF;
      border: 3px solid #000;
      border-radius: 24px;
      box-shadow: 7px 7px 0 #000;
      padding: 36px 28px 28px;
    }
    .tag {
      position: absolute;
      top: -16px;
      left: 24px;
      background: #FFEAA7;
      border: 3px solid #000;
      box-shadow: 3px 3px 0 #000;
      padding: 4px 14px;
      font-size: 13px;
      font-weight: 900;
      transform: rotate(-2deg);
    }
    h1 { font-size: 28px; font-weight: 900; margin-bottom: 8px; }
    .meta {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 20px;
    }
    .pill {
      background: #55EFC4;
      border: 2px solid #000;
      border-radius: 999px;
      padding: 3px 12px;
      font-size: 13px;
      font-weight: 800;
    }
    .size { font-size: 13px; font-weight: 700; color: #71717A; }
    .notes {
      background: #FAFAFA;
      border: 2px solid #E4E4E7;
      border-radius: 14px;
      padding: 16px 18px;
      font-size: 14px;
      line-height: 1.65;
      color: #3F3F46;
      margin-bottom: 24px;
      max-height: 320px;
      overflow-y: auto;
    }
    .notes h2, .notes h3 {
      font-size: 15px;
      font-weight: 900;
      color: #18181B;
      margin: 12px 0 6px;
      padding-left: 8px;
      border-left: 3px solid #000;
    }
    .notes h2:first-child, .notes h3:first-child { margin-top: 0; }
    .notes p { margin: 6px 0; }
    .notes p:first-child { margin-top: 0; }
    .notes p:last-child { margin-bottom: 0; }
    .notes ul, .notes ol {
      margin: 6px 0 10px 18px;
      padding: 0;
    }
    .notes ul:last-child, .notes ol:last-child { margin-bottom: 0; }
    .notes li { margin: 5px 0; }
    .notes strong { color: #09090B; font-weight: 800; }
    .notes code {
      background: #EFEFEF;
      border: 1px solid #D4D4D8;
      border-radius: 5px;
      padding: 1px 5px;
      font-size: 12.5px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: #18181B;
    }
    .notes a { color: #2563EB; text-decoration: underline; }
    .notes hr { border: 0; border-top: 2px dashed #D4D4D8; margin: 12px 0; }
    .btn {
      display: block;
      width: 100%;
      text-align: center;
      text-decoration: none;
      background: #74B9FF;
      color: #000;
      font-size: 16px;
      font-weight: 900;
      padding: 14px 20px;
      border: 3px solid #000;
      border-radius: 16px;
      box-shadow: 4px 4px 0 #000;
      transition: transform 0.1s ease, box-shadow 0.1s ease;
    }
    .btn:active {
      transform: translate(3px, 3px);
      box-shadow: 0 0 0 #000;
    }
    .footer {
      margin-top: 16px;
      text-align: center;
      font-size: 12px;
      color: #A1A1AA;
      font-weight: 600;
    }
    .footer a { color: #52525B; text-decoration: none; }
  </style>
</head>
<body>
  <aside id="inapp-tip" class="inapp-tip" role="alert">
    <div class="inapp-title">
      <span>微信 / QQ 内无法直接下载安装包</span>
      <span class="inapp-arrow">↗</span>
    </div>
    <div>请点击右上角 <strong>···</strong> 菜单，选择 <strong>在默认浏览器中打开</strong> 即可直接下载安装。</div>
  </aside>
  <main class="card">
    <div class="tag">SIAS SCHEDULE</div>
    <h1>西亚斯课表助手</h1>
    <div class="meta">
      <span class="pill">${escapeHtml(versionText)}</span>
      ${sizeText ? `<span class="size">${escapeHtml(sizeText)} · Android APK</span>` : '<span class="size">Android APK</span>'}
    </div>
    <div class="notes">${notesHtml}</div>
    <a id="download-btn" class="btn" href="${downloadHref}">立即下载 Android 安装包</a>
    <div class="footer">
      <a href="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases" target="_blank" rel="noopener">GitHub Releases</a>
      · <a href="/app/update.json">update.json</a>
    </div>
  </main>
  <script>
    (function () {
      var isInApp = /MicroMessenger|\\bQQ\\/\\d/i.test(navigator.userAgent || '');
      if (!isInApp) return;
      var tip = document.getElementById('inapp-tip');
      var btn = document.getElementById('download-btn');
      if (tip) tip.classList.add('show');
      if (btn && tip) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          tip.classList.remove('pulse');
          void tip.offsetWidth;
          tip.classList.add('pulse');
          tip.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=120'
    }
  });
}

/**
 * 口令保护的下载与访问统计看板（/app/stats 与 /app/stats.json）
 */
async function handleStats(request, env, ctx, asJson) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  if (!env?.STATS_KEY || !timingSafeEqualStr(key, env.STATS_KEY)) {
    return new Response('Not Found', { status: 404 });
  }
  if (!env?.STATS_DB) {
    return new Response('Stats database not configured', { status: 503 });
  }

  const today = getBeijingDay();
  const [totalsRes, recentDaysRes, eventsRes, meta] = await Promise.all([
    env.STATS_DB.prepare('SELECT metric, SUM(count) AS total FROM daily_stats GROUP BY metric').all(),
    env.STATS_DB.prepare(
      'SELECT day, metric, count FROM daily_stats WHERE day >= ? ORDER BY day DESC'
    ).bind(getBeijingDay(new Date(Date.now() - 13 * 24 * 60 * 60 * 1000))).all(),
    env.STATS_DB.prepare(
      'SELECT ts, filename, device, is_wechat, country, city, status FROM download_events ORDER BY id DESC LIMIT 30'
    ).all(),
    getLatestReleaseMeta(ctx)
  ]);

  const totals = {};
  for (const row of (totalsRes.results || [])) {
    totals[row.metric] = Number(row.total) || 0;
  }

  const dailyMap = new Map();
  for (const row of (recentDaysRes.results || [])) {
    if (!dailyMap.has(row.day)) {
      dailyMap.set(row.day, {
        day: row.day,
        landing_views: 0,
        landing_wechat: 0,
        apk_downloads: 0,
        apk_android: 0,
        update_checks: 0
      });
    }
    const item = dailyMap.get(row.day);
    item[row.metric] = Number(row.count) || 0;
  }
  const daily = Array.from(dailyMap.values()).sort((a, b) => (a.day < b.day ? 1 : -1));
  const todayStats = dailyMap.get(today) || {
    day: today,
    landing_views: 0,
    landing_wechat: 0,
    apk_downloads: 0,
    apk_android: 0,
    update_checks: 0
  };
  const recentDownloads = (eventsRes.results || []).map(r => ({
    time: formatBeijingTime(r.ts),
    filename: r.filename,
    device: r.device,
    isWechat: Boolean(r.is_wechat),
    location: [r.country, r.city].filter(Boolean).join(' / ') || '-',
    status: r.status
  }));

  const statsPayload = {
    today,
    latestVersion: meta?.versionName || '',
    githubLatestDownloads: meta?.apkDownloadCount ?? null,
    todayStats,
    totals: {
      apk_downloads: totals.apk_downloads || 0,
      landing_views: totals.landing_views || 0,
      landing_wechat: totals.landing_wechat || 0,
      update_checks: totals.update_checks || 0,
      apk_devices: {
        android: totals.apk_android || 0,
        ios: totals.apk_ios || 0,
        desktop: totals.apk_desktop || 0,
        other: totals.apk_other || 0
      },
      landing_devices: {
        android: totals.landing_android || 0,
        ios: totals.landing_ios || 0,
        desktop: totals.landing_desktop || 0,
        other: totals.landing_other || 0
      }
    },
    daily,
    recentDownloads
  };

  if (asJson) {
    return new Response(JSON.stringify(statsPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow'
      }
    });
  }

  const deviceLabels = { android: 'Android', ios: 'iOS', desktop: '桌面', other: '其他' };
  const dailyRowsHtml = daily.length > 0
    ? daily.map(d => `<tr>
        <td>${escapeHtml(d.day)}</td>
        <td><strong>${d.apk_downloads || 0}</strong></td>
        <td>${d.landing_views || 0}</td>
        <td>${d.landing_wechat || 0}</td>
        <td>${d.update_checks || 0}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="empty">暂无记录（新访问和下载会实时写入）</td></tr>';

  const eventRowsHtml = recentDownloads.length > 0
    ? recentDownloads.map(ev => `<tr>
        <td>${escapeHtml(ev.time)}</td>
        <td><code>${escapeHtml(ev.filename)}</code></td>
        <td><span class="badge">${escapeHtml(deviceLabels[ev.device] || ev.device)}</span>${ev.isWechat ? ' <span class="badge wx">微信</span>' : ''}</td>
        <td>${escapeHtml(ev.location)}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="empty">暂无真实 APK 下载记录</td></tr>';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>西亚斯课表助手 · 下载统计</title>
  <link rel="icon" href="/favicon.ico" type="image/svg+xml" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      padding: 24px 16px 40px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #F4F4F5;
      background-image: radial-gradient(#D4D4D8 1.5px, transparent 1.5px);
      background-size: 20px 20px;
      color: #18181B;
    }
    .wrap { max-width: 780px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 8px; }
    h1 { font-size: 24px; font-weight: 900; }
    .sub { font-size: 13px; color: #71717A; font-weight: 600; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }
    .kpi {
      background: #FFF;
      border: 3px solid #000;
      border-radius: 18px;
      box-shadow: 5px 5px 0 #000;
      padding: 16px;
    }
    .kpi.c1 { background: #E3F2FD; }
    .kpi.c2 { background: #E6FFFA; }
    .kpi.c3 { background: #FFF9DB; }
    .kpi.c4 { background: #F3E8FF; }
    .kpi-label { font-size: 12px; font-weight: 800; color: #52525B; margin-bottom: 6px; }
    .kpi-val { font-size: 30px; font-weight: 900; line-height: 1.1; }
    .kpi-sub { font-size: 12px; color: #52525B; margin-top: 6px; font-weight: 600; }
    .panel {
      background: #FFF;
      border: 3px solid #000;
      border-radius: 20px;
      box-shadow: 6px 6px 0 #000;
      padding: 18px 20px;
      overflow-x: auto;
    }
    .panel h2 { font-size: 16px; font-weight: 900; margin-bottom: 12px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      background: #FAFAFA;
      border: 2px solid #000;
      border-radius: 999px;
      padding: 4px 12px;
      font-size: 13px;
      font-weight: 700;
    }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 9px 8px; border-bottom: 1.5px solid #E4E4E7; white-space: nowrap; }
    th { font-weight: 800; color: #52525B; border-bottom: 2px solid #000; }
    tr:last-child td { border-bottom: none; }
    code { background: #F4F4F5; padding: 2px 6px; border-radius: 5px; font-size: 12px; }
    .badge {
      display: inline-block;
      background: #E4E4E7;
      border: 1.5px solid #000;
      border-radius: 999px;
      padding: 1px 8px;
      font-size: 11px;
      font-weight: 800;
    }
    .badge.wx { background: #55EFC4; }
    .empty { text-align: center; color: #A1A1AA; padding: 20px 0; }
    .foot { text-align: center; font-size: 12px; color: #71717A; }
    .foot a { color: #2563EB; text-decoration: none; font-weight: 700; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>西亚斯课表助手 · 下载看板</h1>
      <div class="sub">北京时间 ${escapeHtml(today)} · 最新版 v${escapeHtml(meta?.versionName || '-')}</div>
    </div>

    <div class="grid">
      <div class="kpi c1">
        <div class="kpi-label">APK 下载（今日 / 累计）</div>
        <div class="kpi-val">${todayStats.apk_downloads || 0} <span style="font-size:16px;font-weight:700;color:#52525B">/ ${statsPayload.totals.apk_downloads}</span></div>
        <div class="kpi-sub">仅计真实浏览器/App 整包下载</div>
      </div>
      <div class="kpi c2">
        <div class="kpi-label">引导页访问（今日 / 累计）</div>
        <div class="kpi-val">${todayStats.landing_views || 0} <span style="font-size:16px;font-weight:700;color:#52525B">/ ${statsPayload.totals.landing_views}</span></div>
        <div class="kpi-sub">微信/QQ 内打开：${statsPayload.totals.landing_wechat} 次</div>
      </div>
      <div class="kpi c3">
        <div class="kpi-label">更新检测（今日 / 累计）</div>
        <div class="kpi-val">${todayStats.update_checks || 0} <span style="font-size:16px;font-weight:700;color:#52525B">/ ${statsPayload.totals.update_checks}</span></div>
        <div class="kpi-sub">/app/update.json 请求量</div>
      </div>
      <div class="kpi c4">
        <div class="kpi-label">GitHub 当前版累计</div>
        <div class="kpi-val">${meta?.apkDownloadCount != null ? meta.apkDownloadCount : '-'}</div>
        <div class="kpi-sub">含 GitHub 直下与 Worker 回源</div>
      </div>
    </div>

    <div class="panel">
      <h2>设备分布（引导页访问 / APK 下载）</h2>
      <div class="chips">
        <span class="chip">Android：${statsPayload.totals.landing_devices.android} 访 / ${statsPayload.totals.apk_devices.android} 下</span>
        <span class="chip">iOS：${statsPayload.totals.landing_devices.ios} 访 / ${statsPayload.totals.apk_devices.ios} 下</span>
        <span class="chip">桌面：${statsPayload.totals.landing_devices.desktop} 访 / ${statsPayload.totals.apk_devices.desktop} 下</span>
        <span class="chip">其他：${statsPayload.totals.landing_devices.other} 访 / ${statsPayload.totals.apk_devices.other} 下</span>
      </div>
    </div>

    <div class="panel">
      <h2>近 14 天趋势</h2>
      <table>
        <thead>
          <tr><th>日期</th><th>APK 下载</th><th>引导页访问</th><th>微信内打开</th><th>更新检测</th></tr>
        </thead>
        <tbody>${dailyRowsHtml}</tbody>
      </table>
    </div>

    <div class="panel">
      <h2>最近 30 次 APK 下载明细（不记录 IP）</h2>
      <table>
        <thead>
          <tr><th>北京时间</th><th>安装包</th><th>设备</th><th>地区</th></tr>
        </thead>
        <tbody>${eventRowsHtml}</tbody>
      </table>
    </div>

    <div class="foot">
      <a href="/app/stats.json?key=${encodeURIComponent(key)}">JSON 原始数据</a> · <a href="/">返回下载页</a>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        }
      });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === '/favicon.ico') {
      return new Response(FAVICON_SVG, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=604800'
        }
      });
    }

    if (pathname === '/app/stats' || pathname === '/app/stats/') {
      return handleStats(request, env, ctx, false);
    }

    if (pathname === '/app/stats.json') {
      return handleStats(request, env, ctx, true);
    }

    if (pathname === '/app/update.json') {
      return handleUpdateJson(request, env, ctx);
    }

    if (pathname.startsWith('/app/') && pathname.length > 5) {
      const filename = pathname.slice('/app/'.length);
      return handleApkDownload(request, filename, env, ctx);
    }

    if (pathname === '/' || pathname === '/app' || pathname === '/app/') {
      return handleLandingPage(request, env, ctx);
    }

    return new Response('Not Found', { status: 404 });
  }
};
