/**
 * @file server/natives.js
 * @description Natives 提取与离线皮肤注入模块，包含原生库提取、Classpath 构建、
 *   离线皮肤注入/恢复等功能。通过 ctx (./context) 访问共享状态，通过 utils (./utils)
 *   访问工具函数，通过 versions (./versions) 访问版本管理功能，
 *   通过 modloaders (./modloaders) 访问模组加载器功能。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ctx = require('./context');
const utils = require('./utils');
const versions = require('./versions');
const modloaders = require('./modloaders');

/* 懒加载 server.js 中尚未抽取到子模块的函数 (避免循环依赖) */
let _serverModule = null;

// 懒加载 server 主模块，避免循环依赖
function _server() {
  if (_serverModule === null) {
    try { _serverModule = require('../server'); } catch (_) { _serverModule = {}; }
  }
  return _serverModule;
}

/**
 * 获取 Natives 目录（三级回退，避免非 ASCII 路径导致 UnsatisfiedLinkError）
 * @param {string} versionId - 版本 ID
 * @returns {string} Natives 目录绝对路径
 */
function getNativesFolder(versionId) {
  const primary = path.join(ctx.dirs.VERSIONS_DIR, versionId, 'natives');
  const isAscii = /^[\x00-\x7F]*$/.test(primary);
  if (isAscii) return primary;

  const fallback1 = path.join(ctx.dirs.DATA_DIR, 'bin', 'natives');
  if (/^[\x00-\x7F]*$/.test(fallback1)) return fallback1;

  const fallback2 = path.join(os.homedir(), '.minecraft', 'bin', 'natives');
  if (/^[\x00-\x7F]*$/.test(fallback2)) return fallback2;

  const fallback3 = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'versepc-natives');
  return fallback3;
}

/* Natives 提取 */

/**
 * 提取版本所需的 Natives 库到目录
 * @param {Object} versionJson - 版本 JSON
 * @param {string} versionId - 版本 ID
 * @param {string|null} [externalVersionDir] - 外部版本目录
 * @returns {string} Natives 目录绝对路径
 */
