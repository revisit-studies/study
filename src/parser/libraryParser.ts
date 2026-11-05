import Ajv from 'ajv';
import isEqual from 'lodash.isequal';
import merge from 'lodash.merge';
import librarySchema from './LibraryConfigSchema.json';
import studySchema from './StudyConfigSchema.json';
import {
  ComponentBlock, ComponentOrder, Factor, FactorAction, FactorBlock, FactorExpression, FactorObject, FactorObjectValue, FactorOption, FactorValue, IndividualComponent, LibraryConfig, OrderedFactorValues, ParsedConfig, ParserErrorWarning, StudyConfig,
} from './types';
import {
  FactorPlanBlock, isDynamicBlock, isFactorBlock, isInheritedComponent,
} from './utils';
import { mergeComponentConfigs, studyComponentToIndividualComponent } from '../utils/handleComponentInheritance';
import { PREFIX } from '../utils/Prefix';
import { getSequenceFlatMapWithInterruptions } from '../utils/getSequenceFlatMap';

const ajv = new Ajv({ allowUnionTypes: true });
ajv.addSchema(librarySchema);
const libraryValidate = ajv.getSchema<LibraryConfig>('#/definitions/LibraryConfig')!;
const studyAjv = new Ajv({ allowUnionTypes: true });
studyAjv.addSchema(studySchema);
const individualComponentValidate = studyAjv.getSchema<IndividualComponent>('#/definitions/IndividualComponent')!;

type SequenceWithImportReference = StudyConfig['sequence'] & {
  __revisitImportedSequenceRef?: string;
};

type LibraryConfigWithInheritanceMetadata = LibraryConfig & {
  __revisitInheritedComponentMetadata?: Record<string, { baseComponent: string; withSidebar?: boolean }>;
};

function normalizeLibraryMacroReference(reference: string): string {
  let normalizedReference = reference;
  if (normalizedReference.includes('.co.')) {
    normalizedReference = normalizedReference.replace('.co.', '.components.');
  }
  if (normalizedReference.includes('.se.')) {
    normalizedReference = normalizedReference.replace('.se.', '.sequences.');
  }
  return normalizedReference;
}

function normalizeInterruptionComponents(interruptions?: ComponentBlock['interruptions']): ComponentBlock['interruptions'] {
  if (!interruptions) {
    return interruptions;
  }
  return interruptions.map((interruption) => ({
    ...interruption,
    components: interruption.components.map((componentName) => normalizeLibraryMacroReference(componentName)),
  }));
}

function normalizeSkipTargets(skipConditions?: ComponentBlock['skip']): ComponentBlock['skip'] {
  if (!skipConditions) {
    return skipConditions;
  }
  return skipConditions.map((condition) => ({
    ...condition,
    to: normalizeLibraryMacroReference(condition.to),
  }));
}

function namespaceLibraryComponentReference(reference: string, libraryName: string): string {
  const normalizedReference = normalizeLibraryMacroReference(reference);
  return normalizedReference.startsWith('$')
    ? normalizedReference
    : `$${libraryName}.components.${normalizedReference}`;
}

function namespaceLibraryInterruptions(
  interruptions: ComponentBlock['interruptions'],
  libraryName: string,
): ComponentBlock['interruptions'] {
  return interruptions?.map((interruption) => ({
    ...interruption,
    components: interruption.components.map((component) => (
      namespaceLibraryComponentReference(component, libraryName)
    )),
  }));
}

function namespaceLibrarySequenceComponents(sequence: StudyConfig['sequence'], libraryName: string): StudyConfig['sequence'] {
  if (isDynamicBlock(sequence)) {
    return sequence;
  }
  if (isFactorBlock(sequence)) {
    return {
      ...sequence,
      components: typeof sequence.components === 'string'
        ? namespaceLibraryComponentReference(sequence.components, libraryName)
        : sequence.components.map((component) => (
          namespaceLibraryComponentReference(component, libraryName)
        )),
      interruptions: namespaceLibraryInterruptions(sequence.interruptions, libraryName),
      skip: normalizeSkipTargets(sequence.skip),
    };
  }
  return {
    ...sequence,
    interruptions: namespaceLibraryInterruptions(sequence.interruptions, libraryName),
    skip: normalizeSkipTargets(sequence.skip),
    components: sequence.components.map((component) => {
      if (typeof component === 'object') {
        return namespaceLibrarySequenceComponents(component, libraryName);
      }
      return namespaceLibraryComponentReference(component, libraryName);
    }),
  };
}

// Replace {{parameter}} tokens in a single string.
export function fillTemplate(str: string, vars: Record<string, unknown>): string {
  const fillToken = (match: string, key: string) => (vars[key] !== undefined && vars[key] !== null
    ? String(vars[key])
    : match);

  return str.replace(/\{\{\s*([A-Za-z_][\w-]*)\s*\}\}/g, fillToken);
}

// Recursively replace templates in any TS value.
export function deepFillTemplate<T>(value: T, vars: Record<string, unknown>): T {
  // Strings: apply template replacement
  if (typeof value === 'string') {
    const exactToken = value.match(/^\{\{\s*([A-Za-z_][\w-]*)\s*\}\}$/);
    if (exactToken && vars[exactToken[1]] !== undefined && vars[exactToken[1]] !== null) {
      return vars[exactToken[1]] as T;
    }
    return fillTemplate(value, vars) as unknown as T;
  }

  // Arrays: map over items
  if (Array.isArray(value)) {
    return value.map((item) => deepFillTemplate(item, vars)) as unknown as T;
  }

  // Objects: recurse over properties
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value)) {
      result[key] = deepFillTemplate(val as unknown, vars);
    }

    return result as T;
  }

  // Anything else (number, boolean, null, undefined, etc) → return as-is
  return value;
}

type RepeatedFactorValues = {
  type: 'repeated-factor-values';
  values: FactorObjectValue[];
};
type FactorConditionValue = FactorObjectValue | RepeatedFactorValues;
type FactorCondition = Record<string, FactorConditionValue>;
type MaterializedFactorCondition = Record<string, FactorObjectValue>;
type ResolvedFactorCondition = {
  values: FactorCondition;
  // Keep original values per condition for source-name keep/remove selectors.
  sourceValues?: FactorCondition;
};
type FactorResolution = {
  conditions: ResolvedFactorCondition[];
  // Materialization retains all possible values. Track the selected count for
  // diagnostics; null means runtime filtering makes that count unpredictable.
  runtimeCount?: number | null;
  numSamples?: number;
  samplingStrategy?: 'withoutReplacement' | 'withReplacement';
  hasRuntimeOrder?: boolean;
  hasRuntimeSample?: boolean;
  // Runtime execution can change order without changing the selected values.
  hasVariableMembership?: boolean;
};
type FactorResolutionMode = 'standard' | 'materialize' | 'runtime';
type FactorDefinition = {
  resolution: FactorResolution;
  errors: ParserErrorWarning[];
  warnings: ParserErrorWarning[];
};

export type FactorOrderContext = {
  sequenceIndex: number;
  sampledConditions: Map<string, ResolvedFactorCondition[]>;
  orderedValues: Map<string, FactorValue[]>;
  definitions: WeakMap<Record<string, Factor>, Map<string, FactorDefinition>>;
};

export function createFactorOrderContext(
  sequenceIndex: number,
  definitions: FactorOrderContext['definitions'] = new WeakMap(),
): FactorOrderContext {
  return {
    sequenceIndex, sampledConditions: new Map(), orderedValues: new Map(), definitions,
  };
}

function isOrderedFactorValues(factor: Factor): factor is OrderedFactorValues {
  return !Array.isArray(factor) && 'values' in factor;
}

function shuffleValues<T>(values: T[]): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function sampleFactorConditions(
  factorName: string,
  conditions: ResolvedFactorCondition[],
  numSamples: number,
  samplingStrategy: 'withoutReplacement' | 'withReplacement',
  context?: FactorOrderContext,
): ResolvedFactorCondition[] {
  const cacheKey = JSON.stringify([factorName, conditions, numSamples, samplingStrategy]);
  const existing = context?.sampledConditions.get(cacheKey);
  if (existing) {
    return existing;
  }

  const selected = samplingStrategy === 'withReplacement'
    ? Array.from({ length: numSamples }, () => (
      conditions[Math.floor(Math.random() * conditions.length)]
    ))
    : shuffleValues(conditions).slice(0, numSamples);
  context?.sampledConditions.set(cacheKey, selected);
  return selected;
}

type FactorCompileResult = {
  sequence: StudyConfig['sequence'];
  components: Record<string, IndividualComponent>;
};

function isRepeatedFactorValues(value: FactorConditionValue): value is RepeatedFactorValues {
  return typeof value === 'object'
    && !Array.isArray(value)
    && value.type === 'repeated-factor-values';
}

function addFactorError(
  errors: ParserErrorWarning[],
  message: string,
  instancePath = '/factors/',
) {
  if (!errors.some((error) => error.instancePath === instancePath && error.message === message)) {
    errors.push({
      message,
      instancePath,
      params: { action: 'Check the factor definition and its references' },
      category: 'sequence-validation',
    });
  }
}

function addFactorWarning(
  warnings: ParserErrorWarning[],
  message: string,
  instancePath = '/factors/',
) {
  if (!warnings.some((warning) => warning.instancePath === instancePath && warning.message === message)) {
    warnings.push({
      message,
      instancePath,
      params: { action: 'Check the factor definition and its references' },
      category: 'sequence-validation',
    });
  }
}

function deepFillTemplateStrings<T>(value: T, vars: Record<string, unknown>): T {
  if (typeof value === 'string') {
    return fillTemplate(value, vars) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepFillTemplateStrings(item, vars)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, deepFillTemplateStrings(child, vars)]),
    ) as T;
  }
  return value;
}

