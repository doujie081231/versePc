import { MinecraftLocation, ResolvedVersion } from '@xmcl/core';
import { DownloadBaseOptions } from '@xmcl/file-transfer';
import { MinecraftVersionBaseInfo } from './minecraft.browser';
import { Tracker, WithDownload } from './tracker';
import { WithDiagnose } from './utils';
export interface MinecraftTrackerEvents {
    'version.json': WithDownload<{
        id: string;
        url: string;
    }>;
    'version.jar': WithDownload<{
        id: string;
        side: 'client' | 'server';
        size: number;
        sha1?: string;
    }>;
}
export { DEFAULT_VERSION_MANIFEST_URL, getVersionList } from './minecraft.browser';
export type { MinecraftVersion, MinecraftVersionBaseInfo, MinecraftVersionList } from './minecraft.browser';
/**
 * Replace the minecraft client or server jar download
 */
export interface JarOption extends DownloadBaseOptions, InstallSideOption, WithDiagnose {
    /**
     * Whether to install the Minecraft jar after resolving the version JSON.
     * @default true
     */
    installJar?: boolean;
    /**
     * The version json url replacement
     */
    json?: string | string[] | ((version: MinecraftVersionBaseInfo) => string | string[]);
    /**
     * The client jar url replacement
     */
    client?: string | string[] | ((version: ResolvedVersion) => string | string[]);
    /**
     * The server jar url replacement
     */
    server?: string | string[] | ((version: ResolvedVersion) => string | string[]);
    /**
     * The tracker to track the install process
     */
    tracker?: Tracker<MinecraftTrackerEvents>;
    /**
     * Custom checksum function for file validation
     */
    checksum?: (file: string, algorithm: string) => Promise<string>;
    signal?: AbortSignal;
}
export interface InstallSideOption {
    /**
     * The installation side
     */
    side?: 'client' | 'server';
}
export declare function installMinecraftJar(version: ResolvedVersion, options?: JarOption): Promise<void>;
/**
 * Only install the json/jar. Do not install dependencies.
 *
 * @param versionMeta the version metadata; get from updateVersionMeta
 * @param minecraft minecraft location
 */
export declare function installMinecraft(versionMeta: MinecraftVersionBaseInfo, minecraft: MinecraftLocation, options?: JarOption): Promise<ResolvedVersion>;
//# sourceMappingURL=minecraft.d.ts.map