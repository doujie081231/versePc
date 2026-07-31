export interface Range {
    start: number;
    end: number;
}
export interface RangePolicy {
    rangeThreshold: number;
    /**
     * Compute ranges for a specific portion of the file.
     * @param start The start position (inclusive)
     * @param end The end position (inclusive)
     * @returns Array of ranges within the specified portion
     */
    computeRangesInRange(start: number, end: number): Range[];
}
export declare function isRangePolicy(rangeOptions?: RangePolicy | DefaultRangePolicyOptions): rangeOptions is RangePolicy;
export declare function resolveRangePolicy(rangeOptions?: RangePolicy | DefaultRangePolicyOptions): RangePolicy;
export interface DefaultRangePolicyOptions {
    /**
     * The minimum bytes a range should have.
     * @default 5MB
     */
    rangeThreshold?: number;
}
export declare class DefaultRangePolicy implements RangePolicy {
    rangeThreshold: number;
    concurrency: number;
    constructor(rangeThreshold: number, concurrency: number);
    computeRangesInRange(start: number, end: number): Range[];
}
//# sourceMappingURL=range_policy.d.ts.map