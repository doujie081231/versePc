/**
 * @file server/versions/version-filter.js - 版本可见性过滤纯函数（可测试）
 * @description 从 version-list.js 提取的过滤逻辑，便于 TDD。
 */

/**
 * 过滤可见版本（纯函数）
 * @param {Array} installed - 已安装版本数组
 * @param {Object} opts
 * @param {Set<string>} opts.inheritsFromIds - 被继承的版本ID集合
 * @param {RegExp} opts.loaderIdPattern - 加载器ID模式
 * @param {Map<string, number>} opts.loaderModCounts - 加载器版本ID -> mods jar 数量
 * @returns {Array} 过滤后的版本数组
 */
function filterVersionsByVisibility(installed, opts) {
  const { inheritsFromIds, loaderIdPattern, loaderModCounts } = opts;
  return installed.filter((v) => {
    if (v.error) return true;
    if (!inheritsFromIds.has(v.id)) return true;
    const isLoader = v.isForge || v.isFabric || v.isNeoForge || v.isOptiFine || v.isLiteLoader || loaderIdPattern.test(v.id);
    if (isLoader) {
      const modCount = (loaderModCounts && loaderModCounts.get(v.id)) || 0;
      return modCount > 0;
    }
    // 原版基础版本即使被加载器版本继承也显示（用户可直接启动原版）
    return true;
  });
}

module.exports = { filterVersionsByVisibility };
