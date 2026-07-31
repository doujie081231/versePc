import { MinecraftLocation } from '@xmcl/core';
import { FabricLoaderArtifact } from './fabric.browser';
import { InstallOptions } from './utils';
import { FetchOptions } from './utils.browser';
export interface FabricInstallOptions extends InstallOptions {
    side?: 'client' | 'server';
}
/**
 * Generate fabric version json from loader artifact.
 * @param loader The fabric loader artifact
 * @param side The side of the fabric
 * @param options
 * @returns The generated version json
 */
export declare function getVersionJsonFromLoaderArtifact(loader: FabricLoaderArtifact, side: 'client' | 'server', options?: FabricInstallOptions): {
    id: string;
    inheritsFrom: string;
    mainClass: string;
    libraries: {
        name: string;
        url: string;
    }[];
    arguments: {
        game: never[];
        jvm: never[];
    };
    releaseTime: string;
    time: string;
};
/**
 * Install fabric version json.
 *
 * If side is `server`, it requires the Minecraft version json to be installed.
 *
 * @returns The installed version id
 */
export declare function installFabricByLoaderArtifact(loader: FabricLoaderArtifact, minecraft: MinecraftLocation, options?: FabricInstallOptions): Promise<string>;
export interface InstallFabricVersionOptions extends FetchOptions, InstallOptions {
    minecraftVersion: string;
    version: string;
    minecraft: MinecraftLocation;
    side?: 'client' | 'server';
}
export declare function installFabric(options: InstallFabricVersionOptions): Promise<string>;
//# sourceMappingURL=fabric.d.ts.map