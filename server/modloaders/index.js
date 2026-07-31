/**
 * @file server/modloaders/index.js - 模组加载器安装模块入口与编排器
 * @description 从 server/modloaders.js 拆分而来。汇总各子模块（shared/forge/neoforge/fabric/optifine）
 *   的导出，并实现 performInstallation 总安装编排器与 _server() 懒加载机制。
 */
const fs = require('fs');
const path = require('path');

const ctx = require('../context');
const utils = require('../utils');
const http = require('../http-client');
const versions = require('../versions');

const shared = require('./shared');
const forge = require('./forge');
const fabric = require('./fabric');
const neoforge = require('./neoforge');
const optifine = require('./optifine');

// 解构出 performInstallation 编排逻辑需要直接调用的函数
const { ensureBaseVersionInstalled } = shared;
const { installForge } = forge;
const { mergeFabricLoaderToVersion, autoDownloadFabricApi } = fabric;
const { mergeNeoForgeLoaderToVersion, installNeoForge } = neoforge;
const { mergeOptiFineToVersion } = optifine;
// [CRITICAL - 2026-07-03] natives.js 顶层 require('./modloaders') 形成循环依赖。
// 如果这里也顶层 require('../natives')，Node.js 会返回部分加载的空对象，
// 导致运行时 modloaders.findForgeCoreJars is not a function。
// 改为延迟 require：在函数内部调用时才加载，此时 modloaders 的 module.exports 已完成。
function _natives() { return require('../natives'); }

/* 懒加载 server.js 中尚未抽取到子模块的函数（避免循环依赖）。
   这些函数在 server.js 完成迁移后会通过 module.exports 暴露。 */
let _serverModule = null;
// 懒加载 server 模块，避免循环依赖
function _server() {
  if (_serverModule === null) {
    try { _serverModule = require('../../server'); } catch (_) { _serverModule = {}; }
  }
  return _serverModule;
}

/**
 * 执行版本安装的总编排器
 * @param {string} sessionId - 安装会话 ID
 * @param {object} versionDetails - 版本详情 JSON
 * @returns {Promise<void>}
 * @throws {Error} 安装失败时抛出异常
 */
