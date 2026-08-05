/**
 * @file server/modloaders/forge.js
 * @description Forge 加载器安装模块（从 server/modloaders.js 拆分）。
 *   包含 Forge 核心库下载、patching jars、核心 jar 查找、installer 运行、
 *   Forge 安装（含 CRITICAL 注释）、Forge 合并到版本 JSON 等功能。
 */
const fs = require('fs');
const path = require('path');
const { execSync, exec, spawn } = require('child_process');

const ctx = require('../context');
const utils = require('../utils');
const http = require('../http-client');
const versions = require('../versions');
const java = require('../java');

const { ensureBaseVersionInstalled, isLibValid, SERVER_DIR, runPatchProcessor } = require('./shared');
const { findNeoForgeCoreJars, installNeoForge } = require('./neoforge');

/* Forge 核心库下载 */

/**
 * 从 Maven 源下载 Forge 核心库（fmlcore/javafmllanguage/mclanguage/lowcodelanguage）。
 * @param {string} forgeVersionStr - Forge 版本字符串，如 "47.3.0"
 * @param {(percent: number, message: string) => void} [onProgress] - 进度回调（当前未使用）
 * @returns {Promise<{downloaded: number, failed: number, total: number}>} 下载结果统计
 */
async function downloadForgeCoreLibsFromMaven(forgeVersionStr, onProgress) {
  const prefix = 'net/minecraftforge';
  const coreArtifacts = [
    { dir: `${prefix}/fmlcore/${forgeVersionStr}`, file: `fmlcore-${forgeVersionStr}.jar` },
    { dir: `${prefix}/javafmllanguage/${forgeVersionStr}`, file: `javafmllanguage-${forgeVersionStr}.jar` },
    { dir: `${prefix}/mclanguage/${forgeVersionStr}`, file: `mclanguage-${forgeVersionStr}.jar` },
    { dir: `${prefix}/lowcodelanguage/${forgeVersionStr}`, file: `lowcodelanguage-${forgeVersionStr}.jar` },
    // FML MinecraftLocator.scanMods 硬编码查找 forge-{ver}-universal.jar，缺失会导致启动崩溃
    { dir: `${prefix}/forge/${forgeVersionStr}`, file: `forge-${forgeVersionStr}-universal.jar` }
  ];

  let downloaded = 0;
  let failed = 0;

  for (const artifact of coreArtifacts) {
    const targetPath = path.join(ctx.dirs.LIBRARIES_DIR, artifact.dir, artifact.file);
    if (fs.existsSync(targetPath) && utils.isJarIntact(targetPath)) continue;

    let ok = false;
    for (const mavenBase of ctx.mirrors.FORGE_MAVEN_BASES) {
      const url = `${mavenBase}/${artifact.dir}/${artifact.file}`;
      try {
        if (!fs.existsSync(path.dirname(targetPath))) fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        await http.downloadFileWithMirror(url, targetPath);
        if (fs.existsSync(targetPath) && utils.isJarIntact(targetPath)) {
          ok = true;
          downloaded++;
          console.log(`[Forge] Maven下载成功: ${artifact.file} (from ${mavenBase})`);
          break;
        }
      } catch (_) {}
      try { if (fs.existsSync(targetPath) && !utils.isJarIntact(targetPath)) fs.unlinkSync(targetPath); } catch (_) {}
    }
    if (!ok) {
      failed++;
      console.warn(`[Forge] Maven下载失败: ${artifact.file}`);
    }
  }

  if (downloaded > 0 || failed === 0) {
    console.log(`[Forge] 核心库Maven补全: 下载${downloaded}个, 失败${failed}个`);
  } else {
    console.warn(`[Forge] 核心库Maven补全失败: ${failed}个文件无法下载`);
  }

  return { downloaded, failed, total: coreArtifacts.length };
}

/**
 * 下载 Forge patching JAR（forge client/universal jar、client srg/extra jar）。
 * @param {string} mcVersion - Minecraft 版本号
 * @param {string} forgeVersion - Forge 版本号
 * @param {string} [mcpVersion] - MCP 版本号（可选，用于下载 client srg/extra）
 * @returns {Promise<{ok: boolean, reason: string}>} 补全结果，ok=true 表示所需 JAR 已就绪
 */
async function downloadForgePatchingJars(mcVersion, forgeVersion, mcpVersion) {
  if (!mcVersion || !forgeVersion) return { ok: false, reason: '缺少版本号' };

  const verStr = `${mcVersion}-${forgeVersion}`;
  const forgeDir = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'minecraftforge', 'forge', verStr);
  const forgeClientJar = path.join(forgeDir, `forge-${verStr}-client.jar`);
  const forgeUniversalJar = path.join(forgeDir, `forge-${verStr}-universal.jar`);
  // client.jar（patched Minecraft+Forge）和 universal.jar（纯 Forge 代码）用途不同：
  // - client.jar 用于 -Dminecraft.client.jar 和 classpath
  // - universal.jar 用于 FML MinecraftLocator.scanMods（硬编码查找 forge-{ver}-universal.jar）
  // 两者都必须存在，缺任一个都会导致游戏崩溃。之前用 OR 逻辑导致 universal 缺失时漏检。
  const hasClient = fs.existsSync(forgeClientJar) && utils.isJarIntact(forgeClientJar);
  const hasUniversal = fs.existsSync(forgeUniversalJar) && utils.isJarIntact(forgeUniversalJar);

  const missing = [];
  const FORGE_JAR_DL_TIMEOUT = 20000;
  const forgePath = `net/minecraftforge/forge/${verStr}`;

  // 分别下载缺失的 client.jar 和 universal.jar
  const downloadForgeJar = async (jarName, targetPath) => {
    for (const mavenBase of ctx.mirrors.FORGE_MAVEN_BASES) {
      const url = `${mavenBase}/${forgePath}/${jarName}`;
      try {
        if (!fs.existsSync(path.dirname(targetPath))) fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        await http.downloadFileWithMirror(url, targetPath, null, 1, null, FORGE_JAR_DL_TIMEOUT);
        if (fs.existsSync(targetPath) && utils.isJarIntact(targetPath)) {
          console.log(`[Forge] Maven下载成功: ${jarName}`);
          return true;
        }
      } catch (_) {}
      try { if (fs.existsSync(targetPath) && !utils.isJarIntact(targetPath)) fs.unlinkSync(targetPath); } catch (_) {}
    }
    return false;
  };

  if (!hasClient) {
    if (!await downloadForgeJar(`forge-${verStr}-client.jar`, forgeClientJar)) {
      missing.push(`forge-${verStr}-client.jar`);
    }
  }
  if (!hasUniversal) {
    if (!await downloadForgeJar(`forge-${verStr}-universal.jar`, forgeUniversalJar)) {
      missing.push(`forge-${verStr}-universal.jar`);
    }
  }

  if (mcpVersion) {
    const clientVerStr = `${mcVersion}-${mcpVersion}`;
    const clientDir = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'minecraft', 'client', clientVerStr);
    const clientJars = [
      `client-${clientVerStr}-srg.jar`,
      `client-${clientVerStr}-extra.jar`
    ];
    for (const jarName of clientJars) {
      const targetPath = path.join(clientDir, jarName);
      if (fs.existsSync(targetPath) && utils.isJarIntact(targetPath)) continue;
      let ok = false;
      const clientPath = `net/minecraft/client/${clientVerStr}`;
      const PATCHING_DL_TIMEOUT = 15000;
      for (const mavenBase of ctx.mirrors.FORGE_MAVEN_BASES) {
        const url = `${mavenBase}/${clientPath}/${jarName}`;
        try {
          if (!fs.existsSync(clientDir)) fs.mkdirSync(clientDir, { recursive: true });
          await http.downloadFileWithMirror(url, targetPath, null, 1, null, PATCHING_DL_TIMEOUT);
          if (fs.existsSync(targetPath) && utils.isJarIntact(targetPath)) {
            console.log(`[Forge] Maven下载成功: ${jarName}`);
            ok = true;
            break;
          }
        } catch (_) {}
        try { if (fs.existsSync(targetPath) && !utils.isJarIntact(targetPath)) fs.unlinkSync(targetPath); } catch (_) {}
      }
      if (!ok) missing.push(jarName);
    }
  }

  if (missing.length > 0) {
    console.warn(`[Forge] Forge关键JAR补全失败: ${missing.join(', ')}`);
    return { ok: false, reason: `缺失: ${missing.join(', ')}` };
  }
  console.log(`[Forge] Forge关键JAR补全检查通过`);
  return { ok: true, reason: 'Forge关键JAR已就绪' };
}

