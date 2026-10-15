import { describe, expect, test } from 'vitest';
import { decodeLegacyPath, toDrawingScene } from '../legacy';
import { legacySnapshot, legacyStroke } from './fixtures';

describe('archived freehand drawing conversion', () => {
  test('preserves geometry, palette, pressure, completed gestures and camera without mutation', () => {
    const snapshot = legacySnapshot({ stroke: legacyStroke() });
    const before = structuredClone(snapshot);
    const scene = toDrawingScene(snapshot);
    expect(scene.elements[0]).toMatchObject({
      id: 'shape:test',
      type: 'freedraw',
      x: 198,
      y: 81.2,
      width: 10,
      height: 20,
      points: [[0, 0], [10, 20]],
      pressures: [0.5, 0.6],
      lastCommittedPoint: [10, 20],
      strokeColor: '#ff6b6b',
      simulatePressure: true,
    });
    expect(scene.appState).toMatchObject({ scrollX: 12, scrollY: -5, zoom: { value: 2 } });
    expect(snapshot).toEqual(before);
    expect(toDrawingScene(snapshot)).toEqual(scene);
    expect(toDrawingScene(scene)).toBe(scene);
  });

  test.each([['s', 3], ['m', 4.5], ['l', 6], ['xl', 11]])('compensates for the Excalidraw freehand multiplier for %s ink', (size, pixelWidth) => {
    const stroke = legacyStroke();
    stroke.props.size = String(size);
    expect(toDrawingScene(legacySnapshot({ stroke })).elements[0].strokeWidth * 4.25).toBeCloseTo(Number(pixelWidth));
  });

  test('applies lazy scale and rotation around the original shape origin', () => {
    const stroke = legacyStroke({ rotation: Math.PI / 2, opacity: 0.5 });
    stroke.props.scaleX = 2;
    stroke.props.scaleY = 3;
    stroke.props.scale = 2;
    const element = toDrawingScene(legacySnapshot({ stroke })).elements[0];
    if (element.type !== 'freedraw') throw new Error('Expected freehand ink');
    expect(element.points[1][0]).toBeCloseTo(-60);
    expect(element.points[1][1]).toBeCloseTo(20);
    expect(element.strokeWidth * 4.25).toBeCloseTo(9);
    expect(element.opacity).toBe(50);
  });

  test('orders strokes and excludes other pages and document records', () => {
    const scene = toDrawingScene(legacySnapshot({
      last: legacyStroke({ id: 'shape:last', index: 'a2' }),
      other: legacyStroke({ id: 'shape:other', parentId: 'page:other' }),
      first: legacyStroke(),
      document: { id: 'document:document', typeName: 'document' },
    }));
    expect(scene.elements.map((e) => e.id)).toEqual(['shape:test', 'shape:last']);
  });

  test('supports dots, empty scenes, and rejects unsupported shape types', () => {
    const stroke = legacyStroke();
    stroke.props.segments[0].points = [{ x: 0, y: 0 }];
    expect(toDrawingScene(legacySnapshot({ stroke })).elements).toHaveLength(1);
    expect(toDrawingScene(null).elements).toEqual([]);
    expect(toDrawingScene(legacySnapshot({})).elements).toEqual([]);
    expect(() => toDrawingScene(legacySnapshot({ stroke: legacyStroke({ type: 'text' }) }))).toThrow('Unsupported');
  });

  test('decodes Float32 origins and Float16 deltas without a tldraw runtime', () => {
    const buffer = new ArrayBuffer(18);
    const view = new DataView(buffer);
    view.setFloat32(0, 2, true);
    view.setFloat32(4, 3, true);
    view.setFloat32(8, 0.5, true);
    view.setUint16(12, 0x3c00, true); // +1
    view.setUint16(14, 0xc000, true); // -2
    view.setUint16(16, 0x3400, true); // +0.25
    const path = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    expect(decodeLegacyPath(path)).toEqual([{ x: 2, y: 3, z: 0.5 }, { x: 3, y: 1, z: 0.75 }]);
    const stroke = legacyStroke();
    stroke.props.segments = [{ type: 'free', path }];
    expect(toDrawingScene(legacySnapshot({ stroke })).elements[0]).toMatchObject({ x: 200, y: 84.2, points: [[0, 0], [1, -2]] });
    expect(() => decodeLegacyPath('AAAA')).toThrow('Invalid legacy');
  });
});
