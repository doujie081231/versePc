import { ResolvedVersion } from '@xmcl/core';
import { AssetsOptions, AssetsTrackerEvents } from './assets';
import { InstallError } from './error';
import { LibrariesTrackerEvents, LibraryOptions } from './libraries';
import { JarOption, MinecraftTrackerEvents } from './minecraft';
import { InstallProfileOption, ProfileTrackerEvents } from './profile';
import { Tracker } from './tracker';
export interface CompleteTrackerEvents extends MinecraftTrackerEvents, LibrariesTrackerEvents, AssetsTrackerEvents, ProfileTrackerEvents {
}
export interface CompleteOptions extends Omit<JarOption, 'tracker'>, Omit<LibraryOptions, 'tracker'>, Omit<AssetsOptions, 'tracker'>, Omit<InstallProfileOption, 'tracker'> {
    /**
     * The tracker to track the complete installation process
     */
    tracker?: Tracker<CompleteTrackerEvents>;
}
/**
 * Complete the installation of a resolved version, including minecraft jar, libraries, assets and profile.
 *
 * This can continue to install an aborted or failed installation, and it can diagnose the installation if `options.diagnose` is set to `true`.
 *
 * @param version The resolved version to install
 * @param options Installation options
 * @throws InstallError when diagnose is true and there are issues found during installation
 */
export declare function completeInstallation(version: ResolvedVersion, options?: CompleteOptions): Promise<void>;
export declare function completeInstallationByError(version: ResolvedVersion, error: InstallError, options?: CompleteOptions): Promise<void>;
//# sourceMappingURL=installer.d.ts.map