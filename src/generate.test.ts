import opentype from 'opentype.js';
import {beforeAll, describe, expect, it} from 'vitest';
import {createFontRegistry} from './font.js';
import type {FontRegistry} from './font.js';
import {generateSign} from './generate.js';
import type {SignConfig} from './types.js';

function buildTestFontBuffer(characters: string): ArrayBuffer {
  const glyphs = [
    new opentype.Glyph({
      name: '.notdef',
      unicode: 0,
      advanceWidth: 300,
      path: new opentype.Path(),
    }),
  ];

  for (const character of characters) {
    const path = new opentype.Path();
    path.moveTo(0, 0);
    path.lineTo(300, 0);
    path.lineTo(300, 700);
    path.lineTo(0, 700);
    path.close();
    glyphs.push(
      new opentype.Glyph({
        name: character,
        unicode: character.charCodeAt(0),
        advanceWidth: 350,
        path,
      }),
    );
  }

  const font = new opentype.Font({
    familyName: 'Generate Test Font',
    styleName: 'Regular',
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs,
  });

  return font.toArrayBuffer();
}

// Covers every unique letter used by the sayings/names in these tests
// ("Happy Holidays", "Smith") — spaces need no glyph (getTextOutline skips
// the glyph-missing check for them, and opentype.js falls back to .notdef).
const TEST_CHARS = 'HapyolidsSmth';

function baseConfig(overrides: Partial<SignConfig> = {}): SignConfig {
  return {
    holiday: 'christmas',
    sayingId: 'happyHolidays',
    font: {sayingFont: 'saying'},
    shape: 'rectangle',
    sayingHeight: 2,
    margin: 0.5,
    unit: 'in',
    mounting: {type: 'adhesive'},
    ...overrides,
  };
}

// exactOptionalPropertyTypes forbids passing `sayingId: undefined` as an
// override, so tests that need it absent strip it from an already-built config.
function withoutSayingId(config: SignConfig): SignConfig {
  const rest: Record<string, unknown> = {...config};
  delete rest.sayingId;
  return rest as unknown as SignConfig;
}

describe('generateSign', () => {
  let fonts: FontRegistry;

  beforeAll(() => {
    fonts = createFontRegistry();
    const saying = fonts.register('saying', buildTestFontBuffer(TEST_CHARS));
    if (!saying.ok) throw new Error('saying test font failed to register');
    const name = fonts.register('name', buildTestFontBuffer(TEST_CHARS));
    if (!name.ok) throw new Error('name test font failed to register');
  });

  it('generates both SVG and DXF files by default', () => {
    const result = generateSign({config: baseConfig(), fonts});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map(f => f.name).sort()).toEqual([
        'holiday-sign.dxf',
        'holiday-sign.svg',
      ]);
    }
  });

  it('generates only SVG files when format is "svg"', () => {
    const result = generateSign({config: baseConfig(), fonts, format: 'svg'});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.every(f => f.name.endsWith('.svg'))).toBe(true);
      expect(result.value).toHaveLength(1);
    }
  });

  it('generates only DXF files when format is "dxf"', () => {
    const result = generateSign({config: baseConfig(), fonts, format: 'dxf'});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.every(f => f.name.endsWith('.dxf'))).toBe(true);
      expect(result.value).toHaveLength(1);
    }
  });

  it('generates a sign with a last name', () => {
    const result = generateSign({
      config: baseConfig({
        lastName: 'Smith',
        font: {sayingFont: 'saying', nameFont: 'name'},
      }),
      fonts,
      format: 'svg',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]?.content).toContain('engrave');
    }
  });

  it('returns a validation-stage error for an invalid config', () => {
    const result = generateSign({
      config: baseConfig({sayingId: 'happyHalloween'}),
      fonts,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.stage).toBe('validation');
      if (result.error.stage === 'validation') {
        expect(result.error.errors).toContainEqual(
          expect.objectContaining({field: 'sayingId'}),
        );
      }
    }
  });

  it('returns a font-stage error when the saying font id is not registered', () => {
    const result = generateSign({
      config: baseConfig({font: {sayingFont: 'missing-font'}}),
      fonts,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.stage).toBe('font');
    }
  });

  it('returns a font-stage error when the name font id is not registered', () => {
    const result = generateSign({
      config: baseConfig({
        lastName: 'Smith',
        font: {sayingFont: 'saying', nameFont: 'missing-font'},
      }),
      fonts,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.stage).toBe('font');
    }
  });

  it('returns a layout-stage error when the font is missing a glyph the saying needs', () => {
    const limitedFonts = createFontRegistry();
    const registerResult = limitedFonts.register(
      'limited',
      buildTestFontBuffer('abc'),
    );
    expect(registerResult.ok).toBe(true);

    const result = generateSign({
      config: withoutSayingId(
        baseConfig({
          sayingText: 'xyz',
          font: {sayingFont: 'limited'},
        }),
      ),
      fonts: limitedFonts,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.stage).toBe('layout');
    }
  });

  it('generates two mounting holes for screw mounting, reflected in output', () => {
    const result = generateSign({
      config: baseConfig({mounting: {type: 'screw', screwSize: 'M3'}}),
      fonts,
      format: 'dxf',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const file = result.value.find(f => f.name === 'holiday-sign.dxf');
      expect(file).toBeDefined();
      const circleCount = (file?.content.match(/CIRCLE/g) ?? []).length;
      expect(circleCount).toBe(2);
    }
  });
});
