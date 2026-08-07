/**
 * main/ai-proxy.js - AI 对话代理 IPC 模块
 * 在主进程发起 AI API 请求，绕过渲染进程的 CORS 限制
 * 支持 openai/anthropic/google 三种接口格式
 */

const { ipcMain, net } = require('electron');

function _buildBody(format, model, messages, maxTokens) {
    let tokens = maxTokens || 1024;
    if (format === 'anthropic') {
        let sysMsg = '';
        let userMsgs = [];
        for (let i = 0; i < messages.length; i++) {
            if (messages[i].role === 'system') sysMsg += messages[i].content + '\n';
            else userMsgs.push({ role: messages[i].role, content: messages[i].content });
        }
        return {
            model: model,
            max_tokens: tokens,
            system: sysMsg.trim(),
            messages: userMsgs
        };
    } else if (format === 'google') {
        let contents = [];
        for (let i = 0; i < messages.length; i++) {
            let role = messages[i].role === 'assistant' ? 'model' : 'user';
            if (messages[i].role === 'system') {
                contents.push({ role: 'user', parts: [{ text: messages[i].content }] });
            } else {
                contents.push({ role: role, parts: [{ text: messages[i].content }] });
            }
        }
        return { contents: contents, generationConfig: { maxOutputTokens: tokens } };
    } else {
        // openai 格式
        return { model: model, messages: messages, max_tokens: tokens };
    }
}

function _extractReply(format, data) {
    try {
        if (format === 'anthropic') {
            if (data.content && data.content.length > 0) return data.content[0].text || '(空回复)';
            return '(空回复)';
        } else if (format === 'google') {
            if (data.candidates && data.candidates.length > 0) {
                let parts = data.candidates[0].content && data.candidates[0].content.parts;
                if (parts && parts.length > 0) return parts[0].text || '(空回复)';
            }
            return '(空回复)';
        } else {
            // openai 格式
            if (data.choices && data.choices.length > 0) {
                return data.choices[0].message && data.choices[0].message.content || '(空回复)';
            }
            return '(空回复)';
        }
    } catch (e) {
        return '(解析回复失败: ' + e.message + ')';
    }
}

// 在主进程发起 HTTP 请求，不受 CORS 限制
function _doRequest(options) {
    return new Promise((resolve, reject) => {
        let req = net.request({
            method: 'POST',
            url: options.url,
            redirect: 'follow'
        });
        // 设置请求头
        let headers = options.headers || {};
        let keys = Object.keys(headers);
        for (let i = 0; i < keys.length; i++) {
            req.setHeader(keys[i], headers[keys[i]]);
        }
        let chunks = [];
        req.on('response', (response) => {
            response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            response.on('end', () => {
                let body = Buffer.concat(chunks).toString('utf8');
                let status = response.statusCode;
                resolve({ status: status, body: body });
            });
        });
        req.on('error', (e) => reject(e));
        // 超时时间：默认 60 秒，可通过 options.timeout 自定义
        let timeoutMs = options.timeout || 60000;
        setTimeout(() => { try { req.abort(); } catch (_) {} reject(new Error('AI 请求超时')); }, timeoutMs);
        let bodyStr = JSON.stringify(options.body);
        req.write(bodyStr, 'utf8');
        req.end();
    });
}

