// ─── Update DTO ─────────────────────────────────────────────────────────────────

import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CreateTargetingRulesDto } from './feature-flag.dto';
import { TargetingRules } from 'src/common/interfaces/targeting-rule.interface';
import { AllocationStrategy } from 'src/common/enums/allocation-strategy.enum';

export class UpdateFeatureFlagDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Feature name must be at least 3 characters' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /**
   * Global kill switch — toggling this affects ALL environments.
   * ⚠️ Blocked if a running experiment is attached to this flag.
   */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /**
   * Targeting rules — full replacement (not merge).
   * Pass `null` to remove all targeting (flag matches all users).
   * ⚠️ Blocked if a running experiment is attached to this flag.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateTargetingRulesDto)
  targetingRules?: TargetingRules | null;

  /**
   * How users are bucketed into variants.
   * ⚠️ Blocked if a running experiment is attached to this flag.
   */
  @IsOptional()
  @IsEnum(AllocationStrategy)
  allocationStrategy?: AllocationStrategy;
}
