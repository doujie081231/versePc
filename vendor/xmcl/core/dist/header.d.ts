import { LibraryInfo, ResolvedVersion } from './version';
export interface VersionHeader {
    path: string;
    id: string;
    inheritances: string[];
    /**
     * Minecraft version of this version. e.g. 1.7.10
     * @default ""
     */
    minecraft: string;
    /**
     * Forge version of this version. e.g. 14.23.5.2838
     * @default ""
     */
    forge: string;
    /**
     * Fabric loader version, e.g. 0.7.2+build.175
     * @default ""
     */
    fabric: string;
    /**
     * Optifine version e.g. HD_U_F1_pre6 or HD_U_E6
     * @default ""
     */
    optifine: string;
    /**
     * Neoforge version of this version. e.g. 47.0.1
     */
    neoforge: string;
    /**
     * Quilt loader version, e.g. 0.17.5
     */
    quilt: string;
    labyMod: string;
}
export declare function findNeoforgeVersion(minecraft: string, resolvedVersion: {
    libraries: LibraryInfo[];
    arguments: ResolvedVersion['arguments'];
}): string;
export declare function parseForgeVersion(forgeVersion: string): string;
export declare function parseOptifineVersion(optifineVersion: string): string;
export declare function isForgeLibrary(lib: LibraryInfo): boolean;
export declare function isFabricLoaderLibrary(lib: LibraryInfo): boolean;
export declare function isOptifineLibrary(lib: LibraryInfo): boolean;
export declare function isQuiltLibrary(lib: LibraryInfo): boolean;
export declare function findLabyModVersion(resolvedVersion: ResolvedVersion): string;
export declare function getResolvedVersionHeader(ver: ResolvedVersion): VersionHeader;
export declare function isSameForgeVersion(forgeVersion: string, version: string, minecraft: string): boolean;
export interface VersionDirective {
    minecraft: string;
    forge?: string;
    neoforge?: string;
    fabric?: string;
    optifine?: string;
    quilt?: string;
    labyMod?: string;
}
export declare function matchVersion(versions: VersionHeader[], id: string, runtime: VersionDirective): VersionHeader | undefined;
//# sourceMappingURL=header.d.ts.map