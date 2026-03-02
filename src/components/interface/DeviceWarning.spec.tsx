import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { DeviceWarning } from './DeviceWarning';

type StudyRulesMock = {
  display?: {
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    blockedMessage?: string;
  };
  browsers?: {
    blockedMessage?: string;
    allowed: { name: string; minVersion?: number }[];
  };
  devices?: {
    blockedMessage?: string;
    allowed: string[];
  };
  inputs?: {
    blockedMessage?: string;
    allowed: string[];
  };
};

type DeviceRulesMock = {
  isBrowserAllowed: boolean;
  isDeviceAllowed: boolean;
  isInputAllowed: boolean;
  isDisplayAllowed: boolean;
  currentBrowser: { name: string; version: number };
  currentDevice: 'desktop' | 'tablet' | 'mobile';
  currentInputs: ('mouse' | 'touch')[];
  currentDisplay: { width: number; height: number };
};

let mockedStudyRules: StudyRulesMock = {};
let mockedDeviceRules: DeviceRulesMock = {
  isBrowserAllowed: true,
  isDeviceAllowed: true,
  isInputAllowed: true,
  isDisplayAllowed: true,
  currentBrowser: { name: 'chrome', version: 120 },
  currentDevice: 'desktop',
  currentInputs: ['mouse'],
  currentDisplay: { width: 1920, height: 1080 },
};

vi.mock('@mantine/core', () => ({
  Modal: ({ opened, children }: { opened: boolean; children: ReactNode }) => (opened ? <div>{children}</div> : null),
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Title: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  List: Object.assign(
    ({ children }: { children: ReactNode }) => <ul>{children}</ul>,
    { Item: ({ children }: { children: ReactNode }) => <li>{children}</li> },
  ),
  Card: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    { Section: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  ),
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconAlertTriangle: () => <span>warning-icon</span>,
  IconBrowser: () => <span>browser-icon</span>,
  IconDevices: () => <span>device-icon</span>,
  IconHandClick: () => <span>input-icon</span>,
  IconDeviceDesktop: () => <span>display-icon</span>,
}));

vi.mock('../../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => ({
    studyRules: mockedStudyRules,
  }),
}));

vi.mock('../../store/hooks/useDeviceRules', () => ({
  useDeviceRules: () => mockedDeviceRules,
}));

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({
    storageEngine: {
      rejectCurrentParticipant: vi.fn().mockResolvedValue(undefined),
    },
  }),
}));

describe('DeviceWarning', () => {
  beforeEach(() => {
    mockedStudyRules = {};
    mockedDeviceRules = {
      isBrowserAllowed: true,
      isDeviceAllowed: true,
      isInputAllowed: true,
      isDisplayAllowed: true,
      currentBrowser: { name: 'chrome', version: 120 },
      currentDevice: 'desktop',
      currentInputs: ['mouse'],
      currentDisplay: { width: 1920, height: 1080 },
    };
  });

  test('renders nothing when all device checks pass', () => {
    const html = renderToStaticMarkup(<DeviceWarning />);
    expect(html).toBe('');
  });

  test('shows display countdown warning when current display is below min requirements', () => {
    mockedStudyRules = {
      display: {
        minWidth: 1200,
        minHeight: 800,
      },
    };
    mockedDeviceRules = {
      ...mockedDeviceRules,
      isDisplayAllowed: false,
      currentDisplay: { width: 1000, height: 700 },
    };

    const html = renderToStaticMarkup(<DeviceWarning />);
    expect(html).toContain('Please resize your browser window to the allowed range within');
    expect(html).toContain('60');
    expect(html).toContain('seconds or you will be rejected.');
  });

  test('does not show countdown warning when display violation is only above max', () => {
    mockedStudyRules = {
      display: {
        minWidth: 800,
        minHeight: 600,
        maxWidth: 1200,
        maxHeight: 800,
      },
    };
    mockedDeviceRules = {
      ...mockedDeviceRules,
      isDisplayAllowed: false,
      currentDisplay: { width: 1300, height: 850 },
    };

    const html = renderToStaticMarkup(<DeviceWarning />);
    expect(html).not.toContain('Please resize your browser window to the allowed range within');
  });

  test('shows current detected values inside each failed rule card', () => {
    mockedStudyRules = {
      browsers: { allowed: [{ name: 'firefox', minVersion: 100 }] },
      devices: { allowed: ['desktop'] },
      inputs: { allowed: ['mouse'] },
      display: { minWidth: 1200, minHeight: 800 },
    };
    mockedDeviceRules = {
      isBrowserAllowed: false,
      isDeviceAllowed: false,
      isInputAllowed: false,
      isDisplayAllowed: false,
      currentBrowser: { name: 'chrome', version: 99 },
      currentDevice: 'mobile',
      currentInputs: ['touch'],
      currentDisplay: { width: 900, height: 700 },
    };

    const html = renderToStaticMarkup(<DeviceWarning />);
    expect(html).toContain('Current browser:');
    expect(html).toContain('chrome');
    expect(html).toContain('Current device:');
    expect(html).toContain('mobile');
    expect(html).toContain('Current input:');
    expect(html).toContain('touch');
    expect(html).toContain('Current display:');
    expect(html).toContain('900 x 700px');
  });
});
