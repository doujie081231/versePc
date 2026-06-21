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
 * VersePC Agent Engine
 * 
 * 核心设计：
 * 1. 状态机驱动：IDLE → RUNNING → STREAMING → ACTING → OBSERVING → REFLECTING → DONE
 * 2. 增量流式输出：仅发送新字符，消息去重 (OutputManager)
 * 3. 事件驱动：统一 say/ask 消息格式
 * 4. 全功能保留：意图检测、计划生成、卡死检测、反思、被动检测、并行工具、进度轮询
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getPluginManager } = require('./plugin-manager');

// =============================================================================
// Agent State Machine
// =============================================================================

const AgentState = {
    IDLE: 'idle',
    RUNNING: 'running',
    STREAMING: 'streaming',
    ACTING: 'acting',
    OBSERVING: 'observing',
    REFLECTING: 'reflecting',
    RESPONDING: 'responding',
    WAITING_FOR_INPUT: 'waiting_for_input',
    DONE: 'done',
    STUCK: 'stuck',
    ERROR: 'error'
};

const SayType = {
    TEXT: 'text',
    REASONING: 'reasoning',
    TOOL_START: 'tool_start',
    TOOL_RESULT: 'tool_result',
    TOOL_END: 'tool_end',
    ERROR: 'error',
    COMPLETION: 'completion',
    API_STARTED: 'api_req_started',
    API_FINISHED: 'api_req_finished',
    FOLLOWUP: 'followup',
    PLAN_CREATED: 'plan_created',
    PLAN_STEP_UPDATE: 'plan_step_update',
    PLAN_DONE: 'plan_done',
    THINKING_STEP: 'thinking_step',
    REFLECTION: 'reflection',
    PROGRESS: 'progress',
    HEARTBEAT: 'heartbeat'
};

const AskType = {
    TOOL_APPROVAL: 'tool_approval',
    FOLLOWUP: 'followup'
};

// =============================================================================
// Output Manager (增量输出 + 去重)
// =============================================================================

class OutputManager {
    constructor() {
        this.displayedMessages = new Map();
        this.streamedContent = new Map();
        this.currentlyStreamingTs = null;
        this.tsCounter = 0;
    }

    _nextTs() { return ++this.tsCounter; }

    _streamDelta(ts, text) {
        const previous = this.streamedContent.get(ts);
        if (!previous) {
            this.streamedContent.set(ts, { text, headerShown: true });
            this.currentlyStreamingTs = ts;
            return { action: 'full', text };
        }
        if (text.length > previous.text.length && text.startsWith(previous.text)) {
            const delta = text.slice(previous.text.length);
            this.streamedContent.set(ts, { text, headerShown: true });
            return { action: 'delta', text: delta };
        }
        return { action: 'skip' };
    }

    _finishStream(ts) {
        if (this.currentlyStreamingTs === ts) {
            this.currentlyStreamingTs = null;
        }
    }

    processMessage(msg) {
        const text = msg.text || '';
        const isPartial = msg.partial === true;
        let ts;

        if (isPartial && msg.type === 'say' && (msg.say === SayType.TEXT || msg.say === SayType.REASONING || msg.say === SayType.COMPLETION)) {
            if (this.currentlyStreamingTs) {
                const activeMsg = this.displayedMessages.get(this.currentlyStreamingTs);
                if (activeMsg && activeMsg.say === msg.say && activeMsg.partial) {
                    ts = this.currentlyStreamingTs;
                } else {
                    ts = this._nextTs();
                }
            } else {
                ts = this._nextTs();
            }
        } else {
            if (!isPartial && msg.type === 'say' && this.currentlyStreamingTs) {
                const activeMsg = this.displayedMessages.get(this.currentlyStreamingTs);
                if (activeMsg && activeMsg.say === msg.say) {
                    ts = this.currentlyStreamingTs;
                } else {
                    ts = msg.ts || this._nextTs();
                }
            } else {
                ts = msg.ts || this._nextTs();
            }
        }

        const previous = this.displayedMessages.get(ts);
        const alreadyComplete = previous && !previous.partial;

        if (msg.type === 'say') {
            return this._processSay(ts, msg.say, text, isPartial, alreadyComplete, msg);
        }
        if (msg.type === 'ask') {
            return this._processAsk(ts, msg.ask, text, isPartial, alreadyComplete, msg);
        }
        return null;
    }

    _processSay(ts, say, text, isPartial, alreadyComplete, msg) {
        switch (say) {
            case SayType.TEXT:
            case SayType.REASONING:
            case SayType.COMPLETION:
                if (isPartial && text) {
                    const delta = this._streamDelta(ts, text);
                    this.displayedMessages.set(ts, { ts, say, text, partial: true });
                    return { type: 'say', say, ts, text: delta.text, partial: true, delta: delta.action === 'delta' };
                }
                if (!isPartial && !alreadyComplete) {
                    const streamed = this.streamedContent.get(ts);
                    if (streamed && text && text.length > streamed.text.length && text.startsWith(streamed.text)) {
                        const remaining = text.slice(streamed.text.length);
                        this._finishStream(ts);
                        this.displayedMessages.set(ts, { ts, say, text, partial: false });
                        return { type: 'say', say, ts, text: remaining, partial: false, trailing: true };
                    }
                    this._finishStream(ts);
                    this.displayedMessages.set(ts, { ts, say, text, partial: false });
                    return { type: 'say', say, ts, text: text || '', partial: false };
                }
                break;

            case SayType.TOOL_START:
            case SayType.TOOL_RESULT:
            case SayType.TOOL_END:
            case SayType.ERROR:
            case SayType.PLAN_CREATED:
            case SayType.PLAN_STEP_UPDATE:
            case SayType.PLAN_DONE:
            case SayType.THINKING_STEP:
            case SayType.REFLECTION:
            case SayType.PROGRESS:
                this.displayedMessages.set(ts, { ts, text, partial: false });
                return { type: 'say', say, ts, text, partial: false };

            case SayType.API_STARTED:
                this.displayedMessages.set(ts, { ts, text, partial: true });
                return { type: 'say', say, ts, text, partial: false };

            case SayType.API_FINISHED:
            case SayType.FOLLOWUP:
                this.displayedMessages.set(ts, { ts, text, partial: false });
                return { type: 'say', say, ts, text, partial: false };
        }
        return null;
    }

    _processAsk(ts, ask, text, isPartial, alreadyComplete, fullMsg) {
        this.displayedMessages.set(ts, { ts, text, partial: false });
        return { type: 'ask', ask, ts, text, partial: false, args: fullMsg.args, toolName: fullMsg.toolName, risk: fullMsg.risk };
    }

    clear() {
        this.displayedMessages.clear();
        this.streamedContent.clear();
        this.currentlyStreamingTs = null;
        this.tsCounter = 0;
    }
}

// =============================================================================
// AI Platform & Provider 配置（所有平台）
// =============================================================================
// 结构：
//   PLATFORMS: providerKey → { name, baseUrl, authType, apiFormat, thinkingParams }
//   MODELS: modelId → { provider, name, free }
//
// apiFormat 可选值：'openai'(默认) | 'anthropic' | 'google'
// authType 可选值：'bearer'(默认) | 'x-api-key' | 'url_key'

const PLATFORMS = {
    zhipu: {
        name: '智谱 GLM',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        authType: 'bearer',
        apiFormat: 'openai',
        thinkingParams: {}
    },
    deepseek: {
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        authType: 'bearer',
        apiFormat: 'openai',
        thinkingParams: { enable_thinking: true }
    },
    qwen: {
        name: '通义千问',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        authType: 'bearer',
        apiFormat: 'openai',
        thinkingParams: { enable_thinking: true }
    },
    moonshot: {
        name: 'Moonshot Kimi',
        baseUrl: 'https://api.moonshot.cn/v1',
        authType: 'bearer',
        apiFormat: 'openai',
        thinkingParams: {}
    },
    yi: {
        name: '零一万物',
        baseUrl: 'https://api.lingyiwanwu.com/v1',
        authType: 'bearer',
        apiFormat: 'openai',
        thinkingParams: {}
    },
    baichuan: {
        name: '百川智能',
        baseUrl: 'https://api.baichuan-ai.com/v1',
        authType: 'bearer',
        apiFormat: 'openai',
        thinkingParams: {}
    },
    minimax: {
        name: 'MiniMax',
        baseUrl: 'https://api.minimax.chat/v1',
        authType: 'bearer',
        apiFormat: 'openai',
        thinkingParams: {}
    },
    stepfun: {
        name: '阶跃星辰',
        baseUrl: 'https://api.stepfun.com/v1',
        authType: 'bearer',
        apiFormat: 'openai',
        thinkingParams: {}
    },
    siliconflow: {
        name: 'SiliconFlow',
        baseUrl: 'https://api.siliconflow.cn/v1',
        authType: 'bearer',
        apiFormat: 'openai',
        thinkingParams: { enable_thinking: true }
    },
    openrouter: {
        name: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        authType: 'bearer',
        apiFormat: 'openai',
        thinkingParams: { enable_thinking: true }
    },
    groq: {
        name: 'Groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        authType: 'bearer',
        apiFormat: 'openai',
        thinkingParams: {}
    },
    openai: {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        authType: 'bearer',
        apiFormat: 'openai',
        thinkingParams: {}
    },
    anthropic: {
        name: 'Anthropic',
        baseUrl: 'https://api.anthropic.com',
        authType: 'x-api-key',
        apiFormat: 'anthropic',
        thinkingParams: {}
    },
    google: {
        name: 'Google Gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        authType: 'url_key',
        apiFormat: 'google',
        thinkingParams: {}
    }
};

const MODELS = {
    // 智谱 GLM
    'glm-5.1': { provider: 'zhipu', name: 'GLM-5.1' },
    'glm-5': { provider: 'zhipu', name: 'GLM-5' },
    'glm-5-plus': { provider: 'zhipu', name: 'GLM-5-Plus' },
    'glm-5-air': { provider: 'zhipu', name: 'GLM-5-Air' },
    'glm-5-flash': { provider: 'zhipu', name: 'GLM-5-Flash', free: true },
    'glm-4.7': { provider: 'zhipu', name: 'GLM-4.7' },
    // DeepSeek
    'deepseek-v4-pro': { provider: 'deepseek', name: 'DeepSeek-V4-Pro' },
    'deepseek-v4-flash': { provider: 'deepseek', name: 'DeepSeek-V4-Flash' },
    'deepseek-chat': { provider: 'deepseek', name: 'DeepSeek-V3.2' },
    'deepseek-reasoner': { provider: 'deepseek', name: 'DeepSeek-R1' },
    // 通义千问
    'qwen3.6-max-preview': { provider: 'qwen', name: 'Qwen3.6-Max' },
    'qwen3.6-plus': { provider: 'qwen', name: 'Qwen3.6-Plus' },
    'qwen3.6-flash': { provider: 'qwen', name: 'Qwen3.6-Flash', free: true },
    'qwen3-235b-a22b': { provider: 'qwen', name: 'Qwen3-235B' },
    'qwen3-30b-a3b': { provider: 'qwen', name: 'Qwen3-30B', free: true },
    'qwq-plus': { provider: 'qwen', name: 'QwQ-Plus' },
    // Moonshot Kimi
    'kimi-k2.6': { provider: 'moonshot', name: 'Kimi-K2.6' },
    'kimi-k2.5': { provider: 'moonshot', name: 'Kimi-K2.5' },
    'moonshot-v1-128k': { provider: 'moonshot', name: 'Moonshot-v1-128k' },
    'moonshot-v1-32k': { provider: 'moonshot', name: 'Moonshot-v1-32k' },
    // 零一万物 Yi
    'yi-lightning': { provider: 'yi', name: 'Yi-Lightning', free: true },
    'yi-large': { provider: 'yi', name: 'Yi-Large' },
    'yi-large-turbo': { provider: 'yi', name: 'Yi-Large-Turbo' },
    'yi-medium': { provider: 'yi', name: 'Yi-Medium' },
    // 百川
    'Baichuan4-Turbo': { provider: 'baichuan', name: 'Baichuan4-Turbo' },
    'Baichuan4-Air': { provider: 'baichuan', name: 'Baichuan4-Air' },
    'Baichuan4': { provider: 'baichuan', name: 'Baichuan4' },
    'Baichuan3-Turbo': { provider: 'baichuan', name: 'Baichuan3-Turbo' },
    // MiniMax
    'MiniMax-M2.7': { provider: 'minimax', name: 'MiniMax-M2.7' },
    'MiniMax-M2.5': { provider: 'minimax', name: 'MiniMax-M2.5' },
    'MiniMax-M2.1': { provider: 'minimax', name: 'MiniMax-M2.1' },
    // 阶跃星辰
    'step-2-16k': { provider: 'stepfun', name: 'Step-2-16K' },
    'step-1-8k': { provider: 'stepfun', name: 'Step-1-8K', free: true },
    // SiliconFlow
    'Pro/deepseek-ai/DeepSeek-V4-Pro': { provider: 'siliconflow', name: 'DeepSeek-V4-Pro' },
    'deepseek-ai/DeepSeek-V4-Flash': { provider: 'siliconflow', name: 'DeepSeek-V4-Flash', free: true },
    'Qwen/Qwen3-235B-A22B': { provider: 'siliconflow', name: 'Qwen3-235B', free: true },
    'Qwen/Qwen3-30B-A3B': { provider: 'siliconflow', name: 'Qwen3-30B', free: true },
    'Qwen/Qwen3.6-Flash': { provider: 'siliconflow', name: 'Qwen3.6-Flash', free: true },
    'Pro/zai-org/GLM-5.1': { provider: 'siliconflow', name: 'GLM-5.1', free: true },
    // OpenRouter
    'deepseek/deepseek-v4-pro': { provider: 'openrouter', name: 'DeepSeek V4 Pro' },
    'deepseek/deepseek-v4-flash:free': { provider: 'openrouter', name: 'DeepSeek V4 Flash', free: true },
    'qwen/qwen3-235b-a22b': { provider: 'openrouter', name: 'Qwen3 235B' },
    'google/gemini-2.5-flash': { provider: 'openrouter', name: 'Gemini 2.5 Flash', free: true },
    'anthropic/claude-sonnet-4-6': { provider: 'openrouter', name: 'Claude Sonnet 4.6' },
    'anthropic/claude-3.5-sonnet': { provider: 'openrouter', name: 'Claude 3.5 Sonnet', free: true },
    // Groq
    'llama-3.3-70b-versatile': { provider: 'groq', name: 'Llama 3.3 70B', free: true },
    'qwen/qwen3-32b': { provider: 'groq', name: 'Qwen3 32B', free: true },
    'deepseek-r1-distill-llama-70b': { provider: 'groq', name: 'DeepSeek R1 70B', free: true },
    // OpenAI
    'gpt-4.1': { provider: 'openai', name: 'GPT-4.1' },
    'gpt-4.1-mini': { provider: 'openai', name: 'GPT-4.1-mini' },
    'gpt-4.1-nano': { provider: 'openai', name: 'GPT-4.1-nano' },
    'gpt-4o': { provider: 'openai', name: 'GPT-4o' },
    'gpt-4o-mini': { provider: 'openai', name: 'GPT-4o-mini' },
    'o3-mini': { provider: 'openai', name: 'o3-mini' },
    'o3': { provider: 'openai', name: 'o3' },
    // Anthropic Claude
    'claude-sonnet-4-6-20250217': { provider: 'anthropic', name: 'Claude Sonnet 4.6' },
    'claude-opus-4-7-20260416': { provider: 'anthropic', name: 'Claude Opus 4.7' },
    'claude-sonnet-4-5-20250929': { provider: 'anthropic', name: 'Claude Sonnet 4.5' },
    'claude-opus-4-5-20251124': { provider: 'anthropic', name: 'Claude Opus 4.5' },
    'claude-haiku-4-5-20251001': { provider: 'anthropic', name: 'Claude Haiku 4.5' },
    // Google Gemini
    'gemini-3.5-flash': { provider: 'google', name: 'Gemini 3.5 Flash' },
    'gemini-2.5-pro': { provider: 'google', name: 'Gemini 2.5 Pro' },
    'gemini-2.5-flash': { provider: 'google', name: 'Gemini 2.5 Flash', free: true },
    'gemini-2.5-flash-lite': { provider: 'google', name: 'Gemini 2.5 Flash-Lite', free: true },
    'gemini-2.0-flash': { provider: 'google', name: 'Gemini 2.0 Flash', free: true }
};

