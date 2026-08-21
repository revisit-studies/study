import { describe, expect, test } from 'vitest';
import type { MarkdownComponent, StudyConfig } from '../../parser/types';
import { makeStudyConfig } from '../../tests/utils';
import { getStaticFirstComponent } from '../getStaticFirstComponent';

const intro: MarkdownComponent = {
  type: 'markdown',
  path: 'test-study/assets/intro.md',
  response: [],
};

function makeConfig(sequence: StudyConfig['sequence'], component = intro) {
  return makeStudyConfig({
    components: { intro: component },
    sequence,
  });
}

describe('getStaticFirstComponent', () => {
  test('returns a static Markdown component at the start of fixed blocks', () => {
    const config = makeConfig({
      order: 'fixed',
      components: [{ order: 'fixed', components: ['intro'] }],
    });

    expect(getStaticFirstComponent(config)).toEqual({ componentName: 'intro', component: intro });
  });

  test.each([
    ['random order', { order: 'random', components: ['intro'] }],
    ['a conditional block', { order: 'fixed', conditional: true, components: ['intro'] }],
    ['a dynamic block', { order: 'dynamic', components: ['intro'] }],
    ['a factor block', { type: 'factor', order: 'fixed', components: ['intro'] }],
    ['an interruption', {
      order: 'fixed',
      components: ['intro'],
      interruptions: [{ firstLocation: 1, spacing: 1, components: ['intro'] }],
    }],
  ])('does not preview a sequence with %s', (_, sequence) => {
    expect(getStaticFirstComponent(makeConfig(sequence as StudyConfig['sequence']))).toBeNull();
  });

  test('previews a static component with responses, which are disabled until startup finishes', () => {
    const component: MarkdownComponent = {
      ...intro,
      response: [{
        id: 'answer', type: 'shortText', prompt: 'Answer', location: 'belowStimulus',
      }],
    };

    expect(getStaticFirstComponent(makeConfig(
      { order: 'fixed', components: ['intro'] },
      component,
    ))).toEqual({ componentName: 'intro', component });
  });

  test('does not preview a component that needs templating', () => {
    expect(getStaticFirstComponent(makeConfig(
      { order: 'fixed', components: ['intro'] },
      { ...intro, path: 'test-study/assets/{{condition}}.md' },
    ))).toBeNull();
  });

  test('does not preview studies with between-subjects assignment', () => {
    const config = makeConfig({ order: 'fixed', components: ['intro'] });
    config.betweenSubjects = ['condition'];

    expect(getStaticFirstComponent(config)).toBeNull();
  });
});
