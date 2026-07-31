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
  DefaultRangePolicy: () => DefaultRangePolicy,
  ManagedAbortError: () => ManagedAbortError,
  ProgressTrackerMultiple: () => ProgressTrackerMultiple,
  ProgressTrackerSingle: () => ProgressTrackerSingle,
  RangeNotSupportedError: () => RangeNotSupportedError,
  decorateError: () => decorateError,
  decorateHttpError: () => decorateHttpError,
  download: () => download,
  downloadMultiple: () => downloadMultiple,
  getDefaultAgent: () => getDefaultAgent,
  getDestinationExtension: () => getDestinationExtension,
  getDownloadBaseOptions: () => getDownloadBaseOptions,
  isManagedAbortError: () => isManagedAbortError,
  isRangeNotSupportedError: () => isRangeNotSupportedError,
  isRangePolicy: () => isRangePolicy,
  resolveRangePolicy: () => resolveRangePolicy
});
module.exports = __toCommonJS(index_exports);

// agent.ts
var import_undici = require("undici");
function getDefaultAgent(retry, defaultMaxRedirections = 5) {
  const options = {
    connections: 16
  };
  return new import_undici.Agent(options).compose(
    import_undici.interceptors.retry(
      retry || {
        errorCodes: [
          "UND_ERR_CONNECT_TIMEOUT",
          "UND_ERR_HEADERS_TIMEOUT",
          "UND_ERR_BODY_TIMEOUT",
          "ECONNRESET",
          "ECONNREFUSED",
          "ENOTFOUND",
          "ENETDOWN",
          "ETIMEDOUT",
          "ENETUNREACH",
          "EHOSTDOWN",
          "EHOSTUNREACH",
          "EPIPE",
          "UND_ERR_SOCKET"
        ],
        statusCodes: [567, 500, 502, 503, 504, 429],
        maxRetries: 3
      }
    ),
    import_undici.interceptors.redirect({ maxRedirections: defaultMaxRedirections })
  );
}

// controller.ts
var kManagedAbort = /* @__PURE__ */ Symbol("ManagedAbort");
var ManagedAbortError = class extends Error {
  [kManagedAbort] = true;
  reason;
  constructor(reason = "slow") {
    super(`Download connection aborted by controller (${reason})`);
    this.name = "ManagedAbortError";
    this.reason = reason;
  }
};
function isManagedAbortError(e) {
  return !!e && typeof e === "object" && e[kManagedAbort] === true;
}
var kRangeUnsupported = /* @__PURE__ */ Symbol("RangeNotSupported");
var RangeNotSupportedError = class extends Error {
  [kRangeUnsupported] = true;
  constructor() {
    super("Server ignored the Range header and returned a full response");
    this.name = "RangeNotSupportedError";
  }
};
function isRangeNotSupportedError(e) {
  return !!e && typeof e === "object" && e[kRangeUnsupported] === true;
}

// download.ts
var import_fs2 = require("fs");
var import_path = require("path");
var import_util = require("util");

// file_handler.ts
var import_fs = require("fs");
var import_undici2 = require("undici");

// error.ts
function safeSet(err, key, value) {
  try {
    err[key] = value;
  } catch {
    try {
      Object.defineProperty(err, key, { value, configurable: true, writable: true, enumerable: false });
    } catch {
    }
  }
}
function sanitizeUrl(raw) {
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return void 0;
  }
}
function getDestinationExtension(path) {
  const base = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot).toLowerCase() : "";
}
function decorateHttpError(err, requestUrl, redirects, destinationExtension) {
  const sanitizedRedirects = redirects == null ? void 0 : redirects.map((url) => sanitizeUrl(url.toString())).filter((url) => !!url);
  const responseUrl = (sanitizedRedirects == null ? void 0 : sanitizedRedirects.at(-1)) ?? (requestUrl ? sanitizeUrl(requestUrl) : void 0);
  if (responseUrl) {
    safeSet(err, "downloadUrl", responseUrl);
    safeSet(err, "downloadHost", new URL(responseUrl).host);
  }
  if (sanitizedRedirects == null ? void 0 : sanitizedRedirects.length) {
    safeSet(err, "downloadRedirects", JSON.stringify(sanitizedRedirects));
  }
  if (destinationExtension) {
    safeSet(err, "downloadDestinationExtension", destinationExtension);
  }
}
function decorateError(err, urls, headers, destination) {
  safeSet(err, "name", "DownloadError");
  safeSet(err, "urls", urls.join(" "));
  safeSet(err, "headers", headers);
  safeSet(err, "destination", destination);
  const sanitizedUrls = urls.map(sanitizeUrl).filter((url) => !!url);
  safeSet(err, "downloadUrls", JSON.stringify(sanitizedUrls));
  safeSet(err, "downloadHosts", JSON.stringify([...new Set(sanitizedUrls.map((url) => new URL(url).host))]));
  safeSet(err, "downloadDestinationExtension", getDestinationExtension(destination));
}

