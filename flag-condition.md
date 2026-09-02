Here is a Phase 2 design for variant-level targeting (state → variant A, etc.) that fits your existing engine. This is a spec only — switch to Agent mode if you want it implemented in the repo.

Goal
Support flags like:

Flag eligible for India only (country = IN)
Maharashtra (state = MH) → variant_a
Karnataka (state = KA) → variant_b
All other Indian states → default
All in one flag, server-side, deterministic.

Core idea: two variant roles
Role	Has targetingRules?	How assigned
Rule-pinned
Yes
First matching rule wins (by priority)
Weight-pool
No
Existing hash/weight bucketing
Flow after flag-level targeting + rollout:

1. Try rule-pinned variants (priority order)
2. If match → return that variant
3. Else → assignVariant() only among weight-pool variants
4. If no pool variants / no match → fallback reason
1. Schema changes
Variant entity — add 2 columns
// variant.entity.ts
@Column({ type: 'jsonb', nullable: true })
targetingRules!: TargetingRules | null;
/**
 * Higher = evaluated first among rule-pinned variants.
 * Tie-break: variant.name ASC (stable).
 */
@Column({ type: 'int', default: 0 })
priority!: number;
DTO — extend CreateVariantDto
@IsOptional()
@ValidateNested()
@Type(() => CreateTargetingRulesDto)
targetingRules?: TargetingRules | null;
@IsOptional()
@IsInt()
priority?: number;
Validation rules (create/update flag)
At least one variant must have no targetingRules (weight pool), OR exactly one variant marked isFallback (optional future field).
Weight-pool variants only must sum to 100 (rule-pinned variants can have weight: 0).
Rule-pinned variant cannot have both rules and participate in weight pool — if targetingRules is set, weight is ignored.
Boolean flags: no variant-level rules (still auto On/Off).
2. Updated evaluation pipeline
Insert Step 6a before current assignVariant():

STEP 1  Load flag + variants + env override
STEP 2  flag.enabled?           → GLOBALLY_DISABLED
STEP 3  ffEnv.enabled?          → ENV_DISABLED
STEP 4  flag.targetingRules?    → TARGETING_MISS
STEP 5  rollout bucket?         → OUT_OF_ROLLOUT
STEP 6a assignByVariantRules()? → MATCH (reason: RULE_MATCH)   ← NEW
STEP 6b assignVariant(pool)?    → MATCH (reason: WEIGHT_MATCH) ← renamed for clarity
STEP 6c no pool + no rule match → NO_VARIANT_MATCH             ← NEW fallback
New reason values
reason	Meaning
RULE_MATCH
Assigned by variant-level targeting rule
WEIGHT_MATCH
Assigned by hash/weight (current behavior)
NO_VARIANT_MATCH
Passed flag gates, but no rule matched and no weight pool
You can keep MATCH for both if you prefer a simpler API and add assignmentMethod: 'rule' | 'weight' later.

3. Pseudocode
Main evaluator (refactored SdkService.evaluate)
async evaluate(dto: EvaluateDto, environment: Environment) {
  const flag = await loadFlagWithVariants(dto.flagKey, environment.project.id);
  const ffEnv = await loadEnvOverride(flag.id, environment.id);
  const ctx = {
    flagKey: flag.key,
    userId: dto.userId,
    attributes: dto.userAttributes ?? {},
    flag,
    ffEnv,
  };
  // Gates (unchanged)
  if (!flag.enabled) return disabled(ctx, 'GLOBALLY_DISABLED');
  if (!ffEnv?.enabled) return disabled(ctx, 'ENV_DISABLED');
  if (flag.targetingRules && !ruleEvaluator.matches(flag.targetingRules, ctx.attributes)) {
    return disabled(ctx, 'TARGETING_MISS');
  }
  const bucket = bucketing.getBucket(ctx.userId, ctx.flagKey, flag.hashSalt);
  if (bucket >= ffEnv.rolloutPercentage) return disabled(ctx, 'OUT_OF_ROLLOUT');
  // ── NEW: variant-level rules ──
  const rulePinned = flag.variants.filter(v => v.targetingRules != null);
  const weightPool = flag.variants.filter(v => v.targetingRules == null);
  const pinned = assignByVariantRules(rulePinned, ctx.attributes);
  if (pinned) {
    return enabled(ctx, pinned, 'RULE_MATCH');
  }
  // ── Existing weight allocation (pool only) ──
  if (weightPool.length === 0) {
    return disabled(ctx, 'NO_VARIANT_MATCH');
  }
  const assigned = assignVariant(
    weightPool,
    flag.flagType,
    flag.allocationStrategy,
    ctx.userId,
    ctx.flagKey,
    flag.hashSalt,
  );
  return enabled(ctx, assigned, 'WEIGHT_MATCH');
}
assignByVariantRules() — the new function
function assignByVariantRules(
  variants: Variant[],
  attributes: Record<string, string | number | boolean>,
): Variant | null {
  if (variants.length === 0) return null;
  // Sort: highest priority first, then name for stability
  const sorted = [...variants].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.name.localeCompare(b.name);
  });
  for (const variant of sorted) {
    if (ruleEvaluator.matches(variant.targetingRules!, attributes)) {
      return variant;
    }
  }
  return null;
}
Extract shared RuleEvaluator (Phase 2 item)
Move existing logic out of SdkService:

