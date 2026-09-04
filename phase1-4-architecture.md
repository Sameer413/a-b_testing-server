# A/B Testing Server — Phase 1 to Phase 4 Architecture

> Complete reference for what has been built, how it fits together, and how data flows end-to-end.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Application                          │
│  (Browser / Mobile / Backend service using your SDK)            │
└────────────────────┬────────────────┬───────────────────────────┘
                     │                │
          POST /sdk/evaluate   POST /sdk/track (or /batch)
          (Bearer API key)     (Bearer API key)
                     │                │
┌────────────────────▼────────────────▼───────────────────────────┐
│                    NestJS API Server                             │
│                                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ SdkModule│  │ExperimentMod │  │    TrackingModule        │  │
│  │ (eval)   │  │(lifecycle)   │  │  (events, exposure)      │  │
│  └──────────┘  └──────────────┘  └──────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    PostgreSQL                            │    │
│  │  feature_flags · variants · feature_flag_environments   │    │
│  │  experiments · assignment_logs · events · api_keys      │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Phase 1 — Feature Flag Evaluation

### What it does
Defines the core domain: a **Feature Flag** is a named toggle scoped to a **Project**. It can be a simple boolean on/off or a multivariate flag with weighted variants. Each flag can be enabled/disabled per **Environment** (dev, staging, production) with a configurable rollout percentage.

### Entities

#### `feature_flags` — `src/modules/feature_flag/entities/feature.flag.entity.ts`

| Column | Type | Purpose |
|---|---|---|
| `key` | varchar | Unique slug per project — `"checkout-redesign"` |
| `name` | varchar | Human-readable label |
| `flagType` | enum | `BOOLEAN` or `MULTIVARIATE` |
| `enabled` | boolean | Global kill switch — overrides everything |
| `allocationStrategy` | enum | How users are assigned to variants |
| `hashSalt` | varchar(32) | Randomises bucket assignments — change to re-randomise |
| `targetingRules` | jsonb | Who is eligible (see Phase 2) |

**Flag Types:**
- `BOOLEAN` — simple on/off. Auto-creates two variants: `On` and `Off`.
- `MULTIVARIATE` — A/B/n testing. Requires explicit variant definitions with weights summing to 100.

**Allocation Strategies:**
- `DETERMINISTIC_HASH` — `SHA256(userId + flagKey + salt) % 100` → same user always gets same variant across sessions and devices.
- `RANDOM` — pure random per evaluation. Useful for session-scoped tests.
- `PERCENTAGE_ROLLOUT` — deterministic hash-based, variant weights define bucket boundaries. Used for gradual rollouts.

---

#### `variants` — `src/modules/feature_flag/entities/variant.entity.ts`

| Column | Type | Purpose |
|---|---|---|
| `name` | varchar | `"control"`, `"variant-b"` — unique per flag |
| `weight` | decimal(5,2) | Traffic split — all variants must sum to 100 |
| `value` | varchar(255) | The payload served to SDK consumers |
| `valueType` | enum | How the SDK should deserialize `value` |

**Value Types:**
- `STRING` — e.g. `"blue"`, `"compact"` — no coercion
- `NUMBER` — stored as string, SDK parses with `parseFloat()`
- `BOOLEAN` — `"true"` / `"false"`, SDK parses with `value === 'true'`
- `JSON` — serialised object, SDK parses with `JSON.parse(value)`

---

#### `feature_flag_environments` — `src/modules/feature_flag/entities/feature-flag-environment.entity.ts`

A join table with extra columns — one row per (flag × environment) pair.

| Column | Type | Purpose |
|---|---|---|
| `enabled` | boolean | Per-env kill switch — false = flag off in this env |
| `rolloutPercentage` | int (0–100) | What % of eligible users see the flag in this env |

This allows the same flag to be at 10% rollout in production but 100% in staging.

**Constraints:**
```
feature_flags:                UNIQUE(key, project_id)
variants:                     UNIQUE(name, feature_flag_id)
feature_flag_environments:    UNIQUE(feature_flag_id, environment_id)
```

---

## Phase 2 — Evaluation Engine

### What it does
The evaluation engine runs when the SDK calls `POST /sdk/evaluate`. It takes a `userId`, `flagKey`, and optional `userAttributes` and returns which variant (if any) the user should see, plus a reason code.

### The 7-Step Evaluation Pipeline