// file_handler.ts
var FileHandler = class {
  constructor(signal, fd, requestUrl, destinationExtension) {
    this.fd = fd;
    this.requestUrl = requestUrl;
    this.destinationExtension = destinationExtension;
    var _a;
    this.signal = signal;
    this.resolvers.promise.catch((e) => {
      var _a2;
      (_a2 = this.abort) == null ? void 0 : _a2.call(this, e);
    }).finally(() => {
      var _a2;
      (_a2 = this.signal) == null ? void 0 : _a2.removeEventListener("abort", this.listener);
    });
    (_a = this.signal) == null ? void 0 : _a.addEventListener("abort", this.listener);
  }
  fd;
  requestUrl;
  destinationExtension;
  abort;
  context;
  start = 0;
  position = 0;
  contentLength = 0;
  statusCode = 0;
  signal;
  resolvers = Promise.withResolvers();
  terminated = false;
  pending = 0;
  writeError;
  listener = () => {
    var _a;
    return this.resolvers.reject((_a = this.signal) == null ? void 0 : _a.reason);
  };
  onConnect(...args) {
    var _a, _b;
    const [abort, context] = args;
    this.context = context;
    if ((_a = this.signal) == null ? void 0 : _a.reason) {
      abort((_b = this.signal) == null ? void 0 : _b.reason);
      return;
    }
    this.abort = abort;
  }
  onHeaders(statusCode, rawHeaders, resume, statusText) {
    var _a;
    const headers = import_undici2.util.parseHeaders(rawHeaders);
    this.statusCode = statusCode;
    if (statusCode < 200) {
      return false;
    }
    if (statusCode >= 400) {
      const err = new Error(`HTTP Error: ${statusCode} ${statusText}`);
      err.statusCode = statusCode;
      decorateHttpError(err, this.requestUrl, (_a = this.context) == null ? void 0 : _a.history, this.destinationExtension);
      this.resolvers.reject(err);
      return false;
    }
    const acceptRanges = headers["accept-ranges"];
    const contentRange = headers["content-range"];
    const contentLength = headers["content-length"];
    let acceptRangesFlag = false;
    let total = 0;
    if (statusCode === 206) {
      acceptRangesFlag = true;
      if (!contentRange) {
        this.resolvers.reject(
          new Error(
            `HTTP Error: 206 Partial Content with no Content-Range header (statusText=${statusText})`
          )
        );
        return false;
      }
      const match = contentRange.match(/bytes\s+(\d+)-(\d+)\/(\d+|\*)/);
      if (match) {
        this.position = parseInt(match[1], 10);
        this.contentLength = parseInt(match[2], 10) - this.position + 1;
        if (match[3] !== "*") {
          total = parseInt(match[3], 10);
        }
      }
    } else if (statusCode === 200) {
      if (acceptRanges && acceptRanges.toLowerCase() === "bytes") {
        acceptRangesFlag = true;
      }
      if (contentLength) {
        this.contentLength = parseInt(contentLength, 10);
        total = this.contentLength;
      }
    }
    this.start = this.position;
    this.onHeaderParsed(acceptRangesFlag, total);
    resume();
    return true;
  }
  onHeaderParsed(acceptRanges, total) {
  }
  checkTermination() {
    if (this.pending === 0) {
      if (this.writeError) {
        this.resolvers.reject(this.writeError);
      } else {
        this.resolvers.resolve();
      }
    }
  }
  onData(chunk) {
    if (this.writeError) {
      return false;
    }
    this.pending++;
    (0, import_fs.write)(this.fd, chunk, 0, chunk.length, this.position, (err, written) => {
      var _a;
      this.pending--;
      if (err) {
        Error.captureStackTrace(err);
        this.writeError = err;
        this.resolvers.reject(err);
        return;
      }
      (_a = this.onWritten) == null ? void 0 : _a.call(this, written);
      if (this.terminated) {
        this.checkTermination();
      }
    });
    this.position += chunk.length;
    return true;
  }
  onComplete(trailers) {
    this.terminated = true;
    this.checkTermination();
  }
  onError(err) {
    this.terminated = true;
    this.resolvers.reject(err);
  }
  wait() {
    return this.resolvers.promise;
  }
};

