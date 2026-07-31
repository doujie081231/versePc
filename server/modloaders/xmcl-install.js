/**
 * 基于 @xmcl/installer 的统一安装引擎
 *
 * 替代原有的自研安装逻辑（modloaders/index.js 的 performInstallation），
 * 使用 XMCL 官方安装器实现原版/Forge/Fabric/NeoForge/Quilt 安装。
 *
 * 核心能力：
 * - 原版安装：installMinecraft + completeInstallation（jar + libraries + assets）
 * - 加载器安装：installForge / installFabric / installNeoForge / installQuiltVersion
 * - 进度回调：tracker 事件映射到 session
 * - 取消机制：AbortSignal 传入安装函数
 * - 镜像注入：BMCLAPI 镜像源通过 options 传入
 */

const fs = require('fs');
const path = require('path');

// @xmcl/installer 安装函数
const {
  installMinecraft,
  completeInstallation,
  installForge,
  installFabric,
  installNeoForge,
  installQuiltVersion,
  getVersionList,
  getFabricLoaderArtifact,
  getQuiltLoaderVersionsByMinecraft,
  getForgeVersionList,
  InstallError,
} = require('@xmcl/installer');

// @xmcl/core 版本解析
const { Version, MinecraftFolder } = require('@xmcl/core');

// 版本模块（用于失效 resolved JSON 缓存）
const versions = require('../versions');

// 阶段权重（与原 performInstallation 一致）
const STAGE_WEIGHTS = {
  version_json: 1,
  client_jar: 5,
  libraries: 15,
  assets: 20,
  loader: 10,
  finalizing: 1,
};
const TOTAL_WEIGHT = Object.values(STAGE_WEIGHTS).reduce((a, b) => a + b, 0);

/**
 * 计算总进度（0-99，100 在完成时显式设置）
 */
function calcProgress(stage, stagePct, hasLoader) {
  const stages = hasLoader
    ? ['version_json', 'client_jar', 'libraries', 'assets', 'loader', 'finalizing']
    : ['version_json', 'client_jar', 'libraries', 'assets'];
  let completed = 0;
  let stageWeight = 0;
  for (const s of stages) {
    if (s === stage) {
      stageWeight = STAGE_WEIGHTS[s];
      break;
    }
    completed += STAGE_WEIGHTS[s];
  }
  const total = hasLoader ? TOTAL_WEIGHT : (TOTAL_WEIGHT - STAGE_WEIGHTS.loader - STAGE_WEIGHTS.finalizing);
  return Math.min(99, Math.round(((completed + stagePct * stageWeight) / total) * 100));
}

/**
 * 创建 BMCLAPI 镜像源配置
 * 把 @xmcl/installer 的下载 URL 重写为国内镜像
 */
function createMirrorOptions(ctx) {
  const BMCLAPI = 'https://bmclapi2.bangbang93.com';
  const mirrorMap = ctx.mirrors.BMCLAPI_MIRROR || {};

  /**
   * URL 镜像重写：把原始 URL 替换为 BMCLAPI 镜像 URL
   */
  function rewriteUrl(originalUrl) {
    if (!originalUrl || typeof originalUrl !== 'string') return originalUrl;
    for (const [from, to] of Object.entries(mirrorMap)) {
      if (originalUrl.startsWith(from)) {
        return originalUrl.replace(from, to);
      }
    }
    return originalUrl;
  }

  /**
   * 返回 URL 数组（镜像优先 + 原始 URL 作为备用）
   */
  function getUrlsWithMirror(originalUrl) {
    if (!originalUrl) return undefined;
    const mirrored = rewriteUrl(originalUrl);
    if (mirrored !== originalUrl) {
      return [mirrored, originalUrl];
    }
    return [originalUrl];
  }

  return {
    // 库下载的 URL 重写
    libraryHost: (library) => {
      if (library && library.downloads && library.downloads.artifact) {
        const urls = getUrlsWithMirror(library.downloads.artifact.url);
        return urls;
      }
      return undefined;
    },
    // Maven 仓库镜像
    mavenHost: [
      `${BMCLAPI}/maven`,
      'https://repo1.maven.org/maven2/',
    ],
    // 资源（assets）镜像
    assetsHost: `${BMCLAPI}/assets`,
    // 版本 JSON 镜像
    json: (version) => {
      if (version && version.url) {
        return getUrlsWithMirror(version.url);
      }
      return undefined;
    },
    // 客户端 jar 镜像
    client: (version) => {
      if (version && version.downloads && version.downloads.client) {
        return getUrlsWithMirror(version.downloads.client.url);
      }
      return undefined;
    },
    // 通用 URL 重写函数（供各安装器内部使用）
    rewriteUrl,
    getUrlsWithMirror,
  };
}

