import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import { readFileSync } from 'node:fs';
import { ComponentBlock, StudyConfig } from '../types';
import { parseStudyConfig } from '../parser';
import { materializeParticipantConfig } from '../libraryParser';
import { isDynamicBlock, isFactorBlock } from '../utils';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';

global.fetch = vi.fn();

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function mockFetchText(body: string) {
  return { text: () => Promise.resolve(body) } as Response;
}

function isComponentBlock(value: unknown): value is ComponentBlock {
  return typeof value === 'object'
    && value !== null
    && 'components' in value
    && !isDynamicBlock(value as StudyConfig['sequence'])
    && !isFactorBlock(value as StudyConfig['sequence']);
}

describe('Text response validation config parsing', () => {
  function makeStudyConfig(validationType: string) {
    return {
      $schema: '',
      studyMetadata: {
        title: 'Text Validation Test',
        version: '1.0',
        authors: ['Test'],
        date: '2026-08-20',
        description: 'Ensures text validation rules are accepted.',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail: '',
        logoPath: '',
        withProgressBar: true,
        withSidebar: false,
      },
      components: {
        question1: {
          type: 'questionnaire',
          response: [
            {
              id: 'short',
              prompt: 'Short response',
              type: 'shortText',
              textValidation: [{ type: validationType, value: 'ReVISit' }],
            },
            {
              id: 'long',
              prompt: 'Long response',
              type: 'longText',
              textValidation: [{ type: validationType, value: 'ReVISit' }],
            },
          ],
        },
      },
      sequence: {
        order: 'fixed',
        components: ['question1'],
      },
    };
  }

  test.each(['matchesRegex', 'contains', 'doesNotContain', 'equals', 'doesNotEqual'])(
    'accepts the %s validation type for short and long text responses',
    async (validationType) => {
      const result = await parseStudyConfig(JSON.stringify(makeStudyConfig(validationType)));

      expect(result.errors).toEqual([]);
    },
  );

  test.each([0, 1])('rejects a malformed regular expression for response %s', async (responseIndex) => {
    const studyConfig = makeStudyConfig('matchesRegex');
    studyConfig.components.question1.response[responseIndex].textValidation[0].value = '[';

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toContainEqual(expect.objectContaining({
      message: 'matchesRegex value must be a valid regular expression',
      instancePath: `/components/question1/response/${responseIndex}/textValidation/0/value`,
    }));
  });

  test('accepts character and word length constraints for short and long text responses', async () => {
    const studyConfig = makeStudyConfig('contains');
    studyConfig.components.question1.response.forEach((response) => {
      Object.assign(response, {
        minCharLength: 3, maxCharLength: 100, minWordLength: 2, maxWordLength: 20,
      });
    });

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toEqual([]);
  });

  test.each([
    { name: 'minCharLength', value: -1 },
    { name: 'minCharLength', value: 1.5 },
    { name: 'maxCharLength', value: -1 },
    { name: 'maxCharLength', value: 1.5 },
    { name: 'minWordLength', value: -1 },
    { name: 'minWordLength', value: 1.5 },
    { name: 'maxWordLength', value: -1 },
    { name: 'maxWordLength', value: 1.5 },
  ])('rejects invalid $name constraint value $value for short and long text', async ({ name, value }) => {
    const studyConfig = makeStudyConfig('contains');
    studyConfig.components.question1.response.forEach((response) => {
      Object.assign(response, { [name]: value });
    });

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    [0, 1].forEach((responseIndex) => {
      expect(result.errors).toContainEqual(expect.objectContaining({
        message: `${name} must be a non-negative integer`,
        instancePath: `/components/question1/response/${responseIndex}/${name}`,
      }));
    });
  });

  test('accepts zero minimum length constraints', async () => {
    const studyConfig = makeStudyConfig('contains');
    studyConfig.components.question1.response.forEach((response) => {
      Object.assign(response, {
        minCharLength: 0, maxCharLength: 1, minWordLength: 0, maxWordLength: 1,
      });
    });

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toEqual([]);
  });

  test('warns about zero maximum length constraints for required text responses', async () => {
    const studyConfig = makeStudyConfig('contains');
    studyConfig.components.question1.response.forEach((response) => {
      Object.assign(response, { maxCharLength: 0, maxWordLength: 0 });
    });

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toEqual([]);
    [0, 1].forEach((responseIndex) => {
      expect(result.warnings).toContainEqual(expect.objectContaining({
        message: 'maxCharLength must be greater than zero for a required text response',
        instancePath: `/components/question1/response/${responseIndex}/maxCharLength`,
      }));
      expect(result.warnings).toContainEqual(expect.objectContaining({
        message: 'maxWordLength must be greater than zero for a required text response',
        instancePath: `/components/question1/response/${responseIndex}/maxWordLength`,
      }));
    });
  });

  test('accepts zero maximum length constraints for optional text responses', async () => {
    const studyConfig = makeStudyConfig('contains');
    studyConfig.components.question1.response.forEach((response) => {
      Object.assign(response, { required: false, maxCharLength: 0, maxWordLength: 0 });
    });

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toEqual([]);
  });

  test.each([0, 1])('warns when minCharLength is greater than maxCharLength for response %s', async (responseIndex) => {
    const studyConfig = makeStudyConfig('contains');
    Object.assign(studyConfig.components.question1.response[responseIndex], {
      minCharLength: 10,
      maxCharLength: 5,
    });

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toEqual([]);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      message: 'minCharLength must be less than or equal to maxCharLength',
      instancePath: `/components/question1/response/${responseIndex}`,
    }));
  });

  test.each([0, 1])('warns when minWordLength is greater than maxWordLength for response %s', async (responseIndex) => {
    const studyConfig = makeStudyConfig('contains');
    Object.assign(studyConfig.components.question1.response[responseIndex], {
      minWordLength: 10,
      maxWordLength: 5,
    });

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toEqual([]);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      message: 'minWordLength must be less than or equal to maxWordLength',
      instancePath: `/components/question1/response/${responseIndex}`,
    }));
  });

  test('warns when minWordLength cannot fit within maxCharLength', async () => {
    const studyConfig = makeStudyConfig('contains');
    Object.assign(studyConfig.components.question1.response[0], {
      minWordLength: 2,
      maxCharLength: 2,
    });

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toEqual([]);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      message: 'minWordLength of 2 requires at least 3 characters, which exceeds maxCharLength of 2',
      instancePath: '/components/question1/response/0',
    }));
  });

  test.each(['equals', 'contains', 'doesNotContain'])(
    'rejects an empty %s validation value',
    async (validationType) => {
      const studyConfig = makeStudyConfig(validationType);
      studyConfig.components.question1.response.forEach((response) => {
        response.textValidation[0].value = '';
      });

      const result = await parseStudyConfig(JSON.stringify(studyConfig));

      [0, 1].forEach((responseIndex) => {
        expect(result.errors).toContainEqual(expect.objectContaining({
          message: `${validationType} value must not be empty`,
          instancePath: `/components/question1/response/${responseIndex}/textValidation/0/value`,
        }));
      });
    },
  );

  test.each(['matchesRegex', 'doesNotEqual'])(
    'warns when an empty %s value does not restrict responses',
    async (validationType) => {
      const studyConfig = makeStudyConfig(validationType);
      studyConfig.components.question1.response.forEach((response) => {
        response.textValidation[0].value = '';
      });

      const result = await parseStudyConfig(JSON.stringify(studyConfig));

      expect(result.errors).toEqual([]);
      [0, 1].forEach((responseIndex) => {
        expect(result.warnings).toContainEqual(expect.objectContaining({
          message: `${validationType} value is empty and does not restrict participant responses`,
          instancePath: `/components/question1/response/${responseIndex}/textValidation/0/value`,
        }));
      });
    },
  );

  test('warns about direct contains and doesNotContain contradictions', async () => {
    const studyConfig = makeStudyConfig('contains');
    studyConfig.components.question1.response[0].textValidation = [
      { type: 'contains', value: 'ReVISit' },
      { type: 'doesNotContain', value: 'ReVISit' },
    ];

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toEqual([]);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      message: 'contains value `ReVISit` always includes doesNotContain value `ReVISit`',
      instancePath: '/components/question1/response/0/textValidation/1/value',
    }));
  });

  test('warns when equals conflicts with literal and length constraints', async () => {
    const studyConfig = makeStudyConfig('equals');
    Object.assign(studyConfig.components.question1.response[0], {
      maxCharLength: 6,
      textValidation: [
        { type: 'equals', value: 'ReVISit' },
        { type: 'contains', value: 'study' },
        { type: 'doesNotEqual', value: 'ReVISit' },
      ],
    });

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toEqual([]);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      message: 'equals value `ReVISit` conflicts with contains value `study`',
      instancePath: '/components/question1/response/0/textValidation/1/value',
    }));
    expect(result.warnings).toContainEqual(expect.objectContaining({
      message: 'equals value `ReVISit` conflicts with doesNotEqual value `ReVISit`',
      instancePath: '/components/question1/response/0/textValidation/2/value',
    }));
    expect(result.warnings).toContainEqual(expect.objectContaining({
      message: 'equals value `ReVISit` has 7 characters, which exceeds maxCharLength of 6',
      instancePath: '/components/question1/response/0/textValidation/0/value',
    }));
  });

  test('rejects the replaced minLength and maxLength properties', async () => {
    const studyConfig = makeStudyConfig('contains');
    Object.assign(studyConfig.components.question1.response[0], { minLength: 3, maxLength: 100 });

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors.some((error) => error.instancePath.includes('/components/question1/response/0'))).toBe(true);
  });

  test('validates text length constraints defined in base components', async () => {
    const studyConfig = makeStudyConfig('contains');
    Object.assign(studyConfig, {
      baseComponents: {
        sharedQuestion: {
          type: 'questionnaire',
          response: [{
            id: 'base-text',
            prompt: 'Base text response',
            type: 'shortText',
            minWordLength: -1,
          }],
        },
      },
    });

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toContainEqual(expect.objectContaining({
      message: 'minWordLength must be a non-negative integer',
      instancePath: '/baseComponents/sharedQuestion/response/0/minWordLength',
    }));
  });

  test('warns about unsatisfiable text length constraints after merging inherited components', async () => {
    const studyConfig = makeStudyConfig('contains');
    Object.assign(studyConfig, {
      baseComponents: {
        sharedQuestion: {
          type: 'questionnaire',
          response: [{
            id: 'inherited-text',
            prompt: 'Inherited text response',
            type: 'shortText',
            minCharLength: 10,
          }],
        },
      },
      components: {
        inheritedQuestion: {
          baseComponent: 'sharedQuestion',
          response: [{
            id: 'inherited-text',
            prompt: 'Inherited text response',
            type: 'shortText',
            maxCharLength: 5,
          }],
        },
      },
      sequence: {
        order: 'fixed',
        components: ['inheritedQuestion'],
      },
    });

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toEqual([]);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      message: 'minCharLength must be less than or equal to maxCharLength',
      instancePath: '/components/inheritedQuestion/response/0',
    }));
  });

  test('rejects an unsupported text validation type', async () => {
    const result = await parseStudyConfig(JSON.stringify(makeStudyConfig('startsWith')));

    expect(result.errors.some((error) => error.instancePath.includes('textValidation'))).toBe(true);
  });
});

