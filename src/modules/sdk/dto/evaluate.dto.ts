import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class EvaluateDto {
  @IsString()
  @IsNotEmpty()
  flagKey!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsOptional()
  @IsObject()
  userAttributes?: Record<string, string | number | boolean>;
}
