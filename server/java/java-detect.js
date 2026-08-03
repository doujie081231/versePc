/**
 * @file server/java/java-detect.js - 系统与自带 Java 检测
 * @description 从原 server/java.js 拆分：扫描系统已安装的 Java（PATH/注册表/常见目录）、启动器自带 Java 与 Mojang runtime。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ctx = require('../context');
const { getJavaVersionInfo } = require('./java-version');

/* 系统 Java 检测 */

/**
 * 扫描系统已安装的 Java（PATH、注册表、常见安装目录、第三方启动器 runtime）
 * @returns {Array<{path: string, majorVersion: number, minorVersion: number, is64Bit: boolean, isJdk: boolean, source: string}>}
 */
function detectSystemJava() {
  const results = [];
  const foundPaths = new Set();

  function addJavaEntry(javaExe, source) {
    const normalized = javaExe.toLowerCase().replace(/\\/g, '/').replace(/\/$/, '');
    if (foundPaths.has(normalized)) return;
    foundPaths.add(normalized);

    if (!fs.existsSync(javaExe)) return;

    try {
      const folder = path.dirname(javaExe);
      const folderLower = folder.toLowerCase();
      // 排除 FinalShell、Paranoia 等携带 JDK 的非 Java 工具，避免误识别
      if (folderLower.includes('finalshell') || folderLower.includes('paranoia')) return;
      if (fs.existsSync(path.join(folder, 'pdf-bookmark'))) return;

      let version = 'unknown';
      let majorVersion = 0;
      let minorVersion = 0;

      const javaHome = path.dirname(folder);
      const releaseFile = path.join(javaHome, 'release');
      if (fs.existsSync(releaseFile)) {
        try {
          const content = fs.readFileSync(releaseFile, 'utf8');
          const match = content.match(/JAVA_VERSION="([^"]+)"/);
          if (match) {
            version = match[1];
            if (version.startsWith('1.')) {
              majorVersion = parseInt(version.split('.')[1], 10);
              const upd = version.match(/_(\d+)/);
              if (upd) minorVersion = parseInt(upd[1], 10);
            } else {
              majorVersion = parseInt(version.split('.')[0], 10);
              const minorPart = version.split('.')[1];
              if (minorPart) minorVersion = parseInt(minorPart, 10) || 0;
            }
          }
        } catch (e) {}
      }

      // release 文件缺失或解析失败时，回退到 java -version
      if (majorVersion <= 0) {
        try {
          const versionOutput = execSync(`"${javaExe}" -version 2>&1`, { encoding: 'utf8', timeout: 5000, windowsHide: true });
          const versionMatch = versionOutput.match(/version "([^"]+)"/) || versionOutput.match(/version (\S+)/);
          if (!versionMatch) return;
          version = versionMatch[1];
          if (version.startsWith('1.')) {
            majorVersion = parseInt(version.split('.')[1], 10);
            const upd = version.match(/_(\d+)/);
            if (upd) minorVersion = parseInt(upd[1], 10);
          } else {
            majorVersion = parseInt(version.split('.')[0], 10);
            const minorPart = version.split('.')[1];
            if (minorPart) minorVersion = parseInt(minorPart, 10) || 0;
          }
        } catch (e) {}
      }

      if (isNaN(majorVersion) || majorVersion <= 0) return;

      const isJdk = fs.existsSync(path.join(javaHome, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac'));

      // 通过 -XshowSettings:properties 检测 64 位；失败则回退到 -version 输出文本匹配
      let is64Bit = true;
      try {
        const archOutput = execSync(`"${javaExe}" -XshowSettings:properties -version 2>&1`, { encoding: 'utf8', timeout: 5000, windowsHide: true });
        is64Bit = archOutput.includes('os.arch = x86_64') || archOutput.includes('os.arch = amd64') || archOutput.includes('64-bit');
      } catch (e) {
        try {
          const vOutput = execSync(`"${javaExe}" -version 2>&1`, { encoding: 'utf8', timeout: 5000, windowsHide: true });
          is64Bit = vOutput.includes('64-Bit') || vOutput.includes('64-bit');
        } catch (e2) {}
      }

      results.push({
        path: javaExe,
        version: version,
        majorVersion: majorVersion,
        minorVersion: minorVersion,
        is64Bit: is64Bit,
        isJdk: isJdk,
        source: source,
        javaHome: javaHome
      });
    } catch (e) {}
  }

  // 递归扫描文件夹，命中 bin/java 或疑似 Java 目录名时调用 addJavaEntry
  function searchFolderForJava(basePath, depth) {
    if (depth <= 0 || !fs.existsSync(basePath)) return;
    try {
      const entries = fs.readdirSync(basePath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dirName = entry.name.toLowerCase();
        const fullPath = path.join(basePath, entry.name);
        const javaExeName = process.platform === 'win32' ? 'java.exe' : 'java';

        if (dirName === 'bin') {
          const javaExe = path.join(fullPath, javaExeName);
          if (fs.existsSync(javaExe)) {
            addJavaEntry(javaExe, 'system');
          }
          continue;
        }

        const isJavaRelated = ['java', 'jdk', 'jre', 'jvm', 'runtime', 'adopt', 'temurin', 'corretto', 'zulu', 'openjdk', 'graalvm', 'liberica', 'microsoft', 'amazon', 'sapmachine', 'dragonwell', 'bisheng', 'windows-x64', 'windows-arm64', 'windows-x86'].some((kw) => dirName.includes(kw));
        const isVersionDir = /^jdk[-_]?\d/i.test(dirName) || /^jre[-_]?\d/i.test(dirName) || /^\d+([._]\d+)*$/i.test(dirName);

        if (isJavaRelated || isVersionDir) {
          const javaExe = path.join(fullPath, 'bin', javaExeName);
          if (fs.existsSync(javaExe)) {
            addJavaEntry(javaExe, 'system');
          }
          searchFolderForJava(fullPath, depth - 1);
        }
      }
    } catch (e) {}
  }

  // 1. 环境变量 JAVA_HOME / JDK_HOME
  if (process.env.JAVA_HOME) {
    const javaHome = process.env.JAVA_HOME.replace(/["']/g, '').replace(/\\$/, '').replace(/\/$/, '');
    const javaExe = path.join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
    addJavaEntry(javaExe, 'system');
  }

  if (process.env.JDK_HOME) {
    const jdkHome = process.env.JDK_HOME.replace(/["']/g, '').replace(/\\$/, '').replace(/\/$/, '');
    const javaExe = path.join(jdkHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
    addJavaEntry(javaExe, 'system');
  }

  // 2. PATH 中的 java；若父目录疑似 Java 目录也尝试 bin/java
  if (process.env.PATH) {
    const pathDirs = process.env.PATH.split(path.delimiter);
    for (const dir of pathDirs) {
      const trimmed = dir.trim().replace(/["']/g, '');
      if (!trimmed) continue;
      const javaExe = path.join(trimmed, process.platform === 'win32' ? 'java.exe' : 'java');
      if (fs.existsSync(javaExe)) {
        addJavaEntry(javaExe, 'system');
      }
      const parentDir = path.dirname(trimmed);
      if (trimmed.toLowerCase().includes('java') || trimmed.toLowerCase().includes('jdk')) {
        const parentJavaExe = path.join(parentDir, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
        addJavaEntry(parentJavaExe, 'system');
      }
    }
  }

  // 3. Windows：注册表 + Program Files + AppData + Microsoft Store + where java + 全盘扫描
  if (process.platform === 'win32') {
    try {
      const regOutput = execSync(
        `reg query "HKLM\\SOFTWARE\\JavaSoft\\Java Runtime Environment" /s 2>nul || reg query "HKLM\\SOFTWARE\\JavaSoft\\JDK" /s 2>nul || reg query "HKLM\\SOFTWARE\\JavaSoft\\Java Development Kit" /s 2>nul`,
        { encoding: 'utf8', timeout: 5000, windowsHide: true }
      );
      const javaHomeMatches = regOutput.matchAll(/JavaHome\s+REG_SZ\s+(.+)/gi);
      for (const m of javaHomeMatches) {
        const javaHome = m[1].trim();
        addJavaEntry(path.join(javaHome, 'bin', 'java.exe'), 'system');
      }
    } catch (e) {}

    try {
      const regOutput64 = execSync(
        `reg query "HKLM\\SOFTWARE\\Wow6432Node\\JavaSoft\\Java Runtime Environment" /s 2>nul || reg query "HKLM\\SOFTWARE\\Wow6432Node\\JavaSoft\\JDK" /s 2>nul`,
        { encoding: 'utf8', timeout: 5000, windowsHide: true }
      );
      const javaHomeMatches = regOutput64.matchAll(/JavaHome\s+REG_SZ\s+(.+)/gi);
      for (const m of javaHomeMatches) {
        const javaHome = m[1].trim();
        addJavaEntry(path.join(javaHome, 'bin', 'java.exe'), 'system');
      }
    } catch (e) {}

    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    for (const pf of [programFiles, programFilesX86]) {
      if (fs.existsSync(pf)) {
        try {
          fs.readdirSync(pf).forEach((d) => {
            const dirLower = d.toLowerCase();
            if (['java', 'jdk', 'jre', 'adopt', 'temurin', 'corretto', 'zulu', 'amazon', 'microsoft', 'sapmachine', 'bellsoft', 'graalvm', 'dragonwell'].some((kw) => dirLower.includes(kw))) {
              searchFolderForJava(path.join(pf, d), 2);
            }
          });
        } catch (e) {}
      }
    }

    const appData = process.env['APPDATA'] || '';
    const localAppData = process.env['LOCALAPPDATA'] || '';
    const userProfile = process.env['USERPROFILE'] || '';

    if (appData) searchFolderForJava(appData, 2);
    if (localAppData) searchFolderForJava(localAppData, 2);

    const minecraftRuntime = path.join(appData, '.minecraft', 'runtime');
    if (fs.existsSync(minecraftRuntime)) {
      searchFolderForJava(minecraftRuntime, 3);
    }

    const launcherRuntime = path.join(ctx.dirs.DATA_DIR, 'runtime');
    if (fs.existsSync(launcherRuntime)) {
      searchFolderForJava(launcherRuntime, 3);
    }

    // JetBrains Toolbox 自带 JBR
    const jbrPaths = [
      path.join(localAppData, 'JetBrains', 'Toolbox', 'apps', 'JBR'),
      path.join(programFiles, 'JetBrains'),
    ];
    for (const jbrPath of jbrPaths) {
      if (fs.existsSync(jbrPath)) {
        searchFolderForJava(jbrPath, 3);
      }
    }

    const documents = process.env['USERPROFILE'] ? path.join(process.env['USERPROFILE'], 'Documents') : '';
    const additionalPaths = [
      'C:\\Java', 'D:\\Java', 'E:\\Java', 'F:\\Java',
      path.join(userProfile, 'Java'),
      path.join(userProfile, '.jdks'),
      path.join(userProfile, '.sdkman', 'candidates', 'java'),
      path.join(userProfile, 'scoop', 'apps', 'openjdk'),
      path.join(localAppData, 'Programs'),
      'C:\\ProgramData\\Oracle\\Java',
      // 各主流启动器自带 Java 运行时目录
      path.join(appData, '.minecraft', 'runtime'),
      path.join(appData, '.hmcl', 'runtime'),
      path.join(appData, '.hmcl', 'java'),
      path.join(appData, 'ATLauncher', 'runtimes', 'minecraft'),
      path.join(appData, 'ModrinthApp', 'meta', 'java_versions'),
      path.join(appData, 'PrismLauncher', 'java'),
      path.join(appData, 'curseforge', 'minecraft', 'Install', 'runtime'),
      path.join(localAppData, 'BakaXL', 'JavaRuntime'),
      path.join(localAppData, '.ftba', 'bin', 'runtime'),
      path.join(localAppData, 'Packages', 'Microsoft.4297127D64EC6_8wekyb3d8bbwe', 'LocalCache', 'Local', 'runtime'),
      path.join(programFilesX86, 'Minecraft Launcher', 'runtime'),
      path.join(programFilesX86, 'Minecraft', 'runtime'),
      path.join(programFiles, 'Minecraft Launcher', 'runtime'),
      path.join(programFiles, 'Minecraft', 'runtime'),
    ];
    if (documents) {
      additionalPaths.push(path.join(documents, 'Curse', 'Minecraft', 'Install', 'runtime'));
    }

    for (const searchPath of additionalPaths) {
      if (fs.existsSync(searchPath)) {
        searchFolderForJava(searchPath, 3);
      }
    }

    if (userProfile) searchFolderForJava(userProfile, 2);

    // Microsoft Store 版 Minecraft 自带 runtime
    const msStorePaths = [
      path.join(localAppData, 'Packages', 'Microsoft.4297127D64EC6_8wekyb3d8bbwe', 'LocalCache', 'Local', 'runtime'),
      path.join(localAppData, 'Packages', 'Microsoft.4297127D64EC6_8wekyb3d8bbwe', 'LocalCache', 'Local', 'runtime', 'java-runtime-gamma', 'windows-x64'),
      path.join(localAppData, 'Packages', 'Microsoft.4297127D64EC6_8wekyb3d8bbwe', 'LocalCache', 'Local', 'runtime', 'java-runtime-gold', 'windows-x64'),
    ];
    for (const msPath of msStorePaths) {
      if (fs.existsSync(msPath)) {
        searchFolderForJava(msPath, 3);
      }
    }

    try {
      const whereOutput = execSync('where java 2>nul', { encoding: 'utf8', timeout: 5000, windowsHide: true });
      const whereLines = whereOutput.split(/\r?\n/).filter((l) => l.trim());
      for (const line of whereLines) {
        const trimmed = line.trim();
        if (trimmed && fs.existsSync(trimmed)) {
          addJavaEntry(trimmed, 'system');
        }
      }
    } catch (e) {}

    // 全盘扫描各盘根目录下的 Java / JDK / Runtime 目录
    try {
      const drives = execSync('wmic logicaldisk get caption /value 2>nul', { encoding: 'utf8', timeout: 5000, windowsHide: true });
      const driveMatches = drives.matchAll(/Caption=(\w:)/gi);
      for (const dm of driveMatches) {
        const driveRoot = dm[1] + '\\';
        try {
          fs.readdirSync(driveRoot).forEach((d) => {
            const dirLower = d.toLowerCase();
            if (['java', 'jdk', 'jre', 'runtime'].some((kw) => dirLower === kw || dirLower === kw + 's')) {
              searchFolderForJava(path.join(driveRoot, d), 2);
            }
          });
        } catch (e) {}
      }
    } catch (e) {}
  }

  // 4. macOS：/Library/Java/JavaVirtualMachines、Homebrew、java_home 工具、which
  if (process.platform === 'darwin') {
    const homeDir = process.env.HOME || '~';

    const macJavaPaths = [
      '/Library/Java/JavaVirtualMachines',
      '/opt/homebrew/opt',
      '/opt/homebrew/Cellar',
      '/usr/local/opt',
      path.join(homeDir, '.sdkman', 'candidates', 'java'),
      path.join(homeDir, '.jdks'),
      path.join(homeDir, 'Library', 'Java', 'JavaVirtualMachines'),
      path.join(homeDir, '.minecraft', 'runtime'),
      path.join(ctx.dirs.DATA_DIR, 'runtime'),
    ];

    for (const searchPath of macJavaPaths) {
      if (fs.existsSync(searchPath)) {
        searchFolderForJava(searchPath, 3);
      }
    }

    try {
      const javaHomeOutput = execSync('/usr/libexec/java_home -V 2>&1', { encoding: 'utf8', timeout: 5000, windowsHide: true });
      const javaHomeMatches = javaHomeOutput.matchAll(/"([^"]+)"\s+\(([^)]+)\)/g);
      for (const m of javaHomeMatches) {
        const jhPath = m[1];
        const javaExe = path.join(jhPath, 'bin', 'java');
        if (fs.existsSync(javaExe)) {
          addJavaEntry(javaExe, 'system');
        }
      }
    } catch (e) {}

    try {
      const whichOutput = execSync('which -a java 2>/dev/null', { encoding: 'utf8', timeout: 5000, windowsHide: true });
      const whichLines = whichOutput.split('\n').filter((l) => l.trim());
      for (const line of whichLines) {
        const trimmed = line.trim();
        if (trimmed && fs.existsSync(trimmed)) {
          addJavaEntry(trimmed, 'system');
        }
      }
    } catch (e) {}
  }

  return results;
}

/* Bundled Java 检测 */

/**
 * 扫描启动器自带目录与 Mojang runtime 目录，查找已安装的 Java 运行时
 * @returns {Array<{path: string, version: string, majorVersion: number, minorVersion: number, is64Bit: boolean, isJdk: boolean, source: string, javaHome: string}>} 检测到的 Java 列表
 */
function detectBundledJava() {
  const results = [];
  if (!fs.existsSync(ctx.dirs.JAVA_DIR)) return results;

  const javaExeNames = process.platform === 'win32' ? ['java.exe', 'javaw.exe'] : ['java'];

  // 递归在目录树中查找 bin/java（或 bin/javaw.exe），找到即返回
  const findJavaInDir = (dir, maxDepth, currentDepth = 0) => {
    if (currentDepth > maxDepth || !fs.existsSync(dir)) return;
    try {
      for (const javaExeName of javaExeNames) {
        const directJavaExe = path.join(dir, 'bin', javaExeName);
        if (fs.existsSync(directJavaExe)) {
          const javaHome = dir;
          // release 文件比 exec java -version 快得多，优先解析
          const versionFile = path.join(javaHome, 'release');
          let version = 'unknown';
          let majorVersion = 0;
          let minorVersion = 0;

          if (fs.existsSync(versionFile)) {
            const content = fs.readFileSync(versionFile, 'utf8');
            const match = content.match(/JAVA_VERSION="([^"]+)"/);
            if (match) {
              version = match[1];
              if (version.startsWith('1.')) {
                // 旧式 1.8.0_301
                majorVersion = parseInt(version.split('.')[1], 10);
                const upd = version.match(/_(\d+)/);
                if (upd) minorVersion = parseInt(upd[1], 10);
              } else {
                // 新式 17.0.1
                majorVersion = parseInt(version.split('.')[0], 10);
                const minorPart = version.split('.')[1];
                if (minorPart) minorVersion = parseInt(minorPart, 10) || 0;
              }
            }
          }

          // release 文件缺失或解析失败时，回退执行 java -version
          if (majorVersion <= 0) {
            const info = getJavaVersionInfo(directJavaExe);
            version = info.version;
            majorVersion = info.major;
            minorVersion = info.minor;
          }

          if (majorVersion > 0) {
            // 通过是否存在 javac 判断是 JDK 还是 JRE
            const isJdk = fs.existsSync(path.join(javaHome, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac'));
            const normalized = directJavaExe.toLowerCase().replace(/\\/g, '/');
            // 去重：相同路径（不区分大小写、斜杠）只保留一条
            if (!results.some((r) => r.path.toLowerCase().replace(/\\/g, '/') === normalized)) {
              results.push({
                path: directJavaExe,
                version,
                majorVersion,
                minorVersion,
                is64Bit: true,
                isJdk,
                source: 'bundled',
                javaHome
              });
            }
          }
          return;
        }
      }
      // 当前目录无 bin/java，递归子目录
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          findJavaInDir(path.join(dir, entry.name), maxDepth, currentDepth + 1);
        }
      }
    } catch (e) {}
  };

  const javaDirs = fs.readdirSync(ctx.dirs.JAVA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const javaDirName of javaDirs) {
    // [CRITICAL - 2026-06-21] macOS 的 Java 运行时结构是 jre.bundle/Contents/Home/bin/java，
    // 比 Windows/Linux 多 2 层（.bundle 和 Contents/Home），所以 maxDepth 必须 >= 6。
    // 之前是 4，导致 macOS 上下载了 Java 但检测不到，游戏启动失败。
    findJavaInDir(path.join(ctx.dirs.JAVA_DIR, javaDirName), 6);
  }

  // 同时搜索 runtime 目录（Minecraft 官方 Java 运行时安装位置）
  const runtimeDir = path.join(ctx.dirs.DATA_DIR, 'runtime');
  if (fs.existsSync(runtimeDir)) {
    findJavaInDir(runtimeDir, 6);
  }

  return results;
}

module.exports = {
  detectSystemJava,
  detectBundledJava
};