/**
 * 创建进度 tracker，把 @xmcl/installer 的事件映射到 session
 */
function createTracker(session, stage, hasLoader, ctx) {
  return (event) => {
    if (!event || !event.phase) return;

    const { phase, payload } = event;

    // 更新 session 阶段
    session.stage = stage;
    session.lastActivity = Date.now();

    // 提取进度信息
    if (payload && payload.progress) {
      const p = payload.progress;
      const total = p.total || 0;
      const downloaded = p.progress || 0;
      const pct = total > 0 ? downloaded / total : 0;

      session.progress = calcProgress(stage, pct, hasLoader);
      session.speed = p.speed || 0;
      session.bytesDownloaded = downloaded;
      session.totalBytes = total;

      if (payload.url) {
        session.currentFile = path.basename(payload.url.split('?')[0]) || payload.url;
      }
    }

    // 根据 phase 更新消息
    switch (phase) {
      case 'version.json':
        session.message = '下载版本信息...';
        session.stage = 'version_json';
        break;
      case 'version.jar':
        session.message = '下载客户端文件...';
        session.stage = 'client_jar';
        break;
      case 'libraries':
        session.message = '下载依赖库...';
        session.stage = 'libraries';
        if (payload && payload.count != null) {
          session.totalFiles = payload.count;
        }
        break;
      case 'assets':
      case 'assets.assets':
        session.message = '下载游戏资源...';
        session.stage = 'assets';
        break;
      case 'forge.installer':
        session.message = '安装 Forge...';
        session.stage = 'loader';
        break;
      default:
        // 其他 phase 不特殊处理
        break;
    }
  };
}

/**
 * 检测 Java 路径（Forge 安装需要）
 */
function findJavaPath(ctx) {
  // 优先用捆绑的 Java
  if (ctx.java && ctx.java.detectBundledJava) {
    const bundled = ctx.java.detectBundledJava();
    if (bundled && bundled.path) return bundled.path;
  }
  // 其次用系统 Java
  if (ctx.java && ctx.java.detectSystemJava) {
    const system = ctx.java.detectSystemJava();
    if (system && system.path) return system.path;
  }
  // 尝试从 settings 获取
  if (ctx.settings && ctx.settings.javaPath) {
    return ctx.settings.javaPath;
  }
  return 'java';
}

/**
 * 核心安装函数：用 @xmcl/installer 替代原有的 performInstallation
 *
 * @param {string} sessionId - 安装会话 ID
 * @param {object} versionDetails - 版本详情 JSON（Mojang 格式）
 * @param {object} session - 安装会话对象（ctx.sessions.installSessions 中的条目）
 * @param {object} ctx - 全局上下文
 */