```
POST /sdk/evaluate
{ userId, flagKey, userAttributes }
        │
        ▼
Step 1: Resolve flag
  Load FeatureFlag by (flagKey, projectId)
  → NotFoundException if not found
        │
        ▼
Step 2: Global kill switch
  if (!flag.enabled) → { enabled: false, reason: "GLOBALLY_DISABLED" }
        │
        ▼
Step 3: Per-environment kill switch
  Load FeatureFlagEnvironment for (flagId, envId)
  if (!ffEnv || !ffEnv.enabled) → "ENV_DISABLED"
        │
        ▼
Step 4: Targeting rules
  Evaluate flag.targetingRules against dto.userAttributes
  if no match → "TARGETING_MISS"
        │
        ▼
Step 5: Rollout check
  bucket = SHA256(userId + flagKey + salt) % 100
  if (bucket >= ffEnv.rolloutPercentage) → "OUT_OF_ROLLOUT"
        │
        ▼
Step 6: Variant assignment
  BOOLEAN:      always return "On" variant
  MULTIVARIATE:
    RANDOM    → bucket = randomInt(0, 100)
    HASH      → bucket = SHA256(userId + flagKey + salt) % 100
    Walk sorted variants by cumulative weight:
      [control=50, variant-b=50]
      bucket 0–49 → control
      bucket 50–99 → variant-b
        │
        ▼
Step 7: Create AssignmentLog (experiments only)
  Only if: experiment exists AND flagType != BOOLEAN
  Writes to assignment_logs — skips if user already assigned
        │
        ▼
Response:
{
  flagKey, enabled: true,
  variant: "variant-b",
  value: '{"buttonColor":"green"}',
  valueType: "json",
  reason: "MATCH"
}
```

### Targeting Rules Engine

Rules are stored as JSONB on the flag:
```json
{
  "groups": [
    {
      "conditions": [
        { "attribute": "country", "operator": "in",     "values": ["IN", "US"] },
        { "attribute": "plan",    "operator": "equals",  "values": ["premium"] }
      ]
    }
  ]
}
```

**Logic: OR across groups, AND across conditions within a group.**

Supported operators:
`in` · `not_in` · `equals` · `not_equals` · `contains` · `starts_with` · `ends_with` · `gt` · `gte` · `lt` · `lte` · `exists` · `not_exists`

### Evaluation Reason Codes

| Reason | Meaning |
|---|---|
| `GLOBALLY_DISABLED` | `flag.enabled = false` |
| `ENV_DISABLED` | `ffEnv.enabled = false` for this environment |
| `TARGETING_MISS` | User attributes didn't match targeting rules |
| `OUT_OF_ROLLOUT` | User's bucket ≥ rolloutPercentage |
| `MATCH` | User passed all checks — variant returned |

---

## Phase 3 — Experiments

### What it does
An **Experiment** wraps a multivariate Feature Flag with statistical context: hypothesis, metrics, confidence level, lifecycle management, and results storage.

### `experiments` — `src/modules/experiment/entities/experiment.entity.ts`

| Column | Type | Purpose |
|---|---|---|
| `name` | varchar | Human label |
| `hypothesis` | text | e.g. "Green CTA will increase purchases by 5%" |
| `status` | enum | `DRAFT → RUNNING → PAUSED → CONCLUDED` |
| `primaryMetric` | varchar | The event type to optimise for — `"purchase"` |
| `secondaryMetrics` | jsonb | Other metrics to observe — `["click_buy"]` |
| `confidenceLevel` | decimal | Default 0.95 (95%) — threshold for significance |
| `minSampleSize` | int | Minimum users per variant before analysis is valid |
| `startedAt / endedAt` | timestamptz | Experiment window |
| `results` | jsonb | Final results snapshot when concluded |
| `featureFlag` | FK (1-to-1) | The multivariate flag driving this experiment |
| `project` | FK | Scoped to a project |
| `createdBy` | FK | Internal user who created it |

### Experiment Lifecycle

```
DRAFT ──────────────► RUNNING ──────────────► CONCLUDED
                         │   ▲
                         │   │ resumeExperiment()
                         ▼   │
                       PAUSED
```

**Validations on `startExperiment()`:**
1. Flag must be globally `enabled`
2. Flag must have ≥ 2 variants
3. No other experiment already `RUNNING` on this flag

