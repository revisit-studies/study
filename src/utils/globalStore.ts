import type {
  GlobalStoreAction, GlobalStoreOperand, GlobalStoreOperation, GlobalStoreValue, GlobalStoreValues, GlobalVariableDeclaration, GlobalVariableDeclarations, Response, ParserErrorWarning,
} from '../parser/types';
import type { StoredAnswer } from '../store/types';
import { isResponseAnswered, isResponseDontKnowSelected } from './responseValue';
import { checkNumericalResponse, checkTextResponse } from './primitiveValidation';
import { verifyTextResponseConstraints } from './textResponseConstraints';

export const GLOBAL_STORE_REFERENCE = /^\{\{\s*globalVariables\.([A-Za-z_][\w-]*)\s*\}\}$/;
const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype']);
const operationsByType: Record<string, GlobalStoreOperation[]> = {
  number: ['set', 'add', 'subtract', 'multiply', 'divide'],
  string: ['set', 'append', 'prepend'],
  boolean: ['set', 'and', 'or', 'toggle'],
};

export type AppliedGlobalStoreAction = Omit<GlobalStoreAction, 'operand'> & {
  source: string;
  operand?: GlobalStoreValue;
  operandDefinition?: GlobalStoreOperand;
};

function isPrimitive(value: unknown): value is GlobalStoreValue {
  return typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
}

export function normalizeGlobalVariableDeclaration(value: GlobalVariableDeclaration | GlobalStoreValue): GlobalVariableDeclaration {
  return isPrimitive(value) ? { initialValue: value } : value;
}

function validateValue(key: string, value: unknown, definitions: GlobalVariableDeclarations): asserts value is GlobalStoreValue {
  if (!Object.hasOwn(definitions, key) || forbiddenKeys.has(key)) throw new Error(`Unknown global store variable "${key}"; declare it first.`);
  const definition = normalizeGlobalVariableDeclaration(definitions[key]);
  if (!isPrimitive(value)) throw new Error(`Global store variable "${key}" must be a finite number, string, or boolean.`);
  if (typeof value !== typeof definition.initialValue) throw new Error(`Global store variable "${key}" must retain its ${typeof definition.initialValue} type.`);
  const response = { ...definition, id: key, prompt: key };
  const error = typeof value === 'number'
    ? checkNumericalResponse({ ...response, type: 'numerical' }, value)
    : typeof value === 'string' ? checkTextResponse({ ...response, type: 'shortText' }, value) : null;
  if (error) throw new Error(`Global store variable "${key}": ${error}`);
}

export function validateGlobalStoreDefinitions(definitions: GlobalVariableDeclarations) {
  const errors: { instancePath: string; message: string }[] = [];
  Object.entries(definitions).forEach(([key, declaration]) => {
    const definition = normalizeGlobalVariableDeclaration(declaration);
    const path = `/globalVariables/${key}`;
    if (!/^[A-Za-z_][\w-]*$/.test(key) || forbiddenKeys.has(key)) {
      errors.push({ instancePath: path, message: 'Use a non-reserved identifier for a global variable' });
      return;
    }
    if (!definition || !Object.hasOwn(definition, 'initialValue') || !isPrimitive(definition.initialValue)) {
      errors.push({ instancePath: `${path}/initialValue`, message: 'Provide a finite number, string, or boolean initialValue' });
      return;
    }
    const {
      initialValue, min, max, strictMin, strictMax,
    } = definition;
    const bounds = [min, max, strictMin, strictMax];
    if (bounds.some((bound) => bound !== undefined) && typeof initialValue !== 'number') {
      errors.push({ instancePath: path, message: 'Only number variables may define min or max' });
      return;
    }
    if (bounds.some((bound) => bound !== undefined && !Number.isFinite(bound)) || (min !== undefined && max !== undefined && min > max)) {
      errors.push({ instancePath: path, message: 'Provide finite, ordered min/max bounds' });
      return;
    }
    const textKeys = ['minCharLength', 'maxCharLength', 'minWordLength', 'maxWordLength', 'textValidation', 'builtInValidation'] as const;
    if (typeof initialValue !== 'string' && textKeys.some((field) => definition[field] !== undefined)) {
      errors.push({ instancePath: path, message: 'Only string variables may define text validation rules' });
      return;
    }
    if (typeof initialValue === 'string') {
      const textErrors: ParserErrorWarning[] = [];
      verifyTextResponseConstraints(path, {
        response: [{
          ...definition, id: key, prompt: key, type: 'shortText', required: false,
        }],
      }, textErrors, []);
      textErrors.forEach((error) => errors.push({ instancePath: error.instancePath.replace('/response/0', ''), message: error.message }));
      if (textErrors.length) return;
    }
    try { validateValue(key, initialValue, definitions); } catch (error) {
      errors.push({ instancePath: `${path}/initialValue`, message: (error as Error).message });
    }
  });
  return errors;
}

