import { parse as hjsonParse } from 'hjson';

export const DEFAULT_CONTACT_EMAIL = 'contact@revisit.dev';
export const DEFAULT_FIREBASE_PROJECT_ID = 'revisit-utah';
export const DEFAULT_FIREBASE_AUTH_DOMAIN = 'revisit-utah.firebaseapp.com';

export const DEFAULT_FIREBASE_WARNING_MESSAGE = 'This study is connected to ReVISit\'s default Firebase project. Participant data may not be saved to a backend controlled by the study designer.';
export const DEFAULT_FIREBASE_WARNING_ACTION = 'Set VITE_FIREBASE_CONFIG to a Firebase project controlled by the study designer or choose another storage engine';

const REVISIT_DOMAINS = ['revisit.dev', 'vdl.sci.utah.edu'];
const LOCAL_DEVELOPMENT_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

type FirebaseConfig = {
  projectId?: unknown;
  authDomain?: unknown;
};

export function getCurrentHostname() {
  return typeof window !== 'undefined' ? window.location.hostname : '';
}

export function isLocalDevelopmentHostname(hostname: string) {
  return LOCAL_DEVELOPMENT_HOSTNAMES.has(hostname);
}

export function isRevisitControlledHostname(hostname: string) {
  return REVISIT_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

export function shouldSuppressDefaultDeploymentWarnings(hostname = getCurrentHostname()) {
  return isLocalDevelopmentHostname(hostname) || isRevisitControlledHostname(hostname);
}

export function parseFirebaseConfig(firebaseConfigText: string | undefined) {
  if (!firebaseConfigText) {
    return null;
  }

  try {
    return hjsonParse(firebaseConfigText) as unknown;
  } catch {
    return null;
  }
}

export function isDefaultRevisitFirebaseConfig(firebaseConfig: unknown) {
  if (!firebaseConfig || typeof firebaseConfig !== 'object') {
    return false;
  }

  const { projectId, authDomain } = firebaseConfig as FirebaseConfig;
  return projectId === DEFAULT_FIREBASE_PROJECT_ID || authDomain === DEFAULT_FIREBASE_AUTH_DOMAIN;
}

export function shouldWarnForDefaultFirebaseConfig({
  storageEngine = import.meta.env.VITE_STORAGE_ENGINE,
  firebaseConfigText = import.meta.env.VITE_FIREBASE_CONFIG,
  hostname = getCurrentHostname(),
}: {
  storageEngine?: string;
  firebaseConfigText?: string;
  hostname?: string;
} = {}) {
  return storageEngine === 'firebase'
    && !shouldSuppressDefaultDeploymentWarnings(hostname)
    && isDefaultRevisitFirebaseConfig(parseFirebaseConfig(firebaseConfigText));
}