// 将 AI 服务商返回的错误转换为用户能看懂的中文提示
function _friendlyError(status, body) {
    let raw = (body || '').substring(0, 300);
    let lower = raw.toLowerCase();

    // 余额不足 / 配额用尽（DeepSeek 用 402，OpenAI 用 429+insufficient_quota）
    if (status === 402 || lower.indexOf('insufficient_balance') !== -1 ||
        lower.indexOf('insufficient balance') !== -1 ||
        lower.indexOf('insufficient_quota') !== -1 ||
        lower.indexOf('insufficient quota') !== -1 ||
        lower.indexOf('额度') !== -1 && lower.indexOf('不足') !== -1) {
        return 'AI 账户余额不足，请登录对应服务商官网充值后重试（错误码 ' + status + '）';
    }

    // API Key 无效或过期
    if (status === 401 || lower.indexOf('invalid api key') !== -1 ||
        lower.indexOf('invalid_api_key') !== -1 ||
        lower.indexOf('unauthorized') !== -1 ||
        lower.indexOf('authentication') !== -1) {
        return 'API Key 无效或已过期，请在设置中检查并重新填写正确的 API Key（错误码 ' + status + '）';
    }

    // 权限不足 / 内容被拒绝
    if (status === 403 || lower.indexOf('permission_denied') !== -1 ||
        lower.indexOf('forbidden') !== -1) {
        if (lower.indexOf('content') !== -1 && lower.indexOf('filter') !== -1) {
            return '请求内容被 AI 服务商拒绝（可能涉及违规内容），请换一种说法重试（错误码 ' + status + '）';
        }
        return 'API Key 权限不足，请检查该 Key 是否有对应模型的调用权限（错误码 ' + status + '）';
    }

    // 请求过于频繁 / 限流
    if (status === 429 || lower.indexOf('rate_limit') !== -1 ||
        lower.indexOf('rate limit') !== -1 ||
        lower.indexOf('too many requests') !== -1) {
        return '请求过于频繁，已触发限流，请稍等几秒后重试（错误码 ' + status + '）';
    }

    // 接口地址或模型不存在
    if (status === 404 || lower.indexOf('model not found') !== -1 ||
        lower.indexOf('model_not_found') !== -1 ||
        lower.indexOf('does not exist') !== -1) {
        return '接口地址或模型名称不正确，请检查供应商配置和所选模型是否匹配（错误码 ' + status + '）';
    }

    // 请求超时
    if (status === 408) {
        return 'AI 请求超时，请检查网络连接后重试（错误码 ' + status + '）';
    }

    // 请求内容过大
    if (status === 413 || lower.indexOf('too large') !== -1 ||
        lower.indexOf('maximum context') !== -1 ||
        lower.indexOf('context length') !== -1) {
        return '对话内容过长，超出了 AI 模型的处理上限，请缩短内容后重试（错误码 ' + status + '）';
    }

    // 请求格式错误（参数不对）
    if (status === 400 || lower.indexOf('invalid_request') !== -1 ||
        lower.indexOf('invalid request') !== -1 ||
        lower.indexOf('bad request') !== -1) {
        return '请求参数有误，可能是模型名称或消息格式不正确（错误码 ' + status + '）';
    }

    // AI 服务端错误
    if (status >= 500) {
        return 'AI 服务商暂时不可用，请稍后重试（错误码 ' + status + '）';
    }

    // 其他未知错误，保留原始信息供排查
    return 'AI 请求失败（错误码 ' + status + '）：' + raw;
}

