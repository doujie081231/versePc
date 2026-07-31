var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../node_modules/.pnpm/buffer-crc32@0.2.13/node_modules/buffer-crc32/index.js
var require_buffer_crc32 = __commonJS({
  "../../node_modules/.pnpm/buffer-crc32@0.2.13/node_modules/buffer-crc32/index.js"(exports, module) {
    var Buffer2 = __require("buffer").Buffer;
    var CRC_TABLE = [
      0,
      1996959894,
      3993919788,
      2567524794,
      124634137,
      1886057615,
      3915621685,
      2657392035,
      249268274,
      2044508324,
      3772115230,
      2547177864,
      162941995,
      2125561021,
      3887607047,
      2428444049,
      498536548,
      1789927666,
      4089016648,
      2227061214,
      450548861,
      1843258603,
      4107580753,
      2211677639,
      325883990,
      1684777152,
      4251122042,
      2321926636,
      335633487,
      1661365465,
      4195302755,
      2366115317,
      997073096,
      1281953886,
      3579855332,
      2724688242,
      1006888145,
      1258607687,
      3524101629,
      2768942443,
      901097722,
      1119000684,
      3686517206,
      2898065728,
      853044451,
      1172266101,
      3705015759,
      2882616665,
      651767980,
      1373503546,
      3369554304,
      3218104598,
      565507253,
      1454621731,
      3485111705,
      3099436303,
      671266974,
      1594198024,
      3322730930,
      2970347812,
      795835527,
      1483230225,
      3244367275,
      3060149565,
      1994146192,
      31158534,
      2563907772,
      4023717930,
      1907459465,
      112637215,
      2680153253,
      3904427059,
      2013776290,
      251722036,
      2517215374,
      3775830040,
      2137656763,
      141376813,
      2439277719,
      3865271297,
      1802195444,
      476864866,
      2238001368,
      4066508878,
      1812370925,
      453092731,
      2181625025,
      4111451223,
      1706088902,
      314042704,
      2344532202,
      4240017532,
      1658658271,
      366619977,
      2362670323,
      4224994405,
      1303535960,
      984961486,
      2747007092,
      3569037538,
      1256170817,
      1037604311,
      2765210733,
      3554079995,
      1131014506,
      879679996,
      2909243462,
      3663771856,
      1141124467,
      855842277,
      2852801631,
      3708648649,
      1342533948,
      654459306,
      3188396048,
      3373015174,
      1466479909,
      544179635,
      3110523913,
      3462522015,
      1591671054,
      702138776,
      2966460450,
      3352799412,
      1504918807,
      783551873,
      3082640443,
      3233442989,
      3988292384,
      2596254646,
      62317068,
      1957810842,
      3939845945,
      2647816111,
      81470997,
      1943803523,
      3814918930,
      2489596804,
      225274430,
      2053790376,
      3826175755,
      2466906013,
      167816743,
      2097651377,
      4027552580,
      2265490386,
      503444072,
      1762050814,
      4150417245,
      2154129355,
      426522225,
      1852507879,
      4275313526,
      2312317920,
      282753626,
      1742555852,
      4189708143,
      2394877945,
      397917763,
      1622183637,
      3604390888,
      2714866558,
      953729732,
      1340076626,
      3518719985,
      2797360999,
      1068828381,
      1219638859,
      3624741850,
      2936675148,
      906185462,
      1090812512,
      3747672003,
      2825379669,
      829329135,
      1181335161,
      3412177804,
      3160834842,
      628085408,
      1382605366,
      3423369109,
      3138078467,
      570562233,
      1426400815,
      3317316542,
      2998733608,
      733239954,
      1555261956,
      3268935591,
      3050360625,
      752459403,
      1541320221,
      2607071920,
      3965973030,
      1969922972,
      40735498,
      2617837225,
      3943577151,
      1913087877,
      83908371,
      2512341634,
      3803740692,
      2075208622,
      213261112,
      2463272603,
      3855990285,
      2094854071,
      198958881,
      2262029012,
      4057260610,
      1759359992,
      534414190,
      2176718541,
      4139329115,
      1873836001,
      414664567,
      2282248934,
      4279200368,
      1711684554,
      285281116,
      2405801727,
      4167216745,
      1634467795,
      376229701,
      2685067896,
      3608007406,
      1308918612,
      956543938,
      2808555105,
      3495958263,
      1231636301,
      1047427035,
      2932959818,
      3654703836,
      1088359270,
      936918e3,
      2847714899,
      3736837829,
      1202900863,
      817233897,
      3183342108,
      3401237130,
      1404277552,
      615818150,
      3134207493,
      3453421203,
      1423857449,
      601450431,
      3009837614,
      3294710456,
      1567103746,
      711928724,
      3020668471,
      3272380065,
      1510334235,
      755167117
    ];
    if (typeof Int32Array !== "undefined") {
      CRC_TABLE = new Int32Array(CRC_TABLE);
    }
    function ensureBuffer(input) {
      if (Buffer2.isBuffer(input)) {
        return input;
      }
      var hasNewBufferAPI = typeof Buffer2.alloc === "function" && typeof Buffer2.from === "function";
      if (typeof input === "number") {
        return hasNewBufferAPI ? Buffer2.alloc(input) : new Buffer2(input);
      } else if (typeof input === "string") {
        return hasNewBufferAPI ? Buffer2.from(input) : new Buffer2(input);
      } else {
        throw new Error("input must be buffer, number, or string, received " + typeof input);
      }
    }
    function bufferizeInt(num) {
      var tmp = ensureBuffer(4);
      tmp.writeInt32BE(num, 0);
      return tmp;
    }
    function _crc32(buf, previous) {
      buf = ensureBuffer(buf);
      if (Buffer2.isBuffer(previous)) {
        previous = previous.readUInt32BE(0);
      }
      var crc = ~~previous ^ -1;
      for (var n = 0; n < buf.length; n++) {
        crc = CRC_TABLE[(crc ^ buf[n]) & 255] ^ crc >>> 8;
      }
      return crc ^ -1;
    }
    function crc32() {
      return bufferizeInt(_crc32.apply(null, arguments));
    }
    crc32.signed = function() {
      return _crc32.apply(null, arguments);
    };
    crc32.unsigned = function() {
      return _crc32.apply(null, arguments) >>> 0;
    };
    module.exports = crc32;
  }
});

