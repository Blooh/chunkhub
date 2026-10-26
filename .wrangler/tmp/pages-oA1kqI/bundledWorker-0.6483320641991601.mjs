var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../../home/codespace/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// ../../../home/codespace/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// ../../../home/codespace/.npm/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
if (!("__unenv__" in performance)) {
  const proto = Performance.prototype;
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key !== "constructor" && !(key in performance)) {
      const desc = Object.getOwnPropertyDescriptor(proto, key);
      if (desc) {
        Object.defineProperty(performance, key, desc);
      }
    }
  }
}
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// ../../../home/codespace/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// ../../../home/codespace/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// ../../../home/codespace/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// ../../../home/codespace/.npm/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// ../../../home/codespace/.npm/_npx/32026684e21afda6/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// ../../../home/codespace/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// ../../../home/codespace/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// ../../../home/codespace/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// ../../../home/codespace/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str, encoding, cb) {
    if (str instanceof Uint8Array) {
      str = new TextDecoder().decode(str);
    }
    try {
      console.log(str);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// ../../../home/codespace/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// ../../../home/codespace/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// ../../../home/codespace/.npm/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var workerdProcess = getBuiltinModule("node:process");
var unenvProcess = new Process({
  env: globalProcess.env,
  hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  _channel,
  _debugEnd,
  _debugProcess,
  _disconnect,
  _events,
  _eventsCount,
  _exiting,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _handleQueue,
  _kill,
  _linkedBinding,
  _maxListeners,
  _pendingMessage,
  _preload_modules,
  _rawDebug,
  _send,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  assert: assert2,
  availableMemory,
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  disconnect,
  dlopen,
  domain,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  hrtime: hrtime3,
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  mainModule,
  memoryUsage,
  moduleLoadList,
  nextTick,
  off,
  on,
  once,
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// ../../../home/codespace/.npm/_npx/32026684e21afda6/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// _worker.js
var COOKIE = "ch_pass";
var MAX_AGE = 60 * 60 * 24 * 30;
async function token(password) {
  const data = new TextEncoder().encode("chunkhub-gate:" + password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(token, "token");
function sameText(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
__name(sameText, "sameText");
function readCookie(req, name) {
  const all = req.headers.get("Cookie") || "";
  for (const part of all.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return "";
}
__name(readCookie, "readCookie");
function noIndex(res) {
  const r = new Response(res.body, res);
  r.headers.set("X-Robots-Tag", "noindex, nofollow");
  r.headers.set("Cache-Control", "private, no-store");
  return r;
}
__name(noIndex, "noIndex");
function page(message, status = 200) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Chunk Hub \xB7 Private preview</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; font-family: Calibri, Carlito, system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #e4e4e7; background: linear-gradient(#0b1430, #1d2c4f 60%, #3a2f2a 60.2%, #2a2421); }
  .card { width: 100%; max-width: 380px; background: rgba(16,16,18,.88); border: 1px solid rgba(255,255,255,.1); border-radius: 18px; padding: 28px; box-shadow: 0 20px 60px rgba(0,0,0,.45); }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 20px; color: #fff; margin-bottom: 18px; }
  h1 { margin: 0 0 6px; font-size: 22px; color: #fff; }
  p { margin: 0 0 18px; color: #a1a1aa; line-height: 1.45; }
  label { display: block; font-size: 13px; color: #a1a1aa; margin-bottom: 6px; }
  input { width: 100%; font: inherit; font-size: 16px; color: #fff; background: #1b1b1f; border: 1px solid rgba(255,255,255,.15); border-radius: 10px; padding: 11px 12px; }
  input:focus { outline: 2px solid #ff3b30; outline-offset: 1px; }
  button { width: 100%; margin-top: 14px; font: inherit; font-weight: 700; font-size: 16px; color: #fff; background: #d32f2f; border: 0; border-radius: 10px; padding: 11px; cursor: pointer; }
  button:hover { background: #e53935; }
  .err { color: #ff8a80; font-size: 14px; margin: 10px 0 0; min-height: 1em; }
</style></head>
<body><form class="card" method="post" action="/__login">
  <div class="brand"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 2.5 20.5 7.2 12 12 3.5 7.2z" fill="#ff3b30"/><path d="M3.5 7.2 12 12v9.5l-8.5-4.8z" fill="#f4f4f5"/><path d="M20.5 7.2 12 12v9.5l8.5-4.8z" fill="#a1a1aa"/></svg>Chunk Hub</div>
  <h1>Private preview</h1>
  <p>This site isn't open yet. Enter the password to continue.</p>
  <label for="pw">Password</label>
  <input id="pw" name="password" type="password" autocomplete="current-password" autofocus required>
  <button type="submit">Enter</button>
  <p class="err" role="alert">${message}</p>
</form></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" } });
}
__name(page, "page");
var json = /* @__PURE__ */ __name((data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra } }), "json");
var dash = /* @__PURE__ */ __name((u) => u.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5"), "dash");
async function cached(key, ttl, make) {
  const cache = caches.default, req = new Request("https://cache.chunkhub.internal/" + key);
  const hit = await cache.match(req);
  if (hit) return hit.json();
  const val = await make();
  if (val) await cache.put(req, new Response(JSON.stringify(val), { headers: { "Cache-Control": "max-age=" + ttl } }));
  return val;
}
__name(cached, "cached");
async function supa(env2, fn, args) {
  if (!env2.SUPABASE_URL || !env2.SUPABASE_SERVICE_KEY) return null;
  const r = await fetch(env2.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/" + fn, { method: "POST", headers: { apikey: env2.SUPABASE_SERVICE_KEY, ...env2.SUPABASE_SERVICE_KEY.startsWith("eyJ") ? { Authorization: "Bearer " + env2.SUPABASE_SERVICE_KEY } : {}, "Content-Type": "application/json" }, body: JSON.stringify(args || {}) });
  return r.ok ? r.json() : null;
}
__name(supa, "supa");
function fromTextures(uuid, name, b64) {
  let skin = null, cape = null, slim = false;
  if (b64) {
    const t = JSON.parse(atob(b64)).textures || {};
    if (t.SKIN && t.SKIN.url) {
      skin = t.SKIN.url.replace(/^http:/, "https:");
      slim = !!(t.SKIN.metadata && t.SKIN.metadata.model === "slim");
    }
    if (t.CAPE && t.CAPE.url) cape = t.CAPE.url.replace(/^http:/, "https:");
  }
  return { uuid: uuid.replace(/-/g, ""), name, skin, slim, cape };
}
__name(fromTextures, "fromTextures");
var UA = { "User-Agent": "ChunkHub/1.0 (+https://chunkhub.net)", Accept: "application/json" };
async function viaMojang(q, isUuid) {
  let uuid = isUuid ? q : null;
  if (!uuid) {
    const r2 = await fetch("https://api.minecraftservices.com/minecraft/profile/lookup/name/" + encodeURIComponent(q), { headers: UA });
    if (r2.status === 404 || r2.status === 204) return { missing: true };
    if (!r2.ok) throw new Error("mojang name " + r2.status);
    uuid = (await r2.json()).id;
    if (!uuid) return { missing: true };
  }
  const r = await fetch("https://sessionserver.mojang.com/session/minecraft/profile/" + uuid + "?unsigned=true", { headers: UA });
  if (r.status === 204 || r.status === 404) return { missing: true };
  if (!r.ok) throw new Error("mojang profile " + r.status);
  const p = await r.json();
  const tex = (p.properties || []).find((x) => x.name === "textures");
  return fromTextures(p.id, p.name, tex && tex.value);
}
__name(viaMojang, "viaMojang");
async function viaPlayerDB(q) {
  const r = await fetch("https://playerdb.co/api/player/minecraft/" + encodeURIComponent(q), { headers: UA });
  const j = await r.json().catch(() => null);
  if (!j) throw new Error("playerdb " + r.status);
  if (!j.success) {
    if (/invalid|not.?found|unknown/i.test(String(j.code || "") + String(j.message || ""))) return { missing: true };
    throw new Error("playerdb " + j.code);
  }
  const p = j.data.player;
  const tex = (p.properties || []).find((x) => x.name === "textures");
  return fromTextures(p.raw_id || p.id, p.username, tex && tex.value);
}
__name(viaPlayerDB, "viaPlayerDB");
async function viaAshcon(q) {
  const r = await fetch("https://api.ashcon.app/mojang/v2/user/" + encodeURIComponent(q), { headers: UA });
  if (r.status === 404 || r.status === 204) return { missing: true };
  if (!r.ok) throw new Error("ashcon " + r.status);
  const j = await r.json();
  const t = j.textures || {};
  return { uuid: j.uuid.replace(/-/g, ""), name: j.username, skin: t.skin && t.skin.url ? t.skin.url.replace(/^http:/, "https:") : null, slim: !!t.slim, cape: t.cape && t.cape.url ? t.cape.url.replace(/^http:/, "https:") : null };
}
__name(viaAshcon, "viaAshcon");
async function resolvePlayer(q, isUuid) {
  const errors = [];
  for (const f of [() => viaMojang(q, isUuid), () => viaPlayerDB(q), () => viaAshcon(q)]) {
    try {
      return await f();
    } catch (e) {
      errors.push(e.message);
    }
  }
  throw new Error(errors.join("; "));
}
__name(resolvePlayer, "resolvePlayer");
async function handleApi(url, env2) {
  const path = url.pathname.slice("/api/mc/".length);
  try {
    if (path === "lookup") {
      const q = (url.searchParams.get("q") || "").trim();
      const id = q.replace(/-/g, "").toLowerCase(), isUuid = /^[0-9a-f]{32}$/.test(id);
      if (!isUuid && !/^[A-Za-z0-9_]{1,16}$/.test(q)) return json({ found: false, query: q, valid: false, invalid: true });
      const prof = await cached("p/" + (isUuid ? id : q.toLowerCase()), 120, () => resolvePlayer(isUuid ? id : q, isUuid));
      if (!prof || prof.missing) return json({ found: false, query: q, valid: isUuid || q.length >= 3 });
      const hash = prof.skin ? prof.skin.split("/").pop() : null, capeHash = prof.cape ? prof.cape.split("/").pop() : null;
      const history = await supa(env2, "mc_record", { p_uuid: prof.uuid, p_name: prof.name, p_skin: hash, p_slim: prof.slim, p_cape: capeHash }).catch(() => null);
      return json({ found: true, uuid: dash(prof.uuid), uuidPlain: prof.uuid, name: prof.name, skin: hash, slim: prof.slim, cape: capeHash, history });
    }
    if (path === "texture") {
      const h = url.searchParams.get("h") || "";
      if (!/^[0-9a-f]{20,80}$/.test(h)) return json({ error: "bad texture" }, 400);
      const r = await fetch("https://textures.minecraft.net/texture/" + h, { cf: { cacheTtl: 31536e3, cacheEverything: true } });
      if (!r.ok) return json({ error: "not found" }, 404);
      return new Response(r.body, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable", "Access-Control-Allow-Origin": "*" } });
    }
    if (path === "trending") {
      const list = await cached("trending", 300, async () => ({ list: await supa(env2, "mc_trending", {}).catch(() => null) || [] }));
      return json(list, 200, { "Cache-Control": "public, max-age=120" });
    }
    return json({ error: "not found" }, 404);
  } catch (e) {
    return json({ error: "The Minecraft servers didn\u2019t answer. Please try again in a moment.", detail: String(e && e.message || e) });
  }
}
__name(handleApi, "handleApi");
async function sha256hex(text) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
__name(sha256hex, "sha256hex");
var MAX_BODY = 4 * 1024 * 1024;
async function readJson(request) {
  const len = +(request.headers.get("content-length") || 0);
  if (len > MAX_BODY) throw new Error("too big");
  const text = await request.text();
  if (text.length > MAX_BODY) throw new Error("too big");
  return JSON.parse(text);
}
__name(readJson, "readJson");
var clip = /* @__PURE__ */ __name((v, n) => v == null ? null : String(v).slice(0, n), "clip");
async function handleMod(request, url, env2) {
  if (request.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
  if (!env2.SUPABASE_URL || !env2.SUPABASE_SERVICE_KEY) return json({ ok: false, error: "The website isn\u2019t finished setting up yet (Supabase keys missing)." });
  let body;
  try {
    body = await readJson(request);
  } catch {
    return json({ ok: false, error: "Bad or oversized request." }, 400);
  }
  const path = url.pathname.slice("/api/mod/".length);
  if (path === "link") {
    const code = String(body.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 8) return json({ ok: false, error: "That code doesn\u2019t look right. It should look like ABCD-1234." });
    const token3 = [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, "0")).join("");
    const r = await supa(env2, "mod_link", { p_code: code.slice(0, 4) + "-" + code.slice(4), p_token_hash: await sha256hex(token3), p_world: clip(body.world, 120) || "World", p_uuid: clip(body.uuid, 40) || "", p_name: clip(body.name, 32) || "", p_mc: clip(body.mc, 40), p_mod: clip(body.mod, 40) });
    if (!r) return json({ ok: false, error: "The website couldn\u2019t save the link. Please try again." });
    if (!r.ok) return json({ ok: false, error: "That code has expired or was already used. Get a new one on the World Stats page." });
    return json({ ok: true, token: token3, world_id: r.world_id });
  }
  const token2 = String(body.token || "");
  if (!/^[0-9a-f]{64}$/.test(token2)) return json({ ok: false, error: "unlinked" });
  const hash = await sha256hex(token2);
  if (path === "sync") {
    const r = await supa(env2, "mod_sync", { p_token_hash: hash, p_stats: body.stats || null, p_adv: body.advancements || null, p_extra: body.extra || null, p_name: clip(body.name, 32), p_mc: clip(body.mc, 40), p_mod: clip(body.mod, 40) });
    if (!r) return json({ ok: false, error: "The website couldn\u2019t save this sync. It will try again later." });
    return json(r);
  }
  if (path === "ping") {
    const r = await supa(env2, "mod_ping", { p_token_hash: hash });
    return json(r || { ok: false });
  }
  if (path === "unlink") {
    const r = await supa(env2, "mod_unlink", { p_token_hash: hash });
    return json(r || { ok: false });
  }
  return json({ ok: false, error: "not found" }, 404);
}
__name(handleMod, "handleMod");
var worker_default = {
  async fetch(request, env2) {
    const url = new URL(request.url);
    const isApi = url.pathname.startsWith("/api/mc/");
    if (url.pathname.startsWith("/api/mod/")) return handleMod(request, url, env2).catch(() => json({ ok: false, error: "Something went wrong on the website." }));
    if (String(env2.PUBLIC).toLowerCase() === "true") return isApi ? handleApi(url, env2) : env2.ASSETS.fetch(request);
    const password = env2.SITE_PASSWORD;
    if (!password) return page("The site password hasn\u2019t been set up yet (SITE_PASSWORD).", 503);
    const good = await token(password);
    if (url.pathname === "/__logout") {
      return new Response(null, { status: 302, headers: { Location: "/", "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
    }
    if (url.pathname === "/__login" && request.method === "POST") {
      const form = await request.formData().catch(() => null);
      const tried = form ? String(form.get("password") || "") : "";
      if (sameText(await token(tried), good)) {
        return new Response(null, { status: 303, headers: { Location: "/", "Set-Cookie": `${COOKIE}=${good}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax` } });
      }
      await new Promise((r) => setTimeout(r, 700));
      return page("That password isn\u2019t right. Try again.", 401);
    }
    if (sameText(readCookie(request, COOKIE), good)) return isApi ? handleApi(url, env2) : noIndex(await env2.ASSETS.fetch(request));
    if (isApi) return json({ error: "locked" }, 401);
    return page("", 401);
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=bundledWorker-0.6483320641991601.mjs.map