describe('Component auto-advance config parsing', () => {
  test('accepts component-level auto-advance timeout options on a base component', async () => {
    const studyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Timeout Config Test',
        version: '1.0',
        authors: ['Test'],
        date: '2026-05-14',
        description: 'Ensures component timeout options are accepted.',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      baseComponents: {
        timedQuestion: {
          type: 'questionnaire',
          response: [],
          nextButtonAutoAdvanceTime: 5000,
          nextButtonAutoAdvanceWarningTime: 3000,
          nextButtonAutoAdvanceWarningMessage: 'Advancing in {seconds} {unit}.',
        },
      },
      components: {
        question1: {
          baseComponent: 'timedQuestion',
        },
      },
      sequence: {
        order: 'fixed',
        components: ['question1'],
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    const hasAutoAdvanceFieldError = result.errors.some(
      (error) => error.message?.includes('nextButtonAutoAdvance'),
    );
    expect(hasAutoAdvanceFieldError).toBe(false);
  });
});

describe('Next button alignment config parsing', () => {
  function makeStudyConfig(nextButtonAlignment: string, componentOverride?: string) {
    return {
      $schema: '',
      studyMetadata: {
        title: 'Next Button Alignment Test',
        version: '1.0',
        authors: ['Test'],
        date: '2026-07-16',
        description: 'Ensures next button alignment options are validated.',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        logoPath: '',
        withProgressBar: true,
        withSidebar: true,
        nextButtonAlignment,
      },
      components: {
        question1: {
          type: 'questionnaire',
          response: [],
          ...(componentOverride === undefined ? {} : { nextButtonAlignment: componentOverride }),
        },
      },
      sequence: {
        order: 'fixed',
        components: ['question1'],
      },
    };
  }

  test.each(['left', 'center', 'right'])('accepts the %s alignment globally and on a component', async (alignment) => {
    const result = await parseStudyConfig(JSON.stringify(makeStudyConfig(alignment, alignment)));

    expect(result.errors).toEqual([]);
  });

  test('rejects an unsupported alignment', async () => {
    const result = await parseStudyConfig(JSON.stringify(makeStudyConfig('stretch')));

    const hasAlignmentError = result.errors.some(
      (error) => error.instancePath?.includes('nextButtonAlignment'),
    );
    expect(hasAlignmentError).toBe(true);
  });
});

describe('BaseComponent Macro Expansion', () => {
  describe('.co. macro expansion in baseComponent references', () => {
    test('expands .co. to .components. in baseComponent field', async () => {
      const mockLibraryConfig = {
        $schema: '',
        description: 'Test library',
        components: {
          baseComp: {
            type: 'markdown',
            path: 'test.md',
            response: [],
          },
        },
        sequences: {},
      };

      vi.mocked(fetch).mockResolvedValueOnce(mockFetchText(JSON.stringify(mockLibraryConfig)));

      const studyConfig = {
        $schema: '',
        studyMetadata: {
          title: 'Test Study',
          version: '1.0',
          authors: ['Test'],
          date: '2024-01-01',
          description: 'Test',
          organizations: ['Test Org'],
        },
        uiConfig: {
          contactEmail: 'test@test.com',
          helpTextPath: '',
          logoPath: '',
          withProgressBar: true,
          autoDownloadStudy: false,
          withSidebar: true,
        },
        importedLibraries: ['testLib'],
        components: {
          derivedComponent: {
            baseComponent: '$testLib.co.baseComp',
          },
        },
        sequence: {
          order: 'fixed',
          components: ['derivedComponent'],
        },
      };

      const result = await parseStudyConfig(JSON.stringify(studyConfig));

      expect(result.errors).toBeDefined();
      const hasBaseComponentError = result.errors.some(
        (error) => error.message && error.message.includes('$testLib.components.baseComp') && error.message.includes('not defined'),
      );
      expect(hasBaseComponentError).toBe(false);
    });

    test('handles multiple components with .co. in baseComponent', async () => {
      const mockLibraryConfig = {
        $schema: '',
        description: 'Test library',
        components: {
          baseComp1: {
            type: 'markdown',
            path: 'test1.md',
            response: [],
          },
          baseComp2: {
            type: 'markdown',
            path: 'test2.md',
            response: [],
          },
        },
        sequences: {},
      };

      vi.mocked(fetch).mockResolvedValueOnce(mockFetchText(JSON.stringify(mockLibraryConfig)));

      const studyConfig = {
        $schema: '',
        studyMetadata: {
          title: 'Test Study',
          version: '1.0',
          authors: ['Test'],
          date: '2024-01-01',
          description: 'Test',
          organizations: ['Test Org'],
        },
        uiConfig: {
          contactEmail: 'test@test.com',
          helpTextPath: '',
          logoPath: '',
          withProgressBar: true,
          autoDownloadStudy: false,
          withSidebar: true,
        },
        importedLibraries: ['testLib'],
        components: {
          derived1: {
            baseComponent: '$testLib.co.baseComp1',
          },
          derived2: {
            baseComponent: '$testLib.co.baseComp2',
          },
        },
        sequence: {
          order: 'fixed',
          components: ['derived1', 'derived2'],
        },
      };

      const result = await parseStudyConfig(JSON.stringify(studyConfig));

      const hasBaseComponentError = result.errors.some(
        (error) => error.message && error.message.includes('baseComp') && error.message.includes('not defined'),
      );
      expect(hasBaseComponentError).toBe(false);
    });

    test('leaves .components. in baseComponent unchanged', async () => {
      const mockLibraryConfig = {
        $schema: '',
        description: 'Test library',
        components: {
          baseComp: {
            type: 'markdown',
            path: 'test.md',
            response: [],
          },
        },
        sequences: {},
      };

      vi.mocked(fetch).mockResolvedValueOnce(mockFetchText(JSON.stringify(mockLibraryConfig)));

      const studyConfig = {
        $schema: '',
        studyMetadata: {
          title: 'Test Study',
          version: '1.0',
          authors: ['Test'],
          date: '2024-01-01',
          description: 'Test',
          organizations: ['Test Org'],
        },
        uiConfig: {
          contactEmail: 'test@test.com',
          helpTextPath: '',
          logoPath: '',
          withProgressBar: true,
          autoDownloadStudy: false,
          withSidebar: true,
        },
        importedLibraries: ['testLib'],
        components: {
          derivedComponent: {
            baseComponent: '$testLib.components.baseComp',
          },
        },
        sequence: {
          order: 'fixed',
          components: ['derivedComponent'],
        },
      };

      const result = await parseStudyConfig(JSON.stringify(studyConfig));

      const hasBaseComponentError = result.errors.some(
        (error) => error.message && error.message.includes('baseComp') && error.message.includes('not defined'),
      );
      expect(hasBaseComponentError).toBe(false);
    });

    test('does not modify non-library baseComponent references', async () => {
      const studyConfig = {
        $schema: '',
        studyMetadata: {
          title: 'Test Study',
          version: '1.0',
          authors: ['Test'],
          date: '2024-01-01',
          description: 'Test',
          organizations: ['Test Org'],
        },
        uiConfig: {
          contactEmail: 'test@test.com',
          helpTextPath: '',
          logoPath: '',
          withProgressBar: true,
          autoDownloadStudy: false,
          withSidebar: true,
        },
        baseComponents: {
          localBase: {
            type: 'markdown',
            path: 'test.md',
            response: [],
          },
        },
        components: {
          derivedComponent: {
            baseComponent: 'localBase',
          },
        },
        sequence: {
          order: 'fixed',
          components: ['derivedComponent'],
        },
      };

      const result = await parseStudyConfig(JSON.stringify(studyConfig));

      const hasBaseComponentError = result.errors.some(
        (error) => error.message && error.message.includes('baseComp') && error.message.includes('not defined'),
      );
      expect(hasBaseComponentError).toBe(false);
    });

    test('generates correct error for missing baseComponent after expansion', async () => {
      const mockLibraryConfig = {
        $schema: '',
        description: 'Test library',
        components: {
          existingComp: {
            type: 'markdown',
            path: 'existing.md',
            response: [],
          },
        },
        sequences: {},
      };

      vi.mocked(fetch).mockResolvedValueOnce(mockFetchText(JSON.stringify(mockLibraryConfig)));

      const studyConfig = {
        $schema: '',
        studyMetadata: {
          title: 'Test Study',
          version: '1.0',
          authors: ['Test'],
          date: '2024-01-01',
          description: 'Test',
          organizations: ['Test Org'],
        },
        uiConfig: {
          contactEmail: 'test@test.com',
          helpTextPath: '',
          logoPath: '',
          withProgressBar: true,
          autoDownloadStudy: false,
          withSidebar: true,
        },
        importedLibraries: ['testLib'],
        components: {
          derivedComponent: {
            baseComponent: '$testLib.co.missingComp',
          },
        },
        sequence: {
          order: 'fixed',
          components: ['derivedComponent'],
        },
      };

      const result = await parseStudyConfig(JSON.stringify(studyConfig));

      expect(result.errors).toBeDefined();
      const hasExpectedError = result.errors.some(
        (error) => error.message && error.message.includes('$testLib.components.missingComp')
          && error.message.includes('not defined in baseComponents'),
      );
      expect(hasExpectedError).toBe(true);
    });
  });

  describe('Integration: baseComponent and sequence macros together', () => {
    test('expands both .co. in sequences and baseComponent fields', async () => {
      const mockLibraryConfig = {
        $schema: '',
        description: 'Test library',
        components: {
          baseComp: {
            type: 'markdown',
            path: 'test.md',
            response: [],
          },
          directComp: {
            type: 'markdown',
            path: 'direct.md',
            response: [],
          },
        },
        sequences: {},
      };

      vi.mocked(fetch).mockResolvedValueOnce(mockFetchText(JSON.stringify(mockLibraryConfig)));

      const studyConfig = {
        $schema: '',
        studyMetadata: {
          title: 'Test Study',
          version: '1.0',
          authors: ['Test'],
          date: '2024-01-01',
          description: 'Test',
          organizations: ['Test Org'],
        },
        uiConfig: {
          contactEmail: 'test@test.com',
          helpTextPath: '',
          logoPath: '',
          withProgressBar: true,
          autoDownloadStudy: false,
          withSidebar: true,
        },
        importedLibraries: ['testLib'],
        components: {
          derivedComponent: {
            baseComponent: '$testLib.co.baseComp',
          },
        },
        sequence: {
          order: 'fixed',
          components: [
            '$testLib.co.directComp',
            'derivedComponent',
          ],
        },
      };

      const result = await parseStudyConfig(JSON.stringify(studyConfig));

      // Check sequence expansion - the .co. should have been expanded to .components.
      expect(isComponentBlock(result.sequence)).toBe(true);
      if (isComponentBlock(result.sequence)) {
        expect(result.sequence.components).toContain('$testLib.components.directComp');
      }

      const hasBaseComponentError = result.errors.some(
        (error) => error.message && error.message.includes('baseComp') && error.message.includes('not defined'),
      );
      expect(hasBaseComponentError).toBe(false);
    });

    test('expands .se. in study sequence and inlines imported library sequence', async () => {
      const mockLibraryConfig = {
        $schema: '',
        description: 'Test library',
        components: {
          sequenceComp: {
            type: 'markdown',
            path: 'sequence.md',
            response: [],
          },
        },
        sequences: {
          sequenceFromLibrary: {
            order: 'fixed',
            components: ['$testLib.co.sequenceComp'],
          },
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce(mockFetchText(JSON.stringify(mockLibraryConfig)));

      const studyConfig = {
        $schema: '',
        studyMetadata: {
          title: 'Test Study',
          version: '1.0',
          authors: ['Test'],
          date: '2024-01-01',
          description: 'Test',
          organizations: ['Test Org'],
        },
        uiConfig: {
          contactEmail: 'test@test.com',
          helpTextPath: '',
          logoPath: '',
          withProgressBar: true,
          autoDownloadStudy: false,
          withSidebar: true,
        },
        importedLibraries: ['testLib'],
        components: {},
        sequence: {
          order: 'fixed',
          components: ['$testLib.se.sequenceFromLibrary'],
        },
      };

      const result = await parseStudyConfig(JSON.stringify(studyConfig));

      expect(isComponentBlock(result.sequence)).toBe(true);
      if (isComponentBlock(result.sequence)) {
        expect(result.sequence.components).toHaveLength(1);
        const inlinedSequence = result.sequence.components[0];
        expect(typeof inlinedSequence).toBe('object');
        if (isComponentBlock(inlinedSequence)) {
          expect(inlinedSequence.id).toBe('$testLib.sequences.sequenceFromLibrary');
          expect(inlinedSequence.components).toEqual(['$testLib.components.sequenceComp']);
        }
      }
    });

    test('expands .sequences. in study sequence and inlines imported library sequence', async () => {
      const mockLibraryConfig = {
        $schema: '',
        description: 'Test library',
        components: {
          sequenceComp: {
            type: 'markdown',
            path: 'sequence.md',
            response: [],
          },
        },
        sequences: {
          sequenceFromLibrary: {
            order: 'fixed',
            components: ['$testLib.co.sequenceComp'],
          },
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce(mockFetchText(JSON.stringify(mockLibraryConfig)));

      const studyConfig = {
        $schema: '',
        studyMetadata: {
          title: 'Test Study',
          version: '1.0',
          authors: ['Test'],
          date: '2024-01-01',
          description: 'Test',
          organizations: ['Test Org'],
        },
        uiConfig: {
          contactEmail: 'test@test.com',
          helpTextPath: '',
          logoPath: '',
          withProgressBar: true,
          autoDownloadStudy: false,
          withSidebar: true,
        },
        importedLibraries: ['testLib'],
        components: {},
        sequence: {
          order: 'fixed',
          components: ['$testLib.sequences.sequenceFromLibrary'],
        },
      };

      const result = await parseStudyConfig(JSON.stringify(studyConfig));

      expect(isComponentBlock(result.sequence)).toBe(true);
      if (isComponentBlock(result.sequence)) {
        expect(result.sequence.components).toHaveLength(1);
        const inlinedSequence = result.sequence.components[0];
        expect(typeof inlinedSequence).toBe('object');
        if (isComponentBlock(inlinedSequence)) {
          expect(inlinedSequence.id).toBe('$testLib.sequences.sequenceFromLibrary');
          expect(inlinedSequence.components).toEqual(['$testLib.components.sequenceComp']);
        }
      }
    });

    test('expands macros in interruptions and skip targets during parse', async () => {
      const mockLibraryConfig = {
        $schema: '',
        description: 'Test library',
        components: {
          trial: {
            type: 'markdown',
            path: 'trial.md',
            response: [],
          },
          breakComp: {
            type: 'markdown',
            path: 'break.md',
            response: [],
          },
          target: {
            type: 'markdown',
            path: 'target.md',
            response: [],
          },
        },
        sequences: {},
      };

      vi.mocked(fetch).mockResolvedValueOnce(mockFetchText(JSON.stringify(mockLibraryConfig)));

      const studyConfig = {
        $schema: '',
        studyMetadata: {
          title: 'Test Study',
          version: '1.0',
          authors: ['Test'],
          date: '2024-01-01',
          description: 'Test',
          organizations: ['Test Org'],
        },
        uiConfig: {
          contactEmail: 'test@test.com',
          helpTextPath: '',
          logoPath: '',
          withProgressBar: true,
          autoDownloadStudy: false,
          withSidebar: true,
        },
        importedLibraries: ['testLib'],
        components: {},
        sequence: {
          order: 'fixed',
          components: [
            {
              id: 'gateBlock',
              order: 'fixed',
              components: ['$testLib.co.trial'],
              interruptions: [
                {
                  spacing: 'random',
                  numInterruptions: 1,
                  components: ['$testLib.co.breakComp'],
                },
              ],
              skip: [
                {
                  name: '$testLib.components.trial',
                  check: 'response',
                  responseId: 'response1',
                  value: 'yes',
                  comparison: 'equal',
                  to: '$testLib.co.target',
                },
              ],
            },
            '$testLib.co.target',
          ],
        },
      };

      const result = await parseStudyConfig(JSON.stringify(studyConfig));

      expect(isComponentBlock(result.sequence)).toBe(true);
      if (isComponentBlock(result.sequence)) {
        expect(result.sequence.components[1]).toBe('$testLib.components.target');
        const firstComponent = result.sequence.components[0];
        expect(typeof firstComponent).toBe('object');
        if (isComponentBlock(firstComponent)) {
          expect(firstComponent.interruptions?.[0].components).toEqual(['$testLib.components.breakComp']);
          expect(firstComponent.skip?.[0].to).toBe('$testLib.components.target');
        }
      }

      const hasMissingComponentError = result.errors.some(
        (error) => error.message.includes('$testLib.co.breakComp') || error.message.includes('$testLib.co.target'),
      );
      expect(hasMissingComponentError).toBe(false);
    });
  });
});

describe('Parser Warnings', () => {
  test('adds sequence-validation error when conditional blocks are combined with random ordering', async () => {
    const studyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test Study',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      components: {
        intro: {
          type: 'markdown',
          path: 'intro.md',
          response: [],
        },
        conditionalComponent: {
          type: 'markdown',
          path: 'conditional.md',
          response: [],
        },
      },
      sequence: {
        order: 'random',
        components: [{
          id: 'conditionA',
          conditional: true,
          order: 'fixed',
          components: ['conditionalComponent'],
        }, 'intro'],
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    const conditionalOrderError = result.errors.find(
      (error) => error.category === 'sequence-validation'
        && error.message.includes('Conditional URL parameter assignment cannot be combined with random or latinSquare sequence ordering'),
    );
    expect(conditionalOrderError).toBeDefined();
  });

  test('does not add sequence-validation error when a latinSquare block is conditional', async () => {
    const studyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test Study',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      components: {
        intro: {
          type: 'markdown',
          path: 'intro.md',
          response: [],
        },
        conditionalA: {
          type: 'markdown',
          path: 'a.md',
          response: [],
        },
        conditionalB: {
          type: 'markdown',
          path: 'b.md',
          response: [],
        },
      },
      sequence: {
        order: 'fixed',
        components: [
          'intro',
          {
            id: 'conditionA',
            conditional: true,
            order: 'latinSquare',
            components: ['conditionalA', 'conditionalB'],
          },
        ],
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    const conditionalOrderError = result.errors.find(
      (error) => error.category === 'sequence-validation'
        && error.message.includes('Conditional URL parameter assignment cannot be combined with random or latinSquare sequence ordering'),
    );
    expect(conditionalOrderError).toBeUndefined();
  });

  test('does not add sequence-validation error when a random block is conditional', async () => {
    const studyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test Study',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      components: {
        intro: {
          type: 'markdown',
          path: 'intro.md',
          response: [],
        },
        conditionalA: {
          type: 'markdown',
          path: 'a.md',
          response: [],
        },
        conditionalB: {
          type: 'markdown',
          path: 'b.md',
          response: [],
        },
      },
      sequence: {
        order: 'fixed',
        components: [
          'intro',
          {
            id: 'conditionA',
            conditional: true,
            order: 'random',
            components: ['conditionalA', 'conditionalB'],
          },
        ],
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    const conditionalOrderError = result.errors.find(
      (error) => error.category === 'sequence-validation'
        && error.message.includes('Conditional URL parameter assignment cannot be combined with random or latinSquare sequence ordering'),
    );
    expect(conditionalOrderError).toBeUndefined();
  });

  test('adds sequence-validation error when a conditional block is inside a latinSquare block', async () => {
    const studyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test Study',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      components: {
        intro: {
          type: 'markdown',
          path: 'intro.md',
          response: [],
        },
        conditionalA: {
          type: 'markdown',
          path: 'a.md',
          response: [],
        },
        conditionalB: {
          type: 'markdown',
          path: 'b.md',
          response: [],
        },
      },
      sequence: {
        order: 'fixed',
        components: [
          'intro',
          {
            order: 'latinSquare',
            components: [
              'conditionalA',
              {
                id: 'conditionA',
                conditional: true,
                order: 'fixed',
                components: ['conditionalB'],
              },
            ],
          },
        ],
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    const conditionalOrderError = result.errors.find(
      (error) => error.category === 'sequence-validation'
        && error.message.includes('Conditional URL parameter assignment cannot be combined with random or latinSquare sequence ordering'),
    );
    expect(conditionalOrderError).toBeDefined();
  });

  test('does not add sequence-validation error when conditional blocks are combined with dynamic ordering', async () => {
    const studyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test Study',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      components: {
        intro: {
          type: 'markdown',
          path: 'intro.md',
          response: [],
        },
      },
      sequence: {
        order: 'fixed',
        components: [
          'intro',
          {
            id: 'conditionA',
            conditional: true,
            order: 'dynamic',
            functionPath: 'dynamic-function.js',
          },
        ],
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    const conditionalOrderError = result.errors.find(
      (error) => error.category === 'sequence-validation'
        && error.message.includes('Conditional URL parameter assignment cannot be combined with random or latinSquare sequence ordering'),
    );
    expect(conditionalOrderError).toBeUndefined();
  });

  test('validates skip targets for dynamic and runtime factor blocks', async () => {
    const studyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Skip target test',
        version: '1.0',
        authors: ['Test'],
        date: '2026-08-20',
        description: 'Checks compiled sequence skip targets.',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        logoPath: '',
        withProgressBar: true,
        withSidebar: false,
      },
      baseComponents: {
        trial: {
          type: 'markdown',
          path: 'trial.md',
          response: [],
        },
      },
      components: {
        trial: {
          type: 'markdown',
          path: 'trial.md',
          response: [],
        },
      },
      factors: {
        ordered: {
          values: ['A', 'B'],
          order: 'random',
        },
      },
      sequence: {
        order: 'fixed',
        components: [
          {
            order: 'fixed',
            components: ['trial'],
            skip: [{ name: 'trial', check: 'responses', to: 'dynamicGate' }],
          },
          {
            id: 'dynamicGate',
            order: 'dynamic',
            functionPath: 'dynamic-function.js',
          },
          {
            order: 'fixed',
            components: ['trial'],
            skip: [{ name: 'trial', check: 'responses', to: 'factorGate' }],
          },
          {
            type: 'factor',
            id: 'factorGate',
            factor: 'ordered',
            components: 'trial',
          },
        ],
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors.filter((error) => error.category === 'skip-validation')).toEqual([]);
    expect(result.warnings.filter((warning) => warning.category === 'unused-component')).toEqual([]);
  });

  test('adds sequence-validation warning for empty components block', async () => {
    const studyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test Study',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      components: {
        testComponent: {
          type: 'markdown',
          path: 'test.md',
          response: [],
        },
      },
      sequence: {
        order: 'fixed',
        components: [],
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    const emptySequenceWarning = result.warnings.find(
      (warning) => warning.category === 'sequence-validation' && warning.message === 'Sequence has an empty components array',
    );

    expect(emptySequenceWarning).toBeDefined();
    expect(emptySequenceWarning?.instancePath).toBe('/sequence/');
    expect((emptySequenceWarning?.params as { action: string }).action).toBe('Remove empty components block or add components to the sequence');
  });

  test('adds unused-component warning with expected message and action', async () => {
    const studyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test Study',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      components: {
        testComponent: {
          type: 'markdown',
          path: 'test.md',
          response: [],
        },
      },
      sequence: {
        order: 'fixed',
        components: [],
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    const unusedComponentWarning = result.warnings.find(
      (warning) => warning.category === 'unused-component' && warning.message.includes('Component `testComponent` is defined in components object but not used deterministically in the sequence'),
    );

    expect(unusedComponentWarning).toBeDefined();
    expect(unusedComponentWarning?.instancePath).toBe('/components/');
    expect((unusedComponentWarning?.params as { action: string }).action).toBe('Remove the component from the components object or add it to the sequence');
  });

  test('adds unused-component warning for components not used in sequence', async () => {
    const studyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test Study',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      components: {
        usedComponent: {
          type: 'markdown',
          path: 'used.md',
          response: [],
        },
        unusedComponent: {
          type: 'markdown',
          path: 'unused.md',
          response: [],
        },
      },
      sequence: {
        order: 'fixed',
        components: ['usedComponent'],
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    const hasUnusedWarning = result.warnings.some(
      (warning) => warning.category === 'unused-component' && warning.message.includes('unusedComponent'),
    );
    expect(hasUnusedWarning).toBe(true);
  });

  test('adds disabled-sidebar warning when sidebar location is used but sidebar is disabled', async () => {
    const studyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test Study',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: false,
      },
      components: {
        sidebarComponent: {
          type: 'markdown',
          path: 'sidebar.md',
          response: [
            {
              id: 'sidebarResponse',
              type: 'shortText',
              prompt: 'Sidebar response',
              location: 'sidebar',
            },
          ],
        },
      },
      sequence: {
        order: 'fixed',
        components: ['sidebarComponent'],
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    const hasDisabledSidebarWarning = result.warnings.some(
      (warning) => warning.category === 'disabled-sidebar' && warning.message.includes('sidebarComponent'),
    );
    expect(hasDisabledSidebarWarning).toBe(true);
  });

  test('adds disabled-sidebar warning when inherited component uses sidebar locations from base component', async () => {
    const studyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test Study',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      baseComponents: {
        baseSidebarComponent: {
          type: 'markdown',
          path: 'sidebar.md',
          withSidebar: false,
          response: [
            {
              id: 'sidebarResponse',
              type: 'shortText',
              prompt: 'Sidebar response',
              location: 'sidebar',
            },
          ],
        },
      },
      components: {
        inheritedSidebarComponent: {
          baseComponent: 'baseSidebarComponent',
        },
      },
      sequence: {
        order: 'fixed',
        components: ['inheritedSidebarComponent'],
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    const hasDisabledSidebarWarning = result.warnings.some(
      (warning) => warning.category === 'disabled-sidebar'
        && warning.message.includes('inheritedSidebarComponent')
        && warning.instancePath === '/baseComponents/',
    );
    expect(hasDisabledSidebarWarning).toBe(true);
  });

  test('does not duplicate disabled-sidebar warnings for imported library components', async () => {
    const mockLibraryConfig = {
      $schema: '',
      description: 'Test library',
      components: {
        baseComp: {
          type: 'markdown',
          path: 'test.md',
          response: [
            {
              id: 'sidebarResponse',
              type: 'shortText',
              prompt: 'Sidebar response',
              location: 'sidebar',
            },
          ],
        },
      },
      sequences: {},
    };

    vi.mocked(fetch).mockResolvedValueOnce(mockFetchText(JSON.stringify(mockLibraryConfig)));

    const studyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test Study',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: false,
      },
      importedLibraries: ['testLib'],
      components: {
        derivedComponent: {
          baseComponent: '$testLib.components.baseComp',
        },
      },
      sequence: {
        order: 'fixed',
        components: ['derivedComponent'],
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    const disabledSidebarWarnings = result.warnings.filter(
      (warning) => warning.category === 'disabled-sidebar',
    );
    expect(disabledSidebarWarnings).toHaveLength(1);
    expect(disabledSidebarWarnings[0].instancePath).toBe('/importedLibraries/testLib/uiConfig/');
  });

  test('adds disabled-sidebar warning when component disables sidebar inherited from imported base component', async () => {
    const mockLibraryConfig = {
      $schema: '',
      description: 'Test library',
      components: {
        baseComp: {
          type: 'markdown',
          path: 'test.md',
          response: [
            {
              id: 'sidebarResponse',
              type: 'shortText',
              prompt: 'Sidebar response',
              location: 'sidebar',
            },
          ],
        },
      },
      sequences: {},
    };

    vi.mocked(fetch).mockResolvedValueOnce(mockFetchText(JSON.stringify(mockLibraryConfig)));

    const studyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test Study',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      importedLibraries: ['testLib'],
      components: {
        derivedComponent: {
          baseComponent: '$testLib.components.baseComp',
          withSidebar: false,
        },
      },
      sequence: {
        order: 'fixed',
        components: ['derivedComponent'],
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    const matchingWarnings = result.warnings.filter(
      (warning) => warning.category === 'disabled-sidebar'
        && warning.message.includes('derivedComponent')
        && warning.instancePath === '/components/',
    );
    expect(matchingWarnings).toHaveLength(1);
  });

  test('reports missing base component from imported library after namespacing merge', async () => {
    const mockLibraryConfig = {
      $schema: '',
      description: 'Test library',
      components: {
        derivedComp: {
          baseComponent: 'missingBase',
        },
      },
      sequences: {},
    };

    vi.mocked(fetch).mockResolvedValueOnce(mockFetchText(JSON.stringify(mockLibraryConfig)));

    const studyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test Study',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      importedLibraries: ['testLib'],
      components: {},
      sequence: {
        order: 'fixed',
        components: ['$testLib.components.derivedComp'],
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    const missingBaseErrors = result.errors.filter(
      (error) => error.category === 'undefined-base-component'
        && error.instancePath === '/importedLibraries/testLib/baseComponents/'
        && error.message.includes('missingBase'),
    );
    expect(missingBaseErrors).toHaveLength(1);
  });

  test('attributes imported inherited sidebar warning to library baseComponents after merge', async () => {
    const mockLibraryConfig = {
      $schema: '',
      description: 'Test library',
      baseComponents: {
        baseComp: {
          type: 'markdown',
          path: 'test.md',
          withSidebar: false,
          response: [
            {
              id: 'sidebarResponse',
              type: 'shortText',
              prompt: 'Sidebar response',
              location: 'sidebar',
            },
          ],
        },
      },
      components: {
        derivedComp: {
          baseComponent: 'baseComp',
        },
      },
      sequences: {},
    };

    vi.mocked(fetch).mockResolvedValueOnce(mockFetchText(JSON.stringify(mockLibraryConfig)));

    const studyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test Study',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      importedLibraries: ['testLib'],
      components: {},
      sequence: {
        order: 'fixed',
        components: ['$testLib.components.derivedComp'],
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    const inheritedSidebarWarnings = result.warnings.filter(
      (warning) => warning.category === 'disabled-sidebar'
        && warning.message.includes('$testLib.components.derivedComp')
        && warning.instancePath === '/importedLibraries/testLib/baseComponents/',
    );
    expect(inheritedSidebarWarnings).toHaveLength(1);
  });

  function buildContactEmailStudyConfig(contactEmail: string) {
    return {
      $schema: '',
      studyMetadata: {
        title: 'Test Study',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail,
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      components: {
        testComponent: {
          type: 'markdown',
          path: 'test.md',
          response: [],
        },
      },
      sequence: {
        order: 'fixed',
        components: ['testComponent'],
      },
    };
  }

  test('adds default-contact-email warning when contactEmail is contact@revisit.dev and not on a ReVISit domain', async () => {
    vi.stubGlobal('window', { location: { hostname: 'example.com' } });

    const result = await parseStudyConfig(JSON.stringify(buildContactEmailStudyConfig('contact@revisit.dev')));
    vi.unstubAllGlobals();

    const contactEmailWarning = result.warnings.find(
      (warning) => warning.category === 'default-contact-email',
    );

    expect(contactEmailWarning).toBeDefined();
    expect(contactEmailWarning?.instancePath).toBe('/uiConfig/contactEmail');
    expect((contactEmailWarning?.params as { action: string }).action).toBe('Update the contactEmail field in uiConfig to your own email address');
  });

  test('does not add default-contact-email warning when contactEmail is contact@revisit.dev and hosted on revisit.dev', async () => {
    vi.stubGlobal('window', { location: { hostname: 'revisit.dev' } });

    const result = await parseStudyConfig(JSON.stringify(buildContactEmailStudyConfig('contact@revisit.dev')));
    vi.unstubAllGlobals();

    const contactEmailWarning = result.warnings.find(
      (warning) => warning.category === 'default-contact-email',
    );

    expect(contactEmailWarning).toBeUndefined();
  });

  test('does not add default-contact-email warning when contactEmail is contact@revisit.dev and hosted on vdl.sci.utah.edu', async () => {
    vi.stubGlobal('window', { location: { hostname: 'vdl.sci.utah.edu' } });

    const result = await parseStudyConfig(JSON.stringify(buildContactEmailStudyConfig('contact@revisit.dev')));
    vi.unstubAllGlobals();

    const contactEmailWarning = result.warnings.find(
      (warning) => warning.category === 'default-contact-email',
    );

    expect(contactEmailWarning).toBeUndefined();
  });

  test('does not add default-contact-email warning when contactEmail is contact@revisit.dev on localhost', async () => {
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });

    const result = await parseStudyConfig(JSON.stringify(buildContactEmailStudyConfig('contact@revisit.dev')));
    vi.unstubAllGlobals();

    const contactEmailWarning = result.warnings.find(
      (warning) => warning.category === 'default-contact-email',
    );

    expect(contactEmailWarning).toBeUndefined();
  });

  test('does not add default-contact-email warning when a custom email is used', async () => {
    vi.stubGlobal('window', { location: { hostname: 'example.com' } });

    const result = await parseStudyConfig(JSON.stringify(buildContactEmailStudyConfig('researcher@university.edu')));
    vi.unstubAllGlobals();

    const contactEmailWarning = result.warnings.find(
      (warning) => warning.category === 'default-contact-email',
    );

    expect(contactEmailWarning).toBeUndefined();
  });

  test('adds default-firebase-config warning for the default Firebase project on a custom host', async () => {
    vi.stubEnv('VITE_STORAGE_ENGINE', 'firebase');
    vi.stubEnv('VITE_FIREBASE_CONFIG', JSON.stringify({ projectId: 'revisit-utah' }));
    vi.stubGlobal('window', { location: { hostname: 'study.example.com' } });

    const result = await parseStudyConfig(JSON.stringify(buildContactEmailStudyConfig('researcher@university.edu')));

    const defaultFirebaseWarning = result.warnings.find(
      (warning) => warning.category === 'default-firebase-config',
    );

    expect(defaultFirebaseWarning).toBeDefined();
    expect(defaultFirebaseWarning?.instancePath).toBe('environment/VITE_FIREBASE_CONFIG');
    expect(defaultFirebaseWarning?.message).toContain('default Firebase project');
    expect(defaultFirebaseWarning?.message).toContain('backend controlled by the study designer');
  });

  test('adds default-firebase-config warning when authDomain identifies the default Firebase project', async () => {
    vi.stubEnv('VITE_STORAGE_ENGINE', 'firebase');
    vi.stubEnv('VITE_FIREBASE_CONFIG', JSON.stringify({ authDomain: 'revisit-utah.firebaseapp.com' }));
    vi.stubGlobal('window', { location: { hostname: 'study.example.com' } });

    const result = await parseStudyConfig(JSON.stringify(buildContactEmailStudyConfig('researcher@university.edu')));

    expect(result.warnings.some((warning) => warning.category === 'default-firebase-config')).toBe(true);
  });

  test('adds default-firebase-config warning when storageBucket identifies the default Firebase project', async () => {
    vi.stubEnv('VITE_STORAGE_ENGINE', 'firebase');
    vi.stubEnv('VITE_FIREBASE_CONFIG', JSON.stringify({ storageBucket: 'revisit-utah.appspot.com' }));
    vi.stubGlobal('window', { location: { hostname: 'study.example.com' } });

    const result = await parseStudyConfig(JSON.stringify(buildContactEmailStudyConfig('researcher@university.edu')));

    expect(result.warnings.some((warning) => warning.category === 'default-firebase-config')).toBe(true);
  });

  test('does not add default-firebase-config warning for a custom Firebase project', async () => {
    vi.stubEnv('VITE_STORAGE_ENGINE', 'firebase');
    vi.stubEnv('VITE_FIREBASE_CONFIG', JSON.stringify({ projectId: 'research-owned-project' }));
    vi.stubGlobal('window', { location: { hostname: 'study.example.com' } });

    const result = await parseStudyConfig(JSON.stringify(buildContactEmailStudyConfig('researcher@university.edu')));

    expect(result.warnings.some((warning) => warning.category === 'default-firebase-config')).toBe(false);
  });

  test.each([
    ['supabase'],
    ['localStorage'],
  ])('does not add default-firebase-config warning when storage engine is %s', async (storageEngine) => {
    vi.stubEnv('VITE_STORAGE_ENGINE', storageEngine);
    vi.stubEnv('VITE_FIREBASE_CONFIG', JSON.stringify({ projectId: 'revisit-utah' }));
    vi.stubGlobal('window', { location: { hostname: 'study.example.com' } });

    const result = await parseStudyConfig(JSON.stringify(buildContactEmailStudyConfig('researcher@university.edu')));

    expect(result.warnings.some((warning) => warning.category === 'default-firebase-config')).toBe(false);
  });

  test.each([
    ['localhost'],
    ['revisit.dev'],
    ['study.revisit.dev'],
    ['vdl.sci.utah.edu'],
    ['study.vdl.sci.utah.edu'],
  ])('does not add default-firebase-config warning on %s', async (hostname) => {
    vi.stubEnv('VITE_STORAGE_ENGINE', 'firebase');
    vi.stubEnv('VITE_FIREBASE_CONFIG', JSON.stringify({ projectId: 'revisit-utah' }));
    vi.stubGlobal('window', { location: { hostname } });

    const result = await parseStudyConfig(JSON.stringify(buildContactEmailStudyConfig('researcher@university.edu')));

    expect(result.warnings.some((warning) => warning.category === 'default-firebase-config')).toBe(false);
  });

  test('adds default-supabase-config warning when Supabase URL is a revisit.dev domain on a custom host', async () => {
    vi.stubEnv('VITE_STORAGE_ENGINE', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.revisit.dev');
    vi.stubGlobal('window', { location: { hostname: 'study.example.com' } });

    const result = await parseStudyConfig(JSON.stringify(buildContactEmailStudyConfig('researcher@university.edu')));

    const defaultSupabaseWarning = result.warnings.find(
      (warning) => warning.category === 'default-supabase-config',
    );

    expect(defaultSupabaseWarning).toBeDefined();
    expect(defaultSupabaseWarning?.instancePath).toBe('environment/VITE_SUPABASE_URL');
    expect(defaultSupabaseWarning?.message).toContain('default Supabase project');
    expect(defaultSupabaseWarning?.message).toContain('backend controlled by the study designer');
  });

  test('does not add default-supabase-config warning for a custom Supabase URL', async () => {
    vi.stubEnv('VITE_STORAGE_ENGINE', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://research-project.supabase.co');
    vi.stubGlobal('window', { location: { hostname: 'study.example.com' } });

    const result = await parseStudyConfig(JSON.stringify(buildContactEmailStudyConfig('researcher@university.edu')));

    expect(result.warnings.some((warning) => warning.category === 'default-supabase-config')).toBe(false);
  });

  test('does not add default-supabase-config warning on local or ReVISit-controlled hosts', async () => {
    vi.stubEnv('VITE_STORAGE_ENGINE', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.revisit.dev');
    vi.stubGlobal('window', { location: { hostname: 'revisit.dev' } });

    const result = await parseStudyConfig(JSON.stringify(buildContactEmailStudyConfig('researcher@university.edu')));

    expect(result.warnings.some((warning) => warning.category === 'default-supabase-config')).toBe(false);
  });

  test('keeps Zach\'s factor demo valid', async () => {
    const config = readFileSync('public/demo-factors/config.json', 'utf8');
    const result = await parseStudyConfig(config);

    expect(result.errors).toEqual([]);
  });

  test('parses the factorized correlation study', async () => {
    const config = readFileSync('public/incentives-corr/config.json', 'utf8');
    const result = await parseStudyConfig(config);
    const generatedComponents = Object.values(result.components);

    expect(result.errors).toEqual([]);
    expect(generatedComponents.filter((component) => (
      'parameters' in component && component.parameters?.taskid === 'test'
    ))).toHaveLength(65);
    expect(generatedComponents.filter((component) => (
      'parameters' in component && component.parameters?.r1Training !== undefined
    ))).toHaveLength(9);
    expect(generatedComponents.filter((component) => (
      'parameters' in component
      && component.parameters?.r1Training !== undefined
    )).map((component) => (
      'parameters' in component
        ? [component.parameters?.r1Training, component.parameters?.r2Training]
        : []
    ))).toEqual(expect.arrayContaining([
      [0.3, 0.7],
      [0.9, 0.6],
      [0.6, 0.3],
      [0.6, 0.9],
      [0.3, 0.1],
      [0.5, 0.3],
      [0.9, 0.8],
      [0.6, 0.7],
      [0.99, 0.9],
    ]));

    const sequences = generateSequenceArray({
      ...result,
      uiConfig: { ...result.uiConfig, numSequences: 4 },
    });
    expect(sequences.map((sequence) => sequence.parameters)).toEqual([
      { incentive: 'base', vis: 'pcp' },
      { incentive: 'base', vis: 'scatter' },
      { incentive: 'inc', vis: 'pcp' },
      { incentive: 'inc', vis: 'scatter' },
    ]);
    sequences.forEach((sequence) => {
      const componentNames = getSequenceFlatMap(sequence);
      const sequenceComponents = componentNames.map((name) => result.components[name]).filter(Boolean);
      const incentive = sequence.parameters?.incentive;
      const vis = sequence.parameters?.vis;
      const runtimeConfig = materializeParticipantConfig(result, sequence.parameters || {});
      expect(componentNames).toContain('introduction');
      expect(componentNames).toContain('task-details');
      expect(runtimeConfig.components.introduction).toMatchObject({
        path: `incentives-corr/assets/00-intro-${incentive}.md`,
      });
      expect(runtimeConfig.components['task-details']).toMatchObject({
        path: `incentives-corr/assets/04-instructions-${incentive}.md`,
      });
      expect(runtimeConfig.components.tutorial).toMatchObject({
        path: `incentives-corr/assets/02-tutorial-${vis}.md`,
      });
      expect(sequenceComponents.filter((component) => (
        'parameters' in component && component.parameters?.taskid === 'test'
      ))).toHaveLength(65);
      expect(sequenceComponents.filter((component) => (
        'parameters' in component && component.parameters?.taskid === 'attention'
      ))).toHaveLength(5);
      expect(sequenceComponents.filter((component) => (
        'parameters' in component && component.parameters?.r1Training !== undefined
      ))).toHaveLength(9);
    });
  });
});

describe('React component path validation', () => {
  function makeReactComponentStudyConfig(path: string) {
    return {
      $schema: '',
      studyMetadata: {
        title: 'React Path Test',
        version: '1.0',
        authors: ['Test'],
        date: '2026-08-22',
        description: 'Ensures react-component path validation behaves as expected.',
        organizations: ['Test Org'],
      },
      uiConfig: {
        contactEmail: '',
        logoPath: '',
        withProgressBar: true,
        withSidebar: false,
      },
      components: {
        trial: {
          type: 'react-component',
          path,
          response: [],
        },
      },
      sequence: {
        order: 'fixed',
        components: ['trial'],
      },
    };
  }

  test('accepts a real path under src/public', async () => {
    const result = await parseStudyConfig(JSON.stringify(
      makeReactComponentStudyConfig('demo-react-trrack/assets/DemoReactTrrack.tsx'),
    ));

    expect(result.errors).not.toContainEqual(expect.objectContaining({ message: 'Unresolved path' }));
  });

  test('rejects a path that does not resolve to a real file', async () => {
    const result = await parseStudyConfig(JSON.stringify(
      makeReactComponentStudyConfig('demo-react-trrack/assets/DoesNotExist.tsx'),
    ));

    expect(result.errors).toContainEqual(expect.objectContaining({
      message: 'Unresolved path',
      instancePath: '/components/trial/path',
    }));
  });

  test('does not flag a Handlebars-templated path, since it can only resolve at runtime', async () => {
    const result = await parseStudyConfig(JSON.stringify(
      makeReactComponentStudyConfig('demo-react-trrack/assets/{{file}}.tsx'),
    ));

    expect(result.errors).not.toContainEqual(expect.objectContaining({ message: 'Unresolved path' }));
  });

  test('rejects a path with malformed Handlebars syntax instead of treating it as templated', async () => {
    const result = await parseStudyConfig(JSON.stringify(
      makeReactComponentStudyConfig('demo-react-trrack/assets/{{file.tsx'),
    ));

    expect(result.errors).toContainEqual(expect.objectContaining({
      message: 'Unresolved path',
      instancePath: '/components/trial/path',
    }));
  });

  test.each([
    'demo-react-trrack/assets/{{#if file}}thing.tsx',
    'demo-react-trrack/assets/{{else}}.tsx',
    'demo-react-trrack/assets/{{! comment}}missing.tsx',
    'demo-react-trrack/assets/{{"literal"}}.tsx',
    'demo-react-trrack/assets/{{> missingPartial}}.tsx',
  ])('rejects a path with no valid runtime expression: %s', async (path) => {
    const result = await parseStudyConfig(JSON.stringify(makeReactComponentStudyConfig(path)));

    expect(result.errors).toContainEqual(expect.objectContaining({
      message: 'Unresolved path',
      instancePath: '/components/trial/path',
    }));
  });
});