function orderFactorValues(
  factorName: string,
  factor: OrderedFactorValues,
  errors: ParserErrorWarning[],
  context?: FactorOrderContext,
  warnings: ParserErrorWarning[] = [],
): FactorValue[] {
  const order: ComponentOrder = factor.order || 'fixed';
  if (factor.numSamples !== undefined && (!Number.isInteger(factor.numSamples) || factor.numSamples < 1)) {
    addFactorError(errors, `Factor \`${factorName}\` numSamples must be a positive integer`);
    return [];
  }
  if (!context || factor.values.length === 0) {
    return [...factor.values];
  }

  const cacheKey = JSON.stringify([factorName, factor]);
  const cached = context.orderedValues.get(cacheKey);
  if (cached) return cached;
  let values = [...factor.values];
  if (order === 'random') {
    values = shuffleValues(values);
  } else if (order === 'latinSquare') {
    const offset = context.sequenceIndex % values.length;
    values = [...values.slice(offset), ...values.slice(0, offset)];
  }
  if (factor.numSamples !== undefined && factor.numSamples > values.length) {
    addFactorWarning(
      warnings,
      `Factor \`${factorName}\` requested ${factor.numSamples} values but only ${values.length} are available; stopping after the list is exhausted`,
    );
  }
  const selectedValues = values.slice(0, factor.numSamples);
  context.orderedValues.set(cacheKey, selectedValues);
  return selectedValues;
}

function materializeConditionForParameterNames(
  condition: FactorCondition,
): MaterializedFactorCondition {
  return Object.entries(condition).reduce<MaterializedFactorCondition>(
    (materialized, [factorName, value]) => {
      const values = isRepeatedFactorValues(value) ? value.values : [value];
      values.forEach((factorValue, index) => {
        const sourceName = values.length === 1 ? factorName : `${factorName}_${index}`;
        materialized[sourceName] = factorValue;
      });
      return materialized;
    },
    {},
  );
}

function validateFactorAliases(
  resolutions: FactorResolution[],
  outputNames: string[],
  factorName: string,
  errors: ParserErrorWarning[],
): boolean {
  if (outputNames.length !== resolutions.length) {
    addFactorError(
      errors,
      `Factor expression \`${factorName}\` requires one as name per factor; received ${outputNames.length} names for ${resolutions.length} factors`,
    );
    return false;
  }
  if (outputNames.some((name) => name.length === 0) || new Set(outputNames).size !== outputNames.length) {
    addFactorError(errors, `Factor expression \`${factorName}\` requires unique, non-empty as names`);
    return false;
  }
  const overlap = outputNames.find((name, index) => resolutions.some((resolution, otherIndex) => (
    otherIndex !== index && resolution.conditions.some((condition) => (
      Object.hasOwn(materializeConditionForParameterNames(condition.values), name)
      || (condition.sourceValues && Object.hasOwn(materializeConditionForParameterNames(condition.sourceValues), name))
    ))
  )));
  if (overlap !== undefined) {
    addFactorError(errors, `Factor expression \`${factorName}\` as name \`${overlap}\` conflicts with another input parameter namespace`);
    return false;
  }
  return resolutions.every((resolution, index) => {
    if (resolution.conditions.length === 0) return false;
    const scalar = resolution.conditions.every(({ values }) => {
      const materialized = materializeConditionForParameterNames(values);
      return Object.keys(materialized).length === 1 && !Array.isArray(Object.values(materialized)[0]);
    });
    if (!scalar) {
      addFactorError(
        errors,
        `Factor expression \`${factorName}\` cannot apply as name \`${outputNames[index]}\` to an input with multiple parameters`,
      );
    }
    return scalar;
  });
}

function mergeFactorConditions(
  left: FactorCondition,
  right: FactorCondition,
): FactorCondition {
  return Object.entries(right).reduce<FactorCondition>((condition, [name, value]) => {
    if (!Object.hasOwn(condition, name)) {
      return { ...condition, [name]: value };
    }

    const leftValue = condition[name];
    const leftValues = isRepeatedFactorValues(leftValue)
      ? leftValue.values
      : [leftValue];
    const rightValues = isRepeatedFactorValues(value)
      ? value.values
      : [value];
    return {
      ...condition,
      [name]: {
        type: 'repeated-factor-values',
        values: [...leftValues, ...rightValues] as FactorObjectValue[],
      },
    };
  }, { ...left });
}

function mergeResolvedFactorConditions(
  left: ResolvedFactorCondition,
  right: ResolvedFactorCondition,
): ResolvedFactorCondition {
  return {
    values: mergeFactorConditions(left.values, right.values),
    ...((left.sourceValues || right.sourceValues) ? {
      sourceValues: mergeFactorConditions(left.sourceValues || left.values, right.sourceValues || right.values),
    } : {}),
  };
}

function crossFactorConditions(
  conditionSets: ResolvedFactorCondition[][],
): ResolvedFactorCondition[] {
  return conditionSets.reduce<ResolvedFactorCondition[]>((conditions, nextConditions) => (
    conditions.flatMap((condition) => nextConditions.map((nextCondition) => (
      mergeResolvedFactorConditions(condition, nextCondition)
    )))
  ), [{ values: {} }]);
}

function warnZipLengths(
  lengths: number[],
  factorName: string,
  warnings: ParserErrorWarning[],
) {
  if (new Set(lengths).size > 1) {
    addFactorWarning(
      warnings,
      `Zip factor \`${factorName}\` received inputs with different lengths (${lengths.join(', ')}); stopping after the shortest input`,
    );
  }
}

function zipFactorConditions(
  conditionSets: ResolvedFactorCondition[][],
  factorName: string,
  errors: ParserErrorWarning[],
  warnings: ParserErrorWarning[],
): ResolvedFactorCondition[] {
  const lengths = conditionSets.map((conditions) => conditions.length);
  warnZipLengths(lengths, factorName, warnings);

  const length = lengths.length > 0 ? Math.min(...lengths) : 0;
  return Array.from({ length }, (_, index) => (
    conditionSets.reduce<ResolvedFactorCondition>((condition, conditions) => (
      mergeResolvedFactorConditions(condition, conditions[index])
    ), { values: {} })
  ));
}

function materializeFactorCondition(
  condition: FactorCondition,
  errors: ParserErrorWarning[],
): MaterializedFactorCondition {
  return Object.entries(condition).reduce<MaterializedFactorCondition>(
    (materialized, [factorName, value]) => {
      const values = isRepeatedFactorValues(value) ? value.values : [value];
      return values.reduce<MaterializedFactorCondition>((result, factorValue, index) => {
        const sourceName = values.length === 1 ? factorName : `${factorName}_${index}`;
        const parameterName = sourceName;
        if (Object.hasOwn(result, parameterName)) {
          addFactorError(
            errors,
            `Repeated factor \`${factorName}\` generates parameter \`${parameterName}\`, which conflicts with another factor`,
          );
          return result;
        }
        return { ...result, [parameterName]: factorValue };
      }, materialized);
    },
    {},
  );
}

function matchesFactorEligibility(
  values: MaterializedFactorCondition,
  assignment?: Record<string, unknown>,
  eligibleConditions?: MaterializedFactorCondition[],
): boolean {
  return Object.entries(assignment || {}).every(([name, value]) => (
    values[name] === undefined || isEqual(values[name], value)
  )) && (eligibleConditions === undefined || eligibleConditions.some((eligible) => isEqual(values, eligible)));
}

function aliasFactorCondition(condition: ResolvedFactorCondition, alias?: string): ResolvedFactorCondition {
  return alias === undefined ? condition : {
    values: { [alias]: Object.values(materializeConditionForParameterNames(condition.values))[0] },
    sourceValues: condition.sourceValues || condition.values,
  };
}

type FactorInputTuple = (ResolvedFactorCondition | undefined)[];

type FactorInputFields = { possible: Set<string>; required: Set<string> };

function canExtendFactorPrefix(
  values: FactorCondition,
  remaining: FactorInputFields[],
  assignment?: Record<string, unknown>,
  eligibleConditions?: MaterializedFactorCondition[],
): boolean {
  const compatible = (parameters: Record<string, unknown>, requireFields: boolean) => (
    Object.entries(values).every(([name, value]) => {
      const entries = isRepeatedFactorValues(value) ? value.values : [value];
      const mayRepeat = remaining.some((input) => input.possible.has(name));
      const mustRepeat = remaining.some((input) => input.required.has(name));
      return entries.every((entry, index) => {
        // Appending values preserves existing repeated-slot indices. A singleton
        // can retain its name or become slot zero when a later branch repeats it.
        const names = entries.length > 1 || mustRepeat ? [`${name}_${index}`]
          : mayRepeat ? [name, `${name}_0`] : [name];
        return names.some((key) => (Object.hasOwn(parameters, key)
          ? isEqual(parameters[key], entry) : !requireFields));
      });
    })
  );
  return (!assignment || compatible(assignment, false))
    && (eligibleConditions === undefined || eligibleConditions.some((eligible) => compatible(eligible, true)));
}

function getEligibleInputTuples(
  resolutions: FactorResolution[],
  action: FactorAction,
  aliasNames: string[] | undefined,
  assignment: Record<string, unknown> | undefined,
  eligibleConditions: MaterializedFactorCondition[] | undefined,
  errors: ParserErrorWarning[],
  pairedGroups?: number[][],
): FactorInputTuple[] {
  let tuples: FactorInputTuple[];
  if (action === 'cross' || (action === 'zip' && resolutions.some((resolution) => (
    resolution.hasRuntimeOrder || resolution.hasRuntimeSample || resolution.numSamples !== undefined
  )))) {
    if (resolutions.some((resolution) => resolution.conditions.length === 0)) return [];
    const projected = resolutions.map((resolution, index) => (
      resolution.conditions.map((condition) => aliasFactorCondition(condition, aliasNames?.[index]).values)
    ));
    const fields = projected.map((conditions): FactorInputFields => ({
      possible: new Set(conditions.flatMap(Object.keys)),
      required: new Set(Object.keys(conditions[0] || {}).filter((name) => conditions.every((values) => Object.hasOwn(values, name)))),
    }));
    const firstByInput = new Map<number, number>();
    pairedGroups?.forEach((indices) => indices.slice(1).forEach((index) => firstByInput.set(index, indices[0])));
    const prefixes = resolutions.reduce<{ tuple: FactorInputTuple; values: FactorCondition; rows: number[] }[]>((current, resolution, index) => (
      current.flatMap((prefix) => {
        const first = firstByInput.get(index);
        // Repeated aligned inputs reuse the first input's row. Enforce this
        // before expansion so a shared group contributes one domain, not 2^N.
        const rows = first === undefined ? resolution.conditions.map((_, row) => row) : [prefix.rows[first]];
        return rows.flatMap((conditionIndex) => {
          const condition = resolution.conditions[conditionIndex];
          if (!condition) return [];
          const values = mergeFactorConditions(prefix.values, projected[index][conditionIndex]);
          return canExtendFactorPrefix(values, fields.slice(index + 1), assignment, eligibleConditions)
            ? [{ tuple: [...prefix.tuple, condition], values, rows: [...prefix.rows, conditionIndex] }] : [];
        });
      })
    ), [{ tuple: [], values: {}, rows: [] }]);
    tuples = prefixes.map((prefix) => prefix.tuple);
  } else if (action === 'zip') {
    tuples = Array.from({ length: Math.min(...resolutions.map((resolution) => resolution.conditions.length)) }, (_, index) => (
      resolutions.map((resolution) => resolution.conditions[index])
    ));
  } else {
    tuples = resolutions.flatMap((resolution, inputIndex) => resolution.conditions.map((condition) => (
      resolutions.map((_, index) => (index === inputIndex ? condition : undefined))
    )));
  }
  return tuples.filter((tuple) => {
    const values = tuple.reduce<FactorCondition>((combined, condition, index) => (
      condition ? mergeFactorConditions(combined, aliasFactorCondition(condition, aliasNames?.[index]).values) : combined
    ), {});
    return matchesFactorEligibility(materializeFactorCondition(values, errors), assignment, eligibleConditions);
  });
}

