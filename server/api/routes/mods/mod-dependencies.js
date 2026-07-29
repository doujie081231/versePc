/**
 * @file server/api/routes/mods/mod-dependencies.js
 * @description 模组依赖查询与批量解析相关路由
 */

const { extractDeps } = require('./shared');

module.exports = {
  /**
   * 注册模组依赖相关路由
   * @param {Function} registerRoute - 路由注册函数
   * @param {Object} deps - 依赖对象
   * @returns {void}
   */
  register(registerRoute, deps) {
    const {
      sendJSON, sendError, readBody, http, versions, utils,
      MODRINTH_API, CURSEFORGE_API
    } = extractDeps(deps);

    /* /api/mods/get-dependencies - 获取模组的直接前置依赖（Modrinth/CurseForge） */
    registerRoute('POST', '/api/mods/get-dependencies', async (req, res, parsedUrl) => {
      const gdData = await readBody(req);
      const gdVersionId = gdData.versionId;
      const gdSource = gdData.source || 'modrinth';
      const gdGameVersion = gdData.gameVersion || '';
      const gdLoader = gdData.loader || '';
      const gdProjectId = gdData.projectId || '';
      try {
        let deps = [];
        if (gdSource === 'modrinth') {
          if (gdVersionId) {
            const versionData = await http.cachedFetchJSON(`${MODRINTH_API}/version/${gdVersionId}`, 300000);
            if (versionData && versionData.dependencies) {
              // 过滤必要依赖，排除 Fabric API / QSL 等基础库
              const requiredDeps = versionData.dependencies.filter((d) =>
                d.dependency_type === 'required' && d.project_id &&
                d.project_id !== 'P7dR8mSH' && d.project_id !== 'qvIfYCYJ'
              );
              if (requiredDeps.length > 0) {
                // 批量查询依赖项目信息
                const depIds = requiredDeps.map((d) => `"${d.project_id}"`).join(',');
                let depProjects = [];
                try { depProjects = await http.cachedFetchJSON(`${MODRINTH_API}/projects?ids=[${depIds}]`, 300000) || []; } catch (e) {}
                const depProjMap = {};
                for (const p of depProjects) { depProjMap[p.id] = p; }
                // 批量查询缺失的项目，逐个补查
                const missingDepIds = requiredDeps.filter((d) => !depProjMap[d.project_id]);
                if (missingDepIds.length > 0) {
                  const retries = await Promise.allSettled(missingDepIds.map((d) => http.cachedFetchJSON(`${MODRINTH_API}/project/${d.project_id}`, 120000)));
                  for (let i = 0; i < missingDepIds.length; i++) {
                    if (retries[i].status === 'fulfilled' && retries[i].value) {
                      depProjMap[missingDepIds[i].project_id] = retries[i].value;
                    }
                  }
                }
                // 为每个依赖查找兼容版本
                const depVersionPromises = requiredDeps.map(async (dep) => {
                  const proj = depProjMap[dep.project_id];
                  let compatibleVersion = null;
                  if (proj) {
                    try {
                      let depVerUrl = `${MODRINTH_API}/project/${dep.project_id}/version`;
                      let depParams = [];
                      if (gdGameVersion) depParams.push(`game_versions=["${gdGameVersion}"]`);
                      if (gdLoader) depParams.push(`loaders=["${gdLoader}"]`);
                      depParams.push('limit=1');
                      let depVersions = await http.cachedFetchJSON(depVerUrl + '?' + depParams.join('&'), 120000);
                      // 查询失败时逐步放宽条件
                      if (!depVersions?.length && gdGameVersion && gdLoader) {
                        depParams = [`game_versions=["${gdGameVersion}"]`, 'limit=1'];
                        depVersions = await http.cachedFetchJSON(depVerUrl + '?' + depParams.join('&'), 120000);
                      }
                      if (!depVersions?.length && (gdGameVersion || gdLoader)) {
                        depParams = ['limit=1'];
                        depVersions = await http.cachedFetchJSON(depVerUrl + '?' + depParams.join('&'), 120000);
                      }
                      if (depVersions?.length) {
                        const depFile = depVersions[0].files?.find((f) => f.primary) || depVersions[0].files?.[0];
                        compatibleVersion = {
                          versionId: depVersions[0].id,
                          versionNumber: depVersions[0].version_number,
                          fileName: depFile?.filename,
                          downloadUrl: depFile?.url,
                          size: depFile?.size || 0
                        };
                      }
                    } catch (e) {}
                  }
                  return {
                    projectId: dep.project_id,
                    title: proj?.title || dep.project_id,
                    icon: utils.applyImageMirror(proj?.icon_url) || '',
                    description: proj?.description || '',
                    compatibleVersion
                  };
                });
                deps = await Promise.all(depVersionPromises);
              }
            }
          }
        } else if (gdSource === 'curseforge') {
          const cfModId = gdProjectId || gdVersionId;
          if (cfModId && gdVersionId) {
            const settings = versions.loadSettingsCached();
            const cfApiKey = settings.curseforgeApiKey || '$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm';
            try {
              const fileInfo = await http.cachedFetchJSON(`${CURSEFORGE_API}/mods/${cfModId}/files/${gdVersionId}`, 120000, { 'x-api-key': cfApiKey });
              const cfDeps = fileInfo?.data?.dependencies || [];
              // relationType 3 = 必要依赖
              const requiredCfDeps = cfDeps.filter((d) => d.relationType === 3 && d.modId);
              if (requiredCfDeps.length > 0) {
                const cfDepPromises = requiredCfDeps.map(async (dep) => {
                  let projInfo = null;
                  let compatibleVersion = null;
                  try {
                    const modInfo = await http.cachedFetchJSON(`${CURSEFORGE_API}/mods/${dep.modId}`, 120000, { 'x-api-key': cfApiKey });
                    projInfo = modInfo?.data;
                    if (projInfo && gdGameVersion) {
                      const filesList = await http.cachedFetchJSON(`${CURSEFORGE_API}/mods/${dep.modId}/files?gameVersion=${encodeURIComponent(gdGameVersion)}&pageSize=1`, 120000, { 'x-api-key': cfApiKey });
                      const cfFile = filesList?.data?.[0];
                      if (cfFile) {
                        compatibleVersion = {
                          versionId: String(cfFile.id),
                          versionNumber: cfFile.displayName || cfFile.fileName,
                          fileName: cfFile.fileName,
                          downloadUrl: cfFile.downloadUrl,
                          size: cfFile.fileLength || 0
                        };
                      }
                    }
                  } catch (e) {}
                  return {
                    projectId: String(dep.modId),
                    title: projInfo?.name || String(dep.modId),
                    icon: utils.applyImageMirror(projInfo?.logo?.thumbnailUrl || projInfo?.logo?.url) || '',
                    description: projInfo?.summary || '',
                    compatibleVersion
                  };
                });
                deps = await Promise.all(cfDepPromises);
              }
            } catch (e) { console.error(`[ModDeps] CurseForge依赖查询失败: ${e.message}`); }
          }
        }
        sendJSON(res, { dependencies: deps });
      } catch (e) {
        sendJSON(res, { dependencies: [] });
      }
    });

    /* /api/mods/get-dependencies-recursive - 递归获取模组所有前置依赖（深度限制 10） */
    registerRoute('POST', '/api/mods/get-dependencies-recursive', async (req, res, parsedUrl) => {
      const gdrData = await readBody(req);
      const gdrVersionId = gdrData.versionId;
      const gdrSource = gdrData.source || 'modrinth';
      const gdrGameVersion = gdrData.gameVersion || '';
      const gdrLoader = gdrData.loader || '';
      const gdrProjectId = gdrData.projectId || '';
      try {
        const allDeps = [];
        const visited = new Set();
        // 跳过 Fabric API / QSL 等基础库
        const SKIP_PROJECTS = new Set(['P7dR8mSH', 'qvIfYCYJ']);
        const settings = versions.loadSettingsCached();
        const cfApiKey = settings.curseforgeApiKey || '$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm';

        // 递归解析依赖：深度超过 10 时停止
        async function resolveDeps(versionId, parentProjectId, depth, source) {
          if (depth > 10) return;
          const curSource = source || gdrSource;
          let depList = [];
          if (curSource === 'modrinth') {
            let versionData = null;
            try { versionData = await http.cachedFetchJSON(`${MODRINTH_API}/version/${versionId}`, 300000); } catch (e) {}
            if (!versionData || !versionData.dependencies) return;
            for (const d of versionData.dependencies) {
              if (d.dependency_type !== 'required' || !d.project_id || SKIP_PROJECTS.has(d.project_id)) continue;
              depList.push({ projectId: d.project_id, modId: d.project_id, source: 'modrinth' });
            }
            if (depList.length === 0) return;
            // 批量查询依赖项目信息
            const depIds = depList.map((d) => `"${d.projectId}"`).join(',');
            let depProjects = [];
            try { depProjects = await http.cachedFetchJSON(`${MODRINTH_API}/projects?ids=[${depIds}]`, 300000) || []; } catch (e) {}
            const projMap = {};
            for (const p of depProjects) { projMap[p.id] = p; }
            const missingProjects = depList.filter((d) => !projMap[d.projectId]);
            if (missingProjects.length > 0) {
              const retries = await Promise.allSettled(missingProjects.map((d) => http.cachedFetchJSON(`${MODRINTH_API}/project/${d.projectId}`, 120000)));
              for (let i = 0; i < missingProjects.length; i++) {
                if (retries[i].status === 'fulfilled' && retries[i].value) {
                  projMap[missingProjects[i].projectId] = retries[i].value;
                }
              }
            }
            for (const dep of depList) {
              if (visited.has(dep.projectId)) continue;
              visited.add(dep.projectId);
              const proj = projMap[dep.projectId];
              let compatibleVersion = null;
              try {
                let depVerUrl = `${MODRINTH_API}/project/${dep.projectId}/version`;
                let depParams = [];
                if (gdrGameVersion) depParams.push(`game_versions=["${gdrGameVersion}"]`);
                if (gdrLoader) depParams.push(`loaders=["${gdrLoader}"]`);
                depParams.push('limit=1');
                let depVersions = await http.cachedFetchJSON(depVerUrl + '?' + depParams.join('&'), 120000);
                if (!depVersions?.length && gdrGameVersion && gdrLoader) {
                  depParams = [`game_versions=["${gdrGameVersion}"]`, 'limit=1'];
                  depVersions = await http.cachedFetchJSON(depVerUrl + '?' + depParams.join('&'), 120000);
                }
                if (!depVersions?.length && (gdrGameVersion || gdrLoader)) {
                  depParams = ['limit=1'];
                  depVersions = await http.cachedFetchJSON(depVerUrl + '?' + depParams.join('&'), 120000);
                }
                if (depVersions?.length) {
                  const depFile = depVersions[0].files?.find((f) => f.primary) || depVersions[0].files?.[0];
                  compatibleVersion = {
                    versionId: depVersions[0].id,
                    versionNumber: depVersions[0].version_number,
                    fileName: depFile?.filename,
                    downloadUrl: depFile?.url,
                    size: depFile?.size || 0
                  };
                  // 递归解析子依赖
                  await resolveDeps(depVersions[0].id, dep.projectId, depth + 1, 'modrinth');
                }
              } catch (e) {}
              allDeps.push({
                projectId: dep.projectId,
                title: proj?.title || dep.projectId,
                icon: utils.applyImageMirror(proj?.icon_url) || '',
                description: proj?.description || '',
                compatibleVersion,
                depth,
                parentProjectId: parentProjectId || null
              });
            }
          } else if (curSource === 'curseforge') {
            const cfModId = parentProjectId || gdrProjectId || versionId;
            let fileInfo = null;
            try { fileInfo = await http.cachedFetchJSON(`${CURSEFORGE_API}/mods/${cfModId}/files/${versionId}`, 120000, { 'x-api-key': cfApiKey }); } catch (e) {}
            const cfDeps = fileInfo?.data?.dependencies || [];
            for (const d of cfDeps) {
              // relationType 3 或 5 均视为必要依赖
              if ((d.relationType !== 3 && d.relationType !== 5) || !d.modId) continue;
              const modIdStr = String(d.modId);
              if (visited.has(modIdStr)) continue;
              visited.add(modIdStr);
              let projInfo = null;
              let compatibleVersion = null;
              try {
                const modInfo = await http.cachedFetchJSON(`${CURSEFORGE_API}/mods/${modIdStr}`, 120000, { 'x-api-key': cfApiKey });
                projInfo = modInfo?.data;
                if (projInfo && gdrGameVersion) {
                  const filesList = await http.cachedFetchJSON(`${CURSEFORGE_API}/mods/${modIdStr}/files?gameVersion=${encodeURIComponent(gdrGameVersion)}&pageSize=1`, 120000, { 'x-api-key': cfApiKey });
                  const cfFile = filesList?.data?.[0];
                  if (cfFile) {
                    compatibleVersion = {
                      versionId: String(cfFile.id),
                      versionNumber: cfFile.displayName || cfFile.fileName,
                      fileName: cfFile.fileName,
                      downloadUrl: cfFile.downloadUrl,
                      size: cfFile.fileLength || 0
                    };
                    await resolveDeps(String(cfFile.id), modIdStr, depth + 1, 'curseforge');
                  }
                }
              } catch (e) {}
              allDeps.push({
                projectId: modIdStr,
                title: projInfo?.name || modIdStr,
                icon: utils.applyImageMirror(projInfo?.logo?.thumbnailUrl || projInfo?.logo?.url) || '',
                description: projInfo?.summary || '',
                compatibleVersion,
                depth,
                parentProjectId: parentProjectId || null
              });
            }
          }
        }

        await resolveDeps(gdrVersionId, null, 1, null);
        sendJSON(res, { dependencies: allDeps });
      } catch (e) {
        sendJSON(res, { dependencies: [] });
      }
    });

    /* /api/mods/resolve-deps - 批量解析模组项目信息（Modrinth） */
    registerRoute('GET', '/api/mods/resolve-deps', async (req, res, parsedUrl) => {
      const depIds = parsedUrl.query.ids;
      if (!depIds) { sendJSON(res, {}); return; }
      try {
        const ids = depIds.split(',').filter(Boolean);
        if (ids.length === 0) { sendJSON(res, {}); return; }
        const result = {};
        try {
          // 批量查询
          const batchIds = JSON.stringify(ids);
          const projects = await http.cachedFetchJSON(`${MODRINTH_API}/projects?ids=${encodeURIComponent(batchIds)}`, 300000);
          if (Array.isArray(projects)) {
            for (const project of projects) {
              result[project.id] = {
                id: project.id,
                title: project.title || project.id,
                icon: utils.applyImageMirror(project.icon_url) || '',
                description: (project.description || '').substring(0, 100),
                downloads: project.downloads || 0
              };
            }
          }
          // 批量查询缺失的 ID 补查
          for (const pid of ids) {
            if (!result[pid]) {
              result[pid] = { id: pid, title: pid, icon: '', description: '', downloads: 0 };
            }
          }
        } catch (batchErr) {
          // 批量失败时逐个查询
          await Promise.all(ids.map(async (pid) => {
            try {
              const project = await http.cachedFetchJSON(`${MODRINTH_API}/project/${pid}`, 300000);
              result[pid] = {
                id: project.id,
                title: project.title || pid,
                icon: utils.applyImageMirror(project.icon_url) || '',
                description: (project.description || '').substring(0, 100),
                downloads: project.downloads || 0
              };
            } catch (e) {
              result[pid] = { id: pid, title: pid, icon: '', description: '', downloads: 0 };
            }
          }));
        }
        sendJSON(res, result);
      } catch (e) { sendJSON(res, {}); }
    });

    /* /api/mods/resolve-deps-versions - 批量解析模组项目信息及兼容版本（三策略回退） */
    registerRoute('POST', '/api/mods/resolve-deps-versions', async (req, res, parsedUrl) => {
      const rdvData = await readBody(req);
      const rdvIds = rdvData.ids || [];
      const rdvGameVersion = rdvData.gameVersion || '';
      const rdvLoader = rdvData.loader || '';
      const rdvSource = rdvData.source || 'modrinth';
      if (!rdvIds.length) { sendJSON(res, {}); return; }
      try {
        const result = {};
        let projectMap = {};
        const settings = versions.loadSettingsCached();
        const cfApiKey = settings.curseforgeApiKey || '$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm';
        // 策略 0：批量查询项目信息
        try {
          const batchIds = JSON.stringify(rdvIds);
          const projects = await http.cachedFetchJSON(`${MODRINTH_API}/projects?ids=${encodeURIComponent(batchIds)}`, 300000);
          if (Array.isArray(projects)) {
            for (const p of projects) {
              projectMap[p.id] = p;
            }
          }
        } catch (batchErr) {
          // 批量失败时逐个查询
          const projectResults = await Promise.allSettled(rdvIds.map((pid) => http.cachedFetchJSON(`${MODRINTH_API}/project/${pid}`, 300000)));
          for (let i = 0; i < rdvIds.length; i++) {
            if (projectResults[i].status === 'fulfilled') {
              projectMap[rdvIds[i]] = projectResults[i].value;
            }
          }
        }
        // 批量查询版本信息
        const versionParams = [];
        if (rdvGameVersion) versionParams.push(`game_versions=["${rdvGameVersion}"]`);
        if (rdvLoader) versionParams.push(`loaders=["${rdvLoader}"]`);
        const versionQueryString = versionParams.length > 0 ? '?' + versionParams.join('&') : '';
        const versionResults = await Promise.allSettled(rdvIds.map((pid) =>
          http.cachedFetchJSON(`${MODRINTH_API}/project/${pid}/version${versionQueryString}`, 120000)
        ));
        for (let i = 0; i < rdvIds.length; i++) {
          const pid = rdvIds[i];
          const project = projectMap[pid];
          const versionsRes = versionResults[i];
          try {
            const versions = versionsRes.status === 'fulfilled' ? versionsRes.value : [];
            let compatibleVersion = null;
            // 客户端二次过滤版本
            if (rdvGameVersion || rdvLoader) {
              const filtered = (versions || []).filter((v) => {
                const gv = v.game_versions || [];
                const loaders = (v.loaders || []).map((l) => l.toLowerCase());
                let match = true;
                if (rdvGameVersion && !gv.includes(rdvGameVersion)) match = false;
                if (rdvLoader && !loaders.includes(rdvLoader.toLowerCase())) match = false;
                return match;
              });
              compatibleVersion = filtered[0] || null;
            } else {
              compatibleVersion = versions?.[0] || null;
            }
            result[pid] = {
              id: project?.id || pid,
              title: project?.title || pid,
              slug: project?.slug || '',
              icon: utils.applyImageMirror(project?.icon_url) || '',
              description: (project?.description || '').substring(0, 100),
              downloads: project?.downloads || 0,
              hasCompatibleVersion: !!compatibleVersion,
              versionId: compatibleVersion?.id || '',
              versionNumber: compatibleVersion?.version_number || '',
              fileName: compatibleVersion?.files?.find((f) => f.primary)?.filename || compatibleVersion?.files?.[0]?.filename || '',
              gameVersions: compatibleVersion?.game_versions || [],
              loaders: compatibleVersion?.loaders || []
            };
          } catch (e) {
            result[pid] = {
              id: pid, title: pid, icon: '', description: '', downloads: 0,
              hasCompatibleVersion: false, versionId: '', versionNumber: '',
              fileName: '', gameVersions: [], loaders: []
            };
          }
        }
        // 对仍然缺失的 ID 执行三策略回退
        const missingIds = rdvIds.filter((pid) => !result[pid] || !result[pid].title || result[pid].title === pid);
        if (missingIds.length > 0) {
          // 策略 1：逐个重试 Modrinth 单项目查询
          const retryResults = await Promise.allSettled(missingIds.map(async (rid) => {
            try {
              const proj = await http.cachedFetchJSON(`${MODRINTH_API}/project/${rid}`, 120000);
              if (proj && proj.title) {
                let compatibleVersion = null;
                if (rdvGameVersion || rdvLoader) {
                  const vr = await http.cachedFetchJSON(`${MODRINTH_API}/project/${rid}/version${versionQueryString}`, 120000);
                  const filtered = (vr || []).filter((v) => {
                    const gv = v.game_versions || [];
                    const loaders = (v.loaders || []).map((l) => l.toLowerCase());
                    let match = true;
                    if (rdvGameVersion && !gv.includes(rdvGameVersion)) match = false;
                    if (rdvLoader && !loaders.includes(rdvLoader.toLowerCase())) match = false;
                    return match;
                  });
                  compatibleVersion = filtered[0] || null;
                }
                return {
                  rid,
                  data: {
                    id: proj.id || rid,
                    title: proj.title,
                    icon: utils.applyImageMirror(proj.icon_url) || '',
                    description: (proj.description || '').substring(0, 100),
                    downloads: proj.downloads || 0,
                    hasCompatibleVersion: !!compatibleVersion,
                    versionId: compatibleVersion?.id || '',
                    versionNumber: compatibleVersion?.version_number || '',
                    fileName: compatibleVersion?.files?.find((f) => f.primary)?.filename || compatibleVersion?.files?.[0]?.filename || '',
                    gameVersions: compatibleVersion?.game_versions || [],
                    loaders: compatibleVersion?.loaders || []
                  }
                };
              }
            } catch (e) {}
            return null;
          }));
          for (const r of retryResults) {
            if (r.status === 'fulfilled' && r.value) {
              result[r.value.rid] = r.value.data;
            }
          }

          // 策略 2：用 Modrinth search 按 slug 搜索
          const stillMissing = rdvIds.filter((pid) => !result[pid] || !result[pid].title || result[pid].title === pid);
          if (stillMissing.length > 0) {
            const searchResults = await Promise.allSettled(stillMissing.map(async (sid) => {
              try {
                const sr = await http.cachedFetchJSON(`${MODRINTH_API}/search?query=${encodeURIComponent(sid)}&limit=1`, 60000);
                const hit = sr?.hits?.[0];
                if (hit && hit.title) {
                  return { sid, data: { id: hit.project_id || sid, title: hit.title, icon: utils.applyImageMirror(hit.icon_url) || '', description: (hit.description || '').substring(0, 100), downloads: hit.downloads || 0 } };
                }
              } catch (e) {}
              return null;
            }));
            for (const r of searchResults) {
              if (r.status === 'fulfilled' && r.value) {
                const v = r.value.data;
                result[r.value.sid] = { ...result[r.value.sid], ...v, hasCompatibleVersion: false, versionId: '', versionNumber: '', fileName: '', gameVersions: [], loaders: [] };
              }
            }
          }

          // 策略 3：仅对数字 ID 尝试 CurseForge 查询
          const cfMissing = rdvIds.filter((pid) => (!result[pid] || !result[pid].title || result[pid].title === pid) && /^\d+$/.test(pid));
          if (cfMissing.length > 0) {
            const cfResults = await Promise.allSettled(cfMissing.map(async (cid) => {
              try {
                const modInfo = await http.cachedFetchJSON(`${CURSEFORGE_API}/mods/${cid}`, 120000, { 'x-api-key': cfApiKey });
                const proj = modInfo?.data;
                if (!proj) return null;
                let compatibleVersion = null;
                if (rdvGameVersion) {
                  const filesList = await http.cachedFetchJSON(`${CURSEFORGE_API}/mods/${cid}/files?gameVersion=${encodeURIComponent(rdvGameVersion)}&pageSize=5`, 120000, { 'x-api-key': cfApiKey });
                  const cfFiles = filesList?.data || [];
                  const cfFile = cfFiles[0] || null;
                  if (cfFile) {
                    compatibleVersion = { id: String(cfFile.id), version_number: cfFile.displayName || cfFile.fileName, files: [{ filename: cfFile.fileName, primary: true }], game_versions: cfFile.gameVersions || [], loaders: cfFile.sortableGameVersions?.map((s) => s.gameVersionTypeId) || [] };
                  }
                }
                return { cid, data: { id: String(proj.id), title: proj.name, icon: utils.applyImageMirror(proj.logo?.thumbnailUrl || proj.logo?.url) || '', description: (proj.summary || '').substring(0, 100), downloads: proj.downloadCount || 0, hasCompatibleVersion: !!compatibleVersion, versionId: compatibleVersion?.id || '', versionNumber: compatibleVersion?.version_number || '', fileName: compatibleVersion?.files?.[0]?.filename || '', gameVersions: compatibleVersion?.game_versions || [], loaders: compatibleVersion?.loaders || [] } };
              } catch (e) { return null; }
            }));
            for (const r of cfResults) {
              if (r.status === 'fulfilled' && r.value) {
                result[r.value.cid] = r.value.data;
              }
            }
          }
        }
        sendJSON(res, result);
      } catch (e) { sendJSON(res, {}); }
    });
  }
};
