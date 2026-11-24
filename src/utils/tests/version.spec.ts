import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_VERSION, formatAppVersion } from '../version';

describe('formatAppVersion', () => {
  it('reads the application version from the root VERSION file', () => {
    expect(APP_VERSION).toBe(readFileSync(path.resolve('VERSION'), 'utf8').trim());
  });

  it.each([
    ['3.0.0-dev', 'v3.0.0-dev'],
    ['3.0.0', 'v3.0.0'],
  ])('formats %s', (version, label) => {
    expect(formatAppVersion(version)).toBe(label);
  });
});
