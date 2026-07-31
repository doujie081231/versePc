/**
 * @file server/versions/version-list.js - 版本列表读取、扫描、清理、完整性校验
 * @description 含已安装版本列表读取/保存、外部目录扫描（scanExternalFolder）、
 *   版本链查找与清理、完整性校验、版本类型修正等。
 */

const { fs, path, ctx, loadExternalFolders } = require('./shared');
const { findVersionJson, detectVersionInfo, _findVersionJsonInAnyDir, resolveVersionJson, findMainJar } = require('./version-parse');
const { loadVersionSettings } = require('./version-settings');
const { filterVersionsByVisibility } = require('./version-filter');

/* 本地状态 */
let _versionsDirWatcher = null;

/**
 * 监听 versions 目录变化，失效缓存
 */
function watchVersionsDir() {
  if (_versionsDirWatcher) return;
  if (!fs.existsSync(ctx.dirs.VERSIONS_DIR)) return;
  try {
    _versionsDirWatcher = fs.watch(ctx.dirs.VERSIONS_DIR, { persistent: false }, (eventType) => {
      ctx.caches._versionsCache = null;
      ctx.caches._versionsCacheTime = 0;
    });
    _versionsDirWatcher.on('error', () => {
      _versionsDirWatcher = null;
      setTimeout(watchVersionsDir, 10000);
    });
  } catch (e) {}
}

/**
 * 读取已安装版本列表数据文件
 * @returns {Array} 版本列表，读取失败返回空数组
 */
function loadVersions() {
  try {
    if (fs.existsSync(ctx.dirs.VERSIONS_DATA_FILE)) {
      return JSON.parse(fs.readFileSync(ctx.dirs.VERSIONS_DATA_FILE, 'utf-8'));
    }
  } catch (e) {}
  return [];
}

/**
 * 保存版本列表数据到磁盘
 * @param {Array} versionsData - 版本列表数据
 */
function saveVersions(versionsData) {
  fs.writeFileSync(ctx.dirs.VERSIONS_DATA_FILE, JSON.stringify(versionsData, null, 2));
}

/**
 * 查找版本链：包括指定版本、其所有父版本，以及继承自该链的其它版本
 * @param {string} versionId - 版本 ID
 * @returns {Array<string>} 版本链
 */
function findVersionChain(versionId) {
  const chain = [];
  const visited = new Set();

  const addWithParents = (id) => {
    if (visited.has(id)) return;
    visited.add(id);
    chain.push(id);
    const dir = path.join(ctx.dirs.VERSIONS_DIR, id);
    const jp = findVersionJson(dir);
    if (!jp) return;
    try {
      const data = JSON.parse(fs.readFileSync(jp, 'utf-8'));
      if (data.inheritsFrom && !visited.has(data.inheritsFrom)) {
        addWithParents(data.inheritsFrom);
      }
    } catch (_) {}
  };

  addWithParents(versionId);

  if (!fs.existsSync(ctx.dirs.VERSIONS_DIR)) return chain;
  try {
    const allDirs = fs.readdirSync(ctx.dirs.VERSIONS_DIR);
    for (const dir of allDirs) {
      if (visited.has(dir)) continue;
      const verDir = path.join(ctx.dirs.VERSIONS_DIR, dir);
      try { if (!fs.statSync(verDir).isDirectory()) continue; } catch (_) { continue; }
      const jp = findVersionJson(verDir);
      if (!jp) continue;
      try {
        const data = JSON.parse(fs.readFileSync(jp, 'utf-8'));
        const parentId = data.inheritsFrom;
        if (parentId) {
          let ancestor = parentId;
          let depth = 0;
          const ancestors = new Set();
          while (ancestor && depth < 10) {
            ancestors.add(ancestor);
            if (visited.has(ancestor)) {
              visited.add(dir);
              chain.push(dir);
              break;
            }
            const aDir = path.join(ctx.dirs.VERSIONS_DIR, ancestor);
            const aJp = findVersionJson(aDir);
            if (!aJp) break;
            try {
              const aData = JSON.parse(fs.readFileSync(aJp, 'utf-8'));
              ancestor = aData.inheritsFrom || null;
            } catch (_) { break; }
            depth++;
          }
        }
      } catch (_) {}
    }
  } catch (_) {}

  return chain;
}

