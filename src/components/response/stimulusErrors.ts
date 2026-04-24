import { IndividualComponent, Response } from '../../parser/types';
import type { ValidationStatus } from '../../store/types';

export type StimulusIssueType = 'unanswered' | 'invalid';
export type StimulusIssueReason =
  | 'forceCompletion'
  | 'interactiveRequired'
  | 'iframePending'
  | 'customPending';
export type StimulusValidationIssue = {
  type: 'none' | StimulusIssueType;
  message?: string;
  reason?: StimulusIssueReason;
};

export function shouldUseStimulusValidation(componentConfig: IndividualComponent) {
  return componentConfig.type === 'video'
    || componentConfig.type === 'website'
    || componentConfig.type === 'react-component'
    || componentConfig.type === 'vega';
}

export function hasRequiredReactiveResponse(response: Response[] = []) {
  return response.some((entry) => entry.type === 'reactive' && entry.required !== false);
}

export function getInitialStimulusValidation(componentConfig: IndividualComponent): ValidationStatus {
  if (!shouldUseStimulusValidation(componentConfig)) {
    return {
      valid: true,
      values: {},
    };
  }

  // Forced-completion videos are invalid until playback reaches the end
  if (componentConfig.type === 'video' && componentConfig.forceCompletion) {
    return {
      valid: false,
      values: {},
      reason: 'forceCompletion',
    };
  }

  // Interactive stimuli with required reactive answers are invalid until they report completion
  if (hasRequiredReactiveResponse(componentConfig.response)) {
    return {
      valid: false,
      values: {},
      reason: componentConfig.type === 'website' ? 'iframePending' : 'interactiveRequired',
    };
  }

  return {
    valid: true,
    values: {},
  };
}

export function evaluateStimulusIssue(
  componentConfig: IndividualComponent,
  validationStatus?: ValidationStatus,
): StimulusValidationIssue {
  if (!shouldUseStimulusValidation(componentConfig)) {
    return { type: 'none' };
  }

  if (!validationStatus || validationStatus.valid) {
    return { type: 'none' };
  }

  return {
    type: 'unanswered',
    message: validationStatus.message,
    reason: validationStatus.reason,
  };
}

function getDefaultStimulusMessage(
  componentConfig: IndividualComponent,
  reason?: StimulusIssueReason,
) {
  switch (reason) {
    // Forced-completion videos stay invalid until the participant finishes playback
    case 'forceCompletion':
      return 'Please finish the video to continue.';
    // Embedded website/iframe stimuli stay invalid until the embedded activity reports completion
    case 'iframePending':
      return 'Please finish the embedded activity to continue.';
    // React/Vega-style interactive stimuli stay invalid until they emit their required completion state
    case 'interactiveRequired':
      return 'Please complete the stimulus interaction to continue.';
    // Custom stimuli can explicitly keep themselves invalid until their own completion logic is met
    case 'customPending':
      return 'Please complete the stimulus to continue.';
    default:
      break;
  }

  if (componentConfig.type === 'video' && componentConfig.forceCompletion) {
    return 'Please finish the video to continue.';
  }

  if (componentConfig.type === 'website') {
    return 'Please finish the embedded activity to continue.';
  }

  if (
    componentConfig.type === 'react-component'
    || componentConfig.type === 'vega'
    || hasRequiredReactiveResponse(componentConfig.response)
  ) {
    return 'Please complete the stimulus interaction to continue.';
  }

  return 'Please complete the stimulus to continue.';
}

export function generateStimulusErrorMessage(
  componentConfig: IndividualComponent,
  validationStatus?: ValidationStatus,
  options?: { showStimulusErrors?: boolean },
) {
  const issue = evaluateStimulusIssue(componentConfig, validationStatus);

  if (issue.type === 'none') {
    return null;
  }

  if (!options?.showStimulusErrors) {
    return null;
  }

  if (issue.message) {
    return issue.message;
  }

  return getDefaultStimulusMessage(componentConfig, issue.reason);
}

// Checks whether a stimulus has an issue that should block progression, and if so, what type of issue it is (unanswered vs invalid)
export function getStimulusIssueType(
  componentConfig: IndividualComponent,
  validationStatus?: ValidationStatus,
): StimulusIssueType | null {
  const issue = evaluateStimulusIssue(componentConfig, validationStatus);
  return issue.type === 'none' ? null : issue.type;
}
