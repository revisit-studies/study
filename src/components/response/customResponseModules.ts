import type { ComponentType } from 'react';
import { CustomResponse, JsonValue } from '../../parser/types';
import {
  CustomResponseParams, CustomResponseScore, CustomResponseValidate,
} from '../../store/types';

export type CustomResponseModule = {
  default?: ComponentType<CustomResponseParams<Record<string, unknown>, JsonValue>>;
  validate?: CustomResponseValidate;
  score?: CustomResponseScore;
};

let modules: Record<string, CustomResponseModule> | null = null;

function getModules() {
  if (modules === null) {
    modules = import.meta.glob(
      [
        '../../public/**/*.{mjs,js,mts,ts,jsx,tsx}',
        '!../../public/**/*.spec.{mjs,js,mts,ts,jsx,tsx}',
      ],
      { eager: true },
    ) as Record<string, CustomResponseModule>;
  }

  return modules;
}

export function getCustomResponseModuleLoadError(response: CustomResponse) {
  return `Unable to load custom response module at ${response.path}`;
}

export function getResponseCodeModule(path: string): CustomResponseModule | null {
  return getModules()[`../../public/${path}`] ?? null;
}

export function getCustomResponseModule(response: CustomResponse): CustomResponseModule | null {
  return getResponseCodeModule(response.path);
}