// controlled_handler.ts
var ControlledFileHandler = class extends FileHandler {
  constructor(options, fd, controller, params = {}) {
    var _a, _b, _c, _d;
    super(options.signal, fd, `${options.origin}${options.path}`);
    this.controller = controller;
    this.origin = options.origin;
    this.path = options.path;
    this.segStart = ((_a = params.segment) == null ? void 0 : _a.start) ?? 0;
    this.segTotal = ((_b = params.segment) == null ? void 0 : _b.total) ?? 0;
    this.requireRange = params.requireRange ?? false;
    this.requestStart = params.requestStart ?? -1;
    this.noAbort = params.noAbort ?? false;
    this.abortable = params.abortable ?? true;
    this.advance = params.onAdvance;
    this.totalSize = this.segTotal || params.expectedTotal || 0;
    this.progressInfo.total = params.expectedTotal ?? this.totalSize;
    this.progressInfo.url = this.origin + this.path;
    if (params.tracker) {
      params.tracker.setAccessor(this.progressInfo);
    }
    this.onWritten = () => {
      var _a2;
      this.progressInfo.progress = this.position;
      (_a2 = this.advance) == null ? void 0 : _a2.call(this, this.position);
    };
    this.resolvers.promise.catch(() => {
    }).finally(() => this.clearTimers());
    const ttfb = controller.ttfbDeadline ?? 0;
    if (ttfb > 0 && this.abortable) {
      this.ttfbTimer = setTimeout(() => {
        if (this.firstByteAt === 0) {
          this.clearTimers();
          this.resolvers.reject(new ManagedAbortError("ttfb"));
        }
      }, ttfb);
      (_d = (_c = this.ttfbTimer).unref) == null ? void 0 : _d.call(_c);
    }
  }
  controller;
  origin;
  path;
  totalSize = 0;
  finalUrl;
  host;
  segStart;
  segTotal;
  requireRange;
  requestStart;
  noAbort;
  abortable;
  advance;
  firstByteAt = 0;
  lastByteAt = 0;
  windowStart = 0;
  windowBytes = 0;
  timer;
  ttfbTimer;
  rangeRejected = false;
  progressInfo = { url: "", total: 0, progress: 0 };
  onHeaderParsed(_acceptRanges, total) {
    var _a;
    if (this.requireRange && this.statusCode === 200) {
      this.rangeRejected = true;
      this.clearTimers();
      this.resolvers.reject(new RangeNotSupportedError());
      return;
    }
    if (this.requireRange && this.statusCode === 206 && this.requestStart >= 0 && this.start !== this.requestStart) {
      this.rangeRejected = true;
      this.clearTimers();
      this.resolvers.reject(new RangeNotSupportedError());
      return;
    }
    if (!this.segTotal && total) {
      this.totalSize = total;
      this.progressInfo.total = total;
    }
    const history = (_a = this.context) == null ? void 0 : _a.history;
    if (history && history.length > 0) {
      const last = history[history.length - 1];
      this.finalUrl = last.toString();
      this.host = last.host;
      this.progressInfo.url = this.finalUrl;
    }
  }
  onData(chunk) {
    if (this.rangeRejected) {
      return false;
    }
    const now = Date.now();
    this.lastByteAt = now;
    if (this.firstByteAt === 0) {
      this.firstByteAt = now;
      this.windowStart = now;
      this.clearTtfb();
      this.startSampling();
    }
    this.windowBytes += chunk.length;
    return super.onData(chunk);
  }
  onComplete(trailers) {
    this.clearTimers();
    super.onComplete(trailers);
  }
  onError(err) {
    this.clearTimers();
    super.onError(err);
  }
  /**
   * Absolute file offset reached so far on this connection. Used as the
   * resume offset for the next attempt.
   */
  get offset() {
    return this.position;
  }
  /**
   * Bytes received on this connection alone (excluding bytes already on
   * disk from a previous resumed attempt).
   */
  get received() {
    return this.position - this.start;
  }
  get finalHost() {
    return this.host;
  }
  get resolvedUrl() {
    return this.finalUrl;
  }
  get total() {
    return this.totalSize;
  }
  startSampling() {
    var _a, _b;
    const interval = this.controller.sampleInterval ?? 1e3;
    this.timer = setInterval(() => this.sample(), interval);
    (_b = (_a = this.timer).unref) == null ? void 0 : _b.call(_a);
  }
  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = void 0;
    }
  }
  clearTtfb() {
    if (this.ttfbTimer) {
      clearTimeout(this.ttfbTimer);
      this.ttfbTimer = void 0;
    }
  }
  clearTimers() {
    this.clearTimer();
    this.clearTtfb();
  }
  sample() {
    var _a, _b;
    const now = Date.now();
    const windowMs = now - this.windowStart;
    const speed = windowMs > 0 ? this.windowBytes / windowMs * 1e3 : 0;
    this.windowBytes = 0;
    this.windowStart = now;
    const stallTimeout = this.controller.stallTimeout ?? 0;
    if (this.abortable && stallTimeout > 0 && this.lastByteAt > 0 && now - this.lastByteAt > stallTimeout) {
      this.clearTimers();
      this.resolvers.reject(new ManagedAbortError("stall"));
      return;
    }
    if (this.noAbort) {
      return;
    }
    const elapsed = now - this.firstByteAt;
    if (elapsed < (this.controller.warmup ?? 0)) {
      return;
    }
    const inSegment = this.segTotal > 0;
    const total = inSegment ? this.segTotal : this.totalSize;
    const received = inSegment ? this.position - this.segStart : this.position;
    const decision = (_b = (_a = this.controller).onSample) == null ? void 0 : _b.call(_a, {
      origin: this.origin,
      finalUrl: this.finalUrl,
      host: this.host,
      received,
      total,
      speed,
      elapsed
    });
    if (decision === "abort") {
      this.clearTimers();
      this.resolvers.reject(new ManagedAbortError("slow"));
    }
  }
};

