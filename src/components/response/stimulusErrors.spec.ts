import { describe, expect, it } from 'vitest';
import { IndividualComponent } from '../../parser/types';
import {
  evaluateStimulusIssue,
  generateStimulusErrorMessage,
  getInitialStimulusValidation,
  getStimulusIssueType,
  shouldUseStimulusValidation,
} from './stimulusErrors';

describe('getInitialStimulusValidation', () => {
  it('marks forced-completion videos as invalid initially', () => {
    const component: IndividualComponent = {
      type: 'video',
      path: 'demo-video/assets/venice.mp4',
      forceCompletion: true,
      response: [],
    };

    expect(getInitialStimulusValidation(component)).toEqual({
      valid: false,
      values: {},
      reason: 'forceCompletion',
    });
  });

  it('marks website components with required reactive responses as invalid initially', () => {
    const component: IndividualComponent = {
      type: 'website',
      path: 'https://example.com',
      response: [
        {
          id: 'reactive-status',
          type: 'reactive',
          prompt: 'Status',
        },
      ],
    };

    expect(getInitialStimulusValidation(component)).toEqual({
      valid: false,
      values: {},
      reason: 'iframePending',
    });
  });

  it('leaves regular questionnaires valid initially', () => {
    const component: IndividualComponent = {
      type: 'questionnaire',
      response: [],
    };

    expect(getInitialStimulusValidation(component)).toEqual({
      valid: true,
      values: {},
    });
  });

  it('does not use stimulus validation for questionnaires', () => {
    const component: IndividualComponent = {
      type: 'questionnaire',
      response: [],
    };

    expect(shouldUseStimulusValidation(component)).toBe(false);
  });
});

describe('evaluateStimulusIssue', () => {
  it('returns none for components that do not use stimulus validation', () => {
    const component: IndividualComponent = {
      type: 'questionnaire',
      response: [],
    };

    expect(evaluateStimulusIssue(component, { valid: false, values: {}, reason: 'customPending' })).toEqual({ type: 'none' });
  });

  it('returns none when the validation status is valid', () => {
    const component: IndividualComponent = {
      type: 'video',
      path: 'demo-video/assets/venice.mp4',
      forceCompletion: true,
      response: [],
    };

    expect(evaluateStimulusIssue(component, { valid: true, values: {} })).toEqual({ type: 'none' });
  });

  it('returns an unanswered issue with the reason when invalid', () => {
    const component: IndividualComponent = {
      type: 'video',
      path: 'demo-video/assets/venice.mp4',
      forceCompletion: true,
      response: [],
    };

    expect(evaluateStimulusIssue(component, { valid: false, values: {}, reason: 'forceCompletion' })).toEqual({
      type: 'unanswered',
      reason: 'forceCompletion',
      message: undefined,
    });
  });
});

describe('getStimulusIssueType', () => {
  it('returns null when there is no issue', () => {
    const component: IndividualComponent = {
      type: 'video',
      path: 'demo-video/assets/venice.mp4',
      forceCompletion: true,
      response: [],
    };

    expect(getStimulusIssueType(component, { valid: true, values: {} })).toBeNull();
  });

  it('returns unanswered when the stimulus is incomplete', () => {
    const component: IndividualComponent = {
      type: 'react-component',
      path: 'demo-form-elements/assets/StimulusGate.tsx',
      response: [],
    };

    expect(getStimulusIssueType(component, { valid: false, values: {}, reason: 'customPending' })).toBe('unanswered');
  });
});

describe('generateStimulusErrorMessage', () => {
  it('returns null when showStimulusErrors is not set', () => {
    const component: IndividualComponent = {
      type: 'video',
      path: 'demo-video/assets/venice.mp4',
      forceCompletion: true,
      response: [],
    };

    expect(generateStimulusErrorMessage(component, {
      valid: false,
      values: {},
      reason: 'forceCompletion',
    })).toBeNull();
  });

  it('returns the forced video message', () => {
    const component: IndividualComponent = {
      type: 'video',
      path: 'demo-video/assets/venice.mp4',
      forceCompletion: true,
      response: [],
    };

    expect(generateStimulusErrorMessage(component, {
      valid: false,
      values: {},
      reason: 'forceCompletion',
    }, { showStimulusErrors: true })).toBe('Please finish the video to continue.');
  });

  it('returns the embedded activity message for websites', () => {
    const component: IndividualComponent = {
      type: 'website',
      path: 'https://example.com',
      response: [],
    };

    expect(generateStimulusErrorMessage(component, {
      valid: false,
      values: {},
      reason: 'iframePending',
    }, { showStimulusErrors: true })).toBe('Please finish the embedded activity to continue.');
  });

  it('prefers an explicit controller-provided message', () => {
    const component: IndividualComponent = {
      type: 'react-component',
      path: 'demo-form-elements/assets/StimulusGate.tsx',
      response: [],
    };

    expect(generateStimulusErrorMessage(component, {
      valid: false,
      values: {},
      reason: 'customPending',
      message: 'Please click Complete stimulus to continue.',
    }, { showStimulusErrors: true })).toBe('Please click Complete stimulus to continue.');
  });

  it('does not return a stimulus message for questionnaires', () => {
    const component: IndividualComponent = {
      type: 'questionnaire',
      response: [],
    };

    expect(generateStimulusErrorMessage(component, {
      valid: false,
      values: {},
      reason: 'customPending',
    }, { showStimulusErrors: true })).toBeNull();
  });
});
