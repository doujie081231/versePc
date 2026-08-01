/**
 * @file server/java/java-runtime.js - Java 运行时选择与环境配置
 * @description 从原 server/java.js 拆分：Classpath wrapper JAR 生成、按版本选择 Java、依赖检查缓存失效、系统环境变量配置。
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ctx = require('../context');
const versions = require('../versions');
const { getJavaVersionRange, getJavaVersionInfo } = require('./java-version');
const { detectSystemJava, detectBundledJava } = require('./java-detect');

/* Classpath Wrapper JAR */

/**
 * 生成仅含 MANIFEST.MF 的 wrapper JAR，用 Class-Path 把超长 classpath 转嫁出去
 * @param {string} classpathStr - 原始 classpath 字符串（分号或冒号分隔）
 * @param {string} wrapperJarPath - 输出 wrapper JAR 路径
 * @param {string} mainClass - 主类全限定名
 */
function createClasspathWrapperJar(classpathStr, wrapperJarPath, mainClass) {
  const separator = process.platform === 'win32' ? ';' : ':';
  const entries = classpathStr.split(separator).filter((e) => e.trim());
  const classPathLine = entries.map((e) => {
    let p = e.replace(/\\/g, '/');
    p = p.replace(/ /g, '%20');
    return p;
  }).join(' ');

  // JAR Manifest 规范：每行最多 70 字节，超出需按 69 字节续行（前导空格）
  function wrapManifestLine(line) {
    if (line.length <= 70) return line;
    let result = line.substring(0, 70);
    line = line.substring(70);
    while (line.length > 0) {
      const chunkSize = Math.min(69, line.length);
      result += '\r\n ' + line.substring(0, chunkSize);
      line = line.substring(chunkSize);
    }
    return result;
  }

  const classPathWrapped = wrapManifestLine(classPathLine);
  const manifest = `Manifest-Version: 1.0\r\nClass-Path: ${classPathWrapped}\r\nMain-Class: ${mainClass}\r\n`;

  const AdmZip = require('adm-zip');
  const zip = new AdmZip();
  zip.addFile('META-INF/MANIFEST.MF', Buffer.from(manifest, 'utf-8'));
  zip.writeZip(wrapperJarPath);
}

/* Java 选择 */

/**
 * 为指定版本选择最合适的 Java 运行时：扫描用户设置、JAVA_DIR、runtime 目录、.minecraft/runtime、系统 PATH
 * @param {string} versionId - 版本 ID
 * @param {object} settings - 全局设置
 * @param {object} [versionJson=null] - 已合并的版本 JSON
 * @param {string} [externalVersionDir=null] - 外部版本目录
 * @returns {{javaPath: string, majorVersion: number, is64Bit: boolean, isJdk: boolean, source: string, warning?: string}}
 */
