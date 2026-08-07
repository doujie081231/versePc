/**
 * @file server/dependencies/check.js - 依赖完整性检查
 * @description 从原 dependencies.js 中提取的 checkDependencies 函数。
 *   检查指定版本的依赖完整性（Java / 版本JSON / 主JAR / 库 / natives / 资源 / 前置版本 / Forge核心）。
 *   Forge / NeoForge 核心库检查逻辑位于 ./forge.js。
 */

const { fs, path, ctx, utils, versions, java } = require('./_shared');
const forgeCore = require('./forge');

/**
 * 检查指定版本的依赖完整性（Java / 版本JSON / 主JAR / 库 / natives / 资源 / 前置版本 / Forge核心）
 * @param {string} versionId - 版本目录名
 * @param {object} settings - 启动器设置
 * @param {string} [externalVersionDir=null] - 外部版本目录
 * @returns {Promise<object>} 依赖检查结果
 */
async function checkDependencies(versionId, settings, externalVersionDir = null) {
  // 缓存命中则直接返回，避免重复扫描
  const _cacheKey = versionId + ':' + JSON.stringify(settings || {});
  const _cached = ctx.caches._depCheckCache.get(_cacheKey);
  if (_cached && (Date.now() - _cached.ts) < ctx.caches._DEP_CHECK_CACHE_TTL) {
    return _cached.result;
  }

  // 外部版本目录的资源根，用于在外部目录查找 assets
  let externalAssetsDir = null;
  if (externalVersionDir) {
    const exRoot = versions.findExternalRoot(externalVersionDir) || path.dirname(path.dirname(externalVersionDir));
    const exAssets = path.join(exRoot, 'assets');
    if (fs.existsSync(exAssets)) {
      externalAssetsDir = exAssets;
    }
  }

  // 依赖检查结果对象
  const result = {
    java: { ok: false, path: '', version: '', required: 8, maxVersion: 999, rangeSource: 'default', message: '' },
    versionJson: { ok: false, message: '' },
    mainJar: { ok: false, message: '' },
    libraries: { ok: true, missing: [], total: 0, message: '' },
    natives: { ok: true, missing: [], total: 0, message: '' },
    assets: { ok: true, missing: [], total: 0, message: '' },
    parentVersion: { ok: true, message: '' },
    forgeCore: { ok: true, missing: [], message: '' },
    mrpackMods: { ok: true, missing: [], total: 0, message: '' },
    ready: false,
    missingFiles: []
  };

  // 解析版本 JSON
  const versionJson = versions.resolveVersionJson(versionId, externalVersionDir);
  if (!versionJson) {
    result.versionJson.ok = false;
    result.versionJson.message = `版本 ${versionId} 的JSON文件缺失或损坏`;
    return result;
  }
  result.versionJson.ok = true;

  // 确定需要的 Java 版本范围
  const range = java.getJavaVersionRange(versionId, versionJson);
  const requiredJavaVer = range.min;
  const maxJavaVer = range.max;
  result.java.required = requiredJavaVer;
  result.java.maxVersion = maxJavaVer;
  result.java.rangeSource = range.source;

  const javaPath = java.selectJavaForVersion(versionId, settings, versionJson);

  if (!javaPath) {
    // 未找到 Java：列出系统中检测到的所有 Java 供用户参考
    result.java.ok = false;
    const rangeDesc = maxJavaVer < 999 ? `${requiredJavaVer}~${maxJavaVer}` : `${requiredJavaVer}+`;
    const sysJava = java.detectSystemJava();
    const bunJava = java.detectBundledJava();
    const totalDetected = sysJava.length + bunJava.length;
    if (totalDetected > 0) {
      const detectedList = [...bunJava, ...sysJava].map((j) => `Java ${j.majorVersion} (${j.path})`).join(', ');
      result.java.message = `未找到合适版本的Java（需要 ${rangeDesc}，检测到 ${totalDetected} 个但版本不匹配: ${detectedList}），请前往 Java 管理页面安装或配置`;
    } else {
      result.java.message = `未找到Java运行环境（需要 ${rangeDesc}），请前往 Java 管理页面安装或配置`;
    }
  } else {
    // 找到 Java：复用 getJavaVersionInfo 获取实际版本号并校验范围
    // 该函数已处理 java -version 非零退出码的情况，可从 stderr 中解析版本
    result.java.path = javaPath;
    const info = java.getJavaVersionInfo(javaPath);
    if (info.major > 0) {
      result.java.version = info.version;
      const majorVer = info.major;
      const maxJavaVer = range.max;
      if (majorVer >= requiredJavaVer && majorVer <= maxJavaVer) {
        result.java.ok = true;
        result.java.message = maxJavaVer < 999
          ? `Java ${result.java.version} (满足要求 ${requiredJavaVer}~${maxJavaVer})`
          : `Java ${result.java.version} (满足要求 ${requiredJavaVer}+)`;
      } else {
        result.java.ok = false;
        const rangeDesc = maxJavaVer < 999 ? `${requiredJavaVer}~${maxJavaVer}` : `${requiredJavaVer}+`;
        result.java.message = `Java ${result.java.version} 不满足要求(需要 ${rangeDesc})，请在版本设置中更换Java或使用文件修复功能自动安装`;
        result.java.warning = true;
      }
    } else {
      result.java.ok = false;
      result.java.message = `无法检测Java版本（路径: ${javaPath}），请确认该 Java 可执行文件未被损坏或删除`;
      console.error(`[DepCheck] 检测Java版本失败: 无法从 ${javaPath} 获取版本信息`);
    }
  }

  // 前置版本（inheritsFrom）检查：确认基础版本的 JSON 和 JAR 都存在
  if (versionJson.inheritsFrom) {
    const jarName = versionJson.jar || versionJson.inheritsFrom;
    let parentJsonFound = false;
    let parentJsonPath = null;

    // 构造前置版本 JSON 的候选搜索路径
    const jsonSearchPaths = [];
    if (externalVersionDir) {
      const externalRoot = versions.findExternalRoot(externalVersionDir);
      if (externalRoot) {
        jsonSearchPaths.push(path.join(externalRoot, 'versions', versionJson.inheritsFrom, `${versionJson.inheritsFrom}.json`));
      }
      jsonSearchPaths.push(path.join(path.dirname(externalVersionDir), versionJson.inheritsFrom, `${versionJson.inheritsFrom}.json`));
      const externalFolders = versions.loadExternalFolders();
      for (const folder of externalFolders) {
        if (!fs.existsSync(folder.path)) continue;
        const candidate = path.join(folder.path, 'versions', versionJson.inheritsFrom, `${versionJson.inheritsFrom}.json`);
        if (!jsonSearchPaths.includes(candidate)) jsonSearchPaths.push(candidate);
      }
    }
    jsonSearchPaths.push(path.join(ctx.dirs.VERSIONS_DIR, versionJson.inheritsFrom, `${versionJson.inheritsFrom}.json`));

    for (const candidate of jsonSearchPaths) {
      if (fs.existsSync(candidate)) {
        parentJsonPath = candidate;
        parentJsonFound = true;
        break;
      }
    }

    const mainJarPath = versions.findMainJar(versionJson, versionId, externalVersionDir);
    const mainJarFound = !!mainJarPath && fs.existsSync(mainJarPath);

    if (!parentJsonFound && !mainJarFound) {
      const hasMainClass = !!versionJson.mainClass;
      const hasLibs = Array.isArray(versionJson.libraries) && versionJson.libraries.length > 0;
      const hasForgeLibs = hasLibs && versionJson.libraries.some((l) => l.name && (
        l.name.includes('net.minecraftforge') || l.name.includes('fancymodloader') ||
        l.name.includes('net.neoforged') || l.name.includes('fabric-loader')
      ));
      /*
      [CRITICAL] 外部版本 depCheck 豁免
      ====================================
      【问题原理】
        depCheck（启动前依赖检查）会检查版本 JSON 的 inheritsFrom 字段，
        确认前置版本（parent version）存在且有 JAR 文件。这是为了防止用户
        删除了基础版本后启动整合包导致崩溃。

        但外部导入的 Forge/NeoForge 版本（来自其他启动器）情况特殊：
        它们的版本 JSON 可能有 inheritsFrom 指向一个在 VersePC 中不存在的版本，
        但实际上这些 JSON 已经包含了完整的 mainClass 和所有库文件（合并式JSON），
        即使没有前置版本也能正常启动。

        如果此处不豁免，外部版本首次启动后会被误判为"错误版本"——
        版本列表中不会显示该版本，用户无法启动。

      【豁免条件】
        仅当以下条件全部满足时豁免：
        1. externalVersionDir 不为空（说明是外部导入的版本）
        2. 版本 JSON 包含 mainClass 或 Forge/NeoForge/Fabric 库（说明是自包含的）

      【与 _scanVersionDir 的一致性】
        版本列表扫描代码（_scanVersionDir 中的 isVersionAvailable）已经有相同的豁免逻辑：
        如果外部版本 JSON 有 mainClass 或 Forge libs，即使 inheritsFrom 指向不存在的版本，
        也会被标记为可用。此处 depCheck 必须保持一致，否则版本列表显示可用但启动时报错。

      [AI-AUTOGEN-WARNING] 请勿删除此豁免逻辑。删除后外部导入的 Forge/NeoForge 版本
      首次启动后会被标记为"错误版本"，从版本列表中消失。
      */
      const isSelfSufficient = externalVersionDir && (hasMainClass || hasForgeLibs);
      if (!isSelfSufficient) {
        result.parentVersion.ok = false;
        result.parentVersion.message = `缺少基础版本 ${versionJson.inheritsFrom}，请先安装`;
        result.missingFiles.push({
          type: 'parent_version',
          id: versionJson.inheritsFrom,
          message: `缺少基础版本 ${versionJson.inheritsFrom} (JSON: ${parentJsonFound ? '有' : '无'}, JAR: ${mainJarFound ? '有' : '无'})`
        });
      }
    }
  }

  // 主 JAR 校验：原版做 SHA1 校验；缺失时沿继承链回退查找下载 URL
  const mainJarPath = versions.findMainJar(versionJson, versionId, externalVersionDir);
  if (mainJarPath && fs.existsSync(mainJarPath)) {
    const isModdedVersion = !!(versionJson.forge || versionJson.neoforge || versionJson.fabricVersion || versionJson.inheritsFrom);
    if (versionJson.downloads?.client?.sha1 && !isModdedVersion) {
      try {
        const sha1 = await utils.calculateSHA1(mainJarPath);
        if (sha1 === versionJson.downloads.client.sha1) {
          result.mainJar.ok = true;
        } else {
          result.mainJar.ok = false;
          result.mainJar.message = '主JAR文件SHA1校验失败';
          result.missingFiles.push({
            type: 'main_jar',
            url: versionJson.downloads.client.url,
            path: mainJarPath,
            sha1: versionJson.downloads.client.sha1,
            size: versionJson.downloads.client.size,
            name: `${versionId}.jar`
          });
        }
      } catch (e) {
        result.mainJar.ok = true;
      }
    } else {
      // Mod 版本不做 SHA1 校验，存在即视为有效
      result.mainJar.ok = true;
    }
  } else if (versionJson.downloads?.client) {
    // JAR 缺失但版本 JSON 有 client 下载信息
    result.mainJar.ok = false;
    result.mainJar.message = '主JAR文件缺失';
    result.missingFiles.push({
      type: 'main_jar',
      url: versionJson.downloads.client.url,
      path: mainJarPath || path.join(ctx.dirs.VERSIONS_DIR, versionId, `${versionId}.jar`),
      sha1: versionJson.downloads.client.sha1,
      size: versionJson.downloads.client.size,
      name: `${versionId}.jar`
    });
  } else {
    // 无 downloads.client：沿 inheritsFrom 链查找前置版本的 client 下载信息
    let fallbackUrl = null, fallbackSha1 = null, fallbackSize = null, fallbackJarId = null;
    const _chainVisited = new Set();
    let _cur = versionJson;
    while (_cur && _cur.inheritsFrom && !_chainVisited.has(_cur.inheritsFrom)) {
      _chainVisited.add(_cur.inheritsFrom);
      try {
        const pjPath = path.join(ctx.dirs.VERSIONS_DIR, _cur.inheritsFrom, `${_cur.inheritsFrom}.json`);
        if (fs.existsSync(pjPath)) {
          const pj = JSON.parse(fs.readFileSync(pjPath, 'utf-8'));
          if (pj.downloads?.client?.url) {
            fallbackUrl = pj.downloads.client.url;
            fallbackSha1 = pj.downloads.client.sha1;
            fallbackSize = pj.downloads.client.size;
            fallbackJarId = _cur.inheritsFrom;
            break;
          }
          _cur = pj;
          continue;
        }
      } catch (_) {}
      break;
    }
    result.mainJar.ok = false;
    result.mainJar.message = '主JAR文件缺失';
    if (fallbackUrl && fallbackJarId) {
      const fallbackPath = path.join(ctx.dirs.VERSIONS_DIR, fallbackJarId, `${fallbackJarId}.jar`);
      result.missingFiles.push({
        type: 'main_jar',
        url: fallbackUrl,
        path: fallbackPath,
        sha1: fallbackSha1,
        size: fallbackSize,
        name: `${fallbackJarId}.jar`
      });
    }
  }

  // 库与 natives 检查：按平台规则筛选，校验文件存在性与 SHA1
  const libraries = versionJson.libraries || [];
  const currentPlatform = process.platform === 'win32' ? 'windows' :
    process.platform === 'darwin' ? 'osx' : 'linux';
  let libTotal = 0;
  for (const lib of libraries) {
    if (lib.rules && !versions.evaluateRules(lib.rules)) continue;

    // NeoForge 特殊处理：net.neoforged:neoforge:<ver>:client 这条库记录在 version JSON 中，
    // 但官方 Maven 返回 404（不可直接下载），实际启动用的是 minecraft-client-patched-<ver>.jar（installer 本地生成）
    // 如果 patched jar 已存在，跳过这个虚拟库记录的检查，避免误报缺失导致下载失败
    if (lib.name && lib.name.startsWith('net.neoforged:neoforge:') && lib.name.endsWith(':client')) {
      const neoVer = lib.name.split(':')[2];
      const patchedJarPath = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'neoforged', 'minecraft-client-patched', neoVer, `minecraft-client-patched-${neoVer}.jar`);
      if (fs.existsSync(patchedJarPath)) {
        libTotal++;
        continue;
      }
    }

    const hasNatives = lib.natives && lib.natives[process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'];
    const libNameSuffix = lib.name ? lib.name.split(':').pop() : '';
    // 新格式 native：classifier 以 natives- 开头（LWJGL 3.x+）
    const isNewFormatNative = !hasNatives && libNameSuffix.startsWith('natives-');

    if (isNewFormatNative) {
      const nameParts = lib.name.split(':');
      const nativeSuffix = nameParts[nameParts.length - 1];
      const platformNative = nativeSuffix.replace('natives-', '');
      // 架构匹配：x64 / ia32 / arm64
      let isValidPlatform = false;
      if (process.arch === 'x64') {
        isValidPlatform = platformNative === currentPlatform || platformNative === currentPlatform + '-x64';
      } else if (process.arch === 'ia32') {
        isValidPlatform = platformNative === currentPlatform + '-x86' || platformNative === currentPlatform;
      } else if (process.arch === 'arm64') {
        isValidPlatform = platformNative === currentPlatform + '-arm64' || platformNative === currentPlatform;
      }
      if (!isValidPlatform) continue;

      libTotal++;
      let nativePath = null;
      if (lib.downloads?.artifact?.path) {
        nativePath = utils.safeLibPath(lib.downloads.artifact.path);
        if (!nativePath) continue;
        // 本地不存在时回退到外部目录查找
        if (!fs.existsSync(nativePath) && externalVersionDir) {
          const externalRoot = versions.findExternalRoot(externalVersionDir);
          if (externalRoot) {
            const extPath = utils.safeLibPath(lib.downloads.artifact.path, path.join(externalRoot, 'libraries'));
            if (fs.existsSync(extPath)) nativePath = extPath;
          }
        }
      }
      if (!nativePath || !fs.existsSync(nativePath)) {
        // 从 maven 坐标构造本地路径
        if (nameParts.length >= 4) {
          const ngroupPath = nameParts[0].replace(/\./g, path.sep);
          const nname = nameParts[1];
          const nver = nameParts[2];
          const nclassifier = nameParts[3];
          const njarName = `${nname}-${nver}-${nclassifier}.jar`;
          nativePath = path.join(ctx.dirs.LIBRARIES_DIR, ngroupPath, nname, nver, njarName);
          if (!fs.existsSync(nativePath) && externalVersionDir) {
            const externalRoot = versions.findExternalRoot(externalVersionDir);
            if (externalRoot) {
              const extPath = path.join(externalRoot, 'libraries', ngroupPath, nname, nver, njarName);
              if (fs.existsSync(extPath)) nativePath = extPath;
            }
          }
        }
      }
      if (!nativePath || !fs.existsSync(nativePath)) {
        // 文件缺失：构造下载 URL
        const ngroupMaven = nameParts[0].replace(/\./g, '/');
        const nname = nameParts[1];
        const nver = nameParts[2];
        const nclassifier = nameParts[3];
        const njarName = `${nname}-${nver}-${nclassifier}.jar`;
        const baseUrl = lib.url || (lib.downloads?.artifact?.url ? lib.downloads.artifact.url.replace(/\/[^/]+\/[^/]+\/[^/]+\/[^/]+\.jar$/, '/') : 'https://libraries.minecraft.net/');
        const nativeUrl = lib.downloads?.artifact?.url || `${baseUrl}${ngroupMaven}/${nname}/${nver}/${njarName}`;
        result.natives.missing.push({
          type: 'native',
          url: nativeUrl,
          path: nativePath,
          sha1: lib.downloads?.artifact?.sha1 || '',
          size: lib.downloads?.artifact?.size || 0,
          name: lib.name
        });
      } else if (lib.downloads?.artifact?.sha1) {
        // 文件存在：校验 SHA1
        try {
          const sha1 = await utils.calculateSHA1(nativePath);
          if (sha1 !== lib.downloads.artifact.sha1) {
            result.natives.missing.push({
              type: 'native',
              url: lib.downloads.artifact.url,
              path: nativePath,
              sha1: lib.downloads.artifact.sha1,
              size: lib.downloads.artifact.size,
              name: lib.name
            });
          }
        } catch (e) {}
      }
    } else if (lib.downloads?.artifact) {
      // 标准 library（有 downloads.artifact）
      libTotal++;
      let libPath = utils.safeLibPath(lib.downloads.artifact.path);
      if (!libPath) continue;
      if (!fs.existsSync(libPath) && externalVersionDir) {
        const externalRoot = versions.findExternalRoot(externalVersionDir);
        if (externalRoot) {
          const extLibPath = utils.safeLibPath(lib.downloads.artifact.path, path.join(externalRoot, 'libraries'));
          if (fs.existsSync(extLibPath)) libPath = extLibPath;
        }
        if (!fs.existsSync(libPath)) {
          const extLibPath2 = utils.safeLibPath(lib.downloads.artifact.path, path.join(path.dirname(path.dirname(externalVersionDir)), 'libraries'));
          if (fs.existsSync(extLibPath2)) libPath = extLibPath2;
        }
      }
      if (!fs.existsSync(libPath)) {
        // 缺失：按 maven 坐标构造 URL
        let fixUrl = lib.downloads.artifact.url;
        if (!fixUrl && lib.name) {
          const p = lib.name.split(':');
          if (p.length >= 3) {
            const gp = p[0].replace(/\./g, '/');
            const nm = p[1]; const vr = p[2];
            const cl = p.length >= 4 ? p[3] : '';
            const jn = cl ? `${nm}-${vr}-${cl}.jar` : `${nm}-${vr}.jar`;
            const base = lib.url || (p[0].includes('minecraftforge') || p[0].includes('forge') || p[0].includes('minecraft') ? 'https://maven.minecraftforge.net/' : 'https://libraries.minecraft.net/');
            fixUrl = `${base}${gp}/${nm}/${vr}/${jn}`;
          }
        }
        result.libraries.missing.push({
          type: 'library',
          url: fixUrl || '',
          path: libPath,
          sha1: lib.downloads.artifact.sha1,
          size: lib.downloads.artifact.size,
          name: lib.name || path.basename(lib.downloads.artifact.path)
        });
      } else if (lib.downloads.artifact.sha1) {
        // 存在：校验 SHA1
        try {
          const sha1 = await utils.calculateSHA1(libPath);
          if (sha1 !== lib.downloads.artifact.sha1) {
            let fixUrl = lib.downloads.artifact.url;
            if (!fixUrl && lib.name) {
              const p = lib.name.split(':');
              if (p.length >= 3) {
                const gp = p[0].replace(/\./g, '/');
                const nm = p[1]; const vr = p[2];
                const cl = p.length >= 4 ? p[3] : '';
                const jn = cl ? `${nm}-${vr}-${cl}.jar` : `${nm}-${vr}.jar`;
                const base = lib.url || (p[0].includes('minecraftforge') || p[0].includes('forge') ? 'https://maven.minecraftforge.net/' : 'https://libraries.minecraft.net/');
                fixUrl = `${base}${gp}/${nm}/${vr}/${jn}`;
              }
            }
            result.libraries.missing.push({
              type: 'library',
              url: fixUrl || '',
              path: libPath,
              sha1: lib.downloads.artifact.sha1,
              size: lib.downloads.artifact.size,
              name: lib.name || path.basename(lib.downloads.artifact.path)
            });
          }
        } catch (e) {}
      }
    } else if (lib.name && !hasNatives) {
      // 无 downloads.artifact：仅按 maven 坐标定位本地文件
      const parts = lib.name.split(':');
      if (parts.length >= 3) {
        libTotal++;
        const groupPath = parts[0].replace(/\./g, '/');
        const name = parts[1];
        const version = parts[2];
        const classifier = parts.length >= 4 ? parts[3] : '';
        const jarName = classifier ? `${name}-${version}-${classifier}.jar` : `${name}-${version}.jar`;
        const localGroupPath = parts[0].replace(/\./g, path.sep);
        let libPath = path.join(ctx.dirs.LIBRARIES_DIR, localGroupPath, name, version, jarName);
        if (!fs.existsSync(libPath) && externalVersionDir) {
          const externalRoot = versions.findExternalRoot(externalVersionDir);
          if (externalRoot) {
            const extLibPath = path.join(externalRoot, 'libraries', localGroupPath, name, version, jarName);
            if (fs.existsSync(extLibPath)) libPath = extLibPath;
          }
          if (!fs.existsSync(libPath)) {
            const extLibPath2 = path.join(path.dirname(path.dirname(externalVersionDir)), 'libraries', localGroupPath, name, version, jarName);
            if (fs.existsSync(extLibPath2)) libPath = extLibPath2;
          }
        }
        if (!fs.existsSync(libPath)) {
          // 缺失：按 group 选择 maven 仓库
          let baseUrl = lib.url;
          if (!baseUrl) {
            if (lib.name.includes('fabric') || lib.name.includes('fabricmc')) {
              baseUrl = 'https://maven.fabricmc.net/';
            } else if (lib.name.includes('neoforged')) {
              baseUrl = 'https://maven.neoforged.net/';
            } else if (lib.name.includes('forge') || lib.name.includes('minecraftforge') || lib.name.startsWith('net.minecraft')) {
              baseUrl = 'https://maven.minecraftforge.net/';
            } else {
              baseUrl = 'https://libraries.minecraft.net/';
            }
          }
          const downloadUrl = `${baseUrl}${groupPath}/${name}/${version}/${jarName}`;
          result.libraries.missing.push({
            type: 'library',
            url: downloadUrl,
            path: libPath,
            sha1: '',
            size: 0,
            name: lib.name
          });
        }
      }
    }

    // 旧格式 natives（lib.natives 字典）
    if (hasNatives) {
      const nativeKey = lib.natives[process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'];
      const classifier = nativeKey.replace('${arch}', process.arch === 'x64' ? '64' : '32');
      const nativeDownload = lib.downloads?.classifiers?.[classifier];
      if (nativeDownload) {
        libTotal++;
        let nativePath = path.join(ctx.dirs.LIBRARIES_DIR, nativeDownload.path);
        if (!fs.existsSync(nativePath) && externalVersionDir) {
          const externalRoot = versions.findExternalRoot(externalVersionDir);
          if (externalRoot) {
            const extNativePath = path.join(externalRoot, 'libraries', nativeDownload.path);
            if (fs.existsSync(extNativePath)) nativePath = extNativePath;
          }
        }
        if (!fs.existsSync(nativePath)) {
          result.natives.missing.push({
            type: 'native',
            url: nativeDownload.url,
            path: nativePath,
            sha1: nativeDownload.sha1,
            size: nativeDownload.size,
            name: `${lib.name} (${classifier})`
          });
        } else if (nativeDownload.sha1) {
          try {
            const sha1 = await utils.calculateSHA1(nativePath);
            if (sha1 !== nativeDownload.sha1) {
              result.natives.missing.push({
                type: 'native',
                url: nativeDownload.url,
                path: nativePath,
                sha1: nativeDownload.sha1,
                size: nativeDownload.size,
                name: `${lib.name} (${classifier})`
              });
            }
          } catch (e) {}
        }
      }
    }
  }
  result.libraries.total = libTotal;
  result.libraries.ok = result.libraries.missing.length === 0;
  if (result.libraries.missing.length > 0) {
    result.libraries.message = `${result.libraries.missing.length} 个库文件缺失或损坏`;
    result.missingFiles.push(...result.libraries.missing);
  }

  result.natives.total = result.natives.missing.length;
  result.natives.ok = result.natives.missing.length === 0;
  if (result.natives.missing.length > 0) {
    result.natives.message = `${result.natives.missing.length} 个原生库缺失或损坏`;
    result.missingFiles.push(...result.natives.missing);
  }

  // Forge / NeoForge 核心库检查（含 inheritsFrom 链识别、新版格式检测、核心库校验）
  forgeCore.checkForgeCore(versionJson, versionId, externalVersionDir, result);

  // mrpack 整合包 mods 完整性检查：对比 mrpack-manifest.json 与 mods 目录实际文件
  // 解决"导入返回成功但实际有 mod 下载失败"的盲区，启动前自动发现并补下缺失 mod
  try {
    const versionDir = externalVersionDir || path.join(ctx.dirs.VERSIONS_DIR, versionId);
    const manifestPath = path.join(versionDir, 'mrpack-manifest.json');
    if (fs.existsSync(manifestPath)) {
      const mrpackManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const manifestFiles = Array.isArray(mrpackManifest.files) ? mrpackManifest.files : [];
      // 只检查 mods/ 目录下的文件（shaderpacks/resourcepacks 不在本次范围）
      const modEntries = manifestFiles.filter((f) => f.path && f.path.startsWith('mods/'));
      result.mrpackMods.total = modEntries.length;
      for (const entry of modEntries) {
        const fileName = path.basename(entry.path);
        const destPath = path.join(versionDir, entry.path);
        let needRecheck = false;
        if (!fs.existsSync(destPath)) {
          needRecheck = true;
        } else {
          // 文件存在时做轻量校验：大小匹配 + JAR 结构完整
          const expectedSize = entry.fileSize || 0;
          const expectedSha1 = entry.hashes && entry.hashes.sha1;
          try {
            const stat = fs.statSync(destPath);
            if (expectedSize > 0 && stat.size !== expectedSize) {
              needRecheck = true;
            } else if (destPath.endsWith('.jar') && !utils.isJarIntact(destPath)) {
              needRecheck = true;
            } else if (expectedSha1) {
              // 大小匹配且 JAR 完整时再做 SHA1 校验（流式异步）
              const actualSha1 = await utils.calculateSHA1(destPath);
              if (actualSha1 !== expectedSha1) needRecheck = true;
            }
          } catch (_) {
            needRecheck = true;
          }
        }
        if (needRecheck) {
          // 取第一个下载 URL 作为补下源
          const dlUrl = (entry.downloads && entry.downloads[0]) || '';
          result.mrpackMods.missing.push({
            type: 'mod',
            url: dlUrl,
            path: destPath,
            sha1: (entry.hashes && entry.hashes.sha1) || '',
            size: entry.fileSize || 0,
            name: fileName,
            // 提供全部下载 URL 供 downloadMissingDependencies 做镜像重试
            urls: entry.downloads || []
          });
        }
      }
      result.mrpackMods.ok = result.mrpackMods.missing.length === 0;
      if (result.mrpackMods.missing.length > 0) {
        result.mrpackMods.message = `${result.mrpackMods.missing.length} 个 Mod 文件缺失或损坏`;
        result.missingFiles.push(...result.mrpackMods.missing);
      }
    }
  } catch (e) {
    console.warn(`[DepCheck] mrpack mods 检查异常(非致命): ${e.message}`);
  }

  // 资源文件检查：索引文件 + objects 文件
  if (versionJson.assetIndex) {
    const assetIndexInfo = versionJson.assetIndex;
    let assetIndexPath = path.join(ctx.dirs.ASSETS_DIR, 'indexes', `${assetIndexInfo.id}.json`);
    // 本地索引缺失时回退到外部目录
    if (!fs.existsSync(assetIndexPath) && externalAssetsDir) {
      const exIndexPath = path.join(externalAssetsDir, 'indexes', `${assetIndexInfo.id}.json`);
      if (fs.existsSync(exIndexPath)) {
        assetIndexPath = exIndexPath;
      }
    }

    if (!fs.existsSync(assetIndexPath)) {
      result.assets.ok = false;
      result.assets.message = '资源索引文件缺失';
      result.missingFiles.push({
        type: 'asset_index',
        url: assetIndexInfo.url,
        path: assetIndexPath,
        sha1: assetIndexInfo.sha1,
        size: assetIndexInfo.size,
        name: `${assetIndexInfo.id}.json`
      });
    } else {
      try {
        const assetIndexData = JSON.parse(fs.readFileSync(assetIndexPath, 'utf-8'));
        const assetObjects = assetIndexData.objects || {};
        const assetEntries = Object.entries(assetObjects);
        result.assets.total = assetEntries.length;

        let missingCount = 0;
        for (const [name, info] of assetEntries) {
          const hash = info.hash;
          const subDir = hash.substring(0, 2);
          let assetPath = path.join(ctx.dirs.ASSETS_DIR, 'objects', subDir, hash);
          if (!fs.existsSync(assetPath) && externalAssetsDir) {
            const exAssetPath = path.join(externalAssetsDir, 'objects', subDir, hash);
            if (fs.existsSync(exAssetPath)) {
              assetPath = exAssetPath;
            }
          }
          if (!fs.existsSync(assetPath)) {
            missingCount++;
            // 仅记录前 50 个缺失项，超出部分汇总为 asset_batch
            if (missingCount <= 50) {
              result.assets.missing.push({
                type: 'asset',
                url: `https://resources.download.minecraft.net/${subDir}/${hash}`,
                path: assetPath,
                sha1: hash,
                size: info.size,
                name: name
              });
            }
          }
        }
        if (missingCount > 50) {
          result.assets.missing.push({
            type: 'asset_batch',
            count: missingCount - 50,
            message: `还有 ${missingCount - 50} 个资源文件缺失`
          });
        }
        result.assets.ok = missingCount === 0;
        if (missingCount > 0) {
          result.assets.message = `${missingCount} 个资源文件缺失`;
          result.missingFiles.push(...result.assets.missing.filter((f) => f.type !== 'asset_batch'));
        }
      } catch (e) {
        result.assets.ok = false;
        result.assets.message = '无法解析资源索引文件';
      }
    }
  }

  // 汇总所有检查项，得到 ready 标志
  result.ready = result.java.ok && result.versionJson.ok && result.mainJar.ok
    && result.libraries.ok && result.natives.ok && result.parentVersion.ok
    && result.assets.ok && result.forgeCore.ok && result.mrpackMods.ok;

  // 写入缓存，LRU 淘汰：超过 50 项时删除最旧
  ctx.caches._depCheckCache.set(_cacheKey, { result, ts: Date.now() });
  if (ctx.caches._depCheckCache.size > 50) {
    const oldest = ctx.caches._depCheckCache.keys().next().value;
    ctx.caches._depCheckCache.delete(oldest);
  }

  return result;
}

module.exports = {
  checkDependencies
};
