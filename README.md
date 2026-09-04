# A/B Testing Server

A self-hosted A/B testing & feature flag platform built with **NestJS**, **TypeORM**, and **PostgreSQL**. Supports deterministic user bucketing, multivariate experiments, real-time event tracking, and is designed for statistical significance analysis.

> **Comparable to:** LaunchDarkly, Statsig, Optimizely — but fully self-hosted.

---

## Features

- 🚩 **Feature Flags** — Boolean toggles and multivariate flags with per-environment rollout control
- 🧪 **Experiments** — Full lifecycle management: Draft → Running → Paused → Concluded
- 🎯 **Targeting Rules** — Segment users by attributes (country, plan, device, etc.)
- 🔀 **Deterministic Bucketing** — SHA-256 hashing ensures same user always gets same variant
- 📊 **Event Tracking** — Single and batch event ingestion with idempotency deduplication
- 👁️ **Auto Exposure** — Exposure events recorded automatically on flag evaluation
- 🔑 **API Key Auth** — SDK endpoints secured with hashed, per-environment API keys

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 (TypeScript) |
| Database | PostgreSQL + TypeORM |
| Cache | Redis (ioredis) |
| Auth | JWT (access + refresh) + API Key |
| Validation | class-validator + class-transformer |
| Testing | Jest |
| Package Manager | pnpm |

---

## Prerequisites

