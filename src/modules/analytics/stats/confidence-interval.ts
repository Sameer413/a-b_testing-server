/**
 * Wilson score confidence interval — robust for small samples and
 * extreme probabilities (unlike the normal approximation).
 *
 * @param converters - number of successes (x)
 * @param exposed    - total observations (n)
 * @param z          - z-score for desired confidence (default 1.96 → 95%)
 * @returns [lower, upper] bounds clamped to [0, 1]
 */
export function wilsonInterval(
    converters: number,
    exposed: number,
    z: number = 1.96,
): [number, number] {
    if (exposed === 0) return [0, 0];
    const x = converters;
    const n = exposed;
    const z2 = z * z;
    const center = (x + z2 / 2) / (n + z2);
    const margin = (z / (n + z2)) * Math.sqrt((x * (n - x)) / n + z2 / 4);
    return [
        Math.max(0, center - margin),
        Math.min(1, center + margin),
    ];
}