function registerAIProxyIPC() {
    ipcMain.handle('ai:chat', async (event, params) => {
        try {
            let cfg = params || {};
            if (!cfg.provider && !cfg.endpoint) return { ok: false, error: '未配置供应商' };
            if (!cfg.apiKey) return { ok: false, error: '未配置 API Key' };
            if (!cfg.model) return { ok: false, error: '未选择模型' };

            let format = cfg.apiFormat || 'openai';
            let url;
            let headers = { 'Content-Type': 'application/json' };

            // 自定义供应商
            if (cfg.provider === 'custom' || cfg.endpoint) {
                url = cfg.endpoint;
                if (format === 'anthropic') {
                    headers['x-api-key'] = cfg.apiKey;
                    headers['anthropic-version'] = '2023-06-01';
                } else if (format === 'google') {
                    let sep = url.indexOf('?') !== -1 ? '&' : '?';
                    url = url + sep + 'key=' + cfg.apiKey;
                } else {
                    // OpenAI 格式：自动补全 /chat/completions 路径
                    headers['Authorization'] = 'Bearer ' + cfg.apiKey;
                    if (!url.endsWith('/chat/completions') && !url.endsWith('/completions')) {
                        url = url.replace(/\/+$/, '') + '/chat/completions';
                    }
                }
            } else if (cfg.provider === 'google' || format === 'google') {
                url = 'https://generativelanguage.googleapis.com/v1beta/models/' + cfg.model + ':generateContent?key=' + cfg.apiKey;
            } else if (cfg.provider === 'anthropic' || format === 'anthropic') {
                url = cfg.endpoint || 'https://api.anthropic.com/v1/messages';
                headers['x-api-key'] = cfg.apiKey;
                headers['anthropic-version'] = '2023-06-01';
            } else {
                // 预设供应商（openai 格式）
                url = cfg.endpoint;
                headers['Authorization'] = 'Bearer ' + cfg.apiKey;
                if (!url) return { ok: false, error: '供应商缺少接口地址' };
            }

            let body = _buildBody(format, cfg.model, cfg.messages || [], cfg.maxTokens);
            let resp = await _doRequest({ url: url, headers: headers, body: body, timeout: cfg.timeout || 60000 });

            if (resp.status >= 400) {
                return { ok: false, error: _friendlyError(resp.status, resp.body) };
            }

            let data;
            try { data = JSON.parse(resp.body); }
            catch (e) { return { ok: false, error: 'AI 返回非 JSON：' + resp.body.substring(0, 200) }; }

            let reply = _extractReply(format, data);
            return { ok: true, reply: reply };
        } catch (e) {
            console.error('[AI Proxy] 请求失败:', e.message);
            return { ok: false, error: e.message || String(e) };
        }
    });

    // 快速翻译：使用 MyMemory 免费翻译 API（国内唯一可用的免Key接口）
    // 其他接口（有道/百度/必应/谷歌/Lingva/LibreTranslate）均已失效或被墙
    // params: { texts: [string], source?: 'en', target?: 'zh-CN' }
    function _doGetRequest(url, timeoutMs) {
        return new Promise((resolve, reject) => {
            let req = net.request({ method: 'GET', url: url, redirect: 'follow' });
            req.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
            let chunks = [];
            req.on('response', (response) => {
                response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
                response.on('end', () => {
                    resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') });
                });
            });
            req.on('error', (e) => reject(e));
            setTimeout(() => { try { req.abort(); } catch (_) {} reject(new Error('翻译请求超时')); }, timeoutMs || 10000);
            req.end();
        });
    }

    ipcMain.handle('translate:batch', async (event, params) => {
        try {
            let texts = (params && params.texts) || [];
            if (texts.length === 0) return { ok: true, results: [] };
            let source = (params && params.source) || 'en';
            let target = (params && params.target) || 'zh-CN';
            let langPair = source + '|' + target;
            let results = new Array(texts.length);
            let translatedCount = 0;
            let failedCount = 0;

            // 4 路并行，平衡速度和限流
            let PARALLEL = 4;

            async function translateOne(text, idx) {
                if (!text || !text.trim()) { results[idx] = text; return; }
                let url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + encodeURIComponent(langPair);
                for (let retry = 0; retry < 5; retry++) {
                    try {
                        let resp = await _doGetRequest(url, 10000);
                        if (resp.status === 429) {
                            // 限流，等待后重试，逐次加长
                            await new Promise(r => setTimeout(r, 3000 + retry * 2000));
                            continue;
                        }
                        if (resp.status >= 400) { await new Promise(r => setTimeout(r, 1000)); continue; }
                        let data;
                        try { data = JSON.parse(resp.body); }
                        catch (e) { await new Promise(r => setTimeout(r, 1000)); continue; }
                        if (data && data.responseData && data.responseData.translatedText) {
                            results[idx] = data.responseData.translatedText;
                            translatedCount++;
                            return;
                        } else {
                            results[idx] = text;
                            failedCount++;
                            return;
                        }
                    } catch (e) {
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
                // 重试用完，用原文代替
                results[idx] = text;
                failedCount++;
            }

            for (let i = 0; i < texts.length; i += PARALLEL) {
                let batch = texts.slice(i, i + PARALLEL);
                let promises = [];
                for (let j = 0; j < batch.length; j++) {
                    promises.push(translateOne(batch[j], i + j));
                }
                await Promise.all(promises);
                // 每批间隔 300ms，降低限流概率
                await new Promise(r => setTimeout(r, 300));
            }

            console.log('[Translate] 完成：成功 ' + translatedCount + ' 条，失败 ' + failedCount + ' 条（用原文代替）');
            return { ok: true, results: results, translated: translatedCount, failed: failedCount };
        } catch (e) {
            console.error('[Translate] 请求失败:', e.message);
            return { ok: false, error: e.message || String(e) };
        }
    });
}

module.exports = { registerAIProxyIPC };
