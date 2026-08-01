/**
 * @file server/java/java-download.js - JDK 下载与 Java 运行时安装
 * @description 从原 server/java.js 拆分：Temurin/Liberica 镜像 URL 生成、JDK 异步下载安装、Mojang 运行时下载、自动安装。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ctx = require('../context');
const utils = require('../utils');
const http = require('../http-client');
const versions = require('../versions');
const { detectSystemJava, detectBundledJava } = require('./java-detect');
const { configureJavaEnv } = require('./java-runtime');

/* Temurin 镜像 URL */

/**
 * 把 GitHub Adoptium Temurin 下载 URL 转为国内镜像 URL 数组（仅 USTC）
 * @param {string} githubUrl - GitHub 原始下载 URL
 * @param {string} [osName='windows'] - 操作系统名
 * @param {string} [arch='x64'] - 架构
 * @returns {string[]|string} 镜像 URL 数组；无法解析时返回原 URL
 */
function getTemurinMirrorUrl(githubUrl, osName = 'windows', arch = 'x64') {
  if (!githubUrl) return githubUrl;
  let majorVer, tag, fileName;
  const githubMatch = githubUrl.match(/github\.com\/adoptium\/temurin(\d+)-binaries\/releases\/download\/(.+?)\/(.+)$/);
  if (githubMatch) {
    majorVer = githubMatch[1];
    tag = githubMatch[2];
    fileName = githubMatch[3];
  } else if (githubUrl.includes('release-assets.githubusercontent.com')) {
    const assetMatch = githubUrl.match(/OpenJDK(\d+)U[^/]*?_(jdk_[^\?]+)/);
    if (!assetMatch) {
      const fnMatch = githubUrl.match(/[?&](\w[\w.%-]+\.zip)/);
      if (fnMatch) {
        const fn = decodeURIComponent(fnMatch[1]);
        const vmMatch = fn.match(/OpenJDK(\d+)U/);
        if (vmMatch) {
          majorVer = vmMatch[1];
          fileName = fn;
          tag = `jdk-${fn.replace(/^OpenJDK\d+U-jdk_/, '').replace(/_hotspot_/, '+').replace(/\.zip$/, '').replace(/_/g, '.')}`;
        }
      }
      if (!majorVer) return githubUrl;
    } else {
      majorVer = assetMatch[1];
      const rawFileName = assetMatch[2];
      fileName = rawFileName.split('?')[0];
      const verParts = fileName.match(/(\d+\.\d+\.\d+\+\d+)/);
      tag = verParts ? `jdk-${verParts[1]}` : '';
    }
  } else {
    return githubUrl;
  }
  if (!majorVer || !fileName) return githubUrl;
  // 仅保留中科大镜像（清华 TUNA 已 404 失效、中科院 ISCAS 已超时不可用）
  return [
    `https://mirrors.ustc.edu.cn/adoptium/releases/temurin${majorVer}-binaries/${tag}/${fileName}`
  ];
}

/* Liberica JDK 最新版本 */

/**
 * 从 BellSoft 官网爬取指定主版本的最新 Liberica JDK 下载信息
 * @param {number} majorVersion - Java 主版本号
 * @returns {Promise<{downloadUrl: string, fileName: string, size: number}|null>}
 */
