import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ExperimentService } from './experiment.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateExperimentDto } from './dto/experiment.dto';
import { User } from '../users/entities/user.entity';
import { Role } from 'src/common/enums/role.enum';
import { ProjectAuth } from 'src/common/decorators/project-auth.decorator';
import { ResponseService } from 'src/common/services/response-service';

@Controller('experiments')
export class ExperimentController {
  constructor(
    @Inject(ExperimentService)
    private readonly experimentService: ExperimentService,

    private readonly responseService: ResponseService,
  ) {}

  @Post('/create/:projectId')
  @UseGuards(JwtAuthGuard)
  @ProjectAuth(Role.OWNER, Role.ADMIN)
  async createExperiment(
    @Body() dto: CreateExperimentDto,
    @Req() req: any & { user: User },
    // @Param('projectId') projectId: string,
  ) {
    return this.experimentService.createExperiment(
      dto,
      req.project.id,
      req.user,
    );
  }

  @Get('/:experimentId')
  @UseGuards(JwtAuthGuard)
  @ProjectAuth(Role.OWNER, Role.ADMIN)
  async getExperiment(@Param('experimentId') experimentId: string) {
    return this.experimentService.findByIdOrThrow(experimentId);
  }

  @Put('/:experimentId/start')
  @UseGuards(JwtAuthGuard)
  //   @ProjectAuth(Role.OWNER, Role.ADMIN)
  async startExperiment(@Param('experimentId') experimentId: string) {
    const resp = await this.experimentService.startExperiment(experimentId);

    return this.responseService.success(
      null,
      `Experiment started for ${resp.name}`,
    );
  }

  @Put('/:experimentId/end')
  @UseGuards(JwtAuthGuard)
  //   @ProjectAuth(Role.OWNER, Role.ADMIN)
  async endExperiment(@Param('experimentId') experimentId: string) {
    const resp = await this.experimentService.endExperiment(experimentId);
    return this.responseService.success(
      null,
      `Experiment ended for ${resp.name}`,
    );
  }
}
