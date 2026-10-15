import {
  DrawingElement, DrawingScene, DrawingSnapshot, LegacyPoint, LegacyShape,
  DRAWING_COLORS, DRAWING_WIDTHS, emptyDrawing,
} from './types';

function halfFloat(bits: number): number {
  const sign = bits >= 32768 ? -1 : 1;
  const exponent = Math.floor((bits % 32768) / 1024);
  const fraction = bits % 1024;
  if (exponent === 0) return sign * fraction * (2 ** -24);
  if (exponent === 31) return fraction ? NaN : sign * Infinity;
  return sign * (1 + fraction / 1024) * (2 ** (exponent - 15));
}

/** Newer tldraw paths contain one Float32 XYZ followed by Float16 deltas. */
export function decodeLegacyPath(path: string): LegacyPoint[] {
  if (!path) return [];
  const bytes = Uint8Array.from(atob(path), (char) => char.charCodeAt(0));
  if (bytes.length < 12 || (bytes.length - 12) % 6 !== 0) throw new Error('Invalid legacy drawing path');
  const view = new DataView(bytes.buffer);
  let point = { x: view.getFloat32(0, true), y: view.getFloat32(4, true), z: view.getFloat32(8, true) };
  const result = [point];
  for (let offset = 12; offset < bytes.length; offset += 6) {
    point = {
      x: point.x + halfFloat(view.getUint16(offset, true)),
      y: point.y + halfFloat(view.getUint16(offset + 2, true)),
      z: point.z + halfFloat(view.getUint16(offset + 4, true)),
    };
    result.push(point);
  }
  if (result.some((p) => !Number.isFinite(p.x + p.y + p.z))) throw new Error('Invalid legacy drawing coordinates');
  return result;
}

function shapePoints(shape: LegacyShape): LegacyPoint[] {
  return shape.props.segments.flatMap((segment) => {
    const points = segment.points ?? decodeLegacyPath(segment.path ?? '');
    const scaled = points.map((point) => ({
      x: point.x * (shape.props.scaleX ?? 1),
      y: point.y * (shape.props.scaleY ?? 1),
      z: point.z ?? 0.5,
    }));
    if (segment.type !== 'straight' || scaled.length < 2) return scaled;
    const [start, end] = scaled;
    const count = Math.max(4, Math.floor(Math.hypot(end.x - start.x, end.y - start.y) / 16));
    return Array.from({ length: count + 1 }, (_, i) => ({
      x: start.x + ((end.x - start.x) * i) / count,
      y: start.y + ((end.y - start.y) * i) / count,
      z: start.z + ((end.z - start.z) * i) / count,
    }));
  });
}

/** Display archived freehand snapshots without changing their provenance graphs. */
export function toDrawingScene(snapshot: DrawingSnapshot | null): DrawingScene {
  if (!snapshot) return emptyDrawing();
  if ('format' in snapshot) return snapshot;
  const pageId = snapshot.session.currentPageId;
  const shapes = Object.values(snapshot.document.store).filter((record): record is LegacyShape => (
    typeof record === 'object' && record !== null && (record as LegacyShape).typeName === 'shape'
    && (!pageId || (record as LegacyShape).parentId === pageId)
  )).sort((a, b) => (a.index < b.index ? -1 : Number(a.index > b.index)));
  const elements = shapes.flatMap((shape): DrawingElement[] => {
    if (shape.type !== 'draw') throw new Error(`Unsupported legacy drawing shape: ${shape.type}`);
    const rawPoints = shapePoints(shape);
    if (!rawPoints.length) return [];
    const angle = shape.rotation ?? 0;
    const rotated = rawPoints.map((p) => ({
      x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
      y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
      z: p.z ?? 0.5,
    }));
    const origin = rotated[0];
    const points = rotated.map((p) => [p.x - origin.x, p.y - origin.y] as [number, number]);
    const bounds = points.reduce((b, [x, y]) => ({
      left: Math.min(b.left, x),
      right: Math.max(b.right, x),
      top: Math.min(b.top, y),
      bottom: Math.max(b.bottom, y),
    }), {
      left: 0, right: 0, top: 0, bottom: 0,
    });
    return [{
      id: shape.id,
      type: 'freedraw',
      x: shape.x + origin.x,
      y: shape.y + origin.y,
      points: points as Extract<DrawingElement, { type: 'freedraw' }>['points'],
      pressures: rotated.map((p) => p.z),
      simulatePressure: !shape.props.isPen,
      lastCommittedPoint: shape.props.isComplete ? points[points.length - 1] as Extract<DrawingElement, { type: 'freedraw' }>['lastCommittedPoint'] : null,
      width: bounds.right - bounds.left,
      height: bounds.bottom - bounds.top,
      strokeColor: DRAWING_COLORS[shape.props.color] ?? shape.props.color,
      strokeWidth: (DRAWING_WIDTHS[shape.props.size] ?? DRAWING_WIDTHS.m) * (shape.props.scale ?? 1),
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeStyle: 'solid',
      roughness: 0,
      opacity: Math.round((shape.opacity ?? 1) * 100),
      angle: 0 as DrawingElement['angle'],
      seed: 1,
      version: 1,
      versionNonce: 0,
      roundness: null,
      index: null,
      isDeleted: false,
      groupIds: [],
      frameId: null,
      boundElements: null,
      updated: 0,
      link: null,
      locked: false,
    }];
  });
  const camera = snapshot.session.pageStates?.find((page) => page.pageId === pageId)?.camera;
  return {
    ...emptyDrawing(),
    elements,
    appState: {
      scrollX: camera?.x ?? 0,
      scrollY: camera?.y ?? 0,
      zoom: { value: (camera?.z ?? 1) as DrawingScene['appState']['zoom']['value'] },
      viewBackgroundColor: '#ffffff',
    },
  };
}
