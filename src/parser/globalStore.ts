import type { ParserErrorWarning, StudyConfig, ValueCondition } from './types';
import {
  getInitialGlobalVariables, getGlobalStoreOperandType, globalStoreOperationIsCompatible, resolveGlobalStoreNumber, validateGlobalStoreDefinitions,
} from '../utils/globalStore';
import { studyComponentToIndividualComponent } from '../utils/handleComponentInheritance';
import { getStoreTemplateReferences } from '../utils/handlebars';

export function verifyGlobalStoreConfig(config: StudyConfig): ParserErrorWarning[] {
  const definitions = config.globalVariables ?? {};
  const values = getInitialGlobalVariables(definitions);
  const errors: ParserErrorWarning[] = [];
  const add = (instancePath: string, message: string) => errors.push({
    instancePath, message, category: 'invalid-config', params: { action: 'Use declared variables with compatible values and operations' },
  });
  validateGlobalStoreDefinitions(definitions).forEach(({ instancePath, message }) => add(instancePath, message));

  const checkTemplates = (value: unknown, path: string) => {
    if (typeof value === 'string') {
      getStoreTemplateReferences(value).forEach((key) => {
        if (!Object.hasOwn(values, key)) add(path, `Unknown global store variable "${key}"; declare it in globalVariables`);
      });
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, child]) => {
        if (key !== 'parameters' && key !== 'correctAnswer') checkTemplates(child, `${path}/${key}`);
      });
    }
  };
  checkTemplates(config.uiConfig, '/uiConfig');

  const checkCondition = (variable: string, condition: ValueCondition, path: string) => {
    if (!Object.hasOwn(values, variable)) { add(path, `Unknown global store variable "${variable}"`); return; }
    const initial = values[variable];
    const { comparison, value } = condition;
    if (['lessThan', 'lessThanOrEqual', 'greaterThan', 'greaterThanOrEqual'].includes(comparison)) {
      if (typeof initial !== 'number' || typeof value !== 'number') add(path, 'Numeric comparisons require a numeric store variable and value');
    } else if (['contains', 'doesNotContain', 'matchesRegex'].includes(comparison)) {
      if (typeof initial !== 'string' || typeof value !== 'string') add(path, 'String comparisons require a string store variable and value');
      if (comparison === 'matchesRegex') {
        try { RegExp(String(value)); } catch { add(path, 'Provide a valid regular expression'); }
      }
    } else if (typeof initial !== typeof value) add(path, 'Store comparison values must match the declared variable type');
  };

  Object.entries(config.components).forEach(([id, component]) => {
    const resolved = studyComponentToIndividualComponent(component, config);
    checkTemplates(resolved, `/components/${id}`);
    (resolved.response ?? []).forEach((response, index) => {
      const path = `/components/${id}/response/${index}`;
      response.onSubmit?.forEach((action, actionIndex) => {
        const actionPath = `${path}/onSubmit/${actionIndex}`;
        if (!Object.hasOwn(values, action.variable)) add(actionPath, `Unknown global store variable "${action.variable}"`);
        else if (!globalStoreOperationIsCompatible(action.operation, values[action.variable])) add(actionPath, `Operation "${action.operation}" is incompatible with "${action.variable}"`);
        else if (response.type === 'textOnly' || response.type === 'divider') add(actionPath, 'Store actions require an input response');
        else if (action.operation === 'toggle') {
          if (action.operand !== undefined) add(`${actionPath}/operand`, 'Toggle does not accept an operand');
        } else {
          const answerType = ['numerical', 'slider'].includes(response.type) ? 'number'
            : ['shortText', 'longText'].includes(response.type) ? 'string' : undefined;
          try {
            const operandType = getGlobalStoreOperandType(action.operand, answerType);
            const variableType = typeof values[action.variable];
            if (operandType !== undefined && operandType !== variableType) add(`${actionPath}/operand`, 'The operand type must match the global variable type');
          } catch (error) { add(`${actionPath}/operand`, (error as Error).message); }
        }
      });
      if (response.type === 'numerical') {
        (['min', 'max', 'strictMin', 'strictMax'] as const).forEach((field) => {
          try { resolveGlobalStoreNumber(response[field], values); } catch (error) { add(`${path}/${field}`, (error as Error).message); }
        });
      }
      if (response.visibleIf?.globalVariable !== undefined) checkCondition(response.visibleIf.globalVariable, response.visibleIf, `${path}/visibleIf`);
    });
  });
  const checkBlock = (block: StudyConfig['sequence'], path: string) => {
    if ('skip' in block) {
      block.skip?.forEach((condition, index) => {
        if (condition.check === 'globalVariable') checkCondition(condition.variable, condition, `${path}/skip/${index}`);
      });
    }
    if ('components' in block && Array.isArray(block.components)) {
      block.components.forEach((child, index) => {
        if (typeof child !== 'string') checkBlock(child, `${path}/components/${index}`);
      });
    }
  };
  checkBlock(config.sequence, '/sequence');
  return errors;
}