// range_handler.ts
var RangeRequestHandler = class extends FileHandler {
  constructor(options, dispatcher, fd, rangePolicy, tracker, destinationExtension) {
    super(options.signal, fd, `${options.origin}${options.path}`, destinationExtension);
    this.options = options;
    this.dispatcher = dispatcher;
    this.rangePolicy = rangePolicy;
    this.resolvers.promise.catch(() => this.childrenResolvers.resolve());
    if (tracker) {
      tracker.setAccessor(this.rangeInfo);
      this.rangeInfo.url = options.origin + options.path;
      Promise.allSettled([this.resolvers.promise, this.childrenResolvers.promise]).finally(() => {
        tracker.done = true;
      });
    }
  }
  options;
  dispatcher;
  rangePolicy;
  rangeInfo = {
    total: 0,
    progress: 0,
    url: ""
  };
  childrenResolvers = Promise.withResolvers();
  children = [];
  onHeaderParsed(acceptRanges, total) {
    var _a, _b, _c, _d, _e, _f;
    const [origin, path] = [
      ((_c = (_b = (_a = this.context) == null ? void 0 : _a.history) == null ? void 0 : _b[0]) == null ? void 0 : _c.origin) ?? this.options.origin,
      ((_f = (_e = (_d = this.context) == null ? void 0 : _d.history) == null ? void 0 : _e[0]) == null ? void 0 : _f.pathname) ?? this.options.path
    ];
    this.rangeInfo.total = total;
    this.rangeInfo.url = origin + path;
    if (!acceptRanges || total === this.contentLength) {
      this.childrenResolvers.resolve();
      return;
    }
    const remainingStart = this.start + this.contentLength;
    const remainingEnd = total - 1;
    const ranges = this.rangePolicy.computeRangesInRange(remainingStart, remainingEnd);
    const childrenPromises = [];
    for (const range of ranges) {
      const handler = new FileHandler(this.options.signal, this.fd, `${origin}${path}`, this.destinationExtension);
      this.children.push(handler);
      handler.onWritten = this.onWritten;
      childrenPromises.push(handler.wait());
      this.dispatcher.dispatch(
        {
          ...this.options,
          origin,
          path,
          headers: {
            ...this.options.headers,
            Range: `bytes=${range.start}-${range.end}`
          }
        },
        handler
      );
    }
    Promise.all(childrenPromises).then(() => this.childrenResolvers.resolve()).catch((err) => this.childrenResolvers.reject(err));
  }
  onWritten = (bytesWritten) => {
    this.rangeInfo.progress = this.position - this.start + this.children.reduce((a, b) => a + b.position - b.start, 0);
  };
  wait() {
    return Promise.all([super.wait(), this.childrenResolvers.promise]).then(() => {
    });
  }
};

