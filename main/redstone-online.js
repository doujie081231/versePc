/**
 * main/redstone-online.js - 红石联机内网穿透 IPC 模块
 *
 * 实现：
 *   1. 拉取服务器节点列表（https://shithub.site/server.json）
 *   2. 生成本地 API Key，持久化到 DATA_DIR/redstone-online/apikey.txt
 *   3. 通过 HTTP API (端口 3000) 注册 API Key / 创建隧道 / 查询隧道 / 关闭隧道
 *   4. 通过 TCP (端口 7000) 建立到中转服务器的长连接
 *   5. 本地中继：TCP 隧道数据 ↔ 游戏 LAN 端口（如 25565）双向转发
 *
 * 所有网络操作都在主进程完成，绕过渲染进程的 CORS 限制。
 */

const { ipcMain } = require('electron');
const net = require('net');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('./paths');

const REDSTONE_DIR = path.join(DATA_DIR, 'redstone-online');
const APIKEY_FILE = path.join(REDSTONE_DIR, 'apikey.txt');
const REGISTRY_URL = 'https://shithub.site/server.json';
const HTTP_PORT = 3000;
const TCP_PORT = 7000;
const APIKEY_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** 调试日志文件 */
let _debugLogStream = null;
function writeDebug(msg) {
  try {
    if (!_debugLogStream) {
      fs.mkdirSync(REDSTONE_DIR, { recursive: true });
      _debugLogStream = fs.createWriteStream(path.join(REDSTONE_DIR, 'debug.log'), { flags: 'a' });
    }
    _debugLogStream.write('[' + new Date().toISOString() + '] ' + msg + '\n');
  } catch (_) {}
}
// 每次启动清空旧日志
try { fs.mkdirSync(REDSTONE_DIR, { recursive: true }); fs.writeFileSync(path.join(REDSTONE_DIR, 'debug.log'), ''); } catch (_) {}

// 运行时状态（仅主进程内存中）
const state = {
  apikey: '',
  servers: [],            // [{name, address}]
  currentServerIdx: 0,
  tunnel: null,           // { listenPort, serverAddress, address }
  controlSocket: null,    // 到 7000 端口的 TCP 长连接
  localRelaySockets: [],  // 本地中转的 socket 列表
  running: false,
  stopping: false,
  _sender: null,          // 保存 IPC sender 用于通知前端
  _healthTimer: null,     // 控制连接健康检查定时器
  _gameHealthTimer: null, // 游戏端口健康检查定时器（游戏关闭时自动关隧道）
  _lastParams: null,      // 最近一次 startTunnel 的参数（供自动重连使用）
  _onLog: null,           // 最近一次 startTunnel 的日志回调
  _reconnectTimer: null,  // 自动重连定时器
  _reconnectAttempts: 0,  // 当前已重连次数
  _reconnectMaxAttempts: 5, // 最大重连次数
  _reconnecting: false,   // 是否处于重连过程中
};

// ===================================================================
// 工具函数
// ===================================================================

/** 生成 20 位随机 API Key */
function makeApikey() {
  const bytes = crypto.randomBytes(20);
  let key = '';
  for (let i = 0; i < 20; i++) {
    key += APIKEY_CHARS[bytes[i] % APIKEY_CHARS.length];
  }
  return key;
}

/** 加载本地 API Key，没有则生成并保存 */
function loadOrCreateApikey() {
  try {
    fs.mkdirSync(REDSTONE_DIR, { recursive: true });
    if (fs.existsSync(APIKEY_FILE)) {
      const key = fs.readFileSync(APIKEY_FILE, 'utf8').trim();
      if (key && key.length >= 16) return key;
    }
    const newKey = makeApikey();
    fs.writeFileSync(APIKEY_FILE, newKey, 'utf8');
    return newKey;
  } catch (e) {
    console.error('[RedstoneOnline] loadOrCreateApikey failed:', e.message);
    return makeApikey();
  }
}

/** 通用 HTTP 请求封装 */
function httpRequest(method, urlStr, { headers = {}, body = null, timeout = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(urlStr);
      const lib = u.protocol === 'https:' ? https : http;
      const opts = {
        method,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        headers: { ...headers },
        timeout,
      };
      if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.headers['Content-Length'] = Buffer.byteLength(body);
      }
      const req = lib.request(opts, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      });
      req.on('timeout', () => { req.destroy(new Error('http timeout')); });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    } catch (e) { reject(e); }
  });
}

/** 拉取服务器节点列表 */
async function fetchServerList() {
  try {
    const resp = await httpRequest('GET', REGISTRY_URL, { timeout: 6000 });
    if (resp.statusCode !== 200) throw new Error('registry returned ' + resp.statusCode);
    const obj = JSON.parse(resp.body);
    const list = [];
    for (const name of Object.keys(obj)) {
      const address = String(obj[name]).trim();
      if (address) list.push({ name, address });
    }
    if (list.length === 0) throw new Error('registry is empty');
    return list;
  } catch (e) {
    // 兜底：用内置默认节点
    console.warn('[RedstoneOnline] fetchServerList fallback:', e.message);
    return [{ name: '上海', address: '122.51.108.96' }];
  }
}

/** 向中转服务器注册 API Key（幂等，已存在视为成功） */
async function registerApikey(serverAddress, apikey) {
  const url = `http://${serverAddress}:${HTTP_PORT}/apikey`;
  const body = JSON.stringify({ apikey });
  const resp = await httpRequest('POST', url, { body, timeout: 6000 });
  if (resp.statusCode === 200 || resp.statusCode === 409) {
    return { ok: true, alreadyExists: resp.statusCode === 409 };
  }
  throw new Error(`register apikey failed: ${resp.statusCode} ${resp.body}`);
}

