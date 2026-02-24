import { describe, expect, it } from 'vitest';
import { parseTrialOrder } from './parseTrialOrder';

describe('parseTrialOrder', () => {
  it('returns null indices for missing input', () => {
    expect(parseTrialOrder()).toEqual({ step: null, funcIndex: null });
    expect(parseTrialOrder('')).toEqual({ step: null, funcIndex: null });
  });

  it('parses a step-only trial order', () => {
    expect(parseTrialOrder('12')).toEqual({ step: 12, funcIndex: null });
  });

  it('parses a dynamic-block trial order', () => {
    expect(parseTrialOrder('12_3')).toEqual({ step: 12, funcIndex: 3 });
    expect(parseTrialOrder('12_0')).toEqual({ step: 12, funcIndex: 0 });
  });

  it('handles partially invalid values safely', () => {
    expect(parseTrialOrder('foo_2')).toEqual({ step: null, funcIndex: 2 });
    expect(parseTrialOrder('7_bar')).toEqual({ step: 7, funcIndex: null });
  });
});
