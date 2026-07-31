// launch.ts
import { open, openEntryReadStream, walkEntriesGenerator } from "@xmcl/unzip";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { EventEmitter } from "events";
import { createWriteStream, existsSync } from "fs";
import { link, mkdir, readFile as readFile2, writeFile } from "fs/promises";
import { EOL } from "os";
import { basename, delimiter, dirname, isAbsolute, join as join2, resolve, sep } from "path";
import { pipeline as pipeline2 } from "stream";
import { promisify } from "util";

// folder.ts
import { join } from "path";
var MinecraftFolder = class _MinecraftFolder {
  constructor(root) {
    this.root = root;
  }
  root;
  /**
   * Normal a Minecraft folder from a folder or string
   */
  static from(location) {
    return typeof location === "string" ? new _MinecraftFolder(location) : location instanceof _MinecraftFolder ? location : new _MinecraftFolder(location.root);
  }
  get mods() {
    return join(this.root, "mods");
  }
  get resourcepacks() {
    return join(this.root, "resourcepacks");
  }
  get assets() {
    return join(this.root, "assets");
  }
  get libraries() {
    return join(this.root, "libraries");
  }
  get versions() {
    return this.getPath("versions");
  }
  get logs() {
    return this.getPath("logs");
  }
  get options() {
    return this.getPath("options.txt");
  }
  get launcherProfile() {
    return this.getPath("launcher_profiles.json");
  }
  get lastestLog() {
    return this.getPath("logs", "latest.log");
  }
  get maps() {
    return this.getPath("saves");
  }
  get saves() {
    return this.getPath("saves");
  }
  get screenshots() {
    return this.getPath("screenshots");
  }
  getNativesRoot(version) {
    return join(this.getVersionRoot(version), version + "-natives");
  }
  getVersionRoot(version) {
    return join(this.versions, version);
  }
  getVersionJson(version) {
    return join(this.getVersionRoot(version), version + ".json");
  }
  getVersionServerJson(version) {
    return join(this.getVersionRoot(version), "server.json");
  }
  getVersionJar(version, type) {
    if (type === "client" || !type) return join(this.getVersionRoot(version), version + ".jar");
    if (type === "server")
      return this.getPath(
        "libraries",
        "net",
        "minecraft",
        "server",
        version,
        `server-${version}-bundled.jar`
      );
    return join(this.getVersionRoot(version), version + `-${type}.jar`);
  }
  getVersionAll(version) {
    return [
      join(this.versions, version),
      join(this.versions, version, version + ".json"),
      join(this.versions, version, version + ".jar")
    ];
  }
  getResourcePack(fileName) {
    return join(this.resourcepacks, fileName);
  }
  getMod(fileName) {
    return join(this.mods, fileName);
  }
  getLog(fileName) {
    return join(this.logs, fileName);
  }
  getMapInfo(map) {
    return this.getPath("saves", map, "level.dat");
  }
  getMapIcon(map) {
    return this.getPath("saves", map, "icon.png");
  }
  getLibraryByPath(libraryPath) {
    return join(this.libraries, libraryPath);
  }
  getAssetsIndex(versionAssets) {
    return this.getPath("assets", "indexes", versionAssets + ".json");
  }
  getAsset(hash) {
    return this.getPath("assets", "objects", hash.substring(0, 2), hash);
  }
  getLogConfig(file) {
    return this.getPath("assets", "log_configs", file);
  }
  getPath(...path) {
    return join(this.root, ...path);
  }
};
var MinecraftPath;
((MinecraftPath2) => {
  MinecraftPath2.mods = "mods";
  MinecraftPath2.resourcepacks = "resourcepacks";
  MinecraftPath2.assets = "assets";
  MinecraftPath2.libraries = "libraries";
  MinecraftPath2.versions = "versions";
  MinecraftPath2.logs = "logs";
  MinecraftPath2.options = "options.txt";
  MinecraftPath2.launcherProfile = "launcher_profiles.json";
  MinecraftPath2.lastestLog = "logs/latest.log";
  MinecraftPath2.maps = MinecraftPath2.saves;
  MinecraftPath2.saves = "saves";
  MinecraftPath2.screenshots = "screenshots";
  function getVersionRoot(version) {
    return join("versions", version);
  }
  MinecraftPath2.getVersionRoot = getVersionRoot;
  function getNativesRoot(version) {
    return join("versions", version, version + "-natives");
  }
  MinecraftPath2.getNativesRoot = getNativesRoot;
  function getVersionJson(version) {
    return join("versions", version, version + ".json");
  }
  MinecraftPath2.getVersionJson = getVersionJson;
  function getVersionJar(version, type) {
    return type === "client" || type === void 0 ? join("versions", version, version + ".jar") : join("versions", version, `${version}-${type}.jar`);
  }
  MinecraftPath2.getVersionJar = getVersionJar;
  function getResourcePack(fileName) {
    return join("resourcepacks", fileName);
  }
  MinecraftPath2.getResourcePack = getResourcePack;
  function getMod(fileName) {
    return join("mods", fileName);
  }
  MinecraftPath2.getMod = getMod;
  function getLog(fileName) {
    return join("logs", fileName);
  }
  MinecraftPath2.getLog = getLog;
  function getMapInfo(map) {
    return join("saves", map, "level.dat");
  }
  MinecraftPath2.getMapInfo = getMapInfo;
  function getMapIcon(map) {
    return join("saves", map, "icon.png");
  }
  MinecraftPath2.getMapIcon = getMapIcon;
  function getLibraryByPath(libraryPath) {
    return join("libraries", libraryPath);
  }
  MinecraftPath2.getLibraryByPath = getLibraryByPath;
  function getAssetsIndex(versionAssets) {
    return join("assets", "indexes", versionAssets + ".json");
  }
  MinecraftPath2.getAssetsIndex = getAssetsIndex;
  function getAsset(hash) {
    return join("assets", "objects", hash.substring(0, 2), hash);
  }
  MinecraftPath2.getAsset = getAsset;
})(MinecraftPath || (MinecraftPath = {}));

