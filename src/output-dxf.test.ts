import {describe, expect, it} from 'vitest';
import type {SignLayout} from './layout.js';
import {generateDxfFiles} from './output-dxf.js';

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

describe('generateDxfFiles', () => {
  it('returns a single named DXF file', () => {
    const files = generateDxfFiles(baseLayout(), 'in');
    expect(files).toHaveLength(1);
    expect(files[0]?.name).toBe('holiday-sign.dxf');
    expect(files[0]?.content.length).toBeGreaterThan(0);
  });

  it('includes both CUT and ENGRAVE layers', () => {
    const files = generateDxfFiles(baseLayout(), 'in');
    expect(files[0]?.content).toContain('CUT');
    expect(files[0]?.content).toContain('ENGRAVE');
  });

  it('renders successfully for every backer shape', () => {
    for (const shape of ['square', 'rectangle', 'ellipse', 'round'] as const) {
      const files = generateDxfFiles(
        baseLayout({
          backer: {shape, width: 10, height: shape === 'round' ? 10 : 6},
        }),
        'in',
      );
      expect(files[0]?.content.length).toBeGreaterThan(0);
    }
  });

  it('includes a CIRCLE entity per mounting hole', () => {
    const files = generateDxfFiles(
      baseLayout({
        mountingHoles: [
          {center: {x: 2, y: 5}, diameter: 0.2},
          {center: {x: 8, y: 5}, diameter: 0.2},
        ],
      }),
      'in',
    );
    const circleCount = (files[0]?.content.match(/CIRCLE/g) ?? []).length;
    // One CIRCLE per hole, plus none for a rectangle backer outline.
    expect(circleCount).toBe(2);
  });
});
