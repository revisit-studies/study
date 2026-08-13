import Ajv from 'ajv';
import isEqual from 'lodash.isequal';
import merge from 'lodash.merge';
import librarySchema from './LibraryConfigSchema.json';
import {
  ComponentBlock, Factor, FactorBlock, FactorOption, FactorValue, IndividualComponent, LibraryConfig, ParsedConfig, ParserErrorWarning, StudyConfig,
} from './types';
import {
  FactorPlanBlock, isDynamicBlock, isFactorBlock, isInheritedComponent,
} from './utils';
import { PREFIX } from '../utils/Prefix';
import { getSequenceFlatMapWithInterruptions } from '../utils/getSequenceFlatMap';

const ajv = new Ajv({ allowUnionTypes: true });
ajv.addSchema(librarySchema);
const libraryValidate = ajv.getSchema<LibraryConfig>('#/definitions/LibraryConfig')!;

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

function namespaceLibrarySequenceComponents(sequence: StudyConfig['sequence'], libraryName: string): StudyConfig['sequence'] {
  if (isDynamicBlock(sequence) || isFactorBlock(sequence)) {
    return sequence;
  }
  return {
    ...sequence,
    components: sequence.components.map((component) => {
      if (typeof component === 'object') {
        return namespaceLibrarySequenceComponents(component, libraryName);
      }
      // Only namespace if not already namespaced
      if (typeof component === 'string' && !component.startsWith('$')) {
        return `$${libraryName}.components.${component}`;
      }
      return component;
    }),
  };
}

// 1. Replace ${var} in a single string
export function fillTemplate(str: string, vars: Record<string, unknown>): string {
  const fillBracedToken = (match: string, key: string) => (vars[key] !== undefined && vars[key] !== null
    ? String(vars[key])
    : match);
  const fillAtToken = (match: string, prefix: string, key: string) => (vars[key] !== undefined && vars[key] !== null
    ? `${prefix}${String(vars[key])}`
    : match);

  return str
    .replace(/\$\{(\w+)\}/g, fillBracedToken)
    .replace(/(^|[^A-Za-z0-9_@])@([A-Za-z_]\w*)\b/g, fillAtToken);
}