export function getInitialGlobalVariables(definitions: GlobalVariableDeclarations = {}): GlobalStoreValues {
  return Object.fromEntries(Object.entries(definitions).map(([key, definition]) => [key, normalizeGlobalVariableDeclaration(definition).initialValue]));
}

export function globalStoreOperationIsCompatible(operation: GlobalStoreOperation, value: GlobalStoreValue) {
  return operationsByType[typeof value]?.includes(operation) ?? false;
}

export function resolveGlobalStoreNumber(value: number | string | undefined, store: GlobalStoreValues): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = typeof value === 'string' ? value.match(GLOBAL_STORE_REFERENCE) : null;
  if (!match) throw new Error('A numeric constraint must be a finite number or an exact {{globalVariables.key}} reference.');
  if (!Object.hasOwn(store, match[1])) throw new Error(`Unknown global store variable "${match[1]}"; declare it first.`);
  const resolved = store[match[1]];
  if (typeof resolved !== 'number' || !Number.isFinite(resolved)) throw new Error(`Global store reference "${match[1]}" must resolve to a finite number.`);
  return resolved;
}

export function resolveGlobalStoreResponses(responses: Response[], store: GlobalStoreValues): Response[] {
  return responses.map((response) => (response.type === 'numerical' ? {
    ...response,
    min: resolveGlobalStoreNumber(response.min, store),
    max: resolveGlobalStoreNumber(response.max, store),
    strictMin: resolveGlobalStoreNumber(response.strictMin, store),
    strictMax: resolveGlobalStoreNumber(response.strictMax, store),
  } : response));
}

function applyOperation(current: GlobalStoreValue, operation: GlobalStoreOperation, operand?: GlobalStoreValue): GlobalStoreValue {
  if (!globalStoreOperationIsCompatible(operation, current)) throw new Error(`Operation "${operation}" is incompatible with ${typeof current} store values.`);
  if (operation === 'toggle') return !current;
  if (operand === undefined || typeof operand !== typeof current) throw new Error(`Operation "${operation}" requires a ${typeof current} answer.`);
  switch (operation) {
    case 'set': return operand;
    case 'add': return (current as number) + (operand as number);
    case 'subtract': return (current as number) - (operand as number);
    case 'multiply': return (current as number) * (operand as number);
    case 'divide':
      if (operand === 0) throw new Error('Cannot divide a global store value by zero.');
      return (current as number) / (operand as number);
    case 'append': return `${current}${operand}`;
    case 'prepend': return `${operand}${current}`;
    case 'and': return (current as boolean) && (operand as boolean);
    case 'or': return (current as boolean) || (operand as boolean);
    default: throw new Error(`Unknown global store operation "${operation}".`);
  }
}

