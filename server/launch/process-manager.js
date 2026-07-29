/**
 * @file server/launch/process-manager.js
 * @description 进程管理模块。从原 server/launch.js 拆分而来。
 *              包含：JVM 预热、性能优化、doLaunch（实际启动进程）。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const ctx = require('../context');
const utils = require('../utils');
const java = require('../java');
const versions = require('../versions');
const natives = require('../natives');
const shared = require('./shared');
const argsBuilder = require('./args-builder');

// 将跨模块函数绑定到本地名（保持 doLaunch/preheatJvm 内部调用不变）
const buildLaunchArguments = argsBuilder.buildLaunchArguments;
const DoRound = shared.DoRound;
const analyzeExitCode = shared.analyzeExitCode;
const setGameLanguage = shared.setGameLanguage;
const applyWindowSettings = shared.applyWindowSettings;

// 模块级：活跃的游戏日志定时器集合 + JVM 预热 PID 列表
// 用于应用退出时统一清理，避免泄漏
const _activeLogTimers = new Set();
if (!global._preheatPids) global._preheatPids = [];

/**
 * 清理所有游戏日志定时器（app.before-quit 时调用）
 * @returns {void}
 */
function cleanupGameLogs() {
  for (const timer of _activeLogTimers) {
    try {
      clearInterval(timer);
    } catch (e) {}
  }
  _activeLogTimers.clear();
}

/* JVM 预热 */
/**
 * 预热 JVM：后台启动一个轻量 Java 进程，让 JVM 与类库加载到内存中
 * @param {string} javaPath - Java 可执行文件路径
 * @param {number} maxMemMB - 预热进程内存上限（MB）
 * @returns {Promise<void>}
 */
async function preheatJvm(javaPath, maxMemMB) {
  if (ctx.jvm.preheatedJvm) return;
  try {
    const preheatArgs = [
      `-Xmx${Math.min(maxMemMB, 512)}M`,
      '-XX:+UseG1GC',
      '-XX:MaxGCPauseMillis=200',
      '-cp', '.',
      'java.lang.Object'
    ];
    const proc = spawn(javaPath, preheatArgs, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    proc.unref();
    ctx.jvm.preheatedJvm = { pid: proc.pid, javaPath, startTime: Date.now() };
    // 加入全局列表，应用退出时统一清理
    if (proc.pid) global._preheatPids.push(proc.pid);
    console.log(`[Preheat] JVM 预热进程已启动, PID: ${proc.pid}`);

    proc.on('exit', () => {
      ctx.jvm.preheatedJvm = null;
      // 从全局列表移除
      const idx = global._preheatPids.indexOf(proc.pid);
      if (idx >= 0) global._preheatPids.splice(idx, 1);
    });

    // 5 分钟超时自动清理，避免预热进程长期占用内存
    if (ctx.jvm.preheatTimer) clearTimeout(ctx.jvm.preheatTimer);
    ctx.jvm.preheatTimer = setTimeout(() => {
      if (ctx.jvm.preheatedJvm) {
        try {
          process.kill(ctx.jvm.preheatedJvm.pid);
        } catch (e) {}
        ctx.jvm.preheatedJvm = null;
        console.log('[Preheat] 预热进程已超时清理');
      }
    }, 300000);
  } catch (e) {
    console.log(`[Preheat] JVM 预热失败: ${e.message}`);
  }
}

/**
 * 清理 JVM 预热进程（游戏真正启动后调用，立即释放预热进程占用的内存）
 * @returns {void}
 */
function cleanupPreheatedJvm() {
  try {
    const preheated = ctx.jvm.preheatedJvm;
    if (preheated) {
      try {
        if (preheated.pid) process.kill(preheated.pid);
      } catch (e) {}
      ctx.jvm.preheatedJvm = null;
      if (preheated.pid) {
        const idx = global._preheatPids.indexOf(preheated.pid);
        if (idx >= 0) global._preheatPids.splice(idx, 1);
      }
      console.log('[Preheat] 游戏已启动，预热进程已清理');
    }
    if (ctx.jvm.preheatTimer) {
      clearTimeout(ctx.jvm.preheatTimer);
      ctx.jvm.preheatTimer = null;
    }
  } catch (e) {
    console.log(`[Preheat] 清理预热进程时出错: ${e.message}`);
  }
}

/* 性能优化 */
/**
 * 应用性能优化：提升进程优先级、设置 CPU 亲和性与 I/O 优先级
 * @param {number} pid - 游戏进程 PID
 * @returns {Promise<void>}
 */
async function applyPerformanceOptimizations(pid) {
  if (!pid) return;

  // 读取用户设置：未开启性能加速时仅设为 NORMAL 优先级
  let performanceBoost = true;
  try {
    const storePath = path.join(ctx.dirs.DATA_DIR, 'app-store.json');
    if (fs.existsSync(storePath)) {
      const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      const launchStr = store['versepc_launch_settings'];
      if (launchStr) {
        const launchSettings = JSON.parse(launchStr);
        if (launchSettings.performanceBoost !== undefined) performanceBoost = launchSettings.performanceBoost;
      }
    }
  } catch (e) {}

  if (!performanceBoost) {
    try {
      os.setPriority(pid, os.constants.priority.PRIORITY_NORMAL);
    } catch (e) {}
    return;
  }

  // 优先尝试 HIGH 优先级，失败则回退到 ABOVE_NORMAL
  try {
    os.setPriority(pid, os.constants.priority.PRIORITY_HIGH);
    console.log(`[Perf] 进程 ${pid} 优先级设为 HIGH`);
  } catch (e) {
    try {
      os.setPriority(pid, os.constants.priority.PRIORITY_ABOVE_NORMAL);
      console.log(`[Perf] 进程 ${pid} 优先级设为 ABOVE_NORMAL`);
    } catch (e2) {
      console.log(`[Perf] 设置进程优先级失败: ${e2.message}`);
    }
  }

  // Windows 平台额外通过 PowerShell 设置 CPU 亲和性（使用 75% 核心数）与 I/O 优先级
  try {
    if (process.platform === 'win32') {
      // 使用 -Command 内联脚本，避免临时 PS1 文件被杀软或 ExecutionPolicy 拦截
      const psInline = `$p=Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if($p){ $c=(Get-CimInstance Win32_Processor).NumberOfLogicalProcessors; if($c -ge 8){ $p.ProcessorAffinity=[math]::Pow(2,[math]::Floor($c*0.75))-1 }; try{$p.PriorityClass='High'}catch{} }`;
      const psCmd = `powershell -NoProfile -NonInteractive -Command "${psInline.replace(/"/g, '\\"').replace(/`/g, '``')}"`;
      exec(psCmd, { timeout: 10000, windowsHide: true }, (err) => {
        if (err) {
          console.log(`[Perf] CPU亲和性设置失败（非致命）: ${err.message}`);
        } else {
          console.log(`[Perf] CPU亲和性和I/O优先级已优化 for PID ${pid}`);
        }
      });
    }
  } catch (e) {
    console.log(`[Perf] 性能优化脚本执行失败（非致命）: ${e.message}`);
  }
}

/* 启动游戏（实际启动进程） */
/**
 * 实际启动游戏进程：构造参数、写入调试日志、spawn 进程、绑定日志与退出处理
 * @param {string} versionId - 版本 ID
 * @param {object} versionJson - 版本 JSON
 * @param {object} settings - 启动设置
 * @param {object} account - 账户信息
 * @param {string|null} [externalVersionDir=null] - 外部版本目录
 * @param {string|null} [fullVersionId=null] - 完整版本 ID（含外部标记）
 * @returns {Promise<{success:boolean,error?:string,sessionId?:string,pid?:number,...}>} 启动结果
 */