/** 创建隧道 */
async function createTunnel(serverAddress, apikey, title, description, publicAccess, allowOffline) {
  // 新接口：publicAccess 必传（0=不公开，1=公开），不再需要 maxPlayer
  // 公开房间时需要 body: { title, description, online }
  // online: true=仅正版, false=允许离线（与 allowOffline 相反）
  const url = `http://${serverAddress}:${HTTP_PORT}/tunnels?publicAccess=${publicAccess ? 1 : 0}`;
  const headers = { Authorization: apikey };
  let body = null;
  if (publicAccess) {
    body = JSON.stringify({
      title: String(title || '').slice(0, 8),
      description: String(description || '').slice(0, 100),
      online: !allowOffline // online=true 表示仅正版，与 allowOffline 相反
    });
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(body);
  }
  const resp = await httpRequest('POST', url, { headers, timeout: 10000, body });
  if (resp.statusCode >= 200 && resp.statusCode < 300) {
    const obj = JSON.parse(resp.body);
    return { ok: true, listenPort: obj.listenPort, tunnelId: obj.tunnelId };
  }
  // 429：已有隧道 → 先 DELETE 再重试一次
  if (resp.statusCode === 429) {
    await closeTunnel(serverAddress, apikey).catch(() => {});
    const resp2 = await httpRequest('POST', url, { headers, timeout: 10000, body });
    if (resp2.statusCode >= 200 && resp2.statusCode < 300) {
      const obj = JSON.parse(resp2.body);
      return { ok: true, listenPort: obj.listenPort, tunnelId: obj.tunnelId };
    }
    throw new Error(`create tunnel retry failed: ${resp2.statusCode} ${resp2.body}`);
  }
  throw new Error(`create tunnel failed: ${resp.statusCode} ${resp.body}`);
}

/** 拉取公开房间列表 */
async function listPublicTunnels(serverAddress, offset = 0) {
  // 新接口 docs: ?offset=Number, 无需 API key 认证
  // 但部分服务端可能仍用旧参数 from 且需要鉴权，先尝试多组合，失败后降级
  let error = null;

  // 尝试 1: 新接口无认证，尝试 offset 和 from 两种参数名
  for (const paramName of ['offset', 'from']) {
    try {
      const url = `http://${serverAddress}:${HTTP_PORT}/tunnels/list?${paramName}=${parseInt(offset, 10) || 0}`;
      const resp = await httpRequest('GET', url, { timeout: 8000 });
      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        writeDebug(`[listPublicTunnels] OK with ?${paramName}=${offset}`);
        return JSON.parse(resp.body);
      }
      error = `list tunnels failed: ${resp.statusCode} ${resp.body ? resp.body.slice(0, 200) : '(empty)'}`;
      writeDebug(`[listPublicTunnels] ?${paramName}=${offset} -> ${resp.statusCode} ${(resp.body || '').slice(0, 100)}`);
    } catch (e) {
      error = `list tunnels error: ${e.message}`;
      writeDebug(`[listPublicTunnels] ?${paramName}=${offset} -> ${e.message}`);
    }
  }

  // 尝试 2: 加 apikey 再试一次
  try {
    const url = `http://${serverAddress}:${HTTP_PORT}/tunnels/list?offset=${parseInt(offset, 10) || 0}`;
    const resp = await httpRequest('GET', url, {
      headers: { Authorization: state.apikey },
      timeout: 8000,
    });
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      writeDebug('[listPublicTunnels] OK with apikey');
      return JSON.parse(resp.body);
    }
    writeDebug(`[listPublicTunnels] with apikey -> ${resp.statusCode} ${(resp.body || '').slice(0, 100)}`);
  } catch (e) {
    writeDebug(`[listPublicTunnels] with apikey -> ${e.message}`);
  }

  throw new Error(error);
}

/** 获取单个公开房间的模组列表 */
async function getTunnelMods(serverAddress, tunnelId) {
  let error = null;
  // 尝试无认证
  try {
    const url = `http://${serverAddress}:${HTTP_PORT}/tunnels/mods?id=${parseInt(tunnelId, 10) || 0}`;
    const resp = await httpRequest('GET', url, { timeout: 8000 });
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      return JSON.parse(resp.body);
    }
    if (resp.statusCode === 404) {
      return { mods: [] };
    }
    error = `get tunnel mods failed: ${resp.statusCode} ${resp.body ? resp.body.slice(0, 200) : '(empty)'}`;
    writeDebug(`[getTunnelMods] no auth -> ${resp.statusCode} ${(resp.body || '').slice(0, 100)}`);
  } catch (e) {
    error = `get tunnel mods error: ${e.message}`;
    writeDebug(`[getTunnelMods] no auth -> ${e.message}`);
  }
  // 尝试加 apikey
  try {
    const url = `http://${serverAddress}:${HTTP_PORT}/tunnels/mods?id=${parseInt(tunnelId, 10) || 0}`;
    const resp = await httpRequest('GET', url, {
      headers: { Authorization: state.apikey },
      timeout: 8000,
    });
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      writeDebug('[getTunnelMods] OK with apikey');
      return JSON.parse(resp.body);
    }
    if (resp.statusCode === 404) {
      return { mods: [] };
    }
    writeDebug(`[getTunnelMods] with apikey -> ${resp.statusCode}`);
  } catch (e) {
    writeDebug(`[getTunnelMods] with apikey -> ${e.message}`);
  }
  throw new Error(error);
}

/** 关闭隧道 */
async function closeTunnel(serverAddress, apikey) {
  const url = `http://${serverAddress}:${HTTP_PORT}/tunnels`;
  const resp = await httpRequest('DELETE', url, {
    headers: { Authorization: apikey },
    timeout: 8000,
  });
  return { ok: resp.statusCode === 200, statusCode: resp.statusCode, body: resp.body };
}

// ===================================================================
// TCP 控制连接 + 本地中继
// ===================================================================

