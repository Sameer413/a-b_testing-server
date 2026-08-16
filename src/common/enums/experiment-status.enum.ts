export enum ExperimentStatus {
    /** Experiment is configured but not yet collecting data */
    DRAFT = 'draft',

    /** Actively assigning users and collecting events */
    RUNNING = 'running',

    /** Temporarily halted — no new assignments, events still recorded */
    PAUSED = 'paused',

    /** Experiment is complete — results are final */
    CONCLUDED = 'concluded',
}
