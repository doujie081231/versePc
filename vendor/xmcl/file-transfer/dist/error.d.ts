export declare function getDestinationExtension(path: string): string;
/**
 * Adds safe request context before an HTTP error is rejected. Unlike
 * `decorateError`, this runs at the handler boundary, before a rejected
 * promise can be observed by global exception telemetry.
 */
export declare function decorateHttpError(err: Error, requestUrl?: string, redirects?: URL[], destinationExtension?: string): void;
export declare function decorateError(err: Error, urls: string[], headers: Record<string, any>, destination: string): void;
//# sourceMappingURL=error.d.ts.map