import { MinecraftFolder, MinecraftLocation, Version, Version as VersionJson } from '@xmcl/core';
import { Issue } from './diagnose';
import { LibrariesTrackerEvents, LibraryOptions } from './libraries';
import { InstallSideOption } from './minecraft';
import { Tracker } from './tracker';
import { SpawnJavaOptions, WithDiagnose } from './utils';
export interface ProfileTrackerEvents {
    postprocess: {
        count: number;
    };
}
export interface PostProcessor {
    /**
     * The executable jar path
     */
    jar: string;
    /**
     * The classpath to run
     */
    classpath: string[];
    args: string[];
    outputs?: {
        [key: string]: string;
    };
    sides?: Array<'client' | 'server'>;
}
export interface InstallProfile {
    spec?: number;
    /**
     * The type of this installation, like "forge"
     */
    profile: string;
    /**
     * The version of this installation
     */
    version: string;
    /**
     * The version json path
     */
    json: string;
    /**
     * The maven artifact name: `<org>:<artifact-id>:<version>`
     */
    path: string;
    /**
     * The minecraft version
     */
    minecraft: string;
    /**
     * The processor shared variables. The key is the name of variable to replace.
     *
     * The value of client/server is the value of the variable.
     */
    data?: {
        [key: string]: {
            client: string;
            server: string;
        };
    };
    /**
     * The post processor. Which require java to run.
     */
    processors?: Array<PostProcessor>;
    /**
     * The required install profile libraries
     */
    libraries: VersionJson.NormalLibrary[];
    /**
     * Legacy format
     */
    versionInfo?: VersionJson;
}
export interface PostProcessOptions extends SpawnJavaOptions, WithDiagnose {
    /**
     * Custom handlers to handle the post processor
     */
    handler?: (postProcessor: PostProcessor) => Promise<boolean>;
    postprocess?: (processor: PostProcessor[], minecraftFolder: MinecraftFolder, options: PostProcessOptions, postprocess: () => Promise<void>) => Promise<void>;
    tracker?: Tracker<ProfileTrackerEvents>;
    /**
     * Custom checksum function for file validation
     */
    checksum?: (file: string, algorithm: string) => Promise<string>;
    signal?: AbortSignal;
}
export interface InstallProfileOption extends Omit<LibraryOptions, 'tracker'>, InstallSideOption, PostProcessOptions {
    /**
     * New forge (>=1.13) require java to install. Can be a executor or java executable path.
     */
    java?: string;
    /**
     * The tracker to track the install process
     */
    tracker?: Tracker<LibrariesTrackerEvents & ProfileTrackerEvents>;
}
/**
 * Diagnose a install profile status. Check if it processor output correctly processed.
 *
 * This can be used for check if forge correctly installed when minecraft >= 1.13
 * @beta
 *
 * @param installProfile The install profile.
 * @param minecraftLocation The minecraft location
 */
export declare function diagnoseProfile(installProfile: InstallProfile, minecraftLocation: MinecraftLocation, side?: 'client' | 'server'): Promise<boolean>;
/**
 * Resolve processors in install profile
 */
export declare function resolveProcessors(side: 'client' | 'server', installProfile: InstallProfile, minecraft: MinecraftFolder): {
    args: string[];
    outputs: {
        [x: string]: string;
    };
    /**
     * The executable jar path
     */
    jar: string;
    /**
     * The classpath to run
     */
    classpath: string[];
    sides?: Array<"client" | "server">;
}[];
/**
 * Install by install profile. The install profile usually contains some preprocess should run before installing dependencies.
 *
 * @param installProfile The install profile
 * @param minecraft The minecraft location
 * @param options The options to install
 * @throws {@link PostProcessError}
 */
export declare function installByProfile(installProfile: InstallProfile, minecraft: MinecraftLocation, options?: InstallProfileOption): Promise<void>;
/**
 * Convert a single `-classpath` entry of a forge/neoforge server args file
 * (a path relative to the minecraft root, e.g.
 * `libraries/io/netty/netty-transport-native-epoll/4.2.7.Final/netty-transport-native-epoll-4.2.7.Final-linux-x86_64.jar`)
 * into its maven coordinate (`io.netty:netty-transport-native-epoll:4.2.7.Final:linux-x86_64`).
 *
 * Unlike {@link convertClasspathToMaven}, the FULL classifier is preserved
 * (that helper keeps only the first `-`-separated segment, which would turn
 * `linux-x86_64` into `linux` and point at a non-existent jar).
 *
 * @returns The maven coordinate, or `undefined` if the path is not a
 * well-formed `libraries/<group>/<artifact>/<version>/<file>.jar` entry.
 */
export declare function classpathEntryToLibraryName(entry: string): string | undefined;
/**
 * Parse a forge server `win_args.txt` / `unix_args.txt` file.
 *
 * The file has the shape `[jvm options...] (-jar <jar> | <main-class>) [game
 * args...]`. The jvm options are collected verbatim, the terminator is either a
 * `-jar <jar>` pair or a bare main-class token, and everything after it is a
 * game argument.
 *
 * @returns The executable jar path (when the file uses `-jar`), otherwise
 * `undefined` (the main class is written onto `serverProfile`).
 */
export declare function parseArgumentsFromArgsFile(content: string, parentDir: string, serverProfile: Version): string | undefined;
export declare class PostProcessBadJarError extends Error {
    jarPath: string;
    causeBy: Error;
    constructor(jarPath: string, causeBy: Error);
    name: string;
}
export declare class PostProcessNoMainClassError extends Error {
    jarPath: string;
    constructor(jarPath: string);
    name: string;
}
export declare class PostProcessFailedError extends Error {
    readonly jarPath: string;
    readonly commands: string[];
    readonly processor: string;
    readonly exitCode?: number | null;
    readonly processSignal?: string | null;
    readonly processorOutput?: string;
    constructor(jarPath: string, commands: string[], message: string, options?: {
        exitCode?: number | null;
        signal?: string | null;
        output?: string;
    });
    name: string;
}
export declare class PostProcessValidationFailedError extends PostProcessFailedError {
    readonly file: string;
    readonly expect: string;
    readonly actual: string;
    constructor(jarPath: string, commands: string[], message: string, file: string, expect: string, actual: string);
    name: string;
}
/**
 * Diagnose every declared output of the given processors. Returns the list of
 * issues found (empty when all outputs are valid).
 */
export declare function diagnoseProcessorOutputs(processors: PostProcessor[], options?: {
    signal?: AbortSignal;
    checksum?: (file: string, algorithm: string) => Promise<string>;
}): Promise<Issue[]>;
//# sourceMappingURL=profile.d.ts.map