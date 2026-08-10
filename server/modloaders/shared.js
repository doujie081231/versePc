/**
 * server/modloaders/shared.js - 模组加载器通用工具函数
 * ============================================================================
 * 从 server/modloaders.js 拆分而来。
 * 提供 _curlDownload、ensureBaseVersionInstalled、verifyLoaderLibs、版本比较、
 * 模组需求扫描、加载器兼容性、导入库验证、库校验、NeoForge 镜像 URL 等通用能力。
 * 通过 ctx (../context) 访问共享状态，通过 utils (../utils) 访问工具函数，
 * 通过 http (../http-client) 访问 HTTP 请求，通过 versions (../versions) 访问版本管理，
 * 通过 dependencies (../dependencies) 访问依赖下载。
 */
const fs = require('fs');
const path = require('path');
const { exec, execSync, spawn } = require('child_process');

const ctx = require('../context');
const utils = require('../utils');
const http = require('../http-client');
const versions = require('../versions');
const dependencies = require('../dependencies');
const java = require('../java');

// 项目根目录（server.js 所在目录，用于查找 forge-installer.js 等资源文件）
// 原 modloaders.js 位于 server/，故 path.join(__dirname, '..')；
// 本文件位于 server/modloaders/，需上溯两级到达项目根目录。
const SERVER_DIR = path.join(__dirname, '..', '..');

// ============================================================================
// Async curl download helper - non-blocking alternative to execSync(curl)
// ============================================================================
function _curlDownload(url, destPath) {
    return new Promise((resolve, reject) => {
        const cmd = `curl --silent --location --connect-timeout 10 --max-time 60 --output "${destPath}" "${url}"`;
        exec(cmd, { timeout: 90000, windowsHide: true, stdio: 'ignore' }, (err) => {
            if (err) { reject(err); return; }
            resolve();
        });
    });
}

// ============================================================================
// 基础版本安装
// ============================================================================

