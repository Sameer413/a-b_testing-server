export enum AllocationStrategy {
    /**
     * Deterministic hashing (MurmurHash3) on `userId + flagKey + salt`.
     * Same user always gets the same variant. Best for most A/B tests.
     * Guarantees consistency across sessions and devices.
     */
    DETERMINISTIC_HASH = 'deterministic_hash',

    /**
     * Pure random assignment on each evaluation.
     * Useful for session-scoped tests or canary deployments
     * where consistency is not required.
     */
    RANDOM = 'random',

    /**
     * Hash-based percentage rollout.
     * Users are bucketed deterministically into a 0-100 range.
     * Variant weights define the bucket boundaries.
     * Good for gradual rollouts (10% → 50% → 100%).
     */
    PERCENTAGE_ROLLOUT = 'percentage_rollout',
}