async function performInstallationWithXmcl(sessionId, versionDetails, session, ctx) {
  const hasLoader = !!(session.loaderInfo && session.loaderInfo.type && session.loaderInfo.version);

  // 获取互斥锁
  while (ctx._installMutex) {
    await ctx._installMutex;
  }
  let releaseMutex;
  ctx._installMutex = new Promise((resolve) => { releaseMutex = resolve; });

  // 速度同步定时器
  let speedTimer = null;

  try {
    // 取消检测
    function isAborted() {
      return session.status === 'cancelled' || (session._abortController && session._abortController.signal.aborted);
    }

    if (isAborted()) {
      session.status = 'cancelled';
      session.stage = 'cancelled';
      session.message = '安装已取消';
      return;
    }

    // Minecraft 根目录（支持外部文件夹切换）
    const minecraftPath = ctx.dirs.ACTIVE_GAME_ROOT || ctx.dirs.DATA_DIR;
    const minecraft = new MinecraftFolder(minecraftPath);

    // 创建镜像配置
    const mirrorOpts = createMirrorOptions(ctx);

    // AbortSignal
    const signal = session._abortController ? session._abortController.signal : undefined;

    // 备份已有版本目录
    const versionId = versionDetails.id;
    const versionDir = path.join(ctx.dirs.VERSIONS_DIR, versionId);
    const backupDir = versionDir + '.backup';
    if (fs.existsSync(versionDir)) {
      if (fs.existsSync(backupDir)) {
        fs.rmSync(backupDir, { recursive: true, force: true });
      }
      fs.renameSync(versionDir, backupDir);
    }

    // 创建版本目录
    fs.mkdirSync(versionDir, { recursive: true });

    // 启动速度同步
    speedTimer = setInterval(() => {
      if (session.status === 'downloading' && ctx.DownloadManager) {
        session.speed = ctx.DownloadManager.getSpeed();
      }
    }, 200);

    session.status = 'downloading';
    session.stage = 'version_json';
    session.message = '准备安装...';
    session.progress = 0;

    // ========== 阶段 1：写入版本 JSON + 解析 ==========
    const versionJsonPath = path.join(versionDir, `${versionId}.json`);
    fs.writeFileSync(versionJsonPath, JSON.stringify(versionDetails, null, 2));

    // 失效缓存
    if (versions && versions._invalidateResolvedJsonCache) {
      versions._invalidateResolvedJsonCache(versionId);
    }

    if (isAborted()) { abortCleanup(session, versionDir, speedTimer, ctx); return; }

    // 解析版本 JSON 得到 ResolvedVersion
    let resolvedVersion;
    try {
      resolvedVersion = Version.resolve(minecraft, versionDetails);
    } catch (e) {
      // Version.resolve 可能需要完整的版本 JSON（含 inheritsFrom 的父版本）
      // 尝试用 parse
      try {
        resolvedVersion = Version.parse(versionDetails, minecraft);
      } catch (e2) {
        throw new Error(`版本 JSON 解析失败: ${e2.message}`);
      }
    }

    // ========== 阶段 2-4：一键安装（jar + libraries + assets）==========
    session.message = '安装游戏文件...';
    session.stage = 'client_jar';

    const installTracker = createTracker(session, 'client_jar', hasLoader, ctx);

    await completeInstallation(resolvedVersion, {
      tracker: installTracker,
      signal,
      ...mirrorOpts,
    });

    if (isAborted()) { abortCleanup(session, versionDir, speedTimer, ctx); return; }

    // ========== 阶段 5：加载器安装 ==========
    if (hasLoader) {
      session.stage = 'loader';
      session.message = `安装 ${session.loaderInfo.type}...`;

      const loaderType = session.loaderInfo.type;
      const loaderVersion = session.loaderInfo.version;
      const gameVersion = versionDetails.inheritsFrom || versionId;

      // 确保基础版本已安装
      if (gameVersion !== versionId) {
        await ensureBaseVersionWithXmcl(gameVersion, minecraft, ctx, signal, session);
      }

      if (isAborted()) { abortCleanup(session, versionDir, speedTimer, ctx); return; }

      const loaderTracker = (event) => {
        if (event && event.phase) {
          session.stage = 'loader';
          session.message = `安装 ${loaderType}...`;
          if (event.payload && event.payload.progress) {
            const p = event.payload.progress;
            const total = p.total || 0;
            const pct = total > 0 ? p.progress / total : 0;
            session.progress = calcProgress('loader', 0.3 + pct * 0.65, hasLoader);
            session.speed = p.speed || 0;
          }
        }
      };

      switch (loaderType) {
        case 'fabric': {
          await installFabric({
            minecraftVersion: gameVersion,
            version: loaderVersion,
            minecraft,
            side: 'client',
          });
          break;
        }
        case 'forge': {
          // Forge 安装需要 Java
          const javaPath = findJavaPath(ctx);
          await installForge(
            { mcversion: gameVersion, version: loaderVersion },
            minecraft,
            {
              java: javaPath,
              signal,
              tracker: loaderTracker,
              ...mirrorOpts,
            }
          );
          break;
        }
        case 'neoforge': {
          const javaPath = findJavaPath(ctx);
          // installNeoForge 的签名：(project, version, minecraft, options)
          // project = 'neoforge'（新版本）或 'forge'（旧版本 1.20.1-）
          const project = loaderVersion.startsWith('1.20.1-') ? 'forge' : 'neoforge';
          await installNeoForge(
            project,
            loaderVersion,
            minecraft,
            {
              java: javaPath,
              signal,
              tracker: loaderTracker,
              ...mirrorOpts,
            }
          );
          break;
        }
        case 'quilt': {
          await installQuiltVersion({
            minecraftVersion: gameVersion,
            version: loaderVersion,
            minecraft,
            side: 'client',
          });
          break;
        }
        case 'optifine': {
          // OptiFine 使用 @xmcl/installer 的 installOptifine（如果可用）
          const { installOptifine } = require('@xmcl/installer');
          if (typeof installOptifine === 'function') {
            await installOptifine(
              { mcversion: gameVersion, version: loaderVersion },
              minecraft,
              { signal, tracker: loaderTracker }
            );
          } else {
            throw new Error('OptiFine 安装暂不支持，请使用原版或 Fabric/Forge');
          }
          break;
        }
        default:
          throw new Error(`不支持的加载器类型: ${loaderType}`);
      }

      if (isAborted()) { abortCleanup(session, versionDir, speedTimer, ctx); return; }
    }

    // ========== 完成 ==========
    session.status = 'completed';
    session.stage = 'completed';
    session.progress = 100;
    session.speed = 0;
    session.message = '安装完成';

    // 清理备份
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }

    // 失效版本缓存
    if (versions && versions._invalidateResolvedJsonCache) {
      versions._invalidateResolvedJsonCache(versionId);
    }
    if (ctx.caches && ctx.caches._versionsCache) {
      ctx.caches._versionsCache = null;
      ctx.caches._versionsCacheTime = 0;
    }

  } catch (err) {
    // 错误处理
    session.status = 'failed';
    session.stage = 'failed';
    session.message = `安装失败: ${err.message}`;
    session.errors = session.errors || [];
    session.errors.push(err.message);

    // 回滚
    const versionDir = path.join(ctx.dirs.VERSIONS_DIR, versionDetails.id);
    const backupDir = versionDir + '.backup';
    if (fs.existsSync(backupDir)) {
      fs.rmSync(versionDir, { recursive: true, force: true });
      fs.renameSync(backupDir, versionDir);
    } else if (fs.existsSync(versionDir)) {
      fs.rmSync(versionDir, { recursive: true, force: true });
    }

    console.error('[XMCL Install] 安装失败:', err);
  } finally {
    // 清理速度定时器
    if (speedTimer) clearInterval(speedTimer);
    // 释放互斥锁
    releaseMutex();
    ctx._installMutex = null;
  }
}

