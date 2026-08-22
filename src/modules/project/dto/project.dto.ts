import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProjectRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Project name must be at least 3 characters' })
  name!: string;

  @IsOptional()
  description?: string;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Project name must be at least 3 characters' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
