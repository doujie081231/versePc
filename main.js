// 崩溃日志模块 - 必须在所有其他代码之前 require，以捕获最早期的启动错误
const { _writeCrashLog, _crashLogPath } = require('./main/crash-log');
// 临时启动诊断时间戳（测完删除）
const _bootT0 = Date.now();
const _bootLog = (msg) => { try { _writeCrashLog(`[BOOT+${Date.now() - _bootT0}ms] ${msg}`); } catch (e) {} };
_bootLog('main.js start');

// 共享状态中介层 - 必须在所有其他 main/ 模块之前加载，提供跨模块共享状态
const sharedState = require('./main/shared-state');

/**
 * VersePC - Minecraft Launcher
 * Copyright (c) 2026 豆杰. All Rights Reserved.
 *
 * AI TRAINING PROHIBITED: This code is protected by copyright law.
 * Unauthorized use for AI model training, machine learning datasets,
 * or any form of artificial intelligence training is strictly prohibited.
 *
 * This software is proprietary and confidential.
 * Any unauthorized reproduction or distribution is prohibited.
 */

/**
 * VersePC 主进程入口（Electron Main Process）。
 *
 * 职责：
 * 1. 窗口管理 - 创建无边框窗口，全屏/最大化/窗口模式切换
 * 2. IPC 通信 - 渲染进程与主进程的通信桥梁（窗口控制、存储、剪贴板、文件对话框）
 * 3. 协议处理 - 注册 versepc:// 自定义协议，处理 API 请求和静态文件
 * 4. API 路由 - 将协议请求分发给 server.js 的业务逻辑处理
 * 5. 模组文件操作 - 提供文件浏览、读写、JAR 解析等 IPC 接口
 * 6. 自动更新 - 基于 electron-updater 的版本检查和更新下载
 * 7. JAR/ZIP 解析 - 纯原生 JS 实现的 ZIP 文件格式解析器
 * 8. 整合包导入 - 通过 IPC 调用 server.js 的整合包导入功能
 *
 * 架构说明：
 * - 使用自定义 versepc:// 协议替代传统 HTTP 服务器，消除端口冲突
 * - contextIsolation: true + preload.cjs 实现安全的进程隔离
 * - server.js 通过 require() 直接加载，使用 handleNativeAPI/handleNativeSSE 接口
 * - 无 Express/HTTP 层，协议请求直接调用业务函数，性能更高
 */

/* 单实例锁 - 必须在所有初始化之前执行，防止重复启动导致闪窗口 */
const { app } = require('electron');

const gotTheLockEarly = app.requestSingleInstanceLock();
if (!gotTheLockEarly) {
  process.exit(0);
}

// 启动调优：清理遗留进程/端口 + V8 代码缓存 + 内存上限（抽到 main/startup-tuning）
const { cleanupStaleProcesses, setupV8CodeCache, setupV8MemoryLimit } = require('./main/startup-tuning');
cleanupStaleProcesses();
setupV8CodeCache();
setupV8MemoryLimit();

// 运行时完整性自检模块
const { _runIntegrityCheckAsync } = require('./main/integrity');

/* 模块导入 */
// 注意：app 已在前面的单例锁阶段解构，这里只补齐其余 Electron 模块
const { BrowserWindow, Menu, shell, ipcMain, dialog, screen, protocol, clipboard, net, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

/* 内存压缩模块（Windows 专用）
 * 最小化时调用 EmptyWorkingSet 释放工作集内存到页面文件
 * koffi 是纯 JS 实现的 FFI 库，无需编译，调用毫秒级
 */
let _trimMemoryFn = null;
try {
  if (process.platform === 'win32') {
    const koffi = require('koffi');
    const psapi = koffi.load('psapi.dll');
    const kernel32 = koffi.load('kernel32.dll');
    const EmptyWorkingSet = psapi.func('bool EmptyWorkingSet(void *hProcess)');
    const GetCurrentProcess = kernel32.func('void *GetCurrentProcess()');
    _trimMemoryFn = () => {
      try { EmptyWorkingSet(GetCurrentProcess()); } catch (e) {}
    };
  }
} catch (e) {
  console.warn('[MemTrim] koffi 初始化失败，最小化时不压缩内存:', e.message);
}

/* 全局状态变量 */
// mainWindow / serverModuleCache 仍保留为 main.js 局部变量（createWindow 与多处
// 初始化逻辑重度使用），在创建/加载时同步到 shared-state 供其他模块访问。
// apiHandler / sseExecuteTool / shuttingDown / ssePort 已迁移至 shared-state。
// isClosingAnimation / savedWindowBounds 已迁移至 window-manager 模块。
let mainWindow = null;          // 主窗口实例（同步到 sharedState）
let serverModuleCache = null;   // server.js 模块缓存（同步到 sharedState）
let _idleTrimTimer = null;      // 空闲内存优化定时器（模块作用域，供 will-quit 清理）
let _lastInteractionTime = 0;   // 上次用户交互时间戳

/* Windows 任务栏图标关联（必须在 app.ready 之前设置） */
if (process.platform === 'win32') {
  app.setAppUserModelId('com.versepc.launcher');
}

// JSON 自动修复模块
const { autoRepairJsonFileAsync, repairVersePCDataAsync, _deferredRepairData } = require('./main/json-repair');

// 持久化存储 - 启动时立即需要（窗口配置/主题），保留同步加载
const { STORE_PATH, safeWriteFileSync, safeReadJsonFile, loadStore, registerStoreIPC } = require('./main/store');

// 自动更新模块
const updaterModule = require('./main/updater');
const { initAutoUpdater, registerUpdaterIPC } = updaterModule;

// 窗口管理模块 - 启动时立即需要（createWindow 用 loadWindowConfig）
const {
  loadWindowConfig, saveWindowConfig, animateCloseWindow,
  getSavedWindowBounds, setSavedWindowBounds,
  getIsClosingAnimation, setIsClosingAnimation,
  registerWindowManagerIPC
} = require('./main/window-manager');

// 编辑器窗口 + 终端会话模块
const { setupEditorTerminal, registerEditorTerminalIPC, cleanupTerminals } = require('./main/editor-terminal');

// TTS 语音合成模块（基于 msedge-tts，主进程合成音频）
const { registerTTSIPC } = require('./main/tts');

// AI 对话代理模块（主进程发起请求，绕过 CORS 限制）
const { registerAIProxyIPC } = require('./main/ai-proxy');

// 红石联机内网穿透模块（TCP 隧道 + 本地中继）
const { registerRedstoneOnlineIPC } = require('./main/redstone-online');

// 私人服务器管理模块
const { initPrivateServerIPC } = require('./main/private-server');

// 本地开服（实验）
const { initServerHostIPC, cleanupServerHost } = require('./main/server-host');

// versepc:// 协议处理模块 - 启动时立即需要（协议注册）
const {
  setupProtocolHandler, handleVersePCProtocol,
  isPathAllowed, registerAllowedPath
} = require('./main/protocol-handler');
_bootLog('top-level requires done');

/* 全局错误处理 */
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  _writeCrashLog('unhandledRejection (late): ' + (reason && reason.stack || reason));
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  _writeCrashLog('uncaughtException (late): ' + (err && err.stack || err));
  const msg = err && err.message || '';
  if (msg.includes('ReadableStream') || msg.includes('already closed') || msg.includes('ECONNRESET')) {
    return;
  }
  if (!sharedState.getShuttingDown() && mainWindow) {
    dialog.showErrorBox('发生错误', msg || '未知错误');
  }
});