async function doLaunch(versionId, versionJson, settings, account, externalVersionDir = null, fullVersionId = null) {
  console.log(`[Launch] ========== 开始启动流程 ==========`);
  console.log(`[Launch] 版本ID: ${versionId}`);
  console.log(`[Launch] 完整版本ID: ${fullVersionId || versionId}`);
  console.log(`[Launch] 外部版本目录: ${externalVersionDir || '无'}`);
  console.log(`[Launch] 主类: ${versionJson.mainClass || '未设置'}`);

  let launchVersionId = versionId;

  let javaPath = java.selectJavaForVersion(versionId, settings, versionJson);
  if (!javaPath) {
    const errorMsg = '未找到Java运行环境，请在设置中配置Java路径';
    console.error(`[Launch] 错误: ${errorMsg}`);
    return { success: false, error: errorMsg, details: { versionId, mainClass: versionJson.mainClass } };
  }
  console.log(`[Launch] Java路径: ${javaPath}`);

  // 解析游戏目录：外部版本优先；否则按版本隔离或全局 gameDir
  let gameDir;
  if (externalVersionDir) {
    gameDir = externalVersionDir;
    console.log(`[Launch] 外部版本游戏目录(版本隔离): ${gameDir}`);
  } else {
    const settingsVersionId = fullVersionId || versionId;
    const effectiveIsolation = versions.resolveVersionIsolation(settingsVersionId);
    if (effectiveIsolation) {
      // 同版本多开时使用 instance_N 子目录避免存档冲突
      const sameVersionCount = [...ctx.sessions.gameInstances.values()].filter((g) => g.versionId === versionId).length;
      if (sameVersionCount > 0) {
        gameDir = path.join(ctx.dirs.VERSIONS_DIR, versionId, `instance_${sameVersionCount + 1}`);
      } else {
        gameDir = path.join(ctx.dirs.VERSIONS_DIR, versionId);
      }
    } else {
      gameDir = settings.gameDir || ctx.dirs.DATA_DIR;
    }
    console.log(`[Launch] 游戏目录: ${gameDir}`);
    console.log(`[Launch] 版本隔离: ${effectiveIsolation ? '是' : '否'}`);
  }

  const nativesDir = natives.getNativesFolder(versionId);

  // 启动前清理 mods 目录的 .downloading 残留文件、分块文件 (.cN) 和 .old.* 残留
  // .downloading 是上次下载中断留下的半成品
  // .cN 是分块下载未合并的碎片，文件名含 .jar 会导致 Forge ModDirTransformerDiscoverer 崩溃
  // .old.* 是 safeRename 删除被锁定文件时重命名的残留，长期累积会占用磁盘
  try {
    const modsDir = path.join(gameDir, 'mods');
    if (fs.existsSync(modsDir)) {
      const items = fs.readdirSync(modsDir);
      let cleaned = 0;
      for (const item of items) {
        // 清理 .downloading 残留
        if (item.endsWith('.downloading')) {
          try { fs.unlinkSync(path.join(modsDir, item)); cleaned++; } catch (_) {}
          continue;
        }
        // 清理分块残留 (.c0, .c1, ... .c31)
        if (/\.c\d+$/.test(item)) {
          try { fs.unlinkSync(path.join(modsDir, item)); cleaned++; } catch (_) {}
          continue;
        }
        // 清理 .old.{pid} 残留（safeRename 删除锁定文件时重命名的文件）
        if (/\.old\.\d+$/.test(item)) {
          try { fs.unlinkSync(path.join(modsDir, item)); cleaned++; } catch (_) {}
        }
      }
      if (cleaned > 0) {
        console.log(`[Launch] 清理 ${cleaned} 个下载残留文件（.downloading/.cN/.old.*）`);
      }
    }
  } catch (e) {
    console.warn(`[Launch] 清理下载残留失败: ${e.message}`);
  }

  // 启动前检查 libraries 完整性：缺失的核心库（如 fabric-loader、intermediary）会导致
  // Java 找不到主类而立即退出，且不会产生游戏日志或 hs_err 文件，难以排查。
  // 这里扫描版本 JSON 中所有 libraries，缺失的自动从镜像补下。
  try {
    const libraries = versionJson.libraries || [];
    const mavenMirrors = {
      'https://maven.fabricmc.net/': 'https://bmclapi2.bangbang93.com/maven/',
      'https://maven.minecraftforge.net/': 'https://bmclapi2.bangbang93.com/maven/',
      'https://files.minecraftforge.net/maven/': 'https://bmclapi2.bangbang93.com/maven/'
    };
    function mavenNameToPath(name) {
      const parts = name.split(':');
      if (parts.length < 3) return null;
      const groupPath = parts[0].replace(/\./g, '/');
      const artifactId = parts[1];
      const version = parts[2];
      const classifier = parts.length >= 4 ? `-${parts[3]}` : '';
      const jarName = `${artifactId}-${version}${classifier}.jar`;
      return `${groupPath}/${artifactId}/${version}/${jarName}`;
    }
    const missingLibs = [];
    for (const lib of libraries) {
      // 跳过 natives-only 的库（它们通过 extractNatives 提取，不在 classpath 中）
      if (lib.natives) continue;
      // NeoForge: neoforge:*:client 是虚拟库记录（官方 Maven 返回 404），实际用 minecraft-client-patched-*.jar
      // patched jar 的检查由 ensurePatchedJarIntact 函数负责，此处跳过避免误报
      if (lib.name && lib.name.startsWith('net.neoforged:neoforge:') && lib.name.endsWith(':client')) {
        const neoVer = lib.name.split(':')[2];
        const patchedJar = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'neoforged', 'minecraft-client-patched', neoVer, `minecraft-client-patched-${neoVer}.jar`);
        if (fs.existsSync(patchedJar)) continue;
      }
      let relPath = null;
      if (lib.downloads && lib.downloads.artifact && lib.downloads.artifact.path) {
        relPath = lib.downloads.artifact.path;
      } else if (lib.name) {
        relPath = mavenNameToPath(lib.name);
      }
      if (!relPath) continue;
      const fullPath = path.join(ctx.dirs.LIBRARIES_DIR, relPath);
      let exists = false;
      try {
        const stat = fs.statSync(fullPath);
        if (stat.size > 0) exists = true;
      } catch (_) {}
      if (!exists) {
        // 构造下载 URL：优先用 downloads.artifact.url，否则从 maven 镜像构造
        let downloadUrl = null;
        if (lib.downloads && lib.downloads.artifact && lib.downloads.artifact.url) {
          downloadUrl = lib.downloads.artifact.url;
          for (const [origin, mirror] of Object.entries(mavenMirrors)) {
            if (downloadUrl.startsWith(origin)) {
              downloadUrl = mirror + downloadUrl.substring(origin.length);
              break;
            }
          }
        } else if (lib.url) {
          downloadUrl = lib.url + relPath;
          for (const [origin, mirror] of Object.entries(mavenMirrors)) {
            if (downloadUrl.startsWith(origin)) {
              downloadUrl = mirror + downloadUrl.substring(origin.length);
              break;
            }
          }
        } else {
          // Fabric/Forge libraries 通常没有 url 字段，从 maven 镜像构造
          downloadUrl = 'https://bmclapi2.bangbang93.com/maven/' + relPath;
        }
        missingLibs.push({ relPath, fullPath, downloadUrl, name: lib.name });
      }
    }
    if (missingLibs.length > 0) {
      console.warn(`[Launch] 检测到 ${missingLibs.length} 个核心库缺失，启动前自动补下...`);
      const http = require('../http-client');
      let downloaded = 0, failed = 0;
      for (const lib of missingLibs) {
        try {
          const dir = path.dirname(lib.fullPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          await http.downloadFileWithMirror(lib.downloadUrl, lib.fullPath, null, 2, null, 60000);
          console.log(`[Launch] 补下成功: ${lib.name}`);
          downloaded++;
        } catch (e) {
          console.warn(`[Launch] 补下失败: ${lib.name} - ${e.message}`);
          failed++;
        }
      }
      if (failed > 0) {
        console.warn(`[Launch] 核心库补下完成：${downloaded} 成功，${failed} 失败`);
      } else {
        console.log(`[Launch] 核心库补下完成：${downloaded} 个文件已补回`);
      }
    }
  } catch (e) {
    console.warn(`[Launch] 启动前检查 libraries 完整性失败: ${e.message}`);
  }

  // 启动前检查 Forge/NeoForge patched jar 完整性
  // patched jar 是安装器本地执行二进制补丁后生成的，不在 version JSON 的 libraries 列表中
  // 缺失会导致 coremod 转换器找不到方法而崩溃（如 "Unable to find method ()Lnet/minecraft/.../Fluid;"）
  // 此处检测缺失时自动运行官方安装器重新生成
  try {
    await ensurePatchedJarIntact(versionJson, versionId);
  } catch (e) {
    console.warn(`[Launch] patched jar 检查/恢复失败: ${e.message}`);
  }

  const launchResult = buildLaunchArguments(versionJson, settings, account, versionId, gameDir, externalVersionDir);
  const args = launchResult.args;
  const maxMemMB = launchResult.maxMemMB;
  console.log(`[Launch] 启动参数数量: ${args.length}`);

  // 写入启动调试日志：完整 JVM 参数 + classpath 条目 + 缺失文件清单
  {
    const debugLogPath = path.join(ctx.dirs.LOGS_DIR, `launch-debug-${Date.now()}.log`);
    try {
      const debugLines = [];
      debugLines.push(`=== VersePC 启动调试日志 ===`);
      debugLines.push(`时间: ${new Date().toISOString()}`);
      debugLines.push(`版本: ${versionId}`);
      debugLines.push(`外部版本: ${!!externalVersionDir}`);
      debugLines.push(`游戏目录: ${gameDir}`);
      debugLines.push(`JVM参数总数: ${args.length}`);
      debugLines.push(``);
      debugLines.push(`=== 完整JVM参数 ===`);
      args.forEach((a, i) => debugLines.push(`[${i}] ${a}`));

      const cpIdx2 = args.indexOf('-cp');
      if (cpIdx2 >= 0 && cpIdx2 + 1 < args.length) {
        const sep = process.platform === 'win32' ? ';' : ':';
        const entries = args[cpIdx2 + 1].split(sep);
        debugLines.push(``);
        debugLines.push(`=== Classpath (${entries.length}条目) ===`);
        entries.forEach((e) => debugLines.push(`  ${e}`));
        const missing = entries.filter((e) => !fs.existsSync(e));
        if (missing.length > 0) {
          debugLines.push(``);
          debugLines.push(`=== 缺失文件 (${missing.length}) ===`);
          missing.forEach((m) => debugLines.push(`  ${m}`));
        }
      }

      fs.writeFileSync(debugLogPath, debugLines.join('\n'), 'utf-8');
      console.log(`[Launch] 调试日志已保存: ${debugLogPath}`);
    } catch (e) {
      console.error(`[Launch] 调试日志写入失败: ${e.message}`);
    }
  }

  // classpath 完整性预检：Forge/Fabric 关键库是否存在，缺失时高亮告警
  const cpIdx = args.indexOf('-cp');
  if (cpIdx !== -1 && cpIdx + 1 < args.length) {
    const classpathStr = args[cpIdx + 1];
    const separator = process.platform === 'win32' ? ';' : ':';
    const classpathEntries = classpathStr.split(separator);
    console.log(`[Launch] Classpath 条目数: ${classpathEntries.length}`);

    const mainClass = versionJson.mainClass || '';
    const isForgeLike = mainClass.includes('modlauncher') || mainClass.includes('fmlloader') ||
      mainClass.includes('forge') || mainClass.includes('neoforge');

    if (isForgeLike) {
      const criticalLibs = ['securejarhandler', 'forge', 'neoforge', 'fmlloader', 'modlauncher'];
      for (const crit of criticalLibs) {
        const found = classpathEntries.some((e) => e.toLowerCase().includes(crit));
        console.log(`[Launch] 关键库 [${crit}]: ${found ? '✓ 找到' : '✗ 缺失!'}`);
      }
      const missingEntries = classpathEntries.filter((e) => !fs.existsSync(e));
      if (missingEntries.length > 0) {
        console.error(`[Launch] ⚠ ${missingEntries.length} 个classpath条目文件不存在!`);
        missingEntries.slice(0, 5).forEach((m) =>
          console.error(`[Launch]   不存在: ${path.basename(m)}`)
        );
      }
    }

    if (mainClass.includes('fabric') || mainClass.includes('knot')) {
      const fabricLibs = classpathEntries.filter((e) =>
        e.includes('fabric') || e.includes('fabricmc') || e.includes('intermediary')
      );
      console.log(`[Launch] Fabric库数量: ${fabricLibs.length}`);
      if (fabricLibs.length === 0) {
        console.error(`[Launch] 警告: Fabric版本但没有找到Fabric库!`);
      }
      fabricLibs.forEach((lib, i) => {
        const exists = fs.existsSync(lib);
        console.log(`[Launch] Fabric库[${i}]: ${path.basename(lib)} - ${exists ? '存在' : '缺失!'}`);
      });
    }
  }

  ctx.sessions.gameInstanceCounter++;
  const sessionId = `game_${ctx.sessions.gameInstanceCounter}_${Date.now()}`;

  try {
    // 设置游戏语言与窗口模式（失败不阻塞启动流程）
    try {
      setGameLanguage(gameDir, versionJson, settings);
    } catch (langErr) {
      console.error('[Language] 设置游戏语言失败:', langErr.message);
    }

    applyWindowSettings(gameDir, settings);

    const mainClass = versionJson.mainClass || 'net.minecraft.client.main.Main';

    console.log(`[Launch] 主类: ${mainClass}`);
    console.log(`[Launch] 参数总数: ${args.length}`);

    // 再次校验 classpath：检查主类对应 JAR 是否存在
    const cpIdx = args.indexOf('-cp');
    if (cpIdx !== -1 && cpIdx + 1 < args.length) {
      const cpStr = args[cpIdx + 1];
      const cpEntries = cpStr.split(';');
      const missingCp = cpEntries.filter((e) => !fs.existsSync(e));
      console.log(`[Launch] Classpath: ${cpEntries.length}个条目, ${missingCp.length}个不存在`);
      if (missingCp.length > 0 && missingCp.length <= 10) {
        missingCp.forEach((m) => console.log(`[Launch]   缺失: ${m}`));
      }

      const mainClassInCp = cpEntries.some((e) => {
        const basename = path.basename(e).toLowerCase();
        if (mainClass.includes('knot') && basename.includes('fabric-loader')) return true;
        if (mainClass.includes('modlauncher') && basename.includes('securejarhandler')) return true;
        if (mainClass.includes('launchwrapper') && basename.includes('launchwrapper')) return true;
        // NeoForge/Forge 1.20.2+ 使用 BootstrapLauncher，主类位于 bootstrap-loader.jar
        if (mainClass.includes('bootstraplauncher') && basename.includes('bootstrap')) return true;
        return false;
      });
      console.log(`[Launch] 主类对应JAR在classpath中: ${mainClassInCp}`);
    }

    const spawnOptions = {
      cwd: gameDir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true
    };

    // Windows 启动前内存优化：执行 DoRound PowerShell 脚本回收系统缓存
    if (process.platform === 'win32') {
      let shouldOptimizeMemory = false;
      try {
        const storePath = path.join(ctx.dirs.DATA_DIR, 'app-store.json');
        if (fs.existsSync(storePath)) {
          const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
          const otherStr = store['versepc_other_settings'];
          if (otherStr) {
            const otherSettings = JSON.parse(otherStr);
            if (otherSettings.autoMemoryOptimize !== false) shouldOptimizeMemory = true;
          }
        }
      } catch (_) {}
      // 单版本设置可覆盖全局开关
      if (shouldOptimizeMemory) {
        try {
          const verSettings = versions.loadVersionSettings(versionId);
          if (verSettings.memOptimize === 'off') shouldOptimizeMemory = false;
          else if (verSettings.memOptimize === 'on') shouldOptimizeMemory = true;
        } catch (_) {}
      }
      if (shouldOptimizeMemory) {
        const freeMB = Math.floor(os.freemem() / 1024 / 1024);
        const totalMB = Math.floor(os.totalmem() / 1024 / 1024);
        console.log(`[Launch] 启动前内存优化: 可用 ${freeMB}MB / 总计 ${totalMB}MB`);
        try {
          const tmpScript = path.join(os.tmpdir(), 'versepc_memopt.ps1');
          const psScript = DoRound;
          fs.writeFileSync(tmpScript, psScript, 'utf8');
          const { execFile } = require('child_process');
          const afterMB = await new Promise((resolve) => {
            execFile('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmpScript], { timeout: 90000, windowsHide: true }, (err, stdout) => {
              try {
                fs.unlinkSync(tmpScript);
              } catch (_) {}
              if (err) {
                resolve(null);
                return;
              }
              resolve(parseInt(stdout.trim(), 10) || null);
            });
          });
          if (afterMB) {
            console.log(`[Launch] 内存优化完成: 可用 ${afterMB}MB (释放 ${afterMB - freeMB}MB)`);
          } else {
            console.log(`[Launch] 内存优化已执行`);
          }
        } catch (e) {
          console.log(`[Launch] 内存优化失败，继续启动: ${e.message}`);
        }
      }
    }

    // Linux/macOS 注入 natives 目录到动态库搜索路径
    if (process.platform === 'linux' && nativesDir) {
      const existingLdPath = spawnOptions.env.LD_LIBRARY_PATH || '';
      spawnOptions.env.LD_LIBRARY_PATH = [nativesDir, existingLdPath].filter(Boolean).join(':');
    }

    if (process.platform === 'darwin' && nativesDir) {
      const existingDyldPath = spawnOptions.env.DYLD_LIBRARY_PATH || '';
      spawnOptions.env.DYLD_LIBRARY_PATH = [nativesDir, existingDyldPath].filter(Boolean).join(':');
    }

    // 自动推断 JAVA_HOME（若未设置）
    if (!spawnOptions.env.JAVA_HOME && javaPath) {
      try {
        const detectedHome = path.dirname(path.dirname(javaPath));
        spawnOptions.env.JAVA_HOME = detectedHome;
        console.log(`[Launch] 自动设置 JAVA_HOME: ${detectedHome}`);
      } catch (e) {}
    }

    // 写入启动调试命令行（脱敏后）方便用户排查
    try {
      const debugCmd = [javaPath, ...args].map((a) => {
        if (a.includes(' ') || a.includes('"') || a.includes('=')) return `"${a}"`;
        return a;
      }).join(' ');
      const debugPath = path.join(ctx.dirs.DATA_DIR, 'launch-debug.txt');
      fs.writeFileSync(debugPath, utils.filterSensitiveInfo(debugCmd), 'utf-8');
      console.log(`[Launch] 调试命令行已写入: ${debugPath}`);
    } catch (e) {}

    // 命令行过长时使用 @argfile 方式启动（Windows 限制 ~25K，通用限制 ~30K）
    const totalCmdLength = args.reduce((sum, a) => sum + a.length + 3, javaPath.length + 3);

    if (totalCmdLength > 30000 || (process.platform === 'win32' && totalCmdLength > 25000)) {
      console.log(`[Launch] 命令行过长(${totalCmdLength}字符)，使用@argfile方式启动`);
      const tmpDir = path.join(os.tmpdir(), 'versepc-launch');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const argFilePath = path.join(tmpDir, `args-${Date.now()}.txt`);
      const argFileLines = [];
      for (const a of args) {
        // Windows 下含空格或圆括号的参数需加引号
        if (process.platform === 'win32' && (a.includes(' ') || a.includes('(') || a.includes(')'))) {
          argFileLines.push(`"${a}"`);
        } else {
          argFileLines.push(a);
        }
      }
      fs.writeFileSync(argFilePath, argFileLines.join('\r\n'), 'utf-8');
      const newArgs = [`@${argFilePath}`];
      console.log(`[Launch] @argfile: ${argFilePath}, 参数数量: ${args.length}`);

      let skinBackups = [];
      try {
        skinBackups = natives.injectOfflineSkin(versionJson, account, ctx.dirs.ASSETS_DIR);
      } catch (e) {}

      const gameProcess = spawn(javaPath, newArgs, spawnOptions);

      // 登记游戏进程 PID，供 VersePC 退出时清理（防止僵尸进程残留）
      if (!global._gamePids) global._gamePids = [];
      if (gameProcess.pid) global._gamePids.push(gameProcess.pid);

      // 日志批量节流：累积到缓冲区，每 500ms 批量处理一次，降低高频日志时的 CPU 占用
      // 注意：节流逻辑（缓冲、定时器、阶段识别）请勿随意修改，影响日志展示与启动阶段判定
      let _logBuffer = '';
      let _logFlushTimer = null;
      const _flushLogs = () => {
        if (_logFlushTimer) { clearTimeout(_logFlushTimer); _logFlushTimer = null; }
        if (!_logBuffer) return;
        const lines = _logBuffer.split('\n').filter((l) => l.trim()).map(utils.filterSensitiveInfo);
        _logBuffer = '';
        instanceInfo.logBuffer.push(...lines);
        if (instanceInfo.logBuffer.length > 5000) instanceInfo.logBuffer = instanceInfo.logBuffer.slice(-3000);
        ctx.sessions.gameLogBuffer.push(...lines);
        if (ctx.sessions.gameLogBuffer.length > 5000) ctx.sessions.gameLogBuffer = ctx.sessions.gameLogBuffer.slice(-3000);
        for (const line of lines) {
          // 检测局域网联机端口（多种日志格式）
          const lanMatch = line.match(/Local game hosted on.*?(\d{4,5})/i) ||
            line.match(/Started serving on.*?(\d{4,5})/i) ||
            line.match(/Opening LAN server.*?(\d{4,5})/i) ||
            line.match(/LAN server started.*?(\d{4,5})/i) ||
            line.match(/本地游戏已托管.*?(\d{4,5})/i);
          if (lanMatch) {
            instanceInfo.lanPort = parseInt(lanMatch[1], 10);
            ctx.sessions.detectedLanPort = parseInt(lanMatch[1], 10);
            console.log(`[LAN] Detected LAN port: ${instanceInfo.lanPort} (session: ${sessionId})`);
          }
          // 启动阶段识别：5 个关键节点用于前端进度展示
          if (instanceInfo.loadStage < 1) { instanceInfo.loadStage = 1; }
          if (instanceInfo.loadStage < 2 && line.includes('Setting user:')) { instanceInfo.loadStage = 2; console.log(`[Launch] 阶段 2/5: 用户已设置 (session: ${sessionId})`); }
          if (instanceInfo.loadStage < 3 && /lwjgl version/i.test(line)) { instanceInfo.loadStage = 3; console.log(`[Launch] 阶段 3/5: LWJGL 已初始化 (session: ${sessionId})`); }
          if (instanceInfo.loadStage < 4 && (line.includes('OpenAL initialized') || line.includes('Starting up SoundSystem'))) { instanceInfo.loadStage = 4; console.log(`[Launch] 阶段 4/5: 音频系统就绪 (session: ${sessionId})`); }
          if (instanceInfo.loadStage < 5 && ((line.includes('Created') && line.includes('textures') && line.includes('-atlas')) || line.includes('Found animation info'))) {
            instanceInfo.loadStage = 5;
            if (!instanceInfo.gameReady) {
              instanceInfo.gameReady = true;
              instanceInfo.readyTime = Date.now();
              const launchDuration = instanceInfo.readyTime - instanceInfo.startTime;
              console.log(`[Launch] 阶段 5/5: 材质加载完成(Manifest模式), 耗时: ${(launchDuration / 1000).toFixed(1)}s`);
            }
          }
        }
      };
      const _scheduleLogFlush = () => {
        if (_logFlushTimer) return;
        _logFlushTimer = setTimeout(_flushLogs, 500);
      };

      gameProcess.on('exit', () => {
        if (_logBuffer) { try { _flushLogs(); } catch (e) {} }
        try { clearInterval(_logSaveTimer); _activeLogTimers.delete(_logSaveTimer); } catch (e) {}
        try { fs.unlinkSync(argFilePath); } catch (e) {}
        try { natives.restoreOfflineSkin(skinBackups); } catch (e) {}
        // 游戏进程正常退出，从清理名单移除
        if (global._gamePids && gameProcess.pid) {
          const _idx = global._gamePids.indexOf(gameProcess.pid);
          if (_idx >= 0) global._gamePids.splice(_idx, 1);
        }
      });

      console.log(`[Launch] 进程已启动(@argfile模式), PID: ${gameProcess.pid}`);
      cleanupPreheatedJvm();

      setTimeout(() => {
        try { applyPerformanceOptimizations(gameProcess.pid); } catch (e) { console.log(`[Perf] 设置进程优先级失败: ${e.message}`); }
      }, 500);

      const instanceInfo = {
        sessionId,
        process: gameProcess,
        versionId,
        pid: gameProcess.pid,
        gameDir,
        startTime: Date.now(),
        logBuffer: [],
        lanPort: null,
        gameReady: false,
        readyTime: null,
        loadStage: 0,
        launchInfo: {
          versionId,
          fullVersionId: fullVersionId || versionId,
          externalVersionDir,
          mainClass: versionJson.mainClass,
          javaPath,
          gameDir
        }
      };

      ctx.sessions.gameInstances.set(sessionId, instanceInfo);
      console.log(`[Launch] 游戏进程已创建, PID: ${gameProcess.pid}, Session: ${sessionId}`);

      // 周期性保存游戏日志：启动器最小化时暂停写盘以减少 IO
      const _gameLogsDir = path.join(gameDir, 'logs');
      const _safeVersionId = versionId.replace(/[\\/:*?"<>|]/g, '_');
      const _crashLogPath = path.join(ctx.dirs.LOGS_DIR, `game-crash-${_safeVersionId}-${Date.now()}.log`);
      const _readGameLog = (name) => {
        try {
          return fs.readFileSync(path.join(_gameLogsDir, name), 'utf8');
        } catch (e) {
          return '';
        }
      };
      const _saveGameLog = (label) => {
        if (label === 'periodic') {
          try {
            const sharedState = require('../../main/shared-state');
            if (sharedState.getLauncherMinimized && sharedState.getLauncherMinimized()) {
              return; // 启动器最小化期间暂停写盘
            }
          } catch (e) {}
        }
        let parts;
        try {
          parts = [`=== VersePC ${label || 'Game Log'} ===\nSession: ${sessionId}\nPID: ${gameProcess ? gameProcess.pid : 'N/A'}\nTime: ${new Date().toISOString()}\nVersion: ${versionId}\nGameDir: ${gameDir}\n`];
          if (instanceInfo.logBuffer.length > 0) {
            parts.push(`\n=== stdout/stderr (last 1000 lines) ===\n${instanceInfo.logBuffer.slice(-1000).join('\n')}\n`);
          }
          const latest = _readGameLog('latest.log');
          if (latest) parts.push(`\n=== latest.log (last 500 lines) ===\n${latest.split('\n').slice(-500).join('\n')}\n`);
          const debug = _readGameLog('debug.log');
          if (debug) parts.push(`\n=== debug.log (last 500 lines) ===\n${debug.split('\n').slice(-500).join('\n')}\n`);
          fs.writeFileSync(_crashLogPath, parts.join(''));
        } catch (e) {
          // 兜底：写入 DATA_DIR 根目录
          try {
            const fbPath = path.join(ctx.dirs.DATA_DIR, `crash-${_safeVersionId}-${Date.now()}.log`);
            fs.writeFileSync(fbPath, parts.join(''));
          } catch (e2) {}
        }
      };
      const _logSaveTimer = setInterval(() => _saveGameLog('periodic'), 10000);
      _activeLogTimers.add(_logSaveTimer);
      try { _saveGameLog('initial'); } catch (e) {}

      if (gameProcess.stdout) {
        gameProcess.stdout.on('data', (data) => {
          _logBuffer += data.toString();
          _scheduleLogFlush();
        });
      }

      if (gameProcess.stderr) {
        gameProcess.stderr.on('data', (data) => {
          _logBuffer += data.toString();
          _scheduleLogFlush();
        });
      }

      gameProcess.unref();

      // 进程关闭：写入崩溃日志、分析退出码、扫描 JVM hs_err 文件、累计游戏时长
      gameProcess.on('close', (code) => {
        if (_logBuffer) { try { _flushLogs(); } catch (e) {} }
        try { clearInterval(_logSaveTimer); _activeLogTimers.delete(_logSaveTimer); } catch (e) {}
        const _sysInfo = utils.getSystemInfo();
        const crashParts = [`=== VersePC Game Crash Log ===\nSession: ${sessionId}\nExit Code: ${code}\nTime: ${new Date().toISOString()}\nVersion: ${versionId}\nJava: ${javaPath}\nGameDir: ${gameDir}\nOS: ${_sysInfo.osType} ${_sysInfo.osRelease} (${_sysInfo.osArch})\nCPU: ${_sysInfo.cpuModel}\nGPU: ${_sysInfo.gpuInfo}\nMemory: ${_sysInfo.totalMemMB}MB total, ${_sysInfo.freeMemMB}MB free\n`];
        try {
          if (instanceInfo.logBuffer.length > 0) {
            crashParts.push(`\n=== stdout/stderr (last 3000 lines) ===\n${instanceInfo.logBuffer.slice(-3000).join('\n')}\n`);
          }
          const latest = _readGameLog('latest.log');
          if (latest) crashParts.push(`\n=== latest.log (last 500 lines) ===\n${latest.split('\n').slice(-500).join('\n')}\n`);
          const debug = _readGameLog('debug.log');
          if (debug) crashParts.push(`\n=== debug.log (last 500 lines) ===\n${debug.split('\n').slice(-500).join('\n')}\n`);
          fs.writeFileSync(_crashLogPath, crashParts.join(''));
        } catch (e) {
          // 兜底：写入DATA_DIR根目录
          try {
            const fbPath = path.join(ctx.dirs.DATA_DIR, `crash-${_safeVersionId}-${Date.now()}.log`);
            fs.writeFileSync(fbPath, crashParts.join(''));
          } catch (e2) {}
        }
        const recentLogs = instanceInfo.logBuffer.slice(-100).join('\n');
        let analysis = analyzeExitCode(code, launchVersionId || versionId);
        // 补充：读取游戏日志文件进行更准确的分析
        const gameLatestLog = _readGameLog('latest.log');
        const gameDebugLog = _readGameLog('debug.log');
        const gameAllLogs = (gameLatestLog + '\n' + gameDebugLog).toLowerCase();
        if (gameAllLogs.includes('invalid paths argument') || gameAllLogs.includes('contained no existing paths')) {
          analysis.reason = 'Forge核心库文件缺失（Invalid paths argument）';
          analysis.suggestion = 'Forge安装不完整(fmlcore/javafmllanguage/mclanguage/lowcodelanguage缺失)。\n修复: 1)版本设置→文件修复 2)重新安装Forge 3)检查杀毒白名单';
        }
        instanceInfo.logBuffer.push(`[VersePC] 游戏进程退出(session:${sessionId}),代码:${code}`);
        ctx.sessions.gameLogBuffer.push(`[VersePC] 游戏进程退出 (session: ${sessionId})，代码: ${code}`);
        if (analysis.isCrash) {
          instanceInfo.logBuffer.push(`[VersePC] 崩溃分析: ${analysis.reason}`);
          instanceInfo.logBuffer.push(`[VersePC] 建议: ${analysis.suggestion}`);
          ctx.sessions.gameLogBuffer.push(`[VersePC] 崩溃分析: ${analysis.reason}`);
        } else {
          instanceInfo.logBuffer.push(`[VersePC] ${analysis.reason}`);
          ctx.sessions.gameLogBuffer.push(`[VersePC] ${analysis.reason}`);
        }
        ctx.sessions.lastGameExitAnalysis = {
          ...analysis,
          launchInfo: instanceInfo.launchInfo,
          logBuffer: instanceInfo.logBuffer.slice(-50),
          systemInfo: _sysInfo
        };
        // 扫描 JVM hs_err_pid*.log 崩溃文件（版本目录、游戏目录、系统 temp）
        try {
          const crashLogs = [];
          const _verDir2 = path.join(ctx.dirs.VERSIONS_DIR, launchVersionId || versionId);
          if (fs.existsSync(_verDir2)) {
            fs.readdirSync(_verDir2).filter((f) => f.startsWith('hs_err_pid') && f.endsWith('.log')).forEach((f) => crashLogs.push(path.join(_verDir2, f)));
          }
          if (fs.existsSync(gameDir)) {
            fs.readdirSync(gameDir).filter((f) => f.startsWith('hs_err_pid') && f.endsWith('.log')).forEach((f) => crashLogs.push(path.join(gameDir, f)));
          }
          try {
            const tmpDir = os.tmpdir();
            if (fs.existsSync(tmpDir)) {
              fs.readdirSync(tmpDir).filter((f) => f.startsWith('hs_err_pid') && f.endsWith('.log')).forEach((f) => crashLogs.push(path.join(tmpDir, f)));
            }
          } catch (_) {}
          if (crashLogs.length > 0) {
            crashLogs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
            ctx.sessions.lastGameExitAnalysis.crashLog = crashLogs[0];
            ctx.sessions.lastGameExitAnalysis.crashLogs = crashLogs;
            ctx.sessions.lastGameExitAnalysis.reason = (ctx.sessions.lastGameExitAnalysis.reason || '') + `\nJVM 崩溃日志: ${crashLogs[0]}`;
            instanceInfo.logBuffer.push(`[VersePC] JVM崩溃日志: ${crashLogs[0]}`);
            ctx.sessions.gameLogBuffer.push(`[VersePC] JVM崩溃日志: ${crashLogs[0]}`);
          }
        } catch (_) {}
        // 累计游戏时长到 play-time.json（串行化写入避免并发覆盖）
        try {
          const playTimePath = path.join(ctx.dirs.DATA_DIR, 'play-time.json');
          if (fs.existsSync(playTimePath)) {
            if (!global._playTimeWriteQueue) global._playTimeWriteQueue = Promise.resolve();
            global._playTimeWriteQueue = global._playTimeWriteQueue.then(() => {
              let ptData = JSON.parse(fs.readFileSync(playTimePath, 'utf8'));
              const vData = ptData[launchVersionId || versionId];
              if (vData && vData._launchTime) {
                const elapsed = (Date.now() - vData._launchTime) / 1000;
                vData.totalSeconds = (vData.totalSeconds || 0) + elapsed;
                delete vData._launchTime;
                fs.writeFileSync(playTimePath, JSON.stringify(ptData, null, 2), 'utf8');
              }
            });
          }
        } catch (e) {}
        ctx.sessions.gameInstances.delete(sessionId);
        if (ctx.sessions.gameInstances.size === 0) {
          ctx.sessions.gameLogBuffer = [];
        }
      });

      gameProcess.on('error', (err) => {
        instanceInfo.logBuffer.push(`[VersePC] 启动错误: ${err.message}`);
        ctx.sessions.gameLogBuffer.push(`[VersePC] 启动错误 (session: ${sessionId}): ${err.message}`);
        ctx.sessions.lastGameExitAnalysis = {
          code: -1,
          reason: `启动错误: ${err.message}`,
          suggestion: '请检查Java路径是否正确',
          isCrash: true,
          launchInfo: instanceInfo.launchInfo,
          systemInfo: utils.getSystemInfo()
        };
        ctx.sessions.gameInstances.delete(sessionId);
      });

      return {
        success: true,
        sessionId,
        pid: gameProcess.pid,
        gameDir,
        versionId
      };
    }

    let skinBackups = [];
    try {
      skinBackups = natives.injectOfflineSkin(versionJson, account, ctx.dirs.ASSETS_DIR);
    } catch (e) {}

    const gameProcess = spawn(javaPath, args, spawnOptions);

    // 登记游戏进程 PID，供 VersePC 退出时清理（防止僵尸进程残留）
    if (!global._gamePids) global._gamePids = [];
    if (gameProcess.pid) global._gamePids.push(gameProcess.pid);

    console.log(`[Launch] 进程已启动, PID: ${gameProcess.pid}`);

    cleanupPreheatedJvm();

    setTimeout(() => {
      try { applyPerformanceOptimizations(gameProcess.pid); } catch (e) { console.log(`[Perf] 设置进程优先级失败: ${e.message}`); }
    }, 500);

    // 日志批量节流：累积到缓冲区，每 500ms 批量处理一次，降低高频日志时的 CPU 占用
    // 注意：节流逻辑（缓冲、定时器、阶段识别）请勿随意修改，影响日志展示与启动阶段判定
    let _logBuffer = '';
    let _logFlushTimer = null;
    const _flushLogs = () => {
      if (_logFlushTimer) { clearTimeout(_logFlushTimer); _logFlushTimer = null; }
      if (!_logBuffer) return;
      const lines = _logBuffer.split('\n').filter((l) => l.trim()).map(utils.filterSensitiveInfo);
      _logBuffer = '';
      instanceInfo.logBuffer.push(...lines);
      if (instanceInfo.logBuffer.length > 5000) instanceInfo.logBuffer = instanceInfo.logBuffer.slice(-3000);
      ctx.sessions.gameLogBuffer.push(...lines);
      if (ctx.sessions.gameLogBuffer.length > 5000) ctx.sessions.gameLogBuffer = ctx.sessions.gameLogBuffer.slice(-3000);
      for (const line of lines) {
        // 检测局域网联机端口（多种日志格式）
        const lanMatch = line.match(/Local game hosted on.*?(\d{4,5})/i) ||
          line.match(/Started serving on.*?(\d{4,5})/i) ||
          line.match(/Opening LAN server.*?(\d{4,5})/i) ||
          line.match(/LAN server started.*?(\d{4,5})/i) ||
          line.match(/本地游戏已托管.*?(\d{4,5})/i);
        if (lanMatch) {
          instanceInfo.lanPort = parseInt(lanMatch[1], 10);
          ctx.sessions.detectedLanPort = parseInt(lanMatch[1], 10);
          console.log(`[LAN] Detected LAN port: ${instanceInfo.lanPort} (session: ${sessionId})`);
        }
        // 启动阶段识别：5 个关键节点用于前端进度展示
        if (instanceInfo.loadStage < 1) { instanceInfo.loadStage = 1; }
        if (instanceInfo.loadStage < 2 && line.includes('Setting user:')) { instanceInfo.loadStage = 2; console.log(`[Launch] 阶段 2/5: 用户已设置 (session: ${sessionId})`); }
        if (instanceInfo.loadStage < 3 && /lwjgl version/i.test(line)) { instanceInfo.loadStage = 3; console.log(`[Launch] 阶段 3/5: LWJGL 已初始化 (session: ${sessionId})`); }
        if (instanceInfo.loadStage < 4 && (line.includes('OpenAL initialized') || line.includes('Starting up SoundSystem'))) { instanceInfo.loadStage = 4; console.log(`[Launch] 阶段 4/5: 音频系统就绪 (session: ${sessionId})`); }
        if (instanceInfo.loadStage < 5 && ((line.includes('Created') && line.includes('textures') && line.includes('-atlas')) || line.includes('Found animation info'))) {
          instanceInfo.loadStage = 5;
          if (!instanceInfo.gameReady) {
            instanceInfo.gameReady = true;
            instanceInfo.readyTime = Date.now();
            const launchDuration = instanceInfo.readyTime - instanceInfo.startTime;
            console.log(`[Launch] 阶段 5/5: 材质加载完成, 耗时: ${(launchDuration / 1000).toFixed(1)}s`);
          }
        }
      }
    };
    const _scheduleLogFlush = () => {
      if (_logFlushTimer) return;
      _logFlushTimer = setTimeout(_flushLogs, 500);
    };

    const instanceInfo = {
      sessionId,
      process: gameProcess,
      versionId,
      pid: gameProcess.pid,
      gameDir,
      startTime: Date.now(),
      logBuffer: [],
      lanPort: null,
      gameReady: false,
      readyTime: null,
      loadStage: 0,
      launchInfo: {
        versionId,
        fullVersionId: fullVersionId || versionId,
        externalVersionDir,
        mainClass: versionJson.mainClass,
        javaPath,
        gameDir
      }
    };

    ctx.sessions.gameInstances.set(sessionId, instanceInfo);
    console.log(`[Launch] 游戏进程已创建, PID: ${gameProcess.pid}, Session: ${sessionId}`);

    if (gameProcess.stdout) {
      gameProcess.stdout.on('data', (data) => {
        _logBuffer += data.toString();
        _scheduleLogFlush();
      });
    }

    if (gameProcess.stderr) {
      gameProcess.stderr.on('data', (data) => {
        _logBuffer += data.toString();
        _scheduleLogFlush();
      });
    }

    gameProcess.unref();

    // 进程关闭：分析退出码、扫描 JVM hs_err 文件、累计游戏时长
    gameProcess.on('close', (code) => {
      if (_logBuffer) { try { _flushLogs(); } catch (e) {} }
      try { natives.restoreOfflineSkin(skinBackups); } catch (e) {}
      // 游戏进程正常退出，从清理名单移除
      if (global._gamePids && gameProcess.pid) {
        const _idx = global._gamePids.indexOf(gameProcess.pid);
        if (_idx >= 0) global._gamePids.splice(_idx, 1);
      }
      const _sysInfo = utils.getSystemInfo();
      const recentLogs = instanceInfo.logBuffer.slice(-100).join('\n');
      let analysis = analyzeExitCode(code, launchVersionId);
      // 补充：读取游戏日志文件进行更准确的分析
      const gameLatestLog = (() => { try { return fs.readFileSync(path.join(gameDir, 'logs', 'latest.log'), 'utf8'); } catch (e) { return ''; } })();
      const gameDebugLog = (() => { try { return fs.readFileSync(path.join(gameDir, 'logs', 'debug.log'), 'utf8'); } catch (e) { return ''; } })();
      const gameAllLogs = (gameLatestLog + '\n' + gameDebugLog).toLowerCase();
      if (gameAllLogs.includes('invalid paths argument') || gameAllLogs.includes('contained no existing paths')) {
        analysis.reason = 'Forge核心库文件缺失（Invalid paths argument）';
        analysis.suggestion = 'Forge安装不完整(fmlcore/javafmllanguage/mclanguage/lowcodelanguage缺失)。\n修复: 1)版本设置→文件修复 2)重新安装Forge 3)检查杀毒白名单';
      }
      instanceInfo.logBuffer.push(`[VersePC] 游戏进程退出(session:${sessionId}),代码:${code}`);
      ctx.sessions.gameLogBuffer.push(`[VersePC] 游戏进程退出 (session: ${sessionId})，代码: ${code}`);
      if (analysis.isCrash) {
        instanceInfo.logBuffer.push(`[VersePC] 崩溃分析: ${analysis.reason}`);
        instanceInfo.logBuffer.push(`[VersePC] 建议: ${analysis.suggestion}`);
        ctx.sessions.gameLogBuffer.push(`[VersePC] 崩溃分析: ${analysis.reason}`);
      } else {
        instanceInfo.logBuffer.push(`[VersePC] ${analysis.reason}`);
        ctx.sessions.gameLogBuffer.push(`[VersePC] ${analysis.reason}`);
      }
      ctx.sessions.lastGameExitAnalysis = {
        ...analysis,
        launchInfo: instanceInfo.launchInfo,
        logBuffer: instanceInfo.logBuffer.slice(-50),
        systemInfo: _sysInfo
      };
      // 扫描 JVM hs_err_pid*.log 崩溃文件（版本目录、游戏目录、系统 temp）
      try {
        const crashLogs = [];
        const _verDir = path.join(ctx.dirs.VERSIONS_DIR, launchVersionId || versionId);
        if (fs.existsSync(_verDir)) {
          fs.readdirSync(_verDir).filter((f) => f.startsWith('hs_err_pid') && f.endsWith('.log')).forEach((f) => crashLogs.push(path.join(_verDir, f)));
        }
        if (fs.existsSync(gameDir)) {
          fs.readdirSync(gameDir).filter((f) => f.startsWith('hs_err_pid') && f.endsWith('.log')).forEach((f) => crashLogs.push(path.join(gameDir, f)));
        }
        try {
          const tmpDir = os.tmpdir();
          if (fs.existsSync(tmpDir)) {
            fs.readdirSync(tmpDir).filter((f) => f.startsWith('hs_err_pid') && f.endsWith('.log')).forEach((f) => crashLogs.push(path.join(tmpDir, f)));
          }
        } catch (_) {}
        if (crashLogs.length > 0) {
          crashLogs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
          ctx.sessions.lastGameExitAnalysis.crashLog = crashLogs[0];
          ctx.sessions.lastGameExitAnalysis.crashLogs = crashLogs;
          ctx.sessions.lastGameExitAnalysis.reason = (ctx.sessions.lastGameExitAnalysis.reason || '') + `\nJVM 崩溃日志: ${crashLogs[0]}`;
          instanceInfo.logBuffer.push(`[VersePC] JVM崩溃日志: ${crashLogs[0]}`);
          ctx.sessions.gameLogBuffer.push(`[VersePC] JVM崩溃日志: ${crashLogs[0]}`);
        }
      } catch (_) {}
      // 累计游戏时长到 play-time.json
      try {
        const playTimePath = path.join(ctx.dirs.DATA_DIR, 'play-time.json');
        if (fs.existsSync(playTimePath)) {
          let ptData = JSON.parse(fs.readFileSync(playTimePath, 'utf8'));
          const vData = ptData[launchVersionId];
          if (vData && vData._launchTime) {
            const elapsed = (Date.now() - vData._launchTime) / 1000;
            vData.totalSeconds = (vData.totalSeconds || 0) + elapsed;
            delete vData._launchTime;
            fs.writeFileSync(playTimePath, JSON.stringify(ptData, null, 2), 'utf8');
          }
        }
      } catch (e) {}
      ctx.sessions.gameInstances.delete(sessionId);
      if (ctx.sessions.gameInstances.size === 0) {
        ctx.sessions.gameLogBuffer = [];
      }
    });

    gameProcess.on('error', (err) => {
      instanceInfo.logBuffer.push(`[VersePC] 启动错误: ${err.message}`);
      ctx.sessions.gameLogBuffer.push(`[VersePC] 启动错误 (session: ${sessionId}): ${err.message}`);
      ctx.sessions.lastGameExitAnalysis = {
        code: -1,
        reason: `启动错误: ${err.message}`,
        suggestion: '请检查Java路径是否正确',
        isCrash: true,
        launchInfo: instanceInfo.launchInfo,
        systemInfo: utils.getSystemInfo()
      };
      ctx.sessions.gameInstances.delete(sessionId);
    });

    return { success: true, pid: gameProcess.pid, sessionId, launchInfo: instanceInfo.launchInfo };
  } catch (e) {
    console.error(`[Launch] 启动异常: ${e.message}`);
    console.error(`[Launch] 堆栈: ${e.stack}`);
    return {
      success: false,
      error: '启动失败: ' + e.message,
      details: {
        versionId,
        mainClass: versionJson.mainClass,
        externalVersionDir,
        error: e.message,
        stack: e.stack
      }
    };
  }
}

/**
 * 运行 Forge/NeoForge 官方安装器重新生成 patched jar。
 * 安装器会自动执行二进制补丁、下载缺失库、注入 profile。
 * @param {string} installerJarPath - installer jar 的绝对路径
 * @param {string} logPrefix - 日志前缀
 * @returns {Promise<boolean>} 成功返回 true
 */
async function runInstallerForPatchedJar(installerJarPath, logPrefix = '[Launch]') {
  const candidates = [...java.detectBundledJava(), ...java.detectSystemJava()];
  const suitable = candidates.find((j) => j.majorVersion >= 17) || candidates[0];
  if (!suitable) {
    console.warn(`${logPrefix} 未找到 Java 17+，无法运行 installer`);
    return false;
  }

  const targetDir = ctx.dirs.DATA_DIR;
  const launcherProfilesPath = path.join(targetDir, 'launcher_profiles.json');
  if (!fs.existsSync(launcherProfilesPath)) {
    try {
      fs.writeFileSync(launcherProfilesPath, JSON.stringify({
        profiles: { VersePC: { name: 'VersePC', type: 'custom', created: new Date().toISOString(), lastUsed: new Date().toISOString(), icon: 'VersePC' } },
        selectedProfile: 'VersePC',
        clientToken: 'versepc-' + Date.now()
      }, null, 2), 'utf8');
    } catch (_) {}
  }

  console.log(`${logPrefix} 运行安装器重新生成 patched jar: ${path.basename(installerJarPath)}`);

  // 预下载 installertools（installer 运行时需要这个工具 jar，但官方 Maven 网络不稳定）
  // installer 会检查文件是否存在并校验 checksum，存在则跳过下载
  try {
    const installerToolsPath = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'neoforged', 'installertools', 'installertools', '4.0.12', 'installertools-4.0.12-fatjar.jar');
    if (!fs.existsSync(installerToolsPath) || !utils.isJarIntact(installerToolsPath)) {
      console.log(`${logPrefix} 预下载 installertools (避免 installer 运行时联网失败)`);
      const http = require('../http-client');
      const installerToolsUrls = [
        'https://bmclapi2.bangbang93.com/maven/net/neoforged/installertools/installertools/4.0.12/installertools-4.0.12-fatjar.jar',
        'https://maven.neoforged.net/releases/net/neoforged/installertools/installertools/4.0.12/installertools-4.0.12-fatjar.jar'
      ];
      for (const url of installerToolsUrls) {
        try {
          const dir = path.dirname(installerToolsPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          await http.downloadFileWithMirror(url, installerToolsPath, null, 1, null, 60000);
          if (fs.existsSync(installerToolsPath) && utils.isJarIntact(installerToolsPath)) {
            console.log(`${logPrefix} installertools 预下载成功`);
            break;
          }
        } catch (_) {}
        try { if (fs.existsSync(installerToolsPath)) fs.unlinkSync(installerToolsPath); } catch (_) {}
      }
    }
  } catch (e) {
    console.warn(`${logPrefix} installertools 预下载失败（非致命）: ${e.message}`);
  }

  return new Promise((resolve) => {
    const child = spawn(suitable.path, ['-jar', installerJarPath, '--installClient', targetDir], {
      cwd: targetDir,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    });
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stdout += d.toString(); });
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`${logPrefix} 安装器执行成功`);
        resolve(true);
      } else {
        console.warn(`${logPrefix} 安装器退出码 ${code}`);
        resolve(false);
      }
    });
    child.on('error', (e) => {
      console.warn(`${logPrefix} 安装器启动失败: ${e.message}`);
      resolve(false);
    });
  });
}

