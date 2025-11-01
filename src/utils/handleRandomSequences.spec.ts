import { describe, expect, test } from 'vitest';
import { QuestionnaireComponent, StudyConfig } from '../parser/types';
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