// range_policy.ts
function isRangePolicy(rangeOptions) {
  if (!rangeOptions) {
    return false;
  }
  return "computeRangesInRange" in rangeOptions && typeof rangeOptions.computeRangesInRange === "function";
}
function resolveRangePolicy(rangeOptions) {
  if (isRangePolicy(rangeOptions)) {
    return rangeOptions;
  }
  return new DefaultRangePolicy(
    (rangeOptions == null ? void 0 : rangeOptions.rangeThreshold) ?? 1024 * 1024 * 5,
    // 5MB
    4
  );
}
var DefaultRangePolicy = class {
  constructor(rangeThreshold, concurrency) {
    this.rangeThreshold = rangeThreshold;
    this.concurrency = concurrency;
  }
  rangeThreshold;
  concurrency;
  computeRangesInRange(start, end) {
    const total = end - start + 1;
    const { rangeThreshold: minChunkSize } = this;
    if (total <= minChunkSize) {
      return [{ start, end }];
    }
    const partSize = Math.max(minChunkSize, Math.floor(total / this.concurrency));
    const ranges = [];
    for (let cur = start, chunkSize = 0; cur <= end; cur += chunkSize) {
      const remain = end - cur + 1;
      if (remain >= partSize) {
        chunkSize = partSize;
        ranges.push({ start: cur, end: cur + chunkSize - 1 });
      } else {
        const last = ranges[ranges.length - 1];
        if (!last) {
          ranges.push({ start, end });
        } else {
          last.end = end;
        }
        break;
      }
    }
    return ranges;
  }
};

