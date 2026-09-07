import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { RedisService } from 'src/database/redis/redis.service';
import { ApiKey } from 'src/modules/api_keys/entities/api.key.entity';
import { Environment } from 'src/modules/project/entities/environment.entity';
import { Repository } from 'typeorm';

const API_KEY_CACHE_TIME = 300 // 5 minutes

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,

    @Inject()
    private readonly redisService: RedisService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing API key');
    }

    const rawKey = authHeader.slice(7); // strip "Bearer "
    const hashedKey = createHash('sha256').update(rawKey).digest('hex');
    // const cacheKey = `apiKey:${hashedKey}`

    const environment = await this.getEnvironmentWithLock(hashedKey)


    // ---------------- With Cache ----------------
    // 
    // Uses the Cache-Aside pattern: 
    // 1. Check Redis for the environment. 
    // 2. On cache miss, fetch it from the database. 
    // 3. Store the result in Redis with a TTL. 
    // 4. Return the result. 
    // 
    // Note: This implementation is vulnerable to a cache stampede 
    // (thundering herd) when the cache entry expires or is missing. 
    // Multiple concurrent requests can all miss Redis and query the 
    // database simultaneously. 
    // 
    // TODO: Add request coalescing / distributed locking if this 
    // becomes a high-traffic path.
    // const environment = await this.redisService.cacheAside<Environment>(
    //   cacheKey,
    //   async () => {
    //     const apiKey = await this.apiKeyRepo.findOne({
    //       where: { key: hashedKey, active: true },
    //       relations: { environment: { project: true } }, // need project to scope flag lookup
    //     });

    //     if (!apiKey) {
    //       throw new UnauthorizedException('Invalid API key');
    //     }

    //     if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
    //       throw new UnauthorizedException('API key has expired');
    //     }

    //     return apiKey.environment;
    //   },
    //   API_KEY_CACHE_TIME
    // )

    // ----------------- Without Cache -----------------
    // const apiKey = await this.apiKeyRepo.findOne({
    //   where: { key: hashedKey, active: true },
    //   relations: { environment: { project: true } }, // need project to scope flag lookup
    // });

    // if (!apiKey) {
    //   throw new UnauthorizedException('Invalid API key');
    // }

    // if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
    //   throw new UnauthorizedException('API key has expired');
    // }

    request.sdkEnvironment = environment;
    return true;
  }

  private async getEnvironmentWithLock(hashedKey: string): Promise<Environment> {
    const cacheKey = `apiKey:${hashedKey}`;
    const lockKey = `lock:apiKey:${hashedKey}`;
    // const lockVal = `guard-${Date.now()}-${Math.random()}`; // unique per request
    const lockVal = randomUUID();

    // 1. Fast path - cache hit
    const cached = await this.redisService.getCache<Environment>(cacheKey);

    if (cached) {
      return cached;
    }

    // 2. Cache miss - race to acquire lock
    const gotLock = await this.redisService.acquireLock(lockKey, lockVal, 10); // 10s lock TTL

    if (gotLock) {
      // We are the ONE Winner - go to DB
      try {
        const apiKey = await this.apiKeyRepo.findOne({
          where: { key: hashedKey, active: true },
          relations: { environment: { project: true } }
        });

        if (!apiKey) throw new UnauthorizedException('Invalid API key');

        if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
          throw new UnauthorizedException('API key has expired')
        }

        await this.redisService.setCache(cacheKey, apiKey.environment, API_KEY_CACHE_TIME);
        return apiKey.environment;
      } finally {
        await this.redisService.releaseLock(lockKey, lockVal); // safe Lua release
      }
    }

    return this.pollForCache<Environment>(cacheKey);
  }

  private async pollForCache<T>(
    key: string,
    attempts = 10,
    intervalMs = 50,
  ): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      const cached = await this.redisService.getCache<T>(key);
      if (cached) return cached;
    }

    throw new UnauthorizedException('Invalid API key'); // lock winner failed
  }
}

