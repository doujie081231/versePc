/**
 * @file server/modloaders/neoforge.js
 * @description NeoForge 加载器安装模块（从 server/modloaders.js 拆分）。
 *   包含 NeoForge 核心 jar 查找、NeoForge 安装、合并到版本 JSON、
 *   指定 MC 版本的 NeoForge 版本列表获取等功能。
 */
const fs = require('fs');
const path = require('path');

const ctx = require('../context');
const utils = require('../utils');
const http = require('../http-client');
const versions = require('../versions');
const java = require('../java');

const { ensureBaseVersionInstalled, isLibValid, getNeoLibMirrorUrl, SERVER_DIR, runPatchProcessor } = require('./shared');

/**
 * 从版本 JSON 和搜索路径中查找 NeoForge 核心库 JAR 文件。
 * @param {object} versionJson - 版本 JSON 对象
 * @param {string[]} searchBases - 库搜索根路径数组
 * @param {Array} gameArgs - 版本 JSON 的 arguments.game 数组
 * @returns {string[]} 找到的 JAR 文件绝对路径数组
 */
function findNeoForgeCoreJars(versionJson, searchBases, gameArgs) {
  console.log(`[findNeoForgeCoreJars] called, versionId=${versionJson.id}, gameArgsLen=${gameArgs.length}, searchBasesLen=${searchBases.length}`);
  let neoForgeVersion = '';
  let mcVersion = '';

  const neoForgeVerIdx = gameArgs.findIndex((a) => typeof a === 'string' && a === '--fml.neoForgeVersion');
  const mcVerIdx = gameArgs.findIndex((a) => typeof a === 'string' && a === '--fml.mcVersion');

  console.log(`[findNeoForgeCoreJars] neoForgeVerIdx=${neoForgeVerIdx} mcVerIdx=${mcVerIdx}`);

  if (neoForgeVerIdx >= 0 && neoForgeVerIdx + 1 < gameArgs.length) {
    neoForgeVersion = gameArgs[neoForgeVerIdx + 1];
  }
  if (mcVerIdx >= 0 && mcVerIdx + 1 < gameArgs.length) {
    mcVersion = gameArgs[mcVerIdx + 1];
  }
  if (!mcVersion && versionJson.clientVersion) {
    mcVersion = versionJson.clientVersion;
  }

  if (!neoForgeVersion) {
    const neoLib = (versionJson.libraries || []).find((l) =>
      l.name && l.name.startsWith('net.neoforged:neoforge:')
    );
    if (neoLib) {
      const parts = neoLib.name.split(':');
      if (parts.length >= 3) {
        neoForgeVersion = parts[2];
      }
    }
    if (!neoForgeVersion) {
      const versionDirName = versionJson.id || '';
      const neoMatch = versionDirName.match(/neoforge[_\-\s]*(\d+[\d.]*(?:\.\d+)*)/i);
      if (neoMatch) {
        neoForgeVersion = neoMatch[1];
      }
    }
    if (!neoForgeVersion) {
      const fmlLoaderLib = (versionJson.libraries || []).find((l) =>
        l.name && l.name.startsWith('net.neoforged.fancymodloader:loader:')
      );
      if (fmlLoaderLib) {
        const parts = fmlLoaderLib.name.split(':');
        if (parts.length >= 3) {
          neoForgeVersion = parts[2];
        }
      }
    }
  }

  if (!neoForgeVersion) {
    console.log(`[findNeoForgeCoreJars] neoForgeVersion empty, returning []`);
    return [];
  }

  console.log(`[findNeoForgeCoreJars] neoForgeVersion=${neoForgeVersion} mcVersion=${mcVersion}`);

  // 检查 version JSON 的 libraries 是否已有 neoforge:<version>:client 库条目（patched jar）。
  const hasPatchedClientLib = (versionJson.libraries || []).some((l) =>
    l.name === `net.neoforged:neoforge:${neoForgeVersion}:client`
  );
  const _neoVerParts = neoForgeVersion.split(/[.\-]/);
  const _neoMajor = parseInt(_neoVerParts[0], 10) || 0;
  const _neoMinor = parseInt(_neoVerParts[1], 10) || 0;
  const _isNewScheme = (_neoMajor === 20 && _neoMinor >= 6) || _neoMajor >= 21;

  // 新版 NeoForge（20.6+/21.x/26.x）：不向 classpath 添加任何 neoforge-*-client.jar 或
  // neoforge-*-universal.jar。这两个 jar 由 NeoForge 的 ProductionClientProviderLocator
  // 通过 -DlibraryDirectory + --fml.neoForgeVersion 参数自动查找并加载：
  //   - patched jar（minecraft-client-patched-<ver>.jar 或 neoforge-<ver>-client.jar）→ minecraft 模块
  //   - universal jar（neoforge-<ver>-universal.jar）→ neoforge mod
  // 若手动加入 classpath，会导致 JPMS 模块层冲突：
  //   "Module l2serial._4 reads more than one module named neoforge"
  // 因为 classpath 中的 jar 和 locator 加载的 jar 都会被 JPMS 解析为同名的 'neoforge' 自动模块。
  // 参考：classpath 中不包含这两个 neoforge-*-client.jar 和 neoforge-*-universal.jar。
  if (_isNewScheme) {
    console.log(`[findNeoForgeCoreJars] NeoForge ${neoForgeVersion} (new scheme): 不向 classpath 添加 neoforge jar，由 locator 通过 -DlibraryDirectory 自动查找`);
    return [];
  }

  // 旧版 NeoForge（47.x/48.x/49.x 等 MC 1.20.4 及以前）：
  // patched jar 包含完整的 NeoForge mod 元数据（mods.toml + automatic-module-name），
  // 如果同时添加 universal jar 会导致 JPMS 冲突：
  // "Module konkrete reads more than one module named neoforge"
  // 因为两个 jar 的 JPMS 自动模块名都是 'neoforge'。
  if (hasPatchedClientLib) {
    console.log(`[findNeoForgeCoreJars] version JSON 已有 neoforge:${neoForgeVersion}:client 库条目（patched jar），跳过添加 universal jar 以避免 JPMS 模块冲突`);
    return [];
  }

  // 旧版 NeoForge 且 version JSON 没有 patched client 库条目时，
  // 添加 universal jar 到 classpath（旧版行为，保留兼容性）
  const result = [];
  const prefix = 'net/neoforged/neoforge';

  for (const base of searchBases) {
    if (!base) continue;
    const dirPath = path.join(base, prefix, neoForgeVersion);
    if (!fs.existsSync(dirPath)) continue;

    const candidates = [
      `neoforge-${neoForgeVersion}-universal.jar`,
      `neoforge-${neoForgeVersion}.jar`
    ];
    let found = false;
    for (const candidate of candidates) {
      const jarPath = path.join(dirPath, candidate);
      if (fs.existsSync(jarPath)) {
        result.push(jarPath);
        found = true;
        break;
      }
    }
    if (!found) {
      try {
        const files = fs.readdirSync(dirPath)
          .filter((f) => f.startsWith('neoforge-') && f.endsWith('.jar') && !f.endsWith('-sources.jar') && !f.endsWith('-javadoc.jar'));
        if (files.length > 0) {
          result.push(path.join(dirPath, files[0]));
        }
      } catch (e) {}
    }
    break;
  }

  if (result.length > 0) {
    console.log(`[Classpath] 自动添加NeoForge核心JAR (${result.length}): ${result.map((r) => path.basename(r)).join(', ')}`);
  } else {
    console.log(`[findNeoForgeCoreJars] no JAR found in searchBases, returning []`);
  }

  return result;
}

/**
 * 安装 NeoForge 加载器（解包 installer JAR、下载库、合并版本 JSON、运行处理器）。
 * @param {string} gameVersion - Minecraft 版本号，如 "1.20.1"
 * @param {string} neoVersion - NeoForge 版本号，如 "47.1.0" 或 "20.6.3-beta"
 * @param {(percent: number, message: string) => void} [onProgress] - 进度回调
 * @returns {Promise<{success: boolean, versionId?: string, libsMissing?: number, error?: string}>} 安装结果
 */
