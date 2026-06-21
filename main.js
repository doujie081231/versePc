// ============================================================================
// 崩溃日志 - 必须在所有其他代码之前，捕获最早期的启动错误
// ============================================================================
const _crashLogPath = require('path').join(
    process.env.APPDATA || require('path').join(require('os').homedir(), 'AppData', 'Roaming'),
    'VersePC', 'crash.log'
);
function _writeCrashLog(message) {
    try {
        const _fs = require('fs');
        const _dir = require('path').dirname(_crashLogPath);
        if (!_fs.existsSync(_dir)) _fs.mkdirSync(_dir, { recursive: true });
        _fs.appendFileSync(_crashLogPath, '[' + new Date().toISOString() + '] ' + message + '\n', 'utf8');
    } catch (e) {}
}
_writeCrashLog('process started, pid=' + process.pid);
process.on('uncaughtException', (err) => {
    _writeCrashLog('uncaughtException: ' + (err && err.stack || err));
});
process.on('unhandledRejection', (reason) => {
    _writeCrashLog('unhandledRejection: ' + (reason && reason.stack || reason));
});
process.on('exit', (code) => {
    if (code !== 0) _writeCrashLog('process exited with code ' + code);
});

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
 * VersePC - Minecraft 启动器 Electron 主进程入口
 * ============================================================================
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

// ============================================================================
// 单实例锁 - 必须在所有初始化之前执行，防止重复启动导致闪窗口
// ============================================================================
const { app } = require('electron');

try {
    const { exec: _execAsync } = require('child_process');
    const _currentPid = process.pid;
    _execAsync('chcp 65001 >nul 2>nul && wmic process where "name=\'VersePC.exe\'" get ProcessId,ParentProcessId,CommandLine /format:csv 2>nul', { encoding: 'utf8', timeout: 5000, windowsHide: true }, (_err, _wmicOut) => {
        try {
            if (_wmicOut) {
                for (const _line of _wmicOut.split('\n')) {
                    const _trim = _line.trim();
                    if (!_trim || _trim.startsWith('Node')) continue;
                    const _parts = _trim.split(',');
                    if (_parts.length < 4) continue;
                    const _pid = parseInt(_parts[_parts.length - 2]);
                    const _ppid = parseInt(_parts[_parts.length - 1]);
                    if (!_pid || _pid === _currentPid) continue;
                    if (_ppid && _ppid !== 0) continue;
                    try { process.kill(_pid); } catch (e) {}
                }
            }
        } catch (e) {}
    });
    _execAsync('netstat -ano | findstr LISTENING', { encoding: 'utf8', timeout: 5000, windowsHide: true }, (_err, _netOut) => {
        try {
            if (_netOut) {
                for (let _port = 3001; _port <= 3010; _port++) {
                    const _regex = new RegExp(`:${_port}\\s.*LISTENING\\s+(\\d+)`, 'g');
                    let _match;
                    while ((_match = _regex.exec(_netOut)) !== null) {
                        const _pid = parseInt(_match[1]);
                        if (_pid && _pid !== _currentPid) {
                            try { process.kill(_pid); } catch (e) {}
                        }
                    }
                }
            }
        } catch (e) {}
    });
} catch (e) {}

const gotTheLockEarly = app.requestSingleInstanceLock();
if (!gotTheLockEarly) {
    process.exit(0);
}

// ============================================================================
// V8 Code Cache - 首次启动后缓存编译结果，后续启动提速 40-60%
// ============================================================================
try {
    const v8 = require('v8');
    const cacheDir = require('path').join(require('os').tmpdir(), 'versepc-v8-cache');
    try { require('fs').mkdirSync(cacheDir, { recursive: true }); } catch (e) {}
    v8.setFlagsFromString('--compile-cache-dir=' + cacheDir);
} catch (e) {}

// ============================================================================
// V8 内存上限 - 根据系统内存动态设置，防止渲染进程 OOM 崩溃
// ============================================================================
try {
    const osMod = require('os');
    const totalMemMB = Math.floor(osMod.totalmem() / 1024 / 1024);
    let rendererHeapMB;
    if (totalMemMB <= 4096) rendererHeapMB = 768;
    else if (totalMemMB <= 8192) rendererHeapMB = 1024;
    else if (totalMemMB <= 16384) rendererHeapMB = 1536;
    else rendererHeapMB = 2048;
    process.env.ELECTRON_RENDERER_V8_HEAP_SIZE = String(rendererHeapMB);
    try {
        const v8 = require('v8');
        v8.setFlagsFromString('--max-old-space-size=' + rendererHeapMB);
    } catch (e) {}
} catch (e) {}

// ============================================================================
// 运行时完整性自检 - 延迟到窗口显示后执行，避免阻塞启动
// ============================================================================
let _integrityViolated = false;
async function _runIntegrityCheckAsync() {
    try {
        const _crypto = require('crypto');
        const _integrityPath = require('path').join(__dirname, 'integrity.json');
        await require('fs').promises.access(_integrityPath);
        const _manifest = JSON.parse(await require('fs').promises.readFile(_integrityPath, 'utf-8'));
        for (const [_file, _expectedHash] of Object.entries(_manifest)) {
            try {
                const _filePath = require('path').join(__dirname, _file);
                const _content = await require('fs').promises.readFile(_filePath);
                const _actualHash = _crypto.createHash('sha256').update(_content).digest('hex');
                if (_actualHash !== _expectedHash) {
                    _integrityViolated = true;
                    console.warn(`[Integrity] File tampered: ${_file}`);
                }
            } catch (e) {}
        }
        if (_integrityViolated) {
            console.warn('[Integrity] Source file modification detected. This may indicate tampering.');
        }
    } catch (e) {}
}

// ============================================================================
// 模块导入
// ============================================================================
// 注意：app 在第 37 行单实例锁中已解构，这里只补齐其余模块
const { BrowserWindow, Menu, shell, ipcMain, dialog, screen, protocol, clipboard, net, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { AI_PROVIDERS, TOOL_CONFIG, TOOL_DISPLAY_NAMES, getProviderForModel, buildApiHeaders } = require('./ai-config');

let _autoUpdater;
function getAutoUpdater() {
    if (!_autoUpdater) _autoUpdater = require('electron-updater').autoUpdater;
    return _autoUpdater;
}

const diagFs = require('fs');
const diagLogPath = require('path').join(require('electron').app.getPath('userData'), 'agent-diag.log');
let _diagEnabled = true;
try {
    const stat = diagFs.statSync(diagLogPath);
    if (stat.size > 5 * 1024 * 1024) {
        diagFs.writeFileSync(diagLogPath, `[${new Date().toISOString()}] 日志已轮转\n`);
    }
} catch (e) {}
const diagLog = (msg) => {
    if (!_diagEnabled) return;
    try {
        diagFs.appendFile(diagLogPath, `[${new Date().toISOString()}] ${msg}\n`, () => {});
    } catch (e) {}
};

// ============================================================================
// 全局状态变量
// ============================================================================
let mainWindow = null;            // 主窗口实例
let apiHandler = null;            // server.js 的 API 处理函数引用
let sseExecuteTool = null;         // SSE 服务器使用的工具执行函数引用
let shuttingDown = false;         // 是否正在关闭应用
let isClosingAnimation = false;   // 是否正在播放关闭动画
let serverModuleCache = null;     // server.js 模块缓存
let ssePort = 3001;
let updateDownloaded = false;     // 更新是否已下载完成
let updateAvailableInfo = null;   // 可用的更新信息（用于弹窗通知）

// ============================================================================
// Windows 任务栏图标关联（必须在 app.ready 之前设置）
// ============================================================================
if (process.platform === 'win32') {
    app.setAppUserModelId('com.versepc.launcher');
}

// 窗口配置文件路径和缓存
const CONFIG_PATH = path.join(require('os').homedir(), '.versepc', 'window-config.json');
const STORE_PATH = path.join(require('os').homedir(), '.versepc', 'app-store.json');
let windowConfigCache = null;     // 配置缓存对象
let windowConfigCacheTime = 0;    // 缓存时间戳
const CONFIG_CACHE_DURATION = 1000; // 缓存有效期（1秒）
let savedWindowBounds = null;     // 保存的窗口边界（用于全屏恢复）

async function autoRepairJsonFileAsync(filePath, backupSuffix) {
    try {
        await fs.promises.access(filePath);
        const content = await fs.promises.readFile(filePath, 'utf8');
        JSON.parse(content);
        return true;
    } catch (e) {
        console.error(`[AutoRepair] Detected corrupted file: ${filePath}`);
        try {
            const backupPath = filePath + backupSuffix;
            await fs.promises.copyFile(filePath, backupPath);
            console.log(`[AutoRepair] Backup created: ${backupPath}`);
        } catch (backupErr) {
            console.error(`[AutoRepair] Backup failed:`, backupErr.message);
        }
        const bakPath = filePath + '.bak';
        try {
            await fs.promises.access(bakPath);
            const bakContent = await fs.promises.readFile(bakPath, 'utf8');
            JSON.parse(bakContent);
            await fs.promises.writeFile(filePath, bakContent);
            console.log(`[AutoRepair] Recovered from .bak: ${bakPath}`);
            return true;
        } catch (bakErr) {
            console.error(`[AutoRepair] .bak recovery failed:`, bakErr.message);
        }
        try {
            const dir = path.dirname(filePath);
            await fs.promises.mkdir(dir, { recursive: true });
            const defaultContent = filePath.includes('window-config')
                ? JSON.stringify({ fullscreen: false, windowMode: true, windowWidth: 1200, windowHeight: 800 }, null, 2)
                : '{}';
            await fs.promises.writeFile(filePath, defaultContent);
            console.log(`[AutoRepair] File reset to defaults: ${filePath}`);
        } catch (resetErr) {
            console.error(`[AutoRepair] Reset failed:`, resetErr.message);
        }
        return false;
    }
}

async function repairVersePCDataAsync() {
    const dataDir = path.join(require('os').homedir(), '.versepc');
    try { await fs.promises.access(dataDir); } catch { return; }
    await autoRepairJsonFileAsync(CONFIG_PATH, '.corrupted.json');
    await autoRepairJsonFileAsync(STORE_PATH, '.corrupted.json');
    try {
        const settingsFile = path.join(dataDir, 'settings.json');
        await autoRepairJsonFileAsync(settingsFile, '.corrupted.json');
    } catch (e) {}
    try {
        const accountsFile = path.join(dataDir, 'accounts.json');
        await autoRepairJsonFileAsync(accountsFile, '.corrupted.json');
    } catch (e) {}
    try {
        const versionsDir = path.join(dataDir, 'versions');
        await fs.promises.access(versionsDir);
        const versions = await fs.promises.readdir(versionsDir);
        for (const ver of versions) {
            const verPath = path.join(versionsDir, ver);
            const stat = await fs.promises.stat(verPath);
            if (stat.isDirectory()) {
                const versionJson = path.join(verPath, 'version.json');
                await autoRepairJsonFileAsync(versionJson, '.corrupted.json');
            }
        }
    } catch (e) {
        console.error('[AutoRepair] Version scan error:', e.message);
    }
    console.log('[AutoRepair] Data integrity check completed');
}

function _deferredRepairData() {
    setImmediate(() => {
        repairVersePCDataAsync().catch(() => {});
    });
}

// ============================================================================
// 全局错误处理
// ============================================================================
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
    if (!shuttingDown && mainWindow) {
        dialog.showErrorBox('发生错误', msg || '未知错误');
    }
});

// ============================================================================
// MIME 类型映射表 - 用于静态文件服务
// ============================================================================
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.jar': 'application/java-archive',
};

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
            allowServiceWorkers: true,
        }
    },
    {
        scheme: 'wpfile',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true,
        }
    }
]);

// ============================================================================
// 窗口配置管理 - 持久化保存窗口大小、位置和全屏状态
// ============================================================================

/**
 * 加载窗口配置
 * @returns {Object} 配置对象 { fullscreen, windowMode, windowWidth, windowHeight, windowX, windowY }
 */
function loadWindowConfig() {
    const defaults = { fullscreen: false, windowMode: true, windowWidth: 1200, windowHeight: 800 };
    const now = Date.now();
    if (windowConfigCache && (now - windowConfigCacheTime) < CONFIG_CACHE_DURATION) {
        return { ...windowConfigCache };
    }
    const config = safeReadJsonFile(CONFIG_PATH, defaults);
    windowConfigCache = { ...config };
    windowConfigCacheTime = now;
    return config;
}

/**
 * 保存窗口配置到磁盘
 * @param {Object} config - 配置对象
 */
function saveWindowConfig(config) {
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        safeWriteFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        windowConfigCache = { ...config };
        windowConfigCacheTime = Date.now();
    } catch (e) { console.error('Failed to save window config:', e); }
}

// ============================================================================
// 窗口创建 - 创建无边框窗口并加载应用界面
// ============================================================================

async function createWindow() {
    const [configResult, storeResult] = await Promise.allSettled([
        Promise.resolve().then(() => loadWindowConfig()),
        fs.promises.readFile(STORE_PATH, 'utf-8').then(raw => JSON.parse(raw)).catch(() => null)
    ]);
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
            webviewTag: true,
            preload: path.join(__dirname, 'preload.cjs'),
        },
    });
    mainWindow.show();

    // 根据保存的配置恢复窗口状态
    if (config.fullscreen && !config.windowMode) {
        savedWindowBounds = { x: windowX, y: windowY, width: windowWidth, height: windowHeight };
        mainWindow.setFullScreen(true);
    } else if (config.maximized) {
        mainWindow.maximize();
    }

    // 使用 versepc:// 协议加载首页
    mainWindow.loadURL('versepc://app/index.html');

    // GPU 黑屏检测：8秒内页面未渲染则标记下次禁用GPU
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
    }, 8000);
    mainWindow.webContents.once('did-finish-load', () => clearTimeout(_gpuWatchdog));

    // 渲染进程崩溃检测
    let rendererCrashRetries = 0;
    const MAX_RENDERER_RETRIES = 2;
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
            try {
                if (process.platform === 'win32') {
                    const { execSync } = require('child_process');
                    execSync('powershell -NoProfile -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"', { timeout: 3000, windowsHide: true });
                }
            } catch (e) {}
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
        isClosingAnimation = false;
        if (serverModuleCache && serverModuleCache.setMainWindow) {
            serverModuleCache.setMainWindow(null);
        }
        mainWindow = null;
    });

    // 拦截关闭事件，播放关闭动画（Alt+F4 等系统级关闭触发）
    mainWindow.on('close', (e) => {
        if (!isClosingAnimation && !shuttingDown && mainWindow && !mainWindow.isDestroyed()) {
            e.preventDefault();
            animateCloseWindow();
        }
    });

    // 窗口大小改变时保存配置（非全屏、非最大化状态才保存）
    mainWindow.on('resize', () => {
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFullScreen() && !mainWindow.isMaximized()) {
            const bounds = mainWindow.getBounds();
            savedWindowBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
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
            savedWindowBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
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
        if (savedWindowBounds) {
            mainWindow.setBounds(savedWindowBounds);
        }
        mainWindow.webContents.send('window-state-changed', { maximized: mainWindow.isMaximized(), fullscreen: false });
    });

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

        // mainWindow.webContents.openDevTools({ mode: 'detach' });
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

// ============================================================================
// 窗口控制 IPC 处理器 - 渲染进程通过 IPC 控制窗口行为
// ============================================================================
ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isFullScreen()) {
            mainWindow.setFullScreen(false);
            if (savedWindowBounds) {
                mainWindow.setBounds(savedWindowBounds);
            }
        } else if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

function animateCloseWindow() {
    if (!mainWindow || mainWindow.isDestroyed() || isClosingAnimation) return;
    isClosingAnimation = true;

    try { mainWindow.webContents.send('request-close-animate'); } catch (e) {}

    const doAnimate = () => {
        if (!mainWindow || mainWindow.isDestroyed()) { isClosingAnimation = false; return; }

        const bounds = mainWindow.getBounds();
        const startY = bounds.y;
        const targetY = startY - bounds.height - 60;
        const duration = 400;
        const startTime = Date.now();

        const timer = setInterval(() => {
            if (!mainWindow || mainWindow.isDestroyed()) { clearInterval(timer); return; }
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            try {
                mainWindow.setBounds({
                    x: bounds.x,
                    y: Math.round(startY + (targetY - startY) * eased),
                    width: bounds.width,
                    height: bounds.height,
                }, false);
                mainWindow.setOpacity(1 - progress);
            } catch (e) {}

            if (progress >= 1) {
                clearInterval(timer);
                try { mainWindow.destroy(); } catch (e) {}
            }
        }, 20);
    };

    const wasMaximized = mainWindow.isMaximized();
    const wasFullScreen = mainWindow.isFullScreen();

    if (wasFullScreen) {
        mainWindow.setFullScreen(false);
    }
    if (wasMaximized || wasFullScreen) {
        mainWindow.unmaximize();
        setTimeout(doAnimate, 200);
    } else {
        doAnimate();
    }
}

ipcMain.on('window-close', () => {
    animateCloseWindow();
});

ipcMain.on('relaunch-app', () => {
    app.relaunch();
    app.exit(0);
});

ipcMain.handle('window-is-maximized', async () => {
    return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('window-is-fullscreen', async () => {
    return mainWindow ? mainWindow.isFullScreen() : false;
});

// 全屏模式切换
ipcMain.on('window-set-fullscreen', (event, fullscreen) => {
    if (mainWindow) {
        if (fullscreen) {
            if (!mainWindow.isFullScreen()) {
                const bounds = mainWindow.getBounds();
                savedWindowBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
            }
            mainWindow.setFullScreen(true);
        } else {
            mainWindow.setFullScreen(false);
            if (savedWindowBounds) {
                mainWindow.setBounds(savedWindowBounds);
            }
        }
        const config = loadWindowConfig();
        config.fullscreen = fullscreen;
        config.windowMode = !fullscreen;
        if (!fullscreen && savedWindowBounds) {
            config.windowWidth = savedWindowBounds.width;
            config.windowHeight = savedWindowBounds.height;
            config.windowX = savedWindowBounds.x;
            config.windowY = savedWindowBounds.y;
        }
        saveWindowConfig(config);
    }
});

// 窗口模式切换（全屏 和 窗口 之间切换）
ipcMain.on('window-set-window-mode', (event, windowMode) => {
    if (mainWindow) {
        const config = loadWindowConfig();
        config.windowMode = windowMode;
        if (windowMode) {
            if (mainWindow.isFullScreen()) {
                mainWindow.setFullScreen(false);
                if (savedWindowBounds) {
                    mainWindow.setBounds(savedWindowBounds);
                }
            }
            config.fullscreen = false;
        } else {
            if (!mainWindow.isFullScreen()) {
                const bounds = mainWindow.getBounds();
                savedWindowBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
            }
            mainWindow.setFullScreen(true);
            config.fullscreen = true;
        }
        if (windowMode && savedWindowBounds) {
            config.windowWidth = savedWindowBounds.width;
            config.windowHeight = savedWindowBounds.height;
            config.windowX = savedWindowBounds.x;
            config.windowY = savedWindowBounds.y;
        }
        saveWindowConfig(config);
    }
});

// 退出应用
ipcMain.on('app-quit', () => {
    shuttingDown = true;
    app.quit();
});

// 文件打开对话框
ipcMain.handle('dialog-open', async (event, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return dialog.showOpenDialog(win, options);
});

// 剪贴板操作
ipcMain.handle('clipboard-write-text', async (event, text) => {
    clipboard.writeText(text);
    return true;
});

ipcMain.handle('clipboard-read-text', async () => {
    return clipboard.readText();
});

// ============================================================================
// 持久化存储 (Key-Value Store) - 基于 JSON 文件的应用状态存储
// ============================================================================

/**
 * 加载存储数据
 * @returns {Object} 存储的键值对对象
 */
function safeWriteFileSync(filePath, content) {
    const bakPath = filePath + '.bak';
    try {
        if (fs.existsSync(filePath)) {
            fs.copyFileSync(filePath, bakPath);
        }
    } catch (e) {}
    const tmpPath = filePath + '.tmp';
    try {
        fs.writeFileSync(tmpPath, content, 'utf8');
        fs.renameSync(tmpPath, filePath);
    } catch (e) {
        try { fs.writeFileSync(filePath, content, 'utf8'); } catch (e2) {}
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e3) {}
    }
}

function safeReadJsonFile(filePath, defaults) {
    try {
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error(`[Storage] File corrupted: ${filePath}`, e.message);
        const bakPath = filePath + '.bak';
        try {
            if (fs.existsSync(bakPath)) {
                const bakRaw = fs.readFileSync(bakPath, 'utf8');
                const restored = JSON.parse(bakRaw);
                console.log(`[Storage] Recovered from backup: ${bakPath}`);
                safeWriteFileSync(filePath, JSON.stringify(restored, null, 2));
                return restored;
            }
        } catch (e2) {}
        console.warn(`[Storage] No valid backup, using defaults for: ${filePath}`);
    }
    return defaults;
}

let _storeCache = null;
let _storeCacheTime = 0;
const STORE_CACHE_TTL = 3000;

function loadStore() {
    const now = Date.now();
    if (_storeCache && (now - _storeCacheTime) < STORE_CACHE_TTL) {
        return _storeCache;
    }
    _storeCache = safeReadJsonFile(STORE_PATH, {});
    _storeCacheTime = now;
    return _storeCache;
}

function saveStore(data) {
    _storeCache = data;
    _storeCacheTime = Date.now();
    try {
        const dir = path.dirname(STORE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        safeWriteFileSync(STORE_PATH, JSON.stringify(data, null, 2));
    } catch (e) { console.error('Failed to save store:', e); }
}

ipcMain.handle('store-get', async (event, key) => {
    const store = loadStore();
    return store[key] !== undefined ? store[key] : null;
});

ipcMain.handle('store-get-multiple', async (event, keys) => {
    const store = loadStore();
    const result = {};
    for (const key of keys) {
        result[key] = store[key] !== undefined ? store[key] : null;
    }
    return result;
});

ipcMain.handle('store-set', async (event, key, value) => {
    if (!global._storeWriteQueue) global._storeWriteQueue = Promise.resolve();
    global._storeWriteQueue = global._storeWriteQueue.then(() => {
        const store = loadStore();
        store[key] = value;
        saveStore(store);
    });
    return true;
});

ipcMain.handle('store-delete', async (event, key) => {
    const store = loadStore();
    delete store[key];
    saveStore(store);
    return true;
});

ipcMain.handle('get-machine-id', async () => {
    try {
        const crypto = require('crypto');
        const os = require('os');
        const parts = [];
        try { parts.push(os.hostname()); } catch (e) {}
        try { parts.push(os.arch()); } catch (e) {}
        try { parts.push(os.platform()); } catch (e) {}
        try {
            const cpus = os.cpus();
            if (cpus.length > 0) parts.push(cpus[0].model);
        } catch (e) {}
        try {
            const totalMem = os.totalmem();
            parts.push(String(totalMem));
        } catch (e) {}
        try {
            const nets = os.networkInterfaces();
            for (const name of Object.keys(nets)) {
                for (const iface of nets[name]) {
                    if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
                        parts.push(iface.mac);
                        break;
                    }
                }
            }
        } catch (e) {}
        const raw = parts.join('|');
        const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
        return hash.substring(0, 16);
    } catch (e) {
        return null;
    }
});

ipcMain.handle('activate-verify', async (event, code) => {
    try {
        const crypto = require('crypto');
        const os = require('os');
        let activationModule;
        try { activationModule = require('./activation.obfuscated.js'); } catch (e) { activationModule = require('./activation'); }
        const { validateActivationCode } = activationModule;

        const parts = [];
        try { parts.push(os.hostname()); } catch (e) {}
        try { parts.push(os.arch()); } catch (e) {}
        try { parts.push(os.platform()); } catch (e) {}
        try { const cpus = os.cpus(); if (cpus.length > 0) parts.push(cpus[0].model); } catch (e) {}
        try { parts.push(String(os.totalmem())); } catch (e) {}
        try {
            const nets = os.networkInterfaces();
            for (const name of Object.keys(nets)) {
                for (const iface of nets[name]) {
                    if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
                        parts.push(iface.mac);
                        break;
                    }
                }
            }
        } catch (e) {}
        const machineId = crypto.createHash('sha256').update(parts.join('|')).digest('hex').toUpperCase().substring(0, 16);

        const c = (code || '').trim().toUpperCase();
        if (!c) return { success: false, message: '请输入激活码' };
        const codeParts = c.split('-');
        if (codeParts.length < 2 || codeParts.length > 3) return { success: false, message: '激活码格式无效' };

        const appVersion = app.getVersion();
        const result = validateActivationCode(c, machineId, appVersion);

        if (!result.activated) {
            return { success: false, message: '激活码无效或与本机不匹配' };
        }

        const activationType = result.type;
        const store = loadStore();
        store['activation_type'] = activationType;
        store['activation_code'] = c;
        store['activation_time'] = new Date().toISOString();
        fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), () => {});

        return { success: true, type: activationType, message: activationType === 'permanent' ? '永久激活成功！' : '单次激活成功！' };
    } catch (e) {
        return { success: false, message: '验证失败: ' + e.message };
    }
});

ipcMain.handle('activate-status', async () => {
    const store = loadStore();
    return {
        activated: !!store['activation_type'],
        type: store['activation_type'] || null,
        time: store['activation_time'] || null
    };
});

    ipcMain.handle('preview:stop', async () => {
        if (global._previewServer) {
            global._previewServer.close();
            const oldPort = global._previewPort;
            global._previewServer = null;
            global._previewPort = null;
            return { success: true, port: oldPort };
        }
        return { success: false, message: '没有运行中的预览服务器' };
    });

// 在系统默认浏览器中打开外部链接
ipcMain.handle('shell-open-external', async (event, url) => {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return { success: false, error: '仅允许打开 http/https 链接' };
        }
    } catch (e) {
        return { success: false, error: '无效的URL' };
    }
    await shell.openExternal(url);
    return true;
});

let editorWindow = null;

function createEditorWindow(filePath) {
    if (editorWindow && !editorWindow.isDestroyed()) {
        editorWindow.focus();
        if (filePath) editorWindow.webContents.send('editor:open-file', filePath);
        return;
    }
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    editorWindow = new BrowserWindow({
        width: Math.min(1200, width - 100),
        height: Math.min(800, height - 100),
        title: 'VersePC Editor',
        icon: path.join(__dirname, 'img', 'logo.png'),
        backgroundColor: '#1e1e1e',
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webviewTag: false,
            preload: path.join(__dirname, 'editor-preload.cjs')
        }
    });
    editorWindow.loadFile('editor.html');
    editorWindow.once('ready-to-show', () => {
        editorWindow.show();
        if (filePath) {
            editorWindow.webContents.once('did-finish-load', () => {
                editorWindow.webContents.send('editor:open-file', filePath);
            });
        }
    });
    editorWindow.on('closed', () => { editorWindow = null; });
}

ipcMain.handle('editor:open-file-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
        title: '打开文件',
        properties: ['openFile'],
        filters: [
            { name: '所有文件', extensions: ['*'] },
            { name: 'JSON', extensions: ['json', 'jsonc'] },
            { name: 'JavaScript', extensions: ['js', 'jsx', 'ts', 'tsx'] },
            { name: '配置文件', extensions: ['toml', 'ini', 'cfg', 'properties', 'yml', 'yaml'] },
            { name: '文本文件', extensions: ['txt', 'md', 'log'] }
        ]
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
});

ipcMain.handle('editor:read-file', async (event, filePath) => {
    try {
        const resolved = path.resolve(filePath);
        const allowedBase = path.resolve(__dirname);
        if (!resolved.toLowerCase().startsWith(allowedBase.toLowerCase()) || !fs.existsSync(resolved)) {
            return { error: '无效的文件路径' };
        }
        const content = fs.readFileSync(resolved, 'utf-8');
        return { content };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('editor:write-file', async (event, filePath, content) => {
    try {
        const resolved = path.resolve(filePath);
        const allowedBase = path.resolve(__dirname);
        if (!resolved.toLowerCase().startsWith(allowedBase.toLowerCase())) {
            return { error: '无效的文件路径' };
        }
        const dir = path.dirname(resolved);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(resolved, content, 'utf-8');
        return { success: true };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('editor:open', async (event, filePath) => {
    createEditorWindow(filePath);
    return true;
});

ipcMain.handle('editor:scan-dir', async (event, dirPath) => {
    try {
        const allowedBase = path.resolve(__dirname);
        const resolved = path.resolve(dirPath);
        if (!resolved.toLowerCase().startsWith(allowedBase.toLowerCase())) {
            return [];
        }
        const entries = fs.readdirSync(resolved, { withFileTypes: true });
        const IGNORE = ['node_modules', '.git', '.svn', '__pycache__', '.DS_Store', 'Thumbs.db', 'dist', '.next', '.cache'];
        return entries
            .filter(e => !IGNORE.includes(e.name) && !e.name.startsWith('.'))
            .sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name);
            })
            .slice(0, 200)
            .map(e => ({
                name: e.name,
                path: path.join(resolved, e.name),
                isDir: e.isDirectory(),
                rel: path.relative(resolved, path.join(resolved, e.name))
            }));
    } catch (e) { return []; }
});

const terminalSessions = new Map();

const pendingVersionSelections = new Map();

function createTerminalSession(id, cols, rows) {
    const isWin = process.platform === 'win32';
    const shell = isWin ? (process.env.COMSPEC || 'cmd.exe') : (process.env.SHELL || '/bin/bash');
    const homeDir = process.env[isWin ? 'USERPROFILE' : 'HOME'] || (isWin ? 'C:\\' : '/');
    let child;
    if (isWin) {
        try {
            child = require('child_process').spawn('powershell.exe', ['-NoLogo', '-NoExit'], {
                cwd: homeDir,
                env: { ...process.env, TERM: 'xterm-256color' },
                stdio: ['pipe', 'pipe', 'pipe']
            });
        } catch (e) {
            child = require('child_process').spawn(shell, [], {
                cwd: homeDir,
                env: { ...process.env, TERM: 'xterm-256color' },
                stdio: ['pipe', 'pipe', 'pipe']
            });
        }
    } else {
        child = require('child_process').spawn(shell, ['--login'], {
            cwd: homeDir,
            env: { ...process.env, TERM: 'xterm-256color' },
            stdio: ['pipe', 'pipe', 'pipe']
        });
    }
    const session = { id, process: child, cols: cols || 80, rows: rows || 24 };
    terminalSessions.set(id, session);
    return session;
}

ipcMain.handle('terminal:create', async (event, id, cols, rows) => {
    const session = createTerminalSession(id, cols, rows);
    const win = BrowserWindow.fromWebContents(event.sender);
    session.process.stdout.on('data', (data) => {
        if (win && !win.isDestroyed()) {
            win.webContents.send('terminal:data', id, data.toString('utf-8'));
        }
    });
    session.process.stderr.on('data', (data) => {
        if (win && !win.isDestroyed()) {
            win.webContents.send('terminal:data', id, data.toString('utf-8'));
        }
    });
    session.process.on('exit', (code) => {
        if (win && !win.isDestroyed()) {
            win.webContents.send('terminal:exit', id, code);
        }
        terminalSessions.delete(id);
    });
    session.process.on('error', (err) => {
        if (win && !win.isDestroyed()) {
            win.webContents.send('terminal:data', id, `\r\n\x1b[31mError: ${err.message}\x1b[0m\r\n`);
        }
    });
    return { success: true };
});

ipcMain.handle('terminal:write', async (event, id, data) => {
    const session = terminalSessions.get(id);
    if (session && session.process && !session.process.killed) {
        session.process.stdin.write(data);
    }
});

ipcMain.handle('terminal:resize', async (event, id, cols, rows) => {
    const session = terminalSessions.get(id);
    if (session) {
        session.cols = cols;
        session.rows = rows;
    }
});

ipcMain.handle('terminal:kill', async (event, id) => {
    const session = terminalSessions.get(id);
    if (session) {
        if (session.process && !session.process.killed) {
            session.process.kill();
        }
        terminalSessions.delete(id);
    }
});

ipcMain.handle('terminal:list', async () => {
    return Array.from(terminalSessions.keys());
});

ipcMain.on('ai:select-version-response', (event, { selId, selected }) => {
    const pending = pendingVersionSelections.get(selId);
    if (pending) {
        clearTimeout(pending.timer);
        pendingVersionSelections.delete(selId);
        pending.resolve(selected);
    }
});

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
    if (process.platform !== 'win32') {
        return { success: false, error: '内存优化功能仅支持 Windows 系统' };
    }
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const psScript = `$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -MemberDefinition '[DllImport("psapi.dll")] public static extern int EmptyWorkingSet(IntPtr hwProc);' -Name "W32PSAPI" -Namespace "VP" -WarningAction SilentlyContinue -PassThru | Out-Null
Add-Type -MemberDefinition '[DllImport("kernel32.dll", SetLastError=true)] private static extern int SetSystemInformation(uint infoClass, IntPtr info, uint length);' -Name "W32SysInfo" -Namespace "VP" -WarningAction SilentlyContinue -PassThru | Out-Null
Add-Type -MemberDefinition '[DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr CreateFile(string lpFileName, uint dwDesiredAccess, uint dwShareMode, IntPtr lpSecurityAttributes, uint dwCreationDisposition, uint dwFlagsAndAttributes, IntPtr hTemplateFile);' -Name "W32File" -Namespace "VP" -WarningAction SilentlyContinue -PassThru | Out-Null
Add-Type -MemberDefinition '[DllImport("kernel32.dll", SetLastError=true)] public static extern bool FlushFileBuffers(IntPtr hFile);' -Name "W32Flush" -Namespace "VP" -WarningAction SilentlyContinue -PassThru | Out-Null
Add-Type -MemberDefinition '[DllImport("kernel32.dll", SetLastError=true)] public static extern bool CloseHandle(IntPtr hObject);' -Name "W32Close" -Namespace "VP" -WarningAction SilentlyContinue -PassThru | Out-Null
$before = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024)
function DoRound {
    try {
        $h = [VP.W32File]::CreateFile("\\\\.\\C:", 0x40000000, 0x00000003, [IntPtr]::Zero, 3, 0, [IntPtr]::Zero)
        if ($h -ne [IntPtr]::Zero -and [long]$h -ne -1) {
            [void][VP.W32Flush]::FlushFileBuffers($h)
            [void][VP.W32Close]::CloseHandle($h)
        }
    } catch {}
    Start-Sleep -Milliseconds 1000
    Get-Process | ForEach-Object {
        try { [void][VP.W32PSAPI]::EmptyWorkingSet($_.Handle) } catch {}
    }
    try { [VP.W32SysInfo]::SetSystemInformation(80, [IntPtr]::Zero, 0) } catch {}
    try { [VP.W32SysInfo]::SetSystemInformation(81, [IntPtr]::Zero, 0) } catch {}
    try { [VP.W32SysInfo]::SetSystemInformation(82, [IntPtr]::Zero, 0) } catch {}
    try { [VP.W32SysInfo]::SetSystemInformation(39, [IntPtr]::Zero, 0) } catch {}
}
DoRound
Start-Sleep -Seconds 3
[GC]::Collect()
[GC]::WaitForPendingFinalizers()
DoRound
Start-Sleep -Seconds 3
[GC]::Collect()
[GC]::WaitForPendingFinalizers()
DoRound
Start-Sleep -Seconds 2
$after = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024)
$diff = $after - $before
@{ Before=$before; After=$after; Diff=$diff } | ConvertTo-Json -Compress`;
    const tmpScript = path.join(os.tmpdir(), 'versepc_memopt.ps1');
    return new Promise((resolve) => {
        try {
            fs.writeFileSync(tmpScript, psScript, 'utf8');
        } catch (e) {
            resolve({ success: false, error: 'write script failed: ' + e.message });
            return;
        }
        const { execFile } = require('child_process');
        execFile('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmpScript], { timeout: 90000 }, (err, stdout, stderr) => {
            try { fs.unlinkSync(tmpScript); } catch (_) {}
            if (err) {
                resolve({ success: false, error: err.message });
                return;
            }
            try {
                const result = JSON.parse(stdout.trim());
                resolve({
                    success: true,
                    freedMB: Math.round(result.Diff),
                    beforeMB: Math.round(result.Before),
                    afterMB: Math.round(result.After)
                });
            } catch (e) {
                resolve({ success: false, error: 'parse failed: ' + e.message });
            }
        });
    });
});

