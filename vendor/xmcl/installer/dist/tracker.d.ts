import { ProgressTracker, ProgressTrackerMultiple, ProgressTrackerSingle } from '@xmcl/file-transfer';
type TrackEvent<T extends object> = {
    [K in keyof T]: {
        phase: K;
        payload: T[K];
    };
}[keyof T];
export interface Tracker<T extends object> {
    <E extends TrackEvent<T>>(event: E): void;
}
export interface AnyTracker extends Tracker<any> {
}
export type Raw<T extends object> = T;
export type WithDownload<T extends object> = T & {
    progress: ProgressTracker;
};
export type WithProgress<T extends object> = T & {
    progress: {
        progress: number;
        total: number;
    };
};
export declare function onState<T extends object, K extends keyof T>(tracker: Tracker<T> | undefined, phase: K, payload: T[K]): void;
export declare function onProgress<T extends object, K extends keyof T>(tracker: Tracker<T> | undefined, phase: K, payload: Omit<T[K], 'progress'>): {
    progress: number;
    total: number;
};
export declare function onDownloadMultiple<T extends object, K extends keyof T>(tracker: Tracker<T> | undefined, phase: K, payload: Omit<T[K], 'progress'>): ProgressTrackerMultiple;
export declare function onDownloadSingle<T extends object, K extends keyof T>(tracker: Tracker<T> | undefined, phase: K, payload: Omit<T[K], 'progress'>): ProgressTrackerSingle;
export {};
//# sourceMappingURL=tracker.d.ts.map