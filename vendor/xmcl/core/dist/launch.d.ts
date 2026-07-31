import { ChildProcess, SpawnOptions } from 'child_process';
import { EventEmitter } from 'events';
import { MinecraftFolder } from './folder';
import { Platform } from './platform';
import { ResolvedLibrary, ResolvedVersion } from './version';
export declare const DEFAULT_EXTRA_JVM_ARGS: readonly string[];
export interface EnabledFeatures {
    [featureName: string]: object | boolean | undefined;
    has_custom_resolution?: {
        resolution_width: string;
        resolution_height: string;
    };
    is_demo_user?: boolean;
}
/**
 * General launch option, used to generate launch arguments.
 * @see {@link generateArguments}
 * @see {@link launch}
 */
export interface LaunchOption {
    /**
     * User selected game profile. For game display name &
     */
    gameProfile?: {
        name: string;
        id: string;
    };
    accessToken?: string;
    userType?: 'mojang' | 'legacy';
    properties?: object;
    launcherName?: string;
    launcherBrand?: string;
    /**
     * Overwrite the version name of the current version.
     * If this is absent, it will use version name from resolved version.
     */
    versionName?: string;
    /**
     * Overwrite the version type of the current version.
     * If this is absent, it will use version type from resolved version.
     *
     * Some people use this to show fantastic message on the welcome screen.
     */
    versionType?: string;
    /**
     * The full path of launched game icon
     * Currently, this only supported on MacOS
     */
    gameIcon?: string;
    /**
     * The launched game name
     * Currently, this only supported on MacOS
     */
    gameName?: string;
    /**
     * The path of parent directory of saves/logs/configs/mods/resourcepacks
     */
    gamePath: string;
    /**
     * The path of parent directory of assets/libraries
     */
    resourcePath?: string;
    /**
     * The java executable file path. (Not the java home directory!)
     */
    javaPath: string;
    /**
     * Min memory, this will add a jvm flag -Xms to the command result
     */
    minMemory?: number;
    /**
     * Min memory, this will add a jvm flag -Xmx to the command result
     */
    maxMemory?: number;
    /**
     * The version of launched Minecraft. Can be either resolved version or version string
     */
    version: string | ResolvedVersion;
    /**
     * Directly launch to a server
     */
    server?: {
        ip: string;
        port?: number;
    };
    /**
     * Directly launch to a server using quickPlayMultiplayer option (for newer Minecraft versions)
     * This will use --quickPlayMultiplayer instead of --server and --port
     */
    quickPlayMultiplayer?: string;
    /**
     * Directly launch into a single player world (for newer Minecraft versions)
     * The value is the save folder name (the directory name under `saves/`).
     * This will use --quickPlaySingleplayer.
     */
    quickPlaySingleplayer?: string;
    /**
     * Resolution. This will add --height & --width or --fullscreen to the java arguments
     */
    resolution?: {
        width?: number;
        height?: number;
        fullscreen?: boolean;
    };
    /**
     * Extra jvm options. This will append after to generated options.
     * If this is empty, the `DEFAULT_EXTRA_JVM_ARGS` will be used.
     */
    extraJVMArgs?: string[];
    /**
     * Extra program arguments. This will append after to generated options.
     */
    extraMCArgs?: string[];
    /**
     * Prepend command before java command.
     */
    prependCommand?: string | string[];
    /**
     * Assign the spawn options to the process.
     *
     * If you try to set `{ shell: true }`, you might want to make all argument rounded with "".
     * The `launch` function will do it for you, but if you want to spawn process by yourself, remember to do that.
     */
    extraExecOption?: SpawnOptions;
    /**
     * Native directory. It's .minecraft/versions/<version>/<version>-natives by default.
     * You can replace this by your self.
     */
    nativeRoot?: string;
    /**
     * Enable features. Not really in used...
     */
    features?: EnabledFeatures;
    /**
     * Support yushi's yggdrasil agent https://github.com/to2mbn/authlib-injector/wiki
     */
    yggdrasilAgent?: {
        /**
         * The jar file path of the authlib-injector
         */
        jar: string;
        /**
         * The auth server host
         */
        server: string;
        /**
         * The prefetched base64
         */
        prefetched?: string;
    };
    /**
     * Add `-Dfml.ignoreInvalidMinecraftCertificates=true` to jvm argument
     */
    ignoreInvalidMinecraftCertificates?: boolean;
    /**
     * Add `-Dfml.ignorePatchDiscrepancies=true` to jvm argument
     */
    ignorePatchDiscrepancies?: boolean;
    /**
     * Add extra classpaths
     */
    extraClassPaths?: string[];
    /**
     * The platform of this launch will run. By default, it will fetch the current machine info if this is absent.
     */
    platform?: Platform;
    /**
     * Use hash assets index. This will use the assets index hash as the assets index name.
     */
    useHashAssetsIndex?: boolean;
    /**
     * The launcher precheck functions. These will run before it run.
     *
     * This property is only used for `launch` function. The `generateArguments` function won't use this!
     * @see {@link launch}
     * @see {@link generateArguments}
     */
    prechecks?: LaunchPrecheck[];
    /**
     * Demo mode.
     */
    demo?: boolean;
    /**
     * The spawn process function. Used for spawn the java process at the end.
     *
     * By default, it will be the spawn function from "child_process" module. You can use this option to change the 3rd party spawn like [cross-spawn](https://www.npmjs.com/package/cross-spawn)
     */
    spawn?: (command: string, args?: ReadonlyArray<string>, options?: SpawnOptions) => ChildProcess;
}
/**
 * The function to check the game status before the game launched. Will be used in `launch` function.
 * @see {@link launch}
 */
