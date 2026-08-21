import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import {
  DEFAULT_FIREBASE_AUTH_DOMAIN,
  DEFAULT_FIREBASE_PROJECT_ID,
  DEFAULT_FIREBASE_STORAGE_BUCKET,
  isDefaultRevisitFirebaseConfig,
  isDefaultRevisitSupabaseUrl,
  isLocalDevelopmentHostname,
  isRevisitDevHostname,
  isRevisitControlledHostname,
  parseFirebaseConfig,
  shouldSuppressDefaultDeploymentWarnings,
  shouldWarnForDefaultFirebaseConfig,
  shouldWarnForDefaultSupabaseConfig,
} from '../defaultStorageConfig';

describe('defaultStorageConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('detects the default Firebase project by projectId, authDomain, or storageBucket', () => {
    expect(isDefaultRevisitFirebaseConfig({ projectId: DEFAULT_FIREBASE_PROJECT_ID })).toBe(true);
    expect(isDefaultRevisitFirebaseConfig({ authDomain: DEFAULT_FIREBASE_AUTH_DOMAIN })).toBe(true);
    expect(isDefaultRevisitFirebaseConfig({ storageBucket: DEFAULT_FIREBASE_STORAGE_BUCKET })).toBe(true);
    expect(isDefaultRevisitFirebaseConfig({ projectId: 'custom-project', authDomain: 'custom.firebaseapp.com', storageBucket: 'custom.appspot.com' })).toBe(false);
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
    expect(isRevisitDevHostname('revisit.dev')).toBe(true);
    expect(isRevisitDevHostname('supabase.revisit.dev')).toBe(true);
    expect(isRevisitDevHostname('vdl.sci.utah.edu')).toBe(false);
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

  test('detects default Supabase URLs hosted on revisit.dev domains', () => {
    expect(isDefaultRevisitSupabaseUrl('https://supabase.revisit.dev')).toBe(true);
    expect(isDefaultRevisitSupabaseUrl('https://revisit.dev')).toBe(true);
    expect(isDefaultRevisitSupabaseUrl('https://research.supabase.co')).toBe(false);
    expect(isDefaultRevisitSupabaseUrl('not-a-url')).toBe(false);
  });

  test('warns only for default Supabase URLs on non-controlled hosts', () => {
    expect(shouldWarnForDefaultSupabaseConfig({
      storageEngine: 'supabase',
      supabaseUrl: 'https://supabase.revisit.dev',
      hostname: 'study.example.com',
    })).toBe(true);
    expect(shouldWarnForDefaultSupabaseConfig({
      storageEngine: 'supabase',
      supabaseUrl: 'https://research.supabase.co',
      hostname: 'study.example.com',
    })).toBe(false);
    expect(shouldWarnForDefaultSupabaseConfig({
      storageEngine: 'firebase',
      supabaseUrl: 'https://supabase.revisit.dev',
      hostname: 'study.example.com',
    })).toBe(false);
    expect(shouldWarnForDefaultSupabaseConfig({
      storageEngine: 'supabase',
      supabaseUrl: 'https://supabase.revisit.dev',
      hostname: 'localhost',
    })).toBe(false);
  });
});
