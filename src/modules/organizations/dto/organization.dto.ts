import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class CreateOrganizationDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(3, { message: 'Name must be at least 3 characters' })
    @MaxLength(50, { message: 'Name must not exceed 50 characters' })
    name: string;
}