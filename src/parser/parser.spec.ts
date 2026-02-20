import {
  describe, expect, test, vi,
} from 'vitest';
import { parseStudyConfig } from './parser';
import { isDynamicBlock } from './utils';

// Mock the fetch function for library loading
global.fetch = vi.fn();

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
      expect(!isDynamicBlock(result.sequence)).toBe(true);
      if (!isDynamicBlock(result.sequence)) {
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

      expect(!isDynamicBlock(result.sequence)).toBe(true);
      if (!isDynamicBlock(result.sequence)) {
        expect(result.sequence.components).toHaveLength(1);
        const inlinedSequence = result.sequence.components[0];
        expect(typeof inlinedSequence).toBe('object');
        if (typeof inlinedSequence === 'object' && inlinedSequence !== null && !isDynamicBlock(inlinedSequence)) {
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

      expect(!isDynamicBlock(result.sequence)).toBe(true);
      if (!isDynamicBlock(result.sequence)) {
        expect(result.sequence.components).toHaveLength(1);
        const inlinedSequence = result.sequence.components[0];
        expect(typeof inlinedSequence).toBe('object');
        if (typeof inlinedSequence === 'object' && inlinedSequence !== null && !isDynamicBlock(inlinedSequence)) {
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

      expect(!isDynamicBlock(result.sequence)).toBe(true);
      if (!isDynamicBlock(result.sequence)) {
        expect(result.sequence.components[1]).toBe('$testLib.components.target');
        const firstComponent = result.sequence.components[0];
        expect(typeof firstComponent).toBe('object');
        if (typeof firstComponent === 'object' && firstComponent !== null && !isDynamicBlock(firstComponent)) {
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
});
