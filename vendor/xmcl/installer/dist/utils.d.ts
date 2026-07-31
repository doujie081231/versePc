import { ChildProcess, ExecOptions, SpawnOptions } from 'child_process';
export { checksum } from '@xmcl/core';
export declare function missing(target: string): Promise<boolean>;
export declare function ensureDir(target: string): Promise<void>;
export interface SpawnJavaOptions {
    /**
     * The java exectable path. It will use `java` by default.
     *
     * @defaults "java"
     */
    java?: string;
    /**
     * The spawn process function. Used for spawn the java process at the end.
     *
     * By default, it will be the spawn function from "child_process" module. You can use this option to change the 3rd party spawn like [cross-spawn](https://www.npmjs.com/package/cross-spawn)
     */
    spawn?: (command: string, args?: ReadonlyArray<string>, options?: SpawnOptions) => ChildProcess;
}
export declare function ensureFile(target: string): Promise<void>;
export declare function spawnProcess(spawnJavaOptions: SpawnJavaOptions, args: string[], options?: ExecOptions): Promise<void>;
export declare class ProcessExitError extends Error {
    readonly exitCode: number | null;
    readonly signal: string | null;
    readonly stderr: string;
    name: string;
    constructor(exitCode: number | null, signal: string | null, stderr: string);
}
export declare function waitProcess(process: ChildProcess): Promise<void>;
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
export interface WithDiagnose {
    diagnose?: boolean;
}
export declare function runWithDiagnose<T>(diagnose: () => Promise<T>, fix: (e: any) => Promise<void>, options: WithDiagnose): Promise<T>;
export declare function runWithDiagnoseOnce(diagnose: () => Promise<void>, fix: (e: any) => Promise<void>, options: WithDiagnose): Promise<void>;
//# sourceMappingURL=utils.d.ts.map