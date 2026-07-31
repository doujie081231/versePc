/**
 * @file server/modpack/modrinth.js - Modrinth (.mrpack) 整合包导入
 * @description 解析 modrinth.index.json，安装基础版本与模组加载器，下载 mods 与 overrides。
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ctx = require('../context');
const utils = require('../utils');
const http = require('../http-client');
const versions = require('../versions');
const modloaders = require('../modloaders');

const { _dedupeVersionId, _cleanDownloadingResidue, isModpackPathSafe, _repairCorruptedModJars, relocateMisplacedResourcePacks, resolveConcurrency, computeModTimeout, createProgressUpdater, _saveModManifest } = require('./shared');

/**
 * 导入 Modrinth (.mrpack) 整合包（解析 manifest、安装基础版本与加载器、下载 mods 与 overrides）。
 * @param {object} zip - AdmZip 实例（已打开的整合包 zip）
 * @param {object} manifestEntry - modrinth.index.json 的 zip entry
 * @param {string} filePath - 整合包文件路径
 * @param {(stage: string, message: string, percent: number, files?: Array, loader?: string) => void} progress - 进度回调
 * @param {string} [targetVersion=''] - 目标版本目录名（为空则自动生成）
 * @param {AbortSignal} [abortSignal=null] - 取消信号
 * @returns {Promise<{success: boolean, versionId?: string, name?: string, mcVersion?: string, error?: string, warning?: string, failedMods?: Array, loaderVersionId?: string, targetVersion?: string}>}
 */
