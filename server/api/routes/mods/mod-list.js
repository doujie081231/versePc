/**
 * @file server/api/routes/mods/mod-list.js
 * @description 模组列表、图标、已安装列表、分类、推荐、打开目录相关路由
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { extractDeps } = require('./shared');

module.exports = {
  /**
   * 注册模组列表相关路由
   * @param {Function} registerRoute - 路由注册函数
   * @param {Object} deps - 依赖对象
   * @returns {void}
   */
  register(registerRoute, deps) {
    const {
      sendJSON, sendError, mods, http, versions, utils,
      MODRINTH_API, ICON_CACHE_DIR, DATA_DIR
    } = extractDeps(deps);

    /* /api/mods - 获取已安装模组列表 */
    registerRoute('GET', '/api/mods', async (req, res, parsedUrl) => {
      const modResult = mods.getInstalledMods();
      sendJSON(res, modResult);
    });

    /* /api/mod-icon - 获取模组图标（按 hash 从缓存目录读取） */
    registerRoute('GET', '/api/mod-icon', async (req, res, parsedUrl) => {
      const hash = (parsedUrl.query.hash || '').replace(/[^a-f0-9]/gi, '');
      const iconPath = hash ? path.join(ICON_CACHE_DIR, hash + '.png') : '';
      try {
        if (iconPath && fs.existsSync(iconPath)) {
          const data = fs.readFileSync(iconPath);
          res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800' });
          res.end(data);
        } else {
          res.writeHead(404);
          res.end('');
        }
      } catch (e) {
        res.writeHead(404);
        res.end('');
      }
    });

    /* /api/mods/open-save-folder - 在资源管理器中打开模组目录 */
    registerRoute('GET', '/api/mods/open-save-folder', async (req, res, parsedUrl) => {
      try {
        const settings = versions.loadSettingsCached();
        let modsDir = versions.getVersionModsDir(settings.selectedVersion);

        if (!modsDir) {
          const installedVersions = versions.getInstalledVersions();
          if (installedVersions.length > 0) {
            modsDir = versions.getVersionModsDir(installedVersions[0].id);
          }
          if (!modsDir) {
            sendError(res, '请先安装一个游戏版本');
            return;
          }
        }
        if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });
        require('child_process').exec(`explorer "${modsDir}"`);
        sendJSON(res, { success: true, path: modsDir });
      } catch (e) { sendJSON(res, { success: false, error: e.message }); }
    });

    /* /api/mods/installed - 获取指定版本已安装的模组列表（含 JAR 解析） */
    registerRoute('GET', '/api/mods/installed', async (req, res, parsedUrl) => {
      await new Promise((r) => setImmediate(r));
      const imVersionId = parsedUrl.query.versionId;
      if (!imVersionId) { sendError(res, 'Missing versionId', 400); return; }
      try {
        const MAX_MODS = 200;
        const modList = [];
        const seenFiles = new Set();
        const imSettings = versions.loadSettingsCached();

        // 扫描指定目录下的 JAR/ZIP 模组文件
        async function scanInstalledDir(dir, src) {
          if (!dir || !fs.existsSync(dir)) return;
          const allFiles = await fs.promises.readdir(dir);
          const jarFiles = allFiles.filter((f) => (f.endsWith('.jar') || f.endsWith('.zip') || f.endsWith('.jar.disabled') || f.endsWith('.zip.disabled')));
          for (const f of jarFiles) {
            if (modList.length >= MAX_MODS) break;
            const isDisabled = f.endsWith('.disabled');
            const realName = isDisabled ? f.replace('.disabled', '') : f;
            if (seenFiles.has(realName)) continue;
            seenFiles.add(realName);
            const name = realName.replace(/\.(jar|zip)$/, '');
            let stat;
            try { stat = await fs.promises.stat(path.join(dir, f)); } catch (e) { stat = { size: 0 }; }
            const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
            let icon = '', author = '', description = '', version = '', projectId = '';
            const jarPath = path.join(dir, f);
            // 解析 JAR 文件获取模组元数据
            if (realName.endsWith('.jar') && fs.existsSync(jarPath)) {
              try {
                const parsed = mods.parseModJar(jarPath);
                if (parsed.icon) icon = `/api/mod-icon?hash=${parsed.icon}`;
                if (parsed.author) author = parsed.author;
                if (parsed.description) description = parsed.description.substring(0, 200);
                if (parsed.version) version = parsed.version;
                if (parsed.id) projectId = parsed.id;
              } catch (e) { console.error('[mod-list] parseModJar error for', jarPath, ':', e.message); }
            }
            modList.push({ id, name, fileName: f, jarPath, disabled: isDisabled, description: description || (isDisabled ? '已禁用' : '已安装的模组'), version: version || '1.0', size: stat.size || 0, source: src, icon, author, projectId });
          }
        }

        // 扫描顺序：版本隔离目录 → 共享目录 → .minecraft/mods
        const imModsDir = versions.getVersionModsDir(imVersionId);
        await scanInstalledDir(imModsDir, '本地');
        if (!versions.resolveVersionIsolation(imVersionId)) {
          const imSharedGameDir = imSettings.gameDir || DATA_DIR;
          const imSharedModsDir = path.join(imSharedGameDir, 'mods');
          if (imSharedModsDir !== imModsDir) await scanInstalledDir(imSharedModsDir, '共享');
          const imHomeMods = path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft', 'mods');
          if (imHomeMods !== imModsDir && imHomeMods !== imSharedModsDir) await scanInstalledDir(imHomeMods, '.minecraft');
        }
        sendJSON(res, modList);
      } catch (e) { sendJSON(res, []); }
    });

    /* /api/mods/categories - 获取模组分类标签（Modrinth） */
    registerRoute('GET', '/api/mods/categories', async (req, res, parsedUrl) => {
      const catSource = parsedUrl.query.source || 'modrinth';
      try {
        if (catSource === 'modrinth') {
          const tags = await http.fetchJSON(`${MODRINTH_API}/tag/category`);
          const categories = tags.filter((t) => t.project_type === 'mod').map((t) => ({
            name: t.name,
            icon: t.icon || ''
          }));
          sendJSON(res, { categories });
        } else {
          sendJSON(res, { categories: [] });
        }
      } catch (e) {
        sendJSON(res, { categories: [] });
      }
    });

    /* /api/mods/featured - 获取热门推荐模组（按下载量排序） */
    registerRoute('GET', '/api/mods/featured', async (req, res, parsedUrl) => {
      const ftLoader = parsedUrl.query.loader || '';
      const ftVersion = parsedUrl.query.gameVersion || '';
      try {
        const facets = [['project_type:mod']];
        if (ftLoader) facets.push([`categories:${ftLoader}`]);
        if (ftVersion) facets.push([`versions:${ftVersion}`]);
        let featUrl = `${MODRINTH_API}/search?query=&index=downloads&limit=10&offset=0`;
        featUrl += `&facets=${encodeURIComponent(JSON.stringify(facets))}`;
        const result = await http.fetchJSON(featUrl);
        const hits = (result.hits || []).map((hit) => ({
          id: hit.project_id, slug: hit.slug, title: hit.title,
          description: hit.description || '', icon: utils.applyImageMirror(hit.icon_url) || '',
          downloads: hit.downloads || 0, author: (hit.author || '').replace(/_/g, ''),
          categories: hit.categories || [], source: 'modrinth'
        }));
        sendJSON(res, { hits });
      } catch (e) {
        sendJSON(res, { hits: [] });
      }
    });
  }
};
