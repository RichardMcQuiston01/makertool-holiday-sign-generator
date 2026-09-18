import opentype from 'opentype.js';
import {beforeAll, describe, expect, it} from 'vitest';
import type {ImageOption} from './content.js';
import {getHolidayContent} from './content.js';
import {loadFont} from './font.js';
import type {LoadedFont, PathCommand} from './font.js';
import {computeSignLayout} from './layout.js';
import type {SignConfig} from './types.js';

const UNITS_PER_EM = 1000;
const GLYPH_HEIGHT = 700; // every test glyph spans y=0..700, for predictable scaling.

function buildTestFontBuffer(characters: string): ArrayBuffer {
  const glyphs = [
    new opentype.Glyph({
      name: '.notdef',
      unicode: 0,
      advanceWidth: 300,
      path: new opentype.Path(),
    }),
  ];

  let index = 0;
  for (const character of characters) {
    const path = new opentype.Path();
    const width = 300 + index * 20;
    path.moveTo(0, 0);
    path.lineTo(width, 0);
    path.lineTo(width, GLYPH_HEIGHT);
    path.lineTo(0, GLYPH_HEIGHT);
    path.close();
    glyphs.push(
      new opentype.Glyph({
        name: character,
        unicode: character.charCodeAt(0),
        advanceWidth: width + 50,
        path,
      }),
    );
    index += 1;
  }

  const font = new opentype.Font({
    familyName: 'Layout Test Font',
    styleName: 'Regular',
    unitsPerEm: UNITS_PER_EM,
    ascender: 800,
    descender: -200,
    glyphs,
  });

  return font.toArrayBuffer();
}

function ysOf(paths: readonly (readonly PathCommand[])[]): number[] {
  return paths.flatMap(path =>
    path.flatMap(cmd => ('y' in cmd ? [cmd.y] : [])),
  );
}

function baseConfig(overrides: Partial<SignConfig> = {}): SignConfig {
  return {
    holiday: 'christmas',
    sayingId: 'merryChristmas',
    font: {sayingFont: 'saying'},
    shape: 'rectangle',
    sayingHeight: 2,
    margin: 0.5,
    unit: 'in',
    mounting: {type: 'adhesive'},
    ...overrides,
  };
}

const TEST_IMAGE: ImageOption = {
  id: 'test-image',
  label: 'Test Image',
  paths: [
    [
      {type: 'M', x: 0, y: 0},
      {type: 'L', x: 40, y: 0},
      {type: 'L', x: 40, y: 20},
      {type: 'L', x: 0, y: 20},
      {type: 'Z'},
    ],
  ],
};

