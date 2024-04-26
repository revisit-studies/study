/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { parse as hjsonParse } from 'hjson';
import Ajv, { ErrorObject } from 'ajv';
import configSchema from './StudyConfigSchema.json';
import globalSchema from './GlobalConfigSchema.json';
import {
  GlobalConfig, IndividualComponent, InheritedComponent, StudyConfig,
} from './types';

const ajv1 = new Ajv();
ajv1.addSchema(globalSchema);
const globalValidate = ajv1.getSchema<GlobalConfig>('#/definitions/GlobalConfig')!;

const ajv2 = new Ajv();
ajv2.addSchema(configSchema);
const studyValidate = ajv2.getSchema<StudyConfig>('#/definitions/StudyConfig')!;

// This function verifies the global config file satisfies conditions that are not covered by the schema
function verifyGlobalConfig(data: GlobalConfig) {
  const errors: { message: string }[] = [];
  const configsListVerified = data.configsList.every((configName) => {
    if (data.configs[configName] === undefined) {
      errors.push({ message: `Config ${configName} is not defined in configs object, but is present in configsList` });
      return false;
    }
    return true;
  });

  return [configsListVerified, errors] as const;
}

export function isInheritedComponent(comp: IndividualComponent | InheritedComponent) : comp is InheritedComponent {
  return (<InheritedComponent>comp).baseComponent !== undefined;
}

export function parseGlobalConfig(fileData: string) {
  const data = hjsonParse(fileData);

  const validatedData = globalValidate(data) as boolean;
  const extraValidation = verifyGlobalConfig(data);

  if (validatedData && extraValidation[0]) {
    return data as GlobalConfig;
  }
  console.error('Global config parsing errors', [...(globalValidate.errors || []), ...extraValidation[1]]);
  throw Error('There was an issue validating your file global.json');
}

// This function verifies the study config file satisfies conditions that are not covered by the schema
function verifyStudyConfig(data: StudyConfig) {
  const errors: { message: string }[] = [];
  const componentsVerified = Object.values(data.components).every((component) => (isInheritedComponent(component) ? !!data.baseComponents?.[component.baseComponent] : true));

  return [componentsVerified, errors] as const;
}

export function parseStudyConfig(fileData: string, fileName: string): StudyConfig & { errors?: ErrorObject<string, Record<string, unknown>, unknown>[] } {
  const data = hjsonParse(fileData);
  const validatedData = studyValidate(data) as boolean;
  const extraValidation = verifyStudyConfig(data);

  if (validatedData && extraValidation[0]) {
    return data as StudyConfig;
  }
  const errors = [...(studyValidate.errors || [])];
  console.error(`${fileName} parsing errors`, errors);

  return { ...data, errors };
}