/**
 * 清理版本链：删除指定版本及其相关版本（保留原版基础版本）
 * @param {string} versionId - 版本 ID
 * @returns {Object} { toDelete: 要删除的版本列表, results: 删除结果 }
 */
function cleanupVersionChain(versionId) {
  const chain = findVersionChain(versionId);
  const vanillaPattern = /^\d+\.\d+(\.\d+)?(-rc\d+|-pre\d+|-snapshot.*)?$/i;
  const toDelete = [];
  for (const id of chain) {
    if (vanillaPattern.test(id) && id !== versionId) {
      continue;
    }
    toDelete.push(id);
  }
  if (!toDelete.includes(versionId)) toDelete.push(versionId);

  const results = [];
  for (const id of toDelete) {
    const dir = path.join(ctx.dirs.VERSIONS_DIR, id);
    if (!fs.existsSync(dir)) {
      results.push({ id, deleted: true, reason: '目录不存在' });
      continue;
    }
    let deleted = false;
    // 最多重试 5 次删除（文件可能被占用）
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
        deleted = true;
        break;
      } catch (e) {
        console.error(`[Cleanup] 删除 ${id} 失败 (第${attempt}次): ${e.message}`);
        if (attempt < 5) {
          const delayMs = attempt * 1000;
          const start = Date.now();
          while (Date.now() - start < delayMs) {}
        }
      }
    }
    results.push({ id, deleted, reason: deleted ? '' : '文件可能被占用，请关闭游戏后重试' });
  }

  return { toDelete, results };
}

/**
 * 删除不完整的版本目录（下载失败后清理）
 * @param {string} versionDir - 版本目录路径
 */
function cleanupIncompleteVersion(versionDir) {
  if (!fs.existsSync(versionDir)) return;
  try {
    fs.rmSync(versionDir, { recursive: true, force: true });
  } catch (e) {
    console.error(`[Cleanup] 删除失败: ${versionDir} - ${e.message}`);
  }
}

/**
 * 检查版本是否完整：父版本 JSON、主 JAR、Forge 核心库是否齐全
 * @param {string} versionId - 版本 ID
 * @returns {boolean} 完整返回 true
 */
function isVersionComplete(versionId) {
  const versionJson = resolveVersionJson(versionId);
  if (!versionJson) return false;

  if (versionJson.inheritsFrom) {
    const extFolders = loadExternalFolders();
    let parentJsonFound = false;
    const parentJsonSearchPaths = [];
    for (const folder of extFolders) {
      if (fs.existsSync(path.join(folder.path, 'versions', versionJson.inheritsFrom, `${versionJson.inheritsFrom}.json`))) {
        parentJsonSearchPaths.push(path.join(folder.path, 'versions', versionJson.inheritsFrom, `${versionJson.inheritsFrom}.json`));
      }
    }
    parentJsonSearchPaths.push(path.join(ctx.dirs.VERSIONS_DIR, versionJson.inheritsFrom, `${versionJson.inheritsFrom}.json`));
    for (const p of parentJsonSearchPaths) {
      if (fs.existsSync(p)) { parentJsonFound = true; break; }
    }
    if (!parentJsonFound) return false;

    if (!versionJson.jar) {
      const mainJarPath = findMainJar(versionJson, versionId);
      if (!mainJarPath || !fs.existsSync(mainJarPath)) return false;
    }
  }

  const mainJarPath = path.join(ctx.dirs.VERSIONS_DIR, versionId, `${versionId}.jar`);
  if (!versionJson.inheritsFrom && !fs.existsSync(mainJarPath)) return false;

  // Forge 版本链：检查核心库是否齐全
  const _vLower = versionId.toLowerCase();
  const _isNeoForge = _vLower.includes('neoforge') || _vLower.includes('neoforged');
  const isForgeChain = (_vLower.includes('forge') && !_isNeoForge) ||
    (versionJson.inheritsFrom && versionJson.inheritsFrom.toLowerCase().includes('forge') && !versionJson.inheritsFrom.toLowerCase().includes('neoforge'));
  if (isForgeChain && versionJson.libraries) {
    let forgeCoreMissing = 0;
    const mcVer = versionJson.inheritsFrom || '';
    const mcMajor = parseInt((mcVer.split('.')[1] || '0'), 10);
    const isNewForgeFormat = mcMajor >= 20;
    for (const lib of versionJson.libraries) {
      if (!lib.name) continue;
      const fp = lib.name.split(':');
      if (fp.length < 3) continue;
      const gp = fp[0].replace(/\./g, path.sep);
      const cl = fp.length >= 4 ? `-${fp[3]}` : '';
      const jn = `${fp[1]}-${fp[2]}${cl}.jar`;
      const localPath = path.join(ctx.dirs.LIBRARIES_DIR, gp, fp[1], fp[2], jn);
      let found = fs.existsSync(localPath);
      if (!found) {
        const extFolders = loadExternalFolders();
        for (const folder of extFolders) {
          const extPath = path.join(folder.path, 'libraries', gp, fp[1], fp[2], jn);
          if (fs.existsSync(extPath)) { found = true; break; }
        }
      }
      const isOldFormatSrgOrExtra = fp[0] === 'net.minecraft' && fp[1] === 'client' && (fp[3] === 'srg' || fp[3] === 'extra');
      if (isNewForgeFormat && isOldFormatSrgOrExtra) continue;
      const isForgeCore = (
        (fp[0] === 'net.minecraftforge' && fp[1] === 'forge') ||
        isOldFormatSrgOrExtra
      );
      if (isForgeCore && !found) {
        forgeCoreMissing++;
      }
    }
    if (forgeCoreMissing > 0) {
      return false;
    }
  }

  return true;
}

