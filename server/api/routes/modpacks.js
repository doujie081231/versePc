/**
 * server/api/routes/modpacks.js - 整合包路由
 * ============================================================================
 * 从 server.js handleAPI switch 语句抽取的整合包相关端点。
 */

const fs = require('fs');
const path = require('path');
const utils = require('../../utils');

module.exports = {
    register(registerRoute, deps) {
        const { ctx, sendJSON, sendError, readBody } = deps;
        const { modpack, http, versions } = deps;

        const MODRINTH_API = ctx.urls.MODRINTH_API;
        const CURSEFORGE_API = ctx.urls.CURSEFORGE_API;
        const DATA_DIR = ctx.dirs.DATA_DIR;

        // ====================================================================
        // /api/modpack/import
        // ====================================================================
        registerRoute('POST', '/api/modpack/import', async (req, res, parsedUrl) => {
            const importData = await readBody(req);
            const importFilePath = importData.filePath;
            const targetVersion = importData.targetVersion || '';
            const targetFolder = importData.targetFolder || '';
            if (!importFilePath) { sendError(res, 'Missing filePath', 400); return; }
            try {
                const result = await modpack.importModpackFromPath(importFilePath, null, targetVersion, null, targetFolder);
                sendJSON(res, result);
            } catch (e) {
                sendJSON(res, { success: false, error: e.message });
            }
        });

        // ====================================================================
        // /api/modpacks/search - Modrinth + CurseForge 双源聚合
        // ====================================================================
        registerRoute('GET', '/api/modpacks/search', async (req, res, parsedUrl) => {
            let mpQuery = parsedUrl.query.query || '';
            const mpLoader = parsedUrl.query.loader || '';
            const mpVersion = parsedUrl.query.version || '';
            const mpSource = parsedUrl.query.source || 'any';
            const mpLimit = parseInt(parsedUrl.query.limit || '10', 10);
            const mpOffset = parseInt(parsedUrl.query.offset || '0', 10);

            if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(mpQuery)) {
                try {
                    const cnMod = require('../../data/mod-chinese-names.js');
                    const translated = cnMod.translateChineseSearch(mpQuery, 'modpack');
                    if (translated) mpQuery = translated;
                } catch (e) {
                    try {
                        const cnKeys = Object.entries(require('../../data/mod-chinese-names.js').CHINESE_SEARCH_KEYWORDS_MODPACK || {});
                        for (const [cn, enList] of cnKeys) {
                            if (mpQuery.includes(cn) || cn.includes(mpQuery)) { mpQuery = enList.join(' '); break; }
                        }
                    } catch (_) {}
                }
            }

            try {
                let allHits = [];

                // --- Modrinth ---
                if (mpSource === 'any' || mpSource === 'modrinth') {
                    const facets = [['project_type:modpack']];
                    if (mpLoader) facets.push([`categories:${mpLoader}`]);
                    if (mpVersion) facets.push([`versions:${mpVersion}`]);
                    let mrUrl = `${MODRINTH_API}/search?query=${encodeURIComponent(mpQuery)}&index=relevance&limit=${mpLimit}&offset=${mpOffset}`;
                    mrUrl += `&facets=${encodeURIComponent(JSON.stringify(facets))}`;
                    const mrResult = await http.cachedFetchJSON(mrUrl, 60000);
                    const mrHits = (mrResult.hits || []).map(hit => ({
                        id: hit.project_id, slug: hit.slug, title: hit.title,
                        description: hit.description || '', author: (hit.author || '').replace(/_/g, ''),
                        icon: utils.applyImageMirror(hit.icon_url) || '', downloads: hit.downloads || 0,
                        categories: hit.categories || [], versions: hit.versions || [],
                        source: 'modrinth'
                    }));
                    allHits = allHits.concat(mrHits);
                }

                // --- CurseForge ---
                if (mpSource === 'any' || mpSource === 'curseforge') {
                    const settings = versions.loadSettingsCached();
                    const cfApiKey = settings.curseforgeApiKey || '$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm';
                    const cfHeaders = { 'x-api-key': cfApiKey };
                    // classId 4471 = 整合包（classId 6 = mod）
                    let cfUrl = `${CURSEFORGE_API}/mods/search?gameId=432&searchFilter=${encodeURIComponent(mpQuery)}&sortOrder=Desc&classId=4471&pageSize=${mpLimit}&index=${mpOffset}`;
                    if (mpLoader) {
                        const loaderMap = { forge: 1, fabric: 4, quilt: 5, neoforge: 5 };
                        const loaderId = loaderMap[mpLoader.toLowerCase()];
                        if (loaderId) cfUrl += `&modLoaderType=${loaderId}`;
                    }
                    if (mpVersion) {
                        // CurseForge 用 gameVersion 过滤（前缀匹配，如 1.20.1 匹配 1.20）
                        cfUrl += `&gameVersion=${encodeURIComponent(mpVersion)}`;
                    }
                    cfUrl += '&sortField=2';
                    const cfResult = await http.fetchJSON(cfUrl, cfHeaders);
                    const cfHits = (cfResult.data || []).map(mod => ({
                        id: String(mod.id), slug: mod.slug || '', title: mod.name || 'Unknown',
                        description: mod.summary || '', author: (mod.authors || [])[0] || 'Unknown',
                        icon: utils.applyImageMirror(mod.logo?.url) || '', downloads: mod.downloadCount || 0,
                        categories: (mod.categories || []).map(c => c.name || c.id || ''),
                        versions: [], source: 'curseforge'
                    }));
                    allHits = allHits.concat(cfHits);
                }

                const total = allHits.length;
                // 简单地按下载量排序（双源混合时）
                if (mpSource === 'any') {
                    allHits.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
                }
                sendJSON(res, { hits: allHits.slice(0, mpLimit), total, offset: mpOffset });
            } catch (e) {
                sendJSON(res, { hits: [], total: 0, error: e.message });
            }
        });

        // ====================================================================
        // /api/modpacks/install
        // ====================================================================
        registerRoute('POST', '/api/modpacks/install', async (req, res, parsedUrl) => {
            const mpData = await readBody(req);
            const mpProjectId = mpData.projectId;
            const mpMcVersion = mpData.mcVersion || '';
            if (!mpProjectId) { sendError(res, 'Missing projectId', 400); return; }
            try {
                let versionUrl = `${MODRINTH_API}/project/${mpProjectId}/version`;
                const versionParams = [];
                if (mpMcVersion) versionParams.push(`game_versions=["${mpMcVersion}"]`);
                if (versionParams.length > 0) versionUrl += '?' + versionParams.join('&');
                const versionData = await http.fetchJSON(versionUrl);
                if (!versionData || versionData.length === 0) {
                    sendJSON(res, { success: false, error: '未找到可用版本' });
                    return;
                }
                // 按版本号降序排序后取最新版本（去掉 v/V 前缀后按数字比较，相同版本号按发布日期降序）
                const sortedVersions = [...versionData].sort((a, b) => {
                    const aNum = ((a.version_number || a.name || '').replace(/^v/i, '')).split(/[.\-_]/).map(p => parseInt(p, 10) || 0);
                    const bNum = ((b.version_number || b.name || '').replace(/^v/i, '')).split(/[.\-_]/).map(p => parseInt(p, 10) || 0);
                    for (let i = 0; i < Math.max(aNum.length, bNum.length); i++) {
                        const aVal = aNum[i] || 0;
                        const bVal = bNum[i] || 0;
                        if (aVal !== bVal) return bVal - aVal;
                    }
                    const aDate = new Date(a.date_published || 0).getTime();
                    const bDate = new Date(b.date_published || 0).getTime();
                    return bDate - aDate;
                });
                const targetVersion = sortedVersions[0];
                const primaryFile = targetVersion.files?.find(f => f.primary) || targetVersion.files?.[0];
                if (!primaryFile || !primaryFile.url) {
                    sendJSON(res, { success: false, error: '未找到下载链接' });
                    return;
                }
                const fileName = primaryFile.filename || `${mpProjectId}.mrpack`;
                const _mpSettings = versions.loadSettingsCached();
                const downloadDir = versions.getVersionSubDir(_mpSettings.selectedVersion, 'modpacks') || path.join(_mpSettings.gameDir || DATA_DIR, 'modpacks');
                if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });
                const destPath = path.join(downloadDir, fileName);
                const downloadUrl = primaryFile.url;
                const modpackName = targetVersion.name || mpProjectId;

                sendJSON(res, {
                    success: true,
                    name: modpackName,
                    versionId: targetVersion.id,
                    fileName,
                    downloadUrl,
                    destPath,
                    size: primaryFile.size || 0,
                    mcVersion: targetVersion.game_versions?.[0] || mpMcVersion,
                    loaders: targetVersion.loaders || [],
                    message: '整合包下载链接已获取，请使用 modpack/import 接口导入'
                });
            } catch (e) {
                sendJSON(res, { success: false, error: e.message });
            }
        });
    }
};
