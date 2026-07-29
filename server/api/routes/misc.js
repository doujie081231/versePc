/**
 * server/api/routes/misc.js - 杂项路由
 * ============================================================================
 * 从 server.js handleAPI switch 语句抽取的杂项端点：当前上下文、快捷方式、
 * 截图、服务器 ping、背景图保存/清除。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

module.exports = {
    register(registerRoute, deps) {
        const { ctx, sendJSON, sendError, readBody } = deps;
        const { versions, mods, network } = deps;

        const DATA_DIR = ctx.dirs.DATA_DIR;
        const VERSIONS_DIR = ctx.dirs.VERSIONS_DIR;

        // ====================================================================
        // /api/img-proxy - 图片代理（解决 Modrinth/CurseForge CDN 国内被墙问题）
        // 前端把图片 URL 通过此接口转发，后端下载后返回图片数据
        // ====================================================================
        const https = require('https');
        const http = require('http');
        const _imgProxyCache = new Map();
        const _IMG_CACHE_MAX = 300;
        const _IMG_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

        function _fetchImage(url, maxRedirects) {
            return new Promise((resolve, reject) => {
                if (maxRedirects < 0) { reject(new Error('too many redirects')); return; }
                const client = url.startsWith('https') ? https : http;
                const opts = { timeout: 15000, headers: { 'User-Agent': 'VersePC/1.0' } };
                client.get(url, opts, (proxyRes) => {
                    if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
                        proxyRes.resume();
                        let nextUrl = proxyRes.headers.location;
                        if (nextUrl.startsWith('/')) nextUrl = new URL(url).origin + nextUrl;
                        _fetchImage(nextUrl, maxRedirects - 1).then(resolve, reject);
                        return;
                    }
                    if (proxyRes.statusCode !== 200) {
                        proxyRes.resume();
                        reject(new Error('status ' + proxyRes.statusCode));
                        return;
                    }
                    const mime = proxyRes.headers['content-type'] || 'image/png';
                    const chunks = [];
                    proxyRes.on('data', (c) => chunks.push(c));
                    proxyRes.on('end', () => resolve({ buf: Buffer.concat(chunks), mime }));
                }).on('error', (e) => reject(e)).on('timeout', function() {
                    this.destroy();
                    reject(new Error('timeout'));
                });
            });
        }

        // CDN 镜像映射：把被墙的 CDN URL 转成镜像 URL
        const _CDN_MIRRORS = [
            { prefix: 'https://cdn.modrinth.com/', mirror: 'https://mod.mcimirror.top/cdn/modrinth/' },
            { prefix: 'https://cdn-alt.modrinth.com/', mirror: 'https://mod.mcimirror.top/cdn/modrinth/' },
            { prefix: 'https://edge.forgecdn.net/', mirror: 'https://mod.mcimirror.top/cdn/curseforge/' },
            { prefix: 'https://mediafilez.forgecdn.net/', mirror: 'https://mod.mcimirror.top/cdn/curseforge/' },
            { prefix: 'https://media.forgecdn.net/', mirror: 'https://mod.mcimirror.top/cdn/curseforge/' },
        ];
        function _tryCdnMirror(url) {
            for (const m of _CDN_MIRRORS) {
                if (url.startsWith(m.prefix)) {
                    return url.replace(m.prefix, m.mirror);
                }
            }
            return null;
        }

        registerRoute('GET', '/api/img-proxy', async (req, res, parsedUrl) => {
            let targetUrl = parsedUrl.query.url || '';
            if (!targetUrl) { res.writeHead(400); res.end('missing url'); return; }
            try { targetUrl = decodeURIComponent(targetUrl); } catch (_) {}
            if (!/^https?:\/\//.test(targetUrl)) { res.writeHead(400); res.end('invalid url'); return; }

            // 内存缓存命中
            const cached = _imgProxyCache.get(targetUrl);
            if (cached && Date.now() - cached.time < _IMG_CACHE_TTL) {
                res.writeHead(200, { 'Content-Type': cached.mime, 'Cache-Control': 'public, max-age=604800' });
                res.end(cached.data);
                return;
            }

            try {
                // 先尝试直接下载（最多等 8 秒）
                let { buf, mime } = await _fetchImage(targetUrl, 5);
                // 直接下载成功，写入缓存
                if (_imgProxyCache.size >= _IMG_CACHE_MAX) {
                    const oldestKey = _imgProxyCache.keys().next().value;
                    _imgProxyCache.delete(oldestKey);
                }
                _imgProxyCache.set(targetUrl, { data: buf, mime, time: Date.now() });
                res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=604800' });
                res.end(buf);
            } catch (err) {
                // 直接下载失败，尝试镜像
                const mirrorUrl = _tryCdnMirror(targetUrl);
                if (mirrorUrl) {
                    try {
                        const { buf, mime } = await _fetchImage(mirrorUrl, 3);
                        if (_imgProxyCache.size >= _IMG_CACHE_MAX) {
                            const oldestKey = _imgProxyCache.keys().next().value;
                            _imgProxyCache.delete(oldestKey);
                        }
                        _imgProxyCache.set(targetUrl, { data: buf, mime, time: Date.now() });
                        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=604800' });
                        res.end(buf);
                        return;
                    } catch (mirrorErr) {
                        // 镜像也失败，返回空图片
                    }
                }
                res.writeHead(502);
                res.end('');
            }
        });

        // ====================================================================
        // /api/favicon - 网站图标代理
        // 国内 DuckDuckGo/Google favicon 服务均被墙，优先使用 Yandex（国内可访问）
        // ====================================================================
        registerRoute('GET', '/api/favicon', async (req, res, parsedUrl) => {
            const domain = parsedUrl.query.domain || '';
            if (!domain) { res.writeHead(400); res.end('missing domain'); return; }

            const services = [
                `https://favicon.yandex.net/favicon/${domain}?size=32`,
                `https://icons.duckduckgo.com/ip3/${domain}.ico`,
                `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`,
                `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback=0&url=https://${encodeURIComponent(domain)}&size=32`
            ];

            const client = domain.startsWith('https') ? https : http;
            for (const serviceUrl of services) {
                try {
                    const { buf, mime } = await _fetchImage(serviceUrl, 3);
                    res.writeHead(200, { 'Content-Type': mime || 'image/x-icon', 'Cache-Control': 'public, max-age=86400' });
                    res.end(buf);
                    return;
                } catch (_) {}
            }

            // 全部失败，返回 1x1 透明像素
            res.writeHead(200, { 'Content-Type': 'image/gif', 'Cache-Control': 'public, max-age=3600' });
            res.end(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
        });

        // ====================================================================
        // /api/current-context
        // ====================================================================
        registerRoute('GET', '/api/current-context', async (req, res, parsedUrl) => {
            await new Promise(r => setImmediate(r));
            try {
                const ctxSettings = versions.loadSettingsCached();
                const ctxVersion = ctxSettings.selectedVersion || '';
                let ctxVersionDir = '';
                let ctxModsDir = '';
                let ctxLoader = '';
                let ctxLoaderVersion = '';
                if (ctxVersion) {
                    ctxVersionDir = path.join(VERSIONS_DIR, ctxVersion);
                    ctxModsDir = versions.getVersionModsDir(ctxVersion);
                    const forgeJson = path.join(ctxVersionDir, 'version.json');
                    const fabricJson = path.join(ctxVersionDir, 'fabric-loader.json');
                    const neoJson = path.join(ctxVersionDir, 'neoforge-loader.json');
                    if (await fs.promises.access(forgeJson).then(() => true).catch(() => false)) {
                        ctxLoader = 'forge';
                        try { const d = JSON.parse(await fs.promises.readFile(forgeJson, 'utf-8')); ctxLoaderVersion = d.id || ''; } catch (e) {}
                    } else if (await fs.promises.access(fabricJson).then(() => true).catch(() => false)) {
                        ctxLoader = 'fabric';
                        try { const d = JSON.parse(await fs.promises.readFile(fabricJson, 'utf-8')); ctxLoaderVersion = d.id || ''; } catch (e) {}
                    } else if (await fs.promises.access(neoJson).then(() => true).catch(() => false)) {
                        ctxLoader = 'neoforge';
                        try { const d = JSON.parse(await fs.promises.readFile(neoJson, 'utf-8')); ctxLoaderVersion = d.id || ''; } catch (e) {}
                    }
                }
                const ctxJavaPath = ctxSettings.javaPath || '';
                const ctxMaxMemory = ctxSettings.maxMemory || '';
                const ctxMinMemory = ctxSettings.minMemory || '';
                const ctxJavaArgs = ctxSettings.javaArgs || '';
                const ctxVersionIsolation = ctxSettings.versionIsolation !== false;
                let ctxModsCount = 0;
                let ctxModsEnabled = 0;
                let ctxModsDisabled = 0;
                if (ctxModsDir && await fs.promises.access(ctxModsDir).then(() => true).catch(() => false)) {
                    const jarFiles = (await fs.promises.readdir(ctxModsDir)).filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'));
                    ctxModsCount = jarFiles.length;
                    ctxModsEnabled = jarFiles.filter(f => f.endsWith('.jar')).length;
                    ctxModsDisabled = jarFiles.filter(f => f.endsWith('.jar.disabled')).length;
                }
                sendJSON(res, {
                    selectedVersion: ctxVersion,
                    versionDir: ctxVersionDir,
                    modsDir: ctxModsDir,
                    loader: ctxLoader,
                    loaderVersion: ctxLoaderVersion,
                    javaPath: ctxJavaPath,
                    maxMemory: ctxMaxMemory,
                    minMemory: ctxMinMemory,
                    javaArgs: ctxJavaArgs,
                    versionIsolation: ctxVersionIsolation,
                    modsCount: ctxModsCount,
                    modsEnabled: ctxModsEnabled,
                    modsDisabled: ctxModsDisabled
                });
            } catch (e) {
                sendError(res, 'Failed to load current context: ' + e.message, 500);
            }
        });

        // ====================================================================
        // /api/create-shortcut
        // ====================================================================
        registerRoute('POST', '/api/create-shortcut', async (req, res, parsedUrl) => {
            if (process.platform !== 'win32') {
                sendJSON(res, { success: false, error: '创建快捷方式仅支持 Windows 系统' });
                return;
            }
            const scBody = await readBody(req);
            const shortcutType = scBody.type || 'desktop';
            const shortcutVersion = scBody.versionId || '';

            const exePath = process.execPath;
            const shortcutName = shortcutVersion ? `VersePC - ${shortcutVersion}` : 'VersePC';

            let shortcutDir;
            if (shortcutType === 'desktop') {
                shortcutDir = path.join(os.homedir(), 'Desktop');
            } else {
                shortcutDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs');
            }

            const shortcutPath = path.join(shortcutDir, `${shortcutName.replace(/["$`]/g, '')}.lnk`);

            const psScript = `
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut("${shortcutPath.replace(/"/g, '`"')}")
$sc.TargetPath = "${exePath.replace(/"/g, '`"')}"
$sc.WorkingDirectory = "${path.dirname(exePath).replace(/"/g, '`"')}"
$sc.Description = "VersePC Minecraft Launcher"
$sc.Save()
`.trim();

            const tmpScript = path.join(os.tmpdir(), 'versepc_shortcut.ps1');
            fs.writeFileSync(tmpScript, psScript, 'utf8');
            exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpScript}"`, { timeout: 10000 }, (err) => {
                try { fs.unlinkSync(tmpScript); } catch(e) {}
                if (err) { sendError(res, err.message); return; }
                sendJSON(res, { success: true, path: shortcutPath });
            });
        });

        // ====================================================================
        // /api/screenshots
        // ====================================================================
        registerRoute('GET', '/api/screenshots', async (req, res, parsedUrl) => {
            const ssVersionId = parsedUrl.query.versionId || '';
            const ssDir = mods.resolveSavesDir(ssVersionId).replace('saves', 'screenshots');
            const globalSsDir = path.join(DATA_DIR, 'screenshots');
            const screenshots = [];

            for (const dir of [ssDir, globalSsDir]) {
                if (!fs.existsSync(dir)) continue;
                try {
                    fs.readdirSync(dir).forEach(f => {
                        if (/\.(png|jpg|jpeg|bmp)$/i.test(f)) {
                            const filePath = path.join(dir, f);
                            const stat = fs.statSync(filePath);
                            screenshots.push({
                                name: f,
                                path: filePath,
                                size: stat.size,
                                time: stat.mtimeMs,
                                url: `/api/screenshot?path=${encodeURIComponent(filePath)}`
                            });
                        }
                    });
                } catch(e) {}
            }

            screenshots.sort((a, b) => b.time - a.time);
            sendJSON(res, { screenshots });
        });

        // ====================================================================
        // /api/screenshot (GET 返回图片, DELETE 删除)
        // ====================================================================
        registerRoute('*', '/api/screenshot', async (req, res, parsedUrl) => {
            const SCREENSHOT_ALLOWED_BASES = [DATA_DIR, ...Object.values(VERSIONS_DIR)].map(d => path.resolve(d));
            function isScreenshotPathAllowed(p) {
                const resolved = path.resolve(p);
                return SCREENSHOT_ALLOWED_BASES.some(base => resolved.toLowerCase().startsWith(base.toLowerCase()));
            }
            if (req.method === 'DELETE') {
                const delPath = decodeURIComponent(parsedUrl.query.path || '');
                if (!delPath) { sendError(res, 'Missing path', 400); return; }
                if (!isScreenshotPathAllowed(delPath)) { sendError(res, 'Forbidden', 403); return; }
                try {
                    fs.unlinkSync(delPath);
                    sendJSON(res, { success: true });
                } catch(e) {
                    sendError(res, e.message);
                }
                return;
            }

            const ssPath = decodeURIComponent(parsedUrl.query.path || '');
            if (!ssPath || !fs.existsSync(ssPath)) {
                sendError(res, 'Not found', 404);
                return;
            }
            if (!isScreenshotPathAllowed(ssPath)) { sendError(res, 'Forbidden', 403); return; }
            const ssExt = path.extname(ssPath).toLowerCase();
            const ssMime = ssExt === '.png' ? 'image/png' : ssExt === '.jpg' || ssExt === '.jpeg' ? 'image/jpeg' : 'image/bmp';
            const ssData = fs.readFileSync(ssPath);
            res.writeHead(200, { 'Content-Type': ssMime, 'Cache-Control': 'max-age=3600' });
            res.end(ssData);
        });

        // ====================================================================
        // /api/server/ping
        // ====================================================================
        registerRoute('GET', '/api/server/ping', async (req, res, parsedUrl) => {
            const pingHost = parsedUrl.query.host;
            const pingPort = parseInt(parsedUrl.query.port) || 25565;
            if (!pingHost) { sendJSON(res, { error: 'host required' }, 400); return; }
            const pingResult = await network.mcPing(pingHost, pingPort);
            sendJSON(res, pingResult);
        });

        // ====================================================================
        // /api/save-background
        // ====================================================================
        registerRoute('POST', '/api/save-background', async (req, res, parsedUrl) => {
            const bgBody = await readBody(req);
            const bgData = bgBody.dataUrl;
            if (!bgData) { sendJSON(res, { error: 'dataUrl required' }, 400); return; }
            const bgMatch = bgData.match(/^data:image\/(\w+);base64,(.+)$/);
            if (!bgMatch) { sendJSON(res, { error: 'invalid dataUrl' }, 400); return; }
            const bgFile = path.join(DATA_DIR, `background.${bgMatch[1] === 'jpeg' ? 'jpg' : bgMatch[1]}`);
            fs.writeFileSync(bgFile, Buffer.from(bgMatch[2], 'base64'));
            sendJSON(res, { success: true, path: bgFile });
        });

        // ====================================================================
        // /api/clear-background
        // ====================================================================
        registerRoute('GET', '/api/clear-background', async (req, res, parsedUrl) => {
            const bgFiles = ['background.png', 'background.jpg', 'background.jpeg'].map(f => path.join(DATA_DIR, f));
            for (const f of bgFiles) { if (fs.existsSync(f)) fs.unlinkSync(f); }
            sendJSON(res, { success: true });
        });
    }
};