/** Shared config/runtime type checks, without evaluating answer-dependent arithmetic. */
export function getGlobalStoreOperandType(operand?: GlobalStoreOperand, answerType?: string): string | undefined {
  let type = answerType;
  if (operand?.source === 'literal') {
    if (!isPrimitive(operand.value)) throw new Error('A literal operand must be a finite number, string, or boolean.');
    type = typeof operand.value;
  } else if (operand?.source !== undefined && operand.source !== 'answer') {
    throw new Error('An operand source must be answer or literal.');
  }
  (operand?.transforms ?? []).forEach((transform) => {
    const required = transform.operation === 'not' ? 'boolean' : 'number';
    if (type !== undefined && type !== required) throw new Error(`Operand transform "${transform.operation}" requires a ${required} value.`);
    if (transform.operation !== 'not') {
      if (!['add', 'subtract', 'multiply', 'divide', 'subtractFrom', 'divideInto'].includes(transform.operation)
        || !Number.isFinite(transform.value)) throw new Error('Numeric operand transforms require a supported operation and finite value.');
      if (transform.operation === 'divide' && transform.value === 0) throw new Error('Cannot divide an operand by zero.');
    }
    type = required;
  });
  return type;
}

function resolveGlobalStoreOperand(definition: GlobalStoreOperand | undefined, answer: unknown): GlobalStoreValue {
  const initial = definition?.source === 'literal' ? definition.value : answer;
  if (!isPrimitive(initial)) throw new Error('A global store operand must be a finite number, string, or boolean.');
  let value = initial;
  getGlobalStoreOperandType(definition, typeof answer);
  (definition?.transforms ?? []).forEach((transform) => {
    if (transform.operation === 'not') value = !value;
    else if (transform.operation === 'subtractFrom') value = applyOperation(transform.value, 'subtract', value);
    else if (transform.operation === 'divideInto') value = applyOperation(transform.value, 'divide', value);
    else value = applyOperation(value, transform.operation, transform.value);
    if (!isPrimitive(value)) throw new Error('An operand transform produced a non-finite value.');
  });
  return value;
}

export function evaluateGlobalStoreUpdates(
  definitions: GlobalVariableDeclarations,
  entry: GlobalStoreValues,
  responses: Response[],
  answers: StoredAnswer['answer'],
  patch: unknown,
) {
  const values = { ...entry };
  const operations: AppliedGlobalStoreAction[] = [];
  responses.forEach((response) => {
    const answer = answers[response.id];
    if (!isResponseAnswered(answer) || isResponseDontKnowSelected(response, answers)) return;
    const normalizedAnswer = (response.type === 'numerical' || response.type === 'slider') && typeof answer === 'string' && answer.trim() !== ''
      ? Number(answer) : answer;
    (response.onSubmit ?? []).forEach((action) => {
      if (!Object.hasOwn(definitions, action.variable)) throw new Error(`Unknown global store variable "${action.variable}"; declare it first.`);
      if (action.operation === 'toggle' && action.operand !== undefined) throw new Error('Toggle does not accept an operand.');
      const operand = action.operation === 'toggle' ? undefined : resolveGlobalStoreOperand(action.operand, normalizedAnswer);
      const result = applyOperation(values[action.variable], action.operation, operand);
      if (!isPrimitive(result)) throw new Error(`Global store action for "${response.id}" produced a non-finite value.`);
      values[action.variable] = result;
      operations.push({
        variable: action.variable,
        operation: action.operation,
        source: response.id,
        ...(action.operation === 'toggle' ? {} : { operand }),
        ...(action.operand ? { operandDefinition: structuredClone(action.operand) } : {}),
      });
    });
  });
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.getPrototypeOf(patch) !== Object.prototype) throw new Error('A global store updater must return a plain object of declared key/value updates.');
  Object.entries(patch).forEach(([key, value]) => {
    if (operations.some((operation) => operation.variable === key)) throw new Error(`Global store conflict: both a form action and the stimulus updater write "${key}".`);
    validateValue(key, value, definitions);
    values[key] = value;
    operations.push({
      variable: key, operation: 'set', operand: value, source: 'stimulus',
    });
  });
  Object.entries(values).forEach(([key, value]) => validateValue(key, value, definitions));
  return { values, operations };
}
