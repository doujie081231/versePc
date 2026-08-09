/**
 * server/terracotta.js - Terracotta LAN 多人联机模块
 * ============================================================================
 * 从 server.js 抽取的 Terracotta LAN 多人联机相关函数。
 * 通过 ctx (./context) 访问共享状态，通过 utils (./utils) 访问工具函数。
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const os = require('os');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');

const ctx = require('./context');
const utils = require('./utils');

// ============================================================================
// 日志拦截
// ============================================================================

function _terracottaWriteLog(level, args) {
    try {
        const ts = new Date().toLocaleString('zh-CN', { hour12: false });
        const msg = args.map(a => (typeof a === 'string') ? a : JSON.stringify(a)).join(' ');
        const line = `[${ts}] [${level}] ${msg}\n`;
        if (fs.existsSync(ctx.dirs.TERRACOTTA_LOG_FILE)) {
            const stat = fs.statSync(ctx.dirs.TERRACOTTA_LOG_FILE);
            if (stat.size > 512000) {
                const content = fs.readFileSync(ctx.dirs.TERRACOTTA_LOG_FILE, 'utf8');
                const lines = content.split('\n');
                const keep = lines.slice(Math.floor(lines.length / 2));
                fs.writeFileSync(ctx.dirs.TERRACOTTA_LOG_FILE, keep.join('\n'), 'utf8');
            }
        }
        fs.appendFileSync(ctx.dirs.TERRACOTTA_LOG_FILE, line, 'utf8');
    } catch (_) {}
}

function _terracottaIntercept(level, origFn) {
    return function (...args) {
        origFn.apply(console, args);
        if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('[Terracotta]')) {
            _terracottaWriteLog(level, args);
        }
    };
}

// ============================================================================
// 邀请码 / 网络密钥 / 房间码
// ============================================================================

function generateInvitationCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let segments = [];
    for (let s = 0; s < 4; s++) {
        let seg = '';
        const bytes = crypto.randomBytes(4);
        for (let i = 0; i < 4; i++) seg += chars[bytes[i] % chars.length];
        segments.push(seg);
    }
    return segments.join('-');
}

function generateNetworkSecret() {
    const bytes = crypto.randomBytes(16);
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let secret = '';
    for (let i = 0; i < 16; i++) secret += chars[bytes[i] % chars.length];
    return secret;
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.randomBytes(6);
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[bytes[i] % chars.length];
    return code;
}

// ============================================================================
// 组件安装与路径
// ============================================================================

function getTerracottaBinaryPath() {
    const exeName = process.platform === 'win32' ? 'terracotta.exe' : 'terracotta';
    const devPath = path.join(ctx.dirs.TERRACOTTA_DIR, exeName);
    if (!__dirname.includes('app.asar') && fs.existsSync(devPath)) return devPath;
    return path.join(ctx.dirs.TERRACOTTA_DATA_DIR, exeName);
}

function isTerracottaInstalled() {
    return fs.existsSync(getTerracottaBinaryPath());
}

async function ensureTerracottaInstalled() {
    if (isTerracottaInstalled()) return true;
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';
    const isLinux = process.platform === 'linux';
    const arch = process.arch === 'arm64' ? (isMac ? 'macos-arm64' : 'linux-arm64') : (isWin ? 'windows-x86_64' : (isMac ? 'macos-arm64' : 'linux-x86_64'));
    const pkgName = `terracotta-${ctx.network.TERRACOTTA_VERSION}-${arch}-pkg.tar.gz`;
    const exeName = isWin ? 'terracotta.exe' : 'terracotta';
    const TERRACOTTA_URLS = [
        `https://gitee.com/burningtnt/Terracotta/releases/download/v${ctx.network.TERRACOTTA_VERSION}/${pkgName}`,
        `https://cnb.cool/HMCL-Terracotta/Terracotta/-/releases/download/v${ctx.network.TERRACOTTA_VERSION}/${pkgName}`,
        `https://cdn.jsdelivr.net/gh/burningtnt/Terracotta@v${ctx.network.TERRACOTTA_VERSION}/${pkgName}`,
        `https://ghfast.top/https://github.com/burningtnt/Terracotta/releases/download/v${ctx.network.TERRACOTTA_VERSION}/${pkgName}`,
        `https://mirror.ghproxy.com/https://github.com/burningtnt/Terracotta/releases/download/v${ctx.network.TERRACOTTA_VERSION}/${pkgName}`,
        `https://github.com/burningtnt/Terracotta/releases/download/v${ctx.network.TERRACOTTA_VERSION}/${pkgName}`
    ];
    const binPath = getTerracottaBinaryPath();
    const binDir = path.dirname(binPath);
    if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
    for (let i = 0; i < TERRACOTTA_URLS.length; i++) {
        const url = TERRACOTTA_URLS[i];
        try {
            const resp = await fetch(url);
            if (!resp.ok) { console.warn(`[Terracotta] 下载失败 HTTP ${resp.status}: ${url}`); continue; }
            const buffer = Buffer.from(await resp.arrayBuffer());
            if (buffer.length < 10000) { console.warn(`[Terracotta] 文件过小 (${buffer.length} bytes)，跳过: ${url}`); continue; }
            const { execFile } = require('child_process');
            const tmpDir = path.join(binDir, '_tmp_extract');
            if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
            fs.mkdirSync(tmpDir, { recursive: true });
            const tmpArchive = path.join(tmpDir, 'pkg.tar.gz');
            fs.writeFileSync(tmpArchive, buffer);
            try {
                await new Promise((resolve, reject) => {
                    execFile('tar', ['-xzf', tmpArchive, '-C', tmpDir], { timeout: 30000 }, (err) => {
                        if (err) reject(err); else resolve();
                    });
                });
                let extracted = null;
                let extraDlls = [];
                const findExe = (dir) => {
                    for (const f of fs.readdirSync(dir)) {
                        const fp = path.join(dir, f);
                        if (fs.statSync(fp).isDirectory()) { findExe(fp); }
                        else if (f === exeName || f === 'terracotta' || f === 'terracotta.exe' || /^terracotta-[\d.]+.*\.exe$/i.test(f)) { extracted = fp; }
                        else if (/\.dll$/i.test(f)) { extraDlls.push(fp); }
                    }
                };
                findExe(tmpDir);
                if (extracted) {
                    fs.copyFileSync(extracted, binPath);
                    for (const dll of extraDlls) {
                        try { fs.copyFileSync(dll, path.join(binDir, path.basename(dll))); } catch (_) {}
                    }
                    if (!isWin) fs.chmodSync(binPath, 0o755);
                    fs.rmSync(tmpDir, { recursive: true, force: true });
                    return true;
                }
            } catch (te) {
                console.warn(`[Terracotta] tar extract failed: ${te.message}, trying raw write...`);
            }
            if (buffer.length > 500000) {
                fs.rmSync(tmpDir, { recursive: true, force: true });
                continue;
            }
            const tmpPath = binPath + '.tmp';
            fs.writeFileSync(tmpPath, buffer);
            fs.renameSync(tmpPath, binPath);
            if (!isWin) fs.chmodSync(binPath, 0o755);
            try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
            return true;
        } catch (e) {
            console.warn(`[Terracotta] 下载失败 (${i + 1}/${TERRACOTTA_URLS.length}): ${e.message}`);
        }
    }
    return false;
}

// ============================================================================
// 公共节点
// ============================================================================

async function fetchTerracottaPublicNodes(forceRefresh = false) {
    if (!forceRefresh && ctx.network.terracottaPublicNodes && Date.now() < ctx.network.terracottaPublicNodesExpiry) {
        return ctx.network.terracottaPublicNodes;
    }
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const resp = await fetch('https://terracotta.glavo.site/nodes', { signal: controller.signal });
        clearTimeout(timeout);
        const data = await resp.json();
        if (Array.isArray(data)) {
            const isChina = Intl.DateTimeFormat().resolvedOptions().timeZone?.includes('Shanghai') ||
                            Intl.DateTimeFormat().resolvedOptions().timeZone?.includes('Chongqing') ||
                            Intl.DateTimeFormat().resolvedOptions().locale?.startsWith('zh');
            ctx.network.terracottaPublicNodes = data
                .filter(n => {
                    if (!n || !n.url) return false;
                    if (!n.region) return true;
                    if (isChina) return n.region === 'CN';
                    return true;
                })
                .map(n => n.url);
            ctx.network.terracottaPublicNodesExpiry = Date.now() + 3600000;
        }
    } catch (e) {
        console.warn(`[Terracotta] 获取公共节点失败: ${e.message}，使用默认节点`);
    }
    if (!ctx.network.terracottaPublicNodes || ctx.network.terracottaPublicNodes.length === 0) {
        ctx.network.terracottaPublicNodes = [
            'https://etnode.zkitefly.eu.org/node1',
            'https://etnode.zkitefly.eu.org/node2'
        ];
        ctx.network.terracottaPublicNodesExpiry = Date.now() + 600000;
    }
    return ctx.network.terracottaPublicNodes;
}

// ============================================================================
// HTTP API
// ============================================================================

async function terracottaHttpGet(endpoint, params = {}, retries = 5) {
    if (!ctx.network.terracottaHttpPort) throw new Error('Terracotta未启动');
    const urlObj = new URL(`http://127.0.0.1:${ctx.network.terracottaHttpPort}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach(v => urlObj.searchParams.append(key, v));
        } else if (value !== undefined && value !== null) {
            urlObj.searchParams.set(key, value);
        }
    });
    const reqUrl = urlObj.toString();
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const result = await new Promise((resolve, reject) => {
                const req = http.get(reqUrl, { timeout: 10000 }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        if (res.statusCode < 200 || res.statusCode >= 300) {
                            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 100)}`));
                            return;
                        }
                        if (!data || data.trim() === '') { resolve({ ok: true, empty: true }); return; }
                        try { resolve(JSON.parse(data)); } catch (e) {
                            console.warn(`[Terracotta] JSON解析失败 ${endpoint}: ${data.slice(0, 200)}`);
                            reject(new Error(`JSON parse error: ${data.slice(0, 100)}`));
                        }
                    });
                });
                req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
                req.on('error', reject);
            });
            return result;
        } catch (e) {
            lastErr = e;
            console.warn(`[Terracotta] API请求失败 ${endpoint} (第${attempt + 1}/${retries + 1}次): ${e.message}`);
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, Math.min(200 * Math.pow(1.5, attempt), 2000)));
            }
        }
    }
    throw new Error(`Terracotta API请求失败 (${retries + 1}次尝试): ${lastErr ? lastErr.message : 'unknown'}`);
}

// ============================================================================
// 进程管理
// ============================================================================

function waitForTerracottaPort(filePath, timeout, processRef) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const startTime = Date.now();
        const onProcessError = (err) => {
            if (!settled) { settled = true; console.error(`[Terracotta] 进程启动失败: ${err.message}`); reject(new Error('Terracotta进程启动失败: ' + err.message)); }
        };
        const onProcessClose = (code) => {
            if (!settled && code !== 0 && code !== null) { settled = true; console.error(`[Terracotta] 进程异常退出 code=${code}`); reject(new Error(`Terracotta进程异常退出 (code ${code})`)); }
        };
        if (processRef) {
            processRef.on('error', onProcessError);
            processRef.on('close', onProcessClose);
        }
        const check = () => {
            if (settled) return;
            if (fs.existsSync(filePath)) {
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    if (data.port) {
                        settled = true;
                        if (processRef) {
                            processRef.removeListener('error', onProcessError);
                            processRef.removeListener('close', onProcessClose);
                        }
                        resolve(data.port);
                        return;
                    }
                } catch (e) {}
            }
            const elapsed = Date.now() - startTime;
            if (elapsed > timeout) {
                settled = true;
                console.error(`[Terracotta] 启动超时 (${timeout / 1000}秒)，端口文件未出现`);
                reject(new Error('Terracotta启动超时'));
                return;
            }
            setTimeout(check, 500);
        };
        check();
    });
}

async function killExistingTerracotta() {
    try {
        const isWin = process.platform === 'win32';
        if (isWin) {
            try { execSync('taskkill /F /IM terracotta.exe 2>nul', { timeout: 5000, windowsHide: true, stdio: 'ignore' }); } catch (_) {}
        } else {
            try { execSync('pkill -f terracotta 2>/dev/null', { timeout: 5000, windowsHide: true, stdio: 'ignore' }); } catch (_) {}
        }
    } catch (_) {}
}

async function startTerracotta() {
    if (ctx.network.terracottaProcess && ctx.network.terracottaHttpPort) {
        for (let i = 0; i < 3; i++) {
            try {
                await terracottaHttpGet('/state');
                return ctx.network.terracottaHttpPort;
            } catch (e) {
                console.warn(`[Terracotta] 健康检查失败 (${i + 1}/3): ${e.message}`);
                if (i < 2) await new Promise(r => setTimeout(r, 1000));
            }
        }
        console.warn('[Terracotta] 健康检查3次全部失败，准备重启进程');
        stopTerracotta();
    }

    await killExistingTerracotta();
    await new Promise(r => setTimeout(r, 500));

    const installed = await ensureTerracottaInstalled();
    if (!installed) {
        console.error('[Terracotta] 组件安装失败，所有下载源均不可用');
        throw new Error('陶瓦联机初始化失败，请检查网络连接后重试');
    }

    const binPath = getTerracottaBinaryPath();
    const binCwd = path.dirname(binPath);
    if (!fs.existsSync(binCwd)) {
        fs.mkdirSync(binCwd, { recursive: true });
    }
    const tmpDir = path.join(os.tmpdir(), `versepc-terracotta-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    ctx.network.terracottaPortFilePath = path.join(tmpDir, 'http');

    try {
        ctx.network.terracottaProcess = spawn(binPath, ['--hmcl', ctx.network.terracottaPortFilePath], {
            cwd: binCwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        });
    } catch (spawnErr) {
        throw new Error('陶瓦联机组件启动失败: ' + spawnErr.message);
    }

    ctx.network.terracottaProcess.stdout.on('data', (data) => {
        const line = data.toString().trim();
    });

    ctx.network.terracottaProcess.stderr.on('data', (data) => {
        const line = data.toString().trim();
    });

    ctx.network.terracottaProcess.on('close', (code) => {
        ctx.network.terracottaStatus.running = false;
        ctx.network.terracottaHttpPort = 0;
        ctx.network.terracottaProcess = null;
        stopTerracottaDaemon();
        if (code !== 0 && code !== null && ctx.network._terracottaSavedMode) {
            console.warn('[Terracotta] Non-zero exit, attempting auto-recovery...');
            setTimeout(() => recoverTerracotta(), 2000);
        }
    });

    ctx.network.terracottaProcess.on('error', (err) => {
        console.error(`[Terracotta] Process error:`, err.message);
        ctx.network.terracottaStatus.running = false;
        ctx.network.terracottaHttpPort = 0;
        ctx.network.terracottaProcess = null;
    });

    try {
        const port = await waitForTerracottaPort(ctx.network.terracottaPortFilePath, 30000, ctx.network.terracottaProcess);
        ctx.network.terracottaHttpPort = port;
        ctx.network.terracottaStatus.running = true;
        return port;
    } catch (e) {
        if (ctx.network.terracottaProcess) {
            try { ctx.network.terracottaProcess.kill(); } catch (ex) {}
            ctx.network.terracottaProcess = null;
        }
        throw new Error('Terracotta启动超时，请重试');
    }
}

// ============================================================================
// 玩家名
// ============================================================================

function getPlayerName() {
    try {
        const accounts = utils.safeReadJsonFile(ctx.dirs.ACCOUNTS_FILE, []);
        if (Array.isArray(accounts) && accounts.length > 0) {
            const settings = utils.safeReadJsonFile(ctx.dirs.SETTINGS_FILE, {});
            const account = accounts.find(a => a.id === settings.selectedAccount) || accounts[0];
            return account.username || account.name || 'Player';
        }
    } catch (e) {}
    return 'Player';
}

// ============================================================================
// 主机 / 客户端
// ============================================================================

async function terracottaStartHost(gamePort, playerName) {
    const port = await startTerracotta();
    const nodes = await fetchTerracottaPublicNodes();

    ctx.network.terracottaStatus.mode = 'host';
    ctx.network.terracottaStatus.gamePort = gamePort;

    const name = playerName || getPlayerName();
    const params = {
        player: name,
        public_nodes: nodes
    };

    for (let retry = 0; retry < 3; retry++) {
        try {
            await new Promise(r => setTimeout(r, 1000 + retry * 500));
            await terracottaHttpGet('/state/scanning', params);
            break;
        } catch (e) {
            console.warn(`[Terracotta] /state/scanning 第${retry + 1}次失败: ${e.message}`);
            if (retry === 2) throw e;
        }
    }

    ctx.network._terracottaSavedMode = 'host';
    ctx.network._terracottaSavedGamePort = gamePort;
    ctx.network._terracottaCrashCount = 0;
    startTerracottaDaemon();

    return { success: true, httpPort: port };
}

async function terracottaStartGuest(roomCode, playerName) {
    const port = await startTerracotta();
    const nodes = await fetchTerracottaPublicNodes();

    ctx.network.terracottaStatus.mode = 'guest';

    const name = playerName || getPlayerName();
    const params = {
        room: roomCode,
        player: name,
        public_nodes: nodes
    };

    for (let retry = 0; retry < 3; retry++) {
        try {
            await new Promise(r => setTimeout(r, 1000 + retry * 500));
            await terracottaHttpGet('/state/guesting', params);
            break;
        } catch (e) {
            console.warn(`[Terracotta] /state/guesting 第${retry + 1}次失败: ${e.message}`);
            if (retry === 2) throw e;
        }
    }

    ctx.network._terracottaSavedMode = 'guest';
    ctx.network._terracottaSavedRoomCode = roomCode;
    ctx.network._terracottaCrashCount = 0;
    startTerracottaDaemon();

    return { success: true, httpPort: port };
}

// ============================================================================
// 守护进程 / 恢复 / 停止
// ============================================================================

function startTerracottaDaemon() {
    if (ctx.network._terracottaDaemonTimer) clearInterval(ctx.network._terracottaDaemonTimer);
    ctx.network._terracottaDaemonTimer = setInterval(async () => {
        if (!ctx.network.terracottaHttpPort) return;
        try {
            await getTerracottaState();
        } catch (e) {}
    }, 500);
}

function stopTerracottaDaemon() {
    if (ctx.network._terracottaDaemonTimer) { clearInterval(ctx.network._terracottaDaemonTimer); ctx.network._terracottaDaemonTimer = null; }
}

async function recoverTerracotta() {
    if (ctx.network._terracottaCrashCount >= ctx.network.TERRACOTTA_MAX_CRASH_RECOVERY) {
        console.error('[Terracotta] Max crash recovery attempts reached');
        stopTerracotta();
        ctx.network._terracottaCrashCount = 0;
        return false;
    }
    ctx.network._terracottaCrashCount++;
    console.warn(`[Terracotta] Attempting recovery (${ctx.network._terracottaCrashCount}/${ctx.network.TERRACOTTA_MAX_CRASH_RECOVERY})...`);
    try {
        ctx.network.terracottaProcess = null;
        ctx.network.terracottaHttpPort = 0;
        if (ctx.network._terracottaSavedMode === 'host' && ctx.network._terracottaSavedGamePort) {
            await terracottaStartHost(ctx.network._terracottaSavedGamePort);
            return true;
        } else if (ctx.network._terracottaSavedMode === 'guest' && ctx.network._terracottaSavedRoomCode) {
            await terracottaStartGuest(ctx.network._terracottaSavedRoomCode);
            return true;
        }
    } catch (e) {
        console.error('[Terracotta] Recovery failed:', e.message);
    }
    return false;
}

function stopTerracotta() {
    stopTerracottaDaemon();
    if (ctx.network.terracottaProcess) {
        try { ctx.network.terracottaProcess.kill(); } catch (e) {}
        ctx.network.terracottaProcess = null;
    }
    ctx.network.terracottaHttpPort = 0;
    ctx.network._terracottaCrashCount = 0;
    ctx.network._terracottaSavedMode = null;
    ctx.network._terracottaSavedGamePort = 0;
    ctx.network._terracottaSavedRoomCode = '';
    ctx.network.terracottaStatus = { running: false, mode: null, roomCode: '', virtualIP: '', guestPort: 25565, gamePort: 0, state: null, stateIndex: -1, profiles: [], difficulty: null, errorType: null, errorMessage: null };

    if (ctx.network.terracottaPortFilePath) {
        try {
            const tmpDir = path.dirname(ctx.network.terracottaPortFilePath);
            if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (e) {}
        ctx.network.terracottaPortFilePath = '';
    }

    return { success: true };
}

// ============================================================================
// 状态
// ============================================================================

async function getTerracottaState() {
    if (!ctx.network.terracottaHttpPort) return null;
    try {
        const state = await terracottaHttpGet('/state');
        if (state && state.state) {
            const prevState = ctx.network.terracottaStatus.state;
            ctx.network.terracottaStatus.state = state.state;
            ctx.network.terracottaStatus.stateIndex = state.index || -1;

            if (state.state === 'host-ok' && state.room) {
                ctx.network.terracottaStatus.roomCode = typeof state.room === 'object' ? (state.room.code || '') : state.room;
            }
            if (state.state === 'guest-ok' && state.url) {
                const urlStr = state.url;
                ctx.network.terracottaStatus.virtualIP = urlStr;
                const portMatch = urlStr.match(/:(\d+)$/);
                if (portMatch) ctx.network.terracottaStatus.guestPort = parseInt(portMatch[1], 10);
                else ctx.network.terracottaStatus.guestPort = 25565;
            }

            if (state.state === 'exception' && state.type !== undefined) {
                const errInfo = ctx.network.TERRACOTTA_ERROR_MAP[state.type];
                if (errInfo) {
                    ctx.network.terracottaStatus.errorType = errInfo.key;
                    ctx.network.terracottaStatus.errorMessage = errInfo.msg;
                    console.error(`[Terracotta] 连接异常: [${errInfo.key}] ${errInfo.msg} (type=${state.type})`);
                } else {
                    const unknownMsg = `未知错误 (code=${state.type})`;
                    ctx.network.terracottaStatus.errorType = '未知错误';
                    ctx.network.terracottaStatus.errorMessage = unknownMsg;
                    console.error(`[Terracotta] 未知异常 type=${state.type}`);
                }
            } else if (state.state !== 'exception') {
                ctx.network.terracottaStatus.errorType = null;
                ctx.network.terracottaStatus.errorMessage = null;
            }

            if (state.profiles !== undefined) {
                ctx.network.terracottaStatus.profiles = state.profiles || [];
            }
            if (state.difficulty !== undefined) {
                ctx.network.terracottaStatus.difficulty = state.difficulty;
            }
        }
        return state;
    } catch (e) {
        console.error(`[Terracotta] 获取状态失败: ${e.message}`);
        return null;
    }
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
    _terracottaWriteLog,
    _terracottaIntercept,
    generateInvitationCode,
    generateNetworkSecret,
    getTerracottaBinaryPath,
    isTerracottaInstalled,
    ensureTerracottaInstalled,
    fetchTerracottaPublicNodes,
    terracottaHttpGet,
    waitForTerracottaPort,
    killExistingTerracotta,
    startTerracotta,
    getPlayerName,
    terracottaStartHost,
    terracottaStartGuest,
    startTerracottaDaemon,
    stopTerracottaDaemon,
    recoverTerracotta,
    stopTerracotta,
    getTerracottaState,
    generateRoomCode,
};
