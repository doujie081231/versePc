/**
 * @ignore
 */
/** @internal */
export declare function exists(file: string): Promise<boolean>;
/**
 * Validate the sha1 value of the file
 * @internal
 */
export declare function validateSha1(target: string, hash?: string, strict?: boolean): Promise<boolean>;
/**
 * Return the sha1 of a file
 * @internal
 */
export declare function checksum(target: string, algorithm: string): Promise<any>;
/**
 * @internal
 */
export declare function isNotNull<T>(v: T | undefined): v is T;
//# sourceMappingURL=utils.d.ts.map