/**
 * @file server/http-client/download.js - 下载入口
 * @description 下载入口函数（按 host 选择分块/单流）、同步下载（curl/PowerShell）、下载到 Buffer、
 *   多线程分块下载、带镜像回退的下载入口。
 *   通过 ctx (../context) 访问共享状态，通过 utils (../utils) 访问工具函数，
 *   依赖 ./mirror（getMirrorUrls）、./download-chunked（downloadFileChunked）、./download-single（_dlSingle）。
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const ctx = require('../context');
const utils = require('../utils');
const { getMirrorUrls } = require('./mirror');
const { downloadFileChunked } = require('./download-chunked');
const { downloadFileH2, shouldTryH2 } = require('./download-h2');
const { _dlSingle } = require('./download-single');

/* 下载入口（根据 host 选择分块/单流） */

/**
 * 下载入口：NO_CHUNK_HOSTS 中的 host 走单流，其余走分块；分块失败回退单流
 * @param {string} urlStr - 下载 URL
 * @param {string} destPath - 目标文件路径
 * @param {Function} [onProgress] - 进度回调
 * @param {number} [retries=3] - 重试次数
 * @param {AbortSignal} [abortSignal=null] - 取消信号
 * @param {object} [opts={}] - 额外选项：{ stallTimeout, timeout }
 *   [关键修复 - 2026-07-27] 添加 opts 参数透传 stallTimeout/timeout
 *   避免分块失败回退到顺序 downloadFile 时丢失 stallTimeout，导致单流下载用默认 60s，
 *   CDN 节点卡死时要等 60s 才换源。
 * @returns {Promise<{size: number, path: string}>}
 */
function downloadFile(urlStr, destPath, onProgress, retries = 3, abortSignal = null, opts = {}) {
  const { stallTimeout = null, timeout = null, expectedSize = 0, sha1 = null, mirrors = null } = opts;
  // 构建 _dlSingle 选项：仅传入有效字段，避免污染默认值
  const singleOpts = { onProgress, retries, abortSignal };
  if (stallTimeout) singleOpts.stallTimeout = stallTimeout;
  if (timeout) singleOpts.timeout = timeout;
  // 构建 chunked 选项
  const chunkedOpts = { onProgress, retries, abortSignal };
  if (stallTimeout) chunkedOpts.stallTimeout = stallTimeout;
  if (timeout) chunkedOpts.timeout = timeout;

  if (ctx.constants.NO_CHUNK_HOSTS.some((d) => urlStr.includes(d))) return _dlSingle(urlStr, destPath, singleOpts);

  // 优先使用 XMCL 下载引擎（高性能分块 + 多镜像回退 + 测速换源）
  // 收集镜像 URL 列表
  let _xmclUrls = [urlStr];
  if (mirrors && Array.isArray(mirrors) && mirrors.length > 0) {
    _xmclUrls = mirrors;
  } else {
    try {
      const { getMirrorUrls } = require('./mirror');
      _xmclUrls = getMirrorUrls(urlStr);
    } catch (_) {}
  }
  const _xmclOpts = {
    onProgress,
    abortSignal,
    expectedSize: expectedSize || 0,
    maxChunks: 64,
    stallTimeout: stallTimeout || 180000,
  };
  if (sha1) _xmclOpts.sha1 = sha1;
  const { xmclDownload } = require('./xmcl-download');
  return xmclDownload(_xmclUrls, destPath, _xmclOpts).catch((err) => {
    if (abortSignal && abortSignal.aborted) throw err;
    console.warn(`[Download] XMCL 引擎失败，回退到 chunked: ${err.message}`);
    // 回退到现有 chunked → single 链路
    if (shouldTryH2(urlStr)) {
      return downloadFileH2(urlStr, destPath, { onProgress, abortSignal }).catch((err2) => {
        if (abortSignal && abortSignal.aborted) throw err2;
        return downloadFileChunked(urlStr, destPath, chunkedOpts).catch((err3) => {
          if (abortSignal && abortSignal.aborted) throw err3;
          return _dlSingle(urlStr, destPath, singleOpts);
        });
      });
    }
    return downloadFileChunked(urlStr, destPath, chunkedOpts).catch((err2) => {
      if (abortSignal && abortSignal.aborted) throw err2;
      return _dlSingle(urlStr, destPath, singleOpts);
    });
  });
}

/* 同步下载（curl / PowerShell 回退） */

