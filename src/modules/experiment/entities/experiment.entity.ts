import { BaseEntity } from '../../../database/entities/base.entity';
import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { FeatureFlag } from '../../feature_flag/entities/feature.flag.entity';
import { Project } from '../../project/entities/project.entity';
import { ExperimentStatus } from '../../../common/enums/experiment-status.enum';

@Entity('experiments')
export class Experiment extends BaseEntity {

    @Column({ length: 255 })
    name!: string;

    @Column({ type: 'text', nullable: true })
    description!: string;

    /**
     * The hypothesis being tested.
     * e.g. "Changing the CTA button color to green will increase
     *        click-through rate by at least 5%"
     */
    @Column({ type: 'text' })
    hypothesis!: string;

    @Column({
        type: 'enum',
        enum: ExperimentStatus,
        default: ExperimentStatus.DRAFT,
    })
    status!: ExperimentStatus;

    @Column({ type: 'timestamptz', nullable: true })
    startedAt!: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    endedAt!: Date | null;

    /**
     * The primary metric to evaluate.
     * e.g. 'conversion_rate', 'click_through_rate', 'revenue_per_user'
     */
    @Column({ length: 100 })
    primaryMetric!: string;

    /**
     * Optional secondary metrics to track alongside.
     * e.g. ['bounce_rate', 'time_on_page', 'pages_per_session']
     */
    @Column({ type: 'jsonb', nullable: true })
    secondaryMetrics!: string[] | null;

    /**
     * Statistical confidence threshold (default 95%).
     * The experiment needs to reach this confidence before
     * results are considered significant.
     */
    @Column({ type: 'decimal', precision: 4, scale: 3, default: 0.95 })
    confidenceLevel!: number;

    /**
     * Minimum number of users per variant before analysis.
     * Prevents premature conclusions from small samples.
     */
    @Column({ type: 'int', nullable: true })
    minSampleSize!: number | null;

    /**
     * Final results stored as JSONB when experiment concludes.
     * Structure: { variantId: { sampleSize, conversionRate, pValue, isWinner } }
     */
    @Column({ type: 'jsonb', nullable: true })
    results!: Record<string, any> | null;

    // ── Relationships ──

    @OneToOne(() => FeatureFlag)
    @JoinColumn()
    featureFlag!: FeatureFlag;

    @ManyToOne(() => Project)
    project!: Project;
}
