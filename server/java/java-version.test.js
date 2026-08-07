const { test } = require('node:test');
const assert = require('node:assert');

const {
  _parseMcVersion,
  _compareVersion,
  getLoaderInfoForJava,
  getJavaVersionRange,
  getRequiredJavaVersion
} = require('./java-version');

/* =================== _parseMcVersion =================== */

test('_parseMcVersion: 标准 3 段版本号', () => {
  assert.deepStrictEqual(_parseMcVersion('1.20.1'), { major: 1, minor: 20, patch: 1 });
  assert.deepStrictEqual(_parseMcVersion('1.16.5'), { major: 1, minor: 16, patch: 5 });
});

test('_parseMcVersion: 2 段版本号 patch 补 0', () => {
  assert.deepStrictEqual(_parseMcVersion('1.20'), { major: 1, minor: 20, patch: 0 });
  assert.deepStrictEqual(_parseMcVersion('2.0'), { major: 2, minor: 0, patch: 0 });
});

test('_parseMcVersion: 带后缀（-forge / _OptiFine 等）只取首段', () => {
  assert.deepStrictEqual(_parseMcVersion('1.20.1-forge'), { major: 1, minor: 20, patch: 1 });
  assert.deepStrictEqual(_parseMcVersion('1.12.2_OptiFine'), { major: 1, minor: 12, patch: 2 });
});

test('_parseMcVersion: 非版本字符串返回 null', () => {
  assert.strictEqual(_parseMcVersion('fabric-loader-0.16.10-1.20.1'), null);
  assert.strictEqual(_parseMcVersion('abc'), null);
  assert.strictEqual(_parseMcVersion('1'), null); // 少于 2 段
});

test('_parseMcVersion: 空值返回 null', () => {
  assert.strictEqual(_parseMcVersion(''), null);
  assert.strictEqual(_parseMcVersion(null), null);
  assert.strictEqual(_parseMcVersion(undefined), null);
});

/* =================== _compareVersion =================== */

test('_compareVersion: 相等返回 0', () => {
  assert.strictEqual(_compareVersion('1.20.1', '1.20.1'), 0);
  assert.strictEqual(_compareVersion('1.20', '1.20.0'), 0); // patch 默认 0
});

test('_compareVersion: 大于返回正数', () => {
  assert.ok(_compareVersion('1.20.1', '1.20.0') > 0);
  assert.ok(_compareVersion('1.21.0', '1.20.9') > 0);
  assert.ok(_compareVersion('2.0.0', '1.99.99') > 0);
});

test('_compareVersion: 小于返回负数', () => {
  assert.ok(_compareVersion('1.20.0', '1.20.1') < 0);
  assert.ok(_compareVersion('1.19.9', '1.20.0') < 0);
});

test('_compareVersion: 一方为 null', () => {
  assert.strictEqual(_compareVersion(null, null), 0);
  assert.strictEqual(_compareVersion('1.20.1', null), 1);
  assert.strictEqual(_compareVersion(null, '1.20.1'), -1);
});

test('_compareVersion: Forge 版本号比较（关键回归）', () => {
  // 1.16.5 Forge 36.2.25 是 Java 8 上限版本
  assert.ok(_compareVersion('36.2.25', '34.0.0') > 0); // 36.2.25 >= 34.0.0
  assert.strictEqual(_compareVersion('36.2.25', '36.2.25'), 0); // 等于上限
  assert.ok(_compareVersion('36.2.25', '36.2.26') < 0); // 36.2.25 < 36.2.26
});

/* =================== getLoaderInfoForJava =================== */

test('getLoaderInfoForJava: versionJson 为 null 返回全 false', () => {
  const r = getLoaderInfoForJava('1.20.1', null);
  assert.strictEqual(r.isForge, false);
  assert.strictEqual(r.isNeoForge, false);
  assert.strictEqual(r.isFabric, false);
  assert.strictEqual(r.isOptiFine, false);
  assert.strictEqual(r.isLiteLoader, false);
  assert.strictEqual(r.isLegacyLaunchwrapper, false);
});

test('getLoaderInfoForJava: Forge 通过 mainClass modlauncher 检测', () => {
  const r = getLoaderInfoForJava('1.20.1-forge', {
    mainClass: 'cpw.mods.modlauncher.Launcher',
    libraries: []
  });
  assert.ok(r.isForge, '应通过 modlauncher mainClass 检测 Forge');
  assert.strictEqual(r.isNeoForge, false);
});

