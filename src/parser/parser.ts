import Ajv from 'ajv';
import Handlebars from 'handlebars';
import { parseDocument } from 'yaml';
import configSchema from './StudyConfigSchema.json';
import globalSchema from './GlobalConfigSchema.json';
import {
  GlobalConfig, LibraryConfig, ParsedConfig, StudyConfig, ParserErrorWarning, IndividualComponent,
} from './types';
import { getSequenceFlatMapWithInterruptions } from '../utils/getSequenceFlatMap';
import { expandLibrarySequences, loadLibrariesParseNamespace, verifyLibraryUsage } from './libraryParser';
import { isDynamicBlock, isInheritedComponent } from './utils';
import {
  DEFAULT_CONTACT_EMAIL,
  DEFAULT_FIREBASE_WARNING_ACTION,
  DEFAULT_FIREBASE_WARNING_MESSAGE,
  DEFAULT_SUPABASE_WARNING_ACTION,
  DEFAULT_SUPABASE_WARNING_MESSAGE,
  getCurrentHostname,
  shouldSuppressDefaultDeploymentWarnings,
  shouldWarnForDefaultFirebaseConfig,
  shouldWarnForDefaultSupabaseConfig,
} from '../utils/defaultStorageConfig';
import { studyComponentToIndividualComponent } from '../utils/handleComponentInheritance';
import {
  getDateValueFormat,
  isValidTime,
  parseDateValue,
} from '../utils/dateTimeValidation';
import { checkBuiltInValidation } from '../components/response/builtInValidation';
import { getDropdownOptions } from '../utils/dropdownOptions';

const modules = import.meta.glob(
  [
    '../public/**/*.{mjs,js,mts,ts,jsx,tsx}',
    '!../public/**/*.spec.{mjs,js,mts,ts,jsx,tsx}',
  ],
  { eager: false }, // the parser only checks if the path exists
);

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

function isTemplatedPath(path: string) {
  if (!path.includes('{{')) {
    return false;
  }

  try {
    const ast = Handlebars.parse(path) as unknown;
    const hasRuntimeExpression = (node: unknown): boolean => {
      if (Array.isArray(node)) {
        return node.some(hasRuntimeExpression);
      }
      if (!node || typeof node !== 'object') {
        return false;
      }

      const { type } = node as { type?: unknown };
      if (type === 'MustacheStatement' || type === 'BlockStatement') {
        const pathType = (node as { path?: { type?: unknown } }).path?.type;
        return pathType === 'PathExpression';
      }

      return Object.entries(node).some(([key, value]) => key !== 'loc' && hasRuntimeExpression(value));
    };

    return hasRuntimeExpression(ast);
  } catch {
    return false;
  }
}

function verifyReactComponent(
  instancePath: string,
  component: Partial<IndividualComponent>,
  errors: ParserErrorWarning[],
) {
  if (
    'path' in component
      && component.path != null
      && component.type === 'react-component'
      // A templated path (e.g. `{{file}}.tsx`) can't be resolved until runtime, once
      // parameters/answers are known, so it can never match a real file in this static glob.
      && !isTemplatedPath(component.path)
      && !(`../public/${component.path}` in modules)
  ) {
    errors.push({
      message: 'Unresolved path',
      instancePath,
      params: {
        action: 'Make sure the React component is in `src/public/`, not `public/`',
      },
      category: 'undefined-component',
    });
  }
}

function isUrlConditionalBlock(sequence: StudyConfig['sequence']): boolean {
  return sequence.conditional === true && Boolean(sequence.id);
}

