// src/modules/analytics/
// ├── analytics.module.ts
// ├── analytics.controller.ts       ← GET /experiments/:id/results
// ├── analytics.service.ts          ← orchestrates all computations
// ├── stats/
// │   ├── conversion-rate.ts        ← SQL query + COUNT(DISTINCT)
// │   ├── sample-size.ts            ← formula: minN = z²p(1-p)/mde²
// │   ├── confidence-interval.ts    ← Wilson interval formula
// │   ├── significance.ts           ← Z-test + p-value + normal CDF
// │   └── lift.ts                   ← (pB - pA) / pA * 100
// └── dto/
//     └── experiment-results.dto.ts ← response shape


/**
 * Relative lift of the treatment over the control.
 * lift = (treatment - control) / control × 100
 *
 * @returns percentage lift (e.g. 12.5 means +12.5%), or null if control rate is 0.
 */
export function relativeLift(
    controlRate: number,
    treatmentRate: number,
): number | null {
    if (controlRate === 0) return null;
    return ((treatmentRate - controlRate) / controlRate) * 100;
}