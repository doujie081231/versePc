/**
 * @file server/http-client/index.js - HTTP/下载功能聚合入口
 * @description 重新导出所有原 server/http-client.js 的对外 API，保持调用方 require 路径不变。
 *   require('./http-client') 或 require('../http-client') 会自动解析到本文件。
 *
 *   对外 API 清单（25 个）：
 *     fetchWithProtocol, cachedFetchJSON, _fetchOnce,
 *     _isMirrorAvailable, _mirrorFailed, _mirrorSuccess,
 *     fetchJSON, fetchText, fetchWithRacing, httpGet,
 *     downloadFileH2, downloadFileChunked, _dlSingle,
 *     downloadFile, downloadFileSync, downloadFileSyncAsync, downloadFileToBuffer,
 *     getMirrorUrls, probeMirrorSpeed, getMirrorUrl,
 *     downloadMultiChunk, downloadFileWithMirror,
 *     fetchJSONWithMethod, fetchJSONWithAuth, _tryRemoveFile
 */

const { fetchWithProtocol, _fetchOnce, cachedFetchJSON, fetchJSON, fetchText, fetchWithRacing, httpGet, fetchJSONWithMethod, fetchJSONWithAuth } = require('./request');
const { _isMirrorAvailable, _mirrorFailed, _mirrorSuccess, getMirrorUrls, probeMirrorSpeed, getMirrorUrl } = require('./mirror');
const { downloadFileH2 } = require('./download-h2');
const { downloadFileChunked } = require('./download-chunked');
const { _dlSingle } = require('./download-single');
const { downloadFile, downloadFileSync, downloadFileSyncAsync, downloadFileToBuffer, downloadMultiChunk, downloadFileWithMirror, downloadFileRace } = require('./download');
const { _tryRemoveFile } = require('./file-ops');

module.exports = {
  fetchWithProtocol,
  cachedFetchJSON,
  _fetchOnce,
  _isMirrorAvailable,
  _mirrorFailed,
  _mirrorSuccess,
  fetchJSON,
  fetchText,
  fetchWithRacing,
  httpGet,
  downloadFileH2,
  downloadFileChunked,
  _dlSingle,
  downloadFile,
  downloadFileSync,
  downloadFileSyncAsync,
  downloadFileToBuffer,
  getMirrorUrls,
  probeMirrorSpeed,
  getMirrorUrl,
  downloadMultiChunk,
  downloadFileWithMirror,
  downloadFileRace,
  fetchJSONWithMethod,
  fetchJSONWithAuth,
  _tryRemoveFile
};
