import {
  describe, expect, test,
} from 'vitest';
import type {
  ButtonsResponse,
  CheckboxResponse,
  IndividualComponent,
  MatrixCheckboxResponse,
  MatrixRadioResponse,
  RadioResponse,
  Response,
  ShortTextResponse,
} from '../../parser/types';
import {
  randomizeForm,
  randomizeOptions,
  randomizeQuestionOrder,
} from '../handleResponseRandomization';

function makeComp(
  responses: Response[],
  responseOrder?: 'fixed' | 'random',
): IndividualComponent {
  return {
    type: 'markdown',
    path: '/test.md',
    response: responses,
    responseOrder,
  };
}

function radio(overrides: Partial<RadioResponse> & { id: string }): RadioResponse {
  return {
    type: 'radio', prompt: '', options: [], ...overrides,
  };
}

function checkbox(overrides: Partial<CheckboxResponse> & { id: string }): CheckboxResponse {
  return {
    type: 'checkbox', prompt: '', options: [], ...overrides,
  };
}

function buttons(overrides: Partial<ButtonsResponse> & { id: string }): ButtonsResponse {
  return {
    type: 'buttons', prompt: '', options: [], ...overrides,
  };
}

function shortText(overrides: Partial<ShortTextResponse> & { id: string }): ShortTextResponse {
  return { type: 'shortText', prompt: '', ...overrides };
}

function matrixRadio(overrides: Partial<MatrixRadioResponse> & { id: string; questionOptions: MatrixRadioResponse['questionOptions']; answerOptions: MatrixRadioResponse['answerOptions'] }): MatrixRadioResponse {
  return { type: 'matrix-radio', prompt: '', ...overrides };
}

function matrixCheckbox(overrides: Partial<MatrixCheckboxResponse> & { id: string; questionOptions: MatrixCheckboxResponse['questionOptions']; answerOptions: MatrixCheckboxResponse['answerOptions'] }): MatrixCheckboxResponse {
  return { type: 'matrix-checkbox', prompt: '', ...overrides };
}

describe('randomizeForm', () => {
  test('returns response IDs in original order when responseOrder is fixed', () => {
    const comp = makeComp([radio({ id: 'q1' }), radio({ id: 'q2' }), radio({ id: 'q3' })], 'fixed');
    expect(randomizeForm(comp)).toEqual({ response: ['q1', 'q2', 'q3'] });
  });

  test('returns response IDs in original order when responseOrder is undefined', () => {
    const comp = makeComp([radio({ id: 'a' }), radio({ id: 'b' })]);
    expect(randomizeForm(comp)).toEqual({ response: ['a', 'b'] });
  });

  test('returns all IDs when responseOrder is random (same set, any order)', () => {
    const comp = makeComp([radio({ id: 'q1' }), radio({ id: 'q2' }), radio({ id: 'q3' })], 'random');
    const { response } = randomizeForm(comp);
    expect(response).toHaveLength(3);
    expect(response).toContain('q1');
    expect(response).toContain('q2');
    expect(response).toContain('q3');
  });

  test('excluded responses stay at their original index when randomized', () => {
    // q2 is excluded → stays at index 1; q1 and q3 are shuffled into the other slots
    const comp = makeComp(
      [
        radio({ id: 'q1' }),
        radio({ id: 'q2', excludeFromRandomization: true }),
        radio({ id: 'q3' }),
      ],
      'random',
    );
    const { response } = randomizeForm(comp);
    expect(response[1]).toBe('q2');
    expect(response).toContain('q1');
    expect(response).toContain('q3');
  });

  test('all-excluded responses preserve exact order', () => {
    const comp = makeComp(
      [
        radio({ id: 'a', excludeFromRandomization: true }),
        radio({ id: 'b', excludeFromRandomization: true }),
      ],
      'random',
    );
    expect(randomizeForm(comp)).toEqual({ response: ['a', 'b'] });
  });
});

