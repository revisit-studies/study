import { describe, expect, it } from 'vitest';
import { sanitizeStringForUrl } from './sanitizeStringForUrl';

describe('sanitizeStringForUrl', () => {
  it('keeps semantic version dots as part of the slug', () => {
    expect(sanitizeStringForUrl('screening-gpt-5.2')).toBe('screening-gpt-5_2');
  });

  it('replaces all periods, spaces, and slashes', () => {
    expect(sanitizeStringForUrl('my.study v1.0')).toBe('my_study_v1_0');
    expect(sanitizeStringForUrl('folder/sub.study name')).toBe('sub_study_name');
  });

  it('removes known file extensions', () => {
    expect(sanitizeStringForUrl('config.json')).toBe('config');
    expect(sanitizeStringForUrl('config.yaml')).toBe('config');
    expect(sanitizeStringForUrl('config.hjson')).toBe('config');
  });
});