function extractNatives(versionJson, versionId, externalVersionDir = null) {
  const nativesDir = getNativesFolder(versionId);
  const nativeJars = [];

  const libraries = versionJson.libraries || [];
  const currentPlatform = process.platform === 'win32' ? 'windows' :
    process.platform === 'darwin' ? 'osx' : 'linux';

  let externalRoot = null;
  if (externalVersionDir) {
    externalRoot = versions.findExternalRoot(externalVersionDir);
    if (!externalRoot) {
      externalRoot = path.dirname(path.dirname(externalVersionDir));
    }
  }

  const nativeSearchBases = [];
  if (externalRoot) {
    nativeSearchBases.push(path.join(externalRoot, 'libraries'));
  }
  nativeSearchBases.push(ctx.dirs.LIBRARIES_DIR);
  // 整合包的 LWJGL natives 可能来自用户已有的 .minecraft 目录
  const mcLibDir = path.join(ctx.dirs.MINECRAFT_DIR, 'libraries');
  if (mcLibDir !== ctx.dirs.LIBRARIES_DIR && fs.existsSync(mcLibDir)) {
    nativeSearchBases.push(mcLibDir);
  }

  function findNativeJar(baseHref) {
    for (const base of nativeSearchBases) {
      if (!base) continue;
      const p = path.join(base, baseHref);
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  function extractNativeJar(jarPath) {
    let extracted = 0;
    let bytes = 0;
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(jarPath);
      const entries = zip.getEntries();
      for (const entry of entries) {
        const entryName = entry.entryName;
        if (entryName.startsWith('META-INF')) continue;
        if (entryName.startsWith('.')) continue;
        if (entryName.includes('/.git')) continue;
        if (entryName.endsWith('.gitkeep') || entryName.endsWith('.gitignore')) continue;
        if (entryName.endsWith('.sha1') || entryName.endsWith('.git')) continue;
        const ext = path.extname(entryName).toLowerCase();
        // 只解压原生二进制文件(.dll/.so/.dylib)，不解压配置文件
        // 配置文件冲突会导致模组加载异常
        const isNative = ext === '.dll' || ext === '.so' || ext === '.jnilib' || ext === '.dylib';
        if (isNative) {
          const fileName = path.basename(entryName);
          const destPath = path.join(nativesDir, fileName);
          if (fs.existsSync(destPath)) {
            try {
              const existingStat = fs.statSync(destPath);
              if (existingStat.size === entry.header.size) continue;
            } catch (_) {}
          }
          try {
            const data = entry.getData();
            if (data && data.length > 0) {
              fs.writeFileSync(destPath, data);
              extracted++;
              bytes += data.length;
            }
          } catch (writeErr) {
          }
        }
      }
      return { count: extracted, bytes: bytes };
    } catch (e) {
      try {
        const tempDir = nativesDir + '_temp';
        if (fs.existsSync(tempDir)) {
          try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e2) {}
        }
        fs.mkdirSync(tempDir, { recursive: true });

        if (process.platform === 'win32') {
          execSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
            `Expand-Archive -Path '${jarPath.replace(/'/g, "''")}' -DestinationPath '${tempDir.replace(/'/g, "''")}' -Force`],
          { stdio: 'pipe', timeout: 120000, windowsHide: true });
        } else {
          execSync('unzip', ['-o', jarPath, '-d', tempDir, '-x', 'META-INF/*'], { stdio: 'pipe', timeout: 120000 });
        }

        extracted = 0;
        bytes = 0;
        function collectFiles(dir) {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
              collectFiles(itemPath);
            } else {
              const ext = path.extname(item).toLowerCase();
              const isNative = ext === '.dll' || ext === '.so' || ext === '.jnilib' || ext === '.dylib';
              if (isNative) {
                const destPath = path.join(nativesDir, item);
                fs.copyFileSync(itemPath, destPath);
                extracted++;
                bytes += stat.size;
              }
            }
          }
        }
        collectFiles(tempDir);

        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e3) {}
        return { count: extracted, bytes: bytes };
      } catch (e2) {
        throw e2;
      }
    }
  }

  for (const lib of libraries) {
    if (lib.rules && !versions.evaluateRules(lib.rules)) continue;

    let nativePath = null;
    let isNativeLib = false;

    if (lib.natives) {
      const nativeKey = lib.natives[currentPlatform];
      if (!nativeKey) continue;
      isNativeLib = true;

      const classifier = nativeKey.replace('${arch}', process.arch === 'x64' ? '64' : '32');
      const nativeDownload = lib.downloads?.classifiers?.[classifier];
      if (!nativeDownload) continue;

      nativePath = findNativeJar(nativeDownload.path);
    } else if (lib.name && lib.name.includes(':natives-')) {
      const nameParts = lib.name.split(':');
      const nativeSuffix = nameParts[nameParts.length - 1];

      if (!nativeSuffix.startsWith('natives-')) continue;

      const platformNative = nativeSuffix.replace('natives-', '');

      let isValidPlatform = false;
      if (process.arch === 'x64') {
        isValidPlatform = platformNative === currentPlatform || platformNative === currentPlatform + '-x64';
      } else if (process.arch === 'ia32') {
        isValidPlatform = platformNative === currentPlatform + '-x86' || platformNative === currentPlatform;
      } else if (process.arch === 'arm64') {
        isValidPlatform = platformNative === currentPlatform + '-arm64' || platformNative === currentPlatform;
      }

      if (!isValidPlatform) continue;
      isNativeLib = true;

      if (lib.downloads?.artifact?.path) {
        nativePath = findNativeJar(lib.downloads.artifact.path);
      }
      if (!nativePath && lib.name) {
        const nparts = lib.name.split(':');
        if (nparts.length >= 4) {
          const ngroupPath = nparts[0].replace(/\./g, path.sep);
          const nname = nparts[1];
          const nver = nparts[2];
          const nclassifier = nparts[3];
          const njarName = `${nname}-${nver}-${nclassifier}.jar`;
          nativePath = findNativeJar(`${ngroupPath}${path.sep}${nname}${path.sep}${nver}${path.sep}${njarName}`);
        } else if (nparts.length >= 3) {
          const ngroupPath = nparts[0].replace(/\./g, path.sep);
          const nname = nparts[1];
          const nver = nparts[2];
          const njarName = `${nname}-${nver}.jar`;
          nativePath = findNativeJar(`${ngroupPath}${path.sep}${nname}${path.sep}${nver}${path.sep}${njarName}`);
        }
      }
    }

    if (!isNativeLib) continue;

    if (!nativePath || !fs.existsSync(nativePath)) {
      console.warn(`[Natives] ⚠ Native jar 缺失: ${lib.name || path.basename(nativePath || '')} (解压将被跳过，可能导致游戏崩溃)`);
      continue;
    }
    if (nativePath.endsWith('.jar') && !utils.isJarIntact(nativePath)) {
      console.warn(`[Natives] ⚠ Native jar 损坏: ${path.basename(nativePath)} (解压将被跳过，可能导致游戏崩溃)`);
      continue;
    }

    nativeJars.push(nativePath);
  }

  /* 合并 inheritsFrom 父版本 Natives */
  const resolvedNativesParents = new Set();
  let currentNativesJson = versionJson;
  while (currentNativesJson.inheritsFrom && !resolvedNativesParents.has(currentNativesJson.inheritsFrom)) {
    resolvedNativesParents.add(currentNativesJson.inheritsFrom);
    const parentNativesPath = path.join(ctx.dirs.VERSIONS_DIR, currentNativesJson.inheritsFrom, `${currentNativesJson.inheritsFrom}.json`);
    if (!fs.existsSync(parentNativesPath)) {
      console.warn(`[Natives] 父版本JSON未找到(跳过natives): ${parentNativesPath}`);
      break;
    }
    try {
      const parentNativesJson = JSON.parse(fs.readFileSync(parentNativesPath, 'utf8'));
      currentNativesJson = parentNativesJson;
      const parentNativesLibs = (parentNativesJson.libraries || []).filter((lib) => {
        if (lib.rules && !versions.evaluateRules(lib.rules)) return false;
        if (lib.natives) return true;
        if (lib.name && lib.name.includes(':natives-')) return true;
        return false;
      });
      if (parentNativesLibs.length > 0) {
      }
      for (const lib of parentNativesLibs) {
        let nativePath = null;
        if (lib.natives) {
          const nativeKey = lib.natives[currentPlatform];
          if (!nativeKey) continue;
          const classifier = nativeKey.replace('${arch}', process.arch === 'x64' ? '64' : '32');
          const nativeDownload = lib.downloads?.classifiers?.[classifier];
          if (!nativeDownload) continue;
          nativePath = findNativeJar(nativeDownload.path);
        } else if (lib.name && lib.name.includes(':natives-')) {
          const nameParts = lib.name.split(':');
          const nativeSuffix = nameParts[nameParts.length - 1];
          if (!nativeSuffix.startsWith('natives-')) continue;
          const platformNative = nativeSuffix.replace('natives-', '');
          let isValidPlatform = false;
          if (process.arch === 'x64') {
            isValidPlatform = platformNative === currentPlatform || platformNative === currentPlatform + '-x64';
          } else if (process.arch === 'ia32') {
            isValidPlatform = platformNative === currentPlatform + '-x86' || platformNative === currentPlatform;
          } else if (process.arch === 'arm64') {
            isValidPlatform = platformNative === currentPlatform + '-arm64' || platformNative === currentPlatform;
          }
          if (!isValidPlatform) continue;
          if (lib.downloads?.artifact?.path) {
            nativePath = findNativeJar(lib.downloads.artifact.path);
          }
          if (!nativePath && lib.name) {
            const nparts = lib.name.split(':');
            if (nparts.length >= 4) {
              const ngroupPath = nparts[0].replace(/\./g, path.sep);
              const njarName = `${nparts[1]}-${nparts[2]}-${nparts[3]}.jar`;
              nativePath = findNativeJar(`${ngroupPath}${path.sep}${nparts[1]}${path.sep}${nparts[2]}${path.sep}${njarName}`);
            } else if (nparts.length >= 3) {
              const ngroupPath = nparts[0].replace(/\./g, path.sep);
              const njarName = `${nparts[1]}-${nparts[2]}.jar`;
              nativePath = findNativeJar(`${ngroupPath}${path.sep}${nparts[1]}${path.sep}${nparts[2]}${path.sep}${njarName}`);
            }
          }
        }
        if (!nativePath || !fs.existsSync(nativePath)) {
          console.warn(`[Natives] ⚠ 父版本 Native jar 缺失: ${lib.name || path.basename(nativePath || '')}`);
          continue;
        }
        if (nativePath.endsWith('.jar') && !utils.isJarIntact(nativePath)) {
          console.warn(`[Natives] ⚠ 父版本 Native jar 损坏: ${path.basename(nativePath)}`);
          continue;
        }
        nativeJars.push(nativePath);
      }
    } catch (e) { console.error(`[Natives] 父版本加载失败: ${e.message}`); break; }
  }

  /* 增量解压：计算 native jar 文件的最新 mtime */
  let maxJarMtime = 0;
  for (const jarPath of nativeJars) {
    try {
      const stat = fs.statSync(jarPath);
      if (stat.mtimeMs > maxJarMtime) maxJarMtime = stat.mtimeMs;
    } catch (_) {}
  }

  /* 检查 nativesDir 是否需要重新解压 */
  if (fs.existsSync(nativesDir)) {
    let maxFileMtime = 0;
    try {
      for (const f of fs.readdirSync(nativesDir)) {
        try {
          const stat = fs.statSync(path.join(nativesDir, f));
          if (stat.mtimeMs > maxFileMtime) maxFileMtime = stat.mtimeMs;
        } catch (_) {}
      }
    } catch (_) {}

    if (maxJarMtime <= maxFileMtime) {
      return nativesDir;
    }

    // Natives 已变化，删除旧目录重新解压
    try { fs.rmSync(nativesDir, { recursive: true, force: true }); } catch (e) {}
  }
  fs.mkdirSync(nativesDir, { recursive: true });

  /* 解压流程（带失败兜底） */
  let fileCount = 0;
  let totalBytes = 0;

  function doExtractAll() {
    for (const jarPath of nativeJars) {
      const result = extractNativeJar(jarPath);
      fileCount += result.count;
      totalBytes += result.bytes;
    }
  }

  try {
    doExtractAll();
  } catch (e) {
    try { fs.rmSync(nativesDir, { recursive: true, force: true }); } catch (_) {}
    fs.mkdirSync(nativesDir, { recursive: true });
    fileCount = 0;
    totalBytes = 0;
    doExtractAll();
  }

  const extractedFiles = fs.existsSync(nativesDir) ? fs.readdirSync(nativesDir) : [];

  return nativesDir;
}

