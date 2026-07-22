import Ajv from 'ajv';
import merge from 'lodash.merge';
import librarySchema from './LibraryConfigSchema.json';
import {
  ComponentBlock, FactorDefinition, FactorSequence, FactorSequenceReference, IndividualComponent, LibraryConfig, ParsedConfig, ParserErrorWarning, StudyConfig,
} from './types';
import {
  isDynamicBlock, isFactorDefinition, isFactorSequence, isFactorSequenceReference, isInheritedComponent,
} from './utils';
import { PREFIX } from '../utils/Prefix';
import { getFactorCombinations } from '../utils/handleRandomSequences';
import { findAllFactorSequences, getSequenceFlatMapWithInterruptions } from '../utils/getSequenceFlatMap';

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
  if (isDynamicBlock(sequence) || isFactorSequence(sequence) || isFactorSequenceReference(sequence)) {
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
  const fillBracedToken = (_: string, key: string) => (vars[key] !== undefined && vars[key] !== null
    ? String(vars[key])
    : '');
  const fillAtToken = (match: string, prefix: string, key: string) => (vars[key] !== undefined && vars[key] !== null
    ? `${prefix}${String(vars[key])}`
    : match);

  return str
    .replace(/\$\{(\w+)\}/g, fillBracedToken)
    .replace(/(^|[^A-Za-z0-9_@])@([A-Za-z_]\w*)\b/g, fillAtToken);
}

