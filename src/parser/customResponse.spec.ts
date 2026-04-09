import {
  describe, expect, it,
} from 'vitest';
import { parseStudyConfig } from './parser';

function createBaseStudyConfig() {
  return {
    $schema: '',
    studyMetadata: {
      title: 'Custom Response Study',
      version: '1.0',
      authors: ['Test'],
      date: '2026-04-08',
      description: 'Test custom response parsing',
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
      customResponsePage: {
        type: 'questionnaire',
        response: [
          {
            id: 'custom-response-demo',
            prompt: 'Custom response prompt',
            type: 'custom',
            path: 'demo-form-elements/assets/CustomResponseCard.tsx',
            parameters: {
              minimumConfidence: 70,
            },
            default: {
              chartType: 'Bar',
              confidence: 80,
            },
          },
        ],
      },
    },
    sequence: {
      order: 'fixed',
      components: ['customResponsePage'],
    },
  };
}

describe('custom parser support', () => {
  it('accepts custom definitions with path, parameters, and defaults', async () => {
    const parsed = await parseStudyConfig(JSON.stringify(createBaseStudyConfig()));
    const response = parsed.components.customResponsePage.response?.[0];

    expect(parsed.errors).toEqual([]);
    expect(response).toMatchObject({
      type: 'custom',
      path: 'demo-form-elements/assets/CustomResponseCard.tsx',
      parameters: {
        minimumConfidence: 70,
      },
      default: {
        chartType: 'Bar',
        confidence: 80,
      },
    });
  });

  it('rejects custom definitions without a path', async () => {
    const invalidConfig = createBaseStudyConfig();
    const { path: _, ...rest } = invalidConfig.components.customResponsePage.response[0];
    invalidConfig.components.customResponsePage.response = [rest as typeof invalidConfig.components.customResponsePage.response[0]];

    const parsed = await parseStudyConfig(JSON.stringify(invalidConfig));

    expect(parsed.errors.some((error) => error.instancePath.includes('/components/customResponsePage/response/0'))).toBe(true);
  });
});
