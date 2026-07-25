/**
 * @file server/api/routes/java.js
 * @description Java 管理路由 - 从 server.js handleAPI switch 语句抽取的 Java 相关端点，包含 Java 检测、安装、下载、配置环境变量等功能
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Worker } = require('worker_threads');

module.exports = {
  /**
   * 注册 Java 管理相关路由
   * @param {Function} registerRoute - 路由注册函数
   * @param {Object} deps - 依赖对象（ctx/sendJSON/sendError/readBody/java/accounts/utils）
   * @returns {void}
   */
  register(registerRoute, deps) {
    const { ctx, sendJSON, sendError, readBody } = deps;
    const { java, accounts, utils } = deps;

    /* /api/java/detect - 检测系统与内置 Java 列表
     * 关键优化：Java 检测会用 execSync 同步执行 java -version，系统装多个 Java 时累计卡 5-25 秒
     * 同步执行会阻塞 server.js 主线程，导致所有 API 请求排队，渲染进程点击"无响应"
     * 方案：用 worker_thread 把检测放到独立线程跑，完全不阻塞主线程
     * 同时内存缓存检测结果，首次请求触发后台检测，后续请求立即返回缓存
     */
    let _javaDetectCache = null;
    let _javaDetecting = false;
    let _javaDetectWaiters = [];

    // Java 检测 worker 脚本（独立线程，不阻塞主线程）
    const _javaDetectWorkerScript = `
      const { parentPort, workerData } = require('worker_threads');
      const { execSync } = require('child_process');
      const fs = require('fs');
      const path = require('path');

      function detectSystemJava() {
        const results = [];
        const seen = new Set();
        const isWin = process.platform === 'win32';
        const javaExeName = isWin ? 'java.exe' : 'java';

        function addJavaEntry(javaExe, source) {
          try {
            if (seen.has(javaExe)) return;
            if (!fs.existsSync(javaExe)) return;
            seen.add(javaExe);

            const javaHome = path.dirname(path.dirname(javaExe));
            let version = '';
            let majorVersion = 0;
            let minorVersion = 0;

            // 优先读 release 文件（不执行 java，速度快）
            try {
              const releasePath = path.join(javaHome, 'release');
              if (fs.existsSync(releasePath)) {
                const release = fs.readFileSync(releasePath, 'utf8');
                const m = release.match(/JAVA_VERSION="([^"]+)"/);
                if (m) {
                  version = m[1];
                  if (version.startsWith('1.')) {
                    majorVersion = parseInt(version.split('.')[1], 10);
                  } else {
                    majorVersion = parseInt(version.split('.')[0], 10);
                  }
                }
              }
            } catch (e) {}

            // release 文件缺失或解析失败时回退到 java -version
            if (majorVersion <= 0) {
              try {
                const out = execSync('"' + javaExe + '" -version 2>&1', { encoding: 'utf8', timeout: 5000, windowsHide: true });
                const m = out.match(/version "([^"]+)"/) || out.match(/version (\\S+)/);
                if (m) {
                  version = m[1];
                  if (version.startsWith('1.')) {
                    majorVersion = parseInt(version.split('.')[1], 10);
                  } else {
                    majorVersion = parseInt(version.split('.')[0], 10);
                  }
                }
              } catch (e) {}
            }

            if (isNaN(majorVersion) || majorVersion <= 0) return;

            const isJdk = fs.existsSync(path.join(javaHome, 'bin', isWin ? 'javac.exe' : 'javac'));
            let is64Bit = true;
            try {
              const archOut = execSync('"' + javaExe + '" -XshowSettings:properties -version 2>&1', { encoding: 'utf8', timeout: 5000, windowsHide: true });
              is64Bit = archOut.includes('os.arch = x86_64') || archOut.includes('os.arch = amd64') || archOut.includes('64-bit');
            } catch (e) {
              try {
                const vOut = execSync('"' + javaExe + '" -version 2>&1', { encoding: 'utf8', timeout: 5000, windowsHide: true });
                is64Bit = vOut.includes('64-Bit') || vOut.includes('64-bit');
              } catch (e2) {}
            }

            results.push({
              path: javaExe, version: version, majorVersion: majorVersion,
              minorVersion: minorVersion, is64Bit: is64Bit, isJdk: isJdk,
              source: source, javaHome: javaHome
            });
          } catch (e) {}
        }

        function searchFolder(basePath, depth) {
          if (depth <= 0 || !fs.existsSync(basePath)) return;
          try {
            const entries = fs.readdirSync(basePath, { withFileTypes: true });
            for (const entry of entries) {
              if (!entry.isDirectory()) continue;
              const dirName = entry.name.toLowerCase();
              const fullPath = path.join(basePath, entry.name);
              if (dirName === 'bin') {
                const javaExe = path.join(fullPath, javaExeName);
                if (fs.existsSync(javaExe)) addJavaEntry(javaExe, 'system');
                continue;
              }
              const kws = ['java','jdk','jre','jvm','runtime','adopt','temurin','corretto','zulu','openjdk','graalvm','liberica','microsoft','amazon','sapmachine','dragonwell','bisheng'];
              const isJavaDir = kws.some((kw) => dirName.includes(kw)) || /^jdk[-_]?\\d/i.test(dirName) || /^jre[-_]?\\d/i.test(dirName);
              if (isJavaDir) {
                const javaExe = path.join(fullPath, 'bin', javaExeName);
                if (fs.existsSync(javaExe)) addJavaEntry(javaExe, 'system');
                searchFolder(fullPath, depth - 1);
              }
            }
          } catch (e) {}
        }

        if (process.env.JAVA_HOME) {
          const javaHome = process.env.JAVA_HOME.replace(/["']/g, '').replace(/\\\\$/, '').replace(/\\/$/, '');
          addJavaEntry(path.join(javaHome, 'bin', javaExeName), 'system');
        }
        if (process.env.JDK_HOME) {
          const javaHome = process.env.JDK_HOME.replace(/["']/g, '').replace(/\\\\$/, '').replace(/\\/$/, '');
          addJavaEntry(path.join(javaHome, 'bin', javaExeName), 'system');
        }

        if (isWin) {
          try {
            const out = execSync('where java 2>nul', { encoding: 'utf8', timeout: 5000, windowsHide: true });
            out.split(/\\r?\\n/).forEach((line) => {
              const p = line.trim();
              if (p && fs.existsSync(p)) addJavaEntry(p, 'system');
            });
          } catch (e) {}
          const commonDirs = [
            'C:\\\\Program Files\\\\Java', 'C:\\\\Program Files (x86)\\\\Java',
            'C:\\\\Program Files\\\\Eclipse Adoptium', 'C:\\\\Program Files\\\\Amazon Corretto',
            'C:\\\\Program Files\\\\Zulu', 'C:\\\\Program Files\\\\Microsoft'
          ];
          commonDirs.forEach((d) => searchFolder(d, 3));
        }
        return results;
      }

      function detectBundledJava(bundledDir) {
        const results = [];
        try {
          if (!fs.existsSync(bundledDir)) return results;
          const entries = fs.readdirSync(bundledDir, { withFileTypes: true });
          const javaExeName = process.platform === 'win32' ? 'java.exe' : 'java';
          for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const javaExe = path.join(bundledDir, entry.name, 'bin', javaExeName);
            if (fs.existsSync(javaExe)) {
              try {
                const out = execSync('"' + javaExe + '" -version 2>&1', { encoding: 'utf8', timeout: 5000, windowsHide: true });
                const m = out.match(/version "([^"]+)"/);
                if (m) {
                  const version = m[1];
                  let major = 0;
                  if (version.startsWith('1.')) major = parseInt(version.split('.')[1], 10);
                  else major = parseInt(version.split('.')[0], 10);
                  results.push({
                    path: javaExe, version: version, majorVersion: major,
                    is64Bit: true, isJdk: false, source: 'bundled',
                    javaHome: path.join(bundledDir, entry.name)
                  });
                }
              } catch (e) {}
            }
          }
        } catch (e) {}
        return results;
      }

      // 主流程
      try {
        const systemJava = detectSystemJava();
        let bundledJava = [];
        try {
          const bundledDir = path.join(workerData.appRoot, 'runtime');
          bundledJava = detectBundledJava(bundledDir);
        } catch (e) {}
        const allJava = [...bundledJava, ...systemJava];
        parentPort.postMessage({
          success: true,
          platform: process.platform === 'win32' ? 'windows' : (process.platform === 'darwin' ? 'macos' : 'linux'),
          javaList: allJava,
          hasJava: allJava.length > 0,
          hasJava17: allJava.some((j) => j.majorVersion >= 17),
          hasJava21: allJava.some((j) => j.majorVersion >= 21)
        });
      } catch (e) {
        parentPort.postMessage({ success: false, error: e.message, javaList: [] });
      }
    `;

    function _detectJavaAsync() {
      return new Promise((resolve) => {
        try {
          const appRoot = path.join(__dirname, '..', '..', '..', '..');
          const worker = new Worker(_javaDetectWorkerScript, {
            eval: true,
            workerData: { appRoot }
          });
          let settled = false;
          const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            try { worker.terminate(); } catch (e) {}
            resolve(null);
          }, 30000);
          worker.on('message', (msg) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            try { worker.terminate(); } catch (e) {}
            resolve(msg);
          });
          worker.on('error', (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            console.error('[Java] worker error:', err.message);
            resolve(null);
          });
        } catch (e) {
          console.error('[Java] worker create failed:', e.message);
          resolve(null);
        }
      });
    }

    // 后台异步预检测（worker 线程，完全不阻塞主线程）
    function _refreshJavaCacheInBackground() {
      if (_javaDetecting) return;
      _javaDetecting = true;
      _detectJavaAsync().then((result) => {
        if (result && result.success) {
          _javaDetectCache = result;
        }
        _javaDetecting = false;
        // 通知所有等待中的请求
        while (_javaDetectWaiters.length > 0) {
          const waiter = _javaDetectWaiters.shift();
          waiter(result);
        }
      });
    }

    registerRoute('GET', '/api/java/detect', async (req, res, parsedUrl) => {
      try {
        // 有缓存立即返回（不阻塞）
        if (_javaDetectCache) {
          sendJSON(res, _javaDetectCache);
          return;
        }
        // 无缓存但正在检测：等检测结果
        if (_javaDetecting) {
          const result = await new Promise((resolve) => _javaDetectWaiters.push(resolve));
          sendJSON(res, result || { success: true, javaList: [], hasJava: false });
          return;
        }
        // 无缓存且未检测：启动后台检测并等待
        _refreshJavaCacheInBackground();
        const result = await new Promise((resolve) => _javaDetectWaiters.push(resolve));
        sendJSON(res, result || { success: true, javaList: [], hasJava: false });
      } catch (e) {
        sendError(res, 'Java检测失败 ' + e.message);
      }
    });

    // server.js 启动后立即后台预检测，用户请求时缓存已准备好
    _refreshJavaCacheInBackground();

    /* /api/java/install - 安装 Java 运行时（旧接口，回调式进度） */
    registerRoute('POST', '/api/java/install', async (req, res, parsedUrl) => {
      const data = await readBody(req);
      const component = data.component || 'java-runtime-gamma';
      const sessionId = `java-${Date.now()}`;
      ctx.sessions.javaInstallSessions.set(sessionId, { status: 'pending', progress: 0, message: '准备下载Java运行时..', component, lastActivity: Date.now() });
      sendJSON(res, { success: true, sessionId });
      // 通过回调更新会话进度，完成后更新状态
      java.downloadJavaRuntime(component, (progress) => {
        const session = ctx.sessions.javaInstallSessions.get(sessionId);
        if (session) {
          session.status = 'downloading';
          session.progress = progress.progress;
          session.message = `下载 ${progress.file} (${progress.current}/${progress.total})`;
        }
      }).then((result) => {
        const session = ctx.sessions.javaInstallSessions.get(sessionId);
        if (session) { session.status = 'completed'; session.progress = 100; session.message = 'Java运行时安装完成！'; session.result = result; }
      }).catch((e) => {
        const session = ctx.sessions.javaInstallSessions.get(sessionId);
        if (session) { session.status = 'failed'; session.message = `安装失败: ${e.message}`; session.error = e.message; }
      });
    });

    /* /api/java/install-status - 查询 Java 安装会话状态 */
    registerRoute('GET', '/api/java/install-status', async (req, res, parsedUrl) => {
      const sessionId = parsedUrl.query.sessionId;
      if (!sessionId || !ctx.sessions.javaInstallSessions.has(sessionId)) { sendError(res, '无效的会话ID', 400); return; }
      const session = ctx.sessions.javaInstallSessions.get(sessionId);
      sendJSON(res, { success: true, ...session });
      if (session.status === 'completed' || session.status === 'failed') ctx.sessions.javaInstallSessions.delete(sessionId);
    });

    /* /api/java/auto-install - 自动检测并安装所需 Java 版本 */
    registerRoute('POST', '/api/java/auto-install', async (req, res, parsedUrl) => {
      const aiData = await readBody(req);
      const requiredVersion = aiData.requiredVersion || 17;
      const aiSessionId = `java-auto-${Date.now()}`;
      ctx.sessions.javaInstallSessions.set(aiSessionId, {
        status: 'detecting',
        progress: 0,
        message: '正在检测Java环境...',
        component: '',
        source: '',
        speed: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        lastActivity: Date.now()
      });
      sendJSON(res, { success: true, sessionId: aiSessionId });

      // 异步检测：优先复用已安装的合适 Java，否则提示手动安装
      (async () => {
        try {
          const systemJava = java.detectSystemJava();
          const bundledJava = java.detectBundledJava();
          const customJava = java.detectCustomJava();
          const allJava = [...bundledJava, ...systemJava, ...customJava];
          const suitable = allJava.find((j) => j.majorVersion >= requiredVersion);

          if (suitable) {
            const s = ctx.sessions.javaInstallSessions.get(aiSessionId);
            if (s) {
              s.status = 'completed';
              s.progress = 100;
              s.message = `已找到Java ${suitable.version}`;
              s.result = { path: suitable.path, version: suitable.version, majorVersion: suitable.majorVersion };
            }
            return;
          }

          const s = ctx.sessions.javaInstallSessions.get(aiSessionId);
          if (s) {
            s.status = 'need_manual';
            s.progress = 0;
            s.message = `未找到合适的Java运行环境（需要 Java ${requiredVersion}），请在设置中手动安装或配置Java路径`;
          }
        } catch (e) {
          const errSession = ctx.sessions.javaInstallSessions.get(aiSessionId);
          if (errSession) {
            errSession.status = 'failed';
            errSession.message = `检测失败: ${e.message}`;
            errSession.error = e.message;
          }
        }
      })();
    });

    /* /api/java/download-sources - 返回可选的 Java 下载源列表 */
    registerRoute('GET', '/api/java/download-sources', async (req, res, parsedUrl) => {
      sendJSON(res, {
        success: true,
        sources: [
          { id: 'bmclapi', name: 'BMCLAPI镜像', description: '国内加速镜像(bangbang93)' },
          { id: 'mojang', name: 'Mojang官方源', description: 'Minecraft官方Java运行时' },
          { id: 'temurin', name: 'Adoptium (Temurin)', description: 'Eclipse开源JDK' }
        ]
      });
    });

    /* /api/java/list - 返回推荐的 Java 大版本列表 */
    registerRoute('GET', '/api/java/list', async (req, res, parsedUrl) => {
      try {
        const requiredVersions = [8, 17, 21, 25];
        const javaVersions = requiredVersions.map((v) => ({
          majorVersion: v,
          version: `Java ${v}`,
          source: 'Adoptium (Temurin)'
        }));
        sendJSON(res, { versions: javaVersions });
      } catch (e) {
        console.error('[Java] 获取Java列表失败:', e.message);
        sendError(res, '获取Java列表失败: ' + e.message);
      }
    });

    /* /api/java/download - 启动 Java 异步下载（写入状态文件供轮询） */
    registerRoute('POST', '/api/java/download', async (req, res, parsedUrl) => {
      try {
        const body = await readBody(req);
        const { majorVersion, mirrorIndex } = body;

        if (!majorVersion) {
          sendError(res, '缺少majorVersion参数', 400);
          return;
        }

        const sessionId = `java-${Date.now()}`;
        const sessionFile = path.join(ctx.dirs.DATA_DIR, `java-download-${sessionId}.json`);
        const abortController = new AbortController();
        ctx.sessions.javaDownloadAbortControllers.set(sessionId, abortController);

        // 初始化下载状态文件
        fs.writeFileSync(sessionFile, JSON.stringify({
          status: 'starting',
          progress: 0,
          majorVersion: majorVersion,
          startTime: Date.now()
        }));

        java.downloadJavaAsync(majorVersion, sessionId, sessionFile, mirrorIndex || 0, abortController.signal);

        sendJSON(res, { sessionId: sessionId });
      } catch (e) {
        sendError(res, '启动Java下载失败: ' + e.message);
      }
    });

    /* /api/java/download-status - 轮询 Java 下载状态（读取状态文件） */
    registerRoute('GET', '/api/java/download-status', async (req, res, parsedUrl) => {
      const sessionId = parsedUrl.query.sessionId;
      if (!sessionId) {
        sendError(res, '缺少sessionId参数', 400);
        return;
      }

      const sessionFile = path.join(ctx.dirs.DATA_DIR, `java-download-${sessionId}.json`);
      if (!fs.existsSync(sessionFile)) {
        sendJSON(res, { status: 'not_found' });
        return;
      }

      try {
        const status = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
        sendJSON(res, status);

        // 终态后延时清理状态文件
        if (status.status === 'completed' || status.status === 'error' || status.status === 'cancelled') {
          setTimeout(() => {
            try { fs.unlinkSync(sessionFile); } catch (e) {}
          }, 60000);
        }
      } catch (e) {
        sendJSON(res, { status: 'error', error: e.message });
      }
    });

    /* /api/java/cancel - 取消 Java 下载（GET/POST 共用） */
    registerRoute('*', '/api/java/cancel', async (req, res, parsedUrl) => {
      const cancelData = parsedUrl.query.sessionId
        ? { sessionId: parsedUrl.query.sessionId }
        : (req.method === 'POST' ? await readBody(req).catch(() => ({})) : {});
      const cancelSid = cancelData.sessionId;
      if (!cancelSid) {
        sendError(res, '缺少sessionId参数', 400);
        return;
      }
      // 触发 AbortController 中止下载
      const controller = ctx.sessions.javaDownloadAbortControllers.get(cancelSid);
      if (controller) {
        controller.abort();
        ctx.sessions.javaDownloadAbortControllers.delete(cancelSid);
      }
      // 同步更新状态文件为已取消
      const cancelFile = path.join(ctx.dirs.DATA_DIR, `java-download-${cancelSid}.json`);
      if (fs.existsSync(cancelFile)) {
        try {
          const st = JSON.parse(fs.readFileSync(cancelFile, 'utf-8'));
          if (st.status !== 'completed' && st.status !== 'error' && st.status !== 'cancelled') {
            st.status = 'cancelled';
            st.message = '下载已取消';
            fs.writeFileSync(cancelFile, JSON.stringify(st));
          }
        } catch (e) {}
      }
      sendJSON(res, { success: true, message: '已取消Java下载' });
    });

    /* /api/java/installed - 返回已安装 Java 列表（含自定义 Java 与当前使用路径） */
    registerRoute('GET', '/api/java/installed', async (req, res, parsedUrl) => {
      try {
        const systemJava = java.detectSystemJava();
        const bundledJava = java.detectBundledJava();
        const customJava = java.detectCustomJava();
        const allJava = [...bundledJava, ...systemJava, ...customJava];

        // 读取当前使用的 Java 路径供前端标记「当前使用」
        let currentJavaPath = '';
        try {
          const settings = accounts.loadSettingsCached();
          currentJavaPath = settings.javaPath || '';
        } catch (e) {}

        sendJSON(res, {
          java: allJava,
          total: allJava.length,
          currentJavaPath: currentJavaPath
        });
      } catch (e) {
        sendError(res, '获取已安装Java列表失败: ' + e.message);
      }
    });

    /* /api/java/configure-env - 配置 JAVA_HOME 与 PATH 环境变量 */
    registerRoute('POST', '/api/java/configure-env', async (req, res, parsedUrl) => {
      try {
        const envBody = await readBody(req);
        const { javaHome, majorVersion } = envBody;
        if (!javaHome) {
          sendError(res, '缺少javaHome参数', 400);
          return;
        }
        if (!fs.existsSync(javaHome)) {
          sendError(res, 'Java目录不存在: ' + javaHome, 400);
          return;
        }
        const result = await java.configureJavaEnv(javaHome, majorVersion || 17);
        sendJSON(res, { success: true, ...result });
      } catch (e) {
        sendError(res, '配置环境变量失败: ' + e.message);
      }
    });

    /* /api/java/delete - 删除内置 Java 并清理环境变量引用 */
    registerRoute('POST', '/api/java/delete', async (req, res, parsedUrl) => {
      try {
        const delBody = await readBody(req);
        const { javaHome } = delBody;
        if (!javaHome) {
          sendError(res, '缺少javaHome参数', 400);
          return;
        }

        // 路径规范化用于安全校验
        const normalizedJavaHome = javaHome.toLowerCase().replace(/\\/g, '/').replace(/\/$/, '');
        const normalizedDataDir = ctx.dirs.DATA_DIR.toLowerCase().replace(/\\/g, '/').replace(/\/$/, '');
        const normalizedJavaDir = ctx.dirs.JAVA_DIR.toLowerCase().replace(/\\/g, '/').replace(/\/$/, '');

        // 仅允许删除启动器内置 Java 目录
        if (!normalizedJavaHome.startsWith(normalizedJavaDir)) {
          sendError(res, '只能删除启动器内置的Java，系统Java请通过系统设置卸载', 403);
          return;
        }

        if (normalizedJavaHome === normalizedJavaDir || normalizedJavaHome === normalizedDataDir) {
          sendError(res, '不能删除Java根目录', 400);
          return;
        }

        if (!fs.existsSync(javaHome)) {
          sendError(res, 'Java目录不存在: ' + javaHome, 404);
          return;
        }

        const javaExe = path.join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
        if (!fs.existsSync(javaExe)) {
          sendError(res, '指定目录不是有效的Java安装', 400);
          return;
        }

        // 清除设置中引用的 Java 路径
        const settings = accounts.loadSettingsCached();
        if (settings.javaPath) {
          const normalizedSettingsPath = settings.javaPath.toLowerCase().replace(/\\/g, '/').replace(/\/$/, '');
          if (normalizedSettingsPath.startsWith(normalizedJavaHome)) {
            settings.javaPath = '';
            accounts.saveSettings(settings);
          }
        }

        // Windows 下清理系统 PATH 与 JAVA_HOME 环境变量
        if (process.platform === 'win32') {
          try {
            const currentPath = execSync(
              `powershell -Command "[Environment]::GetEnvironmentVariable('Path', 'Machine')"`,
              { encoding: 'utf8', timeout: 10000, windowsHide: true }
            ).trim();
            const javaBinDir = path.join(javaHome, 'bin');
            const normalizedJavaBin = javaBinDir.toLowerCase().replace(/\\/g, '/').replace(/\/$/, '');
            const pathEntries = currentPath.split(';').filter((p) => {
              const normalized = p.trim().toLowerCase().replace(/\\/g, '/').replace(/\/$/, '');
              return normalized !== normalizedJavaBin && p.trim() !== '';
            });
            const newPath = pathEntries.join(';');
            if (newPath !== currentPath) {
              execSync(
                `powershell -Command "[Environment]::SetEnvironmentVariable('Path', '${newPath.replace(/'/g, "''")}', 'Machine')"`,
                { encoding: 'utf8', timeout: 15000, windowsHide: true }
              );
            }
          } catch (envErr) {
            console.warn(`[Java] 从系统PATH移除失败(不影响): ${envErr.message}`);
          }

          try {
            const currentUserPath = execSync(
              `powershell -Command "[Environment]::GetEnvironmentVariable('Path', 'User')"`,
              { encoding: 'utf8', timeout: 10000, windowsHide: true }
            ).trim();
            const javaBinDir = path.join(javaHome, 'bin');
            const normalizedJavaBin = javaBinDir.toLowerCase().replace(/\\/g, '/').replace(/\/$/, '');
            const userPathEntries = currentUserPath.split(';').filter((p) => {
              const normalized = p.trim().toLowerCase().replace(/\\/g, '/').replace(/\/$/, '');
              return normalized !== normalizedJavaBin && p.trim() !== '';
            });
            const newUserPath = userPathEntries.join(';');
            if (newUserPath !== currentUserPath) {
              execSync(
                `powershell -Command "[Environment]::SetEnvironmentVariable('Path', '${newUserPath.replace(/'/g, "''")}', 'User')"`,
                { encoding: 'utf8', timeout: 15000, windowsHide: true }
              );
            }
          } catch (envErr) {
            console.warn(`[Java] 从用户PATH移除失败(不影响): ${envErr.message}`);
          }

          try {
            const currentJavaHome = execSync(
              `powershell -Command "[Environment]::GetEnvironmentVariable('JAVA_HOME', 'Machine')"`,
              { encoding: 'utf8', timeout: 10000, windowsHide: true }
            ).trim();
            const normalizedCurrentJavaHome = currentJavaHome.toLowerCase().replace(/\\/g, '/').replace(/\/$/, '');
            if (normalizedCurrentJavaHome === normalizedJavaHome) {
              execSync(
                `powershell -Command "[Environment]::SetEnvironmentVariable('JAVA_HOME', $null, 'Machine')"`,
                { encoding: 'utf8', timeout: 15000, windowsHide: true }
              );
            }
          } catch (envErr) {
            console.warn(`[Java] 清除JAVA_HOME失败(不影响): ${envErr.message}`);
          }
        }

        fs.rmSync(javaHome, { recursive: true, force: true });

        sendJSON(res, { success: true, message: `已删除Java: ${path.basename(javaHome)}` });
      } catch (e) {
        console.error('[Java] 删除失败:', e.message);
        sendError(res, '删除Java失败: ' + e.message);
      }
    });

    /* /api/java/add-manual - 手动添加 Java（原位引用，不复制文件） */
    registerRoute('POST', '/api/java/add-manual', async (req, res, parsedUrl) => {
      try {
        const body = await readBody(req);
        const { javaPath } = body;
        if (!javaPath) {
          sendError(res, '缺少 javaPath 参数', 400);
          return;
        }
        const result = java.addManualJava(javaPath);
        if (result.success) {
          sendJSON(res, { success: true, message: result.message, entry: result.entry });
        } else {
          sendJSON(res, { success: false, message: result.message });
        }
      } catch (e) {
        sendError(res, '添加 Java 失败: ' + e.message);
      }
    });

    /* /api/java/import - 导入 Java（压缩包或目录）
     * body: { type: 'archive'|'directory', path: '...' }
     * 返回 sessionId 用于轮询导入进度（导入是耗时操作）
     */
    registerRoute('POST', '/api/java/import', async (req, res, parsedUrl) => {
      try {
        const body = await readBody(req);
        const { type, path: sourcePath } = body;
        if (!type || !sourcePath) {
          sendError(res, '缺少 type 或 path 参数', 400);
          return;
        }
        if (type !== 'archive' && type !== 'directory') {
          sendError(res, 'type 必须是 archive 或 directory', 400);
          return;
        }

        const sessionId = `java-import-${Date.now()}`;
        const sessionFile = path.join(ctx.dirs.DATA_DIR, `java-import-${sessionId}.json`);

        // 初始化导入状态
        fs.writeFileSync(sessionFile, JSON.stringify({
          status: 'starting',
          progress: 0,
          message: '准备导入...',
          startTime: Date.now()
        }));

        sendJSON(res, { success: true, sessionId });

        // 异步执行导入
        (async () => {
          const onProgress = ({ phase, progress, message }) => {
            try {
              fs.writeFileSync(sessionFile, JSON.stringify({
                status: 'importing',
                progress,
                message,
                phase,
                startTime: Date.now()
              }));
            } catch (e) {}
          };

          try {
            const result = type === 'archive'
              ? await java.importJavaArchive(sourcePath, onProgress)
              : await java.importJavaDirectory(sourcePath, onProgress);

            const finalStatus = result.success
              ? { status: 'completed', progress: 100, message: result.message, entry: result.entry, endTime: Date.now() }
              : { status: 'error', progress: 0, message: result.message, endTime: Date.now() };

            fs.writeFileSync(sessionFile, JSON.stringify(finalStatus));
            // 完成后 60 秒清理状态文件
            setTimeout(() => {
              try { fs.unlinkSync(sessionFile); } catch (e) {}
            }, 60000);
          } catch (e) {
            fs.writeFileSync(sessionFile, JSON.stringify({
              status: 'error',
              progress: 0,
              message: '导入失败: ' + e.message,
              endTime: Date.now()
            }));
            setTimeout(() => {
              try { fs.unlinkSync(sessionFile); } catch (er) {}
            }, 60000);
          }
        })();
      } catch (e) {
        sendError(res, '启动 Java 导入失败: ' + e.message);
      }
    });

    /* /api/java/import-status - 轮询 Java 导入状态 */
    registerRoute('GET', '/api/java/import-status', async (req, res, parsedUrl) => {
      const sessionId = parsedUrl.query.sessionId;
      if (!sessionId) {
        sendError(res, '缺少 sessionId 参数', 400);
        return;
      }
      const sessionFile = path.join(ctx.dirs.DATA_DIR, `java-import-${sessionId}.json`);
      if (!fs.existsSync(sessionFile)) {
        sendJSON(res, { status: 'not_found' });
        return;
      }
      try {
        const status = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
        sendJSON(res, status);
      } catch (e) {
        sendJSON(res, { status: 'error', error: e.message });
      }
    });

    /* /api/java/set-current - 设置当前使用的 Java 路径 */
    registerRoute('POST', '/api/java/set-current', async (req, res, parsedUrl) => {
      try {
        const body = await readBody(req);
        const { javaPath } = body;
        if (!javaPath) {
          sendError(res, '缺少 javaPath 参数', 400);
          return;
        }
        if (!fs.existsSync(javaPath)) {
          sendError(res, 'Java 文件不存在: ' + javaPath, 400);
          return;
        }

        const settings = accounts.loadSettingsCached();
        settings.javaPath = javaPath;
        accounts.saveSettings(settings);

        // 同时配置环境变量（如果可能）
        try {
          const binDir = path.dirname(javaPath);
          const javaHome = path.dirname(binDir);
          const info = java.inspectJavaExe ? java.inspectJavaExe(javaPath) : null;
          const majorVersion = info ? info.majorVersion : 17;
          await java.configureJavaEnv(javaHome, majorVersion);
        } catch (e) {
          console.warn('[Java] 配置环境变量失败（不影响设置）:', e.message);
        }

        sendJSON(res, { success: true, message: '已设为当前 Java' });
      } catch (e) {
        sendError(res, '设置当前 Java 失败: ' + e.message);
      }
    });

    /* /api/java/remove-custom - 移除自定义添加/导入的 Java
     * body: { javaHome: '...', deleteFiles: boolean }
     * deleteFiles=true 时同时删除导入的文件（仅对 source=imported 有效）
     */
    registerRoute('POST', '/api/java/remove-custom', async (req, res, parsedUrl) => {
      try {
        const body = await readBody(req);
        const { javaHome, deleteFiles } = body;
        if (!javaHome) {
          sendError(res, '缺少 javaHome 参数', 400);
          return;
        }

        // 如果是当前使用的 Java，清空设置
        try {
          const settings = accounts.loadSettingsCached();
          if (settings.javaPath) {
            const normalizedSettings = settings.javaPath.toLowerCase().replace(/\\/g, '/').replace(/\/$/, '');
            const normalizedHome = javaHome.toLowerCase().replace(/\\/g, '/').replace(/\/$/, '');
            if (normalizedSettings.startsWith(normalizedHome)) {
              settings.javaPath = '';
              accounts.saveSettings(settings);
            }
          }
        } catch (e) {}

        const result = java.removeCustomJava(javaHome, !!deleteFiles);
        if (result.success) {
          sendJSON(res, { success: true, message: result.message });
        } else {
          sendJSON(res, { success: false, message: result.message });
        }
      } catch (e) {
        sendError(res, '移除 Java 失败: ' + e.message);
      }
    });
  }
};
