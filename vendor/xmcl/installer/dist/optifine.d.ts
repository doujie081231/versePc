import { MinecraftLocation, Version } from '@xmcl/core';
import { Tracker, WithProgress } from './tracker';
import { InstallOptions, SpawnJavaOptions } from './utils';
export interface OptifineTrackerEvents {
    'optifine.unpack': WithProgress<{
        version: string;
        path: string;
        minecraft: string;
    }>;
}
export interface InstallOptifineOptions extends InstallOptions, SpawnJavaOptions {
    /**
     * Use "optifine.OptiFineForgeTweaker" instead of "optifine.OptiFineTweaker" for tweakClass.
     *
     * If you want to install upon forge, you should use this.
     */
    useForgeTweaker?: boolean;
    /**
     * The tracker to track the install process
     */
    tracker?: Tracker<OptifineTrackerEvents>;
    signal?: AbortSignal;
}
/**
 * Generate the optifine version json from provided info.
 * @param editionRelease The edition + release with _
 * @param minecraftVersion The minecraft version
 * @param launchWrapperVersion The launch wrapper version
 * @param options The install options
 * @beta Might be changed and don't break the major version
 */
export declare function generateOptifineVersion(editionRelease: string, minecraftVersion: string, launchWrapperVersion?: string, options?: InstallOptifineOptions): Version;
/**
 * Install optifine by optifine installer
 *
 * @param installer The installer jar file path
 * @param minecraft The minecraft location
 * @param options The option to install
 * @beta Might be changed and don't break the major version
 * @throws {@link BadOptifineJarError}
 */
export declare function installOptifine(installer: string, minecraft: MinecraftLocation, options?: InstallOptifineOptions): Promise<string>;
export declare class BadOptifineJarError extends Error {
    optifine: string;
    /**
     * What entry in jar is missing
     */
    entry: string;
    constructor(optifine: string, 
    /**
     * What entry in jar is missing
     */
    entry: string);
    error: string;
}
//# sourceMappingURL=optifine.d.ts.map