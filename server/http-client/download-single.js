/**
 * @file server/http-client/download-single.js - 单流下载
 * @description 支持续传、SHA1 校验、JAR 完整性校验、stall 超时检测。
 *   通过 ctx (../context) 访问共享状态，通过 utils (../utils) 访问工具函数，依赖 ./file-ops 的安全重命名/删除。
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const ctx = require('../context');
const utils = require('../utils');
const { safeRename, _tryRemoveFile } = require('./file-ops');

// [DIAG - Size mismatch 调试] 把诊断日志写入文件，便于追踪
const _diagLogPath = path.join(process.env.USERPROFILE || process.env.HOME || '', '.versepc', 'logs', 'dl-single-diag.log');
function _diagLog(msg) {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(_diagLogPath, line);
  } catch (_) {}
}

/**
 * 记录连接建立耗时，用于计算自适应超时
 * @param {number} elapsedMs - 从 req 发出到收到 response headers 的时间
 */
function _recordConnectTime(elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return;
  const samples = ctx.caches._connectTimeSamples;
  samples.push(elapsedMs);
  if (samples.length > ctx.caches._CONNECT_SAMPLES_MAX) samples.shift();
  // 移动平均
  const sum = samples.reduce((a, b) => a + b, 0);
  ctx.caches._connectAvg = Math.round(sum / samples.length);
}

/**
 * 计算自适应超时
 * 基于最近连接平均耗时，慢源给更长超时，快源快速失败
 * 公式：clamp(connectAvg * 4, 15s, 60s) * (1 + 失败次数 * 0.5)
 * @param {number} failCount - 当前已失败次数（0 = 首次尝试）
 * @param {number} [defaultTimeout=60000] - 默认超时（无样本时使用）
 * @returns {number} 超时毫秒
 */
function _adaptiveTimeout(failCount = 0, defaultTimeout = 60000) {
  const avg = ctx.caches._connectAvg || 1500;
  // 首次尝试：基于平均连接耗时计算基础超时
  // connectAvg 1.5s → base 6s（快源快速失败）
  // connectAvg 5s   → base 20s（慢源给足时间）
  // connectAvg 10s  → base 40s
  let base = avg * 4;
  // clamp 到 [15s, 60s]，避免极端值
  base = Math.min(Math.max(base, 15000), 60000);
  // 失败重试时按 1+0.5n 放宽，最多 2.5x
  const multiplier = 1 + Math.min(failCount, 3) * 0.5;
  return Math.round(base * multiplier);
}

/**
 * 单流下载：支持续传、SHA1 校验、JAR 完整性校验、stall 超时检测
 * @param {string} urlStr - 下载 URL
 * @param {string} destPath - 目标文件路径
 * @param {object} [options={}] - onProgress / sha1 / timeout / retries / abortSignal / stallTimeout / agent
 * @returns {Promise<{size: number, path: string}>}
 */