async function ensureBaseVersionInstalled(gameVersion, onProgress = null) {
    const baseLog = (msg) => { utils._writeImportLog(`[基础版本] ${msg}`); };
    baseLog(`ensureBaseVersionInstalled: ${gameVersion}`);
    const baseJsonPath = path.join(ctx.dirs.VERSIONS_DIR, gameVersion, `${gameVersion}.json`);
    const baseJarPath = path.join(ctx.dirs.VERSIONS_DIR, gameVersion, `${gameVersion}.jar`);
    baseLog(`baseJsonPath: ${baseJsonPath}, exists: ${fs.existsSync(baseJsonPath)}`);
    baseLog(`baseJarPath: ${baseJarPath}, exists: ${fs.existsSync(baseJarPath)}`);
    const report = onProgress || (() => {});

    if (fs.existsSync(baseJsonPath) && fs.existsSync(baseJarPath)) {
        baseLog(`Both files exist, verifying...`);
        try {
            const existingJson = JSON.parse(fs.readFileSync(baseJsonPath, 'utf-8'));
            if (existingJson.downloads?.client?.sha1) {
                baseLog(`Verifying JAR SHA1: ${existingJson.downloads.client.sha1}`);
                const sha1Ok = await utils.verifyFileSha1(baseJarPath, existingJson.downloads.client.sha1);
                if (!sha1Ok) {
                    baseLog(`JAR SHA1 verify failed, re-download`);
                    fs.unlinkSync(baseJarPath);
                } else {
                    let libsOk = true;
                    const libs = existingJson.libraries || [];
                    let checkedCount = 0;
                    for (const lib of libs) {
                        if (checkedCount >= 5) break;
                        if (lib.rules && !versions.evaluateRules(lib.rules)) continue;
                        const artifactPath = lib.downloads?.artifact?.path;
                        if (artifactPath) {
                            checkedCount++;
                            const libFile = path.join(ctx.dirs.LIBRARIES_DIR, artifactPath);
                            if (!fs.existsSync(libFile)) {
                                baseLog(`Lib missing: ${artifactPath}`);
                                libsOk = false;
                                break;
                            }
                        }
                    }
                    if (libsOk) {
                        baseLog(`${gameVersion} already installed (verified)`);
                        return { alreadyInstalled: true };
                    }
                    baseLog(`${gameVersion} libs incomplete, need re-download`);
                }
            } else {
                baseLog(`No sha1 to verify, checking libs...`);
                let libsOk = true;
                const libs = existingJson.libraries || [];
                for (const lib of libs.slice(0, 5)) {
                    const artifactPath = lib.downloads?.artifact?.path;
                    if (artifactPath && !fs.existsSync(path.join(ctx.dirs.LIBRARIES_DIR, artifactPath))) {
                        libsOk = false;
                        break;
                    }
                }
                if (libsOk) {
                    baseLog(`${gameVersion} already installed (no sha1 check)`);
                    return { alreadyInstalled: true };
                }
            }
        } catch (e) {
            baseLog(`Verify error: ${e.message}`);
        }
    }

    baseLog(`${gameVersion} not found or corrupted, installing...`);

    try {
        report('正在获取版本信息...', 15);
        const manifest = await versions.getVersionManifest();
        const versionInfo = manifest.versions.find(v => v.id === gameVersion);

        if (!versionInfo) {
            return { alreadyInstalled: false, error: `找不到版本 ${gameVersion}` };
        }

        report('正在下载版本 JSON...', 20);
        const versionDetails = await versions.getVersionDetails(versionInfo.url);
        const versionDir = path.join(ctx.dirs.VERSIONS_DIR, gameVersion);
        if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true });

        const jsonPath = path.join(versionDir, `${gameVersion}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(versionDetails, null, 2));

        if (versionDetails.downloads?.client) {
            const clientInfo = versionDetails.downloads.client;
            const clientJarPath = path.join(versionDir, `${gameVersion}.jar`);

            if (!fs.existsSync(clientJarPath) || (clientInfo.sha1 && !(await utils.verifyFileSha1(clientJarPath, clientInfo.sha1)))) {
                report('正在下载客户端...', 25);
                await http.downloadFileSyncAsync(clientInfo.url, clientJarPath);
                if (clientInfo.sha1 && !(await utils.verifyFileSha1(clientJarPath, clientInfo.sha1))) {
                    console.warn(`[BaseVersion] Client JAR SHA1 mismatch after download!`);
                }
            }
        }

        const libraries = versionDetails.libraries || [];
        const needDownloadLibs = [];
        for (const lib of libraries) {
            if (lib.rules && !versions.evaluateRules(lib.rules)) continue;
            if (lib.downloads?.artifact) {
                const libPath = utils.safeLibPath(lib.downloads.artifact.path);
                if (!libPath) continue;
                if (!fs.existsSync(libPath) || (lib.downloads.artifact.sha1 && !(await utils.verifyFileSha1(libPath, lib.downloads.artifact.sha1)))) {
                    needDownloadLibs.push(lib);
                }
            }
        }
        const totalLibs = needDownloadLibs.length;
        let downloadedLibs = 0;

        const _collectLibTasks = () => {
            const tasks = [];
            for (const lib of libraries) {
                if (lib.rules && !versions.evaluateRules(lib.rules)) continue;
                if (lib.downloads?.artifact) {
                    const libPath = utils.safeLibPath(lib.downloads.artifact.path);
                    if (!libPath) continue;
                    const needDownload = !fs.existsSync(libPath) ||
                        (lib.downloads.artifact.sha1 && !utils.verifyFileSha1Sync(libPath, lib.downloads.artifact.sha1));
                    if (needDownload && lib.downloads.artifact.url) {
                        tasks.push({ type: 'artifact', lib, libPath });
                    }
                } else if (lib.name) {
                    const parts = lib.name.split(':');
                    if (parts.length >= 3) {
                        const groupPath = parts[0].replace(/\./g, '/');
                        const lname = parts[1];
                        const lversion = parts[2];
                        const classifier = parts.length >= 4 ? parts[3] : '';
                        const jarName = classifier ? `${lname}-${lversion}-${classifier}.jar` : `${lname}-${lversion}.jar`;
                        const libFile = path.join(ctx.dirs.LIBRARIES_DIR, parts[0].replace(/\./g, path.sep), lname, lversion, jarName);
                        if (!fs.existsSync(libFile)) {
                            tasks.push({ type: 'name', lib, libFile, groupPath, lname, lversion, jarName });
                        }
                    }
                }
                if (lib.natives) {
                    const nativeKey = lib.natives[process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'];
                    if (nativeKey) {
                        const classifier = nativeKey.replace('${arch}', process.arch === 'x64' ? '64' : '32');
                        const nativeDownload = lib.downloads?.classifiers?.[classifier];
                        if (nativeDownload) {
                            const nativeFile = path.join(ctx.dirs.LIBRARIES_DIR, nativeDownload.path);
                            if (!fs.existsSync(nativeFile)) {
                                tasks.push({ type: 'native', lib, nativeDownload, nativeFile });
                            }
                        }
                    }
                }
            }
            return tasks;
        };

        const _allLibTasks = _collectLibTasks();
        // [P0 OPT - 2026-07-21] 库下载并发从硬编码 32 提升到 48
        // 原因：库文件通常较小（100KB-5MB），单流下载后单连接占用时间短，
        // 32 并发下 64 个文件需要 2 批次；提升到 48 后基本 1 批次完成。
        // 全局 connectionLimit 是 64，48 并发留 16 给其他下载任务。
        // 配合优化1（跳过 probe 探测），预期 libraries 阶段从 24s 降到 5-8s。
        const _settings = require('../http-client/settings').loadSettingsCached();
        const _libParallel = Math.min(Math.max(_settings.maxThreads || 48, 48), 64);
        if (_allLibTasks.length > 0) {
            let _libDone = 0;
            let _libActive = 0;
            let _libIdx = 0;
            let _libFinish = null;
            const _scheduleLib = () => {
                while (_libActive < _libParallel && _libIdx < _allLibTasks.length) {
                    const task = _allLibTasks[_libIdx++];
                    _libActive++;
                    (async () => {
                        if (task.type === 'artifact') {
                            try {
                                if (fs.existsSync(task.libPath)) fs.unlinkSync(task.libPath);
                                await http.downloadFileWithMirror(task.lib.downloads.artifact.url, task.libPath, null, 3, null, 60000);
                            } catch (e) {
                                // downloadFileWithMirror 内部已尝试所有镜像（含熔断保护），
                                // 这里作为最后防线，用 _curlDownload 直接尝试多个镜像源。
                                // 注意：libraries.minecraft.net 的 BMCLAPI 规范路径是 /libraries/（见 context.js），
                                // 不是 /maven/（那是 maven.minecraftforge.net 的镜像路径）。
                                const _orig = task.lib.downloads.artifact.url;
                                const _bmcl = _orig.replace('https://libraries.minecraft.net/', 'https://bmclapi2.bangbang93.com/libraries/');
                                const _aliyun = _orig.replace('https://libraries.minecraft.net/', 'https://maven.aliyun.com/repository/public/');
                                const _tencent = _orig.replace('https://libraries.minecraft.net/', 'https://mirrors.cloud.tencent.com/nexus/repository/maven-public/');
                                const _fm = _orig.replace('https://libraries.minecraft.net/', 'https://maven.minecraftforge.net/');
                                const _mavenCentral = _orig.replace('https://libraries.minecraft.net/', 'https://repo1.maven.org/maven2/');
                                const fallbacks = [_bmcl, _aliyun, _tencent, _fm, _mavenCentral, _orig];
                                for (const fb of fallbacks) {
                                    if (fs.existsSync(task.libPath) && fs.statSync(task.libPath).size > 100) break;
                                    try { utils.ensureDirForFile(task.libPath); await _curlDownload(fb, task.libPath); } catch (_) {}
                                }
                            }
                        } else if (task.type === 'name') {
                            const baseUrl = task.lib.url || 'https://libraries.minecraft.net/';
                            const downloadUrl = `${baseUrl}${task.groupPath}/${task.lname}/${task.lversion}/${task.jarName}`;
                            try {
                                await http.downloadFileWithMirror(downloadUrl, task.libFile);
                            } catch (e) {
                                // 同 artifact 分支：多镜像 fallback，BMCLAPI 用规范路径 /libraries/
                                const _bmcl2 = downloadUrl.replace('https://libraries.minecraft.net/', 'https://bmclapi2.bangbang93.com/libraries/');
                                const _aliyun2 = downloadUrl.replace('https://libraries.minecraft.net/', 'https://maven.aliyun.com/repository/public/');
                                const _tencent2 = downloadUrl.replace('https://libraries.minecraft.net/', 'https://mirrors.cloud.tencent.com/nexus/repository/maven-public/');
                                const _fm2 = downloadUrl.replace('https://libraries.minecraft.net/', 'https://maven.minecraftforge.net/');
                                const _mavenCentral2 = downloadUrl.replace('https://libraries.minecraft.net/', 'https://repo1.maven.org/maven2/');
                                const fallbacks2 = [_bmcl2, _aliyun2, _tencent2, _fm2, _mavenCentral2, downloadUrl];
                                for (const fb of fallbacks2) {
                                    if (fs.existsSync(task.libFile) && fs.statSync(task.libFile).size > 100) break;
                                    try { utils.ensureDirForFile(task.libFile); await _curlDownload(fb, task.libFile); } catch (_) {}
                                }
                            }
                        } else if (task.type === 'native') {
                            try {
                                await http.downloadFileWithMirror(task.nativeDownload.url, task.nativeFile);
                            } catch (e) {
                            }
                        }
                    })().finally(() => {
                        _libActive--;
                        _libDone++;
                        downloadedLibs = _libDone;
                        if (totalLibs > 0) {
                            report(`正在下载库文件 (${downloadedLibs}/${totalLibs})...`, 30 + Math.round(downloadedLibs / totalLibs * 35));
                        }
                        if (_libActive === 0 && _libDone >= _allLibTasks.length && _libFinish) _libFinish();
                        else if (_libActive < _libParallel && _libIdx < _allLibTasks.length) _scheduleLib();
                    });
                }
            };
            await new Promise(resolve => { _libFinish = resolve; _scheduleLib(); });
        } else {
            for (const lib of libraries) {
                if (lib.natives) {
                    const nativeKey = lib.natives[process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'];
                    if (nativeKey) {
                        const classifier = nativeKey.replace('${arch}', process.arch === 'x64' ? '64' : '32');
                        const nativeDownload = lib.downloads?.classifiers?.[classifier];
                        if (nativeDownload) {
                            const nativeFile = path.join(ctx.dirs.LIBRARIES_DIR, nativeDownload.path);
                            if (!fs.existsSync(nativeFile)) {
                                try {
                                    await http.downloadFileWithMirror(nativeDownload.url, nativeFile);
                                } catch (e) {
                                }
                            }
                        }
                    }
                }
            }
        }

        report('正在下载资源索引...', 68);
        if (versionDetails.assetIndex) {
            const assetIndexDir = path.join(ctx.dirs.ASSETS_DIR, 'indexes');
            if (!fs.existsSync(assetIndexDir)) fs.mkdirSync(assetIndexDir, { recursive: true });
            const assetIndexPath = path.join(assetIndexDir, `${versionDetails.assetIndex.id}.json`);
            if (!fs.existsSync(assetIndexPath) || (versionDetails.assetIndex.sha1 && !(await utils.verifyFileSha1(assetIndexPath, versionDetails.assetIndex.sha1)))) {
                if (fs.existsSync(assetIndexPath)) fs.unlinkSync(assetIndexPath);
                await http.downloadFileWithMirror(versionDetails.assetIndex.url, assetIndexPath);
            }
        }

        report('正在校验库文件...', 72);
        const missingLibs = [];
        const libsToVerify = (versionDetails.libraries || []).filter(l =>
            l.downloads?.artifact?.path && !(l.rules && !versions.evaluateRules(l.rules))
        );
        for (let i = 0; i < Math.min(5, libsToVerify.length); i++) {
            const lib = libsToVerify[i];
            const libFile = path.join(ctx.dirs.LIBRARIES_DIR, lib.downloads.artifact.path);
            if (!fs.existsSync(libFile)) {
                missingLibs.push(lib.downloads.artifact.path);
            }
        }
        if (missingLibs.length > 0) {
            const msg = `基础版本 ${gameVersion} 库文件下载后仍缺失 (${missingLibs.length}个): ${missingLibs[0]}`;
            console.error(`[BaseVersion] ${msg}`);
            return { error: msg };
        }

        return { alreadyInstalled: false, success: true };
    } catch (e) {
        console.error(`[BaseVersion] Failed to install ${gameVersion}:`, e.message);
        try {
            const versionDir = path.join(ctx.dirs.VERSIONS_DIR, gameVersion);
            if (fs.existsSync(versionDir)) {
                fs.rmSync(versionDir, { recursive: true, force: true });
            }
        } catch (cleanupErr) {
            console.error(`[BaseVersion] Failed to cleanup version directory:`, cleanupErr.message);
        }
        return { alreadyInstalled: false, error: `基础版本 ${gameVersion} 安装失败: ${e.message}` };
    }
}

// ============================================================================
// 加载器库验证
// ============================================================================

function verifyLoaderLibs(versionId) {
    try {
        const mergedJson = versions.resolveVersionJson(versionId);
        if (!mergedJson) {
            const jsonPath = path.join(ctx.dirs.VERSIONS_DIR, versionId, `${versionId}.json`);
            if (!fs.existsSync(jsonPath)) return false;
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            if (!data.libraries || data.libraries.length === 0) return false;
        }
        const libs = mergedJson ? (mergedJson.libraries || []) : [];
        let checked = 0, missing = 0;
        const missingPaths = [];
        for (const lib of libs) {
            if (lib.rules && !versions.evaluateRules(lib.rules)) continue;
            let libPath = null;
            if (lib.downloads?.artifact?.path) {
                libPath = path.join(ctx.dirs.LIBRARIES_DIR, lib.downloads.artifact.path);
            } else if (lib.name) {
                const parts = lib.name.split(':');
                if (parts.length >= 3) {
                    const gp = parts[0].replace(/\./g, path.sep);
                    const nm = parts[1];
                    const vr = parts[2];
                    const cls = parts.length >= 4 ? parts[3] : '';
                    const jn = cls ? `${nm}-${vr}-${cls}.jar` : `${nm}-${vr}.jar`;
                    libPath = path.join(ctx.dirs.LIBRARIES_DIR, gp, nm, vr, jn);
                }
            }
            if (libPath) {
                checked++;
                if (!fs.existsSync(libPath)) {
                    missing++;
                    if (missingPaths.length < 3) missingPaths.push(lib.name || path.basename(libPath));
                }
            }
        }
        if (missing > 0) {
            return false;
        }

        const _vlLower = versionId.toLowerCase();
        const _isNeo = _vlLower.includes('neoforge') || _vlLower.includes('neoforged');
        const isForge = _vlLower.includes('forge') && !_isNeo;
        if (isForge && checked > 0) {
            const forgeCoreFiles = [];
            for (const lib of libs) {
                if (!lib.name) continue;
                if (lib.name.startsWith('net.minecraftforge:forge:') && lib.name.split(':').length >= 4) {
                    forgeCoreFiles.push(lib);
                }
                if (lib.name === 'net.minecraftforge:forge' || lib.name.startsWith('net.minecraftforge:forge:')) {
                    forgeCoreFiles.push(lib);
                }
                if (lib.name.startsWith('net.minecraft:client:') && (lib.name.endsWith(':srg') || lib.name.endsWith(':extra'))) {
                    forgeCoreFiles.push(lib);
                }
            }
            let forgeCoreMissing = 0;
            const missingForgeCores = [];
            for (const lib of forgeCoreFiles) {
                const parts = lib.name.split(':');
                const gp = parts[0].replace(/\./g, path.sep);
                const nm = parts[1];
                const vr = parts[2];
                const cl = parts.length >= 4 ? parts[3] : '';
                const jn = cl ? `${nm}-${vr}-${cl}.jar` : `${nm}-${vr}.jar`;
                const fp = path.join(ctx.dirs.LIBRARIES_DIR, gp, nm, vr, jn);
                if (!fs.existsSync(fp)) {
                    forgeCoreMissing++;
                    missingForgeCores.push(path.basename(fp));
                }
            }

            const mainJsonPath = path.join(ctx.dirs.VERSIONS_DIR, versionId, `${versionId}.json`);
            try {
                const mainJson = JSON.parse(fs.readFileSync(mainJsonPath, 'utf-8'));
                if (mainJson.mainClass && mainJson.mainClass.includes('bootstraplauncher')) {
                    const mcMatch = versionId.match(/^(\d+\.\d+(?:\.\d+)?)-forge-(.+)$/);
                    if (mcMatch) {
                        const mcV = mcMatch[1];
                        const fV = mcMatch[2];
                        const forgeVerStr = `${mcV}-${fV}`;
                        const forgeClientPath = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'minecraftforge', 'forge', forgeVerStr, `forge-${forgeVerStr}-client.jar`);
                        const forgeUniversalPath = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'minecraftforge', 'forge', forgeVerStr, `forge-${forgeVerStr}-universal.jar`);
                        const hasForgeJar = (fs.existsSync(forgeClientPath) && utils.isJarIntact(forgeClientPath)) ||
                            (fs.existsSync(forgeUniversalPath) && utils.isJarIntact(forgeUniversalPath));
                        if (!hasForgeJar) {
                            forgeCoreMissing++;
                            missingForgeCores.push(`forge-${forgeVerStr}-client.jar`);
                        }

                        const args = mainJson.arguments?.game || [];
                        const mcpIdx = args.findIndex(a => a === '--fml.mcpVersion');
                        if (mcpIdx >= 0 && mcpIdx + 1 < args.length) {
                            const mcpV = args[mcpIdx + 1];
                            const clientVerStr = `${mcV}-${mcpV}`;
                            for (const suffix of ['srg', 'extra']) {
                                const cp = path.join(ctx.dirs.LIBRARIES_DIR, 'net', 'minecraft', 'client', clientVerStr, `client-${clientVerStr}-${suffix}.jar`);
                                if (!fs.existsSync(cp) || !utils.isJarIntact(cp)) {
                                    forgeCoreMissing++;
                                    missingForgeCores.push(`client-${clientVerStr}-${suffix}.jar`);
                                }
                            }
                        }
                    }
                }
            } catch (_) {}

            if (forgeCoreMissing > 0) {
                return false;
            }
        }

        return checked > 0;
    } catch (e) {
        return false;
    }
}

// ============================================================================
// 版本比较与模组需求扫描
// ============================================================================

function compareSemver(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}

function parseVersionRequirement(req) {
    if (!req || typeof req !== 'string') return null;
    const m = req.match(/^([><=]+)\s*(.+)/);
    if (!m) return { op: '>=', version: req.trim() };
    return { op: m[1], version: m[2].trim() };
}

function scanModsForLoaderReqs(modsDir) {
    const result = { fabric: null, forge: null };
    if (!fs.existsSync(modsDir)) return result;
    let AdmZip;
    try { AdmZip = require('adm-zip'); } catch (_) { return result; }
    const files = fs.readdirSync(modsDir).filter(f => f.endsWith('.jar'));
    for (const f of files) {
        try {
            const zip = new AdmZip(path.join(modsDir, f));
            let metaEntry = zip.getEntry('fabric.mod.json');
            let isQuilt = false;
            if (!metaEntry) { metaEntry = zip.getEntry('quilt.mod.json'); isQuilt = true; }
            if (!metaEntry) continue;
            const meta = JSON.parse(metaEntry.getData().toString('utf8'));
            const deps = isQuilt ? (meta.quilt_loader?.dependencies || {}) : (meta.depends || {});
            const fabricReq = deps.fabricloader || deps['fabric-loader'];
            if (fabricReq && typeof fabricReq === 'string') {
                const parsed = parseVersionRequirement(fabricReq);
                if (parsed && (parsed.op === '>=' || parsed.op === '=' || parsed.op === '==')) {
                    if (!result.fabric || compareSemver(parsed.version, result.fabric) > 0) {
                        result.fabric = parsed.version;
                    }
                }
            }
            const forgeReq = deps.forge;
            if (forgeReq && typeof forgeReq === 'string') {
                const parsed = parseVersionRequirement(forgeReq);
                if (parsed && (parsed.op === '>=' || parsed.op === '=' || parsed.op === '==')) {
                    if (!result.forge || compareSemver(parsed.version, result.forge) > 0) {
                        result.forge = parsed.version;
                    }
                }
            }
        } catch (_) {}
    }
    return result;
}

async function ensureLoaderCompat(versionId, versionDir, mcVersion, currentLoaderVer, loaderType, progress, abortSignal) {
    const { installFabric } = require('./fabric');
    const { installForge } = require('./forge');
    const modsDir = path.join(versionDir, 'mods');
    const reqs = scanModsForLoaderReqs(modsDir);
    const needed = loaderType === 'fabric' ? reqs.fabric : (loaderType === 'forge' ? reqs.forge : null);
    if (!needed || !currentLoaderVer) return { upgraded: false };
    if (compareSemver(needed, currentLoaderVer) <= 0) return { upgraded: false };
    progress('loader-upgrade', `正在升级 ${loaderType === 'fabric' ? 'Fabric' : 'Forge'} 加载器到 ${needed}...`, 88, [], '');
    let newLoaderVersionId;
    try {
        if (loaderType === 'fabric') {
            newLoaderVersionId = `fabric-loader-${needed}-${mcVersion}`;
            const ir = await installFabric(mcVersion, needed, (p, msg) => {
                progress('loader-upgrade', msg || `安装 Fabric ${needed}...`, 88 + Math.round(p * 2), [], '');
            });
            if (!ir.success) throw new Error(ir.error);
        } else {
            newLoaderVersionId = `${mcVersion}-forge-${needed}`;
            const ir = await installForge(mcVersion, needed, (p, msg) => {
                progress('loader-upgrade', msg || `安装 Forge ${needed}...`, 88 + Math.round(p * 2), [], '');
            });
            if (!ir.success) throw new Error(ir.error);
        }
        const oldJsonPath = path.join(versionDir, `${versionId}.json`);
        if (fs.existsSync(oldJsonPath)) {
            const oldJson = JSON.parse(fs.readFileSync(oldJsonPath, 'utf-8'));
            oldJson.inheritsFrom = newLoaderVersionId;
            let newMainClass = '';
            try {
                const lvJsonPath = path.join(ctx.dirs.VERSIONS_DIR, newLoaderVersionId, `${newLoaderVersionId}.json`);
                if (fs.existsSync(lvJsonPath)) {
                    const lvJson = JSON.parse(fs.readFileSync(lvJsonPath, 'utf-8'));
                    newMainClass = lvJson.mainClass || '';
                }
            } catch (_) {}
            if (newMainClass) oldJson.mainClass = newMainClass;
            fs.writeFileSync(oldJsonPath, JSON.stringify(oldJson, null, 2));
        }
        progress('loader-upgrade', `${loaderType === 'fabric' ? 'Fabric' : 'Forge'} 已升级到 ${needed}`, 90, [], '');
        return { upgraded: true, newVersion: needed };
    } catch (e) {
        console.error(`[Modpack] ${loaderType} 升级失败: ${e.message}`);
        progress('loader-upgrade', `${loaderType} 升级失败: ${e.message}（使用原版本继续）`, 90, [], '');
        return { upgraded: false, error: e.message };
    }
}

// ============================================================================
// 导入库验证
// ============================================================================

async function verifyImportLibs(versionId, progress, abortSignal) {
    const mergedJson = versions.resolveVersionJson(versionId);
    const allLibs = mergedJson ? (mergedJson.libraries || []) : [];
    const currentPlatform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux';
    let libChecked = 0, coreLibMissing = 0, nonCoreLibMissing = 0;
    const coreMissingLibFiles = [];
    const nonCoreMissingLibFiles = [];
    const CORE_PREFIXES = ['net.minecraftforge', 'net.neoforged', 'cpw.mods', 'net.minecraft'];

    function isCoreLibrary(libName) {
        if (!libName) return false;
        const pkg = libName.split(':')[0];
        return CORE_PREFIXES.some(p => pkg.startsWith(p));
    }

    for (const lib of allLibs) {
        if (lib.rules && !versions.evaluateRules(lib.rules)) continue;

        let libPath = null;
        let dlUrl = '';
        let sha1 = '';
        let size = 0;

        if (lib.natives) {
            // Native library: resolve platform-specific classifier (e.g. lwjgl-natives-windows)
            const nativeKey = lib.natives[currentPlatform];
            if (!nativeKey) continue;
            const classifier = nativeKey.replace('${arch}', process.arch === 'x64' ? '64' : '32');
            const nativeDownload = lib.downloads?.classifiers?.[classifier];
            if (!nativeDownload) continue;
            libPath = path.join(ctx.dirs.LIBRARIES_DIR, nativeDownload.path);
            dlUrl = nativeDownload.url || '';
            sha1 = nativeDownload.sha1 || '';
            size = nativeDownload.size || 0;
        } else {
            const nameSuffix = lib.name ? lib.name.split(':').pop() : '';
            if (nameSuffix.startsWith('natives-')) {
                let isValid = false;
                if (process.arch === 'x64') {
                    const plat = nameSuffix.replace('natives-', '');
                    isValid = plat === currentPlatform || plat === currentPlatform + '-x64';
                }
                if (!isValid) continue;
            }
            if (lib.downloads?.artifact?.path) {
                libPath = path.join(ctx.dirs.LIBRARIES_DIR, lib.downloads.artifact.path);
            } else if (lib.name) {
                const p = lib.name.split(':');
                if (p.length >= 3) {
                    const gp = p[0].replace(/\./g, path.sep);
                    const cl = p.length >= 4 ? `-${p[3]}` : '';
                    const jn = `${p[1]}-${p[2]}${cl}.jar`;
                    libPath = path.join(ctx.dirs.LIBRARIES_DIR, gp, p[1], p[2], jn);
                }
            }
            dlUrl = lib.downloads?.artifact?.url || '';
            sha1 = lib.downloads?.artifact?.sha1 || '';
            size = lib.downloads?.artifact?.size || 0;
            if (!dlUrl && lib.name) {
                const p = lib.name.split(':');
                if (p.length >= 3) {
                    const mg = p[0].replace(/\./g, '/');
                    const cl = p.length >= 4 ? `-${p[3]}` : '';
                    const jn = `${p[1]}-${p[2]}${cl}.jar`;
                    const base = lib.url || (p[0].includes('neoforged') ? 'https://maven.neoforged.net/'
                        : (p[0].includes('forge') || p[0].includes('minecraftforge') || p[0].includes('minecraft')
                        ? 'https://maven.minecraftforge.net/' : 'https://libraries.minecraft.net/'));
                    dlUrl = `${base}${mg}/${p[1]}/${p[2]}/${jn}`;
                }
            }
        }

        libChecked++;
        if (libPath && (!libPath.endsWith('.jar') ? !fs.existsSync(libPath) : !utils.isJarIntact(libPath))) {
            const libEntry = {
                type: 'library', url: dlUrl || '', path: libPath,
                sha1: sha1, size: size,
                name: lib.name || path.basename(libPath)
            };
            if (isCoreLibrary(lib.name)) {
                coreLibMissing++;
                coreMissingLibFiles.push(libEntry);
            } else {
                nonCoreLibMissing++;
                nonCoreMissingLibFiles.push(libEntry);
            }
        }
    }
    if (coreLibMissing > 0) {
        if (progress) progress('verify', `正在补全 ${coreLibMissing} 个核心缺失库文件...`, 91, [], '');
        // 详细记录每个缺失的核心库文件，便于排查下载失败问题
        utils._writeImportLog(`[verify] 发现 ${coreLibMissing} 个核心库缺失，明细如下：`);
        for (const f of coreMissingLibFiles) {
            utils._writeImportLog(`[verify]  - name=${f.name || '(无)'} path=${f.path} url=${f.url || '(无URL)'} sha1=${f.sha1 || '(无)'}`);
        }
        const dlResult = await dependencies.downloadMissingDependencies(coreMissingLibFiles, (p) => {
            if (progress && p.progress !== undefined) {
                const pct = 91 + Math.round((p.progress / 100) * 6);
                progress('verify', `补全核心依赖 (${(p.completed || 0) + (p.failed || 0)}/${coreLibMissing})`, Math.min(pct, 97), [], '');
            }
        }, mergedJson);
        if (dlResult.failed > 0) {
            // 详细记录每个失败文件，便于定位（URL/路径/错误信息）
            utils._writeImportLog(`[verify] 核心库补全失败 ${dlResult.failed} 个，失败文件明细：`);
            for (const ff of (dlResult.failedFiles || [])) {
                utils._writeImportLog(`[verify]  - name=${ff.name || '(无)'} url=${ff.url || '(无)'} path=${ff.path || '(无)'} error=${ff.error || '(无)'}`);
            }
            return { ok: false, checked: libChecked, missing: dlResult.failed };
        }
    }

    if (nonCoreLibMissing > 0) {
        if (progress) progress('verify', `正在补全 ${nonCoreLibMissing} 个非核心缺失库文件...`, 91, [], '');
        const dlResult = await dependencies.downloadMissingDependencies(nonCoreMissingLibFiles, (p) => {
            if (progress && p.progress !== undefined) {
                const pct = 91 + Math.round((p.progress / 100) * 6);
                progress('verify', `补全非核心依赖 (${(p.completed || 0) + (p.failed || 0)}/${nonCoreLibMissing})`, Math.min(pct, 97), [], '');
            }
        }, mergedJson);
        if (dlResult.failed > 0) {
            if (progress) progress('verify', `警告: ${dlResult.failed} 个非核心库补全失败，将继续导入`, 93, [], '');
            return { ok: true, checked: libChecked, missing: dlResult.failed, warning: `${dlResult.failed} 个非核心库文件缺失（如 org.apache、com.google 等），导入将继续但可能影响部分功能` };
        }
    }

    if (progress) progress('verify', '完整性检查通过', 93, [], '');
    return { ok: true, checked: libChecked, missing: 0 };
}

function isLibValid(libPath, expectedSize, expectedSha1) {
    if (!fs.existsSync(libPath)) return false;
    try {
        const stat = fs.statSync(libPath);
        if (stat.size === 0) return false;
        if (expectedSize > 0 && stat.size !== expectedSize) return false;
        if (expectedSha1 && typeof expectedSha1 === 'string' && expectedSha1.length === 40) {
            const crypto = require('crypto');
            const content = fs.readFileSync(libPath);
            const hash = crypto.createHash('sha1').update(content).digest('hex');
            return hash === expectedSha1;
        }
        return stat.size > 1024;
    } catch (e) {
        return false;
    }
}

function getNeoLibMirrorUrl(originalUrl) {
    if (!originalUrl) return originalUrl;
    return originalUrl
        .replace('https://maven.neoforged.net/releases/', 'https://bmclapi2.bangbang93.com/maven/')
        .replace('https://maven.neoforged.net/', 'https://bmclapi2.bangbang93.com/maven/')
        .replace('https://maven.minecraftforge.net/', 'https://bmclapi2.bangbang93.com/maven/')
        .replace('https://libraries.minecraft.net/', 'https://bmclapi2.bangbang93.com/libraries/');
}

// ============================================================================
// NeoForge / Forge 官方安装器调用
// ============================================================================
// 历史问题：原代码尝试手动执行 install_profile.json 中的 processors 来生成 patched JAR，
// 但 PROCESS_MINECRAFT_JAR 这个 task 在 installertools.ConsoleTool 中并不存在
// （ConsoleTool 只支持 EXTRACT_FILES/BUNDLER_EXTRACT/MCP_DATA/DOWNLOAD_MOJMAPS/MERGE_MAPPING 等 task）。
// 正确的 patch 流程需要按顺序执行 6 个 processor（jarsplitter、AutoRenamingTool、binarypatcher 等），
// 每个 processor 有自己的 jar、classpath、main class，工程复杂且容易出错。
//
// 解决方案：直接调用官方 SimpleInstaller（neoforge-installer.jar）的命令行模式：
//   java -jar neoforge-installer.jar --install-client <data-dir>
// 官方安装器会自动完成所有 processor 步骤，生成 patched JAR 和 version.json。

/**
 * 使用 Java FileSystem API 向 JAR 的 MANIFEST.MF 主属性区插入 Minecraft-Dists: client。
 *
 * NeoForge 20.6+ 使用 --no-mod-manifest 构建的 patched jar 缺少此属性，FML 启动时会报错：
 * "NeoForge dev environment Minecraft jar does not have a Minecraft-Dists attribute in its manifest"
 *
 * 之前使用 AdmZip 修改 manifest，但 NeoForge SimpleInstaller 生成的 jar 使用 ZIP data descriptor
 * 格式，AdmZip 报 "No descriptor present" 无法读取。改用 Java NIO FileSystem API 直接修改，
 * 能正确处理各种 ZIP 格式，并将属性插入主属性区（第一段空行之前），而非追加到文件末尾。
 *
 * @param {string} jarPath - JAR 文件绝对路径
 * @param {string} javaPath - java.exe 绝对路径
 * @param {string} logPrefix - 日志前缀
 */
function _fixMinecraftDistsManifest(jarPath, javaPath, logPrefix) {
  const javaSource = String.raw`
import java.io.*;
import java.nio.file.*;
import java.util.*;
public class FixMF {
    public static void main(String[] args) throws Exception {
        String jarPath = args[0];
        Map<String, String> env = new HashMap<>();
        env.put("create", "false");
        try (FileSystem fs = FileSystems.newFileSystem(Paths.get(jarPath), env)) {
            Path mf = fs.getPath("META-INF/MANIFEST.MF");
            if (mf == null || !Files.exists(mf)) {
                System.err.println("MANIFEST.MF not found");
                System.exit(1);
            }
            String content = new String(Files.readAllBytes(mf), "UTF-8");
            String le = content.contains("\r\n") ? "\r\n" : "\n";
            int blank = content.indexOf(le + le);
            String mainSection = blank >= 0 ? content.substring(0, blank) : content;
            if (mainSection.toLowerCase().contains("minecraft-dists")) {
                System.out.println("SKIP");
                return;
            }
            String updated;
            if (blank >= 0) {
                updated = mainSection + le + "Minecraft-Dists: client" + content.substring(blank);
            } else {
                updated = content.replaceAll("\\s*$", "") + le + "Minecraft-Dists: client" + le;
            }
            Files.write(mf, updated.getBytes("UTF-8"));
            System.out.println("OK");
        }
    }
}
`;
  const tempDir = path.join(ctx.dirs.DATA_DIR, 'temp');
  fs.mkdirSync(tempDir, { recursive: true });
  const srcFile = path.join(tempDir, 'FixMF.java');
  fs.writeFileSync(srcFile, javaSource);

  const stdout = execSync(`"${javaPath}" --source 17 "${srcFile}" "${jarPath}"`, {
    stdio: 'pipe',
    timeout: 60000,
    env: { ...process.env }
  }).toString().trim();
  if (stdout === 'OK') {
    console.log(`${logPrefix} 已补充 Minecraft-Dists: client 到 ${path.basename(jarPath)}`);
  } else if (stdout === 'SKIP') {
    console.log(`${logPrefix} ${path.basename(jarPath)} 已包含 Minecraft-Dists，跳过`);
  }
}

/**
 * 调用 NeoForge/Forge 官方安装器生成 patched JAR。
 *
 * @param {object} options
 * @param {string} options.mcJarPath - 原版客户端 JAR 路径（仅用于日志校验）
 * @param {string} options.clientLzmaPath - client.lzma 路径（仅用于日志校验）
 * @param {string} options.patchedJarPath - patched JAR 期望输出路径
 * @param {Array} [options.profileLibs] - 兼容旧签名，不再使用
 * @param {Array} [options.processors] - 兼容旧签名，不再使用
 * @param {Function} [options.onProgress] - 进度回调 (pct, msg) => void
 * @param {string} [options.logPrefix='[NeoForge]'] - 日志前缀
 * @returns {Promise<void>}
 * @throws {Error} Java 不可用 / installer jar 缺失 / 子进程失败 / patched JAR 未生成
 */
async function runPatchProcessor({ mcJarPath, clientLzmaPath, patchedJarPath, profileLibs = [], processors = [], onProgress = null, logPrefix = '[NeoForge]', javaPath = null }) {
    // ===== 失败重试机制：准备可用的 Java 候选列表 =====
    // 1. 收集候选 Java（安装器需要 Java 17+）
    // 优先使用调用方按版本选定的 Java（如 NeoForge 26.x 需要 Java 25，若用 Java 17/21 跑安装器会崩溃退出码 1）；
    // 未指定时取所有 >=17 候选中版本最高者。
    // 安装器执行失败时自动换下一个候选 Java 重试，避免偶发的 Java 版本不匹配 / 进程崩溃导致安装直接失败。
    const javaCandidates = [];
    if (javaPath) {
        javaCandidates.push({ path: javaPath, source: '调用方指定' });
    }
    const detectedJava = [...java.detectBundledJava(), ...java.detectSystemJava()]
        .filter((j) => j.majorVersion >= 17)
        .sort((a, b) => b.majorVersion - a.majorVersion);
    for (const j of detectedJava) {
        if (!javaCandidates.some((c) => c.path === j.path)) {
            javaCandidates.push({ path: j.path, source: `检测 (Java ${j.majorVersion})` });
        }
    }
    if (javaCandidates.length === 0) {
        throw new Error('未找到 Java 17 或更高版本，无法运行 NeoForge/Forge 安装器');
    }
    console.log(`${logPrefix} 可用 Java 候选: ${javaCandidates.map((c) => c.source).join(' → ')}`);

    // 将单次安装执行封装为可重试函数，当前使用的 Java 由外层循环通过 currentJavaPath 指定
    let currentJavaPath = javaCandidates[0].path;
    const attempt = async () => {

    // 2. 检测 loader 类型并定位 installer jar / 输出路径
    // NeoForge patchedJarPath: .../net/neoforged/minecraft-client-patched/<ver>/minecraft-client-patched-<ver>.jar
    // Forge   patchedJarPath: .../net/minecraftforge/forge/<mc>-<fv>/forge-<mc>-<fv>-client.jar
    const isForge = patchedJarPath.includes('minecraftforge') || logPrefix === '[Forge]';
    let installerJarPath, simpleInstallerOutput, siVersionDirName, installerLogFileName;
    if (isForge) {
        const forgeVerDir = path.basename(path.dirname(patchedJarPath)); // <mc>-<fv>
        const forgeJarDir = path.dirname(patchedJarPath);
        installerJarPath = path.join(forgeJarDir, `forge-${forgeVerDir}-installer.jar`);
        // Forge installer 直接输出 patched jar 到 <mc>-<fv>/forge-<mc>-<fv>-client.jar
        simpleInstallerOutput = patchedJarPath;
        siVersionDirName = `forge-${forgeVerDir}`;
        installerLogFileName = `forge-${forgeVerDir}-installer.jar.log`;
    } else {
        const neoVersion = path.basename(patchedJarPath).replace('minecraft-client-patched-', '').replace('.jar', '');
        if (!neoVersion) {
            throw new Error(`无法从 patchedJarPath 提取版本号: ${patchedJarPath}`);
        }
        // NeoForge 1.20.1 旧版本沿用 forge maven 坐标（installer 位于 net/neoforged/forge/），
        // 1.20.5+ 才使用 neoforge 包名。需要与 installNeoForge 的下载路径保持一致。
        const isLegacyNeo = neoVersion.startsWith('1.20.1-');
        const neoPkg = isLegacyNeo ? 'forge' : 'neoforge';
        installerJarPath = path.join(
            ctx.dirs.LIBRARIES_DIR,
            'net', 'neoforged', neoPkg, neoVersion,
            `${neoPkg}-${neoVersion}-installer.jar`
        );
        simpleInstallerOutput = path.join(
            ctx.dirs.LIBRARIES_DIR,
            'net', 'neoforged', neoPkg, neoVersion,
            `${neoPkg}-${neoVersion}-client.jar`
        );
        siVersionDirName = `${neoPkg}-${neoVersion}`;
        installerLogFileName = `${neoPkg}-${neoVersion}-installer.jar.log`;
    }
    if (!fs.existsSync(installerJarPath)) {
        throw new Error(`${logPrefix} installer jar 未找到: ${installerJarPath}`);
    }
    console.log(`${logPrefix} 使用官方安装器: ${path.basename(installerJarPath)}`);

    // 4. 调用 SimpleInstaller --installClient（注意：Forge/NeoForge installer 使用驼峰参数名）
    const targetDir = ctx.dirs.DATA_DIR;
    const args = [
        '-Dfile.encoding=UTF-8',
        '-Dstdout.encoding=UTF-8',
        '-Dstderr.encoding=UTF-8',
        '-jar', installerJarPath,
        '--installClient', targetDir
    ];
    console.log(`${logPrefix} 目标目录: ${targetDir}`);

    // 4.5 确保 launcher_profiles.json 存在（官方安装器需要检测到启动器 profile）
    const launcherProfilesPath = path.join(targetDir, 'launcher_profiles.json');
    if (!fs.existsSync(launcherProfilesPath)) {
        try {
            const minimalProfiles = {
                profiles: {
                    VersePC: {
                        name: 'VersePC',
                        type: 'custom',
                        created: new Date().toISOString(),
                        lastUsed: new Date().toISOString(),
                        icon: 'VersePC'
                    }
                },
                selectedProfile: 'VersePC',
                clientToken: 'versepc-' + Date.now()
            };
            fs.writeFileSync(launcherProfilesPath, JSON.stringify(minimalProfiles, null, 2), 'utf8');
            console.log(`${logPrefix} 已创建 launcher_profiles.json`);
        } catch (e) {
            console.warn(`${logPrefix} 创建 launcher_profiles.json 失败（非致命）: ${e.message}`);
        }
    }

    if (onProgress) onProgress(0.9, '正在运行官方安装器...');

    // 进度关键词映射
    const progressMap = [
        ['Processor:', 0.92], ['Downloading:', 0.93],
        ['Loading patches', 0.94], ['Patching input', 0.96],
        ['Adding new files', 0.97], ['Injecting profile', 0.98],
        ['Successfully installed', 1.0]
    ];
    const parseLine = (line) => {
        if (!line) return;
        //console.log(`${logPrefix} ${line}`);
        for (const [keyword, pct] of progressMap) {
            if (line.includes(keyword)) {
                if (onProgress) onProgress(pct, line.substring(0, 80));
                break;
            }
        }
    };

    // 5. spawn Java 子进程
    await new Promise((resolve, reject) => {
        const child = spawn(currentJavaPath, args, {
            cwd: targetDir,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env }
        });
        let stdout = '', stderr = '';
        child.stdout.on('data', (data) => {
            stdout += data.toString();
            const lines = stdout.split('\n');
            stdout = lines.pop();
            for (const line of lines) parseLine(line.trim());
        });
        child.stderr.on('data', (data) => {
            stderr += data.toString();
            const lines = stderr.split('\n');
            stderr = lines.pop();
            for (const line of lines) parseLine(line.trim());
        });
        const killTimer = setTimeout(() => {
            try { child.kill('SIGKILL'); } catch (_) {}
            reject(new Error('官方安装器执行超时（300s）'));
        }, 300000);
        child.on('close', (code) => {
            clearTimeout(killTimer);
            if (stdout.trim()) parseLine(stdout.trim());
            if (stderr.trim()) console.warn(`${logPrefix} [stderr] ${stderr.trim()}`);
            if (code !== 0) {
                console.error(`${logPrefix} 安装器进程退出码: ${code}`);
                const errDetail = stderr.trim() ? `\nstderr: ${stderr.trim().substring(0, 2000)}` : '';
                const stdoutDetail = stdout.trim() ? `\nstdout: ${stdout.trim().substring(0, 1000)}` : '';
                reject(new Error(`官方安装器执行失败 (退出码 ${code})${errDetail}${stdoutDetail}`));
            } else {
                console.log(`${logPrefix} 安装器进程正常退出`);
                resolve();
            }
        });
        child.on('error', (err) => {
            clearTimeout(killTimer);
            console.error(`${logPrefix} 安装器 spawn 失败: ${err.message}`);
            reject(new Error(`官方安装器启动失败: ${err.message}`));
        });
    });

    // 6. 验证 patched JAR 已生成
    // 安装器可能输出到 simpleInstallerOutput（旧版）或 patchedJarPath（新版），检查两者
    let _actualOutput = null;
    if (fs.existsSync(simpleInstallerOutput) && fs.statSync(simpleInstallerOutput).size >= 1024) {
        _actualOutput = simpleInstallerOutput;
    } else if (fs.existsSync(patchedJarPath) && fs.statSync(patchedJarPath).size >= 1024) {
        _actualOutput = patchedJarPath;
    }
    if (!_actualOutput) {
        throw new Error(`${logPrefix} 官方安装器未生成 patched JAR: ${simpleInstallerOutput}`);
    }
    const outputSize = fs.statSync(_actualOutput).size;
    console.log(`${logPrefix} patched JAR 已生成: ${_actualOutput} (${outputSize} 字节)`);

    // 7. 复制到调用方期望的位置（如果安装器输出到了不同的路径）
    if (_actualOutput !== patchedJarPath) {
        fs.mkdirSync(path.dirname(patchedJarPath), { recursive: true });
        fs.copyFileSync(_actualOutput, patchedJarPath);
        console.log(`${logPrefix} patched JAR 已复制到: ${patchedJarPath}`);
    }

    // 7.5 NeoForge 20.6+ 使用 --no-mod-manifest 标志构建 patched jar，导致其 manifest 缺少
    // Minecraft-Dists 属性。FML 启动时会检查此属性，缺失则报错：
    // "NeoForge dev environment Minecraft jar does not have a Minecraft-Dists attribute in its manifest"
    // 这里在 patched jar 生成后补充该属性。同时对 actualOutput 和 patchedJarPath 都更新，
    // 因为 classpath 使用的是 :client 库条目指向的 neoforge-<version>-client.jar（即 actualOutput）。
    if (!isForge) {
        const _jarsToFix = [_actualOutput, patchedJarPath].filter((p, i, arr) => p && arr.indexOf(p) === i);
        for (const _jarPath of _jarsToFix) {
            try {
                _fixMinecraftDistsManifest(_jarPath, currentJavaPath, logPrefix);
            } catch (e) {
                console.warn(`${logPrefix} 补充 Minecraft-Dists manifest 属性失败 (${path.basename(_jarPath)}): ${e.message}`);
            }
        }
    }

    // 8. 清理 SimpleInstaller 创建的临时 version 目录（避免与我们的 version 目录混淆）
    if (siVersionDirName) {
        const siVersionDir = path.join(ctx.dirs.VERSIONS_DIR, siVersionDirName);
        if (fs.existsSync(siVersionDir)) {
            try {
                fs.rmSync(siVersionDir, { recursive: true, force: true });
                console.log(`${logPrefix} 已清理 SimpleInstaller 创建的临时 version 目录: ${siVersionDirName}`);
            } catch (e) {
                console.warn(`${logPrefix} 清理临时 version 目录失败（非致命）: ${e.message}`);
            }
        }
    }

    // 9. 清理 SimpleInstaller 创建的 installer log 文件
    const installerLogFile = path.join(targetDir, installerLogFileName);
    if (fs.existsSync(installerLogFile)) {
        try { fs.unlinkSync(installerLogFile); } catch (_) {}
    }
    };

    // ===== 失败重试循环：依次尝试每个候选 Java，直至安装成功或全部失败 =====
    let lastError = null;
    for (let i = 0; i < javaCandidates.length; i++) {
        const candidate = javaCandidates[i];
        currentJavaPath = candidate.path;
        if (onProgress) onProgress(0.88, `正在使用 ${candidate.source} 运行官方安装器...`);
        try {
            await attempt();
            console.log(`${logPrefix} 安装成功，使用的 Java: ${candidate.source} (${currentJavaPath})`);
            lastError = null;
            break;
        } catch (err) {
            lastError = err;
            console.warn(`${logPrefix} 使用 ${candidate.source} 安装失败: ${err.message}`);
            if (i < javaCandidates.length - 1) {
                console.warn(`${logPrefix} 尝试下一个候选 Java...`);
            }
        }
    }
    if (lastError) {
        throw lastError;
    }
}

module.exports = {
    SERVER_DIR,
    ensureBaseVersionInstalled,
    verifyLoaderLibs,
    compareSemver,
    parseVersionRequirement,
    scanModsForLoaderReqs,
    ensureLoaderCompat,
    verifyImportLibs,
    isLibValid,
    getNeoLibMirrorUrl,
    runPatchProcessor,
};