async function _importMrpack(zip, manifestEntry, filePath, progress, targetVersion = '', abortSignal = null) {
  const settings = versions.loadSettingsCached();
  let manifest;
  try {
    manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
  } catch (e) {
    console.error(`[mrpack] 解析 modrinth.index.json 失败:`, e.message);
    return { success: false, error: '解析 modrinth.index.json 失败: ' + e.message };
  }

  const packName = (manifest.name || path.basename(filePath, path.extname(filePath))).replace(/[<>:"/\\|?*]/g, '_');
  let mcVersion = (manifest.dependencies && manifest.dependencies.minecraft && manifest.dependencies.minecraft !== 'minecraft' && /^\d/.test(manifest.dependencies.minecraft)) ? manifest.dependencies.minecraft : '';
  if (mcVersion && manifest.versionId && mcVersion === manifest.versionId) { mcVersion = ''; }
  const fabricVer = manifest.dependencies ? manifest.dependencies['fabric-loader'] : undefined;
  let forgeVer = manifest.dependencies ? manifest.dependencies.forge : undefined;
  const neoforgeVer = manifest.dependencies ? manifest.dependencies.neoforge : undefined;

  if (forgeVer && forgeVer.startsWith(mcVersion + '-')) {
    forgeVer = forgeVer.slice(mcVersion.length + 1);
  }

  progress('prepare', `整合包: ${packName}  MC: ${mcVersion}`, 8);

  let versionId;
  let versionDir;

  if (targetVersion) {
    const cleanTargetId = targetVersion.replace(/ \[外部\d*\]/, '');
    const existingDir = path.join(ctx.dirs.VERSIONS_DIR, cleanTargetId);
    if (fs.existsSync(existingDir)) {
      versionId = cleanTargetId;
      versionDir = existingDir;
    } else {
      const extFolders = versions.loadExternalFolders();
      for (const folder of extFolders) {
        if (!fs.existsSync(folder.path)) continue;
        const extVers = versions.scanExternalFolder(folder.path);
        const extV = extVers.find((v) => v.id === cleanTargetId);
        if (extV) {
          versionId = cleanTargetId;
          versionDir = extV.externalVersionDir;
          break;
        }
      }
    }
    if (!versionDir) {
      versionId = _dedupeVersionId(cleanTargetId);
      versionDir = path.join(ctx.dirs.VERSIONS_DIR, versionId);
    }
  } else {
    versionId = _dedupeVersionId(packName);
    versionDir = path.join(ctx.dirs.VERSIONS_DIR, versionId);
  }

  const isNewVersionDir = !fs.existsSync(path.join(versionDir, `${versionId}.json`));

  if (!fs.existsSync(versionDir)) {
    fs.mkdirSync(versionDir, { recursive: true });
  }

  let loaderVersionId = null;
  if (forgeVer) loaderVersionId = `${mcVersion}-forge-${forgeVer}`;
  else if (neoforgeVer) loaderVersionId = `${mcVersion}-neoforge-${neoforgeVer}`;
  else if (fabricVer) loaderVersionId = `fabric-loader-${fabricVer}-${mcVersion}`;

  if (isNewVersionDir) {
    const _baseStartTime = Date.now();
    progress('base', '正在准备基础版本...', 5);
    utils._writeImportLog(`>>> [步骤1/5] 确保基础版本存在: ${mcVersion}`);
    const baseResult = await modloaders.ensureBaseVersionInstalled(mcVersion, (msg, pct) => {
      const elapsed = Math.round((Date.now() - _baseStartTime) / 1000);
      progress('base', msg || '正在准备基础版本...', 5 + Math.min(pct, 100) * 0.15);
    });
    utils._writeImportLog(`<<< [步骤1/5] 基础版本完成: error=${baseResult.error || '无'}, alreadyInstalled=${baseResult.alreadyInstalled || false}, 耗时=${Math.round((Date.now() - _baseStartTime) / 1000)}s`);
    if (baseResult.error) {
      try { if (fs.existsSync(versionDir)) fs.rmSync(versionDir, { recursive: true, force: true }); } catch (e) {}
      return { success: false, versionId, error: baseResult.error };
    }

    if (forgeVer || neoforgeVer || fabricVer) {
      const _loaderStartTime = Date.now();
      progress('loader-install', '正在安装模组加载器...', 20);
      try {
        if (forgeVer) {
          loaderVersionId = `${mcVersion}-forge-${forgeVer}`;
          const lvJson = path.join(ctx.dirs.VERSIONS_DIR, loaderVersionId, `${loaderVersionId}.json`);
          if (!fs.existsSync(lvJson) || !modloaders.verifyLoaderLibs(loaderVersionId)) {
            if (fs.existsSync(lvJson) && !modloaders.verifyLoaderLibs(loaderVersionId)) {
              try { fs.rmSync(path.join(ctx.dirs.VERSIONS_DIR, loaderVersionId), { recursive: true, force: true }); } catch (e) {}
            }
            utils._writeImportLog(`>>> [步骤2/5] 安装Forge: ${forgeVer} (MC ${mcVersion})`);
            const _forgeStartTime = Date.now();
            const ir = await modloaders.installForge(mcVersion, forgeVer, (p, msg) => {
              const np = p > 1 ? p / 100 : p;
              const elapsed = Math.round((Date.now() - _forgeStartTime) / 1000);
              progress('loader-install', msg || '正在安装Forge...', 20 + np * 15);
            });
            utils._writeImportLog(`<<< [步骤2/5] Forge安装完成: success=${ir.success}, 耗时=${Math.round((Date.now() - _forgeStartTime) / 1000)}s, error=${ir.error || '无'}`);
            if (!ir.success) throw new Error(ir.error);
          }
        } else if (neoforgeVer) {
          loaderVersionId = `${mcVersion}-neoforge-${neoforgeVer}`;
          const lvJson = path.join(ctx.dirs.VERSIONS_DIR, loaderVersionId, `${loaderVersionId}.json`);
          if (!fs.existsSync(lvJson) || !modloaders.verifyLoaderLibs(loaderVersionId)) {
            if (fs.existsSync(lvJson) && !modloaders.verifyLoaderLibs(loaderVersionId)) {
              try { fs.rmSync(path.join(ctx.dirs.VERSIONS_DIR, loaderVersionId), { recursive: true, force: true }); } catch (e) {}
            }
            utils._writeImportLog(`>>> [步骤2/5] 安装NeoForge: ${neoforgeVer} (MC ${mcVersion})`);
            const _nfStartTime = Date.now();
            const ir = await modloaders.installNeoForge(mcVersion, neoforgeVer, (p, msg) => {
              const np = p > 1 ? p / 100 : p;
              const elapsed = Math.round((Date.now() - _nfStartTime) / 1000);
              progress('loader-install', msg || '正在安装NeoForge...', 20 + np * 15);
            });
            utils._writeImportLog(`<<< [步骤2/5] NeoForge安装完成: success=${ir.success}, 耗时=${Math.round((Date.now() - _nfStartTime) / 1000)}s, error=${ir.error || '无'}`);
            if (!ir.success) throw new Error(ir.error);
          }
        } else if (fabricVer) {
          loaderVersionId = `fabric-loader-${fabricVer}-${mcVersion}`;
          const lvJson = path.join(ctx.dirs.VERSIONS_DIR, loaderVersionId, `${loaderVersionId}.json`);
          let fabricNeedInstall = !fs.existsSync(lvJson);
          if (!fabricNeedInstall) {
            if (!modloaders.verifyLoaderLibs(loaderVersionId)) {
              fabricNeedInstall = true;
            } else {
              try {
                const existingJson = JSON.parse(fs.readFileSync(lvJson, 'utf-8'));
                const hasFabricLoader = (existingJson.libraries || []).some((l) => l.name && l.name.startsWith('net.fabricmc:fabric-loader'));
                if (!hasFabricLoader) {
                  fabricNeedInstall = true;
                }
              } catch (_) { fabricNeedInstall = true; }
            }
          }
          if (fabricNeedInstall) {
            if (fs.existsSync(lvJson)) {
              try { fs.rmSync(path.join(ctx.dirs.VERSIONS_DIR, loaderVersionId), { recursive: true, force: true }); } catch (e) {}
            }
            utils._writeImportLog(`>>> [步骤2/5] 安装Fabric: ${fabricVer} (MC ${mcVersion})`);
            const _fabStartTime = Date.now();
            const ir = await modloaders.installFabric(mcVersion, fabricVer, (p, msg) => {
              const np = p > 1 ? p / 100 : p;
              const elapsed = Math.round((Date.now() - _fabStartTime) / 1000);
              progress('loader-install', msg || '正在安装Fabric...', 20 + np * 15);
            });
            utils._writeImportLog(`<<< [步骤2/5] Fabric安装完成: success=${ir.success}, 耗时=${Math.round((Date.now() - _fabStartTime) / 1000)}s, error=${ir.error || '无'}`);

            if (!ir.success) throw new Error(ir.error);
          }
        }
      } catch (e) {
        console.error(`[mrpack] 模组加载器安装失败:`, e.stack || e.message);
        try { if (fs.existsSync(versionDir)) fs.rmSync(versionDir, { recursive: true, force: true }); } catch (ce) {}
        return { success: false, versionId, error: e.message };
      }
    }

    const _vcStartTime = Date.now();
    utils._writeImportLog(`>>> [步骤3/5] 创建版本配置`);
    progress('version-config', '正在创建版本配置...', 35);

    /* 将加载器 JSON 合并到原版 JSON 之上，生成整合包版本 JSON */
    function mergeVersionJson(baseJson, loaderJson, versionId) {
      const merged = { ...baseJson };
      const vanillaLibs = baseJson.libraries || [];
      const loaderLibs = loaderJson.libraries || [];
      const seenNames = new Set(loaderLibs.map((l) => l.name).filter(Boolean));
      // 记录已有 natives/classifiers 的库名，避免同名带 natives 的条目重复添加
      const namesWithNatives = new Set(
        loaderLibs.filter((l) => l.name && (l.natives || l.downloads?.classifiers)).map((l) => l.name));
      const mergedLibs = [...loaderLibs];
      for (const vl of vanillaLibs) {
        if (!vl.name) continue;
        const vlHasNatives = !!(vl.natives || vl.downloads?.classifiers);
        if (!seenNames.has(vl.name)) {
          // 新库：直接添加
          mergedLibs.push(vl);
          seenNames.add(vl.name);
          if (vlHasNatives) namesWithNatives.add(vl.name);
        } else if (vlHasNatives && !namesWithNatives.has(vl.name)) {
          // 同名库但含 natives/classifiers，且现有同名条目不含 natives：
          // 原版 JSON 可能有多条同名条目（一条不含 natives，一条含 natives），替换为含 natives 的条目
          const existingIdx = mergedLibs.findIndex((l) => l.name === vl.name);
          if (existingIdx >= 0) {
            mergedLibs[existingIdx] = vl;
          } else {
            mergedLibs.push(vl);
          }
          namesWithNatives.add(vl.name);
        }
        // 否则（已有同名带 natives 的条目）：跳过，避免重复
      }
      merged.libraries = mergedLibs;
      for (const key of Object.keys(loaderJson)) {
        if (key === 'libraries') continue;
        if (key === 'inheritsFrom' || key === 'jar') continue;
        if (key === 'arguments' && loaderJson.arguments && baseJson.arguments) {
          const mergedGame = [...(baseJson.arguments.game || [])];
          for (const ge of (loaderJson.arguments.game || [])) {
            const geStr = typeof ge === 'string' ? ge : JSON.stringify(ge);
            if (!mergedGame.some((mg) => (typeof mg === 'string' ? mg : JSON.stringify(mg)) === geStr)) {
              mergedGame.push(ge);
            }
          }
          const expandedLoaderJvm = [];
          const jvmArr = loaderJson.arguments.jvm || [];
          for (let ji = 0; ji < jvmArr.length; ji++) {
            const je = jvmArr[ji];
            if (typeof je === 'string' && (je === '--add-opens' || je === '--add-exports' || je === '--add-reads' || je === '--add-modules')) {
              const values = [];
              while (ji + 1 < jvmArr.length && typeof jvmArr[ji + 1] === 'string' && !jvmArr[ji + 1].startsWith('-')) {
                ji++;
                values.push(jvmArr[ji]);
              }
              if (values.length === 0) {
                expandedLoaderJvm.push(je);
              } else {
                for (const val of values) {
                  expandedLoaderJvm.push(je, val);
                }
              }
            } else {
              expandedLoaderJvm.push(je);
            }
          }
          const mergedJvm = [...(baseJson.arguments.jvm || [])];
          for (const je of expandedLoaderJvm) {
            const jeStr = typeof je === 'string' ? je : JSON.stringify(je);
            if (!mergedJvm.some((mj) => (typeof mj === 'string' ? mj : JSON.stringify(mj)) === jeStr)) {
              mergedJvm.push(je);
            }
          }
          merged.arguments = { game: mergedGame, jvm: mergedJvm };
        } else {
          if (loaderJson[key] && typeof loaderJson[key] === 'object' && !Array.isArray(loaderJson[key]) && Object.keys(loaderJson[key]).length === 0 && baseJson[key] && typeof baseJson[key] === 'object' && Object.keys(baseJson[key]).length > 0) {
            continue;
          }
          merged[key] = loaderJson[key];
        }
      }
      delete merged.inheritsFrom;
      delete merged._comment_;
      delete merged.jar;
      merged.id = versionId;
      merged.time = new Date().toISOString();
      merged.releaseTime = new Date().toISOString();
      return merged;
    }

    if (loaderVersionId) {
      const lvJsonPath = path.join(ctx.dirs.VERSIONS_DIR, loaderVersionId, `${loaderVersionId}.json`);
      let mergedJson = null;
      try {
        if (fs.existsSync(lvJsonPath) && mcVersion) {
          const vanillaJsonPath = path.join(ctx.dirs.VERSIONS_DIR, mcVersion, `${mcVersion}.json`);
          let baseJson = null;
          if (fs.existsSync(vanillaJsonPath)) {
            baseJson = JSON.parse(fs.readFileSync(vanillaJsonPath, 'utf-8'));
          }
          const lvJson = JSON.parse(fs.readFileSync(lvJsonPath, 'utf-8'));
          if (baseJson) {
            mergedJson = mergeVersionJson(baseJson, lvJson, versionId);
          } else {
            mergedJson = { ...lvJson };
            delete mergedJson.inheritsFrom;
            delete mergedJson._comment_;
            delete mergedJson.jar;
            mergedJson.id = versionId;
            mergedJson.time = new Date().toISOString();
            mergedJson.releaseTime = new Date().toISOString();
          }
          if (!mergedJson.clientVersion && mcVersion) {
            mergedJson.clientVersion = mcVersion;
          }
        } else if (fs.existsSync(lvJsonPath)) {
          mergedJson = JSON.parse(fs.readFileSync(lvJsonPath, 'utf-8'));
          delete mergedJson.inheritsFrom;
          delete mergedJson._comment_;
          delete mergedJson.jar;
          mergedJson.id = versionId;
          mergedJson.time = new Date().toISOString();
          mergedJson.releaseTime = new Date().toISOString();
        }
      } catch (lvErr) {
        console.error(`[mrpack] 读取加载器JSON失败:`, lvErr.message);
      }
      const versionJson = mergedJson || {
        id: versionId,
        type: 'release',
        time: new Date().toISOString(),
        releaseTime: new Date().toISOString()
      };
      if (versionJson.arguments?.jvm) {
        versionJson.arguments.jvm = versions.deduplicateJvmArgs(versionJson.arguments.jvm);
      }
      // [CRITICAL - 2026-06-21] 整合包版本JSON必须直接写入mergedJson，不能从文件重新读取！
      // 之前有段NeoForge的修复代码被错误复制到这里，导致版本JSON被覆盖为空内容。
      // 如果这里读取文件再写入，文件里的JSON可能是之前创建的空版本（没有libraries），导致整合包不出现在版本列表。
      fs.writeFileSync(path.join(versionDir, `${versionId}.json`), JSON.stringify(versionJson, null, 2));
      versions._invalidateResolvedJsonCache(versionId);
      try {
        const vanillaJar = path.join(ctx.dirs.VERSIONS_DIR, mcVersion || '', `${mcVersion}.jar`);
        const targetJar = path.join(versionDir, `${versionId}.jar`);
        // [关键修复 2026-07-21] 必须检查 targetJar 是否存在且大小 > 0
        // 旧逻辑只判断 fs.existsSync(targetJar)，若文件是 0 字节空壳则不会复制
        // 导致 BootstrapLauncher 找不到 Minecraft 主类，游戏启动后立即退出
        let needCopy = true;
        if (fs.existsSync(targetJar)) {
          try {
            const stat = fs.statSync(targetJar);
            if (stat.size > 0) needCopy = false;
          } catch (e) {}
        }
        if (needCopy && fs.existsSync(vanillaJar)) {
          fs.copyFileSync(vanillaJar, targetJar);
          console.log(`[mrpack] 已复制 vanilla client.jar 到版本目录: ${versionId}.jar (${fs.statSync(vanillaJar).size} bytes)`);
        }
      } catch (e) {
        console.warn(`[mrpack] 复制版本jar失败: ${e.message}`);
      }
      try {
        const loaderDir = path.join(ctx.dirs.VERSIONS_DIR, loaderVersionId);
        if (fs.existsSync(loaderDir) && loaderDir !== versionDir) {
          fs.rmSync(loaderDir, { recursive: true, force: true });
        }
      } catch (e) {
        console.warn(`[mrpack] 删除加载器文件夹失败: ${e.message}`);
      }
    } else {
      const versionJson = {
        id: versionId,
        inheritsFrom: mcVersion || undefined,
        type: 'release',
        mainClass: 'net.minecraft.client.main.Main',
        time: new Date().toISOString(),
        releaseTime: new Date().toISOString()
      };
      fs.writeFileSync(path.join(versionDir, `${versionId}.json`), JSON.stringify(versionJson, null, 2));
      versions._invalidateResolvedJsonCache(versionId);
    }

    utils._writeImportLog(`<<< [步骤3/5] 版本配置完成, 耗时=${Math.round((Date.now() - _vcStartTime) / 1000)}s`);
    progress('loader', '模组加载器就绪', 40);
  }

  // 整合包重装/重导入: 检测现有版本JSON是否已合并加载器内容
  // 如果没有合并（旧版创建的inheritsFrom方式），则重新合并
  {
    const versionJsonPath = path.join(versionDir, `${versionId}.json`);
    let existingJson = null;
    try {
      if (fs.existsSync(versionJsonPath)) {
        existingJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
      }
    } catch (_e) {}

    // If the existing JSON still has inheritsFrom, it's an old-style version that needs merging
    if (existingJson && existingJson.inheritsFrom && loaderVersionId) {
      const _remergeStartTime = Date.now();
      progress('base-fix', `正在同步加载器到 ${loaderVersionId}...`, 5);

      if (mcVersion) {
        const baseFix = await modloaders.ensureBaseVersionInstalled(mcVersion, (msg, pct) => {
          progress('base-fix', msg || `正在准备 ${mcVersion}...`, 5 + Math.min(pct, 100) * 0.15);
        });
        if (baseFix.error) {
          console.error(`[mrpack] 基础版本 ${mcVersion} 安装失败: ${baseFix.error}`);
          try { if (fs.existsSync(versionDir)) fs.rmSync(versionDir, { recursive: true, force: true }); } catch (ce) {}
          return { success: false, versionId, error: `基础版本 ${mcVersion} 安装失败: ${baseFix.error}` };
        }
      }

      if (loaderVersionId) {
        const lvJsonPath = path.join(ctx.dirs.VERSIONS_DIR, loaderVersionId, `${loaderVersionId}.json`);
        const needInstall = !fs.existsSync(lvJsonPath) || !modloaders.verifyLoaderLibs(loaderVersionId);
        if (needInstall) {
          if (fs.existsSync(lvJsonPath) && !modloaders.verifyLoaderLibs(loaderVersionId)) {
            try { fs.rmSync(path.join(ctx.dirs.VERSIONS_DIR, loaderVersionId), { recursive: true, force: true }); } catch (e) {}
          }
          try {
            let ir;
            const _remergeLdrStart = Date.now();
            if (forgeVer) ir = await modloaders.installForge(mcVersion, forgeVer, (p, msg) => { const np = p > 1 ? p / 100 : p; progress('loader-install', msg || '正在安装Forge...', 20 + np * 15); });
            else if (neoforgeVer) ir = await modloaders.installNeoForge(mcVersion, neoforgeVer, (p, msg) => { const np = p > 1 ? p / 100 : p; progress('loader-install', msg || '正在安装NeoForge...', 20 + np * 15); });
            else if (fabricVer) ir = await modloaders.installFabric(mcVersion, fabricVer, (p, msg) => { const np = p > 1 ? p / 100 : p; progress('loader-install', msg || '正在安装Fabric...', 20 + np * 15); });
            if (!ir || !ir.success) throw new Error((ir && ir.error) || `${loaderVersionId} 安装失败`);
          } catch (e) {
            console.error(`[mrpack] 加载器 ${loaderVersionId} 安装失败:`, e.stack || e.message);
            try { if (fs.existsSync(versionDir)) fs.rmSync(versionDir, { recursive: true, force: true }); } catch (ce) {}
            return { success: false, versionId, error: `整合包要求 ${loaderVersionId} 但安装失败: ${e.message}` };
          }
        }
      }

      // re-merge: vanilla JSON as base, merge loader on top
      try {
        const lvJsonPath = path.join(ctx.dirs.VERSIONS_DIR, loaderVersionId, `${loaderVersionId}.json`);
        if (fs.existsSync(lvJsonPath)) {
          let newJson = null;
          if (mcVersion) {
            const vanillaJsonPath = path.join(ctx.dirs.VERSIONS_DIR, mcVersion, `${mcVersion}.json`);
            let baseJson = null;
            if (fs.existsSync(vanillaJsonPath)) {
              baseJson = JSON.parse(fs.readFileSync(vanillaJsonPath, 'utf-8'));
            }
            const lvJson = JSON.parse(fs.readFileSync(lvJsonPath, 'utf-8'));
            if (baseJson) {
              newJson = mergeVersionJson(baseJson, lvJson, versionId);
            } else {
              newJson = { ...lvJson };
              delete newJson.inheritsFrom;
              delete newJson._comment_;
              delete newJson.jar;
              newJson.id = versionId;
              newJson.time = new Date().toISOString();
              newJson.releaseTime = new Date().toISOString();
            }
          } else {
            newJson = JSON.parse(fs.readFileSync(lvJsonPath, 'utf-8'));
            delete newJson.inheritsFrom;
            delete newJson._comment_;
            delete newJson.jar;
            newJson.id = versionId;
            newJson.time = new Date().toISOString();
            newJson.releaseTime = new Date().toISOString();
          }
          if (!newJson.clientVersion && mcVersion) {
            newJson.clientVersion = mcVersion;
          }
          if (newJson.arguments?.jvm) {
            newJson.arguments.jvm = versions.deduplicateJvmArgs(newJson.arguments.jvm);
          }
          fs.writeFileSync(versionJsonPath, JSON.stringify(newJson, null, 2));
          versions._invalidateResolvedJsonCache(versionId);
        }
      } catch (e) {
        console.error(`[mrpack] 重新合并版本JSON失败:`, e.message);
      }
      try {
        const loaderDir = path.join(ctx.dirs.VERSIONS_DIR, loaderVersionId);
        if (fs.existsSync(loaderDir) && loaderDir !== versionDir) {
          fs.rmSync(loaderDir, { recursive: true, force: true });
        }
      } catch (e) {
        console.warn(`[mrpack] 删除加载器文件夹失败: ${e.message}`);
      }
    }
  }

  if (isNewVersionDir && !fs.existsSync(path.join(versionDir, `${versionId}.json`))) {
    let fallbackJson = {
      id: versionId,
      type: 'release',
      mainClass: 'net.minecraft.client.main.Main',
      time: new Date().toISOString(),
      releaseTime: new Date().toISOString()
    };
    try {
      if (loaderVersionId && mcVersion) {
        const lvP = path.join(ctx.dirs.VERSIONS_DIR, loaderVersionId, `${loaderVersionId}.json`);
        const vanillaJsonPath = path.join(ctx.dirs.VERSIONS_DIR, mcVersion, `${mcVersion}.json`);
        if (fs.existsSync(lvP)) {
          let baseJson = null;
          if (fs.existsSync(vanillaJsonPath)) {
            baseJson = JSON.parse(fs.readFileSync(vanillaJsonPath, 'utf-8'));
          }
          const lvJ = JSON.parse(fs.readFileSync(lvP, 'utf-8'));
          if (baseJson) {
            fallbackJson = mergeVersionJson(baseJson, lvJ, versionId);
          } else {
            fallbackJson = { ...lvJ };
            delete fallbackJson.inheritsFrom;
            delete fallbackJson._comment_;
            delete fallbackJson.jar;
            fallbackJson.id = versionId;
            fallbackJson.time = new Date().toISOString();
            fallbackJson.releaseTime = new Date().toISOString();
          }
          if (!fallbackJson.clientVersion) fallbackJson.clientVersion = mcVersion;
        }
      }
    } catch (_e) {}
    if (fallbackJson.arguments?.jvm) {
      fallbackJson.arguments.jvm = versions.deduplicateJvmArgs(fallbackJson.arguments.jvm);
    }
    fs.writeFileSync(path.join(versionDir, `${versionId}.json`), JSON.stringify(fallbackJson, null, 2));
    versions._invalidateResolvedJsonCache(versionId);
  }

  let _backupDir = null;
  if (!isNewVersionDir) {
    try {
      const existingModsDir = path.join(versionDir, 'mods');
      if (fs.existsSync(existingModsDir)) {
        _backupDir = versionDir + '.backup_' + Date.now();
        fs.cpSync(existingModsDir, path.join(_backupDir, 'mods'), { recursive: true });
      }
    } catch (bkErr) {
      console.warn(`[mrpack] 备份 mods 目录失败 (非致命): ${bkErr.message}`);
      _backupDir = null;
    }
  }

  try {
    const _extractStartTime = Date.now();
    utils._writeImportLog(`>>> [步骤4/5] 解压覆盖文件`);
    progress('extract', '解压覆盖文件...', 40, [], '');
    const entries = zip.getEntries();
    const overrideFiles = [];
    let extractYieldCounter = 0;
    let extractCount = 0;
    // 先统计待解压文件总数，用于实时进度反馈
    let _overrideTotal = 0;
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const _n = entry.entryName;
      if (_n.startsWith('overrides/') || _n.startsWith('client-overrides/')) _overrideTotal++;
    }
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const entryName = entry.entryName;
      if (!isModpackPathSafe(entryName)) continue;
      let relPath = null;
      if (entryName.startsWith('overrides/')) {
        relPath = entryName.slice('overrides/'.length);
      } else if (entryName.startsWith('client-overrides/')) {
        relPath = entryName.slice('client-overrides/'.length);
      }
      if (relPath) {
        const destPath = path.join(versionDir, relPath);
        const resolvedDest = path.resolve(destPath);
        const resolvedBase = path.resolve(versionDir);
        if (!resolvedDest.startsWith(resolvedBase + path.sep) && resolvedDest !== resolvedBase) {
          console.warn(`[Modpack] 路径遍历攻击已拦截: ${relPath}`);
          continue;
        }
        await utils.asyncEnsureDir(destPath);
        let extractOk = false;
        for (let attempt = 1; attempt <= 5; attempt++) {
          try {
            await fs.promises.writeFile(destPath, entry.getData());
            extractOk = true;
            break;
          } catch (e) {
            console.warn(`[Modpack] 解压 ${relPath} 第 ${attempt} 次失败: ${e.message}`);
            if (attempt < 5) await new Promise((r) => setTimeout(r, (attempt - 1) * 2000));
          }
        }
        if (extractOk) { overrideFiles.push({ name: relPath, status: 'completed', progress: 100 }); extractCount++; }
        // 实时进度反馈：每 50 个文件更新一次进度（40% → 50% 区间）
        if (_overrideTotal > 0 && ++extractYieldCounter % 50 === 0) {
          const _extractPct = 40 + Math.round((extractCount / _overrideTotal) * 10);
          progress('extract', `解压覆盖文件... (${extractCount}/${_overrideTotal})`, _extractPct, [], '');
          await utils.yieldToEventLoop();
        }
      }
    }
    utils._writeImportLog(`<<< [步骤4/5] 解压完成: ${extractCount} 个文件, 耗时=${Math.round((Date.now() - _extractStartTime) / 1000)}s`);

    // 提取整合包根目录的图标文件（pack.png / icon.png / logo.png）到版本目录，用于版本卡片展示
    try {
      const _rootIconNames = ['pack.png', 'icon.png', 'logo.png'];
      for (const _entry of entries) {
        if (_entry.isDirectory) continue;
        const _entryName = _entry.entryName.replace(/\\/g, '/');
        if (_rootIconNames.includes(_entryName)) {
          const _destIconPath = path.join(versionDir, _entryName);
          if (!fs.existsSync(_destIconPath)) {
            await fs.promises.writeFile(_destIconPath, _entry.getData());
            utils._writeImportLog(`提取整合包图标: ${_entryName}`);
          }
          break;
        }
      }
    } catch (_iconErr) {
      console.warn(`[Modpack] 提取根目录图标失败（非致命）: ${_iconErr.message}`);
    }

    // 修正：mods 目录下误放的资源包 zip 移到 resourcepacks（整合包作者打包结构错误时自动修复）
    try {
      const relocated = relocateMisplacedResourcePacks(versionDir);
      if (relocated.relocated.length > 0) {
        console.log(`[Modpack] 检测到 ${relocated.relocated.length} 个资源包 zip 误放在 mods 目录，已自动移动到 resourcepacks: ${relocated.relocated.join(', ')}`);
      }
    } catch (e) {
      console.warn(`[Modpack] 资源包重定位失败（非致命）: ${e.message}`);
    }

    try {
      // 强制开启版本隔离，避免不同整合包 mods 目录共享冲突
      const vsPath = path.join(versionDir, 'version-settings.json');
      let vs = {};
      if (fs.existsSync(vsPath)) vs = JSON.parse(fs.readFileSync(vsPath, 'utf-8'));
      vs.isolation = 'on';
      fs.writeFileSync(vsPath, JSON.stringify(vs, null, 2));
    } catch (_) {}

    const targetLoaders = new Set();
    if (fabricVer) targetLoaders.add('fabric');
    if (forgeVer) targetLoaders.add('forge');
    if (neoforgeVer) targetLoaders.add('neoforge');
    let skippedByLoader = 0;
    const filesList = (manifest.files || []).filter((f) => {
      if (f.env && f.env.client === 'unsupported') return false;
      if (targetLoaders.size > 0 && Array.isArray(f.loaders) && f.loaders.length > 0) {
        const fileLoaders = f.loaders.map((l) => (l || '').toLowerCase());
        const compatible = [...targetLoaders].some((tl) => fileLoaders.includes(tl));
        if (!compatible) { skippedByLoader++; return false; }
      }
      return true;
    });
    const modsDir = path.join(versionDir, 'mods');
    utils.ensureDir(path.join(modsDir, 'dummy.txt'));

    // 清理上次导入失败留下的 .downloading 残留文件，避免续传死循环
    _cleanDownloadingResidue(versionDir);

    const modFiles = filesList.map((f) => {
      const downloads = f.downloads || [];
      const fileName = path.basename(f.path || (downloads[0] || 'unknown'));
      return { name: fileName, status: 'pending', progress: 0, size: f.fileSize || 0 };
    });

    progress('mods', `下载 Mod 文件 (共 ${filesList.length} 个)...`, 50, [...overrideFiles, ...modFiles], '');

    const _modsStartTime = Date.now();
    // mod 下载并发下限提升到 32（用户设置更低时取 32）
    // 实测 16→32→64：168s 是 32 并发最优，64 并发反而 193s（连接分摊单文件带宽变少，大文件长尾）
    const PARALLEL_MODS = Math.max(resolveConcurrency(settings), 32);
    utils._writeImportLog(`>>> [步骤5/5] 模组下载: 共 ${filesList.length} 个, 并发=${PARALLEL_MODS}`);
    let okCount = 0, failCount = 0;
    let inFlight = 0;
    const _modAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 60000, maxSockets: PARALLEL_MODS * 8 + 32, maxFreeSockets: PARALLEL_MODS * 4 + 16, timeout: 120000 });
    const _prevConnLimit = ctx.DownloadManager.connectionLimit;
    // 连接数上限 256，32 并发 * 8 = 256 连接
    ctx.DownloadManager.connectionLimit = Math.min(Math.max(PARALLEL_MODS * 8, 128), 256);
    const { update: updateOverall } = createProgressUpdater({
      modFiles,
      overrideFiles,
      modCount: filesList.length,
      progress,
      getDoneCount: () => okCount + failCount,
      getInFlight: () => inFlight
    });

    const dlMod = async (fileEntry, index) => {
      inFlight++;
      if (abortSignal && abortSignal.aborted) { inFlight--; updateOverall(); return; }
      const downloads = fileEntry.downloads || [];
      if (!downloads.length) {
        console.warn(`[mrpack] 模组 ${index + 1}/${filesList.length} 无下载链接，跳过`);
        if (modFiles[index]) { modFiles[index].status = 'failed'; modFiles[index].error = '无可用下载链接'; }
        failCount++; inFlight--; updateOverall();
        return;
      }

      const fileName = path.basename(fileEntry.path || (downloads[0] || 'unknown'));
      let destPath = path.join(versionDir, fileEntry.path || path.join('mods', fileName));
      utils.ensureDir(destPath);

      if (modFiles[index]) { modFiles[index].status = 'downloading'; modFiles[index].progress = 0; }
      updateOverall();

      if (fileEntry.fileSize > 0 && fs.existsSync(destPath)) {
        try {
          const st = fs.statSync(destPath);
          // 性能优化：用轻量 isJarIntact（ZIP 结构检查）替代 isJarIntactDeep（解压遍历所有条目）
          // isJarIntactDeep 是同步操作，会阻塞事件循环导致并发下载速度坍塌
          // 整合包导入结束时 _repairCorruptedModJars 会统一做深度校验和修复
          if (st.size === fileEntry.fileSize && utils.isJarIntact(destPath)) {
            // 进一步用 SHA1 校验确保文件完整（流式异步，不阻塞）
            const expectedSha1 = fileEntry.hashes && fileEntry.hashes.sha1;
            if (expectedSha1) {
              const actualSha1 = await utils.calculateSHA1(destPath);
              if (actualSha1 !== expectedSha1) {
                // SHA1 不匹配，继续走下载流程
              } else {
                if (modFiles[index]) { modFiles[index].status = 'completed'; modFiles[index].progress = 100; }
                okCount++; inFlight--; updateOverall();
                return;
              }
            } else {
              if (modFiles[index]) { modFiles[index].status = 'completed'; modFiles[index].progress = 100; }
              okCount++; inFlight--; updateOverall();
              return;
            }
          }
        } catch (_) {}
      }

      if (!utils.isJarIntact(destPath)) {
        const fileSize = fileEntry.fileSize || 0;
        let downloaded = false;
        const allUrls = [];
        for (const dl of downloads) {
          for (const mu of http.getMirrorUrls(dl)) {
            if (!allUrls.includes(mu)) allUrls.push(mu);
          }
        }

        const _modOnProgress = (p) => {
          if (p && modFiles[index]) {
            modFiles[index].progress = Math.round(p.progress || 0);
            modFiles[index].downloaded = p.downloaded || 0;
            modFiles[index].speed = p.speed || 0;
          }
          updateOverall();
        };
        const _modTimeout = computeModTimeout(fileSize);
        const expectedSha1 = fileEntry.hashes && fileEntry.hashes.sha1;

        const MAX_MR_ROUNDS = 3;
        for (let round = 0; round < MAX_MR_ROUNDS && !downloaded; round++) {
          if (abortSignal && abortSignal.aborted) break;
          if (round > 0) {
            if (modFiles[index]) { modFiles[index].status = 'downloading'; modFiles[index].progress = 0; }
            updateOverall();
            await new Promise((r) => setTimeout(r, 2000 + round * 2000 + Math.random() * 2000));
          }

          try {
            const raceResult = await http.downloadFileRace(allUrls, destPath, {
              onProgress: _modOnProgress,
              retries: 2,
              stallTimeout: 180000,
              abortSignal,
              timeout: _modTimeout
            });
            if (utils.isJarIntact(destPath)) {
              if (expectedSha1) {
                const actualSha1 = await utils.calculateSHA1(destPath);
                if (actualSha1 === expectedSha1) {
                  downloaded = true;
                } else {
                  console.warn(`[mrpack] SHA1校验失败(轮次${round + 1}/${MAX_MR_ROUNDS}): ${fileName}`);
                  try { fs.unlinkSync(destPath); } catch (_) {}
                }
              } else {
                downloaded = true;
              }
            } else {
              console.warn(`[mrpack] JAR结构损坏(轮次${round + 1}/${MAX_MR_ROUNDS}): ${fileName}`);
              try { fs.unlinkSync(destPath); } catch (_) {}
            }
          } catch (e) {
            if (abortSignal && abortSignal.aborted) break;
            console.warn(`[mrpack] ${fileName} XMCL下载失败(轮次${round + 1}/${MAX_MR_ROUNDS}): ${e.message.substring(0, 100)}`);
            try { fs.unlinkSync(destPath); } catch (_) {}
          }
        }

        if (downloaded) {
          if (modFiles[index]) { modFiles[index].status = 'completed'; modFiles[index].progress = 100; }
          okCount++;
        } else {
          try { const _tmpFile = destPath + '.downloading'; if (fs.existsSync(_tmpFile)) fs.unlinkSync(_tmpFile); } catch (_) {}
          if (abortSignal && abortSignal.aborted) {
            if (modFiles[index]) { modFiles[index].status = 'failed'; modFiles[index].error = '已取消'; }
          } else {
            console.error(`[mrpack] Mod ${fileName} 3轮重试均失败，无法下载`);
            if (modFiles[index]) { modFiles[index].status = 'failed'; modFiles[index].error = '下载失败'; }
          }
          failCount++;
          const totalAttempts = okCount + failCount;
          const failRatio = failCount / Math.max(totalAttempts, 1);
          if (failCount > Math.max(20, filesList.length * 0.4) && failRatio > 0.75) {
            console.error(`[mrpack] 失败率过高(${failCount}/${totalAttempts} = ${(failRatio * 100).toFixed(1)}%)，取消剩余下载`);
            if (abortSignal) try { abortSignal.abort(); } catch (_) {}
          }
        }
      } else {
        if (modFiles[index]) { modFiles[index].status = 'completed'; modFiles[index].progress = 100; }
        okCount++;
      }
      inFlight--;
      updateOverall();
    };

    let taskIdx = 0;
    const runNextMod = async () => {
      while (taskIdx < filesList.length) {
        if (abortSignal && abortSignal.aborted) break;
        const idx = taskIdx++;
        await dlMod(filesList[idx], idx);
      }
    };
    const pool = [];
    for (let p = 0; p < Math.min(PARALLEL_MODS, filesList.length); p++) {
      pool.push(runNextMod());
    }
    await Promise.all(pool);
    try { _modAgent.destroy(); } catch (_) {}
    ctx.DownloadManager.connectionLimit = _prevConnLimit;
    if (abortSignal && abortSignal.aborted) throw new Error('下载已取消');
    utils._writeImportLog(`<<< [步骤5/5] 模组下载完成: ${okCount}成功 ${failCount}失败, 耗时=${Math.round((Date.now() - _modsStartTime) / 1000)}s`);
    if (failCount > 0) {
      const failedNames = modFiles.filter((m) => m.status === 'failed').map((m) => m.name).join(', ');
      console.warn(`[mrpack] 失败的模组: ${failedNames}`);
    }

    progress('repair', '正在修复损坏的模组文件...', 88);
    const repairResult = await _repairCorruptedModJars(versionDir);
    if (repairResult.failed > 0) {
      console.warn(`[mrpack] ${repairResult.failed} 个模组文件损坏且无法修复，游戏启动时可能报错`);
    }

    // 保存 mod-manifest.json，记录整合包模组清单
    // 从 filesList 构造 manifestMods，包含 fileName/downloadUrl/sha1 等信息。
    try {
      const manifestMods = [];
      for (const f of filesList) {
        const downloads = f.downloads || [];
        const fileName = path.basename(f.path || (downloads[0] || 'unknown'));
        const modsFilePath = path.join(modsDir, fileName);
        // 只记录 mods 目录下实际存在的 jar 文件
        if (!fileName.toLowerCase().endsWith('.jar')) continue;
        if (!fs.existsSync(modsFilePath)) continue;
        // 从 JAR 解析 modId（用于后续校验内容是否被替换）
        let modId = null;
        try {
          modId = utils.readJarModId(modsFilePath);
        } catch (_) {}
        manifestMods.push({
          projectID: null,  // Modrinth 整合包没有 CurseForge projectID
          fileID: null,
          fileName,
          downloadUrl: downloads[0] || '',
          fileLength: f.fileSize || 0,
          sha1: (f.hashes && f.hashes.sha1) || '',
          modId
        });
      }
      _saveModManifest(versionDir, manifestMods);
      console.log(`[mrpack] 已保存 mod-manifest.json: ${manifestMods.length} 个 mod`);
    } catch (manifestErr) {
      console.warn(`[mrpack] 保存 mod-manifest.json 失败(非致命): ${manifestErr.message}`);
    }

    if (loaderVersionId && mcVersion) {
      const lt = fabricVer ? 'fabric' : (forgeVer || neoforgeVer ? 'forge' : null);
      const cv = fabricVer || forgeVer || neoforgeVer;
      if (lt && cv) {
        await modloaders.ensureLoaderCompat(versionId, versionDir, mcVersion, cv, lt, progress, abortSignal);
      }
    }

    progress('verify', '正在验证整合包完整性...', 90, [...overrideFiles, ...modFiles], '');
    const verifyResult = await modloaders.verifyImportLibs(versionId, progress, abortSignal);
    if (!verifyResult.ok) {
      console.error(`[mrpack] 库文件补全失败: ${verifyResult.missing} 个文件缺失`);
      versions.cleanupVersionChain(versionId);
      return { success: false, versionId, error: `整合包库文件补全失败: ${verifyResult.missing} 个文件缺失，请检查网络后重试` };
    }

    const mergedJson = versions.resolveVersionJson(versionId);

    if (mergedJson && mergedJson.assetIndex) {
      progress('assets', '正在下载游戏资源...', 93, [], '');
      try {
        const assetIndexInfo = mergedJson.assetIndex;
        const assetIndexPath = path.join(ctx.dirs.ASSETS_DIR, 'indexes', `${assetIndexInfo.id}.json`);
        if (!fs.existsSync(assetIndexPath) || (assetIndexInfo.sha1 && !(await utils.verifyFileSha1(assetIndexPath, assetIndexInfo.sha1)))) {
          const idxDir = path.dirname(assetIndexPath);
          if (!fs.existsSync(idxDir)) fs.mkdirSync(idxDir, { recursive: true });
          if (fs.existsSync(assetIndexPath)) fs.unlinkSync(assetIndexPath);
          await http.downloadFileWithMirror(assetIndexInfo.url, assetIndexPath);
        }
        if (fs.existsSync(assetIndexPath)) {
          const assetIndexData = JSON.parse(fs.readFileSync(assetIndexPath, 'utf-8'));
          const assetObjects = assetIndexData.objects || {};
          const assetEntries = Object.entries(assetObjects);
          let missingAssets = [];
          for (const [name, info] of assetEntries) {
            const hash = info.hash;
            const subDir = hash.substring(0, 2);
            const assetPath = path.join(ctx.dirs.ASSETS_DIR, 'objects', subDir, hash);
            if (!fs.existsSync(assetPath)) {
              missingAssets.push({ name, hash, subDir, size: info.size });
            }
          }
          if (missingAssets.length > 0) {
            const ASSET_PARALLEL = Math.min(parseInt(settings.maxThreads, 10) || 64, 64);
            let assetDone = 0;
            const assetTotal = missingAssets.length;
            progress('assets', `下载游戏资源 (0/${assetTotal})`, 93, [], '');
            const runAssetBatch = async () => {
              while (missingAssets.length > 0) {
                if (abortSignal && abortSignal.aborted) break;
                const asset = missingAssets.pop();
                const targetDir = path.join(ctx.dirs.ASSETS_DIR, 'objects', asset.subDir);
                if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
                const targetPath = path.join(targetDir, asset.hash);
                try {
                  await http.downloadFileWithMirror(`https://resources.download.minecraft.net/${asset.subDir}/${asset.hash}`, targetPath);
                } catch (e) {
                  console.warn(`[mrpack] 资源 ${asset.name} 下载失败: ${e.message}`);
                }
                assetDone++;
                const pct = 93 + Math.round((assetDone / assetTotal) * 4);
                progress('assets', `下载游戏资源 (${assetDone}/${assetTotal})`, Math.min(pct, 97), [], '');
              }
            };
            const assetPool = [];
            for (let i = 0; i < Math.min(ASSET_PARALLEL, assetTotal); i++) assetPool.push(runAssetBatch());
            await Promise.all(assetPool);
            progress('assets', `游戏资源下载完成 (${assetTotal}/${assetTotal})`, 97, [], '');
          }
        }
      } catch (e) {
        console.warn(`[mrpack] 资源下载异常(非致命): ${e.message}`);
      }
    }

    if (mergedJson && mergedJson.inheritsFrom) {
      const mainJarId = mergedJson.jar || mergedJson.inheritsFrom;
      const mainJarPath = path.join(ctx.dirs.VERSIONS_DIR, mainJarId, `${mainJarId}.jar`);
      if (!fs.existsSync(mainJarPath)) {
        let jarUrl = mergedJson.downloads?.client?.url;
        if (!jarUrl) {
          try {
            const baseJsonPath = path.join(ctx.dirs.VERSIONS_DIR, mainJarId, `${mainJarId}.json`);
            if (fs.existsSync(baseJsonPath)) {
              const baseJson = JSON.parse(fs.readFileSync(baseJsonPath, 'utf8'));
              jarUrl = baseJson?.downloads?.client?.url;
            }
          } catch (_) {}
        }
        if (jarUrl) {
          progress('assets', '正在下载客户端JAR...', 97, [], '');
          let jarOk = false;
          for (let jarAttempt = 0; jarAttempt < 3 && !jarOk; jarAttempt++) {
            try {
              const jarDir = path.dirname(mainJarPath);
              if (!fs.existsSync(jarDir)) fs.mkdirSync(jarDir, { recursive: true });
              await http.downloadFileWithMirror(jarUrl, mainJarPath);
              jarOk = true;
            } catch (e) {
              console.warn(`[mrpack] 客户端JAR下载失败(${jarAttempt + 1}/3): ${e.message}`);
              try { if (fs.existsSync(mainJarPath)) fs.unlinkSync(mainJarPath); } catch (_) {}
              if (jarAttempt < 2) await new Promise((r) => setTimeout(r, 2000));
            }
          }
          if (!jarOk) console.warn(`[mrpack] 客户端JAR下载最终失败(非致命)，启动时会自动补全`);
        }
      }
    }
    if (mergedJson && forgeVer) {
      const forgeCoreCheck = [];
      const mergedLibs = mergedJson.libraries || [];
      const forgeClientLib = mergedLibs.find((l) =>
        l.name && /^net\.minecraftforge:forge:\d/.test(l.name) &&
        (l.name.endsWith(':client') || l.name.split(':').length === 3));
      const srgLib = mergedLibs.find((l) =>
        l.name && l.name.startsWith('net.minecraft:client:') && l.name.endsWith(':srg'));
      const extraLib = mergedLibs.find((l) =>
        l.name && l.name.startsWith('net.minecraft:client:') && l.name.endsWith(':extra'));

      const coreDir = (fp) => path.join(ctx.dirs.LIBRARIES_DIR, fp[0].replace(/\./g, path.sep), fp[1], fp[2]);
      if (forgeClientLib) {
        const fp = forgeClientLib.name.split(':');
        const cl = fp.length >= 4 ? `-${fp[3]}` : '';
        const p = path.join(coreDir(fp), `${fp[1]}-${fp[2]}${cl}.jar`);
        if (!fs.existsSync(p) || !utils.isJarIntact(p)) forgeCoreCheck.push({ name: `forge-client.jar`, path: p });
      }
      if (srgLib) {
        const sp = srgLib.name.split(':');
        const p = path.join(coreDir(sp), `${sp[1]}-${sp[2]}-srg.jar`);
        if (!fs.existsSync(p) || !utils.isJarIntact(p)) forgeCoreCheck.push({ name: `client-srg.jar`, path: p });
      }
      if (extraLib) {
        const ep = extraLib.name.split(':');
        const p = path.join(coreDir(ep), `${ep[1]}-${ep[2]}-extra.jar`);
        if (!fs.existsSync(p) || !utils.isJarIntact(p)) forgeCoreCheck.push({ name: `client-extra.jar`, path: p });
      }

      if (forgeCoreCheck.length > 0) {
        const missingNames = forgeCoreCheck.map((f) => f.name).join(', ');
        console.error(`[mrpack] Forge核心文件验证失败: 缺失 ${forgeCoreCheck.length} 个文件: ${missingNames}`);
        for (const f of forgeCoreCheck) {
          console.error(`[mrpack]   缺失: ${f.path}`);
        }
        versions.cleanupVersionChain(versionId);
        return {
          success: false, versionId,
          error: `Forge核心文件生成失败: 缺失 ${missingNames}。\n请检查Java环境是否正常，网络是否畅通，然后重试。\n缺失文件路径:\n${forgeCoreCheck.map((f) => f.path).join('\n')}`
        };
      }
    }

    const packInfo = {
      name: packName, versionId: versionId, mcVersion, packFormat: 'mrpack',
      fabricVersion: fabricVer, forgeVersion: forgeVer, neoforgeVersion: neoforgeVer,
      importedAt: new Date().toISOString(), sourceFile: filePath,
      targetVersion: targetVersion || ''
    };
    fs.writeFileSync(path.join(versionDir, 'pack-info.json'), JSON.stringify(packInfo, null, 2));

    // 保存 mrpack 原始清单到版本目录，供启动前的 mods 完整性检查使用
    // 缺失 mods 时 checkDependencies 会自动补下，避免"导入成功但实际少文件"的盲区
    try {
      const manifestForCheck = {
        format: manifest.format || 1,
        game: manifest.game || 'minecraft',
        versionId: manifest.versionId || '',
        name: manifest.name || packName,
        dependencies: manifest.dependencies || {},
        files: (manifest.files || []).filter((f) => {
          // 只保留 mods 目录下实际存在的文件
          if (!f.path) return true; // 非 mods 文件（如 shaderpacks）保留
          const fp = path.join(versionDir, f.path);
          return fs.existsSync(fp);
        }).map((f) => ({
          path: f.path,
          hashes: f.hashes || {},
          downloads: f.downloads || [],
          fileSize: f.fileSize || 0
        }))
      };
      fs.writeFileSync(path.join(versionDir, 'mrpack-manifest.json'), JSON.stringify(manifestForCheck, null, 2));
    } catch (e) {
      console.warn(`[mrpack] 保存清单文件失败(非致命): ${e.message}`);
    }

    if (_backupDir && fs.existsSync(_backupDir)) {
      try { fs.rmSync(_backupDir, { recursive: true, force: true }); } catch (e) {}
    }

    progress('done', `整合包 "${packName}" 导入完成！`, 100);
    // [CRITICAL - 2026-06-21] mod下载失败时不能返回success:true！
    // 之前mod下载失败后仍然返回成功，导致用户看到"下载成功"但游戏启动就崩溃。
    // 现在根据失败比例决定：超过10%或超过5个mod失败则返回失败，让用户重试。
    const failThreshold = Math.max(5, Math.floor(filesList.length * 0.1));
    if (failCount > 0 && failCount >= failThreshold) {
      const failedModNames = modFiles.filter((m) => m.status === 'failed').map((m) => m.name).join(', ');
      const errorMsg = `${failCount}/${filesList.length} 个Mod下载失败（阈值${failThreshold}），整合包不完整无法正常运行。失败的Mod: ${failedModNames}。请检查网络后重试。`;
      console.error(`[mrpack] 导入失败: ${errorMsg}`);
      versions.cleanupVersionChain(versionId);
      return { success: false, versionId, error: errorMsg, failedMods: modFiles.filter((m) => m.status === 'failed') };
    }
    if (failCount > 0) {
      const failedModNames = modFiles.filter((m) => m.status === 'failed').map((m) => m.name).join(', ');
      const warningMsg = `${failCount}/${filesList.length} 个Mod下载失败: ${failedModNames}。请在内部浏览器中手动下载缺失的Mod，或检查网络后重试。`;
      return { success: true, name: packName, versionId, mcVersion, targetVersion: targetVersion || '', warning: warningMsg, failedMods: modFiles.filter((m) => m.status === 'failed'), loaderVersionId: loaderVersionId || null };
    }
    return { success: true, name: packName, versionId, mcVersion, targetVersion: targetVersion || '', loaderVersionId: loaderVersionId || null };
  } catch (e) {
    console.error('[mrpack] 导入失败:', e);
    if (_backupDir) {
      try {
        const restoredModsDir = path.join(_backupDir, 'mods');
        if (fs.existsSync(restoredModsDir)) {
          const currentModsDir = path.join(versionDir, 'mods');
          if (fs.existsSync(currentModsDir)) fs.rmSync(currentModsDir, { recursive: true, force: true });
          fs.cpSync(restoredModsDir, currentModsDir, { recursive: true });
        }
        fs.rmSync(_backupDir, { recursive: true, force: true });
      } catch (rbErr) {
        console.error(`[mrpack] 回滚失败: ${rbErr.message}`);
      }
    }
    versions.cleanupVersionChain(versionId);
    return { success: false, versionId, error: e.message || '未知错误' };
  }
  if (_backupDir) {
    try { fs.rmSync(_backupDir, { recursive: true, force: true }); } catch (_) {}
  }
}

module.exports = { _importMrpack };