async function _dlSingle(urlStr, destPath, options = {}) {
  const { onProgress = null, sha1 = null, timeout = 60000, retries = 3, abortSignal = null, stallTimeout = 60000, agent: customAgent = null } = options;
  const isHttps = urlStr.startsWith('https');
  const agent = customAgent || (isHttps ? ctx.httpAgents.SHARED_HTTPS_AGENT : ctx.httpAgents.SHARED_HTTP_AGENT);
  // 等待连接数配额
  while (!ctx.DownloadManager.acquireConnection()) {
    if (abortSignal && abortSignal.aborted) throw new Error('下载已中止');
    // [P0 FIX - 2026-07-21] 轮询间隔从 50ms 缩短到 10ms
    // 50ms 在高并发下会累积延迟：16 个 mod 等待 1 个连接释放，平均浪费 25ms
    // 10ms 让连接释放被更快感知，提升并发效率
    await new Promise((r) => setTimeout(r, 10));
  }
  const tmpPath = destPath + '.downloading';
  let settled = false;
  try {
    if (abortSignal && abortSignal.aborted) throw new Error('下载已中止');
    return await new Promise((resolve, reject) => {
      const doReject = (e) => { if (!settled) { settled = true; reject(e); } };
      const doResolve = (v) => { if (!settled) { settled = true; resolve(v); } };
      let currentAbortHandler = null;
      const removeAbortListener = () => {
        if (currentAbortHandler && abortSignal) {
          try { abortSignal.removeEventListener('abort', currentAbortHandler); } catch (_) {}
          currentAbortHandler = null;
        }
      };
      // 单次尝试：rc 为剩余重试次数
      const attempt = (rc) => {
        if (settled) return;
        if (abortSignal && abortSignal.aborted) { doReject(new Error('下载已中止')); return; }
        removeAbortListener();
        const mod = urlStr.startsWith('https') ? https : http;
        utils.ensureDir(destPath);
        const reqHeaders = { 'User-Agent': 'VersePC/2.0', 'Connection': 'keep-alive' };
        // 自适应超时：基于最近连接平均耗时动态计算
        // 失败次数 = retries - rc（已失败次数）
        const failCount = retries - rc;
        const adaptiveTimeoutMs = _adaptiveTimeout(failCount, timeout);
        // 记录本次连接建立时间，用于更新统计
        const attemptStartTime = Date.now();
        // 检测续传偏移：临时文件已存在且非空时从其大小续传
        let resumeOffset = 0;
        try {
          if (fs.existsSync(tmpPath)) {
            const stat = fs.statSync(tmpPath);
            if (stat.size > 0) resumeOffset = stat.size;
          }
        } catch (_) {}
        if (resumeOffset > 0) {
          reqHeaders['Range'] = `bytes=${resumeOffset}-`;
        }
        _diagLog(`ATTEMPT rc=${rc} url=${urlStr.substring(0,120)} resumeOffset=${resumeOffset} tmpPath=${path.basename(tmpPath)}`);
        let ws = null;
        let cleaned = false;
        let stallTimer = null;
        // [关键修复 - 2026-07-27] 连接阶段 stall 计时器
        // 问题：req.setTimeout 基于 socket idle，TCP keep-alive 包会阻止其触发，
        //   导致服务器建立连接但不返回响应头时无限期卡住（Patchouli/YungsBetterStrongholds 卡 16 分钟）。
        // 方案：独立的 setTimeout 计时器，不依赖 socket 状态，stallTimeout 内未收到 res 回调则 abort。
        let connectStallTimer = null;
        // keepTmp=true 时保留临时文件供续传，keepTmp=false 时删除
        const clean = (keepTmp = false) => {
          if (cleaned) return;
          cleaned = true;
          try { if (ws) ws.destroy(); } catch (_) {}
          if (!keepTmp) _tryRemoveFile(tmpPath);
          _tryRemoveFile(destPath);
          if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
          if (connectStallTimer) { clearTimeout(connectStallTimer); connectStallTimer = null; }
          // [P0 OPT - 2026-07-21] 清理低速检测计时器
          if (lowSpeedTimer) { clearInterval(lowSpeedTimer); lowSpeedTimer = null; }
        };
        // stall 检测：stallTimeout 内无数据视为卡死
        const resetStall = () => {
          if (stallTimer) clearTimeout(stallTimer);
          stallTimer = setTimeout(() => {
            if (!settled && !cleaned) {
              try { if (onProgress) onProgress({ bytesDownloaded: resumeOffset, totalBytes: 0, speed: 0, progress: 0, chunks: 1, activeChunks: 1, stall: true }); } catch (_) {}
              try { req.destroy(); } catch (_) {}
              clean(true); // 保留临时文件供续传
              if (rc > 0) {
                setTimeout(() => attempt(rc - 1), 1000);
              } else {
                doReject(new Error(`Stall timeout: ${urlStr}`));
              }
            }
          }, stallTimeout);
        };
        // [P0 OPT - 2026-07-21] 低速检测：解决 CDN "滴漏"问题
        // 问题：CDN 节点慢速滴漏（如 10KB/s），每秒都有数据进来重置 stall 计时器，
        // 导致 stall 永远不触发，单个 mod 卡 240s+ 不换源。
        // 修复：每 10 秒检查一次平均速度，低于 50KB/s 视为低速，换源重试。
        // 用低速检测代替双源竞速，达到类似换源效果
        let lowSpeedCheckBytes = resumeOffset;
        let lowSpeedTimer = null;
        let totalDownloaded = resumeOffset;  // 提升到外层，供低速检测访问
        let totalSize = 0;                    // 提升到外层
        const LOW_SPEED_THRESHOLD = 20 * 1024;  // 20KB/s（降低阈值避免误判）
        const LOW_SPEED_CHECK_INTERVAL = 15000; // 15秒检查一次（给慢启动更多时间）
        const startLowSpeedCheck = () => {
          if (lowSpeedTimer) clearInterval(lowSpeedTimer);
          lowSpeedCheckBytes = totalDownloaded;
          lowSpeedTimer = setInterval(() => {
            if (settled || cleaned) {
              if (lowSpeedTimer) { clearInterval(lowSpeedTimer); lowSpeedTimer = null; }
              return;
            }
            const receivedInWindow = totalDownloaded - lowSpeedCheckBytes;
            const speedBps = receivedInWindow / (LOW_SPEED_CHECK_INTERVAL / 1000);
            lowSpeedCheckBytes = totalDownloaded;
            // 速度低于阈值且已经下载过一些数据（避免刚启动时误判）
            // [P0 OPT - 2026-07-21] 阈值降低到 20KB/s，避免慢速但正常的下载被误判
            if (speedBps < LOW_SPEED_THRESHOLD && totalDownloaded > 200 * 1024) {
              console.warn(`[LowSpeed] ${urlStr.substring(0, 60)} 速度 ${Math.round(speedBps/1024)}KB/s 低于 50KB/s，换源`);
              try { if (onProgress) onProgress({ bytesDownloaded: totalDownloaded, totalBytes: totalSize, speed: speedBps, progress: totalSize > 0 ? (totalDownloaded / totalSize * 100) : 0, chunks: 1, activeChunks: 1, lowSpeed: true }); } catch (_) {}
              try { req.destroy(); } catch (_) {}
              if (lowSpeedTimer) { clearInterval(lowSpeedTimer); lowSpeedTimer = null; }
              clean(true); // 保留临时文件供续传
              if (rc > 0) {
                setTimeout(() => attempt(rc - 1), 500);
              } else {
                doReject(new Error(`Low speed: ${Math.round(speedBps/1024)}KB/s`));
              }
            }
          }, LOW_SPEED_CHECK_INTERVAL);
        };
        currentAbortHandler = () => {
          try { req.destroy(); } catch (_) {}
          clean(false); // 用户取消，删除临时文件
          doReject(new Error('下载已中止'));
        };
        if (abortSignal) {
          if (abortSignal.aborted) { currentAbortHandler(); return; }
          abortSignal.addEventListener('abort', currentAbortHandler, { once: true });
        }
        // [关键修复 - 2026-07-27] 不再在 attempt 开始时启动 stall 检测
        // 原因：stall 检测 (15-20s) 与 req.setTimeout (adaptiveTimeout 15-60s) 同时启动，
        // adaptiveTimeout 总是先触发，调用 clean(true) 清除 stallTimer，导致 stall 检测
        // 形同虚设。修改为：连接阶段由 req.setTimeout 管，数据传输阶段（res 回调后）才启动 stall。
        const req = mod.get(urlStr, { headers: reqHeaders, agent }, (res) => {
          // 记录连接建立耗时（从请求发出到收到响应头）
          _recordConnectTime(Date.now() - attemptStartTime);
          if (settled) { res.destroy(); return; }
          if (abortSignal && abortSignal.aborted) { res.destroy(); clean(false); doReject(new Error('下载已中止')); return; }
          _diagLog(`RESP statusCode=${res.statusCode} contentLen=${res.headers['content-length']} contentRange=${res.headers['content-range']||''} location=${res.headers.location||''} url=${urlStr.substring(0,80)}`);
          // 3xx 重定向：递归请求新 URL
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            clean(false); // 重定向到新 URL，删除临时文件
            const nu = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, urlStr).toString();
            _diagLog(`REDIRECT ${urlStr.substring(0,80)} -> ${nu.substring(0,120)} rc=${rc}`);
            return _dlSingle(nu, destPath, { onProgress, sha1, timeout, retries: rc, abortSignal, stallTimeout }).then(doResolve).catch(doReject);
          }
          // 206 = 续传成功，追加写入；200 = 服务器不支持续传，覆盖写入
          const isResume = (res.statusCode === 206 && resumeOffset > 0);
          // [关键修复] 续传时收到 404：CurseForge CDN 不支持 Range 请求，返回 404 而非 416
          // 此时删除临时文件，从头重试（递归调用 attempt）
          if (res.statusCode === 404 && resumeOffset > 0) {
            res.destroy();
            clean(false); // 删除临时文件
            if (rc > 0) {
              console.warn(`[Single] 续传收到 404，从头重试: ${urlStr.substring(0, 60)}`);
              setTimeout(() => attempt(rc - 1), 1000);
              return;
            }
            doReject(new Error(`HTTP 404 for ${urlStr}`));
            return;
          }
          if (res.statusCode !== 200 && res.statusCode !== 206) { clean(false); doReject(new Error(`HTTP ${res.statusCode} for ${urlStr}`)); return; }
          // 服务器返回 200 而非 206 时，忽略续传偏移，从头下载
          if (resumeOffset > 0 && !isResume) {
            resumeOffset = 0;
          }
          // 206 响应的 content-length 是剩余字节数，总大小需加上 resumeOffset
          const contentLen = parseInt(res.headers['content-length'] || '0', 10);
          const tSz = isResume ? (resumeOffset + contentLen) : contentLen;
          totalSize = tSz;  // 供低速检测访问
          // [DIAG] 诊断 Size mismatch 问题：记录 content-length 和重定向信息
          console.log(`[Single-DIAG] ${path.basename(destPath)} | url=${urlStr.substring(0, 80)} | status=${res.statusCode} | contentLen=${contentLen} | tSz=${tSz} | isResume=${isResume} | resumeOffset=${resumeOffset}`);
          let dl = resumeOffset;
          totalDownloaded = dl;
          ws = fs.createWriteStream(tmpPath, isResume ? { flags: 'a' } : {});
          // [关键修复 - 2026-07-27] 连接已建立，启动 stall 检测和低速检测
          // 之前在 attempt 开始时启动，被 req.setTimeout 抢先清除，导致 stall 检测失效。
          // 现在改在 res 回调后启动，确保数据传输阶段 stall 能正确触发。
          // 同时把 req.setTimeout 延长到 stallTimeout 的 2 倍，作为兜底（防止 stall 检测 bug 时卡死）
          resetStall();
          startLowSpeedCheck();
          // 数据传输阶段：socket 超时设为 stallTimeout 的 2 倍，让 stall 检测先触发
          // 场景：stallTimeout=15s 时，socket 超时 30s。stall 在 15s 触发清理 + 重试，
          // socket 超时永远不触发（除非 stall 检测 bug）。这样 adaptiveTimeout 不再抢先清除 stallTimer。
          req.setTimeout(stallTimeout * 2 + 5000, () => {
            try { req.destroy(); } catch (_) {}
            clean(true); // 保留临时文件供续传
            if (settled) return;
            if (rc > 0) { setTimeout(() => attempt(rc - 1), 2000); }
            else { doReject(new Error(`Socket timeout after response (stallTimeout=${stallTimeout}ms): ${urlStr}`)); }
          });
          res.on('data', (ch) => {
            if (settled) { res.destroy(); return; }
            dl += ch.length;
            totalDownloaded = dl;  // 同步到外层供低速检测访问
            ctx.DownloadManager.recordProgress(ch.length);
            resetStall();
            // 注意：低速检测不在这里重置，它独立按 10 秒窗口计算
            try { if (onProgress) onProgress({ bytesDownloaded: dl, totalBytes: tSz, speed: ctx.DownloadManager.getSpeed(), progress: tSz > 0 ? (dl / tSz * 100) : 0, chunks: 1, activeChunks: 1 }); } catch (_) {}
          });
          res.pipe(ws);
          res.on('error', (e) => {
            try { ws.destroy(); } catch (_) {}
            clean(true); // 保留临时文件供续传
            if (settled) return;
            if (rc > 0) { setTimeout(() => attempt(rc - 1), 1000 + Math.random() * 500); }
            else { doReject(e); }
          });
          ws.on('finish', async () => {
            try {
              if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
              // [DIAG] 诊断 Size mismatch：记录 finish 时的字节数
              console.log(`[Single-DIAG-FINISH] ${path.basename(destPath)} | dl=${dl} | tSz=${tSz} | match=${dl === tSz} | rc=${rc}`);
              _diagLog(`FINISH dl=${dl} tSz=${tSz} match=${dl===tSz} rc=${rc} tmpPathSize=${fs.existsSync(tmpPath)?fs.statSync(tmpPath).size:-1}`);
              // 等待文件描述符完全关闭后再 rename（Windows: 否则 EPERM 锁定源文件）
              await new Promise((resolve) => {
                if (ws.destroyed) return resolve();
                const done = () => { ws.removeListener('close', done); resolve(); };
                ws.on('close', done);
                try { ws.close(); } catch (_) { done(); }
                setTimeout(done, 2000); // 超时回退
              });
              if (settled || cleaned) return;
              // SHA1 校验：不匹配视为下载损坏
              if (sha1) {
                const a = await utils.calculateSHA1(tmpPath);
                if (settled || cleaned) return;
                if (a !== sha1) {
                  clean(false);
                  if (rc > 0 && !settled) { setTimeout(() => attempt(rc - 1), 1000); }
                  else { doReject(new Error(`SHA1 mismatch: ${path.basename(destPath)}`)); }
                  return;
                }
              }
              // 大小不匹配：保留临时文件供续传
              if (tSz > 0 && dl !== tSz) {
                clean(true);
                if (rc > 0 && !settled) { setTimeout(() => attempt(rc - 1), 1000); }
                else { doReject(new Error(`Size mismatch: ${path.basename(destPath)} expected=${tSz} got=${dl}`)); }
                return;
              }
              // 0 字节文件：仅当服务器声明了内容（tSz>0）却收到 0 字节时才视为失败。
              // 修复 Java 运行时：jre-legacy 的 lib/security/trusted.libraries 是合法空文件
              // （SHA1=da39a3ee...，content-length=0）。旧逻辑把 dl===0 一律判为失败，
              // 导致单个空文件下载报错 → 整个 downloadJavaRuntime 回退到下一个镜像、
              // 从文件0重新下载全部 203 个文件（用户看到的"重新下载任务"）。
              if (dl === 0 && tSz > 0) {
                clean(false);
                if (rc > 0 && !settled) { setTimeout(() => attempt(rc - 1), 1000); }
                else { doReject(new Error(`Empty file: ${path.basename(destPath)}`)); }
                return;
              }
              // JAR 完整性校验：ZIP 结构检查
              if (destPath.toLowerCase().endsWith('.jar') && !utils.isJarIntact(tmpPath)) {
                const fileSize = dl || (fs.existsSync(tmpPath) ? fs.statSync(tmpPath).size : 0);
                console.warn(`[Download] JAR文件ZIP结构不完整: ${path.basename(destPath)} (${fileSize} bytes)，尝试重新下载`);
                clean(false); // JAR 损坏，删除重下
                if (rc > 0 && !settled) { setTimeout(() => attempt(rc - 1), 1000); }
                else { doReject(new Error(`JAR not intact: ${path.basename(destPath)} (${fileSize} bytes)`)); }
                return;
              }
              if (settled || cleaned) return;
              // 带重试的 rename：Windows 上杀毒软件可能短暂锁定目标文件
              const _renameOK = await safeRename(tmpPath, destPath);
              if (!_renameOK) {
                // 保留 tmpPath 供下次续传，不删除已下载的数据
                clean(true);
                if (!settled) doReject(new Error(`无法写入文件 ${path.basename(destPath)}: 文件可能被占用`));
                return;
              }
              doResolve({ size: dl, path: destPath });
            } catch (e) {
              console.error(`[Download] finish处理异常: ${e.message}`);
              clean(true); // 保留 tmpPath，避免丢失已下载数据
              if (!settled) doReject(e);
            }
          });
          ws.on('error', (e) => {
            clean(true); // 保留临时文件供续传
            if (settled) return;
            if (rc > 0) { setTimeout(() => attempt(rc - 1), 1000 + Math.random() * 500); }
            else { doReject(e); }
          });
        });
        req.on('error', (e) => {
          clean(true); // 保留临时文件供续传
          if (settled) return;
          if (rc > 0) { setTimeout(() => attempt(rc - 1), Math.min(2000 + (retries - rc) * 1000, 8000)); }
          else { doReject(e); }
        });
        // 自适应超时：替换固定 60s 超时
        // 快源（avg 1s）→ 15s 超时，慢源（avg 5s）→ 20s 超时，失败重试自动放宽
        req.setTimeout(adaptiveTimeoutMs, () => {
          req.destroy();
          clean(true); // 保留临时文件供续传
          if (settled) return;
          if (rc > 0) { setTimeout(() => attempt(rc - 1), 2000); }
          else { doReject(new Error(`Timeout (${adaptiveTimeoutMs}ms, avg=${ctx.caches._connectAvg}ms): ${urlStr}`)); }
        });
      };
      attempt(retries);
    });
  } finally {
    ctx.DownloadManager.releaseConnection();
  }
}

module.exports = { _dlSingle, _adaptiveTimeout, _recordConnectTime };