function getInputEligibility(
  tuples: FactorInputTuple[],
  index: number,
  errors: ParserErrorWarning[],
): MaterializedFactorCondition[] {
  const values = new Map<string, MaterializedFactorCondition>();
  tuples.forEach((tuple) => {
    if (!tuple[index]) return;
    const condition = materializeFactorCondition(tuple[index]!.values, errors);
    values.set(JSON.stringify(condition), condition);
  });
  return [...values.values()];
}

function filterFactorConditionsByAssignment(
  conditions: ResolvedFactorCondition[],
  assignmentParameters: Record<string, unknown> | undefined,
  errors: ParserErrorWarning[],
  eligibleConditions?: MaterializedFactorCondition[],
): ResolvedFactorCondition[] {
  if ((!assignmentParameters || Object.keys(assignmentParameters).length === 0) && eligibleConditions === undefined) {
    return conditions;
  }

  return conditions.filter((condition) => {
    const materialized = materializeFactorCondition(condition.values, errors);
    return matchesFactorEligibility(materialized, assignmentParameters, eligibleConditions);
  });
}

function getFactorRuntimeCount(resolution: FactorResolution) {
  return resolution.runtimeCount === undefined ? resolution.conditions.length : resolution.runtimeCount;
}

type FactorDrawIdentity = string
  | { action: 'fixed' | 'latinSquare'; length: number; numSamples?: number }
  | { action: 'cross' | 'zip' | 'concat'; inputs: FactorDrawIdentity[] };

function getFactorDrawIdentity(
  source: FactorOption,
  factors: Record<string, Factor>,
  stack: string[] = [],
): FactorDrawIdentity | undefined {
  const named = typeof source === 'string' ? source : undefined;
  if (named && stack.includes(named)) return undefined;
  const factor = named ? factors[named] : source as Exclude<FactorOption, string>;
  if (!factor) return undefined;
  if (Array.isArray(factor)) return { action: 'fixed', length: factor.length };
  if (isOrderedFactorValues(factor)) {
    if (factor.order === 'random') return named;
    // Eligibility filtering precedes slicing, so a truncated fixed list is
    // not equivalent to a shorter array even when their initial lengths match.
    const length = Math.min(factor.values.length, factor.numSamples ?? factor.values.length);
    return {
      action: factor.order || 'fixed',
      length: factor.values.length,
      ...(length < factor.values.length ? { numSamples: length } : {}),
    };
  }
  // Sampling owns a cache identity; filtering may change row positions. Do not
  // equate independently named operations with identical-looking definitions.
  if (factor.action === 'sample' || factor.action === 'keep' || factor.action === 'remove') return named;
  const inputs = factor.factors.map((input) => getFactorDrawIdentity(input, factors, named ? [...stack, named] : stack));
  if (!inputs.every((input): input is FactorDrawIdentity => input !== undefined)) return undefined;
  if (factor.action === 'zip' && inputs.length > 0 && inputs.every((input) => isEqual(input, inputs[0]))) return inputs[0];
  if (factor.action === 'concat' || factor.action === 'repeat') {
    const repetitions = factor.action === 'repeat' ? factor.numRepeats : 1;
    if (!Number.isInteger(repetitions) || repetitions < 1) return named;
    const flattened = inputs.flatMap((input) => (
      typeof input !== 'string' && input.action === 'concat' ? input.inputs : [input]
    ));
    const sequence = Array.from({ length: repetitions }, () => flattened).flat();
    return sequence.length === 1 ? sequence[0] : { action: 'concat', inputs: sequence };
  }
  if (inputs.length === 1) return inputs[0];
  return {
    action: factor.action,
    inputs: inputs.flatMap((input) => (
      typeof input !== 'string' && input.action === factor.action ? input.inputs : [input]
    )),
  };
}

// Shared zip inputs may only concatenate/repeat the same draws or use
// single-input wrappers. More involved layouts need constraint-aware generation.
function isLinearFactorInput(source: FactorOption, factors: Record<string, Factor>, stack: string[] = [], nested = false): boolean {
  const named = typeof source === 'string' ? source : undefined;
  if (named && stack.includes(named)) return false;
  const factor = named ? factors[named] : source as Exclude<FactorOption, string>;
  if (!factor) return false;
  if (Array.isArray(factor)) return true;
  // A nested slice can lose its prefix under assignment filtering, shifting
  // later shared rows even when both inputs have identical definitions.
  if (isOrderedFactorValues(factor)) return !nested || factor.numSamples === undefined || factor.numSamples >= factor.values.length;
  if (factor.action === 'sample') return true;
  if (factor.action === 'keep' || factor.action === 'remove') return false;
  if ((factor.action === 'cross' || factor.action === 'zip') && factor.factors.length !== 1) return false;
  return factor.factors.every((input) => isLinearFactorInput(input, factors, named ? [...stack, named] : stack, true));
}

function getFactorSources(factor: FactorExpression, includeSelectors = false): FactorOption[] {
  if (factor.action !== 'keep' && factor.action !== 'remove') return factor.factors;
  return [factor.factor, ...(includeSelectors && factor.items !== undefined && !Array.isArray(factor.items) ? [factor.items] : [])];
}

// Fixed slices run during allocation too, but do not own a randomized stream.
function hasRuntimeFactorDraw(source: FactorOption, factors: Record<string, Factor>, stack: string[] = []): boolean {
  const named = typeof source === 'string' ? source : undefined;
  if (named && stack.includes(named)) return false;
  const factor = named ? factors[named] : source as Exclude<FactorOption, string>;
  if (!factor || Array.isArray(factor)) return false;
  if (isOrderedFactorValues(factor)) return factor.order !== undefined && factor.order !== 'fixed';
  if (factor.action === 'sample') return true;
  return getFactorSources(factor, true).some((input) => hasRuntimeFactorDraw(input, factors, named ? [...stack, named] : stack));
}

function getFactorStreamOwners(source: FactorOption, factors: Record<string, Factor>, stack: string[] = [], includeSelectors = false): string[] {
  const named = typeof source === 'string' ? source : undefined;
  if (named && stack.includes(named)) return [];
  const factor = named ? factors[named] : source as Exclude<FactorOption, string>;
  if (!factor) return [];
  const own = named ? [named] : [];
  // Sampling starts an independent stream. Filters and composition retain the
  // ordering dependencies of their source streams, even when row counts change.
  if (Array.isArray(factor) || isOrderedFactorValues(factor)) return own;
  if (factor.action === 'sample') return own;
  const sources = getFactorSources(factor, includeSelectors);
  return [...own, ...sources.flatMap((input) => getFactorStreamOwners(input, factors, named ? [...stack, named] : stack, includeSelectors))];
}

function hasIndependentFactorDraw(
  source: FactorOption,
  factors: Record<string, Factor>,
  completeDraws: ReadonlySet<string>,
  stack: string[] = [],
): boolean {
  const named = typeof source === 'string' ? source : undefined;
  if (named && (stack.includes(named) || completeDraws.has(named))) return false;
  const factor = named ? factors[named] : source as Exclude<FactorOption, string>;
  if (!factor || Array.isArray(factor)) return false;
  if (isOrderedFactorValues(factor)) return factor.order === 'random';
  if (factor.action === 'sample') return true;
  const sources = factor.action === 'keep' || factor.action === 'remove' ? [factor.factor] : factor.factors;
  return sources.some((input) => hasIndependentFactorDraw(input, factors, completeDraws, named ? [...stack, named] : stack));
}

function hasSharedZipPrefix(identities: (FactorDrawIdentity | undefined)[]) {
  const draws = identities.filter((identity): identity is FactorDrawIdentity => identity !== undefined);
  if (draws.length < 2 || draws.length !== identities.length) return false;
  const streams = draws.map((identity) => (
    typeof identity !== 'string' && identity.action === 'concat' ? identity.inputs : [identity]
  ));
  const prefixLength = Math.min(...streams.map((stream) => stream.length));
  return prefixLength > 0 && streams.every((stream) => (
    stream.slice(0, prefixLength).every((identity, index) => isEqual(identity, streams[0][index]))
  ));
}

function getFactorPublicNames(
  source: FactorOption,
  factors: Record<string, Factor>,
  stack: string[] = [],
): Set<string> {
  if (typeof source === 'string' && stack.includes(source)) return new Set();
  const factor = typeof source === 'string' ? factors[source] : source;
  if (!factor) return new Set();
  if (Array.isArray(factor) || isOrderedFactorValues(factor)) {
    const values = Array.isArray(factor) ? factor : factor.values;
    return new Set(values.flatMap((value) => (
      typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : [source as string]
    )));
  }
  const nextStack = typeof source === 'string' ? [...stack, source] : stack;
  if (factor.action === 'keep' || factor.action === 'remove') {
    return getFactorPublicNames(factor.factor, factors, nextStack);
  }
  if ((factor.action === 'cross' || factor.action === 'zip') && factor.as) {
    return new Set(factor.as);
  }
  return new Set(factor.factors.flatMap((input) => [...getFactorPublicNames(input, factors, nextStack)]));
}

