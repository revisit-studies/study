import { describe, expect, test } from 'vitest';
import { parseStudyConfig } from '../parser/parser';
import { StudyConfig } from '../parser/types';

function buildConfig(sequence: StudyConfig['sequence']): StudyConfig {
  return {
    $schema: 'https://raw.githubusercontent.com/revisit-studies/study/v2.4.0/src/parser/StudyConfigSchema.json',
    studyMetadata: {
      title: 'Skip logic unit test',
      description: 'Unit tests for skip validation',
      version: '1.0.0',
      authors: ['ReVISit Team'],
      date: '2026-02-20',
      organizations: ['ReVISit'],
    },
    uiConfig: {
      contactEmail: 'test@test.com',
      logoPath: 'revisitAssets/revisitLogoSquare.svg',
      withSidebar: true,
      withProgressBar: true,
    },
    components: {
      trial1: {
        type: 'questionnaire',
        response: [
          {
            id: 'q1',
            type: 'radio',
            prompt: 'Q1',
            location: 'belowStimulus',
            options: ['A', 'B'],
          },
        ],
        correctAnswer: [
          {
            id: 'q1',
            answer: 'A',
          },
        ],
      },
      middle: {
        type: 'markdown',
        path: 'test-skip-logic/continuingComponent.md',
        response: [],
      },
      targetComponent: {
        type: 'markdown',
        path: 'test-skip-logic/targetComponent.md',
        response: [],
      },
      targetBlockComponent: {
        type: 'markdown',
        path: 'test-skip-logic/targetBlockComponent.md',
        response: [],
      },
    },
    sequence,
  };
}

describe('handleSkipLogic parser validation', () => {
  test('accepts a valid skip target that appears later in sequence', async () => {
    const config = buildConfig({
      order: 'fixed',
      components: [
        {
          order: 'fixed',
          components: ['trial1'],
          skip: [
            {
              name: 'trial1',
              check: 'responses',
              to: 'targetComponent',
            },
          ],
        },
        'middle',
        'targetComponent',
      ],
    });

    const parsed = await parseStudyConfig(JSON.stringify(config));
    const skipErrors = parsed.errors.filter((error) => error.category === 'skip-validation');

    expect(skipErrors).toHaveLength(0);
  });

  test('rejects a skip target that does not appear after the skip block', async () => {
    const config = buildConfig({
      order: 'fixed',
      components: [
        'targetComponent',
        {
          order: 'fixed',
          components: ['trial1'],
          skip: [
            {
              name: 'trial1',
              check: 'responses',
              to: 'targetComponent',
            },
          ],
        },
      ],
    });

    const parsed = await parseStudyConfig(JSON.stringify(config));
    const skipErrors = parsed.errors.filter((error) => error.category === 'skip-validation');

    expect(skipErrors.length).toBeGreaterThan(0);
    expect(skipErrors[0].message).toContain('Skip target `targetComponent` does not occur after the skip block it is used in');
  });

  test('accepts duplicate skip targets to the same component', async () => {
    const config = buildConfig({
      order: 'fixed',
      components: [
        {
          order: 'fixed',
          components: ['trial1'],
          skip: [
            {
              name: 'trial1',
              check: 'responses',
              to: 'targetComponent',
            },
          ],
        },
        'middle',
        {
          order: 'fixed',
          components: ['trial1'],
          skip: [
            {
              name: 'trial1',
              check: 'responses',
              to: 'targetComponent',
            },
          ],
        },
        'targetComponent',
      ],
    });

    const parsed = await parseStudyConfig(JSON.stringify(config));
    const skipErrors = parsed.errors.filter((error) => error.category === 'skip-validation');

    expect(skipErrors).toHaveLength(0);
  });

  test('accepts skip targets that point to a later block id', async () => {
    const config = buildConfig({
      order: 'fixed',
      components: [
        {
          order: 'fixed',
          components: ['trial1'],
          skip: [
            {
              name: 'trial1',
              check: 'responses',
              to: 'targetBlock',
            },
          ],
        },
        'middle',
        {
          id: 'targetBlock',
          order: 'fixed',
          components: ['targetBlockComponent'],
        },
      ],
    });

    const parsed = await parseStudyConfig(JSON.stringify(config));
    const skipErrors = parsed.errors.filter((error) => error.category === 'skip-validation');

    expect(skipErrors).toHaveLength(0);
  });

  test('accepts nested skip blocks that target a component later in the parent sequence', async () => {
    const config = buildConfig({
      order: 'fixed',
      components: [
        {
          order: 'fixed',
          components: [
            {
              order: 'fixed',
              components: ['trial1'],
              skip: [
                {
                  name: 'trial1',
                  check: 'responses',
                  to: 'targetComponent',
                },
              ],
            },
            'middle',
          ],
        },
        'targetComponent',
      ],
    });

    const parsed = await parseStudyConfig(JSON.stringify(config));
    const skipErrors = parsed.errors.filter((error) => error.category === 'skip-validation');

    expect(skipErrors).toHaveLength(0);
  });

  test('ignores skip targets pointing to end', async () => {
    const config = buildConfig({
      order: 'fixed',
      components: [
        {
          order: 'fixed',
          components: ['trial1'],
          skip: [
            {
              name: 'trial1',
              check: 'responses',
              to: 'end',
            },
          ],
        },
        'middle',
      ],
    });

    const parsed = await parseStudyConfig(JSON.stringify(config));
    const skipErrors = parsed.errors.filter((error) => error.category === 'skip-validation');

    expect(skipErrors).toHaveLength(0);
  });

  test('rejects skip target when block id exists but appears before the skip block', async () => {
    const config = buildConfig({
      order: 'fixed',
      components: [
        {
          id: 'targetBlock',
          order: 'fixed',
          components: ['targetBlockComponent'],
        },
        {
          order: 'fixed',
          components: ['trial1'],
          skip: [
            {
              name: 'trial1',
              check: 'responses',
              to: 'targetBlock',
            },
          ],
        },
      ],
    });

    const parsed = await parseStudyConfig(JSON.stringify(config));
    const skipErrors = parsed.errors.filter((error) => error.category === 'skip-validation');

    expect(skipErrors.length).toBeGreaterThan(0);
    expect(skipErrors[0].message).toContain('Skip target `targetBlock` does not occur after the skip block it is used in');
  });

  test('reports each unresolved skip target independently', async () => {
    const config = buildConfig({
      order: 'fixed',
      components: [
        {
          order: 'fixed',
          components: ['trial1'],
          skip: [
            {
              name: 'trial1',
              check: 'responses',
              to: 'missingTargetA',
            },
          ],
        },
        {
          order: 'fixed',
          components: ['trial1'],
          skip: [
            {
              name: 'trial1',
              check: 'responses',
              to: 'missingTargetB',
            },
          ],
        },
      ],
    });

    const parsed = await parseStudyConfig(JSON.stringify(config));
    const skipErrors = parsed.errors.filter((error) => error.category === 'skip-validation');

    expect(skipErrors).toHaveLength(2);
    expect(skipErrors.some((error) => error.message.includes('missingTargetA'))).toBe(true);
    expect(skipErrors.some((error) => error.message.includes('missingTargetB'))).toBe(true);
  });
});