export interface LaunchPrecheck {
    (resourcePath: MinecraftFolder, version: ResolvedVersion, option: LaunchOption): Promise<void>;
}
/**
 * Thrown when the version jar is corrupted. This interface only used in `LaunchPrecheck.checkVersion`
 * @see {@link LaunchPrecheck.checkVersion}
 */
export interface CorruptedVersionJarError {
    error: 'CorruptedVersionJar';
    version: string;
}
/**
 * Thrown when the libraries jar is corrupted. This interface only used in `LaunchPrecheck.checkLibraries`
 * @see {@link LaunchPrecheck.checkLibraries}
 */
export interface MissingLibrariesError {
    error: 'MissingLibraries';
    libraries: ResolvedLibrary[];
    version: ResolvedVersion;
}
export declare namespace LaunchPrecheck {
    /**
     * The default launch precheck. It will check version jar, libraries and natives.
     */
    const DEFAULT_PRECHECKS: readonly LaunchPrecheck[];
    /**
     * @deprecated
     */
    const Default: readonly LaunchPrecheck[];
    /**
     * Link assets to the assets/virtual/legacy.
     */
    function linkAssets(resource: MinecraftFolder, version: ResolvedVersion, option: LaunchOption): Promise<void>;
    /**
     * Quick check if Minecraft version jar is corrupted
     * @throws {@link CorruptedVersionJarError}
     */
    function checkVersion(resource: MinecraftFolder, version: ResolvedVersion, option: LaunchOption): Promise<void>;
    /**
     * Quick check if there are missed libraries.
     * @throws {@link MissingLibrariesError}
     */
    function checkLibraries(resource: MinecraftFolder, version: ResolvedVersion, option: LaunchOption): Promise<void>;
    /**
     * Ensure the native are correctly extracted in place.
     *
     * It will check native root located in {@link LaunchOption.nativeRoot} if it's presented.
     * Or, it will use the `<version-id>-native` under version folder as native root to check.
     *
     * This will automatically extract native if there is not native extracted.
     *
     * @param resource The minecraft directory to extract native
     * @param option If the native root presented here, it will use the root here.
     */
    function checkNatives(resource: MinecraftFolder, version: ResolvedVersion, option: LaunchOption): Promise<void>;
}
export interface BaseServerOptions {
    /**
     * Java executable.
     */
    javaPath: string;
    /**
     * No gui for the server launch
     */
    nogui?: boolean;
    minMemory?: number;
    maxMemory?: number;
    extraJVMArgs?: string[];
    extraMCArgs?: string[];
    extraExecOption?: SpawnOptions;
    prependCommand?: string | string[];
    /**
     * The spawn process function. Used for spawn the java process at the end. By default, it will be the spawn function from "child_process" module. You can use this option to change the 3rd party spawn like [cross-spawn](https://www.npmjs.com/package/cross-spawn)
     */
    spawn?: (command: string, args?: ReadonlyArray<string>, options?: SpawnOptions) => ChildProcess;
}
/**
 * This is the case you provide the server jar execution path.
 */