/**
 * 启动时验证已安装版本完整性，记录损坏版本
 */
function validateInstalledVersions() {
  if (!fs.existsSync(ctx.dirs.VERSIONS_DIR)) return;

  const issues = [];
  try {
    const dirs = fs.readdirSync(ctx.dirs.VERSIONS_DIR);
    for (const dir of dirs) {
      const versionDir = path.join(ctx.dirs.VERSIONS_DIR, dir);
      try {
        if (!fs.statSync(versionDir).isDirectory()) continue;
      } catch (e) { continue; }

      const jsonFile = findVersionJson(versionDir);
      if (!jsonFile) {
        issues.push({ dir, reason: '版本 JSON 文件缺失' });
        continue;
      }

      try {
        JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
      } catch (e) {
        issues.push({ dir, reason: `版本 JSON 损坏: ${e.message}` });
      }
    }
  } catch (e) {
    console.error(`[Startup] 版本扫描失败: ${e.message}`);
  }
}

/**
 * 从整合包 JSON 内容判断实际加载器类型
 * @param {object} modpackData - 整合包 JSON 对象
 * @returns {'Fabric'|'Forge'|'NeoForge'|null} 加载器类型，无法判断返回 null
 */
function _detectModpackLoader(modpackData) {
  if (!modpackData) return null;
  const libsStr = JSON.stringify(modpackData.libraries || []).toLowerCase();
  const mainClass = (modpackData.mainClass || '').toLowerCase();
  const gameArgs = JSON.stringify(modpackData.arguments?.game || []).toLowerCase();
  // 优先用 libraries 中的加载器特有库判断（最准确）
  const hasFabricLib = libsStr.includes('net.fabricmc') || libsStr.includes('org.quiltmc:quilt-loader');
  const hasNeoForgeLib = libsStr.includes('net.neoforged') || libsStr.includes('neoforged.fancymodloader');
  const hasForgeLib = libsStr.includes('net.minecraftforge') || libsStr.includes('fancymodloader');
  if (hasFabricLib) return 'Fabric';
  if (hasNeoForgeLib) return 'NeoForge';
  if (hasForgeLib) return 'Forge';
  // 其次用 mainClass 判断（注意 fabric/forge 关键词可能误匹配，用更精确的特征）
  if (mainClass.includes('net.fabricmc') || mainClass.includes('org.quiltmc')) return 'Fabric';
  if (mainClass.includes('neoforged') || mainClass.includes('neoforge')) return 'NeoForge';
  if (mainClass.includes('bootstraplauncher') || mainClass.includes('modlauncher')) return 'Forge';
  // 最后用 gameArgs 中的 FML 参数判断
  if (gameArgs.includes('--fml.neoforgeversion')) return 'NeoForge';
  if (gameArgs.includes('--fml.forgeversion')) return 'Forge';
  // 整合包 JSON 是继承式（只有 id 和 inheritsFrom，无 libraries/mainClass）时无法判断
  return null;
}

