import { useEffect, useState } from 'react';
import { StudyRules } from '../../parser/types';

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

function detectDeviceType() {
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

function detectInputTypes() {
  const types: ('mouse' | 'touch')[] = [];
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

const DEFAULT_BROWSER = { name: 'unknown', version: 0 };
const DEFAULT_DEVICE: 'desktop' | 'tablet' | 'mobile' = 'desktop';
const DEFAULT_INPUTS: ('mouse' | 'touch')[] = [];
const DEFAULT_DISPLAY = { width: 0, height: 0 };

export function useDeviceRules(studyRules?: StudyRules) {
  const [isBrowserAllowed, setIsBrowserAllowed] = useState(true);
  const [isDeviceAllowed, setIsDeviceAllowed] = useState(true);
  const [isInputAllowed, setIsInputAllowed] = useState(true);
  const [isDisplayAllowed, setIsDisplayAllowed] = useState(true);
  const [currentBrowser, setCurrentBrowser] = useState(() => (
    typeof navigator === 'undefined' ? DEFAULT_BROWSER : detectBrowser()
  ));
  const [currentDevice, setCurrentDevice] = useState(() => (
    typeof navigator === 'undefined' ? DEFAULT_DEVICE : detectDeviceType()
  ));
  const [currentInputs, setCurrentInputs] = useState(() => (
    typeof window === 'undefined' || typeof navigator === 'undefined'
      ? DEFAULT_INPUTS
      : detectInputTypes()
  ));
  const [currentDisplay, setCurrentDisplay] = useState(() => (
    typeof window === 'undefined' ? DEFAULT_DISPLAY : detectDisplay()
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return () => {};
    }

    const evaluateRules = () => {
      const browser = detectBrowser();
      const device = detectDeviceType();
      const inputs = detectInputTypes();
      const display = detectDisplay();
      setCurrentBrowser(browser);
      setCurrentDevice(device);
      setCurrentInputs(inputs);
      setCurrentDisplay(display);

      const browserOk = !studyRules?.browsers?.allowed?.length
        || studyRules.browsers.allowed.some(
          (b) => b.name === browser.name
            && browser.version >= (b.minVersion ?? 0),
        );
      const deviceOk = !studyRules?.devices?.allowed?.length
        || studyRules.devices.allowed.includes(device);
      const inputOk = !studyRules?.inputs?.allowed?.length
        || inputs.some((i) => studyRules.inputs?.allowed?.includes(i));
      const {
        minWidth, minHeight, maxWidth, maxHeight,
      } = studyRules?.display ?? {};
      const displayOk = !studyRules?.display || (
        (minWidth === undefined || display.width >= minWidth)
        && (minHeight === undefined || display.height >= minHeight)
        && (maxWidth === undefined || display.width <= maxWidth)
        && (maxHeight === undefined || display.height <= maxHeight)
      );

      setIsBrowserAllowed(browserOk);
      setIsDeviceAllowed(deviceOk);
      setIsInputAllowed(inputOk);
      setIsDisplayAllowed(displayOk);
    };

    evaluateRules();
    window.addEventListener('resize', evaluateRules);

    return () => {
      window.removeEventListener('resize', evaluateRules);
    };
  }, [studyRules]);

  return {
    isBrowserAllowed,
    isDeviceAllowed,
    isInputAllowed,
    isDisplayAllowed,
    currentBrowser,
    currentDevice,
    currentInputs,
    currentDisplay,
  };
}
