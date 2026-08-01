/**
 * main/server-host.js - 本地开服全流程 IPC
 *
 * 参考 Minecraft Wiki / 常见启动器方案：
 *   1. 解析版本 JSON（含 inheritsFrom 链）拿到 downloads.server
 *   2. 下载 server.jar 到 DATA_DIR/servers/<id>/
 *   3. 写 eula.txt=true + server.properties
 *   4. spawn java -jar server.jar --nogui，管道 stdin/stdout 做控制台
 *   5. stop 指令优雅关服；必要时 kill
 *
 * 实验范围：优先原版完整链路；Forge/Fabric 等先解析基岩版 server.jar 并提示
 * 模组端完整安装器链路后续迭代。
 */

const { ipcMain, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const { DATA_DIR, VERSIONS_DIR } = require('./paths');

const SERVERS_ROOT = path.join(DATA_DIR, 'servers');
const INDEX_FILE = path.join(SERVERS_ROOT, 'index.json');

/** @type {Map<string, {proc: import('child_process').ChildProcess, dir: string, name: string, port: number, starting: boolean}>} */
const _running = new Map();

/**
 * 当前正在进行的创建任务状态（用于取消）
 * @type {{aborted: boolean, proc: import('child_process').ChildProcess|null, req: import('http').ClientRequest|null}}
 */
let _activeCreate = { aborted: false, proc: null, req: null };

function ensureRoot() {
  fs.mkdirSync(SERVERS_ROOT, { recursive: true });
  if (!fs.existsSync(INDEX_FILE)) {
    fs.writeFileSync(INDEX_FILE, JSON.stringify({ servers: [] }, null, 2), 'utf8');
  }
}

function loadIndex() {
  ensureRoot();
  try {
    const raw = fs.readFileSync(INDEX_FILE, 'utf8').replace(/^\uFEFF/, '');
    const j = JSON.parse(raw);
    if (!j || !Array.isArray(j.servers)) return { servers: [] };
    return j;
  } catch (_) {
    return { servers: [] };
  }
}

function saveIndex(idx) {
  ensureRoot();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(idx, null, 2), 'utf8');
}

function sanitizeName(name) {
  return String(name || 'MyServer')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64) || 'MyServer';
}

function serverDirOf(id) {
  return path.join(SERVERS_ROOT, id);
}

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      if (!win.isDestroyed()) win.webContents.send(channel, payload);
    } catch (_) {}
  }
}

function emitLog(id, line, stream = 'out') {
  broadcast('server-host:log', { id, line: String(line).replace(/\r/g, ''), stream, ts: Date.now() });
}

function emitStatus(id, status, extra = {}) {
  broadcast('server-host:status', { id, status, ...extra, ts: Date.now() });
}

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
  } catch (_) {
    return null;
  }
}

/**
 * 沿 inheritsFrom 链查找带 downloads.server 的版本 JSON
 */
function resolveServerDownload(versionId) {
  const visited = new Set();
  let cur = versionId;
  let depth = 0;
  while (cur && depth < 12 && !visited.has(cur)) {
    visited.add(cur);
    depth++;
    const jsonPath = path.join(VERSIONS_DIR, cur, `${cur}.json`);
    let data = null;
    if (fs.existsSync(jsonPath)) {
      data = readJsonSafe(jsonPath);
    } else {
      // 有些整合包目录名与 id 不一致：扫描 versions 下找 id 匹配
      try {
        for (const d of fs.readdirSync(VERSIONS_DIR, { withFileTypes: true })) {
          if (!d.isDirectory()) continue;
          const cand = path.join(VERSIONS_DIR, d.name, `${d.name}.json`);
          if (!fs.existsSync(cand)) continue;
          const j = readJsonSafe(cand);
          if (j && (j.id === cur || d.name === cur)) {
            data = j;
            break;
          }
        }
      } catch (_) {}
    }
    if (!data) break;
    if (data.downloads && data.downloads.server && data.downloads.server.url) {
      return {
        versionId: data.id || cur,
        server: data.downloads.server,
        javaVersion: data.javaVersion || null,
        inheritsFrom: data.inheritsFrom || null,
        chain: Array.from(visited)
      };
    }
    cur = data.inheritsFrom || null;
  }
  return null;
}