async function getLibericaLatestVersion(majorVersion) {
  const arch = process.platform === 'win32' ? 'amd64' : (process.arch === 'arm64' ? 'aarch64' : 'amd64');
  const os = process.platform === 'win32' ? 'windows' : (process.platform === 'darwin' ? 'macos' : 'linux');
  const pkgType = process.platform === 'win32' ? 'zip' : 'tar.gz';

  const pageUrl = 'https://bell-sw.com/pages/downloads/';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(pageUrl, { signal: controller.signal });
    clearTimeout(timer);
    const html = await resp.text();

    // 从页面 HTML 中提取所有匹配主版本的 Liberica JDK 版本号
    const versionRegex = /bellsoft-jdk([\d.u+b]+)-linux-amd64\.tar\.gz/g;
    const allVersions = [];
    let m;
    while ((m = versionRegex.exec(html)) !== null) {
      const ver = m[1];
      const major = parseInt(ver.split('.')[0], 10);
      if (major === majorVersion) allVersions.push(ver);
    }
    if (allVersions.length === 0) return null;

    allVersions.sort().reverse();
    const latestVer = allVersions[0];

    const testFileName = `bellsoft-jdk${latestVer}-${os}-${arch}.${pkgType}`;
    const testUrl = `${ctx.urls.LIBERICA_BASE}${latestVer.replace(/\+/g, '%2B')}/${testFileName}`;

    // HEAD 请求验证可用性并获取文件大小
    const h2 = new AbortController();
    const t2 = setTimeout(() => h2.abort(), 8000);
    const r2 = await fetch(testUrl, { method: 'HEAD', signal: h2.signal });
    clearTimeout(t2);

    if (!r2.ok) {
      // + 号未编码的备选 URL
      const altUrl = `${ctx.urls.LIBERICA_BASE}${latestVer}/${testFileName}`;
      const h3 = new AbortController();
      const t3 = setTimeout(() => h3.abort(), 8000);
      const r3 = await fetch(altUrl, { method: 'HEAD', signal: h3.signal });
      clearTimeout(t3);
      if (!r3.ok) return null;
      const size = parseInt(r3.headers.get('content-length'), 10) || 0;
      return { downloadUrl: altUrl, fileName: testFileName, size };
    }

    const size = parseInt(r2.headers.get('content-length'), 10) || 0;
    return { downloadUrl: testUrl, fileName: testFileName, size };
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

/* JDK 异步下载 */

/**
 * 异步下载并安装指定主版本的 JDK（Temurin 优先，Liberica 兜底）
 * @param {number} majorVersion - 目标 Java 主版本号（如 8、17、21）
 * @param {string} sessionId - 安装会话 ID，用于取消控制与状态写入
 * @param {string} sessionFile - 会话状态文件路径
 * @param {number} [mirrorIndex=0] - 当前使用的镜像索引（保留参数）
 * @param {AbortSignal|null} [abortSignal=null] - 取消信号
 * @returns {Promise<void>} 完成时无返回值；状态通过 sessionFile 同步
 */
async function downloadJavaAsync(majorVersion, sessionId, sessionFile, mirrorIndex = 0, abortSignal = null) {
  const isAborted = () => abortSignal && abortSignal.aborted;
  const checkAbort = (msg) => { if (isAborted()) throw new Error(msg || '下载已取消'); };
  const updateStatus = (status, progress, message = '', speed = 0, downloadedBytes = 0, totalBytes = 0) => {
    try {
      fs.writeFileSync(sessionFile, JSON.stringify({
        status,
        progress,
        majorVersion,
        message,
        speed,
        downloadedBytes,
        totalBytes,
        timestamp: Date.now()
      }));
    } catch (e) {}
  };

  let lastPct = 10;
  try {
    updateStatus('fetching', 5, '正在获取JDK下载信息...');

    // 平台与架构映射：Mojang 风格 platformKey → Adoptium 风格 arch/osName
    const archMap = { 'windows-x64': 'x64', 'windows-arm64': 'aarch64', 'linux': 'x64', 'linux-i386': 'x86', 'mac-os': 'x64', 'mac-os-arm64': 'aarch64' };
    const platformKey = utils.getPlatformKey();
    const arch = archMap[platformKey] || 'x64';
    const osName = process.platform === 'win32' ? 'windows' : (process.platform === 'darwin' ? 'macos' : 'linux');

    let downloadUrl = '';
    let fileName = '';
    let totalSize = 0;

    // 候选镜像：仅中科大 USTC（清华 TUNA 已 404 失效、中科院 ISCAS 已超时不可用）
    const mirrorBases = [
      `https://mirrors.ustc.edu.cn/adoptium/releases/temurin${majorVersion}-binaries/`
    ];

    // 并行探测每个镜像：拉取目录列表 → 解析最新 JDK 目录 → HEAD 验证文件可下
    const probeResults = await Promise.allSettled(mirrorBases.map(async (mirrorBase) => {
      const hostname = new URL(mirrorBase).hostname;
      const start = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const resp = await fetch(mirrorBase, { signal: controller.signal });
        clearTimeout(timer);
        if (!resp.ok) return { hostname, ok: false, latency: Infinity };
        const html = await resp.text();
        // 同时匹配 jdk8uXXXbY 与 jdk-X.Y.Z+N 两种目录命名
        const dirRegex = /href="[^"]*?(jdk8u\d+b\d+|jdk-\d+\.\d+\.\d+(?:%2B|\+)\d+)[^"]*?"/g;
        const dirs = [];
        let dm;
        while ((dm = dirRegex.exec(html)) !== null) dirs.push(decodeURIComponent(dm[1]));
        if (dirs.length === 0) return { hostname, ok: false, latency: Infinity };
        // 倒序后取第一个，即最新版本目录
        dirs.sort().reverse();
        const latestDir = dirs[0];
        let testFileName;
        const vm8 = latestDir.match(/jdk(\d+u\d+b\d+)/);
        if (vm8) {
          // Java 8 旧式命名：OpenJDK8U-jdk_x64_windows_hotspot_8uXXXbY.zip
          testFileName = `OpenJDK${majorVersion}U-jdk_${arch}_${osName}_hotspot_${vm8[1]}.zip`;
        } else {
          // Java 9+ 新式命名：OpenJDK17U-jdk_x64_windows_hotspot_17.0.1_12.zip
          const vm = latestDir.match(/jdk-(\d+)\.(\d+)\.(\d+)\+(\d+)/);
          if (!vm) return { hostname, ok: false, latency: Infinity };
          testFileName = `OpenJDK${majorVersion}U-jdk_${arch}_${osName}_hotspot_${vm[2]}.${vm[3]}_${vm[4]}.zip`;
        }
        const testUrl = mirrorBase + latestDir + '/' + testFileName;
        // HEAD 请求验证可用性并取文件大小
        const h2 = new AbortController();
        const t2 = setTimeout(() => h2.abort(), 5000);
        const r2 = await fetch(testUrl, { method: 'HEAD', signal: h2.signal });
        clearTimeout(t2);
        if (!r2.ok) return { hostname, ok: false, latency: Infinity };
        const latency = Date.now() - start;
        let size = 0;
        if (r2.headers.get('content-length')) size = parseInt(r2.headers.get('content-length'), 10) || 0;
        return { hostname, ok: true, latency, dir: latestDir, fileName: testFileName, baseUrl: mirrorBase, size };
      } catch (e) {
        clearTimeout(timer);
        return { hostname, ok: false, latency: Infinity };
      }
    }));

    // 按延迟升序排序，取最快的可用镜像
    const available = probeResults.filter((r) => r.status === 'fulfilled' && r.value.ok).map((r) => r.value);
    available.sort((a, b) => a.latency - b.latency);

    if (available.length > 0) {
      const best = available[0];
      updateStatus('fetching', 5, `已选择最快镜像: ${best.hostname}`);
      downloadUrl = best.baseUrl + best.dir + '/' + best.fileName;
      fileName = best.fileName;
      totalSize = best.size;
    }

    // 镜像全部不可用时回退到 Adoptium 官方 API
    if (!downloadUrl) {
      updateStatus('fetching', 5, '正在请求Adoptium官方API...');
      const apiUrl = `${ctx.urls.TEMURIN_API}/assets/latest/${majorVersion}/hotspot?architecture=${arch}&image_type=jdk&os=${osName}&vendor=eclipse`;
      try {
        // API 请求加 20s 超时保护，避免长时间挂起
        const apiResponse = await Promise.race([
          http.fetchJSONWithMethod(apiUrl, 'GET'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('API timeout (20s)')), 20000))
        ]);
        if (apiResponse && apiResponse.length > 0 && apiResponse[0].binary && apiResponse[0].binary.package && apiResponse[0].binary.package.link) {
          const latest = apiResponse[0];
          downloadUrl = latest.binary.package.link;
          fileName = latest.binary.package.name || `jdk-${majorVersion}.zip`;
          totalSize = latest.binary.package.size || 0;
        }
      } catch (e) {
        console.warn(`[Java] Adoptium API失败: ${e.message}`);
      }
    }

    // 官方 API 也失败时，最后尝试 BellSoft Liberica
    if (!downloadUrl) {
      updateStatus('fetching', 5, '正在尝试BellSoft Liberica...');
      try {
        const bellsoftVersion = await getLibericaLatestVersion(majorVersion);
        if (bellsoftVersion) {
          downloadUrl = bellsoftVersion.downloadUrl;
          fileName = bellsoftVersion.fileName;
          totalSize = bellsoftVersion.size || 0;
        }
      } catch (e) {
        console.warn(`[Java] BellSoft Liberica失败: ${e.message}`);
      }
    }

    if (!downloadUrl) {
      throw new Error(`未找到JDK ${majorVersion}的下载信息，所有源均不可用（请检查网络连接或VPN）`);
    }

    // GitHub 直链在国内通常无法访问，转换为国内镜像数组
    let downloadMirrors = [];
    if (downloadUrl.includes('github.com/adoptium/') || downloadUrl.includes('release-assets.githubusercontent.com')) {
      const mirrors = getTemurinMirrorUrl(downloadUrl, osName, arch);
      if (Array.isArray(mirrors)) {
        downloadMirrors = mirrors;
      } else if (typeof mirrors === 'string' && mirrors !== downloadUrl) {
        downloadMirrors = [mirrors];
      }
    }

    const tempFile = path.join(os.tmpdir(), fileName);

    const jdkSource = downloadUrl.includes('bell-sw.com') ? 'Liberica' : 'Temurin';
    updateStatus('downloading', 10, `正在下载${jdkSource} JDK ${majorVersion}...`);

    // 进度百分比计算：服务端返回 totalBytes 时按真实大小算，否则用峰值估算
    let peakBytes = 0;
    const calcPct = (progress) => {
      const tb = progress.totalBytes > 0 ? progress.totalBytes : totalSize;
      if (tb > 0) {
        const pct = Math.min(80, Math.floor((progress.bytesDownloaded / tb) * 70) + 10);
        lastPct = Math.max(lastPct, pct);
      } else {
        // 无总大小时，用已下载峰值 ×1.15 估算总量
        peakBytes = Math.max(peakBytes, progress.bytesDownloaded);
        const estimatedTotal = peakBytes * 1.15;
        if (estimatedTotal > 0) {
          const pct = Math.min(79, Math.floor((progress.bytesDownloaded / estimatedTotal) * 70) + 10);
          lastPct = Math.max(lastPct, pct);
        }
      }
      return lastPct;
    };
    const formatProgress = (progress) => {
      const tb = progress.totalBytes > 0 ? progress.totalBytes : totalSize;
      const dlMB = (progress.bytesDownloaded / 1024 / 1024).toFixed(1);
      if (tb > 0) {
        const totalMB = (tb / 1024 / 1024).toFixed(1);
        return `正在下载${jdkSource} JDK ${majorVersion}... ${dlMB}MB / ${totalMB}MB`;
      }
      return `正在下载${jdkSource} JDK ${majorVersion}... ${dlMB}MB 已下载`;
    };
    // 平滑速度：用 0.7/0.3 加权移动平均，避免数值抖动
    let _lastDlBytes = 0, _lastDlTime = Date.now(), _smoothSpeed = 0;
    const onDlProgress = (progress) => {
      const now = Date.now();
      const dt = (now - _lastDlTime) / 1000;
      let speed = progress.speed || 0;
      // 至少 0.5s 间隔才计算本地速度，避免抖动
      if (dt >= 0.5) {
        const localSpeed = (progress.bytesDownloaded - _lastDlBytes) / dt;
        speed = speed > 0 ? Math.max(speed, localSpeed) : localSpeed;
        _lastDlBytes = progress.bytesDownloaded;
        _lastDlTime = now;
      }
      _smoothSpeed = _smoothSpeed > 0 ? _smoothSpeed * 0.7 + speed * 0.3 : speed;
      updateStatus('downloading', calcPct(progress), formatProgress(progress), Math.max(_smoothSpeed, speed), progress.bytesDownloaded, progress.totalBytes || totalSize);
    };

    // 分块下载优先；失败时回退到单线程依次尝试所有镜像 + 原始 URL
    await http.downloadFileChunked(downloadMirrors.length > 0 ? downloadMirrors[0] : downloadUrl, tempFile, { onProgress: onDlProgress, timeout: 600000, retries: 3, mirrors: downloadMirrors.length > 0 ? downloadMirrors : null, abortSignal }).catch(async (err) => {
      checkAbort('下载已取消');
      const fallbackUrls = downloadMirrors.length > 0 ? [...downloadMirrors, downloadUrl] : [downloadUrl];
      let lastErr = err;
      for (const url of fallbackUrls) {
        try {
          checkAbort('下载已取消');
          await http._dlSingle(url, tempFile, { onProgress: onDlProgress, timeout: 600000, retries: 2, stallTimeout: 30000, abortSignal });
          return;
        } catch (e) {
          console.warn(`[Java] 单线程下载失败: ${e.message}`);
          lastErr = e;
        }
      }
      throw lastErr;
    });

    checkAbort('下载已取消');
    updateStatus('extracting', 85, '正在解压JDK...');

    if (!fs.existsSync(ctx.dirs.JAVA_DIR)) fs.mkdirSync(ctx.dirs.JAVA_DIR, { recursive: true });

    // 临时解压目录，解压后再重命名为最终目标目录
    const extractDir = path.join(ctx.dirs.JAVA_DIR, '_java_extract');
    if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });

    if (process.platform === 'win32') {
      // Windows：优先 PowerShell Expand-Archive，失败时回退 adm-zip
      await new Promise((resolve, reject) => {
        // PowerShell 单引号转义：' → ''
        const psCmd = `Expand-Archive -Path '${tempFile.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`;
        const child = spawn('powershell', ['-Command', psCmd], { timeout: 300000, windowsHide: true });
        let stderr = '';
        child.stderr.on('data', (d) => { stderr += d.toString(); });
        child.on('close', (code) => {
          if (code === 0) resolve();
          else {
            // PowerShell 退出码非 0：回退到 adm-zip 纯 JS 解压
            try {
              const AdmZip = require('adm-zip');
              const zip = new AdmZip(tempFile);
              zip.extractAllTo(extractDir, true);
              resolve();
            } catch (e2) {
              reject(new Error('解压失败: ' + (e2.message || stderr)));
            }
          }
        });
        child.on('error', (err) => {
          // PowerShell 进程启动失败（如系统禁用脚本）：同样回退 adm-zip
          try {
            const AdmZip = require('adm-zip');
            const zip = new AdmZip(tempFile);
            zip.extractAllTo(extractDir, true);
            resolve();
          } catch (e2) {
            reject(new Error('解压失败: ' + e2.message));
          }
        });
      });
    } else {
      // Linux/macOS：使用系统 tar 解压
      await new Promise((resolve, reject) => {
        const child = spawn('tar', ['-xzf', tempFile, '-C', extractDir], { timeout: 300000 });
        child.on('close', (code) => { code === 0 ? resolve() : reject(new Error(`tar解压失败, code=${code}`)); });
        child.on('error', reject);
      });
    }

    // 解压后的目录结构通常是 extractDir/<jdk-dir>/bin/java，找到含 bin/java 的子目录
    const subDirs = fs.readdirSync(extractDir);
    const jreDir = subDirs.find((d) => {
      const sub = path.join(extractDir, d);
      return fs.statSync(sub).isDirectory() && fs.existsSync(path.join(sub, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'));
    });

    const targetPath = path.join(ctx.dirs.JAVA_DIR, `jdk-${majorVersion}`);
    if (fs.existsSync(targetPath)) fs.rmSync(targetPath, { recursive: true, force: true });

    // 三种重命名策略：找到 jreDir 优先用；否则单子目录直接用；最后兜底整体改名
    if (jreDir) fs.renameSync(path.join(extractDir, jreDir), targetPath);
    else if (subDirs.length === 1) fs.renameSync(path.join(extractDir, subDirs[0]), targetPath);
    else fs.renameSync(extractDir, targetPath);

    // 清理临时文件
    try { fs.unlinkSync(tempFile); } catch (e) {}
    try { if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true }); } catch (e) {}

    const javaExe = path.join(targetPath, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
    if (!fs.existsSync(javaExe)) throw new Error('安装失败：找不到java可执行文件');

    // 配置系统环境变量（仅 Windows，失败不影响安装结果）
    updateStatus('configuring', 92, '正在配置Java环境变量...');
    try {
      await configureJavaEnv(targetPath, majorVersion);
    } catch (envErr) {
      console.warn(`[Java] 环境变量配置失败(不影响使用): ${envErr.message}`);
    }

    updateStatus('completed', 100, `Temurin JDK ${majorVersion} 安装成功！环境变量已配置。`);

  } catch (e) {
    console.error('[Java] 下载失败:', e.message);
    if (isAborted()) {
      updateStatus('cancelled', lastPct, '下载已取消');
    } else {
      updateStatus('error', lastPct, `安装失败: ${e.message}`);
    }
  } finally {
    ctx.sessions.javaDownloadAbortControllers.delete(sessionId);
  }
}

