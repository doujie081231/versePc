import { MinecraftLocation } from './folder';
import { Platform } from './platform';
interface PartialResolvedVersion extends Version {
    libraries: ResolvedLibrary[];
    arguments: {
        game: Version.LaunchArgument[];
        jvm: Version.LaunchArgument[];
    };
    minecraftDirectory: string;
}
/**
 * The resolved version for launcher.
 * It could be a combination of multiple versions as there might be some inheritions.
 *
 * You can get resolved version of a Minecraft by calling {@link Version.parse}.
 *
 * @see {@link Version.parse}
 */
export interface ResolvedVersion {
    /**
     * The id of the version, should be identical to the version folder.
     */
    id: string;
    arguments: {
        game: Version.LaunchArgument[];
        jvm: Version.LaunchArgument[];
    };
    /**
     * The main class full qualified name
     */
    mainClass: string;
    assetIndex?: Version.AssetIndex;
    /**
     * The asset index id of this version. Should be something like `1.14`, `1.12`
     */
    assets: string;
    downloads: {
        client?: Version.Download;
        server?: Version.Download;
        [key: string]: Version.Download | undefined;
    };
    libraries: ResolvedLibrary[];
    minimumLauncherVersion: number;
    releaseTime: string;
    time: string;
    type: string;
    logging?: {
        [key: string]: {
            file: Version.Download & {
                id: string;
            };
            argument: string;
            type: string;
        };
    };
    /**
     * Recommended java version
     */
    javaVersion: JavaVersion;
    /**
     * The minecraft version of this version
     */
    minecraftVersion: string;
    /**
     * The minecraft directory of this version
     */
    minecraftDirectory: string;
    /**
     * The version inheritances of this whole resolved version.
     *
     * The first element is this version, and the last element is the root Minecraft version.
     * The dependencies of `[a, b, c]` should be `a -> b -> c`, where c is a Minecraft version.
     */
    inheritances: string[];
    /**
     * All array of json file paths.
     *
     * It's the chain of inherits json path. The root json will be the last element of the array.
     * The first element is the user provided version.
     */
    pathChain: string[];
}
export interface ResolvedServerVersion {
    id: string;
    libraries: ResolvedLibrary[];
    mainClass: string;
    jar?: string;
    minecraftVersion: string;
    arguments: {
        game: string[];
        jvm: string[];
    };
}
/**
 * The full library info. I can be resolved from path or maven library name.
 *
 * @see {@link LibraryInfo.resolveFromPath} {@link LibraryInfo.resolve}
 */
export interface LibraryInfo {
    readonly groupId: string;
    readonly artifactId: string;
    readonly version: string;
    readonly isSnapshot: boolean;
    /**
     * The file extension. Default is `jar`. Some files in forge are `zip`.
     */
    readonly type: string;
    /**
     * The classifier. Normally, this is empty. For forge, it can be like `universal`, `installer`.
     */
    readonly classifier: string;
    /**
     * The maven path.
     */
    readonly path: string;
    /**
     * The original maven name of this library
     */
    readonly name: string;
}
export interface BadVersionJsonError {
    error: 'BadVersionJson';
    missing: 'MainClass' | 'AssetIndex' | 'Downloads';
    version: string;
}
export declare function isBadVersionJsonError(e: any): e is BadVersionJsonError;
export interface CorruptedVersionJsonError {
    error: 'CorruptedVersionJson';
    version: string;
    json: string;
}
export declare function isCorruptedVersionJsonError(e: any): e is CorruptedVersionJsonError;
export interface MissingVersionJsonError {
    error: 'MissingVersionJson';
    version: string;
    path: string;
}
export declare function isMissingVersionJsonError(e: any): e is MissingVersionJsonError;
export interface CircularDependenciesError {
    error: 'CircularDependencies';
    /**
     * The version has circular dependencies
     */
    version: string;
    chain: string[];
}
export type VersionParseError = ((BadVersionJsonError | CorruptedVersionJsonError | MissingVersionJsonError | CircularDependenciesError) & Error) | Error;
export declare namespace LibraryInfo {
    /**
     * Resolve the library info from the maven path.
     * @param path The library path. It should look like `net/minecraftforge/forge/1.0/forge-1.0.jar`
     */
    function resolveFromPath(path: string): LibraryInfo;
    /**
     * Get the base info of the library from its name
     *
     * @param lib The name of library or the library itself
     */
    function resolve(lib: string | Version.Library | ResolvedLibrary): LibraryInfo;
}
/**
 * A resolved library for launcher. It can by parsed from `LibraryInfo`.
 */