test('getLoaderInfoForJava: NeoForge 通过 versionId 检测', () => {
  const r = getLoaderInfoForJava('1.20.1-neoforge', {
    mainClass: 'net.neoforge.client.Main',
    libraries: []
  });
  assert.ok(r.isNeoForge, '应通过 versionId 检测 NeoForge');
  // Forge 与 NeoForge 互斥
  assert.strictEqual(r.isForge, false);
});

test('getLoaderInfoForJava: Fabric 通过 mainClass fabric 检测', () => {
  const r = getLoaderInfoForJava('fabric-loader-0.16.10-1.20.1', {
    mainClass: 'net.fabricmc.loader.impl.launch.knot.KnotClient',
    libraries: []
  });
  assert.ok(r.isFabric, '应通过 mainClass 检测 Fabric');
});

test('getLoaderInfoForJava: OptiFine 通过 versionId 检测', () => {
  const r = getLoaderInfoForJava('1.12.2-OptiFine', {
    mainClass: 'net.minecraft.client.main.Main',
    libraries: []
  });
  assert.ok(r.isOptiFine, '应通过 versionId 检测 OptiFine');
});

test('getLoaderInfoForJava: LiteLoader 通过 versionId 检测', () => {
  const r = getLoaderInfoForJava('1.7.10-LiteLoader', {
    mainClass: 'net.minecraft.launchwrapper.launch',
    libraries: []
  });
  assert.ok(r.isLiteLoader, '应通过 versionId 检测 LiteLoader');
});

test('getLoaderInfoForJava: launchwrapper 通过 mainClass 检测', () => {
  const r = getLoaderInfoForJava('1.7.10', {
    mainClass: 'net.minecraft.launchwrapper.launch',
    libraries: []
  });
  assert.ok(r.isLegacyLaunchwrapper, '应通过 mainClass 检测 launchwrapper');
});

test('getLoaderInfoForJava: baseVersion 从 inheritsFrom 提取', () => {
  const r = getLoaderInfoForJava('1.20.1-forge', {
    mainClass: 'cpw.mods.modlauncher.Launcher',
    inheritsFrom: '1.20.1',
    libraries: []
  });
  assert.strictEqual(r.baseVersion, '1.20.1');
});

test('getLoaderInfoForJava: baseVersion 从 Forge 库 artifact 提取', () => {
  const r = getLoaderInfoForJava('1.20.1-forge', {
    mainClass: 'cpw.mods.modlauncher.Launcher',
    libraries: [
      { name: 'net.minecraftforge:forge:1.20.1-47.0.1' }
    ]
  });
  assert.strictEqual(r.baseVersion, '1.20.1');
  // forgeVersion 从 artifact 版本中剥离 MC 版本前缀
  assert.strictEqual(r.forgeVersion, '47.0.1');
});

test('getLoaderInfoForJava: baseVersion 从 versionId 兜底提取', () => {
  const r = getLoaderInfoForJava('1.18.2', {
    mainClass: 'net.minecraft.client.main.Main',
    libraries: []
  });
  assert.strictEqual(r.baseVersion, '1.18.2');
});

/* =================== getJavaVersionRange =================== */

test('getJavaVersionRange: 默认 min=8 max=999 source=default', () => {
  const r = getJavaVersionRange('custom-version', null);
  assert.strictEqual(r.min, 8);
  assert.strictEqual(r.max, 999);
  assert.strictEqual(r.source, 'default');
});

test('getJavaVersionRange: 1.20.5+ 强制 Java 21', () => {
  const r = getJavaVersionRange('1.20.5', { inheritsFrom: '1.20.5', libraries: [] });
  assert.strictEqual(r.min, 21);
  assert.strictEqual(r.source, 'mc-version');
});

test('getJavaVersionRange: 1.21+ 强制 Java 21', () => {
  const r = getJavaVersionRange('1.21', { inheritsFrom: '1.21', libraries: [] });
  assert.strictEqual(r.min, 21);
});

test('getJavaVersionRange: 新版本号体系 26.x 强制 Java 25', () => {
  const r = getJavaVersionRange('26.1.2', { inheritsFrom: '26.1.2', libraries: [] });
  assert.strictEqual(r.min, 25);
  assert.strictEqual(r.source, 'mc-version');
});

