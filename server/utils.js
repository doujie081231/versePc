/**
 * @file server/utils.js
 * @description 通用工具函数模块，包含文件系统辅助、格式化、UUID、PNG 编解码、
 *   字符串转义、系统信息等功能。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const zlib = require('zlib');
const { execSync } = require('child_process');
const ctx = require('./context');

/* AdmZip 延迟加载 */
let AdmZipModule = null;

/**
 * 获取 AdmZip 模块（懒加载）
 * @returns {Function} AdmZip 构造函数
 * @throws {Error} 缺少 adm-zip 依赖时抛出
 */
function getAdmZip() {
  if (!AdmZipModule) {
    try {
      AdmZipModule = require('adm-zip');
    } catch (e) {
      throw new Error('缺少 adm-zip 依赖，请运行 npm install adm-zip');
    }
  }
  return AdmZipModule;
}

/* 文件系统辅助 */

/**
 * 确保文件所在目录存在（同步），带目录缓存
 * @param {string} filePath - 文件路径
 */
function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  const dirCache = ctx.caches.dirCache;
  if (dirCache.has(dir)) return;
  let dirExists = false;
  try {
    dirExists = fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  } catch (_) {}
  if (!dirExists) {
    const parts = dir.split(path.sep);
    for (let i = 1; i <= parts.length; i++) {
      const partial = parts.slice(0, i).join(path.sep);
      if (partial) {
        try {
          if (fs.existsSync(partial) && !fs.statSync(partial).isDirectory()) {
            fs.unlinkSync(partial);
          }
        } catch (_) {}
      }
    }
    fs.mkdirSync(dir, { recursive: true });
  }
  dirCache.add(dir);
}

/**
 * 确保文件所在目录存在（异步），带目录缓存
 * @param {string} filePath - 文件路径
 * @returns {Promise<void>}
 */
async function asyncEnsureDir(filePath) {
  const dir = path.dirname(filePath);
  const dirCache = ctx.caches.dirCache;
  if (dirCache.has(dir)) return;
  let dirExists = false;
  try {
    const st = await fs.promises.stat(dir);
    dirExists = st.isDirectory();
  } catch (_) {}
  if (!dirExists) {
    const parts = dir.split(path.sep);
    for (let i = 1; i <= parts.length; i++) {
      const partial = parts.slice(0, i).join(path.sep);
      if (partial) {
        try {
          const stat = await fs.promises.stat(partial);
          if (!stat.isDirectory()) {
            await fs.promises.unlink(partial);
          }
        } catch (_) {}
      }
    }
    await fs.promises.mkdir(dir, { recursive: true });
  }
  dirCache.add(dir);
}

/**
 * 确保文件所在目录存在（逐级创建，遇到同名文件则删除）
 * @param {string} filePath - 文件路径
 */