/** 读取一行（以 \n 结尾） */
function readLineFromStream(stream, callback) {
  let buf = '';
  const onData = (chunk) => {
    buf += chunk.toString('utf8');
    let idx;
    while ((idx = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      callback(line);
    }
  };
  stream.on('data', onData);
  return () => stream.removeListener('data', onData);
}

/**
 * 启动红石联机隧道
 * @param {Object} params - { serverAddress, gamePort, title, description, publicAccess, allowOffline }
 * @param {(msg:string)=>void} onLog - 日志回调
 * @param {Object} [options] - { isReconnect: boolean } 是否为自动重连路径
 * @returns {Promise<{ok:boolean, address?:string, listenPort?:number, error?:string}>}
 */
async function startTunnel(params, onLog, options = {}) {
  const log = (msg) => { try { onLog(msg); } catch (_) {} };
  const isReconnect = !!options.isReconnect;
  if (state.running) {
    return { ok: false, error: '隧道已在运行中，请先关闭' };
  }
  const serverAddress = params.serverAddress;
  const gamePort = Math.max(1, parseInt(params.gamePort) || 25565);
  const title = String(params.title || '').trim().slice(0, 8);
  const description = String(params.description || '').trim().slice(0, 100);
  // publicAccess: 是否公开房间（对应文档的 publicAccess=0/1）
  // 兼容旧字段 isOpen：isOpen=true 表示对外开放
  const publicAccess = params.publicAccess !== undefined ? !!params.publicAccess : (params.isOpen !== false);
  const allowOffline = !!params.allowOffline;

  state.stopping = false;
  state.running = true;
  state.localRelaySockets = [];

  // 保存参数和日志回调供自动重连使用（仅首次启动路径保存，重连路径复用已有值）
  if (!isReconnect) {
    state._lastParams = { serverAddress, gamePort, title, description, publicAccess, allowOffline };
    state._onLog = onLog;
    state._reconnectAttempts = 0;
    state._reconnecting = false;
  }

  try {
    // 1. 确保有 API Key
    if (!state.apikey) state.apikey = loadOrCreateApikey();
    log('API Key: ' + state.apikey);

    // 2. 注册 API Key
    log('正在注册 API Key 到 ' + serverAddress + ' ...');
    await registerApikey(serverAddress, state.apikey);
    log('API Key 已注册');

    // 3. 建立 TCP 控制连接到 7000 端口
    log('正在连接控制服务器 ' + serverAddress + ':7000 ...');
    const controlSocket = await new Promise((resolve, reject) => {
      const s = net.connect(TCP_PORT, serverAddress, () => resolve(s));
      s.setTimeout(8000);
      s.once('error', reject);
      s.once('timeout', () => reject(new Error('tcp connect timeout')));
    });
    controlSocket.setTimeout(0);
    controlSocket.setNoDelay(true);
    controlSocket.setKeepAlive(true, 10000);
    state.controlSocket = controlSocket;
    log('已建立 TCP 控制连接');

    // 4. 发送 apikey 进入连接池
    controlSocket.write(state.apikey + '\n', 'utf8');

    // 5. 等待首行响应
    //    注意：必须全程使用 Buffer 处理，不能用字符串！
    //    因为 OK 响应后面可能紧跟着玩家的二进制数据包（MC 协议含 0x80-0xFF 字节），
    //    如果用 toString('utf8') 转字符串再转回 Buffer，会损坏二进制数据，
    //    导致 MC 抛 Index out of bounds Exception 立即关闭连接。
    const firstLine = await new Promise((resolve, reject) => {
      let buf = Buffer.alloc(0);
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('等待服务器响应超时'));
      }, 12000);
      const cleanup = () => {
        clearTimeout(timer);
        controlSocket.removeListener('data', onData);
      };
      const onData = (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        const idx = buf.indexOf(0x0A); // '\n'
        if (idx !== -1) {
          const line = buf.slice(0, idx).toString('utf8').trim();
          const rest = buf.slice(idx + 1);
          cleanup();
          // 把剩余数据原样放回 stream（重要：可能是玩家的二进制数据）
          if (rest.length > 0) {
            log('[诊断] 首行响应后剩余 ' + rest.length + ' 字节，前16字节: ' + rest.slice(0, 16).toString('hex'));
            writeDebug('[startTunnel] 首行响应后剩余 ' + rest.length + ' 字节，前16字节: ' + rest.slice(0, 16).toString('hex'));
            controlSocket.unshift(rest);
          }
          resolve(line);
        }
      };
      controlSocket.on('data', onData);
      controlSocket.once('error', (e) => { cleanup(); reject(e); });
    });
    log('服务器响应: ' + firstLine);

    let listenPort = null;
    if (firstLine.startsWith('OK TUNNEL ')) {
      // 已有隧道，从首行无法拿到端口，调 API 查询
      try {
        const qurl = `http://${serverAddress}:${HTTP_PORT}/tunnels`;
        const qresp = await httpRequest('GET', qurl, {
          headers: { Authorization: state.apikey },
          timeout: 6000,
        });
        if (qresp.statusCode === 200) {
          const obj = JSON.parse(qresp.body);
          if (obj.tunnels && obj.tunnels.length > 0) {
            listenPort = obj.tunnels[0].listenPort;
          }
        }
      } catch (_) {}
      if (!listenPort) {
        throw new Error('已有隧道但无法获取 listenPort');
      }
    } else if (firstLine === 'OK WAITING' || firstLine.startsWith('OK WAITING')) {
      // 6. 需要创建隧道
      log(publicAccess ? '正在创建公开房间...' : '正在创建私人隧道...');
      const result = await createTunnel(serverAddress, state.apikey, title, description, publicAccess, allowOffline);
      listenPort = result.listenPort;
      log('隧道已创建，端口: ' + listenPort);

      // 等待 OK TUNNEL 通知（同样必须用 Buffer 处理，避免二进制数据损坏）
      await new Promise((resolve, reject) => {
        let buf = Buffer.alloc(0);
        const timer = setTimeout(() => { cleanup(); resolve(); }, 8000);
        const cleanup = () => {
          clearTimeout(timer);
          controlSocket.removeListener('data', onData);
        };
        const onData = (chunk) => {
          buf = Buffer.concat([buf, chunk]);
          const idx = buf.indexOf(0x0A); // '\n'
          if (idx !== -1) {
            const line = buf.slice(0, idx).toString('utf8').trim();
            const rest = buf.slice(idx + 1);
            cleanup();
            // 剩余数据原样放回（重要：可能是玩家的二进制数据）
            if (rest.length > 0) {
              log('[诊断] OK TUNNEL 通知后剩余 ' + rest.length + ' 字节，前16字节: ' + rest.slice(0, 16).toString('hex'));
              writeDebug('[startTunnel] OK TUNNEL 通知后剩余 ' + rest.length + ' 字节，前16字节: ' + rest.slice(0, 16).toString('hex'));
              controlSocket.unshift(rest);
            }
            resolve(line);
          }
        };
        controlSocket.on('data', onData);
        controlSocket.once('error', () => { cleanup(); resolve(); });
      });
    } else if (firstLine.startsWith('ERR')) {
      throw new Error('服务器拒绝: ' + firstLine);
    } else {
      throw new Error('未知响应: ' + firstLine);
    }

    state.tunnel = {
      listenPort,
      serverAddress,
      address: serverAddress + ':' + listenPort,
      title,
      description,
      publicAccess,
      allowOffline,
    };

    // 7. 启动本地中继：游戏端口 ↔ 控制连接
    //    控制连接在 OK TUNNEL 后变成数据通道，双向转发到本地 gamePort
    log('正在启动本地中转 (游戏端口 ' + gamePort + ')...');
    startLocalRelay(controlSocket, gamePort, log);

    log('隧道已就绪，地址: ' + state.tunnel.address);

    // 启动保活健康检查：每 30 秒检测控制 socket 是否还活着
    state._healthTimer = setInterval(() => {
      if (!state.controlSocket || state.controlSocket.destroyed) {
        if (state.running && !state.stopping) {
          log('检测到连接已断开，准备自动重连...');
          // 不直接调 stopTunnel（会清理 _lastParams），由 close 事件触发 scheduleReconnect
          clearInterval(state._healthTimer);
          state._healthTimer = null;
          // 主动清理 controlSocket 引用，确保 close 事件能触发重连
          try { state.controlSocket && state.controlSocket.destroy(); } catch (_) {}
        } else {
          clearInterval(state._healthTimer);
          state._healthTimer = null;
        }
      }
    }, 30000);

    // 启动游戏端口健康检查：每 30 秒 TCP 连接测试一次游戏端口
    // 连续 3 次检测不到端口（约 90 秒）才关隧道，避免游戏 GC、切场景时端口短暂无响应被误判
    // 注意：TCP 连接测试会触发 MC 服务器 Server List Ping 响应，过于频繁会干扰 gameSocket
    let _gamePortFailCount = 0;
    const checkGamePort = () => {
      if (state.stopping) return;
      // 用户主动暂停（如游戏内切到主菜单、加载世界）时跳过本次检查，避免误判
      if (state._userPaused) {
        log('[诊断] 用户暂停中，跳过端口检查');
        return;
      }
      const gp = state._lastParams ? state._lastParams.gamePort : 25565;
      const test = net.connect(gp, '127.0.0.1', () => {
        _gamePortFailCount = 0;
        test.end();
        test.destroy();
      });
      test.setTimeout(3000);
      test.once('error', () => {
        test.destroy();
        _gamePortFailCount++;
        log('[诊断] 游戏端口检测失败 ' + _gamePortFailCount + '/3');
        if (_gamePortFailCount >= 3) {
          log('检测到游戏已关闭（端口连续 3 次不可达），自动关闭隧道');
          clearInterval(state._gameHealthTimer);
          state._gameHealthTimer = null;
          stopTunnel((m) => {}).catch(() => {});
          if (state._sender) {
            try { state._sender.send('redstone:disconnected', {}); } catch (_) {}
          }
        }
      });
      test.once('timeout', () => { test.destroy(); });
    };
    // 首次检查延迟 60 秒再开始，给游戏足够时间加载世界
    state._gameHealthTimer = setTimeout(() => {
      checkGamePort();
      state._gameHealthTimer = setInterval(checkGamePort, 30000);
    }, 60000);

    // 隧道成功启动，重置重连计数
    if (isReconnect) {
      log('自动重连成功');
      if (state._sender) {
        try { state._sender.send('redstone:reconnected', { address: state.tunnel.address }); } catch (_) {}
      }
    }
    state._reconnectAttempts = 0;
    state._reconnecting = false;

    return { ok: true, address: state.tunnel.address, listenPort };
  } catch (e) {
    state.running = false;
    // 出错时清理网络半成品，但保留 _lastParams 供自动重连使用
    const savedParams = state._lastParams;
    const savedLog = state._onLog;
    const savedAttempts = state._reconnectAttempts;
    await stopTunnel((m) => {}).catch(() => {});
    state._lastParams = savedParams;
    state._onLog = savedLog;
    state._reconnectAttempts = savedAttempts;
    log('启动失败: ' + e.message);
    // 重连路径下失败：继续重试（除非用户主动停止）
    if (isReconnect && !state.stopping) {
      scheduleReconnect(log);
    }
    return { ok: false, error: e.message };
  }
}