// 2. Recursively replace in any TS value
export function deepFillTemplate<T>(value: T, vars: Record<string, unknown>): T {
  // Strings: apply template replacement
  if (typeof value === 'string') {
    const exactToken = value.match(/^@([A-Za-z_]\w*)$/);
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

type FactorCondition = Record<string, FactorValue>;
type FactorResolution = {
  conditions: FactorCondition[];
  numSamples?: number;
};
type FactorCompileResult = {
  sequence: StudyConfig['sequence'];
  components: Record<string, IndividualComponent>;
};

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

function mergeFactorConditions(
  left: FactorCondition,
  right: FactorCondition,
  errors: ParserErrorWarning[],
): FactorCondition | null {
  const conflict = Object.keys(left).find(
    (name) => Object.hasOwn(right, name) && !Object.is(left[name], right[name]),
  );

  if (conflict) {
    addFactorError(errors, `Factor \`${conflict}\` has conflicting values in one condition`);
    return null;
  }

  return { ...left, ...right };
}

function crossFactorConditions(
  conditionSets: FactorCondition[][],
  errors: ParserErrorWarning[],
): FactorCondition[] {
  return conditionSets.reduce<FactorCondition[]>((conditions, nextConditions) => (
    conditions.flatMap((condition) => nextConditions.flatMap((nextCondition) => {
      const merged = mergeFactorConditions(condition, nextCondition, errors);
      return merged ? [merged] : [];
    }))
  ), [{}]);
}

function zipFactorConditions(
  conditionSets: FactorCondition[][],
  factorName: string,
  errors: ParserErrorWarning[],
): FactorCondition[] {
  const lengths = conditionSets.map((conditions) => conditions.length);
  if (new Set(lengths).size > 1) {
    addFactorError(
      errors,
      `Zip factor \`${factorName}\` requires inputs with equal lengths; received ${lengths.join(', ')}`,
    );
    return [];
  }

  return Array.from({ length: lengths[0] ?? 0 }, (_, index) => (
    conditionSets.reduce<FactorCondition | null>((condition, conditions) => (
      condition ? mergeFactorConditions(condition, conditions[index], errors) : null
    ), {})
  )).filter((condition): condition is FactorCondition => condition !== null);
}

function resolveFactor(
  factorSource: FactorOption,
  factors: Record<string, Factor>,
  errors: ParserErrorWarning[] = [],
  stack: string[] = [],
  expressionName = 'inline',
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
    return { conditions: factor.map((value) => ({ [factorName]: value })) };
  }

  const { action, factors: inputs } = factor;
  if (inputs.length === 0) {
    addFactorError(errors, `Factor expression \`${factorName}\` must reference at least one factor`);
    return { conditions: [] };
  }

  const resolutions = inputs.map((input, index) => (
    resolveFactor(
      input,
      factors,
      errors,
      typeof factorSource === 'string' ? [...stack, factorSource] : stack,
      `${factorName}.${action}[${index}]`,
    )
  ));
  if (resolutions.some((resolution) => resolution.numSamples !== undefined)) {
    addFactorError(
      errors,
      `Factor expression \`${factorName}\` cannot nest a sampled factor`,
    );
    return { conditions: [] };
  }

  const conditionSets = resolutions.map((resolution) => resolution.conditions);
  if (action === 'cross') {
    return { conditions: crossFactorConditions(conditionSets, errors) };
  }
  if (action === 'zip') {
    return { conditions: zipFactorConditions(conditionSets, factorName, errors) };
  }

  const conditions = conditionSets.flat();
  if (action === 'concat') {
    return { conditions };
  }
  if (factor.action === 'repeat') {
    if (!Number.isInteger(factor.numRepeats) || factor.numRepeats < 1) {
      addFactorError(errors, `Repeat factor \`${factorName}\` requires a positive integer numRepeats`);
      return { conditions: [] };
    }
    return {
      conditions: Array.from({ length: factor.numRepeats }, () => conditions).flat(),
    };
  }

  if (factor.action !== 'sample') {
    return { conditions };
  }
  if (!Number.isInteger(factor.numSamples) || factor.numSamples < 1) {
    addFactorError(errors, `Sample factor \`${factorName}\` requires a positive integer numSamples`);
    return { conditions: [] };
  }
  if (factor.numSamples > conditions.length) {
    addFactorError(
      errors,
      `Sample factor \`${factorName}\` cannot select ${factor.numSamples} conditions from ${conditions.length}`,
    );
    return { conditions: [] };
  }
  return { conditions, numSamples: factor.numSamples };
}

export function resolveFactorConditions(
  factorSource: FactorOption,
  factors: Record<string, Factor>,
  errors: ParserErrorWarning[] = [],
  stack: string[] = [],
  expressionName = 'inline',
): FactorCondition[] {
  const resolution = resolveFactor(factorSource, factors, errors, stack, expressionName);
  if (resolution.numSamples !== undefined) {
    addFactorError(
      errors,
      `Sample factor \`${typeof factorSource === 'string' ? factorSource : expressionName}\` must be materialized by a factor block`,
    );
    return [];
  }
  return resolution.conditions;
}

export function createFactorConditionId(
  blockId: string,
  condition: FactorCondition,
): string {
  const conditionId = Object.entries(condition)
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`)
    .join('__');
  return conditionId ? `${encodeURIComponent(blockId)}__${conditionId}` : encodeURIComponent(blockId);
}

function compileFactorBlock(
  block: FactorBlock,
  config: StudyConfig,
  errors: ParserErrorWarning[],
): FactorCompileResult {
  const components: Record<string, IndividualComponent> = {};
  const baseComponents = typeof block.components === 'string'
    ? [block.components]
    : block.components;
  const materializedConditions = new Map<string, string[]>();
  const materializeCondition = (condition: FactorCondition): string[] => {
    const conditionId = createFactorConditionId(block.id, condition);
    const existing = materializedConditions.get(conditionId);
    if (existing) {
      return existing;
    }

    const conflict = Object.keys(condition).find(
      (name) => block.parameters
        && Object.hasOwn(block.parameters, name)
        && !Object.is(block.parameters[name], condition[name]),
    );
    if (conflict) {
      addFactorError(
        errors,
        `Factor block \`${block.id}\` parameter \`${conflict}\` conflicts with its factor value`,
        '/sequence/',
      );
      return [];
    }

    const conditionComponentIds = baseComponents.flatMap((baseComponent) => {
      const template = config.baseComponents?.[baseComponent];
      if (!template) {
        addFactorError(
          errors,
          `Factor block \`${block.id}\` references undefined base component \`${baseComponent}\``,
          '/sequence/',
        );
        return [];
      }

      const parameters = {
        ...('parameters' in template ? template.parameters : {}),
        ...block.parameters,
        ...condition,
      };
      const componentId = `${conditionId}__${encodeURIComponent(baseComponent)}`;
      const component = deepFillTemplate(
        merge({}, template, { parameters }),
        parameters,
      ) as IndividualComponent;

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
      return [componentId];
    });
    materializedConditions.set(conditionId, conditionComponentIds);
    return conditionComponentIds;
  };

  const resolution = resolveFactor(block.factor, config.factors || {}, errors, [], block.id);
  let sequenceComponents: ComponentBlock['components'];
  let order = block.order ?? 'fixed';

  if (resolution.numSamples === undefined) {
    sequenceComponents = resolution.conditions.flatMap(materializeCondition);
  } else {
    if (block.order !== undefined) {
      addFactorError(
        errors,
        `Factor block \`${block.id}\` materializes a sample and cannot also define \`order\``,
        '/sequence/',
      );
    }
    sequenceComponents = resolution.conditions.map((condition): FactorPlanBlock => ({
      type: 'factor-plan',
      order: 'fixed',
      components: materializeCondition(condition),
    }));
    order = 'random';
  }

  return {
    sequence: {
      id: block.id,
      order,
      components: sequenceComponents,
      ...(resolution.numSamples !== undefined ? { numSamples: resolution.numSamples } : {}),
      ...(block.interruptions !== undefined ? { interruptions: block.interruptions } : {}),
      ...(block.skip !== undefined ? { skip: block.skip } : {}),
      ...(block.conditional !== undefined ? { conditional: block.conditional } : {}),
    },
    components,
  };
}

