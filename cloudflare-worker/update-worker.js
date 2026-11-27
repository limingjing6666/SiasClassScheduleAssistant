/**
 * 西亚斯课表助手 — Cloudflare Worker 更新与下载分发服务
 *
 * 路由：
 * - GET /app/update.json       → 动态拉取 GitHub Latest Release（5 分钟边缘缓存）生成更新元数据
 * - GET /app/<file>.apk        → 流式代理 GitHub Release APK 资产（支持 Range / HEAD，不缓存进 Worker 内存）
 * - GET / 或 /app/             → 漫画风最新版下载引导页
 */

const REPO_OWNER = 'limingjing6666';
const REPO_NAME = 'SiasClassScheduleAssistant';
const RELEASE_CACHE_KEY = 'https://limingjing.codes/__internal/latest-release-v2.json';
const RELEASE_CACHE_TTL_SECONDS = 300;
const FALLBACK_CACHE_TTL_SECONDS = 30;
const USER_AGENT = 'SiasSchedule-Update-Worker/1.1';

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
 * 响应 /app/update.json
 */
async function handleUpdateJson(request, ctx) {
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
async function handleApkDownload(request, rawFilename, ctx) {
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
 * 简洁漫画风下载引导页（访问 / 或 /app/ 时展示）
 */
async function handleLandingPage(request, ctx) {
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
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #F4F4F5;
      background-image: radial-gradient(#D4D4D8 1.5px, transparent 1.5px);
      background-size: 20px 20px;
      color: #000;
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
  <main class="card">
    <div class="tag">SIAS SCHEDULE</div>
    <h1>西亚斯课表助手</h1>
    <div class="meta">
      <span class="pill">${escapeHtml(versionText)}</span>
      ${sizeText ? `<span class="size">${escapeHtml(sizeText)} · Android APK</span>` : '<span class="size">Android APK</span>'}
    </div>
    <div class="notes">${notesHtml}</div>
    <a class="btn" href="${downloadHref}">立即下载 Android 安装包</a>
    <div class="footer">
      <a href="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases" target="_blank" rel="noopener">GitHub Releases</a>
      · <a href="/app/update.json">update.json</a>
    </div>
  </main>
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

    if (pathname === '/app/update.json') {
      return handleUpdateJson(request, ctx);
    }

    if (pathname.startsWith('/app/') && pathname.length > 5) {
      const filename = pathname.slice('/app/'.length);
      return handleApkDownload(request, filename, ctx);
    }

    if (pathname === '/' || pathname === '/app' || pathname === '/app/') {
      return handleLandingPage(request, ctx);
    }

    return new Response('Not Found', { status: 404 });
  }
};
