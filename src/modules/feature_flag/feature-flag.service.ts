import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { CreateFeatureFlagRequestDto } from './dto/feature-flag.dto';
import { randomBytes } from 'crypto';

import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { FeatureFlag } from './entities/feature.flag.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ProjectService } from '../project/project.service';
import { Inject } from '@nestjs/common';
import { Project } from '../project/entities/project.entity';
import { FlagType } from '../../common/enums/flag-type.enum';
import { VariantValueType } from '../../common/enums/variant-value-type.enum.js';
import { FeatureFlagEnvironment } from './entities/feature-flag-environment.entity';
import { Environment } from '../project/entities/environment.entity';
import { Variant } from './entities/variant.entity';
import { RedisService } from 'src/database/redis/redis.service';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { ExperimentStatus } from 'src/common/enums/experiment-status.enum';
import { Experiment } from '../experiment/entities/experiment.entity';
import { ToggleFlagEnvironmentDto } from './dto/toggle-flag.dto';

@Injectable()
export class FeatureFlagService {
  constructor(
    @InjectRepository(FeatureFlag)
    private readonly featureFlagRepo: Repository<FeatureFlag>,
    @Inject(ProjectService)
    private readonly projectService: ProjectService,
    @InjectRepository(FeatureFlagEnvironment)
    private readonly ffEnvRepo: Repository<FeatureFlagEnvironment>,
    @InjectRepository(Environment)
    private readonly environmentRepo: Repository<Environment>,
    @InjectRepository(Variant)
    private readonly variantRepo: Repository<Variant>,
    @InjectRepository(Experiment)
    private readonly experimentRepo: Repository<Experiment>,

    @Inject()
    private readonly redisService: RedisService,

    private readonly dataSource: DataSource,
  ) {}

  private generateFeatureKey(name: string): string {
    const base = name.toLowerCase().replace(/\s+/g, '-').substring(0, 8);
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    return `${base}-${suffix}`;
  }

  private async generateUniqueFeatureKey(
    name: string,
    manager: EntityManager,
  ): Promise<string> {
    let featureKey = this.generateFeatureKey(name);
    const featureFlagRepo = manager.getRepository(FeatureFlag);

    while (await featureFlagRepo.findOne({ where: { key: featureKey } })) {
      featureKey = this.generateFeatureKey(name);
    }
    return featureKey;
  }

