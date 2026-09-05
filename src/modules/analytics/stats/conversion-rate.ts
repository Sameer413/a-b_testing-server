/**
 * Conversion rate: the fraction of exposed users who converted.
 * @param converters - unique users who fired the goal event
 * @param exposed    - unique users assigned to this variant
 */
export function conversionRate(converters: number, exposed: number): number {
    if (exposed === 0) return 0;
    return converters / exposed;
}
