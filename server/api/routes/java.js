/**
 * @file server/api/routes/java.js
 * @description Java 管理路由 - 从 server.js handleAPI switch 语句抽取的 Java 相关端点，包含 Java 检测、安装、下载、配置环境变量等功能
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Worker } = require('worker_threads');
// 主进程同步检测的回退方案（worker 失败时使用）
let _javaDetectSync = null;
try {
  _javaDetectSync = require('../../java/java-detect');
} catch (e) {
  console.warn('[Java] 无法加载 java-detect 回退模块:', e.message);
}

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
            // 规范化路径去重
            const norm = javaExe.toLowerCase().replace(/\\\\/g, '/').replace(/\\/$/, '').replace(/\/$/, '');
            if (seen.has(norm)) return;
            if (!fs.existsSync(javaExe)) return;
            seen.add(norm);

            const javaHome = path.dirname(path.dirname(javaExe));
            // 排除 FinalShell、Paranoia 等携带 JDK 的非 Java 工具
            if (javaExe.toLowerCase().includes('finalshell') || javaExe.toLowerCase().includes('paranoia')) return;

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
                    const upd = version.match(/_(\d+)/);
                    if (upd) minorVersion = parseInt(upd[1], 10);
                  } else {
                    majorVersion = parseInt(version.split('.')[0], 10);
                    const minorPart = version.split('.')[1];
                    if (minorPart) minorVersion = parseInt(minorPart, 10) || 0;
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
                    const upd = version.match(/_(\d+)/);
                    if (upd) minorVersion = parseInt(upd[1], 10);
                  } else {
                    majorVersion = parseInt(version.split('.')[0], 10);
                    const minorPart = version.split('.')[1];
                    if (minorPart) minorVersion = parseInt(minorPart, 10) || 0;
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
              const kws = ['java','jdk','jre','jvm','runtime','adopt','temurin','corretto','zulu','openjdk','graalvm','liberica','microsoft','amazon','sapmachine','dragonwell','bisheng','windows-x64','windows-arm64','windows-x86','bellsoft'];
              const isJavaDir = kws.some((kw) => dirName.includes(kw)) || /^jdk[-_]?\\d/i.test(dirName) || /^jre[-_]?\\d/i.test(dirName) || /^\\d+([._]\\d+)*$/i.test(dirName);
              if (isJavaDir) {
                const javaExe = path.join(fullPath, 'bin', javaExeName);
                if (fs.existsSync(javaExe)) addJavaEntry(javaExe, 'system');
                searchFolder(fullPath, depth - 1);
              }
            }
          } catch (e) {}
        }

        // 1. 环境变量 JAVA_HOME / JDK_HOME
        if (process.env.JAVA_HOME) {
          const javaHome = process.env.JAVA_HOME.replace(/["']/g, '').replace(/\\\\$/, '').replace(/\\/$/, '');
          addJavaEntry(path.join(javaHome, 'bin', javaExeName), 'system');
        }
        if (process.env.JDK_HOME) {
          const javaHome = process.env.JDK_HOME.replace(/["']/g, '').replace(/\\\\$/, '').replace(/\\/$/, '');
          addJavaEntry(path.join(javaHome, 'bin', javaExeName), 'system');
        }

        // 2. PATH 中的 java
        if (process.env.PATH) {
          const pathDirs = process.env.PATH.split(path.delimiter);
          for (const dir of pathDirs) {
            const trimmed = dir.trim().replace(/["']/g, '');
            if (!trimmed) continue;
            const javaExe = path.join(trimmed, javaExeName);
            if (fs.existsSync(javaExe)) addJavaEntry(javaExe, 'system');
            // 若 PATH 条目含 java/jdk 关键词，父目录也可能是 Java 目录
            if (trimmed.toLowerCase().includes('java') || trimmed.toLowerCase().includes('jdk')) {
              const parentJavaExe = path.join(path.dirname(trimmed), 'bin', javaExeName);
              addJavaEntry(parentJavaExe, 'system');
            }
          }
        }

        if (isWin) {
          // 3. 注册表 HKLM\\SOFTWARE\\JavaSoft
          try {
            const regOut = execSync('reg query "HKLM\\\\SOFTWARE\\\\JavaSoft\\\\Java Runtime Environment" /s 2>nul || reg query "HKLM\\\\SOFTWARE\\\\JavaSoft\\\\JDK" /s 2>nul || reg query "HKLM\\\\SOFTWARE\\\\JavaSoft\\\\Java Development Kit" /s 2>nul', { encoding: 'utf8', timeout: 5000, windowsHide: true });
            const homeMatches = regOut.matchAll(/JavaHome\\s+REG_SZ\\s+(.+)/gi);
            for (const m of homeMatches) {
              addJavaEntry(path.join(m[1].trim(), 'bin', 'java.exe'), 'system');
            }
          } catch (e) {}
          try {
            const regOut = execSync('reg query "HKLM\\\\SOFTWARE\\\\Wow6432Node\\\\JavaSoft\\\\Java Runtime Environment" /s 2>nul || reg query "HKLM\\\\SOFTWARE\\\\Wow6432Node\\\\JavaSoft\\\\JDK" /s 2>nul', { encoding: 'utf8', timeout: 5000, windowsHide: true });
            const homeMatches = regOut.matchAll(/JavaHome\\s+REG_SZ\\s+(.+)/gi);
            for (const m of homeMatches) {
              addJavaEntry(path.join(m[1].trim(), 'bin', 'java.exe'), 'system');
            }
          } catch (e) {}

          // 4. Program Files 搜索常见 Java 目录名
          const programFiles = process.env['ProgramFiles'] || 'C:\\\\Program Files';
          const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\\\Program Files (x86)';
          for (const pf of [programFiles, programFilesX86]) {
            if (fs.existsSync(pf)) {
              try {
                fs.readdirSync(pf).forEach(function(d) {
                  const dl = d.toLowerCase();
                  if (['java','jdk','jre','adopt','temurin','corretto','zulu','amazon','microsoft','sapmachine','bellsoft','graalvm','dragonwell'].some(function(kw) { return dl.includes(kw); })) {
                    searchFolder(path.join(pf, d), 2);
                  }
                });
              } catch (e) {}
            }
          }

          // 5. AppData / LocalAppData
          const appData = process.env['APPDATA'] || '';
          const localAppData = process.env['LOCALAPPDATA'] || '';
          const userProfile = process.env['USERPROFILE'] || '';
          if (appData) searchFolder(appData, 2);
          if (localAppData) searchFolder(localAppData, 2);

          // 6. Minecraft 自带 runtime
          if (appData) {
            const mcRuntime = path.join(appData, '.minecraft', 'runtime');
            if (fs.existsSync(mcRuntime)) searchFolder(mcRuntime, 3);
          }

          // 7. where java
          try {
            const whereOut = execSync('where java 2>nul', { encoding: 'utf8', timeout: 5000, windowsHide: true });
            whereOut.split(/\\r?\\n/).filter(function(l) { return l.trim(); }).forEach(function(line) {
              const p = line.trim();
              if (p && fs.existsSync(p)) addJavaEntry(p, 'system');
            });
          } catch (e) {}

          // 8. JetBrains Toolbox JBR
          if (localAppData) {
            searchFolder(path.join(localAppData, 'JetBrains', 'Toolbox', 'apps', 'JBR'), 3);
          }
          if (programFiles) {
            searchFolder(path.join(programFiles, 'JetBrains'), 3);
          }

          // 9. 额外常见路径（不做全盘扫描，避免超时）
          var additionalPaths = [
            path.join(userProfile, 'Java'),
            path.join(userProfile, '.jdks'),
            path.join(localAppData, 'Programs'),
            path.join(userProfile, 'scoop', 'apps', 'openjdk'),
            'C:\\\\ProgramData\\\\Oracle\\\\Java',
            path.join(appData, '.hmcl', 'runtime'),
            path.join(localAppData, 'BakaXL', 'JavaRuntime'),
            path.join(appData, '.minecraft', 'runtime')
          ];
          // 各盘符根目录下只读一层（不递归全盘）
          try {
            var drives = execSync('wmic logicaldisk get caption /value 2>nul', { encoding: 'utf8', timeout: 3000, windowsHide: true });
            var driveMatches = drives.matchAll(/Caption=(\\w:)/gi);
            for (var dm of driveMatches) {
              var root = dm[1] + '\\\\';
              additionalPaths.push(root);
            }
          } catch (e) {}
          for (var ap = 0; ap < additionalPaths.length; ap++) {
            var sp = additionalPaths[ap];
            try {
              if (sp && fs.existsSync(sp)) {
                // 只在根目录下找名为 java/jdk/jre 的子目录，不深度递归整个盘
                fs.readdirSync(sp).forEach(function(d) {
                  var dl = d.toLowerCase();
                  if (['java', 'jdk', 'jre', 'runtime', 'jdks'].some(function(kw) { return dl === kw || dl === kw + 's'; }) || dl.indexOf('java') === 0 || dl.indexOf('jdk') === 0) {
                    searchFolder(path.join(sp, d), 2);
                  }
                });
              }
            } catch (e) {}
          }
        }

        // macOS
        if (!isWin) {
          var homeDir = process.env.HOME || '~';
          var macPaths = [
            '/Library/Java/JavaVirtualMachines',
            '/opt/homebrew/opt',
            '/opt/homebrew/Cellar',
            '/usr/local/opt',
            path.join(homeDir, '.sdkman', 'candidates', 'java'),
            path.join(homeDir, '.jdks'),
            path.join(homeDir, 'Library', 'Java', 'JavaVirtualMachines'),
            path.join(homeDir, '.minecraft', 'runtime'),
          ];
          for (var mi = 0; mi < macPaths.length; mi++) {
            if (fs.existsSync(macPaths[mi])) searchFolder(macPaths[mi], 3);
          }
          try {
            var jhOut = execSync('/usr/libexec/java_home -V 2>&1', { encoding: 'utf8', timeout: 5000, windowsHide: true });
            var jhMatches = jhOut.matchAll(/"([^"]+)"\\s+\\(([^)]+)\\)/g);
            for (var jhm of jhMatches) {
              addJavaEntry(path.join(jhm[1], 'bin', 'java'), 'system');
            }
          } catch (e) {}
          try {
            var whichOut = execSync('which -a java 2>/dev/null', { encoding: 'utf8', timeout: 5000, windowsHide: true });
            whichOut.split('\\n').filter(function(l) { return l.trim(); }).forEach(function(line) {
              var p = line.trim();
              if (p && fs.existsSync(p)) addJavaEntry(p, 'system');
            });
          } catch (e) {}
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
        // 也搜索数据目录中已下载的 Java 运行时
        try {
          if (workerData.dataDir) {
            const dataRuntime = path.join(workerData.dataDir, 'runtime');
            if (fs.existsSync(dataRuntime)) {
              const dataJava = detectBundledJava(dataRuntime);
              for (const dj of dataJava) {
                if (!bundledJava.some(function(b) { return b.path === dj.path; })) {
                  bundledJava.push(dj);
                }
              }
            }
          }
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
          const dataDir = ctx.dirs ? ctx.dirs.DATA_DIR : '';
          const worker = new Worker(_javaDetectWorkerScript, {
            eval: true,
            workerData: { appRoot, dataDir }
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
        if (result && result.success && result.javaList && result.javaList.length > 0) {
          _javaDetectCache = result;
        } else {
          // Worker 失败或返回空列表：回退到主进程同步检测
          console.warn('[Java] worker 检测失败或为空，回退到同步检测');
          try {
            if (_javaDetectSync) {
              const syncList = _javaDetectSync.detectSystemJava();
              let bundled = [];
              try {
                const appRoot = path.join(__dirname, '..', '..', '..', '..');
                bundled = _javaDetectSync.detectBundledJava(path.join(appRoot, 'runtime'));
              } catch (e) {}
              const allJava = [...bundled, ...syncList];
              _javaDetectCache = {
                success: true,
                platform: process.platform === 'win32' ? 'windows' : (process.platform === 'darwin' ? 'macos' : 'linux'),
                javaList: allJava,
                hasJava: allJava.length > 0,
                hasJava17: allJava.some((j) => j.majorVersion >= 17),
                hasJava21: allJava.some((j) => j.majorVersion >= 21)
              };
              console.log('[Java] 同步回退检测完成，找到', allJava.length, '个 Java');
            } else {
              _javaDetectCache = result || { success: true, javaList: [], hasJava: false };
            }
          } catch (e) {
            console.error('[Java] 同步回退检测也失败:', e.message);
            _javaDetectCache = result || { success: true, javaList: [], hasJava: false };
          }
        }
        _javaDetecting = false;
        // 通知所有等待中的请求
        while (_javaDetectWaiters.length > 0) {
          const waiter = _javaDetectWaiters.shift();
          waiter(_javaDetectCache);
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

      // 异步检测：优先复用已安装的合适 Java，否则自动下载安装
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

          // 未找到：自动下载安装
          const sessionFile = path.join(ctx.dirs.DATA_DIR, `java-download-${aiSessionId}.json`);
          const s = ctx.sessions.javaInstallSessions.get(aiSessionId);
          if (s) {
            s.status = 'downloading';
            s.message = `正在自动下载 Java ${requiredVersion}...`;
            s.lastActivity = Date.now();
          }

          java.downloadJavaAsync(requiredVersion, aiSessionId, sessionFile, 0, null).then(() => {
            const fs2 = ctx.sessions.javaInstallSessions.get(aiSessionId);
            if (fs2) {
              fs2.status = 'completed';
              fs2.progress = 100;
              fs2.message = `Java ${requiredVersion} 安装成功`;
              fs2.lastActivity = Date.now();
            }
          }).catch((err) => {
            const fs2 = ctx.sessions.javaInstallSessions.get(aiSessionId);
            if (fs2) {
              fs2.status = 'failed';
              fs2.message = `安装失败: ${err.message}`;
              fs2.lastActivity = Date.now();
            }
          });

          // 轮询状态文件，同步进度到 javaInstallSessions
          const pollInterval = setInterval(() => {
            try {
              if (!fs.existsSync(sessionFile)) return;
              const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
              const fs2 = ctx.sessions.javaInstallSessions.get(aiSessionId);
              if (fs2 && data) {
                const fileStatus = data.status;
                fs2.status = fileStatus === 'completed' ? 'completed' : (fileStatus === 'error' || fileStatus === 'cancelled' ? 'failed' : 'downloading');
                fs2.progress = data.progress || 0;
                fs2.message = data.message || '';
                fs2.speed = data.speed || 0;
                fs2.downloadedBytes = data.downloadedBytes || 0;
                fs2.totalBytes = data.totalBytes || 0;
                fs2.lastActivity = Date.now();
                if (fs2.status === 'completed' || fs2.status === 'failed') {
                  clearInterval(pollInterval);
                  try { fs.unlinkSync(sessionFile); } catch (_) {}
                }
              }
            } catch (e) {}
          }, 500);

          // 5 分钟后强制清理
          setTimeout(() => { clearInterval(pollInterval); try { fs.unlinkSync(sessionFile); } catch (_) {} }, 5 * 60 * 1000);
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

    /* /api/java/installed - 返回已安装 Java 列表（含自定义 Java 与当前使用路径）
         * 复用 /api/java/detect 的 worker_thread 异步缓存结果，避免同步检测卡住 server.js
         */
        registerRoute('GET', '/api/java/installed', async (req, res, parsedUrl) => {
          try {
            // 复用异步缓存的检测结果
            let javaList = [];
            let detecting = false;
            if (_javaDetectCache && _javaDetectCache.javaList) {
              javaList = _javaDetectCache.javaList;
            } else if (_javaDetecting) {
              // 缓存正在构建中，等待完成
              detecting = true;
              const result = await new Promise((resolve) => {
                _javaDetectWaiters.push(resolve);
              });
              if (result && result.javaList) javaList = result.javaList;
              detecting = false;
            } else {
              // 无缓存且未检测：立即触发后台检测，返回 detecting 标志
              _refreshJavaCacheInBackground();
              detecting = true;
            }

            sendJSON(res, {
              java: javaList,
              total: javaList.length,
              detecting: detecting
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
