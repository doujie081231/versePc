/**
 * @file server/http-client/download-chunked.js - HTTP/1.1 多线程分块下载
 * @description 支持续传、镜像回退、SHA1/JAR 校验、AbortSignal。
 *   通过 ctx (../context) 访问共享状态，通过 utils (../utils) 访问工具函数，
 *   依赖 ./settings（设置缓存）、./request（httpGet）、./mirror（getMirrorUrls）、
 *   ./file-ops（safeRename/_tryRemoveFile）、./download-single（_dlSingle）。
 */

const fs = require('fs');
const path = require('path');
const ctx = require('../context');
const utils = require('../utils');
const { loadSettingsCached } = require('./settings');
const { httpGet } = require('./request');
const { getMirrorUrls, probeMirrorsParallel } = require('./mirror');
const { safeRename, _tryRemoveFile } = require('./file-ops');
const { _dlSingle } = require('./download-single');

/**
 * HTTP/1.1 多线程分块下载：支持续传、镜像回退、SHA1/JAR 校验、AbortSignal
 * @param {string} url - 主下载 URL
 * @param {string} destPath - 目标文件路径
 * @param {object} [options={}] - retries/onProgress/sha1/timeout/mirrors/abortSignal/agent/maxChunks
 * @returns {Promise<{size: number, path: string, sha1Match?: boolean, chunks: number}>}
 */