- Node.js >= 18
- pnpm >= 10
- PostgreSQL >= 14
- Redis (local or [Upstash](https://upstash.com) for managed)

---

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo-url>
cd server
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Application
APP_PORT=5455
NODE_ENV=development

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=abTesting

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false

# JWT
JWT_ACCESS_SECRET=change-me-in-production
JWT_ACCESS_EXPIRATION=1d
JWT_REFRESH_SECRET=change-me-in-production
JWT_REFRESH_EXPIRATION=7d

# Cookie
COOKIE_SECRET=change-me-in-production
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 3. Create the database

```bash
psql -U postgres -c "CREATE DATABASE \"abTesting\";"
```

### 4. Run the server

```bash
# Development (watch mode)
pnpm run start:dev

# Production
pnpm run build && pnpm run start:prod
```

Server starts at: `http://localhost:5455`  
All routes are prefixed with `/api/v1`

---

## Running Tests

```bash
# All unit tests
pnpm test

# Specific module
pnpm test -- --testPathPatterns=tracking.service.spec --verbose

# Coverage
pnpm run test:cov
```

---

## API Walkthrough

> All management endpoints require a JWT Bearer token.  
> SDK endpoints (`/sdk/*`) require an API Key bearer token.

---

### Step 1 — Register & Login

```bash
# Register
curl -X POST http://localhost:5455/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sameer",
    "email": "sameer@example.com",
    "password": "password123"
  }'

# Login
curl -X POST http://localhost:5455/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "sameer@example.com", "password": "password123" }'
```

Save the `accessToken` from the response. Use it as `Bearer <token>` in all management requests below.

---

### Step 2 — Create a Project & Environment

```bash
# Create organisation first, then project via your org endpoints
# (Replace <TOKEN> with your accessToken throughout)

curl -X POST http://localhost:5455/api/v1/projects \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "My App", "organizationId": "<org-id>" }'
```

---

### Step 3 — Create an API Key (for SDK use)

```bash
curl -X POST http://localhost:5455/api/v1/api-keys \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production SDK Key",
    "environmentId": "<environment-id>"
  }'
```

Save the returned raw API key (shown only once). Use it as `Bearer <API_KEY>` in all `/sdk/*` calls.

---

### Step 4 — Create a Feature Flag

```bash
curl -X POST http://localhost:5455/api/v1/feature-flags \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "checkout-redesign",
    "name": "Checkout Redesign",
    "flagType": "multivariate",
    "projectId": "<project-id>",
    "variants": [
      { "name": "control",   "weight": 50, "value": null },
      { "name": "variant-b", "weight": 50, "value": "{\"buttonColor\":\"green\"}" }
    ]
  }'
```

---

### Step 5 — Enable the Flag in an Environment

```bash
curl -X PATCH http://localhost:5455/api/v1/feature-flags/<flag-id>/environments/<env-id> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": true, "rolloutPercentage": 100 }'
```

---

### Step 6 — Create & Start an Experiment

```bash
# Create
curl -X POST http://localhost:5455/api/v1/experiments \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Checkout CTA Test",
    "hypothesis": "Green CTA will increase purchases by 5%",
    "featureFlagId": "<flag-id>",
    "projectId": "<project-id>",
    "primaryMetric": "purchase",
    "secondaryMetrics": ["click_buy"],
    "confidenceLevel": 0.95
  }'

# Start
curl -X POST http://localhost:5455/api/v1/experiments/<experiment-id>/start \
  -H "Authorization: Bearer <TOKEN>"
```

---

### Step 7 — Evaluate a Flag (SDK)

```bash
curl -X POST http://localhost:5455/api/v1/sdk/evaluate \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-xyz-789",
    "flagKey": "checkout-redesign",
    "userAttributes": {
      "country": "IN",
      "plan": "premium"
    }
  }'
```

**Response:**
```json
{
  "data": {
    "flagKey": "checkout-redesign",
    "enabled": true,
    "variant": "variant-b",
    "value": "{\"buttonColor\":\"green\"}",
    "valueType": "json",
    "reason": "MATCH"
  }
}
```

> This also auto-records an `$exposure` event and an `AssignmentLog` for the user.

---

### Step 8 — Track Events (SDK)

```bash
# Track a single conversion
curl -X POST http://localhost:5455/api/v1/sdk/track \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-xyz-789",
    "flagKey": "checkout-redesign",
    "eventType": "purchase",
    "eventValue": 149.99,
    "eventId": "550e8400-e29b-41d4-a716-446655440001",
    "occurredAt": "2026-09-04T15:33:10.000Z",
    "metadata": { "orderId": "ORD-123", "currency": "USD" }
  }'

# Track a batch of events (up to 500)
curl -X POST http://localhost:5455/api/v1/sdk/track/batch \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {
        "userId": "user-abc",
        "flagKey": "checkout-redesign",
        "eventType": "click_buy",
        "eventId": "uuid-001"
      },
      {
        "userId": "user-abc",
        "flagKey": "checkout-redesign",
        "eventType": "purchase",
        "eventValue": 89.99,
        "eventId": "uuid-002"
      }
    ]
  }'
```

**Response:**
```json
{
  "data": { "accepted": 2, "inserted": 2 },
  "message": "Batch tracked"
}
```

> **Idempotency:** Send the same `eventId` twice — second call returns `inserted: 0`. No duplicate rows. Safe to retry on network failure.

---

## Project Structure

```
src/
├── common/                    # Shared utilities
│   ├── decorators/            # @Public(), @CurrentUser()
│   ├── guards/                # JwtAuthGuard, RolesGuard
│   ├── filters/               # Global exception filter
│   ├── interceptors/          # Logging interceptor
│   ├── enums/                 # FlagType, AllocationStrategy, ExperimentStatus, etc.
│   └── services/              # ResponseService
│
├── modules/
│   ├── auth/                  # JWT auth (login, register, refresh)
│   ├── users/                 # User management
│   ├── organizations/         # Org management
│   ├── project/               # Projects + Environments
│   ├── feature_flag/          # Feature flag CRUD + variants + env config
│   ├── api_keys/              # API key create/revoke
│   ├── experiment/            # Experiment CRUD + lifecycle + assignment logs
│   ├── sdk/                   # POST /sdk/evaluate — flag evaluation engine
│   ├── tracking/              # POST /sdk/track + /sdk/track/batch
│   └── analytics/             # GET /experiments/:id/results (Phase 5)
│
└── database/
    ├── database.module.ts     # TypeORM connection
    └── redis/                 # Redis module
```

---

## How Flag Evaluation Works

```
POST /sdk/evaluate
        │
        ├─ 1. Load flag by (flagKey, projectId)
        ├─ 2. Global kill switch  →  flag.enabled?
        ├─ 3. Per-env kill switch →  ffEnv.enabled?
        ├─ 4. Targeting rules     →  userAttributes match?
        ├─ 5. Rollout check       →  SHA256(userId+flagKey+salt) % 100 < rollout%?
        ├─ 6. Variant assignment  →  deterministic bucket → cumulative weight walk
        ├─ 7. Write AssignmentLog (experiments only, once per user)
        └─ 8. Write $exposure event (idempotent — page refresh = no duplicate)
```

---

## Event Deduplication

Every event can carry an `eventId` (UUID generated by the SDK client):

```
With eventId    →  upsert ON CONFLICT (idempotencyKey) DO NOTHING
Without eventId →  plain INSERT (no dedup — avoid for critical events)
```

Same `eventId` sent twice = **one row in DB**. Safe to retry on network failure.

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| `environmentId` from API key, never client body | Prevents clients from faking their environment |
| Deterministic hash bucketing | Same user → same variant across sessions and devices |
| `assignment_logs.userId` is a plain string, not a FK | End-users of customers are not platform users |
| `$exposure` separate from assignment | Assignment = bucketed, exposure = actually saw it — different denominators |
| Nullable `idempotencyKey` | Allows keyless events without violating unique constraint |

---

## License

Private — not licensed for redistribution.