async function installNeoForge(gameVersion, neoVersion, onProgress = null, targetVersionId = null) {
  const isLegacy = neoVersion.startsWith('1.20.1-');
  const packageName = isLegacy ? 'forge' : 'neoforge';
  // [CRITICAL FIX - 2026-07-20] 添加 targetVersionId 参数（参考 installForge 的同款修复）。
  // performInstallation 创建的版本目录名（versionDetails.id）可能与本函数内部默认生成的
  // versionId（${gameVersion}-NeoForge-${neoVersion}）不一致，例如用户在下载对话框改了版本名。
  // 不一致会导致：performInstallation 在 A 目录写入原版 JSON（mainClass=net.minecraft.client.main.Main），
  // 而本函数在 B 目录写入正确的 NeoForge JSON，启动游戏时找到的是 A 目录的原版 JSON，
  // 游戏表现为原版 MC 而非 NeoForge。调用方（performInstallation）必须传入 versionId 作为 targetVersionId。
  const versionId = targetVersionId || `${gameVersion}-NeoForge-${neoVersion}`;

  try {
    // 1. 确保原版已安装
    const baseResult = await ensureBaseVersionInstalled(gameVersion);
    if (baseResult.error) {
      return { success: false, error: baseResult.error };
    }

    const versionDir = path.join(ctx.dirs.VERSIONS_DIR, versionId);
    fs.mkdirSync(versionDir, { recursive: true });

    // 2. 下载安装器 JAR
    const installerPath = path.join(ctx.dirs.DATA_DIR, 'temp', `neoforge-installer-${neoVersion}.jar`);
    fs.mkdirSync(path.dirname(installerPath), { recursive: true });

    if (onProgress) onProgress(0, '正在下载NeoForge安装包...');

    const neoforgeMavenOfficial = 'https://maven.neoforged.net/releases/net/neoforged';
    const installerUrls = [
      `https://bmclapi2.bangbang93.com/maven/net/neoforged/${packageName}/${neoVersion}/${packageName}-${neoVersion}-installer.jar`,
      `${neoforgeMavenOfficial}/${packageName}/${neoVersion}/${packageName}-${neoVersion}-installer.jar`
    ];
    console.log(`[NeoForge] Downloading installer: ${installerUrls[0]}`);

    let installerOk = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const dlUrl = installerUrls[attempt % installerUrls.length];
      try {
        await http.downloadFileWithMirror(dlUrl, installerPath);
        const dlStat = fs.statSync(installerPath);
        if (dlStat.size < 64 * 1024) {
          console.error(`[NeoForge] Installer too small (${dlStat.size} bytes), retrying...`);
          try { fs.unlinkSync(installerPath); } catch (_) {}
          continue;
        }
        // 用 AdmZip 验证完整 ZIP 结构（会解析中央目录），截断/损坏的安装器在此抛错重试，
        // 避免"magic 正确但解压失败"的残缺文件进入后续安装流程。
        const _zipCheck = new (require('adm-zip'))(installerPath);
        if (_zipCheck.getEntries().length === 0) {
          console.error(`[NeoForge] Installer ZIP 无条目，retrying...`);
          try { fs.unlinkSync(installerPath); } catch (_) {}
          continue;
        }
        installerOk = true;
        break;
      } catch (e) {
        console.error(`[NeoForge] Installer download failed: ${e.message}`);
        try { fs.unlinkSync(installerPath); } catch (_) {}
      }
    }
    if (!installerOk) {
      throw new Error('NeoForge安装器下载失败，请检查网络');
    }

    if (onProgress) onProgress(0.1, '正在解包 NeoForge 安装器...');

    // 3. 直接从 JAR 中解压版本信息（像 XMCL 一样，不跑 Java 安装器）
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(installerPath);

    // 提取 install_profile.json
    let installProfile = null;
    try {
      const profileEntry = zip.getEntry('install_profile.json');
      if (profileEntry) installProfile = JSON.parse(profileEntry.getData().toString('utf8'));
    } catch (e) {
      console.warn(`[NeoForge] 读取 install_profile.json 失败: ${e.message}`);
    }

    // 提取 version.json（安装器自带的目标版本配置）
    let versionJsonData = null;
    try {
      const versionEntry = zip.getEntry('version.json');
      console.log(`[NeoForge][DEBUG] zip.getEntry('version.json') = ${versionEntry ? 'EXISTS' : 'NULL'}`);
      if (versionEntry) {
        const rawText = versionEntry.getData().toString('utf8');
        console.log(`[NeoForge][DEBUG] version.json raw length = ${rawText.length}`);
        versionJsonData = JSON.parse(rawText);
        console.log(`[NeoForge][DEBUG] parsed versionJsonData: mainClass=${versionJsonData.mainClass}, libs=${(versionJsonData.libraries || []).length}, id=${versionJsonData.id}`);
        console.log(`[NeoForge] 从 installer 中读取 version.json, mainClass=${versionJsonData.mainClass}`);
      }
    } catch (e) {
      console.error(`[NeoForge][DEBUG] 读取 version.json 异常: ${e.message}\n${e.stack}`);
    }

    // 如果 version.json 不在根目录，尝试从 installProfile.json 里找
    if (!versionJsonData && installProfile) {
      if (typeof installProfile.json === 'object' && installProfile.json !== null) {
        versionJsonData = installProfile.json;
      } else if (typeof installProfile.json === 'string' && installProfile.json) {
        const jsonFileName = installProfile.json.replace(/^\//, '');
        const jsonEntry = zip.getEntry(jsonFileName);
        if (jsonEntry) {
          try { versionJsonData = JSON.parse(jsonEntry.getData().toString('utf8')); } catch (e) {}
        }
      }
    }

    if (!versionJsonData) {
      throw new Error('NeoForge安装器中未找到 version.json，安装器可能已损坏');
    }

    // 4. 提取 client.lzma 作为 BINPATCH 数据（处理器需要用它来打补丁）
    const isLegacyPkg = neoVersion.startsWith('1.20.1-');
    const pkg = isLegacyPkg ? 'forge' : 'neoforge';
    const binpatchDir = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'neoforged', pkg, neoVersion);
    const binpatchPath = path.join(binpatchDir, `${pkg}-${neoVersion}-clientdata.lzma`);
    let clientLzmaExtracted = false;
    try {
      const clientLzma = zip.getEntry('data/client.lzma');
      if (clientLzma) {
        if (!fs.existsSync(binpatchPath)) {
          fs.mkdirSync(binpatchDir, { recursive: true });
          fs.writeFileSync(binpatchPath, clientLzma.getData());
          console.log(`[NeoForge] 提取 client.lzma → ${binpatchPath}`);
          clientLzmaExtracted = true;
        } else {
          console.log(`[NeoForge] client.lzma 已存在: ${binpatchPath}`);
          clientLzmaExtracted = true;
        }
      } else {
        console.warn(`[NeoForge] 安装器中未找到 data/client.lzma`);
      }
    } catch (e) {
      console.warn(`[NeoForge] 提取 client.lzma 失败（非致命）: ${e.message}`);
    }

    // 5. Save install_profile.json with correct data paths for processors
    if (installProfile) {
      const installerLibDir = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'neoforged', pkg, neoVersion);
      const installerLibPath = path.join(installerLibDir, `${pkg}-${neoVersion}-installer.jar`);
      if (!fs.existsSync(installerLibPath) && fs.existsSync(installerPath)) {
        fs.mkdirSync(installerLibDir, { recursive: true });
        fs.copyFileSync(installerPath, installerLibPath);
        console.log(`[NeoForge] Copied installer -> ${installerLibPath}`);
      }

      if (!installProfile.data) installProfile.data = {};

      // BINPATCH: use actual file path so processors can find client.lzma directly
      const effectiveLzmaPath = clientLzmaExtracted ? binpatchPath
        : (fs.existsSync(binpatchPath) ? binpatchPath : null);
      if (effectiveLzmaPath) {
        installProfile.data.BINPATCH = {
          client: effectiveLzmaPath,
          server: effectiveLzmaPath
        };
        console.log(`[NeoForge] BINPATCH set to: ${effectiveLzmaPath}`);
      } else {
        console.warn(`[NeoForge] WARNING: client.lzma not found at ${binpatchPath}`);
      }

      // INSTALLER: use actual file path
      const effectiveInstallerPath = fs.existsSync(installerLibPath) ? installerLibPath
        : (fs.existsSync(installerPath) ? installerPath : null);
      if (effectiveInstallerPath) {
        installProfile.data.INSTALLER = {
          client: effectiveInstallerPath,
          server: effectiveInstallerPath
        };
      }

      // PATCHED: use actual output path
      const patchedMavenPath = `net/neoforged/minecraft-client-patched/${neoVersion}/minecraft-client-patched-${neoVersion}.jar`;
      const patchedFullPath = path.join(ctx.dirs.LIBRARIES_DIR, patchedMavenPath);
      installProfile.data.PATCHED = {
        client: patchedFullPath,
        server: patchedFullPath
      };

      try {
        fs.writeFileSync(path.join(versionDir, 'install_profile.json'), JSON.stringify(installProfile, null, 2));
        console.log(`[NeoForge] install_profile.json updated with correct paths`);
      } catch (_) {}
    }

    // 6. 预下载 MOJMAPS（Forge/NeoForge 的处理器依赖此文件）
    if (installProfile && installProfile.data && installProfile.data.MOJMAPS) {
      try {
        const mojmapsRaw = installProfile.data.MOJMAPS.client;
        const mojmapsRef = typeof mojmapsRaw === 'string' ? mojmapsRaw
          : (Array.isArray(mojmapsRaw) ? mojmapsRaw[0] : (mojmapsRaw?.value || ''));
        const clean = mojmapsRef.replace(/[\[\]]/g, '');
        const parts = clean.split(':');
        if (parts.length >= 4) {
          const groupId = parts[0];
          const artifactId = parts[1];
          const libVersion = parts[2];
          const ext = parts.length > 4 ? parts[4] : (parts[3].includes('@') ? parts[3].split('@')[1] : 'txt');
          const groupPath = groupId.replace(/\./g, '/');
          const mappingsFileName = `${artifactId}-${libVersion}-mappings.${ext}`;
          const mappingsDir = path.join(ctx.dirs.LIBRARIES_DIR, groupPath, artifactId, libVersion);
          const mappingsPath = path.join(mappingsDir, mappingsFileName);

          if (!fs.existsSync(mappingsPath)) {
            console.log(`[NeoForge] 预下载 MOJMAPS: ${mappingsFileName}`);
            if (onProgress) onProgress(0.15, '正在下载 MOJMAPS 映射文件...');
            const mcVer = installProfile.version || gameVersion;
            const manifest = await http.fetchJSON('https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json');
            const verEntry = manifest.versions.find((v) => v.id === mcVer);
            if (verEntry) {
              const verJsonUrl = verEntry.url.replace('https://piston-meta.mojang.com/', 'https://bmclapi2.bangbang93.com/');
              const mcVerJson = await http.fetchJSON(verJsonUrl);
              const cm = mcVerJson.downloads?.client_mappings;
              if (cm) {
                let cmUrl = cm.url.replace('https://piston-data.mojang.com/', 'https://bmclapi2.bangbang93.com/');
                fs.mkdirSync(mappingsDir, { recursive: true });
                await http.downloadFileWithMirror(cmUrl, mappingsPath);
                console.log(`[NeoForge] MOJMAPS 下载完成: ${mappingsPath}`);
              }
            }
          }
        }
      } catch (e) {
        // 错误信息兼容非 Error 抛出物（e.message 可能是对象导致显示 [object Object]）
        const errMsg = (e instanceof Error) ? e.message : (typeof e === 'string' ? e : (e?.message ? String(e.message) : JSON.stringify(e)));
        console.warn(`[NeoForge] MOJMAPS 预下载失败: ${errMsg}`);
      }
    }

    // 7. 合并版本 JSON：version.json (来自 installer) 已经包含所有 runtime 必需库
    // （earlydisplay, loader, accesstransformers, modlauncher, asm 9.7 等）。
    // 不合并 install_profile.json 的 libraries！
    // install_profile.json 的 libraries 包含 processor 依赖（asm 9.3, guava 20.0,
    // binarypatcher, AutoRenamingTool, installertools, SpecialSource 等），这些只在
    // 安装阶段（运行 processor 时）需要，不应该出现在游戏 runtime classpath 中。
    // 若合并会导致 JPMS 模块冲突：module path 已加载 asm 9.7 (org.objectweb.asm.commons),
    // classpath 又出现 asm 9.3 (同名 automatic module)，BootstrapLauncher 抛出
    // IllegalStateException: Module named org.objectweb.asm.commons was already on the
    // JVMs module path loaded from ...asm-commons-9.7.jar but class-path contains it
    // at location ...asm-commons-9.3.jar
    const versionJsonPath = path.join(versionDir, `${versionId}.json`);

    if (installProfile && installProfile.mainClass && !versionJsonData.mainClass) {
      versionJsonData.mainClass = installProfile.mainClass;
    }

    // 去掉自引用（installer 里的 net.neoforged:neoforge:xxx 是给 installer 自己用的，不需要出现在版本库里）
    const neoForgeMainPattern = new RegExp(`^net\\.neoforged:(neoforge|forge):${neoVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    versionJsonData.libraries = (versionJsonData.libraries || []).filter((lib) => {
      if (!lib.name) return true;
      return !neoForgeMainPattern.test(lib.name);
    });

    // 确保有必要的参数
    if (!versionJsonData.arguments) versionJsonData.arguments = {};
    if (!versionJsonData.arguments.game || versionJsonData.arguments.game.length === 0) {
      versionJsonData.arguments.game = ['--launchTarget', 'neoforgeclient', '--fml.neoForgeVersion', neoVersion, '--fml.mcVersion', gameVersion];
    }

    // [CRITICAL FIX - 2026-06-20] inheritsFrom 必须使用纯MC版本号（如 "1.20.1"），
    // 不能直接用 gameVersion 参数！因为 gameVersion 可能被前端传入 "26.2-forge-65.0.0" 这样的值，
    // 导致 inheritsFrom 指向错误的基础版本，NeoForge 启动时 AccessTransformerEngine 找不到方法。
    // 如果此段代码被修改导致 NeoForge 启动报 NoSuchMethodError，请优先检查 inheritsFrom 的值。
    // [CRITICAL FIX - 2026-07-20] 优先从 gameVersion 提取版本号，而不是 versionId。
    // 原因：performInstallation 调用时传入的 versionId 可能是用户自定义名称（如 "-T5"），
    // 无法从中提取 MC 版本号。原回退逻辑 gameVersion.split('.')[0]+'.'+split[1] 会把
    // "1.20.1" 截断为 "1.20"，导致找不到父版本，natives 加载被跳过，游戏启动崩溃。
    // 现在优先用 gameVersion，并支持 "1.20.1" 和 "26.2-forge-65.0.0" 两种格式。
    const mcVerFromGame = gameVersion.match(/^(\d+\.\d+(?:\.\d+)?)/);
    const mcVerFromId = versionId.match(/^(\d+\.\d+(?:\.\d+)?)/);
    const cleanMcVer = mcVerFromGame ? mcVerFromGame[1] : (mcVerFromId ? mcVerFromId[1] : gameVersion);

    // [CRITICAL FIX - 2026-07-12] 过滤掉与父版本重复的库（group:artifact 相同的库）。
    // 安装器的 version.json 包含全部库（LWJGL、gson、guava 等），这些库已在父版本中存在。
    // 如果子版本 JSON 也包含这些库，mergeVersionJson() 合并时子版本会覆盖父版本的同名库，
    // 导致版本冲突（如子版本的 LWJGL 3.3.3 覆盖父版本的 LWJGL 3.4.1）。
    const _parentJson = versions.resolveVersionJson(cleanMcVer);
    const _parentLibKeys = new Set();
    if (_parentJson && _parentJson.libraries) {
      for (const _lib of _parentJson.libraries) {
        if (_lib.name) {
          const _parts = _lib.name.split(':');
          if (_parts.length >= 2) _parentLibKeys.add(_parts[0] + ':' + _parts[1]);
        }
      }
    }
    const _filteredLibs = (versionJsonData.libraries || []).filter((lib) => {
      if (!lib.name) return true;
      const _parts = lib.name.split(':');
      if (_parts.length >= 2 && _parentLibKeys.has(_parts[0] + ':' + _parts[1])) {
        console.log(`[NeoForge] 跳过与父版本重复的库: ${lib.name}`);
        return false;
      }
      return true;
    });
    if (_parentLibKeys.size > 0) {
      console.log(`[NeoForge] 父版本 ${cleanMcVer} 有 ${_parentLibKeys.size} 个库，过滤后子版本保留 ${_filteredLibs.length}/${versionJsonData.libraries.length} 个库`);
    }

    const versionJson = {
      id: versionId,
      inheritsFrom: cleanMcVer,
      mainClass: versionJsonData.mainClass || 'cpw.mods.bootstraplauncher.BootstrapLauncher',
      type: 'release',
      libraries: _filteredLibs,
      arguments: versionJsonData.arguments
    };
    console.log(`[NeoForge][DEBUG] 构造 versionJson: mainClass=${versionJson.mainClass}, libs=${(versionJson.libraries || []).length}, filteredLibs=${_filteredLibs.length}, versionJsonData.libs=${(versionJsonData.libraries || []).length}`);

    // 8. 下载库文件
    if (onProgress) onProgress(0.3, '正在下载NeoForge库文件...');

    const neoLibsToDownload = [];
    for (const lib of (versionJson.libraries || [])) {
      const parts = lib.name ? lib.name.split(':') : [];
      let libPath = null;
      let expectedSha1 = null;

      if (lib.downloads?.artifact?.path) {
        libPath = path.join(ctx.dirs.LIBRARIES_DIR, lib.downloads.artifact.path);
        expectedSha1 = lib.downloads.artifact.sha1 || null;
      } else if (lib.name && parts.length >= 3) {
        const groupPath = parts[0].replace(/\./g, path.sep);
        const lname = parts[1];
        const lver = parts[2];
        const classifier = parts.length >= 4 ? parts[3] : '';
        const jarName = classifier ? `${lname}-${lver}-${classifier}.jar` : `${lname}-${lver}.jar`;
        libPath = path.join(ctx.dirs.LIBRARIES_DIR, groupPath, lname, lver, jarName);
      }

      if (!libPath || isLibValid(libPath, -1, expectedSha1)) continue;

      if (lib.downloads?.artifact?.url) {
        const mirrorUrl = getNeoLibMirrorUrl(lib.downloads.artifact.url);
        neoLibsToDownload.push({ lib, url: mirrorUrl, fallbackUrl: lib.downloads.artifact.url, libPath, expectedSha1 });
      } else if (parts.length >= 3) {
        const mavenGroup = parts[0].replace(/\./g, '/');
        const lname = parts[1];
        const lver = parts[2];
        const classifier = parts.length >= 4 ? parts[3] : '';
        const jarName = classifier ? `${lname}-${lver}-${classifier}.jar` : `${lname}-${lver}.jar`;
        const isNeoLib = parts[0].includes('neoforged') || parts[0].includes('fancymodloader') || parts[0].includes('mixin');
        const officialUrl = lib.url || (isNeoLib ? 'https://maven.neoforged.net/releases/' : 'https://libraries.minecraft.net/');
        const dlUrl = `${officialUrl}${mavenGroup}/${lname}/${lver}/${jarName}`;
        const mirrorUrl = getNeoLibMirrorUrl(dlUrl);
        neoLibsToDownload.push({ lib, url: mirrorUrl, fallbackUrl: dlUrl, libPath, expectedSha1: null });
      }
    }

    let neoLibFailures = 0;
    if (neoLibsToDownload.length > 0) {
      const NEO_PARALLEL = 8;
      let completed = 0;
      let failed = 0;
      let active = 0;
      let done = null;

      const scheduleNext = () => {
        while (active < NEO_PARALLEL && completed + failed + active < neoLibsToDownload.length) {
          const item = neoLibsToDownload[completed + failed + active];
          active++;
          (async () => {
            let success = false;
            for (let retry = 0; retry < 3; retry++) {
              try {
                if (isLibValid(item.libPath, -1, item.expectedSha1)) { success = true; break; }
                if (fs.existsSync(item.libPath)) fs.unlinkSync(item.libPath);
                const dlUrl = retry === 0 ? item.url : item.fallbackUrl;
                await http.downloadFileWithMirror(dlUrl, item.libPath);
                if (isLibValid(item.libPath, -1, item.expectedSha1)) { success = true; break; }
                if (retry < 2) {
                  try { fs.unlinkSync(item.libPath); } catch (_) {}
                  await new Promise((r) => setTimeout(r, 3000 + retry * 2000));
                }
              } catch (e) {
                if (retry < 2) {
                  await new Promise((r) => setTimeout(r, 3000 + retry * 2000));
                } else {
                  console.log(`[NeoForge] Failed to download ${item.lib.name}: ${e.message}`);
                }
              }
            }
            if (!success) neoLibFailures++;
          })().then(() => { completed++; }).catch(() => { failed++; }).finally(() => {
            active--;
            if (active === 0 && completed + failed >= neoLibsToDownload.length && done) done();
            else if (active < NEO_PARALLEL && completed + failed + active < neoLibsToDownload.length) scheduleNext();
          });
        }
      };
      await new Promise((resolve) => { done = resolve; scheduleNext(); });
    }

    // 9. 写入版本 JSON
    fs.writeFileSync(versionJsonPath, JSON.stringify(versionJson, null, 2));
    versions._invalidateResolvedJsonCache(versionId);
    console.log(`[NeoForge][DEBUG] 写入磁盘 versionJson: path=${versionJsonPath}, mainClass=${versionJson.mainClass}, libs=${(versionJson.libraries || []).length}, dlFailed=${neoLibFailures}`);
    console.log(`[NeoForge][DEBUG] versionJson.libraries 前5个: ${(versionJson.libraries || []).slice(0, 5).map(l => l.name).join(', ')}`);
    console.log(`[NeoForge] 版本JSON已生成: ${versionJsonPath}, libs=${(versionJson.libraries || []).length}, dlFailed=${neoLibFailures}`);

    // 10. 补全库 + 运行处理器（merge 函数还会下载缺失的库和执行二进制补丁）
    if (onProgress) onProgress(0.7, '补全 NeoForge 库和参数...');
    if (!fs.existsSync(binpatchPath)) {
      console.warn(`[NeoForge] clientdata.lzma 缺失 (${binpatchPath}), 尝试重新提取...`);
      let reextracted = false;
      if (fs.existsSync(installerPath)) {
        try {
          const retryZip = new AdmZip(installerPath);
          const retryEntry = retryZip.getEntry('data/client.lzma');
          if (retryEntry) {
            fs.mkdirSync(binpatchDir, { recursive: true });
            fs.writeFileSync(binpatchPath, retryEntry.getData());
            console.log(`[NeoForge] 重新提取成功: ${binpatchPath} (${fs.statSync(binpatchPath).size} bytes)`);
            reextracted = true;
          } else {
            console.warn(`[NeoForge] 安装器中无 data/client.lzma entry`);
          }
        } catch (e) { console.warn(`[NeoForge] 重新提取失败: ${e.message}`); }
      } else {
        console.warn(`[NeoForge] 安装器 JAR 也不存在: ${installerPath}`);
      }
      if (!reextracted) {
        const errMsg = `NeoForge 安装失败: clientdata.lzma 提取失败，请检查网络后重试安装`;
        if (onProgress) onProgress(1, errMsg);
        return { success: false, error: errMsg };
      }
    }
    const installerLibPath2 = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'neoforged', pkg, neoVersion, `${pkg}-${neoVersion}-installer.jar`);
    if (!fs.existsSync(installerLibPath2) && fs.existsSync(installerPath)) {
      try {
        // [CRITICAL] ENOTDIR 修复 — 同 ensureDir，清理路径中的文件冲突。
        {
          const _d = path.dirname(installerLibPath2);
          for (const _p of _d.split(path.sep).map((_, _i, _a) => _a.slice(0, _i + 1).join(path.sep))) {
            if (_p) { try { const _s = fs.statSync(_p); if (!_s.isDirectory()) fs.unlinkSync(_p); } catch (_) {} }
          }
        }
        fs.mkdirSync(path.dirname(installerLibPath2), { recursive: true });
        fs.copyFileSync(installerPath, installerLibPath2);
        console.log(`[NeoForge] 复制 installer → ${installerLibPath2}`);
      } catch (_) {}
    }
    try {
      await mergeNeoForgeLoaderToVersion(versionId, gameVersion, neoVersion, onProgress);
    } catch (mergeErr) {
      // patch 处理器失败属于致命错误，不能吞掉后还报 success=true
      console.error(`[NeoForge] merge 失败: ${mergeErr.message}`);
      throw mergeErr;
    }

    const neoCoreJarRel = `net/neoforged/neoforge/${neoVersion}/neoforge-${neoVersion}-universal.jar`;
    const neoCoreJarPath = path.join(ctx.dirs.LIBRARIES_DIR, neoCoreJarRel);
    if (!fs.existsSync(neoCoreJarPath) || (await fs.promises.stat(neoCoreJarPath).catch(() => ({ size: 0 })).then((s) => s.size)) < 1024) {
      console.warn(`[NeoForge] 核心jar缺失或无效，尝试补下载: ${neoCoreJarPath}`);
      if (onProgress) onProgress(0.85, '补下载NeoForge核心文件...');
      const neoCoreUrls = [
        `https://maven.neoforged.net/releases/${neoCoreJarRel}`,
        `https://bmclapi2.bangbang93.com/maven/${neoCoreJarRel}`
      ];
      let coreOk = false;
      for (const url of neoCoreUrls) {
        try {
          fs.mkdirSync(path.dirname(neoCoreJarPath), { recursive: true });
          await http.downloadFile(url, neoCoreJarPath);
          if (fs.existsSync(neoCoreJarPath) && utils.isJarIntact(neoCoreJarPath)) {
            console.log(`[NeoForge] 核心jar补下载成功: ${url}`);
            coreOk = true;
            break;
          }
          console.warn(`[NeoForge] 下载后JAR无效: ${url}`);
          try { fs.unlinkSync(neoCoreJarPath); } catch (_) {}
        } catch (e) {
          console.warn(`[NeoForge] 核心jar下载失败: ${url} - ${e.message}`);
        }
      }
      if (!coreOk) {
        console.warn(`[NeoForge] 核心jar补下载全部失败`);
      } else {
        neoLibFailures = Math.max(0, neoLibFailures - 1);
      }
    }

    const patchedJarRel = `net/neoforged/minecraft-client-patched/${neoVersion}/minecraft-client-patched-${neoVersion}.jar`;
    const patchedJarLibPath = path.join(ctx.dirs.LIBRARIES_DIR, patchedJarRel);
    const patchedJarVerPath = path.join(versionDir, `${versionId}.jar`);
    if (!fs.existsSync(patchedJarLibPath) || (await fs.promises.stat(patchedJarLibPath).catch(() => ({ size: 0 })).then((s) => s.size)) < 1024) {
      if (fs.existsSync(patchedJarVerPath)) {
        try {
          // [CRITICAL] ENOTDIR 修复 — 同 ensureDir，清理路径中的文件冲突。
          {
            const _d = path.dirname(patchedJarLibPath);
            for (const _p of _d.split(path.sep).map((_, _i, _a) => _a.slice(0, _i + 1).join(path.sep))) {
              if (_p) { try { const _s = fs.statSync(_p); if (!_s.isDirectory()) fs.unlinkSync(_p); } catch (_) {} }
            }
          }
          fs.mkdirSync(path.dirname(patchedJarLibPath), { recursive: true });
          fs.copyFileSync(patchedJarVerPath, patchedJarLibPath);
          console.log(`[NeoForge] Patched JAR已复制到libraries: ${path.basename(patchedJarLibPath)}`);
        } catch (e) {
          console.warn(`[NeoForge] 复制patched JAR失败: ${e.message}`);
        }
      } else {
        console.warn(`[NeoForge] Patched JAR缺失: ${patchedJarLibPath} 且版本目录也无`);
      }
    }

    try { fs.unlinkSync(installerPath); } catch (_) {}

    // [CRITICAL FIX - 2026-06-20] 必须从文件重新读取最终版本 JSON，不能用上面的 versionJson 对象直接写入！
    // 因为 mergeNeoForgeLoaderToVersion 等后续函数可能已经修改了文件中的 JSON，
    // 但这里的 versionJson 变量还是旧的引用，直接写入会覆盖掉那些修改。
    try {
      const finalJson = JSON.parse(fs.readFileSync(path.join(versionDir, `${versionId}.json`), 'utf-8'));
      fs.writeFileSync(path.join(versionDir, `${versionId}.json`), JSON.stringify(finalJson, null, 2));
      console.log(`[NeoForge] Final version JSON written, libs=${(finalJson.libraries || []).length}`);
    } catch (_) {}

    if (onProgress) onProgress(1, 'NeoForge 安装完成');
    return { success: true, versionId: versionId, libsMissing: neoLibFailures };
  } catch (e) {
    console.error(`[NeoForge] Installation failed: ${e.message}`);
    try {
      const vDir = path.join(ctx.dirs.VERSIONS_DIR, versionId);
      if (fs.existsSync(vDir)) {
        fs.rmSync(vDir, { recursive: true, force: true });
        console.log(`[NeoForge] Cleaned up failed version directory: ${vDir}`);
      }
    } catch (cleanupErr) {
      console.error(`[NeoForge] Failed to cleanup version directory:`, cleanupErr.message);
    }
    return { success: false, error: e.message };
  }
}

