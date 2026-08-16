import { BaseEntity } from "../../../database/entities/base.entity.js";
import { Column, Entity, ManyToOne, OneToMany, Unique } from "typeorm";
import { Project } from "../../project/entities/project.entity";
import { Variant } from "./variant.entity.js";
import { AllocationStrategy } from "../../../common/enums/allocation-strategy.enum";
import { FlagType } from "../../../common/enums/flag-type.enum";
import { FeatureFlagEnvironment } from "./feature-flag-environment.entity.js";
import { User } from "../../users/entities/user.entity.js";

@Entity("feature_flags")
@Unique(['key', 'project'])
export class FeatureFlag extends BaseEntity {

    @Column()
    key!: string;

    @Column()
    name!: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    description?: string;

    @Column({
        type: 'enum',
        enum: FlagType,
        default: FlagType.BOOLEAN,
    })
    flagType!: FlagType;

    /**
     * Global kill switch — if false, the flag is off in ALL environments
     * regardless of per-environment overrides.
     */
    @Column({
        default: true,
    })
    enabled!: boolean;

    @Column({
        type: 'enum',
        enum: AllocationStrategy,
        default: AllocationStrategy.DETERMINISTIC_HASH,
    })
    allocationStrategy!: AllocationStrategy;

    /**
     * Random salt appended to the hash input.
     * Changing the salt re-randomizes all assignments — useful when
     * you want to "reset" an experiment without deleting data.
     */
    @Column({ type: 'varchar', length: 32, nullable: true })
    hashSalt!: string;

    // TODO: rolloutPercentage (0–100)
    // For boolean flags using `percentage_rollout` strategy, this controls what
    // percentage of users receive the "On" variant. The remaining users get "Off".
    // - Only meaningful when flagType === BOOLEAN && allocationStrategy === PERCENTAGE_ROLLOUT
    // - Should be validated: @Min(0) @Max(100), nullable (null = use variant weights as-is)
    // - Example: rolloutPercentage = 50 → 50% On, 50% Off
    // @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    // rolloutPercentage?: number;

    // ── Relationships ──

    @ManyToOne(
        () => Project,
        project => project.featureFlags,
    )
    project!: Project;

    @OneToMany(
        () => Variant,
        variant => variant.featureFlag,
        {
            cascade: true,
        },
    )
    variants!: Variant[];

    @OneToMany(
        () => FeatureFlagEnvironment,
        (override: FeatureFlagEnvironment) => override.featureFlag,
        {
            cascade: true,
        },
    )
    environmentOverrides!: FeatureFlagEnvironment[];

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL', eager: false })
    createdBy?: User;
}