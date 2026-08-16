import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResponseService } from './services/response-service';
import { ProjectMemberGuard } from './guards/project-member.guard';
import { Project } from '../modules/project/entities/project.entity';
import { OrganizationsModule } from '../modules/organizations/organizations.module';

@Global() // Makes this module available to all modules without explicit imports
@Module({
    imports: [
        TypeOrmModule.forFeature([Project]),
        OrganizationsModule,
    ],
    providers: [ResponseService, ProjectMemberGuard],
    exports: [TypeOrmModule, OrganizationsModule, ResponseService, ProjectMemberGuard],
})
export class CommonModule { }

