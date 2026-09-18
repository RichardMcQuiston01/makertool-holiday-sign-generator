import {describe, expect, it} from 'vitest';
import type {SignLayout} from './layout.js';
import {generateSvgFiles} from './output-svg.js';

const SQUARE_PATH = [
  {type: 'M' as const, x: 1, y: 1},
  {type: 'L' as const, x: 3, y: 1},
  {type: 'L' as const, x: 3, y: 3},
  {type: 'L' as const, x: 1, y: 3},
  {type: 'Z' as const},
];

function baseLayout(overrides: Partial<SignLayout> = {}): SignLayout {
  return {
    backer: {shape: 'rectangle', width: 10, height: 6},
    sayingPaths: [SQUARE_PATH],
    ...overrides,
  };
}

describe('generateSvgFiles', () => {
  it('returns a single named SVG file', () => {
    const files = generateSvgFiles(baseLayout(), 'in');
    expect(files).toHaveLength(1);
    expect(files[0]?.name).toBe('holiday-sign.svg');
    expect(files[0]?.content).toContain('<svg');
    expect(files[0]?.content).toContain('in"');
  });

  it('emits a rect cut outline for rectangle/square backers', () => {
    const files = generateSvgFiles(baseLayout(), 'in');
    expect(files[0]?.content).toContain('<rect class="cut"');
  });

  it('emits a circle cut outline for a round backer', () => {
    const files = generateSvgFiles(
      baseLayout({backer: {shape: 'round', width: 8, height: 8}}),
      'in',
    );
    expect(files[0]?.content).toContain('<circle class="cut"');
  });

  it('emits an ellipse cut outline for an ellipse backer', () => {
    const files = generateSvgFiles(
      baseLayout({backer: {shape: 'ellipse', width: 12, height: 7}}),
      'in',
    );
    expect(files[0]?.content).toContain('<ellipse class="cut"');
  });

  it('emits engrave paths for saying, name, and image content', () => {
    const files = generateSvgFiles(
      baseLayout({namePaths: [SQUARE_PATH], imagePaths: [SQUARE_PATH]}),
      'in',
    );
    const engraveCount = (files[0]?.content.match(/class="engrave"/g) ?? [])
      .length;
    expect(engraveCount).toBe(3);
  });

  it('emits a cut circle per mounting hole', () => {
    const files = generateSvgFiles(
      baseLayout({
        mountingHoles: [
          {center: {x: 2, y: 5}, diameter: 0.2},
          {center: {x: 8, y: 5}, diameter: 0.2},
        ],
      }),
      'in',
    );
    const cutCircleCount = (
      files[0]?.content.match(/<circle class="cut"/g) ?? []
    ).length;
    expect(cutCircleCount).toBe(2);
  });
});
