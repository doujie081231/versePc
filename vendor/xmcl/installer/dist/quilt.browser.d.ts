import { FabricArtifactVersion, FabricLoaderArtifact } from './fabric.browser';
import { FetchOptions } from './utils.browser';
export declare const DEFAULT_META_URL_QUILT = "https://meta.quiltmc.org";
export interface GetQuiltOptions extends FetchOptions {
    minecraftVersion: string;
}
export interface QuiltLoaderArtifact extends FabricLoaderArtifact {
    hashed: FabricLoaderArtifact['intermediary'];
}
/**
 * Get supported quilt game versions
 */
export declare function getQuiltGames(options?: FetchOptions): Promise<string[]>;
/**
 * Get quilt-loader artifact list
 */
export declare function getQuiltLoaders(options?: FetchOptions): Promise<FabricArtifactVersion[]>;
/**
 * Get quilt loader versions list for a specific minecraft version
 */
export declare function getQuiltLoaderVersionsByMinecraft(options: GetQuiltOptions): Promise<QuiltLoaderArtifact[]>;
//# sourceMappingURL=quilt.browser.d.ts.map