/**
 * 自动重连调度器
 * 递增间隔（3s, 6s, 12s, 24s, 48s），最多 5 次
 * 通过 redstone:reconnecting 通知前端，重连成功 redstone:reconnected，
 * 超过最大次数 redstone:disconnected（彻底断开）
 */
function scheduleReconnect(log) {
  if (state._reconnectTimer) return;
  if (state.stopping) return;
  if (!state._lastParams) return;
  if (state._reconnectAttempts >= state._reconnectMaxAttempts) {
    log('自动重连失败：已达最大重试次数 ' + state._reconnectMaxAttempts + ' 次');
    state._reconnecting = false;
    if (state._sender) {
      try { state._sender.send('redstone:disconnected', {}); } catch (_) {}
    }
    return;
  }
  state._reconnectAttempts++;
  state._reconnecting = true;
  const delay = 3000 * Math.pow(2, state._reconnectAttempts - 1);
  log('将在 ' + (delay / 1000) + ' 秒后自动重连（第 ' + state._reconnectAttempts + '/' + state._reconnectMaxAttempts + ' 次）');
  if (state._sender) {
    try {
      state._sender.send('redstone:reconnecting', {
        attempt: state._reconnectAttempts,
        maxAttempts: state._reconnectMaxAttempts,
        delay,
      });
    } catch (_) {}
  }
  state._reconnectTimer = setTimeout(async () => {
    state._reconnectTimer = null;
    if (state.stopping) return;
    if (!state._lastParams) return;
    log('正在自动重连（第 ' + state._reconnectAttempts + '/' + state._reconnectMaxAttempts + ' 次）...');
    const result = await startTunnel(state._lastParams, state._onLog || (() => {}), { isReconnect: true });
    if (!result.ok) {
      // 失败后会由 startTunnel 内部递归调用 scheduleReconnect
      log('自动重连失败: ' + result.error);
    }
  }, delay);
}

