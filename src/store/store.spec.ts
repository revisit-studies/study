import { describe, expect, test } from 'vitest';
import { StudyConfig } from '../parser/types';
import { studyStoreCreator } from './store';
import { ParticipantMetadata, Sequence } from './types';

const metadata: ParticipantMetadata = {
  userAgent: '',
  resolution: {},
  language: '',
  ip: null,
};

describe('studyStoreCreator', () => {
  test('adds between-subjects sequence parameters to component answers', async () => {
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
      },
      components: {
        intro: {
          type: 'react-component',
          path: 'test/assets/Intro.tsx',
          response: [],
          parameters: { existing: 'value' },
        },
      },
      sequence: {
        order: 'fixed',
        components: ['intro'],
      },
    };
    const sequence: Sequence = {
      orderPath: 'root',
      order: 'fixed',
      components: ['intro'],
      skip: [],
      parameters: { data: 'd1' },
    };

    const { store } = await studyStoreCreator(
      'study',
      config,
      sequence,
      metadata,
      {},
      { developmentModeEnabled: true, dataSharingEnabled: true, dataCollectionEnabled: false },
      'participant',
      false,
      false,
    );

    expect(store.getState().answers.intro_0.parameters).toEqual({
      existing: 'value',
      data: 'd1',
    });
  });
});