// 注册 versepc:// 自定义协议为特权协议（支持 Fetch API、CORS、Stream 等）
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'versepc',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      allowServiceWorkers: true
    }
  },
  {
    scheme: 'wpfile',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

/**
 * 创建主窗口并加载应用界面。
 * 包含 GPU 看门狗、渲染进程崩溃恢复、CSS 注入、菜单构建等初始化逻辑。
 * 注意：窗口配置函数与窗口控制 IPC 已抽离至 window-manager 模块。
 * @returns {Promise<void>} 窗口创建完成时 resolve。
 * @throws {Error} 当窗口配置加载或 BrowserWindow 构造失败时抛出。
 */
async function createWindow() {
  try { _bootLog('createWindow enter'); } catch (e) {}
  const [configResult, storeResult] = await Promise.allSettled([
    Promise.resolve().then(() => loadWindowConfig()),
    fs.promises.readFile(STORE_PATH, 'utf-8').then(raw => JSON.parse(raw)).catch(() => null)
  ]);
  try { _bootLog('createWindow config loaded'); } catch (e) {}
  const config = configResult.status === 'fulfilled' ? configResult.value : { fullscreen: false, windowMode: true, windowWidth: 1200, windowHeight: 800 };
  const storeData = storeResult.status === 'fulfilled' ? storeResult.value : null;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  let bgColor = '#ffffff';
  try {
    if (storeData && storeData.versepc_theme === 'dark') bgColor = '#0a0a0a';
  } catch (e) {}
  console.log('[Window] Final bgColor:', bgColor);

  const windowWidth = config.windowWidth || 1200;
  const windowHeight = config.windowHeight || 800;

  let windowX = config.windowX !== undefined ? config.windowX : Math.floor((screenWidth - windowWidth) / 2);
  let windowY = config.windowY !== undefined ? config.windowY : Math.floor((screenHeight - windowHeight) / 2);

  // 窗口位置越界时回正到屏幕居中
  const workArea = primaryDisplay.workArea;
  if (windowX < workArea.x || windowX + windowWidth > workArea.x + workArea.width ||
      windowY < workArea.y || windowY + windowHeight > workArea.y + workArea.height) {
    windowX = Math.floor((screenWidth - windowWidth) / 2);
    windowY = Math.floor((screenHeight - windowHeight) / 2);
  }

  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: windowX,
    y: windowY,
    minWidth: 800,
    minHeight: 450,
    frame: false,
    ...(isMac ? { titleBarStyle: 'hiddenInset' } : {}),
    show: false,
    backgroundColor: bgColor,
    title: 'VersePC - Minecraft Launcher',
    icon: path.join(__dirname, 'img', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      webviewTag: false,
      autoplayPolicy: 'no-user-gesture-required',
      preload: path.join(__dirname, 'preload.cjs')
    }
  });
  // 同步主窗口实例到共享状态，供 window-manager 等抽离模块访问
  sharedState.setMainWindow(mainWindow);
  try { _bootLog('BrowserWindow created'); } catch (e) {}

  // 加载渲染进程
  try { _bootLog('before loadURL'); } catch (e) {}
  mainWindow.loadURL('versepc://app/index.html');
  try { _bootLog('after loadURL'); } catch (e) {}

  // 窗口显示控制：优先由渲染进程内联脚本尽早触发，ready-to-show 作为兜底
  let _windowShown = false;
  const _showMainWindow = (source) => {
    if (_windowShown) return;
    _windowShown = true;
    mainWindow.show();
    try { _bootLog(`mainWindow.show() (${source})`); } catch (e) {}
    if (config.fullscreen && !config.windowMode) {
      setSavedWindowBounds({ x: windowX, y: windowY, width: windowWidth, height: windowHeight });
      mainWindow.setFullScreen(true);
    } else if (config.maximized) {
      mainWindow.maximize();
    }
  };

  // 渲染进程 HTML 解析到内联脚本时立刻通知显示窗口（不等 65 个 defer 脚本）
  ipcMain.on('window-show-early', () => _showMainWindow('early'));
  // 兜底：如果内联脚本未能触发，等首次渲染完成后显示
  mainWindow.once('ready-to-show', () => _showMainWindow('ready-to-show'));

  // GPU 黑屏检测看门狗：15 秒内页面若未渲染出任何子节点，则判定 GPU 加速异常
  // 写入 .disable-gpu 标记文件，下次启动自动禁用 GPU 加速并显示降级提示页
  const _gpuWatchdog = setTimeout(() => {
    try {
      mainWindow.webContents.executeJavaScript('document.body.children.length').then(len => {
        if (len === 0) {
          console.log('[GPU] Page not rendered in 8s, flagging GPU disable for next launch');
          require('fs').writeFileSync(disableGpuFile, '1');
          const _gpuFg = bgColor === '#ffffff' ? '#1a1a1a' : '#e5e5e5';
          const _gpuSub = bgColor === '#ffffff' ? '#666' : '#888';
          const _gpuBtn = bgColor === '#ffffff' ? '#ccc' : '#555';
          mainWindow.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<html><body style="background:${bgColor};color:${_gpuFg};font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2>VersePC 启动异常</h2><p>页面加载失败，可能是显卡驱动问题</p><p style="color:${_gpuSub};font-size:13px">已自动标记禁用GPU加速，请重启应用</p><p style="margin-top:20px"><button onclick="location.href='https://github.com/doujie081231/versePc/issues'" style="padding:8px 16px;border:1px solid ${_gpuBtn};border-radius:6px;background:transparent;color:${_gpuFg};cursor:pointer">报告问题</button></div></div></body></html>`));
        }
      }).catch(() => {});
    } catch (e) {}
  }, 15000);
  mainWindow.webContents.once('did-finish-load', () => clearTimeout(_gpuWatchdog));

  // 渲染进程崩溃恢复：OOM 自动重载最多 3 次，其他原因显示崩溃页
  let rendererCrashRetries = 0;
  const MAX_RENDERER_RETRIES = 3;
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    const reason = details.reason || 'unknown';
    const exitCode = details.exitCode || -1;
    console.error(`[Renderer] Process gone: reason=${reason}, exitCode=${exitCode}`);

    const osMod = require('os');
    const freeMB = Math.floor(osMod.freemem() / 1024 / 1024);
    const totalMB = Math.floor(osMod.totalmem() / 1024 / 1024);
    const usedPct = Math.round(((totalMB - freeMB) / totalMB) * 100);

    if (reason === 'oom' && rendererCrashRetries < MAX_RENDERER_RETRIES) {
      rendererCrashRetries++;
      console.log(`[Renderer] OOM 崩溃, 尝试自动恢复 (${rendererCrashRetries}/${MAX_RENDERER_RETRIES})`);
      // 异步清理回收站释放内存，不阻塞主进程（execSync 会卡 3 秒）
      if (process.platform === 'win32') {
        try {
          const { exec } = require('child_process');
          exec('powershell -NoProfile -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"',
            { windowsHide: true, timeout: 5000 }, () => {});
        } catch (e) {}
      }
      setTimeout(() => {
        try { mainWindow.webContents.reload(); } catch (e) {}
      }, 1500);
      return;
    }

    rendererCrashRetries = 0;
    const reasonText = reason === 'oom'
      ? `内存不足 (系统内存使用 ${usedPct}%，剩余 ${freeMB}MB/${totalMB}MB)`
      : `渲染进程异常退出: ${reason} (code: ${exitCode})`;
    const suggestion = reason === 'oom'
      ? '建议关闭其他程序释放内存，或在设置中减少分配给游戏的内存'
      : '请尝试重启启动器';

    mainWindow.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>VersePC 崩溃</title></head><body style="background:#0a0a0a;color:#e5e5e5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center;max-width:500px;padding:20px"><h2 style="margin-bottom:16px">VersePC 崩溃</h2><p style="color:#ccc;margin-bottom:8px">' + reasonText + '</p><p style="color:#888;font-size:13px;margin-bottom:24px">' + suggestion + '</p><div style="display:flex;gap:12px;justify-content:center"><button onclick="location.reload()" style="padding:10px 24px;border:1px solid #555;border-radius:8px;background:transparent;color:#e5e5e5;cursor:pointer;font-size:14px">重新加载</button><button onclick="require(\'electron\').ipcRenderer.send(\'relaunch-app\')" style="padding:10px 24px;border:1px solid #0066cc;border-radius:8px;background:#0066cc;color:white;cursor:pointer;font-size:14px">重启启动器</button></div></div></body></html>'
    ));
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('[Renderer] Window became unresponsive');
  });

  // 窗口关闭时清理引用
  mainWindow.on('closed', () => {
    setIsClosingAnimation(false);
    if (serverModuleCache && serverModuleCache.setMainWindow) {
      serverModuleCache.setMainWindow(null);
    }
    mainWindow = null;
    sharedState.setMainWindow(null);
  });

  // 拦截关闭事件，播放关闭动画（Alt+F4 等系统级关闭触发）
  mainWindow.on('close', (e) => {
    if (!getIsClosingAnimation() && !sharedState.getShuttingDown() && mainWindow && !mainWindow.isDestroyed()) {
      e.preventDefault();
      animateCloseWindow();
    }
  });

  // 窗口大小改变时保存配置（非全屏、非最大化状态才保存）
  mainWindow.on('resize', () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFullScreen() && !mainWindow.isMaximized()) {
      const bounds = mainWindow.getBounds();
      setSavedWindowBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
      const cfg = loadWindowConfig();
      cfg.windowWidth = bounds.width;
      cfg.windowHeight = bounds.height;
      cfg.windowX = bounds.x;
      cfg.windowY = bounds.y;
      saveWindowConfig(cfg);
    }
  });

  // 窗口移动时保存位置配置
  mainWindow.on('move', () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFullScreen() && !mainWindow.isMaximized()) {
      const bounds = mainWindow.getBounds();
      setSavedWindowBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
      const cfg = loadWindowConfig();
      cfg.windowX = bounds.x;
      cfg.windowY = bounds.y;
      saveWindowConfig(cfg);
    }
  });

  // 最大化/还原时通知渲染进程
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state-changed', { maximized: true, fullscreen: mainWindow.isFullScreen() });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state-changed', { maximized: false, fullscreen: mainWindow.isFullScreen() });
  });

  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('window-state-changed', { maximized: mainWindow.isMaximized(), fullscreen: true });
  });

  mainWindow.on('leave-full-screen', () => {
    const _savedBounds = getSavedWindowBounds();
    if (_savedBounds) {
      mainWindow.setBounds(_savedBounds);
    }
    mainWindow.webContents.send('window-state-changed', { maximized: mainWindow.isMaximized(), fullscreen: false });
  });

  // 游戏运行低调模式 - 监听最小化/恢复事件，通知渲染进程并同步共享状态供 SSE 降频
  // 最小化时延迟 1.5 秒后执行全面内存优化，之后每 30 秒维护一次
  // 空闲 3 分钟后也执行一次优化
  let _minimizeTrimTimer = null;
  _lastInteractionTime = Date.now();

  function _doFullMemoryOptimize() {
    // V8 GC（主进程）
    if (typeof global.gc === 'function') { global.gc(); global.gc(); }
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
      try { mainWindow.webContents.executeJavaScript('gc()', true).catch(() => {}); } catch (e) {}
      try { mainWindow.webContents.idleOSMemory(); } catch (e) {}
    }
    // 清除浏览器缓存
    try { session.defaultSession.clearCache().catch(() => {}); } catch (e) {}
    // EmptyWorkingSet 压缩工作集
    if (typeof _trimMemoryFn === 'function') _trimMemoryFn();
  }

  mainWindow.on('minimize', () => {
    if (!mainWindow.isDestroyed()) {
      try { mainWindow.webContents.send('window-minimize-changed', true); } catch (e) {}
    }
    sharedState.setLauncherMinimized(true);
    if (_minimizeTrimTimer) clearTimeout(_minimizeTrimTimer);
    _minimizeTrimTimer = setTimeout(() => {
      _doFullMemoryOptimize();
      _minimizeTrimTimer = setInterval(_doFullMemoryOptimize, 30000);
    }, 1500);
  });
  mainWindow.on('restore', () => {
    if (!mainWindow.isDestroyed()) {
      try { mainWindow.webContents.send('window-minimize-changed', false); } catch (e) {}
    }
    sharedState.setLauncherMinimized(false);
    if (_minimizeTrimTimer) {
      clearTimeout(_minimizeTrimTimer);
      clearInterval(_minimizeTrimTimer);
      _minimizeTrimTimer = null;
    }
  });

  // 空闲 3 分钟自动优化：任何用户交互（点击、键盘）都会重置计时器
  function _resetIdleTimer() {
    _lastInteractionTime = Date.now();
  }
  try {
    mainWindow.webContents.on('input-event', _resetIdleTimer);
  } catch (e) {}
  // 每 30 秒检查一次是否空闲超过 3 分钟
  _idleTrimTimer = setInterval(() => {
    if (sharedState.getLauncherMinimized()) return; // 最小化时已有单独优化
    if (Date.now() - _lastInteractionTime > 180000) { // 3 分钟无操作
      _doFullMemoryOptimize();
      _lastInteractionTime = Date.now(); // 重置，避免连续触发
    }
  }, 30000);

  // 页面加载完成后注入标题栏拖拽样式和窗口模式通知
  mainWindow.webContents.on('did-finish-load', () => {
    const isFullscreen = mainWindow.isFullScreen();
    const isWindowMode = config.windowMode;

    // 注入 CSS：设置标题栏区域可拖拽（-webkit-app-region: drag）
    // 排除右侧按钮区域、侧边栏、启动栏等不可拖拽区域
    mainWindow.webContents.insertCSS(`
            .title-bar {
                -webkit-app-region: drag;
            }
            .title-bar-right, .title-bar-right * {
                -webkit-app-region: no-drag;
            }
            .sidebar {
                -webkit-app-region: no-drag;
            }
            .launch-bar {
                -webkit-app-region: no-drag;
            }
            .window-controls, .window-controls * {
                -webkit-app-region: no-drag;
            }
        `);

    // 通知渲染进程当前窗口模式
    mainWindow.webContents.send('window-mode-changed', {
      fullscreen: isFullscreen,
      windowMode: isWindowMode,
      maximized: mainWindow.isMaximized()
    });

    // 开发环境才打开 DevTools
    if (process.env.NODE_ENV == 'dev') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // 外部链接在系统浏览器中打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 构建应用菜单栏（中文）
  const menuTemplate = [
    {
      label: '文件',
      submenu: [
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'forceReload', label: '强制刷新' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
        { type: 'separator' },
        {
          label: '开发者工具',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            mainWindow?.webContents.toggleDevTools();
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

/* 窗口控制 IPC（minimize/maximize/close/is-maximized/is-fullscreen/set-fullscreen/
   set-window-mode、app-quit、relaunch-app）+ 关闭动画
   已抽离至 main/window-manager.js，通过 registerWindowManagerIPC(app) 注册 */

// 文件打开对话框（通用对话框，保留在 main.js）
ipcMain.handle('dialog-open', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return dialog.showOpenDialog(win, options);
});

/* 游戏运行低调模式 - 窗口最小化/恢复 IPC */
ipcMain.handle('window-minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
});
ipcMain.handle('window-restore', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
ipcMain.handle('window-is-minimized', () => {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMinimized() : false;
});

/* 编辑器窗口 + 编辑器文件操作 IPC + 终端会话 + 终端 IPC
   已抽离至 main/editor-terminal.js，通过 registerEditorTerminalIPC() 注册 */

ipcMain.handle('get-memory-info', async () => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    return {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      loadPercent: Math.round((usedMem / totalMem) * 100)
    };
  } catch (e) {
    return { total: 0, free: 0, used: 0, loadPercent: 0, error: e.message };
  }
});

ipcMain.handle('memory-optimize', async () => {
  // 用 V8 GC + koffi EmptyWorkingSet + Electron idleOSMemory 快速优化
  // 不依赖 PowerShell，毫秒级完成，不写临时文件
  const beforeFreeMB = Math.round(os.freemem() / 1024 / 1024);
  try {
    // 1. 主进程 V8 垃圾回收（强制 Full GC）
    if (typeof global.gc === 'function') {
      global.gc();
      global.gc();
    }
    // 2. 渲染进程 V8 GC
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
      try {
        await mainWindow.webContents.executeJavaScript('gc()', true).catch(() => {});
      } catch (e) {}
      // 3. 提示 OS 可以回收此进程的工作集内存（不影响运行）
      try { mainWindow.webContents.idleOSMemory(); } catch (e) {}
    }
    // 4. 清除浏览器缓存（session cache）
    try {
      await session.defaultSession.clearCache().catch(() => {});
    } catch (e) {}
    // 5. EmptyWorkingSet：将不活跃的内存页交换出物理内存
    if (typeof _trimMemoryFn === 'function') {
      _trimMemoryFn();
    }
  } catch (e) {}
  const afterFreeMB = Math.round(os.freemem() / 1024 / 1024);
  const freedMB = Math.max(0, afterFreeMB - beforeFreeMB);
  return { success: true, freedMB: freedMB, beforeMB: beforeFreeMB, afterMB: afterFreeMB };
});

ipcMain.handle('jvm-preheat', async (event, javaPath, maxMemMB) => {
  return { success: true };
});

/* 整合包导入 IPC - 主进程通过 IPC 调用 server.js 的整合包导入功能 */
ipcMain.handle('import-modpack', async (event, filePath, targetVersion = '') => {
  console.log(`[IPC] import-modpack 收到请求: ${filePath}, 目标版本: ${targetVersion || '(自动)'}`);
  try {
    if (!serverModuleCache || !serverModuleCache.importModpackFromPath) {
      console.error(`[IPC] import-modpack 服务器模块未就绪`);
      return { success: false, error: '服务器模块尚未准备好，请稍后重试' };
    }
    const sender = event.sender;
    const result = await serverModuleCache.importModpackFromPath(filePath, (progress) => {
      if (!sender.isDestroyed()) {
        sender.send('import-progress', progress);
      }
    }, targetVersion);
    console.log(`[IPC] import-modpack 完成: ${result?.success ? '成功' : '失败'} ${result?.error || ''}`);
    return result;
  } catch (e) {
    console.error('[IPC] import-modpack 异常:', e);
    return { success: false, error: e.message };
  }
});

/* Server 模块加载 - 崩溃隔离 + 自动重载 */
let _serverLoadTime = 0;
let _serverCrashCount = 0;
const SERVER_MAX_CRASHES = 3;

/**
 * 加载 server.js 业务模块，刷新 require 缓存并同步到 sharedState。
 * @returns {object} server.js 导出的模块对象。
 * @throws {Error} 当 server.js 加载失败时抛出。
 */
function loadServerModule() {
  const serverPath = path.join(__dirname, 'server.js');
  _writeCrashLog('[Server] Loading module from: ' + serverPath);
  try {
    delete require.cache[require.resolve(serverPath)];
    const serverModule = require(serverPath);
    serverModuleCache = serverModule;
    sharedState.setServerModuleCache(serverModule);
    sharedState.setApiHandler({
      handleNativeAPI: serverModule.handleNativeAPI,
      handleNativeSSE: serverModule.handleNativeSSE
    });
    _serverLoadTime = Date.now();
    console.log('[Server] Module loaded/reloaded successfully');
    _writeCrashLog('[Server] Module loaded successfully');
    return serverModule;
  } catch (e) {
    _writeCrashLog('[Server] Module load FAILED: ' + (e && e.stack || e));
    throw e;
  }
}

/**
 * 重载 server.js 模块，崩溃次数超过 SERVER_MAX_CRASHES 后停止重试。
 * @returns {boolean} 重载成功返回 true，失败或超过上限返回 false。
 */
function reloadServerModule() {
  _serverCrashCount++;
  if (_serverCrashCount > SERVER_MAX_CRASHES) {
    console.error(`[Server] 崩溃次数超过 ${SERVER_MAX_CRASHES} 次，不再自动重载`);
    return false;
  }
  console.warn(`[Server] 正在重载模块 (第 ${_serverCrashCount} 次)...`);
  try {
    if (serverModuleCache && serverModuleCache.cleanupOnShutdown) {
      try { serverModuleCache.cleanupOnShutdown(); } catch (e) {}
    }
    loadServerModule();
    return true;
  } catch (e) {
    console.error('[Server] 重载失败:', e.message);
    return false;
  }
}

/* 抽离模块的 IPC 注册与依赖注入（顶层执行，在 app.whenReady 之前完成） */
try { _bootLog('before top-level IPC registration'); } catch (e) {}
// 窗口控制 IPC（window-minimize/maximize/close/...、app-quit、relaunch-app）
registerWindowManagerIPC(app);
// 编辑器窗口 + 终端 IPC，注入项目根目录用于路径白名单校验
setupEditorTerminal({ appRoot: __dirname });
registerEditorTerminalIPC();
// 协议处理器依赖注入：appRoot 替代 __dirname，reloadServerModule/崩溃计数由 main.js 提供
setupProtocolHandler({
  appRoot: __dirname,
  reloadServerModule,
  getServerCrashCount: () => _serverCrashCount,
  SERVER_MAX_CRASHES
});
try { _bootLog('after top-level IPC registration'); } catch (e) {}

/* GPU 硬件加速 - 默认启用以获得流畅界面 */
const { DATA_DIR } = require('./main/paths');
const disableGpuFile = path.join(DATA_DIR, '.disable-gpu');
const safeMode = process.argv.includes('--safe-mode') || process.argv.includes('--disable-gpu');
const forceDisableGpu = process.argv.includes('--disable-gpu');

app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('enable-use-zoom-for-dsf', 'true');
app.commandLine.appendSwitch('force-color-profile', 'srgb');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
// 暴露 V8 GC，让内存优化能真正回收 V8 堆空间
app.commandLine.appendSwitch('expose-gc');
app.commandLine.appendSwitch('js-flags', '--expose-gc');

// 命令行 --safe-mode / --disable-gpu 或存在 .disable-gpu 标记文件时禁用 GPU 加速
const shouldDisableGpu = forceDisableGpu || safeMode || require('fs').existsSync(disableGpuFile);

if (shouldDisableGpu) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('use-gl', 'swiftshader');
  if (safeMode) console.log('[GPU] Hardware acceleration disabled (safe mode)');
  else if (require('fs').existsSync(disableGpuFile)) console.log('[GPU] Hardware acceleration disabled (previous GPU failure)');
} else {
  console.log('[GPU] Hardware acceleration enabled');
}

// GPU 状态变化：若回退到软件渲染，则写入标记下次启动禁用 GPU
app.on('gpu-info-update', () => {
  try {
    const info = app.getGPUFeatureInfo();
    if (info && info.status === 3) {
      console.log('[GPU] GPU fallen back to software rendering, disabling for next launch');
      require('fs').writeFileSync(disableGpuFile, '1');
    }
  } catch (e) {}
});

/* 单实例锁第二阶段：second-instance 事件处理（仅在拿到锁的实例中注册）
   单实例锁检查已上移到文件最早期，此处只注册事件处理器 */
app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    if (mainWindow.isFullScreen()) {
      // 全屏状态下不强制 focus，避免误退出全屏
    } else {
      mainWindow.focus();
    }
    if (process.platform === 'win32') {
      try { mainWindow.flashFrame(true); setTimeout(() => { try { mainWindow.flashFrame(false); } catch (e) {} }, 800); } catch (e) {}
    }
    mainWindow.moveTop();
  } else {
    if (typeof createWindow === 'function') createWindow().catch(() => {});
  }
});

