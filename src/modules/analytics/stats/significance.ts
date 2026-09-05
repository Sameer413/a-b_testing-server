/**
 * Approximation of the standard normal CDF using the Abramowitz & Stegun method.
 * Accurate to ~7 decimal places.
 */
function normalCDF(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const poly =
        t * (0.319381530 +
            t * (-0.356563782 +
                t * (1.781477937 +
                    t * (-1.821255978 +
                        t * 1.330274429))));
    const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
    const prob = 1 - pdf * poly;
    return z >= 0 ? prob : 1 - prob;
}
export interface ZTestResult {
    zScore: number;
    pValue: number;   // two-tailed
    isSignificant: boolean; // pValue < alpha
}
/**
 * Two-proportion Z-test comparing a treatment variant against the control.
 *
 * @param controlConverters   - converters in the control group
 * @param controlExposed      - sample size of the control group
 * @param treatmentConverters - converters in the treatment group
 * @param treatmentExposed    - sample size of the treatment group
 * @param alpha               - significance threshold (default 0.05)
 */
export function zTest(
    controlConverters: number,
    controlExposed: number,
    treatmentConverters: number,
    treatmentExposed: number,
    alpha: number = 0.05,
): ZTestResult {
    // Not enough data — return non-significant
    if (controlExposed === 0 || treatmentExposed === 0) {
        return { zScore: 0, pValue: 1, isSignificant: false };
    }
    const pA = controlConverters / controlExposed;
    const pB = treatmentConverters / treatmentExposed;
    // Pooled proportion
    const pPool =
        (controlConverters + treatmentConverters) /
        (controlExposed + treatmentExposed);
    const se = Math.sqrt(
        pPool * (1 - pPool) * (1 / controlExposed + 1 / treatmentExposed),
    );
    if (se === 0) return { zScore: 0, pValue: 1, isSignificant: false };
    const zScore = (pB - pA) / se;
    // Two-tailed p-value
    const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));
    return {
        zScore,
        pValue,
        isSignificant: pValue < alpha,
    };
}