async function downloadFileChunked(url, destPath, options = {}) {
  const { retries = 3, onProgress = null, sha1 = null, timeout = 120000, mirrors = null, abortSignal = null, agent: customAgent = null, maxChunks: optMaxChunks = null, stallTimeout: optStallTimeout = null } = options;
  const minChunkSize = 512 * 1024;
  const CHUNK_THRESHOLD = 1 * 1024 * 1024;
  // [CRITICAL] 分块下载前清理路径中与目录同名的文件。
  // 此函数不调用 ensureDir，需要自行处理 ENOTDIR 问题（同 ensureDir 的原理）。
  // [AI 自动生成警告] 请勿删除此处的文件清理块。
  {
    const d = path.dirname(destPath);
    try {
      for (const p of d.split(path.sep).map((_, i, a) => a.slice(0, i + 1).join(path.sep))) {
        if (p) { try { const s = await fs.promises.stat(p); if (!s.isDirectory()) await fs.promises.unlink(p); } catch (_) {} }
      }
    } catch (_) {}
    await fs.promises.mkdir(d, { recursive: true });
  }

  // [P0 FIX - 2026-07-21] 清理目标路径的旧分块残留文件 (.cN 及动态分割产生的 .cN.split)
  // 上次下载若因进程中断或文件锁定导致分块未清理，残留的 xxx.jar.cN 文件
  // 会被 Forge 的 ModDirTransformerDiscoverer 当作 jar 扫描（因文件名含 .jar），
  // 触发 "zip END header not found" 崩溃。每次下载前先清理，避免积累。
  {
    const dir = path.dirname(destPath);
    const base = path.basename(destPath);
    try {
      const entries = await fs.promises.readdir(dir);
      for (const f of entries) {
        // 匹配 destPath.cN 或 destPath.cN.split 格式的残留分块
        if (f.startsWith(base + '.c') && /^\.c\d+(\.split)?$/.test(f.slice(base.length))) {
          try { await fs.promises.unlink(path.join(dir, f)); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  // 优先使用传入的 mirrors（已排序），否则内部生成
  let rawUrls = (mirrors && mirrors.length > 0) ? mirrors : getMirrorUrls(url);
  // [关键修复 - 2026-07-27] 如果 url 参数（可能是预跟随重定向后的 URL）不在 mirrors 中，
  // 加到列表末尾（而不是最前面）。
  // 之前加到最前面导致 probe 优先选择 finalUrl（如 cdn-alt.modrinth.com），
  // 而 cdn-alt 国内速度仅 13KB/s，远慢于镜像（mod.mcimirror.top 10MB/s+）。
  // 加到末尾后：probe 优先测试镜像，镜像失败才回退到 finalUrl。
  if (url && !rawUrls.includes(url)) {
    rawUrls = [...rawUrls, url];
  }
  const _agent = customAgent || undefined;

  // 并行测速所有镜像，选最快的源
  // allUrls 存储排序后的 URL 列表，allProbeResults 存储每个 URL 的元信息。
  let allUrls = rawUrls;
  let allProbeResults = null;
  if (rawUrls.length > 1) {
    try {
      // [关键修复 - 2026-07-27] 超时从 1500ms 增加到 4000ms
      // 原因：cdn.modrinth.com 会 307 重定向到 cdn-alt.modrinth.com，probe 请求需要经历
      // 两次连接（重定向 + 响应），实测耗时 1.5-1.7s。1500ms 超时导致所有 probe 失败，
      // allUrls 保持原始顺序，后续逐个 probe 又因 2000ms 超时失败，最终回退单流下载。
      // 4000ms 给重定向+响应留足时间，即使网络稍慢也能成功。
      allProbeResults = await probeMirrorsParallel(rawUrls, 4000);
      // 只保留能拿到 fileSize 的 URL（探测成功的）
      const valid = allProbeResults.filter(r => r.fileSize > 0);
      if (valid.length > 0) {
        allUrls = valid.map(r => r.url);
      }
    } catch (e) { /* 测速失败，回退原始 URL 列表 */ }
  }

  // 缓存首次成功的探针结果，重试时复用，避免 CDN 限速时探针返回 200 导致回退单流下载
  let cachedProbe = null;

  // [P2-10/P2-11/P2-13] 动态线程池调度所需的全局状态
  // 提前加载 settings 以便外层访问 maxChunksPerFile
  const _settings = loadSettingsCached();
  const maxC = optMaxChunks !== null ? optMaxChunks : Math.min(parseInt(_settings.maxChunksPerFile, 10) || 64, 64);
  // 速度下限动态调整：初始 256KB/s
  let _speedFloor = 256 * 1024;
  let _lastSpeedFloorUpdate = Date.now();
  // 连续失败计数：用于强制失败机制
  let _consecutiveFailures = 0;
  // 线程状态计数
  let _connectingCount = 0;   // 准备中（已 acquireConnection 但 httpGet 未 resolve）
  let _downloadingCount = 0;  // 下载中（httpGet 已 resolve，正在传输数据）
  let _launchedCount = 0;     // 已启动的 chunk 总数
  const _MAX_INITIAL_THREADS = 4;  // 初始线程数不受速度限制，保证基础并发

  // [P2-10] 速度下限动态调整：每秒根据平均速度更新
  // 速度下限 = max(初始 256KB/s, 平均速度 * 0.85)
  const _updateSpeedFloor = () => {
    const now = Date.now();
    if (now - _lastSpeedFloorUpdate < 1000) return;
    _lastSpeedFloorUpdate = now;
    const speed = ctx.DownloadManager.getSpeed();
    if (speed > 0) {
      _speedFloor = Math.max(256 * 1024, Math.floor(speed * 0.85));
    }
  };

  // [P2-11] 线程新增决策：返回 true 表示可以启动新线程
  const _shouldAddThread = () => {
    _updateSpeedFloor();
    // 前 4 个线程不受限制，保证基础并发
    if (_launchedCount < _MAX_INITIAL_THREADS) return true;
    // 没有正在运行的线程时必须启动新的，否则会卡死（前一批已全部完成）
    if (_connectingCount + _downloadingCount === 0) return true;
    // 前 4 个还没进入下载阶段时，不新增（避免在连接阶段就启动更多线程造成雪崩）
    if (_downloadingCount === 0) return false;
    // 准备中线程数 > 下载中线程数时不新增（避免过多线程卡在连接阶段）
    if (_connectingCount > _downloadingCount) return false;
    // 当前下载速度 >= 速度下限时不新增（速度已达标，无需更多线程）
    const speed = ctx.DownloadManager.getSpeed();
    if (speed >= _speedFloor) return false;
    return true;
  };

  // [P2-13] 强制失败机制：连续失败次数超阈值时主动放弃，避免无限重试
  // 阈值 = max(剩余分块数 * 5.5, 线程上限 * 5.5 + 3)
  const _checkForceFail = (remainingChunks) => {
    const threshold = Math.max(remainingChunks * 5.5, maxC * 5.5 + 3);
    if (_consecutiveFailures >= threshold) {
      throw new Error(`强制失败：连续失败 ${_consecutiveFailures} 次，剩余分块 ${remainingChunks}`);
    }
  };

  /**
   * [P1-6] 动态分割策略：基于 .cN 文件大小找出未下载区域
   * 找到最大的"未开始下载"chunk，按其未下载部分的 40% 位置分割成两个新 chunk
   * 与续传兼容：原 chunk 复用 .cN 文件续传前半段，新 chunk 用 .cN.split 文件下载后半段
   * 用于重试/补下场景，初始化时仍走均匀切分
   * @param {number} fileSize - 文件总大小
   * @param {number} minChunkSize - 最小分块大小
   * @param {string} destPath - 目标文件路径
   * @returns {Array} 新的分块数组
   */
  const _buildChunksDynamicSplit = (fileSize, minChunkSize, destPath) => {
    // 按原均匀切分计算原 chunks 布局
    const cCount = Math.min(maxC, Math.ceil(fileSize / minChunkSize));
    const cSize = Math.ceil(fileSize / cCount);
    const origChunks = [];
    for (let i = 0; i < cCount; i++) {
      origChunks.push({ i, s: i * cSize, e: Math.min((i + 1) * cSize - 1, fileSize - 1), tmp: `${destPath}.c${i}` });
    }
    // 找到所有"未开始下载"的 chunks（.cN 和 .cN.split 都不存在或 0 字节）
    // .cN.split 是上次动态分割产生的后半段文件，若有数据则视为已部分下载
    const notStarted = [];
    for (const c of origChunks) {
      try {
        let cnSize = 0;
        if (fs.existsSync(c.tmp)) cnSize = fs.statSync(c.tmp).size;
        let splitSize = 0;
        const splitTmp = `${c.tmp}.split`;
        if (fs.existsSync(splitTmp)) splitSize = fs.statSync(splitTmp).size;
        if (cnSize > 0 || splitSize > 0) continue;  // 已部分下载，交给续传机制处理
      } catch (_) {}
      notStarted.push(c);
    }
    // 没有未开始的 chunk：保持原样，让续传机制处理
    if (notStarted.length === 0) return origChunks;
    // 找到最大的未开始 chunk
    notStarted.sort((a, b) => (b.e - b.s) - (a.e - a.s));
    const maxChunk = notStarted[0];
    const undoneSize = maxChunk.e - maxChunk.s + 1;
    // 分割点：未下载部分的 40% 位置（StartPosition = s + undoneSize * 0.4）
    const splitPoint = maxChunk.s + Math.floor(undoneSize * 0.4);
    // 分割后任一段小于 minChunkSize 则不分割，避免产生过小分块
    if (splitPoint - maxChunk.s < minChunkSize || maxChunk.e - splitPoint + 1 < minChunkSize) {
      return origChunks;
    }
    // 重建 chunks 数组：原 chunks 中除 maxChunk 外的保留，maxChunk 拆成两个
    const newChunks = [];
    let newIdx = 0;
    for (const c of origChunks) {
      if (c.i === maxChunk.i) {
        // 前半段：复用原 .cN 文件
        newChunks.push({
          i: newIdx++,
          s: maxChunk.s,
          e: splitPoint - 1,
          tmp: maxChunk.tmp
        });
        // 后半段：新 .cN.split 文件
        newChunks.push({
          i: newIdx++,
          s: splitPoint,
          e: maxChunk.e,
          tmp: `${maxChunk.tmp}.split`
        });
      } else {
        newChunks.push({ ...c, i: newIdx++ });
      }
    }
    return newChunks;
  };

  for (let ra = 0; ra <= retries; ra++) {
    if (abortSignal && abortSignal.aborted) throw new Error('下载已取消');
    for (let urlIdx = 0; urlIdx < allUrls.length; urlIdx++) {
      if (abortSignal && abortSignal.aborted) throw new Error('下载已取消');
      const currentUrl = allUrls[urlIdx];
      // 声明在外层，catch 块也能访问（用于强制失败检查）
      let chunks = [];
      let cCount = 0;
      try {
        let fileSize = 0, supportsRange = false, workingUrl = currentUrl;
        if (cachedProbe && cachedProbe.supportsRange) {
          // 重试时复用首次探针结果：CDN 限速时探针可能返回 200 误判为不支持 Range
          fileSize = cachedProbe.fileSize;
          supportsRange = cachedProbe.supportsRange;
          workingUrl = cachedProbe.workingUrl;
        } else {
          // 首次探针：探测当前 URL 的 Range 支持与文件大小，使用 finalUrl 缓存避免每块重定向
          // [关键修复 - 2026-07-27] timeout 从 2000ms 增加到 5000ms
          // 原因：cdn.modrinth.com 会 307 重定向到 cdn-alt.modrinth.com，probe 需要经历
          // 两次连接（重定向 + 响应），实测耗时 1.5-1.7s。网络稍慢时 2000ms 超时导致
          // probe 失败，supportsRange 被判为 false，大文件错误地走单流下载，失去分块并行优势。
          const probeR = await httpGet(currentUrl, { start: 0, end: 0, timeout: 5000, agent: _agent });
          probeR.stream.destroy();
          if (probeR.statusCode === 206) {
            supportsRange = true;
            workingUrl = probeR.finalUrl || currentUrl;
            const crMatch = (probeR.headers['content-range'] || '').match(/\/(\d+)/);
            fileSize = crMatch ? parseInt(crMatch[1], 10) : probeR.contentLength;
          } else if (probeR.statusCode === 200) {
            supportsRange = false;
            fileSize = probeR.contentLength;
            workingUrl = probeR.finalUrl || currentUrl;
          }
          // 当前 URL 拿不到大小时，依次探测后续镜像
          if (fileSize <= 0) {
            for (let probeIdx = urlIdx + 1; probeIdx < allUrls.length; probeIdx++) {
              try {
                const r2 = await httpGet(allUrls[probeIdx], { start: 0, end: 0, timeout: 5000, agent: _agent });
                r2.stream.destroy();
                if (r2.statusCode === 206) {
                  supportsRange = true;
                  workingUrl = r2.finalUrl || allUrls[probeIdx];
                  const crMatch = (r2.headers['content-range'] || '').match(/\/(\d+)/);
                  fileSize = crMatch ? parseInt(crMatch[1], 10) : r2.contentLength;
                } else if (r2.statusCode === 200) {
                  supportsRange = false;
                  fileSize = r2.contentLength;
                  workingUrl = r2.finalUrl || allUrls[probeIdx];
                }
                if (fileSize > 0) break;
              } catch (e) { continue; }
            }
          }
          // 仅在确认支持 Range 且拿到大小时缓存，避免缓存错误的 200 探针
          if (supportsRange && fileSize > 0) {
            cachedProbe = { fileSize, supportsRange, workingUrl };
          }
        }

        const settings = loadSettingsCached();
        const useChunk = settings.enableChunkDownload && supportsRange && fileSize > CHUNK_THRESHOLD;
        // 不启用分块或文件过小：回退单流下载
        // [关键修复 - 2026-07-27] 传递 stallTimeout，确保单流下载也使用快速 stall 检测
        if (!useChunk || fileSize <= 0) {
          return await _dlSingle(workingUrl, destPath, { onProgress, sha1, timeout, abortSignal, agent: customAgent, stallTimeout: optStallTimeout });
        }
        // 下载前检查文件是否已存在（大小匹配则跳过，复用文件）
        if (fs.existsSync(destPath)) {
          try {
            const existStat = fs.statSync(destPath);
            if (existStat.size === fileSize) {
              if (sha1) {
                const actualSha1 = await utils.calculateSHA1(destPath);
                if (actualSha1 === sha1) {
                  console.log(`[Download] 文件已存在且 SHA1 匹配，跳过下载: ${path.basename(destPath)}`);
                  if (onProgress) onProgress({ bytesDownloaded: existStat.size, totalBytes: fileSize, speed: 0, progress: 100, chunks: 1, activeChunks: 0 });
                  return { size: existStat.size, path: destPath, sha1Match: true, chunks: 1 };
                }
                console.warn(`[Download] 文件已存在但 SHA1 不匹配，重新下载: ${path.basename(destPath)}`);
                try { fs.unlinkSync(destPath); } catch (_) {}
              } else {
                console.log(`[Download] 文件已存在且大小匹配，跳过下载: ${path.basename(destPath)}`);
                if (onProgress) onProgress({ bytesDownloaded: existStat.size, totalBytes: fileSize, speed: 0, progress: 100, chunks: 1, activeChunks: 0 });
                return { size: existStat.size, path: destPath, chunks: 1 };
              }
            }
          } catch (_) {}
        }
        // 分块计算：第一次均匀切分，重试/补下时使用动态分割策略
        // 上限 64：对齐主流启动器的多线程下载策略，对大文件突破单连接限速
        const isFirstAttempt = (ra === 0 && urlIdx === 0);
        chunks = isFirstAttempt
          ? (() => {
              const _cCount = Math.min(maxC, Math.ceil(fileSize / minChunkSize));
              const cSize = Math.ceil(fileSize / _cCount);
              const arr = [];
              for (let i = 0; i < _cCount; i++) {
                arr.push({ i, s: i * cSize, e: Math.min((i + 1) * cSize - 1, fileSize - 1), tmp: `${destPath}.c${i}` });
              }
              return arr;
            })()
          : _buildChunksDynamicSplit(fileSize, minChunkSize, destPath);
        cCount = chunks.length;
        const cProg = new Array(cCount).fill(0);
        // 检测已下载的分块，支持续传
        const _getChunkResumeOffset = (c) => {
          try {
            if (!fs.existsSync(c.tmp)) return 0;
            const stat = fs.statSync(c.tmp);
            const expected = c.e - c.s + 1;
            if (stat.size > expected) return 0;   // 文件过大，重新下载
            if (stat.size === expected) return -1; // 已完成，跳过
            return stat.size;                      // 返回续传偏移
          } catch (_) { return 0; }
        };
        // 初始化进度（累加已完成分块的字节）
        for (const c of chunks) {
          const off = _getChunkResumeOffset(c);
          if (off === -1) cProg[c.i] = c.e - c.s + 1;
          else if (off > 0) cProg[c.i] = off;
        }
        let lastProgUpdate = Date.now();

        // 60 秒 stall 超时：检测 CDN 节点卡死，足够避开短暂网络抖动
        // [关键修复 - 2026-07-27] 允许通过 options.stallTimeout 覆盖默认值
        // 场景：cdn.modrinth.com 会 307 重定向到 cdn-alt.modrinth.com，
        // 每个 chunk 请求都要经历两次连接，增加 stall 风险。
        const CHUNK_STALL_TIMEOUT = optStallTimeout || 60000;

        const dlChunk = async (c, groupAbortController = null) => {
          if (abortSignal && abortSignal.aborted) throw new Error('下载已中止');
          let resumeOffset = _getChunkResumeOffset(c);
          if (resumeOffset === -1) {
            console.log(`[MultiThread] Chunk ${c.i} 已完成，跳过`);
            return;
          }
          // 等待连接数配额
          while (!ctx.DownloadManager.acquireConnection()) {
            if (abortSignal && abortSignal.aborted) throw new Error('下载已中止');
            // [关键修复 - 2026-07-27] 等待连接时也检查 groupAbort（其他 chunk 已失败）
            if (groupAbortController && groupAbortController.signal.aborted) throw new Error('同组 chunk 已失败，取消下载');
            await new Promise((r) => setTimeout(r, 50));
          }
          // [P2-11] 标记当前 chunk 进入"准备中"状态，用于线程新增决策
          // _phase 在 finally 中用于决定减少哪个计数器
          _connectingCount++;
          let _phase = 'connecting';
          // [关键修复 - 2026-07-27] groupAbortController 联动 chunkAbortController
          // 场景：其他 chunk 失败时，groupAbortController.abort() 被调用，
          // 当前 chunk 应立即取消，避免成为孤儿 chunk 继续占用连接/写入分块文件
          // 注意：onGroupAbort 定义在 try 外，确保 finally 块也能访问到进行清理
          let chunkAbortController = null;
          let onGroupAbort = null;
          try {
            const startByte = c.s + resumeOffset;
            // [关键修复 - 2026-07-27] 统一 stall 检测：覆盖连接阶段（httpGet 等待响应头）和数据传输阶段
            // 原因：之前 stall 计时器在 await httpGet 之后才启动，如果服务器建立 TCP 但不返回响应头，
            // httpGet 会卡住等 socket timeout（120-180s），stall 检测（20s）形同虚设。
            // 修复：用独立的 AbortController 实现 stall 检测，stall 触发时通过 abortSignal 销毁 httpGet 请求。
            // 这样 stall 检测同时覆盖连接阶段（httpGet 未 resolve）和数据传输阶段（stream 无 data 事件）。
            chunkAbortController = new AbortController();
            let stalled = false;
            let stallTimer = null;
            const resetStall = () => {
              if (stallTimer) clearTimeout(stallTimer);
              stallTimer = setTimeout(() => {
                if (!chunkAbortController.signal.aborted) {
                  stalled = true;
                  console.warn(`[MultiThread] Chunk ${c.i} stall timeout (${CHUNK_STALL_TIMEOUT/1000}s), aborting...`);
                  chunkAbortController.abort();
                }
              }, CHUNK_STALL_TIMEOUT);
            };
            // 外部 abortSignal 联动 chunkAbortController
            const onOuterAbort = () => { chunkAbortController.abort(); };
            if (abortSignal) {
              if (abortSignal.aborted) { chunkAbortController.abort(); }
              else { abortSignal.addEventListener('abort', onOuterAbort, { once: true }); }
            }
            // groupAbortController 联动 chunkAbortController
            onGroupAbort = () => { chunkAbortController.abort(); };
            if (groupAbortController) {
              if (groupAbortController.signal.aborted) { chunkAbortController.abort(); }
              else { groupAbortController.signal.addEventListener('abort', onGroupAbort, { once: true }); }
            }
            // 启动 stall 检测（覆盖连接阶段）
            resetStall();
            let cr = null;
            let _chunkReject = null;
            try {
              cr = await httpGet(workingUrl, {
                start: startByte, end: c.e, timeout, agent: _agent,
                abortSignal: chunkAbortController.signal
              });
            } catch (err) {
              if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
              if (abortSignal) abortSignal.removeEventListener('abort', onOuterAbort);
              if (groupAbortController && onGroupAbort) groupAbortController.signal.removeEventListener('abort', onGroupAbort);
              if (stalled) throw new Error(`Chunk ${c.i} connect stall timeout`);
              throw err;
            }
            // httpGet resolve 后，继续用同一个 stall 计时器检测数据传输阶段
            // [P2-11] 状态转换：准备中 → 下载中（httpGet 已 resolve，进入数据传输阶段）
            _connectingCount--;
            _downloadingCount++;
            _phase = 'downloading';
            if (abortSignal && abortSignal.aborted) {
              cr.stream.destroy();
              if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
              if (abortSignal) abortSignal.removeEventListener('abort', onOuterAbort);
              if (groupAbortController && onGroupAbort) groupAbortController.signal.removeEventListener('abort', onGroupAbort);
              throw new Error('下载已中止');
            }
            if (cr.statusCode !== 206) {
              cr.stream.destroy();
              if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
              if (abortSignal) abortSignal.removeEventListener('abort', onOuterAbort);
              if (groupAbortController && onGroupAbort) groupAbortController.signal.removeEventListener('abort', onGroupAbort);
              throw new Error(`Chunk ${c.i}: HTTP ${cr.statusCode} (expected 206)`);
            }
            // 非续传时先清空旧分块文件，appendFileSync 从 0 开始追加
            const isChunkResume = (resumeOffset > 0);
            if (!isChunkResume) { try { fs.unlinkSync(c.tmp); } catch (_) {} }
            let dl = resumeOffset;
            let aborted = false;
            // stall 触发时的清理：销毁 stream 并 reject
            const onChunkAbort = () => {
              aborted = true;
              if (cr && cr.stream) try { cr.stream.destroy(); } catch (_) {}
              if (_chunkReject) { try { _chunkReject(new Error(`Chunk ${c.i} stall timeout`)); } catch (_) {} _chunkReject = null; }
            };
            chunkAbortController.signal.addEventListener('abort', onChunkAbort, { once: true });
            // 同步写盘：appendFileSync 简单稳定，避免 createWriteStream 异步事件竞态
            await new Promise((resolve, reject) => {
              _chunkReject = reject;
              cr.stream.on('data', (d) => {
                if (stalled || aborted) return;
                dl += d.length;
                ctx.DownloadManager.recordProgress(d.length);
                cProg[c.i] = dl;
                resetStall();
                try { fs.appendFileSync(c.tmp, d); } catch (_) {}
                if (onProgress && Date.now() - lastProgUpdate > 50) {
                  lastProgUpdate = Date.now();
                  const t = cProg.reduce((a, b) => a + b, 0);
                  onProgress({
                    bytesDownloaded: t,
                    totalBytes: fileSize,
                    speed: ctx.DownloadManager.getSpeed(),
                    progress: Math.min(99.9, (t / fileSize) * 100),
                    chunks: cCount,
                    activeChunks: ctx.DownloadManager.activeConnections
                  });
                }
              });
              cr.stream.on('end', () => {
                _chunkReject = null;
                if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
                if (abortSignal) abortSignal.removeEventListener('abort', onOuterAbort);
                if (groupAbortController && onGroupAbort) groupAbortController.signal.removeEventListener('abort', onGroupAbort);
                chunkAbortController.signal.removeEventListener('abort', onChunkAbort);
                if (aborted) return;
                resolve();
              });
              cr.stream.on('error', (err) => {
                _chunkReject = null;
                if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
                if (abortSignal) abortSignal.removeEventListener('abort', onOuterAbort);
                if (groupAbortController && onGroupAbort) groupAbortController.signal.removeEventListener('abort', onGroupAbort);
                chunkAbortController.signal.removeEventListener('abort', onChunkAbort);
                reject(err);
              });
            });
            // 分块完成时再触发一次进度更新
            if (onProgress) {
              const t = cProg.reduce((a, b) => a + b, 0);
              onProgress({
                bytesDownloaded: t,
                totalBytes: fileSize,
                speed: ctx.DownloadManager.getSpeed(),
                progress: Math.min(99.9, (t / fileSize) * 100),
                chunks: cCount,
                activeChunks: ctx.DownloadManager.activeConnections
              });
            }
          } finally {
            // [关键修复 - 2026-07-27] finally 兜底：确保 groupAbort 监听器被移除，避免内存泄漏
            if (groupAbortController && onGroupAbort) {
              try { groupAbortController.signal.removeEventListener('abort', onGroupAbort); } catch (_) {}
            }
            ctx.DownloadManager.releaseConnection();
            // [P2-11] 释放线程状态计数，确保 _shouldAddThread 决策准确
            if (_phase === 'connecting') _connectingCount = Math.max(0, _connectingCount - 1);
            else if (_phase === 'downloading') _downloadingCount = Math.max(0, _downloadingCount - 1);
          }
        };
        // [关键修复 - 2026-07-27] 解决 Promise.all 孤儿 chunk 卡死问题
        // 原因：当某个 chunk 失败时，Promise.all 立即 reject，但其他还在运行的 chunk
        //   不会被取消，它们继续占用连接配额、写入分块文件，导致：
        //   1. 下次下载启动时连接池被孤儿 chunk 占满，新 chunk 卡在 acquireConnection
        //   2. 孤儿 chunk 写入分块文件与新一轮下载的 chunk 竞态，导致文件损坏
        //   3. 整个下载流程卡死，日志停止更新但进程不退出（观察到的现象：
        //      better-end 13 个分块残留、19 分钟无新日志、Electron 进程未退出）
        // 修复：用 groupAbortController 实现"一失败全取消"语义
        //   - 任意 chunk 失败时调用 groupAbortController.abort()
        //   - 其他 chunk 的 chunkAbortController 联动 groupAbortController，被一并取消
        //   - 用 Promise.allSettled 等待所有 chunk 完成（成功或失败），避免孤儿
        //   - 失败后收集错误抛出，让上层 catch 走换源/重试逻辑
        const groupAbortController = new AbortController();
        // [P2-11] 包装 dlChunk：加入线程新增决策（前 4 个不限制，后续按 _shouldAddThread）
        // [P2-13] 失败时累计 _consecutiveFailures，用于强制失败机制
        const _safeDlChunk = async (c) => {
          // 等待线程新增条件满足（前 4 个不阻塞，后续按速度和连接状态决策）
          while (!_shouldAddThread()) {
            if (abortSignal && abortSignal.aborted) throw new Error('下载已取消');
            if (groupAbortController.signal.aborted) throw new Error('同组 chunk 已失败，取消下载');
            await new Promise(r => setTimeout(r, 100));
          }
          _launchedCount++;
          try {
            const r = await dlChunk(c, groupAbortController);
            // 成功完成：重置连续失败计数
            _consecutiveFailures = 0;
            return r;
          } catch (err) {
            // [P2-13] 累计连续失败次数
            _consecutiveFailures++;
            // 当前 chunk 失败：立即取消所有其他 chunk，避免孤儿继续运行
            if (!groupAbortController.signal.aborted) {
              console.warn(`[MultiThread] Chunk ${c.i} 失败，取消同组其他 chunk: ${err.message}`);
              groupAbortController.abort();
            }
            throw err;
          }
        };
        const _results = await Promise.allSettled(chunks.map((c) => _safeDlChunk(c)));
        // 收集失败原因（如果有）
        const _rejected = _results.filter(r => r.status === 'rejected');
        if (_rejected.length > 0) {
          // 所有 chunk 失败 vs 部分失败：都视为失败，触发上层换源/重试
          // 因为部分 chunk 失败意味着合并后文件不完整，无法使用
          const _firstErr = _rejected[0].reason;
          console.warn(`[MultiThread] ${_rejected.length}/${chunks.length} 个 chunk 失败: ${_firstErr.message}`);
          throw _firstErr;
        }

        try {
          // 合并到临时文件，避免 AV 锁定 0 字节的 destPath
          const mergeTmp = destPath + '.merging';
          await new Promise((resolve, reject) => {
            const ws = fs.createWriteStream(mergeTmp);
            let idx = 0;
            let mergedBytes = 0;
            let lastMergeProg = Date.now();
            const writeNext = () => {
              if (idx >= chunks.length) { ws.end(); return; }
              const rs = fs.createReadStream(chunks[idx].tmp);
              rs.on('data', (d) => {
                mergedBytes += d.length;
                // 合并阶段也上报进度（merging 标记）
                if (onProgress && Date.now() - lastMergeProg > 100) {
                  lastMergeProg = Date.now();
                  onProgress({
                    bytesDownloaded: mergedBytes,
                    totalBytes: fileSize,
                    speed: 0,
                    progress: Math.min(99.9, (mergedBytes / fileSize) * 100),
                    chunks: cCount,
                    activeChunks: 0,
                    merging: true
                  });
                }
              });
              rs.on('end', () => { idx++; writeNext(); });
              rs.on('error', reject);
              rs.pipe(ws, { end: false });
            };
            ws.on('finish', () => {
              // 等待文件描述符完全关闭后再 resolve (Windows: 否则 EPERM 锁定源文件)
              const onClose = () => resolve();
              ws.on('close', onClose);
              try { ws.close(); } catch (_) { onClose(); }
              setTimeout(onClose, 2000);
            });
            ws.on('error', reject);
            writeNext();
          });
          // 合并成功后清理临时分块（带重试，防止 AV 锁定导致残留）
          for (const c of chunks) {
            for (let _retry = 0; _retry < 3; _retry++) {
              try { await fs.promises.unlink(c.tmp); break; }
              catch (e) {
                if (_retry < 2) await new Promise(r => setTimeout(r, 300));
                else console.warn(`[MultiThread] 清理分块失败: ${path.basename(c.tmp)} - ${e.message}`);
              }
            }
          }
        } catch (e) {
          // 保留临时分块文件，支持下次重试续传
          try { await fs.promises.unlink(destPath + '.merging'); } catch (_) {}
          throw e;
        }
        // 合并后校验（在 mergeTmp 上进行，不触碰 destPath）
        const mergeTmp = destPath + '.merging';
        const actualSize = fs.existsSync(mergeTmp) ? fs.statSync(mergeTmp).size : 0;
        const _mergeCleanup = async () => {
          await fs.promises.unlink(mergeTmp).catch(() => {});
          for (const c of chunks) { try { await fs.promises.unlink(c.tmp); } catch (_) {} }
        };
        // 大小不匹配：清理后切下一个镜像或重试
        if (fileSize > 0 && actualSize !== fileSize) {
          console.warn(`[MultiThread] Size mismatch after merge: ${path.basename(destPath)} expected=${fileSize} got=${actualSize}`);
          await _mergeCleanup();
          if (urlIdx < allUrls.length - 1) {
            continue;
          }
          if (ra < retries) continue;
          throw new Error(`Size mismatch after merge: ${path.basename(destPath)} expected=${fileSize} got=${actualSize}`);
        }
        // 0 字节文件：同样清理后切换
        if (actualSize === 0) {
          console.warn(`[MultiThread] Empty file after merge: ${path.basename(destPath)}`);
          await _mergeCleanup();
          if (urlIdx < allUrls.length - 1) { continue; }
          if (ra < retries) continue;
          throw new Error(`Empty file after merge: ${path.basename(destPath)}`);
        }
        // JAR 完整性校验（即使无 SHA1 也要检查 ZIP 结构）
        if (destPath.toLowerCase().endsWith('.jar') && !utils.isJarIntact(mergeTmp)) {
          console.warn(`[MultiThread] JAR not intact after merge: ${path.basename(destPath)} (${actualSize} bytes)`);
          await _mergeCleanup();
          if (urlIdx < allUrls.length - 1) { continue; }
          if (ra < retries) continue;
          throw new Error(`JAR not intact: ${path.basename(destPath)}`);
        }
        // SHA1 校验：不匹配视为下载损坏
        if (sha1) {
          const actual = await utils.calculateSHA1(mergeTmp);
          if (actual !== sha1) {
            console.warn(`[MultiThread] SHA1 mismatch on ${allUrls[urlIdx]}: ${path.basename(destPath)}`);
            await _mergeCleanup();
            if (urlIdx < allUrls.length - 1) {
              continue;
            }
            if (ra < retries) continue;
            // SHA1 不匹配但不重试时返回 sha1Match: false 让上层决定
            return { size: fileSize, path: destPath, sha1Match: false, chunks: cCount };
          }
        }
        // 校验通过，用带重试的 safeRename 写入最终路径
        const _renameOK = await safeRename(mergeTmp, destPath);
        if (!_renameOK) {
          if (urlIdx < allUrls.length - 1) {
            continue;
          }
          if (ra < retries) continue;
          throw new Error(`无法写入文件 ${path.basename(destPath)}: 文件可能被占用`);
        }
        if (onProgress) onProgress({ bytesDownloaded: fileSize, totalBytes: fileSize, speed: 0, progress: 100, chunks: cCount, activeChunks: 0 });
        return { size: fileSize, path: destPath, sha1Match: sha1 ? true : undefined, chunks: cCount };
      } catch (err) {
        console.warn(`[MultiThread] URL ${currentUrl} failed: ${err.message}`);
        // [P2-13] 强制失败检查：连续失败次数超阈值时直接抛错，不再重试
        // 阈值 = max(剩余分块数 * 5.5, 线程上限 * 5.5 + 3)
        try {
          _checkForceFail(chunks.length);
        } catch (forceFailErr) {
          // 强制失败：清理所有临时分块文件（含动态分割产生的 .split 文件）后抛错
          for (let i = 0; i < 64; i++) {
            _tryRemoveFile(`${destPath}.c${i}`);
            _tryRemoveFile(`${destPath}.c${i}.split`);
          }
          _tryRemoveFile(destPath);
          throw forceFailErr;
        }
        // 当前镜像失败：切下一个镜像
        if (urlIdx < allUrls.length - 1) {
          continue;
        }
        // 所有镜像都失败：重试或抛错
        if (ra < retries) {
          console.warn(`[MultiThread] Retry ${ra + 1}/${retries}`);
          // 保留临时分块文件用于续传，仅清理目标文件（处理锁定/只读）
          _tryRemoveFile(destPath);
          await new Promise((r) => setTimeout(r, Math.min(1000 * (ra + 1), 5000) + Math.floor(Math.random() * 500)));
        } else {
          // 所有重试耗尽：清理分块临时文件后回退单流下载
          // 触发条件：服务器不支持 Range (expected 206)、分块大小不匹配 (size mismatch)、
          // 分块卡死超时 (stall timeout)。这些场景下分块下载不可靠，单流更稳定。
          for (let i = 0; i < 64; i++) {
            _tryRemoveFile(`${destPath}.c${i}`);
            _tryRemoveFile(`${destPath}.c${i}.split`);  // [P1-6] 清理动态分割产生的 .split 文件
          }
          _tryRemoveFile(destPath);
          const _errMsg = err.message || '';
          // [P0 FIX - 2026-07-21] 加入 'Request timeout'：httpGet 的 socket 无活动超时会抛此错误，
          // 单流下载有低速检测，能更好地应对 CDN 滴漏/节点卡死。
          const _shouldFallback = _errMsg.includes('expected 206')
            || _errMsg.includes('size mismatch')
            || _errMsg.includes('stall timeout')
            || _errMsg.includes('Request timeout')
            || _errMsg.includes('low speed')
            || _errMsg.includes('ECONNRESET')
            || _errMsg.includes('ECONNREFUSED')
            || _errMsg.includes('ETIMEDOUT');
          if (_shouldFallback) {
            console.warn(`[MultiThread] 分块下载失败(${_errMsg})，回退单流下载: ${path.basename(destPath)}`);
            for (const fallbackUrl of allUrls) {
              try {
                // 单流回退：使用完整 timeout（不限制 60s），由 stallTimeout 负责低速检测
                // [关键修复 - 2026-07-27] 传递 stallTimeout，确保单流回退也使用快速 stall 检测
                return await _dlSingle(fallbackUrl, destPath, { onProgress, sha1, timeout, abortSignal, agent: customAgent, stallTimeout: optStallTimeout });
              } catch (singleErr) {
                console.warn(`[MultiThread] 单流回退失败 (${fallbackUrl}): ${singleErr.message}`);
              }
            }
          }
          throw err;
        }
      }
    }
  }
}

module.exports = { downloadFileChunked };