function countTextResponseWords(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word))
    .length;
}
function verifyTextResponseConstraints(
  componentPath: string,
  component: Partial<IndividualComponent>,
  errors: ParserErrorWarning[],
  warnings: ParserErrorWarning[],
) {
  component.response?.forEach((response, index) => {
    if (response.type !== 'shortText' && response.type !== 'longText') {
      return;
    }

    const responsePath = `${componentPath}/response/${index}`;
    const constraints = {
      minCharLength: response.minCharLength,
      maxCharLength: response.maxCharLength,
      minWordLength: response.minWordLength,
      maxWordLength: response.maxWordLength,
    };
    const constraintsAreValid = Object.values(constraints).every(
      (value) => value === undefined || (Number.isInteger(value) && value >= 0),
    );

    Object.entries(constraints).forEach(([name, value]) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        errors.push({
          message: `${name} must be a non-negative integer`,
          instancePath: `${responsePath}/${name}`,
          params: { action: `Set ${name} to a non-negative integer` },
          category: 'invalid-config',
        });
      }
    });

    if (constraintsAreValid && response.required !== false && response.maxCharLength === 0) {
      errors.push({
        message: 'maxCharLength must be greater than zero for a required text response',
        instancePath: `${responsePath}/maxCharLength`,
        params: { action: 'Increase maxCharLength or make the response optional' },
        category: 'invalid-config',
      });
    }

    if (constraintsAreValid && response.required !== false && response.maxWordLength === 0) {
      errors.push({
        message: 'maxWordLength must be greater than zero for a required text response',
        instancePath: `${responsePath}/maxWordLength`,
        params: { action: 'Increase maxWordLength or make the response optional' },
        category: 'invalid-config',
      });
    }

    if (
      constraintsAreValid
      && response.minCharLength !== undefined
      && response.maxCharLength !== undefined
      && response.minCharLength > response.maxCharLength
    ) {
      errors.push({
        message: 'minCharLength must be less than or equal to maxCharLength',
        instancePath: responsePath,
        params: { action: 'Decrease minCharLength or increase maxCharLength' },
        category: 'invalid-config',
      });
    }

    if (
      constraintsAreValid
      && response.minWordLength !== undefined
      && response.maxWordLength !== undefined
      && response.minWordLength > response.maxWordLength
    ) {
      errors.push({
        message: 'minWordLength must be less than or equal to maxWordLength',
        instancePath: responsePath,
        params: { action: 'Decrease minWordLength or increase maxWordLength' },
        category: 'invalid-config',
      });
    }

    if (
      constraintsAreValid
      && response.minWordLength !== undefined
      && response.minWordLength > 0
      && response.maxCharLength !== undefined
    ) {
      const minimumRequiredCharacters = response.minWordLength * 2 - 1;
      if (minimumRequiredCharacters > response.maxCharLength) {
        errors.push({
          message: `minWordLength of ${response.minWordLength} requires at least ${minimumRequiredCharacters} characters, which exceeds maxCharLength of ${response.maxCharLength}`,
          instancePath: responsePath,
          params: { action: 'Decrease minWordLength or increase maxCharLength' },
          category: 'invalid-config',
        });
      }
    }
    response.textValidation?.forEach((rule, ruleIndex) => {
      if (
        rule.value === ''
        && (rule.type === 'equals' || rule.type === 'contains' || rule.type === 'doesNotContain')
      ) {
        errors.push({
          message: `${rule.type} value must not be empty`,
          instancePath: `${responsePath}/textValidation/${ruleIndex}/value`,
          params: { action: `Set ${rule.type} value to a non-empty string` },
          category: 'invalid-config',
        });
        return;
      }

      if (rule.value === '' && (rule.type === 'matchesRegex' || rule.type === 'doesNotEqual')) {
        warnings.push({
          message: `${rule.type} value is empty and does not restrict participant responses`,
          instancePath: `${responsePath}/textValidation/${ruleIndex}/value`,
          params: { action: `Set ${rule.type} value to a non-empty string or remove the rule` },
          category: 'invalid-config',
        });
      }
      if (rule.type !== 'matchesRegex') {
        return;
      }

      try {
        RegExp(rule.value);
      } catch {
        errors.push({
          message: 'matchesRegex value must be a valid regular expression',
          instancePath: `${responsePath}/textValidation/${ruleIndex}/value`,
          params: { action: 'Fix the regular expression pattern' },
          category: 'invalid-config',
        });
      }
    });
    const textValidation = response.textValidation ?? [];
    const fixedValues = [
      ...(response.requiredValue !== undefined && response.requiredValue !== null
        ? [{
          label: 'requiredValue',
          path: `${responsePath}/requiredValue`,
          value: response.requiredValue.toString(),
        }]
        : []),
      ...textValidation.flatMap((rule, ruleIndex) => (rule.type === 'equals' && rule.value !== ''
        ? [{
          label: 'equals',
          path: `${responsePath}/textValidation/${ruleIndex}/value`,
          value: rule.value,
        }]
        : [])),
    ];
    const firstFixedValue = fixedValues[0];
    const conflictingFixedValue = fixedValues.find(
      ({ value }) => value !== firstFixedValue?.value,
    );
    if (firstFixedValue && conflictingFixedValue) {
      errors.push({
        message: `${firstFixedValue.label} value \`${firstFixedValue.value}\` conflicts with ${conflictingFixedValue.label} value \`${conflictingFixedValue.value}\``,
        instancePath: conflictingFixedValue.path,
        params: { action: 'Use the same value for requiredValue and all equals rules' },
        category: 'invalid-config',
      });
    }
    if (response.type === 'shortText' && response.builtInValidation) {
      fixedValues.forEach(({ label, path, value }) => {
        if (checkBuiltInValidation(response.builtInValidation!, value) !== null) {
          errors.push({
            message: `${label} value \`${value}\` does not satisfy ${response.builtInValidation} built-in validation`,
            instancePath: path,
            params: { action: `Change ${label} or remove the conflicting built-in validation` },
            category: 'invalid-config',
          });
        }
      });
    }
    textValidation.forEach((firstRule, firstRuleIndex) => {
      textValidation.slice(firstRuleIndex + 1).forEach((secondRule, offset) => {
        const secondRuleIndex = firstRuleIndex + offset + 1;
        const containsRule = firstRule.type === 'contains' ? firstRule : secondRule;
        const doesNotContainRule = firstRule.type === 'doesNotContain' ? firstRule : secondRule;
        if (
          containsRule.type === 'contains'
          && doesNotContainRule.type === 'doesNotContain'
          && containsRule.value !== ''
          && doesNotContainRule.value !== ''
          && containsRule.value.includes(doesNotContainRule.value)
        ) {
          errors.push({
            message: `contains value \`${containsRule.value}\` always includes doesNotContain value \`${doesNotContainRule.value}\``,
            instancePath: `${responsePath}/textValidation/${secondRuleIndex}/value`,
            params: { action: 'Change or remove one of the conflicting text validation rules' },
            category: 'invalid-config',
          });
        }
      });
    });
    textValidation.forEach((rule, ruleIndex) => {
      if (rule.type !== 'equals' || rule.value === '') {
        return;
      }
      textValidation.forEach((otherRule, otherRuleIndex) => {
        if (otherRuleIndex === ruleIndex || otherRule.value === '') {
          return;
        }
        const conflicts = (
          (otherRule.type === 'doesNotEqual' && otherRule.value === rule.value)
          || (otherRule.type === 'contains' && !rule.value.includes(otherRule.value))
          || (otherRule.type === 'doesNotContain' && rule.value.includes(otherRule.value))
        );
        if (conflicts) {
          errors.push({
            message: `equals value \`${rule.value}\` conflicts with ${otherRule.type} value \`${otherRule.value}\``,
            instancePath: `${responsePath}/textValidation/${Math.max(ruleIndex, otherRuleIndex)}/value`,
            params: { action: 'Change or remove one of the conflicting text validation rules' },
            category: 'invalid-config',
          });
        }
      });
      if (!constraintsAreValid) {
        return;
      }
      const charLength = rule.value.length;
      const wordLength = countTextResponseWords(rule.value);
      const equalsConstraintConflicts = [
        response.minCharLength !== undefined && charLength < response.minCharLength
          ? `has ${charLength} characters, which is less than minCharLength of ${response.minCharLength}` : null,
        response.maxCharLength !== undefined && charLength > response.maxCharLength
          ? `has ${charLength} characters, which exceeds maxCharLength of ${response.maxCharLength}` : null,
        response.minWordLength !== undefined && wordLength < response.minWordLength
          ? `contains ${wordLength} words, which is less than minWordLength of ${response.minWordLength}` : null,
        response.maxWordLength !== undefined && wordLength > response.maxWordLength
          ? `contains ${wordLength} words, which exceeds maxWordLength of ${response.maxWordLength}` : null,
      ].filter((message): message is string => message !== null);
      equalsConstraintConflicts.forEach((message) => {
        errors.push({
          message: `equals value \`${rule.value}\` ${message}`,
          instancePath: `${responsePath}/textValidation/${ruleIndex}/value`,
          params: { action: 'Change the equals value or the conflicting length constraint' },
          category: 'invalid-config',
        });
      });
    });
  });
}

