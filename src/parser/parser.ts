import Ajv from 'ajv';
import { parseDocument } from 'yaml';
import configSchema from './StudyConfigSchema.json';
import globalSchema from './GlobalConfigSchema.json';
import {
  GlobalConfig, LibraryConfig, ParsedConfig, StudyConfig, ParserErrorWarning, IndividualComponent,
} from './types';
import { getSequenceFlatMapWithInterruptions } from '../utils/getSequenceFlatMap';
import { expandLibrarySequences, loadLibrariesParseNamespace, verifyLibraryUsage } from './libraryParser';
import { isDynamicBlock, isInheritedComponent } from './utils';

const ajv1 = new Ajv({ allowUnionTypes: true });
ajv1.addSchema(globalSchema);
const globalValidate = ajv1.getSchema<GlobalConfig>('#/definitions/GlobalConfig')!;

const ajv2 = new Ajv({ allowUnionTypes: true });
ajv2.addSchema(configSchema);
const studyValidate = ajv2.getSchema<StudyConfig>('#/definitions/StudyConfig')!;

// This function verifies the global config file satisfies conditions that are not covered by the schema
function verifyGlobalConfig(data: GlobalConfig) {
  const errors: { message: string }[] = [];
  const configsListVerified = data.configsList.every((configName) => {
    if (data.configs[configName] === undefined) {
      errors.push({ message: `Config \`${configName}\` is not defined in configs object, but is present in configsList` });
      return false;
    }
    return true;
  });

  return [configsListVerified, errors] as const;
}

export function parseGlobalConfig(fileData: string) {
  const data = JSON.parse(fileData);

  const validatedData = globalValidate(data) as boolean;
  const extraValidation = verifyGlobalConfig(data);

  if (validatedData && extraValidation[0]) {
    return data as GlobalConfig;
  }
  console.error('Global config parsing errors', [...(globalValidate.errors || []), ...extraValidation[1]]);
  throw Error('There was an issue validating your file global.json');
}

// Recursive function to verify that the skip.to component exists after the block it is used in
// When we encounter a skip block, add the skip.to component to the skipTargets array
// When we then encounter a component that is in the skipTargets array, remove it from the array
// Return the array of skipTargets at the end of the sequence
function verifyStudySkip(
  sequence: StudyConfig['sequence'],
  skipTargets: string[],
  errors: ParserErrorWarning[] = [],
  warnings: ParserErrorWarning[] = [],
) {
  const removeTargetInPlace = (targetName: string) => {
    // Walk backward so removing items does not affect yet-to-visit indices.
    for (let index = skipTargets.length - 1; index >= 0; index -= 1) {
      if (skipTargets[index] === targetName) {
        skipTargets.splice(index, 1);
      }
    }
  };

  if (isDynamicBlock(sequence)) {
    return;
  }

  // Base case: empty sequence
  if (sequence.components.length === 0) {
    // Push a warning for an empty components array
    warnings.push({
      message: 'Sequence has an empty components array',
      instancePath: '/sequence/',
      params: { action: 'Remove empty components block or add components to the sequence' },
      category: 'sequence-validation',
    });
    return;
  }

  // If the block has an ID, remove it from the skipTargets array
  if (sequence.id) {
    removeTargetInPlace(sequence.id);
  }

  // Recursive case: sequence has at least one component
  sequence.components.forEach((component) => {
    if (typeof component === 'string') {
      // If the component is a string, check if it is in the skipTargets array
      if (skipTargets.includes(component)) {
        removeTargetInPlace(component);
      }
    } else {
      // Recursive case: component is a block
      verifyStudySkip(component, skipTargets, errors, warnings);
    }
  });

  // If this block has a skip, add the skip.to component to the skipTargets array
  if (sequence.skip && sequence.skip.length > 0) {
    skipTargets.push(...sequence.skip.map((skip) => skip.to).filter((target) => target !== 'end'));
  }
}

