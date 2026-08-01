/**
 * @file server/launch/shared.js
 * @description 启动共享工具模块。从原 server/launch.js 拆分而来。
 *              包含：server.js 懒加载、DoRound 内存优化常量、退出码分析、游戏语言设置、窗口设置。
 */
const fs = require('fs');
const path = require('path');
const ctx = require('../context');
const versions = require('../versions');

/* 懒加载 server.js 中尚未抽取到子模块的函数（避免循环依赖） */
let _serverModule = null;
function _server() {
  if (_serverModule === null) {
    try {
      _serverModule = require('../../server');
    } catch (_) {
      _serverModule = {};
    }
  }
  return _serverModule;
}

/*
 * DoRound - PowerShell 内存优化脚本（字符串常量，非 JS 函数）
 * 通过文件系统句柄刷新与系统内存回收指令，释放 Windows 系统缓存，
 * 启动游戏前调用可降低内存压力。脚本内容请勿修改。
 */
const DoRound = `$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -MemberDefinition '[DllImport("kernel32.dll", SetLastError=true)] private static extern int SetSystemInformation(uint infoClass, IntPtr info, uint length);' -Name "W32SysInfo" -Namespace "VP" -WarningAction SilentlyContinue -PassThru | Out-Null
Add-Type -MemberDefinition '[DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr CreateFile(string lpFileName, uint dwDesiredAccess, uint dwShareMode, IntPtr lpSecurityAttributes, uint dwCreationDisposition, uint dwFlagsAndAttributes, IntPtr hTemplateFile);' -Name "W32File" -Namespace "VP" -WarningAction SilentlyContinue -PassThru | Out-Null
Add-Type -MemberDefinition '[DllImport("kernel32.dll", SetLastError=true)] public static extern bool FlushFileBuffers(IntPtr hFile);' -Name "W32Flush" -Namespace "VP" -WarningAction SilentlyContinue -PassThru | Out-Null
Add-Type -MemberDefinition '[DllImport("kernel32.dll", SetLastError=true)] public static extern bool CloseHandle(IntPtr hObject);' -Name "W32Close" -Namespace "VP" -WarningAction SilentlyContinue -PassThru | Out-Null
function DoRound {
    try {
        $h = [VP.W32File]::CreateFile("\\\\.\\C:", 0x40000000, 0x00000003, [IntPtr]::Zero, 3, 0, [IntPtr]::Zero)
        if ($h -ne [IntPtr]::Zero -and [long]$h -ne -1) {
            [void][VP.W32Flush]::FlushFileBuffers($h)
            [void][VP.W32Close]::CloseHandle($h)
        }
    } catch {}
    Start-Sleep -Milliseconds 1000
    try { [VP.W32SysInfo]::SetSystemInformation(80, [IntPtr]::Zero, 0) } catch {}
    try { [VP.W32SysInfo]::SetSystemInformation(81, [IntPtr]::Zero, 0) } catch {}
    try { [VP.W32SysInfo]::SetSystemInformation(82, [IntPtr]::Zero, 0) } catch {}
    try { [VP.W32SysInfo]::SetSystemInformation(39, [IntPtr]::Zero, 0) } catch {}
}
DoRound
Start-Sleep -Seconds 1
[GC]::Collect()
[GC]::WaitForPendingFinalizers()
$after = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024)
Write-Output $after`;

/* 退出码分析 */
/**
 * 分析游戏进程退出码并给出原因与修复建议
 * @param {number} code - 进程退出码
 * @param {string} versionId - 版本 ID（用于定位崩溃日志目录）
 * @returns {{code:number,reason:string,suggestion:string,isCrash:boolean,crashLogFile?:string}} 退出分析结果
 */