function getRelevantFactorAssignment(
  assignment: Record<string, unknown> | undefined,
  names: Set<string>,
): Record<string, unknown> | undefined {
  if (!assignment) return undefined;
  const entries = Object.entries(assignment).filter(([key]) => [...names].some((name) => (
    key === name || (key.startsWith(`${name}_`) && /^\d+$/.test(key.slice(name.length + 1)))
  )));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function getFactorDefinition(
  source: FactorOption,
  factors: Record<string, Factor>,
  errors: ParserErrorWarning[],
  stack: string[],
  expressionName: string,
  warnings: ParserErrorWarning[],
  context?: FactorOrderContext,
): FactorResolution {
  let definitions = context?.definitions.get(factors);
  if (context && !definitions) {
    definitions = new Map();
    context.definitions.set(factors, definitions);
  }
  const key = context ? JSON.stringify([source, stack, expressionName]) : '';
  let definition = definitions?.get(key);
  if (!definition) {
    const definitionErrors: ParserErrorWarning[] = [];
    const definitionWarnings: ParserErrorWarning[] = [];
    // Materialization and resolution are mutually recursive.
    // eslint-disable-next-line no-use-before-define
    const resolution = resolveFactor(source, factors, definitionErrors, stack, expressionName, 'materialize', undefined, undefined, definitionWarnings);
    definition = { resolution, errors: definitionErrors, warnings: definitionWarnings };
    definitions?.set(key, definition);
  }
  definition.errors.forEach((error) => addFactorError(errors, error.message, error.instancePath));
  definition.warnings.forEach((warning) => addFactorWarning(warnings, warning.message, warning.instancePath));
  return definition.resolution;
}

function resolveFactor(
  factorSource: FactorOption,
  factors: Record<string, Factor>,
  errors: ParserErrorWarning[] = [],
  stack: string[] = [],
  expressionName = 'inline',
  mode: FactorResolutionMode = 'standard',
  orderContext?: FactorOrderContext,
  assignmentParameters?: Record<string, unknown>,
  warnings: ParserErrorWarning[] = [],
  eligibleConditions?: MaterializedFactorCondition[],
  completeDraws?: ReadonlySet<string>,
): FactorResolution {
  if (typeof factorSource === 'string') {
    if (stack.includes(factorSource)) {
      addFactorError(errors, `Circular factor reference: ${[...stack, factorSource].join(' -> ')}`);
      return { conditions: [] };
    }
  }

  // A shared complete draw keeps one pool throughout this zip. Independent
  // children still receive their own projected eligibility before sampling.
  if (mode === 'runtime' && typeof factorSource === 'string' && completeDraws?.has(factorSource)
    && (assignmentParameters !== undefined || eligibleConditions !== undefined)) {
    return resolveFactor(factorSource, factors, errors, stack, expressionName, mode, orderContext, undefined, warnings, undefined, completeDraws);
  }

  const factorName = typeof factorSource === 'string' ? factorSource : expressionName;
  const factor = typeof factorSource === 'string' ? factors[factorSource] : factorSource;
  if (!factor) {
    addFactorError(errors, `Factor \`${factorSource}\` is not defined`);
    return { conditions: [] };
  }
  if (Array.isArray(factor)) {
    if (factor.length === 0) {
      addFactorError(errors, `Factor \`${factorName}\` must contain at least one value`);
    }
    const conditions = factor.map((value) => ({
      values: typeof value === 'object' && !Array.isArray(value)
        ? { ...value }
        : { [factorName]: value },
    }));
    return {
      conditions: filterFactorConditionsByAssignment(conditions, assignmentParameters, errors, eligibleConditions),
    };
  }

  if (isOrderedFactorValues(factor)) {
    // Validate the definition before filtering; an assignment may have no trials.
    if (factor.values.length === 0) {
      addFactorError(errors, `Factor \`${factorName}\` must contain at least one value`);
      return { conditions: [] };
    }
    const eligibleValues = factor.values.filter((value) => {
      const condition = typeof value === 'object' && !Array.isArray(value)
        ? { ...value }
        : { [factorName]: value };
      return filterFactorConditionsByAssignment([{ values: condition }], assignmentParameters, errors, eligibleConditions).length > 0;
    });
    const values = orderFactorValues(
      factorName,
      { ...factor, values: eligibleValues },
      errors,
      mode === 'runtime' ? orderContext : undefined,
      mode === 'runtime' ? warnings : [],
    );
    return {
      conditions: values.map((value) => ({
        values: typeof value === 'object' && !Array.isArray(value)
          ? { ...value }
          : { [factorName]: value },
      })),
      runtimeCount: Math.min(eligibleValues.length, factor.numSamples ?? eligibleValues.length),
      hasVariableMembership: factor.numSamples !== undefined && factor.numSamples < eligibleValues.length,
      hasRuntimeOrder: (
        (factor.order !== undefined && factor.order !== 'fixed')
        || factor.numSamples !== undefined
      ),
    };
  }

  if (factor.action === 'keep' || factor.action === 'remove') {
    const hasCondition = factor.condition !== undefined && Object.keys(factor.condition).length > 0;
    const hasItems = factor.items !== undefined && (
      !Array.isArray(factor.items) || factor.items.length > 0
    );
    if (hasCondition === hasItems) {
      addFactorError(
        errors,
        `${factor.action === 'keep' ? 'Keep' : 'Remove'} factor \`${factorName}\` requires exactly one non-empty condition or items list`,
      );
      return { conditions: [] };
    }

    const resolution = resolveFactor(
      factor.factor,
      factors,
      errors,
      typeof factorSource === 'string' ? [...stack, factorSource] : stack,
      `${factorName}.${factor.action}`,
      mode,
      orderContext,
      assignmentParameters,
      warnings,
      eligibleConditions,
      completeDraws,
    );

    const sourceAssignment = getRelevantFactorAssignment(assignmentParameters, getFactorPublicNames(factor.factor, factors));
    let selectorEligibility: MaterializedFactorCondition[] | undefined;
    if (mode === 'runtime' && hasItems && !Array.isArray(factor.items) && (sourceAssignment || eligibleConditions !== undefined)) {
      // Project eligibility from the full source domain, not the source's
      // sampled result, so independent draws remain independent.
      const definition = getFactorDefinition(
        factor.factor,
        factors,
        errors,
        typeof factorSource === 'string' ? [...stack, factorSource] : stack,
        `${factorName}.${factor.action}`,
        [],
        orderContext,
      );
      const eligible = filterFactorConditionsByAssignment(definition.conditions, sourceAssignment, errors, eligibleConditions);
      if (eligible.length !== definition.conditions.length) {
        selectorEligibility = eligible.flatMap((condition) => {
          const values = [materializeFactorCondition(condition.values, errors)];
          const sourceErrors: ParserErrorWarning[] = [];
          if (condition.sourceValues) {
            const source = materializeFactorCondition(condition.sourceValues, sourceErrors);
            if (sourceErrors.length === 0) values.push(source);
          }
          return values;
        });
      }
    }

    // Public assignments have already been translated into selector eligibility;
    // reapplying their names here can constrain unrelated original source keys.
    const itemResolution = hasItems && !Array.isArray(factor.items)
      ? resolveFactor(
        factor.items!,
        factors,
        errors,
        typeof factorSource === 'string' ? [...stack, factorSource] : stack,
        `${factorName}.${factor.action}.items`,
        mode,
        orderContext,
        undefined,
        warnings,
        selectorEligibility,
        completeDraws,
      )
      : undefined;

    const matchesSelection = (sourceCondition: ResolvedFactorCondition) => {
      const publicValues = materializeFactorCondition(sourceCondition.values, errors);
      if (hasCondition) {
        return Object.entries(factor.condition!).every(([name, value]) => (
          Object.hasOwn(publicValues, name) && isEqual(publicValues[name], value)
        ));
      }

      const items = Array.isArray(factor.items)
        ? factor.items.map((values) => ({ values } as ResolvedFactorCondition))
        : itemResolution!.conditions;
      return items.some((item) => {
        const itemValues = materializeFactorCondition(item.values, errors);
        if (isEqual(publicValues, itemValues)) return true;
        // Public-key items are authoritative. Only unaliased source forms use
        // compatibility matching, against the origins of this exact condition.
        const publicKeys = Object.keys(publicValues);
        if (item.sourceValues || (publicKeys.length === Object.keys(itemValues).length
          && publicKeys.every((key) => Object.hasOwn(itemValues, key)))) return false;
        const sourceErrors: ParserErrorWarning[] = [];
        const sourceValues = materializeFactorCondition(sourceCondition.sourceValues || sourceCondition.values, sourceErrors);
        return sourceErrors.length === 0 && isEqual(sourceValues, itemValues);
      });
    };

    // Retain possible survivors only when selector membership can vary. Merely
    // reordering a complete pool still removes every value in that pool.
    const runtimeRemoval = mode === 'materialize' && factor.action === 'remove' && itemResolution
      && itemResolution.hasVariableMembership;
    const conditions = resolution.conditions.filter((sourceCondition) => runtimeRemoval || (
      factor.action === 'keep'
        ? matchesSelection(sourceCondition)
        : !matchesSelection(sourceCondition)
    ));
    const completeInputs = getFactorRuntimeCount(resolution) === resolution.conditions.length
      && (!itemResolution || getFactorRuntimeCount(itemResolution) === itemResolution.conditions.length);
    return {
      conditions,
      runtimeCount: completeInputs ? conditions.length : null,
      hasRuntimeOrder: resolution.hasRuntimeOrder || itemResolution?.hasRuntimeOrder,
      hasRuntimeSample: resolution.hasRuntimeSample
        || itemResolution?.hasRuntimeSample
        || resolution.numSamples !== undefined
        || itemResolution?.numSamples !== undefined,
      hasVariableMembership: resolution.hasVariableMembership || itemResolution?.hasVariableMembership,
    };
  }

  const { action, factors: inputs } = factor;
  if (inputs.length === 0) {
    addFactorError(errors, `Factor expression \`${factorName}\` must reference at least one factor`);
    return { conditions: [] };
  }

  const aliasNames = (factor.action === 'cross' || factor.action === 'zip') ? factor.as : undefined;
  const zipIdentities = action === 'zip' ? inputs.map((input) => getFactorDrawIdentity(input, factors)) : [];
  const sharedZipPrefix = hasSharedZipPrefix(zipIdentities);
  const owners = new Map<string, number[]>();
  if (action === 'zip') {
    inputs.forEach((input, index) => {
      new Set(getFactorStreamOwners(input, factors)).forEach((owner) => {
        owners.set(owner, [...(owners.get(owner) || []), index]);
      });
    });
  }
  if (action === 'zip') {
    // Selectors are validation dependencies, not row-order owners. Keep them
    // separate from the ownership map used by generation below.
    const dependencies = new Map<string, number[]>();
    inputs.forEach((input, index) => {
      new Set(getFactorStreamOwners(input, factors, [], true)).forEach((owner) => {
        dependencies.set(owner, [...(dependencies.get(owner) || []), index]);
      });
    });
    const unsupportedOwner = [...dependencies].find(([owner, indices]) => {
      if (indices.length < 2 || !hasRuntimeFactorDraw(owner, factors)) return false;
      const identity = zipIdentities[indices[0]];
      return identity === undefined
        || indices.some((index) => !isLinearFactorInput(inputs[index], factors) || !isEqual(zipIdentities[index], identity));
    });
    if (unsupportedOwner) {
      addFactorError(errors, `Factor \`${factorName}\` has an unsupported shared-draw zip: \`${unsupportedOwner[0]}\` is reused through different or nested row layouts. Define the paired conditions explicitly, or use independent named draws.`);
      return { conditions: [] };
    }
  }
  const sharesStream = [...owners.values()].some((indices) => indices.length > 1);
  const assignment = assignmentParameters && Object.keys(assignmentParameters).length > 0
    ? getRelevantFactorAssignment(assignmentParameters, getFactorPublicNames(factorSource, factors)) : undefined;
  const constrained = assignment !== undefined || eligibleConditions !== undefined;
  let inputDefinitions: FactorResolution[] | undefined;
  if (aliasNames !== undefined || constrained || sharedZipPrefix || sharesStream || (action === 'zip' && mode === 'materialize')) {
    inputDefinitions = inputs.map((input, index) => getFactorDefinition(
      input,
      factors,
      errors,
      typeof factorSource === 'string' ? [...stack, factorSource] : stack,
      `${factorName}.${action}[${index}]`,
      warnings,
      orderContext,
    ));
  }
  if (aliasNames !== undefined && !validateFactorAliases(inputDefinitions!, aliasNames, factorName, errors)) {
    return { conditions: [] };
  }
  // A wholly aligned, fixed-membership zip can filter after pairing.
  // Other zips resolve their shared input groups separately below.
  const pairBeforeFiltering = sharedZipPrefix
    && inputDefinitions!.every((resolution) => !resolution.hasVariableMembership);
  const correlatedZip = action === 'zip' && (inputs.length === 1
    || pairBeforeFiltering);
  // Connect input positions by shared complete streams or aligned ordering.
  // Groups can be non-adjacent and contain any number of inputs.
  const groupIds = inputs.map((_, index) => index);
  const root = (index: number): number => {
    let current = index;
    while (groupIds[current] !== current) current = groupIds[current];
    return current;
  };
  const sharedCompleteDraws = new Set<string>();
  const alignedInputs = new Set<number>();
  if (action === 'zip' && (constrained || mode === 'materialize')) {
    owners.forEach((indices, owner) => {
      if (indices.length < 2) return;
      const direct = inputs.indexOf(owner);
      const definition = direct >= 0 && inputDefinitions ? inputDefinitions[direct]
        : getFactorDefinition(owner, factors, errors, stack, owner, warnings, orderContext);
      if (definition.hasVariableMembership) return;
      sharedCompleteDraws.add(owner);
      indices.forEach((index) => {
        groupIds[root(index)] = root(indices[0]);
      });
    });
  }
  if (action === 'zip' && inputDefinitions) {
    inputs.forEach((input, index) => {
      const streamOwners = getFactorStreamOwners(input, factors);
      const hasIndependentDraw = hasIndependentFactorDraw(input, factors, sharedCompleteDraws);
      if (!inputDefinitions![index].hasVariableMembership && !hasIndependentDraw
        && streamOwners.some((owner) => sharedCompleteDraws.has(owner))) alignedInputs.add(index);
    });
  }
  const pairedGroups = inputs.map((_, index) => index);
  const pairedRoot = (index: number): number => {
    let current = index;
    while (pairedGroups[current] !== current) current = pairedGroups[current];
    return current;
  };
  if (action === 'zip' && inputDefinitions) {
    inputs.forEach((_, index) => {
      inputs.slice(0, index).forEach((__, previous) => {
        if (!inputDefinitions![index].hasVariableMembership && !inputDefinitions![previous].hasVariableMembership
          && hasSharedZipPrefix([zipIdentities[index], zipIdentities[previous]])) {
          groupIds[root(index)] = root(previous);
          pairedGroups[pairedRoot(index)] = pairedRoot(previous);
          alignedInputs.add(index);
          alignedInputs.add(previous);
        }
      });
    });
  }
  const groups = new Map<number, number[]>();
  inputs.forEach((_, index) => { groups.set(root(index), [...(groups.get(root(index)) || []), index]); });
  const materialGroups = new Map<number, number[]>();
  inputs.forEach((_, index) => {
    const key = pairedRoot(index);
    materialGroups.set(key, [...(materialGroups.get(key) || []), index]);
  });
  const tuples = constrained && !pairBeforeFiltering
    ? getEligibleInputTuples(
      inputDefinitions!,
      action,
      aliasNames,
      assignment,
      eligibleConditions,
      errors,
      action === 'zip' ? [...materialGroups.values()] : undefined,
    )
    : undefined;
  const scopedDraws = sharedCompleteDraws.size > 0
    ? new Set([...completeDraws || [], ...sharedCompleteDraws]) : completeDraws;
  const resolveInput = (index: number, eligible?: MaterializedFactorCondition[]) => resolveFactor(
    inputs[index],
    factors,
    errors,
    typeof factorSource === 'string' ? [...stack, factorSource] : stack,
    `${factorName}.${action}[${index}]`,
    mode,
    orderContext,
    undefined,
    warnings,
    eligible,
    scopedDraws,
  );

  if (mode === 'runtime' && action === 'cross' && tuples) {
    let hasRuntimeOrder = false;
    let hasRuntimeSample = false;
    let hasVariableMembership = false;
    // Later inputs use the actual selected prefix shape, not a maximum arity.
    // Narrow their eligible values before sampling to keep compatible branches.
    const extend = (index: number, prefix: ResolvedFactorCondition, candidates: FactorInputTuple[]): ResolvedFactorCondition[] => {
      if (index === inputs.length) return [prefix];
      const resolution = resolveInput(index, getInputEligibility(candidates, index, errors));
      hasRuntimeOrder ||= !!resolution.hasRuntimeOrder;
      hasRuntimeSample ||= !!resolution.hasRuntimeSample || resolution.numSamples !== undefined;
      hasVariableMembership ||= !!resolution.hasVariableMembership;
      const protectedInput = getFactorStreamOwners(inputs[index], factors).some((owner) => completeDraws?.has(owner));
      return resolution.conditions.flatMap((condition) => {
        const values = materializeFactorCondition(condition.values, errors);
        // Eligibility for a protected stream is enforced by the owning zip
        // after pairing. Keep its independent suffix pools available for every
        // protected row instead of compressing this cross's row positions.
        const remaining = protectedInput ? candidates : candidates.filter((tuple) => (
          tuple[index] && isEqual(materializeFactorCondition(tuple[index]!.values, errors), values)
        ));
        return extend(index + 1, mergeResolvedFactorConditions(prefix, aliasFactorCondition(condition, aliasNames?.[index])), remaining);
      });
    };
    const conditions = extend(0, { values: {} }, tuples);
    return {
      conditions, runtimeCount: conditions.length, hasRuntimeOrder, hasRuntimeSample, hasVariableMembership,
    };
  }

  // Fixed zip rows must be paired before eligibility filtering. Filtering each
  // input independently changes row positions when the same level occurs twice.
  const fixedZip = action === 'zip' && inputDefinitions && inputDefinitions.every((resolution) => (
    !resolution.hasRuntimeOrder && !resolution.hasRuntimeSample && resolution.numSamples === undefined
  ));
  let resolutions: FactorResolution[];
  if (mode === 'runtime' && action === 'zip' && tuples && [...groups.values()].some((group) => group.length > 1)) {
    resolutions = [];
    let candidates = tuples;
    const matches = (tuple: FactorInputTuple, indices: number[], row: number) => indices.every((index) => (
      tuple[index] && isEqual(
        materializeFactorCondition(tuple[index]!.values, errors),
        materializeFactorCondition(resolutions[index].conditions[row].values, errors),
      )
    ));
    // Resolve shared groups first, then narrow independent sampling pools using
    // their surviving rows. Retain row positions inside each group until paired.
    [...groups.values()].sort((left, right) => right.length - left.length).forEach((indices) => {
      indices.forEach((index) => {
        resolutions[index] = resolveInput(index, alignedInputs.has(index) ? undefined : getInputEligibility(candidates, index, errors));
      });
      if (indices.length === 1) return;
      const rows = Array.from({ length: Math.min(...indices.map((index) => resolutions[index].conditions.length)) }, (_, row) => row)
        .filter((row) => candidates.some((tuple) => matches(tuple, indices, row)));
      candidates = candidates.filter((tuple) => rows.some((row) => matches(tuple, indices, row)));
      indices.forEach((index) => {
        resolutions[index] = { ...resolutions[index], conditions: rows.map((row) => resolutions[index].conditions[row]) };
      });
    });
  } else {
    resolutions = ((mode === 'materialize' && !constrained) || fixedZip) && inputDefinitions
      ? inputDefinitions : inputs.map((_, index) => resolveInput(index, tuples && getInputEligibility(tuples, index, errors)));
  }
  const conditionSets = resolutions.map((resolution, index) => (
    resolution.conditions.map((condition) => aliasFactorCondition(condition, aliasNames?.[index]))
  ));

  const counts = resolutions.map(getFactorRuntimeCount);
  const runtimeCounts = counts.every((count): count is number => count !== null) ? counts : null;
  const concatenatedCount = runtimeCounts?.reduce((total, count) => total + count, 0) ?? null;
  const hasRuntimeOrder = resolutions.some((resolution) => resolution.hasRuntimeOrder);
  const hasRuntimeSample = resolutions.some((resolution) => (
    resolution.hasRuntimeSample || resolution.numSamples !== undefined
  ));
  const hasVariableMembership = resolutions.some((resolution) => resolution.hasVariableMembership);
  if (action === 'cross') {
    return {
      conditions: crossFactorConditions(conditionSets),
      runtimeCount: runtimeCounts?.reduce((total, count) => total * count, 1) ?? null,
      hasRuntimeOrder,
      hasRuntimeSample,
      hasVariableMembership,
    };
  }
  if (action === 'zip') {
    if (mode === 'materialize' && runtimeCounts && (hasRuntimeOrder || hasRuntimeSample)) {
      warnZipLengths(runtimeCounts, factorName, warnings);
    }
    let combined: ResolvedFactorCondition[];
    if (mode === 'materialize' && !correlatedZip && (hasRuntimeOrder || hasRuntimeSample)) {
      // Materialize correlated groups together; Cartesian expansion is only
      // needed between independently ordered/sampled groups. Preserve original
      // input positions so repeated public names keep their slot indices.
      const possible = [...materialGroups.values()].reduce<FactorInputTuple[]>((prefixes, indices) => {
        const paired = indices.length > 1 && indices.every((index) => !resolutions[index].hasVariableMembership)
          && hasSharedZipPrefix(indices.map((index) => zipIdentities[index]));
        const rows = paired
          ? Array.from({ length: Math.min(...indices.map((index) => conditionSets[index].length)) }, (_, row) => (
            inputs.map((__, index) => (indices.includes(index) ? conditionSets[index][row] : undefined))
          ))
          : indices.reduce<FactorInputTuple[]>((current, index) => current.flatMap((prefix) => (
            conditionSets[index].map((condition) => {
              const row = [...prefix];
              row[index] = condition;
              return row;
            })
          )), [[]]);
        return prefixes.flatMap((prefix) => rows.map((row) => inputs.map((_, index) => row[index] || prefix[index])));
      }, [[]]);
      combined = possible.map((tuple) => tuple.reduce<ResolvedFactorCondition>((condition, next) => (
        next ? mergeResolvedFactorConditions(condition, next) : condition
      ), { values: {} }));
    } else {
      combined = zipFactorConditions(conditionSets, factorName, errors, warnings);
    }
    const conditions = filterFactorConditionsByAssignment(combined, assignmentParameters, errors, eligibleConditions);
    const varyingInputs = conditionSets.flatMap((rows, index) => (
      rows.some((row) => !isEqual(row, rows[0])) ? [index] : []
    ));
    // Counts alone cannot prove Cartesian coverage. Exact membership is known
    // for correlated order, or one complete varying input paired with constants.
    const completeMembership = correlatedZip || varyingInputs.length === 0
      || (varyingInputs.length === 1 && runtimeCounts !== null
        && Math.min(...runtimeCounts) >= runtimeCounts[varyingInputs[0]]);
    return {
      conditions,
      runtimeCount: mode === 'runtime' ? conditions.length : runtimeCounts ? Math.min(...runtimeCounts) : null,
      hasRuntimeOrder,
      hasRuntimeSample,
      hasVariableMembership: hasVariableMembership || ((hasRuntimeOrder || hasRuntimeSample)
        && !completeMembership),
    };
  }

  const conditions = conditionSets.flat();
  if (action === 'concat') {
    return {
      conditions, runtimeCount: concatenatedCount, hasRuntimeOrder, hasRuntimeSample, hasVariableMembership,
    };
  }
  if (factor.action === 'repeat') {
    if (!Number.isInteger(factor.numRepeats) || factor.numRepeats < 1) {
      addFactorError(errors, `Repeat factor \`${factorName}\` requires a positive integer numRepeats`);
      return { conditions: [] };
    }
    return {
      conditions: Array.from({ length: factor.numRepeats }, () => conditions).flat(),
      runtimeCount: concatenatedCount === null ? null : concatenatedCount * factor.numRepeats,
      hasRuntimeOrder,
      hasRuntimeSample,
      hasVariableMembership,
    };
  }

  if (factor.action !== 'sample') {
    return { conditions };
  }
  // A protected source supplies its complete ordered rows. This independent
  // sample must still restrict its own pool before choosing any of those rows.
  const pool = filterFactorConditionsByAssignment(conditions, assignmentParameters, errors, eligibleConditions);
  if (
    factor.samplingStrategy !== 'withoutReplacement'
    && factor.samplingStrategy !== 'withReplacement'
  ) {
    addFactorError(
      errors,
      `Sample factor \`${factorName}\` requires samplingStrategy to be withoutReplacement or withReplacement`,
    );
    return { conditions: [] };
  }
  if (!Number.isInteger(factor.numSamples) || factor.numSamples < 1) {
    addFactorError(errors, `Sample factor \`${factorName}\` requires a positive integer numSamples`);
    return { conditions: [] };
  }

  // The definition was validated before participant eligibility filtering.
  if (mode === 'runtime' && pool.length === 0) {
    return {
      conditions: [], runtimeCount: 0, hasRuntimeOrder,
    };
  }

  const availableCount = mode === 'runtime' ? pool.length : concatenatedCount;
  if (
    factor.samplingStrategy === 'withoutReplacement'
    && availableCount !== null && factor.numSamples > availableCount
    && mode !== 'runtime'
    && !hasRuntimeSample
  ) {
    addFactorError(
      errors,
      `Sample factor \`${factorName}\` cannot select ${factor.numSamples} conditions from ${availableCount}`,
    );
    return { conditions: [] };
  }
  if (
    factor.samplingStrategy === 'withoutReplacement'
    && availableCount !== null && factor.numSamples > availableCount
  ) {
    addFactorWarning(
      warnings,
      `Sample factor \`${factorName}\` requested ${factor.numSamples} conditions but only ${availableCount} are available; stopping after the list is exhausted`,
    );
  }
  if (pool.length === 0) {
    addFactorError(
      errors,
      `Sample factor \`${factorName}\` cannot sample from an empty condition set`,
    );
    return { conditions: [] };
  }
  if (mode === 'runtime') {
    return {
      conditions: sampleFactorConditions(
        factorName,
        pool,
        factor.numSamples,
        factor.samplingStrategy,
        orderContext,
      ),
      hasRuntimeOrder,
      hasVariableMembership: hasVariableMembership || factor.numSamples < pool.length
        || (factor.samplingStrategy === 'withReplacement' && pool.length > 1),
    };
  }
  const runtimeCount = factor.samplingStrategy === 'withReplacement'
    ? factor.numSamples : concatenatedCount;
  return {
    conditions,
    runtimeCount: runtimeCount === null ? null : Math.min(factor.numSamples, runtimeCount),
    numSamples: factor.numSamples,
    samplingStrategy: factor.samplingStrategy,
    hasRuntimeOrder,
    hasRuntimeSample: hasRuntimeSample || factor.samplingStrategy === 'withReplacement',
    hasVariableMembership: hasVariableMembership || concatenatedCount === null || factor.numSamples < concatenatedCount
      || (factor.samplingStrategy === 'withReplacement' && pool.length > 1),
  };
}

export function resolveFactorConditions(
  factorSource: FactorOption,
  factors: Record<string, Factor>,
  errors: ParserErrorWarning[] = [],
  stack: string[] = [],
  expressionName = 'inline',
  warnings: ParserErrorWarning[] = [],
): FactorCondition[] {
  const resolution = resolveFactor(factorSource, factors, errors, stack, expressionName, 'standard', undefined, undefined, warnings);
  if (resolution.numSamples !== undefined || resolution.hasRuntimeSample) {
    addFactorError(
      errors,
      `Sample factor \`${typeof factorSource === 'string' ? factorSource : expressionName}\` must be materialized by a factor block`,
    );
    return [];
  }
  return resolution.conditions.map((condition) => (
    materializeFactorCondition(condition.values, errors)
  ));
}

export function resolveOrderedFactorConditions(
  factorSource: FactorOption,
  factors: Record<string, Factor>,
  orderContext: FactorOrderContext,
  errors: ParserErrorWarning[] = [],
  expressionName = 'inline',
  assignmentParameters?: Record<string, unknown>,
  warnings: ParserErrorWarning[] = [],
): Record<string, FactorObjectValue>[] {
  const resolution = resolveFactor(
    factorSource,
    factors,
    errors,
    [],
    expressionName,
    'runtime',
    orderContext,
    assignmentParameters,
    warnings,
  );
  if (resolution.numSamples !== undefined || resolution.hasRuntimeSample) {
    addFactorError(errors, `Sample factor \`${typeof factorSource === 'string' ? factorSource : expressionName}\` must be materialized by a factor block`);
    return [];
  }
  return resolution.conditions.map((condition) => (
    materializeFactorCondition(condition.values, errors)
  ));
}

export function createFactorConditionId(
  blockId: string,
  condition: MaterializedFactorCondition,
): string {
  const conditionId = Object.entries(condition)
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(JSON.stringify(value))}`)
    .join('__');
  return conditionId ? `${encodeURIComponent(blockId)}__${conditionId}` : encodeURIComponent(blockId);
}

function compileFactorBlock(
  block: FactorBlock,
  config: StudyConfig,
  errors: ParserErrorWarning[],
  warnings: ParserErrorWarning[],
): FactorCompileResult {
  const components: Record<string, IndividualComponent> = {};
  const baseComponents = typeof block.components === 'string'
    ? [block.components]
    : block.components;
  const materializedConditions = new Map<string, string[]>();
  const factorLabels: Record<string, string> = {};
  const withFactorLabels = (sequence: StudyConfig['sequence']): StudyConfig['sequence'] => {
    // Display labels must not change the persisted config hash.
    Object.defineProperty(sequence, '__revisitFactorLabels', { value: factorLabels });
    return sequence;
  };
  const materializeCondition = (condition: MaterializedFactorCondition): string[] => {
    const conditionId = createFactorConditionId(block.id, condition);
    const existing = materializedConditions.get(conditionId);
    if (existing) {
      return existing;
    }

    const conditionComponentIds = baseComponents.flatMap((baseComponentTemplate) => {
      const baseComponent = fillTemplate(baseComponentTemplate, condition);
      const template = config.baseComponents?.[baseComponent];
      if (!template) {
        addFactorError(
          errors,
          `Factor block \`${block.id}\` references undefined base component \`${baseComponent}\``,
          '/sequence/',
        );
        return [];
      }
      const rawParameters = {
        ...('parameters' in template ? template.parameters : {}),
        ...condition,
      };
      const parameters = deepFillTemplate(rawParameters, rawParameters);
      const componentId = `${conditionId}__${encodeURIComponent(baseComponent)}`;
      const component = deepFillTemplateStrings(
        merge({}, template, { parameters }),
        parameters,
      ) as IndividualComponent;

      if (!individualComponentValidate(component)) {
        addFactorError(
          errors,
          `Factor block \`${block.id}\` generated component from base component \`${baseComponent}\` that does not satisfy the IndividualComponent schema`,
          '/sequence/',
        );
        return [];
      }

      if (
        config.components[componentId]
        || (components[componentId] && !isEqual(components[componentId], component))
      ) {
        addFactorError(
          errors,
          `Generated component ID \`${componentId}\` is already used by another component`,
          '/sequence/',
        );
        return [];
      }

      components[componentId] = component;
      const values = Object.values(condition).map((value) => (typeof value === 'string' ? value : JSON.stringify(value)));
      factorLabels[componentId] = values.length ? `${values.join(' · ')} — ${baseComponent}` : baseComponent;
      return [componentId];
    });
    materializedConditions.set(conditionId, conditionComponentIds);
    return conditionComponentIds;
  };

  const resolution = resolveFactor(
    block.factor,
    config.factors || {},
    errors,
    [],
    block.id,
    'materialize',
    undefined,
    undefined,
    warnings,
  );
  const conditions = resolution.conditions.map((condition) => (
    materializeFactorCondition(condition.values, errors)
  ));
  let sequenceComponents: ComponentBlock['components'];
  let order = block.order ?? 'fixed';

  if (resolution.hasRuntimeOrder || resolution.hasRuntimeSample) {
    if (block.order !== undefined) {
      addFactorError(errors, `Factor block \`${block.id}\` uses runtime factor ordering or sampling and cannot also define \`order\``, '/sequence/');
    }
    conditions.forEach((condition) => materializeCondition(condition));
    return {
      sequence: withFactorLabels({
        type: 'factor-runtime-plan',
        id: block.id,
        order: 'fixed',
        components: [],
        factor: block.factor,
        factors: config.factors || {},
        conditionComponents: Object.fromEntries(materializedConditions),
        ...(block.interruptions !== undefined ? { interruptions: block.interruptions } : {}),
        ...(block.skip !== undefined ? { skip: block.skip } : {}),
        ...(block.conditional !== undefined ? { conditional: block.conditional } : {}),
      } as StudyConfig['sequence']),
      components,
    };
  }

  if (resolution.numSamples === undefined) {
    sequenceComponents = conditions.flatMap(materializeCondition);
  } else {
    if (block.order !== undefined) {
      addFactorError(
        errors,
        `Factor block \`${block.id}\` materializes a sample and cannot also define \`order\``,
        '/sequence/',
      );
    }
    sequenceComponents = conditions.map((condition): FactorPlanBlock => ({
      type: 'factor-plan',
      order: 'fixed',
      components: materializeCondition(condition),
    }));
    order = 'random';
  }

  return {
    sequence: withFactorLabels({
      id: block.id,
      order,
      components: sequenceComponents,
      ...(resolution.numSamples !== undefined ? { numSamples: resolution.numSamples } : {}),
      ...(block.interruptions !== undefined ? { interruptions: block.interruptions } : {}),
      ...(block.skip !== undefined ? { skip: block.skip } : {}),
      ...(block.conditional !== undefined ? { conditional: block.conditional } : {}),
    } as StudyConfig['sequence']),
    components,
  };
}

