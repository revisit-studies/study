import {
  describe, expect, test, vi,
} from 'vitest';
import { ComponentBlock, StudyConfig } from './types';
import { parseStudyConfig } from './parser';
import { isDynamicBlock, isFactorSequence } from './utils';

// Mock the fetch function for library loading
global.fetch = vi.fn();

function isComponentBlock(value: unknown): value is ComponentBlock {
  return typeof value === 'object'
    && value !== null
    && 'components' in value
    && !isDynamicBlock(value as StudyConfig['sequence'])
    && !isFactorSequence(value as StudyConfig['sequence']);
}

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        text: () => Promise.resolve(JSON.stringify(mockLibraryConfig)),
      });

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

      // The component should be successfully resolved (no errors about missing baseComponent)
      // This proves that .co. was expanded to .components. and found the base component
      expect(result.errors).toBeDefined();
      const hasBaseComponentError = result.errors.some(
        (error) => error.message && error.message.includes('$testLib.components.baseComp') && error.message.includes('not defined'),
      );
      expect(hasBaseComponentError).toBe(false);

      // The component should exist and have the baseComponent reference
      const derivedComp = result.components.derivedComponent;
      expect(derivedComp).toBeDefined();
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        text: () => Promise.resolve(JSON.stringify(mockLibraryConfig)),
      });

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

      // Both components should be successfully resolved without errors
      // This proves .co. was expanded and found the base components
      const hasBaseComponentError = result.errors.some(
        (error) => error.message && error.message.includes('baseComp') && error.message.includes('not defined'),
      );
      expect(hasBaseComponentError).toBe(false);

      // Both components should exist
      const { derived1, derived2 } = result.components;
      expect(derived1).toBeDefined();
      expect(derived2).toBeDefined();
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        text: () => Promise.resolve(JSON.stringify(mockLibraryConfig)),
      });

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

      // Should successfully resolve without errors
      const hasBaseComponentError = result.errors.some(
        (error) => error.message && error.message.includes('baseComp') && error.message.includes('not defined'),
      );
      expect(hasBaseComponentError).toBe(false);

      const derivedComp = result.components.derivedComponent;
      expect(derivedComp).toBeDefined();
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

      // Should successfully resolve without errors
      const hasBaseComponentError = result.errors.some(
        (error) => error.message && error.message.includes('baseComp') && error.message.includes('not defined'),
      );
      expect(hasBaseComponentError).toBe(false);

      const derivedComp = result.components.derivedComponent;
      expect(derivedComp).toBeDefined();
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        text: () => Promise.resolve(JSON.stringify(mockLibraryConfig)),
      });

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

      // Should have an error about missing baseComponent
      // The error message should reference the expanded form (.components.)
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        text: () => Promise.resolve(JSON.stringify(mockLibraryConfig)),
      });

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

      // Check baseComponent expansion - component should be resolved without errors
      const hasBaseComponentError = result.errors.some(
        (error) => error.message && error.message.includes('baseComp') && error.message.includes('not defined'),
      );
      expect(hasBaseComponentError).toBe(false);

      const derivedComp = result.components.derivedComponent;
      expect(derivedComp).toBeDefined();
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        text: () => Promise.resolve(JSON.stringify(mockLibraryConfig)),
      });

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        text: () => Promise.resolve(JSON.stringify(mockLibraryConfig)),
      });

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        text: () => Promise.resolve(JSON.stringify(mockLibraryConfig)),
      });

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockResolvedValueOnce({
      text: () => Promise.resolve(JSON.stringify(mockLibraryConfig)),
    });

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockResolvedValueOnce({
      text: () => Promise.resolve(JSON.stringify(mockLibraryConfig)),
    });

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockResolvedValueOnce({
      text: () => Promise.resolve(JSON.stringify(mockLibraryConfig)),
    });

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockResolvedValueOnce({
      text: () => Promise.resolve(JSON.stringify(mockLibraryConfig)),
    });

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

  test('accepts nest order for factors and expands to nested fixed sequence', async () => {
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
        contactEmail: 'researcher@university.edu',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      baseComponents: {
        factorComponent: {
          type: 'react-component',
          path: 'test/assets/Factor.tsx',
          parameters: { label: `$${'{m}'}/$${'{n}'}` },
          response: [],
        },
      },
      components: {},
      factors: {
        m: ['m1', 'm2'],
        n: ['n1', 'n2', 'n3'],
      },
      sequence: {
        type: 'factor',
        action: 'nest',
        id: 'nestedFactors',
        values: [
          { factor: 'm' },
          { factor: 'n' },
        ],
        component: 'factorComponent',
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toEqual([]);
    expect(isComponentBlock(result.sequence)).toBe(true);
    if (isComponentBlock(result.sequence)) {
      expect(result.sequence.order).toBe('fixed');
      expect(result.sequence.components).toEqual([
        '_m1_n1',
        '_m1_n2',
        '_m1_n3',
        '_m2_n1',
        '_m2_n2',
        '_m2_n3',
      ]);
    }
    expect(result.components._m1_n1).toMatchObject({
      parameters: { label: 'm1/n1' },
    });
  });

  test('fills factor values from at-sign template tokens in generated component parameters', async () => {
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
        contactEmail: 'researcher@university.edu',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      baseComponents: {
        factorComponent: {
          type: 'react-component',
          path: 'test/assets/Factor.tsx',
          parameters: {
            label: '@m/@n',
            contact: 'researcher@example.edu',
            unknownToken: '@missing',
          },
          response: [],
        },
      },
      components: {},
      factors: {
        m: ['m1', 'm2'],
        n: ['n1', 'n2'],
      },
      sequence: {
        type: 'factor',
        action: 'nest',
        id: 'nestedFactors',
        values: [
          { factor: 'm' },
          { factor: 'n' },
        ],
        component: 'factorComponent',
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toEqual([]);
    expect(result.components._m2_n2).toMatchObject({
      parameters: {
        label: 'm2/n2',
        contact: 'researcher@example.edu',
        unknownToken: '@missing',
        m: 'm2',
        n: 'n2',
      },
    });
  });

  test('accepts cross action for factors and expands to crossed fixed sequence', async () => {
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
        contactEmail: 'researcher@university.edu',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      baseComponents: {
        factorComponent: {
          type: 'react-component',
          path: 'test/assets/Factor.tsx',
          parameters: { label: `$${'{m}'}/$${'{n}'}` },
          response: [],
        },
      },
      components: {},
      factors: {
        m: ['m1', 'm2'],
        n: ['n1', 'n2'],
      },
      sequence: {
        type: 'factor',
        action: 'cross',
        id: 'crossedFactors',
        values: [
          { factor: 'm' },
          { factor: 'n' },
        ],
        component: 'factorComponent',
        parameters: { label: `$${'{m}'}/$${'{n}'}` },
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toEqual([]);
    expect(isComponentBlock(result.sequence)).toBe(true);
    if (isComponentBlock(result.sequence)) {
      expect(result.sequence.order).toBe('fixed');
      expect(result.sequence.components).toEqual([
        '_m1_n1',
        '_m2_n2',
        '_m2_n1',
        '_m1_n2',
      ]);
    }
    expect(result.components._m2_n2).toMatchObject({
      parameters: { label: 'm2/n2' },
    });
  });

  test('accepts zip action for factors and expands to zipped fixed sequence', async () => {
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
        contactEmail: 'researcher@university.edu',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      baseComponents: {
        factorComponent: {
          type: 'react-component',
          path: 'test/assets/Factor.tsx',
          response: [],
        },
      },
      components: {},
      factors: {
        m: ['m1', 'm2'],
        n: ['n1', 'n2', 'n3'],
      },
      sequence: {
        type: 'factor',
        action: 'zip',
        id: 'zippedFactors',
        values: [
          { factor: 'm' },
          { factor: 'n' },
        ],
        component: 'factorComponent',
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toEqual([]);
    expect(isComponentBlock(result.sequence)).toBe(true);
    if (isComponentBlock(result.sequence)) {
      expect(result.sequence.order).toBe('fixed');
      expect(result.sequence.components).toEqual([
        '_m1_n1',
        '_m2_n2',
      ]);
    }
    expect(result.components._m2_n2).toMatchObject({
      parameters: { m: 'm2', n: 'n2' },
    });
  });

  test('accepts reusable top-level factors referenced from the sequence', async () => {
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
        contactEmail: 'researcher@university.edu',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      baseComponents: {
        factorComponent: {
          type: 'react-component',
          path: 'test/assets/Factor.tsx',
          response: [],
        },
      },
      components: {},
      factors: {
        m: ['m1', 'm2'],
        n: ['n1', 'n2', 'n3'],
        zippedFactors: {
          action: 'zip',
          order: 'random',
          values: [
            { factor: 'm' },
            { factor: 'n' },
          ],
          component: 'factorComponent',
        },
      },
      sequence: {
        order: 'fixed',
        components: [
          {
            type: 'factor',
            factor: 'zippedFactors',
          },
        ],
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toEqual([]);
    expect(isComponentBlock(result.sequence)).toBe(true);
    if (isComponentBlock(result.sequence)) {
      expect(result.sequence.components).toEqual([
        {
          id: 'zippedFactors',
          order: 'random',
          components: [
            '_m1_n1',
            '_m2_n2',
          ],
          skip: [],
        },
      ]);
    }
    expect(result.components._m1_n1).toMatchObject({
      parameters: { m: 'm1', n: 'n1' },
    });
  });

  test('accepts a derived factor as a factor of another reusable factor', async () => {
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
        contactEmail: 'researcher@university.edu',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      baseComponents: {
        factorComponent: {
          type: 'react-component',
          path: 'test/assets/Factor.tsx',
          response: [],
        },
      },
      components: {},
      factors: {
        data: ['d1', 'd2'],
        visType: ['v1', 'v2', 'v3'],
        task: ['t1', 't2'],
        zipDataVis: {
          action: 'zip',
          order: 'random',
          values: [
            { factor: 'data' },
            { factor: 'visType' },
          ],
          component: 'factorComponent',
        },
        zipThenTask: {
          action: 'nest',
          order: 'latinSquare',
          values: [
            { factor: 'zipDataVis' },
            { factor: 'task' },
          ],
          component: 'factorComponent',
        },
      },
      sequence: {
        order: 'fixed',
        components: [
          {
            type: 'factor',
            factor: 'zipThenTask',
          },
        ],
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toEqual([]);
    expect(isComponentBlock(result.sequence)).toBe(true);
    if (isComponentBlock(result.sequence)) {
      expect(result.sequence.components).toEqual([
        {
          id: 'zipThenTask',
          order: 'latinSquare',
          components: [
            '_d1_v1_t1',
            '_d1_v1_t2',
            '_d2_v2_t1',
            '_d2_v2_t2',
          ],
          skip: [],
        },
      ]);
    }
    expect(result.components._d2_v2_t2).toMatchObject({
      parameters: { data: 'd2', visType: 'v2', task: 't2' },
    });
  });

  test('reports cycles among reusable factors', async () => {
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
        contactEmail: 'researcher@university.edu',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      baseComponents: {
        factorComponent: {
          type: 'react-component',
          path: 'test/assets/Factor.tsx',
          response: [],
        },
      },
      components: {},
      factors: {
        a: {
          action: 'nest',
          values: [{ factor: 'b' }],
          component: 'factorComponent',
        },
        b: {
          action: 'nest',
          values: [{ factor: 'a' }],
          component: 'factorComponent',
        },
      },
      sequence: {
        type: 'factor',
        factor: 'a',
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toContainEqual(expect.objectContaining({
      message: 'Circular factor reference: a -> b -> a',
      instancePath: '/factors/',
    }));
  });

  test('warns when a between-subjects factor is not defined', async () => {
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
        contactEmail: 'researcher@university.edu',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      components: {
        intro: {
          type: 'questionnaire',
          response: [],
        },
      },
      factors: {
        data: ['d1', 'd2'],
      },
      betweenSubjectsFactors: ['missingFactor'],
      sequence: {
        order: 'fixed',
        components: ['intro'],
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toEqual([]);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      message: 'Between-subjects factor `missingFactor` is not defined in factors',
      instancePath: '/betweenSubjectsFactors/0',
    }));
  });

  test('uses factor values as parameters when factor and base component omit parameters', async () => {
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
        contactEmail: 'researcher@university.edu',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      baseComponents: {
        factorComponent: {
          type: 'react-component',
          path: 'test/assets/Factor.tsx',
          response: [],
        },
      },
      components: {},
      factors: {
        m: ['m1', 'm2'],
        n: ['n1', 'n2'],
      },
      sequence: {
        type: 'factor',
        action: 'cross',
        id: 'crossedFactors',
        values: [
          { factor: 'm' },
          { factor: 'n' },
        ],
        component: 'factorComponent',
      },
    };

    const result = await parseStudyConfig(JSON.stringify(studyConfig));

    expect(result.errors).toEqual([]);
    expect(result.components._m2_n2).toMatchObject({
      parameters: { m: 'm2', n: 'n2' },
    });
  });
});
