import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectRequestDto, UpdateProjectDto } from './dto/project.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ResponseService } from '../../common/services/response-service';

@Controller('organizations/:organizationId/projects')
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly responseService: ResponseService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  async create(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateProjectRequestDto,
    @CurrentUser() user: User,
  ) {
    const project = await this.projectService.createProject(
      dto,
      organizationId,
      user,
    );
    return this.responseService.success(
      project,
      'Project created successfully',
    );
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Get()
  async findAll(@Param('organizationId') organizationId: string) {
    const projects =
      await this.projectService.findByOrganizationId(organizationId);
    return this.responseService.success(
      projects,
      'Projects fetched successfully',
    );
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Put(':projectId')
  async updateProject(
    @Param('organizationId') organizationId: string,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: User,
  ) {
    const project = await this.projectService.updateProject(
      projectId,
      dto,
      organizationId,
      user,
    );
    return this.responseService.success(
      project,
      'Project updated successfully',
    );
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Delete(':projectId')
  async deleteProject(
    @Param('organizationId') organizationId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: User,
  ) {
    await this.projectService.softDeleteProject(
      projectId,
      organizationId,
      user,
    );
    return this.responseService.success(
      null,
      'Project deleted successfully',
    );
  }
}