export function compileFactorBlocks(
  sequence: StudyConfig['sequence'],
  config: StudyConfig,
  errors: ParserErrorWarning[] = [],
  warnings: ParserErrorWarning[] = [],
): FactorCompileResult {
  if (isDynamicBlock(sequence)) {
    return { sequence, components: {} };
  }
  if (isFactorBlock(sequence)) {
    return compileFactorBlock(sequence, config, errors, warnings);
  }

  const components: Record<string, IndividualComponent> = {};
  const compiledSequence: ComponentBlock = {
    ...sequence,
    components: sequence.components.map((component) => {
      if (typeof component === 'string') {
        return component;
      }

      const compiled = compileFactorBlocks(component, config, errors, warnings);
      Object.entries(compiled.components).forEach(([componentId, compiledComponent]) => {
        if (components[componentId] && !isEqual(components[componentId], compiledComponent)) {
          addFactorError(
            errors,
            `Generated component ID \`${componentId}\` is already used by another factor block`,
            '/sequence/',
          );
        } else {
          components[componentId] = compiledComponent;
        }
      });
      return compiled.sequence;
    }),
  };

  return { sequence: compiledSequence, components };
}

/**
 * Creates the runtime config for one participant without mutating the canonical study config.
 * Call this after sequence assignment so participant-global parameters can resolve component
 * inheritance and templates such as `{{vis}}` before the Redux store is created.
 */
