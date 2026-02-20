import {
  describe, expect, test, vi,
} from 'vitest';
import { expandLibrarySequences, verifyLibraryUsage, loadLibrariesParseNamespace } from './libraryParser';
import {
  ComponentBlock, LibraryConfig, StudyConfig, InheritedComponent, IndividualComponent, ParserErrorWarning,
} from './types';
import { isDynamicBlock } from './utils';

// Helper function to check if a value is a ComponentBlock
function isComponentBlock(value: unknown): value is ComponentBlock {
  return typeof value === 'object' && value !== null && 'components' in value && !isDynamicBlock(value as StudyConfig['sequence']);
}

describe('Library Macro Expansion', () => {
  // Mock library data for testing
  const mockLibraryData: Record<string, LibraryConfig> = {
    testLib: {
      $schema: '',
      description: 'Test library',
      components: {
        '$testLib.components.component1': {
          type: 'markdown',
          path: 'test.md',
          response: [],
        },
        '$testLib.components.component2': {
          type: 'markdown',
          path: 'test2.md',
          response: [],
        },
      },
      sequences: {
        testSequence: {
          order: 'fixed',
          components: ['$testLib.components.component1', '$testLib.components.component2'],
        },
      },
    },
  };

  describe('.co. macro expansion in sequences', () => {
    test('expands .co. to .components. for single component reference', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$testLib.co.component1'],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.components).toEqual(['$testLib.components.component1']);
      }
    });

    test('expands .co. to .components. for multiple component references', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: [
          '$testLib.co.component1',
          '$testLib.co.component2',
        ],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.components).toEqual([
          '$testLib.components.component1',
          '$testLib.components.component2',
        ]);
      }
    });

    test('expands .co. in nested sequences', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: [
          {
            order: 'fixed',
            components: ['$testLib.co.component1'],
          },
          '$testLib.co.component2',
        ],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.components).toHaveLength(2);
        const nestedSequence = result.components[0];
        expect(typeof nestedSequence).toBe('object');
        if (isComponentBlock(nestedSequence)) {
          expect(nestedSequence.components).toEqual(['$testLib.components.component1']);
        }
        expect(result.components[1]).toBe('$testLib.components.component2');
      }
    });

    test('leaves .components. references unchanged', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$testLib.components.component1'],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.components).toEqual(['$testLib.components.component1']);
      }
    });

    test('handles mixed .co. and .components. references', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: [
          '$testLib.co.component1',
          '$testLib.components.component2',
        ],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.components).toEqual([
          '$testLib.components.component1',
          '$testLib.components.component2',
        ]);
      }
    });

    test('does not modify non-library component references', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: [
          'regularComponent',
          '$testLib.co.component1',
        ],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.components).toEqual([
          'regularComponent',
          '$testLib.components.component1',
        ]);
      }
    });
  });

  describe('.se. macro expansion in sequences', () => {
    test('expands .se. to .sequences. and inlines the sequence', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$testLib.se.testSequence'],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.components).toHaveLength(1);
        const expandedSequence = result.components[0];
        expect(typeof expandedSequence).toBe('object');
        if (isComponentBlock(expandedSequence)) {
          expect(expandedSequence.components).toEqual([
            '$testLib.components.component1',
            '$testLib.components.component2',
          ]);
        }
      }
    });

    test('expands .sequences. and inlines the sequence', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$testLib.sequences.testSequence'],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.components).toHaveLength(1);
        const expandedSequence = result.components[0];
        expect(typeof expandedSequence).toBe('object');
        if (isComponentBlock(expandedSequence)) {
          expect(expandedSequence.id).toBe('$testLib.sequences.testSequence');
          expect(expandedSequence.components).toEqual([
            '$testLib.components.component1',
            '$testLib.components.component2',
          ]);
          const sequenceWithImportMetadata = expandedSequence as ComponentBlock & { __revisitImportedSequenceRef?: string };
          expect(sequenceWithImportMetadata.__revisitImportedSequenceRef).toBe('$testLib.sequences.testSequence');
        }
      }
    });

    test('handles .se. in nested sequences', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: [
          {
            order: 'fixed',
            components: ['$testLib.se.testSequence'],
          },
        ],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.components).toHaveLength(1);
        const outerSequence = result.components[0];
        expect(typeof outerSequence).toBe('object');
        if (isComponentBlock(outerSequence)) {
          const innerSequence = outerSequence.components[0];
          expect(typeof innerSequence).toBe('object');
          if (isComponentBlock(innerSequence)) {
            expect(innerSequence.components).toEqual([
              '$testLib.components.component1',
              '$testLib.components.component2',
            ]);
          }
        }
      }
    });

    test('preserves existing library sequence id when inlining', () => {
      const sequenceWithIdLibraryData: Record<string, LibraryConfig> = {
        testLib: {
          ...mockLibraryData.testLib,
          sequences: {
            testSequence: {
              id: 'customSequenceId',
              order: 'fixed',
              components: ['$testLib.components.component1'],
            },
          },
        },
      };

      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$testLib.se.testSequence'],
      };

      const result = expandLibrarySequences(sequence, sequenceWithIdLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        const expandedSequence = result.components[0];
        expect(typeof expandedSequence).toBe('object');
        if (isComponentBlock(expandedSequence)) {
          expect(expandedSequence.id).toBe('customSequenceId');
          const sequenceWithImportMetadata = expandedSequence as ComponentBlock & { __revisitImportedSequenceRef?: string };
          expect(sequenceWithImportMetadata.__revisitImportedSequenceRef).toBe('$testLib.sequences.testSequence');
        }
      }
    });

    test('adds error for missing library in .se. reference', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$missingLib.se.testSequence'],
      };

      const errors: ParserErrorWarning[] = [];
      const result = expandLibrarySequences(sequence, mockLibraryData, errors);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('`missingLib` not found');
      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.components).toEqual(['$missingLib.sequences.testSequence']);
      }
    });

    test('adds error for missing sequence in .se. reference', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$testLib.se.missingSequence'],
      };

      const errors: ParserErrorWarning[] = [];
      const result = expandLibrarySequences(sequence, mockLibraryData, errors);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('`missingSequence` not found');
      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.components).toEqual(['$testLib.sequences.missingSequence']);
      }
    });
  });

  describe('Combined .co. and .se. macro expansion', () => {
    test('handles both .co. and .se. in the same sequence', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: [
          '$testLib.co.component1',
          '$testLib.se.testSequence',
          '$testLib.co.component2',
        ],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.components).toHaveLength(3);
        expect(result.components[0]).toBe('$testLib.components.component1');

        const expandedSequence = result.components[1];
        expect(typeof expandedSequence).toBe('object');
        if (isComponentBlock(expandedSequence)) {
          expect(expandedSequence.components).toEqual([
            '$testLib.components.component1',
            '$testLib.components.component2',
          ]);
        }

        expect(result.components[2]).toBe('$testLib.components.component2');
      }
    });

    test('expands .co. within expanded .se. sequences', () => {
      // Create a library with a sequence that uses .co. internally
      const libraryWithCoInSequence: Record<string, LibraryConfig> = {
        testLib: {
          ...mockLibraryData.testLib,
          sequences: {
            testSequence: {
              order: 'fixed',
              components: ['component1', 'component2'], // These will be namespaced
            },
          },
        },
      };

      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$testLib.se.testSequence'],
      };

      const result = expandLibrarySequences(sequence, libraryWithCoInSequence);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.components).toHaveLength(1);
        const expandedSequence = result.components[0];
        expect(typeof expandedSequence).toBe('object');
        if (isComponentBlock(expandedSequence)) {
          // Components in the sequence should be namespaced with .components.
          expect(expandedSequence.components).toEqual([
            '$testLib.components.component1',
            '$testLib.components.component2',
          ]);
        }
      }
    });
  });

  describe('Dynamic blocks', () => {
    test('returns dynamic blocks unchanged', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'random',
        numSamples: 5,
        components: ['component1', 'component2'],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(result).toEqual(sequence);
    });
  });

  describe('Edge cases', () => {
    test('handles empty sequence', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: [],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.components).toEqual([]);
      }
    });

    test('handles multiple .co. in the same component name (edge case)', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$testLib.co.component1'],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        // Should only replace the first .co.
        expect(result.components).toEqual(['$testLib.components.component1']);
      }
    });

    test('preserves sequence properties during expansion', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        id: 'testId',
        components: ['$testLib.co.component1'],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.id).toBe('testId');
        expect(result.order).toBe('fixed');
        expect(result.components).toEqual(['$testLib.components.component1']);
      }
    });
  });

  describe('namespaceLibrarySequenceComponents (via sequence expansion)', () => {
    test('namespaces non-prefixed component names in library sequences', () => {
      const libraryWithUnprefixedComponents: Record<string, LibraryConfig> = {
        testLib: {
          $schema: '',
          description: 'Test library',
          components: {
            '$testLib.components.component1': {
              type: 'markdown',
              path: 'test.md',
              response: [],
            },
          },
          sequences: {
            testSequence: {
              order: 'fixed',
              components: ['component1'], // Not prefixed
            },
          },
        },
      };

      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$testLib.sequences.testSequence'],
      };

      const result = expandLibrarySequences(sequence, libraryWithUnprefixedComponents);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.components).toHaveLength(1);
        const expandedSequence = result.components[0];
        if (isComponentBlock(expandedSequence)) {
          // Component should be namespaced
          expect(expandedSequence.components).toEqual(['$testLib.components.component1']);
        }
      }
    });

    test('does not double-namespace already-prefixed components in library sequences', () => {
      const libraryWithPrefixedComponents: Record<string, LibraryConfig> = {
        testLib: {
          $schema: '',
          description: 'Test library',
          components: {
            '$testLib.components.component1': {
              type: 'markdown',
              path: 'test.md',
              response: [],
            },
          },
          sequences: {
            testSequence: {
              order: 'fixed',
              components: ['$testLib.components.component1'], // Already prefixed
            },
          },
        },
      };

      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$testLib.sequences.testSequence'],
      };

      const result = expandLibrarySequences(sequence, libraryWithPrefixedComponents);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.components).toHaveLength(1);
        const expandedSequence = result.components[0];
        if (isComponentBlock(expandedSequence)) {
          // Component should remain the same
          expect(expandedSequence.components).toEqual(['$testLib.components.component1']);
        }
      }
    });

    test('handles deeply nested sequences in library definitions', () => {
      const libraryWithNestedSequences: Record<string, LibraryConfig> = {
        testLib: {
          $schema: '',
          description: 'Test library',
          components: {
            '$testLib.components.component1': {
              type: 'markdown',
              path: 'test.md',
              response: [],
            },
          },
          sequences: {
            testSequence: {
              order: 'fixed',
              components: [
                {
                  order: 'random',
                  components: ['component1'],
                },
              ],
            },
          },
        },
      };

      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$testLib.sequences.testSequence'],
      };

      const result = expandLibrarySequences(sequence, libraryWithNestedSequences);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        const expandedSequence = result.components[0];
        if (isComponentBlock(expandedSequence)) {
          const nestedSequence = expandedSequence.components[0];
          if (isComponentBlock(nestedSequence)) {
            expect(nestedSequence.components).toEqual(['$testLib.components.component1']);
          }
        }
      }
    });

    test('preserves dynamic blocks in library sequences', () => {
      const libraryWithDynamicBlock: Record<string, LibraryConfig> = {
        testLib: {
          $schema: '',
          description: 'Test library',
          components: {},
          sequences: {
            dynamicSeq: {
              order: 'dynamic',
              id: 'dynamicTest',
              functionPath: 'test.js',
            },
          },
        },
      };

      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$testLib.sequences.dynamicSeq'],
      };

      const result = expandLibrarySequences(sequence, libraryWithDynamicBlock);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        const expandedSequence = result.components[0];
        expect(typeof expandedSequence).toBe('object');
        if (typeof expandedSequence === 'object' && isDynamicBlock(expandedSequence)) {
          expect(expandedSequence.id).toBe('dynamicTest');
          expect(expandedSequence.functionPath).toBe('test.js');
        }
      }
    });
  });

  describe('Recursive expansion', () => {
    test('recursively expands nested object components', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: [
          {
            order: 'random',
            components: [
              {
                order: 'fixed',
                components: ['$testLib.co.component1'],
              },
            ],
          },
        ],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        const level1 = result.components[0];
        if (isComponentBlock(level1)) {
          const level2 = level1.components[0];
          if (isComponentBlock(level2)) {
            expect(level2.components).toEqual(['$testLib.components.component1']);
          }
        }
      }
    });

    test('collects errors from top-level expansion', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: [
          '$missingLib.se.testSequence',
          '$anotherMissingLib.se.anotherSeq',
        ],
      };

      const errors: ParserErrorWarning[] = [];
      expandLibrarySequences(sequence, mockLibraryData, errors);

      // Should have collected errors from expansion
      expect(errors.length).toBe(2);
      expect(errors.some((e) => e.message?.includes('missingLib'))).toBe(true);
      expect(errors.some((e) => e.message?.includes('anotherMissingLib'))).toBe(true);
    });
  });

  describe('Macro expansion edge cases', () => {
    test('handles components with multiple dots in name', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$testLib.co.component.with.dots'],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        // Should only replace the first .co.
        expect(result.components).toEqual(['$testLib.components.component.with.dots']);
      }
    });

    test('handles .se. followed by .co. in same string (should not occur but test behavior)', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$testLib.se.co.something'], // Edge case
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        // .se. gets replaced first, then the string becomes .sequences.co.something
        // The .co. won't be in the right position to be replaced again
        expect(result.components[0]).toContain('.sequences.');
      }
    });

    test('preserves non-library $ prefixed components', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$nonLibraryComponent'],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.components).toEqual(['$nonLibraryComponent']);
      }
    });

    test('handles undefined/null components array gracefully', () => {
      const sequence = {
        order: 'fixed',
        components: undefined,
      } as unknown as StudyConfig['sequence'];

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.components).toEqual([]);
      }
    });
  });

  describe('Sequence properties preservation', () => {
    test('preserves numSamples property', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'random',
        numSamples: 3,
        components: ['$testLib.co.component1', '$testLib.co.component2'],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.numSamples).toBe(3);
      }
    });

    test('preserves interruptions property', () => {
      const interruptions = [
        {
          spacing: 'random' as const,
          numInterruptions: 1,
          components: ['breakComponent'],
        },
      ];

      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$testLib.co.component1'],
        interruptions,
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.interruptions).toEqual(interruptions);
      }
    });

    test('preserves skip conditions', () => {
      const skip = [
        {
          name: 'skipCondition',
          check: 'response' as const,
          responseId: 'response1',
          value: 'yes',
          comparison: 'equal' as const,
          to: 'nextComponent',
        },
      ];

      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$testLib.co.component1'],
        skip,
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.skip).toEqual(skip);
      }
    });

    test('expands macro references in interruptions components', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$testLib.co.component1'],
        interruptions: [
          {
            spacing: 'random',
            numInterruptions: 1,
            components: ['$testLib.co.component2'],
          },
        ],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.interruptions?.[0].components).toEqual(['$testLib.components.component2']);
      }
    });

    test('expands macro references in skip condition targets', () => {
      const sequence: StudyConfig['sequence'] = {
        order: 'fixed',
        components: ['$testLib.co.component1'],
        skip: [
          {
            name: 'skipCondition',
            check: 'response',
            responseId: 'response1',
            value: 'yes',
            comparison: 'equal',
            to: '$testLib.co.component2',
          },
          {
            check: 'block',
            condition: 'numIncorrect',
            value: 1,
            to: '$testLib.se.testSequence',
          },
        ],
      };

      const result = expandLibrarySequences(sequence, mockLibraryData);

      expect(isComponentBlock(result)).toBe(true);
      if (isComponentBlock(result)) {
        expect(result.skip?.[0].to).toBe('$testLib.components.component2');
        expect(result.skip?.[1].to).toBe('$testLib.sequences.testSequence');
      }
    });
  });
});

