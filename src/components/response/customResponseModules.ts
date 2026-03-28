import type { ComponentType } from 'react';
import { CustomResponse, JsonValue } from '../../parser/types';
import { CustomResponseParams, CustomResponseValidate } from '../../store/types';
import { loadPublicModule } from '../../utils/publicModules';

export type CustomResponseModule = {
  default?: ComponentType<CustomResponseParams<Record<string, unknown>, JsonValue>>;
  validate?: CustomResponseValidate;
};

export function getCustomResponseModuleLoadError(response: CustomResponse) {
  return `Unable to load custom response module at ${response.path}`;
}

export async function loadCustomResponseModule(response: CustomResponse): Promise<CustomResponseModule | null> {
  const module = await loadPublicModule(response.path);
  return module as CustomResponseModule | null;
}
