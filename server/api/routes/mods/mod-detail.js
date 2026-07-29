/**
 * @file server/api/routes/mods/mod-detail.js
 * @description 模组详情与版本列表查询相关路由
 */

const { extractDeps } = require('./shared');

module.exports = {
  /**
   * 注册模组详情相关路由
   * @param {Function} registerRoute - 路由注册函数
   * @param {Object} deps - 依赖对象
   * @returns {void}
   */
  register(registerRoute, deps) {
    const {
      sendJSON, sendError, readBody, http, versions, utils,
      MODRINTH_API, CURSEFORGE_API
    } = extractDeps(deps);

    /* /api/mods/project-versions - 获取模组的版本列表（支持 GET / POST） */
    registerRoute('*', '/api/mods/project-versions', async (req, res, parsedUrl) => {
      let pvProjectId, pvSource, pvGameVersion, pvLoader;
      if (req.method === 'GET') {
        const q = parsedUrl.query || {};
        pvProjectId = q.projectId;
        pvSource = q.source || 'modrinth';
        pvGameVersion = q.gameVersion || '';
        pvLoader = q.loader || '';
      } else {
        const pvBody = await readBody(req);
        pvProjectId = pvBody.projectId;
        pvSource = pvBody.source || 'modrinth';
        pvGameVersion = pvBody.gameVersion || '';
        pvLoader = pvBody.loader || '';
      }
      try {
        if (pvSource !== 'modrinth' || !pvProjectId) {
          sendJSON(res, { versions: [] });
          return;
        }
        let verUrl = `${MODRINTH_API}/project/${pvProjectId}/version`;
        const verParams = [];
        if (pvGameVersion) verParams.push(`game_versions=["${pvGameVersion}"]`);
        if (pvLoader) verParams.push(`loaders=["${pvLoader}"]`);
        if (verParams.length) verUrl += '?' + verParams.join('&');
        const rawVersions = await http.cachedFetchJSON(verUrl, 600000);
        let versions = (rawVersions || []).map((v) => ({
          versionId: v.id,
          versionNumber: v.version_number,
          gameVersions: v.game_versions || [],
          loaders: v.loaders || [],
          files: (v.files || []).map((f) => ({
            filename: f.filename,
            url: f.url,
            size: f.size || 0,
            primary: !!f.primary
          })),
          datePublished: v.date_published,
          changelog: v.changelog || ''
        }));
        // 三级回退：精确查询 → 仅 MC 版本 → 全量
        if (versions.length === 0 && (pvGameVersion || pvLoader)) {
          try {
            let fallbackUrl = `${MODRINTH_API}/project/${pvProjectId}/version`;
            const fallbackParams = [];
            if (pvGameVersion) fallbackParams.push(`game_versions=["${pvGameVersion}"]`);
            if (fallbackParams.length) fallbackUrl += '?' + fallbackParams.join('&');
            const fb1 = await http.cachedFetchJSON(fallbackUrl, 600000);
            versions = (fb1 || []).map((v) => ({
              versionId: v.id,
              versionNumber: v.version_number,
              gameVersions: v.game_versions || [],
              loaders: v.loaders || [],
              files: (v.files || []).map((f) => ({
                filename: f.filename,
                url: f.url,
                size: f.size || 0,
                primary: !!f.primary
              })),
              datePublished: v.date_published,
              changelog: v.changelog || ''
            }));
          } catch (e) {}
        }
        if (versions.length === 0 && (pvGameVersion || pvLoader)) {
          try {
            const fb2 = await http.cachedFetchJSON(`${MODRINTH_API}/project/${pvProjectId}/version?limit=10`, 600000);
            versions = (fb2 || []).map((v) => ({
              versionId: v.id,
              versionNumber: v.version_number,
              gameVersions: v.game_versions || [],
              loaders: v.loaders || [],
              files: (v.files || []).map((f) => ({
                filename: f.filename,
                url: f.url,
                size: f.size || 0,
                primary: !!f.primary
              })),
              datePublished: v.date_published,
              changelog: v.changelog || ''
            }));
          } catch (e) {}
        }
        sendJSON(res, { versions });
      } catch (e) {
        sendJSON(res, { versions: [] });
      }
    });

    /* /api/mods/detail - 获取模组详情（Modrinth / CurseForge） */
    registerRoute('GET', '/api/mods/detail', async (req, res, parsedUrl) => {
      const modProjectId = parsedUrl.query.projectId;
      const modSource = parsedUrl.query.source || 'modrinth';
      if (!modProjectId) { sendError(res, 'Missing projectId', 400); return; }

      try {
        if (modSource === 'modrinth') {
          const project = await http.cachedFetchJSON(`${MODRINTH_API}/project/${modProjectId}`, 300000);
          const detail = {
            id: project.id,
            slug: project.slug,
            title: project.title,
            description: project.description || '',
            body: project.body || '',
            icon: utils.applyImageMirror(project.icon_url) || '',
            downloads: project.downloads || 0,
            followers: project.followers || 0,
            categories: project.categories || [],
            loaders: project.loaders || [],
            gameVersions: project.game_versions || [],
            clientSide: project.client_side || 'unknown',
            serverSide: project.server_side || 'unknown',
            license: project.license?.name || '',
            sourceUrl: project.source_url || '',
            issuesUrl: project.issues_url || '',
            wikiUrl: project.wiki_url || '',
            discordUrl: project.discord_url || '',
            dateCreated: project.published || '',
            dateModified: project.updated || '',
            gallery: (project.gallery || []).map((g) => typeof g === 'string' ? g : g.url || ''),
            source: 'modrinth'
          };
          sendJSON(res, detail);
        } else if (modSource === 'curseforge') {
          const settings = versions.loadSettingsCached();
          const cfApiKey = settings.curseforgeApiKey || '$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm';
          const cfHeaders = { 'x-api-key': cfApiKey };
          const cfProject = await http.fetchJSON(`${CURSEFORGE_API}/mods/${modProjectId}`, cfHeaders);
          const mod = cfProject.data || cfProject;
          const detail = {
            id: String(mod.id),
            slug: mod.slug || '',
            title: mod.name || 'Unknown',
            description: mod.summary || '',
            body: mod.description || mod.summary || '',
            icon: utils.applyImageMirror(mod.logo?.url) || '',
            downloads: mod.downloadCount || 0,
            followers: mod.followers || mod.thumbsUpCount || 0,
            categories: (mod.categories || []).map((c) => typeof c === 'string' ? c : c.name || ''),
            loaders: (mod.latestFilesIndexes || []).map((f) => {
              if (f.modLoader === 1) return 'forge';
              if (f.modLoader === 4) return 'fabric';
              if (f.modLoader === 5) return 'neoforge';
              return '';
            }).filter(Boolean),
            gameVersions: [...new Set((mod.latestFilesIndexes || []).map((f) => f.gameVersion))],
            clientSide: 'unknown',
            serverSide: 'unknown',
            license: '',
            sourceUrl: mod.links?.sourceUrl || '',
            issuesUrl: mod.links?.issuesUrl || '',
            wikiUrl: mod.links?.wikiUrl || '',
            discordUrl: '',
            dateCreated: mod.dateCreated || '',
            dateModified: mod.dateModified || '',
            gallery: (mod.screenshots || []).map((s) => typeof s === 'string' ? s : s.url || ''),
            source: 'curseforge'
          };
          sendJSON(res, detail);
        } else {
          sendError(res, 'Unsupported source', 400);
        }
      } catch (e) {
        sendError(res, '获取模组详情失败: ' + e.message);
      }
    });

    /* /api/mods/versions - 获取模组版本列表（含分页与加载器映射） */
    registerRoute('GET', '/api/mods/versions', async (req, res, parsedUrl) => {
      const mvProjectId = parsedUrl.query.projectId;
      const mvSource = parsedUrl.query.source || 'modrinth';
      const mvLoader = parsedUrl.query.loader || '';
      const mvGameVer = parsedUrl.query.gameVersion || '';
      if (!mvProjectId) { sendError(res, 'Missing projectId', 400); return; }

      try {
        if (mvSource === 'modrinth') {
          const encodedId = encodeURIComponent(mvProjectId);
          let versionUrl = `${MODRINTH_API}/project/${encodedId}/version`;
          const params = [];
          if (mvLoader) params.push(`loaders=["${encodeURIComponent(mvLoader)}"]`);
          if (mvGameVer) params.push(`game_versions=["${encodeURIComponent(mvGameVer)}"]`);
          if (params.length > 0) versionUrl += '?' + params.join('&');

          let versions;
          try {
            versions = await http.cachedFetchJSON(versionUrl, 600000, 3, 25000);
          } catch (mirrorErr) {
            // 缓存请求失败（镜像 404 或超时），回退到官方 API
            console.warn(`[Modrinth] 镜像请求失败，尝试官方API: ${mirrorErr.message}`);
            try {
              const officialUrl = `${MODRINTH_API}/project/${encodedId}/version${params.length > 0 ? '?' + params.join('&') : ''}`;
              versions = await http.fetchJSON(officialUrl, 2, 30000);
            } catch (officialErr) {
              // 官方 API 也失败，返回空版本列表（避免 500 错误）
              console.warn(`[Modrinth] 官方API也失败: ${officialErr.message}`);
            }
          }
          const result = (versions || []).map((v) => ({
            id: v.id,
            versionNumber: v.version_number || '',
            versionName: v.name || v.version_number || '',
            gameVersions: v.game_versions || [],
            loaders: v.loaders || [],
            releaseType: v.version_type || 'release',
            datePublished: v.date_published || '',
            downloads: v.downloads || 0,
            changelog: v.changelog || '',
            files: (v.files || []).map((f) => ({
              id: f.id || f.hashes?.sha1 || '',
              url: f.url,
              filename: f.filename,
              size: f.size || 0,
              primary: f.primary || false,
              sha1: f.hashes?.sha1 || ''
            })),
            dependencies: (v.dependencies || []).map((d) => ({
              projectId: d.project_id,
              versionId: d.version_id,
              dependencyType: d.dependency_type,
              modName: d.project_id || ''
            }))
          }));
          // 按版本号降序排序（去掉 v/V 前缀后按数字比较，相同版本号按发布日期降序）
          result.sort((a, b) => {
            const aNum = ((a.versionNumber || a.versionName || '').replace(/^v/i, '')).split(/[.\-_]/).map(p => parseInt(p, 10) || 0);
            const bNum = ((b.versionNumber || b.versionName || '').replace(/^v/i, '')).split(/[.\-_]/).map(p => parseInt(p, 10) || 0);
            for (let i = 0; i < Math.max(aNum.length, bNum.length); i++) {
              const aVal = aNum[i] || 0;
              const bVal = bNum[i] || 0;
              if (aVal !== bVal) return bVal - aVal;
            }
            const aDate = new Date(a.datePublished || 0).getTime();
            const bDate = new Date(b.datePublished || 0).getTime();
            return bDate - aDate;
          });
          sendJSON(res, { versions: result });
        } else if (mvSource === 'curseforge') {
          const settings = versions.loadSettingsCached();
          const cfApiKey = settings.curseforgeApiKey || '$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm';
          const cfHeaders = { 'x-api-key': cfApiKey };

          let cfVersions = [];
          try {
            // CurseForge 分页拉取所有文件
            let allCfFiles = [];
            let cfPageIndex = 0;
            const cfPageSize = 1000;
            let cfHasMore = true;

            while (cfHasMore) {
              let cfUrl = `${CURSEFORGE_API}/mods/${mvProjectId}/files?pageSize=${cfPageSize}&index=${cfPageIndex}`;
              const cfParams = [];
              if (mvGameVer) cfParams.push(`gameVersion=${mvGameVer}`);
              if (mvLoader) {
                const loaderMap = { fabric: 4, forge: 1, neoforge: 6, quilt: 5 };
                const loaderType = loaderMap[mvLoader.toLowerCase()];
                if (loaderType) cfParams.push(`modLoaderType=${loaderType}`);
              }
              if (cfParams.length > 0) cfUrl += '&' + cfParams.join('&');

              const cfRes = await http.fetchJSON(cfUrl, cfHeaders, 25000);
              const cfBatch = cfRes.data || [];
              allCfFiles = allCfFiles.concat(cfBatch);

              const pagination = cfRes.pagination;
              if (pagination && pagination.totalCount > cfPageIndex + cfPageSize) {
                cfPageIndex += cfPageSize;
              } else {
                cfHasMore = false;
              }
              if (cfBatch.length < cfPageSize) cfHasMore = false;
            }

            // 按游戏版本分组文件
            const byVersion = new Map();
            for (const f of allCfFiles) {
              const gv = (f.gameVersions || []).find((v) => /^\d+\.\d+/.test(v)) || (f.gameVersions || [])[0] || '';
              const key = gv || f.id;
              if (!byVersion.has(key)) {
                byVersion.set(key, {
                  id: String(f.id),
                  versionNumber: f.displayName || f.fileName || '',
                  versionName: f.displayName || f.fileName || '',
                  gameVersions: f.gameVersions || [],
                  loaders: (f.gameVersions || []).filter((v) => ['fabric','forge','neoforge','quilt','fabric-loader','forge-loader'].includes(v.toLowerCase())).map((v) => v.toLowerCase().replace('-loader','')),
                  releaseType: f.releaseType === 1 ? 'release' : f.releaseType === 2 ? 'beta' : 'alpha',
                  datePublished: f.fileDate || '',
                  downloads: 0,
                  changelog: '',
                  files: [],
                  dependencies: (f.dependencies || []).map((d) => ({
                    projectId: String(d.modId || ''),
                    versionId: String(d.fileId || ''),
                    dependencyType: d.relationType === 3 ? 'required' : d.relationType === 5 ? 'required' : d.relationType === 2 ? 'optional' : d.relationType === 1 ? 'optional' : 'incompatible',
                    modName: ''
                  }))
                });
              }
              byVersion.get(key).files.push({
                id: String(f.id),
                url: f.downloadUrl || '',
                filename: f.fileName || '',
                size: f.fileLength || 0,
                primary: byVersion.get(key).files.length === 0,
                sha1: ''
              });
            }
            cfVersions = Array.from(byVersion.values());
          } catch (e) {
            console.warn(`[CurseForge] 获取版本列表失败: ${e.message}`);
          }
          // 按版本号降序排序（去掉 v/V 前缀后按数字比较，相同版本号按发布日期降序）
          cfVersions.sort((a, b) => {
            const aNum = ((a.versionNumber || a.versionName || '').replace(/^v/i, '')).split(/[.\-_]/).map(p => parseInt(p, 10) || 0);
            const bNum = ((b.versionNumber || b.versionName || '').replace(/^v/i, '')).split(/[.\-_]/).map(p => parseInt(p, 10) || 0);
            for (let i = 0; i < Math.max(aNum.length, bNum.length); i++) {
              const aVal = aNum[i] || 0;
              const bVal = bNum[i] || 0;
              if (aVal !== bVal) return bVal - aVal;
            }
            const aDate = new Date(a.datePublished || 0).getTime();
            const bDate = new Date(b.datePublished || 0).getTime();
            return bDate - aDate;
          });
          sendJSON(res, { versions: cfVersions });
        } else {
          sendError(res, 'Unsupported source', 400);
        }
      } catch (e) {
        sendError(res, '获取模组版本列表失败: ' + e.message);
      }
    });
  }
};