/**
 * 修正整合包的 inheritsFrom：把指向原版基础版本的引用改为指向已安装的加载器版本
 * @param {Array} installed - 已安装版本列表
 * @param {RegExp} loaderIdPattern - 加载器 ID 正则
 */
function fixModpackInheritsFrom(installed, loaderIdPattern) {
  const bareMcVersionPattern = /^\d+\.\d+(\.\d+)?$/;
  for (const v of installed) {
    if (!v.inheritsFrom || v.isExternal) continue;
    if (loaderIdPattern.test(v.id)) continue;
    if (v.isForge || v.isFabric || v.isNeoForge || v.isOptiFine || v.isLiteLoader) continue;
    if (!bareMcVersionPattern.test(v.inheritsFrom)) continue;
    const baseMcId = v.inheritsFrom;
    const candidates = installed.filter((l) =>
      l.inheritsFrom === baseMcId &&
      !l.isExternal &&
      l.id !== v.id &&
      (l.isForge || l.isFabric || l.isNeoForge || l.isOptiFine || l.isLiteLoader)
    );
    if (candidates.length === 0) continue;
    const modpackJsonPath = path.join(ctx.dirs.VERSIONS_DIR, v.id, `${v.id}.json`);
    if (!fs.existsSync(modpackJsonPath)) continue;
    let modpackData = null;
    try {
      modpackData = JSON.parse(fs.readFileSync(modpackJsonPath, 'utf-8'));
    } catch (e) { continue; }
    if (modpackData.inheritsFrom !== baseMcId) continue;

    // 根据整合包 JSON 内容判断实际加载器类型
    const detectedLoader = _detectModpackLoader(modpackData);
    let parentLoader = null;
    if (detectedLoader) {
      // 能确定加载器类型：选择匹配的候选
      if (detectedLoader === 'Fabric') parentLoader = candidates.find((c) => c.isFabric);
      else if (detectedLoader === 'NeoForge') parentLoader = candidates.find((c) => c.isNeoForge);
      else if (detectedLoader === 'Forge') parentLoader = candidates.find((c) => c.isForge);
      // 候选中没有匹配类型时不修改（避免把 Fabric 整合包硬塞给 Forge）
    } else if (candidates.length === 1) {
      // 无法判断加载器类型，且只有一个候选：使用该候选
      // （单候选场景：用户只装了一个加载器，整合包大概率就是这个加载器）
      parentLoader = candidates[0];
    }
    // 无法判断且多候选时：不修改 inheritsFrom，保持原样
    // 旧逻辑会默认取 candidates[0]，可能把 Fabric 整合包错误指向 Forge
    // 保持原样让启动时 resolveVersionJson 沿继承链合并处理，更安全

    if (!parentLoader) continue;
    try {
      modpackData.inheritsFrom = parentLoader.id;
      fs.writeFileSync(modpackJsonPath, JSON.stringify(modpackData, null, 2));
      v.inheritsFrom = parentLoader.id;
    } catch (e) {}
  }
}

/**
 * 修正版本类型：识别愚人节版本、把误判为快照的正式版改回 release
 * @param {Object} v - 版本对象
 * @returns {string} 修正后的类型
 */
function correctVersionType(v) {
  const id = v.id || '';
  const idLower = id.toLowerCase();
  const type = v.type || 'release';

  if (ctx.constants.APRIL_FOOLS_IDS.has(idLower)) {
    return 'special';
  }

  // 1.x 且非 combat/rc/experimental/pre 的快照应为正式版
  if (type === 'snapshot' || type === 'pending') {
    if (id.startsWith('1.') &&
      !idLower.includes('combat') &&
      !idLower.includes('rc') &&
      !idLower.includes('experimental') &&
      !idLower.includes('pre') &&
      idLower !== '1.2') {
      return 'release';
    }
  }

  // 发布时间在 4 月 1 日（UTC+2）附近的快照视为愚人节特殊版本
  if (type === 'snapshot' || type === 'pending') {
    if (v.releaseTime) {
      try {
        const d = new Date(v.releaseTime);
        const utc2 = new Date(d.getTime() + 2 * 3600 * 1000);
        if (utc2.getUTCMonth() === 3 && utc2.getUTCDate() === 1) {
          return 'special';
        }
      } catch (_) {}
    }
  }

  return type;
}

