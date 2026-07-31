import { FetchOptions } from './utils.browser';
export interface ForgeVersionList {
    mcversion: string;
    versions: ForgeVersion[];
}
/**
 * The forge version metadata to download a forge
 */
export interface ForgeVersion {
    /**
     * The installer info
     */
    installer: {
        md5: string;
        sha1: string;
        /**
         * The url path to concat with forge maven
         */
        path: string;
    };
    universal: {
        md5: string;
        sha1: string;
        /**
         * The url path to concat with forge maven
         */
        path: string;
    };
    /**
     * The minecraft version
     */
    mcversion: string;
    /**
     * The forge version (without minecraft version)
     */
    version: string;
    type: 'buggy' | 'recommended' | 'common' | 'latest';
}
/**
 * The official Forge maven host.
 *
 * Forge moved off the legacy `http://files.minecraftforge.net/maven` host;
 * newer Minecraft versions (1.21+ etc.) only publish their installer jars
 * to `https://maven.minecraftforge.net`. The old URL continues to redirect
 * for archival files but does not serve recent releases.
 */
export declare const DEFAULT_FORGE_MAVEN = "https://maven.minecraftforge.net";
/**
 * Query the webpage content from files.minecraftforge.net.
 *
 * You can put the last query result to the fallback option. It will check if your old result is up-to-date.
 * It will request a new page only when the fallback option is outdated.
 *
 * @param option The option can control querying minecraft version, and page caching.
 */
export declare function getForgeVersionList(options?: FetchOptions & {
    /**
     * The minecraft version you are requesting
     */
    minecraft?: string;
}): Promise<ForgeVersionList>;
//# sourceMappingURL=forge.browser.d.ts.map