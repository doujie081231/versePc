/**
 * @file server/api/routes/game.js
 * @description 游戏运行相关路由 - 从 server.js handleAPI switch 语句抽取的游戏运行相关端点
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const { execSync } = require('child_process');
const sharedState = require('../../../main/shared-state');

let _serverModule = null;
// 延迟加载 server 模块，规避循环依赖
function _server() {
  if (_serverModule === null) {
    try { _serverModule = require('../../../server'); } catch (_) { _serverModule = {}; }
  }
  return _serverModule;
}

module.exports = {
  /**
   * 注册游戏运行相关路由
   * @param {Function} registerRoute - 路由注册函数
   * @param {Object} deps - 依赖对象（ctx/sendJSON/sendError/readBody 及各业务模块）
   * @returns {void}
   */
  register(registerRoute, deps) {
    const { ctx, sendJSON, sendError, readBody } = deps;
    const { versions, launch, diagnose, modloaders, accounts, utils, http, java, dependencies } = deps;

    /* /api/game/status - 返回正在运行的游戏实例列表 */
    registerRoute('GET', '/api/game/status', async (req, res, parsedUrl) => {
      const instances = [...ctx.sessions.gameInstances.values()].map((inst) => ({
        sessionId: inst.sessionId,
        versionId: inst.versionId,
        pid: inst.pid,
        lanPort: inst.lanPort,
        startTime: inst.startTime,
        gameReady: inst.gameReady || false,
        readyTime: inst.readyTime || null,
        loadStage: inst.loadStage || 0,
        launchDuration: inst.readyTime ? (inst.readyTime - inst.startTime) : null,
        running: true,
      }));
      sendJSON(res, {
        running: ctx.sessions.gameInstances.size > 0,
        instances,
        lanPort: ctx.sessions.detectedLanPort
      });
    });

    /* /api/game/stop - 停止指定或全部游戏实例（GET/POST 共用同一处理函数） */
    const stopHandler = async (req, res, parsedUrl) => {
      const stopData = parsedUrl.query.sessionId ? { sessionId: parsedUrl.query.sessionId } : (req.method === 'POST' ? await readBody(req).catch(() => ({})) : {});
      if (stopData.sessionId) {
        const inst = ctx.sessions.gameInstances.get(stopData.sessionId);
        if (inst) {
          try { inst.process.kill(); } catch (e) {}
          ctx.sessions.gameInstances.delete(stopData.sessionId);
          sendJSON(res, { success: true, message: '游戏实例已停止', sessionId: stopData.sessionId });
        } else {
          sendJSON(res, { success: false, error: '找不到该游戏实例' });
        }
      } else if (ctx.sessions.gameInstances.size > 0) {
        for (const [sid, inst] of ctx.sessions.gameInstances) {
          try { inst.process.kill(); } catch (e) {}
        }
        ctx.sessions.gameInstances.clear();
        sendJSON(res, { success: true, message: '所有游戏实例已停止' });
      } else {
        sendJSON(res, { success: false, error: '游戏未在运行' });
      }
    };
    registerRoute('GET', '/api/game/stop', stopHandler);
    registerRoute('POST', '/api/game/stop', stopHandler);

    /* /api/game/log - 查询游戏日志（兼容无 sessionId 的全局日志场景） */
    registerRoute('GET', '/api/game/log', async (req, res, parsedUrl) => {
      const logSessionId = parsedUrl.query.sessionId;
      const count = parseInt(parsedUrl.query.count || '100', 10);
      const offset = parseInt(parsedUrl.query.offset || '0', 10);
      if (logSessionId) {
        const inst = ctx.sessions.gameInstances.get(logSessionId);
        if (inst) {
          sendJSON(res, {
            lines: inst.logBuffer.slice(-(count + offset)).slice(0, count),
            total: inst.logBuffer.length,
            sessionId: logSessionId
          });
        } else {
          sendJSON(res, {
            lines: ctx.sessions.gameLogBuffer.filter((l) => l.includes(logSessionId)).slice(-(count + offset)).slice(0, count),
            total: ctx.sessions.gameLogBuffer.length,
            sessionId: logSessionId
          });
        }
      } else {
        sendJSON(res, {
          lines: ctx.sessions.gameLogBuffer.slice(-(count + offset)).slice(0, count),
          total: ctx.sessions.gameLogBuffer.length
        });
      }
    });

    /* /api/game/log/stream - 通过 SSE 推送游戏日志流 */
    registerRoute('GET', '/api/game/log/stream', async (req, res, parsedUrl) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      let lastLen = 0;
      let lastInstanceLen = 0;
      const SSE_BATCH_LIMIT = 200;
      let timer = null;
      let stopped = false;
      // SSE 轮询：优先推送实例日志，再推送全局日志缓冲
      const tick = () => {
        if (stopped) return;
        let activeInst = null;
        for (const [sid, inst] of ctx.sessions.gameInstances) {
          activeInst = inst;
          break;
        }
        if (activeInst && activeInst.logBuffer.length > lastInstanceLen) {
          const newLines = activeInst.logBuffer.slice(lastInstanceLen);
          for (let i = 0; i < newLines.length; i++) {
            res.write(`data: ${JSON.stringify({ line: newLines[i] })}\n\n`);
          }
          lastInstanceLen = activeInst.logBuffer.length;
        }
        if (ctx.sessions.gameLogBuffer.length > lastLen) {
          const raw = ctx.sessions.gameLogBuffer.length - lastLen;
          const take = Math.min(raw, SSE_BATCH_LIMIT);
          const newLines = ctx.sessions.gameLogBuffer.slice(lastLen, lastLen + take);
          // 小批量逐行推送，大批量合并为 batch 推送
          if (newLines.length <= 50) {
            for (let i = 0; i < newLines.length; i++) {
              res.write(`data: ${JSON.stringify({ line: newLines[i] })}\n\n`);
            }
          } else {
            res.write(`data: ${JSON.stringify({ batch: newLines })}\n\n`);
          }
          lastLen += take;
          if (raw > SSE_BATCH_LIMIT) {
            console.warn(`[LogStream] 日志积压 ${raw} 行, 仅推送 ${take} 行`);
          }
        }
        // 所有实例退出后推送 exited 事件并停止轮询
        if (ctx.sessions.gameInstances.size === 0 && lastLen > 0) {
          res.write(`data: ${JSON.stringify({ event: 'exited' })}\n\n`);
          stopped = true;
          return;
        }
        // 动态间隔：启动器最小化时降频到 3000ms，否则 800ms
        const delay = sharedState.getLauncherMinimized() ? 3000 : 800;
        timer = setTimeout(tick, delay);
      };
      timer = setTimeout(tick, 800);
      req.on('close', () => { stopped = true; if (timer) clearTimeout(timer); });
    });

    /* /api/game/diagnose - 诊断游戏环境（Java/版本/库/内存） */
    registerRoute('GET', '/api/game/diagnose', async (req, res, parsedUrl) => {
      const dgVersionId = parsedUrl.query.versionId;
      const issues = [];

      try {
        const settings = versions.loadSettingsCached();
        let javaPath = settings.javaPath;
        // 未配置 Java 时自动检测系统与内置 Java
        if (!javaPath) {
          const allJava = [...java.detectBundledJava(), ...java.detectSystemJava()];
          if (allJava.length > 0) javaPath = (allJava.find((j) => j.majorVersion >= 17) || allJava[0]).path;
        }

        if (!javaPath || !fs.existsSync(javaPath)) {
          issues.push({ level: 'error', message: '未找到Java运行环境', fix: '请在设置中配置Java路径或安装Java' });
        } else {
          try {
            const verOutput = execSync(`"${javaPath}" -version 2>&1`, { encoding: 'utf8', timeout: 5000 });
            const verMatch = verOutput.match(/version "([^"]+)"/);
            if (verMatch) {
              const ver = verMatch[1];
              const major = parseInt(ver.startsWith('1.') ? ver.split('.')[1] : ver.split('.')[0], 10);
              // 校验游戏版本与 Java 版本兼容性
              if (dgVersionId && !dgVersionId.includes('forge') && !dgVersionId.includes('fabric')) {
                const dgBaseVer = dgVersionId.split('-')[0];
                const dgVerParts = dgBaseVer.split('.').map(Number);
                const isAtLeast1205 = (dgVerParts[0] || 0) > 1 || ((dgVerParts[0] || 0) === 1 && (dgVerParts[1] || 0) > 20) || ((dgVerParts[0] || 0) === 1 && (dgVerParts[1] || 0) === 20 && (dgVerParts[2] || 0) >= 5);
                const isAtLeast117 = (dgVerParts[0] || 0) > 1 || ((dgVerParts[0] || 0) === 1 && (dgVerParts[1] || 0) >= 17);
                if (isAtLeast1205 && major < 21) {
                  issues.push({ level: 'error', message: `Minecraft 1.20.5+ 需要Java 21，当前Java版本: ${ver}`, fix: '请安装Java 21或更高版本' });
                } else if (isAtLeast117 && major < 16) {
                  issues.push({ level: 'error', message: `Minecraft 1.17+ 需要Java 16，当前Java版本: ${ver}`, fix: '请安装Java 16或更高版本' });
                }
              }
              try {
                const archOutput = execSync(`"${javaPath}" -XshowSettings:properties -version 2>&1`, { encoding: 'utf8', timeout: 5000 });
                if (!archOutput.includes('64') && settings.maxMemory > 1500) {
                  issues.push({ level: 'warn', message: '32位Java最大只能分配约1.5GB内存', fix: '请安装64位Java或降低内存分配' });
                }
              } catch (archErr) {
                issues.push({ level: 'info', message: '无法检测Java架构(32/64位)' });
              }
            }
          } catch (e) {
            issues.push({ level: 'warn', message: '无法检测Java版本', fix: '请确认Java安装正确' });
          }
        }

        // 校验版本文件与依赖库完整性
        if (dgVersionId) {
          const versionJson = versions.resolveVersionJson(dgVersionId);
          if (!versionJson) {
            issues.push({ level: 'error', message: `版本 ${dgVersionId} 的JSON文件缺失或损坏`, fix: '请重新安装此版本' });
          } else {
            if (versionJson.inheritsFrom) {
              const parentJsonPath = path.join(ctx.dirs.VERSIONS_DIR, versionJson.inheritsFrom, `${versionJson.inheritsFrom}.json`);
              if (!fs.existsSync(parentJsonPath)) {
                issues.push({ level: 'error', message: `缺少基础版本 ${versionJson.inheritsFrom}，请先安装`, fix: `安装原版 ${versionJson.inheritsFrom}` });
              }
              const parentJarPath = path.join(ctx.dirs.VERSIONS_DIR, versionJson.inheritsFrom, `${versionJson.inheritsFrom}.jar`);
              if (!fs.existsSync(parentJarPath)) {
                issues.push({ level: 'error', message: `缺少基础版本JAR文件`, fix: `重新安装原版 ${versionJson.inheritsFrom}` });
              }
            }

            const mainJar = path.join(ctx.dirs.VERSIONS_DIR, dgVersionId, `${dgVersionId}.jar`);
            if (!fs.existsSync(mainJar) && !versionJson.inheritsFrom) {
              issues.push({ level: 'error', message: '游戏主JAR文件缺失', fix: '请重新安装此版本' });
            }

            const missingLibs = [];
            for (const lib of (versionJson.libraries || [])) {
              const libNameSuffix = lib.name ? lib.name.split(':').pop() : '';
              if (libNameSuffix.startsWith('natives-')) continue;
              if (lib.rules && !versions.evaluateRules(lib.rules)) continue;
              if (lib.downloads?.artifact) {
                const libPath = path.join(ctx.dirs.LIBRARIES_DIR, lib.downloads.artifact.path);
                if (!fs.existsSync(libPath)) {
                  missingLibs.push(lib.name || lib.downloads.artifact.path);
                }
              }
            }
            if (missingLibs.length > 0) {
              issues.push({ level: 'warn', message: `${missingLibs.length} 个库文件缺失`, fix: '点击修复以重新下载缺失的库文件' });
            }
          }
        }

        if (settings.maxMemory < 1024) {
          issues.push({ level: 'warn', message: '分配内存过小（低于1GB），可能导致游戏卡顿', fix: '建议将最大内存设置为2GB以上' });
        }

        const totalMem = os.totalmem();
        if (settings.maxMemory > totalMem / (1024 * 1024) * 0.8) {
          issues.push({ level: 'warn', message: `分配内存接近系统总内存(${(totalMem / (1024 * 1024 * 1024)).toFixed(1)}GB)`, fix: '建议降低内存分配' });
        }

        if (issues.length === 0) {
          issues.push({ level: 'info', message: '未发现明显问题，可以尝试启动游戏', fix: '' });
        }

        sendJSON(res, { issues });
      } catch (e) {
        sendError(res, '诊断失败: ' + e.message);
      }
    });

    /* /api/game/crash-log - 获取最近一次崩溃报告 */
    registerRoute('GET', '/api/game/crash-log', async (req, res, parsedUrl) => {
      const crVersionId = parsedUrl.query.versionId;
      let crashLog = null;
      const searchDirs = [];

      if (crVersionId && versions.resolveVersionIsolation(crVersionId)) {
        searchDirs.push(path.join(ctx.dirs.VERSIONS_DIR, crVersionId, 'crash-reports'));
      }
      const settings = versions.loadSettingsCached();
      searchDirs.push(path.join(settings.gameDir || ctx.dirs.DATA_DIR, 'crash-reports'));

      for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).sort().reverse();
        if (files.length > 0) {
          try {
            const content = fs.readFileSync(path.join(dir, files[0]), 'utf8');
            crashLog = { file: files[0], content: content.substring(0, 10000), path: path.join(dir, files[0]) };
            break;
          } catch (e) {}
        }
      }

      sendJSON(res, { crashLog });
    });

    /* /api/game/exit-analysis - 返回上次游戏退出分析结果 */
    registerRoute('GET', '/api/game/exit-analysis', async (req, res, parsedUrl) => {
      sendJSON(res, { analysis: ctx.sessions.lastGameExitAnalysis });
    });

    /* /api/game/crash-analyze - 分析崩溃日志并给出原因与修复建议 */
    registerRoute('GET', '/api/game/crash-analyze', async (req, res, parsedUrl) => {
      const caVersionId = parsedUrl.query.versionId;
      if (!caVersionId) { sendError(res, 'Missing versionId', 400); return; }

      try {
        const caSettings = versions.loadSettingsCached();
        let caVersionDir = null;
        const caCleanId = caVersionId.replace(/ \[外部\d*\]/, '');
        const caExtFolders = versions.loadExternalFolders();
        for (const folder of caExtFolders) {
          if (!fs.existsSync(folder.path)) continue;
          const extVers = versions.scanExternalFolder(folder.path);
          if (extVers.some((v) => v.id === caCleanId)) {
            caVersionDir = path.join(folder.path, caCleanId);
            break;
          }
        }
        if (!caVersionDir) {
          caVersionDir = path.join(ctx.dirs.VERSIONS_DIR, caCleanId);
        }

        let crashContent = '';
        let latestLogContent = '';
        let hsErrContent = '';
        let logFile = null;

        // 读取崩溃报告（3 分钟内的才算本次崩溃）
        const crashReportsDir = path.join(caVersionDir, 'crash-reports');
        if (fs.existsSync(crashReportsDir)) {
          const crashFiles = fs.readdirSync(crashReportsDir)
            .filter((f) => f.startsWith('crash-') && f.endsWith('.txt'))
            .map((f) => ({ name: f, mtime: fs.statSync(path.join(crashReportsDir, f)).mtime }))
            .sort((a, b) => b.mtime - a.mtime);
          for (const cf of crashFiles) {
            const mtime = cf.mtime;
            if (Math.abs((mtime - new Date()) / 60000) < 3) {
              try {
                crashContent = fs.readFileSync(path.join(crashReportsDir, cf.name), 'utf8');
                logFile = 'crash-reports/' + cf.name;
                break;
              } catch (e) {}
            }
          }
        }

        // 读取 latest.log 末尾 500 行
        const latestLogPath = path.join(caVersionDir, 'logs', 'latest.log');
        if (fs.existsSync(latestLogPath)) {
          try {
            const lines = fs.readFileSync(latestLogPath, 'utf8').split('\n');
            latestLogContent = lines.slice(-500).join('\n');
            if (!logFile) logFile = 'logs/latest.log';
          } catch (e) {}
        }

        // 读取 JVM 崩溃日志（hs_err_pid，10 分钟内）
        try {
          const versionFiles = fs.readdirSync(caVersionDir);
          for (const vf of versionFiles) {
            if (vf.startsWith('hs_err_pid') && vf.endsWith('.log')) {
              const hsPath = path.join(caVersionDir, vf);
              const stat = fs.statSync(hsPath);
              if (Math.abs((stat.mtime - new Date()) / 60000) < 10) {
                try {
                  const hsLines = fs.readFileSync(hsPath, 'utf8').split('\n');
                  hsErrContent = hsLines.slice(0, 200).join('\n');
                  if (!logFile) logFile = vf;
                  break;
                } catch (e) {}
              }
            }
          }
        } catch (e) {}

        const allLog = crashContent + '\n' + latestLogContent + '\n' + hsErrContent;

        if (!allLog.trim()) {
          sendJSON(res, { found: false });
          return;
        }

        // 崩溃特征规则表：匹配关键字符串给出原因与解决方案
        // 按类别分组：JVM/内存/驱动/模组/文件系统/网络/通用
        const crashRules = [
          // === JVM 与内存 ===
          { pattern: 'java.lang.OutOfMemoryError', reason: '内存不足（OutOfMemoryError）', solution: 'Minecraft 可用内存不足。建议在启动设置中增加最大内存分配。如果已分配 8GB+，可以尝试减少模组数量或降低资源包分辨率。', severity: 'high' },
          { pattern: 'Out of Memory Error', reason: '内存不足', solution: 'JVM层面内存不足。建议增加分配内存或减少模组数量。', severity: 'high' },
          { pattern: 'The system is out of physical RAM', reason: '系统物理内存不足', solution: '系统物理内存不足。建议关闭其他程序释放内存，或增加分配的内存。', severity: 'high' },
          { pattern: 'Could not reserve enough space', reason: '无法分配足够的内存空间', solution: '系统无法为 JVM 分配请求的内存。尝试减少分配内存，或关闭其他占用内存的程序。', severity: 'high' },
          { pattern: 'Could not create the Java Virtual Machine', reason: '无法创建JVM', solution: 'JVM 创建失败，可能原因：1）Java路径指向非64位版本 2）分配内存超过系统可用量。请在设置中检查和调整 Java 路径与最大内存。', severity: 'high' },
          { pattern: 'java.lang.StackOverflowError', reason: '栈溢出', solution: '游戏出现了无限的递归调用或循环。通常是模组问题，尝试更新到最新版本或移除最近添加的模组。', severity: 'medium' },
          { pattern: 'java.lang.NullPointerException', reason: '空指针异常', solution: '某个模组尝试访问未初始化的对象。通常是模组不兼容或配置错误，尝试更新到最新版本或移除最近添加的模组。', severity: 'medium' },
          { pattern: 'java.lang.ArrayIndexOutOfBoundsException', reason: '数组越界', solution: '游戏数据索引超出范围。通常与模组数据生成或存档损坏有关，尝试备份存档后重新生成区域。', severity: 'medium' },
          { pattern: 'java.lang.StringIndexOutOfBoundsException', reason: '字符串索引越界', solution: '模组处理文本数据时越界。常出现在汉化资源包或模组语言文件问题，尝试更新模组或移除汉化资源包。', severity: 'medium' },
          { pattern: 'java.lang.ClassNotFoundException', reason: '类找不到', solution: 'Java类文件缺失。通常是模组文件损坏或下载不完整，尝试删除对应模组后重新下载。', severity: 'high' },
          { pattern: 'java.lang.NoClassDefFoundError', reason: '类定义找不到', solution: 'Java类文件定义缺失。通常是模组升级后遗留旧文件或缺少前置模组，检查并安装所有必需的前置模组。', severity: 'high' },
          { pattern: 'java.lang.NoSuchMethodError', reason: '方法找不到', solution: '模组版本不兼容。通常是模组需要特定版本的另一个模组，请检查模组版本兼容性。', severity: 'medium' },
          { pattern: 'java.lang.IllegalAccessError', reason: '非法访问错误', solution: '模组尝试访问被禁止的类/方法。常发生在 Java 17+ 上运行旧版模组，尝试升级模组或使用较低版本的 Java。', severity: 'high' },
          { pattern: 'java.lang.reflect.InvocationTargetException', reason: '反射调用异常', solution: '模组通过反射调用其他模组方法时出错。通常是模组兼容性问题，尝试更新到最新版本。', severity: 'medium' },
          { pattern: 'java.lang.ConcurrentModificationException', reason: '并发修改异常', solution: '多线程同时修改数据。可能与优化模组或核心模组冲突有关，尝试移除最近添加的性能优化模组。', severity: 'medium' },
          { pattern: 'Module java.base does not export', reason: 'Java模块访问限制', solution: '当前 Java 版本过高（Java 17+）导致与旧版代码不兼容。需要添加 JVM 启动参数 --add-exports/--add-opens，或降级 Java 版本。', severity: 'high' },
          { pattern: 'because module java.base does not export', reason: 'Java版本过高导致模块限制', solution: '当前Java版本过高，导致与游戏不兼容。请降低Java版本（推荐Java 8或11）。', severity: 'high' },
          { pattern: 'NoSuchFieldException: ucp', reason: 'Java版本过高', solution: '当前Java版本过高，导致与游戏不兼容。请降低Java版本（推荐Java 8或11）。', severity: 'high' },
          { pattern: 'Unsupported class file major version', reason: 'Java版本不兼容（版本过高）', solution: '当前Java版本过低，无法运行该版本的游戏或模组。请安装更高版本的Java。\n例如: 1.17+ 需要 Java 17, 1.12-1.16 需要 Java 8。', severity: 'high' },
          { pattern: 'Unsupported major.minor version', reason: 'Java版本不兼容（版本过高）', solution: '当前Java版本过低，无法运行该版本的游戏或模组。请安装更高版本的Java。', severity: 'high' },
          { pattern: 'Open J9 is not supported', reason: '不支持的JVM实现', solution: 'Minecraft 不支持 OpenJ9 虚拟机。请在设置中更换为 HotSpot JVM（如 Oracle JDK、OpenJDK HotSpot、Adoptium Temurin）。', severity: 'high' },
          { pattern: 'java.lang.ArithmeticException', reason: '算术异常', solution: '数学运算出错（如除零错误）。通常是模组数据配置错误，检查最近安装的模组配置。', severity: 'medium' },
          { pattern: 'java.lang.ClassCastException', reason: '类型转换异常', solution: 'Java类类型转换失败。当模组期望一种类型但收到另一种类型时发生。通常由模组版本不匹配或冲突引起。', severity: 'medium' },

          // === 显卡/OpenGL/窗口 ===
          { pattern: 'The driver does not appear to support OpenGL', reason: '显卡不支持OpenGL', solution: '请更新显卡驱动，或确认您的显卡支持OpenGL。部分集成显卡或老旧显卡可能无法运行Minecraft 1.17+。', severity: 'high' },
          { pattern: 'Pixel format not accelerated', reason: '显卡驱动加速失败', solution: '显卡驱动不支持所需的像素格式。请更新显卡驱动至最新版本。NVIDIA用户可尝试在控制面板中将Javaw设置为高性能显卡。', severity: 'high' },
          { pattern: "Couldn't set pixel format", reason: '像素格式设置失败', solution: '显卡驱动不支持所需的像素格式。请更新显卡驱动至最新版本。', severity: 'high' },
          { pattern: '1282: Invalid operation', reason: 'OpenGL错误', solution: '光影或资源包导致了OpenGL错误。请尝试：1）移除当前光影 2）更换低分辨率资源包 3）更新显卡驱动。', severity: 'medium' },
          { pattern: 'Maybe try a lower resolution resourcepack', reason: '材质过大', solution: '当前使用的资源包分辨率过高，导致内存不足。请尝试使用更低分辨率（如 32x/16x）的资源包。', severity: 'medium' },
          { pattern: 'GLFW error', reason: 'GLFW窗口创建失败', solution: '游戏窗口创建失败。检查：1）显卡驱动是否最新 2）分辨率设置是否超出显示器支持范围 3）是否开启了全屏独占模式。', severity: 'high' },
          { pattern: 'WGL: The driver does not appear to support OpenGL', reason: '显卡驱动不支持OpenGL', solution: '显卡驱动问题或OpenGL版本过低。请更新显卡驱动，Windows用户请确保已安装DirectX和VC++运行库。', severity: 'high' },
          { pattern: 'Failed to create window', reason: '窗口创建失败', solution: 'Minecraft游戏窗口创建失败。尝试：1）在启动设置中修改分辨率 2）关闭全屏模式 3）更新显卡驱动。', severity: 'high' },
          { pattern: 'Could not initialize class org.lwjgl', reason: 'LWJGL初始化失败', solution: 'LWJGL（游戏图形库）初始化失败。通常是显卡驱动问题或缺少必要的系统运行库，请更新显卡驱动和VC++运行库。', severity: 'high' },

          // === 模组加载 ===
          { pattern: 'LoaderExceptionModCrash', reason: '模组导致崩溃', solution: '某个模组导致了游戏崩溃。请查看下方的错误日志摘要中的模组名称，尝试删除或更新该模组。', severity: 'medium', modExtract: /Caught exception from (\S+)/ },
          { pattern: 'Caught exception from ', reason: '模组异常', solution: '某个模组导致了游戏崩溃。请查看下方的错误日志摘要中的模组名称，尝试删除或更新该模组。', severity: 'medium', modExtract: /Caught exception from (\S+)/ },
          { pattern: 'Found duplicate mods', reason: '模组重复安装', solution: '检测到重复安装的模组。请检查 mods 文件夹，删除重复的模组文件（保留较新的版本）。', severity: 'medium' },
          { pattern: 'DuplicateModsFoundException', reason: '模组重复安装', solution: '检测到重复安装的模组。请检查 mods 文件夹，删除重复的模组文件。', severity: 'medium' },
          { pattern: 'Incompatible mods found', reason: '模组互不兼容', solution: '检测到互不兼容的模组。请查看详细信息，删除冲突的模组之一。', severity: 'medium' },
          { pattern: 'Missing or unsupported mandatory dependencies', reason: '模组缺少前置', solution: '某些模组缺少必要的前置模组。请查看下方的错误日志摘要，安装缺少的前置模组。', severity: 'medium' },
          { pattern: 'Mod File {}, requires a dependency on', reason: '模组缺少前置', solution: '模组依赖的前置模组缺失。请安装所需的前置模组到 mods 文件夹。', severity: 'medium' },
          { pattern: 'Mixin apply failed', reason: 'Mixin注入失败', solution: '模组的 Mixin 注入失败。通常是不兼容的模组正在修改同一段游戏代码，尝试更新或移除冲突模组。', severity: 'medium' },
          { pattern: 'mixin conflict', reason: 'Mixin冲突', solution: '两个或多个模组尝试修改同一段游戏代码导致冲突。尝试移除最近安装的模组之一。', severity: 'medium' },
          { pattern: 'Failed to load mixin', reason: 'Mixin加载失败', solution: '模组的 Mixin 配置加载失败。可能是模组文件损坏或不完整，尝试重新下载该模组。', severity: 'medium' },
          { pattern: 'net.minecraftforge.fml.loading.FMLPaths', reason: 'Forge路径加载错误', solution: 'Forge 路径初始化失败。检查游戏目录权限，尝试在版本设置中执行文件修复。', severity: 'medium' },
          { pattern: 'fmlclient', reason: 'Forge启动目标缺失', solution: 'Forge安装不完整，缺少必要的启动文件。请重新安装 Forge。', severity: 'high' },
          { pattern: 'Cannot find launch target', reason: '启动目标缺失', solution: '模组加载器启动目标缺失。请重新安装当前使用的加载器（Forge/Fabric/Quilt/NeoForge）。', severity: 'high' },
          { pattern: 'Shaders Mod detected. Please remove it', reason: 'ShadersMod与OptiFine冲突', solution: 'ShadersMod（旧版光影模组）与 OptiFine（或 Embeddium/Oculus）冲突。新的光影支持已内置，请删除 ShadersMod。', severity: 'medium' },
          { pattern: 'The directories below appear to be extracted jar files', reason: '模组文件被解压', solution: '检测到模组文件被解压到 mods 文件夹中。请删除这些解压后的文件夹，只保留 .jar 文件。', severity: 'medium' },
          { pattern: 'NeoForge has detected a mod that is not working correctly', reason: 'NeoForge兼容性问题', solution: 'NeoForge 检测到不兼容的模组。请更新提示中提到的模组至最新版本。', severity: 'medium' },

          // === 文件系统 ===
          { pattern: 'ZipException', reason: 'JAR文件损坏', solution: '某个模组或库文件（.jar）已损坏。通常由下载中断或磁盘错误引起。\n解决方法：1）在版本设置中执行文件修复 2）删除错误提示中的文件让启动器重新下载 3）检查硬盘健康状态。', severity: 'high' },
          { pattern: 'invalid stream header', reason: 'JAR文件损坏', solution: '模组或库文件的 ZIP/JAR 头部损坏。请删除对应文件并重新下载。', severity: 'high' },
          { pattern: 'Unexpected error reading file', reason: '文件读取错误', solution: '游戏读取文件时出错。检查：1）硬盘是否有坏道 2）文件是否被其他程序占用 3）杀毒软件是否隔离了游戏文件。', severity: 'medium' },
          { pattern: 'Failed to download', reason: '下载失败', solution: '游戏文件下载失败。请检查网络连接后重试，如持续失败可尝试切换下载镜像源。', severity: 'medium' },
          { pattern: 'Could not read file', reason: '无法读取文件', solution: '无法读取游戏资源文件。可能是文件权限问题或文件损坏，尝试修复游戏文件或检查磁盘。', severity: 'medium' },
          { pattern: 'FileNotFoundException', reason: '文件找不到', solution: '游戏需要但找不到某个文件。可能是杀毒软件误删、文件损坏或磁盘错误，尝试在版本设置中执行文件修复。', severity: 'medium' },
          { pattern: 'java.nio.file.AccessDeniedException', reason: '文件访问被拒绝', solution: '启动器或游戏无权访问某个文件/目录。检查：1）文件夹权限设置 2）杀毒软件是否拦截 3）文件是否被其他进程锁定。', severity: 'medium' },
          { pattern: 'IOException', reason: '输入输出错误', solution: '文件读写发生错误。可能是硬盘故障、文件被占用或杀毒软件拦截。尝试关闭杀毒软件后重试，或在版本设置中执行文件修复。', severity: 'medium' },

          // === 网络 ===
          { pattern: 'Connection refused', reason: '连接被拒绝', solution: '无法连接到目标服务器。检查：1）目标服务器是否在线 2）防火墙是否阻止连接 3）网络代理设置是否正确。', severity: 'low' },
          { pattern: 'Connection reset', reason: '连接被重置', solution: '网络连接被中断。通常由网络不稳定或防火墙拦截引起，检查网络连接和防火墙设置。', severity: 'low' },
          { pattern: 'SocketException', reason: '网络套接字异常', solution: '网络连接异常。检查网络稳定性，尝试更换网络或使用加速器。', severity: 'low' },
          { pattern: 'Unknown host', reason: '无法解析主机名', solution: 'DNS解析失败，无法找到目标服务器地址。检查网络连接和DNS设置。', severity: 'low' },
          { pattern: 'Connect timed out', reason: '连接超时', solution: '连接服务器超时。服务器可能未开机、网络不稳定或防火墙拦截，请稍后重试。', severity: 'low' },

          // === 通用/其他 ===
          { pattern: 'KubeJS', reason: 'KubeJS模组错误', solution: 'KubeJS 脚本执行出错。检查 kubejs/server_scripts 或 kubejs/client_scripts 中的脚本语法，或更新 KubeJS 模组。', severity: 'medium' },
          { pattern: 'Paxi', reason: 'Paxi模组加载错误', solution: 'Paxi（数据包加载模组）出错。检查 paxi_resources 目录中的资源包或数据包文件是否完整。', severity: 'medium' },
          { pattern: 'Caused by: java.lang.RuntimeException', reason: '运行时异常', solution: '游戏运行时发生了未预料的异常。请查看下方的错误日志摘要获取详细错误信息。', severity: 'medium' },
          { pattern: 'FATAL', reason: '致命错误', solution: 'Minecraft 遇到了致命错误并停止运行。请查看下方的错误日志摘要获取详细信息。', severity: 'high' },
        ];

        // 提取崩溃日志关键行（用于前端展示详细错误报告）
        function extractKeyLines(content, source) {
          if (!content) return [];
          const lines = content.split('\n');
          const keyLines = [];
          const keywords = [
            'Exception', 'Error', 'Caused by', 'at ', 'Failed', 'failed',
            'Cannot', 'cannot', 'Missing', 'missing', 'Unable', 'unable',
            'java.lang.', 'net.minecraft.', 'org.', 'com.', 'FATAL',
            'Error:', 'Exception:', 'Stacktrace', 'Description:'
          ];
          for (let i = 0; i < lines.length && keyLines.length < 100; i++) {
            const line = lines[i].trim();
            if (!line || line.length > 300) continue;
            // 跳过纯空白和分隔线
            if (/^[-=/*#]+$/.test(line)) continue;
            for (const kw of keywords) {
              if (line.includes(kw)) {
                keyLines.push({ source, line, lineNum: i + 1 });
                break;
              }
            }
          }
          return keyLines;
        }

        const logExcerpt = [
          ...extractKeyLines(crashContent, 'crash-report'),
          ...extractKeyLines(hsErrContent, 'hs_err'),
          ...extractKeyLines(latestLogContent.slice(-500), 'latest.log')
        ].slice(0, 80);

        // 提取崩溃报告详细描述：包含 Description、完整堆栈、影响模组等
        function extractCrashDescription(content) {
          if (!content) return '';
          const parts = [];
          // 提取 Description 段落
          const descMatch = content.match(/Description:\s*([\s\S]*?)(?=\n\S|$)/);
          if (descMatch) {
            parts.push('【崩溃描述】');
            parts.push(descMatch[1].trim().slice(0, 600));
          }
          // 提取 Affected mod 段落（Forge 会列出受影响模组）
          const modMatch = content.match(/Affected mods?:?\s*([\s\S]*?)(?=\n\n|\n---|$)/);
          if (modMatch) {
            const modSection = modMatch[1].trim().slice(0, 500);
            if (modSection) {
              parts.push('');
              parts.push('【受影响模组】');
              parts.push(modSection);
            }
          }
          // 提取堆栈关键部分（Caused by 链）
          const causedLines = [];
          const clines = content.split('\n');
          for (let i = 0; i < clines.length; i++) {
            const l = clines[i];
            if (l.includes('Caused by:') || l.includes('at net.minecraft') || l.includes('at ') && (l.includes('.java:') || l.includes('(Unknown Source)'))) {
              causedLines.push(l.trim().slice(0, 250));
              if (causedLines.length >= 30) break;
            }
          }
          if (causedLines.length > 0) {
            parts.push('');
            parts.push('【调用堆栈】');
            parts.push(causedLines.join('\n'));
          }
          return parts.join('\n');
        }

        const crashDescription = crashContent ? extractCrashDescription(crashContent) : '';

        // 可自动修复的问题类型映射：fixType → V岛执行的操作描述
        const autoFixMap = {
          'java.lang.OutOfMemoryError': { fixType: 'memory', fixDesc: '内存不足，需要增加内存分配' },
          'Out of Memory Error': { fixType: 'memory', fixDesc: '内存不足，需要增加内存分配' },
          'The system is out of physical RAM': { fixType: 'memory', fixDesc: '系统物理内存不足，需要增加内存分配' },
          'Could not reserve enough space': { fixType: 'memory', fixDesc: '无法分配足够内存，需要调整内存设置' },
          'Could not create the Java Virtual Machine': { fixType: 'memory', fixDesc: 'JVM创建失败，可能是内存设置问题' },
          'Missing or unsupported mandatory dependencies': { fixType: 'missing-dep', fixDesc: '缺少前置模组，需要安装缺失的依赖' },
          'Mod File {}, requires a dependency on': { fixType: 'missing-dep', fixDesc: '模组缺少前置依赖，需要安装' },
          'Caught exception from ': { fixType: 'mod-crash', fixDesc: '模组崩溃，需要更新或移除问题模组' },
          'LoaderExceptionModCrash': { fixType: 'mod-crash', fixDesc: '模组崩溃，需要更新或移除问题模组' },
          'Found duplicate mods': { fixType: 'duplicate-mod', fixDesc: '模组重复安装，需要删除重复文件' },
          'DuplicateModsFoundException': { fixType: 'duplicate-mod', fixDesc: '模组重复安装，需要删除重复文件' },
          'Incompatible mods found': { fixType: 'mod-conflict', fixDesc: '模组互不兼容，需要移除冲突模组' },
          'mixin conflict': { fixType: 'mod-conflict', fixDesc: 'Mixin冲突，需要移除冲突模组' },
          'Mixin apply failed': { fixType: 'mod-crash', fixDesc: 'Mixin注入失败，需要更新或移除问题模组' },
          'ZipException': { fixType: 'file-corrupt', fixDesc: '文件损坏，需要重新下载' },
          'invalid stream header': { fixType: 'file-corrupt', fixDesc: '文件损坏，需要重新下载' },
          'FileNotFoundException': { fixType: 'file-missing', fixDesc: '文件缺失，需要修复' },
          'Could not read file': { fixType: 'file-corrupt', fixDesc: '文件读取失败，可能已损坏' },
          'Cannot find launch target': { fixType: 'loader-missing', fixDesc: '加载器启动文件缺失，需要重新安装' },
          'fmlclient': { fixType: 'loader-missing', fixDesc: 'Forge安装不完整，需要重新安装' },
        };

        let result = { found: false };
        for (const rule of crashRules) {
          if (allLog.includes(rule.pattern)) {
            let modName = null;
            if (rule.modExtract) {
              const match = allLog.match(rule.modExtract);
              if (match) modName = match[1];
            }
            // 检查是否可自动修复
            const fixInfo = autoFixMap[rule.pattern] || null;
            result = {
              found: true,
              reason: rule.reason,
              solution: rule.solution,
              modName: modName,
              logFile: logFile,
              severity: rule.severity,
              logExcerpt,
              crashDescription,
              fixType: fixInfo ? fixInfo.fixType : null,
              fixDesc: fixInfo ? fixInfo.fixDesc : null
            };
            break;
          }
        }

        // 规则表未命中时回退到 CrashAnalyzer 模块
        if (!result.found) {
          const { CrashAnalyzer } = require('../../crashAnalyzer');
          try {
            const analyzer = new CrashAnalyzer(null, caVersionDir);
            await analyzer.collect(caCleanId, []);
            if (analyzer.analyzeRawFiles.length > 0) {
              analyzer.prepare();
              analyzer.analyze();
              if (analyzer.crashReasons.size > 0) {
                const [reason, additional] = analyzer.crashReasons.entries().next().value;
                const detail = analyzer.getAnalyzeResult(false);
                result = {
                  found: true,
                  reason: reason,
                  solution: detail || '',
                  modName: additional && additional.length > 0 ? additional.join(', ') : null,
                  logFile: logFile,
                  severity: 'medium',
                  logExcerpt,
                  crashDescription
                };
              }
            }
          } catch (e) {
            console.error('[CrashAnalyze] CrashAnalyzer fallback failed:', e.message);
          }
        }

        // 最终回退：文件系统找不到崩溃日志时（游戏秒崩来不及写 crash-reports），
        // 用后端收集的 lastGameExitAnalysis 数据（进程退出码分析 + stdout/stderr logBuffer）
        if (!result.found && ctx.sessions.lastGameExitAnalysis) {
          const ea = ctx.sessions.lastGameExitAnalysis;
          if (ea.isCrash) {
            const bufLines = Array.isArray(ea.logBuffer) ? ea.logBuffer : [];
            const fallbackExcerpt = bufLines.slice(-80).map((line) => {
              const trimmed = String(line).trim();
              if (!trimmed) return null;
              // 标记来源：含 [VersePC] 的是启动器输出，其余是游戏输出
              const source = trimmed.startsWith('[VersePC]') ? 'launcher' : 'latest.log';
              return { source, line: trimmed };
            }).filter(Boolean);

            // 从进程输出提取错误相关行构造崩溃描述
            let fallbackDescription = '';
            const errorLines = bufLines
              .map(l => String(l).trim())
              .filter(l => l && (
                l.includes('Exception') || l.includes('Error') ||
                l.includes('error') || l.includes('ERROR') ||
                l.includes('Failed') || l.includes('failed') ||
                l.includes('at ') || l.includes('Caused by')
              ));
            if (errorLines.length > 0) {
              fallbackDescription = '【进程错误输出】\n' + errorLines.slice(-25).join('\n');
            }
            if (ea.code !== undefined) {
              fallbackDescription = (fallbackDescription ? fallbackDescription + '\n\n' : '') +
                `【进程信息】\n退出码: ${ea.code}\n${ea.reason ? '退出原因: ' + ea.reason : ''}`;
            }

            result = {
              found: true,
              reason: ea.reason || `游戏异常退出（退出码: ${ea.code}）`,
              solution: ea.suggestion || '请查看日志获取更多信息，或尝试重新启动游戏。',
              modName: null,
              logFile: logFile || '(进程输出)',
              severity: ea.code === 0 ? 'low' : (ea.code === 137 || /内存|OOM|OutOfMemory/i.test(ea.reason || '') ? 'high' : 'medium'),
              logExcerpt: fallbackExcerpt,
              crashDescription: fallbackDescription
            };
          }
        }

        sendJSON(res, result);
      } catch (e) {
        sendError(res, '崩溃分析失败: ' + e.message);
      }
    });

    /* /api/game/play-time - 统计存档游戏时间与会话时长 */
    registerRoute('GET', '/api/game/play-time', async (req, res, parsedUrl) => {
      const ptVersionId = parsedUrl.query.versionId;
      if (!ptVersionId) { sendError(res, 'Missing versionId', 400); return; }

      try {
        const ptSettings = versions.loadSettingsCached();
        let ptVersionDir = null;
        const ptCleanId = ptVersionId.replace(/ \[外部\d*\]/, '');
        const ptExtFolders = versions.loadExternalFolders();
        for (const folder of ptExtFolders) {
          if (!fs.existsSync(folder.path)) continue;
          const extVers = versions.scanExternalFolder(folder.path);
          if (extVers.some((v) => v.id === ptCleanId)) {
            ptVersionDir = path.join(folder.path, ptCleanId);
            break;
          }
        }
        if (!ptVersionDir) {
          ptVersionDir = path.join(ctx.dirs.VERSIONS_DIR, ptCleanId);
        }

        // 解析各存档的 level.dat 读取游戏时长（ticks）
        const worlds = [];
        const savesDir = path.join(ptVersionDir, 'saves');
        if (fs.existsSync(savesDir)) {
          const saves = fs.readdirSync(savesDir).filter((d) => {
            return fs.existsSync(path.join(savesDir, d, 'level.dat'));
          });
          for (const save of saves) {
            try {
              const levelDat = fs.readFileSync(path.join(savesDir, save, 'level.dat'));
              const decompressed = zlib.gunzipSync(levelDat);
              const timeStr = 'Time';
              for (let i = 0; i < decompressed.length - 20; i++) {
                if (decompressed[i] === 4 &&
                  decompressed[i + 1] === 0 && decompressed[i + 2] === 4) {
                  const name = decompressed.slice(i + 3, i + 7).toString('ascii');
                  if (name === timeStr) {
                    const value = decompressed.readBigInt64BE(i + 7);
                    const totalSeconds = Number(value) / 20;
                    worlds.push({
                      worldName: save,
                      ticks: Number(value),
                      seconds: totalSeconds,
                      formatted: utils.formatPlayTime(totalSeconds)
                    });
                    break;
                  }
                }
              }
            } catch (e) {}
          }
        }

        // 读取会话累计游戏时间
        const playTimePath = path.join(ctx.dirs.DATA_DIR, 'play-time.json');
        let sessionData = {};
        try {
          if (fs.existsSync(playTimePath)) {
            sessionData = JSON.parse(fs.readFileSync(playTimePath, 'utf8'));
          }
        } catch (e) {}

        const versionSession = sessionData[ptVersionId] || {};
        const totalSessionSeconds = versionSession.totalSeconds || 0;
        const lastPlayed = versionSession.lastPlayed || null;
        const playCount = versionSession.playCount || 0;

        sendJSON(res, {
          worlds,
          session: {
            totalSeconds: totalSessionSeconds,
            formatted: utils.formatPlayTime(totalSessionSeconds),
            lastPlayed: lastPlayed,
            playCount: playCount
          }
        });
      } catch (e) {
        sendError(res, '获取游戏时间失败: ' + e.message);
      }
    });

    /* /api/game/log/export - 导出环境信息与日志为文本文件 */
    registerRoute('GET', '/api/game/log/export', async (req, res, parsedUrl) => {
      try {
        const exportVersionId = parsedUrl.query.versionId || '';
        const exportParts = [];
        exportParts.push('='.repeat(60));
        exportParts.push('VersePC 游戏日志导出');
        exportParts.push(`导出时间: ${new Date().toLocaleString()}`);
        exportParts.push(`版本: ${exportVersionId || '未知'}`);
        exportParts.push('='.repeat(60));
        exportParts.push('');

        const settings = versions.loadSettingsCached();
        exportParts.push(`[环境信息]`);
        exportParts.push(`数据目录: ${ctx.dirs.DATA_DIR}`);
        exportParts.push(`JAVA_DIR: ${ctx.dirs.JAVA_DIR}`);
        exportParts.push(`Java路径: ${settings.javaPath || '自动检测'}`);
        if (settings.javaPath && fs.existsSync(settings.javaPath)) {
          const _pInfo = java.getJavaVersionInfo(settings.javaPath);
          exportParts.push(`Java路径版本: ${_pInfo.version} (major=${_pInfo.major})`);
        }
        exportParts.push(`JAVA_HOME: ${process.env.JAVA_HOME || '未设置'}`);
        exportParts.push(`最大内存: ${settings.maxMemory || 2048}MB`);
        exportParts.push(`版本隔离: ${settings.versionIsolation ? '是' : '否'}`);
        exportParts.push('');

        exportParts.push(`[Java检测]`);
        try {
          const _sysJava = java.detectSystemJava();
          const _bunJava = java.detectBundledJava();
          exportParts.push(`系统Java: ${_sysJava.length}个`);
          _sysJava.forEach((j) => exportParts.push(`  - ${j.path} (版本=${j.version}, major=${j.majorVersion}, 来源=${j.source})`));
          exportParts.push(`内置Java: ${_bunJava.length}个`);
          _bunJava.forEach((j) => exportParts.push(`  - ${j.path} (版本=${j.version}, major=${j.majorVersion}, 来源=${j.source})`));
          if (fs.existsSync(ctx.dirs.JAVA_DIR)) {
            const _javaDirs = fs.readdirSync(ctx.dirs.JAVA_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
            exportParts.push(`JAVA_DIR内容: ${_javaDirs.map((d) => d.name).join(', ')}`);
          }
          const _mcRuntime = path.join(ctx.dirs.MINECRAFT_DIR, 'runtime');
          if (fs.existsSync(_mcRuntime)) {
            const _rtDirs = fs.readdirSync(_mcRuntime, { withFileTypes: true }).filter((d) => d.isDirectory());
            exportParts.push(`.minecraft/runtime内容: ${_rtDirs.map((d) => d.name).join(', ')}`);
          }
        } catch (e) {
          exportParts.push(`Java检测异常: ${e.message}`);
        }
        exportParts.push('');

        if (ctx.sessions.lastGameExitAnalysis) {
          exportParts.push(`[上次退出分析]`);
          exportParts.push(`退出码: ${ctx.sessions.lastGameExitAnalysis.code}`);
          exportParts.push(`原因: ${ctx.sessions.lastGameExitAnalysis.reason}`);
          exportParts.push(`建议: ${ctx.sessions.lastGameExitAnalysis.suggestion}`);
          exportParts.push(`是否崩溃: ${ctx.sessions.lastGameExitAnalysis.isCrash ? '是' : '否'}`);
          if (ctx.sessions.lastGameExitAnalysis.versionId) exportParts.push(`版本ID: ${ctx.sessions.lastGameExitAnalysis.versionId}`);
          exportParts.push('');
        }

        if (ctx.sessions.gameLogBuffer.length > 0) {
          exportParts.push(`[游戏日志] (最近 ${Math.min(ctx.sessions.gameLogBuffer.length, 2000)} 行)`);
          exportParts.push('-'.repeat(40));
          const exportLogs = ctx.sessions.gameLogBuffer.slice(-2000);
          exportParts.push(...exportLogs);
          exportParts.push('');
        }

        if (exportVersionId) {
          const crashReportsDir = versions.getVersionSubDir(exportVersionId, 'crash-reports');
          if (crashReportsDir && fs.existsSync(crashReportsDir)) {
            const crashFiles = fs.readdirSync(crashReportsDir)
              .filter((f) => f.startsWith('crash-') && f.endsWith('.txt'))
              .sort().reverse();
            if (crashFiles.length > 0) {
              try {
                const crashContent = fs.readFileSync(path.join(crashReportsDir, crashFiles[0]), 'utf8');
                exportParts.push(`[最新崩溃报告] ${crashFiles[0]}`);
                exportParts.push('-'.repeat(40));
                exportParts.push(crashContent.substring(0, 5000));
                if (crashContent.length > 5000) exportParts.push(`... (已截断，共${crashContent.length}字符)`);
                exportParts.push('');
              } catch (_) {}
            }
          }

          const logsDir = versions.getVersionSubDir(exportVersionId, 'logs');
          const latestLogPath = path.join(logsDir, 'latest.log');
          if (fs.existsSync(latestLogPath)) {
            try {
              const logContent = fs.readFileSync(latestLogPath, 'utf8');
              exportParts.push(`[latest.log] (最后 2000 行)`);
              exportParts.push('-'.repeat(40));
              const logLines = logContent.split('\n');
              exportParts.push(...logLines.slice(-2000));
              exportParts.push('');
            } catch (_) {}
          }
        }

        const exportContent = exportParts.join('\n');
        const exportFileName = `VersePC_Log_${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}.txt`;
        const exportPath = path.join(ctx.dirs.DATA_DIR, 'temp', exportFileName);
        if (!fs.existsSync(path.dirname(exportPath))) fs.mkdirSync(path.dirname(exportPath), { recursive: true });
        fs.writeFileSync(exportPath, exportContent, 'utf8');

        res.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(exportFileName)}"`,
          'Content-Length': Buffer.byteLength(exportContent, 'utf8')
        });
        res.end(exportContent);
        try { fs.unlinkSync(exportPath); } catch (_) {}
      } catch (exportErr) {
        sendError(res, '导出日志失败: ' + exportErr.message, 500);
      }
    });
  }
};
