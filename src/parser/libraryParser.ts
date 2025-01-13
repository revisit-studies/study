import { parse as hjsonParse } from 'hjson';
import Ajv from 'ajv';
import { merge } from 'lodash';
import librarySchema from './LibraryConfigSchema.json';
import {
  IndividualComponent, LibraryConfig, ParsedConfig, ParserErrorWarning, StudyConfig,
} from './types';
import { isInheritedComponent } from './utils';
import { PREFIX } from '../utils/Prefix';

const ajv = new Ajv();
ajv.addSchema(librarySchema);
const libraryValidate = ajv.getSchema<LibraryConfig>('#/definitions/LibraryConfig')!;

function namespaceLibrarySequenceComponents(sequence: StudyConfig['sequence'], libraryName: string): StudyConfig['sequence'] {
  return {
    ...sequence,
    components: sequence.components.map((component) => {
      if (typeof component === 'object') {
        return namespaceLibrarySequenceComponents(component, libraryName);
      }
      return `$${libraryName}.components.${component}`;
    }),
  };
}

// Recursively iterate through sequences (sequence.components) and replace any library sequence references with the actual library sequence
export function expandLibrarySequences(sequence: StudyConfig['sequence'], importedLibrariesData: Record<string, LibraryConfig>, errors: ParserErrorWarning[] = []): StudyConfig['sequence'] {
  return {
    ...sequence,
    components: sequence.components.map((component) => {
      if (typeof component === 'object') {
        return expandLibrarySequences(component, importedLibrariesData);
      }
      // eslint-disable-next-line no-nested-ternary
      const seOrSequences = component.includes('.se.')
        ? '.se.'
        : (component.includes('.sequences.') ? '.sequences.' : false);
      if (typeof component === 'string' && component.startsWith('$') && seOrSequences) {
        const [libraryName, sequenceName] = component.split(seOrSequences);
        // Remove the $ from the library name
        const cleanLibraryName = libraryName.slice(1);

        // Check if the library is in the imported libraries
        if (!importedLibrariesData[cleanLibraryName]) {
          const error: ParserErrorWarning = {
            message: `Library ${cleanLibraryName} not found in imported libraries`,
            instancePath: '',
            params: { action: 'check the library name' },
          };
          errors.push(error);
          return component;
        }

        const library = importedLibrariesData[cleanLibraryName];

        let librarySequence = library.sequences[sequenceName];
        if (!librarySequence) {
          const error: ParserErrorWarning = {
            message: `Sequence ${sequenceName} not found in library ${libraryName}`,
            instancePath: '',
            params: { action: 'check the sequence name' },
          };
          errors.push(error);
          return component;
        }

        // Iterate through the library sequence and namespace the components with the library name
        librarySequence = namespaceLibrarySequenceComponents(librarySequence, cleanLibraryName);

        return librarySequence;
      }

      return component;
    }),
  };
}

// This function verifies that the library usage in the study config is valid
export function verifyLibraryUsage(studyConfig: StudyConfig, errors: ParserErrorWarning[], importedLibrariesData: Record<string, LibraryConfig>) {
  Object.entries(importedLibrariesData).forEach(([library, libraryData]) => {
    // Verify that the library components are well defined
    Object.entries(libraryData.components).forEach(([componentName, component]) => {
      // Verify baseComponent is defined in baseComponents object
      if (isInheritedComponent(component) && !libraryData.baseComponents?.[component.baseComponent]) {
        errors.push({
          message: `Base component \`${component.baseComponent}\` is not defined in baseComponents object in library \`${library}\``,
          instancePath: `/importedLibraries/${library}/components/${componentName}`,
          params: { action: 'add the base component to the baseComponents object' },
        });
      }
    });
  });
}

// This verifies that the library config has a valid schema and returns the parsed data
export function parseLibraryConfig(fileData: string, libraryName: string): ParsedConfig<LibraryConfig> {
  let validatedData = false;
  let data: LibraryConfig | undefined;

  try {
    data = hjsonParse(fileData);
    validatedData = libraryValidate(data) as boolean;
  } catch {
    validatedData = false;
  }

  const errors: Required<ParsedConfig<LibraryConfig>>['errors'] = [];
  const warnings: Required<ParsedConfig<LibraryConfig>>['warnings'] = [];

  if (!data) {
    errors.push({
      message: `Could not find library \`${libraryName}\``,
      instancePath: '/importedLibraries/',
      params: { action: 'make sure the library is in the correct location' },
    });
  } else if (!validatedData) {
    errors.push({
      message: 'Library config is not valid',
      instancePath: '',
      params: { action: 'fix the errors in the library config' },
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
          return [
            [`$${libraryName}.components.${componentName}`, mergedComponent],
            [`$${libraryName}.co.${componentName}`, mergedComponent],
          ] as [string, IndividualComponent][];
        }
        return [
          [`$${libraryName}.components.${componentName}`, component],
          [`$${libraryName}.co.${componentName}`, component],
        ] as [string, IndividualComponent][];
      })
      // spread double array to single array for Object.fromEntries
        .reduce((acc, [key, value]) => {
          acc.push(key, value);
          return acc;
        }, []),
    );
  });

  return importedLibrariesData;
}