/**
 * Minecraft VarInt 编码（无符号）
 */
function writeVarInt(value) {
  value = value >>> 0;
  const buf = Buffer.alloc(5);
  let i = 0;
  do {
    let b = value & 0x7F;
    value >>>= 7;
    if (value !== 0) b |= 0x80;
    buf[i++] = b;
  } while (value !== 0);
  return buf.slice(0, i);
}

/**
 * 构造 Minecraft Server List Ping 数据包
 * Handshake (nextState=1) + Status Request
 */
function buildMinecraftPing(port) {
  // Handshake 载荷：ProtocolVersion + ServerAddr + Port + NextState
  const protoVer = writeVarInt(0);
  const addr = Buffer.from('127.0.0.1', 'utf8');
  const addrLen = writeVarInt(addr.length);
  const portBytes = Buffer.alloc(2);
  portBytes.writeUInt16BE(port);
  const nextState = writeVarInt(1);
  const hsPayload = Buffer.concat([protoVer, addrLen, addr, portBytes, nextState]);

  // Handshake 包帧：VarInt(长度) + VarInt(packetID=0) + payload
  const hsPid = writeVarInt(0);
  const hsLen = writeVarInt(hsPid.length + hsPayload.length);
  const handshake = Buffer.concat([hsLen, hsPid, hsPayload]);

  // Status Request 包：VarInt(长度=1) + VarInt(packetID=0)
  const reqPid = writeVarInt(0);
  const reqLen = writeVarInt(reqPid.length);
  const request = Buffer.concat([reqLen, reqPid]);

  return Buffer.concat([handshake, request]);
}

/**
 * 构造 Minecraft 完整 Keep Alive Ping
 * = Handshake(nextState=1) + Status Request + Ping Request(8 bytes timestamp)
 * 服务器依次响应 Status Response 和 Ping Response，保持连接活跃
 */
function buildFullPing(port) {
  const ping = buildMinecraftPing(port); // Handshake + Status Request

  // Ping Request (packet ID=1 in Status state, payload = 8 bytes random/long)
  const payload = Buffer.alloc(8);
  payload.writeBigUInt64BE(BigInt(Date.now()), 0);
  const reqPid = writeVarInt(1);
  const reqLen = writeVarInt(reqPid.length + payload.length);
  const pingRequest = Buffer.concat([reqLen, reqPid, payload]);

  return Buffer.concat([ping, pingRequest]);
}

/**
 * 启动本地中继：把控制 socket 的数据双向转发到本地 gamePort
 * 控制连接的 socket 在 OK TUNNEL 后变成数据通道
 *
 * 参考红石联机模组 Frp.java 的实现：
 *   1. 等到控制连接收到首批玩家数据，才创建 gameSocket（不主动连）
 *   2. 等待 gameSocket 连接建立成功后，再把首批数据写入（避免写入未连接的 socket）
 *   3. 持久 gameSocket，写入失败时关闭旧的、重建新的、重试 3 次
 *   4. gameSocket 断开后通过 close 事件置空，下次数据到达时自动重建
 */
