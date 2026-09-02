import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Experiment } from './entities/experiment.entity';
import { AssignmentLog } from './entities/assignment-log.entity';
import { Event } from './entities/event.entity';
import { ExperimentService } from './experiment.service';
import { ProjectModule } from '../project/project.module';
import { FeatureFlagModule } from '../feature_flag/feature-flag.module';
import { ExperimentController } from './experiment.controller';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Experiment, AssignmentLog, Event]),
    CommonModule,
    ProjectModule,
    FeatureFlagModule,
  ],
  controllers: [ExperimentController],
  providers: [ExperimentService],
  exports: [TypeOrmModule],
})
export class ExperimentModule {}
