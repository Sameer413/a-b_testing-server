import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProjectRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Project name must be at least 3 characters' })
  name!: string;

  @IsOptional()
  description?: string;
}
