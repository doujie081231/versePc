/**
 * @file server/http-client/request.js - 基础 HTTP 请求
 * @description GET/POST/PUT 请求、重定向、429 限流、gzip/br/deflate 解压、镜像回退、TTL 缓存、竞速请求。
 *   通过 ctx (../context) 访问共享状态，依赖 ./mirror 的镜像熔断逻辑。
 */

const http = require('http');
const https = require('https');
const zlib = require('zlib');
const dns = require('dns');
const ctx = require('../context');
const { _isMirrorAvailable, _mirrorFailed, _mirrorSuccess } = require('./mirror');

// BMCLAPI 请求节流：100ms 间隔，避免高频请求触发限流
let _lastBmclapiTime = 0;
function _bmclapiThrottle() {
  const now = Date.now();
  const elapsed = now - _lastBmclapiTime;
  if (elapsed < 100) {
    return new Promise((resolve) => setTimeout(resolve, 100 - elapsed));
  }
  _lastBmclapiTime = now;
  return Promise.resolve();
}

// === DNS 预解析 + IP 可靠度记录 ===
// 域名解析缓存：hostname -> { ips: [{ip, family}], ts: number }
const _dnsCache = new Map();
const DNS_CACHE_TTL = 5 * 60 * 1000; // 5 分钟
// DNS 失败记录：hostname -> 失败时间戳（1 分钟内不重试，减少断网时的异常数量）
const _dnsFailureRecord = new Map();
const DNS_FAILURE_COOLDOWN = 60 * 1000; // 1 分钟
// IP 可靠度分数：ip -> 分数（通常 -1 ~ +0.5，未尝试过的为 0）
const _ipReliability = new Map();
// 不进行 DNS 预解析的域名（有严格 SNI 限制，使用系统默认 DNS）
const DNS_EXEMPT_DOMAINS = ['mojang.com', 'minecraft.net', 'minecraftservices.com'];

/**
 * 预解析域名，返回 IP 列表（带 5 分钟缓存）
 * 特殊域名（mojang.com / minecraft.net / minecraftservices.com）跳过预解析，使用系统默认 DNS。
 * @param {string} hostname - 主机名
 * @returns {Promise<Array<{ip: string, family: number}>|null>} IP 候选数组，失败或豁免返回 null
 */
async function _dnsPreResolve(hostname) {
  // 特殊域名豁免：有严格 SNI 限制，使用系统默认 DNS
  const lowerHost = hostname.toLowerCase();
  if (DNS_EXEMPT_DOMAINS.some(d => lowerHost.includes(d))) {
    return null;
  }
  // 命中缓存直接返回
  const cached = _dnsCache.get(hostname);
  if (cached && Date.now() - cached.ts < DNS_CACHE_TTL) {
    return cached.ips;
  }
  // 1 分钟内失败过的域名不重试
  const failTime = _dnsFailureRecord.get(hostname);
  if (failTime && Date.now() - failTime < DNS_FAILURE_COOLDOWN) {
    return null;
  }
  try {
    const [v4, v6] = await Promise.all([
      new Promise((resolve, reject) => dns.resolve4(hostname, (err, addrs) => err ? reject(err) : resolve(addrs))),
      new Promise((resolve, reject) => dns.resolve6(hostname, (err, addrs) => err ? reject(err) : resolve(addrs)))
    ]);
    const ips = [];
    for (const ip of v4) ips.push({ ip, family: 4 });
    for (const ip of v6) ips.push({ ip, family: 6 });
    if (ips.length === 0) return null;
    _dnsCache.set(hostname, { ips, ts: Date.now() });
    _dnsFailureRecord.delete(hostname);
    return ips;
  } catch (_) {
    _dnsFailureRecord.set(hostname, Date.now());
    return null;
  }
}

/**
 * 从 IP 候选中选择可靠度最高的 IP
 * 若同时存在 IPv4 和 IPv6，按各自最高可靠度比较；api.modrinth.com 优先 IPv4。
 * @param {string} hostname - 主机名
 * @param {Array<{ip: string, family: number}>} ips - IP 候选列表
 * @returns {{ip: string, family: number}|null}
 */
