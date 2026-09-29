import { MantineProvider } from '@mantine/core';
import {
  cleanup, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { StorageManagementView } from '../StorageManagementView';

const cloud = {
  isCloudEngine: () => true,
  getEngine: vi.fn(() => 'firebase'),
  getStorageDisconnected: vi.fn(async () => false),
  setStorageDisconnected: vi.fn(async () => {}),
};
let verifiedAdmin = true;

vi.mock('../../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: cloud, configuredStorageEngine: cloud }),
}));

vi.mock('../../../../store/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      isAdmin: verifiedAdmin,
      adminVerification: verifiedAdmin,
      user: verifiedAdmin ? { uid: 'admin-uid' } : null,
    },
  }),
}));

function renderView() {
  return render(<MantineProvider><StorageManagementView studyId="study-a" /></MantineProvider>);
}

describe('StorageManagementView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    verifiedAdmin = true;
    cloud.getEngine.mockReturnValue('firebase');
    vi.stubEnv('VITE_STORAGE_ENGINE', 'firebase');
    vi.stubEnv('VITE_FIREBASE_CONFIG', '{ projectId: "project-a", apiKey: "client-key" }');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test('does not reveal client configuration to an unverified user', () => {
    verifiedAdmin = false;
    renderView();
    expect(screen.queryByText('VITE_FIREBASE_CONFIG')).toBeNull();
    expect(cloud.getStorageDisconnected).not.toHaveBeenCalled();
  });

  test('shows configured client details and keeps the switch usable after a failed save', async () => {
    cloud.setStorageDisconnected.mockRejectedValueOnce(new Error('Save failed'));
    renderView();

    expect(screen.getByText('VITE_FIREBASE_CONFIG')).toBeDefined();
    expect(screen.getByText(/client-key/)).toBeDefined();
    const toggle = await screen.findByRole('switch', { name: 'Use local storage for new sessions' });
    await waitFor(() => expect(toggle.hasAttribute('disabled')).toBe(false));
    fireEvent.click(toggle);

    await waitFor(() => expect(cloud.setStorageDisconnected).toHaveBeenCalledWith('study-a', true));
    expect(await screen.findByText('Save failed')).toBeDefined();
    expect(toggle.hasAttribute('disabled')).toBe(false);
  });

  test('links a hosted Supabase project to its database editor', () => {
    cloud.getEngine.mockReturnValue('supabase');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project-123.supabase.co');
    renderView();

    expect(screen.getByRole('link', { name: 'Open database' }).getAttribute('href'))
      .toBe('https://supabase.com/dashboard/project/project-123/editor');
  });

  test('labels a self-hosted Supabase link as an endpoint', () => {
    cloud.getEngine.mockReturnValue('supabase');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://db.example.org');
    renderView();

    expect(screen.getByRole('link', { name: 'Open configured endpoint' }).getAttribute('href'))
      .toBe('https://db.example.org');
  });
});