function loadVersionJson(versionId) {
  if (!versionId) return null;
  const direct = path.join(VERSIONS_DIR, versionId, `${versionId}.json`);
  if (fs.existsSync(direct)) return readJsonSafe(direct);
  try {
    for (const d of fs.readdirSync(VERSIONS_DIR, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const cand = path.join(VERSIONS_DIR, d.name, `${d.name}.json`);
      if (!fs.existsSync(cand)) continue;
      const j = readJsonSafe(cand);
      if (j && (j.id === versionId || d.name === versionId)) return j;
    }
  } catch (_) {}
  return null;
}

/**
 * 识别客户端版本的加载器类型与版本号
 */
function detectClientLoader(versionId) {
  const data = loadVersionJson(versionId);
  let cur = data;
  let chain = [];
  let depth = 0;
  while (cur && depth < 12) {
    chain.push(cur);
    depth++;
    if (cur.inheritsFrom) cur = loadVersionJson(cur.inheritsFrom);
    else break;
  }
  const top = data || {};
  const allLibs = chain.flatMap(j => (j && Array.isArray(j.libraries) ? j.libraries : []));
  const libStr = allLibs.map(l => (l && l.name) || '').join(' ') + ' ' + JSON.stringify(top.mainClass || '');
  // 从 arguments.game 抽取 fml.* 版本（NeoForge/Forge 21+ 不会在 libraries 写 neoforge:neoforge）
  let fmlNeo = null, fmlForge = null, fmlMc = null;
  for (const j of chain) {
    const g = (j && j.arguments && j.arguments.game) || [];
    for (let i = 0; i < g.length; i++) {
      const v = String(g[i] || '');
      if (v === '--fml.neoForgeVersion' && g[i + 1]) fmlNeo = String(g[i + 1]);
      else if (v === '--fml.forgeVersion' && g[i + 1]) fmlForge = String(g[i + 1]);
      else if (v === '--fml.mcVersion' && g[i + 1]) fmlMc = String(g[i + 1]);
    }
    if (fmlNeo || fmlForge) break;
  }
  const idLower = String(versionId || '').toLowerCase();

  let loader = 'vanilla';
  let loaderVersion = null;
  let mcVersion = null;
  if (fmlMc) mcVersion = fmlMc;

  for (const j of [...chain].reverse()) {
    if (j && j.downloads && j.downloads.server) {
      const dj = j.id || '';
      // 只有 mcVersion 还是包名或 null 时才用链中版本；避免覆盖 fmlMc
      if (!mcVersion || mcVersion === versionId || !/^\d+\.\d+/.test(mcVersion)) {
        mcVersion = dj || mcVersion;
      }
      break;
    }
  }
  if (!mcVersion || !/^\d+\.\d+/.test(mcVersion)) {
    const m = String(versionId).match(/(\d+\.\d+(?:\.\d+)?(?:-pre\d+|-rc\d+)?)/);
    if (m) { mcVersion = m[1]; }
    // 仍无结果时从 loaderVersion 反推（Forge 1.20.1-47.4.20 → 1.20.1；Fabric 无）
    if ((!mcVersion || !/^\d+\.\d+/.test(mcVersion)) && fmlMc) mcVersion = fmlMc;
    if ((!mcVersion || !/^\d+\.\d+/.test(mcVersion)) && fmlForge) {
      const mm = String(fmlForge).match(/^(\d+\.\d+(?:\.\d+)?)-/);
      if (mm) mcVersion = mm[1];
    }
  }

  const neoMatch = libStr.match(/net\.neoforged:(?:neoforge|forge):([^:\s"]+)/i)
    || idLower.match(/neoforge[-_]?(\d+\.\d+\.\d+[^\s/]*)/i)
    || String(versionId).match(/NeoForge[-_ ]?(\d[\d.\-\w]*)/i);
  const isNeo = !!(neoMatch || fmlNeo || /neoforge/i.test(libStr) || /fancymodloader/i.test(libStr) || /neoforge/i.test(idLower));
  if (isNeo) {
    loader = 'neoforge';
    if (fmlNeo) {
      loaderVersion = fmlNeo;
    } else if (neoMatch) {
      loaderVersion = (neoMatch[1] || neoMatch[0]) || null;
      if (loaderVersion && /neoforge/i.test(loaderVersion)) {
        const m2 = String(loaderVersion).match(/(\d+\.\d+\.\d+[\w.-]*)/);
        if (m2) loaderVersion = m2[1];
      }
    } else {
      loaderVersion = null;
    }
  } else {
    const forgeMatch = libStr.match(/net\.minecraftforge:forge:([^:\s"]+)/i)
      || libStr.match(/net\.minecraftforge:fmlloader:([^:\s"]+)/i);
    const idForge = String(versionId).match(/(\d+\.\d+(?:\.\d+)?)-[Ff]orge-(\d+\.\d+[\w.-]*)/);
    const isForge = !!(idForge || forgeMatch || fmlForge || /minecraftforge|modlauncher/i.test(libStr) || (/forge/i.test(idLower) && !/fabric/i.test(idLower)));
    if (isForge) {
      loader = 'forge';
      if (idForge) {
        mcVersion = mcVersion || idForge[1];
        loaderVersion = idForge[1] + '-' + idForge[2];
      } else if (forgeMatch) {
        loaderVersion = forgeMatch[1];
        // fmlloader:1.20.1-47.4.20 → 反推 mc 版本
        if (!mcVersion) {
          const m = String(loaderVersion).match(/^(\d+\.\d+(?:\.\d+)?)-/);
          if (m) mcVersion = m[1];
        }
      } else if (fmlForge) {
        loaderVersion = fmlForge;
        if (!mcVersion && fmlMc) mcVersion = fmlMc;
      }
    } else {
      const fabMatch = libStr.match(/net\.fabricmc:fabric-loader:([^:\s"]+)/i);
      const idFab = String(versionId).match(/(\d+\.\d+(?:\.\d+)?)-[Ff]abric[-_ ]?(\d+\.\d+\.\d+)/)
        || String(versionId).match(/[Ff]abric[-_ ](\d+\.\d+\.\d+)/);
      if (fabMatch || idFab || /fabric-loader|net\.fabricmc/i.test(libStr) || /fabric/i.test(idLower)) {
        loader = 'fabric';
        if (idFab && idFab[2]) {
          mcVersion = mcVersion || idFab[1];
          loaderVersion = idFab[2];
        } else if (idFab) {
          loaderVersion = idFab[1];
        } else if (fabMatch) {
          loaderVersion = fabMatch[1];
        }
      }
    }
  }

  // Fabric: intermediary 推导 MC
  if (loader === 'fabric' && (!mcVersion || !/^\d+\.\d+/.test(mcVersion))) {
    const im = allLibs.find(l => /net\.fabricmc:intermediary:/i.test(l && l.name || ''));
    if (im) {
      const mm = (im.name || '').match(/intermediary:(\d+\.\d+(?:\.\d+)?)/);
      if (mm) mcVersion = mm[1];
    }
  }

  if (loader === 'forge' && loaderVersion && mcVersion && !loaderVersion.includes(mcVersion) && /^\d+\.\d+/.test(loaderVersion)) {
    if (!/^\d+\.\d+(\.\d+)?-/.test(loaderVersion)) {
      loaderVersion = `${mcVersion}-${loaderVersion}`;
    }
  }


  // 从 loaderVersion 反推 mcVersion（仅 forge/neoforge）
  if ((!mcVersion || !/^\d+\.\d+/.test(mcVersion)) && loaderVersion && loader !== 'fabric') {
    const mm = String(loaderVersion).match(/^(\d+\.\d+(?:\.\d+)?)(?:-|$)/);
    if (mm) mcVersion = mm[1];
  }

  // Fabric 整合包：从 intermediary 库推导 MC 版本
  if (loader === 'fabric' && (!mcVersion || !/^\d+\.\d+/.test(mcVersion))) {
    const im = allLibs.find(l => /net\.fabricmc:intermediary:/i.test(l && l.name || ''));
    if (im) {
      const mm = (im.name || '').match(/intermediary:(\d+\.\d+(?:\.\d+)?)/);
      if (mm) mcVersion = mm[1];
    }
  }

  // Fabric 整合包：扫描同级 fabric-loader 目录
  if (loader === 'fabric' && (!mcVersion || !/^\d+\.\d+/.test(mcVersion))) {
    try {
      for (const d of fs.readdirSync(VERSIONS_DIR, { withFileTypes: true })) {
        if (d.isDirectory()) {
          const m = d.name.match(/^fabric-loader-(\d+\.\d+\.\d+)-(\d+\.\d+(?:\.\d+)?)/);
          if (m && m[1] === loaderVersion) { mcVersion = m[2]; break; }
        }
      }
    } catch (_) {}
    if ((!mcVersion || !/^\d+\.\d+/.test(mcVersion)) && data && data.assets) {
      const aid = String(data.assets);
      const assetMap = {'8':'1.16','9':'1.17','10':'1.18','11':'1.19','12':'1.20','13':'1.20.1','14':'1.20.2','15':'1.20.3','16':'1.20.4','17':'1.20.5','18':'1.20.6','19':'1.21','20':'1.21.1','21':'1.21.2','22':'1.21.3','23':'1.21.4','24':'1.21.5','25':'26.0','26':'26.1','27':'26.1','28':'26.1','29':'26.2','30':'26.2','31':'26.2','32':'26.2'};
      if (assetMap[aid]) mcVersion = assetMap[aid];
    }
  }

  // NeoForge 版本映射
  if (loader === 'neoforge' && loaderVersion && (!mcVersion || !/^\d+\.\d+/.test(mcVersion))) {
    const nf = String(loaderVersion);
    if (/^20\.6/.test(nf)) mcVersion = '1.20.6';
    else if (/^21\.1/.test(nf)) mcVersion = '1.21.1';
    else if (/^21\.4/.test(nf)) mcVersion = '1.21.5';
    else if (/^26\.1/.test(nf)) mcVersion = '26.1';
  }
  return {
    loader,
    loaderVersion,
    mcVersion: mcVersion || resolvedBase(versionId),
    versionJson: data,
    chainIds: chain.map(c => c && c.id).filter(Boolean)
  };
}

function resolvedBase(versionId) {
  const r = resolveServerDownload(versionId);
  return (r && r.versionId) || versionId;
}

function runJavaJar(javaPath, args, cwd, onLine, timeoutMs = 600000, abortRef) {
  return new Promise((resolve, reject) => {
    if (abortRef && abortRef.aborted) return reject(new Error('已取消'));
    const proc = spawn(javaPath, args, {
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    });
    if (abortRef) abortRef.proc = proc;
    let out = '';
    const onData = (buf) => {
      const text = buf.toString('utf8');
      out += text;
      for (const line of text.split(/\r?\n/)) {
        if (line && onLine) onLine(line);
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    const timer = setTimeout(() => {
      try { proc.kill(); } catch (_) {}
      reject(new Error(`命令超时 (${timeoutMs}ms): java ${args.join(' ')}`));
    }, timeoutMs);
    proc.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (abortRef && abortRef.aborted) {
        reject(new Error('已取消'));
        return;
      }
      if (code === 0) resolve({ code, out });
      else reject(new Error(`进程退出码 ${code}\n${out.slice(-800)}`));
    });
  });
}

async function downloadWithFallback(urls, destPath, onProgress, onLog, abortRef) {
  let lastErr = null;
  for (const url of urls) {
    if (abortRef && abortRef.aborted) throw new Error('已取消');
    try {
      if (onLog) onLog(`[VersePC] 下载: ${url}`);
      await downloadFile(url, destPath, onProgress, abortRef);
      if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1024) return url;
    } catch (e) {
      if (abortRef && abortRef.aborted) throw e;
      lastErr = e;
      if (onLog) onLog(`[VersePC] 下载失败: ${e.message}`);
      try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (_) {}
      try { if (fs.existsSync(destPath + '.part')) fs.unlinkSync(destPath + '.part'); } catch (_) {}
    }
  }
  throw lastErr || new Error('所有下载源均失败');
}

function httpsGetJson(urls) {
  const list = Array.isArray(urls) ? urls : [urls];
  return new Promise(async (resolve, reject) => {
    let last = null;
    for (const u of list) {
      try {
        const text = await new Promise((res, rej) => {
          let parsed;
          try { parsed = new URL(u); } catch (e) { return rej(e); }
          const lib = parsed.protocol === 'https:' ? https : http;
          const req = lib.get(u, { headers: { 'User-Agent': 'VersePC/1.0' }, timeout: 20000 }, (r) => {
            if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
              r.resume();
              return httpsGetJson(r.headers.location).then((j) => res(JSON.stringify(j)), rej);
            }
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => {
              if (r.statusCode !== 200) return rej(new Error('HTTP ' + r.statusCode));
              res(d);
            });
          });
          req.on('error', rej);
          req.on('timeout', () => { try { req.destroy(); } catch (_) {} rej(new Error('timeout')); });
        });
        return resolve(typeof text === 'string' ? JSON.parse(text) : text);
      } catch (e) {
        last = e;
      }
    }
    reject(last || new Error('fetch failed'));
  });
}

function detectLaunchKind(dir) {
  if (fs.existsSync(path.join(dir, 'run.bat')) || fs.existsSync(path.join(dir, 'run.sh'))) return 'run-script';
  if (fs.existsSync(path.join(dir, 'fabric-server-launch.jar'))) return 'fabric-launch';
  try {
    const files = fs.readdirSync(dir);
    const shim = files.find(f => /forge-.*(-shim)?\.jar$/i.test(f) && !/installer/i.test(f) && f !== 'server.jar');
    if (shim) return 'forge-jar:' + shim;
    if (files.includes('unix_args.txt') || files.includes('win_args.txt')) return 'argfile';
  } catch (_) {}
  if (fs.existsSync(path.join(dir, 'server.jar'))) return 'server-jar';
  return 'unknown';
}

function resolveClientModsDir(versionId) {
  try {
    const versions = require('../server/versions');
    if (versions && typeof versions.getVersionModsDir === 'function') {
      const d = versions.getVersionModsDir(versionId);
      if (d) return d;
    }
  } catch (e) {
    console.warn('[ServerHost] getVersionModsDir failed:', e.message);
  }
  const cand = path.join(VERSIONS_DIR, versionId, 'mods');
  if (fs.existsSync(cand)) return cand;
  const globalMods = path.join(DATA_DIR, 'mods');
  if (fs.existsSync(globalMods)) return globalMods;
  return cand;
}

/**
 * Forge: java -jar installer.jar --installServer
 * Fabric: java -jar fabric-installer.jar server -mcversion X -loader Y -dir DIR -downloadMinecraft
 */
async function installModdedServer(entry, loaderInfo, opts = {}) {
  const dir = entry.dir || serverDirOf(entry.id);
  const id = entry.id;
  const requiredMajor = entry.javaMajor || resolveRequiredJavaMajor(loaderInfo.mcVersion || entry.versionId);
  emitLog(id, `[VersePC] 安装器需要 Java ${requiredMajor}+`);
  const javaPick = await findJavaForServer(requiredMajor, (m) => emitLog(id, m));
  const javaPath = javaPick.javaPath;
  const syncMods = opts.syncMods !== false;
  const abortRef = opts.abortRef || _activeCreate;

  if (loaderInfo.loader === 'forge' || loaderInfo.loader === 'neoforge') {
    const isNeo = loaderInfo.loader === 'neoforge';
    let ver = loaderInfo.loaderVersion;
    if (!ver) throw new Error('无法解析 Forge/NeoForge 版本号，请确认客户端版本完整');
    if (!isNeo && loaderInfo.mcVersion && !ver.includes(loaderInfo.mcVersion)) {
      ver = `${loaderInfo.mcVersion}-${ver.replace(/^.*?(\d+\.\d+[\w.-]*)$/, '$1')}`;
    }

    const installerName = isNeo ? `neoforge-${ver}-installer.jar` : `forge-${ver}-installer.jar`;
    const installerPath = path.join(dir, installerName);
    emitStatus(id, 'downloading', { progress: 0, message: `下载 ${isNeo ? 'NeoForge' : 'Forge'} 安装器...`, stage: 'installer' });

    const urls = isNeo
      ? [
          `https://bmclapi2.bangbang93.com/maven/net/neoforged/neoforge/${ver}/neoforge-${ver}-installer.jar`,
          `https://maven.neoforged.net/releases/net/neoforged/neoforge/${ver}/neoforge-${ver}-installer.jar`,
          `https://bmclapi2.bangbang93.com/maven/net/neoforged/forge/${ver}/forge-${ver}-installer.jar`,
          `https://maven.neoforged.net/releases/net/neoforged/forge/${ver}/forge-${ver}-installer.jar`
        ]
      : [
          `https://bmclapi2.bangbang93.com/maven/net/minecraftforge/forge/${ver}/forge-${ver}-installer.jar`,
          `https://maven.minecraftforge.net/net/minecraftforge/forge/${ver}/forge-${ver}-installer.jar`
        ];

    await downloadWithFallback(urls, installerPath, (p) => {
      emitStatus(id, 'downloading', {
        progress: p.progress,
        message: `下载安装器 ${Math.round(p.progress)}%`,
        stage: 'installer'
      });
    }, (line) => emitLog(id, line), abortRef);

    emitStatus(id, 'installing', { progress: null, indeterminate: true, message: `正在安装 ${isNeo ? 'NeoForge' : 'Forge'} 服务端...`, stage: 'install' });
    emitLog(id, `[VersePC] 运行安装器: ${javaPath} -jar ${installerName} --installServer`);

    try {
      await runJavaJar(javaPath, ['-jar', installerName, '--installServer', dir], dir, (line) => emitLog(id, line), 900000, abortRef);
    } catch (e1) {
      if (abortRef && abortRef.aborted) throw e1;
      emitLog(id, `[VersePC] 安装器参数回退: --installServer (${e1.message})`);
      await runJavaJar(javaPath, ['-jar', installerName, '--installServer'], dir, (line) => emitLog(id, line), 900000, abortRef);
    }

    entry.loader = loaderInfo.loader;
    entry.loaderVersion = ver;
    entry.launchKind = detectLaunchKind(dir);
    try { fs.unlinkSync(installerPath); } catch (_) {}
    emitLog(id, `[VersePC] ${isNeo ? 'NeoForge' : 'Forge'} 服务端安装完成, launch=${entry.launchKind}`);
  } else if (loaderInfo.loader === 'fabric') {
    const mc = loaderInfo.mcVersion || resolvedBase(entry.versionId);
    let loaderVer = loaderInfo.loaderVersion;
    if (!loaderVer) {
      try {
        const body = await httpsGetJson([
          'https://meta.fabricmc.net/v2/versions/loader/' + encodeURIComponent(mc),
          'https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/loader/' + encodeURIComponent(mc)
        ]);
        if (Array.isArray(body) && body[0] && body[0].loader && body[0].loader.version) {
          loaderVer = body[0].loader.version;
        }
      } catch (e) {
        emitLog(id, `[VersePC] 获取 Fabric loader 版本失败: ${e.message}`);
      }
    }
    if (!loaderVer) throw new Error('无法解析 Fabric Loader 版本');

    const installerPath = path.join(dir, 'fabric-installer.jar');
    emitStatus(id, 'downloading', { progress: 0, message: '下载 Fabric 安装器...', stage: 'installer' });
    await downloadWithFallback([
      'https://bmclapi2.bangbang93.com/maven/net/fabricmc/fabric-installer/1.0.1/fabric-installer-1.0.1.jar',
      'https://maven.fabricmc.net/net/fabricmc/fabric-installer/1.0.1/fabric-installer-1.0.1.jar',
      'https://maven.fabricmc.net/net/fabricmc/fabric-installer/0.11.2/fabric-installer-0.11.2.jar'
    ], installerPath, (p) => {
      emitStatus(id, 'downloading', {
        progress: p.progress,
        message: `下载 Fabric 安装器 ${Math.round(p.progress)}%`,
        stage: 'installer'
      });
    }, (line) => emitLog(id, line), abortRef);

    emitStatus(id, 'installing', { progress: null, indeterminate: true, message: '正在安装 Fabric 服务端...', stage: 'install' });
    emitLog(id, `[VersePC] Fabric server -mcversion ${mc} -loader ${loaderVer}`);
    await runJavaJar(javaPath, [
      '-jar', 'fabric-installer.jar',
      'server',
      '-mcversion', mc,
      '-loader', loaderVer,
      '-dir', dir,
      '-downloadMinecraft'
    ], dir, (line) => emitLog(id, line), 900000, abortRef);

    entry.loader = 'fabric';
    entry.loaderVersion = loaderVer;
    entry.baseVersion = mc;
    entry.launchKind = detectLaunchKind(dir);
    try { fs.unlinkSync(installerPath); } catch (_) {}
    emitLog(id, `[VersePC] Fabric 服务端安装完成`);
  } else {
    throw new Error('未知加载器类型: ' + loaderInfo.loader);
  }

  writeEula(dir);
  writeServerProperties(dir, {
    port: entry.port,
    motd: entry.name,
    onlineMode: entry.onlineMode !== false
  });

  let modSync = null;
  if (syncMods) {
    modSync = await syncClientModsToServer(entry, (msg, pct) => {
      emitStatus(id, 'syncing-mods', {
        progress: pct != null ? pct : null,
        indeterminate: pct == null,
        message: msg,
        stage: 'mods'
      });
      emitLog(id, `[VersePC] ${msg}`);
    });
  }

  return {
    loader: entry.loader,
    loaderVersion: entry.loaderVersion,
    launchKind: entry.launchKind,
    modSync
  };
}

/**
 * 一键同步客户端 mods 到服务端
 */
async function syncClientModsToServer(entry, onProgress) {
  const versionId = entry.versionId;
  const srcMods = resolveClientModsDir(versionId);
  const destMods = path.join(entry.dir || serverDirOf(entry.id), 'mods');
  fs.mkdirSync(destMods, { recursive: true });

  if (!fs.existsSync(srcMods)) {
    return { ok: true, copied: 0, skipped: 0, source: srcMods, message: '客户端无 mods 目录' };
  }

  const files = fs.readdirSync(srcMods).filter(f => /\.jar$/i.test(f) && !f.startsWith('.'));
  let copied = 0;
  let skipped = 0;
  let clientOnly = 0;
  const CLIENT_NAME_HINTS = [
    /optifine/i, /sodium/i, /iris/i, /rubidium/i, /oculus/i,
    /notenoughanimations/i, /entityculling/i, /fabrishot/i, /modmenu/i,
    /reeses-sodium/i, /immediatelyfast/i, /dynamic-fps/i, /zoomify/i,
    /controllable/i, /mousewheelie/i, /xaero/i, /journeymap/i,
    /minimap/i, /litematica/i, /tweakeroo/i, /malilib/i,
    /replaymod/i, /freecam/i, /bobby/i
  ];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const pct = files.length ? Math.round(((i + 1) / files.length) * 100) : 100;
    if (onProgress) onProgress(`同步模组 ${i + 1}/${files.length}: ${f}`, pct);

    if (CLIENT_NAME_HINTS.some(re => re.test(f))) {
      clientOnly++;
      skipped++;
      continue;
    }

    let envClientOnly = false;
    try {
      const { readJarEntryContent } = require('./jar-parser');
      const raw = await readJarEntryContent(path.join(srcMods, f), 'fabric.mod.json');
      if (raw) {
        const fm = JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, ''));
        if (fm && (fm.environment === 'client' || (Array.isArray(fm.environment) && fm.environment.length === 1 && fm.environment[0] === 'client'))) {
          envClientOnly = true;
        }
      }
    } catch (_) {}

    if (!envClientOnly) {
      try {
        const { readJarEntryContent } = require('./jar-parser');
        const raw = await readJarEntryContent(path.join(srcMods, f), 'META-INF/mods.toml');
        if (raw) {
          const txt = raw.toString('utf8');
          if (/clientSideOnly\s*=\s*true/i.test(txt)) envClientOnly = true;
        }
      } catch (_) {}
    }

    if (envClientOnly) {
      clientOnly++;
      skipped++;
      continue;
    }

    const src = path.join(srcMods, f);
    const dest = path.join(destMods, f);
    try {
      if (fs.existsSync(dest) && fs.statSync(dest).size === fs.statSync(src).size) {
        skipped++;
        continue;
      }
      fs.copyFileSync(src, dest);
      copied++;
    } catch (_) {
      skipped++;
    }
  }

  return {
    ok: true,
    copied,
    skipped,
    clientOnly,
    total: files.length,
    source: srcMods,
    dest: destMods,
    message: `已同步 ${copied} 个模组（跳过客户端 ${clientOnly}，其他跳过 ${Math.max(0, skipped - clientOnly)}）`
  };
}


function downloadFile(url, destPath, onProgress, abortRef) {
  return new Promise((resolve, reject) => {
    if (abortRef && abortRef.aborted) return reject(new Error('已取消'));
    const doGet = (u, redirects = 0) => {
      if (redirects > 8) return reject(new Error('下载重定向过多'));
      if (abortRef && abortRef.aborted) return reject(new Error('已取消'));
      let parsed;
      try { parsed = new URL(u); } catch (e) { return reject(e); }
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.get(u, {
        headers: { 'User-Agent': 'VersePC/1.0 (ServerHost)' },
        timeout: 120000
      }, (res) => {
        if (abortRef && abortRef.aborted) {
          res.resume();
          try { req.destroy(); } catch (_) {}
          return reject(new Error('已取消'));
        }
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return doGet(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const total = parseInt(res.headers['content-length'] || '0', 10) || 0;
        let done = 0;
        const tmp = destPath + '.part';
        const ws = fs.createWriteStream(tmp);
        const hash = crypto.createHash('sha1');
        res.on('data', (c) => {
          if (abortRef && abortRef.aborted) {
            try { res.destroy(); } catch (_) {}
            try { ws.destroy(); } catch (_) {}
            try { req.destroy(); } catch (_) {}
            try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) {}
            return reject(new Error('已取消'));
          }
          done += c.length;
          hash.update(c);
          if (onProgress && total > 0) {
            onProgress({ bytes: done, total, progress: Math.min(99.9, (done / total) * 100) });
          }
        });
        res.pipe(ws);
        ws.on('finish', () => {
          ws.close(() => {
            try {
              if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
              fs.renameSync(tmp, destPath);
              resolve({ size: done, sha1: hash.digest('hex') });
            } catch (e) {
              reject(e);
            }
          });
        });
        ws.on('error', reject);
        res.on('error', reject);
      });
      if (abortRef) abortRef.req = req;
      req.on('error', reject);
      req.on('timeout', () => { try { req.destroy(); } catch (_) {} reject(new Error('下载超时')); });
    };
    doGet(url);
  });
}

function writeEula(dir) {
  const p = path.join(dir, 'eula.txt');
  fs.writeFileSync(p, '# Generated by VersePC Server Host\neula=true\n', 'utf8');
}

function writeServerProperties(dir, { port = 25565, motd = 'A VersePC Server', onlineMode = true } = {}) {
  const p = path.join(dir, 'server.properties');
  // 若已存在则只更新关键字段
  let lines = [];
  if (fs.existsSync(p)) {
    lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  } else {
    lines = [
      'enable-jmx-monitoring=false',
      'rcon.port=25575',
      'level-seed=',
      'gamemode=survival',
      'enable-command-block=false',
      'enable-query=false',
      'generator-settings={}',
      'level-name=world',
      'motd=A Minecraft Server',
      'query.port=25565',
      'pvp=true',
      'generate-structures=true',
      'difficulty=easy',
      'network-compression-threshold=256',
      'max-tick-time=60000',
      'require-resource-pack=false',
      'max-players=20',
      'use-native-transport=true',
      'online-mode=true',
      'enable-status=true',
      'allow-flight=false',
      'broadcast-rcon-to-ops=true',
      'view-distance=10',
      'server-ip=',
      'allow-nether=true',
      'server-port=25565',
      'enable-rcon=false',
      'sync-chunk-writes=true',
      'op-permission-level=4',
      'prevent-proxy-connections=false',
      'hide-online-players=false',
      'resource-pack=',
      'entity-broadcast-range-percentage=100',
      'simulation-distance=10',
      'player-idle-timeout=0',
      'force-gamemode=false',
      'rate-limit=0',
      'hardcore=false',
      'white-list=false',
      'broadcast-console-to-ops=true',
      'spawn-npcs=true',
      'spawn-animals=true',
      'function-permission-level=2',
      'initial-enabled-packs=vanilla',
      'level-type=minecraft\\:normal',
      'text-filtering-config=',
      'spawn-monsters=true',
      'enforce-whitelist=false',
      'spawn-protection=16',
      'resource-pack-sha1=',
      'max-world-size=29999984'
    ];
  }
  const set = (key, val) => {
    const re = new RegExp('^' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=');
    let found = false;
    lines = lines.map((line) => {
      if (re.test(line)) { found = true; return `${key}=${val}`; }
      return line;
    });
    if (!found) lines.push(`${key}=${val}`);
  };
  set('server-port', String(port));
  set('query.port', String(port));
  set('motd', String(motd).replace(/\n/g, ' '));
  set('online-mode', onlineMode ? 'true' : 'false');
  set('server-ip', '');
  fs.writeFileSync(p, lines.join('\n') + '\n', 'utf8');
}


/**
 * 解析版本所需 Java 主版本：优先版本 JSON 的 javaVersion.majorVersion（沿 inheritsFrom 链），
 * 兜底按 MC 版本映射（>=26 -> 25, >=1.20.5 -> 21, >=1.18 -> 17, else 8）
 */
function resolveRequiredJavaMajor(versionId) {
  let cur = versionId;
  const visited = new Set();
  let depth = 0;
  while (cur && depth < 12 && !visited.has(cur)) {
    visited.add(cur);
    depth++;
    const j = loadVersionJson(cur);
    if (!j) break;
    if (j.javaVersion && j.javaVersion.majorVersion) return j.javaVersion.majorVersion;
    if (j.downloads && j.downloads.server && j.javaVersion && j.javaVersion.majorVersion) {
      return j.javaVersion.majorVersion;
    }
    cur = j.inheritsFrom || null;
  }
  const m = String(versionId || '').match(/(\d+)(?:\.(\d+))?/);
  if (m) {
    const major = parseInt(m[1], 10);
    const minor = parseInt(m[2] || '0', 10);
    if (major >= 26) return 25;
    if (major === 1 && minor >= 21) return 21;
    if (major === 1 && minor === 20) {
      const patch = parseInt((String(versionId).match(/\.(\d+)(?:\D|$)/) || [0, 0])[1], 10);
      return patch >= 5 ? 21 : 17;
    }
    if (major === 1 && minor >= 18) return 17;
  }
  return 17;
}

/**
 * 探测单个 java 主版本（带超时保护）
 */
function probeJavaMajor(javaPath) {
  try {
    const java = require('../server/java');
    if (java && typeof java.getJavaMajorVersion === 'function') {
      const v = java.getJavaMajorVersion(javaPath);
      if (v > 0) return v;
    }
  } catch (_) {}
  return 0;
}

/**
 * 收集所有候选 Java 路径
 */
function collectJavaCandidates() {
  const paths = [];
  const javaExeName = process.platform === 'win32' ? 'java.exe' : 'java';
  const push = (p) => {
    if (!p) return;
    const norm = String(p).toLowerCase().replace(/\//g, '/');
    if (!paths.some((x) => x.toLowerCase().replace(/\//g, '/') === norm) && fs.existsSync(p)) paths.push(p);
  };
  // bundled java dir（.versepc/java/<ver>/bin/java）
  const bundledDirs = [path.join(DATA_DIR, 'java')];
  try {
    const ctx = require('../server/context');
    if (ctx && ctx.dirs && ctx.dirs.JAVA_DIR) bundledDirs.push(ctx.dirs.JAVA_DIR);
  } catch (_) {}
  for (const bd of bundledDirs) {
    try {
      if (!fs.existsSync(bd)) continue;
      for (const d of fs.readdirSync(bd, { withFileTypes: true })) {
        if (d.isDirectory()) push(path.join(bd, d.name, 'bin', javaExeName));
      }
    } catch (_) {}
  }
  // runtime dir（Mojang 组件 java-runtime-gamma/delta/epsilon）
  const runtimeDir = path.join(DATA_DIR, 'runtime');
  const scanRuntime = (dir, depth) => {
    if (depth <= 0 || !fs.existsSync(dir)) return;
    try {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        const sub = path.join(dir, e.name);
        if (e.name.toLowerCase() === 'bin') push(path.join(sub, javaExeName));
        else scanRuntime(sub, depth - 1);
      }
    } catch (_) {}
  };
  scanRuntime(runtimeDir, 5);
  // Mojang 官方 runtime（.minecraft/runtime/ java-runtime-*）
  try {
    const ctx = require('../server/context');
    if (ctx && ctx.dirs && ctx.dirs.MINECRAFT_DIR) {
      scanRuntime(path.join(ctx.dirs.MINECRAFT_DIR, 'runtime'), 4);
    }
  } catch (_) {}
  // 常见系统安装位置（Windows）
  if (process.platform === 'win32') {
    const roots = ['C:\\Program Files\\Java', 'C:\\Program Files (x86)\\Java', 'C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Microsoft', 'C:\\Program Files\\Zulu', 'C:\\Program Files\\Amazon Corretto'];
    for (const root of roots) {
      try {
        if (!fs.existsSync(root)) continue;
        for (const d of fs.readdirSync(root, { withFileTypes: true })) {
          if (d.isDirectory()) push(path.join(root, d.name, 'bin', javaExeName));
        }
      } catch (_) {}
    }
  }
  return paths;
}

/**
 * 为服务端选择 Java：主版本 >= requiredMajor 的最小候选；
 * 不足时尝试 autoInstallJava 自动下载；仍不足抛明确错误。
 */
async function findJavaForServer(requiredMajor, log, opts) {
  const _log = log || (() => {});
  const pickBest = () => {
    const cands = collectJavaCandidates();
    let best = null;
    let bestMajor = -1;
    let maxFound = 0;
    for (const c of cands) {
      const mj = probeJavaMajor(c);
      if (mj > maxFound) maxFound = mj;
      if (mj >= requiredMajor && (bestMajor < 0 || mj < bestMajor)) {
        best = c;
        bestMajor = mj;
      }
    }
    return { best, bestMajor, maxFound };
  };

  let { best, bestMajor, maxFound } = pickBest();
  if (best) {
    _log('[VersePC] 选择 Java ' + bestMajor + ': ' + best);
    return { javaPath: best, major: bestMajor, autoInstalled: false };
  }

  // 尝试自动下载
  const allowAutoInstall = !opts || opts.autoInstall !== false;
  if (!allowAutoInstall) {
    throw new Error('此服务端需要 Java ' + requiredMajor + '+，当前系统最高仅 Java ' + (maxFound || '?') + '。请到「Java 管理」页下载 Java ' + requiredMajor + ' 后重试。');
  }
  _log('[VersePC] 未找到 Java ' + requiredMajor + '+（当前最高 Java ' + (maxFound || '?') + '），尝试自动下载...');
  try {
    const java = require('../server/java');
    if (java && typeof java.autoInstallJava === 'function') {
      await java.autoInstallJava(requiredMajor);
      const r2 = pickBest();
      if (r2.best) {
        _log('[VersePC] Java ' + r2.bestMajor + ' 自动安装完成: ' + r2.best);
        return { javaPath: r2.best, major: r2.bestMajor, autoInstalled: true };
      }
      maxFound = Math.max(maxFound, r2.maxFound);
    }
  } catch (e) {
    _log('[VersePC] 自动安装 Java 失败: ' + e.message);
  }

  throw new Error(
    '此服务端需要 Java ' + requiredMajor + '+，当前系统最高仅 Java ' + (maxFound || '?') + '。' +
    '请到「Java 管理」页下载 Java ' + requiredMajor + ' 后重试。'
  );
}



function getJavaSync(requiredMajor, log) {
  const raw = findJavaPath(requiredMajor);
  const path = (raw && (typeof raw === 'string' ? raw : (raw.javaPath || raw.path || null)));
  const exists = path && typeof path === 'string' && fs.existsSync(path);
  if (exists) {
    if (log) log(path + ' (installer runtime)');
    return path;
  }
  // fall to env java
  const def = process.platform === 'win32' ? 'java.exe' : 'java';
  if (log) log('no Java found for installer, falling back to ' + def);
  return def;
}
function findJavaPath(majorHint) {
  try {
    // 延迟加载，避免 main 进程启动拖慢
    const java = require('../server/java');
    if (java && typeof java.selectJavaForVersion === 'function') {
      // 用伪 versionId 触发选择；settings 从数据目录读
      let settings = {};
      try {
        const settingsPath = path.join(DATA_DIR, 'settings.json');
        if (fs.existsSync(settingsPath)) settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch (_) {}
      const selected = java.selectJavaForVersion(
        majorHint >= 21 ? '1.21' : majorHint >= 17 ? '1.18' : '1.16.5',
        settings,
        majorHint ? { javaVersion: { majorVersion: majorHint } } : null
      );
      if (selected) return selected;
    }
  } catch (e) {
    console.warn('[ServerHost] selectJava failed:', e.message);
  }
  // 环境 java
  return process.platform === 'win32' ? 'java.exe' : 'java';
}

function listLocalIps() {
  const ips = [];
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets || {})) {
      for (const n of nets[name] || []) {
        if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
      }
    }
  } catch (_) {}
  return ips;
}

/**
 * 取消正在进行的创建任务
 * 设置取消标志、终止 Java 安装器进程、销毁下载请求
 */
function cancelCreate() {
  _activeCreate.aborted = true;
  if (_activeCreate.proc) {
    try { _activeCreate.proc.kill(); } catch (_) {}
    _activeCreate.proc = null;
  }
  if (_activeCreate.req) {
    try { _activeCreate.req.destroy(); } catch (_) {}
    _activeCreate.req = null;
  }
  return true;
}

async function createOrUpdateServer(opts) {
  // 重置取消标志，开始新的创建任务
  _activeCreate = { aborted: false, proc: null, req: null };
  const abortRef = _activeCreate;
  const name = sanitizeName(opts.name || 'MyServer');
  const versionId = String(opts.versionId || '').trim();
  const port = Math.min(65535, Math.max(1, parseInt(opts.port, 10) || 25565));
  const maxMem = Math.min(32768, Math.max(512, parseInt(opts.maxMem, 10) || 2048));
  const onlineMode = opts.onlineMode !== false;
  const syncMods = opts.syncMods !== false;
  const forceModded = opts.forceModded === true;

  if (!versionId) throw new Error('请选择游戏版本');

  const versionData = loadVersionJson(versionId);
  if (!versionData) throw new Error('版本 ' + versionId + ' 的 JSON 配置文件不存在，请检查该版本是否安装完整或在启动器中重新安装。');

  const loaderInfo = detectClientLoader(versionId);
  const resolved = resolveServerDownload(versionId);
  if (!resolved && loaderInfo.loader === 'vanilla') {
    throw new Error('无法从版本「' + versionId + '」解析 server.jar 下载地址（需要原版或可解析 inheritsFrom 链的版本）');
  }

  ensureRoot();
  const idx = loadIndex();
  let entry = idx.servers.find((s) => s.versionId === versionId && s.name === name);
  const fallbackBaseVersion = (resolved && resolved.versionId) || loaderInfo.mcVersion || versionId;
  if (!entry) {
    entry = {
      id: `srv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      versionId,
      baseVersion: fallbackBaseVersion,
      port,
      maxMem,
      onlineMode,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    idx.servers.push(entry);
  } else {
    entry.port = port;
    entry.maxMem = maxMem;
    entry.onlineMode = onlineMode;
    entry.baseVersion = fallbackBaseVersion;
    entry.updatedAt = Date.now();
  }
  saveIndex(idx);

  const dir = serverDirOf(entry.id);
  fs.mkdirSync(dir, { recursive: true });
  entry.dir = dir;

  // [MODDED SERVER BRANCH]
  entry.loader = loaderInfo.loader;
  entry.loaderVersion = loaderInfo.loaderVersion || null;
  entry.baseVersion = (resolved && resolved.versionId) || loaderInfo.mcVersion || entry.baseVersion;
  entry.javaMajor = (resolved && resolved.javaVersion && resolved.javaVersion.majorVersion) || resolveRequiredJavaMajor(entry.baseVersion || versionId);

  if (loaderInfo.loader !== 'vanilla') {
    emitLog(entry.id, '[VersePC] 检测到加载器: ' + loaderInfo.loader + ' ' + (loaderInfo.loaderVersion || '') + ' (MC ' + (loaderInfo.mcVersion || '?') + ')');
    try {
      const modded = await installModdedServer(entry, loaderInfo, { syncMods, abortRef });
      entry.loader = modded.loader;
      entry.loaderVersion = modded.loaderVersion;
      entry.launchKind = modded.launchKind;
      entry.updatedAt = Date.now();
      entry.dir = dir;
      const idxM = loadIndex();
      const im = idxM.servers.findIndex((s) => s.id === entry.id);
      if (im >= 0) idxM.servers[im] = Object.assign({}, idxM.servers[im], entry, { dir });
      else idxM.servers.push(Object.assign({}, entry, { dir }));
      saveIndex(idxM);
      fs.writeFileSync(path.join(dir, 'versepc-server.json'), JSON.stringify({
        id: entry.id,
        name,
        versionId,
        baseVersion: entry.baseVersion,
        loader: entry.loader,
        loaderVersion: entry.loaderVersion,
        launchKind: entry.launchKind,
        port,
        maxMem,
        onlineMode,
        modSync: modded.modSync || null
      }, null, 2), 'utf8');
      emitStatus(entry.id, 'ready', {
        progress: 100,
        message: entry.loader + ' 服务端已就绪' + (modded.modSync ? ' · ' + modded.modSync.message : ''),
        path: dir,
        stage: 'ready'
      });
      return { ok: true, server: Object.assign({}, entry, { dir, path: dir }), modSync: modded.modSync || null };
    } catch (modErr) {
      emitLog(entry.id, '[VersePC] 模组端安装失败: ' + modErr.message, 'err');
      emitStatus(entry.id, 'error', { message: '模组端安装失败: ' + modErr.message, stage: 'error' });
      throw new Error(entry.loader + ' 服务端安装失败: ' + modErr.message);
    }
  }

  if (!resolved || !resolved.server) {
    throw new Error('无法解析 server.jar，且模组端安装未成功（' + loaderInfo.loader + '）');
  }

  const jarPath = path.join(dir, 'server.jar');
  const needDownload = !fs.existsSync(jarPath) || (resolved.server.size && fs.statSync(jarPath).size !== resolved.server.size);

  if (needDownload) {
    emitStatus(entry.id, 'downloading', { progress: 0, message: '正在下载 server.jar...' });
    emitLog(entry.id, `[VersePC] 下载 server.jar ← ${resolved.server.url}`);
    // 优先镜像（国内）
    let url = resolved.server.url;
    if (url.includes('piston-data.mojang.com') || url.includes('launcher.mojang.com')) {
      // 先试官方，失败再换镜像不在此函数内；直接官方 + BMCL 备用在 catch
    }
    try {
      await downloadFile(url, jarPath, (p) => {
        emitStatus(entry.id, 'downloading', {
          progress: p.progress,
          message: `下载 server.jar ${Math.round(p.progress)}%`
        });
      }, abortRef);
    } catch (e1) {
      if (abortRef && abortRef.aborted) throw e1;
      // BMCLAPI 镜像
      let mirrorUrl = url
        .replace('https://piston-data.mojang.com/', 'https://bmclapi2.bangbang93.com/')
        .replace('https://launcher.mojang.com/', 'https://bmclapi2.bangbang93.com/');
      if (mirrorUrl === url && resolved.server.sha1) {
        mirrorUrl = `https://bmclapi2.bangbang93.com/version/${resolved.versionId}/server`;
      }
      emitLog(entry.id, `[VersePC] 官方下载失败(${e1.message})，尝试镜像: ${mirrorUrl}`);
      await downloadFile(mirrorUrl, jarPath, (p) => {
        emitStatus(entry.id, 'downloading', {
          progress: p.progress,
          message: `镜像下载 server.jar ${Math.round(p.progress)}%`
        });
      }, abortRef);
    }
    if (resolved.server.sha1) {
      const buf = fs.readFileSync(jarPath);
      const sha1 = crypto.createHash('sha1').update(buf).digest('hex');
      if (sha1 !== resolved.server.sha1) {
        try { fs.unlinkSync(jarPath); } catch (_) {}
        throw new Error(`server.jar 校验失败: expected ${resolved.server.sha1} got ${sha1}`);
      }
    }
    emitLog(entry.id, `[VersePC] server.jar 就绪 (${Math.round(fs.statSync(jarPath).size / 1024 / 1024)} MB)`);
  } else {
    emitLog(entry.id, `[VersePC] 复用已有 server.jar`);
  }

  if (!entry.javaMajor) entry.javaMajor = (resolved && resolved.javaVersion && resolved.javaVersion.majorVersion) || resolveRequiredJavaMajor(entry.baseVersion || versionId);

  writeEula(dir);
  writeServerProperties(dir, { port, motd: name, onlineMode });

  // 元数据
  fs.writeFileSync(path.join(dir, 'versepc-server.json'), JSON.stringify({
    id: entry.id,
    name,
    versionId,
    baseVersion: resolved.versionId,
    port,
    maxMem,
    onlineMode,
    serverSha1: resolved.server.sha1 || null
  }, null, 2), 'utf8');

  entry.updatedAt = Date.now();
  // 回写 index 含 path
  const idx2 = loadIndex();
  const i = idx2.servers.findIndex((s) => s.id === entry.id);
  if (i >= 0) idx2.servers[i] = { ...idx2.servers[i], ...entry, dir };
  else idx2.servers.push({ ...entry, dir });
  saveIndex(idx2);

  emitStatus(entry.id, 'ready', { message: '服务端已准备就绪', path: dir });
  return { ok: true, server: { ...entry, dir, path: dir } };
}

async function startServer(id, overrides = {}) {
  const idx = loadIndex();
  const entry = idx.servers.find((s) => s.id === id);
  if (!entry) throw new Error('服务器不存在');
  if (_running.has(id)) throw new Error('服务器已在运行');

  const dir = entry.dir || serverDirOf(id);
  // [LAUNCH KIND]
  const launchKind = entry.launchKind || detectLaunchKind(dir);
  const jarPath = path.join(dir, 'server.jar');
  const fabricLaunch = path.join(dir, 'fabric-server-launch.jar');
  const runBat = path.join(dir, process.platform === 'win32' ? 'run.bat' : 'run.sh');
  if (launchKind === 'server-jar' && !fs.existsSync(jarPath) && !fs.existsSync(fabricLaunch) && !fs.existsSync(runBat)) {
    throw new Error('服务端文件不存在，请先创建/下载');
  }

  const port = parseInt(overrides.port, 10) || entry.port || 25565;
  const maxMem = parseInt(overrides.maxMem, 10) || entry.maxMem || 2048;
  const minMem = Math.min(maxMem, Math.max(256, Math.floor(maxMem / 4)));

  writeServerProperties(dir, {
    port,
    motd: entry.name,
    onlineMode: entry.onlineMode !== false
  });
  writeEula(dir);

  const requiredMajor = entry.javaMajor || resolveRequiredJavaMajor(entry.versionId);
  emitLog(id, '[VersePC] 需要 Java ' + requiredMajor + '+（' + (entry.baseVersion || entry.versionId) + '）');
  const javaPick = await findJavaForServer(requiredMajor, (m) => emitLog(id, m));
  const javaPath = javaPick.javaPath;

  let proc;
  const jvmMem = ['-Xms' + minMem + 'M', '-Xmx' + maxMem + 'M', '-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=200', '-Dfile.encoding=UTF-8'];
  if ((launchKind === 'run-script' || fs.existsSync(runBat)) && fs.existsSync(runBat)) {
    emitLog(id, '[VersePC] 使用启动脚本: ' + path.basename(runBat));
    emitStatus(id, 'starting', { message: '正在启动（run 脚本）...', javaPath, port });
    const javaBinDir = path.isAbsolute(javaPath) ? path.dirname(javaPath) : null;
    const javaHome = javaBinDir ? path.dirname(javaBinDir) : null;
    const scriptEnv = Object.assign({}, process.env, {
      JAVA_HOME: javaHome || process.env.JAVA_HOME,
      PATH: javaBinDir ? javaBinDir + path.delimiter + (process.env.PATH || '') : process.env.PATH,
      JAVA_TOOL_OPTIONS: undefined
    });
    if (javaHome) emitLog(id, `[VersePC] JAVA_HOME=${javaHome}`);
    if (process.platform === 'win32') {
      proc = spawn('cmd.exe', ['/c', 'run.bat', 'nogui'], {
        cwd: dir,
        env: scriptEnv,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } else {
      proc = spawn('bash', ['run.sh', 'nogui'], {
        cwd: dir,
        env: scriptEnv,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    }
  } else if (launchKind === 'fabric-launch' || fs.existsSync(fabricLaunch)) {
    const args = jvmMem.concat(['-jar', 'fabric-server-launch.jar', '--nogui']);
    emitLog(id, '[VersePC] ' + javaPath + ' ' + args.join(' '));
    emitStatus(id, 'starting', { message: '正在启动 Fabric...', javaPath, port });
    proc = spawn(javaPath, args, {
      cwd: dir,
      env: Object.assign({}, process.env, { JAVA_TOOL_OPTIONS: undefined }),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } else if (String(launchKind).startsWith('forge-jar:')) {
    const jarName = String(launchKind).slice('forge-jar:'.length);
    const args = jvmMem.concat(['-jar', jarName, '--nogui']);
    emitLog(id, '[VersePC] ' + javaPath + ' ' + args.join(' '));
    emitStatus(id, 'starting', { message: '正在启动 Forge...', javaPath, port });
    proc = spawn(javaPath, args, {
      cwd: dir,
      env: Object.assign({}, process.env, { JAVA_TOOL_OPTIONS: undefined }),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } else {
    if (!fs.existsSync(jarPath)) throw new Error('server.jar 不存在，请先创建/下载');
    const args = jvmMem.concat(['-jar', 'server.jar', '--nogui']);
    emitLog(id, '[VersePC] ' + javaPath + ' ' + args.join(' '));
    emitStatus(id, 'starting', { message: '正在启动...', javaPath, port });
    proc = spawn(javaPath, args, {
      cwd: dir,
      env: Object.assign({}, process.env, { JAVA_TOOL_OPTIONS: undefined }),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  }
  emitLog(id, '[VersePC] cwd=' + dir + ' launchKind=' + launchKind);

  const state = { proc, dir, name: entry.name, port, starting: true };
  _running.set(id, state);

  let bufOut = '';
  let bufErr = '';
  const flushLines = (chunk, stream) => {
    const text = chunk.toString('utf8');
    let buf = stream === 'err' ? bufErr : bufOut;
    buf += text;
    const parts = buf.split(/\n/);
    if (stream === 'err') bufErr = parts.pop() || '';
    else bufOut = parts.pop() || '';
    for (const line of parts) {
      if (!line) continue;
      emitLog(id, line, stream);
      if (/UnsupportedClassVersionError|has been compiled by a more recent version/i.test(line)) {
        const vm = line.match(/class file version (\d+(?:\.\d+)?)/);
        const needMajor = vm ? Math.round(parseFloat(vm[1]) - 44) : requiredMajor;
        emitLog(id, '[VersePC] Java 版本过低：该服务端需要 Java ' + (needMajor || requiredMajor) + '+。请到「Java 管理」页下载后重启服务端。', 'err');
      }
      if (/Done \(|For help, type "help"/i.test(line)) {
        state.starting = false;
        emitStatus(id, 'running', {
          message: '服务器已就绪',
          port: state.port,
          localIps: listLocalIps()
        });
      }
    }
  };

  proc.stdout.on('data', (c) => flushLines(c, 'out'));
  proc.stderr.on('data', (c) => flushLines(c, 'err'));

  proc.on('error', (err) => {
    emitLog(id, `[VersePC] 启动失败: ${err.message}`, 'err');
    emitStatus(id, 'error', { message: err.message });
    _running.delete(id);
  });

  proc.on('close', (code, signal) => {
    if (bufOut) emitLog(id, bufOut, 'out');
    if (bufErr) emitLog(id, bufErr, 'err');
    emitLog(id, `[VersePC] 进程退出 code=${code} signal=${signal || ''}`);
    emitStatus(id, 'stopped', { code, signal });
    _running.delete(id);
  });

  entry.lastStartedAt = Date.now();
  entry.port = port;
  entry.maxMem = maxMem;
  const idx2 = loadIndex();
  const i = idx2.servers.findIndex((s) => s.id === id);
  if (i >= 0) {
    idx2.servers[i] = { ...idx2.servers[i], ...entry };
    saveIndex(idx2);
  }

  return {
    ok: true,
    pid: proc.pid,
    port,
    localIps: listLocalIps(),
    javaPath
  };
}

function sendCommand(id, command) {
  const state = _running.get(id);
  if (!state || !state.proc || !state.proc.stdin || state.proc.stdin.destroyed) {
    throw new Error('服务器未运行');
  }
  const cmd = String(command || '').replace(/\r?\n/g, '');
  if (!cmd) return { ok: true };
  emitLog(id, `> ${cmd}`, 'cmd');
  state.proc.stdin.write(cmd + '\n');
  return { ok: true };
}

async function stopServer(id) {
  const state = _running.get(id);
  if (!state) return { ok: true, alreadyStopped: true };

  emitStatus(id, 'stopping', { message: '正在关闭服务器...' });
  try {
    if (state.proc.stdin && !state.proc.stdin.destroyed) {
      state.proc.stdin.write('stop\n');
    }
  } catch (_) {}

  // 等最多 15s 优雅退出
  const exited = await new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; resolve(false); }
    }, 15000);
    state.proc.once('close', () => {
      if (!done) { done = true; clearTimeout(timer); resolve(true); }
    });
  });

  if (!exited) {
    emitLog(id, '[VersePC] 优雅关闭超时，强制结束进程', 'err');
    try { state.proc.kill('SIGKILL'); } catch (_) {}
    try {
      if (process.platform === 'win32' && state.proc.pid) {
        spawn('taskkill', ['/PID', String(state.proc.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      }
    } catch (_) {}
    _running.delete(id);
    emitStatus(id, 'stopped', { forced: true });
  }
  return { ok: true, forced: !exited };
}

function deleteServer(id) {
  if (_running.has(id)) throw new Error('请先停止服务器再删除');
  const idx = loadIndex();
  const entry = idx.servers.find((s) => s.id === id);
  const dir = (entry && entry.dir) || serverDirOf(id);
  idx.servers = idx.servers.filter((s) => s.id !== id);
  saveIndex(idx);
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) {
    console.warn('[ServerHost] delete dir failed:', e.message);
  }
  return { ok: true };
}

function getStatus(id) {
  if (!id) {
    return {
      ok: true,
      servers: loadIndex().servers.map((s) => ({
        ...s,
        running: _running.has(s.id),
        status: _running.has(s.id)
          ? (_running.get(s.id).starting ? 'starting' : 'running')
          : 'stopped'
      }))
    };
  }
  const entry = loadIndex().servers.find((s) => s.id === id);
  if (!entry) return { ok: false, error: 'not found' };
  const run = _running.get(id);
  return {
    ok: true,
    server: entry,
    running: !!run,
    status: run ? (run.starting ? 'starting' : 'running') : 'stopped',
    port: run ? run.port : entry.port,
    localIps: listLocalIps(),
    pid: run && run.proc ? run.proc.pid : null
  };
}

function openDir(id) {
  ensureRoot();
  let dir = SERVERS_ROOT;
  if (id) {
    const entry = loadIndex().servers.find((s) => s.id === id);
    dir = (entry && entry.dir) || serverDirOf(id);
  }
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  shell.openPath(dir);
  return { ok: true, path: dir };
}

function initServerHostIPC() {
  ensureRoot();

  ipcMain.handle('server-host:list', async () => {
    try {
      const st = getStatus();
      return { ok: true, servers: st.servers, root: SERVERS_ROOT, localIps: listLocalIps() };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('server-host:create', async (event, opts) => {
    try {
      const r = await createOrUpdateServer(opts || {});
      return r;
    } catch (e) {
      console.error('[ServerHost] create failed:', e);
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('server-host:cancel-create', async () => {
    try {
      cancelCreate();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('server-host:start', async (event, { id, port, maxMem } = {}) => {
    try {
      if (!id) throw new Error('缺少服务器 id');
      const r = await startServer(id, { port, maxMem });
      return r;
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('server-host:stop', async (event, { id } = {}) => {
    try {
      if (!id) throw new Error('缺少服务器 id');
      return await stopServer(id);
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('server-host:command', async (event, { id, command } = {}) => {
    try {
      if (!id) throw new Error('缺少服务器 id');
      return sendCommand(id, command);
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('server-host:status', async (event, { id } = {}) => {
    try {
      return getStatus(id);
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('server-host:delete', async (event, { id } = {}) => {
    try {
      if (!id) throw new Error('缺少服务器 id');
      return deleteServer(id);
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('server-host:open-dir', async (event, { id } = {}) => {
    try {
      return openDir(id);
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('server-host:detect-loader', async (event, { versionId } = {}) => {
    try {
      const info = detectClientLoader(versionId);
      return { ok: true, loader: info.loader, loaderVersion: info.loaderVersion, mcVersion: info.mcVersion, chainIds: info.chainIds };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('server-host:sync-mods', async (event, { id } = {}) => {
    try {
      if (!id) throw new Error('缺少服务器 id');
      const idx = loadIndex();
      const entry = idx.servers.find((s) => s.id === id);
      if (!entry) throw new Error('服务器不存在');
      entry.dir = entry.dir || serverDirOf(id);
      const modSync = await syncClientModsToServer(entry, (msg, pct) => {
        emitStatus(id, 'syncing-mods', {
          progress: pct != null ? pct : null,
          indeterminate: pct == null,
          message: msg,
          stage: 'mods'
        });
        emitLog(id, '[VersePC] ' + msg);
      });
      emitStatus(id, 'ready', { progress: 100, message: modSync.message || '模组同步完成', stage: 'ready' });
      return { ok: true, ...modSync };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('server-host:resolve-version', async (event, { versionId } = {}) => {
    try {
      const r = resolveServerDownload(versionId);
      if (!r) return { ok: false, error: '无法解析 server 下载' };
      return { ok: true, ...r };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  console.log('[ServerHost] IPC registered, root=', SERVERS_ROOT);
}

function cleanupServerHost() {
  for (const [id, state] of _running.entries()) {
    try {
      if (state.proc && state.proc.stdin && !state.proc.stdin.destroyed) {
        state.proc.stdin.write('stop\n');
      }
    } catch (_) {}
    setTimeout(() => {
      try { if (state.proc && !state.proc.killed) state.proc.kill(); } catch (_) {}
    }, 3000);
    _running.delete(id);
  }
}

module.exports = {
  initServerHostIPC,
  cleanupServerHost,
  SERVERS_ROOT,
  // 供单元测试
  _internal: {
    resolveServerDownload,
    detectClientLoader,
    sanitizeName,
    writeEula,
    writeServerProperties,
    loadIndex,
    saveIndex,
    detectLaunchKind,
    resolveClientModsDir,
    getJavaSync,
    findJavaForServer,
    resolveRequiredJavaMajor,
    SERVERS_ROOT
  }
};