/* Java 运行时列表 */

/**
 * 拉取 Mojang 官方 Java 运行时清单
 * @returns {Promise<object>} 按平台 key 索引的运行时映射
 */
async function getJavaRuntimeList() {
  const data = await http.fetchJSON(ctx.urls.JAVA_RUNTIME_URL);
  const platformKey = utils.getPlatformKey();
  return data[platformKey] || {};
}

/* Java 镜像 URL */

/**
 * 根据 mirror.urlMap 把原始 URL 替换为镜像 URL；未命中映射则原样返回
 * @param {string} originalUrl - 原始下载 URL
 * @param {object} mirror - 镜像配置对象，需含 urlMap 字段
 * @returns {string} 替换后的 URL
 */
function getJavaMirrorUrl(originalUrl, mirror) {
  if (!mirror || !mirror.urlMap) return originalUrl;
  for (const [original, replacement] of Object.entries(mirror.urlMap)) {
    if (originalUrl.startsWith(original)) {
      return originalUrl.replace(original, replacement);
    }
  }
  return originalUrl;
}

/* Java 运行时下载 */

/**
 * 下载并安装 Mojang 官方 Java 运行时组件（递归尝试多个镜像）
 * @param {string} component - 运行时组件名（如 java-runtime-gamma）
 * @param {(progress: object) => void} [onProgress] - 进度回调
 * @param {number} [mirrorIndex=0] - 当前使用的镜像索引，失败时递增
 * @returns {Promise<{path: string, version: string, component: string, source: string, javaHome: string}>}
 */