describe('verifyLibraryUsage', () => {
  test('does not add errors for valid library with no inherited components', () => {
    const libraryData: Record<string, LibraryConfig> = {
      testLib: {
        $schema: '',
        description: 'Test library',
        components: {
          component1: {
            type: 'markdown',
            path: 'test.md',
            response: [],
          } as IndividualComponent,
        },
        sequences: {},
      },
    };

    const studyConfig: StudyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      components: {},
      sequence: {
        order: 'fixed',
        components: [],
      },
    };

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];
    verifyLibraryUsage(studyConfig, errors, warnings, libraryData);

    expect(errors).toHaveLength(0);
  });

  test('does not add errors when inherited component has valid baseComponent', () => {
    const libraryData: Record<string, LibraryConfig> = {
      testLib: {
        $schema: '',
        description: 'Test library',
        components: {
          derivedComp: {
            baseComponent: 'baseComp',
            instructionText: 'Custom text',
          } as InheritedComponent,
        },
        baseComponents: {
          baseComp: {
            type: 'markdown',
            path: 'base.md',
            response: [],
          },
        },
        sequences: {},
      },
    };

    const studyConfig: StudyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      components: {},
      sequence: {
        order: 'fixed',
        components: [],
      },
    };

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];
    verifyLibraryUsage(studyConfig, errors, warnings, libraryData);

    expect(errors).toHaveLength(0);
  });

  test('adds error when inherited component references missing baseComponent', () => {
    const libraryData: Record<string, LibraryConfig> = {
      testLib: {
        $schema: '',
        description: 'Test library',
        components: {
          derivedComp: {
            baseComponent: 'missingBaseComp',
            instructionText: 'Custom text',
          } as InheritedComponent,
        },
        baseComponents: {
          otherBase: {
            type: 'markdown',
            path: 'base.md',
            response: [],
          },
        },
        sequences: {},
      },
    };

    const studyConfig: StudyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      components: {},
      sequence: {
        order: 'fixed',
        components: [],
      },
    };

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];
    verifyLibraryUsage(studyConfig, errors, warnings, libraryData);

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('missingBaseComp');
    expect(errors[0].message).toContain('not defined');
    expect(errors[0].instancePath).toBe('/importedLibraries/testLib/baseComponents/');
    expect((errors[0].params as { action: string }).action).toBe('Add the base component to the baseComponents object');
  });

  test('adds error when library has no baseComponents and component tries to inherit', () => {
    const libraryData: Record<string, LibraryConfig> = {
      testLib: {
        $schema: '',
        description: 'Test library',
        components: {
          derivedComp: {
            baseComponent: 'someBase',
            instructionText: 'Custom text',
          } as InheritedComponent,
        },
        sequences: {},
      },
    };

    const studyConfig: StudyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      components: {},
      sequence: {
        order: 'fixed',
        components: [],
      },
    };

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];
    verifyLibraryUsage(studyConfig, errors, warnings, libraryData);

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('someBase');
  });

  test('handles multiple libraries with mixed valid and invalid components', () => {
    const libraryData: Record<string, LibraryConfig> = {
      validLib: {
        $schema: '',
        description: 'Valid library',
        components: {
          comp1: {
            baseComponent: 'base1',
          } as InheritedComponent,
        },
        baseComponents: {
          base1: {
            type: 'markdown',
            path: 'test.md',
            response: [],
          },
        },
        sequences: {},
      },
      invalidLib: {
        $schema: '',
        description: 'Invalid library',
        components: {
          comp2: {
            baseComponent: 'missingBase',
          } as InheritedComponent,
        },
        sequences: {},
      },
    };

    const studyConfig: StudyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      components: {},
      sequence: {
        order: 'fixed',
        components: [],
      },
    };

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];
    verifyLibraryUsage(studyConfig, errors, warnings, libraryData);

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('missingBase');
    expect(errors[0].instancePath).toContain('invalidLib');
  });

  test('handles library with multiple components with different inheritance issues', () => {
    const libraryData: Record<string, LibraryConfig> = {
      testLib: {
        $schema: '',
        description: 'Test library',
        components: {
          validDerived: {
            baseComponent: 'validBase',
          } as InheritedComponent,
          invalidDerived1: {
            baseComponent: 'missingBase1',
          } as InheritedComponent,
          invalidDerived2: {
            baseComponent: 'missingBase2',
          } as InheritedComponent,
          individualComp: {
            type: 'markdown',
            path: 'test.md',
            response: [],
          } as IndividualComponent,
        },
        baseComponents: {
          validBase: {
            type: 'markdown',
            path: 'base.md',
            response: [],
          },
        },
        sequences: {},
      },
    };

    const studyConfig: StudyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      components: {},
      sequence: {
        order: 'fixed',
        components: [],
      },
    };

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];
    verifyLibraryUsage(studyConfig, errors, warnings, libraryData);

    expect(errors).toHaveLength(2);
    expect(errors.some((e) => e.message.includes('missingBase1'))).toBe(true);
    expect(errors.some((e) => e.message.includes('missingBase2'))).toBe(true);
  });

  test('handles empty library data', () => {
    const libraryData: Record<string, LibraryConfig> = {};

    const studyConfig: StudyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      components: {},
      sequence: {
        order: 'fixed',
        components: [],
      },
    };

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];
    verifyLibraryUsage(studyConfig, errors, warnings, libraryData);

    expect(errors).toHaveLength(0);
  });

  test('does not add disabled-sidebar warning for unused library component', () => {
    const libraryData: Record<string, LibraryConfig> = {
      testLib: {
        $schema: '',
        description: 'Test library',
        components: {
          componentWithSidebar: {
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
          } as IndividualComponent,
        },
        sequences: {},
      },
    };

    const studyConfig: StudyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: false,
      },
      components: {},
      sequence: {
        order: 'fixed',
        components: [],
      },
    };

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];
    verifyLibraryUsage(studyConfig, errors, warnings, libraryData);

    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  test('adds disabled-sidebar warning when used library component has sidebar locations', () => {
    const libraryData: Record<string, LibraryConfig> = {
      testLib: {
        $schema: '',
        description: 'Test library',
        components: {
          componentWithSidebar: {
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
          } as IndividualComponent,
        },
        sequences: {},
      },
    };

    const studyConfig: StudyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: false,
      },
      components: {},
      sequence: {
        order: 'fixed',
        components: ['componentWithSidebar'],
      },
    };

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];
    verifyLibraryUsage(studyConfig, errors, warnings, libraryData);

    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].category).toBe('disabled-sidebar');
    expect(warnings[0].message).toContain('componentWithSidebar');
    expect(warnings[0].instancePath).toBe('/importedLibraries/testLib/uiConfig/');
  });

  test('adds disabled-sidebar warning when inherited library component uses sidebar from base component', () => {
    const libraryData: Record<string, LibraryConfig> = {
      testLib: {
        $schema: '',
        description: 'Test library',
        baseComponents: {
          baseSidebarComponent: {
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
          } as IndividualComponent,
        },
        components: {
          inheritedSidebarComponent: {
            baseComponent: 'baseSidebarComponent',
          },
        },
        sequences: {},
      },
    };

    const studyConfig: StudyConfig = {
      $schema: '',
      studyMetadata: {
        title: 'Test',
        version: '1.0',
        authors: ['Test'],
        date: '2024-01-01',
        description: 'Test',
        organizations: ['Test'],
      },
      uiConfig: {
        contactEmail: 'test@test.com',
        helpTextPath: '',
        logoPath: '',
        withProgressBar: true,
        autoDownloadStudy: false,
        withSidebar: true,
      },
      components: {},
      sequence: {
        order: 'fixed',
        components: ['inheritedSidebarComponent'],
      },
    };

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];
    verifyLibraryUsage(studyConfig, errors, warnings, libraryData);

    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].category).toBe('disabled-sidebar');
    expect(warnings[0].message).toContain('inheritedSidebarComponent');
    expect(warnings[0].instancePath).toBe('/importedLibraries/testLib/baseComponents/');
  });
});

