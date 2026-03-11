import { describe, expect, it } from 'vitest';
import {
  getComponent,
  studyComponentToIndividualComponent,
} from './handleComponentInheritance';

const studyConfig = {
  uiConfig: {},
  components: {
    baseUse: { baseComponent: 'baseA', instruction: 'override instruction' },
    plain: { instruction: 'plain instruction' },
  },
  baseComponents: {
    baseA: { instruction: 'base instruction', response: [] },
  },
};

describe('handleComponentInheritance', () => {
  it('merges inherited component with base component', () => {
    const merged = studyComponentToIndividualComponent(
      studyConfig.components.baseUse,
      studyConfig as never,
    );

    expect(merged.instruction).toBe('override instruction');
    expect(Array.isArray(merged.response)).toBe(true);
  });

  it('returns plain component unchanged when not inherited', () => {
    const component = getComponent('plain', studyConfig as never);
    expect(component?.instruction).toBe('plain instruction');
  });

  it('returns null when component name does not exist', () => {
    const component = getComponent('missing', studyConfig as never);
    expect(component).toBeNull();
  });
});
