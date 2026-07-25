/* page-server-host.js - 开服页 Vue 组件（实验性，含内置控制台 / 模组端） */
const PageServerHost = {
  template: `
          <div class="page-header">
            <h2>开服 <span class="nav-btn-experimental-badge" style="position:static;display:inline-block;margin-left:8px;vertical-align:middle;opacity:1">实验</span></h2>
            <p class="page-subtitle">一键创建 / 启动本地 Minecraft 服务端 · 支持原版 / Forge / Fabric / NeoForge · 内置控制台</p>
          </div>

          <div class="settings-container" id="server-host-container" style="display:grid;gap:16px">
            <div class="card">
              <h3 style="margin-top:0">创建服务端</h3>
              <div class="form-group">
                <label class="filter-label">游戏版本</label>
                <select id="server-host-version" class="text-input" style="max-width:520px">
                  <option value="">加载中...</option>
                </select>
                <span class="form-hint" id="server-host-loader-hint">选择本地版本后将自动识别加载器类型。</span>
              </div>
              <div class="sh-form-grid">
                <div class="form-group" style="margin:0">
                  <label class="filter-label">服务器名称</label>
                  <input type="text" id="server-host-name" class="text-input" placeholder="MyServer" value="MyServer" />
                </div>
                <div class="form-group" style="margin:0">
                  <label class="filter-label">端口</label>
                  <input type="number" id="server-host-port" class="text-input" min="1" max="65535" value="25565" />
                </div>
                <div class="form-group" style="margin:0">
                  <label class="filter-label">最大内存 (MB)</label>
                  <input type="number" id="server-host-mem" class="text-input" min="512" max="32768" step="256" value="2048" />
                </div>
                <div class="form-group" style="margin:0;display:flex;flex-direction:column;justify-content:flex-end;gap:8px">
                  <label class="checkbox-label">
                    <input type="checkbox" id="server-host-online" checked />
                    <span>正版验证 (online-mode)</span>
                  </label>
                  <label class="checkbox-label">
                    <input type="checkbox" id="server-host-sync-mods" checked />
                    <span>一键同步客户端模组</span>
                  </label>
                </div>
              </div>
              <div class="sh-actions">
                <button class="btn btn-primary" id="server-host-create-btn" onclick="serverHostCreate()">创建并准备服务端</button>
                <button class="btn btn-ghost" onclick="serverHostRefreshVersions()">刷新版本</button>
                <button class="btn btn-ghost" onclick="serverHostOpenFolder()">打开目录</button>
              </div>
              <div class="sh-progress" id="server-host-progress" aria-hidden="true">
                <div class="sh-progress-bar" id="server-host-progress-bar"></div>
              </div>
              <div class="sh-progress-meta" id="server-host-progress-meta">
                <span id="server-host-progress-text"></span>
                <span id="server-host-progress-pct"></span>
              </div>
              <p class="form-hint" id="server-host-status" style="margin-top:8px">进入页面后会自动加载已安装版本。</p>
            </div>

            <div class="sh-main-grid" style="display:grid;grid-template-columns:minmax(220px,280px) 1fr;gap:16px">
              <div class="card" style="margin:0">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                  <h3 style="margin:0">我的服务器</h3>
                  <button class="btn btn-ghost btn-sm" onclick="serverHostRefreshList()">刷新</button>
                </div>
                <div id="server-host-list" style="display:flex;flex-direction:column;gap:8px;max-height:420px;overflow:auto"></div>
              </div>

              <div class="card" style="margin:0;display:flex;flex-direction:column;min-height:420px">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
                  <div>
                    <div style="font-weight:700;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                      <span id="server-host-active-title">未选择</span>
                      <span id="server-host-active-loader"></span>
                    </div>
                    <div class="form-hint" id="server-host-active-msg" style="margin:2px 0 0">选择服务器后可启动并查看控制台</div>
                  </div>
                  <div id="server-host-active-badge"></div>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
                  <button class="btn btn-primary btn-sm" id="server-host-start-btn" onclick="serverHostStart()">启动</button>
                  <button class="btn btn-ghost btn-sm" id="server-host-stop-btn" onclick="serverHostStop()" disabled>停止</button>
                  <button class="btn btn-ghost btn-sm" id="server-host-sync-btn" onclick="serverHostSyncMods()">同步模组</button>
                  <button class="btn btn-ghost btn-sm" onclick="serverHostClearConsole()">清屏</button>
                  <button class="btn btn-ghost btn-sm" onclick="serverHostDelete()" style="margin-left:auto;color:#ef4444">删除</button>
                </div>
                <div id="server-host-console" class="sh-console">
                  <div class="sh-console-line" style="opacity:.6">等待服务器输出…</div>
                </div>
                <div class="sh-cmd-row">
                  <input id="server-host-cmd" class="text-input"
                    placeholder="输入指令，例如 list / op Steve / stop  回车发送" autocomplete="off" />
                  <button class="btn btn-primary" onclick="serverHostSendCommand()">发送</button>
                </div>
                <p class="form-hint" style="margin:8px 0 0">提示：启动完成后会出现 “Done”。用 <code>stop</code> 安全关服。模组端会优先使用 run 脚本 / fabric-server-launch.jar。</p>
              </div>
            </div>

            <div class="card">
              <h3 style="margin-top:0">说明</h3>
              <ul class="form-hint" style="margin:0;padding-left:18px;line-height:1.75">
                <li><strong>原版</strong>：下载 server.jar → eula=true → java -jar --nogui</li>
                <li><strong>Forge / NeoForge</strong>：下载官方 installer，执行 <code>--installServer</code></li>
                <li><strong>Fabric</strong>：使用 fabric-installer 生成 fabric-server-launch.jar</li>
                <li><strong>一键同步模组</strong>：复制客户端 mods，并尽量跳过纯客户端模组（Sodium/Iris/ModMenu 等）</li>
                <li>数据目录：数据文件夹下的 <code>servers/&lt;id&gt;/</code></li>
              </ul>
            </div>
          </div>
  `,
  mounted() {
    if (typeof initServerHostPage === 'function') {
      initServerHostPage();
    }
  },
  beforeUnmount() {
    if (typeof _shDetach === 'function') {
      _shDetach();
    }
  }
};

window.VersePC = window.VersePC || {};
window.VersePC.PageServerHost = PageServerHost;
