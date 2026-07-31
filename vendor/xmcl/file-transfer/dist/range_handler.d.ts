import { Dispatcher } from 'undici';
import { ProgressTracker, ProgressTrackerSingle } from './progress';
import { FileHandler } from './file_handler';
import { RangePolicy } from './range_policy';
export declare class RangeRequestHandler extends FileHandler {
    readonly options: Dispatcher.DispatchOptions & {
        signal?: AbortSignal;
    };
    readonly dispatcher: Dispatcher;
    readonly rangePolicy: RangePolicy;
    rangeInfo: ProgressTracker;
    private childrenResolvers;
    private children;
    constructor(options: Dispatcher.DispatchOptions & {
        signal?: AbortSignal;
    }, dispatcher: Dispatcher, fd: number, rangePolicy: RangePolicy, tracker?: ProgressTrackerSingle, destinationExtension?: string);
    protected onHeaderParsed(acceptRanges: boolean, total: number): void;
    onWritten: (bytesWritten: number) => void;
    wait(): Promise<void>;
}
//# sourceMappingURL=range_handler.d.ts.map