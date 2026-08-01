/**
 * @file server/api/routes/launch.js
 * @description 启动相关路由 - 从 server.js handleAPI switch 语句抽取的启动、取消、依赖下载、诊断、参数预览端点
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

let _serverModule = null;
// 懒加载 server 模块，避免循环依赖
function _server() {
  if (_serverModule === null) {
    try { _serverModule = require('../../../server'); } catch (_) { _serverModule = {}; }
  }
  return _serverModule;
}

module.exports = {
  /**
   * 注册启动相关路由
   * @param {Function} registerRoute - 路由注册函数
   * @param {Object} deps - 依赖对象（ctx/sendJSON/sendError/readBody/versions/launch/diagnose/modloaders/accounts/utils/http/java/dependencies）
   * @returns {void}
   */
  register(registerRoute, deps) {
    const { ctx, sendJSON, sendError, readBody } = deps;
    const { versions, launch, diagnose, modloaders, accounts, utils, http, java, dependencies } = deps;

    /* /api/launch - 启动游戏（含启动设置读取、微软令牌刷新、游戏时长记录） */
    registerRoute('POST', '/api/launch', async (req, res, parsedUrl) => {
      // 全局启动锁，防止短时间内重复触发启动
      if (global._versepc_launching) {
        sendJSON(res, { success: false, error: '正在启动中，请稍候' });
        return;
      }
      global._versepc_launching = true;
      setTimeout(() => { global._versepc_launching = false; }, 30000);

      const data = await readBody(req);
      const versionId = data.versionId;
      if (!versionId) { sendError(res, 'Missing versionId', 400); global._versepc_launching = false; return; }
      const settings = versions.loadSettingsCached();
      const logger = require('../../logger').createLogger('Launch');
      logger.info(`设置: 全局默认 fullscreen=${settings.fullscreen}, resolution=${settings.resolution}`);

      // 读取前端 store 中的启动设置（窗口大小、全屏、自定义信息、窗口标题），覆盖全局设置
      try {
        const storePath = path.join(ctx.dirs.DATA_DIR, 'app-store.json');
        if (fs.existsSync(storePath)) {
          const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
          const launchStr = store['versepc_launch_settings'];
          if (launchStr) {
            const lsData = JSON.parse(launchStr);
            logger.info(`store 读取: windowSize=${lsData.windowSize}, fullscreen=${lsData.fullscreen}`);
            if (lsData.windowSize) {
              if (lsData.windowSize === 'default') {
                settings.resolution = '854x480';
              } else {
                settings.resolution = lsData.windowSize;
              }
            }
            if (typeof lsData.fullscreen === 'boolean') {
              settings.fullscreen = lsData.fullscreen;
            }
            if (lsData.customInfo) {
              settings.customInfo = lsData.customInfo;
            }
            if (lsData.windowTitle) {
              settings.windowTitle = lsData.windowTitle;
            }
          } else {
            logger.info(`store 中无 versepc_launch_settings`);
          }
        } else {
          logger.info(`app-store.json 不存在: ${storePath}`);
        }
      } catch (e) {
        logger.info(`读取 store 异常: ${e.message}`);
      }

      logger.info(`store 覆盖后: fullscreen=${settings.fullscreen}, resolution=${settings.resolution}`);

      // 读取版本级设置（优先级高于全局设置），覆盖自定义信息、窗口标题、全屏、分辨率、内存
      try {
        const verSettings = versions.loadVersionSettings(versionId);
        logger.info(`版本级设置: fullscreen=${verSettings.fullscreen}, resolution=${verSettings.resolution}`);
        if (verSettings.customInfo) {
          settings.customInfo = verSettings.customInfo;
        }
        if (verSettings.windowTitle) {
          settings.windowTitle = verSettings.windowTitle;
        }
        if (verSettings.fullscreen !== undefined && verSettings.fullscreen !== 'global') {
          settings.fullscreen = verSettings.fullscreen === true || verSettings.fullscreen === 'true';
        }
        if (verSettings.resolution && verSettings.resolution !== '') {
          settings.resolution = verSettings.resolution;
        }
        // 版本级内存设置优先级最高：用户为这个版本专门配置的，必须生效
        if (verSettings.memoryMode === 'custom' && verSettings.memoryValue) {
          settings.memoryMode = 'custom';
          settings.memoryValue = verSettings.memoryValue;
        } else if (verSettings.memoryMode === 'auto') {
          settings.memoryMode = 'auto';
          settings.memoryValue = null;
        }
      } catch (e) {
        logger.info(`读取版本级设置异常: ${e.message}`);
      }

      logger.info(`最终设置: fullscreen=${settings.fullscreen}, resolution=${settings.resolution}, versionId=${versionId}`);

      const acctsList = accounts.loadAccounts();
      if (acctsList.length === 0) {
        sendJSON(res, { success: false, error: '未登录，请先添加账户后再启动游戏。' });
        global._versepc_launching = false;
        return;
      }
      let account = acctsList.find((a) => a.id === settings.selectedAccount) || acctsList[0];

      // 微软账号令牌刷新流程：MS Token -> XBL Token -> XSTS Token -> MC Access Token
      // 令牌过期前 5 分钟提前刷新，失败时使用旧令牌尝试启动
      if (account.type === 'microsoft' && account.refreshToken) {
        const tokenExpiresAt = account.tokenExpiresAt || 0;
        const now = Date.now();
        const shouldRefresh = !tokenExpiresAt || now > tokenExpiresAt - 5 * 60 * 1000;
        if (shouldRefresh) {
          try {
            const tokenUrl = `https://login.microsoftonline.com/consumers/oauth2/v2.0/token`;
            const postData = `grant_type=refresh_token&client_id=${ctx.urls.MS_CLIENT_ID}&refresh_token=${encodeURIComponent(account.refreshToken)}&scope=XboxLive.signin+offline_access`;
            const msTokenResult = await new Promise((resolve, reject) => {
              const req = https.request(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
                timeout: 15000
              }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                  if (res.statusCode >= 400) {
                    try { const errBody = JSON.parse(data); resolve(errBody); } catch (e) { resolve({ error: `HTTP ${res.statusCode}` }); }
                    return;
                  }
                  try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('微软服务返回了无效的数据')); }
                });
              });
              req.on('error', (e) => reject(new Error('网络连接失败: ' + e.message)));
              req.on('timeout', () => { req.destroy(); reject(new Error('连接微软服务超时')); });
              req.write(postData);
              req.end();
            });
            if (!msTokenResult.error && msTokenResult.access_token) {
              const msAccessToken = msTokenResult.access_token;
              const msRefreshTokenNew = msTokenResult.refresh_token || account.refreshToken;
              // 步骤1：用 MS Token 换取 Xbox Live Token
              const xblResult = await http.fetchJSONWithMethod('https://user.auth.xboxlive.com/user/authenticate', 'POST', JSON.stringify({
                Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${msAccessToken}` },
                RelyingParty: 'http://auth.xboxlive.com', TokenType: 'JWT'
              }), { 'Content-Type': 'application/json' });
              const xblToken = xblResult.Token;
              const xblUhs = xblResult.DisplayClaims?.xui?.[0]?.uhs || '';
              // 步骤2：用 XBL Token 换取 XSTS Token
              const xstsResult = await http.fetchJSONWithMethod('https://xsts.auth.xboxlive.com/xsts/authorize', 'POST', JSON.stringify({
                Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
                RelyingParty: 'rp://api.minecraftservices.com/', TokenType: 'JWT'
              }), { 'Content-Type': 'application/json' });
              if (!xstsResult.XErr) {
                const xstsToken = xstsResult.Token;
                const xstsUhs = xstsResult.DisplayClaims?.xui?.[0]?.uhs || xblUhs;
                // 步骤3：用 XSTS Token 换取 Minecraft Access Token
                const mcResult = await http.fetchJSONWithMethod('https://api.minecraftservices.com/authentication/login_with_xbox', 'POST', JSON.stringify({
                  identityToken: `XBL3.0 x=${xstsUhs};${xstsToken}`
                }), { 'Content-Type': 'application/json' });
                if (mcResult.access_token) {
                  const refreshNow = new Date();
                  account.accessToken = mcResult.access_token;
                  account.refreshToken = msRefreshTokenNew;
                  account.tokenExpiresAt = refreshNow.getTime() + (msTokenResult.expires_in || 3600) * 1000;
                  account.lastRefreshed = refreshNow.toISOString();
                  // 刷新皮肤信息
                  try {
                    const refreshProfile = await http.fetchJSONWithAuth('https://api.minecraftservices.com/minecraft/profile', mcResult.access_token);
                    if (refreshProfile && refreshProfile.skins && Array.isArray(refreshProfile.skins)) {
                      const activeSkin = refreshProfile.skins.find((s) => s.state === 'ACTIVE');
                      if (activeSkin) {
                        account.skinUrl = activeSkin.url;
                        account.skinModel = activeSkin.variant === 'SLIM' ? 'slim' : 'default';
                      }
                    }
                    if (refreshProfile && refreshProfile.name) account.username = refreshProfile.name;
                  } catch (pfErr) { console.warn(`[Launch] 刷新皮肤信息失败: ${pfErr.message}`); }
                  const accts = accounts.loadAccounts();
                  const idx = accts.findIndex((a) => a.id === account.id);
                  if (idx >= 0) { accts[idx] = { ...accts[idx], ...account }; accounts.saveAccounts(accts); }
                }
              }
            } else {
              console.warn(`[Launch] 微软Token刷新失败: ${msTokenResult.error}, 使用旧Token尝试启动`);
            }
          } catch (refreshErr) {
            console.warn(`[Launch] 微软Token刷新异常: ${refreshErr.message}, 使用旧Token尝试启动`);
          }
        }
      }

      const result = await launch.launchGame(versionId, settings, account, data.checkOnly === true);
      // 启动失败时记录失败日志到 LOGS_DIR
      if (!result.success) {
        try {
          if (!fs.existsSync(ctx.dirs.LOGS_DIR)) fs.mkdirSync(ctx.dirs.LOGS_DIR, { recursive: true });
          fs.writeFileSync(path.join(ctx.dirs.LOGS_DIR, `launch-fail-${Date.now()}.json`), JSON.stringify({ versionId, result, timestamp: new Date().toISOString() }, null, 2), 'utf-8');
        } catch (_) {}
      }
      // 启动成功时记录启动时间到 play-time.json
      if (result.success) {
        try {
          const playTimePath = path.join(ctx.dirs.DATA_DIR, 'play-time.json');
          let ptData = {};
          if (fs.existsSync(playTimePath)) {
            try { ptData = JSON.parse(fs.readFileSync(playTimePath, 'utf8')); } catch (e) {}
          }
          if (!ptData[versionId]) ptData[versionId] = { totalSeconds: 0, playCount: 0, lastPlayed: null };
          ptData[versionId].lastPlayed = new Date().toISOString();
          ptData[versionId].playCount = (ptData[versionId].playCount || 0) + 1;
          ptData[versionId]._launchTime = Date.now();
          utils.ensureDir(playTimePath);
          fs.writeFileSync(playTimePath, JSON.stringify(ptData, null, 2), 'utf8');
        } catch (e) {
          console.error('[PlayTime] 记录启动时间失败:', e.message);
        }
      }
      global._versepc_launching = false;
      sendJSON(res, result);
    });

    /* /api/launch/cancel - 取消启动并清理游戏实例和启动会话 */
    registerRoute('POST', '/api/launch/cancel', async (req, res, parsedUrl) => {
      global._versepc_launching = false;
      for (const [sid, inst] of ctx.sessions.gameInstances) {
        try { inst.process.kill(); } catch (e) {}
      }
      ctx.sessions.gameInstances.clear();
      for (const [sid, sess] of ctx.sessions.launchSessions) {
        sess.status = 'cancelled';
        sess.message = '启动已取消';
      }
      ctx.sessions.launchSessions.clear();
      sendJSON(res, { success: true, message: '启动已取消' });
    });

    /* /api/launch/check - 检查版本依赖完整性（含 Java 诊断） */
    registerRoute('POST', '/api/launch/check', async (req, res, parsedUrl) => {
      const lcData = await readBody(req);
      const lcVersionId = lcData.versionId;
      if (!lcVersionId) { sendError(res, 'Missing versionId', 400); return; }
      const lcSettings = versions.loadSettingsCached();
      // 清理外部版本标记，查找外部版本目录
      const lcCleanId = lcVersionId.replace(/ \[外部\d*\]/, '');
      let lcExternalDir = null;
      const lcExtFolders = versions.loadExternalFolders();
      for (const folder of lcExtFolders) {
        if (!fs.existsSync(folder.path)) continue;
        const extVers = versions.scanExternalFolder(folder.path);
        const extV = extVers.find((v) => v.id === lcCleanId);
        if (extV) { lcExternalDir = extV.externalVersionDir; break; }
      }
      // 依赖检查前先恢复 Forge/NeoForge patched jar（安装器本地生成的文件，无法直接下载）
      try {
        const processManager = require('../../launch/process-manager');
        const lcVersionJson = versions.resolveVersionJson(lcCleanId, lcExternalDir);
        if (lcVersionJson) {
          await processManager.ensurePatchedJarIntact(lcVersionJson, lcCleanId);
        }
      } catch (e) {
        console.warn(`[Launch/check] patched jar 恢复失败: ${e.message}`);
      }

      const depResult = await dependencies.checkDependencies(lcCleanId, lcSettings, lcExternalDir);
      // 收集 Java 诊断信息：系统 Java、内置 Java
      const _javaDiag = {};
      const _sysJava = java.detectSystemJava();
      const _bunJava = java.detectBundledJava();
      _javaDiag.systemJavaCount = _sysJava.length;
      _javaDiag.bundledJavaCount = _bunJava.length;
      _javaDiag.allJava = [..._bunJava, ..._sysJava].map((j) => ({ path: j.path, major: j.majorVersion, source: j.source }));
      depResult.javaDiagnostics = _javaDiag;
      // 依赖检查异常时记录诊断日志
      if (!depResult.parentVersion.ok || !depResult.forgeCore.ok) {
        try {
          if (!fs.existsSync(ctx.dirs.LOGS_DIR)) fs.mkdirSync(ctx.dirs.LOGS_DIR, { recursive: true });
          fs.writeFileSync(path.join(ctx.dirs.LOGS_DIR, `dep-check-${Date.now()}.json`), JSON.stringify({ versionId: lcCleanId, externalDir: lcExternalDir, parentVersion: depResult.parentVersion, forgeCore: { ok: depResult.forgeCore.ok, missingCount: depResult.forgeCore.missing?.length } }, null, 2), 'utf-8');
        } catch (_) {}
      }
      sendJSON(res, { success: true, ...depResult });
    });

    /* /api/launch/download-deps - 下载缺失依赖文件（基于会话的进度追踪） */
    registerRoute('POST', '/api/launch/download-deps', async (req, res, parsedUrl) => {
      const ldData = await readBody(req);
      const ldVersionId = ldData.versionId;
      const ldSessionId = ldData.sessionId;
      if (!ldVersionId) { sendError(res, 'Missing versionId', 400); return; }

      const ldSettings = versions.loadSettingsCached();
      const ldCleanId = ldVersionId.replace(/ \[外部\d*\]/, '');
      let ldExternalDir = null;
      const ldExtFolders = versions.loadExternalFolders();
      for (const folder of ldExtFolders) {
        if (!fs.existsSync(folder.path)) continue;
        const extVers = versions.scanExternalFolder(folder.path);
        const extV = extVers.find((v) => v.id === ldCleanId);
        if (extV) { ldExternalDir = extV.externalVersionDir; break; }
      }
      const ldDepCheck = await dependencies.checkDependencies(ldCleanId, ldSettings, ldExternalDir);
      const ldVersionJson = versions.resolveVersionJson(ldCleanId, ldExternalDir);

      if (ldDepCheck.missingFiles.length === 0) {
        sendJSON(res, { success: true, message: '无需下载', completed: 0, failed: 0 });
        return;
      }

      // 创建下载会话，用于前端轮询进度
      const dlSessionId = ldSessionId || `launch-${Date.now()}`;
      if (!ctx.sessions.launchSessions.has(dlSessionId)) {
        ctx.sessions.launchSessions.set(dlSessionId, {
          status: 'downloading',
          progress: 0,
          message: `正在下载 ${ldDepCheck.missingFiles.length} 个缺失文件..`,
          totalFiles: ldDepCheck.missingFiles.length,
          completedFiles: 0,
          currentFile: '',
          errors: [],
          versionId: ldVersionId,
          lastActivity: Date.now()
        });
      }

      sendJSON(res, { success: true, sessionId: dlSessionId, missingCount: ldDepCheck.missingFiles.length });

      // 异步执行下载，通过会话对象更新进度
      dependencies.downloadMissingDependencies(ldDepCheck.missingFiles, (progress) => {
        const session = ctx.sessions.launchSessions.get(dlSessionId);
        if (session) {
          session.progress = progress.progress;
          session.currentFile = progress.file;
          session.completedFiles = progress.current;
          session.message = `下载文件 (${progress.current}/${progress.total}): ${progress.file}`;
          session.speed = progress.speed;
          session.activeDownloads = progress.activeDownloads || [];
          session.completed = progress.completed || 0;
          session.failed = progress.failed || 0;
          session.queued = progress.queued || 0;
          session.concurrentDownloads = progress.concurrentDownloads || 10;
          session.failedFiles = progress.failedFiles || [];
        }
      }, ldVersionJson).then(async (result) => {
        const session = ctx.sessions.launchSessions.get(dlSessionId);
        if (session) {
          session.errors = result.errors;
          session.failedFiles = result.failedFiles || [];
          if (result.failed > 0 && result.completed === 0) {
            session.status = 'failed';
            session.message = `下载失败: ${result.failed} 个文件下载失败`;
          } else {
            session.status = 'completed';
            session.message = `下载完成: ${result.completed} 个成功, ${result.failed} 个失败`;
            java.invalidateDepCheckCache(ldCleanId);
          }
        }
      }).catch((e) => {
        const session = ctx.sessions.launchSessions.get(dlSessionId);
        if (session) {
          session.status = 'failed';
          session.message = `下载失败: ${e.message}`;
        }
      });
    });

    /* /api/launch/session-status - 查询下载会话状态（含速度、并发数、失败文件列表） */
    registerRoute('GET', '/api/launch/session-status', async (req, res, parsedUrl) => {
      const lsSessionId = parsedUrl.query.sessionId;
      if (!lsSessionId || !ctx.sessions.launchSessions.has(lsSessionId)) {
        sendJSON(res, { status: 'unknown', progress: 0, message: '' });
        return;
      }
      const lsSession = ctx.sessions.launchSessions.get(lsSessionId);
      const response = {
        status: lsSession.status,
        progress: lsSession.progress,
        message: lsSession.message,
        currentFile: lsSession.currentFile || '',
        totalFiles: lsSession.totalFiles || 0,
        completedFiles: lsSession.completedFiles || 0,
        errors: lsSession.errors || [],
        launchResult: lsSession.launchResult || null,
        activeDownloads: lsSession.activeDownloads || [],
        completed: lsSession.completed || 0,
        failed: lsSession.failed || 0,
        speed: ctx.DownloadManager.getSpeed() || lsSession.speed || 0,
        queued: lsSession.queued || 0,
        concurrentDownloads: lsSession.concurrentDownloads || 16,
        activeConnections: ctx.DownloadManager.activeConnections,
        connectionLimit: ctx.DownloadManager.connectionLimit,
        failedFiles: lsSession.failedFiles || []
      };
      sendJSON(res, response);
      // 会话结束后 60 秒自动清理
      if (['launched', 'launch_failed', 'failed'].includes(lsSession.status)) {
        setTimeout(() => ctx.sessions.launchSessions.delete(lsSessionId), 60000);
      }
    });

    /* /api/launch/diagnose - 诊断启动配置（构建 classpath、检查缺失库、预览启动参数） */
    registerRoute('GET', '/api/launch/diagnose', async (req, res, parsedUrl) => {
      const diagVersionId = parsedUrl.query.versionId;
      const diagExternal = parsedUrl.query.externalDir || '';
      if (!diagVersionId) { sendError(res, 'Missing versionId', 400); return; }

      try {
        const extDir = diagExternal || null;
        const versionJson = versions.resolveVersionJson(diagVersionId, extDir);
        if (!versionJson) { sendError(res, '版本JSON缺失', 400); return; }

        const settings = versions.loadSettingsCached();
        const acctsList = accounts.loadAccounts();
        const account = acctsList.find((a) => a.id === settings.selectedAccount) || acctsList[0] || { username: 'Player', type: 'offline' };

        const diagResult = {
          versionId: diagVersionId,
          externalDir: extDir,
          mainClass: versionJson.mainClass || 'N/A',
          inheritsFrom: versionJson.inheritsFrom || null,
          librariesCount: (versionJson.libraries || []).length,
          javaPath: 'auto-detect',
          classpathEntries: [],
          missingLibraries: [],
          criticalMissing: [],
          mainJarFound: false,
          mainJarPath: null,
          argsPreview: null
        };

        const javaPath = _server().findJavaPath(versionJson, settings);
        diagResult.javaPath = javaPath;
        diagResult.javaMajorVersion = java.getJavaMajorVersion(javaPath);

        // 构建 classpath 并检查每个条目是否存在
        const classpathStr = _server().buildClasspath(versionJson, diagVersionId, extDir);
        const cpEntries = classpathStr.split(';');
        diagResult.classpathEntries = cpEntries;

        for (const entry of cpEntries) {
          if (!fs.existsSync(entry)) {
            diagResult.missingLibraries.push(entry);
            // 标记关键库缺失（Forge/Fabric/NeoForge 核心库、日志库、LWJGL 等）
            const bn = path.basename(entry).toLowerCase();
            if (bn.includes('securejarhandler') || bn.includes('forge') || bn.includes('neoforge') ||
              bn.includes('fmlloader') || bn.includes('modlauncher') || bn.includes('fabric-loader') ||
              bn.includes('launchwrapper') || bn.includes('log4j') || bn.includes('lwjgl')) {
              diagResult.criticalMissing.push(entry);
            }
          }
        }

        // 查找主 jar 文件：外部版本目录 -> VERSIONS_DIR
        const actualVersionId = diagVersionId || versionJson.id || '';
        const jarSearchPaths = [];
        if (extDir) {
          const er = versions.findExternalRoot(extDir);
          if (er) jarSearchPaths.push(path.join(er, 'versions', actualVersionId, `${actualVersionId}.jar`));
          jarSearchPaths.push(path.join(extDir, `${actualVersionId}.jar`));
          jarSearchPaths.push(path.join(extDir, `${path.basename(extDir)}.jar`));
        }
        jarSearchPaths.push(path.join(ctx.dirs.VERSIONS_DIR, actualVersionId, `${actualVersionId}.jar`));
        for (const p of jarSearchPaths) {
          if (fs.existsSync(p)) {
            diagResult.mainJarFound = true;
            diagResult.mainJarPath = p;
            break;
          }
        }

        // 预览启动参数并估算命令行长度
        try {
          const { args } = launch.buildLaunchArguments(versionJson, settings, account, diagVersionId,
            extDir ? path.dirname(extDir) : path.join(ctx.dirs.DATA_DIR, 'minecraft'),
            extDir);
          diagResult.argsPreview = args;
          diagResult.argsCount = args.length;
          diagResult.estimatedCmdLength = javaPath.length + args.reduce((sum, a) => sum + a.length + 3, 0);
        } catch (e) {
          diagResult.argsPreviewError = e.message;
        }

        sendJSON(res, diagResult);
      } catch (e) {
        sendError(res, '诊断失败: ' + e.message);
      }
    });

    /* /api/launch/args-preview - 预览启动参数（不实际启动） */
    registerRoute('POST', '/api/launch/args-preview', async (req, res, parsedUrl) => {
      const laData = await readBody(req);
      const laVersionId = laData.versionId;
      if (!laVersionId) { sendError(res, 'Missing versionId', 400); return; }

      try {
        const versionJson = versions.resolveVersionJson(laVersionId);
        if (!versionJson) { sendError(res, '版本JSON缺失', 400); return; }
        const settings = versions.loadSettingsCached();
        const acctsList = accounts.loadAccounts();
        const account = acctsList.find((a) => a.id === settings.selectedAccount) || acctsList[0] || { username: 'Player', type: 'offline' };
        const { args } = launch.buildLaunchArguments(versionJson, settings, account);
        sendJSON(res, { args, javaPath: 'auto-detect' });
      } catch (e) {
        sendError(res, '预览失败: ' + e.message);
      }
    });
  }
};