/**
 * 启动前检查 Forge/NeoForge patched jar 是否存在且完整。
 * patched jar 不在 version JSON 的 libraries 列表中（是安装器本地生成的），
 * 缺失时自动下载 installer 并运行以重新生成。
 * @param {object} versionJson - 版本 JSON
 * @param {string} versionId - 版本 ID
 */
async function ensurePatchedJarIntact(versionJson, versionId) {
  const gameArgs = versionJson.arguments?.game || [];
  const hasForgeLaunch = gameArgs.some((a) => typeof a === 'string' && a === 'forgeclient');
  const hasNeoForgeVersion = gameArgs.some((a) => typeof a === 'string' && a === '--fml.neoForgeVersion');
  const isBootStrap = (versionJson.mainClass || '').includes('bootstraplauncher');
  const isForge = hasForgeLaunch || (isBootStrap && !hasNeoForgeVersion);
  const isNeoForge = hasNeoForgeVersion;

  if (!isForge && !isNeoForge) return;

  const http = require('../http-client');

  // === Forge: 检查 forge-<mc>-<fv>-client.jar ===
  if (isForge) {
    let mcVersion = '', forgeVersion = '';
    const mcIdx = gameArgs.findIndex((a) => a === '--fml.mcVersion');
    const fvIdx = gameArgs.findIndex((a) => a === '--fml.forgeVersion');
    if (mcIdx >= 0 && mcIdx + 1 < gameArgs.length) mcVersion = gameArgs[mcIdx + 1];
    if (fvIdx >= 0 && fvIdx + 1 < gameArgs.length) forgeVersion = gameArgs[fvIdx + 1];
    if (!mcVersion || !forgeVersion) {
      const forgeLib = (versionJson.libraries || []).find((l) => l.name && l.name.startsWith('net.minecraftforge:fmlloader:'));
      if (forgeLib) {
        const parts = forgeLib.name.split(':');
        if (parts.length >= 3) {
          const v = parts[2];
          const dash = v.lastIndexOf('-');
          if (dash > 0) { mcVersion = v.substring(0, dash); forgeVersion = v.substring(dash + 1); }
        }
      }
    }
    if (!mcVersion || !forgeVersion) return;

    const verStr = `${mcVersion}-${forgeVersion}`;
    const forgeDir = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'minecraftforge', 'forge', verStr);
    const patchedJar = path.join(forgeDir, `forge-${verStr}-client.jar`);
    const installerJar = path.join(forgeDir, `forge-${verStr}-installer.jar`);

    if (fs.existsSync(patchedJar) && utils.isJarIntact(patchedJar)) return;

    console.warn(`[Launch] Forge patched jar 缺失或不完整: ${path.basename(patchedJar)}，准备重新生成`);

    // 确保 installer jar 存在
    if (!fs.existsSync(installerJar) || !utils.isJarIntact(installerJar)) {
      console.log(`[Launch] 下载 Forge installer: ${verStr}`);
      const installerUrls = [
        `https://maven.minecraftforge.net/net/minecraftforge/forge/${verStr}/forge-${verStr}-installer.jar`,
        `https://bmclapi2.bangbang93.com/maven/net/minecraftforge/forge/${verStr}/forge-${verStr}-installer.jar`
      ];
      let dlOk = false;
      for (const url of installerUrls) {
        try {
          if (!fs.existsSync(forgeDir)) fs.mkdirSync(forgeDir, { recursive: true });
          await http.downloadFileWithMirror(url, installerJar, null, 1, null, 120000);
          if (fs.existsSync(installerJar) && utils.isJarIntact(installerJar)) { dlOk = true; break; }
        } catch (_) {}
        try { if (fs.existsSync(installerJar)) fs.unlinkSync(installerJar); } catch (_) {}
      }
      if (!dlOk) {
        console.warn(`[Launch] Forge installer 下载失败，无法恢复 patched jar`);
        return;
      }
    }

    // 运行 installer 重新生成
    const ok = await runInstallerForPatchedJar(installerJar, '[Launch/Forge]');
    if (ok && fs.existsSync(patchedJar)) {
      console.log(`[Launch] Forge patched jar 已重新生成: ${path.basename(patchedJar)}`);
    } else if (!fs.existsSync(patchedJar)) {
      console.warn(`[Launch] Forge patched jar 恢复失败，游戏可能无法启动`);
    }
    return;
  }

  // === NeoForge: 检查 minecraft-client-patched-<ver>.jar 和 neoforge-<ver>-client.jar ===
  if (isNeoForge) {
    let neoVersion = '';
    const nvIdx = gameArgs.findIndex((a) => a === '--fml.neoForgeVersion');
    if (nvIdx >= 0 && nvIdx + 1 < gameArgs.length) neoVersion = gameArgs[nvIdx + 1];
    if (!neoVersion) {
      const neoLib = (versionJson.libraries || []).find((l) => l.name && l.name.startsWith('net.neoforged:neoforge:'));
      if (neoLib) {
        const parts = neoLib.name.split(':');
        if (parts.length >= 3) neoVersion = parts[2];
      }
    }
    if (!neoVersion) {
      const fmlLib = (versionJson.libraries || []).find((l) => l.name && l.name.startsWith('net.neoforged.fancymodloader:loader:'));
      if (fmlLib) {
        const parts = fmlLib.name.split(':');
        if (parts.length >= 3) neoVersion = parts[2];
      }
    }
    if (!neoVersion) return;

    // NeoForge 1.20.1 旧版沿用 forge 包名，1.20.5+ 使用 neoforge 包名
    const isLegacyNeo = neoVersion.startsWith('1.20.1-');
    const neoPkg = isLegacyNeo ? 'forge' : 'neoforge';

    const patchedJar = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'neoforged', 'minecraft-client-patched', neoVersion, `minecraft-client-patched-${neoVersion}.jar`);
    const neoClientLib = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'neoforged', neoPkg, neoVersion, `${neoPkg}-${neoVersion}-client.jar`);
    const installerJar = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'neoforged', neoPkg, neoVersion, `${neoPkg}-${neoVersion}-installer.jar`);

    // NeoForge 新版（1.20.5+）实际启动用的是 minecraft-client-patched-*.jar（installer 本地生成）
    // neoforge-*-client.jar 在 version JSON 里有记录但官方 Maven 返回 404（不可直接下载），是多余记录
    // NeoForge 1.20.1 旧版则相反：用 neoforge-*-client.jar，没有 patched jar
    const patchedOk = fs.existsSync(patchedJar) && utils.isJarIntact(patchedJar);
    const neoClientOk = fs.existsSync(neoClientLib) && utils.isJarIntact(neoClientLib);
    if (isLegacyNeo) {
      // 旧版 NeoForge（1.20.1）：检查 neoforge-*-client.jar
      if (neoClientOk) return;
    } else {
      // 新版 NeoForge（1.20.5+）：检查 minecraft-client-patched-*.jar
      if (patchedOk) return;
    }

    console.warn(`[Launch] NeoForge patched jar 缺失或不完整 (neoVersion=${neoVersion})，准备重新生成`);

    // 确保 installer jar 存在
    if (!fs.existsSync(installerJar) || !utils.isJarIntact(installerJar)) {
      console.log(`[Launch] 下载 NeoForge installer: ${neoVersion}`);
      const installerUrls = [
        `https://bmclapi2.bangbang93.com/maven/net/neoforged/${neoPkg}/${neoVersion}/${neoPkg}-${neoVersion}-installer.jar`,
        `https://maven.neoforged.net/releases/net/neoforged/${neoPkg}/${neoVersion}/${neoPkg}-${neoVersion}-installer.jar`,
        `https://maven.minecraftforge.net/net/neoforged/${neoPkg}/${neoVersion}/${neoPkg}-${neoVersion}-installer.jar`
      ];
      let dlOk = false;
      for (const url of installerUrls) {
        try {
          const dir = path.dirname(installerJar);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          await http.downloadFileWithMirror(url, installerJar, null, 1, null, 120000);
          if (fs.existsSync(installerJar) && utils.isJarIntact(installerJar)) { dlOk = true; break; }
        } catch (_) {}
        try { if (fs.existsSync(installerJar)) fs.unlinkSync(installerJar); } catch (_) {}
      }
      if (!dlOk) {
        console.warn(`[Launch] NeoForge installer 下载失败，无法恢复 patched jar`);
        return;
      }
    }

    // 运行 installer 重新生成
    const ok = await runInstallerForPatchedJar(installerJar, '[Launch/NeoForge]');
    if (ok) {
      // installer 输出到 neoClientLib 路径，需要复制到 patchedJar 路径
      if (fs.existsSync(neoClientLib) && !fs.existsSync(patchedJar)) {
        try {
          const dir = path.dirname(patchedJar);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.copyFileSync(neoClientLib, patchedJar);
          console.log(`[Launch] NeoForge patched jar 已复制到 minecraft-client-patched 路径`);
        } catch (e) {
          console.warn(`[Launch] 复制 patched jar 失败（非致命）: ${e.message}`);
        }
      }
      if (fs.existsSync(patchedJar)) {
        console.log(`[Launch] NeoForge patched jar 已重新生成`);
      } else if (fs.existsSync(neoClientLib)) {
        console.log(`[Launch] NeoForge client lib 已重新生成 (${neoPkg}-${neoVersion}-client.jar)`);
      } else {
        console.warn(`[Launch] NeoForge patched jar 恢复失败，游戏可能无法启动`);
      }
    } else {
      console.warn(`[Launch] NeoForge installer 执行失败`);
    }
  }
}

module.exports = { preheatJvm, cleanupPreheatedJvm, applyPerformanceOptimizations, doLaunch, cleanupGameLogs, ensurePatchedJarIntact };
