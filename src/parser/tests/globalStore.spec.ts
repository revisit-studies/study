import { describe, expect, test } from 'vitest';
import budgetStudy from '../../../public/test-global-store/config.json';
import operationsStudy from '../../../public/test-global-store-operations/config.json';
import failuresStudy from '../../../public/test-global-store-failures/config.json';
import templatingStudy from '../../../public/demo-templating/config.json';
import { parseStudyConfig } from '../parser';

describe('global store configuration', () => {
  test.each([budgetStudy, operationsStudy, failuresStudy, templatingStudy])('accepts the regression study $studyMetadata.title', async (config) => {
    expect((await parseStudyConfig(JSON.stringify(config))).errors).toEqual([]);
  });

  test.each([{}, { initialValue: null }, { initialValue: [] }, { initialValue: {} }, { initialValue: true, min: 0 }, { initialValue: -1, min: 0 }, { initialValue: 1, min: 5, max: 2 }])('rejects unsupported declarations %j', async (declaration) => {
    const config = structuredClone(budgetStudy);
    Object.assign(config.globalVariables, { budget: declaration });
    expect((await parseStudyConfig(JSON.stringify(config))).errors.length).toBeGreaterThan(0);
  });

  test.each([{ variable: 'missing', operation: 'subtract' }, { variable: 'eligible', operation: 'add' }, { variable: 'budget', operation: 'append' }])('rejects incompatible actions %j', async (action) => {
    const config = structuredClone(budgetStudy);
    Object.assign(config.components.purchase.response[0].onSubmit[0], action);
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors.some((error) => error.instancePath.includes('onSubmit'))).toBe(true);
  });

  test.each(['{{globalVariables.unknown}}', '{{globalVariables.label}}', 'Budget {{globalVariables.budget}}'])('rejects invalid numeric reference %s', async (value) => {
    const config = structuredClone(budgetStudy);
    config.components.purchase.response[0].max = value;
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors.some((error) => error.instancePath.includes('/max'))).toBe(true);
  });

  test('rejects undeclared store references in inherited instructions and response text with config paths', async () => {
    const config = structuredClone(budgetStudy);
    config.components.purchase.instruction = 'Budget {{globalVariables.missing}}';
    config.components.purchase.response[0].prompt = 'Spend {{globalVariables.unknown}} from {{globalVariables.budget.value}}';
    Object.assign(config, { baseComponents: { basePurchase: config.components.purchase } });
    Object.assign(config.components, { purchase: { baseComponent: 'basePurchase' } });
    const parsed = await parseStudyConfig(JSON.stringify(config));
    expect(parsed.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ instancePath: '/components/purchase/instruction', message: expect.stringContaining('missing') }),
      expect.objectContaining({ instancePath: '/components/purchase/response/0/prompt', message: expect.stringContaining('unknown') }),
      expect.objectContaining({ instancePath: '/components/purchase/response/0/prompt', message: expect.stringContaining('budget.value') }),
    ]));
  });
});

test('validates inherited form actions against the study declarations', async () => {
  const config = structuredClone(budgetStudy);
  const base = { ...config.components.purchase, response: config.components.purchase.response.map((response) => ({ ...response, onSubmit: [{ variable: 'missing', operation: 'subtract' }] })) };
  Object.assign(config, { baseComponents: { basePurchase: base } });
  Object.assign(config.components, { purchase: { baseComponent: 'basePurchase' } });
  expect((await parseStudyConfig(JSON.stringify(config))).errors.some((error) => error.instancePath.includes('/components/purchase/response/'))).toBe(true);
});
