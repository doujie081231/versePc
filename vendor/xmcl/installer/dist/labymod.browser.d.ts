import { FetchOptions } from './utils.browser';
export interface LabyModManifest {
    labyModVersion: string;
    commitReference: string;
    sha1: string;
    releaseTime: number;
    size: number;
    assets: {
        shader: string;
        common: string;
        fonts: string;
        'vanilla-theme': string;
        'fancy-theme': string;
        i18n: string;
    };
    minecraftVersions: MinecraftVersion[];
}
interface MinecraftVersion {
    tag: string;
    version: string;
    index: number;
    type: string;
    runtime: {
        name: string;
        version: number;
    };
    customManifestUrl: string;
}
/**
 * Information about a LabyMod addon from the Flint store
 */
export interface LabyModAddon {
    id: number;
    namespace: string;
    name: string;
    featured: boolean;
    verified: boolean;
    organization: number;
    author: string;
    downloads: number;
    download_string: string;
    short_description: string;
    rating: {
        count: number;
        rating: number;
    };
    changelog: string;
    required_labymod_build: number;
    releases: number;
    last_update: number;
    licence: string;
    version_string: string;
    meta: string[];
    dependencies: Array<{
        namespace: string;
        optional: boolean;
    }>;
    permissions: string[];
    file_hash: string;
    source_url?: string;
    brand_images: Array<{
        type: string;
        hash: string;
    }>;
}
/**
 * Information about a LabyMod addon from the index
 */
export interface LabyModAddonIndex {
    name: string;
    namespace: string;
    short_description: string;
    author: string;
    organization_name: string;
    ranking: number;
    tags: number[];
    rating: {
        count: number;
        rating: number;
    };
    version_string: string;
    meta: string[];
    dependencies: Array<{
        namespace: string;
        optional: boolean;
    }>;
    required_labymod_build: number;
    icon_hash: string;
    thumbnail_hash: string;
    file_hash: string;
}
export declare function getLabyModManifest(env?: string, options?: FetchOptions): Promise<LabyModManifest>;
/**
 * Get the LabyMod addon index from Flint store
 * @param env The environment (production, beta, etc.)
 * @param options Request options
 * @returns List of all available addons
 */
export declare function getLabyModAddonIndex(env?: string, options?: FetchOptions): Promise<LabyModAddonIndex[]>;
/**
 * Get detailed information about a specific LabyMod addon
 * @param namespace The addon namespace (e.g., 'labyfabric', 'modcompat')
 * @param env The environment (production, beta, etc.)
 * @param options Request options
 * @returns Detailed addon information
 */
export declare function getLabyModAddon(namespace: string, env?: string, options?: FetchOptions): Promise<LabyModAddon>;
export {};
//# sourceMappingURL=labymod.browser.d.ts.map