/**
 * 扫描外部文件夹下的 versions 目录，返回该目录中所有可识别的版本
 * @param {string} folderPath - 外部文件夹根路径
 * @returns {Array<object>} 版本信息数组（每个元素含 isExternal: true）
 */
function scanExternalFolder(folderPath) {
  const versions = [];
  const versionsDir = path.join(folderPath, 'versions');
  if (!fs.existsSync(versionsDir)) return versions;
  // 跳过已知非版本目录，避免误扫描
  const skipFolders = new Set(['cache', 'blclient', 'pcl', 'temp']);
  try {
    const dirs = fs.readdirSync(versionsDir);
    for (const dir of dirs) {
      const versionDir = path.join(versionsDir, dir);
      try {
        if (!fs.statSync(versionDir).isDirectory()) continue;
        if (skipFolders.has(dir.toLowerCase())) continue;
        const hasAnyFile = fs.readdirSync(versionDir).some((f) => !f.startsWith('.'));
        if (!hasAnyFile) continue;
      } catch (e) { continue; }
      const jsonFile = findVersionJson(versionDir);
      if (!jsonFile) {
        // 无版本 JSON：标记为错误版本
        versions.push({
          id: dir, type: 'release', installed: true,
          externalPath: folderPath, externalVersionDir: versionDir, isExternal: true,
          error: true, errorReason: '版本 JSON 文件缺失',
          inheritsFrom: null, isFabric: false, isForge: false, isNeoForge: false,
          isOptiFine: false, isLiteLoader: false, isModpack: false, modpackLoader: '',
          baseVersion: '', isAprilFools: false, hasMods: false, hasSaves: false, hasResourcepacks: false,
          customName: '', description: ''
        });
        continue;
      }
      try {
        const data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
        const info = detectVersionInfo(data, dir);
        let inheritsFrom = data.inheritsFrom || null;
        // NeoForge/Forge 缺 inheritsFrom 时，从 ID 中提取基础 MC 版本补全
        if (!inheritsFrom && (info.isNeoForge || info.isForge)) {
          const m = (data.id || dir).match(/^(\d+\.\d+(?:\.\d+)?(?:-rc\d+|-pre\d+|-snapshot.*)?)/i);
          if (m) inheritsFrom = m[1];
        }
        if (inheritsFrom && !data.inheritsFrom) data.inheritsFrom = inheritsFrom;
        let error = false;
        let errorReason = '';
        if (inheritsFrom) {
          const parentJson = _findVersionJsonInAnyDir(inheritsFrom);
          if (!parentJson) {
            // 前置缺失：若自身是 Forge/NeoForge 且带 mainClass 或加载器库，则视为可用
            const hasMainClass = !!data.mainClass;
            const hasLibraries = Array.isArray(data.libraries) && data.libraries.length > 0;
            const hasForgeLibs = hasLibraries && data.libraries.some((l) => l.name && (
              l.name.includes('net.minecraftforge') || l.name.includes('fancymodloader') ||
              l.name.includes('net.neoforged') || l.name.includes('fabric-loader')
            ));
            if ((info.isForge || info.isNeoForge) && (hasMainClass || hasForgeLibs)) {
            } else {
              error = true;
              errorReason = `需要安装 ${inheritsFrom} 作为前置版本`;
            }
          }
        }
        if (!error && !data.mainClass && (!data.libraries || !Array.isArray(data.libraries) || data.libraries.length === 0)) {
          error = true;
          errorReason = `无法识别：初始化版本 JSON 时失败 (${dir})`;
        }
        const hasModsDir = fs.existsSync(path.join(versionDir, 'mods'));
        const hasSavesDir = fs.existsSync(path.join(versionDir, 'saves'));
        const hasResourcepacksDir = fs.existsSync(path.join(versionDir, 'resourcepacks'));
        versions.push({
          id: data.id || dir,
          type: info.isAprilFools ? 'special' : (data.type || 'release'),
          releaseTime: data.releaseTime || '',
          mainClass: data.mainClass || '',
          installed: true,
          inheritsFrom: inheritsFrom,
          isFabric: info.isFabric,
          isForge: info.isForge,
          isNeoForge: info.isNeoForge,
          isOptiFine: info.isOptiFine,
          isLiteLoader: info.isLiteLoader,
          isModpack: info.isModpack,
          modpackLoader: info.modpackLoader,
          baseVersion: info.baseVersion,
          isAprilFools: info.isAprilFools || false,
          externalPath: folderPath,
          externalVersionDir: versionDir,
          isExternal: true,
          isolation: true,
          hasMods: hasModsDir,
          hasSaves: hasSavesDir,
          hasResourcepacks: hasResourcepacksDir,
          error: error,
          errorReason: errorReason,
          // 内联读取版本自定义设置（customName/description），失败则返回空对象
          ...(function () {
            try {
              const vs = loadVersionSettings(data.id || dir);
              return { customName: vs.customName || '', description: vs.description || '' };
            } catch (e) { return {}; }
          })()
        });
      } catch (e) {
        versions.push({
          id: dir, type: 'release', installed: true,
          externalPath: folderPath, externalVersionDir: versionDir, isExternal: true,
          error: true, errorReason: `版本 JSON 损坏: ${e.message}`,
          inheritsFrom: null, isFabric: false, isForge: false, isNeoForge: false,
          isOptiFine: false, isLiteLoader: false, isModpack: false, modpackLoader: '',
          baseVersion: '', isAprilFools: false, hasMods: false, hasSaves: false, hasResourcepacks: false,
          customName: '', description: ''
        });
      }
    }
  } catch (e) {}
  return versions;
}

