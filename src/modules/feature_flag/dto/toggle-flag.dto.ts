// ─── Toggle Environment DTO ─────────────────────────────────────────────────────

import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class ToggleFlagEnvironmentDto {
  @IsUUID()
  environmentId!: string;

  /**
   * Enable or disable the flag in this specific environment.
   */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /**
   * Rollout percentage (0–100) for this environment.
   * 0 = off for everyone, 100 = fully rolled out.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;
}
