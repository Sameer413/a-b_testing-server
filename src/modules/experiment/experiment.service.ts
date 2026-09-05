import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Experiment } from './entities/experiment.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ProjectService } from '../project/project.service';
import { CreateExperimentDto } from './dto/experiment.dto';
import { FeatureFlagService } from '../feature_flag/feature-flag.service';
import { User } from '../users/entities/user.entity';
import { CreateAssignmentLogDto } from './dto/assignment_log.dto';
import { AssignmentLog } from './entities/assignment-log.entity';
import { ExperimentStatus } from 'src/common/enums/experiment-status.enum';

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
  ) { }

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
      relations: {
        featureFlag: { variants: true },
        project: true,
        createdBy: true,
      },
    });
    if (!experiment) {
      throw new NotFoundException(`Experiment with id "${id}" not found`);
    }
    return experiment;
  }

  async findByFeatureFlagId(featureFlagId: string) {
    return await this.experimentRepository.findOne({
      where: {
        featureFlag: { id: featureFlagId },
        status: ExperimentStatus.RUNNING,
      },
    });
  }

  async startExperiment(experimentId: string) {
    // Load with featureFlag + variants — required for the checks below
    const experiment = await this.experimentRepository.findOne({
      where: { id: experimentId },
      relations: { featureFlag: { variants: true } },
    });
    if (!experiment) {
      throw new NotFoundException(`Experiment with id "${experimentId}" not found`);
    }
    if (experiment.status === ExperimentStatus.RUNNING) {
      throw new BadRequestException('Experiment is already running');
    }
    if (experiment.status === ExperimentStatus.CONCLUDED) {
      throw new BadRequestException('Cannot start a concluded experiment');
    }
    // 1. Validation: Flag is enabled
    if (!experiment.featureFlag.enabled) {
      throw new BadRequestException(
        'Cannot start experiment on a globally disabled feature flag',
      );
    }
    // 2. Validation: Flag has >= 2 variants
    if (
      !experiment.featureFlag.variants ||
      experiment.featureFlag.variants.length < 2
    ) {
      throw new BadRequestException(
        'Feature flag must have at least 2 variants to run an experiment',
      );
    }
    // 3. Validation: No other running experiment on this flag
    const runningExp = await this.experimentRepository.findOne({
      where: {
        featureFlag: { id: experiment.featureFlag.id },
        status: ExperimentStatus.RUNNING,
      },
    });
    if (runningExp && runningExp.id !== experiment.id) {
      throw new ConflictException(
        `Another experiment ("${runningExp.name}") is already running for this feature flag`,
      );
    }
    experiment.startedAt = new Date();
    experiment.status = ExperimentStatus.RUNNING;
    return await this.experimentRepository.save(experiment);
  }

  // Pause experiment: RUNNING -> PAUSED
  async pauseExperiment(experimentId: string) {
    const experiment = await this.findByIdOrThrow(experimentId);
    if (experiment.status !== ExperimentStatus.RUNNING) {
      throw new BadRequestException(
        `Cannot pause experiment in "${experiment.status}" state. Only RUNNING experiments can be paused.`,
      );
    }
    experiment.status = ExperimentStatus.PAUSED;
    return await this.experimentRepository.save(experiment);
  }
  // Resume experiment: PAUSED -> RUNNING
  async resumeExperiment(experimentId: string) {
    const experiment = await this.findByIdOrThrow(experimentId);
    if (experiment.status !== ExperimentStatus.PAUSED) {
      throw new BadRequestException(
        `Cannot resume experiment in "${experiment.status}" state. Only PAUSED experiments can be resumed.`,
      );
    }
    experiment.status = ExperimentStatus.RUNNING;
    return await this.experimentRepository.save(experiment);
  }
  // End experiment: status -> CONCLUDED
  async endExperiment(experimentId: string) {
    const experiment = await this.findByIdOrThrow(experimentId);
    if (experiment.status === ExperimentStatus.CONCLUDED) {
      throw new BadRequestException('Experiment is already concluded');
    }
    experiment.endedAt = new Date();
    experiment.status = ExperimentStatus.CONCLUDED;
    return await this.experimentRepository.save(experiment);
  }


  // List Experiments By Project Id
  async listExperimentsByProjectId(projectId: string) {
    if (!projectId) throw new BadRequestException('Project Id is required');

    return await this.experimentRepository.find({
      where: { project: { id: projectId } },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        // goalMetric: true,
        // successMetric: true,
        // trafficAllocation: true,
        // randomizationUnit: true,
        // segmentationExpression: true,
        createdAt: true,
        updatedAt: true,
        startedAt: true,
        endedAt: true,
      },
    });
  }

  // Assignment Log
  async createAssignmentLog(dto: CreateAssignmentLogDto) {
    // Check if assignment already exists for this user and feature flag
    const existing = await this.assignmentLogRepo.findOne({
      where: {
        userId: dto.userId,
        featureFlag: { id: dto.featureFlagId },
      },
    });
    if (existing) {
      return existing; // Already assigned, skip duplicate insert
    }

    const featureFlag = await this.featureFlagService.findByIdOrThrow(
      dto.featureFlagId,
    );

    const variant = dto.variantId
      ? await this.featureFlagService.findVariantByIdOrThrow(dto.variantId)
      : null;

    const assignmentLog = this.assignmentLogRepo.create({
      userId: dto.userId,
      featureFlag: { id: featureFlag.id, name: featureFlag.name },
      experiment: { id: dto.experimentId },
      variant: {
        id: variant?.id,
        name: variant?.name,
        value: variant?.value,
        valueType: variant?.valueType,
      },
      assignedAt: dto.assignedAt || new Date(),
      context: dto.context,
    });

    try {
      return await this.assignmentLogRepo.save(assignmentLog);
    } catch (err: any) {
      // Catch race condition constraint violation gracefully
      if (err.code === '23505') {
        return;
      }
      throw err;
    }
  }
}