export function materializeParticipantConfig(
  config: StudyConfig,
  globalParameters: Record<string, unknown>,
): StudyConfig {
  const components = Object.fromEntries(
    Object.entries(config.components).map(([componentId, component]) => {
      const inheritedComponent = studyComponentToIndividualComponent(component, config);
      const parameters = {
        ...('parameters' in inheritedComponent ? inheritedComponent.parameters : {}),
        ...globalParameters,
      };
      const materializedComponent = deepFillTemplateStrings(inheritedComponent, parameters);
      return [
        componentId,
        {
          ...materializedComponent,
          parameters: deepFillTemplate(parameters, parameters),
        },
      ];
    }),
  );

  return { ...config, components };
}

export function resolveBetweenSubjectsFactorLevels(
  factorName: string,
  factors: Record<string, Factor>,
  errors: ParserErrorWarning[] = [],
): FactorValue[] | undefined {
  const factor = factors[factorName];
  if (Array.isArray(factor)) {
    return factor;
  }
  if (factor && typeof factor === 'object' && 'action' in factor) {
    const factorErrors: ParserErrorWarning[] = [];
    const levels = resolveFactorConditions(factorName, factors, factorErrors);
    factorErrors.forEach((error) => errors.push(error));
    return factorErrors.length === 0 ? levels as FactorValue[] : undefined;
  }
  return undefined;
}