// This function verifies the study config file satisfies conditions that are not covered by the schema
function verifyStudyConfig(studyConfig: StudyConfig, importedLibrariesData: Record<string, LibraryConfig>) {
  const errors: ParsedConfig<StudyConfig>['errors'] = [];
  const warnings: ParsedConfig<StudyConfig>['warnings'] = [];

  verifyLibraryUsage(studyConfig, errors, warnings, importedLibrariesData);

  // Verify components are well defined
  Object.entries(studyConfig.components)
    .forEach(([componentName, component]) => {
      const isImportedLibraryComponent = componentName.startsWith('$') && componentName.includes('.components.');

      // Verify baseComponent is defined in baseComponents object
      if (isInheritedComponent(component) && !studyConfig.baseComponents?.[component.baseComponent]) {
        errors.push({
          message: `Base component \`${component.baseComponent}\` is not defined in baseComponents object`,
          instancePath: '/baseComponents/',
          params: { action: 'Add the base component to the baseComponents object' },
          category: 'undefined-base-component',
        });
      }

      const baseComponent = isInheritedComponent(component)
        ? studyConfig.baseComponents?.[component.baseComponent]
        : undefined;
      const resolvedComponent: Partial<IndividualComponent> = {
        ...(baseComponent || {}),
        ...component,
      };

      const isInheritedFromImportedLibrary = isInheritedComponent(component)
        && component.baseComponent.startsWith('$')
        && component.baseComponent.includes('.components.');

      const isUsingSidebarInOwnComponent = component.instructionLocation === 'sidebar'
        || component.nextButtonLocation === 'sidebar'
        || component.response?.some((r) => 'location' in r && r.location === 'sidebar');
      const hasOwnSidebarOverride = component.withSidebar !== undefined;

      // Verify sidebar is enabled if component uses sidebar locations
      // Imported library components are validated in verifyLibraryUsage to avoid duplicate warnings.
      if (!isImportedLibraryComponent && (!isInheritedFromImportedLibrary || isUsingSidebarInOwnComponent || hasOwnSidebarOverride)) {
        const sidebarDisabled = !(resolvedComponent.withSidebar ?? studyConfig.uiConfig.withSidebar);
        const isUsingSidebar = resolvedComponent.instructionLocation === 'sidebar'
          || resolvedComponent.nextButtonLocation === 'sidebar'
          || resolvedComponent.response?.some((r) => 'location' in r && r.location === 'sidebar');

        if (sidebarDisabled && isUsingSidebar) {
          const instancePath = component.withSidebar === false
            ? '/components/'
            : baseComponent?.withSidebar === false
              ? '/baseComponents/'
              : '/uiConfig/';
          warnings.push({
            message: `Component \`${componentName}\` uses sidebar locations but sidebar is disabled`,
            instancePath,
            params: { action: 'Enable the sidebar or move the location to belowStimulus or aboveStimulus' },
            category: 'disabled-sidebar',
          });
        }
      }
    });

  const usedComponents = getSequenceFlatMapWithInterruptions(studyConfig.sequence);

  // Verify sequence is well defined
  usedComponents.forEach((component) => {
    // Verify component is defined in components object
    if (!studyConfig.components[component]) {
      if (studyConfig.baseComponents?.[component]) {
        errors.push({
          message: `Component \`${component}\` is a base component and cannot be used in the sequence`,
          instancePath: '/sequence/',
          params: { action: 'Remove the base component from the sequence' },
          category: 'sequence-validation',
        });
      } else {
        errors.push({
          message: `Component \`${component}\` is not defined in components object`,
          instancePath: '/components/',
          params: { action: 'Add the component to the components object' },
          category: 'undefined-component',
        });
      }
    }
  });

  // Warnings for components that are defined but not used in the sequence
  Object.keys(studyConfig.components)
    .filter((componentName) => (
      !usedComponents.includes(componentName)
      && !componentName.includes('.sequences.')
      && !componentName.includes('.components.')
    ))
    .forEach((componentName) => {
      warnings.push({
        message: `Component \`${componentName}\` is defined in components object but not used deterministically in the sequence`,
        instancePath: '/components/',
        params: { action: 'Remove the component from the components object or add it to the sequence' },
        category: 'unused-component',
      });
    });

  // Verify skip blocks are well defined
  const missingSkipTargets: string[] = [];
  verifyStudySkip(studyConfig.sequence, missingSkipTargets, errors, warnings);
  missingSkipTargets.forEach((skipTarget) => {
    errors.push({
      message: `Skip target \`${skipTarget}\` does not occur after the skip block it is used in`,
      instancePath: '/sequence/',
      params: { action: 'Add the target to the sequence after the skip block' },
      category: 'skip-validation',
    });
  });

  return { errors, warnings };
}

export async function parseStudyConfig(fileData: string): Promise<ParsedConfig<StudyConfig>> {
  let validatedData = false;
  let data: StudyConfig | undefined;

  try {
    // Try JSON parse first
    data = JSON.parse(fileData);
    validatedData = studyValidate(data) as boolean;
  } catch {
    // Try yaml parse
    try {
      data = parseDocument(fileData).toJSON() as StudyConfig;
      validatedData = studyValidate(data) as boolean;
    } catch (e) {
      console.error('Error parsing study config file:', e);
      validatedData = false;
    }
  }

  let errors: ParserErrorWarning[] = (studyValidate.errors || []).map((e) => ({
    message: e.message || 'Validation error',
    instancePath: (e.instancePath as string) || '',
    params: (e.params as object) || {},
    category: 'invalid-config',
  }));
  let warnings: ParserErrorWarning[] = [];

  // We can only run our custom validator if the schema validation passes
  if (validatedData && data) {
    const importedLibraries = data.importedLibraries || [];
    const importedLibrariesData = await loadLibrariesParseNamespace(importedLibraries, errors, warnings);

    // Add the imported libraries to the components object and baseComponents object
    Object.values(importedLibrariesData).forEach((libraryData) => {
      data.components = { ...data.components, ...libraryData.components };
      data.baseComponents = { ...data.baseComponents, ...libraryData.components };
    });

    // Expand .co. macro to .components. in baseComponent references (after merging library components)
    Object.values(data.components).forEach((component) => {
      if (component && typeof component === 'object' && 'baseComponent' in component && typeof component.baseComponent === 'string' && component.baseComponent.includes('.co.')) {
        component.baseComponent = component.baseComponent.replace('.co.', '.components.');
      }
    });

    // Expand the imported sequences to use the correct component names
    data.sequence = expandLibrarySequences(data.sequence, importedLibrariesData, errors);

    const { errors: parserErrors, warnings: parserWarnings } = verifyStudyConfig(data, importedLibrariesData);
    errors = [...errors, ...parserErrors];
    warnings = [...warnings, ...parserWarnings];
  } else {
    errors = [...errors, {
      message: 'There was an issue validating your config file',
      instancePath: 'root',
      params: { action: 'Fix the errors in your file or make sure the global config references the right file path' },
      category: 'invalid-config',
    }];
  }

  return { ...data as StudyConfig, errors, warnings };
}
