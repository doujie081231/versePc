"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// index.ts
var index_exports = {};
__export(index_exports, {
  filterEntries: () => filterEntries,
  getEntriesRecord: () => getEntriesRecord,
  open: () => open,
  openEntryReadStream: () => openEntryReadStream,
  readAllEntries: () => readAllEntries,
  readEntry: () => readEntry,
  readEntryBuffered: () => readEntryBuffered,
  walkEntries: () => walkEntries,
  walkEntriesGenerator: () => walkEntriesGenerator
});
module.exports = __toCommonJS(index_exports);
var import_zlib = require("zlib");
var import_yauzl = require("@xmcl/yauzl");
async function open(target, options = { lazyEntries: true, autoClose: false }) {
  try {
    return await new Promise((resolve, reject) => {
      function handleZip(err, zipfile) {
        if (err || !zipfile) {
          reject(err);
        } else {
          resolve(zipfile);
        }
      }
      if (typeof target === "string") {
        (0, import_yauzl.open)(target, options, handleZip);
      } else if (target instanceof Buffer) {
        (0, import_yauzl.fromBuffer)(target, options, handleZip);
      } else {
        (0, import_yauzl.fromFd)(target, options, handleZip);
      }
    });
  } catch (e) {
    if (!e) {
      throw Object.assign(new Error("Fail to open zip file"), { name: "InvalidZipFile" });
    }
    if (e.message === "end of central directory record signature not found") {
      throw Object.assign(new Error("Invalid zip file"), { name: "InvalidZipFile" });
    }
    throw e;
  }
}
function openEntryReadStream(zip, entry, options) {
  return new Promise((resolve, reject) => {
    function handleStream(err, stream) {
      if (err || !stream) {
        reject(err);
      } else {
        resolve(stream);
      }
    }
    if (options) {
      zip.openReadStream(entry, options, handleStream);
    } else {
      zip.openReadStream(entry, handleStream);
    }
  });
}
async function readEntry(zip, entry, options) {
  const stream = await openEntryReadStream(zip, entry, options);
  const buffers = [];
  await new Promise((resolve, reject) => {
    stream.on("data", (chunk) => {
      buffers.push(chunk);
    });
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  return Buffer.concat(buffers);
}
var kDataStart = /* @__PURE__ */ Symbol("xmcl.dataStart");
function readerRead(reader, buffer, position, length) {
  return new Promise((resolve, reject) => {
    if (length === 0) {
      resolve();
      return;
    }
    reader.read(buffer, 0, length, position, (err) => err ? reject(err) : resolve());
  });
}
async function readEntryBuffered(zip, entry) {
  const method = entry.compressionMethod;
  if (entry.isEncrypted() || method !== 0 && method !== 8) {
    return readEntry(zip, entry);
  }
  const reader = zip.reader;
  let dataStart = entry[kDataStart];
  if (dataStart === void 0) {
    const header = Buffer.allocUnsafe(30);
    await readerRead(reader, header, entry.relativeOffsetOfLocalHeader, 30);
    if (header.readUInt32LE(0) !== 67324752) {
      return readEntry(zip, entry);
    }
    const fileNameLength = header.readUInt16LE(26);
    const extraFieldLength = header.readUInt16LE(28);
    dataStart = entry.relativeOffsetOfLocalHeader + 30 + fileNameLength + extraFieldLength;
    entry[kDataStart] = dataStart;
  }
  const compressed = Buffer.allocUnsafe(entry.compressedSize);
  await readerRead(reader, compressed, dataStart, entry.compressedSize);
  return method === 0 ? compressed : (0, import_zlib.inflateRawSync)(compressed);
}
async function* walkEntriesGenerator(zip) {
  let ended = false;
  let error;
  let resume = () => {
  };
  let wait = new Promise((resolve) => {
    resume = resolve;
  });
  const entries = [];
  const onEntry = (e) => {
    entries.push(e);
    resume();
  };
  const onEnd = () => {
    ended = true;
    resume();
  };
  const onError = (e) => {
    error = e;
    resume();
  };
  zip.addListener("entry", onEntry).addListener("end", onEnd).addListener("error", onError);
  try {
    while (!ended) {
      if (zip.lazyEntries) {
        zip.readEntry();
      }
      await wait;
      if (error) {
        throw error;
      }
      while (entries.length > 0 && !ended) {
        ended = !!(yield entries.pop());
      }
      wait = new Promise((resolve) => {
        resume = resolve;
      });
    }
  } finally {
    zip.removeListener("entry", onEntry).removeListener("end", onEnd).removeListener("error", onError);
  }
}
async function filterEntries(zip, entries) {
  const bags = entries.map((e) => [e, void 0]);
  let remaining = entries.length;
  for await (const entry of walkEntriesGenerator(zip)) {
    for (const bag of bags) {
      if (typeof bag[0] === "string") {
        if (bag[0] === entry.fileName) {
          bag[1] = entry;
          remaining -= 1;
        }
      } else {
        if (bag[0](entry)) {
          bag[1] = entry;
          remaining -= 1;
        }
      }
      if (remaining === 0) break;
    }
  }
  return bags.map((b) => b[1]);
}
async function walkEntries(zip, entryHandler) {
  const itr = walkEntriesGenerator(zip);
  for await (const entry of itr) {
    const result = await entryHandler(entry);
    if (result) {
      break;
    }
  }
}
function getEntriesRecord(entries) {
  const record = {};
  for (const entry of entries) {
    record[entry.fileName] = entry;
  }
  return record;
}
async function readAllEntries(zipFile) {
  const entries = [];
  for await (const entry of walkEntriesGenerator(zipFile)) {
    entries.push(entry);
  }
  return entries;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  filterEntries,
  getEntriesRecord,
  open,
  openEntryReadStream,
  readAllEntries,
  readEntry,
  readEntryBuffered,
  walkEntries,
  walkEntriesGenerator
});
//# sourceMappingURL=index.js.map
