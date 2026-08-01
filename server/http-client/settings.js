/**
 * @file server/http-client/settings.js - 设置缓存读取
 * @description 读取缓存的设置（带 TTL），不存在则用默认值合并磁盘上的设置。
 *   通过 ctx (../context) 访问共享状态，通过 utils (../utils) 访问工具函数。
 */

const ctx = require('../context');
const utils = require('../utils');

/**
 * 读取缓存的设置（带 TTL），不存在则用默认值合并磁盘上的设置
 * @returns {object} 设置对象
 */
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

module.exports = { loadSettingsCached };
