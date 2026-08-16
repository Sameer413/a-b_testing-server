import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectRequestDto } from './dto/project.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ResponseService } from '../../common/services/response-service';

@Controller('organizations/:organizationId/projects')
export class ProjectController {
    constructor(
        private readonly projectService: ProjectService,
        private readonly responseService: ResponseService,
    ) { }

    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.CREATED)
    @Post()
    async create(
        @Param('organizationId') organizationId: string,
        @Body() dto: CreateProjectRequestDto,
        @CurrentUser() user: User,
    ) {
        const project = await this.projectService.createProject(dto, organizationId, user);
        return this.responseService.success(project, 'Project created successfully');
    }

    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @Get()
    async findAll(
        @Param('organizationId') organizationId: string,
        @CurrentUser() user: User,
    ) {
        const projects = await this.projectService.findByOrganizationId(organizationId);
        return this.responseService.success(projects, 'Projects fetched successfully');
    }

}