/* 模组加载器版本合并 - 将加载器特有的配置合并到版本 JSON 中 */

/**
 * 将 NeoForge 加载器配置合并到版本 JSON（提取 install_profile、合并库、下载缺失库、运行处理器打补丁）。
 * @param {string} versionId - 版本目录名，如 "1.20.1-NeoForge-47.1.0"
 * @param {string} gameVersion - Minecraft 版本号
 * @param {string} neoVersion - NeoForge 版本号
 * @param {(percent: number, message: string) => void} [onProgress] - 进度回调
 * @returns {Promise<void>}
 * @throws {Error} 当 clientdata.lzma 缺失时抛出
 */
async function mergeNeoForgeLoaderToVersion(versionId, gameVersion, neoVersion, onProgress = null) {
  const versionDir = path.join(ctx.dirs.VERSIONS_DIR, versionId);
  const jsonPath = path.join(versionDir, `${versionId}.json`);
  const versionJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  console.log(`[NeoForge][DEBUG][merge] 读取磁盘 version.json: path=${jsonPath}, mainClass=${versionJson.mainClass}, libs=${(versionJson.libraries || []).length}, id=${versionJson.id}, inheritsFrom=${versionJson.inheritsFrom}`);
  console.log(`[NeoForge][DEBUG][merge] versionJson.libraries 前5个: ${(versionJson.libraries || []).slice(0, 5).map(l => l.name).join(', ')}`);

  // [CRITICAL FIX - 2026-06-20] 同样从 versionId 提取纯净的 MC 版本号。
  // 这个函数在 installNeoForge 之后被调用，负责合并 install_profile.json 中的运行时库。
  // 如果 inheritsFrom 写错（如 "26.2-forge-65.0.0"），launcher 会继承错误的基础版本，
  // 导致 NeoForge 的 access-transformers、earlydisplay 等关键库缺失，启动直接崩溃。
  // [CRITICAL FIX - 2026-07-20] 优先使用传入的 gameVersion 参数，而不是从 versionId 提取。
  // 原因：performInstallation 调用本函数时传入的 versionId 可能是用户自定义名称（如 "-T5"），
  // 无法从中提取 MC 版本号。回退到 versionJson.inheritsFrom 时只匹配前两段数字（如 "1.20"），
  // 导致 1.20.1 被错误地截断为 1.20，找不到父版本，natives 加载被跳过，游戏启动崩溃。
  // 现在直接用调用方传入的 gameVersion（应为完整版本号如 "1.20.1"），更可靠。
  const mcVer = gameVersion || versionJson.inheritsFrom || versionId;
  versionJson.inheritsFrom = mcVer;
  console.log(`[NeoForge] inheritsFrom set to: ${mcVer} (gameVersion was: ${gameVersion})`);

  let profileLibs = [];
  let runtimeLibs = [];
  let profileData = null;
  let profileProcessors = [];
  let installerMainClass = null;
  let installerArgs = null;

  if (onProgress) onProgress(0.1, '提取 NeoForge 安装器数据...');

  const ipPath = path.join(versionDir, 'install_profile.json');
  if (fs.existsSync(ipPath)) {
    try {
      const ipData = JSON.parse(fs.readFileSync(ipPath, 'utf-8'));
      profileLibs = ipData.libraries || [];
      profileData = ipData.data || null;
      profileProcessors = ipData.processors || [];
      console.log(`[NeoForge] read install_profile.json: libs=${profileLibs.length}, processors=${profileProcessors.length}, dataKeys=${profileData ? Object.keys(profileData).join(',') : 'none'}`);
    } catch (_) {}
  }

  if (profileLibs.length === 0) {
    const isLegacy = neoVersion.startsWith('1.20.1-');
    const pkg = isLegacy ? 'forge' : 'neoforge';
    const installerUrls = [
      `https://bmclapi2.bangbang93.com/maven/net/neoforged/${pkg}/${neoVersion}/${pkg}-${neoVersion}-installer.jar`,
      `https://maven.neoforged.net/releases/net/neoforged/${pkg}/${neoVersion}/${pkg}-${neoVersion}-installer.jar`
    ];
    const installerPath = path.join(ctx.dirs.DATA_DIR, 'temp', `neoforge-merge-${neoVersion}.jar`);
    fs.mkdirSync(path.dirname(installerPath), { recursive: true });

    let downloaded = false;
    for (const url of installerUrls) {
      try {
        if (onProgress) onProgress(0.15, `下载 NeoForge 安装器...`);
        await http.downloadFileWithMirror(url, installerPath, (p) => {
          if (onProgress && p) onProgress(0.15 + (p.progress || 0) * 0.1, `下载 NeoForge 安装器: ${p.progress || 0}%`);
        }, 3, null, 60000);
        downloaded = true;
        break;
      } catch (_) {}
    }

    if (downloaded) {
      try {
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(installerPath);
        const profileEntry = zip.getEntry('install_profile.json');
        if (profileEntry) {
          const ipData = JSON.parse(profileEntry.getData().toString('utf8'));
          profileLibs = ipData.libraries || [];
          profileData = ipData.data || null;
          profileProcessors = ipData.processors || profileProcessors;
          try { fs.writeFileSync(ipPath, JSON.stringify(ipData, null, 2)); } catch (_) {}
        }
        const versionEntry = zip.getEntry('version.json');
        if (versionEntry) {
          const vData = JSON.parse(versionEntry.getData().toString('utf8'));
          installerMainClass = vData.mainClass || null;
          installerArgs = vData.arguments || null;
          runtimeLibs = vData.libraries || [];
          console.log(`[NeoForge] 从 installer version.json 提取运行时库: ${runtimeLibs.length} 个`);
        }
        const clientLzmaEntry = zip.getEntry('data/client.lzma');
        if (clientLzmaEntry) {
          const isLegacy = neoVersion.startsWith('1.20.1-');
          const pkg = isLegacy ? 'forge' : 'neoforge';
          const clDir = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'neoforged', pkg, neoVersion);
          const clPath = path.join(clDir, `${pkg}-${neoVersion}-clientdata.lzma`);
          if (!fs.existsSync(clPath)) {
            fs.mkdirSync(clDir, { recursive: true });
            fs.writeFileSync(clPath, clientLzmaEntry.getData());
            console.log(`[NeoForge] 提取 clientdata.lzma → ${clPath} (${fs.statSync(clPath).size} bytes)`);
          }
        } else {
          console.warn(`[NeoForge] 安装器中无 data/client.lzma`);
        }
      } catch (zipErr) {
        console.warn(`[NeoForge] 解压安装器失败: ${zipErr.message}`);
      }
      try {
        const _installerLibDir = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'neoforged', pkg, neoVersion);
        const _installerLibPath = path.join(_installerLibDir, `${pkg}-${neoVersion}-installer.jar`);
        if (!fs.existsSync(_installerLibPath) && fs.existsSync(installerPath)) {
          fs.mkdirSync(_installerLibDir, { recursive: true });
          fs.copyFileSync(installerPath, _installerLibPath);
          console.log(`[NeoForge] Copied installer -> ${_installerLibPath}`);
        }
      } catch (copyErr) {
        console.warn(`[NeoForge] 复制 installer.jar 到库目录失败: ${copyErr.message}`);
      }
      try { fs.unlinkSync(installerPath); } catch (_) {}
    }
  }

  if (profileLibs.length === 0) {
    try {
      const neoUrl = `${ctx.urls.NEOFORGE_API_URL}/versions/${encodeURIComponent(`net.neoforged:neoforge:${neoVersion}`)}?type=json`;
      let neoData;
      try {
        neoData = await http.fetchJSON(neoUrl, 3, 10000);
      } catch (e) {
        const mirrorNeoUrl = `https://bmclapi2.bangbang93.com/maven/api/maven/versions/${encodeURIComponent(`net.neoforged:neoforge:${neoVersion}`)}?type=json`;
        neoData = await http.fetchJSON(mirrorNeoUrl, 3, 10000);
      }
      installerMainClass = neoData.mainClass || installerMainClass;
      installerArgs = neoData.arguments || installerArgs;
      profileLibs = neoData.libraries || profileLibs;
      if (runtimeLibs.length === 0 && neoData.libraries) {
        runtimeLibs = neoData.libraries;
        console.log(`[NeoForge] 从 API 获取运行时库: ${runtimeLibs.length} 个`);
      }
    } catch (e) {
      console.warn(`[NeoForge] API也失败: ${e.message}`);
    }
  }

  versionJson.mainClass = installerMainClass || versionJson.mainClass || 'cpw.mods.bootstraplauncher.BootstrapLauncher';

  // XMCL: do NOT add data to version JSON
  // Keep data in install_profile.json only (used by processors, not needed at runtime)

  versionJson.arguments = versionJson.arguments || {};
  versionJson.arguments.game = versionJson.arguments.game || [];
  const hasFmlArgs = versionJson.arguments.game.some((a) => a === '--fml.neoForgeVersion');
  if (!hasFmlArgs) {
    if (installerArgs?.game) {
      versionJson.arguments.game.push(...installerArgs.game);
    } else {
      versionJson.arguments.game.push('--launchTarget', 'neoforgeclient', '--fml.neoForgeVersion', neoVersion, '--fml.mcVersion', gameVersion);
    }
  }
  if (installerArgs?.jvm) {
    const existingJvm = new Set(versionJson.arguments.jvm || []);
    for (const jvmArg of installerArgs.jvm) {
      if (!existingJvm.has(jvmArg)) {
        versionJson.arguments.jvm = versionJson.arguments.jvm || [];
        versionJson.arguments.jvm.push(jvmArg);
        existingJvm.add(jvmArg);
      }
    }
  }

  // 合并 installer version.json 中的运行时库（FancyModLoader、ASM、Mixin、JarJar 等）。
  // 注意区分：
  //   - install_profile.json 的 libraries → 仅安装阶段使用（processor 依赖），不合并
  //   - installer version.json 的 libraries → 运行时必需，必须合并到版本 JSON
  // 之前只提取了 mainClass/arguments 漏掉了 libraries，导致 fmlloader/modlauncher/
  // securejarhandler 等核心库缺失，游戏启动立即崩溃。
  // [CRITICAL FIX - 2026-07-12] 同时检查父版本库，跳过与父版本重复的库（group:artifact 相同），
  // 避免子版本覆盖父版本的库导致版本冲突（如 LWJGL 3.3.3 覆盖 3.4.1）。
  if (runtimeLibs.length > 0) {
    const existingLibKeys = new Set((versionJson.libraries || []).map((l) => {
      const parts = (l.name || '').split(':');
      return parts.length >= 2 ? parts[0] + ':' + parts[1] : l.name;
    }));
    // 加载父版本库 keys，避免重复添加父版本已有的库
    const _parentJson2 = versions.resolveVersionJson(mcVer);
    if (_parentJson2 && _parentJson2.libraries) {
      for (const _plib of _parentJson2.libraries) {
        if (_plib.name) {
          const _pparts = _plib.name.split(':');
          if (_pparts.length >= 2) existingLibKeys.add(_pparts[0] + ':' + _pparts[1]);
        }
      }
    }
    let added = 0;
    let skipped = 0;
    for (const rtLib of runtimeLibs) {
      const parts = (rtLib.name || '').split(':');
      const key = parts.length >= 2 ? parts[0] + ':' + parts[1] : rtLib.name;
      if (!existingLibKeys.has(key)) {
        versionJson.libraries = versionJson.libraries || [];
        versionJson.libraries.push(rtLib);
        existingLibKeys.add(key);
        added++;
      } else {
        skipped++;
      }
    }
    console.log(`[NeoForge] 合并运行时库: 新增 ${added} 个，跳过 ${skipped} 个（已存在/父版本已有），总计 ${versionJson.libraries.length} 个库`);
  }

  // NeoForge 20.6+ 使用 --no-mod-manifest 构建 patched jar，patched jar 不含 NeoForge mod 类。
  // universal jar 不能作为库条目添加到 classpath，否则 FML 的 PathBasedLocator 会跳过它
  // ("already located earlier")，导致 NeoForge mod 不被加载，游戏启动即崩溃。
  // 正确做法：不添加 universal jar 库条目，让 PathBasedLocator 通过 --fml.neoForgeVersion
  // 参数自动发现并加载 universal jar 作为 mod。

  if (onProgress) onProgress(0.5, '下载 NeoForge 库文件...');

  const libsToDownload = (versionJson.libraries || []).filter((lib) => {
    if (lib.downloads?.artifact?.url) {
      const libPath = path.join(ctx.dirs.LIBRARIES_DIR, lib.downloads.artifact.path);
      if (!fs.existsSync(libPath)) return true;
      const expectedSha1 = lib.downloads.artifact.sha1;
      const expectedSize = lib.downloads.artifact.size;
      if (expectedSize && fs.existsSync(libPath)) {
        try { if (fs.statSync(libPath).size === expectedSize) return false; } catch (_) {}
      }
      if (!expectedSha1) return false;
      return true;
    }
    if (lib.name) {
      const parts = lib.name.split(':');
      if (parts.length >= 3) {
        const gPath = parts[0].replace(/\./g, '/');
        const atIdx = parts[2].indexOf('@');
        const ext = atIdx >= 0 ? parts[2].substring(atIdx + 1) : 'jar';
        const ver = atIdx >= 0 ? parts[2].substring(0, atIdx) : parts[2];
        let classifier = '';
        if (parts[3]) {
          const atIdx3 = parts[3].indexOf('@');
          classifier = atIdx3 >= 0 ? parts[3].substring(0, atIdx3) : parts[3];
        }
        const fName = classifier ? `${parts[1]}-${ver}-${classifier}.${ext}` : `${parts[1]}-${ver}.${ext}`;
        const rPath = `${gPath}/${parts[1]}/${ver}/${fName}`;
        const lp = path.join(ctx.dirs.LIBRARIES_DIR, rPath);
        if (!fs.existsSync(lp)) {
          lib._mavenPath = rPath;
          lib._url = lib.url || null;
          return true;
        }
      }
    }
    return false;
  });

  if (libsToDownload.length > 0) {
    const settings = versions.loadSettingsCached();
    const NEO_PARALLEL = Math.min(parseInt(settings.maxThreads, 10) || 64, libsToDownload.length);
    let completed = 0;
    let failed = 0;
    let active = 0;
    let done = null;

    const scheduleNext = () => {
      while (active < NEO_PARALLEL && completed + failed + active < libsToDownload.length) {
        const lib = libsToDownload[completed + failed + active];
        active++;
        (async () => {
          let libPath, libUrls;
          if (lib._mavenPath) {
            libPath = path.join(ctx.dirs.LIBRARIES_DIR, lib._mavenPath);
            libUrls = [];
            if (lib._url) libUrls.push(lib._url.replace(/\/$/, '') + '/' + lib._mavenPath.split('/').pop());
            libUrls.push(
              `https://maven.neoforged.net/releases/${lib._mavenPath}`,
              `https://maven.minecraftforge.net/${lib._mavenPath}`,
              `https://libraries.minecraft.net/${lib._mavenPath}`,
              `https://bmclapi2.bangbang93.com/maven/${lib._mavenPath}`
            );
          } else {
            libPath = path.join(ctx.dirs.LIBRARIES_DIR, lib.downloads.artifact.path);
            libUrls = [lib.downloads.artifact.url];
          }
          const dir = path.dirname(libPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          let ok = false;
          for (const u of libUrls) {
            try { await http.downloadFileWithMirror(u, libPath, null, 2, null, 60000); ok = true; break; } catch (_) {}
          }
          if (!ok) throw new Error(`所有镜像源均失败: ${lib._mavenPath || lib.downloads?.artifact?.path}`);
          if (libPath.endsWith('.jar') && !utils.isJarIntact(libPath)) {
            throw new Error(`下载后JAR损坏: ${path.basename(libPath)}`);
          }
        })().then(() => {
          completed++;
        }).catch((e) => {
          const libId = lib._mavenPath || lib.downloads?.artifact?.path || lib.name;
          console.error(`[NeoForge] 库下载失败: ${libId} - ${e.message}`);
          try { if (lib._mavenPath) fs.unlinkSync(path.join(ctx.dirs.LIBRARIES_DIR, lib._mavenPath)); else fs.unlinkSync(path.join(ctx.dirs.LIBRARIES_DIR, lib.downloads.artifact.path)); } catch (_) {}
          failed++;
        }).finally(() => {
          active--;
          if (onProgress) {
            onProgress(0.5 + 0.5 * (completed + failed) / libsToDownload.length, `下载NeoForge库 (${completed + failed}/${libsToDownload.length})...`);
          }
          if (active === 0 && completed + failed >= libsToDownload.length && done) done();
          else if (active < NEO_PARALLEL && completed + failed + active < libsToDownload.length) scheduleNext();
        });
      }
    };

    await new Promise((resolve) => { done = resolve; scheduleNext(); });
  }

  if (onProgress) onProgress(0.88, '预下载安装器依赖库...');

  // 预下载 install_profile.json 中的 processor 依赖库
  // 这些库是 Java 安装器运行时需要的（binarypatcher, installertools, asm 9.3 等）
  // 如果不预下载，安装器会直连 maven.neoforged.net，国内网络容易 Connection reset
  // 安装器发现文件已存在且校验通过时会跳过下载
  if (profileLibs && profileLibs.length > 0) {
    const _libsToPreDownload = [];
    for (const lib of profileLibs) {
      if (!lib.name) continue;
      const parts = lib.name.split(':');
      if (parts.length < 3) continue;
      const gPath = parts[0].replace(/\./g, '/');
      const atIdx = parts[2].indexOf('@');
      const ext = atIdx >= 0 ? parts[2].substring(atIdx + 1) : 'jar';
      const ver = atIdx >= 0 ? parts[2].substring(0, atIdx) : parts[2];
      let classifier = '';
      if (parts[3]) {
        const atIdx3 = parts[3].indexOf('@');
        classifier = atIdx3 >= 0 ? parts[3].substring(0, atIdx3) : parts[3];
      }
      const fName = classifier ? `${parts[1]}-${ver}-${classifier}.${ext}` : `${parts[1]}-${ver}.${ext}`;
      const rPath = `${gPath}/${parts[1]}/${ver}/${fName}`;
      const lp = path.join(ctx.dirs.LIBRARIES_DIR, rPath);
      if (!fs.existsSync(lp)) {
        _libsToPreDownload.push({ rPath, lp, lib });
      }
    }
    if (_libsToPreDownload.length > 0) {
      console.log(`[NeoForge] 预下载 ${_libsToPreDownload.length} 个安装器依赖库`);
      let _preCompleted = 0;
      let _preFailed = 0;
      let _preActive = 0;
      let _preDone = null;
      const _PRE_PARALLEL = Math.min(8, _libsToPreDownload.length);
      const _schedulePreNext = () => {
        while (_preActive < _PRE_PARALLEL && _preCompleted + _preFailed + _preActive < _libsToPreDownload.length) {
          const item = _libsToPreDownload[_preCompleted + _preFailed + _preActive];
          _preActive++;
          (async () => {
            const libUrls = [
              `https://bmclapi2.bangbang93.com/maven/${item.rPath}`,
              `https://maven.neoforged.net/releases/${item.rPath}`,
              ...(item.lib.downloads?.artifact?.url ? [item.lib.downloads.artifact.url] : [])
            ];
            for (const u of libUrls) {
              try {
                fs.mkdirSync(path.dirname(item.lp), { recursive: true });
                await http.downloadFileWithMirror(u, item.lp, null, 2, null, 60000);
                return;
              } catch (_) {}
            }
            throw new Error('所有镜像源均失败');
          })().then(() => {
            _preCompleted++;
          }).catch((e) => {
            console.warn(`[NeoForge] 预下载失败: ${item.rPath} - ${e.message}`);
            _preFailed++;
          }).finally(() => {
            _preActive--;
            if (onProgress) {
              onProgress(0.88 + 0.02 * (_preCompleted + _preFailed) / _libsToPreDownload.length, `预下载安装器依赖 (${_preCompleted + _preFailed}/${_libsToPreDownload.length})...`);
            }
            if (_preActive === 0 && _preCompleted + _preFailed >= _libsToPreDownload.length && _preDone) _preDone();
            else if (_preActive < _PRE_PARALLEL && _preCompleted + _preFailed + _preActive < _libsToPreDownload.length) _schedulePreNext();
          });
        }
      };
      await new Promise((resolve) => { _preDone = resolve; _schedulePreNext(); });
      console.log(`[NeoForge] 预下载完成: ${_preCompleted} 成功, ${_preFailed} 失败`);
    }
  }

  if (onProgress) onProgress(0.9, '执行 NeoForge 处理器...');

  const _isLegacy = neoVersion.startsWith('1.20.1-');
  const _pkg = _isLegacy ? 'forge' : 'neoforge';
  const _clientdataPath = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'neoforged', _pkg, neoVersion, `${_pkg}-${neoVersion}-clientdata.lzma`);
  if (!fs.existsSync(_clientdataPath)) {
    const _errMsg = `NeoForge 安装失败: clientdata.lzma 缺失 (${_clientdataPath})，请检查网络后重试`;
    console.error(`[NeoForge] ${_errMsg}`);
    if (onProgress) onProgress(1, _errMsg);
    throw new Error(_errMsg);
  }

  if (onProgress) onProgress(0.92, '打补丁中...');

  const _patchedJar = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'neoforged', 'minecraft-client-patched', neoVersion, `minecraft-client-patched-${neoVersion}.jar`);
  const _mcJarPath = path.join(ctx.dirs.VERSIONS_DIR, mcVer, `${mcVer}.jar`);

  // 直接调用 Java installertools 执行 PROCESS_MINECRAFT_JAR
  // 失败时抛出错误，让外层 try/catch 捕获并返回 success=false（避免错误地报告安装成功）
  // 注意：installertools jar 不是 fatjar，需要把 install_profile.json 中 processors[].classpath
  // 的所有 jar 都加入 classpath，否则会抛 NoClassDefFoundError: com/google/gson/GsonBuilder
  // [CRITICAL] 按游戏版本选择匹配的 Java 运行安装器（NeoForge 26.x 需 Java 25，1.21.x 需 Java 21+）。
  // 若用低版本 Java（17/21）跑高版本 NeoForge 安装器会直接崩溃退出码 1。选不到时传 null，
  // 由 runPatchProcessor 回退取候选中最高的 Java。
  let _patchJava = null;
  try {
    _patchJava = java.selectJavaForVersion(mcVer || gameVersion, {}, versionJson);
  } catch (_) {}
  await runPatchProcessor({
    mcJarPath: _mcJarPath,
    clientLzmaPath: _clientdataPath,
    patchedJarPath: _patchedJar,
    profileLibs,
    processors: profileProcessors,
    onProgress,
    logPrefix: '[NeoForge]',
    javaPath: _patchJava
  });

  // patched JAR 已生成，复制到版本目录并注册到 libraries
  const _verJar = path.join(versionDir, `${versionId}.jar`);
  try { fs.copyFileSync(_patchedJar, _verJar); console.log(`[NeoForge] Copied patched JAR`); } catch (e) {
    console.warn(`[NeoForge] 复制 patched JAR 到版本目录失败（非致命）: ${e.message}`);
  }

  // 把 patched JAR 复制到版本 JSON 期望的库路径（neoforge-<版本>-client.jar）
  // 版本 JSON 中 net.neoforged:neoforge:<版本>:client 的 path 指向此文件
  // 缺失会导致 depCheck 报 "NeoForge核心" 缺失，进而触发错误的自动修复流程
  const _neoClientLibPath = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'neoforged', 'neoforge', neoVersion, `neoforge-${neoVersion}-client.jar`);
  if (!fs.existsSync(_neoClientLibPath) && fs.existsSync(_patchedJar)) {
    try {
      fs.mkdirSync(path.dirname(_neoClientLibPath), { recursive: true });
      fs.copyFileSync(_patchedJar, _neoClientLibPath);
      console.log(`[NeoForge] Copied patched JAR to library path: ${_neoClientLibPath}`);
    } catch (e) {
      console.warn(`[NeoForge] 复制 patched JAR 到库路径失败: ${e.message}`);
    }
  }

  // 不注册 minecraft-client-patched 库条目。
  // patched jar 的 canonical 坐标是 net.neoforged:neoforge:<version>:client（由 binarypatcher 直接输出，
  // 路径 libraries/net/neoforged/neoforge/<version>/neoforge-<version>-client.jar）。
  // 同时注册 minecraft-client-patched（只是同一 patched jar 的副本，由 shared.js 复制产生）
  // 会导致 classpath 中出现两份相同的 patched 类，JPMS 将它们加载为 minecraft.client.patched 与
  // minecraft 两个模块，触发 split package 冲突 (ResolutionException)。
  // ModLauncher 的 "production client provider" locator 只通过 :client 条目查找 SRG client jar，
  // 因此 :client 是必需的，minecraft-client-patched 是冗余的。

  // NeoForge install_profile.json 的 PATCHED 数据变量指向 [net.neoforged:neoforge:<version>:client]
  // （由 SimpleInstaller/binarypatcher 生成到 libraries/net/neoforged/neoforge/<version>/neoforge-<version>-client.jar）。
  // ModLauncher 的 "production client provider" locator 通过此 library 条目查找 neoforge mod 元数据。
  // 缺失会导致 fancymenu/pixelmon 等报 "Mod ID: 'neoforge' ... Actual version: '[MISSING]'" 并静默退出。
  const _existingNeoClient = (versionJson.libraries || []).some((l) => l.name === `net.neoforged:neoforge:${neoVersion}:client`);
  if (!_existingNeoClient) {
    const _neoClientJarPath = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'neoforged', 'neoforge', neoVersion, `neoforge-${neoVersion}-client.jar`);
    let _neoClientSha1 = '';
    let _neoClientSize = 0;
    try {
      if (fs.existsSync(_neoClientJarPath)) {
        const _stat = fs.statSync(_neoClientJarPath);
        _neoClientSize = _stat.size;
        const _crypto = require('crypto');
        _neoClientSha1 = _crypto.createHash('sha1').update(fs.readFileSync(_neoClientJarPath)).digest('hex');
      } else {
        console.warn(`[NeoForge] neoforge:${neoVersion}:client jar 未找到: ${_neoClientJarPath}`);
      }
    } catch (e) {
      console.warn(`[NeoForge] 计算 neoforge:client SHA1 失败: ${e.message}`);
    }
    versionJson.libraries = versionJson.libraries || [];
    versionJson.libraries.push({
      name: `net.neoforged:neoforge:${neoVersion}:client`,
      downloads: { artifact: { path: `net/neoforged/neoforge/${neoVersion}/neoforge-${neoVersion}-client.jar`, size: _neoClientSize, sha1: _neoClientSha1, url: `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoVersion}/neoforge-${neoVersion}-client.jar` } }
    });
    console.log(`[NeoForge] 已添加 neoforge:${neoVersion}:client 库条目 (size=${_neoClientSize}, sha1=${_neoClientSha1 || 'N/A'})`);
  }

  fs.writeFileSync(jsonPath, JSON.stringify(versionJson, null, 2));
  versions._invalidateResolvedJsonCache(versionId);
  console.log(`[NeoForge][DEBUG][merge] 写入磁盘 version.json: path=${jsonPath}, mainClass=${versionJson.mainClass}, libs=${(versionJson.libraries || []).length}`);
  console.log(`[NeoForge][DEBUG][merge] versionJson.libraries 前5个: ${(versionJson.libraries || []).slice(0, 5).map(l => l.name).join(', ')}`);
  console.log(`[NeoForge] Loader merged: ${versionId}, libs=${(versionJson.libraries || []).length}, mainClass=${versionJson.mainClass}`);
}

