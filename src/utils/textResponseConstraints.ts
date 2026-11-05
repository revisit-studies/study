import { countTextResponseWords } from './primitiveValidation';
import type { IndividualComponent, ParserErrorWarning } from '../parser/types';
import { checkBuiltInValidation } from './builtInValidation';

export function verifyTextResponseConstraints(
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