const MODEL_PRICES = {
    'deepseek-chat': { input: 1, output: 2 },
    'deepseek-reasoner': { input: 4, output: 16 },
    'deepseek-v4-pro': { input: 2, output: 8 },
    'deepseek-v4-flash': { input: 0, output: 0 },
    'gpt-4o': { input: 2.5, output: 10 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4.1': { input: 2, output: 8 },
    'gpt-4.1-mini': { input: 0.4, output: 1.6 },
    'gpt-4.1-nano': { input: 0.1, output: 0.4 },
    'o3-mini': { input: 1.1, output: 4.4 },
    'o3': { input: 10, output: 40 },
    'claude-sonnet-4-6-20250217': { input: 3, output: 15 },
    'claude-opus-4-7-20260416': { input: 15, output: 75 },
    'claude-sonnet-4-5-20250929': { input: 3, output: 15 },
    'claude-opus-4-5-20251124': { input: 15, output: 75 },
    'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
    'gemini-2.5-pro': { input: 1.25, output: 10 },
    'gemini-2.5-flash': { input: 0.15, output: 0.6 },
    'gemini-2.5-flash-lite': { input: 0.075, output: 0.3 },
    'gemini-2.0-flash': { input: 0.1, output: 0.4 },
    'gemini-3.5-flash': { input: 0.15, output: 0.6 },
    'glm-5.1': { input: 5, output: 10 },
    'glm-5': { input: 2, output: 5 },
    'glm-5-plus': { input: 5, output: 10 },
    'glm-5-air': { input: 1, output: 2 },
    'glm-5-flash': { input: 0, output: 0 },
    'glm-4.7': { input: 1, output: 2 },
    'qwen3.6-max-preview': { input: 2, output: 6 },
    'qwen3.6-plus': { input: 0.8, output: 2 },
    'qwen3.6-flash': { input: 0, output: 0 },
    'qwen3-235b-a22b': { input: 0.5, output: 2 },
    'qwen3-30b-a3b': { input: 0, output: 0 },
    'qwq-plus': { input: 1, output: 4 },
    'kimi-k2.6': { input: 3, output: 12 },
    'kimi-k2.5': { input: 2, output: 8 },
    'moonshot-v1-128k': { input: 8, output: 8 },
    'moonshot-v1-32k': { input: 8, output: 8 },
    'yi-lightning': { input: 0, output: 0 },
    'yi-large': { input: 2, output: 2 },
    'yi-large-turbo': { input: 1, output: 1 },
    'yi-medium': { input: 0.6, output: 0.6 },
    'Baichuan4-Turbo': { input: 2, output: 6 },
    'Baichuan4-Air': { input: 0.5, output: 1 },
    'Baichuan4': { input: 2, output: 6 },
    'Baichuan3-Turbo': { input: 1, output: 2 },
    'MiniMax-M2.7': { input: 1, output: 4 },
    'MiniMax-M2.5': { input: 0.5, output: 2 },
    'MiniMax-M2.1': { input: 0.2, output: 0.8 },
    'step-2-16k': { input: 3, output: 12 },
    'step-1-8k': { input: 0, output: 0 },
    'llama-3.3-70b-versatile': { input: 0, output: 0 },
    'qwen/qwen3-32b': { input: 0, output: 0 },
    'deepseek-r1-distill-llama-70b': { input: 0, output: 0 },
};

function estimateCost(modelId, promptTokens, completionTokens) {
    const pricing = MODEL_PRICES[modelId];
    if (!pricing) return 0;
    return (promptTokens / 1000000) * pricing.input + (completionTokens / 1000000) * pricing.output;
}

function getProviderInfo(modelId) {
    const modelInfo = MODELS[modelId];
    if (!modelInfo) return { platform: PLATFORMS.zhipu, modelInfo: { name: modelId } };
    return { platform: PLATFORMS[modelInfo.provider] || PLATFORMS.zhipu, modelInfo };
}

function getProviderForModel(modelId) {
    return getProviderInfo(modelId).platform;
}

function buildApiHeaders(platform, apiKey) {
    const headers = { 'Content-Type': 'application/json' };
    switch (platform.authType) {
        case 'x-api-key':
            headers['x-api-key'] = apiKey;
            headers['anthropic-version'] = '2023-06-01';
            break;
        case 'url_key':
            headers['x-goog-api-key'] = apiKey;
            break;
        case 'bearer':
        default:
            headers['Authorization'] = `Bearer ${apiKey}`;
            break;
    }
    if (platform.name === 'OpenRouter') {
        headers['HTTP-Referer'] = 'https://versepc.app';
        headers['X-Title'] = 'VersePC';
    }
    return headers;
}

function buildChatEndpoint(platform, modelId, apiKey) {
    const base = platform.baseUrl;
    switch (platform.apiFormat) {
        case 'anthropic':
            return { url: base + '/v1/messages', method: 'POST' };
        case 'google':
            return { url: base + '/models/' + modelId + ':streamGenerateContent?alt=sse&key=' + encodeURIComponent(apiKey), method: 'POST' };
        case 'openai':
        default:
            return { url: base + '/chat/completions', method: 'POST' };
    }
}

function buildNonStreamingEndpoint(platform, modelId, apiKey) {
    const base = platform.baseUrl;
    switch (platform.apiFormat) {
        case 'google':
            return { url: base + '/models/' + modelId + ':generateContent?key=' + encodeURIComponent(apiKey), method: 'POST' };
        default:
            return buildChatEndpoint(platform, modelId, apiKey);
    }
}

// Anthropic 消息格式转换
function _toAnthropicMessages(messages) {
    const systemMsgs = messages.filter(m => m.role === 'system');
    const others = messages.filter(m => m.role !== 'system');
    const result = { messages: [] };

    if (systemMsgs.length > 0) {
        if (systemMsgs.length === 1) {
            result.system = [{ type: 'text', text: systemMsgs[0].content, cache_control: { type: 'ephemeral' } }];
        } else {
            result.system = systemMsgs.map((m, idx) => ({
                type: 'text',
                text: m.content,
                ...(idx === 0 || idx === systemMsgs.length - 1 ? { cache_control: { type: 'ephemeral' } } : {})
            }));
        }
    }

    let i = 0;
    while (i < others.length) {
        const m = others[i];

        if (m.role === 'tool') {
            const toolResults = [];
            while (i < others.length && others[i].role === 'tool') {
                const toolContent = typeof others[i].content === 'string' ? others[i].content : '';
                toolResults.push({ type: 'tool_result', tool_use_id: others[i].tool_call_id || 'unknown', content: toolContent });
                i++;
            }
            if (toolResults.length > 0) {
                result.messages.push({ role: 'user', content: toolResults });
            }
            continue;
        }

        const content = [];
        if (m.content) content.push({ type: 'text', text: m.content });
        if (m.tool_calls) {
            for (const tc of m.tool_calls) {
                let input = {};
                try { input = JSON.parse(tc.function.arguments); } catch (e) {}
                content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
            }
        }

        if (content.length > 0) {
            result.messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content });
        }
        i++;
    }

    if (result.messages.length === 0 && others.length > 0) {
        result.messages = others.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content || '...' }));
    }
    return result;
}

function _toAnthropicTools(tools) {
    if (!tools || !tools.length) return undefined;
    return tools.map(t => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters }));
}

// Google Gemini 消息格式转换
function _toGoogleMessages(messages) {
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystem = messages.filter(m => m.role !== 'system');
    const result = { contents: [] };
    if (systemMsg) result.system_instruction = { parts: [{ text: systemMsg.content }] };

    for (const m of nonSystem) {
        const parts = [];
        if (m.content) parts.push({ text: m.content });
        if (m.tool_calls) {
            for (const tc of m.tool_calls) {
                let args = {};
                try { args = JSON.parse(tc.function.arguments); } catch (e) {}
                parts.push({ functionCall: { name: tc.function.name, args } });
            }
        }
        if (m.role === 'tool') {
            try {
                const parsed = JSON.parse(m.content);
                parts.push({ functionResponse: { name: m.name || m.tool_name || '', response: parsed } });
            } catch (e) {
                parts.push({ functionResponse: { name: m.name || m.tool_name || '', response: { result: m.content || '' } } });
            }
        }
        if (parts.length > 0) {
            result.contents.push({
                role: m.role === 'assistant' ? 'model' : (m.role === 'tool' ? 'function' : 'user'),
                parts
            });
        }
    }
    return result;
}

function _toGoogleTools(tools) {
    if (!tools || !tools.length) return undefined;
    return [{ functionDeclarations: tools.map(t => ({ name: t.function.name, description: t.function.description, parameters: t.function.parameters })) }];
}

// =============================================================================
// Tool 定义
// =============================================================================

const AI_TOOLS = [
    { type: 'function', function: { name: 'bash', description: 'Execute a shell command. Supports any CLI tool (git, npm, node, python, pip, etc.). For long-running processes (dev servers, watchers), use background=true. Use manage_processes(action="list") to see running processes, manage_processes(action="output", pid=N) to read output, manage_processes(action="stop", pid=N) to stop.', parameters: { type: 'object', properties: { command: { type: 'string', description: 'The command to execute' }, cwd: { type: 'string', description: 'Working directory (absolute path). Defaults to previous cwd or project root.' }, timeout: { type: 'number', description: 'Timeout in seconds (default 120, max 600). For long-running commands use background=true instead.' }, background: { type: 'boolean', description: 'Run in background (for dev servers, watchers). Returns immediately with process info. Use bash(command="taskkill /PID <pid> /F") to stop.' }, restart: { type: 'boolean', description: 'Reset shell session state (cwd, env)' } }, required: ['command'] } } },
    { type: 'function', function: { name: 'str_replace_based_edit_tool', description: 'File editing tool: view, create, and edit files. Commands: view (read file), create (new file), str_replace (exact string replacement), insert (insert at line). create cannot be used on existing files.', parameters: { type: 'object', properties: { command: { type: 'string', enum: ['view', 'create', 'str_replace', 'insert'], description: 'Command to execute' }, path: { type: 'string', description: 'Absolute path to file or directory' }, file_text: { type: 'string', description: 'Required for create: file content' }, old_str: { type: 'string', description: 'Required for str_replace: exact string to replace (must be unique)' }, new_str: { type: 'string', description: 'New string for str_replace/insert' }, insert_line: { type: 'integer', description: 'Required for insert: line number to insert after' }, view_range: { type: 'array', items: { type: 'integer' }, description: 'Optional for view: line range [start, end]' } }, required: ['command', 'path'] } } },
    { type: 'function', function: { name: 'json_edit_tool', description: 'JSON file editing tool using JSONPath expressions. Operations: view, set, add, remove. Examples: $.users[0].name, $.config.database', parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['view', 'set', 'add', 'remove'], description: 'Operation to perform' }, file_path: { type: 'string', description: 'Absolute path to JSON file' }, json_path: { type: 'string', description: 'JSONPath expression' }, value: { type: 'object', description: 'Value to set or add (required for set/add)' }, pretty_print: { type: 'boolean', description: 'Format output (default true)' } }, required: ['operation', 'file_path'] } } },
    { type: 'function', function: { name: 'sequential_thinking', description: 'Break down complex problems into sequential thinking steps. Each step produces a conclusion. Supports revising previous steps. Use when deep analysis is needed.', parameters: { type: 'object', properties: { thought: { type: 'string', description: 'Thinking content for current step' }, thought_number: { type: 'number', description: 'Current step number' }, total_thoughts: { type: 'number', description: 'Estimated total steps' }, next_thought_needed: { type: 'boolean', description: 'Whether another step is needed' }, is_revision: { type: 'boolean', description: 'Whether revising a previous step' }, revises_thought: { type: 'number', description: 'Step number being revised (when is_revision=true)' }, branch_from_thought: { type: 'number', description: 'Branch from this step (optional)' }, branch_id: { type: 'string', description: 'Branch identifier (optional)' } }, required: ['thought', 'thought_number', 'total_thoughts', 'next_thought_needed'] } } },
    { type: 'function', function: { name: 'attempt_completion', description: 'Report task completion. Only call after verifying the task is done. The result will be presented to the user for confirmation.', parameters: { type: 'object', properties: { result: { type: 'string', description: 'Final result message with summary of completed work' } }, required: ['result'] } } },
    { type: 'function', function: { name: 'ckg', description: 'Code Knowledge Graph: search for functions, classes, and class methods in the codebase.', parameters: { type: 'object', properties: { command: { type: 'string', enum: ['search_function', 'search_class', 'search_class_method'], description: 'Search command' }, path: { type: 'string', description: 'Codebase path' }, identifier: { type: 'string', description: 'Function/class/method name to search' }, print_body: { type: 'boolean', description: 'Print function/class body (default true)' } }, required: ['command', 'path', 'identifier'] } } },
    { type: 'function', function: { name: 'update_todo_list', description: 'Create or update a task plan. MUST be called as the FIRST action for any task requiring tools. Decomposes the user request into concrete, actionable tasks and tracks progress. Format: [ ] pending, [-] in progress, [x] completed.', parameters: { type: 'object', properties: { todos: { type: 'string', description: 'Complete task list in Markdown format. Example:\n- [ ] Task 1: Analyze code structure\n- [-] Task 2: Modify CSS styles (currently executing)\n- [x] Task 3: Bug fix completed' } }, required: ['todos'] } } },
    {
        type: 'function',
        function: {
            name: 'sub_agent_dispatch',
            description: '派遣子代理执行特定任务。file_search: 搜索文件和目录, code_analysis: 分析代码结构, resource_download: 搜索Minecraft资源, crash_analysis: 分析崩溃日志, code_completion: 代码补全和优化, explore: 快速探索代码库结构(只读), review: 代码审查(只读), verifier: 验证测试结果, auto: 自动选择',
            parameters: {
                type: 'object',
                properties: {
                    agent_type: {
                        type: 'string',
                        enum: ['file_search', 'code_analysis', 'resource_download', 'crash_analysis', 'code_completion', 'explore', 'review', 'verifier', 'auto'],
                        description: '子代理类型。使用 auto 可自动根据任务描述选择最合适的子代理'
                    },
                    task: {
                        type: 'string',
                        description: '子代理要执行的具体任务描述'
                    }
                },
                required: ['agent_type', 'task']
            }
        }
    },
    { type: 'function', function: { name: 'start_preview', description: 'Start a local HTTP server to preview web files (HTML/CSS/JS). Opens a browser preview panel in the UI. Use this when the user wants to see how their web code looks. Use command="stop" to stop the server.', parameters: { type: 'object', properties: { command: { type: 'string', enum: ['start', 'stop'], description: 'start to begin preview, stop to end it' }, root: { type: 'string', description: 'Absolute path to the directory to serve (required for start)' }, port: { type: 'number', description: 'Port number (default 8080)' } }, required: ['command'] } } },
    { type: 'function', function: { name: 'manage_processes', description: 'List and manage background processes started by bash. Use to check dev server output, list running processes, or stop processes.', parameters: { type: 'object', properties: { action: { type: 'string', enum: ['list', 'output', 'stop', 'stop_all'], description: 'list: show running processes. output: get stdout/stderr of a process. stop: kill a process by PID. stop_all: kill all background processes.' }, pid: { type: 'number', description: 'Process ID (required for output and stop actions)' }, tail: { type: 'number', description: 'Number of last lines to return for output (default 50)' } }, required: ['action'] } } },
    { type: 'function', function: { name: 'ask_user', description: 'Ask the user a question to get clarification or make a decision. Use when you need user input to proceed. Supports free text or multiple choice.', parameters: { type: 'object', properties: { question: { type: 'string', description: 'The question to ask the user' }, options: { type: 'array', items: { type: 'string' }, description: 'Optional multiple choice options. If provided, user can select one. If omitted, user can type free text.' }, context: { type: 'string', description: 'Optional context or explanation for why you are asking' } }, required: ['question'] } } },
    { type: 'function', function: { name: 'undo_edit', description: 'Manage file edit backups. List recent AI file changes, view diffs, and restore previous versions. Use action="list" to see history, action="restore" to rollback, action="diff" to compare versions.', parameters: { type: 'object', properties: { action: { type: 'string', enum: ['list', 'restore', 'diff', 'session'], description: 'list: show backup history. restore: rollback to a backup. diff: compare backup with current. session: show session summary.' }, backup_id: { type: 'string', description: 'Backup ID (required for restore and diff actions)' }, file_path: { type: 'string', description: 'Filter backups by file path (optional for list)' } }, required: ['action'] } } },
    { type: 'function', function: { name: 'view_history', description: 'View change history and audit log. Track all AI file modifications, tool executions, and session activity.', parameters: { type: 'object', properties: { action: { type: 'string', enum: ['changes', 'audit', 'summary'], description: 'changes: file modification history. audit: tool execution log. summary: session statistics.' }, file_path: { type: 'string', description: 'Filter changes by file path (optional)' }, tool_name: { type: 'string', description: 'Filter by tool name (optional)' }, limit: { type: 'number', description: 'Max results to return (default 20)' } }, required: ['action'] } } },
    { type: 'function', function: { name: 'validate_code', description: 'Validate code syntax before writing. Checks JS/TS/JSON/CSS/HTML for syntax errors. Use before large file writes to catch errors early.', parameters: { type: 'object', properties: { content: { type: 'string', description: 'The code content to validate' }, file_path: { type: 'string', description: 'File path (used to determine language for validation)' } }, required: ['content', 'file_path'] } } },
    { type: 'function', function: { name: 'build_index', description: 'Build a searchable index of the codebase. Must be called before semantic_search. Indexes all code files in the directory for fast semantic search.', parameters: { type: 'object', properties: { root_dir: { type: 'string', description: 'Absolute path to the root directory to index' } }, required: ['root_dir'] } } },
    { type: 'function', function: { name: 'semantic_search', description: 'Search the codebase using natural language queries. Finds files by meaning, not just keywords. Requires build_index to be called first. Use for queries like "find authentication code", "where is the database connection", "error handling logic".', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Natural language search query describing what you are looking for' }, root_dir: { type: 'string', description: 'Limit search to this directory (optional)' }, max_results: { type: 'number', description: 'Maximum results to return (default 10)' } }, required: ['query'] } } },
    { type: 'function', function: { name: 'index_stats', description: 'Get statistics about the current code index (number of files, tokens, memory usage).', parameters: { type: 'object', properties: {} } } },
];

let _pluginManager = null;
function _getPluginTools() {
    try {
        if (!_pluginManager) _pluginManager = getPluginManager();
        return _pluginManager.getTools();
    } catch (e) { return []; }
}

function _getPluginDisplayNames() {
    try {
        if (!_pluginManager) _pluginManager = getPluginManager();
        return _pluginManager.getToolDisplayNames();
    } catch (e) { return {}; }
}

function _getPluginRisks() {
    try {
        if (!_pluginManager) _pluginManager = getPluginManager();
        return _pluginManager.getToolRisks();
    } catch (e) { return {}; }
}

function _getPluginPromptExtensions() {
    try {
        if (!_pluginManager) _pluginManager = getPluginManager();
        return _pluginManager.getPromptExtensions();
    } catch (e) { return []; }
}

function _isPluginTool(name) {
    try {
        if (!_pluginManager) _pluginManager = getPluginManager();
        return _pluginManager.isPluginTool(name);
    } catch (e) { return false; }
}

function _getAllTools() {
    return [...AI_TOOLS, ..._getPluginTools()];
}

const toolDescriptions = AI_TOOLS.map(t => `- ${t.function.name}: ${t.function.description}`).join('\n');

const TOOL_RISK = {
    str_replace_based_edit_tool: 'safe', json_edit_tool: 'safe', ckg: 'safe',
    sequential_thinking: 'safe', attempt_completion: 'safe',
    bash: 'moderate', update_todo_list: 'safe',
    sub_agent_dispatch: 'safe', start_preview: 'safe', manage_processes: 'safe',
    ask_user: 'safe',
    undo_edit: 'safe',
    view_history: 'safe',
    validate_code: 'safe',
    build_index: 'safe',
    semantic_search: 'safe',
    index_stats: 'safe',
    search_mods: 'safe', get_installed_mods: 'safe', get_system_info: 'safe',
    get_versions: 'safe', get_game_status: 'safe', get_mod_details: 'safe',
    browse_directory: 'safe', read_file: 'safe', get_game_log: 'safe',
    diagnose_crash: 'safe', install_progress: 'safe', web_search: 'safe',
    get_current_context: 'safe', search_modpacks: 'safe', install_version: 'moderate',
    install_mod: 'moderate', toggle_mod: 'moderate', install_loader: 'moderate',
    install_modpack: 'moderate', launch_game: 'dangerous', stop_game: 'dangerous',
    manage_settings: 'dangerous', write_file: 'dangerous', edit_file: 'dangerous',
    execute_command: 'dangerous', grep_search: 'safe', glob_search: 'safe',
    web_fetch: 'safe', web_search_general: 'safe', todo_write: 'safe',
    manage_core_memory: 'safe', agent: 'moderate', translate_mod: 'moderate',
    download_cfpa_pack: 'safe', explore_environment: 'safe', select_version: 'safe',
    mcp_tool: 'safe'
};

const PLAN_BLOCKED_TOOLS = new Set([
    'write_file', 'edit_file', 'bash', 'execute_command',
    'install_mod', 'toggle_mod', 'install_version', 'install_loader',
    'launch_game', 'stop_game', 'manage_settings', 'translate_mod',
    'install_modpack', 'agent', 'str_replace_based_edit_tool',
    'json_edit_tool', 'download_cfpa_pack', 'start_preview',
    'manage_processes', 'undo_edit', 'add_download_task'
]);

const TOOL_DISPLAY_NAMES = {
    bash: '执行命令', str_replace_based_edit_tool: '编辑文件',
    json_edit_tool: '编辑JSON', sequential_thinking: '分步思考',
    attempt_completion: '完成任务', ckg: '代码图谱',
    update_todo_list: '更新计划',
    sub_agent_dispatch: '派遣子代理',
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

const DANGEROUS_CMD_PATTERNS = [
    { pattern: /\brm\s+(-[a-zA-Z]*[rf]|-[a-zA-Z]*f[a-zA-Z]*r)\s+[\/~*]/i, label: '递归删除根目录/主目录/通配符' },
    { pattern: /\brm\s+(-[a-zA-Z]*[rf]|-[a-zA-Z]*f[a-zA-Z]*r)\s+\/(?:\s|$)/, label: '递归删除根目录' },
    { pattern: /\brm\s+(-[a-zA-Z]*[rf]|-[a-zA-Z]*f[a-zA-Z]*r)\s+~(?:\s|$)/, label: '递归删除用户主目录' },
    { pattern: /\brm\s+(-[a-zA-Z]*[rf]|-[a-zA-Z]*f[a-zA-Z]*r)\s+\*(?:\s|$)/, label: '递归删除所有文件' },
    { pattern: /\bsudo\s+rm\b/i, label: 'sudo 提权删除' },
    { pattern: /\bsudo\s+mv\s+\//i, label: 'sudo 移动根目录文件' },
    { pattern: /\bchmod\s+777\s+\//i, label: '开放根目录权限' },
    { pattern: /\bformat\s+[a-zA-Z]:/i, label: '格式化磁盘' },
    { pattern: /\bdel\s+\/[sS]\b/, label: '递归删除文件' },
    { pattern: /\brd\s+\/[sS]\b/, label: '递归删除目录' },
    { pattern: /\brmdir\s+\/[sS]\b/i, label: '递归删除目录' },
    { pattern: /\bmkfs\b/i, label: '创建文件系统（格式化）' },
    { pattern: /\bdd\s+.*of=\/dev\//i, label: 'dd 写入设备' },
    { pattern: />\s*\/dev\/sd[a-z]/i, label: '重定向到磁盘设备' },
    { pattern: /\bshutdown\b|\breboot\b|\binit\s+0\b/i, label: '关机/重启系统' },
    { pattern: /\bkill\s+-9\s+1\b|\bkillall\b/i, label: '强制终止进程' },
    { pattern: /\breg\s+delete\b/i, label: '删除注册表项' },
    { pattern: /\bnet\s+user\s+.*\/delete\b/i, label: '删除系统用户' },
    { pattern: /\bTakeown\b|\bicacls\b.*\/grant\b/i, label: '修改系统文件权限' },
];

const SYSTEM_DIR_PATTERNS = [
    /(?:^|\s)(?:rm|del|rd|rmdir|mv|move|copy|xcopy)\s+[^\s]*(?:C:\\Windows|C:\\Program\s*Files|\/etc|\/usr|\/bin|\/sbin|\/var|\/boot|\/lib|\/sys|\/proc)/i,
    /(?:^|\s)(?:chmod|chown|chgrp)\s+[^\s]*(?:\/etc|\/usr|\/bin|\/sbin|\/var|\/boot|\/lib)/i,
];

function _isDangerousCommand(command) {
    if (!command || typeof command !== 'string') return null;
    const trimmed = command.trim();
    for (const { pattern, label } of DANGEROUS_CMD_PATTERNS) {
        if (pattern.test(trimmed)) return { dangerous: true, reason: label, pattern: pattern.source };
    }
    for (const pattern of SYSTEM_DIR_PATTERNS) {
        if (pattern.test(trimmed)) return { dangerous: true, reason: '修改系统目录', pattern: pattern.source };
    }
    return null;
}

const AGENT_META = {
    file_search: {
        name: '文件搜索代理', role: 'File Search', avatar: 'robot', color: '#4caf50',
        systemPrompt: `你是 VersePC 项目的文件搜索代理。你的任务是在代码库中快速定位文件和目录。

## 工作流程
1. 首先理解搜索目标（文件名、关键词、文件类型等）
2. 使用 bash 工具执行搜索命令：
   - 按文件名搜索: find . -name "pattern" -type f
   - 按内容搜索: grep -r "pattern" --include="*.js" --include="*.css" --include="*.html" -l
   - 查看目录结构: ls -la, tree (限制深度)
   - 查看文件信息: wc -l, file, stat
3. 对搜索结果进行筛选和排序
4. 输出结构化结果

## 输出格式
搜索完成后，用以下格式总结：
- 搜索目标：xxx
- 找到 N 个文件
- 关键文件列表（路径 + 用途说明）
- 相关代码片段（如有）

## 注意事项
- 优先搜索项目根目录下的 js/、css/、agent-engine.js 等核心文件
- 搜索时排除 node_modules、dist、.git 目录
- 如果搜索结果过多，按相关性排序，只展示最相关的
- 用中文输出结果`
    },
    code_analysis: {
        name: '代码分析代理', role: 'Code Analysis', avatar: 'robot', color: '#9c27b0',
        systemPrompt: `你是 VersePC 项目的代码分析代理。你的任务是分析代码结构、理解项目架构、追踪函数调用链。

## 工作流程
1. 首先确定分析目标（文件、函数、模块）
2. 使用 bash 工具阅读代码：
   - cat 查看文件内容
   - grep 搜索函数调用
   - find 查找相关文件
3. 分析代码结构和依赖关系
4. 输出分析报告

## 分析维度
- 文件职责：该文件的主要功能
- 依赖关系：依赖了哪些模块，被哪些模块依赖
- 函数调用链：关键函数的调用路径
- 数据流：数据如何在模块间传递
- 潜在问题：发现的 bug、性能问题、代码异味

## 输出格式
分析完成后，用以下格式总结：
- 分析目标：xxx
- 文件结构：列出相关文件及其职责
- 核心逻辑：关键函数和调用链
- 发现的问题（如有）：问题描述 + 建议修复方案

## 注意事项
- 用中文输出分析结果
- 代码片段保留原始格式
- 行号引用格式：文件名:行号`
    },
    resource_download: {
        name: '资源搜索代理', role: 'Resource Search', avatar: 'robot', color: '#8d6e63',
        systemPrompt: `你是 Minecraft 资源搜索代理。你的任务是搜索和推荐 Minecraft 相关资源。

## 支持的资源类型
- Mod（模组）
- 整合包（Modpack）
- 材质包（Texture Pack）
- 光影包（Shader Pack）

## 工作流程
1. 理解用户需求（版本、类型、功能偏好）
2. 搜索 CurseForge 和 Modrinth 上的资源
3. 筛选和推荐

## 推荐标准
- 版本兼容性：优先推荐与用户 Minecraft 版本兼容的资源
- 稳定性：优先推荐更新频繁、bug 少的资源
- 下载量和评分：作为参考指标
- 兼容性：推荐的资源之间不要有冲突

## 输出格式
- 资源名称 + 简介
- 版本兼容信息
- 下载量/评分
- 安装建议
- 注意事项（如有）

## 注意事项
- 用中文输出推荐结果
- 如果资源需要前置依赖，一并说明`
    },
    crash_analysis: {
        name: '崩溃分析代理', role: 'Crash Analysis', avatar: 'robot', color: '#9e9e9e',
        systemPrompt: `你是 Minecraft 崩溃分析代理。你的任务是分析崩溃日志，定位错误原因并提供修复建议。

## 工作流程
1. 定位日志文件（crash-reports/、logs/ 目录）
2. 使用 bash 工具读取和分析日志
3. 识别崩溃类型和原因
4. 提供修复建议

## 崩溃类型识别
- Mod 冲突：检查多个 Mod 的兼容性
- 内存不足：检查 JVM 参数和内存分配
- 配置错误：检查配置文件格式和值
- 版本不兼容：检查 Mod 与 Minecraft 版本的兼容性
- 驱动问题：检查显卡驱动版本
- Java 版本：检查 Java 版本是否匹配

## 输出格式
- 崩溃类型：xxx
- 错误原因：详细描述
- 涉及文件：相关日志文件和配置文件
- 修复步骤：按优先级排列的修复方案
- 预防建议：避免再次发生的方法

## 注意事项
- 用中文输出分析结果
- 引用关键日志行（文件:行号）
- 修复步骤要具体可操作`
    },
    code_completion: {
        name: '代码补全代理', role: 'Code Completion', avatar: 'robot', color: '#00bcd4',
        systemPrompt: `你是 VersePC 项目的代码补全代理。你的任务是代码重写、优化、补全和重构。

## 工作流程
1. 阅读并理解目标代码的上下文和意图
2. 分析代码结构、变量作用域、依赖关系
3. 生成高质量的补全/优化代码
4. 验证生成的代码语法正确性

## 支持的任务类型
- 代码补全：根据上下文补全未完成的代码
- 代码重写：重构现有代码以提升可读性或性能
- 代码优化：优化算法、减少冗余、提升效率
- 模式匹配：按照项目现有代码风格生成新代码

## 输出格式
- 原始代码（简要引用）
- 修改后的完整代码
- 修改说明：改了什么、为什么改
- 影响范围：可能受影响的文件和函数

## 注意事项
- 用中文输出说明，代码本身保持原语言
- 保持与项目现有代码风格一致
- 不要引入项目中未使用的新依赖
- 代码片段保留原始缩进格式`
    },
    explore: {
        name: 'Explorer Agent', role: 'Exploration', avatar: 'robot', color: '#ff9800',
        systemPrompt: `你是 VersePC 项目的代码探索代理。你的任务是快速扫描和映射代码库结构。

## 工作流程
1. 确认项目根目录，读取 README/配置文件了解项目结构
2. 使用只读工具快速定位关键文件和函数
3. 映射模块间的依赖关系
4. 返回结构化的发现

## 输出格式
SUMMARY: 一段话总结探索结果
CHANGES: 无（只读代理）
EVIDENCE: 关键发现列表，每个包含 path:line-range 和描述
RISKS: 可能遗漏的区域或需要注意的地方
BLOCKERS: 无（如果完成）或阻碍探索的因素

## 注意事项
- 只使用只读工具（read_file, grep_search, glob_search, browse_directory, bash 中的 ls/cat/find/grep）
- 不要修改任何文件
- 优先搜索核心文件和入口点
- 用中文输出结果`
    },
    review: {
        name: 'Review Agent', role: 'Code Review', avatar: 'robot', color: '#e91e63',
        systemPrompt: `你是 VersePC 项目的代码审查代理。你的任务是审查代码变更，找出问题并给出修复建议。

## 工作流程
1. 阅读目标代码文件
2. 分析代码质量、潜在问题、安全风险
3. 对每个发现的问题给出严重性评分（1-10）
4. 提供具体的修复建议

## 输出格式
SUMMARY: 审查结论概要
CHANGES: 无（只读代理）
EVIDENCE: 问题列表，每个包含：严重性评分（1-10）、文件路径:行号、问题描述、修复建议
RISKS: 审查中发现的潜在风险
BLOCKERS: 无法审查的部分或缺失的信息

## 注意事项
- 只使用只读工具
- 不要修改任何文件
- 严重性评分标准：1-3 低、4-6 中、7-9 高、10 严重
- 关注：代码异味、潜在 bug、安全漏洞、性能问题、可维护性
- 用中文输出结果`
    },
    verifier: {
        name: 'Verifier Agent', role: 'Verification', avatar: 'robot', color: '#009688',
        systemPrompt: `你是 VersePC 项目的验证代理。你的任务是运行测试和检查，验证操作结果是否正确。

## 工作流程
1. 确定验证目标和验证方法
2. 使用 bash 执行检查命令
3. 使用 read_file 检查文件内容和格式
4. 报告明确的 pass/fail 结果

## 输出格式
SUMMARY: 验证结果概要（通过/失败）
CHANGES: 无（验证代理）
EVIDENCE: 测试结果列表，每个包含：检查名称、pass/fail、输出摘要
RISKS: 验证未覆盖的区域
BLOCKERS: 无法执行的检查或缺失的依赖

## 注意事项
- 不要修改代码，只做验证
- 每个检查项必须有明确的 pass 或 fail 结果
- 失败的检查要提供详细的错误信息
- 用中文输出结果`
    }
};



// =============================================================================
// HTTP API 工具
// =============================================================================

function makeApiStreamRequest(apiUrl, bodyStr, headers) {
    const options = {
        hostname: apiUrl.hostname,
        path: apiUrl.pathname + (apiUrl.search || ''),
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr), 'Connection': 'close' },
        agent: false
    };
    const proto = apiUrl.protocol === 'https:' ? https : http;
    return new Promise((resolve, reject) => {
        const req = proto.request(options, (res) => {
            if (res.statusCode >= 400) {
                let errData = '';
                res.on('data', chunk => errData += chunk);
                res.on('end', () => {
                    let errMsg = `HTTP ${res.statusCode}`;
                    try {
                        const parsed = JSON.parse(errData);
                        errMsg = parsed.error?.message || parsed.error?.code || parsed.message || errMsg;
                    } catch (e) {}
                    reject(new Error(errMsg));
                });
                return;
            }
            resolve(res);
        });
        req.on('error', reject);
        req.setTimeout(60000, () => { req.destroy(); reject(new Error('API连接超时(60s)')); });
        req.write(bodyStr);
        req.end();
    });
}

function makeApiRequest(apiUrl, bodyStr, headers) {
    const options = {
        hostname: apiUrl.hostname,
        path: apiUrl.pathname + (apiUrl.search || ''),
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr), 'Connection': 'close' },
        agent: false
    };
    const proto = apiUrl.protocol === 'https:' ? https : http;
    return new Promise((resolve, reject) => {
        const req = proto.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    let errMsg = `HTTP ${res.statusCode}`;
                    try {
                        const parsed = JSON.parse(data);
                        errMsg = parsed.error?.message || parsed.error?.code || parsed.message || errMsg;
                    } catch (e) {}
                    reject(new Error(errMsg));
                    return;
                }
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error) {
                        reject(new Error(parsed.error.message || parsed.error.code || JSON.stringify(parsed.error)));
                        return;
                    }
                    resolve(parsed.choices?.[0]?.message?.content || '');
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('API请求超时(30s)')); });
        req.write(bodyStr);
        req.end();
    });
}

