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

const svgIcon = (d, vb) => {
    const paths = d.split(',').map(p => `<path d="${p.trim()}"/>`).join('');
    return `<svg viewBox="${vb || '0 0 24 24'}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ai-svg-icon">${paths}</svg>`;
};

const TOOL_ICONS = {
    bash: svgIcon('M4 17l6-6-6-6M12 19h8'),
    str_replace_based_edit_tool: svgIcon('M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7,M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'),
    json_edit_tool: svgIcon('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z,M14 2v6h6,M8 13h2M8 17h2,M14 13h2M14 17h2'),
    sequential_thinking: svgIcon('M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z,M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2z'),
    attempt_completion: svgIcon('M22 11.08V12a10 10 0 1 1-5.93-9.14,M22 4L12 14.01l-3-3'),
    ckg: svgIcon('M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5,M2 12l10 5 10-5'),
    manage_core_memory: svgIcon('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4a3 3 0 110 6 3 3 0 010-6zm0 14c-2.67 0-8-1.34-8-4v-2c0-2.66 5.33-4 8-4s8 1.34 8 4v2c0 2.66-5.33 4-8 4z'),
    start_preview: '🌐',
    manage_processes: '⚙️',
    ask_user: '❓',
    undo_edit: '↩️',
    view_history: '📊',
    validate_code: '✅',
    build_index: '📇',
    semantic_search: '🔍',
    index_stats: '📊'
};

const TOOL_DISPLAY_NAMES = {
    bash: '执行命令', str_replace_based_edit_tool: '编辑文件',
    json_edit_tool: '编辑JSON', sequential_thinking: '分步思考',
    attempt_completion: '完成任务', ckg: '代码图谱',
    update_todo_list: '更新计划', read_file: '读取文件',
    grep_search: '搜索内容', glob_search: '搜索文件',
    search_files: '搜索文件', search: '搜索',
    get_versions: '获取版本', select_version: '选择版本',
    install_version: '安装版本', get_current_context: '获取上下文',
    explore_environment: '探索环境', search_mods: '搜索模组',
    get_installed_mods: '获取已安装模组', install_mod: '安装模组',
    toggle_mod: '切换模组', execute_command: '执行命令',
    add_download_task: '添加下载任务', get_download_status: '查询下载进度',
    check_dev_environment: '检查开发环境', install_dev_tools: '安装开发工具',
    init_mod_project: '初始化模组项目', build_mod: '编译模组',
    create_datapack: '创建数据包', create_resourcepack: '创建资源包',
    mod_compile_and_install: '编译安装模组',
    search_modpacks: '搜索整合包', install_modpack: '安装整合包',
    sub_agent_dispatch: '派遣子代理', write_file: '写入文件',
    write_to_file: '写入文件', edit_file: '编辑文件',
    search_replace: '搜索替换',
    manage_core_memory: '管理记忆',
    start_preview: '启动预览',
    manage_processes: '进程管理',
    ask_user: '询问用户',
    undo_edit: '撤销编辑',
    view_history: '查看历史',
    validate_code: '验证代码',
    build_index: '构建索引',
    semantic_search: '语义搜索',
    index_stats: '索引统计'
};

const AIChat = {
    conversations: [],
    currentId: null,
    isGenerating: false,
    abortController: null,
    _sseHandle: null,
    currentToolCalls: [],
    _subAgentConfigs: {
        file_search: { name: '文件搜索代理', role: 'File Search', icon: 'search', color: '#4caf50' },
        code_analysis: { name: '代码分析代理', role: 'Code Analysis', icon: 'code', color: '#9c27b0' },
        resource_download: { name: '资源搜索代理', role: 'Resource Search', icon: 'download', color: '#8d6e63' },
        crash_analysis: { name: '崩溃分析代理', role: 'Crash Analysis', icon: 'bug', color: '#9e9e9e' },
        explore: { name: 'Explorer Agent', role: 'Exploration', icon: 'explore', color: '#ff9800' },
        review: { name: 'Review Agent', role: 'Code Review', icon: 'review', color: '#e91e63' },
        verifier: { name: 'Verifier Agent', role: 'Verification', icon: 'check_circle', color: '#009688' }
    },
    _currentSubAgent: null,
    _currentToolUseBlocks: [],
    _currentTaskGroup: null,
    _currentTaskTitleEl: null,
    _currentTaskIndex: -1,
    _taskGroups: {},
    toolCallBubble: null,
    userMemory: '',
    _persistentMemory: [],
    toolCallStartTime: null,
    thinkingBubble: null,
    thinkingContent: '',
    thinkingStartTime: null,
    typewriterQueue: '',
    typewriterTimer: null,
    typewriterSpeed: 18,
    typewriterBatchSize: 2,
    displayedLength: 0,
    fullTextBuffer: '',
    typewriterTextBlock: null,
    _chunkQueue: [],
    _schedulerTimer: null,
    providers: [],
    addedModels: [],
    _providerKeyStatus: {},
    _commandHistory: [],
    _mcpTab: 'local',
    _editingMcpIndex: null,
    _currentFolderPath: null,
    _currentFolderName: '未选择',
    _role: null,
    _trustedFolders: [],
    _recentFolders: [],
    _todos: [],
    _goal: null,
    _activeSkill: null,
    _installedSkills: [],
    _approvalMode: 'suggest',
    _subAgentModels: {},

    async loadUserMemory() {
        try {
            const raw = await window.electronAPI.store.get('versepc_ai_memory');
            if (raw) this.userMemory = raw;
        } catch (e) {}
    },

    async saveUserMemory() {
        try {
            await window.electronAPI.store.set('versepc_ai_memory', this.userMemory);
        } catch (e) {}
    },

    async loadPersistentMemory() {
        try {
            const raw = await window.electronAPI.store.get('versepc_ai_persistent_memory');
            if (raw && Array.isArray(JSON.parse(raw))) this._persistentMemory = JSON.parse(raw);
        } catch (e) {}
    },

    async savePersistentMemory() {
        try {
            await window.electronAPI.store.set('versepc_ai_persistent_memory', JSON.stringify(this._persistentMemory));
        } catch (e) {}
    },

    async init() {
        if (this._initialized) return;
        this._initialized = true;
        const t0 = performance.now();
        this._initScheduler();
        const t1 = performance.now();
        const allKeys = [
            'versepc_ai_api_key', 'versepc_ai_model', 'versepc_ai_temp',
            'versepc_ai_auto_approve', 'versepc_ai_notifications', 'versepc_ai_context',
            'versepc_ai_terminal', 'versepc_ai_prompts', 'versepc_ai_ui',
            'versepc_ai_experimental', 'versepc_ai_language', 'versepc_ai_custom_provider',
            'versepc_ai_chats', 'versepc_ai_memory', 'versepc_ai_added_models',
            'versepc_ai_trusted_folders', 'versepc_ai_recent_folders',
            'versepc_ai_persistent_memory'
        ];
        try {
            const all = await window.electronAPI.store.getMultiple(allKeys);
            console.log(`[PERF-INIT] batch get ${(performance.now()-t1).toFixed(1)}ms`);
            if (all) {
                this.apiKey = all.versepc_ai_api_key || null;
                this.model = all.versepc_ai_model || null;
                this.temperature = parseFloat(all.versepc_ai_temp) || 0.7;
                try { if (all.versepc_ai_auto_approve) this._autoApproveSettings = JSON.parse(all.versepc_ai_auto_approve); } catch (e) {}
                try { if (all.versepc_ai_notifications) this._notifSettings = JSON.parse(all.versepc_ai_notifications); } catch (e) {}
                try { if (all.versepc_ai_context) this._contextSettings = JSON.parse(all.versepc_ai_context); } catch (e) {}
                try { if (all.versepc_ai_terminal) this._terminalSettings = JSON.parse(all.versepc_ai_terminal); } catch (e) {}
                try { if (all.versepc_ai_prompts) this._promptSettings = JSON.parse(all.versepc_ai_prompts); } catch (e) {}
                try { if (all.versepc_ai_ui) this._uiSettings = JSON.parse(all.versepc_ai_ui); } catch (e) {}
                try { if (all.versepc_ai_experimental) this._experimentalSettings = JSON.parse(all.versepc_ai_experimental); } catch (e) {}
                this._language = all.versepc_ai_language || 'zh-CN';
                try { if (all.versepc_ai_custom_provider) this._customProvider = JSON.parse(all.versepc_ai_custom_provider); } catch (e) {}
                if (all.versepc_ai_chats) {
                    try {
                        const parsed = JSON.parse(all.versepc_ai_chats);
                        this.conversations = Array.isArray(parsed) ? parsed : [];
                        if (this.conversations.length > 0) this.currentId = this.conversations[0].id;
                    } catch (e) {}
                }
                if (all.versepc_ai_memory) this.userMemory = all.versepc_ai_memory;
                try { if (all.versepc_ai_persistent_memory) { const parsed = JSON.parse(all.versepc_ai_persistent_memory); if (Array.isArray(parsed)) this._persistentMemory = parsed; } } catch (e) {}
                try { if (all.versepc_ai_added_models) { const parsed = JSON.parse(all.versepc_ai_added_models); if (Array.isArray(parsed)) this.addedModels = parsed; } } catch (e) {}
                try { if (all.versepc_ai_trusted_folders) { const parsed = JSON.parse(all.versepc_ai_trusted_folders); if (Array.isArray(parsed)) this._trustedFolders = parsed; } } catch (e) {}
                try {
                    if (all.versepc_ai_recent_folders) {
                        const parsed = JSON.parse(all.versepc_ai_recent_folders);
                        this._recentFolders = Array.isArray(parsed) ? parsed : [];
                        if (this._recentFolders.length > 0) {
                            const last = this._recentFolders[0];
                            this._currentFolderPath = last.path;
                            this._currentFolderName = last.name;
                        }
                    }
                } catch (e) {}
            }
        } catch (e) {
            console.log(`[PERF-INIT] batch get failed, fallback ${(performance.now()-t1).toFixed(1)}ms`);
            await this.loadSettings();
            await this.loadConversations();
            await this.loadUserMemory();
            await this.loadPersistentMemory();
        }
        this.updateModelLabel();
        this._updateFolderSelector();
        this.renderSidebar();
        try { if (this._autoApproveSettings && window.electronAPI.ai?.syncAutoApproveSettings) await window.electronAPI.ai.syncAutoApproveSettings(this._autoApproveSettings); } catch (e) {}

        this._refreshProviderKeyStatus();
        this._loadProvidersLazy();
        this._messagesContainer = document.getElementById('ai-messages');
        const t4b = performance.now();
        this.newChat();
        console.log(`[PERF-INIT] switchTo/newChat ${(performance.now()-t4b).toFixed(1)}ms`);

        this._startWatchdog();

        if (window.electronAPI?.ai?.onSelectVersionRequest && !this._onVersionReqRegistered) {
            this._onVersionReqRegistered = true;
            window.electronAPI.ai.onSelectVersionRequest((data) => {
                this._renderVersionSelectRequest(data);
            });
        }

        if (window.electronAPI?.ai?.onAddDownloadTask && !this._onAddDlTaskRegistered) {
            this._onAddDlTaskRegistered = true;
            window.electronAPI.ai.onAddDownloadTask((data) => {
                this._handleAIAddDownloadTask(data);
            });
        }

        this._recentFiles = new Set();
        this._referencedFiles = [];
        this._atMentionActive = false;
        this._atMentionQuery = '';
        this._atMentionStart = -1;
        this._atMentionHighlightIdx = 0;
        this._mcpServers = [];
        this._gitOperations = [];
        this._gitSectionEl = null;
        try { this._mcpServers = JSON.parse(await window.electronAPI.store.get('versepc_mcp_servers') || '[]'); } catch(e) { this._mcpServers = []; }
        this._initAtMention();

        console.log(`[PERF-INIT] AIChat.init total ${(performance.now()-t0).toFixed(1)}ms`);

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.rc-mode-dropdown')) {
                const menu = document.getElementById('ai-mode-menu');
                if (menu) menu.style.display = 'none';
            }
        });

        this._messagesContainer = document.getElementById('ai-messages');

        const msgsContainer = this._messagesContainer;
        if (msgsContainer) {
            msgsContainer.addEventListener('wheel', (e) => {
                if (!this.isGenerating) return;
                if (e.deltaY < 0) {
                    this._userScrollingUp = true;
                    if (this._scrollToBottomBtn && this.isGenerating) {
                        this._scrollToBottomBtn.classList.add('visible');
                    }
                } else if (e.deltaY > 0) {
                    const msgs = msgsContainer;
                    const atBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 50;
                    if (atBottom) {
                        this._userScrollingUp = false;
                        if (this._scrollToBottomBtn) {
                            this._scrollToBottomBtn.classList.remove('visible');
                        }
                    }
                }
            });
            msgsContainer.addEventListener('scroll', () => {
                if (!this.isGenerating) return;
                const atBottom = msgsContainer.scrollHeight - msgsContainer.scrollTop - msgsContainer.clientHeight < 50;
                if (atBottom) {
                    this._userScrollingUp = false;
                    if (this._scrollToBottomBtn) {
                        this._scrollToBottomBtn.classList.toggle('visible', this._userScrollingUp && this.isGenerating);
                    }
                }
            });
        }
        this._scrollToBottomBtn = null;
        this._createScrollToBottomButton();
    },

    _createScrollToBottomButton() {
        const btn = document.createElement('button');
        btn.className = 'scroll-to-bottom-btn';
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>';
        btn.title = '滚动到底部';
        btn.addEventListener('click', () => {
            this._userScrollingUp = false;
            const msgs = this._messagesContainer;
            if (msgs && msgs.lastElementChild) {
                this.scrollToNewContent(msgs.lastElementChild);
            }
            if (this._scrollToBottomBtn) {
                this._scrollToBottomBtn.classList.remove('visible');
            }
        });
        const container = this._messagesContainer || document.getElementById('ai-messages');
        if (container && container.parentElement) {
            container.parentElement.style.position = 'relative';
            container.parentElement.appendChild(btn);
        }
        this._scrollToBottomBtn = btn;
    },

    newChat() {
        const existing = this.getConv(this.currentId);
        if (existing && existing.messages.length === 0 && existing.title === '新对话') {
            this._todos = [];
            this.updateTodoBar();
            this.showWelcome();
            this.renderSidebar();
        } else {
            const conv = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: '新对话', messages: [], createdAt: Date.now(), folderPath: this._currentFolderPath || null };
            this.conversations.unshift(conv);
            this.currentId = conv.id;
            this._todos = [];
            this._goal = null;
            try {
                const relayData = localStorage.getItem('versepc_ai_relay');
                if (relayData) {
                    const relay = JSON.parse(relayData);
                    if (relay.content) {
                        conv.messages.push({ role: 'system', content: relay.content, timestamp: Date.now(), isRelay: true });
                        localStorage.removeItem('versepc_ai_relay');
                    }
                }
            } catch (e) {}
            this.updateTodoBar();
            this.renderSidebar();
            this.showWelcome();
            this.saveConversations();
        }
        const sidebar = document.getElementById('ai-chat-sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            const overlay = document.getElementById('ai-sidebar-overlay');
            if (overlay) overlay.classList.remove('visible');
            const historyBtn = document.getElementById('ai-history-btn');
            if (historyBtn) historyBtn.classList.remove('active');
        }
    },

    switchTo(id) {
        this.currentId = id;
        this._todos = [];
        this._taskToolCalls = {};
        this._lastTodoState = '';
        this.updateTodoBar();
        const conv = this.getConv(id);
        if (!conv || conv.messages.length === 0) {
            this.showWelcome();
        } else {
            this.showMessages(conv.messages);
            this._loadTodos();
        }
        this.renderSidebar();
        if (this._sidePanelOpen) this.updateSidePanel();
        const sidebar = document.getElementById('ai-chat-sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            const overlay = document.getElementById('ai-sidebar-overlay');
            if (overlay) overlay.classList.remove('visible');
            const historyBtn = document.getElementById('ai-history-btn');
            if (historyBtn) historyBtn.classList.remove('active');
        }
    },

    deleteConv(id, event) {
        event?.stopPropagation();
        const idx = this.conversations.findIndex(c => c.id === id);
        if (idx === -1) return;
        this.conversations.splice(idx, 1);

        if (this.currentId === id) {
            if (this.conversations.length > 0) {
                this.switchTo(this.conversations[Math.min(idx, this.conversations.length - 1)].id);
            } else {
                this.currentId = null;
                this.newChat();
            }
        }
        this.saveConversations();
        this.renderSidebar();
    },

    getConv(id) {
        return this.conversations.find(c => c.id === id);
    },

    getCurrent() {
        return this.getConv(this.currentId);
    },

    showWelcome() {
        console.log('[AIChat] showWelcome called');
        const topbar = document.getElementById('ai-chat-topbar');
        if (topbar) topbar.style.display = 'none';
        const todoBar = document.getElementById('ai-todo-bar');
        if (todoBar) todoBar.style.display = 'none';
        document.getElementById('ai-welcome').style.display = '';
        this._messagesContainer.style.display = 'none';
        document.getElementById('ai-chat-main').classList.add('ai-idle');
        const inputArea = document.querySelector('.rc-input-area');
        if (inputArea) {
            inputArea.style.display = '';
            inputArea.classList.add('rc-input-centered');
        }
        this._startTypewriter();
    },

    showMessages(messages) {
        document.getElementById('ai-welcome').style.display = 'none';
        document.getElementById('ai-chat-main').classList.remove('ai-idle');
        const inputArea = document.querySelector('.rc-input-area');
        if (inputArea) inputArea.classList.remove('rc-input-centered');
        this._stopTypewriter();
        const container = this._messagesContainer;
        container.style.display = '';
        if (this._todos.length > 0) {
            const todoBar = document.getElementById('ai-todo-bar');
            if (todoBar) { todoBar.style.display = ''; this._lastTodoState = ''; this.updateTodoBar(); }
        }

        const existingCount = container.children.length;
        if (existingCount === 0 || existingCount !== messages.length) {
            container.innerHTML = '';
            for (const msg of messages) {
                this.appendMessage(msg.role, msg.content, msg.error);
            }
        } else {
            const children = Array.from(container.querySelectorAll('.ai-msg'));
            for (let i = 0; i < messages.length; i++) {
                const msg = messages[i];
                const child = children[i];
                if (child) {
                    const bubble = child.querySelector('.ai-msg-bubble');
                    if (bubble && bubble.textContent !== msg.content) {
                        if (msg.error) {
                            bubble.innerHTML = `<span class="ai-msg-error">${this.escapeHtml(msg.content)}</span>`;
                        } else {
                            this.asyncRenderMarkdown(msg.content, (html) => {
                                if (bubble) { bubble.innerHTML = html; this._highlightCodeBlocks(bubble); }
                            });
                        }
                    }
                }
            }
        }

        this._todos = [];
        for (const msg of messages) {
            if (msg.role === 'assistant' && typeof msg.content === 'string') {
                const todos = this.parseTodosFromText(msg.content);
                if (todos.length > 0) this._todos = todos;
            }
        }
        this.updateTodoBar();
        const condenseBtn = document.getElementById('ai-condense-btn');
        if (condenseBtn) {
            const totalChars = messages.reduce((sum, m) => sum + (m.content || '').length, 0);
            condenseBtn.style.display = totalChars > 8000 && messages.length > 4 ? '' : 'none';
        }

        this.scrollToBottom();
    },

    appendMessage(role, content, isError) {
        const container = this._messagesContainer;
        if (!container) return;

        if (typeof content !== 'string') {
            try { content = JSON.stringify(content, null, 2); } catch (e) { content = String(content); }
        }

        const div = document.createElement('div');
        div.className = `ai-msg ai-msg-${role}`;
        div.style.cssText = 'padding:10px 15px 10px 6px;';

        const header = document.createElement('div');
        header.className = 'ai-msg-header';

        const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        if (role === 'user') {
            header.innerHTML = `<span style="font-weight:600;font-size:13px;color:var(--ai-text-primary)">你</span><span style="font-size:11px;color:var(--ai-text-muted)">${timeStr}</span>`;
        } else {
            header.innerHTML = `<span class="ai-msg-avatar ai-msg-avatar-steve"></span><span style="font-weight:600;font-size:13px;color:var(--ai-text-primary)">VersePC Coder</span><span style="font-size:11px;color:var(--ai-text-muted);margin-left:auto">${timeStr}</span>`;
        }

        const contentWrapper = document.createElement('div');
        contentWrapper.className = role === 'user' ? 'ai-msg-bubble' : 'ai-msg-body';
        contentWrapper.style.cssText = role === 'user' ? '' : 'padding-left:30px;';

        if (isError) {
            contentWrapper.innerHTML = `<span class="ai-msg-error">${this.escapeHtml(content)}</span>`;
        } else if (role === 'user') {
            contentWrapper.innerHTML = `<div style="white-space:pre-wrap;word-break:break-word">${this.escapeHtml(content)}</div>`;
        } else {
            this.asyncRenderMarkdown(content, (html) => {
                contentWrapper.innerHTML = html;
                this._highlightCodeBlocks(contentWrapper);
            });
        }

        div.appendChild(header);
        div.appendChild(contentWrapper);
        container.appendChild(div);

        return contentWrapper;
    },

    appendStreamingBubble() {
        const container = this._messagesContainer;
        if (!container) return null;

        const div = document.createElement('div');
        div.className = 'ai-msg ai-msg-assistant ai-streaming-msg';
        div.id = 'ai-current-response';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'ai-msg-content';

        const streamHeader = document.createElement('div');
        streamHeader.className = 'ai-msg-header';
        const streamTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        streamHeader.innerHTML = `<span class="ai-msg-avatar ai-msg-avatar-steve"></span><span style="font-weight:600;font-size:13px;color:var(--ai-text-primary)">VersePC Coder</span><span style="font-size:11px;color:var(--ai-text-muted);margin-left:auto">${streamTime}</span>`;

        const bubble = document.createElement('div');
        bubble.className = 'ai-msg-bubble';
        bubble.style.cssText = 'padding-left:30px;';
        bubble.innerHTML = '<span class="ai-cursor"></span>';

        contentDiv.appendChild(streamHeader);
        contentDiv.appendChild(bubble);
        div.appendChild(contentDiv);
        container.appendChild(div);

        return bubble;
    },

    scrollToBottom() {
        const msgs = this._messagesContainer;
        if (!msgs) return;
        msgs.scrollTop = msgs.scrollHeight;
    },

    scrollToNewContent(element) {
        const msgs = this._messagesContainer;
        if (!msgs || !element) return;
        const containerRect = msgs.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const offsetInContainer = elementRect.top - containerRect.top + msgs.scrollTop;
        const targetScroll = Math.max(0, offsetInContainer - 16);
        msgs.scrollTo({ top: targetScroll, behavior: 'smooth' });
    },

    createWorkflowBubble() {
        const container = this._messagesContainer;
        if (!container) return null;

        const div = document.createElement('div');
        div.className = 'ai-msg ai-msg-assistant';
        div.id = 'ai-active-workflow';
        div.style.cssText = 'padding:10px 15px 10px 6px;';

        const header = document.createElement('div');
        header.className = 'ai-msg-header';
        header.style.cssText = 'display:flex;align-items:center;gap:10px;cursor:default;margin-bottom:10px;word-break:break-word;';
        const timeStr2 = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        header.innerHTML = `<span class="ai-msg-avatar ai-msg-avatar-steve"></span><span style="font-weight:600;font-size:13px;color:var(--ai-text-primary)">VersePC Coder</span><span class="ai-msg-header-thinking-toggle" onclick="AIChat._toggleWorkflowThinking()"><span>思考过程</span><span class="ai-msg-header-thinking-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><polyline points="6 9 12 15 18 9"/></svg></span></span><span style="font-size:11px;color:var(--ai-text-muted);margin-left:auto">${timeStr2}</span>`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'ai-msg-content ai-msg-body';
        contentDiv.style.cssText = 'padding-left:30px;';

        div.appendChild(header);
        div.appendChild(contentDiv);
        container.appendChild(div);

        return contentDiv;
    },

    _toggleWorkflowThinking() {
        const workflow = document.getElementById('ai-active-workflow');
        if (!workflow) return;
        const toggle = workflow.querySelector('.ai-msg-header-thinking-toggle');
        const chevron = toggle ? toggle.querySelector('.ai-msg-header-thinking-chevron') : null;
        const thinkingBlocks = workflow.querySelectorAll('.ai-thinking-block');
        if (thinkingBlocks.length === 0) return;
        const lastBlock = thinkingBlocks[thinkingBlocks.length - 1];
        const isHidden = lastBlock.style.display === 'none';
        thinkingBlocks.forEach(b => { b.style.display = isHidden ? '' : 'none'; });
        if (chevron) chevron.classList.toggle('open', isHidden);
    },

    _showStatusIndicator(text, type) {
        this._hideStatusIndicator();
        const container = this.getOrCreateWorkflowContent();
        if (!container) return;
        const el = document.createElement('div');
        el.className = 'ai-status-indicator';
        el.id = 'ai-current-status';
        el.innerHTML = `<div class="ai-status-spinner"></div><span class="ai-status-text ${type || ''}">${this.escapeHtml(text)}</span>`;
        container.appendChild(el);
        this._scrollDebounced();
    },

    _hideStatusIndicator() {
        const el = document.getElementById('ai-current-status');
        if (el) el.remove();
    },

    _updateTokenUsageUI() {
        const el = document.getElementById('ai-token-usage');
        if (!el) return;
        const u = this._sessionUsage;
        if (!u || u.total_tokens === 0) { el.textContent = ''; el.style.display = 'none'; this._updateStatusBar(); return; }
        const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n;
        const cost = u.estimatedCost || 0;
        const costStr = cost > 0 ? ` · $${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)}` : '';
        el.textContent = `${fmt(u.total_tokens)} tokens${costStr}`;
        el.title = `输入: ${fmt(u.prompt_tokens)} | 输出: ${fmt(u.completion_tokens)} | 合计: ${fmt(u.total_tokens)} | 轮次: ${u.rounds}${cost > 0 ? `\n预估费用: $${cost.toFixed(4)}` : ''}`;
        el.style.display = '';
        this._updateStatusBar();
    },

    _updateStatusBar(state) {
        const modeEl = document.getElementById('ai-status-mode');
        const modelEl = document.getElementById('ai-status-model');
        const costEl = document.getElementById('ai-status-cost');
        const tokensEl = document.getElementById('ai-status-tokens');
        const contextEl = document.getElementById('ai-status-context');
        const stateEl = document.getElementById('ai-status-state');
        const activeBtn = document.querySelector('.rc-mode-btn.rc-mode-btn-active');
        if (modeEl) {
            const modeLabels = { plan: '探索', agent: '助手', dev: '开发' };
            const modeKey = activeBtn ? activeBtn.dataset.mode : 'plan';
            modeEl.textContent = modeLabels[modeKey] || modeKey;
        }
        if (modelEl) {
            const m = this.model || '-';
            modelEl.textContent = m.length > 20 ? m.slice(0, 18) + '..' : m;
        }
        const u = this._sessionUsage;
        if (costEl && u) costEl.textContent = `$${(u.estimatedCost || 0).toFixed(4)}`;
        if (tokensEl && u) {
            const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n;
            tokensEl.textContent = `${fmt(u.total_tokens || 0)} tok`;
        }
        if (contextEl && u) {
            const pct = Math.min(100, Math.round((u.total_tokens || 0) / 1280 * 100));
            contextEl.textContent = `${pct}%`;
        }
        if (stateEl) {
            const labels = { thinking: '思考中', running: '执行工具', generating: '生成中', idle: '空闲' };
            stateEl.textContent = labels[state] || labels[state === undefined ? 'idle' : state] || '空闲';
            stateEl.setAttribute('data-state', state || 'idle');
        }
    },

    getOrCreateWorkflowContent() {
        let content = document.getElementById('ai-active-workflow');
        if (content) return content.querySelector('.ai-msg-content');
        return this.createWorkflowBubble();
    },

    appendWorkflowBlock(block) {
        const taskBody = this._currentTaskGroup ? this._currentTaskGroup.querySelector('.ai-task-body') : null;
        const contentDiv = taskBody || this.getOrCreateWorkflowContent();
        if (!contentDiv) return;
        contentDiv.appendChild(block);
        this._scrollDebounced();
    },

    getToolActionDescription(name, args) {
        let parsed = {};
        try { parsed = JSON.parse(args); } catch (e) {}

        switch (name) {
            case 'bash': {
                const cmd = (parsed.command || '').slice(0, 60);
                return cmd ? `执行命令… <code>${this.escapeHtml(cmd)}${parsed.command.length > 60 ? '…' : ''}</code>` : '执行命令…';
            }
            case 'str_replace_based_edit_tool': {
                const cmd = parsed.command || 'view';
                const filePath = parsed.path || '';
                const labels = { view: '查看文件', create: '创建文件', str_replace: '编辑文件', insert: '插入到文件' };
                return `${labels[cmd] || '编辑文件'} <code>${this.escapeHtml(filePath.split(/[\/\\]/).pop() || filePath)}</code>`;
            }
            case 'json_edit_tool': {
                const op = parsed.operation || 'view';
                const filePath = parsed.file_path || '';
                const labels = { view: '查看文件', set: '编辑文件', add: '编辑文件', remove: '编辑文件' };
                return `${labels[op] || '编辑文件'} <code>${this.escapeHtml(filePath.split(/[\/\\]/).pop() || filePath)}</code>`;
            }
            case 'sequential_thinking':
                return parsed.is_revision ? '修正思考步骤' : `思考步骤 ${parsed.thought_number || ''}/${parsed.total_thoughts || ''}`;
            case 'attempt_completion':
                return '标记任务完成';
            case 'ckg': {
                const cmd = parsed.command || '';
                const id = parsed.identifier || '';
                return `搜索代码库 <code>${this.escapeHtml(id)}</code>`;
            }
            default:
                return TOOL_DISPLAY_NAMES[name] || name;
        }
    },

    _getToolCallIcon(name) {
        const icons = {
            bash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
            execute_command: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
            str_replace_based_edit_tool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
            json_edit_tool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/></svg>',
            grep_search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
            glob_search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
            search_files: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
            search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
            ckg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
            sequential_thinking: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
            attempt_completion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            update_todo_list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
            get_versions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
            install_version: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
            select_version: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
            read_file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
            default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
        };
        const iconTypeMap = {
            bash: 'type-bash', execute_command: 'type-bash',
            str_replace_based_edit_tool: 'type-edit', json_edit_tool: 'type-write',
            grep_search: 'type-search', glob_search: 'type-search', search_files: 'type-search', search: 'type-search', ckg: 'type-search',
            sequential_thinking: 'type-read', attempt_completion: 'type-edit',
            read_file: 'type-read'
        };
        const svg = icons[name] || icons.default;
        const typeClass = iconTypeMap[name] || '';
        return { svg, typeClass };
    },

    _FILE_OP_TOOLS: new Set(['bash', 'str_replace_based_edit_tool', 'json_edit_tool', 'grep_search', 'glob_search', 'search_files', 'search', 'ckg', 'read_file', 'execute_command']),

    _isFileOpTool(name) {
        return this._FILE_OP_TOOLS.has(name);
    },

    _isReadOnlyTool(name, argsStr) {
        if (name === 'str_replace_based_edit_tool') {
            try { return (JSON.parse(argsStr || '{}').command || 'view') === 'view'; } catch (e) { return true; }
        }
        if (name === 'json_edit_tool') {
            try { return (JSON.parse(argsStr || '{}').operation || 'view') === 'view'; } catch (e) { return true; }
        }
        return ['ckg', 'grep_search', 'glob_search', 'search_files', 'search', 'read_file'].includes(name);
    },

    _getOrCreateToolCallsGroup() {
        if (this._toolCallsGroup && this._toolCallsGroup.isConnected) {
            return this._toolCallsGroup;
        }
        this._fileOpsGroup = null;
        this._fileOpsGroupBody = null;
        this._fileOpsGroupHeader = null;
        this._fileOpsGroupTools = [];
        const taskBody = this._currentTaskGroup ? this._currentTaskGroup.querySelector('.ai-task-body') : null;
        const container = taskBody || this.currentWorkflowContent || this._messagesContainer;
        if (!container) return null;

        const group = document.createElement('div');
        group.className = 'ai-file-ops-group';

        const header = document.createElement('div');
        header.className = 'ai-file-ops-header';
        header.innerHTML = `<span class="ai-file-ops-spinner"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/></svg></span><span class="ai-file-ops-label">正在执行工具...</span><span class="ai-file-ops-count"></span><span class="ai-file-ops-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="6 9 12 15 18 9"/></svg></span>`;

        const body = document.createElement('div');
        body.className = 'ai-file-ops-body';

        header.addEventListener('click', () => {
            const isOpen = body.classList.toggle('open');
            header.querySelector('.ai-file-ops-chevron').classList.toggle('open', isOpen);
        });

        group.appendChild(header);
        group.appendChild(body);
        container.appendChild(group);
        this._toolCallsGroup = group;
        this._toolCallsGroupBody = body;
        this._toolCallsGroupHeader = header;
        this._toolCallsGroupTools = [];
        return group;
    },

    _updateToolCallsGroupHeader() {
        if (!this._toolCallsGroupHeader) return;
        const tools = this._toolCallsGroupTools || [];
        const done = tools.filter(t => t.status === 'done' || t.status === 'error');
        const running = tools.filter(t => t.status === 'running');
        const label = this._toolCallsGroupHeader.querySelector('.ai-file-ops-label');
        const count = this._toolCallsGroupHeader.querySelector('.ai-file-ops-count');
        const spinner = this._toolCallsGroupHeader.querySelector('.ai-file-ops-spinner');

        if (running.length > 0) {
            if (spinner) spinner.style.display = '';
            if (label) label.textContent = '正在执行工具...';
        } else {
            if (spinner) spinner.style.display = 'none';
            if (label) label.textContent = `已执行 ${done.length} 个工具`;
        }
        if (count) count.textContent = running.length > 0 ? `${done.length}/${tools.length}` : '';
    },

    _closeToolCallsGroup() {
        this._toolCallsGroup = null;
        this._toolCallsGroupBody = null;
        this._toolCallsGroupHeader = null;
        this._toolCallsGroupTools = [];
    },

    _getOrCreateFileOpsGroup() {
        if (this._fileOpsGroup && this._fileOpsGroup.isConnected) {
            return this._fileOpsGroup;
        }
        const taskBody = this._currentTaskGroup ? this._currentTaskGroup.querySelector('.ai-task-body') : null;
        const container = taskBody || this.currentWorkflowContent || this._messagesContainer;
        if (!container) return null;

        const group = document.createElement('div');
        group.className = 'ai-file-ops-group';

        const header = document.createElement('div');
        header.className = 'ai-file-ops-header';
        header.innerHTML = `<span class="ai-file-ops-spinner"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/></svg></span><span class="ai-file-ops-label">正在操作文件...</span><span class="ai-file-ops-count"></span><span class="ai-file-ops-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="6 9 12 15 18 9"/></svg></span>`;

        const body = document.createElement('div');
        body.className = 'ai-file-ops-body';

        header.addEventListener('click', () => {
            const isOpen = body.classList.toggle('open');
            header.querySelector('.ai-file-ops-chevron').classList.toggle('open', isOpen);
        });

        group.appendChild(header);
        group.appendChild(body);
        container.appendChild(group);
        this._fileOpsGroup = group;
        this._fileOpsGroupBody = body;
        this._fileOpsGroupHeader = header;
        this._fileOpsGroupTools = [];
        return group;
    },

    _updateFileOpsGroupHeader() {
        if (!this._fileOpsGroupHeader) return;
        const tools = this._fileOpsGroupTools || [];
        const done = tools.filter(t => t.status === 'done' || t.status === 'error');
        const running = tools.filter(t => t.status === 'running');
        const label = this._fileOpsGroupHeader.querySelector('.ai-file-ops-label');
        const count = this._fileOpsGroupHeader.querySelector('.ai-file-ops-count');
        const spinner = this._fileOpsGroupHeader.querySelector('.ai-file-ops-spinner');

        if (running.length > 0) {
            if (spinner) spinner.style.display = '';
            if (label) label.textContent = '正在操作文件...';
            this._multiEditSummaryInserted = false;
        } else {
            if (spinner) spinner.style.display = 'none';
            const editCount = done.filter(t => ['str_replace_based_edit_tool', 'json_edit_tool'].includes(t.name)).length;
            const readCount = done.filter(t => ['bash', 'read_file', 'grep_search', 'glob_search', 'search_files', 'search', 'ckg', 'execute_command'].includes(t.name)).length;
            if (editCount >= 2) {
                if (label) label.textContent = '多文件编辑 - ' + editCount + ' 个文件';
                if (!this._multiEditSummaryInserted) {
                    this._multiEditSummaryInserted = true;
                    this._buildMultiFileEditSummary();
                }
            } else {
                const parts = [];
                if (editCount > 0) parts.push(`已编辑 ${editCount} 个文件`);
                if (readCount > 0) parts.push(`已读取 ${readCount} 个文件`);
                if (label) label.textContent = parts.join('，') || '文件操作完成';
            }
        }
        if (count) count.textContent = done.length > 0 ? ` ${done.length} 项` : '';
    },

    _closeFileOpsGroup() {
        this._fileOpsGroup = null;
        this._fileOpsGroupBody = null;
        this._fileOpsGroupHeader = null;
        this._fileOpsGroupTools = [];
        this._closeToolCallsGroup();
    },

    appendToolCallBubble(tc) {
        if (!tc) return;
        const { svg: iconSvg, typeClass } = this._getToolCallIcon(tc.name);

        if (tc.name === 'sub_agent_dispatch') {
            this.currentToolCalls.push({ id: tc.id, name: tc.name, bubble: null });
            return;
        }

        if (this._isFileOpTool(tc.name)) {
            this._appendGroupedToolCall(tc, iconSvg, typeClass);
        } else {
            this._appendStandaloneToolCall(tc, iconSvg, typeClass);
        }
    },

    _appendGroupedToolCall(tc, iconSvg, typeClass) {
        const group = this._getOrCreateFileOpsGroup();
        if (!group) {
            this._appendStandaloneToolCall(tc, iconSvg, typeClass);
            return;
        }

        const desc = this.getToolActionDescription(tc.name, tc.arguments) || TOOL_DISPLAY_NAMES[tc.name] || tc.name;
        const isReadOnly = this._isReadOnlyTool(tc.name, tc.arguments);
        const row = document.createElement('div');
        row.className = isReadOnly ? 'ai-file-ops-item ai-file-ops-readonly done' : 'ai-file-ops-item running';
        row.id = `tool-${tc.id}`;
        row.dataset.toolId = tc.id;
        row.dataset.toolName = tc.name;
        row.dataset.toolArgs = tc.arguments || '{}';

        if (isReadOnly) {
            const statusEl = document.createElement('span');
            statusEl.className = 'ai-file-ops-status';
            statusEl.innerHTML = desc;
            row.appendChild(statusEl);
            row.style.cursor = 'default';
            this._fileOpsGroupBody.appendChild(row);
            this._fileOpsGroupTools.push({ id: tc.id, name: tc.name, status: 'done' });
            this._updateFileOpsGroupHeader();
            this.currentToolCalls.push({ id: tc.id, name: tc.name, bubble: row });
            return;
        }

        const iconEl = document.createElement('span');
        iconEl.className = `ai-tool-call-icon ${typeClass}`;
        iconEl.innerHTML = iconSvg;

        const statusEl = document.createElement('span');
        statusEl.className = 'ai-file-ops-status';
        statusEl.innerHTML = desc;

        const chevronSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><polyline points="6 9 12 15 18 9"/></svg>';
        const chevronEl = document.createElement('span');
        chevronEl.className = 'ai-file-ops-chevron';
        chevronEl.innerHTML = chevronSvg;

        row.appendChild(iconEl);
        row.appendChild(statusEl);

        if (tc.snapshot) {
            const snapBadge = document.createElement('span');
            snapBadge.className = 'ai-snapshot-badge';
            snapBadge.textContent = '已快照';
            snapBadge.title = '文件修改前已自动创建快照，可用 /restore 恢复';
            row.appendChild(snapBadge);
        }

        const _metaTools = new Set(['update_todo_list', 'sequential_thinking', 'attempt_completion', 'todo_write']);
        if (!_metaTools.has(tc.name)) {
            row.appendChild(chevronEl);
        }

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'ai-file-ops-content';
        const resultArea = document.createElement('div');
        resultArea.className = 'ai-tool-call-result';
        resultArea.dataset.toolId = tc.id;
        contentWrapper.appendChild(resultArea);

        if (!_metaTools.has(tc.name)) {
            row.addEventListener('click', () => {
                const isOpen = contentWrapper.classList.toggle('open');
                chevronEl.classList.toggle('open', isOpen);
                if (isOpen) this._lazyRenderToolResult(row);
            });
        } else {
            row.style.cursor = 'default';
            contentWrapper.style.display = 'none';
        }

        this._fileOpsGroupBody.appendChild(row);
        if (!_metaTools.has(tc.name)) {
            this._fileOpsGroupBody.appendChild(contentWrapper);
        }
        this._fileOpsGroupTools.push({ id: tc.id, name: tc.name, status: 'running' });
        this._updateFileOpsGroupHeader();
        this.currentToolCalls.push({ id: tc.id, name: tc.name, bubble: row });
    },

    _appendStandaloneToolCall(tc, iconSvg, typeClass) {
        const _metaTools = new Set(['update_todo_list', 'sequential_thinking', 'attempt_completion', 'todo_write']);
        if (_metaTools.has(tc.name)) {
            const bubble = document.createElement('div');
            bubble.className = 'ai-tool-call-row running';
            bubble.id = `tool-${tc.id}`;
            bubble.dataset.toolId = tc.id;
            bubble.dataset.toolName = tc.name;
            bubble.dataset.toolArgs = tc.arguments || '{}';
            const desc = this.getToolActionDescription(tc.name, tc.arguments) || TOOL_DISPLAY_NAMES[tc.name] || tc.name;
            const iconEl = document.createElement('span');
            iconEl.className = `ai-tool-call-icon ${typeClass}`;
            iconEl.innerHTML = iconSvg;
            const statusEl = document.createElement('span');
            statusEl.className = 'ai-tool-call-status running';
            statusEl.innerHTML = desc;
            const timeEl = document.createElement('span');
            timeEl.className = 'ai-tool-call-time';
            bubble.appendChild(iconEl);
            bubble.appendChild(statusEl);
            bubble.appendChild(timeEl);
            bubble.style.cursor = 'default';
            this._closeFileOpsGroup();
            this._closeToolCallsGroup();
            if (!this._toolBubbleFragment) {
                this._toolBubbleFragment = document.createDocumentFragment();
            }
            this._toolBubbleFragment.appendChild(bubble);
            this._pendingToolBubbles = (this._pendingToolBubbles || 0) + 1;
            this.currentToolCalls.push({ id: tc.id, name: tc.name, bubble });
            return;
        }

        const group = this._getOrCreateToolCallsGroup();
        if (!group) {
            this._appendStandaloneToolCallDirect(tc, iconSvg, typeClass);
            return;
        }

        const desc = this.getToolActionDescription(tc.name, tc.arguments) || TOOL_DISPLAY_NAMES[tc.name] || tc.name;
        const isReadOnly = this._isReadOnlyTool(tc.name, tc.arguments);
        const row = document.createElement('div');
        row.className = isReadOnly ? 'ai-file-ops-item ai-file-ops-readonly done' : 'ai-file-ops-item running';
        row.id = `tool-${tc.id}`;
        row.dataset.toolId = tc.id;
        row.dataset.toolName = tc.name;
        row.dataset.toolArgs = tc.arguments || '{}';

        if (isReadOnly) {
            const statusEl = document.createElement('span');
            statusEl.className = 'ai-file-ops-status';
            statusEl.innerHTML = desc;
            row.appendChild(statusEl);
            row.style.cursor = 'default';
            this._toolCallsGroupBody.appendChild(row);
            this._toolCallsGroupTools.push({ id: tc.id, name: tc.name, status: 'done' });
            this._updateToolCallsGroupHeader();
            this.currentToolCalls.push({ id: tc.id, name: tc.name, bubble: row });
            return;
        }

        const iconEl = document.createElement('span');
        iconEl.className = `ai-tool-call-icon ${typeClass}`;
        iconEl.innerHTML = iconSvg;

        const statusEl = document.createElement('span');
        statusEl.className = 'ai-file-ops-status';
        statusEl.innerHTML = desc;

        row.appendChild(iconEl);
        row.appendChild(statusEl);

        if (tc.snapshot) {
            const snapBadge = document.createElement('span');
            snapBadge.className = 'ai-snapshot-badge';
            snapBadge.textContent = '已快照';
            snapBadge.title = '文件修改前已自动创建快照，可用 /restore 恢复';
            row.appendChild(snapBadge);
        }

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'ai-file-ops-content';
        const resultArea = document.createElement('div');
        resultArea.className = 'ai-tool-call-result';
        resultArea.dataset.toolId = tc.id;
        contentWrapper.appendChild(resultArea);

        row.addEventListener('click', () => {
            const isOpen = contentWrapper.classList.toggle('open');
            if (isOpen) this._lazyRenderToolResult(row);
        });

        this._toolCallsGroupBody.appendChild(row);
        this._toolCallsGroupBody.appendChild(contentWrapper);
        this._toolCallsGroupTools.push({ id: tc.id, name: tc.name, status: 'running' });
        this._updateToolCallsGroupHeader();
        this.currentToolCalls.push({ id: tc.id, name: tc.name, bubble: row });
    },

    _appendStandaloneToolCallDirect(tc, iconSvg, typeClass) {
        const isReadOnly = this._isReadOnlyTool(tc.name, tc.arguments);
        const bubble = document.createElement('div');
        bubble.className = isReadOnly ? 'ai-tool-call-row ai-file-ops-readonly done' : 'ai-tool-call-row running';
        bubble.id = `tool-${tc.id}`;
        bubble.dataset.toolId = tc.id;
        bubble.dataset.toolName = tc.name;
        bubble.dataset.toolArgs = tc.arguments || '{}';

        const desc = this.getToolActionDescription(tc.name, tc.arguments) || TOOL_DISPLAY_NAMES[tc.name] || tc.name;

        if (isReadOnly) {
            const statusEl = document.createElement('span');
            statusEl.className = 'ai-file-ops-status';
            statusEl.innerHTML = desc;
            bubble.appendChild(statusEl);
            bubble.style.cursor = 'default';
            this._closeFileOpsGroup();
            if (!this._toolBubbleFragment) {
                this._toolBubbleFragment = document.createDocumentFragment();
            }
            this._toolBubbleFragment.appendChild(bubble);
            this._pendingToolBubbles = (this._pendingToolBubbles || 0) + 1;
            this.currentToolCalls.push({ id: tc.id, name: tc.name, bubble });
            return;
        }

        const chevronSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';

        const iconEl = document.createElement('span');
        iconEl.className = `ai-tool-call-icon ${typeClass}`;
        iconEl.innerHTML = iconSvg;

        const statusEl = document.createElement('span');
        statusEl.className = 'ai-tool-call-status running';
        statusEl.innerHTML = desc;

        const timeEl = document.createElement('span');
        timeEl.className = 'ai-tool-call-time';

        const chevronEl = document.createElement('span');
        chevronEl.className = 'ai-tool-call-chevron';
        chevronEl.innerHTML = chevronSvg;

        bubble.appendChild(iconEl);
        bubble.appendChild(statusEl);
        bubble.appendChild(timeEl);

        if (tc.snapshot) {
            const snapBadge = document.createElement('span');
            snapBadge.className = 'ai-snapshot-badge';
            snapBadge.textContent = '已快照';
            snapBadge.title = '文件修改前已自动创建快照，可用 /restore 恢复';
            bubble.appendChild(snapBadge);
        }

        const _metaTools = new Set(['update_todo_list', 'sequential_thinking', 'attempt_completion', 'todo_write']);
        if (!_metaTools.has(tc.name)) {
            bubble.appendChild(chevronEl);

            bubble.addEventListener('click', () => {
                const contentWrapper = bubble.nextElementSibling;
                if (!contentWrapper || !contentWrapper.classList.contains('ai-tool-call-content')) return;
                const isOpen = contentWrapper.classList.toggle('open');
                chevronEl.classList.toggle('open', isOpen);
                if (isOpen) this._lazyRenderToolResult(bubble);
            });
        } else {
            bubble.style.cursor = 'default';
        }

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'ai-tool-call-content';
        const resultArea = document.createElement('div');
        resultArea.className = 'ai-tool-call-result';
        resultArea.dataset.toolId = tc.id;
        contentWrapper.appendChild(resultArea);

        this._closeFileOpsGroup();
        if (!this._toolBubbleFragment) {
            this._toolBubbleFragment = document.createDocumentFragment();
        }
        this._toolBubbleFragment.appendChild(bubble);
        if (!_metaTools.has(tc.name)) {
            this._toolBubbleFragment.appendChild(contentWrapper);
        }
        this._pendingToolBubbles = (this._pendingToolBubbles || 0) + 1;
        this.currentToolCalls.push({ id: tc.id, name: tc.name, bubble });
    },

    _getToolSummary(name, args) {
        return this.getToolActionDescription(name, JSON.stringify(args)) || '';
    },

    _bindApprovalActions(container, approvalId, overlay) {
        const resolveApproval = (approved, alwaysAllow) => {
            if (container._countdownTimer) clearInterval(container._countdownTimer);
            container.classList.add('resolved');
            try { window.electronAPI.ai.toolApprove(approvalId, approved, alwaysAllow); } catch (e) {}
        };

        const approveBtn = container.querySelector('.ai-approval-btn.approve');
        const alwaysBtn = container.querySelector('.ai-approval-btn.always-allow');
        const denyBtn = container.querySelector('.ai-approval-btn.deny');
        const actionsEl = container.querySelector('.ai-approval-actions, .ai-approval-modal-actions');

        if (approveBtn) approveBtn.addEventListener('click', () => {
            resolveApproval(true, false);
            if (actionsEl) actionsEl.innerHTML = '<span class="ai-approval-status approved">✓ 已允许</span>';
            if (overlay) this._removeApprovalOverlay(overlay, container);
        });
        if (alwaysBtn) alwaysBtn.addEventListener('click', () => {
            resolveApproval(true, true);
            if (actionsEl) actionsEl.innerHTML = '<span class="ai-approval-status approved">✓ 已允许（自动）</span>';
            if (overlay) this._removeApprovalOverlay(overlay, container);
        });
        if (denyBtn) denyBtn.addEventListener('click', () => {
            resolveApproval(false, false);
            if (actionsEl) actionsEl.innerHTML = '<span class="ai-approval-status denied">✗ 已拒绝</span>';
            if (overlay) this._removeApprovalOverlay(overlay, container);
        });
    },

    _removeApprovalOverlay(overlay, modal) {
        if (!overlay) return;
        const remaining = overlay.querySelectorAll('.ai-approval-modal:not(.resolved)');
        if (remaining.length === 0) {
            overlay.style.display = 'none';
            overlay.remove();
        }
    },

    _formatArgs(args) {
        try {
            return JSON.stringify(args, null, 2)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        } catch (e) {
            return String(args);
        }
    },

    updateToolCallStatus(tcId, name, result, isError, toolStatus) {
        // 批处理：同帧内多个工具结果合并为一次 rAF 批量 DOM 更新，消除 layout thrashing
        if (!this._toolResultQueue) this._toolResultQueue = [];
        this._toolResultQueue.push({ tcId, name, result, isError, toolStatus });
        if (!this._toolResultRAF) {
            this._toolResultRAF = requestAnimationFrame(() => {
                this._toolResultRAF = null;
                const queue = this._toolResultQueue;
                this._toolResultQueue = [];
                for (const item of queue) {
                    this._applyToolCallStatus(item);
                }
            });
        }
    },

    _handleToolOutputStream(data) {
        const row = document.getElementById('tool-' + data.toolCallId);
        if (!row) return;

        let streamEl = row.querySelector('.tool-stream-output');
        if (!streamEl) {
            streamEl = document.createElement('div');
            streamEl.className = 'tool-stream-output';
            const pre = document.createElement('pre');
            pre.className = 'tool-stream-pre';
            streamEl.appendChild(pre);
            const contentWrapper = row.nextElementSibling;
            if (contentWrapper && contentWrapper.classList.contains('ai-file-ops-content')) {
                contentWrapper.parentNode.insertBefore(streamEl, contentWrapper);
            } else {
                row.parentNode.insertBefore(streamEl, row.nextSibling);
            }
        }

        const pre = streamEl.querySelector('.tool-stream-pre');
        if (!pre) return;

        if (data.type === 'tool_output_chunk' && typeof data.data === 'string') {
            pre.textContent += data.data;
            streamEl.scrollTop = streamEl.scrollHeight;
            if (!streamEl.classList.contains('visible')) {
                streamEl.classList.add('visible');
            }
        }

        if (data.type === 'tool_output_end') {
            streamEl.classList.add('done');
        }
    },

    _applyToolCallStatus({ tcId, name, result, isError, toolStatus }) {
        const row = document.getElementById('tool-' + tcId);
        if (!row) return;

        const st = toolStatus || (isError ? 'error' : 'success');
        row.classList.remove('running');
        row.classList.add(st === 'error' || st === 'denied' ? 'error' : 'done');

        const timeEl = row.querySelector('.ai-tool-call-time');
        if (timeEl && this.toolCallStartTime) {
            const elapsed = ((Date.now() - this.toolCallStartTime) / 1000).toFixed(1);
            timeEl.textContent = elapsed + 's';
        }

        const statusEl = row.querySelector('.ai-tool-call-status') || row.querySelector('.ai-file-ops-status');
        if (statusEl) {
            statusEl.classList.remove('running');
            statusEl.classList.add(st === 'error' || st === 'denied' ? 'error' : 'done');
        }

        const iconEl = row.querySelector('.ai-tool-call-icon');
        if (iconEl) {
            if (st === 'error' || st === 'denied') {
                iconEl.classList.add('type-error');
                iconEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
            } else {
                iconEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>';
            }
        }

        if (result) {
            row.dataset.toolResult = result;
            row.dataset.toolRendered = '';
        }

        if (row.classList.contains('ai-file-ops-item') && this._fileOpsGroupTools) {
            const toolEntry = this._fileOpsGroupTools.find(t => t.id === tcId);
            if (toolEntry) toolEntry.status = st;
            this._updateFileOpsGroupHeader();
        }

        if (row.classList.contains('ai-file-ops-item') && this._toolCallsGroupTools) {
            const toolEntry2 = this._toolCallsGroupTools.find(t => t.id === tcId);
            if (toolEntry2) toolEntry2.status = st;
            this._updateToolCallsGroupHeader();
        }

        if ((st === 'error' || st === 'denied') && result) {
            try {
                const args = row.dataset.toolArgs ? JSON.parse(row.dataset.toolArgs) : null;
                const analysis = this._analyzeToolError(name, args, result);
                if (analysis) {
                    const contentWrapper = row.nextElementSibling;
                    if (contentWrapper && (contentWrapper.classList.contains('ai-tool-call-content') || contentWrapper.classList.contains('ai-file-ops-content'))) {
                        const resultArea = contentWrapper.querySelector('.ai-tool-call-result');
                        if (resultArea) {
                            setTimeout(() => this._showFixSuggestion(resultArea, analysis), 200);
                        }
                    }
                }
            } catch (e) {}
        }
    },

    _toolResultProcessQueue(queue, index) {
        if (index >= queue.length) return;
        const item = queue[index];
        this._applyToolCallStatus(item);
        const row = document.getElementById('tool-' + item.id);
        if (row) {
            const contentWrapper = row.nextElementSibling;
            if (contentWrapper && (contentWrapper.classList.contains('ai-tool-call-content') || contentWrapper.classList.contains('ai-file-ops-content'))) {
                contentWrapper.classList.add('open');
                const chevron = row.querySelector('.ai-tool-call-chevron');
                if (chevron) chevron.classList.add('open');
                this._lazyRenderToolResult(row);
            }
        }
        if (index + 1 < queue.length) {
            this._toolResultRAF = requestAnimationFrame(() => {
                this._toolResultRAF = null;
                this._toolResultProcessQueue(queue, index + 1);
            });
        }
    },

    _finalizePendingToolCalls() {
        if (this._pendingToolResults && Object.keys(this._pendingToolResults).length > 0) {
            const results = Object.values(this._pendingToolResults);
            if (!this._toolResultQueue) this._toolResultQueue = [];
            this._toolResultQueue.push(...results);
            if (!this._toolResultRAF) {
                this._toolResultRAF = requestAnimationFrame(() => {
                    this._toolResultRAF = null;
                    const queue = this._toolResultQueue;
                    this._toolResultQueue = [];
                    this._toolResultProcessQueue(queue, 0);
                });
            }
            this._pendingToolResults = {};
        }
        const runningRows = document.querySelectorAll('.ai-tool-call-row.running');
        runningRows.forEach(row => {
            row.classList.remove('running');
            row.classList.add('done');
            const iconEl = row.querySelector('.ai-tool-call-icon');
            if (iconEl) {
                iconEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>';
            }
        });
    },

    _lazyRenderToolResult(row) {
        if (!row || row.dataset.toolRendered === '1') return;
        const result = row.dataset.toolResult;
        const tcId = row.dataset.toolId;
        const name = row.dataset.toolName;
        if (!result || !tcId) return;
        row.dataset.toolRendered = '1';

        let resultEl = row.querySelector('.ai-tool-call-result[data-tool-id="' + tcId + '"]');
        if (!resultEl) {
            const contentWrapper = row.nextElementSibling;
            if (contentWrapper && (contentWrapper.classList.contains('ai-file-ops-content') || contentWrapper.classList.contains('ai-tool-call-content'))) {
                resultEl = contentWrapper.querySelector('.ai-tool-call-result[data-tool-id="' + tcId + '"]');
            }
        }
        if (!resultEl) {
            let sibling = row.nextElementSibling;
            for (let i = 0; i < 5 && sibling; i++) {
                resultEl = sibling.querySelector ? sibling.querySelector('.ai-tool-call-result[data-tool-id="' + tcId + '"]') : null;
                if (resultEl) break;
                sibling = sibling.nextElementSibling;
            }
        }
        if (!resultEl) {
            const container = row.closest('.ai-file-ops-body, .ai-task-body, .ai-msg-content');
            if (container) resultEl = container.querySelector('.ai-tool-call-result[data-tool-id="' + tcId + '"]');
        }
        if (!resultEl) return;

        const renderResult = () => {
            try {
                const MAX_RESULT_LEN = 4096;
                const parseStr = result.length > MAX_RESULT_LEN ? result.slice(0, MAX_RESULT_LEN) : result;
                const truncated = result.length > MAX_RESULT_LEN;
                const parsed = JSON.parse(parseStr);

                if (typeof parsed === 'object' && parsed !== null) {
                    if (parsed.status === 'denied') {
                        resultEl.innerHTML = '<span class="ai-tool-status-denied">' + this.escapeHtml(parsed.message || '操作被拒绝') + '</span>';
                    } else if (parsed.status === 'error' || parsed.error) {
                        resultEl.innerHTML = '<span class="ai-tool-status-error-text">' + this.escapeHtml(parsed.error || '未知错误') + '</span>';
                    } else if (name === 'bash' || name === 'execute_command') {
                        const cmd = row.dataset.toolArgs ? (() => { try { return JSON.parse(row.dataset.toolArgs).command; } catch(e) { return ''; } })() : '';
                        resultEl.innerHTML = this._renderCommandCard(cmd, parsed, parsed.exitCode ?? parsed.code);
                    } else if (name === 'str_replace_based_edit_tool') {
                        const args = row.dataset.toolArgs ? (() => { try { return JSON.parse(row.dataset.toolArgs); } catch(e) { return {}; } })() : {};
                        const cmd = args.command || 'view';
                        const filePath = args.path || args.file_path || '';
                        if (cmd === 'view') {
                            const content = parsed.content || parsed.data || (typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2));
                            resultEl.innerHTML = this._renderFileCard(filePath, content);
                            this._highlightCodeBlocks(resultEl);
                        } else if (cmd === 'str_replace' || cmd === 'insert' || cmd === 'create') {
                            const oldStr = args.old_str || args.search || '';
                            const newStr = args.new_str || args.replace || args.content || '';
                            if (oldStr && newStr) {
                                resultEl.innerHTML = this._renderDiffCard(filePath, oldStr, newStr);
                            } else {
                                const content = parsed.content || parsed.data || (typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2));
                                resultEl.innerHTML = this._renderFileCard(filePath, content);
                                this._highlightCodeBlocks(resultEl);
                            }
                        }
                    } else if (name === 'json_edit_tool') {
                        const args = row.dataset.toolArgs ? (row._parsedToolArgs || (() => { try { return JSON.parse(row.dataset.toolArgs); } catch(e) { return {}; } })()) : {};
                        const filePath = args.file_path || '';
                        const content = parsed.content || parsed.data || JSON.stringify(parsed, null, 2);
                        resultEl.innerHTML = this._renderFileCard(filePath, content);
                        this._highlightCodeBlocks(resultEl);
                    } else if (name === 'grep_search' || name === 'glob_search' || name === 'search_files' || name === 'search' || name === 'ckg') {
                        const results = parsed.results || parsed.matches || parsed.files || parsed.paths || [];
                        const query = parsed.query || parsed.pattern || parsed.identifier || '';
                        resultEl.innerHTML = this._renderSearchResultCard(query, Array.isArray(results) ? results : [], name);
                    } else if (name === 'select_version') {
                        resultEl.innerHTML = this._renderVersionSelectCard(parsed, tcId);
                    } else if (name === 'undo_edit') {
                        if (parsed.backups) {
                            resultEl.innerHTML = this._renderBackupList(parsed.backups);
                        } else if (parsed.success) {
                            resultEl.innerHTML = '<div class="ai-tool-success">已恢复到备份版本: ' + this._escapeHtml(parsed.restoredPath) + '</div>';
                        } else if (parsed.original) {
                            resultEl.innerHTML = '<div class="ai-tool-info">差异对比已加载</div>';
                        }
                    } else if (name === 'view_history') {
                        try {
                            if (parsed.changes) {
                                resultEl.innerHTML = this._renderChangeHistory(parsed.changes);
                            } else if (parsed.logs) {
                                resultEl.innerHTML = this._renderAuditLog(parsed.logs);
                            } else if (parsed.sessionId) {
                                resultEl.innerHTML = this._renderSessionSummary(parsed);
                            }
                        } catch (e) {}
                    } else if (name === 'validate_code') {
                        try {
                            if (parsed.valid) {
                                resultEl.innerHTML = '<div class="ai-tool-success">✅ 代码验证通过</div>';
                            } else {
                                const errors = (parsed.errors || [{ error: parsed.error, line: parsed.line }]).map(e =>
                                    `<div class="ai-validation-error">行 ${e.line || '?'}: ${e.error}</div>`
                                ).join('');
                                resultEl.innerHTML = `<div class="ai-validation-failed"><div class="ai-validation-header">❌ 代码验证失败</div>${errors}${parsed.suggestion ? `<div class="ai-validation-suggestion">💡 ${parsed.suggestion}</div>` : ''}</div>`;
                            }
                        } catch (e) {}
                    } else if (name === 'semantic_search') {
                        try {
                            const parsed = JSON.parse(result);
                            if (parsed.results && parsed.results.length > 0) {
                                resultEl.innerHTML = this._renderSearchResults(parsed);
                            } else if (parsed.results) {
                                resultEl.innerHTML = '<div class="ai-tool-info">未找到匹配结果</div>';
                            }
                        } catch (e) {}
                    } else if (name === 'build_index') {
                        try {
                            const parsed = JSON.parse(result);
                            if (parsed.success) {
                                resultEl.innerHTML = `<div class="ai-tool-success">✅ 索引构建完成：${parsed.files} 个文件，${parsed.tokens} 个词元，耗时 ${parsed.elapsed}ms</div>`;
                            }
                        } catch (e) {}
                    } else if (name === 'sub_agent_dispatch') {
                        return;
                    } else if (parsed.files && Array.isArray(parsed.files)) {
                        const items = parsed.files.slice(0, 20).map(f => {
                            const fname = typeof f === 'string' ? f : (f.name || f.path || '');
                            const ef = this._escapeHtml(fname);
                            return '<span class="ai-tool-file-item clickable" onclick="AIChat._openFileInEditor(\'' + ef.replace(/'/g, "\\'") + '\')" title="' + ef + '">' + ef + '</span>';
                        }).join('');
                        const more = parsed.files.length > 20 ? ' <span class="ai-tool-more">等 ' + parsed.files.length + ' 项</span>' : '';
                        resultEl.innerHTML = '<div class="rc-file-card expanded"><div class="rc-file-card-header"><div class="rc-file-card-info"><span class="rc-file-card-icon">📁</span><span class="rc-file-card-path">' + parsed.files.length + ' 个文件</span></div></div><div class="rc-file-card-body"><div class="rc-file-list">' + items + more + '</div></div></div>';
                    } else {
                        const str = JSON.stringify(parsed, null, 2);
                        const suffix = truncated ? '\n...(结果过大已截断)' : (str.length > 800 ? '\n...(已截断)' : '');
                        resultEl.innerHTML = '<pre class="rc-file-card-pre">' + this._escapeHtml(str.slice(0, 800) + suffix) + '</pre>';
                    }
                } else {
                    const suffix = truncated ? '\n...(结果过大已截断)' : '';
                    resultEl.innerHTML = '<pre class="rc-file-card-pre">' + this._escapeHtml(String(parsed).slice(0, 800) + suffix) + '</pre>';
                }
            } catch (e) {
                resultEl.innerHTML = '<pre class="rc-file-card-pre">' + this._escapeHtml(String(result).slice(0, 800)) + '</pre>';
            }
        };
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(renderResult, { timeout: 100 });
        } else {
            setTimeout(renderResult, 16);
        }
    },

    renderCommandOutput(result, toolName) {
        if (toolName !== 'execute_command' && toolName !== 'read_command_output') return null;
        let parsed;
        try { parsed = typeof result === 'string' ? JSON.parse(result) : result; } catch(e) { parsed = { output: String(result) }; }
        const output = parsed.output || parsed.stdout || parsed.result || String(result);
        const exitCode = parsed.exitCode ?? parsed.code;
        const stderr = parsed.stderr || '';
        
        const container = document.createElement('div');
        container.className = 'rc-terminal';
        
        let headerHtml = '<div class="rc-terminal-header"><span class="rc-terminal-title">PS</span>';
        if (exitCode !== undefined && exitCode !== null) {
            headerHtml += `<span class="rc-terminal-badge ${exitCode === 0 ? 'success' : 'error'}">${exitCode === 0 ? '✓ 成功' : '✗ 失败 (' + exitCode + ')'}</span>`;
        }
        headerHtml += `<button class="rc-terminal-copy" onclick="AIChat._copyTerminalOutput(this)" title="复制输出"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px"><rect x="6" y="6" width="8" height="8" rx="1"/><path d="M2 10V3a1 1 0 0 1 1-1h7"/></svg></button>`;
        headerHtml += '</div>';
        
        let bodyHtml = '<div class="rc-terminal-body"><pre class="rc-terminal-output">';
        if (output) bodyHtml += this._parseAnsiColors(this.escapeHtml(output));
        if (stderr && stderr !== output) bodyHtml += '<span class="rc-terminal-stderr">' + this._parseAnsiColors(this.escapeHtml(stderr)) + '</span>';
        if (!output && !stderr) bodyHtml += '<span class="rc-terminal-empty">(无输出)</span>';
        bodyHtml += '</pre></div>';
        
        container.innerHTML = headerHtml + bodyHtml;
        return container;
    },

    _parseAnsiColors(text) {
        if (!text) return '';
        const colorMap = {
            '30': '#6b7280', '31': '#ef4444', '32': '#22c55e', '33': '#eab308',
            '34': '#3b82f6', '35': '#a855f7', '36': '#06b6d4', '37': '#e5e7eb',
        };
        return text.replace(/\x1b\[([0-9;]*)m/g, (match, codes) => {
            const parts = codes.split(';');
            let styles = [];
            for (const code of parts) {
                if (code === '0' || code === '') { styles = []; continue; }
                if (colorMap[code]) styles.push('color:' + colorMap[code]);
                if (code === '1') styles.push('font-weight:bold');
                if (code === '4') styles.push('text-decoration:underline');
            }
            return styles.length > 0 ? `<span style="${styles.join(';')}">` : '</span>';
        });
    },

    _copyTerminalOutput(btn) {
        const body = btn.closest('.rc-terminal')?.querySelector('.rc-terminal-output');
        if (body) {
            const text = body.innerText;
            try { window.electronAPI?.clipboard?.writeText(text); } catch(e) { navigator.clipboard?.writeText(text); }
        }
    },

    renderSearchResults(result, toolName) {
        if (toolName !== 'grep_search' && toolName !== 'glob_search' && toolName !== 'search_files') return null;
        let parsed;
        try { parsed = typeof result === 'string' ? JSON.parse(result) : result; } catch(e) { return null; }
        const results = parsed.results || parsed.matches || parsed.files || [];
        if (!Array.isArray(results) || results.length === 0) return null;
        
        const container = document.createElement('div');
        container.className = 'rc-search-results';
        
        const summary = document.createElement('div');
        summary.className = 'rc-search-summary';
        summary.textContent = `${results.length} 个结果`;
        container.appendChild(summary);
        
        const byFile = new Map();
        for (const r of results) {
            const file = r.file || r.path || r.filename || 'unknown';
            if (!byFile.has(file)) byFile.set(file, []);
            byFile.get(file).push(r);
        }
        
        for (const [file, matches] of byFile) {
            const fileGroup = document.createElement('div');
            fileGroup.className = 'rc-search-file-group';
            fileGroup.innerHTML = `<div class="rc-search-file-header"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px"><path d="M10 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6l-3-4z"/></svg>${this.escapeHtml(file)}</div>`;
            
            for (const m of matches) {
                const matchLine = document.createElement('div');
                matchLine.className = 'rc-search-match';
                const lineNum = m.line || m.lineNumber || '';
                const text = m.text || m.content || m.match || '';
                const highlighted = m.line !== undefined || m.lineNumber !== undefined;
                matchLine.innerHTML = highlighted 
                    ? `<span class="rc-search-line-num">${lineNum}</span><span class="rc-search-line-text">${this.escapeHtml(String(text))}</span>`
                    : `<span class="rc-search-line-text">${this.escapeHtml(String(text))}</span>`;
                fileGroup.appendChild(matchLine);
            }
            container.appendChild(fileGroup);
        }
        return container;
    },

    updateInstallProgress(toolCallId, toolName, progress, status) {
        const row = document.getElementById('tool-' + toolCallId);
        if (!row) return;

        let progBar = row.querySelector('.ai-tool-progress');
        if (!progBar) {
            progBar = document.createElement('div');
            progBar.className = 'ai-tool-progress';
            const contentWrapper = row.nextElementSibling;
            if (contentWrapper && contentWrapper.classList.contains('ai-tool-call-content')) {
                contentWrapper.style.display = '';
                contentWrapper.appendChild(progBar);
            } else {
                row.appendChild(progBar);
            }
        }
        const pct = Math.min(100, Math.max(0, progress));
        const stText = status === 'completed' ? '完成' : status === 'failed' ? '失败' : status || (pct + '%');
        progBar.innerHTML = '<div class="ai-tool-progress-track"><div class="ai-tool-progress-fill" style="width:' + pct + '%"></div></div><span class="ai-tool-progress-label">' + stText + '</span>';

        if (status === 'completed' || status === 'done' || pct >= 100) {
            progBar.classList.add('ai-tool-progress-done');
        } else if (status === 'failed' || status === 'error') {
            progBar.classList.add('ai-tool-progress-error');
        }
    },

    _parseDiffFromArgs(toolName, args) {
        if (!args) return null;
        const diffs = [];
        if (toolName === 'write_file' || toolName === 'write_to_file') {
            const lines = (args.content || '').split('\n');
            diffs.push({ path: args.path || args.file || 'unknown', additions: lines.length, deletions: 0, lines: lines.map(l => ({ type: '+', text: l })) });
        } else if (toolName === 'edit_file' || toolName === 'search_replace') {
            const search = args.old_str || args.search || args.oldStr || '';
            const replace = args.new_str || args.replace || args.newStr || '';
            const searchLines = search.split('\n');
            const replaceLines = replace.split('\n');
            const diffLines = [];
            for (const l of searchLines) diffLines.push({ type: '-', text: l });
            for (const l of replaceLines) diffLines.push({ type: '+', text: l });
            diffs.push({ path: args.path || args.file || 'unknown', additions: replaceLines.length, deletions: searchLines.length, lines: diffLines });
        }
        return diffs.length > 0 ? diffs : null;
    },

    _renderDiffBlock(diffs) {
        if (!diffs || diffs.length === 0) return '';
        let html = '<div class="rc-diff-view">';
        for (const diff of diffs) {
            html += `<div class="rc-diff-header"><span class="rc-diff-file">${diff.path}</span><span class="rc-diff-stats"><span class="rc-diff-add">+${diff.additions}</span> <span class="rc-diff-del">-${diff.deletions}</span></span></div>`;
            html += '<div class="rc-diff-body">';
            let lineNum = 1;
            for (const line of diff.lines) {
                const cls = line.type === '+' ? 'add' : line.type === '-' ? 'del' : 'ctx';
                html += `<div class="rc-diff-line ${cls}"><span class="rc-diff-gutter">${line.type === '+' ? '' : line.type === '-' ? '' : lineNum}</span><span class="rc-diff-prefix">${line.type === ' ' ? '&nbsp;' : line.type}</span><span class="rc-diff-text">${this._escapeHtml(line.text)}</span></div>`;
                if (line.type !== '-') lineNum++;
            }
            html += '</div>';
        }
        html += '</div>';
        return html;
    },

    _escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    _getLanguageFromPath(filePath) {
        if (!filePath) return 'text';
        const ext = (filePath.split('.').pop() || '').toLowerCase();
        const map = {
            js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
            py: 'python', rb: 'ruby', java: 'java', c: 'c', cpp: 'cpp', h: 'c',
            cs: 'csharp', go: 'go', rs: 'rust', php: 'php', swift: 'swift',
            kt: 'kotlin', scala: 'scala', html: 'html', htm: 'html',
            css: 'scss', scss: 'scss', less: 'less', xml: 'xml',
            json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini', ini: 'ini',
            md: 'markdown', markdown: 'markdown', txt: 'text', sh: 'bash',
            bash: 'bash', zsh: 'bash', ps1: 'powershell', bat: 'batch',
            sql: 'sql', graphql: 'graphql', dockerfile: 'dockerfile',
            makefile: 'makefile', vue: 'html', svelte: 'html',
        };
        return map[ext] || ext || 'text';
    },

    _getFileName(filePath) {
        if (!filePath) return '';
        return filePath.split(/[\/\\]/).pop() || filePath;
    },

    _getFileIcon(filePath) {
        const ext = (filePath || '').split('.').pop()?.toLowerCase() || '';
        const iconMap = {
            js: '📜', jsx: '⚛️', ts: '📘', tsx: '⚛️', py: '🐍',
            html: '🌐', css: '🎨', json: '📋', md: '📝',
            java: '☕', go: '🐹', rs: '🦀', rb: '💎',
            sh: '🖥️', bash: '🖥️', sql: '🗃️',
        };
        return iconMap[ext] || '📄';
    },

    _renderFileCard(filePath, content, options = {}) {
        const lang = options.language || this._getLanguageFromPath(filePath);
        const fileName = this._getFileName(filePath);
        const icon = this._getFileIcon(filePath);
        const truncated = content && content.length > 6000;
        const displayContent = truncated ? content.slice(0, 6000) : content;
        const lines = (displayContent || '').split('\n').length;

        // syntax highlighting removed to avoid blocking main thread; use Web Worker for future support
        const highlighted = this._escapeHtml(displayContent || '');

        const escapedPath = this._escapeHtml(filePath || '');
        const openBtnHtml = filePath ? `<button class="rc-file-card-btn rc-open-editor-btn" onclick="event.stopPropagation();AIChat._openFileInEditor('${escapedPath.replace(/'/g, "\\'")}')" title="在编辑器中打开">↗</button>` : '';
        return `<div class="rc-file-card">
            <div class="rc-file-card-header" onclick="this.parentElement.classList.toggle('expanded')">
                <div class="rc-file-card-info">
                    <span class="rc-file-card-icon">${icon}</span>
                    <span class="rc-file-card-path${filePath ? ' clickable' : ''}" title="${escapedPath}" ${filePath ? `onclick="event.stopPropagation();AIChat._openFileInEditor('${escapedPath.replace(/'/g, "\\'")}')"` : ''}>${escapedPath || 'unknown'}</span>
                    <span class="rc-file-card-lang">${lang}</span>
                </div>
                <div class="rc-file-card-actions">
                    <span class="rc-file-card-meta">${lines} 行</span>
                    ${openBtnHtml}
                    <button class="rc-file-card-btn" onclick="event.stopPropagation();const t=this.closest('.rc-file-card').querySelector('code');navigator.clipboard.writeText(t?.textContent||'').then(()=>{this.textContent='✓';setTimeout(()=>{this.textContent='📋'},1500)})" title="复制内容">📋</button>
                    <svg class="rc-file-card-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
            </div>
            <div class="rc-file-card-body">
                <pre class="rc-file-card-pre"><code class="hljs language-${lang}">${highlighted}</code></pre>
                ${truncated ? '<div class="rc-file-card-truncated">内容过长已截断，共 ' + (content || '').split('\n').length + ' 行</div>' : ''}
            </div>
        </div>`;
    },

    _renderDiffCard(filePath, oldStr, newStr) {
        const oldLines = (oldStr || '').split('\n');
        const newLines = (newStr || '').split('\n');
        const maxLines = 200;
        const truncated = oldLines.length > maxLines || newLines.length > maxLines;
        const displayOld = truncated ? oldLines.slice(0, maxLines) : oldLines;
        const displayNew = truncated ? newLines.slice(0, maxLines) : newLines;
        const maxLen = Math.max(displayOld.length, displayNew.length);
        const ef = this._escapeHtml(filePath || '');
        const diffId = 'diff-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        if (!this._diffData) this._diffData = {};
        this._diffData[diffId] = { filePath, oldStr, newStr };

        let rows = '';
        for (let i = 0; i < maxLen; i++) {
            const oldLine = i < displayOld.length ? displayOld[i] : '';
            const newLine = i < displayNew.length ? displayNew[i] : '';
            const isSame = oldLine === newLine;
            const lineNum = i + 1;
            const oldClass = isSame ? '' : ' diff-del';
            const newClass = isSame ? '' : ' diff-add';
            rows += '<div class="diff-row">' +
                '<span class="diff-line-num diff-left-num">' + lineNum + '</span>' +
                '<span class="diff-code diff-left' + oldClass + '">' + this._escapeHtml(oldLine || ' ') + '</span>' +
                '<span class="diff-line-num diff-right-num">' + lineNum + '</span>' +
                '<span class="diff-code diff-right' + newClass + '">' + this._escapeHtml(newLine || ' ') + '</span>' +
                '</div>';
        }

        const truncateNotice = truncated ? '<div class="diff-truncate">... 已截断显示（共 ' + oldLines.length + '→' + newLines.length + ' 行）</div>' : '';

        return '<div class="diff-card" id="' + diffId + '">' +
            '<div class="diff-header"><span class="diff-file-icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px"><path d="M9.5 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5L9.5 1z"/><polyline points="9.5 1 9.5 5.5 13 5.5"/></svg></span>' +
            '<span class="diff-file-name">' + ef + '</span>' +
            '<span class="diff-badge">' + oldLines.length + ' → ' + newLines.length + ' 行</span>' +
            '<div class="diff-toggle-group">' +
            '<button class="diff-toggle active" onclick="AIChat._toggleDiffView(\'' + diffId + '\',\'side\')" title="并排视图">' +
            '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="6" height="14" rx="1"/><rect x="9" y="1" width="6" height="14" rx="1"/></svg>' +
            '</button>' +
            '<button class="diff-toggle" onclick="AIChat._toggleDiffView(\'' + diffId + '\',\'inline\')" title="内联视图">' +
            '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></svg>' +
            '</button>' +
            '</div>' +
            '</div>' +
            '<div class="diff-body">' + rows + '</div>' +
            truncateNotice +
            '</div>';
    },

    _toggleDiffView(diffId, view) {
        const card = document.getElementById(diffId);
        if (!card) return;
        const data = this._diffData ? this._diffData[diffId] : null;
        if (!data) return;
        const body = card.querySelector('.diff-body');
        if (!body) return;
        const toggles = card.querySelectorAll('.diff-toggle');
        toggles.forEach(function(t) { t.classList.remove('active'); });
        if (view === 'inline') {
            body.innerHTML = this._renderInlineDiff(data.filePath, data.oldStr, data.newStr);
            if (toggles[1]) toggles[1].classList.add('active');
        } else {
            body.innerHTML = this._renderSideBySideDiffBody(data.oldStr, data.newStr);
            if (toggles[0]) toggles[0].classList.add('active');
        }
    },

    _renderSideBySideDiffBody(oldStr, newStr) {
        const oldLines = (oldStr || '').split('\n');
        const newLines = (newStr || '').split('\n');
        const maxLines = 200;
        const truncated = oldLines.length > maxLines || newLines.length > maxLines;
        const displayOld = truncated ? oldLines.slice(0, maxLines) : oldLines;
        const displayNew = truncated ? newLines.slice(0, maxLines) : newLines;
        const maxLen = Math.max(displayOld.length, displayNew.length);
        let rows = '';
        for (let i = 0; i < maxLen; i++) {
            const oldLine = i < displayOld.length ? displayOld[i] : '';
            const newLine = i < displayNew.length ? displayNew[i] : '';
            const isSame = oldLine === newLine;
            const lineNum = i + 1;
            const oldClass = isSame ? '' : ' diff-del';
            const newClass = isSame ? '' : ' diff-add';
            rows += '<div class="diff-row">' +
                '<span class="diff-line-num diff-left-num">' + lineNum + '</span>' +
                '<span class="diff-code diff-left' + oldClass + '">' + this._escapeHtml(oldLine || ' ') + '</span>' +
                '<span class="diff-line-num diff-right-num">' + lineNum + '</span>' +
                '<span class="diff-code diff-right' + newClass + '">' + this._escapeHtml(newLine || ' ') + '</span>' +
                '</div>';
        }
        return rows;
    },

    _renderInlineDiff(filePath, oldStr, newStr) {
        const oldLines = (oldStr || '').split('\n');
        const newLines = (newStr || '').split('\n');
        const maxLines = 200;
        const truncated = oldLines.length > maxLines || newLines.length > maxLines;
        const displayOld = truncated ? oldLines.slice(0, maxLines) : oldLines;
        const displayNew = truncated ? newLines.slice(0, maxLines) : newLines;
        const maxLen = Math.max(displayOld.length, displayNew.length);
        let rows = '';
        let oldLineNum = 0;
        let newLineNum = 0;
        for (let i = 0; i < maxLen; i++) {
            const oldLine = i < displayOld.length ? displayOld[i] : null;
            const newLine = i < displayNew.length ? displayNew[i] : null;
            if (oldLine === newLine) {
                oldLineNum++;
                newLineNum++;
                rows += '<div class="diff-inline-row diff-inline-ctx">' +
                    '<span class="diff-inline-num">' + oldLineNum + '</span>' +
                    '<span class="diff-inline-prefix"> </span>' +
                    '<span class="diff-inline-text">' + this._escapeHtml(oldLine || ' ') + '</span>' +
                    '</div>';
            } else {
                if (oldLine !== null) {
                    oldLineNum++;
                    rows += '<div class="diff-inline-row diff-inline-del">' +
                        '<span class="diff-inline-num">' + oldLineNum + '</span>' +
                        '<span class="diff-inline-prefix">-</span>' +
                        '<span class="diff-inline-text">' + this._escapeHtml(oldLine || ' ') + '</span>' +
                        '</div>';
                }
                if (newLine !== null) {
                    newLineNum++;
                    rows += '<div class="diff-inline-row diff-inline-add">' +
                        '<span class="diff-inline-num">' + newLineNum + '</span>' +
                        '<span class="diff-inline-prefix">+</span>' +
                        '<span class="diff-inline-text">' + this._escapeHtml(newLine || ' ') + '</span>' +
                        '</div>';
                }
            }
        }
        if (truncated) {
            rows += '<div class="diff-inline-sep">... 已截断显示（共 ' + oldLines.length + '→' + newLines.length + ' 行）</div>';
        }
        return '<div class="diff-inline-body">' + rows + '</div>';
    },

    _renderMultiFileEditCard(fileEdits) {
        if (!fileEdits || fileEdits.length === 0) return '';
        if (fileEdits.length === 1) {
            return this._renderDiffCard(fileEdits[0].filePath, fileEdits[0].oldStr, fileEdits[0].newStr);
        }
        const cardId = 'multi-edit-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        let tabs = '';
        let panels = '';
        for (let idx = 0; idx < fileEdits.length; idx++) {
            const edit = fileEdits[idx];
            const fileName = (edit.filePath || '').split(/[\/\\]/).pop() || edit.filePath || 'file';
            const ef = this._escapeHtml(fileName);
            const oldLines = (edit.oldStr || '').split('\n');
            const newLines = (edit.newStr || '').split('\n');
            const addCount = newLines.filter(function(l, i) { return i >= oldLines.length || l !== oldLines[i]; }).length;
            const delCount = oldLines.filter(function(l, i) { return i >= newLines.length || l !== newLines[i]; }).length;
            const activeClass = idx === 0 ? ' active' : '';
            tabs += '<div class="ai-multi-edit-tab' + activeClass + '" onclick="AIChat._switchMultiEditTab(\'' + cardId + '\',' + idx + ')">' +
                '<span>' + ef + '</span>' +
                (delCount > 0 ? '<span class="ai-multi-edit-tab-del">-' + delCount + '</span>' : '') +
                (addCount > 0 ? '<span class="ai-multi-edit-tab-add">+' + addCount + '</span>' : '') +
                '</div>';
            panels += '<div class="ai-multi-edit-panel' + (idx === 0 ? ' active' : '') + '" data-panel-idx="' + idx + '">' +
                this._renderDiffCard(edit.filePath, edit.oldStr, edit.newStr) +
                '</div>';
        }
        return '<div class="ai-multi-edit-card" id="' + cardId + '">' +
            '<div class="ai-multi-edit-header">' +
            '<div class="ai-multi-edit-header-left">' +
            '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9.5 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5L9.5 1z"/><polyline points="9.5 1 9.5 5.5 13 5.5"/></svg>' +
            '<span>编辑了 ' + fileEdits.length + ' 个文件</span>' +
            '</div>' +
            '<button class="ai-multi-edit-apply-all" onclick="AIChat._applyAllMultiEdit(\'' + cardId + '\')">全部应用</button>' +
            '</div>' +
            '<div class="ai-multi-edit-tabs">' + tabs + '</div>' +
            '<div class="ai-multi-edit-content">' + panels + '</div>' +
            '</div>';
    },

    _switchMultiEditTab(cardId, idx) {
        const card = document.getElementById(cardId);
        if (!card) return;
        card.querySelectorAll('.ai-multi-edit-tab').forEach(function(t, i) { t.classList.toggle('active', i === idx); });
        card.querySelectorAll('.ai-multi-edit-panel').forEach(function(p, i) { p.classList.toggle('active', i === idx); });
    },

    _applyAllMultiEdit(cardId) {
        if (typeof showToast === 'function') showToast('已应用所有编辑', 'success');
    },

    _buildMultiFileEditSummary() {
        if (!this._fileOpsGroupBody) return;
        const tools = this._fileOpsGroupTools || [];
        const edits = [];
        for (let i = 0; i < tools.length; i++) {
            const t = tools[i];
            if (!['str_replace_based_edit_tool', 'json_edit_tool'].includes(t.name)) continue;
            const row = document.getElementById('tool-' + t.id);
            if (!row) continue;
            var args = {};
            try { args = row.dataset.toolArgs ? JSON.parse(row.dataset.toolArgs) : {}; } catch (e) { args = {}; }
            const filePath = args.path || args.file_path || '';
            const oldStr = args.old_str || args.search || '';
            const newStr = args.new_str || args.replace || args.content || '';
            if (filePath) {
                const oldLineCount = (oldStr || '').split('\n').length;
                const newLineCount = (newStr || '').split('\n').length;
                edits.push({ filePath: filePath, addCount: newLineCount, delCount: oldLineCount });
            }
        }
        if (edits.length < 2) return;
        let rows = '';
        for (let j = 0; j < edits.length; j++) {
            const e = edits[j];
            const ef = this._escapeHtml(e.filePath);
            rows += '<div class="ai-multi-edit-file-row">' +
                '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9.5 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5L9.5 1z"/><polyline points="9.5 1 9.5 5.5 13 5.5"/></svg>' +
                '<span>' + ef + '</span>' +
                '<span class="ai-multi-edit-file-add">+' + e.addCount + '</span>' +
                '<span class="ai-multi-edit-file-del">-' + e.delCount + '</span>' +
                '</div>';
        }
        const summary = document.createElement('div');
        summary.className = 'ai-multi-edit-summary';
        summary.innerHTML = rows;
        this._fileOpsGroupBody.appendChild(summary);
    },

    _renderSearchResultCard(query, results, toolName) {
        if (!results || results.length === 0) {
            return `<div class="rc-file-card"><div class="rc-file-card-header"><div class="rc-file-card-info"><span class="rc-file-card-icon">🔍</span><span class="rc-file-card-path">搜索 "${this._escapeHtml(query)}" 无结果</span></div></div></div>`;
        }

        const byFile = new Map();
        for (const r of results) {
            const file = r.file || r.path || r.filename || 'unknown';
            if (!byFile.has(file)) byFile.set(file, []);
            byFile.get(file).push(r);
        }

        let filesHtml = '';
        for (const [file, matches] of byFile) {
            const icon = this._getFileIcon(file);
            const sEscaped = this._escapeHtml(file);
            let matchesHtml = '';
            for (const m of matches.slice(0, 10)) {
                const lineNum = m.line || m.lineNumber || '';
                const text = m.text || m.content || m.match || '';
                matchesHtml += `<div class="rc-search-match">
                    ${lineNum ? `<span class="rc-search-line-num">${lineNum}</span>` : ''}
                    <span class="rc-search-line-text">${this._escapeHtml(String(text))}</span>
                </div>`;
            }
            if (matches.length > 10) {
                matchesHtml += `<div class="rc-search-more">还有 ${matches.length - 10} 个结果...</div>`;
            }
            filesHtml += `<div class="rc-search-file-group">
                <div class="rc-search-file-header"><span class="rc-file-card-icon">${icon}</span><span class="rc-search-file-path clickable" onclick="AIChat._openFileInEditor('${sEscaped.replace(/'/g, "\\'")}')">${sEscaped}</span><span class="rc-search-file-count">${matches.length}</span></div>
                <div class="rc-search-file-matches">${matchesHtml}</div>
            </div>`;
        }

        return `<div class="rc-file-card expanded">
            <div class="rc-file-card-header" onclick="this.parentElement.classList.toggle('expanded')">
                <div class="rc-file-card-info">
                    <span class="rc-file-card-icon">🔍</span>
                    <span class="rc-file-card-path">搜索 "${this._escapeHtml(query)}" — ${results.length} 个结果，${byFile.size} 个文件</span>
                </div>
                <div class="rc-file-card-actions">
                    <svg class="rc-file-card-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
            </div>
            <div class="rc-file-card-body">
                <div class="rc-search-results">${filesHtml}</div>
            </div>
        </div>`;
    },

    _renderVersionSelectCard(parsed, tcId) {
        const purpose = parsed.purpose || '选择版本';
        const versions = parsed.versions || [];
        const selected = parsed.selected;
        if (versions.length === 0) {
            return '<div class="rc-file-card"><div class="rc-file-card-header"><div class="rc-file-card-info"><span class="rc-file-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></span><span class="rc-file-card-path">没有已安装的版本</span></div></div></div>';
        }
        let itemsHtml = '';
        for (let i = 0; i < versions.length; i++) {
            const v = versions[i];
            const loader = v.loader || 'Vanilla';
            const modsCount = v.modsCount || 0;
            const loaderClass = loader === 'Fabric' ? 'fabric' : loader === 'Forge' ? 'forge' : loader === 'NeoForge' ? 'neoforge' : 'vanilla';
            const isSelected = selected && v.id === selected;
            const iconUrl = `/api/version-icon?id=${encodeURIComponent(v.id)}&type=${v.type || 'release'}${v.isForge ? '&forge=true' : ''}${v.isFabric ? '&fabric=true' : ''}${v.isNeoForge ? '&neoforge=true' : ''}${v.isModpack ? '&modpack=true' : ''}`;
            const itemCls = isSelected ? 'ai-version-select-item selected-item' : 'ai-version-select-item';
            const escapedId = this._escapeHtml(v.id).replace(/'/g, "\\'");
            itemsHtml += '<div class="' + itemCls + '" onclick="AIChat._onVersionSelected(\'' + escapedId + '\', \'' + this._escapeHtml(tcId).replace(/'/g, "\\'") + '\')">';
            itemsHtml += '<div class="ai-version-select-icon-wrap"><img src="' + iconUrl + '" alt="" class="ai-version-select-icon-img" onerror="this.style.display=\'none\'"></div>';
            itemsHtml += '<div class="ai-version-select-info">';
            itemsHtml += '<span class="ai-version-select-id">' + this._escapeHtml(v.id) + '</span>';
            itemsHtml += '<span class="ai-version-select-meta">';
            itemsHtml += '<span class="ai-version-select-loader ' + loaderClass + '">' + loader + '</span>';
            if (modsCount > 0) itemsHtml += '<span class="ai-version-select-mods">' + modsCount + ' 模组</span>';
            itemsHtml += '</span></div>';
            if (isSelected) itemsHtml += '<svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="width:16px;height:16px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>';
            itemsHtml += '</div>';
        }
        return '<div class="ai-version-select-card" data-sel-id="' + this._escapeHtml(tcId) + '">' +
            '<div class="ai-version-select-header"><span class="ai-version-select-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></span><span class="ai-version-select-title">' + this._escapeHtml(purpose) + (selected ? ' ✓' : '') + '</span></div>' +
            '<div class="ai-version-select-list">' + itemsHtml + '</div></div>';
    },

    _renderBackupList(backups) {
        if (!backups || backups.length === 0) return '<div class="ai-tool-info">没有找到备份记录</div>';
        const items = backups.map(b => {
            const date = new Date(b.time).toLocaleString('zh-CN');
            const fileName = b.file.split(/[\\/]/).pop();
            const status = b.restored ? '<span style="color:#ffa500">已恢复</span>' : '';
            return '<div class="ai-backup-item" data-backup-id="' + this._escapeHtml(b.id) + '">' +
                '<div class="ai-backup-info">' +
                '<span class="ai-backup-file">' + this._escapeHtml(fileName) + '</span>' +
                '<span class="ai-backup-tool">' + this._escapeHtml(b.tool) + '</span>' +
                '<span class="ai-backup-time">' + date + '</span>' +
                '<span class="ai-backup-lines">' + b.lines + ' 行</span>' +
                status +
                '</div>' +
                '<div class="ai-backup-path">' + this._escapeHtml(b.file) + '</div>' +
                '</div>';
        }).join('');
        return '<div class="ai-backup-list">' + items + '</div>';
    },

    _renderChangeHistory(changes) {
        if (!changes || changes.length === 0) return '<div class="ai-tool-info">没有找到变更记录</div>';
        const items = changes.map(c => {
            const date = new Date(c.timestamp).toLocaleString('zh-CN');
            const fileName = (c.filePath || '').split(/[\\/]/).pop();
            const typeIcon = c.type === 'create' ? '🆕' : c.type === 'overwrite' ? '📝' : '✏️';
            const typeLabel = c.type === 'create' ? '创建' : c.type === 'overwrite' ? '覆写' : '修改';
            return '<div class="ai-history-item">' +
                '<div class="ai-history-info">' +
                '<span class="ai-history-icon">' + typeIcon + '</span>' +
                '<span class="ai-history-file">' + this._escapeHtml(fileName) + '</span>' +
                '<span class="ai-history-type">' + typeLabel + '</span>' +
                '<span class="ai-history-tool">' + this._escapeHtml(c.toolName || '') + '</span>' +
                '<span class="ai-history-time">' + date + '</span>' +
                '</div>' +
                '<div class="ai-history-path">' + this._escapeHtml(c.filePath || '') + '</div>' +
                (c.diff ? '<div class="ai-history-diff"><code>' + this._escapeHtml((c.diff.old || '').substring(0, 100)) + (c.diff.old ? ' → ' : '') + this._escapeHtml((c.diff.new || c.diff.content || '').substring(0, 100)) + '</code></div>' : '') +
                '</div>';
        }).join('');
        return '<div class="ai-history-list">' + items + '</div>';
    },

    _renderAuditLog(logs) {
        if (!logs || logs.length === 0) return '<div class="ai-tool-info">没有找到审计记录</div>';
        const items = logs.map(l => {
            const date = new Date(l.timestamp).toLocaleString('zh-CN');
            const statusIcon = l.success === true ? '✅' : l.success === false ? '❌' : '⏳';
            const statusText = l.success === true ? '成功' : l.success === false ? '失败' : '执行中';
            const elapsed = l.elapsed ? (l.elapsed / 1000).toFixed(1) + 's' : '';
            return '<div class="ai-history-item ' + (l.success === false ? 'error' : '') + '">' +
                '<div class="ai-history-info">' +
                '<span class="ai-history-icon">' + statusIcon + '</span>' +
                '<span class="ai-history-file">' + this._escapeHtml(l.toolName || '') + '</span>' +
                '<span class="ai-history-type">' + statusText + '</span>' +
                '<span class="ai-history-time">' + date + '</span>' +
                (elapsed ? '<span class="ai-history-elapsed">' + elapsed + '</span>' : '') +
                '</div>' +
                (l.error ? '<div class="ai-history-error">' + this._escapeHtml(l.error.substring(0, 150)) + '</div>' : '') +
                '</div>';
        }).join('');
        return '<div class="ai-history-list">' + items + '</div>';
    },

    _renderSessionSummary(summary) {
        const startTime = new Date(summary.startTime).toLocaleString('zh-CN');
        const toolEntries = Object.entries(summary.toolCalls || {}).map(function([name, count]) {
            return '<span class="ai-summary-tag">' + name + ': ' + count + '</span>';
        }).join('');
        const fileEntries = Object.entries(summary.fileChanges || {}).map(function([filePath, count]) {
            const fileName = filePath.split(/[\\/]/).pop();
            return '<span class="ai-summary-tag">' + fileName + ': ' + count + '次</span>';
        }).join('');
        return '<div class="ai-summary-card">' +
            '<div class="ai-summary-header">会话摘要</div>' +
            '<div class="ai-summary-stats">' +
            '<div class="ai-summary-stat"><span class="ai-summary-label">开始时间</span><span>' + startTime + '</span></div>' +
            '<div class="ai-summary-stat"><span class="ai-summary-label">文件变更</span><span>' + summary.totalChanges + '</span></div>' +
            '<div class="ai-summary-stat"><span class="ai-summary-label">工具调用</span><span>' + summary.totalAuditEntries + '</span></div>' +
            '<div class="ai-summary-stat"><span class="ai-summary-label">成功率</span><span>' + summary.successRate + '%</span></div>' +
            '<div class="ai-summary-stat"><span class="ai-summary-label">错误数</span><span style="color:' + (summary.errors > 0 ? '#ef4444' : '#22c55e') + '">' + summary.errors + '</span></div>' +
            '</div>' +
            (toolEntries ? '<div class="ai-summary-section"><div class="ai-summary-section-title">工具使用</div><div class="ai-summary-tags">' + toolEntries + '</div></div>' : '') +
            (fileEntries ? '<div class="ai-summary-section"><div class="ai-summary-section-title">修改文件</div><div class="ai-summary-tags">' + fileEntries + '</div></div>' : '') +
            '</div>';
    },

    _renderSearchResults(data) {
        const items = data.results.map(r => {
            const fileName = r.relativePath.split(/[\\/]/).pop();
            const dirPath = r.relativePath.substring(0, r.relativePath.length - fileName.length);
            return `<div class="ai-search-result">
                <div class="ai-search-result-header">
                    <span class="ai-search-result-rank">#${r.rank}</span>
                    <span class="ai-search-result-score">${r.score}</span>
                    <span class="ai-search-result-file">${fileName}</span>
                    <span class="ai-search-result-ext">${r.extension}</span>
                </div>
                <div class="ai-search-result-path">${dirPath}</div>
                <div class="ai-search-result-snippet">${r.snippet}</div>
            </div>`;
        }).join('');
        return `<div class="ai-search-results">
            <div class="ai-search-header">🔍 语义搜索: "${data.query}" (${data.totalMatches} 匹配)</div>
            <div class="ai-search-tokens">查询词元: ${data.queryTokens.join(', ')}</div>
            ${items}
        </div>`;
    },

    _renderVersionSelectRequest(data) {
        const { selId, purpose, installed } = data;
        if (!this._messagesContainer) return;
        const cardHtml = '<div class="ai-message ai-message-assistant" data-version-sel="' + selId + '">' +
            '<span class="ai-msg-avatar ai-msg-avatar-steve"></span>' +
            '<div class="ai-message-content"><div class="ai-message-text">' +
            '<div class="ai-version-select-card" data-sel-id="' + selId + '">' +
            '<div class="ai-version-select-header"><span class="ai-version-select-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></span><span class="ai-version-select-title">' + this._escapeHtml(purpose) + '</span><span class="ai-version-select-count">' + installed.length + ' 个版本</span></div>' +
            '<div class="ai-version-select-list">' +
            installed.map(v => {
                const loader = v.loader || 'Vanilla';
                const modsCount = v.modsCount || 0;
                const loaderClass = loader === 'Fabric' ? 'fabric' : loader === 'Forge' ? 'forge' : loader === 'NeoForge' ? 'neoforge' : 'vanilla';
                const iconUrl = `/api/version-icon?id=${encodeURIComponent(v.id)}&type=${v.type || 'release'}${v.isForge ? '&forge=true' : ''}${v.isFabric ? '&fabric=true' : ''}${v.isNeoForge ? '&neoforge=true' : ''}${v.isModpack ? '&modpack=true' : ''}`;
                return '<div class="ai-version-select-item" onclick="AIChat._onVersionSelected(\'' + this._escapeHtml(v.id).replace(/'/g, "\\'") + '\', \'' + selId + '\')">' +
                    '<div class="ai-version-select-icon-wrap"><img src="' + iconUrl + '" alt="" class="ai-version-select-icon-img" onerror="this.style.display=\'none\'"></div>' +
                    '<div class="ai-version-select-info"><span class="ai-version-select-id">' + this._escapeHtml(v.id) + '</span>' +
                    '<span class="ai-version-select-meta"><span class="ai-version-select-loader ' + loaderClass + '">' + loader + '</span>' +
                    (modsCount > 0 ? '<span class="ai-version-select-mods">' + modsCount + ' 模组</span>' : '') +
                    '</span></div>' +
                    '<svg class="ai-version-select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="9 18 15 12 9 6"/></svg></div>';
            }).join('') +
            '</div></div></div></div>';
        this._messagesContainer.insertAdjacentHTML('beforeend', cardHtml);
        this._scrollToBottom();
    },

    _onVersionSelected(versionId, selId) {
        if (window.electronAPI?.ai?.selectVersionResponse) {
            window.electronAPI.ai.selectVersionResponse(selId, versionId);
        }
        const card = document.querySelector('.ai-version-select-card[data-sel-id="' + selId + '"]');
        if (!card) return;
        const header = card.querySelector('.ai-version-select-header');
        const list = card.querySelector('.ai-version-select-list');
        if (list) {
            list.style.transition = 'max-height 0.3s ease, opacity 0.2s ease, padding 0.3s ease';
            list.style.maxHeight = list.scrollHeight + 'px';
            list.offsetHeight;
            list.style.maxHeight = '0';
            list.style.opacity = '0';
            list.style.overflow = 'hidden';
            list.style.paddingTop = '0';
            list.style.paddingBottom = '0';
            setTimeout(() => list.remove(), 300);
        }
        if (header) {
            header.innerHTML = '<span class="ai-version-select-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="width:16px;height:16px"><polyline points="20 6 9 17 4 12"/></svg></span><span class="ai-version-select-title" style="color:#22c55e">已选择 ' + this._escapeHtml(versionId) + '</span>';
            header.style.borderBottom = 'none';
        }
        card.style.transition = 'opacity 0.3s ease';
        card.style.opacity = '0.6';
        card.style.pointerEvents = 'none';
        setTimeout(() => {
            const outerMsg = card.closest('[data-version-sel]');
            if (outerMsg) {
                outerMsg.style.transition = 'max-height 0.4s ease, opacity 0.3s ease, margin 0.4s ease, padding 0.4s ease';
                outerMsg.style.maxHeight = outerMsg.scrollHeight + 'px';
                outerMsg.offsetHeight;
                outerMsg.style.maxHeight = '0';
                outerMsg.style.opacity = '0';
                outerMsg.style.overflow = 'hidden';
                outerMsg.style.marginTop = '0';
                outerMsg.style.marginBottom = '0';
                outerMsg.style.paddingTop = '0';
                outerMsg.style.paddingBottom = '0';
                setTimeout(() => outerMsg.remove(), 400);
            }
            const toolContent = card.closest('.ai-file-ops-content');
            if (toolContent) {
                toolContent.style.transition = 'max-height 0.4s ease, opacity 0.3s ease, padding 0.4s ease';
                toolContent.style.maxHeight = '0';
                toolContent.style.opacity = '0';
                toolContent.style.paddingTop = '0';
                toolContent.style.paddingBottom = '0';
                toolContent.classList.remove('open');
                const toolRow = toolContent.previousElementSibling;
                if (toolRow && toolRow.classList.contains('ai-tool-call-row')) {
                    const chevron = toolRow.querySelector('.ai-tool-call-chevron');
                    if (chevron) chevron.classList.remove('open');
                }
            }
        }, 1200);
    },

    _handleAIAddDownloadTask(data) {
        const { sessionId, taskType, taskName, iconUrl, source, targetVersionId,
                mcVersion, loader, projectId, versionId, downloadUrl, fileName } = data;
        if (typeof dlManager !== 'undefined' && dlManager && dlManager.add) {
            dlManager.add(sessionId, taskName || ('下载 ' + taskType), taskType, sessionId, iconUrl || '');
        }

        const startDownload = async () => {
            try {
                let apiUrl, body;
                if (taskType === 'mod') {
                    apiUrl = '/api/mods/download-version';
                    body = { versionId: targetVersionId || versionId || '', projectId: projectId || '', source: source || 'modrinth', fileId: '', gameVersion: mcVersion || '', loader: loader || '', includeDeps: true };
                } else if (taskType === 'modpack') {
                    apiUrl = '/api/modpacks/install';
                    body = { projectId, mcVersion };
                } else if (taskType === 'version') {
                    apiUrl = '/api/install';
                    body = { versionId: mcVersion || projectId };
                } else {
                    apiUrl = '/api/resources/download';
                    body = { projectId, versionId: versionId || '', projectType: taskType === 'texturepack' ? 'resourcepack' : taskType, targetVersionId, source: source || 'modrinth', downloadUrl: downloadUrl || '', fileName: fileName || '' };
                }
                const resp = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                const result = await resp.json();
                let pollSessionId = sessionId;
                if (result.sessionId) {
                    pollSessionId = result.sessionId;
                    if (result.sessionId !== sessionId) {
                        if (typeof dlManager !== 'undefined' && dlManager && dlManager.tasks) {
                            const task = dlManager.tasks.get(sessionId);
                            if (task) { task.sessionId = result.sessionId; dlManager.tasks.delete(sessionId); dlManager.tasks.set(result.sessionId, task); }
                        }
                    }
                }
                if (result.fileName) {
                    if (typeof dlManager !== 'undefined' && dlManager && dlManager.update) {
                        dlManager.update(pollSessionId, { message: result.fileName });
                    }
                }
                const pollFn = async () => {
                    try {
                        const statusApi = taskType === 'version' ? '/api/install/progress' : '/api/mods/download-status';
                        const pollResp = await fetch(statusApi + '?sessionId=' + encodeURIComponent(pollSessionId));
                        if (!pollResp.ok) return;
                        const st = await pollResp.json();
                        if (typeof dlManager !== 'undefined' && dlManager && dlManager.update) {
                            const dlStatus = st.status === 'completed' ? 'completed' : st.status === 'failed' ? 'failed' : 'downloading';
                            dlManager.update(pollSessionId, { progress: st.progress || 0, status: dlStatus, message: st.message || st.currentFile || '下载中...' });
                        }
                        if (st.status === 'completed' || st.status === 'failed') return;
                        setTimeout(pollFn, 500);
                    } catch (e) { setTimeout(pollFn, 1000); }
                };
                setTimeout(pollFn, 500);
            } catch (e) {
                console.error('[AI Download] Start failed:', e);
                if (typeof dlManager !== 'undefined' && dlManager && dlManager.update) {
                    dlManager.update(sessionId, { status: 'failed', message: '启动下载失败: ' + e.message });
                }
            }
        };
        startDownload();
    },

    _openFileInEditor(filePath) {
        if (!filePath) return;
        const editorFrame = document.getElementById('editor-iframe');
        if (editorFrame && editorFrame.contentWindow) {
            editorFrame.contentWindow.postMessage({ type: 'editor:open-file', filePath }, '*');
        }
        const panel = document.getElementById('editor-panel');
        if (panel && !panel.classList.contains('open')) {
            this.toggleEditorPanel();
        }
    },

    _renderCommandCard(command, output, exitCode) {
        const parsed = {};
        try {
            if (typeof output === 'string') {
                const o = JSON.parse(output);
                Object.assign(parsed, o);
            } else if (typeof output === 'object') {
                Object.assign(parsed, output);
            }
        } catch (e) {
            parsed.output = String(output);
        }
        const stdout = parsed.output || parsed.stdout || parsed.result || String(output || '');
        const stderr = parsed.stderr || '';
        const code = exitCode ?? parsed.exitCode ?? parsed.code;
        const success = code === 0 || code === undefined || code === null;
        const lineCount = (stdout.match(/\n/g) || []).length + 1;
        const needsCollapse = lineCount > 10 || stdout.length > 2000;
        const truncatedStdout = needsCollapse ? stdout.split('\n').slice(0, 10).join('\n') : stdout;
        const displayStdout = truncatedStdout.length > 5000 ? truncatedStdout.slice(0, 5000) : truncatedStdout;

        const cmdId = 'cmd-' + Math.random().toString(36).slice(2, 8);
        const escapedCmd = this._escapeHtml(command || '');
        const truncatedCmd = (command || '').length > 60 ? (command || '').slice(0, 60) + '…' : (command || '');

        if (command) {
            this._commandHistory.unshift({
                cmd: command,
                output: stdout || stderr,
                exitCode: code,
                timestamp: Date.now()
            });
            if (this._commandHistory.length > 50) this._commandHistory.length = 50;
        }

        let exitCodeHtml = '';
        if (code !== undefined && code !== null) {
            const exitCls = success ? 'success' : 'error';
            const exitIcon = success
                ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="6"/><polyline points="5.5 8 7.5 10 10.5 6"/></svg>'
                : '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="6"/><line x1="5.5" y1="5.5" x2="10.5" y2="10.5"/><line x1="10.5" y1="5.5" x2="5.5" y2="10.5"/></svg>';
            exitCodeHtml = `<span class="rc-terminal-exit-code ${exitCls}">${exitIcon} 退出码 ${code}</span>`;
        }

        let outputHtml = '';
        if (displayStdout) {
            outputHtml += `<pre class="rc-terminal-output"><span class="rc-terminal-prompt">$</span> ${this._parseAnsiColors(this.escapeHtml(displayStdout))}</pre>`;
        }
        if (stderr && stderr !== stdout) {
            outputHtml += `<pre class="rc-terminal-output rc-terminal-stderr">${this._parseAnsiColors(this.escapeHtml(stderr))}</pre>`;
        }
        if (!stdout && !stderr) outputHtml = '<span class="rc-terminal-empty">(无输出)</span>';

        const collapseId = 'tc-' + Math.random().toString(36).slice(2, 8);
        const expandBtn = needsCollapse ? `<div class="rc-terminal-expand" id="${collapseId}-btn" onclick="event.stopPropagation();const b=document.getElementById('${collapseId}');const f=document.getElementById('${collapseId}-full');const e=document.getElementById('${collapseId}-btn');if(b.style.display==='none'){b.style.display='block';f.style.display='none';e.innerHTML='收起'}else{b.style.display='none';f.style.display='';e.innerHTML='查看全部 ${lineCount} 行'}">查看全部 ${lineCount} 行</div><div class="rc-terminal-full" id="${collapseId}" style="display:none"><pre class="rc-terminal-output"><span class="rc-terminal-prompt">$</span> ${this._parseAnsiColors(this.escapeHtml(stdout.length > 5000 ? stdout.slice(0, 5000) : stdout))}</pre>${stderr && stderr !== stdout ? `<pre class="rc-terminal-output rc-terminal-stderr">${this._parseAnsiColors(this.escapeHtml(stderr))}</pre>` : ''}</div>` : '';

        const runBtnHtml = command ? `<button class="rc-terminal-action-btn" onclick="AIChat._runCommandInTerminal('${this._escapeHtml(command).replace(/'/g, "\\'")}')" title="在终端中运行"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5,3 13,8 5,13"/></svg>在终端中运行</button>` : '';
        const copyBtnHtml = command ? `<button class="rc-terminal-action-btn" onclick="navigator.clipboard.writeText('${this._escapeHtml(command).replace(/'/g, "\\'")}');if(typeof showToast==='function')showToast('命令已复制','success')" title="复制命令"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="6" width="8" height="8" rx="1"/><path d="M2 10V3a1 1 0 0 1 1-1h7"/></svg>复制命令</button>` : '';

        return `<div class="rc-terminal">
            <div class="rc-terminal-header">
                <span class="rc-terminal-title">${escapedCmd ? '<span class="rc-terminal-prompt">$</span> ' + this._escapeHtml(truncatedCmd) : '输出'}</span>
                <div style="display:flex;align-items:center;gap:6px">${exitCodeHtml}</div>
            </div>
            <div class="rc-terminal-body">${outputHtml}</div>
            ${expandBtn}
            <div class="rc-terminal-actions">${runBtnHtml}${copyBtnHtml}</div>
        </div>`;
    },

    startTypewriter(textBlock) {
        this.typewriterTextBlock = textBlock;
        this.displayedLength = 0;
        this.fullTextBuffer = '';
        this.typewriterSpeed = 16;
        this.typewriterBatchSize = 3;
        this._lastRenderLength = 0;
        this._lastRenderTime = 0;
        this._markdownBatchSize = 999999;
        this._plainNode = null;
        this._rAFPending = false;
        this._mdRenderTimer = null;

        if (this.typewriterTimer) {
            clearTimeout(this.typewriterTimer);
            this.typewriterTimer = null;
        }

        if (this._todoThrottleTimer) {
            clearTimeout(this._todoThrottleTimer);
            this._todoThrottleTimer = null;
            this.extractTodosFromStream(this.fullTextBuffer);
        }
    },

    feedTypewriter(newText) {
        this.fullTextBuffer += newText;
        if (!this._todoThrottleTimer) {
            this._todoThrottleTimer = setTimeout(() => {
                this._todoThrottleTimer = null;
                this.extractTodosFromStream(this.fullTextBuffer);
            }, 2000);
        }
        if (!this.typewriterTimer) {
            this.typewriterTimer = setTimeout(() => this.typewriterTick(), 0);
        }
    },

    typewriterTick() {
        if (!this.typewriterTextBlock) {
            this._getOrCreateTextBlock();
        }
        if (this.displayedLength >= this.fullTextBuffer.length) {
            this.typewriterTimer = null;
            if (this.typewriterTextBlock && this.fullTextBuffer) {
                const block = this.typewriterTextBlock;
                this.asyncRenderMarkdown(this.fullTextBuffer, (html) => {
                    if (block) { block.innerHTML = html; this._highlightCodeBlocks(block); }
                });
            }
            return;
        }

        const backlog = this.fullTextBuffer.length - this.displayedLength;

        if (backlog > 500) {
            this.displayedLength = this.fullTextBuffer.length;
            this._scheduleMarkdownRender(true);
            this.scheduleScroll();
            this.typewriterTimer = null;
            return;
        }

        let batchSize = this.typewriterBatchSize;
        let speed = this.typewriterSpeed;

        if (backlog > 200) { batchSize = 30; speed = 32; }
        else if (backlog > 100) { batchSize = 20; speed = 32; }
        else if (backlog > 50) { batchSize = 10; speed = 32; }

        const advance = Math.min(batchSize, backlog);
        this.displayedLength += advance;

        this._scheduleMarkdownRender(false);

        this.scheduleScroll();

        this.typewriterTimer = setTimeout(() => this.typewriterTick(), speed);
    },

    scheduleScroll() {
        if (this._userScrollingUp) return;
        if (!this._rAFPending) {
            this._rAFPending = true;
            requestAnimationFrame(() => {
                this._rAFPending = false;
                if (this._userScrollingUp) return;
                const msgs = this._messagesContainer;
                if (msgs) {
                    const lastChild = msgs.lastElementChild;
                    if (lastChild) {
                        const containerRect = msgs.getBoundingClientRect();
                        const elementRect = lastChild.getBoundingClientRect();
                        const offsetInContainer = elementRect.top - containerRect.top + msgs.scrollTop;
                        msgs.scrollTop = Math.max(0, offsetInContainer - 16);
                    } else {
                        msgs.scrollTop = msgs.scrollHeight;
                    }
                }
            });
        }
    },

    flushTypewriter() {
        console.log(`[AI-FLUSH] timer=${!!this.typewriterTimer} buffer=${this.fullTextBuffer.length} displayed=${this.displayedLength} block=${!!this.typewriterTextBlock}`);
        if (this.typewriterTimer) {
            clearTimeout(this.typewriterTimer);
            this.typewriterTimer = null;
        }
        this.displayedLength = this.fullTextBuffer.length;
        if (!this.typewriterTextBlock && this.fullTextBuffer) this._getOrCreateTextBlock();
        if (this.typewriterTextBlock && this.fullTextBuffer) {
            const block = this.typewriterTextBlock;
            this.asyncRenderMarkdown(this.fullTextBuffer, (html) => {
                if (block) { block.innerHTML = html; this._highlightCodeBlocks(block); }
            });
        }
        this.typewriterTextBlock = null;
        this.fullTextBuffer = '';
        this._lastRenderLength = 0;
        this._lastRenderTime = 0;
        this._plainNode = null;
        this._rAFPending = false;
    },

    _scheduleMarkdownRender(immediate) {
        const now = Date.now();
        if (!immediate && (now - (this._lastRenderTime || 0)) < 200) return;
        this._lastRenderTime = now;
        if (!this.typewriterTextBlock) this._getOrCreateTextBlock();
        if (!this.typewriterTextBlock || !this.fullTextBuffer) return;
        const text = this.fullTextBuffer.slice(0, this.displayedLength);
        const block = this.typewriterTextBlock;
        this.asyncRenderMarkdown(text, (html) => {
            if (block === this.typewriterTextBlock) {
                block.innerHTML = html;
                this._highlightCodeBlocks(block);
            }
        });
    },

    _estimateTokens(text) {
        if (!text) return 0;
        const str = typeof text === 'string' ? text : JSON.stringify(text);
        let tokens = 0;
        for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i);
            if (code > 0x4e00 && code < 0x9fff) tokens += 1.5;
            else if (code > 0x3000 && code < 0x303f) tokens += 1.5;
            else if (code > 0xff00 && code < 0xffef) tokens += 1.5;
            else if (code < 128) tokens += 0.25;
            else tokens += 0.5;
        }
        return Math.ceil(tokens);
    },

    _estimateMsgTokens(msg) {
        let tokens = 4;
        if (msg.role) tokens += 2;
        if (msg.name) tokens += this._estimateTokens(msg.name);
        if (msg.tool_calls) {
            for (const tc of msg.tool_calls) {
                tokens += 4;
                if (tc.function) {
                    tokens += this._estimateTokens(tc.function.name || '');
                    tokens += this._estimateTokens(tc.function.arguments || '');
                }
            }
        }
        if (msg.content) {
            tokens += this._estimateTokens(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));
        }
        return tokens;
    },

    trimMessages(messages, maxTokens) {
        const systemMsgs = [];
        let systemEnd = 0;
        for (let i = 0; i < messages.length; i++) {
            if (messages[i].role === 'system') { systemMsgs.push(messages[i]); systemEnd = i + 1; }
            else break;
        }
        let systemTokens = 0;
        for (const msg of systemMsgs) systemTokens += this._estimateMsgTokens(msg);
        const budget = (maxTokens || 16000) - systemTokens;
        if (budget < 1000) return messages;

        const dialogMsgs = messages.slice(systemEnd);
        const trimmed = [];
        let usedTokens = 0;
        let hasPendingToolCalls = false;
        for (let i = dialogMsgs.length - 1; i >= 0; i--) {
            const msg = dialogMsgs[i];
            const msgTokens = this._estimateMsgTokens(msg);
            if (usedTokens + msgTokens > budget && trimmed.length > 4) break;
            if (hasPendingToolCalls && msg.role === 'assistant' && msg.tool_calls) {
                hasPendingToolCalls = false;
            }
            if (msg.role === 'tool' && trimmed.length > 0) {
                hasPendingToolCalls = true;
            }
            usedTokens += msgTokens;
            trimmed.unshift(msg);
        }
        if (hasPendingToolCalls) {
            while (trimmed.length > 0 && trimmed[0].role === 'tool') {
                trimmed.shift();
            }
        }
        if (trimmed.length < dialogMsgs.length) {
            const dropped = dialogMsgs.length - trimmed.length;
            const usedTools = new Set();
            const errors = [];
            for (const m of dialogMsgs.slice(0, dropped)) {
                if (m.tool_calls) m.tool_calls.forEach(tc => usedTools.add(tc.function.name));
                if (m.role === 'tool' && typeof m.content === 'string') {
                    try { const p = JSON.parse(m.content); if (p.error) errors.push(p.error.slice(0, 60)); } catch (e) {}
                }
            }
            let summary = `[上下文压缩] ${dropped} 条消息已省略`;
            if (usedTools.size) summary += `。使用工具: ${[...usedTools].join(', ')}`;
            if (errors.length) summary += `。错误: ${errors.slice(-2).join('; ')}`;
            const summaryMsg = { role: 'system', content: summary };
            return [...systemMsgs, summaryMsg, ...trimmed];
        }
        return messages;
    },

    async sendMessage(text) {
        if (!text.trim()) return;

        const trimmed = text.trim();

        if (trimmed.startsWith('# ') && !trimmed.startsWith('## ') && !trimmed.startsWith('#!')) {
            const memContent = trimmed.slice(2).trim();
            if (memContent) {
                const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
                if (!this.userMemory) this.userMemory = '';
                this.userMemory += (this.userMemory ? '\n' : '') + `- (${ts}) ${memContent}`;
                this.saveUserMemory();
                if (typeof showToast === 'function') showToast('已保存到记忆', 'success');
            }
            return;
        }

        if (trimmed === '/skills') {
            this._loadAndShowSkills();
            return;
        }

        if (trimmed.startsWith('/skill ')) {
            const skillName = trimmed.slice(7).trim();
            this._activateSkill(skillName);
            return;
        }

        if (trimmed === '/fork') {
            const current = this.getCurrent();
            if (!current) { showToast('没有当前会话', 'error'); return; }
            const forked = {
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                title: `Fork: ${current.title}`,
                messages: JSON.parse(JSON.stringify(current.messages)),
                createdAt: Date.now(),
                folderPath: current.folderPath || null,
                forkedFrom: current.id
            };
            this._conversations.push(forked);
            this.saveConversations();
            this.switchTo(forked.id);
            showToast('会话已分叉', 'success');
            return;
        }

        if (trimmed.startsWith('/review')) {
            const target = trimmed.slice(7).trim();
            const reviewPrompt = target
                ? `请对以下目标进行结构化代码审查：${target}\n\n请以只读方式审查，输出格式：\n1. 问题分类（按严重性排序）\n2. 每个问题：严重性评分(1-10)、文件路径:行号、问题描述、修复建议\n3. 总体评价和风险点`
                : '请对当前项目进行结构化代码审查。以只读方式审查，输出格式：\n1. 问题分类（按严重性排序）\n2. 每个问题：严重性评分(1-10)、文件路径:行号、问题描述、修复建议\n3. 总体评价和风险点';
            text = reviewPrompt;
        }

        if (trimmed === '/compact') {
            this._manualCompact();
            return;
        }

        if (trimmed.startsWith('/goal')) {
            const parts = trimmed.split(/\s+/);
            const action = parts[1] || 'set';
            const rest = parts.slice(2).join(' ');
            this._handleGoalCommand(action, rest);
            return;
        }

        if (trimmed === '/relay') {
            const current = this.getCurrent();
            if (!current || !current.messages.length) {
                showToast('当前没有对话历史', 'error');
                return;
            }
            const userMsgs = current.messages.filter(m => m.role === 'user').map(m => m.content).slice(-5);
            const assistantMsgs = current.messages.filter(m => m.role === 'assistant').map(m => m.content).slice(-3);
            const relay = `# Session Relay\n## 会话: ${current.title}\n## 最近用户请求:\n${userMsgs.map((m, i) => `${i + 1}. ${m.slice(0, 200)}`).join('\n')}\n## 最近AI回复摘要:\n${assistantMsgs.map((m, i) => `${i + 1}. ${m.slice(0, 300)}`).join('\n')}\n## 时间: ${new Date().toISOString()}`;
            try { localStorage.setItem('versepc_ai_relay', JSON.stringify({ content: relay, timestamp: Date.now(), fromTitle: current.title })); } catch (e) {}
            this._addSystemMessage('接力文档已生成，将在下次新建会话时自动注入');
            return;
        }

        if (trimmed === '/restore' || trimmed.startsWith('/restore ')) {
            await this._handleRestoreCommand(text.trim());
            return;
        }

        if (text.trim() === '/doctor' || text.trim().startsWith('/doctor ')) {
            await this._handleDoctorCommand(text.trim());
            return;
        }

        if (this.isGenerating) {
            console.warn('[AIChat] isGenerating stuck, force stopping');
            this.stopGenerationForce();
            await new Promise(r => setTimeout(r, 100));
        }

        let model = this.model;
        let temp = this.temperature;
        try { model = await window.electronAPI.store.get('versepc_ai_model') || this.model; } catch (e) {}
        try { temp = parseFloat(await window.electronAPI.store.get('versepc_ai_temp')); } catch (e) {}
        model = model || null;
        temp = isNaN(temp) ? 0.7 : temp;

        if (!model) {
            showToast('请先选择一个模型', 'error');
            return;
        }

        const recommended = this.getRecommendedModel(text);
        if (recommended && recommended.modelId !== model) {
            this._showModelRecommendation(model, recommended.modelId);
        }

        let apiKey = this.apiKey;
        let apiFormat = '';
        let customBaseUrl = '';
        const addedEntry = this.addedModels.find(m => m.modelId === model);
        if (addedEntry) {
            apiKey = addedEntry.apiKey;
            apiFormat = addedEntry.apiFormat || '';
            customBaseUrl = addedEntry.baseUrl || '';
        }
        if (!apiKey) {
            try { apiKey = await window.electronAPI.store.get('versepc_ai_api_key'); } catch (e) {}
        }
        if (!apiKey) {
            if (typeof showToast === 'function') showToast('请先在设置中添加 API Key', 'error');
            return;
        }

        const conv = this.getCurrent();
        if (!conv) return;

        let messageContent = text;
        if (this._referencedFiles && this._referencedFiles.length > 0) {
            let refParts = '';
            for (const ref of this._referencedFiles) {
                try {
                    const readResult = await window.electronAPI.ai.executeTool('read_file', JSON.stringify({ file_path: ref.path }));
                    const content = typeof readResult === 'string' ? readResult : (readResult.content || readResult.output || '');
                    refParts += `\n\n[引用文件: ${ref.name}]\n\`\`\`\n${content}\n\`\`\``;
                } catch (e) {
                    refParts += `\n\n[引用文件: ${ref.name}] (读取失败)`;
                }
            }
            messageContent = refParts + '\n\n' + messageContent;
            this._referencedFiles = [];
            this._renderReferencedFilesBar();
        }
        conv.messages.push({ role: 'user', content: messageContent });
        const MAX_CONV_MSGS = 50;
        if (conv.messages.length > MAX_CONV_MSGS) {
            let trimStart = conv.messages.length - MAX_CONV_MSGS;
            while (trimStart > 0 && trimStart < conv.messages.length) {
                const msg = conv.messages[trimStart];
                if (msg.role === 'tool') { trimStart++; continue; }
                if (msg.role === 'assistant' && msg.tool_calls) { trimStart++; continue; }
                break;
            }
            conv.messages = conv.messages.slice(trimStart);
        }
        if (conv.title === '新对话') {
            conv.title = text.slice(0, 30).replace(/\n/g, ' ');
        }

        if (document.getElementById('ai-welcome').style.display !== 'none') {
            this.showMessages([]);
        }

        const userMsgEl = this.appendMessage('user', text);
        setTimeout(() => {
            const msgs = this._messagesContainer;
            if (msgs && msgs.lastElementChild) {
                this.scrollToNewContent(msgs.lastElementChild);
            }
        }, 50);
        this.renderSidebar();

        document.getElementById('ai-input').value = '';
        aiAutoResize(document.getElementById('ai-input'));

        this._saveTodos();
        this.isGenerating = true;
        this._userScrollingUp = false;
        this._lastChunkTime = Date.now();
        this._generationSeq = (this._generationSeq || 0) + 1;
        this._sessionUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, rounds: 0, estimatedCost: 0 };
        this._updateTokenUsageUI();
        this._startWatchdog();
        this.updateSendButton(true);
        this.clearFollowUpSuggestions();
        this.currentToolCalls = [];
        this._closeFileOpsGroup();
        this._closeCurrentTaskGroup();
        this._taskGroups = {};

        this._streamWorkflowContent = this.createWorkflowBubble();
        this.currentWorkflowContent = this._streamWorkflowContent;
        this._streamTextBlock = null;
        this._streamFullResponse = '';

        this.updateTodoBar();

        this._safetyTimeout = null;

        if (this.chunkListener) {
            try { this.chunkListener(); } catch (e) {}
            this.chunkListener = null;
        }

        if (window.electronAPI?.editor?.onShowDiff && !this._onShowDiffRegistered) {
            this._onShowDiffRegistered = true;
            window.electronAPI.editor.onShowDiff((filePath, original, modified) => {
                const iframe = document.getElementById('editor-iframe');
                if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage({ type: 'editor:show-diff', filePath, original, modified }, '*');
                }
                if (!_editorPanelOpen) toggleEditorPanel();
                const name = filePath.split(/[\\/]/).pop();
                showEditorToast(`AI 修改了 ${name}`, 3000);
            });
        }
        if (window.electronAPI && window.electronAPI.onPreviewOpen && !this._onPreviewRegistered) {
            this._onPreviewRegistered = true;
            window.electronAPI.onPreviewOpen((url) => { openPreview(url); });
            window.electronAPI.onPreviewClose(() => { closePreview(); });
        }

        this.chunkListener = window.electronAPI.ai.onChunk((data) => {
            this._lastChunkTime = Date.now();
            if (data._genSeq && data._genSeq !== this._generationSeq) return;
            if (data.type === 'heartbeat') {
                console.log(`[AI-CHUNK] heartbeat received, watchdog reset`);
                return;
            }
            const preview = data.content ? data.content.slice(0, 40) : data.text ? String(data.text).slice(0, 40) : '';
            const errPreview = data.error ? String(data.error).slice(0, 120) : '';
            console.log(`[AI-CHUNK] type=${data.type || '-'} done=${!!data.done} err=${errPreview ? '"' + errPreview + '"' : '-'} content=${preview ? '"' + preview + '"' : '-'}`);
            if (data.error) {
                console.error(`[AI-CHUNK-ERROR] ${data.error}`);
            }
            if (data.type === 'reasoning_content') {
                this._chunkQueue.push(data);
                this._startScheduler();
                return;
            }
            if (data.done || data.error || data.type === 'reasoning_start' || data.type === 'reasoning_end' || data.type === 'tool_calls_start' || data.type === 'tool_calls_end') {
                const logType = data.done ? 'DONE' : data.error ? 'ERROR' : data.type;
                console.log(`[AI-CHUNK] ${logType}`);
            }
            if (data.done || data.error) {
                this._stopScheduler();
                this._chunkQueue.push(data);
                this._drainChunkQueue();
                return;
            }
            this._chunkQueue.push(data);
            this._startScheduler();
        });

        try {
            const _langMap = { 'zh-CN': '简体中文', 'zh-TW': '繁體中文', 'en': 'English', 'ja': '日本語', 'ko': '한국어' };
            const _langName = _langMap[this._language] || '简体中文';
            const _langRule = this._language === 'en' ? '' : `\n\n## Language\nIMPORTANT: You MUST respond in ${_langName}. All your explanations, plan descriptions, todo items, and completion summaries MUST be written in ${_langName}. Technical terms, code, and file paths should remain as-is.`;
            const _customPrompt = this._promptSettings && this._promptSettings.systemPrompt ? `\n\n## Custom Instructions\n${this._promptSettings.systemPrompt}` : '';
            const _modeRule = (() => {
                const activeBtn = document.querySelector('.rc-mode-btn.rc-mode-btn-active');
                const currentMode = activeBtn ? activeBtn.dataset.mode : 'plan';
                if (currentMode === 'plan') {
                    return `\n\n## Mode: Plan (只读探索模式)\n你当前处于 Plan 模式。在此模式下，你只能使用只读工具进行探索和分析，不能执行任何修改操作。\n允许的工具：read_file, grep_search, glob_search, web_search, web_fetch, web_search_general, get_versions, get_installed_mods, get_game_status, search_mods, browse_directory, select_version, get_game_log, diagnose_crash, get_system_info, explore_environment, build_index, semantic_search, index_stats, sequential_thinking, attempt_completion, ask_user, manage_core_memory, update_todo_list, view_history, validate_code, ckg, sub_agent_dispatch, search_translation_dict\n禁止的工具：write_file, edit_file, bash, execute_command, install_mod, toggle_mod, install_version, install_loader, launch_game, stop_game, manage_settings, translate_mod, install_modpack, agent, str_replace_based_edit_tool, json_edit_tool, download_cfpa_pack, extract_builtin_translations, download_modpack_translation, start_preview, manage_processes, undo_edit, add_download_task\n当用户请求修改操作时，提醒他们切换到 Agent 或 Developer 模式。\n输出结构化计划：目标、上下文、关键文件、约束、建议方案、验证计划、风险点。\n禁止在信息收集和计划阶段调用 attempt_completion 结束对话。完成分析后必须以文本向用户展示你的发现和计划，等待用户确认后再继续。\n\n**完成时机规则（Plan模式）**: 完成信息收集后，你必须以文本向用户展示分析结果和计划，等待用户确认后才可结束。绝对禁止在Plan模式下调用 attempt_completion 来静默结束对话。你的最后一次回复必须是向用户展示你的发现和下一步建议。`;
                }
                if (currentMode === 'agent') {
                    return `\n\n## Mode: Agent (标准工作模式)\n当前用户处于 Agent 模式。你可以访问 ~/.versepc/versions/ 以及用户已添加的外部版本文件夹。如果用户要求访问其他外部路径，提醒他们切换到 Developer 模式。`;
                }
                return '';
            })();
            const _devToolsRule = (() => {
                const activeBtn = document.querySelector('.rc-mode-btn.rc-mode-btn-active');
                const currentMode = activeBtn ? activeBtn.dataset.mode : 'plan';
                if (currentMode !== 'dev') return '';
                return `\n\n## 模组开发工具 (开发者模式可用)\n- check_dev_environment: 检查开发环境（JDK/Gradle/MDK），在使用其他开发工具前应先调用\n- install_dev_tools: 安装缺失的JDK/Gradle/模板\n- init_mod_project: 初始化新模组项目(fabric/forge/neoforge)\n- build_mod: 用Gradle编译模组项目\n- create_datapack: 创建数据包（配方/战利品表/标签/进度）\n- create_resourcepack: 创建资源包（模型/纹理/语言文件）\n- mod_compile_and_install: 一键编译并安装到指定版本\n\n### 生成模组流程:\n1. 判断需求复杂度：简单需求（配方/战利品表/标签/进度）优先用数据包\n2. 数据包路径: create_datapack → 写入 ~/.versepc/versions/{版本ID}/datapacks/\n3. 完整模组: check_dev_environment → init_mod_project → 用 str_replace_based_edit_tool 编写代码 → build_mod → 安装\n4. 模组开发文档: https://fabricmc.net/wiki/ 或 https://docs.neoforged.net/\n\n### 完成时机规则:\n- 禁止在制定计划后立即调用 attempt_completion 结束对话\n- 完成信息收集后，必须以文本向用户展示发现和下一步计划，等待用户反馈\n- 只有在用户明确确认，或所有操作已执行完毕并验证后，才可调用 attempt_completion\n\n### 版本选择规则:\n- 需要用户选择版本时，必须调用 select_version 工具弹出可视化版本选择卡片\n- 禁止使用 ask_user 列出版本名称让用户打字选择\n- select_version 返回后直接使用 selected 版本信息，不再二次询问`;
            })();
            const sysPrompt = `You are VersePC Coder, a coding agent specialized in Minecraft launcher development.
${_langRule}${_customPrompt}${_modeRule}${_devToolsRule}${this._goal && this._goal.status === 'active' ? `\n\n## Current Goal\n${this._goal.description}\n请围绕此目标展开工作。` : ''}${this._activeSkill ? `\n\n## Active Skill: ${this._activeSkill.name}\n${this._activeSkill.content}` : ''}

${this.userMemory ? `## User Preferences
${this.userMemory}

` : ''}${this._persistentMemory && this._persistentMemory.length > 0 ? `## 用户记忆（跨会话持久化）
${this._persistentMemory.map(m => `- ${m}`).join('\n')}

` : ''}## Core Principle

Analyze intent before acting:

**Respond directly** (no tools): Minecraft mechanics, mod explanations, commands, recommendations, general knowledge.

**Use tools** (when action is needed): file ops, command execution, mod/version management, system configuration.

## Environment
- OS: ${navigator.platform || 'Windows'}
- Tools: bash, str_replace_based_edit_tool, json_edit_tool, sequential_thinking, attempt_completion, ckg, update_todo_list, sub_agent_dispatch, get_versions, get_current_context, select_version, explore_environment, search_mods, get_installed_mods, install_mod, toggle_mod, add_download_task, get_download_status, search_modpacks, install_modpack
- IMPORTANT: When you need to search files, analyze code, search resources, or analyze crash logs, you MUST call sub_agent_dispatch tool. Do NOT describe these actions in text - actually call the tool.
- Versions dir: ~/.versepc/versions/
- Mods dir: ~/.versepc/mods (shared) or ~/.versepc/versions/{id}/mods (per-version)
- Resourcepacks dir: ~/.versepc/versions/{id}/resourcepacks/ (版本隔离) or ~/.versepc/resourcepacks/
- Shaderpacks dir: ~/.versepc/versions/{id}/shaderpacks/ (版本隔离) or ~/.versepc/shaderpacks/
- Always call get_versions(installedOnly:true) when working with versions
- Use get_current_context to see current selected version
- When user asks to install/change/select a version, or when you need to know which version to operate on, use select_version tool to show a version selection card. The user will pick one from the card, then you continue with their choice.
- NEVER assume which version the user wants. Always use select_version to let them choose.
- **NEVER use ask_user to ask about version selection.** ask_user is ONLY for simple yes/no questions or brief clarifications. For ANY version/mod selection scenario, ALWAYS use select_version tool which shows a visual selection card.
- **资源安装流程**: 当用户要求安装模组/光影包/资源包/材质包时，遵循以下步骤:
  1. 搜索资源 (search_mods 或 web_search)
  2. 调用 select_version 让用户选择目标版本（版本选择卡片是唯一的版本选择方式）
  3. 用 add_download_task 将下载任务添加到下载管理页面（传入 targetVersionId 为用户选择的版本）
  4. 用 get_download_status 查询进度并告知用户
  taskType 映射: mod=模组, shader=光影包, resourcepack=资源包, texturepack=材质包, modpack=整合包, version=游戏版本
- **重要**: select_version 版本选择卡片是唯一的版本选择方式。select_version 返回后，直接使用返回的 selected 版本信息。绝对不要在 select_version 之后再用 ask_user 询问版本选择。
- **下载任务由下载管理页面处理，AI页面不会显示下载进度条**

## Tool Guidelines
1. Only call tools for actual system actions — never to "verify" known info.
2. Knowledge questions → answer directly in Markdown, no tools.
3. file_path must be absolute paths.
4. Confirm success or handle failure before proceeding.

## Error Strategy
- 1st fail → check params, retry
- 2nd fail → alternative approach
- 3rd fail → report progress, suggest alternatives
- "denied" → find alternative, don't repeat

## Task Management

You MUST use update_todo_list for ANY task that involves tool calls (file ops, code changes, command execution, etc.).

**Always create tasks when:** user requests any action that requires tools — code changes, file operations, installations, debugging, analysis, etc.
**Skip only for:** pure greetings ("你好"), simple factual questions with no tool usage needed.

**Format:**
- [ ] Task description
- [-] In progress
- [x] Completed

**Workflow:**
1. First: Call update_todo_list with ALL steps decomposed from the user's request
2. Mark current task as [-], execute it, mark as [x] when done
3. Move to next task, repeat
4. Call attempt_completion when ALL tasks are done

## Rules
1. No tools for known info — answer directly.
2. No file/command ops without explicit user request.
3. **ask_user 禁止用于版本/模组选择**: 当需要用户选择版本或模组时，必须使用 select_version 工具。ask_user 仅用于简单的确认问题或简短澄清。
4. Never say "I cannot" without trying 2+ approaches.
5. Never end completion with a question.
6. Skip pleasantries — get straight to the point.
7. Use Markdown formatting.
8. Use str_replace_based_edit_tool for precise code edits.

## File Operations
- Verify content before modifying (str_replace view)
- old_str must match exactly (including whitespace)
- Prefer precise edits over creating new files

## Safety
- No dangerous commands (rm -rf, format, dd)
- No system-critical file modifications
- Unsafe requests → explain + suggest alternatives

## Completion
Call attempt_completion ONLY when ALL of these conditions are met: (1) all planned operations are executed and verified, AND (2) you have already presented results/progress to the user in your text response, AND (3) the task has no remaining steps that need user input.
- result field MUST contain a clear Chinese summary: what was done, current status, next steps
- NEVER leave result empty — it IS the final reply shown to the user
- NEVER call attempt_completion to end a conversation prematurely — instead, present your findings and ask the user what to do next
- If you just created a plan or analyzed something, you MUST show the results to the user and wait for their feedback. Do NOT call attempt_completion at this point.`;
                const rawMessages = [{ role: 'system', content: sysPrompt }, ...conv.messages.map(m => {
                    if (m.content && typeof m.content !== 'string') {
                        try { m = { ...m, content: JSON.stringify(m.content) }; } catch (e) { m = { ...m, content: String(m.content) }; }
                    }
                    return m;
                })];
                const allMessages = this.trimMessages(rawMessages, 20000);
                window.electronAPI.ai.chatStream({
                    apiKey,
                    model,
                    messages: allMessages,
                    temperature: temp,
                    enableTools: true,
                    apiFormat,
                    baseUrl: customBaseUrl,
                    language: this._language || 'zh-CN',
                    projectDir: this._currentFolderPath || null,
                    currentMode: (() => { const btn = document.querySelector('.rc-mode-btn.rc-mode-btn-active'); return btn ? btn.dataset.mode : 'plan'; })(),
                    approvalMode: (() => { try { return window.electronAPI._approvalMode || 'suggest'; } catch(e) { return 'suggest'; } })()
                });

                this._fallbackTimeout = setTimeout(() => {
                    if (this.isGenerating) {
                        console.warn('[AIChat] Fallback timeout: forcing stop after 600s (10 min safety net)');
                        this.stopGenerationForce();
                    }
                }, 600000);
        } catch (e) {
            this.flushTypewriter();
            const errBlock = this._getOrCreateTextBlock();
            if (errBlock) {
                this._renderErrorCard(errBlock, e.message || '请求失败');
            }
            this.stopGeneration(e.message || '请求失败', true);
        }
    },

    async _handleRestoreCommand(text) {
        const input = document.getElementById('ai-input');
        if (input) { input.value = ''; aiAutoResize(input); }

        const conv = this.getCurrent();
        if (conv) {
            conv.messages.push({ role: 'user', content: text });
        }

        const userMsgEl = this.appendMessage('user', text);

        const arg = text.replace(/^\/restore\s*/, '').trim();

        if (arg === 'help' || arg === '?') {
            this.appendMessage('assistant', `**/restore 命令用法：**\n\n- \`/restore\` — 显示快照列表并选择恢复\n- \`/restore <文件路径>\` — 显示指定文件的快照\n- \`/restore help\` — 显示此帮助`);
            return;
        }

        try {
            const snapshots = await window.electronAPI.backup.list(arg || null);

            if (!snapshots || snapshots.length === 0) {
                this.appendMessage('assistant', arg
                    ? `未找到文件 \`${arg}\` 的快照。`
                    : '当前没有可用的快照。AI 在修改文件时会自动创建快照。');
                return;
            }

            this._showRestoreModal(snapshots);
        } catch (e) {
            this.appendMessage('assistant', `获取快照列表失败: ${e.message}`);
        }
    },

    _showRestoreModal(snapshots) {
        let existing = document.getElementById('ai-restore-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ai-restore-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:var(--bg-primary,#1a1a2e);border:1px solid var(--border-color,#2a2a4a);border-radius:12px;width:560px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.4);';

        const header = document.createElement('div');
        header.style.cssText = 'padding:16px 20px;border-bottom:1px solid var(--border-color,#2a2a4a);display:flex;align-items:center;justify-content:space-between;';
        header.innerHTML = `<span style="font-size:15px;font-weight:600;color:var(--text-primary,#e0e0e0)">📸 快照恢复 <span style="font-size:12px;font-weight:400;color:var(--text-secondary,#888);margin-left:8px">${snapshots.length} 个可用</span></span><button id="ai-restore-close" style="background:none;border:none;color:var(--text-secondary,#888);cursor:pointer;font-size:18px;padding:4px 8px;">✕</button>`;

        const body = document.createElement('div');
        body.style.cssText = 'overflow-y:auto;padding:8px;flex:1;';

        for (const snap of snapshots) {
            const item = document.createElement('div');
            item.style.cssText = 'padding:10px 12px;border-radius:8px;cursor:pointer;display:flex;flex-direction:column;gap:4px;transition:background 0.15s;';
            item.onmouseenter = () => item.style.background = 'var(--bg-hover,rgba(255,255,255,0.05))';
            item.onmouseleave = () => item.style.background = 'transparent';

            const fileName = snap.originalPath.split(/[\\/]/).pop();
            const dirPath = snap.originalPath.replace(/[\\/][^\\/]+$/, '');
            const timeStr = new Date(snap.timestamp).toLocaleString('zh-CN');
            const toolDisplay = TOOL_DISPLAY_NAMES[snap.toolName] || snap.toolName;
            const statusDot = snap.restored
                ? '<span style="color:var(--ai-success,#4caf50);font-size:11px;">● 已恢复</span>'
                : '<span style="color:var(--ai-info,#2196f3);font-size:11px;">● 可恢复</span>';

            item.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span style="font-weight:500;color:var(--text-primary,#e0e0e0);font-size:13px;">${this.escapeHtml(fileName)}</span>
                    ${statusDot}
                </div>
                <div style="font-size:11px;color:var(--text-secondary,#888);display:flex;gap:12px;">
                    <span>📂 ${this.escapeHtml(dirPath)}</span>
                    <span>🔧 ${this.escapeHtml(toolDisplay)}</span>
                    <span>🕐 ${timeStr}</span>
                </div>`;

            item.addEventListener('click', async () => {
                if (snap.restored) {
                    const confirmRe = confirm('此快照已被恢复过，确定要再次恢复吗？');
                    if (!confirmRe) return;
                }
                try {
                    const result = await window.electronAPI.backup.restore(snap.id);
                    if (result.success) {
                        overlay.remove();
                        this.appendMessage('assistant', `✅ 已恢复文件 \`${result.restoredPath}\` 到快照版本。`);
                    } else {
                        this.appendMessage('assistant', `❌ 恢复失败: ${result.error}`);
                    }
                } catch (e) {
                    this.appendMessage('assistant', `❌ 恢复失败: ${e.message}`);
                }
            });

            body.appendChild(item);
        }

        const footer = document.createElement('div');
        footer.style.cssText = 'padding:12px 20px;border-top:1px solid var(--border-color,#2a2a4a);text-align:center;';
        footer.innerHTML = '<span style="font-size:11px;color:var(--text-secondary,#666);">点击快照条目即可恢复文件到修改前的版本</span>';

        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const closeModal = () => overlay.remove();
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
        document.getElementById('ai-restore-close').addEventListener('click', closeModal);
        document.addEventListener('keydown', function onKey(e) {
            if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', onKey); }
        });
    },

    _manualCompact() {
        const current = this.getCurrent();
        if (!current || !current.messages || current.messages.length < 2) {
            showToast('对话内容过少，无需压缩', 'error');
            return;
        }
        const messages = current.messages;
        const totalChars = messages.reduce((sum, m) => sum + (m.content || '').length, 0);
        const mid = Math.floor(messages.length / 2);
        const oldMsgs = messages.slice(0, mid);
        const recentMsgs = messages.slice(mid);
        const summary = oldMsgs.map(m => {
            const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'AI' : 'System';
            const content = (m.content || '').slice(0, 200);
            return `[${role}]: ${content}`;
        }).join('\n');
        const summaryMsg = {
            role: 'system',
            content: `[Context Summary]\nPrevious conversation:\n${summary}`,
            timestamp: Date.now(),
            isCompacted: true
        };
        current.messages = [summaryMsg, ...recentMsgs];
        this.saveConversations();
        this._renderMessages();
        const savedTokens = Math.round(totalChars * 0.3 / 4);
        showToast(`上下文已压缩，释放约 ${savedTokens} tokens`, 'success');
    },

    _handleGoalCommand(action, content) {
        switch (action) {
            case 'set':
                if (!content) { showToast('用法: /goal set <目标描述>', 'error'); return; }
                this._goal = { description: content, status: 'active', createdAt: Date.now(), budget: null, consumed: 0 };
                showToast(`目标已设置: ${content}`, 'success');
                this._renderGoalPanel();
                break;
            case 'pause':
                if (this._goal) { this._goal.status = 'paused'; showToast('目标已暂停', 'success'); this._renderGoalPanel(); }
                break;
            case 'resume':
                if (this._goal) { this._goal.status = 'active'; showToast('目标已恢复', 'success'); this._renderGoalPanel(); }
                break;
            case 'complete':
                if (this._goal) { this._goal.status = 'complete'; showToast('目标已完成', 'success'); this._renderGoalPanel(); }
                break;
            case 'blocked':
                if (this._goal) { this._goal.status = 'blocked'; showToast('目标已标记为阻塞', 'success'); this._renderGoalPanel(); }
                break;
            case 'clear':
                this._goal = null;
                showToast('目标已清除', 'success');
                this._renderGoalPanel();
                break;
            default:
                showToast('可用: /goal set <描述>, /goal pause, /goal resume, /goal complete, /goal blocked, /goal clear', 'info');
        }
    },

    _renderGoalPanel() {
        const el = document.getElementById('ai-side-todo-list');
        if (!el) return;
        if (!this._goal) {
            el.innerHTML = '<div style="color:var(--text-secondary);font-size:12px;padding:8px;text-align:center">暂无目标。使用 /goal set <描述> 设置</div>';
            return;
        }
        const statusColors = { active: '#4caf50', paused: '#ff9800', complete: '#2196f3', blocked: '#f44336' };
        const statusLabels = { active: '进行中', paused: '已暂停', complete: '已完成', blocked: '已阻塞' };
        const color = statusColors[this._goal.status] || '#999';
        const label = statusLabels[this._goal.status] || this._goal.status;
        el.innerHTML = `<div style="padding:8px"><div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="width:8px;height:8px;border-radius:50%;background:${color}"></span><span style="font-size:13px;font-weight:500">${label}</span></div><div style="font-size:12px;color:var(--text-secondary);line-height:1.5">${this._goal.description}</div></div>`;
    },

    async _loadAndShowSkills() {
        try {
            const skills = await window.electronAPI.invoke('skills:list') || [];
            if (skills.length === 0) {
                this._addSystemMessage('暂无已安装的 Skills。将 SKILL.md 文件放入 ~/.versepc/skills/ 目录即可安装。');
                return;
            }
            const list = skills.map((s, i) => `${i + 1}. **${s.name}** - ${s.description || '无描述'}`).join('\n');
            this._addSystemMessage(`已安装的 Skills:\n${list}\n\n使用 /skill <名称> 激活`);
        } catch (e) {
            this._addSystemMessage('Skills 加载失败: ' + e.message);
        }
    },

    async _activateSkill(name) {
        try {
            const skill = await window.electronAPI.invoke('skills:get', name);
            if (!skill || !skill.content) {
                showToast(`Skill "${name}" 未找到`, 'error');
                return;
            }
            this._activeSkill = { name: skill.name, content: skill.content };
            showToast(`Skill "${skill.name}" 已激活`, 'success');
            this._addSystemMessage(`Skill "${skill.name}" 已激活，后续对话将遵循此 Skill 的工作流程。`);
        } catch (e) {
            showToast('Skill 激活失败: ' + e.message, 'error');
        }
    },

    async _handleDoctorCommand(text) {
        const results = [];
        const addResult = (status, label, detail) => results.push({ status, label, detail });

        addResult('info', 'AI 系统诊断', '正在检查各项配置...');

        try {
            const model = await window.electronAPI.store.get('versepc_ai_model');
            if (model) {
                addResult('pass', '当前模型', model);
            } else {
                addResult('warn', '当前模型', '未选择模型，请在设置中选择');
            }
        } catch (e) {
            addResult('fail', '当前模型', '读取失败: ' + e.message);
        }

        const providers = ['deepseek', 'openai', 'anthropic', 'google', 'zhipu', 'qwen', 'moonshot', 'siliconflow', 'openrouter'];
        let hasKey = false;
        for (const p of providers) {
            try {
                const key = await window.electronAPI.store.get(`versepc_ai_key_${p}`);
                if (key) {
                    hasKey = true;
                    addResult('pass', `API Key: ${p}`, '已配置');
                }
            } catch (_) {}
        }
        if (!hasKey) {
            addResult('warn', 'API Key', '未配置任何 Provider 的 API Key');
        }

        try {
            await window.electronAPI.store.set('_doctor_test', Date.now());
            const val = await window.electronAPI.store.get('_doctor_test');
            if (val) {
                addResult('pass', '存储空间', '读写正常');
            } else {
                addResult('fail', '存储空间', '写入后读取失败');
            }
        } catch (e) {
            addResult('fail', '存储空间', '存储异常: ' + e.message);
        }

        try {
            const added = await window.electronAPI.store.get('versepc_ai_added_models');
            const count = Array.isArray(added) ? added.length : 0;
            addResult('info', '已添加模型', `${count} 个`);
        } catch (_) {
            addResult('info', '已添加模型', '无法读取');
        }

        try {
            const mem = await window.electronAPI.store.get('versepc_ai_persistent_memory');
            const count = Array.isArray(mem) ? mem.length : 0;
            addResult('info', '持久化记忆', `${count} 条`);
        } catch (_) {
            addResult('info', '持久化记忆', '无法读取');
        }

        const iconMap = { pass: '✅', warn: '⚠️', fail: '❌', info: 'ℹ️' };
        const lines = results.map(r => `${iconMap[r.status]} **${r.label}**: ${r.detail}`);
        this.appendMessage('assistant', `## 🔍 AI 系统诊断报告\n\n${lines.join('\n')}`);
    },

    _cleanupGenerationState() {
        if (this.chunkListener) {
            try { this.chunkListener(); } catch (e) {}
            this.chunkListener = null;
        }

        const clearTimer = (name) => {
            if (this[name]) {
                try { clearInterval(this[name]); } catch (e) {}
                try { clearTimeout(this[name]); } catch (e) {}
                this[name] = null;
            }
        };
        const cancelRAF = (name) => {
            if (this[name]) {
                try { cancelAnimationFrame(this[name]); } catch (e) {}
                this[name] = null;
            }
        };

        clearTimer('typewriterTimer');
        clearTimer('_todoThrottleTimer');
        clearTimer('_reasoningTimer');
        cancelRAF('_reasoningRAF');
        clearTimer('_watchdogTimer');
        clearTimer('_mdRenderTimer');
        clearTimer('_thinkingChainTimer');
        cancelRAF('_toolResultRAF');

        if (this._scrollTimer) {
            try { clearTimeout(this._scrollTimer); } catch (e) {}
            try { cancelAnimationFrame(this._scrollTimer); } catch (e) {}
            this._scrollTimer = null;
        }
        this._lastScrollTime = null;

        this._apiStatusBubble = null;

        if (this._safetyTimeout) { clearTimeout(this._safetyTimeout); this._safetyTimeout = null; }
        if (this._fallbackTimeout) { clearTimeout(this._fallbackTimeout); this._fallbackTimeout = null; }
        if (this._sseHandle) { this._sseHandle.abort(); this._sseHandle = null; }

        this._stopScheduler();
        this._chunkQueue = [];
        this._domBatchQueue = [];
        this._domBatchFlushScheduled = false;

        if (this.thinkingBubble && this.thinkingBubble.isConnected) {
            const b = this.thinkingBubble;
            b.dataset.state = 'done';
            b.classList.remove('expanded');
            const body = b.querySelector('.ai-thinking-body');
            if (body) body.classList.remove('open');
            const label = b.querySelector('.ai-thinking-label');
            const timer = b.querySelector('.ai-thinking-timer');
            if (label) label.textContent = '思考完成';
            if (timer) timer.textContent = '';
        }

        this.thinkingBubble = null;
        this._thinkingContentEl = null;
        this._thinkingTimerEl = null;
        this._thinkingPreviewEl = null;
        this._lastThinkingBubble = null;
        this._thinkingChainBubble = null;
        this._thinkingChainStepsEl = null;
        this._thinkingChainStartTime = null;
        this.thinkingContent = '';
        this.thinkingStartTime = 0;
        this._lastReasoningRender = null;
        this._thinkingSteps = null;
        this._currentThinkingStep = null;
        this._pendingThinkingSteps = [];
        this._thinkingFlushScheduled = false;
        this.toolCallBubble = null;
        this.currentToolCalls = [];
        this.fullTextBuffer = '';
        this.displayedLength = 0;
        this._rAFPending = false;
        this._streamTextBlock = null;
        this._streamFullResponse = '';
        this._streamWorkflowContent = null;
        this._pendingToolResults = {};
        this._pendingToolBubbles = 0;
        this._toolBubbleFragment = null;
    },

    stopGeneration(finalContent, isError) {
        console.log(`[AI-STOP] stopGeneration called, thinkingBubble: ${!!this.thinkingBubble}, state: ${this.thinkingBubble?.dataset?.state}`);
        this.isGenerating = false;
        this._hideStatusIndicator();
        this.updateSendButton(false);
        this.updateTodoBar();
        this._saveTodos();

        try {
        this._collapseCompletedTaskThinking();
        this._cleanupGenerationState();

        if (this._todoThrottleTimer) {
            this.extractTodosFromStream(this.fullTextBuffer);
        }

        if (this._currentToolUseBlocks) {
            for (const block of this._currentToolUseBlocks) {
                if (block && block.dataset && block.dataset.status === 'running') {
                    block.dataset.status = 'failed';
                    const iconEl = block.querySelector('.ai-tool-call-icon');
                    if (iconEl) {
                        iconEl.classList.add('type-error');
                        iconEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
                    }
                }
            }
            this._currentToolUseBlocks = [];
        }

        const wf = document.getElementById('ai-active-workflow');
        if (wf) {
            wf.classList.remove('ai-streaming-msg');
            wf.removeAttribute('id');
        }

        if (finalContent && !isError) {
            if (typeof finalContent !== 'string') {
                try { finalContent = JSON.stringify(finalContent, null, 2); } catch (e) { finalContent = String(finalContent); }
            }
            let cleanContent = finalContent;
            const memoryMatches = [...finalContent.matchAll(/\[MEMORY:(.*?)\]/g)];
            if (memoryMatches.length > 0) {
                const newMemories = memoryMatches.map(m => m[1].trim()).filter(m => m);
                if (newMemories.length > 0) {
                    const existing = this.userMemory ? this.userMemory.split('\n') : [];
                    const memorySet = new Set(existing.map(m => m.trim()).filter(m => m));
                    for (const mem of newMemories) {
                        memorySet.add(mem);
                    }
                    this.userMemory = [...memorySet].slice(-20).join('\n');
                    this.saveUserMemory();

                    const persistSet = new Set(this._persistentMemory.map(m => m.trim()));
                    for (const mem of newMemories) {
                        persistSet.add(mem);
                    }
                    this._persistentMemory = [...persistSet].slice(-50);
                    this.savePersistentMemory();
                }
                cleanContent = finalContent.replace(/\[MEMORY:.*?\]/g, '').trim();
            }

            const conv = this.getCurrent();
            if (conv) {
                const assistantMsg = { role: 'assistant', content: cleanContent || finalContent };
                if (this.currentToolCalls && this.currentToolCalls.length > 0) {
                    assistantMsg.tool_calls = this.currentToolCalls.map(tc => ({
                        id: tc.id, type: 'function',
                        function: { name: tc.name, arguments: tc.arguments || '' }
                    }));
                    conv.messages.push(assistantMsg);
                    if (this._pendingToolResults) {
                        for (const tr of Object.values(this._pendingToolResults)) {
                            conv.messages.push({
                                role: 'tool', tool_call_id: tr.id,
                                content: typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result)
                            });
                        }
                    }
                } else {
                    conv.messages.push(assistantMsg);
                }
                const MAX_CONV_MSGS = 50;
                if (conv.messages.length > MAX_CONV_MSGS) {
                    let trimStart = conv.messages.length - MAX_CONV_MSGS;
                    while (trimStart > 0 && trimStart < conv.messages.length) {
                        const m = conv.messages[trimStart];
                        if (m.role === 'tool') { trimStart++; continue; }
                        if (m.role === 'assistant' && m.tool_calls) { trimStart++; continue; }
                        break;
                    }
                    conv.messages = conv.messages.slice(trimStart);
                }
                this.saveConversations();
            }

            if (cleanContent !== finalContent) {
                const lastTextBlock = document.querySelector('#ai-messages .ai-workflow-text:last-child');
                if (lastTextBlock) {
                    this.asyncRenderMarkdown(cleanContent, (html) => {
                        if (lastTextBlock) { lastTextBlock.innerHTML = html; this._highlightCodeBlocks(lastTextBlock); }
                    });
                }
            }

            if (this.settings && this.settings.soundEnabled !== false) {
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(523, ctx.currentTime);
                    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
                    osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
                    gain.gain.setValueAtTime(this.settings.soundVolume || 0.3, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
                    osc.start(ctx.currentTime);
                    osc.stop(ctx.currentTime + 0.4);
                } catch(e) {}
            }

        }

        const inputArea = document.querySelector('.rc-input-area');
        if (inputArea) inputArea.style.display = '';
        } catch (e) {
            console.error('[AIChat] stopGeneration error:', e);
            this.isGenerating = false;
            try { this.updateSendButton(false); } catch (e2) {}
        }
    },

    stopGenerationForce() {
        if (!this.isGenerating) return;
        console.log(`[AI-STOP] stopGenerationForce called, thinkingBubble: ${!!this.thinkingBubble}, state: ${this.thinkingBubble?.dataset?.state}`);

        try { window.electronAPI.ai.chatAbort(); } catch (e) {}
        try { this.flushTypewriter(); } catch (e) {}

        this._cleanupGenerationState();

        this.isGenerating = false;
        this._hideStatusIndicator();
        this.updateSendButton(false);
        this.updateTodoBar();
        this._saveTodos();

        const wf = document.getElementById('ai-active-workflow');
        if (wf) {
            let lastText = this._streamFullResponse || '';
            if (!lastText) {
                const textBlocks = wf.querySelectorAll('.ai-workflow-text');
                for (const block of textBlocks) {
                    const t = block.innerText.replace(/[\u200B\uFEFF]/g, '').trim();
                    if (t) lastText = t;
                }
            }
            if (!lastText && this.thinkingContent) {
                lastText = `*（思考过程）*\n\n${this.thinkingContent}`;
            }
            if (lastText) {
                const conv = this.getCurrent();
                if (conv) {
                    const assistantMsg = { role: 'assistant', content: lastText };
                    if (this.currentToolCalls && this.currentToolCalls.length > 0) {
                        assistantMsg.tool_calls = this.currentToolCalls.map(tc => ({
                            id: tc.id, type: 'function',
                            function: { name: tc.name, arguments: tc.arguments || '' }
                        }));
                        conv.messages.push(assistantMsg);
                        if (this._pendingToolResults) {
                            for (const tr of Object.values(this._pendingToolResults)) {
                                conv.messages.push({
                                    role: 'tool', tool_call_id: tr.id,
                                    content: typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result)
                                });
                            }
                        }
                    } else {
                        conv.messages.push(assistantMsg);
                    }
                    const MAX_CONV_MSGS = 50;
                    if (conv.messages.length > MAX_CONV_MSGS) {
                        let trimStart = conv.messages.length - MAX_CONV_MSGS;
                        while (trimStart > 0 && trimStart < conv.messages.length) {
                            const m = conv.messages[trimStart];
                            if (m.role === 'tool') { trimStart++; continue; }
                            if (m.role === 'assistant' && m.tool_calls) { trimStart++; continue; }
                            break;
                        }
                        conv.messages = conv.messages.slice(trimStart);
                    }
                }
            }
            wf.classList.remove('ai-streaming-msg');
            wf.removeAttribute('id');
        }

        const inputArea = document.querySelector('.rc-input-area');
        if (inputArea) inputArea.style.display = '';

        this.saveConversations();
    },

    _startWatchdog() {
        if (this._watchdogTimer) return;
        this._lastChunkTime = Date.now();
        this._watchdogTick = 0;
        this._watchdogTimer = setInterval(() => {
            if (!this.isGenerating) return;
            if (!this._lastChunkTime) this._lastChunkTime = Date.now();
            const elapsed = Date.now() - this._lastChunkTime;
            this._watchdogTick++;
            if (elapsed > 180000) {
                console.warn(`[AIChat] Watchdog: no chunks for ${Math.round(elapsed/1000)}s, force stopping`);
                this.stopGenerationForce();
                return;
            }
            if (this._chunkQueue && this._chunkQueue.length > 500) {
                console.warn(`[AIChat] Watchdog: chunk queue overflow (${this._chunkQueue.length}), force stopping`);
                this.stopGenerationForce();
            }
        }, 10000);
    },

    _loadProvidersLazy() {
        if (this._providersLoaded) return;
        this._providersLoaded = true;
        window.electronAPI.ai.getProviders().then(p => {
            this.providers = p || [];
        }).catch(() => { this.providers = []; });
    },

    _initScheduler() {
        this._domBatchQueue = [];
        this._domBatchFlushScheduled = false;
        this._schedulerTimer = null;
    },

    _startScheduler() {
        if (this._schedulerTimer) return;
        this._schedulerTick();
    },

    _stopScheduler() {
        if (this._schedulerTimer) {
            clearTimeout(this._schedulerTimer);
            this._schedulerTimer = null;
        }
    },

    _schedulerTick() {
        this._schedulerTimer = null;
        if (this._chunkQueue.length === 0) return;

        const queueLen = this._chunkQueue.length;
        const BUDGET = queueLen > 50 ? 10 : queueLen > 20 ? 6 : 3;
        const tickStart = performance.now();
        let processed = 0;
        while (this._chunkQueue.length > 0 && performance.now() - tickStart < BUDGET) {
            const chunk = this._chunkQueue.shift();
            try { this._processChunk(chunk); } catch (e) { console.error('[AIChat] _processChunk error:', e); }
            processed++;
        }
        const tickMs = performance.now() - tickStart;
        if (tickMs > 16) {
            console.warn(`[PERF-SCHEDULER] tick ${tickMs.toFixed(1)}ms, processed ${processed} chunks, queue remaining ${this._chunkQueue.length}`);
        }

        if (this._chunkQueue.length > 0) {
            this._schedulerTimer = setTimeout(() => this._schedulerTick(), 16);
        }
    },

    _drainChunkQueue() {
        const DRAIN_BUDGET = 8;
        const start = performance.now();
        while (this._chunkQueue.length > 0 && performance.now() - start < DRAIN_BUDGET) {
            const chunk = this._chunkQueue.shift();
            try { this._processChunk(chunk); } catch (e) { console.error('[AIChat] _processChunk error:', e); }
        }
        if (this._domBatchQueue.length > 0) {
            this._flushDOMBatch();
        }
        if (this._chunkQueue.length > 0) {
            this._schedulerTimer = setTimeout(() => this._drainChunkQueue(), 0);
        }
    },

    _scheduleDOMBatch(fn) {
        this._domBatchQueue.push(fn);
        if (!this._domBatchFlushScheduled) {
            this._domBatchFlushScheduled = true;
            if (typeof requestAnimationFrame !== 'undefined') {
                requestAnimationFrame(() => this._flushDOMBatch());
            } else {
                queueMicrotask(() => this._flushDOMBatch());
            }
        }
    },

    _flushDOMBatch() {
        this._domBatchFlushScheduled = false;
        const batch = this._domBatchQueue;
        if (batch.length === 0) return;
        this._domBatchQueue = [];
        const DOM_BUDGET = 4;
        const batchStart = performance.now();
        for (let i = 0; i < batch.length; i++) {
            if (i > 0 && performance.now() - batchStart > DOM_BUDGET) {
                this._domBatchQueue.push(...batch.slice(i));
                if (!this._domBatchFlushScheduled) {
                    this._domBatchFlushScheduled = true;
                    requestAnimationFrame(() => this._flushDOMBatch());
                }
                return;
            }
            try { batch[i](); } catch (e) {}
        }
        const batchMs = performance.now() - batchStart;
        if (batchMs > 16) {
            console.warn(`[PERF-DOM-BATCH] flush ${batchMs.toFixed(1)}ms, ${batch.length} ops`);
        }
    },

    _getOrCreateTextBlock() {
        if (!this._streamTextBlock) {
            const parent = this._currentTaskGroup ? this._currentTaskGroup.querySelector('.ai-task-body') : this._streamWorkflowContent;
            if (!parent) {
                console.warn('[AI-TEXT-BLOCK] parent container is null!');
                return null;
            }
            this._streamTextBlock = document.createElement('div');
            this._streamTextBlock.className = 'ai-workflow-block ai-workflow-text';
            parent.appendChild(this._streamTextBlock);
            this.startTypewriter(this._streamTextBlock);
        }
        return this._streamTextBlock;
    },

    _processChunk(data) {
        if (data.type === 'tool_output_chunk' || data.type === 'tool_output_end') {
            this._handleToolOutputStream(data);
            return;
        }

        const chunkType = data.done ? 'DONE' : data.error ? 'ERROR' : data.type || 'say';
        if (chunkType !== 'reasoning_content' && chunkType !== 'say' && chunkType !== 'tool_call_result') {
            console.log(`[AI-PROC] ${chunkType}`);
        }
        if (data.error) {
            this._streamFullResponse = data.error;
            this.flushTypewriter();
            const block = this._getOrCreateTextBlock();
            if (block) {
                this._renderErrorCard(block, data.error);
            }
            const wf = document.getElementById('ai-active-workflow');
            if (wf) wf.classList.remove('ai-streaming-msg');
            this.stopGeneration(this._streamFullResponse, true);
            return;
        }

        if (data.type === 'approval_requested') {
            const { approvalId, toolName, risk, args, dangerous, autoDenyMs } = data;
            const desc = this.getToolActionDescription(toolName, JSON.stringify(args || {})) || TOOL_DISPLAY_NAMES[toolName] || toolName;
            const riskColor = risk === 'dangerous' ? '#ef4444' : risk === 'moderate' ? '#f59e0b' : '#22c55e';
            const riskLabel = risk === 'dangerous' ? '⚠ 高风险' : risk === 'moderate' ? '中风险' : '低风险';
            const isDangerous = risk === 'dangerous';
            const countdownMs = autoDenyMs || (isDangerous ? 120000 : 30000);
            const countdownSec = Math.floor(countdownMs / 1000);
            const dangerReason = dangerous?.reason || '';

            let parsedArgs = {};
            try { parsedArgs = typeof args === 'string' ? JSON.parse(args) : (args || {}); } catch (e) {}
            const cmdPreview = parsedArgs.command || parsedArgs.file_path || parsedArgs.path || '';

            this._scheduleDOMBatch(() => {
                if (isDangerous) {
                    let overlay = document.getElementById('ai-approval-overlay');
                    if (!overlay) {
                        overlay = document.createElement('div');
                        overlay.id = 'ai-approval-overlay';
                        overlay.className = 'ai-approval-overlay';
                        document.body.appendChild(overlay);
                    }

                    const modal = document.createElement('div');
                    modal.className = 'ai-approval-modal';
                    modal.id = 'approval-' + approvalId;
                    modal.innerHTML = `
                        <div class="ai-approval-modal-header">
                            <span class="ai-approval-modal-icon">🛡️</span>
                            <div class="ai-approval-modal-title-group">
                                <span class="ai-approval-modal-title">需要安全授权</span>
                                <span class="ai-approval-risk-badge dangerous">${riskLabel}</span>
                            </div>
                        </div>
                        <div class="ai-approval-modal-body">
                            <div class="ai-approval-tool-name">${this.escapeHtml(TOOL_DISPLAY_NAMES[toolName] || toolName)}</div>
                            <div class="ai-approval-desc">${this.escapeHtml(desc)}</div>
                            ${dangerReason ? `<div class="ai-approval-danger-reason">🔴 ${this.escapeHtml(dangerReason)}</div>` : ''}
                            ${cmdPreview ? `<div class="ai-approval-cmd-preview"><code>${this.escapeHtml(cmdPreview.length > 200 ? cmdPreview.slice(0, 200) + '...' : cmdPreview)}</code></div>` : ''}
                        </div>
                        <div class="ai-approval-modal-footer">
                            <span class="ai-approval-countdown" data-countdown="${countdownSec}">${countdownSec}s 后自动拒绝</span>
                            <div class="ai-approval-modal-actions">
                                <button class="ai-approval-btn deny" data-approval-id="${approvalId}">拒绝</button>
                                <button class="ai-approval-btn always-allow" data-approval-id="${approvalId}">始终允许</button>
                                <button class="ai-approval-btn approve" data-approval-id="${approvalId}">允许执行</button>
                            </div>
                        </div>`;
                    overlay.appendChild(modal);
                    overlay.style.display = 'flex';

                    this._bindApprovalActions(modal, approvalId, overlay);

                    const countdownEl = modal.querySelector('.ai-approval-countdown');
                    let remaining = countdownSec;
                    const timer = setInterval(() => {
                        remaining--;
                        if (remaining <= 0) { clearInterval(timer); return; }
                        if (countdownEl && !modal.classList.contains('resolved')) {
                            countdownEl.textContent = `${remaining}s 后自动拒绝`;
                        } else {
                            clearInterval(timer);
                        }
                    }, 1000);
                    modal._countdownTimer = timer;
                } else {
                    const block = this._getOrCreateTextBlock();
                    if (!block) return;
                    const div = document.createElement('div');
                    div.className = 'ai-approval-card ai-approval-moderate';
                    div.id = 'approval-' + approvalId;
                    div.innerHTML = `
                        <div class="ai-approval-header">
                            <span class="ai-approval-icon">⚠️</span>
                            <span class="ai-approval-title">需要授权</span>
                            <span class="ai-approval-risk" style="color:${riskColor}">${riskLabel}</span>
                            <span class="ai-approval-countdown" data-countdown="${countdownSec}">${countdownSec}s</span>
                        </div>
                        <div class="ai-approval-desc">${this.escapeHtml(desc)}</div>
                        ${cmdPreview ? `<div class="ai-approval-cmd-preview"><code>${this.escapeHtml(cmdPreview.length > 150 ? cmdPreview.slice(0, 150) + '...' : cmdPreview)}</code></div>` : ''}
                        <div class="ai-approval-actions">
                            <button class="ai-approval-btn approve" data-approval-id="${approvalId}">允许</button>
                            <button class="ai-approval-btn always-allow" data-approval-id="${approvalId}">始终允许</button>
                            <button class="ai-approval-btn deny" data-approval-id="${approvalId}">拒绝</button>
                        </div>`;
                    block.appendChild(div);
                    this._scrollDebounced();

                    this._bindApprovalActions(div, approvalId);

                    const countdownEl = div.querySelector('.ai-approval-countdown');
                    let remaining = countdownSec;
                    const timer = setInterval(() => {
                        remaining--;
                        if (remaining <= 0) { clearInterval(timer); return; }
                        if (countdownEl && !div.classList.contains('resolved')) {
                            countdownEl.textContent = `${remaining}s`;
                        } else {
                            clearInterval(timer);
                        }
                    }, 1000);
                    div._countdownTimer = timer;
                }
            });
            return;
        }

        if (data.type === 'ask_user_requested') {
            const { askId, question, options, context } = data;
            const div = document.createElement('div');
            div.className = 'ai-message ai-message-system';
            let optionsHtml = '';
            if (options && options.length > 0) {
                optionsHtml = '<div class="ai-ask-options">' + options.map((opt, i) =>
                    `<button class="ai-ask-option-btn" data-ask-id="${askId}" data-answer="${this.escapeHtml(opt)}">${this.escapeHtml(opt)}</button>`
                ).join('') + '</div>';
            }
            div.innerHTML = `
                <div class="ai-ask-card">
                    <div class="ai-ask-header">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        <span class="ai-ask-title">需要你的输入</span>
                    </div>
                    ${context ? `<div class="ai-ask-context">${this.escapeHtml(context)}</div>` : ''}
                    <div class="ai-ask-question">${this.escapeHtml(question)}</div>
                    ${optionsHtml}
                    ${!options || options.length === 0 ? `
                    <div class="ai-ask-free-input">
                        <input type="text" class="ai-ask-input" placeholder="输入你的回答..." data-ask-id="${askId}" />
                        <button class="ai-ask-send-btn" data-ask-id="${askId}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        </button>
                    </div>` : ''}
                </div>`;
            const chatContainer = document.getElementById('ai-messages');
            if (chatContainer) {
                chatContainer.appendChild(div);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
            const answerCard = (answer, hasOptions) => {
                div.classList.add('ai-ask-answered');
                const contextEl = div.querySelector('.ai-ask-context');
                const optionsEl = div.querySelector('.ai-ask-options');
                const freeInputEl = div.querySelector('.ai-ask-free-input');
                if (optionsEl) optionsEl.remove();
                if (freeInputEl) freeInputEl.remove();
                let answerEl = div.querySelector('.ai-ask-answer');
                if (!answerEl) {
                    answerEl = document.createElement('div');
                    answerEl.className = 'ai-ask-answer';
                    div.appendChild(answerEl);
                }
                answerEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>${this.escapeHtml(answer)}</span>`;
            };
            div.querySelectorAll('.ai-ask-option-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const answer = btn.getAttribute('data-answer');
                    if (window.electronAPI?.ai?.askUserRespond) {
                        window.electronAPI.ai.askUserRespond(askId, answer);
                    }
                    answerCard(answer, true);
                });
            });
            const sendBtn = div.querySelector('.ai-ask-send-btn');
            if (sendBtn) {
                sendBtn.addEventListener('click', () => {
                    const input = div.querySelector('.ai-ask-input');
                    const val = input && input.value.trim();
                    if (val) {
                        if (window.electronAPI?.ai?.askUserRespond) {
                            window.electronAPI.ai.askUserRespond(askId, val);
                        }
                        input.disabled = true;
                        sendBtn.disabled = true;
                        answerCard(val, false);
                    }
                });
            }
            const askInput = div.querySelector('.ai-ask-input');
            if (askInput) {
                askInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        const btn = div.querySelector('.ai-ask-send-btn');
                        if (btn) btn.click();
                    }
                });
                askInput.focus();
            }
        }

        if (data.type === 'thinking_step') {
            const step = data.step;
            if (!step) return;
            if (!this._pendingThinkingSteps) this._pendingThinkingSteps = [];
            this._pendingThinkingSteps.push(step);
            if (!this._thinkingFlushScheduled) {
                this._thinkingFlushScheduled = true;
                setTimeout(() => {
                    this._thinkingFlushScheduled = false;
                    this._flushThinkingSteps();
                }, 0);
            }
            return;
        }

        if (data.type === 'tool_calls_start') {
            if (this.thinkingBubble && this.thinkingBubble.dataset.state === 'streaming') {
                const b = this.thinkingBubble;
                b.dataset.state = 'done';
                b.classList.remove('expanded');
                const body = b.querySelector('.ai-thinking-body');
                if (body) body.classList.remove('open');
                const chevron = b.querySelector('.ai-thinking-chevron');
                if (chevron) chevron.classList.remove('open');
                const label = b.querySelector('.ai-thinking-label');
                const elapsed = Math.floor((Date.now() - (this.thinkingStartTime || Date.now())) / 1000);
                if (label) label.textContent = '思考过程';
                const timer = b.querySelector('.ai-thinking-timer');
                if (timer && elapsed > 0) timer.textContent = elapsed + 's';
            }
            this.thinkingBubble = null;
            this._thinkingContentEl = null;
            this._thinkingTimerEl = null;
            this._thinkingPreviewEl = null;
            if (this._reasoningTimer) { clearInterval(this._reasoningTimer); this._reasoningTimer = null; }
            this.currentToolCalls = data.calls || [];
            this.toolCallStartTime = Date.now();
            const calls = data.calls || [];
            for (const call of calls) {
                try {
                    const args = typeof call.arguments === 'string' ? JSON.parse(call.arguments) : (call.arguments || {});
                    const filePath = args.file_path || args.filePath || args.path;
                    if (filePath && typeof filePath === 'string') {
                        this._recentFiles.add(filePath);
                    }
                    if (call.name === 'bash' && typeof (args.command || args.cmd) === 'string') {
                        const cmd = args.command || args.cmd;
                        const gitMatch = cmd.match(/^\s*git\s+(\w+)/);
                        if (gitMatch) {
                            this._gitOperations.push({ subcommand: gitMatch[1], command: cmd, time: Date.now() });
                            if (this._gitOperations.length > 50) this._gitOperations = this._gitOperations.slice(-50);
                            this._updateGitSection();
                        }
                    }
                } catch (e) {}
            }
            if (this._todos.length === 0 && calls.length >= 4) {
                this._todos = calls.map((c, i) => ({
                    id: 'auto-' + (i + 1),
                    content: (TOOL_DISPLAY_NAMES[c.name] || c.name) + ': ' + (c.description || c.argsStr || '').substring(0, 60),
                    status: 'pending',
                    priority: 'medium'
                }));
                if (this._todos.length > 0) this._todos[0].status = 'in_progress';
                this.updateTodoBar();
            }
            if (this.typewriterTimer) {
                clearTimeout(this.typewriterTimer);
                this.typewriterTimer = null;
            }
            this._streamTextBlock = null;
            for (const call of calls) {
                this._scheduleDOMBatch(() => {
                    this.appendToolCallBubble(call);
                });
            }
            this._scheduleDOMBatch(() => {
                if (this._toolBubbleFragment && this._pendingToolBubbles > 0) {
                    const taskBody = this._currentTaskGroup ? this._currentTaskGroup.querySelector('.ai-task-body') : null;
                    const container = taskBody || this.currentWorkflowContent || this._messagesContainer;
                    if (container) container.appendChild(this._toolBubbleFragment);
                    this._toolBubbleFragment = null;
                    this._pendingToolBubbles = 0;
                }
                const firstCall = calls[0];
                if (firstCall) {
                    const statusMap = {
                        bash: ['正在执行命令...', 'running'],
                        execute_command: ['正在执行命令...', 'running'],
                        str_replace_based_edit_tool: ['正在编辑文件...', 'editing'],
                        json_edit_tool: ['正在编辑文件...', 'editing'],
                        grep_search: ['正在搜索文件...', 'searching'],
                        glob_search: ['正在搜索文件...', 'searching'],
                        search_files: ['正在搜索文件...', 'searching'],
                        search: ['正在搜索文件...', 'searching'],
                        ckg: ['正在搜索代码库...', 'searching'],
                        read_file: ['正在读取文件...', 'planning'],
                        sequential_thinking: ['正在规划下一步...', 'planning'],
                        update_todo_list: ['正在更新计划...', 'planning'],
                        attempt_completion: ['正在完成任务...', 'running']
                    };
                    const [text, type] = statusMap[firstCall.name] || ['正在处理...', ''];
                    this._showStatusIndicator(text, type);
                    this._updateStatusBar('running');
                }
            });
            return;
        }

        if (data.type === 'tool_call_exec') {
            this._hideStatusIndicator();
            return;
        }

        if (data.type === 'reasoning_start') {
            if (data.silent) return;
            if (this._currentSubAgent) return;
            this._updateStatusBar('thinking');
            this.thinkingContent = '';
            if (this._reasoningTimer) { clearInterval(this._reasoningTimer); this._reasoningTimer = null; }
            const now = Date.now();
            if (this._lastReasoningEnd && (now - this._lastReasoningEnd) < 500) return;
            if (this._reasoningRAF) { cancelAnimationFrame(this._reasoningRAF); this._reasoningRAF = null; }
            this.thinkingStartTime = Date.now();

            if (this.thinkingBubble && this.thinkingBubble.isConnected && this.thinkingBubble.dataset.state === 'streaming') {
                this._thinkingContentEl = this.thinkingBubble.querySelector('.ai-thinking-content');
                this._thinkingTimerEl = this.thinkingBubble.querySelector('.ai-thinking-timer');
            } else if (this._lastThinkingBubble && this._lastThinkingBubble.isConnected && this._lastReasoningEnd && (now - this._lastReasoningEnd) < 5000) {
                const bubble = this._lastThinkingBubble;
                bubble.dataset.state = 'streaming';
                const label = bubble.querySelector('.ai-thinking-label');
                if (label) label.textContent = '思考中...';
                const contentEl = bubble.querySelector('.ai-thinking-content');
                if (contentEl) contentEl.textContent = '';
                const previewEl = bubble.querySelector('.ai-thinking-preview');
                if (previewEl) previewEl.textContent = '';
                this.thinkingBubble = bubble;
                this._thinkingContentEl = contentEl;
                this._thinkingTimerEl = bubble.querySelector('.ai-thinking-timer');
                this._thinkingPreviewEl = previewEl;
                this._lastThinkingBubble = null;
            } else {
                const CHEVRON_S = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><polyline points="6 9 12 15 18 9"/></svg>';
                const bubble = document.createElement('div');
                bubble.className = 'ai-thinking-block';
                bubble.dataset.state = 'streaming';
                bubble.dataset.thinkingContent = '';
                const preview = document.createElement('div');
                preview.className = 'ai-thinking-preview';
                bubble.innerHTML = `<div class="ai-thinking-header" onclick="AIChat.toggleReasoningBlock(this.parentElement)"><span class="ai-thinking-label">思考中...</span><span class="ai-thinking-timer"></span><span class="ai-thinking-chevron">${CHEVRON_S}</span></div><div class="ai-thinking-body"><div class="ai-thinking-content"></div></div>`;
                bubble.appendChild(preview);
                this.thinkingBubble = bubble;
                this._thinkingContentEl = bubble.querySelector('.ai-thinking-content');
                this._thinkingTimerEl = bubble.querySelector('.ai-thinking-timer');
                this._thinkingPreviewEl = preview;
                this.appendWorkflowBlock(bubble);
            }

            this._reasoningTimer = setInterval(() => {
                if (this.thinkingBubble && this.thinkingBubble.dataset.state === 'streaming' && this._thinkingTimerEl) {
                    const s = Math.floor((Date.now() - this.thinkingStartTime) / 1000);
                    this._thinkingTimerEl.textContent = s > 0 ? s + 's' : '';
                }
            }, 1000);
            return;
        }

        if (data.type === 'reasoning_content') {
            if (this.thinkingBubble) {
                this.thinkingContent = (this.thinkingContent || '') + (data.content || '');
                const now = Date.now();
                const queueLen = this._chunkQueue.length;
                const throttle = queueLen > 50 ? 800 : queueLen > 25 ? 400 : 200;
                if (!this._lastReasoningRender || now - this._lastReasoningRender > throttle) {
                    this._lastReasoningRender = now;
                    if (queueLen > 80) {
                        return;
                    }
                    const content = this.thinkingContent;
                    const el = this._thinkingContentEl;
                    if (!this._reasoningRAF && el) {
                        this._reasoningRAF = requestAnimationFrame(() => {
                            this._reasoningRAF = null;
                            if (this.thinkingBubble && el) {
                                const MAX_DISPLAY = 3000;
                                el.textContent = content.length > MAX_DISPLAY ? content.slice(-MAX_DISPLAY) + '\n...(已截断)' : content;
                                const previewEl = this._thinkingPreviewEl;
                                if (previewEl) {
                                    const firstLine = content.replace(/\n+/g, ' ').trim().slice(0, 120);
                                    previewEl.textContent = content.length > 120 ? firstLine + '...' : firstLine;
                                }
                                this.scrollToBottom();
                            }
                        });
                    }
                }
            }
            return;
        }

        if (data.type === 'reasoning_end') {
            if (this._reasoningTimer) { clearInterval(this._reasoningTimer); this._reasoningTimer = null; }
            if (this._reasoningRAF) { cancelAnimationFrame(this._reasoningRAF); this._reasoningRAF = null; }

            if (this.thinkingBubble) {
                const bubble = this.thinkingBubble;
                const content = this.thinkingContent || '';
                const label = bubble.querySelector('.ai-thinking-label');
                const timer = bubble.querySelector('.ai-thinking-timer');
                const startTime = this.thinkingStartTime;
                this._lastReasoningEnd = Date.now();
                this._lastThinkingBubble = bubble;
                this.thinkingBubble = null;
                this._thinkingContentEl = null;
                this._thinkingTimerEl = null;

                this._scheduleDOMBatch(() => {
                    bubble.dataset.state = 'done';
                    bubble.classList.remove('expanded');
                    const body = bubble.querySelector('.ai-thinking-body');
                    if (body) body.classList.remove('open');
                    const chevron = bubble.querySelector('.ai-thinking-chevron');
                    if (chevron) chevron.classList.remove('open');
                    if (content) bubble.dataset.thinkingContent = content;
                    const elapsed = Math.floor((Date.now() - startTime) / 1000);
                    if (label) label.textContent = '思考过程';
                    if (timer) timer.textContent = elapsed > 0 ? elapsed + 's' : '';
                    const previewEl = this._thinkingPreviewEl;
                    if (previewEl && content) {
                        const summary = content.replace(/\n+/g, ' ').trim().slice(0, 120);
                        previewEl.textContent = content.length > 120 ? summary + '...' : summary;
                    }
                });
                this._thinkingPreviewEl = null;
            }
            return;
        }

        if (data.type === 'tool_call_result' || (data.type === 'say' && data.say === 'tool_result')) {
            if (data.text && !data.name) {
                try {
                    const parsed = JSON.parse(data.text);
                    data.id = data.id || parsed.id;
                    data.name = data.name || parsed.name;
                    data.result = data.result || parsed.result;
                    data.elapsed = data.elapsed || parsed.elapsed;
                } catch (e) {}
            }
            if (data.name === 'todo_write') {
                try {
                    const parsed = JSON.parse(data.result || '{}');
                    if (Array.isArray(parsed.todos) && parsed.todos.length > 0) {
                        this._todos = parsed.todos.map(t => ({
                            id: t.id || String(Date.now()),
                            content: t.content || '',
                            status: t.status || 'pending',
                            priority: t.priority || 'medium'
                        }));
                        this.updateTodoBar();
                    }
                } catch (e) {}
            }
            if (data.name === 'update_todo_list') {
                try {
                    const parsed = JSON.parse(data.result || '{}');
                    let parsed_todos = [];
                    if (Array.isArray(parsed.todos)) {
                        parsed_todos = parsed.todos.map(t => ({
                            id: t.id || '',
                            content: t.content || '',
                            status: t.status || 'pending'
                        }));
                    } else if (typeof parsed.todos === 'string' && parsed.todos) {
                        parsed_todos = this.parseTodosFromText(parsed.todos);
                    }
                    if (parsed_todos.length > 0) {
                        this._todos = parsed_todos.map((t, i) => ({
                            id: t.id || 'task-' + (i + 1),
                            content: t.content,
                            status: t.status,
                            priority: 'medium'
                        }));
                        this.updateTodoBar();
                        this._collapseCompletedTaskThinking();
                        const activeIdx = this._getActiveTaskIndex();
                        if (activeIdx >= 0) {
                            this._createTaskTitleRow(activeIdx);
                            const toolRow = document.getElementById('tool-' + data.id);
                            if (toolRow) {
                                const taskBody = this._currentTaskGroup ? this._currentTaskGroup.querySelector('.ai-task-body') : null;
                                if (taskBody) {
                                    const contentWrapper = toolRow.nextElementSibling;
                                    taskBody.appendChild(toolRow);
                                    if (contentWrapper && contentWrapper.classList.contains('ai-file-ops-content')) {
                                        taskBody.appendChild(contentWrapper);
                                    }
                                }
                            }
                        } else {
                            this._closeCurrentTaskGroup();
                        }
                    }
                } catch (e) {}
            }
            if (data.name && data.name !== 'update_todo_list' && data.name !== 'todo_write') {
                if (data.name === 'attempt_completion') {
                    this._collapseCompletedTaskThinking();
                    this._closeAllTaskGroups();
                }
                if (this._todos.length > 0) {
                    this._appendToolToCurrentTask(data.name, data.result || '', data.elapsed);
                    const activeIdx = this._getActiveTaskIndex();
                    if (activeIdx >= 0 && this._todos[activeIdx].id && this._todos[activeIdx].id.startsWith('auto-')) {
                        this._todos[activeIdx].status = 'completed';
                        const nextIdx = this._getActiveTaskIndex();
                        if (nextIdx >= 0 && nextIdx !== activeIdx) this._todos[nextIdx].status = 'in_progress';
                        this.updateTodoBar();
                    }
                }
            }
            if (!this._pendingToolResults) this._pendingToolResults = {};
            let isError = false;
            let status = 'success';
            const resultStr = data.result || '';
            if (resultStr.includes('"status":"error"') || resultStr.includes('"status":"denied"') || resultStr.includes('"error":"')) {
                isError = true;
                status = resultStr.includes('"status":"denied"') ? 'denied' : 'error';
            }
            this._pendingToolResults[data.id] = { id: data.id, name: data.name, result: data.result, isError, status };

            return;
        }

        if (data.type === 'install_progress') {
            this.updateInstallProgress(data.toolCallId, data.toolName, data.progress, data.status);
            return;
        }

        if (data.type === 'tool_calls_end') {
            if (this.typewriterTimer) {
                clearTimeout(this.typewriterTimer);
                this.typewriterTimer = null;
            }

            if (this._pendingToolResults && Object.keys(this._pendingToolResults).length > 0) {
                const results = Object.values(this._pendingToolResults);
                if (!this._toolResultQueue) this._toolResultQueue = [];
                this._toolResultQueue.push(...results);
                if (!this._toolResultRAF) {
                    this._toolResultRAF = requestAnimationFrame(() => {
                        this._toolResultRAF = null;
                        const queue = this._toolResultQueue;
                        this._toolResultQueue = [];
                        this._toolResultProcessQueue(queue, 0);
                    });
                }
                this._pendingToolResults = {};
            }

            this._scheduleDOMBatch(() => {
                const runningRows = document.querySelectorAll('.ai-tool-call-row.running');
                runningRows.forEach(row => {
                    row.classList.remove('running');
                    row.classList.add('done');
                    const iconEl = row.querySelector('.ai-tool-call-icon');
                    if (iconEl) {
                        iconEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>';
                    }
                    const statusEl = row.querySelector('.ai-tool-call-status');
                    if (statusEl) {
                        statusEl.classList.remove('running');
                        statusEl.classList.add('done');
                    }
                });
            });

            this.typewriterTextBlock = null;
            this.toolCallBubble = null;
            this.currentToolCalls = [];
            return;
        }

        if (data.type === 'say' && data.say === 'api_req_started') {
            if (!this._apiStatusBubble) {
                const bubble = document.createElement('div');
                bubble.className = 'ai-api-status';
                bubble.innerHTML = '<div class="ai-api-status-spinner"></div><span class="ai-api-status-text">请求中...</span>';
                this._scheduleDOMBatch(() => {
                    this.appendWorkflowBlock(bubble);
                });
                this._apiStatusBubble = bubble;
            }
            return;
        }

        if (data.type === 'say' && data.say === 'api_req_finished') {
            if (this._apiStatusBubble) {
                const bubble = this._apiStatusBubble;
                this._scheduleDOMBatch(() => {
                    if (bubble && bubble.isConnected) {
                        const text = bubble.querySelector('.ai-api-status-text');
                        if (text) text.textContent = '完成';
                        const spinner = bubble.querySelector('.ai-api-status-spinner');
                        if (spinner) spinner.className = 'ai-api-status-done';
                    }
                });
                setTimeout(() => {
                    if (bubble && bubble.isConnected) {
                        bubble.style.transition = 'opacity 0.3s';
                        bubble.style.opacity = '0';
                        setTimeout(() => { if (bubble.isConnected) bubble.remove(); }, 300);
                    }
                }, 2000);
                this._apiStatusBubble = null;
            }
            return;
        }

        if (data.type === 'usage' && data.usage) {
            this._sessionUsage = this._sessionUsage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, rounds: 0, estimatedCost: 0 };
            if (data.usage.promptTokens != null) {
                this._sessionUsage.prompt_tokens = data.usage.promptTokens;
                this._sessionUsage.completion_tokens = data.usage.completionTokens;
                this._sessionUsage.total_tokens = data.usage.totalTokens;
                this._sessionUsage.estimatedCost = data.usage.estimatedCost || 0;
            } else {
                this._sessionUsage.prompt_tokens += data.usage.prompt_tokens || 0;
                this._sessionUsage.completion_tokens += data.usage.completion_tokens || 0;
                this._sessionUsage.total_tokens += data.usage.total_tokens || 0;
                this._sessionUsage.estimatedCost = data.usage.estimatedCost || this._sessionUsage.estimatedCost || 0;
            }
            this._sessionUsage.rounds += data.usage.rounds || 1;
            this._updateTokenUsageUI();
            return;
        }

        if (data.type === 'say' && data.say === 'api_req_error') {
            if (this._apiStatusBubble) {
                const bubble = this._apiStatusBubble;
                this._scheduleDOMBatch(() => {
                    if (bubble && bubble.isConnected) {
                        const text = bubble.querySelector('.ai-api-status-text');
                        if (text) { text.textContent = '请求失败'; text.style.color = 'var(--ai-error)'; }
                        const spinner = bubble.querySelector('.ai-api-status-spinner');
                        if (spinner) { spinner.style.borderColor = 'var(--ai-error)'; spinner.style.borderTopColor = 'transparent'; spinner.style.animation = 'none'; }
                    }
                });
                setTimeout(() => {
                    if (bubble && bubble.isConnected) {
                        bubble.style.transition = 'opacity 0.3s';
                        bubble.style.opacity = '0';
                        setTimeout(() => { if (bubble.isConnected) bubble.remove(); }, 300);
                    }
                }, 3000);
                this._apiStatusBubble = null;
            }
            return;
        }

        if (data.type === 'say' && data.say === 'completion') {
            this.flushTypewriter();
            this._collapseCompletedTaskThinking();
            this._closeAllTaskGroups();
            this._hideStatusIndicator();
            this._updateStatusBar('idle');
            const content = data.text || '';
            const completedTasks = (this._todos || []).filter(t => t.status === 'completed').length;
            const totalTasks = (this._todos || []).length;
            const fileChanges = this._countFileChanges();
            const bubble = document.createElement('div');
            bubble.className = 'ai-completion-card';
            const header = document.createElement('div');
            header.className = 'ai-completion-header';
            header.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:var(--ai-success)"><polyline points="20 6 9 17 4 12"/></svg><span class="ai-completion-title">任务完成</span>`;
            const summaryHtml = `<div class="ai-completion-summary">
                <div class="ai-completion-stats">
                    <span class="ai-completion-stat"><span class="ai-completion-stat-icon">${this._SVG_CHECK}</span>${completedTasks}/${totalTasks} 任务完成</span>
                    ${fileChanges.total > 0 ? `<span class="ai-completion-stat"><span class="ai-completion-stat-icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px"><path d="M13.5 3.5l-9 9L3 12l1.5-1.5M13.5 3.5l-3-3M13.5 3.5l-3 3"/></svg></span>${fileChanges.total} 个文件已更改 <span class="ai-completion-stat-detail">+${fileChanges.additions} -${fileChanges.deletions}</span></span>` : ''}
                </div>
            </div>`;
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'ai-completion-body';
            if (content) {
                this.asyncRenderMarkdown(content, (html) => { contentWrapper.innerHTML = html; this._highlightCodeBlocks(contentWrapper); });
            }
            const actions = document.createElement('div');
            actions.className = 'ai-completion-actions';
            actions.innerHTML = `<button class="ai-completion-action-btn" onclick="AIChat.clearMessages()"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px"><path d="M2 8h12M8 2v12"/></svg>新建对话</button><button class="ai-completion-action-btn" onclick="document.getElementById('ai-input').focus()"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px"><path d="M2 12l4-4 3 3 5-5"/></svg>继续追问</button>`;
            bubble.appendChild(header);
            bubble.insertAdjacentHTML('beforeend', summaryHtml);
            bubble.appendChild(contentWrapper);
            bubble.appendChild(actions);
            this._scheduleDOMBatch(() => {
                this.appendWorkflowBlock(bubble);
            });
            return;
        }

        if (data.type === 'subagent_start') {
            const card = this._renderSubAgentCard(data.agentType, data.name, data.role, data.task);
            const taskBody = this._currentTaskGroup ? this._currentTaskGroup.querySelector('.ai-task-body') : null;
            const container = taskBody || this.currentWorkflowContent || this._messagesContainer;
            if (container) {
                container.appendChild(card);
                this.scrollToBottom();
            }
            return;
        }
        if (data.type === 'subagent_chunk') {
            this._appendSubAgentChunk(data.agentType, data.chunk);
            return;
        }
        if (data.type === 'subagent_end') {
            this._finalizeSubAgent(data.agentType, data.result, data.error);
            return;
        }

        if (data.type === 'plan_created') {
            this._handlePlanCreated(data);
            return;
        }
        if (data.type === 'plan_step_update') {
            this._handlePlanStepUpdate(data);
            return;
        }
        if (data.type === 'plan_completed') {
            this._handlePlanCompleted(data);
            return;
        }

        if (data.type === 'say' && data.say === 'error') {
            const errMsg = data.text || data.error || '未知错误';
            this._streamFullResponse = errMsg;
            this.flushTypewriter();
            if (this._apiStatusBubble) {
                const bubble = this._apiStatusBubble;
                this._apiStatusBubble = null;
                this._scheduleDOMBatch(() => {
                    if (bubble && bubble.isConnected) {
                        const text = bubble.querySelector('.ai-api-status-text');
                        if (text) { text.textContent = '请求失败'; text.style.color = 'var(--ai-error)'; }
                        const spinner = bubble.querySelector('.ai-api-status-spinner');
                        if (spinner) { spinner.style.borderColor = 'var(--ai-error)'; spinner.style.borderTopColor = 'transparent'; spinner.style.animation = 'none'; }
                    }
                });
                setTimeout(() => { if (bubble && bubble.isConnected) { bubble.style.transition = 'opacity 0.3s'; bubble.style.opacity = '0'; setTimeout(() => { if (bubble.isConnected) bubble.remove(); }, 300); } }, 3000);
            }
            this._scheduleDOMBatch(() => {
                this._finalizePendingToolCalls();
                const block = this._getOrCreateTextBlock();
                if (block) {
                    this._renderErrorCard(block, errMsg);
                }
                const wf = document.getElementById('ai-active-workflow');
                if (wf) wf.classList.remove('ai-streaming-msg');
                this.stopGeneration(this._streamFullResponse, true);
            });
            return;
        }

        if (data.type === 'say') {
            const content = data.text || data.content || '';
            if (content) {
                const textContent = typeof content === 'string' ? content : (typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content));
                this._streamFullResponse += textContent;
                this._getOrCreateTextBlock();
                this.feedTypewriter(textContent);
            }
            return;
        }

        if (data.content || data.text) {
            let content = data.content || data.text;
            if (typeof content !== 'string') {
                try { content = JSON.stringify(content, null, 2); } catch (e) { content = String(content); }
            }
            this._streamFullResponse += content;
            console.log(`[AI-TEXT] fed ${content.length} chars, total=${this._streamFullResponse.length}`);
            this.feedTypewriter(content);
        }
        if (data.type === 'completion') {
            this.flushTypewriter();
            const completionText = data.text || '';
            if (completionText.trim()) {
                this.feedTypewriter('\n\n' + completionText);
                this.flushTypewriter();
            }
        }

        if (data.type === 'followup_suggestions' || (data.type === 'say' && data.say === 'followup')) {
            const suggestions = (data.suggestions || data.items || []).slice(0, 4);
            const question = data.question || data.text || '';
            if (suggestions.length === 0 && !question) return;

            const container = document.createElement('div');
            container.className = 'ai-follow-up';

            if (question) {
                const qEl = document.createElement('div');
                qEl.className = 'ai-follow-up-question';
                qEl.textContent = question;
                container.appendChild(qEl);
            }

            const chipWrap = document.createElement('div');
            chipWrap.className = 'ai-follow-up-chips';
            let chipIdx = 0;
            for (const s of suggestions) {
                const chip = document.createElement('button');
                chip.className = 'ai-suggestion-chip';
                chip.style.animationDelay = (chipIdx * 50) + 'ms';
                chip.textContent = typeof s === 'string' ? s : (s.text || s.label || '');
                chip.addEventListener('click', () => {
                    const input = document.getElementById('ai-input');
                    if (input) {
                        input.value = chip.textContent;
                        input.dispatchEvent(new Event('input'));
                        input.focus();
                        AIChat._updateSendBtnState();
                    }
                });
                chipWrap.appendChild(chip);
                chipIdx++;
            }
            container.appendChild(chipWrap);

            this._scheduleDOMBatch(() => {
                this.appendWorkflowBlock(container);
            });
            return;
        }

        if (data.done) {
            console.log(`[AI-DONE] response=${this._streamFullResponse.length} chars, tools=${this.currentToolCalls.length}`);
            this.flushTypewriter();
            this._collapseCompletedTaskThinking();
            this._closeAllTaskGroups();
            this._hideStatusIndicator();

            if (data.reason === 'max_rounds' && !this._streamFullResponse.trim()) {
                const block = document.createElement('div');
                block.className = 'ai-workflow-block ai-workflow-text';
                block.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;display:flex;align-items:center;gap:6px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="ai-svg-icon" style="color:#f59e0b"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> 操作步骤较多，已达到最大执行轮次。如需继续，请发送新消息。</div>';
                const wf = document.getElementById('ai-active-workflow');
                if (wf) wf.querySelector('.ai-msg-content').appendChild(block);
            } else if (!this._streamFullResponse.trim() && this.currentToolCalls.length === 0) {
                const wf = document.getElementById('ai-active-workflow');
                if (wf) {
                    const content = wf.querySelector('.ai-msg-content');
                    if (content && !content.querySelector('.ai-workflow-text')) {
                        const block = document.createElement('div');
                        block.className = 'ai-workflow-block ai-workflow-text';
                        block.innerHTML = '<div style="color:var(--text-muted);font-size:13px">AI 未产生文本回复，请尝试重新提问。</div>';
                        content.appendChild(block);
                    }
                }
            } else if (!this._streamFullResponse.trim() && this.currentToolCalls.length > 0) {
                const wf = document.getElementById('ai-active-workflow');
                if (wf) {
                    const content = wf.querySelector('.ai-msg-content');
                    if (content && !content.querySelector('.ai-workflow-text')) {
                        const block = document.createElement('div');
                        block.className = 'ai-workflow-block ai-workflow-text';
                        block.innerHTML = '<div style="color:var(--text-secondary);font-size:13px">操作已执行完成。</div>';
                        content.appendChild(block);
                    }
                }
            }
            this.stopGeneration(this._streamFullResponse, !!data.error);
        }
    },

    _scrollDebounced() {
        if (this._scrollTimer) return;
        const doScroll = () => {
            const msgs = this._messagesContainer;
            if (msgs && msgs.lastElementChild) {
                this.scrollToNewContent(msgs.lastElementChild);
            }
        };
        if (this._lastScrollTime && Date.now() - this._lastScrollTime < 200) {
            this._scrollTimer = setTimeout(() => {
                this._scrollTimer = null;
                doScroll();
            }, 200);
            return;
        }
        this._scrollTimer = requestAnimationFrame(() => {
            this._scrollTimer = null;
            doScroll();
            this._lastScrollTime = Date.now();
        });
    },


    _hideOldThinkingChains() {
        // No longer needed - we reuse a single thinking block
    },

    _collapseCompletedTaskThinking() {
        document.querySelectorAll('.ai-thinking-block[data-state="streaming"]').forEach(b => {
            b.dataset.state = 'done';
            b.classList.remove('expanded');
            const body = b.querySelector('.ai-thinking-body');
            if (body) body.classList.remove('open');
            const chevron = b.querySelector('.ai-thinking-chevron');
            if (chevron) chevron.classList.remove('open');
            const label = b.querySelector('.ai-thinking-label');
            if (label) label.textContent = '思考过程';
        });
        if (this.thinkingBubble) {
            this.thinkingBubble = null;
            this._thinkingContentEl = null;
            this._thinkingTimerEl = null;
        }
        if (this._reasoningTimer) { clearInterval(this._reasoningTimer); this._reasoningTimer = null; }
        if (this._reasoningRAF) { cancelAnimationFrame(this._reasoningRAF); this._reasoningRAF = null; }
    },

    _countFileChanges() {
        let additions = 0, deletions = 0, files = new Set();
        const toolCalls = document.querySelectorAll('.ai-tool-call-row');
        toolCalls.forEach(row => {
            const nameEl = row.querySelector('.ai-tool-call-name');
            if (!nameEl) return;
            const name = nameEl.textContent || '';
            if (name.includes('编辑') || name.includes('edit')) {
                const diffEl = row.querySelector('.ai-tool-call-diff');
                if (diffEl) {
                    const text = diffEl.textContent || '';
                    const addMatch = text.match(/\+(\d+)/);
                    const delMatch = text.match(/-(\d+)/);
                    if (addMatch) additions += parseInt(addMatch[1]);
                    if (delMatch) deletions += parseInt(delMatch[1]);
                }
                const pathEl = row.querySelector('.ai-tool-call-path');
                if (pathEl) files.add(pathEl.textContent);
            }
        });
        return { total: files.size, additions, deletions };
    },

    _flushThinkingSteps() {
        const steps = this._pendingThinkingSteps;
        if (!steps || steps.length === 0) return;
        this._pendingThinkingSteps = [];

        if (!this._thinkingChainBubble) {
            const bubble = document.createElement('div');
            bubble.className = 'ai-thinking-block';
            bubble.dataset.state = 'streaming';
            const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><polyline points="6 9 12 15 18 9"/></svg>';
            bubble.innerHTML = `<div class="ai-thinking-header" onclick="AIChat.toggleReasoningBlock(this.parentElement)"><span class="ai-thinking-label">思考中...</span><span class="ai-thinking-timer"></span><span class="ai-thinking-chevron">${CHEVRON}</span></div><div class="ai-thinking-body"><div class="ai-thinking-content"></div></div>`;
            this.appendWorkflowBlock(bubble);
            this._thinkingChainBubble = bubble;
            this._hideOldThinkingChains();
            this._thinkingChainStepsEl = bubble.querySelector('.ai-thinking-content');
            this._thinkingChainStartTime = Date.now();
            if (this._thinkingChainTimer) clearInterval(this._thinkingChainTimer);
            this._thinkingChainTimer = setInterval(() => {
                const b = this._thinkingChainBubble;
                if (!b) return;
                const timerEl = b.querySelector('.ai-thinking-timer');
                if (timerEl && b.dataset.state === 'streaming') {
                    const s = Math.floor((Date.now() - this._thinkingChainStartTime) / 1000);
                    timerEl.textContent = s > 0 ? s + 's' : '';
                }
            }, 1000);
        }

        const stepsEl = this._thinkingChainStepsEl;
        if (!stepsEl) return;
        const CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" style="width:10px;height:10px"><polyline points="3 8 7 12 13 4"/></svg>';
        const EDIT = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px"><path d="M11 2l3 3-9 9H2v-3z"/></svg>';

        for (const step of steps) {
            const existingStep = stepsEl.querySelector(`[data-thought="${step.thought_number}"]`);
            if (existingStep) {
                const contentEl = existingStep.querySelector('.rc-step-content');
                if (contentEl) {
                    const textEl = contentEl.querySelector('.rc-step-text');
                    if (textEl) textEl.textContent = step.thought;
                }
                if (step.is_revision) existingStep.classList.add('revision');
                continue;
            }
            const el = document.createElement('div');
            el.className = 'rc-chain-step done';
            el.dataset.thought = step.thought_number;
            if (step.is_revision) el.classList.add('revision');
            if (step.branch_from_thought) el.classList.add('branch');
            const total = step.total_thoughts;
            el.innerHTML = `<div class="rc-step-indicator"><div class="rc-step-dot">${step.is_revision ? EDIT : CHECK}</div><div class="rc-step-line"></div></div><div class="rc-step-content"><span class="rc-step-number">${step.thought_number}/${total}</span>${step.is_revision ? '<span class="rc-step-badge revision">修正</span>' : ''}${step.branch_from_thought ? '<span class="rc-step-badge branch">分支</span>' : ''}<span class="rc-step-text">${this._escapeHtml(step.thought)}</span></div>`;
            stepsEl.appendChild(el);
        }

        const lastStep = steps[steps.length - 1];
        if (lastStep && !lastStep.next_thought_needed) {
            if (this._thinkingChainTimer) { clearInterval(this._thinkingChainTimer); this._thinkingChainTimer = null; }
            const bubble = this._thinkingChainBubble;
            if (bubble) {
                bubble.dataset.state = 'done';
                const label = bubble.querySelector('.ai-thinking-label');
                if (label) label.textContent = `思考完成 (${lastStep.total_thoughts}步)`;
            }
            this._thinkingChainBubble = null;
            this._thinkingChainStepsEl = null;
            this._thinkingChainStartTime = null;
            this._thinkingChainTimer = null;
        }
        this._scrollDebounced();
    },

    collapseReasoningBlock(bubble, delay) {
        if (!bubble) return;
        setTimeout(() => {
            if (!bubble) return;
            bubble.classList.remove('expanded');
            const body = bubble.querySelector('.ai-thinking-body');
            if (body) body.classList.remove('open');
            const chevron = bubble.querySelector('.ai-thinking-chevron');
            if (chevron) chevron.classList.remove('open');
        }, delay || 200);
    },

    toggleReasoningBlock(bubble) {
        if (!bubble) return;
        const isExpanded = bubble.classList.contains('expanded');
        if (isExpanded) {
            bubble.classList.remove('expanded');
            const body = bubble.querySelector('.ai-thinking-body');
            if (body) body.classList.remove('open');
            const chevron = bubble.querySelector('.ai-thinking-chevron');
            if (chevron) chevron.classList.remove('open');
        } else {
            bubble.classList.add('expanded');
            const body = bubble.querySelector('.ai-thinking-body');
            if (body) body.classList.add('open');
            const chevron = bubble.querySelector('.ai-thinking-chevron');
            if (chevron) chevron.classList.add('open');
        }
    },

    updateSendButton(isGenerating) {
        document.getElementById('ai-send-btn').style.display = isGenerating ? 'none' : '';
        document.getElementById('ai-stop-btn').style.display = isGenerating ? '' : 'none';
        if (!isGenerating) {
            const inputArea = document.querySelector('.rc-input-area');
            if (inputArea) inputArea.style.display = '';
            this._updateSendBtnState();
        }
    },

    _updateSendBtnState() {
        const input = document.getElementById('ai-input');
        const btn = document.getElementById('ai-send-btn');
        if (!input || !btn) return;
        if (input.value.trim().length > 0) {
            btn.classList.add('has-content');
        } else {
            btn.classList.remove('has-content');
        }
    },

    _toggleSidebarSearch() {
        const search = document.getElementById('ai-chat-search');
        if (!search) return;
        const isVisible = search.style.display !== 'none';
        search.style.display = isVisible ? 'none' : '';
        if (!isVisible) search.focus();
        else { search.value = ''; this.renderSidebar(); }
    },

    _updateFolderSelector() {
        const label = document.getElementById('ai-folder-label');
        if (label) label.textContent = this._currentFolderName;
    },

    async _showFolderDropdown() {
        const existing = document.getElementById('ai-folder-dropdown');
        if (existing) { existing.remove(); return; }

        const btn = document.querySelector('.rc-context-item-folder');
        if (!btn) return;
        const rect = btn.getBoundingClientRect();

        const dropdown = document.createElement('div');
        dropdown.id = 'ai-folder-dropdown';
        dropdown.className = 'ai-folder-dropdown';
        dropdown.style.cssText = `position:fixed;left:${rect.left}px;bottom:${window.innerHeight - rect.top + 6}px;`;

        let html = '<div class="ai-folder-dropdown-header">最近</div>';
        if (this._recentFolders.length === 0) {
            html += '<div class="ai-folder-dropdown-item" style="color:var(--ai-text-muted);cursor:default;opacity:0.6">暂无最近使用的文件夹</div>';
        }
        for (const f of this._recentFolders) {
            const isActive = f.path === this._currentFolderPath;
            html += `<div class="ai-folder-dropdown-item${isActive ? ' active' : ''}" data-path="${this.escapeHtml(f.path)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;flex-shrink:0"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                <div class="ai-folder-dropdown-item-info">
                    <span class="ai-folder-dropdown-item-name">${this.escapeHtml(f.name)}</span>
                    <span class="ai-folder-dropdown-item-path">${this.escapeHtml(f.path)}</span>
                </div>
                ${isActive ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--ai-success,#22c55e);flex-shrink:0"><polyline points="3 8 7 12 13 4"/></svg>' : ''}
            </div>`;
        }
        html += `<div class="ai-folder-dropdown-divider"></div>`;
        html += `<div class="ai-folder-dropdown-item add-folder" id="ai-folder-select-new">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;flex-shrink:0"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
            <span>选择文件夹</span>
        </div>`;

        dropdown.innerHTML = html;
        document.body.appendChild(dropdown);

        dropdown.querySelectorAll('.ai-folder-dropdown-item[data-path]').forEach(item => {
            item.addEventListener('click', () => {
                const path = item.dataset.path;
                this._selectFolder(path);
                dropdown.remove();
            });
        });

        document.getElementById('ai-folder-select-new').addEventListener('click', async () => {
            dropdown.remove();
            await this._pickNewFolder();
        });

        const closeHandler = (e) => {
            if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
                dropdown.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 10);
    },

    _selectFolder(path) {
        const folder = this._recentFolders.find(f => f.path === path);
        if (!folder) return;
        if (!this._trustedFolders.includes(path)) {
            this._showTrustDialog(folder.name, path);
            return;
        }
        this._currentFolderPath = path;
        this._currentFolderName = folder.name;
        this._updateFolderSelector();
        this.renderSidebar();
    },

    async _pickNewFolder() {
        try {
            const result = await window.electronAPI.selectFolder({ title: '选择项目文件夹' });
            if (result.cancelled || !result.path) return;
            const folderPath = result.path;
            const folderName = folderPath.split(/[\\/]/).pop() || folderPath;
            if (!this._trustedFolders.includes(folderPath)) {
                this._showTrustDialog(folderName, folderPath);
                return;
            }
            this._addToRecentFolders(folderPath, folderName);
            this._currentFolderPath = folderPath;
            this._currentFolderName = folderName;
            this._updateFolderSelector();
            this.renderSidebar();
        } catch (e) {}
    },

    _showTrustDialog(folderName, folderPath) {
        const existing = document.getElementById('ai-trust-dialog-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ai-trust-dialog-overlay';
        overlay.className = 'ai-trust-dialog-overlay';
        overlay.innerHTML = `
            <div class="ai-trust-dialog">
                <button class="ai-trust-dialog-close" id="ai-trust-dialog-close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <div class="ai-trust-dialog-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:32px;height:32px"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                </div>
                <h3 class="ai-trust-dialog-title">允许 VersePC 修改"${this.escapeHtml(folderName)}"中的文件吗？</h3>
                <p class="ai-trust-dialog-desc">这将包括所有文件和子文件夹。VersePC 可以执行、读取、编辑和永久删除文件，并可能与其连接的第三方工具共享文件内容。请注意敏感信息的安全。</p>
                <button class="ai-trust-dialog-btn allow" id="ai-trust-btn-allow">允许</button>
                <button class="ai-trust-dialog-btn cancel" id="ai-trust-btn-cancel">取消</button>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('ai-trust-btn-allow').addEventListener('click', () => {
            this._trustedFolders.push(folderPath);
            window.electronAPI.store.set('versepc_ai_trusted_folders', JSON.stringify(this._trustedFolders));
            this._addToRecentFolders(folderPath, folderName);
            this._currentFolderPath = folderPath;
            this._currentFolderName = folderName;
            this._updateFolderSelector();
            this.renderSidebar();
            overlay.remove();
        });

        document.getElementById('ai-trust-btn-cancel').addEventListener('click', () => overlay.remove());
        document.getElementById('ai-trust-dialog-close').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    },

    _addToRecentFolders(path, name) {
        this._recentFolders = this._recentFolders.filter(f => f.path !== path);
        this._recentFolders.unshift({ path, name, addedAt: Date.now() });
        if (this._recentFolders.length > 20) this._recentFolders.length = 20;
        window.electronAPI.store.set('versepc_ai_recent_folders', JSON.stringify(this._recentFolders));
    },

    renderSidebar(filter) {
        const list = document.getElementById('ai-chat-list');
        if (!list) return;
        list.innerHTML = '';

        const query = (filter || '').toLowerCase().trim();
        let convs = Array.isArray(this.conversations) ? this.conversations : [];
        if (query) {
            convs = convs.filter(c =>
                c.title.toLowerCase().includes(query) ||
                c.messages.some(m => m.content.toLowerCase().includes(query))
            );
        }

        const taskSvg = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px"><path d="M14 2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/><polyline points="14 2 14 8 10 8"/></svg>';
        const checkSvg = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;color:var(--ai-success,#22c55e)"><polyline points="3 8 7 12 13 4"/></svg>';
        const folderSvg = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px"><path d="M2 4a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4z"/></svg>';
        const chevronSvg = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px"><path d="M6 4l4 4-4 4"/></svg>';

        const groups = {};
        const groupOrder = [];
        for (const conv of convs) {
            const fp = conv.folderPath || '__ungrouped__';
            if (!groups[fp]) {
                groups[fp] = [];
                groupOrder.push(fp);
            }
            groups[fp].push(conv);
        }

        for (const fp of groupOrder) {
            const convsInGroup = groups[fp];
            const isUngrouped = fp === '__ungrouped__';

            if (!isUngrouped || convs.length > convsInGroup.length) {
                const header = document.createElement('div');
                header.className = 'ai-sidebar-group-header';
                const folderName = isUngrouped ? '未分类' : (fp.split(/[\\/]/).pop() || fp);
                header.innerHTML = `
                    <span class="ai-sidebar-group-chevron open">${chevronSvg}</span>
                    ${isUngrouped ? '' : `<span class="ai-sidebar-group-icon">${folderSvg}</span>`}
                    <span class="ai-sidebar-group-name">${this.escapeHtml(folderName)}</span>
                    <span class="ai-sidebar-group-count">${convsInGroup.length}</span>
                `;
                list.appendChild(header);

                const groupBody = document.createElement('div');
                groupBody.className = 'ai-sidebar-group-body open';

                header.addEventListener('click', () => {
                    const isOpen = groupBody.classList.toggle('open');
                    header.querySelector('.ai-sidebar-group-chevron').classList.toggle('open', isOpen);
                });

                for (const conv of convsInGroup) {
                    const item = this._createChatItem(conv, taskSvg, checkSvg);
                    groupBody.appendChild(item);
                }
                list.appendChild(groupBody);
            } else {
                for (const conv of convsInGroup) {
                    const item = this._createChatItem(conv, taskSvg, checkSvg);
                    list.appendChild(item);
                }
            }
        }

        if (convs.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'ai-sidebar-empty';
            empty.textContent = query ? '未找到匹配的对话' : '暂无对话，点击上方新建';
            list.appendChild(empty);
        }
    },

    _createChatItem(conv, taskSvg, checkSvg) {
        const item = document.createElement('div');
        item.className = 'ai-chat-item' + (conv.id === this.currentId ? ' active' : '');
        item.onclick = () => this.switchTo(conv.id);
        item.ondblclick = () => this.startRename(conv.id);
        item.oncontextmenu = (e) => {
            e.preventDefault();
            this._showConvContextMenu(e, conv.id);
        };

        let statusClass = 'pending';
        let statusIcon = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px"><circle cx="8" cy="8" r="6"/></svg>';
        if (conv.messages && conv.messages.length > 0) {
            const lastMsg = conv.messages[conv.messages.length - 1];
            const isCompleted = lastMsg.role === 'assistant' && lastMsg.tool_calls && lastMsg.tool_calls.some(tc => tc.name === 'attempt_completion');
            if (isCompleted) {
                statusClass = 'completed';
                statusIcon = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--ai-success,#22c55e)"><circle cx="8" cy="8" r="6"/><polyline points="5 8 7 10 11 6"/></svg>';
            } else {
                statusClass = 'active';
                statusIcon = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;color:var(--ai-accent,#6366f1)"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>';
            }
        }

        const iconSpan = document.createElement('span');
        iconSpan.className = 'ai-chat-item-status ' + statusClass;
        iconSpan.innerHTML = statusIcon;

        const titleSpan = document.createElement('span');
        titleSpan.className = 'ai-chat-item-title';
        titleSpan.textContent = conv.title;

        const delBtn = document.createElement('button');
        delBtn.className = 'ai-chat-item-delete';
        delBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
        delBtn.onclick = (e) => this.deleteConv(conv.id, e);

        item.appendChild(iconSpan);
        item.appendChild(titleSpan);
        item.appendChild(delBtn);
        return item;
    },

    _showConvContextMenu(event, convId) {
        const existing = document.getElementById('ai-conv-context-menu');
        if (existing) existing.remove();
        
        const menu = document.createElement('div');
        menu.id = 'ai-conv-context-menu';
        menu.className = 'ai-conv-context-menu';
        menu.innerHTML = `
            <div class="ai-conv-context-item" onclick="AIChat.startRename('${convId}');document.getElementById('ai-conv-context-menu').remove()">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:13px;height:13px"><path d="M11.5 1.5l3 3-9 9H2v-3z"/></svg>
                重命名
            </div>
            <div class="ai-conv-context-item" onclick="AIChat._showExportDialog();document.getElementById('ai-conv-context-menu').remove()">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:13px;height:13px"><path d="M14 10v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3M8 2v8M5 5l3-3 3 3"/></svg>
                导出
            </div>
            <div class="ai-conv-context-item danger" onclick="AIChat.deleteConv('${convId}');document.getElementById('ai-conv-context-menu').remove()">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:13px;height:13px"><path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M13 4v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4"/></svg>
                删除
            </div>
        `;
        document.body.appendChild(menu);
        
        const rect = event.target.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.left = rect.right + 4 + 'px';
        menu.style.top = rect.top + 'px';
        
        const close = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', close);
            }
        };
        setTimeout(() => document.addEventListener('click', close), 10);
    },

    toggleSidebar() {
        const sidebar = document.getElementById('ai-chat-sidebar');
        const overlay = document.getElementById('ai-sidebar-overlay');
        const historyBtn = document.getElementById('ai-history-btn');
        if (!sidebar) return;
        const isOpen = sidebar.classList.contains('open');
        if (isOpen) {
            sidebar.classList.remove('open');
            if (overlay) { overlay.classList.remove('visible'); }
            if (historyBtn) historyBtn.classList.remove('active');
        } else {
            sidebar.classList.add('open');
            if (overlay) { overlay.classList.add('visible'); }
            if (historyBtn) historyBtn.classList.add('active');
            this.renderSidebar();
        }
    },

    startRename(id) {
        const conv = this.getConv(id);
        if (!conv) return;

        const list = document.getElementById('ai-chat-list');
        const items = list.querySelectorAll('.ai-chat-item');
        for (const item of items) {
            const titleSpan = item.querySelector('span');
            if (!titleSpan || titleSpan.textContent !== conv.title) continue;

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'ai-chat-item-rename';
            input.value = conv.title;
            titleSpan.replaceWith(input);
            input.focus();
            input.select();

            const finishRename = async () => {
                const newTitle = input.value.trim() || conv.title;
                conv.title = newTitle;
                this.saveConversations();
                this.renderSidebar(document.getElementById('ai-chat-search')?.value);
            };

            input.onblur = finishRename;
            input.onkeydown = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
                if (e.key === 'Escape') { input.value = conv.title; input.blur(); }
            };
            break;
        }
    },

    async clearAllChats() {
        if (!confirm('确定要清空所有对话历史吗？此操作不可撤销。')) return;
        this.flushTypewriter();
        if (this._reasoningTimer) { clearInterval(this._reasoningTimer); this._reasoningTimer = null; }
        this._scrollTimer = null;
        this.thinkingBubble = null;
        this._lastThinkingBubble = null;
        this.toolCallBubble = null;
        this.typewriterTextBlock = null;
        this.conversations = [];
        this.currentId = null;
        this.saveConversations();
        this.newChat();
    },

    toggleSettings() {
        const page = document.getElementById('ai-settings-page');
        const welcome = document.getElementById('ai-welcome');
        const messages = this._messagesContainer;
        const inputArea = document.querySelector('.rc-input-area');
        const sidebar = document.getElementById('ai-chat-sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            const overlay = document.getElementById('ai-sidebar-overlay');
            if (overlay) overlay.classList.remove('visible');
            const historyBtn = document.getElementById('ai-history-btn');
            if (historyBtn) historyBtn.classList.remove('active');
        }

        if (page.classList.contains('rc-settings-closed')) {
            page.classList.remove('rc-settings-closed');
            welcome.style.display = 'none';
            messages.style.display = 'none';
            inputArea.style.display = 'none';
            this.loadSettingsUI();
            this.renderSettingsPanel();
        } else {
            page.classList.add('rc-settings-closed');
            setTimeout(() => {
                if (page.classList.contains('rc-settings-closed')) {
                    welcome.style.display = '';
                    messages.style.display = '';
                    inputArea.style.display = '';
                }
            }, 300);
        }
    },

    _settingsTabs: [
        { id: 'providers', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v6m0 8v6M2 12h6m8 0h6"/><circle cx="12" cy="12" r="3"/></svg>', label: '模型接入' },
        { id: 'autoApprove', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>', label: '自动批准' },
        { id: 'notifications', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>', label: '通知' },
        { id: 'context', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>', label: '上下文' },
        { id: 'terminal', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M6 9l4 4-4 4"/></svg>', label: '终端' },
        { id: 'prompts', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>', label: '提示词' },
        { id: 'ui', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M2 12h2M20 12h2M12 2v2M12 20v2"/></svg>', label: '界面' },
        { id: 'experimental', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6v4H9z"/><path d="M10 9V3M14 9V3"/><path d="M7 9l-2 12h14l-2-12"/></svg>', label: '实验性' },
        { id: 'language', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>', label: '语言' },
        { id: 'about', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>', label: '关于' },
        { id: 'memory', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4a3 3 0 110 6 3 3 0 010-6zm0 14c-2.67 0-8-1.34-8-4v-2c0-2.66 5.33-4 8-4s8 1.34 8 4v2c0 2.66-5.33 4-8 4z"/></svg>', label: '记忆' },
        { id: 'projectInstructions', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>', label: '项目指令' },
        { id: 'mcp', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>', label: 'MCP 服务器' },
    ],

    _currentSettingsTab: 'providers',

    async renderSettingsPanel() {
        await this._refreshProviderKeyStatus();
        const tabList = document.getElementById('rc-settings-tab-list');
        const tabContent = document.getElementById('rc-settings-tab-content');
        if (!tabList || !tabContent) return;

        tabList.innerHTML = this._settingsTabs.map(t =>
            `<button class="rc-settings-tab-trigger${t.id === this._currentSettingsTab ? ' active' : ''}" data-tab="${t.id}">${t.icon}<span class="rc-settings-tab-label">${t.label}</span></button>`
        ).join('');

        tabList.querySelectorAll('.rc-settings-tab-trigger').forEach(btn => {
            btn.addEventListener('click', () => this._switchSettingsTab(btn.dataset.tab));
        });

        tabContent.innerHTML = this._renderSettingsTabContent(this._currentSettingsTab);

        this._setupSettingsSearch();
        this._markSettingsDirty(false);
    },

    _switchSettingsTab(tabId) {
        this._currentSettingsTab = tabId;
        document.querySelectorAll('.rc-settings-tab-trigger').forEach(b => b.classList.remove('active'));
        const active = document.querySelector(`.rc-settings-tab-trigger[data-tab="${tabId}"]`);
        if (active) active.classList.add('active');
        const content = document.getElementById('rc-settings-tab-content');
        if (content) {
            content.innerHTML = this._renderSettingsTabContent(tabId);
        }
    },

    _markSettingsDirty(dirty) {
        const btn = document.getElementById('rc-settings-save-btn');
        if (btn) btn.disabled = !dirty;
    },

    _setupSettingsSearch() {
        const input = document.getElementById('rc-settings-search-input');
        if (!input) return;
        input.addEventListener('input', () => {
            const q = input.value.toLowerCase().trim();
            if (!q) { this._switchSettingsTab(this._currentSettingsTab); return; }
            const tabContent = document.getElementById('rc-settings-tab-content');
            if (!tabContent) return;
            let found = false;
            for (const tab of this._settingsTabs) {
                const tmp = document.createElement('div');
                tmp.innerHTML = this._renderSettingsTabContent(tab.id);
                const items = tmp.querySelectorAll('.rc-settings-item, .rc-settings-section-header');
                for (const item of items) {
                    if (item.textContent.toLowerCase().includes(q)) {
                        this._currentSettingsTab = tab.id;
                        tabContent.innerHTML = this._renderSettingsTabContent(tab.id);
                        document.querySelectorAll('.rc-settings-tab-trigger').forEach(b => b.classList.remove('active'));
                        const activeBtn = document.querySelector(`.rc-settings-tab-trigger[data-tab="${tab.id}"]`);
                        if (activeBtn) activeBtn.classList.add('active');
                        setTimeout(() => {
                            tabContent.querySelectorAll('.rc-settings-item').forEach(el => {
                                if (el.textContent.toLowerCase().includes(q)) {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    el.style.background = 'var(--ai-bg-active)';
                                    setTimeout(() => el.style.background = '', 1500);
                                }
                            });
                        }, 50);
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
        });
    },

    _renderSettingsTabContent(tabId) {
        switch (tabId) {
            case 'providers': return this._renderProvidersTab();
            case 'providers-add': return this._renderProvidersAddPanel();
            case 'autoApprove': return this._renderAutoApproveTab();
            case 'notifications': return this._renderNotificationsTab();
            case 'context': return this._renderContextTab();
            case 'terminal': return this._renderTerminalTab();
            case 'prompts': return this._renderPromptsTab();
            case 'ui': return this._renderUITab();
            case 'experimental': return this._renderExperimentalTab();
            case 'language': return this._renderLanguageTab();
            case 'about': return this._renderAboutTab();
            case 'memory': return this._renderMemoryTab();
            case 'projectInstructions': return this._renderProjectInstructionsTab();
            case 'mcp': return this._renderMcpSettings();
            default: return '';
        }
    },

    _sectionHeader(title, desc) {
        let h = `<div class="rc-settings-section-header"><h3>${title}</h3>`;
        if (desc) h += `<p>${desc}</p>`;
        return h + '</div>';
    },

    _section(body) { return `<div class="rc-settings-section">${body}</div>`; },

    _checkbox(id, label, checked, onChange) {
        return `<div class="rc-settings-item" data-setting-id="${id}"><label class="rc-settings-checkbox"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} onchange="${onChange}"><span>${label}</span></label></div>`;
    },

    _slider(id, label, min, max, step, value, unit, onChange) {
        return `<div class="rc-settings-item" data-setting-id="${id}"><label class="rc-settings-item-label">${label}</label><div class="rc-settings-slider-row"><input type="range" class="rc-settings-slider" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" oninput="document.getElementById('${id}-val').textContent=this.value+'${unit}';${onChange}"><span class="rc-settings-slider-value" id="${id}-val">${value}${unit}</span></div></div>`;
    },

    _select(id, label, options, selected, onChange) {
        const opts = options.map(o => `<option value="${o.value}" ${o.value === selected ? 'selected' : ''}>${o.label}</option>`).join('');
        return `<div class="rc-settings-item" data-setting-id="${id}"><label class="rc-settings-item-label">${label}</label><select class="rc-settings-select" id="${id}" onchange="${onChange}">${opts}</select></div>`;
    },

    _textArea(id, label, placeholder, value, rows, onChange) {
        return `<div class="rc-settings-item" data-setting-id="${id}"><label class="rc-settings-item-label">${label}</label><textarea class="rc-settings-textarea" id="${id}" rows="${rows || 4}" placeholder="${placeholder}" oninput="${onChange}">${this._escapeHtml(value || '')}</textarea></div>`;
    },

    _escapeHtml(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },

    _renderProvidersTab() {
        const providerNames = { zhipu:'智谱 GLM', deepseek:'DeepSeek', qwen:'通义千问', moonshot:'Kimi', yi:'零一万物', baichuan:'百川', minimax:'MiniMax', stepfun:'阶跃星辰', siliconflow:'SiliconFlow', openrouter:'OpenRouter', groq:'Groq', openai:'OpenAI', anthropic:'Anthropic', google:'Google' };
        const providerUrls = { zhipu:'https://open.bigmodel.cn', deepseek:'https://platform.deepseek.com', qwen:'https://dashscope.aliyuncs.com', moonshot:'https://platform.moonshot.cn', openai:'https://platform.openai.com', anthropic:'https://console.anthropic.com', google:'https://aistudio.google.com', siliconflow:'https://cloud.siliconflow.cn', openrouter:'https://openrouter.ai', groq:'https://console.groq.com' };
        let modelsHtml = '';
        const allModels = Array.isArray(this.addedModels) ? this.addedModels : [];
        for (const m of allModels) {
            const isCurrent = m.modelId === this.model;
            const modelIconSvg = m.providerKey ? this._getProviderSvgIcon(m.providerKey) : '';
            modelsHtml += `<tr><td><div class="rc-model-name-cell"><div class="rc-model-icon ${m.providerKey||''}">${modelIconSvg}</div><div><div class="rc-model-name">${isCurrent?'<span class="rc-model-active-dot"></span>':''}${m.modelName||m.modelId}</div><div class="rc-model-id">${m.modelId}</div></div></div></td><td><span class="rc-provider-badge">${providerNames[m.providerKey]||m.providerKey||'-'}${m.free?'<span class="rc-free-badge">FREE</span>':''}</span></td><td>${isCurrent?`<span class="rc-model-in-use">使用中</span> <button class="rc-table-action danger" onclick="AIChat.removeModelFromTable('${m.modelId}')">移除</button>`:`<button class="rc-table-action" onclick="AIChat.selectModelFromTable('${m.modelId}')">使用</button> <button class="rc-table-action danger" onclick="AIChat.removeModelFromTable('${m.modelId}')">移除</button>`}</td></tr>`;
        }
        if (!allModels.length) modelsHtml = '<tr><td colspan="3" class="rc-model-table-empty">暂无模型，点击下方平台卡片添加</td></tr>';

        let providerCardsHtml = '';
        const builtinProviders = this.providers.length > 0 ? this.providers : [
            { key:'deepseek', name:'DeepSeek' }, { key:'openai', name:'OpenAI' }, { key:'anthropic', name:'Anthropic' },
            { key:'google', name:'Google' }, { key:'zhipu', name:'智谱 GLM' }, { key:'qwen', name:'通义千问' },
            { key:'moonshot', name:'Kimi' }, { key:'siliconflow', name:'SiliconFlow' }, { key:'groq', name:'Groq' },
            { key:'openrouter', name:'OpenRouter' }
        ];
        for (const p of builtinProviders) {
            const iconSvg = this._getProviderSvgIcon(p.key);
            const url = providerUrls[p.key] || '';
            const hasKey = this._checkProviderHasKey(p.key);
            const chevronSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6 9 12 15 18 9"/></svg>';
            const checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="6 12 10 16 18 8"/></svg>';
            providerCardsHtml += `<div class="rc-provider-card${hasKey?' has-key':''}" data-provider="${p.key}" onclick="AIChat._toggleProviderCard('${p.key}')">
                <div class="rc-provider-card-header">
                    <div class="rc-provider-card-icon-wrapper"><div class="rc-provider-card-icon ${p.key}">${iconSvg}</div></div>
                    <span class="rc-provider-card-name">${p.name}</span>
                    <span class="rc-provider-card-status-icon">
                        <span class="rc-provider-card-chevron">${chevronSvg}</span>
                        <span class="rc-provider-card-check-icon">${checkSvg}</span>
                    </span>
                </div>
                <div class="rc-provider-card-body" id="provider-body-${p.key}" onclick="event.stopPropagation()">
                    <div class="rc-apikey-form">
                        <div class="rc-apikey-form-header">
                            <div class="rc-apikey-form-header-title">
                                <span class="rc-apikey-form-label">API Key</span>
                                ${url ? `<a href="${url}" target="_blank" class="rc-apikey-get-link"><label>获取</label><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : ''}
                            </div>
                        </div>
                        <div class="rc-apikey-form-input-wrap">
                            <input type="password" class="rc-apikey-form-input" id="apikey-${p.key}" placeholder="sk-..." value="" autocomplete="off">
                            <span class="rc-apikey-input-icon" onclick="event.stopPropagation();AIChat._toggleApiKeyVisibility('apikey-${p.key}')">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            </span>
                        </div>
                        <div class="rc-apikey-actions">
                            <button class="rc-btn rc-btn-primary rc-btn-sm" onclick="event.stopPropagation();AIChat._saveProviderKey('${p.key}')">保存</button>
                            ${hasKey ? `<button class="rc-btn rc-btn-secondary rc-btn-sm" onclick="event.stopPropagation();AIChat._removeProviderKey('${p.key}')">移除</button>` : ''}
                        </div>
                    </div>
                </div>
            </div>`;
        }
        const customHasKey = this._customProvider?.baseUrl;
        const chevronSvg2 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6 9 12 15 18 9"/></svg>';
        const checkSvg2 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="6 12 10 16 18 8"/></svg>';
        providerCardsHtml += `<div class="rc-provider-card custom${customHasKey?' has-key':''}" onclick="AIChat._toggleProviderCard('custom')">
            <div class="rc-provider-card-header">
                <div class="rc-provider-card-icon-wrapper"><div class="rc-provider-card-icon custom">+</div></div>
                <span class="rc-provider-card-name">自定义服务商</span>
                <span class="rc-provider-card-status-icon">
                    <span class="rc-provider-card-chevron">${chevronSvg2}</span>
                    <span class="rc-provider-card-check-icon">${checkSvg2}</span>
                </span>
            </div>
            <div class="rc-provider-card-body" id="provider-body-custom" onclick="event.stopPropagation()">
                <div class="rc-apikey-form">
                    <div class="rc-apikey-form-header">
                        <div class="rc-apikey-form-header-title"><span class="rc-apikey-form-label">Base URL</span></div>
                    </div>
                    <div class="rc-apikey-form-input-wrap"><input type="url" class="rc-apikey-form-input" id="ai-custom-base-url" placeholder="https://api.example.com/v1" value="${this._escapeHtml(this._customProvider?.baseUrl || '')}"></div>
                    <div class="rc-apikey-form-header" style="margin-top:4px">
                        <div class="rc-apikey-form-header-title"><span class="rc-apikey-form-label">API Key</span></div>
                    </div>
                    <div class="rc-apikey-form-input-wrap">
                        <input type="password" class="rc-apikey-form-input" id="ai-custom-api-key" placeholder="sk-..." value="${this._escapeHtml(this._customProvider?.apiKey || '')}">
                        <span class="rc-apikey-input-icon" onclick="event.stopPropagation();AIChat._toggleApiKeyVisibility('ai-custom-api-key')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </span>
                    </div>
                    <div class="rc-apikey-form-header" style="margin-top:4px">
                        <div class="rc-apikey-form-header-title"><span class="rc-apikey-form-label">Model ID</span></div>
                    </div>
                    <div class="rc-apikey-form-input-wrap"><input type="text" class="rc-apikey-form-input" id="ai-custom-model-id" placeholder="gpt-4o" value="${this._escapeHtml(this._customProvider?.modelId || '')}"></div>
                    <div style="display:flex;gap:8px;margin-top:4px">
                        <div style="flex:1"><div class="rc-apikey-form-header"><div class="rc-apikey-form-header-title"><span style="font-size:12px;color:var(--text-text-secondary,#9599a6)">API 格式</span></div></div><select class="rc-settings-select" id="ai-custom-api-format" style="width:100%;height:28px;margin-top:2px"><option value="openai" ${(this._customProvider?.apiFormat||'openai')==='openai'?'selected':''}>OpenAI</option><option value="anthropic" ${this._customProvider?.apiFormat==='anthropic'?'selected':''}>Anthropic</option></select></div>
                        <div style="flex:1"><div class="rc-apikey-form-header"><div class="rc-apikey-form-header-title"><span style="font-size:12px;color:var(--text-text-secondary,#9599a6)">显示名称</span></div></div><input type="text" class="rc-apikey-form-input" id="ai-custom-model-name" placeholder="可选" value="${this._escapeHtml(this._customProvider?.modelName || '')}" style="height:28px;margin-top:2px;padding:0 8px;border:1px solid var(--border-border-neutral-l1,rgba(255,255,255,0.08));border-radius:4px;background:var(--bg-bg-overlay-l1,rgba(237,241,248,0.04))"></div>
                    </div>
                    <div style="display:flex;gap:8px;margin-top:4px">
                        <div style="flex:1"><div class="rc-apikey-form-header"><div class="rc-apikey-form-header-title"><span style="font-size:12px;color:var(--text-text-secondary,#9599a6)">最大 Token</span></div></div><input type="number" class="rc-apikey-form-input" id="ai-custom-max-tokens" placeholder="16384" value="${this._customProvider?.maxTokens || 16384}" style="height:28px;margin-top:2px;padding:0 8px;border:1px solid var(--border-border-neutral-l1,rgba(255,255,255,0.08));border-radius:4px;background:var(--bg-bg-overlay-l1,rgba(237,241,248,0.04))"></div>
                        <div style="flex:1"><div class="rc-apikey-form-header"><div class="rc-apikey-form-header-title"><span style="font-size:12px;color:var(--text-text-secondary,#9599a6)">上下文窗口</span></div></div><input type="number" class="rc-apikey-form-input" id="ai-custom-context-window" placeholder="128000" value="${this._customProvider?.contextWindow || 128000}" style="height:28px;margin-top:2px;padding:0 8px;border:1px solid var(--border-border-neutral-l1,rgba(255,255,255,0.08));border-radius:4px;background:var(--bg-bg-overlay-l1,rgba(237,241,248,0.04))"></div>
                    </div>
                    <div style="margin-top:4px"><label class="rc-settings-checkbox"><input type="checkbox" id="ai-custom-streaming" ${this._customProvider?.streaming !== false ? 'checked' : ''}><span style="font-size:12px;color:var(--text-text-secondary,#9599a6)">启用流式输出</span></label></div>
                    <div class="rc-apikey-actions" style="margin-top:4px"><button class="rc-btn rc-btn-primary rc-btn-sm" onclick="event.stopPropagation();AIChat._saveCustomProvider()">保存并使用</button><span id="ai-custom-status" class="rc-provider-card-status-text"></span></div>
                </div>
            </div>
        </div>`;

        return this._sectionHeader('模型接入', '配置 API 平台和管理可用模型') + this._section(`
            <div class="rc-model-table-header"><label class="rc-settings-item-label" style="margin:0">已添加模型</label></div>
            <div class="rc-model-table-wrap"><table class="rc-model-table"><thead><tr><th width="45%">模型</th><th width="30%">服务商</th><th width="25%">操作</th></tr></thead><tbody>${modelsHtml}</tbody></table></div>
            <div class="rc-provider-grid-header"><label class="rc-settings-item-label" style="margin:0">添加模型</label><span class="rc-settings-item-desc" style="margin:0">选择平台并配置 API Key</span></div>
            <button class="rc-btn rc-btn-primary" onclick="AIChat._showAddModelDialog()" style="width:100%;margin-top:4px;height:32px;font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                添加模型
            </button>
        `);
    },

    _renderProvidersAddPanel() {
        const cp = this._customProvider || {};
        let providerOpts = '';
        for (const p of this.providers) providerOpts += `<option value="${p.key}">${p.name}</option>`;
        return this._sectionHeader('添加新模型', '选择 AI 平台并配置 API Key') + this._section(`
            <div class="rc-settings-item"><label class="rc-settings-item-label">AI 平台</label><select class="rc-settings-select" id="ai-provider-select" onchange="AIChat.onProviderSelect()"><option value="">-- 选择平台 --</option><option value="custom">自定义服务商 (OpenAI Compatible)</option>${providerOpts}</select></div>
            <div id="ai-provider-custom-fields" style="display:none">
                <div class="rc-settings-item" style="margin-top:12px"><label class="rc-settings-item-label">Base URL <span style="color:var(--ai-error,#f44)">*</span></label><input type="url" class="rc-input" id="ai-custom-base-url" placeholder="https://api.example.com/v1" value="${this._escapeHtml(cp.baseUrl || '')}"></div>
                <div class="rc-settings-item"><label class="rc-settings-item-label">API Key <span style="color:var(--ai-error,#f44)">*</span></label><input type="password" class="rc-input" id="ai-custom-api-key" placeholder="sk-..." value="${this._escapeHtml(cp.apiKey || '')}"></div>
                <div class="rc-settings-item"><label class="rc-settings-item-label">Model ID <span style="color:var(--ai-error,#f44)">*</span></label><input type="text" class="rc-input" id="ai-custom-model-id" placeholder="gpt-4o" value="${this._escapeHtml(cp.modelId || '')}"></div>
                <div class="rc-settings-item"><label class="rc-settings-item-label">API 格式</label><select class="rc-settings-select" id="ai-custom-api-format"><option value="openai" ${cp.apiFormat === 'anthropic' ? '' : 'selected'}>OpenAI (Chat Completions)</option><option value="anthropic" ${cp.apiFormat === 'anthropic' ? 'selected' : ''}>Anthropic (Messages API)</option></select><div class="rc-settings-item-desc">选择服务商的 API 接口格式。OpenAI 格式兼容大多数服务商（DeepSeek、GLM、Kimi 等），Anthropic 格式用于 Claude。</div></div>
                <div class="rc-settings-item"><label class="rc-settings-item-label">模型显示名称</label><input type="text" class="rc-input" id="ai-custom-model-name" placeholder="自定义模型 (可选)" value="${this._escapeHtml(cp.modelName || '')}"></div>
                <div class="rc-settings-item"><label class="rc-settings-item-label">最大 Token</label><input type="number" class="rc-input" id="ai-custom-max-tokens" placeholder="16384" value="${cp.maxTokens || 16384}" style="width:120px"></div>
                <div class="rc-settings-item"><label class="rc-settings-item-label">上下文窗口</label><input type="number" class="rc-input" id="ai-custom-context-window" placeholder="128000" value="${cp.contextWindow || 128000}" style="width:120px"></div>
                <div class="rc-settings-item"><label class="rc-settings-item-label">自定义 Headers</label><div id="ai-custom-headers-list">${(cp.headers || []).map((h, i) => `<div style="display:flex;gap:6px;margin-bottom:4px"><input type="text" class="rc-input" placeholder="Header Name" value="${this._escapeHtml(h[0])}" data-idx="${i}" data-field="key" style="flex:1"><input type="text" class="rc-input" placeholder="Header Value" value="${this._escapeHtml(h[1])}" data-idx="${i}" data-field="val" style="flex:1"><button class="rc-btn rc-btn-secondary rc-btn-sm" onclick="AIChat._removeCustomHeader(${i})">✕</button></div>`).join('')}</div><button class="rc-btn rc-btn-secondary rc-btn-sm" onclick="AIChat._addCustomHeader()" style="margin-top:4px">+ 添加 Header</button></div>
                <div class="rc-settings-item" style="margin-top:8px"><label class="rc-settings-checkbox"><input type="checkbox" id="ai-custom-streaming" ${cp.streaming !== false ? 'checked' : ''}><span>启用流式输出</span></label></div>
                <div style="margin-top:12px;display:flex;gap:8px;align-items:center"><button class="rc-btn rc-btn-primary rc-btn-sm" onclick="AIChat._saveCustomProvider()">保存并使用</button><span id="ai-custom-status" style="font-size:12px;color:var(--ai-text-muted)"></span></div>
            </div>
        `);
    },

    async _refreshProviderKeyStatus() {
        const providerKeys = ['deepseek', 'openai', 'anthropic', 'google', 'zhipu', 'qwen', 'moonshot', 'siliconflow', 'groq', 'openrouter', 'yi', 'baichuan', 'minimax', 'stepfun'];
        const results = {};
        for (const pk of providerKeys) {
            try {
                const val = await window.electronAPI.store.get(`versepc_ai_apikey_${pk}`);
                results[pk] = !!val;
            } catch (e) { results[pk] = false; }
        }
        this._providerKeyStatus = results;
    },

    _checkProviderHasKey(providerKey) {
        return !!this._providerKeyStatus[providerKey];
    },

    _toggleProviderCard(providerKey) {
        const body = document.getElementById('provider-body-' + providerKey);
        if (!body) return;
        const card = body.closest('.rc-provider-card');
        const allCards = document.querySelectorAll('.rc-provider-card');
        allCards.forEach(c => {
            if (c !== card) {
                c.classList.remove('expanded');
            }
        });
        if (card) {
            card.classList.toggle('expanded');
        }
    },

    _toggleApiKeyVisibility(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
    },

    async _saveProviderKey(providerKey) {
        const input = document.getElementById('apikey-' + providerKey);
        if (!input) return;
        const apiKey = input.value.trim();
        if (!apiKey) { input.style.borderColor = 'var(--ai-error)'; setTimeout(() => input.style.borderColor = '', 1500); return; }
        const key = `versepc_ai_apikey_${providerKey}`;
        await window.electronAPI.store.set(key, apiKey);
        this.apiKey = apiKey;
        this.model = providerKey + ':default';
        await window.electronAPI.store.set('versepc_ai_model', this.model);
        const models = this.getDefaultModels().filter(m => m.providerKey === providerKey);
        if (models.length > 0) { this.model = models[0].modelId; await window.electronAPI.store.set('versepc_ai_model', this.model); }
        this.updateModelLabel();
        this._providerKeyStatus[providerKey] = true;
        this.renderSettingsPanel();
        if (typeof showToast === 'function') showToast(`${providerKey} API Key 已保存`, 'success');
    },

    async _removeProviderKey(providerKey) {
        const key = `versepc_ai_apikey_${providerKey}`;
        await window.electronAPI.store.set(key, '');
        this._providerKeyStatus[providerKey] = false;
        this.renderSettingsPanel();
        if (typeof showToast === 'function') showToast(`${providerKey} API Key 已移除`, 'success');
    },

    _addCustomHeader() {
        const list = document.getElementById('ai-custom-headers-list');
        if (!list) return;
        const div = document.createElement('div');
        div.style.cssText = 'display:flex;gap:6px;margin-bottom:4px';
        const idx = list.children.length;
        div.innerHTML = `<input type="text" class="rc-input" placeholder="Header Name" data-idx="${idx}" data-field="key" style="flex:1"><input type="text" class="rc-input" placeholder="Header Value" data-idx="${idx}" data-field="val" style="flex:1"><button class="rc-btn rc-btn-secondary rc-btn-sm" onclick="AIChat._removeCustomHeader(${idx})">✕</button>`;
        list.appendChild(div);
    },

    _removeCustomHeader(idx) {
        const list = document.getElementById('ai-custom-headers-list');
        if (!list) return;
        const items = list.querySelectorAll('div');
        if (items[idx]) items[idx].remove();
    },

    _saveCustomProvider() {
        const baseUrl = document.getElementById('ai-custom-base-url')?.value?.trim();
        const apiKey = document.getElementById('ai-custom-api-key')?.value?.trim();
        const modelId = document.getElementById('ai-custom-model-id')?.value?.trim();
        const modelName = document.getElementById('ai-custom-model-name')?.value?.trim();
        const maxTokens = parseInt(document.getElementById('ai-custom-max-tokens')?.value) || 16384;
        const contextWindow = parseInt(document.getElementById('ai-custom-context-window')?.value) || 128000;
        const streaming = document.getElementById('ai-custom-streaming')?.checked !== false;
        const apiFormat = document.getElementById('ai-custom-api-format')?.value || 'openai';

        if (!baseUrl || !apiKey || !modelId) {
            const status = document.getElementById('ai-custom-status');
            if (status) { status.textContent = '请填写 Base URL、API Key 和 Model ID'; status.style.color = 'var(--ai-error,#f44)'; }
            return;
        }

        const headers = [];
        const headerEls = document.querySelectorAll('#ai-custom-headers-list > div');
        headerEls.forEach(el => {
            const key = el.querySelector('[data-field="key"]')?.value?.trim();
            const val = el.querySelector('[data-field="val"]')?.value?.trim();
            if (key) headers.push([key, val || '']);
        });

        this._customProvider = { baseUrl, apiKey, modelId, modelName: modelName || modelId, maxTokens, contextWindow, streaming, headers, apiFormat };

        const fullId = 'custom:' + baseUrl + ':' + modelId;
        const entry = { modelId: fullId, modelName: modelName || modelId, providerKey: 'custom', free: false, apiKey, baseUrl, maxTokens, contextWindow, streaming, headers, apiFormat };
        const exists = this.addedModels.findIndex(m => m.modelId === fullId);
        if (exists >= 0) this.addedModels[exists] = entry;
        else this.addedModels.push(entry);

        this.model = fullId;
        window.electronAPI.store.set('versepc_ai_model', fullId);
        window.electronAPI.store.set('versepc_ai_added_models', JSON.stringify(this.addedModels));
        window.electronAPI.store.set('versepc_ai_custom_provider', JSON.stringify(this._customProvider));
        this.updateModelLabel();

        const status = document.getElementById('ai-custom-status');
        if (status) { status.textContent = '✓ 已保存'; status.style.color = 'var(--ai-success,#34d399)'; }
        setTimeout(() => { if (status) status.textContent = ''; }, 2000);
        this._markSettingsDirty(true);
    },

    _renderAutoApproveTab() {
        const s = this._autoApproveSettings || {};
        return this._sectionHeader('自动批准', '自动批准工具调用，无需手动确认') + this._section(`
            ${this._checkbox('aa-enabled', '启用自动批准', s.enabled, "AIChat._updateAutoApprove('enabled', this.checked)")}
            ${s.enabled ? `<div class="rc-settings-nested">
                ${this._checkbox('aa-read', '自动批准读取文件', s.read, "AIChat._updateAutoApprove('read', this.checked)")}
                ${this._checkbox('aa-write', '自动批准写入文件', s.write, "AIChat._updateAutoApprove('write', this.checked)")}
                ${this._checkbox('aa-execute', '自动执行终端命令', s.execute, "AIChat._updateAutoApprove('execute', this.checked)")}
                ${this._checkbox('aa-mcp', '自动批准 MCP 工具', s.mcp, "AIChat._updateAutoApprove('mcp', this.checked)")}
                ${this._checkbox('aa-mode', '自动批准模式切换', s.mode, "AIChat._updateAutoApprove('mode', this.checked)")}
                ${this._checkbox('aa-subtasks', '自动批准子任务', s.subtasks, "AIChat._updateAutoApprove('subtasks', this.checked)")}
            </div>` : ''}
        `);
    },

    _renderNotificationsTab() {
        const s = this._notifSettings || {};
        return this._sectionHeader('通知', '配置通知和音效') + this._section(`
            ${this._checkbox('notif-tts', '启用文本转语音 (TTS)', s.ttsEnabled, "AIChat._updateNotif('ttsEnabled', this.checked)")}
            ${s.ttsEnabled ? `<div class="rc-settings-nested">${this._slider('notif-tts-speed', 'TTS 速度', 0.1, 2.0, 0.01, s.ttsSpeed || 1.0, 'x', "AIChat._updateNotif('ttsSpeed', parseFloat(this.value))")}</div>` : ''}
            ${this._checkbox('notif-sound', '启用音效', s.soundEnabled !== false, "AIChat._updateNotif('soundEnabled', this.checked)")}
            ${s.soundEnabled !== false ? `<div class="rc-settings-nested">${this._slider('notif-volume', '音量', 0, 1, 0.01, s.soundVolume || 0.5, '', "AIChat._updateNotif('soundVolume', parseFloat(this.value))")}</div>` : ''}
        `);
    },

    _renderContextTab() {
        const s = this._contextSettings || {};
        return this._sectionHeader('上下文', '管理 AI 上下文窗口设置') + this._section(`
            ${this._slider('ctx-max-tabs', '打开标签页上下文限制', 0, 500, 1, s.maxOpenTabs || 20, '', "AIChat._updateContext('maxOpenTabs', parseInt(this.value))")}
            ${this._slider('ctx-max-files', '工作区文件上下文限制', 0, 500, 1, s.maxFiles || 200, '', "AIChat._updateContext('maxFiles', parseInt(this.value))")}
            ${this._checkbox('ctx-time', '包含当前时间', s.includeTime !== false, "AIChat._updateContext('includeTime', this.checked)")}
            ${this._checkbox('ctx-diagnostics', '包含诊断信息', s.includeDiagnostics !== false, "AIChat._updateContext('includeDiagnostics', this.checked)")}
            <div style="border-top:1px solid var(--ai-border);margin:8px 0;padding-top:12px">
                <div style="display:flex;align-items:center;gap:8px;font-weight:600;margin-bottom:8px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M4 14h6m4 0h6M4 10h6m4 0h6"/></svg><span>Context Compression</span></div>
                ${this._checkbox('ctx-auto-condense', '自动压缩上下文', s.autoCondense, "AIChat._updateContext('autoCondense', this.checked);AIChat._switchSettingsTab('context')")}
                <div class="rc-settings-item-desc" style="margin-left:24px;margin-bottom:8px">当上下文超过阈值时自动压缩旧消息</div>
                ${s.autoCondense ? `<div class="rc-settings-nested">
                    ${this._slider('ctx-condense-threshold', '压缩触发阈值', 10, 100, 5, s.condenseThreshold || 80, '%', "AIChat._updateContext('condenseThreshold', parseInt(this.value))")}
                    <div class="rc-settings-item-desc" style="margin-left:0">当上下文使用量达到模型上下文窗口的此百分比时触发压缩</div>
                </div>` : ''}
            </div>
        `);
    },

    _renderTerminalTab() {
        const s = this._terminalSettings || {};
        return this._sectionHeader('终端', '终端命令执行设置') + this._section(`
            <div style="display:flex;align-items:center;gap:8px;font-weight:600;margin-bottom:4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg><span>基础设置</span></div>
            <div class="rc-settings-nested">
                ${this._select('term-preview', '命令输出预览大小', [{value:'small',label:'小 (5KB)'},{value:'medium',label:'中 (10KB)'},{value:'large',label:'大 (20KB)'}], s.outputPreview || 'medium', "AIChat._updateTerminal('outputPreview', this.value)")}
            </div>
            <div style="display:flex;align-items:center;gap:8px;font-weight:600;margin-top:8px;margin-bottom:4px"><span>高级设置</span></div>
            <div class="rc-settings-nested">
                ${this._checkbox('term-cmd-delay', '启用命令延迟', s.cmdDelay > 0, "AIChat._updateTerminal('cmdDelay', this.checked ? 100 : 0)")}
                ${s.cmdDelay > 0 ? this._slider('term-cmd-delay-val', '命令延迟 (ms)', 0, 1000, 10, s.cmdDelay || 0, 'ms', "AIChat._updateTerminal('cmdDelay', parseInt(this.value))") : ''}
            </div>
        `);
    },

    _renderPromptsTab() {
        const s = this._promptSettings || {};
        return this._sectionHeader('提示词', '自定义系统提示词和增强提示') + this._section(`
            ${this._textArea('prompt-system', '系统提示词', '可选的系统提示词...', s.systemPrompt, 5, "AIChat._updatePrompt('systemPrompt', this.value);AIChat._markSettingsDirty(true)")}
            ${this._textArea('prompt-enhance', '增强提示词', '用于增强用户输入的提示词...', s.enhancePrompt, 4, "AIChat._updatePrompt('enhancePrompt', this.value);AIChat._markSettingsDirty(true)")}
        `);
    },

    _renderUITab() {
        const s = this._uiSettings || {};
        return this._sectionHeader('界面', '界面显示设置') + this._section(`
            ${this._checkbox('ui-collapse-thinking', '默认折叠推理过程', s.collapseThinking !== false, "AIChat._updateUI('collapseThinking', this.checked)")}
            <div class="rc-settings-item-desc" style="margin-left:24px">启用后，推理链默认显示为折叠状态</div>
            ${this._checkbox('ui-enter-send', 'Enter 键发送消息 (Shift+Enter 换行)', s.sendOnEnter !== false, "AIChat._updateUI('sendOnEnter', this.checked)")}
            <div class="rc-settings-item-desc" style="margin-left:24px">取消勾选后，需要 Ctrl+Enter 发送消息</div>
            ${this._checkbox('ui-auto-scroll', '自动滚动到最新消息', s.autoScroll !== false, "AIChat._updateUI('autoScroll', this.checked)")}
        `);
    },

    _renderExperimentalTab() {
        const s = this._experimentalSettings || {};
        return this._sectionHeader('实验性', '实验性功能 (可能不稳定)') + this._section(`
            ${this._checkbox('exp-thinking', '启用 Sequential Thinking 工具', s.sequentialThinking, "AIChat._updateExperimental('sequentialThinking', this.checked)")}
            <div class="rc-settings-item-desc" style="margin-left:24px">使用结构化思维链进行复杂推理</div>
            ${this._checkbox('exp-ckg', '启用代码知识图谱 (CKG)', s.ckg, "AIChat._updateExperimental('ckg', this.checked)")}
            <div class="rc-settings-item-desc" style="margin-left:24px">自动索引代码库以提供更精准的上下文</div>
            ${this._checkbox('exp-stream', '流式输出', s.streaming !== false, "AIChat._updateExperimental('streaming', this.checked)")}
            <div class="rc-settings-item-desc" style="margin-left:24px">逐字显示 AI 回复，关闭则等待完整回复后一次性显示</div>
        `);
    },

    _renderLanguageTab() {
        const lang = this._language || 'zh-CN';
        return this._sectionHeader('语言', '选择界面语言') + this._section(`
            ${this._select('settings-language', '界面语言', [{value:'zh-CN',label:'简体中文'},{value:'en',label:'English'},{value:'ja',label:'日本語'},{value:'ko',label:'한국어'}], lang, "AIChat._updateLanguage(this.value)")}
        `);
    },

    _renderAboutTab() {
        return this._sectionHeader('关于', '关于 VersePC Coder') + this._section(`
            <div class="rc-settings-item"><p style="color:var(--ai-text-secondary);font-size:13px;margin:0">Version: 1.0.0</p></div>
            <div class="rc-settings-item" style="padding-top:12px;border-top:1px solid var(--ai-border)">
                <label class="rc-settings-item-label">管理设置</label>
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
                    <button class="rc-btn rc-btn-secondary rc-btn-sm" onclick="AIChat._exportSettings()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> 导出</button>
                    <button class="rc-btn rc-btn-secondary rc-btn-sm" onclick="AIChat._importSettings()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> 导入</button>
                    <button class="rc-btn rc-btn-danger rc-btn-sm" onclick="AIChat._resetSettings()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> 重置</button>
                </div>
            </div>
        `);
    },

    _renderMemoryTab() {
        const memEntries = Array.isArray(this._persistentMemory) ? this._persistentMemory : [];
        let listHtml = '';
        if (memEntries.length === 0) {
            listHtml = '<div class="rc-settings-item"><p style="color:var(--ai-text-secondary);font-size:13px;margin:0">暂无记忆条目。AI 会通过 [MEMORY:...] 标签自动记录，或在下方手动添加。</p></div>';
        } else {
            for (let i = 0; i < memEntries.length; i++) {
                const entry = this._escapeHtml(memEntries[i]);
                listHtml += `<div class="rc-settings-item" style="display:flex;align-items:center;gap:8px">
                    <span style="flex:1;font-size:13px;word-break:break-all">${entry}</span>
                    <button class="rc-btn rc-btn-danger rc-btn-sm" onclick="AIChat._deleteMemoryEntry(${i})" style="flex-shrink:0">删除</button>
                </div>`;
            }
        }
        return this._sectionHeader('记忆管理', '管理跨会话持久化的用户记忆，AI 会自动记录重要信息') + this._section(`
            <div class="rc-settings-item" style="display:flex;gap:8px;align-items:flex-end">
                <div style="flex:1">
                    <label class="rc-settings-item-label">添加记忆</label>
                    <input type="text" class="rc-apikey-form-input" id="memory-add-input" placeholder="输入新的记忆内容..." style="width:100%">
                </div>
                <button class="rc-btn rc-btn-primary rc-btn-sm" onclick="AIChat._addMemoryEntry()" style="flex-shrink:0;margin-bottom:1px">添加</button>
            </div>
            ${listHtml}
            ${memEntries.length > 0 ? `<div class="rc-settings-item" style="border-top:1px solid var(--ai-border);padding-top:12px">
                <button class="rc-btn rc-btn-danger rc-btn-sm" onclick="AIChat._clearAllMemory()">清空所有记忆</button>
                <span style="color:var(--ai-text-secondary);font-size:12px;margin-left:8px">共 ${memEntries.length} 条</span>
            </div>` : ''}
        `);
    },

    async _addMemoryEntry() {
        const input = document.getElementById('memory-add-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;
        if (!Array.isArray(this._persistentMemory)) this._persistentMemory = [];
        this._persistentMemory.push(text);
        await this.savePersistentMemory();
        this._switchSettingsTab('memory');
    },

    async _deleteMemoryEntry(index) {
        if (!Array.isArray(this._persistentMemory)) return;
        if (index < 0 || index >= this._persistentMemory.length) return;
        this._persistentMemory.splice(index, 1);
        await this.savePersistentMemory();
        this._switchSettingsTab('memory');
    },

    async _clearAllMemory() {
        this._persistentMemory = [];
        await this.savePersistentMemory();
        this._switchSettingsTab('memory');
    },

    _renderProjectInstructionsTab() {
        const projectDir = this._currentFolderPath || '';
        const filePath = projectDir ? `${projectDir}\\.versepc\\AGENTS.md` : '(未打开项目)';
        return this._sectionHeader('项目指令文件', '为当前项目定义 AI 行为规则，文件保存在 .versepc/AGENTS.md') + this._section(`
            <div class="rc-settings-item">
                <label class="rc-settings-item-label">项目目录</label>
                <p style="color:var(--ai-text-secondary);font-size:12px;margin:4px 0 0">${this._escapeHtml(filePath)}</p>
            </div>
            <div class="rc-settings-item">
                <label class="rc-settings-item-label">AGENTS.md 内容</label>
                <textarea id="project-instructions-editor" class="rc-apikey-form-input" rows="12" placeholder="# 项目指令&#10;&#10;在此定义 AI 应遵循的规则...&#10;&#10;- 使用 TypeScript&#10;- 遵循 ESLint 规则&#10;- 不要修改 package.json" style="width:100%;font-family:monospace;font-size:12px;resize:vertical;min-height:200px">${this._escapeHtml(this._projectInstructionsContent || '')}</textarea>
            </div>
            <div class="rc-settings-item" style="display:flex;gap:8px">
                <button class="rc-btn rc-btn-primary rc-btn-sm" onclick="AIChat._saveProjectInstructions()">保存</button>
                <button class="rc-btn rc-btn-sm" onclick="AIChat._loadProjectInstructionsContent()">重新加载</button>
                ${projectDir ? `<button class="rc-btn rc-btn-sm" onclick="AIChat._createVersepcDir()">创建 .versepc 目录</button>` : ''}
            </div>
        `);
    },

    async _loadProjectInstructionsContent() {
        const projectDir = this._currentFolderPath;
        if (!projectDir) return;
        try {
            const result = await window.electronAPI.readFile?.(`${projectDir}\\.versepc\\AGENTS.md`);
            if (result && !result.error) {
                this._projectInstructionsContent = result.content || '';
            } else {
                this._projectInstructionsContent = '';
            }
        } catch (_) {
            this._projectInstructionsContent = '';
        }
        const textarea = document.getElementById('project-instructions-editor');
        if (textarea) textarea.value = this._projectInstructionsContent || '';
    },

    async _saveProjectInstructions() {
        const textarea = document.getElementById('project-instructions-editor');
        if (!textarea) return;
        const content = textarea.value;
        const projectDir = this._currentFolderPath;
        if (!projectDir) {
            alert('请先打开一个项目目录');
            return;
        }
        try {
            const dirPath = `${projectDir}\\.versepc`;
            await window.electronAPI.createDir?.(dirPath);
            await window.electronAPI.writeFile?.(`${dirPath}\\AGENTS.md`, content);
            this._projectInstructionsContent = content;
            alert('项目指令已保存到 .versepc/AGENTS.md');
        } catch (e) {
            alert('保存失败: ' + e.message);
        }
    },

    async _createVersepcDir() {
        const projectDir = this._currentFolderPath;
        if (!projectDir) return;
        try {
            await window.electronAPI.createDir?.(`${projectDir}\\.versepc`);
            alert('.versepc 目录已创建');
        } catch (e) {
            alert('创建失败: ' + e.message);
        }
    },

    _updateAutoApprove(key, val) {
        if (!this._autoApproveSettings) this._autoApproveSettings = {};
        this._autoApproveSettings[key] = val;
        this._markSettingsDirty(true);
        this._switchSettingsTab('autoApprove');
    },

    _updateNotif(key, val) {
        if (!this._notifSettings) this._notifSettings = {};
        this._notifSettings[key] = val;
        this._markSettingsDirty(true);
        this._switchSettingsTab('notifications');
    },

    _updateContext(key, val) {
        if (!this._contextSettings) this._contextSettings = {};
        this._contextSettings[key] = val;
        this._markSettingsDirty(true);
    },

    _updateTerminal(key, val) {
        if (!this._terminalSettings) this._terminalSettings = {};
        this._terminalSettings[key] = val;
        this._markSettingsDirty(true);
        this._switchSettingsTab('terminal');
    },

    _updatePrompt(key, val) {
        if (!this._promptSettings) this._promptSettings = {};
        this._promptSettings[key] = val;
    },

    _updateUI(key, val) {
        if (!this._uiSettings) this._uiSettings = {};
        this._uiSettings[key] = val;
        this._markSettingsDirty(true);
    },

    _updateExperimental(key, val) {
        if (!this._experimentalSettings) this._experimentalSettings = {};
        this._experimentalSettings[key] = val;
        this._markSettingsDirty(true);
        this._switchSettingsTab('experimental');
    },

    _updateLanguage(val) {
        this._language = val;
        this._markSettingsDirty(true);
    },

    async _exportSettings() {
        const data = {
            apiKey: this.apiKey, model: this.model, temperature: this.temperature,
            addedModels: this.addedModels,
            autoApprove: this._autoApproveSettings, notifications: this._notifSettings,
            context: this._contextSettings, terminal: this._terminalSettings,
            prompts: this._promptSettings, ui: this._uiSettings,
            experimental: this._experimentalSettings, language: this._language,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'versepc-ai-settings.json'; a.click();
        if (typeof showToast === 'function') showToast('设置已导出', 'success');
    },

    async _importSettings() {
        const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0]; if (!file) return;
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                if (data.apiKey) { this.apiKey = data.apiKey; await window.electronAPI.store.set('versepc_ai_api_key', data.apiKey); }
                if (data.model) { this.model = data.model; await window.electronAPI.store.set('versepc_ai_model', data.model); }
                if (data.temperature != null) { this.temperature = data.temperature; await window.electronAPI.store.set('versepc_ai_temp', String(data.temperature)); }
                if (data.addedModels) { this.addedModels = data.addedModels; await window.electronAPI.store.set('versepc_ai_added_models', JSON.stringify(data.addedModels)); }
                if (data.autoApprove) this._autoApproveSettings = data.autoApprove;
                if (data.notifications) this._notifSettings = data.notifications;
                if (data.context) this._contextSettings = data.context;
                if (data.terminal) this._terminalSettings = data.terminal;
                if (data.prompts) this._promptSettings = data.prompts;
                if (data.ui) this._uiSettings = data.ui;
                if (data.experimental) this._experimentalSettings = data.experimental;
                if (data.language) this._language = data.language;
                this.updateModelLabel();
                this.renderSettingsPanel();
                if (typeof showToast === 'function') showToast('设置已导入', 'success');
            } catch (e) { if (typeof showToast === 'function') showToast('导入失败: ' + e.message, 'error'); }
        };
        input.click();
    },

    async _resetSettings() {
        this._autoApproveSettings = {};
        this._notifSettings = {};
        this._contextSettings = {};
        this._terminalSettings = {};
        this._promptSettings = {};
        this._uiSettings = {};
        this._experimentalSettings = {};
        this._language = 'zh-CN';
        this.renderSettingsPanel();
        if (typeof showToast === 'function') showToast('设置已重置', 'success');
    },

    populateProviderSelect() {
        const select = document.getElementById('ai-provider-select');
        if (!select) return;
        select.innerHTML = '<option value="">-- 选择平台 --</option>';
        for (const p of this.providers) {
            const opt = document.createElement('option');
            opt.value = p.key;
            opt.textContent = p.name;
            select.appendChild(opt);
        }
    },

    onProviderSelect() {
        const sel = document.getElementById('ai-provider-select');
        const keyGroup = document.getElementById('ai-add-key-group');
        const modelGroup = document.getElementById('ai-add-model-group');
        const addBtn = document.getElementById('ai-add-model-btn');
        const customFields = document.getElementById('ai-provider-custom-fields');
        if (!sel) return;
        const val = sel.value;

        if (customFields) customFields.style.display = val === 'custom' ? '' : 'none';
        if (keyGroup) keyGroup.style.display = val && val !== 'custom' ? '' : 'none';
        if (modelGroup) modelGroup.style.display = 'none';
        if (addBtn) addBtn.style.display = 'none';
        if (val === 'custom') return;

        const provider = this.providers.find(p => p.key === val);
        if (!provider) return;
        const models = provider.models || [];
        const modelSel = document.getElementById('ai-add-model-select');
        if (modelSel) {
            modelSel.innerHTML = models.map(m => `<option value="${this.escapeHtml(m.id)}">${this.escapeHtml(m.name || m.id)}</option>`).join('');
            if (models.length > 0) { modelSel.style.display = ''; if (addBtn) addBtn.style.display = ''; }
        }
    },

    toggleAddKeyVisibility() {
        const input = document.getElementById('ai-add-key-input');
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
    },





    async addModels() {
        const providerSelect = document.getElementById('ai-provider-select');
        const keyInput = document.getElementById('ai-add-key-input');
        const modelSelect = document.getElementById('ai-add-model-select');
        const providerKey = providerSelect?.value;
        const apiKey = keyInput?.value?.trim();

        if (!providerKey) { if (typeof showToast === 'function') showToast('请选择平台', 'error'); return; }
        if (!apiKey) { if (typeof showToast === 'function') showToast('请输入 API Key', 'error'); return; }

        const selectedOptions = Array.from(modelSelect?.selectedOptions || []);
        if (selectedOptions.length === 0) { if (typeof showToast === 'function') showToast('请选择至少一个模型', 'error'); return; }

        const provider = this.providers.find(p => p.key === providerKey);
        if (!provider) return;

        for (const opt of selectedOptions) {
            const modelId = opt.value;
            const modelInfo = provider.models.find(m => m.id === modelId);
            const existingIdx = this.addedModels.findIndex(m => m.modelId === modelId);
            const entry = {
                providerKey: providerKey,
                providerName: provider.name,
                modelId: modelId,
                modelName: modelInfo?.name || modelId,
                free: modelInfo?.free || false,
                apiKey: apiKey
            };
            if (existingIdx >= 0) {
                this.addedModels[existingIdx] = entry;
            } else {
                this.addedModels.push(entry);
            }
        }

        try {
            await window.electronAPI.store.set('versepc_ai_added_models', JSON.stringify(this.addedModels));
        } catch (e) {}

        if (!this.model || !this.addedModels.some(m => m.modelId === this.model)) {
            this.model = selectedOptions[0].value;
            this.apiKey = apiKey;
            try {
                await window.electronAPI.store.set('versepc_ai_model', this.model);
                await window.electronAPI.store.set('versepc_ai_api_key', this.apiKey);
            } catch (e) {}
        }

        this.updateModelLabel();
        this.renderModelTable();
        if (typeof showToast === 'function') showToast(`已添加 ${selectedOptions.length} 个模型`, 'success');
    },

    async removeAddedModel(modelId) {
        this.addedModels = (this.addedModels || []).filter(m => m.modelId !== modelId);
        try {
            await window.electronAPI.store.set('versepc_ai_added_models', JSON.stringify(this.addedModels));
        } catch (e) {}
        if (this.model === modelId) {
            this.model = this.addedModels.length > 0 ? this.addedModels[0].modelId : '';
            this.apiKey = this.addedModels.length > 0 ? this.addedModels[0].apiKey : '';
            try {
                await window.electronAPI.store.set('versepc_ai_model', this.model);
                await window.electronAPI.store.set('versepc_ai_api_key', this.apiKey);
            } catch (e) {}
        }
        this.updateModelLabel();
        this.renderModelTable();
        this.renderAddedModels();
    },

    renderModelTable() {
        const tbody = document.getElementById('rc-model-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        const allModels = Array.isArray(this.addedModels) ? this.addedModels : [];
        const providerNames = { zhipu:'智谱 GLM', deepseek:'DeepSeek', qwen:'通义千问', moonshot:'Kimi', yi:'零一万物', baichuan:'百川', minimax:'MiniMax', stepfun:'阶跃星辰', siliconflow:'SiliconFlow', openrouter:'OpenRouter', groq:'Groq', openai:'OpenAI', anthropic:'Anthropic', google:'Google', custom:'自定义' };
        for (const m of allModels) {
            const tr = document.createElement('tr');
            const iconChar = m.providerKey === 'custom' ? 'C' : (m.providerKey ? m.providerKey[0].toUpperCase() : '?');
            const isCurrent = m.modelId === this.model;
            const isCustom = m.providerKey === 'custom';
            const maskedKey = m.apiKey ? (m.apiKey.slice(0, 8) + '...' + m.apiKey.slice(-4)) : '';
            const displayUrl = isCustom && m.baseUrl ? `<div class="rc-model-url">${m.baseUrl}</div>` : '';
            const displayKey = maskedKey ? `<div class="rc-model-key">Key: ${maskedKey}</div>` : '';
            tr.innerHTML = `
                <td>
                    <div class="rc-model-name-cell">
                        <div class="rc-model-icon ${m.providerKey || ''}">${iconChar}</div>
                        <div><div class="rc-model-name">${isCurrent ? '● ' : ''}${m.modelName || m.modelId}</div><div class="rc-model-id">${m.modelId}</div>${displayUrl}${displayKey}</div>
                    </div>
                </td>
                <td><span class="rc-provider-badge">${providerNames[m.providerKey] || m.providerKey || '-'}${m.free ? '<span class="rc-free-badge">FREE</span>' : ''}</span></td>
                <td>${isCurrent ? `<span style="color:var(--ai-accent);font-size:11px;font-weight:600">使用中</span> <button class="rc-table-action danger" onclick="AIChat.removeModelFromTable('${m.modelId}')">移除</button>` : `<button class="rc-table-action" onclick="AIChat.selectModelFromTable('${m.modelId}')">使用</button> <button class="rc-table-action danger" onclick="AIChat.removeModelFromTable('${m.modelId}')">移除</button>`}</td>`;
            tbody.appendChild(tr);
        }
        if (allModels.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="3" style="text-align:center;padding:32px;color:var(--ai-text-muted);font-size:13px">暂无模型，点击「新模型」添加</td>`;
            tbody.appendChild(tr);
        }
    },

    getDefaultModels() {
        const defaults = [];
        if (this._customProvider && this._customProvider.modelId) {
            const fullId = 'custom:' + this._customProvider.baseUrl + ':' + this._customProvider.modelId;
            defaults.unshift({ modelId: fullId, modelName: this._customProvider.modelName || this._customProvider.modelId, providerKey: 'custom', free: false });
        }
        return defaults;
    },

    async selectModelFromTable(modelId) {
        this.model = modelId;
        try { await window.electronAPI.store.set('versepc_ai_model', modelId); } catch(e){}
        this.updateModelLabel();
        this.renderModelTable();
    },

    async removeModelFromTable(modelId) {
        this.addedModels = (this.addedModels || []).filter(m => m.modelId !== modelId);
        try { await window.electronAPI.store.set('versepc_ai_added_models', JSON.stringify(this.addedModels)); } catch(e){}
        if (this.model === modelId && this.addedModels.length > 0) {
            this.model = this.addedModels[0].modelId;
            this.apiKey = this.addedModels[0].apiKey || '';
            try { await window.electronAPI.store.set('versepc_ai_api_key', this.apiKey); } catch(e){}
            this.updateModelLabel();
        } else if (this.addedModels.length === 0) {
            this.model = '';
            this.apiKey = '';
            try {
                await window.electronAPI.store.set('versepc_ai_model', '');
                await window.electronAPI.store.set('versepc_ai_api_key', '');
            } catch(e){}
            this.updateModelLabel();
        }
        this.renderModelTable();
        this.renderAddedModels();
    },

    showAddModelDialog() {
        this._showAddModelDialog();
    },

    _getProviderSvgIcon(key) {
        return `<img src="img/providers/${key}.png" width="20" height="20" style="border-radius:4px;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><span style="display:none;width:20px;height:20px;border-radius:4px;background:#6B7280;color:white;font-size:10px;font-weight:700;align-items:center;justify-content:center;">${(key||'?')[0].toUpperCase()}</span>`;
    },

    _showAddModelDialog() {
        const existing = document.getElementById('ai-add-model-dialog');
        if (existing) existing.remove();

        const providerData = [
            { key: 'deepseek', name: 'DeepSeek', color: '#6B7DE3' },
            { key: 'openai', name: 'OpenAI', color: '#10A37F' },
            { key: 'anthropic', name: 'Anthropic', color: '#D97706' },
            { key: 'google', name: 'Google', color: '#4285F4' },
            { key: 'zhipu', name: '智谱 GLM', color: '#4A6CF7' },
            { key: 'qwen', name: '通义千问', color: '#FF6A00' },
            { key: 'moonshot', name: 'Kimi', color: '#6941C6' },
            { key: 'siliconflow', name: 'SiliconFlow', color: '#F59E0B' },
            { key: 'groq', name: 'Groq', color: '#A855F7' },
            { key: 'openrouter', name: 'OpenRouter', color: '#30A14E' },
            { key: 'minimax', name: 'MiniMax', color: '#3B82F6' },
            { key: 'yi', name: '零一万物', color: '#6366F1' },
            { key: 'baichuan', name: '百川智能', color: '#2563EB' },
            { key: 'stepfun', name: '阶跃星辰', color: '#EC4899' },
        ];

        const backendProviders = this.providers.length > 0 ? this.providers : [];
        const extraProviders = backendProviders.filter(bp => !providerData.some(p => p.key === bp.key));
        const allProviders = [...providerData, ...extraProviders.map(p => ({ key: p.key, name: p.name, color: '#6B7280' }))];

        const chevronSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="6 9 12 15 18 9"/></svg>';

        let cardsHtml = '';
        for (const p of allProviders) {
            const provider = backendProviders.find(bp => bp.key === p.key);
            const models = provider?.models || [];
            let modelOpts = models.map(m => `<option value="${m.id}">${m.name}${m.free ? ' (免费)' : ''}</option>`).join('');

            cardsHtml += `<div class="amd-provider-card" data-provider="${p.key}" onclick="AIChat._toggleAmdCard('${p.key}')">
                <div class="amd-card-header">
                    <div class="amd-card-icon">${this._getProviderSvgIcon(p.key)}</div>
                    <span class="amd-card-name">${p.name}</span>
                    <span class="amd-card-chevron">${chevronSvg}</span>
                </div>
                <div class="amd-card-body" id="amd-body-${p.key}" onclick="event.stopPropagation()">
                    <div class="amd-form">
                        ${models.length > 0 ? `
                        <div class="amd-form-group">
                            <label class="amd-form-label">选择模型</label>
                            <div class="amd-form-select-wrap">
                                <select class="amd-form-select" id="amd-model-${p.key}">${modelOpts}</select>
                            </div>
                        </div>` : `
                        <div class="amd-form-group">
                            <label class="amd-form-label">模型 ID</label>
                            <input type="text" class="amd-form-input" id="amd-model-${p.key}" placeholder="输入模型 ID">
                        </div>`}
                        <div class="amd-form-group">
                            <label class="amd-form-label">API Key</label>
                            <div class="amd-form-input-wrap">
                                <input type="password" class="amd-form-input" id="amd-key-${p.key}" placeholder="sk-..." autocomplete="off">
                                <span class="amd-form-eye" onclick="AIChat._toggleAmdEye('amd-key-${p.key}')">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                </span>
                            </div>
                        </div>
                        <div class="amd-form-actions">
                            <button class="amd-btn amd-btn-cancel" onclick="AIChat._toggleAmdCard('${p.key}')">取消</button>
                            <button class="amd-btn amd-btn-confirm" onclick="AIChat._saveAmdProvider('${p.key}')">确认</button>
                        </div>
                    </div>
                </div>
            </div>`;
        }

        cardsHtml += `<div class="amd-provider-card amd-custom-card" data-provider="custom" onclick="AIChat._toggleAmdCard('custom')">
            <div class="amd-card-header">
                <div class="amd-card-icon amd-custom-icon">${this._getProviderSvgIcon('custom')}</div>
                <span class="amd-card-name">自定义配置</span>
                <span class="amd-card-chevron">${chevronSvg}</span>
            </div>
            <div class="amd-card-body" id="amd-body-custom" onclick="event.stopPropagation()">
                <div class="amd-form">
                    <div class="amd-form-group">
                        <label class="amd-form-label">API 格式</label>
                        <div class="amd-form-select-wrap">
                            <select class="amd-form-select" id="amd-custom-format">
                                <option value="openai">OpenAI Compatible</option>
                                <option value="anthropic">Anthropic</option>
                            </select>
                        </div>
                    </div>
                    <div class="amd-form-group">
                        <label class="amd-form-label">请求地址</label>
                        <input type="url" class="amd-form-input" id="amd-custom-url" placeholder="https://api.example.com/v1" value="${this._escapeHtml(this._customProvider?.baseUrl || '')}">
                    </div>
                    <div class="amd-form-group">
                        <label class="amd-form-label">模型 ID</label>
                        <input type="text" class="amd-form-input" id="amd-custom-model" placeholder="gpt-4o" value="${this._escapeHtml(this._customProvider?.modelId || '')}">
                    </div>
                    <div class="amd-form-group">
                        <label class="amd-form-label">API Key</label>
                        <div class="amd-form-input-wrap">
                            <input type="password" class="amd-form-input" id="amd-custom-key" placeholder="sk-..." value="${this._escapeHtml(this._customProvider?.apiKey || '')}" autocomplete="off">
                            <span class="amd-form-eye" onclick="AIChat._toggleAmdEye('amd-custom-key')">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            </span>
                        </div>
                    </div>
                    <div class="amd-form-row">
                        <div class="amd-form-group" style="flex:1">
                            <label class="amd-form-label">显示名称</label>
                            <input type="text" class="amd-form-input" id="amd-custom-name" placeholder="可选" value="${this._escapeHtml(this._customProvider?.modelName || '')}">
                        </div>
                        <div class="amd-form-group" style="flex:1">
                            <label class="amd-form-label">最大 Token</label>
                            <input type="number" class="amd-form-input" id="amd-custom-tokens" placeholder="16384" value="${this._customProvider?.maxTokens || 16384}">
                        </div>
                    </div>
                    <div class="amd-form-group">
                        <label class="amd-form-label">上下文窗口</label>
                        <input type="number" class="amd-form-input" id="amd-custom-ctx" placeholder="128000" value="${this._customProvider?.contextWindow || 128000}" style="width:120px">
                    </div>
                    <div class="amd-form-group">
                        <label class="amd-form-checkbox">
                            <input type="checkbox" id="amd-custom-stream" ${this._customProvider?.streaming !== false ? 'checked' : ''}>
                            <span>启用流式输出</span>
                        </label>
                    </div>
                    <div class="amd-form-actions">
                        <button class="amd-btn amd-btn-cancel" onclick="AIChat._toggleAmdCard('custom')">取消</button>
                        <button class="amd-btn amd-btn-confirm" onclick="AIChat._saveAmdCustom()">确认</button>
                    </div>
                </div>
            </div>
        </div>`;

        const dialog = document.createElement('div');
        dialog.id = 'ai-add-model-dialog';
        dialog.className = 'amd-overlay';
        dialog.innerHTML = `<div class="amd-dialog">
            <div class="amd-dialog-header">
                <h3 class="amd-dialog-title">添加模型</h3>
                <button class="amd-dialog-close" onclick="AIChat._closeAddModelDialog()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="amd-dialog-body">
                <div class="amd-provider-grid">${cardsHtml}</div>
            </div>
            <div class="amd-dialog-footer">
                <button class="amd-btn amd-btn-cancel amd-btn-lg" onclick="AIChat._closeAddModelDialog()">取消</button>
                <button class="amd-btn amd-btn-confirm amd-btn-lg" onclick="AIChat._submitAddModelDialog()">提交</button>
            </div>
        </div>`;

        document.body.appendChild(dialog);

        requestAnimationFrame(() => dialog.classList.add('visible'));

        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) this._closeAddModelDialog();
        });
    },

    _toggleAmdCard(key) {
        const body = document.getElementById('amd-body-' + key);
        if (!body) return;
        const card = body.closest('.amd-provider-card');
        const allCards = document.querySelectorAll('.amd-provider-card');
        allCards.forEach(c => { if (c !== card) c.classList.remove('expanded'); });
        if (card) card.classList.toggle('expanded');
    },

    _toggleAmdEye(inputId) {
        const input = document.getElementById(inputId);
        if (input) input.type = input.type === 'password' ? 'text' : 'password';
    },

    _closeAddModelDialog() {
        const dialog = document.getElementById('ai-add-model-dialog');
        if (dialog) {
            dialog.classList.remove('visible');
            setTimeout(() => dialog.remove(), 200);
        }
    },

    async _saveAmdProvider(providerKey) {
        const provider = this.providers.find(p => p.key === providerKey);
        if (!provider) {
            if (typeof showToast === 'function') showToast('未找到该平台信息', 'error');
            return;
        }

        const modelEl = document.getElementById('amd-model-' + providerKey);
        const keyEl = document.getElementById('amd-key-' + providerKey);
        const modelId = modelEl?.tagName === 'SELECT' ? modelEl?.value : modelEl?.value?.trim();
        const apiKey = keyEl?.value?.trim();

        if (!modelId) {
            if (typeof showToast === 'function') showToast('请选择或输入模型', 'error');
            return;
        }
        if (!apiKey) {
            if (keyEl) { keyEl.style.borderColor = 'var(--ai-error,#f44)'; setTimeout(() => keyEl.style.borderColor = '', 1500); }
            if (typeof showToast === 'function') showToast('请输入 API Key', 'error');
            return;
        }

        const key = `versepc_ai_apikey_${providerKey}`;
        await window.electronAPI.store.set(key, apiKey);
        this._providerKeyStatus[providerKey] = true;

        const modelInfo = provider.models?.find(m => m.id === modelId);
        const entry = {
            providerKey,
            providerName: provider.name,
            modelId,
            modelName: modelInfo?.name || modelId,
            free: modelInfo?.free || false,
            apiKey
        };
        const exists = this.addedModels.findIndex(m => m.modelId === modelId);
        if (exists >= 0) this.addedModels[exists] = entry;
        else this.addedModels.push(entry);

        this.model = modelId;
        this.apiKey = apiKey;
        await window.electronAPI.store.set('versepc_ai_model', modelId);
        await window.electronAPI.store.set('versepc_ai_api_key', apiKey);
        await window.electronAPI.store.set('versepc_ai_added_models', JSON.stringify(this.addedModels));

        this.updateModelLabel();
        this.renderSettingsPanel();
        this._closeAddModelDialog();
        if (typeof showToast === 'function') showToast(`${provider.name} 模型已添加`, 'success');
    },

    async _saveAmdCustom() {
        const baseUrl = document.getElementById('amd-custom-url')?.value?.trim();
        const apiKey = document.getElementById('amd-custom-key')?.value?.trim();
        const modelId = document.getElementById('amd-custom-model')?.value?.trim();
        const modelName = document.getElementById('amd-custom-name')?.value?.trim();
        const maxTokens = parseInt(document.getElementById('amd-custom-tokens')?.value) || 16384;
        const contextWindow = parseInt(document.getElementById('amd-custom-ctx')?.value) || 128000;
        const streaming = document.getElementById('amd-custom-stream')?.checked !== false;
        const apiFormat = document.getElementById('amd-custom-format')?.value || 'openai';

        if (!baseUrl || !apiKey || !modelId) {
            if (typeof showToast === 'function') showToast('请填写请求地址、API Key 和模型 ID', 'error');
            return;
        }

        this._customProvider = { baseUrl, apiKey, modelId, modelName: modelName || modelId, maxTokens, contextWindow, streaming, apiFormat, headers: [] };

        const fullId = 'custom:' + baseUrl + ':' + modelId;
        const entry = { modelId: fullId, modelName: modelName || modelId, providerKey: 'custom', free: false, apiKey, baseUrl, maxTokens, contextWindow, streaming, apiFormat };
        const exists = this.addedModels.findIndex(m => m.modelId === fullId);
        if (exists >= 0) this.addedModels[exists] = entry;
        else this.addedModels.push(entry);

        this.model = fullId;
        this.apiKey = apiKey;
        await window.electronAPI.store.set('versepc_ai_model', fullId);
        await window.electronAPI.store.set('versepc_ai_api_key', apiKey);
        await window.electronAPI.store.set('versepc_ai_added_models', JSON.stringify(this.addedModels));
        await window.electronAPI.store.set('versepc_ai_custom_provider', JSON.stringify(this._customProvider));

        this.updateModelLabel();
        this.renderSettingsPanel();
        this._closeAddModelDialog();
        if (typeof showToast === 'function') showToast('自定义模型已添加', 'success');
    },

    _submitAddModelDialog() {
        const expandedCard = document.querySelector('.amd-provider-card.expanded');
        if (expandedCard) {
            const key = expandedCard.dataset.provider;
            if (key === 'custom') this._saveAmdCustom();
            else this._saveAmdProvider(key);
        } else {
            if (typeof showToast === 'function') showToast('请先选择一个平台并配置', 'info');
        }
    },

    async useModel(modelId) {
        const entry = this.addedModels.find(m => m.modelId === modelId);
        if (!entry) return;
        this.model = modelId;
        this.apiKey = entry.apiKey;
        try {
            await window.electronAPI.store.set('versepc_ai_model', modelId);
            await window.electronAPI.store.set('versepc_ai_api_key', entry.apiKey);
        } catch (e) {}
        this.updateModelLabel();
        this.renderAddedModels();
    },

    async loadSettingsUI() {
        try {
            const all = await window.electronAPI.store.getMultiple(['versepc_ai_api_key', 'versepc_ai_model', 'versepc_ai_temp']);
            if (all) {
                this.apiKey = all.versepc_ai_api_key || null;
                this.model = all.versepc_ai_model || null;
                this.temperature = parseFloat(all.versepc_ai_temp) || 0.7;
            }
        } catch (e) {
            try { this.apiKey = await window.electronAPI.store.get('versepc_ai_api_key'); } catch (e2) {}
            try { this.model = await window.electronAPI.store.get('versepc_ai_model'); } catch (e2) {}
            try { this.temperature = parseFloat(await window.electronAPI.store.get('versepc_ai_temp')); } catch (e2) {}
        }

        const tempSlider = document.getElementById('ai-temp-slider');
        if (tempSlider) {
            const val = isNaN(this.temperature) ? 70 : Math.round(this.temperature * 100);
            tempSlider.value = val;
            const valEl = document.getElementById('ai-temp-value');
            if (valEl) valEl.textContent = (val / 100).toFixed(2);
        }
        this.updateModelLabel();
    },

    _todos: [],
    _todoExpanded: true,
    _lastTodoState: '',
    _taskToolCalls: {},
    _currentTaskIndex: -1,

    parseTodosFromText(text) {
        if (!text) return [];
        const todos = [];
        const regex = /^(?:-\s*)?\[\s*([ xX\-~])\s*\]\s+(.+)$/gm;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const marker = match[1];
            let status = 'pending';
            if (marker === 'x' || marker === 'X') status = 'completed';
            else if (marker === '-' || marker === '~') status = 'in_progress';
            todos.push({ content: match[2].trim(), status });
        }
        return todos;
    },

    _getActiveTaskIndex() {
        for (let i = this._todos.length - 1; i >= 0; i--) {
            if (this._todos[i].status === 'in_progress') return i;
        }
        for (let i = 0; i < this._todos.length; i++) {
            if (this._todos[i].status !== 'completed') return i;
        }
        return -1;
    },

    _createTaskTitleRow(taskIndex) {
        const task = this._todos[taskIndex];
        if (!task) return;

        if (this._currentTaskIndex === taskIndex && this._currentTaskGroup) {
            return this._currentTaskGroup;
        }

        this._closeCurrentTaskGroup();

        const container = this.currentWorkflowContent || this._messagesContainer;
        if (!container) return null;

        const group = document.createElement('div');
        group.className = 'ai-task-group';

        const titleRow = document.createElement('div');
        titleRow.className = 'ai-task-title running';
        titleRow.innerHTML = `<span class="ai-task-spinner"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/></svg></span><span class="ai-task-title-text">${this.escapeHtml(task.content)}</span><span class="ai-task-chevron open"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><polyline points="9 18 15 12 9 6"/></svg></span>`;

        const body = document.createElement('div');
        body.className = 'ai-task-body open';

        titleRow.addEventListener('click', () => {
            const isOpen = body.classList.toggle('open');
            titleRow.querySelector('.ai-task-chevron').classList.toggle('open', isOpen);
        });

        group.appendChild(titleRow);
        group.appendChild(body);
        container.appendChild(group);

        this._currentTaskGroup = group;
        this._currentTaskTitleEl = titleRow;
        this._currentTaskIndex = taskIndex;
        this._taskGroups[taskIndex] = { group, body, titleRow };

        return group;
    },

    _closeCurrentTaskGroup() {
        if (this._currentTaskGroup && this._currentTaskTitleEl) {
            this._currentTaskGroup.classList.add('completed');
            const titleRow = this._currentTaskTitleEl;
            titleRow.classList.remove('running');
            titleRow.classList.add('done');
            const spinner = titleRow.querySelector('.ai-task-spinner');
            if (spinner) {
                spinner.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="8" cy="8" r="6"/><polyline points="5.5 8 7.5 10 10.5 6"/></svg>';
                spinner.style.color = 'var(--ai-success, #22c55e)';
            }
            const body = this._currentTaskGroup.querySelector('.ai-task-body');
            if (body) body.classList.remove('open');
            const chevron = this._currentTaskTitleEl.querySelector('.ai-task-chevron');
            if (chevron) chevron.classList.remove('open');
        }
        this._currentTaskGroup = null;
        this._currentTaskTitleEl = null;
        this._currentTaskIndex = -1;
        this._streamTextBlock = null;
    },

    _closeAllTaskGroups() {
        document.querySelectorAll('.ai-task-group').forEach(group => {
            group.classList.add('completed');
            const titleRow = group.querySelector('.ai-task-title');
            if (titleRow) {
                titleRow.classList.remove('running');
                titleRow.classList.add('done');
                const spinner = titleRow.querySelector('.ai-task-spinner');
                if (spinner) {
                    spinner.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="8" cy="8" r="6"/><polyline points="5.5 8 7.5 10 10.5 6"/></svg>';
                    spinner.style.color = 'var(--ai-success, #22c55e)';
                }
                const chevron = titleRow.querySelector('.ai-task-chevron');
                if (chevron) chevron.classList.remove('open');
            }
            const body = group.querySelector('.ai-task-body');
            if (body) body.classList.remove('open');
        });
        this._currentTaskGroup = null;
        this._currentTaskTitleEl = null;
        this._currentTaskIndex = -1;
        this._streamTextBlock = null;
    },

    _getCurrentMessageBody() {
        const wf = document.getElementById('ai-active-workflow');
        if (wf) return wf.querySelector('.ai-msg-content');
        const msgs = document.querySelectorAll('.ai-msg-content');
        return msgs.length > 0 ? msgs[msgs.length - 1] : null;
    },

    _handlePlanCreated(data) {
        const plan = data.plan || {};
        const todos = plan.todos || [];
        const steps = plan.steps || todos.length || 0;

        const msgBody = this._getCurrentMessageBody();
        if (!msgBody) return;

        const block = document.createElement('div');
        block.className = 'ai-plan-block';
        block.id = 'ai-plan-block';

        const header = document.createElement('div');
        header.className = 'ai-plan-block-header';
        header.innerHTML = `<span class="ai-plan-icon">${this._SVG_PLAN || '📋'}</span><span>执行计划 (${steps} 步)</span>`;
        block.appendChild(header);

        const list = document.createElement('div');
        list.className = 'ai-plan-list';

        for (let i = 0; i < steps; i++) {
            const item = document.createElement('div');
            item.className = 'ai-plan-item ai-plan-pending';
            item.id = `ai-plan-step-${i + 1}`;
            const desc = todos[i]?.content || todos[i]?.id || `步骤 ${i + 1}`;
            item.innerHTML = `<span class="ai-plan-dot"></span><span class="ai-plan-text">${this._escapeHtml(desc)}</span>`;
            list.appendChild(item);
        }

        block.appendChild(list);
        msgBody.appendChild(block);

        if (todos.length > 0) {
            this._todos = todos.map((t, i) => ({
                id: t.id || 'task-' + (i + 1),
                content: t.content || t.id || '',
                status: t.status || 'pending',
                priority: 'medium'
            }));
            this.updateTodoBar();
        }
    },

    _handlePlanStepUpdate(data) {
        const step = data.step;
        const status = data.status;
        const item = document.getElementById(`ai-plan-step-${step}`);
        if (!item) return;

        item.className = 'ai-plan-item';
        if (status === 'running') {
            item.classList.add('ai-plan-running');
            if (this._todos[step - 1]) {
                this._todos[step - 1].status = 'in_progress';
                this.updateTodoBar();
            }
        } else if (status === 'done') {
            item.classList.add('ai-plan-done');
            if (this._todos[step - 1]) {
                this._todos[step - 1].status = 'completed';
                this.updateTodoBar();
            }
        } else if (status === 'error') {
            item.classList.add('ai-plan-error');
        }
    },

    _handlePlanCompleted(data) {
        const block = document.getElementById('ai-plan-block');
        if (block) {
            block.classList.add('ai-plan-completed');
            const header = block.querySelector('.ai-plan-block-header');
            if (header) {
                header.innerHTML = `<span class="ai-plan-icon">✅</span><span>计划完成 (${data.steps} 步)</span>`;
            }
        }
        if (typeof this._closeAllTaskGroups === 'function') {
            this._closeAllTaskGroups();
        }
    },

    _appendToolToCurrentTask(toolName, result, elapsed) {
        const idx = this._getActiveTaskIndex();
        if (idx < 0) return;
        if (!this._taskToolCalls[idx]) this._taskToolCalls[idx] = [];
        const displayName = TOOL_DISPLAY_NAMES[toolName] || toolName;
        let shortResult = '';
        let resultStatus = 'success';
        try {
            const parsed = JSON.parse(result);
            if (parsed.status === 'success') { shortResult = '✓ 成功'; resultStatus = 'success'; }
            else if (parsed.status === 'error') { shortResult = '✗ ' + (parsed.error || '失败').slice(0, 80); resultStatus = 'error'; }
            else { shortResult = '✓ 完成'; resultStatus = 'success'; }
        } catch (e) { shortResult = result && result.length > 60 ? result.slice(0, 60) + '...' : result || ''; }
        this._taskToolCalls[idx].push({ name: displayName, result: shortResult, status: resultStatus, elapsed: elapsed || 0 });
        this._lastTodoState = '';
        this.updateTodoBar();
    },

    _SVG_CHEVRON: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    _SVG_CHECK: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="var(--ai-success, #34d399)" stroke="var(--ai-success, #34d399)"/><polyline points="8 12 11 15 16 9" stroke="#fff" stroke-width="2.5"/></svg>',
    _SVG_SPINNER: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ai-accent, #0078d4)" stroke-width="2.5" stroke-linecap="round" class="solo-spin"><circle cx="12" cy="12" r="10" stroke-dasharray="20 40" opacity="0.35"/><path d="M12 2a10 10 0 0 1 10 10" stroke="var(--ai-accent, #0078d4)"/></svg>',
    _SVG_PENDING: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ai-text-muted, #666)" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>',
    _SVG_TOOL: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ai-text-muted, #888)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>',
    _SVG_PLAN: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5.5 3.5l2.5 2.5 4-4"/><path d="M5.5 8.5l2.5 2.5 4-4"/><rect x="1" y="1" width="14" height="14" rx="2"/></svg>',
    _SVG_DRAG: '<svg width="10" height="14" viewBox="0 0 10 16" fill="currentColor"><circle cx="3" cy="3" r="1.2"/><circle cx="7" cy="3" r="1.2"/><circle cx="3" cy="8" r="1.2"/><circle cx="7" cy="8" r="1.2"/><circle cx="3" cy="13" r="1.2"/><circle cx="7" cy="13" r="1.2"/></svg>',
    _SVG_DELETE: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',

    updateTodoBar() {
        const bar = document.getElementById('ai-todo-bar');
        if (!bar) return;
        const listEl = document.getElementById('ai-todo-list');
        const countEl = document.getElementById('ai-todo-count');
        const chevronEl = document.getElementById('ai-todo-chevron');
        if (!listEl) return;

        const todos = this._todos || [];
        if (todos.length === 0) {
            bar.style.display = 'none';
            this.updateSidePanelTasks();
            return;
        }
        bar.style.display = '';

        const doneCount = todos.filter(t => t.status === 'completed').length;
        const activeCount = todos.filter(t => t.status === 'in_progress').length;
        if (countEl) countEl.textContent = `${doneCount}/${todos.length}`;
        if (chevronEl) chevronEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="9 18 15 12 9 6"/></svg>';

        const allDone = doneCount === todos.length;
        bar.classList.toggle('solo-all-done', allDone);

        if (this._todoExpanded) {
            listEl.classList.add('solo-list-open');
        } else {
            listEl.classList.remove('solo-list-open');
        }

        listEl.innerHTML = todos.map((t, i) => {
            const isActive = t.status === 'in_progress';
            const isDone = t.status === 'completed';
            const headerClass = 'solo-item-header' + (isActive ? ' solo-header-active' : '');
            const labelClass = 'solo-item-label' + (isActive ? ' solo-active' : isDone ? ' solo-done' : ' solo-pending');
            const checkboxClass = 'solo-item-checkbox' + (isDone ? ' checked' : isActive ? ' active' : '');

            return `<div class="solo-task-item" data-index="${i}">
                <div class="${headerClass}">
                    <div class="${checkboxClass}"></div>
                    <span class="${labelClass}">${this.escapeHtml(t.content)}</span>
                </div>
            </div>`;
        }).join('');

        try { this.updateSidePanelTasks(); } catch (e) {}
    },

    _toggleTaskCard() {
        this._todoExpanded = !this._todoExpanded;
        this._lastTodoState = '';
        this.updateTodoBar();
    },

    _toggleTaskChain(idx) {
        const list = document.getElementById('ai-todo-list');
        const item = list && list.querySelector('.ai-msg-todo-item[data-task-idx="' + idx + '"]');
        if (!item) return;
        const tools = item.querySelector('.solo-item-tools');
        const toggle = item.querySelector('.solo-item-toggle');
        if (tools) {
            const isOpen = tools.classList.toggle('solo-tools-open');
            if (toggle) toggle.style.transform = isOpen ? 'rotate(90deg)' : '';
        }
    },

    _toggleTodoItem(idx) {
        if (idx < 0 || idx >= this._todos.length) return;
        const t = this._todos[idx];
        if (t.status === 'completed') {
            t.status = 'pending';
        } else {
            t.status = 'completed';
        }
        this._lastTodoState = '';
        this.updateTodoBar();
    },

    _deleteTodoItem(idx) {
        if (idx < 0 || idx >= this._todos.length) return;
        this._todos.splice(idx, 1);
        if (this._taskToolCalls[idx]) {
            delete this._taskToolCalls[idx];
        }
        const newToolCalls = {};
        Object.keys(this._taskToolCalls).forEach(k => {
            const ki = parseInt(k);
            if (ki < idx) newToolCalls[ki] = this._taskToolCalls[k];
            else if (ki > idx) newToolCalls[ki - 1] = this._taskToolCalls[k];
        });
        this._taskToolCalls = newToolCalls;
        this._lastTodoState = '';
        this.updateTodoBar();
    },

    _addTodoItem() {
        const list = document.getElementById('ai-todo-list');
        if (!list) return;
        const input = list.querySelector('.rc-todo-add input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;
        this._todos.push({
            id: 'task-' + Date.now(),
            content: text,
            status: 'pending',
            priority: 'medium'
        });
        input.value = '';
        this._lastTodoState = '';
        this.updateTodoBar();
    },

    _draggedTodoIdx: -1,

    _startDragTodo(e, idx) {
        this._draggedTodoIdx = idx;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
        const item = e.target.closest('.ai-msg-todo-item');
        if (item) item.classList.add('solo-dragging');
    },

    _onDragOverTodo(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const list = document.getElementById('ai-todo-list');
        if (!list) return;
        const items = list.querySelectorAll('.ai-msg-todo-item');
        items.forEach(item => item.classList.remove('solo-drag-over'));
        const target = e.target.closest('.ai-msg-todo-item');
        if (target) target.classList.add('solo-drag-over');
    },

    _onDropTodo(e, targetIdx) {
        e.preventDefault();
        const list = document.getElementById('ai-todo-list');
        if (list) {
            list.querySelectorAll('.ai-msg-todo-item').forEach(item => {
                item.classList.remove('solo-dragging');
                item.classList.remove('solo-drag-over');
            });
        }
        const sourceIdx = this._draggedTodoIdx;
        this._draggedTodoIdx = -1;
        if (sourceIdx < 0 || sourceIdx === targetIdx) return;
        if (sourceIdx < 0 || sourceIdx >= this._todos.length) return;
        if (targetIdx < 0 || targetIdx >= this._todos.length) return;

        const item = this._todos.splice(sourceIdx, 1)[0];
        this._todos.splice(targetIdx, 0, item);

        const oldTools = this._taskToolCalls[sourceIdx];
        delete this._taskToolCalls[sourceIdx];
        const newToolCalls = {};
        Object.keys(this._taskToolCalls).forEach(k => {
            let ki = parseInt(k);
            if (sourceIdx < targetIdx) {
                if (ki > sourceIdx && ki <= targetIdx) ki--;
            } else {
                if (ki >= targetIdx && ki < sourceIdx) ki++;
            }
            newToolCalls[ki] = this._taskToolCalls[k];
        });
        if (oldTools) newToolCalls[targetIdx] = oldTools;
        this._taskToolCalls = newToolCalls;

        this._lastTodoState = '';
        this.updateTodoBar();
    },

    _saveTodos() {
        try {
            const cid = this.currentId || 'default';
            const data = { todos: this._todos, toolCalls: this._taskToolCalls };
            localStorage.setItem('versepc_todos_' + cid, JSON.stringify(data));
        } catch (e) {}
    },

    _loadTodos() {
        try {
            const cid = this.currentId || 'default';
            const raw = localStorage.getItem('versepc_todos_' + cid);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (Array.isArray(data.todos) && data.todos.length > 0) {
                this._todos = data.todos;
                this._taskToolCalls = data.toolCalls || {};
                this._lastTodoState = '';
                this.updateTodoBar();
            }
        } catch (e) {}
    },

    _typewriterTimer: null,
    _typewriterTexts: [
        '你好，我是 VersePC Coder',
        '帮你搜索和安装模组',
        '帮你汉化模组',
        '帮你分析游戏崩溃原因',
        '描述你的需求，我来实现'
    ],
    _typewriterIdx: 0,
    _typewriterPhase: 'type',
    _typewriterCharIdx: 0,
    _typewriterPauseTimer: null,

    _startTypewriter(retryCount) {
        try {
            this._stopTypewriter();
            const el = document.getElementById('ai-welcome-typewriter');
            if (!el) {
                const attempt = retryCount || 0;
                if (attempt < 5) {
                    setTimeout(() => this._startTypewriter(attempt + 1), 100);
                } else {
                    console.warn('[Typewriter] element not found after 5 retries');
                }
                return;
            }
            el.textContent = '';
            this._typewriterIdx = 0;
            this._typewriterPhase = 'type';
            this._typewriterCharIdx = 0;
            this._typewriterEl = el;
            this._typewriterFirstTick = true;
            console.log('[Typewriter] started');
            this._typewriterTick();
        } catch (e) { console.error('[Typewriter] start error:', e); }
    },

    _typewriterTick() {
        const el = this._typewriterEl;
        if (!el) return;
        if (this._typewriterFirstTick) {
            this._typewriterFirstTick = false;
            console.log('[Typewriter] first tick');
        }
        const text = this._typewriterTexts[this._typewriterIdx];
        if (this._typewriterPhase === 'type') {
            if (this._typewriterCharIdx < text.length) {
                this._typewriterCharIdx++;
                el.textContent = text.substring(0, this._typewriterCharIdx);
                this._typewriterTimer = setTimeout(() => this._typewriterTick(), 80);
            } else {
                this._typewriterPhase = 'pause';
                this._typewriterPauseTimer = setTimeout(() => {
                    this._typewriterPhase = 'erase';
                    this._typewriterTick();
                }, 2500);
            }
        } else if (this._typewriterPhase === 'erase') {
            if (this._typewriterCharIdx > 0) {
                this._typewriterCharIdx--;
                el.textContent = text.substring(0, this._typewriterCharIdx);
                this._typewriterTimer = setTimeout(() => this._typewriterTick(), 40);
            } else {
                this._typewriterIdx = (this._typewriterIdx + 1) % this._typewriterTexts.length;
                this._typewriterPhase = 'type';
                this._typewriterTimer = setTimeout(() => this._typewriterTick(), 300);
            }
        }
    },

    _stopTypewriter() {
        if (this._typewriterTimer) {
            clearTimeout(this._typewriterTimer);
            this._typewriterTimer = null;
        }
        if (this._typewriterPauseTimer) {
            clearTimeout(this._typewriterPauseTimer);
            this._typewriterPauseTimer = null;
        }
    },

    toggleTodoList() {
        this._todoExpanded = !this._todoExpanded;
        this._lastTodoState = '';
        this.updateTodoBar();
    },

    condenseContext() {
        const conv = this.getCurrent();
        if (!conv || !conv.messages || conv.messages.length < 4) {
            if (typeof showToast === 'function') showToast('消息太少，无需压缩', 'info');
            return;
        }
        const totalChars = conv.messages.reduce((sum, m) => sum + (m.content || '').length, 0);
        if (totalChars < 8000) {
            if (typeof showToast === 'function') showToast('上下文还不够长，无需压缩', 'info');
            return;
        }
        const half = Math.floor(conv.messages.length / 2);
        const oldMessages = conv.messages.slice(0, half);
        const newMessages = conv.messages.slice(half);
        const summaryParts = [];
        for (const m of oldMessages) {
            if (m.role === 'user') {
                summaryParts.push('User: ' + (m.content || '').slice(0, 200));
            } else if (m.role === 'assistant') {
                summaryParts.push('Assistant: ' + (m.content || '').slice(0, 200));
            }
        }
        const summary = '[Context Summary]\nPrevious conversation:\n' + summaryParts.join('\n') + '\n\n[End Summary - Continue from here]';
        conv.messages = [{ role: 'user', content: summary }, ...newMessages];
        this.saveConversations();
        this._todos = [];
        for (const msg of conv.messages) {
            if (msg.role === 'assistant' && typeof msg.content === 'string') {
                const todos = this.parseTodosFromText(msg.content);
                if (todos.length > 0) this._todos = todos;
            }
        }
        this.updateTodoBar();
        this.showMessages(conv.messages);
        if (typeof showToast === 'function') showToast('上下文已压缩', 'success');
        this.updateSidePanelContext();
    },

    _sidePanelOpen: false,

    toggleSidePanel() {
        const panel = document.getElementById('ai-side-panel');
        const btn = document.getElementById('ai-panel-btn');
        if (!panel) return;
        this._sidePanelOpen = !this._sidePanelOpen;
        panel.classList.toggle('open', this._sidePanelOpen);
        if (btn) btn.classList.toggle('active', this._sidePanelOpen);
        if (this._sidePanelOpen) {
            this._initGitSection();
            this.updateSidePanel();
        }
    },

    updateSidePanel() {
        this.updateSidePanelTasks();
        this.updateSidePanelContext();
        this.updateSidePanelResources();
        this._updateGitSection();
    },

    updateSidePanelTasks() {
        const list = document.getElementById('ai-side-todo-list');
        if (!list) return;

        if (this._todos.length === 0) {
            list.innerHTML = '<div class="ai-side-todo-empty">暂无任务</div>';
            return;
        }

        const svgCheck = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width:10px;height:10px"><path d="M5 13l4 4L19 7"/></svg>';

        let html = '';
        for (let i = 0; i < this._todos.length; i++) {
            const t = this._todos[i];
            const isCompleted = t.status === 'completed';
            const isActive = t.status === 'in_progress';

            const checkCls = isCompleted ? 'ai-side-todo-check done'
                : isActive ? 'ai-side-todo-check active'
                : 'ai-side-todo-check pending';
            const textCls = isCompleted ? 'ai-side-todo-text done'
                : isActive ? 'ai-side-todo-text active'
                : 'ai-side-todo-text pending';
            const checkContent = isCompleted ? svgCheck : '';

            html += '<div class="ai-side-todo-item" onclick="AIChat._toggleTodoItem(' + i + ')">';
            html += '<span class="' + checkCls + '">' + checkContent + '</span>';
            html += '<span class="' + textCls + '">' + this.escapeHtml(t.content) + '</span>';
            html += '</div>';
        }
        list.innerHTML = html;
    },

    updateSidePanelContext() {
        const barFill = document.getElementById('ai-side-context-bar-fill');
        const barPct = document.getElementById('ai-side-context-bar-pct');
        const condenseBtn = document.getElementById('ai-side-condense-btn');
        const detailDesc = document.getElementById('ai-side-context-detail-desc');
        const conv = this.getCurrent();

        let pct = 0;
        let fileCount = 0;
        let toolCount = 0;
        let searchCount = 0;

        if (conv && conv.messages && conv.messages.length > 0) {
            const totalChars = conv.messages.reduce((sum, m) => sum + (m.content || '').length, 0);
            const maxChars = 128000;
            pct = Math.min(100, Math.round((totalChars / maxChars) * 100));

            for (const msg of conv.messages) {
                if (msg.role === 'tool') {
                    const content = msg.content || '';
                    if (content.includes('file_path') || content.includes('read_file') || content.includes('edit_file') || content.includes('write_file')) fileCount++;
                    if (content.includes('grep') || content.includes('search') || content.includes('glob') || content.includes('find')) searchCount++;
                }
                if (msg.role === 'assistant' && msg.tool_calls) {
                    toolCount += msg.tool_calls.length;
                }
            }

            if (detailDesc) {
                detailDesc.textContent = conv.messages.length + ' 条消息 · ' + toolCount + ' 次工具调用 · ' + (totalChars >= 1000 ? (totalChars / 1000).toFixed(1) + 'k' : totalChars) + ' 字符';
            }
            if (condenseBtn) condenseBtn.style.display = (conv.messages.length >= 4 && totalChars >= 8000) ? '' : 'none';
        } else {
            if (detailDesc) detailDesc.textContent = '等待对话开始...';
            if (condenseBtn) condenseBtn.style.display = 'none';
        }

        if (barFill) {
            barFill.style.width = pct + '%';
            if (pct > 80) {
                barFill.style.background = 'linear-gradient(90deg, var(--ai-warning, #f59e0b), var(--ai-error, #ef4444))';
            } else if (pct > 50) {
                barFill.style.background = 'linear-gradient(90deg, var(--ai-accent, #6366f1), var(--ai-warning, #f59e0b))';
            } else {
                barFill.style.background = 'linear-gradient(90deg, var(--ai-accent, #6366f1), var(--ai-success, #22c55e))';
            }
        }
        if (barPct) barPct.textContent = pct + '%';
    },

    updateSidePanelResources() {
        const list = document.getElementById('ai-side-resource-list');
        if (!list) return;
        const conv = this.getCurrent();
        if (!conv || !conv.messages) {
            list.innerHTML = '<div class="ai-side-resource-empty">暂无使用资源</div>';
            return;
        }

        const resources = new Map();
        const fileRegex = /(?:^|[\s(])([a-zA-Z]:[\\\/][^\s"'`<>)}\]]+|[\/][^\s"'`<>)}\]]+\.[a-zA-Z0-9]{1,10})/gm;
        const urlRegex = /https?:\/\/[^\s"'`<>)}\]]+/g;

        for (const msg of conv.messages) {
            if (msg.role === 'tool') {
                const content = msg.content || '';
                let match;
                fileRegex.lastIndex = 0;
                while ((match = fileRegex.exec(content)) !== null) {
                    const path = match[1];
                    if (!resources.has(path)) {
                        const ext = path.split('.').pop().toLowerCase();
                        const typeMap = { js: 'JavaScript', ts: 'TypeScript', py: 'Python', json: 'JSON', html: 'HTML', css: 'CSS', md: 'Markdown', java: 'Java', xml: 'XML', yml: 'YAML', yaml: 'YAML', cfg: 'Config', txt: 'Text', sh: 'Shell', bat: 'Batch', ps1: 'PowerShell', toml: 'TOML', properties: 'Properties' };
                        resources.set(path, { name: path.split(/[\\/]/).pop(), type: typeMap[ext] || ext.toUpperCase() + ' 文件', icon: '📄' });
                    }
                }
                urlRegex.lastIndex = 0;
                while ((match = urlRegex.exec(content)) !== null) {
                    const url = match[0];
                    if (!resources.has(url)) {
                        try {
                            const hostname = new URL(url).hostname;
                            resources.set(url, { name: hostname, type: 'URL', icon: '🔗' });
                        } catch (e) {}
                    }
                }
            }
            if (msg.role === 'assistant' && msg.tool_calls) {
                for (const tc of msg.tool_calls) {
                    const toolName = tc.function?.name || tc.name || '';
                    if (toolName && !resources.has('tool:' + toolName)) {
                        const toolIcons = { bash: '⚡', str_replace_based_edit_tool: '✏️', json_edit_tool: '✏️', ckg: '🔍', glob_search: '🔍', grep_search: '🔍', search: '🔍', sub_agent_dispatch: '🤖' };
                        resources.set('tool:' + toolName, {
                            name: TOOL_DISPLAY_NAMES[toolName] || toolName,
                            type: '工具',
                            icon: toolIcons[toolName] || '🔧'
                        });
                    }
                }
            }
        }

        if (resources.size === 0) {
            list.innerHTML = '<div class="ai-side-resource-empty">暂无使用资源</div>';
            return;
        }

        const fileIconColor = { js: '#f7df1e', ts: '#3178c6', py: '#3776ab', json: '#5b5b5b', html: '#e34c26', css: '#1572b6', md: '#083fa1', java: '#ed8b00', xml: '#0060ac', yml: '#cb171e', yaml: '#cb171e', cfg: '#6e6e6e', txt: '#6e6e6e', sh: '#4eaa25', bat: '#6e6e6e', ps1: '#012456', toml: '#9c4121', properties: '#6e6e6e' };
        let html = '';
        for (const [, res] of resources) {
            if (res.type === '工具') {
                const toolColors = { '终端命令': '#a855f7', '文件编辑': '#22c55e', '配置编辑': '#22c55e', '代码搜索': '#3b82f6', '文件搜索': '#3b82f6', '内容搜索': '#3b82f6', '搜索': '#3b82f6', '子代理': '#6366f1' };
                const color = toolColors[res.name] || '#6e6e6e';
                html += '<div class="ai-side-resource-item"><span class="ai-side-resource-badge" style="background:' + color + '20;color:' + color + '"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px"><circle cx="8" cy="8" r="5"/></svg></span><div class="ai-side-resource-info"><div class="ai-side-resource-name">' + this.escapeHtml(res.name) + '</div><div class="ai-side-resource-type">' + this.escapeHtml(res.type) + '</div></div></div>';
            } else if (res.type === 'URL') {
                html += '<div class="ai-side-resource-item"><span class="ai-side-resource-badge" style="background:#3b82f620;color:#3b82f6"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px"><path d="M6.5 9.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M9.5 6.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1"/></svg></span><div class="ai-side-resource-info"><div class="ai-side-resource-name">' + this.escapeHtml(res.name) + '</div><div class="ai-side-resource-type">链接</div></div></div>';
            } else {
                const ext = res.name.split('.').pop().toLowerCase();
                const color = fileIconColor[ext] || '#6e6e6e';
                html += '<div class="ai-side-resource-item"><span class="ai-side-resource-badge" style="background:' + color + '20;color:' + color + '">' + this.escapeHtml(ext.toUpperCase().slice(0, 3)) + '</span><div class="ai-side-resource-info"><div class="ai-side-resource-name">' + this.escapeHtml(res.name) + '</div><div class="ai-side-resource-type">' + this.escapeHtml(res.type) + '</div></div></div>';
            }
        }
        list.innerHTML = html;
    },

    getRecommendedModel(text) {
        const lowerText = (text || '').toLowerCase();
        const complexity = this._detectComplexity(lowerText);
        const models = this._availableModels || [];
        if (models.length === 0) return null;

        const fastModels = ['glm-4-flash', 'glm-flash', 'deepseek-chat', 'qwen-turbo', 'moonshot-v1-8k'];
        const smartModels = ['glm-4-plus', 'glm-4', 'deepseek-reasoner', 'qwen-max', 'moonshot-v1-128k', 'claude-3-5-sonnet'];
        const reasonModels = ['deepseek-reasoner', 'o1', 'o3-mini', 'claude-3-7-sonnet'];

        if (complexity >= 8) {
            const found = models.find(m => reasonModels.some(r => m.modelId.includes(r)));
            if (found) return found;
        }
        if (complexity >= 5) {
            const found = models.find(m => smartModels.some(r => m.modelId.includes(r)));
            if (found) return found;
        }
        return models.find(m => fastModels.some(r => m.modelId.includes(r))) || models[0];
    },

    _detectComplexity(text) {
        let score = 3;
        if (text.length > 500) score += 1;
        if (text.length > 1000) score += 1;
        const complexKeywords = ['重构', 'refactor', '架构', 'architecture', '优化', 'optimize', '调试', 'debug', '崩溃', 'crash', '性能', 'performance', '安全', 'security', '并发', 'concurrent', '分布式', 'distributed'];
        const simpleKeywords = ['你好', 'hello', 'hi', '谢谢', 'thanks', '什么是', 'what is', '解释', 'explain'];
        for (const kw of complexKeywords) { if (text.includes(kw)) score += 2; }
        for (const kw of simpleKeywords) { if (text.includes(kw)) score -= 2; }
        if (text.includes('```') || text.includes('code') || text.includes('代码')) score += 1;
        if (text.includes('为什么') || text.includes('why') || text.includes('分析') || text.includes('analyze')) score += 1;
        return Math.max(1, Math.min(10, score));
    },

    _showModelRecommendation(current, recommended) {
        const existing = document.querySelector('.ai-model-recommend');
        if (existing) existing.remove();
        const tip = document.createElement('div');
        tip.className = 'ai-model-recommend';
        tip.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;color:#f59e0b"><circle cx="8" cy="8" r="6"/><path d="M8 5v3"/><circle cx="8" cy="11" r="0.5" fill="currentColor"/></svg><span>建议使用 <strong>' + this.escapeHtml(recommended) + '</strong></span><button onclick="AIChat.selectModel(\'' + this.escapeHtml(recommended) + '\');this.closest(\'.ai-model-recommend\').remove()" class="ai-model-rec-btn">切换</button><button onclick="this.closest(\'.ai-model-recommend\').remove()" class="ai-model-rec-close">×</button>';
        const inputArea = document.querySelector('.rc-input-area');
        if (inputArea) inputArea.insertAdjacentElement('beforebegin', tip);
        setTimeout(() => { if (tip.isConnected) tip.remove(); }, 8000);
    },

    _terminalOpen: false,
    _terminalPinned: false,
    _terminalMaximized: false,
    _xtermInstance: null,
    _fitAddon: null,
    _terminalSessionId: null,
    _terminalDataHandler: null,
    _terminalExitHandler: null,

    toggleTerminal() {
        const panel = document.getElementById('ai-side-panel');
        const btn = document.getElementById('ai-terminal-btn');
        if (!panel) return;
        if (!this._sidePanelOpen) {
            this._sidePanelOpen = true;
            panel.classList.add('open');
            const panelBtn = document.getElementById('ai-panel-btn');
            if (panelBtn) panelBtn.classList.add('active');
        }
        if (!this._xtermInstance) {
            this._initTerminal();
        }
        if (this._fitAddon) {
            setTimeout(() => this._fitAddon.fit(), 50);
        }
        if (btn) btn.classList.add('active');
    },

    _initTerminal() {
        if (this._xtermInstance) return;
        const body = document.getElementById('ai-terminal-body');
        const hint = document.getElementById('ai-terminal-hint');
        if (hint) hint.style.display = 'none';

        const isDark = !document.body.hasAttribute('data-theme') || document.body.getAttribute('data-theme') === 'dark';
        this._xtermInstance = new Terminal({
            theme: isDark ? {
                background: '#1e1e1e',
                foreground: '#d4d4d4',
                cursor: '#d4d4d4',
                selectionBackground: '#264f78',
                black: '#000',
                red: '#cd3131',
                green: '#00bc00',
                yellow: '#949800',
                blue: '#0451a5',
                magenta: '#bc05bc',
                cyan: '#0598bc',
                white: '#555',
                brightBlack: '#666',
                brightRed: '#f14c4c',
                brightGreen: '#23d18b',
                brightYellow: '#f5f543',
                brightBlue: '#3399ff',
                brightMagenta: '#d670d6',
                brightCyan: '#29b8db',
                brightWhite: '#a5a5a5'
            } : {
                background: '#ffffff',
                foreground: '#333333',
                cursor: '#333333',
                selectionBackground: '#add6ff',
                black: '#000000',
                red: '#cd3131',
                green: '#00bc00',
                yellow: '#795e26',
                blue: '#0451a5',
                magenta: '#bc05bc',
                cyan: '#0598bc',
                white: '#555555',
                brightBlack: '#666666',
                brightRed: '#f14c4c',
                brightGreen: '#23d18b',
                brightYellow: '#f5f543',
                brightBlue: '#0451a5',
                brightMagenta: '#bc05bc',
                brightCyan: '#0598bc',
                brightWhite: '#a5a5a5'
            },
            fontSize: 13,
            fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
            cursorBlink: true,
            scrollback: 5000
        });
        this._fitAddon = new FitAddon.FitAddon();
        this._xtermInstance.loadAddon(this._fitAddon);
        this._xtermInstance.open(body);
        this._fitAddon.fit();

        this._terminalSessionId = 'ai-term-' + Date.now();
        const ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;
        if (ipcRenderer) {
            ipcRenderer.invoke('terminal:create', this._terminalSessionId, this._xtermInstance.cols, this._xtermInstance.rows);

            this._terminalDataHandler = (event, id, data) => {
                if (id === this._terminalSessionId && this._xtermInstance) {
                    this._xtermInstance.write(data);
                }
            };
            this._terminalExitHandler = (event, id, code) => {
                if (id === this._terminalSessionId && this._xtermInstance) {
                    this._xtermInstance.write('\r\n\x1b[33m[进程已退出，代码 ' + code + ']\x1b[0m\r\n');
                }
            };
            ipcRenderer.on('terminal:data', this._terminalDataHandler);
            ipcRenderer.on('terminal:exit', this._terminalExitHandler);

            this._xtermInstance.onData((data) => {
                ipcRenderer.invoke('terminal:write', this._terminalSessionId, data);
            });
        }

        this._xtermInstance.focus();
        this._initTerminalDrag();
    },

    createTerminal() {
        const ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;
        if (ipcRenderer && this._terminalSessionId) {
            ipcRenderer.invoke('terminal:kill', this._terminalSessionId);
        }
        if (this._xtermInstance) {
            this._xtermInstance.dispose();
            this._xtermInstance = null;
            this._fitAddon = null;
        }
        this._terminalSessionId = null;
        if (this._terminalOpen) {
            this._initTerminal();
        }
    },

    toggleTerminalPin() {
        this._terminalPinned = !this._terminalPinned;
        const btn = document.getElementById('ai-terminal-pin-btn');
        if (btn) btn.classList.toggle('active', this._terminalPinned);
    },

    toggleTerminalMaximize() {
        const body = document.getElementById('ai-terminal-body');
        if (body) {
            this._terminalMaximized = !this._terminalMaximized;
            if (this._terminalMaximized) {
                body.style.minHeight = '300px';
            } else {
                body.style.minHeight = '';
            }
        }
        if (this._fitAddon) setTimeout(() => this._fitAddon.fit(), 50);
    },

    _terminalDragInited: false,
    _initTerminalDrag() {},

    extractTodosFromStream(fullText) {
        const todos = this.parseTodosFromText(fullText);
        if (todos.length > 0) {
            this._todos = todos;
            this.updateTodoBar();
        }
    },

    async loadSettings() {
        const keys = [
            'versepc_ai_api_key', 'versepc_ai_model', 'versepc_ai_temp',
            'versepc_ai_auto_approve', 'versepc_ai_notifications', 'versepc_ai_context',
            'versepc_ai_terminal', 'versepc_ai_prompts', 'versepc_ai_ui',
            'versepc_ai_experimental', 'versepc_ai_language', 'versepc_ai_custom_provider'
        ];
        try {
            const all = await window.electronAPI.store.getMultiple(keys);
            if (all) {
                this.apiKey = all.versepc_ai_api_key || null;
                this.model = all.versepc_ai_model || null;
                this.temperature = parseFloat(all.versepc_ai_temp) || 0.7;
                try { if (all.versepc_ai_auto_approve) this._autoApproveSettings = JSON.parse(all.versepc_ai_auto_approve); } catch (e) {}
                try { if (all.versepc_ai_notifications) this._notifSettings = JSON.parse(all.versepc_ai_notifications); } catch (e) {}
                try { if (all.versepc_ai_context) this._contextSettings = JSON.parse(all.versepc_ai_context); } catch (e) {}
                try { if (all.versepc_ai_terminal) this._terminalSettings = JSON.parse(all.versepc_ai_terminal); } catch (e) {}
                try { if (all.versepc_ai_prompts) this._promptSettings = JSON.parse(all.versepc_ai_prompts); } catch (e) {}
                try { if (all.versepc_ai_ui) this._uiSettings = JSON.parse(all.versepc_ai_ui); } catch (e) {}
                try { if (all.versepc_ai_experimental) this._experimentalSettings = JSON.parse(all.versepc_ai_experimental); } catch (e) {}
                this._language = all.versepc_ai_language || 'zh-CN';
                try { if (all.versepc_ai_custom_provider) this._customProvider = JSON.parse(all.versepc_ai_custom_provider); } catch (e) {}
            }
        } catch (e) {
            try { this.apiKey = await window.electronAPI.store.get('versepc_ai_api_key'); } catch (e2) {}
            try { this.model = await window.electronAPI.store.get('versepc_ai_model'); } catch (e2) {}
            try { this.temperature = parseFloat(await window.electronAPI.store.get('versepc_ai_temp')); } catch (e2) {}
        }
    },

    async saveSettings() {
        const tempSlider = document.getElementById('ai-temp-slider');
        if (tempSlider) this.temperature = parseInt(tempSlider.value) / 100;

        try { await window.electronAPI.store.set('versepc_ai_temp', String(this.temperature)); } catch (e) {}
        try { if (this._autoApproveSettings) await window.electronAPI.store.set('versepc_ai_auto_approve', JSON.stringify(this._autoApproveSettings)); } catch (e) {}
        try { if (this._autoApproveSettings && window.electronAPI.ai?.syncAutoApproveSettings) await window.electronAPI.ai.syncAutoApproveSettings(this._autoApproveSettings); } catch (e) {}
        try { if (this._notifSettings) await window.electronAPI.store.set('versepc_ai_notifications', JSON.stringify(this._notifSettings)); } catch (e) {}
        try { if (this._contextSettings) await window.electronAPI.store.set('versepc_ai_context', JSON.stringify(this._contextSettings)); } catch (e) {}
        try { if (this._terminalSettings) await window.electronAPI.store.set('versepc_ai_terminal', JSON.stringify(this._terminalSettings)); } catch (e) {}
        try { if (this._promptSettings) await window.electronAPI.store.set('versepc_ai_prompts', JSON.stringify(this._promptSettings)); } catch (e) {}
        try { if (this._uiSettings) await window.electronAPI.store.set('versepc_ai_ui', JSON.stringify(this._uiSettings)); } catch (e) {}
        try { if (this._experimentalSettings) await window.electronAPI.store.set('versepc_ai_experimental', JSON.stringify(this._experimentalSettings)); } catch (e) {}
        try { if (this._language) await window.electronAPI.store.set('versepc_ai_language', this._language); } catch (e) {}

        this._markSettingsDirty(false);
        if (typeof showToast === 'function') showToast('配置已保存', 'success');
    },

    saveConversations() {
        if (this._saveConversationsTimer) clearTimeout(this._saveConversationsTimer);
        this._saveConversationsTimer = setTimeout(() => {
            this._saveConversationsTimer = null;
            this._doSaveConversations();
        }, 300);
    },

    async _doSaveConversations() {
        try {
            const data = JSON.stringify(this.conversations.map(c => ({
                id: c.id, title: c.title, messages: c.messages, createdAt: c.createdAt, folderPath: c.folderPath || null
            })));
            await window.electronAPI.store.set('versepc_ai_chats', data);
        } catch (e) {}
    },

    async loadConversations() {
        try {
            const raw = await window.electronAPI.store.get('versepc_ai_chats');
            if (raw) {
                const parsed = JSON.parse(raw);
                this.conversations = parsed || [];
                if (this.conversations.length > 0) {
                    this.currentId = this.conversations[0].id;
                }
            }
        } catch (e) {
            this.conversations = [];
        }
    },

    // 异步渲染 Markdown：使用 setTimeout 将 marked.parse 移出当前事件循环
    // 避免主线程被同步阻塞导致页面卡死
    asyncRenderMarkdown(text, callback) {
        if (!text) {
            callback('');
            return;
        }
        if (text.length > 8000) {
            const safe = text.slice(0, 8000);
            callback(this.escapeHtml(safe));
            return;
        }

        const doRender = () => {
            try {
                const html = this.renderMarkdown(text);
                callback(html);
            } catch (e) {
                callback(this.escapeHtml(text));
            }
        };

        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(doRender, { timeout: 200 });
        } else {
            setTimeout(doRender, 0);
        }
    },

    async _highlightCodeBlocks(container) {
        if (!container) return;
        if (!window.hljs) {
            try {
                await Promise.all([
                    _lazyLoadScript('js/highlight.min.js'),
                    Promise.resolve().then(() => _lazyLoadCSS('css/hljs-theme.min.css'))
                ]);
            } catch (e) { return; }
            if (!window.hljs) return;
        }
        const blocks = container.querySelectorAll('pre code:not([data-hljs-done])');
        if (blocks.length === 0) return;
        let index = 0;
        const highlightNext = () => {
            if (index >= blocks.length) return;
            const t0 = performance.now();
            while (index < blocks.length && performance.now() - t0 < 12) {
                const block = blocks[index];
                index++;
                try { hljs.highlightElement(block); block.setAttribute('data-hljs-done', ''); } catch (e) {}
            }
            if (index < blocks.length) {
                setTimeout(highlightNext, 0);
            }
        };
        highlightNext();
    },

    escapeHtml(text) {
        if (!text) return '';
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    sanitizeHtml(html) {
        if (!html) return '';
        return String(html)
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
            .replace(/<object[\s\S]*?<\/object>/gi, '')
            .replace(/<embed[\s\S]*?\/?>/gi, '')
            .replace(/<form[\s\S]*?<\/form>/gi, '')
            .replace(/<meta[\s\S]*?\/?>/gi, '')
            .replace(/<link[\s\S]*?\/?>/gi, '')
            .replace(/<base[\s\S]*?\/?>/gi, '')
            .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
            .replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '')
            .replace(/src\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '')
            .replace(/style\s*=\s*(?:"[^"]*expression\s*\([^"]*\)"|'[^']*expression\s*\([^']*\)')/gi, '');
    },

    _stripEmojis(text) {
        if (!text) return '';
        return text.replace(/[\u{1F600}-\u{1F64F}]/gu, '')
            .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
            .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
            .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
            .replace(/[\u{2600}-\u{26FF}]/gu, '')
            .replace(/[\u{2700}-\u{27BF}]/gu, '')
            .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
            .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
            .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
            .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
            .replace(/[\u{200D}]/gu, '')
            .replace(/[\u{20E3}]/gu, '')
            .replace(/[\u{E0020}-\u{E007F}]/gu, '')
            .replace(/[\u{1F000}-\u{1F02F}]/gu, '')
            .replace(/[\u{1F0A0}-\u{1F0FF}]/gu, '')
            .replace(/[\u{1F100}-\u{1F1AD}]/gu, '')
            .replace(/[\u{1F200}-\u{1F251}]/gu, '')
            .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
            .replace(/[\u{1F6C0}-\u{1F6FF}]/gu, '')
            .replace(/[\u{1F700}-\u{1F77F}]/gu, '')
            .replace(/[\u{1F780}-\u{1F7FF}]/gu, '')
            .replace(/[\u{1F800}-\u{1F8FF}]/gu, '')
            .replace(/\u200d/g, '')
            .replace(/[\u{2028}\u{2029}]/gu, '')
            .replace(/[\u{2194}-\u{21AA}]/gu, '')
            .replace(/[\u{2300}-\u{23FF}]/gu, '')
            .replace(/[\u{2B05}-\u{2B55}]/gu, '')
            .replace(/[\u{2934}-\u{2935}]/gu, '')
            .replace(/[\u{2B1B}-\u{2B1C}]/gu, '')
            .replace(/[\u{3030}]/gu, '')
            .replace(/[\u{303D}]/gu, '')
            .replace(/[\u{3297}]/gu, '')
            .replace(/[\u{3299}]/gu, '')
            .replace(/[\u{FE0F}]/gu, '')
            .replace(/[\u{200B}-\u{200F}]/gu, '')
            .replace(/[\u{202A}-\u{202E}]/gu, '')
            .replace(/[\u{2060}-\u{2064}]/gu, '')
            .replace(/[\u{2066}-\u{206F}]/gu, '')
            .replace(/\uFEFF/g, '')
            .replace(/\u00A0/g, ' ');
    },

    _markedConfigured: false,

    renderMarkdown(text) {
        if (!text) return '';
        text = this._stripEmojis(text);
        if (text.length > 8000) {
            return this.escapeHtml(text.slice(0, 8000)) + '<p style="color:var(--text-muted)">...(内容过长，已截断)</p>';
        }
        if (typeof marked !== 'undefined') {
            if (!this._markedConfigured) {
                const renderer = new marked.Renderer();
                renderer.listitem = function(item) {
                    if (item && typeof item === 'object' && item.tokens) {
                        const rendered = this.parser.parse(item.tokens);
                        if (item.task) {
                            const cls = item.checked ? 'task-completed' : 'task-pending';
                            const chk = item.checked ? ' checked' : '';
                            return `<li class="${cls}"><input type="checkbox"${chk} disabled>${rendered}</li>`;
                        }
                        return `<li>${rendered}</li>`;
                    }
                    const raw = typeof item === 'object' ? (item.text || item.raw || '') : String(item);
                    const m = raw.match(/^<input\s+checked=""\s+disabled=""\s+type="checkbox">(?:\s*)(.*)/i);
                    const m2 = raw.match(/^<input\s+disabled=""\s+type="checkbox">(?:\s*)(.*)/i);
                    if (m) return `<li class="task-completed"><input type="checkbox" checked disabled>${m[1]}</li>`;
                    if (m2) return `<li class="task-pending"><input type="checkbox" disabled>${m2[1]}</li>`;
                    return `<li>${raw}</li>`;
                };
                renderer.list = function(token) {
                    if (token && typeof token === 'object' && token.items) {
                        const isTask = token.items.some(i => i.task);
                        let html = '';
                        for (const item of token.items) { html += this.listitem(item); }
                        const tag = token.ordered ? 'ol' : 'ul';
                        const cls = isTask ? ' class="task-list"' : '';
                        const start = token.ordered && token.start !== 1 ? ` start="${token.start}"` : '';
                        return `<${tag}${cls}${start}>${html}</${tag}>`;
                    }
                    const raw = typeof token === 'object' ? '' : String(token);
                    const isTask = raw.includes('type="checkbox"');
                    return isTask ? `<ul class="task-list">${raw}</ul>` : `<ul>${raw}</ul>`;
                };
                renderer.code = function(codeOrToken, language) {
                    if (typeof codeOrToken === 'object' && codeOrToken !== null) {
                        language = codeOrToken.lang || language;
                        codeOrToken = codeOrToken.text || codeOrToken.raw || '';
                    }
                    const lang = AIChat.escapeHtml((language || 'text').toLowerCase());
                    const safeCode = AIChat.escapeHtml(String(codeOrToken || ''));
                    return `<div class="ai-code-block"><div class="ai-code-header"><span class="ai-code-lang">${lang}</span><button class="ai-code-copy" onclick="AIChat.copyCode(this)">复制</button></div><pre><code class="hljs language-${lang}">${safeCode}</code></pre></div>`;
                };
                marked.setOptions({
                    renderer,
                    breaks: true,
                    gfm: true
                });
                this._markedConfigured = true;
            }
            try { return this.sanitizeHtml(marked.parse(text)); } catch (e) { return this.escapeHtml(text); }
        }
        let html = this.escapeHtml(text);
        html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => `<pre><code class="language-${lang}">${code.trim()}</code></pre>`);
        html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
        html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
        html = html.replace(/\n{2,}/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        html = '<p>' + html + '</p>';
        html = html.replace(/<p>(<h[123]>)/g, '$1');
        html = html.replace(/(<\/h[123]>)<\/p>/g, '$1');
        html = html.replace(/<p>(<(?:pre|ul|ol|blockquote)>)/g, '$1');
        html = html.replace(/(<\/(?:pre|ul|ol|blockquote)>)<\/p>/g, '$1');
        html = html.replace(/<p><\/p>/g, '');
        return html;
    },

    copyCode(btn) {
        const codeBlock = btn.closest('.ai-code-block');
        if (!codeBlock) return;
        const code = codeBlock.querySelector('code');
        if (!code) return;
        navigator.clipboard.writeText(code.textContent).then(() => {
            btn.textContent = '已复制';
            btn.classList.add('copied');
            setTimeout(() => { btn.textContent = '复制'; btn.classList.remove('copied'); }, 2000);
        }).catch(() => {});
    },

    appendActionBar(msgElement, options = {}) {
        if (!msgElement) return;
        const bar = document.createElement('div');
        bar.className = 'ai-msg-action-bar';

        const left = document.createElement('div');
        left.className = 'ai-msg-action-bar-left';
        if (options.statusText) {
            left.textContent = options.statusText;
        }

        const right = document.createElement('div');
        right.className = 'ai-msg-action-bar-right';

        const thumbsUpSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
        const thumbsDownSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>';
        const copySvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        const refreshSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';

        const btnData = [
            { svg: thumbsUpSvg, cls: 'ai-msg-action-btn', title: '赞同', action: () => { bar.querySelector('.ai-msg-action-btn.liked')?.classList.remove('liked'); bar.querySelector('.ai-msg-action-btn.disliked')?.classList.remove('disliked'); const btn = bar.querySelector('[data-action="up"]'); if (btn) btn.classList.toggle('liked'); } },
            { svg: thumbsDownSvg, cls: 'ai-msg-action-btn', title: '反对', action: () => { bar.querySelector('.ai-msg-action-btn.liked')?.classList.remove('liked'); bar.querySelector('.ai-msg-action-btn.disliked')?.classList.remove('disliked'); const btn = bar.querySelector('[data-action="down"]'); if (btn) btn.classList.toggle('disliked'); } },
            { svg: copySvg, cls: 'ai-msg-action-btn', title: '复制', action: () => { const content = msgElement.querySelector('.ai-msg-bubble'); if (content) { navigator.clipboard.writeText(content.textContent).then(() => showToast('已复制到剪贴板')); } } },
            { svg: refreshSvg, cls: 'ai-msg-action-btn', title: '重新生成', action: () => { if (typeof AIChat !== 'undefined' && AIChat.retryLastMessage) AIChat.retryLastMessage(); } }
        ];
        const actionNames = ['up', 'down', 'copy', 'refresh'];

        btnData.forEach((bd, i) => {
            const btn = document.createElement('button');
            btn.className = bd.cls;
            btn.dataset.action = actionNames[i];
            btn.innerHTML = bd.svg;
            btn.addEventListener('click', bd.action);
            right.appendChild(btn);
        });

        bar.appendChild(left);
        bar.appendChild(right);
        msgElement.appendChild(bar);
    },

    classifyError(error) {
        const e = (error || '').toLowerCase();
        if (e.includes('429') || e.includes('rate_limit')) return { icon: svgIcon('M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83'), title: '请求过于频繁', retryLabel: '稍后重试', action: 'retry' };
        if (e.includes('quota') || e.includes('exhausted') || e.includes('insufficient') || e.includes('余额') || e.includes('配额') || e.includes('billing') || e.includes('payment')) return { icon: svgIcon('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'), title: '配额已用完', retryLabel: '打开设置', action: 'settings' };
        if (e.includes('过期') || e.includes('expired') || e.includes('invalid_token') || e.includes('token_invalid')) return { icon: svgIcon('M23 18v2h-8v-2h3v-7a3 3 0 0 0-3-3h-4V4a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h16a2 2 0 0 0 2-2zM8 14h8v2H8z'), title: '令牌/API Key 已过期', retryLabel: '打开设置', action: 'settings' };
        if (e.includes('401') || e.includes('403') || e.includes('api key') || e.includes('apikey') || e.includes('unauthorized') || e.includes('认证失败')) return { icon: svgIcon('M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4'), title: 'API 密钥无效', retryLabel: '检查设置', action: 'settings' };
        if (e.includes('503') || e.includes('overloaded') || e.includes('service_unavailable') || e.includes('过载')) return { icon: svgIcon('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'), title: '服务过载', retryLabel: '稍后重试', action: 'retry' };
        if (e.includes('model_not_found') || e.includes('model not found') || e.includes('模型不存在') || e.includes('模型未找到')) return { icon: svgIcon('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zM17.9 17.39c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z'), title: '模型不存在', retryLabel: '检查设置', action: 'settings' };
        if (e.includes('content_filter') || e.includes('content blocked') || e.includes('安全审核') || e.includes('内容过滤') || e.includes('sensitive')) return { icon: svgIcon('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'), title: '内容被过滤', retryLabel: '修改后重试', action: 'retry' };
        if (e.includes('network') || e.includes('econnrefused') || e.includes('timeout') || e.includes('超时') || e.includes('fetch') || e.includes('econnreset')) return { icon: svgIcon('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zM17.9 17.39c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z'), title: '网络连接失败', retryLabel: '重新连接', action: 'retry' };
        if (e.includes('context_length') || (e.includes('token') && e.includes('exceed')) || e.includes('too long')) return { icon: svgIcon('M21 3H3v18h18V3zM9 3v18M15 3v18M3 9h18M3 15h18'), title: '对话过长', retryLabel: '新对话', action: 'retry' };
        return { icon: svgIcon('M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z,M12 9v4,M12 17h.01'), title: '请求失败', retryLabel: '重试', action: 'retry' };
    },

    _renderErrorCard(container, errorMsg) {
        const warningSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        const chevronSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
        const copyDetailSvg = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px;vertical-align:-2px"><rect x="5" y="5" width="8" height="8" rx="1"/><path d="M3 11V4a1 1 0 0 1 1-1h6"/></svg>';

        let contextLines = null;
        let rawErrorMsg = errorMsg || '未知错误';
        const ctxMatch = errorMsg && errorMsg.match(/^API 调用失败\nProvider: (.+)\nModel: (.+)\nEndpoint: (.+)\n错误: ([\s\S]*)$/);
        if (ctxMatch) {
            contextLines = { provider: ctxMatch[1], model: ctxMatch[2], endpoint: ctxMatch[3], error: ctxMatch[4] };
            rawErrorMsg = contextLines.error;
        }

        const errInfo = this.classifyError(rawErrorMsg);
        const btnAction = errInfo.action === 'settings' ? "AIChat.toggleSettings()" : "AIChat.retryLastMessage()";
        let friendlyMsg = rawErrorMsg;
        if (/econnreset/i.test(friendlyMsg)) friendlyMsg = '网络连接被重置，可能是服务器中断了连接。请检查网络后重试。';
        else if (/econnrefused/i.test(friendlyMsg)) friendlyMsg = '连接被拒绝，服务器可能未启动或不可达。';
        else if (/etimedout/i.test(friendlyMsg)) friendlyMsg = '连接超时，服务器响应时间过长。';
        else if (/socket hang up/i.test(friendlyMsg)) friendlyMsg = '连接被中断，可能是网络不稳定导致。';
        const escapedError = this.escapeHtml(friendlyMsg);

        const contextHtml = contextLines ? `<div class="ai-error-context" style="margin-bottom:8px;padding:6px 10px;border-radius:6px;background:rgba(239,68,68,0.06);font-size:11px;color:rgba(252,165,165,0.8);line-height:1.6"><div>Provider: ${this.escapeHtml(contextLines.provider)}</div><div>Model: ${this.escapeHtml(contextLines.model)}</div><div>Endpoint: ${this.escapeHtml(contextLines.endpoint)}</div></div>` : '';

        const detailText = errorMsg || '未知错误';
        const detailClipboard = this.escapeHtml(detailText).replace(/'/g, "&#39;").replace(/\n/g, '\\n');
        const rawClipboard = this.escapeHtml(rawErrorMsg).replace(/'/g, "&#39;");

        container.innerHTML = `<div class="ai-error-block" style="animation:aiMsgIn 0.3s var(--ease-out-expo)"><div class="ai-error-block-header" onclick="this.nextElementSibling.classList.toggle('open');this.querySelector('.ai-error-block-chevron').classList.toggle('open')"><span class="ai-error-block-icon">${warningSvg}</span><span class="ai-error-block-title">${errInfo.title}</span><span class="ai-error-block-chevron">${chevronSvg}</span></div><div class="ai-error-block-body open">${contextHtml}<div class="ai-error-block-text">${escapedError}</div><div class="ai-error-actions" style="display:flex;gap:8px;margin-top:10px"><button class="ai-error-btn" onclick="${btnAction}" style="padding:5px 14px;border-radius:6px;border:none;background:rgba(239,68,68,0.15);color:#fca5a5;font-size:12px;cursor:pointer;transition:background 0.15s">${errInfo.retryLabel}</button><button class="ai-error-copy-btn" onclick="navigator.clipboard.writeText('${rawClipboard}').then(()=>{this.textContent='已复制';setTimeout(()=>this.textContent='复制',1500)})" style="padding:5px 14px;border-radius:6px;border:1px solid rgba(239,68,68,0.2);background:transparent;color:#fca5a5;font-size:12px;cursor:pointer;transition:background 0.15s">复制</button>${contextLines ? `<button class="ai-error-detail-btn" onclick="navigator.clipboard.writeText('${detailClipboard}').then(()=>{this.innerHTML='${copyDetailSvg} 已复制';setTimeout(()=>this.innerHTML='${copyDetailSvg} 复制错误详情',1500)})" style="padding:5px 14px;border-radius:6px;border:1px solid rgba(239,68,68,0.2);background:transparent;color:#fca5a5;font-size:12px;cursor:pointer;transition:background 0.15s">${copyDetailSvg} 复制错误详情</button>` : ''}</div></div></div>`;
    },

    _renderSubAgentCard(agentType, name, role, task) {
        const config = this._subAgentConfigs[agentType] || { name: 'Sub Agent', role, icon: 'code', color: '#666' };
        const card = document.createElement('div');
        card.className = 'ai-subagent-card';
        card.dataset.agentType = agentType;

        const chevronSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

        const header = document.createElement('div');
        header.className = 'ai-subagent-header';
        header.innerHTML = `
            <span class="ai-subagent-dot" style="background:${config.color}"></span>
            <span class="ai-subagent-name">${config.name}</span>
            <span class="ai-subagent-status-text">执行中...</span>
            <span class="ai-subagent-chevron open">${chevronSvg}</span>
        `;

        const body = document.createElement('div');
        body.className = 'ai-subagent-body open';

        const thinking = document.createElement('div');
        thinking.className = 'ai-subagent-thinking';
        thinking.innerHTML = '<div class="ai-subagent-thinking-dots"><span></span><span></span><span></span></div>';
        body.appendChild(thinking);

        header.addEventListener('click', () => {
            const isOpen = body.classList.toggle('open');
            header.querySelector('.ai-subagent-chevron').classList.toggle('open', isOpen);
        });

        card.appendChild(header);
        card.appendChild(body);

        this._currentSubAgent = { card, body, thinking, agentType, name, _isOpen: true, _headerEl: header };
        this._subAgentTools = [];

        return card;
    },

    _updateSubAgentStatus(agentType, text) {
        if (!this._currentSubAgent || this._currentSubAgent.agentType !== agentType) return;
        const header = this._currentSubAgent._headerEl;
        if (!header) return;
        const label = header.querySelector('.ai-subagent-status-text');
        if (label) label.textContent = text;
    },

    _appendSubAgentChunk(agentType, chunk) {
        if (!this._currentSubAgent || this._currentSubAgent.agentType !== agentType) return;
        const body = this._currentSubAgent.body;
        const thinking = this._currentSubAgent.thinking;

        if (chunk.type === 'say' && (chunk.say === 'text_delta' || chunk.say === 'text')) {
            if (thinking && thinking.parentElement) thinking.remove();
            this._updateSubAgentStatus(agentType, '分析中...');
            let textBlock = body.querySelector('.ai-subagent-text-block');
            if (!textBlock) {
                textBlock = document.createElement('div');
                textBlock.className = 'ai-subagent-text-block';
                textBlock._rawText = '';
                body.appendChild(textBlock);
            }
            textBlock._rawText += (chunk.text || '');
            textBlock.innerHTML = this.renderMarkdown(textBlock._rawText);
            body.scrollTop = body.scrollHeight;
        } else if (chunk.type === 'say' && chunk.say === 'tool_start') {
            if (thinking && thinking.parentElement) thinking.remove();
            let toolInfo;
            try { toolInfo = JSON.parse(chunk.text); } catch(e) { toolInfo = { displayName: chunk.text, name: 'unknown' }; }
            const toolName = toolInfo.name || toolInfo.displayName || 'tool';
            const toolDesc = toolInfo.displayName || TOOL_DISPLAY_NAMES[toolName] || toolName;
            this._subAgentTools.push({ name: toolName, desc: toolDesc, result: null, startTime: Date.now() });
            this._updateSubAgentStatus(agentType, `${toolDesc}...`);

            const toolLine = document.createElement('div');
            toolLine.className = 'ai-subagent-tool-line';
            const agentColor = this._subAgentConfigs[agentType]?.color || '#3b82f6';
            toolLine.innerHTML = `<span class="ai-subagent-tool-dot" style="background:${agentColor}"></span><span class="ai-subagent-tool-desc">${toolDesc}</span><span class="ai-subagent-tool-status">...</span>`;
            body.appendChild(toolLine);
            this._currentSubAgent._lastToolLine = toolLine;
            body.scrollTop = body.scrollHeight;
        } else if (chunk.type === 'say' && chunk.say === 'tool_result') {
            let toolResult;
            try { toolResult = JSON.parse(chunk.text); } catch(e) { toolResult = { result: chunk.text }; }
            const toolIdx = this._currentSubAgent._lastToolIndex;
            if (toolIdx != null && this._subAgentTools[toolIdx]) {
                this._subAgentTools[toolIdx].result = toolResult;
                const toolLine = this._currentSubAgent._lastToolLine;
                if (toolLine) {
                    const statusEl = toolLine.querySelector('.ai-subagent-tool-status');
                    if (statusEl) statusEl.textContent = '✓';
                    toolLine.classList.add('done');
                }
                body.scrollTop = body.scrollHeight;
            }
        }
    },

    _finalizeSubAgent(agentType, result, error) {
        if (!this._currentSubAgent || this._currentSubAgent.agentType !== agentType) return;
        const { card, body, thinking, _headerEl } = this._currentSubAgent;

        if (thinking && thinking.parentElement) thinking.remove();

        if (result && !error) {
            const resultBlock = document.createElement('div');
            resultBlock.className = 'ai-subagent-result';
            const mdDiv = document.createElement('div');
            mdDiv.className = 'ai-subagent-result-markdown';
            try {
                const parsed = JSON.parse(result);
                mdDiv.innerHTML = this.renderMarkdown(parsed.result || result);
            } catch(e) {
                mdDiv.innerHTML = this.renderMarkdown(result);
            }
            resultBlock.appendChild(mdDiv);
            body.appendChild(resultBlock);
        }

        if (error) {
            const errorBlock = document.createElement('div');
            errorBlock.className = 'ai-subagent-error';
            errorBlock.textContent = error;
            body.appendChild(errorBlock);
        }

        const toolCount = (this._subAgentTools || []).length;
        if (_headerEl) {
            const statusText = _headerEl.querySelector('.ai-subagent-status-text');
            if (error) {
                if (statusText) statusText.textContent = '失败';
            } else if (toolCount > 0) {
                if (statusText) statusText.textContent = `完成 · ${toolCount} 个操作`;
            } else {
                if (statusText) statusText.textContent = '完成';
            }
            body.classList.remove('open');
            _headerEl.querySelector('.ai-subagent-chevron').classList.remove('open');
        }

        this._currentSubAgent = null;
    },

    retryLastMessage() {
        const conv = this.getCurrent();
        if (!conv) return;
        const lastMsg = conv.messages[conv.messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') conv.messages.pop();
        const lastUserMsg = [...conv.messages].reverse().find(m => m.role === 'user');
        if (lastUserMsg) {
            this.showMessages(conv.messages);
            this.sendMessage(lastUserMsg.content);
        }
    },

    copyLastMessage() {
        const conv = this.getCurrent();
        if (!conv) return;
        const lastMsg = [...conv.messages].reverse().find(m => m.role === 'assistant');
        if (lastMsg) {
            navigator.clipboard.writeText(lastMsg.content).catch(() => {});
        }
    },

    async exportConversation() {
        const conv = this.getCurrent();
        if (!conv) return;
        const text = conv.messages.map(m => `[${m.role === 'user' ? '用户' : 'AI'}]\n${m.content}`).join('\n\n---\n\n');
        try {
            if (window.electronAPI?.clipboard) { window.electronAPI.clipboard.writeText(text); }
            else { await navigator.clipboard.writeText(text); }
        } catch(e) {
            try { await navigator.clipboard.writeText(text); } catch(e2) {}
        }
        if (typeof showToast === 'function') showToast('对话已复制到剪贴板', 'success');
    },

    _showExportDialog() {
        const overlay = document.createElement('div');
        overlay.className = 'ai-export-dialog-overlay';
        overlay.onclick = function() { overlay.remove(); };
        overlay.innerHTML = '<div class="ai-export-dialog" onclick="event.stopPropagation()">' +
            '<div class="ai-export-dialog-header">' +
            '<span>导出对话</span>' +
            '<button onclick="this.closest(\'.ai-export-dialog-overlay\').remove()">\u00d7</button>' +
            '</div>' +
            '<div class="ai-export-dialog-body">' +
            '<div class="ai-export-option" onclick="AIChat.exportAsMarkdown();this.closest(\'.ai-export-dialog-overlay\').remove()">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
            '<div><div class="ai-export-option-title">Markdown</div><div class="ai-export-option-desc">导出为 .md 文件，包含完整格式</div></div>' +
            '</div>' +
            '<div class="ai-export-option" onclick="AIChat.exportAsJson();this.closest(\'.ai-export-dialog-overlay\').remove()">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' +
            '<div><div class="ai-export-option-title">JSON</div><div class="ai-export-option-desc">导出完整数据，包含工具调用记录</div></div>' +
            '</div>' +
            '<div class="ai-export-option" onclick="AIChat.exportAsHtml();this.closest(\'.ai-export-dialog-overlay\').remove()">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' +
            '<div><div class="ai-export-option-title">HTML</div><div class="ai-export-option-desc">导出为独立网页，可直接分享</div></div>' +
            '</div>' +
            '<div class="ai-export-option" onclick="AIChat.exportConversation();this.closest(\'.ai-export-dialog-overlay\').remove()">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
            '<div><div class="ai-export-option-title">复制到剪贴板</div><div class="ai-export-option-desc">复制纯文本到剪贴板</div></div>' +
            '</div>' +
            '</div>' +
            '</div>';
        document.body.appendChild(overlay);
    },

    exportAsMarkdown() {
        const conv = this.getCurrent();
        if (!conv) return;
        const date = new Date(conv.createdAt).toLocaleString('zh-CN');
        let md = '# ' + (conv.title || '对话') + '\n\n';
        md += '> 导出时间: ' + date + '\n\n';
        for (let i = 0; i < conv.messages.length; i++) {
            const m = conv.messages[i];
            if (m.role === 'user') {
                md += '## 用户\n\n' + (m.content || '') + '\n\n';
            } else if (m.role === 'assistant') {
                md += '## AI\n\n' + (m.content || '') + '\n\n';
            }
            if (m.tool_calls) {
                for (let j = 0; j < m.tool_calls.length; j++) {
                    const tc = m.tool_calls[j];
                    md += '### 工具调用: ' + (tc.name || '') + '\n\n```json\n' + JSON.stringify(tc.arguments, null, 2) + '\n```\n\n';
                }
            }
        }
        this._downloadFile((conv.title || '对话') + '.md', md, 'text/markdown');
        if (typeof showToast === 'function') showToast('Markdown 文件已导出', 'success');
    },

    exportAsJson() {
        const conv = this.getCurrent();
        if (!conv) return;
        const data = {
            id: conv.id,
            title: conv.title,
            createdAt: conv.createdAt,
            messages: conv.messages
        };
        const json = JSON.stringify(data, null, 2);
        this._downloadFile((conv.title || '对话') + '.json', json, 'application/json');
        if (typeof showToast === 'function') showToast('JSON 文件已导出', 'success');
    },

    exportAsHtml() {
        const conv = this.getCurrent();
        if (!conv) return;
        const date = new Date(conv.createdAt).toLocaleString('zh-CN');
        let messagesHtml = '';
        for (let i = 0; i < conv.messages.length; i++) {
            const m = conv.messages[i];
            const roleLabel = m.role === 'user' ? '用户' : 'AI';
            const roleColor = m.role === 'user' ? '#6366f1' : '#22c55e';
            const content = this.escapeHtml(m.content || '').replace(/\n/g, '<br>');
            messagesHtml += '<div style="margin-bottom:16px">' +
                '<div style="font-size:12px;font-weight:600;color:' + roleColor + ';margin-bottom:4px">' + roleLabel + '</div>' +
                '<div style="font-size:13px;color:#cccccc;line-height:1.6;padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px">' + content + '</div>' +
                '</div>';
        }
        const html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>' + this.escapeHtml(conv.title || '对话') + '</title>\n' +
            '<style>body{margin:0;padding:20px 40px;background:#0d1117;color:#cccccc;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}h1{font-size:18px;margin-bottom:4px}.date{font-size:12px;color:#6e6e6e;margin-bottom:24px}</style>\n' +
            '</head>\n<body>\n<h1>' + this.escapeHtml(conv.title || '对话') + '</h1>\n<div class="date">' + date + '</div>\n' + messagesHtml + '\n</body>\n</html>';
        this._downloadFile((conv.title || '对话') + '.html', html, 'text/html');
        if (typeof showToast === 'function') showToast('HTML 文件已导出', 'success');
    },

    _downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },



    updateModelLabel() {
        const label = document.getElementById('ai-current-model-label');
        const settingsName = document.getElementById('ai-settings-model-name');
        const settingsBadge = document.getElementById('ai-settings-model-badge');
        const modelId = this.model;
        if (!modelId) {
            if (label) label.textContent = '未选择模型';
            if (settingsName) settingsName.textContent = '未选择模型';
            if (settingsBadge) { settingsBadge.textContent = ''; settingsBadge.className = 'ai-settings-model-badge'; }
            return;
        }
        let displayName = modelId;
        let isFree = false;
        if (this.addedModels) {
            const am = this.addedModels.find(m => m.modelId === modelId);
            if (am) { displayName = am.modelName || am.modelId; isFree = am.free; }
        }
        if (displayName === modelId) {
            for (const p of this.providers) {
                const m = p.models.find(m => m.id === modelId);
                if (m) { displayName = m.name; isFree = m.free; break; }
            }
        }
        if (label) label.textContent = displayName;
        if (settingsName) settingsName.textContent = displayName;
        if (settingsBadge) {
            settingsBadge.textContent = isFree ? '免费' : '付费';
            settingsBadge.className = 'ai-settings-model-badge' + (isFree ? ' free' : '');
        }
    },

    triggerAttachment() {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/*,.txt,.json,.log,.md,.cfg,.properties,.yml,.yaml,.xml,.java';
        input.onchange = (e) => {
            const files = e.target.files;
            if (!files || !files.length) return;
            for (const file of files) {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        this._attachedImages = this._attachedImages || [];
                        this._attachedImages.push({ name: file.name, dataUrl: ev.target.result });
                        this._showAttachPreview(file.name);
                    };
                    reader.readAsDataURL(file);
                } else {
                    this._attachedFiles = this._attachedFiles || [];
                    this._attachedFiles.push({ name: file.name, size: file.size });
                    this._showAttachPreview(file.name);
                }
            }
        };
        input.click();
    },

    _showAttachPreview(name) {
        const inputArea = document.querySelector('.rc-input-area');
        if (!inputArea) return;
        let preview = inputArea.querySelector('.ai-attach-preview');
        if (!preview) {
            preview = document.createElement('div');
            preview.className = 'ai-attach-preview';
            inputArea.querySelector('.rc-input-container').before(preview);
        }
        const chip = document.createElement('span');
        chip.className = 'ai-attach-chip';
        chip.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:10px;height:10px"><path d="M4 12l3-3 2 2 3-3"/></svg>${name}<button class="ai-attach-chip-remove" onclick="this.parentElement.remove()">×</button>`;
        preview.appendChild(chip);
    },

    handlePaste(event) {
        const items = event.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                event.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const textarea = document.getElementById('ai-input');
                        if (textarea) {
                            textarea.value += `[图片: ${file.name || 'clipboard'}]`;
                            aiAutoResize(textarea);
                        }
                    };
                    reader.readAsDataURL(file);
                }
                return;
            }
        }
    },

    handleDrop(event) {
        event.preventDefault();
        const textarea = document.getElementById('ai-input');
        if (!textarea) return;
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
            for (const file of files) {
                textarea.value += `[文件: ${file.path || file.name}]`;
            }
            aiAutoResize(textarea);
        }
    },

    showModelSelector() {
        const existing = document.getElementById('ai-model-popup');
        if (existing) { existing.remove(); return; }
        const btn = document.getElementById('ai-model-select-btn');
        if (!btn) return;
        const currentModel = this.model;
        let models = [];
        const allModels = this.addedModels;
        for (const m of allModels) {
            models.push({ id: m.modelId, name: m.modelName || m.modelId, provider: m.providerName || m.providerKey || '未知', free: m.free, providerKey: m.providerKey });
        }
        if (!models.length) {
            this._currentSettingsTab = 'providers';
            this.toggleSettings();
            return;
        }
        const grouped = {};
        for (const m of models) {
            if (!grouped[m.provider]) grouped[m.provider] = [];
            grouped[m.provider].push(m);
        }
        let listHtml = '';
        for (const [provider, pm] of Object.entries(grouped)) {
            listHtml += `<div class="ai-model-popup-group"><div class="ai-model-popup-group-label">${provider}</div>`;
            for (const m of pm) {
                const isActive = m.id === currentModel;
                listHtml += `<div class="ai-model-popup-item${isActive ? ' active' : ''}" data-model-id="${m.id}" onclick="AIChat.selectModel('${m.id}')">
                    <div class="ai-model-popup-item-dot${isActive ? ' active' : ''}"></div>
                    <div class="ai-model-popup-item-info">
                        <span class="ai-model-popup-item-name">${m.name}</span>
                        <span class="ai-model-popup-item-id">${m.id}</span>
                    </div>
                    ${m.free ? '<span class="ai-model-popup-item-free">FREE</span>' : ''}
                </div>`;
            }
            listHtml += '</div>';
        }
        const popup = document.createElement('div');
        popup.id = 'ai-model-popup';
        popup.className = 'ai-model-popup';
        popup.innerHTML = `<div class="ai-model-popup-header"><span class="ai-model-popup-title">选择模型</span><button class="ai-model-popup-close" onclick="document.getElementById('ai-model-popup').remove()"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px"><path d="M4 4l8 8M12 4l-8 8"/></svg></button></div><div class="ai-model-popup-list">${listHtml}</div><div class="ai-model-popup-footer"><button class="ai-model-popup-manage" onclick="document.getElementById('ai-model-popup').remove();AIChat._currentSettingsTab='providers';AIChat.toggleSettings()">管理模型</button></div>`;
        document.body.appendChild(popup);
        const btnRect = btn.getBoundingClientRect();
        popup.style.position = 'fixed';
        popup.style.bottom = (window.innerHeight - btnRect.top + 6) + 'px';
        popup.style.left = Math.max(8, Math.min(btnRect.left, window.innerWidth - 320)) + 'px';
        popup.style.zIndex = '10000';
        const closeOnOutside = (e) => {
            if (!popup.contains(e.target) && !btn.contains(e.target)) {
                popup.remove();
                document.removeEventListener('mousedown', closeOnOutside);
            }
        };
        setTimeout(() => document.addEventListener('mousedown', closeOnOutside), 0);
    },

    selectModel(modelId) {
        this.model = modelId;
        this.updateModelLabel();
        const popup = document.getElementById('ai-model-popup');
        if (popup) popup.remove();
        try { localStorage.setItem('ai-chat-model', modelId); } catch(e) {}
    },

    showFolderSwitcher() {
        this._currentSettingsTab = 'ui';
        this.toggleSettings();
    },

    clearFollowUpSuggestions() {
        const suggestions = document.querySelectorAll('.ai-follow-up, .ai-suggestion-chip, .rc-follow-up');
        suggestions.forEach(el => el.remove());
    },

    renderAddedModels() {
        const container = document.getElementById('ai-added-models-list');
        if (!container) return;
        if (!this.addedModels || this.addedModels.length === 0) {
            container.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:12px 0">暂无已添加的模型</div>';
            return;
        }
        container.innerHTML = this.addedModels.map(m => `
            <div class="rc-model-item ${m.modelId === this.model ? 'active' : ''}" onclick="AIChat.useModel('${m.modelId}')">
                <div class="rc-model-item-info">
                    <span class="rc-model-item-name">${this._escapeHtml(m.modelName || m.modelId)}</span>
                    <span class="rc-model-item-provider">${this._escapeHtml(m.provider || '')}</span>
                </div>
                <button class="rc-model-item-remove" onclick="event.stopPropagation();AIChat.removeAddedModel('${m.modelId}')">✕</button>
            </div>
        `).join('');
    },

    _addCopyButtonsToCode(container) {
        if (!container) return;
        const blocks = container.querySelectorAll('pre > code, pre');
        blocks.forEach(block => {
            if (block.dataset.btnAdded) return;
            block.dataset.btnAdded = '1';
            const pre = block.tagName === 'PRE' ? block : block.parentElement;
            if (!pre || pre.querySelector('.ai-code-btn-group')) return;

            const lang = (block.className || '').match(/language-(\w+)/)?.[1] || '';
            const btnGroup = document.createElement('div');
            btnGroup.className = 'ai-code-btn-group';

            const copyBtn = document.createElement('button');
            copyBtn.className = 'ai-code-copy-btn';
            copyBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px"><rect x="5" y="5" width="8" height="8" rx="1"/><path d="M3 11V4a1 1 0 0 1 1-1h6"/></svg> 复制';
            copyBtn.onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(block.textContent || '').then(() => {
                    copyBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><polyline points="4 8 7 11 12 5"/></svg> 已复制';
                    setTimeout(() => { copyBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px"><rect x="5" y="5" width="8" height="8" rx="1"/><path d="M3 11V4a1 1 0 0 1 1-1h6"/></svg> 复制'; }, 1500);
                });
            };

            const applyBtn = document.createElement('button');
            applyBtn.className = 'ai-code-apply-btn';
            applyBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px"><path d="M13.5 4.5l-7 7L3 8"/></svg> 应用到文件';
            applyBtn.onclick = (e) => {
                e.stopPropagation();
                const code = block.textContent || '';
                const codeBlockEl = pre.closest('.ai-code-block') || pre;
                this._showApplyFileDialog(code, lang, '', codeBlockEl);
            };

            const editorBtn = document.createElement('button');
            editorBtn.className = 'ai-code-editor-btn';
            editorBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px"><path d="M9.5 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5L9.5 1z"/><polyline points="9.5 1 9.5 5.5 13 5.5"/></svg> 应用到编辑器';
            editorBtn.onclick = (e) => {
                e.stopPropagation();
                const code = block.textContent || '';
                const codeBlockEl = pre.closest('.ai-code-block') || pre;
                this._applyToEditor(code, lang, codeBlockEl);
            };

            const langLabel = document.createElement('span');
            langLabel.className = 'ai-code-lang-label';
            langLabel.textContent = lang || 'code';

            btnGroup.appendChild(langLabel);
            btnGroup.appendChild(copyBtn);
            btnGroup.appendChild(applyBtn);
            btnGroup.appendChild(editorBtn);

            pre.style.position = 'relative';
            pre.insertBefore(btnGroup, pre.firstChild);
        });
    },

    async _applyToEditor(code, lang, codeBlockEl) {
        const detected = this._detectFilePathFromContext(codeBlockEl, lang);
        let filePath = detected;
        if (!filePath) {
            this._showApplyFileDialog(code, lang, '', codeBlockEl);
            return;
        }
        try {
            const result = await window.electronAPI.ai.executeTool('read_file', JSON.stringify({ file_path: filePath }));
            const original = typeof result === 'string' ? result : (result.content || result.output || '');
            this._showEditorDiffPreview(filePath, original, code);
        } catch (e) {
            this._showEditorDiffPreview(filePath, '', code);
        }
    },

    _handleEditorSendToAI(selectedText, filePath, language, startLine, endLine, totalLines) {
        const input = document.getElementById('ai-input');
        if (!input) return;
        const fileInfo = filePath ? `文件: ${filePath}` : '';
        const lineInfo = `行 ${startLine}-${endLine} (共 ${totalLines} 行)`;
        const langInfo = language ? `语言: ${language}` : '';
        const context = [fileInfo, langInfo, lineInfo].filter(Boolean).join(' | ');
        const prompt = `请修改以下代码片段。${context}\n\n\`\`\`${language || ''}\n${selectedText}\n\`\`\`\n\n请提供改进后的代码。`;
        input.value = prompt;
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 200) + 'px';
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        if (typeof toggleEditorPanel === 'function' && _editorPanelOpen) {
        }
        const chatContainer = document.getElementById('ai-messages');
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    },

    _showEditorDiffPreview(filePath, original, modified) {
        const existing = document.querySelector('.ai-apply-dialog');
        if (existing) existing.remove();

        const diffHtml = this._renderDiffCard(filePath, original, modified);
        const fileName = filePath.split(/[\\/]/).pop();

        const dialog = document.createElement('div');
        dialog.className = 'ai-apply-dialog';
        dialog.innerHTML = '<div class="ai-apply-overlay" onclick="this.parentElement.remove()"></div>' +
            '<div class="ai-apply-panel ai-apply-panel-wide">' +
            '<div class="ai-apply-header"><span class="ai-apply-title">应用到编辑器 — ' + this._escapeHtml(fileName) + '</span><button class="ai-apply-close" onclick="this.closest(\'.ai-apply-dialog\').remove()"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg></button></div>' +
            '<div class="ai-apply-body">' +
            '<div class="ai-apply-diff-path"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:13px;height:13px"><path d="M9.5 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5L9.5 1z"/><polyline points="9.5 1 9.5 5.5 13 5.5"/></svg> ' + this._escapeHtml(filePath) + '</div>' +
            diffHtml +
            '</div>' +
            '<div class="ai-apply-footer">' +
            '<button class="ai-apply-cancel" onclick="this.closest(\'.ai-apply-dialog\').remove()">拒绝</button>' +
            '<button class="ai-apply-confirm" onclick="AIChat._confirmApplyToEditor()">接受并应用</button>' +
            '</div>' +
            '</div>';

        dialog._filePath = filePath;
        dialog._modified = modified;
        document.body.appendChild(dialog);

        const handleKey = (e) => {
            if (e.key === 'Escape') { dialog.remove(); document.removeEventListener('keydown', handleKey); }
            if (e.key === 'Enter') { e.preventDefault(); this._confirmApplyToEditor(); document.removeEventListener('keydown', handleKey); }
        };
        document.addEventListener('keydown', handleKey);
    },

    _confirmApplyToEditor() {
        const dialog = document.querySelector('.ai-apply-dialog');
        if (!dialog) return;
        const filePath = dialog._filePath;
        const modified = dialog._modified;
        if (!filePath || modified == null) return;

        const iframe = document.getElementById('editor-iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'editor:show-diff', filePath, original: '', modified }, '*');
        }
        if (typeof toggleEditorPanel === 'function' && !_editorPanelOpen) {
            toggleEditorPanel();
        }

        dialog.remove();
        this.appendMessage('assistant', '已将代码差异发送到编辑器，请在编辑器中审查并确认应用 `' + filePath + '`');
    },

    _detectFilePathFromContext(codeBlockEl, lang) {
        const langExtMap = {
            javascript: '.js', typescript: '.ts', python: '.py', html: '.html',
            css: '.css', scss: '.scss', less: '.less', json: '.json', yaml: '.yaml',
            xml: '.xml', markdown: '.md', bash: '.bash', sql: '.sql', go: '.go',
            rust: '.rs', java: '.java', c: '.c', cpp: '.cpp', csharp: '.cs',
            php: '.php', ruby: '.rb', swift: '.swift', kotlin: '.kt',
            powershell: '.ps1', batch: '.bat', ini: '.ini', dockerfile: 'Dockerfile',
            makefile: 'Makefile', vue: '.vue', svelte: '.svelte', jsx: '.jsx', tsx: '.tsx',
        };
        const ext = langExtMap[(lang || '').toLowerCase()] || '';

        let contextText = '';
        if (codeBlockEl) {
            let prev = codeBlockEl.previousElementSibling;
            let pieces = [];
            for (let i = 0; i < 5 && prev; i++) {
                pieces.unshift(prev.textContent || '');
                prev = prev.previousElementSibling;
            }
            contextText = pieces.join(' ');
        }

        const filePathPatterns = [
            /(?:修改|编辑|更新|改写|重写|替换|在|打开|写入|保存到|应用到)\s*[`"']?([^\s`"']+?\.[a-zA-Z]{1,10})[`"']?/,
            /(?:modify|edit|update|change|rewrite|replace|in|at|open|write|save to|apply to)\s+[`"']?([^\s`"']+?\.[a-zA-Z]{1,10})[`"']?/i,
            /[`"']((?:[\w.-]+[\/\\])+[\w.-]+\.[a-zA-Z]{1,10})[`"']/,
            /\[([^\]]+?\.[a-zA-Z]{1,10})\]\(/,
            /(?:文件|file)\s*(?:路径|path)?\s*[:：]\s*[`"']?([^\s`"']+?\.[a-zA-Z]{1,10})[`"']?/i,
            /(?:src|lib|app|pages|components|utils|config|public|assets|styles|css|js|ts|test|tests|spec)[\/\\][^\s`"']+\.[a-zA-Z]{1,10}/,
        ];

        for (const pattern of filePathPatterns) {
            const match = contextText.match(pattern);
            if (match) {
                const candidate = (match[1] || match[0]).replace(/^[`"']+|[`"']+$/g, '');
                if (candidate.includes('/') || candidate.includes('\\') || candidate.includes('.')) {
                    return candidate;
                }
            }
        }

        if (this._recentFiles && this._recentFiles.size > 0) {
            const candidates = Array.from(this._recentFiles).filter(f => {
                if (!ext) return true;
                const fileExt = '.' + (f.split('.').pop() || '').toLowerCase();
                return fileExt === ext;
            });
            if (candidates.length === 1) return candidates[0];
            if (candidates.length > 1) {
                const contextLower = contextText.toLowerCase();
                const scored = candidates.map(f => {
                    const name = f.split(/[\/\\]/).pop().toLowerCase();
                    const idx = contextLower.indexOf(name);
                    return { path: f, score: idx >= 0 ? 100 - idx : 0 };
                }).sort((a, b) => b.score - a.score);
                if (scored[0].score > 0) return scored[0].path;
            }
        }

        return '';
    },

    _showApplyFileDialog(code, lang, autoDetectedPath, codeBlockEl) {
        const existing = document.querySelector('.ai-apply-dialog');
        if (existing) existing.remove();

        const detected = autoDetectedPath || this._detectFilePathFromContext(codeBlockEl, lang);
        const escapedDetected = this._escapeHtml(detected);
        const detectedHint = detected
            ? '<div class="ai-apply-detected-hint"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1"/></svg> 已自动检测到文件路径</div>'
            : '';

        const dialog = document.createElement('div');
        dialog.className = 'ai-apply-dialog';
        dialog.innerHTML = '<div class="ai-apply-overlay" onclick="this.parentElement.remove()"></div>' +
            '<div class="ai-apply-panel">' +
            '<div class="ai-apply-header"><span class="ai-apply-title">应用代码到文件</span><button class="ai-apply-close" onclick="this.closest(\'.ai-apply-dialog\').remove()"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg></button></div>' +
            '<div class="ai-apply-body">' +
            '<label class="ai-apply-label">文件路径</label>' +
            detectedHint +
            '<input class="ai-apply-input" id="ai-apply-path" placeholder="例如: src/components/App.js" value="' + escapedDetected + '" />' +
            '<div class="ai-apply-path-suggest" id="ai-apply-path-suggest"></div>' +
            '<label class="ai-apply-label">操作方式</label>' +
            '<div class="ai-apply-mode-group">' +
            '<label class="ai-apply-mode active"><input type="radio" name="apply-mode" value="overwrite" checked> 覆盖写入</label>' +
            '<label class="ai-apply-mode"><input type="radio" name="apply-mode" value="append"> 追加到末尾</label>' +
            '</div>' +
            '<div id="ai-apply-diff-section"></div>' +
            '<label class="ai-apply-label">代码预览</label>' +
            '<pre class="ai-apply-preview"><code>' + this._escapeHtml(code.slice(0, 3000)) + (code.length > 3000 ? '\n...(已截断)' : '') + '</code></pre>' +
            '</div>' +
            '<div class="ai-apply-footer">' +
            '<button class="ai-apply-cancel" onclick="this.closest(\'.ai-apply-dialog\').remove()">取消</button>' +
            '<button class="ai-apply-confirm" onclick="AIChat._executeApplyCode()">确认应用</button>' +
            '</div>' +
            '</div>';

        dialog._codeToApply = code;
        dialog._lang = lang;
        dialog._codeBlockEl = codeBlockEl;
        document.body.appendChild(dialog);

        const handleKey = (e) => {
            if (e.key === 'Escape') { dialog.remove(); document.removeEventListener('keydown', handleKey); }
        };
        document.addEventListener('keydown', handleKey);

        if (detected) {
            this._loadDiffPreview(detected, code);
        }
        this._setupPathAutoComplete();
    },

    async _loadDiffPreview(filePath, newCode) {
        const section = document.getElementById('ai-apply-diff-section');
        if (!section) return;
        section.innerHTML = '<div class="ai-apply-diff-loading"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;animation:spin 1s linear infinite"><circle cx="8" cy="8" r="6" stroke-dasharray="28" stroke-dashoffset="8"/></svg> 正在加载文件内容...</div>';
        try {
            const result = await window.electronAPI.ai.executeTool('read_file', JSON.stringify({ file_path: filePath }));
            const original = typeof result === 'string' ? result : (result.content || result.output || '');
            if (original) {
                const diffHtml = this._renderDiffCard(filePath, original, newCode);
                section.innerHTML = '<label class="ai-apply-label">Diff 预览</label>' + diffHtml;
            } else {
                section.innerHTML = '<div class="ai-apply-diff-new">新文件: ' + this._escapeHtml(filePath.split(/[\\/]/).pop()) + '</div>';
            }
        } catch (e) {
            section.innerHTML = '<div class="ai-apply-diff-new">新文件（文件不存在）: ' + this._escapeHtml(filePath.split(/[\\/]/).pop()) + '</div>';
        }
    },

    _setupPathAutoComplete() {
        const input = document.getElementById('ai-apply-path');
        const suggestEl = document.getElementById('ai-apply-path-suggest');
        if (!input) return;

        let diffTimer = null;
        const triggerDiff = () => {
            clearTimeout(diffTimer);
            const val = (input.value || '').trim();
            if (!val || val.length < 3) return;
            diffTimer = setTimeout(() => {
                const dialog = document.querySelector('.ai-apply-dialog');
                if (dialog && dialog._codeToApply) {
                    this._loadDiffPreview(val, dialog._codeToApply);
                }
            }, 600);
        };

        if (suggestEl && this._recentFiles && this._recentFiles.size > 0) {
            const showSuggestions = () => {
                const val = (input.value || '').toLowerCase();
                if (!val) { suggestEl.innerHTML = ''; suggestEl.style.display = 'none'; return; }
                const matches = Array.from(this._recentFiles).filter(f =>
                    f.toLowerCase().includes(val)
                ).slice(0, 6);
                if (matches.length === 0) { suggestEl.innerHTML = ''; suggestEl.style.display = 'none'; return; }
                suggestEl.innerHTML = matches.map(f =>
                    '<div class="ai-apply-suggest-item" data-path="' + this._escapeHtml(f) + '">' +
                    '<span class="ai-apply-suggest-icon">' + this._getFileIcon(f) + '</span>' +
                    '<span class="ai-apply-suggest-name">' + this._escapeHtml(f.split(/[\\/]/).pop()) + '</span>' +
                    '<span class="ai-apply-suggest-dir">' + this._escapeHtml(f.replace(/[/\\][^/\\]*$/, '')) + '</span>' +
                    '</div>'
                ).join('');
                suggestEl.style.display = 'block';
                suggestEl.querySelectorAll('.ai-apply-suggest-item').forEach(item => {
                    item.onclick = () => {
                        input.value = item.dataset.path;
                        suggestEl.style.display = 'none';
                        this._loadDiffPreview(item.dataset.path, document.querySelector('.ai-apply-dialog')._codeToApply || '');
                    };
                });
            };

            input.addEventListener('input', showSuggestions);
            input.addEventListener('focus', showSuggestions);
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.ai-apply-input') && !e.target.closest('.ai-apply-path-suggest')) {
                    suggestEl.style.display = 'none';
                }
            });
        }

        input.addEventListener('input', triggerDiff);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._executeApplyCode();
            }
        });
    },

    async _executeApplyCode() {
        const dialog = document.querySelector('.ai-apply-dialog');
        if (!dialog) return;
        const filePath = document.getElementById('ai-apply-path')?.value?.trim();
        if (!filePath) { alert('请输入文件路径'); return; }
        const mode = document.querySelector('input[name="apply-mode"]:checked')?.value || 'overwrite';
        const code = dialog._codeToApply || '';
        try {
            if (mode === 'overwrite') {
                await window.electronAPI.ai.executeTool('write_file', JSON.stringify({ file_path: filePath, content: code }));
            } else {
                const readResult = await window.electronAPI.ai.executeTool('read_file', JSON.stringify({ file_path: filePath }));
                const existing = typeof readResult === 'string' ? readResult : (readResult.content || readResult.output || '');
                await window.electronAPI.ai.executeTool('write_file', JSON.stringify({ file_path: filePath, content: existing + code }));
            }
            dialog.remove();
            this.appendMessage('assistant', '已将代码' + (mode === 'overwrite' ? '写入' : '追加到') + ' `' + filePath + '`');
        } catch (e) {
            alert('应用失败: ' + e.message);
        }
    },

    _runCommandInTerminal(cmd) {
        if (!cmd) return;
        if (!this._xtermInstance) {
            this.toggleTerminal();
        }
        setTimeout(() => {
            const ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;
            if (ipcRenderer && this._terminalSessionId) {
                ipcRenderer.invoke('terminal:write', this._terminalSessionId, cmd + '\n');
            }
            if (typeof showToast === 'function') showToast('命令已发送到终端');
        }, this._xtermInstance ? 0 : 300);
    },

    _renderCommandHistory() {
        const recent = this._commandHistory.slice(0, 10);
        if (recent.length === 0) return '';
        let html = '<div class="ai-terminal-cmd-list">';
        for (const entry of recent) {
            const dotCls = entry.exitCode === 0 ? 'success' : 'error';
            const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            const truncated = entry.cmd.length > 40 ? entry.cmd.slice(0, 40) + '…' : entry.cmd;
            html += `<div class="ai-terminal-cmd-item" onclick="AIChat._runCommandInTerminal('${this._escapeHtml(entry.cmd).replace(/'/g, "\\'")}')" title="${this._escapeHtml(entry.cmd)}">
                <span class="ai-terminal-cmd-prompt">$</span>
                <span class="ai-terminal-cmd-text">${this._escapeHtml(truncated)}</span>
                <span class="ai-terminal-cmd-dot ${dotCls}"></span>
                <span style="font-size:10px;color:var(--ai-text-muted,#555);flex-shrink:0">${time}</span>
            </div>`;
        }
        html += '</div>';
        return html;
    },

    _analyzeToolError(toolName, args, result) {
        const errorPatterns = [
            { match: /'(\w+)' is not recognized as/, type: 'command_not_found', suggestion: '命令未安装', fix: (m) => `npm install -g ${m[1]}` },
            { match: /Cannot find module ['"](.+?)['"]/, type: 'module_not_found', suggestion: '模块未安装', fix: (m) => `npm install ${m[1]}` },
            { match: /ENOENT.*?['"](.+?)['"]/, type: 'file_not_found', suggestion: '文件不存在', fix: null },
            { match: /EACCES/, type: 'permission_denied', suggestion: '权限不足', fix: null },
            { match: /EADDRINUSE.*?:(\d+)/, type: 'port_in_use', suggestion: '端口被占用', fix: (m) => `netstat -ano | findstr :${m[1]}` },
            { match: /SyntaxError.*?line (\d+)/i, type: 'syntax_error', suggestion: '语法错误', fix: null },
            { match: /ModuleNotFoundError.*?['"](.+?)['"]/, type: 'module_not_found', suggestion: 'Python模块未安装', fix: (m) => `pip install ${m[1]}` },
            { match: /JAVA_HOME.*?not set/i, type: 'java_home', suggestion: 'JAVA_HOME未设置', fix: null },
            { match: /Out of memory|OOM|heap space/i, type: 'oom', suggestion: '内存不足', fix: null },
            { match: /command not found/i, type: 'command_not_found', suggestion: '命令未找到', fix: null },
            { match: /No such file or directory/i, type: 'file_not_found', suggestion: '文件或目录不存在', fix: null },
            { match: /Permission denied/i, type: 'permission_denied', suggestion: '权限不足', fix: null },
            { match: /Connection refused/i, type: 'connection_refused', suggestion: '连接被拒绝', fix: null },
            { match: /str_replace_based_edit_tool.*?(?:search|old_str).*?(?:not found|不存在|找不到)/i, type: 'edit_search_not_found', suggestion: '搜索内容未匹配', fix: null },
            { match: /already (?:exists|存在)/i, type: 'already_exists', suggestion: '目标已存在', fix: null },
        ];

        let errorText = '';
        if (typeof result === 'string') {
            try {
                const parsed = JSON.parse(result);
                errorText = parsed.error || parsed.stderr || parsed.output || result;
            } catch (e) {
                errorText = result;
            }
        } else if (result && typeof result === 'object') {
            errorText = result.error || result.stderr || result.output || JSON.stringify(result);
        }
        if (!errorText) return null;

        for (const pattern of errorPatterns) {
            const m = errorText.match(pattern.match);
            if (m) {
                return {
                    type: pattern.type,
                    message: errorText.slice(0, 300),
                    suggestion: pattern.suggestion,
                    autoFixCmd: pattern.fix ? pattern.fix(m) : null
                };
            }
        }
        return null;
    },

    _showFixSuggestion(container, analysis) {
        if (!container || !analysis) return;
        const existing = container.querySelector('.ai-fix-suggestion');
        if (existing) return;
        const cardHtml = this._renderFixSuggestionCard(analysis);
        const wrapper = document.createElement('div');
        wrapper.innerHTML = cardHtml;
        container.appendChild(wrapper.firstElementChild);
    },

    _renderFixSuggestionCard(analysis) {
        const warningSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        const escapedMsg = this._escapeHtml(analysis.message || '');
        const fixCmdHtml = analysis.autoFixCmd
            ? `<div class="ai-fix-suggestion-code">${this._escapeHtml(analysis.autoFixCmd)}</div><button class="ai-fix-btn" onclick="AIChat._applyAutoFix('${this._escapeHtml(analysis.autoFixCmd).replace(/'/g, "\\'")}')">一键修复</button>`
            : '';
        return `<div class="ai-fix-suggestion">
            <div class="ai-fix-suggestion-header">${warningSvg}<span>${this._escapeHtml(analysis.suggestion)}</span></div>
            <div class="ai-fix-suggestion-body">${escapedMsg}</div>
            ${fixCmdHtml}
        </div>`;
    },

    _applyAutoFix(cmd) {
        if (!cmd) return;
        if (typeof showToast === 'function') showToast('正在执行修复命令...');
        this.sendMessage(cmd);
    },

    _initAtMention() {
        const input = document.getElementById('ai-input');
        if (!input) return;
        input.addEventListener('input', (e) => {
            const val = input.value;
            const cursorPos = input.selectionStart;
            const textBeforeCursor = val.slice(0, cursorPos);
            const atIndex = textBeforeCursor.lastIndexOf('@');
            if (atIndex >= 0) {
                const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
                if (atIndex === 0 || charBefore === ' ' || charBefore === '\n') {
                    const query = textBeforeCursor.slice(atIndex + 1);
                    if (!query.includes(' ') || query.length < 20) {
                        this._atMentionActive = true;
                        this._atMentionQuery = query;
                        this._atMentionStart = atIndex;
                        this._showAtMentionPopup(query);
                        return;
                    }
                }
            }
            if (this._atMentionActive) {
                this._hideAtMentionPopup();
            }
        });
        document.addEventListener('click', (e) => {
            if (this._atMentionActive && !e.target.closest('.ai-at-mention-popup') && !e.target.closest('#ai-input')) {
                this._hideAtMentionPopup();
            }
        });
    },

    _showAtMentionPopup(query) {
        const container = document.querySelector('.rc-input-container');
        if (!container) return;
        container.style.position = 'relative';
        let popup = container.querySelector('.ai-at-mention-popup');
        if (!popup) {
            popup = document.createElement('div');
            popup.className = 'ai-at-mention-popup';
            container.appendChild(popup);
        }
        const files = Array.from(this._recentFiles);
        const filtered = files.filter(f => {
            const name = this._getFileName(f);
            const q = (query || '').toLowerCase();
            return !q || name.toLowerCase().includes(q) || f.toLowerCase().includes(q);
        }).slice(0, 20);

        this._atMentionHighlightIdx = 0;

        let html = '<div class="ai-at-mention-search"><input type="text" placeholder="搜索文件..." value="' + this._escapeHtml(query || '') + '" /></div>';
        if (filtered.length === 0) {
            html += '<div class="ai-at-mention-empty">无匹配文件（文件将在工具调用后出现）</div>';
        } else {
            html += '<div class="ai-at-mention-list">';
            for (let i = 0; i < filtered.length; i++) {
                const f = filtered[i];
                const name = this._getFileName(f);
                const icon = this._getFileIcon(f);
                const dir = f.replace(/[\/\\][^\/\\]+$/, '').slice(-40);
                html += '<div class="ai-at-mention-item' + (i === 0 ? ' active' : '') + '" data-path="' + this._escapeHtml(f) + '">';
                html += '<span>' + icon + '</span>';
                html += '<span class="ai-at-mention-name">' + this._escapeHtml(name) + '</span>';
                html += '<span class="ai-at-mention-path">' + this._escapeHtml(dir) + '</span>';
                html += '</div>';
            }
            html += '</div>';
        }
        popup.innerHTML = html;

        const searchInput = popup.querySelector('input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this._atMentionQuery = searchInput.value;
                this._showAtMentionPopup(searchInput.value);
            });
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.stopPropagation();
                    this._hideAtMentionPopup();
                }
            });
            setTimeout(() => searchInput.focus(), 0);
        }

        popup.querySelectorAll('.ai-at-mention-item').forEach(item => {
            item.addEventListener('click', () => {
                const path = item.dataset.path;
                if (path) this._insertFileReference(path);
            });
        });
    },

    _hideAtMentionPopup() {
        this._atMentionActive = false;
        this._atMentionQuery = '';
        this._atMentionStart = -1;
        const container = document.querySelector('.rc-input-container');
        if (container) {
            const popup = container.querySelector('.ai-at-mention-popup');
            if (popup) popup.remove();
        }
    },

    _insertFileReference(filePath) {
        const name = this._getFileName(filePath);
        if (this._referencedFiles.some(f => f.path === filePath)) {
            this._hideAtMentionPopup();
            return;
        }
        this._referencedFiles.push({ path: filePath, name: name });
        this._renderReferencedFilesBar();
        const input = document.getElementById('ai-input');
        if (input && this._atMentionStart >= 0) {
            const before = input.value.slice(0, this._atMentionStart);
            const after = input.value.slice(input.selectionStart);
            input.value = before + after;
            input.selectionStart = input.selectionEnd = before.length;
        }
        this._hideAtMentionPopup();
        if (input) input.focus();
    },

    _renderReferencedFilesBar() {
        const container = document.querySelector('.rc-input-container');
        if (!container) return;
        let bar = container.querySelector('.ai-referenced-files-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.className = 'ai-referenced-files-bar';
            const input = container.querySelector('#ai-input, .rc-textarea');
            if (input) {
                container.insertBefore(bar, input);
            } else {
                container.prepend(bar);
            }
        }
        if (this._referencedFiles.length === 0) {
            bar.style.display = 'none';
            bar.innerHTML = '';
            return;
        }
        bar.style.display = 'flex';
        const fileIconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
        bar.innerHTML = this._referencedFiles.map(ref =>
            '<span class="ai-ref-chip">' + fileIconSvg + '<span class="ai-ref-chip-text">' + this._escapeHtml(ref.name) + '</span><span class="ai-ref-chip-remove" onclick="AIChat.removeFileReference(\'' + this._escapeHtml(ref.path).replace(/'/g, "\\'") + '\')">×</span></span>'
        ).join('');
    },

    removeFileReference(filePath) {
        this._referencedFiles = this._referencedFiles.filter(f => f.path !== filePath);
        this._renderReferencedFilesBar();
    },

    _renderMcpSettings() {
        const servers = this._mcpServers || [];
        const activeTab = this._mcpTab || 'local';
        
        let html = '<div class="mcp-page">';
        
        html += '<div class="mcp-page-title">MCP</div>';
        
        html += '<div class="mcp-tabs">';
        html += '<div class="mcp-tab' + (activeTab === 'local' ? ' active' : '') + '" onclick="AIChat._switchMcpTab(\'local\')">';
        html += '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px"><rect x="2" y="2" width="12" height="10" rx="1"/><path d="M5 14h6M8 12v2"/></svg>';
        html += ' 本地 <span class="mcp-tab-info" title="本地 MCP 服务器运行在您的设备上">ⓘ</span>';
        html += '</div>';
        html += '<div class="mcp-tab' + (activeTab === 'cloud' ? ' active' : '') + '" onclick="AIChat._switchMcpTab(\'cloud\')">';
        html += '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px"><path d="M4 11a3 3 0 0 1-.5-5.95A5 5 0 0 1 13.5 5 3.5 3.5 0 0 1 11 12H4z"/></svg>';
        html += ' 云端';
        html += '</div>';
        html += '</div>';
        
        if (activeTab === 'local') {
            html += '<div class="mcp-manage-card">';
            html += '<div class="mcp-manage-header">';
            html += '<div class="mcp-manage-title">MCP Servers 管理</div>';
            html += '<div class="mcp-manage-desc">管理您已添加的 MCP 服务器，可启用、配置或添加新的工具能力。</div>';
            html += '<button class="mcp-add-btn" onclick="AIChat._showMcpAddDropdown(event)">+ 添加 <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px"><polyline points="3 5 6 8 9 5"/></svg></button>';
            html += '</div>';
            
            html += '<div id="mcp-add-dropdown"></div>';
            html += '<div id="ai-mcp-add-form-container"></div>';
            
            if (servers.length > 0) {
                html += '<div class="mcp-server-list">';
                for (let i = 0; i < servers.length; i++) {
                    const s = servers[i];
                    const statusCls = s.enabled ? 'connected' : 'disconnected';
                    const statusText = s.enabled ? '运行中' : '已停止';
                    const typeLabel = s.type === 'sse' ? 'SSE' : 'stdio';
                    html += '<div class="mcp-server-card">';
                    html += '<div class="mcp-server-card-header">';
                    html += '<div class="mcp-server-card-icon">';
                    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:20px;height:20px"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>';
                    html += '</div>';
                    html += '<div class="mcp-server-card-info">';
                    html += '<div class="mcp-server-card-name">' + this._escapeHtml(s.name || '未命名') + '</div>';
                    html += '<div class="mcp-server-card-meta">' + typeLabel + ' · ' + this._escapeHtml(s.url || s.command || '') + '</div>';
                    html += '</div>';
                    html += '<div class="mcp-server-card-status ' + statusCls + '">' + statusText + '</div>';
                    html += '</div>';
                    html += '<div class="mcp-server-card-actions">';
                    html += '<label class="mcp-toggle"><input type="checkbox" ' + (s.enabled ? 'checked' : '') + ' onchange="AIChat._toggleMcpServer(' + i + ')"><span class="mcp-toggle-slider"></span></label>';
                    html += '<button class="mcp-server-action-btn" onclick="AIChat._editMcpServer(' + i + ')" title="配置"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px"><path d="M11.5 1.5l3 3-9 9H2v-3z"/></svg></button>';
                    html += '<button class="mcp-server-action-btn danger" onclick="AIChat._removeMcpServer(' + i + ')" title="删除"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px"><path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M13 4v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4"/></svg></button>';
                    html += '</div>';
                    html += '</div>';
                }
                html += '</div>';
            } else {
                html += '<div class="mcp-empty-state">';
                html += '<div class="mcp-empty-illustration">';
                html += '<svg viewBox="0 0 300 200" fill="none" style="width:240px;height:160px">';
                html += '<rect x="120" y="20" width="60" height="40" rx="8" stroke="var(--ai-text-muted,#999)" stroke-width="1.5" fill="var(--ai-bg-secondary,#f5f5f5)"/>';
                html += '<text x="150" y="45" text-anchor="middle" font-size="10" fill="var(--ai-text-secondary,#666)" font-weight="500">MCP Servers</text>';
                html += '<path d="M150 60 C150 90 80 100 60 130" stroke="#4caf50" stroke-width="1" stroke-dasharray="4 2" opacity="0.5"/>';
                html += '<path d="M150 60 C150 90 120 100 110 130" stroke="#2196f3" stroke-width="1" stroke-dasharray="4 2" opacity="0.5"/>';
                html += '<path d="M150 60 C150 90 180 100 190 130" stroke="#ff9800" stroke-width="1" stroke-dasharray="4 2" opacity="0.5"/>';
                html += '<path d="M150 60 C150 90 220 100 240 130" stroke="#9c27b0" stroke-width="1" stroke-dasharray="4 2" opacity="0.5"/>';
                html += '<circle cx="60" cy="140" r="18" fill="#f0f0f0" stroke="#4caf50" stroke-width="1.5"/>';
                html += '<text x="60" y="144" text-anchor="middle" font-size="14">🔍</text>';
                html += '<circle cx="110" cy="140" r="18" fill="#f0f0f0" stroke="#2196f3" stroke-width="1.5"/>';
                html += '<text x="110" y="144" text-anchor="middle" font-size="14">🐙</text>';
                html += '<circle cx="190" cy="140" r="18" fill="#f0f0f0" stroke="#ff9800" stroke-width="1.5"/>';
                html += '<text x="190" y="144" text-anchor="middle" font-size="14">📁</text>';
                html += '<circle cx="240" cy="140" r="18" fill="#f0f0f0" stroke="#9c27b0" stroke-width="1.5"/>';
                html += '<text x="240" y="144" text-anchor="middle" font-size="14">🔗</text>';
                html += '</svg>';
                html += '</div>';
                
                html += '<div class="mcp-what-section">';
                html += '<div class="mcp-what-title">什么是 MCP Servers?</div>';
                html += '<div class="mcp-what-desc">Model Context Protocol (MCP) 允许大语言模型访问自定义工具和服务。MCP Servers 是支持该协议的服务，提供工具和功能来扩展智能体的能力。添加后，智能体会自动调用合适的工具完成任务。</div>';
                html += '</div>';
                html += '</div>';
            }
            
            html += '</div>';
        } else {
            html += '<div class="mcp-cloud-empty">';
            html += '<svg viewBox="0 0 24 24" fill="none" stroke="var(--ai-text-muted,#999)" stroke-width="1.5" style="width:48px;height:48px;margin-bottom:12px;opacity:0.4"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>';
            html += '<div class="mcp-cloud-title">云端 MCP 服务</div>';
            html += '<div class="mcp-cloud-desc">云端 MCP 服务即将推出，敬请期待</div>';
            html += '</div>';
        }
        
        html += '</div>';
        
        return html;
    },

    _addMcpServer(defaultType) {
        this._editingMcpIndex = null;
        const container = document.getElementById('ai-mcp-add-form-container');
        if (!container) return;
        if (container.querySelector('.ai-mcp-add-form')) return;
        const type = defaultType || 'sse';
        let html = '<div class="ai-mcp-add-form">';
        html += '<label>名称</label><input id="ai-mcp-name" placeholder="例如: filesystem" />';
        html += '<label>类型</label><select id="ai-mcp-type"><option value="sse"' + (type === 'sse' ? ' selected' : '') + '>SSE (URL)</option><option value="stdio"' + (type === 'stdio' ? ' selected' : '') + '>stdio (命令)</option></select>';
        html += '<div id="ai-mcp-url-field" style="' + (type === 'stdio' ? 'display:none' : '') + '"><label>URL</label><input id="ai-mcp-url" placeholder="http://localhost:3000/sse" /></div>';
        html += '<div id="ai-mcp-cmd-field" style="' + (type === 'sse' ? 'display:none' : '') + '"><label>命令</label><input id="ai-mcp-cmd" placeholder="npx -y @modelcontextprotocol/server-filesystem" /></div>';
        html += '<div id="ai-mcp-args-field" style="' + (type === 'sse' ? 'display:none' : '') + '"><label>参数</label><input id="ai-mcp-args" placeholder="空格分隔的参数" /></div>';
        html += '<label>环境变量</label><input id="ai-mcp-env" placeholder="KEY=value KEY2=value2 (可选)" />';
        html += '<div style="display:flex;gap:8px;margin-top:8px">';
        html += '<button class="rc-settings-btn" onclick="AIChat._confirmAddMcpServer()">添加</button>';
        html += '<button class="rc-settings-btn" style="background:transparent;color:var(--ai-text-muted)" onclick="document.getElementById(\'ai-mcp-add-form-container\').innerHTML=\'\'">取消</button>';
        html += '</div></div>';
        container.innerHTML = html;
        const typeSelect = container.querySelector('#ai-mcp-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                const isSse = typeSelect.value === 'sse';
                const urlField = container.querySelector('#ai-mcp-url-field');
                const cmdField = container.querySelector('#ai-mcp-cmd-field');
                const argsField = container.querySelector('#ai-mcp-args-field');
                if (urlField) urlField.style.display = isSse ? '' : 'none';
                if (cmdField) cmdField.style.display = isSse ? 'none' : '';
                if (argsField) argsField.style.display = isSse ? 'none' : '';
            });
        }
    },

    async _confirmAddMcpServer() {
        const name = document.getElementById('ai-mcp-name')?.value?.trim();
        const type = document.getElementById('ai-mcp-type')?.value || 'sse';
        const url = document.getElementById('ai-mcp-url')?.value?.trim();
        const command = document.getElementById('ai-mcp-cmd')?.value?.trim();
        const args = document.getElementById('ai-mcp-args')?.value?.trim();
        const envStr = document.getElementById('ai-mcp-env')?.value?.trim();
        if (!name) { if (typeof showToast === 'function') showToast('请输入服务器名称', 'error'); return; }
        if (type === 'sse' && !url) { if (typeof showToast === 'function') showToast('请输入 URL', 'error'); return; }
        if (type === 'stdio' && !command) { if (typeof showToast === 'function') showToast('请输入命令', 'error'); return; }
        const server = { name, type, enabled: true, url: type === 'sse' ? url : '', command: type === 'stdio' ? command : '', args: args || '', env: envStr || '' };
        if (this._editingMcpIndex != null && this._mcpServers[this._editingMcpIndex]) {
            server.enabled = this._mcpServers[this._editingMcpIndex].enabled;
            this._mcpServers[this._editingMcpIndex] = server;
            this._editingMcpIndex = null;
        } else {
            this._mcpServers.push(server);
        }
        await this._saveMcpServers();
        const container = document.getElementById('ai-mcp-add-form-container');
        if (container) container.innerHTML = '';
        const tabContent = document.getElementById('rc-settings-tab-content');
        if (tabContent) tabContent.innerHTML = this._renderSettingsTabContent('mcp');
        if (typeof showToast === 'function') showToast('MCP 服务器已保存', 'success');
    },

    async _removeMcpServer(index) {
        this._mcpServers.splice(index, 1);
        await this._saveMcpServers();
        const tabContent = document.getElementById('rc-settings-tab-content');
        if (tabContent) tabContent.innerHTML = this._renderSettingsTabContent('mcp');
    },

    async _toggleMcpServer(index) {
        if (this._mcpServers[index]) {
            this._mcpServers[index].enabled = !this._mcpServers[index].enabled;
            await this._saveMcpServers();
            const tabContent = document.getElementById('rc-settings-tab-content');
            if (tabContent) tabContent.innerHTML = this._renderSettingsTabContent('mcp');
        }
    },

    async _saveMcpServers() {
        try {
            await window.electronAPI.store.set('versepc_mcp_servers', JSON.stringify(this._mcpServers));
        } catch (e) {
            console.error('[AIChat] Failed to save MCP servers:', e);
        }
    },

    _switchMcpTab(tab) {
        this._mcpTab = tab;
        const tabContent = document.getElementById('rc-settings-tab-content');
        if (tabContent) tabContent.innerHTML = this._renderSettingsTabContent('mcp');
    },

    _showMcpAddDropdown(event) {
        event.stopPropagation();
        const dropdown = document.getElementById('mcp-add-dropdown');
        if (!dropdown) return;
        
        if (dropdown.querySelector('.mcp-add-dropdown-menu')) {
            dropdown.innerHTML = '';
            return;
        }
        
        dropdown.innerHTML = `<div class="mcp-add-dropdown-menu">
            <div class="mcp-add-dropdown-item" onclick="AIChat._addMcpServer()">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px"><rect x="2" y="2" width="12" height="10" rx="1"/><path d="M5 14h6M8 12v2"/></svg>
                <div><div class="mcp-dropdown-item-title">添加本地服务器</div><div class="mcp-dropdown-item-desc">配置一个本地运行的 MCP 服务器</div></div>
            </div>
            <div class="mcp-add-dropdown-item" onclick="AIChat._addMcpServer('sse')">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px"><path d="M4 11a3 3 0 0 1-.5-5.95A5 5 0 0 1 13.5 5 3.5 3.5 0 0 1 11 12H4z"/></svg>
                <div><div class="mcp-dropdown-item-title">添加远程服务器</div><div class="mcp-dropdown-item-desc">通过 URL 连接远程 MCP 服务</div></div>
            </div>
        </div>`;
        
        const close = (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.innerHTML = '';
                document.removeEventListener('click', close);
            }
        };
        setTimeout(() => document.addEventListener('click', close), 10);
    },

    _editMcpServer(index) {
        this._addMcpServer();
        const server = this._mcpServers[index];
        if (!server) return;
        setTimeout(() => {
            const nameEl = document.getElementById('ai-mcp-name');
            const typeEl = document.getElementById('ai-mcp-type');
            const urlEl = document.getElementById('ai-mcp-url');
            const cmdEl = document.getElementById('ai-mcp-cmd');
            const argsEl = document.getElementById('ai-mcp-args');
            const envEl = document.getElementById('ai-mcp-env');
            if (nameEl) nameEl.value = server.name || '';
            if (typeEl) typeEl.value = server.type || 'sse';
            if (urlEl) urlEl.value = server.url || '';
            if (cmdEl) cmdEl.value = server.command || '';
            if (argsEl) argsEl.value = server.args || '';
            if (envEl) envEl.value = server.env || '';
            if (typeEl) typeEl.dispatchEvent(new Event('change'));
            this._editingMcpIndex = index;
        }, 50);
    },

    _initGitSection() {
        if (this._gitSectionEl && this._gitSectionEl.isConnected) return;
        const panel = document.getElementById('ai-side-panel');
        if (!panel) return;
        const body = panel.querySelector('.ai-side-body') || panel;
        if (!body) return;
        const section = document.createElement('div');
        section.className = 'ai-side-section ai-side-git-section';
        section.innerHTML = '<div class="ai-side-section-header"><span class="ai-side-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg> Git 状态</span></div><div class="ai-side-git-content"><div class="ai-git-empty">暂无 Git 操作</div></div>';
        const resourceSection = body.querySelector('.ai-side-resources');
        if (resourceSection) {
            body.insertBefore(section, resourceSection);
        } else {
            body.appendChild(section);
        }
        this._gitSectionEl = section;
    },

    _updateGitSection() {
        if (!this._gitSectionEl) return;
        const content = this._gitSectionEl.querySelector('.ai-side-git-content');
        if (!content) return;
        const ops = this._gitOperations || [];
        if (ops.length === 0) {
            content.innerHTML = '<div class="ai-git-empty">暂无 Git 操作</div>';
            return;
        }
        const branchOps = ops.filter(o => o.subcommand === 'branch' || o.subcommand === 'checkout');
        const commitOps = ops.filter(o => o.subcommand === 'commit');
        const statusOps = ops.filter(o => o.subcommand === 'status');
        let branchName = '';
        for (const op of branchOps) {
            const m = op.command.match(/(?:checkout|switch)\s+(?:-b\s+)?(\S+)/);
            if (m) branchName = m[1];
            const bm = op.command.match(/branch\s+(?:-d\s+)?(\S+)/);
            if (bm && op.subcommand === 'branch' && !op.command.includes('-d')) branchName = bm[1];
        }
        let html = '';
        if (branchName) {
            html += '<div class="ai-git-branch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg><span class="ai-git-branch-name">' + this._escapeHtml(branchName) + '</span></div>';
        }
        if (statusOps.length > 0) {
            const lastStatus = statusOps[statusOps.length - 1];
            html += '<div class="ai-git-changes">';
            html += '<span class="ai-git-change-item" title="已执行 git status ' + statusOps.length + ' 次">📊 ' + statusOps.length + ' 次检查</span>';
            html += '</div>';
        }
        if (commitOps.length > 0) {
            html += '<div class="ai-git-history">';
            const recentCommits = commitOps.slice(-5).reverse();
            for (const op of recentCommits) {
                const msgMatch = op.command.match(/-m\s+["'](.+?)["']/);
                const msg = msgMatch ? msgMatch[1] : '(无消息)';
                const time = new Date(op.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                html += '<div class="ai-git-commit"><span class="ai-git-commit-hash">commit</span><span class="ai-git-commit-msg">' + this._escapeHtml(msg) + '</span><span style="margin-left:auto;font-size:10px">' + time + '</span></div>';
            }
            html += '</div>';
        }
        if (!html) {
            const subcmds = [...new Set(ops.map(o => o.subcommand))];
            html = '<div class="ai-git-empty">Git: ' + subcmds.join(', ') + ' (' + ops.length + ' 次操作)</div>';
        }
        content.innerHTML = html;
    },
};

function aiNewChat() { AIChat.newChat(); }
function aiToggleSettings() { AIChat.toggleSettings(); }

/* ============================================================
   VersePC Onboarding (实验性首次使用引导)
   ============================================================ */
const Onboarding = {
    currentStep: 'welcome',
    role: null,
    folderPath: null,
    folderName: null,
    provider: null,
    typewriterTimer: null,
    typewriterEl: null,
    typewriterText: '',
    typewriterIdx: 0,
    typewriterDone: false,
    init() {
        if (this._initialized) return;
        this._initialized = true;
        this._bindStepEvents();
        this._bindModeToggle();
    },
    _bindStepEvents() {
        document.getElementById('onboard-welcome-next')?.addEventListener('click', () => this._goTo('role'));
        document.getElementById('onboard-role-back')?.addEventListener('click', () => this._goTo('welcome'));
        document.getElementById('onboard-folder-back')?.addEventListener('click', () => this._goTo('role'));
        document.getElementById('onboard-folder-pick')?.addEventListener('click', () => this._pickFolder());
        document.getElementById('onboard-folder-next')?.addEventListener('click', () => this._goTo('provider'));
        document.getElementById('onboard-provider-skip')?.addEventListener('click', () => this._finish());
        document.getElementById('onboard-tutorial-back')?.addEventListener('click', () => this._goTo('provider'));
        document.getElementById('onboard-tutorial-ack')?.addEventListener('click', () => this._goTo('apikey'));
        document.getElementById('onboard-apikey-back')?.addEventListener('click', () => this._goTo('tutorial'));
        document.getElementById('onboard-apikey-submit')?.addEventListener('click', () => this._submitApiKey());
        document.querySelectorAll('.onboard-role-card').forEach(card => {
            card.addEventListener('click', () => {
                this.role = card.dataset.role;
                if (this.role === 'gamer') {
                    this._setDefaultVerseFolder().then(() => this._goTo('provider'));
                } else {
                    this._goTo('folder');
                }
            });
        });
    },
    _bindModeToggle() {
        const toggle = document.getElementById('rc-mode-toggle');
        if (!toggle) return;
        toggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.rc-mode-btn');
            if (!btn) return;
            const mode = btn.dataset.mode;
            if (mode === 'dev') {
                this._showFolderBar();
                AIChat._role = 'developer';
            } else if (mode === 'agent') {
                if (Onboarding.role === 'gamer') {
                    this._hideFolderBar();
                } else {
                    this._showFolderBar();
                }
                AIChat._role = 'gamer';
            } else {
                this._hideFolderBar();
                AIChat._role = 'planner';
            }
            this._setActiveMode(mode);
            this._persist();
        });
    },
    _setActiveMode(mode) {
        document.querySelectorAll('.rc-mode-btn').forEach(b => b.classList.toggle('rc-mode-btn-active', b.dataset.mode === mode));
    },
    _showFolderBar() {
        const sep = document.getElementById('rc-context-sep-folder');
        const btn = document.getElementById('rc-folder-btn');
        if (sep) sep.style.display = '';
        if (btn) btn.style.display = '';
    },
    _hideFolderBar() {
        const sep = document.getElementById('rc-context-sep-folder');
        const btn = document.getElementById('rc-folder-btn');
        if (sep) sep.style.display = 'none';
        if (btn) btn.style.display = 'none';
    },
    async _setDefaultVerseFolder() {
        try {
            const result = await window.electronAPI.getVersionsDir();
            if (result && result.path) {
                this.folderPath = result.path;
                this.folderName = this._basename(result.path);
                AIChat._currentFolderPath = result.path;
                AIChat._currentFolderName = this.folderName;
                this._persist();
                if (AIChat._updateFolderLabel) AIChat._updateFolderLabel();
            }
        } catch (e) { console.warn('[Onboarding] default folder failed', e); }
    },
    async _pickFolder() {
        try {
            const res = await window.electronAPI.selectFolder({ title: '选择项目文件夹', properties: ['openDirectory'] });
            if (res && !res.cancelled && res.path) {
                this.folderPath = res.path;
                this.folderName = this._basename(this.folderPath);
                const pathEl = document.getElementById('onboard-folder-path');
                if (pathEl) pathEl.textContent = this.folderPath;
                const next = document.getElementById('onboard-folder-next');
                if (next) next.disabled = false;
            }
        } catch (e) { console.warn('[Onboarding] pick folder failed', e); }
    },
    _basename(p) {
        if (!p) return '';
        return p.split(/[\\/]/).filter(Boolean).pop() || p;
    },
    _goTo(step) {
        if (this._transLock) return;
        this._transLock = true;
        const overlay = document.getElementById('onboard-overlay');
        const stages = overlay?.querySelectorAll('.onboard-step');
        if (!stages) { this._transLock = false; return; }
        const current = overlay.querySelector('.onboard-step.onboard-step-active');
        const target = overlay.querySelector(`.onboard-step[data-step="${step}"]`);
        if (!target) { this._transLock = false; return; }
        if (current === target) { this._transLock = false; this._onEnterStep(step); return; }
        if (current) {
            current.classList.remove('onboard-step-active');
            current.classList.add('onboard-step-leaving');
            setTimeout(() => {
                current.classList.remove('onboard-step-leaving');
                target.classList.add('onboard-step-active');
                this._transLock = false;
                this._onEnterStep(step);
            }, 320);
        } else {
            target.classList.add('onboard-step-active');
            this._transLock = false;
            this._onEnterStep(step);
        }
    },
    _onEnterStep(step) {
        this.currentStep = step;
        this._stopTypewriter();
        if (step === 'welcome') {
            this._startWelcomeTypewriter();
        } else if (step === 'role') {
            this._setActiveMode('plan');
        } else if (step === 'folder') {
            const pathEl = document.getElementById('onboard-folder-path');
            if (pathEl) pathEl.textContent = this.folderPath || '未选择文件夹';
            const next = document.getElementById('onboard-folder-next');
            if (next) next.disabled = !this.folderPath;
        } else if (step === 'provider') {
            this._renderProviders();
        } else if (step === 'tutorial') {
            this._renderTutorial();
        } else if (step === 'apikey') {
            const customFields = document.getElementById('onboard-custom-fields');
            const apikeyMsg = document.getElementById('onboard-apikey-msg');
            if (this.provider === 'custom') {
                if (customFields) customFields.style.display = '';
                if (apikeyMsg) apikeyMsg.textContent = '请输入你的接入信息：';
            } else {
                if (customFields) customFields.style.display = 'none';
                if (apikeyMsg) apikeyMsg.textContent = `请输入你的 ${this._providerName(this.provider)} API Key 与模型：`;
            }
            this._focusApiKey();
        }
    },
    _startWelcomeTypewriter() {
        this.typewriterEl = document.getElementById('onboard-typewriter');
        if (!this.typewriterEl) return;
        this.typewriterText = '你好，欢迎来到 VersePC';
        this.typewriterIdx = 0;
        this.typewriterDone = false;
        this.typewriterEl.textContent = '';
        this._typewriterTick();
    },
    _typewriterTick() {
        if (!this.typewriterEl) return;
        if (this.typewriterIdx < this.typewriterText.length) {
            this.typewriterIdx++;
            this.typewriterEl.textContent = this.typewriterText.substring(0, this.typewriterIdx);
            this.typewriterTimer = setTimeout(() => this._typewriterTick(), 80);
        } else {
            this.typewriterDone = true;
        }
    },
    _stopTypewriter() {
        if (this.typewriterTimer) {
            clearTimeout(this.typewriterTimer);
            this.typewriterTimer = null;
        }
    },
    _renderProviders() {
        const list = document.getElementById('onboard-provider-list');
        if (!list) return;
        const providers = [
            { key: 'openai', name: 'OpenAI', desc: 'GPT-4o / GPT-4 / o1 等' },
            { key: 'anthropic', name: 'Anthropic', desc: 'Claude 3.5 / Claude 3.7' },
            { key: 'gemini', name: 'Google Gemini', desc: 'Gemini 1.5 / 2.0' },
            { key: 'deepseek', name: 'DeepSeek', desc: 'DeepSeek-V3 / R1' },
            { key: 'zhipu', name: '智谱 AI', desc: 'GLM-4-Flash / GLM-4-Plus' },
            { key: 'moonshot', name: 'Moonshot', desc: 'Kimi / Moonshot-v1' },
            { key: 'qwen', name: '阿里通义千问', desc: 'Qwen-Long / Qwen-Plus' },
            { key: 'doubao', name: '字节豆包', desc: 'Doubao-Pro / Lite' },
            { key: 'spark', name: '讯飞星火', desc: 'Spark v3.5 / v4.0' },
            { key: 'hunyuan', name: '腾讯混元', desc: 'Hunyuan-Pro / Standard' },
            { key: 'wenxin', name: '百度文心', desc: 'ERNIE 4.0 / 3.5' },
            { key: 'custom', name: '自定义 / 第三方代理', desc: 'OpenAI 兼容协议（OneAPI 等）' }
        ];
        list.innerHTML = providers.map(p => `
            <button class="onboard-provider-item" data-provider="${p.key}">
                <div class="onboard-provider-icon"><img src="img/providers/${p.key}.png" width="24" height="24" style="border-radius:4px;object-fit:contain;" onerror="this.style.display='none';this.parentNode.textContent='${p.name.charAt(0)}';"></div>
                <div class="onboard-provider-text">
                    <span class="onboard-provider-name">${p.name}</span>
                    <span class="onboard-provider-desc">${p.desc}</span>
                </div>
            </button>
        `).join('');
        list.querySelectorAll('.onboard-provider-item').forEach(item => {
            item.addEventListener('click', () => {
                this.provider = item.dataset.provider;
                const customFields = document.getElementById('onboard-custom-fields');
                const apikeyMsg = document.getElementById('onboard-apikey-msg');
                if (this.provider === 'custom') {
                    if (customFields) customFields.style.display = '';
                    if (apikeyMsg) apikeyMsg.textContent = '请输入你的接入信息：';
                } else {
                    if (customFields) customFields.style.display = 'none';
                    if (apikeyMsg) apikeyMsg.textContent = `请输入你的 ${this._providerName(this.provider)} API Key 与模型：`;
                }
                this._goTo('tutorial');
            });
        });
    },
    async _renderTutorial() {
        const card = document.getElementById('onboard-tutorial-card');
        const textEl = document.getElementById('onboard-tutorial-text');
        if (!card) return;
        if (textEl) textEl.textContent = `注册与接入教程：${this._providerName(this.provider)}`;
        card.innerHTML = '<div class="onboard-tutorial-loading">正在搜索接入教程...</div>';
        const steps = await this._searchTutorial(this.provider);
        card.innerHTML = steps.map(s => `
            <div class="onboard-tutorial-step">
                <span class="onboard-tutorial-step-num">步骤 ${s.num}</span>
                <span class="onboard-tutorial-step-title">${s.title}</span>
                <span class="onboard-tutorial-step-desc">${s.desc}</span>
            </div>
        `).join('');
    },
    _providerName(key) {
        const map = {
            openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Google Gemini',
            deepseek: 'DeepSeek', zhipu: '智谱 AI', moonshot: 'Moonshot',
            qwen: '阿里通义千问', doubao: '字节豆包', spark: '讯飞星火',
            hunyuan: '腾讯混元', wenxin: '百度文心', custom: '自定义 / 第三方代理'
        };
        return map[key] || key;
    },
    async _searchTutorial(key) {
        const map = {
            openai: [
                { num: 1, title: '访问 OpenAI 官网', desc: '前往 platform.openai.com 并注册账号（需要海外手机号或代理）。' },
                { num: 2, title: '进入 API Keys 页面', desc: '在左侧菜单点击 "API keys" → "Create new secret key"，输入名称并创建。' },
                { num: 3, title: '复制 API Key', desc: '创建后立即复制 sk- 开头的密钥（仅显示一次），妥善保存。' },
                { num: 4, title: '充值 API 额度', desc: '在 Billing 页面绑定信用卡或使用 Apple/Google Pay 充值。' },
                { num: 5, title: '回到 VersePC 粘贴密钥', desc: '点击下方"我已知晓"，填入 API Key 与模型（如 gpt-4o）即可。' }
            ],
            anthropic: [
                { num: 1, title: '访问 Anthropic 控制台', desc: '前往 console.anthropic.com，使用 Google 账号或邮箱注册。' },
                { num: 2, title: '申请 API 访问', desc: '在 Plans & Billing 中选择 Build with API 套餐并完成支付。' },
                { num: 3, title: '生成 API Key', desc: '进入 Settings → API Keys → Create Key，复制 sk-ant- 开头的密钥。' },
                { num: 4, title: '回到 VersePC 配置', desc: '填入 API Key 与模型（如 claude-3-5-sonnet-20241022）。' }
            ],
            gemini: [
                { num: 1, title: '访问 Google AI Studio', desc: '前往 aistudio.google.com，使用 Google 账号登录。' },
                { num: 2, title: '生成 API Key', desc: '点击 "Get API key" → "Create API key"，选择或新建项目。' },
                { num: 3, title: '复制密钥', desc: '复制 AIzaSy 开头的 API Key。' },
                { num: 4, title: '填入 VersePC', desc: '模型可填 gemini-1.5-pro 或 gemini-2.0-flash-exp。' }
            ],
            deepseek: [
                { num: 1, title: '访问 DeepSeek 开放平台', desc: '前往 platform.deepseek.com，使用手机号或邮箱注册。' },
                { num: 2, title: '创建 API Key', desc: '进入 API Keys 页面，点击 "创建新密钥"，复制 sk- 开头的密钥。' },
                { num: 3, title: '充值余额', desc: '在账户管理 → 余额 中充值（支持微信 / 支付宝）。' },
                { num: 4, title: '填入 VersePC', desc: '模型可填 deepseek-chat 或 deepseek-reasoner。' }
            ],
            zhipu: [
                { num: 1, title: '访问智谱 AI 开放平台', desc: '前往 bigmodel.cn，使用手机号注册并完成实名。' },
                { num: 2, title: '进入 API Keys', desc: '在个人中心 → API Keys 中创建新的密钥。' },
                { num: 3, title: '复制密钥', desc: '复制生成的密钥（一般以 4 位字母数字开头）。' },
                { num: 4, title: '填入 VersePC', desc: '模型可填 glm-4-flash（免费）或 glm-4-plus。' }
            ],
            moonshot: [
                { num: 1, title: '访问 Moonshot 开放平台', desc: '前往 platform.moonshot.cn，使用手机号注册。' },
                { num: 2, title: '充值与创建 Key', desc: '在账户中心充值后，进入 API Keys 创建密钥。' },
                { num: 3, title: '复制并填入', desc: '复制 sk- 开头的密钥，模型可填 moonshot-v1-8k / 32k / 128k。' }
            ],
            qwen: [
                { num: 1, title: '访问阿里云百炼', desc: '前往 bailian.console.aliyun.com，使用阿里云账号登录。' },
                { num: 2, title: '开通模型服务', desc: '在模型广场申请 Qwen 模型的 API 访问。' },
                { num: 3, title: '创建 API Key', desc: '在 API-Key 管理 中创建并复制 Key。' },
                { num: 4, title: '填入 VersePC', desc: '模型可填 qwen-plus / qwen-long / qwen-turbo。' }
            ],
            doubao: [
                { num: 1, title: '访问火山引擎', desc: '前往 volcengine.com，注册并完成实名认证。' },
                { num: 2, title: '开通豆包大模型', desc: '在控制台开通 "豆包大模型" 服务。' },
                { num: 3, title: '创建 API Key', desc: '在 访问凭证 → API 访问密钥 中创建 Key。' },
                { num: 4, title: '填入 VersePC', desc: '模型可填 doubao-pro-32k / doubao-lite-32k。' }
            ],
            spark: [
                { num: 1, title: '访问讯飞开放平台', desc: '前往 console.xfyun.cn，注册并完成实名。' },
                { num: 2, title: '创建应用', desc: '在 我的应用 中创建一个新应用，添加 "Spark v3.5/4.0" 接口。' },
                { num: 3, title: '获取 API Key & Secret', desc: '在应用详情页获取 APIKey 和 APISecret。' },
                { num: 4, title: '填入 VersePC', desc: '将 APIPassword 形式的合并密钥填入，模型可填 spark-v3.5。' }
            ],
            hunyuan: [
                { num: 1, title: '访问腾讯混元大模型', desc: '前往 cloud.tencent.com/product/hunyuan，注册并实名。' },
                { num: 2, title: '开通服务', desc: '在控制台开通混元大模型 API。' },
                { num: 3, title: '创建 API Key', desc: '在 访问管理 → API 密钥管理 中创建 SecretId / SecretKey。' },
                { num: 4, title: '填入 VersePC', desc: '填入 SecretId 与 SecretKey 组合密钥，模型可填 hunyuan-pro。' }
            ],
            wenxin: [
                { num: 1, title: '访问百度智能云', desc: '前往 cloud.baidu.com，注册并完成实名认证。' },
                { num: 2, title: '开通文心一言', desc: '在产品列表中找到 "文心一言"，开通付费或免费额度。' },
                { num: 3, title: '创建 API Key', desc: '在千帆大模型 → API Key 中创建密钥。' },
                { num: 4, title: '填入 VersePC', desc: '模型可填 ernie-4.0-8k / ernie-3.5-8k。' }
            ],
            custom: [
                { num: 1, title: '选择代理服务', desc: '推荐使用 OneAPI / NewAPI / API2D 等 OpenAI 兼容中转。' },
                { num: 2, title: '获取 Base URL', desc: '从代理服务获取形如 https://api.xxx.com/v1 的端点。' },
                { num: 3, title: '创建 API Key', desc: '在代理服务中创建并复制 sk- 开头的密钥。' },
                { num: 4, title: '回到 VersePC', desc: '点击下一步进入自定义模式填入 Base URL / Key / Model。' }
            ]
        };
        return map[key] || [{ num: 1, title: '搜索 ' + this._providerName(key) + ' 教程', desc: '请前往搜索引擎搜索 "' + this._providerName(key) + ' API 接入教程"。' }];
    },
    _focusApiKey() {
        setTimeout(() => {
            const input = document.getElementById('onboard-apikey-input');
            if (input) input.focus();
        }, 360);
    },
    async _submitApiKey() {
        const key = document.getElementById('onboard-apikey-input')?.value.trim();
        const model = document.getElementById('onboard-model-input')?.value.trim();
        const status = document.getElementById('onboard-apikey-status');
        if (!key) {
            if (status) { status.textContent = '请输入 API Key'; status.className = 'onboard-apikey-status error'; }
            return;
        }
        if (!model) {
            if (status) { status.textContent = '请输入模型 ID'; status.className = 'onboard-apikey-status error'; }
            return;
        }
        try {
            if (this.provider === 'custom') {
                const baseUrl = document.getElementById('onboard-base-url')?.value.trim();
                const apiFormat = document.getElementById('onboard-api-format')?.value || 'openai';
                const displayName = document.getElementById('onboard-custom-name')?.value.trim() || model;
                const maxTokens = parseInt(document.getElementById('onboard-max-tokens')?.value, 10) || 16384;
                if (!baseUrl) {
                    if (status) { status.textContent = '请输入 Base URL'; status.className = 'onboard-apikey-status error'; }
                    return;
                }
                AIChat._customProvider = { baseUrl, apiKey: key, modelId: model, modelName: displayName, apiFormat, maxTokens };
                await window.electronAPI.store.set('versepc_ai_custom_provider', JSON.stringify(AIChat._customProvider));
                const fullId = 'custom:' + baseUrl + ':' + model;
                const entry = { modelId: fullId, modelName: displayName, providerKey: 'custom', free: false, apiKey: key, baseUrl, maxTokens, apiFormat };
                const exists = AIChat.addedModels.findIndex(m => m.modelId === fullId);
                if (exists >= 0) AIChat.addedModels[exists] = entry;
                else AIChat.addedModels.push(entry);
                await window.electronAPI.store.set('versepc_ai_model', fullId);
                AIChat.model = fullId;
            } else {
                await window.electronAPI.store.set('versepc_ai_api_key', key);
                AIChat.apiKey = key;
                const entry = { providerKey: this.provider, modelId: model, modelName: model, free: false, apiKey: key };
                const exists = AIChat.addedModels.findIndex(m => m.modelId === model);
                if (exists >= 0) AIChat.addedModels[exists] = entry;
                else AIChat.addedModels.push(entry);
                await window.electronAPI.store.set('versepc_ai_model', model);
                AIChat.model = model;
            }
            await window.electronAPI.store.set('versepc_ai_added_models', JSON.stringify(AIChat.addedModels));
            this._persist();
            if (status) { status.textContent = '已保存，正在进入新对话...'; status.className = 'onboard-apikey-status ok'; }
            setTimeout(() => this._finish(), 600);
        } catch (e) {
            if (status) { status.textContent = '保存失败：' + e.message; status.className = 'onboard-apikey-status error'; }
        }
    },
    async _finish() {
        this._hide();
        if (window.OnboardingUI) window.OnboardingUI._applyMode(this.role);
        try { await AIChat.newChat(); } catch (e) { console.warn(e); }
    },
    _hide() {
        const overlay = document.getElementById('onboard-overlay');
        if (overlay) overlay.style.display = 'none';
    },
    _persist() {
        try {
            localStorage.setItem('versepc_onboard_role', this.role || '');
            localStorage.setItem('versepc_onboard_folder', this.folderPath || '');
        } catch (e) {}
    },
    _restore() {
        try {
            this.role = localStorage.getItem('versepc_onboard_role') || null;
            this.folderPath = localStorage.getItem('versepc_onboard_folder') || null;
            this.folderName = this._basename(this.folderPath);
            return false;
        } catch (e) { return false; }
    },
    async start(force) {
        this.init();
        const done = this._restore();
        // 测试中：每次都显示
        if (!force && done) return;
        const overlay = document.getElementById('onboard-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            this._goTo('welcome');
        }
    },
    reset() {
        try {
            localStorage.removeItem('versepc_onboard_role');
            localStorage.removeItem('versepc_onboard_folder');
            localStorage.removeItem('versepc_onboard_done');
        } catch (e) {}
        this.role = null;
        this.folderPath = null;
        this.folderName = null;
        this.provider = null;
        this.currentStep = 'welcome';
        document.querySelectorAll('.onboard-step').forEach(el => { el.classList.remove('onboard-step-active', 'onboard-step-leaving'); });
        const overlay = document.getElementById('onboard-overlay');
        if (overlay) overlay.style.display = 'flex';
        this._goTo('welcome');
    }
};

const OnboardingUI = {
    init() {
        // Restore previous state on page load
        Onboarding._restore();
        if (Onboarding.role) this._applyMode(Onboarding.role, true);
    },
    _applyMode(role, silent) {
        if (!role) return;
        AIChat._role = role;
        const mode = role === 'gamer' ? 'chat' : 'dev';
        Onboarding._setActiveMode(mode);
        if (role === 'gamer') {
            Onboarding._hideFolderBar();
        } else {
            Onboarding._showFolderBar();
        }
        if (!silent && typeof showToast === 'function') {
            showToast(role === 'gamer' ? '当前为对话模式（项目文件夹已隐藏）' : '当前为开发者模式', 'info');
        }
    }
};

function startOnboarding(force) { Onboarding.start(force); }
function resetOnboarding() { Onboarding.reset(); }
function aiSwitchMode(mode) {
    if (mode !== 'plan' && mode !== 'agent' && mode !== 'dev') return;
    if (typeof Onboarding !== 'undefined' && Onboarding._setActiveMode) {
        Onboarding._setActiveMode(mode);
        if (mode === 'dev') Onboarding._showFolderBar();
        else Onboarding._hideFolderBar();
    }
    if (typeof AIChat !== 'undefined') {
        if (mode === 'plan') AIChat._role = 'planner';
        else if (mode === 'agent') AIChat._role = 'gamer';
        else AIChat._role = 'developer';
    }
    if (typeof Onboarding !== 'undefined') {
        if (mode === 'plan') Onboarding.role = 'planner';
        else if (mode === 'agent') Onboarding.role = 'gamer';
        else Onboarding.role = 'developer';
        try { Onboarding._persist(); } catch (e) {}
    }
}

let _editorPanelOpen = false;
let _fileExplorerVisible = false;
function toggleEditorPanel() {
    const panel = document.getElementById('editor-panel');
    const btn = document.getElementById('ai-editor-btn');
    if (!panel) return;
    _editorPanelOpen = !_editorPanelOpen;
    if (_editorPanelOpen) {
        panel.classList.add('open');
    } else {
        panel.classList.remove('open');
        panel.style.removeProperty('--editor-panel-width');
        panel.style.width = '';
    }
    if (btn) btn.classList.toggle('active', _editorPanelOpen);
}
function toggleFileExplorer() {
    const el = document.getElementById('editor-fileexplorer');
    const btn = document.getElementById('btn-toggle-explorer');
    if (!el) return;
    _fileExplorerVisible = !_fileExplorerVisible;
    el.classList.toggle('visible', _fileExplorerVisible);
    if (btn) btn.classList.toggle('active', _fileExplorerVisible);
}
function showEditorToast(msg, duration) {
    const t = document.getElementById('editor-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration || 2500);
}
(function initEditorDragHandle() {
    const handle = document.getElementById('editor-drag-handle');
    const panel = document.getElementById('editor-panel');
    if (!handle || !panel) return;
    let dragging = false, startX = 0, startWidth = 0;
    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        dragging = true;
        startX = e.clientX;
        startWidth = panel.offsetWidth;
        handle.classList.add('active');
        panel.style.transition = 'none';
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        const overlay = document.createElement('div');
        overlay.id = 'drag-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;cursor:col-resize;';
        document.body.appendChild(overlay);
    });
    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const delta = startX - e.clientX;
        const newWidth = Math.max(400, Math.min(startWidth + delta, window.innerWidth * 0.85));
        panel.style.setProperty('--editor-panel-width', newWidth + 'px');
        panel.style.width = newWidth + 'px';
    });
    document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        handle.classList.remove('active');
        panel.style.transition = '';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        const overlay = document.getElementById('drag-overlay');
        if (overlay) overlay.remove();
    });
})();
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _editorPanelOpen) {
        toggleEditorPanel();
        e.preventDefault();
    }
    if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        toggleEditorPanel();
    }
    if (e.ctrlKey && e.key === 'b' && _editorPanelOpen) {
        e.preventDefault();
        toggleFileExplorer();
    }
});
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'editor:send-to-ai') {
        const { selectedText, filePath, language, startLine, endLine, totalLines } = event.data;
        if (typeof AIChat !== 'undefined' && AIChat._instance) {
            AIChat._instance._handleEditorSendToAI(selectedText, filePath, language, startLine, endLine, totalLines);
        }
    }
});
function openPreview(url) {
    const panel = document.getElementById('preview-panel');
    const webview = document.getElementById('preview-webview');
    const title = document.getElementById('preview-panel-title');
    if (!panel || !webview) return;
    panel.classList.add('open');
    webview.src = url;
    if (title) title.textContent = '预览 - ' + url;
}
function closePreview() {
    const panel = document.getElementById('preview-panel');
    const webview = document.getElementById('preview-webview');
    if (panel) panel.classList.remove('open');
    if (webview) webview.src = 'about:blank';
    if (window.electronAPI && window.electronAPI.stopPreview) {
        window.electronAPI.stopPreview().catch(() => {});
    }
}
function refreshPreview() {
    const webview = document.getElementById('preview-webview');
    if (webview && webview.src && webview.src !== 'about:blank') {
        webview.reload();
    }
}
function togglePreviewDevtools() {
    const webview = document.getElementById('preview-webview');
    if (webview) {
        if (webview.isDevToolsOpened()) { webview.closeDevTools(); }
        else { webview.openDevTools(); }
    }
}

function aiSaveSettings() { AIChat.saveSettings(); }
function aiSearchConversations(query) { AIChat.renderSidebar(query); }
function aiClearAllChats() { AIChat.clearAllChats(); }
function switchSettingsPanel(panelId, el) {
    AIChat._switchSettingsTab(panelId);
}
async function aiSendMessage() {
    const input = document.getElementById('ai-input');
    if (input) await AIChat.sendMessage(input.value);
}
function aiStopGeneration() { AIChat.stopGenerationForce(); }
function aiSendQuick(text) { AIChat.sendMessage(text); }
function aiHandleKeyDown(e) {
    if (AIChat._atMentionActive) {
        const popup = document.querySelector('.ai-at-mention-popup');
        if (popup) {
            const items = popup.querySelectorAll('.ai-at-mention-item');
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                AIChat._atMentionHighlightIdx = Math.max(0, AIChat._atMentionHighlightIdx - 1);
                items.forEach((el, i) => el.classList.toggle('active', i === AIChat._atMentionHighlightIdx));
                if (items[AIChat._atMentionHighlightIdx]) items[AIChat._atMentionHighlightIdx].scrollIntoView({ block: 'nearest' });
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                AIChat._atMentionHighlightIdx = Math.min(items.length - 1, AIChat._atMentionHighlightIdx + 1);
                items.forEach((el, i) => el.classList.toggle('active', i === AIChat._atMentionHighlightIdx));
                if (items[AIChat._atMentionHighlightIdx]) items[AIChat._atMentionHighlightIdx].scrollIntoView({ block: 'nearest' });
                return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (items[AIChat._atMentionHighlightIdx]) {
                    items[AIChat._atMentionHighlightIdx].click();
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                AIChat._hideAtMentionPopup();
                return;
            }
        }
    }
    const sendOnEnter = !AIChat._uiSettings || AIChat._uiSettings.sendOnEnter !== false;
    if (e.key === 'Enter') {
        if (sendOnEnter && !e.shiftKey) {
            e.preventDefault();
            aiSendMessage();
        } else if (!sendOnEnter && e.ctrlKey) {
            e.preventDefault();
            aiSendMessage();
        }
    }
}
function aiAutoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

if (typeof window !== 'undefined') {
    window.AIChat = AIChat;
}
/* @versepc-protected: anti-ai-plagiarism-v1.0 */