/**
 * 同步下载：优先 curl，失败时 Windows 回退到 PowerShell Invoke-WebRequest
 * @param {string} urlStr - 下载 URL
 * @param {string} destPath - 目标文件路径
 */
function downloadFileSync(urlStr, destPath) {
  utils.ensureDirForFile(destPath);
  try {
    execSync(`curl --silent --location --output "${destPath}" "${urlStr}"`, { timeout: 30000, windowsHide: true, stdio: 'ignore' });
  } catch (e) {
    if (process.platform === 'win32') {
      execSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
        `try { Invoke-WebRequest -Uri '${urlStr.replace(/'/g, "''")}' -OutFile '${destPath.replace(/'/g, "''")}' -UseBasicParsing } catch { exit 1 }`],
      { timeout: 30000, windowsHide: true, stdio: 'ignore' });
    } else {
      throw new Error('curl failed and no fallback available: ' + e.message);
    }
  }
}

/**
 * 异步同步下载：curl 失败时 Windows 回退到 PowerShell
 * @param {string} urlStr - 下载 URL
 * @param {string} destPath - 目标文件路径
 * @returns {Promise<void>}
 */
function downloadFileSyncAsync(urlStr, destPath) {
  utils.ensureDirForFile(destPath);
  return new Promise((resolve, reject) => {
    exec(`curl --silent --location --retry 2 --connect-timeout 10 --max-time 120 --output "${destPath}" "${urlStr}"`,
      { timeout: 150000, windowsHide: true },
      (error) => {
        if (!error) return resolve();
        if (process.platform === 'win32') {
          exec(`powershell -NoProfile -NonInteractive -Command "try { Invoke-WebRequest -Uri '${urlStr.replace(/'/g, "''")}' -OutFile '${destPath.replace(/'/g, "''")}' -UseBasicParsing -TimeoutSec 120 } catch { exit 1 }"`,
            { timeout: 150000, windowsHide: true },
            (err2) => (err2 ? reject(err2) : resolve()));
        } else {
          reject(error);
        }
      }
    );
  });
}

/* 下载到 Buffer */

/**
 * 下载内容到内存 Buffer（支持重定向、进度回调）
 * @param {string} urlStr - 下载 URL
 * @param {Function} [onProgress] - 进度回调（0-1）
 * @param {number} [timeoutMs=15000] - 超时毫秒
 * @returns {Promise<Buffer>}
 */
function downloadFileToBuffer(urlStr, onProgress, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const protocol = urlStr.startsWith('https') ? https : http;
    const req = protocol.get(urlStr, { timeout: timeoutMs }, (response) => {
      // 3xx 重定向：换协议对象重新请求
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = response.headers.location;
        const redirectProtocol = redirectUrl.startsWith('https') ? https : http;
        redirectProtocol.get(redirectUrl, { timeout: timeoutMs }, (redirectRes) => {
          if (redirectRes.statusCode !== 200) {
            redirectRes.resume();
            reject(new Error(`HTTP ${redirectRes.statusCode}`));
            return;
          }
          const total = parseInt(redirectRes.headers['content-length']) || 0;
          const chunks = [];
          let received = 0;
          redirectRes.on('data', (chunk) => {
            chunks.push(chunk);
            received += chunk.length;
            if (total > 0 && onProgress) onProgress(received / total);
          });
          redirectRes.on('end', () => resolve(Buffer.concat(chunks)));
          redirectRes.on('error', reject);
        }).on('timeout', function () { this.destroy(); reject(new Error('redirect timeout')); })
          .on('error', reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      const total = parseInt(response.headers['content-length']) || 0;
      const chunks = [];
      let received = 0;
      response.on('data', (chunk) => {
        chunks.push(chunk);
        received += chunk.length;
        if (total > 0 && onProgress) onProgress(received / total);
      });
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('download timeout')); });
    req.on('error', reject);
  });
}

/* 多线程分块下载 */

/**
 * 多线程分块下载：先探测第 0 块判断是否支持 Range，支持则按 512KB 分块并发下载，
 *   不支持或失败时回退到单流；遍历镜像列表直到成功
 * @param {string[]} urls - 镜像 URL 列表
 * @param {string} destPath - 目标文件路径
 * @param {object} [opts] - onProgress / maxChunks / abortSignal / stallTimeout
 * @returns {Promise<{size: number, path: string}>}
 */