test('getJavaVersionRange: 1.18 - 1.20.4 强制 Java 17', () => {
  const r1 = getJavaVersionRange('1.18', { inheritsFrom: '1.18', libraries: [] });
  const r2 = getJavaVersionRange('1.20.4', { inheritsFrom: '1.20.4', libraries: [] });
  assert.strictEqual(r1.min, 17);
  assert.strictEqual(r2.min, 17);
});

test('getJavaVersionRange: 1.17 强制 Java 16', () => {
  const r = getJavaVersionRange('1.17', { inheritsFrom: '1.17', libraries: [] });
  assert.strictEqual(r.min, 16);
  assert.strictEqual(r.source, 'mc-version');
});

test('getJavaVersionRange: 1.12 - 1.16 强制 Java 8（最低）', () => {
  const r = getJavaVersionRange('1.12.2', { inheritsFrom: '1.12.2', libraries: [] });
  assert.strictEqual(r.min, 8);
});

test('getJavaVersionRange: JSON javaVersion 与 MC 版本约束取最大值', () => {
  const r = getJavaVersionRange('1.20.1', {
    inheritsFrom: '1.20.1',
    javaVersion: { majorVersion: 21 },
    libraries: []
  });
  // JSON 强制 21，MC 1.20.1 强制 17，取最大值 21
  assert.strictEqual(r.min, 21);
  // source 会被后续 MC 版本判断覆盖（实现行为：source 顺序 JSON → MC → Forge → launchwrapper）
  assert.ok(r.source === 'json' || r.source === 'mc-version', `source=${r.source}`);
});

test('getJavaVersionRange: complianceLevel=7 → min=17', () => {
  const r = getJavaVersionRange('1.20.1', {
    inheritsFrom: '1.20.1',
    complianceLevel: 7,
    libraries: []
  });
  assert.strictEqual(r.min, 17);
});

test('getJavaVersionRange: complianceLevel>=8 → min=21', () => {
  const r = getJavaVersionRange('1.20.1', {
    inheritsFrom: '1.20.1',
    complianceLevel: 8,
    libraries: []
  });
  assert.strictEqual(r.min, 21);
});

test('getJavaVersionRange: JVM 参数含 --sun-misc-unsafe-memory-access → min=23', () => {
  // 回归：NeoForge 26.x 声明 javaVersion=21 但 JVM 参数需要 Java 23+
  const r = getJavaVersionRange('1.21-neoforge', {
    mainClass: 'net.neoforge.client.Main',
    inheritsFrom: '1.21',
    javaVersion: { majorVersion: 21 },
    arguments: {
      jvm: ['--sun-misc-unsafe-memory-access=allow']
    },
    libraries: []
  });
  assert.strictEqual(r.min, 23);
  // source 会被后续 Forge/NeoForge 分支覆盖（实现行为）
  assert.ok(r.source === 'jvm-args' || r.source === 'forge' || r.source === 'mc-version', `source=${r.source}`);
});

test('getJavaVersionRange: Forge 1.20.1 → Java 17+（关键回归）', () => {
  const r = getJavaVersionRange('1.20.1-forge', {
    mainClass: 'cpw.mods.modlauncher.Launcher',
    inheritsFrom: '1.20.1',
    libraries: [
      { name: 'net.minecraftforge:forge:1.20.1-47.0.1' }
    ]
  });
  assert.strictEqual(r.min, 17);
});

test('getJavaVersionRange: Forge 1.16.5 + 36.2.25 → 必须 Java 8（关键回归）', () => {
  const r = getJavaVersionRange('1.16.5-forge', {
    mainClass: 'cpw.mods.modlauncher.Launcher',
    inheritsFrom: '1.16.5',
    libraries: [
      { name: 'net.minecraftforge:forge:1.16.5-36.2.25' }
    ]
  });
  assert.strictEqual(r.min, 8);
  assert.strictEqual(r.max, 8);
  assert.strictEqual(r.source, 'forge');
});

test('getJavaVersionRange: Forge 1.16.5 + 36.2.26 → 不强制 Java 8 上限', () => {
  const r = getJavaVersionRange('1.16.5-forge', {
    mainClass: 'cpw.mods.modlauncher.Launcher',
    inheritsFrom: '1.16.5',
    libraries: [
      { name: 'net.minecraftforge:forge:1.16.5-36.2.26' }
    ]
  });
  assert.strictEqual(r.min, 8);
  assert.ok(r.max > 8, '36.2.26+ 应允许 Java 9+');
});

