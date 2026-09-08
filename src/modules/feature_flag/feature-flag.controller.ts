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
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { ToggleFlagEnvironmentDto } from './dto/toggle-flag.dto';

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
    return this.responseService.success(
      featureFlag,
      'Feature flag key created successfully',
    );
  }

  @ProjectAuth(Role.OWNER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Put(':projectId/:flagId')
  async update(
    @Param('projectId') projectId: string,
    @Param('flagId') flagId: string,
    @Body() dto: UpdateFeatureFlagDto,
    @Req() req: Request,
  ) {
    const featureFlag = await this.featureFlagService.updateFeatureFlag(
      flagId,
      req.project!.id,
      dto,
    );
    return this.responseService.success(
      featureFlag,
      'Feature flag updated successfully',
    );
  }

  @ProjectAuth(Role.OWNER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Put(':projectId/:flagId/toggle')
  async toggleEnvironment(
    @Param('flagId') flagId: string,
    @Body() dto: ToggleFlagEnvironmentDto,
    @Req() req: Request,
  ) {
    const result = await this.featureFlagService.toggleFlagEnvironment(
      flagId,
      req.project!.id,
      dto,
    );
    return this.responseService.success(
      result,
      'Feature flag environment updated successfully',
    );
  }

  @ProjectAuth(Role.OWNER, Role.ADMIN, Role.DEVELOPER)
  @HttpCode(HttpStatus.OK)
  @Get(':projectId/:flagId')
  async getById(@Param('flagId') flagId: string, @Req() req: Request) {
    const featureFlag = await this.featureFlagService.getFeatureFlag(
      flagId,
      req.project!.id,
    );
    return this.responseService.success(
      featureFlag,
      'Feature flag fetched successfully',
    );
  }

  @ProjectAuth(Role.OWNER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Delete(':projectId/:flagId')
  async delete(@Param('flagId') flagId: string, @Req() req: Request) {
    await this.featureFlagService.deleteFeatureFlag(flagId, req.project!.id);
    return this.responseService.success(
      null,
      'Feature flag deleted successfully',
    );
  }
}
