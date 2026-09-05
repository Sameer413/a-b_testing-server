import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AllocationStrategy } from '../../../common/enums/allocation-strategy.enum.js';
import { FlagType } from '../../../common/enums/flag-type.enum.js';
import { VariantValueType } from '../../../common/enums/variant-value-type.enum.js';
import {
  MinVariantsForMultivariate,
  NoVariantsForBoolean,
  VariantWeightsSumTo100,
} from '../../../common/validators/feature-flag.validators.js';
import { TargetingRules } from 'src/common/interfaces/targeting-rule.interface.js';

// ─── Variant sub-DTO ────────────────────────────────────────────────────────────

export class CreateVariantDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  weight!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  value?: string;

  /**
   * Tells the SDK how to deserialize the string value.
   * Defaults to STRING if not provided.
   */
  @IsOptional()
  @IsEnum(VariantValueType)
  valueType: VariantValueType = VariantValueType.STRING;

  /**
   * Marks this variant as the control (baseline) group.
   * Only one variant per flag should be marked as control.
   * Used by the analytics engine to compute lift and significance.
   */
  @IsOptional()
  @IsBoolean()
  isControl?: boolean;
}

export class CreateFeatureFlagEnvironmentDto {
  @IsUUID()
  environmentId!: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  rolloutPercentage?: number;
}

export class CreateTargetingConditionDto {
  @IsString()
  @IsNotEmpty()
  attribute!: string;
  @IsEnum([
    'in', 'not_in',
    'equals', 'not_equals',
    'contains', 'starts_with', 'ends_with',
    'gte', 'lte', 'gt', 'lt',
    'exists', 'not_exists',
  ])
  operator!: string;
  @IsArray()
  values!: (string | number | boolean)[];
}
export class CreateTargetingRuleGroupDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTargetingConditionDto)
  @ArrayMinSize(1)
  conditions!: CreateTargetingConditionDto[];
}
export class CreateTargetingRulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTargetingRuleGroupDto)
  @ArrayMinSize(1)
  groups!: CreateTargetingRuleGroupDto[];
}


// ─── Main DTO ───────────────────────────────────────────────────────────────────

export class CreateFeatureFlagRequestDto {
  /**
   * Human-readable name for the flag (e.g. "Any Event")
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Feature name must be at least 3 characters' })
  name!: string;

  /**
   * Optional description of what this flag controls.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /**
   * Flag type — boolean (on/off) or multivariate (A/B/n variants).
   * Defaults to BOOLEAN.
   */
  @IsOptional()
  @IsEnum(FlagType)
  flagType: FlagType = FlagType.BOOLEAN;

  /**
   * Global kill switch. Defaults to true (flag is active on creation).
   */
  @IsOptional()
  @IsBoolean()
  enabled: boolean = true;

  /**
   * How users are bucketed into variants.
   * Defaults to DETERMINISTIC_HASH for consistent per-user assignment.
   */
  @IsOptional()
  @IsEnum(AllocationStrategy)
  allocationStrategy: AllocationStrategy =
    AllocationStrategy.DETERMINISTIC_HASH;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFeatureFlagEnvironmentDto)
  environments?: CreateFeatureFlagEnvironmentDto[];

  /**
   * Optional salt to re-randomize user assignments without deleting the flag.
   * Max 32 characters.
   */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  hashSalt?: string;

  /**
   * Variants for multivariate flags.
   *
   * Rules enforced by class-level validators:
   *  - BOOLEAN flags: must be empty/absent (On/Off are auto-generated).
   *  - MULTIVARIATE flags: must contain at least 2 variants.
   *  - MULTIVARIATE flags: variant weights must sum to exactly 100.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  @NoVariantsForBoolean()
  @MinVariantsForMultivariate()
  @VariantWeightsSumTo100()
  variants?: CreateVariantDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateTargetingRulesDto)
  targetingRules?: TargetingRules | null;
}