function _selectBestIP(hostname, ips) {
  if (!ips || ips.length === 0) return null;
  const lowerHost = hostname.toLowerCase();
  const scored = ips.map(item => ({ ...item, score: _ipReliability.get(item.ip) || 0 }));
  const v4 = scored.filter(i => i.family === 4);
  const v6 = scored.filter(i => i.family === 6);
  let candidates = scored;
  // 若同时存在 IPv4 和 IPv6，仅选择其中一类（GFW 可能只屏蔽了其中一类）
  if (v4.length > 0 && v6.length > 0) {
    const v4Best = Math.max(...v4.map(i => i.score));
    let v6Best = Math.max(...v6.map(i => i.score));
    // api.modrinth.com 优先 IPv4 地址
    if (lowerHost === 'api.modrinth.com') v6Best -= 0.1;
    candidates = v4Best >= v6Best ? v4 : v6;
  }
  return candidates.reduce((best, cur) => cur.score > best.score ? cur : best);
}

/**
 * 更新 IP 可靠度分数（EMA 平滑：current * 0.5 + delta * 0.5）
 * @param {string} ip - IP 地址
 * @param {number} delta - 本次结果（成功 +0.5，连接错误 -0.7，超时 -1）
 */
function _recordIPReliability(ip, delta) {
  if (!ip) return;
  const current = _ipReliability.get(ip) || 0;
  _ipReliability.set(ip, current * 0.5 + delta * 0.5);
}

/**
 * 为指定 URL 预解析并选择最佳 IP
 * @param {string} urlStr - 完整 URL
 * @returns {Promise<{ip: string, hostname: string}|null>} 最佳 IP 信息，失败返回 null
 */
async function _resolveBestIPForUrl(urlStr) {
  let urlObj;
  try { urlObj = new URL(urlStr); } catch (_) { return null; }
  const hostname = urlObj.hostname;
  // 主机名已经是 IP 地址时跳过预解析
  if (/^[\d.]+$/.test(hostname) || hostname.includes(':')) return null;
  const ips = await _dnsPreResolve(hostname);
  if (!ips || ips.length === 0) return null;
  const best = _selectBestIP(hostname, ips);
  if (!best) return null;
  return { ip: best.ip, hostname };
}

/**
 * 用指定协议（http/https）发起 GET 请求，返回响应流
 * @param {string} targetUrl - 目标 URL
 * @param {object} [options={}] - 原生 http.get 选项
 * @returns {Promise<import('http').IncomingMessage>}
 */