function startLocalRelay(controlSocket, gamePort, log) {
  let stopped = false;
  let gameSocket = null;
  let gameConnected = false; // gameSocket 是否已完成 TCP 三次握手
  // 等待 gameSocket 连接建立时的待写数据队列（参考模组：连接建立后立即 flush）
  let pendingQueue = [];
  const MAX_PENDING = 8;

  /** hex 摘要：前 N 字节的十六进制，用于调试二进制数据 */
  const hexDump = (buf, max) => {
    const n = Math.min(buf.length, max || 32);
    let s = '';
    for (let i = 0; i < n; i++) {
      s += buf[i].toString(16).padStart(2, '0') + ' ';
    }
    return s.trim() + (buf.length > n ? ' ... (共 ' + buf.length + ' 字节)' : '');
  };

  let _dataSeq = 0; // 控制连接收到数据的序号，便于追踪时序

  /** 创建 gameSocket 并设置事件处理 */
  const createGame = () => {
    if (stopped) return null;
    // 关闭并清空旧引用
    if (gameSocket) {
      try { gameSocket.destroy(); } catch (_) {}
      gameSocket = null;
    }
    gameConnected = false;
    pendingQueue = [];

    log('[诊断] 正在创建 gameSocket → 127.0.0.1:' + gamePort);
    writeDebug('[startLocalRelay] 正在创建 gameSocket → 127.0.0.1:' + gamePort);
    const s = net.connect(gamePort, '127.0.0.1', () => {
      // 连接已建立：flush 待写数据
      gameConnected = true;
      log('[诊断] gameSocket 已连接 127.0.0.1:' + gamePort + '，待写队列长度=' + pendingQueue.length);
      writeDebug('[startLocalRelay] gameSocket 已连接 127.0.0.1:' + gamePort + '，待写队列长度=' + pendingQueue.length);
      if (pendingQueue.length > 0) {
        for (const buf of pendingQueue) {
          try { s.write(buf); } catch (_) {}
        }
        pendingQueue = [];
      }
    });
    s.setNoDelay(true);
    s.setKeepAlive(true, 10000);
    const connectTime = Date.now();
    let dataReceived = false;
    s.on('error', (e) => {
      log('[诊断] gameSocket 错误: ' + e.message + ' (code=' + e.code + ')');
      writeDebug('[startLocalRelay] gameSocket 错误: ' + e.message + ' (code=' + e.code + ')');
    });
    s.on('close', (hadError) => {
      const elapsed = Date.now() - connectTime;
      log('[诊断] gameSocket 关闭 (hadError=' + hadError + ', gameConnected=' + gameConnected + ', 存活=' + elapsed + 'ms)');
      writeDebug('[startLocalRelay] gameSocket 关闭 (hadError=' + hadError + ', gameConnected=' + gameConnected + ', 存活=' + elapsed + 'ms, dataReceived=' + dataReceived + ')');
      // 如果连接刚建立就断开（< 2秒）且没收到任何数据 → MC 局域网服务器已经关闭
      // 提示用户重新在游戏内开放局域网
      if (elapsed < 2000 && !dataReceived && gameConnected) {
        log('[警告] MC 局域网服务器可能已关闭，请在游戏内按 Esc → 对局域网开放 → 重新开放');
        writeDebug('[startLocalRelay] 检测到 MC 局域网已关闭，需要重新 publish');
        if (state._sender) {
          try { state._sender.send('redstone:warning', {
            message: '游戏局域网已关闭，请在游戏内按 Esc → 对局域网开放，然后重新连接'
          }); } catch (_) {}
        }
      }
      // 仅当当前引用匹配时才置空（避免竞态条件覆盖新连接）
      if (gameSocket === s) {
        gameSocket = null;
        gameConnected = false;
        pendingQueue = [];
      }
    });
    // L2R: 本地游戏 → 控制连接
    s.on('data', (data) => {
      dataReceived = true;
      try { controlSocket.write(data); } catch (_) {}
    });
    gameSocket = s;
    state.localRelaySockets.push(s);
    return s;
  };

  /** 带重试的 R2L 写入（参考模组：最多重试 3 次，每次 500ms） */
  const writeWithRetry = (data, retries) => {
    if (stopped) return;
    // gameSocket 不存在或已 destroyed → 创建新连接，数据入队等待
    if (!gameSocket || gameSocket.destroyed) {
      if (retries <= 0) return;
      createGame();
      if (pendingQueue.length < MAX_PENDING) {
        pendingQueue.push(data);
      }
      // 注意：不安排 retry 定时器！pendingQueue 会在 'connect' 事件中 flush，
      // 如果 connect 失败，socket 会 error/close → gameSocket 置 null，
      // 下次数据到达时自动创建新 socket。安排 retry 会导致重复写入（已由 connect handler flush 过）。
      return;
    }
    // gameSocket 已存在但还未完成连接 → 入队等待
    if (!gameConnected) {
      if (pendingQueue.length < MAX_PENDING) {
        pendingQueue.push(data);
      }
      return;
    }
    // gameSocket 已连接，直接写入
    try {
      gameSocket.write(data);
    } catch (_) {
      if (retries <= 0) return;
      // 写入失败：关闭旧 socket 重建
      const old = gameSocket;
      gameSocket = null;
      gameConnected = false;
      try { old.destroy(); } catch (_) {}
      createGame();
      if (pendingQueue.length < MAX_PENDING) {
        pendingQueue.push(data);
      }
      setTimeout(() => writeWithRetry(data, retries - 1), 300);
    }
  };

  // R2L: 控制连接 → 本地游戏（带重试）
  // 过滤 HTTP 探测包：互联网扫描机器人会在隧道端口开放后立即发送 HTTP GET 请求
  // 这种数据不能转发给 MC 服务器，否则 MC 收到乱码会立即断开连接
  const isHttpProbe = (buf) => {
    if (buf.length < 4) return false;
    const first4 = buf.slice(0, 4).toString('ascii').toUpperCase();
    return first4 === 'GET ' || first4 === 'POST' || first4 === 'PUT ' ||
           first4 === 'HEAD' || first4 === 'DELE' || first4 === 'PATC' ||
           first4 === 'OPTI' || first4 === 'CONN' || first4 === 'TRAC';
  };

  /**
   * 检测是否为 MC 新玩家连接的 Handshake 包
   * MC Handshake 包结构：VarInt(packetLen) + VarInt(packetId=0) + VarInt(protocolVersion) + VarInt(addrLen) + addr + ...
   * 特征：第 2 个字节（packetId 的第一个 VarInt 字节）= 0x00
   *       且后续字节看起来像协议版本号（VarInt 编码，常见值 760=1.19.2, 754=1.18.2, 765=1.20.2 等）
   *       且后面紧跟服务器地址字符串（含数字和点）
   *
   * 简单判断：第1字节是合理长度(10-30)，第2字节=0x00，第3-4字节是 VarInt 协议版本
   * 更简单：观察日志发现 1.19.2 的 Handshake 起始是 14 00 88 06
   *   - 0x14 = 20 (packet length)
   *   - 0x00 = packet id 0 (Handshake)
   *   - 0x88 0x06 = VarInt(760) (protocol version 1.19.2)
   * 通用判断：第2字节 == 0x00 且第3字节高位有 continuation bit (0x80)
   */
  const isMinecraftHandshake = (buf) => {
    if (buf.length < 4) return false;
    // 第1字节是 packet length (VarInt 单字节表示，范围 0x10-0x20 比较常见)
    const pktLen = buf[0];
    if (pktLen < 0x10 || pktLen > 0x20) return false;
    // 第2字节是 packet id = 0x00 (Handshake)
    if (buf[1] !== 0x00) return false;
    // 第3字节是协议版本 VarInt 第一个字节，1.13+ 协议号都 >= 393，
    // VarInt 编码下第一个字节 >= 0x80（有 continuation bit）或本身就是 0x80+
    if (buf[2] < 0x80) return false;
    // 后面应该跟着服务器地址字符串（VarInt 长度 + ASCII 字符串）
    // 简单验证：尝试解码第3-4字节为协议版本
    let proto = 0;
    let shift = 0;
    let idx = 2;
    while (idx < buf.length && idx < 6) {
      const b = buf[idx];
      proto |= (b & 0x7F) << shift;
      shift += 7;
      idx++;
      if ((b & 0x80) === 0) break;
    }
    // 1.13+ 协议号范围 393-770+
    if (proto < 393 || proto > 800) return false;
    // idx 现在指向地址长度 VarInt
    if (idx >= buf.length) return false;
    const addrLen = buf[idx];
    if (addrLen < 5 || addrLen > 30) return false;
    // 检查后续 addrLen 字节是否为 ASCII（IP 地址或域名）
    const addrStart = idx + 1;
    if (addrStart + addrLen > buf.length) return false;
    let asciiCount = 0;
    for (let i = addrStart; i < addrStart + addrLen; i++) {
      if (buf[i] >= 0x20 && buf[i] < 0x7F) asciiCount++;
    }
    return asciiCount >= addrLen - 2; // 允许 2 字节非 ASCII 容错
  };

  controlSocket.removeAllListeners('data');
  controlSocket.on('data', (data) => {
    _dataSeq++;
    const hex = hexDump(data, 32);
    log('[诊断] 控制连接收到数据 #' + _dataSeq + ': ' + hex);
    writeDebug('[startLocalRelay] 控制连接收到数据 #' + _dataSeq + ': ' + hex);
    writeDebug('[startLocalRelay] 全部字节(' + data.length + '): ' + data.toString('hex'));
    writeDebug('[startLocalRelay] UTF8尝试: "' + data.toString('utf8').replace(/[\x00-\x1f\x7f-\xff]/g, '.') + '"');
    writeDebug('[startLocalRelay] ASCII尝试: "' + data.toString('ascii').replace(/[\x00-\x1f\x7f]/g, '.') + '"');
    // 过滤 HTTP 探测包
    if (isHttpProbe(data)) {
      log('忽略 HTTP 探测包 (' + data.length + ' 字节)');
      writeDebug('[startLocalRelay] 忽略 HTTP 探测包，不转发');
      return;
    }
    // 检测新玩家连接的 Handshake 包：
    // 如果已有 gameSocket（上一个玩家可能已断开但 close 事件还没触发），强制重建 socket
    if (isMinecraftHandshake(data) && gameSocket && gameConnected) {
      log('[诊断] 检测到新玩家 Handshake 包，重建 gameSocket');
      writeDebug('[startLocalRelay] 检测到新玩家 Handshake 包，重建 gameSocket');
      const old = gameSocket;
      gameSocket = null;
      gameConnected = false;
      pendingQueue = [];
      try { old.destroy(); } catch (_) {}
    }
    writeWithRetry(data, 3);
  });

  controlSocket.on('error', (e) => {
    log('控制连接错误: ' + e.message);
  });
  controlSocket.on('close', () => {
    log('控制连接已关闭');
    stopped = true;
    if (gameSocket) { try { gameSocket.end(); } catch (_) {} }
    state.running = false;
    state.controlSocket = null;
    if (state._healthTimer) {
      clearInterval(state._healthTimer);
      state._healthTimer = null;
    }
    if (!state.stopping) {
      if (state.tunnel && state.apikey) {
        closeTunnel(state.tunnel.serverAddress, state.apikey).catch(() => {});
      }
      state.tunnel = null;
      scheduleReconnect(log);
    } else {
      state.tunnel = null;
    }
  });
}

