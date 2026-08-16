import { IsEnum } from "class-validator";
import { EnvironmentType } from "src/common/enums/environment.type.enum";


export class GenerateApiKeyDto {
    @IsEnum(EnvironmentType)
    environment!: EnvironmentType;
}