/**
 * 获取指定 Minecraft 版本可用的 NeoForge/Forge 版本列表（优先 BMCLAPI，失败回退官方 Maven）。
 * @param {string} gameVersion - Minecraft 版本号，如 "1.20.1"
 * @returns {Promise<Array<{version: string, gameVersion: string, type: string}>>} 版本列表，首项为推荐版本
 */
async function getNeoForgeVersionsForGame(gameVersion) {
  const p = gameVersion.split('.');
  const mcMajor = parseInt(p[0], 10) || 0;
  const mcMinor = parseInt(p[1], 10) || 0;
  const mcPatch = parseInt(p[2], 10) || 0;
  // NeoForge 版本号规则：
  //   MC 1.20.1 及以前: 使用旧版 Forge，版本号 47.x / 1.20.1-47.x
  //   MC 1.20.5+ (NeoForge): 版本号格式为 <MC次版本>.<MC patch版本>.<NeoForge补丁>
  //     例如 MC 1.21.1 对应 NeoForge 21.1.xxx，MC 1.20.5 对应 20.5.xxx
  const isNewNeoScheme = (mcMajor === 1 && mcMinor === 20 && mcPatch >= 5) ||
                         (mcMajor === 1 && mcMinor >= 21);
  const neoPrefix = isNewNeoScheme ? `${mcMinor}.${mcPatch}` : `${mcMajor}.${mcMinor}`;

  let allNeoForgeVersions = [];
  let allForgeVersions = [];
  let lastError = null;

  const fetchXmlVersions = async (url) => {
    const xml = await http.fetchText(url, 15000);
    const matches = xml.match(/<version>([^<]+)<\/version>/g) || [];
    return matches.map((v) => v.replace(/<\/?version>/g, ''));
  };

  try {
    const [neoVersions, forgeVersions] = await Promise.allSettled([
      fetchXmlVersions('https://bmclapi2.bangbang93.com/maven/net/neoforged/neoforge/maven-metadata.xml'),
      fetchXmlVersions('https://bmclapi2.bangbang93.com/maven/net/neoforged/forge/maven-metadata.xml')
    ]);
    if (neoVersions.status === 'fulfilled') allNeoForgeVersions = neoVersions.value;
    if (forgeVersions.status === 'fulfilled') allForgeVersions = forgeVersions.value;
  } catch (e) {
    lastError = e.message;
  }

  if (allNeoForgeVersions.length === 0 && allForgeVersions.length === 0) {
    try {
      const data = await http.fetchJSON('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge', 15000);
      allNeoForgeVersions = data.versions || [];
    } catch (e) {
      lastError = e.message;
      console.warn(`[NeoForge] primary API failed: ${e.message}`);
    }
  }

  if (allNeoForgeVersions.length === 0 && allForgeVersions.length === 0) {
    console.error(`[NeoForge] 所有源均不可达，最后错误: ${lastError}`);
    return [];
  }

  const matched = [];
  for (const ver of allNeoForgeVersions) {
    if (typeof ver !== 'string') continue;
    // 严格按 NeoForge 版本前缀匹配，例如 MC 1.21.1 只匹配 21.1.x
    if (ver.startsWith(neoPrefix + '.')) {
      matched.push(ver);
    }
  }

  const forgeMatched = [];
  // 旧版 Forge（MC 1.20.1）版本格式为 "1.20.1-47.x"，只有在旧 MC 版本下才需要
  if (!isNewNeoScheme) {
    for (const ver of allForgeVersions) {
      if (typeof ver !== 'string') continue;
      if (ver.startsWith(gameVersion + '-') || ver.startsWith(gameVersion + '.')) {
        forgeMatched.push(ver);
      }
    }
  }

  // 如果未匹配到兼容版本，返回空列表，避免显示错误版本误导用户
  let result = matched.length > 0 ? matched : [];
  if (forgeMatched.length > 0) {
    for (const fv of forgeMatched) {
      if (!result.includes(fv)) result.push(fv);
    }
  }
  result = [...new Set(result)].filter((v) => typeof v === 'string').reverse();
  if (result.length > 0) {
    const stable = result.find((v) => !v.includes('-beta') && !v.includes('-alpha'));
    if (stable) {
      result = result.filter((v) => v !== stable);
      result.unshift(stable);
    }
    result[0] = { version: result[0], gameVersion, type: '推荐' };
  }
  const finalVersions = result.slice(0, 10).map((v, i) => {
    if (typeof v === 'string') return { version: v, gameVersion, type: i === 0 ? '推荐' : '' };
    return v;
  });

  console.log(`[NeoForge] Found ${finalVersions.length} versions for MC ${gameVersion}, prefix: ${neoPrefix}`);
  return finalVersions;
}

module.exports = {
  findNeoForgeCoreJars,
  installNeoForge,
  mergeNeoForgeLoaderToVersion,
  getNeoForgeVersionsForGame
};
