import { describe, expect, test } from 'vitest';
import type { DisplayRules, StudyRules } from '../../../parser/types';
import type { DeviceRuleStatus } from '../DeviceRestrictionString';
import {
  getConfiguredDeviceRestrictionLines,
  getConfiguredDeviceRestrictionTooltip,
  getUnmetDeviceRestrictionLines,
  getUnmetDeviceRestrictionTooltip,
} from '../DeviceRestrictionString';

const allAllowed: DeviceRuleStatus = {
  isBrowserAllowed: true,
  isDeviceAllowed: true,
  isInputAllowed: true,
  isDisplayAllowed: true,
};

const allBlocked: DeviceRuleStatus = {
  isBrowserAllowed: false,
  isDeviceAllowed: false,
  isInputAllowed: false,
  isDisplayAllowed: false,
};

// ---------------------------------------------------------------------------
// getConfiguredDeviceRestrictionLines
// ---------------------------------------------------------------------------

describe('getConfiguredDeviceRestrictionLines', () => {
  test('returns empty array when studyRules is undefined', () => {
    expect(getConfiguredDeviceRestrictionLines(undefined)).toEqual([]);
  });

  test('includes browser names without version when minVersion is absent', () => {
    const rules: StudyRules = { browsers: { allowed: [{ name: 'chrome' }] } };
    const lines = getConfiguredDeviceRestrictionLines(rules);
    expect(lines).toEqual(['Browser: chrome']);
  });

  test('includes browser name with minVersion when provided', () => {
    const rules: StudyRules = { browsers: { allowed: [{ name: 'firefox', minVersion: 100 }] } };
    const lines = getConfiguredDeviceRestrictionLines(rules);
    expect(lines[0]).toBe('Browser: firefox >= 100');
  });

  test('joins multiple browsers with comma', () => {
    const rules: StudyRules = { browsers: { allowed: [{ name: 'chrome' }, { name: 'safari' }] } };
    const lines = getConfiguredDeviceRestrictionLines(rules);
    expect(lines[0]).toBe('Browser: chrome, safari');
  });

  test('includes devices in title case', () => {
    const rules: StudyRules = { devices: { allowed: ['desktop', 'mobile'] } };
    const lines = getConfiguredDeviceRestrictionLines(rules);
    expect(lines[0]).toBe('Device: Desktop, Mobile');
  });

  test('includes inputs in title case', () => {
    const rules: StudyRules = { inputs: { allowed: ['mouse', 'touch'] } };
    const lines = getConfiguredDeviceRestrictionLines(rules);
    expect(lines[0]).toBe('Input: Mouse, Touch');
  });

  test('includes both min and max display as separate lines', () => {
    const rules: StudyRules = {
      display: {
        minWidth: 800, minHeight: 600, maxWidth: 1920, maxHeight: 1080,
      },
    };
    const lines = getConfiguredDeviceRestrictionLines(rules);
    expect(lines).toContain('Display (min): 800 x 600 px');
    expect(lines).toContain('Display (max): 1920 x 1080 px');
  });

  test('includes only minWidth when only minWidth is set', () => {
    const rules: StudyRules = { display: { minWidth: 1024 } as Partial<DisplayRules> as DisplayRules };
    const lines = getConfiguredDeviceRestrictionLines(rules);
    expect(lines).toContain('Display (min width): 1024 px');
  });

  test('includes only minHeight when only minHeight is set', () => {
    const rules: StudyRules = { display: { minHeight: 768 } as Partial<DisplayRules> as DisplayRules };
    const lines = getConfiguredDeviceRestrictionLines(rules);
    expect(lines).toContain('Display (min height): 768 px');
  });

  test('includes only maxWidth when only maxWidth is set', () => {
    const rules: StudyRules = { display: { maxWidth: 2560 } as Partial<DisplayRules> as DisplayRules };
    const lines = getConfiguredDeviceRestrictionLines(rules);
    expect(lines).toContain('Display (max width): 2560 px');
  });

  test('includes only maxHeight when only maxHeight is set', () => {
    const rules: StudyRules = { display: { maxHeight: 1440 } as Partial<DisplayRules> as DisplayRules };
    const lines = getConfiguredDeviceRestrictionLines(rules);
    expect(lines).toContain('Display (max height): 1440 px');
  });
});

