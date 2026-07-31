import { DownloadBaseOptions } from '@xmcl/file-transfer';
import { Tracker, WithDownload, WithProgress } from './tracker';
/**
 * Tracker events for Zulu Java installation
 */
export interface ZuluTrackerEvents {
    'zulu-java.download': WithDownload<{}>;
    'zulu-java.extract': WithProgress<{
        url: string;
    }>;
}
/**
 * Zulu JRE download information
 */
export interface ZuluJRE {
    /**
     * Features of this JRE build (e.g., javafx, musl, crac)
     */
    features: string[];
    /**
     * Target architecture (e.g., x64, arm64, ia32)
     */
    architecture: string;
    /**
     * Target operating system (e.g., win32, linux, darwin)
     */
    os: string;
    /**
     * SHA256 hash of the download file
     */
    sha256: string;
    /**
     * Size of the download file in bytes
     */
    size: number;
    /**
     * Download URL for the JRE
     */
    url: string;
}
/**
 * Options for installing Zulu Java
 */
export interface InstallZuluJavaOptions extends DownloadBaseOptions {
    /**
     * The destination directory where Java will be installed
     */
    destination: string;
    /**
     * The tracker to track the install process
     */
    tracker?: Tracker<ZuluTrackerEvents>;
    abortSignal?: AbortSignal;
}
/**
 * Install Zulu JRE from the provided JRE information
 * @param jre The Zulu JRE information containing download details
 * @param options Installation options including destination and download settings
 * @returns Promise that resolves when installation is complete
 */
export declare function installZuluJava(jre: ZuluJRE, options: InstallZuluJavaOptions): Promise<void>;
/**
 * Detect whether the current Linux host uses the musl C library (Alpine and
 * similar) rather than glibc. A musl-linked JRE only runs on musl systems and
 * a glibc-linked JRE only runs on glibc systems; picking the wrong one makes
 * the `java` binary fail to `exec` with `ENOENT` (its dynamic loader, e.g.
 * `/lib/ld-musl-x86-64.so.1`, is absent). See the launch `launchInvalidJavaPath`
 * failures reported by users on non-musl distros.
 *
 * Uses the Node.js diagnostic report: glibc builds expose
 * `header.glibcVersionRuntime`, musl builds do not (and their loaded shared
 * objects reference `ld-musl`/`libc.musl`).
 */
export declare function detectLibc(platform?: string): 'musl' | 'glibc';
/**
 * Select the best Zulu JRE from an array of options based on current platform and preferences
 * @param jres Array of available Zulu JRE options
 * @param platform Target platform (defaults to current platform)
 * @param arch Target architecture (defaults to current architecture)
 * @param libc Target C library on Linux (defaults to auto-detecting the host)
 * @returns The best matching Zulu JRE or undefined if none found
 */
export declare function selectZuluJRE(jres: ZuluJRE[], platform?: string, arch?: string, libc?: 'musl' | 'glibc'): ZuluJRE | undefined;
//# sourceMappingURL=zulu.d.ts.map