/* GC 参数检测 */

/**
 * 检查启动参数中是否已包含 GC 相关参数
 * @param {string[]} args - JVM 启动参数数组
 * @returns {boolean} 已包含 GC 参数返回 true
 */
function hasGarbageCollectorArg(args) {
  const gcPatterns = [
    /-XX:\+Use[A-Z]\w*GC/,
    /-XX:-Use[A-Z]\w*GC/,
    /-XX:\+Use.*Collector/,
    /-XX:-Use.*Collector/
  ];
  return args.some((arg) => gcPatterns.some((pattern) => pattern.test(arg)));
}

/* 离线皮肤注入/恢复 */

/**
 * 注入离线皮肤到游戏资源（覆盖 steve/alex 皮肤文件）
 * @param {Object} versionJson - 版本 JSON
 * @param {Object} account - 离线账号信息
 * @param {string} [assetsRoot] - 资源根目录
 * @returns {Array<Object>} 备份信息数组，用于后续恢复
 */
function injectOfflineSkin(versionJson, account, assetsRoot) {
  const backups = [];
  try {
    if (!account || account.type !== 'offline' || !account.skinFile) return backups;
    const skinPath = _server().resolveSkinPath(account.skinFile);
    if (!skinPath) return backups;
    const skinBuf = fs.readFileSync(skinPath);
    if (!skinBuf || skinBuf.length < 64) return backups;

    if (!assetsRoot) assetsRoot = ctx.dirs.ASSETS_DIR;

    const skinModel = account.skinModel || 'default';
    const isSlim = skinModel === 'slim';
    const primaryName = isSlim ? 'alex' : 'steve';
    const altName = isSlim ? 'steve' : 'alex';

    // 各 MC 版本的皮肤候选路径：
    // - 旧版 (<=1.20.1): entity/<name>.png
    // - 1.20.2+: entity/player/<name>.png 和 entity/player/slim/<name>.png
    const primaryPaths = [
      `minecraft/textures/entity/${primaryName}.png`,
      `minecraft/textures/entity/player/${primaryName}.png`,
      `minecraft/textures/entity/player/slim/${primaryName}.png`
    ];
    const altPaths = [
      `minecraft/textures/entity/${altName}.png`,
      `minecraft/textures/entity/player/${altName}.png`,
      `minecraft/textures/entity/player/slim/${altName}.png`
    ];

    if (!fs.existsSync(ctx.dirs.SKIN_BACKUP_DIR)) fs.mkdirSync(ctx.dirs.SKIN_BACKUP_DIR, { recursive: true });

    const assetIndexId = versionJson.assetIndex?.id;
    if (assetIndexId) {
      let indexPath = path.join(assetsRoot, 'indexes', `${assetIndexId}.json`);
      if (!fs.existsSync(indexPath)) indexPath = path.join(ctx.dirs.ASSETS_DIR, 'indexes', `${assetIndexId}.json`);
      if (fs.existsSync(indexPath)) {
        const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

        for (const targetPath of primaryPaths) {
          const obj = indexData.objects?.[targetPath];
          if (obj && obj.hash) {
            const hash = obj.hash;
            const subDir = hash.substring(0, 2);
            let objectPath = path.join(assetsRoot, 'objects', subDir, hash);
            if (!fs.existsSync(objectPath)) objectPath = path.join(ctx.dirs.ASSETS_DIR, 'objects', subDir, hash);
            if (fs.existsSync(objectPath)) {
              const backupName = `${assetIndexId}_${hash}`;
              const backupPath = path.join(ctx.dirs.SKIN_BACKUP_DIR, backupName);
              if (!fs.existsSync(backupPath)) {
                fs.copyFileSync(objectPath, backupPath);
              }
              fs.copyFileSync(skinPath, objectPath);
              backups.push({ type: 'object', path: objectPath, backup: backupPath });
            }
          }
        }

        for (const altPath of altPaths) {
          const altObj = indexData.objects?.[altPath];
          if (altObj && altObj.hash) {
            const altHash = altObj.hash;
            const altSub = altHash.substring(0, 2);
            let altObjectPath = path.join(assetsRoot, 'objects', altSub, altHash);
            if (!fs.existsSync(altObjectPath)) altObjectPath = path.join(ctx.dirs.ASSETS_DIR, 'objects', altSub, altHash);
            if (fs.existsSync(altObjectPath)) {
              const altBackupName = `${assetIndexId}_${altHash}`;
              const altBackupPath = path.join(ctx.dirs.SKIN_BACKUP_DIR, altBackupName);
              if (!fs.existsSync(altBackupPath)) {
                fs.copyFileSync(altObjectPath, altBackupPath);
              }
              backups.push({ type: 'object_no_replace', path: altObjectPath, backup: altBackupPath });
            }
          }
        }
      }
    }

    const virtualTargets = [];
    for (const targetPath of primaryPaths) {
      virtualTargets.push(path.join(assetsRoot, 'virtual', 'legacy', targetPath));
      virtualTargets.push(path.join(ctx.dirs.ASSETS_DIR, 'virtual', 'legacy', targetPath));
    }
    for (const vPath of virtualTargets) {
      if (fs.existsSync(vPath)) {
        const vBackup = path.join(ctx.dirs.SKIN_BACKUP_DIR, `virtual_${path.basename(vPath)}_${Date.now()}`);
        fs.copyFileSync(vPath, vBackup);
        fs.copyFileSync(skinPath, vPath);
        backups.push({ type: 'virtual', path: vPath, backup: vBackup });
      }
    }

    const gameDirBase = account.gameDir || '';
    const gameDirTargets = [];
    for (const targetPath of primaryPaths) {
      gameDirTargets.push(path.join(gameDirBase, 'resources', targetPath));
    }
    for (const gPath of gameDirTargets) {
      const gDir = path.dirname(gPath);
      if (fs.existsSync(path.dirname(gDir))) {
        if (!fs.existsSync(gDir)) fs.mkdirSync(gDir, { recursive: true });
        if (fs.existsSync(gPath)) {
          const gBackup = path.join(ctx.dirs.SKIN_BACKUP_DIR, `gamedir_${path.basename(gPath)}_${Date.now()}`);
          fs.copyFileSync(gPath, gBackup);
          backups.push({ type: 'gamedir', path: gPath, backup: gBackup });
        }
        fs.copyFileSync(skinPath, gPath);
        backups.push({ type: 'gamedir_inject', path: gPath, backup: null });
      }
    }
  } catch (e) {
    console.error('[Skin] 注入失败:', e.message);
  }
  return backups;
}