function fetchWithProtocol(targetUrl, options = {}) {
  const mod = targetUrl.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.get(targetUrl, options, resolve);
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/**
 * 单次请求：处理重定向、429 限流、gzip/br/deflate 解压、DNS 预解析、IP 可靠度记录
 * @param {string} url - 请求 URL
 * @param {object} headers - 请求头
 * @param {number} timeout - 超时毫秒
 * @param {number} [retries=0] - 当前重试层级（用于 429）
 * @returns {Promise<object>} 解析后的 JSON
 */
async function _fetchOnce(url, headers, timeout, retries = 0) {
  // DNS 预解析：选择可靠度最高的 IP，通过 lookup 选项指定连接目标
  const ipInfo = await _resolveBestIPForUrl(url);
  const mod = url.startsWith('https') ? https : http;
  const agent = url.startsWith('https') ? ctx.httpAgents.SHARED_HTTPS_AGENT : ctx.httpAgents.SHARED_HTTP_AGENT;
  const reqHeaders = { ...headers, 'Accept-Encoding': 'gzip, deflate, br' };
  const reqOptions = { headers: reqHeaders, agent, timeout };
  if (ipInfo) {
    const targetIP = ipInfo.ip;
    const family = targetIP.includes(':') ? 6 : 4;
    reqOptions.lookup = (hostname, options, cb) => {
      if (typeof options === 'function') { cb = options; }
      cb(null, targetIP, family);
    };
  }
  // 可靠度记录（用 flag 防止 timeout/error 事件重复扣分）
  let reliabilityRecorded = false;
  const recordReliability = (delta) => {
    if (reliabilityRecorded || !ipInfo) return;
    reliabilityRecorded = true;
    _recordIPReliability(ipInfo.ip, delta);
  };
  return new Promise((resolve, reject) => {
    const req = mod.get(url, reqOptions, (res) => {
      // 收到 HTTP 响应头，说明 IP 可达，记录 +0.5
      recordReliability(0.5);
      // 3xx 重定向：销毁当前流，递归请求 location
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        req.destroy();
        return _fetchOnce(res.headers.location, headers, timeout, retries).then(resolve).catch(reject);
      }
      // 429 限流：按 Retry-After 头等待后重试，最多 2 次（默认 10s）
      if (res.statusCode === 429) {
        res.destroy();
        const retryAfter = parseInt(res.headers['retry-after'] || '0', 10) || 10;
        const waitMs = Math.min(retryAfter * 1000, 15000);
        if (retries < 2) {
          console.warn(`[fetchOnce] 429 限流，等待 ${waitMs}ms 后重试 (${url.substring(0, 60)}...)`);
          setTimeout(() => _fetchOnce(url, headers, timeout, retries + 1).then(resolve).catch(reject), waitMs);
        } else {
          const err = new Error(`HTTP 429 限流，已重试 ${retries} 次`);
          err.httpStatus = 429;
          reject(err);
        }
        return;
      }
      if (res.statusCode !== 200) {
        res.destroy();
        const err = new Error(`HTTP ${res.statusCode}`);
        err.httpStatus = res.statusCode;
        reject(err);
        return;
      }
      // 按 content-encoding 自动解压
      const encoding = (res.headers['content-encoding'] || '').toLowerCase();
      let stream = res;
      if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
      else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());
      else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
      let data = '';
      stream.on('data', (chunk) => { data += chunk; });
      stream.on('end', () => {
        // JSON 响应完整性检查：GFW 截断或网络问题可能导致首尾不匹配
        const trimmed = data.trim();
        if (trimmed.length === 0) {
          reject(new Error('JSON响应不完整: 空响应'));
          return;
        }
        const first = trimmed[0];
        const last = trimmed[trimmed.length - 1];
        if (!((first === '{' && last === '}') || (first === '[' && last === ']'))) {
          reject(new Error('JSON响应不完整'));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON解析失败: ${e.message}`)); }
      });
      stream.on('error', reject);
    });
    req.on('timeout', () => {
      recordReliability(-1);
      req.destroy();
      reject(new Error(`请求超时 (${timeout}ms)`));
    });
    req.on('error', (err) => {
      recordReliability(-0.7);
      reject(err);
    });
  });
}

/**
 * 带镜像回退的 JSON 请求：Modrinth / CurseForge 自动走镜像，超时梯度升级
 * @param {string} urlStr - 请求 URL
 * @param {object|number} [retriesOrHeaders=3] - 自定义 headers 或重试次数
 * @param {number} timeoutMs - 总超时
 * @returns {Promise<object>} 解析后的 JSON
 */
async function fetchJSON(urlStr, retriesOrHeaders = 3, timeoutMs) {
  let extraHeaders = {};
  if (typeof retriesOrHeaders === 'object' && retriesOrHeaders !== null) {
    extraHeaders = retriesOrHeaders;
  }
  const reqTimeout = typeof timeoutMs === 'number' ? timeoutMs : 20000;

  // 命中 Modrinth / CurseForge 前缀时构造镜像 URL
  let mirrorUrl = null;
  if (urlStr.startsWith(ctx.urls.MODRINTH_API)) {
    mirrorUrl = urlStr.replace(ctx.urls.MODRINTH_API, ctx.urls.MODRINTH_API_MIRROR);
  } else if (urlStr.startsWith(ctx.urls.CURSEFORGE_API)) {
    mirrorUrl = urlStr.replace(ctx.urls.CURSEFORGE_API, ctx.urls.CURSEFORGE_API_MIRROR);
  }

  const headers = { 'User-Agent': 'VersePC/2.0', 'Connection': 'keep-alive', ...extraHeaders };
  // BMCLAPI 请求节流：100ms 间隔，避免触发限流
  if (urlStr.includes('bmclapi')) {
    await _bmclapiThrottle();
  }
  const useMirror = mirrorUrl && _isMirrorAvailable();
  // 多步策略：镜像 8s → 官方 10s → 官方完整超时；不走镜像时官方 10s → 官方完整超时
  const steps = useMirror
    ? [{ url: mirrorUrl, t: 8000, isMirror: true }, { url: urlStr, t: Math.min(reqTimeout, 10000) }, { url: urlStr, t: reqTimeout }]
    : [{ url: urlStr, t: Math.min(reqTimeout, 10000) }, { url: urlStr, t: reqTimeout }];

  let lastErr = null;
  for (const step of steps) {
    try {
      const result = await _fetchOnce(step.url, headers, step.t);
      if (step.isMirror) _mirrorSuccess();
      return result;
    } catch (e) {
      lastErr = e;
      const status = e.httpStatus;
      // 403/404 直接抛出不重试（资源不存在或禁止访问，重试无效）
      if (status === 403 || status === 404) {
        throw e;
      }
      // BMCLAPI 的 403/429 不禁用镜像（高频率请求会返回，属正常现象）
      const isBmclapi = step.url.includes('bmclapi');
      if (step.isMirror && !((status === 403 || status === 429) && isBmclapi)) {
        _mirrorFailed();
      }
      console.warn(`[fetchJSON] ${step.url.substring(0, 80)}... 失败: ${e.message} (超时${step.t}ms)`);
    }
  }
  throw lastErr || new Error('fetchJSON failed: ' + urlStr.substring(0, 80));
}

/**
 * 带 TTL 缓存的 fetchJSON，相同 URL 在 TTL 内返回缓存结果
 * @param {string} urlStr - 请求 URL
 * @param {number} cacheTTL - 缓存有效期（毫秒）
 * @param {object|number} retriesOrHeaders - 重试次数或自定义 headers
 * @param {number} timeoutMs - 请求超时
 * @returns {Promise<object>} 解析后的 JSON
 */
function cachedFetchJSON(urlStr, cacheTTL, retriesOrHeaders, timeoutMs) {
  const cached = ctx.caches._apiCache.get(urlStr);
  if (cached && Date.now() - cached.ts < cacheTTL) return Promise.resolve(cached.data);
  return fetchJSON(urlStr, retriesOrHeaders, timeoutMs).then((data) => {
    ctx.caches._apiCache.set(urlStr, { data, ts: Date.now() });
    // 缓存项超过 2000 时清理过期项（TTL × 2 视为过期）
    if (ctx.caches._apiCache.size > 2000) {
      const now = Date.now();
      for (const [k, v] of ctx.caches._apiCache) {
        if (now - v.ts > cacheTTL * 2) ctx.caches._apiCache.delete(k);
      }
    }
    return data;
  });
}

/**
 * 拉取纯文本响应（不解析 JSON）
 * @param {string} urlStr - 请求 URL
 * @returns {Promise<string>} 文本内容
 */
function fetchText(urlStr) {
  return new Promise((resolve, reject) => {
    const mod = urlStr.startsWith('https') ? https : http;
    const req = mod.get(urlStr, { headers: { 'User-Agent': 'VersePC/1.0' }, timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
  });
}

/**
 * 多任务竞速：任一任务成功即返回，全部失败时抛 AggregateError
 * @param {Array<{fetchFn: () => Promise, label: string}>} tasks - 任务数组
 * @param {number} [timeout=15000] - 单任务超时
 * @returns {Promise<any>} 第一个成功的结果
 */
async function fetchWithRacing(tasks, timeout = 15000) {
  return Promise.any(tasks.map(async ({ fetchFn, label }) => {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout`)), timeout)
    );
    const result = await Promise.race([fetchFn(), timeoutPromise]);
    // 空结果视为失败，让 Promise.any 继续等其他任务
    if (!result || (Array.isArray(result) && result.length === 0)) {
      throw new Error(`${label} returned empty`);
    }
    return result;
  }));
}

