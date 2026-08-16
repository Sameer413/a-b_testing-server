import {
    IsEmail,
    IsNotEmpty,
    IsString,
    MinLength,
    IsOptional,
} from 'class-validator';

export class RegisterDto {
    @IsEmail()
    email!: string;

    @IsString()
    @IsNotEmpty()
    firstName!: string;

    @IsString()
    @IsNotEmpty()
    lastName!: string;

    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    password!: string;
}

export class LoginDto {
    @IsEmail()
    email!: string;

    @IsString()
    @IsNotEmpty()
    password!: string;
}

export class TokenResponseDto {
    accessToken!: string;

    @IsOptional()
    refreshToken?: string;

    expiresIn!: number;
    tokenType!: string;
}

export class UpdatePasswordDto {
    @IsString()
    @IsNotEmpty()
    currentPassword!: string;

    @IsString()
    @MinLength(8, { message: 'New password must be at least 8 characters' })
    newPassword!: string;
}
