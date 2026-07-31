import type { ResolvedLibrary, Version } from '@xmcl/core';
import type { InstallProfile } from './profile';
export declare class InstallError extends Error {
    issue: InstallIssue;
    constructor(issue?: InstallIssue, message?: string, cause?: Error);
}
export interface InstallIssue {
    /**
     * bad minecraft jar
     */
    jar?: string;
    /**
     * bad forge install
     */
    forge?: {
        minecraft: string;
        version: string;
    };
    /**
     * libraries requires to install
     */
    libraries?: ResolvedLibrary[];
    /**
     * assets that failed to install
     */
    assets?: {
        name: string;
        hash: string;
        size: number;
    }[];
    /**
     * bad assets index
     */
    assetsIndex?: Version.AssetIndex;
    profile?: InstallProfile;
    /**
     * optifine version that failed to install. e.g. "1.12.2_HD_U_G6_pre1"
     */
    optifine?: string;
}
export declare function mergeInstallIssue(target: InstallIssue, source: InstallIssue): InstallIssue;
export declare function isInstallError(e: any): e is InstallError;
//# sourceMappingURL=error.d.ts.map