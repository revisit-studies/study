import { useEffect, useState } from 'react';
import {
  BrowserRules, UIConfig,
} from '../../parser/types';

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

  const isMobile = /iphone|ipod|android.*mobile|windows phone|blackberry|opera mini/.test(ua);
  const isTablet = /ipad|android(?!.*mobile)|tablet/.test(ua);

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

export function useAllowedBrowsers(browserRules: BrowserRules | undefined) {
  const [isAllowed, setIsAllowed] = useState(true);

  useEffect(() => {
    const browser = detectBrowser();

    setIsAllowed(browserRules?.allowed.some(
      (b) => b.name === browser.name
        && browser.version >= (b.minVersion ?? 0),
    ) || false);
  }, [browserRules]);

  return isAllowed;
}

export function useDeviceRules(uiConfig?: UIConfig) {
  const [isBrowserAllowed, setIsBrowserAllowed] = useState(true);
  const [isDeviceAllowed, setIsDeviceAllowed] = useState(true);
  const [isInputAllowed, setIsInputAllowed] = useState(true);

  useEffect(() => {
    const browser = detectBrowser();
    const device = detectDeviceType();
    const inputs = detectInputTypes();
    if (!uiConfig) {
      return;
    }

    // Browser check
    if (uiConfig.browserRules?.allowed?.length) {
      const ok = uiConfig.browserRules.allowed.some(
        (b) => b.name === browser.name
          && browser.version >= (b.minVersion ?? 0),
      );
      if (!ok) {
        setIsBrowserAllowed(false);
      }
    }

    // Device check
    if (uiConfig.deviceRules?.allowed?.length) {
      if (!uiConfig.deviceRules.allowed.includes(device)) {
        setIsDeviceAllowed(false);
      }
    }

    // Input type check
    if (uiConfig.inputRules?.allowed?.length) {
      const hasAllowedInput = inputs.some((i) => uiConfig.inputRules!.allowed.includes(i));
      if (!hasAllowedInput) {
        setIsInputAllowed(false);
      }
    }
  }, [uiConfig]);

  return {
    isBrowserAllowed,
    isDeviceAllowed,
    isInputAllowed,
  };
}