export declare class ResolvedLibrary implements LibraryInfo {
    readonly name: string;
    readonly download: Version.Artifact;
    readonly isNative: boolean;
    readonly checksums?: string[] | undefined;
    readonly serverreq?: boolean | undefined;
    readonly clientreq?: boolean | undefined;
    readonly extractExclude?: string[] | undefined;
    readonly groupId: string;
    readonly artifactId: string;
    readonly version: string;
    readonly isSnapshot: boolean;
    readonly type: string;
    readonly classifier: string;
    readonly path: string;
    constructor(name: string, info: LibraryInfo, download: Version.Artifact, isNative?: boolean, checksums?: string[] | undefined, serverreq?: boolean | undefined, clientreq?: boolean | undefined, extractExclude?: string[] | undefined);
}
export declare namespace Version {
    interface Download {
        sha1: string;
        size: number;
        url: string;
    }
    interface AssetIndex extends Download {
        readonly id: string;
        readonly totalSize: number;
    }
    interface Artifact extends Download {
        readonly path: string;
    }
    interface LoggingFile extends Download {
        readonly id: string;
    }
    interface NormalLibrary {
        name: string;
        downloads: {
            artifact: Artifact;
        };
    }
    interface Rule {
        action: 'allow' | 'disallow';
        os?: Partial<Platform>;
        features?: {
            [feat: string]: boolean;
        };
    }
    interface NativeLibrary {
        name: string;
        downloads: {
            artifact: Artifact;
            classifiers: {
                [os: string]: Artifact;
            };
        };
        rules: Rule[];
        extract: {
            exclude: string[];
        };
        natives: {
            [os: string]: string;
        };
    }
    interface PlatformSpecificLibrary {
        name: string;
        downloads: {
            artifact: Artifact;
        };
        rules: Rule[];
    }
    interface LegacyLibrary {
        name: string;
        url?: string;
        clientreq?: boolean;
        serverreq?: boolean;
        checksums?: string[];
    }
    type Library = NormalLibrary | NativeLibrary | PlatformSpecificLibrary | LegacyLibrary;
    type LaunchArgument = string | {
        rules?: Rule[];
        value: string | string[];
    };
    /**
     * Check if all the rules in `Rule[]` are acceptable in certain OS `platform` and features.
     * @param rules The rules usually comes from `Library` or `LaunchArgument`
     * @param platform The platform, leave it absent will use the `currentPlatform`
     * @param features The features, used by game launch argument `arguments.game`
     */
    function checkAllowed(rules: Rule[], platform?: Platform, features?: string[]): boolean;
    /**
     * Recursively parse the version JSON.
     *
     * This function requires that the id in version.json is identical to the directory name of that version.
     *
     * e.g. .minecraft/<version-a>/<version-a.json> and in <version-a.json>:
     *```
     * { "id": "<version-a>", ... }
     * ```
     * The function might throw multiple parsing errors. You can handle them with type by this:
     * ```ts
     * try {
     *   await Version.parse(mcPath, version);
     * } catch (e) {
     *   let err = e as VersionParseError;
     *   switch (err.error) {
     *     case "BadVersionJson": // do things...
     *     // handle other cases
     *     default: // this means this is not a VersionParseError, handle error normally.
     *   }
     * }
     * ```
     *
     * @param minecraftPath The .minecraft path
     * @param version The vesion id.
     * @return The final resolved version detail
     * @throws {@link CorruptedVersionJsonError}
     * @throws {@link MissingVersionJsonError}
     * @throws {@link BadVersionJsonError}
     * @see {@link VersionParseError}
     */
    function parse(minecraftPath: MinecraftLocation, version: string, platofrm?: Platform): Promise<ResolvedVersion>;
    /**
     * Parse the server version from the Minecraft folder.
     *
     * This is non-standard version json format, only contains server related information.
     *
     * @param minecraftPath The path of the Minecraft folder
     * @param version The version id
     * @returns The resolved server version
     */
    function parseServer(minecraftPath: MinecraftLocation, version: string): Promise<ResolvedServerVersion>;
    /**
     * Resolve the given version hierarchy into `ResolvedVersion`.
     *
     * Some launcher has non-standard version json format to handle hierarchy,
     * and if you want to handle them, you can use this function to parse.
     *
     * @param minecraftPath The path of the Minecraft folder
     * @param hierarchy The version hierarchy, which can be produced by `normalizeVersionJson`
     * @throws {@link BadVersionJsonError}
     * @see {@link VersionParseError}
     * @see {@link normalizeVersionJson}
     * @see {@link parse}
     */
    function resolve(minecraftPath: MinecraftLocation, hierarchy: PartialResolvedVersion[]): ResolvedVersion;
    /**
     * Simply extends the version (actaully mixin)
     *
     * The result version will have the union of two version's libs. If one lib in two versions has different version, it will take the extra version one.
     * It will also mixin the launchArgument if it could.
     *
     * This function can be used for mixin forge and liteloader version.
     *
     * This function will throw an Error if two version have different assets. It doesn't care about the detail version though.
     *
     * @beta
     * @param id The new version id
     * @param parent The parent version will be inherited
     * @param version The version info which will overlap some parent information
     * @return The raw version json could be save to the version json file
     */
    function inherits(id: string, parent: Version, version: Version): Version;
    /**
     * Mixin the string arguments
     * @beta
     * @param hi Higher priority argument
     * @param lo Lower priority argument
     */
    function mixinArgumentString(hi: string, lo: string): string;
    /**
     * Resolve the dependencies of a minecraft version
     * @param path The path of minecraft
     * @param version The version id
     * @returns All the version required to run this version, including this version
     * @throws {@link CorruptedVersionJsonError}
     * @throws {@link MissingVersionJsonError}
     */
    function resolveDependency(path: MinecraftLocation, version: string, platform?: Platform): Promise<PartialResolvedVersion[]>;
    function resolveLibrary(lib: Library, platform?: Platform): ResolvedLibrary | undefined;
    /**
     * Resolve all these library and filter out os specific libs
     * @param libs All raw lib
     * @param platform The platform
     */
    function resolveLibraries(libs: Library[], platform?: Platform): ResolvedLibrary[];
    /**
     * Normalize a single version json.
     *
     * This function will force legacy version format into new format.
     * It will convert `minecraftArguments` into `arguments.game` and generate a default `arguments.jvm`
     *
     * This will pre-process the libraries according to the rules fields and current platform.
     * Non-matched libraries will be filtered out.
     *
     * This will also pre-process the jvm arguments according to the platform (os) info it provided.
     *
     * @param versionString The version json string
     * @param root The root of the version
     */
    function normalizeVersionJson(versionString: string, root: string, platform?: Platform): PartialResolvedVersion;
}
export interface JavaVersion {
    /**
     * Corresponding with java manifest json.
     * @example "jre-legacy"
     */
    component: string;
    majorVersion: number;
}
/**
 * The raw json format provided by Minecraft. Also the namespace of version operation.
 *
 * Use `parse` to parse a Minecraft version json on the disk, and see the detail info of the version.
 *
 * With `ResolvedVersion`, you can use the resolved version to launch the game.
 *
 * @see {@link Version.parse}
 * @see {@link launch}
 */