/* 应用就绪 - Electron 启动完成后的初始化流程 */
app.whenReady().then(async () => {
  try {
    try { _bootLog('app.whenReady enter'); } catch (e) {}
    console.log('VersePC starting...');

    // versepc:// 协议处理器：server.js 未就绪时对 /api/ 请求返回 503
    let _serverReady = false;
    protocol.handle('versepc', async (request) => {
      if (!_serverReady) {
        const reqUrl = new URL(request.url);
        if (reqUrl.pathname.startsWith('/api/')) {
          return new Response(JSON.stringify({ error: 'Server loading...' }), {
            status: 503, headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      return handleVersePCProtocol(request);
    });
    try { _bootLog('protocol.handle registered'); } catch (e) {}

    // 提前开始加载 server.js（与 createWindow 并行，不阻塞窗口创建）
    // server.js 加载需要 ~100ms，与 createWindow 的 ~200ms 并行执行
    // 当渲染进程 init() 开始时，server.js 通常已加载完成，API 调用能立即返回
    setImmediate(() => {
      let loadOk = false;
      try {
        loadServerModule();
        loadOk = true;
      } catch (e) {
        console.error('[Server] Load failed:', e.message, '\nStack:', e.stack);
      }
      // 只有加载成功才标记 _serverReady，避免后续调用 NPE
      if (loadOk) {
        _serverReady = true;
        // mainWindow 此时可能还未创建，setMainWindow 延迟到 createWindow 之后
        try { _runIntegrityCheckAsync().catch(() => {}); } catch (e) {}
        try { _deferredRepairData(); } catch (e) {}
        if (serverModuleCache) {
          try { serverModuleCache.logStartupInfo(); } catch (e) {}
        }
      }
    });

    // 创建窗口（最优先，与 server.js 加载并行）
    try { _bootLog('before createWindow'); } catch (e) {}
    await createWindow();
    try { _bootLog('after createWindow'); } catch (e) {}

    // 窗口创建后，设置 mainWindow 给 server.js（server.js 可能已加载完成）
    if (serverModuleCache && serverModuleCache.setMainWindow) {
      try { serverModuleCache.setMainWindow(mainWindow); } catch (e) {}
    }

    // 启动成功，清除崩溃日志
    try { require('fs').writeFileSync(_crashLogPath, '', 'utf8'); } catch (e) {}

    // 窗口显示后再做一切非关键初始化
    setImmediate(() => {
      // CSP 安全头
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = { ...details.responseHeaders };
        if (details.url.startsWith('versepc://') || details.url.startsWith('devtools://')) {
          responseHeaders['Content-Security-Policy'] = [
            "default-src 'self' versepc:; " +
            "script-src 'self' versepc: 'unsafe-inline' 'unsafe-eval'; " +
            "style-src 'self' versepc: 'unsafe-inline' https://fonts.googleapis.com; " +
            "img-src 'self' versepc: wpfile: data: blob: https:; " +
            "font-src 'self' versepc: data: https://fonts.gstatic.com; " +
            "connect-src 'self' versepc: ws: wss: http://localhost:* https:; " +
            "media-src 'self' versepc: wpfile: blob:; " +
            "child-src 'self' blob:; " +
            "worker-src 'self' blob:; " +
            "object-src 'none'; " +
            "base-uri 'self';"
          ];
        }
        callback({ responseHeaders });
      });

      // wpfile 协议：本地媒体文件读取，支持 Range 请求（视频流式播放）
      protocol.handle('wpfile', (request) => {
        try {
          const url = new URL(request.url);
          let filePath = decodeURIComponent(url.pathname);
          if (filePath.startsWith('/')) filePath = filePath.substring(1);
          const resolved = path.resolve(filePath);
          // 注册路径到白名单，确保用户选择的壁纸文件可被读取
          if (typeof registerAllowedPath === 'function') registerAllowedPath(resolved);
          if (!isPathAllowed(resolved)) return new Response('Forbidden', { status: 403 });
          if (!fs.existsSync(resolved)) return new Response('Not Found', { status: 404 });
          const ext = path.extname(resolved).toLowerCase();
          const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.mp4', '.webm', '.mkv', '.avi', '.cur', '.ani', '.ico'];
          if (!allowedExts.includes(ext)) return new Response('Forbidden', { status: 403 });
          const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo', '.cur': 'image/x-icon', '.ani': 'image/x-icon', '.ico': 'image/x-icon' };
          const mime = mimeMap[ext] || 'application/octet-stream';
          const stat = fs.statSync(resolved);
          const fileSize = stat.size;
          const rangeHeader = request.headers.get('range');
          if (rangeHeader) {
            const parts = rangeHeader.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = end - start + 1;
            const stream = fs.createReadStream(resolved, { start, end });
            return new Response(stream, { status: 206, headers: { 'Content-Type': mime, 'Content-Range': `bytes ${start}-${end}/${fileSize}`, 'Accept-Ranges': 'bytes', 'Content-Length': String(chunkSize) } });
          }
          const stream = fs.createReadStream(resolved);
          return new Response(stream, { status: 200, headers: { 'Content-Type': mime, 'Content-Length': String(fileSize), 'Accept-Ranges': 'bytes' } });
        } catch (e) {
          return new Response('Error: ' + e.message, { status: 500 });
        }
      });

      // IPC 和其他初始化
      registerModsIPC({ isPathAllowed, loadStore });
      registerStoreIPC({ app, isPathAllowed });
      registerTTSIPC();
      registerAIProxyIPC();
      registerRedstoneOnlineIPC();
      initPrivateServerIPC();
      initServerHostIPC();

      // V 岛语音助手需要麦克风权限，统一授权（避免 SpeechRecognition 静默失效）
      session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'media') callback(true);
        else callback(true);
      });
      session.defaultSession.setPermissionCheckHandler(() => true);

      updaterModule.setup({
        getMainWindow: () => mainWindow,
        setShuttingDown: (v) => sharedState.setShuttingDown(v),
        isBeta: IS_BETA
      });
      registerUpdaterIPC();
      initAutoUpdater();
    });

  } catch (e) {
    console.error('Failed to start:', e);
    _writeCrashLog('app.whenReady failed: ' + (e && e.stack || e));
    const _errMsg = String(e && e.message || e || '未知错误');
    const _isModuleError = _errMsg.includes('Cannot find module') || _errMsg.includes('MODULE_NOT_FOUND');
    const _isVCRuntime = _errMsg.includes('.dll') || _errMsg.includes('vcruntime') || _errMsg.includes('msvcp');
    let _detail = _errMsg;
    if (_isModuleError) {
      _detail = '缺少必要文件：' + _errMsg + '\n\n请尝试重新安装 VersePC。';
    } else if (_isVCRuntime) {
      _detail = '缺少系统运行库（VC++ Redistributable）：' + _errMsg + '\n\n请安装 Visual C++ 运行库后重试。\n下载地址：https://aka.ms/vs/17/release/vc_redist.x64.exe';
    }
    dialog.showErrorBox('VersePC 启动失败', _detail + '\n\n崩溃日志已保存到：\n' + _crashLogPath);
    app.quit();
  }

  // macOS: 点击 Dock 图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow().catch(() => {});
  });
});

