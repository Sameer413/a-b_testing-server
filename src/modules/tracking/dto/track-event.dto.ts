import { Type } from "class-transformer";
import { IsArray, IsDateString, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";

export class TrackEventDto {
    @IsString()
    @IsNotEmpty()
    userId!: string;

    @IsString()
    @IsNotEmpty()
    flagKey!: string; // or featureFlagId

    @IsString()
    @IsNotEmpty()
    eventType!: string; // e.g. "click_cta", "purchase", "exposure"

    @IsOptional()
    @IsNumber()
    eventValue?: number; // e.g. 49.99 for revenue metrics

    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>; // e.g. { browser: "Chrome", page: "/cart" }

    @IsOptional()
    @IsString()
    eventId?: string; // Idempotency key for deduplication

    @IsOptional()
    @IsString()
    variantId?: string;  // which variant was shown — needed for exposure events

    @IsOptional()
    @IsDateString()
    occurredAt?: string;
}

export class BatchTrackEventsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TrackEventDto)
    events!: TrackEventDto[];
}