class RuleEvaluator {
  matches(rules: TargetingRules, attributes: Attributes): boolean {
    return rules.groups.some(group =>
      group.conditions.every(c => this.evaluateCondition(c, attributes)),
    );
  }
  evaluateCondition(condition: TargetingCondition, attributes: Attributes): boolean {
    // Same switch you already have in sdk.service.ts
  }
}
Flag-level and variant-level rules reuse the same evaluator.

assignVariant() — small change
Only receives weight-pool variants (no behavior change inside):

function assignVariant(pool: Variant[], flagType, strategy, userId, flagKey, salt): Variant {
  if (flagType === FlagType.BOOLEAN) {
    return pool.find(v => v.name === 'On')!;
  }
  const bucket = strategy === RANDOM
    ? randomInt(0, 100)
    : getBucket(userId, flagKey, salt);
  const sorted = [...pool].sort((a, b) => a.name.localeCompare(b.name));
  let cumulative = 0;
  for (const variant of sorted) {
    cumulative += Number(variant.weight);
    if (bucket < cumulative) return variant;
  }
  return sorted[0]; // safety fallback
}
4. India / state example (full config)
{
  "name": "India Regional CTA",
  "flagType": "multivariate",
  "allocationStrategy": "deterministic_hash",
  "hashSalt": "india-v1",
  "targetingRules": {
    "groups": [{
      "conditions": [
        { "attribute": "country", "operator": "equals", "values": ["IN"] }
      ]
    }]
  },
  "variants": [
    {
      "name": "variant_a",
      "weight": 0,
      "priority": 10,
      "value": "{\"button\":\"Maharashtra offer\",\"lang\":\"mr\"}",
      "valueType": "json",
      "targetingRules": {
        "groups": [{
          "conditions": [
            { "attribute": "state", "operator": "equals", "values": ["MH"] }
          ]
        }]
      }
    },
    {
      "name": "variant_b",
      "weight": 0,
      "priority": 10,
      "value": "{\"button\":\"Karnataka offer\",\"lang\":\"kn\"}",
      "valueType": "json",
      "targetingRules": {
        "groups": [{
          "conditions": [
            { "attribute": "state", "operator": "equals", "values": ["KA"] }
          ]
        }]
      }
    },
    {
      "name": "variant_c",
      "weight": 0,
      "priority": 10,
      "value": "{\"button\":\"Tamil Nadu offer\",\"lang\":\"ta\"}",
      "valueType": "json",
      "targetingRules": {
        "groups": [{
          "conditions": [
            { "attribute": "state", "operator": "equals", "values": ["TN"] }
          ]
        }]
      }
    },
    {
      "name": "default",
      "weight": 100,
      "value": "{\"button\":\"India default\",\"lang\":\"en\"}",
      "valueType": "json"
    }
  ],
  "environments": [{
    "environmentId": "<prod>",
    "enabled": true,
    "rolloutPercentage": 100
  }]
}
5. Input → output (after implementation)
Assume flag key india-reg-XY12, prod env, rollout 100%.

