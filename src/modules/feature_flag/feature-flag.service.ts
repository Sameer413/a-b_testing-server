import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { CreateFeatureFlagRequestDto } from './dto/feature-flag.dto';
import { randomBytes } from 'crypto';

import { DataSource, EntityManager, In, Repository } from 'typeorm';
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
    return this.dataSource.transaction(async (manager) => {
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
                isControl: true,   // 'On' is always the control baseline for boolean flags
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
  }

  async listFeatureFlags(id: string) {
    return this.featureFlagRepo.find({
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
    });
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
}
