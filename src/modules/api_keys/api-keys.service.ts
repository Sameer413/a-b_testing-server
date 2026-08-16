import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiKey } from './entities/api.key.entity';
import { Repository } from 'typeorm';
import { Environment } from '../project/entities/environment.entity';
import { EnvironmentType } from 'src/common/enums/environment.type.enum';
import { createHash, randomBytes } from 'crypto';
import { GenerateApiKeyDto } from './dto/generate-api-key.dto';
import { Project } from '../project/entities/project.entity';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
    @InjectRepository(Environment)
    private readonly environmentRepo: Repository<Environment>,
  ) {}

  private readonly prefixMap: Record<EnvironmentType, string> = {
    [EnvironmentType.DEVELOPMENT]: 'sdk_dev_',
    [EnvironmentType.STAGING]: 'sdk_stg_',
    [EnvironmentType.PRODUCTION]: 'sdk_prod_',
  };

  private generateRawKey(env: EnvironmentType): string {
    const prefix = this.prefixMap[env];
    const secret = randomBytes(32).toString('hex');
    return `${prefix}${secret}`;
  }

  async generateApiKey(dto: GenerateApiKeyDto, project: Project) {
    const environment = await this.environmentRepo.findOne({
      where: { project: { id: project.id }, name: dto.environment },
    });

    if (!environment) {
      throw new NotFoundException(
        `Environment "${dto.environment}" not found for this project`,
      );
    }

    const existing = await this.apiKeyRepo.findOne({
      where: { environment: { id: environment.id }, active: true },
    });

    if (existing) {
      throw new ConflictException(
        `An active API key already exists for "${dto.environment}". Revoke it first or use the rotate endpoint.`,
      );
    }

    const rawKey = this.generateRawKey(dto.environment);

    const hashedKey = createHash('sha256').update(rawKey).digest('hex');

    const apiKey = this.apiKeyRepo.create({
      key: hashedKey,
      active: true,
      environment,
    });
    await this.apiKeyRepo.save(apiKey);

    return {
      id: apiKey.id,
      key: rawKey,
      environment: dto.environment,
      active: true,
      createdAt: apiKey.createdAt,
    };
  }

  async revokeApiKey(keyId: string, project: Project) {
    const apiKey = await this.apiKeyRepo.findOne({
      where: { id: keyId, environment: { project: { id: project.id } } },
      relations: { environment: true },
    });
    if (!apiKey) {
      throw new NotFoundException(`API key not found`);
    }
    apiKey.active = false;
    await this.apiKeyRepo.save(apiKey);
    return { message: `API key revoked successfully` };
  }

  async listApiKeys(project: Project) {
    // Return keys masked — never expose the stored hash or raw key
    const keys = await this.apiKeyRepo.find({
      where: { environment: { project: { id: project.id } } },
      relations: { environment: true },
    });
    return keys.map((k) => ({
      id: k.id,
      environment: k.environment.name,
      active: k.active,
      // Show only a hint — e.g. sdk_prod_a1b2...****
      keyHint: `${k.environment.name === 'production' ? 'sdk_prod_' : k.environment.name === 'staging' ? 'sdk_stg_' : 'sdk_dev_'}****`,
      createdAt: k.createdAt,
    }));
  }
}
