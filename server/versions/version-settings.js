/**
 * @file server/versions/version-settings.js - 版本设置相关函数
 * @description 全局设置缓存、磁盘缓存写入、版本独立设置的读写。
 */

const { fs, path, ctx, utils } = require('./shared');

// 读取缓存的设置（带 TTL），不存在则用默认值合并磁盘上的设置
function loadSettingsCached() {
  const now = Date.now();
  if (ctx.caches._settingsCache && (now - ctx.caches._settingsCacheTime) < ctx.caches.SETTINGS_CACHE_TTL) {
    return ctx.caches._settingsCache;
  }
  const defaults = {
    maxMemory: 4096,
    minMemory: 1024,
    gameDir: ctx.dirs.DATA_DIR,
    versionIsolation: true,
    javaArgs: '',
    fullscreen: false,
    resolution: '1920x1080',
    autoUpdate: true,
    closeOnLaunch: false,
    selectedVersion: '',
    selectedAccount: '',

    downloadSource: 'auto',
    versionSource: 'auto',
    maxThreads: 16,
    enableChunkDownload: true,
    maxChunksPerFile: 32,
    speedLimit: 0,
    targetDir: '',
    sslVerify: false,

    modSource: 'modrinth',
    filenameFormat: 'default',
    modStyle: 'title',
    ignoreQuilt: false,

    accentColor: '#4a9eff',
    blurBg: true,
    backgroundImage: '',
    avatarImage: '',
    autoSetChinese: true,
    jvmPreheat: true,
    enableCds: true
  };

  const saved = utils.safeReadJsonFile(ctx.dirs.SETTINGS_FILE, null);
  ctx.caches._settingsCache = saved ? { ...defaults, ...saved } : defaults;
  ctx.caches._settingsCacheTime = now;
  return ctx.caches._settingsCache;
}

// 把版本清单缓存写入磁盘
function saveDiskCache() {
  try {
    const dir = path.dirname(ctx.dirs.DISK_CACHE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ctx.dirs.DISK_CACHE_PATH, JSON.stringify({ data: ctx.caches.versionCache, timestamp: ctx.caches.versionCacheTime }));
  } catch (e) {}
}

/**
 * 读取版本独立设置（customName、description、java、内存、隔离等）
 * @param {string} versionId - 版本 ID（外部版本带 " [外部N]" 后缀）
 * @returns {object} 版本设置对象（含默认值合并）
 */
function loadVersionSettings(versionId) {
  const cleanId = versionId.replace(/ \[外部\d*\]/, '');
  const isExternal = versionId.includes(' [外部');
  let settingsFile;
  if (isExternal) {
    // 外部版本设置统一存放在 DATA_DIR/external-settings 下，避免污染外部目录
    const externalSettingsDir = path.join(ctx.dirs.DATA_DIR, 'external-settings');
    if (!fs.existsSync(externalSettingsDir)) fs.mkdirSync(externalSettingsDir, { recursive: true });
    settingsFile = path.join(externalSettingsDir, `${cleanId.replace(/[/\\?%*:|"<>]/g, '_')}-settings.json`);
  } else {
    // 路径穿越防护：拒绝包含 ..、/、\ 的版本 ID
    if (cleanId.includes('..') || cleanId.includes('/') || cleanId.includes('\\')) {
      return { versionId, customName: '', description: '', icon: 'auto', category: 'auto', favorite: false };
    }
    settingsFile = path.join(ctx.dirs.VERSIONS_DIR, cleanId, 'version-settings.json');
  }
  const defaults = {
    versionId: versionId,
    customName: '',
    description: '',
    icon: 'auto',
    category: 'auto',
    favorite: false,
    isolation: isExternal ? 'on' : 'global',
    windowTitle: '',
    customInfo: '',
    javaPath: 'global',
    memoryMode: 'global',
    memoryValue: 4096,
    memOptimize: 'global',
    jvmArgs: '',
    gameArgs: '',
    customMainClass: '',
    beforeLaunchCommand: '',
    afterLaunchCommand: '',
    fullscreen: 'global',
    resolution: ''
  };
  try {
    if (fs.existsSync(settingsFile)) {
      const saved = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
      return { ...defaults, ...saved };
    }
  } catch (e) {}
  return defaults;
}

/**
 * 保存版本独立设置
 * @param {string} versionId - 版本 ID（外部版本带 " [外部N]" 后缀）
 * @param {object} settings - 版本设置对象
 * @throws {Error} 当 versionId 非法或版本目录不存在时抛出
 */
function saveVersionSettings(versionId, settings) {
  const cleanId = versionId.replace(/ \[外部\d*\]/, '');
  const isExternal = versionId.includes(' [外部');
  let settingsFile;
  if (isExternal) {
    const externalSettingsDir = path.join(ctx.dirs.DATA_DIR, 'external-settings');
    if (!fs.existsSync(externalSettingsDir)) fs.mkdirSync(externalSettingsDir, { recursive: true });
    settingsFile = path.join(externalSettingsDir, `${cleanId.replace(/[/\\?%*:|"<>]/g, '_')}-settings.json`);
  } else {
    // 路径穿越防护：拒绝包含 ..、/、\ 的版本 ID
    if (cleanId.includes('..') || cleanId.includes('/') || cleanId.includes('\\')) {
      throw new Error('Invalid versionId');
    }
    const versionDir = path.join(ctx.dirs.VERSIONS_DIR, cleanId);
    if (!fs.existsSync(versionDir)) throw new Error(`版本目录不存在: ${cleanId}`);
    settingsFile = path.join(versionDir, 'version-settings.json');
  }
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

module.exports = {
  loadSettingsCached,
  saveDiskCache,
  loadVersionSettings,
  saveVersionSettings
};