// platform.ts
import * as os from "os";
function getPlatform() {
  const arch2 = os.arch();
  const version = os.release();
  switch (os.platform()) {
    case "darwin":
      return { name: "osx", version, arch: arch2 };
    case "linux":
      return { name: "linux", version, arch: arch2 };
    case "win32":
      return { name: "windows", version, arch: arch2 };
    default:
      return { name: "unknown", version, arch: arch2 };
  }
}

// utils.ts
import { createHash } from "crypto";
import { constants, createReadStream } from "fs";
import { access } from "fs/promises";
import { pipeline } from "stream/promises";
async function validateSha1(target, hash, strict = false) {
  if (await access(target).then(
    () => false,
    () => true
  )) {
    return false;
  }
  if (!hash) {
    return !strict;
  }
  const sha1 = await checksum(target, "sha1");
  return sha1 === hash;
}
async function checksum(target, algorithm) {
  const hash = createHash(algorithm).setEncoding("hex");
  try {
    await pipeline(createReadStream(target), hash);
  } catch (e) {
    if (e.code === "ENOENT") {
      return void 0;
    }
  }
  return hash.read();
}
function isNotNull(v) {
  return v !== void 0;
}

// version.ts
import { extname } from "path";
import { readFile } from "fs/promises";
function isBadVersionJsonError(e) {
  return e && e.error === "BadVersionJson";
}
function isCorruptedVersionJsonError(e) {
  return e && e.error === "CorruptedVersionJson";
}
function isMissingVersionJsonError(e) {
  return e && e.error === "MissingVersionJson";
}
var LibraryInfo;
((LibraryInfo2) => {
  function resolveFromPath(path) {
    const parts = path.split("/");
    const file = parts[parts.length - 1];
    const version = parts[parts.length - 2];
    const artifactId = parts[parts.length - 3];
    const groupId = parts.slice(0, parts.length - 3).join(".");
    const filePrefix = `${artifactId}-${version}`;
    const ext = extname(file);
    const type = ext.substring(1);
    const isSnapshot = file.startsWith(version);
    let classifier = file.substring(
      isSnapshot ? version.length : filePrefix.length,
      file.length - ext.length
    );
    if (classifier.startsWith("-")) {
      classifier = classifier.slice(1);
    }
    let name = `${groupId}:${artifactId}:${version}`;
    if (classifier) {
      name += `:${classifier}`;
    }
    if (type !== "jar") {
      name += `@${type}`;
    }
    return {
      type,
      groupId,
      artifactId,
      version,
      classifier,
      name,
      path,
      isSnapshot
    };
  }
  LibraryInfo2.resolveFromPath = resolveFromPath;
  function resolve2(lib) {
    const name = typeof lib === "string" ? lib : lib.name;
    const [body, type = "jar"] = name.split("@");
    const [groupId, artifactId, version, classifier = ""] = body.split(":");
    const isSnapshot = version.endsWith("-SNAPSHOT");
    const groupPath = groupId.replace(/\./g, "/");
    let base = `${groupPath}/${artifactId}/${version}/${artifactId}-${version}`;
    if (classifier) {
      base += `-${classifier}`;
    }
    const path = `${base}.${type}`;
    return {
      type,
      groupId,
      artifactId,
      version,
      name,
      isSnapshot,
      classifier,
      path
    };
  }
  LibraryInfo2.resolve = resolve2;
})(LibraryInfo || (LibraryInfo = {}));
var ResolvedLibrary = class {
  constructor(name, info, download, isNative = false, checksums, serverreq, clientreq, extractExclude) {
    this.name = name;
    this.download = download;
    this.isNative = isNative;
    this.checksums = checksums;
    this.serverreq = serverreq;
    this.clientreq = clientreq;
    this.extractExclude = extractExclude;
    const { groupId, artifactId, version, isSnapshot, type, classifier, path } = info;
    this.groupId = groupId;
    this.artifactId = artifactId;
    this.version = version;
    this.isSnapshot = isSnapshot;
    this.type = type;
    this.classifier = classifier;
    this.path = path;
  }
  name;
  download;
  isNative;
  checksums;
  serverreq;
  clientreq;
  extractExclude;
  groupId;
  artifactId;
  version;
  isSnapshot;
  type;
  classifier;
  path;
};
var Version;
((Version2) => {
  function checkAllowed(rules, platform2 = getPlatform(), features = []) {
    if (!rules || rules.length === 0) {
      return true;
    }
    let allow = false;
    for (const rule of rules) {
      const action = rule.action === "allow";
      let apply = true;
      if ("os" in rule && rule.os) {
        apply = false;
        const osRule = rule.os;
        if (platform2.name === osRule.name && (!osRule.version || platform2.version.match(osRule.version))) {
          apply = true;
          if (osRule.arch) {
            const ruleArch = osRule.arch === "x86" ? "ia32" : osRule.arch;
            apply = ruleArch === platform2.arch;
          }
        }
      }
      if (apply) {
        if ("features" in rule && rule.features) {
          const featureRequire = rule.features;
          apply = Object.entries(featureRequire).every(
            ([k, v]) => v ? features.indexOf(k) !== -1 : features.indexOf(k) === -1
          );
        }
      }
      if (apply) {
        allow = action;
      }
    }
    return allow;
  }
  Version2.checkAllowed = checkAllowed;
  async function parse(minecraftPath, version, platofrm = getPlatform()) {
    const folder = MinecraftFolder.from(minecraftPath);
    const hierarchy = await resolveDependency(folder, version, platofrm);
    return resolve2(minecraftPath, hierarchy);
  }
  Version2.parse = parse;
  async function parseServer(minecraftPath, version) {
    var _a, _b;
    const folder = MinecraftFolder.from(minecraftPath);
    const filePath = folder.getVersionServerJson(version);
    const content = await readFile(filePath, "utf-8");
    const profile = JSON.parse(content);
    return {
      id: version,
      minecraftVersion: profile.inheritsFrom || profile.id,
      mainClass: profile.mainClass,
      jar: profile.jar,
      libraries: profile.libraries.map((l) => Version2.resolveLibrary(l)).filter(isNotNull),
      arguments: {
        jvm: ((_a = profile.arguments) == null ? void 0 : _a.jvm) || [],
        game: ((_b = profile.arguments) == null ? void 0 : _b.game) || []
      }
    };
  }
  Version2.parseServer = parseServer;
  function resolve2(minecraftPath, hierarchy) {
    const folder = MinecraftFolder.from(minecraftPath);
    const rootVersion = hierarchy[hierarchy.length - 1];
    const id = hierarchy[0].id;
    let assetIndex = rootVersion.assetIndex;
    let assets = "";
    const downloadsMap = {};
    const librariesMap = {};
    const nativesMap = {};
    let mainClass = "";
    const args = { jvm: [], game: [] };
    let minimumLauncherVersion = 0;
    let releaseTime = "";
    let time = "";
    let type = "";
    let logging;
    const minecraftVersion = rootVersion.clientVersion ?? rootVersion._minecraftVersion ?? rootVersion.id;
    let location;
    let javaVersion = { majorVersion: 8, component: "jre-legacy" };
    const chains = hierarchy.map((j) => folder.getVersionRoot(j.id));
    const inheritances = hierarchy.map((j) => j.id);
    let json;
    do {
      json = hierarchy.pop();
      minimumLauncherVersion = Math.max(json.minimumLauncherVersion || 0, minimumLauncherVersion);
      location = json.minecraftDirectory;
      if (!Reflect.get(json, "replace")) {
        args.game.push(...json.arguments.game);
        args.jvm.push(...json.arguments.jvm);
      } else {
        args.game = json.arguments.game;
        args.jvm = json.arguments.jvm;
      }
      releaseTime = json.releaseTime || releaseTime;
      time = json.time || time;
      logging = json.logging || logging;
      assets = json.assets || assets;
      type = json.type || type;
      mainClass = json.mainClass || mainClass;
      assetIndex = json.assetIndex || assetIndex;
      javaVersion = json.javaVersion || javaVersion;
      if (json.libraries) {
        json.libraries.forEach((lib) => {
          let libOrgName = `${lib.groupId}:${lib.artifactId}`;
          if (lib.classifier) {
            libOrgName += `-${lib.classifier};`;
          }
          if (lib.isNative) {
            nativesMap[libOrgName] = lib;
          } else {
            librariesMap[libOrgName] = lib;
          }
        });
      }
      if (json.downloads) {
        for (const key in json.downloads) {
          downloadsMap[key] = json.downloads[key];
        }
      }
    } while (hierarchy.length !== 0);
    if (!mainClass) {
      throw Object.assign(new Error(), {
        name: "BadVersionJson",
        error: "BadVersionJson",
        version: id,
        missing: "MainClass"
      });
    }
    return {
      id,
      assetIndex,
      assets,
      minecraftVersion,
      inheritances,
      arguments: args,
      downloads: downloadsMap,
      libraries: Object.keys(librariesMap).map((k) => librariesMap[k]).concat(Object.keys(nativesMap).map((k) => nativesMap[k])),
      mainClass,
      minimumLauncherVersion,
      releaseTime,
      time,
      type,
      logging,
      pathChain: chains,
      minecraftDirectory: location,
      javaVersion
    };
  }
  Version2.resolve = resolve2;
  function inherits(id, parent, version) {
    const launcherVersion = Math.max(parent.minimumLauncherVersion, version.minimumLauncherVersion);
    const libMap = {};
    parent.libraries.forEach((l) => {
      libMap[l.name] = l;
    });
    const libraries = version.libraries.filter((l) => libMap[l.name] === void 0);
    const result = {
      id,
      time: (/* @__PURE__ */ new Date()).toISOString(),
      releaseTime: (/* @__PURE__ */ new Date()).toISOString(),
      type: version.type,
      libraries,
      mainClass: version.mainClass,
      inheritsFrom: parent.id,
      minimumLauncherVersion: launcherVersion
    };
    if (typeof parent.minecraftArguments === "string") {
      if (typeof version.arguments === "object") {
        throw new TypeError("Extends require two version in same format!");
      }
      result.minecraftArguments = mixinArgumentString(
        parent.minecraftArguments,
        version.minecraftArguments || ""
      );
    } else if (typeof parent.arguments === "object") {
      if (typeof version.minecraftArguments === "string") {
        throw new TypeError("Extends require two version in same format!");
      }
      result.arguments = version.arguments;
    }
    return result;
  }
  Version2.inherits = inherits;
  function mixinArgumentString(hi, lo) {
    const arrA = hi.split(" ");
    const arrB = lo.split(" ");
    const args = {};
    for (let i = 0; i < arrA.length; i++) {
      const element = arrA[i];
      if (!args[element]) {
        args[element] = [];
      }
      if (arrA[i + 1]) {
        args[element].push(arrA[i += 1]);
      }
    }
    for (let i = 0; i < arrB.length; i++) {
      const element = arrB[i];
      if (!args[element]) {
        args[element] = [];
      }
      if (arrB[i + 1]) {
        args[element].push(arrB[i += 1]);
      }
    }
    const out = [];
    for (const k of Object.keys(args)) {
      switch (k) {
        case "--tweakClass": {
          const set = {};
          for (const v of args[k]) {
            set[v] = 0;
          }
          Object.keys(set).forEach((v) => out.push(k, v));
          break;
        }
        default:
          if (args[k][0]) {
            out.push(k, args[k][0]);
          }
          break;
      }
    }
    return out.join(" ");
  }
  Version2.mixinArgumentString = mixinArgumentString;
  async function resolveDependency(path, version, platform2 = getPlatform()) {
    const folder = MinecraftFolder.from(path);
    const stack = [];
    async function walk(versionName) {
      const jsonPath = folder.getVersionJson(versionName);
      let contentString;
      try {
        contentString = await readFile(jsonPath, "utf-8");
      } catch (err) {
        const e = err;
        throw Object.assign(new Error(e.message), {
          name: "MissingVersionJson",
          error: "MissingVersionJson",
          version: versionName,
          path: jsonPath
        });
      }
      let nextVersion;
      try {
        const versionJson = normalizeVersionJson(contentString, folder.root, platform2);
        stack.push(versionJson);
        nextVersion = versionJson.inheritsFrom;
      } catch (e) {
        if (e instanceof SyntaxError) {
          throw Object.assign(new Error(e.message), {
            name: "CorruptedVersionJson",
            error: "CorruptedVersionJson",
            version: versionName,
            json: contentString
          });
        }
        throw e;
      }
      if (nextVersion) {
        if (stack.some((v) => v.id === nextVersion)) {
          throw Object.assign(new Error("Cannot resolve circular dependencies"), {
            name: "CircularDependenciesError",
            error: "CircularDependenciesError",
            version,
            chain: stack.map((v) => v.id).concat(nextVersion)
          });
        }
        await walk(nextVersion);
      }
    }
    await walk(version);
    return stack;
  }
  Version2.resolveDependency = resolveDependency;
  function resolveLibrary(lib, platform2 = getPlatform()) {
    var _a, _b;
    if ("rules" in lib && !checkAllowed(lib.rules, platform2)) {
      return void 0;
    }
    if ("natives" in lib) {
      if (!lib.natives[platform2.name]) {
        return void 0;
      }
      const classifier = lib.natives[platform2.name].replace("${arch}", platform2.arch.substring(1));
      let nativeArtifact = (_b = (_a = lib.downloads) == null ? void 0 : _a.classifiers) == null ? void 0 : _b[classifier];
      const info2 = LibraryInfo.resolve(lib.name + ":" + classifier);
      if (!nativeArtifact) {
        nativeArtifact = {
          path: info2.path,
          sha1: "",
          size: -1,
          url: "https://libraries.minecraft.net/" + info2.path
        };
      }
      if (!nativeArtifact.path) {
        nativeArtifact = {
          ...nativeArtifact,
          path: info2.path
        };
      }
      return new ResolvedLibrary(
        lib.name + ":" + classifier,
        info2,
        nativeArtifact,
        true,
        void 0,
        void 0,
        void 0,
        lib.extract ? lib.extract.exclude ? lib.extract.exclude : void 0 : void 0
      );
    }
    const info = LibraryInfo.resolve(lib.name);
    if ("downloads" in lib) {
      if (!lib.downloads.artifact) {
        throw new Error("Corrupted library: " + JSON.stringify(lib));
      }
      if (!lib.downloads.artifact.url) {
        lib.downloads.artifact.url = info.groupId === "net.minecraftforge" ? "https://files.minecraftforge.net/maven/" + lib.downloads.artifact.path : "https://libraries.minecraft.net/" + lib.downloads.artifact.path;
      }
      if (!lib.downloads.artifact.path) {
        lib.downloads.artifact = {
          ...lib.downloads.artifact,
          path: info.path
        };
      }
      return new ResolvedLibrary(lib.name, info, lib.downloads.artifact);
    }
    const maven = lib.url || "https://libraries.minecraft.net/";
    const artifact = {
      size: -1,
      sha1: lib.checksums ? lib.checksums[0] : "",
      path: info.path,
      url: maven + info.path
    };
    return new ResolvedLibrary(
      lib.name,
      info,
      artifact,
      false,
      lib.checksums,
      lib.serverreq,
      lib.clientreq
    );
  }
  Version2.resolveLibrary = resolveLibrary;
  function resolveLibraries(libs, platform2 = getPlatform()) {
    return libs.map((lib) => resolveLibrary(lib, platform2)).filter((l) => l !== void 0);
  }
  Version2.resolveLibraries = resolveLibraries;
  function normalizeVersionJson(versionString, root, platform2 = getPlatform()) {
    function processArguments(ar) {
      return ar.filter((a) => {
        var _a;
        if (typeof a === "object" && ((_a = a.rules) == null ? void 0 : _a.every((r) => typeof r === "string" || !("features" in r)))) {
          return Version2.checkAllowed(a.rules, platform2);
        }
        return true;
      });
    }
    const parsed = JSON.parse(versionString);
    const legacyVersionJson = !parsed.arguments && !!parsed.minecraftArguments;
    const libraries = Version2.resolveLibraries(parsed.libraries || [], platform2);
    const args = {
      jvm: [],
      game: []
    };
    if (!parsed.arguments) {
      args.game = parsed.minecraftArguments ? parsed.minecraftArguments.split(" ") : [];
      args.jvm = [
        {
          rules: [
            {
              action: "allow",
              os: {
                name: "windows"
              }
            }
          ],
          value: "-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump"
        },
        {
          rules: [
            {
              action: "allow",
              os: {
                name: "windows",
                version: "^10\\."
              }
            }
          ],
          value: ["-Dos.name=Windows 10", "-Dos.version=10.0"]
        },
        // eslint-disable-next-line no-template-curly-in-string
        "-Djava.library.path=${natives_directory}",
        // eslint-disable-next-line no-template-curly-in-string
        "-Dminecraft.launcher.brand=${launcher_name}",
        // eslint-disable-next-line no-template-curly-in-string
        "-Dminecraft.launcher.version=${launcher_version}",
        "-cp",
        // eslint-disable-next-line no-template-curly-in-string
        "${classpath}"
      ];
    } else {
      args.jvm = parsed.arguments.jvm || [];
      args.game = parsed.arguments.game || [];
    }
    args.jvm = processArguments(args.jvm);
    const partial = {
      ...parsed,
      libraries,
      arguments: args,
      minecraftDirectory: root,
      // we want to replace the arguments for every version json in legacy version json
      replace: legacyVersionJson
    };
    return partial;
  }
  Version2.normalizeVersionJson = normalizeVersionJson;
})(Version || (Version = {}));