function verifyDropdownResponseConstraints(
  componentPath: string,
  component: Partial<IndividualComponent>,
  errors: ParserErrorWarning[],
) {
  component.response?.forEach((response, index) => {
    if (response.type !== 'dropdown' || response.options !== 'countries') {
      return;
    }

    const responsePath = `${componentPath}/response/${index}`;
    const countryValues = new Set(getDropdownOptions(response).map((option) => option.value));

    (['default', 'requiredValue'] as const).forEach((field) => {
      const configuredValue = field === 'default' ? response.default : response.requiredValue;
      if (configuredValue === undefined || configuredValue === null) {
        return;
      }

      const values = Array.isArray(configuredValue) ? configuredValue : [configuredValue];
      values.forEach((value, valueIndex) => {
        if (typeof value === 'string' && countryValues.has(value)) {
          return;
        }

        const valuePath = Array.isArray(configuredValue)
          ? `${responsePath}/${field}/${valueIndex}`
          : `${responsePath}/${field}`;
        errors.push({
          message: `dropdown ${field} value \`${String(value)}\` is not a valid country code`,
          instancePath: valuePath,
          params: { action: `Set ${field} to a valid country code from the countries preset` },
          category: 'invalid-config',
        });
      });
    });
  });
}

function verifyDateTimeResponseConstraints(
  componentPath: string,
  component: Partial<IndividualComponent>,
  errors: ParserErrorWarning[],
) {
  component.response?.forEach((response, index) => {
    if (response.type !== 'date' && response.type !== 'time') {
      return;
    }

    const responsePath = `${componentPath}/response/${index}`;
    const isDateResponse = response.type === 'date';
    const dateOptions = isDateResponse ? response.options ?? 'date' : 'date';
    const isValidValue = isDateResponse
      ? (value: string) => parseDateValue(value, dateOptions) !== null
      : (value: string) => isValidTime(value, response.withSeconds);
    const expectedFormat = response.type === 'date'
      ? getDateValueFormat(dateOptions)
      : response.withSeconds ? 'HH:mm:ss' : 'HH:mm';
    const fields = ['default', 'requiredValue', 'min', 'max'] as const;

    fields.forEach((field) => {
      const value = response[field];
      if (value === undefined || value === null) {
        return;
      }

      if (!isValidValue(value)) {
        errors.push({
          message: `${response.type} ${field} must be a valid ${expectedFormat} value`,
          instancePath: `${responsePath}/${field}`,
          params: { action: `Set ${field} to a valid ${expectedFormat} value` },
          category: 'invalid-config',
        });
      }
    });

    const toComparableValue = (value: string) => {
      if (isDateResponse) {
        return parseDateValue(value, dateOptions)?.getTime() ?? null;
      }
      if (!isValidTime(value, response.withSeconds)) {
        return null;
      }
      return value.split(':').reduce((total, part) => (total * 60) + Number(part), 0);
    };
    const min = response.min ? toComparableValue(response.min) : null;
    const max = response.max ? toComparableValue(response.max) : null;
    if (min !== null && max !== null && min > max) {
      errors.push({
        message: `${response.type} min must be less than or equal to max`,
        instancePath: responsePath,
        params: { action: 'Set min to a value less than or equal to max' },
        category: 'invalid-config',
      });
      return;
    }

    (['default', 'requiredValue'] as const).forEach((field) => {
      const value = response[field];
      const comparableValue = value ? toComparableValue(value) : null;
      if (comparableValue === null) {
        return;
      }

      if (min !== null && comparableValue < min) {
        errors.push({
          message: `${response.type} ${field} must be ${isDateResponse ? 'on' : 'at'} or after min`,
          instancePath: `${responsePath}/${field}`,
          params: { action: `Set ${field} to a value greater than or equal to min` },
          category: 'invalid-config',
        });
      }
      if (max !== null && comparableValue > max) {
        errors.push({
          message: `${response.type} ${field} must be ${isDateResponse ? 'on' : 'at'} or before max`,
          instancePath: `${responsePath}/${field}`,
          params: { action: `Set ${field} to a value less than or equal to max` },
          category: 'invalid-config',
        });
      }
    });
  });
}