export interface ServerOptions extends BaseServerOptions {
    /**
     * The minecraft server exectuable jar file.
     *
     * This is the case like you are launching forge server.
     */
    serverExectuableJarPath?: string;
    mainClass?: string;
    classPath?: string[];
}
export declare function launchServer(options: ServerOptions): Promise<ChildProcess>;
/**
 * The Minecraft process watcher. You can inspect Minecraft launch state by this.
 *
 * Generally, there are several cases after you call `launch` and get `ChildProcess` object
 *
 * 1. child process fire an error, no real process start.
 * 2. child process started, but game crash (code is not 0).
 * 3. cihld process started, game normally exit (code is 0).
 */
export interface MinecraftProcessWatcher extends EventEmitter {
    /**
     * Fire when the process DOESN'T start at all, like "java not found".
     *
     * The minecraft-kill or minecraft-exit will NOT fire after this fired.
     */
    on(event: 'error', listener: (error: any) => void): this;
    /**
     * Fire after Minecraft process exit.
     */
    on(event: 'minecraft-exit', listener: (event: {
        /**
         * The code of the process exit. This is the nodejs child process "exit" event arg.
         */
        code: number;
        /**
         * The signal of the process exit. This is the nodejs child process "exit" event arg.
         */
        signal: string;
        /**
         * The crash report content
         */
        crashReport: string;
        /**
         * The location of the crash report
         */
        crashReportLocation: string;
    }) => void): this;
    /**
     * Fire around the time when Minecraft window appeared in screen.
     *
     * Since the Minecraft window will take time to init, this event fire when it capture some keywords from stdout.
     */
    on(event: 'minecraft-window-ready', listener: () => void): this;
}
/**
 * Create a process watcher for a minecraft process.
 *
 * It will watch the stdout and the error event of the process to detect error and minecraft state.
 * @param process The Minecraft process
 * @param emitter The event emitter which will emit usefule event
 */
export declare function createMinecraftProcessWatcher(process: ChildProcess, emitter?: EventEmitter): MinecraftProcessWatcher;
/**
 * Launch the minecraft as a child process. This function use spawn to create child process. To use an alternative way, see function generateArguments.
 *
 * By default, it will use the `LauncherPrecheck.Default` to pre-check:
 * - It will also check if the runtime libs are completed, and will extract native libs if needed.
 * - It might throw exception when the version jar is missing/checksum not matched.
 * - It might throw if the libraries/natives are missing.
 *
 * If you DON'T want such precheck, and you want to change it. You can assign the `prechecks` property in launch
 *
 * ```ts
 * launch({ ...otherOptions, prechecks: yourPrechecks });
 * ```
 *
 * @param options The detail options for this launching.
 * @see [ChildProcess](https://nodejs.org/api/child_process.html)
 * @see [spawn](https://nodejs.org/api/spawn.html)
 * @see {@link generateArguments}
 * @see {@link createMinecraftProcessWatcher}
 * @throws {@link CorruptedVersionJarError}
 * @throws {@link MissingLibrariesError}
 */
export declare function launch(options: LaunchOption): Promise<ChildProcess>;
/**
 * Generate the argument for server
 */
export declare function generateArgumentsServer(options: ServerOptions, _delimiter?: string, _sep?: string): string[];
/**
 * Generate the arguments array by options. This function is useful if you want to launch the process by yourself.
 *
 * This function will **NOT** check if the runtime libs are completed, and **WONT'T** check or extract native libs.
 *
 * If you want to ensure native. Please see {@link LaunchPrecheck.checkNatives}.
 *
 * @param options The launch options.
 * @throws TypeError if options does not fully fulfill the requirement
 */
export declare function generateArguments(options: LaunchOption): Promise<string[]>;
/**
 * Create a quickPlayMultiplayer string from server IP and optional port
 * @param ip The server IP address
 * @param port The server port (optional, defaults to 25565 if not specified)
 * @returns A formatted string for quickPlayMultiplayer option
 */
export declare function createQuickPlayMultiplayer(ip: string, port?: number): string;
//# sourceMappingURL=launch.d.ts.map