import Ajv from 'ajv';
import isEqual from 'lodash.isequal';
import merge from 'lodash.merge';
import librarySchema from './LibraryConfigSchema.json';
import studySchema from './StudyConfigSchema.json';
import {
  ComponentBlock, ComponentOrder, Factor, FactorBlock, FactorObject, FactorObjectValue, FactorOption, FactorValue, IndividualComponent, LibraryConfig, OrderedFactorValues, ParsedConfig, ParserErrorWarning, StudyConfig,
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
type FactorParameterNames = Record<string, string>;
type FactorResolution = {
  conditions: FactorCondition[];
  // Materialization retains all possible values. Track the selected count for
  // diagnostics; null means runtime filtering makes that count unpredictable.
  runtimeCount?: number | null;
  numSamples?: number;
  samplingStrategy?: 'withoutReplacement' | 'withReplacement';
  // Retain source names for unaliased keep/remove selectors after composition.
  selectionParameterNames?: FactorParameterNames;
  hasRuntimeOrder?: boolean;
  hasRuntimeSample?: boolean;
};
type FactorResolutionMode = 'standard' | 'materialize' | 'runtime';

export type FactorOrderContext = {
  sequenceIndex: number;
  sampledConditions: Map<string, FactorCondition[]>;
  orderedValues: Map<string, FactorValue[]>;
};

export function createFactorOrderContext(sequenceIndex: number): FactorOrderContext {
  return { sequenceIndex, sampledConditions: new Map(), orderedValues: new Map() };
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
  conditions: FactorCondition[],
  numSamples: number,
  samplingStrategy: 'withoutReplacement' | 'withReplacement',
  context?: FactorOrderContext,
): FactorCondition[] {
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

function mergeFactorSelectionParameterNames(
  resolutions: FactorResolution[],
  combinesInputs: boolean,
  parameterNames: FactorParameterNames = {},
): FactorParameterNames | undefined {
  if (Object.keys(parameterNames).length === 0 && !resolutions.some((resolution) => resolution.selectionParameterNames)) {
    return undefined;
  }
  const publicNames = resolutions.map((resolution) => (
    [...new Set(resolution.conditions.flatMap((condition) => Object.keys(materializeConditionForParameterNames(condition))))]
  ));
  const sourceNames = resolutions.map((resolution, index) => (
    resolution.selectionParameterNames || Object.fromEntries(publicNames[index].map((name) => [name, name]))
  ));
  const qualifyName = (name: string, index: number, inputs: string[][]) => {
    if (!combinesInputs || inputs.filter((names) => names.includes(name)).length < 2) return name;
    return `${name}_${inputs.slice(0, index).filter((names) => names.includes(name)).length}`;
  };
  const sourceKeys = sourceNames.map(Object.keys);
  const names = { ...parameterNames };
  const ambiguous = new Set<string>();
  sourceNames.forEach((sources, index) => {
    Object.entries(sources).forEach(([sourceName, outputName]) => {
      const sourceKey = qualifyName(sourceName, index, sourceKeys);
      const outputKey = qualifyName(outputName, index, publicNames);
      const name = Object.keys(parameterNames).length > 0
        ? parameterNames[outputKey]
        : outputKey;
      if (!name || ambiguous.has(sourceKey)) return;
      if (Object.hasOwn(names, sourceKey) && names[sourceKey] !== name) {
        // The source is shared by differently named inputs; select by public name.
        delete names[sourceKey];
        ambiguous.add(sourceKey);
        return;
      }
      names[sourceKey] = name;
    });
  });

  return names;
}

function createFactorSelectionParameterNames(
  resolutions: FactorResolution[],
  outputNames: string[],
  factorName: string,
  errors: ParserErrorWarning[],
): FactorParameterNames | undefined {
  if (outputNames.length !== resolutions.length) {
    addFactorError(
      errors,
      `Factor expression \`${factorName}\` requires one as name per factor; received ${outputNames.length} names for ${resolutions.length} factors`,
    );
    return undefined;
  }
  if (outputNames.some((name) => name.length === 0) || new Set(outputNames).size !== outputNames.length) {
    addFactorError(errors, `Factor expression \`${factorName}\` requires unique, non-empty as names`);
    return undefined;
  }

  const inputNames = resolutions.map((resolution, index) => {
    const firstCondition = resolution.conditions[0];
    if (!firstCondition) {
      return undefined;
    }
    const materializedFirstCondition = materializeConditionForParameterNames(firstCondition);
    const factorNames = Object.keys(materializedFirstCondition);
    const hasOneScalarInput = factorNames.length === 1
      && resolution.conditions.every((condition) => (
        Object.keys(materializeConditionForParameterNames(condition)).length === 1
        && !Array.isArray(Object.values(materializeConditionForParameterNames(condition))[0])
      ));
    if (!hasOneScalarInput) {
      addFactorError(
        errors,
        `Factor expression \`${factorName}\` cannot apply as name \`${outputNames[index]}\` to an input with multiple parameters`,
      );
      return undefined;
    }
    return [...new Set(resolution.conditions.flatMap((condition) => Object.keys(condition)))];
  });
  if (inputNames.some((name) => name === undefined)) {
    return undefined;
  }

  const names = inputNames as string[][];
  const totals = names.flat().reduce<Record<string, number>>((counts, name) => ({
    ...counts, [name]: (counts[name] || 0) + 1,
  }), {});
  const seen: Record<string, number> = {};
  return names.reduce<FactorParameterNames>((parameterNames, input, index) => {
    input.forEach((name) => {
      const occurrence = seen[name] || 0;
      seen[name] = occurrence + 1;
      const sourceName = totals[name] > 1 ? `${name}_${occurrence}` : name;
      parameterNames[sourceName] = outputNames[index];
    });
    return parameterNames;
  }, {});
}

function getScalarFactorParameterNames(
  resolution: FactorResolution,
): string[] | undefined {
  const parameterNames = resolution.conditions.map((condition) => (
    Object.keys(materializeConditionForParameterNames(condition))
  ));
  if (parameterNames.length === 0 || parameterNames.some((names) => names.length !== 1)) {
    return undefined;
  }
  return [...new Set(parameterNames.flat())];
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

function crossFactorConditions(
  conditionSets: FactorCondition[][],
): FactorCondition[] {
  return conditionSets.reduce<FactorCondition[]>((conditions, nextConditions) => (
    conditions.flatMap((condition) => nextConditions.map((nextCondition) => (
      mergeFactorConditions(condition, nextCondition)
    )))
  ), [{}]);
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
  conditionSets: FactorCondition[][],
  factorName: string,
  errors: ParserErrorWarning[],
  warnings: ParserErrorWarning[],
): FactorCondition[] {
  const lengths = conditionSets.map((conditions) => conditions.length);
  warnZipLengths(lengths, factorName, warnings);

  const length = lengths.length > 0 ? Math.min(...lengths) : 0;
  return Array.from({ length }, (_, index) => (
    conditionSets.reduce<FactorCondition>((condition, conditions) => (
      mergeFactorConditions(condition, conditions[index])
    ), {})
  ));
}

function materializeFactorCondition(
  condition: FactorCondition,
  errors: ParserErrorWarning[],
  parameterNames: FactorParameterNames = {},
): MaterializedFactorCondition {
  return Object.entries(condition).reduce<MaterializedFactorCondition>(
    (materialized, [factorName, value]) => {
      const values = isRepeatedFactorValues(value) ? value.values : [value];
      return values.reduce<MaterializedFactorCondition>((result, factorValue, index) => {
        const sourceName = values.length === 1 ? factorName : `${factorName}_${index}`;
        const parameterName = parameterNames[sourceName] || sourceName;
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

function filterFactorConditionsByAssignment(
  conditions: FactorCondition[],
  assignmentParameters: Record<string, unknown> | undefined,
  errors: ParserErrorWarning[],
): FactorCondition[] {
  if (!assignmentParameters) {
    return conditions;
  }

  return conditions.filter((condition) => {
    const materialized = materializeFactorCondition(condition, errors);
    return Object.entries(assignmentParameters).every(([name, value]) => (
      materialized[name] === undefined || isEqual(materialized[name], value)
    ));
  });
}

function getFactorRuntimeCount(resolution: FactorResolution) {
  return resolution.runtimeCount === undefined ? resolution.conditions.length : resolution.runtimeCount;
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
): FactorResolution {
  if (typeof factorSource === 'string') {
    if (stack.includes(factorSource)) {
      addFactorError(errors, `Circular factor reference: ${[...stack, factorSource].join(' -> ')}`);
      return { conditions: [] };
    }
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
    const conditions = factor.map((value) => (
      typeof value === 'object' && !Array.isArray(value)
        ? { ...value }
        : { [factorName]: value }
    ));
    return {
      conditions: filterFactorConditionsByAssignment(conditions, assignmentParameters, errors),
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
      return filterFactorConditionsByAssignment([condition], assignmentParameters, errors).length > 0;
    });
    const values = orderFactorValues(
      factorName,
      { ...factor, values: eligibleValues },
      errors,
      mode === 'runtime' ? orderContext : undefined,
      mode === 'runtime' ? warnings : [],
    );
    return {
      conditions: values.map((value) => (
        typeof value === 'object' && !Array.isArray(value)
          ? { ...value }
          : { [factorName]: value }
      )),
      runtimeCount: Math.min(eligibleValues.length, factor.numSamples ?? eligibleValues.length),
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
    );

    const itemResolution = hasItems && !Array.isArray(factor.items)
      ? resolveFactor(
        factor.items!,
        factors,
        errors,
        typeof factorSource === 'string' ? [...stack, factorSource] : stack,
        `${factorName}.${factor.action}.items`,
        mode,
        orderContext,
        assignmentParameters,
        warnings,
      )
      : undefined;

    const matchesSelection = (sourceCondition: FactorCondition) => {
      const materializedSource = materializeFactorCondition(
        sourceCondition,
        errors,
      );

      if (hasCondition) {
        return Object.entries(factor.condition!).every(([name, value]) => (
          Object.hasOwn(materializedSource, name) && isEqual(materializedSource[name], value)
        ));
      }

      const items = Array.isArray(factor.items) ? factor.items : itemResolution!.conditions;
      return items.some((item) => isEqual(
        materializedSource,
        materializeFactorCondition(
          item as FactorCondition,
          errors,
          itemResolution?.selectionParameterNames ? {} : resolution.selectionParameterNames,
        ),
      ));
    };

    const conditions = resolution.conditions.filter((sourceCondition) => (
      factor.action === 'keep'
        ? matchesSelection(sourceCondition)
        : !matchesSelection(sourceCondition)
    ));
    const completeInputs = getFactorRuntimeCount(resolution) === resolution.conditions.length
      && (!itemResolution || getFactorRuntimeCount(itemResolution) === itemResolution.conditions.length);
    return {
      conditions,
      runtimeCount: completeInputs ? conditions.length : null,
      selectionParameterNames: resolution.selectionParameterNames,
      hasRuntimeOrder: resolution.hasRuntimeOrder || itemResolution?.hasRuntimeOrder,
      hasRuntimeSample: resolution.hasRuntimeSample
        || itemResolution?.hasRuntimeSample
        || resolution.numSamples !== undefined
        || itemResolution?.numSamples !== undefined,
    };
  }

  const { action, factors: inputs } = factor;
  if (inputs.length === 0) {
    addFactorError(errors, `Factor expression \`${factorName}\` must reference at least one factor`);
    return { conditions: [] };
  }

  const aliasNames = (factor.action === 'cross' || factor.action === 'zip') ? factor.as : undefined;
  let parameterNameResolutions: FactorResolution[] | undefined;
  let inputAssignmentParameters = inputs.map(() => assignmentParameters);
  if (aliasNames !== undefined) {
    const parameterErrors: ParserErrorWarning[] = [];
    parameterNameResolutions = inputs.map((input, index) => (
      resolveFactor(
        input,
        factors,
        parameterErrors,
        typeof factorSource === 'string' ? [...stack, factorSource] : stack,
        `${factorName}.${action}[${index}]`,
        'materialize',
        undefined,
        undefined,
        warnings,
      )
    ));
    parameterErrors.forEach((error) => addFactorError(errors, error.message, error.instancePath));

    const parameterNames = parameterNameResolutions.map((resolution) => (
      getScalarFactorParameterNames(resolution)
    ));
    if (parameterNames.every((names): names is string[] => names !== undefined)) {
      inputAssignmentParameters = parameterNames.map((inputNames, index) => {
        if (!assignmentParameters || !Object.hasOwn(assignmentParameters, aliasNames[index])) {
          return assignmentParameters;
        }
        const mappedAssignment = { ...assignmentParameters };
        delete mappedAssignment[aliasNames[index]];
        inputNames.forEach((inputName) => {
          mappedAssignment[inputName] = assignmentParameters[aliasNames[index]];
        });
        return mappedAssignment;
      });
    }
  }

  const resolutions = inputs.map((input, index) => (
    resolveFactor(
      input,
      factors,
      errors,
      typeof factorSource === 'string' ? [...stack, factorSource] : stack,
      `${factorName}.${action}[${index}]`,
      mode,
      orderContext,
      inputAssignmentParameters[index],
      warnings,
    )
  ));

  const parameterNames = aliasNames !== undefined
    ? createFactorSelectionParameterNames(parameterNameResolutions || resolutions, aliasNames, factorName, errors)
    : undefined;
  if (aliasNames !== undefined && !parameterNames) return { conditions: [] };
  // Apply names to each input before combining, so aliases stay with their values.
  const conditionSets = resolutions.map((resolution, index) => (
    aliasNames === undefined ? resolution.conditions : resolution.conditions.map((condition) => ({
      [aliasNames[index]]: Object.values(materializeFactorCondition(condition, errors))[0],
    }))
  ));
  const counts = resolutions.map(getFactorRuntimeCount);
  const runtimeCounts = counts.every((count): count is number => count !== null) ? counts : null;
  const concatenatedCount = runtimeCounts?.reduce((total, count) => total + count, 0) ?? null;
  const hasRuntimeOrder = resolutions.some((resolution) => resolution.hasRuntimeOrder);
  const hasRuntimeSample = resolutions.some((resolution) => (
    resolution.hasRuntimeSample || resolution.numSamples !== undefined
  ));
  const selectionParameterNames = mergeFactorSelectionParameterNames(resolutions, action === 'cross' || action === 'zip', parameterNames);
  if (action === 'cross') {
    return {
      conditions: crossFactorConditions(conditionSets),
      runtimeCount: runtimeCounts?.reduce((total, count) => total * count, 1) ?? null,
      selectionParameterNames,
      hasRuntimeOrder,
      hasRuntimeSample,
    };
  }
  if (action === 'zip') {
    if (mode === 'materialize' && runtimeCounts && (hasRuntimeOrder || hasRuntimeSample)) {
      warnZipLengths(runtimeCounts, factorName, warnings);
    }
    return {
      conditions: mode === 'materialize' && (hasRuntimeOrder || hasRuntimeSample)
        ? crossFactorConditions(conditionSets)
        : zipFactorConditions(conditionSets, factorName, errors, warnings),
      runtimeCount: runtimeCounts ? Math.min(...runtimeCounts) : null,
      selectionParameterNames,
      hasRuntimeOrder,
      hasRuntimeSample,
    };
  }

  const conditions = conditionSets.flat();
  if (action === 'concat') {
    return {
      conditions, runtimeCount: concatenatedCount, selectionParameterNames, hasRuntimeOrder, hasRuntimeSample,
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
      selectionParameterNames,
      hasRuntimeOrder,
      hasRuntimeSample,
    };
  }

  if (factor.action !== 'sample') {
    return { conditions };
  }
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
  if (mode === 'runtime' && conditions.length === 0) {
    return {
      conditions: [], runtimeCount: 0, selectionParameterNames, hasRuntimeOrder,
    };
  }

  if (
    factor.samplingStrategy === 'withoutReplacement'
    && factor.numSamples > conditions.length
    && mode !== 'runtime'
    && !hasRuntimeSample
  ) {
    addFactorError(
      errors,
      `Sample factor \`${factorName}\` cannot select ${factor.numSamples} conditions from ${conditions.length}`,
    );
    return { conditions: [] };
  }
  if (
    factor.samplingStrategy === 'withoutReplacement'
    && factor.numSamples > conditions.length
  ) {
    addFactorWarning(
      warnings,
      `Sample factor \`${factorName}\` requested ${factor.numSamples} conditions but only ${conditions.length} are available; stopping after the list is exhausted`,
    );
  }
  if (conditions.length === 0) {
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
        conditions,
        factor.numSamples,
        factor.samplingStrategy,
        orderContext,
      ),
      selectionParameterNames,
      hasRuntimeOrder,
    };
  }
  const runtimeCount = factor.samplingStrategy === 'withReplacement'
    ? factor.numSamples : concatenatedCount;
  return {
    conditions,
    runtimeCount: runtimeCount === null ? null : Math.min(factor.numSamples, runtimeCount),
    numSamples: factor.numSamples,
    samplingStrategy: factor.samplingStrategy,
    selectionParameterNames,
    hasRuntimeOrder,
    hasRuntimeSample: hasRuntimeSample || factor.samplingStrategy === 'withReplacement',
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
    materializeFactorCondition(condition, errors)
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
    materializeFactorCondition(condition, errors)
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
    materializeFactorCondition(condition, errors)
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
