import { describe, expect, test } from 'vitest';
import {
  evaluateGlobalStoreUpdates, getInitialGlobalVariables, resolveGlobalStoreNumber, validateGlobalStoreDefinitions,
} from '../globalStore';
import type { GlobalVariableDeclarations, NumericalResponse, Response } from '../../parser/types';
import type { StoredAnswer } from '../../store/types';

describe('global store updates', () => {
  const definitions: GlobalVariableDeclarations = { budget: { initialValue: 100, min: 0 } };
  const response = (id: string): NumericalResponse => ({
    id, type: 'numerical', prompt: id, onSubmit: [{ variable: 'budget', operation: 'subtract' }],
  });

  test('initial values are copied without changing the config', () => {
    const values = getInitialGlobalVariables(definitions);
    values.budget = 0;
    expect(definitions.budget.initialValue).toBe(100);
    expect(getInitialGlobalVariables(definitions)).toEqual({ budget: 100 });
  });

  test('rejects the combined overspend without mutating the entry snapshot', () => {
    const entry = { budget: 100 };
    expect(() => evaluateGlobalStoreUpdates(definitions, entry, [response('a'), response('b')], { a: 60, b: 50 }, {})).toThrow(/budget/i);
    expect(entry).toEqual({ budget: 100 });
    expect(evaluateGlobalStoreUpdates(definitions, entry, [response('a'), response('b')], { a: 60, b: 40 }, {}).values).toEqual({ budget: 0 });
  });

  test('ignores absent and Dont Know operands while preserving zero', () => {
    const result = evaluateGlobalStoreUpdates(definitions, { budget: 100 }, [response('empty'), response('zero'), { ...response('unknown'), withDontKnow: true }], { zero: 0, unknown: 50, 'unknown-dontKnow': true }, {});
    expect(result.values).toEqual({ budget: 100 });
    expect(result.operations).toHaveLength(1);
  });

  test.each([
    ['set', 12, 3, 3], ['add', 12, 3, 15], ['subtract', 12, 3, 9], ['multiply', 12, 3, 36], ['divide', 12, 3, 4],
    ['set', 'mid', 'X', 'X'], ['append', 'mid', 'X', 'midX'], ['prepend', 'mid', 'X', 'Xmid'],
    ['set', true, false, false], ['and', true, false, false], ['or', true, false, true], ['toggle', true, false, false],
  ] as const)('applies %s to %s with %s', (operation, initialValue, operand, expected) => {
    const config = { value: { initialValue } };
    const field = {
      id: 'input', type: 'custom', path: 'custom.tsx', prompt: 'input', onSubmit: [{ variable: 'value', operation }],
    } as Response;
    expect(evaluateGlobalStoreUpdates(config, { value: initialValue }, [field], { input: operand }, {}).values.value).toBe(expected);
  });

  test('applies declared action order and validates bounds after the complete proposal', () => {
    const fields: Response[] = [{
      id: 'first', type: 'numerical', prompt: '', onSubmit: [{ variable: 'budget', operation: 'add' }],
    }, {
      id: 'second', type: 'numerical', prompt: '', onSubmit: [{ variable: 'budget', operation: 'multiply' }],
    }];
    expect(evaluateGlobalStoreUpdates(definitions, { budget: 10 }, fields, { first: 2, second: 3 }, {}).values.budget).toBe(36);
  });

  test('validates partial updater results and rejects overlapping writers', () => {
    expect(evaluateGlobalStoreUpdates(definitions, { budget: 100 }, [], {}, { budget: 70 }).values.budget).toBe(70);
    expect(evaluateGlobalStoreUpdates(definitions, { budget: 100 }, [], {}, {}).values.budget).toBe(100);
    expect(() => evaluateGlobalStoreUpdates(definitions, { budget: 100 }, [response('cost')], { cost: 10 }, { budget: 70 })).toThrow(/both|conflict/i);
    expect(() => evaluateGlobalStoreUpdates(definitions, { budget: 100 }, [], {}, { missing: 3 })).toThrow(/declared|unknown/i);
    expect(() => evaluateGlobalStoreUpdates(definitions, { budget: 100 }, [], {}, { budget: '70' })).toThrow(/type|number/i);
    expect(() => evaluateGlobalStoreUpdates(definitions, { budget: 100 }, [], {}, { budget: Infinity })).toThrow(/finite/i);
  });

  test('an updater that returns undefined must not be accepted as a no-op', () => {
    expect(() => evaluateGlobalStoreUpdates(definitions, { budget: 100 }, [], {}, undefined)).toThrow(/plain object/i);
  });

  test.each([['One'], { selected: 'One' }])('toggle does not require a scalar operand for an answered response: %j', (operand) => {
    const field: Response = {
      id: 'input', type: 'custom', path: 'custom.tsx', prompt: '', onSubmit: [{ variable: 'eligible', operation: 'toggle' }],
    };
    const result = evaluateGlobalStoreUpdates({ eligible: { initialValue: true } }, { eligible: true }, [field], { input: operand }, {});
    expect(result.values.eligible).toBe(false);
    expect(result.operations).toEqual([{ variable: 'eligible', operation: 'toggle', source: 'input' }]);
  });

  test.each([[], {}, undefined, null, ''])('unanswered responses do not toggle the store: %j', (operand) => {
    const field: Response = {
      id: 'input', type: 'custom', path: 'custom.tsx', prompt: '', onSubmit: [{ variable: 'eligible', operation: 'toggle' }],
    };
    const answers: StoredAnswer['answer'] = {};
    if (operand !== undefined) answers.input = operand;
    expect(evaluateGlobalStoreUpdates({ eligible: { initialValue: true } }, { eligible: true }, [field], answers, {}).values.eligible).toBe(true);
  });

  test('division by zero is invalid and numeric strings do not silently become operands', () => {
    const field: Response = {
      id: 'cost', type: 'custom', path: 'custom.tsx', prompt: '', onSubmit: [{ variable: 'budget', operation: 'divide' }],
    };
    expect(() => evaluateGlobalStoreUpdates(definitions, { budget: 100 }, [field], { cost: 0 }, {})).toThrow(/zero/i);
    expect(() => evaluateGlobalStoreUpdates(definitions, { budget: 100 }, [response('cost')], { cost: '10junk' }, {})).toThrow(/number/i);
  });
});

describe('global store declarations and references', () => {
  test('requires supported finite initial values and compatible bounds', () => {
    expect(validateGlobalStoreDefinitions({ budget: { initialValue: 100, min: 0 } })).toEqual([]);
    expect(validateGlobalStoreDefinitions({ budget: { initialValue: -1, min: 0 } })).not.toEqual([]);
    expect(validateGlobalStoreDefinitions({ bad: { initialValue: null } } as unknown as GlobalVariableDeclarations)).not.toEqual([]);
    expect(validateGlobalStoreDefinitions({ bad: { initialValue: true, min: 0 } } as unknown as GlobalVariableDeclarations)).not.toEqual([]);
  });

  test('resolves exact references without coercing their primitive type', () => {
    expect(resolveGlobalStoreNumber('{{store.budget}}', { budget: 70 })).toBe(70);
    expect(resolveGlobalStoreNumber(0, {})).toBe(0);
    expect(() => resolveGlobalStoreNumber('{{store.name}}', { name: '70' })).toThrow(/number/i);
    expect(() => resolveGlobalStoreNumber('Remaining {{store.budget}}', { budget: 70 })).toThrow(/reference/i);
    expect(() => resolveGlobalStoreNumber('{{store.missing}}', {})).toThrow(/declared|unknown/i);
  });
});