// =============================================================================
// Agent Engine (全功能)
// =============================================================================

class AgentEngine {
    constructor(options = {}) {
        this.onChunk = options.onChunk || (() => {});
        this.onRequestApproval = options.onRequestApproval || null;
        this.onAskUser = options.onAskUser || null;
        this.executeTool = options.executeTool || null;
        this.output = new OutputManager();

        this.enablePlanning = options.enablePlanning !== false;
        this.enableReflection = options.enableReflection !== false;
        this.enableStuckDetection = options.enableStuckDetection !== false;
        this.enablePassiveDetection = options.enablePassiveDetection !== false;
        this.maxRounds = options.maxRounds || 24;
        this.maxConsecutiveFailures = options.maxConsecutiveFailures || 3;
        this.maxPassiveDetections = options.maxPassiveDetections || 2;
        this.maxRepeatText = options.maxRepeatText || 2;

        this._aborted = false;
        this._actionHistory = [];
        this._lastTextContent = '';
        this._repeatTextCount = 0;
        this._consecutiveFailures = 0;
        this._consecutiveMistakes = 0;
        this._passiveDetectionCount = 0;
        this._activePlan = null;
        this._planStepResults = {};
        this._provider = options.provider || null;
        this._apiUrl = options.apiUrl || null;
        this._apiHeaders = options.apiHeaders || null;
        this._model = options.model || null;

        this._sessionId = null;
        this._turnId = null;
        this._snapshots = [];
        this._toolAuditLog = [];
        this._sessionUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 };
        this._lastRequestContext = null;
        this._currentMode = options.currentMode || 'agent';
        this._approvalMode = options.approvalMode || 'suggest';
        this._subAgentModels = options.subAgentModels || {};
    }

    abort() {
        this._aborted = true;
    }

    _createSnapshot(filePath, toolName) {
        try {
            if (!filePath || typeof filePath !== 'string') return null;
            if (!fs.existsSync(filePath)) return null;
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) return null;
            const content = fs.readFileSync(filePath, 'utf-8');
            const snapshotDir = path.join(os.homedir(), '.versepc', 'snapshots');
            const sessionId = this._sessionId || 'default';
            const turnId = this._turnId || Date.now().toString(36);
            const turnDir = path.join(snapshotDir, sessionId, turnId);
            fs.mkdirSync(turnDir, { recursive: true });
            const safeName = filePath.replace(/[\\\/:]/g, '_').replace(/^_+/, '');
            const ts = Date.now();
            const backupFileName = `${safeName}_${ts}.bak`;
            const backupPath = path.join(turnDir, backupFileName);
            fs.writeFileSync(backupPath, content, 'utf-8');
            const meta = {
                id: `${sessionId}_${turnId}_${ts}`,
                sessionId,
                turnId,
                originalPath: filePath,
                backupPath,
                toolName,
                timestamp: ts,
                size: stat.size,
                lines: content.split('\n').length,
                restored: false
            };
            fs.writeFileSync(backupPath + '.json', JSON.stringify(meta, null, 2), 'utf-8');
            this._snapshots.push(meta);
            return meta;
        } catch (e) {
            return null;
        }
    }

    _shouldSnapshot(toolName, argsStr) {
        if (toolName === 'str_replace_based_edit_tool') {
            try {
                const args = typeof argsStr === 'string' ? JSON.parse(argsStr) : argsStr;
                return ['str_replace', 'insert', 'create'].includes(args.command);
            } catch (e) { return false; }
        }
        if (toolName === 'bash' || toolName === 'execute_command') {
            try {
                const args = typeof argsStr === 'string' ? JSON.parse(argsStr) : argsStr;
                const cmd = args.command || '';
                return this._detectBashFileOps(cmd).length > 0;
            } catch (e) { return false; }
        }
        if (['write_file', 'edit_file', 'json_edit_tool'].includes(toolName)) return true;
        return false;
    }

    _detectBashFileOps(command) {
        const files = [];
        const trimmed = command.trim();
        const patterns = [
            />\s*"?([^"&|;\s]+)"?/,
            />>\s*"?([^"&|;\s]+)"?/,
            /\b(?:copy|cp)\s+(?:"[^"]+"|\S+)\s+(?:"([^"]+)"|(\S+))/i,
            /\b(?:move|mv)\s+(?:"[^"]+"|\S+)\s+(?:"([^"]+)"|(\S+))/i,
            /\btee\s+(?:"([^"]+)"|(\S+))/,
            /\bsed\s+-i[^\s]*\s+\S+\s+(?:"([^"]+)"|(\S+))/,
        ];
        for (const p of patterns) {
            const m = trimmed.match(p);
            if (m) {
                const f = m[1] || m[2];
                if (f && !f.startsWith('-')) files.push(f);
            }
        }
        return [...new Set(files)];
    }

    _getSnapshotMeta(toolName, argsStr) {
        if (!this._shouldSnapshot(toolName, argsStr)) return null;
        const snapshots = [];
        try {
            const args = typeof argsStr === 'string' ? JSON.parse(argsStr) : argsStr;
            if (toolName === 'str_replace_based_edit_tool') {
                const fp = args.path;
                if (fp) {
                    const meta = this._createSnapshot(fp, toolName);
                    if (meta) snapshots.push(meta);
                }
            } else if (toolName === 'bash' || toolName === 'execute_command') {
                const cmd = args.command || '';
                const files = this._detectBashFileOps(cmd);
                for (const f of files) {
                    const meta = this._createSnapshot(f, toolName);
                    if (meta) snapshots.push(meta);
                }
            } else if (['write_file', 'edit_file', 'json_edit_tool'].includes(toolName)) {
                const fp = args.path || args.file_path;
                if (fp) {
                    const meta = this._createSnapshot(fp, toolName);
                    if (meta) snapshots.push(meta);
                }
            }
        } catch (e) {}
        return snapshots.length > 0 ? snapshots : null;
    }

    restoreSnapshot(snapshotId) {
        try {
            let meta = this._snapshots.find(s => s.id === snapshotId);
            if (!meta) {
                const snapshotDir = path.join(os.homedir(), '.versepc', 'snapshots');
                if (fs.existsSync(snapshotDir)) {
                    const sessionDirs = fs.readdirSync(snapshotDir);
                    for (const sd of sessionDirs) {
                        const sdPath = path.join(snapshotDir, sd);
                        if (!fs.statSync(sdPath).isDirectory()) continue;
                        const turnDirs = fs.readdirSync(sdPath);
                        for (const td of turnDirs) {
                            const tdPath = path.join(sdPath, td);
                            if (!fs.statSync(tdPath).isDirectory()) continue;
                            const jsonFiles = fs.readdirSync(tdPath).filter(f => f.endsWith('.json'));
                            for (const jf of jsonFiles) {
                                try {
                                    const m = JSON.parse(fs.readFileSync(path.join(tdPath, jf), 'utf-8'));
                                    if (m.id === snapshotId) { meta = m; break; }
                                } catch (e) {}
                            }
                            if (meta) break;
                        }
                        if (meta) break;
                    }
                }
            }
            if (!meta) return { error: '快照不存在' };
            if (!fs.existsSync(meta.backupPath)) return { error: '快照文件已被删除' };
            const backupContent = fs.readFileSync(meta.backupPath, 'utf-8');
            const dir = path.dirname(meta.originalPath);
            try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
            fs.writeFileSync(meta.originalPath, backupContent, 'utf-8');
            meta.restored = true;
            try { fs.writeFileSync(meta.backupPath + '.json', JSON.stringify(meta, null, 2), 'utf-8'); } catch (e) {}
            const idx = this._snapshots.findIndex(s => s.id === snapshotId);
            if (idx >= 0) this._snapshots[idx].restored = true;
            return { success: true, restoredPath: meta.originalPath, size: backupContent.length };
        } catch (e) {
            return { error: `恢复失败: ${e.message}` };
        }
    }

    listSnapshots(filePath) {
        try {
            const snapshotDir = path.join(os.homedir(), '.versepc', 'snapshots');
            if (!fs.existsSync(snapshotDir)) return [];
            const results = [];
            const sessionDirs = fs.readdirSync(snapshotDir);
            for (const sd of sessionDirs) {
                const sdPath = path.join(snapshotDir, sd);
                if (!fs.statSync(sdPath).isDirectory()) continue;
                const turnDirs = fs.readdirSync(sdPath);
                for (const td of turnDirs) {
                    const tdPath = path.join(sdPath, td);
                    if (!fs.statSync(tdPath).isDirectory()) continue;
                    const jsonFiles = fs.readdirSync(tdPath).filter(f => f.endsWith('.json'));
                    for (const jf of jsonFiles) {
                        try {
                            const meta = JSON.parse(fs.readFileSync(path.join(tdPath, jf), 'utf-8'));
                            if (filePath && meta.originalPath !== filePath) continue;
                            results.push(meta);
                        } catch (e) {}
                    }
                }
            }
            results.sort((a, b) => b.timestamp - a.timestamp);
            return results.slice(0, 50);
        } catch (e) {
            return [];
        }
    }

    _loadProjectInstructions(projectDir) {
        if (!projectDir) return '';
        const candidates = [
            path.join(projectDir, '.versepc', 'AGENTS.md'),
            path.join(projectDir, 'AGENTS.md'),
            path.join(projectDir, '.versepc', 'VERSEPC.md'),
            path.join(projectDir, 'VERSEPC.md')
        ];
        for (const p of candidates) {
            try {
                if (fs.existsSync(p)) {
                    const content = fs.readFileSync(p, 'utf-8').trim();
                    if (content) return content;
                }
            } catch (_) {}
        }
        return '';
    }

    _send(msg) {
        if (!msg) return;
        const passthroughTypes = ['subagent_start', 'subagent_chunk', 'subagent_end'];
        if (passthroughTypes.includes(msg.type)) {
            this.onChunk(msg);
            return;
        }
        const processed = this.output.processMessage(msg);
        if (processed) {
            this.onChunk(processed);
        }
    }

    _stripSensitiveInfo(msg) {
        if (!msg) return msg;
        let s = String(msg);
        s = s.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
        s = s.replace(/sk-[A-Za-z0-9]{20,}/g, 'sk-[REDACTED]');
        s = s.replace(/sk-ant-[A-Za-z0-9\-]{20,}/g, 'sk-ant-[REDACTED]');
        s = s.replace(/AIzaSy[A-Za-z0-9\-_]{30,}/g, 'AIzaSy[REDACTED]');
        s = s.replace(/x-api-key[:\s]+[A-Za-z0-9\-._~+/]+=*/gi, 'x-api-key: [REDACTED]');
        s = s.replace(/x-goog-api-key[:\s]+[A-Za-z0-9\-._~+/]+=*/gi, 'x-goog-api-key: [REDACTED]');
        if (this._apiKey) {
            try {
                const escaped = this._apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                s = s.replace(new RegExp(escaped, 'g'), '[REDACTED]');
            } catch (e) {}
        }
        return s;
    }

    _buildErrorWithContext(errorMsg) {
        const ctx = this._lastRequestContext || {};
        const cleanMsg = this._stripSensitiveInfo(errorMsg);
        return `API 调用失败\nProvider: ${ctx.provider || '未知'}\nModel: ${ctx.model || '未知'}\nEndpoint: ${ctx.endpoint || '未知'}\n错误: ${cleanMsg}`;
    }

    _initReasoningThrottle() {
        if (this._reasoningFlushTimer) {
            clearTimeout(this._reasoningFlushTimer);
            this._reasoningFlushTimer = null;
        }
        this._reasoningBuffer = null;
        this._reasoningStarted = false;
    }

    _sendReasoningDelta(delta, fullReasoning) {
        if (!this._reasoningStarted) {
            this._reasoningStarted = true;
            this.onChunk({ type: 'reasoning_start', content: '' });
        }
        this._reasoningBuffer = (this._reasoningBuffer || '') + delta;
        if (!this._reasoningFlushTimer) {
            this._reasoningFlushTimer = setTimeout(() => {
                this._reasoningFlushTimer = null;
                if (this._reasoningBuffer) {
                    const buf = this._reasoningBuffer;
                    this._reasoningBuffer = null;
                    this.onChunk({ type: 'reasoning_content', content: buf, partial: true });
                }
            }, 80);
        }
    }

    _flushReasoningThrottle() {
        if (this._reasoningFlushTimer) {
            clearTimeout(this._reasoningFlushTimer);
            this._reasoningFlushTimer = null;
        }
        if (this._reasoningStarted && this._reasoningBuffer) {
            const buf = this._reasoningBuffer;
            this._reasoningBuffer = null;
            this.onChunk({ type: 'reasoning_content', content: buf, partial: true });
        }
    }

    _finishReasoningThrottle() {
        if (this._reasoningFlushTimer) {
            clearTimeout(this._reasoningFlushTimer);
            this._reasoningFlushTimer = null;
        }
        this._reasoningBuffer = null;
        this._reasoningStarted = false;
    }

    /**
     * 主入口：处理聊天
     */
    async processChat({ apiKey, model, messages, temperature, enableTools, apiFormat: customApiFormat, baseUrl: customBaseUrl, language, maxRounds, projectDir }) {
        this._aborted = false;
        this.output.clear();
        this._actionHistory = [];
        this._lastTextContent = '';
        this._repeatTextCount = 0;
        this._consecutiveFailures = 0;
        this._consecutiveMistakes = 0;
        this._passiveDetectionCount = 0;
        this._activePlan = null;
        this._planStepResults = {};
        this._thinkingSteps = [];
        this._noToolsNextRound = false;
        this._toolAuditLog = [];
        this._apiKey = apiKey;
        this._projectDir = projectDir || null;
        this._model = model || 'glm-5-flash';
        this._sessionId = Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
        this._snapshots = [];

        if (!apiKey) {
            this._send({ type: 'say', say: SayType.ERROR, text: '未配置 API Key，请在设置中填写' });
            return;
        }
        if (maxRounds) this.maxRounds = maxRounds;

        let apiFormat;
        let requestModel = this._model;
        if (this._apiUrl && this._apiHeaders && !customBaseUrl) {
            apiFormat = this._provider?.apiFormat || 'openai';
        } else if (customBaseUrl && customApiFormat) {
            const authType = customApiFormat === 'anthropic' ? 'x-api-key' : 'bearer';
            this._provider = { name: 'Custom', baseUrl: customBaseUrl, authType, apiFormat: customApiFormat, thinkingParams: {} };
            const endpoint = buildChatEndpoint(this._provider, this._model, apiKey);
            this._apiUrl = new URL(endpoint.url);
            this._apiHeaders = buildApiHeaders(this._provider, apiKey);
            apiFormat = customApiFormat;
            const customMatch = this._model.match(/^custom:(https?:\/\/.+):(.+)$/);
            if (customMatch) requestModel = customMatch[2];
        } else {
            this._provider = getProviderForModel(this._model);
            const endpoint = buildChatEndpoint(this._provider, this._model, apiKey);
            this._apiUrl = new URL(endpoint.url);
            this._apiHeaders = buildApiHeaders(this._provider, apiKey);
            apiFormat = this._provider.apiFormat || 'openai';
        }
        this._requestModel = requestModel;
        const tools = enableTools !== false ? _getAllTools() : undefined;

        let conversation = [...messages];
        this.conversation = conversation;
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');

        const contextSummary = this._buildContextSummary();
        if (contextSummary) conversation.push({ role: 'system', content: contextSummary });

        conversation.push({ role: 'system', content: `OS: Windows. You can use both CMD and Unix-style commands (git, npm, node, python, pip, npx, etc. all work in the bash tool). Common commands: dir/ls, type/cat, findstr/grep, copy/cp, move/mv, del/rm, mkdir. Use bash tool for all CLI operations including git, npm, python, testing, and formatting.` });

        const pluginPrompts = _getPluginPromptExtensions();
        if (pluginPrompts.length > 0) {
            conversation.push({ role: 'system', content: '## Plugin Capabilities\n\n' + pluginPrompts.join('\n\n') });
        }

        const projectInstructions = this._loadProjectInstructions(this._projectDir);
        if (projectInstructions) {
            conversation.push({ role: 'system', content: '## 项目指令文件\n以下是项目目录下的指令文件内容，请遵循其中的规则：\n\n' + projectInstructions });
        }

        conversation.push({
            role: 'system',
            content: `## 全栈开发能力

你具备完整的全栈开发能力。所有 CLI 操作通过 bash 工具执行。

### 文件操作
- 查看文件：str_replace_based_edit_tool(command="view", path="绝对路径")
- 创建文件：str_replace_based_edit_tool(command="create", path="绝对路径", file_text="内容")
- 编辑文件：str_replace_based_edit_tool(command="str_replace", path="绝对路径", old_str="原文", new_str="新文")
- 写入/覆盖文件：str_replace_based_edit_tool(command="create", ...) 或通过 bash 使用 echo/重定向
- 搜索文件：bash(command="dir /s /b *.js") 或 bash(command="findstr /s /n \"pattern\" *.js")
- 搜索文件内容：bash(command="findstr /s /n \"keyword\" *.*") 

### 版本控制 (Git)
- 查看状态：bash(command="git status")
- 查看差异：bash(command="git diff") 或 bash(command="git diff --cached")
- 提交更改：bash(command="git add . && git commit -m \"message\"")
- 查看日志：bash(command="git log --oneline -20")
- 分支操作：bash(command="git branch") / bash(command="git checkout -b new-branch")
- 合并分支：bash(command="git merge branch-name")

### 包管理
- npm: bash(command="npm install package-name") / bash(command="npm run build") / bash(command="npm test")
- pip: bash(command="pip install package-name") / bash(command="pip list")
- npx: bash(command="npx create-react-app my-app")

### 开发服务器
- 启动开发服务器（后台运行）：bash(command="npm run dev", background=true)
- 启动 HTTP 预览：start_preview(command="start", root="项目目录路径")
- 停止预览：start_preview(command="stop")

### 代码质量
- 运行测试：bash(command="npm test") 或 bash(command="npx jest --verbose")
- 代码检查：bash(command="npx eslint src/") 或 bash(command="npx eslint --fix src/")
- 代码格式化：bash(command="npx prettier --write \"src/**/*.{js,ts,css,json}\"")
- TypeScript 检查：bash(command="npx tsc --noEmit")

### 构建与部署
- 构建项目：bash(command="npm run build")
- 查看构建输出：bash(command="dir dist") 或 bash(command="ls dist")
- 启动生产服务器：bash(command="node server.js", background=true)

### 工作流最佳实践
1. 收到开发任务后，先用 str_replace_based_edit_tool(view) 了解项目结构
2. 使用 update_todo_list 创建任务计划
3. 逐步执行：编辑文件 → 运行测试 → 修复错误 → 提交代码
4. 对于需要长时间运行的服务（dev server、watcher），使用 background=true
5. 完成后用 attempt_completion 提交总结`
        });

        if (this.enablePlanning && lastUserMsg && tools) {
            const intent = this._detectIntent(lastUserMsg.content);
            if (intent.intent === 'complex') {
                const stepHint = intent.steps_needed >= 3
                    ? `这是一个复杂的多步骤任务（检测到 ${intent.steps_needed}+ 个步骤）。`
                    : '这是一个需要多步骤执行的任务。';
                conversation.push({
                    role: 'system',
                    content: `${stepHint}

## 任务工作流

请使用 update_todo_list 工具创建任务计划，将用户的请求分解为具体的、可执行的任务。

### 执行流程
1. 调用 update_todo_list 创建任务列表
   - [ ] 任务1：具体描述
   - [ ] 任务2：具体描述
   - [ ] 任务3：具体描述
2. 逐个执行任务：
   a. 将当前任务标记为 [-] 进行中（调用 update_todo_list）
   b. 执行该任务所需的所有工具调用
   c. 任务完成后，将任务标记为 [x] 已完成（调用 update_todo_list）
3. 所有任务完成后，调用 attempt_completion 提交最终总结

### 关键规则
- 每个任务应该是自包含的，将相关的工具调用归组到一起
- attempt_completion 的 result 字段必须包含清晰的中文总结
- 如果某个任务失败，标记为 [x] 并注明错误，然后继续下一个任务
- 永远不要在回复中使用 emoji

### 子代理派遣规则
当你需要搜索文件、分析代码或分析崩溃日志时，你必须调用 sub_agent_dispatch 工具，而不是自己执行这些任务。
- 搜索文件/目录 → sub_agent_dispatch(agent_type="file_search", task="具体任务描述")
- 分析代码结构 → sub_agent_dispatch(agent_type="code_analysis", task="具体任务描述")
- 分析崩溃日志 → sub_agent_dispatch(agent_type="crash_analysis", task="具体任务描述")
- 代码补全/优化 → sub_agent_dispatch(agent_type="code_completion", task="具体任务描述")

**重要：搜索Minecraft模组/光影包/资源包/材质包/整合包时，绝对不要用 sub_agent_dispatch。必须直接使用内置工具 search_mods 搜索，用 add_download_task 下载。这些内置工具会自动匹配用户已安装的版本和加载器。**

**推荐：使用 agent_type="auto" 可自动选择最合适的子代理类型**，系统会根据任务描述智能匹配。例如：
- sub_agent_dispatch(agent_type="auto", task="在项目中搜索所有配置文件")
- sub_agent_dispatch(agent_type="auto", task="分析这个崩溃日志的错误原因")

绝对不要在文本中写"[执行] 调用子代理"，而是必须实际调用 sub_agent_dispatch 工具。

### 子代理使用场景指南
- **复杂搜索任务** → file_search：查找文件、搜索代码、定位资源
- **代码理解任务** → code_analysis：分析函数调用链、理解模块依赖、代码审查
- **崩溃诊断任务** → crash_analysis：分析崩溃日志、定位错误原因、提供修复建议
- **代码补全任务** → code_completion：代码重写、优化、补全建议

**最佳实践**：对于大多数任务，推荐使用 agent_type="auto"，系统会根据任务描述自动选择最合适的子代理类型。`
                });
            } else {
                conversation.push({
                    role: 'system',
                    content: `## 执行指南

这是一个简短的问候或确认，直接回复即可。

### 执行流程
1. 直接回复用户
2. 如果需要执行操作，使用工具完成

### 关键规则
- 用中文回复
- 如果执行了操作，调用 attempt_completion 提交结果总结
- 永远不要在回复中使用 emoji`
                });
            }
        }

        if (language && language !== 'en') {
            const _langNames = { 'zh-CN': '简体中文', 'zh-TW': '繁體中文', 'ja': '日本語', 'ko': '한국어' };
            const _langName = _langNames[language] || '简体中文';
            conversation.push({
                role: 'system',
                content: `FINAL REMINDER — Language: You MUST respond entirely in ${_langName}. All explanations, todo descriptions, plan text, and completion summaries must be in ${_langName}. Only code, file paths, and technical identifiers stay in English.`
            });
        }

        let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, rounds: 0 };
        let toolResults = [];

        for (let round = 0; round < this.maxRounds; round++) {
            this._turnId = `r${round}_${Date.now().toString(36)}`;
            if (this._aborted) break;
            await new Promise(resolve => setImmediate(resolve));

            if (apiFormat === 'openai') {
                const toRemove = new Set();
                for (let i = 0; i < conversation.length; i++) {
                    const msg = conversation[i];
                    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
                        const expectedIds = new Set(msg.tool_calls.map(tc => tc.id));
                        const foundIds = new Set();
                        for (let j = i + 1; j < conversation.length; j++) {
                            const next = conversation[j];
                            if (next.role === 'assistant') break;
                            if (next.role === 'tool' && expectedIds.has(next.tool_call_id)) {
                                foundIds.add(next.tool_call_id);
                            }
                        }
                        if (foundIds.size < expectedIds.size) {
                            toRemove.add(i);
                            for (let j = i + 1; j < conversation.length; j++) {
                                if (conversation[j].role === 'assistant') break;
                                if (conversation[j].role === 'tool') toRemove.add(j);
                            }
                        }
                    }
                }
                for (let i = conversation.length - 1; i >= 0; i--) {
                    if (toRemove.has(i)) conversation.splice(i, 1);
                }
                for (let i = conversation.length - 1; i >= 0; i--) {
                    if (conversation[i].role === 'tool') {
                        let hasAssistantBefore = false;
                        for (let j = i - 1; j >= 0; j--) {
                            if (conversation[j].role === 'assistant') {
                                hasAssistantBefore = conversation[j].tool_calls && conversation[j].tool_calls.length > 0;
                                break;
                            }
                        }
                        if (!hasAssistantBefore) conversation.splice(i, 1);
                    }
                }
            }

            let bodyStr;
            const hasTools = tools && tools.length > 0 && !this._noToolsNextRound;
            this._noToolsNextRound = false;

            if (apiFormat === 'anthropic') {
                const anthropicMessages = _toAnthropicMessages(conversation);
                const maxOutput = this._provider.maxTokens || 16384;
                const reqBody = {
                    model: this._requestModel,
                    max_tokens: maxOutput,
                    stream: true,
                    ...(anthropicMessages.system ? { system: anthropicMessages.system } : {}),
                    messages: anthropicMessages.messages
                };
                if (hasTools) reqBody.tools = _toAnthropicTools(tools);
                bodyStr = JSON.stringify(reqBody);
            } else if (apiFormat === 'google') {
                const googleMessages = _toGoogleMessages(conversation);
                const maxOutput = this._provider.maxTokens || 16384;
                const reqBody = {
                    ...(googleMessages.system_instruction ? { system_instruction: googleMessages.system_instruction } : {}),
                    contents: googleMessages.contents,
                    generationConfig: { temperature: temperature != null ? temperature : 0.7, maxOutputTokens: maxOutput }
                };
                if (hasTools) reqBody.tools = _toGoogleTools(tools);
                bodyStr = JSON.stringify(reqBody);
            } else {
                const maxOutput = this._provider.maxTokens || 16384;
                const reqBody = {
                    model: this._requestModel,
                    messages: conversation,
                    temperature: temperature != null ? temperature : 0.7,
                    max_tokens: maxOutput,
                    stream: true,
                    stream_options: { include_usage: true }
                };
                if (hasTools) { reqBody.tools = tools; reqBody.tool_choice = 'auto'; }
                if (this._provider.thinkingParams && Object.keys(this._provider.thinkingParams).length > 0) {
                    Object.assign(reqBody, this._provider.thinkingParams);
                }
                if (reqBody.enable_thinking === true) delete reqBody.temperature;
                bodyStr = JSON.stringify(reqBody);
            }

            let res;
            const MAX_RETRIES = 2;
            let lastError = null;
            this._lastRequestContext = {
                provider: this._provider?.name || '未知',
                model: this._requestModel || this._model || '未知',
                endpoint: this._apiUrl ? this._apiUrl.origin + this._apiUrl.pathname : '未知',
                apiFormat: apiFormat || '未知'
            };
            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    this._send({ type: 'say', say: SayType.API_STARTED, text: '' });
                    res = await makeApiStreamRequest(this._apiUrl, bodyStr, this._apiHeaders);
                    lastError = null;
                    break;
                } catch (e) {
                    lastError = e;
                    const isRetryable = e.message && (e.message.includes('ECONNRESET') || e.message.includes('ECONNREFUSED') || e.message.includes('ETIMEDOUT') || e.message.includes('socket hang up'));
                    if (isRetryable && attempt < MAX_RETRIES) {
                        this._send({ type: 'say', say: SayType.HEARTBEAT, text: `连接中断，正在重试 (${attempt + 1}/${MAX_RETRIES})...` });
                        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
                        continue;
                    }
                    this._send({ type: 'say', say: SayType.ERROR, text: this._buildErrorWithContext(e.message) });
                    this._send({ type: 'say', say: SayType.API_FINISHED, text: '' });
                    return;
                }
            }
            if (lastError) {
                this._send({ type: 'say', say: SayType.ERROR, text: this._buildErrorWithContext(lastError.message) });
                this._send({ type: 'say', say: SayType.API_FINISHED, text: '' });
                return;
            }

            const roundData = await this._processStream(res, apiFormat);
            if (this._aborted) break;

            if (roundData.usage) {
                totalUsage.prompt_tokens += roundData.usage.prompt_tokens || 0;
                totalUsage.completion_tokens += roundData.usage.completion_tokens || 0;
                totalUsage.total_tokens += roundData.usage.total_tokens || 0;
                this._sessionUsage.promptTokens = totalUsage.prompt_tokens;
                this._sessionUsage.completionTokens = totalUsage.completion_tokens;
                this._sessionUsage.totalTokens = totalUsage.total_tokens;
                this._sessionUsage.estimatedCost = estimateCost(this._requestModel || this._model, totalUsage.prompt_tokens, totalUsage.completion_tokens);
                this._send({ type: 'usage', usage: { ...this._sessionUsage } });
            }
            totalUsage.rounds++;

            if (roundData.toolCalls.length > 0 && roundData.finishReason === 'tool_calls') {
                const assistantMsg = {
                    role: 'assistant',
                    content: roundData.fullContent || '',
                    tool_calls: roundData.toolCalls.map(tc => ({
                        id: tc.id, type: 'function',
                        function: { name: tc.name, arguments: tc.argsStr }
                    }))
                };
                if (this._provider.thinkingParams && this._provider.thinkingParams.enable_thinking) {
                    assistantMsg.reasoning_content = roundData.fullReasoning || '';
                } else if (roundData.fullReasoning) {
                    assistantMsg.reasoning_content = roundData.fullReasoning;
                }
                conversation.push(assistantMsg);

                const stuckDetected = this.enableStuckDetection && this._detectStuck();
                if (stuckDetected) {
                    this._send({ type: 'say', say: SayType.ERROR, text: '检测到循环调用，已自动中断' });
                    this._send({
                        type: 'say', say: SayType.TOOL_START,
                        text: JSON.stringify(roundData.toolCalls.map(tc => ({
                            id: tc.id, name: tc.name,
                            displayName: TOOL_DISPLAY_NAMES[tc.name] || _getPluginDisplayNames()[tc.name] || tc.name,
                            args: tc.argsStr
                        })))
                    });
                    for (const tc of roundData.toolCalls) {
                        this._send({
                            type: 'say', say: SayType.TOOL_RESULT,
                            text: JSON.stringify({ id: tc.id, name: tc.name, error: '检测到循环调用，已自动中断' })
                        });
                    }
                    this._send({ type: 'say', say: SayType.TOOL_END, text: '' });
                    conversation.push({
                        role: 'system',
                        content: 'AGENT STATE: STUCK — Loop detected. You must try a completely different approach, or call attempt_completion to report current progress and difficulties.'
                    });
                    continue;
                }

                toolResults = await this._executeTools(roundData.toolCalls, lastUserMsg);
                if (this._aborted) break;

                for (const tr of toolResults) {
                    let content = tr.result;
                    if (typeof content === 'string' && content.length > 2000) {
                        content = this._autoSummarizeToolResult(tr.name, content);
                    }
                    conversation.push({
                        role: 'tool',
                        tool_call_id: tr.id,
                        name: tr.name,
                        content
                    });
                }

                await this._evaluateAndGuide(toolResults, conversation, lastUserMsg, round);

                if (toolResults.some(r => r.isCompletion)) break;

                this._compressIfNeeded(conversation);
                continue;
            }

            if (roundData.fullContent && roundData.toolCalls.length === 0) {
                if (this.enablePassiveDetection) {
                    const isPassive = this._detectPassive(roundData.fullContent, lastUserMsg);
                    if (isPassive && this._passiveDetectionCount < this.maxPassiveDetections) {
                        this._passiveDetectionCount++;
                        conversation.push({
                            role: 'system',
                            content: `Your response is too passive. You have tools to autonomously gather information and execute actions. NEVER ask the user for information you can obtain yourself.

Review the user's request. Think about what information you need and which tool can provide it. Call the tool immediately.

Available tools: bash, str_replace_based_edit_tool, json_edit_tool, ckg, sequential_thinking, attempt_completion, update_todo_list.
Take action now. Do not explain your limitations.`
                        });
                        continue;
                    }
                }

                const similarity = this._computeTextSimilarity(roundData.fullContent, this._lastTextContent);
                if (similarity > 0.4 && this._lastTextContent.length > 10) {
                    this._repeatTextCount++;
                    if (this._repeatTextCount >= this.maxRepeatText) {
                        this._send({ type: 'say', say: SayType.COMPLETION, text: '' });
                        return;
                    }
                } else if (this._detectInternalRepetition(roundData.fullContent)) {
                    this._repeatTextCount++;
                    if (this._repeatTextCount >= this.maxRepeatText) {
                        this._send({ type: 'say', say: SayType.COMPLETION, text: '' });
                        return;
                    }
                } else {
                    this._repeatTextCount = 0;
                }
                this._lastTextContent = roundData.fullContent;
            }

            if (roundData.fullContent || roundData.fullReasoning) {
                const finalAssistantMsg = { role: 'assistant', content: roundData.fullContent || '' };
                if (roundData.fullReasoning) finalAssistantMsg.reasoning_content = roundData.fullReasoning;
                conversation.push(finalAssistantMsg);
            }

            const completionFromTool = toolResults.find(r => r.isCompletion);
            let completionText = completionFromTool ? completionFromTool.completionText : '';
            if (!completionText && !roundData.fullContent) {
                completionText = this._generateFallbackSummary(conversation, lastUserMsg);
            }
            let finalText = completionText || roundData.fullContent || '';
            if (roundData.finishReason === 'length') {
                finalText += '\n\n> ⚠️ 输出已达到最大 Token 限制，内容可能被截断。如需继续，请发送"继续"。';
            }
            this._send({ type: 'say', say: SayType.COMPLETION, text: finalText });
            if (totalUsage.total_tokens > 0) {
                this._sessionUsage.estimatedCost = estimateCost(this._requestModel || this._model, this._sessionUsage.promptTokens, this._sessionUsage.completionTokens);
                this._send({ type: 'usage', usage: { ...this._sessionUsage } });
            }
            this._saveToolAuditLog();
            this._send({ type: 'say', say: SayType.API_FINISHED, text: '' });
            return;
        }

        const finalCompletion = toolResults.find(r => r.isCompletion);
        let finalCompletionText = finalCompletion ? finalCompletion.completionText : '';
        if (!finalCompletionText) {
            finalCompletionText = this._generateFallbackSummary(conversation, lastUserMsg);
        }
        this._send({ type: 'say', say: SayType.COMPLETION, text: finalCompletionText });
        if (totalUsage.total_tokens > 0) {
            this._sessionUsage.estimatedCost = estimateCost(this._requestModel || this._model, this._sessionUsage.promptTokens, this._sessionUsage.completionTokens);
            this._send({ type: 'usage', usage: { ...this._sessionUsage } });
        }
        this._saveToolAuditLog();
        this._send({ type: 'say', say: SayType.API_FINISHED, text: '' });
    }
    _generateFallbackSummary(conversation, lastUserMsg) {
        const meaningfulToolNames = new Set();
        let toolCallCount = 0;
        let errorCount = 0;
        const toolResults = [];

        for (const msg of conversation) {
            if (msg.role === 'assistant' && msg.tool_calls) {
                for (const tc of msg.tool_calls) {
                    const name = tc.function?.name || '';
                    if (['update_todo_list', 'sequential_thinking', 'attempt_completion'].includes(name)) continue;
                    meaningfulToolNames.add(name);
                    toolCallCount++;
                }
            }
            if (msg.role === 'tool') {
                const content = msg.content || '';
                if (content.includes('"error"') || content.includes('"status":"error"')) errorCount++;
                toolResults.push({ name: msg.name, content });
            }
        }

        if (meaningfulToolNames.size === 0) return '';

        const lines = [];
        const toolDisplayNames = [...meaningfulToolNames].map(n => TOOL_DISPLAY_NAMES[n] || n);
        const toolSummary = toolDisplayNames.join('、');
        lines.push(`已完成操作：共执行 ${toolCallCount} 次工具调用（${toolSummary}）`);

        const subAgentResults = toolResults.filter(r => r.name === 'sub_agent_dispatch');
        if (subAgentResults.length > 0) {
            for (const sr of subAgentResults) {
                try {
                    const parsed = JSON.parse(sr.content);
                    if (parsed.result) {
                        const resultPreview = parsed.result.length > 200 ? parsed.result.slice(0, 200) + '...' : parsed.result;
                        lines.push(`子代理结果：${resultPreview}`);
                    }
                } catch (e) {}
            }
        }

        const bashResults = toolResults.filter(r => r.name === 'bash' || r.name === 'execute_command');
        const successBash = bashResults.filter(r => !r.content.includes('"error"'));
        if (successBash.length > 0) {
            lines.push(`命令执行：${successBash.length} 个命令执行成功`);
        }

        const fileEdits = toolResults.filter(r => r.name === 'str_replace_based_edit_tool' || r.name === 'json_edit_tool');
        if (fileEdits.length > 0) {
            lines.push(`文件操作：${fileEdits.length} 个文件被修改`);
        }

        if (errorCount > 0) {
            lines.push(`⚠️ 注意：${errorCount} 个操作遇到问题，如需查看详情请追问`);
        }

        return lines.join('\n\n');
    }

    // Context Builder
    // =========================================================================

    _buildContextSummary() {
        try {
            const os = require('os');
            const path = require('path');
            const fs = require('fs');
            const settingsPath = path.join(os.homedir(), '.versepc', 'settings.json');
            if (fs.existsSync(settingsPath)) {
                const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
                let s = '## 当前工作区状态（自动获取，无需询问用户）\n';
                if (settings.selectedVersion) s += `- 当前版本: ${settings.selectedVersion}\n`;
                if (settings.javaPath) s += `- Java路径: ${settings.javaPath}\n`;
                if (settings.maxMemory) s += `- 最大内存: ${settings.maxMemory}\n`;
                if (settings.gameDir) s += `- 游戏目录: ${settings.gameDir}\n`;
                s += '\n以上信息已自动获取。如需更详细的信息（模组列表、版本列表等），请使用工具获取。';
                return s;
            }
        } catch (e) {}
        return null;
    }

    // =========================================================================
    // Intent Detection
    // =========================================================================

    _detectIntent(userMessage) {
        const lower = userMessage.toLowerCase();
        const greetingOnly = /^(你好|hi|hello|hey|谢谢|感谢|ok|好的|知道了|你是谁|你叫什么|你是|说说|聊聊|讲讲)\s*[!！?？。.]*$/i;
        if (greetingOnly.test(lower.trim())) return { intent: 'simple', reason: 'greeting', steps_needed: 0 };
        if (userMessage.trim().length <= 6 && !/(?:安装|创建|修改|删除|修复|配置|写|做|运行|执行|添加|更新)/.test(lower)) return { intent: 'simple', reason: 'short', steps_needed: 0 };

        const explicitMultiStep = /然后|接着|之后再|先.*再|先.*然后|第一步.*第二步|首先.*然后.*最后/;
        if (explicitMultiStep.test(lower)) {
            const conjunctionCount = (lower.match(/然后|接着|之后再|再(?!次)/g) || []).length;
            return { intent: 'complex', reason: 'explicit_multi_step', steps_needed: conjunctionCount + 1 };
        }

        const actionVerbs = /安装|卸载|创建|删除|修改|编辑|配置|部署|构建|编译|调试|修复|优化|迁移|升级|写|做|运行|执行|添加|更新|实现|重构|迁移|集成|生成|重写/;
        const actionMatches = lower.match(new RegExp(actionVerbs.source, 'g'));
        if (actionMatches && actionMatches.length >= 2) {
            return { intent: 'complex', reason: 'multi_action', steps_needed: actionMatches.length };
        }

        return { intent: 'complex', reason: 'general_task', steps_needed: 2 };
    }

    // =========================================================================
    // Stream Processing
    // =========================================================================

    async _processStream(res, apiFormat) {
        if (apiFormat === 'anthropic') return this._processAnthropicStream(res);
        if (apiFormat === 'google') return this._processGoogleStream(res);
        return this._processOpenAIStream(res);
    }

    // OpenAI-compatible SSE
    async _processOpenAIStream(res) {
        let buffer = '';
        let fullContent = '';
        let prevContentLen = 0;
        let fullReasoning = '';
        let prevReasoningLen = 0;
        let toolCalls = [];
        let finishReason = null;
        let reasoningStarted = false;
        let doneReceived = false;
        let usage = null;
        this._initReasoningThrottle();

        await new Promise((resolve) => {
            let inactivityTimer = setTimeout(() => resolve('timeout'), 60000);
            const TOTAL_TIMEOUT = 300000;
            const totalTimer = setTimeout(() => resolve('timeout'), TOTAL_TIMEOUT);
            let finished = false;
            const finish = (reason) => {
                if (finished) return;
                finished = true;
                clearTimeout(inactivityTimer);
                clearTimeout(totalTimer);
                resolve(reason);
            };

            res.on('data', (chunk) => {
                try {
                    clearTimeout(inactivityTimer);
                    inactivityTimer = setTimeout(() => finish('timeout'), 60000);
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || !trimmed.startsWith('data:')) continue;
                        const data = trimmed.slice(5).trim();
                        if (data === '[DONE]') { finishReason = finishReason || 'stop'; doneReceived = true; finish('done'); return; }

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.usage) {
                                usage = { prompt_tokens: parsed.usage.prompt_tokens || 0, completion_tokens: parsed.usage.completion_tokens || 0, total_tokens: parsed.usage.total_tokens || 0 };
                            }
                            const choice = parsed.choices?.[0];
                            if (!choice) continue;

                            const delta = choice.delta;
                            finishReason = choice.finish_reason || finishReason;

                            if (delta?.content) {
                                fullContent += delta.content;
                                this._send({ type: 'say', say: SayType.TEXT, text: fullContent, partial: true });
                            }

                            if (delta?.reasoning_content) {
                                if (!reasoningStarted) reasoningStarted = true;
                                fullReasoning += delta.reasoning_content;
                                this._sendReasoningDelta(delta.reasoning_content, fullReasoning);
                            }

                            if (delta?.tool_calls) {
                                for (const tc of delta.tool_calls) {
                                    const idx = tc.index ?? toolCalls.length;
                                    if (!toolCalls[idx]) {
                                        toolCalls[idx] = { id: tc.id || '', name: '', argsStr: '' };
                                    }
                                    if (tc.id) toolCalls[idx].id = tc.id;
                                    if (tc.function?.name && !toolCalls[idx].name) toolCalls[idx].name = tc.function.name;
                                    if (tc.function?.arguments) toolCalls[idx].argsStr += tc.function.arguments;
                                }
                            }
                        } catch (e) { console.error('[Engine] SSE parse error:', e.message); }
                    }
                } catch (e) { console.error('[Engine] SSE parse error:', e.message); }
            });

            res.on('end', () => { finishReason = finishReason || 'stop'; finish('done'); });
            res.on('error', (err) => { console.error('[Engine] SSE stream error:', err.message); finish('error'); });
        });

        if (!fullContent && fullReasoning) {
            fullContent = fullReasoning;
        }
        if (fullContent) {
            this._send({ type: 'say', say: SayType.TEXT, text: fullContent, partial: false });
        }
        this._finishReasoningThrottle();
        if (reasoningStarted) {
            this.onChunk({ type: 'reasoning_end' });
        }

        return { fullContent, fullReasoning, toolCalls, finishReason: finishReason || 'stop', usage };
    }

    // Anthropic SSE
    async _processAnthropicStream(res) {
        let buffer = '';
        let fullContent = '';
        let prevContentLen = 0;
        let fullReasoning = '';
        let prevReasoningLen = 0;
        let toolCalls = [];
        let finishReason = null;
        let doneReceived = false;
        let usage = null;
        this._initReasoningThrottle();
        let reasoningStarted = false;

        const currentTool = {};
        let activeToolId = null;

        await new Promise((resolve) => {
            const STREAM_TIMEOUT = 60000;
            const STREAM_TOTAL = 300000;
            let inactivityTimer = setTimeout(() => resolve('timeout'), STREAM_TIMEOUT);
            const totalTimer = setTimeout(() => resolve('timeout'), STREAM_TOTAL);
            let finished = false;
            const finish = (reason) => {
                if (finished) return;
                finished = true;
                clearTimeout(inactivityTimer);
                clearTimeout(totalTimer);
                resolve(reason);
            };

            res.on('data', (chunk) => {
                try {
                    clearTimeout(inactivityTimer);
                    inactivityTimer = setTimeout(() => finish('timeout'), STREAM_TIMEOUT);
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || !trimmed.startsWith('data:')) continue;
                        const data = trimmed.slice(5).trim();

                        try {
                            const event = JSON.parse(data);

                            switch (event.type) {
                                case 'message_start': {
                                    if (event.message?.usage) {
                                        const mu = event.message.usage;
                                        if (!usage) usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
                                        usage.prompt_tokens = mu.input_tokens || 0;
                                        usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
                                    }
                                    break;
                                }
                                case 'content_block_start': {
                                    const block = event.content_block;
                                    if (block.type === 'tool_use') {
                                        const id = block.id || ('toolu_' + Math.random().toString(36).slice(2));
                                        currentTool[id] = { id, name: block.name || '', args: {} };
                                        activeToolId = id;
                                    }
                                    break;
                                }
                                case 'content_block_delta': {
                                    const delta = event.delta;
                                    if (delta.type === 'text_delta') {
                                        fullContent += delta.text || '';
                                        this._send({ type: 'say', say: SayType.TEXT, text: fullContent, partial: true });
                                    } else if (delta.type === 'input_json_delta') {
                                        const toolId = activeToolId;
                                        if (toolId && currentTool[toolId]) {
                                            currentTool[toolId].partialJson = (currentTool[toolId].partialJson || '') + (delta.partial_json || '');
                                            try {
                                                currentTool[toolId].args = JSON.parse(currentTool[toolId].partialJson);
                                            } catch (e) { console.error('[Engine] SSE parse error:', e.message); }
                                        }
                                    } else if (delta.type === 'thinking_delta') {
                                        if (!reasoningStarted) reasoningStarted = true;
                                        fullReasoning += delta.thinking || '';
                                        this._sendReasoningDelta(delta.thinking || '', fullReasoning);
                                    } else if (delta.type === 'signature_delta') {
                                    }
                                    break;
                                }
                                case 'content_block_stop': {
                                    for (const [id, toolData] of Object.entries(currentTool)) {
                                        if (toolData.name) {
                                            toolCalls.push({
                                                id: toolData.id,
                                                name: toolData.name,
                                                argsStr: JSON.stringify(toolData.args || {})
                                            });
                                            delete currentTool[id];
                                        }
                                    }
                                    break;
                                }
                                case 'message_delta': {
                                    if (event.delta?.stop_reason === 'end_turn') finishReason = 'stop';
                                    if (event.delta?.stop_reason === 'tool_use') finishReason = 'tool_calls';
                                    if (event.usage) {
                                        if (!usage) usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
                                        usage.completion_tokens = event.usage.output_tokens || 0;
                                        usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
                                    }
                                    break;
                                }
                                case 'message_stop': {
                                    if (!finishReason) finishReason = 'stop';
                                    finish('done');
                                    break;
                                }
                                case 'ping': break;
                            }
                        } catch (e) { console.error('[Engine] SSE parse error:', e.message); }
                    }
                } catch (e) { console.error('[Engine] SSE parse error:', e.message); }
            });

            res.on('end', () => { finishReason = finishReason || 'stop'; finish('done'); });
            res.on('error', (err) => { console.error('[Engine] SSE stream error:', err.message); finish('error'); });
        });

        for (const [id, toolData] of Object.entries(currentTool)) {
            if (toolData.name) {
                toolCalls.push({ id: toolData.id, name: toolData.name, argsStr: JSON.stringify(toolData.args || {}) });
            }
        }

        if (!fullContent && fullReasoning) {
            fullContent = fullReasoning;
        }
        if (fullContent) {
            this._send({ type: 'say', say: SayType.TEXT, text: fullContent, partial: false });
        }
        this._finishReasoningThrottle();
        if (reasoningStarted) {
            this.onChunk({ type: 'reasoning_end' });
        }

        return { fullContent, fullReasoning, toolCalls, finishReason: finishReason || 'stop', usage };
    }

    // Google Gemini SSE
    async _processGoogleStream(res) {
        let buffer = '';
        let fullContent = '';
        let prevContentLen = 0;
        let fullReasoning = '';
        let prevReasoningLen = 0;
        let toolCalls = [];
        let finishReason = null;
        let reasoningStarted = false;
        let usage = null;
        this._initReasoningThrottle();

        await new Promise((resolve) => {
            const STREAM_TIMEOUT = 60000;
            const STREAM_TOTAL = 300000;
            let inactivityTimer = setTimeout(() => resolve('timeout'), STREAM_TIMEOUT);
            const totalTimer = setTimeout(() => resolve('timeout'), STREAM_TOTAL);
            let finished = false;
            const finish = (reason) => {
                if (finished) return;
                finished = true;
                clearTimeout(inactivityTimer);
                clearTimeout(totalTimer);
                resolve(reason);
            };

            res.on('data', (chunk) => {
                try {
                    clearTimeout(inactivityTimer);
                    inactivityTimer = setTimeout(() => finish('timeout'), STREAM_TIMEOUT);
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || !trimmed.startsWith('data:')) continue;
                        const data = trimmed.slice(5).trim();

                        try {
                            const parsed = JSON.parse(data);
                            const candidate = parsed.candidates?.[0];
                            if (!candidate) continue;

                            if (candidate.content?.parts) {
                                for (const part of candidate.content.parts) {
                                    if (part.text) {
                                        fullContent += part.text;
                                        this._send({ type: 'say', say: SayType.TEXT, text: fullContent, partial: true });
                                    }
                                    if (part.thought) {
                                        if (!reasoningStarted) reasoningStarted = true;
                                        fullReasoning += part.thought;
                                        this._sendReasoningDelta(part.thought, fullReasoning);
                                    }
                                    if (part.functionCall) {
                                        toolCalls.push({
                                            id: 'call_' + Math.random().toString(36).slice(2, 10),
                                            name: part.functionCall.name,
                                            argsStr: JSON.stringify(part.functionCall.args || {})
                                        });
                                    }
                                }
                            }

                            if (parsed.usageMetadata) {
                                const um = parsed.usageMetadata;
                                usage = { prompt_tokens: um.promptTokenCount || 0, completion_tokens: um.candidatesTokenCount || 0, total_tokens: um.totalTokenCount || 0 };
                            }

                            if (candidate.finishReason) {
                                const fr = candidate.finishReason;
                                if (fr === 'STOP') finishReason = 'stop';
                                else if (fr === 'TOOL_CALLS' || fr === 'FUNCTION_CALL') finishReason = 'tool_calls';
                                else if (fr === 'MAX_TOKENS') finishReason = 'length';
                                else finishReason = 'stop';
                                if (finishReason) { finish('done'); return; }
                            }
                        } catch (e) { console.error('[Engine] SSE parse error:', e.message); }
                    }
                } catch (e) { console.error('[Engine] SSE parse error:', e.message); }
            });

            res.on('end', () => { finishReason = finishReason || 'stop'; finish('done'); });
            res.on('error', (err) => { console.error('[Engine] SSE stream error:', err.message); finish('error'); });
        });

        if (!fullContent && fullReasoning) {
            fullContent = fullReasoning;
        }
        if (fullContent) {
            this._send({ type: 'say', say: SayType.TEXT, text: fullContent, partial: false });
        }
        this._finishReasoningThrottle();
        if (reasoningStarted) {
            this.onChunk({ type: 'reasoning_end' });
        }

        return { fullContent, fullReasoning, toolCalls, finishReason: finishReason || 'stop', usage };
    }

    // =========================================================================
    // Tool Execution
    // =========================================================================

    async _executeTools(toolCalls, lastUserMsg) {
        if (!this.executeTool) {
            return toolCalls.map(tc => ({ id: tc.id, name: tc.name, result: JSON.stringify({ error: '工具执行未配置' }) }));
        }

        const _snapshotMap = new Map();
        for (const tc of toolCalls) {
            let args = {};
            try { args = JSON.parse(tc.argsStr); } catch (e) {
                args = { _parseError: true, _raw: tc.argsStr, _error: e.message };
            }
            this._actionHistory.push({ name: tc.name, args });
            try {
                const snapMeta = this._getSnapshotMeta(tc.name, tc.argsStr);
                if (snapMeta) _snapshotMap.set(tc.id, snapMeta);
            } catch (e) {}
        }

        this._send({
            type: 'say', say: SayType.TOOL_START,
            text: JSON.stringify(toolCalls.map(tc => ({
                id: tc.id, name: tc.name,
                displayName: TOOL_DISPLAY_NAMES[tc.name] || _getPluginDisplayNames()[tc.name] || tc.name,
                args: tc.argsStr,
                snapshot: _snapshotMap.has(tc.id)
            })))
        });

        const independentCalls = [];
        const dependentCalls = [];

        for (const tc of toolCalls) {
            let args = {};
            try { args = JSON.parse(tc.argsStr); } catch (e) {
                args = { _parseError: true, _raw: tc.argsStr, _error: e.message };
            }

            if (this._activePlan) {
                const planStep = this._activePlan.find(s => s.tool === tc.name);
                if (planStep && planStep.depends_on && planStep.depends_on.length > 0) {
                    for (const depStep of planStep.depends_on) {
                        const depResult = this._planStepResults[depStep];
                        if (depResult) {
                            const argsStr = JSON.stringify(args);
                            const resolved = argsStr.replace(/STEP(\d+)\.result\.(\w+)/g, (_, stepNum, field) => {
                                const stepResult = this._planStepResults[parseInt(stepNum)];
                                return stepResult?.[field] || '';
                            });
                            try { args = JSON.parse(resolved); } catch (e) {}
                        }
                    }
                    dependentCalls.push({ tc, args });
                } else {
                    independentCalls.push({ tc, args });
                }
            } else {
                independentCalls.push({ tc, args });
            }
        }

        const executeOne = async ({ tc, args }) => {
            if (args._parseError) {
                this._send({
                    type: 'say', say: SayType.TOOL_RESULT,
                    text: JSON.stringify({ id: tc.id, name: tc.name, displayName: TOOL_DISPLAY_NAMES[tc.name] || tc.name, result: `JSON 解析失败: ${args._error}\n原始参数: ${args._raw}`, elapsed: 0 })
                });
                return { id: tc.id, name: tc.name, result: JSON.stringify({ status: 'error', error: `JSON 解析失败: ${args._error}` }) };
            }
            if (this._aborted) {
                this._send({
                    type: 'say', say: SayType.TOOL_RESULT,
                    text: JSON.stringify({ id: tc.id, name: tc.name, displayName: TOOL_DISPLAY_NAMES[tc.name] || _getPluginDisplayNames()[tc.name] || tc.name, result: '已中断', elapsed: 0 })
                });
                return { id: tc.id, name: tc.name, result: JSON.stringify({ status: 'aborted' }) };
            }

            let toolRisk = TOOL_RISK[tc.name] || 'moderate';
            if (this._currentMode === 'plan' && PLAN_BLOCKED_TOOLS.has(tc.name)) {
                const blockResult = JSON.stringify({ status: 'blocked', reason: '当前处于 Plan 模式，此工具不可用。请切换到 Agent 或 Developer 模式以使用此工具。' });
                this._send({
                    type: 'say', say: SayType.TOOL_RESULT,
                    text: JSON.stringify({ id: tc.id, name: tc.name, displayName: TOOL_DISPLAY_NAMES[tc.name] || tc.name, result: 'Plan 模式下不可用', elapsed: 0 })
                });
                return { id: tc.id, name: tc.name, result: blockResult };
            }
            if (this._approvalMode === 'auto') {
                toolRisk = 'safe';
            } else if (this._approvalMode === 'never' && toolRisk !== 'safe') {
                const blockResult = JSON.stringify({ status: 'blocked', reason: '当前审批模式为 never，非只读工具被阻止' });
                this._send({
                    type: 'say', say: SayType.TOOL_RESULT,
                    text: JSON.stringify({ id: tc.id, name: tc.name, displayName: TOOL_DISPLAY_NAMES[tc.name] || tc.name, result: '审批模式阻止', elapsed: 0 })
                });
                return { id: tc.id, name: tc.name, result: blockResult };
            }
            let dangerousInfo = null;
            if (tc.name === 'bash') {
                try {
                    let parsed = {};
                    try { parsed = JSON.parse(tc.argsStr); } catch (e) {}
                    const cmd = parsed.command || '';
                    dangerousInfo = _isDangerousCommand(cmd);
                    if (dangerousInfo) toolRisk = 'dangerous';
                } catch (e) {}
            }
            if (toolRisk !== 'safe' && this.onRequestApproval) {
                try {
                    const approval = await this.onRequestApproval(tc.name, tc.argsStr, toolRisk, dangerousInfo);
                    if (approval && approval.approved === false) {
                        const denyResult = JSON.stringify({ status: 'denied', reason: '用户拒绝了此操作' });
                        this._send({
                            type: 'say', say: SayType.TOOL_RESULT,
                            text: JSON.stringify({ id: tc.id, name: tc.name, displayName: TOOL_DISPLAY_NAMES[tc.name] || tc.name, result: '用户拒绝', elapsed: 0 })
                        });
                        return { tc, result: denyResult, elapsed: 0 };
                    }
                } catch (e) {
                    console.error('[AgentEngine] Approval error:', e);
                }
            }

            if (tc.name === 'ask_user') {
                let parsed = {};
                try { parsed = JSON.parse(tc.argsStr); } catch (e) {}
                const question = parsed.question || '';
                const options = parsed.options || null;
                const context = parsed.context || '';
                if (!question) return { id: tc.id, name: tc.name, result: JSON.stringify({ error: '问题不能为空' }) };
                if (this.onAskUser) {
                    try {
                        const answer = await this.onAskUser(question, options, context);
                        return { id: tc.id, name: tc.name, result: JSON.stringify({ status: 'success', answer }) };
                    } catch (e) {
                        return { id: tc.id, name: tc.name, result: JSON.stringify({ error: String(e) }) };
                    }
                }
                return { id: tc.id, name: tc.name, result: JSON.stringify({ status: 'success', answer: '(用户交互不可用)' }) };
            }

            if (tc.name === 'attempt_completion') {
                let parsed = {};
                try { parsed = JSON.parse(tc.argsStr); } catch (e) {}
                const compText = parsed.result || parsed.text || '';
                const compResult = JSON.stringify({ status: 'success', completion: compText });
                this._send({
                    type: 'say', say: SayType.TOOL_RESULT,
                    text: JSON.stringify({ id: tc.id, name: tc.name, displayName: TOOL_DISPLAY_NAMES[tc.name] || _getPluginDisplayNames()[tc.name] || tc.name, result: '任务完成', elapsed: 0 })
                });
                return {
                    id: tc.id, name: tc.name,
                    result: compResult,
                    isCompletion: true,
                    completionText: compText
                };
            }

            if (tc.name === 'update_todo_list') {
                let parsed = {};
                try { parsed = JSON.parse(tc.argsStr); } catch (e) {}
                const todos = parsed.todos || '';
                this._send({
                    type: 'say', say: SayType.TOOL_RESULT,
                    text: JSON.stringify({ id: tc.id, name: tc.name, displayName: TOOL_DISPLAY_NAMES[tc.name] || _getPluginDisplayNames()[tc.name] || tc.name, result: JSON.stringify({ status: 'success', todos }), elapsed: 0 })
                });
                return {
                    id: tc.id, name: tc.name,
                    result: JSON.stringify({ status: 'success', todos })
                };
            }

            if (tc.name === 'sequential_thinking') {
                let parsed = {};
                try { parsed = JSON.parse(tc.argsStr); } catch (e) {}
                this._thinkingSteps = this._thinkingSteps || [];
                const stepData = {
                    thought: parsed.thought || '',
                    thought_number: parsed.thought_number || this._thinkingSteps.length + 1,
                    total_thoughts: parsed.total_thoughts || this._thinkingSteps.length + 1,
                    next_thought_needed: parsed.next_thought_needed !== false,
                    is_revision: parsed.is_revision || false,
                    revises_thought: parsed.revises_thought || null,
                    branch_from_thought: parsed.branch_from_thought || null,
                    branch_id: parsed.branch_id || null,
                };
                this._thinkingSteps.push(stepData);
                this._send({
                    type: 'say', say: SayType.THINKING_STEP,
                    text: JSON.stringify(stepData),
                    partial: false
                });
                const thinkResult = JSON.stringify({ status: 'success', thought_number: stepData.thought_number, message: `Step ${stepData.thought_number} recorded` });
                this._send({
                    type: 'say', say: SayType.TOOL_RESULT,
                    text: JSON.stringify({ id: tc.id, name: tc.name, displayName: TOOL_DISPLAY_NAMES[tc.name] || _getPluginDisplayNames()[tc.name] || tc.name, result: `思考步骤 ${stepData.thought_number}/${stepData.total_thoughts}`, elapsed: 0 })
                });
                return {
                    id: tc.id, name: tc.name,
                    result: thinkResult
                };
            }

            if (tc.name === 'sub_agent_dispatch') {
                const subStartTime = Date.now();
                try {
                    this._send({ type: 'say', say: SayType.TOOL_START, text: JSON.stringify({ id: tc.id, name: tc.name, displayName: TOOL_DISPLAY_NAMES[tc.name], description: `派遣${AGENT_META[args.agent_type]?.name || '子代理'}: ${args.task}` }) });

                    const subResult = await this._executeSubAgent(args.agent_type, args.task);
                    const subElapsed = ((Date.now() - subStartTime) / 1000).toFixed(1);

                    this._send({ type: 'say', say: SayType.TOOL_RESULT, text: JSON.stringify({ id: tc.id, name: tc.name, displayName: TOOL_DISPLAY_NAMES[tc.name], result: subResult, elapsed: subElapsed }) });

                    return { id: tc.id, name: tc.name, result: subResult };
                } catch (e) {
                    const subElapsed = ((Date.now() - subStartTime) / 1000).toFixed(1);
                    this._send({ type: 'say', say: SayType.ERROR, text: `子代理执行失败: ${e.message}` });
                    return { id: tc.id, name: tc.name, result: JSON.stringify({ status: 'error', error: e.message }) };
                }
            }

            if (this._activePlan) {
                const planStep = this._activePlan.find(s => s.tool === tc.name);
                if (planStep) {
                    this._send({
                        type: 'say', say: SayType.PLAN_STEP_UPDATE,
                        text: JSON.stringify({ step: planStep.step, status: 'running' })
                    });
                }
            }

            try {
                const startTime = Date.now();
                const TOOL_EXEC_TIMEOUT = 120000;
                let result;
                const heartbeatTimer = setInterval(() => {
                    this._send({ type: 'say', say: 'heartbeat', text: JSON.stringify({ elapsed: Date.now() - startTime, tool: tc.name }) });
                }, 15000);
                try {
                    if (_isPluginTool(tc.name)) {
                        result = await Promise.race([
                            _pluginManager.executeTool(tc.name, tc.argsStr),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Plugin tool timeout(120s)')), TOOL_EXEC_TIMEOUT))
                        ]);
                    } else {
                        let toolArgs = tc.argsStr;
                        if (tc.name === 'bash' || tc.name === 'execute_command') {
                            try {
                                const parsed = JSON.parse(toolArgs);
                                parsed._streamId = tc.id;
                                toolArgs = JSON.stringify(parsed);
                            } catch (e) {}
                        }
                        result = await Promise.race([
                            this.executeTool(tc.name, toolArgs),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('工具执行超时(120s)')), TOOL_EXEC_TIMEOUT))
                        ]);
                    }
                } finally {
                    clearInterval(heartbeatTimer);
                }
                const elapsed = Date.now() - startTime;
                if (tc.name === 'bash' || tc.name === 'execute_command') {
                    try {
                        const parsed = JSON.parse(result);
                        const errText = (parsed.error || '') + ' ' + (parsed.stderr || '');
                        const nodeMatch = errText.match(/Cannot find module ['"]([^'"]+)['"]/);
                        const pyMatch = errText.match(/ModuleNotFoundError.*?['"]([^'"]+)['"]/);
                        const importMatch = errText.match(/ModuleNotFoundError.*?No module named ['"]([^'"]+)['"]/);
                        if (nodeMatch) {
                            const moduleName = nodeMatch[1].split('/')[0];
                            if (/^[@a-z0-9._/-]+$/i.test(moduleName)) {
                                this._send({ type: 'say', say: SayType.TOOL_START, text: JSON.stringify([{ id: 'auto_install', name: 'bash', displayName: '自动安装依赖', args: `npm install ${moduleName}` }]) });
                                const installResult = await this.executeTool('bash', JSON.stringify({ command: `npm install ${moduleName}` }));
                                this._send({ type: 'say', say: SayType.TOOL_RESULT, text: JSON.stringify({ id: 'auto_install', name: 'bash', result: installResult.substring(0, 500), elapsed: 0 }) });
                            }
                        } else if (pyMatch || importMatch) {
                            const moduleName = (pyMatch || importMatch)[1];
                            if (/^[a-z0-9._-]+$/i.test(moduleName)) {
                                this._send({ type: 'say', say: SayType.TOOL_START, text: JSON.stringify([{ id: 'auto_install', name: 'bash', displayName: '自动安装依赖', args: `pip install ${moduleName}` }]) });
                                const installResult = await this.executeTool('bash', JSON.stringify({ command: `pip install ${moduleName}` }));
                                this._send({ type: 'say', say: SayType.TOOL_RESULT, text: JSON.stringify({ id: 'auto_install', name: 'bash', result: installResult.substring(0, 500), elapsed: 0 }) });
                            }
                        }
                    } catch (e) {}
                }
                const summarized = this._summarizeToolResult(tc.name, result);
                const MAX_RESULT = 3000;
                const trimmed = summarized.length > MAX_RESULT ? summarized.slice(0, MAX_RESULT) + '...[截断]' : summarized;

                const displayResult = trimmed.length > 500 ? trimmed.slice(0, 500) + '...[显示摘要]' : trimmed;
                this._send({
                    type: 'say', say: SayType.TOOL_RESULT,
                    text: JSON.stringify({
                        id: tc.id, name: tc.name,
                        displayName: TOOL_DISPLAY_NAMES[tc.name] || _getPluginDisplayNames()[tc.name] || tc.name,
                        result: displayResult, elapsed,
                        snapshot: _snapshotMap.has(tc.id)
                    })
                });

                if (this._activePlan) {
                    const planStep = this._activePlan.find(s => s.tool === tc.name);
                    if (planStep) {
                        try { this._planStepResults[planStep.step] = JSON.parse(trimmed); } catch (e) {}
                        const hasError = trimmed.includes('"error"') || trimmed.includes('"status":"error"');
                        this._send({
                            type: 'say', say: SayType.PLAN_STEP_UPDATE,
                            text: JSON.stringify({ step: planStep.step, status: hasError ? 'error' : 'done' })
                        });
                    }
                }

                return { id: tc.id, name: tc.name, result: trimmed };
            } catch (e) {
                const errResult = JSON.stringify({ status: 'error', error: e.message, type: 'execution_exception' });
                this._send({
                    type: 'say', say: SayType.TOOL_RESULT,
                    text: JSON.stringify({ id: tc.id, name: tc.name, error: e.message })
                });
                if (this._activePlan) {
                    const planStep = this._activePlan.find(s => s.tool === tc.name);
                    if (planStep) {
                        this._send({
                            type: 'say', say: SayType.PLAN_STEP_UPDATE,
                            text: JSON.stringify({ step: planStep.step, status: 'error' })
                        });
                    }
                }
                return { id: tc.id, name: tc.name, result: errResult };
            }
        };

        const GLOBAL_TIMEOUT = 300000;
        let allResults;
        try {
            const execPromise = (async () => {
                const parallelResults = independentCalls.length > 1
                    ? await Promise.all(independentCalls.map(executeOne))
                    : independentCalls.length === 1
                        ? [await executeOne(independentCalls[0])]
                        : [];

                const results = [...parallelResults];
                for (const depCall of dependentCalls) {
                    if (this._aborted) break;
                    const r = await executeOne(depCall);
                    results.push(r);
                }
                return results;
            })();

            allResults = await Promise.race([
                execPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('工具批次执行超时(90s)')), GLOBAL_TIMEOUT))
            ]);
        } catch (e) {
            allResults = allResults || toolCalls.map(tc => ({
                id: tc.id, name: tc.name,
                result: JSON.stringify({ status: 'error', error: e.message || '执行异常' })
            }));
        }

        if (this._activePlan) {
            const completedSteps = Object.keys(this._planStepResults).length;
            if (completedSteps >= this._activePlan.length) {
                this._send({
                    type: 'say', say: SayType.PLAN_DONE,
                    text: JSON.stringify({ steps: this._activePlan.length })
                });
                this._activePlan = null;
            }
        }

        const tcArgsMap = new Map(toolCalls.map(tc => [tc.id, tc.argsStr]));
        const batchStart = Date.now();
        for (const r of allResults) {
            const resultStr = typeof r.result === 'string' ? r.result : JSON.stringify(r.result || '');
            const hasError = resultStr.includes('"error"') || resultStr.includes('"status":"error"');
            this._toolAuditLog.push({
                timestamp: new Date().toISOString(),
                tool: r.name,
                input_summary: (tcArgsMap.get(r.id) || '').slice(0, 200),
                output_summary: resultStr.slice(0, 200),
                risk: TOOL_RISK[r.name] || 'moderate',
                duration: 0,
                success: !hasError && !r.denied
            });
        }

        this._send({ type: 'say', say: SayType.TOOL_END, text: '' });
        return allResults;
    }

    _saveToolAuditLog() {
        if (this._toolAuditLog.length === 0) return;
        try {
            const logPath = path.join(os.homedir(), '.versepc', 'ai-tool-log.json');
            const existing = [];
            try { existing.push(...JSON.parse(fs.readFileSync(logPath, 'utf-8'))); } catch (_) {}
            const merged = [...existing, ...this._toolAuditLog].slice(-1000);
            fs.writeFileSync(logPath, JSON.stringify(merged, null, 2));
        } catch (e) {}
    }

    // =========================================================================
    // Tool Result Summarization
    // =========================================================================

    _summarizeToolResult(toolName, result) {
        if (!result || typeof result !== 'string') return String(result || '');
        if (result.length <= 2000) return result;

        result = this._compressToolOutput(toolName, result);
        if (result.length <= 2000) return result;

        try {
            const parsed = JSON.parse(result);
            if (parsed.error) {
                const errStr = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
                const kept = { error: errStr.slice(0, 500) };
                if (parsed.success !== undefined) kept.success = parsed.success;
                if (parsed.output) kept.output = typeof parsed.output === 'string' ? this._compressText(parsed.output, 500) : '[output truncated]';
                return JSON.stringify(kept) + '...[summarized]';
            }
            if (parsed.output && typeof parsed.output === 'string') {
                parsed.output = this._compressText(parsed.output, 1200);
                return JSON.stringify(parsed);
            }
            const keys = Object.keys(parsed);
            const summary = {};
            for (const k of keys) {
                const v = parsed[k];
                if (typeof v === 'string' && v.length > 200) summary[k] = v.slice(0, 200) + '...[truncated]';
                else if (Array.isArray(v) && v.length > 5) { summary[k] = v.slice(0, 5); summary[k + '_total'] = v.length; }
                else summary[k] = v;
            }
            return JSON.stringify(summary);
        } catch (e) {
            return this._compressText(result, 1500);
        }
    }

    _autoSummarizeToolResult(toolName, result) {
        if (!result || typeof result !== 'string' || result.length <= 2000) return result;

        try {
            const parsed = JSON.parse(result);
            if (parsed.error) {
                const errStr = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
                const kept = { error: errStr.slice(0, 500) };
                if (parsed.success !== undefined) kept.success = parsed.success;
                if (parsed.output) kept.output = typeof parsed.output === 'string' ? parsed.output.slice(0, 500) : '[output truncated]';
                kept._note = `结果已截断，原长 ${result.length} 字符。如需查看完整结果，请使用 view_history 工具`;
                return JSON.stringify(kept);
            }
            if (parsed.output && typeof parsed.output === 'string' && parsed.output.length > 1000) {
                parsed.output = parsed.output.slice(0, 500) + '\n... [已截断，原长 ' + parsed.output.length + ' 字符]';
                parsed._note = `结果已截断。如需查看完整结果，请使用 view_history 工具`;
                return JSON.stringify(parsed);
            }
            const keys = Object.keys(parsed);
            const summary = {};
            for (const k of keys) {
                const v = parsed[k];
                if (typeof v === 'string' && v.length > 300) summary[k] = v.slice(0, 300) + '...[truncated]';
                else if (Array.isArray(v) && v.length > 5) { summary[k] = v.slice(0, 5); summary[k + '_total'] = v.length; }
                else summary[k] = v;
            }
            summary._note = `结果已截断，原长 ${result.length} 字符。如需查看完整结果，请使用 view_history 工具`;
            return JSON.stringify(summary);
        } catch (e) {
            const head = result.slice(0, 500);
            return head + '\n\n[... 结果已截断，共 ' + result.length + ' 字符。如需查看完整结果，请使用 view_history 工具]';
        }
    }

    _compressToolOutput(toolName, text) {
        const lines = text.split('\n');
        let compressed = lines;

        if (toolName === 'read_file' || toolName === 'str_replace_based_edit_tool') {
            compressed = this._compressCode(lines);
        } else if (toolName === 'grep_search' || toolName === 'search_files' || toolName === 'glob_search') {
            compressed = this._compressSearchResults(lines);
        } else if (toolName === 'bash' || toolName === 'execute_command') {
            compressed = this._compressShellOutput(lines);
        } else if (toolName === 'web_fetch' || toolName === 'web_search' || toolName === 'web_search_general') {
            compressed = this._compressWebContent(lines);
        } else {
            compressed = this._compressGeneric(lines);
        }

        const result = compressed.join('\n');
        return result.length < text.length ? result : text;
    }

    _compressCode(lines) {
        const result = [];
        let blankCount = 0;
        let commentBlock = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) { blankCount++; if (blankCount <= 2) result.push(''); continue; }
            blankCount = 0;
            if (trimmed.startsWith('/*')) commentBlock = true;
            if (commentBlock) { if (trimmed.includes('*/')) commentBlock = false; continue; }
            if (trimmed.startsWith('//') && !trimmed.includes('TODO') && !trimmed.includes('FIXME') && !trimmed.includes('HACK')) continue;
            result.push(line);
        }
        return result;
    }

    _compressSearchResults(lines) {
        const unique = [];
        const seen = new Set();
        for (const line of lines) {
            const key = line.replace(/^\d+[:\-→]\s*/, '').trim();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            unique.push(line);
        }
        return unique;
    }

    _compressShellOutput(lines) {
        const result = [];
        let blankCount = 0;
        let repeatCount = 0;
        let lastLine = '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) { blankCount++; if (blankCount <= 1) result.push(''); continue; }
            blankCount = 0;
            if (trimmed === lastLine) { repeatCount++; continue; }
            if (repeatCount > 0) { result.push(`...[${repeatCount} identical lines]`); repeatCount = 0; }
            lastLine = trimmed;
            if (/^(npm WARN|npm notice|npm ERR!)/i.test(trimmed) && result.some(l => l.includes(trimmed.slice(0, 20)))) continue;
            result.push(line);
        }
        if (repeatCount > 0) result.push(`...[${repeatCount} identical lines]`);
        return result;
    }

    _compressWebContent(lines) {
        const result = [];
        let blankCount = 0;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) { blankCount++; if (blankCount <= 1) result.push(''); continue; }
            blankCount = 0;
            if (/^(Advertisement|Cookie|Sign up|Log in|Subscribe|Newsletter)/i.test(trimmed)) continue;
            if (trimmed.length < 3) continue;
            result.push(line);
        }
        return result;
    }

    _compressGeneric(lines) {
        const result = [];
        let blankCount = 0;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) { blankCount++; if (blankCount <= 1) result.push(''); continue; }
            blankCount = 0;
            result.push(line);
        }
        return result;
    }

    _compressText(text, maxLen) {
        if (text.length <= maxLen) return text;
        const lines = text.split('\n');
        if (lines.length <= 40) return text.slice(0, maxLen) + '...[truncated]';
        const headLines = Math.min(25, Math.floor(lines.length * 0.6));
        const tailLines = Math.min(15, lines.length - headLines);
        const head = lines.slice(0, headLines).join('\n');
        const tail = lines.slice(-tailLines).join('\n');
        const omitted = lines.length - headLines - tailLines;
        return head + '\n...[' + omitted + ' lines omitted]\n' + tail;
    }

    // =========================================================================
    // Stuck Detection
    // =========================================================================

    _detectStuck() {
        if (this._actionHistory.length < 3) return false;
        const recent = this._actionHistory.slice(-8);
        const actionPatterns = recent.map(a => `${a.name}:${JSON.stringify(a.args)}`);

        const patternCounts = {};
        for (const p of actionPatterns) {
            patternCounts[p] = (patternCounts[p] || 0) + 1;
        }
        for (const count of Object.values(patternCounts)) {
            if (count >= 4) return true;
        }

        if (recent.length >= 3) {
            const last3 = recent.slice(-3);
            if (last3.every(a => a.name === last3[0].name && JSON.stringify(a.args) === JSON.stringify(last3[0].args))) {
                return true;
            }
        }

        if (recent.length >= 4) {
            const names = recent.map(a => a.name);
            if (names[0] === names[2] && names[1] === names[3] &&
                JSON.stringify(recent[0].args) === JSON.stringify(recent[2].args)) {
                return true;
            }
        }

        return false;
    }

    // =========================================================================
    // Passive Detection
    // =========================================================================

    _detectPassive(fullContent, lastUserMsg) {
        if (!lastUserMsg) return false;
        const passivePatterns = [
            /我无法/, /我需要.*信息/, /请提供/, /我需要知道/, /你能不能/,
            /请告诉我/, /我需要你/, /请先/, /我需要更多/, /我没办法/,
            /我看不到/, /我访问不了/, /我无法访问/, /我无法查看/, /我没有权限/,
            /I can't/, /I need.*information/, /please provide/, /I need to know/,
            /could you/, /can you please/, /I need you to/, /please tell me/,
            /I don't have access/, /I'm unable to/, /I cannot access/, /I don't have permission/,
            /I can't see/, /I'm not able to/, /would you mind/
        ];
        const isPassive = passivePatterns.some(p => p.test(fullContent));
        if (!isPassive) return false;

        const userContent = typeof lastUserMsg.content === 'string' ? lastUserMsg.content : '';
        const needsTools = /装|安装|启动|停止|搜索|查找|查看|检查|修复|修改|删除|下载|崩溃|日志|配置|设置|版本|模组|整合包|汉化|文件|文件夹|目录|优化|推荐|找|帮|看看|有没有|能不能|怎么|如何|install|search|find|check|fix|modify|delete|download|crash|log|config|setup|version|mod|file|folder|optimize|help|show|list|read|write|create|update|remove/.test(userContent);
        return needsTools;
    }

    // =========================================================================
    // Text Similarity
    // =========================================================================

    _computeTextSimilarity(a, b) {
        if (!a || !b || a.length < 10 || b.length < 10) return 0;
        const getNgrams = (str, n = 4) => {
            const ngrams = new Set();
            for (let i = 0; i <= str.length - n; i++) {
                ngrams.add(str.slice(i, i + n));
            }
            return ngrams;
        };
        const ngramsA = getNgrams(a);
        const ngramsB = getNgrams(b);
        let intersection = 0;
        for (const ng of ngramsA) {
            if (ngramsB.has(ng)) intersection++;
        }
        return intersection / Math.max(ngramsA.size, ngramsB.size);
    }

    _detectInternalRepetition(text) {
        if (!text || text.length < 40) return false;
        const sentences = text.split(/[。！？\n]/).filter(s => s.trim().length > 8);
        if (sentences.length < 3) return false;
        const seen = new Map();
        for (const s of sentences) {
            const key = s.trim().slice(0, 30);
            seen.set(key, (seen.get(key) || 0) + 1);
        }
        for (const count of seen.values()) {
            if (count >= 3) return true;
        }
        const half = Math.floor(sentences.length / 2);
        if (half >= 2) {
            const firstHalf = sentences.slice(0, half).join('');
            const secondHalf = sentences.slice(half).join('');
            if (this._computeTextSimilarity(firstHalf, secondHalf) > 0.5) return true;
        }
        return false;
    }

    // =========================================================================
    // Evaluation & Guidance
    // =========================================================================

    async _evaluateAndGuide(allResults, conversation, lastUserMsg, round) {
        const errorCount = allResults.filter(r => {
            try {
                const p = JSON.parse(r.result);
                return p.status === 'error' || p.error;
            } catch (e) { return false; }
        }).length;
        const successCount = allResults.filter(r => {
            try {
                const p = JSON.parse(r.result);
                return p.status === 'success' || (!p.status && !p.error);
            } catch (e) { return false; }
        }).length;
        const deniedCount = allResults.filter(r => r.denied).length;

        if (errorCount > 0) {
            this._consecutiveMistakes++;
        } else {
            this._consecutiveMistakes = 0;
        }

        if (this._consecutiveMistakes >= 3) {
            conversation.push({
                role: 'system',
                content: 'Tool errors occurred 3 times in a row. You must try a completely different approach, or call attempt_completion to report progress and difficulties.'
            });
            this._consecutiveMistakes = 0;
        }

        if (errorCount > 0 && successCount === 0 && deniedCount === 0) {
            this._consecutiveFailures++;
        } else if (successCount > 0) {
            this._consecutiveFailures = 0;
        }

        if (this._consecutiveFailures >= this.maxConsecutiveFailures) {
            conversation.push({
                role: 'system',
                content: `All tool calls failed for ${this.maxConsecutiveFailures} consecutive rounds. Stop trying the same approach. Call attempt_completion to report what you've done and what difficulties you encountered.`
            });
            this._consecutiveFailures = 0;
        } else if (this._consecutiveFailures >= 2 && errorCount > 0) {
            const failedResult = allResults.find(r => {
                try { const p = JSON.parse(r.result); return p.status === 'error' || p.error; } catch (e) { return false; }
            });
            if (failedResult) {
                try {
                    const goal = typeof lastUserMsg === 'string' ? lastUserMsg : (typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '');
                    const reflection = await this._reflectOnResult(failedResult.name, failedResult.result, goal);
                    if (reflection && reflection.next_action !== 'continue') {
                        let reflGuidance = `[自动反思] 工具 ${failedResult.name} 连续失败。`;
                        reflGuidance += ` 评估: ${reflection.assessment}。`;
                        if (reflection.reasoning) reflGuidance += ` 原因: ${reflection.reasoning}。`;
                        if (reflection.suggestion) reflGuidance += ` 建议: ${reflection.suggestion}。`;
                        if (reflection.next_action === 'retry') reflGuidance += ' 请修正参数后重试。';
                        else if (reflection.next_action === 'alternative') reflGuidance += ' 请尝试完全不同的方法。';
                        else if (reflection.next_action === 'ask_user') reflGuidance += ' 请向用户确认需求。';
                        conversation.push({ role: 'system', content: reflGuidance });
                    }
                } catch (e) { console.error('[Engine] _reflectOnResult error:', e.message); }
            }
        }

        {
            let guidance = '';
            if (successCount > 0 && errorCount === 0 && deniedCount === 0) {
                guidance = 'All tools executed successfully. You MUST now present your findings, progress, or plan to the user in your next text response. Tell the user what you discovered and what the next steps are. Do NOT call attempt_completion yet — wait for user feedback. If you have enough information to proceed with the full task, describe what you will do and ask the user to confirm.';
            } else if (errorCount > 0) {
                guidance = 'Some tools failed. Analyze the error and try a different approach. Do not repeat the same failed action.';
            }
            if (guidance) conversation.push({ role: 'system', content: guidance });
        }

        const askUserCalls = allResults.filter(r => r.name === 'ask_user');
        if (askUserCalls.length > 0) {
            for (const askResult of askUserCalls) {
                try {
                    const parsed = JSON.parse(askResult.result);
                    const answer = (parsed.answer || '').toString().toLowerCase();
                    const versionKeywords = ['版本', 'version', '1.16', '1.17', '1.18', '1.19', '1.20', '1.21', 'fabric', 'forge', 'neoforge', 'vanilla'];
                    const isVersionRelated = versionKeywords.some(kw => answer.includes(kw));
                    if (isVersionRelated) {
                        conversation.push({
                            role: 'system',
                            content: 'DETECTED: You used ask_user to ask about version selection. This is WRONG. You MUST use select_version tool to show a visual version selection card instead. Never use ask_user for version or mod selection. Call select_version now.'
                        });
                    }
                } catch (e) {}
            }
        }

        // ask_user 收到用户回答后，强制模型给用户一个文本回复
        const askUserResult = allResults.find(r => {
            if (r.name !== 'ask_user') return false;
            try {
                const p = JSON.parse(r.result);
                return p.status === 'success' && p.answer && p.answer !== '(用户交互不可用)';
            } catch (e) { return false; }
        });
        if (askUserResult) {
            let userAnswer = '';
            try { userAnswer = (JSON.parse(askUserResult.result).answer || '').toString(); } catch (e) {}
            if (userAnswer.length > 200) userAnswer = userAnswer.slice(0, 200) + '…';
            const lastAssistantAsk = [...conversation].reverse().find(m =>
                m.role === 'assistant' && m.tool_calls && m.tool_calls.some(tc => tc.id === askUserResult.id)
            );
            let askQuestion = '';
            if (lastAssistantAsk) {
                const askTc = lastAssistantAsk.tool_calls.find(tc => tc.id === askUserResult.id);
                if (askTc) {
                    try { askQuestion = (JSON.parse(askTc.function.arguments).question || '').toString(); } catch (e) {}
                }
            }
            if (askQuestion.length > 100) askQuestion = askQuestion.slice(0, 100) + '…';
            conversation.push({
                role: 'system',
                content: `用户已经回答了 ask_user 提问${askQuestion ? `（"${askQuestion}"）` : ''}，回答内容是："${userAnswer}"。你必须现在用一段简短的中文文本回应用户，然后继续执行原本的任务。`
            });
            this._noToolsNextRound = true;
        }

        const askUserVersionResult = allResults.find(r => {
            if (r.name !== 'ask_user') return false;
            try {
                const args = JSON.parse(r.args || '{}');
                const question = (args.question || '').toLowerCase();
                return /版本|version|mod|模组|翻译|translate/i.test(question) && /\d+\.\d+|版本\s*\d|version\s*\d/i.test(question);
            } catch (e) { return false; }
        });
        if (askUserVersionResult) {
            conversation.push({
                role: 'system',
                content: 'You used ask_user to ask about version/mod selection, but you MUST use select_version tool instead to show a visual version selection card. Do NOT use ask_user for version selection. From now on, always use select_version when you need the user to pick a version.'
            });
        }

        if (round >= 2 && this._repeatTextCount > 0) {
            conversation.push({
                role: 'system',
                content: 'Your response is highly repetitive. Do NOT repeat what you already said. Call tools to take action, or call attempt_completion if the task is done.'
            });
        }

        if (round >= 3) {
            conversation.push({
                role: 'system',
                content: 'Multiple rounds have passed. Stop explaining and take action. Call tools to complete the task, or call attempt_completion. Every response must make progress.'
            });
        }
    }

    _selectSubAgentType(task) {
        const taskLower = task.toLowerCase();

        if (/验证|verify|检查|check|测试|test|校验|validate/i.test(task)) {
            return 'verifier';
        }

        if (/审查|review|审计|audit|代码质量|code.?quality/i.test(task)) {
            return 'review';
        }

        if (/探索|explore|映射|map|扫描|scan|项目结构|structure/i.test(task)) {
            return 'explore';
        }

        // Code completion patterns
        if (/补全|completion|fim|ghost.?text|inline.?suggest|代码重写|rewrite|optimize.*code/i.test(task)) {
            return 'code_completion';
        }

        // Crash analysis patterns
        if (/崩溃|crash|日志|log|错误报告|error.?report|异常|exception/i.test(task)) {
            return 'crash_analysis';
        }

        // Resource download patterns
        if (/下载|download|模组|mod|整合包|modpack|资源包|resource.?pack|材质包|shader|光影/i.test(task)) {
            return 'resource_download';
        }

        // Code analysis patterns
        if (/分析|analyze|代码|code|函数|function|类|class|方法|method|架构|architecture|依赖|dependency/i.test(task)) {
            return 'code_analysis';
        }

        // File search patterns (default for search-like tasks)
        if (/搜索|search|查找|find|文件|file|目录|directory|路径|path/i.test(task)) {
            return 'file_search';
        }

        // Default to file_search for unknown tasks
        return 'file_search';
    }

    async _executeSubAgent(agentType, task) {
        // Auto-detect agent type if 'auto' is passed or invalid type
        if (agentType === 'auto' || !AGENT_META[agentType]) {
            agentType = this._selectSubAgentType(task);
        }

        const meta = AGENT_META[agentType];
        if (!meta) return JSON.stringify({ status: 'error', error: `未知子代理类型: ${agentType}` });

        let subModel = this._model;
        if (this._subAgentModels && this._subAgentModels[agentType]) {
            subModel = this._subAgentModels[agentType];
        }

        this._send({ type: 'subagent_start', agentType, name: meta.name, role: meta.role, avatar: meta.avatar, color: meta.color, task });

        const subEngine = new AgentEngine({
            apiKey: this._apiKey,
            model: subModel,
            platform: this._platform,
            provider: this._provider,
            apiUrl: this._apiUrl,
            apiHeaders: this._apiHeaders,
            enableTools: true,
            enablePlanning: false,
            approvalMode: 'auto',
            logger: this.logger,
            onChunk: (chunk) => {
                this._send({ type: 'subagent_chunk', agentType, chunk });
            },
            onRequestApproval: this.onRequestApproval,
            executeTool: this.executeTool,
            currentMode: this._currentMode
        });

        try {
            const messages = [
                { role: 'system', content: meta.systemPrompt },
                { role: 'user', content: task }
            ];

            let result = '';
            await subEngine.processChat({
                apiKey: this._apiKey,
                model: this._model,
                messages,
                temperature: 0.3,
                enableTools: true,
                maxRounds: 8
            });

            const conv = Array.isArray(subEngine.conversation) ? subEngine.conversation : [];
            const lastAssistant = [...conv].reverse().find(m => m.role === 'assistant');
            if (lastAssistant && lastAssistant.content) {
                result = lastAssistant.content;
            } else {
                for (let i = conv.length - 1; i >= 0; i--) {
                    if (conv[i].role === 'tool') {
                        try {
                            const parsed = JSON.parse(conv[i].content);
                            if (parsed.result) { result = parsed.result; break; }
                        } catch (e) {
                            if (conv[i].content && conv[i].content.length > 5) { result = conv[i].content; break; }
                        }
                    }
                }
            }
            if (!result) result = '子代理未返回结果';

            this._send({ type: 'subagent_end', agentType, name: meta.name, result });

            return JSON.stringify({ status: 'completed', agentType, agentName: meta.name, result });
        } catch (e) {
            this._send({ type: 'subagent_end', agentType, name: meta.name, error: e.message });
            return JSON.stringify({ status: 'error', agentType, agentName: meta.name, error: e.message });
        }
    }

    // =========================================================================
    // Reflection
    // =========================================================================

    async _reflectOnResult(toolName, result, goal) {
        try {
            const resultStr = typeof result === 'string' ? result.slice(0, 500) : JSON.stringify(result).slice(0, 500);
            const resp = await makeApiRequest(this._apiUrl, JSON.stringify({
                model: this._requestModel,
                messages: [
                    {
                        role: 'system',
                        content: `评估工具执行结果是否符合预期。只输出JSON，不要其他内容。
输出格式:
{"assessment":"success|partial|failed","next_action":"continue|retry|alternative|ask_user","reasoning":"简短原因","suggestion":"建议的替代方案(如果failed)"}
重要原则：
- 优先选择 retry 或 alternative，尽量自主解决问题
- 只有在确实无法通过工具解决时才选择 ask_user
- 如果是参数错误，选择 retry
- 如果是方法不对，选择 alternative`
                    },
                    { role: 'user', content: `目标: ${goal}\n工具: ${toolName}\n结果: ${resultStr}` }
                ],
                temperature: 0.2,
                stream: false
            }), this._apiHeaders);
            const match = resp.match(/\{[^{}]*\{[\s\S]*?\}[\s\S]*?\}/) || resp.match(/\{[\s\S]*?\}/);
            if (match) return JSON.parse(match[0]);
        } catch (e) {}
        return { assessment: 'success', next_action: 'continue', reasoning: '' };
    }

    // =========================================================================
    // Message Compression
    // =========================================================================

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
    }

    _estimateMessageTokens(msg) {
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
    }

    _getContextBudget(conversation) {
        let modelTokens = 128000;
        try {
            const model = this._model || '';
            if (model.includes('gpt-4o')) modelTokens = 128000;
            else if (model.includes('gpt-4-turbo') || model.includes('gpt-4-1106')) modelTokens = 128000;
            else if (model.includes('gpt-4-32k')) modelTokens = 32000;
            else if (model.includes('gpt-4')) modelTokens = 8192;
            else if (model.includes('gpt-3.5')) modelTokens = 16385;
            else if (model.includes('claude-3.5') || model.includes('claude-sonnet-4') || model.includes('claude-opus-4')) modelTokens = 200000;
            else if (model.includes('claude-3')) modelTokens = 200000;
            else if (model.includes('claude')) modelTokens = 100000;
            else if (model.includes('gemini-1.5')) modelTokens = 1000000;
            else if (model.includes('gemini')) modelTokens = 32000;
            else if (model.includes('deepseek')) modelTokens = 64000;
            else if (model.includes('qwen')) modelTokens = 128000;
        } catch (e) {}
        const reserveForOutput = 4096;
        const reserveForSystem = 8192;
        return Math.max(4000, modelTokens - reserveForOutput - reserveForSystem);
    }

    _scoreMessage(msg, index, total) {
        let score = 0;
        if (msg.role === 'user') score += 100;
        else if (msg.role === 'system') score += 200;
        else if (msg.role === 'assistant') score += 30;
        else if (msg.role === 'tool') score += 20;
        const recency = (index / Math.max(total - 1, 1)) * 50;
        score += recency;
        if (msg.role === 'tool' && typeof msg.content === 'string') {
            if (msg.content.includes('"error"') || msg.content.includes('"error":')) score += 30;
        }
        if (msg.role === 'assistant' && msg.tool_calls) score += 40;
        if (msg.role === 'user' && index === total - 1) score += 200;
        return score;
    }

    _compressIfNeeded(conversation) {
        const budget = this._getContextBudget(conversation);
        let totalTokens = 0;
        for (const msg of conversation) totalTokens += this._estimateMessageTokens(msg);
        if (totalTokens <= budget && conversation.length <= 30) return;

        const systemMsgs = [];
        let systemEnd = 0;
        for (let i = 0; i < conversation.length; i++) {
            if (conversation[i].role === 'system') { systemMsgs.push(conversation[i]); systemEnd = i + 1; }
            else break;
        }
        let systemTokens = 0;
        for (const msg of systemMsgs) systemTokens += this._estimateMessageTokens(msg);
        const availableBudget = budget - systemTokens;
        if (availableBudget < 2000) return;

        const dialogMsgs = conversation.slice(systemEnd);

        const userMsgIndices = [];
        for (let i = 0; i < dialogMsgs.length; i++) {
            if (dialogMsgs[i].role === 'user') userMsgIndices.push(i);
        }

        const TURNS_TO_KEEP = 3;
        const recentUserCount = Math.min(TURNS_TO_KEEP * 2, userMsgIndices.length);
        const cutUserIdx = userMsgIndices.length > recentUserCount
            ? userMsgIndices[userMsgIndices.length - recentUserCount]
            : 0;

        if (cutUserIdx === 0) return;

        const oldMsgs = dialogMsgs.slice(0, cutUserIdx);
        const recentMsgs = dialogMsgs.slice(cutUserIdx);

        let recentTokens = 0;
        for (const msg of recentMsgs) recentTokens += this._estimateMessageTokens(msg);
        while (recentTokens > availableBudget * 0.7 && recentMsgs.length > 4) {
            const removed = recentMsgs.shift();
            recentTokens -= this._estimateMessageTokens(removed);
        }

        if (oldMsgs.length === 0) return;

        const turns = this._extractTurnSummaries(oldMsgs);

        let summary = '[上下文压缩 - 保留最近 ' + TURNS_TO_KEEP + ' 轮对话]\n';
        if (turns.length > 0) {
            summary += '历史对话摘要:\n';
            for (const t of turns) {
                summary += '- ' + t + '\n';
            }
        }

        const usedTools = new Set();
        const errors = [];
        for (const m of oldMsgs) {
            if (m.tool_calls) m.tool_calls.forEach(tc => usedTools.add(tc.function.name));
            if (m.role === 'tool' && typeof m.content === 'string') {
                try {
                    const p = JSON.parse(m.content);
                    if (p.error) errors.push(p.error.slice(0, 80));
                } catch (e) {}
            }
        }
        if (usedTools.size > 0) summary += `已使用工具: ${[...usedTools].join(', ')}\n`;
        if (errors.length > 0) summary += `历史错误: ${errors.slice(-3).join('; ')}\n`;
        summary += `共 ${oldMsgs.length} 条消息已压缩`;

        for (let i = 0; i < oldMsgs.length; i++) {
            const msg = oldMsgs[i];
            if (msg.role === 'tool' && typeof msg.content === 'string' && msg.content.length > 500) {
                msg.content = msg.content.slice(0, 200) + '\n... [已压缩，原长 ' + msg.content.length + ' 字符]';
            }
        }

        const CONTEXT_SYSTEM_PATTERN = /上下文|工作区|当前版本|游戏目录|内存|用户偏好|preference|memory|记忆|Plugin Capabilities|全栈开发能力/;
        const preservedSystemMsgs = oldMsgs.filter(m =>
            m.role === 'system' && typeof m.content === 'string' && CONTEXT_SYSTEM_PATTERN.test(m.content)
        );

        const firstUserMsg = oldMsgs.find(m => m.role === 'user');
        const lastUser = dialogMsgs.filter(m => m.role === 'user').pop();

        const lastAssistantIdx = recentMsgs.length > 0 ? (() => {
            for (let i = recentMsgs.length - 1; i >= 0; i--) {
                if (recentMsgs[i].role === 'assistant') return i;
            }
            return -1;
        })() : -1;

        const compressed = [...systemMsgs];

        for (const pm of preservedSystemMsgs) {
            if (!compressed.some(cm => cm.role === pm.role && cm.content === pm.content)) {
                compressed.push(pm);
            }
        }

        compressed.push({ role: 'system', content: summary });

        if (firstUserMsg && !recentMsgs.includes(firstUserMsg)) {
            compressed.push(firstUserMsg);
        }
        if (lastUser && !recentMsgs.includes(lastUser) && lastUser !== firstUserMsg) {
            compressed.push(lastUser);
        }

        compressed.push(...recentMsgs);

        if (lastAssistantIdx >= 0) {
            const lastAssistant = recentMsgs[lastAssistantIdx];
            if (lastAssistant && typeof lastAssistant.content === 'string' && lastAssistant.content.length > 0) {
                const alreadyHasSummary = compressed.some(m =>
                    m.role === 'system' && typeof m.content === 'string' && m.content.includes('最新回复摘要')
                );
                if (!alreadyHasSummary) {
                    const assistantSummary = lastAssistant.content.slice(0, 200);
                    compressed.splice(compressed.length - 1, 0, {
                        role: 'system',
                        content: `[最新回复摘要] ${assistantSummary}${lastAssistant.content.length > 200 ? '...' : ''}`
                    });
                }
            }
        }

        conversation.splice(0, conversation.length, ...compressed);
    }

    _extractTurnSummaries(msgs) {
        const turns = [];
        let currentUser = null;
        let currentTools = [];
        let currentResult = '';
        let assistantText = '';

        const flushTurn = () => {
            if (!currentUser && currentTools.length === 0 && !assistantText) return;
            const userPart = currentUser ? `用户询问了${currentUser.slice(0, 60)}` : '';
            const toolPart = currentTools.length > 0 ? `AI执行了${currentTools.join('、')}操作` : '';
            const resultPart = currentResult ? `结果是${currentResult.slice(0, 80)}` : '';
            const textPart = assistantText && !toolPart ? `AI回复了${assistantText.slice(0, 60)}` : '';
            const parts = [userPart, toolPart || textPart, resultPart].filter(Boolean);
            if (parts.length > 0) turns.push(parts.join('，'));
            currentUser = null;
            currentTools = [];
            currentResult = '';
            assistantText = '';
        };

        for (const msg of msgs) {
            if (msg.role === 'user') {
                flushTurn();
                if (typeof msg.content === 'string') {
                    currentUser = msg.content.trim();
                }
            } else if (msg.role === 'assistant') {
                if (msg.tool_calls && msg.tool_calls.length > 0) {
                    for (const tc of msg.tool_calls) {
                        const name = tc.function?.name || tc.name || 'unknown';
                        if (!currentTools.includes(name)) currentTools.push(name);
                    }
                }
                if (typeof msg.content === 'string' && msg.content.length > 20) {
                    assistantText = msg.content.split('\n').filter(l => l.trim()).slice(0, 2).join(' ');
                }
            } else if (msg.role === 'tool') {
                if (typeof msg.content === 'string') {
                    try {
                        const p = JSON.parse(msg.content);
                        if (p.error) currentResult = `错误: ${String(p.error).slice(0, 60)}`;
                        else if (p.success && p.message) currentResult = p.message.slice(0, 80);
                        else if (p.status) currentResult = `状态: ${p.status}`;
                        else if (p.output) currentResult = String(p.output).slice(0, 80);
                    } catch (e) {
                        if (msg.content.length > 20) currentResult = msg.content.slice(0, 80);
                    }
                }
            }
        }
        flushTurn();

        return turns.slice(-8);
    }
}

// =============================================================================
// 导出
// =============================================================================

module.exports = {
    AgentEngine,
    OutputManager,
    AgentState,
    SayType,
    AskType,
    AI_TOOLS,
    toolDescriptions,
    TOOL_DISPLAY_NAMES,
    TOOL_RISK,
    PLATFORMS,
    MODELS,
    getProviderForModel,
    getProviderInfo,
    buildApiHeaders,
    buildChatEndpoint,
    makeApiStreamRequest,
    makeApiRequest,
    _getPluginPromptExtensions,
    _getPluginTools,
    _getPluginDisplayNames
};
/* @versepc-protected: anti-ai-plagiarism-v1.0 */