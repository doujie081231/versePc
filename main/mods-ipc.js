// ============================================================================
// 模组文件操作 IPC Handlers
// ============================================================================

const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseJarFile, readJarEntryContent } = require('./jar-parser');
// 统一数据目录解析，避免硬编码 ~/.versepc 导致数据回退到 C 盘
const paths = require('./paths');

/**
 * 注册所有模组相关的 IPC 处理器
 * 提供文件浏览、读写、搜索、JAR 操作等功能
 * @param {Object} deps
 * @param {(filePath: string) => boolean} deps.isPathAllowed - 路径白名单校验函数
 * @param {() => Object} deps.loadStore - 读取本地 store 的函数
 */
function registerModsIPC({ isPathAllowed, loadStore } = {}) {
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
            const versionsDir = paths.VERSIONS_DIR;
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
            let hasEnUs = false;
            let hasZhCn = false;
            let defaultLang = null;
            langFiles.forEach(function(e) {
                let lower = e.name.toLowerCase();
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
            const dataDir = paths.DATA_DIR;
            const versionsDir = paths.VERSIONS_DIR;
            const minecraftDir = path.join(os.homedir(), '.minecraft');

            let settings = {};
            try {
                const content = await fs.promises.readFile(paths.SETTINGS_FILE, 'utf8');
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
            const versionsDir = paths.VERSIONS_DIR;
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

module.exports = { registerModsIPC };
