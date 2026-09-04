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