function ensureDirForFile(filePath) {
  const parts = filePath.split(path.sep);
  let current = parts[0] || path.sep;
  for (let i = 1; i < parts.length - 1; i++) {
    current = path.join(current, parts[i]);
    if (fs.existsSync(current) && !fs.statSync(current).isDirectory()) {
      fs.unlinkSync(current);
    }
  }
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * 让出事件循环
 * @returns {Promise<void>}
 */
function yieldToEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * 延时等待
 * @param {number} ms - 毫秒数
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 生成 UUID
 * @returns {string} UUID 字符串
 */
function generateUUID() {
  return crypto.randomUUID();
}

/* 安全文件 I/O */

/* 安全文件读写 - 复用 main/file-safe.js 的唯一实现（带 .bak 备份恢复）
   原 server/utils 版无备份恢复且与 main/store 版逻辑不一致，已统一收敛 */
const { safeWriteFileSync: _safeWriteFromFileSafe, safeReadJsonFile } = require('../main/file-safe');
/**
 * 安全写入文件 - 复用 file-safe 版（.bak 备份 + 原子重命名），外层包 ensureDir 保持原行为
 * @param {string} filePath - 文件路径
 * @param {string|Buffer} content - 文件内容
 */
function safeWriteFileSync(filePath, content) {
  ensureDir(filePath);
  _safeWriteFromFileSafe(filePath, content);
}

/* 路径安全 */

/**
 * 解析库文件路径并防止路径穿越攻击
 * @param {string} artifactPath - 制品相对路径
 * @param {string} [baseDir] - 基础目录
 * @returns {string|null} 解析后的绝对路径，不安全时返回 null
 */
function safeLibPath(artifactPath, baseDir) {
  if (!artifactPath || typeof artifactPath !== 'string') return null;
  const LIBRARIES_DIR = ctx.dirs.LIBRARIES_DIR;
  const rawPath = artifactPath.replace(/\//g, path.sep);
  const resolved = path.resolve(baseDir || LIBRARIES_DIR, rawPath);
  const base = path.resolve(baseDir || LIBRARIES_DIR);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    console.warn(`[Security] Blocked path traversal in artifact path: ${artifactPath}`);
    return null;
  }
  return resolved;
}

/* 日志轮转 */

/**
 * 轮转日志：删除超大文件并保留最近若干个
 */
function rotateLogs() {
  try {
    const LOGS_DIR = ctx.dirs.LOGS_DIR;
    if (!fs.existsSync(LOGS_DIR)) return;
    const MAX_LOG_FILES = 16;
    const MAX_LOG_SIZE = 32 * 1024 * 1024;
    const files = fs.readdirSync(LOGS_DIR)
      .filter((f) => f.endsWith('.log') || f.endsWith('.json'))
      .map((f) => {
        const p = path.join(LOGS_DIR, f);
        try { const s = fs.statSync(p); return { path: p, time: s.mtimeMs, size: s.size }; } catch (_) { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => a.time - b.time);
    for (const f of files) {
      if (f.size > MAX_LOG_SIZE) { try { fs.unlinkSync(f.path); } catch (_) {} }
    }
    const remaining = files.filter((f) => { try { return fs.existsSync(f.path); } catch (_) { return false; } });
    while (remaining.length > MAX_LOG_FILES) { try { fs.unlinkSync(remaining.shift().path); } catch (_) {} }
  } catch (_) {}
}

/* 整合包导入日志 */
const _importLogDir = (() => {
  try {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'VersePC');
  } catch (_) { return ''; }
})();
const _importLogFile = _importLogDir ? path.join(_importLogDir, 'import.log') : '';

// 写入一条导入日志
function _writeImportLog(msg) {
  if (!_importLogFile) return;
  try {
    if (!_importLogDir) return;
    const dir = path.dirname(_importLogFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(_importLogFile, '[' + new Date().toLocaleString('zh-CN', { hour12: false }) + '] ' + msg + '\n', 'utf8');
  } catch (_) {}
}

// 清空导入日志
function _clearImportLog() {
  if (!_importLogFile) return;
  try { fs.writeFileSync(_importLogFile, '', 'utf8'); } catch (_) {}
}

/* 格式化 */

/**
 * 格式化字节数为可读字符串
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的字符串
 */
function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/**
 * 格式化游戏时长
 * @param {number} totalSeconds - 总秒数
 * @returns {string} 格式化后的字符串
 */
function formatPlayTime(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0 分钟';
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  let result = '';
  if (days > 0) result += days + ' 天 ';
  if (hours > 0) result += hours + ' 小时 ';
  result += minutes + ' 分钟';
  return result;
}

/**
 * 格式化磁盘容量
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的字符串
 */
function formatDriveSize(bytes) {
  if (!bytes || bytes === 0) return '';
  const tb = bytes / (1024 * 1024 * 1024 * 1024);
  if (tb >= 1) return tb.toFixed(1) + ' TB';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return gb.toFixed(0) + ' GB';
  return formatSize(bytes);
}

/**
 * 获取当前平台的标识键
 * @returns {string} 平台标识 (如 windows-x64)
 */
function getPlatformKey() {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'win32') {
    if (arch === 'x64') return 'windows-x64';
    if (arch === 'arm64') return 'windows-arm64';
    return 'windows-x86';
  }
  if (platform === 'darwin') {
    if (arch === 'arm64') return 'mac-os-arm64';
    return 'mac-os';
  }
  if (arch === 'x64') return 'linux';
  return 'linux-i386';
}

/* 字符串转义 */

/**
 * 转义正则表达式特殊字符
 * @param {string} str - 原始字符串
 * @returns {string} 转义后的字符串
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 转义 replace 函数的替换值中的 $
 * @param {string} str - 原始字符串
 * @returns {string} 转义后的字符串
 */
function escapeReplaceValue(str) {
  return str.replace(/\$/g, '$$$$');
}

/**
 * 替换字符串中的变量 (${name} 和 $name)
 * @param {string} str - 模板字符串
 * @param {Object<string,*>} vars - 变量键值对
 * @returns {string} 替换后的字符串
 */
function replaceVariables(str, vars) {
  let result = str;
  for (const [key, value] of Object.entries(vars)) {
    const escapedKey = escapeRegExp(key);
    const escapedValue = escapeReplaceValue(String(value));
    result = result.replace(new RegExp(`\\$\\{${escapedKey}\\}`, 'g'), escapedValue);
    result = result.replace(new RegExp(`\\$${escapedKey}(?![a-zA-Z0-9_])`, 'g'), escapedValue);
  }
  return result;
}

/* 目录大小 */

/**
 * 递归计算目录总大小
 * @param {string} dirPath - 目录路径
 * @param {number} [depth=0] - 当前递归深度
 * @returns {number} 目录总字节数
 */
function getDirSize(dirPath, depth = 0) {
  if (depth > 20) return 0;
  let size = 0;
  try {
    fs.readdirSync(dirPath).forEach((file) => {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) size += getDirSize(filePath, depth + 1);
      else size += stat.size;
    });
  } catch (e) {}
  return size;
}

/* 系统信息 */

/**
 * 获取系统信息（带缓存），包含 CPU、内存、GPU 等
 * @returns {Object} 系统信息对象
 */
function getSystemInfo() {
  if (ctx.caches._cachedSystemInfo) return ctx.caches._cachedSystemInfo;
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model.trim() : 'Unknown';
  const totalMemMB = Math.round(os.totalmem() / 1024 / 1024);
  const freeMemMB = Math.round(os.freemem() / 1024 / 1024);
  const osRelease = os.release();
  const osType = os.type();
  const osArch = os.arch();
  let gpuInfo = 'Unknown';
  try {
    const wmic = execSync('chcp 65001 >nul 2>nul && wmic path win32_VideoController get Name,DriverVersion,AdapterRAM /format:csv', { encoding: 'utf8', timeout: 5000, windowsHide: true });
    const lines = wmic.split('\n').filter((l) => l.trim() && !l.startsWith('Node'));
    const gpus = lines.map((l) => {
      const parts = l.trim().split(',');
      const name = (parts[2] || '').trim();
      const driver = (parts[1] || '').trim();
      const ram = parseInt(parts[3], 10);
      if (!name) return null;
      const ramMB = ram > 0 ? Math.round(ram / 1024 / 1024) : null;
      return ramMB ? `${name} (${ramMB}MB, driver: ${driver})` : `${name} (driver: ${driver})`;
    }).filter(Boolean);
    if (gpus.length > 0) gpuInfo = gpus.join(' | ');
  } catch (e) {}
  ctx.caches._cachedSystemInfo = { cpuModel, totalMemMB, freeMemMB, osRelease, osType, osArch, gpuInfo };
  return ctx.caches._cachedSystemInfo;
}

/* 敏感信息过滤 */
const SENSITIVE_PATTERNS = [
  { pattern: /--accessToken\s+\S+/g, replacement: '--accessToken ***' },
  { pattern: /--uuid\s+\S+/g, replacement: '--uuid ***' },
  { pattern: /auth_access_token[=:]\s*\S+/g, replacement: 'auth_access_token=***' },
  { pattern: /auth_uuid[=:]\s*\S+/g, replacement: 'auth_uuid=***' },
  { pattern: /accessToken['"]\s*:\s*['"][^'"]+['"]/g, replacement: 'accessToken":"***"' },
  { pattern: /refreshToken['"]\s*:\s*['"][^'"]+['"]/g, replacement: 'refreshToken":"***"' },
  { pattern: /token\s*[=:]\s*['"]?[a-zA-Z0-9._-]{20,}['"]?/gi, replacement: 'token=***' },
  { pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, replacement: 'eyJ***' }
];

/**
 * 过滤日志行中的敏感信息（accessToken、uuid 等）
 * @param {string} line - 原始日志行
 * @returns {string} 过滤后的日志行
 */
function filterSensitiveInfo(line) {
  if (!line || typeof line !== 'string') return line;
  let filtered = line;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    filtered = filtered.replace(pattern, replacement);
  }
  return filtered;
}

/* PNG 编解码 (用于皮肤头像处理) */

/**
 * 解码 PNG 文件为 RGBA 像素缓冲
 * @param {Buffer} buf - PNG 文件缓冲
 * @returns {Buffer|null} RGBA 像素缓冲，失败返回 null
 */
function decodePngPixels(buf) {
  try {
    let offset = 8;
    let width = 0, height = 0, bitDepth = 0, colorType = 0;
    const idatChunks = [];

    while (offset < buf.length) {
      if (offset + 8 > buf.length) break;
      const chunkLen = buf.readUInt32BE(offset);
      const chunkType = buf.slice(offset + 4, offset + 8).toString('ascii');
      if (chunkType === 'IHDR') {
        width = buf.readUInt32BE(offset + 8);
        height = buf.readUInt32BE(offset + 12);
        bitDepth = buf[offset + 16];
        colorType = buf[offset + 17];
      } else if (chunkType === 'IDAT') {
        idatChunks.push(buf.slice(offset + 8, offset + 8 + chunkLen));
      }
      offset += 12 + chunkLen;
    }

    if (width === 0 || height === 0) return null;

    const compressed = Buffer.concat(idatChunks);
    const raw = zlib.inflateSync(compressed);

    const bpp = (colorType === 6) ? 4 : (colorType === 2) ? 3 : (colorType === 0) ? 1 : 4;
    const outBpp = 4;
    const pixels = Buffer.alloc(width * height * outBpp, 0);
    const prevRow = Buffer.alloc(width * outBpp, 0);
    let srcIdx = 0;

    // PNG 滤镜预测器
    function paethPredictor(a, b, c) {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      if (pa <= pb && pa <= pc) return a;
      if (pb <= pc) return b;
      return c;
    }

    for (let y = 0; y < height; y++) {
      if (srcIdx >= raw.length) break;
      const filter = raw[srcIdx++];
      const curRow = Buffer.alloc(width * outBpp, 0);

      for (let x = 0; x < width; x++) {
        const curIdx = x * outBpp;
        for (let c = 0; c < bpp; c++) {
          if (srcIdx >= raw.length) break;
          let val = raw[srcIdx++];

          const leftIdx = (x - 1) * outBpp;
          const aboveIdx = x * outBpp;
          const aboveLeftIdx = (x - 1) * outBpp;

          const left = x > 0 ? curRow[leftIdx + c] : 0;
          const above = prevRow[aboveIdx + c];
          const aboveLeft = x > 0 ? prevRow[aboveLeftIdx + c] : 0;

          switch (filter) {
            case 0: break;
            case 1: val = (val + left) & 0xFF; break;
            case 2: val = (val + above) & 0xFF; break;
            case 3: val = (val + Math.floor((left + above) / 2)) & 0xFF; break;
            case 4: val = (val + paethPredictor(left, above, aboveLeft)) & 0xFF; break;
          }

          if (c < outBpp) curRow[curIdx + c] = val;
        }
        if (bpp === 3) curRow[x * outBpp + 3] = 255;
        if (bpp === 1) {
          const v = curRow[x * outBpp];
          curRow[x * outBpp + 1] = v;
          curRow[x * outBpp + 2] = v;
          curRow[x * outBpp + 3] = 255;
        }
      }

      curRow.copy(pixels, y * width * outBpp);
      curRow.copy(prevRow);
    }

    return pixels;
  } catch (e) {
    return null;
  }
}

/**
 * 将 RGBA 像素缓冲编码为 PNG 文件
 * @param {Buffer} pixels - RGBA 像素缓冲
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @returns {Buffer} PNG 文件缓冲
 */
function encodePng(pixels, width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0;
    pixels.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(rawData);

  const chunks = [
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0))
  ];

  return Buffer.concat([signature, ...chunks]);
}

/**
 * 构造 PNG chunk
 * @param {string} type - chunk 类型
 * @param {Buffer} data - chunk 数据
 * @returns {Buffer} 完整的 chunk 缓冲
 */
function makePngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/**
 * 计算 CRC32 校验码
 * @param {Buffer} buf - 输入缓冲
 * @returns {number} CRC32 值
 */
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/* JAR 完整性检查 */

/**
 * 检查 JAR 文件完整性（PK 头 + EOCD 尾）
 * @param {string} filePath - JAR 文件路径
 * @returns {boolean} 文件完整返回 true
 */
function isJarIntact(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const fd = fs.openSync(filePath, 'r');
    const hdr = Buffer.alloc(4);
    fs.readSync(fd, hdr, 0, 4, 0);
    const stat = fs.fstatSync(fd);
    fs.closeSync(fd);
    if (stat.size < 200) return false;
    if (hdr[0] !== 0x50 || hdr[1] !== 0x4B || hdr[2] !== 0x03 || hdr[3] !== 0x04) return false;
    if (stat.size < 22) return stat.size >= 200;
    const buf = Buffer.alloc(Math.min(65557, stat.size));
    const searchStart = Math.max(0, stat.size - buf.length);
    const fd2 = fs.openSync(filePath, 'r');
    fs.readSync(fd2, buf, 0, buf.length, searchStart);
    fs.closeSync(fd2);
    let eocdOffset = -1;
    for (let i = buf.length - 22; i >= 0; i--) {
      if (buf.readUInt32LE(i) === 0x06054B50) { eocdOffset = i; break; }
    }
    if (eocdOffset < 0) return false;
    // 验证 EOCD 位置：允许尾部有附加数据（数字签名 / self-extracting 包装等）
    // 仅当 EOCD + 22 + 注释长度超过文件大小（说明文件被截断）才判损坏
    // 不再要求严格等于文件大小，避免误判带签名 / 尾部追加数据的合法 JAR
    const commentLen = buf.readUInt16LE(eocdOffset + 20);
    const eocdOffsetInFile = searchStart + eocdOffset;
    if (eocdOffsetInFile + 22 + commentLen > stat.size) return false;
    const cdOffset = buf.readUInt32LE(eocdOffset + 16);
    if (cdOffset < 0 || cdOffset + 4 > stat.size) return false;
    const cdHdr = Buffer.alloc(4);
    const fd3 = fs.openSync(filePath, 'r');
    fs.readSync(fd3, cdHdr, 0, 4, cdOffset);
    fs.closeSync(fd3);
    if (cdHdr.readUInt32LE(0) !== 0x02014B50) return false;
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 深度检查 JAR 文件完整性（在 isJarIntact 基础上，用 AdmZip 验证所有条目可读）
 * 能检测出 ZIP 结构完整但内部数据损坏的情况（如中央目录有条目但本地数据损坏）
 * 用于 mods 目录的严格校验，避免游戏启动时才发现内部损坏
 * @param {string} filePath - JAR 文件路径
 * @returns {boolean} 文件完整返回 true
 */
function isJarIntactDeep(filePath) {
  try {
    if (!isJarIntact(filePath)) return false;
    const AdmZip = getAdmZip();
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      try {
        entry.getData();
      } catch (e) {
        return false;
      }
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 读取 JAR 文件中的模组标识（modId）。
 * 依次尝试：META-INF/mods.toml（Forge 1.13+）→ mcmod.info（Forge 旧版）→ fabric.mod.json（Fabric）。
 * @param {string} filePath - JAR 文件路径
 * @returns {string|null} 第一个 modId，失败返回 null
 */
function readJarModId(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const AdmZip = getAdmZip();
    const zip = new AdmZip(filePath);

    // Forge 1.13+：mods.toml
    const modsToml = zip.getEntry('META-INF/mods.toml');
    if (modsToml) {
      const text = modsToml.getData().toString('utf8');
      // TOML 中 [[mods]] 段下的 modId = "xxx"
      const m = text.match(/\[\[mods\]\][\s\S]*?modId\s*=\s*["']([^"']+)["']/);
      if (m && m[1]) return m[1].trim();
    }

    // Forge 旧版：mcmod.info（JSON 数组）
    const mcmod = zip.getEntry('mcmod.info');
    if (mcmod) {
      const text = mcmod.getData().toString('utf8');
      const data = JSON.parse(text);
      if (Array.isArray(data) && data[0] && data[0].modid) return String(data[0].modid).trim();
      if (data && data.modid) return String(data.modid).trim();
    }

    // Fabric：fabric.mod.json
    const fabricMod = zip.getEntry('fabric.mod.json');
    if (fabricMod) {
      const text = fabricMod.getData().toString('utf8');
      const data = JSON.parse(text);
      if (data && data.id) return String(data.id).trim();
    }
  } catch (_) {}
  return null;
}

/* SHA1 计算 */

/**
 * 计算文件的 SHA1 哈希（流式异步，不阻塞事件循环）
 * 大文件下同步 readFileSync 会阻塞事件循环导致并发下载速度坍塌，
 * 改用 fs.createReadStream + crypto 流式计算，每 chunk 让出事件循环。
 * @param {string} filePath - 文件路径
 * @returns {Promise<string|null>} SHA1 十六进制字符串，失败返回 null
 */
async function calculateSHA1(filePath) {
  return new Promise((resolve) => {
    try {
      const hash = crypto.createHash('sha1');
      const stream = fs.createReadStream(filePath, { highWaterMark: 256 * 1024 });
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', () => resolve(null));
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * 计算文件的 SHA1 哈希（同步版本，仅供小文件或启动期使用）
 * 大文件下会阻塞事件循环，下载流程请使用 calculateSHA1（异步版本）
 * @param {string} filePath - 文件路径
 * @returns {string|null} SHA1 十六进制字符串，失败返回 null
 */
function calculateSHA1Sync(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha1').update(data).digest('hex');
  } catch (e) {
    return null;
  }
}

/**
 * 异步校验文件 SHA1
 * @param {string} filePath - 文件路径
 * @param {string} expectedSha1 - 期望的 SHA1
 * @returns {Promise<boolean>} 校验通过返回 true
 */
async function verifyFileSha1(filePath, expectedSha1) {
  if (!expectedSha1) return true;
  const actual = await calculateSHA1(filePath);
  return actual === expectedSha1;
}

/**
 * 同步校验文件 SHA1
 * @param {string} filePath - 文件路径
 * @param {string} expectedSha1 - 期望的 SHA1
 * @returns {boolean} 校验通过返回 true
 */
function verifyFileSha1Sync(filePath, expectedSha1) {
  if (!expectedSha1) return true;
  const actual = calculateSHA1Sync(filePath);
  return actual === expectedSha1;
}

/* 初始化：定期清理缓存与过期会话 */
setInterval(() => {
  try { ctx.caches.dirCache.clear(); } catch (e) {}
  try {
    // 懒加载 skins 模块，避免与 utils.js 顶部 require 形成循环依赖
    const skins = require('./skins');
    if (skins && typeof skins.cleanAvatarCache === 'function') {
      skins.cleanAvatarCache();
    }
  } catch (e) {}
  try {
    // 扫描 repairSessions/javaInstallSessions/launchSessions，超过 30 分钟无活动则删除
    const SESSION_TIMEOUT = 30 * 60 * 1000;
    const now = Date.now();
    const sessionMaps = [
      ctx.sessions.repairSessions,
      ctx.sessions.javaInstallSessions,
      ctx.sessions.launchSessions
    ];
    for (const sm of sessionMaps) {
      if (!sm || typeof sm.forEach !== 'function') continue;
      const toDelete = [];
      sm.forEach((session, id) => {
        const last = (session && session.lastActivity) || 0;
        if (last && (now - last > SESSION_TIMEOUT)) toDelete.push(id);
      });
      for (const id of toDelete) {
        try { sm.delete(id); } catch (e) {}
      }
    }
  } catch (e) {}
  try {
    // 淘汰过期缓存条目：_resolvedJsonCache(60s)、dnsCache(60s)、versionDetailsCache(30min)
    const now = Date.now();
    // _resolvedJsonCache + _resolvedJsonCacheTime (Map，TTL 60s)
    try {
      const rjc = ctx.caches._resolvedJsonCache;
      const rjcTime = ctx.caches._resolvedJsonCacheTime;
      const rjcTtl = ctx.caches.RESOLVED_JSON_CACHE_TTL;
      if (rjc && rjcTime && typeof rjc.forEach === 'function') {
        const toDelete = [];
        rjc.forEach((_, key) => {
          const t = rjcTime.get(key) || 0;
          if (t && (now - t > rjcTtl)) toDelete.push(key);
        });
        for (const key of toDelete) {
          try { rjc.delete(key); } catch (e) {}
          try { rjcTime.delete(key); } catch (e) {}
        }
      }
    } catch (e) {}
    // dnsCache (Map，TTL 60s，条目 { address, family, time })
    try {
      const dc = ctx.caches.dnsCache;
      const dcTtl = ctx.caches.DNS_CACHE_TTL;
      if (dc && typeof dc.forEach === 'function') {
        const toDelete = [];
        dc.forEach((value, key) => {
          const t = (value && value.time) || 0;
          if (t && (now - t > dcTtl)) toDelete.push(key);
        });
        for (const key of toDelete) {
          try { dc.delete(key); } catch (e) {}
        }
      }
    } catch (e) {}
    // versionDetailsCache (普通对象，TTL 30min，配合 versionDetailsCacheTime)
    try {
      const vdc = ctx.caches.versionDetailsCache;
      const vdct = ctx.caches.versionDetailsCacheTime;
      const vdcTtl = ctx.caches.VERSION_DETAILS_CACHE_TTL;
      if (vdc && vdct) {
        for (const key of Object.keys(vdc)) {
          const t = vdct[key] || 0;
          if (t && (now - t > vdcTtl)) {
            try { delete vdc[key]; } catch (e) {}
            try { delete vdct[key]; } catch (e) {}
          }
        }
      }
    } catch (e) {}
  } catch (e) {}
}, 5 * 60 * 1000);
rotateLogs();

module.exports = {
  getAdmZip,
  ensureDir,
  asyncEnsureDir,
  ensureDirForFile,
  yieldToEventLoop,
  sleep,
  generateUUID,
  safeWriteFileSync,
  safeReadJsonFile,
  safeLibPath,
  rotateLogs,
  _writeImportLog,
  _clearImportLog,
  formatSize,
  formatPlayTime,
  formatDriveSize,
  getPlatformKey,
  escapeRegExp,
  escapeReplaceValue,
  replaceVariables,
  getDirSize,
  getSystemInfo,
  filterSensitiveInfo,
  decodePngPixels,
  encodePng,
  makePngChunk,
  crc32,
  isJarIntact,
  isJarIntactDeep,
  readJarModId,
  calculateSHA1,
  calculateSHA1Sync,
  verifyFileSha1,
  verifyFileSha1Sync,
  applyImageMirror
};

/* 图片 URL 镜像替换：把 Modrinth/CurseForge CDN 图片转成后端代理 URL。
   原因：mcimirror.top 对图片会 302 回官方源，国内直连 cdn-alt.modrinth.com 和 forgecdn 都被墙。
   方案：通过 /api/img-proxy 后端代理下载图片，彻底绕过 CDN 被墙问题。 */
function applyImageMirror(url) {
  if (!url || typeof url !== 'string') return url;
  // 只代理 Modrinth 和 CurseForge 的 CDN 图片
  const cdnPrefixes = [
    'https://cdn.modrinth.com/',
    'https://cdn-alt.modrinth.com/',
    'https://edge.forgecdn.net/',
    'https://mediafilez.forgecdn.net/',
    'https://media.forgecdn.net/'
  ];
  for (const prefix of cdnPrefixes) {
    if (url.startsWith(prefix)) {
      return '/api/img-proxy?url=' + encodeURIComponent(url);
    }
  }
  return url;
}
