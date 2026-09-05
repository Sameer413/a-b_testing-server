/**
 * Required sample size per variant using the two-proportion Z-test formula.
 *
 * n = (z_α + z_β)² · p(1−p) / mde²
 *
 * @param baselineRate - control group conversion rate (e.g. 0.05 for 5%)
 * @param mde          - minimum detectable effect, absolute (e.g. 0.01 for 1pp lift)
 * @param alpha        - significance level (default 0.05 → 95% confidence)
 * @param power        - desired statistical power (default 0.80)
 */
export function requiredSampleSize(
    baselineRate: number,
    mde: number = 0.01,
    alpha: number = 0.05,
    power: number = 0.8,
): number {
    // z-scores for common alpha/power pairs (two-tailed α)
    const zAlpha = 1.96;  // α = 0.05
    const zBeta = 0.842; // power = 0.80
    const p = baselineRate;
    const n = ((zAlpha + zBeta) ** 2 * p * (1 - p)) / mde ** 2;
    return Math.ceil(n);
}