/**
 * 恢复离线皮肤注入前的原始文件
 * @param {Array<Object>} backups - injectOfflineSkin 返回的备份信息数组
 */
function restoreOfflineSkin(backups) {
  if (!backups || backups.length === 0) return;
  for (const b of backups) {
    try {
      if (b.type === 'object_no_replace') continue;
      if (b.backup && fs.existsSync(b.backup)) {
        fs.copyFileSync(b.backup, b.path);
      }
    } catch (e) {
      console.error('[Skin] 恢复失败:', b.path, e.message);
    }
  }
}

/* Classpath 构建 */

/**
 * 构建启动游戏的 Classpath 字符串
 * @param {Object} versionJson - 版本 JSON
 * @param {string} versionId - 版本 ID
 * @param {string|null} [externalVersionDir] - 外部版本目录
 * @returns {string} Classpath 字符串（用 ; 或 : 分隔）
 */
function buildClasspath(versionJson, versionId, externalVersionDir = null) {
  const classpath = [];
  const libraries = versionJson.libraries || [];
  const isExternal = !!externalVersionDir;

  let externalRoot = null;
  if (isExternal) {
    externalRoot = versions.findExternalRoot(externalVersionDir);
    if (!externalRoot) {
      externalRoot = path.dirname(path.dirname(externalVersionDir));
    }
  }

  const searchBases = [];
  if (isExternal && externalRoot) {
    searchBases.push(path.join(externalRoot, 'libraries'));
  }
  searchBases.push(ctx.dirs.LIBRARIES_DIR);

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

  function findLibFile(relPath) {
    for (const base of searchBases) {
      if (!base) continue;
      const p = path.join(base, relPath);
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  function findLibByMavenName(name) {
    const relPath = mavenNameToPath(name);
    if (!relPath) return null;
    return findLibFile(relPath);
  }

  function findLibByFallback(name) {
    const parts = name.split(':');
    if (parts.length < 3) return null;
    const groupPath = parts[0].replace(/\./g, path.sep);
    const artifactId = parts[1];
    const version = parts[2];
    const classifier = parts.length >= 4 ? parts[3] : null;
    for (const base of searchBases) {
      if (!base) continue;
      const dir = path.join(base, groupPath, artifactId, version);
      if (!fs.existsSync(dir)) continue;
      try {
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jar') && !f.endsWith('-sources.jar') && !f.endsWith('-javadoc.jar'));
        if (files.length === 0) continue;
        if (classifier) {
          const preferred = `${artifactId}-${version}-${classifier}.jar`;
          const match = files.find((f) => f === preferred);
          if (match) return path.join(dir, match);
        }
        const preferred = `${artifactId}-${version}.jar`;
        const match = files.find((f) => f === preferred);
        if (match) return path.join(dir, match);
        return path.join(dir, files[0]);
      } catch (e) {}
    }
    return null;
  }

  const currentPlatform = process.platform === 'win32' ? 'windows' :
    process.platform === 'darwin' ? 'osx' : 'linux';

  let foundCount = 0;
  let missingCount = 0;
  let missingList = [];

  for (const lib of libraries) {
    if (lib.rules && !versions.evaluateRules(lib.rules)) continue;

    const libName = lib.name || '';
    const nameSuffix = libName ? libName.split(':').pop() : '';

    // NeoForge: neoforge:*:client 是虚拟库记录（官方 Maven 返回 404，不可直接下载）
    // 不把 patched/universal jar 加入 classpath。
    // 参考：classpath 中不包含 neoforge-*-client.jar 和 minecraft-client-patched-*.jar。
    // 这些 jar 由 NeoForge 的 ProductionClientProviderLocator 通过 -DlibraryDirectory +
    // --fml.neoForgeVersion 参数自动查找并加载（SRG client jar 作为 minecraft 模块，
    // patched jar 作为 minecraft.client.patched 模块）。
    // 手动加入 classpath 会导致 JPMS 冲突：
    // "Modules minecraft and minecraft.client.patched export package net.minecraft.client.model to module flickerfix"
    // 因为 patched jar 同时在 classpath（unnamed module）和 module path 上被解析
    if (libName.startsWith('net.neoforged:neoforge:') && libName.endsWith(':client')) {
      continue;
    }

    // 仅跳过纯 native 条目（无 artifact）。若条目同时含 natives 和 artifact
    // （如合并后的 LWJGL 库），仍需将 artifact JAR 加入 classpath
    if (lib.natives && !lib.downloads?.artifact?.path) continue;

    if (nameSuffix.startsWith('natives-')) {
      const platformNative = nameSuffix.replace('natives-', '');
      let isValidPlatform = false;
      if (process.arch === 'x64') {
        isValidPlatform = platformNative === currentPlatform || platformNative === currentPlatform + '-x64';
      } else if (process.arch === 'ia32') {
        isValidPlatform = platformNative === currentPlatform + '-x86' || platformNative === currentPlatform;
      } else if (process.arch === 'arm64') {
        isValidPlatform = platformNative === currentPlatform + '-arm64' || platformNative === currentPlatform;
      }
      if (!isValidPlatform) continue;
    }

    let foundPath = null;

    if (lib.downloads?.artifact?.path) {
      foundPath = findLibFile(lib.downloads.artifact.path);
    }

    if (!foundPath && libName) {
      foundPath = findLibByMavenName(libName);
    }

    if (!foundPath && libName) {
      foundPath = findLibByFallback(libName);
    }

    if (foundPath) {
      classpath.push(foundPath);
      foundCount++;
    } else {
      missingCount++;
      missingList.push(libName);
    }
  }

  /* 合并 inheritsFrom 父版本库 */
  const resolvedParents = new Set();
  let currentJson = versionJson;
  while (currentJson.inheritsFrom && !resolvedParents.has(currentJson.inheritsFrom)) {
    resolvedParents.add(currentJson.inheritsFrom);
    const parentJsonPath = path.join(ctx.dirs.VERSIONS_DIR, currentJson.inheritsFrom, `${currentJson.inheritsFrom}.json`);
    if (!fs.existsSync(parentJsonPath)) {
      console.warn(`[Classpath] 父版本JSON未找到: ${parentJsonPath}, 使用外部版本目录查找`);
      if (externalVersionDir) {
        const extVersionsDir = externalRoot ? path.join(externalRoot, 'versions') : path.dirname(path.dirname(externalVersionDir));
        const extParentPath = path.join(extVersionsDir, currentJson.inheritsFrom, `${currentJson.inheritsFrom}.json`);
        if (fs.existsSync(extParentPath)) {
          try {
            const parentJson = JSON.parse(fs.readFileSync(extParentPath, 'utf8'));
            currentJson = parentJson;
            const parentLibCount = (parentJson.libraries || []).length;
            for (const lib of (parentJson.libraries || [])) {
              if (lib.rules && !versions.evaluateRules(lib.rules)) continue;
              const libName = lib.name || '';
              const nameSuffix = libName ? libName.split(':').pop() : '';
              if (lib.natives && !lib.downloads?.artifact?.path) continue;
              // NeoForge: 跳过 neoforge:ver:client（已由合并后的当前版本 libraries 处理，
              // 添加的是 minecraft-client-patched-<ver>.jar。若此处再次处理会通过
              // downloads.artifact.path 添加 neoforge-<ver>-client.jar，导致 JPMS 冲突：
              // "Module xnet reads more than one module named neoforge"，
              // 因为 neoforge-<ver>-client.jar 和 locator 加载的 neoforge-<ver>-universal.jar
              // 都会被 JPMS 解析为同名 'neoforge' 自动模块）
              if (libName.startsWith('net.neoforged:neoforge:') && libName.endsWith(':client')) continue;
              if (nameSuffix.startsWith('natives-')) {
                let isValidPlatform = false;
                const platformNative = nameSuffix.replace('natives-', '');
                if (process.arch === 'x64') {
                  isValidPlatform = platformNative === currentPlatform || platformNative === currentPlatform + '-x64';
                } else if (process.arch === 'ia32') {
                  isValidPlatform = platformNative === currentPlatform + '-x86' || platformNative === currentPlatform;
                } else if (process.arch === 'arm64') {
                  isValidPlatform = platformNative === currentPlatform + '-arm64' || platformNative === currentPlatform;
                }
                if (!isValidPlatform) continue;
              }
              // 去重：检查是否已被子版本覆盖
              const alreadyInCp = classpath.some((cp) => {
                if (!lib.name) return false;
                const relPath = mavenNameToPath(lib.name);
                return relPath && cp.endsWith(relPath);
              });
              if (alreadyInCp) continue;
              let foundPath = null;
              if (lib.downloads?.artifact?.path) foundPath = findLibFile(lib.downloads.artifact.path);
              if (!foundPath && libName) foundPath = findLibByMavenName(libName);
              if (!foundPath && libName) foundPath = findLibByFallback(libName);
              if (foundPath) { classpath.push(foundPath); foundCount++; }
              else { missingCount++; missingList.push(libName); }
            }
            continue;
          } catch (e) { console.error(`[Classpath] 外部父版本加载失败: ${e.message}`); }
        }
      }
      console.warn(`[Classpath] 父版本缺失, 跳过继承: ${currentJson.inheritsFrom}`);
      break;
    }
    try {
      const parentJson = JSON.parse(fs.readFileSync(parentJsonPath, 'utf8'));
      currentJson = parentJson;
      const parentLibCount = (parentJson.libraries || []).length;
      for (const lib of (parentJson.libraries || [])) {
        if (lib.rules && !versions.evaluateRules(lib.rules)) continue;
        const libName = lib.name || '';
        const nameSuffix = libName ? libName.split(':').pop() : '';
        if (lib.natives && !lib.downloads?.artifact?.path) continue;
        // NeoForge: 跳过 neoforge:ver:client（已由合并后的当前版本 libraries 处理，
        // 添加的是 minecraft-client-patched-<ver>.jar。若此处再次处理会通过
        // downloads.artifact.path 添加 neoforge-<ver>-client.jar，导致 JPMS 冲突：
        // "Module xnet reads more than one module named neoforge"，
        // 因为 neoforge-<ver>-client.jar 和 locator 加载的 neoforge-<ver>-universal.jar
        // 都会被 JPMS 解析为同名 'neoforge' 自动模块）
        if (libName.startsWith('net.neoforged:neoforge:') && libName.endsWith(':client')) continue;
        if (nameSuffix.startsWith('natives-')) {
          let isValidPlatform = false;
          const platformNative = nameSuffix.replace('natives-', '');
          if (process.arch === 'x64') {
            isValidPlatform = platformNative === currentPlatform || platformNative === currentPlatform + '-x64';
          } else if (process.arch === 'ia32') {
            isValidPlatform = platformNative === currentPlatform + '-x86' || platformNative === currentPlatform;
          } else if (process.arch === 'arm64') {
            isValidPlatform = platformNative === currentPlatform + '-arm64' || platformNative === currentPlatform;
          }
          if (!isValidPlatform) continue;
        }
        // 去重：检查是否已被子版本覆盖 (Forge 版本库优先)
        const alreadyInCp = classpath.some((cp) => {
          if (!lib.name) return false;
          const relPath = mavenNameToPath(lib.name);
          return relPath && cp.endsWith(relPath);
        });
        if (alreadyInCp) continue;
        let foundPath = null;
        if (lib.downloads?.artifact?.path) foundPath = findLibFile(lib.downloads.artifact.path);
        if (!foundPath && libName) foundPath = findLibByMavenName(libName);
        if (!foundPath && libName) foundPath = findLibByFallback(libName);
        if (foundPath) { classpath.push(foundPath); foundCount++; }
        else { missingCount++; missingList.push(libName); }
      }
    } catch (e) { console.error(`[Classpath] 父版本加载失败 (${parentJsonPath}): ${e.message}`); break; }
  }

  /* Forge 核心 JAR 搜索 (Forge 1.13+) */
  const forgeExtraJars = modloaders.findForgeCoreJars(versionJson, searchBases);
  for (const jar of forgeExtraJars) {
    classpath.push(jar);
    foundCount++;
  }

  /* NeoForge: 不在此处添加 universal jar 到 classpath。
   * universal jar 必须由 FML 的 PathBasedLocator 通过 --fml.neoForgeVersion 参数
   * 自动发现并加载为 mod。若手动加入 classpath，PathBasedLocator 会跳过它
   * （"already located earlier"），导致 neoforge mod 不被加载。
   * patched jar 通过 neoforge:ver:client 库条目加入 classpath（在 args-builder.js
   * buildClasspath 调用前已补全库条目），universal jar 保持游离状态由 locator 发现。
   */

  const CORE_JAR_MARKERS = ['fmlcore', 'javafmllanguage', 'mclanguage', 'lowcodelanguage'];
  const hasAnyForgeCoreInCp = CORE_JAR_MARKERS.some((name) => classpath.some((cp) => cp.includes(name)));

  if (!hasAnyForgeCoreInCp && forgeExtraJars.length === 0) {
    const _gArgs = versionJson.arguments?.game || [];
    const _mainCls = versionJson.mainClass || '';
    const _isForge = _gArgs.some((a) => typeof a === 'string' && a === 'forgeclient') ||
      _mainCls.toLowerCase().includes('bootstraplauncher');

    if (_isForge) {
      let _fv = '', _mv = '';
      const _fvi = _gArgs.findIndex((a) => typeof a === 'string' && a === '--fml.forgeVersion');
      const _mvi = _gArgs.findIndex((a) => typeof a === 'string' && a === '--fml.mcVersion');
      if (_fvi >= 0 && _fvi + 1 < _gArgs.length) _fv = _gArgs[_fvi + 1];
      if (_mvi >= 0 && _mvi + 1 < _gArgs.length) _mv = _gArgs[_mvi + 1];
      if (!_mv && versionJson.clientVersion) _mv = versionJson.clientVersion;

      if (!_fv || !_mv) {
        const _fl = libraries.find((l) => l.name && (l.name.startsWith('net.minecraftforge:fmlloader:') || l.name.startsWith('net.minecraftforge:forge:')));
        if (_fl) {
          const _p = _fl.name.split(':');
          if (_p.length >= 3) {
            const _di = _p[2].lastIndexOf('-');
            if (_di > 0) { _mv = _p[2].substring(0, _di); _fv = _p[2].substring(_di + 1); }
          }
        }
      }

      if (_fv && _mv) {
        const _vs = `${_mv}-${_fv}`;
        const _pfx = 'net/minecraftforge';
        const _coreArtifacts = [
          { dir: `${_pfx}/fmlcore/${_vs}`, file: `fmlcore-${_vs}.jar`, name: 'fmlcore' },
          { dir: `${_pfx}/javafmllanguage/${_vs}`, file: `javafmllanguage-${_vs}.jar`, name: 'javafmllanguage' },
          { dir: `${_pfx}/mclanguage/${_vs}`, file: `mclanguage-${_vs}.jar`, name: 'mclanguage' },
          { dir: `${_pfx}/lowcodelanguage/${_vs}`, file: `lowcodelanguage-${_vs}.jar`, name: 'lowcodelanguage' }
        ];
        const _missingNames = [];
        for (const artifact of _coreArtifacts) {
          let found = false;
          for (const base of searchBases) {
            if (!base) continue;
            if (fs.existsSync(path.join(base, artifact.dir, artifact.file))) { found = true; break; }
          }
          if (!found) {
            _missingNames.push(artifact.name);
          }
        }
        if (_missingNames.length > 0) {
          console.warn(`[Classpath] Forge核心库缺失(不加入classpath): ${_missingNames.join(', ')} — JVM启动后Forge引导程序可能报Invalid paths argument，启动器将在启动前尝试自动补全`);
        }
      }
    }
  }

  if (missingList.length > 0) {
    console.warn(`[Classpath] 缺失库 (${missingList.length}): ${missingList.slice(0, 20).join(', ')}`);
  }

  const dedupedClasspath = [];
  const seenLibBases = new Map();
  for (const cp of classpath) {
    const baseName = path.basename(cp, '.jar');
    const dashParts = baseName.split('-');
    if (dashParts.length >= 2) {
      // 使用完整 baseName 作为去重键，避免将同库不同 classifier（如
      // neoforge-21.1.172-universal 与 neoforge-21.1.172-client）误判为重复。
      // 旧逻辑用 dashParts.slice(0, -1).join('-') 作为键会把 classifier 当作
      // 版本号比较，导致 :client jar 被错误跳过，进而 ModLauncher 无法注册 neoforge mod。
      const libKey = baseName;
      if (seenLibBases.has(libKey)) {
        continue;
      }
      seenLibBases.set(libKey, dedupedClasspath.length);
    }
    dedupedClasspath.push(cp);
  }

  const actualVersionId = versionId || versionJson.id || '';
  const jarPath = versions.findMainJar(versionJson, actualVersionId, externalVersionDir);

  const hasNeoforgeLib = dedupedClasspath.some((cp) => cp.includes('neoforge') && cp.includes('universal'));
  // NeoForge: 不在此处添加 universal jar 到 classpath。
  // universal jar 由 NeoForge 的 ProductionClientProviderLocator 通过
  // -DlibraryDirectory + --fml.neoForgeVersion 参数自动查找并加载为 mod。
  // 若手动加入 classpath，PathBasedLocator 会跳过它（"already located earlier"），
  // 导致 neoforge mod 不被加载。参考：classpath 不含 universal jar。
  // -- 旧兜底逻辑已移除（曾通过 versionId 正则提取版本号添加 universal jar，但中文
  // versionId 不匹配正则，且与 -DlibraryDirectory 机制冲突）。

  if (jarPath && fs.existsSync(jarPath)) {
    // NeoForge/Forge: 若 classpath 中已存在 patched jar，跳过 mainJar 避免重复
    // 否则两个 patched jar 同时在 classpath 会触发 JPMS 模块冲突：
    //   "Modules minecraft and minecraft.client.patched export package ..."
    const hasPatched = dedupedClasspath.some((cp) => /minecraft-client-patched|neoforge-[\d.]+-client\.jar|forge-[\d.]+-[\d.]+-client\.jar/.test(path.basename(cp)));
    const isModloader = (versionJson.mainClass || '').includes('bootstraplauncher') ||
      (versionJson.libraries || []).some((l) => (l.name || '').includes('neoforged') || (l.name || '').includes('minecraftforge'));
    if (hasPatched && isModloader) {
      console.log(`[Classpath] NeoForge/Forge: 跳过 mainJar (classpath 已含 patched jar): ${path.basename(jarPath)}`);
    } else {
      dedupedClasspath.push(jarPath);
    }
  } else {
    console.error(`[Classpath] 主JAR未找到: ${actualVersionId}, jar=${versionJson.jar || '无'}, inheritsFrom: ${versionJson.inheritsFrom || '无'}`);
  }

  return dedupedClasspath.join(process.platform === 'win32' ? ';' : ':');
}

module.exports = {
  getNativesFolder,
  extractNatives,
  hasGarbageCollectorArg,
  injectOfflineSkin,
  restoreOfflineSkin,
  buildClasspath
};