/**
 * 确保基础版本已安装（用 @xmcl/installer）
 */
async function ensureBaseVersionWithXmcl(gameVersion, minecraft, ctx, signal, session) {
  // 检查是否已安装
  const versionJsonPath = minecraft.getVersionJsonPath(gameVersion);
  if (fs.existsSync(versionJsonPath)) {
    // 已有版本 JSON，检查是否完整
    try {
      const json = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
      const resolved = Version.resolve(minecraft, json);
      // 尝试诊断
      await completeInstallation(resolved, {
        diagnose: true,
        signal,
      });
      return; // 诊断通过，无需安装
    } catch (e) {
      // 诊断失败，需要重新安装
      if (!(e instanceof InstallError)) {
        console.log('[XMCL Install] 基础版本诊断失败，重新安装:', gameVersion);
      }
    }
  }

  // 获取版本列表
  session.message = `获取版本 ${gameVersion} 信息...`;
  const versionList = await getVersionList();
  const versionMeta = versionList.versions.find(v => v.id === gameVersion);
  if (!versionMeta) {
    throw new Error(`找不到版本 ${gameVersion}`);
  }

  // 安装版本 JSON + jar
  const mirrorOpts = createMirrorOptions(ctx);
  session.message = `安装基础版本 ${gameVersion}...`;
  await installMinecraft(versionMeta, minecraft, {
    signal,
    ...mirrorOpts,
  });

  // 安装依赖
  const resolvedVersion = Version.resolve(minecraft, JSON.parse(fs.readFileSync(versionJsonPath, 'utf8')));
  await completeInstallation(resolvedVersion, {
    signal,
    ...mirrorOpts,
  });
}

/**
 * 取消清理
 */
function abortCleanup(session, versionDir, speedTimer, ctx) {
  if (speedTimer) clearInterval(speedTimer);
  session.status = 'cancelled';
  session.stage = 'cancelled';
  session.message = '安装已取消';

  // 删除版本目录
  if (fs.existsSync(versionDir)) {
    try {
      fs.rmSync(versionDir, { recursive: true, force: true });
    } catch (e) {
      console.error('[XMCL Install] 清理版本目录失败:', e);
    }
  }
}

module.exports = {
  performInstallationWithXmcl,
  createMirrorOptions,
  createTracker,
  calcProgress,
  findJavaPath,
  ensureBaseVersionWithXmcl,
};
