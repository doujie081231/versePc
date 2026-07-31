const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { filterVersionsByVisibility } = require('./version-filter');

const LOADER_ID_PATTERN = /^(?:fabric-loader-\d|quilt-loader-\d|\d+\.\d+(?:\.\d+)?-(?:forge|neoforge)-\d)/;

describe('filterVersionsByVisibility - 加载器版本可见性', () => {
  test('加载器版本被整合包继承且自身 mods 为空时应在版本列表隐藏', () => {
    const installed = [
      { id: '剑与王国 (11)', inheritsFrom: '1.20.1-forge-47.4.20', isForge: false, error: false },
      { id: '1.20.1-forge-47.4.20', inheritsFrom: null, isForge: true, error: false }
    ];
    const inheritsFromIds = new Set(['1.20.1-forge-47.4.20']);
    const loaderModCounts = new Map([['1.20.1-forge-47.4.20', 0]]);

    const result = filterVersionsByVisibility(installed, {
      inheritsFromIds,
      loaderIdPattern: LOADER_ID_PATTERN,
      loaderModCounts
    });

    const ids = result.map((v) => v.id);
    assert.ok(!ids.includes('1.20.1-forge-47.4.20'), '加载器版本 mods 为空时应隐藏');
    assert.ok(ids.includes('剑与王国 (11)'), '整合包版本应显示');
  });

  test('加载器版本被继承但自身有 mods 时仍应显示', () => {
    const installed = [
      { id: '我的整合包', inheritsFrom: '1.20.1-forge-47.4.20', isForge: false, error: false },
      { id: '1.20.1-forge-47.4.20', inheritsFrom: null, isForge: true, error: false }
    ];
    const inheritsFromIds = new Set(['1.20.1-forge-47.4.20']);
    const loaderModCounts = new Map([['1.20.1-forge-47.4.20', 5]]);

    const result = filterVersionsByVisibility(installed, {
      inheritsFromIds,
      loaderIdPattern: LOADER_ID_PATTERN,
      loaderModCounts
    });

    const ids = result.map((v) => v.id);
    assert.ok(ids.includes('1.20.1-forge-47.4.20'), '加载器版本有 mods 时应显示');
  });

  test('加载器版本不被任何整合包继承时应显示（独立安装）', () => {
    const installed = [
      { id: '1.20.1-forge-47.4.20', inheritsFrom: null, isForge: true, error: false }
    ];
    const inheritsFromIds = new Set();
    const loaderModCounts = new Map([['1.20.1-forge-47.4.20', 0]]);

    const result = filterVersionsByVisibility(installed, {
      inheritsFromIds,
      loaderIdPattern: LOADER_ID_PATTERN,
      loaderModCounts
    });

    const ids = result.map((v) => v.id);
    assert.ok(ids.includes('1.20.1-forge-47.4.20'), '独立安装的加载器版本应显示');
  });

  test('纯原版基础版本被继承时应显示（用户可直接启动原版）', () => {
    const installed = [
      { id: '我的整合包', inheritsFrom: '1.20.1', isForge: false, error: false },
      { id: '1.20.1', inheritsFrom: null, isForge: false, error: false }
    ];
    const inheritsFromIds = new Set(['1.20.1']);
    const loaderModCounts = new Map();

    const result = filterVersionsByVisibility(installed, {
      inheritsFromIds,
      loaderIdPattern: LOADER_ID_PATTERN,
      loaderModCounts
    });

    const ids = result.map((v) => v.id);
    assert.ok(ids.includes('1.20.1'), '纯原版基础版本应显示');
    assert.ok(ids.includes('我的整合包'), '整合包版本应显示');
  });
});
