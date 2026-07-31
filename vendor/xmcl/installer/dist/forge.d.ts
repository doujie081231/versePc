import { MinecraftFolder, MinecraftLocation } from '@xmcl/core';
import { Entry, ZipFile } from '@xmcl/yauzl';
import { LibraryOptions, LibrariesTrackerEvents } from './libraries';
import { InstallProfile, InstallProfileOption, ProfileTrackerEvents } from './profile';
import { Tracker, WithDownload } from './tracker';
import { InstallOptions as InstallOptionsBase, WithDiagnose } from './utils';
export interface ForgeTrackerEvents extends LibrariesTrackerEvents, ProfileTrackerEvents {
    'forge.installer': WithDownload<{
        version: string;
        path: string;
    }>;
}
export type { ForgeVersion, ForgeVersionList } from './forge.browser';
export { DEFAULT_FORGE_MAVEN, getForgeVersionList } from './forge.browser';
/**
 * All the useful entries in forge installer jar
 */
export interface ForgeInstallerEntries {
    /**
     *  maven/net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}.jar
     */
    forgeJar?: Entry;
    /**
     *  maven/net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-universal.jar
     */
    forgeUniversalJar?: Entry;
    /**
     * data/client.lzma
     */
    clientLzma?: Entry;
    /**
     * data/server.lzma
     */
    serverLzma?: Entry;
    /**
     * install_profile.json
     */
    installProfileJson?: Entry;
    /**
     * version.json
     */
    versionJson?: Entry;
    /**
     * forge-${forgeVersion}-universal.jar
     */
    legacyUniversalJar?: Entry;
    /**
     * forge-${forgeVersion}-shim.jar
     */
    shimJar?: Entry;
    /**
     * data/run.sh
     */
    runSh?: Entry;
    /**
     * data/run.bat
     */
    runBat?: Entry;
    /**
     * data/unix_args.txt
     */
    unixArgs?: Entry;
    /**
     * data/user_jvm_args.txt
     */
    userJvmArgs?: Entry;
    /**
     * data/win_args.txt
     */
    winArgs?: Entry;
}
export type ForgeInstallerEntriesPattern = ForgeInstallerEntries & Required<Pick<ForgeInstallerEntries, 'versionJson' | 'installProfileJson'>>;
export type ForgeLegacyInstallerEntriesPattern = Required<Pick<ForgeInstallerEntries, 'installProfileJson' | 'legacyUniversalJar'>>;
type RequiredVersion = {
    /**
     * The installer info.
     *
     * If this is not presented, it will genreate from mcversion and forge version.
     */
    installer?: {
        sha1?: string;
        /**
         * The url path to concat with forge maven
         */
        path: string;
    };
    /**
     * The minecraft version
     */
    mcversion: string;
    /**
     * The forge version (without minecraft version)
     */
    version: string;
};
/**
 * The options to install forge.
 */
export interface InstallForgeOptions extends Omit<LibraryOptions, 'tracker'>, InstallOptionsBase, Omit<InstallProfileOption, 'tracker'>, WithDiagnose {
    side?: 'client' | 'server';
    /**
     * The tracker to track the install process
     */
    tracker?: Tracker<ForgeTrackerEvents>;
}
/**
 * Unpack forge installer jar file content to the version library artifact directory.
 * @param zip The forge jar file
 * @param entries The entries
 * @param profile The forge install profile
 * @param mc The minecraft location
 * @returns The installed version id
 */
export declare function unpackForgeInstaller(zip: ZipFile, entries: ForgeInstallerEntriesPattern, profile: InstallProfile, mc: MinecraftFolder, jarPath: string, options: InstallForgeOptions): Promise<string>;
export declare function isLegacyForgeInstallerEntries(entries: ForgeInstallerEntries): entries is ForgeLegacyInstallerEntriesPattern;
export declare function isForgeInstallerEntries(entries: ForgeInstallerEntries): entries is ForgeInstallerEntriesPattern;
/**
 * Walk the forge installer file to find key entries
 * @param zip THe forge instal
 * @param forgeVersion Forge version to install
 */
export declare function walkForgeInstallerEntries(zip: ZipFile, forgeVersion: string): Promise<ForgeInstallerEntries>;
export declare class BadForgeInstallerJarError extends Error {
    jarPath: string;
    /**
     * What entry in jar is missing
     */
    entry?: string | undefined;
    name: string;
    constructor(jarPath: string, 
    /**
     * What entry in jar is missing
     */
    entry?: string | undefined);
}
/**
 * Install forge to target location.
 * Installation task for forge with mcversion >= 1.13 requires java installed on your pc.
 * @param version The forge version meta
 * @returns The installed version name.
 * @throws {@link BadForgeInstallerJarError}
 */
export declare function installForge(version: RequiredVersion, minecraft: MinecraftLocation, options?: InstallForgeOptions): Promise<string>;
//# sourceMappingURL=forge.d.ts.map