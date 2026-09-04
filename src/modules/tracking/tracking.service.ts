import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../experiment/entities/event.entity';
import { FeatureFlag } from '../feature_flag/entities/feature.flag.entity';
import { Environment } from '../project/entities/environment.entity';
import { BatchTrackEventsDto, TrackEventDto } from './dto/track-event.dto';

const BATCH_MAX = 500;

@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,

    @InjectRepository(FeatureFlag)
    private readonly flagRepo: Repository<FeatureFlag>,
  ) { }

  // ── Public API ──────────────────────────────────────────────────────────────

  async trackEvent(dto: TrackEventDto, environment: Environment) {
    const event = await this.buildEvent(dto, environment);
    return this.upsertEvents([event]);
  }

  async trackBatch(dto: BatchTrackEventsDto, environment: Environment) {
    if (dto.events.length > BATCH_MAX) {
      throw new BadRequestException(
        `Batch size exceeds maximum of ${BATCH_MAX} events`,
      );
    }

    const events = await Promise.all(
      dto.events.map((e) => this.buildEvent(e, environment)),
    );

    return this.upsertEvents(events);
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  /**
   * Resolves flagKey → featureFlagId (scoped to environment's project)
   * and maps a DTO into an Event entity ready for persistence.
   */
  private async buildEvent(
    dto: TrackEventDto,
    environment: Environment,
  ): Promise<Partial<Event>> {
    const flag = await this.resolveFlag(dto.flagKey, environment);

    return {
      userId: dto.userId,
      featureFlagId: flag.id,
      featureFlag: flag as FeatureFlag,
      environmentId: environment.id, // always from API key — never trusted from client
      environment,
      eventType: dto.eventType,
      variantId: dto.variantId,
      eventValue: dto.eventValue ?? null,
      metadata: dto.metadata ?? null,
      idempotencyKey: dto.eventId ?? null, // eventId in DTO = idempotencyKey in DB
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
    };
  }

  /**
   * Upsert events using the idempotencyKey unique constraint.
   * - Events WITH a key  → ON CONFLICT DO NOTHING (deduplication).
   * - Events WITHOUT key → plain insert (no dedup possible, no constraint to conflict on).
   */
  private async upsertEvents(events: Partial<Event>[]) {
    const keyed = events.filter((e) => e.idempotencyKey != null);
    const keyless = events.filter((e) => e.idempotencyKey == null);

    let insertedCount = 0;

    if (keyed.length) {
      const result = await this.eventRepo.upsert(keyed as any[], {
        conflictPaths: ['idempotencyKey'],
        skipUpdateIfNoValuesChanged: true,
      });
      insertedCount += result.identifiers.filter((id) => id).length;
    }

    if (keyless.length) {
      const entities = this.eventRepo.create(keyless as any[]);
      const saved = await this.eventRepo.save(entities);
      insertedCount += saved.length;
    }

    return {
      accepted: events.length,
      inserted: insertedCount,
    };
  }

  /**
   * Resolves a flagKey to a FeatureFlag entity, scoped to the project
   * that owns the environment derived from the API key.
   *
   * Throws NotFoundException if not found — prevents SDK from writing
   * events against arbitrary flag keys.
   */
  private async resolveFlag(
    flagKey: string,
    environment: Environment,
  ): Promise<FeatureFlag> {
    const flag = await this.flagRepo.findOne({
      where: { key: flagKey, project: { id: environment.project.id } },
      select: { id: true, key: true },
    });

    if (!flag) {
      throw new NotFoundException(
        `Feature flag "${flagKey}" not found in this project`,
      );
    }

    return flag;
  }
}