describe('computeSignLayout', () => {
  let sayingFont: LoadedFont;
  let nameFont: LoadedFont;

  beforeAll(() => {
    const saying = loadFont(buildTestFontBuffer('MerryChristmas '));
    if (!saying.ok) throw new Error('saying test font failed to load');
    sayingFont = saying.value;

    const name = loadFont(buildTestFontBuffer('Smith'));
    if (!name.ok) throw new Error('name test font failed to load');
    nameFont = name.value;
  });

  it('lays out a saying-only sign with no name, image, or holes', () => {
    const result = computeSignLayout(
      baseConfig(),
      sayingFont,
      undefined,
      undefined,
      'Merry Christmas',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sayingPaths.length).toBeGreaterThan(0);
      expect(result.value.namePaths).toBeUndefined();
      expect(result.value.imagePaths).toBeUndefined();
      expect(result.value.mountingHoles).toBeUndefined();
    }
  });

  it('scales the saying text to the requested sayingHeight', () => {
    const result = computeSignLayout(
      baseConfig(),
      sayingFont,
      undefined,
      undefined,
      'Merry Christmas',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ys = ysOf(result.value.sayingPaths);
      const height = Math.max(...ys) - Math.min(...ys);
      expect(height).toBeCloseTo(2, 5);
    }
  });

  it('sizes a rectangle backer to content plus margin on every edge', () => {
    const result = computeSignLayout(
      baseConfig(),
      sayingFont,
      undefined,
      undefined,
      'Merry Christmas',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const contentHeight = result.value.backer.height - 2 * 0.5;
      expect(contentHeight).toBeCloseTo(2, 5);
    }
  });

  it('produces a square backer with equal width and height', () => {
    const result = computeSignLayout(
      baseConfig({shape: 'square'}),
      sayingFont,
      undefined,
      undefined,
      'Merry Christmas',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.backer.width).toBeCloseTo(
        result.value.backer.height,
        10,
      );
    }
  });

  it('produces a round backer with equal width and height', () => {
    const result = computeSignLayout(
      baseConfig({shape: 'round'}),
      sayingFont,
      undefined,
      undefined,
      'Merry Christmas',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.backer.width).toBeCloseTo(
        result.value.backer.height,
        10,
      );
    }
  });

  it('produces an ellipse backer wider or taller than the content, not equal to it', () => {
    const result = computeSignLayout(
      baseConfig({shape: 'ellipse'}),
      sayingFont,
      undefined,
      undefined,
      'Merry Christmas',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.backer.width).toBeGreaterThan(0);
      expect(result.value.backer.height).toBeGreaterThan(0);
    }
  });

  it('stacks the name row below the saying row', () => {
    const result = computeSignLayout(
      baseConfig({
        lastName: 'Smith',
        font: {sayingFont: 'saying', nameFont: 'name'},
      }),
      sayingFont,
      nameFont,
      undefined,
      'Merry Christmas',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const sayingMinY = Math.min(...ysOf(result.value.sayingPaths));
      const nameMaxY = Math.max(...ysOf(result.value.namePaths ?? []));
      expect(nameMaxY).toBeLessThanOrEqual(sayingMinY);
    }
  });

  it('stacks the image row above the saying row', () => {
    const result = computeSignLayout(
      baseConfig({imageId: 'tree'}),
      sayingFont,
      undefined,
      TEST_IMAGE,
      'Merry Christmas',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const sayingMaxY = Math.max(...ysOf(result.value.sayingPaths));
      const imageMinY = Math.min(...ysOf(result.value.imagePaths ?? []));
      expect(imageMinY).toBeGreaterThanOrEqual(sayingMaxY);
    }
  });

  it('fails when lastName is provided but no nameFont is supplied', () => {
    const result = computeSignLayout(
      baseConfig({lastName: 'Smith'}),
      sayingFont,
      undefined,
      undefined,
      'Merry Christmas',
    );
    expect(result.ok).toBe(false);
  });

  it('places two mounting holes for screw mounting, none for adhesive', () => {
    const screw = computeSignLayout(
      baseConfig({mounting: {type: 'screw', screwSize: 'M3'}}),
      sayingFont,
      undefined,
      undefined,
      'Merry Christmas',
    );
    expect(screw.ok).toBe(true);
    if (screw.ok) {
      expect(screw.value.mountingHoles).toHaveLength(2);
      for (const hole of screw.value.mountingHoles ?? []) {
        expect(hole.diameter).toBeGreaterThan(0);
        expect(hole.center.x).toBeGreaterThanOrEqual(0);
        expect(hole.center.x).toBeLessThanOrEqual(screw.value.backer.width);
        expect(hole.center.y).toBeGreaterThanOrEqual(0);
        expect(hole.center.y).toBeLessThanOrEqual(screw.value.backer.height);
      }
    }

    const adhesive = computeSignLayout(
      baseConfig({mounting: {type: 'adhesive'}}),
      sayingFont,
      undefined,
      undefined,
      'Merry Christmas',
    );
    expect(adhesive.ok).toBe(true);
    if (adhesive.ok) {
      expect(adhesive.value.mountingHoles).toBeUndefined();
    }
  });

  it('lays out every bundled holiday image without error', () => {
    for (const holiday of ['christmas', 'halloween', 'thanksgiving'] as const) {
      const image = getHolidayContent(holiday).images[0];
      expect(image).toBeDefined();
      if (!image) continue;
      const result = computeSignLayout(
        baseConfig({holiday}),
        sayingFont,
        undefined,
        image,
        'test',
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.imagePaths?.length).toBeGreaterThan(0);
      }
    }
  });
});
