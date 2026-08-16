# Schema Hierarchy & Feature Flag Explainer

## Entity Relationship Map

```
Organization
├── owner            → User
├── members[]        → OrganizationMember (user + role)
└── projects[]
    └── Project
        ├── apiKeys[]  → ApiKey
        └── featureFlags[]
            └── FeatureFlag
                └── variants[]  → Variant
```

---

## Full JSON Hierarchy (Real Example)

```json
{
  "organization": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Acme Corp",
    "organizationCode": "ACM7G3",
    "createdAt": "2025-01-10T09:00:00Z",
    "updatedAt": "2025-01-10T09:00:00Z",

    "owner": {
      "id": "a1b2c3d4-...",
      "username": "john_doe",
      "email": "john@acme.com",
      "firstName": "John",
      "lastName": "Doe",
      "isActive": true
    },

    "members": [
      {
        "id": "mem-uuid-1",
        "role": "owner",
        "user": { "id": "a1b2c3d4-...", "email": "john@acme.com" }
      },
      {
        "id": "mem-uuid-2",
        "role": "developer",
        "user": { "id": "b2c3d4e5-...", "email": "alice@acme.com" }
      }
    ],

    "projects": [
      {
        "id": "proj-uuid-1",
        "projectId": "acme-web-A1B2C",
        "name": "Acme Web App",
        "createdAt": "2025-01-11T10:00:00Z",
        "updatedAt": "2025-01-11T10:00:00Z",

        "apiKeys": [
          {
            "id": "key-uuid-1",
            "key": "sk_live_xK9pQ2mN...",
            "active": true
          }
        ],

        "featureFlags": [
          {
            "id": "flag-uuid-1",
            "key": "new-checkout-flow",
            "name": "New Checkout Flow",
            "enabled": true,
            "allocationStrategy": "deterministic_hash",
            "hashSalt": "s3cr3tsalt",
            "createdAt": "2025-02-01T08:00:00Z",
            "updatedAt": "2025-02-01T08:00:00Z",

            "variants": [
              { "id": "var-uuid-1", "name": "control", "weight": 50.00 },
              { "id": "var-uuid-2", "name": "treatment", "weight": 50.00 }
            ]
          },

          {
            "id": "flag-uuid-2",
            "key": "dark-mode-rollout",
            "name": "Dark Mode Gradual Rollout",
            "enabled": true,
            "allocationStrategy": "percentage_rollout",
            "hashSalt": null,
            "variants": [
              { "id": "var-uuid-3", "name": "off",  "weight": 80.00 },
              { "id": "var-uuid-4", "name": "dark", "weight": 20.00 }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## Field-by-Field Explainer

### `Organization`

| Field | Type | Purpose |
|-------|------|---------|
| `organizationCode` | `string` | Short human-readable code like `ACM7G3`. Useful for invite links (`/join/ACM7G3`) |
| `owner` | `User` | The user who created the org. Has immutable OWNER privileges |
| `members[]` | `OrganizationMember[]` | Everyone in the org, each with a `role` |

---

### `OrganizationMember.role`

| Value | Can Do |
|-------|--------|
| `owner` | Everything — delete org, change billing, manage all roles |
| `admin` | Manage projects, flags, members (except other owners) |
| `developer` | Create/edit/delete flags and variants |
| `viewer` | Read-only — view dashboard and analytics |

---

### `Project`

| Field | Type | Purpose |
|-------|------|---------|
| `projectId` | `string` | Friendly slug-like ID (`acme-web-A1B2C`). This is what the SDK uses, not the UUID |
| `name` | `string` | Human label for the project |
| `apiKeys[]` | `ApiKey[]` | Server/client SDK keys scoped to this project |

---

### `FeatureFlag` — The Core

| Field | Type | Purpose |
|-------|------|---------|
| `key` | `string` | The identifier your **SDK calls** — e.g. `sdk.isEnabled("new-checkout-flow", userId)`. Unique per project |
| `name` | `string` | Human label shown in the dashboard |
| `enabled` | `boolean` | **Global kill switch.** If `false`, the flag is OFF for ALL users regardless of variants or allocation. Toggle this to instantly shut down a flag in production |
| `allocationStrategy` | `enum` | **How users are bucketed into variants** — see below |
| `hashSalt` | `string?` | **Re-randomizer.** Changing this reassigns all users to different variants without deleting experiment data. Useful for resetting a stale test |
| `variants[]` | `Variant[]` | The buckets users fall into (e.g. control vs treatment) |

---

### `allocationStrategy` — How Bucketing Works

#### `deterministic_hash` *(default, best for A/B tests)*
```
bucket = hash(userId + flagKey + hashSalt) % 100