async function performInstallation(sessionId, versionDetails) {
  while (ctx._installMutex) {
    try { await ctx._installMutex; } catch (_) {}
  }
  let releaseMutex;
  ctx._installMutex = new Promise((resolve) => { releaseMutex = resolve; });

  const session = ctx.sessions.installSessions.get(sessionId);
  if (!session) { releaseMutex(); ctx._installMutex = null; return; }

  const isAborted = () => {
    return session.status === 'cancelled' || (session._abortController && session._abortController.signal.aborted);
  };
  let speedSyncTimer;
  const abortCleanup = () => {
    if (speedSyncTimer) clearInterval(speedSyncTimer);
    const vd = path.join(ctx.dirs.VERSIONS_DIR, versionDetails.id);
    fs.promises.rm(vd, { recursive: true, force: true }).then(() => {
    }).catch(() => {});
  };

  if (isAborted()) { abortCleanup(); return; }

  const STAGE_WEIGHTS = { version_json: 1, client_jar: 5, libraries: 15, natives: 1, assets: 20, loader: 10, finalizing: 1 };
  const TOTAL_WEIGHT = Object.values(STAGE_WEIGHTS).reduce((a, b) => a + b, 0);
  // 按阶段权重计算总进度百分比
  const calcProgress = (stage, stagePct) => {
    const stageNames = Object.keys(STAGE_WEIGHTS);
    let prevWeight = 0;
    for (const s of stageNames) {
      if (s === stage) break;
      prevWeight += STAGE_WEIGHTS[s];
    }
    return Math.min(99, Math.round(((prevWeight + stagePct * STAGE_WEIGHTS[stage]) / TOTAL_WEIGHT) * 100));
  };

  const versionId = versionDetails.id;
  const versionDir = path.join(ctx.dirs.VERSIONS_DIR, versionId);
  const backupDir = versionDir + '.backup';
  let hasBackup = false;

  // 备份已存在的版本目录，便于失败回滚
  if (fs.existsSync(versionDir)) {
    try {
      if (fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true, force: true });
      fs.renameSync(versionDir, backupDir);
      hasBackup = true;
    } catch (e) {
      console.warn(`[Install] Failed to backup version: ${e.message}`);
    }
  }
  if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true });

  try {
    if (isAborted()) { abortCleanup(); return; }
    session.status = 'downloading';
    session.stage = 'version_json';
    session.message = '下载版本信息...';
    session.progress = calcProgress('version_json', 0.5);

    speedSyncTimer = setInterval(() => {
      if (session.status === 'downloading') {
        session.speed = ctx.DownloadManager.getSpeed();
      }
    }, 200);

    const versionJsonPath = path.join(versionDir, `${versionId}.json`);
    fs.writeFileSync(versionJsonPath, JSON.stringify(versionDetails, null, 2));
    versions._invalidateResolvedJsonCache(versionId);

    if (isAborted()) { abortCleanup(); return; }
    session.stage = 'client_jar';
    session.message = '下载游戏客户端..';
    session.progress = calcProgress('client_jar', 0);

    if (versionDetails.downloads?.client) {
      const clientInfo = versionDetails.downloads.client;
      const clientJarPath = path.join(versionDir, `${versionId}.jar`);

      if (!fs.existsSync(clientJarPath) || fs.statSync(clientJarPath).size !== clientInfo.size) {
        await http.downloadFileWithMirror(clientInfo.url, clientJarPath, (p) => {
          session.progress = calcProgress('client_jar', p.progress / 100);
          session.speed = p.speed;
          session.bytesDownloaded = p.bytesDownloaded;
          session.totalBytes = p.totalBytes;
          session.currentFile = `${versionId}.jar`;
          session.message = `下载客户端 ${utils.formatSize(p.bytesDownloaded)}/${utils.formatSize(p.totalBytes)}`;
        });

        if (clientInfo.sha1) {
          session.message = '校验客户端文件..';
          const sha1 = await utils.calculateSHA1(clientJarPath);
          if (sha1 !== clientInfo.sha1) {
            throw new Error(`客户端文件校验失败: SHA1不匹配`);
          }
        }
      }
    }

    session.stage = 'libraries';
    session.message = '下载依赖库文件..';
    session.progress = calcProgress('libraries', 0);
    session.currentFile = '';
    session.speed = 0;

    const libraries = versionDetails.libraries || [];
    // 按 rules 过滤出当前平台适用的库
    const validLibraries = libraries.filter((lib) => {
      if (lib.rules) {
        return versions.evaluateRules(lib.rules);
      }
      return true;
    });

    session.totalFiles = validLibraries.length;
    session.completedFiles = 0;

    const settings = versions.loadSettingsCached();
    const LIB_PARALLEL = Math.min(parseInt(settings.maxThreads, 10) || 64, validLibraries.length);
    let libCompleted = 0;

    // 单个库下载逻辑：处理 artifact、natives、maven 三种情况
    const downloadOneLib = async (lib, idx) => {
      if (isAborted()) return;

      if (lib.downloads?.artifact) {
        const artifact = lib.downloads.artifact;
        const libPath = artifact.path;
        let libUrl = artifact.url;
        if (!libUrl && lib.url) {
          libUrl = lib.url + (lib.url.endsWith('/') ? '' : '/') + libPath;
        }
        const libFile = path.join(ctx.dirs.LIBRARIES_DIR, libPath);

        if (!fs.existsSync(libFile) || (artifact.size && fs.statSync(libFile).size !== artifact.size)) {
          try {
            await http.downloadFileWithMirror(libUrl, libFile, (p) => {
              const libDone = (idx + p.progress / 100) / validLibraries.length;
              session.progress = calcProgress('libraries', libDone);
              session.speed = p.speed || ctx.DownloadManager.getSpeed();
              session.bytesDownloaded = p.bytesDownloaded;
              session.totalBytes = p.totalBytes;
              session.message = `下载库文件 (${idx + 1}/${validLibraries.length}): ${path.basename(libPath)}`;
            });

            if (artifact.sha1) {
              const sha1 = await utils.calculateSHA1(libFile);
              if (sha1 !== artifact.sha1) {
                console.warn(`Library SHA1 mismatch: ${libPath}`);
                try { fs.unlinkSync(libFile); } catch (_) {}
                session.errors.push(`库文件校验失败: ${libPath}`);
              }
            } else if (libFile.endsWith('.jar') && !utils.isJarIntact(libFile)) {
              console.warn(`Library JAR corrupt after download: ${lib.name || libPath}`);
              try { fs.unlinkSync(libFile); } catch (_) {}
              session.errors.push(`库文件损坏: ${lib.name || libPath}`);
            }
          } catch (e) {
            console.warn(`Failed to download library ${libPath}: ${e.message}`);
            session.errors.push(`库文件下载失败: ${libPath}`);
          }
        }
      } else if (lib.name) {
        const parts = lib.name.split(':');
        const libNameSuffix = parts.length >= 4 ? parts[3] : '';
        if (libNameSuffix.startsWith('natives-')) {
          // 处理旧式 natives-xxx 命名的原生库
          const currentPlatform = process.platform === 'win32' ? 'windows' :
            process.platform === 'darwin' ? 'osx' : 'linux';
          const platformNative = libNameSuffix.replace('natives-', '');
          let isValidPlatform = false;
          if (process.arch === 'x64') {
            isValidPlatform = platformNative === currentPlatform || platformNative === currentPlatform + '-x64';
          } else if (process.arch === 'ia32') {
            isValidPlatform = platformNative === currentPlatform + '-x86' || platformNative === currentPlatform;
          } else if (process.arch === 'arm64') {
            isValidPlatform = platformNative === currentPlatform + '-arm64' || platformNative === currentPlatform;
          }
          if (isValidPlatform && parts.length >= 4) {
            const nGroupPath = parts[0].replace(/\./g, '/');
            const nName = parts[1];
            const nVer = parts[2];
            const nClassifier = parts[3];
            const nJarName = `${nName}-${nVer}-${nClassifier}.jar`;
            const nativeFile = path.join(ctx.dirs.LIBRARIES_DIR, parts[0].replace(/\./g, path.sep), nName, nVer, nJarName);
            if (!fs.existsSync(nativeFile)) {
              const baseUrl = lib.url || 'https://libraries.minecraft.net/';
              const nativeUrl = `${baseUrl}${nGroupPath}/${nName}/${nVer}/${nJarName}`;
              try {
                await http.downloadFileWithMirror(nativeUrl, nativeFile, (p) => {
                  session.message = `下载原生库: ${nJarName}`;
                });
              } catch (e) {
                console.warn(`Failed to download native ${lib.name}: ${e.message}`);
                session.errors.push(`原生库下载失败: ${lib.name}`);
              }
            }
          }
        } else if (parts.length >= 3) {
          // 处理标准 maven 坐标格式的库
          const groupPath = parts[0].replace(/\./g, '/');
          const lname = parts[1];
          const lversion = parts[2];
          const classifier = parts.length >= 4 ? parts[3] : '';
          const jarName = classifier ? `${lname}-${lversion}-${classifier}.jar` : `${lname}-${lversion}.jar`;
          const libFile = path.join(ctx.dirs.LIBRARIES_DIR, parts[0].replace(/\./g, path.sep), lname, lversion, jarName);

          if (!fs.existsSync(libFile)) {
            // 根据库的 group 选择对应 maven 仓库
            const isNeoForgeLib = parts[0].includes('neoforged');
            const isForgeLib = parts[0].includes('forge') || parts[0].includes('minecraftforge') || (parts[0] === 'net.minecraft' && lname !== 'client' && lname !== 'server');
            const baseUrl = lib.url || (isNeoForgeLib ? 'https://maven.neoforged.net/' : (isForgeLib ? 'https://maven.minecraftforge.net/' : 'https://libraries.minecraft.net/'));
            const downloadUrl = `${baseUrl}${groupPath}/${lname}/${lversion}/${jarName}`;

            try {
              await http.downloadFileWithMirror(downloadUrl, libFile, (p) => {
                const libDone = (idx + p.progress / 100) / validLibraries.length;
                session.progress = calcProgress('libraries', libDone);
                session.message = `下载库文件 (${idx + 1}/${validLibraries.length}): ${jarName}`;
              });
              if (libFile.endsWith('.jar') && !utils.isJarIntact(libFile)) {
                console.warn(`Library JAR corrupt after download: ${lib.name}`);
                try { fs.unlinkSync(libFile); } catch (_) {}
                session.errors.push(`库文件损坏: ${lib.name}`);
              }
            } catch (e) {
              console.warn(`Failed to download library ${lib.name}: ${e.message}`);
              session.errors.push(`库文件下载失败: ${lib.name}`);
            }
          }
        }
      }

      // 处理 natives 字段指定的原生库（新式）
      if (lib.natives) {
        const nativeKey = lib.natives[process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'];
        if (nativeKey) {
          const classifier = nativeKey.replace('${arch}', process.arch === 'x64' ? '64' : '32');
          const nativeDownload = lib.downloads?.classifiers?.[classifier];
          if (nativeDownload) {
            const nativeFile = path.join(ctx.dirs.LIBRARIES_DIR, nativeDownload.path);
            if (!fs.existsSync(nativeFile)) {
              try {
                await http.downloadFileWithMirror(nativeDownload.url, nativeFile, (p) => {
                  session.speed = p.speed || ctx.DownloadManager.getSpeed();
                  session.bytesDownloaded = p.bytesDownloaded;
                  session.totalBytes = p.totalBytes;
                  session.message = `下载原生库: ${path.basename(nativeDownload.path)}`;
                });
              } catch (e) {
                console.warn(`Failed to download native ${nativeDownload.path}: ${e.message}`);
                session.errors.push(`原生库下载失败: ${path.basename(nativeDownload.path)}`);
              }
            }
          }
        }
      }
    };

    // 并发调度库下载任务
    {
      let libIndex = 0;
      let libActive = 0;
      let libDone = null;

      const scheduleNext = () => {
        while (libActive < LIB_PARALLEL && libIndex < validLibraries.length) {
          if (isAborted()) break;
          const curIdx = libIndex++;
          libActive++;
          session.currentFile = validLibraries[curIdx].name || 'unknown';
          downloadOneLib(validLibraries[curIdx], curIdx).then(() => {
            libCompleted++;
            session.completedFiles = libCompleted;
          }).catch(() => {}).finally(() => {
            libActive--;
            if (libActive === 0 && libIndex >= validLibraries.length && libDone) libDone();
            else if (libActive < LIB_PARALLEL && libIndex < validLibraries.length) scheduleNext();
          });
        }
      };

      await new Promise((resolve) => { libDone = resolve; scheduleNext(); });
    }

    session.completedFiles = validLibraries.length;

    session.stage = 'assets';
    session.message = '下载资源索引...';
    session.progress = calcProgress('assets', 0);
    session.currentFile = '';
    session.speed = 0;

    if (versionDetails.assetIndex) {
      const assetIndexInfo = versionDetails.assetIndex;
      const assetIndexDir = path.join(ctx.dirs.ASSETS_DIR, 'indexes');
      if (!fs.existsSync(assetIndexDir)) fs.mkdirSync(assetIndexDir, { recursive: true });

      const assetIndexPath = path.join(assetIndexDir, `${assetIndexInfo.id}.json`);

      if (!fs.existsSync(assetIndexPath) || (assetIndexInfo.sha1 && !(await utils.verifyFileSha1(assetIndexPath, assetIndexInfo.sha1)))) {
        if (fs.existsSync(assetIndexPath)) fs.unlinkSync(assetIndexPath);
        await http.downloadFileWithMirror(assetIndexInfo.url, assetIndexPath);
      }

      session.message = '解析资源文件列表...';
      session.progress = calcProgress('assets', 0.1);

      let assetIndexData;
      try {
        assetIndexData = JSON.parse(fs.readFileSync(assetIndexPath, 'utf-8'));
      } catch (e) {
        throw new Error('无法解析资源索引文件');
      }

      const assetObjects = assetIndexData.objects || {};
      const assetEntries = Object.entries(assetObjects);
      const totalAssets = assetEntries.length;

      // 预创建资源对象的哈希子目录
      const assetSubDirs = new Set();
      for (const [, info] of assetEntries) {
        assetSubDirs.add(info.hash.substring(0, 2));
      }
      for (const sub of assetSubDirs) {
        await fs.promises.mkdir(path.join(ctx.dirs.ASSETS_DIR, 'objects', sub), { recursive: true });
      }

      session.totalFiles = totalAssets;
      session.completedFiles = 0;
      session.message = `下载资源文件 (0/${totalAssets})...`;

      const ASSET_PARALLEL = Math.min(parseInt(settings.maxThreads, 10) || 64, 64);
      let assetIndex = 0;
      let assetActive = 0;
      let assetDone = null;
      let processedCount = 0;

      // 并发调度资源文件下载
      const scheduleNextAsset = () => {
        while (assetActive < ASSET_PARALLEL && assetIndex < assetEntries.length) {
          if (isAborted()) break;
          const [name, info] = assetEntries[assetIndex++];
          assetActive++;
          (async () => {
            const hash = info.hash;
            const subDir = hash.substring(0, 2);
            const assetPath = path.join(ctx.dirs.ASSETS_DIR, 'objects', subDir, hash);
            const assetUrl = `https://resources.download.minecraft.net/${subDir}/${hash}`;
            let needDownload = false;
            try {
              const st = await fs.promises.stat(assetPath);
              if (info.size && st.size !== info.size) needDownload = true;
            } catch (e) {
              needDownload = true;
            }
            if (needDownload) {
              try {
                await http.downloadFileWithMirror(assetUrl, assetPath, (p) => {
                  session.speed = p.speed || ctx.DownloadManager.getSpeed();
                  session.bytesDownloaded = p.bytesDownloaded;
                  session.totalBytes = p.totalBytes;
                });
              } catch (e) {
                session.errors.push(`资源下载失败: ${name}`);
              }
            }
          })().then(() => {
            processedCount++;
            session.completedFiles = Math.min(processedCount, totalAssets);
            const assetDone = processedCount / Math.max(totalAssets, 1);
            session.progress = calcProgress('assets', 0.1 + assetDone * 0.9);
            session.currentFile = `资源 ${processedCount}/${totalAssets}`;
          }).catch(() => {}).finally(() => {
            assetActive--;
            if (assetActive === 0 && assetIndex >= assetEntries.length && assetDone) assetDone();
            else if (assetActive < ASSET_PARALLEL && assetIndex < assetEntries.length) scheduleNextAsset();
          });
        }
      };

      await new Promise((resolve) => { assetDone = resolve; scheduleNextAsset(); });
      session.message = `下载资源文件 (${processedCount}/${totalAssets})...`;

      // 处理 map_to_resources：将资源对象映射到 resources 目录
      if (assetIndexData.map_to_resources) {
        const resourcesDir = path.join(ctx.dirs.ASSETS_DIR, 'resources');
        if (!fs.existsSync(resourcesDir)) fs.mkdirSync(resourcesDir, { recursive: true });
        session.message = '映射资源文件到resources目录...';
        let mappedCount = 0;
        for (const [name, info] of assetEntries) {
          const hash = info.hash;
          const subDir = hash.substring(0, 2);
          const sourcePath = path.join(ctx.dirs.ASSETS_DIR, 'objects', subDir, hash);
          const destPath = path.join(resourcesDir, name);
          if (fs.existsSync(sourcePath)) {
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
            try {
              if (!fs.existsSync(destPath)) {
                fs.copyFileSync(sourcePath, destPath);
              }
              mappedCount++;
            } catch (e) {
              console.warn(`[Assets] 映射资源失败: ${name}: ${e.message}`);
            }
          }
        }
      }

      // 处理 virtual：将资源对象映射到 virtual/legacy 目录
      if (assetIndexData.virtual) {
        const virtualDir = path.join(ctx.dirs.ASSETS_DIR, 'virtual', 'legacy');
        if (!fs.existsSync(virtualDir)) fs.mkdirSync(virtualDir, { recursive: true });
        session.message = '映射资源文件到virtual目录...';
        let virtualCount = 0;
        for (const [name, info] of assetEntries) {
          const hash = info.hash;
          const subDir = hash.substring(0, 2);
          const sourcePath = path.join(ctx.dirs.ASSETS_DIR, 'objects', subDir, hash);
          const destPath = path.join(virtualDir, name);
          if (fs.existsSync(sourcePath)) {
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
            try {
              if (!fs.existsSync(destPath)) {
                fs.copyFileSync(sourcePath, destPath);
              }
              virtualCount++;
            } catch (e) {
              console.warn(`[Assets] 映射虚拟资源失败: ${name}: ${e.message}`);
            }
          }
        }
      }
    }

    session.stage = 'natives';
    session.message = '提取原生库..';
    session.progress = calcProgress('natives', 0.5);
    session.currentFile = '';

    _natives().extractNatives(versionDetails, versionId);

    session.stage = 'loader';
    session.message = '完成安装...';
    session.progress = calcProgress('loader', 0);

    await utils.sleep(300);

    if (session.loaderInfo && session.loaderInfo.type && !session.loaderInfo.version) {
      session.status = 'failed';
      session.stage = 'failed';
      const loaderName = session.loaderInfo.type === 'neoforge' ? 'NeoForge' :
                        session.loaderInfo.type.charAt(0).toUpperCase() + session.loaderInfo.type.slice(1);
      session.message = `${loaderName}版本号缺失，请重新选择${loaderName}版本`;
      session.errors.push(session.message);
      console.error(`[API-install] ${session.message}`);
      return;
    }

    if (session.loaderInfo && session.loaderInfo.type && session.loaderInfo.version) {
      if (session.status === 'cancelled') return;

      const gameVersion = versionDetails.inheritsFrom || versionId;
      session.stage = 'loader';
      session.message = '安装基础版本...';
      session.progress = calcProgress('loader', 0.1);

      try {
        const baseResult = await ensureBaseVersionInstalled(gameVersion);
        if (baseResult.error) {
          session.errors.push(`基础版本安装失败: ${baseResult.error}`);
        }
      } catch (baseErr) {
        session.errors.push(`基础版本安装失败: ${baseErr.message}`);
      }

      if (session.status === 'cancelled') return;

      const loaderType = session.loaderInfo.type;
      const loaderVersion = session.loaderInfo.version;
      const forgeVersionId = `${gameVersion}-${loaderType}-${loaderVersion}`;

      session.progress = calcProgress('loader', 0.3);
      session.message = `正在安装${loaderType === 'neoforge' ? 'NeoForge' : loaderType.charAt(0).toUpperCase() + loaderType.slice(1)}模组加载器...`;

      try {
        let loaderResult = { success: true };
        const loaderProgress = (p, msg) => {
          if (session.status === 'cancelled') return;
          session.progress = calcProgress('loader', 0.3 + p * 0.65);
          if (msg) session.message = msg;
        };

        if (loaderType === 'fabric') {
          await mergeFabricLoaderToVersion(versionId, gameVersion, loaderVersion, loaderProgress);
        } else if (loaderType === 'forge') {
          // [CRITICAL - 2026-06-21] 必须传 versionId 作为 targetVersionId！
          // download 页面创建的版本目录用大写 Forge（如 "26.2-Forge-65.0.0"），
          // installForge 默认用小写 forge（如 "26.2-forge-65.0.0"）。
          // Windows NTFS 大小写不敏感，目录相同但文件名不同，会导致 JSON 被覆盖为原版。
          // 传入 versionId 确保 installForge 写入正确的文件路径。
          // 详见 installForge 函数顶部注释。
          // [AI-AUTOGEN-WARNING] 不要删除 ", null, versionId"，否则 Forge 版本会启动为原版。
          loaderResult = await installForge(gameVersion, loaderVersion, (p, msg) => {
            if (session.status === 'cancelled') return;
            session.progress = Math.min(94 + p * 4, 98);
            session.message = msg || `正在安装Forge ${loaderVersion}...`;
          }, null, versionId);
          // [CRITICAL - 2026-07-03] 不要在 installForge 成功后把 inheritsFrom 写回去！
          // forge-installer.js 子进程已经合并了父版本内容并删除了 inheritsFrom，
          // 使版本成为自包含的基础版本。如果这里把 inheritsFrom 加回去，
          // resolveVersionJson 启动时会重新合并父版本参数，
          // 导致引导库（securejarhandler 等）被重复加载到 JPMS 模块层，
          // 触发 "Module X reads more than one module named Y" 冲突。
          // 参考：1.21.1-Forge-52.1.142 启动崩溃问题。
        } else if (loaderType === 'neoforge') {
          // [CRITICAL FIX - 2026-07-20] 必须调用 installNeoForge 而不是 mergeNeoForgeLoaderToVersion！
          // installNeoForge 负责：下载 installer JAR、提取 version.json（含34个 NeoForge/FML 运行时库）、
          // 构造正确的 versionJson（mainClass=cpw.mods.bootstraplauncher.BootstrapLauncher）、
          // 下载库、写入 version.json，最后内部调用 mergeNeoForgeLoaderToVersion 合并运行时库和运行处理器。
          // 如果只调用 mergeNeoForgeLoaderToVersion，会跳过上述步骤，version.json 保留 MC 原版内容
          // （88个 MC 原版库，mainClass=net.minecraft.client.main.Main），导致：
          //   1. 预下载逻辑没有下载 NeoForge/FML 库（version.json 里没有这些库）
          //   2. 官方安装器运行时直连 maven.neoforged.net 下载失败（Connection reset）
          //   3. 启动游戏时是原版 MC 而不是 NeoForge
          // [CRITICAL - 2026-07-20] 必须传 versionId 作为 targetVersionId！
          // 否则 installNeoForge 内部用默认 ${gameVersion}-NeoForge-${neoVersion} 生成 versionId，
          // 与本函数（performInstallation）创建的版本目录不一致：本函数在 A 目录写原版 JSON，
          // installNeoForge 在 B 目录写正确的 NeoForge JSON，启动时找到的是 A 目录的原版 JSON。
          // 详见 installNeoForge 函数顶部注释。
          loaderResult = await installNeoForge(gameVersion, loaderVersion, loaderProgress, versionId);
        } else if (loaderType === 'optifine') {
          await mergeOptiFineToVersion(versionId, gameVersion, loaderVersion, loaderProgress);
        }

        if (!loaderResult.success) {
          session.status = 'failed';
          session.stage = 'failed';
          session.message = `Forge安装失败: ${loaderResult.error}`;
          session.errors.push(loaderResult.error);
          console.error(`[API-install] Forge安装失败: ${loaderResult.error}`);
          return;
        }

        session.progress = calcProgress('loader', 0.95);
        session.message = '模组加载器安装完成';
      } catch (loaderErr) {
        session.status = 'failed';
        session.stage = 'failed';
        session.message = `模组加载器安装失败: ${loaderErr.message}`;
        session.errors.push(loaderErr.message);
        console.error(`[Loader] install failed:`, loaderErr.message);
        return;
      }

      const mergedJson = versions.resolveVersionJson(versionId);
      if (mergedJson) {
        _natives().extractNatives(mergedJson, versionId);
      }
    }

    // Fabric 加载器安装完成后自动下载 Fabric API
    if (session.loaderInfo && session.loaderInfo.type === 'fabric') {
      if (session.status === 'cancelled') return;
      const gameVersionForApi = versionDetails.inheritsFrom || versionId.replace(/-.+$/, '');
      session.stage = 'finalizing';
      session.message = '正在下载 Fabric API...';
      session.progress = calcProgress('finalizing', 0.5);

      try {
        const apiResult = await autoDownloadFabricApi(gameVersionForApi, versionId, (p, msg) => {
          if (session.status === 'cancelled') return;
          session.progress = calcProgress('finalizing', 0.5 + p * 0.45);
          if (msg) session.message = msg;
        });
        if (apiResult.success && apiResult.fileName) {
        }
      } catch (apiErr) {
        console.warn(`[Install] Fabric API 自动下载失败 (非致命): ${apiErr.message}`);
      }
    }

    session.status = 'completed';
    session.stage = 'completed';
    session.message = `${versionId} 安装完成！`;
    session.progress = 100;
    session.speed = 0;
    if (speedSyncTimer) clearInterval(speedSyncTimer);

    if (hasBackup) {
      try { fs.rmSync(backupDir, { recursive: true, force: true }); } catch (_) {}
    }

    ctx.caches._versionsCache = null;
    ctx.caches._versionsCacheTime = 0;

  } catch (e) {
    if (speedSyncTimer) clearInterval(speedSyncTimer);
    session.status = 'failed';
    session.stage = 'failed';
    session.message = `安装失败: ${e.message}`;
    session.errors.push(e.message);
    console.error(`Installation failed for ${versionId}:`, e.message);

    // 失败时回滚到备份目录或清理失败的版本目录
    try {
      const failedDir = path.join(ctx.dirs.VERSIONS_DIR, versionId);
      if (hasBackup && fs.existsSync(backupDir)) {
        if (fs.existsSync(failedDir)) fs.rmSync(failedDir, { recursive: true, force: true });
        fs.renameSync(backupDir, failedDir);
      } else if (fs.existsSync(failedDir)) {
        fs.rmSync(failedDir, { recursive: true, force: true });
      }
    } catch (cleanupErr) {
      console.error(`[Install] Failed to cleanup/restore:`, cleanupErr.message);
    }
  } finally {
    releaseMutex();
    ctx._installMutex = null;
  }
}

