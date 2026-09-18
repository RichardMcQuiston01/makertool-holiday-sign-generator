/** Unit of measurement used for all dimensions in a {@link SignConfig}. */
export type Unit = 'in' | 'mm';

/** Holiday the sign celebrates. Filters which sayings/images are available (see `content.ts`). */
export type Holiday =
  | 'christmas'
  | 'halloween'
  | 'thanksgiving'
  | 'easter'
  | 'valentinesDay'
  | 'stPatricksDay'
  | 'fourthOfJuly'
  | 'newYear';

/** Outer shape of the sign backer. */
export type SignShape = 'square' | 'rectangle' | 'ellipse' | 'round';

/** Common screw sizes supported for hardware mounting holes. */
export type ScrewSize =
  'M3' | 'M4' | 'M5' | '#4-40' | '#6-32' | '#8-32' | '#10-24' | '1/4-20';

/**
 * How the finished sign attaches to a wall or door.
 * `screw` requires a {@link ScrewSize} so mounting holes can be generated.
 */
export type MountingConfig =
  | {readonly type: 'screw'; readonly screwSize: ScrewSize}
  | {readonly type: 'adhesive'};

/** Font selection for the generated cut/engrave file. */
export interface FontConfig {
  /** Font identifier resolved against the font registry, for the holiday saying text. */
  readonly sayingFont: string;
  /** Font identifier for the last name text. Required when {@link SignConfig.lastName} is set. */
  readonly nameFont?: string;
}

/** Full description of a holiday sign to generate a cut/engrave file for. */
export interface SignConfig {
  readonly holiday: Holiday;
  /**
   * Id of a predefined saying from `content.ts`'s catalog for {@link holiday}.
   * Omit (or use `'other'`) together with {@link sayingText} for custom text.
   */
  readonly sayingId?: string;
  /** Custom saying text. Required when {@link sayingId} is omitted or `'other'`. */
  readonly sayingText?: string;
  /** Optional last name engraved below the saying. */
  readonly lastName?: string;
  /** Id of a predefined image from `content.ts`'s catalog for {@link holiday}. Omit for no image. */
  readonly imageId?: string;
  readonly font: FontConfig;
  readonly shape: SignShape;
  /** Height of the saying text, in {@link unit}. Drives the size of the whole sign. */
  readonly sayingHeight: number;
  /** Height of the last name text, in {@link unit}. Defaults to {@link sayingHeight} when omitted. */
  readonly nameHeight?: number;
  /** Height of the holiday image, in {@link unit}. Defaults to {@link sayingHeight} * 2 when omitted. */
  readonly imageHeight?: number;
  /** Uniform margin applied to every edge of the sign backer, in {@link unit}. */
  readonly margin: number;
  readonly unit: Unit;
  readonly mounting: MountingConfig;
}

/** A single field-level validation failure, with a descriptive, user-facing message. */
export interface ValidationError {
  readonly field: string;
  readonly message: string;
}

/** Discriminated result returned by functions that can fail with descriptive errors. */
export type Result<T, E> =
  | {readonly ok: true; readonly value: T}
  | {readonly ok: false; readonly error: E};
