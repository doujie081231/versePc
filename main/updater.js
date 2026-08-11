/**
 * @file main/updater.js
 * @description 自动更新模块 - 多源 update.json 检测 + electron-updater 后备
 *
 * 职责：
 * 1. 多源 update.json 检测（jsdelivr / github / ghproxy 镜像）
 * 2. 版本比较、带 SHA256 校验的多镜像下载
 * 3. 启动时静默检查，发现新版本弹出通知
 * 4. 注册更新相关 IPC：updater:check-for-updates / download-update /
 *    install-update / get-version / skip-version / open-release-page
 *
 * 依赖注入：setup({ getMainWindow, setShuttingDown, isBeta }) 接收主进程注入的依赖
 * - getMainWindow: () => BrowserWindow | null  主窗口 getter（窗口可能被重建）
 * - setShuttingDown: (v: boolean) => void      设置关闭标志（runInstallerAndQuit 使用）
 * - isBeta: boolean                            是否测试版（决定更新源）
 */

const { app, ipcMain, dialog, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');

// electron-updater 懒加载（当前实现以多源 update.json 为主，保留 autoUpdater 备用）
let _autoUpdater;
function getAutoUpdater() {
  if (!_autoUpdater) _autoUpdater = require('electron-updater').autoUpdater;
  return _autoUpdater;
}

// 更新状态
let updateDownloaded = false;       // 更新是否已下载完成
let updateAvailableInfo = null;     // 可用的更新信息（用于弹窗通知）
let updateDownloadedPath = null;    // 已下载的安装包路径
let _officialActive = false;        // 是否已由官方更新器接管（增量补丁通道）
let _officialFallbackDone = false;  // 官方通道失败后是否已回退到多源检测

// 更新配置文件路径 —— 统一走 paths.js，避免硬编码 ~/.versepc 导致数据回退到 C 盘
const UPDATE_CONFIG_PATH = require('./paths').UPDATE_CONFIG_FILE;

// 增量补丁服务器（国内直连，速度快）
// 服务器上存放每一版的全量安装包，供"快速下载"按钮使用
const QUICK_DOWNLOAD_BASE = 'https://www.verselauncher.cn/download';

// 依赖注入的句柄
let _getMainWindow = null;
let _setShuttingDown = null;
let _isBeta = false;

// 更新源（通过代理读公开仓库 Verse 的 update.json）
// 测试版仍读 VersePC-beta 仓库
let UPDATE_JSON_SOURCES = null;

// 私有函数：按 isBeta 初始化更新源列表
// 多个镜像源 + CDN 缓存源 + 官方直连兜底，任一可用即可读到最新更新信息
function _ensureSources() {
  if (UPDATE_JSON_SOURCES) return;
  const repo = _isBeta ? 'VersePC-beta' : 'Verse';
  // 尽量多放可用的镜像源，避免单个源不可用时无法检测更新
  UPDATE_JSON_SOURCES = [
    'https://ghfast.top/https://raw.githubusercontent.com/doujie081231/' + repo + '/main/update.json',
    'https://ghproxy.net/https://raw.githubusercontent.com/doujie081231/' + repo + '/main/update.json',
    'https://gh-proxy.com/https://raw.githubusercontent.com/doujie081231/' + repo + '/main/update.json',
    'https://cdn.jsdelivr.net/gh/doujie081231/' + repo + '@main/update.json',
    'https://raw.githubusercontent.com/doujie081231/' + repo + '/main/update.json',
  ];
}

// 下载镜像转换函数（多代理轮询下载 GitHub Release，按速度排序）
const DOWNLOAD_MIRRORS = [
  (url) => {
    if (url.indexOf('https://github.com/') === 0) {
      return 'https://ghfast.top/' + url;
    }
    return url;
  },
  (url) => {
    if (url.indexOf('https://github.com/') === 0) {
      return 'https://ghproxy.net/' + url;
    }
    return url;
  },
  (url) => {
    if (url.indexOf('https://github.com/') === 0) {
      return 'https://gh-proxy.com/' + url;
    }
    return url;
  },
  (url) => {
    if (url.indexOf('https://github.com/') === 0) {
      return 'https://ghproxy.link/' + url;
    }
    return url;
  },
  (url) => url,
];

/**
 * 从多个源并发获取 update.json
 * 所有源同时发起请求，谁先返回有效结果就用谁，避免单个源不可用时串行等待
 * @returns {Promise<Object|null>} 更新信息对象，获取失败返回 null
 */
async function fetchUpdateJson() {
  _ensureSources();
  const bust = Date.now();

  // 每个源独立获取，返回数据或 null
  const trySource = async (url) => {
    try {
      const fetchUrl = url + '?t=' + bust;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const response = await net.fetch(fetchUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) {
        console.log('[Updater] Source returned', response.status, '-', url.substring(0, 60));
        return null;
      }
      const data = await response.json();
      if (data && data.version && data.files) {
        console.log('[Updater] Got update info, version:', data.version, '-', url.substring(0, 60));
        return data;
      }
      return null;
    } catch (e) {
      console.log('[Updater] Source failed:', e.message, '-', url.substring(0, 60));
      return null;
    }
  };

  // 并发发起所有源的请求，第一个成功的结果胜出
  const results = await Promise.all(UPDATE_JSON_SOURCES.map(trySource));
  return results.find((data) => data !== null) || null;
}

/**
 * 版本号比较
 * @param {string} a - 版本号 a
 * @param {string} b - 版本号 b
 * @returns {number} a>b 返回 1，a<b 返回 -1，相等返回 0
 */
function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

/**
 * 校验本地文件的大小和 SHA256 是否符合预期
 * @param {string} filePath - 文件路径
 * @param {number} expectedSize - 预期大小（字节）
 * @param {string|null} expectedSha256 - 预期 SHA256（小写），为 null 则跳过校验
 * @returns {Promise<boolean>} 校验通过返回 true
 */
async function _verifyFile(filePath, expectedSize, expectedSha256) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stat = fs.statSync(filePath);
    if (expectedSize > 0 && stat.size !== expectedSize) {
      console.log('[Updater] Size mismatch:', stat.size, 'expected:', expectedSize);
      return false;
    }
    if (expectedSha256) {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      const fileHash = hash.digest('hex');
      if (fileHash !== expectedSha256) {
        console.log('[Updater] SHA256 mismatch');
        return false;
      }
    }
    return true;
  } catch (e) {
    console.log('[Updater] Verify error:', e.message);
    return false;
  }
}

