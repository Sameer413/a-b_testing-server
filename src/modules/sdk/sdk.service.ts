import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlag } from '../feature_flag/entities/feature.flag.entity';
import { FeatureFlagEnvironment } from '../feature_flag/entities/feature-flag-environment.entity';
import { EvaluateDto } from './dto/evaluate.dto';
import { Environment } from '../project/entities/environment.entity';
import { Variant } from '../feature_flag/entities/variant.entity';
import {
  TargetingCondition,
  TargetingRules,
} from 'src/common/interfaces/targeting-rule.interface';
import { createHash, randomInt } from 'crypto';
import { FlagType } from 'src/common/enums/flag-type.enum';
import { AllocationStrategy } from 'src/common/enums/allocation-strategy.enum';

@Injectable()
export class SdkService {
  constructor(
    @InjectRepository(FeatureFlag)
    private readonly flagRepo: Repository<FeatureFlag>,

    @InjectRepository(FeatureFlagEnvironment)
    private readonly ffEnvRepo: Repository<FeatureFlagEnvironment>,
  ) {}

  async evaluate(dto: EvaluateDto, environment: Environment) {
    const flag = await this.flagRepo.findOne({
      where: { key: dto.flagKey, project: { id: environment.project.id } },
      relations: { variants: true },
    });

    if (!flag) {
      throw new NotFoundException(`Flag "${dto.flagKey}" not found`);
    }

    const ffEnv = await this.ffEnvRepo.findOne({
      where: {
        featureFlag: {
          id: flag.id,
        },
        environment: {
          id: environment.id,
        },
      },
    });

    // ── STEP 2: Global kill switch ─────────────────────────────────────────
    if (!flag.enabled) {
      return this.buildResponse(flag.key, false, null, 'GLOBALLY_DISABLED');
    }

    // ── STEP 3: Per-env kill switch ────────────────────────────────────────
    if (!ffEnv || !ffEnv.enabled) {
      return this.buildResponse(flag.key, false, null, 'ENV_DISABLED');
    }

    // ── STEP 4: Targeting rules ────────────────────────────────────────────
    if (flag.targetingRules) {
      const matches = this.evaluateTargetingRules(
        flag.targetingRules,
        dto.userAttributes ?? {},
      );

      if (!matches) {
        return this.buildResponse(flag.key, false, null, 'TARGETING_MISS');
      }
    }

    // ── STEP 5: Rollout check ──────────────────────────────────────────────
    const rolloutBucket = this.getBucket(
      dto.userId,
      dto.flagKey,
      flag.hashSalt,
    );

    if (rolloutBucket >= ffEnv.rolloutPercentage) {
      return this.buildResponse(flag.key, false, null, 'OUT_OF_ROLLOUT');
    }

    // ── STEP 6: Variant assignment ─────────────────────────────────────────
    const variant = this.assignVariant(
      flag.variants,
      flag.flagType,
      flag.allocationStrategy,
      dto.userId,
      dto.flagKey,
      flag.hashSalt,
    );

    return this.buildResponse(dto.flagKey, true, variant, 'MATCH');
  }

  // ── Targeting Rules Engine ─────────────────────────────────────────────────

  private evaluateTargetingRules(
    rules: TargetingRules,
    attributes: Record<string, string | number | boolean>,
  ): boolean {
    // OR across groups — any group matching = user is targeted
    return rules.groups.some((group) =>
      // AND across conditions — all must be true within a group
      group.conditions.every((c) => this.evaluateCondition(c, attributes)),
    );
  }

  private evaluateCondition(
    condition: TargetingCondition,
    attributes: Record<string, string | number | boolean>,
  ): boolean {
    const actual = attributes[condition.attribute];
    const { operator, values } = condition;

    switch (operator) {
      case 'in':
        return values.includes(actual);
      case 'not_in':
        return !values.includes(actual);
      case 'equals':
        return actual === values[0];
      case 'not_equals':
        return actual !== values[0];
      case 'contains':
        return String(actual).includes(String(values[0]));
      case 'starts_with':
        return String(actual).startsWith(String(values[0]));
      case 'ends_with':
        return String(actual).endsWith(String(values[0]));
      case 'gt':
        return Number(actual) > Number(values[0]);
      case 'gte':
        return Number(actual) >= Number(values[0]);
      case 'lt':
        return Number(actual) < Number(values[0]);
      case 'lte':
        return Number(actual) <= Number(values[0]);
      case 'exists':
        return actual !== undefined && actual !== null;
      case 'not_exists':
        return actual === undefined || actual === null;
      default:
        return false;
    }
  }

  // ── Bucket / Hash Helpers ──────────────────────────────────────────────────
  private getBucket(userId: string, flagKey: string, salt?: string): number {
    const input = `${userId}${flagKey}${salt ?? ''}`;
    const hex = createHash('sha256').update(input).digest('hex').slice(0, 8);
    return parseInt(hex, 16) % 100; // deterministic 0–99 bucket
  }

  // ── Variant Assignment ─────────────────────────────────────────────────────

  private assignVariant(
    variants: Variant[],
    flagType: FlagType,
    strategy: AllocationStrategy,
    userId: string,
    flagKey: string,
    salt?: string,
  ): Variant {
    // BOOLEAN: always return "On" variant (rollout check already gated access)
    if (flagType === FlagType.BOOLEAN) {
      return variants.find((v) => v.name === 'On')!;
    }

    // Multi-Variant: pick by strategy
    let bucket: number;

    if (strategy === AllocationStrategy.RANDOM) {
      bucket = randomInt(0, 100);
    } else {
      bucket = this.getBucket(userId, flagKey, salt);
    }

    // Sort the variants for stable cumulative weight boundaries
    const sorted = [...variants].sort((a, b) => a.name.localeCompare(b.name));

    let cumulative = 0;
    for (const variant of sorted) {
      cumulative += Number(variant.weight);
      if (bucket < cumulative) {
        return variant;
      }
    }

    return sorted[0];
  }

  private buildResponse(
    flagKey: string,
    enabled: boolean,
    variant: Variant | null,
    reason: string,
  ) {
    return {
      flagKey,
      enabled,
      variant: variant?.name ?? null,
      value: variant?.value ?? null,
      valueType: variant?.valueType ?? null,
      reason,
    };
  }
}
