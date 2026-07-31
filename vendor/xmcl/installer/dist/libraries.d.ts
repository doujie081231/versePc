import { MinecraftFolder, MinecraftLocation, ResolvedLibrary, ResolvedVersion } from '@xmcl/core';
import { DownloadBaseOptions } from '@xmcl/file-transfer';
import { Tracker, WithDownload } from './tracker';
import { WithDiagnose } from './utils';
export interface LibrariesTrackerEvents {
    libraries: WithDownload<{
        count: number;
    }>;
}
/**
 * The function to swap library host.
 */
export type LibraryHost = (library: ResolvedLibrary) => string | string[] | undefined;
/**
 * Change the library host url
 */
export interface LibraryOptions extends DownloadBaseOptions, WithDiagnose {
    /**
     * A more flexiable way to control library download url.
     * @see mavenHost
     */
    libraryHost?: LibraryHost;
    /**
     * The alterative maven host to download library. It will try to use these host from the `[0]` to the `[maven.length - 1]`
     */
    mavenHost?: string | string[];
    /**
     * The tracker to track the install process
     */
    tracker?: Tracker<LibrariesTrackerEvents>;
    /**
     * Custom checksum function for file validation
     */
    checksum?: (file: string, algorithm: string) => Promise<string>;
    strict?: boolean;
    signal?: AbortSignal;
}
export type InstallLibraryVersion = Pick<ResolvedVersion, 'libraries' | 'minecraftDirectory'>;
/**
 * Install all the libraries of providing version
 * @param version The target version
 * @param options The library host swap option
 */
export declare function installLibraries(version: ResolvedVersion, options?: LibraryOptions): Promise<void>;
/**
 * Only install several resolved libraries
 * @param libraries The resolved libraries
 * @param minecraft The minecraft location
 * @param option The install option
 */
export declare function installResolvedLibraries(libraries: ResolvedLibrary[], minecraft: MinecraftLocation, option?: LibraryOptions): Promise<void>;
/**
 * Resolve a library download urls with fallback.
 *
 * @param library The resolved library
 * @param libraryOptions The library install options
 */
export declare function resolveLibraryDownloadUrls(library: ResolvedLibrary, libraryOptions: LibraryOptions): string[];
/**
 * Diagnose all libraries presented in this resolved version.
 *
 * @param libraries The libraries to check
 * @param minecraft The minecraft location
 * @returns List of problematic libraries
 */
export declare function diagnoseLibraries(libraries: ResolvedLibrary[], minecraft: MinecraftFolder, options?: {
    signal?: AbortSignal;
    strict?: boolean;
    checksum?: (file: string, algorithm: string) => Promise<string>;
}): Promise<Array<ResolvedLibrary>>;
//# sourceMappingURL=libraries.d.ts.map