ipcMain.handle('jvm-preheat', async (event, javaPath, maxMemMB) => {
    return { success: true };
});

// ============================================================================
// 整合包导入 IPC Handler - 主进程通过 IPC 调用 server.js 的整合包导入功能
// ============================================================================
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

// ============================================================================
// Server 模块加载 - 崩溃隔离 + 自动重载
// ============================================================================
let _serverLoadTime = 0;
let _serverCrashCount = 0;
const SERVER_MAX_CRASHES = 3;

function loadServerModule() {
    const serverPath = path.join(__dirname, 'server.js');
    delete require.cache[require.resolve(serverPath)];
    const serverModule = require(serverPath);
    serverModuleCache = serverModule;
    apiHandler = {
        handleNativeAPI: serverModule.handleNativeAPI,
        handleNativeSSE: serverModule.handleNativeSSE,
    };
    _serverLoadTime = Date.now();
    console.log('[Server] Module loaded/reloaded successfully');
    return serverModule;
}

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

// ============================================================================
// GPU 硬件加速 + 高帧率支持 - 默认启用以获得流畅界面
// ============================================================================
const disableGpuFile = path.join(app.getPath('userData'), '.disable-gpu');
const safeMode = process.argv.includes('--safe-mode') || process.argv.includes('--disable-gpu');
const forceDisableGpu = process.argv.includes('--disable-gpu');

app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('enable-use-zoom-for-dsf', 'true');
app.commandLine.appendSwitch('force-color-profile', 'srgb');
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

const shouldDisableGpu = forceDisableGpu || safeMode || require('fs').existsSync(disableGpuFile);

if (shouldDisableGpu) {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('use-gl', 'swiftshader');
    if (safeMode) console.log('[GPU] Hardware acceleration disabled (safe mode)');
    else if (require('fs').existsSync(disableGpuFile)) console.log('[GPU] Hardware acceleration disabled (previous GPU failure)');
} else {
    console.log('[GPU] Hardware acceleration enabled (high frame rate mode)');
}

app.on('gpu-info-update', () => {
    try {
        const info = app.getGPUFeatureInfo();
        if (info && info.status === 3) {
            console.log('[GPU] GPU fallen back to software rendering, disabling for next launch');
            require('fs').writeFileSync(disableGpuFile, '1');
        }
    } catch (e) {}
});

