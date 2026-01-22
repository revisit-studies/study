import { describe, expect, test } from 'vitest';
import { QuestionnaireComponent, StudyConfig } from '../parser/types';
import { Sequence } from '../store/types';
import { generateSequenceArray } from './handleRandomSequences';

const components = Object.fromEntries(Array(50).fill(0).map((_, idx) => [`component_${idx}`, { type: 'questionnaire', response: [] } as QuestionnaireComponent]));

const config: StudyConfig = {
  $schema: '',
  studyMetadata: {
    title: '',
    version: '',
    authors: [],
    date: '',
    description: '',
    organizations: [],
  },
  uiConfig: {
    logoPath: '',
    contactEmail: '',
    withProgressBar: true,
    withSidebar: true,
    numSequences: 100_000,
  },
  components,
  sequence: {
    order: 'random',
    numSamples: 1,
    components: Object.keys(components),
  },
};

describe('Generating sequences works as expected', () => {
  test('generateSequenceArray returns balanced random sequences, numSamples = 1', async () => {
    const sequenceArray = generateSequenceArray(config);

    const counts = sequenceArray.flatMap(((seq) => seq.components)).filter((comp) => comp !== 'end').reduce((acc, compId) => {
      acc[compId as string] = (acc[compId as string] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const values = Object.values(counts);
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Check that the difference between max and min counts is within an acceptable range
    expect(max - min).toBeLessThan(300); // Allow a small margin of error
  });

  test('generateSequenceArray returns balanced random sequences, numSamples = 50', async () => {
    const sequenceArray = generateSequenceArray({ ...config, sequence: { order: 'random', numSamples: 31, components: Object.keys(components) } });

    const counts = sequenceArray.flatMap(((seq) => seq.components)).filter((comp) => comp !== 'end').reduce((acc, compId) => {
      acc[compId as string] = (acc[compId as string] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const values = Object.values(counts);
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Check that the difference between max and min counts is within an acceptable range
    expect(max - min).toBeLessThan(1000); // Allow a small margin of error

    const counts1 = sequenceArray.map(((seq) => seq.components[1])).reduce((acc, compId) => {
      acc[compId as string] = (acc[compId as string] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const counts30 = sequenceArray.map(((seq) => seq.components[30])).reduce((acc, compId) => {
      acc[compId as string] = (acc[compId as string] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const values1 = Object.values(counts1);
    const min1 = Math.min(...values1);
    const max1 = Math.max(...values1);

    // Check that the difference between max and min counts is within an acceptable range
    expect(max1 - min1).toBeLessThan(300); // Allow a small margin of error

    const values30 = Object.values(counts30);
    const min30 = Math.min(...values30);
    const max30 = Math.max(...values30);

    // Check that the difference between max and min counts is within an acceptable range
    expect(max30 - min30).toBeLessThan(300); // Allow a small margin of error
  });
});

describe('Fixed order sequences', () => {
  test('fixed order maintains component sequence', () => {
    const smallComponents = {
      intro: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
      trial1: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
      trial2: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
      end: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
    };

    const fixedConfig: StudyConfig = {
      ...config,
      components: smallComponents,
      sequence: {
        order: 'fixed',
        components: ['intro', 'trial1', 'trial2', 'end'],
      },
    };

    const sequenceArray = generateSequenceArray(fixedConfig);

    // All sequences should be identical in fixed order
    sequenceArray.forEach((seq) => {
      expect(seq.components).toEqual(['intro', 'trial1', 'trial2', 'end', 'end']);
    });
  });

  test('fixed order with single component', () => {
    const singleComponent = {
      single: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
    };

    const fixedConfig: StudyConfig = {
      ...config,
      components: singleComponent,
      sequence: {
        order: 'fixed',
        components: ['single'],
      },
    };

    const sequenceArray = generateSequenceArray(fixedConfig);

    sequenceArray.forEach((seq) => {
      expect(seq.components).toEqual(['single', 'end']);
    });
  });
});

describe('Latin square ordering', () => {
  test('latin square produces balanced positional distribution', () => {
    const latinComponents = {
      a: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
      b: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
      c: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
      d: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
    };

    const latinConfig: StudyConfig = {
      ...config,
      components: latinComponents,
      uiConfig: {
        ...config.uiConfig,
        numSequences: 100,
      },
      sequence: {
        order: 'latinSquare',
        components: ['a', 'b', 'c', 'd'],
      },
    };

    const sequenceArray = generateSequenceArray(latinConfig);

    // Check first position distribution
    const firstPositionCounts = sequenceArray.map((seq) => seq.components[0]).reduce((acc, comp) => {
      acc[comp as string] = (acc[comp as string] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Each component should appear roughly equally in first position
    const values = Object.values(firstPositionCounts);
    const min = Math.min(...values);
    const max = Math.max(...values);
    expect(max - min).toBeLessThan(10);
  });
});

describe('numSamples limiting', () => {
  test('numSamples = 5 limits components to 5', () => {
    const manyComponents = Object.fromEntries(
      Array(20).fill(0).map((_, idx) => [`comp_${idx}`, { type: 'questionnaire', response: [] } as QuestionnaireComponent]),
    );

    const sampledConfig: StudyConfig = {
      ...config,
      components: manyComponents,
      sequence: {
        order: 'random',
        numSamples: 5,
        components: Object.keys(manyComponents),
      },
    };

    const sequenceArray = generateSequenceArray(sampledConfig);

    sequenceArray.forEach((seq) => {
      // 5 components + 'end' = 6 total
      expect(seq.components.length).toBe(6);
      expect(seq.components[5]).toBe('end');
    });
  });

  test('numSamples larger than component count includes all components', () => {
    const fewComponents = {
      a: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
      b: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
      c: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
    };

    const sampledConfig: StudyConfig = {
      ...config,
      components: fewComponents,
      sequence: {
        order: 'random',
        numSamples: 10,
        components: Object.keys(fewComponents),
      },
    };

    const sequenceArray = generateSequenceArray(sampledConfig);

    sequenceArray.forEach((seq) => {
      // All 3 components + 'end' = 4 total
      expect(seq.components.length).toBe(4);
    });
  });
});

describe('Nested blocks', () => {
  test('nested blocks are processed correctly', () => {
    const nestedComponents = {
      intro: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
      trial1: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
      trial2: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
      end: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
    };

    const nestedConfig: StudyConfig = {
      ...config,
      components: nestedComponents,
      uiConfig: {
        ...config.uiConfig,
        numSequences: 100, // Generate enough sequences to see variation
      },
      sequence: {
        order: 'fixed',
        components: [
          'intro',
          {
            order: 'random',
            components: ['trial1', 'trial2'],
          },
          'end',
        ],
      },
    };

    const sequenceArray = generateSequenceArray(nestedConfig);

    sequenceArray.forEach((seq) => {
      // Should have intro, nested block with trials, end, and the system end
      expect(seq.components[0]).toBe('intro');
      expect(seq.components[2]).toBe('end');
      expect(seq.components[3]).toBe('end');

      // Middle should be a nested block with trial1 and trial2
      const nestedBlock = seq.components[1] as Sequence;
      expect(typeof nestedBlock).toBe('object');
      expect(nestedBlock.order).toBe('random');
      // The nested block should contain both trial components (in either order)
      expect(nestedBlock.components.sort()).toEqual(['trial1', 'trial2']);
    });
  });

  test('deeply nested blocks work correctly', () => {
    const deepComponents = {
      a: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
      b: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
      c: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
    };

    const deepConfig: StudyConfig = {
      ...config,
      components: deepComponents,
      sequence: {
        order: 'fixed',
        components: [
          'a',
          {
            order: 'fixed',
            components: [
              {
                order: 'fixed',
                components: ['b', 'c'],
              },
            ],
          },
        ],
      },
    };

    const sequenceArray = generateSequenceArray(deepConfig);

    sequenceArray.forEach((seq) => {
      // Should have 'a', then nested blocks containing 'b' and 'c', then 'end'
      expect(seq.components[0]).toBe('a');
      expect(seq.components[2]).toBe('end');

      // First nested level
      const firstNested = seq.components[1] as Sequence;
      expect(typeof firstNested).toBe('object');
      expect(firstNested.components.length).toBe(1);

      // Second nested level
      const secondNested = firstNested.components[0] as Sequence;
      expect(typeof secondNested).toBe('object');
      expect(secondNested.components.sort()).toEqual(['b', 'c']);
    });
  });
});

describe('Empty and edge cases', () => {
  test('empty sequence produces only end component', () => {
    const emptyConfig: StudyConfig = {
      ...config,
      components: {},
      sequence: {
        order: 'fixed',
        components: [],
      },
    };

    const sequenceArray = generateSequenceArray(emptyConfig);

    sequenceArray.forEach((seq) => {
      expect(seq.components).toEqual(['end']);
    });
  });

  test('sequence with only one component', () => {
    const singleComp = {
      only: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
    };

    const singleConfig: StudyConfig = {
      ...config,
      components: singleComp,
      sequence: {
        order: 'random',
        components: ['only'],
      },
    };

    const sequenceArray = generateSequenceArray(singleConfig);

    sequenceArray.forEach((seq) => {
      expect(seq.components).toEqual(['only', 'end']);
    });
  });

  test('generates correct number of sequences', () => {
    const testConfig: StudyConfig = {
      ...config,
      uiConfig: {
        ...config.uiConfig,
        numSequences: 50,
      },
    };

    const sequenceArray = generateSequenceArray(testConfig);

    expect(sequenceArray.length).toBe(50);
  });

  test('uses default 1000 sequences when numSequences not specified', () => {
    const testConfig: StudyConfig = {
      ...config,
      uiConfig: {
        ...config.uiConfig,
        numSequences: undefined,
      },
    };

    const sequenceArray = generateSequenceArray(testConfig);

    expect(sequenceArray.length).toBe(1000);
  });
});

describe('Sequence properties', () => {
  test('all sequences end with "end" component', () => {
    const sequenceArray = generateSequenceArray(config);

    sequenceArray.forEach((seq) => {
      expect(seq.components[seq.components.length - 1]).toBe('end');
    });
  });

  test('sequence includes order information', () => {
    const sequenceArray = generateSequenceArray(config);

    sequenceArray.forEach((seq) => {
      expect(seq.order).toBe('random');
      expect(seq.orderPath).toBeDefined();
    });
  });

  test('sequences have unique variations', () => {
    const smallConfig: StudyConfig = {
      ...config,
      components: {
        a: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
        b: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
        c: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
      },
      uiConfig: {
        ...config.uiConfig,
        numSequences: 100,
      },
      sequence: {
        order: 'random',
        components: ['a', 'b', 'c'],
      },
    };

    const sequenceArray = generateSequenceArray(smallConfig);

    const uniqueSequences = new Set(
      sequenceArray.map((seq) => JSON.stringify(seq.components)),
    );

    // Should have at least 3 different orderings (out of 6 possible)
    expect(uniqueSequences.size).toBeGreaterThan(3);
  });
});

describe('Random order statistical properties', () => {
  test('random order produces varied sequences', () => {
    const randomConfig: StudyConfig = {
      ...config,
      components: {
        a: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
        b: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
        c: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
        d: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
      },
      uiConfig: {
        ...config.uiConfig,
        numSequences: 100,
      },
      sequence: {
        order: 'random',
        components: ['a', 'b', 'c', 'd'],
      },
    };

    const sequenceArray = generateSequenceArray(randomConfig);

    // Collect first components
    const firstComponents = sequenceArray.map((seq) => seq.components[0]);
    const firstCounts = firstComponents.reduce((acc, comp) => {
      acc[comp as string] = (acc[comp as string] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Each component should appear in first position multiple times
    Object.values(firstCounts).forEach((count) => {
      expect(count).toBeGreaterThan(10);
      expect(count).toBeLessThan(50);
    });
  });

  test('all components appear in all generated sequences', () => {
    const allCompConfig: StudyConfig = {
      ...config,
      components: {
        a: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
        b: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
        c: { type: 'questionnaire', response: [] } as QuestionnaireComponent,
      },
      uiConfig: {
        ...config.uiConfig,
        numSequences: 10,
      },
      sequence: {
        order: 'random',
        components: ['a', 'b', 'c'],
      },
    };

    const sequenceArray = generateSequenceArray(allCompConfig);

    sequenceArray.forEach((seq) => {
      // Each sequence should contain all components (excluding 'end')
      const compsWithoutEnd = seq.components.filter((c) => c !== 'end');
      expect(compsWithoutEnd.length).toBe(3);
      expect(compsWithoutEnd.sort()).toEqual(['a', 'b', 'c']);
    });
  });
});
