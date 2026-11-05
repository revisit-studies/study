import {
  describe, expect, test, vi,
} from 'vitest';
import type { IndividualComponent, InheritedComponent, ResponseVisibilityCondition } from '../../parser/types';
import { getComponent, studyComponentToIndividualComponent } from '../handleComponentInheritance';
import { makeStudyConfig } from '../../tests/utils';

vi.mock('../../parser/utils', () => ({
  isInheritedComponent: vi.fn((comp: Record<string, string>) => 'baseComponent' in comp),
}));

describe('studyComponentToIndividualComponent', () => {
  test('returns the component as-is when it is not inherited', () => {
    const comp: IndividualComponent = { type: 'markdown', path: '/intro.md', response: [] };
    const config = makeStudyConfig();
    expect(studyComponentToIndividualComponent(comp, config)).toBe(comp);
  });

  test('merges the base component with the inherited component', () => {
    const base: IndividualComponent = { type: 'markdown', path: '/base.md', response: [] };
    const inherited: InheritedComponent = { baseComponent: 'base', path: '/override.md' };
    const config = makeStudyConfig({ baseComponents: { base } });

    const result = studyComponentToIndividualComponent(inherited, config);

    expect(result).toHaveProperty('path', '/override.md');
    expect(result).toHaveProperty('type', 'markdown');
  });

  test('falls back to the component itself when studyConfig has no baseComponents', () => {
    const inherited: InheritedComponent = { baseComponent: 'base', path: '/x.md' };
    const config = makeStudyConfig();
    const result = studyComponentToIndividualComponent(inherited, config);
    expect(result).toEqual(inherited);
  });
});

describe('getComponent', () => {
  test('returns null when the component name is not in studyConfig.components', () => {
    const config = makeStudyConfig();
    expect(getComponent('missing', config)).toBeNull();
  });

  test('returns the resolved component when it exists', () => {
    const comp: IndividualComponent = { type: 'markdown', path: '/intro.md', response: [] };
    const config = makeStudyConfig({ components: { intro: comp } });
    expect(getComponent('intro', config)).toEqual(comp);
  });
});

test.each<[ResponseVisibilityCondition, ResponseVisibilityCondition]>([
  [{ responseId: 'control', comparison: 'equals', value: 'yes' }, { responseId: 'control', comparison: 'doesNotEqual', value: 'yes' }],
  [{ responseId: 'control', comparison: 'doesNotEqual', value: 'yes' }, { responseId: 'control', comparison: 'equals', value: 'no' }],
  [{ responseId: 'control', comparison: 'equals', value: ['a', 'b'] }, { responseId: 'control', comparison: 'equals', value: ['c'] }],
])('replaces the entire inherited condition %j with %j', (original, replacement) => {
  const base: IndividualComponent = {
    type: 'questionnaire',
    response: [{
      id: 'dependent', type: 'shortText', prompt: 'Base prompt', visibleIf: original,
    }],
  };
  const inherited: InheritedComponent = {
    baseComponent: 'base',
    response: [{
      id: 'dependent', type: 'shortText', prompt: 'Override prompt', visibleIf: replacement,
    }],
  };
  const config = makeStudyConfig({ baseComponents: { base } });
  const result = studyComponentToIndividualComponent(inherited, config);
  expect(result.response?.[0].visibleIf).toEqual(replacement);
  expect(base.response?.[0].visibleIf).toEqual(original);
  expect(inherited.response?.[0].visibleIf).toEqual(replacement);
  expect(result.response?.[0].visibleIf).not.toBe(replacement);
  expect(studyComponentToIndividualComponent({ baseComponent: 'base' }, config).response?.[0].visibleIf).toEqual(original);
});