/**
 * 用 net.fetch 流式下载文件，准确报告字节级进度
 * 进度基于实际读取的字节数，不会因为文件预分配而虚报 100%
 * @param {string} url - 下载地址
 * @param {string} targetPath - 本地保存路径
 * @param {number} expectedSize - 预期大小（用于无 content-length 时的进度计算）
 * @param {(progress: Object) => void} [onProgress] - 进度回调
 * @returns {Promise<boolean>} 下载成功返回 true
 */
async function _streamDownload(url, targetPath, expectedSize, onProgress) {
  const controller = new AbortController();
  // 30 秒无数据则中止（处理 ghfast.top 在 80% 断开的情况）
  let noDataTimer = setTimeout(() => controller.abort(), 30000);

  let response;
  try {
    response = await net.fetch(url, { signal: controller.signal, redirect: 'follow' });
  } catch (e) {
    clearTimeout(noDataTimer);
    console.log('[Updater] Fetch failed:', e.message);
    return false;
  }
  if (!response.ok) {
    clearTimeout(noDataTimer);
    console.log('[Updater] HTTP', response.status, response.statusText);
    return false;
  }

  const contentLength = parseInt(response.headers.get('content-length') || '0', 10) || expectedSize;
  const total = contentLength > 0 ? contentLength : expectedSize;

  // 写入临时 .part 文件，下载完成后再重命名为目标文件，避免半成品被误判为完成
  const tmpPath = targetPath + '.part';
  try { fs.unlinkSync(tmpPath); } catch (_) {}
  const fileStream = fs.createWriteStream(tmpPath, { flags: 'w' });

  let transferred = 0;
  let lastTime = Date.now();
  let lastBytes = 0;
  let smoothSpeed = 0;
  let lastProgressTime = 0;

  // 背压处理
  let drainResolve, drainReject;
  let drainPromise = new Promise((r, j) => { drainResolve = r; drainReject = j; });
  fileStream.on('drain', () => drainResolve());
  fileStream.on('error', (e) => { drainReject(e); });

  const reader = response.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 收到数据，重置无数据定时器
      clearTimeout(noDataTimer);
      noDataTimer = setTimeout(() => controller.abort(), 30000);

      transferred += value.length;

      // 写入文件，处理背压（write 返回 false 表示缓冲区满）
      if (!fileStream.write(Buffer.from(value))) {
        await drainPromise;
        drainPromise = new Promise((r, j) => { drainResolve = r; drainReject = j; });
      }

      // 报告进度（最多每 300ms 一次，避免刷屏）
      const now = Date.now();
      if (onProgress && now - lastProgressTime >= 300) {
        const elapsed = (now - lastTime) / 1000;
        if (elapsed > 0) {
          const instant = (transferred - lastBytes) / elapsed;
          smoothSpeed = smoothSpeed === 0 ? instant : (smoothSpeed * 0.7 + instant * 0.3);
        }
        lastTime = now;
        lastBytes = transferred;
        lastProgressTime = now;
        onProgress({
          percent: total > 0 ? (transferred / total) * 100 : 0,
          transferred,
          total,
          bytesPerSecond: Math.max(0, smoothSpeed),
        });
      }
    }
    clearTimeout(noDataTimer);

    // 等待文件写入完成
    await new Promise((resolve, reject) => {
      fileStream.end(() => resolve());
      fileStream.on('error', reject);
    });

    // 重命名 .part 为最终文件
    try { fs.unlinkSync(targetPath); } catch (_) {}
    fs.renameSync(tmpPath, targetPath);

    // 最终进度上报 100%
    if (onProgress && total > 0) {
      onProgress({ percent: 100, transferred: total, total, bytesPerSecond: 0 });
    }
    return true;
  } catch (e) {
    clearTimeout(noDataTimer);
    try { fileStream.destroy(); } catch (_) {}
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    console.log('[Updater] Stream download error:', e.message);
    return false;
  }
}

