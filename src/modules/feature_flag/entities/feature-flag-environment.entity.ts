import { BaseEntity } from '../../../database/entities/base.entity.js';
import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import { FeatureFlag } from './feature.flag.entity.js';
import { Environment } from '../../project/entities/environment.entity';
import { TargetingRules } from '../../../common/interfaces/targeting-rule.interface';

@Entity('feature_flag_environments')
@Unique(['featureFlag', 'environment'])
export class FeatureFlagEnvironment extends BaseEntity {

    @ManyToOne(() => FeatureFlag, flag => flag.environmentOverrides, {
        onDelete: 'CASCADE',
    })
    featureFlag!: FeatureFlag;

    @ManyToOne(() => Environment, { onDelete: 'CASCADE', eager: false })
    environment!: Environment;

    /** Whether the flag is active in this environment */
    @Column({ default: false })
    enabled!: boolean;

    /**
     * What percentage of eligible users should see this flag.
     * 100 = fully rolled out, 0 = disabled for everyone.
     * Works in conjunction with the flag's allocationStrategy.
     */
    @Column({ type: 'int', default: 100 })
    rolloutPercentage!: number;

    /**
     * JSONB targeting rules that determine which users are eligible.
     * null = all users are eligible (no targeting).
     */
    @Column({ type: 'jsonb', nullable: true })
    targetingRules!: TargetingRules | null;
}
