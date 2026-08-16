import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Experiment } from './entities/experiment.entity';
import { AssignmentLog } from './entities/assignment-log.entity';
import { Event } from './entities/event.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Experiment, AssignmentLog, Event])],
    controllers: [],
    providers: [],
    exports: [TypeOrmModule],
})
export class ExperimentModule { }