/**
 * 获取已安装版本列表：扫描内部和外部目录，识别加载器类型，隐藏被引用的原版基础版本
 * @param {boolean} forceRefresh - 是否强制刷新缓存
 * @returns {Array} 已安装版本列表
 */
function getInstalledVersions(forceRefresh) {
  const now = Date.now();
  if (!forceRefresh && ctx.caches._versionsCache && (now - ctx.caches._versionsCacheTime) < ctx.caches.VERSIONS_CACHE_TTL) {
    return ctx.caches._versionsCache;
  }
  const installed = [];
  if (fs.existsSync(ctx.dirs.VERSIONS_DIR)) {
    const skipFolders = new Set(['cache', 'blclient', 'pcl', 'temp']);
    try {
      const dirs = fs.readdirSync(ctx.dirs.VERSIONS_DIR);
      for (const dir of dirs) {
        const versionDir = path.join(ctx.dirs.VERSIONS_DIR, dir);
        try {
          if (!fs.statSync(versionDir).isDirectory()) continue;
          if (skipFolders.has(dir.toLowerCase())) continue;
        } catch (e) { continue; }
        const jsonFile = findVersionJson(versionDir);
        if (jsonFile) {
          try {
            const data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
            const info = detectVersionInfo(data, dir);
            let inheritsFrom = data.inheritsFrom || null;
            if (!inheritsFrom && (info.isNeoForge || info.isForge)) {
              const m = (data.id || dir).match(/^(\d+\.\d+(?:\.\d+)?(?:-rc\d+|-pre\d+|-snapshot.*)?)/i);
              if (m) inheritsFrom = m[1];
            }
            if (inheritsFrom && !data.inheritsFrom) data.inheritsFrom = inheritsFrom;
            installed.push({
              id: data.id || dir,
              type: info.isAprilFools ? 'special' : (data.type || 'release'),
              releaseTime: data.releaseTime || '',
              mainClass: data.mainClass || '',
              installed: true,
              inheritsFrom: inheritsFrom,
              isFabric: info.isFabric,
              isForge: info.isForge,
              isNeoForge: info.isNeoForge,
              isOptiFine: info.isOptiFine,
              isLiteLoader: info.isLiteLoader,
              isModpack: info.isModpack,
              modpackLoader: info.modpackLoader,
              baseVersion: info.baseVersion,
              isAprilFools: info.isAprilFools || false,
              isExternal: false,
              isolation: true,
              hasMods: false,
              hasSaves: false,
              hasResourcepacks: false,
              error: false,
              errorReason: '',
              customName: '',
              description: ''
            });
          } catch (e) {
          }
        } else {
        }
      }
    } catch (e) {}
  }

  // 扫描外部目录中的版本
  const externalFolders = loadExternalFolders();
  for (const folder of externalFolders) {
    if (!fs.existsSync(folder.path)) continue;
    const externalVersions = scanExternalFolder(folder.path);
    for (const ev of externalVersions) {
      const existingIdx = installed.findIndex((v) => v.id === ev.id);
      if (existingIdx >= 0) {
        let suffix = 2;
        let newId = ev.id + ' [外部' + (suffix > 1 ? suffix : '') + ']';
        while (installed.some((v) => v.id === newId)) {
          suffix++;
          newId = ev.id + ' [外部' + suffix + ']';
        }
        ev.id = newId;
        ev.originalId = ev.id.replace(/ \[外部\d*\]/, '');
      }
      installed.push(ev);
    }
  }

  const loaderIdPattern = /^(?:fabric-loader-\d|quilt-loader-\d|\d+\.\d+(?:\.\d+)?-(?:forge|neoforge)-\d)/;

  fixModpackInheritsFrom(installed, loaderIdPattern);

  const installedMap = new Map();
  for (const v of installed) {
    installedMap.set(v.id, v);
    if (v.isExternal && v.id.includes(' [外部')) {
      installedMap.set(v.id.replace(/ \[外部\d*\]/, ''), v);
    }
  }

  // 收集所有被 inheritsFrom 引用的版本 ID（沿链向上）
  const inheritsFromIds = new Set();
  for (const v of installed) {
    if (!v.inheritsFrom) continue;
    let parentId = v.inheritsFrom;
    while (parentId) {
      if (inheritsFromIds.has(parentId)) break;
      inheritsFromIds.add(parentId);
      const parent = installedMap.get(parentId);
      if (!parent || !parent.inheritsFrom) break;
      parentId = parent.inheritsFrom;
    }
  }

  const externalIdMap = new Map();
  for (const v of installed) {
    if (v.isExternal && v.id.includes(' [外部')) {
      externalIdMap.set(v.id.replace(/ \[外部\d*\]/, ''), v.id);
    }
  }
  for (const baseId of [...inheritsFromIds]) {
    const externalId = externalIdMap.get(baseId);
    if (externalId) inheritsFromIds.add(externalId);
  }

  // [关键修复 2026-06-21] 只隐藏纯原版基础版本，不隐藏加载器版本
  // 旧逻辑：隐藏所有被 inheritsFrom 引用的版本（包括 Forge/Fabric 版本）
  // 问题：用户安装整合包后，fixModpackInheritsFrom 把整合包的 inheritsFrom 指向 Forge 版本，
  //       导致 Forge 版本被隐藏（"版本消失"），但文件夹还在。
  // 修复：只隐藏没有加载器的原版基础版本（如 "26.2", "1.20.1"），
  //       加载器版本（Forge/Fabric/NeoForge）永远显示。
  // [AI 自动生成警告] 不要改回旧的过滤逻辑，否则用户安装整合包后加载器版本会消失。
  //
  // [调整 2026-07-30] 原版基础版本被继承时也显示
  // 需求：用户希望列表里能看到裸基础版本（如 26.2）以直接启动原版。
  // 现状：原版基础版本被加载器版本继承时不再隐藏；加载器版本被继承且 mods 为空仍隐藏。
  //
  // [关键修复 2026-06-30] 加载器版本被整合包继承且自身 mods 为空时隐藏
  // 问题：CurseForge 整合包导入后，版本列表同时显示整合包版本和加载器版本，
  //       但加载器版本 mods 目录为空（mods 在整合包隔离目录），启动后无 mod。
  // 修复：被继承的加载器版本，仅当自身 mods 目录有 jar 时才显示；
  //       独立安装（不被继承）的加载器版本仍显示。
  //       纯原版基础版本被继承时也显示（见上方 2026-07-30 调整）。
  const loaderModCounts = new Map();
  for (const id of inheritsFromIds) {
    const v = installedMap.get(id);
    if (!v) continue;
    const isLoader = v.isForge || v.isFabric || v.isNeoForge || v.isOptiFine || v.isLiteLoader || loaderIdPattern.test(v.id);
    if (!isLoader) continue;
    let count = 0;
    try {
      const cleanId = id.replace(/ \[外部\d*\]/, '');
      const modsDir = path.join(ctx.dirs.VERSIONS_DIR, cleanId, 'mods');
      if (fs.existsSync(modsDir)) {
        count = fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar') && !f.endsWith('.jar.disabled')).length;
      }
    } catch (e) {}
    loaderModCounts.set(id, count);
  }

  const result = filterVersionsByVisibility(installed, { inheritsFromIds, loaderIdPattern, loaderModCounts });

  ctx.caches._versionsCache = result;
  ctx.caches._versionsCacheTime = Date.now();
  return result;
}

