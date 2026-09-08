import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlag } from './entities/feature.flag.entity';
import { Variant } from './entities/variant.entity';
import { FeatureFlagEnvironment } from './entities/feature-flag-environment.entity';
import { FeatureFlagService } from './feature-flag.service';
import { FeatureFlagController } from './feature-flag.controller';
import { CommonModule } from '../../common/common.module';
import { ProjectModule } from '../project/project.module';
import { Environment } from '../project/entities/environment.entity';
import { Experiment } from '../experiment/entities/experiment.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([FeatureFlag, Variant, FeatureFlagEnvironment, Environment, Experiment]),
        CommonModule,
        ProjectModule,
    ],
    controllers: [FeatureFlagController],
    providers: [FeatureFlagService],
    exports: [TypeOrmModule, FeatureFlagService],
})
export class FeatureFlagModule { }