User "user-123" → always gets bucket 42 → always "treatment"
User "user-456" → always gets bucket 78 → always "control"
```
> ✅ Same user → same variant, every time, across all devices and sessions.
> This is what you want for a real experiment — no "flickering".

---

#### `percentage_rollout` *(for gradual deploys)*
```
Variants: [ { name: "off", weight: 80 }, { name: "on", weight: 20 } ]

bucket = hash(userId + flagKey) % 100
  0–79  → "off"   (80% of users)
  80–99 → "on"    (20% of users)
```
> ✅ Deterministic like above, but designed for gradual rollouts.
> You increase the `on` variant's weight from 10 → 50 → 100 over time.

---

#### `random` *(for canary / session-scoped tests)*
```
bucket = Math.random() * 100  ← new roll every evaluation
```
> ⚠️ User can get a **different variant on every page load**.
> Only use for non-critical tests where consistency doesn't matter.

---

### `hashSalt` — Why It Matters

```
Scenario: You ran an A/B test for 2 weeks. Results were inconclusive.
You want to reset the experiment and start fresh.

Without hashSalt change:
  User "user-123" is ALWAYS in "control" — their history is biased.

With hashSalt change (e.g. "abc" → "xyz"):
  hash("user-123" + "new-checkout-flow" + "xyz") → different bucket
  User "user-123" might now be in "treatment" → fresh assignment
```
> Old `AssignmentLog` rows are preserved with the old salt, so historical data isn't corrupted.

---

### `Variant`

| Field | Type | Purpose |
|-------|------|---------|
| `name` | `string` | Label for this bucket — e.g. `"control"`, `"treatment"`, `"blue-button"` |
| `weight` | `decimal(5,2)` | **Percentage of traffic** that goes to this variant. All variant weights in a flag **must sum to 100** |
| `featureFlagId` | `string` | FK back to the parent flag (stored explicitly for fast queries) |

**Weight example:**
```json
[
  { "name": "control",        "weight": 33.33 },
  { "name": "treatment-a",   "weight": 33.33 },
  { "name": "treatment-b",   "weight": 33.34 }
]
```

---

### `ApiKey`

| Field | Type | Purpose |
|-------|------|---------|
| `key` | `string` | The secret token your SDK sends in the `Authorization` header to authenticate requests |
| `active` | `boolean` | Soft-disable a key without deleting it. Used during key rotation |

**SDK usage:**
```http
GET /sdk/evaluate?flagKey=new-checkout-flow&userId=user-123
Authorization: Bearer sk_live_xK9pQ2mN...
```

---

## How a Flag Evaluation Works (End-to-End Flow)

```
SDK Request:
  flagKey  = "new-checkout-flow"
  userId   = "user-123"
  apiKey   = "sk_live_xK9pQ2mN..."

Server Steps:
  1. Authenticate apiKey  → resolve Project
  2. Find FeatureFlag where key = "new-checkout-flow" AND projectId = ...
  3. Check flag.enabled   → if false, return { enabled: false, variant: null }
  4. Compute bucket:
       input  = "user-123" + "new-checkout-flow" + flag.hashSalt
       bucket = murmurhash(input) % 100   → e.g. 42
  5. Map bucket → variant:
       [0–49]  → "control"    (weight 50)
       [50–99] → "treatment"  (weight 50)
       bucket 42 → "control"
  6. Return:
       { enabled: true, variant: "control" }
```