/**
 * 从版本 JSON 和搜索路径中查找 Forge 核心库 JAR 文件。
 * @param {object} versionJson - 版本 JSON 对象
 * @param {string[]} searchBases - 库搜索根路径数组
 * @returns {string[]} 找到的 JAR 文件绝对路径数组
 */
function findForgeCoreJars(versionJson, searchBases) {
  const gameArgs = versionJson.arguments?.game || [];
  const mainClass = versionJson.mainClass || '';
  const hasForgeLaunch = gameArgs.some((a) => typeof a === 'string' && a === 'forgeclient');
  const isBootStrap = mainClass.includes('bootstraplauncher') || mainClass.includes('BootstrapLauncher');

  const isNeoForgeVersion = gameArgs.some((a) => typeof a === 'string' && a === '--fml.neoForgeVersion') ||
    (versionJson.libraries || []).some((l) => l.name && l.name.startsWith('net.neoforged.fancymodloader:loader'));
  const isForge = hasForgeLaunch || isBootStrap;

  console.log(`[findForgeCoreJars] versionId=${versionJson.id} isNeoForge=${isNeoForgeVersion} isForge=${isForge} gameArgsLen=${gameArgs.length} hasForgeLaunch=${hasForgeLaunch} isBootStrap=${isBootStrap}`);

  if (!isForge && !isNeoForgeVersion) return [];

  if (isNeoForgeVersion) {
    return findNeoForgeCoreJars(versionJson, searchBases, gameArgs);
  }

  let forgeVersion = '';
  let mcVersion = '';

  const forgeVerIdx = gameArgs.findIndex((a) => typeof a === 'string' && a === '--fml.forgeVersion');
  const mcVerIdx = gameArgs.findIndex((a) => typeof a === 'string' && a === '--fml.mcVersion');

  if (forgeVerIdx >= 0 && forgeVerIdx + 1 < gameArgs.length) {
    forgeVersion = gameArgs[forgeVerIdx + 1];
  }
  if (mcVerIdx >= 0 && mcVerIdx + 1 < gameArgs.length) {
    mcVersion = gameArgs[mcVerIdx + 1];
  }
  if (!mcVersion && versionJson.clientVersion) {
    mcVersion = versionJson.clientVersion;
  }

  if (!forgeVersion || !mcVersion) {
    const forgeLib = (versionJson.libraries || []).find((l) =>
      l.name && (l.name.startsWith('net.minecraftforge:fmlloader:') || l.name.startsWith('net.minecraftforge:forge:'))
    );
    if (forgeLib) {
      const parts = forgeLib.name.split(':');
      if (parts.length >= 3) {
        const verPart = parts[2];
        const dashIdx = verPart.lastIndexOf('-');
        if (dashIdx > 0) {
          mcVersion = verPart.substring(0, dashIdx);
          forgeVersion = verPart.substring(dashIdx + 1);
        }
      }
    }
  }

  if (!forgeVersion || !mcVersion) return [];

  const verStr = `${mcVersion}-${forgeVersion}`;
  const prefix = 'net/minecraftforge';

  const coreArtifacts = [
    { dir: `${prefix}/fmlcore/${verStr}`, file: `fmlcore-${verStr}.jar` },
    { dir: `${prefix}/javafmllanguage/${verStr}`, file: `javafmllanguage-${verStr}.jar` },
    { dir: `${prefix}/mclanguage/${verStr}`, file: `mclanguage-${verStr}.jar` },
    { dir: `${prefix}/lowcodelanguage/${verStr}`, file: `lowcodelanguage-${verStr}.jar` }
  ];

  const result = [];

  for (const artifact of coreArtifacts) {
    for (const base of searchBases) {
      if (!base) continue;
      const jarPath = path.join(base, artifact.dir, artifact.file);
      if (fs.existsSync(jarPath)) {
        if (!result.some((r) => path.basename(r) === path.basename(jarPath))) {
          result.push(jarPath);
        }
        break;
      }
    }
  }

  {
    // Forge 1.13+ 需要 client.jar（patched vanilla client.jar，含 Minecraft 主类）
    // 和 universal.jar（Forge 主代码）同时存在于 classpath 中。
    // 旧逻辑只添加首个找到的 jar（优先 universal），导致 BootstrapLauncher
    // 找不到 net.minecraft.client.main.Main，游戏启动后立即退出。
    const forgeDir = `${prefix}/forge/${verStr}`;
    for (const base of searchBases) {
      if (!base) continue;
      const dirPath = path.join(base, forgeDir);
      if (!fs.existsSync(dirPath)) continue;
      // client.jar（patched MC client）和 universal.jar（Forge 代码）都要加入
      const requiredJars = [
        `forge-${verStr}-client.jar`,
        `forge-${verStr}-universal.jar`
      ];
      let addedAny = false;
      for (const required of requiredJars) {
        const jarPath = path.join(dirPath, required);
        if (fs.existsSync(jarPath)) {
          if (!result.some((r) => path.basename(r) === path.basename(jarPath))) {
            result.push(jarPath);
          }
          addedAny = true;
        }
      }
      // 兜底：若两个必需 jar 都没找到，扫描目录下任意 forge-*.jar
      if (!addedAny) {
        try {
          const files = fs.readdirSync(dirPath)
            .filter((f) => f.startsWith('forge-') && f.endsWith('.jar') && !f.endsWith('-sources.jar') && !f.endsWith('-javadoc.jar'));
          if (files.length > 0) {
            for (const f of files) {
              const fp = path.join(dirPath, f);
              if (!result.some((r) => path.basename(r) === f)) {
                result.push(fp);
              }
            }
          }
        } catch (e) {}
      }
      // 旧版本兼容：若只有 forge-${verStr}.jar（合并 jar），也加入
      const mergedJar = path.join(dirPath, `forge-${verStr}.jar`);
      if (fs.existsSync(mergedJar) && !result.some((r) => r === mergedJar)) {
        result.push(mergedJar);
      }
      break;
    }
  }

  if (result.length > 0) {
    console.log(`[Classpath] 自动添加Forge核心JAR (${result.length}): ${result.map((r) => path.basename(r)).join(', ')}`);
  }

  return result;
}