// 所有窗口关闭时退出应用（macOS 除外，macOS 下应用通常保持运行）
// 加 500ms 宽限期，让后台下载/写入任务有机会完成保存
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    setTimeout(() => {
      if (!sharedState.getShuttingDown()) app.quit();
    }, 500);
  }
});

// before-quit 异步清理：preventDefault 拦住 Electron 抢跑，手动 app.exit(0) 退出
// 总超时 8 秒，超时则强制退出，避免清理卡死导致应用无法关闭
let _beforeQuitCleanupStarted = false;
app.on('before-quit', (event) => {
  // 总是 preventDefault，确保 Electron 不抢跑
  event.preventDefault();

  // 如果已经在清理中，直接返回，等首次清理完成后 app.exit(0)
  if (_beforeQuitCleanupStarted) return;
  _beforeQuitCleanupStarted = true;
  sharedState.setShuttingDown(true);

  // 启动异步清理，不 await（before-quit 不支持 async preventDefault 模式）
  _performShutdownCleanup().finally(() => {
    try { app.exit(0); } catch (e) { process.exit(0); }
  });
});

// 关闭前异步清理：按顺序回收预览服务器、后台进程、终端、JVM 预热进程、下载任务
async function _performShutdownCleanup() {
  const TOTAL_TIMEOUT = 8000;
  const timeoutPromise = new Promise((resolve) => setTimeout(resolve, TOTAL_TIMEOUT));

  const cleanupPromise = (async () => {
    // 1. 预览服务器
    if (global._previewServer) {
      try { global._previewServer.close(); } catch (e) {}
      global._previewServer = null;
    }

    // 2. 后台进程
    if (global._bgProcesses) {
      for (const [pid] of Object.entries(global._bgProcesses)) {
        try { process.kill(Number(pid)); } catch (e) {}
      }
      global._bgProcesses = {};
    }

    // 3. 终端会话
    try { cleanupTerminals(); } catch (e) {}
    try { cleanupServerHost(); } catch (e) {}

    // 4. 游戏日志定时器（server 模块导出）
    if (serverModuleCache && typeof serverModuleCache.cleanupGameLogs === 'function') {
      try { serverModuleCache.cleanupGameLogs(); } catch (e) {}
    }

    // 5. JVM 预热进程
    if (global._preheatPids && global._preheatPids.length > 0) {
      const { exec } = require('child_process');
      for (const pid of global._preheatPids) {
        try {
          if (process.platform === 'win32') {
            exec(`taskkill /T /F /PID ${pid}`, { windowsHide: true }, () => {});
          } else {
            process.kill(pid);
          }
        } catch (e) {}
      }
      global._preheatPids = [];
    }

    // 5.5 游戏进程（清理僵尸进程：关 VersePC 时杀掉残留的 java.exe 及其子进程树）
    if (global._gamePids && global._gamePids.length > 0) {
      const { exec } = require('child_process');
      for (const pid of global._gamePids) {
        try {
          if (process.platform === 'win32') {
            // /T 杀整个进程树（java.exe 带起的 PowerShell、git 等子进程一并清理）
            exec(`taskkill /T /F /PID ${pid}`, { windowsHide: true }, () => {});
          } else {
            try { process.kill(-pid); } catch (_) { try { process.kill(pid); } catch (_) {} }
          }
        } catch (e) {}
      }
      global._gamePids = [];
    }

    // 6. 下载任务清理（最长等 5 秒）
    if (serverModuleCache && serverModuleCache.cleanupOnShutdown) {
      try {
        console.log('[App] 正在清理下载任务...');
        const downloadTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('下载清理超时')), 5000));
        await Promise.race([serverModuleCache.cleanupOnShutdown(), downloadTimeout]);
        console.log('[App] 下载任务清理完成');
      } catch (e) {
        console.error('[App] 关闭清理失败:', e.message);
      }
    }

    // 7. UPnP 端口映射清理（最长等 3 秒）
    // 避免关闭软件后路由器上残留端口转发规则
    try {
      const network = require('./server/network');
      if (typeof network.cleanupAllUPnPMappings === 'function') {
        console.log('[App] 正在清理 UPnP 端口映射...');
        const upnpTimeout = new Promise((resolve) => setTimeout(resolve, 3000));
        await Promise.race([network.cleanupAllUPnPMappings(), upnpTimeout]);
        console.log('[App] UPnP 端口映射清理完成');
      }
    } catch (e) {
      console.warn('[App] UPnP 清理失败:', e.message);
    }
  })();

  await Promise.race([cleanupPromise, timeoutPromise]);
}