  async createFeatureFlag(
    dto: CreateFeatureFlagRequestDto,
    project: Project,
    user: User,
  ) {
    const result = this.dataSource.transaction(async (manager) => {
      // --------------------------------------------------
      // 1. Validate environments if provided
      // --------------------------------------------------

      const environmentDtos = dto.environments ?? [];

      let environments: Environment[] = [];

      if (environmentDtos.length > 0) {
        const environmentIds = environmentDtos.map((env) => env.environmentId);

        // Prevent duplicate environment IDs
        const uniqueEnvironmentIds = new Set(environmentIds);

        if (uniqueEnvironmentIds.size !== environmentIds.length) {
          throw new BadRequestException(
            'Duplicate environments are not allowed',
          );
        }

        // Only get environments belonging to this project
        environments = await manager.getRepository(Environment).find({
          where: {
            id: In(environmentIds),
            project: {
              id: project.id,
            },
          },
        });

        // Ensure every requested environment belongs to project
        if (environments.length !== environmentIds.length) {
          throw new BadRequestException(
            'One or more environments do not belong to this project',
          );
        }
      }

      // --------------------------------------------------
      // 2. Generate unique feature key
      // --------------------------------------------------

      const featureKey = await this.generateUniqueFeatureKey(dto.name, manager);

      // --------------------------------------------------
      // 3. Build variants
      // --------------------------------------------------

      const variants =
        dto.flagType === FlagType.BOOLEAN
          ? [
              {
                name: 'On',
                weight: 100,
                value: 'true',
                valueType: VariantValueType.BOOLEAN,
                isControl: true, // 'On' is always the control baseline for boolean flags
              },
              {
                name: 'Off',
                weight: 0,
                value: 'false',
                valueType: VariantValueType.BOOLEAN,
                isControl: false,
              },
            ]
          : (dto.variants ?? []).map((variant) => ({
              name: variant.name,
              weight: variant.weight,
              value: variant.value,
              valueType: variant.valueType,
              isControl: variant.isControl ?? false,
            }));

      // --------------------------------------------------
      // 3.5. Variant Validation - Weight Sum = 100
      // --------------------------------------------------

      if (dto.flagType !== FlagType.BOOLEAN) {
        if (variants.length === 0) {
          throw new BadRequestException('At least one variant is required');
        }

        const variantNames = variants.map((v) => v.name.trim());
        const uniqueNames = new Set(variantNames);

        if (uniqueNames.size !== variantNames.length) {
          throw new BadRequestException(
            'Duplicate variant names are not allowed',
          );
        }

        for (const variant of variants) {
          if (variant.weight < 0 || variant.weight > 100) {
            throw new BadRequestException(
              `Variant "${variant.name}" weight must be between 0 and 100`,
            );
          }
        }

        const totalWeight = variants.reduce(
          (sum, variant) => sum + variant.weight,
          0,
        );

        if (totalWeight > 100) {
          throw new BadRequestException(
            'Total variant weight cannot exceed 100',
          );
        }
      }

      // --------------------------------------------------
      // 4. Create FeatureFlag
      // --------------------------------------------------

      const featureFlag = manager.getRepository(FeatureFlag).create({
        key: featureKey,
        name: dto.name,
        description: dto.description,
        flagType: dto.flagType,
        enabled: dto.enabled,
        allocationStrategy: dto.allocationStrategy,
        hashSalt: dto.hashSalt ?? randomBytes(8).toString('hex'),

        targetingRules: dto.targetingRules ?? null,

        project,
        createdBy: user,
        variants,
      });

      const savedFeatureFlag = await manager
        .getRepository(FeatureFlag)
        .save(featureFlag);

      // --------------------------------------------------
      // 5. Create FeatureFlagEnvironment ONLY if provided
      // --------------------------------------------------

      if (environmentDtos.length > 0) {
        const environmentMap = new Map(
          environments.map((env) => [env.id, env]),
        );

        const featureFlagEnvironments = environmentDtos.map((envDto) =>
          manager.getRepository(FeatureFlagEnvironment).create({
            featureFlag: savedFeatureFlag,
            environment: environmentMap.get(envDto.environmentId)!,

            enabled: envDto.enabled ?? false,

            rolloutPercentage: envDto.rolloutPercentage ?? 100,
          }),
        );

        await manager
          .getRepository(FeatureFlagEnvironment)
          .save(featureFlagEnvironments);
      }

      // --------------------------------------------------
      // 6. Return feature flag
      // --------------------------------------------------

      return manager.getRepository(FeatureFlag).findOne({
        where: {
          id: savedFeatureFlag.id,
        },
        relations: {
          variants: true,
          environmentOverrides: {
            environment: true,
          },
        },
      });
    });

    await this.invalidateFlagsCache(project.id);

    return result;
  }

  // Test latter
  async updateFeatureFlag(
    flagId: string,
    projectId: string,
    dto: UpdateFeatureFlagDto,
  ) {
    const flag = await this.featureFlagRepo.findOne({
      where: { id: flagId, project: { id: projectId } },
      relations: {
        project: true,
        variants: true,
        environmentOverrides: { environment: true },
      },
    });

    if (!flag) {
      throw new NotFoundException(
        `Feature flag with id "${flagId}" not found in this project`,
      );
    }

    // 2. Guard: block experiment-sensitive fields if a RUNNING experiment exists
    const experimentSensitiveFields: (keyof UpdateFeatureFlagDto)[] = [
      'enabled',
      'targetingRules',
      'allocationStrategy',
    ];
    const isChangingSensitiveField = experimentSensitiveFields.some(
      (field) => dto[field] !== undefined,
    );

    if (isChangingSensitiveField) {
      const runningExperiment = await this.experimentRepo.findOne({
        where: {
          featureFlag: { id: flagId },
          status: ExperimentStatus.RUNNING,
        },
      });
      if (runningExperiment) {
        throw new ConflictException(
          `Cannot update experiment-sensitive fields while experiment "${runningExperiment.name}" is running. ` +
            `Pause or end the experiment first.`,
        );
      }
    }

    // 3. Apply partial updates (only provided fields)
    if (dto.name !== undefined) flag.name = dto.name;
    if (dto.description !== undefined) flag.description = dto.description;
    if (dto.enabled !== undefined) flag.enabled = dto.enabled;
    if (dto.allocationStrategy !== undefined)
      flag.allocationStrategy = dto.allocationStrategy;
    // targetingRules: null explicitly removes targeting, undefined means "don't change"
    if (dto.targetingRules !== undefined) {
      flag.targetingRules = dto.targetingRules;
    }
    // 4. Save
    const saved = await this.featureFlagRepo.save(flag);

    // 5. Cache invalidation
    // Invalidate the project-level flag list cache
    await this.invalidateFlagsCache(projectId);

    // Invalidate per-flag SDK caches (each env has its own cache key)
    if (flag.environmentOverrides?.length) {
      const sdkCacheKeys = flag.environmentOverrides.map(
        (eo) => `flag:${flag.key}:env:${eo.environment?.id ?? projectId}`,
      );
      await this.redisService.del(...sdkCacheKeys);
    }
    // 6. Return fresh data with all relations
    return this.featureFlagRepo.findOne({
      where: { id: saved.id },
      relations: {
        variants: true,
        environmentOverrides: { environment: true },
        project: true,
        createdBy: true,
      },
      select: {
        project: { id: true, name: true },
        createdBy: { id: true, firstName: true, lastName: true },
      },
    })!;
  }

