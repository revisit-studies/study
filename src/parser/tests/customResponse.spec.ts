import {
  describe, expect, it,
} from 'vitest';
import responseFunctionConfig from '../../../public/test-response-functions/config.json';
import type { StudyConfig } from '../types';
import { parseStudyConfig } from '../parser';

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
  it('accepts a module path for built-in response validation', async () => {
    const parsed = await parseStudyConfig(JSON.stringify(responseFunctionConfig));

    expect(parsed.errors).toEqual([]);
    expect(parsed.components['validate-even-number'].response?.[0])
      .toMatchObject({ path: 'test-response-functions/assets/EvenNumber.response.ts' });
  });

  it('accepts a built-in response module without a special filename suffix', async () => {
    const invalidConfig = structuredClone(responseFunctionConfig) as unknown as StudyConfig;
    invalidConfig.components['validate-even-number'].response![0].path = 'test-response-functions/assets/ValidateNumber.ts';

    const parsed = await parseStudyConfig(JSON.stringify(invalidConfig));

    expect(parsed.errors).toEqual([]);
  });

  it('accepts an inherited custom module path when the resolved response becomes built-in', async () => {
    const invalidConfig = structuredClone(responseFunctionConfig) as unknown as StudyConfig;
    invalidConfig.baseComponents = {
      customBase: {
        type: 'questionnaire',
        response: [{
          id: 'guess',
          type: 'custom',
          prompt: 'Guess',
          path: 'demo-form-elements/assets/CustomResponseCard.tsx',
          default: { chartType: 'Bar', confidence: 80 },
        }],
      },
    };
    invalidConfig.components.inheritedNumerical = {
      baseComponent: 'customBase',
      response: [{ id: 'guess', type: 'numerical', prompt: 'Guess' }],
    };

    const parsed = await parseStudyConfig(JSON.stringify(invalidConfig));

    expect(parsed.errors).toEqual([]);
  });

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