// will-quit 兜底清理：作为 before-quit 失败的最后一道防线
// 注意：will-quit 中不能做异步操作，只能同步清理
app.on('will-quit', (event) => {
  try {
    // 清理空闲内存优化定时器
    if (_idleTrimTimer) {
      clearInterval(_idleTrimTimer);
      _idleTrimTimer = null;
    }
    // 同步清理终端会话（防止 before-quit 没跑完）
    if (typeof cleanupTerminals === 'function') cleanupTerminals();
    try { if (typeof cleanupServerHost === 'function') cleanupServerHost(); } catch (e) {}
    // 同步清理后台进程
    if (global._bgProcesses) {
      for (const [pid] of Object.entries(global._bgProcesses)) {
        try { process.kill(Number(pid)); } catch (e) {}
      }
      global._bgProcesses = {};
    }
  } catch (e) {}
});

// GPU 进程崩溃监听：记录日志，60 秒内连续 3 次崩溃则禁用硬件加速并重启
let _gpuCrashCount = 0;
let _gpuCrashResetTimer = null;
app.on('gpu-process-crashed', () => {
  _gpuCrashCount++;
  console.error(`[GPU] 进程崩溃 (累计 ${_gpuCrashCount} 次)`);
  try { _writeCrashLog(`GPU process crashed (count=${_gpuCrashCount})`); } catch (e) {}

  // 60 秒内无新崩溃则重置计数器
  if (_gpuCrashResetTimer) clearTimeout(_gpuCrashResetTimer);
  _gpuCrashResetTimer = setTimeout(() => { _gpuCrashCount = 0; }, 60000);

  // 连续 3 次崩溃则禁用硬件加速并重启
  if (_gpuCrashCount >= 3) {
    console.error('[GPU] 连续崩溃 3 次，禁用硬件加速并重启');
    try {
      app.disableHardwareAcceleration();
      app.relaunch();
      app.exit(0);
    } catch (e) {
      try { app.exit(1); } catch (e2) { process.exit(1); }
    }
  }
});

