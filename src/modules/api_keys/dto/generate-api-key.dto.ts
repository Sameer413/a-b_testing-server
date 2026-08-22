import { IsNotEmpty, IsOptional, IsString, IsDateString } from "class-validator";

export class GenerateApiKeyDto {
    @IsString()
    @IsNotEmpty()
    environment!: string;

    /** Optional human-readable label, e.g. "Mobile SDK key" */
    @IsOptional()
    @IsString()
    name?: string;

    /** Optional expiry date (ISO 8601). If set, the key is rejected after this date. */
    @IsOptional()
    @IsDateString()
    expiresAt?: string;
}