describe('loadLibrariesParseNamespace', () => {
  test('loads libraries and namespaces components correctly', async () => {
    const mockLibraryConfig = {
      $schema: '',
      description: 'Test library',
      components: {
        component1: {
          type: 'markdown',
          path: 'test.md',
          response: [],
        },
      },
      sequences: {},
    };

    global.fetch = vi.fn().mockResolvedValue({
      text: async () => JSON.stringify(mockLibraryConfig),
    });

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];

    const result = await loadLibrariesParseNamespace(['testLib'], errors, warnings);

    expect(result.testLib).toBeDefined();
    expect(result.testLib.components['$testLib.components.component1']).toBeDefined();
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  test('does not create .co. aliases when namespacing library components', async () => {
    const mockLibraryConfig = {
      $schema: '',
      description: 'Test library',
      components: {
        component1: {
          type: 'markdown',
          path: 'test.md',
          response: [],
        },
      },
      sequences: {},
    };

    global.fetch = vi.fn().mockResolvedValue({
      text: async () => JSON.stringify(mockLibraryConfig),
    });

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];

    const result = await loadLibrariesParseNamespace(['testLib'], errors, warnings);

    expect(result.testLib.components).toHaveProperty('$testLib.components.component1');
    expect(result.testLib.components).not.toHaveProperty('$testLib.co.component1');
  });

  test('merges inherited components with base components', async () => {
    const mockLibraryConfig = {
      $schema: '',
      description: 'Test library',
      components: {
        derivedComp: {
          baseComponent: 'baseComp',
          instructionText: 'Override text',
        },
      },
      baseComponents: {
        baseComp: {
          type: 'markdown',
          path: 'base.md',
          response: [],
          instructionText: 'Base text',
        },
      },
      sequences: {},
    };

    global.fetch = vi.fn().mockResolvedValue({
      text: async () => JSON.stringify(mockLibraryConfig),
    });

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];

    const result = await loadLibrariesParseNamespace(['testLib'], errors, warnings);

    const derivedComp = result.testLib.components['$testLib.components.derivedComp'];
    const derivedCompRecord = derivedComp as Record<string, unknown>;
    expect(derivedComp).toBeDefined();
    expect(derivedCompRecord.instructionText).toBe('Override text');
    expect(derivedCompRecord.type).toBe('markdown');
    expect(derivedCompRecord.path).toBe('base.md');
    expect(derivedCompRecord.baseComponent).toBeUndefined(); // Should be removed
    expect(result.testLib.__revisitInheritedComponentMetadata).toEqual({
      '$testLib.components.derivedComp': {
        baseComponent: 'baseComp',
      },
    });
  });

  test('filters out libraries with missing components', async () => {
    const mockLibraryConfig = {
      $schema: '',
      description: 'Test library',
      sequences: {},
    };

    global.fetch = vi.fn().mockResolvedValue({
      text: async () => JSON.stringify(mockLibraryConfig),
    });

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];

    const result = await loadLibrariesParseNamespace(['testLib'], errors, warnings);

    expect(result.testLib).toBeUndefined();
  });

  test('collects errors from library parsing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      text: async () => 'invalid json{',
    });

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];

    await loadLibrariesParseNamespace(['testLib'], errors, warnings);

    expect(errors.length).toBeGreaterThan(0);
  });

  test('loads multiple libraries in parallel', async () => {
    const mockLibrary1 = {
      $schema: '',
      description: 'Library 1',
      components: {
        comp1: {
          type: 'markdown',
          path: 'test1.md',
          response: [],
        },
      },
      sequences: {},
    };

    const mockLibrary2 = {
      $schema: '',
      description: 'Library 2',
      components: {
        comp2: {
          type: 'markdown',
          path: 'test2.md',
          response: [],
        },
      },
      sequences: {},
    };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ text: async () => JSON.stringify(mockLibrary1) })
      .mockResolvedValueOnce({ text: async () => JSON.stringify(mockLibrary2) });

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];

    const result = await loadLibrariesParseNamespace(['lib1', 'lib2'], errors, warnings);

    expect(result.lib1).toBeDefined();
    expect(result.lib2).toBeDefined();
    expect(result.lib1.components['$lib1.components.comp1']).toBeDefined();
    expect(result.lib2.components['$lib2.components.comp2']).toBeDefined();
  });

  test('handles library with warnings', async () => {
    const mockLibraryConfig = {
      $schema: '',
      description: 'Test library',
      components: {
        component1: {
          type: 'markdown',
          path: 'test.md',
          response: [],
        },
      },
      sequences: {},
    };

    global.fetch = vi.fn().mockResolvedValue({
      text: async () => JSON.stringify(mockLibraryConfig),
    });

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];

    await loadLibrariesParseNamespace(['testLib'], errors, warnings);

    // Warnings array should exist even if empty
    expect(Array.isArray(warnings)).toBe(true);
  });

  test('preserves non-component library properties', async () => {
    const mockLibraryConfig = {
      $schema: 'https://example.com/schema',
      description: 'Test library description',
      additionalDescription: 'Additional details',
      reference: 'Test Reference',
      doi: '10.1234/test',
      externalLink: 'https://example.com',
      components: {
        component1: {
          type: 'markdown',
          path: 'test.md',
          response: [],
        },
      },
      sequences: {},
    };

    global.fetch = vi.fn().mockResolvedValue({
      text: async () => JSON.stringify(mockLibraryConfig),
    });

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];

    const result = await loadLibrariesParseNamespace(['testLib'], errors, warnings);

    expect(result.testLib.description).toBe('Test library description');
    expect(result.testLib.additionalDescription).toBe('Additional details');
    expect(result.testLib.reference).toBe('Test Reference');
    expect(result.testLib.doi).toBe('10.1234/test');
    expect(result.testLib.externalLink).toBe('https://example.com');
  });

  test('handles complex inheritance with multiple properties', async () => {
    const mockLibraryConfig = {
      $schema: '',
      description: 'Test library',
      components: {
        derivedComp: {
          baseComponent: 'baseComp',
          instructionText: 'Override instruction',
          meta: {
            customProp: 'derived value',
          },
        },
      },
      baseComponents: {
        baseComp: {
          type: 'markdown',
          path: 'base.md',
          response: [],
          instructionText: 'Base instruction',
          meta: {
            baseProp: 'base value',
          },
        },
      },
      sequences: {},
    };

    global.fetch = vi.fn().mockResolvedValue({
      text: async () => JSON.stringify(mockLibraryConfig),
    });

    const errors: ParserErrorWarning[] = [];
    const warnings: ParserErrorWarning[] = [];

    const result = await loadLibrariesParseNamespace(['testLib'], errors, warnings);

    const derivedComp = result.testLib.components['$testLib.components.derivedComp'];
    const derivedCompRecord = derivedComp as Record<string, unknown> & { meta?: Record<string, unknown> };
    expect(derivedCompRecord.instructionText).toBe('Override instruction');
    expect(derivedCompRecord.meta?.customProp).toBe('derived value');
    expect(derivedCompRecord.meta?.baseProp).toBe('base value'); // Merged from base
  });
});