describe('randomizeOptions', () => {
  test('skips non-radio/checkbox/buttons responses', () => {
    const comp = makeComp([shortText({ id: 'q1' })]);
    expect(randomizeOptions(comp)).toEqual({});
  });

  test('returns parsed options in order for radio with fixed optionOrder', () => {
    const comp = makeComp([radio({ id: 'q1', options: ['A', 'B', 'C'], optionOrder: 'fixed' })]);
    const result = randomizeOptions(comp);
    expect(result.q1.map((o) => o.value)).toEqual(['A', 'B', 'C']);
  });

  test('returns parsed options in order when optionOrder is undefined', () => {
    const comp = makeComp([radio({ id: 'q1', options: ['X', 'Y'] })]);
    const result = randomizeOptions(comp);
    expect(result.q1.map((o) => o.value)).toEqual(['X', 'Y']);
  });

  test('random optionOrder returns same options in any order for radio', () => {
    const comp = makeComp([radio({ id: 'q1', options: ['A', 'B', 'C'], optionOrder: 'random' })]);
    const result = randomizeOptions(comp);
    expect(result.q1).toHaveLength(3);
    expect(result.q1.map((o) => o.value)).toContain('A');
    expect(result.q1.map((o) => o.value)).toContain('B');
    expect(result.q1.map((o) => o.value)).toContain('C');
  });

  test('processes checkbox responses', () => {
    const comp = makeComp([checkbox({ id: 'c1', options: ['P', 'Q'], optionOrder: 'fixed' })]);
    const result = randomizeOptions(comp);
    expect(result.c1.map((o) => o.value)).toEqual(['P', 'Q']);
  });

  test('processes buttons responses', () => {
    const comp = makeComp([buttons({ id: 'b1', options: ['Yes', 'No'], optionOrder: 'fixed' })]);
    const result = randomizeOptions(comp);
    expect(result.b1.map((o) => o.value)).toEqual(['Yes', 'No']);
  });

  test('processes multiple responses and skips non-option types', () => {
    const comp = makeComp([
      shortText({ id: 'text1' }),
      radio({ id: 'r1', options: ['A', 'B'], optionOrder: 'fixed' }),
      checkbox({ id: 'c1', options: ['X', 'Y'], optionOrder: 'fixed' }),
    ]);
    const result = randomizeOptions(comp);
    expect(Object.keys(result)).toEqual(['r1', 'c1']);
  });
});

describe('randomizeQuestionOrder', () => {
  test('skips non-matrix responses', () => {
    const comp = makeComp([radio({ id: 'q1', options: ['A'] })]);
    expect(randomizeQuestionOrder(comp)).toEqual({});
  });

  test('returns questions in order for matrix-radio with fixed questionOrder', () => {
    const comp = makeComp([matrixRadio({
      id: 'm1',
      questionOptions: ['Row A', 'Row B', 'Row C'],
      answerOptions: ['Yes', 'No'],
      questionOrder: 'fixed',
    })]);
    const result = randomizeQuestionOrder(comp);
    expect(result.m1).toEqual(['Row A', 'Row B', 'Row C']);
  });

  test('returns questions in order when questionOrder is undefined', () => {
    const comp = makeComp([matrixRadio({
      id: 'm1',
      questionOptions: ['Q1', 'Q2'],
      answerOptions: ['Yes', 'No'],
    })]);
    const result = randomizeQuestionOrder(comp);
    expect(result.m1).toEqual(['Q1', 'Q2']);
  });

  test('random questionOrder returns same questions in any order for matrix-radio', () => {
    const comp = makeComp([matrixRadio({
      id: 'm1',
      questionOptions: ['Q1', 'Q2', 'Q3'],
      answerOptions: ['A', 'B'],
      questionOrder: 'random',
    })]);
    const result = randomizeQuestionOrder(comp);
    expect(result.m1).toHaveLength(3);
    expect(result.m1).toContain('Q1');
    expect(result.m1).toContain('Q2');
    expect(result.m1).toContain('Q3');
  });

  test('processes matrix-checkbox responses', () => {
    const comp = makeComp([matrixCheckbox({
      id: 'mc1',
      questionOptions: ['Item 1', 'Item 2'],
      answerOptions: ['Yes', 'No'],
      questionOrder: 'fixed',
    })]);
    const result = randomizeQuestionOrder(comp);
    expect(result.mc1).toEqual(['Item 1', 'Item 2']);
  });

  test('processes StringOption objects in questionOptions', () => {
    const comp = makeComp([matrixRadio({
      id: 'm1',
      questionOptions: [{ label: 'Label A', value: 'val-a' }, { label: 'Label B', value: 'val-b' }],
      answerOptions: ['X'],
      questionOrder: 'fixed',
    })]);
    const result = randomizeQuestionOrder(comp);
    expect(result.m1).toEqual(['val-a', 'val-b']);
  });
});
