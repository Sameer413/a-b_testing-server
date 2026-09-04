import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from 'src/common/common.module';
import { ApiKey } from '../api_keys/entities/api.key.entity';
import { FeatureFlag } from '../feature_flag/entities/feature.flag.entity';
import { FeatureFlagEnvironment } from '../feature_flag/entities/feature-flag-environment.entity';
import { Variant } from '../feature_flag/entities/variant.entity';
import { Environment } from '../project/entities/environment.entity';
import { SdkController } from './sdk.controller';
import { ApiKeyGuard } from './guards/api-key.guard';
import { SdkService } from './sdk.service';
import { ExperimentModule } from '../experiment/experiment.module';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApiKey, // to validate the incoming API key
      FeatureFlag, // to load the flag by key
      FeatureFlagEnvironment, // to load per-env config
      Variant, // to pick variant
      Environment, // resolved from API key
    ]),
    TrackingModule,
    CommonModule,
    ExperimentModule
  ],
  controllers: [SdkController],
  providers: [TypeOrmModule, SdkService, ApiKeyGuard],
})
export class SdkModule { }