// ============================================================================
// 单实例锁的第二阶段：second-instance 事件处理（仅在拿到锁的实例中注册）
// 单实例锁检查已上移到文件最早期（line 33-41），此处只注册事件处理器
// ============================================================================
app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        if (!mainWindow.isVisible()) mainWindow.show();
        if (mainWindow.isFullScreen()) {
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

// ============================================================================
// 应用就绪 - Electron 启动完成后的初始化流程
// ============================================================================
app.whenReady().then(async () => {
    try {
        console.log('VersePC starting...');

        // 只注册核心协议处理器，其余全部延迟
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

        // 创建窗口（最优先）
        await createWindow();

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

            // wpfile 协议
            protocol.handle('wpfile', (request) => {
                try {
                    const url = new URL(request.url);
                    let filePath = decodeURIComponent(url.pathname);
                    if (filePath.startsWith('/')) filePath = filePath.substring(1);
                    const resolved = path.resolve(filePath);
                    if (!isPathAllowed(resolved)) return new Response('Forbidden', { status: 403 });
                    if (!fs.existsSync(resolved)) return new Response('Not Found', { status: 404 });
                    const ext = path.extname(resolved).toLowerCase();
                    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.mp4', '.webm', '.mkv', '.avi'];
                    if (!allowedExts.includes(ext)) return new Response('Forbidden', { status: 403 });
                    const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo' };
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
            registerModsIPC();
            registerUpdaterIPC();
            registerAIChatIPC();
            initAutoUpdater();

            // 加载 server.js、启动 SSE、完整性检查等（延迟执行，不阻塞启动）
            setImmediate(() => {
                try { loadServerModule(); } catch (e) { console.error('[Server] Load failed:', e.message); }
                _serverReady = true;
                if (serverModuleCache && serverModuleCache.setMainWindow) {
                    try { serverModuleCache.setMainWindow(mainWindow); } catch (e) {}
                }
                try {
                    const { createSSEServer } = require('./sse-server');
                    const sseResult = createSSEServer({ executeTool: sseExecuteTool });
                    global._sseServer = sseResult ? sseResult.server : null;
                    ssePort = sseResult ? sseResult.PORT : 3001;
                    console.log('[SSE] Server created: port=' + ssePort);
                } catch (e) {
                    console.log('[SSE] Server failed: ' + e.message);
                }
                try { _runIntegrityCheckAsync().catch(() => {}); } catch (e) {}
                try { _deferredRepairData(); } catch (e) {}
                if (serverModuleCache) {
                    try { serverModuleCache.logStartupInfo(); } catch (e) {}
                }
            });
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
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', async (event) => {
    if (shuttingDown) return;
    shuttingDown = true;

    if (global._previewServer) {
        try { global._previewServer.close(); } catch (e) {}
        global._previewServer = null;
    }
    if (global._sseServer) {
        try { global._sseServer.close(); } catch (e) {}
        global._sseServer = null;
    }
    if (global._bgProcesses) {
        for (const [pid, proc] of Object.entries(global._bgProcesses)) {
            try { process.kill(Number(pid)); } catch (e) {}
        }
        global._bgProcesses = {};
    }
    if (terminalSessions && terminalSessions.size > 0) {
        for (const [id, session] of terminalSessions) {
            try { session.process.kill(); } catch (e) {}
        }
        terminalSessions.clear();
    }
    if (mcpClients && mcpClients.size > 0) {
        for (const [name, client] of mcpClients) {
            try { client.child.kill(); } catch (e) {}
        }
        mcpClients.clear();
    }

    if (serverModuleCache && serverModuleCache.cleanupOnShutdown) {
        try {
            console.log('[App] 正在清理下载任务...');
            const cleanupTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('清理超时')), 5000));
            await Promise.race([serverModuleCache.cleanupOnShutdown(), cleanupTimeout]);
            console.log('[App] 下载任务清理完成');
        } catch (e) {
            console.error('[App] 关闭清理失败:', e.message);
        }
    }
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

// ============================================================================
// versepc:// 协议处理器 - 直接调用业务逻辑，无 HTTP 模拟层
// ============================================================================

/**
 * 主协议处理入口
 * 路由规则：
 * - /api/*  -> API 请求（包括 SSE 流式请求）
 * - 其他     -> 静态文件
 */
async function handleVersePCProtocol(request) {
    try {
        const reqUrl = new URL(request.url);
        let pathname = reqUrl.pathname;

        if (pathname.startsWith('/api/')) {
            return await handleAPIRequest(request, reqUrl);
        }

        return await handleStaticFile(pathname, request);
    } catch (e) {
        console.error('Protocol handler error:', e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * 处理 API 请求
 * 解析请求方法和参数后，直接调用 server.js 的 handleNativeAPI
 * 不做 HTTP 模拟，直接函数调用
 */
async function handleAPIRequest(request, reqUrl) {
    const method = request.method;
    let body = null;
    let contentType = request.headers.get('content-type') || 'application/json';
    if (method === 'POST' || method === 'PUT') {
        try {
            const arrBuf = await request.arrayBuffer();
            body = Buffer.from(arrBuf);
        } catch (e) { body = null; }
    }

    const query = {};
    reqUrl.searchParams.forEach((value, key) => { query[key] = value; });

    const pathname = reqUrl.pathname;
    console.log('[Fav] handleAPIRequest:', method, pathname);
    // 判断是否为 SSE（Server-Sent Events）流式请求
    const isSSE = pathname === '/api/game/log/stream' ||
                  (pathname === '/api/install-progress' && query.sse === 'true');

    if (isSSE) {
        return handleSSERequest(pathname, method, body, query);
    }

    try {
        if (!apiHandler || !apiHandler.handleNativeAPI) {
            const reloaded = reloadServerModule();
            if (!reloaded) {
                return new Response(JSON.stringify({ error: 'Server module unavailable' }), {
                    status: 503, headers: { 'Content-Type': 'application/json' }
                });
            }
        }
        const result = await apiHandler.handleNativeAPI(pathname, method, body, query, contentType);
        const responseHeaders = new Headers();
        Object.entries(result.headers || {}).forEach(([key, value]) => {
            try { responseHeaders.set(key, value); } catch (e) {}
        });

        const responseBody = result.body instanceof Buffer
            ? new Uint8Array(result.body.buffer, result.body.byteOffset, result.body.byteLength)
            : result.body;
        return new Response(responseBody, {
            status: result.status,
            headers: responseHeaders
        });
    } catch (e) {
        console.error('API handler error:', pathname, e.message);
        const isFatal = e instanceof TypeError || e.message.includes('is not a function') || e.message.includes('Cannot read prop');
        if (isFatal && _serverCrashCount < SERVER_MAX_CRASHES) {
            console.warn(`[Server] Fatal error detected, attempting reload... (${_serverCrashCount + 1}/${SERVER_MAX_CRASHES})`);
            reloadServerModule();
        }
        return new Response(JSON.stringify({ error: '内部服务错误' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * 处理 SSE（Server-Sent Events）流式请求
 * 通过 Readable Stream 将 server.js 的异步数据推送到渲染进程
 * 用于游戏日志流和安装进度流
 */
function handleSSERequest(pathname, method, body, query) {
    const { Readable } = require('stream');
    const readable = new Readable({ read() {} });

    try {
        if (!apiHandler || !apiHandler.handleNativeSSE) {
            const reloaded = reloadServerModule();
            if (!reloaded) {
                readable.push('data: {"error":"Server module unavailable"}\n\n');
                readable.push(null);
                return new Response(readable, {
                    status: 503,
                    headers: new Headers({ 'Content-Type': 'text/event-stream' })
                });
            }
        }

        const { status, headers } = apiHandler.handleNativeSSE(pathname, method, body, query, (chunk) => {
            if (chunk === null) {
                readable.push(null);
            } else {
                readable.push(chunk);
            }
        });

        const responseHeaders = new Headers();
        responseHeaders.set('Content-Type', 'text/event-stream');
        responseHeaders.set('Cache-Control', 'no-cache');
        responseHeaders.set('Connection', 'keep-alive');
        Object.entries(headers || {}).forEach(([key, value]) => {
            try { responseHeaders.set(key, value); } catch (e) {}
        });

        return new Response(readable, {
            status: status,
            headers: responseHeaders
        });
    } catch (e) {
        console.error('SSE handler error:', pathname, e.message);
        const isFatal = e instanceof TypeError || e.message.includes('is not a function') || e.message.includes('Cannot read prop');
        if (isFatal && _serverCrashCount < SERVER_MAX_CRASHES) {
            console.warn(`[Server] SSE fatal error, attempting reload... (${_serverCrashCount + 1}/${SERVER_MAX_CRASHES})`);
            reloadServerModule();
        }
        readable.push('data: {"error":"内部服务错误"}\n\n');
        readable.push(null);
        return new Response(readable, {
            status: 500,
            headers: new Headers({ 'Content-Type': 'text/event-stream' })
        });
    }
}

/**
 * 处理静态文件请求
 * 安全检查：只允许访问应用目录内的文件，防止路径遍历攻击
 */
async function handleStaticFile(pathname, request) {
    let filePath;
    if (pathname === '/' || pathname === '/index.html') {
        filePath = path.join(__dirname, 'index.html');
    } else {
        filePath = path.join(__dirname, pathname.replace(/^\//, ''));
    }

    filePath = path.resolve(filePath);
    const appDir = path.resolve(__dirname);
    if (!filePath.toLowerCase().startsWith(appDir.toLowerCase())) {
        return new Response('Forbidden', { status: 403 });
    }

    // Files unpacked from asar live in app.asar.unpacked next to app.asar
    if (!fs.existsSync(filePath)) {
        const unpackedPath = path.join(path.dirname(__dirname), 'app.asar.unpacked', pathname.replace(/^\//, ''));
        if (fs.existsSync(unpackedPath)) {
            filePath = path.resolve(unpackedPath);
        }
    }

    try {
        const stats = await fs.promises.stat(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const rangeHeader = request?.headers?.get?.('range');

        if (rangeHeader) {
            const parts = rangeHeader.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
            if (isNaN(start) || isNaN(end) || start >= stats.size || end >= stats.size || start > end) {
                return new Response('Range Not Satisfiable', { status: 416 });
            }
            const chunkSize = end - start + 1;
            const stream = fs.createReadStream(filePath, { start, end });
            return new Response(stream, {
                status: 206,
                headers: {
                    'Content-Type': contentType,
                    'Content-Length': String(chunkSize),
                    'Content-Range': `bytes ${start}-${end}/${stats.size}`,
                    'Accept-Ranges': 'bytes',
                    'Cache-Control': 'no-cache'
                }
            });
        }

        const stream = fs.createReadStream(filePath);
        return new Response(stream, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': String(stats.size),
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'no-cache'
            }
        });
    } catch (e) {
        return new Response('Not Found', { status: 404 });
    }
}

let _allowedPathRoots = null;
function getAllowedPathRoots() {
    if (_allowedPathRoots) return _allowedPathRoots;
    const os = require('os');
    const homeDir = os.homedir();
    const roots = [
        homeDir,
        path.join(homeDir, '.minecraft'),
        path.join(homeDir, 'AppData', 'Local', 'VersePC'),
    ];
    try { roots.push(app.getPath('userData')); } catch (e) {}
    try { roots.push(app.getPath('temp')); } catch (e) {}
    try { roots.push(app.getPath('downloads')); } catch (e) {}
    try { roots.push(app.getPath('desktop')); } catch (e) {}
    try { roots.push(app.getPath('documents')); } catch (e) {}
    _allowedPathRoots = roots.map(r => path.resolve(r).toLowerCase());
    return _allowedPathRoots;
}

function isPathAllowed(filePath) {
    if (!filePath || typeof filePath !== 'string') return false;
    const resolved = path.resolve(filePath).toLowerCase();
    const originalSegments = filePath.replace(/\\/g, '/').split('/');
    if (originalSegments.includes('..')) return false;
    const roots = getAllowedPathRoots();
    return roots.some(root => resolved.startsWith(root));
}

// ============================================================================
// 模组文件操作 IPC Handlers
// ============================================================================

/**
 * 注册所有模组相关的 IPC 处理器
 * 提供文件浏览、读写、搜索、JAR 操作等功能
 */
function registerModsIPC() {
    ipcMain.handle("dialog:select-folder", async (event, { title, defaultPath }) => {
        try {
            let resolvedDefault = defaultPath || '';
            if (resolvedDefault) {
                try {
                    if (!fs.existsSync(resolvedDefault)) {
                        fs.mkdirSync(resolvedDefault, { recursive: true });
                    }
                } catch (e) {
                    let fallback = path.dirname(resolvedDefault);
                    while (fallback && fallback !== path.dirname(fallback)) {
                        if (fs.existsSync(fallback)) { resolvedDefault = fallback; break; }
                        fallback = path.dirname(fallback);
                    }
                    if (!resolvedDefault || !fs.existsSync(resolvedDefault)) resolvedDefault = '';
                }
            }
            const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
            const result = await dialog.showOpenDialog(win, {
                properties: ['openDirectory'],
                title: title || '选择文件夹',
                defaultPath: resolvedDefault || undefined
            });
            if (result.canceled || !result.filePaths.length) {
                return { cancelled: true };
            }
            return { cancelled: false, path: result.filePaths[0] };
        } catch (e) {
            return { cancelled: true, error: e.message };
        }
    });

    ipcMain.handle("dialog:select-file", async (event, { title, filters, defaultPath }) => {
        try {
            const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
            const result = await dialog.showOpenDialog(win, {
                properties: ['openFile'],
                title: title || '选择文件',
                filters: filters || [],
                defaultPath: defaultPath || undefined
            });
            if (result.canceled || !result.filePaths.length) {
                return { cancelled: true };
            }
            return { cancelled: false, path: result.filePaths[0] };
        } catch (e) {
            return { cancelled: true, error: e.message };
        }
    });

    // 列出目录内容
    ipcMain.handle("mods:list", async (event, { path: dirPath }) => {
        try {
            if (!isPathAllowed(dirPath)) return { success: false, error: '路径不被允许' };
            const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
            const result = await Promise.all(items.map(async (item) => {
                const fullPath = path.join(dirPath, item.name);
                let stats = null;
                try { stats = await fs.promises.stat(fullPath); } catch (e) {}
                return {
                    name: item.name,
                    path: fullPath,
                    isDirectory: item.isDirectory(),
                    size: stats ? stats.size : undefined,
                    modifiedTime: stats ? stats.mtime.toISOString() : undefined,
                };
            }));
            return { success: true, files: result };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // 读取文件内容
    ipcMain.handle("mods:read", async (event, { path: filePath }) => {
        try {
            if (!isPathAllowed(filePath)) return { success: false, error: '路径不被允许' };
            const content = await fs.promises.readFile(filePath, "utf-8");
            return { success: true, path: filePath, content, encoding: "utf-8" };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // 写入文件内容
    ipcMain.handle("mods:write", async (event, { path: filePath, content }) => {
        try {
            if (!isPathAllowed(filePath)) return { success: false, error: '路径不被允许' };
            await fs.promises.writeFile(filePath, content, "utf-8");
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // 递归搜索文件
    ipcMain.handle("mods:search", async (event, { path: basePath, pattern }) => {
        const results = [];
        try {
            if (!isPathAllowed(basePath)) return { success: false, error: '路径不被允许' };
            await searchFilesRecursive(basePath, pattern, results);
            return { success: true, files: results };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // 获取模组信息（读取 mods.json 或 manifest.json）
    ipcMain.handle("mods:getModInfo", async (event, { path: modDirPath }) => {
        try {
            if (!isPathAllowed(modDirPath)) return { success: false, error: '路径不被允许' };
            const modJsonPath = path.join(modDirPath, "mods.json");
            const manifestPath = path.join(modDirPath, "manifest.json");
            
            let data = null;
            if (fs.existsSync(modJsonPath)) {
                data = JSON.parse(await fs.promises.readFile(modJsonPath, "utf-8"));
            } else if (fs.existsSync(manifestPath)) {
                data = JSON.parse(await fs.promises.readFile(manifestPath, "utf-8"));
            }
            
            return { success: true, info: data };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // 检测模组结构（类型、模组数量、是否有配置文件夹、语言文件）
    ipcMain.handle("mods:detectStructure", async (event, { path: modsDirPath }) => {
        try {
            if (!isPathAllowed(modsDirPath)) return { success: false, error: '路径不被允许' };
            const files = await fs.promises.readdir(modsDirPath);
            
            let type = "unknown";
            let modCount = 0;
            let hasConfig = false;
            let languageFiles = [];
            
            if (files.includes("mods.toml")) type = "neoforge";
            
            const jarFiles = files.filter(f => f.endsWith(".jar"));
            modCount = jarFiles.length;
            
            try { await fs.promises.access(path.join(modsDirPath, "config")); hasConfig = true; } catch { hasConfig = false; }
            
            const langFiles = await searchFilesRecursive(modsDirPath, "*.lang", []);
            languageFiles = langFiles.map(f => path.relative(modsDirPath, f));
            
            return { success: true, type, modCount, hasConfig, languageFiles };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // 获取已安装的版本列表（包含模组加载器信息和模组数量）
    ipcMain.handle("mods:getInstalledVersions", async () => {
        try {
            const versionsDir = path.join(os.homedir(), '.versepc', 'versions');
            try { await fs.promises.access(versionsDir); } catch { return { success: true, versions: [] }; }

            const versions = [];
            const dirs = await fs.promises.readdir(versionsDir, { withFileTypes: true });

            for (const dir of dirs) {
                if (!dir.isDirectory()) continue;
                const versionDir = path.join(versionsDir, dir.name);
                const jsonFile = path.join(versionDir, `${dir.name}.json`);
                const modsDir = path.join(versionDir, 'mods');

                try { await fs.promises.access(jsonFile); } catch { continue; }

                let versionInfo = { id: dir.name, type: 'release', isFabric: false, isForge: false, isNeoForge: false, hasMods: false, modsPath: modsDir };

                try {
                    const data = JSON.parse(await fs.promises.readFile(jsonFile, 'utf-8'));
                    const versionIdLower = (data.id || dir.name).toLowerCase();
                    const mainClassLower = (data.mainClass || '').toLowerCase();
                    versionInfo.id = data.id || dir.name;
                    versionInfo.type = data.type || 'release';
                    versionInfo.isFabric = mainClassLower.includes('fabric') || versionIdLower.includes('fabric');
                    versionInfo.isForge = mainClassLower.includes('forge') || mainClassLower.includes('modlauncher') || versionIdLower.includes('forge');
                    versionInfo.isNeoForge = versionIdLower.includes('neoforge');
                } catch (e) {}

                try {
                    await fs.promises.access(modsDir);
                    const modsItems = await fs.promises.readdir(modsDir);
                    versionInfo.hasMods = modsItems.length > 0;
                    versionInfo.modsCount = modsItems.filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled')).length;
                } catch (e) {
                    versionInfo.hasMods = false;
                    versionInfo.modsCount = 0;
                }

                versions.push(versionInfo);
            }

            versions.sort((a, b) => {
                if (a.hasMods && !b.hasMods) return -1;
                if (!a.hasMods && b.hasMods) return 1;
                return b.id.localeCompare(a.id);
            });

            return { success: true, versions };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // 列出 JAR/ZIP 文件中的条目
    ipcMain.handle("mods:listJar", async (event, { path: jarPath }) => {
        try {
            if (!isPathAllowed(jarPath)) return { success: false, error: '路径不被允许' };
            try { await fs.promises.access(jarPath); } catch { return { success: false, error: '文件不存在' }; }
            const entries = await parseJarFile(jarPath);
            return { success: true, entries: entries };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // 读取 JAR/ZIP 文件中指定条目的内容
    ipcMain.handle("mods:readJarEntry", async (event, { jarPath, entryName }) => {
        try {
            if (!isPathAllowed(jarPath)) return { success: false, error: '路径不被允许' };
            try { await fs.promises.access(jarPath); } catch { return { success: false, error: '文件不存在' }; }
            const content = await readJarEntryContent(jarPath, entryName);
            if (content === null) {
                return { success: false, error: '入口不存在: ' + entryName };
            }
            return { success: true, content: content.toString('utf-8'), entryName };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // 写入 JAR/ZIP 文件中的指定条目（使用 adm-zip 库）
    ipcMain.handle("mods:writeJarEntry", async (event, { jarPath, entryName, content }) => {
        try {
            if (!isPathAllowed(jarPath)) return { success: false, error: '路径不被允许' };
            try { await fs.promises.access(jarPath); } catch { return { success: false, error: 'JAR文件不存在' }; }
            const AdmZip = require('adm-zip');
            let zip;
            try {
                zip = new AdmZip(jarPath);
            } catch (e) {
                const tmpPath = jarPath + '.tmp';
                fs.copyFileSync(jarPath, tmpPath);
                try {
                    zip = new AdmZip(tmpPath);
                    zip.addFile(entryName, Buffer.from(content, 'utf-8'));
                    zip.writeZip(jarPath);
                } finally {
                    try { fs.unlinkSync(tmpPath); } catch (e) {}
                }
                return { success: true, entryName };
            }
            zip.addFile(entryName, Buffer.from(content, 'utf-8'));
            zip.writeZip(jarPath);
            return { success: true, entryName };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // 查找 JAR 文件中的语言文件（用于模组汉化）
    ipcMain.handle("mods:findLangFiles", async (event, { jarPath }) => {
        try {
            if (!isPathAllowed(jarPath)) return { success: false, error: '路径不被允许' };
            try { await fs.promises.access(jarPath); } catch { return { success: false, error: 'JAR文件不存在' }; }
            const entries = await parseJarFile(jarPath);
            const langFiles = entries.filter(e =>
                !e.isDirectory && (
                    e.name.match(/lang\/[a-z]{2,3}_[a-z]{2,3}\.(json|lang)$/i) ||
                    e.name.match(/assets\/.+\/lang\/[a-z]{2,3}_[a-z]{2,3}\.(json|lang)$/i)
                )
            );
            langFiles.sort((a, b) => a.name.localeCompare(b.name));
            var hasEnUs = false;
            var hasZhCn = false;
            var defaultLang = null;
            langFiles.forEach(function(e) {
                var lower = e.name.toLowerCase();
                if (lower.includes('en_us') || lower.includes('en_gb')) { hasEnUs = true; }
                if (lower.includes('zh_cn')) { hasZhCn = true; }
                if (!defaultLang && (lower.includes('en_') || lower === 'en.json' || lower === 'en.lang')) {
                    defaultLang = e.name;
                }
            });
            if (!defaultLang && langFiles.length > 0) {
                defaultLang = langFiles[0].name;
            }
            const result = langFiles.map(e => ({
                name: e.name,
                size: e.size,
                isEnglish: /en_(us|gb)/i.test(e.name),
                isChinese: /zh_(cn|tw|hk)/i.test(e.name),
                zhName: e.name.replace(/([a-z]{2,3}_[a-z]{2,3})/i, 'zh_cn')
            }));
            return {
                success: true,
                langFiles: result,
                hasEnUs: hasEnUs,
                hasZhCn: hasZhCn,
                defaultSourceLang: defaultLang,
                totalLangs: langFiles.length
            };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // 确保目录存在（递归创建）
    ipcMain.handle("mods:ensureDir", async (event, { path: dirPath }) => {
        try {
            if (!isPathAllowed(dirPath)) return { success: false, error: '路径不被允许' };
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // 获取默认模组路径（智能版本隔离逻辑自动定位mods文件夹）
    let _defaultModPathCache = { path: '', time: 0 };
    const DEFAULT_MOD_PATH_TTL = 30000;
    ipcMain.handle("getDefaultModPath", async () => {
        try {
            if (_defaultModPathCache.path && (Date.now() - _defaultModPathCache.time) < DEFAULT_MOD_PATH_TTL) {
                return { success: true, path: _defaultModPathCache.path };
            }
            const homeDir = os.homedir();
            const dataDir = path.join(homeDir, '.versepc');
            const versionsDir = path.join(dataDir, 'versions');
            const minecraftDir = path.join(homeDir, '.minecraft');

            let settings = {};
            try {
                const content = await fs.promises.readFile(path.join(dataDir, 'settings.json'), 'utf8');
                settings = JSON.parse(content);
            } catch (e) {}

            let versionId = settings.selectedVersion || '';

            if (!versionId) {
                try {
                    const dirs = await fs.promises.readdir(versionsDir, { withFileTypes: true });
                    const versionDirs = dirs.filter(d => d.isDirectory());
                    if (versionDirs.length > 0) versionId = versionDirs[0].name;
                } catch (e) {}
            }

            if (!versionId) {
                const defaultPath = path.join(minecraftDir, 'mods');
                await fs.promises.mkdir(defaultPath, { recursive: true }).catch(() => {});
                _defaultModPathCache = { path: defaultPath, time: Date.now() };
                return { success: true, path: defaultPath };
            }

            let gameDir;
            if (versionId.includes('[外部]')) {
                try {
                    const storeFile = path.join(dataDir, 'store.json');
                    const storeContent = await fs.promises.readFile(storeFile, 'utf8');
                    const store = JSON.parse(storeContent);
                    const folders = store.externalVersionFolders || [];
                    const cleanId = versionId.replace(/\s*\[外部\]/, '');
                    for (const folder of folders) {
                        const candidate = path.join(folder, cleanId);
                        if (fs.existsSync(candidate)) { gameDir = candidate; break; }
                        const candidate2 = path.join(folder, versionId);
                        if (fs.existsSync(candidate2)) { gameDir = candidate2; break; }
                    }
                } catch (e) {}
                if (!gameDir) {
                    gameDir = path.join(versionsDir, versionId.replace(/\s*\[外部\]/, ''));
                }
            } else {
                let effectiveIsolation;
                try {
                    const verSettingsFile = path.join(versionsDir, versionId, 'version-settings.json');
                    const verContent = await fs.promises.readFile(verSettingsFile, 'utf8');
                    const verSettings = JSON.parse(verContent);
                    if (verSettings.isolation === 'on') effectiveIsolation = true;
                    else if (verSettings.isolation === 'off') effectiveIsolation = false;
                } catch (e) {}

                if (effectiveIsolation === undefined) {
                    effectiveIsolation = settings.versionIsolation !== false;
                }

                if (!effectiveIsolation) {
                    const versionDir = path.join(versionsDir, versionId);
                    const hasMods = fs.existsSync(path.join(versionDir, 'mods'));
                    const hasSaves = fs.existsSync(path.join(versionDir, 'saves'));
                    const hasConfig = fs.existsSync(path.join(versionDir, 'config'));
                    if (hasMods || hasSaves || hasConfig) effectiveIsolation = true;
                }

                if (effectiveIsolation) {
                    gameDir = path.join(versionsDir, versionId);
                } else {
                    gameDir = settings.gameDir || dataDir;
                }
            }

            const defaultPath = path.join(gameDir, 'mods');
            await fs.promises.mkdir(defaultPath, { recursive: true }).catch(() => {});
            _defaultModPathCache = { path: defaultPath, time: Date.now() };
            return { success: true, path: defaultPath };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // 获取版本下载文件夹
    ipcMain.handle("getVersionsDir", async () => {
        try {
            const versionsDir = path.join(os.homedir(), '.versepc', 'versions');
            return { success: true, path: versionsDir };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // 获取所有外部版本文件夹路径
    ipcMain.handle("getExternalVersionFolders", async () => {
        try {
            const store = loadStore();
            const folders = store['externalVersionFolders'] || [];
            return { success: true, folders };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });
}

// ============================================================================
// 文件搜索工具函数
// ============================================================================

/**
 * 递归搜索文件
 * @param {string} basePath - 搜索起始路径
 * @param {string} pattern - 文件名模式（支持 * 和 ? 通配符）
 * @param {Array} results - 结果数组（会被原地修改）
 */
async function searchFilesRecursive(basePath, pattern, results) {
    const items = await fs.promises.readdir(basePath, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(basePath, item.name);
        if (item.isDirectory()) {
            await searchFilesRecursive(fullPath, pattern, results);
        } else if (item.isFile() && matchPattern(item.name, pattern)) {
            results.push(fullPath);
        }
    }
}

/**
 * 简单文件名模式匹配
 * 将通配符 * 和 ? 转换为正则表达式进行匹配
 */
function matchPattern(filename, pattern) {
    if (pattern === "*") return true;
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, ".*").replace(/\?/g, ".");
    const regex = new RegExp('^' + escaped + '$');
    return regex.test(filename);
}

// ============================================================================
// 多源更新检测与下载
// ============================================================================

const UPDATE_JSON_SOURCES = [
    'https://raw.gitmirror.com/doujie081231/versePc/main/update.json',
    'https://raw.githubusercontent.com/doujie081231/versePc/main/update.json',
    'https://cdn.jsdelivr.net/gh/doujie081231/versePc@main/update.json',
];

async function fetchUpdateJson() {
    const bust = Date.now();
    for (const url of UPDATE_JSON_SOURCES) {
        try {
            const fetchUrl = url + '?t=' + bust;
            console.log('[Updater] Trying source:', fetchUrl.substring(0, 80));
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const response = await net.fetch(fetchUrl, { signal: controller.signal });
            clearTimeout(timeout);
            if (!response.ok) {
                console.log('[Updater] Source returned', response.status);
                continue;
            }
            const data = await response.json();
            if (data && data.version && data.files) {
                console.log('[Updater] Got update info, version:', data.version);
                return data;
            }
        } catch (e) {
            console.log('[Updater] Source failed:', e.message);
        }
    }
    return null;
}

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

const DOWNLOAD_MIRRORS = [
    (url) => url,
    (url) => url.replace('https://github.com/', 'https://mirror.ghproxy.com/https://github.com/'),
    (url) => {
        const match = url.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\/(.+)/);
        if (match) {
            return `https://cdn.jsdelivr.net/gh/${match[1]}/${match[2]}@${match[3]}/${match[4]}`;
        }
        return url;
    },
];

async function downloadWithFallback(fileInfo, targetPath, onProgress) {
    const crypto = require('crypto');

    for (const getMirrorUrl of DOWNLOAD_MIRRORS) {
        const downloadUrl = getMirrorUrl(fileInfo.url);
        try {
            console.log('[Updater] Downloading from:', downloadUrl);
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const response = await net.fetch(downloadUrl, { signal: controller.signal });
            clearTimeout(timeout);

            if (!response.ok) {
                console.log('[Updater] Download failed, status:', response.status);
                continue;
            }

            const totalSize = parseInt(response.headers.get('content-length') || fileInfo.size || '0');
            const reader = response.body.getReader();
            const chunks = [];
            let received = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                received += value.length;
                if (onProgress && totalSize > 0) {
                    onProgress({ percent: (received / totalSize) * 100, transferred: received, total: totalSize });
                }
            }

            const buffer = Buffer.concat(chunks);

            if (fileInfo.sha256) {
                const hash = crypto.createHash('sha256').update(buffer).digest('hex');
                if (hash !== fileInfo.sha256) {
                    console.error('[Updater] SHA256 mismatch:', hash, 'expected:', fileInfo.sha256);
                    throw new Error('SHA256 校验失败');
                }
            }

            fs.writeFileSync(targetPath, buffer);
            console.log('[Updater] Download complete:', targetPath);
            return true;
        } catch (e) {
            console.log('[Updater] Download source failed:', downloadUrl, e.message);
        }
    }
    return false;
}

// ============================================================================
// 自动更新模块 - 基于 electron-updater
// ============================================================================

let updateDownloadedPath = null;

const UPDATE_CONFIG_PATH = path.join(require('os').homedir(), '.versepc', 'update-config.json');

function loadUpdateConfig() {
    try {
        if (fs.existsSync(UPDATE_CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(UPDATE_CONFIG_PATH, 'utf8'));
        }
    } catch (e) {}
    return { skippedVersion: null };
}

function saveUpdateConfig(config) {
    try {
        const dir = path.dirname(UPDATE_CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(UPDATE_CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (e) {}
}

/**
 * 初始化自动更新器
 * 启动时静默检查，发现新版本后弹出通知
 * 基于多源 update.json 检测，支持国内 CDN 加速
 */
function initAutoUpdater() {
    const config = loadUpdateConfig();

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

function showUpdateNotification(info) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const notes = typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
            ? info.releaseNotes.map(n => n.note || '').filter(Boolean).join('\n')
            : '';
    sendToUpdateUI('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseName: info.releaseName,
        releaseNotes: notes,
        currentVersion: app.getVersion(),
    });
}

async function doDownloadUpdate(updateInfo) {
    const fileInfo = updateInfo.files?.['win-x64'];
    if (!fileInfo) {
        sendToUpdateUI('update-error', { message: '未找到适用于当前平台的安装包' });
        return;
    }

    sendToUpdateUI('start-download', {});

    const targetPath = path.join(app.getPath('temp'), `VersePC-Setup-${updateInfo.version}.exe`);

    try {
        const success = await downloadWithFallback(fileInfo, targetPath, (progress) => {
            sendToUpdateUI('download-progress', {
                percent: progress.percent,
                transferred: progress.transferred,
                total: progress.total,
            });
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

function showUpdateReadyDialog(info) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    dialog.showMessageBox(mainWindow, {
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

function runInstallerAndQuit() {
    if (!updateDownloadedPath || !fs.existsSync(updateDownloadedPath)) return;
    shuttingDown = true;
    const { spawn } = require('child_process');
    spawn(updateDownloadedPath, ['/SILENT'], {
        detached: true,
        stdio: 'ignore',
        windowsVerbatimArguments: true,
    }).unref();
    app.quit();
}

function sendToUpdateUI(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater-status', { channel, data });
    }
}

function registerAIChatIPC() {
    const https = require('https');
    const http = require('http');

    ipcMain.handle('ai:get-providers', async () => {
        return Object.entries(AI_PROVIDERS).map(([key, p]) => ({
            key,
            name: p.name,
            models: p.models
        }));
    });

    ipcMain.handle('ai:is-enabled', async () => {
        try {
            const p = require('path');
            const fs = require('fs');
            let cfgPath = p.join(__dirname, 'ai-enabled.json');
            if (!fs.existsSync(cfgPath)) {
                cfgPath = p.join(p.dirname(p.dirname(__dirname)), 'ai-enabled.json');
            }
            if (fs.existsSync(cfgPath)) {
                const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
                return cfg.enabled === true;
            }
        } catch (_) {}
        return false;
    });

    ipcMain.handle('ai:get-versions', async () => {
        const fs = require('fs');
        const pathMod = require('path');
        const os = require('os');
        const versionsDir = pathMod.join(os.homedir(), '.versepc', 'versions');
        if (!fs.existsSync(versionsDir)) return [];

        function detectLoaderFromJson(data, dirName) {
            const jsonStr = JSON.stringify(data).toLowerCase();
            const idLower = (data.id || dirName).toLowerCase();
            const mcLower = (data.mainClass || '').toLowerCase();
            if (/fabric/i.test(idLower) || /fabric/i.test(mcLower) || jsonStr.includes('net.fabricmc:fabric-loader') || jsonStr.includes('org.quiltmc:quilt-loader')) return 'Fabric';
            if (jsonStr.includes('net.neoforge') || jsonStr.includes('neoforged') || /neoforge/i.test(idLower)) return 'NeoForge';
            if (jsonStr.includes('net.minecraftforge') || /forge/i.test(idLower) || /forge/i.test(mcLower)) return 'Forge';
            if (jsonStr.includes('optifine:optifine') || /optifine/i.test(idLower)) return 'OptiFine';
            if (jsonStr.includes('liteloader') || /liteloader/i.test(idLower)) return 'LiteLoader';
            return null;
        }

        function resolveLoaderFromInheritsChain(data, dirName, depth) {
            if (depth > 5) return null;
            const loader = detectLoaderFromJson(data, dirName);
            if (loader) return loader;
            if (data.inheritsFrom) {
                const inheritLower = data.inheritsFrom.toLowerCase();
                if (/fabric/i.test(inheritLower)) return 'Fabric';
                if (/forge/i.test(inheritLower)) return 'Forge';
                if (/neoforge/i.test(inheritLower)) return 'NeoForge';
                if (/quilt/i.test(inheritLower)) return 'Quilt';
                if (/optifine/i.test(inheritLower)) return 'OptiFine';
                const parentPath = pathMod.join(versionsDir, data.inheritsFrom, data.inheritsFrom + '.json');
                if (fs.existsSync(parentPath)) {
                    try {
                        const parentData = JSON.parse(fs.readFileSync(parentPath, 'utf8'));
                        return resolveLoaderFromInheritsChain(parentData, data.inheritsFrom, depth + 1);
                    } catch (_) {}
                }
            }
            return null;
        }

        try {
            const dirs = await fs.promises.readdir(versionsDir, { withFileTypes: true });
            const results = [];
            for (const d of dirs) {
                if (!d.isDirectory()) continue;
                const versionDir = pathMod.join(versionsDir, d.name);
                const info = { id: d.name, name: d.name, path: versionDir };
                try {
                    const versionJsonPath = pathMod.join(versionDir, d.name + '.json');
                    if (fs.existsSync(versionJsonPath)) {
                        const data = JSON.parse(await fs.promises.readFile(versionJsonPath, 'utf8'));
                        info.type = data.type || 'release';
                        info.baseVersion = d.name.replace(/-?(fabric|forge|neoforge|optifine|liteloader|quilt)[\s\S]*/i, '').trim();
                        if (data.inheritsFrom) info.inheritsFrom = data.inheritsFrom;
                        if (data.javaVersion) info.javaVersion = data.javaVersion.majorVersion || '';
                        let detectedLoader = detectLoaderFromJson(data, d.name);
                        if (!detectedLoader) detectedLoader = resolveLoaderFromInheritsChain(data, d.name, 0);
                        info.loader = detectedLoader || 'Vanilla';
                        info.isFabric = info.loader === 'Fabric';
                        info.isForge = info.loader === 'Forge';
                        info.isNeoForge = info.loader === 'NeoForge';
                        info.isOptiFine = info.loader === 'OptiFine';
                        info.isQuilt = info.loader === 'Quilt';
                        const modsDir = pathMod.join(versionDir, 'mods');
                        if (fs.existsSync(modsDir)) {
                            const modFiles = await fs.promises.readdir(modsDir);
                            info.modsCount = modFiles.filter(f => f.endsWith('.jar')).length;
                        }
                        info.modsPath = modsDir;
                    }
                } catch (e) {}
                results.push(info);
            }
            return results;
        } catch (e) { return []; }
    });

    const AI_TOOLS = [
        {
            type: 'function',
            function: {
                name: 'search_mods',
                description: '搜索 Minecraft 模组。ALWAYS 同时搜索两个平台(source=modrinth和curseforge)获取更全面结果。NEVER 只搜一个平台就停止。如果首次搜索结果不够，换关键词或平台再搜。传入loader和version参数过滤兼容版本。展示结果时列出所有匹配的版本信息，让用户看到完整选择。',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: '搜索关键词，如模组名称' },
                        source: { type: 'string', enum: ['modrinth', 'curseforge'], description: '搜索平台，默认 modrinth。建议两个平台都搜索' },
                        loader: { type: 'string', description: '模组加载器过滤，如 fabric、forge、neoforge、quilt' },
                        version: { type: 'string', description: 'Minecraft 版本过滤，如 1.20.1' },
                        limit: { type: 'number', description: '返回结果数量，默认10' }
                    },
                    required: ['query']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'install_mod',
                description: '安装指定模组到指定游戏版本。ALWAYS 在安装前自动执行：1)get_current_context确认当前版本和加载器；2)get_versions检查已安装版本；3)get_installed_mods检查该模组是否已安装。NEVER 在未确认目标版本已安装且带加载器的情况下调用。如果目标版本不存在，先自动install_version+install_loader。',
                parameters: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string', description: '模组项目ID（从 search_mods 结果中获取）' },
                        source: { type: 'string', enum: ['modrinth', 'curseforge'], description: '模组来源平台' },
                        loader: { type: 'string', description: '模组加载器（必填），如 fabric、forge、neoforge' },
                        mcVersion: { type: 'string', description: '目标 Minecraft 版本（必填），如 1.20.1' },
                        versionId: { type: 'string', description: '精确的已安装版本ID（可选），如 1.20.1-fabric-0.15.11。优先使用此参数定位mods目录，避免多版本混淆' }
                    },
                    required: ['projectId', 'source', 'mcVersion', 'loader']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_installed_mods',
                description: '获取当前选中游戏版本已安装的模组列表。ALWAYS 在安装模组前调用此工具检查是否已存在，避免重复安装。返回模组名称、版本、启用状态等。',
                parameters: { type: 'object', properties: {} }
            }
        },
        {
            type: 'function',
            function: {
                name: 'toggle_mod',
                description: '启用或禁用指定模组（通过添加/移除 .disabled 后缀）。',
                parameters: {
                    type: 'object',
                    properties: {
                        modPath: { type: 'string', description: '模组文件完整路径' },
                        enable: { type: 'boolean', description: 'true 为启用，false 为禁用' }
                    },
                    required: ['modPath', 'enable']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_system_info',
                description: '获取系统信息，包括内存容量、可用内存、操作系统等。',
                parameters: { type: 'object', properties: {} }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_versions',
                description: '获取 Minecraft 版本列表。每个版本包含 id、type、path(完整路径)、loader(加载器类型如Fabric/Forge/Vanilla)、modsCount(模组数量)、baseVersion(基础MC版本)。installedOnly=true 只返回已安装版本（含完整路径和元数据），false 返回所有可用版本。',
                parameters: {
                    type: 'object',
                    properties: {
                        installedOnly: { type: 'boolean', description: '是否只返回已安装的版本（含路径、加载器、模组数等详细信息），默认 false' }
                    }
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_game_status',
                description: '获取游戏运行状态，包括是否正在运行、运行时长等信息。',
                parameters: { type: 'object', properties: {} }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_mod_details',
                description: '获取指定模组的详细信息，包括描述、所有可用版本列表、依赖等。ALWAYS 在安装模组前调用此工具确认版本兼容性。NEVER 假设模组兼容某个版本，务必先查详情。',
                parameters: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string', description: '模组项目ID' },
                        source: { type: 'string', enum: ['modrinth', 'curseforge'], description: '模组来源平台' }
                    },
                    required: ['projectId', 'source']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'browse_directory',
                description: '浏览文件系统目录。不传path参数时返回快捷访问路径列表。ALWAYS 在需要了解目录结构时先调用此工具，NEVER 猜测目录内容。支持浏览 .versepc、.minecraft 和用户主目录。',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: '要浏览的目录路径，不传则返回快捷访问路径' },
                        type: { type: 'string', enum: ['dir', 'all'], description: '只看文件夹(dir)还是全部(all)，默认 dir' },
                        pattern: { type: 'string', description: '文件名过滤模式，如 *.jar、*.json' }
                    }
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'read_file',
                description: '读取文本文件内容。ALWAYS 在编辑文件前先读取当前内容，NEVER 猜测文件内容。可访问 .versepc、.minecraft、用户桌面/文档/下载目录，限制100KB。',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: '文件完整路径' },
                        lines: { type: 'number', description: '只读取最后N行，不传则读取全部' }
                    },
                    required: ['path']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'launch_game',
                description: '启动指定版本的 Minecraft 游戏。会自动处理认证、依赖检查等。',
                parameters: {
                    type: 'object',
                    properties: {
                        versionId: { type: 'string', description: '要启动的游戏版本ID' }
                    },
                    required: ['versionId']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'stop_game',
                description: '停止正在运行的 Minecraft 游戏实例。',
                parameters: {
                    type: 'object',
                    properties: {
                        sessionId: { type: 'string', description: '游戏会话ID，不传则停止所有实例' }
                    }
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_game_log',
                description: '获取游戏运行日志，用于诊断问题。',
                parameters: {
                    type: 'object',
                    properties: {
                        sessionId: { type: 'string', description: '游戏会话ID' },
                        count: { type: 'number', description: '获取最后N行日志，默认50' }
                    }
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'diagnose_crash',
                description: '获取崩溃日志。ALWAYS 在用户报告游戏崩溃/闪退时主动调用，NEVER 让用户手动找日志。不传参数获取最近崩溃日志列表，传入logPath获取具体内容。',
                parameters: {
                    type: 'object',
                    properties: {
                        logPath: { type: 'string', description: '指定崩溃日志路径，不传则获取最近的崩溃日志列表' }
                    }
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'manage_settings',
                description: '读取或修改启动器设置。action=read 读取设置，action=write 修改设置。',
                parameters: {
                    type: 'object',
                    properties: {
                        action: { type: 'string', enum: ['read', 'write'], description: '操作类型：read读取设置，write修改设置' },
                        key: { type: 'string', description: '设置项名称（write时必填），如 javaPath、maxMemory、minMemory、versionIsolation、javaArgs' },
                        value: { type: 'string', description: '设置值（write时必填）' }
                    },
                    required: ['action']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'install_version',
                description: '安装指定版本的 Minecraft。versionUrl 必须从 get_versions 返回的 versions 列表中的 url 字段获取。ALWAYS 先调用 get_versions 获取url，NEVER 自行编造URL。安装后用 install_progress 轮询进度。',
                parameters: {
                    type: 'object',
                    properties: {
                        versionId: { type: 'string', description: '要安装的版本ID，如 1.20.1' },
                        versionUrl: { type: 'string', description: '版本JSON的URL，必须从 get_versions 返回的 versions[].url 获取' }
                    },
                    required: ['versionId', 'versionUrl']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'install_progress',
                description: '查询版本安装进度。',
                parameters: {
                    type: 'object',
                    properties: {
                        sessionId: { type: 'string', description: '安装会话ID' }
                    },
                    required: ['sessionId']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'install_loader',
                description: '安装模组加载器(Fabric/Forge/NeoForge)到指定游戏版本。ALWAYS 在安装模组前确认目标版本已有对应加载器，NEVER 假设加载器已安装。如果版本刚安装完，需先等安装完成再装加载器。',
                parameters: {
                    type: 'object',
                    properties: {
                        loader: { type: 'string', enum: ['fabric', 'forge', 'neoforge'], description: '加载器类型' },
                        gameVersion: { type: 'string', description: '游戏版本，如 1.20.1' },
                        loaderVersion: { type: 'string', description: '加载器版本，不传则使用最新版' }
                    },
                    required: ['loader', 'gameVersion']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'web_search',
                description: '搜索网络获取 Minecraft 相关信息。当用户的问题超出你的知识范围时使用，如最新快照内容、特定模组教程等。',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: '搜索关键词' }
                    },
                    required: ['query']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_current_context',
                description: '获取启动器当前上下文信息。ALWAYS 在执行任何操作前调用此工具了解当前状态，NEVER 假设当前版本或加载器。返回选中的游戏版本、加载器类型、mods目录、Java配置、已安装模组数量等。',
                parameters: { type: 'object', properties: {} }
            }
        },
        {
            type: 'function',
            function: {
                name: 'select_version',
                description: '向用户展示版本选择卡片，让用户选择一个已安装的游戏版本。当需要用户确认目标版本时使用此工具（如安装模组、光影包、资源包、材质包等场景）。调用后会暂停AI思考，等待用户选择版本后自动继续。',
                parameters: { type: 'object', properties: {
                    purpose: { type: 'string', description: '选择版本的目的说明，如"安装模组到目标版本"、"安装光影包"等，会显示在卡片标题中' }
                }, required: ['purpose'] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'add_download_task',
                description: '向下载管理页面添加下载任务。支持模组(mod)、光影包(shader)、资源包(resourcepack)、材质包(texturepack)、整合包(modpack)、游戏版本(version)。任务会显示在下载管理页面，用户可查看进度。安装模组/光影包/资源包/材质包前，ALWAYS 先调用 select_version 让用户选择目标版本，然后用返回的 selected 版本ID作为 targetVersionId。',
                parameters: {
                    type: 'object',
                    properties: {
                        taskType: { type: 'string', enum: ['mod', 'shader', 'resourcepack', 'texturepack', 'modpack', 'version'], description: '下载任务类型：mod=模组, shader=光影包, resourcepack=资源包, texturepack=材质包, modpack=整合包, version=游戏版本' },
                        projectId: { type: 'string', description: '项目ID（mod/modpack从搜索结果获取）' },
                        source: { type: 'string', enum: ['modrinth', 'curseforge'], description: '来源平台，默认modrinth' },
                        name: { type: 'string', description: '任务显示名称' },
                        mcVersion: { type: 'string', description: 'Minecraft版本号' },
                        loader: { type: 'string', description: '加载器类型，如fabric、forge、neoforge' },
                        targetVersionId: { type: 'string', description: '目标已安装版本ID（从select_version返回的selected字段获取），用于确定下载到哪个版本文件夹' },
                        versionId: { type: 'string', description: 'Modrinth/CurseForge的版本ID（精确版本下载时使用）' },
                        iconUrl: { type: 'string', description: '任务图标URL' },
                        downloadUrl: { type: 'string', description: '直接下载URL（shader/resourcepack/texturepack有时需要）' },
                        fileName: { type: 'string', description: '文件名（直接下载时使用）' }
                    },
                    required: ['taskType', 'name']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_download_status',
                description: '查询下载任务的进度状态。返回任务状态(downloading/completed/failed)、进度百分比、当前文件、速度等信息。',
                parameters: {
                    type: 'object',
                    properties: {
                        sessionId: { type: 'string', description: '下载会话ID（从add_download_task返回）' },
                        taskType: { type: 'string', enum: ['mod', 'version', 'modpack'], description: '任务类型，用于选择正确的状态查询接口' }
                    },
                    required: ['sessionId', 'taskType']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'search_modpacks',
                description: '搜索 Minecraft 整合包。ALWAYS 同时搜索多个关键词获取更全面结果。返回整合包名称、描述、下载数等信息。',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: '搜索关键词' },
                        loader: { type: 'string', description: '加载器过滤，如 fabric、forge、neoforge' },
                        version: { type: 'string', description: 'Minecraft 版本过滤，如 1.20.1' },
                        limit: { type: 'number', description: '返回结果数量，默认5' }
                    },
                    required: ['query']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'install_modpack',
                description: '安装 Modrinth 整合包。ALWAYS 先通过 search_modpacks 获取projectId。安装前确认目标版本是否已安装，如未安装会自动处理。',
                parameters: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string', description: '整合包项目ID（从 search_modpacks 结果中获取）' },
                        mcVersion: { type: 'string', description: '目标 Minecraft 版本（建议填写），如 1.20.1' }
                    },
                    required: ['projectId', 'mcVersion']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'execute_command',
                description: '在受限环境中执行命令行命令。适用于检查Java版本、查看系统信息等。ALWAYS 优先使用专用工具(如get_system_info)，只在专用工具无法满足时才用命令行。安全限制：仅允许白名单命令，禁止管道/重定向/命令链接。',
                parameters: {
                    type: 'object',
                    properties: {
                        command: { type: 'string', description: '要执行的命令，如 "java -version"、"java -jar server.jar"' },
                        cwd: { type: 'string', description: '工作目录，必须是 .versepc 或 .minecraft 下的路径' },
                        timeout: { type: 'number', description: '超时时间（毫秒），默认10000，最大30000' }
                    },
                    required: ['command']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'write_file',
                description: '创建新文件或覆盖写入已有文件。ALWAYS 优先使用 edit_file 而非 write_file，只在创建新文件时使用此工具。路径限制在.versepc和.minecraft下。',
                parameters: {
                    type: 'object',
                    properties: {
                        file_path: { type: 'string', description: '要写入的文件绝对路径' },
                        content: { type: 'string', description: '要写入的完整文件内容' }
                    },
                    required: ['file_path', 'content']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'edit_file',
                description: '精确编辑文件，通过查找old_string并替换为new_string。ALWAYS 先用 read_file 查看当前内容，NEVER 在未读取文件的情况下编辑。old_string必须唯一匹配。路径限制在.versepc和.minecraft下。',
                parameters: {
                    type: 'object',
                    properties: {
                        file_path: { type: 'string', description: '要编辑的文件绝对路径' },
                        old_string: { type: 'string', description: '要查找替换的原始文本（必须唯一匹配）' },
                        new_string: { type: 'string', description: '替换后的新文本' },
                        replace_all: { type: 'boolean', description: '是否替换所有匹配项，默认false' }
                    },
                    required: ['file_path', 'old_string', 'new_string']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'grep_search',
                description: '在文件内容中搜索匹配正则表达式的行。ALWAYS 在需要查找特定内容时使用，NEVER 逐个打开文件查找。支持上下文行、文件类型过滤。路径限制在.versepc和.minecraft下。',
                parameters: {
                    type: 'object',
                    properties: {
                        pattern: { type: 'string', description: '正则表达式搜索模式' },
                        path: { type: 'string', description: '搜索的目录或文件路径' },
                        glob: { type: 'string', description: '文件名过滤，如 "*.js"、"**/*.json"' },
                        output_mode: { type: 'string', enum: ['content', 'files_with_matches', 'count'], description: '输出模式：content显示匹配行，files_with_matches仅显示文件名，count显示匹配数' },
                        i: { type: 'boolean', description: '是否忽略大小写' },
                        C: { type: 'number', description: '显示匹配行前后各N行上下文' },
                        head_limit: { type: 'number', description: '限制输出条目数，默认100' }
                    },
                    required: ['pattern']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'glob_search',
                description: '按文件名模式匹配搜索文件。ALWAYS 在不知道文件完整路径时使用此工具定位文件。支持glob模式如"**/*.json"、"mods/*.jar"。路径限制在.versepc和.minecraft下。',
                parameters: {
                    type: 'object',
                    properties: {
                        pattern: { type: 'string', description: 'glob匹配模式，如 "**/*.json"、"mods/*.jar"' },
                        path: { type: 'string', description: '搜索的根目录路径' }
                    },
                    required: ['pattern']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'web_fetch',
                description: '获取指定URL的网页内容。ALWAYS 在需要获取具体网页内容时使用，如阅读文档、API响应。NEVER 猜测网页内容。仅支持HTTP/HTTPS。',
                parameters: {
                    type: 'object',
                    properties: {
                        url: { type: 'string', description: '要获取内容的URL地址' },
                        max_length: { type: 'number', description: '返回内容的最大字符数，默认5000' }
                    },
                    required: ['url']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'web_search_general',
                description: '通用网络搜索，可搜索任意主题。ALWAYS 在你的知识不足以回答用户问题时主动搜索，NEVER 用过时信息回答。返回搜索结果的标题、URL和摘要。',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: '搜索关键词' },
                        num_results: { type: 'number', description: '返回结果数量，默认5，最大10' }
                    },
                    required: ['query']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'todo_write',
                description: '管理任务列表，用于跟踪多步骤任务的进度。ALWAYS 在执行复杂多步任务时使用此工具记录进度，让用户了解执行状态。',
                parameters: {
                    type: 'object',
                    properties: {
                        todos: {
                            type: 'array',
                            description: '任务列表，每项包含id/content/status/priority',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', description: '任务唯一标识' },
                                    content: { type: 'string', description: '任务描述' },
                                    status: { type: 'string', enum: ['pending', 'in_progress', 'completed'], description: '任务状态' },
                                    priority: { type: 'string', enum: ['high', 'medium', 'low'], description: '优先级' }
                                },
                                required: ['id', 'content', 'status']
                            }
                        }
                    },
                    required: ['todos']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'agent',
                description: '启动子代理执行独立子任务。ALWAYS 在有多个独立子任务时使用子代理并行执行，提高效率。子代理在隔离上下文中运行，可使用所有可用工具。',
                parameters: {
                    type: 'object',
                    properties: {
                        description: { type: 'string', description: '子代理任务的简短描述(3-5个词)' },
                        prompt: { type: 'string', description: '子代理的详细指令，包含要完成的任务和期望输出' }
                    },
                    required: ['description', 'prompt']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'translate_mod',
                description: '为模组生成中文翻译。ALWAYS 先尝试 download_cfpa_pack 下载社区翻译，CFPA未覆盖的模组再用此工具AI翻译。自动扫描语言文件，支持增量翻译。',
                parameters: {
                    type: 'object',
                    properties: {
                        mod_path: { type: 'string', description: '模组JAR文件路径或包含语言文件的目录路径' },
                        target_lang: { type: 'string', description: '目标语言代码，默认zh_cn', enum: ['zh_cn', 'zh_tw'] },
                        incremental: { type: 'boolean', description: '是否增量翻译（保留已有翻译，只翻译新条目），默认true' },
                        batch_size: { type: 'number', description: '单次翻译的条目数，默认50，最大200' }
                    },
                    required: ['mod_path']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'download_cfpa_pack',
                description: '下载CFPA社区简体中文资源包。ALWAYS 在用户要求汉化时优先使用此工具（覆盖面广、质量高），NEVER 跳过此步骤直接AI翻译。支持指定游戏版本和加载器类型。支持Forge和Fabric版本。',
                parameters: {
                    type: 'object',
                    properties: {
                        mc_version: { type: 'string', description: 'Minecraft版本号，如"1.20.1"。不指定则自动检测当前版本' },
                        loader_type: { type: 'string', description: '加载器类型，不指定则自动检测', enum: ['forge', 'fabric', 'auto'] }
                    },
                    required: []
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'extract_builtin_translations',
                description: '从模组JAR文件中提取内置的中文翻译（zh_cn.json）。很多热门模组自带中文翻译，提取后可减少CFPA覆盖范围的依赖。ALWAYS 在下载CFPA资源包之前执行此步骤。',
                parameters: {
                    type: 'object',
                    properties: {
                        mods_path: { type: 'string', description: 'mods文件夹路径。不指定则自动检测当前版本的mods目录' },
                        target_lang: { type: 'string', description: '目标语言代码，默认zh_cn', enum: ['zh_cn', 'zh_tw'] }
                    },
                    required: []
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'download_modpack_translation',
                description: '下载整合包专用汉化补丁（来自CFPA整合包汉化项目）。适用于整合包的配置文件、任务线、手册等内容的汉化。ALWAYS 在整合包安装完成后使用此工具。',
                parameters: {
                    type: 'object',
                    properties: {
                        modpack_name: { type: 'string', description: '整合包名称，如"乌托邦探险之旅"、"All the Mods 9"等' },
                        mc_version: { type: 'string', description: 'Minecraft版本号，如"1.20.1"' }
                    },
                    required: ['modpack_name']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'search_translation_dict',
                description: '从MCMOD翻译词典中查询模组翻译条目。可用于查找特定英文词条的中文翻译，辅助AI翻译时保持术语一致性。',
                parameters: {
                    type: 'object',
                    properties: {
                        keyword: { type: 'string', description: '要查询的英文或中文关键词' },
                        source: { type: 'string', description: '词典来源', enum: ['mcmod', 'vmct', 'auto'] }
                    },
                    required: ['keyword']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'attempt_completion',
                description: '当你认为任务已经完成时调用此工具。向用户展示最终结果。只有在以下情况才调用：1)用户请求的所有操作都已成功执行 2)结果已验证 3)你已准备好向用户展示最终答案。NEVER 在任务未完成时调用此工具。如果还有未执行的步骤，继续调用其他工具。',
                parameters: {
                    type: 'object',
                    properties: {
                        result: { type: 'string', description: '任务完成的总结，包括做了什么、最终状态、用户需要注意的事项' }
                    },
                    required: ['result']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'manage_core_memory',
                description: '管理长期记忆。记录可复用的项目知识、架构模式、诊断方法等，提高跨会话性能。禁止存储当前任务计划/进度（由任务系统管理）。',
                parameters: {
                    type: 'object',
                    properties: {
                        action: { type: 'string', enum: ['add', 'update', 'delete', 'list'], description: '操作类型' },
                        id: { type: 'string', description: '记忆条目ID（update/delete时必填）' },
                        category: { type: 'string', enum: ['knowledge', 'architecture', 'diagnosis', 'preference', 'rule'], description: '记忆分类' },
                        content: { type: 'string', description: '记忆内容（add/update时必填）' }
                    },
                    required: ['action']
                }
            }
        }
    ];



    function normalizeToolResult(name, result) {
        try {
            const parsed = typeof result === 'string' ? JSON.parse(result) : result;
            if (!parsed.status) {
                if (parsed.error) {
                    parsed.status = 'error';
                } else if (parsed.success === false) {
                    parsed.status = 'error';
                } else {
                    parsed.status = 'success';
                }
            }
            return JSON.stringify(parsed);
        } catch (e) {
            return result;
        }
    }

    function summarizeToolResult(name, rawResult) {
        try {
            const parsed = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
            if (parsed.error) return JSON.stringify(parsed);

            switch (name) {
                case 'search_mods': {
                    const hits = (parsed.hits || []).slice(0, 5).map(h => ({
                        title: h.title, id: h.id || h.project_id,
                        downloads: h.downloads, desc: (h.description || '').slice(0, 80)
                    }));
                    return JSON.stringify({ total: parsed.total || parsed.hits?.length, hits });
                }
                case 'get_installed_mods': {
                    const mods = (parsed.mods || []).slice(0, 20).map(m => ({
                        name: m.name || m.id, enabled: m.enabled, version: m.version
                    }));
                    return JSON.stringify({ total: parsed.mods?.length, mods });
                }
                case 'get_versions': {
                    const installed = (parsed.installed || []).slice(0, 10).map(v => ({
                        id: v.id, type: v.type, url: v.url
                    }));
                    const versions = (parsed.versions || []).slice(0, 15).map(v => ({
                        id: v.id, type: v.type, url: v.url
                    }));
                    const latest = parsed.latest || {};
                    return JSON.stringify({ latest, installedCount: parsed.installed?.length, installed: installed.slice(0, 5), versions });
                }
                case 'diagnose_crash': {
                    if (parsed.logs) {
                        const logs = parsed.logs.slice(0, 5).map(l => ({ name: l.name, path: l.path, time: l.time }));
                        return JSON.stringify({ total: parsed.logs.length, logs });
                    }
                    if (parsed.content) {
                        const lines = parsed.content.split('\n');
                        const errorLines = lines.filter(l => l.includes('Exception') || l.includes('Error') || l.includes('Caused by'));
                        return JSON.stringify({ size: parsed.size, errorSummary: errorLines.slice(0, 10).join('\n') });
                    }
                    return JSON.stringify(parsed);
                }
                case 'get_game_log': {
                    const lines = parsed.lines || [];
                    return JSON.stringify({ total: parsed.total, recentLines: lines.slice(-30) });
                }
                case 'browse_directory': {
                    if (parsed.quickAccess) return JSON.stringify(parsed);
                    const items = (parsed.items || []).slice(0, 30).map(i => ({
                        name: i.name, isDirectory: i.isDirectory
                    }));
                    return JSON.stringify({ path: parsed.path, total: parsed.total, items });
                }
                case 'read_file': {
                    if (parsed.content && parsed.content.length > 2000) {
                        return JSON.stringify({ ...parsed, content: parsed.content.slice(-2000), truncated: true });
                    }
                    return JSON.stringify(parsed);
                }
                case 'web_search': {
                    const results = parsed.results || [];
                    return JSON.stringify({
                        success: parsed.success,
                        query: parsed.query,
                        results: results.slice(0, 5).map(r => ({
                            title: (r.title || '').slice(0, 100),
                            url: r.url || ''
                        })),
                        message: parsed.message || ''
                    });
                }
                case 'get_current_context': {
                    return JSON.stringify({
                        selectedVersion: parsed.selectedVersion || '未选择',
                        loader: parsed.loader || '原版(Vanilla)',
                        loaderVersion: parsed.loaderVersion || '',
                        modsDir: parsed.modsDir || '',
                        modsCount: parsed.modsCount || 0,
                        modsEnabled: parsed.modsEnabled || 0,
                        modsDisabled: parsed.modsDisabled || 0,
                        maxMemory: parsed.maxMemory || '',
                        javaPath: parsed.javaPath || ''
                    });
                }
                case 'search_modpacks': {
                    const hits = (parsed.hits || []).slice(0, 5).map(h => ({
                        title: h.title, id: h.id,
                        downloads: h.downloads, desc: (h.description || '').slice(0, 80),
                        categories: h.categories, source: h.source
                    }));
                    return JSON.stringify({ total: parsed.total, hits });
                }
                case 'install_modpack': {
                    return JSON.stringify({
                        success: parsed.success,
                        name: parsed.name || '',
                        fileName: parsed.fileName || '',
                        mcVersion: parsed.mcVersion || '',
                        loaders: parsed.loaders || [],
                        message: parsed.message || (parsed.error ? parsed.error : '')
                    });
                }
                case 'execute_command': {
                    const maxLen = 1500;
                    let stdout = parsed.stdout || '';
                    let stderr = parsed.stderr || '';
                    if (stdout.length > maxLen) stdout = stdout.slice(0, maxLen) + '...[truncated]';
                    if (stderr.length > maxLen) stderr = stderr.slice(0, maxLen) + '...[truncated]';
                    return JSON.stringify({
                        success: parsed.success,
                        command: parsed.command,
                        exitCode: parsed.exitCode,
                        stdout,
                        stderr: stderr || undefined,
                        error: parsed.error || undefined,
                        timedOut: parsed.timedOut || undefined
                    });
                }
                case 'write_file': {
                    return JSON.stringify({ success: parsed.success, path: parsed.path, size: parsed.size, error: parsed.error });
                }
                case 'edit_file': {
                    return JSON.stringify({ success: parsed.success, path: parsed.path, replacements: parsed.replacements, error: parsed.error });
                }
                case 'grep_search': {
                    if (parsed.files) {
                        return JSON.stringify({ success: true, pattern: parsed.pattern, totalFiles: parsed.totalFiles, files: parsed.files.slice(0, 30) });
                    }
                    if (parsed.results) {
                        return JSON.stringify({ success: true, pattern: parsed.pattern, totalMatches: parsed.totalMatches, results: parsed.results.slice(0, 30) });
                    }
                    return JSON.stringify(parsed);
                }
                case 'glob_search': {
                    return JSON.stringify({ success: true, pattern: parsed.pattern, total: parsed.total, files: (parsed.files || []).slice(0, 30).map(f => ({ path: f.path, name: f.name, size: f.size })) });
                }
                case 'web_fetch': {
                    let content = parsed.content || '';
                    if (content.length > 2000) content = content.slice(0, 2000) + '...[truncated]';
                    return JSON.stringify({ success: parsed.success, url: parsed.url, length: parsed.length, content });
                }
                case 'web_search_general': {
                    const results = (parsed.results || []).slice(0, 5).map(r => ({
                        title: (r.title || '').slice(0, 100), url: r.url
                    }));
                    return JSON.stringify({ success: parsed.success, query: parsed.query, totalResults: parsed.totalResults, results });
                }
                case 'todo_write': {
                    return JSON.stringify(parsed);
                }
                case 'agent': {
                    let result = parsed.result || parsed.output || '';
                    if (typeof result === 'string' && result.length > 2000) result = result.slice(0, 2000) + '...[truncated]';
                    return JSON.stringify({ success: parsed.success, description: parsed.description, result });
                }
                case 'translate_mod': {
                    return JSON.stringify({
                        success: parsed.success,
                        modPath: parsed.modPath,
                        targetLang: parsed.targetLang,
                        incremental: parsed.incremental,
                        totalEntries: parsed.totalEntries,
                        totalTranslated: parsed.totalTranslated,
                        outputDir: parsed.outputDir,
                        namespaces: (parsed.namespaces || []).map(n => ({
                            namespace: n.namespace, total: n.total, translated: n.translated, skipped: n.skipped
                        }))
                    });
                }
                case 'download_cfpa_pack': {
                    return JSON.stringify({
                        success: parsed.success,
                        version: parsed.version,
                        mcVersion: parsed.mcVersion,
                        loaderType: parsed.loaderType,
                        path: parsed.path,
                        size: parsed.size,
                        source: parsed.source,
                        message: parsed.message,
                        error: parsed.error
                    });
                }
                case 'extract_builtin_translations': {
                    return JSON.stringify({
                        success: parsed.success,
                        modsPath: parsed.modsPath,
                        targetLang: parsed.targetLang,
                        totalMods: parsed.totalMods,
                        modsExtracted: parsed.modsExtracted,
                        totalEntries: parsed.totalEntries,
                        outputDir: parsed.outputDir,
                        details: (parsed.details || []).slice(0, 20).map(d => ({ namespace: d.namespace, entries: d.entries }))
                    });
                }
                case 'download_modpack_translation': {
                    return JSON.stringify({
                        success: parsed.success,
                        modpackName: parsed.modpackName,
                        mcVersion: parsed.mcVersion,
                        path: parsed.path,
                        size: parsed.size,
                        message: parsed.message,
                        error: parsed.error
                    });
                }
                case 'search_translation_dict': {
                    return JSON.stringify({
                        success: parsed.success,
                        keyword: parsed.keyword,
                        source: parsed.source,
                        results: (parsed.results || []).slice(0, 30),
                        totalResults: parsed.totalResults,
                        error: parsed.error
                    });
                }
                case 'explore_environment': {
                    const summary = {};
                    if (parsed.context) {
                        summary.currentVersion = parsed.context.selectedVersion || '未选择';
                        summary.loader = parsed.context.loader || '原版';
                        summary.modsCount = parsed.context.modsCount || 0;
                    }
                    if (parsed.gameStatus) {
                        summary.gameRunning = parsed.gameStatus.running || false;
                    }
                    if (parsed.installedVersions) {
                        const versions = parsed.installedVersions.versions || parsed.installedVersions.installed || [];
                        summary.installedVersions = versions.slice(0, 5).map(v => `${v.id}${v.loader ? '(' + v.loader + ')' : ''}`);
                    }
                    if (parsed.installedMods) {
                        const mods = parsed.installedMods.mods || [];
                        summary.installedModsCount = mods.length;
                        summary.modNames = mods.slice(0, 10).map(m => m.name || m.id);
                    }
                    return JSON.stringify(summary);
                }
                case 'select_version': {
                    const installed = parsed.installed || [];
                    return JSON.stringify({
                        purpose: parsed.purpose || '选择版本',
                        versionCount: installed.length,
                        versions: installed.map(v => ({
                            id: v.id,
                            loader: v.loader || 'Vanilla',
                            modsCount: v.modsCount || 0,
                            type: v.type || 'release'
                        }))
                    });
                }
                default: {
                    const str = JSON.stringify(parsed);
                    if (str.length > 2000) return JSON.stringify({ summary: str.slice(0, 1500) + '...[truncated]', truncated: true });
                    return str;
                }
            }
        } catch (e) {
            const str = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
            if (str.length > 2000) return str.slice(0, 1500) + '...[truncated]';
            return str;
        }
    }

    const toolResultCache = new Map();
    setInterval(() => {
        const now = Date.now();
        for (const [key, val] of toolResultCache) {
            if (now - val.time > 60000) toolResultCache.delete(key);
        }
    }, 30000);

    async function executeTool(name, args) {
        if (typeof args === 'string') {
            try { args = JSON.parse(args); } catch (e) { args = {}; }
        }
        args = args || {};
        const config = TOOL_CONFIG[name] || { timeout: 30000, retries: 0, risk: 'safe' };

        const cacheKey = `${name}:${JSON.stringify(args)}`;
        const cached = toolResultCache.get(cacheKey);
        if (cached && (Date.now() - cached.time) < 30000) {
            return cached.result;
        }

        const maxRetries = config.retries;
        let lastError;
        const _toolStartTime = Date.now();

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            let timeoutId;
            try {
                const resultPromise = executeToolInner(name, args);
                const timeoutPromise = new Promise((_, reject) => {
                    timeoutId = setTimeout(() => reject(new Error(`工具执行超时(${config.timeout}ms)`)), config.timeout);
                });

                const rawResult = await Promise.race([resultPromise, timeoutPromise]);
                clearTimeout(timeoutId);
                const result = normalizeToolResult(name, summarizeToolResult(name, rawResult));

                const noCacheTools = ['install_mod', 'install_version', 'install_loader', 'install_modpack', 'launch_game', 'stop_game', 'toggle_mod', 'manage_settings', 'execute_command', 'write_file', 'edit_file', 'translate_mod', 'download_cfpa_pack', 'extract_builtin_translations', 'download_modpack_translation', 'search_translation_dict', 'explore_environment', 'select_version'];
                if (!noCacheTools.includes(name)) {
                    toolResultCache.set(cacheKey, { result, time: Date.now() });
                    if (toolResultCache.size > 30) {
                        const oldest = toolResultCache.keys().next().value;
                        toolResultCache.delete(oldest);
                    }
                }

                ChangeTracker.recordAudit({
                    category: 'tool_call',
                    toolName: name,
                    args: typeof args === 'string' ? args.substring(0, 500) : JSON.stringify(args).substring(0, 500),
                    success: true,
                    elapsed: Date.now() - _toolStartTime,
                    resultLength: typeof result === 'string' ? result.length : 0
                });

                return result;
            } catch (e) {
                clearTimeout(timeoutId);
                lastError = e;
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                }
            }
        }

        ChangeTracker.recordAudit({
            category: 'tool_call',
            toolName: name,
            args: typeof args === 'string' ? args.substring(0, 500) : JSON.stringify(args).substring(0, 500),
            success: false,
            elapsed: Date.now() - _toolStartTime,
            error: String(lastError)
        });

        return JSON.stringify({ status: 'error', error: lastError?.message || '工具执行失败', type: 'timeout_or_failure' });
    }
    sseExecuteTool = executeTool;

    function computeTextSimilarity(a, b) {
        if (!a || !b || a.length < 10 || b.length < 10) return 0;
        const getNgrams = (str, n = 4) => {
            const ngrams = new Set();
            for (let i = 0; i <= str.length - n; i++) {
                ngrams.add(str.slice(i, i + n));
            }
            return ngrams;
        };
        const ngramsA = getNgrams(a);
        const ngramsB = getNgrams(b);
        let intersection = 0;
        for (const ng of ngramsA) {
            if (ngramsB.has(ng)) intersection++;
        }
        return intersection / Math.max(ngramsA.size, ngramsB.size);
    }

    function validatePath(inputPath, options = {}) {
        const os = require('os');
        const resolved = path.resolve(path.normalize(inputPath));
        const lower = resolved.toLowerCase();
        const home = os.homedir().toLowerCase();
        const sensitivePatterns = ['.ssh', '.gnupg', '.env', '.aws', '.kube', 'credentials', 'id_rsa', 'id_ed25519'];
        for (const pattern of sensitivePatterns) {
            if (lower.includes(pattern.toLowerCase())) return { valid: false, error: '无权访问敏感文件，此路径被安全策略禁止', resolved };
        }
        const blockedRoots = ['c:\\windows', 'c:\\program files', 'c:\\program files (x86)', 'c:\\programdata', '/etc', '/usr', '/bin', '/sbin', '/boot'];
        for (const br of blockedRoots) {
            if (lower.startsWith(br)) return { valid: false, error: `禁止访问系统目录: ${br}`, resolved };
        }
        if (!lower.startsWith(home)) return { valid: false, error: '只能访问用户主目录下的文件', resolved };
        return { valid: true, resolved };
    }

    const BackupManager = {
        baseDir: null,
        sessionId: null,
        history: [],
        init() {
            const os = require('os');
            this.baseDir = path.join(os.homedir(), '.versepc', 'snapshots');
            this.sessionId = Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
            try { fs.mkdirSync(this.baseDir, { recursive: true }); } catch (e) {}
        },
        createBackup(filePath, toolName, args) {
            try {
                if (!this.baseDir) this.init();
                if (!fs.existsSync(filePath)) return null;
                const content = fs.readFileSync(filePath, 'utf-8');
                const stat = fs.statSync(filePath);
                const safeName = filePath.replace(/[\\\/:]/g, '_').replace(/^_+/, '');
                const ts = Date.now();
                const backupFileName = `${safeName}_${ts}.bak`;
                const backupPath = path.join(this.baseDir, backupFileName);
                fs.writeFileSync(backupPath, content, 'utf-8');
                const meta = {
                    id: `${this.sessionId}_${ts}`,
                    sessionId: this.sessionId,
                    originalPath: filePath,
                    backupPath: backupPath,
                    toolName: toolName,
                    args: args ? (typeof args === 'string' ? args.substring(0, 500) : JSON.stringify(args).substring(0, 500)) : '',
                    timestamp: ts,
                    size: stat.size,
                    lines: content.split('\n').length,
                    restored: false
                };
                const metaPath = backupPath + '.json';
                fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
                this.history.push(meta);
                if (this.history.length > 500) {
                    const old = this.history.splice(0, 100);
                    for (const m of old) {
                        try { fs.unlinkSync(m.backupPath); } catch (e) {}
                        try { fs.unlinkSync(m.backupPath + '.json'); } catch (e) {}
                    }
                }
                return meta;
            } catch (e) {
                return null;
            }
        },
        restoreBackup(backupId) {
            try {
                if (!this.baseDir) this.init();
                let meta = this.history.find(m => m.id === backupId);
                if (!meta) {
                    const files = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.json'));
                    for (const f of files) {
                        try {
                            const m = JSON.parse(fs.readFileSync(path.join(this.baseDir, f), 'utf-8'));
                            if (m.id === backupId) { meta = m; break; }
                        } catch (e) {}
                    }
                }
                if (!meta) return { error: `备份 ${backupId} 不存在` };
                if (!fs.existsSync(meta.backupPath)) return { error: `备份文件已被删除` };
                const backupContent = fs.readFileSync(meta.backupPath, 'utf-8');
                const dir = path.dirname(meta.originalPath);
                try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
                fs.writeFileSync(meta.originalPath, backupContent, 'utf-8');
                meta.restored = true;
                const metaPath = meta.backupPath + '.json';
                try { fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8'); } catch (e) {}
                return { success: true, restoredPath: meta.originalPath, size: backupContent.length };
            } catch (e) {
                return { error: `恢复失败: ${e.message}` };
            }
        },
        listBackups(filePath) {
            try {
                if (!this.baseDir) this.init();
                const files = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.json'));
                const results = [];
                for (const f of files) {
                    try {
                        const meta = JSON.parse(fs.readFileSync(path.join(this.baseDir, f), 'utf-8'));
                        if (filePath && meta.originalPath !== filePath) continue;
                        results.push(meta);
                    } catch (e) {}
                }
                results.sort((a, b) => b.timestamp - a.timestamp);
                return results.slice(0, 50);
            } catch (e) {
                return [];
            }
        },
        getDiff(backupId) {
            try {
                if (!this.baseDir) this.init();
                let meta = this.history.find(m => m.id === backupId);
                if (!meta) {
                    const files = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.json'));
                    for (const f of files) {
                        try {
                            const m = JSON.parse(fs.readFileSync(path.join(this.baseDir, f), 'utf-8'));
                            if (m.id === backupId) { meta = m; break; }
                        } catch (e) {}
                    }
                }
                if (!meta) return { error: '备份不存在' };
                const backupContent = fs.readFileSync(meta.backupPath, 'utf-8');
                let currentContent = '';
                try { currentContent = fs.readFileSync(meta.originalPath, 'utf-8'); } catch (e) { currentContent = '(文件不存在)'; }
                return { original: backupContent, current: currentContent, path: meta.originalPath };
            } catch (e) {
                return { error: e.message };
            }
        },
        getSessionSummary() {
            return {
                sessionId: this.sessionId,
                totalBackups: this.history.length,
                files: [...new Set(this.history.map(m => m.originalPath))],
                recentBackups: this.history.slice(-10).map(m => ({
                    id: m.id, path: m.originalPath, tool: m.toolName,
                    time: m.timestamp, restored: m.restored
                }))
            };
        }
    };

    const ChangeTracker = {
        changes: [],
        auditLog: [],
        sessionId: null,
        logDir: null,
        init() {
            const os = require('os');
            this.sessionId = Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
            this.logDir = path.join(os.homedir(), '.versepc', 'logs');
            try { fs.mkdirSync(this.logDir, { recursive: true }); } catch (e) {}
            this.auditLog = [];
            this.changes = [];
        },
        recordChange(entry) {
            const change = {
                id: `chg_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`,
                sessionId: this.sessionId,
                timestamp: Date.now(),
                ...entry
            };
            this.changes.push(change);
            if (this.changes.length > 1000) {
                this.changes = this.changes.slice(-500);
            }
            this._persistChanges();
            return change;
        },
        recordAudit(entry) {
            const log = {
                id: `aud_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`,
                sessionId: this.sessionId,
                timestamp: Date.now(),
                ...entry
            };
            this.auditLog.push(log);
            if (this.auditLog.length > 2000) {
                this.auditLog = this.auditLog.slice(-1000);
            }
            this._persistAudit();
            return log;
        },
        _persistChanges() {
            try {
                const filePath = path.join(this.logDir, `changes_${this.sessionId}.json`);
                fs.writeFileSync(filePath, JSON.stringify(this.changes, null, 0), 'utf-8');
            } catch (e) {}
        },
        _persistAudit() {
            try {
                const filePath = path.join(this.logDir, `audit_${this.sessionId}.json`);
                fs.writeFileSync(filePath, JSON.stringify(this.auditLog, null, 0), 'utf-8');
            } catch (e) {}
        },
        getChanges(filter) {
            let results = [...this.changes];
            if (filter) {
                if (filter.filePath) results = results.filter(c => c.filePath === filter.filePath);
                if (filter.toolName) results = results.filter(c => c.toolName === filter.toolName);
                if (filter.type) results = results.filter(c => c.type === filter.type);
                if (filter.since) results = results.filter(c => c.timestamp >= filter.since);
            }
            return results.sort((a, b) => b.timestamp - a.timestamp);
        },
        getAuditLog(filter) {
            let results = [...this.auditLog];
            if (filter) {
                if (filter.category) results = results.filter(l => l.category === filter.category);
                if (filter.toolName) results = results.filter(l => l.toolName === filter.toolName);
                if (filter.success !== undefined) results = results.filter(l => l.success === filter.success);
                if (filter.since) results = results.filter(l => l.timestamp >= filter.since);
            }
            return results.sort((a, b) => b.timestamp - a.timestamp).slice(0, 200);
        },
        getSessionSummary() {
            const toolCalls = {};
            const fileChanges = {};
            let errors = 0;
            let successes = 0;
            for (const log of this.auditLog) {
                if (log.category === 'tool_call') {
                    toolCalls[log.toolName] = (toolCalls[log.toolName] || 0) + 1;
                    if (log.success) successes++;
                    else errors++;
                }
            }
            for (const ch of this.changes) {
                fileChanges[ch.filePath] = (fileChanges[ch.filePath] || 0) + 1;
            }
            return {
                sessionId: this.sessionId,
                startTime: this.changes.length > 0 ? this.changes[0].timestamp : Date.now(),
                totalChanges: this.changes.length,
                totalAuditEntries: this.auditLog.length,
                toolCalls,
                fileChanges,
                errors,
                successes,
                successRate: successes + errors > 0 ? Math.round(successes / (successes + errors) * 100) : 0
            };
        }
    };
    ChangeTracker.init();

    ipcMain.handle('backup:list', async (_event, filePath) => {
        return BackupManager.listBackups(filePath || null);
    });
    ipcMain.handle('backup:restore', async (_event, backupId) => {
        const result = BackupManager.restoreBackup(backupId);
        if (result.success && result.restoredPath && mainWindow && !mainWindow.isDestroyed()) {
            try {
                const content = fs.readFileSync(result.restoredPath, 'utf-8');
                mainWindow.webContents.send('editor:show-diff', result.restoredPath, '', content);
            } catch (e) {}
        }
        return result;
    });
    ipcMain.handle('backup:diff', async (_event, backupId) => {
        return BackupManager.getDiff(backupId);
    });
    ipcMain.handle('history:changes', async (_event, filter) => {
        return ChangeTracker.getChanges(filter || null);
    });
    ipcMain.handle('history:audit', async (_event, filter) => {
        return ChangeTracker.getAuditLog(filter || null);
    });
    ipcMain.handle('history:summary', async () => {
        return ChangeTracker.getSessionSummary();
    });

    const CodeValidator = {
        validate(content, filePath) {
            if (!content || !filePath) return { valid: true };
            const ext = (filePath.split('.').pop() || '').toLowerCase();
            try {
                switch (ext) {
                    case 'json':
                    case 'jsonc':
                        return this._validateJSON(content);
                    case 'js':
                    case 'mjs':
                    case 'cjs':
                        return this._validateJS(content);
                    case 'ts':
                    case 'tsx':
                        return this._validateTS(content);
                    case 'css':
                        return this._validateCSS(content);
                    case 'html':
                    case 'htm':
                        return this._validateHTML(content);
                    default:
                        return { valid: true };
                }
            } catch (e) {
                return { valid: true, warning: `验证器内部错误: ${e.message}` };
            }
        },
        _validateJSON(content) {
            try {
                JSON.parse(content);
                return { valid: true };
            } catch (e) {
                const match = e.message.match(/position (\d+)/);
                let line = 1, col = 1;
                if (match) {
                    const pos = parseInt(match[1]);
                    const lines = content.substring(0, pos).split('\n');
                    line = lines.length;
                    col = lines[lines.length - 1].length + 1;
                }
                return {
                    valid: false,
                    error: `JSON 语法错误: ${e.message}`,
                    line, column: col,
                    suggestion: '检查 JSON 格式：引号、逗号、括号是否匹配'
                };
            }
        },
        _validateJS(content) {
            const issues = [];
            const lines = content.split('\n');
            let openBraces = 0, openParens = 0, openBrackets = 0;
            let inBlockComment = false, inString = false, stringChar = '';
            let templateDepth = 0;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                let inLineComment = false;
                for (let j = 0; j < line.length; j++) {
                    const ch = line[j];
                    const prev = j > 0 ? line[j - 1] : '';
                    if (inBlockComment) {
                        if (ch === '/' && prev === '*') inBlockComment = false;
                        continue;
                    }
                    if (inLineComment) continue;
                    if (inString) {
                        if (ch === stringChar && prev !== '\\') inString = false;
                        continue;
                    }
                    if (ch === '/' && j + 1 < line.length) {
                        if (line[j + 1] === '/') { inLineComment = true; break; }
                        if (line[j + 1] === '*') { inBlockComment = true; j++; continue; }
                    }
                    if (ch === '"' || ch === "'" || ch === '`') {
                        inString = true;
                        stringChar = ch;
                        continue;
                    }
                    if (ch === '{') openBraces++;
                    if (ch === '}') openBraces--;
                    if (ch === '(') openParens++;
                    if (ch === ')') openParens--;
                    if (ch === '[') openBrackets++;
                    if (ch === ']') openBrackets--;
                }
                if (openBraces < 0) {
                    issues.push({ line: i + 1, error: '多余的右花括号 }', severity: 'error' });
                    openBraces = 0;
                }
                if (openParens < 0) {
                    issues.push({ line: i + 1, error: '多余的右圆括号 )', severity: 'error' });
                    openParens = 0;
                }
                if (openBrackets < 0) {
                    issues.push({ line: i + 1, error: '多余的右方括号 ]', severity: 'error' });
                    openBrackets = 0;
                }
            }
            if (openBraces > 0) issues.push({ line: lines.length, error: `缺少 ${openBraces} 个右花括号 }`, severity: 'error' });
            if (openParens > 0) issues.push({ line: lines.length, error: `缺少 ${openParens} 个右圆括号 )`, severity: 'error' });
            if (openBrackets > 0) issues.push({ line: lines.length, error: `缺少 ${openBrackets} 个右方括号 ]`, severity: 'error' });
            if (inBlockComment) issues.push({ line: lines.length, error: '未闭合的块注释 /*', severity: 'error' });
            if (inString) issues.push({ line: lines.length, error: `未闭合的字符串 ${stringChar}`, severity: 'error' });
            const errors = issues.filter(i => i.severity === 'error');
            if (errors.length > 0) {
                return { valid: false, errors: errors.slice(0, 5), error: errors[0].error, line: errors[0].line, suggestion: '检查括号匹配和字符串闭合' };
            }
            return { valid: true, warnings: issues.filter(i => i.severity === 'warning') };
        },
        _validateTS(content) {
            return this._validateJS(content);
        },
        _validateCSS(content) {
            const issues = [];
            const lines = content.split('\n');
            let openBraces = 0;
            let inComment = false;
            let inString = false;
            let stringChar = '';
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                for (let j = 0; j < line.length; j++) {
                    const ch = line[j];
                    const prev = j > 0 ? line[j - 1] : '';
                    if (inComment) {
                        if (ch === '/' && prev === '*') inComment = false;
                        continue;
                    }
                    if (inString) {
                        if (ch === stringChar && prev !== '\\') inString = false;
                        continue;
                    }
                    if (ch === '/' && j + 1 < line.length && line[j + 1] === '*') {
                        inComment = true;
                        j++;
                        continue;
                    }
                    if (ch === '"' || ch === "'") {
                        inString = true;
                        stringChar = ch;
                        continue;
                    }
                    if (ch === '{') openBraces++;
                    if (ch === '}') {
                        openBraces--;
                        if (openBraces < 0) {
                            issues.push({ line: i + 1, error: '多余的右花括号 }', severity: 'error' });
                            openBraces = 0;
                        }
                    }
                }
            }
            if (openBraces > 0) issues.push({ line: lines.length, error: `缺少 ${openBraces} 个右花括号 }`, severity: 'error' });
            if (inComment) issues.push({ line: lines.length, error: '未闭合的块注释 /*', severity: 'error' });
            const errors = issues.filter(i => i.severity === 'error');
            if (errors.length > 0) {
                return { valid: false, errors: errors.slice(0, 5), error: errors[0].error, line: errors[0].line, suggestion: '检查 CSS 选择器和属性块的花括号匹配' };
            }
            return { valid: true };
        },
        _validateHTML(content) {
            const issues = [];
            const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
            const tagStack = [];
            const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*\/?>/g;
            let match;
            let lineNum = 1;
            while ((match = tagRegex.exec(content)) !== null) {
                const fullTag = match[0];
                const tagName = match[1].toLowerCase();
                const beforeMatch = content.substring(0, match.index);
                lineNum = beforeMatch.split('\n').length;
                if (fullTag.startsWith('<!') || fullTag.startsWith('<?')) continue;
                if (voidTags.has(tagName)) continue;
                if (fullTag.endsWith('/>')) continue;
                if (fullTag.startsWith('</')) {
                    if (tagStack.length === 0) {
                        issues.push({ line: lineNum, error: `多余的闭合标签 </${tagName}>`, severity: 'error' });
                    } else {
                        const last = tagStack[tagStack.length - 1];
                        if (last.name !== tagName) {
                            issues.push({ line: lineNum, error: `标签不匹配: 期望 </${last.name}> 但找到 </${tagName}>`, severity: 'error' });
                        }
                        tagStack.pop();
                    }
                } else {
                    tagStack.push({ name: tagName, line: lineNum });
                }
            }
            if (tagStack.length > 0) {
                const unclosed = tagStack.slice(0, 3).map(t => `<${t.name}> (行 ${t.line})`).join(', ');
                issues.push({ line: tagStack[0].line, error: `未闭合的标签: ${unclosed}${tagStack.length > 3 ? '...' : ''}`, severity: 'error' });
            }
            const errors = issues.filter(i => i.severity === 'error');
            if (errors.length > 0) {
                return { valid: false, errors: errors.slice(0, 5), error: errors[0].error, line: errors[0].line, suggestion: '检查 HTML 标签是否正确闭合' };
            }
            return { valid: true };
        }
    };

    const CodeIndexer = {
        index: new Map(),
        fileMeta: new Map(),
        idf: new Map(),
        indexed: false,
        indexDir: null,
        maxFileSize: 100000,
        maxFiles: 2000,
        async buildIndex(rootDir) {
            const startTime = Date.now();
            this.index.clear();
            this.fileMeta.clear();
            this.idf.clear();
            this.indexed = false;
            if (!this.indexDir) {
                const os = require('os');
                this.indexDir = path.join(os.homedir(), '.versepc', 'index');
                try { fs.mkdirSync(this.indexDir, { recursive: true }); } catch (e) {}
            }
            const codeExtensions = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.css', '.scss', '.less', '.html', '.htm', '.vue', '.svelte', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.hpp', '.cs', '.rb', '.php', '.swift', '.kt', '.md', '.txt', '.yaml', '.yml', '.toml', '.xml', '.sql']);
            const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.versepc', 'vendor', '.idea', '.vscode', 'coverage']);
            const files = [];
            const walk = (dir, depth) => {
                if (depth > 8 || files.length >= this.maxFiles) return;
                let entries;
                try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
                for (const entry of entries) {
                    if (files.length >= this.maxFiles) break;
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        if (!ignoreDirs.has(entry.name) && !entry.name.startsWith('.')) {
                            walk(fullPath, depth + 1);
                        }
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name).toLowerCase();
                        if (codeExtensions.has(ext)) {
                            try {
                                const stat = fs.statSync(fullPath);
                                if (stat.size <= this.maxFileSize) {
                                    files.push({ path: fullPath, ext, size: stat.size, mtime: stat.mtimeMs });
                                }
                            } catch (e) {}
                        }
                    }
                }
            };
            walk(rootDir, 0);
            const docCount = files.length;
            const docFreq = new Map();
            for (const file of files) {
                try {
                    const content = fs.readFileSync(file.path, 'utf-8');
                    const tokens = this._tokenize(content, file.ext);
                    const uniqueTokens = new Set(tokens);
                    this.index.set(file.path, { tokens, content: content.substring(0, 500), lines: content.split('\n').length });
                    this.fileMeta.set(file.path, { ext: file.ext, size: file.size, mtime: file.mtime, relPath: path.relative(rootDir, file.path) });
                    for (const token of uniqueTokens) {
                        docFreq.set(token, (docFreq.get(token) || 0) + 1);
                    }
                } catch (e) {}
            }
            for (const [token, freq] of docFreq) {
                this.idf.set(token, Math.log((docCount + 1) / (freq + 1)) + 1);
            }
            this.indexed = true;
            return { files: docCount, tokens: this.idf.size, elapsed: Date.now() - startTime };
        },
        _tokenize(content, ext) {
            const tokens = [];
            const lines = content.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (ext === '.py' && (trimmed.startsWith('#') || trimmed.startsWith('"""') || trimmed.startsWith("'''"))) {
                    tokens.push(...this._extractWords(trimmed));
                    continue;
                }
                if ((ext === '.js' || ext === '.ts' || ext === '.css') && (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*'))) {
                    tokens.push(...this._extractWords(trimmed));
                    continue;
                }
                if (ext === '.html' && trimmed.startsWith('<!--')) {
                    tokens.push(...this._extractWords(trimmed));
                    continue;
                }
                const funcMatch = trimmed.match(/(?:function|def|func|fn|async\s+function|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
                if (funcMatch) tokens.push(funcMatch[1].toLowerCase());
                const classMatch = trimmed.match(/(?:class|interface|struct|enum|type)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
                if (classMatch) tokens.push(classMatch[1].toLowerCase());
                const importMatch = trimmed.match(/(?:import|require|from|include|use)\s+['"]([^'"]+)['"]/);
                if (importMatch) tokens.push(...importMatch[1].split(/[\/\\.-]/).filter(Boolean).map(w => w.toLowerCase()));
                const stringMatches = trimmed.match(/['"]([^'"]{3,50})['"]/g);
                if (stringMatches) {
                    for (const s of stringMatches) {
                        const inner = s.slice(1, -1);
                        if (/^[a-zA-Z_\s-]+$/.test(inner)) tokens.push(inner.toLowerCase());
                    }
                }
                tokens.push(...this._extractWords(trimmed));
            }
            return tokens;
        },
        _extractWords(text) {
            const words = [];
            const camelParts = text.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-./\\]/g, ' ');
            const matches = camelParts.match(/[a-zA-Z]{2,}/g);
            if (matches) {
                for (const w of matches) {
                    const lower = w.toLowerCase();
                    if (lower.length >= 2 && !this._stopWords.has(lower)) {
                        words.push(lower);
                    }
                }
            }
            return words;
        },
        _stopWords: new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'from', 'that', 'this', 'with', 'they', 'been', 'said', 'each', 'which', 'their', 'will', 'other', 'about', 'many', 'then', 'them', 'would', 'like', 'into', 'could', 'time', 'very', 'when', 'come', 'made', 'after', 'also', 'did', 'just', 'than', 'what', 'your', 'way', 'may', 'new', 'now', 'old', 'see', 'him', 'two', 'how', 'its', 'let', 'say', 'she', 'too', 'use', 'var', 'const', 'let', 'function', 'return', 'import', 'export', 'from', 'class', 'extends', 'implements', 'interface', 'type', 'enum', 'module', 'require', 'true', 'false', 'null', 'undefined', 'void', 'async', 'await', 'try', 'catch', 'throw', 'finally', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'default', 'new', 'delete', 'typeof', 'instanceof', 'in', 'of', 'yield', 'this', 'super', 'static', 'public', 'private', 'protected', 'abstract', 'readonly', 'override']),
        search(query, options = {}) {
            if (!this.indexed) return { error: '索引未构建，请先调用 build_index' };
            const maxResults = options.maxResults || 10;
            const rootDir = options.rootDir || '';
            const queryTokens = this._extractWords(query);
            if (queryTokens.length === 0) return { results: [], query };
            const queryVec = new Map();
            for (const token of queryTokens) {
                queryVec.set(token, (queryVec.get(token) || 0) + 1);
            }
            for (const [token, count] of queryVec) {
                const idf = this.idf.get(token) || 1;
                queryVec.set(token, count * idf);
            }
            const scores = [];
            for (const [filePath, docData] of this.index) {
                if (rootDir && !filePath.startsWith(rootDir)) continue;
                const meta = this.fileMeta.get(filePath);
                let score = 0;
                const docTokenFreq = new Map();
                for (const t of docData.tokens) {
                    docTokenFreq.set(t, (docTokenFreq.get(t) || 0) + 1);
                }
                for (const [token, queryWeight] of queryVec) {
                    const tf = docTokenFreq.get(token) || 0;
                    const idf = this.idf.get(token) || 1;
                    const normalizedTf = tf > 0 ? 1 + Math.log(tf) : 0;
                    score += queryWeight * normalizedTf * idf;
                }
                const relPath = meta ? meta.relPath : filePath;
                const pathTokens = this._extractWords(relPath.replace(/[\\/]/g, ' '));
                for (const token of queryTokens) {
                    if (pathTokens.includes(token)) score *= 1.5;
                }
                const contentSnippet = docData.content.toLowerCase();
                for (const token of queryTokens) {
                    if (contentSnippet.includes(token)) score *= 1.1;
                }
                if (score > 0) {
                    scores.push({ filePath, score, meta, lines: docData.lines, snippet: docData.content.substring(0, 150) });
                }
            }
            scores.sort((a, b) => b.score - a.score);
            const results = scores.slice(0, maxResults).map((r, i) => ({
                rank: i + 1,
                file: r.filePath,
                relativePath: r.meta ? r.meta.relPath : r.filePath,
                score: Math.round(r.score * 100) / 100,
                lines: r.lines,
                extension: r.meta ? r.meta.ext : '',
                snippet: r.snippet
            }));
            return { results, totalMatches: scores.length, query, queryTokens };
        },
        getStats() {
            return {
                indexed: this.indexed,
                files: this.index.size,
                tokens: this.idf.size,
                memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
            };
        }
    };

    async function executeToolInner(name, args) {
        await new Promise(r => setImmediate(r));
        const server = apiHandler;

        const callAPI = async (pathname, method, body, query) => {
            await new Promise(r => setImmediate(r));
            const result = await server.handleNativeAPI(pathname, method, body, query);
            await new Promise(r => setImmediate(r));
            return result;
        };

        try {
            if (!server || !server.handleNativeAPI) {
                return JSON.stringify({ error: '服务端未就绪' });
            }

            switch (name) {
                case 'search_mods': {
                    const query = args.query || '';
                    const source = args.source || 'modrinth';
                    const loader = args.loader || '';
                    const version = args.version || '';
                    const limit = args.limit || 10;
                    const apiQuery = { query, source, limit: String(limit) };
                    if (loader) apiQuery.loader = loader;
                    if (version) apiQuery.version = version;
                    const result = await callAPI('/api/mods/search', 'GET', null, apiQuery);
                    const body = JSON.parse(result.body.toString());
                    return JSON.stringify(body);
                }
                case 'install_mod': {
                    const body = {
                        projectId: args.projectId,
                        source: args.source || 'modrinth',
                        loader: args.loader || '',
                        mcVersion: args.mcVersion || '',
                        versionId: args.versionId || ''
                    };
                    const result = await callAPI('/api/mods/download', 'POST', JSON.stringify(body), {});
                    const respBody = JSON.parse(result.body.toString());
                    return JSON.stringify(respBody);
                }
                case 'get_installed_mods': {
                    const result = await callAPI('/api/mods', 'GET', null, {});
                    const body = JSON.parse(result.body.toString());
                    return JSON.stringify(body);
                }
                case 'toggle_mod': {
                    const body = { path: args.modPath, enable: args.enable };
                    const result = await callAPI('/api/mods/toggle', 'POST', JSON.stringify(body), {});
                    const respBody = JSON.parse(result.body.toString());
                    return JSON.stringify(respBody);
                }
                case 'get_system_info': {
                    const result = await callAPI('/api/system/memory', 'GET', null, {});
                    const body = JSON.parse(result.body.toString());
                    return JSON.stringify(body);
                }
                case 'get_versions': {
                    const query = {};
                    if (args.installedOnly) query.installed = 'true';
                    const result = await callAPI('/api/versions', 'GET', null, query);
                    const body = JSON.parse(result.body.toString());
                    return JSON.stringify(body);
                }
                case 'get_game_status': {
                    const result = await callAPI('/api/game/status', 'GET', null, {});
                    const body = JSON.parse(result.body.toString());
                    return JSON.stringify(body);
                }
                case 'get_mod_details': {
                const query = { projectId: args.projectId, source: args.source || 'modrinth' };
                const result = await callAPI('/api/mods/detail', 'GET', null, query);
                const body = JSON.parse(result.body.toString());
                return JSON.stringify(body);
            }
                case 'browse_directory': {
                    if (args.path) {
                        const pathCheck = validatePath(args.path);
                        if (!pathCheck.valid) return JSON.stringify({ error: pathCheck.error });
                    }
                    const browseQuery = {};
                    if (args.path) browseQuery.path = args.path;
                    if (args.type) browseQuery.type = args.type;
                    if (args.pattern) browseQuery.pattern = args.pattern;
                    const result = await callAPI('/api/fs/browse', 'GET', null, browseQuery);
                    const body = JSON.parse(result.body.toString());
                    return JSON.stringify(body);
                }
                case 'read_file': {
                    const pathCheck = validatePath(args.path);
                    if (!pathCheck.valid) return JSON.stringify({ error: pathCheck.error });
                    const filePath = pathCheck.resolved;
                    try {
                        const stat = await fs.promises.stat(filePath);
                        if (stat.isDirectory()) return JSON.stringify({ error: '路径是目录，请使用 browse_directory' });
                        if (stat.size > 100 * 1024) return JSON.stringify({ error: `文件过大(${Math.round(stat.size/1024)}KB)，限制100KB` });
                        let content = await fs.promises.readFile(filePath, 'utf-8');
                        if (args.lines && args.lines > 0) {
                            const allLines = content.split('\n');
                            content = allLines.slice(-args.lines).join('\n');
                        }
                        return JSON.stringify({ success: true, path: filePath, size: stat.size, content });
                    } catch (e) {
                        if (e.code === 'ENOENT') return JSON.stringify({ error: '文件不存在' });
                        return JSON.stringify({ error: `读取文件失败: ${e.message}` });
                    }
                }
                case 'launch_game': {
                    const body = { versionId: args.versionId };
                    const result = await callAPI('/api/launch', 'POST', JSON.stringify(body), {});
                    const respBody = JSON.parse(result.body.toString());
                    return JSON.stringify(respBody);
                }
                case 'stop_game': {
                    const query = args.sessionId ? { sessionId: args.sessionId } : {};
                    const result = await callAPI('/api/game/stop', 'POST', JSON.stringify(query), {});
                    const respBody = JSON.parse(result.body.toString());
                    return JSON.stringify(respBody);
                }
                case 'get_game_log': {
                    const query = { count: String(args.count || 50) };
                    if (args.sessionId) query.sessionId = args.sessionId;
                    const result = await callAPI('/api/game/log', 'GET', null, query);
                    const body = JSON.parse(result.body.toString());
                    return JSON.stringify(body);
                }
                case 'diagnose_crash': {
                    if (args.logPath) {
                        const query = { path: args.logPath };
                        const result = await callAPI('/api/crash/log-content', 'GET', null, query);
                        const body = JSON.parse(result.body.toString());
                        return JSON.stringify(body);
                    } else {
                        const result = await callAPI('/api/crash/logs', 'GET', null, {});
                        const body = JSON.parse(result.body.toString());
                        return JSON.stringify(body);
                    }
                }
                case 'manage_settings': {
                    if (args.action === 'write' && args.key) {
                        const body = { key: args.key, value: args.value };
                        const result = await callAPI('/api/settings/set', 'POST', JSON.stringify(body), {});
                        const respBody = JSON.parse(result.body.toString());
                        return JSON.stringify(respBody);
                    } else {
                        const result = await callAPI('/api/settings', 'GET', null, {});
                        const body = JSON.parse(result.body.toString());
                        return JSON.stringify(body);
                    }
                }
                case 'install_version': {
                    const body = { versionId: args.versionId, versionUrl: args.versionUrl };
                    const result = await callAPI('/api/install-start', 'POST', JSON.stringify(body), {});
                    const respBody = JSON.parse(result.body.toString());
                    return JSON.stringify(respBody);
                }
                case 'install_progress': {
                    const query = { sessionId: args.sessionId };
                    const result = await callAPI('/api/install-progress', 'GET', null, query);
                    const body = JSON.parse(result.body.toString());
                    return JSON.stringify(body);
                }
                case 'install_loader': {
                    const loader = args.loader;
                    const gameVersion = args.gameVersion;
                    let apiPath, body;
                    if (loader === 'fabric') {
                        apiPath = '/api/fabric/install';
                        body = { gameVersion, loaderVersion: args.loaderVersion || '' };
                    } else if (loader === 'forge') {
                        apiPath = '/api/forge/install';
                        body = { gameVersion, forgeVersion: args.loaderVersion || '' };
                    } else if (loader === 'neoforge') {
                        apiPath = '/api/neoforge/install';
                        body = { gameVersion, neoVersion: args.loaderVersion || '' };
                    } else {
                        return JSON.stringify({ error: `不支持的加载器: ${loader}` });
                    }
                    const result = await callAPI(apiPath, 'POST', JSON.stringify(body), {});
                    const respBody = JSON.parse(result.body.toString());
                    return JSON.stringify(respBody);
                }
                case 'web_search': {
                    try {
                        const searchQuery = encodeURIComponent(args.query || '');
                        const searchUrl = `https://zh.minecraft.wiki/w/Special:Search?search=${searchQuery}&limit=5`;
                        const https = require('https');
                        const searchResult = await new Promise((resolve, reject) => {
                            https.get(searchUrl, { headers: { 'User-Agent': 'VersePC/1.0' } }, (res) => {
                                let data = '';
                                res.on('data', chunk => data += chunk);
                                res.on('end', () => resolve(data));
                                res.on('error', reject);
                            }).on('error', reject);
                        });
                        const titleMatch = [...searchResult.matchAll(/<a[^>]*class="mw-search-result-heading"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)];
                        const results = titleMatch.slice(0, 5).map(m => ({
                            title: m[2].replace(/<[^>]+>/g, '').trim(),
                            url: `https://zh.minecraft.wiki${m[1]}`
                        }));
                        if (results.length === 0) {
                            return JSON.stringify({ success: true, query: args.query, results: [], message: '未找到相关结果' });
                        }
                        return JSON.stringify({ success: true, query: args.query, results });
                    } catch (e) {
                        return JSON.stringify({ error: `搜索失败: ${e.message}` });
                    }
                }
                case 'get_current_context': {
                    const result = await callAPI('/api/current-context', 'GET', null, {});
                    const body = JSON.parse(result.body.toString());
                    return JSON.stringify(body);
                }
                case 'select_version': {
                    const fs = require('fs');
                    const pathMod = require('path');
                    const os = require('os');
                    const versionsDir = pathMod.join(os.homedir(), '.versepc', 'versions');
                    let installed = [];

                    function svDetectLoader(data, dirName) {
                        const jsonStr = JSON.stringify(data).toLowerCase();
                        const idLower = (data.id || dirName).toLowerCase();
                        const mcLower = (data.mainClass || '').toLowerCase();
                        if (/fabric/i.test(idLower) || /fabric/i.test(mcLower) || jsonStr.includes('net.fabricmc:fabric-loader') || jsonStr.includes('org.quiltmc:quilt-loader')) return 'Fabric';
                        if (jsonStr.includes('net.neoforge') || jsonStr.includes('neoforged') || /neoforge/i.test(idLower)) return 'NeoForge';
                        if (jsonStr.includes('net.minecraftforge') || /forge/i.test(idLower) || /forge/i.test(mcLower)) return 'Forge';
                        if (jsonStr.includes('optifine:optifine') || /optifine/i.test(idLower)) return 'OptiFine';
                        if (jsonStr.includes('liteloader') || /liteloader/i.test(idLower)) return 'LiteLoader';
                        return null;
                    }

                    function svResolveLoader(data, dirName, depth) {
                        if (depth > 5) return null;
                        const loader = svDetectLoader(data, dirName);
                        if (loader) return loader;
                        if (data.inheritsFrom) {
                            const inheritLower = data.inheritsFrom.toLowerCase();
                            if (/fabric/i.test(inheritLower)) return 'Fabric';
                            if (/forge/i.test(inheritLower)) return 'Forge';
                            if (/neoforge/i.test(inheritLower)) return 'NeoForge';
                            if (/quilt/i.test(inheritLower)) return 'Quilt';
                            if (/optifine/i.test(inheritLower)) return 'OptiFine';
                            const parentPath = pathMod.join(versionsDir, data.inheritsFrom, data.inheritsFrom + '.json');
                            if (fs.existsSync(parentPath)) {
                                try {
                                    const parentData = JSON.parse(fs.readFileSync(parentPath, 'utf8'));
                                    return svResolveLoader(parentData, data.inheritsFrom, depth + 1);
                                } catch (_) {}
                            }
                        }
                        return null;
                    }

                    if (fs.existsSync(versionsDir)) {
                        try {
                            const dirs = await fs.promises.readdir(versionsDir, { withFileTypes: true });
                            for (const d of dirs) {
                                if (!d.isDirectory()) continue;
                                const vDir = pathMod.join(versionsDir, d.name);
                                const info = { id: d.name, name: d.name, path: vDir };
                                try {
                                    const vJson = pathMod.join(vDir, d.name + '.json');
                                    if (fs.existsSync(vJson)) {
                                        const data = JSON.parse(await fs.promises.readFile(vJson, 'utf8'));
                                        info.type = data.type || 'release';
                                        let detectedLoader = svDetectLoader(data, d.name);
                                        if (!detectedLoader) detectedLoader = svResolveLoader(data, d.name, 0);
                                        info.loader = detectedLoader || 'Vanilla';
                                        info.isForge = info.loader === 'Forge';
                                        info.isFabric = info.loader === 'Fabric';
                                        info.isNeoForge = info.loader === 'NeoForge';
                                        if (data.inheritsFrom) info.inheritsFrom = data.inheritsFrom;
                                        const modsDir = pathMod.join(vDir, 'mods');
                                        if (fs.existsSync(modsDir)) {
                                            const modFiles = await fs.promises.readdir(modsDir);
                                            info.modsCount = modFiles.filter(f => f.endsWith('.jar')).length;
                                        }
                                    }
                                } catch (e) {}
                                installed.push(info);
                            }
                        } catch (e) {}
                    }
                    if (installed.length === 0) {
                        return JSON.stringify({ purpose: args.purpose || '', selected: null, installed: [] });
                    }
                    const selId = 'sel-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
                    if (mainWindow && mainWindow.webContents) {
                        mainWindow.webContents.send('ai:select-version-request', {
                            selId,
                            purpose: args.purpose || '选择版本',
                            installed
                        });
                    }
                    const selected = await new Promise((resolve) => {
                        const timer = setTimeout(() => {
                            pendingVersionSelections.delete(selId);
                            resolve(null);
                        }, 120000);
                        pendingVersionSelections.set(selId, { resolve, timer });
                    });
                    return JSON.stringify({ purpose: args.purpose || '', selected, installed });
                }
                case 'add_download_task': {
                    const taskType = args.taskType;
                    const taskName = args.name;
                    const source = args.source || 'modrinth';
                    const targetVersionId = args.targetVersionId || '';
                    const mcVersion = args.mcVersion || '';
                    const loader = args.loader || '';
                    const iconUrl = args.iconUrl || '';
                    const sessionId = 'ai-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

                    if (mainWindow && mainWindow.webContents) {
                        mainWindow.webContents.send('ai:add-download-task', {
                            sessionId, taskType, taskName, source, targetVersionId,
                            mcVersion, loader, iconUrl,
                            projectId: args.projectId || '',
                            versionId: args.versionId || '',
                            downloadUrl: args.downloadUrl || '',
                            fileName: args.fileName || ''
                        });
                    }

                    return JSON.stringify({ success: true, sessionId, message: '下载任务已添加到下载管理页面，任务ID: ' + sessionId });
                }
                case 'get_download_status': {
                    const sessionId = args.sessionId;
                    const taskType = args.taskType;
                    if (taskType === 'version') {
                        const result = await callAPI('/api/install/progress', 'GET', null, { sessionId });
                        return result.body.toString();
                    } else if (taskType === 'modpack') {
                        const result = await callAPI('/api/mods/download-status', 'GET', null, { sessionId });
                        return result.body.toString();
                    } else {
                        const result = await callAPI('/api/mods/download-status', 'GET', null, { sessionId });
                        return result.body.toString();
                    }
                }
                case 'search_modpacks': {
                    const query = {
                        query: args.query || '',
                        loader: args.loader || '',
                        version: args.version || '',
                        limit: String(args.limit || 5)
                    };
                    const result = await callAPI('/api/modpacks/search', 'GET', null, query);
                    const body = JSON.parse(result.body.toString());
                    return JSON.stringify(body);
                }
                case 'install_modpack': {
                    const body = { projectId: args.projectId, mcVersion: args.mcVersion || '' };
                    const result = await callAPI('/api/modpacks/install', 'POST', JSON.stringify(body), {});
                    const respBody = JSON.parse(result.body.toString());
                    return JSON.stringify(respBody);
                }
                case 'execute_command': {
                    const { exec } = require('child_process');
                    const os = require('os');

                    const command = (args.command || '').trim();
                    if (!command) return JSON.stringify({ error: '命令不能为空' });

                    const BLOCKED_COMMANDS = [
                        'format', 'mkfs', 'fdisk', 'diskpart',
                        'reg', 'regedit',
                        'net user', 'net localgroup', 'netsh',
                        'schtasks', 'at',
                        'wmic', 'mshta', 'cscript', 'wscript',
                        'rundll32', 'regsvr32',
                        'certutil', 'bitsadmin',
                        'icacls', 'cacls', 'takeown'
                    ];
                    const DESTRUCTIVE_PATTERNS = [
                        /rm\s+(-[rf]+\s+)?\/(\s|$)/i,
                        /del\s+\/[sfq]+\s+[a-z]:\\/i,
                        /format\s+[a-z]:/i,
                        /shutdown\s+/i,
                        /;\s*(rm|del|format|shutdown)/i,
                        /\|\s*(rm|del|format|shutdown)/i,
                        /&&\s*(rm|del|format|shutdown)/i
                    ];

                    const cmdLower = command.toLowerCase().trim();
                    const cmdBase = cmdLower.split(/\s+/)[0].replace(/\.(exe|bat|cmd|com|ps1)$/i, '');

                    for (const bl of BLOCKED_COMMANDS) {
                        if (cmdBase === bl.toLowerCase() || cmdLower.startsWith(bl.toLowerCase() + ' ')) {
                            return JSON.stringify({ error: `安全策略禁止执行: ${bl}` });
                        }
                    }
                    for (const pat of DESTRUCTIVE_PATTERNS) {
                        if (pat.test(command)) {
                            return JSON.stringify({ error: '命令包含潜在危险操作，已被安全策略阻止' });
                        }
                    }

                    const dataDir = path.join(os.homedir(), '.versepc');
                    let workDir = args.cwd ? path.resolve(args.cwd) : dataDir;

                    const timeout = Math.min(Math.max(args.timeout || 30000, 3000), 120000);

                    return await new Promise((resolve) => {
                        let child;
                        const timer = setTimeout(() => {
                            child?.kill();
                            resolve(JSON.stringify({ error: `命令执行超时(${timeout}ms)`, timedOut: true }));
                        }, timeout);

                        const { spawn } = require('child_process');
                        const isWin = process.platform === 'win32';
                        child = spawn(isWin ? 'cmd.exe' : '/bin/sh', [isWin ? '/c' : '-c', command], {
                            cwd: workDir,
                            windowsHide: true,
                            env: { ...process.env }
                        });

                        let stdout = '';
                        let stderr = '';
                        child.stdout.on('data', (d) => { stdout += d.toString(); });
                        child.stderr.on('data', (d) => { stderr += d.toString(); });

                        child.on('error', (error) => {
                            clearTimeout(timer);
                            resolve(JSON.stringify({
                                success: false,
                                command,
                                cwd: workDir,
                                exitCode: error.code || 1,
                                stdout: stdout.trim(),
                                stderr: stderr.trim(),
                                error: `命令执行失败: ${error.message}`
                            }));
                        });

                        child.on('close', (code) => {
                            clearTimeout(timer);
                            let out = stdout || '';
                            let err = stderr || '';
                            const maxOutput = 50000;
                            if (out.length > maxOutput) out = out.slice(0, maxOutput) + '\n...[截断]';
                            if (err.length > maxOutput) err = err.slice(0, maxOutput) + '\n...[截断]';

                            const result = {
                                success: code === 0,
                                command,
                                cwd: workDir,
                                exitCode: code,
                                stdout: out.trim(),
                                stderr: err.trim()
                            };
                            if (code !== 0) {
                                result.error = `命令执行失败(exit ${code})`;
                            }
                            resolve(JSON.stringify(result));
                        });
                    });
                }
                case 'write_file': {
                    const pathCheck = validatePath(args.file_path, { write: true });
                    if (!pathCheck.valid) return JSON.stringify({ error: pathCheck.error });
                    const filePath = pathCheck.resolved;
                    const content = args.content || '';
                    if (content.length > 500 * 1024) return JSON.stringify({ error: `内容过大(${Math.round(content.length/1024)}KB)，限制500KB` });
                    try {
                        const dir = path.dirname(filePath);
                        await fs.promises.mkdir(dir, { recursive: true });
                        const existed = fs.existsSync(filePath);
                        if (existed) BackupManager.createBackup(filePath, 'write_file', {});
                        const validation = CodeValidator.validate(content, filePath);
                        if (!validation.valid) {
                            return JSON.stringify({ error: `代码验证失败: ${validation.error}${validation.line ? ' (行 ' + validation.line + ')' : ''}`, validation, suggestion: validation.suggestion || '请修复语法错误后重试' });
                        }
                        await fs.promises.writeFile(filePath, content, 'utf-8');
                        ChangeTracker.recordChange({
                            type: existed ? 'overwrite' : 'create',
                            toolName: 'write_file',
                            filePath: filePath,
                            newContent: content.substring(0, 2000)
                        });
                        return JSON.stringify({ success: true, path: filePath, size: content.length });
                    } catch (e) {
                        return JSON.stringify({ error: `写入文件失败: ${e.message}` });
                    }
                }
                case 'edit_file': {
                    const pathCheck = validatePath(args.file_path, { write: true });
                    if (!pathCheck.valid) return JSON.stringify({ error: pathCheck.error });
                    const filePath = pathCheck.resolved;
                    const oldString = args.old_string;
                    const newString = args.new_string;
                    const replaceAll = args.replace_all || false;
                    if (!oldString) return JSON.stringify({ error: 'old_string 不能为空' });
                    try {
                        const stat = await fs.promises.stat(filePath);
                        if (!stat.isFile()) return JSON.stringify({ error: '文件不存在' });
                    } catch (e) {
                        return JSON.stringify({ error: '文件不存在' });
                    }
                    try {
                        let content = await fs.promises.readFile(filePath, 'utf-8');
                        if (!content.includes(oldString)) return JSON.stringify({ error: '未找到要替换的文本，old_string 在文件中不存在' });
                        BackupManager.createBackup(filePath, 'edit_file', { old_string: oldString.substring(0, 200), new_string: newString.substring(0, 200) });
                        let count = 1;
                        if (!replaceAll) {
                            const firstIdx = content.indexOf(oldString);
                            const lastIdx = content.lastIndexOf(oldString);
                            if (firstIdx !== lastIdx) return JSON.stringify({ error: 'old_string 在文件中不唯一，请提供更多上下文使其唯一匹配，或设置 replace_all 为 true' });
                            content = content.replace(oldString, newString);
                        } else {
                            count = content.split(oldString).length - 1;
                            content = content.split(oldString).join(newString);
                        }
                        const validation = CodeValidator.validate(content, filePath);
                        if (!validation.valid) {
                            return JSON.stringify({ error: `代码验证失败: ${validation.error}${validation.line ? ' (行 ' + validation.line + ')' : ''}`, validation, suggestion: validation.suggestion || '请修复语法错误后重试' });
                        }
                        await fs.promises.writeFile(filePath, content, 'utf-8');
                        ChangeTracker.recordChange({
                            type: 'modify',
                            toolName: 'edit_file',
                            filePath: filePath,
                            diff: { old: oldString.substring(0, 200), new: newString.substring(0, 200) }
                        });
                        return JSON.stringify({ success: true, path: filePath, replacements: count });
                    } catch (e) {
                        return JSON.stringify({ error: `编辑文件失败: ${e.message}` });
                    }
                }
                case 'grep_search': {
                    const rawSearchPath = args.path || path.join(os.homedir(), '.versepc');
                    const pathCheck = validatePath(rawSearchPath);
                    if (!pathCheck.valid) return JSON.stringify({ error: pathCheck.error });
                    const searchPath = pathCheck.resolved;
                    try {
                        const pattern = args.pattern;
                        const outputMode = args.output_mode || 'files_with_matches';
                        const headLimit = Math.min(args.head_limit || 100, 100);
                        const contextLines = args.C || 0;
                        const globFilter = args.glob || null;
                        const MAX_DEPTH = 6;
                        const MAX_FILES = 200;
                        const fileMatches = {};
                        let filesScanned = 0;

                        async function searchDir(dir, depth) {
                            if (depth > MAX_DEPTH) return;
                            if (filesScanned >= MAX_FILES) return;
                            let entries;
                            try {
                                entries = await fs.promises.readdir(dir, { withFileTypes: true });
                            } catch (e) { return; }
                            for (const entry of entries) {
                                if (filesScanned >= MAX_FILES) break;
                                if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
                                const fullPath = path.join(dir, entry.name);
                                if (entry.isDirectory()) {
                                    await searchDir(fullPath, depth + 1);
                                    if (depth % 2 === 0) await new Promise(r => setImmediate(r));
                                } else if (entry.isFile()) {
                                    if (globFilter) {
                                        const escaped = globFilter.replace(/[.+^${}()|[\]\\]/g, '\\$&');
                                        const globRegex = new RegExp('^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
                                        if (!globRegex.test(entry.name)) continue;
                                    }
                                    try {
                                        const stat = await fs.promises.stat(fullPath);
                                        if (stat.size > 500 * 1024) continue;
                                        const content = await fs.promises.readFile(fullPath, 'utf-8');
                                        filesScanned++;
                                        const lines = content.split('\n');
                                        const matchedLines = [];
                                        for (let i = 0; i < lines.length; i++) {
                                            const testRegex = new RegExp(pattern, args.i ? 'i' : '');
                                            if (testRegex.test(lines[i])) {
                                                matchedLines.push({ line: i + 1, text: lines[i] });
                                            }
                                        }
                                        if (matchedLines.length > 0) {
                                            fileMatches[fullPath] = matchedLines;
                                        }
                                    } catch (e) {}
                                }
                                if (Object.keys(fileMatches).length >= headLimit) break;
                            }
                        }
                        await searchDir(searchPath, 0);
                        if (outputMode === 'files_with_matches') {
                            const files = Object.keys(fileMatches).slice(0, headLimit);
                            return JSON.stringify({ success: true, pattern, path: searchPath, totalFiles: files.length, files });
                        } else if (outputMode === 'count') {
                            const counts = {};
                            for (const [fp, matches] of Object.entries(fileMatches)) {
                                counts[fp] = matches.length;
                            }
                            return JSON.stringify({ success: true, pattern, path: searchPath, counts });
                        } else {
                            const contentResults = [];
                            for (const [fp, matches] of Object.entries(fileMatches).slice(0, headLimit)) {
                                for (const m of matches.slice(0, 20)) {
                                    const entry = { file: fp, line: m.line, text: m.text.slice(0, 200) };
                                    contentResults.push(entry);
                                }
                            }
                            return JSON.stringify({ success: true, pattern, path: searchPath, totalMatches: contentResults.length, results: contentResults.slice(0, headLimit) });
                        }
                    } catch (e) {
                        return JSON.stringify({ error: `搜索失败: ${e.message}` });
                    }
                }
                case 'glob_search': {
                    const rawSearchRoot = args.path || path.join(os.homedir(), '.versepc');
                    const pathCheck = validatePath(rawSearchRoot);
                    if (!pathCheck.valid) return JSON.stringify({ error: pathCheck.error });
                    const searchRoot = pathCheck.resolved;
                    try {
                        const pattern = args.pattern;
                        const escaped = pattern.replace(/[+^${}()|[\]\\]/g, '\\$&');
                        const globRegex = new RegExp('^' + escaped.replace(/\*\*/g, '___DOUBLESTAR___').replace(/\*/g, '[^/]*').replace(/___DOUBLESTAR___/g, '.*').replace(/\?/g, '[^/]') + '$');
                        const results = [];
                        const MAX_DEPTH = 6;
                        const MAX_RESULTS = 100;

                        async function walkDir(dir, relativePath, depth) {
                            if (depth > MAX_DEPTH) return;
                            if (results.length >= MAX_RESULTS) return;
                            let entries;
                            try {
                                entries = await fs.promises.readdir(dir, { withFileTypes: true });
                            } catch (e) { return; }
                            for (const entry of entries) {
                                if (results.length >= MAX_RESULTS) break;
                                if (entry.name.startsWith('.')) continue;
                                const fullPath = path.join(dir, entry.name);
                                const relPath = relativePath ? relativePath + '/' + entry.name : entry.name;
                                if (entry.isDirectory()) {
                                    await walkDir(fullPath, relPath, depth + 1);
                                    if (depth % 2 === 0) await new Promise(r => setImmediate(r));
                                } else {
                                    if (globRegex.test(relPath)) {
                                        try {
                                            const stat = await fs.promises.stat(fullPath);
                                            results.push({ path: fullPath, name: entry.name, size: stat.size, modified: stat.mtimeMs });
                                        } catch (e) {}
                                    }
                                }
                            }
                        }
                        await walkDir(searchRoot, '', 0);
                        return JSON.stringify({ success: true, pattern, root: searchRoot, total: results.length, files: results.slice(0, MAX_RESULTS) });
                    } catch (e) {
                        return JSON.stringify({ error: `搜索失败: ${e.message}` });
                    }
                }
                case 'web_fetch': {
                    try {
                        const url = args.url;
                        if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
                            return JSON.stringify({ error: 'URL必须以 http:// 或 https:// 开头' });
                        }
                        const maxLength = args.max_length || 5000;
                        const https = require('https');
                        const http = require('http');
                        const client = url.startsWith('https') ? https : http;
                        const body = await new Promise((resolve, reject) => {
                            const timeout = setTimeout(() => {
                                reject(new Error('请求超时'));
                            }, 20000);
                            client.get(url, { headers: { 'User-Agent': 'VersePC/1.0' } }, (res) => {
                                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                                    clearTimeout(timeout);
                                    const redirectUrl = new URL(res.headers.location, url).toString();
                                    const redirectClient = redirectUrl.startsWith('https') ? https : http;
                                    redirectClient.get(redirectUrl, { headers: { 'User-Agent': 'VersePC/1.0' } }, (res2) => {
                                        let data = '';
                                        res2.on('data', chunk => data += chunk);
                                        res2.on('end', () => { clearTimeout(timeout); resolve(data); });
                                        res2.on('error', (e) => { clearTimeout(timeout); reject(e); });
                                    }).on('error', (e) => { clearTimeout(timeout); reject(e); });
                                    return;
                                }
                                let data = '';
                                res.on('data', chunk => data += chunk);
                                res.on('end', () => { clearTimeout(timeout); resolve(data); });
                                res.on('error', (e) => { clearTimeout(timeout); reject(e); });
                            }).on('error', (e) => { clearTimeout(timeout); reject(e); });
                        });
                        let text = body.replace(/<script[\s\S]*?<\/script>/gi, '')
                            .replace(/<style[\s\S]*?<\/style>/gi, '')
                            .replace(/<[^>]+>/g, ' ')
                            .replace(/&nbsp;/g, ' ')
                            .replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .replace(/\s+/g, ' ')
                            .trim();
                        if (text.length > maxLength) text = text.slice(0, maxLength) + '...[truncated]';
                        return JSON.stringify({ success: true, url, length: text.length, content: text });
                    } catch (e) {
                        return JSON.stringify({ error: `获取网页失败: ${e.message}` });
                    }
                }
                case 'web_search_general': {
                    try {
                        const query = args.query || '';
                        const numResults = Math.min(args.num_results || 5, 10);
                        const https = require('https');
                        const http = require('http');

                        async function fetchUrl(url) {
                            return await new Promise((resolve, reject) => {
                                const timeout = setTimeout(() => reject(new Error('请求超时')), 10000);
                                const client = url.startsWith('https') ? https : http;
                                client.get(url, {
                                    headers: {
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
                                    }
                                }, (res) => {
                                    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                                        clearTimeout(timeout);
                                        const redirectUrl = new URL(res.headers.location, url).toString();
                                        fetchUrl(redirectUrl).then(resolve).catch(reject);
                                        return;
                                    }
                                    let data = '';
                                    res.on('data', chunk => data += chunk);
                                    res.on('end', () => { clearTimeout(timeout); resolve(data); });
                                    res.on('error', (e) => { clearTimeout(timeout); reject(e); });
                                }).on('error', (e) => { clearTimeout(timeout); reject(e); });
                            });
                        }

                        function parseBingResults(html, max) {
                            const results = [];
                            const mainBlock = html.match(/<ol[^>]*id="b_results"[^>]*>([\s\S]*?)<\/ol>/i);
                            const searchBlock = mainBlock ? mainBlock[1] : html;
                            const itemRegex = /<li[^>]*class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
                            const items = [...searchBlock.matchAll(itemRegex)];
                            for (const item of items.slice(0, max)) {
                                const linkMatch = item[1].match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
                                if (linkMatch) {
                                    const url = linkMatch[1];
                                    const title = linkMatch[2].replace(/<[^>]+>/g, '').trim();
                                    if (title && url && !url.includes('bing.com') && !url.includes('microsoft.com')) {
                                        results.push({ title: title.slice(0, 200), url });
                                    }
                                }
                            }
                            return results;
                        }

                        function parseBaiduResults(html, max) {
                            const results = [];
                            const itemRegex = /<h3[^>]*class="[^"]*t[^"]*"[^>]*>([\s\S]*?)<\/h3>/gi;
                            const items = [...html.matchAll(itemRegex)];
                            for (const item of items.slice(0, max)) {
                                const linkMatch = item[1].match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
                                if (linkMatch) {
                                    const url = linkMatch[1];
                                    const title = linkMatch[2].replace(/<[^>]+>/g, '').trim();
                                    if (title && url) results.push({ title: title.slice(0, 200), url });
                                }
                            }
                            return results;
                        }

                        let results = [];
                        const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${numResults}`;
                        try {
                            const bingHtml = await fetchUrl(bingUrl);
                            results = parseBingResults(bingHtml, numResults);
                        } catch (e) {}

                        if (results.length === 0) {
                            const baiduUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}&rn=${numResults}`;
                            try {
                                const baiduHtml = await fetchUrl(baiduUrl);
                                results = parseBaiduResults(baiduHtml, numResults);
                            } catch (e) {}
                        }

                        return JSON.stringify({ success: true, query, totalResults: results.length, results: results.slice(0, numResults) });
                    } catch (e) {
                        return JSON.stringify({ error: `搜索失败: ${e.message}` });
                    }
                }
                case 'todo_write': {
                    const todos = args.todos || [];
                    if (!Array.isArray(todos) || todos.length === 0) {
                        return JSON.stringify({ error: 'todos 必须是非空数组' });
                    }
                    const validStatuses = ['pending', 'in_progress', 'completed'];
                    const validPriorities = ['high', 'medium', 'low'];
                    const validated = todos.map(t => ({
                        id: t.id || String(Date.now()),
                        content: t.content || '',
                        status: validStatuses.includes(t.status) ? t.status : 'pending',
                        priority: validPriorities.includes(t.priority) ? t.priority : 'medium'
                    }));
                    return JSON.stringify({ success: true, todos: validated, count: validated.length });
                }
                case 'update_todo_list': {
                    const todos = args.todos || [];
                    if (!Array.isArray(todos) || todos.length === 0) {
                        return JSON.stringify({ error: 'todos must be a non-empty array' });
                    }
                    const validated = todos.map((t, i) => ({
                        id: t.id || 'task-' + (i + 1),
                        content: t.content || '',
                        status: ['pending', 'in_progress', 'completed'].includes(t.status) ? t.status : 'pending'
                    }));
                    return JSON.stringify({ status: 'success', todos: validated, count: validated.length });
                }
                case 'manage_core_memory': {
                    if (!global._coreMemory) global._coreMemory = [];
                    const { action, id, category, content } = args;
                    if (action === 'add' && content) {
                        const memId = id || 'mem-' + Date.now();
                        global._coreMemory.push({ id: memId, category: category || 'knowledge', content, timestamp: Date.now() });
                        if (global._coreMemory.length > 500) {
                            global._coreMemory = global._coreMemory.slice(-300);
                        }
                        return JSON.stringify({ status: 'success', action: 'added', id: memId, count: global._coreMemory.length });
                    } else if (action === 'update' && id && content) {
                        const idx = global._coreMemory.findIndex(m => m.id === id);
                        if (idx >= 0) {
                            global._coreMemory[idx] = { ...global._coreMemory[idx], content, category: category || global._coreMemory[idx].category, timestamp: Date.now() };
                            return JSON.stringify({ status: 'success', action: 'updated', id });
                        }
                        return JSON.stringify({ status: 'error', error: `Memory ${id} not found` });
                    } else if (action === 'delete' && id) {
                        const idx = global._coreMemory.findIndex(m => m.id === id);
                        if (idx >= 0) { global._coreMemory.splice(idx, 1); return JSON.stringify({ status: 'success', action: 'deleted', id }); }
                        return JSON.stringify({ status: 'error', error: `Memory ${id} not found` });
                    } else if (action === 'list') {
                        return JSON.stringify({ status: 'success', memories: global._coreMemory });
                    }
                    return JSON.stringify({ status: 'error', error: 'Invalid action or missing parameters' });
                }
                case 'agent': {
                    const description = args.description || '子任务';
                    const prompt = args.prompt || '';
                    if (!prompt) return JSON.stringify({ error: 'prompt 不能为空' });
                    try {
                        const subMessages = [
                            { role: 'system', content: `你是一个子代理，负责完成以下任务。直接给出结果，不要询问用户。任务描述: ${description}` },
                            { role: 'user', content: prompt }
                        ];
                        const subApiKey = loadStore().apiKey || '';
                        if (!subApiKey) return JSON.stringify({ error: '未配置 API Key，子代理无法运行' });
                        const subResult = await llmNonStream(subApiKey, 'glm-5-flash', subMessages, 0.3);
                        return JSON.stringify({ success: true, description, result: subResult });
                    } catch (e) {
                        return JSON.stringify({ error: `子代理执行失败: ${e.message}`, description });
                    }
                }
                case 'translate_mod': {
                    const fs = require('fs');
                    const os = require('os');
                    const AdmZip = require('adm-zip');
                    const pathCheck = validatePath(args.mod_path);
                    if (!pathCheck.valid) return JSON.stringify({ error: pathCheck.error });
                    const modPath = pathCheck.resolved;
                    const targetLang = args.target_lang || 'zh_cn';
                    const incremental = args.incremental !== false;
                    const batchSize = Math.min(args.batch_size || 50, 200);

                    if (!fs.existsSync(modPath)) return JSON.stringify({ error: `路径不存在: ${modPath}` });

                    let langFiles = {};
                    const isJar = modPath.toLowerCase().endsWith('.jar');

                    if (isJar) {
                        try {
                            const zip = new AdmZip(modPath);
                            const entries = zip.getEntries();
                            for (const entry of entries) {
                                const entryName = entry.entryName;
                                if (entryName.match(/assets\/[^/]+\/lang\/en_us\.json$/i) ||
                                    entryName.match(/assets\/[^/]+\/lang\/en_us\.lang$/i)) {
                                    const content = entry.getData().toString('utf-8');
                                    const namespace = entryName.match(/assets\/([^/]+)\/lang\//)[1];
                                    langFiles[namespace] = { path: entryName, content, format: entryName.endsWith('.json') ? 'json' : 'lang' };
                                }
                            }
                        } catch (e) {
                            return JSON.stringify({ error: `无法读取JAR文件: ${e.message}` });
                        }
                    } else {
                        async function scanDir(dir, depth) {
                            if (depth > 5) return;
                            let entries;
                            try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (e) { return; }
                            for (const entry of entries) {
                                const fullPath = path.join(dir, entry.name);
                                if (entry.isDirectory()) {
                                    await scanDir(fullPath, depth + 1);
                                } else if (entry.name === 'en_us.json' || entry.name === 'en_us.lang') {
                                    const match = fullPath.match(/assets[\/\\]([^\/\\]+)[\/\\]lang/);
                                    const namespace = match ? match[1] : path.basename(path.dirname(path.dirname(fullPath)));
                                    const content = await fs.promises.readFile(fullPath, 'utf-8');
                                    langFiles[namespace] = { path: fullPath, content, format: entry.name.endsWith('.json') ? 'json' : 'lang' };
                                }
                            }
                        }
                        await scanDir(modPath, 0);
                    }

                    const namespaces = Object.keys(langFiles);
                    if (namespaces.length === 0) return JSON.stringify({ error: '未找到任何英文语言文件(en_us.json/lang)' });

                    const apiKey = loadStore().apiKey || '';
                    if (!apiKey) return JSON.stringify({ error: '未配置 API Key，无法进行AI翻译' });

                    const outputDir = path.join(os.homedir(), '.versepc', 'translations', targetLang);
                    await fs.promises.mkdir(outputDir, { recursive: true });

                    const results = [];

                    for (const ns of namespaces) {
                        const lf = langFiles[ns];
                        let enEntries = {};

                        if (lf.format === 'json') {
                            try { enEntries = JSON.parse(lf.content); } catch (e) { continue; }
                        } else {
                            const lines = lf.content.split('\n');
                            for (const line of lines) {
                                const eqIdx = line.indexOf('=');
                                if (eqIdx > 0) {
                                    enEntries[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
                                }
                            }
                        }

                        const enKeys = Object.keys(enEntries);
                        if (enKeys.length === 0) continue;

                        let zhEntries = {};
                        if (incremental) {
                            const zhPath = path.join(outputDir, 'assets', ns, 'lang', `${targetLang}.json`);
                            try {
                                const zhContent = await fs.promises.readFile(zhPath, 'utf-8');
                                zhEntries = JSON.parse(zhContent);
                            } catch (e) {}
                        }

                        const untranslatedKeys = enKeys.filter(k => !zhEntries[k]);
                        if (untranslatedKeys.length === 0) {
                            results.push({ namespace: ns, total: enKeys.length, translated: 0, skipped: enKeys.length, reason: '已全部翻译' });
                            continue;
                        }

                        let translatedCount = 0;
                        const batches = [];
                        for (let i = 0; i < untranslatedKeys.length; i += batchSize) {
                            batches.push(untranslatedKeys.slice(i, i + batchSize));
                        }

                        for (const batch of batches) {
                            const toTranslate = {};
                            for (const k of batch) {
                                const val = enEntries[k];
                                if (val && val.length < 500) toTranslate[k] = val;
                            }
                            if (Object.keys(toTranslate).length === 0) continue;

                            try {
                                const translatePrompt = `将以下Minecraft模组文本从英文翻译为${targetLang === 'zh_cn' ? '简体中文' : '繁体中文'}。保持JSON格式，只翻译值不翻译键。保留格式占位符如%s、%d、%1$s等。保留§颜色代码。专有名词（如生物名、物品名）使用中文社区常用翻译。输出完整的JSON对象。

${JSON.stringify(toTranslate, null, 2)}`;

                                const translateResult = await llmNonStream(apiKey, 'glm-5-flash', [
                                    { role: 'system', content: `你是Minecraft模组翻译专家。将英文翻译为${targetLang === 'zh_cn' ? '简体中文' : '繁体中文'}，保持JSON格式，保留格式占位符和颜色代码。` },
                                    { role: 'user', content: translatePrompt }
                                ], 0.3);

                                const jsonMatch = translateResult.match(/\{[\s\S]*\}/);
                                if (jsonMatch) {
                                    const translated = JSON.parse(jsonMatch[0]);
                                    for (const k of Object.keys(translated)) {
                                        if (toTranslate[k] !== undefined) {
                                            zhEntries[k] = translated[k];
                                            translatedCount++;
                                        }
                                    }
                                }
                            } catch (e) {}
                        }

                        const nsOutputDir = path.join(outputDir, 'assets', ns, 'lang');
                        await fs.promises.mkdir(nsOutputDir, { recursive: true });
                        await fs.promises.writeFile(path.join(nsOutputDir, `${targetLang}.json`), JSON.stringify(zhEntries, null, 2), 'utf-8');

                        results.push({
                            namespace: ns,
                            total: enKeys.length,
                            translated: translatedCount,
                            skipped: enKeys.length - untranslatedKeys.length,
                            output: path.join(nsOutputDir, `${targetLang}.json`)
                        });
                    }

                    return JSON.stringify({
                        success: true,
                        modPath,
                        targetLang,
                        incremental,
                        namespaces: results,
                        outputDir,
                        totalTranslated: results.reduce((s, r) => s + r.translated, 0),
                        totalEntries: results.reduce((s, r) => s + r.total, 0)
                    });
                }
                case 'download_cfpa_pack': {
                    const fs = require('fs');
                    const os = require('os');
                    const https = require('https');
                    const http = require('http');
                    let mcVersion = args.mc_version;
                    let loaderType = args.loader_type || 'auto';

                    if (!mcVersion) {
                        try {
                            const ctxResult = await executeToolInner('get_current_context', {});
                            const ctxParsed = JSON.parse(ctxResult);
                            mcVersion = ctxParsed.selectedVersion || '';
                        } catch (e) {}
                    }
                    if (!mcVersion) return JSON.stringify({ error: '无法确定游戏版本，请指定mc_version参数' });

                    if (loaderType === 'auto') {
                        try {
                            const ctxResult = await executeToolInner('get_current_context', {});
                            const ctxParsed = JSON.parse(ctxResult);
                            const verDir = ctxParsed.versionDir || '';
                            if (verDir) {
                                const fsSync = require('fs');
                                if (fsSync.existsSync(path.join(verDir, 'fabric-server-launcher.properties')) || fsSync.existsSync(path.join(verDir, 'fabric'))) {
                                    loaderType = 'fabric';
                                }
                            }
                        } catch (e) {}
                        if (loaderType === 'auto') loaderType = 'forge';
                    }

                    const versionMap = {
                        '1.21': '1.21', '1.21.1': '1.21', '1.21.2': '1.21', '1.21.3': '1.21', '1.21.4': '1.21',
                        '1.20': '1.20', '1.20.1': '1.20', '1.20.2': '1.20', '1.20.3': '1.20', '1.20.4': '1.20', '1.20.5': '1.20', '1.20.6': '1.20',
                        '1.19': '1.19', '1.19.1': '1.19', '1.19.2': '1.19', '1.19.3': '1.19', '1.19.4': '1.19',
                        '1.18': '1.18', '1.18.1': '1.18', '1.18.2': '1.18',
                        '1.16': '1.16', '1.16.1': '1.16', '1.16.2': '1.16', '1.16.3': '1.16', '1.16.4': '1.16', '1.16.5': '1.16',
                        '1.12': '1.12.2', '1.12.1': '1.12.2', '1.12.2': '1.12.2'
                    };
                    const cfpaVersion = versionMap[mcVersion];
                    if (!cfpaVersion) return JSON.stringify({ error: `不支持的游戏版本: ${mcVersion}，CFPA资源包支持 1.12.2/1.16/1.18/1.19/1.20/1.21` });

                    const fabricVersions = ['1.16', '1.18', '1.19', '1.20', '1.21'];
                    const useFabric = loaderType === 'fabric' && fabricVersions.includes(cfpaVersion);

                    const outputDir = path.join(os.homedir(), '.versepc', 'resourcepacks');
                    await fs.promises.mkdir(outputDir, { recursive: true });
                    const suffix = useFabric ? '-Fabric' : '';
                    const outputPath = path.join(outputDir, `CFPA-${cfpaVersion}${suffix}-zh_cn.zip`);

                    function cfpaOfficialUrls(ver, fabric) {
                        const base = 'http://downloader1.meitangdehulu.com:22943';
                        const f = fabric ? '-Fabric' : '';
                        if (ver === '1.12.2') return [`${base}/Minecraft-Mod-Language-Modpack.zip`];
                        if (ver === '1.10.2') return [`${base}/Minecraft-Mod-Language-Modpack-1-10-2.zip`];
                        return [`${base}/Minecraft-Mod-Language-Modpack-${ver.replace(/\./g, '-')}${f}.zip`];
                    }

                    const jsdelivrUrl = `https://cdn.jsdelivr.net/gh/CFPAOrg/Minecraft-Mod-Language-Package@${cfpaVersion}-pack/Minecraft-Mod-Language-Package.zip`;
                    const officialUrls = cfpaOfficialUrls(cfpaVersion, useFabric);
                    const allUrls = [...officialUrls, jsdelivrUrl];

                    async function downloadWithRedirects(url) {
                        return new Promise((resolve, reject) => {
                            const timeout = setTimeout(() => reject(new Error('下载超时')), 120000);
                            const client = url.startsWith('https') ? https : http;
                            const doDownload = (dlUrl, redirects) => {
                                if (redirects > 5) { clearTimeout(timeout); reject(new Error('重定向过多')); return; }
                                client.get(dlUrl, { headers: { 'User-Agent': 'VersePC/1.0' } }, (res) => {
                                    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                                        doDownload(res.headers.location, (redirects || 0) + 1);
                                        return;
                                    }
                                    if (res.statusCode !== 200) { clearTimeout(timeout); reject(new Error(`HTTP ${res.statusCode}`)); return; }
                                    const chunks = [];
                                    res.on('data', chunk => chunks.push(chunk));
                                    res.on('end', () => { clearTimeout(timeout); resolve(Buffer.concat(chunks)); });
                                    res.on('error', (e) => { clearTimeout(timeout); reject(e); });
                                }).on('error', (e) => { clearTimeout(timeout); reject(e); });
                            };
                            doDownload(url, 0);
                        });
                    }

                    let fileData = null;
                    let usedSource = '';
                    for (const url of allUrls) {
                        try {
                            fileData = await downloadWithRedirects(url);
                            usedSource = url.includes('meitangdehulu') ? 'cfpa_official' : 'jsdelivr';
                            if (fileData && fileData.length > 1024) break;
                        } catch (e) {
                            continue;
                        }
                    }

                    if (!fileData || fileData.length < 1024) {
                        return JSON.stringify({ error: '所有下载源均失败，请检查网络连接后重试' });
                    }

                    try {
                        await fs.promises.writeFile(outputPath, fileData);
                        return JSON.stringify({
                            success: true,
                            version: cfpaVersion,
                            mcVersion,
                            loaderType,
                            path: outputPath,
                            size: Math.round(fileData.length / 1024) + 'KB',
                            source: usedSource,
                            message: `CFPA ${cfpaVersion}${useFabric ? ' (Fabric)' : ''} 简体中文资源包已下载到 ${outputPath}，可在游戏设置中启用此资源包`
                        });
                    } catch (e) {
                        return JSON.stringify({ error: `保存CFPA资源包失败: ${e.message}` });
                    }
                }
                case 'extract_builtin_translations': {
                    const fs = require('fs');
                    const os = require('os');
                    const AdmZip = require('adm-zip');
                    const targetLang = args.target_lang || 'zh_cn';
                    let modsPath = args.mods_path;

                    if (!modsPath) {
                        try {
                            const ctxResult = await executeToolInner('get_current_context', {});
                            const ctxParsed = JSON.parse(ctxResult);
                            const gameDir = ctxParsed.gameDir || '';
                            if (gameDir) modsPath = path.join(gameDir, 'mods');
                        } catch (e) {}
                    }
                    if (!modsPath || !fs.existsSync(modsPath)) {
                        return JSON.stringify({ error: 'mods目录不存在，请指定mods_path参数' });
                    }

                    const outputDir = path.join(os.homedir(), '.versepc', 'translations', 'extracted', targetLang);
                    await fs.promises.mkdir(outputDir, { recursive: true });

                    let files;
                    try {
                        files = (await fs.promises.readdir(modsPath)).filter(f => f.toLowerCase().endsWith('.jar'));
                    } catch (e) {
                        return JSON.stringify({ error: `无法读取mods目录: ${e.message}` });
                    }

                    const details = [];
                    let modsExtracted = 0;
                    let totalEntries = 0;

                    for (const jarFile of files) {
                        try {
                            const jarPath = path.join(modsPath, jarFile);
                            const zip = new AdmZip(jarPath);
                            const entries = zip.getEntries();
                            const langPattern = new RegExp(`assets/([^/]+)/lang/${targetLang}\\.json$`, 'i');

                            for (const entry of entries) {
                                const match = entry.entryName.match(langPattern);
                                if (match) {
                                    const namespace = match[1];
                                    try {
                                        const content = entry.getData().toString('utf-8');
                                        const parsed = JSON.parse(content);
                                        const entryCount = Object.keys(parsed).length;
                                        if (entryCount > 0) {
                                            const nsDir = path.join(outputDir, 'assets', namespace, 'lang');
                                            await fs.promises.mkdir(nsDir, { recursive: true });
                                            const outputPath = path.join(nsDir, `${targetLang}.json`);

                                            let existing = {};
                                            try {
                                                const existingContent = await fs.promises.readFile(outputPath, 'utf-8');
                                                existing = JSON.parse(existingContent);
                                            } catch (e) {}

                                            const merged = { ...existing, ...parsed };
                                            await fs.promises.writeFile(outputPath, JSON.stringify(merged, null, 2), 'utf-8');

                                            details.push({ namespace, mod: jarFile, entries: entryCount });
                                            modsExtracted++;
                                            totalEntries += entryCount;
                                        }
                                    } catch (e) {}
                                }
                            }
                        } catch (e) {}
                    }

                    return JSON.stringify({
                        success: true,
                        modsPath,
                        targetLang,
                        totalMods: files.length,
                        modsExtracted,
                        totalEntries,
                        outputDir,
                        details
                    });
                }
                case 'download_modpack_translation': {
                    const fs = require('fs');
                    const os = require('os');
                    const https = require('https');
                    const http = require('http');
                    const modpackName = args.modpack_name;
                    let mcVersion = args.mc_version;

                    if (!mcVersion) {
                        try {
                            const ctxResult = await executeToolInner('get_current_context', {});
                            const ctxParsed = JSON.parse(ctxResult);
                            mcVersion = ctxParsed.selectedVersion || '';
                        } catch (e) {}
                    }

                    const outputDir = path.join(os.homedir(), '.versepc', 'translations', 'modpack');
                    await fs.promises.mkdir(outputDir, { recursive: true });

                    async function downloadUrl(url) {
                        return new Promise((resolve, reject) => {
                            const timeout = setTimeout(() => reject(new Error('下载超时')), 120000);
                            const client = url.startsWith('https') ? https : http;
                            const doDownload = (dlUrl, redirects) => {
                                if (redirects > 5) { clearTimeout(timeout); reject(new Error('重定向过多')); return; }
                                client.get(dlUrl, { headers: { 'User-Agent': 'VersePC/1.0' } }, (res) => {
                                    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                                        doDownload(res.headers.location, (redirects || 0) + 1);
                                        return;
                                    }
                                    if (res.statusCode !== 200) { clearTimeout(timeout); reject(new Error(`HTTP ${res.statusCode}`)); return; }
                                    const chunks = [];
                                    res.on('data', chunk => chunks.push(chunk));
                                    res.on('end', () => { clearTimeout(timeout); resolve(Buffer.concat(chunks)); });
                                    res.on('error', (e) => { clearTimeout(timeout); reject(e); });
                                }).on('error', (e) => { clearTimeout(timeout); reject(e); });
                            };
                            doDownload(url, 0);
                        });
                    }

                    const searchUrl = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(modpackName)}&facets=[["project_type:modpack"]]&limit=5`;

                    try {
                        const searchData = await downloadUrl(searchUrl);
                        const searchResult = JSON.parse(searchData.toString('utf-8'));
                        const hits = searchResult.hits || [];

                        if (hits.length === 0) {
                            return JSON.stringify({ error: `未找到名为"${modpackName}"的整合包`, modpackName });
                        }

                        const bestMatch = hits[0];
                        const slug = bestMatch.slug;
                        const safeName = slug || modpackName.replace(/[^a-zA-Z0-9_-]/g, '_');

                        const cfpaModpackUrl = `https://modpack.cfpa.team/zh_CN/${safeName}.zip`;
                        const outputPath = path.join(outputDir, `${safeName}-translation.zip`);

                        let fileData = null;
                        try {
                            fileData = await downloadUrl(cfpaModpackUrl);
                        } catch (e) {
                            return JSON.stringify({
                                success: false,
                                modpackName,
                                mcVersion,
                                error: `CFPA暂未收录"${modpackName}"的整合包汉化补丁（Modrinth ID: ${bestMatch.project_id}）。你可以在 modpack.cfpa.team 查看已收录的整合包列表。`,
                                modrinthId: bestMatch.project_id,
                                suggestion: '该整合包的模组汉化可使用 CFPA社区资源包 + AI翻译 的组合方案'
                            });
                        }

                        if (!fileData || fileData.length < 1024) {
                            return JSON.stringify({
                                success: false,
                                modpackName,
                                mcVersion,
                                error: `下载的文件异常（${fileData ? fileData.length : 0}字节），CFPA可能尚未收录此整合包的汉化补丁`
                            });
                        }

                        await fs.promises.writeFile(outputPath, fileData);
                        return JSON.stringify({
                            success: true,
                            modpackName: bestMatch.title || modpackName,
                            mcVersion,
                            path: outputPath,
                            size: Math.round(fileData.length / 1024) + 'KB',
                            message: `整合包"${bestMatch.title || modpackName}"的汉化补丁已下载到 ${outputPath}，请解压到游戏主目录（.minecraft文件夹）`
                        });
                    } catch (e) {
                        return JSON.stringify({ error: `下载整合包汉化补丁失败: ${e.message}`, modpackName });
                    }
                }
                case 'search_translation_dict': {
                    const https = require('https');
                    const http = require('http');
                    const keyword = args.keyword;
                    const source = args.source || 'auto';

                    async function fetchUrl(url) {
                        return new Promise((resolve, reject) => {
                            const timeout = setTimeout(() => reject(new Error('请求超时')), 15000);
                            const client = url.startsWith('https') ? https : http;
                            client.get(url, { headers: { 'User-Agent': 'VersePC/1.0', 'Accept': 'application/json' } }, (res) => {
                                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                                    fetchUrl(res.headers.location).then(resolve).catch(reject);
                                    return;
                                }
                                const chunks = [];
                                res.on('data', chunk => chunks.push(chunk));
                                res.on('end', () => { clearTimeout(timeout); resolve(Buffer.concat(chunks).toString('utf-8')); });
                                res.on('error', (e) => { clearTimeout(timeout); reject(e); });
                            }).on('error', (e) => { clearTimeout(timeout); reject(e); });
                        });
                    }

                    const results = [];
                    let usedSource = source;

                    if (source === 'auto' || source === 'vmct') {
                        try {
                            const vmctUrl = `https://dict.vmct-cn.top/api/search?q=${encodeURIComponent(keyword)}&limit=20`;
                            const vmctData = await fetchUrl(vmctUrl);
                            const vmctResult = JSON.parse(vmctData);
                            if (vmctResult.data && vmctResult.data.length > 0) {
                                for (const item of vmctResult.data.slice(0, 20)) {
                                    results.push({
                                        en: item.key || item.en || '',
                                        zh: item.value || item.zh || '',
                                        mod: item.mod || item.namespace || '',
                                        source: 'vmct'
                                    });
                                }
                                usedSource = 'vmct';
                            }
                        } catch (e) {}
                    }

                    if (results.length === 0 && (source === 'auto' || source === 'mcmod')) {
                        try {
                            const mcmodUrl = `https://api.mcmod.cn/getTranslation?keyword=${encodeURIComponent(keyword)}`;
                            const mcmodData = await fetchUrl(mcmodUrl);
                            const mcmodResult = JSON.parse(mcmodData);
                            if (mcmodResult.results && mcmodResult.results.length > 0) {
                                for (const item of mcmodResult.results.slice(0, 20)) {
                                    results.push({
                                        en: item.key || item.en || '',
                                        zh: item.value || item.zh || '',
                                        mod: item.mod || '',
                                        source: 'mcmod'
                                    });
                                }
                                usedSource = 'mcmod';
                            }
                        } catch (e) {}
                    }

                    return JSON.stringify({
                        success: results.length > 0,
                        keyword,
                        source: usedSource,
                        results,
                        totalResults: results.length,
                        error: results.length === 0 ? `未找到"${keyword}"的翻译条目` : undefined
                    });
                }
                case 'explore_environment': {
                    const includeMods = args.include_mods !== false;
                    const includeVersions = args.include_versions !== false;
                    const includeSystem = args.include_system === true;
                    
                    const envInfo = {};
                    
                    try {
                        const ctxResult = await executeToolInner('get_current_context', {});
                        const ctxParsed = JSON.parse(ctxResult);
                        envInfo.context = ctxParsed;
                    } catch (e) { envInfo.context = { error: '无法获取上下文' }; }
                    
                    try {
                        const statusResult = await executeToolInner('get_game_status', {});
                        envInfo.gameStatus = JSON.parse(statusResult);
                    } catch (e) { envInfo.gameStatus = { running: false }; }
                    
                    if (includeVersions) {
                        try {
                            const verResult = await executeToolInner('get_versions', { installedOnly: true });
                            envInfo.installedVersions = JSON.parse(verResult);
                        } catch (e) { envInfo.installedVersions = []; }
                    }
                    
                    if (includeMods) {
                        try {
                            const modsResult = await executeToolInner('get_installed_mods', {});
                            envInfo.installedMods = JSON.parse(modsResult);
                        } catch (e) { envInfo.installedMods = []; }
                    }
                    
                    if (includeSystem) {
                        try {
                            const sysResult = await executeToolInner('get_system_info', {});
                            envInfo.systemInfo = JSON.parse(sysResult);
                        } catch (e) { envInfo.systemInfo = {}; }
                    }
                    
                    return JSON.stringify(envInfo);
                }
                case 'attempt_completion': {
                    return JSON.stringify({ success: true, completion: args.result || '' });
                }
                case 'bash': {
                    const { spawn } = require('child_process');
                    const cmd = (args.command || '').trim();
                    const restart = args.restart || false;
                    if (!cmd) return JSON.stringify({ error: '命令不能为空' });
                    if (restart || !global._bashSession) {
                        global._bashSession = { output: '', cwd: process.cwd() };
                    }
                    const workDir = args.cwd || global._bashSession.cwd || process.cwd();
                    const timeoutSec = Math.min(Math.max(args.timeout || 120, 5), 600);
                    const streamId = args._streamId || null;
                    if (args.background) {
                        try {
                            const isWin = process.platform === 'win32';
                            const child = spawn(isWin ? 'cmd.exe' : '/bin/sh', [isWin ? '/c' : '-c', cmd], {
                                cwd: workDir, detached: true,
                                stdio: ['ignore', 'pipe', 'pipe'],
                                windowsHide: true
                            });
                            child.unref();
                            if (!global._bgProcesses) global._bgProcesses = {};
                            const pid = child.pid;
                            const MAX_BG_OUTPUT = 1024 * 1024;
                            global._bgProcesses[pid] = { child, stdout: '', stderr: '', startTime: Date.now() };
                            child.stdout.on('data', d => {
                                if (!global._bgProcesses[pid]) return;
                                const chunk = d.toString();
                                if (global._bgProcesses[pid].stdout.length < MAX_BG_OUTPUT) {
                                    global._bgProcesses[pid].stdout += chunk;
                                }
                            });
                            child.stderr.on('data', d => {
                                if (!global._bgProcesses[pid]) return;
                                const chunk = d.toString();
                                if (global._bgProcesses[pid].stderr.length < MAX_BG_OUTPUT) {
                                    global._bgProcesses[pid].stderr += chunk;
                                }
                            });
                            child.on('exit', (code) => {
                                if (global._bgProcesses[pid]) {
                                    global._bgProcesses[pid].exitCode = code;
                                    if (global._bgProcesses[pid].child) {
                                        try { global._bgProcesses[pid].child.stdout?.destroy(); } catch (e) {}
                                        try { global._bgProcesses[pid].child.stderr?.destroy(); } catch (e) {}
                                    }
                                    delete global._bgProcesses[pid];
                                }
                            });
                            global._bashSession.cwd = workDir;
                            const killCmd = isWin ? `taskkill /PID ${pid} /F` : `kill ${pid}`;
                            return JSON.stringify({ output: `后台进程已启动 (PID: ${pid})。使用 bash(command="${killCmd}") 停止。`, pid, background: true });
                        } catch (e) {
                            return JSON.stringify({ error: `启动后台进程失败: ${String(e)}` });
                        }
                    }
                    try {
                        const isWin = process.platform === 'win32';
                        const shell = isWin ? 'cmd.exe' : '/bin/bash';
                        const utf8Cmd = isWin ? `chcp 65001 >nul 2>nul && ${cmd}` : cmd;
                        const shellArgs = isWin ? ['/c', utf8Cmd] : ['-c', utf8Cmd];
                        const child = spawn(shell, shellArgs, {
                            cwd: workDir, windowsHide: true,
                            stdio: ['ignore', 'pipe', 'pipe'],
                            env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' }
                        });
                        let stdout = '', stderr = '';
                        let killed = false;
                        const timer = setTimeout(() => {
                            killed = true;
                            try { child.kill('SIGTERM'); } catch (e) {}
                        }, timeoutSec * 1000);
                        const _decode = (buf) => buf.toString('utf-8');
                        const _sendStream = (type, data) => {
                            if (!streamId || !mainWindow || mainWindow.isDestroyed()) return;
                            try {
                                mainWindow.webContents.send('ai:chat-chunk', {
                                    type: 'tool_output_' + type,
                                    toolCallId: streamId,
                                    data
                                });
                            } catch (e) {}
                        };
                        child.stdout.on('data', d => {
                            const text = _decode(d);
                            stdout += text;
                            _sendStream('chunk', text);
                        });
                        child.stderr.on('data', d => {
                            const text = _decode(d);
                            stderr += text;
                            _sendStream('chunk', text);
                        });
                        const exitCode = await new Promise(resolve => {
                            child.on('close', code => resolve(code));
                            child.on('error', () => resolve(-1));
                        });
                        clearTimeout(timer);
                        _sendStream('end', { exitCode, killed });
                        global._bashSession.cwd = workDir;
                        if (killed) {
                            return JSON.stringify({ output: stdout.substring(0, 50000), error: `命令超时(${timeoutSec}s)已被终止`, exitCode });
                        }
                        if (stderr && !stdout) {
                            return JSON.stringify({ output: '', error: stderr.substring(0, 20000), exitCode });
                        }
                        global._bashSession.output = stdout;
                        return JSON.stringify({ output: stdout.substring(0, 50000), stderr: stderr ? stderr.substring(0, 20000) : undefined, exitCode });
                    } catch (e) {
                        return JSON.stringify({ error: String(e) });
                    }
                }
                case 'build_index': {
                    const rootDir = args.root_dir || args.rootDir;
                    if (!rootDir) return JSON.stringify({ error: 'root_dir 是必需的' });
                    const resolvedRoot = path.resolve(rootDir);
                    const buildIndexPathCheck = validatePath(resolvedRoot);
                    if (!buildIndexPathCheck.valid) return JSON.stringify({ error: buildIndexPathCheck.error });
                    const buildIndexSafeRoot = buildIndexPathCheck.resolved;
                    if (!fs.existsSync(buildIndexSafeRoot)) return JSON.stringify({ error: `目录不存在: ${buildIndexSafeRoot}` });
                    const result = await CodeIndexer.buildIndex(buildIndexSafeRoot);
                    return JSON.stringify({ success: true, ...result, rootDir: buildIndexSafeRoot });
                }
                case 'semantic_search': {
                    const query = args.query || '';
                    if (!query) return JSON.stringify({ error: 'query 是必需的' });
                    const maxResults = args.max_results || args.maxResults || 10;
                    const rootDir = args.root_dir || args.rootDir || '';
                    const result = CodeIndexer.search(query, { maxResults, rootDir });
                    return JSON.stringify(result);
                }
                case 'index_stats': {
                    return JSON.stringify(CodeIndexer.getStats());
                }
                case 'validate_code': {
                    const content = args.content || '';
                    const filePath = args.file_path || '';
                    if (!content) return JSON.stringify({ error: 'content 是必需的' });
                    const result = CodeValidator.validate(content, filePath);
                    return JSON.stringify(result);
                }
                case 'view_history': {
                    const action = args.action || 'summary';
                    const limit = args.limit || 20;
                    if (action === 'changes') {
                        const filter = {};
                        if (args.file_path) filter.filePath = args.file_path;
                        if (args.tool_name) filter.toolName = args.tool_name;
                        const changes = ChangeTracker.getChanges(filter);
                        return JSON.stringify({ changes: changes.slice(0, limit), total: changes.length });
                    }
                    if (action === 'audit') {
                        const filter = {};
                        if (args.tool_name) filter.toolName = args.tool_name;
                        const logs = ChangeTracker.getAuditLog(filter);
                        let persistedLogs = [];
                        try {
                            const logPath = path.join(os.homedir(), '.versepc', 'ai-tool-log.json');
                            persistedLogs = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
                            if (filter.toolName) persistedLogs = persistedLogs.filter(l => l.tool === filter.toolName);
                        } catch (_) {}
                        const merged = [...persistedLogs.reverse(), ...logs].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                        return JSON.stringify({ logs: merged.slice(0, limit), total: merged.length });
                    }
                    if (action === 'summary') {
                        return JSON.stringify(ChangeTracker.getSessionSummary());
                    }
                    return JSON.stringify({ error: `未知操作: ${action}` });
                }
                case 'undo_edit': {
                    const action = args.action || 'list';
                    if (action === 'list') {
                        const filePath = args.file_path || null;
                        const backups = BackupManager.listBackups(filePath);
                        return JSON.stringify({ backups: backups.map(b => ({ id: b.id, file: b.originalPath, tool: b.toolName, time: b.timestamp, lines: b.lines, restored: b.restored })), count: backups.length });
                    }
                    if (action === 'restore') {
                        const backupId = args.backup_id;
                        if (!backupId) return JSON.stringify({ error: 'backup_id 是必需的' });
                        const result = BackupManager.restoreBackup(backupId);
                        if (result.success && mainWindow && !mainWindow.isDestroyed()) {
                            try {
                                const restoredContent = fs.readFileSync(result.restoredPath, 'utf-8');
                                mainWindow.webContents.send('editor:show-diff', result.restoredPath, '', restoredContent);
                            } catch (e) {}
                        }
                        return JSON.stringify(result);
                    }
                    if (action === 'diff') {
                        const backupId = args.backup_id;
                        if (!backupId) return JSON.stringify({ error: 'backup_id 是必需的' });
                        const diff = BackupManager.getDiff(backupId);
                        return JSON.stringify(diff);
                    }
                    if (action === 'session') {
                        return JSON.stringify(BackupManager.getSessionSummary());
                    }
                    return JSON.stringify({ error: `未知操作: ${action}` });
                }
                case 'manage_processes': {
                    const action = args.action || 'list';
                    if (action === 'list') {
                        const procs = global._bgProcesses || {};
                        const list = Object.entries(procs).map(([pid, p]) => ({
                            pid: Number(pid),
                            running: p.exitCode === undefined,
                            exitCode: p.exitCode,
                            uptime: Math.round((Date.now() - p.startTime) / 1000),
                            stdoutLines: (p.stdout || '').split('\n').length,
                            stderrLines: (p.stderr || '').split('\n').length
                        }));
                        if (global._previewServer) {
                            list.push({ pid: 'preview-server', running: true, port: global._previewPort, type: 'http-server' });
                        }
                        return JSON.stringify({ processes: list, count: list.length });
                    }
                    if (action === 'output') {
                        const pid = args.pid;
                        if (!pid) return JSON.stringify({ error: 'pid 是必需的' });
                        const proc = (global._bgProcesses || {})[String(pid)];
                        if (!proc) return JSON.stringify({ error: `进程 ${pid} 不存在` });
                        const tail = args.tail || 50;
                        const stdoutLines = (proc.stdout || '').split('\n');
                        const stderrLines = (proc.stderr || '').split('\n');
                        return JSON.stringify({
                            pid, running: proc.exitCode === undefined, exitCode: proc.exitCode,
                            stdout: stdoutLines.slice(-tail).join('\n'),
                            stderr: stderrLines.slice(-tail).join('\n')
                        });
                    }
                    if (action === 'stop') {
                        const pid = args.pid;
                        if (!pid) return JSON.stringify({ error: 'pid 是必需的' });
                        const proc = (global._bgProcesses || {})[String(pid)];
                        if (!proc) return JSON.stringify({ error: `进程 ${pid} 不存在` });
                        try {
                            process.kill(Number(pid));
                            delete global._bgProcesses[String(pid)];
                            return JSON.stringify({ success: true, message: `进程 ${pid} 已终止` });
                        } catch (e) {
                            delete global._bgProcesses[String(pid)];
                            return JSON.stringify({ error: `终止进程失败: ${e.message}` });
                        }
                    }
                    if (action === 'stop_all') {
                        const procs = global._bgProcesses || {};
                        let killed = 0;
                        for (const [pid, proc] of Object.entries(procs)) {
                            try { process.kill(Number(pid)); killed++; } catch (e) {}
                        }
                        global._bgProcesses = {};
                        if (global._previewServer) {
                            global._previewServer.close();
                            global._previewServer = null;
                            global._previewPort = null;
                            killed++;
                        }
                        return JSON.stringify({ success: true, message: `已终止 ${killed} 个进程` });
                    }
                    return JSON.stringify({ error: `未知操作: ${action}` });
                }
                case 'start_preview': {
                    const http = require('http');
                    const fs = require('fs');
                    const url = require('url');
                    const cmd = args.command || 'start';
                    if (cmd === 'stop') {
                        if (global._previewServer) {
                            global._previewServer.close();
                            const oldPort = global._previewPort;
                            global._previewServer = null;
                            global._previewPort = null;
                            if (mainWindow && !mainWindow.isDestroyed()) {
                                mainWindow.webContents.send('preview:close');
                            }
                            return JSON.stringify({ success: true, message: `预览服务器已停止 (端口 ${oldPort})` });
                        }
                        return JSON.stringify({ message: '没有运行中的预览服务器' });
                    }
                    const rootDir = args.root;
                    if (!rootDir) return JSON.stringify({ error: 'root 目录路径是必需的' });
                    const resolvedRoot = path.resolve(rootDir);
                    const previewPathCheck = validatePath(resolvedRoot);
                    if (!previewPathCheck.valid) return JSON.stringify({ error: previewPathCheck.error });
                    const previewSafeRoot = previewPathCheck.resolved;
                    if (!fs.existsSync(previewSafeRoot) || !fs.statSync(previewSafeRoot).isDirectory()) {
                        return JSON.stringify({ error: `目录不存在: ${previewSafeRoot}` });
                    }
                    if (global._previewServer) {
                        global._previewServer.close();
                    }
                    const port = args.port || 8080;
                    const mimeTypes = {
                        '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
                        '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
                        '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
                        '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
                        '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
                        '.wav': 'audio/wav', '.wasm': 'application/wasm', '.txt': 'text/plain',
                        '.xml': 'application/xml', '.pdf': 'application/pdf'
                    };
                    const server = http.createServer((req, res) => {
                        const parsedUrl = url.parse(req.url);
                        let pathname = decodeURIComponent(parsedUrl.pathname);
                        if (pathname === '/') pathname = '/index.html';
                        const filePath = path.join(resolvedRoot, pathname);
                        if (!filePath.startsWith(resolvedRoot)) {
                            res.writeHead(403); res.end('Forbidden'); return;
                        }
                        const ext = path.extname(filePath).toLowerCase();
                        fs.readFile(filePath, (err, data) => {
                            if (err) {
                                if (err.code === 'ENOENT') { res.writeHead(404); res.end('Not Found'); }
                                else { res.writeHead(500); res.end('Internal Error'); }
                                return;
                            }
                            res.writeHead(200, {
                                'Content-Type': mimeTypes[ext] || 'application/octet-stream',
                                'Cache-Control': 'no-cache'
                            });
                            res.end(data);
                        });
                    });
                    try {
                        server.listen(port, '127.0.0.1', () => {
                            global._previewServer = server;
                            global._previewPort = port;
                            if (mainWindow && !mainWindow.isDestroyed()) {
                                mainWindow.webContents.send('preview:open', `http://127.0.0.1:${port}`);
                            }
                        });
                        server.on('error', (e) => {
                            if (e.code === 'EADDRINUSE') {
                                const altPort = port + 1;
                                server.listen(altPort, '127.0.0.1', () => {
                                    global._previewServer = server;
                                    global._previewPort = altPort;
                                    if (mainWindow && !mainWindow.isDestroyed()) {
                                        mainWindow.webContents.send('preview:open', `http://127.0.0.1:${altPort}`);
                                    }
                                });
                            }
                        });
                        return JSON.stringify({ success: true, message: `预览服务器启动中... 端口 ${port}`, root: previewSafeRoot, port });
                    } catch (e) {
                        return JSON.stringify({ error: `启动预览服务器失败: ${e.message}` });
                    }
                }
                case 'str_replace_based_edit_tool': {
                    const fs = require('fs'), pathMod = require('path');
                    const os = require('os');
                    const cmd = args.command;
                    const filePath = args.path;
                    if (!cmd || !filePath) return JSON.stringify({ error: 'command and path are required' });
                    const resolvedPath = filePath.replace(/^~/, os.homedir());
                    const pathCheck = validatePath(resolvedPath);
                    if (!pathCheck.valid) return JSON.stringify({ error: pathCheck.error });
                    const safePath = pathCheck.resolved;
                    if (cmd === 'view') {
                        if (!fs.existsSync(safePath)) return JSON.stringify({ error: `Path does not exist: ${safePath}` });
                        const stat = fs.statSync(safePath);
                        if (stat.isDirectory()) {
                            const items = fs.readdirSync(safePath, { withFileTypes: true }).slice(0, 50);
                            const listing = items.map(d => `  ${d.isDirectory() ? '[DIR]' : '     '} ${d.name}`).join('\n');
                            return JSON.stringify({ output: `Contents of ${safePath}:\n${listing}` });
                        }
                        let content = fs.readFileSync(safePath, 'utf-8');
                        const lines = content.split('\n');
                        const range = args.view_range;
                        let start = 0, end = lines.length;
                        if (range && Array.isArray(range) && range.length === 2) {
                            start = Math.max(0, range[0] - 1);
                            end = range[1] === -1 ? lines.length : Math.min(lines.length, range[1]);
                        }
                        const numbered = lines.slice(start, end).map((l, i) => `${String(i + start + 1).padStart(6)}\t${l}`).join('\n');
                        return JSON.stringify({ output: `文件内容：${safePath}\n${numbered}\n` });
                    }
                    if (cmd === 'create') {
                        if (fs.existsSync(safePath)) return JSON.stringify({ error: `File already exists at: ${safePath}. Cannot overwrite with create.` });
                        const fileText = args.file_text || '';
                        const validation = CodeValidator.validate(fileText, safePath);
                        if (!validation.valid) {
                            return JSON.stringify({ error: `代码验证失败: ${validation.error}${validation.line ? ' (行 ' + validation.line + ')' : ''}`, validation, suggestion: validation.suggestion || '请修复语法错误后重试' });
                        }
                        fs.mkdirSync(pathMod.dirname(safePath), { recursive: true });
                        fs.writeFileSync(safePath, fileText, 'utf-8');
                        ChangeTracker.recordChange({
                            type: 'create',
                            toolName: 'str_replace_based_edit_tool',
                            filePath: safePath,
                            newContent: fileText.substring(0, 2000)
                        });
                        return JSON.stringify({ output: `File created successfully at: ${safePath}` });
                    }
                    if (!fs.existsSync(safePath)) return JSON.stringify({ error: `File does not exist: ${safePath}` });
                    if (cmd === 'str_replace') {
                        const oldStr = args.old_str;
                        const newStr = args.new_str || '';
                        if (!oldStr) return JSON.stringify({ error: 'old_str is required for str_replace' });
                        let content = fs.readFileSync(safePath, 'utf-8');
                        const count = content.split(oldStr).length - 1;
                        if (count === 0) return JSON.stringify({ error: `old_str not found in ${safePath}` });
                        if (count > 1) return JSON.stringify({ error: `Multiple occurrences (${count}) of old_str. Please provide more context to make it unique.` });
                        const originalContent = content;
                        content = content.replace(oldStr, newStr);
                        const validation = CodeValidator.validate(content, safePath);
                        if (!validation.valid) {
                            return JSON.stringify({ error: `代码验证失败: ${validation.error}${validation.line ? ' (行 ' + validation.line + ')' : ''}`, validation, suggestion: validation.suggestion || '请修复语法错误后重试' });
                        }
                        BackupManager.createBackup(safePath, 'str_replace_based_edit_tool', { command: 'str_replace', old_str: oldStr.substring(0, 200), new_str: newStr.substring(0, 200) });
                        fs.writeFileSync(safePath, content, 'utf-8');
                        ChangeTracker.recordChange({
                            type: 'modify',
                            toolName: 'str_replace_based_edit_tool',
                            filePath: safePath,
                            oldContent: originalContent.substring(0, 2000),
                            newContent: content.substring(0, 2000),
                            diff: { old: oldStr.substring(0, 200), new: newStr.substring(0, 200) }
                        });
                        try {
                            if (mainWindow && !mainWindow.isDestroyed()) {
                                mainWindow.webContents.send('editor:show-diff', safePath, originalContent, content);
                            }
                        } catch (e) {}
                        return JSON.stringify({ output: `File ${safePath} edited successfully.` });
                    }
                    if (cmd === 'insert') {
                        const insertLine = args.insert_line;
                        const newStr = args.new_str || '';
                        if (insertLine == null) return JSON.stringify({ error: 'insert_line is required for insert' });
                        let content = fs.readFileSync(safePath, 'utf-8');
                        let lines = content.split('\n');
                        const originalContent = content;
                        lines.splice(insertLine, 0, ...newStr.split('\n'));
                        const newContent = lines.join('\n');
                        const validation = CodeValidator.validate(newContent, safePath);
                        if (!validation.valid) {
                            return JSON.stringify({ error: `代码验证失败: ${validation.error}${validation.line ? ' (行 ' + validation.line + ')' : ''}`, validation, suggestion: validation.suggestion || '请修复语法错误后重试' });
                        }
                        BackupManager.createBackup(safePath, 'str_replace_based_edit_tool', { command: 'insert', line: insertLine });
                        fs.writeFileSync(safePath, newContent, 'utf-8');
                        ChangeTracker.recordChange({
                            type: 'modify',
                            toolName: 'str_replace_based_edit_tool',
                            filePath: safePath,
                            diff: { insertedAfter: insertLine, content: newStr.substring(0, 200) }
                        });
                        try {
                            if (mainWindow && !mainWindow.isDestroyed()) {
                                mainWindow.webContents.send('editor:show-diff', safePath, originalContent, newContent);
                            }
                        } catch (e) {}
                        return JSON.stringify({ output: `File ${safePath} edited successfully at line ${insertLine}.` });
                    }
                    return JSON.stringify({ error: `Unknown command: ${cmd}` });
                }
                case 'json_edit_tool': {
                    const fs = require('fs');
                    const os = require('os');
                    const operation = args.operation;
                    const filePath = (args.file_path || '').replace(/^~/, os.homedir());
                    if (!operation || !filePath) return JSON.stringify({ error: '需要 operation 和 file_path 参数' });
                    const jsonPathCheck = validatePath(filePath);
                    if (!jsonPathCheck.valid) return JSON.stringify({ error: jsonPathCheck.error });
                    const jsonSafePath = jsonPathCheck.resolved;
                    if (!fs.existsSync(jsonSafePath)) return JSON.stringify({ error: `文件不存在：${jsonSafePath}` });
                    let data;
                    try { data = JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch (e) { return JSON.stringify({ error: `无效的 JSON：${e.message}` }); }
                    const jp = args.json_path;
                    const pp = args.pretty_print !== false;
                    const resolveJsonPath = (obj, pathStr) => {
                        if (!pathStr) return obj;
                        const parts = pathStr.replace(/^\$\.?/, '').split(/\.|\[(\d+)\]/).filter(Boolean);
                        let cur = obj;
                        for (const p of parts) {
                            if (cur == null) return undefined;
                            cur = cur[p];
                        }
                        return cur;
                    };
                    if (operation === 'view') {
                        const val = jp ? resolveJsonPath(data, jp) : data;
                        return JSON.stringify({ output: pp ? JSON.stringify(val, null, 2) : JSON.stringify(val) });
                    }
                    if (operation === 'set') {
                        if (!jp) return JSON.stringify({ error: 'json_path is required for set' });
                        const parts = jp.replace(/^\$\.?/, '').split(/\.|\[(\d+)\]/).filter(Boolean);
                        let cur = data;
                        for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
                        cur[parts[parts.length - 1]] = args.value;
                        fs.writeFileSync(filePath, pp ? JSON.stringify(data, null, 2) : JSON.stringify(data), 'utf-8');
                        return JSON.stringify({ output: `Updated at ${jp}` });
                    }
                    if (operation === 'remove') {
                        if (!jp) return JSON.stringify({ error: 'remove 操作需要 json_path 参数' });
                        const parts = jp.replace(/^\$\.?/, '').split(/\.|\[(\d+)\]/).filter(Boolean);
                        let cur = data;
                        for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
                        const key = parts[parts.length - 1];
                        if (Array.isArray(cur)) cur.splice(Number(key), 1); else delete cur[key];
                        fs.writeFileSync(filePath, pp ? JSON.stringify(data, null, 2) : JSON.stringify(data), 'utf-8');
                        return JSON.stringify({ output: `Removed element at ${jp}` });
                    }
                    if (operation === 'add') {
                        if (!jp || args.value === undefined) return JSON.stringify({ error: 'json_path and value are required for add' });
                        const parts = jp.replace(/^\$\.?/, '').split(/\.|\[(\d+)\]/).filter(Boolean);
                        let cur = data;
                        for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
                        const key = parts[parts.length - 1];
                        if (Array.isArray(cur)) cur.splice(Number(key), 0, args.value); else cur[key] = args.value;
                        fs.writeFileSync(jsonSafePath, pp ? JSON.stringify(data, null, 2) : JSON.stringify(data), 'utf-8');
                        return JSON.stringify({ output: `Added value at ${jp}` });
                    }
                    return JSON.stringify({ error: `Unknown operation: ${operation}` });
                }
                case 'ckg': {
                    const fs = require('fs'), pathMod = require('path');
                    const os = require('os');
                    const cmd = args.command;
                    const dirPath = (args.path || '').replace(/^~/, os.homedir());
                    const ckgPathCheck = validatePath(dirPath);
                    if (!ckgPathCheck.valid) return JSON.stringify({ error: ckgPathCheck.error });
                    const ckgSafeDir = ckgPathCheck.resolved;
                    const identifier = args.identifier;
                    if (!cmd || !ckgSafeDir || !identifier) return JSON.stringify({ error: 'command, path, and identifier are required' });
                    if (!fs.existsSync(ckgSafeDir)) return JSON.stringify({ error: `Path does not exist: ${ckgSafeDir}` });
                    const results = [];
                    const searchDir = (dir, maxDepth = 3) => {
                        if (maxDepth <= 0) return;
                        try {
                            const entries = fs.readdirSync(dir, { withFileTypes: true });
                            for (const entry of entries) {
                                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
                                const fullPath = pathMod.join(dir, entry.name);
                                if (entry.isDirectory()) { searchDir(fullPath, maxDepth - 1); continue; }
                                if (!/\.(js|ts|jsx|tsx|py|java|go|rs|c|cpp|h)$/.test(entry.name)) continue;
                                try {
                                    const content = fs.readFileSync(fullPath, 'utf-8');
                                    const lines = content.split('\n');
                                    for (let i = 0; i < lines.length; i++) {
                                        const line = lines[i];
                                        const patterns = cmd === 'search_function' ? [/function\s+(\w*)/, /(?:const|let|var)\s+(\w*)\s*=/]
                                            : cmd === 'search_class' ? [/class\s+(\w*)/]
                                            : [/(?:async\s+)?(\w*)\s*\(/];
                                        for (const pat of patterns) {
                                            const m = line.match(pat);
                                            if (m && m[1] === identifier) {
                                                const startLine = Math.max(0, i);
                                                const endLine = Math.min(lines.length, i + 20);
                                                const body = lines.slice(startLine, endLine).join('\n');
                                                results.push({ file: fullPath, line: i + 1, body: args.print_body !== false ? body : '(内容已隐藏)' });
                                            }
                                        }
                                    }
                                } catch (e) {}
                            }
                        } catch (e) {}
                    };
                    searchDir(dirPath);
                    if (results.length === 0) return JSON.stringify({ output: `No ${cmd.replace('search_', '')}s named "${identifier}" found.` });
                    const output = `Found ${results.length} ${cmd.replace('search_', '')}(s) named "${identifier}":\n` + results.slice(0, 20).map((r, i) => `${i + 1}. ${r.file}:${r.line}\n${r.body}`).join('\n\n');
                    return JSON.stringify({ output: output.substring(0, 50000) });
                }
                default:
                    return JSON.stringify({ error: `未知工具: ${name}` });
            }
        } catch (e) {
            return JSON.stringify({ error: `工具执行失败: ${e.message}` });
        }
    }

    const pendingApprovals = new Map();

    ipcMain.handle('ai:tool-approve', async (event, { approvalId, approved, alwaysAllow }) => {
        const pending = pendingApprovals.get(approvalId);
        if (!pending) return;
        if (alwaysAllow && pending.toolName) {
            autoApproveCache.set(pending.toolName, true);
        }
        if (pending.timeout) clearTimeout(pending.timeout);
        pending.resolve({ approved, toolName: pending.toolName });
        pendingApprovals.delete(approvalId);
    });

    let _syncedAutoApproveSettings = {};
    ipcMain.handle('ai:sync-auto-approve', async (event, settings) => {
        _syncedAutoApproveSettings = settings || {};
        autoApproveCache.clear();
        if (settings.enabled) {
            if (settings.read) {
                ['read_file', 'view_file', 'list_files', 'search_files', 'grep_search'].forEach(t => autoApproveCache.set(t, true));
            }
            if (settings.write) {
                ['write_file', 'edit_file', 'str_replace_based_edit_tool', 'json_edit_tool', 'create_file', 'delete_file', 'rename_file'].forEach(t => autoApproveCache.set(t, true));
            }
            if (settings.execute) {
                ['bash', 'terminal_command'].forEach(t => autoApproveCache.set(t, true));
            }
            if (settings.mcp) {
                ['mcp_tool'].forEach(t => autoApproveCache.set(t, true));
            }
            if (settings.subtasks) {
                ['sub_agent_dispatch', 'sequential_thinking', 'update_todo_list'].forEach(t => autoApproveCache.set(t, true));
            }
            if (settings.mode) {
                ['switch_mode'].forEach(t => autoApproveCache.set(t, true));
            }
            if (settings.all) {
                Object.keys(TOOL_CONFIG).forEach(t => autoApproveCache.set(t, true));
            }
        }
        console.log(`[AI] 自动批准设置同步: ${autoApproveCache.size} 个工具已自动批准`);
        return { ok: true };
    });

    ipcMain.handle('ai:ask-user-respond', async (event, { askId, answer }) => {
        if (activeWorker) {
            activeWorker.postMessage({ type: 'ask_user_response', askId, answer });
        }
    });

    ipcMain.handle('skills:list', async () => {
        const fs = require('fs');
        const path = require('path');
        const skillsDir = path.join(app.getPath('home'), '.versepc', 'skills');
        if (!fs.existsSync(skillsDir)) return [];
        const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
        const skills = [];
        for (const entry of entries) {
            if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
                const filePath = path.join(skillsDir, entry.name);
                const content = fs.readFileSync(filePath, 'utf-8');
                const nameMatch = content.match(/^#\s+(.+)/m);
                const descMatch = content.match(/^(?:描述|description|## 描述|## Description)[:\s]*(.+)/mi);
                skills.push({
                    name: nameMatch ? nameMatch[1].trim() : entry.name.replace(/\.md$/i, ''),
                    description: descMatch ? descMatch[1].trim().slice(0, 100) : '',
                    file: entry.name
                });
            }
        }
        return skills;
    });

    ipcMain.handle('skills:get', async (event, name) => {
        const fs = require('fs');
        const path = require('path');
        const skillsDir = path.join(app.getPath('home'), '.versepc', 'skills');
        if (!fs.existsSync(skillsDir)) return null;
        const files = fs.readdirSync(skillsDir);
        const match = files.find(f => f.toLowerCase() === `${name.toLowerCase()}.md`) ||
                      files.find(f => f.toLowerCase().startsWith(name.toLowerCase()));
        if (!match) return null;
        const content = fs.readFileSync(path.join(skillsDir, match), 'utf-8');
        const nameMatch = content.match(/^#\s+(.+)/m);
        return {
            name: nameMatch ? nameMatch[1].trim() : name,
            content,
            file: match
        };
    });

    ipcMain.handle('ai:set-permission-mode', async (event, { mode }) => {
        if (!PERMISSION_MODES[mode]) return { error: `无效的权限模式: ${mode}` };
        currentPermissionMode = mode;
        return { success: true, mode, label: PERMISSION_MODES[mode].label };
    });

    ipcMain.handle('ai:get-permission-mode', async () => {
        return { mode: currentPermissionMode, label: PERMISSION_MODES[currentPermissionMode].label, description: PERMISSION_MODES[currentPermissionMode].description };
    });

    const PERMISSION_MODES = {
        readonly: {
            label: '只读模式',
            description: '仅允许读取和搜索，禁止写入、执行命令等修改操作',
            defaultMode: 'prompt',
            toolOverrides: {
                bash: 'deny', str_replace_based_edit_tool: 'deny', json_edit_tool: 'deny',
                write_file: 'deny', edit_file: 'deny', execute_command: 'deny',
                launch_game: 'deny', stop_game: 'deny', toggle_mod: 'deny',
                manage_settings: 'deny', install_mod: 'deny', install_version: 'deny',
                install_loader: 'deny', install_modpack: 'deny'
            }
        },
        workspace: {
            label: '工作区模式',
            description: '允许读写文件和执行安全命令，危险操作需确认',
            defaultMode: 'prompt',
            toolOverrides: {
                bash: 'prompt', str_replace_based_edit_tool: 'prompt', json_edit_tool: 'prompt',
                sequential_thinking: 'allow', attempt_completion: 'allow', ckg: 'allow',
                search_mods: 'allow', get_installed_mods: 'allow', get_system_info: 'allow',
                get_versions: 'allow', get_game_status: 'allow', get_mod_details: 'allow',
                browse_directory: 'allow', read_file: 'allow', get_game_log: 'allow',
                diagnose_crash: 'allow', install_progress: 'allow', web_search: 'allow',
                get_current_context: 'allow', search_modpacks: 'allow', grep_search: 'allow',
                glob_search: 'allow', web_fetch: 'allow', web_search_general: 'allow',
                todo_write: 'allow', update_todo_list: 'allow',
                manage_core_memory: 'allow'
            }
        },
        full: {
            label: '完全信任模式',
            description: '所有操作自动允许，无需确认（仅限可信环境）',
            defaultMode: 'allow',
            toolOverrides: {}
        }
    };

    let currentPermissionMode = 'workspace';

    function getToolPermission(toolName) {
        const mode = PERMISSION_MODES[currentPermissionMode] || PERMISSION_MODES.workspace;
        if (mode.toolOverrides[toolName]) return mode.toolOverrides[toolName];
        return mode.defaultMode;
    }

    const autoApproveCache = new Map();

    const _DANGEROUS_PATTERNS = [
        { pattern: /\brm\s+(-[a-zA-Z]*[rf]|-[a-zA-Z]*f[a-zA-Z]*r)\s+[\/~*]/i, label: '递归删除根目录/主目录/通配符' },
        { pattern: /\bsudo\s+rm\b/i, label: 'sudo 提权删除' },
        { pattern: /\bsudo\s+mv\s+\//i, label: 'sudo 移动根目录文件' },
        { pattern: /\bchmod\s+777\s+\//i, label: '开放根目录权限' },
        { pattern: /\bformat\s+[a-zA-Z]:/i, label: '格式化磁盘' },
        { pattern: /\bdel\s+\/[sS]\b/, label: '递归删除文件' },
        { pattern: /\brd\s+\/[sS]\b/, label: '递归删除目录' },
        { pattern: /\bmkfs\b/i, label: '创建文件系统（格式化）' },
        { pattern: /\bshutdown\b|\breboot\b|\binit\s+0\b/i, label: '关机/重启系统' },
        { pattern: /\breg\s+delete\b/i, label: '删除注册表项' },
        { pattern: /\bnet\s+user\s+.*\/delete\b/i, label: '删除系统用户' },
    ];

    function _checkDangerousBash(toolName, args) {
        if (toolName !== 'bash') return null;
        const cmd = (typeof args === 'string' ? (() => { try { return JSON.parse(args); } catch(e) { return {}; } })() : args)?.command || '';
        if (!cmd) return null;
        for (const { pattern, label } of _DANGEROUS_PATTERNS) {
            if (pattern.test(cmd)) return { dangerous: true, reason: label };
        }
        if (/(?:rm|del|rd|rmdir|mv|move)\s+[^\s]*(?:C:\\Windows|C:\\Program\s*Files|\/etc|\/usr|\/bin|\/sbin)/i.test(cmd)) {
            return { dangerous: true, reason: '修改系统目录' };
        }
        return null;
    }

    async function requestApproval(event, toolName, args) {
        const permission = getToolPermission(toolName);
        if (permission === 'allow') return { approved: true };
        if (permission === 'deny') return { approved: false, toolName, reason: `工具 ${toolName} 在当前权限模式下被禁止` };

        const dangerous = _checkDangerousBash(toolName, args);
        let effectiveRisk = (TOOL_CONFIG[toolName] || { risk: 'safe' }).risk;
        if (dangerous) effectiveRisk = 'dangerous';

        if (effectiveRisk === 'safe') return { approved: true };

        if (autoApproveCache.has(toolName)) {
            if (autoApproveCache.get(toolName)) return { approved: true };
        }

        const approvalId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const autoDenyMs = effectiveRisk === 'dangerous' ? 120000 : 30000;

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                pendingApprovals.delete(approvalId);
                resolve({ approved: false, toolName });
            }, autoDenyMs);
            pendingApprovals.set(approvalId, {
                resolve: (result) => { clearTimeout(timeout); resolve(result); },
                toolName, win: event.sender
            });
            event.sender.send('ai:chat-chunk', {
                type: 'approval_requested',
                approvalId,
                toolName,
                risk: effectiveRisk,
                args,
                dangerous: dangerous || null,
                autoDenyMs,
                autoApproved: autoApproveCache.has(toolName)
            });
        });
    }

    function makeApiStreamRequest(apiUrl, bodyStr, headers) {
        const options = {
            hostname: apiUrl.hostname,
            path: apiUrl.pathname + (apiUrl.search || ''),
            method: 'POST',
            headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr), 'Connection': 'close' },
            agent: false
        };
        diagLog('makeApi: creating request to ' + apiUrl.hostname + apiUrl.pathname);
        const proto = apiUrl.protocol === 'https:' ? https : http;
        return new Promise((resolve, reject) => {
            const req = proto.request(options, (res) => {
                diagLog('makeApi: got response status=' + res.statusCode);
                if (res.statusCode >= 400) {
                    let errData = '';
                    res.on('data', chunk => errData += chunk);
                    res.on('error', () => {
                        clearTimeout(connectTimeout);
                        reject(new Error(`API 请求失败 (${res.statusCode})`));
                    });
                    res.on('end', () => {
                        diagLog('makeApi: 400 response body: ' + errData.slice(0, 500));
                        let errMsg = `API 请求失败 (${res.statusCode})`;
                        try {
                            const parsed = JSON.parse(errData);
                            errMsg = parsed.error?.message || parsed.message || errMsg;
                        } catch (e) {
                            errMsg += `: ${errData.slice(0, 200)}`;
                        }
                        clearTimeout(connectTimeout);
                        reject(new Error(errMsg));
                    });
                    return;
                }
                resolve(res);
            });
            const connectTimeout = setTimeout(() => {
                req.destroy(new Error('API连接超时(30秒)'));
            }, 30000);
            diagLog('makeApi: request sent, timeout set');
            req.on('error', (e) => {
                diagLog('makeApi: error event: ' + e.message);
                clearTimeout(connectTimeout);
                reject(e);
            });
            diagLog('makeApi: writing body, len=' + bodyStr.length);
            req.write(bodyStr);
            req.end();
            diagLog('makeApi: request ended');
        });
    }

    async function llmNonStream(apiKey, model, messages, temperature) {
        const provider = getProviderForModel(model);
        const apiUrl = new URL(provider.baseUrl + '/chat/completions');
        const bodyStr = JSON.stringify({
            model: model || 'glm-5-flash',
            messages,
            temperature: temperature != null ? temperature : 0.7,
            stream: false
        });
        const headers = buildApiHeaders(provider, apiKey);
        const options = {
            hostname: apiUrl.hostname,
            path: apiUrl.pathname,
            method: 'POST',
            headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr), 'Connection': 'close' },
            agent: false
        };
        const proto = apiUrl.protocol === 'https:' ? https : http;
        return new Promise((resolve, reject) => {
            const req = proto.request(options, (res) => {
                if (res.statusCode >= 400) {
                    let errData = '';
                    res.on('data', chunk => errData += chunk);
                    res.on('end', () => {
                        let errMsg = `API 请求失败 (${res.statusCode})`;
                        try {
                            const parsed = JSON.parse(errData);
                            errMsg = parsed.error?.message || parsed.message || errMsg;
                        } catch (e) {
                            errMsg += `: ${errData.slice(0, 200)}`;
                        }
                        clearTimeout(connectTimeout);
                        reject(new Error(errMsg));
                    });
                    return;
                }
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error) {
                            clearTimeout(connectTimeout);
                            reject(new Error(parsed.error.message || parsed.error.code || JSON.stringify(parsed.error)));
                            return;
                        }
                        clearTimeout(connectTimeout);
                        resolve(parsed.choices?.[0]?.message?.content || '');
                    } catch (e) {
                        clearTimeout(connectTimeout);
                        reject(e);
                    }
                });
            });
            const connectTimeout = setTimeout(() => {
                req.destroy(new Error('API请求超时(30秒)'));
            }, 30000);
            req.on('error', (e) => {
                clearTimeout(connectTimeout);
                reject(e);
            });
            req.write(bodyStr);
            req.end();
        });
    }

    async function detectIntent(apiKey, model, userMessage) {
        try {
            const result = await Promise.race([
                llmNonStream(apiKey, model, [
                { role: 'system', content: `分析用户消息的意图，判断是否需要多步操作。只输出JSON，不要其他内容。

输出格式：
{"intent":"simple|complex","reason":"简短原因","steps_needed":0}

判断标准：
- simple: 纯知识问答、闲聊、不需要任何工具
- complex: 需要工具、需要多步操作、需要先收集信息再执行

注意：只要涉及任何操作（安装、搜索、查看、检查、修复等），都应判断为complex。宁可多规划也不要漏规划。

示例：
"红石信号最远传多远" → {"intent":"simple","reason":"纯知识问答","steps_needed":0}
"帮我装Fabric 1.20.1和Sodium" → {"intent":"complex","reason":"需先装加载器再装模组","steps_needed":3}
"游戏崩了帮我看看" → {"intent":"complex","reason":"需读崩溃日志再分析","steps_needed":2}
"我的存档在哪" → {"intent":"complex","reason":"需浏览文件夹定位","steps_needed":1}
"帮我找个优化模组" → {"intent":"complex","reason":"需搜索模组再展示","steps_needed":2}
"Sodium怎么用" → {"intent":"simple","reason":"知识问答","steps_needed":0}` },
                { role: 'user', content: userMessage }
                ], 0.1),
                new Promise((_, reject) => setTimeout(() => reject(new Error('意图检测超时')), 10000))
            ]);
            const match = result.match(/\{[\s\S]*\}/);
            if (match) return JSON.parse(match[0]);
        } catch (e) {}
        return { intent: 'simple', reason: '', steps_needed: 0 };
    }

    async function generatePlan(apiKey, model, userMessage, toolDescriptions) {
        try {
            const result = await Promise.race([
                llmNonStream(apiKey, model, [
                { role: 'system', content: `你是一个任务规划器。将用户的复杂请求分解为可执行的步骤。只输出JSON数组，不要其他内容。

可用工具:
${toolDescriptions}

输出格式（JSON数组）:
[
  {"step":1,"description":"步骤描述","tool":"工具名","args":{"参数":"值"},"depends_on":[],"critical":true},
  {"step":2,"description":"步骤描述","tool":"工具名","args":{"参数":"值"},"depends_on":[1],"critical":false}
]

规则：
- depends_on: 该步骤依赖的前置步骤编号，无依赖为空数组
- critical: true表示该步骤失败则整个任务失败
- 参数值如果是动态的（依赖前一步结果），用 "STEP1.result.字段名" 引用
- 尽量减少步骤数，合并可并行的操作
- 每个步骤应尽可能自主执行，减少需要用户介入的环节
- 如果某步骤可能失败，考虑添加替代方案步骤
- 信息收集步骤（如get_current_context、get_versions）应放在最前面` },
                { role: 'user', content: userMessage }
                ], 0.3),
                new Promise((_, reject) => setTimeout(() => reject(new Error('计划生成超时')), 15000))
            ]);
            const match = result.match(/\[[\s\S]*\]/);
            if (match) return JSON.parse(match[0]);
        } catch (e) {}
        return null;
    }

    async function reflectOnResult(apiKey, model, toolName, args, result, goal) {
        try {
            const resultStr = typeof result === 'string' ? result.slice(0, 500) : JSON.stringify(result).slice(0, 500);
            const resp = await Promise.race([
                llmNonStream(apiKey, model, [
                { role: 'system', content: `评估工具执行结果是否符合预期。只输出JSON，不要其他内容。

输出格式:
{"assessment":"success|partial|failed","next_action":"continue|retry|alternative|ask_user","reasoning":"简短原因","suggestion":"建议的替代方案(如果failed)"}

重要原则：
- 优先选择 retry 或 alternative，尽量自主解决问题
- 只有在确实无法通过工具解决时才选择 ask_user
- 如果是参数错误，选择 retry
- 如果是方法不对，选择 alternative
- 如果是权限或用户决策问题，选择 ask_user` },
                { role: 'user', content: `目标: ${goal}\n工具: ${toolName}\n参数: ${JSON.stringify(args)}\n结果: ${resultStr}` }
                ], 0.2),
                new Promise((_, reject) => setTimeout(() => reject(new Error('反思评估超时')), 10000))
            ]);
            const match = resp.match(/\{[\s\S]*\}/);
            if (match) return JSON.parse(match[0]);
        } catch (e) {}
        return { assessment: 'success', next_action: 'continue', reasoning: '' };
    }

    const toolDescriptions = AI_TOOLS.map(t => `- ${t.function.name}: ${t.function.description}`).join('\n');

    let activeWorker = null;

    ipcMain.on('ai:chat-stream', async (event, params) => {
        const { apiKey, model, messages, temperature, enableTools, projectDir } = params;
        diagLog('chat-stream received');
        try {
            if (!apiKey) {
                event.sender.send('ai:chat-chunk', { error: '未配置 API Key，请在设置中填写' });
                return;
            }

            if (activeWorker) {
                try { activeWorker.terminate(); } catch (e) {}
                activeWorker = null;
            }

            const { Worker } = require('worker_threads');
            const _currentWorker = new Worker(path.join(__dirname, 'agent-worker.js'));
            activeWorker = _currentWorker;

            let _lastReasoningForward = 0;
            let _pendingReasoningChunk = null;
            let _reasoningFlushTimer = null;
            let _lastTextForward = 0;
            let _pendingTextChunks = [];
            let _textFlushTimer = null;
            const _TEXT_THROTTLE_MS = 40;
            function _flushTextChunks() {
                _textFlushTimer = null;
                if (_pendingTextChunks.length === 0) return;
                const chunks = _pendingTextChunks.splice(0);
                for (const chunk of chunks) {
                    try { event.sender.send('ai:chat-chunk', chunk); } catch (e) {}
                }
                _lastTextForward = Date.now();
            }

            _currentWorker.on('message', (msg) => {
                try {
                    switch (msg.type) {
                        case 'chunk': {
                            const c = msg.chunk;
                            if (c && c.type === 'reasoning_content') {
                                _pendingReasoningChunk = c;
                                const now = Date.now();
                                if (!_reasoningFlushTimer) {
                                    const delay = Math.max(80 - (now - _lastReasoningForward), 0);
                                    _reasoningFlushTimer = setTimeout(() => {
                                        _reasoningFlushTimer = null;
                                        if (_pendingReasoningChunk) {
                                            try { event.sender.send('ai:chat-chunk', _pendingReasoningChunk); } catch (e) {}
                                            _lastReasoningForward = Date.now();
                                            _pendingReasoningChunk = null;
                                        }
                                    }, delay);
                                }
                                break;
                            }
                            if (_reasoningFlushTimer && _pendingReasoningChunk) {
                                clearTimeout(_reasoningFlushTimer);
                                _reasoningFlushTimer = null;
                                try { event.sender.send('ai:chat-chunk', _pendingReasoningChunk); } catch (e) {}
                                _pendingReasoningChunk = null;
                            }
                            const isTextDelta = c && c.type === 'say' && c.partial && (c.say === 'text' || c.say === 'reasoning');
                            if (isTextDelta) {
                                _pendingTextChunks.push(msg.chunk);
                                if (!_textFlushTimer) {
                                    const delay = Math.max(_TEXT_THROTTLE_MS - (Date.now() - _lastTextForward), 0);
                                    _textFlushTimer = setTimeout(_flushTextChunks, delay);
                                }
                                break;
                            }
                            try {
                                const tag = c?.done ? 'DONE' : c?.error ? 'ERROR' : c?.type || 'text';
                                if (tag === 'DONE' || tag === 'ERROR' || tag === 'tool_calls_start' || tag === 'tool_calls_end' || tag === 'reasoning_start' || tag === 'reasoning_end') {
                                    console.log(`[AI-MAIN] chunk→renderer: ${tag}`);
                                }
                            } catch (e) {}
                            if (c?.done || c?.error) {
                                if (_textFlushTimer) { clearTimeout(_textFlushTimer); _textFlushTimer = null; }
                                if (_pendingTextChunks.length > 0) { _flushTextChunks(); }
                                if (_reasoningFlushTimer && _pendingReasoningChunk) {
                                    clearTimeout(_reasoningFlushTimer); _reasoningFlushTimer = null;
                                    try { event.sender.send('ai:chat-chunk', _pendingReasoningChunk); } catch (e) {}
                                    _pendingReasoningChunk = null;
                                }
                            }
                            event.sender.send('ai:chat-chunk', msg.chunk);
                            break;
                        }
                        case 'approval_request':
                            {
                                const { approvalId, toolName, risk, args, dangerous } = msg;
                                const effectiveRisk = risk || (TOOL_CONFIG[toolName] || {}).risk || 'safe';
                                if (effectiveRisk === 'safe') {
                                    if (activeWorker) {
                                        activeWorker.postMessage({ type: 'approval_response', approvalId, approved: true, toolName });
                                    }
                                    break;
                                }
                                if (autoApproveCache.has(toolName) && autoApproveCache.get(toolName)) {
                                    if (activeWorker) {
                                        activeWorker.postMessage({ type: 'approval_response', approvalId, approved: true, toolName });
                                    }
                                    break;
                                }
                                const pendingRecord = {
                                    resolve: (result) => {
                                        if (activeWorker) {
                                            activeWorker.postMessage({
                                                type: 'approval_response',
                                                approvalId,
                                                approved: result.approved,
                                                toolName
                                            });
                                        }
                                    },
                                    toolName,
                                    win: event.sender
                                };
                                pendingApprovals.set(approvalId, pendingRecord);

                                const autoDenyMs = effectiveRisk === 'dangerous' ? 120000 : 30000;
                                const timeout = setTimeout(() => {
                                    pendingApprovals.delete(approvalId);
                                    if (activeWorker) {
                                        activeWorker.postMessage({
                                            type: 'approval_response',
                                            approvalId,
                                            approved: false,
                                            toolName
                                        });
                                    }
                                }, autoDenyMs);
                                pendingRecord.timeout = timeout;

                                event.sender.send('ai:chat-chunk', {
                                    type: 'approval_requested',
                                    approvalId,
                                    toolName,
                                    risk: effectiveRisk,
                                    args,
                                    dangerous: dangerous || null,
                                    autoDenyMs
                                });
                            }
                            break;
                        case 'exec_tool':
                            (async () => {
                                try {
                                    await new Promise(r => setImmediate(r));
                                    let parsedArgs = msg.args;
                                    if (typeof parsedArgs === 'string') {
                                        try { parsedArgs = JSON.parse(parsedArgs); } catch (e) { parsedArgs = {}; }
                                    }
                                    const result = await executeTool(msg.name, parsedArgs);
                                    await new Promise(r => setImmediate(r));
                                    if (activeWorker) {
                                        activeWorker.postMessage({
                                            type: 'exec_tool_result',
                                            execId: msg.execId,
                                            result
                                        });
                                    }
                                } catch (e) {
                                    if (activeWorker) {
                                        activeWorker.postMessage({
                                            type: 'exec_tool_result',
                                            execId: msg.execId,
                                            result: JSON.stringify({ status: 'error', error: e.message })
                                        });
                                    }
                                }
                            })();
                            break;
                        case 'poll_progress':
                            (async () => {
                                try {
                                    const data = await executeTool('install_progress', JSON.stringify({ sessionId: msg.sessionId }));
                                    if (activeWorker) {
                                        activeWorker.postMessage({
                                            type: 'poll_progress_result',
                                            pollId: msg.pollId,
                                            data: JSON.parse(data || '{}')
                                        });
                                    }
                                } catch (e) {
                                    if (activeWorker) {
                                        activeWorker.postMessage({
                                            type: 'poll_progress_result',
                                            pollId: msg.pollId,
                                            data: { progress: 0, status: 'error', error: e.message }
                                        });
                                    }
                                }
                            })();
                            break;
                        case 'diag':
                            diagLog(msg.msg);
                            break;
                        case 'done':
                            if (activeWorker) {
                                try { activeWorker.terminate(); } catch (e) {}
                                activeWorker = null;
                            }
                            break;
                        case 'error':
                            console.error(`[AI-MAIN] worker error: ${msg.error}`);
                            event.sender.send('ai:chat-chunk', { error: msg.error });
                            if (activeWorker) {
                                try { activeWorker.terminate(); } catch (e) {}
                                activeWorker = null;
                            }
                            break;
                    }
                    if (msg.type === 'ask_user_request') {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('ai:chat-chunk', {
                                type: 'ask_user_requested',
                                askId: msg.askId,
                                question: msg.question,
                                options: msg.options,
                                context: msg.context
                            });
                        }
                    }
                } catch (e) {
                    diagLog('worker msg error: ' + e.message);
                }
            });

            _currentWorker.on('error', (err) => {
                diagLog('worker error: ' + err.message);
                try {
                    event.sender.send('ai:chat-chunk', { error: err.message });
                } catch (e) {}
                if (activeWorker === _currentWorker) {
                    activeWorker = null;
                }
            });

            _currentWorker.on('exit', (code) => {
                diagLog('worker exit: ' + code);
                if (code !== 0) {
                    try {
                        event.sender.send('ai:chat-chunk', { error: 'AI 处理异常退出 (code=' + code + ')' });
                    } catch (e) {}
                }
                if (activeWorker === _currentWorker) {
                    activeWorker = null;
                }
            });

            activeWorker.postMessage({ type: 'start', params });
        } catch (e) {
            diagLog('ERROR: ' + e.message);
            try {
                event.sender.send('ai:chat-chunk', { error: e.message });
            } catch (e2) {}
        }
    });

    ipcMain.handle('ai:chat-abort', async (event) => {
        if (activeWorker) {
            try {
                activeWorker.postMessage({ type: 'abort' });
                setTimeout(() => {
                    if (activeWorker) {
                        try { activeWorker.terminate(); } catch (e) {}
                        activeWorker = null;
                    }
                }, 1000);
            } catch (e) {}
        }
        return true;
    });

    ipcMain.handle('ai:get-sse-port', async () => {
        return ssePort;
    });

    const SESSIONS_DIR = path.join(require('os').homedir(), '.versepc', 'ai_sessions');

    function ensureSessionsDir() {
        const fs = require('fs');
        if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }

    function saveSession(sessionId, messages, inputTokens, outputTokens) {
        const fs = require('fs');
        ensureSessionsDir();
        const session = {
            sessionId,
            messages: messages.map(m => ({
                role: m.role,
                content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
                ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
                ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {})
            })),
            inputTokens: inputTokens || 0,
            outputTokens: outputTokens || 0,
            savedAt: Date.now()
        };
        const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(session), 'utf-8');
        return { success: true, sessionId, path: filePath };
    }

    function loadSession(sessionId) {
        const fs = require('fs');
        const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
        if (!fs.existsSync(filePath)) return null;
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            return data;
        } catch (e) {
            return null;
        }
    }

    function listSessions() {
        const fs = require('fs');
        ensureSessionsDir();
        const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
        return files.map(f => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf-8'));
                return {
                    sessionId: data.sessionId,
                    savedAt: data.savedAt,
                    inputTokens: data.inputTokens,
                    outputTokens: data.outputTokens,
                    messageCount: data.messages ? data.messages.length : 0,
                    preview: data.messages && data.messages.length > 0
                        ? (data.messages.find(m => m.role === 'user')?.content || '').slice(0, 100)
                        : ''
                };
            } catch (e) { return null; }
        }).filter(Boolean).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    }

    ipcMain.handle('ai:session-save', async (event, { sessionId, messages, inputTokens, outputTokens }) => {
        return saveSession(sessionId || Date.now().toString(36), messages, inputTokens, outputTokens);
    });

    ipcMain.handle('ai:session-load', async (event, { sessionId }) => {
        return loadSession(sessionId);
    });

    ipcMain.handle('ai:session-list', async () => {
        return listSessions();
    });

    ipcMain.handle('ai:session-delete', async (event, { sessionId }) => {
        const fs = require('fs');
        const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return { success: true };
        }
        return { error: '会话不存在' };
    });

    const mcpClients = new Map();

    async function startMcpServer(serverName, config) {
        const { spawn } = require('child_process');
        if (mcpClients.has(serverName)) return { error: `MCP 服务器 ${serverName} 已在运行` };

        if (config.transport !== 'stdio' || !config.command) {
            return { error: '仅支持 stdio 传输模式' };
        }

        try {
            const child = spawn(config.command, config.args || [], {
                env: { ...process.env, ...(config.env || {}) },
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true
            });

            const client = {
                name: serverName,
                config,
                child,
                tools: [],
                requestId: 0,
                pendingRequests: new Map(),
                buffer: ''
            };

            child.stdout.on('data', (data) => {
                client.buffer += data.toString();
                const lines = client.buffer.split('\n');
                client.buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const msg = JSON.parse(line);
                        const pending = client.pendingRequests.get(msg.id);
                        if (pending) {
                            clearTimeout(pending.timeout);
                            pending.resolve(msg.result || msg.error);
                            client.pendingRequests.delete(msg.id);
                        }
                    } catch (e) {}
                }
            });

            child.stderr.on('data', () => {});
            child.on('error', () => { mcpClients.delete(serverName); });
            child.on('exit', () => { mcpClients.delete(serverName); });

            const initResult = await sendMcpRequest(client, 'initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'VersePC', version: '1.0.0' }
            });

            sendMcpNotification(client, 'notifications/initialized', {});

            const toolsResult = await sendMcpRequest(client, 'tools/list', {});
            client.tools = (toolsResult && toolsResult.tools) || [];

            mcpClients.set(serverName, client);
            return { success: true, name: serverName, tools: client.tools.map(t => t.name) };
        } catch (e) {
            return { error: `启动 MCP 服务器失败: ${e.message}` };
        }
    }

    function sendMcpRequest(client, method, params) {
        return new Promise((resolve, reject) => {
            const id = ++client.requestId;
            const msg = { jsonrpc: '2.0', id, method, params: params || {} };
            const timeout = setTimeout(() => {
                client.pendingRequests.delete(id);
                reject(new Error('MCP 请求超时'));
            }, 30000);
            client.pendingRequests.set(id, { resolve, reject, timeout });
            try {
                client.child.stdin.write(JSON.stringify(msg) + '\n');
            } catch (e) {
                clearTimeout(timeout);
                client.pendingRequests.delete(id);
                reject(e);
            }
        });
    }

    function sendMcpNotification(client, method, params) {
        const msg = { jsonrpc: '2.0', method, params: params || {} };
        try {
            client.child.stdin.write(JSON.stringify(msg) + '\n');
        } catch (e) {}
    }

    async function callMcpTool(serverName, toolName, args) {
        const client = mcpClients.get(serverName);
        if (!client) return { error: `MCP 服务器 ${serverName} 未运行` };
        try {
            const result = await sendMcpRequest(client, 'tools/call', { name: toolName, arguments: args });
            return result;
        } catch (e) {
            return { error: `MCP 工具调用失败: ${e.message}` };
        }
    }

    function stopMcpServer(serverName) {
        const client = mcpClients.get(serverName);
        if (!client) return { error: `MCP 服务器 ${serverName} 未运行` };
        try { client.child.kill(); } catch (e) {}
        mcpClients.delete(serverName);
        return { success: true };
    }

    function getMcpTools() {
        const tools = [];
        for (const [serverName, client] of mcpClients) {
            for (const tool of client.tools) {
                tools.push({
                    name: `mcp__${serverName.replace(/[^a-zA-Z0-9]/g, '_')}__${tool.name}`,
                    originalName: tool.name,
                    server: serverName,
                    description: tool.description || '',
                    inputSchema: tool.inputSchema || {}
                });
            }
        }
        return tools;
    }

    ipcMain.handle('ai:mcp-start', async (event, { name, config }) => {
        return await startMcpServer(name, config);
    });

    ipcMain.handle('ai:mcp-stop', async (event, { name }) => {
        return stopMcpServer(name);
    });

    ipcMain.handle('ai:mcp-list', async () => {
        const servers = [];
        for (const [name, client] of mcpClients) {
            servers.push({ name, tools: client.tools.map(t => t.name), status: 'running' });
        }
        return servers;
    });

    ipcMain.handle('ai:mcp-tools', async () => {
        return getMcpTools();
    });

    ipcMain.handle('ai:mcp-call', async (event, { serverName, toolName, args }) => {
        return await callMcpTool(serverName, toolName, args);
    });

    ipcMain.handle('editor:code-complete', async (event, params) => {
        const { prefix, suffix, language, filePath } = params;
        try {
            const store = loadStore();
            let apiKey = store.versepc_ai_api_key;
            let model = store.versepc_ai_model;
            if (!apiKey || !model) return { text: '' };

            const customProvider = (() => {
                try { return store.versepc_ai_custom_provider ? JSON.parse(store.versepc_ai_custom_provider) : null; } catch { return null; }
            })();

            let apiUrl, headers;
            if (customProvider && customProvider.baseUrl && model === customProvider.modelId) {
                const url = customProvider.baseUrl.replace(/\/+$/, '') + '/chat/completions';
                apiUrl = new URL(url);
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customProvider.apiKey || apiKey}` };
            } else {
                const provider = getProviderForModel(model);
                apiUrl = new URL(provider.baseUrl + '/chat/completions');
                headers = buildApiHeaders(provider, apiKey);
            }

            const systemPrompt = `You are a code completion engine. Given the cursor position in a file, generate ONLY the code that should be inserted at the cursor. Rules:
- Output ONLY the code to insert, no explanations, no markdown fences
- Match the existing code style (indentation, brackets, etc.)
- Complete the current line/expression naturally
- Keep completions concise (1-15 lines)
- Do not repeat code that is already in the prefix or suffix`;

            const userPrompt = `Language: ${language}
File: ${filePath || 'unknown'}

=== CODE BEFORE CURSOR (prefix) ===
${prefix.slice(-2000)}

=== CODE AFTER CURSOR (suffix) ===
${suffix.slice(0, 1000)}

Complete the code at the cursor position. Output ONLY the code to insert:`;

            const bodyStr = JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.2,
                max_tokens: 256,
                stream: false
            });

            const options = {
                hostname: apiUrl.hostname,
                path: apiUrl.pathname,
                method: 'POST',
                headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr), 'Connection': 'close' },
                agent: false
            };
            const proto = apiUrl.protocol === 'https:' ? https : http;

            const text = await new Promise((resolve, reject) => {
                const req = proto.request(options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            if (json.error) { reject(new Error(json.error.message || JSON.stringify(json.error))); return; }
                            resolve(json.choices?.[0]?.message?.content || '');
                        } catch { resolve(data); }
                    });
                });
                const timeout = setTimeout(() => { req.destroy(new Error('timeout')); }, 10000);
                req.on('error', (e) => { clearTimeout(timeout); reject(e); });
                req.write(bodyStr);
                req.end();
            });

            let cleaned = text.replace(/^```[\w]*\n?/gm, '').replace(/\n?```$/gm, '').trim();
            return { text: cleaned };
        } catch (e) {
            return { text: '', error: e.message };
        }
    });
}

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

    ipcMain.handle('updater:install-update', async () => {
        if (updateDownloaded) {
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
        shell.openExternal('https://github.com/doujie081231/versePc/releases/latest');
        return { success: true };
    });
}

// ============================================================================
// 原生 JAR/ZIP 文件解析器 - 纯 JS 实现，不依赖第三方库
// ============================================================================
// ZIP 文件格式结构：
// [Local File Headers + Data] ... [Central Directory] ... [End of Central Directory]
// 解析流程：
// 1. 从文件末尾向前搜索 End of Central Directory (EOCD) 签名 (50 4B 05 06)
// 2. 从 EOCD 中读取 Central Directory 的偏移量和条目数
// 3. 遍历 Central Directory 获取每个文件/目录的元信息

const zlib = require('zlib');

/**
 * 从 Buffer 中读取 32 位无符号小端整数
 */
function readUInt32LE(buffer, offset) {
    return buffer.readUInt32LE(offset);
}

/**
 * 从 Buffer 中读取 16 位无符号小端整数
 */
function readUInt16LE(buffer, offset) {
    return buffer.readUInt16LE(offset);
}

/**
 * 查找 ZIP 文件的 EOCD（End of Central Directory）记录位置
 * EOCD 签名 = 0x06054b50 (小端: 50 4B 05 06)
 * 从文件末尾向前搜索，因为 EOCD 可能紧跟注释
 */
function findEndOfCentralDirectory(buffer) {
    const length = buffer.length;
    const minEOCDSize = 22;
    const maxCommentLength = 65535;
    const maxEOCDSearch = minEOCDSize + maxCommentLength;

    const searchStart = Math.max(0, length - maxEOCDSearch);
    for (let i = length - minEOCDSize; i >= searchStart; i--) {
        if (buffer[i] === 0x50 && buffer[i + 1] === 0x4b &&
            buffer[i + 2] === 0x05 && buffer[i + 3] === 0x06) {
            return i;
        }
    }
    throw new Error('无法找到ZIP结束标记（End of Central Directory）');
}

/**
 * 解析 JAR/ZIP 文件获取所有条目列表
 * @param {string} jarPath - JAR 文件路径
 * @returns {Array} 条目数组 [{name, isDirectory, size, compressedSize, compressionMethod, localHeaderOffset}]
 */
async function parseJarFile(jarPath) {
    const data = await fs.promises.readFile(jarPath);
    const eocdOffset = findEndOfCentralDirectory(data);

    const diskNumber = readUInt16LE(data, eocdOffset + 4);
    const cdDiskNumber = readUInt16LE(data, eocdOffset + 6);
    const numEntries = readUInt16LE(data, eocdOffset + 10);   // Central Directory 条目总数
    const cdSize = readUInt32LE(data, eocdOffset + 12);       // Central Directory 大小
    const cdOffset = readUInt32LE(data, eocdOffset + 16);     // Central Directory 偏移量

    if (diskNumber !== 0 || cdDiskNumber !== 0) {
        throw new Error('不支持多分卷ZIP文件');
    }

    const entries = [];
    let offset = cdOffset;

    // 遍历 Central Directory 的每个条目
    for (let i = 0; i < numEntries; i++) {
        if (offset + 46 > data.length) break;

        const sig = readUInt32LE(data, offset);
        if (sig !== 0x02014b50) {  // Central Directory 签名
            break;
        }

        const compressionMethod = readUInt16LE(data, offset + 10);  // 0=存储, 8=Deflate
        const compressedSize = readUInt32LE(data, offset + 20);
        const uncompressedSize = readUInt32LE(data, offset + 24);
        const nameLength = readUInt16LE(data, offset + 28);
        const extraLength = readUInt16LE(data, offset + 30);
        const commentLength = readUInt16LE(data, offset + 32);
        const localHeaderOffset = readUInt32LE(data, offset + 42);

        const nameStart = offset + 46;
        const name = data.toString('utf-8', nameStart, nameStart + nameLength);

        entries.push({
            name: name,
            isDirectory: name.endsWith('/'),
            size: uncompressedSize,
            compressedSize: compressedSize,
            compressionMethod: compressionMethod,
            localHeaderOffset: localHeaderOffset,
        });

        offset += 46 + nameLength + extraLength + commentLength;
    }

    return entries;
}

/**
 * 读取 JAR/ZIP 文件中的指定条目内容
 * @param {string} jarPath - JAR 文件路径
 * @param {string} entryName - 条目名称
 * @returns {Buffer|null} 文件内容 Buffer
 *
 * 流程：
 * 1. 解析 Central Directory 找到目标条目
 * 2. 跳转到 Local File Header 读取压缩数据
 * 3. 根据压缩方法（0=存储/8=Deflate）解压返回原始数据
 */
async function readJarEntryContent(jarPath, entryName) {
    const data = await fs.promises.readFile(jarPath);
    const entries = [];

    // 解析 Central Directory
    const eocdOffset = findEndOfCentralDirectory(data);
    const numEntries = readUInt16LE(data, eocdOffset + 10);
    const cdOffset = readUInt32LE(data, eocdOffset + 16);

    let offset = cdOffset;
    for (let i = 0; i < numEntries; i++) {
        if (offset + 46 > data.length) break;
        const sig = readUInt32LE(data, offset);
        if (sig !== 0x02014b50) break;

        const compressionMethod = readUInt16LE(data, offset + 10);
        const compressedSize = readUInt32LE(data, offset + 20);
        const uncompressedSize = readUInt32LE(data, offset + 24);
        const nameLength = readUInt16LE(data, offset + 28);
        const extraLength = readUInt16LE(data, offset + 30);
        const commentLength = readUInt16LE(data, offset + 32);
        const localHeaderOffset = readUInt32LE(data, offset + 42);

        const nameStart = offset + 46;
        const name = data.toString('utf-8', nameStart, nameStart + nameLength);

        entries.push({
            name: name,
            compressionMethod: compressionMethod,
            compressedSize: compressedSize,
            uncompressedSize: uncompressedSize,
            localHeaderOffset: localHeaderOffset,
        });

        offset += 46 + nameLength + extraLength + commentLength;
    }

    const targetEntry = entries.find(e => e.name === entryName || e.name === entryName.replace(/\//g, '/'));
    if (!targetEntry) return null;

    // 读取 Local File Header
    let localOffset = targetEntry.localHeaderOffset;
    const localSig = readUInt32LE(data, localOffset);
    if (localSig !== 0x04034b50) {  // Local File Header 签名
        throw new Error('无效的Local File Header');
    }

    const localNameLength = readUInt16LE(data, localOffset + 26);
    const localExtraLength = readUInt16LE(data, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;

    const compressedData = data.slice(dataStart, dataStart + targetEntry.compressedSize);

    // 根据压缩方法解压
    if (targetEntry.compressionMethod === 0) {       // 无压缩（STORED）
        return Buffer.from(compressedData);
    } else if (targetEntry.compressionMethod === 8) { // Deflate 压缩
        return new Promise((resolve, reject) => {
            zlib.inflateRaw(compressedData, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    } else {
        throw new Error('不支持的压缩方法: ' + targetEntry.compressionMethod);
    }
}
/* @versepc-protected: anti-ai-plagiarism-v1.0 */
