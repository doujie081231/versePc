export interface ProgressTracker {
    url: string;
    total: number;
    progress: number;
}
export declare class ProgressTrackerMultiple implements ProgressTracker {
    trackers: ProgressTrackerSingle[];
    expectedTotal: number;
    subSingle(): ProgressTrackerSingle;
    get url(): string;
    get total(): number;
    get progress(): number;
    toJSON(): {
        url: string;
        total: number;
        progress: number;
    };
}
/**
 * Track progress of a download
 */
export declare class ProgressTrackerSingle implements ProgressTracker {
    readonly onDownload?: ((accessor: ProgressTracker) => void) | undefined;
    accessor?: ProgressTracker;
    expectedTotal: number;
    done: boolean;
    constructor(onDownload?: ((accessor: ProgressTracker) => void) | undefined);
    setAccessor(accessor: ProgressTracker): void;
    get progress(): number;
    get total(): number;
    get url(): string;
    toJSON(): {
        url: string;
        total: number;
        progress: number;
    };
}
//# sourceMappingURL=progress.d.ts.map