  // ── Cache key ──────────────────────────────────────────────────────────────
  private flagListCacheKey(projectId: string): string {
    return `flags:project:${projectId}`;
  }

  // ── Invalidation helper — call from all write paths ────────────────────────
  async invalidateFlagsCache(projectId: string): Promise<void> {
    await this.redisService.del(this.flagListCacheKey(projectId));
  }

  async listFeatureFlags(id: string) {
    return this.redisService.cacheAside(
      this.flagListCacheKey(id),
      async () =>
        this.featureFlagRepo.find({
          where: {
            project: { id: id },
          },
          relations: {
            project: {
              environments: true,
            },
            createdBy: true,
            variants: true,
          },
          select: {
            project: { id: true, name: true },
            createdBy: { id: true, firstName: true, lastName: true },
          },
        }),
      30,
    );
  }

  async createFeatureFlagKey(key: string, project: Project) {
    const flag = await this.featureFlagRepo.findOne({
      where: {
        key: key,
        project: {
          id: project.id,
        },
      },
      relations: {
        variants: true,
        environmentOverrides: { environment: true },
      },
    });

    if (!flag) {
      throw new NotFoundException(
        `Feature flag with key "${key}" not found in this project`,
      );
    }

    const environments = await this.environmentRepo.find({
      where: {
        project: {
          id: project.id,
        },
      },
    });

    const existingEnvIds = new Set(flag.environmentOverrides.map((o) => o.id));

    const toCreate = environments
      .filter((env) => !existingEnvIds.has(env.id))
      .map((env) =>
        this.ffEnvRepo.create({
          featureFlag: flag,
          environment: env,
          enabled: false, // off by default — enable per-env explicitly
          rolloutPercentage: 100, // 100% of eligible users once enabled
        }),
      );

    if (toCreate.length > 0) {
      await this.ffEnvRepo.save(toCreate);
    }

    return this.featureFlagRepo.findOne({
      where: { id: flag.id },
      relations: {
        variants: true,
        environmentOverrides: { environment: true },
        project: true,
        createdBy: true,
      },
      select: {
        project: { id: true, name: true },
        createdBy: { id: true, firstName: true, lastName: true },
      },
    });
  }

  async findByIdOrThrow(id: string) {
    const featureFlag = await this.featureFlagRepo.findOne({ where: { id } });
    if (!featureFlag) {
      throw new NotFoundException(`Feature flag with id "${id}" not found`);
    }
    return featureFlag;
  }

  async findVariantByIdOrThrow(variantId: string) {
    const variant = await this.variantRepo.findOne({
      where: {
        id: variantId,
      },
    });

    if (!variant) {
      throw new NotFoundException(
        `Feature flag with id "${variantId}" not found`,
      );
    }
    return variant;
  }

  async getFeatureFlagById(flagId: string) {
    const flag = await this.featureFlagRepo.findOne({
      where: {
        id: flagId,
      },
      relations: {
        variants: true,
        environmentOverrides: true,
      },
    });

    if (!flag) {
      throw new NotFoundException(`Flag not found with id: ${flagId}`);
    }

    return flag;
  }

