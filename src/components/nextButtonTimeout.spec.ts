import { describe, expect, test } from 'vitest';
import {
  DEFAULT_AUTO_ADVANCE_WARNING_MESSAGE,
  DEFAULT_AUTO_ADVANCE_WARNING_TIME,
  formatAutoAdvanceWarningMessage,
  getAutoAdvanceWarning,
} from './nextButtonTimeout';

describe('nextButtonTimeout', () => {
  test('formats warning messages with the remaining seconds placeholder', () => {
    expect(formatAutoAdvanceWarningMessage(
      'Custom timeout warning: advancing in {seconds} {unit} without saving this component.',
      4,
    )).toBe('Custom timeout warning: advancing in 4 seconds without saving this component.');
  });

  test('formats the unit placeholder even when the message omits the numeric placeholder', () => {
    expect(formatAutoAdvanceWarningMessage(
      'Custom timeout warning: the component will advance in one {unit}.',
      1,
    )).toBe('Custom timeout warning: the component will advance in one second.');
  });

  test('shows the default warning as soon as a shorter auto-advance timer enters the default warning window', () => {
    expect(getAutoAdvanceWarning({
      timer: 1000,
      autoAdvanceTime: 25000,
    })).toEqual({
      remainingTime: 24000,
      message: `${DEFAULT_AUTO_ADVANCE_WARNING_MESSAGE} 24 seconds remaining.`,
    });
  });

  test('suppresses the warning outside the configured warning window', () => {
    expect(getAutoAdvanceWarning({
      timer: 500,
      autoAdvanceTime: 5000,
      warningTime: 1000,
      warningMessage: 'Advancing in {seconds} {unit}.',
    })).toBeNull();
  });

  test('uses the configured warning window', () => {
    expect(getAutoAdvanceWarning({
      timer: 3000,
      autoAdvanceTime: 5000,
      warningTime: 2500,
      warningMessage: 'Advancing in {seconds} {unit}.',
    })).toEqual({
      remainingTime: 2000,
      message: 'Advancing in 2 seconds.',
    });
  });

  test('retains the documented default warning lead time', () => {
    expect(DEFAULT_AUTO_ADVANCE_WARNING_TIME).toBe(30000);
  });
});
