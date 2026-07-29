/**
 * @file server/modpack/index.js - 整合包导入模块入口
 * @description 对外聚合导出，保持与原 server/modpack.js 相同的导出签名。
 */

const shared = require('./shared');
const modrinth = require('./modrinth');
const curseforge = require('./curseforge');
const importer = require('./importer');

module.exports = {
  _dedupeVersionId: shared._dedupeVersionId,
  _repairCorruptedModJars: shared._repairCorruptedModJars,
  isModpackPathSafe: shared.isModpackPathSafe,
  importModpackFromPath: importer.importModpackFromPath,
  _importMrpack: modrinth._importMrpack,
  _importCurseForge: curseforge._importCurseForge,
  _importHmcl: importer._importHmcl,
  _importRawZip: importer._importRawZip,
};
