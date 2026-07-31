import { MinecraftLocation } from '@xmcl/core';
import { DownloadBaseOptions } from '@xmcl/file-transfer';
import { LabyModAddon, LabyModAddonIndex, LabyModManifest } from './labymod.browser';
import { Tracker, WithDownload } from './tracker';
import { InstallOptions } from './utils';
import { FetchOptions } from './utils.browser';
export interface LabyModTrackerEvents {
    labymod: {
        version: string;
        tag: string;
    };
    'labymod.json': {
        version: string;
        tag: string;
    };
    'labymod.assets': WithDownload<{
        count: number;
    }>;
    'labymod.addon': WithDownload<{
        namespace: string;
        name: string;
    }>;
}
export interface InstallLabyModOptions extends DownloadBaseOptions, InstallOptions, FetchOptions {
    environment?: string;
    /**
     * The tracker to track the install process
     */
    tracker?: Tracker<LabyModTrackerEvents>;
    /**
     * Custom checksum function for file validation
     */
    checksum?: (file: string, algorithm: string) => Promise<string>;
}
export interface InstallLabyModAddonOptions extends DownloadBaseOptions, FetchOptions {
    environment?: string;
    /**
     * Whether to install addon dependencies automatically
     * @default true
     */
    installDependencies?: boolean;
    /**
     * The tracker to track the install process
     */
    tracker?: Tracker<LabyModTrackerEvents>;
    /**
     * Custom checksum function for file validation
     */
    checksum?: (file: string, algorithm: string) => Promise<string>;
}
export declare function installLabyMod4(manifest: LabyModManifest, tag: string, minecraft: MinecraftLocation, options?: InstallLabyModOptions): Promise<string>;
/**
 * Install a LabyMod addon by namespace (like 'labyfabric' for Fabric Loader)
 *
 * @param namespace The addon namespace
 * @param minecraft The Minecraft location
 * @param options Installation options
 * @returns Promise that resolves to the installed addon file path
 */
export declare function installLabyModAddon(namespace: string, minecraft: MinecraftLocation, options?: InstallLabyModAddonOptions): Promise<string>;
/**
 * Install Fabric Loader addon for LabyMod 4
 *
 * This installs the labyfabric addon which allows running Fabric mods within LabyMod.
 * It will also install required dependencies like modcompat.
 *
 * @param minecraft The Minecraft location
 * @param options Installation options
 * @returns Promise that resolves to the installed addon file path
 */
export declare function installLabyModFabricAddon(minecraft: MinecraftLocation, options?: InstallLabyModAddonOptions): Promise<string>;
/**
 * Install Forge Loader addon for LabyMod 4
 *
 * This installs the labyforge addon which allows running Forge mods within LabyMod.
 * Note: Forge Loader only supports Minecraft 1.8.9.
 * It will also install required dependencies like modcompat.
 *
 * @param minecraft The Minecraft location
 * @param options Installation options
 * @returns Promise that resolves to the installed addon file path
 */
export declare function installLabyModForgeAddon(minecraft: MinecraftLocation, options?: InstallLabyModAddonOptions): Promise<string>;
/**
 * Check if a LabyMod addon supports a specific Minecraft version
 *
 * @param addon The addon to check
 * @param minecraftVersion The Minecraft version to check (e.g., '1.20.1', '1.21')
 * @returns true if the addon supports the version, false otherwise
 */
export declare function isLabyModAddonCompatible(addon: LabyModAddon | LabyModAddonIndex, minecraftVersion: string): boolean;
//# sourceMappingURL=labymod.d.ts.map