/**
 * server/accounts.js - 账号与设置功能模块
 * ============================================================================
 * 从 server.js 抽取的账号、设置、收藏夹、令牌加密相关函数。
 * 通过 ctx (./context) 访问共享状态，通过 utils (./utils) 访问工具函数。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const ctx = require('./context');
const utils = require('./utils');
const logger = require('./logger').createLogger('Accounts');

// ============================================================================
// 收藏夹
// ============================================================================

function loadFavorites() {
    try {
        if (fs.existsSync(ctx.dirs.FAVORITES_FILE)) {
            const data = JSON.parse(fs.readFileSync(ctx.dirs.FAVORITES_FILE, 'utf8'));
            if (Array.isArray(data)) {
                if (data.length === 0) {
                    const defaultFavs = [{ name: '默认', id: utils.generateUUID(), favs: [], notes: {} }];
                    saveFavorites(defaultFavs);
                    return defaultFavs;
                }
                return data;
            }
            if (typeof data === 'object' && data !== null) {
                const converted = [{ name: '默认', id: utils.generateUUID(), favs: Object.keys(data).filter(k => data[k]), notes: {} }];
                saveFavorites(converted);
                return converted;
            }
        }
    } catch (e) {}
    const defaultFavs = [{ name: '默认', id: utils.generateUUID(), favs: [], notes: {} }];
    saveFavorites(defaultFavs);
    return defaultFavs;
}

function saveFavorites(favorites) {
    try {
        utils.safeWriteFileSync(ctx.dirs.FAVORITES_FILE, JSON.stringify(favorites, null, 2));
    } catch (e) {}
}

// ============================================================================
// 设置
// ============================================================================

function loadSettings() {
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
    return saved ? { ...defaults, ...saved } : defaults;
}

function loadSettingsCached() {
    const now = Date.now();
    if (ctx.caches._settingsCache && (now - ctx.caches._settingsCacheTime) < ctx.caches.SETTINGS_CACHE_TTL) {
        return ctx.caches._settingsCache;
    }
    ctx.caches._settingsCache = loadSettings();
    ctx.caches._settingsCacheTime = now;
    return ctx.caches._settingsCache;
}

function invalidateSettingsCache() {
    ctx.caches._settingsCache = null;
    ctx.caches._settingsCacheTime = 0;
}

function saveSettings(settings) {
    invalidateSettingsCache();
    ctx.caches._settingsCache = settings;
    ctx.caches._settingsCacheTime = Date.now();
    utils.safeWriteFileSync(ctx.dirs.SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// ============================================================================
// 账号
// ============================================================================

function loadAccounts() {
    if (ctx.caches._accountsCache && Date.now() - ctx.caches._accountsCacheTime < ctx.caches.ACCOUNTS_CACHE_TTL) {
        return ctx.caches._accountsCache;
    }
    let result = [];
    const raw = utils.safeReadJsonFile(ctx.dirs.ACCOUNTS_FILE, []);
    if (Array.isArray(raw)) {
        result = raw.map(acc => {
            if (acc.accessToken && acc.accessToken.startsWith('enc:')) {
                try { acc.accessToken = decryptToken(acc.accessToken.slice(4)); }
                catch (e) {
                    // 令牌解密失败不能静默：标记账号需要重新登录，而非继续用加密态令牌
                    console.warn(`[Accounts] accessToken 解密失败 (账号 ${acc.username || acc.id || '未知'}): ${e.message}，标记需要重新登录`);
                    acc.accessToken = '';
                    acc._needRelogin = true;
                }
            }
            if (acc.refreshToken && acc.refreshToken.startsWith('enc:')) {
                try { acc.refreshToken = decryptToken(acc.refreshToken.slice(4)); }
                catch (e) {
                    logger.warn(`refreshToken 解密失败 (账号 ${acc.username || acc.id || '未知'}): ${e.message}`);
                    acc.refreshToken = '';
                    acc._needRelogin = true;
                }
            }
            return acc;
        });
    }
    ctx.caches._accountsCache = result;
    ctx.caches._accountsCacheTime = Date.now();
    return result;
}

// ============================================================================
// 令牌加密
// ============================================================================

function getTokenEncKey() {
    if (ctx.caches._tokenEncKey) return ctx.caches._tokenEncKey;
    const machineId = os.hostname() + os.userInfo().username + ctx.dirs.DATA_DIR;
    ctx.caches._tokenEncKey = crypto.createHash('sha256').update(machineId).digest();
    return ctx.caches._tokenEncKey;
}

function encryptToken(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ctx.constants.TOKEN_ENC_ALGO, getTokenEncKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decryptToken(data) {
    const [ivHex, encrypted] = data.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ctx.constants.TOKEN_ENC_ALGO, getTokenEncKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

function saveAccounts(accounts) {
    ctx.caches._accountsCache = null;
    ctx.caches._accountsCacheTime = 0;
    const toSave = accounts.map(acc => {
        const copy = { ...acc };
        if (copy.accessToken) copy.accessToken = 'enc:' + encryptToken(copy.accessToken);
        if (copy.refreshToken) copy.refreshToken = 'enc:' + encryptToken(copy.refreshToken);
        return copy;
    });
    const json = JSON.stringify(toSave, null, 2);
    utils.safeWriteFileSync(ctx.dirs.ACCOUNTS_FILE, json);
}

module.exports = {
    loadFavorites,
    saveFavorites,
    loadSettings,
    loadSettingsCached,
    invalidateSettingsCache,
    saveSettings,
    loadAccounts,
    getTokenEncKey,
    encryptToken,
    decryptToken,
    saveAccounts,
};