// 2. Recursively replace in any TS value
export function deepFillTemplate<T>(value: T, vars: Record<string, string>): T {
  // Strings: apply template replacement
  if (typeof value === 'string') {
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

function factorSequenceFromReference(
  reference: FactorSequenceReference,
  definition: FactorDefinition,
): FactorSequence {
  const parameters = reference.parameters ?? definition.parameters;
  const factorSequence: FactorSequence = {
    type: 'factor',
    id: reference.id ?? reference.factor,
    action: definition.action,
    order: reference.order ?? definition.order,
    numRepeats: definition.numRepeats,
    factorsToCross: definition.factorsToCross,
    component: reference.component,
  };

  if (parameters !== undefined) {
    factorSequence.parameters = parameters;
  }

  return factorSequence;
}

export function resolveFactorReferences(
  sequence: StudyConfig['sequence'],
  factors: StudyConfig['factors'] = {},
  errors: ParserErrorWarning[] = [],
): StudyConfig['sequence'] {
  if (isDynamicBlock(sequence) || isFactorSequence(sequence)) {
    return sequence;
  }

  if (isFactorSequenceReference(sequence)) {
    const factor = factors[sequence.factor];

    if (!factor) {
      errors.push({
        message: `Factor \`${sequence.factor}\` is not defined in factors`,
        instancePath: '/sequence/',
        params: { action: 'Add the factor to factors or update the reference name' },
        category: 'sequence-validation',
      });

      return {
        id: sequence.id ?? sequence.factor,
        order: 'fixed',
        components: [],
      };
    }

    if (!isFactorDefinition(factor)) {
      errors.push({
        message: `Factor \`${sequence.factor}\` is a primitive factor and cannot be used as a sequence factor`,
        instancePath: '/sequence/',
        params: { action: 'Reference a derived factor definition from the sequence' },
        category: 'sequence-validation',
      });

      return {
        id: sequence.id ?? sequence.factor,
        order: 'fixed',
        components: [],
      };
    }

    return factorSequenceFromReference(sequence, factor);
  }

  return {
    ...sequence,
    components: sequence.components.map((component) => (
      typeof component === 'object'
        ? resolveFactorReferences(component, factors, errors)
        : component
    )),
  };
}

function addFactorError(errors: ParserErrorWarning[], message: string) {
  if (errors.some((error) => error.instancePath === '/factors/' && error.message === message)) {
    return;
  }

  errors.push({
    message,
    instancePath: '/factors/',
    params: { action: 'Check that referenced factors are defined and do not form cycles' },
    category: 'sequence-validation',
  });
}

function hasRandomFactorSampling(
  definition: FactorDefinition,
  factors: StudyConfig['factors'] = {},
  visitedFactors = new Set<string>(),
): boolean {
  if (
    definition.order === 'random'
    && definition.factorsToCross.some((factorReference) => factorReference.numSamples !== undefined)
  ) {
    return true;
  }

  return definition.factorsToCross.some((factorReference) => {
    if (visitedFactors.has(factorReference.factor)) {
      return false;
    }

    const factor = factors[factorReference.factor];
    if (!isFactorDefinition(factor)) {
      return false;
    }

    const nextVisitedFactors = new Set(visitedFactors);
    nextVisitedFactors.add(factorReference.factor);
    return hasRandomFactorSampling(factor, factors, nextVisitedFactors);
  });
}

export function validateFactorGraph(
  factors: StudyConfig['factors'] = {},
  errors: ParserErrorWarning[] = [],
) {
  const visitedFactors = new Set<string>();
  const visitingFactors = new Set<string>();
  const reportedCycles = new Set<string>();

  const visit = (factorName: string, path: string[]) => {
    const factor = factors[factorName];

    if (!isFactorDefinition(factor)) {
      return;
    }

    if (visitingFactors.has(factorName)) {
      const cycleStart = path.indexOf(factorName);
      const cycle = path.slice(cycleStart);
      const cycleKey = cycle.join(' -> ');

      if (!reportedCycles.has(cycleKey)) {
        reportedCycles.add(cycleKey);
        addFactorError(errors, `Circular factor reference: ${cycleKey}`);
      }
      return;
    }

    if (visitedFactors.has(factorName)) {
      return;
    }

    visitingFactors.add(factorName);

    factor.factorsToCross.forEach((factorReference) => {
      const referencedFactor = factors[factorReference.factor];

      if (!referencedFactor) {
        addFactorError(
          errors,
          `Factor \`${factorReference.factor}\` referenced by factor \`${factorName}\` is not defined in factors`,
        );
        return;
      }

      if (isFactorDefinition(referencedFactor)) {
        visit(factorReference.factor, [...path, factorReference.factor]);
      }
    });

    visitingFactors.delete(factorName);
    visitedFactors.add(factorName);
  };

  Object.keys(factors).forEach((factorName) => visit(factorName, [factorName]));
}

export function validateBetweenSubjectsFactors(
  config: StudyConfig,
  warnings: ParserErrorWarning[] = [],
) {
  config.betweenSubjectsFactors?.forEach((factorName, index) => {
    const factor = config.factors?.[factorName];
    const instancePath = `/betweenSubjectsFactors/${index}`;

    if (!factor) {
      warnings.push({
        message: `Between-subjects factor \`${factorName}\` is not defined in factors`,
        instancePath,
        params: { action: 'Add the factor to factors or remove it from betweenSubjectsFactors' },
        category: 'sequence-validation',
      });
      return;
    }

    if (isFactorDefinition(factor)) {
      warnings.push({
        message: `Between-subjects factor \`${factorName}\` must be a primitive factor with levels`,
        instancePath,
        params: { action: 'Use a primitive factor level array in betweenSubjectsFactors' },
        category: 'sequence-validation',
      });
      return;
    }

    if (factor.length === 0) {
      warnings.push({
        message: `Between-subjects factor \`${factorName}\` has no levels`,
        instancePath,
        params: { action: 'Add at least one level to this factor or remove it from betweenSubjectsFactors' },
        category: 'sequence-validation',
      });
    }
  });
}

export function createFactorComponents(config: StudyConfig): Record<string, IndividualComponent> {
  const factorSequences = findAllFactorSequences(config.sequence);

  if (!config.factors || !config.baseComponents) {
    return {};
  }

  const newComponents: Record<string, IndividualComponent> = {};

  factorSequences.forEach((block) => {
    const baseComponent = config.baseComponents![block.component];

    const allCombs = getFactorCombinations(
      block,
      config.factors!,
      undefined,
      [],
      { expandPossibleSamples: true, ignoreNumSamples: true },
    );

    allCombs.forEach((c) => {
      const baseParameters = baseComponent && 'parameters' in baseComponent && baseComponent.parameters
        ? baseComponent.parameters
        : {};
      const parameters = block.parameters ?? { ...baseParameters, ...c[1] };
      const component = merge(
        {},
        baseComponent,
        { parameters },
      );
      newComponents[c[0]] = deepFillTemplate(component, c[1]) as IndividualComponent;
    });
  });

  return newComponents;
}

export function expandFactorSequences(
  sequence: StudyConfig['sequence'],
  importedLibrariesData: Record<string, LibraryConfig>,
  factors: NonNullable<StudyConfig['factors']>,
  errors: ParserErrorWarning[] = [],
): StudyConfig['sequence'] {
  if (isDynamicBlock(sequence) || isFactorSequenceReference(sequence)) {
    return sequence;
  }

  if (isFactorSequence(sequence)) {
    if (hasRandomFactorSampling(sequence, factors)) {
      return sequence;
    }

    const componentsToCross = getFactorCombinations(
      sequence,
      factors,
      (message) => addFactorError(errors, message),
    );

    return {
      id: sequence.id,
      order: sequence.order ?? 'fixed',
      components: componentsToCross.map((c) => c[0]),
      skip: [],
    };
  }

  return {
    ...sequence,
    components: (sequence.components || []).map((component) => {
      if (typeof component === 'object') {
        return expandFactorSequences(component, importedLibrariesData, factors, errors);
      }

      return component;
    }),
  };
}

// Recursively iterate through sequences (sequence.components) and replace any library sequence references with the actual library sequence
export function expandLibrarySequences(sequence: StudyConfig['sequence'], importedLibrariesData: Record<string, LibraryConfig>, errors: ParserErrorWarning[] = []): StudyConfig['sequence'] {
  if (isDynamicBlock(sequence) || isFactorSequence(sequence) || isFactorSequenceReference(sequence)) {
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