export function compileFactorBlocks(
  sequence: StudyConfig['sequence'],
  config: StudyConfig,
  errors: ParserErrorWarning[] = [],
): FactorCompileResult {
  if (isDynamicBlock(sequence)) {
    return { sequence, components: {} };
  }
  if (isFactorBlock(sequence)) {
    return compileFactorBlock(sequence, config, errors);
  }

  const components: Record<string, IndividualComponent> = {};
  const compiledSequence: ComponentBlock = {
    ...sequence,
    components: sequence.components.map((component) => {
      if (typeof component === 'string') {
        return component;
      }

      const compiled = compileFactorBlocks(component, config, errors);
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
 * inheritance and templates such as `@vis` and `${vis}` before the Redux store is created.
 */
export function materializeParticipantConfig(
  config: StudyConfig,
  globalParameters: Record<string, unknown>,
): StudyConfig {
  const components = Object.fromEntries(
    Object.entries(config.components).map(([componentId, component]) => {
      const inheritedComponent = isInheritedComponent(component) && config.baseComponents
        ? merge({}, config.baseComponents[component.baseComponent], component)
        : component;
      const parameters = {
        ...('parameters' in inheritedComponent ? inheritedComponent.parameters : {}),
        ...globalParameters,
      };
      return [
        componentId,
        deepFillTemplate({ ...inheritedComponent, parameters }, parameters),
      ];
    }),
  );

  return { ...config, components };
}

export function validateBetweenSubjects(
  config: StudyConfig,
  warnings: ParserErrorWarning[] = [],
) {
  config.betweenSubjects?.forEach((factorName, index) => {
    const factor = config.factors?.[factorName];
    const instancePath = `/betweenSubjects/${index}`;

    if (!factor || !Array.isArray(factor) || factor.length === 0) {
      warnings.push({
        message: !factor
          ? `Between-subjects factor \`${factorName}\` is not defined in factors`
          : `Between-subjects factor \`${factorName}\` must be a non-empty primitive factor`,
        instancePath,
        params: { action: 'Use a non-empty primitive factor defined in factors' },
        category: 'sequence-validation',
      });
    }
  });
}

// Recursively iterate through sequences (sequence.components) and replace any library sequence references with the actual library sequence
export function expandLibrarySequences(sequence: StudyConfig['sequence'], importedLibrariesData: Record<string, LibraryConfig>, errors: ParserErrorWarning[] = []): StudyConfig['sequence'] {
  if (isDynamicBlock(sequence) || isFactorBlock(sequence)) {
    return sequence;
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
          const mergedComponent = merge(
            {},
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
