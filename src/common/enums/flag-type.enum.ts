export enum FlagType {
    /**
     * Simple on/off boolean toggle.
     * Auto-creates two variants: "On" (value: "true") and "Off" (value: "false").
     */
    BOOLEAN = 'boolean',

    /**
     * Multi-variant flag for A/B/n testing.
     * Requires explicit variant definitions with weights that sum to 100.
     */
    MULTIVARIATE = 'multivariate',
}
