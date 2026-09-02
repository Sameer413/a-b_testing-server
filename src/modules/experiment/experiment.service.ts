import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Experiment } from './entities/experiment.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ProjectService } from '../project/project.service';
import { CreateExperimentDto } from './dto/experiment.dto';
import { FeatureFlagService } from '../feature_flag/feature-flag.service';
import { User } from '../users/entities/user.entity';
import { CreateAssignmentLogDto } from './dto/assignment_log.dto';
import { AssignmentLog } from './entities/assignment-log.entity';

@Injectable()
export class ExperimentService {
  constructor(
    @InjectRepository(Experiment)
    private readonly experimentRepository: Repository<Experiment>,
    @InjectRepository(AssignmentLog)
    private readonly assignmentLogRepo: Repository<AssignmentLog>,

    @Inject(ProjectService)
    private readonly projectService: ProjectService,

    @Inject(FeatureFlagService)
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  async createExperiment(
    dto: CreateExperimentDto,
    projectId: string,
    user: User,
  ) {
    // const project = await this.projectService.findByIdOrThrow(projectId);

    const featureFlag = await this.featureFlagService.findByIdOrThrow(
      dto.featureFlagId,
    );

    const experiment = this.experimentRepository.create({
      ...dto,
      project: { id: projectId },
      featureFlag: { id: featureFlag.id },
      createdBy: { id: user.id },
    });

    return this.experimentRepository.save(experiment);
  }

  async findByIdOrThrow(id: string) {
    const experiment = await this.experimentRepository.findOne({
      where: { id },
    });
    if (!experiment) {
      throw new NotFoundException(`Experiment with id "${id}" not found`);
    }
    return experiment;
  }

  async startExperiment(experimentId: string) {
    const experiment = await this.findByIdOrThrow(experimentId);
    experiment.startedAt = new Date();
    return await this.experimentRepository.save(experiment);
  }

  async endExperiment(experimentId: string) {
    const experiment = await this.findByIdOrThrow(experimentId);
    experiment.endedAt = new Date();
    return await this.experimentRepository.save(experiment);
  }

  // Assignment Log
  async createAssignmentLog(dto: CreateAssignmentLogDto) {
    const featureFlag = await this.featureFlagService.findByIdOrThrow(
      dto.featureFlagId,
    );

    const variant = dto.variantId
      ? await this.featureFlagService.findVariantByIdOrThrow(dto.variantId)
      : null;

    const assignmentLog = this.assignmentLogRepo.create({
      userId: dto.userId,
      featureFlag: { id: featureFlag.id, name: featureFlag.name },
      variant: {
        id: variant?.id,
        name: variant?.name,
        value: variant?.value,
        valueType: variant?.valueType,
      },
    });

    await this.assignmentLogRepo.save(assignmentLog);
  }
}