test('getJavaVersionRange: Forge 1.7.10 → Java 7', () => {
  const r = getJavaVersionRange('1.7.10-forge', {
    mainClass: 'cpw.mods.modlauncher.Launcher',
    inheritsFrom: '1.7.10',
    libraries: [
      { name: 'net.minecraft:launchwrapper:1.12' }
    ]
  });
  // 1.7.10 不在 1.6.1-1.7.2 范围内，进入 <=1.12 分支
  // 但 launchwrapper 限制 max=8
  assert.ok(r.min <= 8);
  assert.strictEqual(r.max, 8);
});

test('getJavaVersionRange: LiteLoader → max=8（强制上限）', () => {
  // 使用非 launchwrapper 的 mainClass，避免 launchwrapper 覆盖 source
  const r = getJavaVersionRange('1.7.10-LiteLoader', {
    mainClass: 'net.minecraft.client.main.Main',
    inheritsFrom: '1.7.10',
    libraries: [
      { name: 'com.mumfrey.liteloader:liteloader:1.7.10' }
    ]
  });
  assert.strictEqual(r.max, 8);
  assert.strictEqual(r.source, 'liteloader');
});

test('getJavaVersionRange: LiteLoader + launchwrapper 同时存在 → source=launchwrapper', () => {
  // launchwrapper 在 LiteLoader 之后执行，会覆盖 source（实现行为）
  const r = getJavaVersionRange('1.7.10-LiteLoader', {
    mainClass: 'net.minecraft.launchwrapper.launch',
    inheritsFrom: '1.7.10',
    libraries: []
  });
  assert.strictEqual(r.max, 8);
  assert.strictEqual(r.source, 'launchwrapper');
});

test('getJavaVersionRange: launchwrapper → max=8（最高优先级安全约束）', () => {
  const r = getJavaVersionRange('1.7.10-custom', {
    mainClass: 'net.minecraft.launchwrapper.launch',
    inheritsFrom: '1.7.10',
    libraries: []
  });
  assert.strictEqual(r.max, 8);
  assert.strictEqual(r.source, 'launchwrapper');
});

test('getJavaVersionRange: OptiFine 1.18 → max=18', () => {
  const r = getJavaVersionRange('1.18-OptiFine', {
    mainClass: 'net.minecraft.client.main.Main',
    inheritsFrom: '1.18',
    libraries: []
  });
  // OptiFine 限制 max=18，MC 1.18 强制 min=17
  assert.strictEqual(r.min, 17);
  assert.strictEqual(r.max, 18);
});

test('getJavaVersionRange: OptiFine 1.8-1.11 → 必须 Java 8', () => {
  const r = getJavaVersionRange('1.8.9-OptiFine', {
    mainClass: 'net.minecraft.client.main.Main',
    inheritsFrom: '1.8.9',
    libraries: []
  });
  assert.strictEqual(r.min, 8);
  assert.strictEqual(r.max, 8);
  assert.strictEqual(r.source, 'optifine');
});

test('getJavaVersionRange: min > max 时 max 兜底为 min', () => {
  // 构造极端场景：JSON 强制 Java 21 + launchwrapper 限制 max=8
  // 兜底逻辑：result.min > result.max → result.max = result.min
  const r = getJavaVersionRange('1.7.10-broken', {
    mainClass: 'net.minecraft.launchwrapper.launch',
    inheritsFrom: '1.7.10',
    javaVersion: { majorVersion: 21 },
    libraries: []
  });
  // JSON 强制 min=21，launchwrapper 限制 max=8，最终 min>max → max=min=21
  assert.ok(r.min >= 21);
  assert.strictEqual(r.max, r.min);
});

/* =================== getRequiredJavaVersion =================== */

test('getRequiredJavaVersion: 返回 range.min', () => {
  assert.strictEqual(getRequiredJavaVersion('1.20.1', { inheritsFrom: '1.20.1', libraries: [] }), 17);
  assert.strictEqual(getRequiredJavaVersion('1.20.5', { inheritsFrom: '1.20.5', libraries: [] }), 21);
  assert.strictEqual(getRequiredJavaVersion('1.16.5', { inheritsFrom: '1.16.5', libraries: [] }), 8);
});

test('getRequiredJavaVersion: 无 versionJson 时返回默认 8', () => {
  assert.strictEqual(getRequiredJavaVersion('custom', null), 8);
});