/**
 * 通过原生 Java 执行 Forge installer JAR 安装 Forge。
 * @param {string} installerJarPath - Forge installer JAR 文件路径
 * @param {string} mcDir - Minecraft 根目录
 * @param {(message: string, percent: number) => void} [onProgress] - 进度回调
 * @param {boolean} [useNative=false] - 是否使用原生 installer 模式（true=直接 -jar，false=使用 BMCL 安装器）
 * @returns {Promise<{success: boolean, error?: string}>} 安装结果
 * @throws {Error} 当找不到合适的 Java 时抛出
 */
async function runForgeInstallerJar(installerJarPath, mcDir, onProgress = null, useNative = false) {
  const report = onProgress || (() => {});
  const isPackaged = SERVER_DIR.includes('app.asar');
  const resourcesBase = isPackaged
    ? path.join(SERVER_DIR.replace('app.asar', 'app.asar.unpacked'), 'resources')
    : path.join(SERVER_DIR, 'resources');
  const bundledJava = path.join(resourcesBase, 'jdk-8u432+62-jre', 'bin', 'java.exe');
  let javaPath = null;
  if (fs.existsSync(bundledJava)) {
    javaPath = bundledJava;
  } else {
    const bundledJdk = [...java.detectBundledJava(), ...java.detectSystemJava()];
    const suitable = bundledJdk.find((j) => j.majorVersion >= 8);
    if (suitable) javaPath = suitable.path;
  }
  if (!javaPath) {
    throw new Error('未找到 Java 8 或更高版本，无法安装 Forge。请先在设置中安装或配置 Java。');
  }
  console.log(`[Forge] 使用 Java: ${javaPath}`);
  console.log(`[Forge] Forge installer: ${installerJarPath}`);
  console.log(`[Forge] Minecraft 目录: ${mcDir}`);
  console.log(`[Forge] 原生模式: ${useNative}`);

  let javaMajor = 8;
  try {
    const verOut = execSync(`"${javaPath}" -version 2>&1`, { encoding: 'utf8', timeout: 5000 });
    const m = verOut.match(/version "(\d+)/);
    if (m) javaMajor = parseInt(m[1]);
  } catch (_) {}

  let args;
  if (useNative) {
    args = `-jar "${installerJarPath}" --installClient "${mcDir}"`;
    if (javaMajor >= 9) {
      args = '--add-exports cpw.mods.bootstraplauncher/cpw.mods.bootstraplauncher=ALL-UNNAMED ' + args;
    }
  } else {
    const bundledInstaller = path.join(resourcesBase, 'forge-installer.jar');
    if (!fs.existsSync(bundledInstaller)) {
      throw new Error('forge-installer.jar 不存在: ' + bundledInstaller);
    }
    args = `-cp "${bundledInstaller};${installerJarPath}" com.bangbang93.ForgeInstaller "${mcDir}"`;
    if (javaMajor >= 9) {
      args = '--add-exports cpw.mods.bootstraplauncher/cpw.mods.bootstraplauncher=ALL-UNNAMED ' + args;
    }
  }

  return new Promise((resolve, reject) => {
    const cmd = `"${javaPath}" ${args}`;
    console.log(`[ForgeInstaller] 执行命令: ${cmd.slice(0, 200)}...`);

    exec(cmd, { timeout: 600000, maxBuffer: 1024 * 1024 * 10, windowsHide: true }, (error, stdout, stderr) => {
      console.log(`[ForgeInstaller] 进程完成`);
      if (stdout) console.log(`[ForgeInstaller] stdout (最后500字): ${stdout.slice(-500)}`);
      if (stderr) console.log(`[ForgeInstaller] stderr (最后500字): ${stderr.slice(-500)}`);

      const allOutput = (stdout || '') + (stderr || '');
      const outputLines = allOutput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (allOutput.includes('Extracting json')) report('提取 JSON 配置...', 10);
      if (allOutput.includes('Downloading libraries')) report('下载依赖库...', 20);
      if (allOutput.includes('Building Processors')) report('构建处理器...', 30);
      if (allOutput.includes('Remapping final jar')) report('重映射 JAR...', 70);
      if (allOutput.includes('Injecting profile')) report('写入版本配置...', 90);

      if (error && error.killed) {
        resolve({ success: false, error: 'Forge 安装器执行超时（10分钟）' });
      } else if (!error || (error.code === 0)) {
        const hasTrue = outputLines.slice(-5).some((l) => l === 'true');
        if (!useNative && !hasTrue) {
          console.warn(`[ForgeInstaller] ⚠ 进程退出码0但输出中无 "true"，安装可能不完整`);
          console.warn(`[ForgeInstaller] 最后5行: ${outputLines.slice(-5).join(' | ')}`);
          resolve({ success: false, error: `安装器未输出true，最后输出: ${outputLines.slice(-3).join(' | ')}` });
        } else {
          report('Forge 安装器完成，正在补全文件...', 80);
          resolve({ success: true });
        }
      } else {
        resolve({ success: false, error: `Forge 安装器退出码 ${error.code}: ${(stderr || stdout || '').slice(-300)}` });
      }
    });
  });
}

/*
 * [CRITICAL FUNCTION - READ BEFORE MODIFYING]
 * ============================================
 * installForge — 安装 Forge 模组加载器
 *
 * 【参数说明】
 *   gameVersion     - MC 版本号，如 "26.2", "1.20.1"
 *   forgeVersion    - Forge 版本号，如 "65.0.0", "47.3.0"
 *   onProgress      - 进度回调 (percent, message)
 *   mirrorBaseUrl   - 镜像源 URL，null 则用 BMCLAPI
 *   targetVersionId - 【关键参数】目标版本目录名，如 "26.2-Forge-65.0.0"
 *                     如果不传，默认用小写 "26.2-forge-65.0.0"
 *
 * 【为什么需要 targetVersionId？】
 *   下载页面创建版本目录时用大写 Forge（如 "26.2-Forge-65.0.0"），但本函数内部
 *   默认用小写 forge（如 "26.2-forge-65.0.0"）。在 Windows NTFS 上：
 *   - 目录名大小写不敏感 → 两个路径指向同一目录
 *   - 但文件名中的大小写差异会导致 JSON/JAR 文件名不同
 *   - performInstallation 先写入原版 JSON（mainClass=net.minecraft.client.main.Main）
 *   - forge-installer.js 写入 Forge JSON（mainClass=net.minecraftforge.bootstrap.ForgeBootstrap）
 *   - 由于文件名大小写不同，写入时序混乱，最终文件内容可能是原版的
 *   - 结果：用户启动 Forge 版本却看到原版 MC
 *
 *   修复方案：由调用方传入 targetVersionId，确保 installForge 写入的文件路径
 *   与 performInstallation 创建的版本目录完全一致。
 *
 * 【调用方式】
 *   1. performInstallation（下载页面）：必须传 targetVersionId = versionId
 *      → 例：installForge("26.2", "65.0.0", progress, null, "26.2-Forge-65.0.0")
 *   2. 修复/重装场景：可以不传 targetVersionId，用默认小写格式
 *      → 例：installForge("26.2", "65.0.0", progress)
 *
 * [AI-AUTOGEN-WARNING]
 *   - 不要删除 targetVersionId 参数
 *   - 不要把 performInstallation 中的 installForge 调用改为不传 targetVersionId
 *   - 不要修改 versionId 的默认值格式（小写 forge）
 *   - 修改前请理解 Windows NTFS 大小写不敏感的文件系统特性
 */
async function installForge(gameVersion, forgeVersion, onProgress = null, mirrorBaseUrl = null, targetVersionId = null) {
    if (forgeVersion && forgeVersion.startsWith(gameVersion + '-')) {
        forgeVersion = forgeVersion.slice(gameVersion.length + 1);
    }

    /*
    [CRITICAL] mcMajor 计算 —— 必须取 split('.')[0]
    ================================================
    【问题原理】
      gameVersion 的格式是 "主版本.次版本"，如 "26.2"（MC 1.26.2 的简写）。
      split('.') 得到数组 ["26", "2"]，其中 [0]="26" 是主版本号，[1]="2" 是次版本号。

      代码需要判断 MC 版本是否 >= 20（即 1.20+），以决定是否需要路由到 NeoForge 安装器。
      如果取 [1]，"26.2" 得到 mcMajor=2，2 >= 20 为 false，NeoForge 路由永远不会触发。
      如果取 [0]，"26.2" 得到 mcMajor=26，26 >= 20 为 true，NeoForge 路由正常工作。

    【历史Bug】
      原代码用的是 parseInt(gameVersion.split('.')[1])，导致：
      - MC 26.2 的 Forge 65.0.02/65.0.03 安装器被当作旧版 Forge 处理
      - installForge 调用 forge-installer.js，该脚本无法解析 NeoForge 格式的安装器
      - 安装后版本 JSON 全是原版内容：mainClass 是 net.minecraft.client.main.Main（应为 NeoForge 的），
        没有任何 Forge/NeoForge 库文件，没有 install_profile.json
      - 用户启动后看到的是原版 Minecraft，不是 Forge 版本

    【修复】
      改为 parseInt(gameVersion.split('.')[0])，对 "26.2" 得到 26。

    [AI-AUTOGEN-WARNING] 请勿将 [0] 改为 [1] 或其他索引。如果需要修改 mcMajor 的计算方式，
    请确保对 "26.2" 得到 >= 20 的值，对 "1.20.1" 得到 >= 20 的值。
    */
    const mcMajor = parseInt(gameVersion.split('.')[0]);
    // [CRITICAL - 2026-06-20] 不要把 Forge 版本路由到 installNeoForge！
    // Forge 和 NeoForge 的版本号体系完全不同（Forge: 64.0.10, NeoForge: 26.2.0），
    // 错误路由会导致 NeoForge 安装器 URL 不存在，下载失败。
    // 只有当 forgeVersion 字符串明确包含 "neoforge" 或 "neoforged" 时才路由到 NeoForge。
    // Forge Maven 上确实存在 MC 26+ 的版本（如 26.1.2-64.0.10），必须走 Forge 安装路径。
    if (mcMajor >= 20 && forgeVersion.split('.').length >= 3) {
        const isNeoForgeInstall = forgeVersion.includes('neoforge') || forgeVersion.includes('neoforged');
        if (isNeoForgeInstall) {
            return await installNeoForge(gameVersion, forgeVersion, onProgress);
        }
    }

    // [CRITICAL - 2026-06-21] targetVersionId 防止大小写不一致导致 Forge 启动为原版
    // 详见函数顶部注释。不要删除 targetVersionId，不要修改默认值格式。
    const versionId = targetVersionId || `${gameVersion}-forge-${forgeVersion}`;
    const versionStr = `${gameVersion}-${forgeVersion}`;

    const baseResult = await ensureBaseVersionInstalled(gameVersion);
    if (baseResult.error) {
        return { success: false, error: baseResult.error };
    }

    const forgeMavenBase = mirrorBaseUrl || 'https://bmclapi2.bangbang93.com/maven/net/minecraftforge/forge';
    const forgeMavenOfficial = 'https://maven.minecraftforge.net/net/minecraftforge/forge';
    const installerPath = path.join(ctx.dirs.DATA_DIR, 'temp', `forge-installer-${versionStr}.jar`);
    fs.mkdirSync(path.dirname(installerPath), { recursive: true });

    if (onProgress) onProgress(0, 'Downloading Forge installer...');

    const installerUrls = [
        `${forgeMavenBase}/${versionStr}/forge-${versionStr}-installer.jar`,
        `${forgeMavenOfficial}/${versionStr}/forge-${versionStr}-installer.jar`
    ];
    let installerOk = false;
    for (let attempt = 0; attempt < 3; attempt++) {
        const dlUrl = installerUrls[attempt % installerUrls.length];
        try {
            await http.downloadFileWithMirror(dlUrl, installerPath, null, 3, null, 60000);
            const dlStat = fs.statSync(installerPath);
            if (dlStat.size < 64 * 1024) {
                try { fs.unlinkSync(installerPath); } catch (_) {}
                continue;
            }
            const fd = fs.openSync(installerPath, 'r');
            const buf = Buffer.alloc(4);
            fs.readSync(fd, buf, 0, 4, 0);
            fs.closeSync(fd);
            if (buf[0] !== 0x50 || buf[1] !== 0x4B || buf[2] !== 0x03 || buf[3] !== 0x04) {
                try { fs.unlinkSync(installerPath); } catch (_) {}
                continue;
            }
            installerOk = true;
            break;
        } catch (e) {
            try { fs.unlinkSync(installerPath); } catch (_) {}
        }
    }
    if (!installerOk) {
        return { success: false, error: 'Forge installer download/verify failed' };
    }

    if (onProgress) onProgress(0.1, 'Extracting Forge installer...');

    const versionDir = path.join(ctx.dirs.VERSIONS_DIR, versionId);
    fs.mkdirSync(versionDir, { recursive: true });

    const AdmZip = require('adm-zip');
    const zip = new AdmZip(installerPath);
    const entries = zip.getEntries().map(e => e.entryName);

    let ip = null;
    const profileEntry = zip.getEntry('install_profile.json');
    if (profileEntry) {
        ip = JSON.parse(profileEntry.getData().toString('utf8'));
    }
    if (!ip) {
        return { success: false, error: 'install_profile.json not found in installer' };
    }

    let vj = null;
    const vjEntry = zip.getEntry('version.json');
    if (vjEntry) {
        vj = JSON.parse(vjEntry.getData().toString('utf8'));
    } else if (ip.json) {
        if (typeof ip.json === 'object') vj = ip.json;
        else if (typeof ip.json === 'string') {
            const entry = zip.getEntry(ip.json.replace(/^\//, ''));
            if (entry) vj = JSON.parse(entry.getData().toString('utf8'));
        }
    }
    if (!vj) {
        return { success: false, error: 'version.json not found in installer' };
    }

    const mavenEntries = entries.filter(e => e.startsWith('maven/') && !e.endsWith('/'));
    let extractedCount = 0;
    for (const entry of mavenEntries) {
        const relativePath = entry.replace('maven/', '');
        const destPath = path.join(ctx.dirs.LIBRARIES_DIR, relativePath);
        const dir = path.dirname(destPath);
        utils.ensureDir(destPath);
        if (fs.existsSync(destPath)) {
            const stat = fs.statSync(destPath);
            if (stat.isDirectory()) {
                try { fs.rmSync(destPath, { recursive: true, force: true }); } catch (_) {}
            }
        }
        if (!fs.existsSync(destPath)) {
            try {
                const entryObj = zip.getEntry(entry);
                fs.writeFileSync(destPath, entryObj.getData());
                extractedCount++;
            } catch (_) {}
        }
    }
    console.log(`[Forge] Extracted ${extractedCount} maven entries`);

    if (!ip.data) ip.data = {};
    ip.data.BINPATCH = ip.data.BINPATCH || { client: '', server: '' };

    const forgeVersionPath = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'minecraftforge', 'forge', versionStr);
    utils.ensureDir(path.join(forgeVersionPath, 'dummy'));

    if (zip.getEntry('data/client.lzma')) {
        const clientLzmaPath = path.join(forgeVersionPath, `forge-${versionStr}-clientdata.lzma`);
        const entryObj = zip.getEntry('data/client.lzma');
        fs.writeFileSync(clientLzmaPath, entryObj.getData());
        ip.data.BINPATCH.client = `[net.minecraftforge:forge:${versionStr}:clientdata@lzma]`;
    }
    if (zip.getEntry('data/server.lzma')) {
        const serverLzmaPath = path.join(forgeVersionPath, `forge-${versionStr}-serverdata.lzma`);
        const entryObj = zip.getEntry('data/server.lzma');
        fs.writeFileSync(serverLzmaPath, entryObj.getData());
        ip.data.BINPATCH.server = `[net.minecraftforge:forge:${versionStr}:serverdata@lzma]`;
    }
    ip.data.INSTALLER = {
        client: `[net.minecraftforge:forge:${versionStr}:installer]`,
        server: `[net.minecraftforge:forge:${versionStr}:installer]`
    };

    if (onProgress) onProgress(0.2, 'Preparing processors...');

    const processors = (ip.processors || [])
        .filter(proc => !proc.sides || proc.sides.indexOf('client') !== -1);

    const processorsInfo = [];
    for (const proc of processors) {
        let mainClass = '';
        const procJarParts = proc.jar ? proc.jar.split(':') : [];
        if (procJarParts.length >= 3) {
            const groupPath = procJarParts[0].replace(/\./g, '/');
            const classifier = procJarParts[3] || '';
            const jarName = classifier
                ? `${procJarParts[1]}-${procJarParts[2]}-${classifier}.jar`
                : `${procJarParts[1]}-${procJarParts[2]}.jar`;
            const jarPath = path.join(ctx.dirs.LIBRARIES_DIR, groupPath, procJarParts[1], procJarParts[2], jarName);
            if (fs.existsSync(jarPath)) {
                try {
                    const jarZip = new AdmZip(jarPath);
                    const manifestEntry = jarZip.getEntry('META-INF/MANIFEST.MF');
                    if (manifestEntry) {
                        const manifest = manifestEntry.getData().toString('utf8');
                        for (const line of manifest.split(/\r?\n/)) {
                            const trimmed = line.trim();
                            if (trimmed.startsWith('Main-Class:')) {
                                mainClass = trimmed.substring('Main-Class:'.length).trim();
                                break;
                            }
                        }
                    }
                } catch (_) {}
            }
        }

        const classpath = (proc.classpath || []).filter(Boolean);
        const resolvedArgs = (proc.args || []).map(a => a);
        const outputs = proc.outputs || {};

        processorsInfo.push({
            jar: proc.jar,
            mainClass,
            classpath,
            args: resolvedArgs,
            outputs,
        });
    }

    const configData = { installProfile: ip, versionJson: vj, processors: processorsInfo };
    const configPath = path.join(ctx.dirs.DATA_DIR, 'temp', `forge-config-${versionStr}.json`);
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));

    if (onProgress) onProgress(0.3, 'Running Forge processors...');

    const installerScriptSrc = path.join(SERVER_DIR, 'forge-installer.js');
    const installerScriptDst = path.join(ctx.dirs.DATA_DIR, 'temp', `forge-installer-${versionId}.js`);
    try {
        fs.mkdirSync(path.dirname(installerScriptDst), { recursive: true });
        if (fs.existsSync(installerScriptDst)) { try { fs.unlinkSync(installerScriptDst); } catch(_) {} }
        const _srcContent = fs.readFileSync(installerScriptSrc, 'utf8');
        fs.writeFileSync(installerScriptDst, _srcContent, 'utf8');
    } catch(_) {}

    let nodeExe = 'node';
    let nodeEnv = { ...process.env, ELECTRON_RUN_AS_NODE: '' };
    if (SERVER_DIR.includes('app.asar') && process.platform === 'win32') {
        const possibleNode = path.join(path.dirname(process.execPath), 'node.exe');
        if (fs.existsSync(possibleNode)) {
            nodeExe = possibleNode;
        } else {
            // 用户机器上没有安装 Node.js 时，使用 Electron 自身作为 Node.js 运行时。
            // process.execPath 是 Electron 可执行文件，设置 ELECTRON_RUN_AS_NODE=1
            // 后它会以 Node.js 模式运行，功能等同于独立的 node 命令。
            nodeExe = process.execPath;
            nodeEnv = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
        }
    }
    // 按游戏版本选择合适的 Java 运行 processor（如 1.20.1 → Java 17、1.21.1 → Java 21）。
    // 找不到匹配范围的 Java 时不能留空，否则 forge-installer.js 会回退到 PATH 里的旧版 Java
    // （如 Java 8），导致高版本 Forge 处理器直接崩溃。
    let forgeJavaPath = '';
    try {
        forgeJavaPath = java.selectJavaForVersion(gameVersion, {}) || '';
    } catch (_) {}
    if (forgeJavaPath && !fs.existsSync(forgeJavaPath)) forgeJavaPath = '';

    if (!forgeJavaPath) {
        // 范围内没有可用的 Java。不能盲目使用"系统里最高版本的 Java"——若最高版本超出了
        // 该 MC 版本 / Forge 允许的范围，处理器仍会崩溃。这里参照主流启动器的做法：
        // 自动下载一个匹配该游戏版本的官方 Java 运行时。
        let requiredMajor = 0;
        try {
            requiredMajor = java.getRequiredJavaVersion(gameVersion);
        } catch (_) {}
        if (!requiredMajor) {
            const mcMajor = parseInt(gameVersion.split('.')[0], 10);
            const mcMinor = parseInt(gameVersion.split('.')[1], 10) || 0;
            const mcPatch = parseInt((gameVersion.split('.')[2] || '0').split('-')[0], 10) || 0;
            if (mcMajor >= 2 || (mcMajor === 1 && (mcMinor > 20 || (mcMinor === 20 && mcPatch >= 5)))) requiredMajor = 21;
            else if (mcMajor === 1 && mcMinor >= 18) requiredMajor = 17;
            else if (mcMajor === 1 && mcMinor === 17) requiredMajor = 16;
            else requiredMajor = 8;
        }
        const majorToComponent = { 8: 'jre-legacy', 16: 'java-runtime-beta', 17: 'java-runtime-beta', 21: 'java-runtime-delta', 25: 'java-runtime-epsilon' };
        const component = majorToComponent[requiredMajor];
        if (component) {
            try {
                if (onProgress) onProgress(0.3, `未找到合适的 Java，正在自动下载 Java ${requiredMajor}...`);
                const dl = await java.downloadJavaRuntime(component, (p) => {
                    if (onProgress) {
                        const pct = 0.3 + Math.min(p.progress || 0, 100) / 100 * 0.1;
                        const label = p.current && p.total
                            ? `下载 Java ${requiredMajor}... ${p.current}/${p.total}`
                            : `下载 Java ${requiredMajor}... ${p.progress || 0}%`;
                        onProgress(pct, label);
                    }
                });
                if (dl && dl.path && fs.existsSync(dl.path)) {
                    forgeJavaPath = dl.path;
                    if (onProgress) onProgress(0.4, `Java ${requiredMajor} 已就绪`);
                }
            } catch (dlErr) {
                console.warn(`[Forge] 自动下载 Java ${requiredMajor} 失败: ${dlErr.message}`);
            }
        }
        if (forgeJavaPath && !fs.existsSync(forgeJavaPath)) forgeJavaPath = '';
    }

    const args = [installerScriptDst,
        '--root', ctx.dirs.DATA_DIR,
        '--libs', ctx.dirs.LIBRARIES_DIR,
        '--verdir', versionDir,
        '--forgever', versionStr,
        '--gamever', gameVersion,
        '--config', configPath,
        '--appdir', path.resolve(SERVER_DIR)
    ];
    if (forgeJavaPath) {
        args.push('--javapath', forgeJavaPath);
    }

    return new Promise((resolve) => {
        const proc = spawn(nodeExe, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
            env: nodeEnv
        });
        let stdout = '', stderr = '', doneMsg = null;
        const parse = (line) => {
            if (!line || !line.startsWith('{')) return;
            try {
                const msg = JSON.parse(line);
                if (msg.type === 'progress' && onProgress) onProgress(msg.percent, msg.message);
                if (msg.type === 'done') {
                    doneMsg = msg;
                    if (msg.success) {
                        versions._invalidateResolvedJsonCache(versionId);
                    }
                }
            } catch (_) {}
        };
        proc.stdout.on('data', (data) => {
            stdout += data.toString();
            const lines = stdout.split('\n');
            stdout = lines.pop();
            for (const line of lines) parse(line.trim());
        });
        proc.stderr.on('data', (data) => {
            stderr += data.toString();
            const lines = stderr.split('\n');
            stderr = lines.pop();
            for (const line of lines) parse(line.trim());
        });
        proc.on('close', async (code) => {
            if (stdout.trim()) parse(stdout.trim());
            if (stderr.trim()) parse(stderr.trim());
            if (!doneMsg) {
                if (code === 0) {
                    versions._invalidateResolvedJsonCache(versionId);
                    doneMsg = { success: true, versionId };
                } else {
                    const errMsg = stderr.trim() || stdout.trim() || `Exit code ${code}`;
                    try { if (fs.existsSync(versionDir)) fs.rmSync(versionDir, { recursive: true, force: true }); } catch (_) {}
                    try { if (fs.existsSync(installerPath)) fs.unlinkSync(installerPath); } catch (_) {}
                    try { if (fs.existsSync(configPath)) fs.unlinkSync(configPath); } catch (_) {}
                    try { if (fs.existsSync(installerScriptDst)) fs.unlinkSync(installerScriptDst); } catch (_) {}
                    resolve({ success: false, error: `forge-installer.js exited with code ${code}: ${errMsg.slice(-300)}` });
                    return;
                }
            }
            if (doneMsg && doneMsg.success) {
                try {
                    const vJsonPath = path.join(versionDir, `${versionId}.json`);
                    if (!fs.existsSync(vJsonPath)) {
                        try { if (fs.existsSync(versionDir)) fs.rmSync(versionDir, { recursive: true, force: true }); } catch (_) {}
                        try { if (fs.existsSync(installerPath)) fs.unlinkSync(installerPath); } catch (_) {}
                        try { if (fs.existsSync(configPath)) fs.unlinkSync(configPath); } catch (_) {}
                        try { if (fs.existsSync(installerScriptDst)) fs.unlinkSync(installerScriptDst); } catch (_) {}
                        resolve({ success: false, error: `Forge 安装失败：版本配置文件未生成（子进程未完成 JSON 写入）` });
                        return;
                    }
                    if (fs.existsSync(vJsonPath)) {
                        const vJson = JSON.parse(fs.readFileSync(vJsonPath, 'utf8'));

                        if (vJson.inheritsFrom) {
                            const vanillaId = vJson.inheritsFrom;
                            const vanillaPath = path.join(path.dirname(versionDir), vanillaId, `${vanillaId}.json`);
                            if (fs.existsSync(vanillaPath)) {
                                const vanillaJson = JSON.parse(fs.readFileSync(vanillaPath, 'utf8'));
                                const seen = new Set((vJson.libraries || []).map(l => l.name).filter(Boolean));
                                for (const vl of (vanillaJson.libraries || [])) {
                                    if (vl.name && !seen.has(vl.name)) {
                                        vJson.libraries = vJson.libraries || [];
                                        vJson.libraries.push(vl);
                                        seen.add(vl.name);
                                    }
                                }
                                if (!vJson.arguments && vanillaJson.arguments) vJson.arguments = vanillaJson.arguments;
                            }
                            delete vJson.inheritsFrom;
                            fs.writeFileSync(vJsonPath, JSON.stringify(vJson, null, 2));
                        }

                        const libs = vJson.libraries || [];
                        const missing = [];
                        for (const lib of libs) {
                            const dl = lib.downloads && lib.downloads.artifact;
                            if (dl && dl.path) {
                                const lp = path.join(ctx.dirs.LIBRARIES_DIR, dl.path);
                                if (!fs.existsSync(lp) || (dl.sha1 && !isLibValid(lp, dl.size, dl.sha1))) {
                                    missing.push(lib);
                                }
                            } else if (lib.name && !(lib.downloads && lib.downloads.artifact)) {
                                const parts = lib.name.split(':');
                                if (parts.length >= 3) {
                                    const gPath = parts[0].replace(/\./g, '/');
                                    const atIdx = parts[2].indexOf('@');
                                    const ext = atIdx >= 0 ? parts[2].substring(atIdx + 1) : 'jar';
                                    const ver = atIdx >= 0 ? parts[2].substring(0, atIdx) : parts[2];
                                    let classifier = '';
                                    let extOverride = '';
                                    if (parts[3]) {
                                        const atIdx3 = parts[3].indexOf('@');
                                        if (atIdx3 >= 0) { classifier = parts[3].substring(0, atIdx3); extOverride = parts[3].substring(atIdx3 + 1); }
                                        else classifier = parts[3];
                                    }
                                    const finalExt = extOverride || ext;
                                    const fName = classifier ? `${parts[1]}-${ver}-${classifier}.${finalExt}` : `${parts[1]}-${ver}.${finalExt}`;
                                    const rPath = `${gPath}/${parts[1]}/${ver}/${fName}`;
                                    const lp = path.join(ctx.dirs.LIBRARIES_DIR, rPath);
                                    if (!fs.existsSync(lp)) {
                                        missing.push({ ...lib, _mavenPath: rPath, _mavenName: lib.name, _url: lib.url || null });
                                    }
                                }
                            }
                        }
                        if (missing.length > 0 && onProgress) onProgress(0.95, `下载 Forge 库文件 (0/${missing.length})...`);
                        if (missing.length > 0) {
                            const FORGE_LIB_PARALLEL = 32;
                            const FORGE_LIB_TIMEOUT = 180000;
                            let completed = 0;
                            let failed = 0;
                            let active = 0;
                            let done = null;

                            const scheduleNext = () => {
                                while (active < FORGE_LIB_PARALLEL && completed + failed + active < missing.length) {
                                    const lib = missing[completed + failed + active];
                                    active++;
                                    (async () => {
                                        const downloadTask = async () => {
                                            if (lib._mavenPath) {
                                                const lp = path.join(ctx.dirs.LIBRARIES_DIR, lib._mavenPath);
                                                utils.ensureDir(path.join(lp, 'dummy'));
                                                const urls = [];
                                                if (lib._url) urls.push(lib._url.replace(/\/$/, '') + '/' + lib._mavenPath.split('/').pop());
                                                urls.push(
                                                    `https://maven.minecraftforge.net/${lib._mavenPath}`,
                                                    `https://libraries.minecraft.net/${lib._mavenPath}`,
                                                    `https://bmclapi2.bangbang93.com/maven/${lib._mavenPath}`,
                                                );
                                                let ok = false;
                                                for (const u of urls) {
                                                    try {
                                                        await http.downloadFileWithMirror(u, lp, null, 1, null, 60000);
                                                        ok = true;
                                                        break;
                                                    } catch (dlErr) {
                                                        console.warn(`[installForge] 下载 ${lib.name} 从 ${u} 失败: ${dlErr.message}`);
                                                    }
                                                }
                                                if (!ok) throw new Error('所有下载源均失败');
                                            } else {
                                                const dl = lib.downloads.artifact;
                                                const lp = path.join(ctx.dirs.LIBRARIES_DIR, dl.path);
                                                utils.ensureDir(path.join(lp, 'dummy'));
                                                await http.downloadFileWithMirror(dl.url, lp, null, 2, null, 60000);
                                            }
                                        };
                                        await Promise.race([
                                            downloadTask(),
                                            new Promise((_, reject) => setTimeout(() => reject(new Error(`下载超时 (${FORGE_LIB_TIMEOUT / 1000}s)`)), FORGE_LIB_TIMEOUT))
                                        ]);
                                    })().then(() => {
                                        completed++;
                                    }).catch((e) => {
                                        console.warn(`[installForge] 下载库 ${lib.name} 失败: ${e.message}`);
                                        failed++;
                                    }).finally(() => {
                                        active--;
                                        if (onProgress) onProgress(0.95 + Math.min((completed + failed) / missing.length, 1) * 0.05, `下载 Forge 库文件 (${completed + failed}/${missing.length})...`);
                                        if (active === 0 && completed + failed >= missing.length && done) done();
                                        else if (active < FORGE_LIB_PARALLEL && completed + failed + active < missing.length) scheduleNext();
                                    });
                                }
                            };
                            await new Promise(resolve => { done = resolve; scheduleNext(); });
                        }
                    }
                } catch (e) {
                    console.warn(`[installForge] 下载库失败: ${e.message}`);
                }
            }
            resolve(doneMsg || { success: code === 0, versionId });
        });
        proc.on('error', (err) => {
            try { if (fs.existsSync(versionDir)) fs.rmSync(versionDir, { recursive: true, force: true }); } catch (_) {}
            try { if (fs.existsSync(installerPath)) fs.unlinkSync(installerPath); } catch (_) {}
            try { if (fs.existsSync(configPath)) fs.unlinkSync(configPath); } catch (_) {}
            try { if (fs.existsSync(installerScriptDst)) fs.unlinkSync(installerScriptDst); } catch (_) {}
            resolve({ success: false, error: `Failed to start forge-installer.js: ${err.message}` });
        });
    });
}

