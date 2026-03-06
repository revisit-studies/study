import { useMemo, useSyncExternalStore } from 'react';
import { StudyRules } from '../parser/types';

type DeviceType = 'desktop' | 'tablet' | 'mobile';
type InputType = 'mouse' | 'touch';

type CurrentDeviceInfo = {
  browser: { name: string; version: number };
  device: DeviceType;
  inputs: InputType[];
  display: { width: number; height: number };
};

const DEFAULT_DEVICE_INFO: CurrentDeviceInfo = {
  browser: { name: 'unknown', version: 0 },
  device: 'desktop',
  inputs: [],
  display: { width: 0, height: 0 },
};

function detectBrowser() {
  const ua = navigator.userAgent.toLowerCase();
  let name = 'unknown';
  let version = 0;

  if (ua.includes('chrome') && !ua.includes('edg') && !ua.includes('opr')) {
    name = 'chrome';
    version = parseInt(ua.match(/chrome\/(\d+)/)?.[1] || '0', 10);
  } else if (ua.includes('firefox')) {
    name = 'firefox';
    version = parseInt(ua.match(/firefox\/(\d+)/)?.[1] || '0', 10);
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    name = 'safari';
    version = parseInt(ua.match(/version\/(\d+)/)?.[1] || '0', 10);
  } else if (ua.includes('edg')) {
    name = 'edge';
    version = parseInt(ua.match(/edg\/(\d+)/)?.[1] || '0', 10);
  }

  return { name, version };
}

function detectDeviceType(): DeviceType {
  const ua = navigator.userAgent.toLowerCase();

  // Detect iPadOS 13+ (spoofs desktop Safari)
  const isModernIpad = ua.includes('macintosh')
    && navigator.maxTouchPoints > 1;

  const isMobile = /iphone|ipod|android.*mobile|windows phone|blackberry|opera mini/.test(ua);
  const isTablet = /ipad|tablet/.test(ua)
    || (/android/.test(ua) && !/mobile/.test(ua))
    || isModernIpad;

  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  return 'desktop';
}

function detectInputTypes(): InputType[] {
  const types: InputType[] = [];
  if (window.matchMedia('(pointer:fine)').matches) types.push('mouse');
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) types.push('touch');
  return types;
}

function detectDisplay() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function readCurrentDeviceInfo(): CurrentDeviceInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return DEFAULT_DEVICE_INFO;
  }

  return {
    browser: detectBrowser(),
    device: detectDeviceType(),
    inputs: detectInputTypes(),
    display: detectDisplay(),
  };
}

function sameDeviceInfo(a: CurrentDeviceInfo, b: CurrentDeviceInfo) {
  return a.browser.name === b.browser.name
    && a.browser.version === b.browser.version
    && a.device === b.device
    && a.display.width === b.display.width
    && a.display.height === b.display.height
    && a.inputs.length === b.inputs.length
    && a.inputs.every((input, idx) => input === b.inputs[idx]);
}

let snapshot = readCurrentDeviceInfo();
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function refreshSnapshot() {
  const next = readCurrentDeviceInfo();
  if (!sameDeviceInfo(snapshot, next)) {
    snapshot = next;
    notifyListeners();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (listeners.size === 1 && typeof window !== 'undefined') {
    snapshot = readCurrentDeviceInfo();
    window.addEventListener('resize', refreshSnapshot);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('resize', refreshSnapshot);
    }
  };
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return DEFAULT_DEVICE_INFO;
}

export function useDeviceRules(studyRules?: StudyRules) {
  const currentDeviceInfo = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const {
    isBrowserAllowed,
    isDeviceAllowed,
    isInputAllowed,
    isDisplayAllowed,
  } = useMemo(() => {
    const {
      browser,
      device,
      inputs,
      display,
    } = currentDeviceInfo;

    const browserOk = !studyRules?.browsers?.allowed?.length
      || studyRules.browsers.allowed.some(
        (allowedBrowser) => allowedBrowser.name === browser.name
          && browser.version >= (allowedBrowser.minVersion ?? 0),
      );
    const deviceOk = !studyRules?.devices?.allowed?.length
      || studyRules.devices.allowed.includes(device);
    const inputOk = !studyRules?.inputs?.allowed?.length
      || inputs.some((input) => studyRules.inputs?.allowed?.includes(input));
    const {
      minWidth, minHeight, maxWidth, maxHeight,
    } = studyRules?.display ?? {};
    const displayOk = !studyRules?.display || (
      (minWidth === undefined || display.width >= minWidth)
      && (minHeight === undefined || display.height >= minHeight)
      && (maxWidth === undefined || display.width <= maxWidth)
      && (maxHeight === undefined || display.height <= maxHeight)
    );

    return {
      isBrowserAllowed: browserOk,
      isDeviceAllowed: deviceOk,
      isInputAllowed: inputOk,
      isDisplayAllowed: displayOk,
    };
  }, [currentDeviceInfo, studyRules]);

  return {
    isBrowserAllowed,
    isDeviceAllowed,
    isInputAllowed,
    isDisplayAllowed,
    currentBrowser: currentDeviceInfo.browser,
    currentDevice: currentDeviceInfo.device,
    currentInputs: currentDeviceInfo.inputs,
    currentDisplay: currentDeviceInfo.display,
  };
}
