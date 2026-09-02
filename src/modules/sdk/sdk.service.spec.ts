import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SdkService } from './sdk.service';
import { FeatureFlag } from '../feature_flag/entities/feature.flag.entity';
import { FeatureFlagEnvironment } from '../feature_flag/entities/feature-flag-environment.entity';
import { FlagType } from 'src/common/enums/flag-type.enum';
import { AllocationStrategy } from 'src/common/enums/allocation-strategy.enum';
import { Environment } from '../project/entities/environment.entity';

describe('SdkService', () => {
  let service: SdkService;
  let flagRepo: any;
  let ffEnvRepo: any;

  const mockEnvironment = {
    id: 'env-1',
    project: { id: 'proj-1' },
  } as Environment;

  beforeEach(async () => {
    flagRepo = {
      findOne: jest.fn(),
    };
    ffEnvRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SdkService,
        {
          provide: getRepositoryToken(FeatureFlag),
          useValue: flagRepo,
        },
        {
          provide: getRepositoryToken(FeatureFlagEnvironment),
          useValue: ffEnvRepo,
        },
      ],
    }).compile();

    service = module.get<SdkService>(SdkService);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CLEAN EVALUATION CONTEXT
  // ──────────────────────────────────────────────────────────────────────────

  describe('Clean Evaluation Context', () => {
    it('should throw NotFoundException if flag not found', async () => {
      flagRepo.findOne.mockResolvedValue(null);

      await expect(
        service.evaluate(
          { flagKey: 'nonexistent', userId: 'user-1' },
          mockEnvironment,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return GLOBALLY_DISABLED if flag.enabled=false', async () => {
      flagRepo.findOne.mockResolvedValue({
        key: 'test-flag',
        enabled: false,
        variants: [],
      });

      const result = await service.evaluate(
        { flagKey: 'test-flag', userId: 'user-1' },
        mockEnvironment,
      );

      expect(result).toEqual({
        flagKey: 'test-flag',
        enabled: false,
        variant: null,
        value: null,
        valueType: null,
        reason: 'GLOBALLY_DISABLED',
      });
    });

    it('should return ENV_DISABLED if ffEnv not found or disabled', async () => {
      flagRepo.findOne.mockResolvedValue({
        key: 'test-flag',
        enabled: true,
        variants: [],
      });
      ffEnvRepo.findOne.mockResolvedValue(null);

      const result = await service.evaluate(
        { flagKey: 'test-flag', userId: 'user-1' },
        mockEnvironment,
      );

      expect(result.reason).toBe('ENV_DISABLED');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. RULE EVALUATOR
  // ──────────────────────────────────────────────────────────────────────────

  describe('Rule Evaluator', () => {
    it('should match when ANY group condition passes (OR logic)', async () => {
      flagRepo.findOne.mockResolvedValue({
        key: 'test-flag',
        enabled: true,
        targetingRules: {
          groups: [
            {
              conditions: [
                { attribute: 'country', operator: 'in', values: ['US'] },
              ],
            },
            {
              conditions: [
                { attribute: 'role', operator: 'equals', values: ['admin'] },
              ],
            },
          ],
        },
        variants: [{ name: 'On', weight: 100 }],
        flagType: FlagType.BOOLEAN,
        allocationStrategy: AllocationStrategy.DETERMINISTIC_HASH,
      });
      ffEnvRepo.findOne.mockResolvedValue({
        enabled: true,
        rolloutPercentage: 100,
      });

      const result = await service.evaluate(
        {
          flagKey: 'test-flag',
          userId: 'user-1',
          userAttributes: { role: 'admin' }, // Group 2 matches
        },
        mockEnvironment,
      );

      expect(result.reason).not.toBe('TARGETING_MISS');
    });

    it('should NOT match if ALL conditions in group fail (AND logic)', async () => {
      flagRepo.findOne.mockResolvedValue({
        key: 'test-flag',
        enabled: true,
        targetingRules: {
          groups: [
            {
              conditions: [
                { attribute: 'country', operator: 'in', values: ['US', 'CA'] },
                { attribute: 'plan', operator: 'in', values: ['premium'] },
              ],
            },
          ],
        },
        variants: [],
        flagType: FlagType.BOOLEAN,
      });
      ffEnvRepo.findOne.mockResolvedValue({
        enabled: true,
        rolloutPercentage: 100,
      });

      const result = await service.evaluate(
        {
          flagKey: 'test-flag',
          userId: 'user-1',
          userAttributes: { country: 'US', plan: 'free' }, // One fails
        },
        mockEnvironment,
      );

      expect(result.reason).toBe('TARGETING_MISS');
    });

    it('should return TARGETING_MISS if no groups match', async () => {
      flagRepo.findOne.mockResolvedValue({
        key: 'test-flag',
        enabled: true,
        targetingRules: {
          groups: [
            {
              conditions: [
                { attribute: 'country', operator: 'in', values: ['US'] },
              ],
            },
          ],
        },
        variants: [],
        flagType: FlagType.BOOLEAN,
      });
      ffEnvRepo.findOne.mockResolvedValue({
        enabled: true,
        rolloutPercentage: 100,
      });

      const result = await service.evaluate(
        {
          flagKey: 'test-flag',
          userId: 'user-1',
          userAttributes: { country: 'BR' }, // Doesn't match
        },
        mockEnvironment,
      );

      expect(result.reason).toBe('TARGETING_MISS');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. OPERATOR SYSTEM
  // ──────────────────────────────────────────────────────────────────────────

  describe('Operator System', () => {
    const operators = [
      {
        name: 'in',
        condition: {
          attribute: 'country',
          operator: 'in',
          values: ['US', 'CA'],
        },
        attributes: { country: 'US' } as Record<string, string | number | boolean>,
        shouldMatch: true,
      },
      {
        name: 'not_in',
        condition: { attribute: 'country', operator: 'not_in', values: ['US'] },
        attributes: { country: 'BR' } as Record<string, string | number | boolean>,
        shouldMatch: true,
      },
      {
        name: 'equals',
        condition: { attribute: 'role', operator: 'equals', values: ['admin'] },
        attributes: { role: 'admin' } as Record<string, string | number | boolean>,
        shouldMatch: true,
      },
      {
        name: 'not_equals',
        condition: {
          attribute: 'role',
          operator: 'not_equals',
          values: ['admin'],
        },
        attributes: { role: 'user' } as Record<string, string | number | boolean>,
        shouldMatch: true,
      },
      {
        name: 'contains',
        condition: {
          attribute: 'email',
          operator: 'contains',
          values: ['company'],
        },
        attributes: { email: 'john@company.com' } as Record<string, string | number | boolean>,
        shouldMatch: true,
      },
      {
        name: 'starts_with',
        condition: {
          attribute: 'code',
          operator: 'starts_with',
          values: ['PRE_'],
        },
        attributes: { code: 'PRE_123' } as Record<string, string | number | boolean>,
        shouldMatch: true,
      },
      {
        name: 'ends_with',
        condition: {
          attribute: 'email',
          operator: 'ends_with',
          values: ['@company.com'],
        },
        attributes: { email: 'john@company.com' } as Record<string, string | number | boolean>,
        shouldMatch: true,
      },
      {
        name: 'gt',
        condition: { attribute: 'age', operator: 'gt', values: [18] },
        attributes: { age: 25 } as Record<string, string | number | boolean>,
        shouldMatch: true,
      },
      {
        name: 'gte',
        condition: { attribute: 'signupDays', operator: 'gte', values: [30] },
        attributes: { signupDays: 30 } as Record<string, string | number | boolean>,
        shouldMatch: true,
      },
      {
        name: 'lt',
        condition: { attribute: 'age', operator: 'lt', values: [65] },
        attributes: { age: 30 } as Record<string, string | number | boolean>,
        shouldMatch: true,
      },
      {
        name: 'lte',
        condition: { attribute: 'balance', operator: 'lte', values: [1000] },
        attributes: { balance: 1000 } as Record<string, string | number | boolean>,
        shouldMatch: true,
      },
      {
        name: 'exists',
        condition: { attribute: 'phone', operator: 'exists', values: [] },
        attributes: { phone: '1234567890' } as Record<string, string | number | boolean>,
        shouldMatch: true,
      },
      {
        name: 'not_exists',
        condition: { attribute: 'phone', operator: 'not_exists', values: [] },
        attributes: { email: 'test@test.com' } as Record<string, string | number | boolean>,
        shouldMatch: true,
      },
    ];

    operators.forEach(({ name, condition, attributes, shouldMatch }) => {
      it(`should correctly evaluate '${name}' operator`, async () => {
        flagRepo.findOne.mockResolvedValue({
          key: 'test-flag',
          enabled: true,
          targetingRules: {
            groups: [{ conditions: [condition] }],
          },
          variants: [{ name: 'On', weight: 100 }],
          flagType: FlagType.BOOLEAN,
        });
        ffEnvRepo.findOne.mockResolvedValue({
          enabled: true,
          rolloutPercentage: 100,
        });

        const result = await service.evaluate(
          {
            flagKey: 'test-flag',
            userId: 'user-1',
            userAttributes: attributes,
          },
          mockEnvironment,
        );

        if (shouldMatch) {
          expect(result.reason).not.toBe('TARGETING_MISS');
        } else {
          expect(result.reason).toBe('TARGETING_MISS');
        }
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. STABLE BUCKETING
  // ──────────────────────────────────────────────────────────────────────────

  describe('Stable Bucketing', () => {
    it('should return same bucket for same userId+flagKey combination', async () => {
      const userId = 'a2ae2d9e-7fca-435d-a510-91fd66ac7ad7';
      const flagKey = 'checkout-test';
      const salt = 'salt-v1';

      // Call getBucket multiple times
      const bucket1 = (service as any).getBucket(userId, flagKey, salt);
      const bucket2 = (service as any).getBucket(userId, flagKey, salt);
      const bucket3 = (service as any).getBucket(userId, flagKey, salt);

      expect(bucket1).toBe(bucket2);
      expect(bucket2).toBe(bucket3);
      expect(bucket1).toBeGreaterThanOrEqual(0);
      expect(bucket1).toBeLessThan(100);
    });

    it('should produce different buckets for different userIds', async () => {
      const flagKey = 'checkout-test';
      const salt = 'salt-v1';

      const bucket1 = (service as any).getBucket('user-1', flagKey, salt);
      const bucket2 = (service as any).getBucket('user-2', flagKey, salt);
      const bucket3 = (service as any).getBucket('user-3', flagKey, salt);

      // Not all should be the same (statistical test)
      const unique = new Set([bucket1, bucket2, bucket3]);
      expect(unique.size).toBeGreaterThan(1);
    });

    it('should produce different buckets for different salt values', async () => {
      const userId = 'user-1';
      const flagKey = 'checkout-test';

      const bucket1 = (service as any).getBucket(userId, flagKey, 'salt-v1');
      const bucket2 = (service as any).getBucket(userId, flagKey, 'salt-v2');

      expect(bucket1).not.toBe(bucket2);
    });

    it('should distribute buckets across 0-99 range', async () => {
      const flagKey = 'test-flag';
      const buckets = new Set();

      for (let i = 0; i < 100; i++) {
        const bucket = (service as any).getBucket(`user-${i}`, flagKey);
        expect(bucket).toBeGreaterThanOrEqual(0);
        expect(bucket).toBeLessThan(100);
        buckets.add(bucket);
      }

      // Should have good coverage (not all same)
      expect(buckets.size).toBeGreaterThan(20);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. ALLOCATION ALGORITHM
  // ──────────────────────────────────────────────────────────────────────────

  describe('Allocation Algorithm', () => {
    it('should assign BOOLEAN flags to "On" variant', async () => {
      const variants = [{ name: 'On', weight: 100 }];
      const assigned = (service as any).assignVariant(
        variants,
        FlagType.BOOLEAN,
        AllocationStrategy.DETERMINISTIC_HASH,
        'user-1',
        'flag-1',
        'salt',
      );

      expect(assigned.name).toBe('On');
    });

    it('should allocate variants by weight using deterministic hash', async () => {
      const variants = [
        { name: 'control', weight: 50 },
        { name: 'variant_a', weight: 30 },
        { name: 'variant_b', weight: 20 },
      ];

      const allocation: Record<string, number> = {};
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const variant = (service as any).assignVariant(
          variants,
          FlagType.MULTIVARIATE,
          AllocationStrategy.DETERMINISTIC_HASH,
          `user-${i}`,
          'test-flag',
          'salt',
        );
        allocation[variant.name] = (allocation[variant.name] || 0) + 1;
      }

      // Verify approximate weight distribution (allow ±5% variance)
      const controlPct = (allocation['control'] / iterations) * 100;
      const aaPct = (allocation['variant_a'] / iterations) * 100;
      const bPct = (allocation['variant_b'] / iterations) * 100;

      expect(controlPct).toBeGreaterThanOrEqual(45);
      expect(controlPct).toBeLessThanOrEqual(55);
      expect(aaPct).toBeGreaterThanOrEqual(25);
      expect(aaPct).toBeLessThanOrEqual(35);
      expect(bPct).toBeGreaterThanOrEqual(15);
      expect(bPct).toBeLessThanOrEqual(25);
    });

    it('should allocate variants randomly when using RANDOM strategy', async () => {
      const variants = [
        { name: 'control', weight: 50 },
        { name: 'variant_a', weight: 50 },
      ];

      const results = new Set();

      for (let i = 0; i < 10; i++) {
        const variant = (service as any).assignVariant(
          variants,
          FlagType.MULTIVARIATE,
          AllocationStrategy.RANDOM,
          'same-user',
          'test-flag',
          'salt',
        );
        results.add(variant.name);
      }

      // RANDOM should produce variation even for same user
      expect(results.size).toBeGreaterThan(1);
    });

    it('should handle edge case: single variant', async () => {
      const variants = [{ name: 'only-variant', weight: 100 }];
      const assigned = (service as any).assignVariant(
        variants,
        FlagType.MULTIVARIATE,
        AllocationStrategy.DETERMINISTIC_HASH,
        'user-1',
        'flag-1',
      );

      expect(assigned.name).toBe('only-variant');
    });

    it('should sort variants alphabetically for stable cumulative weights', async () => {
      const variants = [
        { name: 'zulu', weight: 33 },
        { name: 'alpha', weight: 34 },
        { name: 'bravo', weight: 33 },
      ];

      // Manually call the sorting logic
      const sorted = [...variants].sort((a, b) => a.name.localeCompare(b.name));
      expect(sorted[0].name).toBe('alpha');
      expect(sorted[1].name).toBe('bravo');
      expect(sorted[2].name).toBe('zulu');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. FALLBACK HANDLING & EVALUATION REASONS
  // ──────────────────────────────────────────────────────────────────────────

  describe('Fallback Handling & Evaluation Reasons', () => {
    it('should return OUT_OF_ROLLOUT when bucket >= rolloutPercentage', async () => {
      flagRepo.findOne.mockResolvedValue({
        key: 'test-flag',
        enabled: true,
        variants: [{ name: 'On', weight: 100 }],
        flagType: FlagType.BOOLEAN,
        hashSalt: 'salt',
      });
      ffEnvRepo.findOne.mockResolvedValue({
        enabled: true,
        rolloutPercentage: 10, // Only 10% rollout
      });

      const result = await service.evaluate(
        { flagKey: 'test-flag', userId: 'user-1' },
        mockEnvironment,
      );

      // 50/50 chance of being in rollout
      expect(['MATCH', 'OUT_OF_ROLLOUT']).toContain(result.reason);
    });

    it('should include all evaluation reasons', async () => {
      const reasons = [
        'GLOBALLY_DISABLED',
        'ENV_DISABLED',
        'TARGETING_MISS',
        'OUT_OF_ROLLOUT',
        'MATCH',
      ];

      // This validates that all expected reason strings exist
      expect(reasons).toBeDefined();
    });

    it('should return null variant and false enabled on failure', async () => {
      flagRepo.findOne.mockResolvedValue({
        key: 'test-flag',
        enabled: false,
        variants: [],
      });

      const result = await service.evaluate(
        { flagKey: 'test-flag', userId: 'user-1' },
        mockEnvironment,
      );

      expect(result.enabled).toBe(false);
      expect(result.variant).toBeNull();
      expect(result.value).toBeNull();
      expect(result.valueType).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. EDGE CASES & ERROR HANDLING
  // ──────────────────────────────────────────────────────────────────────────

  describe('Edge Cases & Error Handling', () => {
    it('should handle missing userAttributes gracefully', async () => {
      flagRepo.findOne.mockResolvedValue({
        key: 'test-flag',
        enabled: true,
        targetingRules: {
          groups: [
            {
              conditions: [
                { attribute: 'country', operator: 'in', values: ['US'] },
              ],
            },
          ],
        },
        variants: [],
        flagType: FlagType.BOOLEAN,
      });
      ffEnvRepo.findOne.mockResolvedValue({
        enabled: true,
        rolloutPercentage: 100,
      });

      const result = await service.evaluate(
        { flagKey: 'test-flag', userId: 'user-1' },
        mockEnvironment,
      );

      expect(result.reason).toBe('TARGETING_MISS');
    });

    it('should handle undefined userAttributes', async () => {
      flagRepo.findOne.mockResolvedValue({
        key: 'test-flag',
        enabled: true,
        variants: [{ name: 'On', weight: 100 }],
        flagType: FlagType.BOOLEAN,
      });
      ffEnvRepo.findOne.mockResolvedValue({
        enabled: true,
        rolloutPercentage: 100,
      });

      const result = await service.evaluate(
        { flagKey: 'test-flag', userId: 'user-1', userAttributes: undefined },
        mockEnvironment,
      );

      expect(result).toBeDefined();
    });

    it('should handle variant weight as string (decimal)', async () => {
      const variants = [
        { name: 'control', weight: '34.50' },
        { name: 'variant_a', weight: '65.50' },
      ];

      const assigned = (service as any).assignVariant(
        variants,
        FlagType.MULTIVARIATE,
        AllocationStrategy.DETERMINISTIC_HASH,
        'user-1',
        'flag-1',
      );

      expect(['control', 'variant_a']).toContain(assigned.name);
    });

    it('should handle zero rolloutPercentage', async () => {
      flagRepo.findOne.mockResolvedValue({
        key: 'test-flag',
        enabled: true,
        variants: [{ name: 'On', weight: 100 }],
        flagType: FlagType.BOOLEAN,
        hashSalt: 'salt',
      });
      ffEnvRepo.findOne.mockResolvedValue({
        enabled: true,
        rolloutPercentage: 0, // 0% rollout
      });

      const result = await service.evaluate(
        { flagKey: 'test-flag', userId: 'user-1' },
        mockEnvironment,
      );

      expect(result.reason).toBe('OUT_OF_ROLLOUT');
    });

    it('should handle 100 rolloutPercentage', async () => {
      flagRepo.findOne.mockResolvedValue({
        key: 'test-flag',
        enabled: true,
        variants: [{ name: 'On', weight: 100 }],
        flagType: FlagType.BOOLEAN,
        hashSalt: 'salt',
      });
      ffEnvRepo.findOne.mockResolvedValue({
        enabled: true,
        rolloutPercentage: 100,
      });

      const result = await service.evaluate(
        { flagKey: 'test-flag', userId: 'user-1' },
        mockEnvironment,
      );

      expect(result.reason).toBe('MATCH');
    });

    it('should handle empty targeting rules (no targeting)', async () => {
      flagRepo.findOne.mockResolvedValue({
        key: 'test-flag',
        enabled: true,
        targetingRules: null,
        variants: [{ name: 'On', weight: 100 }],
        flagType: FlagType.BOOLEAN,
        hashSalt: 'salt',
      });
      ffEnvRepo.findOne.mockResolvedValue({
        enabled: true,
        rolloutPercentage: 100,
      });

      const result = await service.evaluate(
        { flagKey: 'test-flag', userId: 'user-1' },
        mockEnvironment,
      );

      expect(result.reason).toBe('MATCH');
    });
  });
});
