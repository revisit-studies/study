import {
  afterEach, expect, test, vi,
} from 'vitest';
import { parseStudyConfig } from '../../../../../parser/parser';
import libraryConfig from '../../../../../../public/libraries/drawing/config.json';
import exampleConfig from '../../../../../../public/library-drawing/config.json';

afterEach(() => vi.unstubAllGlobals());

test('the example resolves the imported library canvas without parser changes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: async () => JSON.stringify(libraryConfig) }));
  const parsed = await parseStudyConfig(JSON.stringify(exampleConfig));
  expect(parsed.errors).toEqual([]);
  expect(parsed.components.sketch).toMatchObject({
    baseComponent: '$drawing.components.canvas', parameters: { requireDrawing: true },
  });
});

test('the library drawing sequence expands through the normal imported-library path', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: async () => JSON.stringify(libraryConfig) }));
  const config = { ...exampleConfig, sequence: { order: 'fixed', components: ['$drawing.sequences.drawing'] } };
  const parsed = await parseStudyConfig(JSON.stringify(config));
  expect(parsed.errors).toEqual([]);
});
