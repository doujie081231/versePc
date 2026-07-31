/**
 * @file server/launch/args-builder.js
 * @description 启动参数构建模块。从原 server/launch.js 拆分而来。
 *              包含：buildLaunchArguments（构建 JVM/游戏启动参数）。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const ctx = require('../context');
const utils = require('../utils');
const http = require('../http-client');
const versions = require('../versions');
const java = require('../java');
const natives = require('../natives');
const { resolveMaxMemory } = require('./memory-resolver');
const { resolveMemoryMode } = require('./memory-mode-resolver');

/* 构建启动参数 */
/**
 * 构建 Minecraft 启动所需的完整 JVM 与游戏参数
 * @param {object} versionJson - 版本 JSON 对象
 * @param {object} settings - 启动设置
 * @param {object} account - 账户信息
 * @param {string} versionId - 版本 ID
 * @param {string|null} [customGameDir=null] - 自定义游戏目录
 * @param {string|null} [externalVersionDir=null] - 外部版本目录
 * @returns {{args:string[], maxMemMB:number}} 启动参数与最大内存（MB）
 */
function buildLaunchArguments(versionJson, settings, account, versionId, customGameDir = null, externalVersionDir = null) {
  const actualVersionId = versionId || versionJson.id || 'unknown';
  const isExternal = !!externalVersionDir;
  let externalRoot = null;
  if (isExternal) {
    externalRoot = versions.findExternalRoot(externalVersionDir);
    if (!externalRoot) {
      externalRoot = path.dirname(path.dirname(externalVersionDir));
    }
  }

  // NeoForge: 不补全 neoforge:ver:client 库条目，不把 patched/universal jar 加入 classpath。
  // 参考：classpath 中不包含 neoforge-*-client.jar 和 neoforge-*-universal.jar。
  // 这些 jar 由 NeoForge 的 ProductionClientProviderLocator 通过 -DlibraryDirectory +
  // --fml.neoForgeVersion 参数自动查找并加载（SRG client jar 作为 minecraft 模块，
  // universal jar 作为 neoforge mod）。手动加入 classpath 反而会导致 locator 跳过。

  const classpath = natives.buildClasspath(versionJson, actualVersionId, externalVersionDir);
  const nativesDir = natives.extractNatives(versionJson, actualVersionId, externalVersionDir);

  let gameDir;
  if (customGameDir) {
    gameDir = customGameDir;
  } else if (externalVersionDir) {
    gameDir = externalVersionDir;
  } else {
    if (versions.resolveVersionIsolation(actualVersionId)) {
      gameDir = path.join(ctx.dirs.VERSIONS_DIR, actualVersionId);
    } else {
      gameDir = settings.gameDir || ctx.dirs.DATA_DIR;
    }
  }
  if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });
  // 预创建常用子目录，避免游戏运行时报错
  const subDirs = ['mods', 'resourcepacks', 'shaderpacks', 'saves', 'config', 'logs', 'crash-reports'];
  subDirs.forEach((d) => {
    const p = path.join(gameDir, d);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });

  // 复制 Forge log4j2.xml 到游戏目录（部分整合包依赖此文件）
  const forgeLog4jPath = path.join(ctx.dirs.VERSIONS_DIR, actualVersionId, 'log4j2.xml');
  if (fs.existsSync(forgeLog4jPath)) {
    const gameLog4jPath = path.join(gameDir, 'log4j2.xml');
    if (!fs.existsSync(gameLog4jPath)) {
      try {
        fs.copyFileSync(forgeLog4jPath, gameLog4jPath);
      } catch (e) {
        console.error(`[Launch] log4j2.xml 复制失败: ${e.message}`);
      }
    }
  }

  let assetsRoot = isExternal && externalRoot ? path.join(externalRoot, 'assets') : ctx.dirs.ASSETS_DIR;
  const assetIndex = versionJson.assetIndex?.id || actualVersionId;
  // 旧版资源使用虚拟目录挂载
  if (versionJson.assetIndex?.virtual) {
    const virtualDir = path.join(assetsRoot, 'virtual', 'legacy');
    if (fs.existsSync(virtualDir)) {
      assetsRoot = virtualDir;
    }
  }
  const playerName = account?.username || 'Player';
  let uuid = account?.uuid;
  if (!uuid) {
    // 离线 UUID：基于 "OfflinePlayer:<name>" 的 MD5（版本 3 UUID 风格）
    const md5 = crypto.createHash('md5').update('OfflinePlayer:' + playerName).digest();
    md5[6] = (md5[6] & 0x0f) | 0x30;
    md5[8] = (md5[8] & 0x3f) | 0x80;
    uuid = md5.toString('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  }
  // 离线账户使用兼容格式的伪令牌，避免自定义 BootstrapLauncher 的 Base64 解析崩溃
  // 某些整合包（如 YUMC 系）的定制 BootstrapLauncher 会尝试 Base64 解码 accessToken
  const rawAccessToken = account?.accessToken || '';
  let accessToken;
  if (!rawAccessToken || rawAccessToken === '0') {
    // 生成一个合法的 Base64 编码字符串作为离线令牌
    // 格式: base64({"alg":"none","typ":"JWT"}.{"sub":"<uuid>","iss":"VersePC"}.offline)
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: uuid,
      iss: 'VersePC',
      name: playerName,
      offline: true
    })).toString('base64url');
    accessToken = `${header}.${payload}.offline`;
  } else {
    accessToken = rawAccessToken;
  }
  const userType = account?.type === 'microsoft' ? 'msa' : (account?.type === 'legacy' ? 'legacy' : 'mojang');

  let mainJarPath = versions.findMainJar(versionJson, actualVersionId, externalVersionDir) || path.join(ctx.dirs.VERSIONS_DIR, actualVersionId, actualVersionId + '.jar');

  // [关键修复 2026-07-21] mainJar 可能是 0 字节空文件（Modrinth 整合包导入时
  // vanilla client.jar 复制失败留下的空壳）。Forge 环境下回退到 patched client.jar
  // （forge-<mc>-<forge>-client.jar），它包含 Minecraft 主类，可作为 mainJar。
  try {
    if (fs.existsSync(mainJarPath) && fs.statSync(mainJarPath).size === 0) {
      const _gArgs = versionJson.arguments?.game || [];
      const _isForge = _gArgs.some((a) => typeof a === 'string' && a === 'forgeclient') ||
        (versionJson.mainClass || '').toLowerCase().includes('bootstraplauncher');
      if (_isForge) {
        let _fv = '', _mv = '';
        const _fvi = _gArgs.findIndex((a) => typeof a === 'string' && a === '--fml.forgeVersion');
        const _mvi = _gArgs.findIndex((a) => typeof a === 'string' && a === '--fml.mcVersion');
        if (_fvi >= 0 && _fvi + 1 < _gArgs.length) _fv = _gArgs[_fvi + 1];
        if (_mvi >= 0 && _mvi + 1 < _gArgs.length) _mv = _gArgs[_mvi + 1];
        if (!_mv && versionJson.clientVersion) _mv = versionJson.clientVersion;
        if (_fv && _mv) {
          const _patchedJar = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'minecraftforge', 'forge', `${_mv}-${_fv}`, `forge-${_mv}-${_fv}-client.jar`);
          if (fs.existsSync(_patchedJar) && fs.statSync(_patchedJar).size > 0) {
            console.log(`[Launch] mainJar 是空文件，回退到 Forge patched client.jar: ${path.basename(_patchedJar)}`);
            mainJarPath = _patchedJar;
          }
        }
      }
    }
  } catch (e) {
    console.warn(`[Launch] 检查 mainJar 大小失败: ${e.message}`);
  }

  // 启动参数模板变量，供版本 JSON 中的 ${var} 占位符替换
  const variables = {
    auth_player_name: playerName,
    version_name: actualVersionId,
    game_directory: gameDir,
    assets_root: assetsRoot,
    assets_index_name: assetIndex,
    auth_uuid: uuid,
    auth_access_token: accessToken,
    user_type: userType,
    version_type: `VersePC - ${actualVersionId}`,
    resolution_width: settings.resolution?.split('x')[0] || '854',
    resolution_height: settings.resolution?.split('x')[1] || '480',
    library_directory: isExternal && externalRoot ? path.join(externalRoot, 'libraries') : ctx.dirs.LIBRARIES_DIR,
    classpath_separator: process.platform === 'win32' ? ';' : ':',
    natives_directory: nativesDir,
    launcher_name: 'VersePC',
    launcher_version: '1.0.0',
    classpath: classpath,
    clientid: uuid,
    auth_xuid: uuid,
    quickPlayPath: path.join(gameDir, 'quickPlay'),
    quickPlaySingleplayer: '',
    quickPlayMultiplayer: '',
    quickPlayRealms: ''
  };

  const jvmArgs = [];

  // 计算版本 mods 数量（用于内存分配与 GC 选择）
  // [关键修复 2026-07-05] 必须基于 gameDir 统计，而非硬编码 VERSIONS_DIR/版本名：
  // 非版本隔离的整合包（最常见的大型整合包场景）mods 实际位于 settings.gameDir/mods，
  // 旧逻辑会统计到不存在的目录 → modCount=0 → Metaspace/堆内存分配不足 → OOM
  let modCount = 0;
  try {
    const modsDir = path.join(gameDir, 'mods');
    if (fs.existsSync(modsDir)) {
      modCount = fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar') && !f.endsWith('.jar.disabled')).length;
    }
  } catch (e) {}

  // 读取启动器存储中的内存配置，支持 auto / custom 两种模式
  // [关键修复 2026-06-30] 通过 resolveMemoryMode 纯函数决策模式：
  // 旧逻辑 `if (settings.maxMemory)` 因 settings.maxMemory 默认 4096 始终为真，
  // 导致 312 个 mod 的大型整合包在 4096MB 下 OOM 崩溃，绕过 auto 自动提高逻辑。
  // [关键修复 2026-07-02] 版本级内存设置（version-settings.json 的 memoryMode/memoryValue）
  // 优先级最高：用户为特定版本专门配置的内存，必须生效，否则 auto 算出的值可能超出物理内存导致崩溃
  if (settings.memoryMode === 'custom' && settings.memoryValue) {
    var memoryMode = 'custom';
    var memoryValue = settings.memoryValue;
  } else {
    let hasLaunchSettings = false;
    let launchMemoryMode = null;
    let launchMemoryValue = null;
    try {
      const storePath = path.join(ctx.dirs.DATA_DIR, 'app-store.json');
      if (fs.existsSync(storePath)) {
        const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        const launchStr = store['versepc_launch_settings'];
        if (launchStr) {
          hasLaunchSettings = true;
          const launchSettings = JSON.parse(launchStr);
          launchMemoryMode = launchSettings.memoryMode || 'auto';
          launchMemoryValue = launchSettings.memoryValue;
        }
      }
    } catch (e) {}
    var { memoryMode, memoryValue } = resolveMemoryMode({
      settingsMaxMemory: settings.maxMemory,
      hasLaunchSettings,
      launchMemoryMode,
      launchMemoryValue
    });
  }
  const totalMB = Math.floor(os.totalmem() / 1024 / 1024);
  const freeMB = Math.floor(os.freemem() / 1024 / 1024);
  const maxMemMB = resolveMaxMemory({ memoryMode, memoryValue, totalMB, freeMB, modCount });
  // [P0 FIX - 2026-07-21] -Xms 不再等于 -Xmx
  // 旧代码 minMemMB = maxMemMB，JVM 启动时就要分配全部堆内存。当物理内存不足时，
  // JVM 无法分配 -Xms 指定的初始堆，导致启动失败或运行时 OOM。
  // 新策略：-Xms 取 maxMemMB 的 1/2，对齐到 256MB，最小 512MB
  // 让 JVM 按需扩展堆内存，避免启动时一次性占用过多物理内存
  let minMemMB = Math.floor(maxMemMB / 2 / 256) * 256;
  minMemMB = Math.max(minMemMB, 512);
  minMemMB = Math.min(minMemMB, maxMemMB);
  jvmArgs.push(`-Xmx${maxMemMB}M`, `-Xms${minMemMB}M`);
  jvmArgs.push('-Dlog4j2.formatMsgNoLookups=true');
  jvmArgs.push('-Djava.net.preferIPv4Stack=true');

  // GC 选择：用户未显式指定 GC 时按内存大小与模组数量选择
  // 注意：ZGC/ShenandoahGC 在 Forge 整合包短生命周期对象较多时易引发卡顿，默认使用 G1GC
  const hasUserGc = jvmArgs.some((a) => /^-XX:\+?Use/.test(a) || /-XX:Use/.test(a));
  if (!hasUserGc) {
    // 小内存场景使用 SerialGC；其余使用 G1GC（含 Aikar's Flags 风格调优参数）
    if (maxMemMB <= 1024) {
      jvmArgs.push('-XX:+UseSerialGC');
    } else {
      const _cpuCount = os.cpus().length;
      const _parallelGCThreads = _cpuCount <= 4 ? 2 : Math.max(2, Math.floor(_cpuCount * 5 / 8));
      const _concGCThreads = Math.max(1, Math.ceil(_parallelGCThreads / 2));
      jvmArgs.push(
        '-XX:+UnlockExperimentalVMOptions',
        '-XX:+UseG1GC',
        '-XX:MaxGCPauseMillis=100',
        '-XX:+AlwaysPreTouch',
        '-XX:G1NewSizePercent=40',
        '-XX:G1ReservePercent=20',
        '-XX:SurvivorRatio=32',
        `-XX:ParallelGCThreads=${_parallelGCThreads}`,
        `-XX:ConcGCThreads=${_concGCThreads}`,
        '-XX:+PerfDisableSharedMem'
      );
      if (maxMemMB >= 4096) {
        jvmArgs.push('-XX:G1HeapRegionSize=' + (maxMemMB >= 8192 ? '32m' : '16m'));
      }
      if (modCount > 50) {
        jvmArgs.push('-XX:G1MixedGCCountTarget=16', '-XX:G1HeapWastePercent=5');
      }
    }
    jvmArgs.push('-XX:+DisableExplicitGC');
  }
  // 大内存下额外启用字符串去重与元空间限制，降低内存占用
  // [关键修复 2026-07-05] Metaspace 按 mod 数量动态分配，避免大型整合包 OOM
  // 旧逻辑：固定 -XX:MaxMetaspaceSize=512m，300+ mod + 大量 mixin 的整合包
  // 在 EntityRenderersEvent.RegisterRenderers 阶段即耗尽 Metaspace，Render thread 崩溃，
  // 而 Forge 早期加载窗口未关闭，导致画面卡在 "Mod Gather working" 假象
  const hasUserMemOpt = jvmArgs.some((a) => a.includes('StringDeduplication') || a.includes('CompressedClassSpaceSize') || a.includes('MetaspaceSize'));
  if (!hasUserMemOpt && maxMemMB >= 2048) {
    const usingG1 = jvmArgs.some((a) => a.includes('UseG1GC'));
    if (usingG1) {
      jvmArgs.push('-XX:+UseStringDeduplication');
    }
    let metaMB = 512;
    if (modCount >= 200) metaMB = 1024;
    else if (modCount >= 100) metaMB = 768;
    const ccsMB = Math.min(metaMB, 512);
    jvmArgs.push(`-XX:CompressedClassSpaceSize=${ccsMB}m`, `-XX:MaxMetaspaceSize=${metaMB}m`);
  }

  if (!jvmArgs.some((a) => a.includes('preferIPv4Stack') || a.includes('preferIPv6Stack'))) {
    jvmArgs.push('-Djava.net.preferIPv4Stack=true');
    jvmArgs.push('-Djava.net.preferIPv4Addresses=true');
  }

  // JVM 参数优先级：单版本自定义 > 全局设置；冲突时跳过用户重复项
  const _verSettings = versions.loadVersionSettings(actualVersionId) || {};
  const _verJvmArgs = _verSettings.jvmArgs;
  const _useVersionJvm = _verJvmArgs && _verJvmArgs.trim();
  const _effectiveJavaArgs = _useVersionJvm ? _verJvmArgs : settings.javaArgs;
  if (_effectiveJavaArgs && _effectiveJavaArgs.trim()) {
    const userArgs = _effectiveJavaArgs.split(' ').filter((a) => a);
    for (const arg of userArgs) {
      const baseArg = arg.split('=')[0];
      const hasConflict = jvmArgs.some((existing) => existing.startsWith(baseArg));
      const gcPatterns = ['-XX:\\+Use', '-XX:-Use'];
      const isGcArg = gcPatterns.some((p) => new RegExp(`^${p}`).test(arg));
      let hasGcConflict = false;
      if (isGcArg) {
        hasGcConflict = jvmArgs.some((existing) =>
          gcPatterns.some((p) => new RegExp(`^${p}`).test(existing))
        );
        if (hasGcConflict) continue;
      }
      if (!hasConflict) jvmArgs.push(arg);
    }
  }

  // CDS（Class Data Sharing）归档：Java 8+ 支持，归档文件大于 1KB 时启用
  const cdsDir = path.join(ctx.dirs.DATA_DIR, 'cds');
  const cdsArchive = path.join(cdsDir, `${actualVersionId || versionId}.jsa`);
  const cdsClassList = path.join(cdsDir, `${actualVersionId || versionId}.cls`);
  const selectedJavaPath = java.selectJavaForVersion(actualVersionId, settings, versionJson) || 'java';
  const javaMajorVer = java.getJavaMajorVersion(selectedJavaPath);
  const enableCds = settings.enableCds !== false && javaMajorVer >= 8;

  if (enableCds && fs.existsSync(cdsArchive)) {
    try {
      const stat = fs.statSync(cdsArchive);
      if (stat.size > 1024) {
        jvmArgs.push(`-Xshare:on`, `-XX:SharedArchiveFile=${cdsArchive}`);
      }
    } catch (e) {
    }
  }

  const mainClass = versionJson.mainClass || 'net.minecraft.client.main.Main';
  const gameArgsForDetection = versionJson.arguments?.game || [];
  const hasForgeGameArg = gameArgsForDetection.some((a) => typeof a === 'string' && a === 'forgeclient') ||
    gameArgsForDetection.some((a) => typeof a === 'string' && a === 'forge_server');
  const isForge = mainClass.includes('modlauncher') || mainClass.includes('fml') || mainClass.includes('forge') ||
    mainClass.includes('bootstraplauncher') || mainClass.includes('BootstrapLauncher') ||
    hasForgeGameArg;
  const isNeoForge = mainClass.includes('neoforged') || mainClass.includes('neoforge') ||
    gameArgsForDetection.some((a) => typeof a === 'string' && a === '--fml.neoForgeVersion') ||
    (versionJson.libraries || []).some((l) => l.name && l.name.startsWith('net.neoforged.fancymodloader:loader'));
  const isFabric = mainClass.includes('fabricmc') || mainClass.includes('knot');

  // 离线账户禁用 Realms/Microsoft API 认证，避免 "Failed to parse into SignedJWT" 错误
  const isOfflineAccount = !rawAccessToken || rawAccessToken === '0' || account?.type === 'offline';
  if (isOfflineAccount) {
    jvmArgs.push('-Dminecraft.api.auth=off', '-Dminecraft.api.env=local');
  }

  if (isForge || isNeoForge) {
    if (!jvmArgs.some((a) => a.includes('minecraft.client.jar'))) {
      jvmArgs.push(`-Dminecraft.client.jar=${mainJarPath}`);
    }
    /*
     * [关键] 禁用 Forge/NeoForge 早期加载窗口（Early Loading Screen）
     * ====================================================================
     * 【问题原理】
     *   新版 Forge（26.x）和 NeoForge 引入了 "Early Loading Screen" 功能：
     *   游戏启动时，Forge 的 earlydisplay 模块会先创建一个红色/灰色的加载窗口，
     *   显示模组加载进度，然后等 Minecraft 主窗口创建后再切换过去。
     *
     *   正常流程：
     *     1. JVM 启动 → earlydisplay 创建红色加载窗口
     *     2. Minecraft 初始化 → 创建主游戏窗口
     *     3. earlydisplay 检测到主窗口 → 自动关闭加载窗口
     *     4. 用户只看到一个游戏窗口
     *
     *   异常流程（某些硬件/驱动/版本组合下）：
     *     1. JVM 启动 → earlydisplay 创建红色加载窗口
     *     2. Minecraft 初始化 → 创建主游戏窗口
     *     3. earlydisplay 未检测到主窗口 → 加载窗口不关闭
     *     4. 用户看到两个窗口：一个红色加载窗口 + 一个正常游戏窗口
     *
     *   红色窗口没有 MOJANG logo，只有纯色背景，这是早期加载阶段的画面。
     *   它不会影响游戏功能，但用户体验很差。
     *
     * 【修复原理】
     *   -Dfml.earlyLoadingWindow=false 是 Forge/NeoForge 支持的 JVM 参数，
     *   告诉 earlydisplay 模块不要创建早期加载窗口，直接等主窗口出现。
     *   这样从一开始就只有一个窗口。
     *
     * 【注意】
     *   这个参数由 Forge/NeoForge 的 BootstrapLauncher 解析，
     *   不是 Minecraft 原生参数。它只在 Forge/NeoForge 环境下生效。
     *
     * [AI-AUTOGEN-WARNING] 请勿删除此 JVM 参数，否则 Forge/NeoForge 启动会出现双窗口。
     */
    if (!jvmArgs.some((a) => a.includes('earlyLoadingWindow'))) {
      jvmArgs.push('-Dfml.earlyLoadingWindow=false');
    }
  }

  // JPMS 模块开放标志（--add-exports/--add-opens）仅在 Java 9+ 生效
  // Java 8 会因 "Unrecognized option: --add-exports" 而崩溃
  if ((isForge || isNeoForge) && javaMajorVer >= 9) {
    const jpmsFlags = [
      '--add-exports java.base/sun.security.util=ALL-UNNAMED',
      '--add-exports java.base/sun.security.x509=ALL-UNNAMED',
      '--add-opens java.base/java.lang=ALL-UNNAMED',
      '--add-opens java.base/java.lang.invoke=ALL-UNNAMED',
      '--add-opens java.base/java.lang.reflect=ALL-UNNAMED',
      '--add-opens java.base/java.io=ALL-UNNAMED',
      '--add-opens java.base/java.nio=ALL-UNNAMED',
      '--add-opens java.base/java.util=ALL-UNNAMED',
      '--add-opens java.base/java.util.concurrent=ALL-UNNAMED',
      '--add-opens java.base/java.util.concurrent.atomic=ALL-UNNAMED',
      '--add-opens java.base/java.util.concurrent.locks=ALL-UNNAMED',
      '--add-opens java.base/sun.nio.ch=ALL-UNNAMED',
      '--add-opens java.base/sun.nio.fs=ALL-UNNAMED',
      '--add-opens java.base/sun.security.action=ALL-UNNAMED',
      '--add-opens java.base/sun.security.provider=ALL-UNNAMED',
      '--add-opens java.base/jdk.internal.loader=ALL-UNNAMED',
      '--add-opens java.base/jdk.internal.ref=ALL-UNNAMED',
      '--add-opens java.base/jdk.internal.reflect=ALL-UNNAMED',
      '--add-opens java.base/jdk.internal.math=ALL-UNNAMED',
      '--add-opens java.base/jdk.internal.misc=ALL-UNNAMED',
      '--add-opens java.base/jdk.internal.util=ALL-UNNAMED',
      '--add-opens java.management/sun.management=ALL-UNNAMED',
      '--add-opens java.management/com.sun.jmx.mbeanserver=ALL-UNNAMED',
      '--add-opens jdk.management/com.sun.management.internal=ALL-UNNAMED',
      '--add-opens java.rmi/sun.rmi.registry=ALL-UNNAMED',
      '--add-opens java.rmi/sun.rmi.server=ALL-UNNAMED',
      '--add-opens java.desktop/java.awt=ALL-UNNAMED',
      '--add-opens java.desktop/java.awt.font=ALL-UNNAMED',
      '--add-opens java.desktop/java.awt.peer=ALL-UNNAMED',
      '--add-opens java.desktop/javax.swing=ALL-UNNAMED',
      '--add-opens java.desktop/sun.awt=ALL-UNNAMED',
      '--add-opens java.desktop/sun.java2d=ALL-UNNAMED',
      '--add-opens java.desktop/sun.font=ALL-UNNAMED',
      '--add-opens jdk.unsupported/sun.misc=ALL-UNNAMED'
    ];
    for (const combined of jpmsFlags) {
      const spaceIdx = combined.indexOf(' ');
      const flag = combined.substring(0, spaceIdx);
      const value = combined.substring(spaceIdx + 1);
      if (!jvmArgs.some((a, idx) => a === flag && jvmArgs[idx + 1] === value)) {
        jvmArgs.push(flag, value);
      }
    }
  }

  // 收集版本 JSON 中的 JVM 参数：标准 `jvm` 组 + Fabric/NeoForge 非标准组（default-user-jvm 等）
  const jvmArgSources = [];
  if (versionJson.arguments?.jvm) jvmArgSources.push(...versionJson.arguments.jvm);
  // Fabric meta API v2 使用 "default-user-jvm" 组
  if (versionJson.arguments?.['default-user-jvm']) jvmArgSources.push(...versionJson.arguments['default-user-jvm']);
  if (jvmArgSources.length > 0) {
    for (let i = 0; i < jvmArgSources.length; i++) {
      const arg = jvmArgSources[i];
      if (typeof arg === 'string') {
        const replaced = utils.replaceVariables(arg, variables);
        // 跳过 -cp 和 classpath 字符串，始终使用我们自己的完整 classpath
        // Forge JSON 自带的 classpath 只有引导 JAR，不含所有库，会导致 ModuleLayer 启动失败
        if (replaced === '-cp') {
          continue;
        }
        // 如果上一个被跳过的参数是 -cp，这个字符串就是 classpath 值，也跳过
        if (i > 0 && typeof jvmArgSources[i - 1] === 'string' && utils.replaceVariables(jvmArgSources[i - 1], variables) === '-cp') {
          continue;
        }
        const isMultiValueFlag = replaced === '--add-opens' || replaced === '--add-exports' ||
          replaced === '--add-reads' || replaced === '--add-modules' ||
          replaced === '--patch-module' || replaced === '-javaagent';
        if (isMultiValueFlag) {
          jvmArgs.push(replaced);
          if (i + 1 < jvmArgSources.length && typeof jvmArgSources[i + 1] === 'string') {
            const peeked = jvmArgSources[i + 1];
            if (!peeked.startsWith('-')) {
              i++;
              jvmArgs.push(utils.replaceVariables(peeked, variables));
            }
          }
        } else {
          // GC 参数与内存参数去重，避免与前面设置的默认值冲突
          const gcPatterns = ['-XX:\\+Use', '-XX:-Use'];
          const isGcArg = gcPatterns.some((p) => new RegExp(`^${p}`).test(replaced));
          if (isGcArg && natives.hasGarbageCollectorArg(jvmArgs)) {
            continue;
          }
          if (replaced.startsWith('-Xmx') || replaced.startsWith('-Xms')) {
            if (!jvmArgs.some((e) => e.startsWith(replaced.substring(0, 4)))) {
              jvmArgs.push(replaced);
            }
          } else if (!jvmArgs.some((existing) => existing === replaced)) {
            jvmArgs.push(replaced);
          }
        }
      } else if (arg && (arg.value !== undefined)) {
        const rulesMatch = !arg.rules || versions.evaluateRules(arg.rules, { hasCustomResolution: !!settings.resolution });
        if (rulesMatch) {
          if (typeof arg.value === 'string') {
            const replaced = utils.replaceVariables(arg.value, variables);
            const isMultiValueFlag2 = replaced === '--add-opens' || replaced === '--add-exports' ||
              replaced === '--add-reads' || replaced === '--add-modules' ||
              replaced === '--patch-module' || replaced === '-javaagent';
            if (isMultiValueFlag2) {
              jvmArgs.push(replaced);
            } else {
              const gcPatterns = ['-XX:\\+Use', '-XX:-Use'];
              const isGcArg = gcPatterns.some((p) => new RegExp(`^${p}`).test(replaced));
              if (isGcArg && natives.hasGarbageCollectorArg(jvmArgs)) continue;
              if (!jvmArgs.some((existing) => existing === replaced)) {
                jvmArgs.push(replaced);
              }
            }
          } else if (Array.isArray(arg.value)) {
            for (const v of arg.value) {
              const replaced = utils.replaceVariables(String(v), variables);
              const isMultiValueFlag = replaced === '--add-opens' || replaced === '--add-exports' ||
                replaced === '--add-reads' || replaced === '--add-modules' ||
                replaced === '--patch-module' || replaced === '-javaagent';
              if (isMultiValueFlag) {
                jvmArgs.push(replaced);
              } else {
                const gcPatterns = ['-XX:\\+Use', '-XX:-Use'];
                const isGcArg = gcPatterns.some((p) => new RegExp(`^${p}`).test(replaced));
                if (isGcArg && natives.hasGarbageCollectorArg(jvmArgs)) continue;
                if (!jvmArgs.some((existing) => existing === replaced)) {
                  jvmArgs.push(replaced);
                }
              }
            }
          }
        }
      }
    }
  } else {
    if (!jvmArgs.some((a) => a.includes('minecraft.launcher.brand'))) {
      jvmArgs.push('-Dminecraft.launcher.brand=VersePC');
      jvmArgs.push(`-Dminecraft.launcher.version=${ctx.pkgVersion}`);
    }
    if (!jvmArgs.some((a) => a.includes('log4j2.formatMsgNoLookups'))) {
      jvmArgs.push('-Dlog4j2.formatMsgNoLookups=true');
    }
  }

  // 始终固定添加 java.library.path，不依赖 JSON 参数中的变量替换
  // 整合包的版本JSON可能缺少此参数或变量替换失败，导致 UnsatisfiedLinkError
  const hasJvmLibraryPath = jvmArgs.some((a) => typeof a === 'string' && a.includes('java.library.path'));
  if (!hasJvmLibraryPath) {
    jvmArgs.push(`-Djava.library.path=${nativesDir}`);
  } else {
    // 修复 JSON 中未替换的 ${natives_directory} 变量
    const existingIdx = jvmArgs.findIndex((a) => typeof a === 'string' && a.includes('java.library.path'));
    if (existingIdx >= 0) {
      const val = jvmArgs[existingIdx];
      if (val.includes('${natives_directory}') || val.includes('$natives_directory')) {
        jvmArgs[existingIdx] = val.replace(/\$\{?natives_directory\}?/g, nativesDir);
      }
    }
  }
  if (!jvmArgs.some((a) => a.includes('minecraft.launcher.brand'))) {
    jvmArgs.push('-Dminecraft.launcher.brand=VersePC');
    jvmArgs.push(`-Dminecraft.launcher.version=${ctx.pkgVersion}`);
  }
  if (!jvmArgs.some((a) => a.includes('log4j2.formatMsgNoLookups'))) {
    jvmArgs.push('-Dlog4j2.formatMsgNoLookups=true');
  }

  // macOS 必须在主线程启动（LWJGL 要求）
  if (process.platform === 'darwin') {
    jvmArgs.unshift('-XstartOnFirstThread');
  }

  // NeoForge: patched jar 不在 classpath 中（由 -DlibraryDirectory 让 locator 自动查找），
  // 因此不需要把 patched jar 加入 ignoreList。version JSON 自带的 -DignoreList 已正确配置。
  // 参考：-DignoreList=client-extra,${version_name}.jar

  // Forge 1.20.1 split package 冲突已在导入流程源头修复（curseforge.js/importer.js
  // 复制继承版本 jar 到新版本目录并命名为 ${versionId}.jar），此处不再需要临时补丁。

  // Forge 1.20.6+/NeoForge: 把 module-path (-p) 中的引导 JAR 加入 ignoreList，
  // 避免 BootstrapLauncher 从 classpath 重复加载这些 JAR 为 JPMS 模块，
  // 触发 "Module X reads more than one module named Y" 冲突。
  // 匹配 BootstrapLauncher 的 ignoreList 语义：检查 JAR 文件名是否以条目前缀开头。
  const _pIdx = jvmArgs.findIndex((a) => a === '-p' || a === '--module-path');
  if (_pIdx >= 0 && _pIdx + 1 < jvmArgs.length) {
    const _modulePathStr = jvmArgs[_pIdx + 1];
    const _mpSep = process.platform === 'win32' ? ';' : ':';
    const _moduleJars = String(_modulePathStr).split(_mpSep).filter((p) => p.endsWith('.jar'));
    const _mpPrefixes = new Set();
    for (const _jarPath of _moduleJars) {
      const _bn = path.basename(_jarPath);
      const _m = _bn.match(/^(.+?)-\d/);
      if (_m) _mpPrefixes.add(_m[1]);
      else _mpPrefixes.add(_bn.replace(/\.jar$/, ''));
    }
    if (_mpPrefixes.size > 0) {
      const _ilIdx = jvmArgs.findIndex((a) => typeof a === 'string' && a.startsWith('-DignoreList='));
      if (_ilIdx >= 0) {
        const _existingItems = jvmArgs[_ilIdx].substring('-DignoreList='.length).split(',').filter((s) => s);
        for (const _pf of _mpPrefixes) {
          if (!_existingItems.some((it) => it === _pf)) _existingItems.push(_pf);
        }
        jvmArgs[_ilIdx] = `-DignoreList=${_existingItems.join(',')}`;
        console.log(`[Launch] 已将 module-path 引导 JAR 前缀加入 ignoreList: ${[..._mpPrefixes].join(', ')}`);
      } else {
        jvmArgs.push(`-DignoreList=${[..._mpPrefixes].join(',')}`);
        console.log(`[Launch] 已创建 ignoreList 并加入 module-path 引导 JAR: ${[..._mpPrefixes].join(', ')}`);
      }
    }
  }

  // 始终使用我们自己的完整 classpath（用系统分隔符 join），跳过 JSON 自带的残缺 classpath
  const cpSeparator = process.platform === 'win32' ? ';' : ':';
  const classpathStr = Array.isArray(classpath) ? classpath.join(cpSeparator) : classpath;
  jvmArgs.push('-cp', classpathStr);

  // NeoForge: -DlibraryDirectory 和 -DignoreList 由 version JSON 的 arguments.jvm 自带，
  // 会在上方 "收集版本 JSON 中的 JVM 参数" 逻辑中通过变量替换自动处理。
  // 不在此处重复添加，避免覆盖 version JSON 的正确配置。
  // NeoForge 的 ProductionClientProviderLocator 通过 -DlibraryDirectory +
  // --fml.neoForgeVersion 参数自动查找 neoforge-<ver>-universal.jar 并加载为 mod。

  // 第三方登录：注入 authlib-injector javaagent
  if (account?.type === 'thirdparty' && account?.serverUrl) {
    const aiDir3 = path.join(ctx.dirs.DATA_DIR, 'authlib-injector');
    const aiFiles2 = fs.existsSync(aiDir3) ? fs.readdirSync(aiDir3).filter((f) => f.endsWith('.jar')).sort() : [];
    if (aiFiles2.length > 0) {
      const aiJarPath = path.join(aiDir3, aiFiles2[aiFiles2.length - 1]);
      let serverUrlArg = account.serverUrl;
      // 去除 serverUrl 中可能附加的认证元数据分隔符
      if (serverUrlArg.includes('@@@') || serverUrlArg.includes('@@')) {
        serverUrlArg = serverUrlArg.split('@@@')[0].split('@@')[0];
      }
      const javaAgentIdx = jvmArgs.findIndex((a) => a.startsWith('-javaagent:'));
      if (javaAgentIdx === -1) {
        jvmArgs.unshift(`-javaagent:${aiJarPath}=${serverUrlArg}`);
      }
    }
  }

  // 下载并注入 log4j 配置文件
  if (versionJson.logging?.client?.argument && versionJson.logging?.client?.file?.id) {
    const logConfigPath = path.join(ctx.dirs.VERSIONS_DIR, actualVersionId, versionJson.logging.client.file.id);
    if (!fs.existsSync(logConfigPath)) {
      const logDir = path.join(ctx.dirs.VERSIONS_DIR, actualVersionId);
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      if (versionJson.logging.client.file.url) {
        try {
          http.downloadFileSync(versionJson.logging.client.file.url, logConfigPath);
        } catch (e) {
          console.error('[Launch] log4j config download failed:', e.message);
        }
      }
    }
    if (fs.existsSync(logConfigPath)) {
      const logArg = versionJson.logging.client.argument
        .replace(/\$\{path\}/g, logConfigPath);
      if (!jvmArgs.some((a) => a.includes('log4j2') || a.includes('Log4j') || a.includes('log4j.configurationFile'))) {
        jvmArgs.push(logArg);
      }
    }
  }

  jvmArgs.push(mainClass);

  const gameArgs = [];

  // 收集游戏参数：标准 `game` 组 + Fabric/NeoForge 非标准组（default-user-game 等）
  const gameArgSources = [];
  if (versionJson.arguments?.game) gameArgSources.push(...versionJson.arguments.game);
  // Fabric meta API v2 使用 "default-user-game" 组
  if (versionJson.arguments?.['default-user-game']) gameArgSources.push(...versionJson.arguments['default-user-game']);
  if (gameArgSources.length > 0) {
    for (const arg of gameArgSources) {
      if (typeof arg === 'string') {
        gameArgs.push(utils.replaceVariables(arg, variables));
      } else if (arg && (arg.value !== undefined)) {
        const rulesMatch = !arg.rules || versions.evaluateRules(arg.rules, { hasCustomResolution: !!settings.resolution });
        if (rulesMatch) {
          if (typeof arg.value === 'string') {
            gameArgs.push(utils.replaceVariables(arg.value, variables));
          } else if (Array.isArray(arg.value)) {
            gameArgs.push(...arg.value.map((v) => utils.replaceVariables(String(v), variables)));
          }
        }
      }
    }
  }

  // 旧版 Minecraft 使用 minecraftArguments 字段（空格分隔模板）
  // [关键修复] 必须先对模板分词，再对每个 token 单独做变量替换。
  // 反例（旧实现）：先 replaceVariables 再 split(' ')，当 version_name="SkyFactory 4" 时
  //   替换后的 "SkyFactory 4" 会被误拆成 ["SkyFactory", "4"] 两个参数，
  //   导致 --version 和 --gameDir 被截断，Forge 找不到 mods 目录，整合包只加载4个基础mod。
  if (versionJson.minecraftArguments) {
    const template = versionJson.minecraftArguments;
    const tokens = template.split(' ').filter((a) => a);
    for (const tok of tokens) {
      const replaced = utils.replaceVariables(tok, variables);
      if (replaced) gameArgs.push(replaced);
    }
  }

  if (settings.fullscreen) {
    gameArgs.push('--fullscreen');
  } else {
    const resW = parseInt(settings.resolution?.split('x')[0], 10) || 854;
    const resH = parseInt(settings.resolution?.split('x')[1], 10) || 480;

    // 原版窗口修正：模组加载器（Forge/Fabric/NeoForge 等）有自己的 fmlearlywindow
    // 模块接管窗口创建，不会出现标题栏被顶出屏幕的问题。但原版 Minecraft 用
    // LWJGL/GLFW 原生窗口，会把 --width/--height 当作"客户区"大小，加上标题栏
    // 和边框后实际窗口会比屏幕大，导致标题栏被顶到屏幕外（Y 坐标变成负数）。
    // 这里只在原版（没有 --launchTarget 等模组参数）时减去标题栏+边框高度。
    const isVanilla = !gameArgs.some((a) => typeof a === 'string' && a.startsWith('--launchTarget'));
    let finalW = resW;
    let finalH = resH;
    if (isVanilla) {
      try {
        const screen = require('electron').screen || null;
        const display = screen?.getPrimaryDisplay?.();
        const screenW = display?.size?.width || 0;
        const screenH = display?.size?.height || 0;
        const workH = display?.workAreaSize?.height || screenH;
        // 当用户填的分辨率接近屏幕分辨率（差距 < 40px）时，认为用户想要"铺满屏幕"
        // 此时把高度减去标题栏+边框（约 39px），宽度减去左右边框（约 16px），
        // 让实际窗口刚好等于屏幕工作区，标题栏就能正常显示。
        if (screenW > 0 && screenH > 0) {
          if (Math.abs(resW - screenW) < 40) finalW = Math.max(resW - 16, 800);
          if (Math.abs(resH - screenH) < 40 || Math.abs(resH - workH) < 40) finalH = Math.max(resH - 39, 600);
        }
      } catch (_) {
        // 主进程外调用时 require electron 可能失败，忽略即可
      }
    }

    if (!gameArgs.some((a) => a === '--width')) gameArgs.push('--width', String(finalW));
    if (!gameArgs.some((a) => a === '--height')) gameArgs.push('--height', String(finalH));
  }

  // 设置版本类型显示（也可作为窗口标题来源）
  let versionTypeIdx = gameArgs.indexOf('--versionType');
  if (versionTypeIdx === -1) {
    const ci = (settings.customInfo || '').trim();
    const wt = (settings.windowTitle || '').trim();
    gameArgs.push('--versionType', wt || ci || 'VersePC');
  }

  // 确保 --gameDir 已设置且变量已替换
  if (!gameArgs.some((a, i) => a === '--gameDir' && i + 1 < gameArgs.length)) {
    gameArgs.push('--gameDir', gameDir);
  } else {
    const gdi = gameArgs.indexOf('--gameDir');
    if (gdi !== -1 && gdi + 1 < gameArgs.length) {
      const existingGd = gameArgs[gdi + 1];
      if (existingGd.includes('${') || existingGd.includes('$game_directory')) {
        gameArgs[gdi + 1] = gameDir;
      }
    }
  }

  // 去重游戏参数（保留首次出现的键值对）
  const finalGameArgs = versions.deduplicateGameArgs(gameArgs);

  return { args: [...jvmArgs, ...finalGameArgs], maxMemMB };
}

module.exports = { buildLaunchArguments };