#	userId	userAttributes	Output
1
u-1
{ "country": "IN", "state": "MH" }
enabled: true, variant: "variant_a", reason: "RULE_MATCH"
2
u-2
{ "country": "IN", "state": "KA" }
variant: "variant_b", reason: "RULE_MATCH"
3
u-3
{ "country": "IN", "state": "TN" }
variant: "variant_c", reason: "RULE_MATCH"
4
u-4
{ "country": "IN", "state": "DL" }
variant: "default", reason: "WEIGHT_MATCH"
5
u-5
{ "country": "US", "state": "MH" }
enabled: false, reason: "TARGETING_MISS"
6
u-6
{ "country": "IN" } (no state)
variant: "default", reason: "WEIGHT_MATCH"
7
u-1
Same as #1 again
Identical to #1 (deterministic)
Example output (#1):

{
  "flagKey": "india-reg-XY12",
  "enabled": true,
  "variant": "variant_a",
  "value": "{\"button\":\"Maharashtra offer\",\"lang\":\"mr\"}",
  "valueType": "json",
  "reason": "RULE_MATCH"
}
6. Edge cases to handle
Case	Behavior
Two rule variants match same user
Higher priority wins; tie → name ASC
Rule variant matches but weight pool also exists
Rule wins first (never reaches pool)
All variants have rules, none match
NO_VARIANT_MATCH
Mix: 2 rule variants + 2 pool variants (50/50 A/B for non-pinned states)
Pinned first; others split in pool
Missing state attribute
Skips MH/KA/TN rules → falls to default
Boolean flag
Skip variant rules entirely
Optional advanced: A/B within a state
MH users split 50/50 between two MH-specific variants:

[
  {
    "name": "mh_control",
    "weight": 50,
    "targetingRules": { "groups": [{ "conditions": [{ "attribute": "state", "operator": "equals", "values": ["MH"] }] }] }
  },
  {
    "name": "mh_test",
    "weight": 50,
    "targetingRules": { "groups": [{ "conditions": [{ "attribute": "state", "operator": "equals", "values": ["MH"] }] }] }
  }
]
For v1, recommend: rule-pinned = pin only (weight: 0). Weighted split within a segment can be Phase 2.5:

// Phase 2.5: segmented allocation
// 1. Find matching "segment" (group of variants sharing same rule)
// 2. Bucket only within that segment's variants by weight
Keep v1 simple: rules pin, pool allocates.

7. Files to touch (implementation checklist)
File	Change
variant.entity.ts
Add targetingRules, priority
feature-flag.dto.ts
Extend variant DTO
feature-flag.validators.ts
Weight sum applies to pool variants only
feature-flag.service.ts
Persist new variant fields
targeting-rule.interface.ts
No change (reuse)
sdk.service.ts
New step 6a + extract RuleEvaluator
common/evaluation/ (new)
rule-evaluator.ts, variant-assigner.ts, bucketing.ts
Migration
ALTER TABLE variants ADD targeting_rules, priority
Unit tests
India state matrix + priority conflicts + fallback
8. Add to plan.md (Phase 2)
PHASE 2 — Evaluation Engine
----------------------------------
[ ] Clean evaluation context
[ ] Rule evaluator (shared flag + variant level)
[ ] Operator system
[ ] Stable bucketing
[ ] Allocation algorithm
[ ] Variant-level targeting rules        ← NEW
[ ] Rule-pinned vs weight-pool variants ← NEW
[ ] Variant priority / conflict resolution ← NEW
[ ] Fallback handling (NO_VARIANT_MATCH)
[ ] Evaluation reasons (RULE_MATCH, WEIGHT_MATCH)
[ ] Unit tests
[ ] Edge-case tests (state routing, missing attrs, rule conflicts)
9. Unit test cases to write
describe('Variant-level targeting', () => {
  it('MH → variant_a');
  it('KA → variant_b');
  it('other IN state → default (WEIGHT_MATCH)');
  it('non-IN → TARGETING_MISS (flag level)');
  it('same userId + state → same variant (RULE_MATCH sticky)');
  it('higher priority rule wins when two match');
  it('missing state → default pool');
  it('all rule variants, no match → NO_VARIANT_MATCH');
  it('boolean flag ignores variant rules');
});
Summary
Layer	Rule	Example
Flag
Who enters experiment
country = IN
Rollout
What % of eligible users
rolloutPercentage: 100
Variant rule
Which pinned variant
state = MH → variant_a
Weight pool
Default / A/B for rest
default weight 100
This gives you one flag, state-based variants, and a clean path to Phase 2 without the “one flag per state” workaround.