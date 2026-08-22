/**
 * Default environment names seeded on project creation.
 * These are string constants — NOT a Postgres enum — so custom
 * environments (qa, canary, preview, etc.) can be added freely.
 */
export const DEFAULT_ENVIRONMENTS = ['development', 'staging', 'production'] as const;

export type DefaultEnvironment = (typeof DEFAULT_ENVIRONMENTS)[number];