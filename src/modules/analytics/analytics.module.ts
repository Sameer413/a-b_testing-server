import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Experiment } from '../experiment/entities/experiment.entity';
import { AssignmentLog } from '../experiment/entities/assignment-log.entity';
import { Event } from '../experiment/entities/event.entity';

import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Experiment, AssignmentLog, Event]),
    CommonModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
