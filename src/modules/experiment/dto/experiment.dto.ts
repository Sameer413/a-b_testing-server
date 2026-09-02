import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { ExperimentStatus } from "src/common/enums/experiment-status.enum";

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

    @IsNumber()
    @IsNotEmpty()
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

    @IsEnum(ExperimentStatus)
    @IsNotEmpty()
    status: ExperimentStatus = ExperimentStatus.DRAFT;
}
