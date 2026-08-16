import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ProjectAuth } from 'src/common/decorators/project-auth.decorator';
import { Role } from 'src/common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import { CreateFeatureFlagRequestDto } from './dto/feature-flag.dto';
import { FeatureFlagService } from './feature-flag.service';
import { ResponseService } from 'src/common/services/response-service';

@Controller('projects/feature-flags')
export class FeatureFlagController {
  constructor(
    private readonly responseService: ResponseService,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  @ProjectAuth(Role.OWNER, Role.ADMIN, Role.DEVELOPER)
  @HttpCode(HttpStatus.CREATED)
  @Post(':projectId/create')
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateFeatureFlagRequestDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const featureFlag = await this.featureFlagService.createFeatureFlag(
      dto,
      req.project!,
      user,
    );
    return this.responseService.success(
      featureFlag,
      'Feature flag created successfully',
    );
  }

  @ProjectAuth(Role.OWNER, Role.ADMIN, Role.DEVELOPER)
  @HttpCode(HttpStatus.OK)
  @Get(':projectId/list')
  async list(@Param('projectId') projectId: string) {
    const featureFlags =
      await this.featureFlagService.listFeatureFlags(projectId);
    return this.responseService.success(
      featureFlags,
      'Feature flags fetched successfully',
    );
  }

  @ProjectAuth(Role.OWNER, Role.ADMIN, Role.DEVELOPER)
  @HttpCode(HttpStatus.CREATED)
  @Post(':projectId/create-key')
  async createFeatureFlagKey(
    // @Param('projectId') projectId: string,
    @Body('key') key: string,
    @Req() req: Request,
  ) {
    const featureFlag = await this.featureFlagService.createFeatureFlagKey(
      key,
      req.project!,
    );
    return this.responseService.success(featureFlag, 'Feature flag key created successfully');
  }
}
