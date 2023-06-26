/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { parse as hjsonParse } from 'hjson';
import Ajv from 'ajv';
import schema from './schema.json';
import { ContainerComponent, GlobalConfig, StudyConfig } from './types';

const ajv = new Ajv();
ajv.addSchema(schema);
const globalValidate = ajv.getSchema<GlobalConfig>('#/definitions/GlobalConfig')!;
const studyValidate = ajv.getSchema<StudyConfig>('#/definitions/StudyConfig')!;

// This function verifies the global config file satisfies conditions that are not covered by the schema
function verifyGlobalConfig(data: GlobalConfig) {
  const errors: { message: string }[] = [];
  const configsListVerified = data.configsList.every((configName) => {
    if (data.configs[configName] === undefined) {
      errors.push({ message: `Config ${configName} is not defined in configs object, but is present in configsList` });
      return false;
    } else {
      return true;
    }
  });

  return [configsListVerified, errors] as const;
}

export function parseGlobalConfig(fileData: string) {
  const data = hjsonParse(fileData);
  const validatedData = globalValidate(data) as boolean;
  const extraValidation = verifyGlobalConfig(data);

  if (validatedData && extraValidation[0]) {
    return data as GlobalConfig;
  } else {
    console.error('Global config parsing errors', [...(globalValidate.errors || []), ...extraValidation[1]]);
    throw Error('There was an issue validating your file global.hjson');
  }
}

// This function verifies the study config file satisfies conditions that are not covered by the schema
function verifyStudyConfig(data: StudyConfig) {
  const errors: { message: string }[] = [];
  const componentsVerified = Object.entries(data.components).every(([componentName, component]) => {
    if (component.type === 'container') {
      if ((component as ContainerComponent).components === undefined) {
        errors.push({ message: `Container component ${componentName} does not have a components field` });
        return false;
      }
      if (Object.values((component as ContainerComponent).components!).length === 0) {
        errors.push({ message: `Container component ${componentName} has an empty components field` });
        return false;
      }
      if (!(component as ContainerComponent).order.every((componentName) => (component as ContainerComponent).components![componentName] !== undefined)) {
        errors.push({ message: `Container component ${componentName} has an order field that contains components not present in components field` });
        return false;
      }
      return true;
    } else {
      return true;
    }
  });

  return [componentsVerified, errors] as const;
}

export function parseStudyConfig(fileData: string, fileName: string) {
  const data = hjsonParse(fileData);
  const validatedData = studyValidate(data) as boolean;
  const extraValidation = verifyStudyConfig(data);

  if (validatedData && extraValidation[0]) {
    return data as StudyConfig;
  } else {
    console.error(`${fileName} parsing errors`, [...(studyValidate.errors || []), ...extraValidation[1]]);
    throw Error(`There was an issue validating your file ${fileName}`);
  }
}
