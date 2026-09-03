import {
  IsDate,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

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
}