export function validateBetweenSubjects(
  config: StudyConfig,
  warnings: ParserErrorWarning[] = [],
  errors: ParserErrorWarning[] = [],
) {
  const betweenSubjectsObjectFactors: Array<{ factorName: string; index: number; levels: FactorObject[] }> = [];
  const namespaceOwners = new Map<string, string>();
  const seenFactors = new Set<string>();
  let combinationCount = 1;

  config.betweenSubjects?.forEach((factorName, index) => {
    const instancePath = `/betweenSubjects/${index}`;
    if (seenFactors.has(factorName)) {
      errors.push({
        message: `Between-subjects factor \`${factorName}\` is declared more than once`,
        instancePath,
        params: { action: 'Declare each between-subjects factor only once' },
        category: 'sequence-validation',
      });
    }
    seenFactors.add(factorName);

    const beforeResolutionErrors = errors.length;
    const levels = resolveBetweenSubjectsFactorLevels(factorName, config.factors || {}, errors);
    if (errors.length > beforeResolutionErrors) {
      return;
    }
    combinationCount *= levels?.length || 1;
    const isObjectFactor = levels !== undefined
      && levels.length > 0
      && levels.every((level) => level !== null && typeof level === 'object' && !Array.isArray(level));
    const isPrimitiveFactor = levels !== undefined
      && levels.length > 0
      && levels.every((level) => typeof level !== 'object');

    if (
      levels === undefined
      || levels.length === 0
      || (!isPrimitiveFactor && !isObjectFactor)
    ) {
      const unresolvedFactorMessage = Object.hasOwn(config.factors || {}, factorName)
        ? `Between-subjects factor \`${factorName}\` must be a list of levels or a factor expression`
        : `Between-subjects factor \`${factorName}\` is not defined in factors`;
      errors.push({
        message: levels === undefined
          ? unresolvedFactorMessage
          : `Between-subjects factor \`${factorName}\` must be a non-empty factor with either all primitive levels or all object levels`,
        instancePath,
        params: { action: 'Use a non-empty primitive or object factor defined in factors' },
        category: 'sequence-validation',
      });
    } else if (isObjectFactor) {
      betweenSubjectsObjectFactors.push({
        factorName,
        index,
        levels: levels as FactorObject[],
      });
    }

    const parameterNames = new Set([
      factorName,
      ...(isObjectFactor ? (levels as FactorObject[]).flatMap((level) => Object.keys(level)) : []),
    ]);
    if (isObjectFactor && (levels as FactorObject[]).some((level) => Object.hasOwn(level, factorName))) {
      errors.push({
        message: `Between-subjects factor \`${factorName}\` collides with its own parameter namespace`,
        instancePath,
        params: { action: 'Use unique between-subjects factor and parameter names' },
        category: 'sequence-validation',
      });
    }
    parameterNames.forEach((parameterName) => {
      const owner = namespaceOwners.get(parameterName);
      if (owner && owner !== factorName) {
        errors.push({
          message: `Between-subjects factors \`${owner}\` and \`${factorName}\` collide on parameter namespace \`${parameterName}\``,
          instancePath,
          params: { action: 'Use unique between-subjects factor and parameter names' },
          category: 'sequence-validation',
        });
      } else {
        namespaceOwners.set(parameterName, factorName);
      }
    });
  });

  if ((config.uiConfig.numSequences || 1000) < combinationCount) {
    errors.push({
      message: `numSequences must be at least ${combinationCount} to cover every between-subjects combination`,
      instancePath: '/uiConfig/numSequences',
      params: { action: 'Increase numSequences to cover every between-subjects combination' },
      category: 'sequence-validation',
    });
  }

  betweenSubjectsObjectFactors.forEach((factor, factorIndex) => {
    betweenSubjectsObjectFactors.slice(factorIndex + 1).forEach((otherFactor) => {
      const incompatibleParameterNames = new Set<string>();

      factor.levels.forEach((level) => {
        otherFactor.levels.forEach((otherLevel) => {
          Object.keys(level).forEach((parameterName) => {
            if (
              otherLevel[parameterName] !== undefined
              && !isEqual(level[parameterName], otherLevel[parameterName])
            ) {
              incompatibleParameterNames.add(parameterName);
            }
          });
        });
      });

      incompatibleParameterNames.forEach((parameterName) => {
        warnings.push({
          message: `Between-subjects factors \`${factor.factorName}\` and \`${otherFactor.factorName}\` assign incompatible values to \`${parameterName}\``,
          instancePath: `/betweenSubjects/${otherFactor.index}`,
          params: {
            action: 'Ensure object-valued between-subjects factors do not assign conflicting parameter names',
          },
          category: 'sequence-validation',
        });
      });
    });
  });
}

