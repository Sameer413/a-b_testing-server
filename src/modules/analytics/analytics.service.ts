import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Experiment } from '../experiment/entities/experiment.entity';
import { Repository } from 'typeorm';
import { AssignmentLog } from '../experiment/entities/assignment-log.entity';
import {
  ExperimentResultsDto,
  VariantResultDto,
} from './dto/experiment-results.dto';
import { conversionRate } from './stats/conversion-rate';
import { wilsonInterval } from './stats/confidence-interval';
import { relativeLift } from './stats/lift';
import { zTest } from './stats/significance';
import { requiredSampleSize } from './stats/sample-size';
import { Event } from '../experiment/entities/event.entity';

interface VariantCount {
  variantId: string;
  count: string; // raw string from postgres COUNT()
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Experiment)
    private readonly experimentRepo: Repository<Experiment>,
    @InjectRepository(AssignmentLog)
    private readonly assignmentRepo: Repository<AssignmentLog>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
  ) {}

  async getExperimentResults(
    experimentId: string,
  ): Promise<ExperimentResultsDto> {
    // ── 1. Load experiment with flag + variants ───────────────────────────────
    const experiment = await this.experimentRepo.findOne({
      where: {
        id: experimentId,
      },
      relations: {
        featureFlag: {
          variants: true,
        },
      },
    });

    if (!experiment) {
      throw new NotFoundException(
        `Experiment not found with id: ${experimentId}`,
      );
    }

    const variants = experiment.featureFlag.variants ?? [];

    // ── 2. Exposed count per variant (assignment_logs) ────────────────────────
    const exposedRaw: VariantCount[] = await this.assignmentRepo
      .createQueryBuilder('al')
      .select('al.variantId', 'variantId')
      .addSelect('COUNT(DISTINCT al.userId)', 'count')
      .where('al.experimentId = :experimentId', { experimentId })
      .groupBy('al.variantId')
      .getRawMany();

    const exposedMap = new Map<string, number>(
      exposedRaw.map((r) => [r.variantId, parseInt(r.count, 10)]),
    );

    // ── 3. Converter count per variant (events JOIN assignment_logs) ──────────
    //    Only count users assigned to that variant who fired the primary metric.
    const convertersRaw: VariantCount[] = await this.eventRepo
      .createQueryBuilder('e')
      .innerJoin(
        AssignmentLog,
        'al',
        'al.userId = e.userId AND al.experimentId = :experimentId',
        { experimentId },
      )
      .select('al.variantId', 'variantId')
      .addSelect('COUNT(DISTINCT e.userId)', 'count')
      .where('e.featureFlagId = :flagId', { flagId: experiment.featureFlag.id })
      .andWhere('e.eventType = :metric', { metric: experiment.primaryMetric })
      .groupBy('al.variantId')
      .getRawMany();

    const convertersMap = new Map<string, number>(
      convertersRaw.map((r) => [r.variantId, parseInt(r.count, 10)]),
    );

    // ── 4. Identify control ───────────────────────────────────────────────────
    const controlVariant = variants.find((v) => v.isControl) ?? variants[0];

    const controlExposed = exposedMap.get(controlVariant?.id) ?? 0;
    const controlConverters = convertersMap.get(controlVariant?.id) ?? 0;
    const controlRate = conversionRate(controlConverters, controlExposed);

    // ── 5. Build per-variant results ──────────────────────────────────────────
    const alpha = 1 - experiment.confidenceLevel; // e.g. 0.05

    const variantResults: VariantResultDto[] = variants.map((v) => {
      const exposed = exposedMap.get(v.id) ?? 0;
      const converters = convertersMap.get(v.id) ?? 0;
      const rate = conversionRate(converters, exposed);
      const ci = wilsonInterval(converters, exposed);
      const isControl = v.id === controlVariant.id;

      const lift = isControl ? null : relativeLift(controlRate, rate);

      const zResult = isControl
        ? null
        : zTest(controlConverters, controlExposed, converters, exposed, alpha);

      // Winner: significantly better lift than control
      const isSignificant = zResult?.isSignificant ?? false;
      const isWinner = isSignificant && (lift ?? 0) > 0;

      return {
        variantId: v.id,
        variantName: v.name,
        isControl,
        exposed,
        converters,
        conversionRate: rate,
        confidenceInterval: ci,
        lift,
        zScore: zResult?.zScore ?? null,
        pValue: zResult?.pValue ?? null,
        isSignificant,
        isWinner,
      };
    });

    // ── 6. Required sample size ───────────────────────────────────────────────
    const required = requiredSampleSize(
      controlRate || 0.05, // fallback to 5% if no data yet
    );

    const hasEnoughData = variantResults.every((v) => v.exposed >= required);

    // ── 7. Assemble response ──────────────────────────────────────────────────
    return {
      experimentId: experiment.id,
      experimentName: experiment.name,
      status: experiment.status,
      primaryMetric: experiment.primaryMetric,
      confidenceLevel: Number(experiment.confidenceLevel),
      requiredSampleSize: required,
      hasEnoughData,
      variants: variantResults,
      analyzedAt: new Date(),
    };
  }
}