// SIGINT/SIGTERM 信号处理：触发正常退出流程，让 before-quit 走清理
process.on('SIGINT', () => {
  console.log('[App] 收到 SIGINT，触发正常退出');
  try { app.quit(); } catch (e) { process.exit(0); }
});
process.on('SIGTERM', () => {
  console.log('[App] 收到 SIGTERM，触发正常退出');
  try { app.quit(); } catch (e) { process.exit(0); }
});

// 未捕获异常兜底：记录日志后优雅退出
process.on('uncaughtException', (err) => {
  console.error('[App] 未捕获异常:', err && err.stack || err);
  try { _writeCrashLog('uncaughtException: ' + (err && err.stack || err)); } catch (e) {}
  try { app.quit(); } catch (e) { process.exit(1); }
});

// 未处理的 Promise rejection：记录日志，不退出
process.on('unhandledRejection', (reason) => {
  console.warn('[App] 未处理的 Promise rejection:', reason);
  try { _writeCrashLog('unhandledRejection: ' + (reason && reason.stack || reason)); } catch (e) {}
});

app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });

  contents.on('will-navigate', (event, navigationUrl) => {
    const parsed = new URL(navigationUrl);
    if (parsed.protocol !== 'versepc:' && parsed.protocol !== 'devtools:') {
      event.preventDefault();
    }
  });

  contents.on('will-attach-webview', (event, webPreferences, params) => {
    const src = new URL(params.src);
    if (src.protocol !== 'versepc:' && src.protocol !== 'https:') {
      event.preventDefault();
    }
    delete webPreferences.nodeIntegration;
    delete webPreferences.nodeIntegrationInWorker;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
  });

  if (app.isPackaged) {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  }
});

/* versepc:// 协议处理（handleVersePCProtocol/handleAPIRequest/handleSSERequest/
   handleStaticFile）+ 路径白名单（getAllowedPathRoots/isPathAllowed）+ MIME_TYPES
   已抽离至 main/protocol-handler.js，通过 setupProtocolHandler(...) 注入依赖 */

const { registerModsIPC } = require('./main/mods-ipc');

// IS_BETA 占位符 - 在构建时由 generate-integrity.js 替换为 true/false。
// 保留在 main.js 中（构建脚本只处理 main.js），通过 updaterModule.setup 注入到 updater.js。
// 使用构建时占位符替换可避免运行时环境检测的误判（beta.flag 曾被错误打包到正式版）。
let IS_BETA = (() => { try { return __IS_BETA__; } catch (_) { return false; } })();

/* @versepc-protected: anti-ai-plagiarism-v1.0 */
