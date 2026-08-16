import {
    registerDecorator,
    ValidationArguments,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from 'class-validator';
import { FlagType } from '../enums/flag-type.enum.js';
import { CreateVariantDto } from '../../modules/feature_flag/dto/feature-flag.dto.js';

// ─── 1. Weight sum must equal 100 for multivariate flags ────────────────────

@ValidatorConstraint({ name: 'variantWeightsSumTo100', async: false })
export class VariantWeightsSumTo100Constraint implements ValidatorConstraintInterface {
    validate(_: unknown, args: ValidationArguments): boolean {
        const dto = args.object as { flagType?: FlagType; variants?: CreateVariantDto[] };

        // Only applies to multivariate flags
        if (dto.flagType !== FlagType.MULTIVARIATE) return true;

        // No variants → caught by the MinVariantsForMultivariate check
        if (!dto.variants || dto.variants.length === 0) return true;

        const total = dto.variants.reduce((sum, v) => sum + (v.weight ?? 0), 0);

        // Allow for floating-point imprecision (e.g. 33.33 + 33.33 + 33.34 = 100.00)
        return Math.abs(total - 100) < 0.01;
    }

    defaultMessage(args: ValidationArguments): string {
        const dto = args.object as { variants?: CreateVariantDto[] };
        const total = (dto.variants ?? []).reduce((sum, v) => sum + (v.weight ?? 0), 0);
        return `Variant weights must sum to 100 for multivariate flags, but got ${total.toFixed(2)}.`;
    }
}

export function VariantWeightsSumTo100(options?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options,
            constraints: [],
            validator: VariantWeightsSumTo100Constraint,
        });
    };
}

// ─── 2. Multivariate flags must have at least 2 variants ────────────────────

@ValidatorConstraint({ name: 'minVariantsForMultivariate', async: false })
export class MinVariantsForMultivariateConstraint implements ValidatorConstraintInterface {
    validate(_: unknown, args: ValidationArguments): boolean {
        const dto = args.object as { flagType?: FlagType; variants?: CreateVariantDto[] };

        if (dto.flagType !== FlagType.MULTIVARIATE) return true;

        return Array.isArray(dto.variants) && dto.variants.length >= 2;
    }

    defaultMessage(): string {
        return 'Multivariate flags must have at least 2 variants.';
    }
}

export function MinVariantsForMultivariate(options?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options,
            constraints: [],
            validator: MinVariantsForMultivariateConstraint,
        });
    };
}

// ─── 3. Boolean flags must not include custom variants ───────────────────────

@ValidatorConstraint({ name: 'noVariantsForBoolean', async: false })
export class NoVariantsForBooleanConstraint implements ValidatorConstraintInterface {
    validate(_: unknown, args: ValidationArguments): boolean {
        const dto = args.object as { flagType?: FlagType; variants?: CreateVariantDto[] };

        if (dto.flagType !== FlagType.BOOLEAN) return true;

        return !dto.variants || dto.variants.length === 0;
    }

    defaultMessage(): string {
        return 'Boolean flags cannot have custom variants. Variants are auto-generated (On / Off).';
    }
}

export function NoVariantsForBoolean(options?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options,
            constraints: [],
            validator: NoVariantsForBooleanConstraint,
        });
    };
}
