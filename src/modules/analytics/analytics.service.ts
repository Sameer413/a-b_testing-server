import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Experiment }    from '../experiment/entities/experiment.entity';
import { AssignmentLog } from '../experiment/entities/assignment-log.entity';
import { Event }         from '../experiment/entities/event.entity';
import { Variant }       from '../feature_flag/entities/variant.entity';

import {
  ExperimentResultsDto,
  MetricResultDto,
  VariantResultDto,
} from './dto/experiment-results.dto';

import { conversionRate }     from './stats/conversion-rate';
import { wilsonInterval }     from './stats/confidence-interval';
import { relativeLift }       from './stats/lift';
import { zTest }              from './stats/significance';
import { requiredSampleSize } from './stats/sample-size';

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

  // ── Public API ──────────────────────────────────────────────────────────────

  async getExperimentResults(
    experimentId: string,
  ): Promise<ExperimentResultsDto> {
    // ── 1. Load experiment with flag + variants ───────────────────────────────
    const experiment = await this.experimentRepo.findOne({
      where: { id: experimentId },
      relations: { featureFlag: { variants: true } },
    });

    if (!experiment) {
      throw new NotFoundException(
        `Experiment not found with id: ${experimentId}`,
      );
    }

    const variants      = experiment.featureFlag.variants ?? [];
    const alpha         = 1 - Number(experiment.confidenceLevel); // e.g. 0.05
    const controlVariant = variants.find((v) => v.isControl) ?? variants[0];

    // ── 2. Exposed count per variant — shared across ALL metrics ─────────────
    //    Exposure is determined by assignment, not by event type.
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

    // ── 3. Primary metric results ─────────────────────────────────────────────
    const primaryConvertersMap = await this.fetchConvertersPerVariant(
      experimentId,
      experiment.featureFlag.id,
      experiment.primaryMetric,
    );

    const variantResults = this.buildVariantStats(
      variants,
      exposedMap,
      primaryConvertersMap,
      controlVariant.id,
      alpha,
    );

    // ── 4. Required sample size (based on control's primary conversion rate) ──
    const controlPrimaryRate = conversionRate(
      primaryConvertersMap.get(controlVariant.id) ?? 0,
      exposedMap.get(controlVariant.id) ?? 0,
    );

    const required      = requiredSampleSize(controlPrimaryRate || 0.05);
    const hasEnoughData = variantResults.every((v) => v.exposed >= required);

    // ── 5. Secondary metric results (funnel steps) ────────────────────────────
    //    Each secondary metric runs the same query + stat pipeline.
    //    exposedMap is reused — the same users are the denominator for all metrics.
    const funnelMetrics: MetricResultDto[] = [];

    if (experiment.secondaryMetrics?.length) {
      for (const metric of experiment.secondaryMetrics) {
        const secConvertersMap = await this.fetchConvertersPerVariant(
          experimentId,
          experiment.featureFlag.id,
          metric,
        );

        funnelMetrics.push({
          metric,
          variants: this.buildVariantStats(
            variants,
            exposedMap,       // same exposed users — only the event type changes
            secConvertersMap,
            controlVariant.id,
            alpha,
          ),
        });
      }
    }

    // ── 6. Assemble response ──────────────────────────────────────────────────
    return {
      experimentId:       experiment.id,
      experimentName:     experiment.name,
      status:             experiment.status,
      primaryMetric:      experiment.primaryMetric,
      confidenceLevel:    Number(experiment.confidenceLevel),
      requiredSampleSize: required,
      hasEnoughData,
      variants:           variantResults,
      funnelMetrics,
      analyzedAt:         new Date(),
    };
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  /**
   * Queries how many unique users per variant fired a specific eventType.
   * Only counts users who are in the experiment (via assignment_logs JOIN).
   * Used for both primaryMetric and each secondary metric.
   */
  private async fetchConvertersPerVariant(
    experimentId: string,
    flagId: string,
    metric: string,
  ): Promise<Map<string, number>> {
    const raw: VariantCount[] = await this.eventRepo
      .createQueryBuilder('e')
      .innerJoin(
        AssignmentLog,
        'al',
        'al.userId = e.userId AND al.experimentId = :experimentId',
        { experimentId },
      )
      .select('al.variantId', 'variantId')
      .addSelect('COUNT(DISTINCT e.userId)', 'count')
      .where('e.featureFlagId = :flagId', { flagId })
      .andWhere('e.eventType = :metric', { metric })
      .groupBy('al.variantId')
      .getRawMany();

    return new Map(raw.map((r) => [r.variantId, parseInt(r.count, 10)]));
  }

  /**
   * Computes full statistical results for every variant vs. the control.
   * Reused identically for primaryMetric and each secondary metric.
   */
  private buildVariantStats(
    variants: Variant[],
    exposedMap: Map<string, number>,
    convertersMap: Map<string, number>,
    controlVariantId: string,
    alpha: number,
  ): VariantResultDto[] {
    const controlExposed    = exposedMap.get(controlVariantId) ?? 0;
    const controlConverters = convertersMap.get(controlVariantId) ?? 0;
    const controlRate       = conversionRate(controlConverters, controlExposed);

    return variants.map((v) => {
      const exposed    = exposedMap.get(v.id) ?? 0;
      const converters = convertersMap.get(v.id) ?? 0;
      const rate       = conversionRate(converters, exposed);
      const ci         = wilsonInterval(converters, exposed);
      const isControl  = v.id === controlVariantId;

      const lift    = isControl ? null : relativeLift(controlRate, rate);
      const zResult = isControl
        ? null
        : zTest(controlConverters, controlExposed, converters, exposed, alpha);

      const isSignificant = zResult?.isSignificant ?? false;

      return {
        variantId:          v.id,
        variantName:        v.name,
        isControl,
        exposed,
        converters,
        conversionRate:     rate,
        confidenceInterval: ci,
        lift,
        zScore:             zResult?.zScore ?? null,
        pValue:             zResult?.pValue ?? null,
        isSignificant,
        isWinner:           isSignificant && (lift ?? 0) > 0,
      };
    });
  }
}