/**
 * 多镜像下载文件，带 SHA256 校验
 * @param {Object} fileInfo - 文件信息（含 url、size、sha256）
 * @param {string} targetPath - 本地保存路径
 * @param {(progress: Object) => void} [onProgress] - 下载进度回调
 * @returns {Promise<boolean>} 下载成功返回 true，全部镜像失败返回 false
 */
async function downloadWithFallback(fileInfo, targetPath, onProgress) {
  const expectedSize = fileInfo.size || 0;
  const expectedSha256 = fileInfo.sha256 ? fileInfo.sha256.toLowerCase() : null;

  // 预检查：文件已完整且校验通过，直接返回
  if (await _verifyFile(targetPath, expectedSize, expectedSha256)) {
    console.log('[Updater] File already complete and valid');
    if (onProgress && expectedSize > 0) {
      onProgress({ percent: 100, transferred: expectedSize, total: expectedSize, bytesPerSecond: 0 });
    }
    return true;
  }
  // 清理损坏的旧文件
  try { if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath); } catch (_) {}
  try { if (fs.existsSync(targetPath + '.part')) fs.unlinkSync(targetPath + '.part'); } catch (_) {}

  // 逐个镜像尝试，每个镜像最多重试 2 次（从头下载，不续传，避免代理返回损坏数据）
  for (let i = 0; i < DOWNLOAD_MIRRORS.length; i++) {
    const getMirrorUrl = DOWNLOAD_MIRRORS[i];
    const downloadUrl = getMirrorUrl(fileInfo.url);

    for (let attempt = 0; attempt < 2; attempt++) {
      console.log('[Updater] Downloading mirror', i + 1, '/' + DOWNLOAD_MIRRORS.length, 'attempt', attempt + 1, 'from:', downloadUrl.substring(0, 60));

      const ok = await _streamDownload(downloadUrl, targetPath, expectedSize, onProgress);
      if (!ok) {
        // 清理可能残留的 .part 文件
        try { if (fs.existsSync(targetPath + '.part')) fs.unlinkSync(targetPath + '.part'); } catch (_) {}
        continue;
      }

      // 下载完成，立即校验
      if (await _verifyFile(targetPath, expectedSize, expectedSha256)) {
        console.log('[Updater] Download complete and verified');
        return true;
      }
      console.log('[Updater] Verification failed, retrying');
      try { if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath); } catch (_) {}
    }
  }

  return false;
}

