import {
  HOLIDAY_CATALOG,
  listHolidays,
  resolveImage,
  resolveSaying,
} from './content.js';
import type {
  MountingConfig,
  Result,
  ScrewSize,
  SignConfig,
  ValidationError,
} from './types.js';

const VALID_SCREW_SIZES: ReadonlySet<ScrewSize> = new Set([
  'M3',
  'M4',
  'M5',
  '#4-40',
  '#6-32',
  '#8-32',
  '#10-24',
  '1/4-20',
]);

/**
 * Validates a {@link SignConfig}, returning either the validated config or the
 * full list of field-level problems found. Every field is checked so a caller
 * can surface all problems at once instead of one at a time.
 */
export function validateSignConfig(
  config: SignConfig,
): Result<SignConfig, ValidationError[]> {
  const errors: ValidationError[] = [];

  if (!(config.holiday in HOLIDAY_CATALOG)) {
    errors.push({
      field: 'holiday',
      message: `"${config.holiday}" is not a supported holiday. Supported holidays: ${listHolidays().join(', ')}.`,
    });
    // The holiday drives saying/image lookups below, so stop here rather
    // than surfacing confusing downstream errors for an unrecognized key.
    return {ok: false, error: errors};
  }

  const sayingResult = resolveSaying(
    config.holiday,
    config.sayingId,
    config.sayingText,
  );
  if (!sayingResult.ok) {
    errors.push(sayingResult.error);
  }

  const imageResult = resolveImage(config.holiday, config.imageId);
  if (!imageResult.ok) {
    errors.push(imageResult.error);
  }

  const hasLastName =
    config.lastName !== undefined && config.lastName.trim().length > 0;
  if (config.lastName !== undefined && !hasLastName) {
    errors.push({
      field: 'lastName',
      message: 'Last name cannot be blank when provided.',
    });
  }

  if (!config.font.sayingFont || config.font.sayingFont.trim().length === 0) {
    errors.push({
      field: 'font.sayingFont',
      message: 'A saying font must be selected.',
    });
  }

  if (
    hasLastName &&
    (!config.font.nameFont || config.font.nameFont.trim().length === 0)
  ) {
    errors.push({
      field: 'font.nameFont',
      message: 'A name font must be selected when a last name is provided.',
    });
  }

  if (!Number.isFinite(config.margin) || config.margin <= 0) {
    errors.push({
      field: 'margin',
      message: 'Margin must be a positive, finite number.',
    });
  }

  if (!Number.isFinite(config.sayingHeight) || config.sayingHeight <= 0) {
    errors.push({
      field: 'sayingHeight',
      message: 'Saying height must be a positive, finite number.',
    });
  }

  if (
    config.nameHeight !== undefined &&
    (!Number.isFinite(config.nameHeight) || config.nameHeight <= 0)
  ) {
    errors.push({
      field: 'nameHeight',
      message: 'Name height must be a positive, finite number when provided.',
    });
  }

  if (
    config.imageHeight !== undefined &&
    (!Number.isFinite(config.imageHeight) || config.imageHeight <= 0)
  ) {
    errors.push({
      field: 'imageHeight',
      message: 'Image height must be a positive, finite number when provided.',
    });
  }

  const mountingError = validateMounting(config.mounting);
  if (mountingError) {
    errors.push(mountingError);
  }

  return errors.length > 0
    ? {ok: false, error: errors}
    : {ok: true, value: config};
}

function validateMounting(
  mounting: MountingConfig,
): ValidationError | undefined {
  if (mounting.type !== 'screw') {
    return undefined;
  }
  if (!VALID_SCREW_SIZES.has(mounting.screwSize)) {
    return {
      field: 'mounting.screwSize',
      message: `Screw size "${mounting.screwSize}" is not a supported size. Supported sizes: ${[...VALID_SCREW_SIZES].join(', ')}.`,
    };
  }
  return undefined;
}
