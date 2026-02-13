import Ajv from 'ajv';
import merge from 'lodash.merge';
import librarySchema from './LibraryConfigSchema.json';
import {
  ComponentBlock, IndividualComponent, LibraryConfig, ParsedConfig, ParserErrorWarning, StudyConfig,
} from './types';
import { isDynamicBlock, isInheritedComponent } from './utils';
import { PREFIX } from '../utils/Prefix';

const ajv = new Ajv({ allowUnionTypes: true });
ajv.addSchema(librarySchema);
const libraryValidate = ajv.getSchema<LibraryConfig>('#/definitions/LibraryConfig')!;

type SequenceWithImportReference = StudyConfig['sequence'] & {
  __revisitImportedSequenceRef?: string;
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
  if (isDynamicBlock(sequence)) {
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

// Recursively iterate through sequences (sequence.components) and replace any library sequence references with the actual library sequence
export function expandLibrarySequences(sequence: StudyConfig['sequence'], importedLibrariesData: Record<string, LibraryConfig>, errors: ParserErrorWarning[] = []): StudyConfig['sequence'] {
  if (isDynamicBlock(sequence)) {
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
export function verifyLibraryUsage(studyConfig: StudyConfig, errors: ParserErrorWarning[], warnings: ParserErrorWarning[], importedLibrariesData: Record<string, LibraryConfig>) {
  Object.entries(importedLibrariesData).forEach(([library, libraryData]) => {
    // Verify that the library components are well defined
    Object.entries(libraryData.components).forEach(([componentName, component]) => {
      // Verify baseComponent is defined in baseComponents object
      if (isInheritedComponent(component) && !libraryData.baseComponents?.[component.baseComponent]) {
        errors.push({
          message: `Base component \`${component.baseComponent}\` is not defined in baseComponents object in library \`${library}\``,
          instancePath: `/importedLibraries/${library}/baseComponents/`,
          params: { action: 'Add the base component to the baseComponents object' },
          category: 'undefined-base-component',
        });
      }

      // Verify sidebar is enabled if component uses sidebar locations
      const sidebarDisabled = !(component.withSidebar ?? studyConfig.uiConfig.withSidebar);
      const isUsingSidebar = ('instructionLocation' in component && component.instructionLocation === 'sidebar')
        || ('nextButtonLocation' in component && component.nextButtonLocation === 'sidebar')
        || ('response' in component && component.response?.some((r) => 'location' in r && r.location === 'sidebar'));

      if (sidebarDisabled && isUsingSidebar) {
        const instancePath = component.withSidebar === false ? `/importedLibraries/${library}/components/` : `/importedLibraries/${library}/uiConfig/`;
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
  const importedLibrariesData: Record<string, ParsedConfig<LibraryConfig>> = Object.fromEntries(await Promise.all(loadedLibraries));

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
    importedLibrariesData[libraryName].components = Object.fromEntries(
      Object.entries(importedLibrariesData[libraryName].components).map(([componentName, component]) => {
        if (isInheritedComponent(component)) {
          const mergedComponent = merge({}, importedLibrariesData[libraryName].baseComponents![component.baseComponent], component) as IndividualComponent & { baseComponent?: string };
          delete mergedComponent.baseComponent;
          return [`$${libraryName}.components.${componentName}`, mergedComponent];
        }
        return [`$${libraryName}.components.${componentName}`, component];
      }),
    );
  });

  return importedLibrariesData;
}
