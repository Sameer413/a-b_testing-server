import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateExperimentDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  hypothesis!: string;

  @IsString()
  @IsNotEmpty()
  primaryMetric!: string;

  /**
   * Statistical confidence threshold (e.g. 0.95 for 95%).
   * Must be between 0.5 and 0.999.
   */
  @IsNumber()
  @Min(0.5)
  @Max(0.999)
  confidenceLevel!: number;

  @IsArray()
  @IsOptional()
  secondaryMetrics?: string[];

  @IsNumber()
  @IsOptional()
  minSampleSize?: number;

  @IsString()
  @IsNotEmpty()
  featureFlagId!: string;
}
