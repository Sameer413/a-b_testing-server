import { BaseEntity } from '../../../database/entities/base.entity';
import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { FeatureFlag } from '../../feature_flag/entities/feature.flag.entity';
import { Variant } from '../../feature_flag/entities/variant.entity';
// import { Environment } from '../../project/entities/environment.entity';

@Entity('events')
@Index(['userId', 'featureFlagId', 'eventType'])
@Index(['featureFlagId', 'variantId', 'eventType'])
@Index(['occurredAt'])
// @Index(['environmentId', 'occurredAt'])
export class Event extends BaseEntity {

    /**
     * External user ID — same ID used in assignment.
     * Links this event back to the user's assigned variant.
     */
    @Column({ type: 'varchar', length: 255 })
    userId: string;

    @ManyToOne(() => FeatureFlag, { onDelete: 'CASCADE' })
    featureFlag: FeatureFlag;

    @Column()
    featureFlagId: string;

    @ManyToOne(() => Variant, { onDelete: 'SET NULL', nullable: true })
    variant: Variant;

    @Column({ nullable: true })
    variantId: string;

    // @ManyToOne(() => Environment, { onDelete: 'CASCADE' })
    // environment: Environment;

    // @Column()
    // environmentId: string;

    /**
     * Type of event — should match the experiment's primaryMetric
     * or secondaryMetrics for analysis.
     * e.g. 'page_view', 'click', 'add_to_cart', 'purchase', 'signup'
     */
    @Column({ type: 'varchar', length: 100 })
    eventType: string;

    /**
     * Optional numeric value for the event.
     * e.g. purchase amount (49.99), time on page (120.5 seconds)
     * null for binary events like 'click' or 'signup'.
     */
    @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
    eventValue: number | null;

    /**
     * Additional unstructured data for the event.
     * e.g. { productId: "SKU123", page: "/checkout", browser: "Chrome" }
     */
    @Column({ type: 'jsonb', nullable: true })
    metadata: Record<string, any> | null;

    @Column({ type: 'timestamptz' })
    occurredAt: Date;
}
