<div align="center">
  <img src="img/icon.png" alt="VersePC Logo" width="120">
  <h1>VersePC</h1>
</div>
# VersePC - Minecraft Launcher

<p align="center">
  <b>现代化、跨平台的 Minecraft 启动器</b><br>
  简洁美观 · 功能丰富 · 性能卓越
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.1-blue" alt="Version">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platform">
  <img src="https://img.shields.io/badge/license-Source%20Visible-red" alt="License">
</p>

---

## 简介

**VersePC** 是一款基于 Electron 构建的现代化 Minecraft 启动器，致力于为玩家提供流畅、美观、功能完善的游戏启动体验。支持 Windows、macOS 和 Linux 三大平台，采用自定义协议架构，无需占用端口即可实现完整的本地服务功能。

## 功能特性

### 核心功能
- **多版本管理** - 支持官方版本、Forge、Fabric、OptiFine 等主流加载器的一键安装与切换
- **智能启动** - 自动检测 Java 环境，缺失时引导安装；自动选择最快的国内镜像源下载
- **账户系统** - 支持微软账户（Microsoft Account）和离线账户登录
- **自动更新** - 内置多源自动更新检测，支持 GitHub 和夸克网盘两种下载方式

### 模组与整合包
- **模组管理** - 浏览、安装、启用/禁用模组，支持 JAR 文件解析与依赖检测
- **整合包支持** - 一键导入 CurseForge、Modrinth 等平台整合包
- **版本隔离** - 每个游戏版本独立运行环境，避免冲突

### 高级特性
- **AI 助手** - 内置智能助手，提供游戏攻略、故障排查等帮助
- **插件系统** - 可扩展的插件架构，支持自定义功能扩展
- **主题切换** - 支持亮色/暗色主题，自适应系统设置
- **文件浏览器** - 内置文件管理器，方便管理游戏文件
- **代码编辑器** - 集成 Monaco Editor，支持配置文件编辑

### 性能优化
- **V8 代码缓存** - 首次启动后缓存编译结果，后续启动提速 40-60%
- **完整性自检** - 启动时检测源文件是否被篡改，保障运行安全
- **高效协议** - 使用自定义 `versepc://` 协议替代传统 HTTP 服务器，消除端口冲突

## 系统要求

| 平台 | 最低要求 | 推荐配置 |
|------|---------|---------|
| Windows | Windows 10 (x64) | Windows 11 |
| macOS | macOS 10.15 (Intel/Apple Silicon) | macOS 14+ |
| Linux | 64-bit 发行版 | Ubuntu 22.04+ / Arch |


## 技术架构

```
VersePC/
├── main.js              # Electron 主进程入口
├── server.js            # 业务逻辑与 API 路由
├── sse-server.js        # Server-Sent Events 服务
├── agent-engine.js      # AI 助手引擎
├── plugin-manager.js    # 插件管理系统
├── preload.cjs          # 安全预加载脚本
├── index.html           # 主界面 (SPA)
├── editor.html          # 代码编辑器
├── css/                 # 样式文件
├── js/                  # 前端脚本
├── img/                 # 图标与图片资源
└── plugins/             # 插件目录
```

## 更新日志

### v1.0.1 (2026-06-09)
- 新增多源自动更新检测，支持 GitHub 和夸克网盘两种下载方式
- 修复微软账户登录功能
- Java 下载速度优化，自动选择最快的国内镜像源
- 启动时自动检测 Java 环境，缺失时引导安装
- 离线账户名称输入优化

### v1.0.0 (2026-05-01)
- 初始版本发布
- 完整的 Minecraft 版本管理与启动功能
- 模组与整合包支持
- 多平台构建支持

## 开源协议

本项目为源码可见软件（Source Available），版权所有 © 2026 豆杰。保留所有权利。

源码公开供学习参考，但未经明确书面许可，禁止对本软件进行逆向工程、反编译、修改、分发或用于 AI 模型训练。

## 联系方式

- **GitHub**: [doujie081231/versePc](https://github.com/doujie081231/versePc)
- **问题反馈**: [议题](https://github.com/doujie081231/versePc/issues)

---

<p align="center">
  Made with ❤️ by 豆杰
</p>