**Status transitions:**
- `startExperiment()` — DRAFT/PAUSED → RUNNING
- `pauseExperiment()` — RUNNING → PAUSED
- `resumeExperiment()` — PAUSED → RUNNING
- `endExperiment()` — any → CONCLUDED (irreversible)

### `assignment_logs` — `src/modules/experiment/entities/assignment-log.entity.ts`

Records **who was bucketed into which variant** for an experiment. Written during `evaluate()` Step 7.

| Column | Type | Purpose |
|---|---|---|
| `userId` | varchar | The end-user's ID from SDK — NOT a FK to internal users table |
| `featureFlagId` | FK | Which flag |
| `variantId` | FK | Which variant they were assigned |
| `experimentId` | FK | Which experiment |
| `assignedAt` | timestamptz | When assignment happened |
| `context` | jsonb | Snapshot of userAttributes at assignment time — for debugging |

> **Important:** `userId` is the **customer's end-user** (e.g. `"user-xyz-789"`), not an internal platform user. Intentionally no FK to the `users` table.

**Deduplication:** Checks if `(userId, featureFlagId)` already exists before inserting. Race conditions caught by PG error code `23505`.

---

## Phase 4 — Tracking

### What it does
Ingests raw events from the SDK — exposures (user saw a variant) and conversions (user performed a goal action). These are the raw input for Phase 5 analytics.

### `events` — `src/modules/experiment/entities/event.entity.ts`

| Column | Type | Purpose |
|---|---|---|
| `userId` | varchar | Same ID used in assignment — links event to a variant |
| `featureFlagId` | FK | Which flag this event belongs to |
| `variantId` | FK (nullable) | Which variant the user was in when event fired |
| `environmentId` | FK | Always from API key — never trusted from client body |
| `eventType` | varchar(100) | `"$exposure"`, `"click_buy"`, `"purchase"`, etc. |
| `eventValue` | decimal(12,4) | Numeric payload — `149.99` for revenue, null for binary |
| `metadata` | jsonb | Freeform context — `{ orderId, browser, page }` |
| `occurredAt` | timestamptz | Client-provided timestamp, fallback to server time |
| `idempotencyKey` | varchar(128) UNIQUE | Dedup key — same key = `ON CONFLICT DO NOTHING` |

**Indexes:**
- `(userId, featureFlagId, eventType)` — user-level lookups
- `(featureFlagId, variantId, eventType)` — variant-level aggregations (Phase 5)
- `(occurredAt)` — time-range queries

### API Endpoints

#### `POST /sdk/track` — Single event
```json
{
  "userId": "user-xyz-789",
  "flagKey": "checkout-redesign",
  "eventType": "purchase",
  "eventValue": 149.99,
  "variantId": "variant-b-id",
  "eventId": "uuid-generated-by-sdk",
  "occurredAt": "2026-09-04T15:33:10.000Z",
  "metadata": { "orderId": "ORD-123" }
}
```

#### `POST /sdk/track/batch` — Up to 500 events
```json
{ "events": [ /* array of TrackEventDto */ ] }
```

**Response:**
```json
{ "data": { "accepted": 4, "inserted": 4 }, "message": "Batch tracked" }
```
- `accepted` — how many were in the request
- `inserted` — how many were actually new rows (`0` means all were duplicates)

### Authentication
Both endpoints use `Authorization: Bearer <api-key>`. The `ApiKeyGuard`:
1. Strips `Bearer ` prefix, SHA-256 hashes the raw key
2. Looks up the hash in `api_keys` table
3. Validates `active = true` and `expiresAt`
4. Attaches resolved `environment` (with project) to `req.sdkEnvironment`

`environmentId` on every stored event always comes from the API key — clients cannot forge it.

### Deduplication — Two Paths

```
Event arrives with eventId?
        │
   YES ─┤──► upsert({ conflictPaths: ['idempotencyKey'] })
        │       → ON CONFLICT DO NOTHING
        │       → Retry-safe: same eventId = same row, no duplicate
        │
   NO ──┤──► save() — plain INSERT
                → No dedup — retry will create a duplicate row
                → Acceptable only for fire-and-forget events
```

### Exposure — Auto-recorded on Evaluate (Step 8)

When `evaluate()` assigns a variant and an experiment is running, it **automatically** writes a `$exposure` event:

```
eventId = "exp:{userId}:{flagId}:{variantId}"   ← deterministic
```

