import { Global, Module } from '@nestjs/common';
import { REDIS_CLIENT } from './redis.constants';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('redis.host');
        const port = configService.get<number>('redis.port', 6379);
        const password = configService.get<string>('redis.password');
        const tlsEnabled = configService.get<boolean>('redis.tls', true);

        if (!host) {
          throw new Error(
            'REDIS_HOST is not configured in environment variables',
          );
        }

        if (!password) {
          throw new Error(
            'REDIS_PASSWORD is not configured in environment variables',
          );
        }

        const client = new Redis({
          host,
          port,
          password: password || undefined,
          tls: tlsEnabled
            ? {
                rejectUnauthorized: true, // Validate SSL certificates
              }
            : undefined,
          maxRetriesPerRequest: null, // Required for BullMQ
          enableReadyCheck: false, // Reduce connection checks
          lazyConnect: false,
          keepAlive: 30000, // Keep connection alive for 30 seconds
          connectTimeout: 10000, // 10 second connection timeout
          retryStrategy: (times) => {
            // Limit retries and increase delay
            if (times > 10) {
              console.error('❌ Redis connection failed after 10 retries');
              return null; // Stop retrying
            }
            const delay = Math.min(times * 100, 3000);
            return delay;
          },
          reconnectOnError: (err) => {
            // Reconnect on specific errors
            const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
            return targetErrors.some((targetError) =>
              err.message.includes(targetError),
            );
          },
        });

        // Handle errors gracefully
        client.on('error', (err) => {
          // Only log non-transient errors
          if (!err.message.includes('ECONNRESET')) {
            console.error('Redis error:', err.message);
          }
        });

        // Only log once on initial connection
        let hasConnected = false;
        client.on('connect', () => {
          if (!hasConnected) {
            console.log(`🔌 Redis connected to ${host}:${port}`);
            hasConnected = true;
          }
        });

        return client;
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [RedisService, REDIS_CLIENT],
})
export class RedisModule {}
