import { Dispatcher } from 'undici';
export declare class FileHandler implements Dispatcher.DispatchHandler {
    readonly fd: number;
    private readonly requestUrl?;
    protected readonly destinationExtension?: string | undefined;
    private abort?;
    protected context?: {
        history?: URL[];
    };
    start: number;
    position: number;
    contentLength: number;
    protected statusCode: number;
    protected signal: AbortSignal | undefined;
    protected resolvers: PromiseWithResolvers<void>;
    protected terminated: boolean;
    protected pending: number;
    protected writeError?: Error;
    protected listener: () => void;
    constructor(signal: AbortSignal | undefined, fd: number, requestUrl?: string | undefined, destinationExtension?: string | undefined);
    onConnect(...args: any[]): void;
    onHeaders(statusCode: number, rawHeaders: Buffer[], resume: () => void, statusText: string): boolean;
    protected onHeaderParsed(acceptRanges: boolean, total: number): void;
    private checkTermination;
    onData(chunk: Buffer): boolean;
    onWritten?(bytesWritten: number): void;
    onComplete(trailers: string[] | null): void;
    onError(err: Error): void;
    wait(): Promise<void>;
}
//# sourceMappingURL=file_handler.d.ts.map