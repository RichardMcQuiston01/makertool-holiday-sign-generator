import type {ImageOption} from './content.js';
import type {LoadedFont, PathCommand} from './font.js';
import {getTextOutline} from './font.js';
import type {Result, ScrewSize, SignConfig, SignShape, Unit} from './types.js';

/**
 * Sign geometry uses a Y-up coordinate system (origin at the bottom-left of
 * the sign backer, X right, Y up), matching common CAD/DXF conventions.
 * Output generators (SVG, etc.) are responsible for flipping Y if their
 * target format expects Y-down.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A circular mounting hole, in sign-backer coordinates. */
export interface MountingHole {
  readonly center: Point;
  readonly diameter: number;
}

/** The sign's backing plate. */
export interface SignBacker {
  readonly shape: SignShape;
  readonly width: number;
  /** Equal to {@link width} when {@link shape} is `round` (both hold the diameter). */
  readonly height: number;
}

/** Computed geometry for a full holiday sign: one engraved/cut piece. */
export interface SignLayout {
  readonly backer: SignBacker;
  readonly sayingPaths: readonly (readonly PathCommand[])[];
  /** Present only when {@link SignConfig.lastName} is set. */
  readonly namePaths?: readonly (readonly PathCommand[])[];
  /** Present only when an image was selected. */
  readonly imagePaths?: readonly (readonly PathCommand[])[];
  /** Present only when mounting type is `screw`. */
  readonly mountingHoles?: readonly MountingHole[];
}

export interface LayoutError {
  readonly message: string;
}

export interface LayoutOptions {
  /** Gap between stacked rows (image/saying/name), in the config's unit. Defaults to 40% of the saying height. */
  readonly rowGap?: number;
}

const REFERENCE_FONT_SIZE = 1000;
const MM_PER_INCH = 25.4;
const HOLE_CLEARANCE_MM = 0.5;

const SCREW_MAJOR_DIAMETER_MM: Record<ScrewSize, number> = {
  M3: 3,
  M4: 4,
  M5: 5,
  '#4-40': 2.845,
  '#6-32': 3.505,
  '#8-32': 4.166,
  '#10-24': 4.826,
  '1/4-20': 6.35,
};

function toUnit(mm: number, unit: Unit): number {
  return unit === 'mm' ? mm : mm / MM_PER_INCH;
}

function holeDiameter(screwSize: ScrewSize, unit: Unit): number {
  return toUnit(SCREW_MAJOR_DIAMETER_MM[screwSize] + HOLE_CLEARANCE_MM, unit);
}

interface BoundingBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
}

function pathPoints(path: readonly PathCommand[]): Point[] {
  const points: Point[] = [];
  for (const command of path) {
    switch (command.type) {
      case 'M':
      case 'L':
        points.push({x: command.x, y: command.y});
        break;
      case 'Q':
        points.push(
          {x: command.x1, y: command.y1},
          {x: command.x, y: command.y},
        );
        break;
      case 'C':
        points.push(
          {x: command.x1, y: command.y1},
          {x: command.x2, y: command.y2},
          {x: command.x, y: command.y},
        );
        break;
      case 'Z':
        break;
    }
  }
  return points;
}