/**
 * 关闭隧道
 * @param {(msg:string)=>void} onLog
 */
async function stopTunnel(onLog) {
  const log = (msg) => { try { onLog(msg); } catch (_) {} };
  if (state.stopping) return { ok: true };
  state.stopping = true;

  log('正在关闭隧道...');

  // 关闭本地中转 socket
  for (const s of state.localRelaySockets) {
    try { s.end(); s.destroy(); } catch (_) {}
  }
  state.localRelaySockets = [];

  // 关闭控制连接
  if (state.controlSocket) {
    try { state.controlSocket.end(); state.controlSocket.destroy(); } catch (_) {}
    state.controlSocket = null;
  }

  // 调用 HTTP API 删除隧道
  if (state.tunnel && state.apikey) {
    try {
      const r = await closeTunnel(state.tunnel.serverAddress, state.apikey);
      log('DELETE /tunnels -> ' + r.statusCode + ' ' + r.body);
    } catch (e) {
      log('关闭隧道 API 失败: ' + e.message);
    }
  }

  state.tunnel = null;
  state.running = false;
  state.stopping = false;

  // 清除保活定时器
  if (state._healthTimer) {
    clearInterval(state._healthTimer);
    state._healthTimer = null;
  }

  // 清除游戏端口健康检查
  if (state._gameHealthTimer) {
    clearInterval(state._gameHealthTimer);
    state._gameHealthTimer = null;
  }

  // 清理自动重连状态（用户主动停止，不再重连）
  if (state._reconnectTimer) {
    clearTimeout(state._reconnectTimer);
    state._reconnectTimer = null;
  }
  state._lastParams = null;
  state._onLog = null;
  state._reconnectAttempts = 0;
  state._reconnecting = false;

  log('隧道已关闭');
  return { ok: true };
}

// ===================================================================
// MC 局域网端口自动扫描
// ===================================================================

const { exec } = require('child_process');

/**
 * 扫描本机 java 进程的 TCP 监听端口，找到 Minecraft 局域网服务器端口
 * 适用于游戏已运行但并非由启动器启动（process-manager 未追踪）的情况
 *
 * 原理：
 *   1. tasklist 找到所有 java.exe 的 PID
 *   2. netstat -ano 过滤出这些 PID 的 LISTENING 端口
 *   3. 对每个候选端口做 TCP 连接测试，返回第一个能连上的端口
 */
