/**
 * @file server/java/java-version.js - Java 版本需求解析与版本信息检测
 * @description 从原 server/java.js 拆分：MC 版本解析、加载器检测、Java 版本范围计算、java -version 解析。
 */

const fs = require('fs');
const { execSync } = require('child_process');

/* Java 版本需求解析 */

/**
 * 获取版本所需的最低 Java 主版本号
 * @param {string} versionId - 版本 ID
 * @param {object} [versionJson=null] - 版本 JSON（已合并 inheritsFrom 链）
 * @returns {number} 最低 Java 主版本号
 */
function getRequiredJavaVersion(versionId, versionJson = null) {
  const range = getJavaVersionRange(versionId, versionJson);
  return range.min;
}

// 解析 MC 版本字符串为 { major, minor, patch }
function _parseMcVersion(verStr) {
  if (!verStr) return null;
  const parts = String(verStr).split(/[-_]/)[0].split('.').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  return { major: parts[0], minor: parts[1], patch: parts[2] || 0 };
}

// 比较两个 MC 版本字符串，返回 -1/0/1
function _compareVersion(aStr, bStr) {
  const a = _parseMcVersion(aStr);
  const b = _parseMcVersion(bStr);
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * 检测版本 JSON 中的加载器信息（Forge/NeoForge/Fabric/OptiFine/LiteLoader/launchwrapper）
 * @param {string} versionId - 版本 ID
 * @param {object} versionJson - 已合并 inheritsFrom 链的版本 JSON
 * @returns {{isForge: boolean, isNeoForge: boolean, isFabric: boolean, isOptiFine: boolean, isLiteLoader: boolean, isLegacyLaunchwrapper: boolean, baseVersion: string, forgeVersion: string}}
 */
function getLoaderInfoForJava(versionId, versionJson) {
  const result = { isForge: false, isNeoForge: false, isFabric: false, isOptiFine: false, isLiteLoader: false, isLegacyLaunchwrapper: false, baseVersion: '', forgeVersion: '' };
  if (!versionJson) return result;

  const versionIdLower = (versionId || '').toLowerCase();
  const mainClassLower = (versionJson.mainClass || '').toLowerCase();
  const libsArr = versionJson.libraries || [];
  const gameArgsArr = versionJson.arguments?.game || [];
  const gameArgsStr = JSON.stringify(gameArgsArr).toLowerCase();
  const isBootStrap = mainClassLower.includes('bootstraplauncher');

  // 扫描整个合并后 JSON 文本检测 Forge：不仅检查 libraries，还检查 arguments、mainClass 等所有字段
  const fullJsonStr = JSON.stringify(versionJson).toLowerCase();

  // launchwrapper 是 Java 9+ 不兼容的旧版加载器主类
  result.isLegacyLaunchwrapper = mainClassLower === 'net.minecraft.launchwrapper.launch' ||
    mainClassLower.includes('launchwrapper');

  result.isFabric = mainClassLower.includes('fabric') || versionIdLower.includes('fabric') ||
    fullJsonStr.includes('net.fabricmc:fabric-loader') || fullJsonStr.includes('org.quiltmc:quilt-loader');
  result.isOptiFine = versionIdLower.includes('optifine') || fullJsonStr.includes('optifine:optifine');
  result.isLiteLoader = versionIdLower.includes('liteloader') || fullJsonStr.includes('liteloader');

  // NeoForge 检测
  result.isNeoForge = versionIdLower.includes('neoforge') || fullJsonStr.includes('net.neoforge') ||
    gameArgsStr.includes('--fml.neoforgeversion') ||
    (isBootStrap && fullJsonStr.includes('neoforged'));

  // Forge 检测
  result.isForge = !result.isNeoForge && (
    mainClassLower.includes('forge') || mainClassLower.includes('modlauncher') ||
    versionIdLower.includes('forge') || fullJsonStr.includes('minecraftforge') ||
    (isBootStrap && (gameArgsStr.includes('--fml.forgeversion') || fullJsonStr.includes('net.minecraftforge')))
  );

  // mainClass 是 launchwrapper 但未通过其他方式检测到 Forge 的版本（旧版 Forge / LiteLoader / 自定义整合包）仍需 Java 8
  if (result.isLegacyLaunchwrapper && !result.isForge && !result.isLiteLoader && !result.isOptiFine && !result.isFabric && !result.isNeoForge) {
    result.isForge = fullJsonStr.includes('forge') || gameArgsStr.includes('fml');
  }

  // 解析基础 MC 版本：使用 fullJsonStr（整个合并后 JSON）确保匹配继承链中的 Forge 库
  // 注意：artifact 名后必须直接跟 ':'，避免 'forge' 误匹配 'forgespi'（forgespi 版本号是 7.0.1，
  // 会污染 baseVersion 导致 Java 版本范围误判为 21+，而 MC 1.20.1 实际只需 Java 17）
  if (result.isForge || result.isNeoForge) {
    const forgeMatch = fullJsonStr.match(/net\.minecraftforge:(?:forge|fmlloader):(\d+\.\d+(?:\.\d+)?)/);
    if (forgeMatch) {
      result.baseVersion = forgeMatch[1];
      // forgeVersion = 完整 artifact 版本（去掉 MC 版本前缀）
      // 如 "1.16.5-36.2.25" → baseVersion = "1.16.5", forgeVersion = "36.2.25"
      const forgeFullMatch = fullJsonStr.match(/net\.minecraftforge:(?:forge|fmlloader):([\d.]+(?:-[\d.]+)?)/);
      if (forgeFullMatch) {
        const full = forgeFullMatch[1];
        result.forgeVersion = full.startsWith(result.baseVersion + '-')
          ? full.slice(result.baseVersion.length + 1)
          : full;
      }
    } else {
      const fmlArg = gameArgsArr.find((a) => typeof a === 'string' && a.startsWith('--fml.mcVersion'));
      if (fmlArg) {
        const idx = gameArgsArr.indexOf(fmlArg);
        if (idx >= 0 && idx + 1 < gameArgsArr.length) result.baseVersion = gameArgsArr[idx + 1];
      }
      const forgeVerArg = gameArgsArr.find((a) => typeof a === 'string' && a.startsWith('--fml.forgeVersion'));
      if (forgeVerArg) {
        const idx = gameArgsArr.indexOf(forgeVerArg);
        if (idx >= 0 && idx + 1 < gameArgsArr.length) result.forgeVersion = gameArgsArr[idx + 1];
      }
    }
  } else if (result.isFabric) {
    const fabricMatch = fullJsonStr.match(/net\.fabricmc:(?:fabric-loader|intermediary):(\d+\.\d+(?:\.\d+)?)/);
    if (fabricMatch) result.baseVersion = fabricMatch[1];
  }

  if (!result.baseVersion) {
    if (versionJson.inheritsFrom) result.baseVersion = versionJson.inheritsFrom;
    else {
      const idMatch = (versionId || '').match(/(\d+\.\d+(?:\.\d+)?)/);
      if (idMatch) result.baseVersion = idMatch[1];
    }
  }

  return result;
}

/**
 * 计算版本所需的 Java 版本范围（min/max），综合 JSON 声明、MC 版本、加载器约束
 * @param {string} versionId - 版本 ID
 * @param {object} [versionJson=null] - 已合并 inheritsFrom 链的版本 JSON
 * @returns {{min: number, max: number, source: string}} Java 主版本范围与来源
 */
function getJavaVersionRange(versionId, versionJson = null) {
  const result = { min: 8, max: 999, source: 'default' };

  const loader = getLoaderInfoForJava(versionId, versionJson);
  const ver = _parseMcVersion(loader.baseVersion);

  // 1. JSON 中明确要求的 javaVersion（优先级最高）
  if (versionJson && versionJson.javaVersion && versionJson.javaVersion.majorVersion) {
    const majorVer = parseInt(versionJson.javaVersion.majorVersion, 10);
    if (majorVer > 0) {
      if (majorVer <= 8) {
        result.min = Math.max(result.min, 8);
      } else {
        result.min = Math.max(result.min, majorVer);
      }
      result.source = 'json';
    }
  }

  if (versionJson && versionJson.complianceLevel !== undefined) {
    const level = parseInt(versionJson.complianceLevel, 10);
    if (level === 0) { result.min = Math.max(result.min, 8); }
    else if (level >= 1 && level <= 6) { result.min = Math.max(result.min, 8); }
    else if (level === 7) { result.min = Math.max(result.min, 17); }
    else if (level >= 8) { result.min = Math.max(result.min, 21); }
  }

  // 检测 JVM 参数中的 Java 23+ 选项（如 --sun-misc-unsafe-memory-access）
  // 某些 Mod 加载器（如 NeoForge 26.x）的 version.json 声明 javaVersion=21 但实际
  // 包含 Java 23+ 的 JVM 参数，导致 Java 21 启动时报 "Unrecognized option" 崩溃
  if (versionJson && versionJson.arguments && Array.isArray(versionJson.arguments.jvm)) {
    const jvmArgsStr = JSON.stringify(versionJson.arguments.jvm);
    if (jvmArgsStr.includes('--sun-misc-unsafe-memory-access')) {
      result.min = Math.max(result.min, 23);
      result.source = 'jvm-args';
    }
  }

  if (ver) {
    // 1.20.5+：Java 21+
    if (ver.major >= 2) {
      // 新版本号体系（如 26.1.2）：需要 Java 25+（Java 25 为长期支持版本）
      result.min = Math.max(result.min, 25);
      result.source = 'mc-version';
    } else if (ver.major === 1 && (ver.minor > 20 || (ver.minor === 20 && ver.patch >= 5))) {
      // 1.20.5+ / 1.21.x：Java 21+
      result.min = Math.max(result.min, 21);
      result.source = 'mc-version';
    }
    // 1.18+：Java 17+
    else if (ver.major === 1 && ver.minor >= 18) {
      result.min = Math.max(result.min, 17);
      result.source = 'mc-version';
    }
    // 1.17+：Java 16+
    else if (ver.major === 1 && ver.minor === 17) {
      result.min = Math.max(result.min, 16);
      result.source = 'mc-version';
    }
    // 1.12+：Java 8+
    else if (ver.major === 1 && ver.minor >= 12) {
      result.min = Math.max(result.min, 8);
      if (result.source === 'default') result.source = 'mc-version';
    }
  }

  // 2. LiteLoader：最高 Java 8（与 launchwrapper 一样使用旧版 class loader）
  if (loader.isLiteLoader) {
    result.max = Math.min(result.max, 8);
    result.source = 'liteloader';
  }

  // 3. Forge 分支
  if (loader.isForge || loader.isNeoForge) {
    if (ver) {
      if (ver.major === 1 && ((ver.minor === 6 && ver.patch >= 1) || ver.minor === 7 && ver.patch <= 2)) {
        // 1.6.1 - 1.7.2：必须 Java 7
        result.min = Math.max(result.min, 7);
        result.max = Math.min(result.max, 7);
        result.source = 'forge';
      } else if (ver.major === 1 && ver.minor <= 12) {
        // <= 1.12.2：Java 8（launchwrapper 与 Java 9+ 不兼容）
        result.min = Math.min(result.min, 8);
        result.max = Math.min(result.max, 8);
        if (result.source === 'default' || result.source === 'mc-version') result.source = 'forge';
      } else if (ver.major === 1 && ver.minor === 13) {
        // 1.13 - 1.14：Java 8 - 10
        result.max = Math.min(result.max, 10);
        if (result.source === 'default' || result.source === 'mc-version') result.source = 'forge';
      } else if (ver.major === 1 && ver.minor === 14) {
        result.max = Math.min(result.max, 10);
        if (result.source === 'default' || result.source === 'mc-version') result.source = 'forge';
      } else if (ver.major === 1 && ver.minor === 15) {
        // 1.15：Java 8 - 15
        result.max = Math.min(result.max, 15);
        if (result.source === 'default' || result.source === 'mc-version') result.source = 'forge';
      } else if (ver.major === 1 && ver.minor === 16) {
        // 1.16：Forge 34.x ~ 36.2.25 最高 Java 8u321；高版本（36.2.26+）支持 Java 17
        const forgeVer = String(loader.forgeVersion || '');
        const cmMin = _compareVersion(forgeVer, '34.0.0');
        const cmMax = _compareVersion('36.2.25', forgeVer);
        if (cmMin >= 0 && cmMax >= 0) {
          // 1.16 Forge 34.x ~ 36.2.25：必须 Java 8u141 ~ 8u320
          result.min = Math.max(result.min, 8);
          result.max = Math.min(result.max, 8);
          result.source = 'forge';
        }
      } else if (ver.major === 1 && ver.minor >= 17) {
        // 1.17+：Forge 已支持 Java 16+/17+
        if (ver.minor >= 18) result.min = Math.max(result.min, 17);
        else if (ver.minor === 17) result.min = Math.max(result.min, 16);
        if (result.source === 'default' || result.source === 'mc-version') result.source = 'forge';
      }
    }
  }

  // 4. OptiFine 强制约束
  if (loader.isOptiFine && ver) {
    if (ver.major === 1 && ver.minor < 7) {
      // <1.7：至多 Java 8
      result.max = Math.min(result.max, 8);
      result.source = 'optifine';
    } else if (ver.major === 1 && ver.minor >= 8 && ver.minor <= 11) {
      // 1.8 - 1.11：必须 Java 8
      result.min = Math.max(result.min, 8);
      result.max = Math.min(result.max, 8);
      result.source = 'optifine';
    } else if (ver.major === 1 && ver.minor === 12) {
      // 1.12：最高 Java 8
      result.max = Math.min(result.max, 8);
      result.source = 'optifine';
    } else if (ver.major === 1 && ver.minor === 18) {
      // 1.18 + OptiFine：最高 Java 18
      result.max = Math.min(result.max, 18);
      result.source = 'optifine';
    }
  }

  // 5. launchwrapper（旧版 Forge / LiteLoader / 自定义整合包）与 Java 9+ 不兼容
  //    AppClassLoader → URLClassLoader 强转在 Java 9+ 会崩溃，最高优先级安全约束
  if (loader.isLegacyLaunchwrapper) {
    result.max = Math.min(result.max, 8);
    result.source = 'launchwrapper';
  }

  // 兜底
  if (result.min > result.max) result.max = result.min;
  return result;
}

/* Java 版本信息检测 */

/**
 * 获取 Java 主版本号
 * @param {string} javaPath - java 可执行文件路径
 * @returns {number} Java 主版本号（如 8、17、21），失败返回 0
 */
function getJavaMajorVersion(javaPath) {
  return getJavaVersionInfo(javaPath).major;
}

/**
 * 执行 `java -version` 解析 Java 版本信息
 * @param {string} javaPath - java 可执行文件路径
 * @returns {{major: number, minor: number, version: string}} 版本信息，失败返回 major=0
 */
function getJavaVersionInfo(javaPath) {
  const result = { major: 0, minor: 0, version: 'unknown' };
  if (!javaPath || !fs.existsSync(javaPath)) return result;
  try {
    const output = execSync(`"${javaPath}" -version 2>&1`, { encoding: 'utf8', timeout: 10000 });
    const m = (output || '').match(/version "([^"]+)"/) || (output || '').match(/version (\S+)/);
    if (m) {
      const versionStr = m[1];
      result.version = versionStr;
      if (versionStr.startsWith('1.')) {
        // 旧式版本号 1.8.0_301 → major=8, minor=301
        result.major = parseInt(versionStr.split('.')[1], 10) || 0;
        const upd = versionStr.match(/_(\d+)/);
        if (upd) result.minor = parseInt(upd[1], 10);
      } else {
        // 新式版本号 17.0.1 → major=17, minor=0
        result.major = parseInt(versionStr.split('.')[0], 10) || 0;
        const minorPart = versionStr.split('.')[1];
        if (minorPart) result.minor = parseInt(minorPart, 10) || 0;
      }
    }
  } catch (e) {
    // execSync 在非零退出码时抛错，但 stderr 里仍包含版本信息
    const errOutput = (e.stderr || e.stdout || e.output?.[2] || '').toString();
    const m = errOutput.match(/version "([^"]+)"/) || errOutput.match(/version (\S+)/);
    if (m) {
      const versionStr = m[1];
      result.version = versionStr;
      if (versionStr.startsWith('1.')) {
        result.major = parseInt(versionStr.split('.')[1], 10) || 0;
        const upd = versionStr.match(/_(\d+)/);
        if (upd) result.minor = parseInt(upd[1], 10);
      } else {
        result.major = parseInt(versionStr.split('.')[0], 10) || 0;
        const minorPart = versionStr.split('.')[1];
        if (minorPart) result.minor = parseInt(minorPart, 10) || 0;
      }
    }
  }
  return result;
}

module.exports = {
  getRequiredJavaVersion,
  _parseMcVersion,
  _compareVersion,
  getLoaderInfoForJava,
  getJavaVersionRange,
  getJavaMajorVersion,
  getJavaVersionInfo
};