async function mergeForgeLoaderToVersion(versionId, gameVersion, forgeVersion) {
    const mergeLogFile = path.join(ctx.dirs.DATA_DIR, 'temp', 'forge-merge.log');
    const mergeLog = (msg) => {
        const line = `[${new Date().toISOString()}] ${msg}\n`;
        try { fs.appendFileSync(mergeLogFile, line); } catch(_) {}
        console.log(`[Forge-MERGE] ${msg}`);
    };
    try { fs.mkdirSync(path.dirname(mergeLogFile), { recursive: true }); } catch(_) {}
    try { fs.writeFileSync(mergeLogFile, ''); } catch(_) {}
    mergeLog(`mergeForgeLoaderToVersion: versionId=${versionId}, gameVersion=${gameVersion}, forgeVersion=${forgeVersion}`);
    const versionDir = path.join(ctx.dirs.VERSIONS_DIR, versionId);
    const jsonPath = path.join(versionDir, `${versionId}.json`);
    const AdmZip = require('adm-zip');

    const installerUrl = `${ctx.urls.FORGE_MAVEN_URL}/${gameVersion}-${forgeVersion}/forge-${gameVersion}-${forgeVersion}-installer.jar`;
    const installerPath = path.join(ctx.dirs.DATA_DIR, 'temp', `forge-installer-${gameVersion}-${forgeVersion}.jar`);
    if (!fs.existsSync(path.dirname(installerPath))) fs.mkdirSync(path.dirname(installerPath), { recursive: true });

    mergeLog(`Downloading installer: ${installerUrl}`);
    await http.downloadFileWithMirror(installerUrl, installerPath);
    mergeLog(`Installer downloaded: ${fs.statSync(installerPath).size} bytes`);

    const zip = new AdmZip(installerPath);
    const versionEntry = zip.getEntry('version.json') || zip.getEntry(`${gameVersion}-forge-${forgeVersion}.json`);
    mergeLog(`version.json entry: ${versionEntry ? 'FOUND' : 'NOT FOUND'}`);

    if (versionEntry) {
        const forgeJson = JSON.parse(versionEntry.getData().toString('utf8'));
        forgeJson.id = versionId;
        forgeJson.inheritsFrom = gameVersion;
        if (!forgeJson.type) forgeJson.type = 'release';

        const currentJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        versions.mergeVersionJson(currentJson, forgeJson);

        fs.writeFileSync(jsonPath, JSON.stringify(currentJson, null, 2));

        const mavenEntries2 = zip.getEntries().filter(e => e.entryName.startsWith('maven/'));
        console.log(`[Forge-merge] 先提取 maven 文件: ${mavenEntries2.length} entries`);
        let mergeYieldCounter = 0;
        for (const entry of mavenEntries2) {
            const relativePath = entry.entryName.replace('maven/', '');
            const extractPath = path.join(ctx.dirs.LIBRARIES_DIR, relativePath);
            if (!fs.existsSync(extractPath)) {
                await utils.asyncEnsureDir(path.join(extractPath, 'dummy.txt'));
                try { await fs.promises.writeFile(extractPath, entry.getData()); } catch (e) {
                    console.error(`[Forge-merge] 解压Maven文件失败: ${relativePath} - ${e.message}`);
                }
            } else if (extractPath.endsWith('.jar') && !utils.isJarIntact(extractPath)) {
                try { await fs.promises.unlink(extractPath); } catch (_) {}
                await utils.asyncEnsureDir(path.join(extractPath, 'dummy.txt'));
                try { await fs.promises.writeFile(extractPath, entry.getData()); } catch (e) {
                    console.error(`[Forge-merge] 重写损坏Maven文件失败: ${relativePath} - ${e.message}`);
                }
            }
            if (++mergeYieldCounter % 30 === 0) await utils.yieldToEventLoop();
        }

        for (const lib of (currentJson.libraries || [])) {
            if (lib.rules && !versions.evaluateRules(lib.rules)) continue;
            if (lib.downloads?.artifact?.path) {
                const libPath = path.join(ctx.dirs.LIBRARIES_DIR, lib.downloads.artifact.path);
                if (!fs.existsSync(libPath) && lib.downloads.artifact.url) {
                    try {
                        await http.downloadFileWithMirror(lib.downloads.artifact.url, libPath);
                        if (libPath.endsWith('.jar') && !utils.isJarIntact(libPath)) {
                            throw new Error(`下载后JAR损坏: ${path.basename(libPath)}`);
                        }
                    } catch (e) {
                        console.error(`[Forge-merge] 库下载失败: ${lib.downloads.artifact.path} - ${e.message}`);
                        try { fs.unlinkSync(libPath); } catch (_) {}
                    }
                }
            }
        }
    } else {
        mergeLog(`version.json NOT found, using fallback mainClass`);
        const versionJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        versionJson.mainClass = 'cpw.mods.modlauncher.Launcher';
        versionJson.arguments = versionJson.arguments || {};
        versionJson.arguments.game = versionJson.arguments.game || [];
        versionJson.arguments.game.push('--fml.forgeVersion', forgeVersion, '--fml.mcVersion', gameVersion, '--fml.forgeGroup', 'net.minecraftforge');
        versionJson.libraries = versionJson.libraries || [];
        fs.writeFileSync(jsonPath, JSON.stringify(versionJson, null, 2));
        versions._invalidateResolvedJsonCache(versionId);
    }

    try { fs.unlinkSync(installerPath); } catch (e) {}

    const ipPath = path.join(versionDir, 'install_profile.json');
    mergeLog(`install_profile.json exists: ${fs.existsSync(ipPath)}`);
    if (fs.existsSync(ipPath)) {
        try {
            const ipData = JSON.parse(fs.readFileSync(ipPath, 'utf8'));
            mergeLog(`install_profile.json: processors=${ipData.processors?.length || 0}, data keys=${ipData.data ? Object.keys(ipData.data).join(', ') : 'none'}`);
            if (ipData.processors && ipData.processors.length > 0) {
                mergeLog(`Found ${ipData.processors.length} processors, executing...`);
                // 直接调用 Java installertools 执行 PROCESS_MINECRAFT_JAR
                // 失败时抛出错误，避免错误地报告合并成功
                const _mcJarPath = path.join(ctx.dirs.VERSIONS_DIR, gameVersion, `${gameVersion}.jar`);
                let _clientLzmaPath = null;
                let _patchedJarPath = null;
                if (ipData.data) {
                    if (ipData.data.BINPATCH && ipData.data.BINPATCH.client) {
                        _clientLzmaPath = ipData.data.BINPATCH.client;
                    }
                    if (ipData.data.PATCHED && ipData.data.PATCHED.client) {
                        _patchedJarPath = ipData.data.PATCHED.client;
                    }
                }
                // 兜底路径
                if (!_clientLzmaPath) {
                    _clientLzmaPath = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'minecraftforge', 'forge', `${gameVersion}-${forgeVersion}`, `forge-${gameVersion}-${forgeVersion}-client.lzma`);
                }
                if (!_patchedJarPath) {
                    _patchedJarPath = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'minecraftforge', 'forge', `${gameVersion}-${forgeVersion}`, `forge-${gameVersion}-${forgeVersion}-client.jar`);
                }
                mergeLog(`mcJar=${_mcJarPath}, clientLzma=${_clientLzmaPath}, output=${_patchedJarPath}`);
                await runPatchProcessor({
                    mcJarPath: _mcJarPath,
                    clientLzmaPath: _clientLzmaPath,
                    patchedJarPath: _patchedJarPath,
                    profileLibs: ipData.libraries || [],
                    processors: ipData.processors || [],
                    onProgress: null,
                    logPrefix: '[Forge]'
                });
                mergeLog(`Patch processor completed successfully`);
            }
        } catch (e) {
            mergeLog(`[ERROR] Failed to read install_profile.json or run processor: ${e.message}`);
            throw new Error(`Forge 处理器执行失败: ${e.message}`);
        }
    }

    mergeLog(`Loader merged into version: ${versionId}`);
}

module.exports = {
    downloadForgeCoreLibsFromMaven,
    downloadForgePatchingJars,
    findForgeCoreJars,
    runForgeInstallerJar,
    installForge,
    mergeForgeLoaderToVersion,
};