// ---------------------------------------------------------------------------
// getConfiguredDeviceRestrictionTooltip
// ---------------------------------------------------------------------------

describe('getConfiguredDeviceRestrictionTooltip', () => {
  test('returns empty string when there are no configured lines', () => {
    expect(getConfiguredDeviceRestrictionTooltip(undefined)).toBe('');
  });

  test('returns formatted tooltip with header when lines exist', () => {
    const rules: StudyRules = { browsers: { allowed: [{ name: 'chrome' }] } };
    const tooltip = getConfiguredDeviceRestrictionTooltip(rules);
    expect(tooltip).toBe('Device Requirement\nBrowser: chrome');
  });

  test('joins multiple restriction lines with newline', () => {
    const rules: StudyRules = {
      browsers: { allowed: [{ name: 'chrome' }] },
      devices: { allowed: ['desktop'] },
    };
    const tooltip = getConfiguredDeviceRestrictionTooltip(rules);
    expect(tooltip).toContain('Browser: chrome');
    expect(tooltip).toContain('Device: Desktop');
  });
});

// ---------------------------------------------------------------------------
// getUnmetDeviceRestrictionLines
// ---------------------------------------------------------------------------

describe('getUnmetDeviceRestrictionLines', () => {
  test('returns empty array when studyRules is undefined', () => {
    expect(getUnmetDeviceRestrictionLines(undefined, allBlocked)).toEqual([]);
  });

  test('returns empty array when all constraints are met', () => {
    const rules: StudyRules = {
      browsers: { allowed: [{ name: 'chrome' }] },
      devices: { allowed: ['desktop'] },
    };
    expect(getUnmetDeviceRestrictionLines(rules, allAllowed)).toEqual([]);
  });

  test('reports unmet browser constraint', () => {
    const rules: StudyRules = { browsers: { allowed: [{ name: 'chrome', minVersion: 100 }] } };
    const lines = getUnmetDeviceRestrictionLines(rules, { ...allAllowed, isBrowserAllowed: false });
    expect(lines[0]).toBe('Browser: chrome >= 100');
  });

  test('reports unmet device constraint', () => {
    const rules: StudyRules = { devices: { allowed: ['desktop'] } };
    const lines = getUnmetDeviceRestrictionLines(rules, { ...allAllowed, isDeviceAllowed: false });
    expect(lines[0]).toBe('Device: Desktop');
  });

  test('reports unmet input constraint', () => {
    const rules: StudyRules = { inputs: { allowed: ['mouse'] } };
    const lines = getUnmetDeviceRestrictionLines(rules, { ...allAllowed, isInputAllowed: false });
    expect(lines[0]).toBe('Input: Mouse');
  });

  test('reports unmet display constraints', () => {
    const rules: StudyRules = { display: { minWidth: 800, minHeight: 600 } };
    const lines = getUnmetDeviceRestrictionLines(rules, { ...allAllowed, isDisplayAllowed: false });
    expect(lines).toContain('Display (min): 800 x 600 px');
  });

  test('does not report browser when isBrowserAllowed is true', () => {
    const rules: StudyRules = { browsers: { allowed: [{ name: 'chrome' }] } };
    const lines = getUnmetDeviceRestrictionLines(rules, { ...allAllowed, isBrowserAllowed: true });
    expect(lines).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getUnmetDeviceRestrictionTooltip
// ---------------------------------------------------------------------------

describe('getUnmetDeviceRestrictionTooltip', () => {
  test('returns empty string when no constraints are unmet', () => {
    expect(getUnmetDeviceRestrictionTooltip(undefined, allAllowed)).toBe('');
  });

  test('returns formatted tooltip for unmet constraints', () => {
    const rules: StudyRules = { devices: { allowed: ['mobile'] } };
    const tooltip = getUnmetDeviceRestrictionTooltip(rules, { ...allAllowed, isDeviceAllowed: false });
    expect(tooltip).toBe('Device Requirement\nDevice: Mobile');
  });
});