// ../../node_modules/.pnpm/yazl@2.5.1/node_modules/yazl/index.js
var require_yazl = __commonJS({
  "../../node_modules/.pnpm/yazl@2.5.1/node_modules/yazl/index.js"(exports) {
    var fs = __require("fs");
    var Transform = __require("stream").Transform;
    var PassThrough = __require("stream").PassThrough;
    var zlib = __require("zlib");
    var util = __require("util");
    var EventEmitter = __require("events").EventEmitter;
    var crc32 = require_buffer_crc32();
    exports.ZipFile = ZipFile;
    exports.dateToDosDateTime = dateToDosDateTime;
    util.inherits(ZipFile, EventEmitter);
    function ZipFile() {
      this.outputStream = new PassThrough();
      this.entries = [];
      this.outputStreamCursor = 0;
      this.ended = false;
      this.allDone = false;
      this.forceZip64Eocd = false;
    }
    ZipFile.prototype.addFile = function(realPath, metadataPath, options) {
      var self = this;
      metadataPath = validateMetadataPath(metadataPath, false);
      if (options == null) options = {};
      var entry = new Entry(metadataPath, false, options);
      self.entries.push(entry);
      fs.stat(realPath, function(err, stats) {
        if (err) return self.emit("error", err);
        if (!stats.isFile()) return self.emit("error", new Error("not a file: " + realPath));
        entry.uncompressedSize = stats.size;
        if (options.mtime == null) entry.setLastModDate(stats.mtime);
        if (options.mode == null) entry.setFileAttributesMode(stats.mode);
        entry.setFileDataPumpFunction(function() {
          var readStream = fs.createReadStream(realPath);
          entry.state = Entry.FILE_DATA_IN_PROGRESS;
          readStream.on("error", function(err2) {
            self.emit("error", err2);
          });
          pumpFileDataReadStream(self, entry, readStream);
        });
        pumpEntries(self);
      });
    };
    ZipFile.prototype.addReadStream = function(readStream, metadataPath, options) {
      var self = this;
      metadataPath = validateMetadataPath(metadataPath, false);
      if (options == null) options = {};
      var entry = new Entry(metadataPath, false, options);
      self.entries.push(entry);
      entry.setFileDataPumpFunction(function() {
        entry.state = Entry.FILE_DATA_IN_PROGRESS;
        pumpFileDataReadStream(self, entry, readStream);
      });
      pumpEntries(self);
    };
    ZipFile.prototype.addBuffer = function(buffer, metadataPath, options) {
      var self = this;
      metadataPath = validateMetadataPath(metadataPath, false);
      if (buffer.length > 1073741823) throw new Error("buffer too large: " + buffer.length + " > 1073741823");
      if (options == null) options = {};
      if (options.size != null) throw new Error("options.size not allowed");
      var entry = new Entry(metadataPath, false, options);
      entry.uncompressedSize = buffer.length;
      entry.crc32 = crc32.unsigned(buffer);
      entry.crcAndFileSizeKnown = true;
      self.entries.push(entry);
      if (!entry.compress) {
        setCompressedBuffer(buffer);
      } else {
        zlib.deflateRaw(buffer, function(err, compressedBuffer) {
          setCompressedBuffer(compressedBuffer);
        });
      }
      function setCompressedBuffer(compressedBuffer) {
        entry.compressedSize = compressedBuffer.length;
        entry.setFileDataPumpFunction(function() {
          writeToOutputStream(self, compressedBuffer);
          writeToOutputStream(self, entry.getDataDescriptor());
          entry.state = Entry.FILE_DATA_DONE;
          setImmediate(function() {
            pumpEntries(self);
          });
        });
        pumpEntries(self);
      }
    };
    ZipFile.prototype.addEmptyDirectory = function(metadataPath, options) {
      var self = this;
      metadataPath = validateMetadataPath(metadataPath, true);
      if (options == null) options = {};
      if (options.size != null) throw new Error("options.size not allowed");
      if (options.compress != null) throw new Error("options.compress not allowed");
      var entry = new Entry(metadataPath, true, options);
      self.entries.push(entry);
      entry.setFileDataPumpFunction(function() {
        writeToOutputStream(self, entry.getDataDescriptor());
        entry.state = Entry.FILE_DATA_DONE;
        pumpEntries(self);
      });
      pumpEntries(self);
    };
    var eocdrSignatureBuffer = bufferFrom([80, 75, 5, 6]);
    ZipFile.prototype.end = function(options, finalSizeCallback) {
      if (typeof options === "function") {
        finalSizeCallback = options;
        options = null;
      }
      if (options == null) options = {};
      if (this.ended) return;
      this.ended = true;
      this.finalSizeCallback = finalSizeCallback;
      this.forceZip64Eocd = !!options.forceZip64Format;
      if (options.comment) {
        if (typeof options.comment === "string") {
          this.comment = encodeCp437(options.comment);
        } else {
          this.comment = options.comment;
        }
        if (this.comment.length > 65535) throw new Error("comment is too large");
        if (bufferIncludes(this.comment, eocdrSignatureBuffer)) throw new Error("comment contains end of central directory record signature");
      } else {
        this.comment = EMPTY_BUFFER;
      }
      pumpEntries(this);
    };
    function writeToOutputStream(self, buffer) {
      self.outputStream.write(buffer);
      self.outputStreamCursor += buffer.length;
    }
    function pumpFileDataReadStream(self, entry, readStream) {
      var crc32Watcher = new Crc32Watcher();
      var uncompressedSizeCounter = new ByteCounter();
      var compressor = entry.compress ? new zlib.DeflateRaw() : new PassThrough();
      var compressedSizeCounter = new ByteCounter();
      readStream.pipe(crc32Watcher).pipe(uncompressedSizeCounter).pipe(compressor).pipe(compressedSizeCounter).pipe(self.outputStream, { end: false });
      compressedSizeCounter.on("end", function() {
        entry.crc32 = crc32Watcher.crc32;
        if (entry.uncompressedSize == null) {
          entry.uncompressedSize = uncompressedSizeCounter.byteCount;
        } else {
          if (entry.uncompressedSize !== uncompressedSizeCounter.byteCount) return self.emit("error", new Error("file data stream has unexpected number of bytes"));
        }
        entry.compressedSize = compressedSizeCounter.byteCount;
        self.outputStreamCursor += entry.compressedSize;
        writeToOutputStream(self, entry.getDataDescriptor());
        entry.state = Entry.FILE_DATA_DONE;
        pumpEntries(self);
      });
    }
    function pumpEntries(self) {
      if (self.allDone) return;
      if (self.ended && self.finalSizeCallback != null) {
        var finalSize = calculateFinalSize(self);
        if (finalSize != null) {
          self.finalSizeCallback(finalSize);
          self.finalSizeCallback = null;
        }
      }
      var entry = getFirstNotDoneEntry();
      function getFirstNotDoneEntry() {
        for (var i = 0; i < self.entries.length; i++) {
          var entry2 = self.entries[i];
          if (entry2.state < Entry.FILE_DATA_DONE) return entry2;
        }
        return null;
      }
      if (entry != null) {
        if (entry.state < Entry.READY_TO_PUMP_FILE_DATA) return;
        if (entry.state === Entry.FILE_DATA_IN_PROGRESS) return;
        entry.relativeOffsetOfLocalHeader = self.outputStreamCursor;
        var localFileHeader = entry.getLocalFileHeader();
        writeToOutputStream(self, localFileHeader);
        entry.doFileDataPump();
      } else {
        if (self.ended) {
          self.offsetOfStartOfCentralDirectory = self.outputStreamCursor;
          self.entries.forEach(function(entry2) {
            var centralDirectoryRecord = entry2.getCentralDirectoryRecord();
            writeToOutputStream(self, centralDirectoryRecord);
          });
          writeToOutputStream(self, getEndOfCentralDirectoryRecord(self));
          self.outputStream.end();
          self.allDone = true;
        }
      }
    }
    function calculateFinalSize(self) {
      var pretendOutputCursor = 0;
      var centralDirectorySize = 0;
      for (var i = 0; i < self.entries.length; i++) {
        var entry = self.entries[i];
        if (entry.compress) return -1;
        if (entry.state >= Entry.READY_TO_PUMP_FILE_DATA) {
          if (entry.uncompressedSize == null) return -1;
        } else {
          if (entry.uncompressedSize == null) return null;
        }
        entry.relativeOffsetOfLocalHeader = pretendOutputCursor;
        var useZip64Format = entry.useZip64Format();
        pretendOutputCursor += LOCAL_FILE_HEADER_FIXED_SIZE + entry.utf8FileName.length;
        pretendOutputCursor += entry.uncompressedSize;
        if (!entry.crcAndFileSizeKnown) {
          if (useZip64Format) {
            pretendOutputCursor += ZIP64_DATA_DESCRIPTOR_SIZE;
          } else {
            pretendOutputCursor += DATA_DESCRIPTOR_SIZE;
          }
        }
        centralDirectorySize += CENTRAL_DIRECTORY_RECORD_FIXED_SIZE + entry.utf8FileName.length + entry.fileComment.length;
        if (useZip64Format) {
          centralDirectorySize += ZIP64_EXTENDED_INFORMATION_EXTRA_FIELD_SIZE;
        }
      }
      var endOfCentralDirectorySize = 0;
      if (self.forceZip64Eocd || self.entries.length >= 65535 || centralDirectorySize >= 65535 || pretendOutputCursor >= 4294967295) {
        endOfCentralDirectorySize += ZIP64_END_OF_CENTRAL_DIRECTORY_RECORD_SIZE + ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIZE;
      }
      endOfCentralDirectorySize += END_OF_CENTRAL_DIRECTORY_RECORD_SIZE + self.comment.length;
      return pretendOutputCursor + centralDirectorySize + endOfCentralDirectorySize;
    }
    var ZIP64_END_OF_CENTRAL_DIRECTORY_RECORD_SIZE = 56;
    var ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIZE = 20;
    var END_OF_CENTRAL_DIRECTORY_RECORD_SIZE = 22;
    function getEndOfCentralDirectoryRecord(self, actuallyJustTellMeHowLongItWouldBe) {
      var needZip64Format = false;
      var normalEntriesLength = self.entries.length;
      if (self.forceZip64Eocd || self.entries.length >= 65535) {
        normalEntriesLength = 65535;
        needZip64Format = true;
      }
      var sizeOfCentralDirectory = self.outputStreamCursor - self.offsetOfStartOfCentralDirectory;
      var normalSizeOfCentralDirectory = sizeOfCentralDirectory;
      if (self.forceZip64Eocd || sizeOfCentralDirectory >= 4294967295) {
        normalSizeOfCentralDirectory = 4294967295;
        needZip64Format = true;
      }
      var normalOffsetOfStartOfCentralDirectory = self.offsetOfStartOfCentralDirectory;
      if (self.forceZip64Eocd || self.offsetOfStartOfCentralDirectory >= 4294967295) {
        normalOffsetOfStartOfCentralDirectory = 4294967295;
        needZip64Format = true;
      }
      if (actuallyJustTellMeHowLongItWouldBe) {
        if (needZip64Format) {
          return ZIP64_END_OF_CENTRAL_DIRECTORY_RECORD_SIZE + ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIZE + END_OF_CENTRAL_DIRECTORY_RECORD_SIZE;
        } else {
          return END_OF_CENTRAL_DIRECTORY_RECORD_SIZE;
        }
      }
      var eocdrBuffer = bufferAlloc(END_OF_CENTRAL_DIRECTORY_RECORD_SIZE + self.comment.length);
      eocdrBuffer.writeUInt32LE(101010256, 0);
      eocdrBuffer.writeUInt16LE(0, 4);
      eocdrBuffer.writeUInt16LE(0, 6);
      eocdrBuffer.writeUInt16LE(normalEntriesLength, 8);
      eocdrBuffer.writeUInt16LE(normalEntriesLength, 10);
      eocdrBuffer.writeUInt32LE(normalSizeOfCentralDirectory, 12);
      eocdrBuffer.writeUInt32LE(normalOffsetOfStartOfCentralDirectory, 16);
      eocdrBuffer.writeUInt16LE(self.comment.length, 20);
      self.comment.copy(eocdrBuffer, 22);
      if (!needZip64Format) return eocdrBuffer;
      var zip64EocdrBuffer = bufferAlloc(ZIP64_END_OF_CENTRAL_DIRECTORY_RECORD_SIZE);
      zip64EocdrBuffer.writeUInt32LE(101075792, 0);
      writeUInt64LE(zip64EocdrBuffer, ZIP64_END_OF_CENTRAL_DIRECTORY_RECORD_SIZE - 12, 4);
      zip64EocdrBuffer.writeUInt16LE(VERSION_MADE_BY, 12);
      zip64EocdrBuffer.writeUInt16LE(VERSION_NEEDED_TO_EXTRACT_ZIP64, 14);
      zip64EocdrBuffer.writeUInt32LE(0, 16);
      zip64EocdrBuffer.writeUInt32LE(0, 20);
      writeUInt64LE(zip64EocdrBuffer, self.entries.length, 24);
      writeUInt64LE(zip64EocdrBuffer, self.entries.length, 32);
      writeUInt64LE(zip64EocdrBuffer, sizeOfCentralDirectory, 40);
      writeUInt64LE(zip64EocdrBuffer, self.offsetOfStartOfCentralDirectory, 48);
      var zip64EocdlBuffer = bufferAlloc(ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIZE);
      zip64EocdlBuffer.writeUInt32LE(117853008, 0);
      zip64EocdlBuffer.writeUInt32LE(0, 4);
      writeUInt64LE(zip64EocdlBuffer, self.outputStreamCursor, 8);
      zip64EocdlBuffer.writeUInt32LE(1, 16);
      return Buffer.concat([
        zip64EocdrBuffer,
        zip64EocdlBuffer,
        eocdrBuffer
      ]);
    }
    function validateMetadataPath(metadataPath, isDirectory) {
      if (metadataPath === "") throw new Error("empty metadataPath");
      metadataPath = metadataPath.replace(/\\/g, "/");
      if (/^[a-zA-Z]:/.test(metadataPath) || /^\//.test(metadataPath)) throw new Error("absolute path: " + metadataPath);
      if (metadataPath.split("/").indexOf("..") !== -1) throw new Error("invalid relative path: " + metadataPath);
      var looksLikeDirectory = /\/$/.test(metadataPath);
      if (isDirectory) {
        if (!looksLikeDirectory) metadataPath += "/";
      } else {
        if (looksLikeDirectory) throw new Error("file path cannot end with '/': " + metadataPath);
      }
      return metadataPath;
    }
    var EMPTY_BUFFER = bufferAlloc(0);
    function Entry(metadataPath, isDirectory, options) {
      this.utf8FileName = bufferFrom(metadataPath);
      if (this.utf8FileName.length > 65535) throw new Error("utf8 file name too long. " + utf8FileName.length + " > 65535");
      this.isDirectory = isDirectory;
      this.state = Entry.WAITING_FOR_METADATA;
      this.setLastModDate(options.mtime != null ? options.mtime : /* @__PURE__ */ new Date());
      if (options.mode != null) {
        this.setFileAttributesMode(options.mode);
      } else {
        this.setFileAttributesMode(isDirectory ? 16893 : 33204);
      }
      if (isDirectory) {
        this.crcAndFileSizeKnown = true;
        this.crc32 = 0;
        this.uncompressedSize = 0;
        this.compressedSize = 0;
      } else {
        this.crcAndFileSizeKnown = false;
        this.crc32 = null;
        this.uncompressedSize = null;
        this.compressedSize = null;
        if (options.size != null) this.uncompressedSize = options.size;
      }
      if (isDirectory) {
        this.compress = false;
      } else {
        this.compress = true;
        if (options.compress != null) this.compress = !!options.compress;
      }
      this.forceZip64Format = !!options.forceZip64Format;
      if (options.fileComment) {
        if (typeof options.fileComment === "string") {
          this.fileComment = bufferFrom(options.fileComment, "utf-8");
        } else {
          this.fileComment = options.fileComment;
        }
        if (this.fileComment.length > 65535) throw new Error("fileComment is too large");
      } else {
        this.fileComment = EMPTY_BUFFER;
      }
    }
    Entry.WAITING_FOR_METADATA = 0;
    Entry.READY_TO_PUMP_FILE_DATA = 1;
    Entry.FILE_DATA_IN_PROGRESS = 2;
    Entry.FILE_DATA_DONE = 3;
    Entry.prototype.setLastModDate = function(date) {
      var dosDateTime = dateToDosDateTime(date);
      this.lastModFileTime = dosDateTime.time;
      this.lastModFileDate = dosDateTime.date;
    };
    Entry.prototype.setFileAttributesMode = function(mode) {
      if ((mode & 65535) !== mode) throw new Error("invalid mode. expected: 0 <= " + mode + " <= 65535");
      this.externalFileAttributes = mode << 16 >>> 0;
    };
    Entry.prototype.setFileDataPumpFunction = function(doFileDataPump) {
      this.doFileDataPump = doFileDataPump;
      this.state = Entry.READY_TO_PUMP_FILE_DATA;
    };
    Entry.prototype.useZip64Format = function() {
      return this.forceZip64Format || this.uncompressedSize != null && this.uncompressedSize > 4294967294 || this.compressedSize != null && this.compressedSize > 4294967294 || this.relativeOffsetOfLocalHeader != null && this.relativeOffsetOfLocalHeader > 4294967294;
    };
    var LOCAL_FILE_HEADER_FIXED_SIZE = 30;
    var VERSION_NEEDED_TO_EXTRACT_UTF8 = 20;
    var VERSION_NEEDED_TO_EXTRACT_ZIP64 = 45;
    var VERSION_MADE_BY = 3 << 8 | 63;
    var FILE_NAME_IS_UTF8 = 1 << 11;
    var UNKNOWN_CRC32_AND_FILE_SIZES = 1 << 3;
    Entry.prototype.getLocalFileHeader = function() {
      var crc322 = 0;
      var compressedSize = 0;
      var uncompressedSize = 0;
      if (this.crcAndFileSizeKnown) {
        crc322 = this.crc32;
        compressedSize = this.compressedSize;
        uncompressedSize = this.uncompressedSize;
      }
      var fixedSizeStuff = bufferAlloc(LOCAL_FILE_HEADER_FIXED_SIZE);
      var generalPurposeBitFlag = FILE_NAME_IS_UTF8;
      if (!this.crcAndFileSizeKnown) generalPurposeBitFlag |= UNKNOWN_CRC32_AND_FILE_SIZES;
      fixedSizeStuff.writeUInt32LE(67324752, 0);
      fixedSizeStuff.writeUInt16LE(VERSION_NEEDED_TO_EXTRACT_UTF8, 4);
      fixedSizeStuff.writeUInt16LE(generalPurposeBitFlag, 6);
      fixedSizeStuff.writeUInt16LE(this.getCompressionMethod(), 8);
      fixedSizeStuff.writeUInt16LE(this.lastModFileTime, 10);
      fixedSizeStuff.writeUInt16LE(this.lastModFileDate, 12);
      fixedSizeStuff.writeUInt32LE(crc322, 14);
      fixedSizeStuff.writeUInt32LE(compressedSize, 18);
      fixedSizeStuff.writeUInt32LE(uncompressedSize, 22);
      fixedSizeStuff.writeUInt16LE(this.utf8FileName.length, 26);
      fixedSizeStuff.writeUInt16LE(0, 28);
      return Buffer.concat([
        fixedSizeStuff,
        // file name (variable size)
        this.utf8FileName
        // extra field (variable size)
        // no extra fields
      ]);
    };
    var DATA_DESCRIPTOR_SIZE = 16;
    var ZIP64_DATA_DESCRIPTOR_SIZE = 24;
    Entry.prototype.getDataDescriptor = function() {
      if (this.crcAndFileSizeKnown) {
        return EMPTY_BUFFER;
      }
      if (!this.useZip64Format()) {
        var buffer = bufferAlloc(DATA_DESCRIPTOR_SIZE);
        buffer.writeUInt32LE(134695760, 0);
        buffer.writeUInt32LE(this.crc32, 4);
        buffer.writeUInt32LE(this.compressedSize, 8);
        buffer.writeUInt32LE(this.uncompressedSize, 12);
        return buffer;
      } else {
        var buffer = bufferAlloc(ZIP64_DATA_DESCRIPTOR_SIZE);
        buffer.writeUInt32LE(134695760, 0);
        buffer.writeUInt32LE(this.crc32, 4);
        writeUInt64LE(buffer, this.compressedSize, 8);
        writeUInt64LE(buffer, this.uncompressedSize, 16);
        return buffer;
      }
    };
    var CENTRAL_DIRECTORY_RECORD_FIXED_SIZE = 46;
    var ZIP64_EXTENDED_INFORMATION_EXTRA_FIELD_SIZE = 28;
    Entry.prototype.getCentralDirectoryRecord = function() {
      var fixedSizeStuff = bufferAlloc(CENTRAL_DIRECTORY_RECORD_FIXED_SIZE);
      var generalPurposeBitFlag = FILE_NAME_IS_UTF8;
      if (!this.crcAndFileSizeKnown) generalPurposeBitFlag |= UNKNOWN_CRC32_AND_FILE_SIZES;
      var normalCompressedSize = this.compressedSize;
      var normalUncompressedSize = this.uncompressedSize;
      var normalRelativeOffsetOfLocalHeader = this.relativeOffsetOfLocalHeader;
      var versionNeededToExtract;
      var zeiefBuffer;
      if (this.useZip64Format()) {
        normalCompressedSize = 4294967295;
        normalUncompressedSize = 4294967295;
        normalRelativeOffsetOfLocalHeader = 4294967295;
        versionNeededToExtract = VERSION_NEEDED_TO_EXTRACT_ZIP64;
        zeiefBuffer = bufferAlloc(ZIP64_EXTENDED_INFORMATION_EXTRA_FIELD_SIZE);
        zeiefBuffer.writeUInt16LE(1, 0);
        zeiefBuffer.writeUInt16LE(ZIP64_EXTENDED_INFORMATION_EXTRA_FIELD_SIZE - 4, 2);
        writeUInt64LE(zeiefBuffer, this.uncompressedSize, 4);
        writeUInt64LE(zeiefBuffer, this.compressedSize, 12);
        writeUInt64LE(zeiefBuffer, this.relativeOffsetOfLocalHeader, 20);
      } else {
        versionNeededToExtract = VERSION_NEEDED_TO_EXTRACT_UTF8;
        zeiefBuffer = EMPTY_BUFFER;
      }
      fixedSizeStuff.writeUInt32LE(33639248, 0);
      fixedSizeStuff.writeUInt16LE(VERSION_MADE_BY, 4);
      fixedSizeStuff.writeUInt16LE(versionNeededToExtract, 6);
      fixedSizeStuff.writeUInt16LE(generalPurposeBitFlag, 8);
      fixedSizeStuff.writeUInt16LE(this.getCompressionMethod(), 10);
      fixedSizeStuff.writeUInt16LE(this.lastModFileTime, 12);
      fixedSizeStuff.writeUInt16LE(this.lastModFileDate, 14);
      fixedSizeStuff.writeUInt32LE(this.crc32, 16);
      fixedSizeStuff.writeUInt32LE(normalCompressedSize, 20);
      fixedSizeStuff.writeUInt32LE(normalUncompressedSize, 24);
      fixedSizeStuff.writeUInt16LE(this.utf8FileName.length, 28);
      fixedSizeStuff.writeUInt16LE(zeiefBuffer.length, 30);
      fixedSizeStuff.writeUInt16LE(this.fileComment.length, 32);
      fixedSizeStuff.writeUInt16LE(0, 34);
      fixedSizeStuff.writeUInt16LE(0, 36);
      fixedSizeStuff.writeUInt32LE(this.externalFileAttributes, 38);
      fixedSizeStuff.writeUInt32LE(normalRelativeOffsetOfLocalHeader, 42);
      return Buffer.concat([
        fixedSizeStuff,
        // file name (variable size)
        this.utf8FileName,
        // extra field (variable size)
        zeiefBuffer,
        // file comment (variable size)
        this.fileComment
      ]);
    };
    Entry.prototype.getCompressionMethod = function() {
      var NO_COMPRESSION = 0;
      var DEFLATE_COMPRESSION = 8;
      return this.compress ? DEFLATE_COMPRESSION : NO_COMPRESSION;
    };
    function dateToDosDateTime(jsDate) {
      var date = 0;
      date |= jsDate.getDate() & 31;
      date |= (jsDate.getMonth() + 1 & 15) << 5;
      date |= (jsDate.getFullYear() - 1980 & 127) << 9;
      var time = 0;
      time |= Math.floor(jsDate.getSeconds() / 2);
      time |= (jsDate.getMinutes() & 63) << 5;
      time |= (jsDate.getHours() & 31) << 11;
      return { date, time };
    }
    function writeUInt64LE(buffer, n, offset) {
      var high = Math.floor(n / 4294967296);
      var low = n % 4294967296;
      buffer.writeUInt32LE(low, offset);
      buffer.writeUInt32LE(high, offset + 4);
    }
    util.inherits(ByteCounter, Transform);
    function ByteCounter(options) {
      Transform.call(this, options);
      this.byteCount = 0;
    }
    ByteCounter.prototype._transform = function(chunk, encoding, cb) {
      this.byteCount += chunk.length;
      cb(null, chunk);
    };
    util.inherits(Crc32Watcher, Transform);
    function Crc32Watcher(options) {
      Transform.call(this, options);
      this.crc32 = 0;
    }
    Crc32Watcher.prototype._transform = function(chunk, encoding, cb) {
      this.crc32 = crc32.unsigned(chunk, this.crc32);
      cb(null, chunk);
    };
    var cp437 = "\0\u263A\u263B\u2665\u2666\u2663\u2660\u2022\u25D8\u25CB\u25D9\u2642\u2640\u266A\u266B\u263C\u25BA\u25C4\u2195\u203C\xB6\xA7\u25AC\u21A8\u2191\u2193\u2192\u2190\u221F\u2194\u25B2\u25BC !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u2302\xC7\xFC\xE9\xE2\xE4\xE0\xE5\xE7\xEA\xEB\xE8\xEF\xEE\xEC\xC4\xC5\xC9\xE6\xC6\xF4\xF6\xF2\xFB\xF9\xFF\xD6\xDC\xA2\xA3\xA5\u20A7\u0192\xE1\xED\xF3\xFA\xF1\xD1\xAA\xBA\xBF\u2310\xAC\xBD\xBC\xA1\xAB\xBB\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255D\u255C\u255B\u2510\u2514\u2534\u252C\u251C\u2500\u253C\u255E\u255F\u255A\u2554\u2569\u2566\u2560\u2550\u256C\u2567\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256B\u256A\u2518\u250C\u2588\u2584\u258C\u2590\u2580\u03B1\xDF\u0393\u03C0\u03A3\u03C3\xB5\u03C4\u03A6\u0398\u03A9\u03B4\u221E\u03C6\u03B5\u2229\u2261\xB1\u2265\u2264\u2320\u2321\xF7\u2248\xB0\u2219\xB7\u221A\u207F\xB2\u25A0\xA0";
    if (cp437.length !== 256) throw new Error("assertion failure");
    var reverseCp437 = null;
    function encodeCp437(string) {
      if (/^[\x20-\x7e]*$/.test(string)) {
        return bufferFrom(string, "utf-8");
      }
      if (reverseCp437 == null) {
        reverseCp437 = {};
        for (var i = 0; i < cp437.length; i++) {
          reverseCp437[cp437[i]] = i;
        }
      }
      var result = bufferAlloc(string.length);
      for (var i = 0; i < string.length; i++) {
        var b = reverseCp437[string[i]];
        if (b == null) throw new Error("character not encodable in CP437: " + JSON.stringify(string[i]));
        result[i] = b;
      }
      return result;
    }
    function bufferAlloc(size) {
      bufferAlloc = modern;
      try {
        return bufferAlloc(size);
      } catch (e) {
        bufferAlloc = legacy;
        return bufferAlloc(size);
      }
      function modern(size2) {
        return Buffer.allocUnsafe(size2);
      }
      function legacy(size2) {
        return new Buffer(size2);
      }
    }
    function bufferFrom(something, encoding) {
      bufferFrom = modern;
      try {
        return bufferFrom(something, encoding);
      } catch (e) {
        bufferFrom = legacy;
        return bufferFrom(something, encoding);
      }
      function modern(something2, encoding2) {
        return Buffer.from(something2, encoding2);
      }
      function legacy(something2, encoding2) {
        return new Buffer(something2, encoding2);
      }
    }
    function bufferIncludes(buffer, content) {
      bufferIncludes = modern;
      try {
        return bufferIncludes(buffer, content);
      } catch (e) {
        bufferIncludes = legacy;
        return bufferIncludes(buffer, content);
      }
      function modern(buffer2, content2) {
        return buffer2.includes(content2);
      }
      function legacy(buffer2, content2) {
        for (var i = 0; i <= buffer2.length - content2.length; i++) {
          for (var j = 0; ; j++) {
            if (j === content2.length) return true;
            if (buffer2[i + j] !== content2[j]) break;
          }
        }
        return false;
      }
    }
  }
});

// ../../node_modules/.pnpm/queue-tick@1.0.1/node_modules/queue-tick/queue-microtask.js
var require_queue_microtask = __commonJS({
  "../../node_modules/.pnpm/queue-tick@1.0.1/node_modules/queue-tick/queue-microtask.js"(exports, module) {
    module.exports = typeof queueMicrotask === "function" ? queueMicrotask : (fn) => Promise.resolve().then(fn);
  }
});

// ../../node_modules/.pnpm/queue-tick@1.0.1/node_modules/queue-tick/process-next-tick.js
var require_process_next_tick = __commonJS({
  "../../node_modules/.pnpm/queue-tick@1.0.1/node_modules/queue-tick/process-next-tick.js"(exports, module) {
    module.exports = typeof process !== "undefined" && typeof process.nextTick === "function" ? process.nextTick.bind(process) : require_queue_microtask();
  }
});

// ../../node_modules/.pnpm/fast-fifo@1.3.2/node_modules/fast-fifo/fixed-size.js
var require_fixed_size = __commonJS({
  "../../node_modules/.pnpm/fast-fifo@1.3.2/node_modules/fast-fifo/fixed-size.js"(exports, module) {
    module.exports = class FixedFIFO {
      constructor(hwm) {
        if (!(hwm > 0) || (hwm - 1 & hwm) !== 0) throw new Error("Max size for a FixedFIFO should be a power of two");
        this.buffer = new Array(hwm);
        this.mask = hwm - 1;
        this.top = 0;
        this.btm = 0;
        this.next = null;
      }
      clear() {
        this.top = this.btm = 0;
        this.next = null;
        this.buffer.fill(void 0);
      }
      push(data) {
        if (this.buffer[this.top] !== void 0) return false;
        this.buffer[this.top] = data;
        this.top = this.top + 1 & this.mask;
        return true;
      }
      shift() {
        const last = this.buffer[this.btm];
        if (last === void 0) return void 0;
        this.buffer[this.btm] = void 0;
        this.btm = this.btm + 1 & this.mask;
        return last;
      }
      peek() {
        return this.buffer[this.btm];
      }
      isEmpty() {
        return this.buffer[this.btm] === void 0;
      }
    };
  }
});

// ../../node_modules/.pnpm/fast-fifo@1.3.2/node_modules/fast-fifo/index.js
var require_fast_fifo = __commonJS({
  "../../node_modules/.pnpm/fast-fifo@1.3.2/node_modules/fast-fifo/index.js"(exports, module) {
    var FixedFIFO = require_fixed_size();
    module.exports = class FastFIFO {
      constructor(hwm) {
        this.hwm = hwm || 16;
        this.head = new FixedFIFO(this.hwm);
        this.tail = this.head;
        this.length = 0;
      }
      clear() {
        this.head = this.tail;
        this.head.clear();
        this.length = 0;
      }
      push(val) {
        this.length++;
        if (!this.head.push(val)) {
          const prev = this.head;
          this.head = prev.next = new FixedFIFO(2 * this.head.buffer.length);
          this.head.push(val);
        }
      }
      shift() {
        if (this.length !== 0) this.length--;
        const val = this.tail.shift();
        if (val === void 0 && this.tail.next) {
          const next = this.tail.next;
          this.tail.next = null;
          this.tail = next;
          return this.tail.shift();
        }
        return val;
      }
      peek() {
        const val = this.tail.peek();
        if (val === void 0 && this.tail.next) return this.tail.next.peek();
        return val;
      }
      isEmpty() {
        return this.length === 0;
      }
    };
  }
});

// ../../node_modules/.pnpm/streamx@2.16.1/node_modules/streamx/index.js
var require_streamx = __commonJS({
  "../../node_modules/.pnpm/streamx@2.16.1/node_modules/streamx/index.js"(exports, module) {
    var { EventEmitter } = __require("events");
    var STREAM_DESTROYED = new Error("Stream was destroyed");
    var PREMATURE_CLOSE = new Error("Premature close");
    var queueTick = require_process_next_tick();
    var FIFO = require_fast_fifo();
    var MAX = (1 << 28) - 1;
    var OPENING = 1;
    var PREDESTROYING = 2;
    var DESTROYING = 4;
    var DESTROYED = 8;
    var NOT_OPENING = MAX ^ OPENING;
    var NOT_PREDESTROYING = MAX ^ PREDESTROYING;
    var READ_ACTIVE = 1 << 4;
    var READ_UPDATING = 2 << 4;
    var READ_PRIMARY = 4 << 4;
    var READ_QUEUED = 8 << 4;
    var READ_RESUMED = 16 << 4;
    var READ_PIPE_DRAINED = 32 << 4;
    var READ_ENDING = 64 << 4;
    var READ_EMIT_DATA = 128 << 4;
    var READ_EMIT_READABLE = 256 << 4;
    var READ_EMITTED_READABLE = 512 << 4;
    var READ_DONE = 1024 << 4;
    var READ_NEXT_TICK = 2048 << 4;
    var READ_NEEDS_PUSH = 4096 << 4;
    var READ_READ_AHEAD = 8192 << 4;
    var READ_FLOWING = READ_RESUMED | READ_PIPE_DRAINED;
    var READ_ACTIVE_AND_NEEDS_PUSH = READ_ACTIVE | READ_NEEDS_PUSH;
    var READ_PRIMARY_AND_ACTIVE = READ_PRIMARY | READ_ACTIVE;
    var READ_EMIT_READABLE_AND_QUEUED = READ_EMIT_READABLE | READ_QUEUED;
    var READ_RESUMED_READ_AHEAD = READ_RESUMED | READ_READ_AHEAD;
    var READ_NOT_ACTIVE = MAX ^ READ_ACTIVE;
    var READ_NON_PRIMARY = MAX ^ READ_PRIMARY;
    var READ_NON_PRIMARY_AND_PUSHED = MAX ^ (READ_PRIMARY | READ_NEEDS_PUSH);
    var READ_PUSHED = MAX ^ READ_NEEDS_PUSH;
    var READ_PAUSED = MAX ^ READ_RESUMED;
    var READ_NOT_QUEUED = MAX ^ (READ_QUEUED | READ_EMITTED_READABLE);
    var READ_NOT_ENDING = MAX ^ READ_ENDING;
    var READ_PIPE_NOT_DRAINED = MAX ^ READ_FLOWING;
    var READ_NOT_NEXT_TICK = MAX ^ READ_NEXT_TICK;
    var READ_NOT_UPDATING = MAX ^ READ_UPDATING;
    var READ_NO_READ_AHEAD = MAX ^ READ_READ_AHEAD;
    var READ_PAUSED_NO_READ_AHEAD = MAX ^ READ_RESUMED_READ_AHEAD;
    var WRITE_ACTIVE = 1 << 18;
    var WRITE_UPDATING = 2 << 18;
    var WRITE_PRIMARY = 4 << 18;
    var WRITE_QUEUED = 8 << 18;
    var WRITE_UNDRAINED = 16 << 18;
    var WRITE_DONE = 32 << 18;
    var WRITE_EMIT_DRAIN = 64 << 18;
    var WRITE_NEXT_TICK = 128 << 18;
    var WRITE_WRITING = 256 << 18;
    var WRITE_FINISHING = 512 << 18;
    var WRITE_NOT_ACTIVE = MAX ^ (WRITE_ACTIVE | WRITE_WRITING);
    var WRITE_NON_PRIMARY = MAX ^ WRITE_PRIMARY;
    var WRITE_NOT_FINISHING = MAX ^ WRITE_FINISHING;
    var WRITE_DRAINED = MAX ^ WRITE_UNDRAINED;
    var WRITE_NOT_QUEUED = MAX ^ WRITE_QUEUED;
    var WRITE_NOT_NEXT_TICK = MAX ^ WRITE_NEXT_TICK;
    var WRITE_NOT_UPDATING = MAX ^ WRITE_UPDATING;
    var ACTIVE = READ_ACTIVE | WRITE_ACTIVE;
    var NOT_ACTIVE = MAX ^ ACTIVE;
    var DONE = READ_DONE | WRITE_DONE;
    var DESTROY_STATUS = DESTROYING | DESTROYED | PREDESTROYING;
    var OPEN_STATUS = DESTROY_STATUS | OPENING;
    var AUTO_DESTROY = DESTROY_STATUS | DONE;
    var NON_PRIMARY = WRITE_NON_PRIMARY & READ_NON_PRIMARY;
    var ACTIVE_OR_TICKING = WRITE_NEXT_TICK | READ_NEXT_TICK;
    var TICKING = ACTIVE_OR_TICKING & NOT_ACTIVE;
    var IS_OPENING = OPEN_STATUS | TICKING;
    var READ_PRIMARY_STATUS = OPEN_STATUS | READ_ENDING | READ_DONE;
    var READ_STATUS = OPEN_STATUS | READ_DONE | READ_QUEUED;
    var READ_ENDING_STATUS = OPEN_STATUS | READ_ENDING | READ_QUEUED;
    var READ_READABLE_STATUS = OPEN_STATUS | READ_EMIT_READABLE | READ_QUEUED | READ_EMITTED_READABLE;
    var SHOULD_NOT_READ = OPEN_STATUS | READ_ACTIVE | READ_ENDING | READ_DONE | READ_NEEDS_PUSH | READ_READ_AHEAD;
    var READ_BACKPRESSURE_STATUS = DESTROY_STATUS | READ_ENDING | READ_DONE;
    var READ_UPDATE_SYNC_STATUS = READ_UPDATING | OPEN_STATUS | READ_NEXT_TICK | READ_PRIMARY;
    var WRITE_PRIMARY_STATUS = OPEN_STATUS | WRITE_FINISHING | WRITE_DONE;
    var WRITE_QUEUED_AND_UNDRAINED = WRITE_QUEUED | WRITE_UNDRAINED;
    var WRITE_QUEUED_AND_ACTIVE = WRITE_QUEUED | WRITE_ACTIVE;
    var WRITE_DRAIN_STATUS = WRITE_QUEUED | WRITE_UNDRAINED | OPEN_STATUS | WRITE_ACTIVE;
    var WRITE_STATUS = OPEN_STATUS | WRITE_ACTIVE | WRITE_QUEUED;
    var WRITE_PRIMARY_AND_ACTIVE = WRITE_PRIMARY | WRITE_ACTIVE;
    var WRITE_ACTIVE_AND_WRITING = WRITE_ACTIVE | WRITE_WRITING;
    var WRITE_FINISHING_STATUS = OPEN_STATUS | WRITE_FINISHING | WRITE_QUEUED_AND_ACTIVE | WRITE_DONE;
    var WRITE_BACKPRESSURE_STATUS = WRITE_UNDRAINED | DESTROY_STATUS | WRITE_FINISHING | WRITE_DONE;
    var WRITE_UPDATE_SYNC_STATUS = WRITE_UPDATING | OPEN_STATUS | WRITE_NEXT_TICK | WRITE_PRIMARY;
    var asyncIterator = Symbol.asyncIterator || /* @__PURE__ */ Symbol("asyncIterator");
    var WritableState = class {
      constructor(stream, { highWaterMark = 16384, map = null, mapWritable, byteLength, byteLengthWritable } = {}) {
        this.stream = stream;
        this.queue = new FIFO();
        this.highWaterMark = highWaterMark;
        this.buffered = 0;
        this.error = null;
        this.pipeline = null;
        this.drains = null;
        this.byteLength = byteLengthWritable || byteLength || defaultByteLength;
        this.map = mapWritable || map;
        this.afterWrite = afterWrite.bind(this);
        this.afterUpdateNextTick = updateWriteNT.bind(this);
      }
      get ended() {
        return (this.stream._duplexState & WRITE_DONE) !== 0;
      }
      push(data) {
        if (this.map !== null) data = this.map(data);
        this.buffered += this.byteLength(data);
        this.queue.push(data);
        if (this.buffered < this.highWaterMark) {
          this.stream._duplexState |= WRITE_QUEUED;
          return true;
        }
        this.stream._duplexState |= WRITE_QUEUED_AND_UNDRAINED;
        return false;
      }
      shift() {
        const data = this.queue.shift();
        this.buffered -= this.byteLength(data);
        if (this.buffered === 0) this.stream._duplexState &= WRITE_NOT_QUEUED;
        return data;
      }
      end(data) {
        if (typeof data === "function") this.stream.once("finish", data);
        else if (data !== void 0 && data !== null) this.push(data);
        this.stream._duplexState = (this.stream._duplexState | WRITE_FINISHING) & WRITE_NON_PRIMARY;
      }
      autoBatch(data, cb) {
        const buffer = [];
        const stream = this.stream;
        buffer.push(data);
        while ((stream._duplexState & WRITE_STATUS) === WRITE_QUEUED_AND_ACTIVE) {
          buffer.push(stream._writableState.shift());
        }
        if ((stream._duplexState & OPEN_STATUS) !== 0) return cb(null);
        stream._writev(buffer, cb);
      }
      update() {
        const stream = this.stream;
        stream._duplexState |= WRITE_UPDATING;
        do {
          while ((stream._duplexState & WRITE_STATUS) === WRITE_QUEUED) {
            const data = this.shift();
            stream._duplexState |= WRITE_ACTIVE_AND_WRITING;
            stream._write(data, this.afterWrite);
          }
          if ((stream._duplexState & WRITE_PRIMARY_AND_ACTIVE) === 0) this.updateNonPrimary();
        } while (this.continueUpdate() === true);
        stream._duplexState &= WRITE_NOT_UPDATING;
      }
      updateNonPrimary() {
        const stream = this.stream;
        if ((stream._duplexState & WRITE_FINISHING_STATUS) === WRITE_FINISHING) {
          stream._duplexState = (stream._duplexState | WRITE_ACTIVE) & WRITE_NOT_FINISHING;
          stream._final(afterFinal.bind(this));
          return;
        }
        if ((stream._duplexState & DESTROY_STATUS) === DESTROYING) {
          if ((stream._duplexState & ACTIVE_OR_TICKING) === 0) {
            stream._duplexState |= ACTIVE;
            stream._destroy(afterDestroy.bind(this));
          }
          return;
        }
        if ((stream._duplexState & IS_OPENING) === OPENING) {
          stream._duplexState = (stream._duplexState | ACTIVE) & NOT_OPENING;
          stream._open(afterOpen.bind(this));
        }
      }
      continueUpdate() {
        if ((this.stream._duplexState & WRITE_NEXT_TICK) === 0) return false;
        this.stream._duplexState &= WRITE_NOT_NEXT_TICK;
        return true;
      }
      updateCallback() {
        if ((this.stream._duplexState & WRITE_UPDATE_SYNC_STATUS) === WRITE_PRIMARY) this.update();
        else this.updateNextTick();
      }
      updateNextTick() {
        if ((this.stream._duplexState & WRITE_NEXT_TICK) !== 0) return;
        this.stream._duplexState |= WRITE_NEXT_TICK;
        if ((this.stream._duplexState & WRITE_UPDATING) === 0) queueTick(this.afterUpdateNextTick);
      }
    };
    var ReadableState = class {
      constructor(stream, { highWaterMark = 16384, map = null, mapReadable, byteLength, byteLengthReadable } = {}) {
        this.stream = stream;
        this.queue = new FIFO();
        this.highWaterMark = highWaterMark === 0 ? 1 : highWaterMark;
        this.buffered = 0;
        this.readAhead = highWaterMark > 0;
        this.error = null;
        this.pipeline = null;
        this.byteLength = byteLengthReadable || byteLength || defaultByteLength;
        this.map = mapReadable || map;
        this.pipeTo = null;
        this.afterRead = afterRead.bind(this);
        this.afterUpdateNextTick = updateReadNT.bind(this);
      }
      get ended() {
        return (this.stream._duplexState & READ_DONE) !== 0;
      }
      pipe(pipeTo, cb) {
        if (this.pipeTo !== null) throw new Error("Can only pipe to one destination");
        if (typeof cb !== "function") cb = null;
        this.stream._duplexState |= READ_PIPE_DRAINED;
        this.pipeTo = pipeTo;
        this.pipeline = new Pipeline(this.stream, pipeTo, cb);
        if (cb) this.stream.on("error", noop);
        if (isStreamx(pipeTo)) {
          pipeTo._writableState.pipeline = this.pipeline;
          if (cb) pipeTo.on("error", noop);
          pipeTo.on("finish", this.pipeline.finished.bind(this.pipeline));
        } else {
          const onerror = this.pipeline.done.bind(this.pipeline, pipeTo);
          const onclose = this.pipeline.done.bind(this.pipeline, pipeTo, null);
          pipeTo.on("error", onerror);
          pipeTo.on("close", onclose);
          pipeTo.on("finish", this.pipeline.finished.bind(this.pipeline));
        }
        pipeTo.on("drain", afterDrain.bind(this));
        this.stream.emit("piping", pipeTo);
        pipeTo.emit("pipe", this.stream);
      }
      push(data) {
        const stream = this.stream;
        if (data === null) {
          this.highWaterMark = 0;
          stream._duplexState = (stream._duplexState | READ_ENDING) & READ_NON_PRIMARY_AND_PUSHED;
          return false;
        }
        if (this.map !== null) data = this.map(data);
        this.buffered += this.byteLength(data);
        this.queue.push(data);
        stream._duplexState = (stream._duplexState | READ_QUEUED) & READ_PUSHED;
        return this.buffered < this.highWaterMark;
      }
      shift() {
        const data = this.queue.shift();
        this.buffered -= this.byteLength(data);
        if (this.buffered === 0) this.stream._duplexState &= READ_NOT_QUEUED;
        return data;
      }
      unshift(data) {
        const pending = [this.map !== null ? this.map(data) : data];
        while (this.buffered > 0) pending.push(this.shift());
        for (let i = 0; i < pending.length - 1; i++) {
          const data2 = pending[i];
          this.buffered += this.byteLength(data2);
          this.queue.push(data2);
        }
        this.push(pending[pending.length - 1]);
      }
      read() {
        const stream = this.stream;
        if ((stream._duplexState & READ_STATUS) === READ_QUEUED) {
          const data = this.shift();
          if (this.pipeTo !== null && this.pipeTo.write(data) === false) stream._duplexState &= READ_PIPE_NOT_DRAINED;
          if ((stream._duplexState & READ_EMIT_DATA) !== 0) stream.emit("data", data);
          return data;
        }
        if (this.readAhead === false) {
          stream._duplexState |= READ_READ_AHEAD;
          this.updateNextTick();
        }
        return null;
      }
      drain() {
        const stream = this.stream;
        while ((stream._duplexState & READ_STATUS) === READ_QUEUED && (stream._duplexState & READ_FLOWING) !== 0) {
          const data = this.shift();
          if (this.pipeTo !== null && this.pipeTo.write(data) === false) stream._duplexState &= READ_PIPE_NOT_DRAINED;
          if ((stream._duplexState & READ_EMIT_DATA) !== 0) stream.emit("data", data);
        }
      }
      update() {
        const stream = this.stream;
        stream._duplexState |= READ_UPDATING;
        do {
          this.drain();
          while (this.buffered < this.highWaterMark && (stream._duplexState & SHOULD_NOT_READ) === READ_READ_AHEAD) {
            stream._duplexState |= READ_ACTIVE_AND_NEEDS_PUSH;
            stream._read(this.afterRead);
            this.drain();
          }
          if ((stream._duplexState & READ_READABLE_STATUS) === READ_EMIT_READABLE_AND_QUEUED) {
            stream._duplexState |= READ_EMITTED_READABLE;
            stream.emit("readable");
          }
          if ((stream._duplexState & READ_PRIMARY_AND_ACTIVE) === 0) this.updateNonPrimary();
        } while (this.continueUpdate() === true);
        stream._duplexState &= READ_NOT_UPDATING;
      }
      updateNonPrimary() {
        const stream = this.stream;
        if ((stream._duplexState & READ_ENDING_STATUS) === READ_ENDING) {
          stream._duplexState = (stream._duplexState | READ_DONE) & READ_NOT_ENDING;
          stream.emit("end");
          if ((stream._duplexState & AUTO_DESTROY) === DONE) stream._duplexState |= DESTROYING;
          if (this.pipeTo !== null) this.pipeTo.end();
        }
        if ((stream._duplexState & DESTROY_STATUS) === DESTROYING) {
          if ((stream._duplexState & ACTIVE_OR_TICKING) === 0) {
            stream._duplexState |= ACTIVE;
            stream._destroy(afterDestroy.bind(this));
          }
          return;
        }
        if ((stream._duplexState & IS_OPENING) === OPENING) {
          stream._duplexState = (stream._duplexState | ACTIVE) & NOT_OPENING;
          stream._open(afterOpen.bind(this));
        }
      }
      continueUpdate() {
        if ((this.stream._duplexState & READ_NEXT_TICK) === 0) return false;
        this.stream._duplexState &= READ_NOT_NEXT_TICK;
        return true;
      }
      updateCallback() {
        if ((this.stream._duplexState & READ_UPDATE_SYNC_STATUS) === READ_PRIMARY) this.update();
        else this.updateNextTick();
      }
      updateNextTick() {
        if ((this.stream._duplexState & READ_NEXT_TICK) !== 0) return;
        this.stream._duplexState |= READ_NEXT_TICK;
        if ((this.stream._duplexState & READ_UPDATING) === 0) queueTick(this.afterUpdateNextTick);
      }
    };
    var TransformState = class {
      constructor(stream) {
        this.data = null;
        this.afterTransform = afterTransform.bind(stream);
        this.afterFinal = null;
      }
    };
    var Pipeline = class {
      constructor(src, dst, cb) {
        this.from = src;
        this.to = dst;
        this.afterPipe = cb;
        this.error = null;
        this.pipeToFinished = false;
      }
      finished() {
        this.pipeToFinished = true;
      }
      done(stream, err) {
        if (err) this.error = err;
        if (stream === this.to) {
          this.to = null;
          if (this.from !== null) {
            if ((this.from._duplexState & READ_DONE) === 0 || !this.pipeToFinished) {
              this.from.destroy(this.error || new Error("Writable stream closed prematurely"));
            }
            return;
          }
        }
        if (stream === this.from) {
          this.from = null;
          if (this.to !== null) {
            if ((stream._duplexState & READ_DONE) === 0) {
              this.to.destroy(this.error || new Error("Readable stream closed before ending"));
            }
            return;
          }
        }
        if (this.afterPipe !== null) this.afterPipe(this.error);
        this.to = this.from = this.afterPipe = null;
      }
    };
    function afterDrain() {
      this.stream._duplexState |= READ_PIPE_DRAINED;
      this.updateCallback();
    }
    function afterFinal(err) {
      const stream = this.stream;
      if (err) stream.destroy(err);
      if ((stream._duplexState & DESTROY_STATUS) === 0) {
        stream._duplexState |= WRITE_DONE;
        stream.emit("finish");
      }
      if ((stream._duplexState & AUTO_DESTROY) === DONE) {
        stream._duplexState |= DESTROYING;
      }
      stream._duplexState &= WRITE_NOT_ACTIVE;
      if ((stream._duplexState & WRITE_UPDATING) === 0) this.update();
      else this.updateNextTick();
    }
    function afterDestroy(err) {
      const stream = this.stream;
      if (!err && this.error !== STREAM_DESTROYED) err = this.error;
      if (err) stream.emit("error", err);
      stream._duplexState |= DESTROYED;
      stream.emit("close");
      const rs = stream._readableState;
      const ws = stream._writableState;
      if (rs !== null && rs.pipeline !== null) rs.pipeline.done(stream, err);
      if (ws !== null) {
        while (ws.drains !== null && ws.drains.length > 0) ws.drains.shift().resolve(false);
        if (ws.pipeline !== null) ws.pipeline.done(stream, err);
      }
    }
    function afterWrite(err) {
      const stream = this.stream;
      if (err) stream.destroy(err);
      stream._duplexState &= WRITE_NOT_ACTIVE;
      if (this.drains !== null) tickDrains(this.drains);
      if ((stream._duplexState & WRITE_DRAIN_STATUS) === WRITE_UNDRAINED) {
        stream._duplexState &= WRITE_DRAINED;
        if ((stream._duplexState & WRITE_EMIT_DRAIN) === WRITE_EMIT_DRAIN) {
          stream.emit("drain");
        }
      }
      this.updateCallback();
    }
    function afterRead(err) {
      if (err) this.stream.destroy(err);
      this.stream._duplexState &= READ_NOT_ACTIVE;
      if (this.readAhead === false && (this.stream._duplexState & READ_RESUMED) === 0) this.stream._duplexState &= READ_NO_READ_AHEAD;
      this.updateCallback();
    }
    function updateReadNT() {
      if ((this.stream._duplexState & READ_UPDATING) === 0) {
        this.stream._duplexState &= READ_NOT_NEXT_TICK;
        this.update();
      }
    }
    function updateWriteNT() {
      if ((this.stream._duplexState & WRITE_UPDATING) === 0) {
        this.stream._duplexState &= WRITE_NOT_NEXT_TICK;
        this.update();
      }
    }
    function tickDrains(drains) {
      for (let i = 0; i < drains.length; i++) {
        if (--drains[i].writes === 0) {
          drains.shift().resolve(true);
          i--;
        }
      }
    }
    function afterOpen(err) {
      const stream = this.stream;
      if (err) stream.destroy(err);
      if ((stream._duplexState & DESTROYING) === 0) {
        if ((stream._duplexState & READ_PRIMARY_STATUS) === 0) stream._duplexState |= READ_PRIMARY;
        if ((stream._duplexState & WRITE_PRIMARY_STATUS) === 0) stream._duplexState |= WRITE_PRIMARY;
        stream.emit("open");
      }
      stream._duplexState &= NOT_ACTIVE;
      if (stream._writableState !== null) {
        stream._writableState.updateCallback();
      }
      if (stream._readableState !== null) {
        stream._readableState.updateCallback();
      }
    }
    function afterTransform(err, data) {
      if (data !== void 0 && data !== null) this.push(data);
      this._writableState.afterWrite(err);
    }
    function newListener(name) {
      if (this._readableState !== null) {
        if (name === "data") {
          this._duplexState |= READ_EMIT_DATA | READ_RESUMED_READ_AHEAD;
          this._readableState.updateNextTick();
        }
        if (name === "readable") {
          this._duplexState |= READ_EMIT_READABLE;
          this._readableState.updateNextTick();
        }
      }
      if (this._writableState !== null) {
        if (name === "drain") {
          this._duplexState |= WRITE_EMIT_DRAIN;
          this._writableState.updateNextTick();
        }
      }
    }
    var Stream = class extends EventEmitter {
      constructor(opts) {
        super();
        this._duplexState = 0;
        this._readableState = null;
        this._writableState = null;
        if (opts) {
          if (opts.open) this._open = opts.open;
          if (opts.destroy) this._destroy = opts.destroy;
          if (opts.predestroy) this._predestroy = opts.predestroy;
          if (opts.signal) {
            opts.signal.addEventListener("abort", abort.bind(this));
          }
        }
        this.on("newListener", newListener);
      }
      _open(cb) {
        cb(null);
      }
      _destroy(cb) {
        cb(null);
      }
      _predestroy() {
      }
      get readable() {
        return this._readableState !== null ? true : void 0;
      }
      get writable() {
        return this._writableState !== null ? true : void 0;
      }
      get destroyed() {
        return (this._duplexState & DESTROYED) !== 0;
      }
      get destroying() {
        return (this._duplexState & DESTROY_STATUS) !== 0;
      }
      destroy(err) {
        if ((this._duplexState & DESTROY_STATUS) === 0) {
          if (!err) err = STREAM_DESTROYED;
          this._duplexState = (this._duplexState | DESTROYING) & NON_PRIMARY;
          if (this._readableState !== null) {
            this._readableState.highWaterMark = 0;
            this._readableState.error = err;
          }
          if (this._writableState !== null) {
            this._writableState.highWaterMark = 0;
            this._writableState.error = err;
          }
          this._duplexState |= PREDESTROYING;
          this._predestroy();
          this._duplexState &= NOT_PREDESTROYING;
          if (this._readableState !== null) this._readableState.updateNextTick();
          if (this._writableState !== null) this._writableState.updateNextTick();
        }
      }
    };
    var Readable = class _Readable extends Stream {
      constructor(opts) {
        super(opts);
        this._duplexState |= OPENING | WRITE_DONE | READ_READ_AHEAD;
        this._readableState = new ReadableState(this, opts);
        if (opts) {
          if (this._readableState.readAhead === false) this._duplexState &= READ_NO_READ_AHEAD;
          if (opts.read) this._read = opts.read;
          if (opts.eagerOpen) this._readableState.updateNextTick();
        }
      }
      _read(cb) {
        cb(null);
      }
      pipe(dest, cb) {
        this._readableState.updateNextTick();
        this._readableState.pipe(dest, cb);
        return dest;
      }
      read() {
        this._readableState.updateNextTick();
        return this._readableState.read();
      }
      push(data) {
        this._readableState.updateNextTick();
        return this._readableState.push(data);
      }
      unshift(data) {
        this._readableState.updateNextTick();
        return this._readableState.unshift(data);
      }
      resume() {
        this._duplexState |= READ_RESUMED_READ_AHEAD;
        this._readableState.updateNextTick();
        return this;
      }
      pause() {
        this._duplexState &= this._readableState.readAhead === false ? READ_PAUSED_NO_READ_AHEAD : READ_PAUSED;
        return this;
      }
      static _fromAsyncIterator(ite, opts) {
        let destroy;
        const rs = new _Readable({
          ...opts,
          read(cb) {
            ite.next().then(push).then(cb.bind(null, null)).catch(cb);
          },
          predestroy() {
            destroy = ite.return();
          },
          destroy(cb) {
            if (!destroy) return cb(null);
            destroy.then(cb.bind(null, null)).catch(cb);
          }
        });
        return rs;
        function push(data) {
          if (data.done) rs.push(null);
          else rs.push(data.value);
        }
      }
      static from(data, opts) {
        if (isReadStreamx(data)) return data;
        if (data[asyncIterator]) return this._fromAsyncIterator(data[asyncIterator](), opts);
        if (!Array.isArray(data)) data = data === void 0 ? [] : [data];
        let i = 0;
        return new _Readable({
          ...opts,
          read(cb) {
            this.push(i === data.length ? null : data[i++]);
            cb(null);
          }
        });
      }
      static isBackpressured(rs) {
        return (rs._duplexState & READ_BACKPRESSURE_STATUS) !== 0 || rs._readableState.buffered >= rs._readableState.highWaterMark;
      }
      static isPaused(rs) {
        return (rs._duplexState & READ_RESUMED) === 0;
      }
      [asyncIterator]() {
        const stream = this;
        let error = null;
        let promiseResolve = null;
        let promiseReject = null;
        this.on("error", (err) => {
          error = err;
        });
        this.on("readable", onreadable);
        this.on("close", onclose);
        return {
          [asyncIterator]() {
            return this;
          },
          next() {
            return new Promise(function(resolve, reject) {
              promiseResolve = resolve;
              promiseReject = reject;
              const data = stream.read();
              if (data !== null) ondata(data);
              else if ((stream._duplexState & DESTROYED) !== 0) ondata(null);
            });
          },
          return() {
            return destroy(null);
          },
          throw(err) {
            return destroy(err);
          }
        };
        function onreadable() {
          if (promiseResolve !== null) ondata(stream.read());
        }
        function onclose() {
          if (promiseResolve !== null) ondata(null);
        }
        function ondata(data) {
          if (promiseReject === null) return;
          if (error) promiseReject(error);
          else if (data === null && (stream._duplexState & READ_DONE) === 0) promiseReject(STREAM_DESTROYED);
          else promiseResolve({ value: data, done: data === null });
          promiseReject = promiseResolve = null;
        }
        function destroy(err) {
          stream.destroy(err);
          return new Promise((resolve, reject) => {
            if (stream._duplexState & DESTROYED) return resolve({ value: void 0, done: true });
            stream.once("close", function() {
              if (err) reject(err);
              else resolve({ value: void 0, done: true });
            });
          });
        }
      }
    };
    var Writable = class extends Stream {
      constructor(opts) {
        super(opts);
        this._duplexState |= OPENING | READ_DONE;
        this._writableState = new WritableState(this, opts);
        if (opts) {
          if (opts.writev) this._writev = opts.writev;
          if (opts.write) this._write = opts.write;
          if (opts.final) this._final = opts.final;
          if (opts.eagerOpen) this._writableState.updateNextTick();
        }
      }
      _writev(batch, cb) {
        cb(null);
      }
      _write(data, cb) {
        this._writableState.autoBatch(data, cb);
      }
      _final(cb) {
        cb(null);
      }
      static isBackpressured(ws) {
        return (ws._duplexState & WRITE_BACKPRESSURE_STATUS) !== 0;
      }
      static drained(ws) {
        if (ws.destroyed) return Promise.resolve(false);
        const state = ws._writableState;
        const pending = isWritev(ws) ? Math.min(1, state.queue.length) : state.queue.length;
        const writes = pending + (ws._duplexState & WRITE_WRITING ? 1 : 0);
        if (writes === 0) return Promise.resolve(true);
        if (state.drains === null) state.drains = [];
        return new Promise((resolve) => {
          state.drains.push({ writes, resolve });
        });
      }
      write(data) {
        this._writableState.updateNextTick();
        return this._writableState.push(data);
      }
      end(data) {
        this._writableState.updateNextTick();
        this._writableState.end(data);
        return this;
      }
    };
    var Duplex = class extends Readable {
      // and Writable
      constructor(opts) {
        super(opts);
        this._duplexState = OPENING | this._duplexState & READ_READ_AHEAD;
        this._writableState = new WritableState(this, opts);
        if (opts) {
          if (opts.writev) this._writev = opts.writev;
          if (opts.write) this._write = opts.write;
          if (opts.final) this._final = opts.final;
        }
      }
      _writev(batch, cb) {
        cb(null);
      }
      _write(data, cb) {
        this._writableState.autoBatch(data, cb);
      }
      _final(cb) {
        cb(null);
      }
      write(data) {
        this._writableState.updateNextTick();
        return this._writableState.push(data);
      }
      end(data) {
        this._writableState.updateNextTick();
        this._writableState.end(data);
        return this;
      }
    };
    var Transform = class extends Duplex {
      constructor(opts) {
        super(opts);
        this._transformState = new TransformState(this);
        if (opts) {
          if (opts.transform) this._transform = opts.transform;
          if (opts.flush) this._flush = opts.flush;
        }
      }
      _write(data, cb) {
        if (this._readableState.buffered >= this._readableState.highWaterMark) {
          this._transformState.data = data;
        } else {
          this._transform(data, this._transformState.afterTransform);
        }
      }
      _read(cb) {
        if (this._transformState.data !== null) {
          const data = this._transformState.data;
          this._transformState.data = null;
          cb(null);
          this._transform(data, this._transformState.afterTransform);
        } else {
          cb(null);
        }
      }
      destroy(err) {
        super.destroy(err);
        if (this._transformState.data !== null) {
          this._transformState.data = null;
          this._transformState.afterTransform();
        }
      }
      _transform(data, cb) {
        cb(null, data);
      }
      _flush(cb) {
        cb(null);
      }
      _final(cb) {
        this._transformState.afterFinal = cb;
        this._flush(transformAfterFlush.bind(this));
      }
    };
    var PassThrough = class extends Transform {
    };
    function transformAfterFlush(err, data) {
      const cb = this._transformState.afterFinal;
      if (err) return cb(err);
      if (data !== null && data !== void 0) this.push(data);
      this.push(null);
      cb(null);
    }
    function pipelinePromise(...streams) {
      return new Promise((resolve, reject) => {
        return pipeline3(...streams, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }
    function pipeline3(stream, ...streams) {
      const all = Array.isArray(stream) ? [...stream, ...streams] : [stream, ...streams];
      const done = all.length && typeof all[all.length - 1] === "function" ? all.pop() : null;
      if (all.length < 2) throw new Error("Pipeline requires at least 2 streams");
      let src = all[0];
      let dest = null;
      let error = null;
      for (let i = 1; i < all.length; i++) {
        dest = all[i];
        if (isStreamx(src)) {
          src.pipe(dest, onerror);
        } else {
          errorHandle(src, true, i > 1, onerror);
          src.pipe(dest);
        }
        src = dest;
      }
      if (done) {
        let fin = false;
        const autoDestroy = isStreamx(dest) || !!(dest._writableState && dest._writableState.autoDestroy);
        dest.on("error", (err) => {
          if (error === null) error = err;
        });
        dest.on("finish", () => {
          fin = true;
          if (!autoDestroy) done(error);
        });
        if (autoDestroy) {
          dest.on("close", () => done(error || (fin ? null : PREMATURE_CLOSE)));
        }
      }
      return dest;
      function errorHandle(s, rd, wr, onerror2) {
        s.on("error", onerror2);
        s.on("close", onclose);
        function onclose() {
          if (rd && s._readableState && !s._readableState.ended) return onerror2(PREMATURE_CLOSE);
          if (wr && s._writableState && !s._writableState.ended) return onerror2(PREMATURE_CLOSE);
        }
      }
      function onerror(err) {
        if (!err || error) return;
        error = err;
        for (const s of all) {
          s.destroy(err);
        }
      }
    }
    function isStream(stream) {
      return !!stream._readableState || !!stream._writableState;
    }
    function isStreamx(stream) {
      return typeof stream._duplexState === "number" && isStream(stream);
    }
    function getStreamError(stream) {
      const err = stream._readableState && stream._readableState.error || stream._writableState && stream._writableState.error;
      return err === STREAM_DESTROYED ? null : err;
    }
    function isReadStreamx(stream) {
      return isStreamx(stream) && stream.readable;
    }
    function isTypedArray(data) {
      return typeof data === "object" && data !== null && typeof data.byteLength === "number";
    }
    function defaultByteLength(data) {
      return isTypedArray(data) ? data.byteLength : 1024;
    }
    function noop() {
    }
    function abort() {
      this.destroy(new Error("Stream aborted."));
    }
    function isWritev(s) {
      return s._writev !== Writable.prototype._writev && s._writev !== Duplex.prototype._writev;
    }
    module.exports = {
      pipeline: pipeline3,
      pipelinePromise,
      isStream,
      isStreamx,
      getStreamError,
      Stream,
      Writable,
      Readable,
      Duplex,
      Transform,
      // Export PassThrough for compatibility with Node.js core's stream module
      PassThrough
    };
  }
});

// ../../node_modules/.pnpm/b4a@1.6.6/node_modules/b4a/index.js
var require_b4a = __commonJS({
  "../../node_modules/.pnpm/b4a@1.6.6/node_modules/b4a/index.js"(exports, module) {
    function isBuffer(value) {
      return Buffer.isBuffer(value) || value instanceof Uint8Array;
    }
    function isEncoding(encoding) {
      return Buffer.isEncoding(encoding);
    }
    function alloc(size, fill2, encoding) {
      return Buffer.alloc(size, fill2, encoding);
    }
    function allocUnsafe(size) {
      return Buffer.allocUnsafe(size);
    }
    function allocUnsafeSlow(size) {
      return Buffer.allocUnsafeSlow(size);
    }
    function byteLength(string, encoding) {
      return Buffer.byteLength(string, encoding);
    }
    function compare(a, b) {
      return Buffer.compare(a, b);
    }
    function concat(buffers, totalLength) {
      return Buffer.concat(buffers, totalLength);
    }
    function copy(source, target, targetStart, start, end) {
      return toBuffer(source).copy(target, targetStart, start, end);
    }
    function equals(a, b) {
      return toBuffer(a).equals(b);
    }
    function fill(buffer, value, offset, end, encoding) {
      return toBuffer(buffer).fill(value, offset, end, encoding);
    }
    function from(value, encodingOrOffset, length) {
      return Buffer.from(value, encodingOrOffset, length);
    }
    function includes(buffer, value, byteOffset, encoding) {
      return toBuffer(buffer).includes(value, byteOffset, encoding);
    }
    function indexOf(buffer, value, byfeOffset, encoding) {
      return toBuffer(buffer).indexOf(value, byfeOffset, encoding);
    }
    function lastIndexOf(buffer, value, byteOffset, encoding) {
      return toBuffer(buffer).lastIndexOf(value, byteOffset, encoding);
    }
    function swap16(buffer) {
      return toBuffer(buffer).swap16();
    }
    function swap32(buffer) {
      return toBuffer(buffer).swap32();
    }
    function swap64(buffer) {
      return toBuffer(buffer).swap64();
    }
    function toBuffer(buffer) {
      if (Buffer.isBuffer(buffer)) return buffer;
      return Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
    function toString(buffer, encoding, start, end) {
      return toBuffer(buffer).toString(encoding, start, end);
    }
    function write(buffer, string, offset, length, encoding) {
      return toBuffer(buffer).write(string, offset, length, encoding);
    }
    function writeDoubleLE(buffer, value, offset) {
      return toBuffer(buffer).writeDoubleLE(value, offset);
    }
    function writeFloatLE(buffer, value, offset) {
      return toBuffer(buffer).writeFloatLE(value, offset);
    }
    function writeUInt32LE(buffer, value, offset) {
      return toBuffer(buffer).writeUInt32LE(value, offset);
    }
    function writeInt32LE(buffer, value, offset) {
      return toBuffer(buffer).writeInt32LE(value, offset);
    }
    function readDoubleLE(buffer, offset) {
      return toBuffer(buffer).readDoubleLE(offset);
    }
    function readFloatLE(buffer, offset) {
      return toBuffer(buffer).readFloatLE(offset);
    }
    function readUInt32LE(buffer, offset) {
      return toBuffer(buffer).readUInt32LE(offset);
    }
    function readInt32LE(buffer, offset) {
      return toBuffer(buffer).readInt32LE(offset);
    }
    module.exports = {
      isBuffer,
      isEncoding,
      alloc,
      allocUnsafe,
      allocUnsafeSlow,
      byteLength,
      compare,
      concat,
      copy,
      equals,
      fill,
      from,
      includes,
      indexOf,
      lastIndexOf,
      swap16,
      swap32,
      swap64,
      toBuffer,
      toString,
      write,
      writeDoubleLE,
      writeFloatLE,
      writeUInt32LE,
      writeInt32LE,
      readDoubleLE,
      readFloatLE,
      readUInt32LE,
      readInt32LE
    };
  }
});

// ../../node_modules/.pnpm/tar-stream@3.1.7/node_modules/tar-stream/headers.js
var require_headers = __commonJS({
  "../../node_modules/.pnpm/tar-stream@3.1.7/node_modules/tar-stream/headers.js"(exports) {
    var b4a = require_b4a();
    var ZEROS = "0000000000000000000";
    var SEVENS = "7777777777777777777";
    var ZERO_OFFSET = "0".charCodeAt(0);
    var USTAR_MAGIC = b4a.from([117, 115, 116, 97, 114, 0]);
    var USTAR_VER = b4a.from([ZERO_OFFSET, ZERO_OFFSET]);
    var GNU_MAGIC = b4a.from([117, 115, 116, 97, 114, 32]);
    var GNU_VER = b4a.from([32, 0]);
    var MASK = 4095;
    var MAGIC_OFFSET = 257;
    var VERSION_OFFSET = 263;
    exports.decodeLongPath = function decodeLongPath(buf, encoding) {
      return decodeStr(buf, 0, buf.length, encoding);
    };
    exports.encodePax = function encodePax(opts) {
      let result = "";
      if (opts.name) result += addLength(" path=" + opts.name + "\n");
      if (opts.linkname) result += addLength(" linkpath=" + opts.linkname + "\n");
      const pax = opts.pax;
      if (pax) {
        for (const key in pax) {
          result += addLength(" " + key + "=" + pax[key] + "\n");
        }
      }
      return b4a.from(result);
    };
    exports.decodePax = function decodePax(buf) {
      const result = {};
      while (buf.length) {
        let i = 0;
        while (i < buf.length && buf[i] !== 32) i++;
        const len = parseInt(b4a.toString(buf.subarray(0, i)), 10);
        if (!len) return result;
        const b = b4a.toString(buf.subarray(i + 1, len - 1));
        const keyIndex = b.indexOf("=");
        if (keyIndex === -1) return result;
        result[b.slice(0, keyIndex)] = b.slice(keyIndex + 1);
        buf = buf.subarray(len);
      }
      return result;
    };
    exports.encode = function encode(opts) {
      const buf = b4a.alloc(512);
      let name = opts.name;
      let prefix = "";
      if (opts.typeflag === 5 && name[name.length - 1] !== "/") name += "/";
      if (b4a.byteLength(name) !== name.length) return null;
      while (b4a.byteLength(name) > 100) {
        const i = name.indexOf("/");
        if (i === -1) return null;
        prefix += prefix ? "/" + name.slice(0, i) : name.slice(0, i);
        name = name.slice(i + 1);
      }
      if (b4a.byteLength(name) > 100 || b4a.byteLength(prefix) > 155) return null;
      if (opts.linkname && b4a.byteLength(opts.linkname) > 100) return null;
      b4a.write(buf, name);
      b4a.write(buf, encodeOct(opts.mode & MASK, 6), 100);
      b4a.write(buf, encodeOct(opts.uid, 6), 108);
      b4a.write(buf, encodeOct(opts.gid, 6), 116);
      encodeSize(opts.size, buf, 124);
      b4a.write(buf, encodeOct(opts.mtime.getTime() / 1e3 | 0, 11), 136);
      buf[156] = ZERO_OFFSET + toTypeflag(opts.type);
      if (opts.linkname) b4a.write(buf, opts.linkname, 157);
      b4a.copy(USTAR_MAGIC, buf, MAGIC_OFFSET);
      b4a.copy(USTAR_VER, buf, VERSION_OFFSET);
      if (opts.uname) b4a.write(buf, opts.uname, 265);
      if (opts.gname) b4a.write(buf, opts.gname, 297);
      b4a.write(buf, encodeOct(opts.devmajor || 0, 6), 329);
      b4a.write(buf, encodeOct(opts.devminor || 0, 6), 337);
      if (prefix) b4a.write(buf, prefix, 345);
      b4a.write(buf, encodeOct(cksum(buf), 6), 148);
      return buf;
    };
    exports.decode = function decode(buf, filenameEncoding, allowUnknownFormat) {
      let typeflag = buf[156] === 0 ? 0 : buf[156] - ZERO_OFFSET;
      let name = decodeStr(buf, 0, 100, filenameEncoding);
      const mode = decodeOct(buf, 100, 8);
      const uid = decodeOct(buf, 108, 8);
      const gid = decodeOct(buf, 116, 8);
      const size = decodeOct(buf, 124, 12);
      const mtime = decodeOct(buf, 136, 12);
      const type = toType(typeflag);
      const linkname = buf[157] === 0 ? null : decodeStr(buf, 157, 100, filenameEncoding);
      const uname = decodeStr(buf, 265, 32);
      const gname = decodeStr(buf, 297, 32);
      const devmajor = decodeOct(buf, 329, 8);
      const devminor = decodeOct(buf, 337, 8);
      const c = cksum(buf);
      if (c === 8 * 32) return null;
      if (c !== decodeOct(buf, 148, 8)) throw new Error("Invalid tar header. Maybe the tar is corrupted or it needs to be gunzipped?");
      if (isUSTAR(buf)) {
        if (buf[345]) name = decodeStr(buf, 345, 155, filenameEncoding) + "/" + name;
      } else if (isGNU(buf)) {
      } else {
        if (!allowUnknownFormat) {
          throw new Error("Invalid tar header: unknown format.");
        }
      }
      if (typeflag === 0 && name && name[name.length - 1] === "/") typeflag = 5;
      return {
        name,
        mode,
        uid,
        gid,
        size,
        mtime: new Date(1e3 * mtime),
        type,
        linkname,
        uname,
        gname,
        devmajor,
        devminor,
        pax: null
      };
    };
    function isUSTAR(buf) {
      return b4a.equals(USTAR_MAGIC, buf.subarray(MAGIC_OFFSET, MAGIC_OFFSET + 6));
    }
    function isGNU(buf) {
      return b4a.equals(GNU_MAGIC, buf.subarray(MAGIC_OFFSET, MAGIC_OFFSET + 6)) && b4a.equals(GNU_VER, buf.subarray(VERSION_OFFSET, VERSION_OFFSET + 2));
    }
    function clamp(index, len, defaultValue) {
      if (typeof index !== "number") return defaultValue;
      index = ~~index;
      if (index >= len) return len;
      if (index >= 0) return index;
      index += len;
      if (index >= 0) return index;
      return 0;
    }
    function toType(flag) {
      switch (flag) {
        case 0:
          return "file";
        case 1:
          return "link";
        case 2:
          return "symlink";
        case 3:
          return "character-device";
        case 4:
          return "block-device";
        case 5:
          return "directory";
        case 6:
          return "fifo";
        case 7:
          return "contiguous-file";
        case 72:
          return "pax-header";
        case 55:
          return "pax-global-header";
        case 27:
          return "gnu-long-link-path";
        case 28:
        case 30:
          return "gnu-long-path";
      }
      return null;
    }
    function toTypeflag(flag) {
      switch (flag) {
        case "file":
          return 0;
        case "link":
          return 1;
        case "symlink":
          return 2;
        case "character-device":
          return 3;
        case "block-device":
          return 4;
        case "directory":
          return 5;
        case "fifo":
          return 6;
        case "contiguous-file":
          return 7;
        case "pax-header":
          return 72;
      }
      return 0;
    }
    function indexOf(block, num, offset, end) {
      for (; offset < end; offset++) {
        if (block[offset] === num) return offset;
      }
      return end;
    }
    function cksum(block) {
      let sum = 8 * 32;
      for (let i = 0; i < 148; i++) sum += block[i];
      for (let j = 156; j < 512; j++) sum += block[j];
      return sum;
    }
    function encodeOct(val, n) {
      val = val.toString(8);
      if (val.length > n) return SEVENS.slice(0, n) + " ";
      return ZEROS.slice(0, n - val.length) + val + " ";
    }
    function encodeSizeBin(num, buf, off) {
      buf[off] = 128;
      for (let i = 11; i > 0; i--) {
        buf[off + i] = num & 255;
        num = Math.floor(num / 256);
      }
    }
    function encodeSize(num, buf, off) {
      if (num.toString(8).length > 11) {
        encodeSizeBin(num, buf, off);
      } else {
        b4a.write(buf, encodeOct(num, 11), off);
      }
    }
    function parse256(buf) {
      let positive;
      if (buf[0] === 128) positive = true;
      else if (buf[0] === 255) positive = false;
      else return null;
      const tuple = [];
      let i;
      for (i = buf.length - 1; i > 0; i--) {
        const byte = buf[i];
        if (positive) tuple.push(byte);
        else tuple.push(255 - byte);
      }
      let sum = 0;
      const l = tuple.length;
      for (i = 0; i < l; i++) {
        sum += tuple[i] * Math.pow(256, i);
      }
      return positive ? sum : -1 * sum;
    }
    function decodeOct(val, offset, length) {
      val = val.subarray(offset, offset + length);
      offset = 0;
      if (val[offset] & 128) {
        return parse256(val);
      } else {
        while (offset < val.length && val[offset] === 32) offset++;
        const end = clamp(indexOf(val, 32, offset, val.length), val.length, val.length);
        while (offset < end && val[offset] === 0) offset++;
        if (end === offset) return 0;
        return parseInt(b4a.toString(val.subarray(offset, end)), 8);
      }
    }
    function decodeStr(val, offset, length, encoding) {
      return b4a.toString(val.subarray(offset, indexOf(val, 0, offset, offset + length)), encoding);
    }
    function addLength(str) {
      const len = b4a.byteLength(str);
      let digits = Math.floor(Math.log(len) / Math.log(10)) + 1;
      if (len + digits >= Math.pow(10, digits)) digits++;
      return len + digits + str;
    }
  }
});

// ../../node_modules/.pnpm/tar-stream@3.1.7/node_modules/tar-stream/extract.js
var require_extract = __commonJS({
  "../../node_modules/.pnpm/tar-stream@3.1.7/node_modules/tar-stream/extract.js"(exports, module) {
    var { Writable, Readable, getStreamError } = require_streamx();
    var FIFO = require_fast_fifo();
    var b4a = require_b4a();
    var headers = require_headers();
    var EMPTY = b4a.alloc(0);
    var BufferList = class {
      constructor() {
        this.buffered = 0;
        this.shifted = 0;
        this.queue = new FIFO();
        this._offset = 0;
      }
      push(buffer) {
        this.buffered += buffer.byteLength;
        this.queue.push(buffer);
      }
      shiftFirst(size) {
        return this._buffered === 0 ? null : this._next(size);
      }
      shift(size) {
        if (size > this.buffered) return null;
        if (size === 0) return EMPTY;
        let chunk = this._next(size);
        if (size === chunk.byteLength) return chunk;
        const chunks = [chunk];
        while ((size -= chunk.byteLength) > 0) {
          chunk = this._next(size);
          chunks.push(chunk);
        }
        return b4a.concat(chunks);
      }
      _next(size) {
        const buf = this.queue.peek();
        const rem = buf.byteLength - this._offset;
        if (size >= rem) {
          const sub = this._offset ? buf.subarray(this._offset, buf.byteLength) : buf;
          this.queue.shift();
          this._offset = 0;
          this.buffered -= rem;
          this.shifted += rem;
          return sub;
        }
        this.buffered -= size;
        this.shifted += size;
        return buf.subarray(this._offset, this._offset += size);
      }
    };
    var Source = class extends Readable {
      constructor(self, header, offset) {
        super();
        this.header = header;
        this.offset = offset;
        this._parent = self;
      }
      _read(cb) {
        if (this.header.size === 0) {
          this.push(null);
        }
        if (this._parent._stream === this) {
          this._parent._update();
        }
        cb(null);
      }
      _predestroy() {
        this._parent.destroy(getStreamError(this));
      }
      _detach() {
        if (this._parent._stream === this) {
          this._parent._stream = null;
          this._parent._missing = overflow(this.header.size);
          this._parent._update();
        }
      }
      _destroy(cb) {
        this._detach();
        cb(null);
      }
    };
    var Extract = class extends Writable {
      constructor(opts) {
        super(opts);
        if (!opts) opts = {};
        this._buffer = new BufferList();
        this._offset = 0;
        this._header = null;
        this._stream = null;
        this._missing = 0;
        this._longHeader = false;
        this._callback = noop;
        this._locked = false;
        this._finished = false;
        this._pax = null;
        this._paxGlobal = null;
        this._gnuLongPath = null;
        this._gnuLongLinkPath = null;
        this._filenameEncoding = opts.filenameEncoding || "utf-8";
        this._allowUnknownFormat = !!opts.allowUnknownFormat;
        this._unlockBound = this._unlock.bind(this);
      }
      _unlock(err) {
        this._locked = false;
        if (err) {
          this.destroy(err);
          this._continueWrite(err);
          return;
        }
        this._update();
      }
      _consumeHeader() {
        if (this._locked) return false;
        this._offset = this._buffer.shifted;
        try {
          this._header = headers.decode(this._buffer.shift(512), this._filenameEncoding, this._allowUnknownFormat);
        } catch (err) {
          this._continueWrite(err);
          return false;
        }
        if (!this._header) return true;
        switch (this._header.type) {
          case "gnu-long-path":
          case "gnu-long-link-path":
          case "pax-global-header":
          case "pax-header":
            this._longHeader = true;
            this._missing = this._header.size;
            return true;
        }
        this._locked = true;
        this._applyLongHeaders();
        if (this._header.size === 0 || this._header.type === "directory") {
          this.emit("entry", this._header, this._createStream(), this._unlockBound);
          return true;
        }
        this._stream = this._createStream();
        this._missing = this._header.size;
        this.emit("entry", this._header, this._stream, this._unlockBound);
        return true;
      }
      _applyLongHeaders() {
        if (this._gnuLongPath) {
          this._header.name = this._gnuLongPath;
          this._gnuLongPath = null;
        }
        if (this._gnuLongLinkPath) {
          this._header.linkname = this._gnuLongLinkPath;
          this._gnuLongLinkPath = null;
        }
        if (this._pax) {
          if (this._pax.path) this._header.name = this._pax.path;
          if (this._pax.linkpath) this._header.linkname = this._pax.linkpath;
          if (this._pax.size) this._header.size = parseInt(this._pax.size, 10);
          this._header.pax = this._pax;
          this._pax = null;
        }
      }
      _decodeLongHeader(buf) {
        switch (this._header.type) {
          case "gnu-long-path":
            this._gnuLongPath = headers.decodeLongPath(buf, this._filenameEncoding);
            break;
          case "gnu-long-link-path":
            this._gnuLongLinkPath = headers.decodeLongPath(buf, this._filenameEncoding);
            break;
          case "pax-global-header":
            this._paxGlobal = headers.decodePax(buf);
            break;
          case "pax-header":
            this._pax = this._paxGlobal === null ? headers.decodePax(buf) : Object.assign({}, this._paxGlobal, headers.decodePax(buf));
            break;
        }
      }
      _consumeLongHeader() {
        this._longHeader = false;
        this._missing = overflow(this._header.size);
        const buf = this._buffer.shift(this._header.size);
        try {
          this._decodeLongHeader(buf);
        } catch (err) {
          this._continueWrite(err);
          return false;
        }
        return true;
      }
      _consumeStream() {
        const buf = this._buffer.shiftFirst(this._missing);
        if (buf === null) return false;
        this._missing -= buf.byteLength;
        const drained = this._stream.push(buf);
        if (this._missing === 0) {
          this._stream.push(null);
          if (drained) this._stream._detach();
          return drained && this._locked === false;
        }
        return drained;
      }
      _createStream() {
        return new Source(this, this._header, this._offset);
      }
      _update() {
        while (this._buffer.buffered > 0 && !this.destroying) {
          if (this._missing > 0) {
            if (this._stream !== null) {
              if (this._consumeStream() === false) return;
              continue;
            }
            if (this._longHeader === true) {
              if (this._missing > this._buffer.buffered) break;
              if (this._consumeLongHeader() === false) return false;
              continue;
            }
            const ignore = this._buffer.shiftFirst(this._missing);
            if (ignore !== null) this._missing -= ignore.byteLength;
            continue;
          }
          if (this._buffer.buffered < 512) break;
          if (this._stream !== null || this._consumeHeader() === false) return;
        }
        this._continueWrite(null);
      }
      _continueWrite(err) {
        const cb = this._callback;
        this._callback = noop;
        cb(err);
      }
      _write(data, cb) {
        this._callback = cb;
        this._buffer.push(data);
        this._update();
      }
      _final(cb) {
        this._finished = this._missing === 0 && this._buffer.buffered === 0;
        cb(this._finished ? null : new Error("Unexpected end of data"));
      }
      _predestroy() {
        this._continueWrite(null);
      }
      _destroy(cb) {
        if (this._stream) this._stream.destroy(getStreamError(this));
        cb(null);
      }
      [Symbol.asyncIterator]() {
        let error = null;
        let promiseResolve = null;
        let promiseReject = null;
        let entryStream = null;
        let entryCallback = null;
        const extract2 = this;
        this.on("entry", onentry);
        this.on("error", (err) => {
          error = err;
        });
        this.on("close", onclose);
        return {
          [Symbol.asyncIterator]() {
            return this;
          },
          next() {
            return new Promise(onnext);
          },
          return() {
            return destroy(null);
          },
          throw(err) {
            return destroy(err);
          }
        };
        function consumeCallback(err) {
          if (!entryCallback) return;
          const cb = entryCallback;
          entryCallback = null;
          cb(err);
        }
        function onnext(resolve, reject) {
          if (error) {
            return reject(error);
          }
          if (entryStream) {
            resolve({ value: entryStream, done: false });
            entryStream = null;
            return;
          }
          promiseResolve = resolve;
          promiseReject = reject;
          consumeCallback(null);
          if (extract2._finished && promiseResolve) {
            promiseResolve({ value: void 0, done: true });
            promiseResolve = promiseReject = null;
          }
        }
        function onentry(header, stream, callback) {
          entryCallback = callback;
          stream.on("error", noop);
          if (promiseResolve) {
            promiseResolve({ value: stream, done: false });
            promiseResolve = promiseReject = null;
          } else {
            entryStream = stream;
          }
        }
        function onclose() {
          consumeCallback(error);
          if (!promiseResolve) return;
          if (error) promiseReject(error);
          else promiseResolve({ value: void 0, done: true });
          promiseResolve = promiseReject = null;
        }
        function destroy(err) {
          extract2.destroy(err);
          consumeCallback(err);
          return new Promise((resolve, reject) => {
            if (extract2.destroyed) return resolve({ value: void 0, done: true });
            extract2.once("close", function() {
              if (err) reject(err);
              else resolve({ value: void 0, done: true });
            });
          });
        }
      }
    };
    module.exports = function extract2(opts) {
      return new Extract(opts);
    };
    function noop() {
    }
    function overflow(size) {
      size &= 511;
      return size && 512 - size;
    }
  }
});

// ../../node_modules/.pnpm/tar-stream@3.1.7/node_modules/tar-stream/constants.js
var require_constants = __commonJS({
  "../../node_modules/.pnpm/tar-stream@3.1.7/node_modules/tar-stream/constants.js"(exports, module) {
    var constants = {
      // just for envs without fs
      S_IFMT: 61440,
      S_IFDIR: 16384,
      S_IFCHR: 8192,
      S_IFBLK: 24576,
      S_IFIFO: 4096,
      S_IFLNK: 40960
    };
    try {
      module.exports = __require("fs").constants || constants;
    } catch {
      module.exports = constants;
    }
  }
});

// ../../node_modules/.pnpm/tar-stream@3.1.7/node_modules/tar-stream/pack.js
var require_pack = __commonJS({
  "../../node_modules/.pnpm/tar-stream@3.1.7/node_modules/tar-stream/pack.js"(exports, module) {
    var { Readable, Writable, getStreamError } = require_streamx();
    var b4a = require_b4a();
    var constants = require_constants();
    var headers = require_headers();
    var DMODE = 493;
    var FMODE = 420;
    var END_OF_TAR = b4a.alloc(1024);
    var Sink = class extends Writable {
      constructor(pack, header, callback) {
        super({ mapWritable, eagerOpen: true });
        this.written = 0;
        this.header = header;
        this._callback = callback;
        this._linkname = null;
        this._isLinkname = header.type === "symlink" && !header.linkname;
        this._isVoid = header.type !== "file" && header.type !== "contiguous-file";
        this._finished = false;
        this._pack = pack;
        this._openCallback = null;
        if (this._pack._stream === null) this._pack._stream = this;
        else this._pack._pending.push(this);
      }
      _open(cb) {
        this._openCallback = cb;
        if (this._pack._stream === this) this._continueOpen();
      }
      _continuePack(err) {
        if (this._callback === null) return;
        const callback = this._callback;
        this._callback = null;
        callback(err);
      }
      _continueOpen() {
        if (this._pack._stream === null) this._pack._stream = this;
        const cb = this._openCallback;
        this._openCallback = null;
        if (cb === null) return;
        if (this._pack.destroying) return cb(new Error("pack stream destroyed"));
        if (this._pack._finalized) return cb(new Error("pack stream is already finalized"));
        this._pack._stream = this;
        if (!this._isLinkname) {
          this._pack._encode(this.header);
        }
        if (this._isVoid) {
          this._finish();
          this._continuePack(null);
        }
        cb(null);
      }
      _write(data, cb) {
        if (this._isLinkname) {
          this._linkname = this._linkname ? b4a.concat([this._linkname, data]) : data;
          return cb(null);
        }
        if (this._isVoid) {
          if (data.byteLength > 0) {
            return cb(new Error("No body allowed for this entry"));
          }
          return cb();
        }
        this.written += data.byteLength;
        if (this._pack.push(data)) return cb();
        this._pack._drain = cb;
      }
      _finish() {
        if (this._finished) return;
        this._finished = true;
        if (this._isLinkname) {
          this.header.linkname = this._linkname ? b4a.toString(this._linkname, "utf-8") : "";
          this._pack._encode(this.header);
        }
        overflow(this._pack, this.header.size);
        this._pack._done(this);
      }
      _final(cb) {
        if (this.written !== this.header.size) {
          return cb(new Error("Size mismatch"));
        }
        this._finish();
        cb(null);
      }
      _getError() {
        return getStreamError(this) || new Error("tar entry destroyed");
      }
      _predestroy() {
        this._pack.destroy(this._getError());
      }
      _destroy(cb) {
        this._pack._done(this);
        this._continuePack(this._finished ? null : this._getError());
        cb();
      }
    };
    var Pack = class extends Readable {
      constructor(opts) {
        super(opts);
        this._drain = noop;
        this._finalized = false;
        this._finalizing = false;
        this._pending = [];
        this._stream = null;
      }
      entry(header, buffer, callback) {
        if (this._finalized || this.destroying) throw new Error("already finalized or destroyed");
        if (typeof buffer === "function") {
          callback = buffer;
          buffer = null;
        }
        if (!callback) callback = noop;
        if (!header.size || header.type === "symlink") header.size = 0;
        if (!header.type) header.type = modeToType(header.mode);
        if (!header.mode) header.mode = header.type === "directory" ? DMODE : FMODE;
        if (!header.uid) header.uid = 0;
        if (!header.gid) header.gid = 0;
        if (!header.mtime) header.mtime = /* @__PURE__ */ new Date();
        if (typeof buffer === "string") buffer = b4a.from(buffer);
        const sink = new Sink(this, header, callback);
        if (b4a.isBuffer(buffer)) {
          header.size = buffer.byteLength;
          sink.write(buffer);
          sink.end();
          return sink;
        }
        if (sink._isVoid) {
          return sink;
        }
        return sink;
      }
      finalize() {
        if (this._stream || this._pending.length > 0) {
          this._finalizing = true;
          return;
        }
        if (this._finalized) return;
        this._finalized = true;
        this.push(END_OF_TAR);
        this.push(null);
      }
      _done(stream) {
        if (stream !== this._stream) return;
        this._stream = null;
        if (this._finalizing) this.finalize();
        if (this._pending.length) this._pending.shift()._continueOpen();
      }
      _encode(header) {
        if (!header.pax) {
          const buf = headers.encode(header);
          if (buf) {
            this.push(buf);
            return;
          }
        }
        this._encodePax(header);
      }
      _encodePax(header) {
        const paxHeader = headers.encodePax({
          name: header.name,
          linkname: header.linkname,
          pax: header.pax
        });
        const newHeader = {
          name: "PaxHeader",
          mode: header.mode,
          uid: header.uid,
          gid: header.gid,
          size: paxHeader.byteLength,
          mtime: header.mtime,
          type: "pax-header",
          linkname: header.linkname && "PaxHeader",
          uname: header.uname,
          gname: header.gname,
          devmajor: header.devmajor,
          devminor: header.devminor
        };
        this.push(headers.encode(newHeader));
        this.push(paxHeader);
        overflow(this, paxHeader.byteLength);
        newHeader.size = header.size;
        newHeader.type = header.type;
        this.push(headers.encode(newHeader));
      }
      _doDrain() {
        const drain = this._drain;
        this._drain = noop;
        drain();
      }
      _predestroy() {
        const err = getStreamError(this);
        if (this._stream) this._stream.destroy(err);
        while (this._pending.length) {
          const stream = this._pending.shift();
          stream.destroy(err);
          stream._continueOpen();
        }
        this._doDrain();
      }
      _read(cb) {
        this._doDrain();
        cb();
      }
    };
    module.exports = function pack(opts) {
      return new Pack(opts);
    };
    function modeToType(mode) {
      switch (mode & constants.S_IFMT) {
        case constants.S_IFBLK:
          return "block-device";
        case constants.S_IFCHR:
          return "character-device";
        case constants.S_IFDIR:
          return "directory";
        case constants.S_IFIFO:
          return "fifo";
        case constants.S_IFLNK:
          return "symlink";
      }
      return "file";
    }
    function noop() {
    }
    function overflow(self, size) {
      size &= 511;
      if (size) self.push(END_OF_TAR.subarray(0, 512 - size));
    }
    function mapWritable(buf) {
      return b4a.isBuffer(buf) ? buf : b4a.from(buf);
    }
  }
});

// ../../node_modules/.pnpm/tar-stream@3.1.7/node_modules/tar-stream/index.js
var require_tar_stream = __commonJS({
  "../../node_modules/.pnpm/tar-stream@3.1.7/node_modules/tar-stream/index.js"(exports) {
    exports.extract = require_extract();
    exports.pack = require_pack();
  }
});

// assets.ts
import { MinecraftFolder } from "@xmcl/core";
import { isNotNull } from "@xmcl/core/utils";
import {
  download,
  downloadMultiple,
  getDownloadBaseOptions
} from "@xmcl/file-transfer";
import { link } from "fs";
import { readFile, stat as stat3, writeFile } from "fs/promises";
import { join } from "path";
import { promisify } from "util";

// diagnose.ts
import { access as access2, stat as stat2 } from "fs/promises";

// utils.ts
import { spawn } from "child_process";
import { access, mkdir, stat } from "fs/promises";
import { dirname } from "path";
import { checksum } from "@xmcl/core";
function missing(target) {
  return access(target).then(
    () => false,
    () => true
  );
}
async function ensureDir(target) {
  try {
    await mkdir(target);
  } catch (err) {
    const e = err;
    if (await stat(target).then((s) => s.isDirectory()).catch(() => false)) {
      return;
    }
    if (e.code === "EEXIST") {
      return;
    }
    if (e.code === "ENOENT") {
      if (dirname(target) === target) {
        throw e;
      }
      try {
        await ensureDir(dirname(target));
        await mkdir(target);
      } catch {
        if (await stat(target).then((s) => s.isDirectory()).catch((e2) => false)) {
          return;
        }
        throw e;
      }
      return;
    }
    throw e;
  }
}
function ensureFile(target) {
  return ensureDir(dirname(target));
}
function spawnProcess(spawnJavaOptions, args, options) {
  const process2 = ((spawnJavaOptions == null ? void 0 : spawnJavaOptions.spawn) ?? spawn)(spawnJavaOptions.java ?? "java", args, options);
  return waitProcess(process2);
}
var ProcessExitError = class extends Error {
  constructor(exitCode, signal, stderr) {
    super(stderr || `Process exited with code ${exitCode ?? "unknown"}`);
    this.exitCode = exitCode;
    this.signal = signal;
    this.stderr = stderr;
  }
  exitCode;
  signal;
  stderr;
  name = "ProcessExitError";
};
function waitProcess(process2) {
  return new Promise((resolve, reject) => {
    var _a, _b, _c, _d;
    const errorMsg = [];
    let outputLength = 0;
    const appendStderr = (chunk) => {
      const remaining = 4096 - outputLength;
      if (remaining <= 0) return;
      const clipped = chunk.slice(0, remaining);
      errorMsg.push(clipped);
      outputLength += clipped.length;
    };
    process2.on("error", (err) => {
      reject(err);
    });
    process2.once("close", (code, signal) => {
      if (code !== 0) {
        reject(new ProcessExitError(code, signal, errorMsg.join("")));
      } else {
        resolve();
      }
    });
    (_a = process2.stdout) == null ? void 0 : _a.setEncoding("utf-8");
    (_b = process2.stdout) == null ? void 0 : _b.on("data", (buf) => {
    });
    (_c = process2.stderr) == null ? void 0 : _c.setEncoding("utf-8");
    (_d = process2.stderr) == null ? void 0 : _d.on("data", (buf) => {
      appendStderr(buf.toString());
    });
  });
}

// diagnose.ts
async function diagnoseFile({
  file,
  expectedChecksum,
  role,
  hint,
  algorithm
}, options) {
  let issue = false;
  let receivedChecksum = "";
  algorithm = algorithm ?? "sha1";
  const checksumFunc = (options == null ? void 0 : options.checksum) ?? checksum;
  const signal = options == null ? void 0 : options.signal;
  const fileExisted = await access2(file).then(
    () => true,
    () => false
  );
  if (signal == null ? void 0 : signal.aborted) return;
  if (!fileExisted) {
    issue = true;
  } else if (expectedChecksum !== "") {
    receivedChecksum = await checksumFunc(file, algorithm).catch((e) => {
      if (e.code === "ENOENT") {
        return "";
      }
      throw e;
    });
    if (signal == null ? void 0 : signal.aborted) return;
    issue = receivedChecksum !== expectedChecksum;
  } else {
    const fstat = await stat2(file).catch(() => ({ size: 0 }));
    if (fstat.size === 0) {
      issue = true;
    }
  }
  const type = fileExisted ? "corrupted" : "missing";
  if (issue) {
    return {
      type,
      role,
      file,
      expectedChecksum,
      receivedChecksum,
      hint
    };
  }
  return void 0;
}

// error.ts
var InstallError = class extends Error {
  constructor(issue = {}, message = "", cause) {
    super(message, { cause });
    this.issue = issue;
    this.name = "InstallError";
  }
  issue;
};
function mergeInstallIssue(target, source) {
  if (source.jar) {
    target.jar = source.jar;
  }
  if (source.assetsIndex) {
    target.assetsIndex = source.assetsIndex;
  }
  if (source.libraries) {
    target.libraries = (target.libraries ?? []).concat(source.libraries);
  }
  if (source.assets) {
    target.assets = (target.assets ?? []).concat(source.assets);
  }
  if (source.forge) {
    target.forge = source.forge;
  }
  if (source.profile) {
    target.profile = source.profile;
  }
  if (source.optifine) {
    target.optifine = source.optifine;
  }
  return target;
}
function isInstallError(e) {
  return e instanceof InstallError || e && typeof e === "object" && "issue" in e && e.issue && e.name === "InstallError";
}

// tracker.ts
import {
  ProgressTrackerMultiple,
  ProgressTrackerSingle
} from "@xmcl/file-transfer";
function onState(tracker, phase, payload) {
  tracker == null ? void 0 : tracker({ phase, payload });
}
function onProgress(tracker, phase, payload) {
  const single = { progress: 0, total: 0 };
  tracker == null ? void 0 : tracker({ phase, payload: { ...payload, progress: single } });
  return single;
}
function onDownloadMultiple(tracker, phase, payload) {
  const parent = new ProgressTrackerMultiple();
  tracker == null ? void 0 : tracker({ phase, payload: { ...payload, progress: parent } });
  return parent;
}
function onDownloadSingle(tracker, phase, payload) {
  const single = new ProgressTrackerSingle();
  tracker == null ? void 0 : tracker({ phase, payload: { ...payload, progress: single } });
  return single;
}

// utils.browser.ts
function normalizeArray(arr = []) {
  return arr instanceof Array ? arr : [arr];
}
function joinUrl(a, b) {
  if (a.endsWith("/") && b.startsWith("/")) {
    return a + b.substring(1);
  }
  if (!a.endsWith("/") && !b.startsWith("/")) {
    return a + "/" + b;
  }
  return a + b;
}
function doFetch(o, url, init) {
  if (init) {
    init.signal = o == null ? void 0 : o.signal;
  } else {
    init = { signal: o == null ? void 0 : o.signal };
  }
  return (o == null ? void 0 : o.fetch) ? o.fetch(url, init) : fetch(url, init);
}
function resolveDownloadUrls(original, version, option) {
  const result = [];
  if (typeof option === "function") {
    result.unshift(...normalizeArray(option(version)));
  } else {
    result.unshift(...normalizeArray(option));
  }
  if (result.indexOf(original) === -1) {
    result.push(original);
  }
  return result;
}

// assets.ts
var DEFAULT_RESOURCE_ROOT_URL = "https://resources.download.minecraft.net";
async function installAssets(version, options = {}) {
  var _a, _b;
  const folder = MinecraftFolder.from(version.minecraftDirectory);
  if ((_b = (_a = version.logging) == null ? void 0 : _a.client) == null ? void 0 : _b.file) {
    const file = version.logging.client.file;
    await diagnoseFile(
      {
        file: folder.getLogConfig(file.id),
        expectedChecksum: file.sha1,
        role: "log config",
        hint: "Problem on log config! Please consider to use Installer.installAssets to fix."
      },
      { signal: options.abortSignal, checksum: options.checksum }
    ).catch(async (e) => {
      if (options.diagnose) {
        throw e;
      }
      await download({
        url: [file.url],
        destination: folder.getLogConfig(file.id),
        expectedTotal: file.size,
        ...getDownloadBaseOptions(options),
        tracker: onDownloadSingle(options.tracker, "assets.logConfig", { url: file.url }),
        signal: options.abortSignal
      });
    }).catch(() => {
    });
  }
  if (!version.assetIndex) {
    throw new Error("Cannot install assets for version without assetIndex");
  }
  const assetIndexInfo = version.assetIndex;
  const jsonPath = folder.getPath(
    "assets",
    "indexes",
    (options.useHashForAssetsIndex ? assetIndexInfo.sha1 : version.assets) + ".json"
  );
  const fetchAssetIndex = async () => {
    const urls = resolveDownloadUrls(assetIndexInfo.url, version, options.assetsIndexUrl);
    for (const url of urls) {
      try {
        const response = await doFetch(options, url, {
          signal: options.abortSignal
        });
        if (!response.ok) {
          continue;
        }
        const json = await response.json();
        await writeFile(jsonPath, JSON.stringify(json));
        return json;
      } catch {
      }
    }
    throw new InstallError({
      assetsIndex: assetIndexInfo
    });
  };
  const readJson = async () => readFile(jsonPath, "utf-8").then((b) => JSON.parse(b));
  await ensureDir(folder.getPath("assets", "objects"));
  const assetIndex = await readJson().catch(async (e) => {
    if (options.diagnose) {
      throw new InstallError(
        {
          assetsIndex: assetIndexInfo
        },
        `Install asset index from ${assetIndexInfo.id} (${assetIndexInfo.url}) failed`,
        e
      );
    }
    await download({
      url: resolveDownloadUrls(assetIndexInfo.url, version, options.assetsIndexUrl),
      destination: jsonPath,
      ...getDownloadBaseOptions(options),
      tracker: onDownloadSingle(options.tracker, "assets.assetIndex", { url: assetIndexInfo.url }),
      signal: options.abortSignal
    });
    const result = await readJson().catch(fetchAssetIndex);
    await promisify(link)(
      folder.getPath("assets", "indexes", assetIndexInfo.sha1 + ".json"),
      folder.getPath("assets", "indexes", version.assets + ".json")
    ).catch(() => {
    });
    return result;
  });
  const { objects } = assetIndex;
  const objectArray = Object.keys(objects).map((k) => ({ name: k, ...objects[k] }));
  await installResolvedAssets(objectArray, folder, version.id, options);
  return version;
}
async function diagnoseAssets(assetObjects, minecraft, options) {
  const signal = options == null ? void 0 : options.signal;
  const issues = await Promise.all(
    assetObjects.map(async (asset) => {
      const assetPath = minecraft.getAsset(asset.hash);
      const { hash, size, name: filename } = asset;
      if (options == null ? void 0 : options.strict) {
        const issue = await diagnoseFile(
          {
            file: assetPath,
            expectedChecksum: hash,
            role: "asset",
            hint: "Problem on asset! Please consider to use Installer.installAssets to fix."
          },
          options
        );
        if (issue) {
          return asset;
        }
      } else {
        const { size: realSize } = await stat3(assetPath).catch(() => ({ size: -1 }));
        if (signal == null ? void 0 : signal.aborted) return;
        if (realSize !== size) {
          const issue = await diagnoseFile(
            {
              file: assetPath,
              expectedChecksum: hash,
              role: "asset",
              hint: "Problem on asset! Please consider to use Installer.installAssets to fix."
            },
            options
          );
          if (issue) {
            return asset;
          }
        }
      }
      return void 0;
    })
  );
  return issues.filter(isNotNull);
}
async function installResolvedAssets(assets, folder, version, options = {}) {
  await diagnoseAssets(assets, folder, {
    signal: options.abortSignal,
    checksum: options.checksum,
    strict: options.strict
  }).then(async (assets2) => {
    var _a;
    if (assets2.length === 0) {
      return;
    }
    if (options.diagnose) {
      throw new InstallError({
        assets: assets2
      });
    }
    const assetsHosts = normalizeArray(options.assetsHost || DEFAULT_RESOURCE_ROOT_URL);
    if (assetsHosts.length > 1) {
      assetsHosts.push(
        ...assetsHosts
      );
    }
    const results = await downloadMultiple({
      options: assets2.map((asset) => {
        const { hash, size } = asset;
        const head = hash.substring(0, 2);
        const dir = folder.getPath("assets", "objects", head);
        const file = join(dir, hash);
        const urls = assetsHosts.map((h) => `${h}/${head}/${hash}`);
        return {
          url: urls,
          destination: file,
          expectedTotal: size
        };
      }),
      signal: options.abortSignal,
      ...getDownloadBaseOptions(options),
      tracker: onDownloadMultiple(options.tracker, "assets.assets", { count: assets2.length })
    });
    const unfixedIssues = results.filter((r) => r.status === "rejected").map((r, index) => {
      return { reason: r.reason, asset: assets2[index] };
    });
    if (unfixedIssues.length > 0) {
      if (((_a = options.abortSignal) == null ? void 0 : _a.aborted) && options.abortSignal.reason) {
        throw options.abortSignal.reason;
      }
      throw new InstallError(
        {
          assets: unfixedIssues.map((i) => i.asset)
        },
        "",
        new AggregateError(unfixedIssues.map((i) => i.reason))
      );
    }
  });
}

// fabric.ts
import { MinecraftFolder as MinecraftFolder2 } from "@xmcl/core";
import { writeFile as writeFile2 } from "fs/promises";

// fabric.browser.ts
var DEFAULT_META_URL_FABRIC = "https://meta.fabricmc.net";
async function getFabricGames(options) {
  const response = await doFetch(options, `${DEFAULT_META_URL_FABRIC}/v2/game`);
  const body = await response.json();
  return body.map((g) => g.version);
}
async function getFabricLoaders(options) {
  const response = await doFetch(options, `${DEFAULT_META_URL_FABRIC}/v2/versions/loader`);
  const body = response.json();
  return body;
}
async function getLoaderArtifactListFor(minecraft, options) {
  const response = await doFetch(
    options,
    `${DEFAULT_META_URL_FABRIC}/v2/versions/loader/` + minecraft
  );
  const body = response.json();
  return body;
}
async function getFabricLoaderArtifact(minecraft, loader, options) {
  const response = await doFetch(
    options,
    `${DEFAULT_META_URL_FABRIC}/v2/versions/loader/` + minecraft + "/" + loader
  );
  const body = response.json();
  return body;
}

// fabric.ts
function getVersionJsonFromLoaderArtifact(loader, side, options = {}) {
  const mcversion = loader.intermediary.version;
  const id = options.versionId || `${mcversion}-fabric${loader.loader.version}`;
  const libraries = [
    { name: loader.loader.maven, url: "https://maven.fabricmc.net/" },
    { name: loader.intermediary.maven, url: "https://maven.fabricmc.net/" },
    ...loader.launcherMeta.libraries.common,
    ...loader.launcherMeta.libraries[side]
  ];
  const mainClass = loader.launcherMeta.mainClass[side];
  const inheritsFrom = options.inheritsFrom || mcversion;
  return {
    id,
    inheritsFrom,
    mainClass,
    libraries,
    arguments: {
      game: [],
      jvm: []
    },
    releaseTime: (/* @__PURE__ */ new Date()).toJSON(),
    time: (/* @__PURE__ */ new Date()).toJSON()
  };
}
async function installFabricByLoaderArtifact(loader, minecraft, options = {}) {
  const folder = MinecraftFolder2.from(minecraft);
  const side = options.side || "client";
  const version = getVersionJsonFromLoaderArtifact(loader, side, options);
  const jsonFile = side === "client" ? folder.getVersionJson(version.id) : folder.getVersionServerJson(version.id);
  await ensureFile(jsonFile);
  await writeFile2(jsonFile, JSON.stringify(version, null, 4));
  return version.id;
}
async function installFabric(options) {
  const side = options.side ?? "client";
  const url = side === "client" ? `${DEFAULT_META_URL_FABRIC}/v2/versions/loader/${options.minecraftVersion}/${options.version}/profile/json` : `${DEFAULT_META_URL_FABRIC}/v2/versions/loader/${options.minecraftVersion}/${options.version}/server/json`;
  const response = await doFetch(options, url);
  const content = await response.json();
  const minecraft = MinecraftFolder2.from(options.minecraft);
  if (options.inheritsFrom) {
    content.inheritsFrom = options.inheritsFrom;
    content.id = options.versionId || `${options.inheritsFrom}-fabric${options.version}`;
  } else {
    content.id = options.versionId || `${options.minecraftVersion}-fabric${options.version}`;
  }
  const jsonPath = side === "client" ? minecraft.getVersionJson(content.id) : minecraft.getVersionServerJson(content.id);
  await ensureFile(jsonPath);
  await writeFile2(jsonPath, JSON.stringify(content));
  return content.id;
}

// forge.ts
var import_yazl = __toESM(require_yazl());
import { LibraryInfo as LibraryInfo2, MinecraftFolder as MinecraftFolder5, Version as VersionJson2 } from "@xmcl/core";
import { download as download2, getDownloadBaseOptions as getDownloadBaseOptions3 } from "@xmcl/file-transfer";
import { filterEntries as filterEntries2, open as open3, openEntryReadStream, readAllEntries as readAllEntries2, readEntry as readEntry2 } from "@xmcl/unzip";
import { createWriteStream } from "fs";
import { writeFile as writeFile4 } from "fs/promises";
import { dirname as dirname3, join as join4, relative as relative2, sep as sep2 } from "path";
import { pipeline } from "stream/promises";

// forge.browser.ts
import { parse as parseForge } from "@xmcl/forge-site-parser";
var DEFAULT_FORGE_MAVEN = "https://maven.minecraftforge.net";
async function getForgeVersionList(options = {}) {
  const mcversion = options.minecraft || "";
  const url = mcversion === "" ? "https://files.minecraftforge.net/net/minecraftforge/forge/index.html" : `https://files.minecraftforge.net/net/minecraftforge/forge/index_${mcversion}.html`;
  const response = await doFetch(options, url);
  const body = parseForge(await response.text());
  return body;
}

// libraries.ts
import { MinecraftFolder as MinecraftFolder3 } from "@xmcl/core";
import { isNotNull as isNotNull2 } from "@xmcl/core/utils";
import { open, walkEntriesGenerator } from "@xmcl/unzip";
import {
  downloadMultiple as downloadMultiple2,
  getDownloadBaseOptions as getDownloadBaseOptions2
} from "@xmcl/file-transfer";
import { stat as stat4 } from "fs/promises";
import { join as join2 } from "path";
async function installLibraries(version, options = {}) {
  return installResolvedLibraries(version.libraries, version.minecraftDirectory, options);
}
async function installResolvedLibraries(libraries, minecraft, option = {}) {
  const folder = MinecraftFolder3.from(typeof minecraft === "string" ? minecraft : minecraft.root);
  await diagnoseLibraries(libraries, folder, {
    signal: option.signal,
    checksum: option.checksum,
    strict: option.strict
  }).then(async (libs) => {
    var _a;
    if (libs.length === 0) {
      return;
    }
    if (option.diagnose) {
      throw new InstallError({
        libraries: libs
      });
    }
    const results = await downloadMultiple2({
      options: libs.map((lib) => {
        const libraryPath = lib.download.path;
        const destination = join2(folder.libraries, libraryPath);
        const urls = resolveLibraryDownloadUrls(lib, option);
        if (urls.length > 2) {
          urls.push(...urls);
        }
        return {
          url: urls,
          destination,
          expectedTotal: lib.download.size
        };
      }),
      signal: option.signal,
      tracker: onDownloadMultiple(option.tracker, "libraries", { count: libraries.length }),
      ...getDownloadBaseOptions2(option)
    });
    if ((_a = option.signal) == null ? void 0 : _a.aborted) {
      throw option.signal.reason;
    }
    const error = results.map((r, i) => [r, libs[i]]).filter(([r]) => r.status === "rejected");
    if (error.length > 0) {
      throw new InstallError(
        {
          libraries: error.map(([_, lib]) => lib)
        },
        "",
        new AggregateError(error.map(([r]) => r.reason))
      );
    }
  });
}
var DEFAULT_MAVENS = ["https://repo1.maven.org/maven2/"];
function resolveLibraryDownloadUrls(library, libraryOptions) {
  var _a;
  const urls = ((_a = libraryOptions.libraryHost) == null ? void 0 : _a.call(libraryOptions, library)) ?? [
    ...normalizeArray(libraryOptions.mavenHost).map((m) => joinUrl(m, library.download.path)),
    library.download.url,
    ...DEFAULT_MAVENS.map((m) => joinUrl(m, library.download.path))
  ];
  return [...new Set(normalizeArray(urls))];
}
async function diagnoseLibraries(libraries, minecraft, options) {
  const signal = options == null ? void 0 : options.signal;
  const issues = await Promise.all(
    libraries.map(async (lib) => {
      if (!lib.download.path) {
        throw new TypeError(`Cannot diagnose library without path! ${JSON.stringify(lib)}`);
      }
      const libPath = minecraft.getLibraryByPath(lib.download.path);
      if (!(options == null ? void 0 : options.strict)) {
        if (lib.download.sha1) {
          const issue = await diagnoseFile(
            {
              file: libPath,
              expectedChecksum: lib.download.sha1,
              role: "library",
              hint: "Problem on library! Please consider to use Installer.installLibraries to fix."
            },
            options
          );
          if (issue) {
            return lib;
          }
        } else {
          try {
            const zip = await open(libPath);
            try {
              for await (const _ of walkEntriesGenerator(zip)) {
              }
            } finally {
              zip.close();
            }
          } catch {
            return lib;
          }
        }
      } else {
        const size = lib.download.size;
        const { size: realSize } = await stat4(libPath).catch(() => ({ size: -1 }));
        if (signal == null ? void 0 : signal.aborted) return;
        if (size !== -1 && realSize !== size) {
          const issue = await diagnoseFile(
            {
              file: libPath,
              expectedChecksum: lib.download.sha1,
              role: "library",
              hint: "Problem on library! Please consider to use Installer.installLibraries to fix."
            },
            options
          );
          if (issue) {
            return lib;
          }
        }
      }
      return void 0;
    })
  );
  return issues.filter(isNotNull2);
}

// profile.ts
import {
  LibraryInfo,
  MinecraftFolder as MinecraftFolder4,
  Version,
  Version as VersionJson
} from "@xmcl/core";
import { filterEntries, open as open2, readEntry, walkEntriesGenerator as walkEntriesGenerator2 } from "@xmcl/unzip";
import { spawn as spawn2 } from "child_process";
import { readFile as readFile2, writeFile as writeFile3 } from "fs/promises";
import { delimiter, dirname as dirname2, join as join3, relative, sep } from "path";

// manifest.ts
function convertClasspathToMaven(paths) {
  return paths.map((path) => {
    const trimmedPath = path.replace(/^libraries\//, "");
    const parts = trimmedPath.split("/");
    let jarName = parts.pop();
    const version = parts.pop();
    const artifactId = parts.pop();
    const groupIdParts = parts;
    const groupId = groupIdParts.join(".");
    let classifier = "";
    if (jarName) {
      jarName = jarName.replace(/\.jar$/, "");
      const jarParts = jarName == null ? void 0 : jarName.substring(`${artifactId}-${version}`.length + 1).split("-");
      if (jarParts && jarParts.length > 0) {
        classifier = jarParts[0];
      }
    }
    let mavenCoordinate = `${groupId}:${artifactId}:${version}`;
    if (classifier) {
      mavenCoordinate += `:${classifier}`;
    }
    return mavenCoordinate;
  });
}
function parseManifest(manifestContent) {
  const lines = manifestContent.split("\r\n");
  let mainClass = "";
  let classPath = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("Main-Class:")) {
      mainClass = line.substring("Main-Class:".length).trim();
    } else if (line.startsWith("Class-Path:")) {
      let classPathLine = line.substring("Class-Path:".length).trim();
      while (i + 1 < lines.length && lines[i + 1].startsWith(" ")) {
        i++;
        classPathLine += lines[i].slice(1);
      }
      classPath = classPathLine.split(" ").filter((path) => path.length > 0);
    }
  }
  return {
    mainClass,
    classPath
  };
}

// profile.ts
async function diagnoseProfile(installProfile, minecraftLocation, side = "client") {
  const mc = MinecraftFolder4.from(minecraftLocation);
  const processors = resolveProcessors(side, installProfile, mc);
  const issues = await Promise.all(
    Version.resolveLibraries(installProfile.libraries).map(async (lib) => {
      const libPath = mc.getLibraryByPath(lib.download.path);
      return await diagnoseFile({
        role: "library",
        file: libPath,
        expectedChecksum: lib.download.sha1,
        hint: "Problem on install_profile! Please consider to use Installer.installByProfile to fix."
      });
    })
  );
  for (const proc of processors) {
    if (proc.outputs) {
      for (const [file, checksum2] of Object.entries(proc.outputs)) {
        issues.push(await diagnoseProcessorOutput(file, checksum2.replace(/'/g, "")));
      }
    }
  }
  return issues.filter((v) => !!v).length > 0 ? issues.length === 1 && issues[0].file.endsWith("mappings.tsrg") && issues[0].type === "corrupted" ? false : true : false;
}
function resolveProcessors(side, installProfile, minecraft) {
  function normalizePath(val) {
    if (val && val.match(/^\[.+\]$/g)) {
      const name = val.substring(1, val.length - 1);
      return minecraft.getLibraryByPath(LibraryInfo.resolve(name).path);
    }
    return val;
  }
  const normalizeVariable = (val) => {
    if (!val) return val;
    return val.replace(/{([A-Za-z0-9_-]+)}/g, (_, key) => {
      var _a;
      return ((_a = variables[key]) == null ? void 0 : _a[side]) ?? "";
    });
  };
  const variables = {
    SIDE: {
      client: "client",
      server: "server"
    },
    MINECRAFT_JAR: {
      client: minecraft.getVersionJar(installProfile.minecraft),
      server: minecraft.getVersionJar(installProfile.minecraft, "server")
    },
    ROOT: {
      client: minecraft.root,
      server: minecraft.root
    },
    MINECRAFT_VERSION: {
      client: installProfile.minecraft,
      server: installProfile.minecraft
    },
    LIBRARY_DIR: {
      client: minecraft.libraries,
      server: minecraft.libraries
    }
  };
  if (installProfile.data) {
    for (const key in installProfile.data) {
      const { client, server } = installProfile.data[key];
      variables[key] = {
        client: normalizePath(client),
        server: normalizePath(server)
      };
    }
  }
  const resolveOutputs = (proc, args) => {
    const original = proc.outputs ? Object.entries(proc.outputs).map(([k, v]) => ({ [normalizeVariable(k)]: normalizeVariable(v) })).reduce((a, b) => Object.assign(a, b), {}) : {};
    for (const [key, val] of Object.entries(original)) {
      original[key] = val.replace(/'/g, "");
    }
    const outputIndex = args.indexOf("--output") === -1 ? args.indexOf("--out-jar") : args.indexOf("--output");
    const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : void 0;
    if (outputFile && !original[outputFile]) {
      original[outputFile] = "";
    }
    return original;
  };
  const processors = (installProfile.processors || []).map((proc) => {
    const args = proc.args.map(normalizePath).map(normalizeVariable);
    return {
      ...proc,
      args,
      outputs: resolveOutputs(proc, args)
    };
  }).filter((proc) => proc.sides ? proc.sides.indexOf(side) !== -1 : true);
  return processors;
}
async function installByProfile(installProfile, minecraft, options = {}) {
  var _a;
  const minecraftFolder = MinecraftFolder4.from(minecraft);
  const side = options.side === "server" ? "server" : "client";
  const processor = resolveProcessors(side, installProfile, minecraftFolder);
  const installRequiredLibs = VersionJson.resolveLibraries(installProfile.libraries);
  await installResolvedLibraries(installRequiredLibs, minecraft, options);
  if (options.postprocess) {
    await options.postprocess(
      processor,
      minecraftFolder,
      options,
      () => postsrocess(processor, minecraftFolder, options)
    );
  } else {
    await postsrocess(processor, minecraftFolder, options);
  }
  if (side === "client") {
    const versionJson = await readFile2(
      minecraftFolder.getVersionJson(installProfile.version)
    ).then((b) => b.toString()).then(JSON.parse);
    const libraries = VersionJson.resolveLibraries(versionJson.libraries);
    await installResolvedLibraries(libraries, minecraft, options);
  } else {
    const argsText = process.platform === "win32" ? "win_args.txt" : "unix_args.txt";
    if (!installProfile.processors) {
      return;
    }
    let txtPath;
    for (const p of installProfile.processors) {
      txtPath = p.args.find((a) => a.startsWith("{ROOT}") && a.endsWith(argsText));
      if (txtPath) {
        txtPath = txtPath.replace("{ROOT}", minecraftFolder.root);
        if (await missing(txtPath)) {
          throw new Error(`No ${argsText} found in the forge jar`);
        }
        break;
      }
    }
    const serverProfile = {
      id: installProfile.version,
      libraries: [],
      type: "release",
      arguments: {
        game: [],
        jvm: []
      },
      releaseTime: (/* @__PURE__ */ new Date()).toJSON(),
      time: (/* @__PURE__ */ new Date()).toJSON(),
      minimumLauncherVersion: 13,
      mainClass: "",
      inheritsFrom: installProfile.minecraft
    };
    let jar;
    if (!txtPath) {
      const info = LibraryInfo.resolve(installProfile.path);
      const libPath = minecraftFolder.getLibraryByPath(info.path);
      jar = libPath;
    } else {
      const content = await readFile2(txtPath, "utf-8");
      jar = parseArgumentsFromArgsFile(content, dirname2(txtPath), serverProfile);
    }
    if (jar) {
      await parseJar(minecraftFolder, jar, installProfile, serverProfile);
    }
    const neoFormVersion = (_a = serverProfile.arguments) == null ? void 0 : _a.game.find(
      (v, i, arr) => arr[i - 1] === "--fml.neoFormVersion"
    );
    if (neoFormVersion) {
      const candidates = [
        `net.minecraft:server:${installProfile.minecraft}-${neoFormVersion}:extra`,
        `net.minecraft:server:${installProfile.minecraft}-${neoFormVersion}:srg`
      ];
      for (const name of candidates) {
        const libPath = minecraftFolder.getLibraryByPath(LibraryInfo.resolve(name).path);
        if (!await missing(libPath)) {
          serverProfile.libraries.push({ name });
        }
      }
    }
    const forgeShim = serverProfile.libraries.find(
      (l) => l.name.startsWith("net.minecraftforge:forge") && l.name.endsWith(":shim")
    );
    if (forgeShim) {
      let zip;
      try {
        zip = await open2(minecraftFolder.getLibraryByPath(LibraryInfo.resolve(forgeShim.name).path));
        for await (const entry of walkEntriesGenerator2(zip)) {
          if (entry.fileName === "bootstrap-shim.list") {
            const content = await readEntry(zip, entry).then(
              (e) => e.toString().split("\n").map((v) => v.trim()).filter((v) => v).map((l) => {
                const [sha1, name, path] = l.split("	");
                return { name };
              })
            );
            serverProfile.libraries.push(...content);
            break;
          }
        }
      } finally {
        zip == null ? void 0 : zip.close();
      }
    }
    if (!serverProfile.mainClass) {
      throw new PostProcessNoMainClassError(jar);
    }
    const clientVersionJson = await readFile2(
      minecraftFolder.getVersionJson(installProfile.version)
    ).then((b) => JSON.parse(b.toString())).catch(() => void 0);
    const versionLibByName = /* @__PURE__ */ new Map();
    for (const lib of (clientVersionJson == null ? void 0 : clientVersionJson.libraries) ?? []) {
      versionLibByName.set(lib.name, lib);
    }
    const jvmArgs = serverProfile.arguments.jvm;
    const cpIndex = jvmArgs.findIndex((a) => a === "-classpath" || a === "-cp");
    const cpValue = cpIndex !== -1 ? jvmArgs[cpIndex + 1] : void 0;
    if (typeof cpValue === "string") {
      jvmArgs.splice(cpIndex, 2);
      const existingNames = new Set(serverProfile.libraries.map((l) => l.name));
      for (const entry of cpValue.split(delimiter)) {
        if (!entry) continue;
        const name = classpathEntryToLibraryName(entry);
        if (!name || existingNames.has(name)) continue;
        existingNames.add(name);
        serverProfile.libraries.push(versionLibByName.get(name) ?? { name });
      }
    }
    await writeFile3(
      join3(minecraftFolder.getVersionRoot(serverProfile.id), "server.json"),
      JSON.stringify(serverProfile, null, 4)
    );
    const resolvedLibraries = VersionJson.resolveLibraries(serverProfile.libraries);
    await installResolvedLibraries(resolvedLibraries, minecraft, options);
  }
}
function classpathEntryToLibraryName(entry) {
  const normalized = entry.replace(/^libraries[\\/]/, "");
  const parts = normalized.split(/[\\/]/);
  if (parts.length < 4) return void 0;
  const fileName = parts.pop().replace(/\.jar$/, "");
  const version = parts.pop();
  const artifactId = parts.pop();
  const groupId = parts.join(".");
  if (!groupId || !artifactId || !version || !fileName) return void 0;
  const base = `${artifactId}-${version}`;
  let name = `${groupId}:${artifactId}:${version}`;
  if (fileName.length > base.length && fileName.startsWith(`${base}-`)) {
    name += `:${fileName.slice(base.length + 1)}`;
  }
  return name;
}
var JVM_VALUE_OPTIONS = /* @__PURE__ */ new Set([
  "-p",
  "-cp",
  "-classpath",
  "--class-path",
  "--module-path",
  "--add-opens",
  "--add-exports",
  "--add-modules",
  "--add-reads",
  "--patch-module",
  "--upgrade-module-path"
]);
function parseArgumentsFromArgsFile(content, parentDir, serverProfile) {
  const args = content.split("\n").map((v) => v.trim().split(" ")).flatMap((v) => v).filter((v) => v);
  let mainClass = "";
  let jar;
  let i = 0;
  for (; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-jar") {
      jar = join3(parentDir, args[i + 1] ?? "");
      i += 2;
      break;
    }
    if (!arg.startsWith("-")) {
      mainClass = arg;
      i += 1;
      break;
    }
    serverProfile.arguments.jvm.push(arg);
    if (JVM_VALUE_OPTIONS.has(arg) && args[i + 1] !== void 0) {
      serverProfile.arguments.jvm.push(args[i + 1]);
      i += 1;
    }
  }
  for (; i < args.length; i++) {
    serverProfile.arguments.game.push(args[i]);
  }
  serverProfile.mainClass = mainClass;
  return jar;
}
async function parseJar(minecraftFolder, jar, installProfile, serverVersion) {
  let zip;
  try {
    const jsonContent = JSON.parse(
      await readFile2(minecraftFolder.getVersionJson(installProfile.version), "utf-8")
    );
    zip = await open2(jar, { lazyEntries: true, autoClose: false });
    const [entry] = await filterEntries(zip, ["META-INF/MANIFEST.MF"]);
    if (entry) {
      const manifestContent = await readEntry(zip, entry).then((b) => b.toString());
      const result = parseManifest(manifestContent);
      serverVersion.mainClass = result.mainClass;
      const cp = [
        ...result.classPath,
        relative(minecraftFolder.libraries, jar).replaceAll(sep, "/")
      ];
      serverVersion.libraries.push(
        ...jsonContent.libraries.filter((l) => !l.name.endsWith(":client"))
      );
      const mavenPaths = convertClasspathToMaven(cp);
      for (const name of mavenPaths) {
        if (serverVersion.libraries.find((l) => l.name === name)) continue;
        if (name.startsWith(":")) continue;
        serverVersion.libraries.push({ name });
      }
    }
  } catch (e) {
    throw new PostProcessBadJarError(jar, e);
  } finally {
    zip == null ? void 0 : zip.close();
  }
}
var PostProcessBadJarError = class extends Error {
  constructor(jarPath, causeBy) {
    super(`Fail to post process bad jar: ${jarPath}`);
    this.jarPath = jarPath;
    this.causeBy = causeBy;
  }
  jarPath;
  causeBy;
  name = "PostProcessBadJarError";
};
var PostProcessNoMainClassError = class extends Error {
  constructor(jarPath) {
    super(`Fail to post process bad jar without main class: ${jarPath}`);
    this.jarPath = jarPath;
  }
  jarPath;
  name = "PostProcessNoMainClassError";
};
var PostProcessFailedError = class extends Error {
  constructor(jarPath, commands, message, options) {
    super(message);
    this.jarPath = jarPath;
    this.commands = commands;
    this.processor = jarPath;
    this.exitCode = options == null ? void 0 : options.exitCode;
    this.processSignal = options == null ? void 0 : options.signal;
    this.processorOutput = options == null ? void 0 : options.output;
    Object.defineProperties(this, {
      jarPath: { enumerable: false },
      commands: { enumerable: false }
    });
  }
  jarPath;
  commands;
  processor;
  exitCode;
  processSignal;
  processorOutput;
  name = "PostProcessFailedError";
};
var PostProcessValidationFailedError = class extends PostProcessFailedError {
  constructor(jarPath, commands, message, file, expect, actual) {
    super(jarPath, commands, message);
    this.file = file;
    this.expect = expect;
    this.actual = actual;
  }
  file;
  expect;
  actual;
  name = "PostProcessValidationFailedError";
};
function sanitizePostProcessOutput(output) {
  return output.replace(/(?:[A-Za-z]:[\\/]|\/(?:home|Users)\/)[^\r\n]*/g, "<path>").slice(0, 4096);
}
async function findMainClass(lib) {
  var _a;
  let zip;
  let mainClass;
  try {
    zip = await open2(lib, { lazyEntries: true });
    for await (const entry of walkEntriesGenerator2(zip)) {
      if (entry.fileName === "META-INF/MANIFEST.MF") {
        const content = await readEntry(zip, entry).then((b) => b.toString());
        mainClass = (_a = content.split("\n").map((l) => l.split(": ")).find((arr) => arr[0] === "Main-Class")) == null ? void 0 : _a[1].trim();
        break;
      }
    }
  } catch (e) {
    throw new PostProcessBadJarError(lib, e);
  } finally {
    zip == null ? void 0 : zip.close();
  }
  if (!mainClass) {
    throw new PostProcessNoMainClassError(lib);
  }
  return mainClass;
}
async function isEmptyOrCorruptArchive(file, signal) {
  let zip;
  try {
    zip = await open2(file, { lazyEntries: true, autoClose: false });
    if (signal == null ? void 0 : signal.aborted) return false;
    return zip.entryCount <= 0;
  } catch {
    return true;
  } finally {
    zip == null ? void 0 : zip.close();
  }
}
async function diagnoseProcessorOutput(file, expectedChecksum, options) {
  const isMappings = /mappings\.tsrg$/i.test(file);
  const issue = await diagnoseFile(
    {
      role: "processor",
      file,
      expectedChecksum: isMappings ? "" : expectedChecksum,
      hint: "Re-install this installer profile!"
    },
    options
  );
  if (issue) return issue;
  if (!isMappings && expectedChecksum === "" && /\.(jar|zip)$/i.test(file)) {
    if (await isEmptyOrCorruptArchive(file, options == null ? void 0 : options.signal)) {
      return {
        type: "corrupted",
        role: "processor",
        file,
        expectedChecksum,
        receivedChecksum: "",
        hint: "Re-install this installer profile!"
      };
    }
  }
  return void 0;
}
async function diagnoseProcessorOutputs(processors, options) {
  const issues = [];
  for (const proc of processors) {
    if (!proc.outputs) continue;
    for (const [file, expected] of Object.entries(proc.outputs)) {
      const issue = await diagnoseProcessorOutput(file, expected.replace(/'/g, ""), options);
      if (issue) issues.push(issue);
    }
  }
  return issues;
}
async function postProcessOne(mc, proc, options) {
  var _a;
  if (await ((_a = options.handler) == null ? void 0 : _a.call(options, proc).catch(() => false))) {
    return;
  }
  const jarRealPath = mc.getLibraryByPath(LibraryInfo.resolve(proc.jar).path);
  const mainClass = await findMainClass(jarRealPath);
  const cp = [...proc.classpath, proc.jar].map(LibraryInfo.resolve).map((p) => mc.getLibraryByPath(p.path)).join(delimiter);
  const cmd = ["-cp", cp, mainClass, ...proc.args];
  try {
    await new Promise((resolve, reject) => {
      const process2 = ((options == null ? void 0 : options.spawn) ?? spawn2)(options.java ?? "java", cmd, {
        signal: options.signal
      });
      waitProcess(process2).then(resolve, reject);
    });
  } catch (e) {
    if (e instanceof ProcessExitError || e instanceof Error && e.name === "Error") {
      throw new PostProcessFailedError(
        proc.jar,
        [options.java ?? "java", ...cmd],
        sanitizePostProcessOutput(e.message),
        e instanceof ProcessExitError ? {
          exitCode: e.exitCode,
          signal: e.signal,
          output: sanitizePostProcessOutput(e.stderr)
        } : void 0
      );
    }
    throw e;
  }
  if (proc.outputs) {
    for (const [file, expected] of Object.entries(proc.outputs)) {
      const expectedChecksum = expected.replace(/'/g, "");
      const issue = await diagnoseProcessorOutput(file, expectedChecksum, {
        signal: options.signal,
        checksum: options.checksum
      });
      if (issue) {
        throw new PostProcessValidationFailedError(
          proc.jar,
          [options.java ?? "java", ...cmd],
          `Post processor ${proc.jar} produced ${issue.type} output ${file}` + (expectedChecksum ? ` (expected sha1 ${expectedChecksum}, got ${issue.receivedChecksum || "none"})` : " (empty or unreadable archive)"),
          file,
          expectedChecksum,
          issue.receivedChecksum
        );
      }
    }
  }
}
async function postsrocess(processors, minecraft, options) {
  const tracker = onProgress(options.tracker, "postprocess", { count: processors.length });
  tracker.total = processors.length;
  for (let i = 0; i < processors.length; i++) {
    const proc = processors[i];
    await postProcessOne(minecraft, proc, options);
    tracker.progress = i;
  }
}

// forge.ts
function getLibraryPathWithoutMaven(mc, name) {
  return mc.getLibraryByPath(name.substring(name.indexOf("/") + 1));
}
function extractEntryTo(zip, e, dest) {
  return openEntryReadStream(zip, e).then((stream) => pipeline(stream, createWriteStream(dest)));
}
async function installLegacyForgeFromUniversalZip(forgeZip, mc, forgeVersion, mcVersion) {
  const minecraftZip = await open3(mc.getVersionJar(mcVersion), {
    lazyEntries: true,
    autoClose: false
  });
  const forgeEntries = await readAllEntries2(forgeZip);
  const mcEntries = await readAllEntries2(minecraftZip);
  const finalZipEntries = {};
  for (const e of mcEntries) {
    if (e.fileName.startsWith("META-INF")) continue;
    finalZipEntries[e.fileName] = [e, minecraftZip];
  }
  for (const e of forgeEntries) {
    if (e.fileName.startsWith("META-INF")) continue;
    finalZipEntries[e.fileName] = [e, forgeZip];
  }
  const finalZip = new import_yazl.ZipFile();
  for (const [k, [e, zip]] of Object.entries(finalZipEntries)) {
    finalZip.addReadStream(await openEntryReadStream(zip, e), e.fileName);
  }
  finalZip.end();
  const dest = mc.getLibraryByPath(
    `net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}.jar`
  );
  await ensureDir(dirname3(dest));
  await pipeline(finalZip.outputStream, createWriteStream(dest));
  const versionId = `${mcVersion}-forge-${forgeVersion}`;
  await ensureDir(mc.getVersionRoot(versionId));
  const versionJson = {
    id: versionId,
    inheritsFrom: mcVersion,
    time: (/* @__PURE__ */ new Date()).toUTCString(),
    type: "release",
    releaseTime: (/* @__PURE__ */ new Date()).toUTCString(),
    minimumLauncherVersion: 4,
    arguments: {
      game: [],
      // eslint-disable-next-line no-template-curly-in-string
      jvm: ["-Dminecraft.applet.TargetDirectory=${game_directory}"]
    },
    mainClass: "net.minecraft.launchwrapper.Launch",
    libraries: [
      { name: `net.minecraftforge:forge:${forgeVersion}` },
      {
        downloads: {
          artifact: {
            path: "guava-12.0.1.jar",
            sha1: "b8e78b9af7bf45900e14c6f958486b6ca682195f",
            size: -1,
            url: "https://files.minecraftforge.net/maven/com/google/guava/guava/12.0.1/guava-12.0.1.jar"
          }
        },
        name: "com.google.guava:guava:12.0.1"
      },
      {
        downloads: {
          artifact: {
            path: "argo-2.25.jar",
            sha1: "bb672829fde76cb163004752b86b0484bd0a7f4b",
            size: -1,
            url: "https://files.minecraftforge.net/maven/net/sourceforge/argo/argo/2.25/argo-2.25.jar"
          }
        },
        name: "net.sourceforge.argo:argo:2.25"
      },
      {
        downloads: {
          artifact: {
            path: "asm-all-4.0.jar",
            sha1: "98308890597acb64047f7e896638e0d98753ae82",
            size: -1,
            url: "https://files.multimc.org/fmllibs/asm-all-4.0.jar"
          }
        },
        name: "org.ow2.asm:asm-all:4.0"
      },
      {
        downloads: {
          artifact: {
            path: "bcprov-jdk15on-147.jar",
            sha1: "b6f5d9926b0afbde9f4dbe3db88c5247be7794bb",
            size: -1,
            url: "https://files.multimc.org/fmllibs/bcprov-jdk15on-147.jar"
          }
        },
        name: "org.bouncycastle:bcprov-jdk15on:1.47"
      }
    ]
  };
  await writeFile4(mc.getVersionJson(versionId), JSON.stringify(versionJson, null, 4));
  return versionId;
}
async function installLegacyForgeFromZip(zip, entries, profile, mc, jarFilePath, options) {
  const versionJson = profile.versionInfo;
  if (!versionJson) {
    throw new Error(`Malform legacy installer json ${profile.version}`);
  }
  versionJson.id = options.versionId || versionJson.id;
  versionJson.inheritsFrom = options.inheritsFrom || versionJson.inheritsFrom;
  const rootPath = mc.getVersionRoot(versionJson.id);
  const versionJsonPath = join4(rootPath, `${versionJson.id}.json`);
  await ensureFile(versionJsonPath);
  const forgeLib = versionJson.libraries.find(
    (l) => l.name.startsWith("net.minecraftforge:forge") || l.name.startsWith("net.minecraftforge:minecraftforge")
  );
  if (!forgeLib) {
    throw new BadForgeInstallerJarError(jarFilePath);
  }
  const library = LibraryInfo2.resolve(forgeLib);
  const jarPath = mc.getLibraryByPath(library.path);
  await ensureFile(jarPath);
  await Promise.all([
    writeFile4(versionJsonPath, JSON.stringify(versionJson, void 0, 4)),
    extractEntryTo(zip, entries.legacyUniversalJar, jarPath)
  ]);
  return versionJson.id;
}
async function unpackForgeInstaller(zip, entries, profile, mc, jarPath, options) {
  const versionJson = await readEntry2(zip, entries.versionJson).then((b) => b.toString()).then(JSON.parse);
  versionJson.id = options.versionId || versionJson.id;
  versionJson.inheritsFrom = options.inheritsFrom || versionJson.inheritsFrom;
  const rootPath = mc.getVersionRoot(versionJson.id);
  const versionJsonPath = join4(rootPath, `${versionJson.id}.json`);
  const installJsonPath = join4(rootPath, "install_profile.json");
  const mavenLibVersionPath = dirname3(jarPath);
  const unpackData = (entry) => {
    promises.push(
      extractEntryTo(
        zip,
        entry,
        join4(mavenLibVersionPath, entry.fileName.substring("data/".length))
      )
    );
  };
  await ensureFile(versionJsonPath);
  const promises = [];
  if (entries.forgeUniversalJar) {
    promises.push(
      extractEntryTo(
        zip,
        entries.forgeUniversalJar,
        getLibraryPathWithoutMaven(mc, entries.forgeUniversalJar.fileName)
      )
    );
  }
  if (!profile.data) {
    profile.data = {};
  }
  const mavenPaths = relative2(mc.libraries, mavenLibVersionPath).split(sep2);
  const mavenVersion = mavenPaths.pop();
  const mavenArtifact = mavenPaths.pop();
  const mavenGroup = mavenPaths.join(".");
  const mavenPath = `${mavenGroup}:${mavenArtifact}:${mavenVersion}`;
  const installerMaven = `${mavenPath}:installer`;
  profile.data.INSTALLER = {
    client: `[${installerMaven}]`,
    server: `[${installerMaven}]`
  };
  const lzmaMavenByDataPath = {};
  const extractLzma = async (entry, classifier) => {
    if (!entry) return;
    const maven = `${mavenPath}:${classifier}@lzma`;
    const binPath = mc.getLibraryByPath(LibraryInfo2.resolve(maven).path);
    await ensureFile(binPath);
    promises.push(extractEntryTo(zip, entry, binPath));
    lzmaMavenByDataPath[`/${entry.fileName}`] = `[${maven}]`;
  };
  await Promise.all([
    extractLzma(entries.clientLzma, "clientdata"),
    extractLzma(entries.serverLzma, "serverdata")
  ]);
  if (profile.data.BINPATCH) {
    for (const side of ["client", "server"]) {
      const dataPath = profile.data.BINPATCH[side];
      const maven = lzmaMavenByDataPath[dataPath];
      if (maven) {
        profile.data.BINPATCH[side] = maven;
      }
    }
  }
  if (entries.forgeJar) {
    promises.push(
      extractEntryTo(
        zip,
        entries.forgeJar,
        getLibraryPathWithoutMaven(mc, entries.forgeJar.fileName)
      )
    );
  }
  if (entries.shimJar) {
    promises.push(
      extractEntryTo(
        zip,
        entries.shimJar,
        getLibraryPathWithoutMaven(mc, entries.shimJar.fileName)
      )
    );
  }
  if (entries.runBat) {
    unpackData(entries.runBat);
  }
  if (entries.runSh) {
    unpackData(entries.runSh);
  }
  if (entries.winArgs) {
    unpackData(entries.winArgs);
  }
  if (entries.unixArgs) {
    unpackData(entries.unixArgs);
  }
  if (entries.userJvmArgs) {
    unpackData(entries.userJvmArgs);
  }
  promises.push(
    writeFile4(installJsonPath, JSON.stringify(profile)),
    writeFile4(versionJsonPath, JSON.stringify(versionJson))
  );
  await Promise.all(promises);
  return versionJson.id;
}
function isLegacyForgeInstallerEntries(entries) {
  return !!entries.legacyUniversalJar && !!entries.installProfileJson;
}
function isForgeInstallerEntries(entries) {
  return !!entries.installProfileJson && !!entries.versionJson;
}
async function walkForgeInstallerEntries(zip, forgeVersion) {
  const [
    forgeJar,
    forgeUniversalJar,
    shimJar,
    clientLzma,
    serverLzma,
    installProfileJson,
    versionJson,
    legacyUniversalJar,
    runSh,
    runBat,
    unixArgs,
    userJvmArgs,
    winArgs
  ] = await filterEntries2(zip, [
    `maven/net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}.jar`,
    `maven/net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-universal.jar`,
    `maven/net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-shim.jar`,
    "data/client.lzma",
    "data/server.lzma",
    "install_profile.json",
    "version.json",
    (e) => e.fileName === `forge-${forgeVersion}-universal.jar` || e.fileName.startsWith("forge-") && e.fileName.endsWith("-universal.jar") || e.fileName.startsWith("minecraftforge-universal-"),
    // legacy installer format
    "data/run.sh",
    "data/run.bat",
    "data/unix_args.txt",
    "data/user_jvm_args.txt",
    "data/win_args.txt"
  ]);
  return {
    forgeJar,
    forgeUniversalJar,
    shimJar,
    clientLzma,
    serverLzma,
    installProfileJson,
    versionJson,
    legacyUniversalJar,
    runSh,
    runBat,
    unixArgs,
    userJvmArgs,
    winArgs
  };
}
var BadForgeInstallerJarError = class extends Error {
  constructor(jarPath, entry) {
    super(
      entry ? `Missing entry ${entry} in forge installer jar: ${jarPath}` : `Bad forge installer: ${jarPath}`
    );
    this.jarPath = jarPath;
    this.entry = entry;
  }
  jarPath;
  entry;
  name = "BadForgeInstallerJarError";
};
async function downloadForgeJar(forgeVersion, mcVersion, installer, minecraft, options, legacy) {
  const classifier = legacy ? "universal" : "installer";
  const ext = legacy ? "zip" : "jar";
  const path = installer ? installer.path : `net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-${classifier}.${ext}`;
  let url;
  if (installer) {
    try {
      const parsedUrl = new URL(path);
      url = parsedUrl.toString();
    } catch (e) {
      const forgeMavenPath = path.replace("/maven", "").replace("maven", "");
      url = joinUrl(DEFAULT_FORGE_MAVEN, forgeMavenPath);
    }
  } else {
    const forgeMavenPath = path.replace("/maven", "").replace("maven", "");
    url = joinUrl(DEFAULT_FORGE_MAVEN, forgeMavenPath);
  }
  const library = VersionJson2.resolveLibrary({
    name: `net.minecraftforge:forge:${forgeVersion}:${classifier}`,
    downloads: {
      artifact: {
        url,
        path: `net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-${classifier}.${ext}`,
        size: -1,
        sha1: (installer == null ? void 0 : installer.sha1) || ""
      }
    }
  });
  const mavenHost = options.mavenHost ? normalizeArray(options.mavenHost) : [];
  if (mavenHost.indexOf(DEFAULT_FORGE_MAVEN) === -1) {
    mavenHost.push(DEFAULT_FORGE_MAVEN);
  }
  const urls = resolveLibraryDownloadUrls(library, { ...options, mavenHost });
  const installJarPath = minecraft.getLibraryByPath(library.path);
  if (library.download.sha1) {
    await diagnoseFile(
      {
        file: installJarPath,
        algorithm: "sha1",
        expectedChecksum: library.download.sha1,
        role: "forgeInstaller",
        hint: "Problem on forge installer jar! Please consider to use Installer.installForge to fix."
      },
      { signal: options.signal, checksum: options.checksum }
    ).then(async (issue) => {
      if (!issue) {
        return;
      }
      if (options.diagnose) {
        throw new InstallError({
          forge: {
            minecraft: mcVersion,
            version: forgeVersion
          }
        });
      }
      await download2({
        url: urls,
        destination: installJarPath,
        ...getDownloadBaseOptions3(options),
        tracker: onDownloadSingle(options.tracker, "forge.installer", {
          version: forgeVersion,
          path: url
        }),
        signal: options.signal
      });
    });
  } else {
    await download2({
      url: urls,
      destination: installJarPath,
      ...getDownloadBaseOptions3(options),
      tracker: onDownloadSingle(options.tracker, "forge.installer", {
        version: forgeVersion,
        path: url
      }),
      signal: options.signal
    });
  }
  return installJarPath;
}
async function installForge(version, minecraft, options = {}) {
  function getForgeArtifactVersion() {
    const [_, minor] = version.mcversion.split(".");
    const minorVersion = Number.parseInt(minor);
    if (minorVersion >= 7 && minorVersion <= 8) {
      return `${version.mcversion}-${version.version}-${version.mcversion}`;
    }
    if (version.version.startsWith(version.mcversion)) {
      return version.version;
    }
    return `${version.mcversion}-${version.version}`;
  }
  const forgeVersion = getForgeArtifactVersion();
  const isLegacy = version.mcversion.startsWith("1.4.");
  const mc = MinecraftFolder5.from(minecraft);
  const jarPath = await downloadForgeJar(
    forgeVersion,
    version.mcversion,
    version.installer,
    mc,
    options,
    isLegacy
  );
  if (isLegacy) {
    const forgeZip = await open3(jarPath, { lazyEntries: true, autoClose: false });
    const versionId = await installLegacyForgeFromUniversalZip(
      forgeZip,
      mc,
      forgeVersion,
      version.mcversion
    );
    return versionId;
  }
  const zip = await open3(jarPath, { lazyEntries: true, autoClose: false });
  const entries = await walkForgeInstallerEntries(zip, forgeVersion);
  if (!entries.installProfileJson) {
    throw new BadForgeInstallerJarError(jarPath, "install_profile.json");
  }
  const profile = await readEntry2(zip, entries.installProfileJson).then((b) => b.toString()).then(JSON.parse);
  if (isForgeInstallerEntries(entries)) {
    const versionId = await unpackForgeInstaller(zip, entries, profile, mc, jarPath, options);
    await installByProfile(profile, minecraft, options);
    return versionId;
  } else if (isLegacyForgeInstallerEntries(entries)) {
    return installLegacyForgeFromZip(zip, entries, profile, mc, jarPath, options);
  } else {
    throw new BadForgeInstallerJarError(jarPath);
  }
}

// installer.ts
import {
  getResolvedVersionHeader,
  MinecraftFolder as MinecraftFolder7
} from "@xmcl/core";
import { readFile as readFile3 } from "fs/promises";
import { join as join6 } from "path";

// minecraft.ts
import {
  isBadVersionJsonError,
  isCorruptedVersionJsonError,
  isMissingVersionJsonError,
  MinecraftFolder as MinecraftFolder6,
  Version as VersionJson3
} from "@xmcl/core";
import { download as download3, getDownloadBaseOptions as getDownloadBaseOptions4 } from "@xmcl/file-transfer";
import { unlink, writeFile as writeFile5 } from "fs/promises";
import { join as join5, relative as relative3, sep as sep3 } from "path";

// minecraft.browser.ts
var DEFAULT_VERSION_MANIFEST_URL = "https://launchermeta.mojang.com/mc/game/version_manifest.json";
async function getVersionList(options = {}) {
  const response = await doFetch(options, options.remote ?? DEFAULT_VERSION_MANIFEST_URL);
  return await response.json();
}

// minecraft.ts
async function installMinecraftJar(version, options = {}) {
  const folder = MinecraftFolder6.from(version.minecraftDirectory);
  const side = options.side ?? "client";
  if (version.downloads[side]) {
    const jarDestination = folder.getVersionJar(version.minecraftVersion, side);
    const downloadInfo = version.downloads[side];
    const jarUrls = resolveDownloadUrls(downloadInfo.url, version, options[side]);
    await diagnoseFile(
      {
        file: jarDestination,
        expectedChecksum: downloadInfo.sha1,
        role: "minecraftJar",
        hint: "Problem on minecraft jar! Please consider to use Installer.installVersion to fix."
      },
      { signal: options.signal, checksum: options.checksum }
    ).then((issue) => {
      if (!issue) {
        return;
      }
      if (options.diagnose) {
        throw new InstallError({
          jar: version.id
        });
      }
      return download3({
        url: jarUrls,
        destination: jarDestination,
        ...getDownloadBaseOptions4(options),
        tracker: onDownloadSingle(options.tracker, "version.jar", {
          id: version.id,
          side,
          size: downloadInfo.size,
          sha1: downloadInfo.sha1
        }),
        expectedTotal: downloadInfo.size,
        signal: options.signal
      }).then(async () => {
        const post = await diagnoseFile(
          {
            file: jarDestination,
            expectedChecksum: downloadInfo.sha1,
            role: "minecraftJar",
            hint: "Minecraft jar is corrupt after download. It will be redownloaded."
          },
          { signal: options.signal, checksum: options.checksum }
        );
        if (post) {
          await unlink(jarDestination).catch(() => {
          });
          throw new InstallError({ jar: version.id });
        }
      });
    });
  }
}
async function installMinecraft(versionMeta, minecraft, options = {}) {
  const folder = MinecraftFolder6.from(minecraft);
  const version = await VersionJson3.parse(folder, versionMeta.id).catch(async (e) => {
    if (options.diagnose) {
      throw e;
    }
    if (!isBadVersionJsonError(e) && !isCorruptedVersionJsonError(e) && !isMissingVersionJsonError(e)) {
      throw e;
    }
    const jsonDestination = folder.getVersionJson(versionMeta.id);
    const jsonUrls = resolveDownloadUrls(versionMeta.url, versionMeta, options.json);
    await download3({
      url: jsonUrls,
      destination: jsonDestination,
      ...getDownloadBaseOptions4(options),
      tracker: onDownloadSingle(options.tracker, "version.json", {
        id: versionMeta.id,
        url: versionMeta.url
      }),
      signal: options.signal
    });
    return VersionJson3.parse(folder, versionMeta.id);
  });
  const side = options.side ?? "client";
  if (options.installJar !== false) {
    await installMinecraftJar(version, options);
  }
  if (side === "server") {
    const jarPath = folder.getVersionJar(versionMeta.id, "server");
    const server = {
      id: versionMeta.id,
      type: "release",
      time: version.time,
      releaseTime: version.releaseTime,
      jar: relative3(folder.libraries, jarPath).replaceAll(sep3, "/"),
      arguments: {
        game: [],
        jvm: []
      },
      mainClass: "",
      minimumLauncherVersion: 13,
      libraries: []
    };
    await writeFile5(
      join5(folder.getVersionRoot(versionMeta.id), "server.json"),
      JSON.stringify(server, null, 2)
    );
  }
  return version;
}

// installer.ts
async function readProfile(versionDir) {
  const installProfilePath = join6(versionDir, "install_profile.json");
  try {
    const installProfile = JSON.parse(await readFile3(installProfilePath, "utf8"));
    return installProfile;
  } catch {
    return void 0;
  }
}
async function completeInstallation(version, options = {}) {
  let issue = {};
  await installMinecraftJar(version, { ...options, tracker: options.tracker }).catch((e) => {
    if (options.diagnose && isInstallError(e)) {
      mergeInstallIssue(issue, e.issue);
      return;
    }
    throw e;
  });
  const folder = MinecraftFolder7.from(version.minecraftDirectory);
  const versionDir = folder.getVersionRoot(version.id);
  const profile = await readProfile(versionDir);
  if (profile) {
    const issue2 = await diagnoseProfile(profile, folder, options.side);
    if (issue2) {
      if (options.diagnose) {
        throw new InstallError({
          profile
        });
      }
      await installByProfile(profile, folder, { ...options, tracker: options.tracker });
    }
  }
  await installLibraries(version, { ...options, tracker: options.tracker }).catch((e) => {
    if (options.diagnose && isInstallError(e)) {
      mergeInstallIssue(issue, e.issue);
      return;
    }
    throw e;
  });
  await installAssets(version, { ...options, tracker: options.tracker }).catch((e) => {
    if (options.diagnose && isInstallError(e)) {
      mergeInstallIssue(issue, e.issue);
      return;
    }
    throw e;
  });
  if (options.diagnose && Object.keys(issue).length > 0) {
    if (issue.libraries && issue.libraries.length > 0) {
      const optifines = [];
      const forges = [];
      const others = [];
      for (const l of issue.libraries) {
        if (l.groupId === "optifine") {
          optifines.push(l);
        } else if (l.groupId === "net.minecraftforge" && l.artifactId === "forge" && (l.classifier === "client" || !l.classifier)) {
          forges.push(l);
        } else {
          others.push(l);
        }
      }
      if (others.length > 0) {
        issue.libraries = others;
      }
      if (optifines.length > 0) {
        issue.optifine = optifines[0].version;
      }
      if (forges.length > 0) {
        const header = getResolvedVersionHeader(version);
        if (header.forge && header.minecraft) {
          issue.forge = {
            minecraft: header.minecraft,
            version: header.forge
          };
        }
      }
    }
    throw new InstallError(issue);
  }
}
async function completeInstallationByError(version, error, options = {}) {
  const issue = error.issue;
  const folder = MinecraftFolder7.from(version.minecraftDirectory);
  if (issue.jar) {
    await installMinecraftJar(version, { ...options, tracker: options.tracker });
  }
  if (issue.forge) {
    await installForge(
      {
        mcversion: issue.forge.minecraft,
        version: issue.forge.version
      },
      folder,
      { ...options, tracker: options.tracker }
    );
  } else if (issue.profile) {
    await installByProfile(issue.profile, folder, { ...options, tracker: options.tracker });
  }
  if (issue.libraries && issue.libraries.length > 0) {
    await installResolvedLibraries(issue.libraries, folder, {
      ...options,
      tracker: options.tracker
    });
  }
  if (issue.assetsIndex) {
    await installAssets(version, { ...options, tracker: options.tracker });
  } else if (issue.assets && issue.assets.length > 0) {
    await installResolvedAssets(issue.assets, folder, version.id, options);
  }
}

// java.ts
import { exec } from "child_process";
import { stat as stat5 } from "fs/promises";
import { EOL, platform } from "os";
import { join as join7 } from "path";
async function resolveJava(path) {
  return (await resolveJavaWithDiagnostic(path)).java;
}
async function resolveJavaWithDiagnostic(path) {
  if (await missing(path)) {
    return { stdout: "", stderr: "" };
  }
  return new Promise((resolve) => {
    exec(`"${path}" -version`, (error, stdout, stderr) => {
      const ver = parseJavaVersionOutput(stdout, stderr);
      resolve({
        java: ver ? { path, ...ver } : void 0,
        exitCode: typeof (error == null ? void 0 : error.code) === "number" ? error.code : void 0,
        signal: (error == null ? void 0 : error.signal) ?? void 0,
        stdout,
        stderr
      });
    });
  });
}
function parseJavaVersionOutput(stdout, stderr) {
  return parseJavaVersion(stderr) ?? parseJavaVersion(stdout);
}
var ParseJavaVersionError = class extends Error {
  name = "ParseJavaVersionError";
  constructor(message) {
    super(message);
  }
};
function parseJavaVersion(versionText) {
  const getVersion = (str) => {
    var _a;
    if (!str) {
      return void 0;
    }
    const match = /(\d+)\.(\d)+\.(\d+)(_\d+)?/.exec(str);
    if (match === null) {
      const majorOnlyMatch = /(?:openjdk|java)(?:[ _]version)?[ =]"?(\d+)"?/i.exec(str);
      if (majorOnlyMatch) {
        return {
          version: majorOnlyMatch[1],
          majorVersion: Number.parseInt(majorOnlyMatch[1]),
          patch: -1
        };
      }
      return void 0;
    }
    if (match[1] === "1") {
      return {
        version: match[0],
        majorVersion: Number.parseInt(match[2]),
        patch: Number.parseInt(((_a = match[4]) == null ? void 0 : _a.substring(1)) ?? "-1")
      };
    }
    return {
      version: match[0],
      majorVersion: Number.parseInt(match[1]),
      patch: Number.parseInt(match[3])
    };
  };
  try {
    const javaVersion = getVersion(versionText);
    if (!javaVersion) {
      return void 0;
    }
    return javaVersion;
  } catch (e) {
    throw new ParseJavaVersionError(
      `Fail to parse java version [${versionText}]: ${e.message}`
    );
  }
}
async function getPotentialJavaLocations() {
  const unchecked = /* @__PURE__ */ new Set();
  const currentPlatform = platform();
  const javaFile = currentPlatform === "win32" ? "java.exe" : "java";
  if (process.env.JAVA_HOME) {
    unchecked.add(join7(process.env.JAVA_HOME, "bin", javaFile));
  }
  const which = () => new Promise((resolve) => {
    exec("which java", (_error, stdout) => {
      if (!_error) resolve(stdout.replace("\n", ""));
      else resolve("");
    }).once("error", () => resolve(""));
  });
  const where = () => new Promise((resolve) => {
    exec("where java", (_error, stdout) => {
      if (!_error) resolve(stdout.split("\r\n"));
      else resolve([]);
    }).once("error", () => resolve([]));
  });
  if (currentPlatform === "win32") {
    const out = await new Promise((resolve) => {
      exec(
        "REG QUERY HKEY_LOCAL_MACHINE\\Software\\JavaSoft\\ /s /v JavaHome",
        (_error, stdout) => {
          if (!stdout) {
            resolve([]);
          }
          resolve(
            stdout.split(EOL).map((item) => item.replace(/[\r\n]/g, "")).filter((item) => item !== null && item !== void 0).filter((item) => item[0] === " ").map((item) => `${item.split("    ")[3]}\\bin\\java.exe`)
          );
        }
      );
    });
    for (const o of [...out, ...await where()]) {
      unchecked.add(o);
    }
  } else if (currentPlatform === "darwin") {
    unchecked.add("/Library/Internet Plug-Ins/JavaAppletPlugin.plugin/Contents/Home/bin/java");
    unchecked.add(await which());
  } else {
    unchecked.add(await which());
  }
  const checkingList = Array.from(unchecked).filter((jPath) => typeof jPath === "string").filter((p) => p !== "");
  return checkingList;
}
async function dedupJreExecutables(files) {
  const inos = /* @__PURE__ */ new Set();
  const result = [];
  for (const file of files) {
    const fstat = await stat5(file).catch(() => ({ ino: -1 }));
    if (inos.has(fstat.ino)) {
      continue;
    }
    inos.add(fstat.ino);
    result.push(file);
  }
  return result;
}
async function scanLocalJava(locations) {
  const unchecked = new Set(locations);
  const potential = await getPotentialJavaLocations();
  potential.forEach((p) => unchecked.add(p));
  const checkingList = await dedupJreExecutables(
    [...unchecked].filter((jPath) => typeof jPath === "string").filter((p) => p !== "")
  );
  const javas = await Promise.all(checkingList.map((jPath) => resolveJava(jPath)));
  return javas.filter(((j) => j !== void 0));
}

// java-runtime.ts
import {
  download as download4,
  downloadMultiple as downloadMultiple3,
  getDownloadBaseOptions as getDownloadBaseOptions5
} from "@xmcl/file-transfer";
import { link as link2, readFile as readFile4 } from "fs/promises";
import { dirname as dirname4, join as join8 } from "path";

// java-runtime.browser.ts
import { getPlatform } from "@xmcl/core";
var JavaRuntimeTargetType = /* @__PURE__ */ ((JavaRuntimeTargetType2) => {
  JavaRuntimeTargetType2["Legacy"] = "jre-legacy";
  JavaRuntimeTargetType2["Alpha"] = "java-runtime-alpha";
  JavaRuntimeTargetType2["Beta"] = "java-runtime-beta";
  JavaRuntimeTargetType2["Delta"] = "java-runtime-delta";
  JavaRuntimeTargetType2["Gamma"] = "java-runtime-gamma";
  JavaRuntimeTargetType2["JavaExe"] = "minecraft-java-exe";
  return JavaRuntimeTargetType2;
})(JavaRuntimeTargetType || {});
var DEFAULT_RUNTIME_ALL_URL = "https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json";
function normalizeUrls(url, fileHost) {
  if (!fileHost) {
    return [url];
  }
  if (typeof fileHost === "string") {
    const u = new URL(url);
    u.hostname = fileHost;
    const result2 = u.toString();
    if (result2 !== url) {
      return [result2, url];
    }
    return [result2];
  }
  const result = fileHost.map((host) => {
    const u = new URL(url);
    u.hostname = host;
    return u.toString();
  });
  if (result.indexOf(url) === -1) {
    result.push(url);
  }
  return result;
}
async function fetchJavaRuntimeManifest(options = {}) {
  let manifestIndex = options.manifestIndex;
  if (!manifestIndex) {
    const response = await doFetch(
      options,
      normalizeUrls(options.url ?? DEFAULT_RUNTIME_ALL_URL, options.apiHost)[0]
    );
    manifestIndex = await response.json();
  }
  const manifest = manifestIndex;
  const platform2 = options.platform ?? getPlatform();
  const runtimeTarget = options.target ?? "java-runtime-beta" /* Beta */;
  const resolveTarget = () => {
    if (platform2.name === "windows") {
      if (platform2.arch === "x64") {
        return manifest["windows-x64"];
      }
      if (platform2.arch === "x86" || platform2.arch === "x32") {
        return manifest["windows-x86"];
      }
      if (platform2.arch === "arm64") {
        return manifest["windows-arm64"];
      }
      return manifest["windows-x64"];
    }
    if (platform2.name === "osx") {
      if (platform2.arch === "arm64") {
        return manifest["mac-os-arm64"];
      }
      return manifest["mac-os"];
    }
    if (platform2.name === "linux") {
      if (platform2.arch === "x86" || platform2.arch === "x32") {
        return manifest["linux-i386"];
      }
      if (platform2.arch === "x64") {
        return manifest.linux;
      }
      return manifest.linux;
    }
    throw new Error("Cannot resolve platform");
  };
  const targets = resolveTarget()[runtimeTarget];
  if (targets && targets.length > 0) {
    const target = targets[0];
    const manifestUrl = normalizeUrls(target.manifest.url, options.apiHost)[0];
    const response = await doFetch(options, manifestUrl);
    const manifest2 = await response.json();
    const result = {
      files: manifest2.files,
      target: runtimeTarget,
      version: target.version
    };
    return result;
  } else {
    throw new Error();
  }
}

// java-runtime.ts
function normalizeUrls2(url, fileHost) {
  if (!fileHost) {
    return [url];
  }
  if (typeof fileHost === "string") {
    const u = new URL(url);
    u.hostname = fileHost;
    const result2 = u.toString();
    if (result2 !== url) {
      return [result2, url];
    }
    return [result2];
  }
  const result = fileHost.map((host) => {
    const u = new URL(url);
    u.hostname = host;
    return u.toString();
  });
  if (result.indexOf(url) === -1) {
    result.push(url);
  }
  return result;
}
async function downloadFiles(destination, options, manifest) {
  const unpackLzma = options.unpackLzma;
  const fileEntries = Object.entries(manifest.files).filter(
    ([file, entry]) => entry.type === "file"
  );
  const diagnoseResults = await Promise.all(
    fileEntries.map(async ([file, entry]) => {
      const fEntry = entry;
      const useLzma = unpackLzma && fEntry.downloads.lzma;
      const rawDest = join8(destination, file);
      let needsDownload = false;
      let downloadInfo = fEntry.downloads.raw;
      let dest = rawDest;
      let urls = normalizeUrls2(downloadInfo.url, options.apiHost);
      let hash = downloadInfo.sha1;
      let needsUnpack = false;
      if (useLzma) {
        const rawIssue = await diagnoseFile(
          {
            file: rawDest,
            expectedChecksum: fEntry.downloads.raw.sha1,
            role: "java-runtime-file",
            hint: `Problem on java runtime file ${file}! Please consider to reinstall the java runtime.`
          },
          { signal: options.signal, checksum: options.checksum }
        );
        if (!rawIssue) {
          needsDownload = false;
        } else {
          downloadInfo = fEntry.downloads.lzma;
          dest = rawDest + ".lzma";
          urls = normalizeUrls2(downloadInfo.url, options.apiHost);
          hash = downloadInfo.sha1;
          needsUnpack = true;
          const lzmaIssue = await diagnoseFile(
            {
              file: dest,
              expectedChecksum: hash,
              role: "java-runtime-file",
              hint: `Problem on java runtime file ${file}! Please consider to reinstall the java runtime.`
            },
            { signal: options.signal, checksum: options.checksum }
          );
          needsDownload = !!lzmaIssue;
        }
        return {
          file,
          dest,
          rawDest,
          urls,
          hash,
          needsDownload,
          needsUnpack,
          issue: needsDownload ? { type: "missing", file: dest } : void 0
        };
      } else {
        const issue = await diagnoseFile(
          {
            file: dest,
            expectedChecksum: hash,
            role: "java-runtime-file",
            hint: `Problem on java runtime file ${file}! Please consider to reinstall the java runtime.`
          },
          { signal: options.signal, checksum: options.checksum }
        );
        return {
          file,
          dest,
          rawDest,
          urls,
          hash,
          needsDownload: !!issue,
          needsUnpack: false,
          issue
        };
      }
    })
  );
  const issues = diagnoseResults.filter((r) => r.issue);
  if (issues.length > 0 && options.diagnose) {
    const errors = issues.map((r) => {
      const issue = r.issue;
      const receivedChecksum = issue.type === "corrupted" ? issue.receivedChecksum : "missing";
      return `${r.file} is ${issue.type}: expected checksum ${r.hash}, got ${receivedChecksum}`;
    });
    throw new Error(`Java runtime files validation failed:
${errors.join("\n")}`);
  }
  const filesToDownload = diagnoseResults.filter((r) => r.needsDownload).map((r) => ({
    url: r.urls,
    destination: r.dest
  }));
  if (filesToDownload.length > 0) {
    await downloadMultiple3({
      options: filesToDownload,
      tracker: onDownloadMultiple(options.tracker, "java-runtime.file", { path: destination }),
      ...getDownloadBaseOptions5(options)
    });
  }
  if (unpackLzma) {
    await Promise.all(
      diagnoseResults.filter((r) => r.needsUnpack && r.needsDownload).map((r) => unpackLzma(r.dest, r.rawDest))
    );
  }
  await Promise.all(
    Object.entries(manifest.files).filter(([file, entry]) => entry.type !== "file").map(async ([file, entry]) => {
      const dest = join8(destination, file);
      if (entry.type === "directory") {
        await ensureDir(dest);
      } else if (entry.type === "link") {
        await link2(dest, join8(dirname4(dest), entry.target)).catch(() => {
        });
      }
    })
  );
}
async function installJavaRuntime(options) {
  const destination = options.destination;
  const manifest = options.manifest;
  await downloadFiles(destination, options, manifest);
}
async function installJavaRuntimeWithJson(options) {
  const destination = options.destination;
  const target = options.target;
  const jsonPath = join8(destination, "manifest.json");
  const readManifest = async () => {
    const content = await readFile4(jsonPath);
    return JSON.parse(content.toString());
  };
  const manifestIssue = await diagnoseFile(
    {
      file: jsonPath,
      expectedChecksum: target.manifest.sha1,
      role: "java-runtime-manifest",
      hint: "Problem on java runtime manifest.json! Please consider to reinstall the java runtime."
    },
    { signal: options.signal, checksum: options.checksum }
  );
  if (manifestIssue) {
    if (options.diagnose) {
      throw new Error(
        `Java runtime manifest is ${manifestIssue.type}: expected checksum ${target.manifest.sha1}, got ${manifestIssue.receivedChecksum}`
      );
    }
    const downloadOptions = getDownloadBaseOptions5(options);
    const manifestUrl = normalizeUrls2(target.manifest.url, options.apiHost);
    await download4({
      destination: jsonPath,
      url: manifestUrl,
      ...downloadOptions,
      tracker: onDownloadSingle(options.tracker, "java-runtime.json", {
        target: target.version.name
      })
    });
  }
  const manifest = await readManifest();
  await downloadFiles(destination, options, manifest);
}

// labymod.ts
import { LibraryInfo as LibraryInfo3, MinecraftFolder as MinecraftFolder8 } from "@xmcl/core";
import {
  download as download5,
  downloadMultiple as downloadMultiple4,
  getDownloadBaseOptions as getDownloadBaseOptions6
} from "@xmcl/file-transfer";
import { writeFile as writeFile6 } from "fs/promises";
import { dirname as dirname5, join as join9 } from "path";

// labymod.browser.ts
async function getLabyModManifest(env = "production", options) {
  const url = `https://laby-releases.s3.de.io.cloud.ovh.net/api/v1/manifest/${env}/latest.json`;
  const res = await doFetch(options, url);
  return await res.json();
}
async function getLabyModAddonIndex(env = "production", options) {
  const url = `https://flintmc.net/api/client-store/get-index/${env}`;
  const res = await doFetch(options, url);
  return await res.json();
}
async function getLabyModAddon(namespace, env = "production", options) {
  const url = `https://flintmc.net/api/client-store/get-modification/${namespace}/${env}`;
  const res = await doFetch(options, url);
  return await res.json();
}

// labymod.ts
async function createLabyModJson(manifest, tag, folder, environment, options) {
  const librariesUrl = `https://laby-releases.s3.de.io.cloud.ovh.net/api/v1/libraries/${environment}.json`;
  const versionInfo = manifest.minecraftVersions.find((v) => v.tag === tag);
  if (!versionInfo) {
    throw Object.assign(new Error(`Cannot find version info for ${tag}`), {
      name: "VersionInfoNotFoundError"
    });
  }
  const metadataResponse = await doFetch(options, librariesUrl);
  if (!metadataResponse.ok) {
    throw Object.assign(
      new Error(
        `Failed to fetch libraries metadata: ${metadataResponse.statusText}: ${await metadataResponse.text()}`
      ),
      {
        name: "FetchLabyModMetadataError"
      }
    );
  }
  const libraries = await metadataResponse.json().then((res) => res.libraries).then(
    (libs) => libs.filter((lib) => lib.minecraftVersion === "all" || lib.minecraftVersion === tag)
  );
  const versionJsonResponse = await doFetch(options, versionInfo.customManifestUrl);
  if (!versionJsonResponse.ok) {
    throw Object.assign(
      new Error(
        `Failed to fetch version json: ${versionJsonResponse.statusText}: ${await versionJsonResponse.text()}`
      ),
      {
        name: "FetchLabyModVersionJsonError"
      }
    );
  }
  const versionJson = await versionJsonResponse.json();
  versionJson.libraries.push(
    ...libraries.map((l) => ({
      name: l.name,
      downloads: {
        artifact: {
          path: LibraryInfo3.resolve(l.name).path,
          sha1: l.sha1,
          size: l.size,
          url: l.url
        }
      }
    })),
    {
      name: `net.labymod:LabyMod:${manifest.labyModVersion}`,
      downloads: {
        artifact: {
          path: `net/labymod/LabyMod/${manifest.labyModVersion}/LabyMod-${manifest.labyModVersion}.jar`,
          sha1: manifest.sha1,
          size: manifest.size,
          url: `https://laby-releases.s3.de.io.cloud.ovh.net/api/v1/download/labymod4/${environment}/${manifest.commitReference}.jar`
        }
      }
    }
  );
  versionJson.id = `${tag}-LabyMod-4-${manifest.commitReference}`;
  if (!versionJson.inheritFrom) {
    versionJson.inheritFrom = versionJson._minecraftVersion || tag;
  }
  const versionPath = folder.getPath("versions", versionJson.id, `${versionJson.id}.json`);
  await ensureDir(dirname5(versionPath));
  await writeFile6(versionPath, JSON.stringify(versionJson, null, 4));
  return versionJson.id;
}
async function installLabyMod4(manifest, tag, minecraft, options = {}) {
  const folder = MinecraftFolder8.from(minecraft);
  const environment = (options == null ? void 0 : options.environment) ?? "production";
  const versionId = await createLabyModJson(manifest, tag, folder, environment, options);
  const assetEntries = Object.entries(manifest.assets);
  const diagnoseResults = await Promise.all(
    assetEntries.map(async ([name, hash]) => {
      const destination = folder.getPath("labymod-neo", "assets", `${name}.jar`);
      const url = `https://laby-releases.s3.de.io.cloud.ovh.net/api/v1/download/assets/labymod4/${environment}/${manifest.commitReference}/${name}/${hash}.jar`;
      const issue = await diagnoseFile(
        {
          file: destination,
          expectedChecksum: "",
          // LabyMod doesn't provide checksums for assets
          role: "labymod-asset",
          hint: "Problem on labymod asset! Please consider to reinstall labymod."
        },
        { signal: options.signal, checksum: options.checksum }
      );
      return {
        name,
        hash,
        url,
        destination,
        needsDownload: !!issue
      };
    })
  );
  const assetsToDownload = diagnoseResults.filter((r) => r.needsDownload);
  if (assetsToDownload.length > 0) {
    await downloadMultiple4({
      options: assetsToDownload.map((r) => ({
        url: r.url,
        destination: r.destination
      })),
      ...getDownloadBaseOptions6(options),
      tracker: onDownloadMultiple(options.tracker, "labymod.assets", {
        count: assetsToDownload.length
      }),
      signal: options.signal
    });
  }
  return versionId;
}
async function installLabyModAddonImpl(addon, minecraft, options) {
  const folder = MinecraftFolder8.from(minecraft);
  const environment = (options == null ? void 0 : options.environment) ?? "production";
  const installDependencies = (options == null ? void 0 : options.installDependencies) ?? true;
  if (installDependencies && addon.dependencies && addon.dependencies.length > 0) {
    for (const dep of addon.dependencies) {
      if (!dep.optional) {
        const depAddon = await getLabyModAddon(dep.namespace, environment, options);
        await installLabyModAddonImpl(depAddon, minecraft, {
          ...options,
          installDependencies: true
        });
      }
    }
  }
  const url = `https://flintmc.net/api/client-store/fetch-jar-by-hash/${addon.file_hash}`;
  const destination = join9(folder.getPath("labymod-neo", "addons"), `${addon.namespace}.jar`);
  const issue = await diagnoseFile(
    {
      file: destination,
      expectedChecksum: addon.file_hash,
      role: "labymod-addon",
      hint: "Problem on labymod addon! Please consider to reinstall."
    },
    { signal: options == null ? void 0 : options.signal, checksum: options == null ? void 0 : options.checksum }
  );
  if (issue) {
    await download5({
      url,
      destination,
      ...getDownloadBaseOptions6(options),
      tracker: onDownloadSingle(options == null ? void 0 : options.tracker, "labymod.addon", {
        namespace: addon.namespace,
        name: addon.name
      })
    });
  }
  return destination;
}
async function installLabyModAddon(namespace, minecraft, options) {
  const environment = (options == null ? void 0 : options.environment) ?? "production";
  const addon = await getLabyModAddon(namespace, environment, options);
  return installLabyModAddonImpl(addon, minecraft, options);
}
function installLabyModFabricAddon(minecraft, options) {
  return installLabyModAddon("labyfabric", minecraft, options);
}
function installLabyModForgeAddon(minecraft, options) {
  return installLabyModAddon("labyforge", minecraft, options);
}
function isLabyModAddonCompatible(addon, minecraftVersion) {
  const versionString = addon.version_string;
  if (!versionString || versionString === "*") {
    return true;
  }
  const ranges = versionString.split(",");
  for (const range of ranges) {
    if (range.includes("<")) {
      const [min, max] = range.split("<");
      if (compareVersions(minecraftVersion, min.trim()) >= 0 && compareVersions(minecraftVersion, max.trim()) <= 0) {
        return true;
      }
    } else {
      if (range.trim() === minecraftVersion) {
        return true;
      }
    }
  }
  return false;
}
function compareVersions(a, b) {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);
  const maxLength = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLength; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA !== numB) {
      return numA - numB;
    }
  }
  return 0;
}

// neoforge.ts
import { MinecraftFolder as MinecraftFolder9, Version as VersionJson4 } from "@xmcl/core";
import { download as download6, getDownloadBaseOptions as getDownloadBaseOptions7 } from "@xmcl/file-transfer";
import { open as open4, readEntry as readEntry3 } from "@xmcl/unzip";
import { unlink as unlink2 } from "fs/promises";
async function fetchMavenSha1(options, url) {
  var _a;
  try {
    const response = await doFetch(options, `${url}.sha1`);
    if (!response.ok) return "";
    const text = (await response.text()).trim();
    const digest = ((_a = text.split(/\s+/)[0]) == null ? void 0 : _a.toLowerCase()) ?? "";
    return /^[a-f0-9]{40}$/.test(digest) ? digest : "";
  } catch {
    return "";
  }
}
async function downloadNeoForgedInstaller(project, version, minecraft, options) {
  const url = `https://maven.neoforged.net/releases/net/neoforged/${project}/${version}/${project}-${version}-installer.jar`;
  const expectedSha1 = await fetchMavenSha1(options, url);
  const library = VersionJson4.resolveLibrary({
    name: `net.neoforged:${project}:${version}:installer`,
    downloads: {
      artifact: {
        url,
        path: `net/neoforged/${project}/${version}/${project}-${version}-installer.jar`,
        size: -1,
        sha1: expectedSha1
      }
    }
  });
  const mavenHost = options.mavenHost ? normalizeArray(options.mavenHost) : [];
  const urls = resolveLibraryDownloadUrls(library, { ...options, mavenHost });
  const installJarPath = minecraft.getLibraryByPath(library.path);
  const doDownload = () => download6({
    url: urls,
    destination: installJarPath,
    ...getDownloadBaseOptions7(options),
    tracker: onDownloadSingle(options.tracker, "forge.installer", { version, path: url }),
    signal: options.signal
  });
  if (!expectedSha1) {
    await doDownload();
    return installJarPath;
  }
  const checksumFn = options.checksum ?? checksum;
  let actualSha1 = await checksumFn(installJarPath, "sha1").catch(() => "");
  for (let attempt = 0; attempt < 3 && actualSha1 !== expectedSha1; attempt++) {
    await unlink2(installJarPath).catch(() => {
    });
    await doDownload();
    actualSha1 = await checksumFn(installJarPath, "sha1").catch(() => "");
  }
  if (actualSha1 !== expectedSha1) {
    await unlink2(installJarPath).catch(() => {
    });
    throw new BadForgeInstallerJarError(installJarPath);
  }
  return installJarPath;
}
async function installNeoForge(project, version, minecraft, options = {}) {
  const [_, forgeVersion = version] = version.split("-");
  const mc = MinecraftFolder9.from(minecraft);
  const jarPath = await downloadNeoForgedInstaller(project, version, mc, options);
  const zip = await open4(jarPath, { lazyEntries: true, autoClose: false });
  const entries = await walkForgeInstallerEntries(zip, forgeVersion);
  if (!entries.installProfileJson) {
    throw new BadForgeInstallerJarError(jarPath, "install_profile.json");
  }
  const profile = await readEntry3(zip, entries.installProfileJson).then((b) => b.toString()).then(JSON.parse);
  if (isForgeInstallerEntries(entries)) {
    const versionId = await unpackForgeInstaller(zip, entries, profile, mc, jarPath, options);
    await installByProfile(profile, minecraft, options);
    return versionId;
  } else {
    throw new BadForgeInstallerJarError(jarPath);
  }
}

// optifine.ts
import { ClassReader, ClassVisitor, Opcodes } from "@xmcl/asm";
import { MinecraftFolder as MinecraftFolder10 } from "@xmcl/core";
import { getEntriesRecord, open as open5, readAllEntries as readAllEntries3, readEntry as readEntry4 } from "@xmcl/unzip";
import { writeFile as writeFile7 } from "fs/promises";
function generateOptifineVersion(editionRelease, minecraftVersion, launchWrapperVersion, options = {}) {
  const id = options.versionId ?? `${minecraftVersion}-Optifine_${editionRelease}`;
  const inheritsFrom = options.inheritsFrom ?? minecraftVersion;
  const mainClass = "net.minecraft.launchwrapper.Launch";
  const libraries = [{ name: `optifine:Optifine:${minecraftVersion}_${editionRelease}` }];
  if (launchWrapperVersion) {
    libraries.unshift({ name: `optifine:launchwrapper-of:${launchWrapperVersion}` });
  } else {
    libraries.unshift({ name: "net.minecraft:launchwrapper:1.12" });
  }
  return {
    id,
    inheritsFrom,
    arguments: {
      game: [
        "--tweakClass",
        options.useForgeTweaker ? "optifine.OptiFineForgeTweaker" : "optifine.OptiFineTweaker"
      ],
      jvm: []
    },
    releaseTime: (/* @__PURE__ */ new Date()).toJSON(),
    time: (/* @__PURE__ */ new Date()).toJSON(),
    type: "release",
    libraries,
    mainClass,
    minimumLauncherVersion: 21
  };
}
async function installOptifine(installer, minecraft, options = {}) {
  var _a, _b, _c, _d;
  (_a = options.signal) == null ? void 0 : _a.throwIfAborted();
  const mc = MinecraftFolder10.from(minecraft);
  const zip = await open5(installer);
  const entries = await readAllEntries3(zip);
  const record = getEntriesRecord(entries);
  const entry = record["net/optifine/Config.class"] ?? record["Config.class"] ?? record["notch/net/optifine/Config.class"];
  if (!entry) {
    throw new BadOptifineJarError(installer, "net/optifine/Config.class");
  }
  const launchWrapperVersionEntry = record["launchwrapper-of.txt"];
  const launchWrapperVersion = launchWrapperVersionEntry ? await readEntry4(zip, launchWrapperVersionEntry).then((b) => b.toString()) : void 0;
  const buf = await readEntry4(zip, entry);
  const reader = new ClassReader(buf);
  class OptifineVisitor extends ClassVisitor {
    fields = {};
    visitField(access3, name, desc, signature, value) {
      this.fields[name] = value;
      return null;
    }
  }
  const visitor = new OptifineVisitor(Opcodes.ASM5);
  reader.accept(visitor);
  const mcversion = visitor.fields.MC_VERSION;
  const edition = visitor.fields.OF_EDITION;
  const release = visitor.fields.OF_RELEASE;
  const editionRelease = edition + "_" + release;
  const versionJSON = generateOptifineVersion(
    editionRelease,
    mcversion,
    launchWrapperVersion,
    options
  );
  const versionJSONPath = mc.getVersionJson(versionJSON.id);
  const progress = onProgress(options.tracker, "optifine.unpack", {
    version: versionJSON.id,
    path: installer,
    minecraft: mcversion
  });
  progress.total = 3;
  (_b = options.signal) == null ? void 0 : _b.throwIfAborted();
  await ensureFile(versionJSONPath);
  await writeFile7(versionJSONPath, JSON.stringify(versionJSON, null, 4), {
    signal: options.signal
  });
  progress.progress = 1;
  const launchWrapperEntry = record[`launchwrapper-of-${launchWrapperVersion}.jar`];
  if (launchWrapperEntry) {
    (_c = options.signal) == null ? void 0 : _c.throwIfAborted();
    const wrapperDest = mc.getLibraryByPath(
      `optifine/launchwrapper-of/${launchWrapperVersion}/launchwrapper-of-${launchWrapperVersion}.jar`
    );
    await ensureFile(wrapperDest);
    await writeFile7(wrapperDest, await readEntry4(zip, launchWrapperEntry), {
      signal: options.signal
    });
    progress.progress = 2;
  }
  (_d = options.signal) == null ? void 0 : _d.throwIfAborted();
  const dest = mc.getLibraryByPath(
    `optifine/Optifine/${mcversion}_${editionRelease}/Optifine-${mcversion}_${editionRelease}.jar`
  );
  const mcJar = mc.getVersionJar(mcversion);
  await ensureFile(dest);
  await spawnProcess(options, ["-cp", installer, "optifine.Patcher", mcJar, installer, dest], {
    signal: options.signal
  }).catch((e) => {
    e.name = "OptifinePatchError";
    throw e;
  });
  progress.progress = progress.total;
  return versionJSON.id;
}
var BadOptifineJarError = class extends Error {
  constructor(optifine, entry) {
    super(`Missing entry ${entry} in optifine installer: ${optifine}`);
    this.optifine = optifine;
    this.entry = entry;
  }
  optifine;
  entry;
  error = "BadOptifineJarError";
};

// quilt.ts
import { MinecraftFolder as MinecraftFolder11 } from "@xmcl/core";
import { writeFile as writeFile8 } from "fs/promises";

// quilt.browser.ts
var DEFAULT_META_URL_QUILT = "https://meta.quiltmc.org";
async function getQuiltGames(options) {
  const response = await doFetch(options, `${DEFAULT_META_URL_QUILT}/v3/game`);
  const body = await response.json();
  return body.map((g) => g.version);
}
async function getQuiltLoaders(options) {
  const response = await doFetch(options, `${DEFAULT_META_URL_QUILT}/v3/versions/loader`);
  const body = response.json();
  return body;
}
async function getQuiltLoaderVersionsByMinecraft(options) {
  const response = await doFetch(
    options,
    `${DEFAULT_META_URL_QUILT}/v3/versions/loader/${options.minecraftVersion}`
  );
  const content = await response.json();
  return content;
}

// quilt.ts
async function installQuiltVersion(options) {
  const side = options.side ?? "client";
  const url = side === "client" ? `${DEFAULT_META_URL_QUILT}/v3/versions/loader/${options.minecraftVersion}/${options.version}/profile/json` : `${DEFAULT_META_URL_QUILT}/v3/versions/loader/${options.minecraftVersion}/${options.version}/server/json`;
  const response = await doFetch(options, url);
  const content = await response.json();
  const minecraft = MinecraftFolder11.from(options.minecraft);
  if (options.inheritsFrom) {
    content.inheritsFrom = options.inheritsFrom;
    content.id = options.versionId || `${options.inheritsFrom}-quilt${options.version}`;
  } else {
    content.id = options.versionId || `${options.minecraftVersion}-quilt${options.version}`;
  }
  const jsonPath = side === "client" ? minecraft.getVersionJson(content.id) : minecraft.getVersionServerJson(content.id);
  await ensureFile(jsonPath);
  await writeFile8(jsonPath, JSON.stringify(content));
  return content.id;
}

// zulu.ts
var import_tar_stream = __toESM(require_tar_stream());
import { download as download7, getDownloadBaseOptions as getDownloadBaseOptions8 } from "@xmcl/file-transfer";
import { open as open6, openEntryReadStream as openEntryReadStream2, readAllEntries as readAllEntries4 } from "@xmcl/unzip";
import { createReadStream, createWriteStream as createWriteStream2 } from "fs";
import { stat as stat6, symlink, unlink as unlink3 } from "fs/promises";
import { basename, dirname as dirname6, join as join10 } from "path";
import { pipeline as pipeline2 } from "stream/promises";
import { createGunzip } from "zlib";
async function installZuluJava(jre, options) {
  const { destination } = options;
  const packedFile = join10(destination, basename(jre.url));
  if (!jre.url.endsWith(".tar.gz") && !jre.url.endsWith(".zip")) {
    throw new Error(`Unsupported archive format: ${jre.url}`);
  }
  const downloadTracker = onDownloadSingle(options.tracker, "zulu-java.download", {
    url: jre.url,
    size: jre.size
  });
  await download7({
    url: jre.url,
    destination: packedFile,
    expectedTotal: jre.size,
    tracker: downloadTracker,
    ...getDownloadBaseOptions8(options),
    signal: options.abortSignal
  });
  try {
    if (jre.url.endsWith(".tar.gz")) {
      await extractTarGz(packedFile, destination, jre, options.tracker, options.abortSignal);
    } else if (jre.url.endsWith(".zip")) {
      await extractZip(packedFile, destination, jre, options.tracker, options.abortSignal);
    } else {
      throw new Error(`Unsupported archive format: ${jre.url}`);
    }
  } finally {
    try {
      await stat6(packedFile).then(() => unlink3(packedFile));
    } catch {
    }
  }
}
async function extractTarGz(packedFile, destination, jre, tracker, abortSignal) {
  if (abortSignal == null ? void 0 : abortSignal.aborted) {
    throw new Error("Extraction aborted");
  }
  const extractStream = (0, import_tar_stream.extract)();
  const allPipe = [
    pipeline2(createReadStream(packedFile), createGunzip(), extractStream)
  ];
  let first = "";
  let substring = 0;
  const links = [];
  const progress = onProgress(tracker, "zulu-java.extract", { url: jre.url });
  const abortHandler = () => {
    extractStream.destroy(new Error("Extraction aborted"));
    allPipe.forEach((p) => p.catch(() => {
    }));
  };
  abortSignal == null ? void 0 : abortSignal.addEventListener("abort", abortHandler);
  try {
    for await (const entry of extractStream) {
      if (abortSignal == null ? void 0 : abortSignal.aborted) {
        throw new Error("Extraction aborted");
      }
      if (!first) {
        first = entry.header.name;
        if (first.endsWith("/") && jre.url.endsWith(entry.header.name.substring(0, entry.header.name.length - 1) + ".tar.gz")) {
          substring = first.length;
          continue;
        }
      }
      const filePath = join10(destination, entry.header.name.substring(substring));
      const size = entry.header.size ?? 0;
      if (entry.header.type === "directory") {
        await ensureDir(filePath);
      } else if (entry.header.linkname && entry.header.type === "symlink") {
        links.push({
          path: join10(destination, entry.header.linkname),
          linkTo: filePath
        });
      } else if (entry.header.type === "file") {
        progress.total += size;
        await ensureDir(dirname6(filePath));
        const writeStream = createWriteStream2(filePath);
        const originalWrite = writeStream.write.bind(writeStream);
        writeStream.write = function(chunk, ...args) {
          progress.progress += chunk.length ?? 0;
          return originalWrite(chunk, ...args);
        };
        allPipe.push(pipeline2(entry, writeStream));
      }
    }
    for (const link3 of links) {
      if (abortSignal == null ? void 0 : abortSignal.aborted) {
        throw new Error("Extraction aborted");
      }
      try {
        await symlink(link3.path, link3.linkTo);
      } catch {
      }
    }
    await Promise.all(allPipe);
  } finally {
    abortSignal == null ? void 0 : abortSignal.removeEventListener("abort", abortHandler);
  }
}
async function extractZip(packedFile, destination, jre, tracker, abortSignal) {
  if (abortSignal == null ? void 0 : abortSignal.aborted) {
    throw new Error("Extraction aborted");
  }
  const zipFile = await open6(packedFile);
  const abortHandler = () => {
    zipFile.close();
  };
  abortSignal == null ? void 0 : abortSignal.addEventListener("abort", abortHandler);
  try {
    if (abortSignal == null ? void 0 : abortSignal.aborted) {
      throw new Error("Extraction aborted");
    }
    const prefix = basename(jre.url).slice(0, -4) + "/";
    const entries = await readAllEntries4(zipFile).then(
      (ens) => ens.filter((e) => e.fileName !== prefix && !e.fileName.endsWith("/"))
    );
    const promises = [];
    const trackerProgress = onProgress(tracker, "zulu-java.extract", { url: jre.url });
    for (const entry of entries) {
      abortSignal == null ? void 0 : abortSignal.throwIfAborted();
      const relativePath = entry.fileName.startsWith(prefix) ? entry.fileName.substring(prefix.length) : entry.fileName;
      const file = join10(destination, relativePath);
      trackerProgress.total += entry.uncompressedSize;
      const readStream = await openEntryReadStream2(zipFile, entry);
      await ensureFile(file);
      const writeStream = createWriteStream2(file);
      const originalWrite = writeStream.write.bind(writeStream);
      writeStream.write = function(chunk, ...args) {
        trackerProgress.progress += chunk.length ?? 0;
        onProgress(tracker, "zulu-java.extract", { url: jre.url });
        return originalWrite(chunk, ...args);
      };
      promises.push(pipeline2(readStream, writeStream));
    }
    await Promise.all(promises);
  } finally {
    abortSignal == null ? void 0 : abortSignal.removeEventListener("abort", abortHandler);
    zipFile.close();
  }
}
function detectLibc(platform2 = process.platform) {
  var _a;
  if (platform2 !== "linux") return "glibc";
  try {
    const report = typeof ((_a = process.report) == null ? void 0 : _a.getReport) === "function" ? process.report.getReport() : void 0;
    if (report) {
      if (report.header && report.header.glibcVersionRuntime) {
        return "glibc";
      }
      const shared = Array.isArray(report.sharedObjects) ? report.sharedObjects : [];
      if (shared.some((s) => /ld-musl-|libc\.musl-/.test(s))) {
        return "musl";
      }
      if (report.header && "glibcVersionRuntime" in report.header) {
        return "glibc";
      }
    }
  } catch {
  }
  return "glibc";
}
function selectZuluJRE(jres, platform2 = process.platform, arch = process.arch, libc = detectLibc(platform2)) {
  const normalizedPlatform = platform2 === "darwin" ? "darwin" : platform2 === "win32" ? "win32" : "linux";
  const normalizedArch = arch === "x64" ? "x64" : arch === "arm64" ? "arm64" : arch === "ia32" || arch === "x86" ? "ia32" : arch;
  const targets = jres.filter(
    (jre) => jre.os === normalizedPlatform && jre.architecture === normalizedArch
  );
  if (targets.length === 0) {
    return void 0;
  }
  let candidates = targets;
  if (normalizedPlatform === "linux") {
    const matching = targets.filter(
      (jre) => libc === "musl" ? jre.features.includes("musl") : !jre.features.includes("musl")
    );
    if (matching.length > 0) {
      candidates = matching;
    }
  } else {
    const nonMusl = targets.filter((jre) => !jre.features.includes("musl"));
    if (nonMusl.length > 0) {
      candidates = nonMusl;
    }
  }
  const withJavafx = candidates.find((jre) => jre.features.includes("javafx"));
  if (withJavafx) {
    return withJavafx;
  }
  return candidates[0];
}
export {
  BadForgeInstallerJarError,
  BadOptifineJarError,
  DEFAULT_FORGE_MAVEN,
  DEFAULT_META_URL_FABRIC,
  DEFAULT_META_URL_QUILT,
  DEFAULT_RESOURCE_ROOT_URL,
  DEFAULT_RUNTIME_ALL_URL,
  DEFAULT_VERSION_MANIFEST_URL,
  InstallError,
  JavaRuntimeTargetType,
  ParseJavaVersionError,
  PostProcessBadJarError,
  PostProcessFailedError,
  PostProcessNoMainClassError,
  PostProcessValidationFailedError,
  classpathEntryToLibraryName,
  completeInstallation,
  completeInstallationByError,
  detectLibc,
  diagnoseFile,
  diagnoseLibraries,
  diagnoseProcessorOutputs,
  diagnoseProfile,
  fetchJavaRuntimeManifest,
  generateOptifineVersion,
  getFabricGames,
  getFabricLoaderArtifact,
  getFabricLoaders,
  getForgeVersionList,
  getLabyModAddon,
  getLabyModAddonIndex,
  getLabyModManifest,
  getLoaderArtifactListFor,
  getPotentialJavaLocations,
  getQuiltGames,
  getQuiltLoaderVersionsByMinecraft,
  getQuiltLoaders,
  getVersionJsonFromLoaderArtifact,
  getVersionList,
  installAssets,
  installByProfile,
  installFabric,
  installFabricByLoaderArtifact,
  installForge,
  installJavaRuntime,
  installJavaRuntimeWithJson,
  installLabyMod4,
  installLabyModAddon,
  installLabyModFabricAddon,
  installLabyModForgeAddon,
  installLibraries,
  installMinecraft,
  installMinecraftJar,
  installNeoForge,
  installOptifine,
  installQuiltVersion,
  installResolvedAssets,
  installResolvedLibraries,
  installZuluJava,
  isForgeInstallerEntries,
  isInstallError,
  isLabyModAddonCompatible,
  isLegacyForgeInstallerEntries,
  mergeInstallIssue,
  onDownloadMultiple,
  onDownloadSingle,
  onProgress,
  onState,
  parseArgumentsFromArgsFile,
  parseJavaVersion,
  parseJavaVersionOutput,
  resolveJava,
  resolveJavaWithDiagnostic,
  resolveLibraryDownloadUrls,
  resolveProcessors,
  scanLocalJava,
  selectZuluJRE,
  unpackForgeInstaller,
  walkForgeInstallerEntries
};
//# sourceMappingURL=index.mjs.map
