/**
 * server/api/router.js - API 路由分发器
 * ============================================================================
 * 将 handleAPI 的 192 个端点 switch 语句替换为路由表查表分发。
 * 各 route 模块通过 registerRoute 注册自己的端点 handler。
 */

const ctx = require('../context');

// 路由表: key = "METHOD pathname" → handler
const routes = new Map();

// 辅助函数
function sendJSON(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

function sendError(res, message, status = 500) {
    sendJSON(res, { error: message }, status);
}

function readBody(req) {
    return new Promise((resolve) => {
        let body = '';
        let size = 0;
        const MAX_BODY = 1024 * 1024;
        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY) {
                req.destroy();
                resolve({});
                return;
            }
            body += chunk;
        });
        req.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch (e) { resolve({}); }
        });
        req.on('error', () => resolve({}));
    });
}

// 注册路由
function registerRoute(method, pathname, handler) {
    routes.set(`${method.toUpperCase()} ${pathname}`, handler);
}

// 获取路由 handler
function getHandler(method, pathname) {
    return routes.get(`${method.toUpperCase()} ${pathname}`) ||
           routes.get(`* ${pathname}`);
}

// 依赖注入容器 (由 server.js 入口填充)
const deps = {
    ctx,
    sendJSON,
    sendError,
    readBody,
    // 业务模块 (由 server.js 填充)
    utils: null,
    http: null,
    skins: null,
    terracotta: null,
    network: null,
    versions: null,
    diagnose: null,
    java: null,
    dependencies: null,
    modloaders: null,
    mods: null,
    modpack: null,
    natives: null,
    launch: null,
    accounts: null,
};

// 注册所有路由模块
let _registered = false;
function registerAllRoutes() {
    if (_registered) return;
    _registered = true;

    const routeModules = [
        './routes/versions',
        './routes/launch',
        './routes/game',
        './routes/mods',
        './routes/modpacks',
        './routes/settings',
        './routes/accounts',
        './routes/java',
        './routes/modloaders',
        './routes/skins',
        './routes/lan',
        './routes/crash',
        './routes/system',
        './routes/filesystem',
        './routes/favorites',
        './routes/resources',
        './routes/authlib',
        './routes/download',
        './routes/misc',
        './routes/sponsor',
    ];

    for (const modPath of routeModules) {
        try {
            const mod = require(modPath);
            if (mod && typeof mod.register === 'function') {
                mod.register(registerRoute, deps);
            }
        } catch (e) {
            console.error(`[Router] Failed to load route module ${modPath}:`, e.message);
        }
    }
}

// 主路由函数 - 替代 handleAPI 的 switch
async function handleAPI(pathname, req, res, parsedUrl) {
    if (!_registered) registerAllRoutes();

    const method = (req.method || 'GET').toUpperCase();
    const handler = getHandler(method, pathname);

    if (handler) {
        try {
            await handler(req, res, parsedUrl);
        } catch (e) {
            console.error('API Error:', e.message);
            if (!res.finished) {
                sendError(res, e.message);
            }
        }
    } else {
        sendError(res, 'Not found', 404);
    }
}

module.exports = {
    handleAPI,
    registerRoute,
    getHandler,
    registerAllRoutes,
    sendJSON,
    sendError,
    readBody,
    deps,
};