// launch.ts
function format(template, args) {
  return template.replace(/\$\{(.*?)}/g, (key) => {
    const value = args[key.substring(2).substring(0, key.length - 3)];
    return value || key;
  });
}
var DEFAULT_EXTRA_JVM_ARGS = Object.freeze([
  "-Xmx2G",
  "-XX:+UnlockExperimentalVMOptions",
  "-XX:+UseG1GC",
  "-XX:G1NewSizePercent=20",
  "-XX:G1ReservePercent=20",
  "-XX:MaxGCPauseMillis=50",
  "-XX:G1HeapRegionSize=32M"
]);
var LaunchPrecheck;
((LaunchPrecheck2) => {
  LaunchPrecheck2.DEFAULT_PRECHECKS = Object.freeze([
    checkVersion,
    checkLibraries,
    checkNatives,
    linkAssets
  ]);
  LaunchPrecheck2.Default = LaunchPrecheck2.DEFAULT_PRECHECKS;
  async function linkAssets(resource, version, option) {
    if (version.assets !== "legacy" && !version.assets.startsWith("pre-")) {
      return;
    }
    const assetsIndexPath = resource.getAssetsIndex(version.assets);
    const buf = await readFile2(assetsIndexPath);
    const assetsIndex = JSON.parse(
      buf.toString()
    );
    const virtualPath = resource.getPath("assets/virtual/" + version.assets);
    await mkdir(virtualPath, { recursive: true }).catch(() => {
    });
    const dirs = Object.keys(assetsIndex.objects).map((path) => dirname(join2(virtualPath, path))).reduce((a, b) => a.add(b), /* @__PURE__ */ new Set());
    await Promise.all([...dirs].map((dir) => mkdir(dir, { recursive: true })));
    for (const [path, { hash }] of Object.entries(assetsIndex.objects)) {
      const assetPath = resource.getAsset(hash);
      const targetPath = join2(virtualPath, path);
      await link(assetPath, targetPath).catch((e) => {
        if (e.code !== "EEXIST") {
          throw e;
        }
      });
    }
  }
  LaunchPrecheck2.linkAssets = linkAssets;
  async function checkVersion(resource, version, option) {
    var _a;
    const jarPath = resource.getVersionJar(version.minecraftVersion);
    if ((_a = version.downloads.client) == null ? void 0 : _a.sha1) {
      if (!await validateSha1(jarPath, version.downloads.client.sha1)) {
        throw Object.assign(
          new Error(
            `Corrupted Version jar ${jarPath}. Either the file not reachable or the file sha1 not matched!`
          ),
          {
            error: "CorruptedVersionJar",
            version: version.minecraftVersion
          }
        );
      }
    }
  }
  LaunchPrecheck2.checkVersion = checkVersion;
  async function checkLibraries(resource, version, option) {
    const validMask = await Promise.all(
      version.libraries.map(
        (lib) => validateSha1(resource.getLibraryByPath(lib.download.path), lib.download.sha1)
      )
    );
    const corruptedLibs = version.libraries.filter((_, index) => !validMask[index]);
    if (corruptedLibs.length > 0) {
      throw Object.assign(
        new Error(
          `Missing ${corruptedLibs.length} libraries! Either the file not reachable or the file sha1 not matched!`
        ),
        {
          error: "MissingLibraries",
          libraries: corruptedLibs,
          version
        }
      );
    }
  }
  LaunchPrecheck2.checkLibraries = checkLibraries;
  async function checkNatives(resource, version, option) {
    const native = option.nativeRoot || resource.getNativesRoot(version.id);
    await mkdir(native, { recursive: true }).catch((e) => {
      if (e.code !== "EEXIST") {
        throw e;
      }
    });
    const natives = version.libraries.filter(
      (lib) => lib.isNative
    );
    const checksumFile = join2(native, ".json");
    const includedLibs = natives.map((n) => n.name).sort();
    const checksumFileObject = await readFile2(checksumFile, "utf-8").then(JSON.parse).catch((e) => void 0);
    let shaEntries;
    if (checksumFileObject && checksumFileObject.libraries) {
      if (checksumFileObject.libraries.sort().every((v, i) => v === includedLibs[i])) {
        shaEntries = checksumFileObject.entries;
      }
    }
    const extractedNatives = [];
    async function extractJar(n) {
      if (!n) {
        return;
      }
      const excluded = n.extractExclude || [];
      const platform2 = option.platform || getPlatform();
      const containsExcludes = (p) => excluded.filter((s) => p.startsWith(s)).length === 0;
      const notInMetaInf = (p) => p.indexOf("META-INF/") === -1;
      const notSha1AndNotGit = (p) => !(p.endsWith(".sha1") || p.endsWith(".git"));
      const isSatisfyPlaform = (p) => {
        if (p.indexOf("/") === -1) {
          return true;
        }
        const [os2, arch2] = p.split("/");
        const platformArch = arch2 === "ia32" ? "x86" : arch2;
        return os2 === platform2.name && platformArch === platform2.arch;
      };
      if (!n.download.path) {
        throw Object.assign(
          new TypeError(`Library ${n.name}(${version.id}) has no download path!`),
          { library: n }
        );
      }
      const from = resource.getLibraryByPath(n.download.path);
      const promises = [];
      const zip = await open(from, { lazyEntries: true, autoClose: false });
      for await (const entry of walkEntriesGenerator(zip)) {
        if (containsExcludes(entry.fileName) && notInMetaInf(entry.fileName) && notSha1AndNotGit(entry.fileName) && !entry.fileName.endsWith("/") && isSatisfyPlaform(entry.fileName)) {
          const fileName = basename(entry.fileName);
          const dest = join2(native, fileName);
          if (fileName.indexOf("/") !== -1) {
            await mkdir(dirname(dest), {
              recursive: true
            }).catch((e) => {
            });
          }
          extractedNatives.push({ file: fileName, name: n.name, sha1: "" });
          promises.push(
            promisify(pipeline2)(await openEntryReadStream(zip, entry), createWriteStream(dest))
          );
        }
      }
      await Promise.all(promises);
    }
    if (shaEntries) {
      const validEntries = {};
      for (const entry of shaEntries) {
        if (typeof entry.file !== "string") {
          continue;
        }
        const file = join2(native, entry.file);
        const valid = await validateSha1(file, entry.sha1, true);
        if (valid) {
          validEntries[entry.name] = true;
        }
      }
      const missingNatives = natives.filter((n) => !validEntries[n.name]);
      if (missingNatives.length !== 0) {
        const result = await Promise.allSettled(missingNatives.map(extractJar));
        const errors = result.map((r) => r.status === "rejected" ? r.reason : void 0).filter(isNotNull);
        if (errors.length === 0) {
          return;
        }
        if (errors.length === 1) {
          throw errors[0];
        }
        throw new AggregateError(errors, "Some natives failed to extract");
      }
    } else {
      const result = await Promise.allSettled(natives.map(extractJar));
      const entries = await Promise.all(
        extractedNatives.map(async (n) => ({
          ...n,
          sha1: await checksum(join2(native, n.file), "sha1")
        }))
      );
      const fileContent = JSON.stringify({
        entries,
        libraries: includedLibs
      });
      await writeFile(checksumFile, fileContent);
      const errors = result.map((r) => r.status === "rejected" ? r.reason : void 0).filter(isNotNull);
      if (errors.length === 0) {
        return;
      }
      if (errors.length === 1) {
        throw errors[0];
      }
      throw new AggregateError(errors, "Some natives failed to extract");
    }
  }
  LaunchPrecheck2.checkNatives = checkNatives;
})(LaunchPrecheck || (LaunchPrecheck = {}));
async function launchServer(options) {
  const args = generateArgumentsServer(options);
  const spawnOption = { env: process.env, ...options.extraExecOption };
  return (options.spawn ?? spawn)(args[0], args.slice(1), spawnOption);
}
function createMinecraftProcessWatcher(process2, emitter = new EventEmitter()) {
  var _a;
  let crashReport = "";
  let crashReportLocation = "";
  let waitForReady = true;
  process2.on("error", (e) => {
    emitter.emit("error", e);
  });
  process2.on("exit", (code, signal) => {
    emitter.emit("minecraft-exit", {
      code,
      signal,
      crashReport,
      crashReportLocation
    });
  });
  (_a = process2.stdout) == null ? void 0 : _a.on("data", (s) => {
    const string = s.toString();
    if (string.indexOf("---- Minecraft Crash Report ----") !== -1) {
      crashReport = string;
    } else if (string.indexOf("Crash report saved to:") !== -1) {
      crashReportLocation = string.substring(
        string.indexOf("Crash report saved to:") + "Crash report saved to: #@!@# ".length
      );
      crashReportLocation = crashReportLocation.replace(EOL, "").trim();
    } else if (string.indexOf("Crash report saved to ") !== -1) {
      crashReportLocation = string.substring(
        string.indexOf("Crash report saved to ") + "Crash report saved to ".length
      );
      crashReportLocation = crashReportLocation.replace(EOL, "").trim();
    } else if (waitForReady && (string.indexOf("Missing metadata in pack") !== -1 || string.indexOf("Registering resource reload listener") !== -1 || string.indexOf("Reloading ResourceManager") !== -1 || string.indexOf("LWJGL Version: ") !== -1 || string.indexOf("OpenAL initialized.") !== -1)) {
      waitForReady = false;
      emitter.emit("minecraft-window-ready");
    } else if (waitForReady && string.indexOf(" Preparing level ") !== -1) {
      waitForReady = false;
      emitter.emit("minecraft-window-ready");
    } else if (string.indexOf("Failed to start the minecraft server") !== -1) {
      crashReport = string;
    }
  });
  return emitter;
}
async function launch(options) {
  var _a;
  const gamePath = !isAbsolute(options.gamePath) ? resolve(options.gamePath) : options.gamePath;
  const resourcePath = options.resourcePath || gamePath;
  const version = typeof options.version === "string" ? await Version.parse(resourcePath, options.version) : options.version;
  let args = await generateArguments({ ...options, version, gamePath, resourcePath });
  const minecraftFolder = MinecraftFolder.from(resourcePath);
  const prechecks = options.prechecks || LaunchPrecheck.DEFAULT_PRECHECKS;
  await Promise.all(prechecks.map((f) => f(minecraftFolder, version, options)));
  const spawnOption = { cwd: options.gamePath, ...options.extraExecOption };
  if ((_a = options.extraExecOption) == null ? void 0 : _a.shell) {
    args = args.map((a) => `"${a}"`);
  }
  if (!existsSync(gamePath)) {
    await mkdir(gamePath);
  }
  return (options.spawn ?? spawn)(args[0], args.slice(1), spawnOption);
}
function unshiftPrependCommand(cmd, prependCommand) {
  if (prependCommand) {
    if (typeof prependCommand === "string") {
      if (prependCommand.trim().length > 0) {
        cmd.push(prependCommand.trim());
      }
    } else {
      const prepended = prependCommand.filter((c) => c.trim().length > 0);
      cmd.unshift(...prepended);
    }
  }
}
function generateArgumentsServer(options, _delimiter = delimiter, _sep = sep) {
  const {
    javaPath,
    minMemory,
    maxMemory,
    extraJVMArgs = [],
    extraMCArgs = [],
    extraExecOption = {}
  } = options;
  const cmd = [javaPath];
  if (minMemory) {
    cmd.push(`-Xms${minMemory}M`);
  }
  if (maxMemory) {
    cmd.push(`-Xmx${maxMemory}M`);
  }
  cmd.push(...extraJVMArgs);
  if (options.classPath && options.classPath.length > 0) {
    cmd.push("-cp", options.classPath.map((v) => v.replaceAll(sep, _sep)).join(_delimiter));
  }
  if (options.serverExectuableJarPath) {
    cmd.push("-jar", options.serverExectuableJarPath.replaceAll(sep, _sep));
  } else if (options.mainClass) {
    cmd.push(options.mainClass);
  }
  cmd.push(...extraMCArgs);
  if (options.nogui) {
    cmd.push("nogui");
  }
  unshiftPrependCommand(cmd, options.prependCommand);
  return cmd;
}
async function generateArguments(options) {
  var _a;
  if (!options.version) {
    throw new TypeError("Version cannot be null!");
  }
  if (!options.demo) {
    options.demo = false;
  }
  const currentPlatform = options.platform ?? getPlatform();
  const gamePath = !isAbsolute(options.gamePath) ? resolve(options.gamePath) : options.gamePath;
  const resourcePath = options.resourcePath || gamePath;
  const version = typeof options.version === "string" ? await Version.parse(resourcePath, options.version) : options.version;
  const mc = MinecraftFolder.from(resourcePath);
  const cmd = [];
  const { id = randomUUID().replace(/-/g, ""), name = "Steve" } = options.gameProfile || {};
  const accessToken = options.accessToken || randomUUID().replace(/-/g, "");
  const properties = options.properties || {};
  const userType = options.userType || "msa";
  const features = options.features || {};
  const jvmArguments = normalizeArguments(version.arguments.jvm, currentPlatform, features);
  const gameArguments = normalizeArguments(version.arguments.game, currentPlatform, features);
  const featureValues = Object.values(features).filter((f) => typeof f === "object").reduce((a, b) => ({ ...a, ...b }), {});
  const launcherName = options.launcherName || "Launcher";
  const launcherBrand = options.launcherBrand || "0.0.1";
  const nativeRoot = options.nativeRoot || mc.getNativesRoot(version.id);
  let gameIcon = options.gameIcon;
  if (!gameIcon) {
    const index = mc.getAssetsIndex(version.assets);
    const indexContent = await readFile2(index, { encoding: "utf-8" }).then(
      (b) => JSON.parse(b.toString()),
      () => ({})
    );
    if ("icons/minecraft.icns" in indexContent) {
      gameIcon = mc.getAsset(indexContent["icons/minecraft.icns"].hash);
    } else if ("minecraft/icons/minecraft.icns" in indexContent) {
      gameIcon = mc.getAsset(indexContent["minecraft/icons/minecraft.icns"].hash);
    } else {
      gameIcon = "";
    }
  }
  const gameName = options.gameName || "Minecraft";
  cmd.push(options.javaPath);
  if (currentPlatform.name === "osx") {
    cmd.push(`-Xdock:name=${gameName}`);
    if (gameIcon) {
      cmd.push(`-Xdock:icon=${gameIcon}`);
    }
  }
  if (options.minMemory) {
    cmd.push(`-Xms${options.minMemory}M`);
  }
  if (options.maxMemory) {
    cmd.push(`-Xmx${options.maxMemory}M`);
  }
  if (options.ignoreInvalidMinecraftCertificates) {
    cmd.push("-Dfml.ignoreInvalidMinecraftCertificates=true");
  }
  if (options.ignorePatchDiscrepancies) {
    cmd.push("-Dfml.ignorePatchDiscrepancies=true");
  }
  if (options.yggdrasilAgent) {
    cmd.push(`-javaagent:${options.yggdrasilAgent.jar}=${options.yggdrasilAgent.server}`);
    cmd.push("-Dauthlibinjector.side=client");
    if (options.yggdrasilAgent.prefetched) {
      cmd.push(`-Dauthlibinjector.yggdrasil.prefetched=${options.yggdrasilAgent.prefetched}`);
    }
  }
  const jvmOptions = {
    natives_directory: nativeRoot.replaceAll("\\", "/"),
    launcher_name: launcherName,
    launcher_version: launcherBrand,
    game_directory: gamePath.replaceAll("\\", "/"),
    classpath: [
      ...version.libraries.filter((lib) => !lib.isNative).map((lib) => mc.getLibraryByPath(lib.download.path)),
      mc.getVersionJar(version.minecraftVersion),
      ...options.extraClassPaths || []
    ].map((c) => c.replaceAll("\\", "/")).join(delimiter),
    library_directory: mc.getPath("libraries").replaceAll("\\", "/"),
    classpath_separator: delimiter,
    version_name: version.minecraftVersion,
    ...featureValues
  };
  if (version.logging && version.logging.client) {
    const client = version.logging.client;
    const argument = client.argument;
    const filePath = mc.getLogConfig(client.file.id);
    if (existsSync(filePath)) {
      jvmArguments.push(argument.replace("${path}", filePath));
    }
  }
  cmd.push(...jvmArguments.map((arg) => format(arg, jvmOptions)));
  if (!cmd.some((v) => v.startsWith("-DlibraryDirectory"))) {
    cmd.push("-DlibraryDirectory=" + mc.getPath("libraries").replaceAll("\\", "/"));
  }
  if (options.extraJVMArgs instanceof Array) {
    if (options.extraJVMArgs.some((v) => typeof v !== "string")) {
      throw new TypeError("Require extraJVMArgs be all string!");
    }
    cmd.push(...options.extraJVMArgs);
  } else {
    if (options.maxMemory) {
      cmd.push(...DEFAULT_EXTRA_JVM_ARGS.filter((v) => v !== "-Xmx2G"));
    } else {
      cmd.push(...DEFAULT_EXTRA_JVM_ARGS);
    }
  }
  cmd.push(version.mainClass);
  const assetsDir = join2(resourcePath, "assets");
  const resolution = options.resolution;
  const versionName = options.versionName || version.id;
  const versionType = options.versionType || version.type;
  const mcOptions = {
    version_name: versionName,
    version_type: versionType,
    assets_root: assetsDir.replaceAll("\\", "/"),
    game_assets: join2(assetsDir, "virtual", version.assets).replaceAll("\\", "/"),
    assets_index_name: options.useHashAssetsIndex ? ((_a = version.assetIndex) == null ? void 0 : _a.sha1) ?? version.assets : version.assets,
    auth_session: accessToken,
    game_directory: gamePath.replaceAll("\\", "/"),
    auth_player_name: name,
    auth_uuid: id,
    auth_access_token: accessToken,
    user_properties: JSON.stringify(properties),
    user_type: userType,
    resolution_width: -1,
    resolution_height: -1,
    ...featureValues
  };
  if (resolution) {
    mcOptions.resolution_width = resolution.width;
    mcOptions.resolution_height = resolution.height;
  }
  cmd.push(...gameArguments.map((arg) => format(arg, mcOptions)));
  if (options.extraMCArgs) {
    cmd.push(...options.extraMCArgs);
  }
  if (options.quickPlayMultiplayer) {
    cmd.push("--quickPlayMultiplayer", options.quickPlayMultiplayer);
  }
  if (options.quickPlaySingleplayer) {
    cmd.push("--quickPlaySingleplayer", options.quickPlaySingleplayer);
  }
  if (options.server) {
    cmd.push("--server", options.server.ip);
    if (options.server.port) {
      cmd.push("--port", options.server.port.toString());
    }
  }
  if (options.resolution && !cmd.find((a) => a === "--width")) {
    if (options.resolution.fullscreen) {
      cmd.push("--fullscreen");
    } else {
      if (options.resolution.height) {
        cmd.push("--height", options.resolution.height.toString());
      }
      if (options.resolution.width) {
        cmd.push("--width", options.resolution.width.toString());
      }
    }
  }
  if (options.demo) {
    cmd.push("--demo");
  }
  unshiftPrependCommand(cmd, options.prependCommand);
  return cmd;
}
function normalizeArguments(args, platform2, features) {
  return args.map((arg) => {
    if (typeof arg === "string") {
      return arg;
    }
    if (!Version.checkAllowed(arg.rules || [], platform2, Object.keys(features))) {
      return "";
    }
    return arg.value;
  }).reduce((result, cur) => {
    if (cur instanceof Array) {
      result.push(...cur);
    } else if (cur) {
      result.push(cur);
    }
    return result;
  }, []);
}
function createQuickPlayMultiplayer(ip, port) {
  return port ? `${ip}:${port}` : ip;
}

