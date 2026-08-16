import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { AuthInjectMiddleware } from './common/middleware/auth-inject.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProjectModule } from './modules/project/project.module';
import { FeatureFlagModule } from './modules/feature_flag/feature-flag.module';
import { ApiKeysModule } from './modules/api_keys/api-keys.module';
import { ExperimentModule } from './modules/experiment/experiment.module';
import { SdkModule } from './modules/sdk/sdk.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '.env.local'],
    }),

    // Database module
    DatabaseModule,

    // Common utilities (ResponseService, etc.)
    CommonModule,

    // BullMQ Module - must be initialized before any other modules that use it :: later implementation of task queue

    // Feature modules
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ProjectModule,
    FeatureFlagModule,
    ApiKeysModule,
    ExperimentModule,
    SdkModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // RolesGuard is NOT registered globally — project-scoped role checks
    // are handled by ProjectMemberGuard applied via @ProjectAuth().
    // ── Global Filter ────────────────────────────────────────────────────────
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },

    // ── Global Interceptor ───────────────────────────────────────────────────
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware, AuthInjectMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