async function downloadMultiChunk(urls, destPath, { onProgress = null, maxChunks = 16, abortSignal = null, stallTimeout = 45000 } = {}) {
  // [CRITICAL] 下载前清理路径中与目录同名的文件。
  // 此函数不调用 ensureDir，需要自行处理 ENOTDIR 问题（同 ensureDir 的原理）。
  // [AI 自动生成警告] 请勿删除此处的文件清理块。
  {
    const d = path.dirname(destPath);
    try {
      for (const p of d.split(path.sep).map((_, i, a) => a.slice(0, i + 1).join(path.sep))) {
        if (p) { try { const s = await fs.promises.stat(p); if (!s.isDirectory()) await fs.promises.unlink(p); } catch (_) {} }
      }
    } catch (_) {}
    await fs.promises.mkdir(d, { recursive: true }).catch(() => {});
  }
  // 清理临时分块文件：.c0 ~ .c99 以及目标文件本身
  const cleanTemp = async (base) => {
    try { if (fs.existsSync(base)) await fs.promises.unlink(base); } catch (_) {}
    for (let i = 0; i < 100; i++) { try { await fs.promises.unlink(`${base}.c${i}`); } catch (_) {} }
  };
  // 带重定向跟随的 httpGet 封装（最多 10 层）
  const httpGetFollow = (u, opts, cb, depth = 0) => {
    if (depth > 10) { cb(null); return; }
    const mod = u.startsWith('https') ? https : http;
    const agent = u.startsWith('https') ? ctx.httpAgents.SHARED_HTTPS_AGENT : ctx.httpAgents.SHARED_HTTP_AGENT;
    const req = mod.get(u, { ...opts, agent }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const loc = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString();
        httpGetFollow(loc, opts, cb, depth + 1);
        return;
      }
      cb(res);
    });
    return req;
  };
  let lastErr = null;
  // 依次尝试每个镜像
  for (const url of urls) {
    if (abortSignal && abortSignal.aborted) throw new Error('下载已取消');
    try {
      await cleanTemp(destPath);
      let totalSize = 0;
      let chunkFailed = false;
      const chunkSize = 512 * 1024;
      // 探测第 0 块：用 Range:0-(chunkSize-1) 试探是否支持 206
      const tryChunk0 = await new Promise((resolve, reject) => {
        let settled = false;
        const done = (v) => { if (settled) return; settled = true; resolve(v); };
        const req = httpGetFollow(url, { headers: { 'User-Agent': 'VersePC/2.0', Range: `bytes=0-${chunkSize - 1}` } }, (res) => {
          if (!res) { done({ ok: false }); return; }
          if (res.statusCode === 206) {
            // 206：支持 Range，content-range 末段是文件总大小
            const cm = (res.headers['content-range'] || '').match(/\/(\d+)/);
            totalSize = cm ? parseInt(cm[1], 10) : 0;
            const ws = fs.createWriteStream(`${destPath}.c0`);
            let bytes = 0;
            res.on('data', (d) => { bytes += d.length; ctx.DownloadManager.recordProgress(d.length); });
            res.pipe(ws);
            ws.on('finish', () => { ws.close(); done({ ok: true, bytes }); });
            ws.on('error', () => { try { ws.destroy(); } catch (_) {} done({ ok: false }); });
            res.on('error', () => { try { ws.destroy(); } catch (_) {} done({ ok: false }); });
          } else if (res.statusCode === 200) {
            // 200：不支持 Range，走单流
            res.resume();
            const cl = parseInt(res.headers['content-length'] || '0', 10);
            done({ ok: false, single: true, totalSize: cl });
          } else {
            res.resume();
            done({ ok: false });
          }
        });
        if (req) { req.on('error', () => done({ ok: false })); req.on('timeout', () => { req.destroy(); done({ ok: false }); }); }
        if (abortSignal) abortSignal.addEventListener('abort', () => done({ ok: false }), { once: true });
        setTimeout(() => done({ ok: false }), 8000);
      });
      // 支持 Range 且文件 >8MB 且允许多块：进入分块下载
      if (tryChunk0.ok && totalSize > 8 * 1024 * 1024 && maxChunks > 1) {
        const chunkCount = Math.min(maxChunks, Math.ceil(totalSize / chunkSize));
        const chunks = [{ i: 0, s: 0, e: chunkSize - 1, tmp: `${destPath}.c0`, done: true, bytes: tryChunk0.bytes }];
        for (let i = 1; i < chunkCount; i++) {
          chunks.push({ i, s: i * chunkSize, e: Math.min((i + 1) * chunkSize - 1, totalSize - 1), tmp: `${destPath}.c${i}`, done: false, bytes: 0 });
        }
        const cProg = chunks.map((c) => c.bytes);
        let lastProg = Date.now();
        // 下载单个分块：占用连接配额、stall 检测、进度上报
        const dlChunk = async (c) => {
          if (abortSignal && abortSignal.aborted) throw new Error('下载已取消');
          while (!ctx.DownloadManager.acquireConnection()) {
            if (abortSignal && abortSignal.aborted) throw new Error('下载已取消');
            await new Promise((r) => setTimeout(r, 50));
          }
          try {
            let chunkBytes = 0;
            await new Promise((resolve, reject) => {
              let settled = false;
              const doneC = (err) => { if (settled) return; settled = true; if (err) reject(err); else resolve(); };
              const req = httpGetFollow(url, { headers: { 'User-Agent': 'VersePC/2.0', Range: `bytes=${c.s}-${c.e}` } }, (res) => {
                if (!res) { doneC(new Error('Too many redirects')); return; }
                if (res.statusCode !== 206 && res.statusCode !== 200) { res.resume(); doneC(new Error(`Chunk ${c.i} HTTP ${res.statusCode}`)); return; }
                const ws = fs.createWriteStream(c.tmp);
                let lastTime = Date.now();
                // stall 检测：stallTimeout 内无数据视为卡死
                const t = setInterval(() => {
                  if (Date.now() - lastTime > stallTimeout) { try { res.destroy(); ws.destroy(); } catch (_) {} clearInterval(t); doneC(new Error(`Chunk ${c.i} stall`)); }
                }, 10000);
                res.pipe(ws);
                res.on('data', (d) => {
                  chunkBytes += d.length;
                  cProg[c.i] = chunkBytes;
                  lastTime = Date.now();
                  ctx.DownloadManager.recordProgress(d.length);
                  // 节流：50ms 内最多触发一次进度
                  if (onProgress && Date.now() - lastProg > 50) {
                    lastProg = Date.now();
                    const total = cProg.reduce((a, b) => a + b, 0);
                    try { onProgress({ bytesDownloaded: total, totalBytes: totalSize, speed: ctx.DownloadManager.getSpeed(), progress: Math.min(99.9, (total / totalSize) * 100) }); } catch (_) {}
                  }
                });
                ws.on('finish', () => { clearInterval(t); ws.close(); doneC(null); });
                ws.on('error', (e) => { clearInterval(t); doneC(e); });
                res.on('error', (e) => { clearInterval(t); try { ws.destroy(); } catch (_) {} doneC(e); });
              });
              if (req) { req.on('error', (e) => doneC(e)); }
              if (abortSignal) abortSignal.addEventListener('abort', () => { try { if (req) req.destroy(); } catch (_) {} }, { once: true });
            });
          } finally {
            ctx.DownloadManager.releaseConnection();
          }
        };
        try {
          // 并发下载所有未完成的分块
          await Promise.all(chunks.filter((c) => !c.done).map((c) => dlChunk(c)));
          // 合并所有分块到目标文件
          await new Promise((resolve, reject) => {
            const ws = fs.createWriteStream(destPath);
            let idx = 0;
            const writeNext = () => {
              if (idx >= chunks.length) { ws.end(); return; }
              const rs = fs.createReadStream(chunks[idx].tmp);
              rs.on('end', () => { idx++; writeNext(); });
              rs.on('error', reject);
              rs.pipe(ws, { end: false });
            };
            ws.on('finish', () => {
              // 等待文件描述符完全关闭后再 resolve（Windows: 否则 EPERM 锁定源文件）
              const onClose = () => resolve();
              ws.on('close', onClose);
              try { ws.close(); } catch (_) { onClose(); }
              setTimeout(onClose, 2000);
            });
            ws.on('error', reject);
            writeNext();
          });
        } catch (e) {
          chunkFailed = true;
          console.warn(`[MultiChunk] 分块下载失败, 回退单流: ${e.message}`);
        } finally {
          // 清理所有分块临时文件
          for (const c of chunks) { try { await fs.promises.unlink(c.tmp); } catch (_) {} }
        }
      } else if (tryChunk0.single) {
        totalSize = tryChunk0.totalSize;
      } else {
        chunkFailed = true;
      }
      // 分块失败、文件不存在或 0 字节：回退单流下载
      if (chunkFailed || !fs.existsSync(destPath) || fs.statSync(destPath).size === 0) {
        await cleanTemp(destPath);
        await new Promise((resolve, reject) => {
          utils.ensureDir(destPath);
          const ws = fs.createWriteStream(destPath);
          let bytes = 0, lastTime = Date.now();
          let settled = false;
          const timer = setInterval(() => {
            if (Date.now() - lastTime > stallTimeout && totalSize > 0 && bytes < totalSize) {
              try { ws.destroy(); } catch (_) {}
              clearInterval(timer);
              if (!settled) { settled = true; reject(new Error('Stall')); }
            }
          }, 10000);
          const done = (err) => { if (settled) return; settled = true; clearInterval(timer); if (err) reject(err); else resolve(); };
          const req = httpGetFollow(url, { headers: { 'User-Agent': 'VersePC/2.0' } }, (res) => {
            if (!res) { try { ws.destroy(); } catch (_) {} done(new Error('Too many redirects')); return; }
            if (res.statusCode !== 200) { try { ws.destroy(); } catch (_) {} done(new Error(`HTTP ${res.statusCode}`)); return; }
            const cl = parseInt(res.headers['content-length'] || '0', 10);
            if (cl > 0 && totalSize === 0) totalSize = cl;
            res.pipe(ws);
            res.on('data', (c) => {
              bytes += c.length;
              lastTime = Date.now();
              ctx.DownloadManager.recordProgress(c.length);
              if (onProgress) try { onProgress({ bytesDownloaded: bytes, totalBytes: cl || totalSize, speed: ctx.DownloadManager.getSpeed(), progress: (cl || totalSize) > 0 ? Math.min(99.9, (bytes / (cl || totalSize)) * 100) : 0 }); } catch (_) {}
            });
            res.on('end', () => ws.end(() => done(null)));
            res.on('error', (e) => { try { ws.destroy(); } catch (_) {} done(e); });
          });
          if (req) { req.on('error', (e) => { try { ws.destroy(); } catch (_) {} done(e); }); }
          if (abortSignal) abortSignal.addEventListener('abort', () => { try { if (req) req.destroy(); ws.destroy(); } catch (_) {} }, { once: true });
        });
      }
      // 下载完成：上报 100% 进度并返回
      if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
        if (onProgress) try { onProgress({ bytesDownloaded: fs.statSync(destPath).size, totalBytes: totalSize || fs.statSync(destPath).size, speed: 0, progress: 100 }); } catch (_) {}
        return { size: fs.statSync(destPath).size, path: destPath };
      }
      throw new Error('文件为空');
    } catch (e) {
      lastErr = e;
      if (abortSignal && abortSignal.aborted) throw e;
      // 当前镜像失败：切下一个镜像
      console.warn(`[MultiChunk] ${url.substring(0, 60)} 失败: ${e.message}`);
      await cleanTemp(destPath);
      continue;
    }
  }
  // 所有镜像都失败
  throw lastErr || new Error('所有下载源均失败');
}

