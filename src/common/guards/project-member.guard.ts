import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Project } from '../../modules/project/entities/project.entity';
import { OrganizationsService } from '../../modules/organizations/organizations.service';

/**
 * Guards routes that operate on a project resource.
 *
 * Reads `:projectId` from the route params, resolves the project's
 * organization, then checks that the authenticated user holds at least
 * one of the roles declared via @Roles() on the handler/controller.
 *
 * Must run AFTER JwtAuthGuard (req.user must already be populated).
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, ProjectMemberGuard)
 *   @Roles(Role.OWNER, Role.ADMIN)
 *   @Post('projects/:projectId/flags')
 *   create(...) {}
 *
 * Or use the composite @ProjectAuth() decorator to avoid boilerplate.
 */
@Injectable()
export class ProjectMemberGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        @InjectRepository(Project)
        private readonly projectRepository: Repository<Project>,
        private readonly organizationsService: OrganizationsService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // If no @Roles() is declared, any authenticated project member passes
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const projectId: string = request.params?.projectId;

        if (!projectId) {
            // Route does not have :projectId — guard is misconfigured
            throw new ForbiddenException('Project ID is required for this operation');
        }

        // Load the project with its organization so we can check org membership
        const project = await this.projectRepository.findOne({
            where: { id: projectId },
            relations: { organization: true },
        });

        if (!project) {
            throw new NotFoundException(`Project "${projectId}" not found`);
        }

        const memberRole = await this.organizationsService.getMemberRole(
            project.organization.id,
            user.id,
        );
        if (!memberRole) {
            throw new ForbiddenException('You are not a member of this project\'s organization');
        }

        const hasRole = requiredRoles.includes(memberRole);
        if (!hasRole) {
            throw new ForbiddenException(
                `Required role(s): ${requiredRoles.join(', ')}. Your role: ${memberRole}`,
            );
        }

        // Attach resolved project to request so services don't need to re-fetch it
        request.project = project;

        return true;
    }
}
