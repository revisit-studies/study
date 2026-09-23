import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { StudyRouteGuard } from '../StudyRouteGuard';
import { encryptIndex } from '../../utils/encryptDecryptIndex';
import { makeStoredAnswer, makeStudyConfig } from '../../tests/utils';
import { StoreState } from '../../store/types';

const studyConfig = makeStudyConfig({
  components: { intro: { type: 'markdown', path: 'intro.md', response: [] } },
  sequence: {
    order: 'fixed',
    components: ['intro', { id: 'adaptive', order: 'dynamic', functionPath: 'adaptive.ts' }],
  },
});
const renderStudy = vi.fn(() => <div>Study content</div>);
let answers: StoreState['answers'] = {};

vi.mock('../../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => studyConfig,
}));

vi.mock('../../store/store', () => ({
  useFlatSequence: () => ['intro', 'adaptive', 'end'],
  useStoreSelector: (selector: (state: Pick<StoreState, 'answers'>) => unknown) => selector({ answers }),
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
  beforeEach(() => {
    renderStudy.mockClear();
    answers = {};
  });

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
    `${encryptIndex(1)}/${encryptIndex(1)}`, `${encryptIndex(1)}/${encryptIndex(999)}`,
    `${encryptIndex(0)}/${encryptIndex(0)}`,
    'reviewer-missing', '__missing',
  ])('shows 404 without mounting study content for %s', (path) => {
    const html = renderPath(path);
    expect(html).toContain('404');
    expect(html).toContain('href="mailto:test@test.com"');
    expect(renderStudy).not.toHaveBeenCalled();
  });

  test.each([0, 1, 2])('allows saved iterations and the next iteration %i after restoring answers', (iteration) => {
    [0, 1].forEach((ordinal) => {
      const identifier = `adaptive_1_intro_${ordinal}`;
      answers[identifier] = makeStoredAnswer({ identifier, componentName: 'intro', trialOrder: `1_${ordinal}` });
    });

    expect(renderPath(`${encryptIndex(1)}/${encryptIndex(iteration)}`)).toContain('Study content');
  });

  test('does not allow jumping past a gap in saved iterations', () => {
    [0, 2].forEach((ordinal) => {
      const identifier = `adaptive_1_intro_${ordinal}`;
      answers[identifier] = makeStoredAnswer({ identifier, componentName: 'intro', trialOrder: `1_${ordinal}` });
    });

    expect(renderPath(`${encryptIndex(1)}/${encryptIndex(3)}`)).toContain('404');
    expect(renderStudy).not.toHaveBeenCalled();
    expect(renderPath(`${encryptIndex(1)}/${encryptIndex(1)}`)).toContain('Study content');
  });

  test.each(['other_1_intro_0', 'adaptive_2_intro_0', 'adaptive_1___dynamicLoading_0'])('does not count unrelated or unresolved answer %s as a valid iteration', (identifier) => {
    answers[identifier] = makeStoredAnswer({
      identifier,
      componentName: identifier.includes('__dynamicLoading') ? '__dynamicLoading' : 'intro',
      trialOrder: '1_0',
    });

    expect(renderPath(`${encryptIndex(1)}/${encryptIndex(1)}`)).toContain('404');
    expect(renderStudy).not.toHaveBeenCalled();
    expect(renderPath(`${encryptIndex(1)}/${encryptIndex(0)}`)).toContain('Study content');
  });
});
