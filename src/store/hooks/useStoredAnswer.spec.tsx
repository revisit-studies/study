import { renderToStaticMarkup } from 'react-dom/server';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { useStoredAnswer } from './useStoredAnswer';

type AnswerState = {
  answers: Record<string, { componentName: string }>;
};

let params: { funcIndex?: string } = {};
let participantSequence = ['component-a', 'component-b'];
let currentStep: number | string = 0;
let currentComponent = 'component-a';
let answerState: AnswerState = {
  answers: {},
};

vi.mock('react-router', () => ({
  useParams: () => params,
}));

vi.mock('../store', () => ({
  useFlatSequence: () => participantSequence,
  useStoreSelector: (selector: (state: AnswerState) => { componentName: string } | undefined) => selector(answerState),
}));

vi.mock('../../routes/utils', () => ({
  useCurrentStep: () => currentStep,
  useCurrentComponent: () => currentComponent,
}));

vi.mock('../../utils/encryptDecryptIndex', () => ({
  decryptIndex: (value: string) => Number(value),
}));

function Probe() {
  const answer = useStoredAnswer();
  return <div>{answer?.componentName || 'missing'}</div>;
}

describe('useStoredAnswer', () => {
  beforeEach(() => {
    params = {};
    participantSequence = ['component-a', 'component-b'];
    currentStep = 0;
    currentComponent = 'component-a';
    answerState = {
      answers: {},
    };
  });

  it('returns answer for non-dynamic components', () => {
    answerState.answers = {
      'component-a_0': {
        componentName: 'component-a',
      },
    };

    const html = renderToStaticMarkup(<Probe />);
    expect(html).toContain('component-a');
  });

  it('returns answer for dynamic func index components', () => {
    params = { funcIndex: '2' };
    currentStep = 1;
    currentComponent = 'generated-component';
    answerState.answers = {
      'component-b_1_generated-component_2': {
        componentName: 'generated-component',
      },
    };

    const html = renderToStaticMarkup(<Probe />);
    expect(html).toContain('generated-component');
  });
});
