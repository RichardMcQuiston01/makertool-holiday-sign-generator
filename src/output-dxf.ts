import {Colors, DxfWriter, LWPolylineFlags, Units} from '@tarikjabiri/dxf';
import type {PathCommand} from './font.js';
import type {MountingHole, SignLayout} from './layout.js';
import type {Unit} from './types.js';

/** A single generated cut/engrave file, ready to write to disk. */
export interface GeneratedFile {
  readonly name: string;
  readonly content: string;
}

/** Number of straight-line segments used to flatten each C/Q Bezier curve, or an ellipse backer outline. */
const CURVE_SEGMENTS = 24;

const CUT_LAYER = 'CUT';
const ENGRAVE_LAYER = 'ENGRAVE';

interface FlatPoint {
  readonly x: number;
  readonly y: number;
}

function cubicPointAt(
  p0: FlatPoint,
  p1: FlatPoint,
  p2: FlatPoint,
  p3: FlatPoint,
  t: number,
): FlatPoint {
  const mt = 1 - t;
  return {
    x:
      mt * mt * mt * p0.x +
      3 * mt * mt * t * p1.x +
      3 * mt * t * t * p2.x +
      t * t * t * p3.x,
    y:
      mt * mt * mt * p0.y +
      3 * mt * mt * t * p1.y +
      3 * mt * t * t * p2.y +
      t * t * t * p3.y,
  };
}

function quadPointAt(
  p0: FlatPoint,
  p1: FlatPoint,
  p2: FlatPoint,
  t: number,
): FlatPoint {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

interface FlattenedSubpath {
  readonly vertices: readonly FlatPoint[];
  readonly closed: boolean;
}

// DXF's LWPOLYLINE is straight-segment-only, so C/Q commands are subdivided
// into CURVE_SEGMENTS line segments each. A path may contain several
// subpaths (e.g. a bundled image icon made of multiple shapes), each
// becoming its own LWPOLYLINE entity.
function flattenPathToSubpaths(
  path: readonly PathCommand[],
): FlattenedSubpath[] {
  const subpaths: FlattenedSubpath[] = [];
  let currentVertices: FlatPoint[] = [];
  let currentClosed = false;
  let currentPoint: FlatPoint = {x: 0, y: 0};
  let startPoint: FlatPoint = {x: 0, y: 0};

  const finalizeCurrent = (): void => {
    if (currentVertices.length > 0) {
      subpaths.push({vertices: currentVertices, closed: currentClosed});
    }
    currentVertices = [];
    currentClosed = false;
  };

  for (const command of path) {
    switch (command.type) {
      case 'M':
        finalizeCurrent();
        currentPoint = {x: command.x, y: command.y};
        startPoint = currentPoint;
        currentVertices.push(currentPoint);
        break;
      case 'L':
        currentPoint = {x: command.x, y: command.y};
        currentVertices.push(currentPoint);
        break;
      case 'C': {
        const p0 = currentPoint;
        const p1: FlatPoint = {x: command.x1, y: command.y1};
        const p2: FlatPoint = {x: command.x2, y: command.y2};
        const p3: FlatPoint = {x: command.x, y: command.y};
        for (let i = 1; i <= CURVE_SEGMENTS; i += 1) {
          currentVertices.push(
            cubicPointAt(p0, p1, p2, p3, i / CURVE_SEGMENTS),
          );
        }
        currentPoint = p3;
        break;
      }
      case 'Q': {
        const p0 = currentPoint;
        const p1: FlatPoint = {x: command.x1, y: command.y1};
        const p2: FlatPoint = {x: command.x, y: command.y};
        for (let i = 1; i <= CURVE_SEGMENTS; i += 1) {
          currentVertices.push(quadPointAt(p0, p1, p2, i / CURVE_SEGMENTS));
        }
        currentPoint = p2;
        break;
      }
      case 'Z':
        currentClosed = true;
        currentPoint = startPoint;
        break;
    }
  }
  finalizeCurrent();

  return subpaths;
}

function ellipsePolygon(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  segments: number,
): FlatPoint[] {
  const points: FlatPoint[] = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle)});
  }
  return points;
}

function createWriter(unit: Unit): DxfWriter {
  const dxf = new DxfWriter();
  dxf.addLayer(CUT_LAYER, Colors.White);
  dxf.addLayer(ENGRAVE_LAYER, Colors.Blue);
  dxf.setUnits(unit === 'mm' ? Units.Millimeters : Units.Inches);
  return dxf;
}

function addOutline(
  dxf: DxfWriter,
  path: readonly PathCommand[],
  layerName: string,
): void {
  for (const subpath of flattenPathToSubpaths(path)) {
    if (subpath.vertices.length === 0) continue;
    dxf.addLWPolyline(
      subpath.vertices.map(vertex => ({point: {x: vertex.x, y: vertex.y}})),
      {
        layerName,
        flags: subpath.closed ? LWPolylineFlags.Closed : LWPolylineFlags.None,
      },
    );
  }
}

function addHole(dxf: DxfWriter, hole: MountingHole, layerName: string): void {
  dxf.addCircle({x: hole.center.x, y: hole.center.y, z: 0}, hole.diameter / 2, {
    layerName,
  });
}

function addBackerOutline(dxf: DxfWriter, layout: SignLayout): void {
  const {backer} = layout;
  switch (backer.shape) {
    case 'round':
      dxf.addCircle(
        {x: backer.width / 2, y: backer.height / 2, z: 0},
        backer.width / 2,
        {layerName: CUT_LAYER},
      );
      return;
    case 'ellipse': {
      const points = ellipsePolygon(
        backer.width / 2,
        backer.height / 2,
        backer.width / 2,
        backer.height / 2,
        CURVE_SEGMENTS * 4,
      );
      dxf.addLWPolyline(
        points.map(point => ({point: {x: point.x, y: point.y}})),
        {layerName: CUT_LAYER, flags: LWPolylineFlags.Closed},
      );
      return;
    }
    case 'square':
    case 'rectangle':
      dxf.addLWPolyline(
        [
          {point: {x: 0, y: 0}},
          {point: {x: backer.width, y: 0}},
          {point: {x: backer.width, y: backer.height}},
          {point: {x: 0, y: backer.height}},
        ],
        {layerName: CUT_LAYER, flags: LWPolylineFlags.Closed},
      );
  }
}

/**
 * Generates a single DXF cut/engrave file for a laid-out holiday sign: the
 * backer's outer shape (and any mounting holes) on the CUT layer, and the
 * image/saying/name vector art on the ENGRAVE layer.
 */
export function generateDxfFiles(
  layout: SignLayout,
  unit: Unit,
): GeneratedFile[] {
  const dxf = createWriter(unit);

  addBackerOutline(dxf, layout);

  for (const path of layout.imagePaths ?? []) {
    addOutline(dxf, path, ENGRAVE_LAYER);
  }
  for (const path of layout.sayingPaths) {
    addOutline(dxf, path, ENGRAVE_LAYER);
  }
  for (const path of layout.namePaths ?? []) {
    addOutline(dxf, path, ENGRAVE_LAYER);
  }

  for (const hole of layout.mountingHoles ?? []) {
    addHole(dxf, hole, CUT_LAYER);
  }

  return [{name: 'holiday-sign.dxf', content: dxf.stringify()}];
}
