/**
 * Represent a issue for your diagnosed minecraft client.
 */
export interface Issue {
    /**
     * The type of the issue.
     */
    type: 'missing' | 'corrupted';
    /**
     * The role of the file in Minecraft.
     */
    role: string;
    /**
     * The path of the problematic file.
     */
    file: string;
    /**
     * The useful hint to fix this issue. This should be a human readable string.
     */
    hint: string;
    /**
     * The expected checksum of the file. Can be an empty string if this file is missing or not check checksum at all!
     */
    expectedChecksum: string;
    /**
     * The actual checksum of the file. Can be an empty string if this file is missing or not check checksum at all!
     */
    receivedChecksum: string;
}
export interface DiagnoseOptions {
    checksum?: (file: string, algorithm: string) => Promise<string>;
    strict?: boolean;
    signal?: AbortSignal;
}
/**
 * Diagnose a single file by a certain checksum algorithm. By default, this use sha1
 */
export declare function diagnoseFile<T extends string>({ file, expectedChecksum, role, hint, algorithm, }: {
    file: string;
    expectedChecksum: string;
    role: T;
    hint: string;
    algorithm?: string;
}, options?: DiagnoseOptions): Promise<Issue | undefined>;
//# sourceMappingURL=diagnose.d.ts.map