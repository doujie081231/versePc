export declare function normalizeArray<T>(arr?: T | T[]): T[];
/**
 * Join two urls
 */
export declare function joinUrl(a: string, b: string): string;
/**
 * Shared install options
 */
export interface InstallOptions {
    /**
     * When you want to install a version over another one.
     *
     * Like, you want to install liteloader over a forge version.
     * You should fill this with that forge version id.
     */
    inheritsFrom?: string;
    /**
     * Override the newly installed version id.
     *
     * If this is absent, the installed version id will be either generated or provided by installer.
     */
    versionId?: string;
}
export declare function errorToString(e: any): string | undefined;
export interface FetchOptions {
    fetch?: (url: string, init?: RequestInit) => Promise<Response>;
    signal?: AbortSignal | undefined;
}
export declare function doFetch(o: FetchOptions | undefined, url: string, init?: RequestInit): Promise<Response>;
export declare function resolveDownloadUrls<T>(original: string, version: T, option?: string | string[] | ((version: T) => string | string[])): string[];
export interface WithDiagnose {
    diagnose?: boolean;
}
export declare function runWithDiagnose<T>(diagnose: () => Promise<T>, fix: (e: any) => Promise<void>, options: WithDiagnose): Promise<T>;
export declare function runWithDiagnoseOnce(diagnose: () => Promise<void>, fix: (e: any) => Promise<void>, options: WithDiagnose): Promise<void>;
//# sourceMappingURL=utils.browser.d.ts.map