function selectJavaForVersion(versionId, settings, versionJson = null, externalVersionDir = null) {
  if (!versionJson) {
    versionJson = versions.resolveVersionJson(versionId, externalVersionDir);
  }
  const range = getJavaVersionRange(versionId, versionJson);
  const requiredVersion = range.min;
  const maxVersion = range.max;

  let candidates = [];
  const javaExeName = process.platform === 'win32' ? 'java.exe' : 'java';

  if (fs.existsSync(ctx.dirs.JAVA_DIR)) {
    try {
      const javaDirs = fs.readdirSync(ctx.dirs.JAVA_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
      for (const jd of javaDirs) {
        const javaExe = path.join(ctx.dirs.JAVA_DIR, jd.name, 'bin', javaExeName);
        if (!fs.existsSync(javaExe)) continue;
        const info = getJavaVersionInfo(javaExe);
        if (info.major > 0) {
          const norm = javaExe.toLowerCase().replace(/\\/g, '/');
          if (!candidates.some((c) => c.path.toLowerCase().replace(/\\/g, '/') === norm)) {
            candidates.push({ path: javaExe, majorVersion: info.major, minorVersion: info.minor, is64Bit: true, isJdk: true, source: 'bundled' });
          }
        }
      }
    } catch (e) {}
  }

  const runtimeDir = path.join(ctx.dirs.DATA_DIR, 'runtime');
  if (fs.existsSync(runtimeDir)) {
    const _scanRuntimeDir = (dir, depth) => {
      if (depth <= 0 || !fs.existsSync(dir)) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const subDir = path.join(dir, entry.name);
          if (entry.name.toLowerCase() === 'bin') {
            const javaExe = path.join(subDir, javaExeName);
            if (fs.existsSync(javaExe)) {
              const info = getJavaVersionInfo(javaExe);
              if (info.major > 0) {
                const norm = javaExe.toLowerCase().replace(/\\/g, '/');
                if (!candidates.some((c) => c.path.toLowerCase().replace(/\\/g, '/') === norm)) {
                  candidates.push({ path: javaExe, majorVersion: info.major, minorVersion: info.minor, is64Bit: true, isJdk: true, source: 'bundled' });
                }
              }
            }
          } else {
            _scanRuntimeDir(subDir, depth - 1);
          }
        }
      } catch (e) {}
    };
    _scanRuntimeDir(runtimeDir, 5);
  }

  const mcRuntime = path.join(ctx.dirs.MINECRAFT_DIR, 'runtime');
  if (fs.existsSync(mcRuntime)) {
    const _scanMcRuntime = (dir, depth) => {
      if (depth <= 0 || !fs.existsSync(dir)) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const subDir = path.join(dir, entry.name);
          if (entry.name.toLowerCase() === 'bin') {
            const javaExe = path.join(subDir, javaExeName);
            if (fs.existsSync(javaExe)) {
              const info = getJavaVersionInfo(javaExe);
              if (info.major > 0) {
                const norm = javaExe.toLowerCase().replace(/\\/g, '/');
                if (!candidates.some((c) => c.path.toLowerCase().replace(/\\/g, '/') === norm)) {
                  candidates.push({ path: javaExe, majorVersion: info.major, minorVersion: info.minor, is64Bit: true, isJdk: true, source: 'bundled' });
                }
              }
            }
          } else {
            _scanMcRuntime(subDir, depth - 1);
          }
        }
      } catch (e) {}
    };
    _scanMcRuntime(mcRuntime, 5);
  }

  const mcRuntimeRoaming = path.join(process.env.APPDATA || '', '.minecraft', 'runtime');
  if (fs.existsSync(mcRuntimeRoaming)) {
    const _scanRoaming = (dir, depth) => {
      if (depth <= 0 || !fs.existsSync(dir)) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const subDir = path.join(dir, entry.name);
          if (entry.name.toLowerCase() === 'bin') {
            const javaExe = path.join(subDir, javaExeName);
            if (fs.existsSync(javaExe)) {
              const info = getJavaVersionInfo(javaExe);
              if (info.major > 0) {
                const norm = javaExe.toLowerCase().replace(/\\/g, '/');
                if (!candidates.some((c) => c.path.toLowerCase().replace(/\\/g, '/') === norm)) {
                  candidates.push({ path: javaExe, majorVersion: info.major, minorVersion: info.minor, is64Bit: true, isJdk: true, source: 'bundled' });
                }
              }
            }
          } else {
            _scanRoaming(subDir, depth - 1);
          }
        }
      } catch (e) {}
    };
    _scanRoaming(mcRuntimeRoaming, 5);
  }

  let systemJava = [];
  let bundledJava = [];

  systemJava = detectSystemJava();
  bundledJava = detectBundledJava();
  for (const j of [...bundledJava, ...systemJava]) {
    const norm = j.path.toLowerCase().replace(/\\/g, '/');
    if (!candidates.some((c) => c.path.toLowerCase().replace(/\\/g, '/') === norm)) {
      candidates.push(j);
    }
  }

  const suitable = candidates.filter((j) => j.majorVersion >= requiredVersion && j.majorVersion <= maxVersion);

  if (suitable.length === 0) {
    // 候选全空时的备用检测：where java、注册表、常见安装路径深度扫描
    try {
      const { execSync } = require('child_process');
      const whereOut = execSync('where java 2>nul', { encoding: 'utf8', timeout: 5000, windowsHide: true });
      const whereLines = whereOut.split(/\r?\n/).filter((l) => l.trim());
      for (const line of whereLines) {
        const trimmed = line.trim();
        if (trimmed && fs.existsSync(trimmed)) {
          const info = getJavaVersionInfo(trimmed);
          if (info.major >= requiredVersion && info.major <= maxVersion) {
            return trimmed;
          }
        }
      }
    } catch (e) {}

    if (process.platform === 'win32') {
      try {
        const { execSync: _execSync } = require('child_process');
        const regOutput = _execSync(
          'reg query "HKLM\\SOFTWARE\\JavaSoft\\Java Runtime Environment" /s 2>nul',
          { encoding: 'utf8', timeout: 5000, windowsHide: true }
        );
        const javaHomeMatches = regOutput.matchAll(/JavaHome\s+REG_SZ\s+(.+)/gi);
        for (const m of javaHomeMatches) {
          const javaHome = m[1].trim();
          const javaExe = path.join(javaHome, 'bin', 'java.exe');
          if (fs.existsSync(javaExe)) {
            const info = getJavaVersionInfo(javaExe);
            if (info.major >= requiredVersion && info.major <= maxVersion) return javaExe;
          }
        }
      } catch (e) {}
      try {
        const { execSync: _execSync } = require('child_process');
        const regOutput64 = _execSync(
          'reg query "HKLM\\SOFTWARE\\Wow6432Node\\JavaSoft\\Java Runtime Environment" /s 2>nul',
          { encoding: 'utf8', timeout: 5000, windowsHide: true }
        );
        const javaHomeMatches64 = regOutput64.matchAll(/JavaHome\s+REG_SZ\s+(.+)/gi);
        for (const m of javaHomeMatches64) {
          const javaHome = m[1].trim();
          const javaExe = path.join(javaHome, 'bin', 'java.exe');
          if (fs.existsSync(javaExe)) {
            const info = getJavaVersionInfo(javaExe);
            if (info.major >= requiredVersion && info.major <= maxVersion) return javaExe;
          }
        }
      } catch (e) {}
    }

    const appData = process.env['APPDATA'] || '';
    const localAppData = process.env['LOCALAPPDATA'] || '';
    const fallbackSearchPaths = [
      'C:\\Program Files\\Java', 'C:\\Program Files (x86)\\Java',
      'C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\AdoptOpenJDK',
      'C:\\Program Files\\Zulu', 'C:\\Program Files\\BellSoft',
      'D:\\Java', 'E:\\Java',
      path.join(process.env.USERPROFILE || '', '.jdks'),
      path.join(process.env.USERPROFILE || '', 'scoop', 'apps'),
      path.join(appData, '.minecraft', 'runtime'),
      path.join(appData, '.hmcl', 'runtime'),
      path.join(localAppData, 'BakaXL', 'JavaRuntime'),
      path.join(appData, '.versepc', 'runtime'), // 兼容旧版安装路径
      ctx.dirs.JAVA_DIR, // 便携模式/新装用户的 Java 目录
    ];
    const javaExeName = process.platform === 'win32' ? 'java.exe' : 'java';
    const checkedPaths = new Set();
    function _fallbackDeepSearch(dir, depth) {
      if (depth <= 0 || !fs.existsSync(dir)) return null;
      const normDir = dir.toLowerCase().replace(/\\/g, '/');
      if (checkedPaths.has(normDir)) return null;
      checkedPaths.add(normDir);
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const subDir = path.join(dir, entry.name);
          if (entry.name.toLowerCase() === 'bin') {
            const javaExe = path.join(subDir, javaExeName);
            if (fs.existsSync(javaExe)) {
              const info = getJavaVersionInfo(javaExe);
              if (info.major >= requiredVersion && info.major <= maxVersion) return javaExe;
            }
          } else {
            const result = _fallbackDeepSearch(subDir, depth - 1);
            if (result) return result;
          }
        }
      } catch (e) {}
      return null;
    }
    for (const sp of fallbackSearchPaths) {
      if (!fs.existsSync(sp)) continue;
      const found = _fallbackDeepSearch(sp, 6);
      if (found) {
        return found;
      }
    }

    return null;
  }

  // 排序策略：1) 主版本距离要求最近 2) 启动器自带 Java 优先 3) 64 位优先 4) 范围内最高小版本号
  suitable.sort((a, b) => {
    const aDist = Math.abs(a.majorVersion - requiredVersion);
    const bDist = Math.abs(b.majorVersion - requiredVersion);
    if (aDist !== bDist) return aDist - bDist;

    const aInLauncher = (a.path || '').toLowerCase().includes(ctx.dirs.DATA_DIR.toLowerCase()) ? 0 : 1;
    const bInLauncher = (b.path || '').toLowerCase().includes(ctx.dirs.DATA_DIR.toLowerCase()) ? 0 : 1;
    if (aInLauncher !== bInLauncher) return aInLauncher - bInLauncher;

    if (a.is64Bit !== b.is64Bit) return a.is64Bit ? -1 : 1;
    // 同主版本优先选较高小版本（如 Java 8u362 > 8u51）
    if (a.majorVersion === b.majorVersion) {
      return (b.minorVersion || 0) - (a.minorVersion || 0);
    }
    // 不同主版本优先选择较低的（避免 Java 17 跑 1.12 兼容问题）
    return a.majorVersion - b.majorVersion;
  });

  const chosen = suitable[0];

  return chosen.path;
}

