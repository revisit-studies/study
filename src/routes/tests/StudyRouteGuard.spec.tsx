import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { StudyRouteGuard } from '../StudyRouteGuard';
import { encryptIndex } from '../../utils/encryptDecryptIndex';
import { makeStudyConfig } from '../../tests/utils';

const studyConfig = makeStudyConfig({
  components: { intro: { type: 'markdown', path: 'intro.md', response: [] } },
  sequence: {
    order: 'fixed',
    components: ['intro', { id: 'adaptive', order: 'dynamic', functionPath: 'adaptive.ts' }],
  },
});
const renderStudy = vi.fn(() => <div>Study content</div>);

vi.mock('../../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => studyConfig,
}));

vi.mock('../../store/store', () => ({
  useFlatSequence: () => ['intro', 'adaptive', 'end'],
}));

function StudyContent() {
  return renderStudy();
}

function renderPath(path: string) {
  return renderToStaticMarkup(
    <MantineProvider>
      <MemoryRouter initialEntries={[`/study/${path}`]}>
        <Routes>
          <Route
            path="/study/:index?/:funcIndex?"
            element={<StudyRouteGuard><StudyContent /></StudyRouteGuard>}
          />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('StudyRouteGuard', () => {
  beforeEach(() => renderStudy.mockClear());

  test.each([
    '', encryptIndex(0), encryptIndex(2),
    `${encryptIndex(1)}/${encryptIndex(0)}`,
    'reviewer-intro', '__trainingFailed', '__timedOut',
  ])('preserves valid navigation to %s', (path) => {
    expect(renderPath(path)).toContain('Study content');
    expect(renderStudy).toHaveBeenCalledOnce();
  });

  test.each([
    `${encryptIndex(0)}\u0100`, 'invalid-base64', btoa('not ciphertext'),
    encryptIndex(-1), encryptIndex(1.5), encryptIndex(3),
    encryptIndex(Number.MAX_SAFE_INTEGER + 1),
    `${encryptIndex(1)}/\u0100`, `${encryptIndex(1)}/${encryptIndex(-1)}`,
    `${encryptIndex(0)}/${encryptIndex(0)}`,
    'reviewer-missing', '__missing',
  ])('shows 404 without mounting study content for %s', (path) => {
    const html = renderPath(path);
    expect(html).toContain('404');
    expect(html).toContain('href="mailto:test@test.com"');
    expect(renderStudy).not.toHaveBeenCalled();
  });
});