/**
 * 获取版本本地详情：mods/saves/resourcepacks 是否存在、前置是否缺失、自定义名称与描述
 * @param {string} versionId - 版本 ID（外部版本带 " [外部N]" 后缀）
 * @returns {{hasMods: boolean, hasSaves: boolean, hasResourcepacks: boolean, error: boolean, errorReason: string, customName: string, description: string}}
 */
function getVersionLocalDetails(versionId) {
  const cleanId = versionId.replace(/ \[外部\d*\]/, '');
  const isExternal = versionId.includes(' [外部');

  let versionDir;
  if (isExternal) {
    const extFolders = loadExternalFolders();
    const extFolder = extFolders.find((f) => fs.existsSync(path.join(f.path, 'versions', cleanId)));
    if (extFolder) {
      versionDir = path.join(extFolder.path, 'versions', cleanId);
    }
  }
  if (!versionDir) {
    versionDir = path.join(ctx.dirs.VERSIONS_DIR, cleanId);
  }

  const hasMods = fs.existsSync(path.join(versionDir, 'mods'));
  const hasSaves = fs.existsSync(path.join(versionDir, 'saves'));
  const hasResourcepacks = fs.existsSync(path.join(versionDir, 'resourcepacks'));

  let error = false;
  let errorReason = '';
  const jsonFile = findVersionJson(versionDir);
  if (jsonFile) {
    try {
      const data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
      const inheritsFrom = data.inheritsFrom;
      if (inheritsFrom) {
        const parentDir = path.join(ctx.dirs.VERSIONS_DIR, inheritsFrom);
        const parentJson = findVersionJson(parentDir);
        if (!parentJson) {
          // 内部目录找不到前置，再去外部目录找一遍
          let foundInExternal = false;
          const extFolders = loadExternalFolders();
          for (const ef of extFolders) {
            if (!fs.existsSync(ef.path)) continue;
            const extParentDir = path.join(ef.path, 'versions', inheritsFrom);
            if (findVersionJson(extParentDir)) { foundInExternal = true; break; }
          }
          if (!foundInExternal) {
            // 前置缺失：若自身是 Forge/NeoForge 且带 mainClass 或加载器库，则视为可用
            const hasMainClass = !!data.mainClass;
            const hasLibraries = Array.isArray(data.libraries) && data.libraries.length > 0;
            const hasForgeLibs = hasLibraries && data.libraries.some((l) => l.name && (
              l.name.includes('net.minecraftforge') || l.name.includes('fancymodloader') ||
              l.name.includes('net.neoforged') || l.name.includes('fabric-loader')
            ));
            const info = detectVersionInfo(data, cleanId);
            if ((info.isForge || info.isNeoForge) && (hasMainClass || hasForgeLibs)) {
            } else {
              error = true;
              errorReason = `需要安装 ${inheritsFrom} 作为前置版本`;
            }
          }
        }
      }
    } catch (e) {}
  }

  let customName = '';
  let description = '';
  try {
    const vs = loadVersionSettings(cleanId);
    customName = vs.customName || '';
    description = vs.description || '';
  } catch (e) {}

  return { hasMods, hasSaves, hasResourcepacks, error, errorReason, customName, description };
}

module.exports = {
  watchVersionsDir,
  loadVersions,
  saveVersions,
  findVersionChain,
  cleanupVersionChain,
  cleanupIncompleteVersion,
  isVersionComplete,
  validateInstalledVersions,
  fixModpackInheritsFrom,
  correctVersionType,
  scanExternalFolder,
  getInstalledVersions,
  getVersionLocalDetails
};
