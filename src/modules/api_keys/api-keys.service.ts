import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiKey } from './entities/api.key.entity';
import { Repository } from 'typeorm';
import { Environment } from '../project/entities/environment.entity';
import { createHash, randomBytes } from 'crypto';
import { GenerateApiKeyDto } from './dto/generate-api-key.dto';
import { Project } from '../project/entities/project.entity';
import { RedisService } from 'src/database/redis/redis.service';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
    @InjectRepository(Environment)
    private readonly environmentRepo: Repository<Environment>,
    @Inject()
    private readonly redisService: RedisService,
  ) { }

  /** Known prefixes for default environments; custom ones get a generic prefix. */
  private readonly knownPrefixes: Record<string, string> = {
    development: 'sdk_dev_',
    staging: 'sdk_stg_',
    production: 'sdk_prod_',
  };

  private generateRawKey(envName: string): string {
    const prefix = this.knownPrefixes[envName] ?? `sdk_${envName.slice(0, 4)}_`;
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
      name: dto.name,
      active: true,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      environment,
    });
    await this.apiKeyRepo.save(apiKey);

    return {
      id: apiKey.id,
      key: rawKey,
      name: apiKey.name,
      environment: dto.environment,
      active: true,
      expiresAt: apiKey.expiresAt,
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

    // Bust the Redis cache so the guard rejects this key immediately
    await this.redisService.del(`apiKey:${apiKey.key}`);

    return { message: `API key revoked successfully` };
  }

  async listApiKeys(project: Project) {
    // Return keys masked — never expose the stored hash or raw key
    const keys = await this.apiKeyRepo.find({
      where: { environment: { project: { id: project.id } } },
      relations: { environment: true },
    });
    return keys.map((k) => {
      const prefix = this.knownPrefixes[k.environment.name] ?? `sdk_${k.environment.name.slice(0, 4)}_`;
      return {
        id: k.id,
        name: k.name,
        environment: k.environment.name,
        active: k.active,
        keyHint: `${prefix}****`,
        expiresAt: k.expiresAt,
        createdAt: k.createdAt,
      };
    });
  }
}