This means:
- Page refresh → same evaluate → same eventId → `ON CONFLICT DO NOTHING` → **one row per user per variant**
- SDK can also manually POST `{ eventType: '$exposure' }` — same key = no double-count

---

## Full Data Flow — End to End

```
1. Admin creates FeatureFlag
   key: "checkout-redesign", type: MULTIVARIATE
   variants: control (50%), variant-b (50%)
   enabled in production env (rollout: 100%)

2. Admin creates Experiment linked to the flag
   hypothesis: "Green CTA increases purchases by 5%"
   primaryMetric: "purchase", confidenceLevel: 0.95

3. Admin calls startExperiment()
   status: DRAFT → RUNNING, startedAt = now

4. End-user loads the app. SDK calls:
   POST /sdk/evaluate { userId: "user-A", flagKey: "checkout-redesign" }

   Step 1: Loads flag + variants ✅
   Step 2: flag.enabled = true ✅
   Step 3: ffEnv.enabled = true ✅
   Step 4: No targeting rules → all users eligible ✅
   Step 5: bucket = hash("user-A:checkout-redesign:salt") % 100 = 37
           rolloutPercentage = 100 → 37 < 100 → in rollout ✅
   Step 6: 37 < 50 (control weight) → assigned "control"
   Step 7: Writes AssignmentLog { userId: "user-A", variant: "control" }
   Step 8: Writes Event { eventType: "$exposure", variantId: "control",
           idempotencyKey: "exp:user-A:flag-id:control-id" }

   Response: { variant: "control", value: null, reason: "MATCH" }

5. User sees the original checkout (control).

6. User clicks "Buy Now". SDK calls:
   POST /sdk/track { eventType: "click_buy", eventId: "uuid-1" }
   → Writes Event { eventType: "click_buy" }

7. User completes checkout. SDK calls:
   POST /sdk/track { eventType: "purchase", eventValue: 149.99, eventId: "uuid-2" }
   → Writes Event { eventType: "purchase", eventValue: 149.99 }

8. [Phase 5] Analytics query for experiment results:
   exposed_control    = COUNT(DISTINCT userId) WHERE eventType='$exposure' AND variantId=control
   converted_control  = COUNT(DISTINCT userId) WHERE eventType='purchase' AND userId IN assignment_logs(control)
   conversionRate     = converted / exposed
   → same for variant-b → Z-test → pValue → isSignificant → lift
```

---

## Database Schema — All Tables

```
organizations
    └── projects
            ├── environments
            │       ├── api_keys                  ← SDK authentication
            │       └── feature_flag_environments  ← per-env enabled + rollout%
            └── feature_flags
                    ├── variants                  ← name + weight + value + valueType
                    └── experiments               ← hypothesis + metrics + status
                            └── assignment_logs   ← who was bucketed + when + context

events                                            ← all raw SDK events (Phase 4)
  userId, featureFlagId, variantId, environmentId
  eventType, eventValue, metadata, occurredAt, idempotencyKey
```

---

## Module Map

| Module | Responsibility | Key Files |
|---|---|---|
| `FeatureFlagModule` | CRUD for flags + variants + env config | `feature-flag.service.ts` |
| `SdkModule` | `POST /sdk/evaluate` — full eval pipeline | `sdk.service.ts` |
| `ExperimentModule` | Experiment CRUD + lifecycle + assignment logs | `experiment.service.ts` |
| `TrackingModule` | `POST /sdk/track` + batch — event ingestion | `tracking.service.ts` |
| `ApiKeysModule` | Create / revoke SDK API keys | `api-keys.service.ts` |
| `CommonModule` | Guards, interceptors, response wrapper | `jwt-auth.guard.ts`, `response-service.ts` |

---

## What's Next — Phase 5 (Analytics)

Phase 5 is a **pure read/compute layer** — no new entities or migrations needed.
It aggregates the `events` and `assignment_logs` tables already built in Phase 4.

| Metric | Method |
|---|---|
| Conversion rate | `COUNT(DISTINCT converters) / COUNT(DISTINCT exposed)` per variant |
| Sample size | `(z² × p × (1-p)) / mde²` — minimum users for statistical power |
| Confidence interval | `p ± z × sqrt(p(1-p)/n)` — Wilson interval |
| Statistical significance | Two-proportion Z-test → p-value |
| Lift | `(p_variant - p_control) / p_control × 100` |
| Guardrail metrics | Secondary metrics that must not regress vs control |

All exposed via: `GET /experiments/:id/results`