/* 辅助：磁盘空间校验（仅对大文件执行） */

/**
 * 检查目标磁盘可用空间是否足够
 * 仅当所需字节数 > 50MB 时才执行，避免对小文件做无谓的系统调用
 * @param {string} destPath - 目标文件路径
 * @param {number} requiredBytes - 所需字节数
 * @throws {Error} 空间不足时抛出明确错误
 */
async function _checkDiskSpace(destPath, requiredBytes) {
  // 50MB 以下不校验
  if (!requiredBytes || requiredBytes <= 50 * 1024 * 1024) return;
  try {
    const dir = path.dirname(destPath);
    // 确保目录存在，否则 statfs 会失败
    if (!fs.existsSync(dir)) {
      try { await fs.promises.mkdir(dir, { recursive: true }); } catch (_) {}
    }
    let freeBytes = -1;
    // 优先用 fs.statfs（Node 18.15+ 支持）
    if (typeof fs.statfs === 'function' || typeof fs.statfsSync === 'function') {
      try {
        const s = fs.statfsSync(dir);
        freeBytes = s.bavail * s.bsize;
      } catch (_) {}
    }
    // 回退：Windows 用 wmic 查询逻辑盘可用空间
    if (freeBytes < 0 && process.platform === 'win32') {
      try {
        const drive = dir.charAt(0).toUpperCase();
        const out = execSync(`wmic logicaldisk where "DeviceID='${drive}:'" get FreeSpace /value`,
          { windowsHide: true, timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
        const m = out.match(/FreeSpace=(\d+)/);
        if (m) freeBytes = parseInt(m[1], 10);
      } catch (_) {}
    }
    if (freeBytes >= 0 && freeBytes < requiredBytes) {
      const needMB = Math.ceil(requiredBytes / 1024 / 1024);
      const freeMB = Math.floor(freeBytes / 1024 / 1024);
      throw new Error(`磁盘空间不足，需要 ${needMB} MB，可用 ${freeMB} MB`);
    }
  } catch (e) {
    // 仅传播磁盘空间不足的错误，其他错误（如 statfs 不可用）不阻塞下载
    if (e && e.message && e.message.includes('磁盘空间不足')) throw e;
  }
}

/* 辅助：在多个 MC 版本目录中按 Hash 查找已存在的 mod 文件 */

/**
 * 在 VERSIONS_DIR 下所有版本目录的 mods 子目录中查找同名且同 Hash 的 mod 文件
 * 找到则复制到目标位置，避免重复下载
 * @param {string} destPath - 目标文件路径
 * @param {number} [expectedSize] - 期望文件大小（可选）
 * @param {string} [expectedSha1] - 期望 SHA1（可选）
 * @returns {Promise<{size: number, path: destPath, reused: boolean} | null>}
 */
async function _findExistingModInVersions(destPath, expectedSize, expectedSha1) {
  // 仅对 mods 目录下的 .jar 文件适用
  const norm = destPath.replace(/\//g, path.sep);
  if (!norm.includes(path.sep + 'mods' + path.sep)) return null;
  if (!destPath.toLowerCase().endsWith('.jar')) return null;

  const fileName = path.basename(destPath);
  const versionsDir = ctx.dirs.VERSIONS_DIR;
  if (!versionsDir) return null;

  let versions;
  try { await fs.promises.access(versionsDir); versions = await fs.promises.readdir(versionsDir); }
  catch (_) { return null; }

  for (const ver of versions) {
    const candidate = path.join(versionsDir, ver, 'mods', fileName);
    try {
      const stat = await fs.promises.stat(candidate);
      if (stat.size === 0) continue;
      // 大小不匹配直接跳过
      if (expectedSize && stat.size !== expectedSize) continue;
      // 大小匹配但未提供 SHA1：保守起见仍要求 SHA1 校验通过才复用
      if (!expectedSha1) continue;
      let actualSha1;
      try { actualSha1 = await utils.calculateSHA1(candidate); }
      catch (_) { continue; }
      if (actualSha1 !== expectedSha1) continue;
      // 找到匹配文件，复制到目标位置
      utils.ensureDirForFile(destPath);
      await fs.promises.copyFile(candidate, destPath);
      console.log(`[Download] 在版本 ${ver} 的 mods 中找到匹配文件，复用: ${fileName}`);
      return { size: stat.size, path: destPath, reused: true };
    } catch (_) { continue; }
  }
  return null;
}

/* 带镜像回退的下载入口 */

/**
 * 带镜像回退的下载入口：已存在且完整则跳过；小资源走单流；大资源优先分块，失败回退顺序遍历镜像
 * @param {string} urlStr - 原始下载 URL
 * @param {string} destPath - 目标文件路径
 * @param {Function} [onProgress] - 进度回调
 * @param {number} [retries=3] - 重试次数
 * @param {AbortSignal} [abortSignal=null] - 取消信号
 * @param {number} [customTimeout=null] - 自定义超时
 * @returns {Promise<{size: number, path: string, skipped?: boolean}>}
 */
async function downloadFileWithMirror(urlStr, destPath, onProgress, retries = 3, abortSignal = null, customTimeout = null, customStallTimeout = null, expectedSize = null, expectedSha1 = null) {
  const allUrls = getMirrorUrls(urlStr);

  // [P1-7] 多 MC 文件夹已存在文件查找：mod 文件按 Hash 匹配复用
  // 仅对 mods 目录下的 .jar 文件适用，libraries/assets 不走此路径
  if (expectedSha1 && destPath.toLowerCase().endsWith('.jar') &&
      (destPath.includes('/mods/') || destPath.includes('\\mods\\'))) {
    try {
      const reused = await _findExistingModInVersions(destPath, expectedSize, expectedSha1);
      if (reused) {
        if (onProgress) try { onProgress({ bytesDownloaded: reused.size, totalBytes: reused.size, speed: 0, progress: 100 }); } catch (_) {}
        return reused;
      }
    } catch (_) {}
  }

  // [P2-14] 文件 >50MB 磁盘空间校验，避免大文件下载到一半才发现空间不足
  if (expectedSize && expectedSize > 50 * 1024 * 1024) {
    await _checkDiskSpace(destPath, expectedSize);
  }

  // 已存在且完整：直接跳过；JAR 损坏则删除重下
  // 若调用方提供了 expectedSize/expectedSha1，严格校验大小和哈希，不匹配则删除重下
  try {
    const stat = await fs.promises.stat(destPath);
    if (stat.size > 0) {
      const isJarFile = destPath.endsWith('.jar');
      let needRedownload = false;
      if (isJarFile && !utils.isJarIntact(destPath)) {
        needRedownload = true;
      } else if (expectedSize && stat.size !== expectedSize) {
        console.warn(`[Download] 已存在文件大小不匹配，重新下载: ${destPath.split(/[\\/]/).pop()} (期望=${expectedSize}, 实际=${stat.size})`);
        needRedownload = true;
      }
      // 异步校验 SHA1（仅在调用方提供时）
      if (!needRedownload && expectedSha1) {
        try {
          const actualSha1 = await utils.calculateSHA1(destPath);
          if (actualSha1 !== expectedSha1) {
            console.warn(`[Download] 已存在文件 SHA1 不匹配，重新下载: ${destPath.split(/[\\/]/).pop()}`);
            needRedownload = true;
          }
        } catch (e) {
          console.warn(`[Download] SHA1 校验失败，保守起见重新下载: ${e.message}`);
          needRedownload = true;
        }
      }
      if (needRedownload) {
        await fs.promises.unlink(destPath).catch(() => {});
      } else {
        return { size: stat.size, path: destPath, skipped: true };
      }
    }
  } catch (e) {}

  // 小资源（assets 目录下非 jar 文件）走单流，避免分块开销
  const isSmallAsset = (destPath.includes('/assets/') || destPath.includes('\\assets\\')) && !destPath.endsWith('.jar');
  if (isSmallAsset) {
    return _dlSingle(urlStr, destPath, { onProgress, retries, abortSignal, timeout: customTimeout || 30000, stallTimeout: 60000 });
  }

  // [P0 OPT - 2026-07-21] libraries 目录下文件直接走单流，跳过 downloadFileChunked 的 probe 探测
  // 原因：库文件通常 100KB-5MB，分块收益小，但 probe 探测每个 URL 2000ms 超时，
  // 64 个库文件 × 2s probe = 128s 开销（实际观察 24s 是因为部分文件命中缓存或快速响应）。
  // 直接顺序尝试镜像列表，保留 JAR 完整性校验和 fallback 逻辑。
  // 基准测试：1.20.2 libraries 阶段 24s → 优化后预期 5-8s
  const isLibraryFile = destPath.includes('/libraries/') || destPath.includes('\\libraries\\');
  if (isLibraryFile) {
    let _libLastErr = null;
    for (const tryUrl of allUrls) {
      if (abortSignal && abortSignal.aborted) throw new Error('下载已中止');
      try {
        const result = await _dlSingle(tryUrl, destPath, {
          onProgress,
          retries,
          abortSignal,
          timeout: customTimeout || 60000,
          stallTimeout: 30000  // 库文件小，30s stall 足够
        });
        // 单流下载后校验 JAR 完整性
        if (destPath.endsWith('.jar') && !utils.isJarIntact(destPath)) {
          await fs.promises.unlink(destPath).catch(() => {});
          _libLastErr = new Error(`Downloaded JAR is corrupt: ${tryUrl}`);
          continue;
        }
        return result;
      } catch (e) {
        if (abortSignal && abortSignal.aborted) throw e;
        _libLastErr = e;
      }
    }
    throw _libLastErr || new Error('所有下载源均失败');
  }

  // 非 NO_CHUNK_HOSTS：优先使用 XMCL 引擎，失败回退到分块
  if (!ctx.constants.NO_CHUNK_HOSTS.some((d) => urlStr.includes(d))) {
    try {
      const { xmclDownload } = require('./xmcl-download');
      const _xmclOpts = {
        onProgress,
        abortSignal,
        expectedSize: expectedSize || 0,
        maxChunks: 64,
        stallTimeout: customStallTimeout || 180000,
      };
      if (expectedSha1) _xmclOpts.sha1 = expectedSha1;
      const result = await xmclDownload(allUrls, destPath, _xmclOpts);
      // 下载后再次校验 JAR 完整性
      if (destPath.endsWith('.jar') && !utils.isJarIntact(destPath)) {
        await fs.promises.unlink(destPath).catch(() => {});
        throw new Error('XMCL download produced invalid JAR');
      }
      return result;
    } catch (e) {
      if (abortSignal && abortSignal.aborted) throw e;
      console.warn(`[Download] XMCL 引擎失败，回退 chunked: ${e.message}`);
      // 回退到原 chunked
      try {
        const chunkOpts = { onProgress, retries, mirrors: allUrls, abortSignal };
        if (customTimeout) chunkOpts.timeout = customTimeout;
        if (customStallTimeout) chunkOpts.stallTimeout = customStallTimeout;
        const result = await downloadFileChunked(urlStr, destPath, chunkOpts);
        if (destPath.endsWith('.jar') && !utils.isJarIntact(destPath)) {
          await fs.promises.unlink(destPath).catch(() => {});
          throw new Error('Chunked download produced invalid JAR');
        }
        return result;
      } catch (e2) {
        if (abortSignal && abortSignal.aborted) throw e2;
      }
    }
  }

  // 分块失败：顺序遍历镜像列表逐个尝试
  // [关键修复 - 2026-07-27] 传递 stallTimeout/timeout 到 downloadFile，避免回退路径丢失参数
  const _seqOpts = {};
  if (customStallTimeout) _seqOpts.stallTimeout = customStallTimeout;
  if (customTimeout) _seqOpts.timeout = customTimeout;
  let lastError = null;
  for (const tryUrl of allUrls) {
    if (abortSignal && abortSignal.aborted) throw new Error('下载已中止');
    try {
      const result = await downloadFile(tryUrl, destPath, onProgress, retries, abortSignal, _seqOpts);
      // 顺序下载后 JAR 损坏：切下一个镜像
      if (destPath.endsWith('.jar') && !utils.isJarIntact(destPath)) {
        await fs.promises.unlink(destPath).catch(() => {});
        lastError = new Error(`Downloaded JAR is corrupt: ${tryUrl}`);
        continue;
      }
      return result;
    } catch (e) {
      if (abortSignal && abortSignal.aborted) throw e;
      lastError = e;
    }
  }
  throw lastError;
}

/* 多源并发竞速下载 */

/**
 * 多源并发竞速下载：同时向所有镜像发起请求，谁先返回完整文件用谁，其余的立即取消。
 *
 * 实现思路：
 *   1. 用 Promise.race 让所有镜像同时跑 _dlSingle
 *   2. 每个镜像写到独立的临时文件（避免多源写同一文件冲突）
 *   3. 第一个成功的立即原子重命名为目标文件，其余通过 AbortSignal 取消
 *   4. 全部失败则抛出最后一个错误
 *
 * 适用场景：CurseForge/Modrinth mod 文件下载（通常 <10MB，多镜像并发收益大）
 *
 * @param {string[]} urls - 镜像 URL 列表（至少 1 个）
 * @param {string} destPath - 目标文件路径
 * @param {object} [opts] - onProgress / retries / abortSignal / stallTimeout / timeout
 * @returns {Promise<{size: number, path: string, winnerUrl: string}>}
 */
async function downloadFileRace(urls, destPath, opts = {}) {
  const { onProgress = null, retries = 2, abortSignal = null, stallTimeout = 45000, timeout = 60000 } = opts;
  if (!urls || urls.length === 0) throw new Error('downloadFileRace: urls 为空');

  // XMCL 引擎：多 URL 回退 + 64 线程分块，比竞速更高效
  // XMCL 内部会自动选择最快的镜像，慢速自动换源
  const { xmclDownload } = require('./xmcl-download');
  try {
    const result = await xmclDownload(urls, destPath, {
      onProgress,
      abortSignal,
      maxChunks: 64,
      stallTimeout,
    });
    return { ...result, winnerUrl: urls[0] };
  } catch (e) {
    if (abortSignal && abortSignal.aborted) throw e;
    console.warn(`[Download] XMCL 竞速失败，回退到单流: ${e.message}`);
    // 回退到单源单流
    const r = await _dlSingle(urls[0], destPath, { onProgress, retries, abortSignal, stallTimeout, timeout });
    return { ...r, winnerUrl: urls[0] };
  }
}

module.exports = {
  downloadFile,
  downloadFileSync,
  downloadFileSyncAsync,
  downloadFileToBuffer,
  downloadMultiChunk,
  downloadFileWithMirror,
  downloadFileRace
};
