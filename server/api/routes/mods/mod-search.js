/**
 * @file server/api/routes/mods/mod-search.js
 * @description 模组搜索路由（Modrinth + CurseForge 双源聚合，支持中文翻译）
 */

const { extractDeps } = require('./shared');

module.exports = {
  /**
   * 注册模组搜索路由
   * @param {Function} registerRoute - 路由注册函数
   * @param {Object} deps - 依赖对象
   * @returns {void}
   */
  register(registerRoute, deps) {
    const {
      sendJSON, sendError, http, versions, utils,
      MODRINTH_API, CURSEFORGE_API
    } = extractDeps(deps);

    /* /api/mods/search - 搜索模组（Modrinth + CurseForge 双源聚合，支持中文翻译） */
    registerRoute('GET', '/api/mods/search', async (req, res, parsedUrl) => {
      await new Promise((r) => setImmediate(r));
      let rawQuery = parsedUrl.query.query || '';
      const source = parsedUrl.query.source || 'any';
      const loader = parsedUrl.query.loader || '';
      const mcVersion = parsedUrl.query.version || '';
      const category = parsedUrl.query.category || '';
      const sort = parsedUrl.query.sort || 'relevance';
      const limit = parseInt(parsedUrl.query.limit || '15', 10);
      const offset = parseInt(parsedUrl.query.offset || '0', 10);

      // 中文搜索词翻译：尝试用中文映射表转为英文关键词
      if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(rawQuery)) {
        try {
          const cnMod = require('../../../data/mod-chinese-names.js');
          const translated = cnMod.translateChineseSearch(rawQuery, 'mod');
          if (translated) rawQuery = translated;
        } catch (e) {
          try {
            const cnKeys = Object.entries(require('../../../data/mod-chinese-names.js').CHINESE_SEARCH_KEYWORDS || {});
            for (const [cn, enList] of cnKeys) {
              if (rawQuery.includes(cn) || cn.includes(rawQuery)) { rawQuery = enList.join(' '); break; }
            }
          } catch (_) {}
        }
      }

      // 搜索关键词预处理：去停用词、去特殊字符、去重
      const SEARCH_STOP_WORDS = new Set(['forge', 'fabric', 'for', 'mod', 'quilt', 'neoforge', 'the', 'and', 'of']);
      function processSearchKeywords(text) {
        if (!text) return '';
        const lower = text.toLowerCase().trim();
        const words = lower.split(/\s+/).map((w) => w.replace(/[\[\]]/g, '')).filter((w) => {
          if (!w) return false;
          if (w.length <= 1) return false;
          if (SEARCH_STOP_WORDS.has(w)) return false;
          return true;
        });
        const distinct = [...new Set(words)];
        if (distinct.length === 0 && text.trim().length > 0) return text.trim().toLowerCase();
        const result = distinct.join(' ');
        // OptiForge / OptiFabric 特殊处理
        if (lower.includes('optiforge') && !result.includes('optiforge')) return 'optiforge';
        if (lower.includes('optifabric') && !result.includes('optifabric')) return 'optifabric';
        return result;
      }

      const processedQuery = processSearchKeywords(rawQuery);

      // Modrinth 搜索：使用 facets 过滤 loader/MC 版本/分类
      async function searchModrinth(q, off, lim) {
        const facets = [['project_type:mod']];
        if (loader) facets.push([`categories:${loader}`]);
        if (mcVersion) facets.push([`versions:${mcVersion}`]);
        if (category) facets.push([`categories:${category}`]);
        const sortMap = { relevance: 'relevance', downloads: 'downloads', newest: 'newest', updated: 'updated', follows: 'follows' };
        const sortField = sortMap[sort] || (q ? 'relevance' : 'downloads');
        let searchUrl = `${MODRINTH_API}/search?query=${encodeURIComponent(q)}&index=${sortField}&limit=${lim}&offset=${off}`;
        searchUrl += `&facets=${encodeURIComponent(JSON.stringify(facets))}`;
        const result = await http.cachedFetchJSON(searchUrl, 60000);
        return {
          hits: (result.hits || []).map((hit) => ({
            id: hit.project_id, slug: hit.slug, title: hit.title,
            description: hit.description || '', author: (hit.author || '').replace(/_/g, ''),
            icon: utils.applyImageMirror(hit.icon_url) || '', downloads: hit.downloads || 0, followers: hit.followers || 0,
            categories: hit.categories || [], versions: hit.versions || [],
            dateCreated: hit.date_created || '', dateModified: hit.date_modified || '',
            source: 'modrinth', installed: false
          })),
          total: result.total_hits || 0
        };
      }

      // CurseForge 搜索：使用 modLoaderType/gameVersion 过滤
      async function searchCurseForge(q, off, lim) {
        const settings = versions.loadSettingsCached();
        const cfApiKey = settings.curseforgeApiKey || '$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm';
        const cfHeaders = { 'x-api-key': cfApiKey };
        let searchUrl = `${CURSEFORGE_API}/mods/search?gameId=432&searchFilter=${encodeURIComponent(q)}&sortOrder=Desc&classId=6&pageSize=${lim}&index=${off}`;
        if (sort === 'downloads') searchUrl += '&sortField=6';
        else if (sort === 'newest') searchUrl += '&sortField=11';
        else if (sort === 'updated') searchUrl += '&sortField=3';
        else searchUrl += '&sortField=2';
        if (loader) {
          const loaderMap = { forge: 1, fabric: 4, quilt: 5, neoforge: 5 };
          const loaderId = loaderMap[loader.toLowerCase()];
          if (loaderId) searchUrl += `&modLoaderType=${loaderId}`;
        }
        if (mcVersion) searchUrl += `&gameVersion=${encodeURIComponent(mcVersion)}`;
        const result = await http.fetchJSON(searchUrl, cfHeaders);
        return {
          hits: (result.data || []).map((mod) => ({
            id: String(mod.id), slug: mod.slug || '', title: mod.name || 'Unknown',
            description: mod.summary || '', author: (mod.authors || [])[0] || 'Unknown',
            icon: utils.applyImageMirror(mod.logo?.url) || '', downloads: mod.downloadCount || 0, followers: mod.followers || 0,
            categories: (mod.categories || []).map((c) => c.name || c.id || ''),
            versions: [], dateCreated: mod.dateCreated || '', dateModified: mod.dateModified || '',
            source: 'curseforge', installed: false, _cfDateReleased: mod.dateReleased || ''
          })),
          total: result.pagination?.totalCount || 0
        };
      }

      // 判断两个搜索结果是否为同一项目（跨源去重）
      function isSameProject(a, b) {
        if (a.source === b.source) return false;
        const slugA = (a.slug || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const slugB = (b.slug || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (slugA && slugB && slugA === slugB) return true;
        const titleA = (a.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const titleB = (b.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (titleA && titleB && titleA === titleB) return true;
        const descA = (a.description || '').substring(0, 100).toLowerCase();
        const descB = (b.description || '').substring(0, 100).toLowerCase();
        if (descA.length > 20 && descB.length > 20 && descA === descB) return true;
        return false;
      }

      // 计算搜索结果评分（下载量 + 关注度 + 标题匹配度）
      function computeScore(item, q) {
        let score = 0;
        const dl = item.downloads || 0;
        if (dl > 0) score += Math.log10(dl + 1) / 9;
        if (item.followers > 0) score += Math.log10(item.followers + 1) / 12;
        if (q && item.title) {
          const t = item.title.toLowerCase();
          const ql = q.toLowerCase();
          if (t === ql) score += 10;
          else if (t.startsWith(ql)) score += 8;
          else if (t.includes(ql)) score += 5;
          else {
            // 分词匹配：统计查询词命中数
            const qWords = ql.split(/\s+/);
            let matchCount = 0;
            for (const w of qWords) {
              if (w && t.includes(w)) matchCount++;
            }
            if (qWords.length > 0) score += (matchCount / qWords.length) * 4;
          }
        }
        // Modrinth 来源略微加权
        if (item.source === 'modrinth') score += 0.1;
        return score;
      }

      try {
        let hits = [];
        let totalHits = 0;

        if (source === 'modrinth') {
          const r = await searchModrinth(processedQuery, offset, limit);
          hits = r.hits;
          totalHits = r.total;
        } else if (source === 'curseforge') {
          const r = await searchCurseForge(processedQuery || rawQuery, offset, limit);
          hits = r.hits;
          totalHits = r.total;
        } else {
          // 双源聚合：各取更多结果，去重后按评分排序
          const cfLimit = Math.min(limit + 10, 40);
          const mrLimit = Math.min(limit + 10, 40);
          const fetchSize = Math.max(limit * 2, 40);
          const [mrResult, cfResult] = await Promise.all([
            searchModrinth(processedQuery, offset, fetchSize).catch(() => ({ hits: [], total: 0 })),
            searchCurseForge(processedQuery || rawQuery, offset, fetchSize).catch(() => ({ hits: [], total: 0 }))
          ]);
          const allRaw = [...mrResult.hits, ...cfResult.hits];
          // 跨源去重
          const deduped = [];
          for (const item of allRaw) {
            if (!deduped.some((d) => isSameProject(d, item))) {
              deduped.push(item);
            }
          }
          if (sort === 'downloads' || sort === 'newest' || sort === 'updated') {
            const sortMap2 = {
              downloads: (a, b) => (b.downloads || 0) - (a.downloads || 0),
              newest: (a, b) => new Date(b.dateCreated || b._cfDateReleased || 0) - new Date(a.dateCreated || a._cfDateReleased || 0),
              updated: (a, b) => new Date(b.dateModified || 0) - new Date(a.dateModified || 0)
            };
            deduped.sort(sortMap2[sort] || sortMap2.downloads);
          } else {
            deduped.sort((a, b) => computeScore(b, processedQuery || rawQuery) - computeScore(a, processedQuery || rawQuery));
          }
          totalHits = Math.max(mrResult.total, cfResult.total);
          hits = deduped.slice(offset, offset + limit);
        }

        sendJSON(res, { hits, total: totalHits, offset, processedQuery: processedQuery !== rawQuery ? processedQuery : undefined });
      } catch (e) {
        sendError(res, '搜索失败: ' + e.message);
      }
    });
  }
};
