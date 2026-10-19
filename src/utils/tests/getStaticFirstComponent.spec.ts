import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import type { MarkdownComponent, StudyConfig } from '../../parser/types';
import { makeStudyConfig } from '../../tests/utils';
import { getStaticAssetByPath } from '../getStaticAsset';
import { getStaticFirstComponent, loadStaticFirstComponentPreview } from '../getStaticFirstComponent';

vi.mock('../getStaticAsset', () => ({
  getStaticAssetByPath: vi.fn(),
}));

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

  test('returns a static stimulus even when its response is custom', () => {
    const component: MarkdownComponent = {
      ...intro,
      response: [{
        id: 'answer',
        type: 'custom',
        prompt: 'Answer',
        location: 'belowStimulus',
        path: 'test-study/assets/CustomResponse.tsx',
      }],
    };

    expect(getStaticFirstComponent(makeConfig(
      { order: 'fixed', components: ['intro'] },
      component,
    ))).toEqual({ componentName: 'intro', component });
  });

  test.each(['nextButtonEnableTime', 'nextButtonDisableTime', 'nextButtonAutoAdvanceTime'] as const)('does not preview a component with %s', (setting) => {
    const config = makeConfig({ order: 'fixed', components: ['intro'] }, { ...intro, [setting]: 5000 });
    expect(getStaticFirstComponent(config)).toBeNull();
  });

  test.each(['nextButtonEnableTime', 'nextButtonDisableTime'] as const)('respects global %s and component overrides', (setting) => {
    const config = makeConfig({ order: 'fixed', components: ['intro'] });
    config.uiConfig[setting] = 5000;
    expect(getStaticFirstComponent(config)).toBeNull();
    config.components.intro = { ...intro, [setting]: 0 };
    expect(getStaticFirstComponent(config)).not.toBeNull();
  });

  test('does not preview inherited image timing restrictions', () => {
    const config = makeConfig({ order: 'fixed', components: ['intro'] });
    config.baseComponents = {
      timedImage: {
        type: 'image', path: 'image.png', response: [], nextButtonAutoAdvanceTime: 5000,
      },
    };
    config.components.intro = { baseComponent: 'timedImage' };
    expect(getStaticFirstComponent(config)).toBeNull();
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

describe('loadStaticFirstComponentPreview', () => {
  const config = makeConfig({ order: 'fixed', components: ['intro'] });

  beforeEach(() => {
    vi.mocked(getStaticAssetByPath).mockReset();
  });

  test('includes a static Markdown body in the preview', async () => {
    vi.mocked(getStaticAssetByPath).mockResolvedValue('# Welcome');

    await expect(loadStaticFirstComponentPreview(config)).resolves.toEqual({
      componentName: 'intro',
      component: intro,
      markdown: '# Welcome',
    });
  });

  test.each([
    ['a placeholder', 'Hello {{participantName}}'],
    ['a conditional branch', '{{#if treatment}}Treatment{{else}}Control{{/if}}'],
    ['a closing delimiter', 'Value: name}}'],
  ])('skips a Markdown body with %s', async (_, markdown) => {
    vi.mocked(getStaticAssetByPath).mockResolvedValue(markdown);

    await expect(loadStaticFirstComponentPreview(config)).resolves.toBeNull();
  });

  test('skips a Markdown body that cannot be loaded', async () => {
    vi.mocked(getStaticAssetByPath).mockResolvedValue(undefined);

    await expect(loadStaticFirstComponentPreview(config)).resolves.toBeNull();
  });

  test('does not fetch anything for an image preview', async () => {
    const image = { type: 'image' as const, path: 'test-study/assets/intro.png', response: [] };
    const imageConfig = makeStudyConfig({
      components: { intro: image },
      sequence: { order: 'fixed', components: ['intro'] },
    });

    await expect(loadStaticFirstComponentPreview(imageConfig)).resolves.toEqual({
      componentName: 'intro',
      component: image,
    });
    expect(getStaticAssetByPath).not.toHaveBeenCalled();
  });
});
