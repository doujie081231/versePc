import { Dispatcher } from 'undici';
import { DownloadController } from './controller';
import { FileHandler } from './file_handler';
import { ProgressTrackerSingle } from './progress';
export interface ControlledHandlerParams {
    /**
     * The whole-file expected size, used to seed progress before headers
     * arrive. Ignored once the real size is known.
     */
    expectedTotal?: number;
    /**
     * Single-stream progress tracker. Mutually exclusive with `onAdvance`
     * (segment mode aggregates progress externally).
     */
    tracker?: ProgressTrackerSingle;
    /**
     * When set, this connection is responsible only for `[start, start +
     * total)` of the file (a range segment). The optimal-stop decision is
     * then made relative to the segment, not the whole file.
     */
    segment?: {
        start: number;
        total: number;
    };
    /**
     * Require a partial (`206`) response. If the server answers a ranged
     * request with a full `200`, reject with {@link RangeNotSupportedError}
     * instead of clobbering the shared file from offset 0.
     */
    requireRange?: boolean;
    /**
     * The absolute byte offset this request asked the server to start at
     * (the `Range: bytes=<start>-` value). If a `206` comes back starting
     * somewhere else, the mirror mis-honoured the range; writing it would
     * land bytes at the wrong offset, so the response is rejected.
     */
    requestStart?: number;
    /**
     * Commit to finishing this connection: ignore the controller's
     * speed-based abort and the TTFB deadline (a managed abort must never
     * be the terminal failure once the re-roll budget is spent). Real
     * network/HTTP errors still propagate.
     */
    noAbort?: boolean;
    /**
     * Whether this origin may be aborted on TTFB/stall (a re-assignable
     * CDN). When false (e.g. the official source) the connection is left
     * to finish or hit the dispatcher's own timeout. Default true.
     */
    abortable?: boolean;
    /**
     * Called after each write with the new absolute file offset, so a
     * multi-segment orchestrator can aggregate overall progress.
     */
    onAdvance?: (absolutePosition: number) => void;
}
/**
 * A single-connection file handler that periodically samples its own
 * throughput and asks a {@link DownloadController} whether to keep the
 * connection. When the controller returns `'abort'`, the handler
 * rejects with a {@link ManagedAbortError}, which `download` turns into
 * a resumed retry (re-roll) rather than a hard failure.
 *
 * It can fetch either the whole file (single resumable stream) or a
 * single byte-range segment of it (for range-split-across-mirrors). In
 * both cases an abort has a well-defined resume offset (`this.position`).
 */
export declare class ControlledFileHandler extends FileHandler {
    private readonly controller;
    private readonly origin;
    private readonly path;
    private totalSize;
    private finalUrl?;
    private host?;
    private readonly segStart;
    private readonly segTotal;
    private readonly requireRange;
    private readonly requestStart;
    private readonly noAbort;
    private readonly abortable;
    private readonly advance?;
    private firstByteAt;
    private lastByteAt;
    private windowStart;
    private windowBytes;
    private timer?;
    private ttfbTimer?;
    private rangeRejected;
    private readonly progressInfo;
    constructor(options: Dispatcher.DispatchOptions & {
        signal?: AbortSignal;
    }, fd: number, controller: DownloadController, params?: ControlledHandlerParams);
    protected onHeaderParsed(_acceptRanges: boolean, total: number): void;
    onData(chunk: Buffer): boolean;
    onComplete(trailers: string[] | null): void;
    onError(err: Error): void;
    /**
     * Absolute file offset reached so far on this connection. Used as the
     * resume offset for the next attempt.
     */
    get offset(): number;
    /**
     * Bytes received on this connection alone (excluding bytes already on
     * disk from a previous resumed attempt).
     */
    get received(): number;
    get finalHost(): string | undefined;
    get resolvedUrl(): string | undefined;
    get total(): number;
    private startSampling;
    private clearTimer;
    private clearTtfb;
    private clearTimers;
    private sample;
}
//# sourceMappingURL=controlled_handler.d.ts.map