/**
 * 读取更新配置（记录用户跳过的版本）
 * @returns {{skippedVersion: string|null}} 更新配置对象
 */
function loadUpdateConfig() {
  try {
    if (fs.existsSync(UPDATE_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(UPDATE_CONFIG_PATH, 'utf8'));
    }
  } catch (e) {}
  return { skippedVersion: null };
}

/**
 * 保存更新配置
 * @param {Object} config - 更新配置对象
 */
function saveUpdateConfig(config) {
  try {
    const dir = path.dirname(UPDATE_CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(UPDATE_CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (e) {}
}

/**
 * 向渲染进程发送更新状态事件
 * @param {string} channel - 事件频道
 * @param {*} data - 事件数据
 */
function sendToUpdateUI(channel, data) {
  const mw = _getMainWindow && _getMainWindow();
  if (mw && !mw.isDestroyed()) {
    mw.webContents.send('updater-status', { channel, data });
  }
}

/**
 * 初始化自动更新器 - 启动后静默检查，发现新版本弹出通知
 * 走多源镜像检测（国内可用），下载走多镜像加速
 */
function initAutoUpdater() {
  setTimeout(async () => {
    try {
      sendToUpdateUI('checking-for-update');
      const updateInfo = await fetchUpdateJson();
      if (!updateInfo) {
        console.log('[Updater] No update info available');
        sendToUpdateUI('update-error', {
          message: '无法获取更新信息，请检查网络连接后重试',
          hint: '可尝试使用 VPN 或稍后再试'
        });
        return;
      }

      const currentVersion = app.getVersion();
      if (compareVersions(updateInfo.version, currentVersion) <= 0) {
        sendToUpdateUI('update-not-available', { version: currentVersion });
        return;
      }

      const cfg = loadUpdateConfig();
      if (cfg.skippedVersion === updateInfo.version) {
        sendToUpdateUI('update-skipped', { version: updateInfo.version });
        return;
      }

      updateAvailableInfo = updateInfo;
      sendToUpdateUI('update-available', {
        version: updateInfo.version,
        releaseDate: updateInfo.releaseDate,
        releaseName: updateInfo.releaseName,
        releaseNotes: updateInfo.releaseNotes,
      });
      showUpdateNotification(updateInfo);
    } catch (e) {
      console.error('[Updater] Check failed:', e.message);
      sendToUpdateUI('update-error', {
        message: e.message || '检查更新失败',
        hint: '可尝试使用 VPN 或稍后再试'
      });
    }
  }, 3000);
}

/**
 * 显示更新可用通知（向主窗口发送事件）
 * @param {Object} info - 更新信息
 */
function showUpdateNotification(info) {
  const mw = _getMainWindow && _getMainWindow();
  if (!mw || mw.isDestroyed()) return;
  const notes = typeof info.releaseNotes === 'string'
    ? info.releaseNotes
    : Array.isArray(info.releaseNotes)
      ? info.releaseNotes.map((n) => n.note || '').filter(Boolean).join('\n')
      : '';
  sendToUpdateUI('update-available', {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseName: info.releaseName,
    releaseNotes: notes,
    currentVersion: app.getVersion(),
  });
}

/**
 * 下载更新包
 * @param {Object} updateInfo - 更新信息
 * @returns {Promise<void>}
 */
async function doDownloadUpdate(updateInfo) {
  const fileInfo = updateInfo.files?.['win-x64'];
  if (!fileInfo) {
    sendToUpdateUI('update-error', { message: '未找到适用于当前平台的安装包' });
    return;
  }

  sendToUpdateUI('start-download', {});

  const targetPath = path.join(app.getPath('temp'), `VersePC-Setup-${updateInfo.version}.exe`);

  // 进度由 downloadWithFallback 通过 onProgress 回调直接上报，
  // 基于实际读取的字节数，不会因为文件预分配而虚报 100%
  try {
    const success = await downloadWithFallback(fileInfo, targetPath, (progress) => {
      sendToUpdateUI('download-progress', progress);
    });

    if (success) {
      updateDownloadedPath = targetPath;
      updateDownloaded = true;
      sendToUpdateUI('update-downloaded', {
        version: updateInfo.version,
        releaseName: updateInfo.releaseName,
      });
      showUpdateReadyDialog(updateInfo);
    } else {
      sendToUpdateUI('update-error', { message: '所有下载源均失败，请稍后重试或手动下载' });
    }
  } catch (e) {
    sendToUpdateUI('update-error', { message: e.message || '下载失败' });
  }
}

/**
 * 快速下载更新包（走国内服务器，差分增量下载）
 * 通过 electron-updater 从服务器读取 latest.yml + blockmap，
 * 只下载与当前已安装版本不同的数据块，通常是几 MB 而非整个安装包
 * @param {Object} updateInfo - 更新信息
 * @returns {Promise<void>}
 */
async function doQuickDownloadUpdate(updateInfo) {
  sendToUpdateUI('start-download', {});

  try {
    const autoUpdater = getAutoUpdater();
    // 指向国内服务器，走差分下载
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: QUICK_DOWNLOAD_BASE,
      channel: 'latest',
    });

    // 检查服务器上的更新信息
    const result = await autoUpdater.checkForUpdates();
    if (!result || !result.updateInfo) {
      sendToUpdateUI('update-error', { message: '服务器上没有可用的更新信息' });
      return;
    }

    _officialActive = true;

    // 差分下载（只下载变化的数据块）
    await autoUpdater.downloadUpdate((progress) => {
      sendToUpdateUI('download-progress', {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      });
    });

    updateDownloaded = true;
    sendToUpdateUI('update-downloaded', {
      version: result.updateInfo.version,
      releaseName: result.updateInfo.releaseName,
    });
    showUpdateReadyDialog({
      version: result.updateInfo.version,
      releaseName: result.updateInfo.releaseName,
    });
  } catch (e) {
    console.log('[Updater] Differential download failed, falling back to full mirrors');
    _officialActive = false;
    // 差分下载失败（如首次安装无旧版本数据），回退到多镜像全量下载
    await doDownloadUpdate(updateInfo);
  }
}

/**
 * 更新下载完成后弹窗询问是否立即安装
 * @param {Object} info - 更新信息
 */
function showUpdateReadyDialog(info) {
  const mw = _getMainWindow && _getMainWindow();
  if (!mw || mw.isDestroyed()) return;
  dialog.showMessageBox(mw, {
    type: 'info',
    title: '更新已就绪',
    message: 'VersePC v' + info.version + ' 已下载完成',
    detail: '点击"立即安装"将关闭应用并启动安装程序。',
    buttons: ['下次再说', '立即安装'],
    defaultId: 1,
    cancelId: 0,
  }).then(({ response }) => {
    if (response === 1) {
      runInstallerAndQuit();
    }
  }).catch(() => {});
}

/**
 * 启动安装程序并退出应用
 */
function runInstallerAndQuit() {
  if (!updateDownloadedPath || !fs.existsSync(updateDownloadedPath)) return;
  if (_setShuttingDown) _setShuttingDown(true);
  const { spawn } = require('child_process');
  spawn(updateDownloadedPath, ['/SILENT'], {
    detached: true,
    stdio: 'ignore',
    windowsVerbatimArguments: true,
  }).unref();
  app.quit();
}

/**
 * 注册更新相关 IPC 处理器
 */
function registerUpdaterIPC() {
  ipcMain.handle('updater:check-for-updates', async () => {
    try {
      updateAvailableInfo = null;
      sendToUpdateUI('checking-for-update');
      const updateInfo = await fetchUpdateJson();
      if (!updateInfo) {
        sendToUpdateUI('update-error', {
          message: '无法获取更新信息，请检查网络连接后重试',
          hint: '可尝试使用 VPN 或稍后再试'
        });
        return { available: false, error: '无法获取更新信息' };
      }
      const currentVersion = app.getVersion();
      if (compareVersions(updateInfo.version, currentVersion) > 0) {
        updateAvailableInfo = updateInfo;
        sendToUpdateUI('update-available', {
          version: updateInfo.version,
          releaseDate: updateInfo.releaseDate,
          releaseName: updateInfo.releaseName,
          releaseNotes: updateInfo.releaseNotes,
        });
        return { available: true, version: updateInfo.version };
      }
      sendToUpdateUI('update-not-available', { version: currentVersion });
      return { available: false, version: currentVersion };
    } catch (e) {
      sendToUpdateUI('update-error', { message: e.message || '检查更新失败' });
      return { available: false, error: e.message };
    }
  });

  ipcMain.handle('updater:download-update', async () => {
    try {
      if (!updateAvailableInfo) return { success: false, error: '没有可用的更新信息' };
      await doDownloadUpdate(updateAvailableInfo);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('updater:quick-download-update', async () => {
    try {
      if (!updateAvailableInfo) {
        // 未检测到更新时，读取服务器上最新的 update.json 作为来源
        const serverInfo = await fetchUpdateJson();
        if (serverInfo && compareVersions(serverInfo.version, app.getVersion()) > 0) {
          updateAvailableInfo = serverInfo;
        } else {
          return { success: false, error: '没有可用的更新信息' };
        }
      }
      await doQuickDownloadUpdate(updateAvailableInfo);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('updater:install-update', async () => {
    if (updateDownloaded) {
      // 官方增量通道：用 electron-updater 安装
      if (_officialActive) {
        try {
          const autoUpdater = getAutoUpdater();
          if (_setShuttingDown) _setShuttingDown(true);
          autoUpdater.quitAndInstall();
          return { success: true };
        } catch (e) {
          // 回退到镜像安装
        }
      }
      runInstallerAndQuit();
      return { success: true };
    }
    return { success: false, error: '更新尚未下载完成' };
  });

  ipcMain.handle('updater:get-version', async () => {
    return { version: app.getVersion() };
  });

  ipcMain.handle('updater:skip-version', async (event, version) => {
    const config = loadUpdateConfig();
    config.skippedVersion = version;
    saveUpdateConfig(config);
    updateAvailableInfo = null;
    return { success: true };
  });

  ipcMain.handle('updater:open-release-page', async () => {
    const repo = _isBeta ? 'VersePC-beta' : 'Verse';
    shell.openExternal('https://github.com/doujie081231/' + repo + '/releases/latest');
    return { success: true };
  });
}

/**
 * 注入主进程依赖
 * @param {Object} deps
 * @param {() => Electron.BrowserWindow | null} deps.getMainWindow - 主窗口 getter
 * @param {(v: boolean) => void} deps.setShuttingDown - 设置关闭标志
 * @param {boolean} deps.isBeta - 是否测试版
 */
function setup({ getMainWindow, setShuttingDown, isBeta }) {
  _getMainWindow = getMainWindow;
  _setShuttingDown = setShuttingDown;
  _isBeta = !!isBeta;
}

module.exports = {
  setup,
  initAutoUpdater,
  registerUpdaterIPC,
  getAutoUpdater,
  getUpdateDownloaded: () => updateDownloaded,
  getUpdateAvailableInfo: () => updateAvailableInfo,
  getUpdateDownloadedPath: () => updateDownloadedPath,
};