function analyzeExitCode(code, versionId) {
  const analysis = { code, reason: '', suggestion: '', isCrash: false };

  if (code === 0) {
    analysis.reason = '正常退出';
    analysis.suggestion = '';
    return analysis;
  }

  if (code === 1) {
    analysis.isCrash = true;
    analysis.reason = '游戏异常退出（通用错误）';
    analysis.suggestion = '可能是模组冲突或Java参数问题，请查看崩溃日志';
  } else if (code === -1) {
    analysis.isCrash = true;
    analysis.reason = '游戏进程被强制终止';
    analysis.suggestion = '可能是内存不足或用户手动结束进程';
  } else if (code === 137) {
    analysis.isCrash = true;
    analysis.reason = '内存不足（OOM Killer）';
    analysis.suggestion = '请增加分配内存或减少模组数量';
  } else if (code === 134) {
    analysis.isCrash = true;
    analysis.reason = '程序异常终止（SIGABRT）';
    analysis.suggestion = '可能是JVM内部错误，尝试更新Java版本';
  } else if (code === 139) {
    analysis.isCrash = true;
    analysis.reason = '段错误（SIGSEGV）';
    analysis.suggestion = '可能是JVM崩溃或原生库问题，尝试更新显卡驱动和Java';
  } else if (code === -7 || code === -1073741819) {
    analysis.isCrash = true;
    analysis.reason = 'JVM 崩溃（访问违规）';
    analysis.suggestion = '可能是显卡驱动不兼容或内存损坏，请更新显卡驱动和Java版本，尝试减少分配内存';
  } else {
    analysis.isCrash = true;
    analysis.reason = `异常退出（退出码: ${code}）`;
    analysis.suggestion = '请查看崩溃日志获取更多信息';
  }

  // 按版本隔离与全局目录搜索崩溃日志，匹配关键错误特征以细化原因
  const searchDirs = [];
  if (versionId && versions.resolveVersionIsolation(versionId)) {
    searchDirs.push(path.join(ctx.dirs.VERSIONS_DIR, versionId, 'crash-reports'));
  }
  const settings = versions.loadSettingsCached();
  searchDirs.push(path.join(settings.gameDir || ctx.dirs.DATA_DIR, 'crash-reports'));

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).sort().reverse();
    if (files.length > 0) {
      try {
        const content = fs.readFileSync(path.join(dir, files[0]), 'utf8');
        if (content.includes('java.lang.OutOfMemoryError')) {
          analysis.reason = '内存不足（OutOfMemoryError）';
          analysis.suggestion = '请在设置中增加最大内存分配';
        } else if (content.includes('UnsupportedClassVersionError') || content.includes('Unsupported major.minor version')) {
          analysis.reason = 'Java版本不兼容';
          analysis.suggestion = '游戏需要更高版本的Java，请在设置中更换Java版本';
        } else if (content.includes('java.lang.NoSuchMethodError') || content.includes('NoClassDefFoundError')) {
          analysis.reason = '模组版本不兼容';
          analysis.suggestion = '请检查模组是否与当前游戏版本和加载器版本匹配';
        } else if (content.includes('Unable to make protected final') || content.includes('does not export')) {
          analysis.reason = 'Java版本过高导致模块访问限制';
          analysis.suggestion = '请降级Java版本或使用Java 8/17启动';
        } else if (content.includes('ClassCastException') && content.includes('AppClassLoader') && content.includes('URLClassLoader')) {
          analysis.reason = 'Java版本过高（旧版 launchwrapper 不兼容 Java 9+）';
          analysis.suggestion = '该整合包需要 Java 8 才能运行。\n修复: 1)启动设置→Java→选择 JRE 8  2)启动器设置中关闭"自动选择高版本 Java"';
        } else if (content.includes('FMLCommonSetupEvent') || content.includes('fml')) {
          analysis.reason = 'Forge/Fabric初始化失败';
          analysis.suggestion = '请检查模组兼容性，尝试移除最近添加的模组';
        } else if (content.includes('ShaderCompilationException') || content.includes('shader')) {
          analysis.reason = '着色器编译失败';
          analysis.suggestion = '可能是光影模组问题，尝试移除光影模组';
        } else if (content.includes('Mixin') || content.includes('mixin')) {
          analysis.reason = 'Mixin注入失败';
          analysis.suggestion = '可能是模组与当前版本不兼容，检查Mixin相关模组';
        } else if (content.includes('OpenGL') || content.includes('GLFW')) {
          analysis.reason = '图形驱动问题';
          analysis.suggestion = '请更新显卡驱动或检查OpenGL支持';
        } else if (content.includes('Invalid paths argument') || content.includes('contained no existing paths')) {
          analysis.reason = 'Forge核心库文件缺失（Invalid paths argument）';
          analysis.suggestion = 'Forge安装不完整(fmlcore/javafmllanguage/mclanguage/lowcodelanguage缺失)。\n修复: 1)版本设置→文件修复 2)重新安装Forge 3)检查杀毒白名单';
        }
        analysis.crashLogFile = path.join(dir, files[0]);
        break;
      } catch (e) {}
    }
  }

  return analysis;
}

