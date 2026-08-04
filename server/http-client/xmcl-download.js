/**
 * server/http-client/xmcl-download.js - XMCL 下载引擎封装
 * 基于 @xmcl/file-transfer，提供高性能分块下载、多镜像回退、测速换源
 */

// 显式引用 dist 产物，避免 npm 包 main 指向 TS 源码导致加载失败
const { download, DownloadController, ManagedAbortError } = require('@xmcl/file-transfer/dist/index.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ctx = require('../context');

/**
 * 自适应下载控制器：测速换源 + stall 检测 + TTFB 超时
 */
class AdaptiveController {
  constructor(opts = {}) {
    this.sampleInterval = opts.sampleInterval || 2000;
    this.warmup = opts.warmup || 3000;
    this.maxResumes = opts.maxResumes || 10;
    this.maxNoProgressRerolls = opts.maxNoProgressRerolls || 3;
    this.ttfbDeadline = opts.ttfbDeadline || 15000;
    this.stallTimeout = opts.stallTimeout || 30000;
    this.rangeSplitThreshold = opts.rangeSplitThreshold || 1024 * 1024;
    this.rangeConcurrency = opts.rangeConcurrency || 64;
    this.minSpeed = opts.minSpeed || 50 * 1024;
    this._badHosts = new Set();
  }

  onSample(sample) {
    if (sample.elapsed < this.warmup) return 'continue';
    if (sample.speed < this.minSpeed && sample.total > 0 && sample.received > 200 * 1024) {
      return 'abort';
    }
    return 'continue';
  }

  shouldReroll(origin, error) {
    const code = error?.code || '';
    if (code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT') return true;
    const status = error?.statusCode || error?.status || 0;
    if (status === 403 || status === 404 || status >= 500) return true;
    return false;
  }

  isAbortable(origin) {
    return !this._badHosts.has(origin);
  }

  shouldSkip(origin) {
    return false;
  }

  report(result) {
    if (result.outcome === 'failed' || (result.outcome === 'aborted' && result.speed === 0)) {
      this._badHosts.add(result.host || result.origin);
    } else if (result.outcome === 'completed' && result.speed > 100 * 1024) {
      this._badHosts.delete(result.host || result.origin);
    }
  }
}

/**
 * 使用 XMCL 引擎下载文件
 * @param {string|string[]} urls - 下载 URL（数组表示多镜像回退）
 * @param {string} destPath - 目标路径
 * @param {object} [opts] - 选项
 * @param {function} [opts.onProgress] - 进度回调 ({bytesDownloaded, totalBytes, speed, progress})
 * @param {string} [opts.sha1] - 期望的 SHA1 值
 * @param {AbortSignal} [opts.abortSignal] - 中止信号
 * @param {number} [opts.expectedSize] - 预期文件大小
 * @param {number} [opts.maxChunks] - 并发分块数（默认 64）
 * @param {number} [opts.stallTimeout] - stall 超时（默认 30s）
 * @param {number} [opts.minSpeed] - 最低速度阈值（默认 50KB/s）
 * @returns {Promise<{size: number, path: string, sha1Match: boolean}>}
 */
async function xmclDownload(urls, destPath, opts = {}) {
  const {
    onProgress = null,
    sha1 = null,
    abortSignal = null,
    expectedSize = 0,
    maxChunks = 64,
    stallTimeout = 30000,
    minSpeed = 50 * 1024,
  } = opts;

  const urlList = Array.isArray(urls) ? urls : [urls];
  if (urlList.length === 0) throw new Error('No URLs provided');

  // 确保目录存在
  const dir = path.dirname(destPath);
  try {
    for (const p of dir.split(path.sep).reduce((acc, part, i, arr) => {
      if (i === 0) acc.push(part || path.sep);
      else acc.push(path.join(acc[i - 1], part));
      return acc;
    }, [])) {
      try { const s = fs.statSync(p); if (!s.isDirectory()) fs.unlinkSync(p); } catch (_) {}
      try { fs.mkdirSync(p, { recursive: true }); } catch (_) {}
    }
  } catch (_) {}

  // 清理旧分块残留
  try {
    const base = path.basename(destPath);
    const entries = fs.readdirSync(dir);
    for (const f of entries) {
      if (f.startsWith(base + '.c') && /^\.c\d+(\.split)?$/.test(f.slice(base.length))) {
        try { fs.unlinkSync(path.join(dir, f)); } catch (_) {}
      }
    }
    // 清理旧的 .downloading 临时文件
    if (fs.existsSync(destPath + '.downloading')) {
      try { fs.unlinkSync(destPath + '.downloading'); } catch (_) {}
    }
  } catch (_) {}

  // 构建控制器
  const controller = new AdaptiveController({
    rangeConcurrency: maxChunks,
    rangeSplitThreshold: 1024 * 1024,
    stallTimeout,
    minSpeed,
    maxResumes: 10,
    ttfbDeadline: 15000,
  });

  // 进度追踪
  let lastProgressTime = Date.now();
  let lastBytes = 0;
  let progressTracker = null;
  try {
    const { ProgressTrackerSingle } = require('@xmcl/file-transfer/dist/index.js');
    progressTracker = new ProgressTrackerSingle((accessor) => {
      // accessor: { url, total, progress }
    });
  } catch (_) {}

  // 如果有预期大小，设置到 tracker
  if (progressTracker && expectedSize > 0) {
    progressTracker.expectedTotal = expectedSize;
  }

  // 进度轮询（XMCL tracker 是 pull 模式，需要轮询）
  let progressInterval = null;
  if (onProgress && progressTracker) {
    progressInterval = setInterval(() => {
      try {
        const total = progressTracker.total || expectedSize;
        const progress = progressTracker.progress;
        const speed = progress > lastBytes ? (progress - lastBytes) / ((Date.now() - lastProgressTime) / 1000) : 0;
        onProgress({
          bytesDownloaded: progress,
          totalBytes: total,
          speed: speed,
          progress: total > 0 ? (progress / total * 100) : 0,
        });
        lastBytes = progress;
        lastProgressTime = Date.now();
      } catch (_) {}
    }, 500);
  }

  try {
    await download({
      url: urlList,
      destination: destPath,
      headers: { 'User-Agent': 'VersePC/2.0' },
      signal: abortSignal,
      expectedTotal: expectedSize,
      controller: controller,
      tracker: progressTracker,
      rangePolicy: { rangeThreshold: 512 * 1024 },
    });

    // 下载完成，清理进度轮询
    if (progressInterval) clearInterval(progressInterval);

    // 校验文件
    if (!fs.existsSync(destPath)) {
      throw new Error('下载完成后文件不存在');
    }
    const actualSize = fs.statSync(destPath).size;
    if (expectedSize > 0 && actualSize !== expectedSize) {
      try { fs.unlinkSync(destPath); } catch (_) {}
      throw new Error(`文件大小不匹配: 期望 ${expectedSize} 实际 ${actualSize}`);
    }

    // SHA1 校验
    let sha1Match = true;
    if (sha1) {
      const hash = crypto.createHash('sha1');
      const fd = fs.openSync(destPath, 'r');
      const buf = Buffer.alloc(64 * 1024);
      let pos = 0;
      while (pos < actualSize) {
        const n = fs.readSync(fd, buf, 0, Math.min(buf.length, actualSize - pos), pos);
        if (n <= 0) break;
        hash.update(buf.subarray(0, n));
        pos += n;
      }
      fs.closeSync(fd);
      const actualSha1 = hash.digest('hex');
      sha1Match = (actualSha1.toLowerCase() === sha1.toLowerCase());
      if (!sha1Match) {
        try { fs.unlinkSync(destPath); } catch (_) {}
        throw new Error(`SHA1 校验失败: 期望 ${sha1} 实际 ${actualSha1}`);
      }
    }

    // 最终进度回调
    if (onProgress) {
      onProgress({
        bytesDownloaded: actualSize,
        totalBytes: actualSize,
        speed: 0,
        progress: 100,
      });
    }

    return { size: actualSize, path: destPath, sha1Match };
  } catch (e) {
    if (progressInterval) clearInterval(progressInterval);
    // 清理不完整文件
    try { if (fs.existsSync(destPath) && fs.statSync(destPath).size === 0) fs.unlinkSync(destPath); } catch (_) {}
    try { fs.unlinkSync(destPath + '.downloading'); } catch (_) {}
    throw e;
  }
}

module.exports = { xmclDownload, AdaptiveController };
