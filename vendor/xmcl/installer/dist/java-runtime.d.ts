import { Platform } from '@xmcl/core';
import { DownloadBaseOptions } from '@xmcl/file-transfer';
import { JavaRuntimeManifest, JavaRuntimes, JavaRuntimeTarget, JavaRuntimeTargetType } from './java-runtime.browser';
import { Tracker, WithDownload } from './tracker';
export interface JavaRuntimeTrackerEvents {
    'java-runtime.json': WithDownload<{
        target: string;
    }>;
    'java-runtime.file': WithDownload<{
        path: string;
    }>;
}
export { DEFAULT_RUNTIME_ALL_URL, fetchJavaRuntimeManifest, JavaRuntimeTargetType, } from './java-runtime.browser';
export type { DirectoryEntry, DownloadInfo, Entry, FileEntry, JavaRuntimeManifest, JavaRuntimes, JavaRuntimeTarget, JavaRuntimeTargets, JreRuntimeEntry, LinkEntry, } from './java-runtime.browser';
export interface FetchJavaRuntimeManifestOptions extends DownloadBaseOptions {
    /**
     * The alternative download host for the file
     */
    apiHost?: string | string[];
    /**
     * The url of the all runtime json
     */
    url?: string;
    /**
     * The platform to install. It will be auto-resolved by default.
     * @default getPlatform()
     */
    platform?: Platform;
    /**
     * The install java runtime type
     * @default InstallJavaRuntimeTarget.Next
     */
    target?: JavaRuntimeTargetType | string;
    /**
     * The index manifest of the java runtime. If this is not presented, it will fetch by platform and all platform url.
     */
    manifestIndex?: JavaRuntimes;
    /**
     * Custom fetch function
     */
    fetch?: (url: string, init?: RequestInit) => Promise<Response>;
    /**
     * Abort signal for fetch
     */
    signal?: AbortSignal;
}
interface InstallJavaRuntimeBaseOptions extends DownloadBaseOptions {
    /**
     * The alternative download host for the file
     */
    apiHost?: string | string[];
    /**
     * The destination of this installation
     */
    destination: string;
    /**
     * The unpacker for lzma file
     */
    unpackLzma?: (lzmaFile: string, destinationFile: string) => Promise<void>;
    /**
     * Whether to diagnose the installation. If true, will throw error instead of fixing.
     */
    diagnose?: boolean;
    /**
     * Custom checksum function for file validation
     */
    checksum?: (file: string, algorithm: string) => Promise<string>;
    /**
     * Abort signal
     */
    signal?: AbortSignal;
}
export interface InstallJavaRuntimeOptions extends InstallJavaRuntimeBaseOptions {
    /**
     * The actual manfiest to install.
     */
    manifest: JavaRuntimeManifest;
    tracker?: Tracker<JavaRuntimeTrackerEvents>;
}
/**
 * Install java runtime from java runtime manifest
 * @param options The options to install java runtime
 */
export declare function installJavaRuntime(options: InstallJavaRuntimeOptions): Promise<void>;
export interface InstallJavaRuntimeWithJsonOptions extends InstallJavaRuntimeBaseOptions {
    /**
     * The actual manifest metadata.
     */
    target: JavaRuntimeTarget;
    tracker?: Tracker<JavaRuntimeTrackerEvents>;
    unpackLzma?: (lzmaFile: string, destinationFile: string) => Promise<void>;
}
/**
 * Install java runtime from java runtime manifest
 * @param options The options to install java runtime
 */
export declare function installJavaRuntimeWithJson(options: InstallJavaRuntimeWithJsonOptions): Promise<void>;
//# sourceMappingURL=java-runtime.d.ts.map