function hasConditionalBlock(sequence: StudyConfig['sequence']): boolean {
  if (isUrlConditionalBlock(sequence)) {
    return true;
  }

  if (isDynamicBlock(sequence)) {
    return false;
  }

  return sequence.components.some((component) => (
    typeof component !== 'string'
    && hasConditionalBlock(component)
  ));
}

function hasConditionalBlockInsideRestrictedOrderAncestor(
  sequence: StudyConfig['sequence'],
  hasRestrictedOrderAncestor = false,
): boolean {
  if (hasRestrictedOrderAncestor && isUrlConditionalBlock(sequence)) {
    return true;
  }

  if (isDynamicBlock(sequence)) {
    return false;
  }

  const childHasRestrictedOrderAncestor = hasRestrictedOrderAncestor
    || sequence.order === 'random'
    || sequence.order === 'latinSquare';

  return sequence.components.some((component) => (
    typeof component !== 'string'
    && hasConditionalBlockInsideRestrictedOrderAncestor(component, childHasRestrictedOrderAncestor)
  ));
}

// This function verifies the study config file satisfies conditions that are not covered by the schema
function verifyStudyConfig(studyConfig: StudyConfig, importedLibrariesData: Record<string, LibraryConfig>) {
  const errors: ParsedConfig<StudyConfig>['errors'] = [];
  const warnings: ParsedConfig<StudyConfig>['warnings'] = [];

  verifyLibraryUsage(studyConfig, errors, warnings, importedLibrariesData);

  Object.entries(studyConfig.baseComponents ?? {}).forEach(([componentName, component]) => {
    verifyTextResponseConstraints(`/baseComponents/${componentName}`, component, errors, warnings);
    verifyDateTimeResponseConstraints(`/baseComponents/${componentName}`, component, errors);
    verifyDropdownResponseConstraints(`/baseComponents/${componentName}`, component, errors);
  });
  Object.entries(studyConfig.components).forEach(([componentName, component]) => {
    const mergedComponent = studyComponentToIndividualComponent(component, studyConfig);
    verifyTextResponseConstraints(`/components/${componentName}`, mergedComponent, errors, warnings);
    verifyDateTimeResponseConstraints(`/components/${componentName}`, mergedComponent, errors);
    verifyDropdownResponseConstraints(`/components/${componentName}`, mergedComponent, errors);
  });

  const hasConditional = hasConditionalBlock(studyConfig.sequence);
  const hasConditionalInsideRestrictedOrderAncestor = hasConditionalBlockInsideRestrictedOrderAncestor(
    studyConfig.sequence,
  );

  if (hasConditional && hasConditionalInsideRestrictedOrderAncestor) {
    errors.push({
      message: 'Conditional URL parameter assignment cannot be combined with random or latinSquare sequence ordering',
      instancePath: '/sequence/',
      params: { action: 'Use fixed ordering when using conditional blocks, or remove conditional blocks' },
      category: 'sequence-validation',
    });
  }

  // Warn if deployment defaults are left in place outside known ReVISit/local hosts.
  const hostname = getCurrentHostname();
  if (studyConfig.uiConfig.contactEmail === DEFAULT_CONTACT_EMAIL && !shouldSuppressDefaultDeploymentWarnings(hostname)) {
    warnings.push({
      message: `The contact email is set to the default value \`${DEFAULT_CONTACT_EMAIL}\`. Please update it to your own email address.`,
      instancePath: '/uiConfig/contactEmail',
      params: { action: 'Update the contactEmail field in uiConfig to your own email address' },
      category: 'default-contact-email',
    });
  }
  if (shouldWarnForDefaultFirebaseConfig({ hostname })) {
    warnings.push({
      message: DEFAULT_FIREBASE_WARNING_MESSAGE,
      instancePath: 'environment/VITE_FIREBASE_CONFIG',
      params: { action: DEFAULT_FIREBASE_WARNING_ACTION },
      category: 'default-firebase-config',
    });
  }
  if (shouldWarnForDefaultSupabaseConfig({ hostname })) {
    warnings.push({
      message: DEFAULT_SUPABASE_WARNING_MESSAGE,
      instancePath: 'environment/VITE_SUPABASE_URL',
      params: { action: DEFAULT_SUPABASE_WARNING_ACTION },
      category: 'default-supabase-config',
    });
  }

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

  // Verify that paths to React components exist under the correct base directory

  for (const [name, component] of Object.entries(studyConfig.baseComponents ?? {})) {
    verifyReactComponent(`/baseComponents/${name}/path`, component, errors);
  }

  for (const [name, component] of Object.entries(studyConfig.components ?? {})) {
    if ('path' in component) {
      const mergedComponent = studyComponentToIndividualComponent(component, studyConfig);
      verifyReactComponent(`/components/${name}/path`, mergedComponent, errors);
    } else {
      // Path is inherited and will be verified on the base component
    }
  }

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
