import { MinecraftLocation } from '@xmcl/core';
import { InstallOptions } from './utils';
import { FetchOptions } from './utils.browser';
export { DEFAULT_META_URL_QUILT, getQuiltGames, getQuiltLoaders, getQuiltLoaderVersionsByMinecraft, } from './quilt.browser';
export type { GetQuiltOptions, QuiltLoaderArtifact } from './quilt.browser';
export interface InstallQuiltVersionOptions extends FetchOptions, InstallOptions {
    minecraftVersion: string;
    version: string;
    minecraft: MinecraftLocation;
    side?: 'client' | 'server';
}
/**
 * Install quilt version via profile API
 */
export declare function installQuiltVersion(options: InstallQuiltVersionOptions): Promise<string>;
//# sourceMappingURL=quilt.d.ts.map