/* HTTP GET (支持 Range / 重定向) */

/**
 * HTTP GET 请求，支持 Range、最多 5 次重定向
 * @param {string} urlStr - 请求 URL
 * @param {object} [opts={}] - 选项：start/end/timeout/headers/agent
 * @param {number} [_redirectCount=0] - 当前重定向次数（内部递归用）
 * @returns {Promise<{stream: import('http').IncomingMessage, statusCode: number, headers: object, contentLength: number, request: object}>}
 */
function httpGet(urlStr, opts = {}, _redirectCount = 0) {
  if (_redirectCount > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const isHttps = urlStr.startsWith('https');
    const mod = isHttps ? https : http;
    const agent = opts.agent || (isHttps ? ctx.httpAgents.SHARED_HTTPS_AGENT : ctx.httpAgents.SHARED_HTTP_AGENT);
    const headers = { 'User-Agent': 'VersePC/2.0', 'Connection': 'keep-alive', ...opts.headers };
    // 设置 Range 头用于分块下载
    if (opts.start !== undefined) {
      headers['Range'] = opts.end !== undefined ? `bytes=${opts.start}-${opts.end}` : `bytes=${opts.start}-`;
    }
    const req = mod.get(urlStr, { headers, agent }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.destroy();
        // 相对路径补全为绝对 URL
        const nu = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, urlStr).toString();
        return httpGet(nu, opts, _redirectCount + 1).then(resolve).catch(reject);
      }
      resolve({
        stream: res,
        statusCode: res.statusCode,
        headers: res.headers,
        contentLength: parseInt(res.headers['content-length'] || '0', 10),
        request: req,
        finalUrl: urlStr
      });
    });
    req.on('error', reject);
    req.setTimeout(opts.timeout || 30000, () => { req.destroy(); reject(new Error('Request timeout')); });
    // [关键修复 - 2026-07-27] 支持 abortSignal：连接阶段 stall 检测需要主动销毁请求
    // 场景：分块下载中，httpGet 等待响应头时可能卡住（服务器建立 TCP 但不返回数据），
    // 此时 stall 计时器（在 httpGet resolve 后才启动）无法触发。通过 abortSignal
    // 让调用方可以在 httpGet resolve 前销毁请求，实现连接阶段 stall 检测。
    if (opts.abortSignal) {
      const signal = opts.abortSignal;
      if (signal.aborted) {
        try { req.destroy(); } catch (_) {}
        reject(new Error('Aborted'));
        return;
      }
      const onAbort = () => {
        try { req.destroy(); } catch (_) {}
        reject(new Error('Aborted'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/* 带方法的 JSON 请求（POST/PUT 等） */

/**
 * 单次带方法的 JSON 请求（内部函数）：支持重定向、429 限流错误、4xx/5xx 错误
 * @param {string} urlStr - 请求 URL
 * @param {string} method - HTTP 方法（GET/POST/PUT/DELETE 等）
 * @param {string|Buffer} [body] - 请求体
 * @param {object} [headers] - 自定义请求头
 * @param {number} [_redirectCount=0] - 当前重定向次数（内部递归用）
 * @returns {Promise<object>} 解析后的 JSON
 */
function _fetchWithMethodOnce(urlStr, method, body, headers, _redirectCount) {
  if (!_redirectCount) _redirectCount = 0;
  return new Promise((resolve, reject) => {
    if (_redirectCount > 5) { reject(new Error('Too many redirects')); return; }
    const urlObj = new URL(urlStr);
    const isHttps = urlObj.protocol === 'https:';
    const mod = isHttps ? https : http;
    const agent = isHttps ? ctx.httpAgents.SHARED_HTTPS_AGENT : ctx.httpAgents.SHARED_HTTP_AGENT;
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      agent: agent,
      headers: {
        'User-Agent': 'VersePC/1.0 (Minecraft Launcher)',
        'Accept': 'application/json',
        ...(headers || {})
      }
    };
    const req = mod.request(options, (res) => {
      // 3xx 重定向：相对路径补全后递归请求
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
        res.resume();
        _fetchWithMethodOnce(redirectUrl, method, body, headers, _redirectCount + 1).then(resolve).catch(reject);
        return;
      }
      // 429 限流：返回带 retryAfter 的错误
      if (res.statusCode === 429) {
        let errData = '';
        res.on('data', (chunk) => (errData += chunk));
        res.on('end', () => {
          const retryAfter = parseInt(res.headers['retry-after'] || '5', 10);
          const err = new Error(`HTTP 429: 请求过于频繁，请等待 ${retryAfter} 秒后重试`);
          err.isRateLimit = true;
          err.retryAfter = retryAfter;
          reject(err);
        });
        return;
      }
      // 4xx/5xx：返回带 httpStatus 的错误
      if (res.statusCode >= 400) {
        let errData = '';
        res.on('data', (chunk) => (errData += chunk));
        res.on('end', () => {
          const err = new Error(`HTTP ${res.statusCode}: ${errData.substring(0, 200)}`);
          err.httpStatus = res.statusCode;
          reject(err);
        });
        return;
      }
      // 2xx：解析 JSON
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${e.message}, data: ${data.substring(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout: ' + urlStr)); });
    if (body) req.write(body);
    req.end();
  });
}

/**
 * 带自定义方法的 JSON 请求：支持重定向、429 限流错误、4xx/5xx 错误
 * 命中 Modrinth / CurseForge API 前缀时自动走镜像（与 fetchJSON 逻辑一致），
 * 镜像失败后回退官方源。
 * @param {string} urlStr - 请求 URL
 * @param {string} method - HTTP 方法（GET/POST/PUT/DELETE 等）
 * @param {string|Buffer} [body] - 请求体
 * @param {object} [headers] - 自定义请求头
 * @returns {Promise<object>} 解析后的 JSON
 */
async function fetchJSONWithMethod(urlStr, method, body, headers) {
  // 命中 Modrinth / CurseForge 前缀时构造镜像 URL
  let mirrorUrl = null;
  if (urlStr.startsWith(ctx.urls.MODRINTH_API)) {
    mirrorUrl = urlStr.replace(ctx.urls.MODRINTH_API, ctx.urls.MODRINTH_API_MIRROR);
  } else if (urlStr.startsWith(ctx.urls.CURSEFORGE_API)) {
    mirrorUrl = urlStr.replace(ctx.urls.CURSEFORGE_API, ctx.urls.CURSEFORGE_API_MIRROR);
  }

  const useMirror = mirrorUrl && _isMirrorAvailable();
  if (useMirror) {
    try {
      const result = await _fetchWithMethodOnce(mirrorUrl, method, body, headers, 0);
      _mirrorSuccess();
      return result;
    } catch (e) {
      const status = e.httpStatus;
      // 403/404 直接抛出不重试（资源不存在或禁止访问）
      if (status === 403 || status === 404) throw e;
      _mirrorFailed();
      console.warn(`[fetchJSONWithMethod] 镜像失败，回退官方: ${e.message} (${mirrorUrl.substring(0, 60)}...)`);
    }
  }
  return _fetchWithMethodOnce(urlStr, method, body, headers, 0);
}

/* 带 Bearer Token 的 JSON 请求 */

/**
 * 带 Bearer Token 的 HTTPS JSON 请求（用于微软账号等鉴权接口）
 * @param {string} urlStr - 请求 URL
 * @param {string} token - Bearer Token
 * @returns {Promise<object>} 解析后的 JSON
 */
function fetchJSONWithAuth(urlStr, token) {
  return new Promise((resolve, reject) => {
    const req = https.get(urlStr, {
      headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'VersePC/1.0' }
    }, (res) => {
      // 429 限流：返回带 retryAfter 的错误
      if (res.statusCode === 429) {
        let errData = '';
        res.on('data', (chunk) => (errData += chunk));
        res.on('end', () => {
          const retryAfter = parseInt(res.headers['retry-after'] || '5', 10);
          const err = new Error(`HTTP 429: 请求过于频繁，请等待 ${retryAfter} 秒后重试`);
          err.isRateLimit = true;
          err.retryAfter = retryAfter;
          reject(err);
        });
        return;
      }
      // 4xx/5xx：返回带 httpStatus 的错误
      if (res.statusCode >= 400) {
        let errData = '';
        res.on('data', (chunk) => (errData += chunk));
        res.on('end', () => {
          const err = new Error(`HTTP ${res.statusCode}: ${errData.substring(0, 200)}`);
          err.httpStatus = res.statusCode;
          reject(err);
        });
        return;
      }
      // 2xx：解析 JSON
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

module.exports = {
  fetchWithProtocol,
  _fetchOnce,
  cachedFetchJSON,
  fetchJSON,
  fetchText,
  fetchWithRacing,
  httpGet,
  fetchJSONWithMethod,
  fetchJSONWithAuth
};
