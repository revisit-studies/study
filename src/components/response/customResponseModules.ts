import type { ComponentType } from 'react';
import { CustomResponse, JsonValue } from '../../parser/types';
import { CustomResponseParams, CustomResponseValidate } from '../../store/types';

export type CustomResponseModule = {
  default?: ComponentType<CustomResponseParams<Record<string, unknown>, JsonValue>>;
  validate?: CustomResponseValidate;
};

let modules: Record<string, CustomResponseModule> | null = null;

function getModules() {
  if (modules === null) {
    modules = import.meta.glob(
      '../../public/**/*.{mjs,js,mts,ts,jsx,tsx}',
      { eager: true },
    ) as Record<string, CustomResponseModule>;
  }

  return modules;
}

function getCustomResponseModulePath(response: CustomResponse) {
  return `../../public/${response.path}`;
}

export function getCustomResponseModuleLoadError(response: CustomResponse) {
  return `Unable to load custom response module at ${response.path}`;
}

export function getCustomResponseModule(response: CustomResponse): CustomResponseModule | null {
  const module = getModules()[getCustomResponseModulePath(response)];

  return module ? module as CustomResponseModule : null;
}
