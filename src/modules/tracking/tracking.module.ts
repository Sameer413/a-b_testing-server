import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from 'src/common/common.module';
import { ApiKey } from '../api_keys/entities/api.key.entity';
import { Event } from '../experiment/entities/event.entity';
import { FeatureFlag } from '../feature_flag/entities/feature.flag.entity';
import { ApiKeyGuard } from '../sdk/guards/api-key.guard';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event,       // to write events
      FeatureFlag, // to resolve flagKey → id
      ApiKey,      // required by ApiKeyGuard (injected into the guard)
    ]),
    CommonModule, // ResponseService
  ],
  exports: [TrackingService],
  controllers: [TrackingController],
  providers: [TrackingService, ApiKeyGuard],
})
export class TrackingModule { }