// header.ts
function findNeoforgeVersion(minecraft, resolvedVersion) {
  const neoForgeIndex = resolvedVersion.arguments.game.indexOf("--fml.neoForgeVersion");
  if (neoForgeIndex !== -1) {
    const version = resolvedVersion.arguments.game[neoForgeIndex + 1];
    return version;
  }
  const hasNeoForged = resolvedVersion.libraries.some(
    (lib) => lib.groupId === "net.neoforged.fancymodloader"
  );
  if (!hasNeoForged) return "";
  const forgeIndex = resolvedVersion.arguments.game.indexOf("--fml.forgeVersion");
  if (forgeIndex !== -1) {
    const version = resolvedVersion.arguments.game[forgeIndex + 1];
    return `${minecraft}-${version}`;
  }
  return "";
}
function parseForgeVersion(forgeVersion) {
  if (!forgeVersion) return forgeVersion;
  const idx = forgeVersion.indexOf("-");
  return forgeVersion.substring(idx + 1);
}
function parseOptifineVersion(optifineVersion) {
  if (!optifineVersion) return optifineVersion;
  const idx = optifineVersion.indexOf("_");
  return optifineVersion.substring(idx + 1);
}
function isForgeLibrary(lib) {
  return lib.groupId === "net.minecraftforge" && (lib.artifactId === "forge" || lib.artifactId === "fmlloader" || lib.artifactId === "minecraftforge");
}
function isFabricLoaderLibrary(lib) {
  return lib.groupId === "net.fabricmc" && lib.artifactId === "fabric-loader";
}
function isOptifineLibrary(lib) {
  return lib.groupId === "optifine" && (lib.artifactId === "Optifine" || lib.artifactId === "OptiFine");
}
function isQuiltLibrary(lib) {
  return lib.groupId === "org.quiltmc" && lib.artifactId === "quilt-loader";
}
function findLabyModVersion(resolvedVersion) {
  var _a;
  return ((_a = resolvedVersion.libraries.find((l) => l.groupId === "net.labymod" && l.artifactId === "LabyMod")) == null ? void 0 : _a.version) || "";
}
function getResolvedVersionHeader(ver) {
  var _a, _b, _c, _d;
  return {
    id: ver.id,
    path: ver.pathChain[0],
    inheritances: ver.inheritances,
    minecraft: ver.minecraftVersion,
    neoforge: findNeoforgeVersion(ver.minecraftVersion, ver),
    forge: parseForgeVersion(((_a = ver.libraries.find(isForgeLibrary)) == null ? void 0 : _a.version) ?? ""),
    fabric: ((_b = ver.libraries.find(isFabricLoaderLibrary)) == null ? void 0 : _b.version) ?? "",
    optifine: parseOptifineVersion(((_c = ver.libraries.find(isOptifineLibrary)) == null ? void 0 : _c.version) ?? ""),
    quilt: ((_d = ver.libraries.find(isQuiltLibrary)) == null ? void 0 : _d.version) ?? "",
    labyMod: findLabyModVersion(ver)
  };
}
function isSameForgeVersion(forgeVersion, version, minecraft) {
  if (version.startsWith(`${minecraft}-`)) version = version.substring(`${minecraft}-`.length);
  if (version.endsWith(`-${minecraft}`))
    version = version.substring(0, version.length - `-${minecraft}`.length);
  const i = version.indexOf("-");
  if (i === -1) {
    return forgeVersion === version;
  }
  return forgeVersion === version.substring(i + 1) || forgeVersion === version.substring(0, i);
}
function matchVersion(versions, id, runtime) {
  return versions.find((v) => v.id === id) || versions.find((ver) => isVersionMatched(ver, runtime));
}
function isVersionMatched(version, {
  minecraft,
  forge,
  neoforge,
  fabric: fabricLoader,
  optifine,
  quilt: quiltLoader,
  labyMod
}) {
  if (version.minecraft !== minecraft) {
    return false;
  }
  if (forge) {
    if (!version.forge || !isSameForgeVersion(forge, version.forge, minecraft)) {
      return false;
    }
  } else if (version.forge) {
    return false;
  }
  if (neoforge) {
    if (!version.neoforge || version.neoforge !== neoforge) {
      return false;
    }
  } else if (version.neoforge) {
    return false;
  }
  if (labyMod) {
    if (!version.labyMod || version.labyMod !== labyMod) {
      return false;
    }
  } else if (version.labyMod) {
    return false;
  }
  if (fabricLoader) {
    if (!version.fabric || version.fabric !== fabricLoader) {
      return false;
    }
  } else if (version.fabric) {
    return false;
  }
  if (optifine) {
    if (!version.optifine || optifine !== version.optifine) {
      return false;
    }
  } else if (version.optifine) {
    return false;
  }
  if (quiltLoader) {
    if (!version.quilt || version.quilt !== quiltLoader) {
      return false;
    }
  } else if (version.quilt) {
    return false;
  }
  return true;
}
export {
  DEFAULT_EXTRA_JVM_ARGS,
  LaunchPrecheck,
  LibraryInfo,
  MinecraftFolder,
  MinecraftPath,
  ResolvedLibrary,
  Version,
  checksum,
  createMinecraftProcessWatcher,
  createQuickPlayMultiplayer,
  findLabyModVersion,
  findNeoforgeVersion,
  generateArguments,
  generateArgumentsServer,
  getPlatform,
  getResolvedVersionHeader,
  isBadVersionJsonError,
  isCorruptedVersionJsonError,
  isFabricLoaderLibrary,
  isForgeLibrary,
  isMissingVersionJsonError,
  isOptifineLibrary,
  isQuiltLibrary,
  isSameForgeVersion,
  launch,
  launchServer,
  matchVersion,
  parseForgeVersion,
  parseOptifineVersion
};
//# sourceMappingURL=index.mjs.map
