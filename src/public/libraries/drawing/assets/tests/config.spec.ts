import {
  afterEach, expect, test, vi,
} from 'vitest';
import { parseStudyConfig } from '../../../../../parser/parser';
import libraryConfig from '../../../../../../public/libraries/drawing/config.json';
import exampleConfig from '../../../../../../public/library-drawing/config.json';

afterEach(() => vi.unstubAllGlobals());

test('the example uses the library canvas directly with unchanged library defaults', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: async () => JSON.stringify(libraryConfig) }));
  const parsed = await parseStudyConfig(JSON.stringify(exampleConfig));
  expect(parsed.errors).toEqual([]);
  expect(parsed.sequence).toMatchObject({ order: 'fixed', components: ['introduction', '$drawing.components.canvas'] });
  expect(Object.keys(exampleConfig.components)).toEqual(['introduction']);
  expect(parsed.components['$drawing.components.canvas']).toMatchObject({
    type: 'react-component',
    path: 'libraries/drawing/assets/Canvas.tsx',
    style: { maxWidth: 'none' },
    parameters: { requireDrawing: false },
  });
});

test('the library drawing sequence expands through the normal imported-library path', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: async () => JSON.stringify(libraryConfig) }));
  const config = { ...exampleConfig, sequence: { order: 'fixed', components: ['$drawing.sequences.drawing'] } };
  const parsed = await parseStudyConfig(JSON.stringify(config));
  expect(parsed.errors).toEqual([]);
});
