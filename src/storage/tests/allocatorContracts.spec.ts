import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const firestoreIndexesPath = resolve(process.cwd(), 'firestore.indexes.json');
const allocatorMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260730000000_allocate_sequence_assignment.sql',
);

describe('sequence allocator deployment contracts', () => {
  test('declares both current and legacy rejected assignment indexes', () => {
    const indexes = JSON.parse(readFileSync(firestoreIndexesPath, 'utf8')) as {
      indexes: Array<{ fields: Array<{ fieldPath: string }> }>;
    };
    const fieldPaths = indexes.indexes.map(
      (index) => index.fields.map((field) => field.fieldPath).join(','),
    );

    expect(fieldPaths).toContain('rejected,claimed,timestamp');
    expect(fieldPaths).toContain('rejected,timestamp');
  });

  test('preserves arbitrary participant IDs when recording a reused assignment', () => {
    const migration = readFileSync(allocatorMigrationPath, 'utf8');

    expect(migration).toContain(
      "substr(reusable_doc_id, length('sequenceAssignment_') + 1)",
    );
    expect(migration).not.toContain(
      "replace(reusable_doc_id, 'sequenceAssignment_', '')",
    );
  });
});