function scanMinecraftPort() {
  return new Promise((resolve) => {
    // 1. 获取所有 java.exe PID
    exec('tasklist /FI "IMAGENAME eq java.exe" /FO CSV /NH', { timeout: 3000 }, (err1, stdout1) => {
      if (err1) return resolve(null);
      const pids = stdout1.trim().split('\n')
        .filter(l => l.trim())
        .map(l => {
          const m = l.match(/"(\d+)"/);
          return m ? m[1] : null;
        })
        .filter(Boolean);
      if (pids.length === 0) return resolve(null);

      // 2. 获取所有 LISTENING 端口
      exec('netstat -ano', { timeout: 5000 }, (err2, stdout2) => {
        if (err2) return resolve(null);
        // 收集 java 进程的监听端口
        const candidatePorts = [];
        for (const line of stdout2.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.includes('LISTENING')) continue;
          const pidMatch = trimmed.match(/(\d+)$/);
          if (!pidMatch) continue;
          if (!pids.includes(pidMatch[1])) continue;
          // 解析端口号（支持 IPv4 0.0.0.0:25565 和 IPv6 [::]:25565）
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2) {
            const localAddr = parts[1];
            const portMatch = localAddr.match(/:(\d+)$/);
            if (portMatch) {
              const port = parseInt(portMatch[1], 10);
              if (port > 0 && port < 65536) candidatePorts.push(port);
            }
          }
        }
        if (candidatePorts.length === 0) return resolve(null);

        // 3. TCP 连接测试——找第一个能连上的
        let idx = 0;
        const tryNext = () => {
          if (idx >= candidatePorts.length) return resolve(null);
          const port = candidatePorts[idx++];
          const s = net.connect(port, '127.0.0.1', () => {
            s.end();
            s.destroy();
            resolve(port);
          });
          s.setTimeout(500);
          s.once('error', () => { s.destroy(); tryNext(); });
          s.once('timeout', () => { s.destroy(); tryNext(); });
        };
        tryNext();
      });
    });
  });
}

// ===================================================================
// IPC 通道
// ===================================================================

function registerRedstoneOnlineIPC() {
  // 拉取服务器列表
  ipcMain.handle('redstone:servers', async () => {
    try {
      const list = await fetchServerList();
      state.servers = list;
      return { ok: true, servers: list };
    } catch (e) {
      return { ok: false, error: e.message, servers: state.servers };
    }
  });

  // 获取当前 API Key（不存在则生成）
  ipcMain.handle('redstone:apikey', async () => {
    try {
      if (!state.apikey) state.apikey = loadOrCreateApikey();
      return { ok: true, apikey: state.apikey };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // 重置 API Key（生成新的并保存）
  ipcMain.handle('redstone:apikey-reset', async () => {
    try {
      const newKey = makeApikey();
      fs.mkdirSync(REDSTONE_DIR, { recursive: true });
      fs.writeFileSync(APIKEY_FILE, newKey, 'utf8');
      state.apikey = newKey;
      return { ok: true, apikey: newKey };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // 扫描 MC 局域网端口（自动探测 java 进程监听的端口）
  ipcMain.handle('redstone:scan-port', async () => {
    try {
      const port = await scanMinecraftPort();
      return { ok: true, port };
    } catch (e) {
      return { ok: false, error: e.message, port: null };
    }
  });

  // 启动隧道
  // 渲染进程通过 redstone:log 事件接收日志
  ipcMain.handle('redstone:start', async (event, params) => {
    const sender = event.sender;
    state._sender = sender; // 保存 sender 供断连通知使用
    const onLog = (msg) => {
      try { sender.send('redstone:log', msg); } catch (_) {}
    };
    return await startTunnel(params || {}, onLog);
  });

  // 关闭隧道
  ipcMain.handle('redstone:stop', async (event) => {
    const sender = event.sender;
    const onLog = (msg) => {
      try { sender.send('redstone:log', msg); } catch (_) {}
    };
    return await stopTunnel(onLog);
  });

  // 查询当前状态
  ipcMain.handle('redstone:status', async () => {
    return {
      ok: true,
      running: state.running,
      address: state.tunnel ? state.tunnel.address : null,
      listenPort: state.tunnel ? state.tunnel.listenPort : null,
      title: state.tunnel ? state.tunnel.title : '',
      description: state.tunnel ? state.tunnel.description : '',
      publicAccess: state.tunnel ? state.tunnel.publicAccess : true,
      allowOffline: state.tunnel ? state.tunnel.allowOffline : false,
      apikey: state.apikey,
      servers: state.servers,
      reconnecting: state._reconnecting,
      reconnectAttempt: state._reconnectAttempts,
      reconnectMaxAttempts: state._reconnectMaxAttempts,
    };
  });

  // 拉取公开房间列表（联机大厅）
  // 参数: { serverAddress, offset }
  ipcMain.handle('redstone:public-tunnels', async (event, params) => {
    try {
      const p = params || {};
      const serverAddress = p.serverAddress || (state.servers[0] && state.servers[0].address);
      if (!serverAddress) {
        return { ok: false, error: '未指定服务器节点', tunnels: [] };
      }
      // 确保 apikey 已加载（listPublicTunnels 降级时可能需要）
      if (!state.apikey) state.apikey = loadOrCreateApikey();
      const data = await listPublicTunnels(serverAddress, p.offset || 0);
      return { ok: true, tunnels: data.tunnels || [], serverAddress };
    } catch (e) {
      writeDebug(`[public-tunnels handler] ERROR: ${e.message}`);
      return { ok: false, error: e.message, tunnels: [] };
    }
  });

  // 获取单个公开房间的模组列表
  // 参数: { serverAddress, tunnelId }
  ipcMain.handle('redstone:tunnel-mods', async (event, params) => {
    try {
      const p = params || {};
      const serverAddress = p.serverAddress || (state.servers[0] && state.servers[0].address);
      if (!serverAddress) {
        return { ok: false, error: '未指定服务器节点', mods: [] };
      }
      if (!state.apikey) state.apikey = loadOrCreateApikey();
      const data = await getTunnelMods(serverAddress, p.tunnelId);
      return { ok: true, mods: data.mods || [], serverAddress };
    } catch (e) {
      writeDebug(`[tunnel-mods handler] ERROR: ${e.message}`);
      return { ok: false, error: e.message, mods: [] };
    }
  });
}

module.exports = { registerRedstoneOnlineIPC };
