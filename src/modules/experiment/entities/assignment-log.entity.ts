import { BaseEntity } from '../../../database/entities/base.entity';
import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { FeatureFlag } from '../../feature_flag/entities/feature.flag.entity';
import { Variant } from '../../feature_flag/entities/variant.entity';
// import { Environment } from '../../project/entities/environment.entity';

@Entity('assignment_logs')
@Index(['userId', 'featureFlagId'], { unique: true })
@Index(['featureFlagId', 'variantId'])
@Index(['assignedAt'])
export class AssignmentLog extends BaseEntity {

    /**
     * The external user ID provided by the SDK consumer.
     * This is NOT a FK to the User entity — it's the end-user
     * of the customer's application.
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

    @Column({ type: 'timestamptz' })
    assignedAt: Date;

    /**
     * Snapshot of user attributes at the time of assignment.
     * Useful for debugging targeting rule evaluation.
     * e.g. { country: "IN", plan: "premium", role: "developer" }
     */
    @Column({ type: 'jsonb', nullable: true })
    context: Record<string, any> | null;
}