// download.ts
function getDownloadBaseOptions(options) {
  return {
    dispatcher: (options == null ? void 0 : options.dispatcher) || getDefaultAgent(),
    rangePolicy: resolveRangePolicy(options == null ? void 0 : options.rangePolicy),
    controller: options == null ? void 0 : options.controller
  };
}
async function downloadMultiple(options) {
  const tracker = options.tracker;
  if (tracker) {
    let expectedTotal = 0;
    for (const opt of options.options) {
      if (!opt.expectedTotal) {
        expectedTotal = 0;
        break;
      }
      expectedTotal += opt.expectedTotal;
    }
    if (expectedTotal) {
      tracker.expectedTotal = expectedTotal;
    }
  }
  return Promise.allSettled(
    options.options.map(
      (opt) => download({
        ...opt,
        tracker: tracker == null ? void 0 : tracker.subSingle(),
        signal: options.signal,
        ...getDownloadBaseOptions(options)
      })
    )
  );
}
async function download(options) {
  const urls = typeof options.url === "string" ? [options.url] : options.url;
  const headers = options.headers || {};
  const destination = options.destination;
  const tracker = options.tracker;
  const signal = options.signal;
  const expectedTotal = options.expectedTotal;
  const { dispatcher, rangePolicy, controller } = getDownloadBaseOptions(options);
  signal == null ? void 0 : signal.throwIfAborted();
  if (tracker && expectedTotal) {
    tracker.expectedTotal = expectedTotal;
  }
  const fd = await openFd(options.destination);
  const errors = [];
  try {
    signal == null ? void 0 : signal.throwIfAborted();
    if (controller) {
      await downloadWithController({
        urls,
        headers,
        fd,
        dispatcher,
        controller,
        tracker,
        signal,
        expectedTotal: expectedTotal ?? 0
      });
      await close(fd).catch(() => {
      });
      return;
    }
    for (const url of urls) {
      const parsedUrl = new URL(url);
      const ops = {
        path: parsedUrl.pathname + parsedUrl.search,
        origin: parsedUrl.origin,
        method: "GET",
        signal,
        headers: {
          ...headers,
          ...expectedTotal && expectedTotal > rangePolicy.rangeThreshold ? {
            Range: `bytes=0-${rangePolicy.rangeThreshold - 1}`
          } : {}
        }
      };
      let restartedForRangeRetry = false;
      while (true) {
        const handler = new RangeRequestHandler(
          ops,
          dispatcher,
          fd,
          rangePolicy,
          tracker,
          getDestinationExtension(destination)
        );
        dispatcher.dispatch(ops, handler);
        const err = await handler.wait().catch((e) => e);
        if (!err) {
          errors.length = 0;
          break;
        }
        signal == null ? void 0 : signal.throwIfAborted();
        if (!restartedForRangeRetry && isRangeRetryError(err)) {
          restartedForRangeRetry = true;
          await ftruncateAsync(fd, 0).catch(() => {
          });
          delete ops.headers.Range;
          continue;
        }
        errors.push(err);
        break;
      }
      if (errors.length === 0) break;
    }
    if (errors.length > 0) {
      if (errors.length === 1) {
        throw errors[0];
      }
      throw new AggregateError(errors, "All urls failed to download");
    }
    await close(fd).catch(() => {
    });
  } catch (e) {
    decorateError(e, urls, headers, destination);
    await close(fd).catch(() => {
    });
    await unlinkAsync(destination).catch(() => {
    });
    throw e;
  }
}
async function downloadWithController(params) {
  const { urls, headers, fd, dispatcher, controller, tracker, signal, expectedTotal } = params;
  try {
    const splitThreshold = controller.rangeSplitThreshold ?? 4 * 1024 * 1024;
    const concurrency = controller.rangeConcurrency ?? 4;
    if (expectedTotal >= splitThreshold && concurrency > 1) {
      try {
        await downloadRanged(params, concurrency);
        return;
      } catch (e) {
        if (!isRangeNotSupportedError(e)) throw e;
        await ftruncateAsync(fd, 0).catch(() => {
        });
      }
    }
    await runSegment({
      urls,
      headers,
      fd,
      dispatcher,
      controller,
      signal,
      expectedTotal,
      tracker
    });
  } finally {
    if (tracker) {
      tracker.done = true;
    }
  }
}
async function downloadRanged(params, concurrency) {
  const { urls, headers, fd, dispatcher, controller, tracker, signal, expectedTotal } = params;
  const chunkSize = Math.ceil(expectedTotal / concurrency);
  const chunks = [];
  for (let s = 0; s < expectedTotal; s += chunkSize) {
    chunks.push({ start: s, end: Math.min(expectedTotal - 1, s + chunkSize - 1) });
  }
  const shared = {
    url: urls[0],
    total: expectedTotal,
    progress: 0
  };
  if (tracker) tracker.setAccessor(shared);
  const segDone = new Array(chunks.length).fill(0);
  const ac = new AbortController();
  const onOuterAbort = () => ac.abort(signal == null ? void 0 : signal.reason);
  if (signal) {
    if (signal.aborted) ac.abort(signal.reason);
    else signal.addEventListener("abort", onOuterAbort, { once: true });
  }
  try {
    await Promise.all(
      chunks.map(
        (segment, i) => runSegment({
          urls,
          headers,
          fd,
          dispatcher,
          controller,
          signal: ac.signal,
          expectedTotal,
          segment,
          onAdvance: (pos) => {
            segDone[i] = pos - segment.start;
            shared.progress = segDone.reduce((a, b) => a + b, 0);
          }
        })
      )
    );
  } catch (e) {
    ac.abort(e);
    throw e;
  } finally {
    signal == null ? void 0 : signal.removeEventListener("abort", onOuterAbort);
  }
}
async function runSegment(p) {
  var _a, _b, _c, _d, _e;
  const { urls, headers, fd, dispatcher, controller, signal, expectedTotal } = p;
  const maxResumes = controller.maxResumes ?? 5;
  const maxNoProgress = controller.maxNoProgressRerolls ?? 2;
  const isSeg = !!p.segment;
  const segStart = ((_a = p.segment) == null ? void 0 : _a.start) ?? 0;
  const segEnd = (_b = p.segment) == null ? void 0 : _b.end;
  const segTotal = isSeg ? segEnd - segStart + 1 : 0;
  let resumeOffset = segStart;
  let resumes = 0;
  let noProgress = 0;
  let committed = false;
  let lastError;
  let done = false;
  for (let urlIndex = 0; urlIndex < urls.length; ) {
    const parsedUrl = new URL(urls[urlIndex]);
    if (urlIndex < urls.length - 1 && ((_c = controller.shouldSkip) == null ? void 0 : _c.call(controller, parsedUrl.origin))) {
      urlIndex++;
      continue;
    }
    const range = isSeg ? `bytes=${resumeOffset}-${segEnd}` : resumeOffset > 0 ? `bytes=${resumeOffset}-` : void 0;
    const ops = {
      path: parsedUrl.pathname + parsedUrl.search,
      origin: parsedUrl.origin,
      method: "GET",
      signal,
      headers: { ...headers, ...range ? { Range: range } : {} }
    };
    const handler = new ControlledFileHandler(ops, fd, controller, {
      expectedTotal,
      tracker: p.tracker,
      segment: isSeg ? { start: segStart, total: segTotal } : void 0,
      requireRange: isSeg,
      requestStart: isSeg ? resumeOffset : -1,
      noAbort: committed,
      abortable: controller.isAbortable ? controller.isAbortable(ops.origin) : true,
      onAdvance: p.onAdvance
    });
    const startedAt = Date.now();
    dispatcher.dispatch(ops, handler);
    const err = await handler.wait().catch((e) => e);
    const duration = Date.now() - startedAt;
    const received = handler.received;
    (_d = controller.report) == null ? void 0 : _d.call(controller, {
      origin: ops.origin,
      finalUrl: handler.resolvedUrl,
      host: handler.finalHost,
      received,
      duration,
      speed: duration > 0 ? received / duration * 1e3 : 0,
      outcome: !err ? "completed" : isManagedAbortError(err) ? "aborted" : "failed"
    });
    if (!err) {
      const target = isSeg ? segEnd + 1 : handler.total;
      if (target > 0 && handler.offset < target) {
        resumeOffset = Math.max(resumeOffset, handler.offset);
        if (resumes < maxResumes) {
          resumes++;
          continue;
        }
        lastError = new Error(
          `Incomplete download: received ${handler.offset} of ${target} bytes`
        );
        urlIndex++;
        continue;
      }
      done = true;
      break;
    }
    signal == null ? void 0 : signal.throwIfAborted();
    if (isRangeNotSupportedError(err)) throw err;
    resumeOffset = Math.max(resumeOffset, handler.offset);
    lastError = err;
    if (isManagedAbortError(err)) {
      const reason = err.reason;
      if (reason === "slow") {
        if (resumes < maxResumes) {
          resumes++;
          continue;
        }
        committed = true;
        continue;
      }
      if (noProgress < maxNoProgress) {
        noProgress++;
        continue;
      }
      noProgress = 0;
      committed = false;
      urlIndex++;
      continue;
    }
    if (((_e = controller.shouldReroll) == null ? void 0 : _e.call(controller, ops.origin, err)) && resumes < maxResumes) {
      resumes++;
      continue;
    }
    urlIndex++;
  }
  if (!done) {
    throw lastError ?? new Error("Download failed with no attempts");
  }
}
var unlinkAsync = (0, import_util.promisify)(import_fs2.unlink);
var ftruncateAsync = (0, import_util.promisify)(import_fs2.ftruncate);
var mkdir = (0, import_util.promisify)(import_fs2.mkdir);
var open = (0, import_util.promisify)(import_fs2.open);
var close = (0, import_util.promisify)(import_fs2.close);
function isRangeRetryError(e) {
  if (!e) return false;
  if (e.code === "UND_ERR_REQ_RETRY") return true;
  const msg = typeof e.message === "string" ? e.message : "";
  return msg.includes("range header") || msg.includes("content-range mismatch");
}
function assignError(e) {
  Error.captureStackTrace(e);
  Object.assign(e, {
    phase: "open"
  });
}
async function openFd(output) {
  const fd = await open(output, "w").catch(async (e) => {
    if (e.code === "ENOENT") {
      await mkdir((0, import_path.dirname)(output), { recursive: true });
      return await open(output, "w").catch((e2) => {
        assignError(e2);
        throw e2;
      });
    }
    assignError(e);
    throw e;
  });
  return fd;
}