function boundingBoxOf(points: readonly Point[]): BoundingBox {
  if (points.length === 0) {
    return {minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0};
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return {minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY};
}

function unionBoundingBox(
  paths: readonly (readonly PathCommand[])[],
): BoundingBox {
  return boundingBoxOf(paths.flatMap(pathPoints));
}

// Applies an arbitrary (x, y) -> Point transform to every coordinate field of
// every command, so translatePath/scalePath below can share this traversal.
function transformPath(
  path: readonly PathCommand[],
  fn: (x: number, y: number) => Point,
): PathCommand[] {
  return path.map((command): PathCommand => {
    switch (command.type) {
      case 'M': {
        const p = fn(command.x, command.y);
        return {type: 'M', x: p.x, y: p.y};
      }
      case 'L': {
        const p = fn(command.x, command.y);
        return {type: 'L', x: p.x, y: p.y};
      }
      case 'C': {
        const c1 = fn(command.x1, command.y1);
        const c2 = fn(command.x2, command.y2);
        const p = fn(command.x, command.y);
        return {
          type: 'C',
          x1: c1.x,
          y1: c1.y,
          x2: c2.x,
          y2: c2.y,
          x: p.x,
          y: p.y,
        };
      }
      case 'Q': {
        const c1 = fn(command.x1, command.y1);
        const p = fn(command.x, command.y);
        return {type: 'Q', x1: c1.x, y1: c1.y, x: p.x, y: p.y};
      }
      case 'Z':
        return {type: 'Z'};
    }
  });
}

function translatePath(
  path: readonly PathCommand[],
  dx: number,
  dy: number,
): PathCommand[] {
  return transformPath(path, (x, y) => ({x: x + dx, y: y + dy}));
}

interface RowLayout {
  readonly paths: readonly (readonly PathCommand[])[];
  readonly width: number;
  readonly height: number;
}

function layoutTextRow(
  font: LoadedFont,
  text: string,
  targetHeight: number,
): Result<RowLayout, LayoutError> {
  const referenceResult = getTextOutline(font, text, REFERENCE_FONT_SIZE);
  if (!referenceResult.ok) {
    return {ok: false, error: {message: referenceResult.error.message}};
  }
  const referenceHeight = boundingBoxOf(
    pathPoints(referenceResult.value.path),
  ).height;
  if (referenceHeight <= 0) {
    return {
      ok: false,
      error: {message: `Text "${text}" produced no visible glyph outlines.`},
    };
  }

  const fontSize = REFERENCE_FONT_SIZE * (targetHeight / referenceHeight);
  const finalResult = getTextOutline(font, text, fontSize);
  if (!finalResult.ok) {
    return {ok: false, error: {message: finalResult.error.message}};
  }
  const height = boundingBoxOf(pathPoints(finalResult.value.path)).height;
  return {
    ok: true,
    value: {
      paths: [finalResult.value.path],
      width: finalResult.value.advanceWidth,
      height,
    },
  };
}

// Scales a bundled ImageOption (authored in its own fixed design box) so its
// rendered height matches targetHeight, preserving aspect ratio, and
// normalizes it to a local origin at its own bounding box's bottom-left —
// mirroring how a glyph outline is already positioned relative to (0, 0).
function layoutImageRow(image: ImageOption, targetHeight: number): RowLayout {
  const bbox = unionBoundingBox(image.paths);
  if (bbox.height <= 0) {
    return {paths: [], width: 0, height: 0};
  }
  const scale = targetHeight / bbox.height;
  const paths = image.paths.map(path =>
    transformPath(path, (x, y) => ({
      x: (x - bbox.minX) * scale,
      y: (y - bbox.minY) * scale,
    })),
  );
  return {paths, width: bbox.width * scale, height: targetHeight};
}

function translateRow(row: RowLayout, dx: number, dy: number): PathCommand[][] {
  return row.paths.map(path => translatePath(path, dx, dy));
}

function computeBacker(
  shape: SignShape,
  contentWidth: number,
  contentHeight: number,
  margin: number,
): SignBacker {
  switch (shape) {
    case 'rectangle':
      return {
        shape,
        width: contentWidth + margin * 2,
        height: contentHeight + margin * 2,
      };
    case 'square': {
      const side = Math.max(contentWidth, contentHeight) + margin * 2;
      return {shape, width: side, height: side};
    }
    case 'round': {
      const halfDiagonal = Math.sqrt(
        (contentWidth / 2) ** 2 + (contentHeight / 2) ** 2,
      );
      const diameter = 2 * (halfDiagonal + margin);
      return {shape, width: diameter, height: diameter};
    }
    case 'ellipse': {
      // Inflating each half-axis by sqrt(2) is the ellipse analog of
      // round's half-diagonal inflation above: it's the smallest
      // axis-aligned ellipse whose boundary passes through every corner of
      // the content rectangle.
      return {
        shape,
        width: contentWidth * Math.SQRT2 + margin * 2,
        height: contentHeight * Math.SQRT2 + margin * 2,
      };
    }
  }
}

// Places two mounting holes near the top edge for hanging the finished sign.
// This is a coarse fit (not solved against the exact backer boundary curve
// for round/ellipse shapes), so callers using a small margin with those
// shapes should double check the holes land inside the cut outline.
function placeMountingHoles(
  backer: SignBacker,
  diameter: number,
): MountingHole[] {
  const insetY = diameter * 1.5;
  const insetX = backer.width * 0.25;
  const y = backer.height - insetY;
  return [
    {center: {x: insetX, y}, diameter},
    {center: {x: backer.width - insetX, y}, diameter},
  ];
}

/**
 * Computes the full geometry for a holiday sign: backer dimensions, and the
 * positioned saying/name text and image vector art, stacked and centered as
 * a single content block (image on top, saying in the middle, last name at
 * the bottom — whichever of these three are present).
 */
export function computeSignLayout(
  config: SignConfig,
  sayingFont: LoadedFont,
  nameFont: LoadedFont | undefined,
  image: ImageOption | undefined,
  sayingText: string,
  options: LayoutOptions = {},
): Result<SignLayout, LayoutError> {
  const lastName = config.lastName?.trim();
  const hasLastName = Boolean(lastName);
  if (hasLastName && !nameFont) {
    return {
      ok: false,
      error: {message: 'A nameFont is required when lastName is provided.'},
    };
  }

  const rowGap = options.rowGap ?? config.sayingHeight * 0.4;

  const sayingRowResult = layoutTextRow(
    sayingFont,
    sayingText,
    config.sayingHeight,
  );
  if (!sayingRowResult.ok) {
    return sayingRowResult;
  }
  const sayingRow = sayingRowResult.value;

  let nameRow: RowLayout | undefined;
  if (hasLastName) {
    const nameHeight = config.nameHeight ?? config.sayingHeight;
    const nameRowResult = layoutTextRow(
      nameFont as LoadedFont,
      lastName as string,
      nameHeight,
    );
    if (!nameRowResult.ok) {
      return nameRowResult;
    }
    nameRow = nameRowResult.value;
  }

  const imageRow = image
    ? layoutImageRow(image, config.imageHeight ?? config.sayingHeight * 2)
    : undefined;

  const contentWidth = Math.max(
    sayingRow.width,
    nameRow?.width ?? 0,
    imageRow?.width ?? 0,
  );

  // Stack bottom-to-top: name, then saying, then image — a gap is inserted
  // only between rows that are actually present.
  let cursorY = 0;
  let nameDy = 0;
  if (nameRow) {
    nameDy = cursorY;
    cursorY += nameRow.height + rowGap;
  }
  const sayingDy = cursorY;
  cursorY += sayingRow.height;
  let imageDy = 0;
  if (imageRow) {
    cursorY += rowGap;
    imageDy = cursorY;
    cursorY += imageRow.height;
  }
  const contentHeight = cursorY;

  const backer = computeBacker(
    config.shape,
    contentWidth,
    contentHeight,
    config.margin,
  );
  const offsetX = (backer.width - contentWidth) / 2;
  const offsetY = (backer.height - contentHeight) / 2;

  const sayingPaths = translateRow(
    sayingRow,
    offsetX + (contentWidth - sayingRow.width) / 2,
    offsetY + sayingDy,
  );
  const namePaths = nameRow
    ? translateRow(
        nameRow,
        offsetX + (contentWidth - nameRow.width) / 2,
        offsetY + nameDy,
      )
    : undefined;
  const imagePaths = imageRow
    ? translateRow(
        imageRow,
        offsetX + (contentWidth - imageRow.width) / 2,
        offsetY + imageDy,
      )
    : undefined;

  const mountingHoles =
    config.mounting.type === 'screw'
      ? placeMountingHoles(
          backer,
          holeDiameter(config.mounting.screwSize, config.unit),
        )
      : undefined;

  return {
    ok: true,
    value: {
      backer,
      sayingPaths,
      ...(namePaths ? {namePaths} : {}),
      ...(imagePaths ? {imagePaths} : {}),
      ...(mountingHoles ? {mountingHoles} : {}),
    },
  };
}