async function downloadJavaRuntime(component, onProgress, mirrorIndex = 0) {
  const mirror = ctx.mirrors.JAVA_DOWNLOAD_MIRRORS[mirrorIndex] || ctx.mirrors.JAVA_DOWNLOAD_MIRRORS[0];

  try {
    const runtimeList = await getJavaRuntimeList();
    const runtimeInfo = runtimeList[component];

    if (!runtimeInfo || runtimeInfo.length === 0) {
      throw new Error(`Java runtime ${component} not available for this platform`);
    }

    const runtime = runtimeInfo[0];
    let manifestUrl = runtime.manifest.url;
    if (mirror) {
      manifestUrl = getJavaMirrorUrl(manifestUrl, mirror);
    }

    // 阶段 1：拉取 manifest 文件
    if (onProgress) {
      onProgress({
        file: 'manifest',
        current: 0,
        total: 0,
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speed: 0,
        source: mirror ? mirror.name : 'Mojang官方'
      });
    }

    const manifest = await http.fetchJSON(manifestUrl);

    // 阶段 2：解析文件清单，预计算总字节数
    const targetDir = path.join(ctx.dirs.JAVA_DIR, component);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const files = manifest.files || {};
    const fileEntries = Object.entries(files);
    const totalFiles = fileEntries.length;
    let downloadedFiles = 0;
    let totalBytes = 0;
    let downloadedBytes = 0;
    let lastTime = Date.now();
    let lastSpeedBytes = 0;
    let speed = 0;
    const fileBytes = {};

    for (const [filePath, fileInfo] of fileEntries) {
      if (fileInfo.downloads && fileInfo.downloads.raw) {
        const sz = fileInfo.downloads.raw.size || 0;
        totalBytes += sz;
        fileBytes[filePath] = sz;
      }
    }

    // 阶段 3：并发下载（最多 8 路），通过共享 idx 队列分配任务
    const CONCURRENT = 8;
    let idx = 0;

    async function downloadNext() {
      while (idx < fileEntries.length) {
        // 用闭包变量 i 锁定本次取到的下标，避免并发下 idx++ 造成重复处理
        const i = idx++;
        const [filePath, fileInfo] = fileEntries[i];
        const destPath = path.join(targetDir, filePath);
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

        if (fileInfo.downloads && fileInfo.downloads.raw) {
          const download = fileInfo.downloads.raw;
          let downloadUrl = download.url;
          if (mirror) downloadUrl = getJavaMirrorUrl(downloadUrl, mirror);

          await http.downloadFile(downloadUrl, destPath, (progress) => {
            const now = Date.now();
            const elapsed = now - lastTime;
            // 累加增量字节用于总进度计算
            const incrementalBytes = (progress.bytesDownloaded || 0);
            downloadedBytes += incrementalBytes;
            // 至少 500ms 才更新速度，避免抖动
            if (elapsed >= 500) {
              speed = Math.round((downloadedBytes - lastSpeedBytes) * 1000 / elapsed);
              lastTime = now;
              lastSpeedBytes = downloadedBytes;
            }
            if (onProgress) {
              onProgress({
                file: path.basename(filePath),
                current: downloadedFiles + 1,
                total: totalFiles,
                progress: totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0,
                downloadedBytes,
                totalBytes,
                speed,
                source: mirror ? mirror.name : 'Mojang官方'
              });
            }
          }, 3, null);
        } else {
          // 无 raw 下载项的文件（如目录占位）写空文件
          fs.writeFileSync(destPath, '');
        }

        // 非Windows 平台需要补可执行位
        if (fileInfo.executable && process.platform !== 'win32') {
          try { fs.chmodSync(destPath, 0o755); } catch (e) {}
        }

        downloadedFiles++;
      }
    }

    const workers = [];
    for (let w = 0; w < Math.min(CONCURRENT, totalFiles); w++) {
      workers.push(downloadNext());
    }
    await Promise.all(workers);

    return {
      path: path.join(targetDir, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'),
      version: runtime.version.name,
      component,
      source: mirror ? mirror.name : 'Mojang官方',
      javaHome: targetDir
    };
  } catch (e) {
    // 当前镜像失败时递归尝试下一个镜像，直到用尽所有镜像
    if (mirrorIndex < ctx.mirrors.JAVA_DOWNLOAD_MIRRORS.length - 1) {
      return downloadJavaRuntime(component, onProgress, mirrorIndex + 1);
    }
    throw e;
  }
}

/* 自动安装 Java */

/**
 * 自动检测并安装满足需求的 Java：先扫本地，未找到则提示手动安装
 * @param {number} [requiredVersion=17] - 所需的最低 Java 主版本号
 * @returns {Promise<{installed: boolean, javaPath?: string, version?: string, majorVersion?: number, needManual?: boolean, message?: string, sessionId?: string}>}
 */
async function autoInstallJava(requiredVersion = 17) {
  const systemJava = detectSystemJava();
  const bundledJava = detectBundledJava();
  const allJava = [...bundledJava, ...systemJava];

  // 已有满足版本要求的 Java：直接返回路径，无需安装
  const suitable = allJava.find((j) => j.majorVersion >= requiredVersion);
  if (suitable) {
    return { installed: false, javaPath: suitable.path, version: suitable.version, majorVersion: suitable.majorVersion };
  }

  // 未找到合适 Java：创建会话提示用户手动安装
  const sessionId = `java-auto-${Date.now()}`;
  ctx.sessions.javaInstallSessions.set(sessionId, {
    status: 'need_manual',
    progress: 0,
    message: `未找到合适的Java运行环境（需要 Java ${requiredVersion}），请在设置中手动安装或配置Java路径`,
    component: '',
    source: '',
    speed: 0
  });

  return { installed: false, needManual: true, message: `未找到合适的Java运行环境（需要 Java ${requiredVersion}），请在设置中手动安装或配置Java路径`, sessionId };
}

module.exports = {
  getTemurinMirrorUrl,
  getLibericaLatestVersion,
  downloadJavaAsync,
  getJavaRuntimeList,
  getJavaMirrorUrl,
  downloadJavaRuntime,
  autoInstallJava
};