export interface Version {
    id: string;
    time: string;
    type: string;
    releaseTime: string;
    inheritsFrom?: string;
    minimumLauncherVersion: number;
    minecraftArguments?: string;
    arguments?: {
        game: Version.LaunchArgument[];
        jvm: Version.LaunchArgument[];
    };
    mainClass: string;
    libraries: Version.Library[];
    jar?: string;
    assetIndex?: Version.AssetIndex;
    assets?: string;
    downloads?: {
        client: Version.Download;
        server: Version.Download;
        [key: string]: Version.Download;
    };
    client?: string;
    server?: string;
    logging?: {
        [key: string]: {
            file: Version.Download;
            argument: string;
            type: string;
        };
    };
    javaVersion?: JavaVersion;
    /**
     * NON CONVERSION! This only present in some third party launcher like PCL to mark the real minecraft version
     */
    clientVersion?: string;
    /**
     * NON CONVERSION! This only present in some third party launcher like Labymod to mark the real minecraft version
     */
    _minecraftVersion?: string;
    /**
     * NON CONVERSION! This only present in some third party launcher like Forge to mark the forge version
     */
    _forgeVersion?: string;
    /**
     * NON CONVERSION! This only present in some third party launcher like Fabric to mark the fabric version
     */
    _fabricLoaderVersion?: string;
}
export {};
//# sourceMappingURL=version.d.ts.map