/* 设置游戏语言 */
/**
 * 根据版本发布时间设置游戏默认中文语言
 * @param {string} gameDir - 游戏目录
 * @param {object} versionJson - 版本 JSON
 * @param {object} settings - 启动设置（需包含 autoSetChinese 开关）
 */
function setGameLanguage(gameDir, versionJson, settings) {
  if (!settings.autoSetChinese) {
    return;
  }

  let optionsPath = path.join(gameDir, 'options.txt');

  if (!fs.existsSync(optionsPath)) {
    // Yosbr Mod 会将配置前置到 config/yosbr 目录
    const yosbrPath = path.join(gameDir, 'config', 'yosbr', 'options.txt');
    if (fs.existsSync(yosbrPath)) {
      optionsPath = yosbrPath;
    }
  }

  // 通过版本发布时间确定所需的语言代码格式（旧版用 zh_CN，1.13+ 用 zh_cn）
  const releaseTime = versionJson.releaseTime || versionJson.time || '';
  let releaseDate = new Date(0);
  if (releaseTime) {
    try {
      releaseDate = new Date(releaseTime);
    } catch (e) {}
  }

  const mc1_1_date = new Date('2012-01-12');
  const mc1_11_date = new Date('2016-06-08');
  const mc1_13_date = new Date('2017-09-18');

  let requiredLang = 'zh_cn';

  if (releaseDate > new Date(0) && releaseDate <= mc1_1_date) {
    return;
  } else if (releaseDate > mc1_1_date && releaseDate <= mc1_11_date) {
    requiredLang = 'zh_CN';
  } else if (releaseDate > mc1_11_date && releaseDate <= mc1_13_date) {
    requiredLang = 'zh_cn';
  } else {
    requiredLang = 'zh_cn';
  }

  let currentLang = 'none';
  let optionsContent = '';

  if (fs.existsSync(optionsPath)) {
    optionsContent = fs.readFileSync(optionsPath, 'utf-8');
    const langMatch = optionsContent.match(/^lang:(.+)$/m);
    if (langMatch) {
      currentLang = langMatch[1].trim();
    }
  }

  if (currentLang !== requiredLang) {
    // 已有存档且语言已显式设置时保留用户选择，避免覆盖
    const hasExistingSaves = fs.existsSync(path.join(gameDir, 'saves'));
    if (!(currentLang !== 'none' && hasExistingSaves)) {
      if (optionsContent && currentLang !== 'none') {
        optionsContent = optionsContent.replace(/^lang:.+$/m, `lang:${requiredLang}`);
      } else if (optionsContent) {
        optionsContent += `\nlang:${requiredLang}`;
      } else {
        optionsContent = `lang:${requiredLang}\n`;
      }
    }
  }

  const dir = path.dirname(optionsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(optionsPath, optionsContent, 'utf-8');
}

/* 应用窗口设置 */
/**
 * 将全屏/窗口化设置写入 options.txt（同时处理 yosbr 目录）
 * @param {string} gameDir - 游戏目录
 * @param {object} settings - 启动设置（需包含 fullscreen 开关）
 */
function applyWindowSettings(gameDir, settings) {
  try {
    const mainOptionsPath = path.join(gameDir, 'options.txt');
    const yosbrPath = path.join(gameDir, 'config', 'yosbr', 'options.txt');

    // 收集需要写入的路径：主 options.txt 和 yosbr（如果存在）
    const targetPaths = [mainOptionsPath];
    if (fs.existsSync(yosbrPath)) {
      targetPaths.push(yosbrPath);
    }

    const fullscreenValue = settings.fullscreen ? 'true' : 'false';

    for (const optionsPath of targetPaths) {
      let optionsContent = '';
      if (fs.existsSync(optionsPath)) {
        optionsContent = fs.readFileSync(optionsPath, 'utf-8');
      }

      // 替换或追加 fullscreen 行
      if (optionsContent.match(/^fullscreen:/m)) {
        optionsContent = optionsContent.replace(/^fullscreen:.*$/m, `fullscreen:${fullscreenValue}`);
      } else if (optionsContent) {
        optionsContent += `\nfullscreen:${fullscreenValue}`;
      } else {
        optionsContent = `fullscreen:${fullscreenValue}\n`;
      }

      const dir = path.dirname(optionsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(optionsPath, optionsContent, 'utf-8');
    }
  } catch (e) {
    console.error('[Options] 写入窗口设置失败:', e.message);
  }
}

module.exports = { _server, DoRound, analyzeExitCode, setGameLanguage, applyWindowSettings };
