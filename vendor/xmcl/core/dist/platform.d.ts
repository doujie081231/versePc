/**
 * The platform information related to current operating system.
 */
export interface Platform {
    /**
     * The system name of the platform. This name is majorly used for download.
     */
    name: 'osx' | 'linux' | 'windows' | 'unknown';
    /**
     * The version of the os. It should be the value of `os.release()`.
     */
    version: string;
    /**
     * The direct output of `os.arch()`. Should look like x86 or x64.
     */
    arch: 'x86' | 'x64' | string;
}
/**
 * Get Minecraft style platform info. (Majorly used to enable/disable native dependencies)
 */
export declare function getPlatform(): Platform;
//# sourceMappingURL=platform.d.ts.map