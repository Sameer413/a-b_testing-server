import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { Repository } from 'typeorm';
import { CreateProjectRequestDto } from './dto/project.dto';
import { OrganizationsService } from '../organizations/organizations.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import { Environment } from './entities/environment.entity';
import { EnvironmentType } from '../../common/enums/environment.type.enum';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,

    @InjectRepository(Environment)
    private readonly environmentRepository: Repository<Environment>,

    private readonly organizationService: OrganizationsService,
  ) { }

  private generateProjectId(name: string): string {
    const base = name.toLowerCase().replace(/\s+/g, '-').substring(0, 8);
    const suffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${base}-${suffix}`;
  }

  private async generateUniqueProjectId(name: string): Promise<string> {
    let projectId = this.generateProjectId(name);
    while (await this.projectRepository.findOne({ where: { projectId } })) {
      projectId = this.generateProjectId(name);
    }
    return projectId;
  }

  async createProject(dto: CreateProjectRequestDto, organizationId: string, user: User): Promise<Project> {
    // 1. Verify organization exists
    const organization = await this.organizationService.getOrganizationById(organizationId);
    if (!organization) {
      throw new NotFoundException(`Organization with id "${organizationId}" not found`);
    }

    // 2. Check user has OWNER or ADMIN role in this organization
    const memberRole = await this.organizationService.getMemberRole(organizationId, user.id);
    if (memberRole !== Role.OWNER && memberRole !== Role.ADMIN) {
      throw new ForbiddenException('Only Owners and Admins can create projects');
    }

    // 3. Generate unique project ID
    const projectId = await this.generateUniqueProjectId(dto.name);

    // 4. Create and save project
    const project = this.projectRepository.create({
      projectId,
      name: dto.name,
      description: dto.description,
      organization,
    });

    const savedProject = await this.projectRepository.save(project);

    // 5. Seed default environments
    const defaultEnvironments = this.environmentRepository.create([
      { name: EnvironmentType.DEVELOPMENT, project: savedProject },
      { name: EnvironmentType.STAGING, project: savedProject },
      { name: EnvironmentType.PRODUCTION, project: savedProject },
    ]);
    await this.environmentRepository.save(defaultEnvironments);

    return savedProject;
  }

  async findByIdOrThrow(id: string) {
    const project = await this.projectRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project with id "${id}" not found`);
    }
    return project;
  }

  async findByProjectIdOrThrow(projectId: string) {
    const project = await this.projectRepository.findOne({ where: { projectId } });
    if (!project) {
      throw new NotFoundException(`Project with id "${projectId}" not found`);
    }
    return project;
  }

  async findByOrganizationId(organizationId: string) {
    const projects = await this.projectRepository.find({
      where: {
        organization: {
          id: organizationId
        }
      }
    })

    return projects;
  }
}
