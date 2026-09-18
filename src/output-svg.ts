import type {PathCommand} from './font.js';
import type {MountingHole, SignLayout} from './layout.js';
import type {Unit} from './types.js';

/** A single generated cut/engrave file, ready to write to disk. */
export interface GeneratedFile {
  readonly name: string;
  readonly content: string;
}

type LineKind = 'cut' | 'engrave';

// Keeps emitted coordinates finite-precision and file sizes sane.
function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function strokeWidthFor(unit: Unit): number {
  return unit === 'mm' ? 0.1 : 0.004;
}

function strokeColorFor(kind: LineKind): string {
  return kind === 'engrave' ? '#0000FF' : '#000000';
}

// SVG is Y-down; our geometry is Y-up, so every emitted Y is flipped
// against the document's own height.
function pathToD(path: readonly PathCommand[], localHeight: number): string {
  const flipY = (y: number): number => round(localHeight - y);
  const segments: string[] = [];
  for (const command of path) {
    switch (command.type) {
      case 'M':
        segments.push(`M ${round(command.x)},${flipY(command.y)}`);
        break;
      case 'L':
        segments.push(`L ${round(command.x)},${flipY(command.y)}`);
        break;
      case 'C':
        segments.push(
          `C ${round(command.x1)},${flipY(command.y1)} ` +
            `${round(command.x2)},${flipY(command.y2)} ` +
            `${round(command.x)},${flipY(command.y)}`,
        );
        break;
      case 'Q':
        segments.push(
          `Q ${round(command.x1)},${flipY(command.y1)} ` +
            `${round(command.x)},${flipY(command.y)}`,
        );
        break;
      case 'Z':
        segments.push('Z');
        break;
    }
  }
  return segments.join(' ');
}

function pathElement(
  path: readonly PathCommand[],
  localHeight: number,
  strokeWidth: number,
  kind: LineKind,
): string {
  return `<path class="${kind}" d="${pathToD(path, localHeight)}" fill="none" stroke="${strokeColorFor(kind)}" stroke-width="${strokeWidth}"/>`;
}

function circleElement(
  center: {readonly x: number; readonly y: number},
  diameter: number,
  localHeight: number,
  kind: LineKind,
  strokeWidth: number,
): string {
  const cx = round(center.x);
  const cy = round(localHeight - center.y);
  const r = round(diameter / 2);
  return `<circle class="${kind}" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${strokeColorFor(kind)}" stroke-width="${strokeWidth}"/>`;
}

function ellipseElement(
  width: number,
  height: number,
  strokeWidth: number,
): string {
  const cx = round(width / 2);
  const cy = round(height / 2);
  return `<ellipse class="cut" cx="${cx}" cy="${cy}" rx="${round(width / 2)}" ry="${round(height / 2)}" fill="none" stroke="#000000" stroke-width="${strokeWidth}"/>`;
}

function svgDocument(
  width: number,
  height: number,
  unit: Unit,
  body: readonly string[],
): string {
  const w = round(width);
  const h = round(height);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}${unit}" height="${h}${unit}" viewBox="0 0 ${w} ${h}">`,
    ...body.map(element => `  ${element}`),
    '</svg>',
  ].join('\n');
}

function backerOutlineElement(layout: SignLayout, strokeWidth: number): string {
  const {backer} = layout;
  const localHeight = backer.height;
  switch (backer.shape) {
    case 'round':
      return circleElement(
        {x: backer.width / 2, y: backer.height / 2},
        backer.width,
        localHeight,
        'cut',
        strokeWidth,
      );
    case 'ellipse':
      return ellipseElement(backer.width, backer.height, strokeWidth);
    case 'square':
    case 'rectangle':
      return `<rect class="cut" x="0" y="0" width="${round(backer.width)}" height="${round(backer.height)}" fill="none" stroke="#000000" stroke-width="${strokeWidth}"/>`;
  }
}

function holeElements(
  holes: readonly MountingHole[] | undefined,
  localHeight: number,
  strokeWidth: number,
): string[] {
  return (holes ?? []).map(hole =>
    circleElement(hole.center, hole.diameter, localHeight, 'cut', strokeWidth),
  );
}

/**
 * Generates a single SVG cut/engrave file for a laid-out holiday sign: the
 * backer's outer shape (and any mounting holes) as cut lines, and the
 * image/saying/name vector art as engrave lines.
 */
export function generateSvgFiles(
  layout: SignLayout,
  unit: Unit,
): GeneratedFile[] {
  const strokeWidth = strokeWidthFor(unit);
  const localHeight = layout.backer.height;
  const body: string[] = [backerOutlineElement(layout, strokeWidth)];

  for (const path of layout.imagePaths ?? []) {
    body.push(pathElement(path, localHeight, strokeWidth, 'engrave'));
  }
  for (const path of layout.sayingPaths) {
    body.push(pathElement(path, localHeight, strokeWidth, 'engrave'));
  }
  for (const path of layout.namePaths ?? []) {
    body.push(pathElement(path, localHeight, strokeWidth, 'engrave'));
  }

  body.push(...holeElements(layout.mountingHoles, localHeight, strokeWidth));

  return [
    {
      name: 'holiday-sign.svg',
      content: svgDocument(
        layout.backer.width,
        layout.backer.height,
        unit,
        body,
      ),
    },
  ];
}
