import type { ComponentType } from 'react';
import { CustomResponse, JsonValue } from '../../parser/types';
import { CustomResponseParams, CustomResponseValidate } from '../../store/types';
import { getPublicModule } from '../../utils/publicModules';

export type CustomResponseModule = {
  default?: ComponentType<CustomResponseParams<Record<string, unknown>, JsonValue>>;
  validate?: CustomResponseValidate;
};

export function getCustomResponseModule(response: CustomResponse): CustomResponseModule | null {
  const module = getPublicModule(response.path);

  if (!module) {
    return null;
  }

  return module as CustomResponseModule;
}
