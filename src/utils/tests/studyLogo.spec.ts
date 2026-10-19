import {
  describe, expect, test, vi,
} from 'vitest';
import { getStudyLogoUrl } from '../studyLogo';

vi.mock('../Prefix', () => ({ PREFIX: '/study/preview/' }));

describe('getStudyLogoUrl', () => {
  test.each(['light', 'dark'] as const)('pins the bundled SVG to %s under the deployment prefix', (mode) => {
    expect(getStudyLogoUrl('revisitAssets/revisitLogoSquare.svg', mode)).toBe(`/study/preview/revisitAssets/revisitLogoSquare.svg#${mode}`);
  });

  test('preserves custom study logos and their fragments', () => {
    expect(getStudyLogoUrl('my-study/logo.svg#symbol', 'dark')).toBe('/study/preview/my-study/logo.svg#symbol');
  });
});
