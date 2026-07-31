import { MinecraftFolder, ResolvedVersion } from '@xmcl/core';
import { DownloadBaseOptions } from '@xmcl/file-transfer';
import { Issue } from './diagnose';
import { Tracker, WithDownload } from './tracker';
import { WithDiagnose } from './utils';
export interface AssetsTrackerEvents {
    'assets.assets': WithDownload<{
        count: number;
    }>;
    'assets.logConfig': WithDownload<{
        url: string | string[];
    }>;
    'assets.assetIndex': WithDownload<{
        url: string | string[];
    }>;
}
export interface AssetInfo {
    name: string;
    hash: string;
    size: number;
}
/**
 * Default resource/assets url root
 */
export declare const DEFAULT_RESOURCE_ROOT_URL = "https://resources.download.minecraft.net";
/**
 * Change the host url of assets download
 */
export interface AssetsOptions extends DownloadBaseOptions, WithDiagnose {
    /**
     * The alternative assets host to download asset. It will try to use these host from the `[0]` to the `[assetsHost.length - 1]`
     */
    assetsHost?: string | string[];
    /**
     * Use hash as the assets index file name. Default is `false`
     */
    useHashForAssetsIndex?: boolean;
    /**
     * The assets index download or url replacement
     */
    assetsIndexUrl?: string | string[] | ((version: ResolvedVersion) => string | string[]);
    /**
     * The fetch implementation to use. Default is the global fetch
     */
    fetch?: typeof fetch;
    /**
     * The tracker to track the install process
     */
    tracker?: Tracker<AssetsTrackerEvents>;
    /**
     * Custom checksum function for file validation
     */
    checksum?: (file: string, algorithm: string) => Promise<string>;
    strict?: boolean;
    abortSignal?: AbortSignal;
}
/**
 * Install or check the assets to resolved version
 *
 * @param version The target version
 * @param options The option to replace assets host url
 */
export declare function installAssets(version: ResolvedVersion, options?: AssetsOptions): Promise<ResolvedVersion>;
/**
 * The asset issue represents a corrupted or missing minecraft asset file.
 * You can use `Installer.installResolvedAssets` to fix this.
 */
export interface AssetIssue extends Issue {
    role: 'asset';
    /**
     * The problematic asset
     */
    asset: {
        name: string;
        hash: string;
        size: number;
    };
}
/**
 * Only install several resolved assets.
 * @param assets The assets to install
 * @param folder The minecraft folder
 * @param version The version string for tracking
 * @param options The asset option
 */
export declare function installResolvedAssets(assets: AssetInfo[], folder: MinecraftFolder, version: string, options?: AssetsOptions): Promise<void>;
//# sourceMappingURL=assets.d.ts.map