export class VariantResultDto {
    variantId!: string;
    variantName!: string;
    isControl!: boolean;
    // Raw counts
    exposed!: number;     // unique users assigned this variant
    converters!: number;  // unique users who fired the primary metric event
    // Computed stats
    conversionRate!: number;                  // 0.0 – 1.0
    confidenceInterval!: [number, number];    // [lower, upper] Wilson
    // vs. control (null for the control variant itself)
    lift!: number | null;                     // % relative lift
    zScore!: number | null;
    pValue!: number | null;
    isSignificant!: boolean;
    isWinner!: boolean;
}
export class ExperimentResultsDto {
    experimentId!: string;
    experimentName!: string;
    status!: string;
    primaryMetric!: string;
    confidenceLevel!: number;         // e.g. 0.95
    requiredSampleSize!: number;      // per variant, from formula
    hasEnoughData!: boolean;          // all variants >= requiredSampleSize
    variants!: VariantResultDto[];
    analyzedAt!: Date;
}
