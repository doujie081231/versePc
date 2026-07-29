/* page-toolbox.js - 工具箱页 Vue 组件（渐进式改造）
 * 原则：
 *   1. CSS 一行不动（class 名保留原样）
 *   2. HTML 结构原样搬运（标签、层级、id 全部不变）
 *   3. JS 函数全部复用（来自 js/app/*.js 的全局函数）
 */
const PageToolbox = {
  template: `
          <div class="page-header">
            <h2>工具箱</h2>
            <p class="page-subtitle">MC 实用网站资源集合</p>
          </div>

          <div class="toolbox-section">
            <h3 class="toolbox-category">百科攻略</h3>
            <div class="toolbox-grid">
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://zh.minecraft.wiki')">
                <img src="/api/favicon?domain=zh.minecraft.wiki" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">Minecraft Wiki</span>
                  <span class="toolbox-desc">最权威的官方百科</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://www.mcmod.cn')">
                <img src="/api/favicon?domain=mcmod.cn" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">MC百科</span>
                  <span class="toolbox-desc">中文 Mod 百科数据库</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://www.digminecraft.com')">
                <img src="/api/favicon?domain=digminecraft.com" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">DigMinecraft</span>
                  <span class="toolbox-desc">全物品/方块 ID 查询</span>
                </div>
              </div>
            </div>
          </div>

          <div class="toolbox-section">
            <h3 class="toolbox-category">模组与整合包</h3>
            <div class="toolbox-grid">
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://www.curseforge.com/minecraft')">
                <img src="/api/favicon?domain=curseforge.com" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">CurseForge</span>
                  <span class="toolbox-desc">全球最大 Mod 整合包平台</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://modrinth.com')">
                <img src="/api/favicon?domain=modrinth.com" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">Modrinth</span>
                  <span class="toolbox-desc">新兴开源 Mod 平台</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://www.planetminecraft.com')">
                <img src="/api/favicon?domain=planetminecraft.com" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">Planet Minecraft</span>
                  <span class="toolbox-desc">全球最大 MC 社区</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://www.mcbbs.co/forum.php')">
                <img src="/api/favicon?domain=mcbbs.co" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">MCBBS</span>
                  <span class="toolbox-desc">国内最大 MC 中文论坛</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://mcpedl.com')">
                <img src="/api/favicon?domain=mcpedl.com" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">MCPEDL</span>
                  <span class="toolbox-desc">基岩版资源大全</span>
                </div>
              </div>
            </div>
          </div>

          <div class="toolbox-section">
            <h3 class="toolbox-category">玩家社区</h3>
            <div class="toolbox-grid">
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://www.minebbs.com')">
                <img src="/api/favicon?domain=minebbs.com" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">MineBBS</span>
                  <span class="toolbox-desc">国内 MC 中文论坛</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://klpbbs.com')">
                <img src="/api/favicon?domain=klpbbs.com" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">苦力怕论坛</span>
                  <span class="toolbox-desc">资源丰富的中文社区</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://search.bilibili.com/all?keyword=我的世界')">
                <img src="/api/favicon?domain=bilibili.com" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">Bilibili MC</span>
                  <span class="toolbox-desc">视频教程 / 实况 / 攻略</span>
                </div>
              </div>
            </div>
          </div>

          <div class="toolbox-section">
            <h3 class="toolbox-category">材质与光影</h3>
            <div class="toolbox-grid">
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://resourcepack.net')">
                <img src="/api/favicon?domain=resourcepack.net" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">ResourcePack</span>
                  <span class="toolbox-desc">海量材质包下载</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://shadersmods.com')">
                <img src="/api/favicon?domain=shadersmods.com" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">ShadersMods</span>
                  <span class="toolbox-desc">光影资源合集</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://vanillatweaks.net')">
                <img src="/api/favicon?domain=vanillatweaks.net" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">Vanilla Tweaks</span>
                  <span class="toolbox-desc">原版微调增强包</span>
                </div>
              </div>
            </div>
          </div>

          <div class="toolbox-section">
            <h3 class="toolbox-category">地图与建筑</h3>
            <div class="toolbox-grid">
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://www.plotz.co.uk')">
                <img src="/api/favicon?domain=plotz.co.uk" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">Plotz</span>
                  <span class="toolbox-desc">圆形/球形建造蓝图</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://www.blockpalettes.com')">
                <img src="/api/favicon?domain=blockpalettes.com" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">Block Palettes</span>
                  <span class="toolbox-desc">方块配色方案库</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://minecraftshapes.com')">
                <img src="/api/favicon?domain=minecraftshapes.com" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">MinecraftShapes</span>
                  <span class="toolbox-desc">几何形状建造指南</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://www.minecraftmaps.com')">
                <img src="/api/favicon?domain=minecraftmaps.com" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">Minecraft Maps</span>
                  <span class="toolbox-desc">冒险/解谜地图下载</span>
                </div>
              </div>
            </div>
          </div>

          <div class="toolbox-section">
            <h3 class="toolbox-category">在线工具</h3>
            <div class="toolbox-grid">
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://www.chunkbase.com')">
                <img src="/api/favicon?domain=chunkbase.com" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">Chunkbase</span>
                  <span class="toolbox-desc">种子地图 / 结构定位</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://mcstacker.net')">
                <img src="/api/favicon?domain=mcstacker.net" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">MCStacker</span>
                  <span class="toolbox-desc">命令在线生成器</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://minecraft.tools')">
                <img src="/api/favicon?domain=minecraft.tools" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">MC Tools</span>
                  <span class="toolbox-desc">合成/烟花/药水/旗帜</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://misode.github.io')">
                <img src="/api/favicon?domain=misode.github.io" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">Misode</span>
                  <span class="toolbox-desc">数据包 / 世界编辑器</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://mclo.gs')">
                <img src="/api/favicon?domain=mclo.gs" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">mclo.gs</span>
                  <span class="toolbox-desc">游戏日志分析工具</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://minecraft-heads.com')">
                <img src="/api/favicon?domain=minecraft-heads.com" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">Minecraft Heads</span>
                  <span class="toolbox-desc">头颅数据库/give指令</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://colorize.fun')">
                <img src="/api/favicon?domain=colorize.fun" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">Colorize FUN</span>
                  <span class="toolbox-desc">MC 彩色文本生成器</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://textcraft.net')">
                <img src="/api/favicon?domain=textcraft.net" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">Textcraft</span>
                  <span class="toolbox-desc">MC 风格 Logo 生成</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://www.craftmc.net')">
                <img src="/api/favicon?domain=craftmc.net" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">CraftMC Tools</span>
                  <span class="toolbox-desc">红石模拟/圆形生成</span>
                </div>
              </div>
            </div>
          </div>

          <div class="toolbox-section">
            <h3 class="toolbox-category">皮肤资源</h3>
            <div class="toolbox-grid">
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://namemc.com')">
                <img src="/api/favicon?domain=namemc.com" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">NameMC</span>
                  <span class="toolbox-desc">正版皮肤 / UUID 查询</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://littleskin.cn')">
                <img src="/api/favicon?domain=littleskin.cn" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">LittleSkin</span>
                  <span class="toolbox-desc">国内皮肤站</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://novaskin.me')">
                <img src="/api/favicon?domain=novaskin.me" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">Nova Skin</span>
                  <span class="toolbox-desc">3D 皮肤编辑器</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://www.minecraftskins.com')">
                <img src="/api/favicon?domain=minecraftskins.com" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">The Skindex</span>
                  <span class="toolbox-desc">百万皮肤分享社区</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://skinmc.net')">
                <img src="/api/favicon?domain=skinmc.net" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">SkinMC</span>
                  <span class="toolbox-desc">3D 皮肤查看器</span>
                </div>
              </div>
            </div>
          </div>

          <div class="toolbox-section">
            <h3 class="toolbox-category">服务器与插件</h3>
            <div class="toolbox-grid">
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://findmcserver.com')">
                <img src="/api/favicon?domain=findmcserver.com" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">FindMCServer</span>
                  <span class="toolbox-desc">Mojang 官方服务器列表</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://minecraftservers.org')">
                <img src="/api/favicon?domain=minecraftservers.org" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">MC Servers</span>
                  <span class="toolbox-desc">国际服务器列表</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://www.spigotmc.org')">
                <img src="/api/favicon?domain=spigotmc.org" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">SpigotMC</span>
                  <span class="toolbox-desc">服务器插件/Paper核心</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://www.mczfw.com')">
                <img src="/api/favicon?domain=mczfw.com" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">找服网</span>
                  <span class="toolbox-desc">国内服务器大全</span>
                </div>
              </div>
            </div>
          </div>

          <div class="toolbox-section">
            <h3 class="toolbox-category">资源导航</h3>
            <div class="toolbox-grid">
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://www.mcnav.net')">
                <img src="/api/favicon?domain=mcnav.net" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">MCNav</span>
                  <span class="toolbox-desc">MC 资源大全一站导航</span>
                </div>
              </div>
              <div class="toolbox-card" onclick="window.electronAPI.openExternal('https://www.minecraftxz.com')">
                <img src="/api/favicon?domain=minecraftxz.com" alt="" class="toolbox-icon" loading="lazy">
                <div class="toolbox-info">
                  <span class="toolbox-name">MinecraftXZ</span>
                  <span class="toolbox-desc">中文资源下载站</span>
                </div>
              </div>
            </div>
          </div>

          <div class="toolbox-section">
            <h3 class="toolbox-category">下载自定义文件</h3>
            <div class="toolbox-grid" style="grid-template-columns:1fr;">
              <div style="background:var(--glass-bg);border-radius:12px;padding:20px;border:1px solid var(--border-color);">
                <p class="hint" style="margin-bottom:16px;">使用启动器的高速多线程下载引擎下载任意文件。请注意，部分网站（例如百度网盘）可能会报错（403），无法正常下载。</p>
                <div class="form-group" style="margin-bottom:12px;">
                  <label style="font-weight:500;margin-bottom:6px;display:block;">下载地址</label>
                  <input type="text" id="custom-dl-url" class="text-input" style="width:100%;" placeholder="https://example.com/file.zip">
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                  <label style="font-weight:500;margin-bottom:6px;display:block;">保存到</label>
                  <div style="display:flex;gap:8px;align-items:center;">
                    <input type="text" id="custom-dl-path" class="text-input" style="flex:1;" placeholder="点击右侧按钮选择" readonly>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="browseCustomDlPath()">选择</button>
                  </div>
                </div>
                <div class="form-group" style="margin-bottom:16px;">
                  <label style="font-weight:500;margin-bottom:6px;display:block;">文件名</label>
                  <input type="text" id="custom-dl-filename" class="text-input" style="width:100%;" placeholder="留空则自动获取">
                </div>
                <div id="custom-dl-progress" style="display:none;margin-bottom:16px;">
                  <div class="progress-container">
                    <div class="progress-bar">
                      <div id="custom-dl-progress-fill" class="progress-fill" style="width:0%"></div>
                    </div>
                    <div id="custom-dl-progress-text" class="progress-text">0%</div>
                  </div>
                  <p id="custom-dl-status" class="hint" style="margin-top:8px;">准备下载...</p>
                </div>
                <div style="display:flex;gap:12px;">
                  <button type="button" class="btn btn-primary" id="custom-dl-start-btn" onclick="startCustomDownload()">开始下载</button>
                  <button type="button" class="btn btn-secondary" id="custom-dl-cancel-btn" style="display:none;" onclick="cancelCustomDownload()">取消下载</button>
                  <button type="button" class="btn btn-secondary" onclick="openCustomDlFolder()">打开文件夹</button>
                </div>
              </div>
            </div>
          </div>

  `
};

window.VersePC = window.VersePC || {};
window.VersePC.PageToolbox = PageToolbox;
