import { MantineProvider } from '@mantine/core';
import { cleanup, render, screen } from '@testing-library/react';
import {
  afterEach, beforeEach, expect, test, vi,
} from 'vitest';
import { ReactComponentController } from '../ReactComponentController';
import { makeStoredAnswer } from '../../tests/utils';
import type { ReactComponent } from '../../parser/types';

vi.mock('../../public/demo-react-trrack/assets/DemoReactTrrack', () => ({ default: () => null }));
vi.mock('../../store/hooks/useTrialProvenance', () => ({ useTrialProvenance: () => undefined }));
vi.mock('../../store/hooks/useDesignerPreview', () => ({ useDesignerPreview: () => true }));
vi.mock('../../store/hooks/useIsAnalysis', () => ({ useIsAnalysis: () => false }));
vi.mock('../../store/hooks/useStudyConfig', () => ({ useStudyConfig: () => ({ uiConfig: {} }) }));
vi.mock('../../store/hooks/useTemplateAnswerContext', () => ({ useTemplateAnswerContext: () => ({}) }));
vi.mock('../../routes/utils', () => ({ useCurrentIdentifier: () => 'trial_0', useStudyId: () => 'study' }));
vi.mock('../../store/hooks/useAssetStatus', () => ({
  useAssetStatus: () => {},
  useAssetLoadStatus: () => ({ status: 'ready' }),
}));
vi.mock('../../store/store', () => ({
  useStoreSelector: () => ({}),
  useStoreDispatch: () => vi.fn(),
  useStoreActions: () => ({ updateProvenance: vi.fn(), updateResponseBlockValidation: vi.fn(), setReactiveAnswers: vi.fn() }),
}));

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test.each(['reactive', 'shortText'] as const)('Preview distinguishes saved %s answers from host inputs', (type) => {
  const config: ReactComponent = {
    type: 'react-component',
    path: 'demo-react-trrack/assets/DemoReactTrrack.tsx',
    response: [{ id: 'answer', type, prompt: 'Answer' }],
  };
  render(
    <MantineProvider>
      <ReactComponentController
        currentConfig={config}
        answers={{ trial_0: makeStoredAnswer({ identifier: 'trial_0', answer: { answer: 'saved' } }) }}
      />
    </MantineProvider>,
  );
  if (type === 'reactive') {
    expect(screen.getByRole('alert').textContent).toContain('has not registered state restoration');
  } else {
    expect(screen.queryByRole('alert')).toBeNull();
  }
});
