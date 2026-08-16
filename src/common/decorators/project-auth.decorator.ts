import { applyDecorators, UseGuards } from '@nestjs/common';
import { Role } from '../enums/role.enum';
import { Roles } from './roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ProjectMemberGuard } from '../guards/project-member.guard';

/**
 * Composite decorator that bundles JWT authentication + project-level
 * role authorization into a single decorator.
 *
 * @param roles - The minimum roles allowed to access the endpoint.
 *                Pass no args to allow any authenticated project member.
 *
 * @example
 * // Only owners and admins can create flags
 * @ProjectAuth(Role.OWNER, Role.ADMIN)
 * @Post('projects/:projectId/flags')
 * create(...) {}
 *
 * @example
 * // Any project member can read flags
 * @ProjectAuth()
 * @Get('projects/:projectId/flags')
 * findAll(...) {}
 */
export const ProjectAuth = (...roles: Role[]) =>
    applyDecorators(
        Roles(...roles),
        UseGuards(JwtAuthGuard, ProjectMemberGuard),
    );
