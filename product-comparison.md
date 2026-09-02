# Product Comparison — This Project vs Wingify / VWO

This document compares our experimentation platform with commercial products like **Wingify (VWO)**, **LaunchDarkly**, **Statsig**, and **Optimizely** — and outlines what makes this a strong CV/portfolio project.

---

## What Wingify / VWO Actually Is

Wingify makes **VWO (Visual Website Optimizer)** — a full **experimentation + optimization platform**, not just feature flags.

| Area | What VWO Offers |
|------|------------------|
| **Experimentation** | A/B, multivariate, split-URL tests |
| **Feature flags** | Rollouts, targeting (similar to LaunchDarkly) |
| **Personalization** | Rule-based content per segment |
| **Analytics** | Conversion rates, significance, winner detection, dashboards |
| **Behavior tools** | Heatmaps, session recordings, funnels |
| **No-code UI** | Visual editor to change live websites without deploys |
| **Integrations** | GA, Segment, Shopify, CRMs, etc. |
| **Enterprise** | SSO, RBAC, audit logs, GDPR, SLAs |

**Our project** is closest to **LaunchDarkly + Statsig backend** — the evaluation engine and experiment infrastructure — not the full VWO suite.

---

## Feature Comparison

### What We Have (Phase 1) vs Commercial Products

| Capability | This Project | VWO / LaunchDarkly |
|------------|--------------|---------------------|
| Feature flags (boolean / multivariate) | ✅ Done | ✅ |
| Targeting rules (country, plan, etc.) | ✅ Done | ✅ |
| Gradual rollout % | ✅ Done | ✅ |
| Deterministic bucketing | ✅ Done | ✅ |
| Multi-env (staging / prod) | ✅ Done | ✅ |
| SDK evaluate API | ✅ Basic | ✅ + many SDKs |
| Orgs / projects / API keys | ✅ Done | ✅ |
| Variant-level rules (state → variant) | 📋 Designed | ✅ |
| Experiment lifecycle | 📋 Planned | ✅ |
| Event tracking + exposure | 📋 Entities exist | ✅ |
| Statistical significance | 📋 Planned | ✅ (advanced) |
| Admin dashboard UI | ❌ (API only) | ✅ Rich UI |
| Visual website editor | ❌ | ✅ Core VWO feature |
| Heatmaps / recordings | ❌ | ✅ |
| Client JS snippet (auto DOM changes) | ❌ | ✅ |
| Redis cache / edge eval | 📋 Planned | ✅ At scale |
| Bandits / auto-allocate traffic | ❌ | ✅ (Statsig-style) |
| Integrations ecosystem | ❌ | ✅ |

We have built the **core assignment brain**. VWO adds **UX, analytics surface, and go-to-market features** on top of a similar core.

---

## What Commercial Products Have That We Don't (Yet)

### Must-Have for a Credible "Mini-VWO" Backend

These are in our roadmap (`plan.md`) — prioritize for CV impact:

1. **Variant-level targeting** (India → state → variant) — designed in `flag-condition.md`
2. **Experiment entity** with draft → running → concluded
3. **Exposure + conversion events** linked to variant
4. **Basic stats** — conversion rate, sample size, p-value or confidence interval
5. **Sticky assignments** (assignment log lookup before re-bucketing)
6. **Unit + edge-case tests** on the evaluator
7. **Evaluation reasons** (`TARGETING_MISS`, `RULE_MATCH`, etc.)

### Nice-to-Have (Differentiators on a Resume)

8. **Redis-cached flag config** (low-latency eval)
9. **Mutual exclusion groups** (user in only one of several experiments)
10. **Holdout groups** (5% never see experiments — measure incremental lift)
11. **Guardrail metrics** (auto-pause if error rate spikes)
12. **Audit log** (who changed what flag when)

### Enterprise / VWO-Only (Skip for CV Unless Scope Expands)

- Visual editor, heatmaps, session replay
- IP-based geo without client sending `state`
- Bayesian stats, CUPED, sequential testing
- Multi-armed bandits
- SSO, billing, multi-region edge CDN

---

## Overlap with Named Products

| Product | Overlap with This Project |
|---------|---------------------------|
| **LaunchDarkly** | ~60% of flag/eval core if Phase 2 + 6 complete |
| **Statsig** | ~40% (stats engine, gates, dynamic config) |
| **Optimizely** | ~35% (heavy experiment management + UI) |
| **VWO / Wingify** | ~20% (visual editor, heatmaps, personalization UI omitted) |

We are not competing with Wingify as a product. We are building **credible infrastructure** that demonstrates understanding of how those products work under the hood.

---

## CV / Portfolio Assessment

### Why Recruiters and Engineers Will Care

- **Real domain**: experimentation platforms are used at scale (Uber, Netflix, Spotify use similar systems)
- **Hard problems**: deterministic hashing, targeting DSL, statistical analysis, multi-tenancy
- **Full-stack backend story**: NestJS, TypeORM, Redis, auth, SDK design
- **Product thinking**: mirrors LaunchDarkly / Optimizely / Statsig internals — not a todo app

### What Makes It Weak Today

- Only **Phase 1** is done — flags work, but no "experiment won variant B with 95% confidence" story yet
- No **demo UI** — harder to show in interviews
- No **tests** visible yet (Phase 2 lists them as TODO)
- No **README / architecture diagram** explaining the evaluation pipeline

### What Makes It Strong (When Phases 2–5 Complete)

Complete through **Phase 5** and we can honestly claim:

> Built a multi-tenant feature flag and A/B testing platform with rule-based targeting, deterministic variant assignment, event ingestion, and statistical significance calculation — backend modeled after commercial experimentation systems.

That is a **senior-worthy portfolio narrative**.

---

## Suggested Resume Positioning

**Don't write:** "Built VWO clone"

**Do write something like:**

> **Experimentation Platform** — NestJS, PostgreSQL, Redis
> - Multi-tenant feature flags with boolean/multivariate variants, per-environment rollouts, and JSON-based targeting rules
> - Deterministic hash bucketing for sticky user assignment
> - SDK evaluation API with structured reasons (targeting miss, rollout gate, rule match)
> - Experiment lifecycle, exposure/conversion tracking, chi-square significance testing
> - Designed variant-level geo targeting (state → variant routing)

---

## Roadmap to "CV-Ready"

```
Now          Phase 1 ✅
+2 weeks     Phase 2 (engine + variant rules + tests)
+2 weeks     Phase 3–4 (experiments + events)
+1 week      Phase 5 (basic stats — conversion rate, p-value)
+1 week      Simple React admin OR Swagger + Postman collection + demo video
```

### Minimum Demo for Interviews

1. Create flag with India + state rules
2. Call SDK with different `userAttributes` → show different variants
3. Log conversion events
4. Show "Variant B wins with 96% confidence" in an API or simple dashboard

---

## Verdict

| Question | Answer |
|----------|--------|
| Is the idea good for CV? | **Yes** |
| Is Phase 1 alone enough? | **Borderline** — add Phase 2 + stats + tests |
| Should we copy all of VWO? | **No** — visual editor etc. is a different product |
| Best next step for CV? | Phase 2 + variant rules + experiment stats + one demo flow |

---

## Related Docs

- [`plan.md`](./plan.md) — phased implementation roadmap
- [`flag-condition.md`](./flag-condition.md) — variant-level targeting design (Phase 2)
- [`improvement_proposals.md`](./improvement_proposals.md) — allocation, targeting, experiment proposals