// progress.ts
var ProgressTrackerMultiple = class {
  trackers = [];
  expectedTotal = 0;
  subSingle() {
    const single = new ProgressTrackerSingle();
    this.trackers.push(single);
    return single;
  }
  get url() {
    var _a;
    for (const t of this.trackers) {
      if (!t.done) {
        return t.url;
      }
    }
    return ((_a = this.trackers[0]) == null ? void 0 : _a.url) ?? "";
  }
  get total() {
    const total = this.trackers.reduce((a, b) => a + b.total, 0);
    return total < this.expectedTotal ? this.expectedTotal : total;
  }
  get progress() {
    return this.trackers.reduce((a, b) => a + b.progress, 0);
  }
  toJSON() {
    return {
      url: this.url,
      total: this.total,
      progress: this.progress
    };
  }
};
var ProgressTrackerSingle = class {
  constructor(onDownload) {
    this.onDownload = onDownload;
  }
  onDownload;
  accessor;
  expectedTotal = 0;
  done = false;
  setAccessor(accessor) {
    var _a;
    this.accessor = accessor;
    try {
      (_a = this.onDownload) == null ? void 0 : _a.call(this, accessor);
    } catch (e) {
      console.error("Error in progress callback:", e);
    }
  }
  get progress() {
    var _a;
    return ((_a = this.accessor) == null ? void 0 : _a.progress) ?? 0;
  }
  get total() {
    var _a;
    return ((_a = this.accessor) == null ? void 0 : _a.total) ?? this.expectedTotal;
  }
  get url() {
    var _a;
    return ((_a = this.accessor) == null ? void 0 : _a.url) ?? "";
  }
  toJSON() {
    return {
      url: this.url,
      total: this.total,
      progress: this.progress
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DefaultRangePolicy,
  ManagedAbortError,
  ProgressTrackerMultiple,
  ProgressTrackerSingle,
  RangeNotSupportedError,
  decorateError,
  decorateHttpError,
  download,
  downloadMultiple,
  getDefaultAgent,
  getDestinationExtension,
  getDownloadBaseOptions,
  isManagedAbortError,
  isRangeNotSupportedError,
  isRangePolicy,
  resolveRangePolicy
});
//# sourceMappingURL=index.js.map