  async getFeatureFlag(
    flagId: string,
    projectId: string,
  ): Promise<FeatureFlag> {
    const flag = await this.featureFlagRepo.findOne({
      where: {
        id: flagId,
        project: { id: projectId },
        deletedAt: IsNull(), // exclude soft-deleted
      },
      relations: {
        variants: true,
        environmentOverrides: { environment: true },
        project: true,
        createdBy: true,
      },
      select: {
        project: { id: true, name: true },
        createdBy: { id: true, firstName: true, lastName: true },
      },
    });
    if (!flag) {
      throw new NotFoundException(
        `Feature flag with id "${flagId}" not found in this project`,
      );
    }
    return flag;
  }

  // ── Soft Delete Feature Flag ──────────────────────────────────────────────────

  async deleteFeatureFlag(flagId: string, projectId: string): Promise<void> {
    // 1. Load flag scoped to project
    const flag = await this.featureFlagRepo.findOne({
      where: {
        id: flagId,
        project: { id: projectId },
        deletedAt: IsNull(),
      },
      relations: { environmentOverrides: { environment: true } },
    });

    if (!flag) {
      throw new NotFoundException(
        `Feature flag with id "${flagId}" not found in this project`,
      );
    }

    // 2. Block deletion if a RUNNING experiment is attached
    const runningExperiment = await this.experimentRepo.findOne({
      where: {
        featureFlag: { id: flagId },
        status: ExperimentStatus.RUNNING,
      },
    });

    if (runningExperiment) {
      throw new ConflictException(
        `Cannot delete flag while experiment "${runningExperiment.name}" is running. ` +
          `End the experiment first.`,
      );
    }

    // 3. Soft delete
    flag.deletedAt = new Date();
    await this.featureFlagRepo.save(flag);

    // 4. Invalidate all caches
    await this.invalidateFlagsCache(projectId);

    // Invalidate per-env SDK caches
    if (flag.environmentOverrides?.length) {
      const sdkCacheKeys = flag.environmentOverrides.map(
        (eo) => `flag:${flag.key}:env:${eo.environment?.id ?? projectId}`,
      );
      await this.redisService.del(...sdkCacheKeys);
    }
  }

  // ── Toggle Flag per Environment ───────────────────────────────────────────────
  // Test Latter
  async toggleFlagEnvironment(
    flagId: string,
    projectId: string,
    dto: ToggleFlagEnvironmentDto,
  ): Promise<FeatureFlagEnvironment> {
    // 1. Verify the flag belongs to this project
    const flag = await this.featureFlagRepo.findOne({
      where: { id: flagId, project: { id: projectId } },
    });

    if (!flag) {
      throw new NotFoundException(
        `Feature flag with id "${flagId}" not found in this project`,
      );
    }

    // 2. Verify the environment belongs to this project
    const environment = await this.environmentRepo.findOne({
      where: { id: dto.environmentId, project: { id: projectId } },
    });

    if (!environment) {
      throw new NotFoundException(
        `Environment with id "${dto.environmentId}" not found in this project`,
      );
    }

    // 3. Find or create the FeatureFlagEnvironment record
    let ffEnv = await this.ffEnvRepo.findOne({
      where: {
        featureFlag: { id: flagId },
        environment: { id: dto.environmentId },
      },
      relations: { environment: true, featureFlag: true },
    });

    if (!ffEnv) {
      // Auto-create if the flag exists but wasn't linked to this env yet
      ffEnv = this.ffEnvRepo.create({
        featureFlag: flag,
        environment,
        enabled: dto.enabled ?? false,
        rolloutPercentage: dto.rolloutPercentage ?? 100,
      });
    } else {
      // Apply partial updates
      if (dto.enabled !== undefined) ffEnv.enabled = dto.enabled;
      if (dto.rolloutPercentage !== undefined)
        ffEnv.rolloutPercentage = dto.rolloutPercentage;
    }

    const saved = await this.ffEnvRepo.save(ffEnv);

    // 4. Invalidate SDK cache for this specific flag+env combo
    const sdkCacheKey = `flag:${flag.key}:env:${dto.environmentId}`;
    await this.redisService.del(sdkCacheKey);

    // Reload with relations for the response
    return (await this.ffEnvRepo.findOne({
      where: { id: saved.id },
      relations: { environment: true, featureFlag: true },
    }))!;
  }
}
