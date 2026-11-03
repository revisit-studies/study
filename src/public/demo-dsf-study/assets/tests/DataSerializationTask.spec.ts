import { parse } from 'hjson';
import { expect, test } from 'vitest';
import { CONFIG_DOCUMENTS, TABULAR_DOCUMENTS } from '../DataSerializationTask';

test.each([
  { context: 'configuration', documents: CONFIG_DOCUMENTS },
  { context: 'tabular', documents: TABULAR_DOCUMENTS },
])('the $context HJSON stimulus matches its JSON reference', ({ documents }) => {
  expect(parse(documents.HJSON)).toEqual(JSON.parse(documents.JSON));
});
