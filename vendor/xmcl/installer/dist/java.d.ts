export interface JavaInfo {
    /**
     * Full java executable path
     */
    path: string;
    /**
     * Java version string
     */
    version: string;
    /**
     * Major version of java
     */
    majorVersion: number;
}
export interface JavaResolveDiagnostic {
    java?: JavaInfo;
    exitCode?: number;
    signal?: string;
    stdout: string;
    stderr: string;
}
/**
 * Try to resolve a java info at this path. This will call `java -version`
 * @param path The java exectuable path.
 */
export declare function resolveJava(path: string): Promise<JavaInfo | undefined>;
/**
 * Resolve Java while retaining the process output for callers that need to
 * diagnose why an existing, executable runtime could not be recognized.
 */
export declare function resolveJavaWithDiagnostic(path: string): Promise<JavaResolveDiagnostic>;
export declare function parseJavaVersionOutput(stdout: string, stderr: string): {
    version: string;
    majorVersion: number;
    patch: number;
} | undefined;
export declare class ParseJavaVersionError extends Error {
    name: string;
    constructor(message: string);
}
/**
 * Parse version string and major version number from `java -version` output.
 *
 * @param versionText The stdout or stderr for `java -version`
 */
export declare function parseJavaVersion(versionText: string): {
    version: string;
    majorVersion: number;
    patch: number;
} | undefined;
/**
 * Get all potential java locations for Minecraft.
 *
 * On mac/linux, it will perform `which java`. On win32, it will perform `where java`
 *
 * @returns The absolute java locations path
 */
export declare function getPotentialJavaLocations(): Promise<string[]>;
/**
 * Scan local java version on the disk.
 *
 * It will check if the passed `locations` are the home of java.
 * Notice that the locations should not be the executable, but the path of java installation, like JAVA_HOME.
 *
 * This will call `getPotentialJavaLocations` and then `resolveJava`
 *
 * @param locations The location (like java_home) want to check.
 * @returns All validate java info
 */
export declare function scanLocalJava(locations: string[]): Promise<JavaInfo[]>;
//# sourceMappingURL=java.d.ts.map