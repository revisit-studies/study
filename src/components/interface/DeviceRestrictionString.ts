import { StudyRules } from '../../parser/types';

export type DeviceRuleStatus = {
  isBrowserAllowed: boolean;
  isDeviceAllowed: boolean;
  isInputAllowed: boolean;
  isDisplayAllowed: boolean;
};

const toTitleCase = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

function getDisplayRestrictionLines(display: StudyRules['display']) {
  if (!display) return [];

  const lines: string[] = [];
  const {
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
  } = display;

  if (minWidth !== undefined && minHeight !== undefined) {
    lines.push(`Display (min): ${minWidth} x ${minHeight} px`);
  } else if (minWidth !== undefined) {
    lines.push(`Display (min width): ${minWidth} px`);
  } else if (minHeight !== undefined) {
    lines.push(`Display (min height): ${minHeight} px`);
  }

  if (maxWidth !== undefined && maxHeight !== undefined) {
    lines.push(`Display (max): ${maxWidth} x ${maxHeight} px`);
  } else if (maxWidth !== undefined) {
    lines.push(`Display (max width): ${maxWidth} px`);
  } else if (maxHeight !== undefined) {
    lines.push(`Display (max height): ${maxHeight} px`);
  }

  return lines;
}

export function getConfiguredDeviceRestrictionLines(studyRules: StudyRules | undefined) {
  const configured: string[] = [];

  if (studyRules?.browsers?.allowed?.length) {
    const browserText = studyRules.browsers.allowed
      .map((browser) => `${browser.name}${browser.minVersion !== undefined ? ` >= ${browser.minVersion}` : ''}`)
      .join(', ');
    configured.push(`Browser: ${browserText}`);
  }

  if (studyRules?.devices?.allowed?.length) {
    configured.push(`Device: ${studyRules.devices.allowed.map((device) => toTitleCase(device)).join(', ')}`);
  }

  if (studyRules?.inputs?.allowed?.length) {
    configured.push(`Input: ${studyRules.inputs.allowed.map((input) => toTitleCase(input)).join(', ')}`);
  }

  configured.push(...getDisplayRestrictionLines(studyRules?.display));
  return configured;
}

export function getConfiguredDeviceRestrictionTooltip(studyRules: StudyRules | undefined) {
  const configuredLines = getConfiguredDeviceRestrictionLines(studyRules);
  if (configuredLines.length === 0) {
    return '';
  }
  return `Device Requirement\n${configuredLines.join('\n')}`;
}

export function getUnmetDeviceRestrictionLines(
  studyRules: StudyRules | undefined,
  {
    isBrowserAllowed,
    isDeviceAllowed,
    isInputAllowed,
    isDisplayAllowed,
  }: DeviceRuleStatus,
) {
  const unmet: string[] = [];

  if (studyRules?.browsers?.allowed?.length && !isBrowserAllowed) {
    const browserText = studyRules.browsers.allowed
      .map((browser) => `${browser.name}${browser.minVersion !== undefined ? ` >= ${browser.minVersion}` : ''}`)
      .join(', ');
    unmet.push(`Browser: ${browserText}`);
  }

  if (studyRules?.devices?.allowed?.length && !isDeviceAllowed) {
    unmet.push(`Device: ${studyRules.devices.allowed.map((device) => toTitleCase(device)).join(', ')}`);
  }

  if (studyRules?.inputs?.allowed?.length && !isInputAllowed) {
    unmet.push(`Input: ${studyRules.inputs.allowed.map((input) => toTitleCase(input)).join(', ')}`);
  }

  if (studyRules?.display && !isDisplayAllowed) {
    unmet.push(...getDisplayRestrictionLines(studyRules.display));
  }

  return unmet;
}

export function getUnmetDeviceRestrictionTooltip(
  studyRules: StudyRules | undefined,
  status: DeviceRuleStatus,
) {
  const unmetLines = getUnmetDeviceRestrictionLines(studyRules, status);
  if (unmetLines.length === 0) {
    return '';
  }
  return `Device Requirement\n${unmetLines.join('\n')}`;
}
