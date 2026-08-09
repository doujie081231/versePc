/**
 * server/api/routes/sponsor.js - 赞助者路由
 * ============================================================================
 * 校验赞助订单号是否在真实赞助白名单中。
 * 白名单文件 server/data/sponsor-orders.json 随应用打包，随版本更新。
 */

const fs = require('fs');
const path = require('path');

let _ordersCache = null;

/**
 * 读取并缓存赞助订单号白名单（Set 结构，便于快速判重）
 * 文件随应用打包，位于 server/data/sponsor-orders.json
 */
function loadSponsorOrders() {
    if (_ordersCache) return _ordersCache;
    try {
        const filePath = path.join(__dirname, '..', '..', 'data', 'sponsor-orders.json');
        const raw = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);
        const list = Array.isArray(data.orders) ? data.orders : [];
        _ordersCache = new Set(list.map(String));
        return _ordersCache;
    } catch (e) {
        console.error('[Sponsor] 读取赞助订单号白名单失败:', e.message);
        _ordersCache = new Set();
        return _ordersCache;
    }
}

module.exports = {
    register(registerRoute, deps) {
        const { sendJSON, sendError, readBody } = deps;

        // ====================================================================
        // POST /api/sponsor/verify - 校验赞助订单号
        // body: { orderId: string }
        // 返回: { ok: true } 白名单内；{ ok: false, msg } 无效
        // ====================================================================
        registerRoute('POST', '/api/sponsor/verify', async (req, res) => {
            const body = await readBody(req);
            const orderId = (body.orderId || '').toString().trim();
            if (!orderId) {
                sendJSON(res, { ok: false, msg: '请输入赞助订单号' });
                return;
            }
            const orders = loadSponsorOrders();
            if (orders.has(orderId)) {
                sendJSON(res, { ok: true });
            } else {
                sendJSON(res, { ok: false, msg: '订单号无效，请核对后重试' });
            }
        });

        // ====================================================================
        // GET /api/sponsor/info - 返回赞助订单白名单数量（供界面展示）
        // ====================================================================
        registerRoute('GET', '/api/sponsor/info', async (req, res) => {
            sendJSON(res, { enabled: true, count: loadSponsorOrders().size });
        });
    }
};