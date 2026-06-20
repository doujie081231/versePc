/**
 * VersePC - Minecraft Launcher
 * Copyright (c) 2026 豆杰. All Rights Reserved.
 *
 * AI TRAINING PROHIBITED: This code is protected by copyright law.
 * Unauthorized use for AI model training, machine learning datasets,
 * or any form of artificial intelligence training is strictly prohibited.
 *
 * This software is proprietary and confidential.
 * Any unauthorized reproduction or distribution is prohibited.
 */

/**
 * app.js - VersePC 前端主应用逻辑
 * ============================================================================
 * 所有渲染进程(前端)的UI交互逻辑，是用户界面的核心控制器。
 *
 * 核心功能：
 * 1. 版本管理 - 版本列表加载、渲染、筛选、选择
 * 2. 启动流程 - 启动按钮处理、启动模态框、进度轮询/SSE监听
 * 3. 模组管理 - 模组搜索、安装、详情、多选操作
 * 4. 系统设置 - Java路径/内存/窗口/语言/下载等设置
 * 5. 账户管理 - Microsoft/离线登录、皮肤显示
 * 6. Java管理 - Java运行时下载、切换、自动检测
 * 7. 整合包 - Modrinth/CurseForge整合包浏览和安装
 * 8. 地图/Saves - 存档和世界管理
 * 9. 资源下载 - 光影/材质/数据包等资源下载
 * 10. 界面框架 - Toast通知、Modal对话框、页面导航
 *
 * 架构说明：
 * - 单页面应用(SPA)架构，通过页面切换实现多视图
 * - 全局状态变量管理应用数据
 * - 通过 API 对象调用后端接口
 * - DOM缓存(domCache)优化频繁的DOM查询
 */

// ============================================================================
// 全局状态变量 - 应用数据状态中心
// ============================================================================
let currentVersionTab = 'release';
let allVersions = [];
let installedVersions = [];
let versionIconsTimestamp = Date.now();
let currentModTab = 'installed-mods';
let modSearchOffset = 0;
let modSearchTotal = 0;
let modSearchQuery = '';
let modSearchResults = [];
let _modDownloadVersionId = '';
let currentInstallSessionId = null;
let msAuthPollInterval = null;
let currentLoaderType = 'fabric';
let gameLogEventSource = null;
let currentModDetailId = null;
let currentModDetailSource = 'modrinth';
let previousPage = null;
let modDetailHistory = [];
let modDetailVersions = [];
let modDownloadPollTimers = [];
let _isRestoringModDetail = false;
let _favorites = [];
let _currentFavId = '';
let _favMultiSelectMode = false;
let _favSelectedItems = new Set();
let _favSearchQuery = '';
const dlManager = {
    tasks: new Map(),
    order: [],
    add(id, name, type, sessionId, iconUrl) {
        if (this.tasks.has(id)) return;
        this.tasks.set(id, { id, name, type, sessionId, iconUrl: iconUrl || '', progress: 0, status: 'downloading', message: '', files: [], stageHistory: [], expanded: false });
        this.order.push(id);
        this.updateFab();
        this.render();
    },
    remove(id) {
        this.tasks.delete(id);
        this.order = this.order.filter(i => i !== id);
        this.updateFab();
        this.render();
    },
    async cancel(id) {
        const task = this.tasks.get(id);
        if (!task || task.status !== 'downloading') return;
        task.status = 'cancelling';
        task.message = '正在取消...';
        this.updateDom(id);
        try {
            if (task.sessionId) {
                if (task.type === 'java') {
                    await API.cancelJavaDownload(task.sessionId);
                } else {
                    await fetch(`/api/install-cancel?sessionId=${encodeURIComponent(task.sessionId)}`, { method: 'POST' });
                }
            }
            task.status = 'failed';
            task.message = '已取消';
            task.progress = Math.min(task.progress, 100);
        } catch (e) {
            task.status = 'failed';
            task.message = '取消失败: ' + (e.message || e);
        }
        this.updateFab();
        this.updateDom(id);
    },
    update(id, data) {
        const task = this.tasks.get(id);
        if (!task) return;
        const targetProgress = Math.min(data.progress || 0, 100);
        let smoothProgress;
        if (data.status === 'completed' || data.status === 'failed') {
            smoothProgress = data.status === 'completed' ? 100 : Math.min(targetProgress, 100);
        } else if (task.type === 'modpack' && task._smoothProgress !== undefined) {
            const cur = task._smoothProgress || 0;
            if (targetProgress <= cur || targetProgress <= 0) {
                smoothProgress = targetProgress;
            } else {
                const smoothed = cur * 0.7 + targetProgress * 0.3;
                smoothProgress = Math.max(cur, Math.min(Math.round(smoothed), 100));
            }
        } else {
            smoothProgress = targetProgress;
        }
        Object.assign(task, data);
        task.progress = Math.min(task.progress || 0, 100);
        if (data.status === 'completed' || data.status === 'failed') {
            task.progress = data.status === 'completed' ? 100 : Math.min(task.progress, 100);
            task._smoothProgress = task.progress;
        } else if (task.type === 'modpack') {
            task.progress = smoothProgress;
            task._smoothProgress = smoothProgress;
        }
        const now = Date.now();
        const isTerminal = data.status === 'completed' || data.status === 'failed';
        const lastUpdate = task._lastDomUpdate || 0;
        if (!isTerminal && now - lastUpdate < 200) {
            return;
        }
        task._lastDomUpdate = now;
        this.updateFab();
        this.updateDom(id);
    },
    updateDom(id) {
        const taskEl = document.querySelector('.dl-task[data-task-id="' + id + '"]');
        if (!taskEl) return;
        const t = this.tasks.get(id);
        if (!t) return;
        const fill = taskEl.querySelector('.dl-task-progress-fill');
        const percent = taskEl.querySelector('.dl-task-percent');
        if (fill) {
            fill.style.width = t.progress + '%';
            fill.className = 'dl-task-progress-fill' + (t.status === 'completed' ? ' dl-task-progress-fill--completed' : (t.status === 'failed' || t.status === 'cancelling') ? ' dl-task-progress-fill--failed' : '');
        }
        if (percent) percent.textContent = Math.round(t.progress) + '%';
        const statusEl = taskEl.querySelector('.dl-task-status');
        if (statusEl) {
            statusEl.textContent = t.status === 'completed' ? (t.message || '下载完成') : t.status === 'failed' ? (t.message || '下载失败') : (t.message || '下载中...');
        }
        let detailEl = taskEl.querySelector('.dl-task-detail');
        const hasStageData = t.type === 'modpack' && t.stageHistory && t.stageHistory.length > 0;
        const hasFileData = t.files && t.files.length > 0;
        if (!detailEl && t.type !== 'mod' && (hasStageData || hasFileData)) {
            detailEl = document.createElement('div');
            detailEl.className = 'dl-task-detail';
            const headerEl = taskEl.querySelector('.dl-task-header');
            if (headerEl && headerEl.nextSibling) {
                taskEl.insertBefore(detailEl, headerEl.nextSibling);
            } else {
                taskEl.appendChild(detailEl);
            }
        }
        if (detailEl) {
            if (hasStageData) {
                var stageHash = '';
                for (var i = 0; i < t.stageHistory.length; i++) {
                    var s = t.stageHistory[i];
                    stageHash += s.stage + '_' + s.progress + '_' + s.message + ';';
                }
                if (stageHash !== t._lastStageHash) {
                    t._lastStageHash = stageHash;
                    detailEl.innerHTML = this.buildStageHistoryHtml(t.stageHistory);
                }
            } else if (hasFileData) {
                var hash = '';
                for (var i = 0; i < t.files.length; i++) {
                    var f = t.files[i];
                    hash += f.name + '_' + f.status + '_' + f.progress + ';';
                }
                if (hash !== t._lastFilesHash) {
                    t._lastFilesHash = hash;
                    detailEl.innerHTML = this.buildFilesHtml(t.files);
                }
            }
        }
        if (t.status !== 'downloading' && t.status !== 'cancelling') {
            if (!taskEl.querySelector('.dl-task-actions')) {
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'dl-task-actions';
                const btn = document.createElement('button');
                btn.className = 'btn btn-secondary btn-sm';
                btn.textContent = '移除';
                btn.addEventListener('click', () => dlManager.remove(id));
                actionsDiv.appendChild(btn);
                taskEl.appendChild(actionsDiv);
            }
        } else if (t.status === 'downloading' && !taskEl.querySelector('.dl-task-actions')) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'dl-task-actions';
            const btn = document.createElement('button');
            btn.className = 'btn btn-danger btn-sm';
            btn.textContent = '取消';
            btn.addEventListener('click', () => dlManager.cancel(id));
            actionsDiv.appendChild(btn);
            taskEl.appendChild(actionsDiv);
        }
    },
    buildFilesHtml(files) {
        return files.map(f => {
            const fProgress = f.progress || 0;
            const fFillClass = f.status === 'completed' ? 'dl-task-progress-fill--completed' : f.status === 'failed' ? 'dl-task-progress-fill--failed' : '';
            const sIcon = f.status === 'completed' ? '✓' : f.status === 'failed' ? '✗' : f.status === 'downloading' ? '↓' : '○';
            const sClass = 'dl-file-status--' + (f.status || 'pending');
            const progressBar = (f.status === 'downloading' || f.status === 'pending') ? '<div class="dl-file-progress-bar"><div class="dl-file-progress-fill ' + fFillClass + '" style="width:' + fProgress + '%"></div></div><span class="dl-file-percent">' + fProgress + '%</span>' : '';
            return '<div class="dl-file-item"><span class="dl-file-status ' + sClass + '">' + sIcon + '</span><span class="dl-file-name">' + escapeHtml(f.name || '') + '</span>' + (f.size ? '<span class="dl-file-size">' + f.size + '</span>' : '') + '</div>' + (progressBar ? '<div class="dl-file-progress">' + progressBar + '</div>' : '');
        }).join('');
    },
    buildStageHistoryHtml(stages) {
        // PCL-style stage list: shows each import stage with progress % and status icon
        return stages.map(s => {
            const progress = s.progress || 0;
            let statusIcon = '○';
            let statusClass = 'dl-stage-status--pending';
            let progressHtml = '';
            if (progress >= 100) {
                statusIcon = '✓';
                statusClass = 'dl-stage-status--completed';
            } else if (progress > 0) {
                statusIcon = '↓';
                statusClass = 'dl-stage-status--active';
                progressHtml = '<div class="dl-stage-progress-bar"><div class="dl-stage-progress-fill" style="width:' + Math.round(progress) + '%"></div></div><span class="dl-stage-percent">' + Math.round(progress) + '%</span>';
            }
            return '<div class="dl-stage-item"><span class="dl-stage-status ' + statusClass + '">' + statusIcon + '</span><span class="dl-stage-name">' + escapeHtml(s.message || s.stage || '') + '</span>' + (progressHtml ? '<div class="dl-stage-progress">' + progressHtml + '</div>' : '') + '</div>';
        }).join('');
    },
    toggleExpand(id) {
        const task = this.tasks.get(id);
        if (!task) return;
        task.expanded = !task.expanded;
        const taskEl = document.querySelector('.dl-task[data-task-id="' + id + '"]');
        if (taskEl) {
            if (task.expanded) {
                taskEl.classList.add('dl-task--expanded');
            } else {
                taskEl.classList.remove('dl-task--expanded');
            }
            let detailEl = taskEl.querySelector('.dl-task-detail');
            if (!detailEl) {
                detailEl = document.createElement('div');
                detailEl.className = 'dl-task-detail';
                const headerEl = taskEl.querySelector('.dl-task-header');
                if (headerEl && headerEl.nextSibling) {
                    taskEl.insertBefore(detailEl, headerEl.nextSibling);
                } else {
                    taskEl.appendChild(detailEl);
                }
            }
            if (task.type === 'modpack' && task.stageHistory && task.stageHistory.length > 0) {
                detailEl.innerHTML = this.buildStageHistoryHtml(task.stageHistory);
            } else if (task.files && task.files.length > 0) {
                detailEl.innerHTML = this.buildFilesHtml(task.files);
            } else if (task.expanded) {
                detailEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:4px 0;">' + (task.status === 'downloading' ? '等待进度数据...' : '暂无详细信息') + '</div>';
            }
        } else {
            this.render();
        }
    },
    updateFab() {
        const fab = document.getElementById('dl-fab');
        const badge = document.getElementById('dl-fab-badge');
        if (!fab) return;
        const active = [...this.tasks.values()].filter(t => t.status === 'downloading').length;
        const total = this.tasks.size;
        if (total === 0) {
            fab.style.display = 'none';
        } else {
            fab.style.display = 'flex';
            if (badge) {
                badge.style.display = active > 0 ? 'flex' : 'none';
                badge.textContent = active;
            }
        }
    },
    render() {
        const list = document.getElementById('download-queue-list');
        if (!list) return;
        if (this.order.length === 0) {
            list.innerHTML = '<p class="empty-text" id="dl-empty-hint">暂无下载任务</p>';
            return;
        }
        const svgIcons = {
            mod: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><path d="M20 16V7a2 2 0 00-2-2H6a2 2 0 00-2 2v9m16 0H4m16 0l1.28 2.55a1 1 0 01-.9 1.45H3.62a1 1 0 01-.9-1.45L4 16"/></svg>',
            modpack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>',
            version: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h.01M10 12h.01M14 12h4"/></svg>',
            java: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><path d="M17 8h1a4 4 0 110 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8zm0 0V6a2 2 0 012-2h2m4-2v2"/></svg>',
            other: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8m8 4H8m2-8H8"/></svg>'
        };
        list.innerHTML = this.order.map(id => {
            const t = this.tasks.get(id);
            if (!t) return '';
            const iconClass = 'dl-task-icon--' + (t.type || 'other');
            const iconHtml = t.iconUrl
                ? '<img src="' + t.iconUrl + '" alt="" class="dl-task-icon-img" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="dl-task-icon-fallback dl-task-icon-svg" style="display:none">' + (svgIcons[t.type] || svgIcons.other) + '</div>'
                : svgIcons[t.type] || svgIcons.other;
            const fillClass = t.status === 'completed' ? 'dl-task-progress-fill--completed' : t.status === 'failed' ? 'dl-task-progress-fill--failed' : '';
            const statusText = t.status === 'completed' ? (t.message || '下载完成') : t.status === 'failed' ? (t.message || '下载失败') : (t.message || '下载中...');
            const isExpandable = t.type !== 'mod';
            const expandedClass = t.expanded && isExpandable ? 'dl-task--expanded' : '';
            let detailHtml = '';
            if (isExpandable) {
                let innerDetail = '';
                if (t.type === 'modpack' && t.stageHistory && t.stageHistory.length > 0) {
                    innerDetail = this.buildStageHistoryHtml(t.stageHistory);
                } else if (t.files && t.files.length > 0) {
                    innerDetail = this.buildFilesHtml(t.files);
                }
                detailHtml = '<div class="dl-task-detail">' + innerDetail + '</div>';
            }
            let actionsHtml = '';
            if (t.status === 'completed' || t.status === 'failed') {
                actionsHtml = '<div class="dl-task-actions"><button class="btn btn-secondary btn-sm dl-task-remove-btn" data-task-id="' + escapeHtml(id) + '">移除</button></div>';
            } else if (t.status === 'downloading') {
                actionsHtml = '<div class="dl-task-actions"><button class="btn btn-danger btn-sm dl-task-cancel-btn" data-task-id="' + escapeHtml(id) + '">取消</button></div>';
            } else if (t.status === 'cancelling') {
                actionsHtml = '<div class="dl-task-actions"><button class="btn btn-secondary btn-sm" disabled>取消中...</button></div>';
            }
            const arrowHtml = isExpandable ? '<svg class="dl-task-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>' : '';
            const headerClass = isExpandable ? 'dl-task-header dl-task-toggle-btn' : 'dl-task-header';
            return '<div class="dl-task ' + expandedClass + '" data-task-id="' + escapeHtml(id) + '">' +
                '<div class="' + headerClass + '" data-task-id="' + escapeHtml(id) + '">' +
                '<div class="dl-task-icon ' + iconClass + '">' + iconHtml + '</div>' +
                '<div class="dl-task-info">' +
                '<div class="dl-task-name">' + escapeHtml(t.name) + '</div>' +
                '<div class="dl-task-status">' + escapeHtml(statusText) + '</div>' +
                '</div>' +
                '<div class="dl-task-progress">' +
                '<div class="dl-task-progress-bar"><div class="dl-task-progress-fill ' + fillClass + '" style="width:' + t.progress + '%"></div></div>' +
                '<span class="dl-task-percent">' + Math.round(t.progress) + '%</span>' +
                '</div>' +
                arrowHtml +
                '</div>' +
                detailHtml +
                actionsHtml +
                '</div>';
        }).join('');

        list.querySelectorAll('.dl-task-toggle-btn').forEach(el => {
            el.addEventListener('click', () => dlManager.toggleExpand(el.dataset.taskId));
        });
        list.querySelectorAll('.dl-task-remove-btn').forEach(el => {
            el.addEventListener('click', () => dlManager.remove(el.dataset.taskId));
        });
        list.querySelectorAll('.dl-task-cancel-btn').forEach(el => {
            el.addEventListener('click', () => dlManager.cancel(el.dataset.taskId));
        });
    }
};

function clearCompletedDownloads() {
    const toRemove = [...dlManager.tasks.entries()].filter(([_, t]) => t.status === 'completed' || t.status === 'failed').map(([id]) => id);
    toRemove.forEach(id => dlManager.remove(id));
}

let _customDlSessionId = null;
let _customDlPollTimer = null;
let _customDlSavePath = '';

async function browseCustomDlPath() {
    const result = await window.electronAPI.showOpenDialog({ properties: ['openDirectory'], title: '选择保存位置' });
    if (result && result.filePaths && result.filePaths.length > 0) {
        document.getElementById('custom-dl-path').value = result.filePaths[0];
        _customDlSavePath = result.filePaths[0];
    }
}

function openCustomDlFolder() {
    const p = _customDlSavePath || document.getElementById('custom-dl-path')?.value || '';
    if (p) {
        fetch('/api/open-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: 'custom', customPath: p }) });
    } else {
        showToast('请先选择保存位置', 'info');
    }
}

async function startCustomDownload() {
    const url = document.getElementById('custom-dl-url')?.value?.trim() || '';
    const savePath = document.getElementById('custom-dl-path')?.value?.trim() || '';
    const fileName = document.getElementById('custom-dl-filename')?.value?.trim() || '';

    if (!url) { showToast('请输入下载地址', 'error'); return; }
    if (!savePath) { showToast('请选择保存位置', 'error'); return; }

    try { new URL(url); } catch (e) { showToast('请输入有效的下载地址', 'error'); return; }

    document.getElementById('custom-dl-start-btn').style.display = 'none';
    document.getElementById('custom-dl-cancel-btn').style.display = '';
    document.getElementById('custom-dl-progress').style.display = '';
    document.getElementById('custom-dl-progress-fill').style.width = '0%';
    document.getElementById('custom-dl-progress-text').textContent = '0%';
    document.getElementById('custom-dl-status').textContent = '正在连接...';

    try {
        const res = await fetch('/api/download-custom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, savePath, fileName })
        });
        const result = await res.json();
        if (result.error) {
            showToast(result.error, 'error');
            resetCustomDlUI();
            return;
        }
        _customDlSessionId = result.sessionId;
        _customDlSavePath = savePath;
        pollCustomDlProgress();
    } catch (e) {
        showToast('下载请求失败: ' + e.message, 'error');
        resetCustomDlUI();
    }
}

function pollCustomDlProgress() {
    if (_customDlPollTimer) clearInterval(_customDlPollTimer);
    _customDlPollTimer = setInterval(async () => {
        if (!_customDlSessionId) { clearInterval(_customDlPollTimer); return; }
        try {
            const res = await fetch(`/api/download-custom/status?sessionId=${encodeURIComponent(_customDlSessionId)}`);
            const data = await res.json();
            if (data.status === 'not_found') { clearInterval(_customDlPollTimer); resetCustomDlUI(); return; }

            document.getElementById('custom-dl-progress-fill').style.width = data.progress + '%';
            document.getElementById('custom-dl-progress-text').textContent = data.progress + '%';
            document.getElementById('custom-dl-status').textContent = data.message || '';

            if (data.status === 'completed') {
                clearInterval(_customDlPollTimer);
                showToast('下载完成！', 'success');
                resetCustomDlUI();
            } else if (data.status === 'failed' || data.status === 'cancelled') {
                clearInterval(_customDlPollTimer);
                showToast(data.message || '下载失败', 'error');
                resetCustomDlUI();
            }
        } catch (e) {}
    }, 500);
}

async function cancelCustomDownload() {
    if (_customDlSessionId) {
        try {
            await fetch('/api/download-custom/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: _customDlSessionId })
            });
        } catch (e) {}
    }
    if (_customDlPollTimer) clearInterval(_customDlPollTimer);
    resetCustomDlUI();
}

function resetCustomDlUI() {
    _customDlSessionId = null;
    document.getElementById('custom-dl-start-btn').style.display = '';
    document.getElementById('custom-dl-cancel-btn').style.display = 'none';
}
let launchDepPollTimer = null;
let modMultiSelectMode = false;
let modSelectedIds = new Set();
let modSelectedVersions = new Map();

// ============================================================================
// 优化基础设施 - DOM缓存、防抖节流等
// ============================================================================

// DOM 缓存对象
const domCache = new Map();
function getDOMElement(id) {
    if (domCache.has(id)) {
        const el = domCache.get(id);
        if (el.isConnected) return el;
        domCache.delete(id);
    }
    const el = document.getElementById(id);
    if (el) domCache.set(id, el);
    return el;
}
function clearDOMCache() { domCache.clear(); }

// 缓存常用 DOM 元素（在 init 结束时调用）
const commonElements = {};
function cacheCommonElements() {
    const ids = [
        'mod-filter-version', 'mod-filter-loader', 'mod-filter-search',
        'msauth-status-text', 'acc-start-btn', 'launch-error-msg',
        'status-indicator', 'status-text', 'launch-btn',
        'mod-multiselect-toggle', 'mod-filter-sort', 'mod-list'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) commonElements[id] = el;
    });
}
// 刷新单个缓存元素
function refreshElementCache(id) {
    const el = document.getElementById(id);
    if (el) commonElements[id] = el;
    else delete commonElements[id];
}

// 防抖函数
function debounce(fn, delay = 300) {
    let timer = null;
    return function(...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            fn.apply(this, args);
            timer = null;
        }, delay);
    };
}

// 节流函数
function throttle(fn, limit = 100) {
    let inThrottle = false;
    return function(...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => { inThrottle = false; }, limit);
        }
    };
}

// 定时器管理
const managedTimers = { intervals: new Map(), timeouts: new Map() };
function setManagedInterval(fn, delay, key) {
    if (managedTimers.intervals.has(key)) clearInterval(managedTimers.intervals.get(key));
    const id = setInterval(fn, delay);
    managedTimers.intervals.set(key, id);
    return id;
}
function clearManagedInterval(key) {
    if (managedTimers.intervals.has(key)) {
        clearInterval(managedTimers.intervals.get(key));
        managedTimers.intervals.delete(key);
    }
}
function clearAllManagedIntervals() {
    managedTimers.intervals.forEach(id => clearInterval(id));
    managedTimers.intervals.clear();
}

// ─── 自定义下拉菜单组件 ──────────────────────────────────
class CustomSelect {
    constructor(wrapperId, options = {}) {
        this.wrapper = document.getElementById(wrapperId);
        if (!this.wrapper) return;

        this.trigger = this.wrapper.querySelector('.custom-select-trigger');
        this.valueEl = this.wrapper.querySelector('.custom-select-value');
        this.dropdown = this.wrapper.querySelector('.custom-select-dropdown');
        this.optionsContainer = this.wrapper.querySelector('.custom-select-options');
        this.searchInput = this.wrapper.querySelector('.custom-select-input');
        this.placeholder = this.wrapper.querySelector('.custom-select-value.placeholder');

        this.isOpen = false;
        this.selectedValue = '';
        this.selectedText = '';
        this.allOptions = [];
        this.filteredOptions = [];
        this.onChange = options.onChange || (() => {});
        this._originalParent = this.dropdown ? this.dropdown.parentNode : null;

        this.init();
    }

    init() {
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.filterOptions(e.target.value);
            });
            this.searchInput.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.wrapper.contains(e.target) && !this.dropdown.contains(e.target)) {
                this.close();
            }
        }, true);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        });

        window.addEventListener('scroll', () => {
            if (this.isOpen) this.updatePosition();
        }, true);

        window.addEventListener('resize', () => {
            if (this.isOpen) this.updatePosition();
        });
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    updatePosition() {
        if (!this.trigger || !this.dropdown) return;
        const rect = this.trigger.getBoundingClientRect();
        const vpH = window.innerHeight;
        const vpW = window.innerWidth;
        const ddH = this.dropdown.offsetHeight || 200;

        let top = rect.bottom + 6;
        let left = rect.left;

        if (top + ddH > vpH && rect.top > ddH) {
            top = rect.top - ddH - 6;
        }
        if (top < 4) top = 4;

        if (left + rect.width > vpW) {
            left = vpW - rect.width - 4;
        }
        if (left < 4) left = 4;

        this.dropdown.style.top = Math.round(top) + 'px';
        this.dropdown.style.left = Math.round(left) + 'px';
        this.dropdown.style.width = Math.round(rect.width) + 'px';
    }

    open() {
        this.isOpen = true;
        this.wrapper.classList.add('open');

        document.body.appendChild(this.dropdown);
        this.dropdown.classList.add('custom-select-dropdown-active');

        this.updatePosition();

        if (this.searchInput) {
            setTimeout(() => this.searchInput.focus(), 50);
        }
    }

    close() {
        this.isOpen = false;
        this.wrapper.classList.remove('open');
        this.dropdown.classList.remove('custom-select-dropdown-active');

        this.dropdown.style.top = '';
        this.dropdown.style.left = '';
        this.dropdown.style.width = '';

        if (this._originalParent && this.dropdown.parentNode !== this._originalParent) {
            this._originalParent.appendChild(this.dropdown);
        }

        if (this.searchInput) {
            this.searchInput.value = '';
            this.filterOptions('');
        }
    }

    setOptions(options) {
        this.allOptions = options;
        this.filteredOptions = [...options];
        this.renderOptions();
    }

    filterOptions(query) {
        const q = query.toLowerCase().trim();
        if (!q) {
            this.filteredOptions = [...this.allOptions];
        } else {
            this.filteredOptions = this.allOptions.filter(opt =>
                opt.text.toLowerCase().includes(q) ||
                opt.value.toLowerCase().includes(q)
            );
        }
        this.renderOptions();
    }

    renderOptions() {
        if (!this.optionsContainer) return;

        if (this.filteredOptions.length === 0) {
            this.optionsContainer.innerHTML = '<div class="custom-select-no-results">未找到匹配的版本</div>';
            return;
        }

        const html = this.filteredOptions.map(opt => `
            <div class="custom-select-option ${opt.value === this.selectedValue ? 'selected' : ''}"
                 data-value="${opt.value}">
                ${opt.icon ? `<div class="custom-select-option-icon">${opt.icon}</div>` : ''}
                <div class="custom-select-option-text">
                    <div class="custom-select-option-name">${opt.text}</div>
                    ${opt.subtext ? `<div class="custom-select-option-type">${opt.subtext}</div>` : ''}
                </div>
                <div class="custom-select-option-check">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
            </div>
        `).join('');

        this.optionsContainer.innerHTML = html;

        this.optionsContainer.querySelectorAll('.custom-select-option').forEach(el => {
            el.addEventListener('click', () => {
                const value = el.dataset.value;
                const opt = this.allOptions.find(o => o.value === value);
                if (opt) {
                    this.select(value, opt.text);
                    this.onChange(value, opt);
                }
            });
        });
    }

    select(value, text) {
        this.selectedValue = value;
        this.selectedText = text;
        this.valueEl.textContent = text || '选择版本...';
        if (this.valueEl) {
            this.valueEl.classList.toggle('placeholder', !text);
        }

        this.optionsContainer.querySelectorAll('.custom-select-option').forEach(el => {
            el.classList.toggle('selected', el.dataset.value === value);
        });

        this.close();
    }

    getValue() {
        return this.selectedValue;
    }

    setValue(value) {
        const opt = this.allOptions.find(o => o.value === value);
        if (opt) {
            this.selectedValue = value;
            this.selectedText = opt.text;
            this.valueEl.textContent = opt.text;
            if (this.valueEl) {
                this.valueEl.classList.toggle('placeholder', !opt.text);
            }
        }
    }
}

let homeVersionCustomSelect = null;
let launchVersionCustomSelect = null;
let modloaderGameVersionCustomSelect = null;
let modloaderVersionCustomSelect = null;

const customSelectInstances = {};

function initAllCustomSelects() {
    if (!customSelectInstances['vset-isolation']) {
        customSelectInstances['vset-isolation'] = new CustomSelect('vset-isolation-wrapper');
        customSelectInstances['vset-isolation'].setOptions([
            { value: 'global', text: '跟随全局设置' },
            { value: 'on', text: '开启' },
            { value: 'off', text: '关闭' }
        ]);
    }

    if (!customSelectInstances['vset-mem-optimize']) {
        customSelectInstances['vset-mem-optimize'] = new CustomSelect('vset-mem-optimize-wrapper');
        customSelectInstances['vset-mem-optimize'].setOptions([
            { value: 'global', text: '跟随全局设置' },
            { value: 'on', text: '开启' },
            { value: 'off', text: '关闭' }
        ]);
    }

    if (!customSelectInstances['mod-filter-loader']) {
        customSelectInstances['mod-filter-loader'] = new CustomSelect('mod-filter-loader-wrapper', {
            onChange: () => loadMods()
        });
        customSelectInstances['mod-filter-loader'].setOptions([
            { value: '', text: '全部' },
            { value: 'fabric', text: 'Fabric' },
            { value: 'forge', text: 'Forge' },
            { value: 'neoforge', text: 'NeoForge' }
        ]);
    }

    if (!customSelectInstances['mod-filter-sort']) {
        customSelectInstances['mod-filter-sort'] = new CustomSelect('mod-filter-sort-wrapper', {
            onChange: () => loadMods()
        });
        customSelectInstances['mod-filter-sort'].setOptions([
            { value: 'relevance', text: '相关度' },
            { value: 'downloads', text: '下载量' },
            { value: 'newest', text: '最新' },
            { value: 'updated', text: '最近更新' }
        ]);
    }

    if (!customSelectInstances['mod-filter-source']) {
        customSelectInstances['mod-filter-source'] = new CustomSelect('mod-filter-source-wrapper', {
            onChange: () => loadMods()
        });
        customSelectInstances['mod-filter-source'].setOptions([
            { value: 'any', text: '全部' },
            { value: 'modrinth', text: 'Modrinth' },
            { value: 'curseforge', text: 'CurseForge' }
        ]);
    }

    if (!customSelectInstances['mod-filter-category']) {
        customSelectInstances['mod-filter-category'] = new CustomSelect('mod-filter-category-wrapper', {
            onChange: () => loadMods()
        });
        customSelectInstances['mod-filter-category'].setOptions([
            { value: '', text: '全部' }
        ]);
    }

    if (!customSelectInstances['mod-filter-version']) {
        customSelectInstances['mod-filter-version'] = new CustomSelect('mod-filter-version-wrapper', {
            onChange: () => loadMods()
        });
        customSelectInstances['mod-filter-version'].setOptions([
            { value: '', text: '全部' }
        ]);
    }

    if (!customSelectInstances['modpack-filter-loader']) {
        customSelectInstances['modpack-filter-loader'] = new CustomSelect('modpack-filter-loader-wrapper', {
            onChange: () => {}
        });
        customSelectInstances['modpack-filter-loader'].setOptions([
            { value: '', text: '全部' },
            { value: 'fabric', text: 'Fabric' },
            { value: 'forge', text: 'Forge' },
            { value: 'neoforge', text: 'NeoForge' },
            { value: 'quilt', text: 'Quilt' }
        ]);
    }

    if (!customSelectInstances['modpack-filter-version']) {
        customSelectInstances['modpack-filter-version'] = new CustomSelect('modpack-filter-version-wrapper');
        customSelectInstances['modpack-filter-version'].setOptions([{ value: '', text: '全部' }]);
    }

    if (!customSelectInstances['datapack-filter-version']) {
        customSelectInstances['datapack-filter-version'] = new CustomSelect('datapack-filter-version-wrapper');
        customSelectInstances['datapack-filter-version'].setOptions([{ value: '', text: '全部' }]);
    }

    if (!customSelectInstances['resourcepack-filter-version']) {
        customSelectInstances['resourcepack-filter-version'] = new CustomSelect('resourcepack-filter-version-wrapper');
        customSelectInstances['resourcepack-filter-version'].setOptions([{ value: '', text: '全部' }]);
    }

    if (!customSelectInstances['resourcepack-filter-resolution']) {
        customSelectInstances['resourcepack-filter-resolution'] = new CustomSelect('resourcepack-filter-resolution-wrapper');
        customSelectInstances['resourcepack-filter-resolution'].setOptions([
            { value: '', text: '全部' },
            { value: '16x', text: '16x' },
            { value: '32x', text: '32x' },
            { value: '64x', text: '64x' },
            { value: '128x', text: '128x' },
            { value: '256x', text: '256x' },
            { value: '512x', text: '512x' }
        ]);
    }
}

function getCustomSelectValue(id) {
    const instance = customSelectInstances[id];
    return instance ? instance.getValue() : '';
}

function setCustomSelectValue(id, value) {
    const instance = customSelectInstances[id];
    if (instance) instance.setValue(value);
}

function updateCustomSelectOptions(id, options) {
    const instance = customSelectInstances[id];
    if (instance) instance.setOptions(options);
}

// ─── 原有函数 ──────────────────────────────────────────────


function showToast(message, type = 'info') {
    const container = getDOMElement('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-100%) scale(0.9)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            toast.remove();
            if (container.children.length === 0) domCache.delete('toast-container');
        }, 300);
    }, 3000);
}

function showModal(id) {
    var modal = getDOMElement(id);
    if (!modal) {
        console.error('Modal not found:', id);
        return;
    }

    if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }

    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('data-state', 'open');

    modal.dataset.previouslyFocused = document.activeElement ? (document.activeElement.id || '') : '';

    modal.style.display = 'flex';
    requestAnimationFrame(function () {
        modal.classList.add('modal-visible');
        modal.classList.remove('modal-exiting');
    });

    requestAnimationFrame(function () {
        var closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.focus();
        }
    });

    var onKeyDown = function (e) {
        if (e.key === 'Escape') {
            hideModal(id);
        }
    };
    modal.addEventListener('keydown', onKeyDown);
    modal._escCleanup = function () { modal.removeEventListener('keydown', onKeyDown); };

    if (!modal.dataset.noCloseOnBackdrop) {
        var onBackdrop = function (e) {
            if (e.target === modal) {
                hideModal(id);
            }
        };
        modal.addEventListener('click', onBackdrop);
        modal._backdropCleanup = function () { modal.removeEventListener('click', onBackdrop); };
    }
}

function hideModal(id) {
    var modal = getDOMElement(id);
    if (!modal) return;

    modal.setAttribute('data-state', 'closed');
    modal.classList.add('modal-exiting');
    modal.classList.remove('modal-visible');

    if (typeof modal._escCleanup === 'function') {
        modal._escCleanup();
        modal._escCleanup = null;
    }
    if (typeof modal._backdropCleanup === 'function') {
        modal._backdropCleanup();
        modal._backdropCleanup = null;
    }

    setTimeout(function () {
        var prevId = modal.dataset.previouslyFocused;
        if (prevId) {
            var prevEl = document.getElementById(prevId);
            if (prevEl) {
                try { prevEl.focus(); } catch (e) {}
            }
        }
        modal.classList.remove('modal-exiting');
        modal.style.display = 'none';
    }, 200);
}

function showConfirmDialog(title, message, confirmText, cancelText) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'confirm-dialog-title');

        overlay.innerHTML = `
            <div class="modal-content" style="width:440px;min-height:auto;">
                <div class="modal-header">
                    <h3 id="confirm-dialog-title">${escapeHtml(title || '确认')}</h3>
                    <button class="modal-close confirm-cancel" aria-label="关闭对话框">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="margin:0;color:var(--text-secondary);font-size:14px;line-height:1.6;">${message || ''}</p>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn modal-btn--secondary confirm-cancel">${cancelText || '取消'}</button>
                    <button class="modal-btn modal-btn--danger confirm-ok">${confirmText || '确定'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        
        // Show modal with animation
        requestAnimationFrame(() => overlay.classList.add('modal-visible'));

        var close = function (result) {
            overlay.setAttribute('data-state', 'closed');
            overlay.classList.add('modal-exiting');
            overlay.classList.remove('modal-visible');

            setTimeout(function () {
                if (overlay.parentElement) {
                    overlay.parentElement.removeChild(overlay);
                }
                resolve(result);
            }, 200);
        };

        // Close on cancel buttons
        overlay.querySelectorAll('.confirm-cancel').forEach(btn => {
            btn.addEventListener('click', () => close(false));
        });
        
        // Confirm action
        overlay.querySelector('.confirm-ok').addEventListener('click', () => close(true));
        
        // Close on backdrop click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close(false);
        });
        
        // Close on ESC key
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close(false);
        });
    });
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return String(num);
}




function escapeOnclick(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
}

const SUPPORT_MILESTONES = [1, 3, 5, 10, 20, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1500, 2000, 3000, 5000, 10000];

function getLaunchCount() {
    try { return parseInt(localStorage.getItem('verse_launchCount') || '0', 10); }
    catch (e) { return 0; }
}

var _launchCounted = false;

function incrementLaunchCount() {
    if (_launchCounted) return getLaunchCount();
    _launchCounted = true;
    var c = getLaunchCount() + 1;
    try { localStorage.setItem('verse_launchCount', String(c)); } catch (e) {}
    return c;
}

function isSupportMilestone(c) { return SUPPORT_MILESTONES.indexOf(c) !== -1; }

function checkSupportMilestone() {
    var c = getLaunchCount();
    showSupportModal(c);
}

function showSupportModal(count) {
    count = count || getLaunchCount();
    setTimeout(function() {
        var countEl = document.getElementById('support-modal-count');
        var modalEl = document.getElementById('support-modal');
        if (countEl) countEl.textContent = count;
        if (modalEl) {
            modalEl.style.display = '';
            modalEl.classList.add('modal-visible');
        }
    }, 800);
}

function openSupportPage() {
    window.open('https://ifdian.net/a/versejava?tab=home', '_blank');
    dismissSupportModal();
}

function dismissSupportModal() {
    const modal = document.getElementById('support-modal');
    if (modal) {
        modal.classList.remove('modal-visible');
        modal.style.display = 'none';
    }
}

var ANNOUNCEMENT_CONTENT = {
    version: '1.3.2',
    title: 'VersePC v1.3.2 测试版公告',
    body: `
        <div class="announcement-section">
            <p>各位小伙伴们，这次更新修复了 NeoForge 安装流程和外部版本启动的问题，请更新测试！</p>
        </div>

        <div class="announcement-section">
            <p style="color:#e74c3c;font-weight:bold;font-size:15px;">⚠️ 导入整合包功能暂时无法使用，请谅解！</p>
        </div>

        <div class="announcement-section">
            <h4>更新内容</h4>

            <h5>Bug 修复</h5>
            <ul>
                <li>修复皮肤查看器一直显示"加载中"无法显示 3D 模型</li>
                <li>修复 NeoForge 版本被误判为缺少 Forge 文件</li>
                <li>修复 NeoForge 核心 JAR 文件名检测错误（缺少 -universal 后缀）</li>
                <li>修复 Forge 26.x 启动时 SRG/extra 文件版本不匹配误报</li>
                <li>修复 NeoForge 安装时核心 jar 和 patched jar 缺失未自动补全</li>
                <li>修复外部版本（如 HMCL）首次启动后被误判为"错误版本"</li>
                <li>NeoForge 核心库缺失时启动自动补下载</li>
                <li>NeoForge 安装完成后自动校验核心 jar 和 patched jar，缺失则补下载</li>
            </ul>
        </div>

        <div class="announcement-footer">
            <p style="text-align:right;margin-top:20px;font-weight:bold;">豆杰<br>2026 年 6 月</p>
        </div>
    `
};

async function showAnnouncementModal(forceShow) {
    try {
        var versionResult = await window.electronAPI.updater.getVersion();
        var currentVersion = versionResult ? versionResult.version : '1.0.0';
    } catch (e) {
        var currentVersion = '1.0.0';
    }

    if (!forceShow) {
        try {
            var dismissedVersion = localStorage.getItem('versepc_announcement_dismissed_version');
            if (dismissedVersion === currentVersion) return;
        } catch (e) {}
    }

    var noticeMode = 'show-all';
    try {
        var saved = await window.electronAPI.store.get('versepc_other_settings');
        if (saved) {
            var settings = JSON.parse(saved);
            if (settings.launcherNoticeMode) noticeMode = settings.launcherNoticeMode;
        }
    } catch (e) {}

    if (!forceShow && noticeMode === 'hide') return;

    var versionBadge = document.getElementById('announcement-version-badge');
    var contentEl = document.getElementById('announcement-content');
    var checkEl = document.getElementById('announcement-dismiss-check');

    if (versionBadge) versionBadge.textContent = 'v' + currentVersion;
    if (contentEl) contentEl.innerHTML = ANNOUNCEMENT_CONTENT.body;
    if (checkEl) checkEl.checked = false;

    var modal = document.getElementById('announcement-modal');
    if (!modal) return;

    if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }

    modal.style.display = 'flex';
    requestAnimationFrame(function () {
        modal.classList.add('modal-visible');
        modal.classList.remove('modal-exiting');
    });

    requestAnimationFrame(function () {
        var closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) closeBtn.focus();
    });

    var onKeyDown = function (e) {
        if (e.key === 'Escape') {
            dismissAnnouncementModal();
        }
    };
    modal.addEventListener('keydown', onKeyDown);
    modal._escCleanup = function () { modal.removeEventListener('keydown', onKeyDown); };
}

function dismissAnnouncementModal() {
    var modal = document.getElementById('announcement-modal');
    if (!modal) return;

    var checkEl = document.getElementById('announcement-dismiss-check');
    if (checkEl && checkEl.checked) {
        try {
            var versionBadge = document.getElementById('announcement-version-badge');
            var version = versionBadge ? versionBadge.textContent : '';
            if (version) localStorage.setItem('versepc_announcement_dismissed_version', version.replace(/^v/, ''));
        } catch (e) {}
    }

    if (typeof modal._escCleanup === 'function') {
        modal._escCleanup();
        modal._escCleanup = null;
    }

    modal.setAttribute('data-state', 'closed');
    modal.classList.add('modal-exiting');
    modal.classList.remove('modal-visible');

    setTimeout(function () {
        modal.classList.remove('modal-exiting');
        modal.style.display = 'none';
    }, 200);
}

async function checkAnnouncementPopup() {
    await showAnnouncementModal(false);
}

async function showUpdateAnnouncement() {
    await showAnnouncementModal(true);
}

function generateColorAvatar(username, size) {
    size = size || 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    ctx.fillStyle = 'hsl(' + hue + ', 55%, 50%)';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold ' + Math.floor(size * 0.45) + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(username.charAt(0).toUpperCase(), size / 2, size / 2);
    return canvas.toDataURL('image/png');
}

const VERSION_TYPE_LABELS = { release: '正式版', snapshot: '快照版', special: '愚人节版', old_beta: '旧测试版', old_alpha: '旧内测版', '(old)': '旧版' };
function getVersionTypeLabel(v) {
    const type = v.type || 'release';
    let label = VERSION_TYPE_LABELS[type] || type;
    if (v.complianceLevel === 0) label = '未混淆';
    return label;
}

const DL_FOLDER_KEY = 'versepc_dl_folders';
function getRememberedFolder(key) {
    try { const d = JSON.parse(localStorage.getItem(DL_FOLDER_KEY) || '{}'); return d[key] || ''; } catch (e) { return ''; }
}
function saveRememberedFolder(key, folderPath) {
    try { const d = JSON.parse(localStorage.getItem(DL_FOLDER_KEY) || '{}'); d[key] = folderPath; localStorage.setItem(DL_FOLDER_KEY, JSON.stringify(d)); } catch (e) {}
}

// ============================================================================
// 应用初始化 - 页面加载完成后的启动流程
// ============================================================================
async function init() {
    const splashProgress = document.getElementById('splash-progress');
    const splashOverlay = document.getElementById('splash-overlay');
    const startTime = Date.now();
    const MIN_SPLASH_DURATION = 800;
    const _perfInit = (label) => console.log(`[PERF-INIT] ${label} ${(performance.now()-_perfT).toFixed(1)}ms`);
    let _perfT = performance.now();

    try {
        const earlyTheme = await window.electronAPI.store.get('versepc_theme');
        if (earlyTheme) {
            const legacyThemes = ['blue', 'purple', 'green', 'orange', 'red', 'pink', 'teal', 'cyan', 'amber'];
            const themeName = legacyThemes.includes(earlyTheme) ? 'light' : earlyTheme;
            document.documentElement.setAttribute('data-theme', themeName);
            document.documentElement.classList.toggle('dark-theme', themeName === 'dark');
            document.documentElement.classList.toggle('light-theme', themeName === 'light');
            document.querySelectorAll('.theme-option').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-theme') === themeName);
            });
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            document.documentElement.classList.add('light-theme');
        }
    } catch (e) {}

    function setProgress(val, statusText) {
        if (!splashProgress) return;
        splashProgress.style.width = Math.min(val, 100) + '%';

        const splashStatus = document.getElementById('splash-status');
        if (splashStatus && statusText) {
            splashStatus.textContent = statusText;
        }
    }

    function safeSetup(name, fn) {
        try { fn(); } catch (e) {
            console.error('Setup failed:', name, e);
        }
    }

    try {
        setProgress(5, '正在初始化界面...');
        safeSetup('navigation', setupNavigation);
        safeSetup('launchBar', setupLaunchBar);
        safeSetup('windowControls', setupWindowControls);
        initAllCustomSelects();
        setProgress(15, '正在构建界面...');
        _perfInit('setup UI');

        try {
            const cachedName = localStorage.getItem('cachedPlayerName');
            if (cachedName) {
                const homeName = document.getElementById('home-player-name');
                const launchName = document.getElementById('launch-player-name');
                if (homeName) homeName.textContent = cachedName;
                if (launchName) launchName.textContent = cachedName;
            }
            const cachedAvatarData = localStorage.getItem('cachedAvatarData');
            if (cachedAvatarData) {
                const homeAvatar = document.getElementById('home-avatar');
                const launchAvatar = document.getElementById('launch-avatar');
                if (homeAvatar) {
                    homeAvatar.innerHTML = '<img src="' + cachedAvatarData + '" class="account-avatar-img" width="64" height="64">';
                }
                if (launchAvatar) {
                    launchAvatar.innerHTML = '<img src="' + cachedAvatarData + '" class="account-avatar-img">';
                }
            }
            const cachedAccountType = localStorage.getItem('cachedAccountType');
            if (cachedAccountType) {
                const homeType = document.getElementById('home-account-type');
                if (homeType) homeType.textContent = cachedAccountType;
            }
        } catch(e) {}

        safeSetup('tabs', setupTabs);
        safeSetup('modBrowse', setupModBrowse);
        safeSetup('accountButtons', setupAccountButtons);
        safeSetup('versionListClicks', setupVersionListClicks);
        safeSetup('favSearch', setupFavSearchListeners);
        setProgress(25, '正在加载数据...');
        _perfT = performance.now();

        // 并行加载核心数据，避免串行等待
        const [settingsResult, versionsResult, accountsResult] = await Promise.allSettled([
            loadSettings(),
            loadVersions(),
            loadAccounts(),
            loadFavoritesData()
        ]);
        _perfInit('load data (parallel)');
        setProgress(70, '正在初始化功能...');

        // 设置页面初始化（轻量，不涉及网络请求）
        safeSetup('settingsPage', setupSettingsPage);
        safeSetup('javaPage', setupJavaPage);
        safeSetup('console', setupConsole);
        _perfInit('setup pages');

        setProgress(90, '正在完成...');

        setProgress(100, '准备就绪!');

        updateGameStatus();
        setManagedInterval(updateGameStatus, 3000, 'updateGameStatus');
        checkJavaOnStartup();

        setTimeout(() => {
            triggerJvmPreheat();
        }, 10000);

        cacheCommonElements();

        if (typeof initWallpaper === 'function') {
            _lazyLoadScript('js/three.bundle.js').then(() => {
                try { initWallpaper(); } catch (e) { console.error('[Wallpaper] init error:', e); }
                loadWallpaperSettings();
            }).catch(() => console.warn('[Wallpaper] THREE.js load failed'));
        }

        initWallpaperDropZone();
        initWallpaperAutoAdapt();
        _perfInit('wallpaper');

        if (typeof AIChat !== 'undefined') {
            AIChat.init();
        }
        _perfInit('AIChat.init');

    } catch (e) {
        console.error('Init critical error:', e);
        setProgress(100, '初始化完成');
    }

    const elapsed = Date.now() - startTime;
    const remainingMinTime = Math.max(MIN_SPLASH_DURATION - elapsed, 0);
    await new Promise(r => setTimeout(r, remainingMinTime));

    await new Promise(r => setTimeout(r, 200));

    if (splashOverlay) {
        splashOverlay.style.transition = 'opacity 0.4s cubic-bezier(0.4,0,0.2,1)';
        splashOverlay.style.opacity = '0';
        splashOverlay.style.pointerEvents = 'none';
        await new Promise(r => setTimeout(r, 400));
        try { splashOverlay.remove(); } catch (err) {}
    }

    // 首屏显示后，延迟加载非关键数据
    setTimeout(() => {
        Promise.allSettled([
            loadModFilterOptions(),
            loadInstalledMods(),
            loadFeaturedMods()
        ]).catch(e => console.error('延迟加载失败:', e));
    }, 100);
}

function loadWallpaperSettings() {
    Promise.all([
        window.electronAPI.store.get('versepc_custom_image'),
        window.electronAPI.store.get('versepc_custom_video'),
        window.electronAPI.store.get('versepc_wallpaper'),
        window.electronAPI.store.get('versepc_wallpaper_opacity'),
        window.electronAPI.store.get('versepc_wallpaper_blur'),
        window.electronAPI.store.get('versepc_wallpaper_fit'),
        window.electronAPI.store.get('versepc_panorama_theme'),
        window.electronAPI?.store?.get('versepc_panorama_speed'),
        window.electronAPI?.store?.get('versepc_panorama_mouse_follow'),
    ]).then(([
        savedCustomImage,
        savedCustomVideo,
        savedWallpaper,
        savedOpacity,
        savedBlur,
        savedFit,
        savedPanoramaTheme,
        savedPanoramaSpeed,
        savedMouseFollow,
    ]) => {
        if (savedCustomImage && typeof setCustomWallpaperImage === 'function') {
            setCustomWallpaperImage(savedCustomImage);
        }
        if (savedCustomVideo && typeof setCustomWallpaperVideo === 'function') {
            setCustomWallpaperVideo(savedCustomVideo);
        }
        if (savedWallpaper) {
            let wpName = savedWallpaper;
            if (wpName === 'starry') wpName = 'panorama';
            const wpEl = document.querySelector(`.wallpaper-option[data-wallpaper="${wpName}"]`);
            if (wpEl) selectWallpaper(wpEl);
        }
        if (savedOpacity != null) {
            const slider = document.getElementById('wallpaper-opacity-slider');
            if (slider) { slider.value = savedOpacity; onWallpaperOpacityChange(savedOpacity); }
        }
        if (savedBlur != null) {
            const slider = document.getElementById('wallpaper-blur-slider');
            if (slider) { slider.value = savedBlur; onWallpaperBlurChange(savedBlur); }
        }
        if (savedFit) {
            const select = document.getElementById('wallpaper-fit-select');
            if (select) { select.value = savedFit; onWallpaperFitChange(savedFit); }
        }
        if (savedPanoramaTheme) {
            const themeEl = document.querySelector(`.panorama-theme-option[data-theme="${savedPanoramaTheme}"]`);
            if (themeEl) selectPanoramaTheme(themeEl);
        }
        if (savedPanoramaSpeed) {
            const slider = document.getElementById('panoramaSpeedSlider');
            if (slider) slider.value = savedPanoramaSpeed;
            const label = document.getElementById('panoramaSpeedLabel');
            if (label) label.textContent = savedPanoramaSpeed;
            if (typeof setPanoramaRotationSpeed === 'function') setPanoramaRotationSpeed(savedPanoramaSpeed * 0.001);
        }
        if (savedMouseFollow === true) {
            const toggle = document.getElementById('panoramaMouseFollowToggle');
            if (toggle) toggle.checked = true;
            if (typeof setPanoramaMouseFollow === 'function') setPanoramaMouseFollow(true);
        }
        if (savedCustomImage) {
            const nameEl = document.getElementById('custom-wallpaper-file-name');
            if (nameEl) nameEl.textContent = savedCustomImage.split(/[\\/]/).pop();
            _updateCustomImagePreview(savedCustomImage);
        }
        if (savedCustomVideo) {
            const nameEl = document.getElementById('custom-wallpaper-file-name');
            if (nameEl) nameEl.textContent = savedCustomVideo.split(/[\\/]/).pop();
        }
    }).catch(e => console.error('[Init] Load wallpaper settings error:', e));
}

function setupNavigation() {
    document.querySelectorAll('.nav-btn:not(.nav-submenu-toggle)').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            if (!page) return;

            if (page === 'versions') {
                loadVersions(true);
            }

            navigateToPage(page);
        });
    });

    document.querySelectorAll('.nav-submenu-group').forEach(group => {
        const toggle = group.querySelector('.nav-submenu-toggle');
        if (!toggle) return;

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.nav-submenu-group').forEach(g => g.classList.remove('open'));
            group.classList.add('open');

            const firstSubBtn = group.querySelector('.nav-sub-btn[data-page]');
            const firstPage = firstSubBtn?.dataset.page;
            if (firstPage) {
                navigateToPage(firstPage);
            }
        });

        group.querySelectorAll('.nav-sub-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                if (!page) return;
                navigateToPage(page);
            });
        });
    });
}

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            const parent = btn.closest('.tab-group');
            parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (tab === 'release' || tab === 'snapshot' || tab === 'special' || tab === 'old' || tab === 'installed') {
                currentVersionTab = tab;
                renderVersions();
            } else if (tab === 'installed-mods') {
                currentModTab = 'installed-mods';
                const installedPanel = document.getElementById('installed-mods-panel');
                const browsePanel = document.getElementById('browse-mods-panel');
                if (installedPanel) installedPanel.style.display = '';
                if (browsePanel) browsePanel.style.display = 'none';
                loadInstalledMods();
            } else if (tab === 'browse-mods') {
                currentModTab = 'browse-mods';
                const installedPanel = document.getElementById('installed-mods-panel');
                const browsePanel = document.getElementById('browse-mods-panel');
                if (installedPanel) installedPanel.style.display = 'none';
                if (browsePanel) browsePanel.style.display = '';
            } else if (tab === 'browse-modpacks') {
                loadResourcePage('modpack');
            }
        });
    });

    document.querySelectorAll('.loader-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.loader-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentLoaderType = btn.dataset.loader;
            loadModLoaderVersions();
        });
    });
}

function setupLaunchBar() {
    document.getElementById('launch-btn').addEventListener('click', handleLaunch);
    document.getElementById('home-launch-btn').addEventListener('click', handleLaunch);

    if (!launchVersionCustomSelect) {
        launchVersionCustomSelect = new CustomSelect('launch-version-select-wrapper', {
            onChange: (value) => {
                if (homeVersionCustomSelect) homeVersionCustomSelect.setValue(value);
            }
        });
    }

    const windowSizeSelect = document.getElementById('window-size');
    const customWindowSizeDiv = document.getElementById('custom-window-size');
    const customWidthInput = document.getElementById('custom-width');
    const customHeightInput = document.getElementById('custom-height');

    if (windowSizeSelect && customWindowSizeDiv) {
        windowSizeSelect.addEventListener('change', () => {
            if (windowSizeSelect.value === 'custom') {
                customWindowSizeDiv.style.display = 'flex';
                if (!customWidthInput.value) customWidthInput.value = '1920';
                if (!customHeightInput.value) customHeightInput.value = '1080';
            } else {
                customWindowSizeDiv.style.display = 'none';
            }
        });
    }

    const refreshBtn = document.getElementById('refresh-versions-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', async () => {
        showToast('正在刷新版本列表...', 'info');
        await loadVersions(true);
        showToast('版本列表已刷新', 'success');
    });
}

function setupModBrowse() {
    const modSearchBtn = document.getElementById('mod-search-btn');
    if (!modSearchBtn) return;
    const modSearchInput = document.getElementById('mod-search-input');
    modSearchBtn.addEventListener('click', () => {
        modSearchQuery = modSearchInput ? modSearchInput.value.trim() : '';
        modSearchOffset = 0;
        loadMods();
    });
    if (modSearchInput) modSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
            modSearchQuery = e.target.value.trim();
            modSearchOffset = 0;
            loadMods();
        }
    });
    const modPrevBtn = document.getElementById('mod-prev-btn');
    if (modPrevBtn) modPrevBtn.addEventListener('click', () => {
        if (modSearchOffset >= 15) {
            modSearchOffset -= 15;
            loadMods();
        }
    });
    const modNextBtn = document.getElementById('mod-next-btn');
    if (modNextBtn) modNextBtn.addEventListener('click', () => {
        modSearchOffset += 15;
        loadMods();
    });

    const bindFilter = (id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => { modSearchOffset = 0; loadMods(); });
    };
    bindFilter('mod-filter-loader');
    bindFilter('mod-filter-version');
    bindFilter('mod-filter-category');
    bindFilter('mod-filter-sort');
    bindFilter('mod-filter-source');
}

function setupAccountButtons() {
    const addMsBtn = document.getElementById('add-ms-account-btn');
    if (!addMsBtn) return;
    addMsBtn.addEventListener('click', startMsAuth);
    const addThirdPartyBtn = document.getElementById('add-thirdparty-account-btn');
    if (addThirdPartyBtn) addThirdPartyBtn.addEventListener('click', () => {
        showModal('thirdparty-account-modal');
    });
    const addOfflineBtn = document.getElementById('add-offline-account-btn');
    if (addOfflineBtn) addOfflineBtn.addEventListener('click', () => {
        showModal('offline-account-modal');
    });
    const createOfflineBtn = document.getElementById('create-offline-btn');
    if (createOfflineBtn) createOfflineBtn.addEventListener('click', async () => {
        const offlineUsernameInput = document.getElementById('offline-username-input');
        const username = offlineUsernameInput ? offlineUsernameInput.value.trim() : '';
        if (!username) { showToast('请输入玩家 ID', 'error'); return; }
        if (username.length < 3 || username.length > 16) {
            showToast('玩家 ID 长度需为 3 - 16 位', 'error'); return;
        }
        if (!/^[A-Za-z0-9_]+$/.test(username)) {
            if (!confirm(`你输入的玩家 ID「${username}」不符合标准（3 - 16 位，只可以包含英文字母、数字与下划线），可能导致部分版本的游戏无法启动或发生错误。\n\n强烈建议使用规范的玩家 ID！\n如果你坚持，仍然可以继续创建档案。`)) {
                return;
            }
        }
        try {
            const result = await API.addOfflineAccount(username);
            if (result.success) {
                showToast(`离线账户 ${username} 创建成功`, 'success');
                closeOfflineModal();
                await loadAccounts();
            } else {
                showToast(result.error || '创建失败', 'error');
            }
        } catch (e) {
            showToast('创建离线账户失败', 'error');
        }
    });

    const tpPreset = document.getElementById('tp-server-preset');
    const tpUrl = document.getElementById('tp-server-url');
    if (tpPreset) {
        tpPreset.addEventListener('change', () => {
            const val = tpPreset.value;
            if (val && val !== 'custom') {
                tpUrl.value = val;
                verifyThirdPartyServer(val);
            } else {
                tpUrl.value = '';
            }
        });
    }
    if (tpUrl) {
        tpUrl.addEventListener('blur', () => {
            const url = tpUrl.value.trim();
            if (url) verifyThirdPartyServer(url);
        });
    }

    const tpLoginBtn = document.getElementById('tp-login-btn');
    if (tpLoginBtn) tpLoginBtn.addEventListener('click', async () => {
        const tpServerUrl = document.getElementById('tp-server-url');
        const tpUsernameInput = document.getElementById('tp-username-input');
        const tpPasswordInput = document.getElementById('tp-password-input');
        const serverUrl = tpServerUrl ? tpServerUrl.value.trim() : '';
        const username = tpUsernameInput ? tpUsernameInput.value.trim() : '';
        const password = tpPasswordInput ? tpPasswordInput.value : '';
        if (!serverUrl) { showToast('请输入认证服务器地址', 'error'); return; }
        if (!username) { showToast('请输入邮箱或用户名', 'error'); return; }
        if (!password) { showToast('请输入密码', 'error'); return; }

        const btn = document.getElementById('tp-login-btn');
        btn.disabled = true;
        btn.textContent = '登录中...';
        try {
            const result = await API.loginThirdParty(serverUrl, username, password);
            if (result.success) {
                showToast(`欢迎，${result.account.username}！`, 'success');
                closeThirdPartyModal();
                await loadAccounts();
            } else if (result.needSelectProfile) {
                closeThirdPartyModal();
                showProfileSelectModal(result.accessToken, result.clientToken, result.serverUrl, result.availableProfiles);
            } else {
                showToast(result.error || '登录失败', 'error');
            }
        } catch (e) {
            showToast('登录失败: ' + (e.message || e.error || '未知错误'), 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '登录';
        }
    });
}

function setupSettingsPage() {
    const saveBtn = document.getElementById('save-settings-btn');
    if (!saveBtn) return;
    saveBtn.addEventListener('click', saveCurrentSettings);
    document.getElementById('reset-settings-btn').addEventListener('click', async () => {
        const confirmed = await showConfirmDialog('重置设置', '确定要重置所有设置为默认值吗？此操作不可恢复！', '重置', '取消');
        if (confirmed) {
            try {
                const result = await API.resetSettings();
                if (result.success) {
                    document.documentElement.setAttribute('data-theme', 'light');
                    document.querySelectorAll('.theme-option').forEach(btn => {
                        btn.classList.toggle('active', btn.getAttribute('data-theme') === 'light');
                    });
                    applyAccentColor('#1a1a1a');
                    await loadSettings();
                    showToast('设置已重置为默认值', 'success');
                } else {
                    showToast('重置失败: ' + (result.error || '未知错误'), 'error');
                }
            } catch (e) {
                showToast('重置失败: ' + e.message, 'error');
            }
        }
    });

    const accentColorInput = getDOMElement('custom-accent-color');
    if (accentColorInput) {
        const accentColorValueEl = getDOMElement('custom-color-value');
        const colorPreviewDot = document.getElementById('color-preview-dot');
        accentColorInput.addEventListener('input', throttle((e) => {
            const color = e.target.value;
            if (accentColorValueEl) accentColorValueEl.textContent = color;
            if (colorPreviewDot) colorPreviewDot.style.background = color;
        }, 50));
    }
}

function setupJavaPage() {
    document.getElementById('refresh-java-btn').addEventListener('click', loadInstalledJava);
    
    loadInstalledJava();
    loadJavaDownloadList();
}

async function loadInstalledJava() {
    const listEl = document.getElementById('installed-java-list');
    listEl.innerHTML = '<div class="loading">正在检测Java...</div>';
    
    try {
        const result = await API.getInstalledJava();
        
        if (result.java.length === 0) {
            listEl.innerHTML = '<div class="hint">未检测到已安装的Java</div>';
            return;
        }
        
        listEl.innerHTML = result.java.map((j, idx) => `
            <div class="java-item" data-java-index="${idx}">
                <div class="java-item-info">
                    <div class="java-version">
                        Java ${j.majorVersion} (${j.version})
                        <span class="java-badge ${j.source}">${j.source === 'system' ? '系统' : '内置'}</span>
                        ${j.isJdk ? '<span class="java-badge jdk">JDK</span>' : '<span class="java-badge jre">JRE</span>'}
                        ${j.is64Bit ? '<span class="java-badge arch">64位</span>' : '<span class="java-badge arch">32位</span>'}
                    </div>
                    <div class="java-path">${escapeHtml(j.path)}</div>
                </div>
                <div class="java-item-actions">
                    ${j.source === 'bundled' ? `<button class="btn btn-danger btn-sm java-delete-btn" data-java-index="${idx}">删除</button>` : ''}
                </div>
            </div>
        `).join('');

        listEl._javaData = result.java;
    } catch (e) {
        listEl.innerHTML = '<div class="hint">检测Java失败</div>';
    }
}

document.addEventListener('click', function(e) {
    const btn = e.target.closest('.java-delete-btn');
    if (!btn) return;
    const idx = parseInt(btn.dataset.javaIndex, 10);
    const listEl = document.getElementById('installed-java-list');
    if (!listEl || !listEl._javaData || !listEl._javaData[idx]) return;
    const j = listEl._javaData[idx];
    deleteJava(j.javaHome, j.majorVersion);
});

async function deleteJava(javaHome, majorVersion) {
    if (!javaHome) {
        showToast('缺少Java路径信息', 'error');
        return;
    }
    const confirmed = await showConfirmDialog('删除 Java', `确定要删除 Java ${majorVersion} 吗？\n\n将删除: ${javaHome}\n\n此操作不可撤销！`, '删除', '取消');
    if (!confirmed) return;
    
    try {
        const result = await API.deleteJava(javaHome);
        if (result.success) {
            showToast(result.message || 'Java已删除', 'success');
            await loadInstalledJava();
        } else {
            showToast(result.message || '删除失败', 'error');
        }
    } catch (e) {
        showToast('删除Java失败: ' + (e.message || '未知错误'), 'error');
    }
}

async function loadJavaDownloadList() {
    const listEl = document.getElementById('java-download-list');
    listEl.innerHTML = '<div class="loading">正在获取Java版本列表...</div>';
    
    try {
        const result = await API.getJavaList();
        
        if (!result.versions || result.versions.length === 0) {
            listEl.innerHTML = '<div class="hint">无法获取Java版本列表，请检查网络后重试<button class="btn btn-secondary btn-sm" style="margin-left:8px" onclick="loadJavaDownloadList()">重试</button></div>';
            return;
        }
        
        listEl.innerHTML = result.versions.map(j => `
            <div class="java-download-item">
                <div class="java-download-version">Java ${j.majorVersion}</div>
                <div class="java-download-info">版本: ${j.version}</div>
                <button class="btn btn-primary" onclick="downloadJava(${j.majorVersion})">下载</button>
            </div>
        `).join('');
    } catch (e) {
        listEl.innerHTML = '<div class="hint">获取Java版本列表失败: ' + escapeHtml(e.message || '网络错误') + ' <button class="btn btn-secondary btn-sm" style="margin-left:8px" onclick="loadJavaDownloadList()">重试</button></div>';
    }
}

let javaDownloadSessionId = null;
let javaDownloadPollTimer = null;
let javaDownloadProgressHistory = [];

async function downloadJava(majorVersion) {
    try {
        const result = await API.downloadJava(majorVersion);
        javaDownloadSessionId = result.sessionId;
        javaDownloadProgressHistory = [];
        
        document.getElementById('java-download-progress').style.display = 'block';
        document.getElementById('java-progress-fill').style.width = '0%';
        document.getElementById('java-progress-text').textContent = '0%';
        document.getElementById('java-progress-message').textContent = '准备下载...';
        const cancelBtn = document.getElementById('java-cancel-btn');
        if (cancelBtn) { cancelBtn.style.display = 'inline-block'; cancelBtn.disabled = false; cancelBtn.textContent = '取消下载'; }
        
        if (javaDownloadPollTimer) clearInterval(javaDownloadPollTimer);
        javaDownloadPollTimer = setInterval(pollJavaDownloadStatus, 500);
        
        showToast('开始下载Java ' + majorVersion, 'info');
    } catch (e) {
        showToast('启动下载失败: ' + e.message, 'error');
    }
}

async function cancelJavaDownload() {
    if (!javaDownloadSessionId) return;
    const cancelBtn = document.getElementById('java-cancel-btn');
    if (cancelBtn) { cancelBtn.disabled = true; cancelBtn.textContent = '取消中...'; }
    try {
        await API.cancelJavaDownload(javaDownloadSessionId);
        if (javaDownloadPollTimer) { clearInterval(javaDownloadPollTimer); javaDownloadPollTimer = null; }
        const msgEl = document.getElementById('java-progress-message');
        if (msgEl) msgEl.textContent = '下载已取消';
        if (cancelBtn) cancelBtn.style.display = 'none';
        javaDownloadSessionId = null;
        showToast('Java下载已取消', 'info');
    } catch (e) {
        showToast('取消失败: ' + e.message, 'error');
        if (cancelBtn) { cancelBtn.disabled = false; cancelBtn.textContent = '取消下载'; }
    }
}

async function pollJavaDownloadStatus() {
    if (!javaDownloadSessionId) return;
    
    try {
        const status = await API.getJavaDownloadStatus(javaDownloadSessionId);
        const now = Date.now();
        
        document.getElementById('java-progress-fill').style.width = status.progress + '%';
        document.getElementById('java-progress-text').textContent = status.progress + '%';
        let msg = status.message || '处理中...';
        if (status.speed && status.speed > 0) {
            const speedKB = (status.speed / 1024).toFixed(1);
            msg += ` (${speedKB} KB/s)`;
        }
        
        javaDownloadProgressHistory.push({ time: now, progress: status.progress });
        if (javaDownloadProgressHistory.length > 20) javaDownloadProgressHistory.shift();
        
        if (status.progress > 0 && status.progress < 100 && javaDownloadProgressHistory.length >= 2) {
            const oldest = javaDownloadProgressHistory[0];
            const elapsed = (now - oldest.time) / 1000;
            const progressDelta = status.progress - oldest.progress;
            if (elapsed > 0 && progressDelta > 0) {
                const progressPerSec = progressDelta / elapsed;
                const remaining = (100 - status.progress) / progressPerSec;
                if (remaining > 0 && remaining < 86400) {
                    msg += ' · 剩余 ' + formatDuration(remaining);
                }
            }
        }
        
        document.getElementById('java-progress-message').textContent = msg;
        
        if (status.status === 'completed') {
            clearInterval(javaDownloadPollTimer);
            javaDownloadPollTimer = null;
            javaDownloadSessionId = null;
            const cancelBtn2 = document.getElementById('java-cancel-btn');
            if (cancelBtn2) cancelBtn2.style.display = 'none';
            
            showToast('Java安装成功！环境变量已自动配置', 'success');
            
            setTimeout(() => {
                document.getElementById('java-download-progress').style.display = 'none';
                loadInstalledJava();
            }, 2000);
        } else if (status.status === 'error') {
            clearInterval(javaDownloadPollTimer);
            javaDownloadPollTimer = null;
            javaDownloadSessionId = null;
            const cancelBtn3 = document.getElementById('java-cancel-btn');
            if (cancelBtn3) cancelBtn3.style.display = 'none';
            
            showToast('安装失败: ' + (status.message || '未知错误'), 'error');
        } else if (status.status === 'cancelled') {
            clearInterval(javaDownloadPollTimer);
            javaDownloadPollTimer = null;
            javaDownloadSessionId = null;
            const cancelBtn4 = document.getElementById('java-cancel-btn');
            if (cancelBtn4) cancelBtn4.style.display = 'none';
            
            document.getElementById('java-progress-message').textContent = '下载已取消';
        }
    } catch (e) {
        console.error('轮询Java下载状态失败:', e);
    }
}

function setupConsole() {
    const clearBtn = document.getElementById('clear-log-btn');
    const consoleOutput = document.getElementById('console-output');
    if (!clearBtn || !consoleOutput) return;
    clearBtn.addEventListener('click', () => {
        consoleOutput.innerHTML = '<p class="console-wait">日志已清空</p>';
    });
}

async function exportGameLog() {
    try {
        const versionId = typeof currentSettingsVersionId !== 'undefined' ? currentSettingsVersionId
            : (typeof launchVersionCustomSelect !== 'undefined' && launchVersionCustomSelect ? launchVersionCustomSelect.getValue() : '');
        const url = `/api/game/log/export${versionId ? '?versionId=' + encodeURIComponent(versionId) : ''}`;
        const a = document.createElement('a');
        a.href = url;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (typeof showToast === 'function') showToast('日志导出成功', 'success');
    } catch (e) {
        console.error('[ExportLog] 导出失败:', e);
        if (typeof showToast === 'function') showToast('导出日志失败: ' + e.message, 'error');
    }
}

async function exportLogAndAskAI() {
    try {
        if (!localStorage.getItem('versepc_disclaimer_accepted')) {
            if (typeof showToast === 'function') showToast('请先完成实验性页面引导', 'info');
            navigateToPage('explore');
            return;
        }

        const versionId = typeof currentSettingsVersionId !== 'undefined' ? currentSettingsVersionId
            : (typeof launchVersionCustomSelect !== 'undefined' && launchVersionCustomSelect ? launchVersionCustomSelect.getValue() : '');
        const queryStr = versionId ? '?versionId=' + encodeURIComponent(versionId) : '';

        const a = document.createElement('a');
        a.href = `/api/game/log/export${queryStr}`;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        let logFilePath = '';
        try {
            const resp = await fetch(`/api/game/log/save-export${queryStr}`);
            const data = await resp.json();
            if (data.success && data.filePath) {
                logFilePath = data.filePath;
            }
        } catch (_) {}

        navigateToPage('explore');

        setTimeout(() => {
            if (typeof aiNewChat === 'function') aiNewChat();
            setTimeout(() => {
                const input = document.getElementById('ai-input');
                if (!input) return;
                const msg = logFilePath
                    ? `日志文件路径: ${logFilePath}\n\n请查看日志并修复问题`
                    : '请查看游戏日志并修复问题';
                input.value = msg;
                input.dispatchEvent(new Event('input'));
                if (typeof aiSendMessage === 'function') aiSendMessage();
            }, 300);
        }, 300);

        if (typeof showToast === 'function') showToast('日志已导出，正在跳转AI分析...', 'success');
    } catch (e) {
        console.error('[ExportLogAskAI] 失败:', e);
        if (typeof showToast === 'function') showToast('操作失败: ' + e.message, 'error');
    }
}

async function loadSettings() {
    try {
        const settings = await API.getSettings();
        const sv = (id, fallback) => { const el = document.getElementById(id); if (el) return el; return { value: fallback, checked: !!fallback, textContent: String(fallback) }; };

        sv('setting-java-path').value = settings.javaPath || '';
        sv('setting-max-memory').value = settings.maxMemory || 4096;
        sv('setting-min-memory').value = settings.minMemory || 1024;
        sv('setting-version-isolation').checked = settings.versionIsolation !== false;
        sv('setting-fullscreen').checked = !!settings.fullscreen;
        sv('setting-resolution').value = settings.resolution || '1920x1080';
        sv('setting-java-args').value = settings.javaArgs || '';
        sv('setting-close-on-launch').checked = !!settings.closeOnLaunch;
        sv('setting-auto-update').checked = settings.autoUpdate !== false;

        sv('setting-download-source').value = settings.downloadSource || 'auto';
        sv('setting-version-source').value = settings.versionSource || 'auto';
        const maxThreads = settings.maxThreads || 64;
        sv('setting-max-threads').value = maxThreads;
        const threadCountEl = document.getElementById('thread-count-value');
        if (threadCountEl) threadCountEl.textContent = maxThreads;
        const enableChunkEl = document.getElementById('setting-enable-chunk-download');
        if (enableChunkEl) enableChunkEl.checked = settings.enableChunkDownload !== false;
        const maxChunksEl = document.getElementById('setting-max-chunks-per-file');
        if (maxChunksEl) {
            const maxChunks = settings.maxChunksPerFile || 64;
            maxChunksEl.value = maxChunks;
            const chunkLabel = document.getElementById('chunk-count-value');
            if (chunkLabel) chunkLabel.textContent = maxChunks;
        }
        const speedLimit = settings.speedLimit || 0;
        sv('setting-speed-limit').value = speedLimit;
        updateSpeedLimitLabel(speedLimit);
        sv('setting-target-dir').value = settings.targetDir || '';
        sv('setting-ssl-verify').checked = !!settings.sslVerify;

        sv('setting-mod-source').value = settings.modSource || 'modrinth';
        sv('setting-filename-format').value = settings.filenameFormat || 'default';
        sv('setting-mod-style').value = settings.modStyle || 'title';
        sv('setting-ignore-quilt').checked = !!settings.ignoreQuilt;

        const accentColor = settings.accentColor || '#ffffff';
        const accentColorInput = document.getElementById('custom-accent-color');
        if (accentColorInput) accentColorInput.value = accentColor;
        const accentColorValueEl = document.getElementById('custom-color-value');
        if (accentColorValueEl) accentColorValueEl.textContent = accentColor;

        let savedTheme = settings.theme || 'light';
        const legacyThemes = ['blue', 'purple', 'green', 'orange', 'red', 'pink', 'teal', 'cyan', 'amber'];
        if (legacyThemes.includes(savedTheme)) savedTheme = 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        document.querySelectorAll('.theme-option').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-theme') === savedTheme);
        });
        const defaultAccent = savedTheme === 'light' ? '#1a1a1a' : '#ffffff';
        const effectiveAccent = settings.accentColor || defaultAccent;
        if (accentColorInput) accentColorInput.value = effectiveAccent;
        if (accentColorValueEl) accentColorValueEl.textContent = effectiveAccent;
        const colorPreviewDot = document.getElementById('color-preview-dot');
        if (colorPreviewDot) colorPreviewDot.style.background = effectiveAccent;
        if (settings.accentColor && settings.accentColor !== defaultAccent) {
            applyAccentColor(settings.accentColor);
        }
    } catch (e) { console.error('[Settings] Failed to load settings:', e); }
}

function updateSpeedLimitLabel(value) {
    const el = document.getElementById('speed-limit-value');
    if (el) {
        el.textContent = value === 0 ? '无限制' : value + ' MB/s';
    }
}

async function saveCurrentSettings() {
    const g = (id) => document.getElementById(id);
    const settings = {
        javaPath: g('setting-java-path')?.value || '',
        maxMemory: parseInt(g('setting-max-memory')?.value || '2048', 10),
        minMemory: parseInt(g('setting-min-memory')?.value || '256', 10),
        versionIsolation: g('setting-version-isolation')?.checked || false,
        fullscreen: g('setting-fullscreen')?.checked || false,
        resolution: g('setting-resolution')?.value || '',
        javaArgs: g('setting-java-args')?.value || '',
        closeOnLaunch: g('setting-close-on-launch')?.checked || false,
        autoUpdate: g('setting-auto-update')?.checked || false,

        downloadSource: g('setting-download-source')?.value || 'mojang',
        versionSource: g('setting-version-source')?.value || 'mojang',
        maxThreads: parseInt(g('setting-max-threads')?.value || '64', 10),
        enableChunkDownload: g('setting-enable-chunk-download') ? g('setting-enable-chunk-download').checked : true,
        maxChunksPerFile: g('setting-max-chunks-per-file') ? parseInt(g('setting-max-chunks-per-file').value, 10) : 64,
        speedLimit: parseInt(g('setting-speed-limit')?.value || '0', 10),
        targetDir: g('setting-target-dir')?.value || '',
        sslVerify: g('setting-ssl-verify')?.checked || false,

        modSource: g('setting-mod-source')?.value || 'modrinth',
        filenameFormat: g('setting-filename-format')?.value || '',
        modStyle: g('setting-mod-style')?.value || '',
        ignoreQuilt: g('setting-ignore-quilt')?.checked || false,

        accentColor: g('custom-accent-color')?.value || '#ffffff'
    };
    try {
        await API.saveSettings(settings);
        showToast('设置已保存', 'success');
    } catch (e) {
        showToast('保存设置失败', 'error');
    }
}

let versionsLoadFailed = false;
let versionsRetryTimer = null;

// ============================================================================
// 版本列表管理 - 加载、筛选、渲染游戏版本列表
// ============================================================================
async function loadVersions(forceRefresh = false) {
    try {
        const data = await API.getVersions(forceRefresh);
        allVersions = data.versions || [];
        installedVersions = data.installed || [];
        if (!Array.isArray(allVersions)) allVersions = [];
        if (!Array.isArray(installedVersions)) installedVersions = [];
        versionIconsTimestamp = Date.now();
        versionsLoadFailed = false;

        await updateVersionSelects();
        renderVersions();
        updateHomeStats();
        populateModVersionFilter();
    } catch (e) {
        console.error('[Versions] Load failed:', e.message);
        versionsLoadFailed = true;
        
        const container = document.getElementById('versions-list');
        if (container && installedVersions.length > 0) {
            currentVersionTab = 'installed';
            renderVersions();
            const tabs = document.querySelectorAll('.tab-btn[data-tab]');
            tabs.forEach(t => t.classList.remove('active'));
            const installedTab = document.querySelector('.tab-btn[data-tab="installed"]');
            if (installedTab) installedTab.classList.add('active');
        } else if (container) {
            container.innerHTML = `
                <p class="empty-text">加载版本列表失败</p>
                <button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="retryLoadVersions()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;vertical-align:middle;margin-right:4px">
                        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                    </svg> 重试
                </button>`;
        }
        populateModVersionFilter();

        if (!forceRefresh && !versionsRetryTimer) {
            versionsRetryTimer = setTimeout(() => {
                versionsRetryTimer = null;
                if (versionsLoadFailed) {
                    console.log('[Versions] Auto-retrying...');
                    loadVersions(false);
                }
            }, 30000);
        }
    }
}

function retryLoadVersions() {
    if (versionsRetryTimer) clearTimeout(versionsRetryTimer);
    versionsRetryTimer = null;
    const container = document.getElementById('versions-list');
    if (container) {
        container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>正在重新加载...</p></div>`;
    }
    loadVersions(true);
}

// ============================================================================
// 版本选择器 - 自定义下拉选择框的选项填充
// ============================================================================
let _cachedLastLaunchVersion = null;
async function updateVersionSelects() {
    if (!launchVersionCustomSelect && !document.getElementById('home-version-select-wrapper')) return;
    let currentVal = launchVersionCustomSelect ? launchVersionCustomSelect.getValue() : '';

    if (!currentVal) {
        try {
            if (_cachedLastLaunchVersion === null) {
                _cachedLastLaunchVersion = await window.electronAPI.store.get('versepc_last_launch_version') || '';
            }
            currentVal = _cachedLastLaunchVersion;
        } catch (_) {}
    }

    const versionOptions = installedVersions.filter(v => !v.error).map(v => {
        const customName = v.customName || '';
        let baseName = v.isExternal ? v.id.replace(/ \[外部\d*\]/, '') : v.id;
        let text = customName || baseName;
        let subtext = customName ? baseName : '';
        if (v.isModpack) { text += ` [${v.modpackLoader || '整合包'}]`; subtext = (subtext ? subtext + ' · ' : '') + (v.modpackLoader || '整合包'); }
        else if (v.isFabric) { text += ' [Fabric]'; subtext = (subtext ? subtext + ' · ' : '') + 'Fabric Loader'; }
        else if (v.isForge) { text += ' [Forge]'; subtext = (subtext ? subtext + ' · ' : '') + 'Forge'; }
        else if (v.isNeoForge) { text += ' [NeoForge]'; subtext = (subtext ? subtext + ' · ' : '') + 'NeoForge'; }
        else { subtext = (subtext ? subtext + ' · ' : '') + 'Vanilla'; }
        if (v.isExternal) { subtext += ' · 外部文件夹'; }
        return { value: v.id, text: text, subtext: subtext };
    });

    if (launchVersionCustomSelect) {
        launchVersionCustomSelect.setOptions(versionOptions);
        if (currentVal && versionOptions.find(o => o.value === currentVal)) {
            launchVersionCustomSelect.setValue(currentVal);
        } else if (versionOptions.length > 0) {
            launchVersionCustomSelect.setValue(versionOptions[0].value);
            _cachedLastLaunchVersion = versionOptions[0].value;
            try { window.electronAPI.store.set('versepc_last_launch_version', versionOptions[0].value); } catch (_) {}
        } else {
            launchVersionCustomSelect.setValue('');
            _cachedLastLaunchVersion = '';
        }
    }

    if (!homeVersionCustomSelect) {
        homeVersionCustomSelect = new CustomSelect('home-version-select-wrapper', {
            onChange: (value) => {
                if (launchVersionCustomSelect) launchVersionCustomSelect.setValue(value);
            }
        });
    }
    homeVersionCustomSelect.setOptions(versionOptions);
    if (currentVal && versionOptions.find(o => o.value === currentVal)) {
        homeVersionCustomSelect.setValue(currentVal);
    } else if (versionOptions.length > 0) {
        homeVersionCustomSelect.setValue(versionOptions[0].value);
    }

    const homeList = document.getElementById('home-installed-list');
    if (installedVersions.length === 0) {
        homeList.innerHTML = '<p class="empty-text">暂无已安装的版本</p>';
    } else {
        const errorVersions = installedVersions.filter(v => v.error);
        const normalVersions = installedVersions.filter(v => !v.error);
        
        const vanillaVersions = normalVersions.filter(v => {
            return !v.isFabric && !v.isForge && !v.isNeoForge && !v.isOptiFine && !v.isLiteLoader && !v.isModpack;
        });
        const moddedVersions = normalVersions.filter(v => {
            return v.isFabric || v.isForge || v.isNeoForge || v.isOptiFine || v.isLiteLoader || v.isModpack;
        });

        const tntIcon = `<img src="assets/tnt.png" alt="TNT" width="40" height="40" style="image-rendering:pixelated;image-rendering:crisp-edges;">`;
        
        const renderHomeVersionItem = (v) => {
            let badge = '原版', badgeClass = '';
            const iconParams = `id=${encodeURIComponent(v.id)}&type=release`;
            const forgeParam = v.isForge ? '&forge=true' : '';
            const fabricParam = v.isFabric ? '&fabric=true' : '';
            const neoforgeParam = v.isNeoForge ? '&neoforge=true' : '';
            const modpackParam = v.isModpack ? '&modpack=true' : '';
            const extDirParam = v.externalVersionDir ? `&extDir=${encodeURIComponent(v.externalVersionDir)}` : '';
            const iconUrl = `/api/version-icon?${iconParams}${forgeParam}${fabricParam}${neoforgeParam}${modpackParam}${extDirParam}&_t=${versionIconsTimestamp}`;
            if (v.isModpack) { badge = v.modpackLoader || '整合包'; badgeClass = 'modpack'; }
            else if (v.isFabric) { badge = 'Fabric'; badgeClass = 'fabric'; }
            else if (v.isForge) { badge = 'Forge'; badgeClass = 'forge'; }
            else if (v.isNeoForge) { badge = 'NeoForge'; badgeClass = 'forge'; }
            const externalBadge = v.isExternal ? '<span class="v-badge external" style="background:rgba(255,165,0,0.15);color:#ffa500;font-size:10px;margin-left:4px">外部</span>' : '';
            const displayName = v.isExternal ? (v.customName || v.id.replace(/ \[外部\d*\]/, '')) : (v.customName || v.id);
            return `<div class="version-item" style="cursor:pointer" onclick="openVersionSettings('${escapeOnclick(v.id)}','${escapeOnclick(displayName)}')">
                <div class="version-item-left">
                    <div class="version-item-icon"><img src="${iconUrl}" alt="" class="version-icon-img"></div>
                    <div class="version-item-info">
                        <span class="version-item-name">${escapeHtml(displayName)}</span>
                        <span class="version-item-meta"><span class="v-badge ${badgeClass}">${badge}</span>${externalBadge}</span>
                    </div>
                </div>
            </div>`;
        };

        let html = '';
        
        if (moddedVersions.length > 0) {
            html += moddedVersions.map(renderHomeVersionItem).join('');
        }

        if (vanillaVersions.length > 0) {
            html += `<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:0 4px">
                    <span style="font-size:12px;color:var(--text-muted);font-weight:600">\u26A0 基础版本 (${vanillaVersions.length})</span>
                </div>
                ${vanillaVersions.map(renderHomeVersionItem).join('')}
            </div>`;
        }

        if (errorVersions.length > 0) {
            const errorId = 'error-versions-' + Date.now();
            html += `<div class="error-versions-section">
                <div class="error-versions-header" onclick="toggleErrorVersions('${errorId}')">
                    <span>错误的版本 (<span class="error-count">${errorVersions.length}</span>)</span>
                    <span class="error-chevron">▼</span>
                </div>
                <div class="error-versions-list" id="${errorId}">
                    ${errorVersions.map(v => {
                        const displayName = v.customName || v.id.replace(/ \[外部\d*\]/, '');
                        return `<div class="error-version-item" style="cursor:pointer" onclick="openVersionSettings('${escapeOnclick(v.id)}','${escapeOnclick(displayName)}')">
                            <div class="error-version-icon">${tntIcon}</div>
                            <div class="error-version-info">
                                <span class="error-version-name">${escapeHtml(displayName)}</span>
                                <span class="error-version-reason">${escapeHtml(v.errorReason || '无法识别')}</span>
                            </div>
                            <button class="btn btn-danger btn-sm" style="flex-shrink:0;padding:4px 12px;font-size:12px" onclick="event.stopPropagation();quickDeleteErrorVersion('${escapeOnclick(v.id)}')">删除</button>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        }
        
        homeList.innerHTML = html;
    }
}

async function quickDeleteErrorVersion(versionId) {
    console.log('[Delete] quickDeleteErrorVersion called:', versionId);
    if (!confirm(`确定要删除版本 "${versionId}" 吗？`)) {
        console.log('[Delete] 用户取消');
        return;
    }
    console.log('[Delete] 用户确认，调用API...');
    try {
        const r = await API.deleteVersion(versionId, false);
        console.log('[Delete] API返回:', JSON.stringify(r));
        if (r.success) {
            showToast(`版本 ${versionId} 已删除`, 'success');
            await loadVersions(true);
        } else {
            showToast(r.error || '删除失败', 'error');
        }
    } catch (e) {
        console.error('[Delete] API异常:', e);
        showToast('删除失败: ' + (e.message || e), 'error');
    }
}

function toggleErrorVersions(id) {
    const list = document.getElementById(id);
    const header = list?.previousElementSibling;
    if (!list) return;
    list.classList.toggle('show');
    header?.classList.toggle('expanded');
}

// ============================================================================
// 版本列表渲染 - 将版本数据渲染为DOM卡片列表
// ============================================================================
function renderVersions() {
    const container = document.getElementById('versions-list');
    if (!container) return;
    let versions;

    if (currentVersionTab === 'installed') {
        versions = installedVersions;
    } else if (currentVersionTab === 'old') {
        versions = allVersions.filter(v => v.type === 'old_beta' || v.type === 'old_alpha');
    } else {
        versions = allVersions.filter(v => v.type === currentVersionTab);
    }

    if (versions.length === 0) {
        container.innerHTML = '<p class="empty-text">暂无版本</p>';
        return;
    }

    if (currentVersionTab === 'installed') {
        const errorVersions = versions.filter(v => v.error);
        const normalVersions = versions.filter(v => !v.error);
        
        const vanillaVersions = normalVersions.filter(v => {
            return !v.isFabric && !v.isForge && !v.isNeoForge && !v.isOptiFine && !v.isLiteLoader && !v.isModpack;
        });
        const moddedVersions = normalVersions.filter(v => {
            return v.isFabric || v.isForge || v.isNeoForge || v.isOptiFine || v.isLiteLoader || v.isModpack;
        });

        const renderVersionItem = (v) => {
            const iconClass = v.type === 'snapshot' ? 'snapshot' : v.type === 'special' ? 'special' : 'installed';
            const iconParams = `id=${encodeURIComponent(v.id)}&type=${v.type || 'release'}`;
            const forgeParam = v.isForge ? '&forge=true' : '';
            const fabricParam = v.isFabric ? '&fabric=true' : '';
            const neoforgeParam = v.isNeoForge ? '&neoforge=true' : '';
            const modpackParam = v.isModpack ? '&modpack=true' : '';
            const extDirParam = v.externalVersionDir ? `&extDir=${encodeURIComponent(v.externalVersionDir)}` : '';
            const iconUrl = `/api/version-icon?${iconParams}${forgeParam}${fabricParam}${neoforgeParam}${modpackParam}${extDirParam}&_t=${versionIconsTimestamp}`;
            const externalBadgeHtml = v.isExternal ? '<span style="display:inline-block;background:rgba(255,165,0,0.15);color:#ffa500;font-size:10px;padding:1px 6px;border-radius:4px;margin-left:6px">外部文件夹</span>' : '';
            const externalPathHtml = v.isExternal && v.externalPath ? `<span style="color:var(--text-muted);font-size:11px;margin-left:4px" title="${escapeHtml(v.externalPath)}">${escapeHtml(v.externalPath)}</span>` : '';
            const displayName = v.isExternal ? (v.customName || v.id.replace(/ \[外部\d*\]/, '')) : (v.customName || v.id);
            const deleteBtnHtml = `<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteVersion('${escapeOnclick(v.id)}')">${v.isExternal ? '移除' : '删除'}</button>`;
            return `<div class="version-item version-item-clickable" 
                data-version-id="${escapeHtml(v.id)}" 
                data-version-url="" 
                data-version-type="${v.type || 'release'}"
                data-installed="true"
                data-custom-name="${escapeHtml(v.customName || '')}">
                <div class="version-item-left">
                    <div class="version-item-icon ${iconClass}">
                        <img src="${iconUrl}" alt="" class="version-icon-img">
                    </div>
                    <div class="version-item-info">
                        <span class="version-item-name">${displayName}${externalBadgeHtml}</span>
                        <span class="version-item-meta">${getVersionTypeLabel(v)} \u00B7 ${formatDate(v.releaseTime)}${externalPathHtml}</span>
                    </div>
                </div>
                <div class="version-item-actions">
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openVersionSettings('${escapeOnclick(v.id)}','${escapeOnclick(displayName)}')">设置</button>
                    ${deleteBtnHtml}
                </div>
            </div>`;
        };

        let html = '';
        
        if (moddedVersions.length > 0) {
            html += moddedVersions.map(renderVersionItem).join('');
        }

        if (vanillaVersions.length > 0) {
            html += `<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:0 4px">
                    <span style="font-size:12px;color:var(--text-muted);font-weight:600">\u26A0 基础版本 (${vanillaVersions.length})</span>
                </div>
                ${vanillaVersions.map(renderVersionItem).join('')}
            </div>`;
        }

        if (errorVersions.length > 0) {
            const tntIcon = `<img src="assets/tnt.png" alt="TNT" width="24" height="24" style="image-rendering:pixelated;image-rendering:crisp-edges;">`;
            html += `<div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(239,68,68,0.2)">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:0 4px">
                    <span style="font-size:12px;color:#ef4444;font-weight:600">\u26A0 错误的版本 (${errorVersions.length})</span>
                </div>
                ${errorVersions.map(v => {
                    const displayName = v.customName || v.id.replace(/ \[外部\d*\]/, '');
                    return `<div class="version-item" style="border-color:rgba(239,68,68,0.15);background:rgba(239,68,68,0.03);margin-bottom:4px">
                        <div class="version-item-left">
                            <div class="version-item-icon" style="display:flex;align-items:center;justify-content:center;background:rgba(239,68,68,0.1)">
                                ${tntIcon}
                            </div>
                            <div class="version-item-info">
                                <span class="version-item-name" style="color:#ef4444">${escapeHtml(displayName)}</span>
                                <span class="version-item-meta" style="color:#ef4444;opacity:0.8">${escapeHtml(v.errorReason || '无法识别')}</span>
                            </div>
                        </div>
                        <div class="version-item-actions">
                            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteVersion('${escapeOnclick(v.id)}')">${v.isExternal ? '移除' : '删除'}</button>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;
        }
        
        container.innerHTML = html;
        return;
    }

    container.innerHTML = versions.map(v => {
        const iconClass = v.type === 'snapshot' ? 'snapshot' : v.type === 'special' ? 'special' : (v.type === 'old_beta' || v.type === 'old_alpha') ? 'old' : 'release';
        const iconParams = `id=${encodeURIComponent(v.id)}&type=${v.type || 'release'}`;
        const forgeParam = v.isForge ? '&forge=true' : '';
        const fabricParam = v.isFabric ? '&fabric=true' : '';
        const neoforgeParam = v.isNeoForge ? '&neoforge=true' : '';
        const modpackParam = v.isModpack ? '&modpack=true' : '';
        const extDirParam = v.externalVersionDir ? `&extDir=${encodeURIComponent(v.externalVersionDir)}` : '';
        const iconUrl = `/api/version-icon?${iconParams}${forgeParam}${fabricParam}${neoforgeParam}${modpackParam}${extDirParam}&_t=${versionIconsTimestamp}`;
        return `<div class="version-item version-item-clickable" 
            data-version-id="${escapeHtml(v.id)}" 
            data-version-url="${escapeHtml(v.url || '')}" 
            data-version-type="${escapeHtml(v.type || 'release')}">
            <div class="version-item-left">
                <div class="version-item-icon ${iconClass}">
                    <img src="${iconUrl}" alt="" class="version-icon-img">
                </div>
                <div class="version-item-info">
                    <span class="version-item-name">${v.id}</span>
                    <span class="version-item-meta">${getVersionTypeLabel(v)} \u00B7 ${formatDate(v.releaseTime)}</span>
                </div>
            </div>
            <div class="version-item-actions">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;opacity:0.5"><path d="M9 18l6-6-6-6"/></svg>
            </div>
        </div>`;
    }).join('');
}

let currentVersionDetail = null;
let selectedLoaderType = '';
let selectedLoaderVersion = '';
const AVATAR_CACHE_VERSION = 9;

let _pageTransitionLock = false;
let _pendingPageTransition = null;

async function navigateToPage(pageName) {
    if (_pageTransitionLock) {
        _pendingPageTransition = pageName;
        return;
    }

    console.log('[Navigate] Going to page:', pageName);
    const currentPage = document.querySelector('.page.active');
    const target = document.getElementById(`page-${pageName}`);
    if (!target) {
        console.error('[Navigate] Page not found:', pageName);
        return;
    }
    
    if (currentPage && currentPage === target) {
        target.scrollTop = 0;
        return;
    }

    if (currentPage && currentPage.id === 'page-explore' && pageName !== 'explore') {
        const cm = document.getElementById('ai-chat-main');
        if (cm) {
            window.__exploreChatState = {
                classes: cm.className,
                idle: cm.classList.contains('ai-idle'),
                welcomeDisplay: document.getElementById('ai-welcome')?.style.display || '',
                messagesDisplay: document.getElementById('ai-messages')?.style.display || '',
                topbarDisplay: document.getElementById('ai-chat-topbar')?.style.display || '',
                inputAreaClasses: document.getElementById('ai-input-area')?.className || '',
            };
        }
    }

    if (pageName === 'explore') {
        if (currentPage) {
            currentPage.classList.remove('active');
            currentPage.style.animation = '';
        }
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.nav-sub-btn').forEach(b => b.classList.remove('active'));
        const navBtn = document.querySelector('.nav-btn[data-page="explore"]');
        if (navBtn) navBtn.classList.add('active');
        
        const isAIEnabled = window.electronAPI?.isAIEnabled && window.electronAPI.isAIEnabled();
        const placeholder = document.getElementById('explore-placeholder');
        const chatContainer = document.getElementById('explore-chat-container');
        
        let isActivated = false;
        try {
            if (window.electronAPI?.activateStatus) {
                const activationStatus = window.electronAPI.activateStatus();
                if (activationStatus && typeof activationStatus.then === 'function') {
                    const result = await activationStatus;
                    isActivated = result && result.activated;
                } else {
                    isActivated = activationStatus && activationStatus.activated;
                }
            }
        } catch (e) {}
        
        if (!isActivated) {
            if (placeholder) {
                placeholder.style.display = 'block';
                placeholder.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px;text-align:center;">
                        <h2 style="color:var(--text-primary);margin:0 0 12px;font-size:24px;font-weight:600;">需要激活码</h2>
                        <p style="color:var(--text-secondary);margin:0 0 8px;font-size:15px;line-height:1.6;max-width:400px;">
                            请输入激活码以使用AI助手功能
                        </p>
                        <p style="color:var(--text-secondary);margin:0 0 32px;font-size:14px;line-height:1.6;max-width:400px;">
                            请前往设置页面输入激活码
                        </p>
                        <button onclick="showPage('settings')" style="display:inline-flex;align-items:center;gap:8px;padding:14px 32px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;text-decoration:none;border-radius:12px;font-size:16px;font-weight:600;transition:all 0.3s ease;box-shadow:0 4px 15px rgba(102,126,234,0.3);border:none;cursor:pointer;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(102,126,234,0.4)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 15px rgba(102,126,234,0.3)'">
                            前往设置页面
                        </button>
                        <p style="color:var(--text-tertiary);margin:24px 0 0;font-size:12px;">
                            在设置页面中输入激活码即可解锁AI助手功能
                        </p>
                    </div>
                `;
            }
            if (chatContainer) chatContainer.style.display = 'none';
            target.classList.add('active');
            target.scrollTop = 0;
            return;
        }
        
        if (placeholder) placeholder.style.display = 'none';
        if (chatContainer) chatContainer.style.display = '';
        
        const disclaimerModal = document.getElementById('experimental-disclaimer-modal');
        if (disclaimerModal && !localStorage.getItem('versepc_disclaimer_accepted')) {
            disclaimerModal.style.display = 'flex';
            disclaimerModal.classList.add('modal-visible');
            console.log('[Navigate] disclaimer modal shown');
        } else {
            console.log('[Navigate] disclaimer already accepted, showing explore directly');
            target.classList.add('active');
            target.scrollTop = 0;
        }
        const st = window.__exploreChatState;
        if (st) {
            const _restoreChat = () => {
                const cm = document.getElementById('ai-chat-main');
                if (cm) cm.className = st.classes;
                const w = document.getElementById('ai-welcome');
                if (w) w.style.display = st.welcomeDisplay;
                const m = document.getElementById('ai-messages');
                if (m) m.style.display = st.messagesDisplay;
                const t = document.getElementById('ai-chat-topbar');
                if (t) t.style.display = st.topbarDisplay;
                const ia = document.getElementById('ai-input-area');
                if (ia) ia.className = st.inputAreaClasses;
            };
            requestAnimationFrame(() => requestAnimationFrame(_restoreChat));
        }
        return;
    }
    
    const isDetailPage = pageName === 'version-detail' || pageName === 'mod-detail' || pageName === 'version-settings';
    
    if (isDetailPage && currentPage && currentPage.id.startsWith('page-')) {
        const currentPageName = currentPage.id.replace('page-', '');
        const detailPages = ['version-detail', 'mod-detail', 'version-settings'];
        if (!detailPages.includes(currentPageName)) {
            previousPage = currentPageName;
        }
    }

    if (pageName === 'mod-detail' && currentPage && currentPage.id === 'page-mod-detail' && !_isRestoringModDetail) {
        modDetailHistory.push({
            id: currentModDetailId,
            source: currentModDetailSource
        });
    }
    
    if (currentPage && currentPage !== target) {
        if (currentPage.id === 'page-version-settings') {
            document.querySelector('.content-area')?.classList.remove('no-scroll');
        }
        _pageTransitionLock = true;
        console.log(`[PERF-NAV] transition start: ${currentPage.id} → page-${pageName}`);
        const _navT0 = performance.now();
        currentPage.style.animation = '';
        requestAnimationFrame(() => {
            currentPage.classList.remove('active');
            currentPage.style.animation = '';
            target.classList.add('active');
            target.scrollTop = 0;
            target.style.animation = 'pageIn 0.18s var(--ease-out-expo) backwards';
            console.log(`[PERF-NAV] page swap ${(performance.now()-_navT0).toFixed(1)}ms`);
            setTimeout(() => {
                _pageTransitionLock = false;
                if (_pendingPageTransition && _pendingPageTransition !== pageName) {
                    const pending = _pendingPageTransition;
                    _pendingPageTransition = null;
                    navigateToPage(pending);
                } else {
                    _pendingPageTransition = null;
                }
            }, 80);
        });
    } else if (!currentPage) {
        target.classList.add('active');
        target.scrollTop = 0;
        target.style.animation = 'pageIn 0.18s var(--ease-out-expo) backwards';
    }
    
    if (isDetailPage) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const backPage = previousPage || 'mods';
        const navBtn = document.querySelector(`.nav-btn[data-page="${backPage}"]`);
        if (navBtn) {
            navBtn.classList.add('active');
        } else {
            const subBtn = document.querySelector(`.nav-sub-btn[data-page="${backPage}"]`);
            if (subBtn) {
                subBtn.classList.add('active');
            }
        }
    } else {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.nav-sub-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.nav-submenu-group').forEach(g => g.classList.remove('open'));
        document.querySelectorAll('.nav-submenu-toggle').forEach(t => t.classList.remove('active'));
        const navBtn = document.querySelector(`.nav-btn[data-page="${pageName}"]`);
        if (navBtn) {
            navBtn.classList.add('active');
        } else {
            const subBtn = document.querySelector(`.nav-sub-btn[data-page="${pageName}"]`);
            if (subBtn) {
                subBtn.classList.add('active');
                const parentGroup = subBtn.closest('.nav-submenu-group');
                if (parentGroup) {
                    parentGroup.classList.add('open');
                    const toggle = parentGroup.querySelector('.nav-submenu-toggle');
                    if (toggle) toggle.classList.add('active');
                }
            }
        }
    }

    if (pageName === 'modpacks') {
        modDetailHistory = [];
        setTimeout(() => loadResourcePage('modpack'), 100);
    } else if (pageName === 'settings-other') {
        setTimeout(() => refreshMemoryInfo(), 200);
    } else if (pageName === 'datapacks') {
        setTimeout(() => loadResourcePage('datapack'), 100);
    } else if (pageName === 'resourcepacks') {
        setTimeout(() => loadResourcePage('resourcepack'), 100);
    } else if (pageName === 'shaders') {
        setTimeout(() => loadResourcePage('shader'), 100);
    } else if (pageName === 'mods' && modMultiSelectMode) {
        modDetailHistory = [];
        setTimeout(() => {
            document.getElementById('mod-multiselect-bar').style.display = 'flex';
            document.getElementById('mod-multiselect-toggle').classList.add('btn-primary');
            document.getElementById('mod-multiselect-toggle').classList.remove('btn-secondary');
            updateModSelectUI();
            loadMods();
        }, 200);
    } else if (pageName === 'mod-favorites') {
        modDetailHistory = [];
        setupFavSearchListeners();
        setTimeout(function() { renderFavPage(); }, 100);
    } else if (pageName === 'mods') {
        modDetailHistory = [];
    } else if (pageName === 'downloads') {
        dlManager.render();
    }
}

function acceptExperimentalDisclaimer() {
    console.log('[Disclaimer] accepted');
    try { localStorage.setItem('versepc_disclaimer_accepted', '1'); } catch (e) {}
    const disclaimerModal = document.getElementById('experimental-disclaimer-modal');
    if (disclaimerModal) {
        disclaimerModal.classList.remove('modal-visible');
        disclaimerModal.style.display = 'none';
    }
    document.getElementById('page-explore').classList.add('active');
    if (typeof Onboarding !== 'undefined' && typeof OnboardingUI !== 'undefined') {
        setTimeout(() => {
            try {
                Onboarding.init();
                OnboardingUI.init();
                Onboarding.start(true);
                console.log('[Onboarding] started');
            } catch (e) {
                console.error('[Onboarding] start failed:', e);
            }
        }, 100);
    } else {
        console.warn('[Onboarding] not available, Onboarding:', typeof Onboarding, 'OnboardingUI:', typeof OnboardingUI);
    }
}

function goBackFromDetail() {
    if (modDetailHistory.length > 0) {
        const prev = modDetailHistory.pop();
        _isRestoringModDetail = true;
        openModDetail(prev.id, prev.source);
        _isRestoringModDetail = false;
    } else {
        const backPage = previousPage || 'mods';
        navigateToPage(backPage);
    }
}

function openVersionDetail(versionId, versionUrl, versionType) {
    currentVersionDetail = { id: versionId, url: versionUrl, type: versionType };
    
    navigateToPage('version-detail');
    
    const iconParams = `id=${encodeURIComponent(versionId)}&type=${versionType}`;
    document.getElementById('verdetail-icon').src = `/api/version-icon?${iconParams}&_t=${versionIconsTimestamp}`;
    document.getElementById('verdetail-name').textContent = versionId;
    const typeLabels = { release: '正式版', snapshot: '快照版', special: '愚人节版', old_beta: '旧测试版', old_alpha: '旧内测版' };
    document.getElementById('verdetail-meta').textContent = typeLabels[versionType] || versionType || '正式版';
    
    const mojangRadio = document.querySelector('input[name="download-source"][value="mojang"]');
    if (mojangRadio) mojangRadio.checked = true;
    
    selectedLoaderType = '';
    selectedLoaderVersion = '';
    document.querySelectorAll('.loader-card').forEach(item => item.classList.remove('selected'));
    const emptyLoaderCard = document.querySelector('.loader-card[data-loader=""]');
    if (emptyLoaderCard) emptyLoaderCard.classList.add('selected');
    const loaderVersionSection = document.getElementById('loader-version-section');
    if (loaderVersionSection) loaderVersionSection.style.display = 'none';
    document.getElementById('loader-version-list').innerHTML = '';
    
    loadLoaderVersions(versionId);
}

async function loadLoaderVersions(versionId) {
    const loaders = ['forge', 'neoforge', 'fabric', 'optifine'];
    const mcMajor = parseInt(versionId.split('.')[0], 10);
    const isNewVersioning = mcMajor >= 25;
    console.log(`[LoaderVersions] Checking loaders for MC ${versionId} (major: ${mcMajor}, newVersioning: ${isNewVersioning})`);
    for (const loader of loaders) {
        const descEl = document.getElementById(`loader-desc-${loader}`);
        if (!descEl) continue;
        try {
            const versions = await API.getModLoaderVersions(versionId, loader);
            console.log(`[LoaderVersions] ${loader}: ${versions ? versions.length : 0} versions found`);
            if (versions && versions.length > 0) {
                const latestVer = versions[0].version || versions[0].id || versions[0] || '最新';
                const loaderNames = { forge: 'Forge', neoforge: 'NeoForge', fabric: 'Fabric', optifine: 'OptiFine' };
                descEl.textContent = `${loaderNames[loader]} ${latestVer} 可用`;
            } else if (isNewVersioning && (loader === 'forge' || loader === 'neoforge')) {
                descEl.textContent = '此版本暂未适配';
            } else if (loader === 'optifine') {
                descEl.textContent = '暂不支持此版本';
            } else {
                descEl.textContent = '暂无可用版本';
            }
        } catch (e) {
            console.error(`[LoaderVersions] ${loader} error:`, e.message);
            if (descEl) descEl.textContent = '加载失败';
        }
    }
}

function selectLoaderCard(loaderType) {
    selectedLoaderType = loaderType;
    
    document.querySelectorAll('.loader-card').forEach(item => item.classList.remove('selected'));
    document.querySelector(`.loader-card[data-loader="${loaderType}"]`).classList.add('selected');
    
    if (loaderType) {
        populateLoaderVersionSelect(loaderType);
    } else {
        document.getElementById('loader-version-section').style.display = 'none';
        selectedLoaderVersion = '';
    }
}

async function populateLoaderVersionSelect(loaderType) {
    const listContainer = document.getElementById('loader-version-list');
    const section = document.getElementById('loader-version-section');

    section.style.display = 'block';
    listContainer.innerHTML = '<p class="empty-text" style="padding:20px 0;text-align:center;color:var(--text-muted)">加载中...</p>';

    const loaderIcons = {
        forge: 'CommandBlock.png',
        neoforge: 'NeoForge.png',
        fabric: 'Fabric.png',
        optifine: 'OptiFabric.png'
    };
    const iconFile = loaderIcons[loaderType] || 'Grass.png';

    try {
        const versions = await API.getModLoaderVersions(currentVersionDetail.id, loaderType);
        
        if (versions && versions.length > 0) {
            const loaderNames = { forge: 'Forge', neoforge: 'NeoForge', fabric: 'Fabric', optifine: 'OptiFine' };
            const loaderName = loaderNames[loaderType] || loaderType;

            listContainer.innerHTML = versions.map((v, i) => {
                const verStr = v.version || v.id || v;
                const verType = v.type || (i === 0 ? '推荐' : '');
                return `<div class="lver-item ${i === 0 ? 'selected' : ''}" data-version="${escapeHtml(verStr)}" onclick="selectLoaderVersion('${escapeOnclick(verStr)}')">
                    <div class="lver-icon"><img src="img/${iconFile}" alt="" style="width:24px;height:24px;image-rendering:pixelated"></div>
                    <div class="lver-info">
                        <div class="lver-name">${loaderName} ${escapeHtml(verStr)}</div>
                        <div class="lver-meta">${verType ? '<span class="lver-badge">' + escapeHtml(verType) + '</span>' : ''}</div>
                    </div>
                    <div class="lver-check">✓</div>
                </div>`;
            }).join('');

            selectedLoaderVersion = versions[0].version || versions[0].id || versions[0];
        } else {
            listContainer.innerHTML = '<p class="empty-text" style="padding:20px 0;text-align:center;color:var(--text-muted)">暂无可用版本</p>';
            selectedLoaderVersion = '';
        }
    } catch (e) {
        console.error('Loader version load error:', e);
        listContainer.innerHTML = '<p class="empty-text" style="padding:20px 0;text-align:center;color:var(--text-muted)">加载失败</p>';
        selectedLoaderVersion = '';
    }
}

function selectLoaderVersion(version) {
    selectedLoaderVersion = version;
    document.querySelectorAll('.lver-item').forEach(item => item.classList.remove('selected'));
    document.querySelector(`.lver-item[data-version="${version}"]`)?.classList.add('selected');
}

function confirmInstallVersion() {
    if (!currentVersionDetail) return;
    
    const downloadSource = document.querySelector('input[name="download-source"]:checked');
    const source = downloadSource ? downloadSource.value : 'mojang';
    
    let loaderInfo = null;
    if (selectedLoaderType) {
        loaderInfo = {
            type: selectedLoaderType,
            version: selectedLoaderVersion
        };
    }
    
    let defaultName = currentVersionDetail.id;
    if (loaderInfo && loaderInfo.type && loaderInfo.version) {
        const loaderSuffix = loaderInfo.type === 'neoforge' ? 'NeoForge' : 
                            loaderInfo.type.charAt(0).toUpperCase() + loaderInfo.type.slice(1);
        defaultName = `${currentVersionDetail.id}-${loaderSuffix}-${loaderInfo.version}`;
    }
    
    showVersionNameModal(defaultName, currentVersionDetail.url, currentVersionDetail.id, loaderInfo, source);
}

async function installVersionWithLoader(versionUrl, versionId, loaderInfo, downloadSource, customName = '') {
    try {
        const result = await API.installVersion(versionUrl, versionId, loaderInfo, downloadSource, customName);
        if (result.success) {
            currentInstallSessionId = result.sessionId;
            showInstallModal(versionId);
            pollInstallProgress(result.sessionId);
        } else if (result.alreadyInstalled) {
            showToast(result.message || `版本 ${versionId} 已安装`, 'info');
        } else {
            showToast(result.error || '安装失败', 'error');
        }
    } catch (e) {
        showToast('安装请求失败', 'error');
    }
}

async function installVersion(versionUrl, versionId) {
    try {
        const result = await API.installVersion(versionUrl, versionId);
        if (result.success) {
            currentInstallSessionId = result.sessionId;
            showInstallModal(versionId);
            pollInstallProgress(result.sessionId);
        } else if (result.alreadyInstalled) {
            showToast(result.message || `版本 ${versionId} 已安装`, 'info');
        } else {
            showToast(result.error || '安装失败', 'error');
        }
    } catch (e) {
        showToast('安装请求失败', 'error');
    }
}

function showVersionNameModal(defaultName, versionUrl, versionId, loaderInfo, downloadSource) {
    const existing = document.getElementById('version-name-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'version-name-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';

    const card = document.createElement('div');
    card.style.cssText = 'max-width:420px;width:90%;background:var(--bg-secondary);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);overflow:hidden;';

    card.innerHTML = `
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:15px;font-weight:600;color:var(--text-primary);">设置版本名称</span>
            <button id="vnm-close" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;padding:4px;">✕</button>
        </div>
        <div style="padding:20px;">
            <div style="margin-bottom:12px;">
                <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">版本名称</label>
                <input id="vnm-input" type="text" value="${defaultName.replace(/"/g, '&quot;')}" 
                    style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-primary);color:var(--text-primary);font-size:14px;outline:none;box-sizing:border-box;" />
                <div id="vnm-hint" style="margin-top:6px;font-size:12px;color:var(--text-muted);"></div>
            </div>
            <div id="vnm-warn" style="display:none;padding:10px 12px;border-radius:8px;background:rgba(255,193,7,0.1);border:1px solid rgba(255,193,7,0.3);margin-bottom:12px;">
                <span style="font-size:13px;color:#e6a817;">⚠ 已有相同名称的版本</span>
            </div>
        </div>
        <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;">
            <button id="vnm-cancel" style="padding:8px 20px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-primary);cursor:pointer;font-size:13px;">取消</button>
            <button id="vnm-confirm" style="padding:8px 20px;border-radius:8px;border:none;background:var(--accent);color:#fff;cursor:pointer;font-size:13px;font-weight:500;">确认安装</button>
        </div>
    `;

    modal.appendChild(card);
    document.body.appendChild(modal);

    const input = document.getElementById('vnm-input');
    const hint = document.getElementById('vnm-hint');
    const warn = document.getElementById('vnm-warn');
    const confirmBtn = document.getElementById('vnm-confirm');
    let nameExists = false;

    async function checkName() {
        const name = input.value.trim();
        if (!name) {
            hint.textContent = '';
            warn.style.display = 'none';
            confirmBtn.disabled = true;
            return;
        }
        try {
            const result = await API.checkVersionName(name);
            nameExists = result.exists;
            if (nameExists) {
                warn.style.display = 'block';
                hint.textContent = '';
                confirmBtn.disabled = true;
                confirmBtn.style.opacity = '0.5';
                confirmBtn.style.cursor = 'not-allowed';
            } else {
                warn.style.display = 'none';
                hint.textContent = '✓ 名称可用';
                confirmBtn.disabled = false;
                confirmBtn.style.opacity = '1';
                confirmBtn.style.cursor = 'pointer';
            }
        } catch (e) {
            warn.style.display = 'none';
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = '1';
            confirmBtn.style.cursor = 'pointer';
        }
    }

    input.addEventListener('input', checkName);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !confirmBtn.disabled) confirmBtn.click();
    });

    document.getElementById('vnm-close').onclick = () => modal.remove();
    document.getElementById('vnm-cancel').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    confirmBtn.onclick = async () => {
        const name = input.value.trim();
        if (!name || confirmBtn.disabled) return;
        
        modal.remove();
        navigateToPage('versions');
        
        setTimeout(() => {
            installVersionWithLoader(versionUrl, versionId, loaderInfo, downloadSource, name);
        }, 200);
    };

    checkName();
    input.focus();
    input.select();
}

function showInstallModal(versionId) {
    const taskId = 'version-' + currentInstallSessionId;
    dlManager.add(taskId, `安装 ${versionId}`, 'version', currentInstallSessionId,
        versionId ? `/api/version-icon?id=${encodeURIComponent(versionId)}&type=release` : '');
    navigateToPage('downloads');
}

function closeInstallModal() {
    if (currentInstallSessionId) {
        API.cancelInstall(currentInstallSessionId);
        currentInstallSessionId = null;
    }
}

function cancelInstall() {
    closeInstallModal();
    showToast('安装已取消', 'info');
}

async function pollInstallProgress(sessionId) {
    const taskId = 'version-' + sessionId;
    let smoothInstallPct = 0;

    const poll = async () => {
        try {
            if (!dlManager.tasks.has(taskId)) return;
            const data = await API.getInstallProgress(sessionId);
            if (!data || !data.sessionId) return;

            const rawPct = data.progress || 0;
            if (rawPct > smoothInstallPct) {
                smoothInstallPct = smoothInstallPct * 0.85 + rawPct * 0.15;
            }
            const smoothPct = Math.round(smoothInstallPct);

            const downloadStatus = data.status === 'completed' ? 'completed' : data.status === 'failed' ? 'failed' : data.status === 'cancelled' ? 'failed' : 'downloading';
            const statusMessage = getStageText(data.stage) || data.message || '安装中...';

            var files = [];
            if (data.currentFile) {
                var speedText = data.speed ? formatBytes(data.speed) + '/s' : '';
                files.push({
                    name: '当前文件: ' + data.currentFile,
                    progress: downloadStatus === 'completed' ? 100 : (data.totalFiles ? Math.round(data.completedFiles / data.totalFiles * 100) : smoothPct),
                    status: downloadStatus,
                    size: speedText
                });
            }
            if (data.totalFiles > 0) {
                files.push({
                    name: '文件进度: ' + data.completedFiles + ' / ' + data.totalFiles,
                    progress: Math.round(data.completedFiles / data.totalFiles * 100),
                    status: downloadStatus
                });
            }
            if (data.bytesDownloaded > 0 || data.totalBytes > 0) {
                var dlText = formatBytes(data.bytesDownloaded || 0);
                if (data.totalBytes) dlText += ' / ' + formatBytes(data.totalBytes);
                files.push({
                    name: '下载量: ' + dlText,
                    progress: data.totalBytes ? Math.round(data.bytesDownloaded / data.totalBytes * 100) : 0,
                    status: downloadStatus
                });
            }
            if (data.stage) {
                files.push({
                    name: '当前阶段: ' + (getStageText(data.stage) || data.stage),
                    progress: downloadStatus === 'completed' ? 100 : smoothPct,
                    status: data.stage === 'completed' ? 'completed' : downloadStatus
                });
            }

            dlManager.update(taskId, {
                progress: smoothPct,
                status: downloadStatus,
                message: statusMessage,
                files: files
            });

            if (data.status === 'completed') {
                showToast(data.versionId + ' 安装完成！', 'success');
                currentInstallSessionId = null;
                await loadVersions(true);
                return;
            }
            if (data.status === 'failed') {
                showToast('安装失败: ' + (data.message || '未知错误'), 'error');
                currentInstallSessionId = null;
                return;
            }
            if (data.status === 'cancelled') { currentInstallSessionId = null; return; }
            setTimeout(poll, 500);
        } catch (e) {
            if (dlManager.tasks.has(taskId)) setTimeout(poll, 1000);
        }
    };
    poll();
}

function getStageText(stage) {
    const map = {
        'preparing': '准备中...',
        'version_json': '下载版本信息...',
        'client_jar': '下载游戏客户端...',
        'libraries': '下载依赖库...',
        'assets': '下载资源文件...',
        'natives': '提取原生库...',
        'finalizing': '完成安装...',
        'loader': '安装模组加载器...',
        'fabric-api': '下载 Fabric API...',
        'completed': '安装完成',
        'failed': '安装失败',
        'cancelled': '已取消'
    };
    return map[stage] || stage || '';
}

let _shiftKeyDown = false;
document.addEventListener('keydown', (e) => { if (e.key === 'Shift') _shiftKeyDown = true; });
document.addEventListener('keyup', (e) => { if (e.key === 'Shift') _shiftKeyDown = false; });

async function deleteVersion(versionId) {
    const isExternal = versionId.includes(' [外部');
    const ver = installedVersions.find(v => v.id === versionId);
    const isPermanent = !isExternal && _shiftKeyDown;
    let warningParts = [];
    if (ver?.hasMods) warningParts.push('模组');
    if (ver?.hasSaves) warningParts.push('存档');
    if (ver?.hasResourcepacks) warningParts.push('资源包');
    let confirmMsg = isExternal
        ? `确定要从列表中移除 ${versionId} 吗？\n（不会删除实际游戏文件）`
        : isPermanent
            ? `确定要永久删除版本 ${versionId} 吗？\n（无法恢复）`
            : `确定要删除版本 ${versionId} 吗？\n（将移入回收站）`;

    if (warningParts.length > 0) {
        confirmMsg += `\n\n⚠ 由于该版本开启了版本隔离，删除版本时该版本对应的${warningParts.join('、')}等文件也将被一并删除！`;
    }

    const confirmed = await showConfirmDialog(isExternal ? '移除外部版本' : isPermanent ? '永久删除' : '版本删除确认', confirmMsg, isExternal ? '移除' : isPermanent ? '永久删除' : '删除', '取消');
    if (!confirmed) return;
    try {
        const r = await API.deleteVersion(versionId, isPermanent);
        if (r.success) {
            showToast(`版本 ${versionId} 已${isPermanent ? '永久删除' : '删除'}`, 'success');
            await loadVersions(true);
        } else {
            showToast(r.error || '删除失败', 'error');
        }
    } catch (e) { showToast('删除失败', 'error'); }
}

let pendingExternalFolderPath = '';

async function addExternalFolder() {
    document.getElementById('external-folder-path').value = '';
    document.getElementById('external-folder-name').value = '';
    document.getElementById('external-folder-preview').style.display = 'none';
    document.getElementById('external-folder-error').style.display = 'none';
    document.getElementById('external-folder-confirm-btn').disabled = true;
    pendingExternalFolderPath = '';
    showModal('external-folder-modal');
}

function closeExternalFolderModal() {
    hideModal('external-folder-modal');
    pendingExternalFolderPath = '';
}

async function selectExternalFolderPath() {
    try {
        const result = await API.selectExternalFolder();
        if (result.success && result.path) {
            document.getElementById('external-folder-path').value = result.path;
            pendingExternalFolderPath = result.path;
            document.getElementById('external-folder-error').style.display = 'none';
            document.getElementById('external-folder-confirm-btn').disabled = false;
        }
    } catch (e) {
        console.error('Select external folder error:', e);
    }
}

async function confirmAddExternalFolder() {
    const folderPath = document.getElementById('external-folder-path').value || pendingExternalFolderPath;
    const folderName = document.getElementById('external-folder-name').value.trim();
    if (!folderPath) {
        showToast('请先选择文件夹', 'error');
        return;
    }
    const confirmBtn = document.getElementById('external-folder-confirm-btn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = '添加中...';
    try {
        const result = await API.addExternalFolder(folderPath, folderName);
        if (result.success) {
            showToast(`已添加文件夹，发现 ${result.versions.length} 个版本`, 'success');
            if (result.versions && result.versions.length > 0) {
                const listHtml = result.versions.map(v => {
                    let typeLabel = '原版';
                    if (v.isFabric) typeLabel = 'Fabric';
                    else if (v.isForge) typeLabel = 'Forge';
                    else if (v.isNeoForge) typeLabel = 'NeoForge';
                    return `<div style="padding:4px 0;display:flex;align-items:center;gap:8px"><span style="color:var(--text-primary)">${v.id}</span><span style="color:var(--text-muted);font-size:12px;padding:2px 6px;border-radius:4px;background:var(--bg-tertiary)">${typeLabel}</span></div>`;
                }).join('');
                document.getElementById('external-folder-versions-list').innerHTML = listHtml;
                document.getElementById('external-folder-preview').style.display = 'block';
            }
            setTimeout(() => {
                closeExternalFolderModal();
                loadVersions(true);
            }, 1500);
        } else {
            document.getElementById('external-folder-error').textContent = result.error || '添加失败';
            document.getElementById('external-folder-error').style.display = 'block';
        }
    } catch (e) {
        document.getElementById('external-folder-error').textContent = '添加失败: ' + e.message;
        document.getElementById('external-folder-error').style.display = 'block';
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = '添加';
    }
}

function openModLoaderModal(gameVersion) {
    showModal('modloader-modal');

    if (!modloaderGameVersionCustomSelect) {
        modloaderGameVersionCustomSelect = new CustomSelect('modloader-game-version-wrapper', {
            onChange: () => loadModLoaderVersions()
        });
    }

    const installedBase = installedVersions.filter(v => !v.isFabric && !v.isForge && !v.isNeoForge);
    const versions = installedBase.length > 0 ? installedBase : allVersions.filter(v => v.type === 'release').slice(0, 20);

    const options = versions.map(v => ({
        value: v.id,
        text: v.id
    }));

    modloaderGameVersionCustomSelect.setOptions(options);

    if (gameVersion && options.find(o => o.value === gameVersion)) {
        modloaderGameVersionCustomSelect.setValue(gameVersion);
    }

    loadModLoaderVersions();
    document.getElementById('modloader-install-btn').onclick = installModLoader;
}

function closeModLoaderModal() {
    hideModal('modloader-modal');
}

async function loadModLoaderVersions() {
    const gameVersion = modloaderGameVersionCustomSelect ? modloaderGameVersionCustomSelect.getValue() : '';

    if (!modloaderVersionCustomSelect) {
        modloaderVersionCustomSelect = new CustomSelect('modloader-version-wrapper');
    }

    modloaderVersionCustomSelect.setOptions([{ value: '', text: '加载中...' }]);
    try {
        if (currentLoaderType === 'fabric') {
            const versions = await API.getModLoaderVersions(gameVersion, 'fabric');
            const options = versions.map(v => ({
                value: v.version,
                text: `${v.version} ${v.stable ? '(稳定)' : ''}`
            }));
            modloaderVersionCustomSelect.setOptions(options);
            const stable = versions.find(v => v.stable);
            if (stable) modloaderVersionCustomSelect.setValue(stable.version);
        } else if (currentLoaderType === 'forge') {
            const versions = await API.getModLoaderVersions(gameVersion, 'forge');
            const options = versions.map(v => ({
                value: v.version,
                text: `${v.version} (${v.type})`
            }));
            modloaderVersionCustomSelect.setOptions(options);
        } else if (currentLoaderType === 'neoforge') {
            const versions = await API.getModLoaderVersions(gameVersion, 'neoforge');
            const options = versions.map(v => ({
                value: v.version,
                text: `${v.version} ${v.type ? '(' + v.type + ')' : ''}`
            }));
            modloaderVersionCustomSelect.setOptions(options);
            if (versions.length > 0) modloaderVersionCustomSelect.setValue(versions[0].version);
        }
    } catch (e) { modloaderVersionCustomSelect.setOptions([{ value: '', text: '加载失败' }]); }
}

async function installModLoader() {
    const gameVersion = modloaderGameVersionCustomSelect ? modloaderGameVersionCustomSelect.getValue() : '';
    const loaderVersion = modloaderVersionCustomSelect ? modloaderVersionCustomSelect.getValue() : '';
    if (!gameVersion) { showToast('请选择游戏版本', 'error'); return; }
    try {
        let result;
        const loaderNames = { fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge' };
        if (currentLoaderType === 'fabric') {
            result = await API.installFabric(gameVersion, loaderVersion);
        } else if (currentLoaderType === 'forge') {
            if (!loaderVersion) { showToast('请选择Forge版本', 'error'); return; }
            result = await API.installForge(gameVersion, loaderVersion);
        } else if (currentLoaderType === 'neoforge') {
            if (!loaderVersion) { showToast('请选择NeoForge版本', 'error'); return; }
            result = await API.installNeoForge(gameVersion, loaderVersion);
        } else {
            showToast('不支持的加载器类型', 'error');
            return;
        }
        if (result.success) {
            let installedId = result.versionId;
            if (!installedId) {
                if (currentLoaderType === 'fabric') installedId = `fabric-loader-${loaderVersion}-${gameVersion}`;
                else if (currentLoaderType === 'forge') installedId = `${gameVersion}-forge-${loaderVersion}`;
                else if (currentLoaderType === 'neoforge') installedId = `${gameVersion}-neoforge-${loaderVersion}`;
                else installedId = `${gameVersion}-${currentLoaderType}-${loaderVersion}`;
            }
            showToast(`${loaderNames[currentLoaderType] || currentLoaderType} 安装成功！`, 'success');
            closeModLoaderModal();
            await loadVersions(true);
            if (launchVersionCustomSelect) {
                launchVersionCustomSelect.setValue(installedId);
                _cachedLastLaunchVersion = installedId;
                try { window.electronAPI.store.set('versepc_last_launch_version', installedId); } catch (_) {}
            }
        } else {
            showToast(result.error || '安装失败', 'error');
        }
    } catch (e) { showToast('安装失败', 'error'); }
}

async function loadInstalledMods() {
    try {
        const result = await API.getInstalledMods();
        const mods = Array.isArray(result) ? result : (result.mods || []);
        const warnings = Array.isArray(result) ? [] : (result.warnings || []);
        const container = document.getElementById('installed-mods-list');
        if (!container) return;
        if (mods.length === 0) {
            container.innerHTML = '<p class="empty-text">暂无已安装的模组</p>';
        } else {
            let warningHtml = '';
            if (warnings.length > 0) {
                warningHtml = warnings.map(w =>
                    `<div class="mod-warning ${w.type === 'conflict' ? 'warning-conflict' : 'warning-duplicate'}">
                        <span class="warning-icon">${w.type === 'conflict' ? '⚠️' : '🔄'}</span>
                        <span>${escapeHtml(w.message)}</span>
                    </div>`
                ).join('');
            }
            container.innerHTML = warningHtml + mods.map(function (mod) {
                return '<div class="mod-item">' +
                    '<div class="mod-icon"><img src="' + escapeHtml(mod.icon || '') + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.classList.add(\'mod-icon--fallback\')"></div>' +
                    '<div class="mod-info">' +
                        '<div class="mod-name">' + escapeHtml(formatModNameWithChinese(mod.slug || mod.id || mod.fileName, mod.name)) + '</div>' +
                        '<div class="mod-desc">' + escapeHtml(mod.description) + '</div>' +
                        '<div class="mod-meta">' +
                            '<span>' + mod.size + '</span>' +
                            '<span>' + (mod.enabled ? '已启用' : '已禁用') + '</span>' +
                            (mod.author ? '<span>' + escapeHtml(mod.author) + '</span>' : '') +
                            (mod.version && mod.version !== '1.0' ? '<span>v' + escapeHtml(mod.version) + '</span>' : '') +
                        '</div>' +
                    '</div>' +
                    '<div class="mod-actions">' +
                        '<button class="btn btn-sm ' + (mod.enabled ? 'btn-secondary' : 'btn-primary') + '" onclick="toggleMod(\'' + escapeOnclick(mod.fileName || mod.id) + '\', ' + (!mod.enabled) + ')">' + (mod.enabled ? '禁用' : '启用') + '</button>' +
                        '<button class="btn btn-danger btn-sm" onclick="deleteMod(\'' + escapeOnclick(mod.fileName || mod.id) + '\')">删除</button>' +
                    '</div>' +
                '</div>';
            }).join('');
        }
        document.getElementById('stat-mods').textContent = mods.length;
    } catch (e) { console.error('[Mods] Failed to load installed mods:', e); }
}

const MODRINTH_CATEGORY_ZH = {
    'adventure': '冒险', 'cursed': '诅咒', 'decoration': '装饰', 'equipment': '装备',
    'food': '食物', 'library': '前置库', 'magic': '魔法', 'optimization': '优化',
    'storage': '存储', 'technology': '科技', 'transportation': '交通', 'utility': '实用',
    'world-gen': '世界生成', 'game-mechanics': '游戏机制', 'social': '社交',
    'automation': '自动化', 'biomes': '生物群系', 'blocks': '方块', 'bosses': 'Boss',
    'building': '建筑', 'chat': '聊天', 'combat': '战斗', 'dimensions': '维度',
    'economy': '经济', 'entities': '实体', 'environment': '环境', 'farming': '农业',
    'hud': 'HUD', 'items': '物品', 'management': '管理', 'map': '地图',
    'minigame': '小游戏', 'mobs': '生物', 'modded': '模组化', 'models': '模型',
    'multimedia': '多媒体', 'performance': '性能', 'quests': '任务', 'redstone': '红石',
    'resource-pack': '资源包', 'server': '服务器', 'skin': '皮肤', 'sound': '声音',
    'structures': '结构', 'tweaks': '调整', 'vanilla-like': '原版风格',
    '8x-': '8x-', '16x': '16x', '32x': '32x', '64x': '64x', '128x': '128x',
    '256x': '256x', '512x+': '512x+', 'animation': '动画', 'core-shaders': '核心着色器',
    'compatibility': '兼容性', 'cartoon': '卡通', 'fantasy': '奇幻', 'medieval': '中世纪',
    'modern': '现代', 'photo-realistic': '写实', 'semi-realistic': '半写实',
    'simplistic': '简约', 'traditional': '传统', 'pbr': 'PBR', 'colored-lighting': '彩色光照',
    'path-tracing': '光线追踪', 'reflections': '反射', 'shadows': '阴影',
    'volumetric-light': '体积光', 'datapack': '数据包'
};

async function loadModFilterOptions() {
    try {
        const data = await API.getModCategories();
        const categories = data.categories || [];
        const options = [
            { value: '', text: '全部' },
            ...categories.map(cat => ({ value: cat.name, text: MODRINTH_CATEGORY_ZH[cat.name] || cat.name }))
        ];
        updateCustomSelectOptions('mod-filter-category', options);
    } catch (e) { console.error('[Mods] Failed to load filter options:', e); }
}

function populateModVersionFilter() {
    const versionOptions = [
        { value: '', text: '全部' },
        ...allVersions.filter(v => v.type === 'release').slice(0, 30).map(v => ({
            value: v.id,
            text: v.id
        }))
    ];

    const currentVal = getCustomSelectValue('mod-filter-version');
    updateCustomSelectOptions('mod-filter-version', versionOptions);
    if (currentVal) {
        setCustomSelectValue('mod-filter-version', currentVal);
    }

    updateCustomSelectOptions('modpack-filter-version', versionOptions);
    updateCustomSelectOptions('datapack-filter-version', versionOptions);
    updateCustomSelectOptions('resourcepack-filter-version', versionOptions);
}

function translateChineseModQuery(query) {
    if (!query || !/[\u4e00-\u9fff]/.test(query)) return query;
    const q = query.toLowerCase().trim();
    const matches = [];
    for (const [slug, chineseName] of Object.entries(MOD_CHINESE_NAMES)) {
        const parts = chineseName.split(/[·（(]/);
        const mainName = (parts[0] || '').trim();
        if (mainName.includes(q) || chineseName.includes(q)) {
            matches.push({ slug, weight: mainName === q ? 100 : mainName.startsWith(q) ? 50 : chineseName.includes(q) ? 20 : 0 });
        }
    }
    if (matches.length > 0) {
        matches.sort((a, b) => b.weight - a.weight);
        const slugs = [...new Set(matches.filter(m => m.weight >= 20).map(m => m.slug))];
        if (slugs.length > 0) return slugs.slice(0, 5).join(' ');
    }
    return query;
}

async function loadMods() {
    const container = document.getElementById('mod-browse-list');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>加载中...</p></div>';

    const title = document.getElementById('mod-browse-title');
    title.textContent = modSearchQuery ? `搜索 "${modSearchQuery}" 的结果` : '热门模组';

    const loader = getCustomSelectValue('mod-filter-loader');
    const version = getCustomSelectValue('mod-filter-version');
    const category = getCustomSelectValue('mod-filter-category');
    const sort = getCustomSelectValue('mod-filter-sort');
    const sourceFilter = getCustomSelectValue('mod-filter-source') || 'any';

    const translatedQuery = translateChineseModQuery(modSearchQuery);

    try {
        const data = await API.searchMods(translatedQuery, sourceFilter, loader, version, category, sort, 15, modSearchOffset);
        const hits = data.hits || [];
        modSearchTotal = data.total || 0;
        modSearchResults = hits;
        hits.forEach(function(h) { _projectDataCache.set(h.id, h); });

        if (hits.length === 0) {
            container.innerHTML = '<p class="empty-text">未找到模组</p>';
        } else {
            container.innerHTML = hits.map(function (mod) {
                var isSelected = modSelectedIds.has(mod.id);
                var isFav = _favorites.some(function(f) { return f.favs.includes(mod.id); });
                return '<div class="mod-item mod-item-clickable' + (modMultiSelectMode ? ' mod-multiselect-active' : '') + '" onclick="openModDetail(\'' + mod.id + '\', \'' + mod.source + '\')" onmouseenter="preloadModVersions(\'' + mod.id + '\', \'' + mod.source + '\')">' +
                    (modMultiSelectMode ? '<div class="mod-checkbox' + (isSelected ? ' checked' : '') + '" data-mod-id="' + mod.id + '" onclick="event.stopPropagation();toggleModSelect(\'' + mod.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>' : '') +
                    '<div class="mod-icon"><img src="' + escapeHtml(mod.icon || '') + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.classList.add(\'mod-icon--fallback\')"></div>' +
                    '<div class="mod-info">' +
                        '<div class="mod-name">' + escapeHtml(formatModNameWithChinese(mod.slug || mod.id, mod.title)) +
                            (sourceFilter === 'any' ? ' <span style="font-size:10px;padding:1px 5px;border-radius:3px;background:' + (mod.source === 'curseforge' ? '#f1643620;color:#f16436;border:1px solid #f1643630' : '#4caf5020;color:#4caf50;border:1px solid #4caf5030') + ';font-weight:500;vertical-align:middle">' + (mod.source === 'curseforge' ? 'CF' : 'MR') + '</span>' : '') +
                        '</div>' +
                        '<div class="mod-desc">' + escapeHtml(mod.description) + '</div>' +
                        '<div class="mod-meta">' +
                            '<span>\u2B07 ' + formatNumber(mod.downloads) + '</span>' +
                            '<span>\u2764 ' + escapeHtml(mod.author) + '</span>' +
                            '<span>' + (mod.categories || []).slice(0, 3).join(', ') + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="mod-actions" onclick="event.stopPropagation()">' +
                        '<button class="fav-heart-btn' + (isFav ? ' active' : '') + '" data-project-id="' + escapeHtml(mod.id) + '" onclick="event.stopPropagation(); showFavSelectDropdown(\'' + escapeOnclick(mod.id) + '\', this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg></button>' +
                        '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openModDetail(\'' + mod.id + '\', \'' + mod.source + '\')">安装</button>' +
                    '</div>' +
                '</div>';
            }).join('');
        }

        updateModPagination();
    } catch (e) {
        container.innerHTML = '<p class="empty-text">加载失败</p>';
    }
}

function updateModPagination() {
    const pagination = document.getElementById('mod-pagination');
    const currentPage = Math.floor(modSearchOffset / 15) + 1;
    const totalPages = Math.max(1, Math.ceil(modSearchTotal / 15));

    pagination.style.display = 'flex';
    document.getElementById('mod-page-info').textContent = `${currentPage}/${totalPages}`;
    document.getElementById('mod-prev-btn').disabled = modSearchOffset <= 0;
    document.getElementById('mod-next-btn').disabled = modSearchOffset + 15 >= modSearchTotal;
}

async function loadFeaturedMods() {
    modSearchQuery = '';
    modSearchOffset = 0;
    await loadMods();
}

async function searchMods() {
    modSearchOffset = 0;
    await loadMods();
}

async function loadFavoritesData() {
    try {
        _favorites = await API.getFavorites();
        console.log('[Fav] loaded favorites:', _favorites.length, _favorites);
        if (_favorites.length > 0 && !_currentFavId) {
            _currentFavId = _favorites[0].id;
        }
        renderFavFolderSelect();
    } catch (e) {
        console.error('[Fav] 加载收藏夹失败:', e);
        _favorites = [{ name: '默认', id: 'default', favs: [], notes: {} }];
    }
}

function renderFavFolderSelect() {
    var sel = document.getElementById('fav-folder-select');
    if (sel) {
        sel.innerHTML = _favorites.map(function(f) {
            return '<option value="' + f.id + '"' + (f.id === _currentFavId ? ' selected' : '') + '>' + escapeHtml(f.name) + ' (' + f.favs.length + ')</option>';
        }).join('');
        sel.onchange = function() {
            _currentFavId = sel.value;
            _favSelectedItems.clear();
            _favMultiSelectMode = false;
            renderFavPage();
        };
    }
    var subSel = document.getElementById('fav-sub-folder-select');
    if (subSel) {
        subSel.innerHTML = _favorites.map(function(f) {
            return '<option value="' + escapeHtml(f.id) + '"' + (f.id === (_favSubCurrentFavId || _currentFavId) ? ' selected' : '') + '>' + escapeHtml(f.name) + ' (' + (f.favs ? f.favs.length : 0) + ')</option>';
        }).join('');
    }
}

async function renderFavPage() {
    var content = document.getElementById('fav-content');
    var empty = document.getElementById('fav-empty');
    if (!content || !empty) return;

    var currentFav = _favorites.find(function(f) { return f.id === _currentFavId; });
    if (!currentFav || !currentFav.favs || currentFav.favs.length === 0) {
        content.style.display = 'none';
        empty.style.display = 'block';
        return;
    }
    content.style.display = 'block';
    empty.style.display = 'none';

    content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    try {
        var projectIds = currentFav.favs;
        var projects = await fetchFavProjects(projectIds);
        var filtered = _favSearchQuery
            ? projects.filter(function(p) {
                return (p.title || '').toLowerCase().includes(_favSearchQuery.toLowerCase()) ||
                    (p.description || '').toLowerCase().includes(_favSearchQuery.toLowerCase());
              })
            : projects;

        if (filtered.length === 0) {
            content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)"><p>' + (_favSearchQuery ? '没有找到匹配的收藏' : '收藏夹为空') + '</p></div>';
            return;
        }

        var grouped = {};
        filtered.forEach(function(p) {
            var type = p.projectType || p.source || 'mod';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(p);
        });

        var typeLabels = { mod: 'Mod', modpack: '整合包', resourcepack: '资源包', shader: '光影', datapack: '数据包' };
        var html = '';
        Object.keys(grouped).forEach(function(type) {
            var items = grouped[type];
            html += '<div class="fav-category-title">' + (typeLabels[type] || type) + ' (' + items.length + ')</div>';
            items.forEach(function(p) {
                var isChecked = _favSelectedItems.has(p.id);
                var note = currentFav.notes && currentFav.notes[p.id] ? currentFav.notes[p.id] : '';
                html += '<div class="fav-item" data-id="' + escapeHtml(p.id) + '" onclick="openFavItemDetail(\'' + escapeOnclick(p.id) + '\', \'' + escapeOnclick(p.source || 'modrinth') + '\')">';
                if (_favMultiSelectMode) {
                    html += '<input type="checkbox" class="fav-item-checkbox"' + (isChecked ? ' checked' : '') + ' onclick="event.stopPropagation(); toggleFavItemSelect(\'' + escapeOnclick(p.id) + '\')">';
                }
                if (p.icon) {
                    html += '<img class="fav-item-icon" src="' + escapeHtml(p.icon) + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="fav-item-icon-placeholder" style="display:none">' + escapeHtml((p.title||'?')[0]) + '</div>';
                } else {
                    html += '<div class="fav-item-icon-placeholder">' + escapeHtml((p.title||'?')[0]) + '</div>';
                }
                html += '<div class="fav-item-info"><div class="fav-item-name">' + escapeHtml(p.title || p.id) + '</div><div class="fav-item-desc">' + escapeHtml(p.description || '') + '</div>';
                if (note) {
                    html += '<div class="fav-item-note">' + escapeHtml(note) + '</div>';
                }
                html += '</div>';
                html += '<span class="fav-item-type">' + (typeLabels[type] || type) + '</span>';
                html += '<div class="fav-item-actions">';
                html += '<button class="btn-icon" title="编辑备注" onclick="event.stopPropagation(); editFavNote(\'' + escapeOnclick(p.id) + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
                html += '<button class="btn-icon fav-remove" title="取消收藏" onclick="event.stopPropagation(); removeFavItem(\'' + escapeOnclick(p.id) + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
                html += '</div></div>';
            });
        });
        content.innerHTML = html;
    } catch (e) {
        content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)"><p>加载失败: ' + escapeHtml(e.message) + '</p></div>';
    }
}

async function fetchFavProjects(projectIds) {
    var results = [];
    var batchSize = 10;
    for (var i = 0; i < projectIds.length; i += batchSize) {
        var batch = projectIds.slice(i, i + batchSize);
        var promises = batch.map(async function(id) {
            try {
                var detail = await API.getModDetail(id, 'modrinth');
                return Object.assign({}, detail, { source: 'modrinth' });
            } catch (e) {
                return { id: id, title: id, description: '加载失败', source: 'modrinth', projectType: 'mod' };
            }
        });
        var batchResults = await Promise.all(promises);
        results.push.apply(results, batchResults);
    }
    return results;
}

function openFavItemDetail(projectId, source) {
    if (_favMultiSelectMode) {
        toggleFavItemSelect(projectId);
        return;
    }
    openModDetail(projectId, source);
}

var _favSubMultiSelect = false;
var _favSubSelected = new Set();
var _favSubSearchQuery = '';
var _favSubCurrentFavId = null;

function enterFavSubPage() {
    var browseSection = document.getElementById('mod-browse-section');
    var favSection = document.getElementById('mod-fav-section');
    if (!browseSection || !favSection) return;
    browseSection.style.display = 'none';
    favSection.style.display = 'block';
    _favSubCurrentFavId = _currentFavId;
    populateFavSubFolderSelect();
    renderFavSubList();
}

function exitFavSubPage() {
    var browseSection = document.getElementById('mod-browse-section');
    var favSection = document.getElementById('mod-fav-section');
    if (!browseSection || !favSection) return;
    favSection.style.display = 'none';
    browseSection.style.display = 'block';
    _favSubMultiSelect = false;
    _favSubSelected.clear();
    _favSubSearchQuery = '';
}

function populateFavSubFolderSelect() {
    var sel = document.getElementById('fav-sub-folder-select');
    if (!sel) return;
    sel.innerHTML = _favorites.map(function(f) {
        return '<option value="' + escapeHtml(f.id) + '"' + (f.id === _favSubCurrentFavId ? ' selected' : '') + '>' + escapeHtml(f.name) + ' (' + (f.favs ? f.favs.length : 0) + ')</option>';
    }).join('');
}

function onFavSubFolderChange(favId) {
    _favSubCurrentFavId = favId;
    _currentFavId = favId;
    _favSubSelected.clear();
    renderFavSubFolderSelect();
    renderFavSubList();
}

function renderFavSubFolderSelect() {
    populateFavSubFolderSelect();
}

function onFavSubSearch(query) {
    _favSubSearchQuery = query;
    renderFavSubList();
}

async function renderFavSubList() {
    var list = document.getElementById('fav-sub-list');
    var empty = document.getElementById('fav-sub-empty');
    if (!list || !empty) return;

    var currentFav = _favorites.find(function(f) { return f.id === _favSubCurrentFavId; });
    if (!currentFav || !currentFav.favs || currentFav.favs.length === 0) {
        list.style.display = 'none';
        empty.style.display = 'block';
        return;
    }
    list.style.display = '';
    empty.style.display = 'none';
    list.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    try {
        var projects = await fetchFavProjects(currentFav.favs);
        var filtered = _favSubSearchQuery
            ? projects.filter(function(p) {
                return (p.title || '').toLowerCase().includes(_favSubSearchQuery.toLowerCase()) ||
                    (p.description || '').toLowerCase().includes(_favSubSearchQuery.toLowerCase());
              })
            : projects;

        if (filtered.length === 0) {
            list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)"><p>' + (_favSubSearchQuery ? '没有找到匹配的收藏' : '收藏夹为空') + '</p></div>';
            return;
        }

        list.innerHTML = filtered.map(function(p) {
            var isFav = _favorites.some(function(f) { return f.favs.includes(p.id); });
            var isChecked = _favSubSelected.has(p.id);
            var source = p.source || 'modrinth';
            return '<div class="mod-item mod-item-clickable' + (_favSubMultiSelect ? ' mod-multiselect-active' : '') + '" onclick="openModDetail(\'' + escapeOnclick(p.id) + '\', \'' + escapeOnclick(source) + '\')">' +
                (_favSubMultiSelect ? '<div class="mod-checkbox' + (isChecked ? ' checked' : '') + '" data-mod-id="' + escapeHtml(p.id) + '" onclick="event.stopPropagation();toggleFavSubItemSelect(\'' + escapeOnclick(p.id) + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>' : '') +
                '<div class="mod-icon"><img src="' + escapeHtml(p.icon || '') + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.classList.add(\'mod-icon--fallback\')"></div>' +
                '<div class="mod-info">' +
                    '<div class="mod-name">' + escapeHtml(formatModNameWithChinese(p.slug || p.id, p.title)) + '</div>' +
                    '<div class="mod-desc">' + escapeHtml(p.description || '') + '</div>' +
                    '<div class="mod-meta">' +
                        '<span>\u2B07 ' + formatNumber(p.downloads || 0) + '</span>' +
                        '<span>\u2764 ' + escapeHtml(p.author || '') + '</span>' +
                        '<span>' + (p.categories || []).slice(0, 3).join(', ') + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="mod-actions" onclick="event.stopPropagation()">' +
                    '<button class="fav-heart-btn active" data-project-id="' + escapeHtml(p.id) + '" onclick="event.stopPropagation(); showFavSelectDropdown(\'' + escapeOnclick(p.id) + '\', this)"><svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg></button>' +
                    '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openModDetail(\'' + escapeOnclick(p.id) + '\', \'' + escapeOnclick(source) + '\')">安装</button>' +
                '</div>' +
            '</div>';
        }).join('');
    } catch (e) {
        list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)"><p>加载失败: ' + escapeHtml(e.message) + '</p></div>';
    }
}

function toggleFavSubMultiSelect() {
    _favSubMultiSelect = !_favSubMultiSelect;
    _favSubSelected.clear();
    var bar = document.getElementById('fav-sub-multi-bar');
    var toggle = document.getElementById('fav-sub-multi-toggle');
    if (bar) bar.style.display = _favSubMultiSelect ? 'flex' : 'none';
    if (toggle) toggle.textContent = _favSubMultiSelect ? '取消多选' : '多选';
    updateFavSubMultiBar();
    renderFavSubList();
}

function toggleFavSubItemSelect(projectId) {
    if (_favSubSelected.has(projectId)) {
        _favSubSelected.delete(projectId);
    } else {
        _favSubSelected.add(projectId);
    }
    updateFavSubMultiBar();
    var checkbox = document.querySelector('.mod-checkbox[data-mod-id="' + projectId + '"]');
    if (checkbox) checkbox.classList.toggle('checked', _favSubSelected.has(projectId));
}

function toggleFavSubSelectAll(checked) {
    var currentFav = _favorites.find(function(f) { return f.id === _favSubCurrentFavId; });
    if (!currentFav) return;
    _favSubSelected.clear();
    if (checked) {
        currentFav.favs.forEach(function(id) { _favSubSelected.add(id); });
    }
    updateFavSubMultiBar();
    document.querySelectorAll('#fav-sub-list .mod-checkbox').forEach(function(cb) {
        cb.classList.toggle('checked', _favSubSelected.has(cb.getAttribute('data-mod-id')));
    });
}

function updateFavSubMultiBar() {
    var countEl = document.getElementById('fav-sub-selected-count');
    var removeBtn = document.getElementById('fav-sub-batch-remove');
    var downloadBtn = document.getElementById('fav-sub-batch-download');
    if (countEl) countEl.textContent = '已选 ' + _favSubSelected.size + ' 个';
    if (removeBtn) removeBtn.disabled = _favSubSelected.size === 0;
    if (downloadBtn) downloadBtn.disabled = _favSubSelected.size === 0;
}

async function batchRemoveFavSub() {
    if (_favSubSelected.size === 0) return;
    if (!confirm('确定取消收藏选中的 ' + _favSubSelected.size + ' 个项目？')) return;
    try {
        for (var projectId of _favSubSelected) {
            await API.removeFromFavorite(_favSubCurrentFavId, projectId);
            var fav = _favorites.find(function(f) { return f.id === _favSubCurrentFavId; });
            if (fav) fav.favs = fav.favs.filter(function(id) { return id !== projectId; });
        }
        _favSubSelected.clear();
        updateFavSubMultiBar();
        showToast('已取消收藏', 'success');
        renderFavSubList();
        renderFavFolderSelect();
    } catch (e) {
        showToast('操作失败', 'error');
    }
}

async function batchDownloadFavSub() {
    if (_favSubSelected.size === 0) return;
    try {
        var projects = await fetchFavProjects(Array.from(_favSubSelected));
        projects.forEach(function(p) {
            if (p.id) quickInstallMod(p.id, p.source || 'modrinth', '', '');
        });
        showToast('已开始下载 ' + _favSubSelected.size + ' 个模组', 'success');
    } catch (e) {
        showToast('批量下载失败', 'error');
    }
}

function toggleFavItemSelect(projectId) {
    if (_favSelectedItems.has(projectId)) {
        _favSelectedItems.delete(projectId);
    } else {
        _favSelectedItems.add(projectId);
    }
    updateFavSelectUI();
    var cb = document.querySelector('.fav-item[data-id="' + CSS.escape(projectId) + '"] .fav-item-checkbox');
    if (cb) cb.checked = _favSelectedItems.has(projectId);
}

function toggleFavMultiSelect() {
    _favMultiSelectMode = !_favMultiSelectMode;
    _favSelectedItems.clear();
    var bar = document.getElementById('fav-multiselect-bar');
    if (bar) bar.style.display = _favMultiSelectMode ? 'flex' : 'none';
    var btn = document.getElementById('fav-multiselect-toggle');
    if (btn) btn.classList.toggle('active', _favMultiSelectMode);
    renderFavPage();
}

function toggleFavSelectAll(checked) {
    var currentFav = _favorites.find(function(f) { return f.id === _currentFavId; });
    if (!currentFav) return;
    _favSelectedItems.clear();
    if (checked) currentFav.favs.forEach(function(id) { _favSelectedItems.add(id); });
    updateFavSelectUI();
    renderFavPage();
}

function updateFavSelectUI() {
    var count = _favSelectedItems.size;
    var countEl = document.getElementById('fav-selected-count');
    if (countEl) countEl.textContent = '已选 ' + count + ' 个';
    var removeBtn = document.getElementById('fav-batch-remove-btn');
    if (removeBtn) removeBtn.disabled = count === 0;
    var downloadBtn = document.getElementById('fav-batch-download-btn');
    if (downloadBtn) downloadBtn.disabled = count === 0;
}

async function removeFavItem(projectId) {
    if (!_currentFavId) return;
    try {
        await API.removeFromFavorite(_currentFavId, projectId);
        var fav = _favorites.find(function(f) { return f.id === _currentFavId; });
        if (fav) fav.favs = fav.favs.filter(function(id) { return id !== projectId; });
        renderFavFolderSelect();
        renderFavPage();
        updateFavHeartButtons();
        showToast('已取消收藏', 'success');
    } catch (e) {
        showToast('操作失败', 'error');
    }
}

async function batchRemoveFavorites() {
    if (_favSelectedItems.size === 0) return;
    var count = _favSelectedItems.size;
    if (!confirm('确定要取消收藏 ' + count + ' 个项目吗？')) return;
    try {
        var idsToRemove = Array.from(_favSelectedItems);
        for (var i = 0; i < idsToRemove.length; i++) {
            await API.removeFromFavorite(_currentFavId, idsToRemove[i]);
        }
        var fav = _favorites.find(function(f) { return f.id === _currentFavId; });
        if (fav) fav.favs = fav.favs.filter(function(id) { return !_favSelectedItems.has(id); });
        _favSelectedItems.clear();
        updateFavSelectUI();
        renderFavFolderSelect();
        renderFavPage();
        updateFavHeartButtons();
        showToast('已取消 ' + count + ' 个收藏', 'success');
    } catch (e) {
        showToast('操作失败', 'error');
    }
}

async function editFavNote(projectId) {
    var currentFav = _favorites.find(function(f) { return f.id === _currentFavId; });
    if (!currentFav) return;
    var oldNote = currentFav.notes && currentFav.notes[projectId] ? currentFav.notes[projectId] : '';
    var note = prompt('编辑备注:', oldNote);
    if (note === null) return;
    try {
        await API.updateFavNote(_currentFavId, projectId, note);
        if (!currentFav.notes) currentFav.notes = {};
        if (note) currentFav.notes[projectId] = note;
        else delete currentFav.notes[projectId];
        renderFavPage();
        showToast('备注已更新', 'success');
    } catch (e) {
        showToast('操作失败', 'error');
    }
}

function showFavManageMenu() {
    closeFavMenus();
    var btn = event.currentTarget;
    var rect = btn.getBoundingClientRect();
    var menu = document.createElement('div');
    menu.className = 'fav-manage-menu';
    menu.id = 'fav-manage-menu-popup';
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    menu.innerHTML = '<div class="fav-manage-menu-item" onclick="createNewFavorite()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>新建收藏夹</div>' +
        '<div class="fav-manage-menu-item" onclick="renameCurrentFavorite()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>重命名当前收藏夹</div>' +
        '<div class="fav-manage-menu-item danger" onclick="deleteCurrentFavorite()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>删除当前收藏夹</div>';
    document.body.appendChild(menu);
    setTimeout(function() { document.addEventListener('click', closeFavMenusHandler, { once: true }); }, 0);
}

function closeFavMenus() {
    document.querySelectorAll('.fav-manage-menu, .fav-select-dropdown').forEach(function(el) { el.remove(); });
}

function closeFavMenusHandler(e) {
    if (!e.target.closest('.fav-manage-menu') && !e.target.closest('.fav-select-dropdown')) {
        closeFavMenus();
    }
}

async function createNewFavorite() {
    closeFavMenus();
    var name = prompt('请输入收藏夹名称:');
    if (!name) return;
    try {
        var result = await API.createFavorite(name);
        if (result && result.favorite) {
            _favorites.push(result.favorite);
            _currentFavId = result.favorite.id;
            renderFavFolderSelect();
            renderFavPage();
            showToast('收藏夹已创建', 'success');
        }
    } catch (e) {
        showToast('创建失败', 'error');
    }
}

async function renameCurrentFavorite() {
    closeFavMenus();
    var fav = _favorites.find(function(f) { return f.id === _currentFavId; });
    if (!fav) return;
    var name = prompt('请输入新名称:', fav.name);
    if (!name || name === fav.name) return;
    try {
        await API.renameFavorite(_currentFavId, name);
        fav.name = name;
        renderFavFolderSelect();
        showToast('重命名成功', 'success');
    } catch (e) {
        showToast('重命名失败', 'error');
    }
}

async function deleteCurrentFavorite() {
    closeFavMenus();
    if (_favorites.length <= 1) {
        showToast('至少保留一个收藏夹', 'error');
        return;
    }
    var fav = _favorites.find(function(f) { return f.id === _currentFavId; });
    if (!fav) return;
    if (!confirm('确定要删除收藏夹"' + fav.name + '"吗？')) return;
    try {
        await API.deleteFavorite(_currentFavId);
        _favorites = _favorites.filter(function(f) { return f.id !== _currentFavId; });
        _currentFavId = _favorites.length > 0 ? _favorites[0].id : '';
        renderFavFolderSelect();
        renderFavPage();
        showToast('收藏夹已删除', 'success');
    } catch (e) {
        showToast('删除失败', 'error');
    }
}

function exportCurrentFav() {
    var fav = _favorites.find(function(f) { return f.id === _currentFavId; });
    if (!fav) return;
    var data = JSON.stringify(fav.favs);
    navigator.clipboard.writeText(data).then(function() {
        showToast('已复制到剪贴板', 'success');
    }).catch(function() {
        prompt('复制以下内容:', data);
    });
}

function showFavImportModal() {
    var data = prompt('请粘贴收藏分享码:');
    if (!data) return;
    importFavData(data);
}

async function importFavData(data) {
    try {
        var result = await API.importFavorite(data, _currentFavId);
        if (result && result.success) {
            await loadFavoritesData();
            renderFavPage();
            showToast('已导入 ' + result.imported + ' 个项目', 'success');
        }
    } catch (e) {
        showToast('导入失败: ' + e.message, 'error');
    }
}

async function batchDownloadFavorites() {
    if (_favSelectedItems.size === 0) return;
    var ids = Array.from(_favSelectedItems);
    showToast('正在准备下载 ' + ids.length + ' 个模组...', 'info');
    for (var i = 0; i < ids.length; i++) {
        try {
            const result = await API.downloadMod(ids[i], 'modrinth', '', '');
            if (result.success && result.sessionId) {
                showModDownloadModal(result.fileName, result.sessionId, result.path || '');
            }
        } catch (e) {
            console.error('下载失败:', ids[i], e);
        }
    }
    showToast('批量下载已启动', 'success');
}

function updateFavHeartButtons() {
    document.querySelectorAll('.fav-heart-btn').forEach(function(btn) {
        var projectId = btn.dataset.projectId;
        if (!projectId) return;
        var isFav = _favorites.some(function(f) { return f.favs.includes(projectId); });
        btn.classList.toggle('active', isFav);
    });
}

function showFavSelectDropdown(projectId, anchorEl) {
    closeFavMenus();
    console.log('[Fav] showFavSelectDropdown called:', projectId, '_favorites:', _favorites.length, _favorites);
    var rect = anchorEl.getBoundingClientRect();
    var dropdown = document.createElement('div');
    dropdown.className = 'fav-select-dropdown';
    dropdown.id = 'fav-select-dropdown-popup';
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.left = Math.min(rect.left, window.innerWidth - 220) + 'px';

    var isFavInAny = _favorites.some(function(f) { return f.favs.includes(projectId); });
    var innerHtml = '';
    if (isFavInAny) {
        innerHtml += '<div class="fav-select-item" style="color:var(--red)" onclick="removeFromAllFavs(\'' + escapeOnclick(projectId) + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>取消所有收藏</div>';
    }

    _favorites.forEach(function(f) {
        var has = f.favs.includes(projectId);
        innerHtml += '<div class="fav-select-item' + (has ? ' active' : '') + '" onclick="toggleFavForProject(\'' + escapeOnclick(f.id) + '\', \'' + escapeOnclick(projectId) + '\', ' + has + ')">';
        if (has) {
            innerHtml += '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>';
        } else {
            innerHtml += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>';
        }
        innerHtml += (has ? '取消收藏 ' : '收藏到 ') + escapeHtml(f.name) + '</div>';
    });
    dropdown.innerHTML = innerHtml;
    document.body.appendChild(dropdown);
    console.log('[Fav] dropdown appended, items:', _favorites.length, 'innerHTML length:', innerHtml.length);
    setTimeout(function() { document.addEventListener('click', closeFavMenusHandler, { once: true }); }, 0);
}

async function toggleFavForProject(favId, projectId, isRemove) {
    closeFavMenus();
    try {
        if (isRemove) {
            await API.removeFromFavorite(favId, projectId);
            var fav = _favorites.find(function(f) { return f.id === favId; });
            if (fav) fav.favs = fav.favs.filter(function(id) { return id !== projectId; });
            showToast('已取消收藏', 'success');
        } else {
            await API.addToFavorite(favId, projectId);
            var fav2 = _favorites.find(function(f) { return f.id === favId; });
            if (fav2 && !fav2.favs.includes(projectId)) fav2.favs.push(projectId);
            showToast('已添加到收藏夹', 'success');
        }
        renderFavFolderSelect();
        updateFavHeartButtons();
        if (document.getElementById('page-mod-favorites') && document.getElementById('page-mod-favorites').classList.contains('active')) {
            renderFavPage();
        }
        if (document.getElementById('mod-fav-section') && document.getElementById('mod-fav-section').style.display !== 'none') {
            renderFavSubList();
        }
    } catch (e) {
        showToast('操作失败', 'error');
    }
}

async function removeFromAllFavs(projectId) {
    closeFavMenus();
    try {
        for (var i = 0; i < _favorites.length; i++) {
            var fav = _favorites[i];
            if (fav.favs.includes(projectId)) {
                await API.removeFromFavorite(fav.id, projectId);
                fav.favs = fav.favs.filter(function(id) { return id !== projectId; });
            }
        }
        renderFavFolderSelect();
        updateFavHeartButtons();
        if (document.getElementById('mod-fav-section') && document.getElementById('mod-fav-section').style.display !== 'none') {
            renderFavSubList();
        }
        showToast('已取消所有收藏', 'success');
    } catch (e) {
        showToast('操作失败', 'error');
    }
}

function setupFavSearchListeners() {
    var searchBtn = document.getElementById('fav-search-btn');
    var searchInput = document.getElementById('fav-search-input');
    if (searchBtn) {
        searchBtn.addEventListener('click', function() {
            _favSearchQuery = searchInput ? searchInput.value : '';
            renderFavPage();
        });
    }
    if (searchInput) {
        searchInput.addEventListener('keyup', function(e) {
            if (e.key === 'Enter' && !e.isComposing) {
                _favSearchQuery = e.target.value;
                renderFavPage();
            }
        });
    }
}

let currentModDetailData = null;
let mdAllVersions = [];
let mdCurrentTab = '';
let currentModDetailType = 'mod';
let mdCurrentDeps = [];
let mdDepsResolved = {};
let mdDepsVersionInfo = {};
let _modDetailSeq = 0;
class LRUCache {
    constructor(maxSize) {
        this._max = maxSize;
        this._map = new Map();
    }
    has(key) { return this._map.has(key); }
    get(key) {
        if (!this._map.has(key)) return undefined;
        const val = this._map.get(key);
        this._map.delete(key);
        this._map.set(key, val);
        return val;
    }
    set(key, val) {
        if (this._map.has(key)) this._map.delete(key);
        this._map.set(key, val);
        if (this._map.size > this._max) {
            const oldest = this._map.keys().next().value;
            this._map.delete(oldest);
        }
    }
    delete(key) { this._map.delete(key); }
    clear() { this._map.clear(); }
    get size() { return this._map.size; }
}

const _projectDataCache = new LRUCache(200);
const _versionPreloadCache = new LRUCache(100);
let _versionPreloadInFlight = new Set();

function preloadModVersions(projectId, source) {
    if (_versionPreloadCache.has(projectId) || _versionPreloadInFlight.has(projectId)) return;
    _versionPreloadInFlight.add(projectId);
    API.getModVersions(projectId, source || 'modrinth').then(data => {
        _versionPreloadCache.set(projectId, data);
        _versionPreloadInFlight.delete(projectId);
        console.log('[Preload] Versions cached for', projectId);
    }).catch(() => { _versionPreloadInFlight.delete(projectId); });
}

async function getInstalledVersionInfo() {
    try {
        const settings = await API.getSettings().catch(() => ({}));
        const selectedVersion = settings.selectedVersion || '';
        if (!selectedVersion) return { gameVersion: '', loaderType: '', versionId: '' };

        const versionInfo = installedVersions.find(v => v.id === selectedVersion);
        let gameVersion = '';
        if (versionInfo && versionInfo.baseVersion) {
            gameVersion = versionInfo.baseVersion;
        } else if (versionInfo && versionInfo.inheritsFrom) {
            gameVersion = versionInfo.inheritsFrom;
        } else {
            gameVersion = selectedVersion.split('-')[0];
        }

        let loaderType = '';
        if (versionInfo) {
            if (versionInfo.isFabric) loaderType = 'fabric';
            else if (versionInfo.isForge) loaderType = 'forge';
            else if (versionInfo.isNeoForge) loaderType = 'neoforge';
        }

        return { gameVersion, loaderType, versionId: selectedVersion };
    } catch (e) {
        return { gameVersion: '', loaderType: '', versionId: '' };
    }
}

function _renderModDetailHeader(detail, source, projectId) {
    currentModDetailData = detail;
    const modTitle = formatModNameWithChinese(detail.slug || detail.id, detail.title || '未知模组');
    const mdName = document.getElementById('md-name');
    const mdDesc = document.getElementById('md-desc');
    const mdIconImg = document.getElementById('md-icon-img');
    const mdIconFallback = document.getElementById('md-icon-fallback');
    if (mdName) mdName.textContent = modTitle;
    if (mdDesc) mdDesc.textContent = (detail.description || '').substring(0, 200);
    if (detail.icon && mdIconImg && mdIconFallback) {
        mdIconImg.src = detail.icon; mdIconImg.style.display = ''; mdIconFallback.style.display = 'none';
    } else if (mdIconImg && mdIconFallback) {
        mdIconImg.style.display = 'none'; mdIconFallback.textContent = modTitle.charAt(0).toUpperCase(); mdIconFallback.style.display = '';
    }
    const mdDownloads = document.getElementById('md-downloads');
    const mdFollowers = document.getElementById('md-followers');
    const mdUpdated = document.getElementById('md-updated');
    const srcBadge = document.getElementById('md-source-badge');
    if (mdDownloads) mdDownloads.textContent = `⬇ ${formatNumber(detail.downloads || 0)}`;
    if (mdFollowers) mdFollowers.textContent = `❤ ${formatNumber(detail.followers || 0)}`;
    if (mdUpdated) { const u = detail.dateModified ? formatDate(detail.dateModified) : ''; mdUpdated.textContent = u ? `🕐 更新于 ${u}` : ''; }
    if (srcBadge) {
        if (source === 'curseforge') { srcBadge.textContent = 'CurseForge'; srcBadge.style.color = '#f97316'; srcBadge.style.background = 'rgba(249,115,22,0.12)'; }
        else { srcBadge.textContent = 'Modrinth'; srcBadge.style.color = '#a855f7'; srcBadge.style.background = 'rgba(168,85,247,0.12)'; }
    }
    var mdFavBtn = document.getElementById('md-fav-btn');
    if (mdFavBtn) {
        var isFav = _favorites.some(function(f) { return f.favs.includes(projectId); });
        if (isFav) { mdFavBtn.classList.remove('btn-secondary'); mdFavBtn.classList.add('btn-primary'); mdFavBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> 已收藏'; }
        else { mdFavBtn.classList.remove('btn-primary'); mdFavBtn.classList.add('btn-secondary'); mdFavBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> 收藏'; }
    }
}

async function openModDetail(projectId, source) {
    console.log('[ModDetail] Opening mod detail for:', projectId, 'source:', source);
    const mySeq = ++_modDetailSeq;
    currentModDetailId = projectId;
    currentModDetailSource = source || 'modrinth';
    currentModDetailType = 'mod';

    navigateToPage('mod-detail');

    const backBtn = document.querySelector('#page-mod-detail .moddetail-page-header .btn-icon');
    if (backBtn) backBtn.setAttribute('onclick', 'goBackFromDetail()');

    const mdVersionList = document.getElementById('md-version-list');
    const mdVersionTabs = document.getElementById('md-version-tabs');

    if (!mdVersionList) { console.error('[ModDetail] Required elements not found'); return; }

    const cached = _projectDataCache.get(projectId);
    const hasPreloaded = _versionPreloadCache.has(projectId);
    if (cached) {
        console.log('[ModDetail] Cache hit, rendering immediately');
        _renderModDetailHeader(cached, source, projectId);
    } else {
        const mdName = document.getElementById('md-name');
        if (mdName) mdName.textContent = '加载中...';
    }

    let _loadingTimer = null;
    if (!hasPreloaded) {
        _loadingTimer = setTimeout(() => {
            if (mdVersionList && !mdVersionList.querySelector('.mdv-group')) {
                mdVersionList.innerHTML = '<p class="empty-text" style="padding:30px 0;text-align:center;color:var(--text-muted)">加载版本列表...</p>';
            }
        }, 400);
    }
    if (mdVersionTabs) mdVersionTabs.innerHTML = '';

    try {
        const versionsPromise = hasPreloaded
            ? Promise.resolve(_versionPreloadCache.get(projectId))
            : API.getModVersions(projectId, source).catch(e => { console.error('[ModDetail] getModVersions failed:', e); return null; });
        _versionPreloadCache.delete(projectId);
        const detailPromise = cached ? Promise.resolve(cached) : API.getModDetail(projectId, source).catch(e => { console.error('[ModDetail] getModDetail failed:', e); return null; });

        const [detail, versionsData] = await Promise.all([detailPromise, versionsPromise]);
        if (_loadingTimer) { clearTimeout(_loadingTimer); _loadingTimer = null; }
        if (mySeq !== _modDetailSeq) { console.log('[ModDetail] Aborted (stale)'); return; }
        if (!detail) {
            const mdName = document.getElementById('md-name');
            if (mdName) mdName.textContent = '加载失败';
            mdVersionList.innerHTML = `<p class="empty-text" style="padding:30px 0;text-align:center;color:var(--text-muted)">无法加载模组详情: API请求失败，请检查网络连接</p>`;
            return;
        }
        if (!cached) {
            _projectDataCache.set(projectId, detail);
            _renderModDetailHeader(detail, source, projectId);
        }

        mdAllVersions = versionsData ? (versionsData.versions || []) : [];
        if (!Array.isArray(mdAllVersions)) mdAllVersions = [];
        loadModDependencies();
        await renderMdVersionTabs(mySeq);
        console.log('[ModDetail] Done, versions:', mdAllVersions.length);
    } catch (e) {
        if (mySeq !== _modDetailSeq) return;
        console.error('[ModDetail] Error:', e);
        const mdName = document.getElementById('md-name');
        if (mdName) mdName.textContent = '加载失败';
        mdVersionList.innerHTML = `<p class="empty-text" style="padding:30px 0;text-align:center;color:var(--text-muted)">无法加载模组详情: ${escapeHtml(e.message || String(e))}</p>`;
    }
}

function _versionToExact(ver) {
    if (!ver) return null;
    var base = ver.split('-')[0];
    if (ver.includes('w') || ver.includes('snapshot')) return '快照版';
    var m = base.match(/^(\d+\.\d+(?:\.\d+)?)/);
    return m ? m[1] : null;
}

function _versionToMajor(ver) {
    if (!ver) return null;
    if (ver.includes('w') || ver.includes('snapshot')) return '快照版';
    var base = ver.split('-')[0];
    var parts = base.split('.');
    if (parts.length < 2) return null;
    var major = parseInt(parts[0], 10);
    var minor = parseInt(parts[1], 10);
    if (major === 1 && minor >= 14) return '1.' + minor;
    if (major >= 25) return major + '.' + minor;
    return null;
}

function _renderVersionTabs(mode, tabMap, sortedKeys) {
    const tabsContainer = document.getElementById('md-version-tabs');
    let tabsHtml = '<button class="md-vtab active" data-ver="" onclick="switchMdVersionTab(\'\')">全部</button>';
    sortedKeys.forEach(key => {
        tabsHtml += `<button class="md-vtab" data-group="${mode}" data-ver="${escapeHtml(key)}" onclick="switchMdVersionTab('${escapeOnclick(key)}', '${mode}')">${escapeHtml(key)} (${tabMap.get(key)})</button>`;
    });
    if (tabsContainer) tabsContainer.innerHTML = tabsHtml;
}

function renderMdVersionTabs(detailSeq) {
    if (detailSeq !== undefined && detailSeq !== _modDetailSeq) { console.log('[MDVersions] Aborted (stale)'); return; }

    const tabsContainer = document.getElementById('md-version-tabs');
    const currentGameVersion = getCustomSelectValue('mod-filter-version');
    const currentLoader = getCustomSelectValue('mod-filter-loader');

    if (currentGameVersion || currentLoader) {
        const filtered = mdAllVersions.filter(v => {
            const gv = v.gameVersions || [];
            const loaders = (v.loaders || []).map(l => l.toLowerCase());
            let match = true;
            if (currentGameVersion && !gv.includes(currentGameVersion)) match = false;
            if (currentLoader && !loaders.includes(currentLoader.toLowerCase())) match = false;
            return match;
        });
        if (tabsContainer) {
            tabsContainer.innerHTML = `<button class="md-vtab active" data-ver="_filtered" onclick="switchMdVersionTab('_filtered')">筛选结果 (${filtered.length})</button><button class="md-vtab" data-ver="" onclick="switchMdVersionTab('')">全部 (${mdAllVersions.length})</button>`;
        }
        renderMdVersionList(filtered);
    } else {
        const exactMap = new Map();
        const majorMap = new Map();
        let hasSnapshot = false;
        mdAllVersions.forEach(v => {
            (v.gameVersions || []).forEach(gv => {
                if (gv.includes('w') || gv.includes('snapshot')) { hasSnapshot = true; return; }
                const exact = _versionToExact(gv);
                const major = _versionToMajor(gv);
                if (exact) exactMap.set(exact, (exactMap.get(exact) || 0) + 1);
                if (major) majorMap.set(major, (majorMap.get(major) || 0) + 1);
            });
        });

        const MAX_TABS = 9;
        let mode = 'exact';
        let tabMap = exactMap;
        if (tabMap.size > MAX_TABS) { mode = 'major'; tabMap = majorMap; }
        if (tabMap.size > MAX_TABS) { mode = 'major'; tabMap = majorMap; }

        const sortFn = (a, b) => {
            if (a === '快照版') return -1;
            if (b === '快照版') return 1;
            const pa = a.split('.').map(Number);
            const pb = b.split('.').map(Number);
            if (pa[0] !== pb[0]) return pb[0] - pa[0];
            return (pb[1] || 0) - (pa[1] || 0);
        };
        const sortedKeys = [...tabMap.keys()].sort(sortFn);

        if (tabsContainer) {
            let tabsHtml = '<button class="md-vtab active" data-ver="" onclick="switchMdVersionTab(\'\')">全部</button>';
            sortedKeys.forEach(key => {
                tabsHtml += `<button class="md-vtab" data-group="${mode}" data-ver="${escapeHtml(key)}" onclick="switchMdVersionTab('${escapeOnclick(key)}', '${mode}')">${escapeHtml(key)}</button>`;
            });
            tabsContainer.innerHTML = tabsHtml;
        }
        window._mdTabMode = mode;
        renderMdVersionList(mdAllVersions);
    }
}

async function loadMdVersions(projectId, source, detailSeq) {
    try {
        const data = await API.getModVersions(projectId, source);
        if (detailSeq !== undefined && detailSeq !== _modDetailSeq) { console.log('[MDVersions] Aborted (stale)'); return; }
        mdAllVersions = data.versions || [];
        if (!Array.isArray(mdAllVersions)) mdAllVersions = [];

        loadModDependencies();
        await renderMdVersionTabs(detailSeq);
    } catch (e) {
        console.error('[MDVersions] Error:', e);
        document.getElementById('md-version-list').innerHTML = '<p class="empty-text" style="padding:30px 0;text-align:center;color:var(--text-muted)">加载版本列表失败</p>';
    }
}

function switchMdVersionTab(ver, mode) {
    mdCurrentTab = ver;
    
    document.querySelectorAll('.md-vtab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.ver === ver);
    });

    let filtered = mdAllVersions;
    if (ver && ver !== '') {
        if (ver === '_filtered') {
            const currentGameVersion = getCustomSelectValue('mod-filter-version');
            const currentLoader = getCustomSelectValue('mod-filter-loader');
            filtered = mdAllVersions.filter(v => {
                const gv = v.gameVersions || [];
                const loaders = (v.loaders || []).map(l => l.toLowerCase());
                let match = true;
                if (currentGameVersion && !gv.includes(currentGameVersion)) match = false;
                if (currentLoader && !loaders.includes(currentLoader.toLowerCase())) match = false;
                return match;
            });
        } else {
            const useMode = mode || window._mdTabMode || 'major';
            filtered = mdAllVersions.filter(v => {
                return (v.gameVersions || []).some(gv => {
                    if (useMode === 'exact') return _versionToExact(gv) === ver;
                    return _versionToMajor(gv) === ver;
                });
            });
        }
    }

    renderMdVersionList(filtered);
}

const mdDepsCache = new Map();
const MD_DEPS_CACHE_TTL = 5 * 60 * 1000;
const MD_DEPS_CACHE_MAX = 50;

function cleanupMdDepsCache() {
    const now = Date.now();
    for (const [key, entry] of mdDepsCache) {
        if (now - entry.time > MD_DEPS_CACHE_TTL) mdDepsCache.delete(key);
    }
    if (mdDepsCache.size > MD_DEPS_CACHE_MAX) {
        const entries = [...mdDepsCache.entries()].sort((a, b) => a[1].time - b[1].time);
        for (let i = 0; i < entries.length - MD_DEPS_CACHE_MAX; i++) mdDepsCache.delete(entries[i][0]);
    }
}
setInterval(cleanupMdDepsCache, 60000);

async function loadModDependencies() {
    const depsSection = document.getElementById('md-deps-section');
    const depsList = document.getElementById('md-deps-list');
    const depsCount = document.getElementById('md-deps-count');

    if (!depsSection || !depsList) return;

    const allDeps = new Map();
    mdAllVersions.forEach(v => {
        (v.dependencies || []).forEach(d => {
            if (d.projectId && !allDeps.has(d.projectId)) {
                allDeps.set(d.projectId, d);
            }
        });
    });

    const depArray = Array.from(allDeps.values());
    mdCurrentDeps = depArray;

    if (depArray.length === 0) {
        depsSection.style.display = 'none';
        return;
    }

    const requiredDeps = depArray.filter(d => d.dependencyType === 'required');
    depsSection.style.display = 'block';

    const verInfo = await getInstalledVersionInfo();
    const currentGameVersion = verInfo.gameVersion;
    const currentLoader = verInfo.loaderType;
    const hasVersionFilter = !!(currentGameVersion || currentLoader);

    if (!hasVersionFilter) {
        if (depsCount) depsCount.textContent = `(${requiredDeps.length} 必选, ${depArray.length - requiredDeps.length} 可选) — 请先选择游戏版本`;
    }

    const depIds = depArray.map(d => d.projectId).filter(Boolean);
    if (!depIds.length) {
        depsList.innerHTML = '';
        return;
    }

    const cacheKey = depIds.sort().join(',') + '|' + (currentGameVersion || '') + '|' + (currentLoader || '');
    const cached = mdDepsCache.get(cacheKey);
    if (cached && (Date.now() - cached.time < MD_DEPS_CACHE_TTL)) {
        mdDepsResolved = cached.resolved;
        mdDepsVersionInfo = cached.versionInfo;
        renderDepsList(depArray, cached.resolved, cached.versionInfo, hasVersionFilter, currentGameVersion, currentLoader, cached.installedMods, depsList, depsCount, requiredDeps);
        return;
    }

    depsList.innerHTML = depArray.map(d => {
        const depType = d.dependencyType || 'optional';
        const typeLabel = depType === 'required' ? '必选' : (depType === 'incompatible' ? '冲突' : '可选');
        const badgeClass = depType === 'required' ? 'required' : (depType === 'incompatible' ? 'incompatible' : 'optional');
        return `<div class="md-dep-item" id="md-dep-${escapeOnclick(d.projectId)}" onclick="openModDetail('${escapeOnclick(d.projectId)}', 'modrinth')">
            <div class="md-dep-icon"><div class="spinner" style="width:20px;height:20px;border-width:2px"></div></div>
            <div class="md-dep-info">
                <div class="md-dep-name" style="color:var(--text-muted)">加载中...</div>
            </div>
            <span class="md-dep-badge ${badgeClass}">${typeLabel}</span>
            <span class="md-dep-status not-installed">...</span>
        </div>`;
    }).join('');

    try {
        const [resolveResult, installedModsData] = await Promise.all([
            hasVersionFilter
                ? API.resolveDepVersions(depIds, currentGameVersion, currentLoader, 'modrinth')
                : API.resolveModDeps(depIds.join(',')).then(r => ({ _basic: r })),
            API.getInstalledMods().catch(() => []).then(r => Array.isArray(r) ? r : (r.mods || []))
        ]);

        let resolved = {};
        let versionInfo = {};

        if (hasVersionFilter) {
            versionInfo = resolveResult;
            mdDepsVersionInfo = versionInfo;
            for (const pid of depIds) {
                const info = versionInfo[pid] || {};
                resolved[pid] = {
                    id: info.id || pid,
                    title: info.title || pid,
                    slug: info.slug || '',
                    icon: info.icon || '',
                    description: info.description || '',
                    downloads: info.downloads || 0
                };
            }
            mdDepsResolved = resolved;

            const failedIds = depIds.filter(pid => {
                const r = resolved[pid];
                return !r || !r.title || r.title === pid;
            });
            if (failedIds.length > 0) {
                try {
                    const retryRes = await API.resolveDepVersions(failedIds, '', '', 'modrinth');
                    for (const pid of failedIds) {
                        const ri = retryRes[pid];
                        if (ri && ri.title && ri.title !== pid) {
                            resolved[pid] = { ...resolved[pid], ...ri };
                        }
                    }
                    mdDepsResolved = resolved;
                } catch (e) { console.warn('[ModInstall] 依赖检查失败:', e.message); }
            }

            const compatibleCount = requiredDeps.filter(d => versionInfo[d.projectId]?.hasCompatibleVersion).length;
            const incompatibleCount = requiredDeps.filter(d => !versionInfo[d.projectId]?.hasCompatibleVersion).length;
            if (depsCount) {
                let countText = `(${requiredDeps.length} 必选, ${depArray.length - requiredDeps.length} 可选)`;
                countText += ` — ${compatibleCount} 个有对应版本`;
                if (incompatibleCount > 0) {
                    countText += `，${incompatibleCount} 个未有对应版本`;
                }
                depsCount.textContent = countText;
            }
        } else {
            resolved = resolveResult._basic;
            mdDepsResolved = resolved;
            mdDepsVersionInfo = {};
            if (depsCount) depsCount.textContent = `(${requiredDeps.length} 必选, ${depArray.length - requiredDeps.length} 可选)`;
        }

        const installedMods = Array.isArray(installedModsData) ? installedModsData : [];

        mdDepsCache.set(cacheKey, { resolved, versionInfo, installedMods, time: Date.now() });

        renderDepsList(depArray, resolved, versionInfo, hasVersionFilter, currentGameVersion, currentLoader, installedMods, depsList, depsCount, requiredDeps);
    } catch (e) {
        depsList.innerHTML = depArray.map(d => {
            const depType = d.dependencyType || 'optional';
            const typeLabel = depType === 'required' ? '必选' : (depType === 'incompatible' ? '冲突' : '可选');
            const badgeClass = depType === 'required' ? 'required' : (depType === 'incompatible' ? 'incompatible' : 'optional');
            return `<div class="md-dep-item" onclick="openModDetail('${escapeOnclick(d.projectId)}', 'modrinth')">
                <div class="md-dep-info">
                    <div class="md-dep-name">${escapeHtml(d.projectId)}</div>
                </div>
                <span class="md-dep-badge ${badgeClass}">${typeLabel}</span>
            </div>`;
        }).join('');
    }
}

function renderDepsList(depArray, resolved, versionInfo, hasVersionFilter, currentGameVersion, currentLoader, installedMods, depsList, depsCount, requiredDeps) {
    depsList.innerHTML = depArray.map(d => {
        const info = resolved[d.projectId] || {};
        const title = info.title || d.projectId;
        const icon = info.icon || '';
        const desc = info.description || '';
        const depType = d.dependencyType || 'optional';
        const typeLabel = depType === 'required' ? '必选' : (depType === 'incompatible' ? '冲突' : '可选');
        const badgeClass = depType === 'required' ? 'required' : (depType === 'incompatible' ? 'incompatible' : 'optional');

        const isInstalled = installedMods.some(m => {
            if (m.id === d.projectId) return true;
            if (!m.filename) return false;
            const fn = m.filename.toLowerCase();
            const pid = d.projectId.toLowerCase();
            if (fn.includes(pid)) return true;
            const slug = (info.slug || '').toLowerCase();
            if (slug && fn.includes(slug)) return true;
            return false;
        });

        let statusText = '';
        let statusClass = '';
        if (isInstalled) {
            statusText = '✓ 已安装';
            statusClass = 'installed';
        } else if (hasVersionFilter) {
            const vInfo = versionInfo[d.projectId];
            if (vInfo?.hasCompatibleVersion) {
                statusText = '可安装';
                statusClass = 'compatible';
            } else {
                statusText = '未有对应版本';
                statusClass = 'incompatible-version';
            }
        } else {
            statusText = '请先选择版本';
            statusClass = 'not-installed';
        }

        let versionInfoHtml = '';
        if (hasVersionFilter && !isInstalled) {
            const vInfo = versionInfo[d.projectId];
            if (vInfo?.hasCompatibleVersion) {
                const verNum = vInfo.versionNumber || '';
                const loaders = (vInfo.loaders || []).map(l => {
                    const ll = l.toLowerCase();
                    let color = '#888', bg = 'rgba(136,136,136,0.15)';
                    if (ll === 'fabric') { color = '#dbb07c'; bg = 'rgba(219,176,124,0.15)'; }
                    else if (ll === 'forge') { color = '#4a6b8a'; bg = 'rgba(74,107,138,0.15)'; }
                    else if (ll === 'neoforge') { color = '#f47733'; bg = 'rgba(244,119,51,0.15)'; }
                    else if (ll === 'quilt') { color = '#9b59b6'; bg = 'rgba(155,89,182,0.15)'; }
                    return `<span style="font-size:10px;padding:1px 5px;border-radius:3px;background:${bg};color:${color}">${escapeHtml(l)}</span>`;
                }).join('');
                versionInfoHtml = `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;display:flex;align-items:center;gap:4px">${verNum ? escapeHtml(verNum) : ''} ${loaders}</div>`;
            } else {
                versionInfoHtml = `<div style="font-size:11px;color:var(--warning,orange);margin-top:2px">⚠ ${currentGameVersion || '未知版本'}${currentLoader ? ' / ' + currentLoader : ''} 无对应版本</div>`;
            }
        }

        return `<div class="md-dep-item" onclick="openModDetail('${escapeOnclick(d.projectId)}', 'modrinth')">
            ${icon ? `<div class="md-dep-icon"><img src="${icon}" alt="" onerror="this.parentElement.remove()"></div>` : ''}
            <div class="md-dep-info">
                <div class="md-dep-name">${escapeHtml(formatModNameWithChinese(info.slug || d.projectId, title))}</div>
                <div class="md-dep-desc">${escapeHtml(desc)}</div>
                ${versionInfoHtml}
            </div>
            <span class="md-dep-badge ${badgeClass}">${typeLabel}</span>
            <span class="md-dep-status ${statusClass}">${statusText}</span>
        </div>`;
    }).join('');
}

function toggleMdDepsSection() {
    const depsList = document.getElementById('md-deps-list');
    const arrow = document.getElementById('md-deps-arrow');
    if (!depsList) return;
    depsList.classList.toggle('expanded');
    if (arrow) {
        arrow.style.transform = depsList.classList.contains('expanded') ? 'rotate(180deg)' : '';
    }
}

async function downloadAllDeps() {
    if (!currentModDetailData) return;
    const source = currentModDetailData.source || 'modrinth';
    const versionId = currentModDetailData.selectedVersionId || currentModDetailData.versionId || '';
    const gameVersion = currentModDetailData.selectedGameVersion || getCustomSelectValue('mod-filter-version') || '';
    const loader = currentModDetailData.selectedLoader || getCustomSelectValue('mod-filter-loader') || '';

    if (!versionId) {
        showToast('请先选择一个版本', 'error');
        return;
    }

    const btn = document.getElementById('md-deps-download-all-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span>检测中...</span>'; }

    showToast('正在检测前置依赖...', 'info');

    try {
        const [depResult, installedModsData] = await Promise.all([
            API.getDependenciesRecursive(versionId, source, gameVersion, loader),
            API.getInstalledMods().catch(() => [])
        ]);
        const deps = depResult.dependencies || [];
        const installedMods = Array.isArray(installedModsData) ? installedModsData : [];

        if (deps.length === 0) {
            showToast('该模组没有前置依赖', 'info');
            if (btn) { btn.disabled = false; btn.innerHTML = '<span>一键下载</span>'; }
            return;
        }

        showToast('请选择保存文件夹...', 'info');
        const defaultPath = await resolveModSavePath();
        const folderResult = await API.selectSaveFolder(defaultPath);
        if (folderResult.cancelled || !folderResult.path) {
            showToast('已取消', 'info');
            if (btn) { btn.disabled = false; btn.innerHTML = '<span>一键下载</span>'; }
            return;
        }
        const savePath = folderResult.path;

        const toDownload = [];
        const seen = new Set();
        for (const dep of deps) {
            if (!dep.compatibleVersion) continue;
            if (seen.has(dep.projectId)) continue;
            seen.add(dep.projectId);
            const alreadyInstalled = installedMods.some(m => {
                if (m.id === dep.projectId) return true;
                if (!m.filename) return false;
                const fn = m.filename.toLowerCase();
                if (fn.includes(dep.projectId.toLowerCase())) return true;
                return false;
            });
            if (!alreadyInstalled) toDownload.push(dep);
        }

        if (toDownload.length === 0) {
            showToast('所有前置依赖均已安装', 'info');
            if (btn) { btn.disabled = false; btn.innerHTML = '<span>一键下载</span>'; }
            return;
        }

        if (btn) { btn.innerHTML = `<span>下载中 (0/${toDownload.length})...</span>`; }

        let downloaded = 0;
        for (const dep of toDownload) {
            try {
                if (btn) { btn.innerHTML = `<span>下载中 (${downloaded + 1}/${toDownload.length})...</span>`; }
                const result = await API.downloadModVersion(
                    dep.compatibleVersion.versionId, dep.projectId, source, '',
                    gameVersion, loader, savePath, false
                );
                if (result.success && result.sessionId) {
                    showModDownloadModal(result.fileName, result.sessionId, savePath, dep.icon || '');
                } else {
                    showToast(`${dep.title}: ${result.error || '下载失败'}`, 'error');
                }
            } catch (e) {
                showToast(`${dep.title}: ${e.message || '下载失败'}`, 'error');
            }
            downloaded++;
        }

        mdDepsCache.clear();
        showToast(`已提交 ${downloaded} 个前置依赖下载`, 'success');
        if (btn) { btn.disabled = false; btn.innerHTML = '<span>一键下载</span>'; }
    } catch (e) {
        showToast('检测前置依赖失败: ' + (e.message || '未知错误'), 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<span>一键下载</span>'; }
    }
}


let _mdvRenderedCount = 0;
const MDV_INITIAL_RENDER = 30;

function _buildVersionItemHtml(v, idx) {
    const verNum = v.versionNumber || v.versionName || v.id.substring(0, 12);
    const gvs = (v.gameVersions || []).slice(0, 3).join(', ');
    const releaseType = v.releaseType === 'release' ? '' : (v.releaseType === 'beta' ? '测试版' : '');
    const files = v.files || [];
    const fileCount = files.length;
    
    const loaders = v.loaders || [];
    const loaderBadges = loaders.map(l => {
        const ll = l.toLowerCase();
        let color = '#888', bg = 'rgba(136,136,136,0.15)';
        if (ll === 'fabric') { color = '#dbb07c'; bg = 'rgba(219,176,124,0.15)'; }
        else if (ll === 'forge') { color = '#4a6b8a'; bg = 'rgba(74,107,138,0.15)'; }
        else if (ll === 'neoforge') { color = '#f47733'; bg = 'rgba(244,119,51,0.15)'; }
        else if (ll === 'quilt') { color = '#9b59b6'; bg = 'rgba(155,89,182,0.15)'; }
        return `<span class="loader-badge" style="background:${bg};color:${color}">${escapeHtml(l)}</span>`;
    }).join('');

    const safeVid = btoa(encodeURIComponent(v.id || ''));

    return `<div class="mdv-group" id="mdvg-${idx}">
        <div class="mdv-group-header" onclick="toggleMdvGroup(${idx})">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span class="mdv-group-title">${escapeHtml(verNum)}</span>
                ${loaderBadges}
                <span style="font-size:11px;color:var(--text-muted)">${gvs}</span>
                ${releaseType ? `<span class="lver-badge" style="margin-left:4px">${releaseType}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:10px">
                <span style="font-size:11px;color:var(--text-muted)">${fileCount} 个文件</span>
                <svg class="mdv-expand-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </div>
        </div>
        <div class="mdv-files">
            ${files.map(f => {
                const fname = f.filename || f.name || f.id;
                const size = formatNumber(Math.round((f.size || 1024) / 1024)) + ' KB';
                const dateStr = f.datePublished ? formatDate(f.datePublished).split(' ')[0] : '';
                const stableBadge = f.releaseType === 'release' ? '<span class="lver-badge">稳定</span>' : 
                                   (f.releaseType === 'beta' ? '<span class="lver-badge">测试版</span>' : '');
                const loaderIcon = getLoaderFileIcon(fname);
                const safeFid = btoa(encodeURIComponent(f.id || ''));
                const isMod = currentModDetailType === 'mod';
                const isModpack = currentModDetailType === 'modpack';
                let addBtn, rowOnclick;
                if (modMultiSelectMode && isMod) {
                    const alreadySelected = modSelectedIds.has(currentModDetailId);
                    addBtn = `<button class="btn ${alreadySelected ? 'btn-secondary' : 'btn-primary'} btn-sm mdv-install-btn" onclick="event.stopPropagation();addModFromDetail('${escapeOnclick(currentModDetailId)}', '${escapeOnclick(currentModDetailSource)}', '${safeVid}', '${safeFid}')">${alreadySelected ? '已添加' : '添加'}</button>`;
                    rowOnclick = `addModFromDetail('${escapeOnclick(currentModDetailId)}', '${escapeOnclick(currentModDetailSource)}', '${safeVid}', '${safeFid}')`;
                } else {
                    addBtn = isModpack
                           ? `<button class="btn btn-primary btn-sm mdv-install-btn" onclick="event.stopPropagation();installModpackVersionSafe(this.closest('.mdv-file-item'))">下载</button>`
                           : (isMod
                              ? `<button class="btn btn-primary btn-sm mdv-install-btn" onclick="event.stopPropagation();installModFileSafe(this.closest('.mdv-file-item'))">安装</button>`
                              : `<button class="btn btn-primary btn-sm mdv-install-btn" onclick="event.stopPropagation();installResourceVersionSafe(this.closest('.mdv-file-item'))">安装</button>`);
                    rowOnclick = isModpack ? `installModpackVersionSafe(this)` : (isMod ? `installModFileSafe(this)` : `installResourceVersionSafe(this)`);
                }
                return `<div class="mdv-file-item" data-vid="${safeVid}" data-fid="${safeFid}" onclick="${rowOnclick}">
                    <div class="mdv-file-icon">${loaderIcon}</div>
                    <div class="mdv-file-info">
                        <div class="mdv-file-name">${escapeHtml(fname)}</div>
                        <div class="mdv-file-meta">${size}${dateStr ? ' · ' + dateStr : ''}${stableBadge ? ' · ' + stableBadge : ''}</div>
                    </div>
                    ${addBtn}
                </div>`;
            }).join('')}
        </div>
    </div>`;
}

function _sortVersionsByNumber(versions) {
    return [...versions].sort((a, b) => {
        const aNum = a.versionNumber || a.versionName || '';
        const bNum = b.versionNumber || b.versionName || '';
        const aParts = aNum.split(/[.\-_]/).map(p => parseInt(p, 10) || 0);
        const bParts = bNum.split(/[.\-_]/).map(p => parseInt(p, 10) || 0);
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aVal = aParts[i] || 0;
            const bVal = bParts[i] || 0;
            if (aVal !== bVal) return bVal - aVal;
        }
        return 0;
    });
}

function renderMdVersionList(versions) {
    const container = document.getElementById('md-version-list');
    if (versions.length === 0) {
        container.innerHTML = '<p class="empty-text" style="padding:30px 0;text-align:center;color:var(--text-muted)">无匹配版本</p>';
        return;
    }

    const sorted = _sortVersionsByNumber(versions);
    _mdvCurrentVersions = sorted;
    _mdvRenderedCount = 0;
    const initial = sorted.slice(0, MDV_INITIAL_RENDER);
    container.innerHTML = initial.map((v, i) => _buildVersionItemHtml(v, i)).join('');
    _mdvRenderedCount = initial.length;

    if (versions.length > MDV_INITIAL_RENDER) {
        container.insertAdjacentHTML('beforeend', `<div id="mdv-load-more" style="text-align:center;padding:16px 0">
            <button class="btn btn-secondary" onclick="renderMdVersionListMore()">加载更多 (${versions.length - MDV_INITIAL_RENDER} 个版本)</button>
        </div>`);
    }
}

let _mdvCurrentVersions = [];

function renderMdVersionListMore() {
    const container = document.getElementById('md-version-list');
    const loadMoreBtn = document.getElementById('mdv-load-more');
    if (loadMoreBtn) loadMoreBtn.remove();

    const batch = _mdvCurrentVersions.slice(_mdvRenderedCount, _mdvRenderedCount + MDV_INITIAL_RENDER);
    const fragment = document.createDocumentFragment();
    const temp = document.createElement('div');
    temp.innerHTML = batch.map((v, i) => _buildVersionItemHtml(v, _mdvRenderedCount + i)).join('');
    while (temp.firstChild) fragment.appendChild(temp.firstChild);
    container.appendChild(fragment);
    _mdvRenderedCount += batch.length;

    if (_mdvRenderedCount < _mdvCurrentVersions.length) {
        container.insertAdjacentHTML('beforeend', `<div id="mdv-load-more" style="text-align:center;padding:16px 0">
            <button class="btn btn-secondary" onclick="renderMdVersionListMore()">加载更多 (${_mdvCurrentVersions.length - _mdvRenderedCount} 个版本)</button>
        </div>`);
    }
}


function installModFileSafe(el) {
    if (!el) return;
    const vid = decodeURIComponent(atob(el.dataset.vid || ''));
    const fid = decodeURIComponent(atob(el.dataset.fid || ''));
    installModFile(currentModDetailId, currentModDetailSource, vid, fid);
}

function addModFromDetail(projectId, source, safeVid, safeFid) {
    const vid = decodeURIComponent(atob(safeVid || ''));
    const fid = decodeURIComponent(atob(safeFid || ''));

    if (modSelectedIds.has(projectId)) {
        const existing = modSelectedVersions.get(projectId);
        if (existing && existing.versionId === vid && existing.fileId === fid) {
            modSelectedIds.delete(projectId);
            modSelectedVersions.delete(projectId);
            showToast('已从选择中移除', 'info');
        } else {
            modSelectedVersions.set(projectId, {
                versionId: vid,
                fileId: fid,
                source: source
            });
            showToast('已更新选择的版本', 'success');
        }
    } else {
        modSelectedIds.add(projectId);
        modSelectedVersions.set(projectId, {
            versionId: vid,
            fileId: fid,
            source: source
        });
        showToast('已添加到下载列表', 'success');
    }
    updateModSelectUI();

    const container = document.getElementById('md-version-list');
    if (container) {
        container.querySelectorAll('.mdv-file-item').forEach(item => {
            const btn = item.querySelector('.mdv-install-btn');
            if (!btn) return;
            const itemVid = decodeURIComponent(atob(item.dataset.vid || ''));
            const itemFid = decodeURIComponent(atob(item.dataset.fid || ''));
            const isSelected = modSelectedIds.has(projectId);
            const isCurrentVersion = isSelected && modSelectedVersions.get(projectId)?.versionId === itemVid;
            btn.textContent = isCurrentVersion ? '已添加' : '添加';
            btn.classList.toggle('btn-secondary', isCurrentVersion);
            btn.classList.toggle('btn-primary', !isCurrentVersion);
        });
    }
}

function installModpackVersionSafe(el) {
    if (!el) return;
    const vid = decodeURIComponent(atob(el.dataset.vid || ''));
    installModpackVersion(currentModDetailId, vid);
}

function installResourceVersionSafe(el) {
    if (!el) return;
    const vid = decodeURIComponent(atob(el.dataset.vid || ''));
    quickInstallResourceVersion(currentModDetailId, currentModDetailType, vid);
}

async function quickInstallResourceVersion(projectId, type, versionId) {
    const typeNames = { resourcepack: '材质包', shader: '光影包', datapack: '数据包' };
    const typeName = typeNames[type] || '资源';
    showToast('请选择保存文件夹...', 'info');
    try {
        const defaultPath = await resolveResourceSavePath(type);
        const folderResult = await API.selectSaveFolder(defaultPath);
        if (folderResult.cancelled) {
            if (folderResult.error) {
                showToast('文件夹选择失败: ' + folderResult.error, 'error');
            }
            return;
        }
        const savePath = folderResult.path;
        if (!savePath) {
            showToast('未选择文件夹', 'error');
            return;
        }
        localStorage.setItem('lastResourceSavePath_' + type, savePath);
        showToast(`正在安装${typeName}...`, 'info');
        const result = await API.downloadResource(versionId, projectId, type, '', savePath);
        if (result.success) {
            showModDownloadModal(result.fileName, result.sessionId);
        } else {
            showToast(result.error || '安装失败', 'error');
        }
    } catch (e) {
        showToast('安装失败', 'error');
    }
}

function toggleMdvGroup(idx) {
    const group = document.getElementById(`mdvg-${idx}`);
    group.classList.toggle('expanded');
}

function getLoaderFileIcon(filename) {
    const lower = filename.toLowerCase();
    if (lower.includes('fabric')) return '<img src="img/Fabric.png" alt="" style="width:20px;height:20px;image-rendering:pixelated">';
    if (lower.includes('neoforge')) return '<img src="img/NeoForge.png" alt="" style="width:20px;height:20px;image-rendering:pixelated">';
    if (lower.includes('forge')) return '<img src="img/CommandBlock.png" alt="" style="width:20px;height:20px;image-rendering:pixelated">';
    if (lower.includes('optifine')) return '<img src="img/OptiFabric.png" alt="" style="width:20px;height:20px;image-rendering:pixelated">';
    return '<img src="img/Grass.png" alt="" style="width:20px;height:20px;image-rendering:pixelated">';
}

function installModFile(projectId, source, versionId, fileId) {
    showModInstallConfirm(projectId, source, versionId, fileId);
}

async function installModpackVersion(projectId, versionId) {
    const modpackTitle = currentModDetailData?.title || currentModDetailData?.name || projectId;
    showModpackNameModal(modpackTitle, projectId, versionId);
}

function showModpackNameModal(defaultName, projectId, versionId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';

    const card = document.createElement('div');
    card.style.cssText = 'max-width:420px;width:90%;background:var(--bg-secondary);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);overflow:hidden;';

    card.innerHTML = `
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:15px;font-weight:600;color:var(--text-primary);">设置整合包名称</span>
            <button id="mpnm-close" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;padding:4px;">✕</button>
        </div>
        <div style="padding:20px;">
            <div style="margin-bottom:12px;">
                <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;">版本名称</label>
                <input id="mpnm-input" type="text" value="${defaultName.replace(/"/g, '&quot;')}" 
                    style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-primary);color:var(--text-primary);font-size:14px;outline:none;box-sizing:border-box;" />
                <div id="mpnm-hint" style="margin-top:6px;font-size:12px;color:var(--text-muted);"></div>
            </div>
            <div id="mpnm-warn" style="display:none;padding:10px 12px;border-radius:8px;background:rgba(255,193,7,0.1);border:1px solid rgba(255,193,7,0.3);margin-bottom:12px;">
                <span style="font-size:13px;color:#e6a817;">⚠ 已有相同名称的版本</span>
            </div>
        </div>
        <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;">
            <button id="mpnm-cancel" style="padding:8px 20px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-primary);cursor:pointer;font-size:13px;">取消</button>
            <button id="mpnm-confirm" style="padding:8px 20px;border-radius:8px;border:none;background:var(--accent);color:#fff;cursor:pointer;font-size:13px;font-weight:500;">确认安装</button>
        </div>
    `;

    modal.appendChild(card);
    document.body.appendChild(modal);

    const input = document.getElementById('mpnm-input');
    const hint = document.getElementById('mpnm-hint');
    const warn = document.getElementById('mpnm-warn');
    const confirmBtn = document.getElementById('mpnm-confirm');

    async function checkName() {
        const name = input.value.trim();
        if (!name) {
            hint.textContent = '';
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.5';
            return;
        }
        hint.textContent = '✓';
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
        confirmBtn.style.cursor = 'pointer';
    }

    input.addEventListener('input', checkName);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !confirmBtn.disabled) confirmBtn.click();
    });

    document.getElementById('mpnm-close').onclick = () => modal.remove();
    document.getElementById('mpnm-cancel').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    confirmBtn.onclick = async () => {
        const name = input.value.trim();
        if (!name || confirmBtn.disabled) return;
        modal.remove();
        _doInstallModpack(projectId, versionId, name);
    };

    checkName();
    input.focus();
    input.select();
}

async function _doInstallModpack(projectId, versionId, customName) {
    showToast('正在下载整合包，将创建新版本...', 'info');
    try {
        const result = await API.downloadResource(versionId, projectId, 'modpack', '', '', customName);
        if (result.success) {
            showModpackInstallModal(result.fileName, result.sessionId);
        } else {
            console.error('[Modpack] downloadResource failed:', JSON.stringify(result));
            showToast(`整合包安装失败: ${result.error || '未知错误'}`, 'error');
        }
    } catch (e) {
        console.error('[Modpack] downloadResource error:', e);
        showToast(`整合包安装失败: ${e.message || e}`, 'error');
    }
}

async function quickInstallModpack(projectId, versionId) {
    const modpackTitle = currentModDetailData?.title || currentModDetailData?.name || projectId;
    showModpackNameModal(modpackTitle, projectId, versionId);
}

function showModpackInstallModal(fileName, sessionId) {
    currentInstallSessionId = sessionId;
    const taskId = 'modpack-' + sessionId;
    const iconUrl = currentModDetailData?.icon || '';
    dlManager.add(taskId, fileName || '整合包安装', 'modpack', sessionId, iconUrl);
    navigateToPage('downloads');

    let unknownRetries = 0;
    const poll = async () => {
        try {
            const data = await API.getModDownloadStatus(sessionId);
            const files = (data.files || []).map(f => ({
                name: f.name || f.filename || f.path || '',
                status: f.status || 'pending',
                size: f.size ? formatSize(f.size) : ''
            }));
            const displayStatus = data.status === 'completed' ? 'completed' : data.status === 'failed' ? 'failed' : data.status === 'cancelled' ? 'failed' : 'downloading';
            const displayMessage = data.phase === 'importing' ? '正在安装整合包...' : getDownloadStageText(data);
            dlManager.update(taskId, {
                progress: data.progress || 0,
                status: displayStatus,
                message: displayMessage,
                files: files,
                stageHistory: data.stageHistory || []
            });
            if (data.status === 'completed') {
                showToast('整合包安装完成', 'success');
                loadVersions(true);
                return;
            }
            if (data.status === 'failed') {
                showToast(`安装失败: ${data.message}`, 'error');
                return;
            }
            if (data.status === 'cancelled') {
                dlManager.update(taskId, { status: 'failed', message: '已取消' });
                return;
            }
            if (data.phase === 'importing') {
                const timer = setTimeout(poll, 500);
                modDownloadPollTimers.push(timer);
                return;
            }
            if (data.status === 'unknown' || !data.status) {
                unknownRetries++;
                if (unknownRetries <= 1) {
                    const timer = setTimeout(poll, 3000);
                    modDownloadPollTimers.push(timer);
                    return;
                }
                dlManager.update(taskId, { status: 'failed', message: '会话已失效' });
                return;
            }
            const timer = setTimeout(poll, 500);
            modDownloadPollTimers.push(timer);
        } catch (e) {
            const timer = setTimeout(poll, 800);
            modDownloadPollTimers.push(timer);
        }
    };
    setTimeout(poll, 300);
}

function getDownloadStageText(data) {
    if (!data) return '准备中...';
    if (data.status === 'completed') return '安装完成';
    if (data.status === 'failed') return data.message || '安装失败';
    if (data.status === 'cancelled') return '已取消';
    if (data.message && data.phase !== 'importing') return data.message;
    const phaseMap = {
        'download':        '下载整合包文件...',
        'read':            '正在读取整合包...',
        'base':            '正在准备基础版本...',
        'loader-install':  '正在安装模组加载器...',
        'loader-upgrade':  '正在升级模组加载器...',
        'version-config':  '正在创建版本配置...',
        'loader':          '模组加载器就绪',
        'download-mods':   '下载整合包模组...',
        'overrides':       '解压整合包配置...',
        'verify':          '正在验证整合包完整性...',
        'install':         '安装整合包内容...',
        'importing':       '正在安装整合包...',
    };
    if (data.phase && phaseMap[data.phase]) return phaseMap[data.phase];
    if (data.phase === 'install') return '安装整合包内容...';
    return data.message || '处理中...';
}

async function resolveModSavePath(versionId) {
    try {
        const vid = versionId || _modDownloadVersionId || '';
        const url = vid ? `/api/filesystem/default-mod-path?versionId=${encodeURIComponent(vid)}` : '/api/filesystem/default-mod-path';
        const resp = await fetch(url);
        if (resp.ok) {
            const gpRes = await resp.json();
            let path = '';
            if (typeof gpRes === 'string') {
                path = gpRes;
            } else if (gpRes && typeof gpRes === 'object') {
                path = gpRes.path || gpRes.data || '';
            }
            if (path) return path;
        }
    } catch (e) {}
    return localStorage.getItem('lastModSavePath') || '';
}

const resourceFolderMap = { resourcepack: 'resourcepacks', shader: 'shaderpacks', datapack: 'datapacks' };

async function resolveResourceSavePath(type) {
    const folderName = resourceFolderMap[type];
    if (!folderName) return '';
    const storageKey = 'lastResourceSavePath_' + type;
    try {
        const res = await API.getDefaultResourcePath(type).catch(() => null);
        let p = '';
        if (typeof res === 'string') {
            p = res;
        } else if (res && typeof res === 'object') {
            p = res.path || res.data || '';
        }
        if (p) return p;
    } catch (e) {}
    return localStorage.getItem(storageKey) || '';
}

async function showModInstallConfirm(projectId, source, versionId, fileId) {
    showToast('请选择保存文件夹...', 'info');
    try {
        const defaultPath = await resolveModSavePath();
        const folderResult = await API.selectSaveFolder(defaultPath);
        if (folderResult.cancelled) {
            if (folderResult.error) {
                showToast('文件夹选择失败: ' + folderResult.error, 'error');
            } else {
                showToast('已取消选择', 'info');
            }
            return;
        }
        const savePath = folderResult.path;
        if (!savePath) {
            showToast('未选择文件夹', 'error');
            return;
        }
        localStorage.setItem('lastModSavePath', savePath);

        const currentGameVersion = getCustomSelectValue('mod-filter-version') || '';
        const currentLoader = getCustomSelectValue('mod-filter-loader') || '';

        if (versionId) {
            showToast('正在检查前置依赖...', 'info');
            try {
                const depResult = await API.getModDependencies(versionId, source, currentGameVersion, currentLoader, projectId);
                const deps = depResult.dependencies || [];
                if (deps.length > 0) {
                    showDependencyDialog(projectId, source, versionId, fileId, savePath, deps, currentGameVersion, currentLoader);
                    return;
                }
            } catch (e) { console.warn('[ModInstall] 依赖检查失败:', e.message); }
        }

        proceedModInstall(projectId, source, versionId, fileId, savePath, true);
    } catch (e) {
        console.error('Mod install confirm error:', e);
        showToast('操作失败', 'error');
    }
}

function showDepVersionSelectModal(projectId, source, gameVersion, loader, savePath) {
    const existing = document.getElementById('dep-version-select-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'dep-version-select-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';

    const card = document.createElement('div');
    card.className = 'ai-version-select-card';
    card.style.cssText = 'max-width:480px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

    card.innerHTML = `
        <div class="ai-version-select-header" style="padding:14px 16px;background:var(--bg-tertiary);border-bottom:1px solid var(--border);">
            <span class="ai-version-select-title">选择前置模组版本</span>
            <span class="ai-version-select-count" id="dep-ver-count">加载中...</span>
        </div>
        <div class="ai-version-select-list" id="dep-ver-list" style="max-height:360px;overflow-y:auto;">
            <div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px;">正在获取版本列表...</div>
        </div>
        <div style="padding:12px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;">
            <button id="dep-ver-cancel" style="padding:8px 20px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-primary);cursor:pointer;font-size:13px;">取消</button>
        </div>
    `;

    modal.appendChild(card);
    document.body.appendChild(modal);

    document.getElementById('dep-ver-cancel').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    loadDepVersions(projectId, source, gameVersion, loader, savePath, modal);
}

async function loadDepVersions(projectId, source, gameVersion, loader, savePath, modal) {
    try {
        const result = await API.getProjectVersions(projectId, source, gameVersion, loader);
        const versions = result.versions || [];
        const listEl = document.getElementById('dep-ver-list');
        const countEl = document.getElementById('dep-ver-count');
        if (!listEl || !countEl) return;

        countEl.textContent = versions.length + ' 个版本';

        if (versions.length === 0) {
            listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px;">未找到兼容的版本</div>';
            return;
        }

        listEl.innerHTML = versions.map(v => {
            const loaders = (v.loaders || []).map(l => {
                const lc = l.toLowerCase();
                const cls = lc === 'fabric' ? 'fabric' : lc === 'forge' ? 'forge' : lc === 'neoforge' ? 'neoforge' : 'vanilla';
                return `<span class="ai-version-select-loader ${cls}">${escapeHtml(l)}</span>`;
            }).join(' ');
            const gvs = (v.gameVersions || []).slice(0, 3).join(', ') + (v.gameVersions?.length > 3 ? '...' : '');
            const file = v.files?.find(f => f.primary) || v.files?.[0];
            const sizeStr = file?.size ? formatBytes(file.size) : '';
            const dateStr = v.datePublished ? formatDate(v.datePublished) : '';

            return `<div class="ai-version-select-item" data-version-id="${escapeHtml(v.versionId)}" data-file-id="" data-file-name="${escapeHtml(file?.filename || '')}" data-download-url="${escapeHtml(file?.url || '')}">
                <div class="ai-version-select-icon-wrap">
                    <span style="font-size:16px;">📦</span>
                </div>
                <div style="flex:1;min-width:0;">
                    <span class="ai-version-select-id">${escapeHtml(v.versionNumber)}</span>
                    <div style="display:flex;gap:6px;align-items:center;margin-top:2px;flex-wrap:wrap;">
                        ${loaders}
                        <span style="font-size:11px;color:var(--text-muted);">${escapeHtml(gvs)}</span>
                        ${sizeStr ? `<span style="font-size:11px;color:var(--text-muted);">${sizeStr}</span>` : ''}
                        ${dateStr ? `<span style="font-size:11px;color:var(--text-muted);">${dateStr}</span>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');

        listEl.querySelectorAll('.ai-version-select-item').forEach(item => {
            item.onclick = () => {
                const selectedVersionId = item.dataset.versionId;
                modal.remove();
                downloadDepWithNestedDeps(projectId, source, selectedVersionId, savePath, gameVersion, loader);
            };
        });
    } catch (e) {
        const listEl = document.getElementById('dep-ver-list');
        if (listEl) {
            listEl.innerHTML = `<div style="padding:24px;text-align:center;color:var(--charts-red);font-size:13px;">加载失败: ${escapeHtml(e.message)}</div>`;
        }
    }
}

async function downloadDepWithNestedDeps(projectId, source, versionId, savePath, gameVersion, loader) {
    const taskId = 'dep-' + Date.now();
    dlManager.add(taskId, '前置模组', 'mod', '', '');
    dlManager.update(taskId, { progress: 0, status: 'downloading', message: '正在解析嵌套依赖...' });

    try {
        const recursiveDeps = await API.getDependenciesRecursive(versionId, source, gameVersion, loader);
        const allDeps = recursiveDeps.dependencies || [];
        const downloadableDeps = allDeps.filter(d => d.compatibleVersion);

        if (downloadableDeps.length > 0) {
            dlManager.update(taskId, { message: `发现 ${downloadableDeps.length} 个嵌套依赖，准备下载...` });

            const nestedDepsHtml = downloadableDeps.map(d => {
                const indent = '&nbsp;'.repeat(d.depth * 4);
                const icon = d.depth > 1 ? '↳' : '•';
                return `<div style="padding:3px 0;font-size:12px;color:var(--text-secondary);">${indent}${icon} ${escapeHtml(d.title)} <span style="color:var(--text-muted);">v${d.compatibleVersion.versionNumber}</span></div>`;
            }).join('');

            const modalId = 'nested-modal-' + Date.now();
            const confirmed = await new Promise(resolve => {
                const confirmModal = document.createElement('div');
                confirmModal.id = modalId;
                confirmModal.className = 'modal-overlay';
                confirmModal.style.cssText = 'position:fixed;inset:0;z-index:10002;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
                confirmModal.innerHTML = `<div style="background:var(--bg-primary);border-radius:12px;padding:24px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                    <h3 style="margin:0 0 8px;font-size:15px;font-weight:700;">发现嵌套依赖</h3>
                    <p style="margin:0 0 12px;font-size:13px;color:var(--text-secondary);">该前置模组还有 ${downloadableDeps.length} 个嵌套依赖需要一起下载：</p>
                    <div style="max-height:200px;overflow-y:auto;margin-bottom:16px;padding:8px;background:var(--bg-secondary);border-radius:8px;">${nestedDepsHtml}</div>
                    <div style="display:flex;gap:10px;justify-content:flex-end;">
                        <button id="${modalId}-cancel" style="padding:8px 20px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-primary);cursor:pointer;font-size:13px;">取消</button>
                        <button id="${modalId}-confirm" style="padding:8px 20px;border-radius:8px;border:none;background:var(--primary);color:#fff;cursor:pointer;font-size:13px;font-weight:600;">确认下载全部</button>
                    </div>
                </div>`;
                document.body.appendChild(confirmModal);
                confirmModal.querySelector(`#${modalId}-cancel`).onclick = () => { confirmModal.remove(); resolve(false); };
                confirmModal.querySelector(`#${modalId}-confirm`).onclick = () => { confirmModal.remove(); resolve(true); };
                confirmModal.onclick = (e) => { if (e.target === confirmModal) { confirmModal.remove(); resolve(false); } };
            });

            if (!confirmed) {
                dlManager.update(taskId, { status: 'failed', message: '用户取消' });
                return;
            }
        }

        const mainResult = await API.downloadModVersion(versionId, projectId, source, '', gameVersion, loader, savePath, false);
        if (mainResult.success) {
            const mainDlId = 'dep-main-' + Date.now();
            dlManager.add(mainDlId, mainResult.fileName || '前置模组', 'mod', '', '');
            dlManager.update(mainDlId, { progress: 0, status: 'downloading', message: '下载中...' });
            dlManager.update(taskId, { progress: 10, message: '主模组下载中...' });
            showModDownloadModal(mainResult.fileName, mainResult.sessionId, savePath, currentModDetailData?.icon || '');
        } else {
            dlManager.update(taskId, { status: 'failed', message: mainResult.error || '主模组下载失败' });
            return;
        }

        const total = downloadableDeps.length;
        let downloaded = 0;
        for (const dep of downloadableDeps) {
            downloaded++;
            const depProgress = Math.round(10 + (downloaded / total) * 90);
            dlManager.update(taskId, { progress: depProgress, message: `下载依赖 ${downloaded}/${total}: ${dep.title}` });
            try {
                const depResult = await API.downloadModVersion(
                    dep.compatibleVersion.versionId, dep.projectId, source, '',
                    gameVersion, loader, savePath, false
                );
                if (depResult.success && depResult.sessionId) {
                    const depDlId = 'dep-' + dep.projectId + '-' + Date.now();
                    dlManager.add(depDlId, dep.title || depResult.fileName, 'mod', '', dep.icon || '');
                    dlManager.update(depDlId, { progress: 0, status: 'downloading', message: '下载中...' });
                    showModDownloadModal(depResult.fileName, depResult.sessionId, savePath, dep.icon || '');
                }
            } catch (e) {
                console.warn(`[Deps] 下载依赖 ${dep.title} 失败:`, e.message);
                const depFailId = 'dep-fail-' + Date.now();
                dlManager.add(depFailId, dep.title || '依赖', 'mod', '', dep.icon || '');
                dlManager.update(depFailId, { status: 'failed', message: e.message || '下载失败' });
            }
        }

        mdDepsCache.clear();
        dlManager.update(taskId, { status: 'completed', progress: 100, message: `全部下载完成 (${total} 个依赖)` });
        showToast(`前置模组下载完成: ${total} 个依赖`, 'success');
    } catch (e) {
        dlManager.update(taskId, { status: 'failed', message: e.message || '下载失败' });
        showToast('前置模组下载失败: ' + (e.message || '未知错误'), 'error');
    }
}

function showDependencyDialog(projectId, source, versionId, fileId, savePath, deps, gameVersion, loader) {
    const existing = document.getElementById('mod-dependency-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'mod-dependency-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';

    const depListHtml = deps.map(dep => {
        const ver = dep.compatibleVersion;
        const verInfo = ver ? `v${ver.versionNumber}` : '未找到兼容版本';
        const iconHtml = dep.icon
            ? `<img src="${dep.icon}" style="width:32px;height:32px;border-radius:6px;object-fit:cover;" onerror="this.style.display='none'" loading="lazy">`
            : `<div style="width:32px;height:32px;border-radius:6px;background:var(--bg-secondary);display:flex;align-items:center;justify-content:center;font-size:14px;">📦</div>`;
        const btnDisabled = !ver ? 'opacity:0.4;pointer-events:none;' : '';
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
            ${iconHtml}
            <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(dep.title)}</div>
                <div style="font-size:11px;color:var(--text-secondary);">${escapeHtml(verInfo)}</div>
            </div>
            <button class="dep-single-download-btn" data-project-id="${escapeHtml(dep.projectId)}" style="padding:4px 10px;border-radius:6px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;font-size:11px;white-space:nowrap;${btnDisabled}" title="${ver ? '选择版本并下载前置模组' : '无兼容版本'}">下载前置</button>
            ${ver ? '<span style="font-size:11px;color:#22c55e;">✓</span>' : '<span style="font-size:11px;color:#ef4444;">✗</span>'}
        </div>`;
    }).join('');

    const downloadableCount = deps.filter(d => d.compatibleVersion).length;

    modal.innerHTML = `<div style="background:var(--bg-primary);border-radius:12px;padding:24px;max-width:460px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;">检测到前置依赖</h3>
        <p style="margin:0 0 16px;font-size:13px;color:var(--text-secondary);">该模组需要以下前置模组才能正常运行：</p>
        <div style="max-height:280px;overflow-y:auto;margin-bottom:16px;">${depListHtml}</div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button id="dep-cancel-btn" style="padding:8px 20px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-primary);cursor:pointer;font-size:13px;">取消</button>
            <button id="dep-download-btn" style="padding:8px 20px;border-radius:8px;border:none;background:var(--primary);color:#fff;cursor:pointer;font-size:13px;font-weight:600;${downloadableCount === 0 ? 'opacity:0.5;pointer-events:none;' : ''}">一键下载全部（${downloadableCount} 个前置）</button>
        </div>
    </div>`;

    document.body.appendChild(modal);

    document.getElementById('dep-cancel-btn').onclick = () => modal.remove();
    document.getElementById('dep-download-btn').onclick = () => {
        modal.remove();
        proceedModInstall(projectId, source, versionId, fileId, savePath, false, deps, gameVersion, loader);
    };
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.querySelectorAll('.dep-single-download-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const depProjectId = btn.dataset.projectId;
            modal.remove();
            showDepVersionSelectModal(depProjectId, source, gameVersion, loader, savePath);
        };
    });
}


async function proceedModInstall(projectId, source, versionId, fileId, savePath, includeDeps, deps, gameVersion, loader) {
    const pendingTaskId = 'mod-' + Date.now();
    const iconUrl = currentModDetailData?.icon || '';
    dlManager.add(pendingTaskId, '准备下载...', 'mod', '', iconUrl);
    dlManager.update(pendingTaskId, { progress: 0, status: 'downloading', message: '正在获取下载信息...' });
    try {
        const currentGameVersion = gameVersion || getCustomSelectValue('mod-filter-version') || '';
        const currentLoader = loader || getCustomSelectValue('mod-filter-loader') || '';
        const result = await API.downloadModVersion(versionId || '', projectId, source, fileId || '', currentGameVersion, currentLoader, savePath, includeDeps);
        if (result.success) {
            mdDepsCache.clear();
            dlManager.remove(pendingTaskId);
            showModDownloadModal(result.fileName, result.sessionId, savePath, iconUrl);
        } else {
            dlManager.update(pendingTaskId, { status: 'failed', message: result.error || '下载失败' });
            showToast(result.error || '下载失败', 'error');
        }
    } catch (e) {
        console.error('Mod install error:', e);
        dlManager.update(pendingTaskId, { status: 'failed', message: e.message || '请求失败' });
        showToast('下载请求失败: ' + (e.message || '未知错误'), 'error');
    }
}

function quickInstallCurrentMod() {
    if (!currentModDetailData) return;
    const versionId = currentModDetailData.selectedVersionId || currentModDetailData.versionId || '';
    showModInstallConfirm(currentModDetailData.id || currentModDetailId, currentModDetailSource, versionId);
}

function copyModName() {
    if (!currentModDetailData) return;
    window.electronAPI.clipboard.writeText(currentModDetailData.title).then(() => showToast('已复制名称', 'success'));
}

function openModSourceUrl() {
    if (!currentModDetailData) return;
    let url = '';
    if (currentModDetailSource === 'curseforge') {
        url = `https://www.curseforge.com/minecraft-mc-mods/${currentModDetailId}`;
    } else {
        url = `https://modrinth.com/mod/${currentModDetailId}`;
    }
    window.electronAPI.openExternal(url);
}

async function quickInstallMod(projectId, source, versionId, fileId) {
    const pendingTaskId = 'mod-' + Date.now();
    const iconUrl = currentModDetailData?.icon || '';
    dlManager.add(pendingTaskId, '准备下载...', 'mod', '', iconUrl);
    dlManager.update(pendingTaskId, { progress: 0, status: 'downloading', message: '正在获取下载信息...' });
    try {
        const currentGameVersion = getCustomSelectValue('mod-filter-version') || '';
        const currentLoader = getCustomSelectValue('mod-filter-loader') || '';
        const savePath = await resolveModSavePath();
        const result = await API.downloadModVersion(versionId || '', projectId, source, fileId || '', currentGameVersion, currentLoader, savePath);
        if (result.success) {
            mdDepsCache.clear();
            dlManager.remove(pendingTaskId);
            showModDownloadModal(result.fileName, result.sessionId);
        } else {
            dlManager.update(pendingTaskId, { status: 'failed', message: result.error || '下载失败' });
            showToast(result.error || '下载失败', 'error');
        }
    } catch (e) {
        console.error('quickInstallMod error:', e);
        dlManager.update(pendingTaskId, { status: 'failed', message: e.message || '请求失败' });
        showToast('下载请求失败: ' + (e.message || '未知错误'), 'error');
    }
}

function showModDownloadModal(fileName, sessionId, savePath, iconUrl) {
    const taskId = 'mod-' + sessionId;
    const resolvedIcon = iconUrl || currentModDetailData?.icon || '';
    dlManager.add(taskId, fileName || '模组下载', 'mod', sessionId, resolvedIcon);
    navigateToPage('downloads');

    modDownloadPollTimers.forEach(t => clearTimeout(t));
    modDownloadPollTimers = [];

    let unknownRetries = 0;
    const poll = async () => {
        try {
            const data = await API.getModDownloadStatus(sessionId);
            dlManager.update(taskId, {
                progress: data.progress || 0,
                status: data.status === 'completed' ? 'completed' : data.status === 'failed' ? 'failed' : 'downloading',
                message: data.message || '下载中...'
            });
            if (data.status === 'completed') {
                showToast(`${fileName} 下载完成`, 'success');
                loadInstalledMods();
                return;
            }
            if (data.status === 'failed') {
                showToast(`下载失败: ${data.message}`, 'error');
                return;
            }
            if (data.status === 'unknown' || !data.status) {
                unknownRetries++;
                if (unknownRetries <= 1) {
                    const timer = setTimeout(poll, 3000);
                    modDownloadPollTimers.push(timer);
                    return;
                }
                dlManager.update(taskId, { status: 'failed', message: '会话已失效' });
                return;
            }
            const timer = setTimeout(poll, 500);
            modDownloadPollTimers.push(timer);
        } catch (e) {
            const timer = setTimeout(poll, 1000);
            modDownloadPollTimers.push(timer);
        }
    };
    const timer = setTimeout(poll, 500);
    modDownloadPollTimers.push(timer);
}

function toggleModMultiSelect() {
    modMultiSelectMode = !modMultiSelectMode;
    const toggleBtn = document.getElementById('mod-multiselect-toggle');
    const bar = document.getElementById('mod-multiselect-bar');
    const hintEl = document.getElementById('mod-filter-hint');
    
    if (modMultiSelectMode) {
        toggleBtn.classList.add('btn-primary');
        toggleBtn.classList.remove('btn-secondary');
        bar.style.display = 'flex';
        modSelectedIds.clear();
        modSelectedVersions.clear();
        
        const gv = getCustomSelectValue('mod-filter-version') || '';
        const ld = getCustomSelectValue('mod-filter-loader') || '';
        let hintParts = [];
        if (gv) hintParts.push(gv);
        if (ld) hintParts.push(ld.charAt(0).toUpperCase() + ld.slice(1));
        if (hintEl) hintEl.textContent = hintParts.length > 0 ? `将下载 ${hintParts.join(' + ')} 版本` : '建议先选择游戏版本和加载器';
        
        updateModSelectUI();
    } else {
        toggleBtn.classList.remove('btn-primary');
        toggleBtn.classList.add('btn-secondary');
        bar.style.display = 'none';
        modSelectedIds.clear();
        modSelectedVersions.clear();
    }
    loadMods();
}

function toggleModSelect(modId) {
    if (modSelectedIds.has(modId)) {
        modSelectedIds.delete(modId);
    } else {
        modSelectedIds.add(modId);
    }
    updateModSelectUI();
    
    const safeId = CSS.escape(modId);
    const checkbox = document.querySelector(`.mod-checkbox[data-mod-id="${safeId}"]`);
    if (checkbox) {
        checkbox.classList.toggle('checked', modSelectedIds.has(modId));
    }
}

function toggleSelectAllMods(checked) {
    const container = document.getElementById('mod-browse-list');
    const items = container.querySelectorAll('.mod-item');
    
    if (checked) {
        items.forEach(item => {
            const checkbox = item.querySelector('.mod-checkbox');
            if (checkbox) {
                const modId = checkbox.dataset.modId;
                modSelectedIds.add(modId);
                checkbox.classList.add('checked');
            }
        });
    } else {
        modSelectedIds.clear();
        items.forEach(item => {
            const checkbox = item.querySelector('.mod-checkbox');
            if (checkbox) checkbox.classList.remove('checked');
        });
    }
    updateModSelectUI();
}

function updateModSelectUI() {
    const countEl = document.getElementById('mod-selected-count');
    const batchBtn = document.getElementById('mod-batch-download-btn');
    const selectAll = document.getElementById('mod-select-all');
    
    if (countEl) countEl.textContent = `已选 ${modSelectedIds.size} 个`;
    if (batchBtn) batchBtn.disabled = modSelectedIds.size === 0;
    
    const container = document.getElementById('mod-browse-list');
    const totalItems = container.querySelectorAll('.mod-checkbox').length;
    if (selectAll) selectAll.checked = totalItems > 0 && modSelectedIds.size >= totalItems;
}

async function batchDownloadMods() {
    if (modSelectedIds.size === 0) return;

    const defaultPath = await resolveModSavePath();
    const folderResult = await API.selectSaveFolder(defaultPath);
    if (folderResult.cancelled) return;
    const savePath = folderResult.path;
    if (!savePath) {
        showToast('未选择文件夹', 'error');
        return;
    }
    localStorage.setItem('lastModSavePath', savePath);

    const currentGameVersion = getCustomSelectValue('mod-filter-version');
    const currentLoader = getCustomSelectValue('mod-filter-loader');
    
    const modIds = Array.from(modSelectedIds);
    const total = modIds.length;
    
    const modInfoMap = {};
    modSearchResults.forEach(m => { modInfoMap[m.id] = m; });

    const batchTaskId = 'batch-' + Date.now();
    const files = modIds.map(id => {
        const info = modInfoMap[id];
        const displayName = info ? formatModNameWithChinese(info.slug || id, info.title) : id;
        return { name: displayName, status: 'pending', size: '' };
    });
    dlManager.add(batchTaskId, `批量下载 ${total} 个模组`, 'mod', '');
    dlManager.update(batchTaskId, { files: files });
    navigateToPage('downloads');
    
    let completed = 0;
    let failed = 0;
    
    for (let i = 0; i < modIds.length; i++) {
        const modId = modIds[i];
        const info = modInfoMap[modId];
        const displayName = info ? formatModNameWithChinese(info.slug || modId, info.title) : modId;

        files[i].status = 'downloading';
        dlManager.update(batchTaskId, {
            progress: Math.round((i / total) * 100),
            message: `正在下载 ${i + 1}/${total}`,
            files: [...files]
        });
        
        try {
            const selectedVer = modSelectedVersions.get(modId);
            const versionId = selectedVer?.versionId || '';
            const fileId = selectedVer?.fileId || '';
            const source = selectedVer?.source || 'modrinth';
            
            const result = await API.downloadModVersion(versionId, modId, source, fileId, currentGameVersion, currentLoader, savePath);
            
            if (result.success) {
                await pollBatchModDownload(result.sessionId, modId);
                completed++;
                files[i].status = 'completed';
            } else {
                failed++;
                files[i].status = 'failed';
            }
        } catch (e) {
            failed++;
            files[i].status = 'failed';
        }
        
        dlManager.update(batchTaskId, {
            progress: Math.round(((i + 1) / total) * 100),
            message: `下载完成 ${completed}/${total}${failed > 0 ? `，失败 ${failed}` : ''}`,
            status: (i + 1 === total) ? (failed === total ? 'failed' : 'completed') : 'downloading',
            files: [...files]
        });
    }
    
    modSelectedIds.clear();
    modSelectedVersions.clear();
    updateModSelectUI();
    
    if (currentSettingsVersionId) {
        loadInstalledModsForSettings();
    }
    loadInstalledMods();
}

function pollBatchModDownload(sessionId, modId) {
    return new Promise((resolve) => {
        const poll = async () => {
            try {
                const data = await API.getModDownloadStatus(sessionId);
                if (data.status === 'completed') {
                    resolve();
                    return;
                }
                if (data.status === 'failed') {
                    resolve();
                    return;
                }
                setTimeout(poll, 500);
            } catch (e) {
                setTimeout(poll, 1000);
            }
        };
        setTimeout(poll, 500);
    });
}




function switchLanTab(page, tab, btnEl) {
    const tabsContainer = btnEl.closest('.lan-tabs');
    tabsContainer.querySelectorAll('.lan-tab').forEach(t => t.classList.remove('active'));
    btnEl.classList.add('active');
    
    if (page === 'terracotta') {
        const hostPanel = document.getElementById('terracotta-host-panel');
        const joinPanel = document.getElementById('terracotta-join-panel');
        const connected = document.getElementById('terracotta-connected');
        if (connected.style.display !== 'none') return;
        hostPanel.style.display = tab === 'host' ? '' : 'none';
        joinPanel.style.display = tab === 'join' ? '' : 'none';
        if (tab === 'host') {
            terracottaHost();
        } else {
            updateTerracottaStatus('陶瓦联机 - 加入房间', '输入房间码加入', 'disconnected');
        }
    } else if (page === 'portmap') {
        const createPanel = document.getElementById('portmap-create-panel');
        const joinPanel = document.getElementById('portmap-join-panel');
        const connected = document.getElementById('portmap-connected');
        if (connected.style.display !== 'none') return;
        createPanel.style.display = tab === 'create' ? '' : 'none';
        joinPanel.style.display = tab === 'join' ? '' : 'none';
    }
}

let terracottaPollTimer = null;
let _terracottaPollRefresher = null;
let terracottaState = { mode: null, connected: false };

function updateTerracottaStatus(title, desc, state) {
    document.getElementById('terracotta-status-title').textContent = title;
    document.getElementById('terracotta-status-desc').textContent = desc;
    const dot = document.getElementById('terracotta-status-dot');
    dot.className = 'lan-status-dot';
    if (state === 'connected') dot.classList.add('connected');
    else if (state === 'connecting') dot.classList.add('connecting');
    else dot.classList.add('disconnected');
}

async function terracottaHost() {
    document.getElementById('terracotta-host-panel').style.display = '';
    document.getElementById('terracotta-join-panel').style.display = 'none';
    document.getElementById('terracotta-connected').style.display = 'none';
    document.getElementById('terracotta-tabs').style.display = '';
    updateTerracottaStatus('陶瓦联机 - 创建房间', '准备创建房间', 'disconnected');
    try {
        const lanResult = await fetch('/api/lan/port');
        if (lanResult.ok) {
            const data = await lanResult.json();
            if (data.port) {
                document.getElementById('terracotta-host-port').value = data.port;
            }
        }
    } catch (e) {}
}

async function terracottaJoin() {
    document.getElementById('terracotta-join-panel').style.display = '';
    document.getElementById('terracotta-host-panel').style.display = 'none';
    document.getElementById('terracotta-connected').style.display = 'none';
    document.getElementById('terracotta-tabs').style.display = '';
    updateTerracottaStatus('陶瓦联机 - 加入房间', '输入房间码加入', 'disconnected');
}

function terracottaBackToActions() {
    document.getElementById('terracotta-host-panel').style.display = '';
    document.getElementById('terracotta-join-panel').style.display = 'none';
    document.getElementById('terracotta-connected').style.display = 'none';
    document.getElementById('terracotta-tabs').style.display = '';
    const tabs = document.getElementById('terracotta-tabs');
    tabs.querySelectorAll('.lan-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
    updateTerracottaStatus('未连接', '创建房间或输入房间码加入', 'disconnected');
}

function terracottaHide() {
    document.getElementById('terracotta-host-panel').style.display = 'none';
    document.getElementById('terracotta-join-panel').style.display = 'none';
    document.getElementById('terracotta-connected').style.display = 'none';
    document.getElementById('terracotta-tabs').style.display = 'none';
    if (terracottaPollTimer) { clearInterval(terracottaPollTimer); terracottaPollTimer = null; }
    if (_terracottaPollRefresher) { clearInterval(_terracottaPollRefresher); _terracottaPollRefresher = null; }
}

async function terracottaStartHost() {
    try {
        const agreed = await terracottaShowAgreement();
        if (!agreed) return;

        const gameStatus = await API.getGameStatus();
        if (!gameStatus.running) {
            showToast('请先启动游戏，然后在游戏内开放局域网联机', 'error');
            return;
        }
        
        let gamePort = gameStatus.lanPort;
        if (!gamePort) {
            const manualPort = parseInt(document.getElementById('terracotta-host-port').value, 10);
            if (manualPort > 0 && manualPort < 65536) {
                gamePort = manualPort;
            }
        }
        if (!gamePort) {
            showToast('请在游戏内先开放局域网联机（按Esc → 对局域网开放）', 'error');
            return;
        }
        
        document.getElementById('terracotta-host-port').value = gamePort;
        
        const playerName = localStorage.getItem('cachedPlayerName') || 'Player';
        showToast('正在初始化陶瓦联机...', 'info');
        
        const result = await API.easytierHost(gamePort, playerName);
        if (result.success) {
            terracottaState = { mode: 'host', connected: true };
            
            document.getElementById('terracotta-host-panel').style.display = 'none';
            document.getElementById('terracotta-connected').style.display = '';
            document.getElementById('terracotta-addr-field').style.display = 'none';
            document.getElementById('terracotta-roomcode').textContent = '等待分配房间码...';
            document.getElementById('terracotta-conn-status').textContent = '正在创建房间...';
            document.getElementById('terracotta-hint').textContent = `已检测到局域网端口 ${gamePort}，房间创建中...`;
            document.getElementById('terracotta-hint').style.background = 'rgba(59,130,246,0.1)';
            document.getElementById('terracotta-hint').style.color = 'var(--blue)';
            
            updateTerracottaStatus('陶瓦联机 - 主机', '正在创建房间...', 'connecting');
            
            terracottaStartPolling();
        }
    } catch (e) {
        showToast('创建联机失败: ' + e.message, 'error');
    }
}

async function terracottaJoinRoom() {
    const codeText = document.getElementById('terracotta-join-code').value.trim();
    if (!codeText) {
        showToast('请输入房间码', 'error');
        return;
    }
    
    try {
        const agreed = await terracottaShowAgreement();
        if (!agreed) return;

        showToast('正在初始化陶瓦联机...', 'info');
        
        const playerName = localStorage.getItem('cachedPlayerName') || 'Player';
        const result = await API.easytierGuest(codeText, playerName);
        if (result.success) {
            terracottaState = { mode: 'guest', connected: true };
            
            document.getElementById('terracotta-join-panel').style.display = 'none';
            document.getElementById('terracotta-connected').style.display = '';
            document.getElementById('terracotta-addr-field').style.display = '';
            document.getElementById('terracotta-roomcode').textContent = '--';
            document.getElementById('terracotta-connect-addr').textContent = '等待分配...';
            document.getElementById('terracotta-conn-status').textContent = '正在连接...';
            document.getElementById('terracotta-hint').textContent = '正在连接到主机...';
            document.getElementById('terracotta-hint').style.background = 'rgba(59,130,246,0.1)';
            document.getElementById('terracotta-hint').style.color = 'var(--blue)';
            
            updateTerracottaStatus('陶瓦联机 - 客户端', '正在连接...', 'connecting');
            
            terracottaStartPolling();
        }
    } catch (e) {
        showToast('加入联机失败: ' + e.message, 'error');
    }
}

async function terracottaDisconnect() {
    try {
        await API.easytierStop();
    } catch (e) {}
    
    terracottaState = { mode: null, connected: false };
    if (terracottaPollTimer) { clearInterval(terracottaPollTimer); terracottaPollTimer = null; }
    
    terracottaBackToActions();
    showToast('已断开陶瓦联机', 'info');
}

function terracottaCopyRoomCode() {
    const code = document.getElementById('terracotta-roomcode').textContent;
    if (!code || code === '--' || code === '等待分配房间码...') return;
    window.electronAPI.clipboard.writeText(code).then(() => {
        showToast('房间码已复制！发送给朋友即可加入', 'success');
    });
}

function terracottaCopyAddr() {
    const addr = document.getElementById('terracotta-connect-addr').textContent;
    if (!addr || addr === '等待分配...') return;
    window.electronAPI.clipboard.writeText(addr).then(() => {
        showToast('连接地址已复制', 'success');
    });
}

function terracottaShowAgreement() {
    const agreementSeen = localStorage.getItem('terracotta_agreement_v2');
    if (agreementSeen) return Promise.resolve(true);
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
    modal.innerHTML = `<div style="background:var(--bg-primary);border-radius:12px;padding:24px;max-width:500px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <h3 style="margin-bottom:12px">陶瓦联机使用须知</h3>
        <div style="color:var(--text-secondary);font-size:13px;line-height:1.7;margin-bottom:16px">
            <p>陶瓦联机基于 <a href="https://github.com/EasyTier/EasyTier" style="color:var(--primary)">EasyTier</a> 开源项目，由第三方提供公共节点。</p>
            <p style="margin-top:8px">• 联机质量取决于网络环境，可能有延迟</p>
            <p>• 公共节点由社区维护，不保证100%可用</p>
            <p>• 游戏数据通过P2P加密传输，不经过服务器</p>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-primary" id="terracotta-agree-btn">我已了解，开始使用</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
    return new Promise(resolve => {
        document.getElementById('terracotta-agree-btn').onclick = () => {
            localStorage.setItem('terracotta_agreement_v2', '1');
            modal.remove();
            resolve(true);
        };
        modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(false); } };
    });
}

async function terracottaExportLog() {
    try {
        const result = await API.easytierLog();
        if (result && result.log) {
            const blob = new Blob([result.log], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `terracotta-log-${new Date().toISOString().slice(0,10)}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('日志已导出', 'success');
        } else {
            showToast('暂无日志', 'info');
        }
    } catch (e) {
        showToast('导出日志失败: ' + e.message, 'error');
    }
}

let _lastTerracottaStateIndex = -1;
let _terracottaPollFailCount = 0;

function terracottaStartPolling() {
    if (terracottaPollTimer) clearInterval(terracottaPollTimer);
    if (_terracottaPollRefresher) { clearInterval(_terracottaPollRefresher); _terracottaPollRefresher = null; }
    _lastTerracottaStateIndex = -1;
    _terracottaPollFailCount = 0;
    let pollInterval = 3000;
    let idleCount = 0;

    const doPoll = async () => {
        try {
            const result = await API.easytierStatus();
            _terracottaPollFailCount = 0;
            if (!result.running) {
                _terracottaPollFailCount++;
                if (_terracottaPollFailCount < 5) return;
                document.getElementById('terracotta-conn-status').textContent = '已断开';
                document.getElementById('terracotta-conn-status').style.color = 'var(--red)';
                clearInterval(terracottaPollTimer);
                terracottaPollTimer = null;
                return;
            }
            if (!result.state) return;

            const state = result.state;
            const stateType = state.state;
            const stateIndex = result.stateIndex || state.index || -1;

            if (stateIndex > 0 && stateIndex === _lastTerracottaStateIndex) {
                idleCount++;
                if (idleCount > 5) pollInterval = 5000;
                return;
            }
            _lastTerracottaStateIndex = stateIndex;
            idleCount = 0;
            pollInterval = 1500;
            if (terracottaPollTimer) { clearInterval(terracottaPollTimer); terracottaPollTimer = setInterval(doPoll, pollInterval); }

            const profiles = result.profiles || state.profiles || [];
            const difficulty = result.difficulty || state.difficulty || null;
            const errorType = result.errorType || null;
            const errorMessage = result.errorMessage || null;

            if (terracottaState.mode === 'host') {
                if (stateType === 'host-scanning') {
                    document.getElementById('terracotta-conn-status').textContent = '正在扫描局域网游戏...';
                    document.getElementById('terracotta-conn-status').style.color = 'var(--blue)';
                } else if (stateType === 'host-starting') {
                    document.getElementById('terracotta-conn-status').textContent = '正在启动房间...';
                    document.getElementById('terracotta-conn-status').style.color = 'var(--blue)';
                } else if (stateType === 'host-ok') {
                    const roomObj = state.room;
                    const roomCode = (typeof roomObj === 'object' && roomObj !== null) ? (roomObj.code || '') : (roomObj || result.roomCode || '');
                    document.getElementById('terracotta-roomcode').textContent = roomCode;
                    const profileText = profiles.length > 0 ? ` (${profiles.length}人已连接)` : '';
                    document.getElementById('terracotta-conn-status').textContent = '房间已创建 (P2P)' + profileText;
                    document.getElementById('terracotta-conn-status').style.color = 'var(--green)';
                    document.getElementById('terracotta-hint').textContent = '将房间码发送给朋友即可联机';
                    document.getElementById('terracotta-hint').style.background = 'rgba(16,185,129,0.1)';
                    document.getElementById('terracotta-hint').style.color = 'var(--green)';
                    updateTerracottaStatus('陶瓦联机 - 主机', `房间码: ${roomCode}`, 'connected');
                } else if (stateType === 'exception') {
                    const errMsg = errorMessage || '连接异常';
                    document.getElementById('terracotta-conn-status').textContent = errMsg;
                    document.getElementById('terracotta-conn-status').style.color = 'var(--red)';
                    document.getElementById('terracotta-hint').textContent = errorType ? `错误类型: ${errorType}` : '';
                    document.getElementById('terracotta-hint').style.background = 'rgba(239,68,68,0.1)';
                    document.getElementById('terracotta-hint').style.color = 'var(--red)';
                }
            } else if (terracottaState.mode === 'guest') {
                if (stateType === 'guest-connecting') {
                    document.getElementById('terracotta-conn-status').textContent = '正在连接...';
                    document.getElementById('terracotta-conn-status').style.color = 'var(--blue)';
                } else if (stateType === 'guest-starting') {
                    const diffMap = { 'EASIEST': '和平', 'SIMPLE': '简单', 'MEDIUM': '普通', 'TOUGH': '困难' };
                    const diffText = difficulty && difficulty !== 'UNKNOWN' ? ` | 难度: ${diffMap[difficulty] || difficulty}` : '';
                    document.getElementById('terracotta-conn-status').textContent = '正在建立P2P连接...' + diffText;
                    document.getElementById('terracotta-conn-status').style.color = 'var(--blue)';
                } else if (stateType === 'guest-ok') {
                    const rawUrl = state.url || result.virtualIP || '';
                    const connectUrl = rawUrl.startsWith('127.0.0.1') ? rawUrl : `127.0.0.1${rawUrl.includes(':') ? ':' + rawUrl.split(':').pop() : ''}`;
                    document.getElementById('terracotta-roomcode').textContent = connectUrl;
                    document.getElementById('terracotta-connect-addr').textContent = connectUrl;
                    const profileText = profiles.length > 0 ? ` (${profiles.length}人在线)` : '';
                    document.getElementById('terracotta-conn-status').textContent = '已连接 (P2P)' + profileText;
                    document.getElementById('terracotta-conn-status').style.color = 'var(--green)';
                    document.getElementById('terracotta-hint').textContent = `在Minecraft多人游戏中添加服务器地址: ${connectUrl}`;
                    document.getElementById('terracotta-hint').style.background = 'rgba(16,185,129,0.1)';
                    document.getElementById('terracotta-hint').style.color = 'var(--green)';
                    updateTerracottaStatus('陶瓦联机 - 客户端', `连接地址: ${connectUrl}`, 'connected');
                } else if (stateType === 'exception') {
                    const errMsg = errorMessage || '连接异常';
                    document.getElementById('terracotta-conn-status').textContent = errMsg;
                    document.getElementById('terracotta-conn-status').style.color = 'var(--red)';
                    document.getElementById('terracotta-hint').textContent = errorType ? `错误类型: ${errorType}` : '';
                    document.getElementById('terracotta-hint').style.background = 'rgba(239,68,68,0.1)';
                    document.getElementById('terracotta-hint').style.color = 'var(--red)';
                }
            }
        } catch (e) {
            _terracottaPollFailCount++;
            console.warn(`[Terracotta] 状态轮询失败 (连续${_terracottaPollFailCount}次):`, e.message || e);
            if (_terracottaPollFailCount >= 8) {
                document.getElementById('terracotta-conn-status').textContent = '网络连接异常，请检查网络';
                document.getElementById('terracotta-conn-status').style.color = 'var(--red)';
            }
        }
    };

    doPoll();
    terracottaPollTimer = setInterval(doPoll, pollInterval);

    _terracottaPollRefresher = setInterval(() => {
        if (terracottaPollTimer) {
            clearInterval(terracottaPollTimer);
            terracottaPollTimer = setInterval(doPoll, pollInterval);
        }
    }, 30000);
}

function updatePortmapStatus(title, desc, state) {
    document.getElementById('portmap-status-title').textContent = title;
    document.getElementById('portmap-status-desc').textContent = desc;
    const dot = document.getElementById('portmap-status-dot');
    dot.className = 'lan-status-dot';
    if (state === 'connected') dot.classList.add('connected');
    else if (state === 'connecting') dot.classList.add('connecting');
    else dot.classList.add('disconnected');
}

function portmapCreateRoom() {
    document.getElementById('portmap-create-panel').style.display = '';
    document.getElementById('portmap-join-panel').style.display = 'none';
    document.getElementById('portmap-connected').style.display = 'none';
    document.getElementById('portmap-tabs').style.display = '';
}

function portmapJoinRoom() {
    document.getElementById('portmap-join-panel').style.display = '';
    document.getElementById('portmap-create-panel').style.display = 'none';
    document.getElementById('portmap-connected').style.display = 'none';
    document.getElementById('portmap-tabs').style.display = '';
}

function portmapBackToActions() {
    document.getElementById('portmap-create-panel').style.display = '';
    document.getElementById('portmap-join-panel').style.display = 'none';
    document.getElementById('portmap-connected').style.display = 'none';
    document.getElementById('portmap-tabs').style.display = '';
    const tabs = document.getElementById('portmap-tabs');
    tabs.querySelectorAll('.lan-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
    updatePortmapStatus('未连接', '创建房间或加入朋友的房间', 'disconnected');
}

async function portmapDoCreate() {
    const name = document.getElementById('portmap-create-name').value || 'VersePC';
    const port = document.getElementById('portmap-create-port').value || '25565';
    const playerName = document.getElementById('portmap-create-player-name').value || '';
    const useUPnP = document.getElementById('portmap-create-upnp').checked;
    try {
        const res = await fetch('/api/lan/remote-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, port: parseInt(port), playerName, useUPnP })
        });
        const result = await res.json();
        if (result.success) {
            document.getElementById('portmap-create-panel').style.display = 'none';
            document.getElementById('portmap-connected').style.display = 'block';
            document.getElementById('portmap-connected-title').textContent = name;
            document.getElementById('portmap-room-addr').textContent = result.connectInfo || (result.publicIP ? result.publicIP + ':' + port : (result.localIPs && result.localIPs[0] ? result.localIPs[0] + ':' + port : '检测失败'));
            document.getElementById('portmap-room-port').textContent = port;
            if (result.upnp && result.upnp.success) {
                addPortmapLog('UPnP 端口映射成功');
            } else if (result.upnp) {
                addPortmapLog('端口映射失败: ' + (result.upnp.error || '未知'));
                addPortmapLog('提示: UPnP不可用不影响局域网联机，但远程联机需要路由器开启UPnP或手动设置端口转发');
            }
            addPortmapLog('公网IP: ' + (result.publicIP || '未检测到'));
            addPortmapLog('连接地址: ' + (result.connectInfo || '未获取'));
            updatePortmapStatus('已创建房间', '等待朋友加入...', 'connected');
        } else {
            alert('创建失败: ' + (result.error || '未知错误'));
        }
    } catch(e) {
        alert('创建失败: ' + e.message);
    }
}

function portmapDoJoin() {
    const addr = document.getElementById('portmap-join-addr').value.trim();
    const name = document.getElementById('portmap-join-name').value.trim();
    if (!addr) { alert('请输入服务器地址'); return; }
    navigator.clipboard.writeText(addr).then(() => {
        alert('已复制地址: ' + addr + '\n\n在Minecraft多人游戏中添加该地址即可加入。' + (name ? '\n建议使用名称: ' + name : ''));
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = addr;
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        alert('已复制地址: ' + addr + '\n\n在Minecraft多人游戏中添加该地址即可加入。');
    });
}

function portmapLeave() {
    document.getElementById('portmap-connected').style.display = 'none';
    document.getElementById('portmap-tabs').style.display = '';
    document.getElementById('portmap-create-panel').style.display = '';
    document.getElementById('portmap-join-panel').style.display = 'none';
    const tabs = document.getElementById('portmap-tabs');
    tabs.querySelectorAll('.lan-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
    const logEl = document.getElementById('portmap-room-log');
    if (logEl) logEl.textContent = '';
    updatePortmapStatus('未连接', '创建房间或加入朋友的房间', 'disconnected');
}

async function portmapUPnPDiagnose() {
    try {
        const res = await fetch('/api/lan/upnp-diagnose');
        const result = await res.json();
        if (result.success) {
            let msg = '=== UPnP 诊断 ===\n\n';
            msg += '平台: ' + result.platform + '\n';
            msg += 'UPnP可用: ' + (result.canUseUPnP ? '是' : '否') + '\n\n';
            msg += '检查项目:\n';
            if (result.checks) {
                result.checks.forEach((c, i) => {
                    msg += `  ${i+1}. [${c.status}] ${c.name}: ${typeof c.result === 'object' ? JSON.stringify(c.result) : c.result}\n`;
                });
            }
            if (result.recommendations && result.recommendations.length > 0) {
                msg += '\n建议:\n';
                result.recommendations.forEach((r, i) => {
                    msg += `  ${i+1}. ${r}\n`;
                });
            }
            alert(msg);
        } else {
            alert('UPnP 诊断失败: ' + (result.error || '未知错误'));
        }
    } catch(e) {
        alert('UPnP 诊断失败: ' + e.message);
    }
}

function addPortmapLog(msg) {
    const logEl = document.getElementById('portmap-room-log');
    if (!logEl) return;
    const time = new Date().toLocaleTimeString();
    logEl.textContent += `[${time}] ${msg}\n`;
    logEl.scrollTop = logEl.scrollHeight;
}

function portmapCopyAddr() {
    const addr = document.getElementById('portmap-room-addr').textContent;
    if (!addr || addr === '--') return;
    navigator.clipboard.writeText(addr).then(() => {
        const btn = document.querySelector('#portmap-connected .lan-room-field:first-child button');
        if (btn) { btn.textContent = '已复制!'; setTimeout(() => { btn.textContent = '复制'; }, 2000); }
    }).catch(() => {});
}

let accPollTimer = null;
let accDlSessionId = null;
let accDlPollTimer = null;

function accUpdateHeroBadge(statusType, text) {
    const badge = document.getElementById('acc-hero-badge');
    if (!badge) return;
    const dot = badge.querySelector('.acc-badge-dot');
    const textEl = document.getElementById('acc-badge-text');
    badge.className = 'acc-hero-status-badge';
    if (statusType === 'running') badge.classList.add('running');
    if (statusType === 'installed') badge.classList.add('installed');
    if (textEl) textEl.textContent = text;
}

async function accLoadStatus() {
    try {
        const status = await API.easytierStatus();
        const installPanel = document.getElementById('acc-install-panel');
        const controlPanel = document.getElementById('acc-control-panel');
        const joinPanel = document.getElementById('acc-join-panel');
        const peersPanel = document.getElementById('acc-peers-panel');
        const statusGrid = document.getElementById('acc-status-grid');
        const configSection = document.getElementById('acc-config-section');
        const startBtn = document.getElementById('acc-start-btn');
        const stopBtn = document.getElementById('acc-stop-btn');

        if (status.running) {
            installPanel.style.display = 'none';
            controlPanel.style.display = '';
            joinPanel.style.display = 'none';
            peersPanel.style.display = '';
            statusGrid.style.display = '';
            configSection.style.display = 'none';
            startBtn.style.display = 'none';
            stopBtn.style.display = '';

            accUpdateHeroBadge('running', '运行中');
            document.getElementById('acc-hero-desc').textContent = 'P2P 虚拟组网已启动';

            document.getElementById('acc-status-mode').textContent = status.mode === 'host' ? '主机模式' : '客户端模式';
            document.getElementById('acc-status-ip').textContent = status.virtualIP || '等待分配...';
            document.getElementById('acc-status-peers').textContent = '0';
            document.getElementById('acc-status-port').textContent = status.gamePort || 25565;

            if (status.mode === 'host') {
                document.getElementById('acc-card-invitation').style.display = '';
                document.getElementById('acc-card-connect').style.display = 'none';
                document.getElementById('acc-status-invitation').textContent = status.roomCode || '等待分配...';
            } else {
                document.getElementById('acc-card-invitation').style.display = 'none';
                document.getElementById('acc-card-connect').style.display = '';
                document.getElementById('acc-status-connect').textContent = status.virtualIP || '等待分配...';
            }

            if (status.state) {
                const stateType = status.state.state;
                if (stateType === 'host-ok' && status.state.room) {
                    const roomVal = status.state.room;
                    const roomStr = (typeof roomVal === 'object' && roomVal !== null) ? (roomVal.code || '') : roomVal;
                    document.getElementById('acc-status-invitation').textContent = roomStr;
                    document.getElementById('acc-status-peers').textContent = '1';
                } else if (stateType === 'guest-ok' && status.state.url) {
                    document.getElementById('acc-status-connect').textContent = status.state.url;
                    document.getElementById('acc-status-ip').textContent = status.state.url;
                    document.getElementById('acc-status-peers').textContent = '1';
                }
            }

            if (accPollTimer) clearInterval(accPollTimer);
            accPollTimer = setInterval(accRefreshStatus, 3000);
        } else if (status.installed || status.downloading) {
            installPanel.style.display = status.downloading ? 'none' : '';
            controlPanel.style.display = '';
            joinPanel.style.display = '';
            peersPanel.style.display = 'none';
            statusGrid.style.display = 'none';
            configSection.style.display = 'none';
            startBtn.style.display = '';
            stopBtn.style.display = 'none';
            document.getElementById('acc-download-btn').style.display = 'none';
            document.getElementById('acc-download-progress').style.display = 'none';

            if (status.downloading) {
                accUpdateHeroBadge('installed', '下载中...');
            } else {
                accUpdateHeroBadge('installed', '已就绪');
            }
            document.getElementById('acc-hero-desc').textContent = 'P2P 虚拟组网加速，降低 Minecraft 联机延迟';
        } else {
            installPanel.style.display = '';
            controlPanel.style.display = 'none';
            joinPanel.style.display = 'none';
            peersPanel.style.display = 'none';
            document.getElementById('acc-download-btn').style.display = '';
            document.getElementById('acc-download-progress').style.display = 'none';
            accUpdateHeroBadge('', '未安装');
            document.getElementById('acc-hero-desc').textContent = 'P2P 虚拟组网加速，降低 Minecraft 联机延迟';
        }
    } catch (e) {
        console.error('[Acc] Load status error:', e);
    }
}

async function accRefreshStatus() {
    try {
        const status = await API.easytierStatus();
        if (!status.running) {
            if (accPollTimer) { clearInterval(accPollTimer); accPollTimer = null; }
            accLoadStatus();
            return;
        }

        if (status.state) {
            const stateType = status.state.state;
            if (stateType === 'host-ok') {
                const roomCode = status.state.room || status.roomCode || '';
                document.getElementById('acc-status-invitation').textContent = roomCode;
                document.getElementById('acc-status-peers').textContent = '1';
            } else if (stateType === 'guest-ok') {
                const connectUrl = status.state.url || status.virtualIP || '';
                document.getElementById('acc-status-connect').textContent = connectUrl;
                document.getElementById('acc-status-ip').textContent = connectUrl;
                document.getElementById('acc-status-peers').textContent = '1';
            } else if (stateType === 'host-scanning' || stateType === 'host-starting') {
                document.getElementById('acc-status-peers').textContent = '...';
            } else if (stateType === 'guest-connecting' || stateType === 'guest-starting') {
                document.getElementById('acc-status-peers').textContent = '...';
            } else if (stateType === 'exception') {
                document.getElementById('acc-status-peers').textContent = '!';
            }
        }

        const peersResult = await API.easytierPeers();
        if (peersResult.state && peersResult.state.state === 'host-ok' && peersResult.state.room) {
            document.getElementById('acc-status-invitation').textContent = peersResult.state.room;
        }
        if (peersResult.state && peersResult.state.state === 'guest-ok' && peersResult.state.url) {
            document.getElementById('acc-status-connect').textContent = peersResult.state.url;
            document.getElementById('acc-status-ip').textContent = peersResult.state.url;
        }
    } catch (e) {
        console.error('[Acc] Refresh status error:', e);
    }
}

async function accDownload() {
    const btn = document.getElementById('acc-download-btn');
    btn.disabled = true;
    btn.textContent = '准备下载...';
    document.getElementById('acc-download-progress').style.display = '';

    try {
        const result = await API.easytierDownload();
        accDlSessionId = result.sessionId;

        if (accDlPollTimer) clearInterval(accDlPollTimer);
        accDlPollTimer = setInterval(async () => {
            try {
                const status = await API.easytierDownloadStatus(accDlSessionId);
                document.getElementById('acc-progress-fill').style.width = status.progress + '%';
                document.getElementById('acc-progress-pct').textContent = status.progress + '%';
                document.getElementById('acc-progress-status').textContent = status.status === 'downloading' ? '下载中' : status.status === 'extracting' ? '解压中' : status.status;
                document.getElementById('acc-progress-msg').textContent = status.message || '';

                if (status.status === 'completed') {
                    clearInterval(accDlPollTimer);
                    accDlPollTimer = null;
                    showToast('陶瓦联机安装完成！', 'success');
                    await accLoadStatus();
                } else if (status.status === 'error') {
                    clearInterval(accDlPollTimer);
                    accDlPollTimer = null;
                    showToast('安装失败: ' + (status.message || '未知错误'), 'error');
                    btn.disabled = false;
                    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>重新下载';
                }
            } catch (e) {
                console.warn('[Terracotta] 安装进度轮询失败:', e);
            }
        }, 500);
    } catch (e) {
        showToast('启动下载失败: ' + e.message, 'error');
        btn.disabled = false;
        btn.textContent = '下载并安装';
    }
}

async function accStartHost() {
    const portEl = document.getElementById('acc-game-port');
    const gamePort = (portEl && parseInt(portEl.value, 10)) || 25565;
    try {
        showToast('正在初始化陶瓦联机...', 'info');
        document.getElementById('acc-start-btn').disabled = true;
        document.getElementById('acc-start-btn').textContent = '初始化中...';

        const result = await API.easytierHost(gamePort);

        document.getElementById('acc-start-btn').style.display = 'none';
        document.getElementById('acc-stop-btn').style.display = '';
        document.getElementById('acc-status-grid').style.display = '';
        document.getElementById('acc-config-section').style.display = 'none';
        document.getElementById('acc-join-panel').style.display = 'none';

        accUpdateHeroBadge('running', '运行中');
        document.getElementById('acc-hero-desc').textContent = 'P2P 虚拟组网已启动';

        document.getElementById('acc-status-mode').textContent = '主机模式';
        document.getElementById('acc-status-ip').textContent = '等待分配...';
        document.getElementById('acc-status-peers').textContent = '0';
        document.getElementById('acc-status-port').textContent = gamePort;
        document.getElementById('acc-card-invitation').style.display = '';
        document.getElementById('acc-card-connect').style.display = 'none';
        document.getElementById('acc-status-invitation').textContent = '等待分配...';

        if (accPollTimer) clearInterval(accPollTimer);
        accPollTimer = setInterval(accRefreshStatus, 3000);

        showToast('陶瓦联机已启动', 'success');
    } catch (e) {
        showToast('启动失败: ' + e.message, 'error');
        document.getElementById('acc-start-btn').disabled = false;
        document.getElementById('acc-start-btn').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><polygon points="5 3 19 12 5 21 5 3"/></svg>启动加速';
    }
}

async function accJoin() {
    const codeText = document.getElementById('acc-join-code').value.trim();
    if (!codeText) {
        showToast('请输入房间码', 'error');
        return;
    }

    try {
        showToast('正在加入联机网络...', 'info');
        const joinBtn = document.querySelector('#acc-join-panel .btn-primary');
        joinBtn.disabled = true;
        joinBtn.textContent = '连接中...';

        const result = await API.easytierGuest(codeText);

        document.getElementById('acc-control-panel').style.display = '';
        document.getElementById('acc-join-panel').style.display = 'none';
        document.getElementById('acc-install-panel').style.display = 'none';
        document.getElementById('acc-peers-panel').style.display = '';
        document.getElementById('acc-status-grid').style.display = '';
        document.getElementById('acc-config-section').style.display = 'none';
        document.getElementById('acc-start-btn').style.display = 'none';
        document.getElementById('acc-stop-btn').style.display = '';

        accUpdateHeroBadge('running', '运行中');
        document.getElementById('acc-hero-desc').textContent = '已加入 P2P 联机网络';

        document.getElementById('acc-status-mode').textContent = '客户端模式';
        document.getElementById('acc-status-ip').textContent = '等待分配...';
        document.getElementById('acc-status-peers').textContent = '0';
        document.getElementById('acc-status-port').textContent = '--';
        document.getElementById('acc-card-invitation').style.display = 'none';
        document.getElementById('acc-card-connect').style.display = '';
        document.getElementById('acc-status-connect').textContent = '等待分配...';

        if (accPollTimer) clearInterval(accPollTimer);
        accPollTimer = setInterval(accRefreshStatus, 3000);

        showToast('已加入联机网络，正在连接...', 'success');
    } catch (e) {
        showToast('加入失败: ' + e.message, 'error');
        const joinBtn = document.querySelector('#acc-join-panel .btn-primary');
        if (joinBtn) {
            joinBtn.disabled = false;
            joinBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>加入联机网络';
        }
    }
}

async function accStop() {
    if (accPollTimer) { clearInterval(accPollTimer); accPollTimer = null; }
    try {
        await API.easytierStop();
        showToast('加速器已停止', 'info');
    } catch (e) {
        console.warn('[Acc] 停止加速器失败:', e);
    }
    await accLoadStatus();
}

function accCopyInvitation() {
    const code = document.getElementById('acc-status-invitation').textContent;
    if (code && code !== '--' && code !== '等待分配...') {
        window.electronAPI.clipboard.writeText(code).then(() => {
            showToast('房间码已复制', 'success');
        });
    }
}

function accCopyConnect() {
    const addr = document.getElementById('acc-status-connect').textContent;
    if (addr && addr !== '--' && addr !== '等待分配...') {
        window.electronAPI.clipboard.writeText(addr).then(() => {
            showToast('连接地址已复制', 'success');
        });
    }
}

async function loadSettingsFromLocal() {
    try {
        const raw = await window.electronAPI.store.get('versepc_settings');
        return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
    } catch (e) { return null; }
}

async function toggleMod(modId, enabled) {
    try {
        await API.toggleMod(modId, enabled);
        await loadInstalledMods();
        showToast(enabled ? '模组已启用' : '模组已禁用', 'info');
    } catch (e) { showToast('操作失败', 'error'); }
}

async function deleteMod(modId) {
    const confirmed = await showConfirmDialog('删除模组', '确定要删除此模组吗？', '删除', '取消');
    if (!confirmed) return;
    try {
        await API.deleteMod(modId);
        showToast('模组已删除', 'success');
        await loadInstalledMods();
    } catch (e) { showToast('删除失败', 'error'); }
}

function _refreshAccountAvatars() {
    const ts = Date.now();
    document.querySelectorAll('.account-avatar-img').forEach(img => {
        const src = img.src;
        if (src && src.includes('/api/avatar')) {
            img.src = src.replace(/&_=\d+/, '') + '&_=' + ts;
        }
    });
    try {
        const selectedId = localStorage.getItem('versepc_selected_account');
        if (selectedId) {
            API.getAccounts().then(accounts => {
                const selected = accounts.find(a => a.id === selectedId);
                if (selected) {
                    const accUuid = (selected.uuid || '').replace(/-/g, '');
                    if (accUuid) {
                        const serverParam = selected.serverUrl ? `&serverUrl=${encodeURIComponent(selected.serverUrl)}` : '';
                        const usernameParam = selected.username ? `&username=${encodeURIComponent(selected.username)}` : '';
                        const offlineParam = (selected.type === 'offline' && !selected.serverUrl) ? '&offline=1' : '';
                        const newUrl = `/api/avatar?uuid=${accUuid}${serverParam}${usernameParam}${offlineParam}&_=${ts}`;
                        const homeAvatar = document.getElementById('home-avatar-img');
                        if (homeAvatar) homeAvatar.src = newUrl;
                        try { localStorage.setItem('cachedAvatarUrl', newUrl); } catch(e) {}
                    }
                }
            }).catch(() => {});
        }
    } catch (e) {}
}

async function loadAccounts() {
    try {
        const [accounts, settings] = await Promise.all([
            API.getAccounts(),
            API.getSettings(),
        ]);
        const container = document.getElementById('accounts-list');

        if (accounts.length === 0) {
            container.innerHTML = '<p class="empty-text">暂无账户，请添加账户</p>';
        } else {
            container.innerHTML = accounts.map(acc => {
                const isSelected = acc.id === settings.selectedAccount;
                const typeLabel = acc.type === 'microsoft' ? '微软账户' : acc.type === 'thirdparty' ? '外置登录' : '离线账户';
                const typeClass = acc.type === 'microsoft' ? 'microsoft' : acc.type === 'thirdparty' ? 'thirdparty' : 'offline';
                const accUuid = (acc.uuid || '').replace(/-/g, '');
                let skinUrl = '';
                if (accUuid) {
                    const serverParam = acc.serverUrl ? `&serverUrl=${encodeURIComponent(acc.serverUrl)}` : '';
                    const usernameParam = acc.username ? `&username=${encodeURIComponent(acc.username)}` : '';
                    const offlineParam = (acc.type === 'offline' && !acc.serverUrl) ? '&offline=1' : '';
                    skinUrl = `/api/avatar?uuid=${accUuid}${serverParam}${usernameParam}${offlineParam}`;
                }
                const avatarHtml = skinUrl
                    ? `<img src="${skinUrl}" alt="" class="account-avatar-img">`
                    : `<span class="account-avatar-text">${acc.username.charAt(0).toUpperCase()}</span>`;
                return `<div class="account-item ${isSelected ? 'selected' : ''}" onclick="showAccountDetail('${acc.id}')">
                    <div class="account-avatar">${avatarHtml}</div>
                    <div class="account-item-info">
                        <div class="account-item-name">${escapeHtml(acc.username)}</div>
                        <div class="account-item-uuid">${acc.uuid}</div>
                        <div class="account-item-type ${typeClass}">${typeLabel}</div>
                    </div>
                    <div class="mod-actions">
                        ${!isSelected ? `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); selectAccount('${acc.id}')">选择</button>` : '<span style="color: var(--accent); font-size: 12px; padding: 4px 10px; display: inline-flex; align-items: center;">当前使用</span>'}
                        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteAccount('${acc.id}')">删除</button>
                    </div>
                </div>`;
            }).join('');
            
            container.querySelectorAll('.account-avatar-img').forEach(img => {
                img.onerror = function() {
                    const avatarDiv = this.parentElement;
                    if (avatarDiv) {
                        this.style.display = 'none';
                        const accItem = avatarDiv.closest('.account-item');
                        const accType = accItem?.querySelector('.account-item-type')?.textContent;
                        if (true) {
                            const origSrc = this.src.split('&_=')[0];
                            setTimeout(() => {
                                const retryImg = document.createElement('img');
                                retryImg.src = origSrc + '&_=' + Date.now();
                                retryImg.className = 'account-avatar-img';
                                retryImg.onerror = function() { retryImg.style.display = 'none'; };
                                retryImg.onload = function() {
                                    avatarDiv.innerHTML = '';
                                    avatarDiv.appendChild(retryImg);
                                };
                            }, 2000);
                        }
                    }
                };
            });
        }

        const selectedAccount = accounts.find(a => a.id === settings.selectedAccount) || accounts[0];
        if (selectedAccount) {
            const accUuid = (selectedAccount.uuid || '').replace(/-/g, '');
            let accSkinUrl = '';
            if (accUuid) {
                const serverParam = selectedAccount.serverUrl ? `&serverUrl=${encodeURIComponent(selectedAccount.serverUrl)}` : '';
                const usernameParam = selectedAccount.username ? `&username=${encodeURIComponent(selectedAccount.username)}` : '';
                const offlineParam = (selectedAccount.type === 'offline' && !selectedAccount.serverUrl) ? '&offline=1' : '';
                accSkinUrl = `/api/avatar?uuid=${accUuid}${serverParam}${usernameParam}${offlineParam}&_=${AVATAR_CACHE_VERSION}`;
            }
            
            document.getElementById('home-player-name').textContent = selectedAccount.username;
            const accountTypeText = selectedAccount.type === 'microsoft' ? '微软账户' : selectedAccount.type === 'thirdparty' ? '外置登录' : '离线模式';
            document.getElementById('home-account-type').textContent = accountTypeText;
            try { localStorage.setItem('cachedPlayerName', selectedAccount.username); localStorage.setItem('cachedAccountType', accountTypeText); } catch(e) {}
            
            const homeAvatar = document.getElementById('home-avatar');
            if (accSkinUrl) {
                homeAvatar.innerHTML = '';
                homeAvatar.style.backgroundImage = '';
                const img = document.createElement('img');
                img.src = accSkinUrl;
                img.className = 'account-avatar-img';
                img.width = 64;
                img.height = 64;
                img.onload = function() {
                    try {
                        localStorage.setItem('cachedAvatarUrl', accSkinUrl);
                        localStorage.setItem('cachedAvatarId', selectedAccount.id);
                        const canvas = document.createElement('canvas');
                        canvas.width = 64; canvas.height = 64;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, 64, 64);
                        const dataUrl = canvas.toDataURL('image/png');
                        if (dataUrl && dataUrl.length > 100) {
                            localStorage.setItem('cachedAvatarData', dataUrl);
                        }
                    } catch(e) {}
                };
                img.onerror = function() {
                    img.style.display = 'none';
                    if (true) {
                        setTimeout(() => {
                            const retryImg = document.createElement('img');
                            retryImg.src = accSkinUrl.split('&_=')[0] + '&_=' + Date.now();
                            retryImg.className = 'account-avatar-img';
                            retryImg.width = 64;
                            retryImg.height = 64;
                            retryImg.onload = function() {
                                homeAvatar.innerHTML = '';
                                homeAvatar.appendChild(retryImg);
                            };
                        }, 2000);
                    }
                };
                homeAvatar.appendChild(img);
                if (selectedAccount.type === 'microsoft' || selectedAccount.type === 'thirdparty') {
                    const baseUrl = accSkinUrl.split('&_=')[0];
                    const scheduleRetry = (delay, attempt) => {
                        setTimeout(async () => {
                            try {
                                const probe = await fetch(baseUrl + '&_=' + Date.now(), { method: 'HEAD' });
                                if (probe.headers.get('X-Avatar-Fallback') === 'true' && attempt < 5) {
                                    scheduleRetry(Math.min(delay * 1.5, 30000), attempt + 1);
                                    return;
                                }
                                if (probe.ok) {
                                    const retryImg = document.createElement('img');
                                    retryImg.src = baseUrl + '&_=' + Date.now();
                                    retryImg.className = 'account-avatar-img';
                                    retryImg.width = 64;
                                    retryImg.height = 64;
                                    retryImg.onload = function() {
                                        homeAvatar.innerHTML = '';
                                        homeAvatar.appendChild(retryImg);
                                        try {
                                            const canvas = document.createElement('canvas');
                                            canvas.width = 64; canvas.height = 64;
                                            const ctx = canvas.getContext('2d');
                                            ctx.drawImage(retryImg, 0, 0, 64, 64);
                                            const dataUrl = canvas.toDataURL('image/png');
                                            if (dataUrl && dataUrl.length > 100) {
                                                localStorage.setItem('cachedAvatarData', dataUrl);
                                            }
                                        } catch(e) {}
                                    };
                                }
                            } catch(e) {}
                        }, delay);
                    };
                    scheduleRetry(4000, 0);
                }
            }
            
            document.getElementById('launch-player-name').textContent = selectedAccount.username;
            const launchAvatar = document.getElementById('launch-avatar');
            if (accSkinUrl) {
                launchAvatar.innerHTML = '';
                launchAvatar.style.backgroundImage = '';
                const img2 = document.createElement('img');
                img2.src = accSkinUrl;
                img2.className = 'account-avatar-img';
                img2.onerror = function() {
                    img2.style.display = 'none';
                    if (true) {
                        setTimeout(() => {
                            const retryImg2 = document.createElement('img');
                            retryImg2.src = accSkinUrl.split('&_=')[0] + '&_=' + Date.now();
                            retryImg2.className = 'account-avatar-img';
                            retryImg2.onload = function() {
                                launchAvatar.innerHTML = '';
                                launchAvatar.appendChild(retryImg2);
                            };
                        }, 2000);
                    }
                };
                launchAvatar.appendChild(img2);
            }
        } else {
            const homeAvatar = document.getElementById('home-avatar');
            homeAvatar.innerHTML = '<img src="img/icon.png" alt="" class="account-avatar-img">';
            document.getElementById('home-player-name').textContent = '未登录';
            document.getElementById('home-account-type').textContent = '离线模式';
            const launchAvatar = document.getElementById('launch-avatar');
            launchAvatar.innerHTML = '<img src="img/icon.png" alt="" class="account-avatar-img">';
            document.getElementById('launch-player-name').textContent = 'Player';
        }
    } catch (e) { console.error('[Accounts] Failed to update account display:', e); }
}

async function selectAccount(accountId) {
    try {
        await API.selectAccount(accountId);
        await loadAccounts();
        showToast('已切换账户', 'info');
    } catch (e) { showToast('切换失败', 'error'); }
}

async function deleteAccount(accountId) {
    const confirmed = await showConfirmDialog('删除账户', '确定要删除此账户吗？', '删除', '取消');
    if (!confirmed) return;
    try {
        await API.deleteAccount(accountId);
        await loadAccounts();
        showToast('账户已删除', 'success');
    } catch (e) { showToast('删除失败', 'error'); }
}

let _currentDetailAccount = null;
let _skinViewer = null;
let _skinResizeObserver = null;
let _currentSkinBg = 'white';

function showAccountDetail(accountId) {
    API.getAccounts().then(accounts => {
        const acc = accounts.find(a => a.id === accountId);
        if (!acc) return;
        _currentDetailAccount = acc;
        const accUuid = (acc.uuid || '').replace(/-/g, '');
        const skinUrl = accUuid ? `/api/skin-texture?uuid=${accUuid}${acc.serverUrl ? '&serverUrl=' + encodeURIComponent(acc.serverUrl) : ''}${acc.username ? '&username=' + encodeURIComponent(acc.username) : ''}` : '';
        document.getElementById('detail-username').textContent = acc.username;
        document.getElementById('detail-uuid').textContent = acc.uuid || '-';
        const typeMap = { microsoft: '正版', thirdparty: '外置登录', offline: '离线' };
        const badgeLabel = typeMap[acc.type] || '离线';
        document.getElementById('detail-skin-type').textContent = badgeLabel;
        const typeEl = document.getElementById('detail-account-type');
        if (typeEl) typeEl.textContent = badgeLabel;
        document.getElementById('accounts-list').style.display = 'none';
        const header = document.querySelector('#page-accounts .page-header');
        if (header) header.style.display = 'none';
        const pageAccounts = document.getElementById('page-accounts');
        const activePage = pageAccounts.closest('.page.active') || pageAccounts.parentElement;
        if (activePage) {
            pageAccounts.style.height = activePage.clientHeight + 'px';
        }
        pageAccounts.style.overflow = 'hidden';
        document.getElementById('page-account-detail').style.display = '';
        setSkinBg(_currentSkinBg);
        initSkinViewer(skinUrl);
        loadSkinSelector(acc);
    });
}

function showAccountList() {
    document.getElementById('page-account-detail').style.display = 'none';
    document.getElementById('accounts-list').style.display = '';
    const header = document.querySelector('#page-accounts .page-header');
    if (header) header.style.display = '';
    const pageAccounts = document.getElementById('page-accounts');
    pageAccounts.style.height = '';
    pageAccounts.style.overflow = '';
    destroySkinViewer();
    _currentDetailAccount = null;
}

function destroySkinViewer() {
    if (_skinResizeObserver) {
        try { _skinResizeObserver.disconnect(); } catch (e) {}
        _skinResizeObserver = null;
    }
    if (_skinViewer) {
        try { _skinViewer.dispose(); } catch (e) {}
        _skinViewer = null;
    }
    const container = document.getElementById('skin-3d-container');
    if (container) container.innerHTML = '';
}

async function initSkinViewer(skinUrl) {
    destroySkinViewer();
    const container = document.getElementById('skin-3d-container');
    if (!container) return;
    try {
        if (typeof skinview3d === 'undefined') {
            container.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-secondary);font-size:14px;gap:8px;"><span style="font-size:24px;">⏳</span><span>正在加载皮肤查看器...</span></div>';
            await _lazyLoadScript('js/skinview3d.bundle.js');
        }
        let skinModel = (_currentDetailAccount?.skinModel === 'slim') ? 'slim' : 'default';
        if (skinUrl) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const probe = await fetch(skinUrl.replace(/&_=\d+/, ''), { method: 'HEAD', signal: controller.signal });
                clearTimeout(timeoutId);
                const headerModel = probe.headers.get('X-Skin-Model');
                if (headerModel === 'slim' || headerModel === 'default') skinModel = headerModel;
            } catch (e) {}
        }
        if (_currentDetailAccount) _currentDetailAccount._resolvedSkinModel = skinModel;
        await new Promise(r => setTimeout(r, 100));
        const cw = container.clientWidth || 360;
        const ch = container.clientHeight || 420;
        _skinViewer = new skinview3d.SkinViewer({
            width: cw,
            height: ch,
            skin: skinUrl || undefined,
            model: skinModel
        });
        container.appendChild(_skinViewer.canvas);
        _skinViewer.fov = 30;
        _skinViewer.zoom = 0.85;
        _skinViewer.autoRotate = true;
        _skinViewer.autoRotateSpeed = 0.5;
        _skinViewer.animation = new skinview3d.IdleAnimation();
        _skinViewer.animation.speed = 0.8;
        _skinViewer.cameraLight.intensity = 1.2;
        _skinViewer.globalLight.intensity = 2.5;
        _skinViewer.background = _currentSkinBg === 'black' ? 0x000000 : 0xffffff;
        _skinViewer.nameTag = _currentDetailAccount ? _currentDetailAccount.username : null;
        _skinResizeObserver = new ResizeObserver(() => {
            if (_skinViewer && container) {
                const w = container.clientWidth;
                const h = container.clientHeight;
                if (w > 0 && h > 0) _skinViewer.setSize(w, h);
            }
        });
        _skinResizeObserver.observe(container);
    } catch (e) {
        console.error('[SkinViewer] init error:', e);
        container.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-secondary);font-size:14px;gap:8px;"><span style="font-size:32px;">👤</span><span>皮肤加载失败</span><span style="font-size:12px;color:var(--text-tertiary);">请检查网络连接或重新登录</span></div>';
    }
}

async function detailSelectAccount() {
    if (!_currentDetailAccount) return;
    await selectAccount(_currentDetailAccount.id);
    showAccountList();
}

async function detailDeleteAccount() {
    if (!_currentDetailAccount) return;
    await deleteAccount(_currentDetailAccount.id);
    showAccountList();
}

async function detailRefreshSkin() {
    if (!_currentDetailAccount || !_skinViewer) return;
    const acc = _currentDetailAccount;
    const accUuid = (acc.uuid || '').replace(/-/g, '');
    if (!accUuid) { showToast('无UUID', 'error'); return; }
    const skinUrl = `/api/skin-texture?uuid=${accUuid}${acc.serverUrl ? '&serverUrl=' + encodeURIComponent(acc.serverUrl) : ''}${acc.username ? '&username=' + encodeURIComponent(acc.username) : ''}&_=${Date.now()}`;
    try {
        let skinModel = (_currentDetailAccount?.skinModel === 'slim') ? 'slim' : 'default';
        try {
            const probe = await fetch(skinUrl.replace(/&_=\d+/, ''), { method: 'HEAD' });
            const headerModel = probe.headers.get('X-Skin-Model');
            if (headerModel === 'slim' || headerModel === 'default') skinModel = headerModel;
        } catch (e) {}
        _currentDetailAccount._resolvedSkinModel = skinModel;
        await _skinViewer.loadSkin(skinUrl, { model: skinModel });
        _refreshAccountAvatars();
        showToast('皮肤已刷新', 'success');
    } catch (e) {
        showToast('皮肤刷新失败', 'error');
    }
}

function copyDetailUuid() {
    const uuidEl = document.getElementById('detail-uuid');
    if (!uuidEl) return;
    const text = uuidEl.textContent;
    if (!text || text === '-') return;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => showToast('UUID已复制', 'success'));
    } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('UUID已复制', 'success');
    }
}

function setAnim(type) {
    if (!_skinViewer) return;
    const animMap = {
        idle: () => new skinview3d.IdleAnimation(),
        walk: () => new skinview3d.WalkingAnimation(),
        run: () => new skinview3d.RunningAnimation(),
        fly: () => new skinview3d.FlyingAnimation(),
        wave: () => new skinview3d.WaveAnimation(),
        crouch: () => new skinview3d.CrouchAnimation(),
        hit: () => new skinview3d.HitAnimation(),
        swim: () => new skinview3d.SwimAnimation()
    };
    const factory = animMap[type];
    if (!factory) return;
    _skinViewer.animation = factory();
    const speedMap = { idle: 0.6, walk: 0.8, run: 0.6, fly: 0.8, wave: 0.8, crouch: 0.5, hit: 0.9, swim: 0.7 };
    _skinViewer.animation.speed = speedMap[type] || 0.7;
    document.querySelectorAll('.acct-anim-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.anim === type);
    });
}

function setSkinBg(color) {
    _currentSkinBg = color;
    const left = document.getElementById('acct-detail-left');
    if (left) {
        left.classList.toggle('bg-black', color === 'black');
    }
    if (_skinViewer) {
        _skinViewer.background = color === 'black' ? 0x000000 : 0xffffff;
    }
    document.querySelectorAll('.acct-bg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.bg === color);
    });
}

async function loadSkinSelector(acc) {
    const container = document.getElementById('acct-skin-grid');
    const section = document.getElementById('acct-detail-skins');
    if (!container || !section) return;
    if (acc.type !== 'offline') {
        section.style.display = 'none';
        return;
    }
    section.style.display = '';
    container.innerHTML = '';
    try {
        const resp = await fetch('/api/default-skins');
        const data = await resp.json();
        if (!data.success || !data.skins) return;
        const currentSkinFile = acc.skinFile || 'steve_skin.png';
        const allSkins = data.skins.slice();
        if (currentSkinFile && currentSkinFile.startsWith('custom_') && !allSkins.some(s => s.file === currentSkinFile)) {
            allSkins.push({ id: 'custom', name: '自定义', file: currentSkinFile, model: acc.skinModel || 'default' });
        }
        allSkins.forEach(skin => {
            const div = document.createElement('div');
            div.className = 'acct-skin-item' + (skin.file === currentSkinFile ? ' active' : '');
            div.title = skin.name;
            div.onclick = () => selectSkin(skin.id, skin.file);
            const canvas = document.createElement('canvas');
            canvas.width = 8;
            canvas.height = 8;
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.imageRendering = 'pixelated';
            div.appendChild(canvas);
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function() {
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 8, 8);
            };
            if (skin.id === 'custom') {
                const accUuid = (acc.uuid || '').replace(/-/g, '');
                img.src = accUuid ? `/api/skin-head?uuid=${accUuid}&file=${encodeURIComponent(skin.file)}` : `/api/skin-head?id=steve`;
            } else {
                img.src = `/api/skin-head?id=${skin.id}`;
            }
            container.appendChild(div);
        });
    } catch (e) {}
}

async function selectSkin(skinId, skinFile) {
    if (!_currentDetailAccount) return;
    try {
        if (skinId === 'custom') {
            _currentDetailAccount.skinFile = skinFile;
            const accUuid = (_currentDetailAccount.uuid || '').replace(/-/g, '');
            const skinUrl = `/api/skin-texture?uuid=${accUuid}&_=${Date.now()}`;
            if (_skinViewer) await _skinViewer.loadSkin(skinUrl);
            loadSkinSelector(_currentDetailAccount);
            _refreshAccountAvatars();
            return;
        }
        const resp = await fetch('/api/set-account-skin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId: _currentDetailAccount.id, skinId })
        });
        const result = await resp.json();
        if (!result.success) { showToast('更换失败', 'error'); return; }
        _currentDetailAccount.skinFile = skinFile;
        const accUuid = (_currentDetailAccount.uuid || '').replace(/-/g, '');
        const skinUrl = `/api/skin-texture?uuid=${accUuid}&_=${Date.now()}`;
        if (_skinViewer) {
            await _skinViewer.loadSkin(skinUrl);
        }
        loadSkinSelector(_currentDetailAccount);
        _refreshAccountAvatars();
        showToast('皮肤已更换', 'success');
    } catch (e) {
        showToast('更换失败', 'error');
    }
}

async function handleSkinUpload(input) {
    if (!input.files || !input.files[0] || !_currentDetailAccount) return;
    const file = input.files[0];
    if (!file.name.toLowerCase().endsWith('.png')) {
        showToast('请选择 PNG 格式的皮肤文件', 'error');
        input.value = '';
        return;
    }
    showToast('正在上传…', 'info');
    try {
        const fileBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result;
                const base64 = dataUrl.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        const modelSelect = document.getElementById('skin-model-select') || document.querySelector('input[name="skin-model"]:checked');
        let modelValue = 'default';
        if (modelSelect) {
            modelValue = modelSelect.value || modelSelect.getAttribute('data-model') || 'default';
        }
        const resp = await fetch('/api/upload-skin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accountId: _currentDetailAccount.id,
                model: modelValue,
                fileBase64: fileBase64
            })
        });
        const text = await resp.text();
        let result;
        try { result = JSON.parse(text); } catch (e) { showToast('上传失败: 服务器返回异常', 'error'); return; }
        if (result.success) {
            _currentDetailAccount.skinFile = result.fileName;
            const accUuid = (_currentDetailAccount.uuid || '').replace(/-/g, '');
            const skinUrl = `/api/skin-texture?uuid=${accUuid}&_=${Date.now()}`;
            if (_skinViewer) await _skinViewer.loadSkin(skinUrl);
            loadSkinSelector(_currentDetailAccount);
            _refreshAccountAvatars();
            showToast('皮肤已导入', 'success');
        } else {
            showToast(result.error || '上传失败', 'error');
        }
    } catch (e) {
        showToast('上传失败', 'error');
    }
    input.value = '';
}

async function startMsAuth() {
    showModal('msauth-modal');
    document.getElementById('msauth-status-text').textContent = '获取设备码中...';
    try {
        const result = await API.getMsDeviceCode();
        if (result.success) {
            const verifyUrl = result.verificationUriComplete || result.verificationUri;
            document.getElementById('msauth-url').href = verifyUrl;
            document.getElementById('msauth-url').textContent = verifyUrl;
            document.getElementById('msauth-code-text').textContent = result.userCode;
            document.getElementById('msauth-status-text').textContent = '等待登录...';

            try {
                await window.electronAPI?.clipboard?.writeText(result.userCode);
            } catch (e) {}

            setTimeout(async () => {
                try {
                    await window.electronAPI?.openExternal?.(verifyUrl);
                } catch (e) {
                    console.warn('[Auth] 自动打开浏览器失败:', e);
                }
            }, 500);

            if (msAuthPollInterval) clearInterval(msAuthPollInterval);
            msAuthPollInterval = setInterval(async () => {
                try {
                    const pollResult = await API.pollMsAuth(result.deviceCode);
                    if (pollResult.success) {
                        clearInterval(msAuthPollInterval);
                        msAuthPollInterval = null;
                        document.getElementById('msauth-status-text').textContent = '登录成功！';
                        showToast(`欢迎，${pollResult.account.username}！`, 'success');
                        setTimeout(() => closeMsAuthModal(), 1500);
                        await loadAccounts();
                    } else if (pollResult.pending) {
                        document.getElementById('msauth-status-text').textContent = '等待验证...';
                    } else {
                        let errMsg = pollResult.error || '验证失败';
                        if (pollResult.needPurchase) errMsg = '❌ 该账号未购买Minecraft，请先购买游戏';
                        else if (pollResult.needCreateProfile) errMsg = '❌ 未找到档案，请先在 Minecraft.net 创建角色名';
                        else if (pollResult.isRateLimit) errMsg = `⏳ 请求过于频繁，请等待 ${pollResult.retryAfter || 5} 秒后重试`;
                        else if (pollResult.xerr) errMsg = `❌ Xbox认证失败 (${pollResult.xerr})`;
                        document.getElementById('msauth-status-text').textContent = errMsg;
                        if (pollResult.needPurchase || pollResult.needCreateProfile || pollResult.errorCode === 'invalid_grant') {
                            clearInterval(msAuthPollInterval);
                            msAuthPollInterval = null;
                        }
                    }
                } catch (e) {
                    console.warn('[Auth] 微软登录轮询失败:', e);
                }
            }, (result.interval || 5) * 1000);
        } else {
            const errMsg = result.error || '获取设备码失败';
            document.getElementById('msauth-status-text').textContent = errMsg;
        }
    } catch (e) {
        const msg = e?.message || e?.error || '请求失败';
        document.getElementById('msauth-status-text').textContent = msg.includes('网络') || msg.includes('超时') ? '网络连接失败，请检查网络后重试' : msg;
    }
}

function closeMsAuthModal() {
    hideModal('msauth-modal');
    if (msAuthPollInterval) { clearInterval(msAuthPollInterval); msAuthPollInterval = null; }
}

function closeOfflineModal() {
    hideModal('offline-account-modal');
    document.getElementById('offline-username-input').value = '';
}

function copyMsCode() {
    const code = document.getElementById('msauth-code-text').textContent;
    window.electronAPI.clipboard.writeText(code).then(() => showToast('代码已复制', 'success'));
}

async function reopenMsAuthPage() {
    if (msAuthPollInterval) { clearInterval(msAuthPollInterval); msAuthPollInterval = null; }
    startMsAuth();
}

function closeThirdPartyModal() {
    hideModal('thirdparty-account-modal');
    document.getElementById('tp-username-input').value = '';
    document.getElementById('tp-password-input').value = '';
    document.getElementById('tp-server-info').style.display = 'none';
}

async function verifyThirdPartyServer(url) {
    const infoDiv = document.getElementById('tp-server-info');
    try {
        const result = await API.verifyThirdPartyServer(url);
        if (result.success) {
            document.getElementById('tp-server-name').textContent = result.meta?.serverName || '未知服务器';
            document.getElementById('tp-server-desc').textContent = result.meta?.implementationName || url;
            if (result.meta?.serverIcon) {
                document.getElementById('tp-server-icon').src = result.meta.serverIcon;
                document.getElementById('tp-server-icon').style.display = '';
            }
            infoDiv.style.display = '';
        } else {
            infoDiv.style.display = 'none';
        }
    } catch (e) {
        infoDiv.style.display = 'none';
    }
}

function cropSkinHeadCanvas(imgElement, outputSize = 64) {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const sw = imgElement.naturalWidth || imgElement.width;
        const sh = imgElement.naturalHeight || imgElement.height;
        if (sw < 64 || sh < 32) return null;
        const scale = sw / 64;
        canvas.width = outputSize;
        canvas.height = outputSize;
        ctx.imageSmoothingEnabled = false;
        const headX = Math.round(8 * scale), headY = Math.round(8 * scale), headDim = Math.round(8 * scale);
        ctx.drawImage(imgElement, headX, headY, headDim, headDim, 0, 0, outputSize, outputSize);
        if (sh >= 64) {
            const hatX = Math.round(40 * scale), hatY = Math.round(8 * scale);
            const hatCanvas = document.createElement('canvas');
            hatCanvas.width = outputSize;
            hatCanvas.height = outputSize;
            const hatCtx = hatCanvas.getContext('2d');
            hatCtx.imageSmoothingEnabled = false;
            hatCtx.drawImage(imgElement, hatX, hatY, headDim, headDim, 0, 0, outputSize, outputSize);
            const hatData = hatCtx.getImageData(0, 0, outputSize, outputSize);
            const faceData = ctx.getImageData(0, 0, outputSize, outputSize);
            for (let i = 0; i < hatData.data.length; i += 4) {
                const ha = hatData.data[i + 3] / 255;
                if (ha > 0) {
                    const fa = faceData.data[i + 3] / 255;
                    const outA = ha + fa * (1 - ha);
                    if (outA > 0) {
                        const invA = 1 / outA;
                        faceData.data[i]     = Math.round((hatData.data[i] * ha + faceData.data[i] * fa * (1 - ha)) * invA);
                        faceData.data[i + 1] = Math.round((hatData.data[i+1] * ha + faceData.data[i+1] * fa * (1 - ha)) * invA);
                        faceData.data[i + 2] = Math.round((hatData.data[i+2] * ha + faceData.data[i+2] * fa * (1 - ha)) * invA);
                        faceData.data[i + 3] = Math.round(outA * 255);
                    }
                }
            }
            ctx.putImageData(faceData, 0, 0);
        }
        return canvas.toDataURL('image/png');
    } catch (e) {
        console.error('[cropSkinHeadCanvas] error:', e);
        return null;
    }
}

let tpPendingAuth = null;

function showProfileSelectModal(accessToken, clientToken, serverUrl, profiles) {
    tpPendingAuth = { accessToken, clientToken, serverUrl };
    const container = document.getElementById('tp-profile-list');
    container.innerHTML = profiles.map(p => {
        const pUuid = (p.id || '').replace(/-/g, '');
        const pServerParam = serverUrl ? `&serverUrl=${encodeURIComponent(serverUrl)}` : '';
        const pUsernameParam = p.name ? `&username=${encodeURIComponent(p.name)}` : '';
        const pSkinUrl = `/api/avatar?uuid=${pUuid}${pServerParam}${pUsernameParam}`;
        return `
        <div class="profile-select-item" onclick="selectThirdPartyProfile('${escapeOnclick(p.id)}', '${escapeOnclick(p.name)}')">
            <img src="${escapeHtml(pSkinUrl)}" alt="" class="profile-select-avatar" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="profile-select-avatar-fallback" style="display:none;width:40px;height:40px;background:var(--bg-tertiary);border-radius:6px;align-items:center;justify-content:center;font-size:18px;color:var(--text-secondary);">${p.name.charAt(0).toUpperCase()}</div>
            <div class="profile-select-info">
                <div class="profile-select-name">${escapeHtml(p.name)}</div>
                <div class="profile-select-uuid">${p.id}</div>
            </div>
            <button class="btn btn-primary btn-sm">选择</button>
        </div>
    `;
    }).join('');
    container.querySelectorAll('.profile-select-avatar').forEach(img => {
        img.onload = function() {
            const w = this.naturalWidth || this.width;
            const h = this.naturalHeight || this.height;
            const isFullSkin = (w === 64 && (h === 64 || h === 32)) || w === 128 || w === 256;
            if (isFullSkin) {
                const cropped = cropSkinHeadCanvas(this, 64);
                if (cropped) {
                    this.onload = null;
                    this.src = cropped;
                }
            }
        };
    });
    showModal('tp-profile-select-modal');
}

function closeProfileSelectModal() {
    hideModal('tp-profile-select-modal');
    tpPendingAuth = null;
}

async function selectThirdPartyProfile(profileId, profileName) {
    if (!tpPendingAuth) return;
    showToast('正在选择角色...', 'info');
    try {
        const result = await API.selectThirdPartyProfile(
            tpPendingAuth.accessToken,
            tpPendingAuth.clientToken,
            tpPendingAuth.serverUrl,
            profileId,
            profileName
        );
        if (result.success) {
            showToast(`欢迎，${result.account.username}！`, 'success');
            closeProfileSelectModal();
            await loadAccounts();
        } else {
            showToast(result.error || '角色选择失败', 'error');
        }
    } catch (e) {
        showToast('角色选择失败', 'error');
    }
}

// ============================================================================
// 游戏启动流程 - 检查依赖、显示启动模态框、处理进度
// ============================================================================
async function handleLaunch() {
    if (window._versepc_launching) {
        if (typeof showToast === 'function') showToast('正在启动中，请稍候...', 'info');
        return;
    }
    window._versepc_launching = true;
    setTimeout(() => { window._versepc_launching = false; }, 30000);

    const versionId = launchVersionCustomSelect ? launchVersionCustomSelect.getValue() : '';
    if (!versionId) { showToast('请选择游戏版本', 'error'); window._versepc_launching = false; return; }

    _cachedLastLaunchVersion = versionId;
    try { await window.electronAPI.store.set('versepc_last_launch_version', versionId); } catch (_) {}

    const launchBtn = document.getElementById('launch-btn');
    const homeLaunchBtn = document.getElementById('home-launch-btn');

    launchBtn.disabled = true;
    homeLaunchBtn.disabled = true;

    _launchCounted = false;

    showLaunchModal();
    hideLaunchError();

    try {
        setLaunchStep('auth', 'running', '正在验证登录状态...');
        const accountsResult = await API.getAccounts();
        const accounts = Array.isArray(accountsResult) ? accountsResult : (accountsResult.accounts || []);
        if (accounts.length === 0) {
            setLaunchStep('auth', 'failed', '未登录，请先添加账户');
            showLaunchError('未登录，请先在账户管理中添加账户后再启动游戏。');
            window._versepc_launching = false;
            launchBtn.disabled = false;
            homeLaunchBtn.disabled = false;
            return;
        }
        setLaunchStep('auth', 'success', '登录验证通过');

        setLaunchStep('java-check', 'running', '正在检测 Java 环境...');
        
        let externalVersionDir = null;
        try {
            const vInfo = await API.getVersions();
            if (vInfo && vInfo.versions) {
                const v = vInfo.versions.find(x => x.id === versionId);
                if (v && v.externalDir) externalVersionDir = v.externalDir;
            }
        } catch (_) {}
        const depCheck = await API.launchCheck(versionId, externalVersionDir);
        const requiredJava = (depCheck.java && depCheck.java.required) || 21;
        
        console.log(`[Launch] 版本 ${versionId} 需要Java ${requiredJava}+`);
        
        if (!depCheck.java || !depCheck.java.ok) {
            const requiredVer = requiredJava;
            const maxVer = depCheck.java.maxVersion;
            const rangeDesc = maxVer && maxVer < 999 ? `${requiredVer}~${maxVer}` : `${requiredVer}+`;
            const serverMsg = depCheck.java.message || '';
            setLaunchStep('java-check', 'error', `未找到 Java ${rangeDesc}`);
            const detailMsg = serverMsg || `未找到合适的Java运行环境（需要 Java ${rangeDesc}）`;
            showLaunchError(`${detailMsg}<br><a href="#" onclick="event.preventDefault();closeLaunchModal();navigateToPage('java')" style="color:var(--accent);text-decoration:underline;cursor:pointer;">前往 Java 管理页面 →</a>`);
            launchBtn.disabled = false;
            homeLaunchBtn.disabled = false;
            window._versepc_launching = false;
            return;
        }
        
        setLaunchStep('java-check', 'success', depCheck.java.message || `Java ${depCheck.java.version} ✓`);

        setLaunchStep('version-resolve', 'running', '正在解析版本信息...');
        await new Promise(r => setTimeout(r, 200));
        setLaunchStep('version-resolve', 'success', '版本信息解析完成');

        setLaunchStep('files-check', 'running', '正在检查文件完整性...');
        
        if (depCheck.mainJar) {
            if (depCheck.mainJar.ok) {
                setLaunchStep('files-check', 'success', depCheck.mainJar.message);
            } else {
                setLaunchStep('files-check', 'error', depCheck.mainJar.message);
                showLaunchError(depCheck.mainJar.message);
                launchBtn.disabled = false;
                homeLaunchBtn.disabled = false;
                window._versepc_launching = false;
                return;
            }
        } else {
            setLaunchStep('files-check', 'success', '游戏文件完整');
        }

        if (depCheck.forgeCore && !depCheck.forgeCore.ok && depCheck.forgeCore.missing && depCheck.forgeCore.missing.length > 0) {
            const missingNames = depCheck.forgeCore.missing.map(m => `${m.desc} (${m.name.split(':').pop()})`).join('、');
            const errorMsg = `Forge核心库文件缺失 (${depCheck.forgeCore.missing.length}个): ${missingNames}`;
            setLaunchStep('files-check', 'error', errorMsg);
            showLaunchError(
                `Forge 核心库文件缺失，无法启动游戏。\n缺失文件：${missingNames}\n\n请前往"版本设置 → 文件修复"功能修复此问题，或重新安装该 Forge 版本。`,
                { forgeMissing: depCheck.forgeCore.missing, repairHint: 'forge_core_missing', versionId }
            );
            launchBtn.disabled = false;
            homeLaunchBtn.disabled = false;
            window._versepc_launching = false;
            return;
        }

        setLaunchStep('natives-extract', 'running', '正在解压本地库...');
        await new Promise(r => setTimeout(r, 200));
        setLaunchStep('natives-extract', 'success', '本地库解压完成');

        setLaunchStep('assets-check', 'running', '正在检查资源文件...');
        
        if (depCheck.libraries && depCheck.libraries.missing.length > 0) {
            const libMsg = `${depCheck.libraries.missing.length}/${depCheck.libraries.total} 个库文件缺失`;
            setLaunchStep('assets-check', 'warning', libMsg);
        } else {
            setLaunchStep('assets-check', 'success', '所有资源文件完整');
        }

        const hasMissing = depCheck.missingFiles && depCheck.missingFiles.length > 0;
        const assetsMissing = depCheck.assets && depCheck.assets.missing > 0;
        if (hasMissing || assetsMissing) {
            const missingCount = (depCheck.missingFiles && depCheck.missingFiles.length) || (depCheck.assets ? depCheck.assets.missing : 0);
            setLaunchStep('download', 'running', `正在下载 ${missingCount} 个缺失文件...`);
            const dlResult = await API.launchGame(versionId, { checkOnly: true });
            if (dlResult.needDownload && dlResult.sessionId) {
                pollLaunchDownload(dlResult.sessionId, versionId, requiredJava);
                window._versepc_launching = false;
                return;
            }
            if (dlResult.error) {
                setLaunchStep('download', 'error', dlResult.error);
                showLaunchError(dlResult.error);
                launchBtn.disabled = false;
                homeLaunchBtn.disabled = false;
                window._versepc_launching = false;
                return;
            }
        }

        setLaunchStep('build-args', 'running', '正在构建启动参数...');
        await new Promise(r => setTimeout(r, 200));
        setLaunchStep('build-args', 'success', '启动参数构建完成');

        setLaunchStep('launching', 'running', '正在启动 Minecraft...');
        
        const result = await API.launchGame(versionId);

        if (result.needDownload && result.sessionId) {
            pollLaunchDownload(result.sessionId, versionId, requiredJava);
            window._versepc_launching = false;
            return;
        }

        if (result.success) {
            setLaunchStep('launching', 'success', '游戏进程已创建');
            updateLaunchProgress(100);
            document.getElementById('launch-log-section').style.display = '';
            launchBtn.classList.add('running');
            launchBtn.querySelector('span').textContent = '启动游戏';
            document.getElementById('status-indicator').classList.add('running');
            document.getElementById('status-text').textContent = '游戏运行中';
            startGameLogStream();
            updateGameStatus();
            incrementLaunchCount();
            checkSupportMilestone();
            setTimeout(() => {
                closeLaunchModal('fade');
                launchBtn.disabled = false;
                homeLaunchBtn.disabled = false;
                window._versepc_launching = false;
            }, 2000);
        } else {
            setLaunchStep('launching', 'error', result.error || '启动失败');
            showLaunchError(result.error || '启动失败', result.details || result);
            launchBtn.disabled = false;
            homeLaunchBtn.disabled = false;
            window._versepc_launching = false;
        }
    } catch (e) {
        console.error('[Launch] 启动异常:', e);
        const statusEl = document.getElementById('launch-splash-status');
        if (statusEl) {
            statusEl.textContent = e.message || '启动请求失败';
            statusEl.style.color = '#dc2626';
        }
        showLaunchError(e.message || '启动请求失败', { error: e.message, stack: e.stack });
        launchBtn.disabled = false;
        homeLaunchBtn.disabled = false;
        window._versepc_launching = false;
    }
}

function showLaunchDepModal(versionId, sessionId, missingCount, depCheck) {
    setLaunchStep('download', 'running', `发现 ${missingCount} 个缺失文件，需要下载...`);
    updateLaunchDownloadProgress(0, `0/${missingCount} 文件`, {
        completedFiles: 0,
        totalFiles: missingCount,
        currentFile: '准备下载...',
        speed: 0,
        activeDownloads: []
    });

    startLaunchDepDownload(versionId, sessionId);
}

function closeLaunchDepModal() {
    if (launchDepPollTimer) { clearInterval(launchDepPollTimer); launchDepPollTimer = null; }
    const modal = document.getElementById('launch-dep-modal');
    if (modal) {
        modal.classList.remove('modal-visible');
        setTimeout(() => modal.remove(), 300);
    }
}

async function startLaunchDepDownload(versionId, sessionId) {
    setLaunchStep('download', 'running', '正在下载缺失文件...');

    try {
        const result = await API.downloadLaunchDeps(versionId, sessionId);

        if (result.success && result.sessionId) {
            pollLaunchDepProgress(result.sessionId, versionId);
        } else if (result.message === '无需下载') {
            setLaunchStep('download', 'success', '无需下载');
            setLaunchStep('build-args', 'running', '正在构建启动参数...');
            await new Promise(r => setTimeout(r, 200));
            setLaunchStep('build-args', 'success', '启动参数构建完成');
            setLaunchStep('launching', 'running', '正在启动 Minecraft...');
            const launchBtn = document.getElementById('launch-btn');
            const homeLaunchBtn = document.getElementById('home-launch-btn');
            try {
                const launchResult = await API.launchGame(versionId);
                if (launchResult.success) {
                    setLaunchStep('launching', 'success', '游戏进程已创建');
                    updateLaunchProgress(100);
                    showToast('游戏启动成功', 'success');
                    launchBtn.classList.add('running');
                    launchBtn.querySelector('span').textContent = '启动游戏';
                    document.getElementById('status-indicator').classList.add('running');
                    document.getElementById('status-text').textContent = '游戏运行中';
                    startGameLogStream();
                    updateGameStatus();
                    incrementLaunchCount();
                    checkSupportMilestone();
                    setTimeout(() => {
                        closeLaunchModal('fade');
                        launchBtn.disabled = false;
                        homeLaunchBtn.disabled = false;
                    }, 2000);
                } else {
                    setLaunchStep('launching', 'error', launchResult.error || '启动失败');
                    showLaunchError(launchResult.error || '启动失败', launchResult.details || launchResult);
                }
            } catch (e) {
                setLaunchStep('launching', 'error', '启动失败');
                showLaunchError('启动失败', { error: e.message });
            }
            launchBtn.disabled = false;
            if (homeLaunchBtn) homeLaunchBtn.disabled = false;
        } else {
            setLaunchStep('download', 'error', '下载请求失败');
            showLaunchError('下载请求失败');
        }
    } catch (e) {
        setLaunchStep('download', 'error', '下载请求失败: ' + e.message);
        showLaunchError('下载请求失败: ' + e.message, { error: e.message });
    }
}

function pollLaunchDepProgress(sessionId, versionId) {
    if (launchDepPollTimer) clearInterval(launchDepPollTimer);
    let depSmoothPct = 0;

    launchDepPollTimer = setInterval(async () => {
        try {
            const status = await API.getLaunchSessionStatus(sessionId);

            const detailData = {
                completedFiles: status.completedFiles || 0,
                totalFiles: status.totalFiles || 0,
                currentFile: status.currentFile || '',
                speed: status.speed || 0,
                activeDownloads: status.activeDownloads || []
            };

            const rawDepPct = status.progress || 0;
            if (depSmoothPct <= 0 || rawDepPct < depSmoothPct) {
                depSmoothPct = rawDepPct;
            } else {
                depSmoothPct = depSmoothPct * 0.85 + rawDepPct * 0.15;
            }
            const smoothDepPct = Math.round(depSmoothPct);
            updateLaunchDownloadProgress(smoothDepPct, status.message || '', detailData);
            const baseProgress = 40;
            updateLaunchProgress(baseProgress + (smoothDepPct / 100) * 50);

            if (status.status === 'launched') {
                clearInterval(launchDepPollTimer);
                launchDepPollTimer = null;
                setLaunchStep('download', 'success', '缺失文件下载完成');
                setLaunchStep('build-args', 'success', '启动参数构建完成');
                setLaunchStep('launching', 'success', '游戏进程已创建');
                updateLaunchProgress(100);
                showToast('游戏启动成功', 'success');
                const launchBtn = document.getElementById('launch-btn');
                const homeLaunchBtn = document.getElementById('home-launch-btn');
                launchBtn.classList.add('running');
                launchBtn.querySelector('span').textContent = '启动游戏';
                document.getElementById('status-indicator').classList.add('running');
                document.getElementById('status-text').textContent = '游戏运行中';
                startGameLogStream();
                incrementLaunchCount();
                checkSupportMilestone();
                setTimeout(() => {
                    closeLaunchModal('fade');
                    launchBtn.disabled = false;
                    if (homeLaunchBtn) homeLaunchBtn.disabled = false;
                }, 2000);
            } else if (status.status === 'launch_failed') {
                clearInterval(launchDepPollTimer);
                launchDepPollTimer = null;
                setLaunchStep('launching', 'error', status.message || '启动失败');
                showLaunchError(status.message || '启动失败', status.launchResult || status);
            } else if (status.status === 'failed') {
                clearInterval(launchDepPollTimer);
                launchDepPollTimer = null;
                setLaunchStep('download', 'error', status.message || '下载失败');
                showLaunchError(status.message || '下载失败', { failedFiles: status.failedFiles });
            } else if (status.status === 'completed' && status.failed > 0) {
                setLaunchStep('download', 'warning', `${status.failed} 个文件下载失败`);
            } else if (status.status === 'completed') {
                clearInterval(launchDepPollTimer);
                launchDepPollTimer = null;
                updateLaunchDownloadProgress(100, '下载完成', {
                    completedFiles: status.totalFiles || 0,
                    totalFiles: status.totalFiles || 0,
                    currentFile: '',
                    speed: 0,
                    activeDownloads: []
                });
                setLaunchStep('download', 'success', '缺失文件下载完成');
                showToast(`下载完成: ${status.completedFiles || 0} 个文件`, 'success');
            }
        } catch (e) {
            console.error('[Launch Poll] Error:', e);
        }
    }, 200);
}

async function retryLaunchDepDownload(versionId, sessionId) {
    setLaunchStep('download', 'running', '正在重试下载...');

    try {
        const result = await API.downloadLaunchDeps(versionId, sessionId);
        if (result.success && result.sessionId) {
            pollLaunchDepProgress(result.sessionId, versionId);
        } else {
            setLaunchStep('download', 'error', '重试失败');
            showLaunchError('重试失败', result);
        }
    } catch (e) {
        setLaunchStep('download', 'error', '重试请求失败');
        showLaunchError('重试请求失败', { error: e.message });
    }
}

async function updateGameStatus() {
    try {
        const status = await API.getGameStatus();
        const indicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        const launchBtn = document.getElementById('launch-btn');

        if (status.running) {
            indicator.classList.add('running');
            const count = status.instances ? status.instances.length : 1;
            if (count > 1) {
                statusText.textContent = `${count} 个游戏运行中`;
            } else {
                statusText.textContent = '游戏运行中';
            }
            launchBtn.classList.add('running');
            launchBtn.querySelector('span').textContent = '启动游戏';

            updateGameInstanceList(status.instances || []);
        } else {
            const wasRunning = indicator.classList.contains('running');
            indicator.classList.remove('running');
            statusText.textContent = '就绪';
            launchBtn.classList.remove('running');
            launchBtn.querySelector('span').textContent = '启动游戏';

            updateGameInstanceList([]);

            if (wasRunning) {
                try {
                    const analysisResult = await API.getExitAnalysis();
                    const analysis = analysisResult.analysis;
                    if (analysis && analysis.isCrash) {
                        showToast(`游戏崩溃: ${analysis.reason}`, 'error');
                        if (analysis.suggestion) {
                            setTimeout(() => showToast(`建议: ${analysis.suggestion}`, 'info'), 1000);
                        }
                        if (analysis.versionId || status.lastVersionId) {
                            const vid = analysis.versionId || status.lastVersionId;
                            setTimeout(() => {
                                const repairToast = document.createElement('div');
                                repairToast.className = 'toast warning';
                                repairToast.style.cssText = 'cursor:pointer;display:flex;align-items:center;gap:8px';
                                repairToast.innerHTML = '<span>游戏启动失败，可前往<strong>版本设置页面</strong>使用<strong>文件修复功能</strong>解决此问题</span><button style="background:var(--accent);color:#fff;border:none;border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer;white-space:nowrap">立即修复</button>';
                                repairToast.querySelector('button').addEventListener('click', () => {
                                    openVersionSettings(vid);
                                    document.querySelectorAll('.vset-nav-item[data-tab="overview"]').forEach(b => b.click());
                                    setTimeout(() => { repairFiles(); }, 500);
                                });
                                const container = document.getElementById('toast-container');
                                if (container) {
                                    container.appendChild(repairToast);
                                    setTimeout(() => {
                                        repairToast.style.transform = 'translateX(120%)';
                                        repairToast.style.opacity = '0';
                                        setTimeout(() => { if (repairToast.parentNode) repairToast.parentNode.removeChild(repairToast); }, 300);
                                    }, 8000);
                                }
                            }, 2000);
                        }
                        const crashVid = analysis.versionId || status.lastVersionId;
                        if (crashVid) {
                            showCrashAnalysis(crashVid);
                        }
                    }
                } catch (e) {
                    console.warn('[Launch] 退出分析失败:', e);
                }
            }
        }
    } catch (e) {
        console.error('[Launch] 更新游戏状态失败:', e);
    }
}

async function showCrashAnalysis(versionId) {
    try {
        const result = await API.analyzeCrash(versionId);
        if (result.found) {
            showCrashAnalysisDialog(result);
        }
    } catch (e) {}
}

function showCrashAnalysisDialog(result) {
    const existing = document.getElementById('crash-analysis-dialog');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'crash-analysis-dialog';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)';

    const severityColors = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
    const severityLabels = { high: '严重', medium: '中等', low: '轻微' };
    const severityColor = severityColors[result.severity] || severityColors.medium;
    const severityLabel = severityLabels[result.severity] || '中等';

    const dialog = document.createElement('div');
    dialog.style.cssText = `width:90%;max-width:520px;background:var(--bg-secondary);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.5);overflow:hidden`;

    dialog.innerHTML = `
        <div style="padding:20px 24px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between">
            <h3 style="margin:0;font-size:18px;color:var(--text-primary)">崩溃分析结果</h3>
            <button id="crash-dialog-close" style="width:32px;height:32px;border:none;background:transparent;color:var(--text-muted);font-size:20px;cursor:pointer;border-radius:6px">×</button>
        </div>
        <div style="padding:24px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${severityColor}"></span>
                <span style="font-size:14px;font-weight:600;color:var(--text-primary)">${escapeHtml(result.reason)}</span>
                <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${severityColor}20;color:${severityColor}">${escapeHtml(severityLabel)}</span>
            </div>
            ${result.modName ? `<div style="padding:10px 14px;background:var(--bg-primary);border-radius:8px;margin-bottom:12px;font-size:13px;color:var(--text-secondary)">相关Mod: <strong style="color:var(--accent)">${escapeHtml(result.modName)}</strong></div>` : ''}
            <div style="padding:14px;background:var(--bg-primary);border-radius:8px;border-left:4px solid var(--accent);margin-bottom:16px">
                <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px">解决方案</div>
                <div style="font-size:13px;color:var(--text-primary);line-height:1.6">${escapeHtml(result.solution)}</div>
            </div>
            ${result.logFile ? `<div style="font-size:12px;color:var(--text-muted)">日志文件: ${escapeHtml(result.logFile)}</div>` : ''}
        </div>
        <div style="padding:16px 24px;border-top:1px solid var(--border-color);display:flex;justify-content:flex-end;gap:8px">
            <button id="crash-dialog-view-log" style="padding:8px 16px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);border-radius:6px;font-size:13px;cursor:pointer">查看日志</button>
            <button id="crash-dialog-ok" style="padding:8px 16px;border:none;background:var(--accent);color:#fff;border-radius:6px;font-size:13px;cursor:pointer">知道了</button>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const closeDialog = () => { overlay.remove(); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDialog(); });
    dialog.querySelector('#crash-dialog-close').addEventListener('click', closeDialog);
    dialog.querySelector('#crash-dialog-ok').addEventListener('click', closeDialog);
    dialog.querySelector('#crash-dialog-view-log').addEventListener('click', () => {
        closeDialog();
        if (typeof crashAnalyzerUI !== 'undefined') {
            crashAnalyzerUI.show();
        }
    });
}

function showLaunchModal() {
    const overlay = document.getElementById('game-launch-overlay');
    if (!overlay) {
        console.error('[Launch] game-launch-overlay element not found');
        return;
    }

    overlay.style.display = 'flex';

    const progressBar = document.getElementById('launch-splash-progress');
    if (progressBar) progressBar.style.width = '0%';

    const statusEl = document.getElementById('launch-splash-status');
    if (statusEl) {
        statusEl.textContent = '正在验证登录状态...';
        statusEl.style.color = '';
    }

    const logo = document.getElementById('launch-splash-logo');
    if (logo) {
        logo.style.animation = 'none';
        void logo.offsetWidth;
        logo.style.animation = '';
    }

    const errorSection = document.getElementById('launch-error-section');
    if (errorSection) errorSection.style.display = 'none';

    const logSection = document.getElementById('launch-log-section');
    if (logSection) logSection.style.display = 'none';

    const repairGuide = document.getElementById('launch-repair-guide');
    if (repairGuide) repairGuide.style.display = 'none';
}

function closeLaunchModal(name_fade) {
    const overlay = document.getElementById('game-launch-overlay');
    if (!overlay) return;

    if (name_fade) {
        overlay.style.transition = 'opacity 0.5s ease-out';
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
            overlay.style.opacity = '1';
            overlay.style.transition = '';
            navigateToPage('home');
        }, 500);
    } else {
        overlay.style.display = 'none';
    }

    hideLaunchError();
}

function updateLaunchProgress(pct) {
    const bar = document.getElementById('launch-splash-progress');
    if (bar) bar.style.width = pct + '%';
}

const LAUNCH_STEP_PROGRESS = {
    'auth': 5, 'java-check': 15, 'version-resolve': 25,
    'files-check': 40, 'natives-extract': 55, 'assets-check': 65,
    'download': 75, 'build-args': 85, 'launching': 95
};

function setLaunchStep(stepName, status, desc) {
    const statusEl = document.getElementById('launch-splash-status');
    if (statusEl && desc) statusEl.textContent = desc;

    const progress = LAUNCH_STEP_PROGRESS[stepName] || 0;
    updateLaunchProgress(progress);

    if (statusEl) {
        if (status === 'error') {
            statusEl.style.color = '#dc2626';
        } else if (status === 'success' && stepName === 'launching') {
            updateLaunchProgress(100);
            statusEl.textContent = '启动成功！';
            statusEl.style.color = '#4ade80';
        } else {
            statusEl.style.color = '';
        }
    }
}

function completeAllPreviousSteps(currentStepName) {
}

function showLaunchError(msg, details = null) {
    const errorSection = document.getElementById('launch-error-section');
    const errorMsg = document.getElementById('launch-error-msg');
    const repairGuide = document.getElementById('launch-repair-guide');
    if (errorSection) errorSection.style.display = 'flex';
    if (repairGuide) {
        repairGuide.style.display = 'flex';
        repairGuide.dataset.versionId = (details && details.versionId) || currentSettingsVersionId || (launchVersionCustomSelect ? launchVersionCustomSelect.getValue() : '');
    }

    let fullMsg = msg || '未知错误';
    if (details) {
        console.error('[Launch] 详细错误信息:', details);
        if (details.versionId) fullMsg += `\n版本: ${details.versionId}`;
        if (details.mainClass) fullMsg += `\n主类: ${details.mainClass}`;
        if (details.externalVersionDir) fullMsg += `\n外部目录: ${details.externalVersionDir}`;
        if (details.error) fullMsg += `\n错误: ${details.error}`;
    }

    if (errorMsg) {
        errorMsg.innerHTML = (msg || '未知错误').replace(/\n/g, '<br>');
        errorMsg.title = fullMsg;
    }

    const statusEl = document.getElementById('launch-splash-status');
    if (statusEl) {
        statusEl.textContent = msg || '启动失败';
        statusEl.style.color = '#dc2626';
    }
}

function hideLaunchError() {
    const errorSection = document.getElementById('launch-error-section');
    const repairGuide = document.getElementById('launch-repair-guide');
    if (errorSection) errorSection.style.display = 'none';
    if (repairGuide) repairGuide.style.display = 'none';

    const statusEl = document.getElementById('launch-splash-status');
    if (statusEl) statusEl.style.color = '';
}

function openVersionSettingsForRepair() {
    const repairGuide = document.getElementById('launch-repair-guide');
    const versionId = (repairGuide && repairGuide.dataset.versionId) || (launchVersionCustomSelect ? launchVersionCustomSelect.getValue() : '');
    if (versionId) {
        openVersionSettings(versionId);
    }
    closeLaunchModal();
}

function updateLaunchDownloadProgress(pct, msg, detailData) {
    const statusEl = document.getElementById('launch-splash-status');
    if (!statusEl) return;

    if (detailData) {
        var parts = [];
        if (detailData.completedFiles !== undefined && detailData.totalFiles !== undefined) {
            parts.push(detailData.completedFiles + '/' + detailData.totalFiles);
        }
        if (detailData.speed > 0) {
            var spd = detailData.speed;
            if (spd < 1024) parts.push(spd.toFixed(0) + ' B/s');
            else if (spd < 1024 * 1024) parts.push((spd / 1024).toFixed(1) + ' KB/s');
            else parts.push((spd / (1024 * 1024)).toFixed(1) + ' MB/s');
        }
        statusEl.textContent = (parts.length ? parts.join('  ') + ' - ' : '') + Math.round(pct) + '%';
    } else if (msg) {
        statusEl.textContent = msg;
    }
}

function cancelLaunchFlow() {
    if (window._launchDlPollInterval) {
        clearInterval(window._launchDlPollInterval);
        window._launchDlPollInterval = null;
    }
    window._versepc_launching = false;
    if (typeof API !== 'undefined' && API.cancelLaunch) {
        API.cancelLaunch().catch(() => {});
    }
    closeLaunchModal();
    const launchBtn = document.getElementById('launch-btn');
    const homeLaunchBtn = document.getElementById('home-launch-btn');
    if (launchBtn) launchBtn.disabled = false;
    if (homeLaunchBtn) homeLaunchBtn.disabled = false;
}

function toggleLaunchLog() {
    const content = document.getElementById('launch-log-content');
    if (content.style.maxHeight === '0px') {
        content.style.maxHeight = '150px';
    } else {
        content.style.maxHeight = '0px';
    }
}

async function pollLaunchDownload(sessionId, versionId, requiredJava) {
    try {
        let lastPct = 0;
        let smoothPct = 0;
        
        const pollInterval = setInterval(async () => {
            window._launchDlPollInterval = pollInterval;
            try {
                const dlStatus = await API.getLaunchSessionStatus(sessionId);
                
                if (!dlStatus || dlStatus.status === 'error') {
                    clearInterval(pollInterval);
                    setLaunchStep('download', 'error', dlStatus?.message || '下载失败');
                    showLaunchError(dlStatus?.message || '下载失败');
                    const launchBtn = document.getElementById('launch-btn');
                    const homeLaunchBtn = document.getElementById('home-launch-btn');
                    if (launchBtn) launchBtn.disabled = false;
                    if (homeLaunchBtn) homeLaunchBtn.disabled = false;
                    return;
                }
                
                const rawPct = dlStatus.progress || 0;
                if (smoothPct <= 0 || rawPct < smoothPct) {
                    smoothPct = rawPct;
                } else {
                    smoothPct = smoothPct * 0.85 + rawPct * 0.15;
                }
                const pct = Math.min(95, Math.round(smoothPct));
                if (pct !== lastPct) {
                    lastPct = pct;
                    updateLaunchDownloadProgress(pct, `下载文件 (${dlStatus.completedFiles || 0}/${dlStatus.totalFiles || 0}): ${dlStatus.currentFile || ''}`, {
                        completedFiles: dlStatus.completedFiles || 0,
                        totalFiles: dlStatus.totalFiles || 0,
                        currentFile: dlStatus.currentFile || '',
                        speed: dlStatus.speed || 0,
                        activeDownloads: dlStatus.activeDownloads || []
                    });
                    const baseProgress = 40;
                    updateLaunchProgress(baseProgress + (pct / 100) * 50);
                }
                
                if (dlStatus.status === 'completed') {
                    clearInterval(pollInterval);
                    updateLaunchDownloadProgress(100, '下载完成', {
                        completedFiles: dlStatus.totalFiles || 0,
                        totalFiles: dlStatus.totalFiles || 0,
                        currentFile: '',
                        speed: 0,
                        activeDownloads: []
                    });
                    setLaunchStep('download', 'success', '缺失文件下载完成');
                    
                    setTimeout(async () => {
                        setLaunchStep('build-args', 'running', '正在构建启动参数...');
                        await new Promise(r => setTimeout(r, 200));
                        setLaunchStep('build-args', 'success', '启动参数构建完成');
                        
                        setLaunchStep('launching', 'running', '正在启动 Minecraft...');
                        
                        const result = await API.launchGame(versionId);
                        
                        if (result.success) {
                            setLaunchStep('launching', 'success', '游戏进程已创建');
                            updateLaunchProgress(100);
                            document.getElementById('launch-log-section').style.display = '';
                            const launchBtn = document.getElementById('launch-btn');
                            const homeLaunchBtn = document.getElementById('home-launch-btn');
                            launchBtn.classList.add('running');
                            launchBtn.querySelector('span').textContent = '启动游戏';
                            document.getElementById('status-indicator').classList.add('running');
                            document.getElementById('status-text').textContent = '游戏运行中';
                            startGameLogStream();
                            updateGameStatus();
                            incrementLaunchCount();
                            checkSupportMilestone();
                            setTimeout(() => {
                                closeLaunchModal('fade');
                                launchBtn.disabled = false;
                                homeLaunchBtn.disabled = false;
                            }, 2000);
                        } else {
                            setLaunchStep('launching', 'error', result.error || '启动失败');
                            showLaunchError(result.error || '启动失败');
                            const launchBtn = document.getElementById('launch-btn');
                            const homeLaunchBtn = document.getElementById('home-launch-btn');
                            if (launchBtn) launchBtn.disabled = false;
                            if (homeLaunchBtn) homeLaunchBtn.disabled = false;
                        }
                    }, 500);
                }
            } catch (e) {
                console.warn('[Launch] 启动轮询回调异常:', e);
            }
        }, 800);
    } catch (e) {
        console.error('[Launch] 轮询失败:', e);
    }
}

function updateGameInstanceList(instances) {
    let container = document.getElementById('game-instance-list');
    if (!container) {
        const sidebar = document.querySelector('.launch-bar') || document.querySelector('.sidebar');
        if (!sidebar) return;
        container = document.createElement('div');
        container.id = 'game-instance-list';
        container.style.cssText = 'position:fixed;bottom:60px;right:16px;z-index:1000;display:flex;flex-direction:column;gap:6px;max-width:280px;';
        document.body.appendChild(container);
    }

    if (instances.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    container.innerHTML = instances.map(inst => {
        const elapsed = Math.floor((Date.now() - inst.startTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        const timeStr = mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
        return `
            <div class="game-instance-card" data-session="${inst.sessionId}" style="
                background:var(--card-bg);border:1px solid var(--border-color);border-radius:8px;
                padding:8px 12px;display:flex;align-items:center;gap:8px;font-size:12px;
                box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:default;
            ">
                <div style="width:8px;height:8px;border-radius:50%;background:var(--green);flex-shrink:0;"></div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${inst.versionId}</div>
                    <div style="color:var(--text-secondary);font-size:11px;">PID: ${inst.pid} · ${timeStr}${inst.lanPort ? ' · LAN:' + inst.lanPort : ''}</div>
                </div>
                <button onclick="stopGameInstance('${inst.sessionId}')" style="
                    background:var(--red);color:white;border:none;border-radius:4px;
                    padding:2px 8px;cursor:pointer;font-size:11px;flex-shrink:0;
                ">停止</button>
            </div>
        `;
    }).join('');
}

async function stopGameInstance(sessionId) {
    try {
        const result = await API.stopGameInstance(sessionId);
        if (result.success) {
            showToast('游戏实例已停止', 'info');
            updateGameStatus();
        } else {
            showToast(result.error || '停止失败', 'error');
        }
    } catch (e) {
        showToast('停止请求失败', 'error');
    }
}

function startGameLogStream() {
    if (gameLogEventSource) gameLogEventSource.close();
    const consoleOutput = document.getElementById('console-output');
    consoleOutput.innerHTML = '';
    try {
        gameLogEventSource = new EventSource('/api/game/log/stream');
        gameLogEventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.event === 'exited') {
                    appendConsoleLine('[VersePC] 游戏进程已退出', 'warn');
                    gameLogEventSource.close();
                    gameLogEventSource = null;
                    return;
                }
                if (data.batch && Array.isArray(data.batch)) {
                    const frag = document.createDocumentFragment();
                    const batchLen = data.batch.length;
                    for (let i = 0; i < batchLen; i++) {
                        const line = data.batch[i];
                        let type = '';
                        if (line.includes('ERROR') || line.includes('FATAL') || line.includes('Exception')) type = 'error';
                        else if (line.includes('WARN')) type = 'warn';
                        else if (line.includes('[VersePC]')) type = 'info';
                        const el = document.createElement('div');
                        el.className = 'console-line' + (type ? ' ' + type : '');
                        el.textContent = line;
                        frag.appendChild(el);
                    }
                    consoleOutput.appendChild(frag);
                    while (consoleOutput.children.length > 500) consoleOutput.removeChild(consoleOutput.firstChild);
                    consoleOutput.scrollTop = consoleOutput.scrollHeight;
                } else if (data.line) {
                    let type = '';
                    const line = data.line;
                    if (line.includes('ERROR') || line.includes('FATAL') || line.includes('Exception')) type = 'error';
                    else if (line.includes('WARN')) type = 'warn';
                    else if (line.includes('[VersePC]')) type = 'info';
                    appendConsoleLine(line, type);
                }
            } catch (e) {
                console.warn('[GameLog] 解析日志行失败:', e);
            }
        };
        gameLogEventSource.onerror = () => { gameLogEventSource.close(); gameLogEventSource = null; };
    } catch (e) {
        console.warn('[GameLog] 创建日志流失败:', e);
    }
}

function appendConsoleLine(text, type = '') {
    const consoleOutput = document.getElementById('console-output');
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    line.textContent = text;
    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
    while (consoleOutput.children.length > 500) consoleOutput.removeChild(consoleOutput.firstChild);
}

async function detectJava() {
    const hint = document.getElementById('java-detect-result');
    if (hint) hint.textContent = '检测中...';
    try {
        const result = await API.detectJava();
        if (result.javaList && result.javaList.length > 0) {
            const best = result.javaList.find(j => j.majorVersion >= 17) || result.javaList[0];
            const javaPathInput = document.getElementById('setting-java-path');
            if (javaPathInput) javaPathInput.value = best.path;
            if (hint) hint.textContent = `找到 Java ${best.version} (${best.is64Bit ? '64位' : '32位'})`;
            const statJava = document.getElementById('stat-java');
            if (statJava) statJava.textContent = best.majorVersion;
        } else {
            if (hint) hint.textContent = '未检测到Java，请手动配置或安装';
        }
    } catch (e) { if (hint) hint.textContent = '检测失败'; }
}

let javaInstallPollTimer = null;

async function checkJavaOnStartup() {
    try {
        const result = await API.detectJava();
        if (result.javaList && result.javaList.length > 0) {
            const best = result.javaList.find(j => j.majorVersion >= 17) || result.javaList[0];
            const statJava = document.getElementById('stat-java');
            if (statJava) statJava.textContent = best.majorVersion;
        }
    } catch (e) {
        console.error('Java startup check failed:', e);
    }
}

async function triggerJvmPreheat() {
    try {
        const saved = await window.electronAPI.store.get('versepc_launch_settings');
        if (!saved) return;
        const settings = JSON.parse(saved);
        if (!settings.jvmPreheat) return;

        const result = await API.detectJava();
        if (result && result.javaList && result.javaList.length > 0) {
            const bestJava = result.javaList.find(j => j.majorVersion >= 17) || result.javaList[0];
            const memInfo = await API.getSystemMemory();
            const totalMB = memInfo.totalMB || 8192;
            const preheatMem = Math.min(2048, Math.floor(totalMB * 0.3));
            await fetch('/api/jvm/preheat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ javaPath: bestJava.path, maxMemMB: preheatMem })
            });
        }
    } catch(e) {}
}

async function generateCdsArchive() {
    const versionId = document.getElementById('launch-version-select')?.value;
    if (!versionId) {
        showToast('请先选择一个游戏版本', 'error');
        return;
    }
    const statusText = document.getElementById('cds-status-text');
    if (statusText) statusText.textContent = '正在生成...';
    showToast('正在生成 CDS 归档，请稍候...', 'info');
    try {
        const result = await API.generateCds(versionId);
        if (result.success) {
            const sizeInfo = result.sizeKB ? ` (${result.sizeKB}KB)` : '';
            showToast(`CDS 归档生成成功${sizeInfo}，下次启动将自动加速`, 'success');
            if (statusText) statusText.textContent = `✓ 已生成${sizeInfo}`;
        } else {
            showToast('CDS 归档生成失败: ' + (result.error || '未知错误'), 'error');
            if (statusText) statusText.textContent = '✗ 生成失败';
        }
    } catch (e) {
        showToast('CDS 归档生成失败: ' + e.message, 'error');
        if (statusText) statusText.textContent = '✗ 生成失败';
    }
}

async function checkCdsStatus() {
    const versionId = document.getElementById('launch-version-select')?.value;
    if (!versionId) return;
    const statusText = document.getElementById('cds-status-text');
    if (!statusText) return;
    try {
        const result = await API.getCdsStatus(versionId);
        if (result.available) {
            statusText.textContent = `✓ 归档已就绪 (${result.sizeKB}KB)`;
        } else {
            statusText.textContent = '未生成归档';
        }
    } catch (e) {
        statusText.textContent = '';
    }
}

function showJavaInstallModal(requiredVersion) {
    const existing = document.getElementById('java-install-modal');
    if (existing) existing.remove();

    const modalHtml = `
    <div class="modal" id="java-install-modal" style="display:flex;">
        <div class="modal-content java-install-modal-content">
            <div class="modal-header">
                <h3>☕ Java 运行环境</h3>
                <button class="modal-close" onclick="closeJavaInstallModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="java-install-info">
                    <div class="java-install-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                            <path d="M12 6v6l4 2"/>
                        </svg>
                    </div>
                    <div class="java-install-text">
                        <p class="java-install-title">未检测到 Java ${requiredVersion}+</p>
                        <p class="java-install-desc">Minecraft 需要 Java 运行环境才能启动。请前往 Java 管理页面手动安装或配置 Java 路径。</p>
                    </div>
                </div>
            </div>
            <div class="modal-footer" id="java-install-footer">
                <button class="btn btn-secondary" onclick="closeJavaInstallModal()">稍后处理</button>
                <button class="btn btn-primary" onclick="closeJavaInstallModal();navigateToPage('java')">
                    <span>前往 Java 管理</span>
                </button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    requestAnimationFrame(() => {
        const modal = document.getElementById('java-install-modal');
        if (modal) modal.classList.add('modal-visible');
    });
}

async function loadJavaDownloadSources() {
    try {
        const result = await API.getJavaDownloadSources();
        const listEl = document.getElementById('java-source-list');
        if (!listEl || !result.sources) return;

        result.sources.forEach(source => {
            const item = document.createElement('div');
            item.className = 'java-source-item';
            item.dataset.source = source.id;
            item.innerHTML = `
                <span class="java-source-dot"></span>
                <span class="java-source-name">${source.name}</span>
                <span class="java-source-desc">${source.description}</span>
            `;
            listEl.appendChild(item);
        });
    } catch (e) { console.error('[Java] Failed to load download sources:', e); }
}

function closeJavaInstallModal() {
    if (javaInstallPollTimer) { clearInterval(javaInstallPollTimer); javaInstallPollTimer = null; }
    const modal = document.getElementById('java-install-modal');
    if (modal) {
        modal.classList.remove('modal-visible');
        setTimeout(() => modal.remove(), 300);
    }
}

async function startJavaAutoInstall(requiredVersion) {
    const installBtn = document.getElementById('java-install-btn');
    const progressDiv = document.getElementById('java-install-progress');
    const footerDiv = document.getElementById('java-install-footer');
    const sourceList = document.getElementById('java-source-list');

    if (installBtn) installBtn.disabled = true;
    if (progressDiv) progressDiv.style.display = 'block';
    if (sourceList) sourceList.style.display = 'none';

    try {
        const result = await API.autoInstallJava(requiredVersion);

        if (result.success && result.sessionId) {
            pollJavaInstallProgress(result.sessionId, requiredVersion);
        } else {
            showToast('Java检测请求失败', 'error');
            if (installBtn) installBtn.disabled = false;
        }
    } catch (e) {
        showToast('Java检测请求失败: ' + e.message, 'error');
        if (installBtn) installBtn.disabled = false;
    }
}

function pollJavaInstallProgress(sessionId, requiredVersion) {
    const progressBar = document.getElementById('java-install-progress-bar');
    const progressText = document.getElementById('java-progress-text');
    const progressStatus = document.getElementById('java-progress-status');
    const progressSource = document.getElementById('java-progress-source');
    const progressSpeed = document.getElementById('java-progress-speed');
    const progressSize = document.getElementById('java-progress-size-text');
    const installBtn = document.getElementById('java-install-btn');

    if (javaInstallPollTimer) clearInterval(javaInstallPollTimer);

    javaInstallPollTimer = setInterval(async () => {
        try {
            const status = await API.getJavaInstallStatus(sessionId);

            if (progressBar) {
                progressBar.style.width = (status.progress || 0) + '%';
            }
            if (progressStatus) {
                const statusMap = {
                    'detecting': '🔍 检测Java环境...',
                    'pending': '⏳ 准备下载...',
                    'downloading': '📥 下载中...',
                    'configuring': '⚙️ 配置环境变量...',
                    'completed': '✅ 安装完成',
                    'failed': '❌ 安装失败',
                    'need_manual': '⚠️ 需要手动配置'
                };
                progressStatus.textContent = statusMap[status.status] || status.message;
            }
            if (progressSource && status.source) {
                progressSource.textContent = `来源: ${status.source}`;
            }
            if (progressText) {
                progressText.textContent = status.message || '';
            }
            if (progressSpeed && status.speed) {
                progressSpeed.textContent = formatSpeed(status.speed);
            }
            if (progressSize && status.totalBytes) {
                progressSize.textContent = `${formatSize(status.downloadedBytes || 0)} / ${formatSize(status.totalBytes)}`;
            }

            if (status.status === 'completed') {
                clearInterval(javaInstallPollTimer);
                javaInstallPollTimer = null;

                if (status.result) {
                    const statJava = document.getElementById('stat-java');
                    if (statJava && status.result.majorVersion) {
                        statJava.textContent = status.result.majorVersion;
                    }
                    const javaPathInput = document.getElementById('setting-java-path');
                    if (javaPathInput && status.result.path) {
                        javaPathInput.value = status.result.path;
                    }
                }

                showToast('Java 安装成功！环境变量已自动配置', 'success');
                setTimeout(() => closeJavaInstallModal(), 1500);
            } else if (status.status === 'failed') {
                clearInterval(javaInstallPollTimer);
                javaInstallPollTimer = null;
                showToast(status.message || 'Java安装失败', 'error');
                if (installBtn) installBtn.disabled = false;
            } else if (status.status === 'need_manual') {
                clearInterval(javaInstallPollTimer);
                javaInstallPollTimer = null;
                showToast(status.message || '未找到合适的Java运行环境，请在设置中手动安装或配置', 'warning');
                if (installBtn) installBtn.disabled = false;
            }
        } catch (e) {
            clearInterval(javaInstallPollTimer);
            javaInstallPollTimer = null;
            showToast('获取安装状态失败', 'error');
            if (installBtn) installBtn.disabled = false;
        }
    }, 500);
}

async function ensureJavaForLaunch(requiredVersion) {
    try {
        const result = await API.detectJava();
        if (result.javaList && result.javaList.length > 0) {
            const suitable = result.javaList.find(j => j.majorVersion >= requiredVersion);
            if (suitable) return true;
        }

        showJavaInstallModal(requiredVersion);
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const modal = document.getElementById('java-install-modal');
                if (!modal) {
                    clearInterval(checkInterval);
                    API.detectJava().then(r => {
                        if (r.javaList) {
                            const suitable = r.javaList.find(j => j.majorVersion >= requiredVersion);
                            resolve(!!suitable);
                        } else {
                            resolve(false);
                        }
                    }).catch(() => resolve(false));
                }
            }, 500);
        });
    } catch (e) {
        return false;
    }
}

async function openFolder(folder) {
    try { await API.openFolder(folder); }
    catch (e) { showToast('无法打开文件夹', 'error'); }
}

let _cleanupData = null;
async function cleanupScan() {
    const btn = document.getElementById('cleanup-scan-btn');
    const info = document.getElementById('cleanup-size-info');
    const details = document.getElementById('cleanup-details');
    const runBtn = document.getElementById('cleanup-run-btn');
    if (btn) { btn.disabled = true; btn.textContent = '扫描中...'; }
    try {
        const res = await API.cleanupScan();
        if (!res.success) { showToast('扫描失败: ' + (res.error || ''), 'error'); return; }
        _cleanupData = res;
        if (info) info.textContent = `可清理 ${res.totalMB} MB`;
        if (runBtn) runBtn.disabled = res.totalBytes <= 0;
        if (details) {
            const labels = { gameLogs: '游戏日志', tempFiles: '临时文件', natives: '本地库缓存', iconCache: '图标缓存', modpackCache: '整合包缓存', cache: '下载缓存' };
            const items = Object.entries(res.details || {}).filter(([, v]) => v > 0).map(([k, v]) => {
                const label = labels[k] || k;
                const mb = Math.round(v / (1024 * 1024) * 100) / 100;
                return `${label}: ${mb} MB`;
            });
            if (items.length === 0) {
                details.innerHTML = '<span style="color:var(--green)">暂无可清理的垃圾文件</span>';
                if (runBtn) runBtn.disabled = true;
            } else {
                details.innerHTML = items.map(s => `<div>• ${s}</div>`).join('');
            }
            details.style.display = 'block';
        }
    } catch (e) {
        showToast('扫描失败: ' + (e.message || e), 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '扫描'; }
    }
}

async function cleanupRun() {
    if (!_cleanupData || _cleanupData.totalBytes <= 0) { showToast('暂无可清理的内容', 'info'); return; }
    const runBtn = document.getElementById('cleanup-run-btn');
    const scanBtn = document.getElementById('cleanup-scan-btn');
    const info = document.getElementById('cleanup-size-info');
    const details = document.getElementById('cleanup-details');
    if (runBtn) { runBtn.disabled = true; runBtn.textContent = '清理中...'; }
    if (scanBtn) scanBtn.disabled = true;
    try {
        const res = await API.cleanupRun();
        if (!res.success) { showToast('清理失败: ' + (res.error || ''), 'error'); return; }
        showToast(res.message || '清理完成', 'success');
        _cleanupData = null;
        if (info) info.textContent = '已清理';
        if (details) { details.style.display = 'none'; details.innerHTML = ''; }
    } catch (e) {
        showToast('清理失败: ' + (e.message || e), 'error');
    } finally {
        if (runBtn) { runBtn.disabled = false; runBtn.textContent = '一键清理'; }
        if (scanBtn) scanBtn.disabled = false;
    }
}

function applyAccentColor(color) {
    if (!color || typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) return;
    document.documentElement.style.setProperty('--accent', color);
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.3)`);
    document.documentElement.style.setProperty('--accent-hover', `rgba(${r}, ${g}, ${b}, 0.85)`);
    document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
}

function switchTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    document.documentElement.classList.toggle('dark-theme', themeName === 'dark');
    document.documentElement.classList.toggle('light-theme', themeName === 'light');

    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-hover');
    document.documentElement.style.removeProperty('--accent-rgb');

    const app = document.getElementById('app');
    if (app && themeName === 'light') {
        app.classList.remove('wp-light', 'wp-dark');
    }

    if (typeof updateWallpaperTheme === 'function') {
        updateWallpaperTheme(themeName === 'dark');
    }

    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-theme') === themeName);
    });

    const themeDef = getComputedStyle(document.documentElement);
    const accentColor = themeDef.getPropertyValue('--accent').trim();

    const accentColorInput = document.getElementById('custom-accent-color');
    if (accentColorInput) accentColorInput.value = accentColor;
    const accentColorValueEl = document.getElementById('custom-color-value');
    if (accentColorValueEl) accentColorValueEl.textContent = accentColor;
    const colorPreviewDot = document.getElementById('color-preview-dot');
    if (colorPreviewDot) colorPreviewDot.style.background = accentColor;

    API.saveSetting('theme', themeName);
    API.saveSetting('accentColor', accentColor);
    window.electronAPI?.store?.set('versepc_theme', themeName).catch(() => {});

    showToast(`已切换到「${getThemeLabel(themeName)}」主题`, 'success');
}

function applyCustomAccent() {
    const colorInput = document.getElementById('custom-accent-color');
    const color = colorInput?.value;
    if (!color) return;
    const colorValueEl = document.getElementById('custom-color-value');
    if (colorValueEl) colorValueEl.textContent = color;
    applyAccentColor(color);
    API.saveSetting('accentColor', color);
    showToast('强调色已应用', 'success');
}

function getThemeLabel(themeName) {
    const labels = {
        dark: '黑色',
        light: '白色'
    };
    return labels[themeName] || themeName;
}

function browseFolder(type) {
    if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({ properties: ['openDirectory'] }).then(result => {
            if (!result.canceled && result.filePaths.length > 0) {
                if (type === 'target') {
                    document.getElementById('setting-target-dir').value = result.filePaths[0];
                }
            }
        }).catch(() => {});
    } else {
        showToast('请手动输入路径', 'info');
    }
}

function updateHomeStats() {
    const el = document.getElementById('stat-installed');
    if (el) el.textContent = installedVersions.length;
}

let isWindowMode = false;
let isWindowMaximized = false;

function setupWindowControls() {
    const windowControls = document.getElementById('window-controls');
    const windowModeCheckbox = document.getElementById('setting-window-mode');
    const exitLauncherBtn = document.getElementById('exit-launcher-btn');

    const isMac = window.electronAPI?.platform === 'darwin';
    if (isMac) {
        document.body.classList.add('is-mac');
    }
    if (windowControls && !isMac) windowControls.style.display = 'flex';

    const winBtnMinimize = document.getElementById('win-btn-minimize');
    if (winBtnMinimize) winBtnMinimize.addEventListener('click', () => {
        window.electronAPI.minimize();
    });

    const winBtnMaximize = document.getElementById('win-btn-maximize');
    if (winBtnMaximize) winBtnMaximize.addEventListener('click', () => {
        window.electronAPI.maximize();
    });

    const winBtnRestore = document.getElementById('win-btn-restore');
    if (winBtnRestore) winBtnRestore.addEventListener('click', () => {
        window.electronAPI.maximize();
    });

    const winBtnClose = document.getElementById('win-btn-close');
    if (winBtnClose) winBtnClose.addEventListener('click', () => {
        window.electronAPI.close();
    });

    if (window.electronAPI.onRequestCloseAnimate) {
        window.electronAPI.onRequestCloseAnimate(() => {
            const app = document.getElementById('app');
            if (app && !app.classList.contains('app-closing')) {
                app.classList.add('app-closing');
            }
        });
    }

    window.electronAPI.onWindowStateChanged((data) => {
        isWindowMaximized = data.maximized;
        isWindowMode = !data.fullscreen;
        if (windowModeCheckbox) {
            windowModeCheckbox.checked = isWindowMode;
        }
        updateWindowButtons();
    });

    window.electronAPI.onWindowModeChanged((data) => {
        isWindowMode = data.windowMode;
        isWindowMaximized = data.maximized;
        if (windowModeCheckbox) {
            windowModeCheckbox.checked = data.windowMode;
        }
        updateWindowButtons();
    });

    if (windowModeCheckbox) {
        windowModeCheckbox.addEventListener('change', () => {
            const enabled = windowModeCheckbox.checked;
            isWindowMode = enabled;
            window.electronAPI.setWindowMode(enabled);
            updateWindowButtons();
        });
    }

    if (exitLauncherBtn) {
        exitLauncherBtn.addEventListener('click', () => {
            window.electronAPI.quitApp();
        });
    }

    window.electronAPI.isFullscreen().then((fullscreen) => {
        isWindowMode = !fullscreen;
        if (windowModeCheckbox) {
            windowModeCheckbox.checked = isWindowMode;
        }
        updateWindowButtons();
    });
}

function setupVersionListClicks() {
    document.addEventListener('click', (e) => {
        const versionItem = e.target.closest('.version-item-clickable');
        if (versionItem && !e.target.closest('button')) {
            const versionId = versionItem.dataset.versionId;
            const versionUrl = versionItem.dataset.versionUrl || '';
            const versionType = versionItem.dataset.versionType || 'release';
            const isInstalled = versionItem.dataset.installed === 'true';
            const customName = versionItem.dataset.customName || '';
            
            if (versionId) {
                console.log('Version item clicked:', versionId, 'installed:', isInstalled);
                if (isInstalled) {
                    openVersionSettings(versionId, customName || versionId);
                } else {
                    openVersionDetail(versionId, versionUrl, versionType);
                }
            }
        }
    });
}

function updateWindowButtons() {
    const controls = document.getElementById('window-controls');
    const maximizeBtn = document.getElementById('win-btn-maximize');
    const restoreBtn = document.getElementById('win-btn-restore');

    if (!controls || window.electronAPI?.platform === 'darwin') return;

    controls.style.display = 'flex';
    if (isWindowMode) {
        if (isWindowMaximized) {
            maximizeBtn.style.display = 'none';
            restoreBtn.style.display = 'flex';
        } else {
            maximizeBtn.style.display = 'flex';
            restoreBtn.style.display = 'none';
        }
    } else {
        maximizeBtn.style.display = 'flex';
        restoreBtn.style.display = 'none';
    }
}

const resourceState = {
    modpack: { offset: 0, total: 0, query: '' },
    datapack: { offset: 0, total: 0, query: '' },
    resourcepack: { offset: 0, total: 0, query: '' },
    shader: { offset: 0, total: 0, query: '' },
};

const typeNames = {
    modpack: '整合包', datapack: '数据包',
    resourcepack: '材质包', shader: '光影包'
};

const typeIcons = {
    modpack: '📦', datapack: '🗄️',
    resourcepack: '🎨', shader: '☀️'
};

function getImportStageText(msg) {
    if (!msg) return '处理中...';
    if (msg.includes('download') || msg.includes('下载')) return '下载整合包内容...';
    if (msg.includes('read') || msg.includes('读取') || msg.includes('分析')) return '分析整合包...';
    if (msg.includes('mod') || msg.includes('模组')) return '下载整合包模组...';
    if (msg.includes('override') || msg.includes('配置')) return '解压整合包配置...';
    if (msg.includes('install') || msg.includes('安装')) return '安装整合包...';
    return msg;
}

async function importModpackFromFile() {
    if (window._modpackImporting) {
        showToast('整合包正在导入中，请等待完成', 'warning');
        return;
    }
    try {
        const result = await API.selectModpackFile();
        if (result && result.filePath) {
            const filePath = result.filePath;
            console.log(`[Modpack][前端] 选择文件: ${filePath}`);
            window._modpackImporting = true;
            try {
                if (typeof dlManager !== 'undefined') {
                    const sessionId = 'local-modpack-' + Date.now();
                    const taskId = 'modpack-' + sessionId;
                    dlManager.add(taskId, result.name || '整合包导入', 'modpack', sessionId, '');
                    navigateToPage('downloads');
                    if (window.electronAPI?.onImportProgress) {
                        if (window.electronAPI.removeImportProgressListener) window.electronAPI.removeImportProgressListener();
                        window.electronAPI.onImportProgress(function (data) {
                            const stageText = getImportStageText(data.message);
                            let speedText = '';
                            if (data.files && data.files.length > 0) {
                                let totalSpeed = 0;
                                let activeCount = 0;
                                for (const f of data.files) {
                                    if (f.s === 'downloading' && f.sp > 0) { totalSpeed += f.sp; activeCount++; }
                                }
                                if (totalSpeed > 0) {
                                    const speedMB = (totalSpeed / 1024 / 1024).toFixed(1);
                                    const speedKB = (totalSpeed / 1024).toFixed(0);
                                    speedText = totalSpeed > 1024 * 1024 ? ` | ${speedMB} MB/s` : ` | ${speedKB} KB/s`;
                                }
                            }
                            console.log(`[Modpack][前端] 进度: ${data.stage} ${data.progress}% ${data.message}` + (data.stageHistory ? ` (阶段数: ${data.stageHistory.length})` : ''));
                            dlManager.update(taskId, {
                                progress: data.progress || 0,
                                status: 'downloading',
                                message: stageText + speedText,
                                stageHistory: data.stageHistory || []
                            });
                        });
                    }
                    showToast('正在导入整合包...', 'info');
                    console.log(`[Modpack][前端] 调用 IPC importModpack...`);
                    const importResult = await window.electronAPI.importModpack(filePath, '');
                    console.log(`[Modpack][前端] IPC 返回:`, importResult?.success ? '成功' : '失败', importResult?.error || '');
                    if (importResult && importResult.success) {
                        dlManager.update(taskId, { status: 'completed', progress: 100, message: '导入完成' });
                        showToast(`整合包 "${importResult.name || '未知'}" 导入成功！`, 'success');
                    } else {
                        dlManager.update(taskId, { status: 'failed', progress: 100, message: importResult?.error || '未知错误', stageHistory: importResult?.stageHistory || [] });
                        showToast(`导入失败: ${importResult?.error || '未知错误'}`, 'error');
                    }
                } else {
                    navigateToPage('downloads');
                    showToast('正在导入整合包...', 'info');
                    const importResult = await window.electronAPI.importModpack(filePath, '');
                    if (importResult && importResult.success) {
                        showToast(`整合包 "${importResult.name || '未知'}" 导入成功！`, 'success');
                    } else {
                        showToast(`导入失败: ${importResult?.error || '未知错误'}`, 'error');
                    }
                }
            } finally {
                window._modpackImporting = false;
            }
        }
    } catch (e) {
        showToast('导入失败: ' + (e.message || ''), 'error');
    }
}

document.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window._modpackImporting) return;
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const name = (file.name || '').toLowerCase();
    const isModpackFile = name.endsWith('.mrpack') || name.endsWith('.cursemodpack') || name.endsWith('.zip');
    if (isModpackFile) {
        let filePath = file.path;
        if (!filePath && window.electronAPI?.getDroppedFilePath) {
            filePath = window.electronAPI.getDroppedFilePath(file);
        }
        if (filePath) {
            window._modpackImporting = true;
            if (typeof dlManager !== 'undefined') {
                const sessionId = 'local-modpack-' + Date.now();
                const taskId = 'modpack-' + sessionId;
                dlManager.add(taskId, name || '整合包导入', 'modpack', sessionId, '');
                navigateToPage('downloads');
                if (window.electronAPI?.onImportProgress) {
                    if (window.electronAPI.removeImportProgressListener) window.electronAPI.removeImportProgressListener();
                    window.electronAPI.onImportProgress(function (data) {
                        const stageText = getImportStageText(data.message);
                        dlManager.update(taskId, {
                            progress: data.progress || 0,
                            status: 'downloading',
                            message: stageText
                        });
                    });
                }
                showToast('正在导入整合包...', 'info');
                window.electronAPI.importModpack(filePath, '').then(result => {
                    window._modpackImporting = false;
                    if (result && result.success) {
                        dlManager.update(taskId, { status: 'completed', progress: 100, message: '导入完成' });
                        showToast(`整合包 "${result.name || '未知'}" 导入成功！`, 'success');
                    } else {
                        dlManager.update(taskId, { status: 'error', message: result?.error || '未知错误' });
                        showToast(`导入失败: ${result?.error || '未知错误'}`, 'error');
                    }
                }).catch(err => {
                    window._modpackImporting = false;
                    dlManager.update(taskId, { status: 'error', message: err.message || '' });
                    showToast('导入失败: ' + (err.message || ''), 'error');
                });
            } else {
                navigateToPage('downloads');
                showToast('正在导入整合包...', 'info');
                window.electronAPI.importModpack(filePath, '').then(result => {
                    window._modpackImporting = false;
                    if (result && result.success) {
                        showToast(`整合包 "${result.name || '未知'}" 导入成功！`, 'success');
                    } else {
                        showToast(`导入失败: ${result?.error || '未知错误'}`, 'error');
                    }
                }).catch(err => {
                    window._modpackImporting = false;
                    showToast('导入失败: ' + (err.message || ''), 'error');
                });
            }
        }
    }
});

function loadResourcePage(type) {
    const state = resourceState[type];
    state.offset = 0;
    state.query = '';
    loadResourceList(type);
    setupResourceEvents(type);
}

function setupResourceEvents(type) {
    const searchInput = document.getElementById(`${type === 'resourcepack' ? 'resourcepack' : type === 'shader' ? 'shader' : type === 'datapack' ? 'datapack' : 'modpack'}-search-input`);
    const searchBtn = document.getElementById(`${type === 'resourcepack' ? 'resourcepack' : type === 'shader' ? 'shader' : type === 'datapack' ? 'datapack' : 'modpack'}-search-btn`);
    const prevBtn = document.getElementById(`${type === 'resourcepack' ? 'resourcepack' : type === 'shader' ? 'shader' : type === 'datapack' ? 'datapack' : 'modpack'}-prev-btn`);
    const nextBtn = document.getElementById(`${type === 'resourcepack' ? 'resourcepack' : type === 'shader' ? 'shader' : type === 'datapack' ? 'datapack' : 'modpack'}-next-btn`);

    const prefix = type === 'resourcepack' ? 'resourcepack' : type === 'shader' ? 'shader' : type === 'datapack' ? 'datapack' : 'modpack';

    if (searchBtn && !searchBtn._bound) {
        searchBtn._bound = true;
        searchBtn.addEventListener('click', () => {
            resourceState[type].query = searchInput.value.trim();
            resourceState[type].offset = 0;
            loadResourceList(type);
        });
    }
    if (searchInput && !searchInput._bound) {
        searchInput._bound = true;
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.isComposing) {
                resourceState[type].query = searchInput.value.trim();
                resourceState[type].offset = 0;
                loadResourceList(type);
            }
        });
    }
    if (prevBtn && !prevBtn._bound) {
        prevBtn._bound = true;
        prevBtn.addEventListener('click', () => {
            if (resourceState[type].offset >= 15) {
                resourceState[type].offset -= 15;
                loadResourceList(type);
            }
        });
    }
    if (nextBtn && !nextBtn._bound) {
        nextBtn._bound = true;
        nextBtn.addEventListener('click', () => {
            resourceState[type].offset += 15;
            loadResourceList(type);
        });
    }

    const loaderInstance = customSelectInstances[`${prefix}-filter-loader`];
    const versionInstance = customSelectInstances[`${prefix}-filter-version`];
    if (loaderInstance && !loaderInstance._resourceBound) {
        loaderInstance._resourceBound = true;
        loaderInstance.onChange = () => {
            resourceState[type].offset = 0;
            loadResourceList(type);
        };
    }
    if (versionInstance && !versionInstance._resourceBound) {
        versionInstance._resourceBound = true;
        const origOnChange = versionInstance.onChange;
        versionInstance.onChange = () => {
            if (origOnChange) origOnChange();
            resourceState[type].offset = 0;
            loadResourceList(type);
        };
    }
    if (type === 'resourcepack') {
        const resolutionInstance = customSelectInstances['resourcepack-filter-resolution'];
        if (resolutionInstance && !resolutionInstance._resourceBound) {
            resolutionInstance._resourceBound = true;
            resolutionInstance.onChange = () => {
                resourceState[type].offset = 0;
                loadResourceList(type);
            };
        }
    }
}

async function loadResourceList(type) {
    const prefix = type === 'resourcepack' ? 'resourcepack' : type === 'shader' ? 'shader' : type === 'datapack' ? 'datapack' : 'modpack';
    const container = document.getElementById(`${prefix}-browse-list`);
    if (!container) return;
    container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>正在获取${typeNames[type] || '资源'}列表...</p></div>`;

    const state = resourceState[type];
    const loader = getCustomSelectValue(`${prefix}-filter-loader`);
    const version = getCustomSelectValue(`${prefix}-filter-version`);
    const resolution = type === 'resourcepack' ? getCustomSelectValue('resourcepack-filter-resolution') : '';

    try {
        const data = await API.searchResources(state.query, type, loader, version, resolution, 'downloads', 15, state.offset);
        const hits = data.hits || [];
        state.total = data.total || 0;
        hits.forEach(item => _projectDataCache.set(item.id, item));

        if (hits.length === 0) {
            if (state.query) {
                container.innerHTML = `<p class="empty-text">暂无匹配的${typeNames[type]}</p><p class="empty-hint">试试其他关键词吧</p>`;
            } else {
                container.innerHTML = `<p class="empty-text">暂无${typeNames[type]}</p>`;
            }
        } else {
            container.innerHTML = hits.map(item => `
                <div class="mod-item mod-item-clickable" onclick="openResourceDetail('${item.id}', '${type}')" onmouseenter="preloadModVersions('${item.id}', 'modrinth')">
                    ${item.icon ? `<div class="mod-icon"><img src="${item.icon}" alt="" onerror="this.parentElement.remove()"></div>` : ''}
                    <div class="mod-info">
                        <div class="mod-name">${escapeHtml(formatModNameWithChinese(item.slug || item.id, item.title))}</div>
                        <div class="mod-desc">${escapeHtml(item.description)}</div>
                        <div class="mod-meta">
                            <span>⬇ ${formatNumber(item.downloads)}</span>
                            <span>❤ ${escapeHtml(item.author)}</span>
                            <span>${(item.categories || []).slice(0, 3).join(', ')}</span>
                        </div>
                    </div>
                    <div class="mod-actions" onclick="event.stopPropagation()">
                        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openResourceDetail('${item.id}', '${type}')">安装</button>
                    </div>
                </div>
            `).join('');
        }

        const pageInfo = document.getElementById(`${prefix}-page-info`);
        const totalPages = Math.max(1, Math.ceil(state.total / 15));
        const currentPage = Math.floor(state.offset / 15) + 1;
        if (pageInfo) pageInfo.textContent = `${currentPage}/${totalPages}`;
    } catch (e) {
        container.innerHTML = `<p class="empty-text">加载失败</p><button class="btn btn-secondary btn-sm" onclick="loadResourceList('${type}')" style="margin-top:8px">重试</button>`;
    }
}

async function openResourceDetail(projectId, type) {
    currentModDetailId = projectId;
    currentModDetailSource = 'modrinth';
    currentModDetailType = type;

    navigateToPage('mod-detail');

    const depsSection = document.getElementById('md-deps-section');
    if (depsSection) depsSection.style.display = 'none';
    if (type !== 'mod' && modMultiSelectMode) {
        modMultiSelectMode = false;
    }
    mdCurrentDeps = [];
    mdDepsResolved = {};
    mdDepsVersionInfo = {};

    const backBtn = document.querySelector('#page-mod-detail .moddetail-page-header .btn-icon');
    if (backBtn) {
        const pageMap = { mod: 'mods', modpack: 'modpacks', datapack: 'datapacks', resourcepack: 'resourcepacks', shader: 'shaders' };
        backBtn.setAttribute('onclick', `navigateToPage('${pageMap[type] || 'mods'}')`);
    }

    const mdName = document.getElementById('md-name');
    const mdDesc = document.getElementById('md-desc');
    const mdIconImg = document.getElementById('md-icon-img');
    const mdIconFallback = document.getElementById('md-icon-fallback');
    const mdVersionList = document.getElementById('md-version-list');
    const mdVersionTabs = document.getElementById('md-version-tabs');

    if (!mdName || !mdVersionList) return;

    const typeNames = { mod: '模组', modpack: '整合包', resourcepack: '材质包', shader: '光影包', datapack: '数据包' };
    const typeIcons = { mod: '🧩', modpack: '📦', resourcepack: '🎨', shader: '✨', datapack: '📊' };

    const cached = _projectDataCache.get(projectId);
    if (cached) {
        console.log('[ResDetail] Cache hit, rendering immediately');
        currentModDetailData = cached;
        mdName.textContent = formatModNameWithChinese(cached.slug || cached.id, cached.title || typeNames[type] || '未知');
        if (mdDesc) mdDesc.textContent = (cached.description || '').substring(0, 200);
        if (cached.icon && mdIconImg && mdIconFallback) { mdIconImg.src = cached.icon; mdIconImg.style.display = ''; mdIconFallback.style.display = 'none'; }
        const mdDownloads = document.getElementById('md-downloads');
        const mdFollowers = document.getElementById('md-followers');
        if (mdDownloads) mdDownloads.textContent = `⬇ ${formatNumber(cached.downloads || 0)}`;
        if (mdFollowers) mdFollowers.textContent = `❤ ${formatNumber(cached.followers || 0)}`;
        const srcBadge = document.getElementById('md-source-badge');
        if (srcBadge) { srcBadge.textContent = typeNames[type] || type; srcBadge.style.color = '#f59e0b'; srcBadge.style.background = 'rgba(245,158,11,0.12)'; }
    } else {
        mdName.textContent = '加载中...';
    }

    const _hasPreloaded = _versionPreloadCache.has(projectId);
    let _resLoadingTimer = null;
    if (!_hasPreloaded) {
        _resLoadingTimer = setTimeout(() => {
            if (mdVersionList && !mdVersionList.querySelector('.mdv-group')) {
                mdVersionList.innerHTML = '<p class="empty-text" style="padding:30px 0;text-align:center;color:var(--text-muted)">加载版本列表...</p>';
            }
        }, 400);
    }
    if (mdVersionTabs) mdVersionTabs.innerHTML = '';

    try {
        const versionsPromise = _hasPreloaded
            ? Promise.resolve(_versionPreloadCache.get(projectId))
            : API.getModVersions(projectId, 'modrinth').catch(e => { console.error('[ResDetail] getModVersions failed:', e); return null; });
        _versionPreloadCache.delete(projectId);
        const detailPromise = cached ? Promise.resolve(cached) : API.getModDetail(projectId, 'modrinth').catch(e => { console.error('[ResDetail] getModDetail failed:', e); return null; });

        const [detail, data] = await Promise.all([detailPromise, versionsPromise]);
        if (_resLoadingTimer) { clearTimeout(_resLoadingTimer); _resLoadingTimer = null; }
        if (!detail) {
            mdName.textContent = '加载失败';
            mdVersionList.innerHTML = `<p class="empty-text" style="padding:30px 0;text-align:center;color:var(--text-muted)">无法加载详情: API请求失败，请检查网络连接</p>`;
            return;
        }
        if (!cached) {
            _projectDataCache.set(projectId, detail);
            currentModDetailData = detail;
            mdName.textContent = formatModNameWithChinese(detail.slug || detail.id, detail.title || typeNames[type] || '未知');
            if (mdDesc) mdDesc.textContent = (detail.description || '').substring(0, 200);
            if (detail.icon && mdIconImg && mdIconFallback) { mdIconImg.src = detail.icon; mdIconImg.style.display = ''; mdIconFallback.style.display = 'none'; }
            const mdDownloads = document.getElementById('md-downloads');
            const mdFollowers = document.getElementById('md-followers');
            if (mdDownloads) mdDownloads.textContent = `⬇ ${formatNumber(detail.downloads || 0)}`;
            if (mdFollowers) mdFollowers.textContent = `❤ ${formatNumber(detail.followers || 0)}`;
            const srcBadge = document.getElementById('md-source-badge');
            if (srcBadge) { srcBadge.textContent = typeNames[type] || type; srcBadge.style.color = '#f59e0b'; srcBadge.style.background = 'rgba(245,158,11,0.12)'; }
        }

        mdAllVersions = data ? (data.versions || []) : [];
        if (!Array.isArray(mdAllVersions)) mdAllVersions = [];

        const currentGameVersion = getCustomSelectValue('mod-filter-version') || '';
        const currentLoader = getCustomSelectValue('mod-filter-loader') || '';

        if (currentGameVersion || currentLoader) {
            const filtered = mdAllVersions.filter(v => {
                const gv = v.gameVersions || [];
                const loaders = (v.loaders || []).map(l => l.toLowerCase());
                let match = true;
                if (currentGameVersion && !gv.includes(currentGameVersion)) match = false;
                if (currentLoader && !loaders.includes(currentLoader.toLowerCase())) match = false;
                return match;
            });
            renderMdVersionList(filtered);
            
            if (mdVersionTabs) {
                mdVersionTabs.innerHTML = `<button class="md-vtab active" data-ver="_filtered" onclick="switchMdVersionTab('_filtered')">筛选结果 (${filtered.length})</button><button class="md-vtab" data-ver="" onclick="switchMdVersionTab('')">全部 (${mdAllVersions.length})</button>`;
            }
        } else {
            const tabsContainer = document.getElementById('md-version-tabs');
            const gameVersions = new Set();
            mdAllVersions.forEach(v => {
                (v.gameVersions || []).forEach(gv => gameVersions.add(gv));
            });

            let tabsHtml = '<button class="md-vtab active" data-ver="" onclick="switchMdVersionTab(\'\')">全部</button>';
            [...gameVersions].sort().reverse().forEach(gv => {
                tabsHtml += `<button class="md-vtab" data-ver="${escapeHtml(gv)}" onclick="switchMdVersionTab('${escapeOnclick(gv)}')">${escapeHtml(gv)}</button>`;
            });
            if (tabsContainer) tabsContainer.innerHTML = tabsHtml;
            
            renderMdVersionList(mdAllVersions);
        }
    } catch (e) {
        mdName.textContent = '加载失败';
        mdVersionList.innerHTML = `<p class="empty-text" style="padding:30px 0;text-align:center;color:var(--text-muted)">无法加载详情: ${e.message || e}</p>`;
    }
}

// 全局变量：当前整合包详情的目标版本
async function quickInstallResource(projectId, type) {
    if (type === 'modpack') {
        showToast('正在下载整合包，将创建为新版本...', 'info');
        try {
            const result = await API.downloadResource('', projectId, type, '');
            if (result.success) {
                showModpackInstallModal(result.fileName, result.sessionId);
            } else {
                showToast(result.error || '安装失败', 'error');
            }
        } catch (e) {
            showToast('安装失败', 'error');
        }
    } else {
        showToast('请选择保存文件夹...', 'info');
        try {
            const defaultPath = await resolveResourceSavePath(type);
            const folderResult = await API.selectSaveFolder(defaultPath);
            if (folderResult.cancelled) {
                if (folderResult.error) {
                    showToast('文件夹选择失败: ' + folderResult.error, 'error');
                }
                return;
            }
            const savePath = folderResult.path;
            if (!savePath) {
                showToast('未选择文件夹', 'error');
                return;
            }
            localStorage.setItem('lastResourceSavePath_' + type, savePath);
            showToast(`正在安装${typeNames[type]}...`, 'info');
            const result = await API.downloadResource('', projectId, type, '', savePath);
            if (result.success) {
                showModDownloadModal(result.fileName, result.sessionId);
            } else {
                showToast(result.error || '安装失败', 'error');
            }
        } catch (e) {
            showToast('安装失败', 'error');
        }
    }
}

// 显示版本选择对话框
async function showVersionSelectDialog() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;';
        
        modal.innerHTML = `
            <div style="background:var(--bg-secondary,#1a1a2e);border-radius:12px;padding:24px;min-width:320px;max-width:400px;border:1px solid var(--border-color,rgba(255,255,255,0.1));">
                <h3 style="margin:0 0 16px;color:var(--text-primary,#fff);">选择目标版本</h3>
                <p style="margin:0 0 16px;color:var(--text-muted,#aaa);font-size:13px;">整合包将安装到所选版本中</p>
                <select id="version-select-dialog" style="width:100%;padding:10px 12px;background:var(--bg-input,#252540);border:1px solid var(--border-color,rgba(255,255,255,0.15));border-radius:8px;color:var(--text-primary,#fff);font-size:14px;">
                    <option value="">加载中...</option>
                </select>
                <div style="display:flex;gap:12px;margin-top:20px;justify-content:flex-end;">
                    <button id="version-select-cancel" style="padding:8px 16px;background:transparent;border:1px solid var(--border-color,rgba(255,255,255,0.2));border-radius:6px;color:var(--text-secondary,#ccc);cursor:pointer;">取消</button>
                    <button id="version-select-confirm" style="padding:8px 16px;background:var(--accent,#60a5fa);border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:500;">确认安装</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const select = modal.querySelector('#version-select-dialog');
        const cancelBtn = modal.querySelector('#version-select-cancel');
        const confirmBtn = modal.querySelector('#version-select-confirm');
        
        API.getVersions(true).then(data => {
            select.innerHTML = '';
            const installed = (data?.installed || []).filter(v => v.id && v.type !== '(old)');
            if (installed.length === 0) {
                select.innerHTML = '<option value="">没有已安装的版本</option>';
            } else {
                installed.forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v.id;
                    let label = v.id;
                    if (v.isModpack) label += ` [${v.modpackLoader || '整合包'}]`;
                    else if (v.isFabric) label += ' [Fabric]';
                    else if (v.isForge) label += ' [Forge]';
                    else if (v.isNeoForge) label += ' [NeoForge]';
                    else if (v.isOptiFine) label += ' [OptiFine]';
                    opt.textContent = label;
                    select.appendChild(opt);
                });
            }
        }).catch(() => {
            select.innerHTML = '<option value="">加载失败</option>';
        });
        
        const close = (result) => {
            document.body.removeChild(modal);
            resolve(result);
        };
        
        cancelBtn.addEventListener('click', () => close(''));
        confirmBtn.addEventListener('click', () => close(select.value));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close('');
        });
    });
}

let currentSettingsVersionId = null;
let currentVersionSettings = null;
let _modMgrSettingsLoaded = false;
let _exportTreeLoaded = false;

async function openVersionSettings(versionId, versionName) {
    currentSettingsVersionId = versionId;
    _modMgrSettingsLoaded = false;
    _exportTreeLoaded = false;
    const versionInfo = installedVersions.find(v => v.id === versionId);
    const displayName = versionInfo?.customName || versionName || versionId;
    document.getElementById('vset-title').textContent = '版本设置 - ' + displayName;
    document.getElementById('export-name').value = displayName;

    const externalInfoEl = document.getElementById('vset-external-info');
    if (externalInfoEl) {
        if (versionInfo && versionInfo.isExternal) {
            externalInfoEl.style.display = 'block';
            externalInfoEl.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:8px;background:rgba(255,165,0,0.08);border:1px solid rgba(255,165,0,0.2)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#ffa500" stroke-width="2" style="width:18px;height:18px;flex-shrink:0"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                    <div>
                        <div style="font-size:13px;color:var(--text-primary);font-weight:500">外部文件夹版本</div>
                        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;word-break:break-all">${escapeHtml(versionInfo.externalPath || '')}</div>
                    </div>
                </div>`;
        } else {
            externalInfoEl.style.display = 'none';
        }
    }
    
    API.saveSetting('selectedVersion', versionId).catch(e => {
        console.error('[VersionSettings] Failed to set selectedVersion:', e);
    });
    
    navigateToPage('version-settings');
    document.querySelector('.content-area').classList.add('no-scroll');
    switchVSetTab('overview');
    loadVersionSettingsUI();
}

async function loadVersionSettingsUI() {
    if (!currentSettingsVersionId) return;
    try {
        const settings = await API.getVersionSettings(currentSettingsVersionId);
        currentVersionSettings = settings;

        const customNameInput = document.getElementById('vset-custom-name');
        if (customNameInput) customNameInput.value = settings.customName || '';

        const descriptionInput = document.getElementById('vset-description');
        if (descriptionInput) descriptionInput.value = settings.description || '';

        const isolationSelect = document.getElementById('vset-isolation');
        if (isolationSelect) {
            const versionInfo = installedVersions.find(v => v.id === currentSettingsVersionId);
            const isExternal = versionInfo && versionInfo.isExternal;
            isolationSelect.value = settings.isolation || (isExternal ? 'on' : 'global');
        }

        const windowTitle = document.getElementById('vset-window-title');
        if (windowTitle) windowTitle.value = settings.windowTitle || '';

        const customInfo = document.getElementById('vset-custom-info');
        if (customInfo) customInfo.value = settings.customInfo || '';

        if (document.getElementById('vset-java-wrapper') || customSelectInstances['vset-java']) {
            await refreshVsetJavaOptions(settings.javaPath || 'global');
        }

        const memoryMode = document.querySelector(`input[name="vsetMemoryMode"][value="${settings.memoryMode || 'global'}"]`);
        if (memoryMode) memoryMode.checked = true;

        const memoryCustom = document.getElementById('vset-memory-custom');
        if (memoryCustom) memoryCustom.style.display = settings.memoryMode === 'custom' ? 'block' : 'none';

        const memoryValue = document.getElementById('vset-memory-value');
        if (memoryValue) memoryValue.value = settings.memoryValue || 4096;

        const memoryDisplay = document.getElementById('vset-memory-display');
        if (memoryDisplay) memoryDisplay.textContent = (settings.memoryValue || 4096) + ' MB';

        const memOptimize = document.getElementById('vset-mem-optimize');
        if (memOptimize) memOptimize.value = settings.memOptimize || 'global';

        const jvmArgsInput = document.getElementById('vset-jvm-args');
        if (jvmArgsInput) jvmArgsInput.value = settings.jvmArgs || '';

        const gameArgsInput = document.getElementById('vset-game-args');
        if (gameArgsInput) gameArgsInput.value = settings.gameArgs || '';

    } catch (e) {
        console.error('[VersionSettings] Load settings error:', e);
    }
}

function saveCurrentVersionSetting(key, value) {
    if (!currentSettingsVersionId) return;
    const data = { versionId: currentSettingsVersionId, [key]: value };
    API.saveVersionSettings(data).then(r => {
        if (r.success) {
            if (currentVersionSettings) currentVersionSettings[key] = value;
        }
    }).catch(e => console.error('[VersionSettings] Save error:', e));
}

async function refreshVsetJavaOptions(selectValue) {
    try {
        const javaData = await API.getInstalledJava();
        const javaList = javaData.java || [];
        const options = [
            { value: 'global', text: '跟随全局设置' },
            ...javaList.map(j => ({
                value: j.path || j.executable || '',
                text: `${j.version || j.name || 'Java'}${j.arch ? ' (' + j.arch + ')' : ''}${j.majorVersion ? ' [' + j.majorVersion + ']' : ''}`
            }))
        ];
        if (!customSelectInstances['vset-java']) {
            customSelectInstances['vset-java'] = new CustomSelect('vset-java-wrapper', {
                onChange: (value) => saveCurrentVersionSetting('javaPath', value)
            });
        }
        customSelectInstances['vset-java'].setOptions(options);
        if (selectValue) {
            customSelectInstances['vset-java'].setValue(selectValue);
        }
    } catch (e) {
        console.error('[VersionSettings] Refresh Java options error:', e);
    }
}

async function vsetDetectJava() {
    if (!currentSettingsVersionId) return;
    showToast('正在搜索 Java...', 'info');
    try {
        const result = await API.detectJava();
        if (result.javaList && result.javaList.length > 0) {
            const best = result.javaList.find(j => j.majorVersion >= 17) || result.javaList[0];
            await refreshVsetJavaOptions(best.path);
            saveCurrentVersionSetting('javaPath', best.path);
            showToast(`已找到 Java ${best.version}，已自动选中`, 'success');
        } else {
            showToast('未检测到 Java，请尝试手动导入', 'warning');
        }
    } catch (e) {
        showToast('Java 搜索失败', 'error');
    }
}

async function vsetBrowseJava() {
    if (!currentSettingsVersionId) return;
    if (window.electronAPI && window.electronAPI.showOpenDialog) {
        try {
            const result = await window.electronAPI.showOpenDialog({
                properties: ['openFile'],
                filters: [{ name: 'Java 可执行文件', extensions: ['exe', ''] }]
            });
            if (!result.canceled && result.filePaths.length > 0) {
                const javaPath = result.filePaths[0];
                await refreshVsetJavaOptions(javaPath);
                saveCurrentVersionSetting('javaPath', javaPath);
                showToast('已导入 Java，已自动选中', 'success');
            }
        } catch (e) {
            showToast('导入失败', 'error');
        }
    } else {
        showToast('请手动输入 Java 路径', 'info');
    }
}

function refreshVersionDisplayName() {
    if (!currentSettingsVersionId) return;
    const customName = document.getElementById('vset-custom-name')?.value || '';
    const versionInfo = installedVersions.find(v => v.id === currentSettingsVersionId);
    if (versionInfo) versionInfo.customName = customName;
    const displayName = customName || currentSettingsVersionId;
    document.getElementById('vset-title').textContent = '版本设置 - ' + displayName;
    const vItem = document.querySelector(`.version-item[data-version-id="${CSS.escape(currentSettingsVersionId)}"] .version-item-name`);
    if (vItem) vItem.textContent = displayName;
    updateVersionSelects();
}

function closeVersionSettings() {
    currentSettingsVersionId = null;
    currentVersionSettings = null;
    _modDownloadVersionId = '';
    document.querySelector('.content-area').classList.remove('no-scroll');
    navigateToPage(previousPage || 'home');
}

function switchVSetTab(tabName) {
    document.querySelectorAll('.vset-nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector(`.vset-nav-item[data-tab="${tabName}"]`)?.classList.add('active');

    document.querySelectorAll('.vset-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(`vset-panel-${tabName}`);
    if (panel) panel.classList.add('active');

    if (tabName === 'modmgr') {
        const versionInfo = installedVersions.find(v => v.id === currentSettingsVersionId);
        const isVanilla = versionInfo && !versionInfo.isFabric && !versionInfo.isForge && !versionInfo.isNeoForge;
        const modList = document.getElementById('modmgr-mod-list');
        const modHeader = panel?.querySelector('.modmgr-header-row');
        const modActions = panel?.querySelector('.modmgr-actions');
        if (isVanilla) {
            if (modHeader) modHeader.style.display = 'none';
            if (modActions) modActions.style.display = 'none';
            if (modList) {
                modList.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" style="width:48px;height:48px;margin-bottom:16px;opacity:0.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        <div style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">原版不支持安装模组</div>
                        <div style="font-size:13px;color:var(--text-muted);max-width:320px;line-height:1.6;">此版本为 Minecraft 原版，没有模组加载器。如需安装模组，请先安装 Fabric、Forge 或 NeoForge 模组加载器。</div>
                    </div>`;
            }
        } else {
            if (modHeader) modHeader.style.display = '';
            if (modActions) modActions.style.display = '';
            if (!_modMgrSettingsLoaded) {
                loadInstalledModsForSettings();
            }
        }
    } else if (tabName === 'export' && !_exportTreeLoaded) {
        loadExportTreeData();
    }
}

function openVersionFolder() {
    if (!currentSettingsVersionId) return;
    API.openVersionFolder(currentSettingsVersionId, 'version');
}

function openSavesFolder() {
    if (!currentSettingsVersionId) return;
    API.openVersionFolder(currentSettingsVersionId, 'saves');
}

function openModsFolder() {
    if (!currentSettingsVersionId) return;
    API.openVersionFolder(currentSettingsVersionId, 'mods');
}

let _checkingModUpdates = false;

async function checkModUpdatesForVersion() {
    if (!currentSettingsVersionId) {
        showToast('请先选择一个版本', 'error');
        return;
    }
    if (_checkingModUpdates) {
        showToast('正在检查更新，请稍候...', 'info');
        return;
    }
    _checkingModUpdates = true;
    showToast('正在检查模组更新...', 'info');
    try {
        const result = await API.checkModUpdates(currentSettingsVersionId);
        if (result.error) {
            showToast('检查更新失败: ' + result.error, 'error');
            return;
        }
        const updates = result.updates || [];
        if (updates.length === 0) {
            showToast(`已检查 ${result.checked || 0} 个模组，暂无更新`, 'success');
            return;
        }
        showModUpdateDialog(updates, result.checked || 0);
    } catch (e) {
        showToast('检查更新失败: ' + (e.message || '未知错误'), 'error');
    } finally {
        _checkingModUpdates = false;
    }
}

function showModUpdateDialog(updates, checkedCount) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

    const dialog = document.createElement('div');
    dialog.style.cssText = 'background:var(--bg-primary);border-radius:12px;padding:24px;max-width:560px;width:90%;max-height:70vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.3);';

    const listHtml = updates.map(u => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-color);">
            <div style="flex:1;min-width:0;">
                <div style="font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(u.modName)}</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${escapeHtml(u.fileName)} | 当前版本: ${escapeHtml(u.currentVersion)}</div>
            </div>
            <a href="${u.projectUrl}" target="_blank" style="color:var(--accent);font-size:13px;text-decoration:none;white-space:nowrap;margin-left:12px;">查看更新</a>
        </div>
    `).join('');

    dialog.innerHTML = `
        <h3 style="margin:0 0 4px 0;color:var(--text-primary);">模组更新检查</h3>
        <p style="margin:0 0 16px 0;font-size:13px;color:var(--text-muted);">已检查 ${checkedCount} 个模组，发现 ${updates.length} 个可在 Modrinth 上找到</p>
        <div>${listHtml}</div>
        <div style="margin-top:16px;text-align:right;">
            <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        </div>
    `;

    overlay.appendChild(dialog);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
}

function exportLaunchScript() {
    if (!currentSettingsVersionId) return;
    API.exportLaunchScript(currentSettingsVersionId).then(r => {
        if (r.success) showToast('启动脚本已导出', 'success');
        else showToast(r.error || '导出失败', 'error');
    });
}

let currentRepairSessionId = null;
let repairPollTimer = null;

function showRepairModal(versionId) {
    document.getElementById('repair-modal-title').textContent = `文件修复 - ${versionId}`;
    document.getElementById('repair-progress-fill').style.width = '0%';
    document.getElementById('repair-stage').textContent = '准备中...';
    document.getElementById('repair-percent').textContent = '0%';
    document.getElementById('repair-message').textContent = '';
    document.getElementById('repair-file-count').textContent = '';
    document.getElementById('repair-cancel-btn').style.display = '';
    showModal('repair-modal');
}

function closeRepairModal() {
    hideModal('repair-modal');
    if (repairPollTimer) { clearTimeout(repairPollTimer); repairPollTimer = null; }
    currentRepairSessionId = null;
}

function cancelRepair() {
    if (currentRepairSessionId) {
        API.repairCancel(currentRepairSessionId);
        currentRepairSessionId = null;
    }
    if (repairPollTimer) { clearTimeout(repairPollTimer); repairPollTimer = null; }
    document.getElementById('repair-stage').textContent = '修复已取消';
    document.getElementById('repair-cancel-btn').style.display = 'none';
    showToast('修复已取消', 'info');
    setTimeout(() => hideModal('repair-modal'), 1500);
}

function getRepairStageText(stage) {
    const map = {
        'preparing': '准备修复...',
        'directories': '检查目录结构...',
        'resolve': '解析版本信息...',
        'scanning': '扫描库文件...',
        'client_jar': '检查客户端JAR...',
        'downloading': '下载缺失文件...',
        'complete': '修复完成',
        'failed': '修复失败',
        'cancelled': '已取消'
    };
    return map[stage] || stage || '';
}

function pollRepairProgress(sessionId) {
    const poll = async () => {
        try {
            const data = await API.repairProgress(sessionId);
            const fill = document.getElementById('repair-progress-fill');
            const stage = document.getElementById('repair-stage');
            const percent = document.getElementById('repair-percent');
            const message = document.getElementById('repair-message');
            const fileCount = document.getElementById('repair-file-count');

            if (fill) fill.style.width = `${data.progress || 0}%`;
            if (stage) stage.textContent = getRepairStageText(data.stage);
            if (percent) percent.textContent = `${Math.round(data.progress || 0)}%`;
            if (message) message.textContent = data.message || '';

            if (fileCount) {
                const parts = [];
                if (data.checkedFiles !== undefined && data.totalFiles !== undefined) {
                    parts.push(`已检查: ${data.checkedFiles}/${data.totalFiles}`);
                }
                if (data.missingFiles !== undefined) {
                    parts.push(`缺失: ${data.missingFiles}`);
                }
                if (data.repairedFiles !== undefined) {
                    parts.push(`已修复: ${data.repairedFiles}`);
                }
                if (data.currentFile) {
                    parts.push(`当前: ${data.currentFile}`);
                }
                fileCount.textContent = parts.join(' | ');
            }

            if (data.status === 'completed') {
                document.getElementById('repair-progress-fill').style.width = '100%';
                document.getElementById('repair-percent').textContent = '100%';
                document.getElementById('repair-cancel-btn').style.display = 'none';
                showToast(data.message || '文件修复完成！', 'success');
                currentRepairSessionId = null;
                setTimeout(() => hideModal('repair-modal'), 2000);
                return;
            }
            if (data.status === 'failed') {
                document.getElementById('repair-stage').textContent = '修复失败';
                document.getElementById('repair-cancel-btn').style.display = 'none';
                showToast(data.message || '文件修复失败', 'error');
                currentRepairSessionId = null;
                return;
            }
            if (data.status === 'cancelled') {
                currentRepairSessionId = null;
                return;
            }
            repairPollTimer = setTimeout(poll, 500);
        } catch (e) {
            repairPollTimer = setTimeout(poll, 1000);
        }
    };
    poll();
}

async function repairFiles() {
    if (!currentSettingsVersionId) return;

    showRepairModal(currentSettingsVersionId);

    try {
        const result = await API.repairStart(currentSettingsVersionId);
        if (result.success && result.sessionId) {
            currentRepairSessionId = result.sessionId;
            pollRepairProgress(result.sessionId);
        } else {
            document.getElementById('repair-stage').textContent = '启动失败';
            document.getElementById('repair-message').textContent = result.error || '无法启动修复';
            document.getElementById('repair-cancel-btn').style.display = 'none';
            showToast(result.error || '启动修复失败', 'error');
        }
    } catch (e) {
        document.getElementById('repair-stage').textContent = '启动失败';
        document.getElementById('repair-message').textContent = '网络错误，请重试';
        document.getElementById('repair-cancel-btn').style.display = 'none';
        showToast('启动修复失败: ' + e.message, 'error');
    }
}

async function diagnoseVersion() {
    if (!currentSettingsVersionId) {
        showToast('请先选择一个游戏版本', 'error');
        return;
    }

    try {
        const result = await API.diagnoseVersion(currentSettingsVersionId);
        showDiagnoseDialog(result);
    } catch (e) {
        showToast('诊断失败: ' + e.message, 'error');
    }
}

function showDiagnoseDialog(result) {
    const issues = result.issues || [];
    const typeColors = { critical: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
    const typeLabels = { critical: '严重', warning: '警告', info: '信息' };

    let html = issues.map(issue => `
        <div style="display:flex;align-items:flex-start;gap:8px;padding:8px;border-radius:6px;background:var(--bg-active);margin-bottom:6px;">
            <span style="color:${typeColors[issue.type]};font-weight:600;min-width:36px;">${typeLabels[issue.type]}</span>
            <div>
                <div style="font-size:13px;">${issue.message}</div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${issue.solution}</div>
            </div>
        </div>
    `).join('');

    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
        <div class="modal-content" style="width:520px;min-height:auto;max-height:80vh;">
            <div class="modal-header">
                <h3>版本诊断结果</h3>
                <button class="modal-close diagnose-close" aria-label="关闭对话框">&times;</button>
            </div>
            <div class="modal-body" style="overflow-y:auto;max-height:60vh;">
                ${html}
            </div>
            <div class="modal-footer">
                <button class="modal-btn modal-btn--secondary diagnose-close">关闭</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('modal-visible'));

    const close = () => {
        overlay.classList.add('modal-exiting');
        overlay.classList.remove('modal-visible');
        setTimeout(() => {
            if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
        }, 200);
    };

    overlay.querySelectorAll('.diagnose-close').forEach(btn => btn.addEventListener('click', close));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

async function deleteCurrentVersion() {
    if (!currentSettingsVersionId) {
        showToast('未找到版本信息', 'error');
        return;
    }
    const isExternal = currentSettingsVersionId.includes(' [外部');
    if (isExternal) {
        const confirmed = await showConfirmDialog('移除外部版本', '确定要从列表中移除此外部版本吗？（不会删除实际游戏文件）', '移除', '取消');
        if (!confirmed) return;
    } else {
        const ver = installedVersions.find(v => v.id === currentSettingsVersionId);
        let warningParts = [];
        if (ver?.hasMods) warningParts.push('模组');
        if (ver?.hasSaves) warningParts.push('存档');
        if (ver?.hasResourcepacks) warningParts.push('资源包');
        let confirmMsg = `确定要删除版本 ${currentSettingsVersionId} 吗？此操作不可撤销！`;

        let chainInfo = '';
        try {
            const chainResult = await API.getDeleteChain(currentSettingsVersionId);
            if (chainResult.success && chainResult.willDelete && chainResult.willDelete.length > 1) {
                const otherVersions = chainResult.willDelete.filter(id => id !== currentSettingsVersionId);
                if (otherVersions.length > 0) {
                    chainInfo = `\n\n同时将删除关联版本：\n${otherVersions.map(id => '• ' + id).join('\n')}`;
                }
            }
        } catch (_) {}

        if (warningParts.length > 0) {
            confirmMsg += `\n\n⚠ 由于该版本开启了版本隔离，删除版本时该版本对应的${warningParts.join('、')}等文件也将被一并删除！`;
        }
        if (chainInfo) confirmMsg += chainInfo;

        const confirmed = await showConfirmDialog('版本删除确认', confirmMsg, '删除', '取消');
        if (!confirmed) return;
    }
    const deletedVersionId = currentSettingsVersionId;
    try {
        const r = await API.deleteVersion(deletedVersionId);
        if (r.success) {
            const deletedNames = r.deleted ? r.deleted.join('、') : deletedVersionId;
            showToast(`版本 ${deletedNames} 已删除`, 'success');
            closeVersionSettings();
            await loadVersions(true);
        } else {
            showToast(r.error || '删除失败', 'error');
        }
    } catch (e) {
        showToast('删除失败', 'error');
    }
}

document.querySelectorAll('input[name="vsetMemoryMode"]').forEach(r => {
    r.addEventListener('change', function() {
        document.getElementById('vset-memory-custom').style.display = this.value === 'custom' ? 'block' : 'none';
        saveCurrentVersionSetting('memoryMode', this.value);
    });
});

const memSlider = getDOMElement('vset-memory-value');
if (memSlider) {
    const memDisplay = getDOMElement('vset-memory-display');
    memSlider.addEventListener('input', throttle(function() {
        if (memDisplay) memDisplay.textContent = this.value + ' MB';
    }, 50));
    memSlider.addEventListener('change', function() {
        saveCurrentVersionSetting('memoryValue', parseInt(this.value, 10));
    });
}


document.getElementById('vset-isolation')?.addEventListener('change', function() {
    saveCurrentVersionSetting('isolation', this.value);
});

document.getElementById('vset-window-title')?.addEventListener('change', function() {
    saveCurrentVersionSetting('windowTitle', this.value);
});

document.getElementById('vset-custom-info')?.addEventListener('change', function() {
    saveCurrentVersionSetting('customInfo', this.value);
});

if (customSelectInstances['vset-java']) {
    customSelectInstances['vset-java'].onChange = (value) => saveCurrentVersionSetting('javaPath', value);
}

if (customSelectInstances['vset-mem-optimize']) {
    customSelectInstances['vset-mem-optimize'].onChange = (value) => saveCurrentVersionSetting('memOptimize', value);
}

document.getElementById('vset-jvm-args')?.addEventListener('change', function() {
    saveCurrentVersionSetting('jvmArgs', this.value);
});

document.getElementById('vset-game-args')?.addEventListener('change', function() {
    saveCurrentVersionSetting('gameArgs', this.value);
});

async function loadInstalledModsForSettings() {
    if (!currentSettingsVersionId) return;
    const container = document.getElementById('modmgr-mod-list');
    if (container) {
        container.innerHTML = '<p class="empty-text" style="padding:30px 0;text-align:center;color:var(--text-muted)">加载中...</p>';
    }
    try {
        const mods = await API.getVersionMods(currentSettingsVersionId);
        _modMgrSettingsLoaded = true;
        renderModMgrList(mods || []);
    } catch (e) {
        console.error('[ModMgr] Load error:', e);
    }
}

function renderModMgrList(mods) {
    const container = document.getElementById('modmgr-mod-list');
    const countAll = document.getElementById('modmgr-count-all');
    const countUpdate = document.getElementById('modmgr-count-update');

    if (!container) return;

    if (!mods || mods.length === 0) {
        container.innerHTML = '<p class="empty-text" style="padding:30px 0;text-align:center;color:var(--text-muted)">暂无已安装的模组</p>';
        if (countAll) countAll.textContent = '0';
        if (countUpdate) countUpdate.textContent = '0';
        return;
    }

    const BATCH_SIZE = 30;
    const total = mods.length;
    container.innerHTML = '';

    function renderBatch(start) {
        const fragment = document.createDocumentFragment();
        const end = Math.min(start + BATCH_SIZE, total);
        for (let i = start; i < end; i++) {
            const m = mods[i];
            const iconUrl = m.icon || '';
            const desc = (m.description || '').substring(0, 60);
            const verStr = m.version || '';
            const author = m.author || '';
            const projectId = m.projectId || m.slug || '';
            const isDisabled = m.disabled || false;
            const fileName = m.fileName || m.name || '';
            const toggleLabel = isDisabled ? '启用' : '禁用';
            const toggleClass = isDisabled ? 'btn-primary' : 'btn-secondary';
            const nameStyle = isDisabled ? 'opacity:0.5;text-decoration:line-through;' : '';
            const iconHtml = iconUrl
                ? `<div class="modmgr-icon"><img src="${iconUrl}" alt="" loading="lazy" onerror="this.style.display='none';this.parentElement.classList.add('modmgr-icon--fallback')"></div>`
                : '<div class="modmgr-icon modmgr-icon--fallback"></div>';
            const wrapper = document.createElement('div');
            wrapper.className = `modmgr-item${isDisabled ? ' mod-disabled' : ''}`;
            wrapper.dataset.name = m.name || '';
            wrapper.dataset.desc = desc;
            wrapper.innerHTML = `${iconHtml}
            <div class="modmgr-info">
                <div class="modmgr-name" style="${nameStyle}">${escapeHtml(formatModNameWithChinese(m.slug || m.id || m.fileName, m.name))}${isDisabled ? ' (已禁用)' : ''}</div>
                <div class="modmgr-meta">${author ? escapeHtml(author) : ''}${verStr ? ' | ' + escapeHtml(verStr) : ''}</div>
                <div class="modmgr-desc">${escapeHtml(desc)}</div>
            </div>
            <div class="modmgr-actions-row">
                <button class="btn ${toggleClass} btn-sm" onclick="event.stopPropagation();toggleModInManager('${escapeOnclick(fileName)}',${!isDisabled})">${toggleLabel}</button>
                ${projectId ? `<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();previewMod('${escapeOnclick(projectId)}')">预览</button>` : ''}
                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();removeModFromManager('${escapeOnclick(fileName)}')">移除</button>
            </div>`;
            fragment.appendChild(wrapper);
        }
        container.appendChild(fragment);
        if (end < total) {
            requestAnimationFrame(() => renderBatch(end));
        }
    }

    renderBatch(0);
    if (countAll) countAll.textContent = mods.length;
    if (countUpdate) countUpdate.textContent = '0';
}

function previewMod(projectId) {
    if (!projectId) return;
    openModDetail(projectId, 'modrinth');
}

function filterInstalledMods() {
    const keyword = (document.getElementById('modmgr-search')?.value || '').toLowerCase();
    document.querySelectorAll('.modmgr-item').forEach(item => {
        const name = (item.dataset.name || '').toLowerCase();
        const desc = (item.dataset.desc || '').toLowerCase();
        item.style.display = (name.includes(keyword) || desc.includes(keyword)) ? 'flex' : 'none';
    });
}

function filterModMgrTab(filter) {
    document.querySelectorAll('.modmgr-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.modmgr-tab[data-filter="${filter}"]`)?.classList.add('active');
}

function selectAllMods() {
    showToast('已选择所有模组', 'info');
}

function installModFromFile() {
    showToast('请选择要安装的 Mod 文件（.jar）', 'info');
    API.selectModFile().then(result => {
        if (result && result.filePath) {
            installModByFile(result.filePath);
        }
    });
}

function installModByFile(filePath) {
    if (!currentSettingsVersionId) {
        showToast('请先选择一个版本', 'error');
        return;
    }
    API.installModFromFile(currentSettingsVersionId, filePath).then(r => {
        if (r.success) {
            showToast('Mod 安装成功', 'success');
            loadInstalledModsForSettings();
        } else {
            showToast(r.error || '安装失败', 'error');
        }
    }).catch(e => showToast('安装失败: ' + e.message, 'error'));
}

function openBrowseMods() {
    _modDownloadVersionId = '';
    navigateToPage('mods');
}

function goDownloadMods() {
    if (!currentSettingsVersionId) {
        _modDownloadVersionId = '';
        navigateToPage('mods');
        return;
    }
    _modDownloadVersionId = currentSettingsVersionId;
    
    const versionInfo = installedVersions.find(v => v.id === currentSettingsVersionId);
    
    let gameVersion = '';
    if (versionInfo && versionInfo.baseVersion) {
        gameVersion = versionInfo.baseVersion;
    } else if (versionInfo && versionInfo.inheritsFrom) {
        gameVersion = versionInfo.inheritsFrom;
    } else {
        gameVersion = currentSettingsVersionId.split('-')[0];
    }
    
    let loaderType = '';
    if (versionInfo) {
        if (versionInfo.isFabric) loaderType = 'fabric';
        else if (versionInfo.isForge) loaderType = 'forge';
        else if (versionInfo.isNeoForge) loaderType = 'neoforge';
    }
    
    console.log('[goDownloadMods] versionId:', currentSettingsVersionId, 'gameVersion:', gameVersion, 'loaderType:', loaderType);
    
    navigateToPage('mods');
    
    setTimeout(() => {
        if (gameVersion && customSelectInstances['mod-filter-version']) {
            customSelectInstances['mod-filter-version'].setValue(gameVersion);
        }
        
        if (loaderType && customSelectInstances['mod-filter-loader']) {
            customSelectInstances['mod-filter-loader'].setValue(loaderType);
        }
        
        modSearchOffset = 0;
        loadMods();
    }, 100);
}

function toggleModInManager(fileName, disable) {
    if (!currentSettingsVersionId) return;
    API.toggleMod(fileName, !disable, currentSettingsVersionId).then(r => {
        if (r.success) {
            showToast(disable ? '已禁用' : '已启用', 'success');
            loadInstalledModsForSettings();
        } else {
            showToast(r.error || '操作失败', 'error');
        }
    }).catch(e => showToast(e.message || '操作失败', 'error'));
}

async function removeModFromManager(fileName) {
    if (!currentSettingsVersionId) return;
    const confirmed = await showConfirmDialog('删除模组', `确定要删除 ${fileName} 吗？`, '删除', '取消');
    if (!confirmed) return;
    API.removeMod(currentSettingsVersionId, fileName).then(r => {
        if (r.success) {
            showToast('已删除', 'success');
            loadInstalledModsForSettings();
        } else {
            showToast(r.error || '删除失败', 'error');
        }
    });
}

function toggleExportTree(el) {
    el.classList.toggle('expanded');
}

async function loadExportTreeData() {
    if (!currentSettingsVersionId) return;

    try {
        const data = await API.getVersionExportInfo(currentSettingsVersionId);
        _exportTreeLoaded = true;

        if (data.gameDesc) {
            const el = document.getElementById('export-game-desc');
            if (el) el.textContent = data.gameDesc;
        }

        if (data.modCount !== undefined) {
            const el = document.getElementById('export-mod-count');
            if (el) el.textContent = `${data.modCount} 个`;
        }

        if (data.savesCount !== undefined) {
            const el = document.getElementById('export-saves-desc');
            if (el) el.textContent = `${data.savesCount} 个存档`;
        }

        const rpList = document.getElementById('export-rp-list');
        if (rpList && data.resourcePacks && data.resourcePacks.length > 0) {
            rpList.innerHTML = data.resourcePacks.map(rp =>
                `<div class="export-tree-item"><input type="checkbox" checked class="export-cb" data-key="rp_${escapeHtml(rp)}"><span class="export-label">${escapeHtml(rp)}</span></div>`
            ).join('');
        } else if (rpList) {
            rpList.innerHTML = '<div class="export-tree-item"><span class="export-label" style="color:var(--text-muted)">暂无资源包</span></div>';
        }

        const savesList = document.getElementById('export-saves-list');
        if (savesList && data.saves && data.saves.length > 0) {
            savesList.innerHTML = data.saves.slice(0, 10).map(s =>
                `<div class="export-tree-item"><input type="checkbox" checked class="export-cb" data-key="save_${escapeHtml(s)}"><span class="export-label">${escapeHtml(s)}</span></div>`
            ).join('') + (data.saves.length > 10 ? `<div class="export-tree-item"><span class="export-label" style="color:var(--text-muted)">... 还有 ${data.saves.length - 10} 个存档</span></div>` : '');
        } else if (savesList) {
            savesList.innerHTML = '<div class="export-tree-item"><span class="export-label" style="color:var(--text-muted)">暂无存档</span></div>';
        }
    } catch (e) {
        console.error('[Export] Load tree data error:', e);
    }
}

function startExport() {
    if (!currentSettingsVersionId) return;
    const name = document.getElementById('export-name')?.value || '';
    const version = document.getElementById('export-version')?.value || '1.0.0';
    const author = document.getElementById('export-author')?.value || '';
    const description = document.getElementById('export-description')?.value || '';

    if (!name.trim()) { showToast('请输入整合包名称', 'error'); return; }

    const selectedKeys = [];
    document.querySelectorAll('.export-cb:checked').forEach(cb => selectedKeys.push(cb.dataset.key));

    showToast('正在导出整合包...', 'info');
    API.exportModpack(currentSettingsVersionId, name, version, author, description, selectedKeys).then(r => {
        if (r.success) {
            showToast(`整合包已导出到 ${r.path}`, 'success');
        } else {
            showToast(r.error || '导出失败', 'error');
        }
    }).catch(e => showToast('导出失败: ' + (e.message || ''), 'error'));
}

// ─── 设置子菜单和功能函数 ──────────────────────────────────

function setupSettingsSubmenu() {
}

function switchPage(pageName) {
    const currentPage = document.querySelector('.page.active');
    const target = document.getElementById(`page-${pageName}`);
    if (!target || target === currentPage) return;

    if (currentPage && currentPage.id === 'page-accounts' && _currentDetailAccount) {
        showAccountList();
    }

    if (currentPage) {
        currentPage.style.animation = 'pageOut 0.18s var(--ease-out-expo) forwards';
        setTimeout(() => {
            currentPage.classList.remove('active');
            currentPage.style.animation = '';
            target.classList.add('active');
            target.style.animation = 'pageIn 0.35s var(--ease-out-expo) backwards';
        }, 160);
    } else {
        target.classList.add('active');
        target.style.animation = 'pageIn 0.35s var(--ease-out-expo) backwards';
    }

    previousPage = currentPage?.id?.replace('page-', '') || null;
}

// ─── 启动设置函数 ──────────────────────────────────────────

let systemMemoryInfo = null;

function toggleMemoryMode() {
    const mode = document.querySelector('input[name="globalMemoryMode"]:checked')?.value;
    const customSettings = document.getElementById('memory-custom-settings');
    const autoInfo = document.getElementById('memory-auto-info');
    if (customSettings) {
        customSettings.style.display = mode === 'custom' ? 'block' : 'none';
    }
    if (autoInfo) {
        autoInfo.style.display = mode === 'auto' ? 'block' : 'none';
    }
    updateMemoryDisplay();
}

function updateMemoryDisplay() {
    const slider = document.getElementById('memory-slider');
    const display = document.getElementById('memory-value-display');
    const fill = document.getElementById('memory-slider-fill');
    const usedMarker = document.getElementById('memory-used-marker');
    const usedLabel = document.getElementById('memory-used-label');
    if (slider && display) {
        const mb = parseInt(slider.value, 10);
        const gb = (mb / 1024).toFixed(1);
        display.textContent = mb >= 1024 ? `${mb} MB (${gb} GB)` : `${mb} MB`;
        if (fill) {
            const max = parseInt(slider.max, 10) || 16384;
            const min = parseInt(slider.min, 10) || 0;
            const pct = Math.max(0, Math.min(100, ((mb - min) / (max - min)) * 100));
            fill.style.width = pct + '%';
        }
        if (usedMarker && usedLabel && systemMemoryInfo) {
            const usedMB = systemMemoryInfo.usedMB;
            const min = parseInt(slider.min, 10) || 0;
            const max = parseInt(slider.max, 10) || systemMemoryInfo.totalMB;
            const usedPct = Math.max(0, Math.min(100, ((usedMB - min) / (max - min)) * 100));
            usedMarker.style.left = usedPct + '%';
            usedLabel.style.left = usedPct + '%';
            usedMarker.style.display = 'block';
            usedLabel.style.display = 'block';
            usedLabel.textContent = `已用 ${(usedMB / 1024).toFixed(1)} GB`;
        }
    }
    updateAllocatedMemoryDisplay();
}

function updateAllocatedMemoryDisplay() {
    const mode = document.querySelector('input[name="globalMemoryMode"]:checked')?.value;
    const allocatedDisplay = document.getElementById('allocated-memory-display');
    const remainingDisplay = document.getElementById('remaining-memory-display');
    if (!systemMemoryInfo) return;
    let allocMB;
    if (mode === 'auto') {
        allocMB = systemMemoryInfo.autoMB;
    } else {
        const slider = document.getElementById('memory-slider');
        allocMB = slider ? parseInt(slider.value, 10) : systemMemoryInfo.autoMB;
    }
    const allocGB = (allocMB / 1024).toFixed(1);
    const remainMB = systemMemoryInfo.totalMB - allocMB;
    const remainGB = Math.max(0, remainMB / 1024).toFixed(1);
    if (allocatedDisplay) allocatedDisplay.textContent = `${allocGB} GB`;
    if (remainingDisplay) remainingDisplay.textContent = `${remainGB} GB`;
}

async function updateSystemMemoryInfo() {
    try {
        const data = await API.getSystemMemory();
        systemMemoryInfo = data;
        const totalDisplay = document.getElementById('sys-total-memory');
        const usedDisplay = document.getElementById('sys-used-memory');
        const freeDisplay = document.getElementById('sys-free-memory');
        const memBar = document.getElementById('sys-memory-bar');
        const autoValue = document.getElementById('memory-auto-value');
        const sliderMax = document.getElementById('memory-slider-max');
        const slider = document.getElementById('memory-slider');
        if (totalDisplay) totalDisplay.textContent = `${data.totalGB} GB`;
        if (usedDisplay) usedDisplay.textContent = `${data.usedGB} GB`;
        if (freeDisplay) freeDisplay.textContent = `${data.freeGB} GB`;
        if (memBar) {
            const usedPct = Math.min(100, Math.round((data.usedMB / data.totalMB) * 100));
            memBar.style.width = `${usedPct}%`;
            if (usedPct > 80) memBar.style.background = '#ff4d4d';
            else if (usedPct > 60) memBar.style.background = '#ff9800';
            else memBar.style.background = 'var(--accent)';
        }
        if (autoValue) autoValue.textContent = `${data.autoGB} GB`;
        if (slider) {
            slider.max = data.totalMB;
            if (parseInt(slider.value, 10) > data.totalMB) {
                slider.value = data.autoMB;
            }
        }
        if (sliderMax) sliderMax.textContent = `${data.totalMB} MB`;
        updateMemoryDisplay();
    } catch (e) {
        console.error('[Settings] Update memory info error:', e);
    }
}

function toggleAdvancedOptions() {
    const content = document.getElementById('advanced-options-content');
    const arrow = document.getElementById('advanced-options-arrow');
    if (content && arrow) {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0)';
    }
}

async function saveLaunchSettings() {
    let windowSize = document.getElementById('window-size')?.value || 'default';
    if (windowSize === 'default') {
        windowSize = '854x480';
    } else if (windowSize === 'custom') {
        const w = document.getElementById('custom-width')?.value;
        const h = document.getElementById('custom-height')?.value;
        if (w && h) {
            windowSize = `${w}x${h}`;
        } else {
            windowSize = '1920x1080';
        }
    }

    const settings = {
        versionIsolation: document.getElementById('launch-version-isolation')?.value,
        windowTitle: document.getElementById('launch-window-title')?.value,
        customInfo: document.getElementById('launch-custom-info')?.value,
        launcherVisibility: document.getElementById('launcher-visibility')?.value,
        processPriority: document.getElementById('process-priority')?.value,
        windowSize: windowSize,
        fullscreen: document.getElementById('launch-fullscreen')?.checked || false,
        gameJava: document.getElementById('game-java-select')?.value,
        memoryMode: document.querySelector('input[name="globalMemoryMode"]:checked')?.value,
        memoryValue: document.getElementById('memory-slider')?.value,
        jvmArgs: document.getElementById('jvm-args')?.value,
        gameArgs: document.getElementById('game-args')?.value,
        preLaunchCommand: document.getElementById('pre-launch-command')?.value,
        memoryManagement: document.getElementById('memory-management')?.value,
        disableJavaWrapper: document.getElementById('disable-java-wrapper')?.checked,
        disableLWJGLAgent: document.getElementById('disable-lwjgl-agent')?.checked,
        useHighPerformanceGPU: document.getElementById('use-high-performance-gpu')?.checked,
        performanceBoost: document.getElementById('performance-boost')?.checked,
        jvmPreheat: document.getElementById('jvm-preheat')?.checked,
        enableCds: document.getElementById('enable-cds')?.checked
    };

    try {
        await window.electronAPI.store.set('versepc_launch_settings', JSON.stringify(settings));
        showToast('启动设置已保存', 'success');
        
        // 应用窗口大小到启动器窗口
        applyLauncherWindowSize(windowSize);
    } catch (e) {
        showToast('保存失败: ' + e.message, 'error');
    }
}

function applyLauncherWindowSize(windowSize) {
    let width, height;
    
    if (windowSize === 'default') {
        // 默认值是 854x480
        width = 854;
        height = 480;
    } else if (windowSize === 'custom') {
        const w = document.getElementById('custom-width')?.value;
        const h = document.getElementById('custom-height')?.value;
        if (w && h) {
            width = parseInt(w);
            height = parseInt(h);
        }
    } else if (windowSize && windowSize.includes('x')) {
        const [w, h] = windowSize.split('x').map(Number);
        if (w && h) {
            width = w;
            height = h;
        }
    }
    
    if (width && height && window.electronAPI?.setLauncherSize) {
        window.electronAPI.setLauncherSize(width, height);
    }
}

async function browseDataDir() {
    try {
        const current = document.getElementById('setting-data-dir').value;
        const opts = { properties: ['openDirectory'] };
        if (current && current !== '加载中...') opts.defaultPath = current;
        const result = await window.electronAPI.showOpenDialog(opts);
        if (!result || !result.filePaths || result.filePaths.length === 0) return;
        const selectedPath = result.filePaths[0];
        const res = await fetch('/api/settings/data-dir', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataDir: selectedPath })
        });
        const data = await res.json();
        if (data.ok) {
            document.getElementById('setting-data-dir').value = selectedPath;
            if (data.message) {
                alert(data.message);
            }
        } else if (data.error) {
            alert('保存失败: ' + data.error);
        }
    } catch (e) {
        alert('保存失败: ' + e.message);
    }
}

async function resetDataDir() {
    try {
        const res = await fetch('/api/settings/data-dir', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reset: true })
        });
        const data = await res.json();
        if (data.ok) {
            document.getElementById('setting-data-dir').value = '';
            if (data.message) {
                alert(data.message);
            }
        }
    } catch (e) {
        alert('重置失败: ' + e.message);
    }
}

async function resetLaunchSettings() {
    const confirmed = await showConfirmDialog('重置设置', '确定要重置启动设置为默认值吗?', '重置', '取消');
    if (!confirmed) return;

    document.getElementById('launch-version-isolation').value = 'all';
    document.getElementById('launch-window-title').value = '';
    document.getElementById('launch-custom-info').value = 'VersePC';
    document.getElementById('launcher-visibility').value = 'keep';
    document.getElementById('process-priority').value = 'normal';
    document.getElementById('window-size').value = 'default';
    document.getElementById('launch-fullscreen').checked = false;
    document.getElementById('game-java-select').value = 'auto';
    document.querySelector('input[name="globalMemoryMode"][value="auto"]').checked = true;
    document.getElementById('memory-slider').value = 4096;
    document.getElementById('jvm-args').value = '';
    document.getElementById('game-args').value = '';
    document.getElementById('pre-launch-command').value = '';
    document.getElementById('memory-management').value = 'default';
    document.getElementById('disable-java-wrapper').checked = false;
    document.getElementById('disable-lwjgl-agent').checked = false;
    document.getElementById('use-high-performance-gpu').checked = true;
    document.getElementById('performance-boost').checked = true;
    document.getElementById('jvm-preheat').checked = false;
    document.getElementById('enable-cds').checked = true;

    toggleMemoryMode();
    updateMemoryDisplay();
    try { await API.saveSettings({ gameDir: '' }); } catch (e) {}
    showToast('启动设置已重置', 'success');
}

async function optimizeJvmArgs() {
    const versionId = launchVersionCustomSelect ? launchVersionCustomSelect.getValue() : '';
    if (!versionId) {
        showToast('请先选择一个游戏版本', 'error');
        return;
    }
    try {
        const result = await API.getOptimizedJvmArgs(versionId);
        if (result && result.args) {
            document.getElementById('jvm-args').value = result.args;
            showToast(`已优化 JVM 参数（分配 ${result.ramGB}GB 内存，检测到 ${result.modCount} 个模组）`, 'success');
        }
    } catch (e) {
        showToast('优化失败: ' + e.message, 'error');
    }
}

async function loadLaunchSettings() {
    try {
        const saved = await window.electronAPI.store.get('versepc_launch_settings');
        if (saved) {
            const settings = JSON.parse(saved);
            if (settings.versionIsolation) document.getElementById('launch-version-isolation').value = settings.versionIsolation;
            if (settings.windowTitle) document.getElementById('launch-window-title').value = settings.windowTitle;
            if (settings.customInfo) document.getElementById('launch-custom-info').value = settings.customInfo;
            if (settings.launcherVisibility) document.getElementById('launcher-visibility').value = settings.launcherVisibility;
            if (settings.processPriority) document.getElementById('process-priority').value = settings.processPriority;
            if (settings.windowSize) {
                const wsVal = settings.windowSize;
                const wsSelect = document.getElementById('window-size');
                const customDiv = document.getElementById('custom-window-size');
                
                if (/^\d+x\d+$/.test(wsVal)) {
                    const presetOptions = ['854x480','1280x720','1600x900','1920x1080','2560x1440','3840x2160'];
                    if (presetOptions.includes(wsVal)) {
                        if (wsSelect) wsSelect.value = wsVal;
                        if (customDiv) customDiv.style.display = 'none';
                    } else {
                        if (wsSelect) wsSelect.value = 'custom';
                        if (customDiv) customDiv.style.display = 'flex';
                        const [w, h] = wsVal.split('x');
                        const cw = document.getElementById('custom-width');
                        const ch = document.getElementById('custom-height');
                        if (cw) cw.value = w;
                        if (ch) ch.value = h;
                    }
                } else {
                    if (wsSelect) wsSelect.value = wsVal;
                    if (customDiv) customDiv.style.display = 'none';
                }
            }
            if (settings.fullscreen !== undefined) document.getElementById('launch-fullscreen').checked = !!settings.fullscreen;
            if (settings.gameJava) document.getElementById('game-java-select').value = settings.gameJava;
            if (settings.memoryMode) {
                document.querySelector(`input[name="globalMemoryMode"][value="${settings.memoryMode}"]`).checked = true;
                toggleMemoryMode();
            }
            if (settings.memoryValue) {
                document.getElementById('memory-slider').value = settings.memoryValue;
                updateMemoryDisplay();
            }
            if (settings.jvmArgs) document.getElementById('jvm-args').value = settings.jvmArgs;
            if (settings.gameArgs) document.getElementById('game-args').value = settings.gameArgs;
            if (settings.preLaunchCommand) document.getElementById('pre-launch-command').value = settings.preLaunchCommand;
            if (settings.memoryManagement) document.getElementById('memory-management').value = settings.memoryManagement;
            if (settings.disableJavaWrapper !== undefined) document.getElementById('disable-java-wrapper').checked = settings.disableJavaWrapper;
            if (settings.disableLWJGLAgent !== undefined) document.getElementById('disable-lwjgl-agent').checked = settings.disableLWJGLAgent;
            if (settings.useHighPerformanceGPU !== undefined) document.getElementById('use-high-performance-gpu').checked = settings.useHighPerformanceGPU;
            if (settings.performanceBoost !== undefined) document.getElementById('performance-boost').checked = settings.performanceBoost;
            if (settings.jvmPreheat !== undefined) document.getElementById('jvm-preheat').checked = settings.jvmPreheat;
            if (settings.enableCds !== undefined) document.getElementById('enable-cds').checked = settings.enableCds;
        }

        updateSystemMemoryInfo();
        checkCdsStatus();
        if (window._memMonitorTimer) clearInterval(window._memMonitorTimer);
        window._memMonitorTimer = setInterval(() => {
            const el = document.getElementById('sys-total-memory');
            if (el && el.offsetParent !== null) {
                updateSystemMemoryInfo();
            } else {
                clearInterval(window._memMonitorTimer);
                window._memMonitorTimer = null;
            }
        }, 2000);
    } catch (e) {
        console.error('[Settings] Load launch settings error:', e);
    }
}

// ─── 个性化设置函数 ──────────────────────────────────────

async function selectTheme(element) {
    document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('active'));
    element.classList.add('active');

    const theme = element.dataset.theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark-theme', theme === 'dark');
    document.documentElement.classList.toggle('light-theme', theme === 'light');

    const app = document.getElementById('app');
    if (app && theme === 'light') {
        app.classList.remove('wp-light', 'wp-dark');
    }

    document.documentElement.style.setProperty('--accent', theme === 'dark' ? '#ffffff' : '#1a1a1a');
    document.documentElement.style.setProperty('--accent-hover', theme === 'dark' ? '#d0d0d0' : '#333333');
    document.documentElement.style.setProperty('--accent-rgb', theme === 'dark' ? '255, 255, 255' : '26, 26, 26');

    if (typeof updateWallpaperTheme === 'function') {
        updateWallpaperTheme(theme === 'dark');
    }

    const editorIframe = document.getElementById('editor-iframe');
    if (editorIframe && editorIframe.contentWindow) {
        editorIframe.contentWindow.postMessage({ type: 'editor:set-theme', theme: theme }, '*');
    }

    try {
        await window.electronAPI.store.set('versepc_theme', theme);
    } catch (e) {
        console.error('[Settings] Save theme error:', e);
    }
}

async function selectWallpaper(element) {
    document.querySelectorAll('.wallpaper-option').forEach(opt => opt.classList.remove('active'));
    element.classList.add('active');

    const mode = element.dataset.wallpaper;

    if (typeof switchWallpaperMode === 'function') {
        switchWallpaperMode(mode);
    }

    const isCustom = mode === 'customImage' || mode === 'customVideo';
    const isPanorama = mode === 'panorama';
    document.getElementById('custom-wallpaper-file-group').style.display = isCustom ? '' : 'none';
    document.getElementById('wallpaper-fit-group').style.display = isCustom ? '' : 'none';
    document.getElementById('wallpaper-opacity-group').style.display = isCustom ? '' : 'none';
    document.getElementById('wallpaper-blur-group').style.display = isCustom ? '' : 'none';
    document.getElementById('panorama-theme-group').style.display = isPanorama ? '' : 'none';
    const speedRow = document.getElementById('panoramaSpeedRow');
    if (speedRow) speedRow.style.display = isPanorama ? '' : 'none';
    const mouseFollowRow = document.getElementById('panoramaMouseFollowRow');
    if (mouseFollowRow) mouseFollowRow.style.display = isPanorama ? '' : 'none';

    if (isPanorama) {
        try {
            const [savedTheme, savedSpeed, savedFollow] = await Promise.all([
                window.electronAPI?.store?.get('versepc_panorama_theme'),
                window.electronAPI?.store?.get('versepc_panorama_speed'),
                window.electronAPI?.store?.get('versepc_panorama_mouse_follow'),
            ]);
            if (savedTheme) {
                const themeEl = document.querySelector(`.panorama-theme-option[data-theme="${savedTheme}"]`);
                if (themeEl) {
                    document.querySelectorAll('.panorama-theme-option').forEach(opt => opt.classList.remove('active'));
                    themeEl.classList.add('active');
                    if (typeof setPanoramaTheme === 'function') setPanoramaTheme(savedTheme);
                }
            }
            if (savedSpeed != null) {
                const slider = document.getElementById('panoramaSpeedSlider');
                if (slider) slider.value = savedSpeed;
                const label = document.getElementById('panoramaSpeedLabel');
                if (label) label.textContent = savedSpeed;
                if (typeof setPanoramaRotationSpeed === 'function') setPanoramaRotationSpeed(savedSpeed * 0.001);
            }
            if (savedFollow === true) {
                const toggle = document.getElementById('panoramaMouseFollowToggle');
                if (toggle) toggle.checked = true;
                if (typeof setPanoramaMouseFollow === 'function') setPanoramaMouseFollow(true);
            }
        } catch (e) {
            console.warn('[Settings] Failed to restore panorama settings:', e);
        }
    }

    if (isCustom) {
        const fileLabel = document.getElementById('custom-wallpaper-file-label');
        if (fileLabel) fileLabel.textContent = mode === 'customVideo' ? '选择视频文件' : '选择图片文件';
        const dropZone = document.getElementById('custom-wallpaper-drop-zone');
        if (dropZone) dropZone.textContent = mode === 'customVideo' ? '拖放视频到此处' : '拖放图片到此处';
    }

    try {
        await window.electronAPI.store.set('versepc_wallpaper', mode);
    } catch (e) {
        console.error('[Settings] Save wallpaper error:', e);
    }
}

async function pickCustomWallpaperFile() {
    const activeMode = document.querySelector('.wallpaper-option.active')?.dataset.wallpaper;
    const isVideo = activeMode === 'customVideo';

    const filters = isVideo
        ? [{ name: '视频文件', extensions: ['mp4', 'webm', 'mkv', 'avi'] }]
        : [{ name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }];

    try {
        const result = await window.electronAPI.selectFile({
            title: isVideo ? '选择视频壁纸' : '选择图片壁纸',
            filters
        });

        if (result.cancelled) return;

        const filePath = result.path;
        await _applyCustomWallpaperFile(filePath, isVideo);
    } catch (e) {
        console.error('[Wallpaper] Pick file error:', e);
    }
}

async function _applyCustomWallpaperFile(filePath, isVideo) {
    document.getElementById('custom-wallpaper-file-name').textContent = filePath.split(/[\\/]/).pop();

    if (isVideo) {
        if (typeof setCustomWallpaperVideo === 'function') {
            setCustomWallpaperVideo(filePath);
        }
        try { await window.electronAPI.store.set('versepc_custom_video', filePath); } catch (e) {}
    } else {
        if (typeof setCustomWallpaperImage === 'function') {
            setCustomWallpaperImage(filePath);
        }
        try { await window.electronAPI.store.set('versepc_custom_image', filePath); } catch (e) {}
        _updateCustomImagePreview(filePath);
    }
}

function _updateCustomImagePreview(filePath) {
    const preview = document.getElementById('wp-preview-custom-image');
    if (!preview) return;
    const icon = preview.querySelector('.wp-preview-icon');
    if (filePath) {
        if (icon) icon.style.display = 'none';
        let img = preview.querySelector('.wp-preview-thumb');
        if (!img) {
            img = document.createElement('img');
            img.className = 'wp-preview-thumb';
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;';
            preview.style.position = 'relative';
            preview.appendChild(img);
        }
        img.src = typeof wpfilePath === 'function' ? wpfilePath(filePath) : ('wpfile:///' + filePath.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/'));
    } else {
        if (icon) icon.style.display = '';
        const img = preview.querySelector('.wp-preview-thumb');
        if (img) img.remove();
    }
}

function initWallpaperDropZone() {
    const dropZone = document.getElementById('custom-wallpaper-drop-zone');
    if (!dropZone) return;

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');

        const activeMode = document.querySelector('.wallpaper-option.active')?.dataset.wallpaper;
        const isVideo = activeMode === 'customVideo';

        const file = e.dataTransfer.files[0];
        if (!file) return;

        const filePath = (window.electronAPI && window.electronAPI.getDroppedFilePath) ? window.electronAPI.getDroppedFilePath(file) : '';
        if (!filePath) return;

        const validImageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        const validVideoExts = ['.mp4', '.webm', '.mkv', '.avi'];
        const ext = '.' + file.name.split('.').pop().toLowerCase();

        if (isVideo && !validVideoExts.includes(ext)) {
            if (typeof showToast === 'function') showToast('请拖放视频文件', 'error');
            return;
        }
        if (!isVideo && !validImageExts.includes(ext)) {
            if (typeof showToast === 'function') showToast('请拖放图片文件', 'error');
            return;
        }

        await _applyCustomWallpaperFile(filePath, isVideo);
    });
}

function initWallpaperAutoAdapt() {
    if (typeof onWallpaperBrightnessChange !== 'function') return;

    onWallpaperBrightnessChange((brightness) => {
        const overlay = document.getElementById('wallpaper-overlay');
        if (!overlay) return;

        const app = document.getElementById('app');
        if (!app) return;

        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const isLight = brightness > 0.55;
        const isDark = brightness < 0.35;

        if (currentTheme === 'light') {
            app.classList.remove('wp-light', 'wp-dark');
            overlay.style.background = 'transparent';
        } else if (isLight) {
            overlay.style.background = 'rgba(0, 0, 0, 0.15)';
            app.classList.add('wp-light');
            app.classList.remove('wp-dark');
        } else if (isDark) {
            overlay.style.background = 'transparent';
            app.classList.add('wp-dark');
            app.classList.remove('wp-light');
        } else {
            const alpha = (0.55 - brightness) * 0.3;
            overlay.style.background = `rgba(0, 0, 0, ${Math.max(0, alpha)})`;
            app.classList.remove('wp-light', 'wp-dark');
        }

        document.documentElement.style.setProperty('--wp-brightness', brightness);
    });
}

function onWallpaperOpacityChange(value) {
    const opacity = value / 100;
    document.getElementById('wallpaper-opacity-value').textContent = value + '%';
    if (typeof setWallpaperOpacity === 'function') setWallpaperOpacity(opacity);
    window.electronAPI?.store?.set('versepc_wallpaper_opacity', value).catch(() => {});
}

function onWallpaperBlurChange(value) {
    document.getElementById('wallpaper-blur-value').textContent = value + 'px';
    if (typeof setWallpaperBlur === 'function') setWallpaperBlur(parseInt(value));
    window.electronAPI?.store?.set('versepc_wallpaper_blur', value).catch(() => {});
}

function onWallpaperFitChange(value) {
    if (typeof setWallpaperFitMode === 'function') setWallpaperFitMode(value);
    window.electronAPI?.store?.set('versepc_wallpaper_fit', value).catch(() => {});
}

function selectPanoramaTheme(element) {
    document.querySelectorAll('.panorama-theme-option').forEach(opt => opt.classList.remove('active'));
    element.classList.add('active');
    const theme = element.dataset.theme;
    if (typeof setPanoramaTheme === 'function') setPanoramaTheme(theme);
    window.electronAPI?.store?.set('versepc_panorama_theme', theme).catch(() => {});
}

function onPanoramaSpeedChange(value) {
    const speed = value * 0.001;
    if (typeof setPanoramaRotationSpeed === 'function') setPanoramaRotationSpeed(speed);
    window.electronAPI?.store?.set('versepc_panorama_speed', parseInt(value));
    const label = document.getElementById('panoramaSpeedLabel');
    if (label) label.textContent = value;
}

function onPanoramaMouseFollowChange(enabled) {
    if (typeof setPanoramaMouseFollow === 'function') setPanoramaMouseFollow(enabled);
    window.electronAPI?.store?.set('versepc_panorama_mouse_follow', enabled);
}

function aiToggleApiKeyVisibility() {
    const input = document.getElementById('ai-api-key-input');
    if (!input) return;
    const btn = input.parentElement.querySelector('button');
    if (input.type === 'password') {
        input.type = 'text';
        if (btn) btn.textContent = '隐藏';
    } else {
        input.type = 'password';
        if (btn) btn.textContent = '显示';
    }
}

function applyThemeColors(themeName) {
    if (themeName === 'dark') {
        document.documentElement.style.setProperty('--accent', '#ffffff');
        document.documentElement.style.setProperty('--accent-hover', '#d0d0d0');
    } else {
        document.documentElement.style.setProperty('--accent', '#1a1a1a');
        document.documentElement.style.setProperty('--accent-hover', '#333333');
    }
}

async function updateCustomAccentColor(color) {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    if (theme === 'dark') {
        document.documentElement.style.setProperty('--accent', '#ffffff');
        document.documentElement.style.setProperty('--accent-hover', '#d0d0d0');
        document.documentElement.style.setProperty('--accent-rgb', '255, 255, 255');
    } else {
        document.documentElement.style.setProperty('--accent', '#1a1a1a');
        document.documentElement.style.setProperty('--accent-hover', '#333333');
        document.documentElement.style.setProperty('--accent-rgb', '26, 26, 26');
    }
}

function toggleGlassEffect(enabled) {
    if (enabled) {
        document.documentElement.removeAttribute('data-no-glass');
    } else {
        document.documentElement.setAttribute('data-no-glass', '');
    }
    window.electronAPI.store.set('versepc_glass_effect', enabled ? '1' : '0').catch(() => {});
}

async function savePersonalizeSettings() {
    const settings = {
        theme: document.querySelector('.theme-option.active')?.dataset.theme || 'light',
        wallpaper: document.querySelector('.wallpaper-option.active')?.dataset.wallpaper || 'none',
        glassEffect: document.getElementById('setting-glass-effect')?.checked ?? true
    };

    try {
        await window.electronAPI.store.set('versepc_personalize_settings', JSON.stringify(settings));
        await window.electronAPI.store.set('versepc_wallpaper', settings.wallpaper);
        showToast('个性化设置已保存', 'success');
    } catch (e) {
        showToast('保存失败: ' + e.message, 'error');
    }
}

async function resetPersonalizeSettings() {
    const confirmed = await showConfirmDialog('重置设置', '确定要重置个性化设置为默认值吗?', '重置', '取消');
    if (!confirmed) return;

    document.querySelector('.theme-option[data-theme="light"]')?.click();

    document.querySelector('.wallpaper-option[data-wallpaper="none"]')?.click();

    const opacitySlider = document.getElementById('wallpaper-opacity-slider');
    if (opacitySlider) { opacitySlider.value = 100; onWallpaperOpacityChange(100); }
    const blurSlider = document.getElementById('wallpaper-blur-slider');
    if (blurSlider) { blurSlider.value = 0; onWallpaperBlurChange(0); }
    const fitSelect = document.getElementById('wallpaper-fit-select');
    if (fitSelect) { fitSelect.value = 'cover'; onWallpaperFitChange('cover'); }

    const glassCheckbox = document.getElementById('setting-glass-effect');
    if (glassCheckbox) { glassCheckbox.checked = true; toggleGlassEffect(true); }

    try {
        await window.electronAPI.store.set('versepc_personalize_settings', JSON.stringify({
            theme: 'light',
            wallpaper: 'none',
            glassEffect: true
        }));
        await window.electronAPI.store.set('versepc_wallpaper', 'none');
        await window.electronAPI.store.delete('versepc_solid_color');
        await window.electronAPI.store.set('versepc_wallpaper_opacity', 100);
        await window.electronAPI.store.set('versepc_wallpaper_blur', 0);
        await window.electronAPI.store.set('versepc_wallpaper_fit', 'cover');
        await window.electronAPI.store.delete('versepc_custom_image');
        await window.electronAPI.store.delete('versepc_custom_video');
        await window.electronAPI.store.set('versepc_panorama_theme', 'overworld');
        await window.electronAPI.store.set('versepc_glass_effect', '1');
        _updateCustomImagePreview(null);
        const nameEl = document.getElementById('custom-wallpaper-file-name');
        if (nameEl) nameEl.textContent = '未选择';
    } catch (e) {
        console.error('[Settings] Reset personalize settings save error:', e);
    }

    showToast('个性化设置已重置', 'success');
}

async function loadPersonalizeSettings() {
    try {
        const saved = await window.electronAPI.store.get('versepc_personalize_settings');
        if (saved) {
            const settings = JSON.parse(saved);
            if (settings.theme) {
                let themeName = settings.theme;
                const legacyThemes = ['blue', 'purple', 'green', 'orange', 'red', 'pink', 'teal', 'cyan', 'amber'];
                if (legacyThemes.includes(themeName)) themeName = 'light';
                const themeEl = document.querySelector(`.theme-option[data-theme="${themeName}"]`);
                if (themeEl) selectTheme(themeEl);
            }
            if (settings.wallpaper) {
                let wpName = settings.wallpaper;
                if (wpName === 'starry') wpName = 'panorama';
                const wpEl = document.querySelector(`.wallpaper-option[data-wallpaper="${wpName}"]`);
                if (wpEl) selectWallpaper(wpEl);
            }
            if (settings.glassEffect !== undefined) {
                const enabled = settings.glassEffect;
                const glassCheckbox = document.getElementById('setting-glass-effect');
                if (glassCheckbox) glassCheckbox.checked = enabled;
                toggleGlassEffect(enabled);
            }
        } else {
            const savedTheme = await window.electronAPI.store.get('versepc_theme');
            if (savedTheme) {
                let themeName = savedTheme;
                const legacyThemes = ['blue', 'purple', 'green', 'orange', 'red', 'pink', 'teal', 'cyan', 'amber'];
                if (legacyThemes.includes(themeName)) themeName = 'light';
                const themeEl = document.querySelector(`.theme-option[data-theme="${themeName}"]`);
                if (themeEl) selectTheme(themeEl);
            } else {
                const defaultThemeEl = document.querySelector('.theme-option[data-theme="light"]');
                if (defaultThemeEl) selectTheme(defaultThemeEl);
            }
            const defaultWpEl = document.querySelector('.wallpaper-option[data-wallpaper="none"]');
            if (defaultWpEl) selectWallpaper(defaultWpEl);
        }

        const glassSaved = await window.electronAPI.store.get('versepc_glass_effect');
        if (glassSaved !== null && glassSaved !== undefined) {
            const enabled = glassSaved === '1';
            const glassCheckbox = document.getElementById('setting-glass-effect');
            if (glassCheckbox) glassCheckbox.checked = enabled;
            toggleGlassEffect(enabled);
        }
    } catch (e) {
        console.error('[Settings] Load personalize settings error:', e);
    }
}

// ─── 其他设置函数 ──────────────────────────────────────────

async function copyFeedbackEmail(btn) {
    const email = 'doujie2978166201@163.com';
    try {
        if (window.electronAPI?.clipboard) {
            await window.electronAPI.clipboard.writeText(email);
        } else {
            await navigator.clipboard.writeText(email);
        }
        btn.textContent = '已复制';
        setTimeout(() => { btn.textContent = '复制'; }, 2000);
        showToast('邮箱已复制到剪贴板', 'success');
    } catch (e) {
        showToast('复制失败，请手动复制', 'error');
    }
}

function toggleDebugOptions() {
    const content = document.getElementById('debug-options-content');
    const arrow = document.getElementById('debug-options-arrow');
    if (content && arrow) {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0)';
    }
}

async function saveOtherSettings() {
    const settings = {
        downloadSource: document.getElementById('setting-download-source')?.value,
        versionSource: document.getElementById('setting-version-source')?.value,
        maxThreads: document.getElementById('setting-max-threads')?.value,
        speedLimit: document.getElementById('setting-speed-limit')?.value,
        targetDir: document.getElementById('setting-target-dir')?.value,
        sslVerify: document.getElementById('setting-ssl-verify')?.checked,
        modSource: document.getElementById('setting-mod-source')?.value,
        filenameFormat: document.getElementById('setting-filename-format')?.value,
        modStyle: document.getElementById('setting-mod-style')?.value,
        ignoreQuilt: document.getElementById('setting-ignore-quilt')?.checked,
        notifyReleaseUpdates: document.getElementById('notify-release-updates')?.checked,
        notifySnapshotUpdates: document.getElementById('notify-snapshot-updates')?.checked,
        autoSetChinese: document.getElementById('auto-set-chinese')?.checked,
        launcherUpdateMode: document.getElementById('launcher-update-mode')?.value,
        launcherNoticeMode: document.getElementById('launcher-notice-mode')?.value,
        anonymousDataCollection: document.getElementById('anonymous-data-collection')?.checked,
        debugMode: document.getElementById('debug-mode')?.checked,
        verboseLogging: document.getElementById('verbose-logging')?.checked,
        consoleDebug: document.getElementById('enable-console-debug')?.checked,
        autoMemoryOptimize: document.getElementById('auto-memory-optimize')?.checked
    };

    try {
        await window.electronAPI.store.set('versepc_other_settings', JSON.stringify(settings));
        showToast('其他设置已保存', 'success');
    } catch (e) {
        showToast('保存失败: ' + e.message, 'error');
    }
}

async function resetOtherSettings() {
    const confirmed = await showConfirmDialog('重置设置', '确定要重置其他设置为默认值吗?', '重置', '取消');
    if (!confirmed) return;

    document.getElementById('setting-download-source').value = 'auto';
    document.getElementById('setting-version-source').value = 'auto';
    document.getElementById('setting-max-threads').value = 32;
    document.getElementById('thread-count-value').textContent = '32';
    document.getElementById('setting-speed-limit').value = 0;
    document.getElementById('speed-limit-value').textContent = '无限制';
    document.getElementById('setting-target-dir').value = '';
    document.getElementById('setting-ssl-verify').checked = false;
    document.getElementById('setting-mod-source').value = 'modrinth';
    document.getElementById('setting-filename-format').value = 'default';
    document.getElementById('setting-mod-style').value = 'title';
    document.getElementById('setting-ignore-quilt').checked = false;
    document.getElementById('notify-release-updates').checked = false;
    document.getElementById('notify-snapshot-updates').checked = false;
    document.getElementById('auto-set-chinese').checked = true;
    document.getElementById('launcher-update-mode').value = 'auto';
    document.getElementById('launcher-notice-mode').value = 'show-all';
    document.getElementById('anonymous-data-collection').checked = false;
    document.getElementById('debug-mode').checked = false;
    document.getElementById('verbose-logging').checked = false;
    document.getElementById('enable-console-debug').checked = false;
    document.getElementById('auto-memory-optimize').checked = true;

    API.saveSetting('autoSetChinese', true).catch(() => {});
    showToast('其他设置已重置', 'success');
}

async function loadOtherSettings() {
    try {
        const saved = await window.electronAPI.store.get('versepc_other_settings');
        if (saved) {
            const settings = JSON.parse(saved);
            if (settings.downloadSource) document.getElementById('setting-download-source').value = settings.downloadSource;
            if (settings.versionSource) document.getElementById('setting-version-source').value = settings.versionSource;
            if (settings.maxThreads) {
                document.getElementById('setting-max-threads').value = settings.maxThreads;
                document.getElementById('thread-count-value').textContent = settings.maxThreads;
            }
            if (settings.speedLimit !== undefined) {
                document.getElementById('setting-speed-limit').value = settings.speedLimit;
                updateSpeedLimitLabel(settings.speedLimit);
            }
            if (settings.targetDir) document.getElementById('setting-target-dir').value = settings.targetDir;
            if (settings.sslVerify !== undefined) document.getElementById('setting-ssl-verify').checked = settings.sslVerify;
            if (settings.modSource) document.getElementById('setting-mod-source').value = settings.modSource;
            if (settings.filenameFormat) document.getElementById('setting-filename-format').value = settings.filenameFormat;
            if (settings.modStyle) document.getElementById('setting-mod-style').value = settings.modStyle;
            if (settings.ignoreQuilt !== undefined) document.getElementById('setting-ignore-quilt').checked = settings.ignoreQuilt;
            if (settings.notifyReleaseUpdates !== undefined) document.getElementById('notify-release-updates').checked = settings.notifyReleaseUpdates;
            if (settings.notifySnapshotUpdates !== undefined) document.getElementById('notify-snapshot-updates').checked = settings.notifySnapshotUpdates;
            if (settings.autoSetChinese !== undefined) document.getElementById('auto-set-chinese').checked = settings.autoSetChinese;
            if (settings.debugMode !== undefined) document.getElementById('debug-mode').checked = settings.debugMode;
            if (settings.verboseLogging !== undefined) document.getElementById('verbose-logging').checked = settings.verboseLogging;
            if (settings.consoleDebug !== undefined) document.getElementById('enable-console-debug').checked = settings.consoleDebug;
            if (settings.autoMemoryOptimize !== undefined) document.getElementById('auto-memory-optimize').checked = settings.autoMemoryOptimize;
        }
    } catch (e) {
        console.error('[Settings] Load other settings error:', e);
    }
}

function updateSpeedLimitLabel(value) {
    const label = document.getElementById('speed-limit-value');
    if (label) {
        label.textContent = value == 0 ? '无限制' : `${value} MB/s`;
    }
}

function checkForUpdates() {
    showToast('正在检查更新...', 'info');
    handleCheckUpdate();
}

let _memoryOptimizing = false;


async function refreshMemoryInfo() {
    try {
        const info = await API.getMemoryInfo();
        if (!info || info.error) return;
        const bar = document.getElementById('memory-usage-bar');
        const text = document.getElementById('memory-usage-text');
        const detail = document.getElementById('memory-detail-text');
        if (bar) bar.style.width = info.loadPercent + '%';
        if (text) text.textContent = info.loadPercent + '%';
        if (detail) detail.textContent = `${formatBytes(info.used)} / ${formatBytes(info.total)}`;
        if (bar) {
            if (info.loadPercent > 85) bar.style.background = '#ef4444';
            else if (info.loadPercent > 70) bar.style.background = '#f59e0b';
            else bar.style.background = 'var(--accent)';
        }
    } catch (e) {}
}

async function doMemoryOptimize() {
    if (_memoryOptimizing) {
        showToast('内存优化正在进行中，请稍候', 'info');
        return;
    }
    _memoryOptimizing = true;
    const btn = document.getElementById('memory-optimize-btn');
    if (btn) { btn.disabled = true; btn.textContent = '优化中...'; }
    showToast('正在执行内存优化...', 'info');
    try {
        const result = await API.memoryOptimize();
        if (result.success) {
            const freedStr = result.freedMB > 0 ? `释放了 ${result.freedMB} MB` : '内存已优化';
            showToast(`内存优化完成，${freedStr}，当前可用 ${result.afterMB} MB`, 'success');
        } else {
            showToast('内存优化失败: ' + (result.error || '未知错误'), 'error');
        }
    } catch (e) {
        showToast('内存优化失败: ' + e.message, 'error');
    } finally {
        _memoryOptimizing = false;
        if (btn) { btn.disabled = false; btn.textContent = '内存优化'; }
        refreshMemoryInfo();
    }
}

async function exportSettings() {
    try {
        const allSettings = {
            launch: await window.electronAPI.store.get('versepc_launch_settings'),
            personalize: await window.electronAPI.store.get('versepc_personalize_settings'),
            other: await window.electronAPI.store.get('versepc_other_settings'),
            exportTime: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(allSettings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `versepc-settings-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);

        showToast('设置已导出', 'success');
    } catch (e) {
        showToast('导出失败: ' + e.message, 'error');
    }
}

function importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const settings = JSON.parse(text);

            if (settings.launch) {
                await window.electronAPI.store.set('versepc_launch_settings', settings.launch);
                loadLaunchSettings();
            }
            if (settings.personalize) {
                await window.electronAPI.store.set('versepc_personalize_settings', settings.personalize);
                loadPersonalizeSettings();
            }
            if (settings.other) {
                await window.electronAPI.store.set('versepc_other_settings', settings.other);
                loadOtherSettings();
            }

            showToast('设置已导入，请刷新页面查看效果', 'success');
        } catch (err) {
            showToast('导入失败: 无效的设置文件', 'error');
        }
    };

    input.click();
}

async function createDesktopShortcut() {
    try {
        const result = await API.createShortcut('desktop');
        if (result.success) showToast('桌面快捷方式已创建', 'success');
        else showToast('创建失败', 'error');
    } catch (e) {
        showToast('创建失败: ' + e.message, 'error');
    }
}

async function openScreenshots(versionId) {
    const modal = document.getElementById('screenshot-modal');
    const grid = document.getElementById('screenshot-grid');
    grid.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:20px;">加载中...</div>';
    modal.style.display = 'flex';
    modal.classList.add('modal-visible');

    try {
        const result = await API.getScreenshots(versionId);
        if (result.screenshots && result.screenshots.length > 0) {
            grid.innerHTML = result.screenshots.map(ss => `
                <div style="position:relative;border-radius:6px;overflow:hidden;cursor:pointer;background:var(--bg-active);" onclick="window.open('${ss.url}','_blank')">
                    <img src="${ss.url}" style="width:100%;height:120px;object-fit:cover;display:block;">
                    <div style="padding:4px 6px;font-size:11px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ss.name}</div>
                </div>
            `).join('');
        } else {
            grid.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:20px;">暂无截图</div>';
        }
    } catch (e) {
        grid.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:20px;">加载失败</div>';
    }
}

function closeScreenshotModal() {
    const modal = document.getElementById('screenshot-modal');
    if (modal) {
        modal.classList.remove('modal-visible');
        modal.style.display = 'none';
    }
}

// ─── 初始化设置页面 ──────────────────────────────────────

async function initSettingsPages() {
    setupSettingsSubmenu();
    loadLaunchSettings();
    await loadPersonalizeSettings();
    loadOtherSettings();
    fetch('/api/settings/data-dir').then(r => r.json()).then(d => {
        const el = document.getElementById('setting-data-dir');
        if (el && d.dataDir) {
            el.value = d.dataDir;
            el.title = d.dataDir;
        }
    }).catch(() => {});
}

function uploadImage(type) {
    const inputId = type === 'background' ? 'bg-image-input' : 'avatar-input';
    const input = document.getElementById(inputId);
    if (input) {
        input.click();
    }
}

function handleImageUpload(input, type) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const dataUrl = e.target.result;
        try {
            if (type === 'background') {
                await API.saveBackgroundImage(dataUrl);
                const preview = document.getElementById('bg-image-preview');
                const placeholder = document.getElementById('bg-image-placeholder');
                if (preview) {
                    preview.style.backgroundImage = `url(${dataUrl})`;
                    preview.style.display = 'block';
                }
                if (placeholder) placeholder.style.display = 'none';
                document.body.style.setProperty('--bg-image', `url(${dataUrl})`);
                showToast('背景图片已更新', 'success');
            } else if (type === 'avatar') {
                await API.saveAvatarImage(dataUrl);
                const preview = document.getElementById('avatar-preview');
                const placeholder = document.getElementById('avatar-placeholder');
                if (preview) {
                    preview.style.backgroundImage = `url(${dataUrl})`;
                    preview.style.display = 'block';
                }
                if (placeholder) placeholder.style.display = 'none';
                const homeAvatar = document.getElementById('home-avatar');
                const launchAvatar = document.getElementById('launch-avatar');
                if (homeAvatar) homeAvatar.style.backgroundImage = `url(${dataUrl})`;
                if (launchAvatar) launchAvatar.style.backgroundImage = `url(${dataUrl})`;
                showToast('头像已更新', 'success');
            }
        } catch (err) {
            showToast('图片保存失败: ' + (err.message || ''), 'error');
        }
    };
    reader.readAsDataURL(file);
}

function clearImage(type) {
    if (type === 'background') {
        API.clearBackgroundImage().then(() => {
            const preview = document.getElementById('bg-image-preview');
            const placeholder = document.getElementById('bg-image-placeholder');
            if (preview) { preview.style.backgroundImage = ''; preview.style.display = 'none'; }
            if (placeholder) placeholder.style.display = 'flex';
            document.body.style.removeProperty('--bg-image');
            showToast('背景图片已清除', 'success');
        }).catch(e => showToast('清除失败', 'error'));
    } else if (type === 'avatar') {
        API.clearAvatarImage().then(() => {
            const preview = document.getElementById('avatar-preview');
            const placeholder = document.getElementById('avatar-placeholder');
            if (preview) { preview.style.backgroundImage = ''; preview.style.display = 'none'; }
            if (placeholder) placeholder.style.display = 'flex';
            const homeAvatar = document.getElementById('home-avatar');
            const launchAvatar = document.getElementById('launch-avatar');
            if (homeAvatar) homeAvatar.style.backgroundImage = '';
            if (launchAvatar) launchAvatar.style.backgroundImage = '';
            showToast('头像已清除', 'success');
        }).catch(e => showToast('清除失败', 'error'));
    }
}

function useDefaultImage(type) {
    if (type === 'background') {
        API.clearBackgroundImage().then(() => {
            const preview = document.getElementById('bg-image-preview');
            const placeholder = document.getElementById('bg-image-placeholder');
            if (preview) { preview.style.backgroundImage = ''; preview.style.display = 'none'; }
            if (placeholder) placeholder.style.display = 'flex';
            document.body.style.removeProperty('--bg-image');
            showToast('已恢复默认背景', 'success');
        }).catch(e => showToast('恢复失败', 'error'));
    }
}

function browseJavaPath() {
    if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Java 可执行文件', extensions: ['exe', ''] }]
        }).then(result => {
            if (!result.canceled && result.filePaths.length > 0) {
                const path = result.filePaths[0];
                const input = document.getElementById('setting-java-path');
                if (input) input.value = path;
            }
        }).catch(() => {});
    } else {
        showToast('请手动输入 Java 路径', 'info');
    }
}



const SPONSORS = [
    '爱发电用户_f6954', '我不会起名', 'xyh', '硕硕小主', 'ZJ_Rider 肆年',
    'MC_不会玩的梓茗同学', 'ffhcv', '爱发电用户_364y', '爱发电用户_Kfq6',
    '爱发电用户_VUch', '峰~', '京墨', '鲨掉', '爱发电用户_ef5f5',
    '爱发电用户_3e0c7', '张琳轩', 'JasonDeng', '熙城种', '妺妤', 'Shanre',
    '爱发电用户_bb606', 'penguinfly_java', '爱发电用户_xKT7', '梦七年', '池鱼',
    'LaiChai', '现金小姐姐', '呼噜', 'nojang_JY', 'ADF白布', 'ffg',
    'sheng_1062', '爱发电用户_f00d6', '爱发电用户_83d3b', '哈喽芋泥', '樻',
    '爱发电用户_xtWd', 'kiroli', '爱发电用户_19443', 'ZYL', '爱发电用户_be45c',
    '爱发电用户_2166c', 'MaoJunyu2012', '纯〇科技', '爱发电用户_39960', '寻自游',
    'skin_c', '竹雾', '爱发电用户_979a9',
    '爱发电用户_7BtT', 'zH', '快夏波', 'lixinmiao', '?', '爱发电用户_5711a',
    '爱发电用户_3e7d0', 'lost', '霖', '爱发电用户_t6hb', '??', '界鱼',
    '爱发电用户_b5d63', '恋爱原计划', 'LADFS', '臻臻公主', '爱发电用户_7CN6',
    '爱发电用户_f15f5', 'Agoin_Y', 'yeccsh', 'k', 'BYX', 'Flugel',
    '爱发电用户_ff69f', '信好有你', '机械小白', '简', '宇宙', '爱发电用户_5ec06',
    '仁', '我嘞个豆', '爱发电用户_wDHc', '与秋赴约', '爱发电用户_rNnt', '雾浔.er',
    '爱发电用户_b0d51', '爱发电用户_afc17', '爱发电用户_e3bc6', '爱发电用户_aa5a6',
    'learen', '爱发电用户_AsWk', 'Fanzezheng', '爱发电用户_d055f', '懿屿',
    '爱发电用户_64272', '爱发电用户_e3b52', '爱发电用户_0fe8d', '爱发电用户_eedfd',
    '爱发电用户_uDkT', '爱发电用户_3c03e', '烬海', 'barnett', '韶末',
    '爱发电用户_TJ3b', '零', '爱发电用户_ab90e', '爱发电用户_a5a98', 'Fish_gods'
];

function renderSponsors(filter) {
    const container = document.getElementById('sponsor-list');
    if (!container) return;

    const keyword = (filter || '').toLowerCase().trim();
    const filtered = keyword
        ? SPONSORS.filter(name => name.toLowerCase().includes(keyword))
        : SPONSORS;

    const countEl = document.getElementById('sponsor-count');
    if (countEl) countEl.textContent = SPONSORS.length + ' 人';

    const moreBtn = document.getElementById('sponsor-more-btn');
    if (moreBtn && !keyword) {
        moreBtn.style.display = SPONSORS.length > 10 ? '' : 'none';
    }

    if (filtered.length === 0) {
        container.innerHTML = '<span class="sponsor-empty">' + (keyword ? '未找到匹配的赞助者' : '暂无赞助者') + '</span>';
        return;
    }

    container.innerHTML = filtered.map(name => {
        return `<div class="sponsor-tag">
            <span class="sponsor-tag-name">${escapeHtml(name)}</span>
        </div>`;
    }).join('');
}

let sponsorExpanded = false;

function toggleShowMoreSponsors() {
    sponsorExpanded = !sponsorExpanded;
    const grid = document.getElementById('sponsor-list');
    const btn = document.getElementById('sponsor-more-btn');
    if (grid) grid.classList.toggle('expanded', sponsorExpanded);
    if (btn) {
        btn.classList.toggle('expanded', sponsorExpanded);
        btn.childNodes[0].textContent = sponsorExpanded ? '收起 ' : '展开更多 ';
    }
}

function filterSponsors(keyword) {
    const grid = document.getElementById('sponsor-list');
    const btn = document.getElementById('sponsor-more-btn');
    if (keyword && keyword.trim()) {
        if (grid) grid.classList.add('expanded');
        if (btn) btn.style.display = 'none';
    } else {
        if (grid) grid.classList.toggle('expanded', sponsorExpanded);
        if (btn) btn.style.display = '';
    }
    renderSponsors(keyword);
}

async function copyMachineId(btn) {
    try {
        const el = document.getElementById('machine-id-display');
        if (!el || !el.value || el.value === '正在获取...') {
            showToast('识别码获取中，请稍候', 'info');
            return;
        }
        if (window.electronAPI && window.electronAPI.clipboard) {
            await window.electronAPI.clipboard.writeText(el.value);
        } else {
            await navigator.clipboard.writeText(el.value);
        }
        const original = btn.textContent;
        btn.textContent = '已复制';
        btn.classList.add('btn-success');
        setTimeout(() => { btn.textContent = original; btn.classList.remove('btn-success'); }, 1500);
        showToast('识别码已复制到剪贴板', 'success');
    } catch (e) {
        showToast('复制失败', 'error');
    }
}

async function loadMachineId() {
    try {
        if (window.electronAPI && window.electronAPI.getMachineId) {
            const id = await window.electronAPI.getMachineId();
            const el = document.getElementById('machine-id-display');
            if (el && id) el.value = id;
        }
    } catch (e) {
        console.error('[MachineId] Failed:', e.message);
    }
}

async function submitActivationCode(btn) {
    const input = document.getElementById('activation-code-input');
    const statusEl = document.getElementById('activation-status');
    if (!input || !statusEl) return;
    const code = input.value.trim();
    if (!code) {
        statusEl.className = 'activation-status failed';
        statusEl.textContent = '请输入激活码';
        return;
    }
    btn.disabled = true;
    btn.textContent = '验证中...';
    statusEl.className = 'activation-status info';
    statusEl.textContent = '正在验证...';
    try {
        const result = await window.electronAPI.activateVerify(code);
        if (result.success) {
            statusEl.className = 'activation-status activated';
            statusEl.textContent = '✓ ' + result.message;
            input.value = '';
            updateActivationStatus();
        } else {
            statusEl.className = 'activation-status failed';
            statusEl.textContent = '✗ ' + result.message;
        }
    } catch (e) {
        statusEl.className = 'activation-status failed';
        statusEl.textContent = '✗ 验证失败';
    }
    btn.disabled = false;
    btn.textContent = '激活';
}

async function updateActivationStatus() {
    try {
        const status = await window.electronAPI.activateStatus();
        const statusEl = document.getElementById('activation-status');
        if (!statusEl) return;
        if (status.activated) {
            statusEl.className = 'activation-status activated';
            const typeLabel = status.type === 'permanent' ? '永久授权' : '单次授权';
            statusEl.textContent = '✓ 已激活 (' + typeLabel + ')';
            const input = document.getElementById('activation-code-input');
            const btn = document.getElementById('activate-btn');
            if (input) input.style.display = 'none';
            if (btn) btn.style.display = 'none';
        }
    } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
    init();
    setTimeout(initSettingsPages, 500);
    renderSponsors();
    loadMachineId();
    updateActivationStatus();
    setTimeout(checkAnnouncementPopup, 2000);

    if (window.electronAPI?.platform && window.electronAPI.platform !== 'win32') {
        document.querySelectorAll('.win-only').forEach(el => el.style.display = 'none');
    }

    if (window.electronAPI?.isAIEnabled && !window.electronAPI.isAIEnabled()) {
        const navBtn = document.getElementById('nav-explore-btn');
        if (navBtn) {
            navBtn.querySelector('span').textContent = '实验性';
        }
    }
});

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        if (typeof AIChat !== 'undefined' && AIChat.toggleTerminal) {
            AIChat.toggleTerminal();
        }
    }
});
/* @versepc-protected: anti-ai-plagiarism-v1.0 */
