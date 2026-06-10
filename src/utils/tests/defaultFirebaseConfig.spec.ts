import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import {
  DEFAULT_FIREBASE_AUTH_DOMAIN,
  DEFAULT_FIREBASE_PROJECT_ID,
  isDefaultRevisitFirebaseConfig,
  isLocalDevelopmentHostname,
  isRevisitControlledHostname,
  parseFirebaseConfig,
  shouldSuppressDefaultDeploymentWarnings,
  shouldWarnForDefaultFirebaseConfig,
} from '../defaultFirebaseConfig';

describe('defaultFirebaseConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('detects the default Firebase project by projectId or authDomain', () => {
    expect(isDefaultRevisitFirebaseConfig({ projectId: DEFAULT_FIREBASE_PROJECT_ID })).toBe(true);
    expect(isDefaultRevisitFirebaseConfig({ authDomain: DEFAULT_FIREBASE_AUTH_DOMAIN })).toBe(true);
    expect(isDefaultRevisitFirebaseConfig({ projectId: 'custom-project', authDomain: 'custom.firebaseapp.com' })).toBe(false);
  });

  test('parses JSON and HJSON Firebase config text', () => {
    expect(parseFirebaseConfig(JSON.stringify({ projectId: DEFAULT_FIREBASE_PROJECT_ID }))).toEqual({
      projectId: DEFAULT_FIREBASE_PROJECT_ID,
    });
    expect(parseFirebaseConfig(`{ projectId: "${DEFAULT_FIREBASE_PROJECT_ID}" }`)).toEqual({
      projectId: DEFAULT_FIREBASE_PROJECT_ID,
    });
    expect(parseFirebaseConfig('{')).toBeNull();
  });

  test('identifies local and ReVISit-controlled hosts', () => {
    expect(isLocalDevelopmentHostname('localhost')).toBe(true);
    expect(isLocalDevelopmentHostname('127.0.0.1')).toBe(true);
    expect(isRevisitControlledHostname('revisit.dev')).toBe(true);
    expect(isRevisitControlledHostname('study.revisit.dev')).toBe(true);
    expect(isRevisitControlledHostname('vdl.sci.utah.edu')).toBe(true);
    expect(isRevisitControlledHostname('study.vdl.sci.utah.edu')).toBe(true);
    expect(shouldSuppressDefaultDeploymentWarnings('example.com')).toBe(false);
  });

  test('warns only for the default Firebase project on non-controlled hosts', () => {
    const firebaseConfigText = JSON.stringify({ projectId: DEFAULT_FIREBASE_PROJECT_ID });
    expect(shouldWarnForDefaultFirebaseConfig({
      storageEngine: 'firebase',
      firebaseConfigText,
      hostname: 'study.example.com',
    })).toBe(true);
    expect(shouldWarnForDefaultFirebaseConfig({
      storageEngine: 'firebase',
      firebaseConfigText: JSON.stringify({ projectId: 'research-project' }),
      hostname: 'study.example.com',
    })).toBe(false);
    expect(shouldWarnForDefaultFirebaseConfig({
      storageEngine: 'supabase',
      firebaseConfigText,
      hostname: 'study.example.com',
    })).toBe(false);
    expect(shouldWarnForDefaultFirebaseConfig({
      storageEngine: 'firebase',
      firebaseConfigText,
      hostname: 'localhost',
    })).toBe(false);
  });

  test('uses Vite env values when no explicit options are provided', () => {
    vi.stubEnv('VITE_STORAGE_ENGINE', 'firebase');
    vi.stubEnv('VITE_FIREBASE_CONFIG', JSON.stringify({ authDomain: DEFAULT_FIREBASE_AUTH_DOMAIN }));

    expect(shouldWarnForDefaultFirebaseConfig({ hostname: 'study.example.com' })).toBe(true);
  });
});
