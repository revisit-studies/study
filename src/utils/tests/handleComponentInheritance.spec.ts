import {
  describe, expect, test, vi,
} from 'vitest';
import type { IndividualComponent, InheritedComponent } from '../../parser/types';
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