/* 模块导出 - 聚合各子模块，保持与原 server/modloaders.js 一致的导出接口 */
module.exports = {
  // Forge core libs / patching
  downloadForgeCoreLibsFromMaven: forge.downloadForgeCoreLibsFromMaven,
  downloadForgePatchingJars: forge.downloadForgePatchingJars,
  findForgeCoreJars: forge.findForgeCoreJars,
  findNeoForgeCoreJars: neoforge.findNeoForgeCoreJars,

  // Base version
  ensureBaseVersionInstalled: shared.ensureBaseVersionInstalled,

  // Fabric
  installFabric: fabric.installFabric,
  mergeFabricLoaderToVersion: fabric.mergeFabricLoaderToVersion,
  getFabricLoaderVersions: fabric.getFabricLoaderVersions,
  getFabricLoaderVersionsForGame: fabric.getFabricLoaderVersionsForGame,
  autoDownloadFabricApi: fabric.autoDownloadFabricApi,

  // Loader verification / compat
  verifyLoaderLibs: shared.verifyLoaderLibs,
  compareSemver: shared.compareSemver,
  parseVersionRequirement: shared.parseVersionRequirement,
  scanModsForLoaderReqs: shared.scanModsForLoaderReqs,
  ensureLoaderCompat: shared.ensureLoaderCompat,
  verifyImportLibs: shared.verifyImportLibs,

  // Forge
  runForgeInstallerJar: forge.runForgeInstallerJar,
  installForge: forge.installForge,
  mergeForgeLoaderToVersion: forge.mergeForgeLoaderToVersion,

  // Library helpers
  isLibValid: shared.isLibValid,
  getNeoLibMirrorUrl: shared.getNeoLibMirrorUrl,

  // NeoForge
  installNeoForge: neoforge.installNeoForge,
  mergeNeoForgeLoaderToVersion: neoforge.mergeNeoForgeLoaderToVersion,
  getNeoForgeVersionsForGame: neoforge.getNeoForgeVersionsForGame,

  // OptiFine
  mergeOptiFineToVersion: optifine.mergeOptiFineToVersion,

  // Installation orchestrator
  performInstallation,
};
