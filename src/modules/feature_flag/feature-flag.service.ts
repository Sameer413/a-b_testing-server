import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { CreateFeatureFlagRequestDto } from './dto/feature-flag.dto';
import { randomBytes } from 'crypto';

import { Repository } from 'typeorm';
import { FeatureFlag } from './entities/feature.flag.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ProjectService } from '../project/project.service';
import { Inject } from '@nestjs/common';
import { Project } from '../project/entities/project.entity';
import { FlagType } from '../../common/enums/flag-type.enum';
import { VariantValueType } from '../../common/enums/variant-value-type.enum.js';
import { FeatureFlagEnvironment } from './entities/feature-flag-environment.entity';
import { Environment } from '../project/entities/environment.entity';

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
  ) {}

  private generateFeatureKey(name: string): string {
    const base = name.toLowerCase().replace(/\s+/g, '-').substring(0, 8);
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    return `${base}-${suffix}`;
  }

  private async generateUniqueFeatureKey(name: string): Promise<string> {
    let featureKey = this.generateFeatureKey(name);
    while (await this.featureFlagRepo.findOne({ where: { key: featureKey } })) {
      featureKey = this.generateFeatureKey(name);
    }
    return featureKey;
  }

  async createFeatureFlag(
    dto: CreateFeatureFlagRequestDto,
    project: Project,
    user: User,
  ) {
    const featureKey = await this.generateUniqueFeatureKey(dto.name);

    // Build variant list based on flag type
    const variants =
      dto.flagType === FlagType.BOOLEAN
        ? [
            {
              name: 'On',
              weight: 100,
              value: 'true',
              valueType: VariantValueType.BOOLEAN,
            },
            {
              name: 'Off',
              weight: 0,
              value: 'false',
              valueType: VariantValueType.BOOLEAN,
            },
          ]
        : (dto.variants ?? []).map((v) => ({
            name: v.name,
            weight: v.weight,
            value: v.value,
            valueType: v.valueType,
          }));

    const featureFlag = this.featureFlagRepo.create({
      key: featureKey,
      name: dto.name,
      description: dto.description,
      flagType: dto.flagType,
      enabled: dto.enabled,
      allocationStrategy: dto.allocationStrategy,
      hashSalt: dto.hashSalt,
      project,
      createdBy: user,
      variants,
    });

    return this.featureFlagRepo.save(featureFlag);
  }

  async listFeatureFlags(id: string) {
    return this.featureFlagRepo.find({
      where: {
        project: { id: id },
      },
      relations: { project: true, createdBy: true, variants: true },
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
          targetingRules: null, // no targeting rules by default
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
}
