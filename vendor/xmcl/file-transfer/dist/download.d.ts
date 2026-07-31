import { Dispatcher } from 'undici';
import { DownloadController } from './controller';
import { ProgressTrackerMultiple, ProgressTrackerSingle } from './progress';
import { DefaultRangePolicyOptions, RangePolicy } from './range_policy';
export interface DownloadBaseOptions {
    rangePolicy?: RangePolicy | DefaultRangePolicyOptions;
    dispatcher?: Dispatcher;
    /**
     * Optional adaptive strategy. When supplied, the download runs as a
     * single resumable stream whose throughput is sampled, and the
     * controller may request a managed abort that resumes (via HTTP
     * `Range`) on a fresh connection instead of failing. When omitted,
     * the classic parallel-range / multi-URL-fallback path is used and
     * behaviour is unchanged.
     */
    controller?: DownloadController;
}
export declare function getDownloadBaseOptions(options?: DownloadBaseOptions): {
    dispatcher: Dispatcher;
    rangePolicy: RangePolicy;
    controller: DownloadController | undefined;
};
export interface DownloadOptions extends DownloadBaseOptions {
    /**
     * The url or urls (fallback) of the resource
     */
    url: string | string[];
    /**
     * The header of the request
     */
    headers?: Record<string, any>;
    /**
     * Where the file will be downloaded to
     */
    destination: string;
    /**
     * The progress controller. If you want to track download progress, you should use this.
     */
    tracker?: ProgressTrackerSingle;
    /**
     * The user abort signal to abort the download
     */
    signal?: AbortSignal;
    /**
     * The expected total size of the file.
     */
    expectedTotal?: number;
}
export type DownloadMultipleOption = Pick<DownloadOptions, 'url' | 'headers' | 'destination' | 'expectedTotal'>;
export interface DownloadMultipleOptions extends DownloadBaseOptions {
    options: DownloadMultipleOption[];
    tracker?: ProgressTrackerMultiple;
    signal?: AbortSignal;
}
export declare function downloadMultiple(options: DownloadMultipleOptions): Promise<PromiseSettledResult<void>[]>;
export declare function download(options: DownloadOptions): Promise<void>;
//# sourceMappingURL=download.d.ts.map