import {resolveImage, resolveSaying} from './content.js';
import type {FontLoadError, FontRegistry, LoadedFont} from './font.js';
import type {LayoutError, LayoutOptions} from './layout.js';
import {computeSignLayout} from './layout.js';
import type {GeneratedFile} from './output-svg.js';
import {generateSvgFiles} from './output-svg.js';
import {generateDxfFiles} from './output-dxf.js';
import type {Result, SignConfig, ValidationError} from './types.js';
import {validateSignConfig} from './validation.js';

export type OutputFormat = 'svg' | 'dxf' | 'both';

/** Which stage of the pipeline failed, with that stage's own error shape. */
export type GenerateSignError =
  | {readonly stage: 'validation'; readonly errors: readonly ValidationError[]}
  | {readonly stage: 'content'; readonly error: ValidationError}
  | {readonly stage: 'font'; readonly error: FontLoadError}
  | {readonly stage: 'layout'; readonly error: LayoutError};

export interface GenerateSignOptions {
  readonly config: SignConfig;
  /**
   * Must already have the font(s) referenced by `config.font.sayingFont` /
   * `config.font.nameFont` registered (see `createFontRegistry`).
   */
  readonly fonts: FontRegistry;
  /** Which output format(s) to generate. Defaults to `'both'`. */
  readonly format?: OutputFormat;
  readonly layoutOptions?: LayoutOptions;
}

/**
 * Runs the full pipeline for one holiday sign: validate the config, resolve
 * its saying/image against the holiday's bundled catalog, resolve its
 * font(s), compute the physical layout, then generate the cut/engrave
 * file(s). Returns every generated file (SVG and/or DXF) as a flat list, or
 * the first error encountered, tagged with which stage produced it.
 */
export function generateSign(
  options: GenerateSignOptions,
): Result<GeneratedFile[], GenerateSignError> {
  const validation = validateSignConfig(options.config);
  if (!validation.ok) {
    return {
      ok: false,
      error: {stage: 'validation', errors: validation.error},
    };
  }
  const config = validation.value;

  // Re-resolve the saying/image content the config already passed
  // validation for, to get their concrete values for layout.
  const sayingResult = resolveSaying(
    config.holiday,
    config.sayingId,
    config.sayingText,
  );
  if (!sayingResult.ok) {
    return {ok: false, error: {stage: 'content', error: sayingResult.error}};
  }
  const imageResult = resolveImage(config.holiday, config.imageId);
  if (!imageResult.ok) {
    return {ok: false, error: {stage: 'content', error: imageResult.error}};
  }

  const sayingFontResult = options.fonts.get(config.font.sayingFont);
  if (!sayingFontResult.ok) {
    return {ok: false, error: {stage: 'font', error: sayingFontResult.error}};
  }

  let nameFont: LoadedFont | undefined;
  if (config.lastName && config.lastName.trim().length > 0) {
    const nameFontResult = options.fonts.get(config.font.nameFont as string);
    if (!nameFontResult.ok) {
      return {ok: false, error: {stage: 'font', error: nameFontResult.error}};
    }
    nameFont = nameFontResult.value;
  }

  const layoutResult = computeSignLayout(
    config,
    sayingFontResult.value,
    nameFont,
    imageResult.value,
    sayingResult.value,
    options.layoutOptions,
  );
  if (!layoutResult.ok) {
    return {ok: false, error: {stage: 'layout', error: layoutResult.error}};
  }

  const format = options.format ?? 'both';
  const files: GeneratedFile[] = [];
  if (format === 'svg' || format === 'both') {
    files.push(...generateSvgFiles(layoutResult.value, config.unit));
  }
  if (format === 'dxf' || format === 'both') {
    files.push(...generateDxfFiles(layoutResult.value, config.unit));
  }

  return {ok: true, value: files};
}
