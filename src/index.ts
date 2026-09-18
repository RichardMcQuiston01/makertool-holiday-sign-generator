/**
 * @richardmcquiston01/holiday-sign-generator
 *
 * Generates SVG/DXF laser-cutter cut and engrave files for holiday-themed
 * signs: a shaped backer with an optional bundled holiday image, a holiday
 * saying, and an optional last name.
 */

export type {
  FontConfig,
  Holiday,
  MountingConfig,
  Result,
  ScrewSize,
  SignConfig,
  SignShape,
  Unit,
  ValidationError,
} from './types.js';
export {validateSignConfig} from './validation.js';

export type {HolidayContent, ImageOption, SayingOption} from './content.js';
export {
  HOLIDAY_CATALOG,
  getHolidayContent,
  listHolidays,
  resolveImage,
  resolveSaying,
} from './content.js';

export type {
  FontLoadError,
  FontRegistry,
  GlyphOutline,
  LoadedFont,
  PathCommand,
  TextOutline,
} from './font.js';
export {
  createFontRegistry,
  getGlyphOutline,
  getTextOutline,
  loadFont,
} from './font.js';

export type {
  LayoutError,
  LayoutOptions,
  MountingHole,
  Point,
  SignBacker,
  SignLayout,
} from './layout.js';
export {computeSignLayout} from './layout.js';

// GeneratedFile is structurally identical in both output-svg.ts and
// output-dxf.ts; re-exported once here as the shared public type.
export type {GeneratedFile} from './output-svg.js';
export {generateSvgFiles} from './output-svg.js';
export {generateDxfFiles} from './output-dxf.js';

export type {
  GenerateSignError,
  GenerateSignOptions,
  OutputFormat,
} from './generate.js';
export {generateSign} from './generate.js';
