import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { Environment } from './entities/environment.entity';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { OrganizationsModule } from '../organizations/organizations.module';
import { CommonModule } from '../../common/common.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Project, Environment]),
        OrganizationsModule,
        CommonModule,
    ],
    controllers: [ProjectController],
    providers: [ProjectService],
    exports: [ProjectService, TypeOrmModule],
})
export class ProjectModule { }
