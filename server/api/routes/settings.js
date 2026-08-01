/**
 * server/api/routes/settings.js - 设置路由
 * ============================================================================
 * 从 server.js handleAPI switch 语句抽取的设置相关端点。
 */

const fs = require('fs');
const path = require('path');

module.exports = {
    register(registerRoute, deps) {
        const { ctx, sendJSON, sendError, readBody } = deps;
        const { accounts, versions } = deps;

        const DATA_DIR_CONFIG_FILE = ctx.dirs.DATA_DIR_CONFIG_FILE;

        // ====================================================================
        // /api/settings
        // ====================================================================
        registerRoute('*', '/api/settings', async (req, res, parsedUrl) => {
            if (req.method === 'POST') {
                const data = await readBody(req);
                const current = accounts.loadSettingsCached();
                const updated = { ...current, ...data };
                accounts.saveSettings(updated);
                sendJSON(res, { success: true, settings: updated });
            } else {
                sendJSON(res, accounts.loadSettingsCached());
            }
        });

        // ====================================================================
        // /api/settings/set
        // ====================================================================
        registerRoute('*', '/api/settings/set', async (req, res, parsedUrl) => {
            if (req.method === 'POST') {
                const data = await readBody(req);
                const current = accounts.loadSettingsCached();
                current[data.key] = data.value;
                accounts.saveSettings(current);
                sendJSON(res, { success: true });
            } else {
                sendError(res, 'Method not allowed', 405);
            }
        });

        // ====================================================================
        // /api/settings/reset
        // ====================================================================
        registerRoute('*', '/api/settings/reset', async (req, res, parsedUrl) => {
            if (req.method === 'POST') {
                try {
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
                        maxThreads: 64,
                        enableChunkDownload: true,
                        maxChunksPerFile: 64,
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
                        autoSetChinese: true
                    };
                    accounts.saveSettings(defaults);
                    sendJSON(res, { success: true, settings: defaults });
                } catch (e) {
                    console.error('[设置] 重置失败:', e);
                    sendJSON(res, { success: false, error: e.message });
                }
            } else {
                sendError(res, 'Method not allowed', 405);
            }
        });

        // ====================================================================
        // /api/settings/data-dir
        // ====================================================================
        registerRoute('*', '/api/settings/data-dir', async (req, res, parsedUrl) => {
            if (req.method === 'POST') {
                try {
                    const { dataDir, reset } = await readBody(req);
                    if (reset) {
                        try { fs.unlinkSync(DATA_DIR_CONFIG_FILE); } catch (e) {}
                        sendJSON(res, { ok: true, message: '已重置为默认目录，重启后生效' });
                        return;
                    }
                    if (!dataDir || typeof dataDir !== 'string') {
                        sendJSON(res, { error: '请提供有效的目录路径' }, 400);
                        return;
                    }
                    const resolvedPath = path.resolve(dataDir);
                    const oldDataDir = ctx.dirs.DATA_DIR;

                    // 不能与当前目录相同
                    if (path.resolve(resolvedPath) === path.resolve(oldDataDir)) {
                        sendJSON(res, { ok: true, message: '新目录与当前目录相同，无需修改' });
                        return;
                    }

                    fs.mkdirSync(resolvedPath, { recursive: true });

                    // 复制关键配置文件到新目录（避免激活信息、账号、设置丢失）
                    const criticalFiles = [
                        'app-store.json',
                        'window-config.json',
                        'accounts.json',
                        'settings.json',
                        'external-folders.json',
                        'favorites.json',
                        'update-config.json'
                    ];
                    for (const fname of criticalFiles) {
                        const src = path.join(oldDataDir, fname);
                        const dst = path.join(resolvedPath, fname);
                        try {
                            if (fs.existsSync(src)) {
                                fs.copyFileSync(src, dst);
                            }
                        } catch (e) {
                            console.error(`[设置] 复制 ${fname} 失败:`, e.message);
                        }
                    }

                    // 写入 data-config.json
                    fs.writeFileSync(DATA_DIR_CONFIG_FILE, JSON.stringify({ dataDir: resolvedPath }, null, 2));

                    // 将旧 versions 目录注册为外部文件夹（保留旧版本可见）
                    try {
                        const oldVersionsDir = ctx.dirs.VERSIONS_DIR;
                        if (fs.existsSync(oldVersionsDir)) {
                            const entries = fs.readdirSync(oldVersionsDir).filter(e => {
                                try { return fs.statSync(path.join(oldVersionsDir, e)).isDirectory(); } catch (_) { return false; }
                            });
                            if (entries.length > 0) {
                                const folders = versions.loadExternalFolders();
                                const alreadyRegistered = folders.some(f => path.resolve(f.path) === path.resolve(oldDataDir));
                                if (!alreadyRegistered) {
                                    folders.push({ name: path.basename(oldDataDir), path: oldDataDir });
                                    versions.saveExternalFolders(folders);
                                }
                            }
                        }
                    } catch (e) {}

                    sendJSON(res, { ok: true, dataDir: resolvedPath, message: '数据目录已修改，关键配置已迁移。请重启软件使设置完全生效。' });
                } catch (e) {
                    console.error('[设置] 修改数据目录失败:', e);
                    sendJSON(res, { error: '保存失败: ' + e.message }, 500);
                }
            } else {
                sendJSON(res, { dataDir: ctx.dirs.DATA_DIR, isDefault: !fs.existsSync(DATA_DIR_CONFIG_FILE) });
            }
        });
    }
};
