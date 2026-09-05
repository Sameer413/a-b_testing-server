import { BaseEntity } from "../../../database/entities/base.entity";
import { Column, Entity, ManyToOne, Unique } from "typeorm";
import { FeatureFlag } from "./feature.flag.entity";
import { VariantValueType } from "../../../common/enums/variant-value-type.enum.js";

@Entity("variants")
@Unique(['name', 'featureFlag'])
export class Variant extends BaseEntity {

    @Column()
    name!: string;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    weight!: number;

    /**
     * The variant's payload stored as a serialized string.
     * Use `valueType` to know how to deserialize on the client/SDK.
     */
    @Column({ type: 'varchar', length: 255, nullable: true })
    value?: string;

    /**
     * Describes the intended type of `value` so SDKs can deserialize correctly.
     * Defaults to STRING (no coercion required).
     */
    @Column({
        type: 'enum',
        enum: VariantValueType,
        default: VariantValueType.STRING,
    })
    valueType!: VariantValueType;

    @Column()
    featureFlagId!: string;

    @ManyToOne(
        () => FeatureFlag,
        flag => flag.variants,
    )
    featureFlag!: FeatureFlag;

    @Column({ type: 'boolean', default: false })
    isControl!: boolean;
}