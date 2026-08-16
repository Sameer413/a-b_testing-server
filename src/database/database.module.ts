import { ConfigModule, ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

async function ensureDatabaseExists(config: ConfigService): Promise<void> {
  const dbName = config.get<string>('database.database');
  const host = config.get<string>('database.host');
  const port = config.get<number>('database.port');
  const username = config.get<string>('database.username');
  const password = config.get<string>('database.password');

  if (!dbName) {
    return;
  }

  const client = new Client({
    host,
    port,
    user: username,
    password,
    database: 'postgres',
  });

  try {
    await client.connect();

    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );

    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
    }
  } catch (error) {
    // If we can't create the database, let TypeORM handle the failure as before.
    // You can replace this with a proper logger if desired.
    // eslint-disable-next-line no-console
    console.error('Failed to ensure database exists:', error);
  } finally {
    await client.end().catch(() => undefined);
  }
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        await ensureDatabaseExists(config);

        return {
          type: 'postgres',
          host: config.get<string>('database.host'),
          port: config.get<number>('database.port'),
          username: config.get<string>('database.username'),
          password: config.get<string>('database.password'),
          database: config.get<string>('database.database'),
          entities: [__dirname + '/../**/*.entity.{js,ts}'],
          synchronize: true,
          logging: false,
          ssl:
            config.get<string>('nodeEnv') === 'production'
              ? {
                  rejectUnauthorized: false,
                }
              : false,

          // ============================================
          // CONNECTION POOLING CONFIGURATION
          // ============================================
          extra: {
            // Maximum number of clients in the pool
            max: 20,

            // Minimum number of clients in the pool
            min: 5,

            // Maximum time (ms) a client can be idle before being closed
            idleTimeoutMillis: 30000,

            // Maximum time (ms) to wait for a connection from the pool
            connectionTimeoutMillis: 5000,

            // Maximum lifetime (ms) of a connection in the pool
            maxLifetime: 600000, // 10 minutes

            // Enable keep-alive for connections
            keepAlive: true,
            keepAliveInitialDelayMillis: 10000,
          },

          // ============================================
          // QUERY PERFORMANCE OPTIMIZATION
          // ============================================
          // Cache query results for 1 second (helps with repeated queries)
          cache: {
            duration: 1000, // 1 second
            type: 'database',
          },

          // Maximum query execution time (ms) before logging slow queries
          maxQueryExecutionTime: 1000,
        };
      },
    }),
  ],
})
export class DatabaseModule {}