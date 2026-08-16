import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Observable } from 'rxjs';
import { ApiKey } from 'src/modules/api_keys/entities/api.key.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing API key');
    }

    const rawKey = authHeader.slice(7); // strip "Bearer "
    const hashedKey = createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await this.apiKeyRepo.findOne({
      where: { key: hashedKey, active: true },
      relations: { environment: { project: true } }, // need project to scope flag lookup
    });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.sdkEnvironment = apiKey.environment;

    return true;
  }
}
