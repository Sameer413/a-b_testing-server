import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { Event } from '../experiment/entities/event.entity';
import { FeatureFlag } from '../feature_flag/entities/feature.flag.entity';
import { Environment } from '../project/entities/environment.entity';

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeEnv = (projectId = 'proj-1'): Environment =>
  ({ id: 'env-1', project: { id: projectId } } as Environment);

const makeFlag = (id = 'flag-1', key = 'my-flag'): FeatureFlag =>
  ({ id, key } as FeatureFlag);

const makeDto = (overrides: Partial<any> = {}) => ({
  userId: 'user-123',
  flagKey: 'my-flag',
  eventType: 'click',
  ...overrides,
});

// ── Mock repositories ─────────────────────────────────────────────────────────

const mockEventRepo = () => ({
  upsert: jest.fn(),
  save: jest.fn(),
  create: jest.fn((data) => (Array.isArray(data) ? data : [data])),
});

const mockFlagRepo = () => ({
  findOne: jest.fn(),
});

// ── Test suite ────────────────────────────────────────────────────────────────

describe('TrackingService', () => {
  let service: TrackingService;
  let eventRepo: ReturnType<typeof mockEventRepo>;
  let flagRepo: ReturnType<typeof mockFlagRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackingService,
        { provide: getRepositoryToken(Event), useFactory: mockEventRepo },
        { provide: getRepositoryToken(FeatureFlag), useFactory: mockFlagRepo },
      ],
    }).compile();

    service = module.get(TrackingService);
    eventRepo = module.get(getRepositoryToken(Event));
    flagRepo = module.get(getRepositoryToken(FeatureFlag));
  });

  // ── trackEvent ──────────────────────────────────────────────────────────────

  describe('trackEvent()', () => {
    it('inserts a single event and returns accepted/inserted counts', async () => {
      flagRepo.findOne.mockResolvedValue(makeFlag());
      eventRepo.upsert.mockResolvedValue({ identifiers: [{ id: 'ev-1' }] });

      const result = await service.trackEvent(
        makeDto({ eventId: 'idem-key-1' }),
        makeEnv(),
      );

      expect(result.accepted).toBe(1);
      expect(eventRepo.upsert).toHaveBeenCalledTimes(1);
    });

    it('sets occurredAt from DTO when provided', async () => {
      const ts = '2024-01-15T12:00:00.000Z';
      flagRepo.findOne.mockResolvedValue(makeFlag());
      eventRepo.upsert.mockResolvedValue({ identifiers: [{ id: 'ev-2' }] });

      await service.trackEvent(makeDto({ eventId: 'idem-2', occurredAt: ts }), makeEnv());

      const upsertPayload = eventRepo.upsert.mock.calls[0][0][0];
      expect(upsertPayload.occurredAt).toEqual(new Date(ts));
    });

    it('defaults occurredAt to server time when not provided', async () => {
      const before = new Date();
      flagRepo.findOne.mockResolvedValue(makeFlag());
      eventRepo.upsert.mockResolvedValue({ identifiers: [{ id: 'ev-3' }] });

      await service.trackEvent(makeDto({ eventId: 'idem-3' }), makeEnv());

      const upsertPayload = eventRepo.upsert.mock.calls[0][0][0];
      expect(upsertPayload.occurredAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });

    it('always uses environmentId from API key, not from client', async () => {
      flagRepo.findOne.mockResolvedValue(makeFlag());
      eventRepo.upsert.mockResolvedValue({ identifiers: [{ id: 'ev-4' }] });

      await service.trackEvent(makeDto({ eventId: 'idem-4' }), makeEnv('proj-1'));

      const upsertPayload = eventRepo.upsert.mock.calls[0][0][0];
      expect(upsertPayload.environmentId).toBe('env-1');
    });

    it('throws NotFoundException when flagKey does not exist in the project', async () => {
      flagRepo.findOne.mockResolvedValue(null);

      await expect(
        service.trackEvent(makeDto({ flagKey: 'ghost-flag', eventId: 'idem-5' }), makeEnv()),
      ).rejects.toThrow(NotFoundException);
    });

    it('routes keyless events through save() not upsert()', async () => {
      flagRepo.findOne.mockResolvedValue(makeFlag());
      eventRepo.save.mockResolvedValue([{ id: 'ev-k' }]);

      // No eventId → no idempotency key
      const result = await service.trackEvent(makeDto(), makeEnv());

      expect(eventRepo.upsert).not.toHaveBeenCalled();
      expect(eventRepo.save).toHaveBeenCalledTimes(1);
      expect(result.accepted).toBe(1);
    });
  });

  // ── Deduplication ───────────────────────────────────────────────────────────

  describe('deduplication via idempotencyKey', () => {
    it('calls upsert with conflictPaths: ["idempotencyKey"] for keyed events', async () => {
      flagRepo.findOne.mockResolvedValue(makeFlag());
      eventRepo.upsert.mockResolvedValue({ identifiers: [{ id: 'ev-d1' }] });

      await service.trackEvent(makeDto({ eventId: 'dedup-key-abc' }), makeEnv());

      expect(eventRepo.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ idempotencyKey: 'dedup-key-abc' }),
        ]),
        expect.objectContaining({
          conflictPaths: ['idempotencyKey'],
          skipUpdateIfNoValuesChanged: true,
        }),
      );
    });

    it('second call with the same idempotencyKey does not throw (DB ignores it via ON CONFLICT)', async () => {
      flagRepo.findOne.mockResolvedValue(makeFlag());
      // TypeORM upsert returns empty identifiers when the row already exists
      eventRepo.upsert.mockResolvedValue({ identifiers: [] });

      const dto = makeDto({ eventId: 'same-key-xyz' });
      const env = makeEnv();

      // First call
      await service.trackEvent(dto, env);
      // Second call with same key — should not throw
      await expect(service.trackEvent(dto, env)).resolves.not.toThrow();

      expect(eventRepo.upsert).toHaveBeenCalledTimes(2);
    });
  });

  // ── trackBatch ──────────────────────────────────────────────────────────────

  describe('trackBatch()', () => {
    it('processes multiple events in a single call', async () => {
      flagRepo.findOne.mockResolvedValue(makeFlag());
      eventRepo.upsert.mockResolvedValue({
        identifiers: [{ id: 'b1' }, { id: 'b2' }],
      });

      const result = await service.trackBatch(
        {
          events: [
            makeDto({ eventId: 'batch-1' }),
            makeDto({ eventId: 'batch-2' }),
          ],
        },
        makeEnv(),
      );

      expect(result.accepted).toBe(2);
      expect(eventRepo.upsert).toHaveBeenCalledTimes(1); // single bulk upsert
    });

    it('throws BadRequestException when batch exceeds 500 events', async () => {
      const events = Array.from({ length: 501 }, (_, i) =>
        makeDto({ eventId: `k-${i}` }),
      );

      await expect(
        service.trackBatch({ events }, makeEnv()),
      ).rejects.toThrow(BadRequestException);

      expect(flagRepo.findOne).not.toHaveBeenCalled();
    });

    it('handles mixed keyed/keyless events in the same batch', async () => {
      flagRepo.findOne.mockResolvedValue(makeFlag());
      eventRepo.upsert.mockResolvedValue({ identifiers: [{ id: 'bk1' }] });
      eventRepo.save.mockResolvedValue([{ id: 'bkl1' }]);

      await service.trackBatch(
        {
          events: [
            makeDto({ eventId: 'key-event' }),   // keyed → upsert
            makeDto(),                            // keyless → save
          ],
        },
        makeEnv(),
      );

      expect(eventRepo.upsert).toHaveBeenCalledTimes(1);
      expect(eventRepo.save).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException if any flagKey is invalid, stopping the batch', async () => {
      flagRepo.findOne
        .mockResolvedValueOnce(makeFlag())   // first event resolves
        .mockResolvedValueOnce(null);        // second event → not found

      await expect(
        service.trackBatch(
          {
            events: [
              makeDto({ eventId: 'ok-key' }),
              makeDto({ flagKey: 'ghost-flag', eventId: 'bad-key' }),
            ],
          },
          makeEnv(),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
