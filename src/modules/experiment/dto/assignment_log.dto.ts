import {
  IsDate,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { FeatureFlag } from '../../feature_flag/entities/feature.flag.entity';
import { Variant } from '../../feature_flag/entities/variant.entity';

export class CreateAssignmentLogDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsUUID()
  featureFlagId!: string;

  @IsOptional()
  @IsUUID()
  variantId?: string | null;

  @IsUUID()
  experimentId!: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, string | number | boolean> | null;

  @IsOptional()
  @IsDate()
  assignedAt?: Date;

  /**
   * Pre-resolved entities passed from SdkService to avoid redundant DB fetches.
   * Not validated by class-validator — internal use only.
   */
  resolvedFlag?: FeatureFlag;
  resolvedVariant?: Variant | null;
}
