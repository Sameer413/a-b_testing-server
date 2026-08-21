import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from './redis.constants';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
  ) {}

  /**
   * Get a value from Redis
   */
  async get(key: string) {
    return this.redisClient.get(key);
  }

  /**
   * Sets a value in Redis with an Optional expiration time in seconds
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redisClient.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.redisClient.set(key, value);
    }
  }

  /**
   * Deletes a value from Redis
   */
  async del(...keys: string[]): Promise<number> {
    return this.redisClient.del(keys);
  }

  /**
   * Acquires a lock for a specific key
   * Implementing the 'NX' (Not eXists) and 'EX' (Expiration) logic
   * @returns boolean true if lock was acquired, false otherwise
   */
  async acquireLock(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    // 'NX' ensures we only set if it does not exist
    // 'EX' ensures the lock expires automatically to prevent deadlocks
    const result = await this.redisClient.set(
      key,
      value,
      'EX',
      ttlSeconds,
      'NX',
    );
    return result === 'OK';
  }

  /**
   * Safely release a lock ONLY if the value matches what we set it to.
   * This prevents a delayed process from releasing a lock that expired and was acquired by another process.
   */
  async releaseLock(key: string, value: string): Promise<boolean> {
    // Lua script to check if the value matches before deleting
    const script = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
        `;
    const result = await this.redisClient.eval(script, 1, key, value);
    return result === 1;
  }

  // ============================================
  // CACHING UTILITIES (Performance Optimization)
  // ============================================

  /**
   * Get cached data with automatic JSON parsing
   * @param key Cache key
   * @returns Parsed object or null if not found
   */
  async getCache<T>(key: string): Promise<T | null> {
    const data = await this.redisClient.get(key);
    if (!data) return null;

    try {
      return JSON.parse(data) as T;
    } catch {
      return data as T;
    }
  }

  /**
   * Set cached data with automatic JSON stringification
   * @param key Cache key
   * @param value Data to cache
   * @param ttlSeconds TTL in seconds (default: 60)
   */
  async setCache<T>(
    key: string,
    value: T,
    ttlSeconds: number = 60,
  ): Promise<void> {
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    await this.redisClient.set(key, data, 'EX', ttlSeconds);
  }

  /**
   * Cache-aside pattern: Get from cache or execute function and cache result
   * @param key Cache key
   * @param fetchFn Function to fetch data if cache miss
   * @param ttlSeconds TTL in seconds (default: 60)
   * @returns Cached or freshly fetched data
   */
  async cacheAside<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = 60,
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.getCache<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch data
    const data = await fetchFn();

    // Store in cache (fire and forget)
    this.setCache(key, data, ttlSeconds).catch(() => {
      // Ignore cache write errors
    });

    return data;
  }

  /**
   * Invalidate cache by pattern (e.g., "product:*")
   * @param pattern Redis key pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    const keys = await this.redisClient.keys(pattern);
    if (keys.length === 0) return 0;
    return this.redisClient.del(...keys);
  }

  /**
   * Get multiple keys at once (pipeline for performance)
   * @param keys Array of cache keys
   * @returns Array of values (null for cache misses)
   */
  async mget<T>(...keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];

    const values = await this.redisClient.mget(...keys);
    return values.map((v) => {
      if (!v) return null;
      try {
        return JSON.parse(v) as T;
      } catch {
        return v as T;
      }
    });
  }

  /**
   * Set multiple keys at once (pipeline for performance)
   * @param entries Array of [key, value, ttl] tuples
   */
  async mset(entries: Array<[string, any, number?]>): Promise<void> {
    if (entries.length === 0) return;

    const pipeline = this.redisClient.pipeline();

    for (const [key, value, ttl] of entries) {
      const data = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttl) {
        pipeline.set(key, data, 'EX', ttl);
      } else {
        pipeline.set(key, data);
      }
    }

    await pipeline.exec();
  }

  /**
   * Check if key exists
   * @param key Cache key
   * @returns true if exists, false otherwise
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.redisClient.exists(key);
    return result === 1;
  }

  /**
   * Get TTL (time to live) for a key
   * @param key Cache key
   * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist
   */
  async ttl(key: string): Promise<number> {
    return this.redisClient.ttl(key);
  }

  /**
   * Get raw client if needed for complex transactions or features
   */
  getClient(): Redis {
    return this.redisClient;
  }
}