/* 依赖检查缓存失效 */

/**
 * 清除指定版本的依赖检查缓存
 * @param {string} versionId - 版本 ID
 */
function invalidateDepCheckCache(versionId) {
  for (const key of ctx.caches._depCheckCache.keys()) {
    if (key.startsWith(versionId + ':')) {
      ctx.caches._depCheckCache.delete(key);
    }
  }
}

/* Java 环境变量配置 */

/**
 * 配置系统环境变量（PATH、JAVA_HOME），仅 Windows 有效
 * @param {string} javaHome - JDK 安装根目录
 * @param {number} majorVersion - Java 主版本号（用于版本比较）
 * @returns {Promise<{success: boolean, javaHome?: string, binPath?: string, message?: string}>}
 */
function configureJavaEnv(javaHome, majorVersion) {
  if (process.platform !== 'win32') {
    return Promise.resolve({ success: false, message: '非Windows平台，跳过环境变量配置' });
  }

  const javaBinDir = path.join(javaHome, 'bin');
  if (!fs.existsSync(javaBinDir)) {
    return Promise.reject(new Error(`Java bin目录不存在: ${javaBinDir}`));
  }

  // 把 exec 包成 Promise，便于在 async 流程里 await
  const execAsync = (cmd) => new Promise((resolve, reject) => {
    exec(cmd, { encoding: 'utf8', timeout: 15000, windowsHide: true }, (err, stdout) => {
      if (err) reject(err); else resolve(stdout.trim());
    });
  });

  return (async () => {
    // 路径归一化：统一小写、斜杠、去尾斜杠，用于 PATH 去重比较
    const normalizedJavaBin = javaBinDir.toLowerCase().replace(/\\/g, '/').replace(/\/$/, '');

    // 1. 系统 PATH：检查是否已包含，未包含则追加
    try {
      const currentPath = await execAsync(`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('Path', 'Machine')"`);
      const pathEntries = currentPath.split(';').filter((p) => p.trim() !== '');
      const alreadyInPath = pathEntries.some((p) =>
        p.toLowerCase().replace(/\\/g, '/').replace(/\/$/, '') === normalizedJavaBin
      );

      if (alreadyInPath) {
      } else {
        // 末尾已有 ; 时直接拼接，否则补一个分隔符
        const newPath = currentPath.endsWith(';')
          ? currentPath + javaBinDir
          : currentPath + ';' + javaBinDir;
        await execAsync(`powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('Path', '${newPath.replace(/'/g, "''")}', 'Machine')"`);
      }
    } catch (e) {
      console.warn(`[JavaEnv] PATH配置失败(不影响): ${e.message}`);
    }

    // 2. JAVA_HOME：仅在不存在或新版本更高时更新，避免覆盖更高版本
    try {
      const currentJavaHome = await execAsync(`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('JAVA_HOME', 'Machine')"`);
      const normalizedJavaHome = javaHome.toLowerCase().replace(/\\/g, '/').replace(/\/$/, '');
      const currentJavaHomeNorm = currentJavaHome.toLowerCase().replace(/\\/g, '/').replace(/\/$/, '');

      if (currentJavaHome && currentJavaHomeNorm !== normalizedJavaHome) {
        // 从路径中提取主版本号比较：jdk-17、jdk8 等命名都按数字解析
        const existingMajorMatch = currentJavaHome.match(/jdk[-]?(\d+)/i);
        const newMajorMatch = javaHome.match(/jdk[-]?(\d+)/i);
        const existingMajor = existingMajorMatch ? parseInt(existingMajorMatch[1], 10) : 0;
        const newMajor = newMajorMatch ? parseInt(newMajorMatch[1], 10) : 0;

        if (newMajor >= existingMajor) {
          await execAsync(`powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('JAVA_HOME', '${javaHome.replace(/'/g, "''")}', 'Machine')"`);
        }
      } else if (!currentJavaHome) {
        await execAsync(`powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('JAVA_HOME', '${javaHome.replace(/'/g, "''")}', 'Machine')"`);
      }
    } catch (e) {
      console.warn(`[JavaEnv] JAVA_HOME配置失败(不影响): ${e.message}`);
    }

    // 3. 用户 PATH：作为系统 PATH 的补充，确保当前用户命令行也能用
    try {
      const currentUserPath = await execAsync(`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('Path', 'User')"`);
      const userPathEntries = currentUserPath.split(';').filter((p) => p.trim() !== '');
      const inUserPath = userPathEntries.some((p) =>
        p.toLowerCase().replace(/\\/g, '/').replace(/\/$/, '') === normalizedJavaBin
      );
      if (!inUserPath) {
        const newUserPath = currentUserPath.endsWith(';')
          ? currentUserPath + javaBinDir
          : currentUserPath + ';' + javaBinDir;
        await execAsync(`powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('Path', '${newUserPath.replace(/'/g, "''")}', 'User')"`);
      }
    } catch (e) {
      console.warn(`[JavaEnv] 用户PATH配置失败(不影响): ${e.message}`);
    }

    // 4. 当前进程环境变量：让本进程后续 spawn 的子进程立即生效
    try {
      process.env.PATH = javaBinDir + ';' + (process.env.PATH || '');
      process.env.JAVA_HOME = javaHome;
    } catch (e) {
      console.warn(`[JavaEnv] 进程环境变量更新失败: ${e.message}`);
    }

    return { success: true, javaHome, binPath: javaBinDir };
  })();
}

module.exports = {
  createClasspathWrapperJar,
  selectJavaForVersion,
  invalidateDepCheckCache,
  configureJavaEnv
};
