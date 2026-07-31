import { FetchOptions } from './utils.browser';
export declare const DEFAULT_META_URL_FABRIC = "https://meta.fabricmc.net";
export interface FabricArtifactVersion {
    gameVersion?: string;
    separator?: string;
    build?: number;
    maven: string;
    version: string;
    stable: boolean;
}
export interface FabricArtifacts {
    mappings: FabricArtifactVersion[];
    loader: FabricArtifactVersion[];
}
export interface FabricLoaderArtifact {
    loader: FabricArtifactVersion;
    intermediary: FabricArtifactVersion;
    launcherMeta: {
        version: number;
        libraries: {
            client: {
                name: string;
                url: string;
            }[];
            common: {
                name: string;
                url: string;
            }[];
            server: {
                name: string;
                url: string;
            }[];
        };
        mainClass: {
            client: string;
            server: string;
        };
    };
}
/**
 * Get supported fabric game versions
 */
export declare function getFabricGames(options?: FetchOptions): Promise<string[]>;
/**
 * Get fabric-loader artifact list
 */
export declare function getFabricLoaders(options?: FetchOptions): Promise<FabricArtifactVersion[]>;
/**
 * Get fabric-loader artifact list by Minecraft version
 * @param minecraft The minecraft version
 */
export declare function getLoaderArtifactListFor(minecraft: string, options?: FetchOptions): Promise<FabricLoaderArtifact[]>;
/**
 * Get fabric-loader artifact list by Minecraft version
 * @param minecraft The minecraft version
 * @param loader The yarn-loader version
 */
export declare function getFabricLoaderArtifact(minecraft: string, loader: string, options?: FetchOptions): Promise<FabricLoaderArtifact>;
//# sourceMappingURL=fabric.browser.d.ts.map