// Recursively iterate through sequences (sequence.components) and replace any library sequence references with the actual library sequence
export function expandLibrarySequences(sequence: StudyConfig['sequence'], importedLibrariesData: Record<string, LibraryConfig>, errors: ParserErrorWarning[] = []): StudyConfig['sequence'] {
  if (isDynamicBlock(sequence)) {
    return sequence;
  }
  if (isFactorBlock(sequence)) {
    return {
      ...sequence,
      components: typeof sequence.components === 'string'
        ? normalizeLibraryMacroReference(sequence.components)
        : sequence.components.map((component) => normalizeLibraryMacroReference(component)),
      interruptions: normalizeInterruptionComponents(sequence.interruptions),
      skip: normalizeSkipTargets(sequence.skip),
    };
  }
  return {
    ...sequence,
    interruptions: normalizeInterruptionComponents(sequence.interruptions),
    skip: normalizeSkipTargets(sequence.skip),
    components: (sequence.components || []).map((component) => {
      if (typeof component === 'object') {
        return expandLibrarySequences(component, importedLibrariesData, errors);
      }

      // Expand .co. macro to .components. and .se. macro to .sequences. before processing
      const processedComponent = normalizeLibraryMacroReference(component);

      const sequencesSeparator = processedComponent.includes('.sequences.') ? '.sequences.' : false;
      if (typeof processedComponent === 'string' && processedComponent.startsWith('$') && sequencesSeparator) {
        const parts = processedComponent.split(sequencesSeparator);
        const libraryName = parts[0];
        const sequenceName = parts.slice(1).join(sequencesSeparator);
        // Remove the $ from the library name
        const cleanLibraryName = libraryName.slice(1);

        // Check if the library is in the imported libraries
        if (!importedLibrariesData[cleanLibraryName]) {
          const error: ParserErrorWarning = {
            message: `Library \`${cleanLibraryName}\` not found in imported libraries`,
            instancePath: '/importedLibraries/',
            params: { action: 'Check the library name and make sure the library is imported correctly' },
            category: 'undefined-library',
          };
          errors.push(error);
          return processedComponent;
        }

        const library = importedLibrariesData[cleanLibraryName];

        let librarySequence = library.sequences?.[sequenceName];
        if (!librarySequence) {
          const error: ParserErrorWarning = {
            message: `Sequence \`${sequenceName}\` not found in library \`${cleanLibraryName}\``,
            instancePath: `/importedLibraries/${cleanLibraryName}/sequence/`,
            params: { action: 'Check the sequence name' },
            category: 'sequence-validation',
          };
          errors.push(error);
          return processedComponent;
        }

        // Iterate through the library sequence and namespace the components with the library name
        librarySequence = namespaceLibrarySequenceComponents(librarySequence, cleanLibraryName);
        const librarySequenceWithImportReference: SequenceWithImportReference = {
          ...(librarySequence as SequenceWithImportReference),
          __revisitImportedSequenceRef: processedComponent,
        };
        // Preserve import provenance in UI by assigning an id when the library sequence does not define one.
        if (!isDynamicBlock(librarySequenceWithImportReference) && !librarySequenceWithImportReference.id) {
          librarySequenceWithImportReference.id = processedComponent;
        }
        librarySequence = librarySequenceWithImportReference;

        // After namespacing, expand any component macros inside the inlined sequence
        return expandLibrarySequences(librarySequence, importedLibrariesData, errors);
      }

      return processedComponent;
    }),
  };
}

// This function verifies that the library usage in the study config is valid
export function verifyLibraryUsage(
  studyConfig: StudyConfig,
  errors: ParserErrorWarning[],
  warnings: ParserErrorWarning[],
  importedLibrariesData: Record<string, LibraryConfigWithInheritanceMetadata>,
) {
  const allLibraryComponentNames = new Set(
    Object.values(importedLibrariesData).flatMap((libraryData) => Object.keys(libraryData.components)),
  );
  const usedLibraryComponentNames = new Set<string>();
  const componentsToVisit = [...getSequenceFlatMapWithInterruptions(studyConfig.sequence)];
  const visited = new Set<string>();

  while (componentsToVisit.length > 0) {
    const currentComponentName = componentsToVisit.pop()!;
    if (!visited.has(currentComponentName)) {
      visited.add(currentComponentName);

      if (allLibraryComponentNames.has(currentComponentName)) {
        usedLibraryComponentNames.add(currentComponentName);
      }

      const currentComponent = studyConfig.components[currentComponentName];
      if (currentComponent && isInheritedComponent(currentComponent)) {
        componentsToVisit.push(currentComponent.baseComponent);
      }
    }
  }

  Object.entries(importedLibrariesData).forEach(([library, libraryData]) => {
    // Verify that the library components are well defined
    Object.entries(libraryData.components).forEach(([componentName, component]) => {
      const baseComponentRef = isInheritedComponent(component)
        ? component.baseComponent
        : libraryData.__revisitInheritedComponentMetadata?.[componentName]?.baseComponent;
      const ownWithSidebar = isInheritedComponent(component)
        ? component.withSidebar
        : libraryData.__revisitInheritedComponentMetadata?.[componentName]?.withSidebar;

      // Verify baseComponent is defined in baseComponents object
      if (baseComponentRef && !libraryData.baseComponents?.[baseComponentRef]) {
        errors.push({
          message: `Base component \`${baseComponentRef}\` is not defined in baseComponents object in library \`${library}\``,
          instancePath: `/importedLibraries/${library}/baseComponents/`,
          params: { action: 'Add the base component to the baseComponents object' },
          category: 'undefined-base-component',
        });
      }

      if (!usedLibraryComponentNames.has(componentName)) {
        return;
      }

      const baseComponent = baseComponentRef
        ? libraryData.baseComponents?.[baseComponentRef]
        : undefined;
      const resolvedComponent: Partial<IndividualComponent> = {
        ...(baseComponent || {}),
        ...component,
      };

      // Verify sidebar is enabled if component uses sidebar locations
      const sidebarDisabled = !(resolvedComponent.withSidebar ?? studyConfig.uiConfig.withSidebar);
      const isUsingSidebar = resolvedComponent.instructionLocation === 'sidebar'
        || resolvedComponent.nextButtonLocation === 'sidebar'
        || resolvedComponent.response?.some((r) => 'location' in r && r.location === 'sidebar');

      if (sidebarDisabled && isUsingSidebar) {
        const instancePath = ownWithSidebar === false
          ? `/importedLibraries/${library}/components/`
          : baseComponent?.withSidebar === false
            ? `/importedLibraries/${library}/baseComponents/`
            : `/importedLibraries/${library}/uiConfig/`;
        warnings.push({
          message: `Component \`${componentName}\` in library \`${library}\` uses sidebar locations but sidebar is disabled`,
          instancePath,
          params: { action: 'Enable the sidebar or move the location to belowStimulus or aboveStimulus' },
          category: 'disabled-sidebar',
        });
      }
    });
  });
}

// This verifies that the library config has a valid schema and returns the parsed data
function parseLibraryConfig(fileData: string, libraryName: string): ParsedConfig<LibraryConfig> {
  let validatedData = false;
  let data: LibraryConfig | undefined;

  try {
    data = JSON.parse(fileData);
    validatedData = libraryValidate(data) as boolean;
  } catch {
    validatedData = false;
  }

  const errors: Required<ParsedConfig<LibraryConfig>>['errors'] = [];
  const warnings: Required<ParsedConfig<LibraryConfig>>['warnings'] = [];

  if (!data) {
    errors.push({
      message: `Could not find library \`${libraryName}\``,
      instancePath: 'root',
      params: { action: 'Make sure the library is in the correct location' },
      category: 'undefined-library',
    });
  } else if (!validatedData) {
    errors.push({
      message: `Library \`${libraryName}\` config is not valid`,
      instancePath: `/importedLibraries/${libraryName}`,
      params: { action: 'Fix the errors in the library config' },
      category: 'invalid-library-config',
    });
  }

  return { ...data as LibraryConfig, errors, warnings };
}

async function getLibraryConfig(libraryName: string) {
  const config = await (await fetch(`${PREFIX}libraries/${libraryName}/config.json`)).text();
  return parseLibraryConfig(config, libraryName);
}

export async function loadLibrariesParseNamespace(importedLibraries: string[], errors: ParserErrorWarning[], warnings: ParserErrorWarning[]) {
  const loadedLibraries = importedLibraries.map(async (library) => {
    const libraryData = await getLibraryConfig(library);
    if (libraryData.errors) {
      errors.push(...libraryData.errors);
    }
    if (libraryData.warnings) {
      warnings.push(...libraryData.warnings);
    }

    return [library, libraryData];
  });
  const importedLibrariesData: Record<string, ParsedConfig<LibraryConfigWithInheritanceMetadata>> = Object.fromEntries(await Promise.all(loadedLibraries));

  // Filter out the missing imported libraries
  Object.entries(importedLibrariesData).forEach(([libraryName, libraryData]) => {
    if (!libraryData.components) {
      delete importedLibrariesData[libraryName];
    }
  });

  // Namespace the components object with the library name, and inherit the base components
  importedLibraries.forEach((libraryName) => {
    if (!importedLibrariesData[libraryName]) {
      return;
    }
    const inheritedComponentMetadata: Record<string, { baseComponent: string; withSidebar?: boolean }> = {};

    importedLibrariesData[libraryName].components = Object.fromEntries(
      Object.entries(importedLibrariesData[libraryName].components).map(([componentName, component]) => {
        const namespacedComponentName = `$${libraryName}.components.${componentName}`;
        if (isInheritedComponent(component)) {
          inheritedComponentMetadata[namespacedComponentName] = {
            baseComponent: component.baseComponent,
            ...(component.withSidebar !== undefined ? { withSidebar: component.withSidebar } : {}),
          };
          const mergedComponent = mergeComponentConfigs(
            importedLibrariesData[libraryName].baseComponents?.[component.baseComponent],
            component,
          ) as IndividualComponent & { baseComponent?: string };
          delete mergedComponent.baseComponent;
          return [namespacedComponentName, mergedComponent];
        }
        return [namespacedComponentName, component];
      }),
    );
    if (Object.keys(inheritedComponentMetadata).length > 0) {
      importedLibrariesData[libraryName].__revisitInheritedComponentMetadata = inheritedComponentMetadata;
    }
  });

  return importedLibrariesData;
}
