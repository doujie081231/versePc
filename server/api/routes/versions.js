/**
 * @file server/api/routes/versions.js
 * @description 版本管理路由 - 从 server.js handleAPI switch 语句抽取的版本列表、详情、删除链、修复会话、导出整合包、版本图标、安装流程等端点
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');

let _serverModule = null;
// 懒加载 server 模块，规避循环依赖
function _server() {
  if (_serverModule === null) {
    try { _serverModule = require('../../../server'); } catch (_) { _serverModule = {}; }
  }
  return _serverModule;
}

module.exports = {
  /**
   * 注册版本管理相关路由
   * @param {Function} registerRoute - 路由注册函数
   * @param {Object} deps - 依赖对象（ctx/sendJSON/sendError/readBody/versions/launch/diagnose/modloaders/accounts/utils/http/java/dependencies）
   * @returns {void}
   */
  register(registerRoute, deps) {
    const { ctx, sendJSON, sendError, readBody } = deps;
    const { versions, launch, diagnose, modloaders, accounts, utils, http, java, dependencies } = deps;

    /* /api/versions - 获取版本列表（支持强制刷新、仅已安装过滤） */
    registerRoute('GET', '/api/versions', async (req, res, parsedUrl) => {
      const forceRefresh = parsedUrl.query.refresh === 'true';
      const installedOnly = parsedUrl.query.installed === 'true';
      const installedList = versions.getInstalledVersions(forceRefresh);
      const installedIds = new Set();
      const installedBaseIds = new Set();
      for (const v of installedList) {
        installedIds.add(v.id);
        if (v.baseVersion) installedBaseIds.add(v.baseVersion);
        if (v.inheritsFrom) installedBaseIds.add(v.inheritsFrom);
      }

      // 仅返回已安装版本
      if (installedOnly) {
        sendJSON(res, {
          latest: { release: '', snapshot: '' },
          versions: installedList.map((v) => ({ ...v, installed: true })),
          installed: installedList
        });
        return;
      }

      if (forceRefresh || !ctx.caches.versionCache) {
        try {
          const manifest = await versions.getVersionManifest(forceRefresh);
          const versionList = manifest.versions.map((v) => {
            const corrected = { id: v.id, type: v.type, url: v.url, releaseTime: v.releaseTime };
            corrected.type = versions.correctVersionType(corrected);
            return {
              id: v.id,
              type: corrected.type,
              url: v.url,
              releaseTime: v.releaseTime,
              complianceLevel: v.complianceLevel || 1,
              installed: installedIds.has(v.id) || installedBaseIds.has(v.id),
              size: ''
            };
          });

          sendJSON(res, {
            latest: manifest.latest,
            versions: versionList,
            installed: installedList
          });
        } catch (e) {
          // 官方清单获取失败时降级返回已安装版本
          sendJSON(res, {
            latest: { release: '', snapshot: '' },
            versions: installedList.map((v) => ({ ...v, installed: true })),
            installed: installedList
          });
        }
      } else {
        // 有缓存时先返回缓存，后台异步刷新
        sendJSON(res, {
          latest: ctx.caches.versionCache.latest || { release: '', snapshot: '' },
          versions: (ctx.caches.versionCache.versions || []).map((v) => {
            const corrected = { id: v.id, type: v.type, url: v.url, releaseTime: v.releaseTime };
            corrected.type = versions.correctVersionType(corrected);
            return {
              id: v.id,
              type: corrected.type,
              url: v.url,
              releaseTime: v.releaseTime,
              complianceLevel: v.complianceLevel || 1,
              installed: installedIds.has(v.id) || installedBaseIds.has(v.id),
              size: ''
            };
          }),
          installed: installedList
        });

        versions.getVersionManifest(forceRefresh).then((manifest) => {
          ctx.caches.versionCache = manifest;
        }).catch(() => {});
      }
    });

    /* /api/debug/versions - 调试端点：输出版本目录原始结构与过滤结果 */
    registerRoute('GET', '/api/debug/versions', async (req, res, parsedUrl) => {
      const rawDirs = [];
      if (fs.existsSync(ctx.dirs.VERSIONS_DIR)) {
        const dirs = fs.readdirSync(ctx.dirs.VERSIONS_DIR);
        for (const dir of dirs) {
          const versionDir = path.join(ctx.dirs.VERSIONS_DIR, dir);
          try {
            if (!fs.statSync(versionDir).isDirectory()) continue;
          } catch (e) { continue; }
          const jsonFile = versions.findVersionJson(versionDir);
          const entry = { dir, jsonFile: jsonFile || null, jsonData: null, jsonFiles: [] };
          if (fs.existsSync(versionDir)) {
            try {
              const allFiles = fs.readdirSync(versionDir);
              entry.jsonFiles = allFiles.filter((f) => f.endsWith('.json'));
            } catch (_) {}
          }
          if (jsonFile && fs.existsSync(jsonFile)) {
            try {
              const data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
              // 推断 inheritsFrom：若 JSON 未显式声明，则根据 mainClass / 版本 ID 推断 Forge/NeoForge 基础版本
              let inf = data.inheritsFrom || null;
              if (!inf) {
                const verId = data.id || dir;
                const isN = (data.mainClass || '').includes('neoforge') || verId.toLowerCase().includes('neoforge');
                const isF = !isN && ((data.mainClass || '').includes('forge') || verId.toLowerCase().includes('forge'));
                if (isN || isF) {
                  const m = verId.match(/^(\d+\.\d+(?:\.\d+)?(?:-rc\d+|-pre\d+|-snapshot.*)?)/i);
                  if (m) inf = m[1];
                }
              }
              entry.jsonData = {
                id: data.id,
                inheritsFrom: inf,
                mainClass: data.mainClass || null,
                type: data.type || null,
                libraryCount: (data.libraries || []).length
              };
            } catch (_) {}
          }
          rawDirs.push(entry);
        }
      }
      const filtered = versions.getInstalledVersions();
      sendJSON(res, {
        rawDirs,
        filteredIds: filtered.map((v) => v.id),
        filteredCount: filtered.length
      });
    });

    /* /api/version-details - 获取远程版本详情（按 URL 拉取 version.json） */
    registerRoute('GET', '/api/version-details', async (req, res, parsedUrl) => {
      const versionUrl = parsedUrl.query.url;
      if (!versionUrl) { sendError(res, 'Missing url parameter', 400); return; }
      const details = await versions.getVersionDetails(versionUrl);
      const result = {
        id: details.id,
        type: details.type,
        mainClass: details.mainClass,
        releaseTime: details.releaseTime,
        javaVersion: details.javaVersion,
        libraries: [],
        downloads: {}
      };
      if (details.libraries) {
        result.libraries = details.libraries.map((lib) => ({
          name: lib.name,
          downloads: lib.downloads || {}
        }));
      }
      if (details.downloads) {
        result.downloads = {
          client: details.downloads.client ? {
            url: details.downloads.client.url,
            size: details.downloads.client.size,
            sha1: details.downloads.client.sha1
          } : null,
          server: details.downloads.server ? {
            url: details.downloads.server.url,
            size: details.downloads.server.size,
            sha1: details.downloads.server.sha1
          } : null
        };
      }
      if (details.assetIndex) {
        result.assetIndex = {
          id: details.assetIndex.id,
          url: details.assetIndex.url,
          totalSize: details.assetIndex.totalSize,
          size: details.assetIndex.size
        };
      }
      sendJSON(res, result);
    });

    /* /api/version-local-details - 获取本地版本详情 */
    registerRoute('GET', '/api/version-local-details', async (req, res, parsedUrl) => {
      const versionId = parsedUrl.query.versionId;
      if (!versionId) { sendError(res, 'Missing versionId parameter', 400); return; }
      const localDetails = versions.getVersionLocalDetails(versionId);
      sendJSON(res, localDetails);
    });

    /* /api/version/open-folder - 打开版本相关文件夹（version/saves/mods） */
    registerRoute('GET', '/api/version/open-folder', async (req, res, parsedUrl) => {
      const vofVersionId = parsedUrl.query.versionId;
      const vofFolderType = parsedUrl.query.folderType || 'version';
      if (!vofVersionId) { sendError(res, 'Missing versionId', 400); return; }
      try {
        const cleanVofId = vofVersionId.replace(/ \[外部\d*\]/, '');
        // 优先在外部文件夹中查找匹配版本
        let externalVersionDir = null;
        const extFolders = versions.loadExternalFolders();
        for (const folder of extFolders) {
          if (!fs.existsSync(folder.path)) continue;
          const extVers = versions.scanExternalFolder(folder.path);
          const extV = extVers.find((v) => v.id === cleanVofId);
          if (extV) {
            externalVersionDir = extV.externalVersionDir;
            break;
          }
        }
        let targetPath;
        if (externalVersionDir) {
          switch (vofFolderType) {
            case 'version': targetPath = externalVersionDir; break;
            case 'saves': targetPath = path.join(externalVersionDir, 'saves'); break;
            case 'mods': targetPath = path.join(externalVersionDir, 'mods'); break;
            default: targetPath = externalVersionDir; break;
          }
        } else {
          const gameDir = versions.getVersionGameDir(vofVersionId);
          if (gameDir) {
            switch (vofFolderType) {
              case 'version': targetPath = gameDir; break;
              case 'saves': targetPath = path.join(gameDir, 'saves'); break;
              case 'mods': targetPath = path.join(gameDir, 'mods'); break;
              default: targetPath = gameDir; break;
            }
          } else {
            targetPath = path.join(ctx.dirs.VERSIONS_DIR, cleanVofId);
          }
        }
        if (!fs.existsSync(targetPath)) { fs.mkdirSync(targetPath, { recursive: true }); }
        // 路径安全校验：仅允许访问白名单前缀下的目录
        const resolvedTarget = path.resolve(targetPath);
        const allowedPrefixes = [
          path.resolve(ctx.dirs.VERSIONS_DIR),
          path.resolve(ctx.dirs.DATA_DIR)
        ];
        for (const folder of extFolders) {
          if (folder.path) allowedPrefixes.push(path.resolve(folder.path));
        }
        const settings = versions.loadSettingsCached();
        if (settings.gameDir) allowedPrefixes.push(path.resolve(settings.gameDir));
        const isAllowed = allowedPrefixes.some((pfx) => resolvedTarget.startsWith(pfx));
        if (!isAllowed) {
          sendJSON(res, { success: false, error: '不允许访问该路径' }); return;
        }
        require('electron').shell.openPath(resolvedTarget);
        sendJSON(res, { success: true });
      } catch (e) { sendJSON(res, { success: false, error: e.message }); }
    });

    /* /api/version/rename - 重命名版本（保存 customName） */
    registerRoute('POST', '/api/version/rename', async (req, res, parsedUrl) => {
      const body3 = await readBody(req);
      const { versionId: rvrId, newName } = body3;
      if (!rvrId || !newName) { sendError(res, 'Missing params', 400); return; }
      try {
        const versionsData = versions.loadVersions();
        const ver = versionsData.find((v) => v.id === rvrId);
        if (ver) {
          ver.customName = newName;
          versions.saveVersions(versionsData);
          sendJSON(res, { success: true });
        } else { sendError(res, 'Version not found', 404); }
      } catch (e) { sendJSON(res, { success: false, error: e.message }); }
    });

    /* /api/version/export-script - 导出 Windows 启动脚本（.bat） */
    registerRoute('POST', '/api/version/export-script', async (req, res, parsedUrl) => {
      if (process.platform !== 'win32') {
        sendJSON(res, { success: false, error: '启动脚本导出仅支持 Windows 系统' });
        return;
      }
      const body4 = await readBody(req);
      const { versionId: esId } = body4;
      if (!esId) { sendError(res, 'Missing versionId', 400); return; }
      try {
        const verDir = path.join(ctx.dirs.VERSIONS_DIR, esId);
        const verJsonPath = path.join(verDir, `${esId}.json`);
        if (!fs.existsSync(verJsonPath)) { sendJSON(res, { success: false, error: 'Version JSON not found' }); return; }
        const verJson = JSON.parse(fs.readFileSync(verJsonPath, 'utf-8'));
        const globalSettings = versions.loadSettingsCached();
        const verSettings = versions.loadVersionSettings(esId);

        // 解析版本 JSON，合并父版本信息（inheritsFrom）
        let actualVersionId = esId;
        let mainClass = verJson.mainClass || 'net.minecraft.client.main.Main';
        let libraries = verJson.libraries || [];
        let gameArgs = verJson.minecraftArguments || '';
        if (verJson.arguments) {
          if (verJson.arguments.game) {
            gameArgs = verJson.arguments.game.filter((a) => typeof a === 'string').join(' ');
          }
        }

        // 构建 classpath：合并父版本库 + 当前版本库
        let classPathParts = [];
        let parentJson = verJson;
        if (verJson.inheritsFrom) {
          actualVersionId = verJson.inheritsFrom;
          const parentJsonPath = path.join(ctx.dirs.VERSIONS_DIR, verJson.inheritsFrom, `${verJson.inheritsFrom}.json`);
          if (fs.existsSync(parentJsonPath)) {
            parentJson = JSON.parse(fs.readFileSync(parentJsonPath, 'utf-8'));
            mainClass = parentJson.mainClass || mainClass;
            libraries = [...(parentJson.libraries || []), ...libraries];
            if (!gameArgs) {
              gameArgs = parentJson.minecraftArguments || '';
              if (parentJson.arguments && parentJson.arguments.game) {
                gameArgs = parentJson.arguments.game.filter((a) => typeof a === 'string').join(' ');
              }
            }
          }
        }

        libraries.forEach((lib) => {
          if (lib.downloads && lib.downloads.artifact) {
            const libPath = path.join(ctx.dirs.LIBRARIES_DIR, lib.downloads.artifact.path || '');
            classPathParts.push(libPath);
          } else if (lib.name) {
            const parts = lib.name.split(':');
            if (parts.length >= 3) {
              const pkgPath = parts[0].replace(/\./g, '/');
              const libPath = path.join(ctx.dirs.LIBRARIES_DIR, pkgPath, parts[1], parts[2], `${parts[1]}-${parts[2]}.jar`);
              classPathParts.push(libPath);
            }
          }
        });

        const jarPath = path.join(ctx.dirs.VERSIONS_DIR, actualVersionId, `${actualVersionId}.jar`);
        classPathParts.push(jarPath);

        // 内存分配：读取全局/版本设置，支持 auto/custom 两种模式
        let maxMem = globalSettings.maxMemory || 4096;
        try {
          const storePath2 = path.join(ctx.dirs.DATA_DIR, 'app-store.json');
          if (fs.existsSync(storePath2)) {
            const store2 = JSON.parse(fs.readFileSync(storePath2, 'utf8'));
            const ls2 = store2['versepc_launch_settings'];
            if (ls2) {
              const lsObj = JSON.parse(ls2);
              if (lsObj.memoryMode === 'auto') {
                // 自动模式：根据系统总内存按梯度分配
                const tMB = Math.floor(os.totalmem() / 1024 / 1024);
                let aMB;
                if (tMB <= 2500) aMB = 1024;
                else if (tMB <= 4500) aMB = tMB - 1500;
                else if (tMB <= 8500) aMB = tMB - 2048;
                else aMB = tMB - 4096;
                aMB = Math.max(512, Math.min(aMB, 32768));
                maxMem = Math.floor(aMB / 256) * 256;
              } else if (lsObj.memoryMode === 'custom') {
                maxMem = parseInt(lsObj.memoryValue, 10) || 4096;
              }
            }
          }
        } catch (e2) {}
        // 版本设置覆盖全局设置
        if (verSettings.memoryMode === 'custom') maxMem = verSettings.memoryValue || maxMem;
        const minMem = Math.min(1024, maxMem);
        const javaPath = verSettings.javaPath === 'global' ? (globalSettings.javaPath || 'java') : verSettings.javaPath;
        let jvmArgs = verSettings.jvmArgs || globalSettings.javaArgs || '';
        if (!jvmArgs.includes('preferIPv4Stack') && !jvmArgs.includes('preferIPv6Stack')) {
          jvmArgs += ' -Djava.net.preferIPv4Stack=true -Djava.net.preferIPv4Addresses=true';
        }
        const customGameArgs = verSettings.gameArgs || '';
        const assetsDir = path.join(ctx.dirs.DATA_DIR, 'assets');
        const assetIndex = parentJson.assetIndex ? parentJson.assetIndex.id : actualVersionId;
        const gameDir = versions.resolveVersionIsolation(esId) ? verDir : ctx.dirs.DATA_DIR;

        // 生成批处理脚本（HTML 字符串内保留双引号）
        let scriptContent = `@echo off\r\n`;
        scriptContent += `chcp 65001 >nul\r\n`;
        scriptContent += `echo VersePC - Launch Script for ${esId}\r\n`;
        scriptContent += `echo ============================================\r\n`;
        scriptContent += `echo Version: ${esId}\r\n`;
        scriptContent += `echo Max Memory: ${maxMem}MB\r\n`;
        scriptContent += `echo ============================================\r\n`;
        scriptContent += `echo.\r\n\r\n`;
        scriptContent += `"${javaPath}" -Xmx${maxMem}M -Xms${minMem}M ${jvmArgs} -Djava.library.path="${path.join(verDir, 'natives')}" -Dminecraft.launcher.brand=VersePC -Dminecraft.launcher.version=${ctx.pkgVersion} -cp "${classPathParts.join(';')}" ${mainClass} --username Player --version ${esId} --gameDir "${gameDir}" --assetsDir "${assetsDir}" --assetIndex ${assetIndex} --uuid 00000000-0000-0000-0000-000000000000 --accessToken 0 --userType legacy ${gameArgs} ${customGameArgs}\r\n`;
        scriptContent += `echo.\r\n`;
        scriptContent += `echo Game exited.\r\n`;
        scriptContent += `pause\r\n`;

        const scriptPath = path.join(verDir, 'launch.bat');
        fs.writeFileSync(scriptPath, scriptContent, 'utf-8');
        sendJSON(res, { success: true, path: scriptPath });
      } catch (e) { sendJSON(res, { success: false, error: e.message }); }
    });

    /* /api/version/repair-start - 启动版本修复会话（异步执行，返回 sessionId） */
    registerRoute('POST', '/api/version/repair-start', async (req, res, parsedUrl) => {
      const body5 = await readBody(req);
      const { versionId: rfId } = body5;
      if (!rfId) { sendError(res, 'Missing versionId', 400); return; }

      const verDir = path.join(ctx.dirs.VERSIONS_DIR, rfId);
      if (!fs.existsSync(verDir)) { sendError(res, 'Version not found', 404); return; }

      const sessionId = `repair_${rfId}_${Date.now()}`;
      ctx.sessions.repairSessions.set(sessionId, {
        versionId: rfId, status: 'preparing', progress: 0, stage: 'preparing',
        message: '准备修复...', startTime: Date.now(), checkedFiles: 0, totalFiles: 0,
        missingFiles: 0, repairedFiles: 0, currentFile: '',
        _abortController: new AbortController(),
        lastActivity: Date.now()
      });

      diagnose.performRepair(sessionId, rfId);
      sendJSON(res, { success: true, sessionId });
    });

    /* /api/version/repair-progress - 修复进度查询/推送（支持 SSE 实时流） */
    registerRoute('GET', '/api/version/repair-progress', async (req, res, parsedUrl) => {
      const rpSessionId = parsedUrl.query.sessionId;
      if (!rpSessionId || !ctx.sessions.repairSessions.has(rpSessionId)) { sendError(res, 'Invalid session', 404); return; }
      const rpSession = ctx.sessions.repairSessions.get(rpSessionId);

      if (parsedUrl.query.sse === 'true') {
        // SSE 模式：每 300ms 推送一次进度，完成/失败/取消时结束流
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        const interval = setInterval(() => {
          const s = ctx.sessions.repairSessions.get(rpSessionId);
          if (!s || s.status === 'completed' || s.status === 'failed' || s.status === 'cancelled') {
            if (s) res.write(`data: ${JSON.stringify({ status: s.status, progress: s.progress, message: s.message, stage: s.stage, checkedFiles: s.checkedFiles, totalFiles: s.totalFiles, missingFiles: s.missingFiles, repairedFiles: s.repairedFiles, currentFile: s.currentFile, logFile: s._logFile })}\n\n`);
            res.end(); clearInterval(interval); return;
          }
          res.write(`data: ${JSON.stringify({ status: s.status, progress: s.progress, message: s.message, stage: s.stage, checkedFiles: s.checkedFiles, totalFiles: s.totalFiles, missingFiles: s.missingFiles, repairedFiles: s.repairedFiles, currentFile: s.currentFile, logFile: s._logFile })}\n\n`);
        }, 300);
        req.on('close', () => { clearInterval(interval); res.end(); });
      } else {
        sendJSON(res, {
          status: rpSession.status, progress: rpSession.progress, message: rpSession.message,
          stage: rpSession.stage, checkedFiles: rpSession.checkedFiles, totalFiles: rpSession.totalFiles,
          missingFiles: rpSession.missingFiles, repairedFiles: rpSession.repairedFiles,
          currentFile: rpSession.currentFile, logFile: rpSession._logFile
        });
      }
    });

    /* /api/version/repair-cancel - 取消修复会话 */
    registerRoute('GET', '/api/version/repair-cancel', async (req, res, parsedUrl) => {
      const rcSessionId = parsedUrl.query.sessionId;
      if (!rcSessionId || !ctx.sessions.repairSessions.has(rcSessionId)) { sendError(res, 'Invalid session', 404); return; }
      const rcSession = ctx.sessions.repairSessions.get(rcSessionId);
      rcSession.status = 'cancelled'; rcSession.stage = 'cancelled'; rcSession.message = '修复已取消';
      if (rcSession._abortController) { try { rcSession._abortController.abort(); } catch (e) {} }
      sendJSON(res, { success: true });
    });

    /* /api/version/delete-chain - 预计算版本删除链（收集所有继承该版本的子版本） */
    registerRoute('POST', '/api/version/delete-chain', async (req, res, parsedUrl) => {
      const dcBody = await readBody(req);
      const { versionId: dcId } = dcBody;
      if (!dcId) { sendError(res, 'Missing versionId', 400); return; }
      try {
        // 收集所有版本目录（包括外部文件夹）
        const versionsDirs = [ctx.dirs.VERSIONS_DIR];
        const extFolders = versions.loadExternalFolders();
        for (const folder of extFolders) {
          if (folder.path && fs.existsSync(folder.path)) versionsDirs.push(folder.path);
        }

        // 构建 versionMeta 与 childrenMap：parent -> [children]
        const versionMeta = {};
        const childrenMap = {};

        for (const dir of versionsDirs) {
          if (!fs.existsSync(dir)) continue;
          for (const d of fs.readdirSync(dir)) {
            const jsonPath = path.join(dir, d, `${d}.json`);
            if (fs.existsSync(jsonPath)) {
              try {
                const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
                const parent = json.inheritsFrom || null;
                versionMeta[d] = { inheritsFrom: parent };
                if (parent) {
                  if (!childrenMap[parent]) childrenMap[parent] = [];
                  childrenMap[parent].push(d);
                }
              } catch (_) {}
            }
          }
        }

        // 递归收集待删除的子版本
        const deletionSet = new Set([dcId]);
        const willDelete = [dcId];
        const willSkip = [];
        const visited = new Set([dcId]);

        function collectDescendants(parentId) {
          const children = childrenMap[parentId] || [];
          for (const child of children) {
            if (visited.has(child)) continue;
            visited.add(child);
            const meta = versionMeta[child];
            if (meta && meta.inheritsFrom && deletionSet.has(meta.inheritsFrom)) {
              deletionSet.add(child);
              willDelete.push(child);
            } else {
              willSkip.push(child);
            }
            collectDescendants(child);
          }
        }

        collectDescendants(dcId);
        sendJSON(res, { success: true, willDelete, willSkip });
      } catch (e) { sendJSON(res, { success: false, error: e.message }); }
    });

    /* /api/version/delete - 删除版本（支持永久删除/回收站，含链式清理） */
    registerRoute('POST', '/api/version/delete', async (req, res, parsedUrl) => {
      const body6 = await readBody(req);
      const { versionId: dvId, permanent: dvPermanent } = body6;
      if (!dvId) { sendError(res, 'Missing versionId', 400); return; }
      try {
        const cleanId = dvId.replace(/ \[外部\d*\]/, '');
        const isExternal = dvId.includes(' [外部');
        let deleted = false;
        let deleteError = '';

        if (isExternal) {
          // 外部版本：遍历所有外部文件夹，删除对应的单个版本目录
          if (cleanId.includes('..') || cleanId.includes('/') || cleanId.includes('\\')) {
            deleteError = '无效的版本ID';
          } else {
            const extFolders = versions.loadExternalFolders();
            for (const folder of extFolders) {
              const extVersionDir = path.join(folder.path, 'versions', cleanId);
              if (fs.existsSync(extVersionDir)) {
                try {
                  fs.rmSync(extVersionDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
                  deleted = true;
                } catch (e) {
                  try {
                    const { execSync } = require('child_process');
                    execSync(`rmdir /s /q "${extVersionDir}"`, { timeout: 10000, windowsHide: true });
                    deleted = true;
                  } catch (_) {
                    deleteError = e.message || '删除失败';
                  }
                }
              }
            }
            const extSettingsDir = path.join(ctx.dirs.DATA_DIR, 'external-settings');
            const extSettingsFile = path.join(extSettingsDir, `${cleanId.replace(/[/\\?%*:|"<>]/g, '_')}-settings.json`);
            try { if (fs.existsSync(extSettingsFile)) fs.unlinkSync(extSettingsFile); } catch (_) {}
            if (!deleted && !deleteError) { deleted = true; }
          }
        } else {
          // 本地版本：永久删除直接 rmSync，否则优先送回收站
          const versionDir = path.join(ctx.dirs.VERSIONS_DIR, cleanId);
          if (fs.existsSync(versionDir)) {
            deleted = false;
            if (dvPermanent) {
              try {
                fs.rmSync(versionDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
                deleted = true;
              } catch (e) {
                // rmSync 失败时回退到 rmdir 命令
                try {
                  const { execSync } = require('child_process');
                  execSync(`rmdir /s /q "${versionDir}"`, { timeout: 10000, windowsHide: true });
                  deleted = true;
                } catch (_) {
                  deleteError = e.message || '删除失败';
                }
              }
            } else if (process.platform !== 'win32') {
              // 非 Windows 平台没有系统回收站接口，直接强制删除
              try {
                fs.rmSync(versionDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
                deleted = true;
              } catch (e) {
                deleteError = e.message || '删除失败';
              }
            } else {
              try {
                const recycleBin = require('recycle-bin');
                await recycleBin(versionDir);
                deleted = true;
              } catch (_) {
                // 回收站失败时回退到强制删除
                try {
                  fs.rmSync(versionDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
                  deleted = true;
                } catch (e) {
                  try {
                    const { execSync } = require('child_process');
                    execSync(`rmdir /s /q "${versionDir}"`, { timeout: 10000, windowsHide: true });
                    deleted = true;
                  } catch (_) {
                    deleteError = e.message || '删除失败';
                  }
                }
              }
            }
            // 删除后仍存在：文件可能被占用，再次尝试
            if (deleted && fs.existsSync(versionDir)) {
              console.error(`[version-delete] 删除操作后文件夹仍存在: ${versionDir}`);
              try { fs.rmSync(versionDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 }); } catch (_) {}
              if (fs.existsSync(versionDir)) {
                try {
                  const { execSync } = require('child_process');
                  execSync(`rmdir /s /q "${versionDir}"`, { timeout: 10000, windowsHide: true });
                } catch (_) {}
              }
              if (fs.existsSync(versionDir)) {
                deleted = false;
                deleteError = '文件可能被占用，请关闭游戏后重试';
              }
            }
            if (!deleted) {
              sendJSON(res, { success: false, error: deleteError || '删除失败' });
              return;
            }
          } else {
            const extFolders = versions.loadExternalFolders();
            for (const folder of extFolders) {
              const extVersionDir = path.join(folder.path, 'versions', cleanId);
              if (fs.existsSync(extVersionDir)) {
                try {
                  fs.rmSync(extVersionDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
                  deleted = true;
                } catch (e) {
                  try {
                    const { execSync } = require('child_process');
                    execSync(`rmdir /s /q "${extVersionDir}"`, { timeout: 10000, windowsHide: true });
                    deleted = true;
                  } catch (_) {
                    deleteError = e.message || '删除失败';
                  }
                }
              }
            }
            const extSettingsDir2 = path.join(ctx.dirs.DATA_DIR, 'external-settings');
            const extSettingsFile2 = path.join(extSettingsDir2, `${cleanId.replace(/[/\\?%*:|"<>]/g, '_')}-settings.json`);
            try { if (fs.existsSync(extSettingsFile2)) fs.unlinkSync(extSettingsFile2); } catch (_) {}
            if (!deleted && !deleteError) { deleted = true; }
          }
        }

        if (deleted) {
          // 链式清理：删除继承该版本的所有子版本及无人引用的原版
          let allDeletedIds = [dvId];
          if (!isExternal) {
            try {
              const chainInfo = versions.findVersionChain(cleanId);
              const vanillaPattern = /^\d+\.\d+(\.\d+)?(-rc\d+|-pre\d+|-snapshot.*)?$/i;
              const chainIds = (chainInfo || []).filter((cid) => cid !== cleanId && !vanillaPattern.test(cid));
              for (const cid of chainIds) {
                const chainDir = path.join(ctx.dirs.VERSIONS_DIR, cid);
                if (fs.existsSync(chainDir)) {
                  try {
                    fs.rmSync(chainDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
                    if (!allDeletedIds.includes(cid)) allDeletedIds.push(cid);
                  } catch (_) {}
                } else {
                  if (!allDeletedIds.includes(cid)) allDeletedIds.push(cid);
                }
              }
              // 清理无人引用的原版版本
              for (const vid of chainInfo || []) {
                if (vanillaPattern.test(vid) && vid !== cleanId) {
                  const vDir = path.join(ctx.dirs.VERSIONS_DIR, vid);
                  if (!fs.existsSync(vDir)) continue;
                  const remaining = fs.readdirSync(ctx.dirs.VERSIONS_DIR).filter((d) => {
                    if (d === vid) return false;
                    const dDir = path.join(ctx.dirs.VERSIONS_DIR, d);
                    try { if (!fs.statSync(dDir).isDirectory()) return false; } catch (_) { return false; }
                    const jp = versions.findVersionJson(dDir);
                    if (!jp) return false;
                    try {
                      const dData = JSON.parse(fs.readFileSync(jp, 'utf-8'));
                      return dData.inheritsFrom === vid;
                    } catch (_) { return false; }
                  });
                  if (remaining.length === 0) {
                    try { fs.rmSync(vDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 }); } catch (_) {}
                    if (!allDeletedIds.includes(vid)) allDeletedIds.push(vid);
                  }
                }
              }
            } catch (chainErr) {
              console.error('[version-delete] 链式清理失败:', chainErr.message);
            }
          }

          // 清理 versions.json 中的元数据
          let versionsData = versions.loadVersions();
          const removeIds = new Set(allDeletedIds);
          versionsData = versionsData.filter((v) => !removeIds.has(v.id));
          versions.saveVersions(versionsData);

          ctx.caches._versionsCache = null;
          ctx.caches._versionsCacheTime = 0;

          sendJSON(res, { success: true, deleted: allDeletedIds, permanent: !!dvPermanent });
        } else {
          sendJSON(res, { success: false, error: `删除失败: ${deleteError || '文件可能被占用，请关闭游戏后重试'}`, permanent: !!dvPermanent });
        }
      } catch (e) { sendJSON(res, { success: false, error: e.message }); }
    });

    /* /api/version/settings - 获取版本独立设置 */
    registerRoute('GET', '/api/version/settings', async (req, res, parsedUrl) => {
      const vsVersionId = parsedUrl.query.versionId;
      if (!vsVersionId) { sendError(res, 'Missing versionId', 400); return; }
      try {
        const vs = versions.loadVersionSettings(vsVersionId);
        sendJSON(res, vs);
      } catch (e) { sendJSON(res, { success: false, error: e.message }); }
    });

    /* /api/version/settings/save - 保存版本独立设置（合并已有字段） */
    registerRoute('POST', '/api/version/settings/save', async (req, res, parsedUrl) => {
      const vsData = await readBody(req);
      const vsId = vsData.versionId;
      if (!vsId) { sendError(res, 'Missing versionId', 400); return; }
      try {
        const existing = versions.loadVersionSettings(vsId);
        const merged = { ...existing, ...vsData, versionId: vsId };
        versions.saveVersionSettings(vsId, merged);
        sendJSON(res, { success: true });
      } catch (e) { sendJSON(res, { success: false, error: e.message }); }
    });

    /* /api/version/description - 保存版本描述 */
    registerRoute('POST', '/api/version/description', async (req, res, parsedUrl) => {
      const descData = await readBody(req);
      const descId = descData.versionId;
      const descText = descData.description || '';
      if (!descId) { sendError(res, 'Missing versionId', 400); return; }
      try {
        const vs = versions.loadVersionSettings(descId);
        vs.description = descText;
        versions.saveVersionSettings(descId, vs);
        sendJSON(res, { success: true });
      } catch (e) { sendJSON(res, { success: false, error: e.message }); }
    });

    /* /api/version/favorite - 切换版本收藏状态 */
    registerRoute('POST', '/api/version/favorite', async (req, res, parsedUrl) => {
      const favData = await readBody(req);
      const favId = favData.versionId;
      const favState = favData.favorite !== false;
      if (!favId) { sendError(res, 'Missing versionId', 400); return; }
      try {
        const vs = versions.loadVersionSettings(favId);
        vs.favorite = favState;
        versions.saveVersionSettings(favId, vs);
        sendJSON(res, { success: true, favorite: favState });
      } catch (e) { sendJSON(res, { success: false, error: e.message }); }
    });

    /* /api/version/icon - 设置版本图标类型 */
    registerRoute('POST', '/api/version/icon', async (req, res, parsedUrl) => {
      const iconData = await readBody(req);
      const iconId = iconData.versionId;
      const iconType = iconData.icon || 'auto';
      if (!iconId) { sendError(res, 'Missing versionId', 400); return; }
      try {
        const vs = versions.loadVersionSettings(iconId);
        vs.icon = iconType;
        versions.saveVersionSettings(iconId, vs);
        sendJSON(res, { success: true });
      } catch (e) { sendJSON(res, { success: false, error: e.message }); }
    });

    /* /api/version/category - 设置版本分类 */
    registerRoute('POST', '/api/version/category', async (req, res, parsedUrl) => {
      const catData = await readBody(req);
      const catId = catData.versionId;
      const catType = catData.category || 'auto';
      if (!catId) { sendError(res, 'Missing versionId', 400); return; }
      try {
        const vs = versions.loadVersionSettings(catId);
        vs.category = catType;
        versions.saveVersionSettings(catId, vs);
        sendJSON(res, { success: true });
      } catch (e) { sendJSON(res, { success: false, error: e.message }); }
    });

    /* /api/version/add-folder - 添加外部 Minecraft 文件夹 */
    registerRoute('POST', '/api/version/add-folder', async (req, res, parsedUrl) => {
      const afData = await readBody(req);
      const afPath = afData.path;
      const afName = afData.name || '';
      if (!afPath) { sendError(res, 'Missing path', 400); return; }
      try {
        if (!fs.existsSync(afPath)) {
          sendJSON(res, { success: false, error: '文件夹不存在: ' + afPath });
          return;
        }
        const stat = fs.statSync(afPath);
        if (!stat.isDirectory()) {
          sendJSON(res, { success: false, error: '路径不是文件夹: ' + afPath });
          return;
        }
        // 校验：必须包含 versions 子目录
        const versionsDir = path.join(afPath, 'versions');
        if (!fs.existsSync(versionsDir)) {
          sendJSON(res, { success: false, error: '该文件夹下未找到 versions 子目录，请选择有效的 Minecraft 文件夹' });
          return;
        }
        const folders = versions.loadExternalFolders();
        if (folders.some((f) => f.path === afPath)) {
          sendJSON(res, { success: false, error: '该文件夹已添加' });
          return;
        }
        const scannedVersions = versions.scanExternalFolder(afPath);
        if (scannedVersions.length === 0) {
          sendJSON(res, { success: false, error: '该文件夹下未找到有效的 Minecraft 版本' });
          return;
        }
        const folderName = afName || path.basename(afPath);
        folders.push({ path: afPath, name: folderName, addedAt: new Date().toISOString() });
        versions.saveExternalFolders(folders);
        ctx.caches._versionsCache = null;
        ctx.caches._versionsCacheTime = 0;
        sendJSON(res, {
          success: true,
          folder: { path: afPath, name: folderName },
          versions: scannedVersions.map((v) => ({
            id: v.id,
            type: v.type,
            isFabric: v.isFabric,
            isForge: v.isForge,
            isNeoForge: v.isNeoForge
          }))
        });
      } catch (e) {
        console.error('[ExternalFolder] 添加失败:', e.message);
        sendJSON(res, { success: false, error: e.message });
      }
    });

    /* /api/version/remove-folder - 移除外部 Minecraft 文件夹 */
    registerRoute('POST', '/api/version/remove-folder', async (req, res, parsedUrl) => {
      const rfData = await readBody(req);
      const rfPath = rfData.path;
      if (!rfPath) { sendError(res, 'Missing path', 400); return; }
      try {
        let folders = versions.loadExternalFolders();
        const before = folders.length;
        folders = folders.filter((f) => f.path !== rfPath);
        if (folders.length === before) {
          sendJSON(res, { success: false, error: '未找到该外部文件夹' });
          return;
        }
        versions.saveExternalFolders(folders);
        ctx.caches._versionsCache = null;
        ctx.caches._versionsCacheTime = 0;
        sendJSON(res, { success: true });
      } catch (e) { sendJSON(res, { success: false, error: e.message }); }
    });

    /* /api/version/list-folders - 列出所有外部文件夹及版本数 */
    registerRoute('GET', '/api/version/list-folders', async (req, res, parsedUrl) => {
      try {
        const folders = versions.loadExternalFolders();
        const result = folders.map((f) => {
          const exists = fs.existsSync(f.path);
          let versionCount = 0;
          if (exists) {
            const vDir = path.join(f.path, 'versions');
            if (fs.existsSync(vDir)) {
              versionCount = fs.readdirSync(vDir).filter((d) => {
                const subDir = path.join(vDir, d);
                return fs.statSync(subDir).isDirectory() && fs.existsSync(path.join(subDir, d + '.json'));
              }).length;
            }
          }
          return { ...f, exists, versionCount };
        });
        sendJSON(res, { success: true, folders: result });
      } catch (e) { sendJSON(res, { success: false, error: e.message }); }
    });

    /* /api/version/select-folder - 弹出系统对话框选择 Minecraft 文件夹 */
    registerRoute('GET', '/api/version/select-folder', async (req, res, parsedUrl) => {
      try {
        const { dialog, BrowserWindow: BW } = require('electron');
        const win = BW.getAllWindows()[0] || null;
        const result = await dialog.showOpenDialog(win, {
          properties: ['openDirectory'],
          title: '选择 Minecraft 文件夹'
        });
        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
          sendJSON(res, { success: false, cancelled: true });
          return;
        }
        const selectedPath = result.filePaths[0];
        sendJSON(res, { success: true, path: selectedPath });
      } catch (e) { sendJSON(res, { success: false, error: e.message }); }
    });

    /* /api/version/set-active-folder - 切换当前激活的游戏文件夹
       切换后所有下载/安装/修复操作都针对该文件夹；传 folderPath 为空则恢复默认文件夹 */
    registerRoute('POST', '/api/version/set-active-folder', async (req, res, parsedUrl) => {
      try {
        const saData = await readBody(req);
        const folderPath = saData.folderPath || '';
        // 安全检查：有进行中的安装/下载任务时拒绝切换，避免目录中途变更导致文件错位
        const activeInstalls = ctx.sessions.installSessions.size;
        const activeModDl = ctx.sessions.modDownloadSessions.size;
        const activeRepair = ctx.sessions.repairSessions.size;
        if (activeInstalls > 0 || activeModDl > 0 || activeRepair > 0) {
          sendJSON(res, {
            success: false,
            error: `有${activeInstalls + activeModDl + activeRepair}个任务正在进行中，请等待完成后再切换文件夹`
          });
          return;
        }
        // 空路径或 '__internal' 表示恢复默认文件夹
        if (!folderPath || folderPath === '__internal') {
          ctx.setActiveGameRoot(null);
          sendJSON(res, { success: true, activeRoot: ctx.dirs.DATA_DIR, isDefault: true });
          return;
        }
        // 校验外部文件夹路径
        if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
          sendJSON(res, { success: false, error: '文件夹不存在或不是有效目录' });
          return;
        }
        ctx.setActiveGameRoot(folderPath);
        sendJSON(res, { success: true, activeRoot: folderPath, isDefault: false });
      } catch (e) {
        console.error('[SetActiveFolder] 切换失败:', e.message);
        sendJSON(res, { success: false, error: e.message });
      }
    });

    /* /api/version/get-active-folder - 获取当前激活的游戏文件夹 */
    registerRoute('GET', '/api/version/get-active-folder', async (req, res, parsedUrl) => {
      try {
        const activeRoot = ctx.dirs.ACTIVE_GAME_ROOT || ctx.dirs.DATA_DIR;
        const isDefault = activeRoot === ctx.dirs.DATA_DIR;
        sendJSON(res, { success: true, activeRoot, isDefault });
      } catch (e) {
        sendJSON(res, { success: false, error: e.message });
      }
    });

    /* /api/version/export-info - 获取导出整合包所需的信息（资源包/模组/存档数量与描述） */
    registerRoute('GET', '/api/version/export-info', async (req, res, parsedUrl) => {
      const eiVersionId = parsedUrl.query.versionId;
      if (!eiVersionId) { sendError(res, 'Missing versionId', 400); return; }
      try {
        const cleanEiId = eiVersionId.replace(/ \[外部\d*\]/, '');
        const eiDir = versions.getVersionGameDir(eiVersionId) || path.join(ctx.dirs.VERSIONS_DIR, cleanEiId);

        const resourcePacks = [];
        const rpDir = path.join(eiDir, 'resourcepacks');
        if (fs.existsSync(rpDir)) {
          resourcePacks.push(...fs.readdirSync(rpDir).filter((f) => f.endsWith('.zip')).sort());
        }

        let modCount = 0;
        const modDir = path.join(eiDir, 'mods');
        if (fs.existsSync(modDir)) {
          modCount = fs.readdirSync(modDir).filter((f) => f.endsWith('.jar') || f.endsWith('.zip')).length;
        }

        let savesCount = 0;
        const saves = [];
        const savesDir = path.join(eiDir, 'saves');
        if (fs.existsSync(savesDir)) {
          const saveDirs = fs.readdirSync(savesDir).filter((d) => {
            const sd = path.join(savesDir, d);
            return fs.statSync(sd).isDirectory() && fs.existsSync(path.join(sd, 'level.dat'));
          });
          savesCount = saveDirs.length;
          saves.push(...saveDirs.sort().slice(0, 20));
        }

        // 构造游戏描述：基版本 + 加载器版本
        let gameDesc = cleanEiId;
        const jsonPath = path.join(eiDir, cleanEiId + '.json');
        if (fs.existsSync(jsonPath)) {
          try {
            const vj = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            if (vj.inheritsFrom) gameDesc = vj.inheritsFrom;
            if (vj.libraries) {
              for (const lib of vj.libraries) {
                if (lib.name && lib.name.startsWith('net.fabricmc')) {
                  const parts = lib.name.split(':');
                  if (parts.length >= 3) gameDesc += ` + Fabric ${parts[2]}`;
                  break;
                }
                if (lib.name && lib.name.startsWith('net.neoforged')) {
                  const parts = lib.name.split(':');
                  if (parts.length >= 3) gameDesc += ` + NeoForge ${parts[2]}`;
                  break;
                }
                if (lib.name && lib.name.startsWith('net.minecraftforge')) {
                  const parts = lib.name.split(':');
                  if (parts.length >= 3) gameDesc += ` + Forge ${parts[2]}`;
                  break;
                }
              }
            }
          } catch (e) {}
        }

        sendJSON(res, {
          gameDesc,
          resourcePacks,
          modCount,
          savesCount,
          saves
        });
      } catch (e) { sendJSON(res, { gameDesc: '', resourcePacks: [], modCount: 0, savesCount: 0, saves: [] }); }
    });

    /* /api/version/export-modpack - 导出 Modrinth 格式整合包（.mrpack） */
    registerRoute('POST', '/api/version/export-modpack', async (req, res, parsedUrl) => {
      const body8 = await readBody(req);
      const { versionId: emId, name: emName, version: emVer, author: emAuthor, description: emDesc, selectedKeys } = body8;
      if (!emId || !emName) { sendError(res, 'Missing params', 400); return; }
      try {
        const AdmZip = require('adm-zip');
        const zip = new AdmZip();

        const exportDir = path.join(ctx.dirs.APP_DATA_PATH || ctx.dirs.DATA_DIR, 'exports');
        if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

        const cleanEmId = emId.replace(/ \[外部\d*\]/, '');
        const srcDir = versions.getVersionGameDir(emId) || path.join(ctx.dirs.VERSIONS_DIR, cleanEmId);

        if (!fs.existsSync(srcDir)) {
          sendJSON(res, { success: false, error: '版本目录不存在: ' + srcDir });
          return;
        }

        // 构建 modrinth.index.json
        const modrinthIndex = {
          formatVersion: 1,
          game: 'minecraft',
          versionId: emVer || '1.0.0',
          name: emName,
          summary: emDesc || '',
          files: [],
          dependencies: { minecraft: cleanEmId }
        };

        // 从版本 JSON 解析加载器依赖
        const versionJsonPath = path.join(srcDir, cleanEmId + '.json');
        if (fs.existsSync(versionJsonPath)) {
          try {
            const vj = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
            if (vj.inheritsFrom) modrinthIndex.dependencies.minecraft = vj.inheritsFrom;
            if (vj.libraries) {
              for (const lib of vj.libraries) {
                if (lib.name) {
                  const parts = lib.name.split(':');
                  if (parts.length >= 3) {
                    const loaderId = parts[1];
                    if (loaderId === 'fabric' || loaderId === 'fabric-loader') {
                      modrinthIndex.dependencies['fabric-loader'] = parts[2];
                      break;
                    } else if (loaderId === 'quilt-loader') {
                      modrinthIndex.dependencies['quilt-loader'] = parts[2];
                      break;
                    } else if (loaderId === 'forge' || loaderId === 'fmlloader') {
                      modrinthIndex.dependencies.forge = parts[2];
                      break;
                    } else if (loaderId === 'neoforge') {
                      modrinthIndex.dependencies.neoforge = parts[2];
                      break;
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.error('[Export] Failed to parse version json:', e);
          }
        }

        const addFileToZip = (filePath, zipPath) => {
          if (fs.existsSync(filePath)) {
            zip.addLocalFile(filePath, zipPath);
          }
        };

        const addDirToZip = (dirPath, zipPath) => {
          if (fs.existsSync(dirPath)) {
            zip.addLocalFolder(dirPath, zipPath);
          }
        };

        // 按用户勾选项打包对应目录
        if (selectedKeys && selectedKeys.length > 0) {
          if (selectedKeys.includes('game')) {
            if (selectedKeys.includes('game_settings')) {
              addFileToZip(path.join(srcDir, 'options.txt'), 'overrides');
            }
            if (selectedKeys.includes('servers')) {
              addFileToZip(path.join(srcDir, 'servers.dat'), 'overrides');
            }
          }

          if (selectedKeys.includes('mod_files')) {
            const modsDir = path.join(srcDir, 'mods');
            if (fs.existsSync(modsDir)) {
              const modFiles = fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar') || f.endsWith('.zip') || f.endsWith('.jar.disabled'));
              modFiles.forEach((f) => {
                addFileToZip(path.join(modsDir, f), 'overrides/mods');
              });
            }
          }

          if (selectedKeys.includes('mod_configs')) {
            addDirToZip(path.join(srcDir, 'config'), 'overrides/config');
          }

          if (selectedKeys.includes('resourcepacks')) {
            addDirToZip(path.join(srcDir, 'resourcepacks'), 'overrides/resourcepacks');
          }

          if (selectedKeys.includes('shaderpacks')) {
            addDirToZip(path.join(srcDir, 'shaderpacks'), 'overrides/shaderpacks');
          }

          if (selectedKeys.includes('saves')) {
            addDirToZip(path.join(srcDir, 'saves'), 'overrides/saves');
          }

          if (selectedKeys.includes('screenshots')) {
            addDirToZip(path.join(srcDir, 'screenshots'), 'overrides/screenshots');
          }

          if (selectedKeys.includes('defaultconfigs')) {
            addDirToZip(path.join(srcDir, 'defaultconfigs'), 'overrides/defaultconfigs');
          }

          if (selectedKeys.includes('kubejs')) {
            addDirToZip(path.join(srcDir, 'kubejs'), 'overrides/kubejs');
          }

          if (selectedKeys.includes('journeymap')) {
            addDirToZip(path.join(srcDir, 'journeymap'), 'overrides/journeymap');
          }

          if (selectedKeys.includes('waystones')) {
            addDirToZip(path.join(srcDir, 'waystones'), 'overrides/waystones');
          }
        }

        zip.addFile('modrinth.index.json', Buffer.from(JSON.stringify(modrinthIndex, null, 2)));

        const zipPath = path.join(exportDir, `${emName.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_')}.mrpack`);
        zip.writeZip(zipPath);

        sendJSON(res, { success: true, path: zipPath });
      } catch (e) {
        console.error('[Export] Error:', e);
        sendJSON(res, { success: false, error: e.message });
      }
    });

    /* /api/version/repair - 同步修复缺失的库文件与客户端 jar */
    registerRoute('POST', '/api/version/repair', async (req, res, parsedUrl) => {
      const rpData = await readBody(req);
      const rpVersionId = rpData.versionId;
      if (!rpVersionId) { sendError(res, 'Missing versionId', 400); return; }

      try {
        const versionJson = versions.resolveVersionJson(rpVersionId);
        if (!versionJson) { sendError(res, '版本JSON文件缺失', 400); return; }

        let repaired = 0;
        for (const lib of (versionJson.libraries || [])) {
          const libNameSuffix = lib.name ? lib.name.split(':').pop() : '';
          if (libNameSuffix.startsWith('natives-')) continue;
          if (lib.rules && !versions.evaluateRules(lib.rules)) continue;
          if (lib.downloads?.artifact?.url) {
            const libPath = path.join(ctx.dirs.LIBRARIES_DIR, lib.downloads.artifact.path);
            if (!fs.existsSync(libPath)) {
              try {
                await http.downloadFile(lib.downloads.artifact.url, libPath);
                repaired++;
              } catch (e) {}
            }
          }
        }

        // 补齐客户端 jar
        if (versionJson.downloads?.client?.url) {
          const jarPath = path.join(ctx.dirs.VERSIONS_DIR, rpVersionId, `${rpVersionId}.jar`);
          if (!fs.existsSync(jarPath)) {
            await http.downloadFile(versionJson.downloads.client.url, jarPath);
            repaired++;
          }
        }

        sendJSON(res, { success: true, repaired });
      } catch (e) {
        sendError(res, '修复失败: ' + e.message);
      }
    });

    /* /api/version/cleanup - 清理版本的 natives/logs/crash-reports 临时目录 */
    registerRoute('GET', '/api/version/cleanup', async (req, res, parsedUrl) => {
      const clVersionId = parsedUrl.query.versionId;
      if (!clVersionId) { sendError(res, 'Missing versionId', 400); return; }

      try {
        let freedSpace = 0;
        const nativesDir = path.join(ctx.dirs.VERSIONS_DIR, clVersionId, 'natives');
        if (fs.existsSync(nativesDir)) {
          const size = utils.getDirSize(nativesDir);
          fs.rmSync(nativesDir, { recursive: true, force: true });
          freedSpace += size;
        }

        const logFiles = path.join(ctx.dirs.VERSIONS_DIR, clVersionId, 'logs');
        if (fs.existsSync(logFiles)) {
          const size = utils.getDirSize(logFiles);
          fs.rmSync(logFiles, { recursive: true, force: true });
          freedSpace += size;
        }

        const crashReports = path.join(ctx.dirs.VERSIONS_DIR, clVersionId, 'crash-reports');
        if (fs.existsSync(crashReports)) {
          const size = utils.getDirSize(crashReports);
          fs.rmSync(crashReports, { recursive: true, force: true });
          freedSpace += size;
        }

        sendJSON(res, { success: true, freedSpace: utils.formatSize(freedSpace) });
      } catch (e) {
        sendError(res, '清理失败: ' + e.message);
      }
    });

    /* /api/version/diagnose - 诊断版本完整性 */
    registerRoute('GET', '/api/version/diagnose', async (req, res, parsedUrl) => {
      const diagVersionId = parsedUrl.query.versionId;
      if (!diagVersionId) { sendError(res, 'Missing versionId', 400); return; }
      try {
        const diagResult = diagnose.diagnoseVersion(diagVersionId);
        sendJSON(res, diagResult);
      } catch (e) {
        sendError(res, '诊断失败: ' + e.message);
      }
    });

    /* /api/version-icon - 获取版本图标（优先自定义图标，回退到方块图标） */
    registerRoute('GET', '/api/version-icon', async (req, res, parsedUrl) => {
      const versionId = parsedUrl.query.id || '';
      if (!versionId) { sendError(res, 'Missing id', 400); return; }

      const cacheKey = `${versionId}_${parsedUrl.query.type || 'release'}_${parsedUrl.query.forge || ''}_${parsedUrl.query.fabric || ''}_${parsedUrl.query.neoforge || ''}_${parsedUrl.query.modpack || ''}_${parsedUrl.query.ext || ''}`;
      const cached = ctx.caches.VERSION_ICON_CACHE.get(cacheKey);
      if (cached && Date.now() - cached.time < ctx.caches.VERSION_ICON_CACHE_DURATION) {
        res.writeHead(200, {
          'Content-Type': cached.mime || 'image/png',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-VersionIcon-Cache': 'hit'
        });
        res.end(cached.data);
        return;
      }

      try {
        const cleanId = versionId.replace(/ \[外部\d*\]/, '');
        let customIconData = null;
        let customIconMime = 'image/png';

        const iconFileNames = ['icon.png', 'pack.png', 'logo.png'];
        const pclLogoPath = 'PCL/Logo.png';

        // 在指定目录中查找图标文件
        function _tryFindIcon(dir) {
          if (!dir || !fs.existsSync(dir)) return null;
          const pclLogo = path.join(dir, pclLogoPath);
          if (fs.existsSync(pclLogo)) {
            try { return { data: fs.readFileSync(pclLogo), mime: 'image/png' }; } catch (e) {}
          }
          for (const fn of iconFileNames) {
            const fp = path.join(dir, fn);
            if (fs.existsSync(fp)) {
              try {
                const data = fs.readFileSync(fp);
                if (fn.endsWith('.png')) return { data, mime: 'image/png' };
                if (fn.endsWith('.jpg') || fn.endsWith('.jpeg')) return { data, mime: 'image/jpeg' };
                return { data, mime: 'image/png' };
              } catch (e) {}
            }
          }
          return null;
        }

        // 查找顺序：版本目录 -> 外部目录 -> .minecraft/versions
        const internalDir = path.join(ctx.dirs.VERSIONS_DIR, cleanId);
        customIconData = _tryFindIcon(internalDir);

        if (!customIconData && parsedUrl.query.extDir) {
          customIconData = _tryFindIcon(parsedUrl.query.extDir);
          if (!customIconData) {
            const extRoot = path.dirname(path.dirname(parsedUrl.query.extDir));
            customIconData = _tryFindIcon(extRoot);
          }
        }

        if (!customIconData) {
          const mcVersionsDir = path.join(ctx.dirs.MINECRAFT_DIR, 'versions', cleanId);
          customIconData = _tryFindIcon(mcVersionsDir);
        }

        // 本地无图标时，尝试在线获取整合包封面图标并缓存到版本目录
        if (!customIconData) {
          try {
            const packInfoPath = path.join(ctx.dirs.VERSIONS_DIR, cleanId, 'pack-info.json');
            if (fs.existsSync(packInfoPath)) {
              const packInfo = JSON.parse(fs.readFileSync(packInfoPath, 'utf8'));
              const https = require('https');
              // 优先用 pack-info.json 中记录的图标 URL 直接下载（下载整合包时已保存）
              let iconUrl = '';
              if (packInfo.iconUrl) {
                iconUrl = packInfo.iconUrl;
              } else {
                // 无图标 URL 时，用整合包名称搜 Modrinth 获取图标（导入本地整合包的场景）
                const packName = packInfo.name || cleanId;
                const modrinthApi = (ctx.urls && ctx.urls.MODRINTH_API) || 'https://api.modrinth.com/v2';
                const searchUrl = `${modrinthApi}/search?query=${encodeURIComponent(packName)}&facets=${JSON.stringify([["project_type:modpack"]])}&limit=1`;
                const searchResult = await new Promise((resolve) => {
                  const r = https.get(searchUrl, { timeout: 8000 }, (resp) => {
                    let data = '';
                    resp.on('data', (chunk) => data += chunk);
                    resp.on('end', () => {
                      try { resolve(JSON.parse(data)); } catch (_) { resolve(null); }
                    });
                  });
                  r.on('error', () => resolve(null));
                  r.on('timeout', () => { r.destroy(); resolve(null); });
                });
                iconUrl = searchResult && searchResult.hits && searchResult.hits[0] && searchResult.hits[0].icon;
              }
              if (iconUrl) {
                const iconData = await new Promise((resolve) => {
                  const r = https.get(iconUrl, { timeout: 10000 }, (resp) => {
                    if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
                      https.get(resp.headers.location, { timeout: 10000 }, (r2) => {
                        const chunks = [];
                        r2.on('data', (c) => chunks.push(c));
                        r2.on('end', () => resolve(Buffer.concat(chunks)));
                      }).on('error', () => resolve(null)).on('timeout', function () { this.destroy(); resolve(null); });
                      return;
                    }
                    const chunks = [];
                    resp.on('data', (chunk) => chunks.push(chunk));
                    resp.on('end', () => resolve(Buffer.concat(chunks)));
                  });
                  r.on('error', () => resolve(null));
                  r.on('timeout', () => { r.destroy(); resolve(null); });
                });
                if (iconData && iconData.length > 0) {
                  const destIconPath = path.join(ctx.dirs.VERSIONS_DIR, cleanId, 'icon.png');
                  try { fs.writeFileSync(destIconPath, iconData); } catch (_) {}
                  customIconData = { data: iconData, mime: 'image/png' };
                }
              }
            }
          } catch (_) {}
        }

        if (customIconData) {
          ctx.caches.VERSION_ICON_CACHE.set(cacheKey, { data: customIconData.data, mime: customIconData.mime, time: Date.now() });
          res.writeHead(200, {
            'Content-Type': customIconData.mime,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-VersionIcon-Custom': 'true'
          });
          res.end(customIconData.data);
          return;
        }

        // 无自定义图标时，根据版本类型/加载器选择方块图标
        const blockIconMap = {
          'snapshot': 'CommandBlock.png',
          'release': 'Grass.png',
          'special': 'GoldBlock.png',
          'old_beta': 'CobbleStone.png',
          'old_alpha': 'CobbleStone.png'
        };
        const versionType = parsedUrl.query.type || 'release';
        const isForge = parsedUrl.query.forge === 'true';
        const isFabric = parsedUrl.query.fabric === 'true';
        const isNeoForge = parsedUrl.query.neoforge === 'true';
        const isModpack = parsedUrl.query.modpack === 'true';
        let blockFile = blockIconMap[versionType] || 'Grass.png';

        if (isModpack && !isForge && !isFabric && !isNeoForge) blockFile = 'Anvil.png';
        else if (isNeoForge) blockFile = 'NeoForge.png';
        else if (isForge) blockFile = 'CommandBlock.png';
        else if (isFabric) blockFile = 'Fabric.png';

        const blockPath = path.join(__dirname, '..', '..', '..', 'img', blockFile);
        if (fs.existsSync(blockPath)) {
          const iconData = fs.readFileSync(blockPath);
          ctx.caches.VERSION_ICON_CACHE.set(cacheKey, { data: iconData, mime: 'image/png', time: Date.now() });
          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          });
          res.end(iconData);
        } else {
          res.writeHead(302, { Location: '/img/Grass.png' });
          res.end();
        }
      } catch (e) {
        res.writeHead(302, { Location: '/img/Grass.png' });
        res.end();
      }
    });

    /* /api/delete-version - 删除版本（带路径校验与多重删除重试） */
    registerRoute('POST', '/api/delete-version', async (req, res, parsedUrl) => {
      const data = await readBody(req);
      const versionId = data.versionId;
      const dvPermanent = !!data.permanent;
      if (!versionId) { sendError(res, 'Missing versionId', 400); return; }
      // 路径安全校验：禁止包含路径分隔符或以点开头
      if (!versionId || /[\\/]|^\./.test(versionId)) { sendError(res, 'Invalid versionId', 400); return; }
      const versionDir = path.join(ctx.dirs.VERSIONS_DIR, versionId);
      const resolvedVersionDir = path.resolve(versionDir);
      if (!resolvedVersionDir.startsWith(path.resolve(ctx.dirs.VERSIONS_DIR))) { sendError(res, 'Invalid versionId path', 400); return; }
      if (fs.existsSync(versionDir)) {
        let ok = false;
        if (dvPermanent) {
          // 永久删除：最多重试 5 次，依次尝试 rmSync/rmdir/逐文件删除
          for (let i = 0; i < 5; i++) {
            try { fs.rmSync(versionDir, { recursive: true, force: true }); ok = true; break; } catch (e) {
              try { execSync(`rmdir /s /q "${versionDir}"`, { timeout: 10000, windowsHide: true }); ok = true; break; } catch (_) {}
              try {
                const 残留 = fs.readdirSync(versionDir);
                for (const f of 残留) { try { fs.unlinkSync(path.join(versionDir, f)); } catch (_) {} }
                if (fs.existsSync(versionDir)) fs.rmSync(versionDir, { recursive: true, force: true });
                ok = true; break;
              } catch (_) {}
              if (i < 4) try { execSync('ping -n 1 127.0.0.1 >nul 2>&1', { timeout: 1000 }); } catch (_e) {}
            }
          }
        } else if (process.platform !== 'win32') {
          // 非 Windows 平台没有系统回收站接口，直接强制删除
          try {
            fs.rmSync(versionDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
            ok = true;
          } catch (_) {}
        } else {
          // 回收站模式：优先 recycle-bin，回退到 PowerShell VisualBasic
          try {
            try {
              const recycleBin = require('recycle-bin');
              await recycleBin(versionDir);
              ok = true;
            } catch (_) {
              const { execSync: execSyncLocal } = require('child_process');
              const escapedDir = versionDir.replace(/'/g, "''");
              execSyncLocal(`powershell -Command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory('${escapedDir}', 'OnlyErrorDialogs', 'SendToRecycleBin')"`, { timeout: 30000, stdio: 'pipe' });
              ok = true;
            }
          } catch (e) {
            try {
              fs.rmSync(versionDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
              ok = true;
            } catch (_) {}
          }
        }
        // 删除后仍存在：再次强制清理
        if (ok && fs.existsSync(versionDir)) {
          console.error(`[delete-version] 删除操作后文件夹仍存在: ${versionDir}`);
          try { fs.rmSync(versionDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 }); } catch (_) {}
          if (fs.existsSync(versionDir)) {
            try { execSync(`rmdir /s /q "${versionDir}"`, { timeout: 10000, windowsHide: true }); } catch (_) {}
          }
          if (fs.existsSync(versionDir)) { ok = false; }
        }
        ctx.caches._versionsCache = null;
        ctx.caches._versionsCacheTime = 0;
        if (ok) {
          sendJSON(res, { success: true, message: `Version ${versionId} deleted`, permanent: dvPermanent });
        } else {
          sendJSON(res, { success: false, error: '删除失败，文件可能被其他进程占用', permanent: dvPermanent });
        }
      } else {
        sendError(res, 'Version not found', 404);
      }
    });

    /* /api/check-version-name - 检查版本名是否已存在 */
    registerRoute('POST', '/api/check-version-name', async (req, res, parsedUrl) => {
      const checkData = await readBody(req);
      const checkName = checkData.name || '';
      if (!checkName) { sendJSON(res, { exists: false }); return; }
      const existing = versions.getInstalledVersions();
      const nameExists = existing.some((v) => v.id === checkName) || fs.existsSync(path.join(ctx.dirs.VERSIONS_DIR, checkName));
      sendJSON(res, { exists: nameExists });
    });

    /* /api/install-start - 启动版本安装会话（异步执行，返回 sessionId） */
    registerRoute('POST', '/api/install-start', async (req, res, parsedUrl) => {
      const data = await readBody(req);
      const versionUrl = data.url;
      let versionId = data.versionId;
      const loaderInfo = data.loaderInfo;
      const downloadSource = data.downloadSource || 'china-first';
      const customName = data.customName || '';
      const targetFolder = data.targetFolder || '';
      if (!versionUrl) { sendError(res, 'Missing version URL', 400); return; }

      const sessionId = crypto.randomUUID();
      let details = await versions.getVersionDetails(versionUrl);

      // 处理加载器版本：修改 details.id 与 inheritsFrom
      if (loaderInfo && loaderInfo.type && loaderInfo.version) {
        const loaderSuffix = loaderInfo.type === 'neoforge' ? 'NeoForge' :
                            loaderInfo.type.charAt(0).toUpperCase() + loaderInfo.type.slice(1);
        const defaultName = `${details.id}-${loaderSuffix}-${loaderInfo.version}`;
        const finalVersionId = customName || defaultName;

        details = JSON.parse(JSON.stringify(details));
        details.id = finalVersionId;
        details.inheritsFrom = data.versionId;
        versionId = finalVersionId;
      } else {
        if (customName) {
          details = JSON.parse(JSON.stringify(details));
          details.id = customName;
          versionId = customName;
        }
      }

      ctx.sessions.installSessions.set(sessionId, {
        versionId: details.id, status: 'preparing', progress: 0, stage: 'preparing',
        message: '准备安装...', startTime: Date.now(), lastActivity: Date.now(), details, errors: [],
        loaderInfo, downloadSource,
        _abortController: new AbortController()
      });
      sendJSON(res, { success: true, sessionId, versionId: details.id });

      // 如果指定了目标文件夹，临时切换工作目录，安装完成后恢复
      const needSwitch = targetFolder && targetFolder !== '__internal' && targetFolder !== ctx.dirs.DATA_DIR;
      const prevRoot = ctx.dirs.ACTIVE_GAME_ROOT;
      const restoreRoot = () => {
        if (needSwitch) {
          ctx.setActiveGameRoot(prevRoot === ctx.dirs.DATA_DIR ? null : prevRoot);
        }
      };
      if (needSwitch) {
        ctx.setActiveGameRoot(targetFolder);
      }
      _server().performInstallation(sessionId, details).then(() => {
        restoreRoot();
      }).catch((err) => {
        restoreRoot();
        const session = ctx.sessions.installSessions.get(sessionId);
        if (session) { session.status = 'failed'; session.stage = 'failed'; session.message = `安装失败: ${err.message}`; session.errors.push(err.message); }
      });
    });

    /* /api/install-progress - 安装进度查询/推送（支持 SSE 实时流） */
    registerRoute('GET', '/api/install-progress', async (req, res, parsedUrl) => {
      const sessionId = parsedUrl.query.sessionId;
      if (!sessionId || !ctx.sessions.installSessions.has(sessionId)) { sendError(res, 'Invalid session ID', 404); return; }
      const session = ctx.sessions.installSessions.get(sessionId);

      if (parsedUrl.query.sse === 'true') {
        // SSE 模式：每 300ms 推送进度，完成/失败后延迟 60s 清理会话
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        const interval = setInterval(() => {
          const s = ctx.sessions.installSessions.get(sessionId);
          if (!s) { clearInterval(interval); res.end(); return; }
          s.lastActivity = Date.now();
          res.write(`data: ${JSON.stringify({
            sessionId, versionId: s.versionId, status: s.status, progress: s.progress,
            stage: s.stage, message: s.message, currentFile: s.currentFile || '',
            totalFiles: s.totalFiles || 0, completedFiles: s.completedFiles || 0,
            speed: s.speed || 0, bytesDownloaded: s.bytesDownloaded || 0,
            totalBytes: s.totalBytes || 0, errors: s.errors || []
          })}\n\n`);
          if (s.status === 'completed' || s.status === 'failed') {
            clearInterval(interval);
            setTimeout(() => ctx.sessions.installSessions.delete(sessionId), 60000);
            res.end();
          }
        }, 300);
        req.on('close', () => clearInterval(interval));
      } else {
        session.lastActivity = Date.now();
        sendJSON(res, {
          sessionId, versionId: session.versionId, status: session.status, progress: session.progress,
          stage: session.stage, message: session.message, currentFile: session.currentFile || '',
          totalFiles: session.totalFiles || 0, completedFiles: session.completedFiles || 0,
          speed: session.speed || 0, bytesDownloaded: session.bytesDownloaded || 0,
          totalBytes: session.totalBytes || 0, errors: session.errors || []
        });
      }
    });

    /* /api/install-cancel - 取消安装/下载会话（同时支持 GET / POST） */
    const handleInstallCancel = async (req, res, parsedUrl) => {
      const sessionId = parsedUrl.query.sessionId;
      if (!sessionId) { sendError(res, 'Missing session ID', 400); return; }

      // 按会话类型分派取消逻辑
      if (ctx.sessions.installSessions.has(sessionId)) {
        const session = ctx.sessions.installSessions.get(sessionId);
        session.status = 'cancelled'; session.stage = 'cancelled'; session.message = '安装已取消';
        if (session._abortController) { try { session._abortController.abort(); } catch (e) {} }
        sendJSON(res, { success: true });
        // 清理半成品安装目录
        if (session.versionId) {
          const vd = path.join(ctx.dirs.VERSIONS_DIR, session.versionId);
          fs.promises.rm(vd, { recursive: true, force: true }).then(() => {
          }).catch(() => {});
        }
      } else if (ctx.sessions.modDownloadSessions.has(sessionId)) {
        const session = ctx.sessions.modDownloadSessions.get(sessionId);
        session.status = 'cancelled'; session.message = '下载已取消';
        if (session._abortController) { try { session._abortController.abort(); } catch (e) {} }
        sendJSON(res, { success: true });
      } else if (ctx.sessions.customDownloadSessions.has(sessionId)) {
        const session = ctx.sessions.customDownloadSessions.get(sessionId);
        session.status = 'cancelled'; session.message = '下载已取消';
        if (session.abortController) { try { session.abortController.abort(); } catch (e) {} }
        sendJSON(res, { success: true });
      } else if (ctx.sessions.javaDownloadAbortControllers.has(sessionId)) {
        const controller = ctx.sessions.javaDownloadAbortControllers.get(sessionId);
        controller.abort();
        ctx.sessions.javaDownloadAbortControllers.delete(sessionId);
        // 更新 Java 下载状态文件
        const javaFile = path.join(ctx.dirs.DATA_DIR, `java-download-${sessionId}.json`);
        if (fs.existsSync(javaFile)) {
          try {
            const st = JSON.parse(fs.readFileSync(javaFile, 'utf-8'));
            if (st.status !== 'completed' && st.status !== 'error' && st.status !== 'cancelled') {
              st.status = 'cancelled'; st.message = '下载已取消';
              fs.writeFileSync(javaFile, JSON.stringify(st));
            }
          } catch (e) {}
        }
        sendJSON(res, { success: true });
      } else {
        sendError(res, 'Invalid session ID', 404);
      }
    };
    registerRoute('GET', '/api/install-cancel', handleInstallCancel);
    registerRoute('POST', '/api/install-cancel', handleInstallCancel);
  }
};
